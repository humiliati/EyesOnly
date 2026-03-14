/**
 * puzzle-popup.js — Reusable Puzzle Popup System
 *
 * Opens a full-viewport overlay popup for interactive puzzles.
 * Each puzzle registers via PuzzlePopup.register(puzzleKey, config).
 * Clicking a .games-item[data-puzzle] element triggers the popup.
 *
 * When a puzzle is solved, the onSolve callback fires, which typically
 * grants an item to AccountInventory and populates the decryption grid.
 *
 * Themed via CRT bridge vars (--phosphor, --phosphor-dim, etc.)
 */
var PuzzlePopup = (function () {
  'use strict';

  var _registry = {};
  var _overlayEl = null;
  var _isOpen = false;
  var _currentPuzzle = null;

  /**
   * Register a puzzle for popup display.
   *
   * @param {string} puzzleKey  - Unique puzzle identifier (matches data-puzzle attr)
   * @param {Object} config
   * @param {string} config.title       - Popup header text
   * @param {Function} config.render    - fn(containerEl) — builds puzzle DOM inside the container
   * @param {Function} [config.cleanup] - fn() — called when popup closes
   * @param {Function} [config.onSolve] - fn() — called when puzzle is solved
   */
  function register(puzzleKey, config) {
    _registry[puzzleKey] = config;
  }

  function _buildOverlay() {
    if (_overlayEl) return _overlayEl;

    var overlay = document.createElement('div');
    overlay.className = 'puzzle-popup-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Puzzle');
    overlay.innerHTML = [
      '<div class="puzzle-popup-backdrop"></div>',
      '<div class="puzzle-popup-container">',
      '  <div class="puzzle-popup-header">',
      '    <span class="puzzle-popup-title"></span>',
      '    <button class="puzzle-popup-close" aria-label="Close" title="Close">',
      '      <span class="puzzle-popup-close-icon">&times;</span>',
      '    </button>',
      '  </div>',
      '  <div class="puzzle-popup-body"></div>',
      '</div>'
    ].join('\n');

    var closeBtn = overlay.querySelector('.puzzle-popup-close');
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      close();
    });

    var backdrop = overlay.querySelector('.puzzle-popup-backdrop');
    backdrop.addEventListener('click', function () {
      close();
    });

    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    document.body.appendChild(overlay);
    _overlayEl = overlay;
    return overlay;
  }

  function open(puzzleKey) {
    var config = _registry[puzzleKey];
    if (!config || _isOpen) return;

    _isOpen = true;
    _currentPuzzle = puzzleKey;

    var overlay = _buildOverlay();
    var titleEl = overlay.querySelector('.puzzle-popup-title');
    var body = overlay.querySelector('.puzzle-popup-body');

    titleEl.textContent = config.title || puzzleKey.toUpperCase();
    body.innerHTML = '';

    // Let the puzzle render its interactive content
    if (config.render) {
      config.render(body);
    }

    overlay.style.display = 'flex';
    void overlay.offsetHeight; // force reflow
    overlay.classList.add('puzzle-popup-visible');

    // SFX
    if (window.AudioSystem && AudioSystem.playSFX) {
      AudioSystem.playSFX('ui-04');
    }

    // Focus first interactive element inside puzzle after opening
    setTimeout(function () {
      var firstInput = body.querySelector('input, button, textarea');
      if (firstInput) firstInput.focus();
    }, 300);
  }

  function close() {
    if (!_isOpen || !_overlayEl) return;

    var config = _registry[_currentPuzzle];

    _overlayEl.classList.remove('puzzle-popup-visible');
    _overlayEl.classList.add('puzzle-popup-closing');

    if (window.AudioSystem && AudioSystem.playSFX) {
      AudioSystem.playSFX('ui-01');
    }

    setTimeout(function () {
      if (_overlayEl) {
        _overlayEl.style.display = 'none';
        _overlayEl.classList.remove('puzzle-popup-closing');
        var body = _overlayEl.querySelector('.puzzle-popup-body');
        if (body) body.innerHTML = '';
      }
      if (config && config.cleanup) {
        try { config.cleanup(); } catch (_) {}
      }
      _isOpen = false;
      _currentPuzzle = null;
    }, 200);
  }

  /**
   * Notify that the current puzzle has been solved.
   * Fires the onSolve callback from the config.
   */
  function solved() {
    if (!_currentPuzzle) return;
    var config = _registry[_currentPuzzle];
    if (config && config.onSolve) {
      try { config.onSolve(); } catch (_) {}
    }
  }

  /**
   * Bind click handlers on a container for .games-item[data-puzzle] elements.
   */
  function bind(containerEl) {
    if (!containerEl) return;
    containerEl.addEventListener('click', function (e) {
      var item = e.target.closest('.games-item[data-puzzle]');
      if (!item) return;
      var puzzleKey = item.getAttribute('data-puzzle');
      if (_registry[puzzleKey]) {
        open(puzzleKey);
      }
    });
  }

  return {
    register: register,
    open: open,
    close: close,
    solved: solved,
    bind: bind,
    isOpen: function () { return _isOpen; }
  };

})();
