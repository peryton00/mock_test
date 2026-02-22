/**
 * ============================================
 * ExamGuard Module
 * Browser-based exam lockdown system that
 * mimics real CBT environments by preventing
 * interruptions and detecting violations.
 * ============================================
 */

const ExamGuard = (function () {

    // --- State ---
    let _active = false;
    let _violationCount = 0;
    let _maxViolations = 5;
    let _onViolation = null;    // callback(violationCount, reason)
    let _onAutoSubmit = null;   // callback()
    let _fullscreenWarningShown = false;
    let _violationCooldown = false; // prevents rapid duplicate violations

    // Store bound handlers for cleanup
    const _handlers = {};

    // =============================================
    // FULLSCREEN MANAGEMENT
    // =============================================

    function requestFullscreen() {
        const el = document.documentElement;
        const rfs = el.requestFullscreen ||
                    el.webkitRequestFullscreen ||
                    el.msRequestFullscreen ||
                    el.mozRequestFullScreen;
        if (rfs) {
            rfs.call(el).catch(function () {
                // User denied or browser blocked — count as info, not violation
                console.warn('[ExamGuard] Fullscreen request denied.');
            });
        }
    }

    function exitFullscreen() {
        const efs = document.exitFullscreen ||
                    document.webkitExitFullscreen ||
                    document.msExitFullscreen ||
                    document.mozCancelFullScreen;
        if (efs && isFullscreen()) {
            efs.call(document).catch(function () {});
        }
    }

    function isFullscreen() {
        return !!(document.fullscreenElement ||
                  document.webkitFullscreenElement ||
                  document.msFullscreenElement ||
                  document.mozFullScreenElement);
    }

    function onFullscreenChange() {
        if (!_active) return;

        if (!isFullscreen()) {
            // User exited fullscreen — this is a violation
            recordViolation('Exited fullscreen mode');

            // After a short delay, try to re-enter fullscreen
            setTimeout(function () {
                if (_active && !isFullscreen()) {
                    requestFullscreen();
                }
            }, 1000);
        }
    }

    // =============================================
    // VISIBILITY / TAB-SWITCH DETECTION
    // =============================================

    function onVisibilityChange() {
        if (!_active) return;

        if (document.hidden || document.visibilityState === 'hidden') {
            recordViolation('Switched away from exam tab');
        }
    }

    function onWindowBlur() {
        if (!_active) return;

        // Small delay to avoid false positives (e.g., clicking browser chrome)
        setTimeout(function () {
            if (_active && !document.hasFocus()) {
                recordViolation('Window lost focus (possible app switch)');
            }
        }, 300);
    }

    // =============================================
    // KEYBOARD SHORTCUT BLOCKING
    // =============================================

    function onKeyDown(e) {
        if (!_active) return;

        const key = e.key || e.keyCode;
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;

        // F12 — DevTools
        if (key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            e.stopPropagation();
            recordViolation('Attempted to open Developer Tools (F12)');
            return false;
        }

        // Ctrl+Shift+I — DevTools Inspector
        if (ctrl && shift && (key === 'I' || key === 'i' || e.keyCode === 73)) {
            e.preventDefault();
            e.stopPropagation();
            recordViolation('Attempted to open Developer Tools (Ctrl+Shift+I)');
            return false;
        }

        // Ctrl+Shift+J — DevTools Console
        if (ctrl && shift && (key === 'J' || key === 'j' || e.keyCode === 74)) {
            e.preventDefault();
            e.stopPropagation();
            recordViolation('Attempted to open Developer Console (Ctrl+Shift+J)');
            return false;
        }

        // Ctrl+Shift+C — DevTools Element picker
        if (ctrl && shift && (key === 'C' || key === 'c' || e.keyCode === 67)) {
            e.preventDefault();
            e.stopPropagation();
            recordViolation('Attempted to open Element Inspector (Ctrl+Shift+C)');
            return false;
        }

        // Ctrl+U — View source
        if (ctrl && (key === 'U' || key === 'u' || e.keyCode === 85)) {
            e.preventDefault();
            e.stopPropagation();
            recordViolation('Attempted to view page source (Ctrl+U)');
            return false;
        }

        // Ctrl+P — Print
        if (ctrl && (key === 'P' || key === 'p' || e.keyCode === 80)) {
            e.preventDefault();
            e.stopPropagation();
            recordViolation('Attempted to print (Ctrl+P)');
            return false;
        }

        // Ctrl+S — Save page
        if (ctrl && (key === 'S' || key === 's' || e.keyCode === 83)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl+A — Select all (block during exam)
        if (ctrl && (key === 'A' || key === 'a' || e.keyCode === 65)) {
            e.preventDefault();
            return false;
        }

        // Ctrl+C — Copy
        if (ctrl && !shift && (key === 'C' || key === 'c' || e.keyCode === 67)) {
            e.preventDefault();
            return false;
        }

        // Ctrl+V — Paste
        if (ctrl && (key === 'V' || key === 'v' || e.keyCode === 86)) {
            e.preventDefault();
            return false;
        }

        // Ctrl+X — Cut
        if (ctrl && (key === 'X' || key === 'x' || e.keyCode === 88)) {
            e.preventDefault();
            return false;
        }

        // Escape — prevent exiting fullscreen (we handle it in fullscreen change)
        // Note: Escape for fullscreen exit can't actually be blocked, but we detect it
    }

    // =============================================
    // CONTEXT MENU / CLIPBOARD / SELECTION
    // =============================================

    function onContextMenu(e) {
        if (!_active) return;
        e.preventDefault();
        recordViolation('Attempted to open context menu (right-click)');
        return false;
    }

    function onCopyPasteCut(e) {
        if (!_active) return;
        e.preventDefault();
        return false;
    }

    function onBeforeUnload(e) {
        if (!_active) return;
        e.preventDefault();
        e.returnValue = 'You have an active exam. Are you sure you want to leave?';
        return e.returnValue;
    }

    // =============================================
    // DEVTOOLS DETECTION (size-based heuristic)
    // =============================================

    let _devtoolsCheckInterval = null;

    function startDevtoolsDetection() {
        // Detect devtools via window size differential
        _devtoolsCheckInterval = setInterval(function () {
            if (!_active) return;

            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;

            if (widthThreshold || heightThreshold) {
                recordViolation('Developer Tools may be open');
            }
        }, 2000);
    }

    function stopDevtoolsDetection() {
        if (_devtoolsCheckInterval) {
            clearInterval(_devtoolsCheckInterval);
            _devtoolsCheckInterval = null;
        }
    }

    // =============================================
    // VIOLATION MANAGEMENT
    // =============================================

    function recordViolation(reason) {
        if (!_active) return;

        // Cooldown to prevent rapid-fire duplicate violations
        if (_violationCooldown) return;
        _violationCooldown = true;
        setTimeout(function () {
            _violationCooldown = false;
        }, 2000);

        _violationCount++;

        console.warn('[ExamGuard] Violation #' + _violationCount + ': ' + reason);

        // Notify via callback
        if (typeof _onViolation === 'function') {
            _onViolation(_violationCount, reason, _maxViolations);
        }

        // Auto-submit if max violations reached
        if (_violationCount >= _maxViolations) {
            console.error('[ExamGuard] Max violations reached. Auto-submitting.');
            if (typeof _onAutoSubmit === 'function') {
                // Small delay to let the warning show
                setTimeout(function () {
                    _onAutoSubmit();
                }, 1500);
            }
        }
    }

    // =============================================
    // PUBLIC API
    // =============================================

    return {

        /**
         * Activate the exam guard
         * @param {Object} options
         * @param {Function} options.onViolation - callback(count, reason, max)
         * @param {Function} options.onAutoSubmit - called when max violations reached
         * @param {number} [options.maxViolations=5] - violations before auto-submit
         */
        activate: function (options) {
            if (_active) return;

            options = options || {};
            _onViolation = options.onViolation || null;
            _onAutoSubmit = options.onAutoSubmit || null;
            _maxViolations = options.maxViolations || 5;
            _violationCount = 0;
            _violationCooldown = false;
            _active = true;

            // Add body class for CSS
            document.body.classList.add('exam-guard-active');

            // 1. Enter fullscreen
            requestFullscreen();

            // 2. Bind fullscreen change
            _handlers.fullscreenchange = onFullscreenChange;
            document.addEventListener('fullscreenchange', _handlers.fullscreenchange);
            document.addEventListener('webkitfullscreenchange', _handlers.fullscreenchange);
            document.addEventListener('mozfullscreenchange', _handlers.fullscreenchange);
            document.addEventListener('MSFullscreenChange', _handlers.fullscreenchange);

            // 3. Bind visibility change
            _handlers.visibilitychange = onVisibilityChange;
            document.addEventListener('visibilitychange', _handlers.visibilitychange);

            // 4. Bind window blur
            _handlers.blur = onWindowBlur;
            window.addEventListener('blur', _handlers.blur);

            // 5. Bind keyboard
            _handlers.keydown = onKeyDown;
            document.addEventListener('keydown', _handlers.keydown, true);

            // 6. Bind context menu
            _handlers.contextmenu = onContextMenu;
            document.addEventListener('contextmenu', _handlers.contextmenu);

            // 7. Bind clipboard
            _handlers.copy = onCopyPasteCut;
            _handlers.paste = onCopyPasteCut;
            _handlers.cut = onCopyPasteCut;
            document.addEventListener('copy', _handlers.copy);
            document.addEventListener('paste', _handlers.paste);
            document.addEventListener('cut', _handlers.cut);

            // 8. Bind beforeunload
            _handlers.beforeunload = onBeforeUnload;
            window.addEventListener('beforeunload', _handlers.beforeunload);

            // 9. DevTools detection
            startDevtoolsDetection();

            console.log('[ExamGuard] Activated — all security layers enabled.');
        },

        /**
         * Deactivate the exam guard — clean up all listeners
         */
        deactivate: function () {
            if (!_active) return;
            _active = false;

            // Remove body class
            document.body.classList.remove('exam-guard-active');

            // Exit fullscreen
            exitFullscreen();

            // Remove all listeners
            document.removeEventListener('fullscreenchange', _handlers.fullscreenchange);
            document.removeEventListener('webkitfullscreenchange', _handlers.fullscreenchange);
            document.removeEventListener('mozfullscreenchange', _handlers.fullscreenchange);
            document.removeEventListener('MSFullscreenChange', _handlers.fullscreenchange);

            document.removeEventListener('visibilitychange', _handlers.visibilitychange);
            window.removeEventListener('blur', _handlers.blur);
            document.removeEventListener('keydown', _handlers.keydown, true);
            document.removeEventListener('contextmenu', _handlers.contextmenu);

            document.removeEventListener('copy', _handlers.copy);
            document.removeEventListener('paste', _handlers.paste);
            document.removeEventListener('cut', _handlers.cut);

            window.removeEventListener('beforeunload', _handlers.beforeunload);

            // Stop devtools detection
            stopDevtoolsDetection();

            console.log('[ExamGuard] Deactivated — all security layers removed.');
        },

        /**
         * Get current violation count
         * @returns {number}
         */
        getViolationCount: function () {
            return _violationCount;
        },

        /**
         * Check if guard is currently active
         * @returns {boolean}
         */
        isActive: function () {
            return _active;
        },

        /**
         * Re-request fullscreen (for manual re-entry)
         */
        reEnterFullscreen: function () {
            if (_active) {
                requestFullscreen();
            }
        }
    };

})();
