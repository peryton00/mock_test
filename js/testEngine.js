/**
 * ============================================
 * TestEngine Module
 * Core exam logic: question state management,
 * navigation, shuffling, and session handling.
 * ============================================
 */

const TestEngine = (function () {
    'use strict';

    // --- Internal State ---
    let _config = null;         // Test configuration (testInfo, paperInfo)
    let _questions = [];        // Array of question objects for this test
    let _questionStates = [];   // Array tracking state of each question
    let _currentIndex = 0;      // Currently active question index
    let _totalQuestions = 0;
    let _shuffleMap = null;     // Original order mapping (for result correlation)

    // --- Question State Template ---
    function _createQuestionState(questionId) {
        return {
            questionId: questionId,
            visited: false,
            answered: false,
            selectedOption: null,
            markedForReview: false
        };
    }

    // --- Shuffle Utility (Fisher-Yates) ---
    function _shuffleArray(arr) {
        const shuffled = [...arr];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Shuffle the options of a single question and update the correctAnswer
     */
    function _shuffleQuestionOptions(question) {
        const optionKeys = Object.keys(question.options); // ['A','B','C','D']
        const shuffledKeys = _shuffleArray(optionKeys);

        const newOptions = {};
        const keyMap = {}; // old key -> new key
        shuffledKeys.forEach((oldKey, idx) => {
            const newKey = optionKeys[idx]; // A, B, C, D in order
            newOptions[newKey] = question.options[oldKey];
            keyMap[oldKey] = newKey;
        });

        return {
            ...question,
            options: newOptions,
            correctAnswer: keyMap[question.correctAnswer],
            _originalCorrectAnswer: question.correctAnswer, // keep original for reference
            _optionMap: keyMap
        };
    }

    // --- Public API ---

    return {
        /**
         * Initialize a new test
         * @param {Object} params
         * @param {Object} params.paperData - Full paper JSON data
         * @param {string} params.testKey - 'full' or subject ID
         * @param {boolean} params.shuffleQuestions - Whether to shuffle question order
         * @param {boolean} params.shuffleOptions - Whether to shuffle option order
         * @param {string} params.candidateName - Candidate name
         * @returns {Object} Test configuration summary
         */
        initTest: function (params) {
            const { paperData, testKey, shuffleQuestions, shuffleOptions, candidateName } = params;

            const testInfo = paperData.tests[testKey];
            const paperInfo = paperData.paperInfo;

            // Filter questions by test's questionIds
            let questions = testInfo.questionIds.map(id => {
                return paperData.questions.find(q => q.id === id);
            }).filter(Boolean);

            // Shuffle questions if requested
            if (shuffleQuestions) {
                questions = _shuffleArray(questions);
            }

            // Shuffle options if requested
            if (shuffleOptions) {
                questions = questions.map(q => _shuffleQuestionOptions(q));
            }

            _questions = questions;
            _totalQuestions = _questions.length;
            _currentIndex = 0;

            // Initialize question states
            _questionStates = _questions.map(q => _createQuestionState(q.id));

            // Mark first question as visited
            if (_questionStates.length > 0) {
                _questionStates[0].visited = true;
            }

            // Build config
            _config = {
                testId: testInfo.testId,
                testName: testInfo.testName,
                testKey: testKey,
                paperId: paperInfo.paperId,
                paperName: paperInfo.paperName,
                paperCode: paperInfo.paperCode,
                durationMinutes: testInfo.durationMinutes,
                durationSeconds: testInfo.durationMinutes * 60,
                marksPerQuestion: paperInfo.marksPerQuestion,
                negativeMarkingRatio: paperInfo.negativeMarkingRatio,
                totalQuestions: _totalQuestions,
                maxMarks: _totalQuestions * paperInfo.marksPerQuestion,
                candidateName: candidateName || 'Candidate',
                shuffleQuestions: shuffleQuestions,
                shuffleOptions: shuffleOptions,
                startTimestamp: Date.now()
            };

            return _config;
        },

        /**
         * Restore a test from a saved session
         * @param {Object} session - Saved session from StorageManager
         */
        restoreFromSession: function (session) {
            _config = session.config;
            _questions = session.questions;
            _questionStates = session.questionStates;
            _currentIndex = session.currentIndex || 0;
            _totalQuestions = _questions.length;
        },

        /**
         * Get the full session state for persistence
         * @returns {Object}
         */
        getSessionSnapshot: function () {
            return {
                status: 'in_progress',
                config: _config,
                questions: _questions,
                questionStates: _questionStates,
                currentIndex: _currentIndex,
                remainingSeconds: Timer.getRemaining(),
                lastSavedTimestamp: Date.now()
            };
        },

        /**
         * Save current session to localStorage
         */
        saveSession: function () {
            StorageManager.saveSession(this.getSessionSnapshot());
        },

        // --- Navigation ---

        getCurrentIndex: function () { return _currentIndex; },
        getTotalQuestions: function () { return _totalQuestions; },
        getConfig: function () { return _config; },
        getQuestions: function () { return _questions; },
        getQuestionStates: function () { return _questionStates; },

        /**
         * Get current question object
         * @returns {Object}
         */
        getCurrentQuestion: function () {
            return _questions[_currentIndex] || null;
        },

        /**
         * Get current question's state
         * @returns {Object}
         */
        getCurrentState: function () {
            return _questionStates[_currentIndex] || null;
        },

        /**
         * Navigate to a specific question index
         * @param {number} index - Zero-based index
         */
        goToQuestion: function (index) {
            if (index >= 0 && index < _totalQuestions) {
                _currentIndex = index;
                _questionStates[index].visited = true;
                this.saveSession();
            }
        },

        /**
         * Go to next question
         * @returns {boolean} Whether navigation succeeded
         */
        nextQuestion: function () {
            if (_currentIndex < _totalQuestions - 1) {
                this.goToQuestion(_currentIndex + 1);
                return true;
            }
            return false;
        },

        /**
         * Go to previous question
         * @returns {boolean} Whether navigation succeeded
         */
        prevQuestion: function () {
            if (_currentIndex > 0) {
                this.goToQuestion(_currentIndex - 1);
                return true;
            }
            return false;
        },

        // --- Answer Management ---

        /**
         * Select an answer for the current question
         * @param {string} option - 'A', 'B', 'C', or 'D'
         */
        selectAnswer: function (option) {
            const state = _questionStates[_currentIndex];
            if (state) {
                state.selectedOption = option;
                state.answered = true;
                this.saveSession();
            }
        },

        /**
         * Clear the response for the current question
         */
        clearResponse: function () {
            const state = _questionStates[_currentIndex];
            if (state) {
                state.selectedOption = null;
                state.answered = false;
                this.saveSession();
            }
        },

        /**
         * Toggle mark-for-review on the current question
         * @returns {boolean} New marked state
         */
        toggleMarkForReview: function () {
            const state = _questionStates[_currentIndex];
            if (state) {
                state.markedForReview = !state.markedForReview;
                this.saveSession();
                return state.markedForReview;
            }
            return false;
        },

        /**
         * Set mark-for-review explicitly
         * @param {boolean} marked
         */
        setMarkForReview: function (marked) {
            const state = _questionStates[_currentIndex];
            if (state) {
                state.markedForReview = marked;
                this.saveSession();
            }
        },

        // --- Statistics ---

        /**
         * Get current test statistics
         * @returns {Object}
         */
        getStats: function () {
            let answered = 0, notAnswered = 0, marked = 0, notVisited = 0, answeredMarked = 0;

            _questionStates.forEach(s => {
                if (!s.visited) {
                    notVisited++;
                } else if (s.answered && s.markedForReview) {
                    answeredMarked++;
                } else if (s.answered) {
                    answered++;
                } else if (s.markedForReview) {
                    marked++;
                } else {
                    notAnswered++;
                }
            });

            return {
                answered: answered + answeredMarked, // total answered
                answeredOnly: answered,
                notAnswered: notAnswered,
                marked: marked,
                notVisited: notVisited,
                answeredMarked: answeredMarked,
                total: _totalQuestions
            };
        },

        /**
         * Get the navigation status class for a question
         * @param {number} index - Zero-based index
         * @returns {string} CSS class name
         */
        getNavStatus: function (index) {
            const state = _questionStates[index];
            if (!state) return 'not-visited';

            if (!state.visited) return 'not-visited';
            if (state.answered && state.markedForReview) return 'answered-marked';
            if (state.answered) return 'answered';
            if (state.markedForReview) return 'marked';
            return 'not-answered'; // visited but no answer
        },

        /**
         * Prepare data for result calculation
         * @returns {Object} Data needed by ResultEngine
         */
        getResultData: function () {
            return {
                config: { ..._config },
                questions: _questions.map(q => ({ ...q })),
                questionStates: _questionStates.map(s => ({ ...s })),
                elapsedSeconds: _config.durationSeconds - Timer.getRemaining()
            };
        },

        /**
         * Reset internal state (after test completes)
         */
        reset: function () {
            _config = null;
            _questions = [];
            _questionStates = [];
            _currentIndex = 0;
            _totalQuestions = 0;
        }
    };
})();