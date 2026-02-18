/* ============================================================
   EYES ONLY - Terminal Rendering Engine
   Adapted from langterm (github.com/statico/langterm)
   Handles character buffer, cursor, output rendering to DOM.
   ============================================================ */

const Terminal = (function () {
  'use strict';

  const COLS = 72;
  const ROWS = 24;
  const HISTORY_MAX = 100;
  const TYPE_SPEED_FAST = 12;    // ms per char for fast typing
  const TYPE_SPEED_NORMAL = 28;  // ms per char for normal typing
  const TYPE_SPEED_SLOW = 55;    // ms per char for dramatic typing
  const LINE_DELAY = 150;        // ms between lines in sequences

  // Mobile keyboard detection constants
  const KEYBOARD_HEIGHT_THRESHOLD = 150; // pixels - minimum height difference to detect keyboard
  const KEYBOARD_ANIMATION_DELAY = 300;  // ms - wait for keyboard animation before checking state
  const KEYBOARD_DISMISS_DELAY = 100;    // ms - wait for keyboard dismiss animation

  // DOM references
  let _terminalEl = null;
  let _inputLineEl = null;
  let _inputPromptEl = null;
  let _inputBufferEl = null;
  let _inputCursorEl = null;
  let _mobileInputEl = null;

  // State
  let _inputBuffer = '';
  let _commandHistory = [];
  let _historyIndex = -1;
  let _inputEnabled = false;
  let _onCommandCallback = null;
  let _scrollLocked = true;
  let _isMobile = false;
  let _mobileKeyboardSuppressed = false;
  let _keyboardVisible = false;
  let _originalViewportHeight = null;

  /**
   * Initialize the terminal, bind to DOM elements.
   */
  function init() {
    _terminalEl = document.getElementById('terminal');
    _inputLineEl = document.getElementById('input-line');
    _inputPromptEl = document.getElementById('input-prompt');
    _inputBufferEl = document.getElementById('input-buffer');
    _inputCursorEl = document.getElementById('input-cursor');
    _mobileInputEl = document.getElementById('mobile-input');

    // Detect mobile/touch devices
    _isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Load command history from localStorage
    try {
      const saved = localStorage.getItem('eyesonly_history');
      if (saved) _commandHistory = JSON.parse(saved);
    } catch (e) { /* ignore */ }

    // Global key handler (langterm-style: no visible input element)
    document.addEventListener('keydown', _handleKeydown);

    // Mobile: sync hidden input to terminal buffer
    if (_mobileInputEl) {
      _mobileInputEl.addEventListener('input', function () {
        if (!_inputEnabled) return;
        _inputBuffer = _mobileInputEl.value;
        _updateInputDisplay();
      });

      // Handle Enter on mobile keyboard
      _mobileInputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!_inputEnabled) return;
          var cmd = _inputBuffer.trim();
          _inputBuffer = '';
          _mobileInputEl.value = '';
          _updateInputDisplay();

          if (cmd.length > 0) {
            _commandHistory.unshift(cmd);
            if (_commandHistory.length > HISTORY_MAX) _commandHistory.pop();
            _historyIndex = -1;
            try {
              localStorage.setItem('eyesonly_history', JSON.stringify(_commandHistory));
            } catch (e) { /* ignore */ }
          }

          _writeLine(_getPromptText() + cmd);
          if (_onCommandCallback) _onCommandCallback(cmd);
        }
      });
    }

    // Focus hidden input on tap/click for mobile keyboard
    document.addEventListener('click', function (e) {
      if (_inputEnabled && !_mobileKeyboardSuppressed) {
        // Don't focus keyboard if tapping on Gone Rogue grid or cards
        if (_isEventInRogueUI(e)) return;
        _focusMobileInput();
      }
    });
    document.addEventListener('touchstart', function (e) {
      if (_inputEnabled && !_mobileKeyboardSuppressed) {
        // Don't focus keyboard if tapping on Gone Rogue grid or cards
        if (_isEventInRogueUI(e)) return;
        _focusMobileInput();
      }
    });

    // Setup mobile keyboard visibility detection
    if (_isMobile) {
      _setupKeyboardDetection();
    }

    _hideInput();
  }

  /**
   * Check if event target is within Gone Rogue UI
   */
  function _isEventInRogueUI(e) {
    var target = e.target;
    if (!target) return false;
    
    // Check if target or any parent is the rogue grid or cards container
    while (target) {
      if (target.id === 'rogue-grid-mobile' || 
          target.id === 'rogue-cards-mobile') {
        return true;
      }
      if (target.classList && (target.classList.contains('rogue-grid-mobile') || 
                               target.classList.contains('rogue-cards-mobile'))) {
        return true;
      }
      target = target.parentElement;
    }
    return false;
  }

  /**
   * Setup mobile keyboard visibility detection
   */
  function _setupKeyboardDetection() {
    // Store initial viewport height
    _originalViewportHeight = window.innerHeight;

    // Use visualViewport API if available (modern browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', _handleViewportResize);
      window.visualViewport.addEventListener('scroll', _handleViewportScroll);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', _handleWindowResize);
    }

    // Also listen to focus/blur on mobile input
    if (_mobileInputEl) {
      _mobileInputEl.addEventListener('focus', _handleInputFocus);
      _mobileInputEl.addEventListener('blur', _handleInputBlur);
    }
  }

  /**
   * Handle visualViewport resize (keyboard show/hide)
   */
  function _handleViewportResize() {
    if (!window.visualViewport) return;

    var viewportHeight = window.visualViewport.height;
    var windowHeight = window.innerHeight;

    // Keyboard is visible if viewport height is significantly less than window height
    var isKeyboardVisible = (windowHeight - viewportHeight) > KEYBOARD_HEIGHT_THRESHOLD;

    _updateKeyboardState(isKeyboardVisible);
  }

  /**
   * Handle visualViewport scroll (when keyboard pushes content up)
   */
  function _handleViewportScroll() {
    // Ensure input stays visible when keyboard scrolls viewport
    if (_keyboardVisible && _inputLineEl && _inputLineEl.style.display !== 'none') {
      _scrollTerminalInputIntoView();
    }
  }

  /**
   * Handle window resize (fallback for older browsers)
   */
  function _handleWindowResize() {
    if (!_originalViewportHeight) {
      _originalViewportHeight = window.innerHeight;
      return;
    }

    var currentHeight = window.innerHeight;
    var heightDifference = _originalViewportHeight - currentHeight;

    // Keyboard is likely visible if height decreased significantly
    var isKeyboardVisible = heightDifference > KEYBOARD_HEIGHT_THRESHOLD;

    _updateKeyboardState(isKeyboardVisible);

    // Update original height when keyboard closes
    if (!isKeyboardVisible) {
      _originalViewportHeight = currentHeight;
    }
  }

  /**
   * Handle mobile input focus
   */
  function _handleInputFocus() {
    // Delay to allow keyboard animation to complete before checking state
    setTimeout(function() {
      if (document.activeElement === _mobileInputEl) {
        _updateKeyboardState(true);
        _scrollTerminalInputIntoView();
      }
    }, KEYBOARD_ANIMATION_DELAY);
  }

  /**
   * Handle mobile input blur
   */
  function _handleInputBlur() {
    // Brief delay to handle quick focus changes without flicker
    setTimeout(function() {
      if (document.activeElement !== _mobileInputEl) {
        _updateKeyboardState(false);
      }
    }, KEYBOARD_DISMISS_DELAY);
  }

  /**
   * Update keyboard visibility state
   */
  function _updateKeyboardState(isVisible) {
    if (_keyboardVisible === isVisible) return;
    
    _keyboardVisible = isVisible;

    // Don't apply keyboard styles in Gone Rogue mode (it has its own input handling)
    var isInGoneRogue = document.body.classList.contains('mode-gone-rogue') || 
                        document.body.classList.contains('in-gone-rogue');
    
    if (isInGoneRogue) return;

    // Toggle body class for CSS styling
    if (isVisible) {
      document.body.classList.add('keyboard-visible');
    } else {
      document.body.classList.remove('keyboard-visible');
    }
  }

  /**
   * Scroll terminal input into view
   */
  function _scrollTerminalInputIntoView() {
    if (!_inputLineEl || _inputLineEl.style.display === 'none') return;

    // Scroll the input line into view
    _inputLineEl.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'end',
      inline: 'nearest'
    });

    // Also ensure the log frame is scrolled to bottom
    var logFrame = document.querySelector('.log-frame');
    if (logFrame) {
      logFrame.scrollTop = logFrame.scrollHeight;
    }
  }

  /**
   * Focus the hidden mobile input to trigger keyboard.
   */
  function _focusMobileInput() {
    if (_mobileInputEl && _isMobile && !_mobileKeyboardSuppressed) {
      _mobileInputEl.value = _inputBuffer;
      _mobileInputEl.focus();
    }
  }

  /**
   * Suppress mobile keyboard from appearing on taps.
   * Called when interactive grid UI takes over input.
   */
  function _suppressMobileKeyboard() {
    _mobileKeyboardSuppressed = true;
    // Blur the mobile input to hide keyboard
    if (_mobileInputEl) {
      _mobileInputEl.blur();
    }
  }

  /**
   * Restore mobile keyboard behavior.
   * Called when returning to text input mode.
   */
  function _restoreMobileKeyboard() {
    _mobileKeyboardSuppressed = false;
  }

  /**
   * Handle keyboard input - adapted from langterm fancy.js handleKeydown
   */
  function _handleKeydown(e) {
    if (!_inputEnabled) return;

    const key = e.key;

    if (key === 'Enter') {
      e.preventDefault();
      const cmd = _inputBuffer.trim();
      _inputBuffer = '';
      if (_mobileInputEl) _mobileInputEl.value = '';
      _updateInputDisplay();

      // Add to history
      if (cmd.length > 0) {
        _commandHistory.unshift(cmd);
        if (_commandHistory.length > HISTORY_MAX) _commandHistory.pop();
        _historyIndex = -1;
        try {
          localStorage.setItem('eyesonly_history', JSON.stringify(_commandHistory));
        } catch (e) { /* ignore */ }
      }

      // Echo command
      _writeLine(_getPromptText() + cmd);

      // Fire callback
      if (_onCommandCallback) {
        _onCommandCallback(cmd);
      }
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      if (_inputBuffer.length > 0) {
        _inputBuffer = _inputBuffer.slice(0, -1);
        _updateInputDisplay();
      }
      return;
    }

    // History navigation (langterm pattern)
    if (key === 'ArrowUp') {
      e.preventDefault();
      if (_commandHistory.length > 0 && _historyIndex < _commandHistory.length - 1) {
        _historyIndex++;
        _inputBuffer = _commandHistory[_historyIndex];
        _updateInputDisplay();
      }
      return;
    }

    if (key === 'ArrowDown') {
      e.preventDefault();
      if (_historyIndex > 0) {
        _historyIndex--;
        _inputBuffer = _commandHistory[_historyIndex];
      } else {
        _historyIndex = -1;
        _inputBuffer = '';
      }
      _updateInputDisplay();
      return;
    }

    // Ctrl+L: clear screen (langterm pattern)
    if (e.ctrlKey && key === 'l') {
      e.preventDefault();
      clear();
      return;
    }

    // Ctrl+U: clear input line (langterm pattern)
    if (e.ctrlKey && key === 'u') {
      e.preventDefault();
      _inputBuffer = '';
      _updateInputDisplay();
      return;
    }

    // Printable characters (langterm: e.key.length === 1)
    if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      _inputBuffer += key;
      _updateInputDisplay();
    }
  }

  /**
   * Update the visual input buffer display.
   */
  function _updateInputDisplay() {
    if (_inputBufferEl) {
      _inputBufferEl.textContent = _inputBuffer;
    }
  }

  /**
   * Get the current prompt string.
   */
  function _getPromptText() {
    return _inputPromptEl ? _inputPromptEl.textContent : '> ';
  }

  /**
   * Write a single line to the terminal (instant).
   */
  function _writeLine(text, cssClass) {
    const div = document.createElement('div');
    div.className = 'line instant' + (cssClass ? ' ' + cssClass : '');
    div.textContent = text;
    _terminalEl.insertBefore(div, _inputLineEl);
    _scrollToBottom();
  }

  /**
   * Write a line as a DOM element (for complex formatting).
   */
  function _writeElement(el) {
    el.classList.add('line', 'instant');
    _terminalEl.insertBefore(el, _inputLineEl);
    _scrollToBottom();
  }

  /**
   * Scroll terminal to bottom.
   */
  function _scrollToBottom() {
    if (_scrollLocked) {
      _terminalEl.scrollTop = _terminalEl.scrollHeight;
    }
  }

  /**
   * Show the input line with optional prompt.
   */
  function _showInput(prompt) {
    if (_inputPromptEl) _inputPromptEl.textContent = prompt || '> ';
    if (_inputLineEl) _inputLineEl.style.display = 'flex';
    if (_inputCursorEl) _inputCursorEl.style.display = 'inline-block';
    _inputBuffer = '';
    _updateInputDisplay();
    _inputEnabled = true;
    _scrollToBottom();
    // Focus mobile input for keyboard
    if (_mobileInputEl) {
      _mobileInputEl.value = '';
      if (_isMobile) _mobileInputEl.focus();
    }
  }

  /**
   * Hide the input line.
   */
  function _hideInput() {
    _inputEnabled = false;
    if (_inputLineEl) _inputLineEl.style.display = 'none';
    if (_inputCursorEl) _inputCursorEl.style.display = 'none';
    if (_mobileInputEl) _mobileInputEl.blur();
  }

  /**
   * Typewriter effect - types text character by character.
   * Returns a Promise that resolves when done.
   */
  function _typeText(text, speed, cssClass) {
    speed = speed || TYPE_SPEED_NORMAL;
    return new Promise(function (resolve) {
      const div = document.createElement('div');
      div.className = 'line' + (cssClass ? ' ' + cssClass : '');
      div.style.opacity = '1';
      div.textContent = '';
      _terminalEl.insertBefore(div, _inputLineEl);

      let i = 0;
      function tick() {
        if (i < text.length) {
          div.textContent += text[i];
          i++;
          _scrollToBottom();
          setTimeout(tick, speed);
        } else {
          resolve();
        }
      }
      tick();
    });
  }

  /**
   * Type multiple lines in sequence with delays.
   */
  function _typeLines(lines, speed, lineDelay, cssClass) {
    speed = speed || TYPE_SPEED_NORMAL;
    lineDelay = lineDelay || LINE_DELAY;

    return lines.reduce(function (chain, line) {
      return chain.then(function () {
        if (line === '') {
          _writeLine('');
          return new Promise(function (r) { setTimeout(r, lineDelay); });
        }
        return _typeText(line, speed, cssClass).then(function () {
          return new Promise(function (r) { setTimeout(r, lineDelay); });
        });
      });
    }, Promise.resolve());
  }

  /**
   * Display a progress bar animation.
   */
  function _progressBar(label, duration) {
    duration = duration || 1500;
    var barWidth = 30;

    return new Promise(function (resolve) {
      var div = document.createElement('div');
      div.className = 'line instant progress-bar';
      _terminalEl.insertBefore(div, _inputLineEl);

      var step = 0;
      var interval = duration / barWidth;

      function tick() {
        if (step <= barWidth) {
          var filled = '';
          var empty = '';
          for (var i = 0; i < step; i++) filled += '\u2588';
          for (var j = step; j < barWidth; j++) empty += '\u2591';
          var pct = Math.floor((step / barWidth) * 100);
          div.textContent = label + ' [' + filled + empty + '] ' + pct + '%';
          step++;
          _scrollToBottom();
          setTimeout(tick, interval);
        } else {
          resolve();
        }
      }
      tick();
    });
  }

  /**
   * Trigger screen flicker effect.
   */
  function _flicker() {
    var screen = document.getElementById('crt-screen');
    if (screen) {
      screen.classList.add('screen-flicker');
      setTimeout(function () {
        screen.classList.remove('screen-flicker');
      }, 300);
    }
  }

  /**
   * Clear all terminal output.
   */
  function clear() {
    var lines = _terminalEl.querySelectorAll('.line');
    lines.forEach(function (el) {
      el.remove();
    });
  }

  // Public API
  return {
    init: init,
    writeLine: _writeLine,
    writeElement: _writeElement,
    typeText: _typeText,
    typeLines: _typeLines,
    progressBar: _progressBar,
    showInput: _showInput,
    hideInput: _hideInput,
    clear: clear,
    flicker: _flicker,
    scrollToBottom: _scrollToBottom,
    onCommand: function (cb) { _onCommandCallback = cb; },
    suppressMobileKeyboard: _suppressMobileKeyboard,
    restoreMobileKeyboard: _restoreMobileKeyboard,

    // Constants exposed for external use
    TYPE_SPEED_FAST: TYPE_SPEED_FAST,
    TYPE_SPEED_NORMAL: TYPE_SPEED_NORMAL,
    TYPE_SPEED_SLOW: TYPE_SPEED_SLOW,
    LINE_DELAY: LINE_DELAY
  };
})();
