/**
 * ============================================
 * App Module — Main SPA Controller
 * Handles all UI flow, event binding, screen
 * transitions, and DOM updates.
 * Uses jQuery for efficient DOM manipulation.
 * ============================================
 */

const App = (function ($) {
    'use strict';

    // --- Internal State ---
    let _paperData = {};        // Loaded JSON keyed by paperId
    let _selectedPaper = null;  // 'paper1' or 'paper2'
    let _selectedMode = null;   // 'full' or 'subject'
    let _selectedSubject = null;
    let _isExamActive = false;

    // =============================================
    // SCREEN MANAGEMENT
    // =============================================

    function showScreen(screenId) {
        $('.screen').removeClass('active');
        $('#' + screenId).addClass('active');
        window.scrollTo(0, 0);
    }

    function showLoading() { $('#loading-overlay').fadeIn(150); }
    function hideLoading() { $('#loading-overlay').fadeOut(150); }

    // =============================================
    // DATA LOADING
    // =============================================

    /**
     * Load both paper JSON files
     */
    async function loadPaperData() {
        try {
            const [p1, p2] = await Promise.all([
                $.getJSON('data/paper1.json'),
                $.getJSON('data/paper2.json')
            ]);
            _paperData['paper1'] = p1;
            _paperData['paper2'] = p2;
            return true;
        } catch (err) {
            console.error('[App] Failed to load question data:', err);
            alert('Failed to load question data. Please ensure the JSON files exist.');
            return false;
        }
    }

    // =============================================
    // HOME SCREEN LOGIC
    // =============================================

    function initHomeScreen() {
        // Load saved candidate name
        const savedName = StorageManager.loadCandidateName();
        if (savedName) $('#candidate-name').val(savedName);

        // Check for active session
        checkForActiveSession();

        // Reset selections
        _selectedPaper = null;
        _selectedMode = null;
        _selectedSubject = null;
        updateStartButton();
    }

    function checkForActiveSession() {
        if (StorageManager.hasActiveSession()) {
            const session = StorageManager.loadSession();
            const testName = session.config ? session.config.testName : 'Unknown Test';
            $('#resume-test-info').text(`Test: ${testName}`);
            $('#resume-banner').slideDown(300);
        } else {
            $('#resume-banner').hide();
        }
    }

    /**
     * Handle paper card selection
     */
    function onPaperSelect(paperId) {
        _selectedPaper = paperId;
        _selectedMode = null;
        _selectedSubject = null;

        // Visual update
        $('.paper-card').removeClass('selected');
        $(`.paper-card[data-paper="${paperId}"]`).addClass('selected');

        // Show mode selection
        $('#mode-selection-group').slideDown(200);
        $('.mode-card').removeClass('selected');

        // Hide subject and summary
        $('#subject-selection-group').slideUp(200);
        $('#test-summary').slideUp(200);
        $('#test-options').slideUp(200);

        updateStartButton();
    }

    /**
     * Handle mode selection
     */
    function onModeSelect(mode) {
        _selectedMode = mode;
        _selectedSubject = null;

        // Visual update
        $('.mode-card').removeClass('selected');
        $(`.mode-card[data-mode="${mode}"]`).addClass('selected');

        if (mode === 'full') {
            // Full-length: hide subject selector, show summary
            $('#subject-selection-group').slideUp(200);
            showTestSummary('full');
        } else if (mode === 'subject') {
            // Subject-wise: show subject grid
            populateSubjectGrid();
            $('#subject-selection-group').slideDown(200);
            $('#test-summary').slideUp(200);
            $('#test-options').slideUp(200);
        }

        updateStartButton();
    }

    /**
     * Populate the subject selection grid from paper data
     */
    function populateSubjectGrid() {
        const paper = _paperData[_selectedPaper];
        if (!paper) return;

        const $grid = $('#subject-grid');
        $grid.empty();

        paper.subjects.forEach(sub => {
            const $card = $(`
                <div class="subject-card" data-subject="${sub.subjectId}">
                    <span class="subject-icon">${sub.icon}</span>
                    <span class="subject-name">${sub.subjectName}</span>
                    <span class="subject-count">${sub.questionCount}Q</span>
                </div>
            `);
            $grid.append($card);
        });
    }

    /**
     * Handle subject card selection
     */
    function onSubjectSelect(subjectId) {
        _selectedSubject = subjectId;

        $('.subject-card').removeClass('selected');
        $(`.subject-card[data-subject="${subjectId}"]`).addClass('selected');

        showTestSummary(subjectId);
    }

    /**
     * Show the test summary panel
     */
    function showTestSummary(testKey) {
        const paper = _paperData[_selectedPaper];
        if (!paper) return;

        const testInfo = paper.tests[testKey];
        if (!testInfo) return;

        const paperInfo = paper.paperInfo;
        const questionCount = testInfo.questionIds.length;

        $('#summary-test-name').text(testInfo.testName);
        $('#summary-questions').text(questionCount);
        $('#summary-duration').text(testInfo.durationMinutes + ' Minutes');
        $('#summary-marks').text(questionCount * paperInfo.marksPerQuestion);
        $('#summary-negative').text(`-${(paperInfo.marksPerQuestion * paperInfo.negativeMarkingRatio).toFixed(2)} per wrong answer`);

        $('#test-summary').slideDown(200);
        $('#test-options').slideDown(200);
        updateStartButton();
    }

    /**
     * Update the start button state
     */
    function updateStartButton() {
        const canStart = _selectedPaper &&
            ((_selectedMode === 'full') || (_selectedMode === 'subject' && _selectedSubject));

        $('#btn-start-test').prop('disabled', !canStart);
    }

    // =============================================
    // START TEST
    // =============================================

    function startNewTest() {
        const paper = _paperData[_selectedPaper];
        if (!paper) return;

        const testKey = _selectedMode === 'full' ? 'full' : _selectedSubject;
        const candidateName = $('#candidate-name').val().trim() || 'Candidate';
        const shuffleQ = $('#opt-shuffle-questions').is(':checked');
        const shuffleO = $('#opt-shuffle-options').is(':checked');

        // Save candidate name
        StorageManager.saveCandidateName(candidateName);

        // Clear any old session
        StorageManager.clearSession();

        showLoading();

        // Small delay for UX
        setTimeout(function () {
            // Initialize TestEngine
            const config = TestEngine.initTest({
                paperData: paper,
                testKey: testKey,
                shuffleQuestions: shuffleQ,
                shuffleOptions: shuffleO,
                candidateName: candidateName
            });

            // Initialize Timer
            Timer.init({
                durationSeconds: config.durationSeconds,
                onTick: onTimerTick,
                onTimeUp: onTimeUp
            });

            // Save initial session
            TestEngine.saveSession();

            // Transition to exam screen
            initExamScreen();
            Timer.start();
            _isExamActive = true;

            // Activate Exam Guard
            activateExamGuard();

            hideLoading();
            showScreen('screen-exam');
        }, 400);
    }

    /**
     * Resume an existing test session
     */
    function resumeTest() {
        const session = StorageManager.loadSession();
        if (!session) {
            alert('No active session found.');
            return;
        }

        showLoading();

        setTimeout(function () {
            // Restore TestEngine state
            TestEngine.restoreFromSession(session);

            // Calculate corrected remaining time
            const correctedTime = StorageManager.getCorrectedRemainingTime();

            if (correctedTime <= 0) {
                // Time already expired while away
                hideLoading();
                onTimeUp();
                return;
            }

            // Initialize Timer with remaining time
            Timer.init({
                durationSeconds: session.config.durationSeconds,
                remainingSeconds: correctedTime,
                onTick: onTimerTick,
                onTimeUp: onTimeUp
            });

            // Transition to exam screen
            initExamScreen();
            Timer.start();
            _isExamActive = true;

            // Activate Exam Guard
            activateExamGuard();

            hideLoading();
            showScreen('screen-exam');
        }, 300);
    }

    // =============================================
    // EXAM SCREEN
    // =============================================

    function initExamScreen() {
        const config = TestEngine.getConfig();

        // Update header
        $('#exam-test-name').text(config.testName);
        $('#exam-paper-name').text(`${config.paperCode} - ${config.paperName}`);
        $('#exam-candidate-name').text(config.candidateName);
        $('#total-q-count').text(config.totalQuestions);

        // Build navigation grid
        buildNavigationGrid();

        // Show first question
        renderCurrentQuestion();
        updateNavigationGrid();
        updateStats();
    }

    /**
     * Build the question navigation grid buttons
     */
    function buildNavigationGrid() {
        const total = TestEngine.getTotalQuestions();
        const $grid = $('#question-grid');
        $grid.empty();

        for (let i = 0; i < total; i++) {
            const $btn = $(`<button class="q-nav-btn" data-index="${i}">${i + 1}</button>`);
            $grid.append($btn);
        }
    }

    /**
     * Render the currently active question
     */
    function renderCurrentQuestion() {
        const question = TestEngine.getCurrentQuestion();
        const state = TestEngine.getCurrentState();
        const idx = TestEngine.getCurrentIndex();

        if (!question || !state) return;

        // Question number
        $('#current-q-number').text(idx + 1);

        // Topic and difficulty badges
        $('#q-topic-badge').text(question.topic || 'General');
        const diffBadge = $('#q-difficulty-badge');
        diffBadge.text(question.difficulty || 'medium');
        diffBadge.removeClass('easy medium hard').addClass(question.difficulty || 'medium');

        // Question text
        $('#question-text').text(question.question);

        // Options
        const optionKeys = ['A', 'B', 'C', 'D'];
        optionKeys.forEach(key => {
            $(`#option-${key.toLowerCase()}-text`).text(question.options[key] || '');
        });

        // Clear previous option selection visual
        $('.option-label').removeClass('selected');
        $('input[name="answer"]').prop('checked', false);

        // Restore selected answer
        if (state.selectedOption) {
            $(`input[name="answer"][value="${state.selectedOption}"]`).prop('checked', true);
            $(`.option-label[data-option="${state.selectedOption}"]`).addClass('selected');
        }

        // Mark for review checkbox
        $('#chk-mark-review').prop('checked', state.markedForReview);
        if (state.markedForReview) {
            $('#mark-review-label').addClass('active');
        } else {
            $('#mark-review-label').removeClass('active');
        }

        // Update nav grid to highlight current
        updateNavigationGrid();
    }

    /**
     * Update the navigation grid colors and current highlight
     */
    function updateNavigationGrid() {
        const total = TestEngine.getTotalQuestions();
        const currentIdx = TestEngine.getCurrentIndex();

        for (let i = 0; i < total; i++) {
            const $btn = $(`.q-nav-btn[data-index="${i}"]`);
            const status = TestEngine.getNavStatus(i);

            // Remove all status classes
            $btn.removeClass('not-visited not-answered answered marked answered-marked current');
            $btn.addClass(status);

            if (i === currentIdx) {
                $btn.addClass('current');
            }
        }
    }

    /**
     * Update statistics in the nav panel
     */
    function updateStats() {
        const stats = TestEngine.getStats();
        $('#stat-answered').text(stats.answered);
        $('#stat-not-answered').text(stats.notAnswered);
        $('#stat-marked').text(stats.marked + stats.answeredMarked);
        $('#stat-not-visited').text(stats.notVisited);
        $('#mobile-nav-badge').text(stats.answered);
    }

    // =============================================
    // TIMER CALLBACKS
    // =============================================

    function onTimerTick(timerData) {
        $('#timer-display').text(timerData.formatted);

        if (timerData.isWarning) {
            $('#timer-container').addClass('warning');
        } else {
            $('#timer-container').removeClass('warning');
        }
    }

    function onTimeUp() {
        _isExamActive = false;
        Timer.stop();

        // Deactivate Exam Guard
        deactivateExamGuard();

        // Calculate and store result
        const resultData = TestEngine.getResultData();
        const result = ResultEngine.calculate(resultData);

        // Save to history
        StorageManager.addToHistory(result);
        StorageManager.clearSession();
        TestEngine.reset();

        // Show time-up modal
        $('#modal-timeup').fadeIn(200);
    }

    // =============================================
    // SUBMIT TEST
    // =============================================

    function showSubmitConfirmation() {
        const stats = TestEngine.getStats();
        $('#modal-answered').text(stats.answered);
        $('#modal-unanswered').text(stats.notAnswered + stats.notVisited);
        $('#modal-marked').text(stats.marked + stats.answeredMarked);
        $('#modal-submit').fadeIn(200);
    }

    function confirmSubmit() {
        $('#modal-submit').fadeOut(150);
        _isExamActive = false;
        Timer.stop();

        // Deactivate Exam Guard
        deactivateExamGuard();

        // Calculate result
        const resultData = TestEngine.getResultData();
        const result = ResultEngine.calculate(resultData);

        // Save to history
        StorageManager.addToHistory(result);
        StorageManager.clearSession();
        TestEngine.reset();

        // Show results
        renderResultScreen(result);
        showScreen('screen-result');
    }

    // =============================================
    // RESULT SCREEN
    // =============================================

    function renderResultScreen(result) {
        if (!result) return;

        $('#result-test-name').text(result.testName + ' — ' + result.paperName);

        // Score circle animation
        const percentage = ResultEngine.getScorePercentage();
        const circumference = 326.73; // 2 * PI * 52
        const offset = circumference - (percentage / 100) * circumference;

        $('#score-value').text(result.totalScore);
        $('#score-total').text('/ ' + result.maxMarks);

        // Reset and animate the progress circle
        $('#score-progress').css('stroke-dashoffset', circumference);
        setTimeout(() => {
            $('#score-progress').css('stroke-dashoffset', offset);
        }, 150);

        // Color the score based on performance
        const progressEl = document.getElementById('score-progress');
        if (percentage >= 60) {
            progressEl.style.stroke = '#059669'; // green
        } else if (percentage >= 35) {
            progressEl.style.stroke = '#d97706'; // orange
        } else {
            progressEl.style.stroke = '#dc2626'; // red
        }

        // Detail cards
        $('#result-total-q').text(result.totalQuestions);
        $('#result-attempted').text(result.attempted);
        $('#result-correct').text(result.correct);
        $('#result-incorrect').text(result.incorrect);
        $('#result-accuracy').text(result.accuracy + '%');
        $('#result-time-taken').text(result.timeTakenFormatted);

        // Topic-wise table
        renderTopicTable(result.topicBreakdown);
    }

    function renderTopicTable(topicBreakdown) {
        const $tbody = $('#topic-table-body');
        $tbody.empty();

        topicBreakdown.forEach(topic => {
            const barColor = topic.accuracy >= 60 ? '#059669' :
                topic.accuracy >= 35 ? '#d97706' : '#dc2626';

            const $row = $(`
                <tr>
                    <td><strong>${topic.topic}</strong></td>
                    <td>${topic.total}</td>
                    <td>${topic.attempted}</td>
                    <td style="color:#059669;font-weight:700;">${topic.correct}</td>
                    <td style="color:#dc2626;font-weight:700;">${topic.incorrect}</td>
                    <td><strong>${topic.score.toFixed(2)}</strong> / ${topic.maxScore}</td>
                    <td>
                        <div class="accuracy-bar-cell">
                            <span>${topic.accuracy}%</span>
                            <div class="accuracy-bar">
                                <div class="accuracy-bar-fill" style="width:${topic.accuracy}%;background:${barColor}"></div>
                            </div>
                        </div>
                    </td>
                </tr>
            `);
            $tbody.append($row);
        });
    }

    // =============================================
    // REVIEW SCREEN
    // =============================================

    function renderReviewScreen(filter) {
        filter = filter || 'all';
        const result = ResultEngine.getLastResult();
        if (!result) return;

        $('#review-test-name').text(result.testName);

        // Update active filter button
        $('.review-filter').removeClass('active');
        $(`.review-filter[data-filter="${filter}"]`).addClass('active');

        const questions = ResultEngine.getFilteredResults(filter);
        const $container = $('#review-container');
        $container.empty();

        if (questions.length === 0) {
            $container.html(`
                <div class="history-empty" style="display:block;padding:40px;">
                    <i class="fas fa-search" style="font-size:2rem;"></i>
                    <h3>No questions found</h3>
                    <p>No questions match the selected filter.</p>
                </div>
            `);
            return;
        }

        questions.forEach((q, idx) => {
            // Find the original index (1-based question number)
            const allResults = result.questionResults;
            const originalIdx = allResults.findIndex(r => r.questionId === q.questionId);
            const qNumber = originalIdx + 1;

            const statusClass = q.status === 'correct' ? 'correct' :
                q.status === 'incorrect' ? 'incorrect' : 'unattempted';
            const statusText = q.status === 'correct' ? '✓ Correct' :
                q.status === 'incorrect' ? '✗ Incorrect' : '— Skipped';

            let optionsHTML = '';
            ['A', 'B', 'C', 'D'].forEach(key => {
                let optClass = '';
                if (key === q.correctAnswer) optClass = 'correct-answer';
                else if (key === q.selectedOption && q.status === 'incorrect') optClass = 'wrong-answer';

                optionsHTML += `
                    <div class="review-option ${optClass}">
                        <span class="review-option-marker">${key}</span>
                        <span class="review-option-text">${q.options[key] || ''}</span>
                    </div>
                `;
            });

            const $card = $(`
                <div class="review-question-card" data-status="${q.status}">
                    <div class="review-q-header">
                        <span class="review-q-number">
                            Q${qNumber}
                            <span class="q-topic-badge">${q.topic}</span>
                        </span>
                        <span class="review-status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="review-q-body">
                        <div class="review-q-text">${q.question}</div>
                        <div class="review-options">${optionsHTML}</div>
                        <div class="review-explanation">
                            <div class="review-explanation-label"><i class="fas fa-lightbulb"></i> Explanation</div>
                            <div class="review-explanation-text">${q.explanation}</div>
                        </div>
                    </div>
                </div>
            `);
            $container.append($card);
        });
    }

    // =============================================
    // HISTORY SCREEN
    // =============================================

    function renderHistoryScreen() {
        const history = StorageManager.getHistory();
        const $list = $('#history-list');
        $list.empty();

        if (history.length === 0) {
            $('#history-list').hide();
            $('#history-empty').show();
            return;
        }

        $('#history-list').show();
        $('#history-empty').hide();

        history.forEach(item => {
            const date = new Date(item.completedAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const $card = $(`
                <div class="history-card" data-history-id="${item.historyId}">
                    <div class="history-card-info">
                        <h4>${item.testName}</h4>
                        <p>${item.paperName} • ${date}</p>
                    </div>
                    <div class="history-card-stats">
                        <div class="history-stat">
                            <span class="history-stat-value">${item.totalScore}</span>
                            <span class="history-stat-label">Score</span>
                        </div>
                        <div class="history-stat">
                            <span class="history-stat-value">${item.accuracy}%</span>
                            <span class="history-stat-label">Accuracy</span>
                        </div>
                        <div class="history-stat">
                            <span class="history-stat-value">${item.correct}/${item.totalQuestions}</span>
                            <span class="history-stat-label">Correct</span>
                        </div>
                        <div class="history-stat">
                            <span class="history-stat-value">${item.timeTakenFormatted}</span>
                            <span class="history-stat-label">Time</span>
                        </div>
                    </div>
                    <div class="history-card-actions">
                        <button class="btn btn-sm btn-outline history-view-btn" data-history-id="${item.historyId}">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-sm btn-outline history-review-btn" data-history-id="${item.historyId}">
                            <i class="fas fa-search"></i> Review
                        </button>
                    </div>
                </div>
            `);
            $list.append($card);
        });
    }

    function viewHistoryResult(historyId) {
        const item = StorageManager.getHistoryById(historyId);
        if (!item) return;

        ResultEngine.setResult(item);
        renderResultScreen(item);
        showScreen('screen-result');
    }

    function reviewHistoryItem(historyId) {
        const item = StorageManager.getHistoryById(historyId);
        if (!item) return;

        ResultEngine.setResult(item);
        renderReviewScreen('all');
        showScreen('screen-review');
    }

    // =============================================
    // DARK MODE
    // =============================================

    function initDarkMode() {
        const isDark = StorageManager.loadDarkMode();
        if (isDark) {
            $('body').addClass('dark-mode');
            $('#btn-dark-toggle i').removeClass('fa-moon').addClass('fa-sun');
        }
    }

    function toggleDarkMode() {
        const isDark = $('body').toggleClass('dark-mode').hasClass('dark-mode');
        StorageManager.saveDarkMode(isDark);
        $('#btn-dark-toggle i').toggleClass('fa-moon fa-sun');
    }

    // =============================================
    // EXAM GUARD INTEGRATION
    // =============================================

    /**
     * Activate the ExamGuard security lockdown
     */
    function activateExamGuard() {
        if (typeof ExamGuard === 'undefined') return;

        // Reset violation badge
        $('#violation-count').text('0');
        $('#violation-badge').hide();

        ExamGuard.activate({
            maxViolations: 5,
            onViolation: function (count, reason, max) {
                // Update badge
                $('#violation-badge').show();
                $('#violation-count').text(count);

                // Update modal
                $('#violation-reason').text(reason);
                $('#violation-modal-count').text(count);
                $('#violation-modal-max').text(max);
                $('#violation-progress-fill').css('width', ((count / max) * 100) + '%');

                // Update warning text based on remaining violations
                const remaining = max - count;
                if (remaining <= 1) {
                    $('#violation-warning-text').html(
                        '🚨 <strong>FINAL WARNING!</strong> One more violation and your test will be auto-submitted.'
                    );
                } else {
                    $('#violation-warning-text').html(
                        '⚠️ Your test will be <strong>auto-submitted</strong> after reaching maximum violations. (' + remaining + ' remaining)'
                    );
                }

                // Show violation modal
                $('#modal-violation').fadeIn(200);
            },
            onAutoSubmit: function () {
                // Hide violation modal if showing
                $('#modal-violation').hide();

                // Show auto-submit modal
                $('#modal-autosubmit').fadeIn(200);

                // Actually submit the test
                _isExamActive = false;
                Timer.stop();
                deactivateExamGuard();

                const resultData = TestEngine.getResultData();
                const result = ResultEngine.calculate(resultData);
                StorageManager.addToHistory(result);
                StorageManager.clearSession();
                TestEngine.reset();

                // Store result for viewing after modal
                ResultEngine.setResult(result);
            }
        });
    }

    /**
     * Deactivate the ExamGuard security lockdown
     */
    function deactivateExamGuard() {
        if (typeof ExamGuard === 'undefined') return;
        ExamGuard.deactivate();
    }

    // =============================================
    // EVENT BINDINGS
    // =============================================

    function bindEvents() {

        // --- HOME SCREEN ---

        // Paper selection (event delegation)
        $('#paper-selection').on('click', '.paper-card', function () {
            onPaperSelect($(this).data('paper'));
        });

        // Mode selection
        $('#mode-selection').on('click', '.mode-card', function () {
            onModeSelect($(this).data('mode'));
        });

        // Subject selection
        $('#subject-grid').on('click', '.subject-card', function () {
            onSubjectSelect($(this).data('subject'));
        });

        // Start test
        $('#btn-start-test').on('click', function () {
            if (!$(this).prop('disabled')) startNewTest();
        });

        // Resume test
        $('#btn-resume-test').on('click', resumeTest);

        // Discard test
        $('#btn-discard-test').on('click', function () {
            $('#modal-discard').fadeIn(200);
        });
        $('#btn-cancel-discard').on('click', function () {
            $('#modal-discard').fadeOut(150);
        });
        $('#btn-confirm-discard').on('click', function () {
            StorageManager.clearSession();
            $('#modal-discard').fadeOut(150);
            $('#resume-banner').slideUp(300);
        });

        // History button
        $('#btn-history').on('click', function () {
            renderHistoryScreen();
            showScreen('screen-history');
        });

        // Dark mode toggle
        $('#btn-dark-toggle').on('click', toggleDarkMode);

        // --- EXAM SCREEN ---

        // Option selection (event delegation on options container)
        $('#options-container').on('click', '.option-label', function () {
            const option = $(this).data('option');
            if (!option) return;

            // Visual update
            $('.option-label').removeClass('selected');
            $(this).addClass('selected');
            $(this).find('input[type="radio"]').prop('checked', true);

            // Update engine
            TestEngine.selectAnswer(option);
            updateNavigationGrid();
            updateStats();
        });

        // Clear response
        $('#btn-clear-response').on('click', function () {
            TestEngine.clearResponse();
            $('.option-label').removeClass('selected');
            $('input[name="answer"]').prop('checked', false);
            updateNavigationGrid();
            updateStats();
        });

        // Mark for review
        $('#mark-review-label').on('click', function (e) {
            e.preventDefault();
            const newState = TestEngine.toggleMarkForReview();
            $('#chk-mark-review').prop('checked', newState);
            if (newState) {
                $(this).addClass('active');
            } else {
                $(this).removeClass('active');
            }
            updateNavigationGrid();
            updateStats();
        });

        // Save & Next
        $('#btn-save-next').on('click', function () {
            if (!TestEngine.nextQuestion()) {
                // Already at last question — can optionally show a message
            }
            renderCurrentQuestion();
            updateStats();
        });

        // Previous
        $('#btn-prev-question').on('click', function () {
            TestEngine.prevQuestion();
            renderCurrentQuestion();
            updateStats();
        });

        // Navigation grid click (event delegation)
        $('#question-grid').on('click', '.q-nav-btn', function () {
            const index = parseInt($(this).data('index'), 10);
            TestEngine.goToQuestion(index);
            renderCurrentQuestion();
            updateStats();

            // Close mobile nav if open
            $('#navigation-panel').removeClass('open');
        });

        // Submit button
        $('#btn-submit-test').on('click', showSubmitConfirmation);

        // Submit modal
        $('#btn-cancel-submit').on('click', function () {
            $('#modal-submit').fadeOut(150);
        });
        $('#btn-confirm-submit').on('click', confirmSubmit);

        // Time-up modal
        $('#btn-timeup-ok').on('click', function () {
            $('#modal-timeup').fadeOut(150);
            const result = ResultEngine.getLastResult();
            renderResultScreen(result);
            showScreen('screen-result');
        });

        // Mobile nav toggle
        $('#btn-mobile-nav-toggle').on('click', function () {
            $('#navigation-panel').toggleClass('open');
        });
        $('#btn-toggle-nav').on('click', function () {
            $('#navigation-panel').removeClass('open');
        });

        // --- RESULT SCREEN ---
        $('#btn-review-answers').on('click', function () {
            renderReviewScreen('all');
            showScreen('screen-review');
        });
        $('#btn-back-home').on('click', function () {
            initHomeScreen();
            showScreen('screen-home');
        });

        // --- REVIEW SCREEN ---
        $('.review-filter').on('click', function () {
            const filter = $(this).data('filter');
            renderReviewScreen(filter);
        });
        $('#btn-back-result').on('click', function () {
            showScreen('screen-result');
        });

        // --- HISTORY SCREEN ---
        $('#btn-history-home, #btn-history-start').on('click', function () {
            initHomeScreen();
            showScreen('screen-home');
        });
        $('#btn-clear-history').on('click', function () {
            if (confirm('Are you sure you want to clear all test history?')) {
                StorageManager.clearHistory();
                renderHistoryScreen();
            }
        });

        // History card actions (event delegation)
        $('#history-list').on('click', '.history-view-btn', function () {
            viewHistoryResult($(this).data('history-id'));
        });
        $('#history-list').on('click', '.history-review-btn', function () {
            reviewHistoryItem($(this).data('history-id'));
        });

        // --- EXAM GUARD MODALS ---

        // Violation warning OK button
        $('#btn-violation-ok').on('click', function () {
            $('#modal-violation').fadeOut(150);
            // Re-enter fullscreen after violation
            if (typeof ExamGuard !== 'undefined' && ExamGuard.isActive()) {
                ExamGuard.reEnterFullscreen();
            }
        });

        // Auto-submit OK button
        $('#btn-autosubmit-ok').on('click', function () {
            $('#modal-autosubmit').fadeOut(150);
            const result = ResultEngine.getLastResult();
            if (result) {
                renderResultScreen(result);
                showScreen('screen-result');
            } else {
                initHomeScreen();
                showScreen('screen-home');
            }
        });

        // --- KEYBOARD SHORTCUTS ---
        $(document).on('keydown', function (e) {
            if (!_isExamActive) return;

            // Prevent shortcuts when typing in input fields
            if ($(e.target).is('input, textarea, select')) return;

            switch (e.key) {
                case 'ArrowRight':
                case 'n':
                    e.preventDefault();
                    TestEngine.nextQuestion();
                    renderCurrentQuestion();
                    updateStats();
                    break;
                case 'ArrowLeft':
                case 'p':
                    e.preventDefault();
                    TestEngine.prevQuestion();
                    renderCurrentQuestion();
                    updateStats();
                    break;
                case 'a':
                case '1':
                    e.preventDefault();
                    selectOptionByKey('A');
                    break;
                case 'b':
                case '2':
                    e.preventDefault();
                    selectOptionByKey('B');
                    break;
                case 'c':
                case '3':
                    e.preventDefault();
                    selectOptionByKey('C');
                    break;
                case 'd':
                case '4':
                    e.preventDefault();
                    selectOptionByKey('D');
                    break;
                case 'm':
                    e.preventDefault();
                    $('#mark-review-label').click();
                    break;
                case 'x':
                    e.preventDefault();
                    $('#btn-clear-response').click();
                    break;
            }
        });

        // --- PREVENT ACCIDENTAL NAVIGATION ---
        $(window).on('beforeunload', function () {
            if (_isExamActive) {
                // Save state before leaving
                TestEngine.saveSession();
                StorageManager.saveRemainingTime(Timer.getRemaining());
                return 'You have an ongoing test. Are you sure you want to leave?';
            }
        });
    }

    /**
     * Select an option via keyboard shortcut
     */
    function selectOptionByKey(optionKey) {
        const $label = $(`.option-label[data-option="${optionKey}"]`);
        if ($label.length) {
            $label.click();
        }
    }

    // =============================================
    // INITIALIZATION
    // =============================================

    async function init() {
        // Apply dark mode
        initDarkMode();

        // Load data
        showLoading();
        const loaded = await loadPaperData();
        hideLoading();

        if (!loaded) return;

        // Bind events
        bindEvents();

        // Initialize home screen
        initHomeScreen();
        showScreen('screen-home');

        console.log('[App] UPSC Prelims Mock Test Platform initialized.');
        console.log('[App] Debug:', StorageManager.getDebugInfo());
    }

    // --- Start App when DOM is ready ---
    $(document).ready(function () {
        init();
    });

    // Public API (for debugging)
    return {
        getState: function () {
            return {
                selectedPaper: _selectedPaper,
                selectedMode: _selectedMode,
                selectedSubject: _selectedSubject,
                isExamActive: _isExamActive
            };
        }
    };

})(jQuery);