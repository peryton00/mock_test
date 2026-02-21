/**
 * ============================================
 * StorageManager Module
 * Handles all localStorage persistence operations
 * for the UPSC Mock Test Platform.
 * ============================================
 */

const StorageManager = (function () {
    'use strict';

    // --- Storage Keys ---
    const KEYS = {
        ACTIVE_SESSION: 'upsc_active_session',
        ATTEMPT_HISTORY: 'upsc_attempt_history',
        DARK_MODE: 'upsc_dark_mode',
        CANDIDATE_NAME: 'upsc_candidate_name'
    };

    // --- Private Helpers ---

    /**
     * Safely parse JSON from localStorage
     * @param {string} key - The storage key
     * @param {*} defaultValue - Default value if key not found or parse fails
     * @returns {*} Parsed value or default
     */
    function _get(key, defaultValue) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return defaultValue;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[StorageManager] Error reading key:', key, e);
            return defaultValue;
        }
    }

    /**
     * Safely stringify and store data in localStorage
     * @param {string} key - The storage key
     * @param {*} value - The value to store
     */
    function _set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('[StorageManager] Error writing key:', key, e);
        }
    }

    /**
     * Remove a key from localStorage
     * @param {string} key - The storage key
     */
    function _remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('[StorageManager] Error removing key:', key, e);
        }
    }

    // --- Public API ---

    return {
        /**
         * Save the entire active test session
         * Includes: testConfig, questionStates, currentIndex, remainingTime, startTimestamp
         * @param {Object} sessionData - Complete session object
         */
        saveSession: function (sessionData) {
            _set(KEYS.ACTIVE_SESSION, sessionData);
        },

        /**
         * Load the active test session
         * @returns {Object|null} The session data or null
         */
        loadSession: function () {
            return _get(KEYS.ACTIVE_SESSION, null);
        },

        /**
         * Check if there is an active (in-progress) session
         * @returns {boolean}
         */
        hasActiveSession: function () {
            const session = this.loadSession();
            return session !== null && session.status === 'in_progress';
        },

        /**
         * Update a specific field in the active session
         * @param {string} field - The field name to update
         * @param {*} value - The new value
         */
        updateSessionField: function (field, value) {
            const session = this.loadSession();
            if (session) {
                session[field] = value;
                this.saveSession(session);
            }
        },

        /**
         * Clear the active session (after submission or discard)
         */
        clearSession: function () {
            _remove(KEYS.ACTIVE_SESSION);
        },

        /**
         * Save remaining time (called by timer on each tick)
         * @param {number} remainingSeconds - Seconds left
         */
        saveRemainingTime: function (remainingSeconds) {
            const session = this.loadSession();
            if (session) {
                session.remainingSeconds = remainingSeconds;
                session.lastSavedTimestamp = Date.now();
                this.saveSession(session);
            }
        },

        /**
         * Get the corrected remaining time accounting for elapsed time since last save
         * @returns {number} Corrected remaining seconds
         */
        getCorrectedRemainingTime: function () {
            const session = this.loadSession();
            if (!session || !session.lastSavedTimestamp) return 0;

            const elapsedSinceSave = Math.floor((Date.now() - session.lastSavedTimestamp) / 1000);
            const corrected = Math.max(0, (session.remainingSeconds || 0) - elapsedSinceSave);
            return corrected;
        },

        /**
         * Add a completed test result to the attempt history
         * @param {Object} result - The result object from ResultEngine
         */
        addToHistory: function (result) {
            const history = this.getHistory();
            // Add unique ID and timestamp
            result.historyId = 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            result.completedAt = new Date().toISOString();
            history.unshift(result); // Latest first
            // Keep a maximum of 50 attempts
            if (history.length > 50) history.pop();
            _set(KEYS.ATTEMPT_HISTORY, history);
        },

        /**
         * Get the full attempt history
         * @returns {Array} Array of result objects
         */
        getHistory: function () {
            return _get(KEYS.ATTEMPT_HISTORY, []);
        },

        /**
         * Get a specific history entry by its historyId
         * @param {string} historyId - The unique history identifier
         * @returns {Object|null}
         */
        getHistoryById: function (historyId) {
            const history = this.getHistory();
            return history.find(h => h.historyId === historyId) || null;
        },

        /**
         * Clear all attempt history
         */
        clearHistory: function () {
            _set(KEYS.ATTEMPT_HISTORY, []);
        },

        /**
         * Save dark mode preference
         * @param {boolean} isDark
         */
        saveDarkMode: function (isDark) {
            _set(KEYS.DARK_MODE, isDark);
        },

        /**
         * Load dark mode preference
         * @returns {boolean}
         */
        loadDarkMode: function () {
            return _get(KEYS.DARK_MODE, false);
        },

        /**
         * Save candidate name for future sessions
         * @param {string} name
         */
        saveCandidateName: function (name) {
            _set(KEYS.CANDIDATE_NAME, name);
        },

        /**
         * Load saved candidate name
         * @returns {string}
         */
        loadCandidateName: function () {
            return _get(KEYS.CANDIDATE_NAME, '');
        },

        /**
         * Get all storage keys used by this app (for debugging)
         * @returns {Object}
         */
        getDebugInfo: function () {
            return {
                hasSession: this.hasActiveSession(),
                historyCount: this.getHistory().length,
                darkMode: this.loadDarkMode(),
                candidateName: this.loadCandidateName()
            };
        }
    };
})();