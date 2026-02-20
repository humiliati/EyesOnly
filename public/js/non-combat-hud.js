/* ============================================================
   Non-Combat HUD (fixed overlay, v0)
   Shell + state display + debug hooks.
   ============================================================ */

var NonCombatHUD = (function() {
  'use strict';

  var _root = null;
  var _mini = null;

  var PREF_KEY = 'EYESONLY_NONCOMBAT_HUD_PREFS_V1';
  var _prefs = {
    minimized: false
  };

  var _drag = {
    active: false,
    startY: 0,
    lastY: 0,
    startTs: 0
  };

  function _loadPrefs() {
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          _prefs = Object.assign(_prefs, parsed);
        }
      }
    } catch (e) {}
  }

  function _savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(_prefs)); } catch (e) {}
  }

  function init() {
    if (_root) return;

    _loadPrefs();

    _root = document.createElement('div');
    _root.id = 'non-combat-hud';
    _root.className = 'non-combat-hud';
    _root.style.display = 'none';

    _root.innerHTML =
      '<div class="nch-col nch-left">' +
        '<div class="nch-title">ACTIONS</div>' +
        '<div class="nch-actions" id="nch-actions"></div>' +
      '</div>' +
      '<div class="nch-col nch-center">' +
        '<div class="nch-title">EQUIPPED <button class="nch-min-btn" id="nch-min-btn" title="Minimize">_</button></div>' +
        '<div class="nch-equipped" id="nch-equipped">(none)</div>' +
        '<div class="nch-title">HAND</div>' +
        '<div class="nch-hand" id="nch-hand" data-dropzone="hand">Drop cards here from inventory.</div>' +
      '</div>' +
      '<div class="nch-col nch-right">' +
        '<div class="nch-title">PREVIEW</div>' +
        '<div class="nch-preview" id="nch-preview">idle</div>' +
      '</div>';

    document.body.appendChild(_root);

    _mini = document.createElement('div');
    _mini.id = 'non-combat-hud-mini';
    _mini.innerHTML = '<span class="nch-mini-dot"></span><span class="nch-mini-label">NCH</span>';
    _mini.style.display = 'none';
    document.body.appendChild(_mini);

    var minBtn = _root.querySelector('#nch-min-btn');
    if (minBtn) {
      minBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        setMinimized(true, 'button');
      });
    }

    // Tap mini pill to expand
    _mini.addEventListener('click', function() {
      setMinimized(false, 'pill');
    });

    // Drag-down minimize gesture (similar feel to STR, simplified)
    _root.addEventListener('pointerdown', function(e) {
      // Ignore interactions on buttons/inputs/links
      var t = e.target;
      if (t && t.closest && t.closest('button, a, input, textarea, select, label')) return;

      _drag.active = true;
      _drag.startY = e.clientY;
      _drag.lastY = e.clientY;
      _drag.startTs = Date.now();
      try { _root.setPointerCapture(e.pointerId); } catch (err) {}
    });

    _root.addEventListener('pointermove', function(e) {
      if (!_drag.active) return;
      _drag.lastY = e.clientY;
    });

    _root.addEventListener('pointerup', function(e) {
      if (!_drag.active) return;
      _drag.active = false;
      var dy = _drag.lastY - _drag.startY;
      var dt = Math.max(1, Date.now() - _drag.startTs);
      var v = (dy / dt) * 1000; // px/s

      // Thresholds: drag down far enough OR fast swipe
      if (dy > 90 || (dy > 40 && v > 850)) {
        setMinimized(true, 'drag');
      }
    });

    if (typeof NonCombatStateStore !== 'undefined') {
      NonCombatStateStore.subscribe(function(prev, next) {
        _render(next);
      });
      _render(NonCombatStateStore.getState());
    }

    // Registry loading UX
    var previewEl = _root.querySelector('#nch-preview');
    if (previewEl) {
      previewEl.textContent = 'Loading data...';
    }

    if (typeof NonCombatEventBus !== 'undefined') {
      NonCombatEventBus.on('registry:loaded', function(evt) {
        if (previewEl) {
          var counts = (evt && evt.payload && evt.payload.counts) ? evt.payload.counts : null;
          previewEl.textContent = 'idle' + (counts ? (' (cards ' + counts.cards + ', items ' + counts.items + ')') : '');
        }
      });
    } else if (typeof GoneRogueDataRegistry !== 'undefined' && typeof GoneRogueDataRegistry.ready === 'function') {
      GoneRogueDataRegistry.ready().then(function() {
        if (previewEl) previewEl.textContent = 'idle';
      });
    }

    // Show/hide based on GoneRogue mode and STR combat state
    setInterval(function() {
      var rogueActive = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function' && GoneRogue.isActive());
      var strActive = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function' && GoneRogue.isStrCombatActive());
      var shouldShow = rogueActive && !strActive;

      if (!shouldShow) {
        _root.style.display = 'none';
        _mini.style.display = 'none';
        return;
      }

      if (_prefs.minimized) {
        _root.style.display = 'none';
        _mini.style.display = 'flex';
      } else {
        _root.style.display = 'flex';
        _mini.style.display = 'none';
      }
    }, 350);

    // Apply initial minimized state
    setMinimized(!!_prefs.minimized, 'init');
  }

  function setMinimized(minimized, reason) {
    _prefs.minimized = !!minimized;
    _savePrefs();

    if (_prefs.minimized) {
      if (_root) _root.classList.add('minimized');
    } else {
      if (_root) _root.classList.remove('minimized');
    }

    if (typeof NonCombatStateStore !== 'undefined') {
      NonCombatStateStore.modifyState({
        uiState: NonCombatStateStore.NON_COMBAT_STATES.IDLE
      }, 'nch:minimized', { minimized: _prefs.minimized, reason: reason || 'unknown' });
    }
  }

  function _render(state) {
    if (!_root || !state) return;

    var eq = _root.querySelector('#nch-equipped');
    if (eq) {
      eq.textContent = state.equippedItemId ? ('📎 ' + state.equippedItemId) : '(none)';
    }

    var pv = _root.querySelector('#nch-preview');
    if (pv) {
      pv.textContent = state.uiState || 'idle';
    }

    var hand = _root.querySelector('#nch-hand');
    if (hand) {
      var refs = (state.cardsInHand && Array.isArray(state.cardsInHand)) ? state.cardsInHand : [];
      if (refs.length === 0) {
        hand.textContent = 'Drop cards here from inventory.';
      } else {
        var lines = [];
        for (var i = 0; i < refs.length; i++) {
          var ref = refs[i];
          if (!ref || !ref.id) continue;
          var card = null;
          if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
            card = GoneRogueDataRegistry.getCard(ref.id);
          }
          var nm = card ? card.name : ref.id;
          var em = card ? card.emoji : '🃏';
          lines.push(em + ' ' + nm + ' x' + (ref.qty || 1));
        }
        hand.textContent = lines.join('\n');
      }
    }

    if (_mini) {
      _mini.classList.remove('nch-mini-warn');
      _mini.classList.remove('nch-mini-busy');
      if (state.uiState === (NonCombatStateStore.NON_COMBAT_STATES.TARGETING || 'targeting')) {
        _mini.classList.add('nch-mini-busy');
      }
      if (state.uiState === (NonCombatStateStore.NON_COMBAT_STATES.CONFIRMATION || 'confirmation')) {
        _mini.classList.add('nch-mini-warn');
      }
    }
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init: init,
    setMinimized: setMinimized
  };
})();
