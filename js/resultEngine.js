/**
 * ============================================
 * ResultEngine Module
 * Calculates scores, generates analytics,
 * topic-wise breakdown, and review data.
 * ============================================
 */

const ResultEngine = (function () {
    'use strict';

    let _lastResult = null; // Cache the last computed result

    // --- Public API ---

    return {
        /**
         * Calculate the full result from test data
         * @param {Object} data - From TestEngine.getResultData()
         * @param {Object} data.config - Test configuration
         * @param {Array} data.questions - Question objects
         * @param {Array} data.questionStates - State of each question
         * @param {number} data.elapsedSeconds - Time taken in seconds
         * @returns {Object} Complete result object
         */
        calculate: function (data) {
            const { config, questions, questionStates, elapsedSeconds } = data;

            const marksPerQuestion = config.marksPerQuestion;
            const negativeMarkingRatio = config.negativeMarkingRatio;
            const negativeMark = marksPerQuestion * negativeMarkingRatio;

            let correct = 0;
            let incorrect = 0;
            let unattempted = 0;
            let totalScore = 0;
            const topicMap = {};
            const questionResults = [];

            questions.forEach((q, idx) => {
                const state = questionStates[idx];
                const result = {
                    questionId: q.id,
                    question: q.question,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    selectedOption: state.selectedOption,
                    explanation: q.explanation,
                    topic: q.topic || q.subject || 'General',
                    subject: q.subject || 'general',
                    difficulty: q.difficulty || 'medium',
                    status: 'unattempted', // default
                    marksAwarded: 0
                };

                if (state.answered && state.selectedOption) {
                    if (state.selectedOption === q.correctAnswer) {
                        // Correct
                        result.status = 'correct';
                        result.marksAwarded = marksPerQuestion;
                        correct++;
                        totalScore += marksPerQuestion;
                    } else {
                        // Incorrect
                        result.status = 'incorrect';
                        result.marksAwarded = -negativeMark;
                        incorrect++;
                        totalScore -= negativeMark;
                    }
                } else {
                    // Unattempted
                    result.status = 'unattempted';
                    result.marksAwarded = 0;
                    unattempted++;
                }

                questionResults.push(result);

                // Topic-wise aggregation
                const topic = result.topic;
                if (!topicMap[topic]) {
                    topicMap[topic] = {
                        topic: topic,
                        total: 0,
                        attempted: 0,
                        correct: 0,
                        incorrect: 0,
                        unattempted: 0,
                        score: 0,
                        maxScore: 0
                    };
                }
                topicMap[topic].total++;
                topicMap[topic].maxScore += marksPerQuestion;
                if (result.status === 'correct') {
                    topicMap[topic].attempted++;
                    topicMap[topic].correct++;
                    topicMap[topic].score += marksPerQuestion;
                } else if (result.status === 'incorrect') {
                    topicMap[topic].attempted++;
                    topicMap[topic].incorrect++;
                    topicMap[topic].score -= negativeMark;
                } else {
                    topicMap[topic].unattempted++;
                }
            });

            // Build topic-wise breakdown array sorted by topic name
            const topicBreakdown = Object.values(topicMap).map(t => ({
                ...t,
                accuracy: t.attempted > 0 ? Math.round((t.correct / t.attempted) * 100) : 0
            })).sort((a, b) => a.topic.localeCompare(b.topic));

            const attempted = correct + incorrect;
            const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

            // Round total score to 2 decimal places
            totalScore = Math.round(totalScore * 100) / 100;

            const result = {
                // Test Info
                testId: config.testId,
                testName: config.testName,
                paperName: config.paperName,
                paperCode: config.paperCode,
                candidateName: config.candidateName,

                // Scoring
                totalQuestions: questions.length,
                attempted: attempted,
                correct: correct,
                incorrect: incorrect,
                unattempted: unattempted,
                totalScore: totalScore,
                maxMarks: config.maxMarks,
                marksPerQuestion: marksPerQuestion,
                negativeMark: negativeMark,
                accuracy: accuracy,

                // Time
                durationSeconds: config.durationSeconds,
                elapsedSeconds: elapsedSeconds,
                timeTakenFormatted: Timer.formatTime(elapsedSeconds),

                // Breakdowns
                topicBreakdown: topicBreakdown,
                questionResults: questionResults,

                // Metadata
                completedAt: new Date().toISOString()
            };

            _lastResult = result;
            return result;
        },

        /**
         * Get the last calculated result
         * @returns {Object|null}
         */
        getLastResult: function () {
            return _lastResult;
        },

        /**
         * Set a result (e.g., when loading from history)
         * @param {Object} result
         */
        setResult: function (result) {
            _lastResult = result;
        },

        /**
         * Get filtered question results
         * @param {string} filter - 'all', 'correct', 'incorrect', 'unattempted'
         * @returns {Array}
         */
        getFilteredResults: function (filter) {
            if (!_lastResult) return [];
            if (filter === 'all') return _lastResult.questionResults;
            return _lastResult.questionResults.filter(q => q.status === filter);
        },

        /**
         * Get a percentage for the score circle
         * @returns {number} 0-100
         */
        getScorePercentage: function () {
            if (!_lastResult || _lastResult.maxMarks === 0) return 0;
            // Handle negative scores
            const percentage = (Math.max(0, _lastResult.totalScore) / _lastResult.maxMarks) * 100;
            return Math.min(100, Math.round(percentage));
        },

        /**
         * Clear cached result
         */
        reset: function () {
            _lastResult = null;
        }
    };
})();