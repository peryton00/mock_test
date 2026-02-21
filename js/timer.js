/**
 * ============================================
 * Timer Module
 * Real-time countdown timer with localStorage persistence.
 * Auto-submits when time reaches zero.
 * Resumes correctly on page refresh.
 * ============================================
 */

const Timer = (function () {
    'use strict';

    let _intervalId = null;
    let _remainingSeconds = 0;
    let _onTick = null;       // Callback: called every second with formatted time
    let _onTimeUp = null;     // Callback: called when time reaches 0
    let _isRunning = false;
    let _saveInterval = 0;    // Counter to throttle localStorage writes
    const SAVE_EVERY_N_TICKS = 5; // Save to localStorage every 5 seconds

    // --- Private Helpers ---

    /**
     * Format seconds into HH:MM:SS string
     * @param {number} totalSeconds
     * @returns {string}
     */
    function _formatTime(totalSeconds) {
        if (totalSeconds < 0) totalSeconds = 0;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [
            String(hours).padStart(2, '0'),
            String(minutes).padStart(2, '0'),
            String(seconds).padStart(2, '0')
        ].join(':');
    }

    /**
     * Internal tick handler — called every second
     */
    function _tick() {
        _remainingSeconds--;
        _saveInterval++;

        // Save to localStorage periodically (not every second for performance)
        if (_saveInterval >= SAVE_EVERY_N_TICKS) {
            _saveInterval = 0;
            StorageManager.saveRemainingTime(_remainingSeconds);
        }

        // Fire tick callback
        if (typeof _onTick === 'function') {
            _onTick({
                remaining: _remainingSeconds,
                formatted: _formatTime(_remainingSeconds),
                isWarning: _remainingSeconds <= 300 // Warning under 5 min
            });
        }

        // Time's up
        if (_remainingSeconds <= 0) {
            Timer.stop();
            StorageManager.saveRemainingTime(0);
            if (typeof _onTimeUp === 'function') {
                _onTimeUp();
            }
        }
    }

    // --- Public API ---

    return {
        /**
         * Initialize the timer with a duration
         * @param {Object} config
         * @param {number} config.durationSeconds - Total duration in seconds
         * @param {number} [config.remainingSeconds] - Resume from this value if provided
         * @param {Function} config.onTick - Called every second with time info
         * @param {Function} config.onTimeUp - Called when time reaches 0
         */
        init: function (config) {
            this.stop(); // Clear any existing timer

            _remainingSeconds = config.remainingSeconds != null
                ? config.remainingSeconds
                : config.durationSeconds;

            _onTick = config.onTick || null;
            _onTimeUp = config.onTimeUp || null;
            _saveInterval = 0;
            _isRunning = false;

            // Fire initial tick to show the starting time
            if (typeof _onTick === 'function') {
                _onTick({
                    remaining: _remainingSeconds,
                    formatted: _formatTime(_remainingSeconds),
                    isWarning: _remainingSeconds <= 300
                });
            }
        },

        /**
         * Start the countdown
         */
        start: function () {
            if (_isRunning) return;
            _isRunning = true;
            _intervalId = setInterval(_tick, 1000);
        },

        /**
         * Pause the timer (keeps remaining time)
         */
        pause: function () {
            if (_intervalId) {
                clearInterval(_intervalId);
                _intervalId = null;
            }
            _isRunning = false;
            // Save current state
            StorageManager.saveRemainingTime(_remainingSeconds);
        },

        /**
         * Stop and reset the timer
         */
        stop: function () {
            if (_intervalId) {
                clearInterval(_intervalId);
                _intervalId = null;
            }
            _isRunning = false;
            _remainingSeconds = 0;
            _saveInterval = 0;
        },

        /**
         * Get current remaining time in seconds
         * @returns {number}
         */
        getRemaining: function () {
            return _remainingSeconds;
        },

        /**
         * Get formatted remaining time
         * @returns {string}
         */
        getFormattedRemaining: function () {
            return _formatTime(_remainingSeconds);
        },

        /**
         * Check if timer is currently running
         * @returns {boolean}
         */
        isRunning: function () {
            return _isRunning;
        },

        /**
         * Get elapsed time in seconds (needs total duration)
         * @param {number} totalDurationSeconds
         * @returns {number}
         */
        getElapsed: function (totalDurationSeconds) {
            return Math.max(0, totalDurationSeconds - _remainingSeconds);
        },

        /**
         * Format any seconds value to HH:MM:SS
         * @param {number} seconds
         * @returns {string}
         */
        formatTime: function (seconds) {
            return _formatTime(seconds);
        }
    };
})();