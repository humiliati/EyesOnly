/* ============================================================
   NCH Overlay — Portable Capsule Widget (Phase 0)
   ============================================================
   Standalone draggable joker-stack capsule that works on ANY page.
   Two operational modes:

     PORTHOLE MODE (default):
       Joker stack acts as a theme/page-selector toy.
       Click → opens hand-fan-component with coin-cards.
       No GoneRogue dependency. Works on index.html, booking, etc.

     GAME MODE (when GoneRogue is active):
       Delegates rendering to NonCombatHUD for full deck management.
       Transitions seamlessly when the game launches/exits.

   Position persists per device via localStorage.
   Includes starfield init for pages that need the underlayment.
   ============================================================ */

var NchOverlay = (function () {
  'use strict';

  // ── State ────────────────────────────────────────────────
  var _capsule = null;         // .nch-overlay-wrapper (the draggable pill)
  var _stackEl = null;         // #nch-overlay-stack   (joker container)
  var _mode = 'porthole';      // 'porthole' | 'game' | 'transitioning'
  var _initialized = false;
  var _visible = true;
  var _jokerCount = 4;         // default porthole-mode card count (theme cards)

  // Drag
  var _capsuleDrag = null;     // { startX, startY, origLeft, origTop, moved }

  // Position persistence
  var POS_KEY = 'EYESONLY_NCH_OVERLAY_POS_V1';

  // Porthole card config — each entry maps to a theme/coin-card
  // This is the data the hand-fan-component will receive in porthole mode.
  var _portholeCards = [
    { id: 'theme-silver',   emoji: '🃏', theme: 'silver',   label: 'SILVER'   },
    { id: 'theme-amber',    emoji: '🃏', theme: 'amber',    label: 'AMBER'    },
    { id: 'theme-phosphor', emoji: '🃏', theme: 'phosphor', label: 'PHOSPHOR' },
    { id: 'theme-panther',  emoji: '🃏', theme: 'panther',  label: 'PANTHER'  },
  ];

  // Transition state
  var _transitionCleanupFn = null;

  // ── Position Persistence ─────────────────────────────────

  function _loadPos() {
    try {
      var raw = localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function _savePos(left, top) {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ left: left, top: top })); } catch (e) {}
  }

  function _clearPos() {
    try { localStorage.removeItem(POS_KEY); } catch (e) {}
  }

  function _applyPos() {
    if (!_capsule) return;
    var pos = _loadPos();
    if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
      _capsule.style.bottom = 'auto';
      _capsule.style.right  = 'auto';
      _capsule.style.left   = Math.max(0, Math.min(pos.left, window.innerWidth  - 40)) + 'px';
      _capsule.style.top    = Math.max(0, Math.min(pos.top,  window.innerHeight - 40)) + 'px';
    } else {
      // Default: bottom-right
      _capsule.style.left   = '';
      _capsule.style.top    = '';
      _capsule.style.bottom = '';
      _capsule.style.right  = '';
    }
  }

  // ── Capsule Creation ─────────────────────────────────────

  function _createCapsule() {
    _capsule = document.createElement('div');
    _capsule.className = 'nch-overlay-wrapper';
    _capsule.style.display = _visible ? 'flex' : 'none';
    _capsule.innerHTML =
      '<div class="nch-overlay-inner">' +
        '<div class="nch-overlay-stack" id="nch-overlay-stack"></div>' +
      '</div>';

    _stackEl = _capsule.querySelector('#nch-overlay-stack');

    // ── Drag (pointer events — works desktop + mobile) ────
    _capsule.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      var rect = _capsule.getBoundingClientRect();
      _capsuleDrag = {
        startX: e.clientX,
        startY: e.clientY,
        origLeft: rect.left,
        origTop:  rect.top,
        moved: false,
      };
      _capsule.classList.add('nch-overlay-dragging');
      _capsule.setPointerCapture(e.pointerId);
    });

    _capsule.addEventListener('pointermove', function (e) {
      if (!_capsuleDrag) return;
      var dx = e.clientX - _capsuleDrag.startX;
      var dy = e.clientY - _capsuleDrag.startY;
      if (!_capsuleDrag.moved && Math.sqrt(dx * dx + dy * dy) < 6) return;
      _capsuleDrag.moved = true;
      var newLeft = Math.max(0, Math.min(_capsuleDrag.origLeft + dx, window.innerWidth  - 40));
      var newTop  = Math.max(0, Math.min(_capsuleDrag.origTop  + dy, window.innerHeight - 40));
      _capsule.style.bottom = 'auto';
      _capsule.style.right  = 'auto';
      _capsule.style.left   = newLeft + 'px';
      _capsule.style.top    = newTop  + 'px';
    });

    _capsule.addEventListener('pointerup', function (e) {
      if (!_capsuleDrag) return;
      _capsule.classList.remove('nch-overlay-dragging');
      if (_capsuleDrag.moved) {
        var rect = _capsule.getBoundingClientRect();
        _savePos(rect.left, rect.top);
      } else {
        // Click (no drag) → action depends on mode
        _handleCapsuleClick();
      }
      _capsuleDrag = null;
    });

    _capsule.addEventListener('pointercancel', function () {
      _capsule.classList.remove('nch-overlay-dragging');
      _capsuleDrag = null;
    });

    document.body.appendChild(_capsule);
    _applyPos();
  }

  // ── Capsule Click Handler ────────────────────────────────

  function _handleCapsuleClick() {
    if (_mode === 'porthole') {
      // Open hand-fan-component in porthole/theme-selector mode
      _openPortholeHandFan();
    } else if (_mode === 'game') {
      // Delegate to NonCombatHUD expand
      _delegateToGameMode('expand');
    }
  }

  // ── Porthole Mode Rendering ──────────────────────────────

  function _renderPortholeStack() {
    if (!_stackEl || _mode !== 'porthole') return;

    var count = _portholeCards.length;
    var sig = 'p:' + count;
    if (_stackEl.dataset.sig === sig) return;
    _stackEl.dataset.sig = sig;

    _stackEl.innerHTML = '';
    var numJokers = Math.min(count, 8);
    _stackEl.style.width = (numJokers > 0 ? (20 + (numJokers - 1) * 6) : 20) + 'px';

    for (var i = 0; i < numJokers; i++) {
      var j = document.createElement('div');
      j.className = 'nch-overlay-joker joker-' + i;
      j.textContent = '\uD83C\uDCCF'; // 🃏
      j.dataset.themeId = _portholeCards[i] ? _portholeCards[i].theme : '';
      _stackEl.appendChild(j);
    }
  }

  // ── Porthole Hand Fan Bridge ─────────────────────────────
  // When clicked in porthole mode, we open the hand-fan-component
  // with coin-card theme data instead of game cards.
  // If HandFanComponent isn't loaded, we dispatch an event.

  function _openPortholeHandFan() {
    var evt = new CustomEvent('nch-overlay:open-porthole-fan', {
      detail: { cards: _portholeCards, source: 'nch-overlay' }
    });
    window.dispatchEvent(evt);

    // Direct integration if HandFanComponent is available
    // (Pages that load the hand-fan-component will handle the event)
  }

  // ── Game Mode Bridge ─────────────────────────────────────
  // In game mode, the overlay capsule becomes the visual anchor
  // but rendering is owned by NonCombatHUD. We hide our own
  // stack and let NCH render into its own capsule DOM.

  var _gameModeBridge = null;

  function _delegateToGameMode(action) {
    if (typeof NonCombatHUD === 'undefined') return;
    if (action === 'expand') {
      NonCombatHUD.setMinimized(false, 'nch_overlay_click');
    }
  }

  function _enterGameMode() {
    if (_mode === 'game') return;
    var prevMode = _mode;
    _mode = 'transitioning';

    // Animate capsule transition
    if (_capsule) _capsule.classList.add('nch-overlay-transitioning');

    // After brief transition, hand control to NonCombatHUD
    setTimeout(function () {
      _mode = 'game';
      if (_capsule) {
        _capsule.classList.remove('nch-overlay-transitioning');
        // Hide our overlay — NCH's own capsule takes over
        _capsule.style.display = 'none';
      }

      // Tell NCH to init if it hasn't
      if (typeof NonCombatHUD !== 'undefined' && NonCombatHUD.init) {
        NonCombatHUD.init();
      }

      // Dispatch event for splash cleanup
      window.dispatchEvent(new CustomEvent('nch-overlay:entered-game-mode', {
        detail: { previousMode: prevMode }
      }));
    }, 300);
  }

  function _exitGameMode() {
    if (_mode !== 'game') return;
    _mode = 'porthole';

    // Show our capsule again
    if (_capsule) {
      _capsule.style.display = _visible ? 'flex' : 'none';
      _stackEl.dataset.sig = ''; // force re-render
      _renderPortholeStack();
    }

    window.dispatchEvent(new CustomEvent('nch-overlay:exited-game-mode'));
  }

  // ── Mode Detection Polling ───────────────────────────────
  // Checks whether GoneRogue has become active/inactive
  // and transitions between porthole ↔ game accordingly.

  function _pollMode() {
    var rogueActive = false;
    try {
      rogueActive = (typeof GoneRogue !== 'undefined' &&
                     GoneRogue.isActive && GoneRogue.isActive());
    } catch (e) {}

    if (rogueActive && _mode === 'porthole') {
      _enterGameMode();
    } else if (!rogueActive && _mode === 'game') {
      _exitGameMode();
    }
  }

  // ── Starfield Init Helper ────────────────────────────────
  // Convenience: pages can call NchOverlay.initStarfield() to
  // start the shared starfield module if it's loaded.

  function _initStarfield(opts) {
    if (typeof EyesOnlyStarfield !== 'undefined' && !EyesOnlyStarfield.isRunning()) {
      EyesOnlyStarfield.init(opts || {});
    }
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Initialize the NCH Overlay on the current page.
   * @param {Object} [opts]
   * @param {Array}  [opts.cards]         - Custom porthole card configs
   * @param {boolean}[opts.autoStarfield] - Auto-init EyesOnlyStarfield (default: true)
   * @param {Object} [opts.starfieldOpts] - Options passed to EyesOnlyStarfield.init()
   * @param {boolean}[opts.visible]       - Start visible (default: true)
   */
  function init(opts) {
    if (_initialized) return;
    _initialized = true;
    opts = opts || {};

    if (opts.cards) _portholeCards = opts.cards;
    if (opts.visible === false) _visible = false;

    _createCapsule();
    _renderPortholeStack();

    // Auto-start starfield unless opted out
    if (opts.autoStarfield !== false) {
      _initStarfield(opts.starfieldOpts || {});
    }

    // Poll for GoneRogue presence (seamless transition)
    setInterval(_pollMode, 500);

    // Listen for explicit game launch / exit events
    window.addEventListener('gone-rogue-started', function () {
      if (_mode === 'porthole') _enterGameMode();
    });
    window.addEventListener('gone-rogue-ended', function () {
      if (_mode === 'game') _exitGameMode();
    });
  }

  /**
   * Destroy the overlay and clean up.
   */
  function destroy() {
    if (_capsule && _capsule.parentNode) {
      _capsule.parentNode.removeChild(_capsule);
    }
    _capsule = null;
    _stackEl = null;
    _initialized = false;
    _mode = 'porthole';
  }

  /**
   * Show/hide the overlay.
   */
  function show() {
    _visible = true;
    if (_capsule && _mode !== 'game') _capsule.style.display = 'flex';
  }

  function hide() {
    _visible = false;
    if (_capsule) _capsule.style.display = 'none';
  }

  /**
   * Reset capsule position to default (bottom-right).
   */
  function resetPosition() {
    _clearPos();
    if (_capsule) {
      _capsule.style.left   = '';
      _capsule.style.top    = '';
      _capsule.style.bottom = '';
      _capsule.style.right  = '';
    }
  }

  /**
   * Get current mode.
   * @returns {'porthole'|'game'|'transitioning'}
   */
  function getMode() { return _mode; }

  /**
   * Set the porthole card configs (for custom per-page cards).
   * @param {Array} cards - [{ id, emoji, theme, label }, ...]
   */
  function setPortholeCards(cards) {
    _portholeCards = cards || [];
    if (_stackEl) _stackEl.dataset.sig = '';
    _renderPortholeStack();
  }

  /**
   * Force enter/exit game mode (used by splash screen launcher).
   */
  function enterGameMode()  { _enterGameMode(); }
  function exitGameMode()   { _exitGameMode();  }

  /**
   * Get the capsule DOM element (for animation anchoring).
   * @returns {HTMLElement|null}
   */
  function getCapsuleElement() { return _capsule; }

  return {
    init:             init,
    destroy:          destroy,
    show:             show,
    hide:             hide,
    resetPosition:    resetPosition,
    getMode:          getMode,
    setPortholeCards: setPortholeCards,
    enterGameMode:    enterGameMode,
    exitGameMode:     exitGameMode,
    getCapsuleElement: getCapsuleElement,
  };
})();
