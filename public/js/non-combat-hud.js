/* ============================================================
   Non-Combat HUD (fixed overlay, v0)
   Shell + state display + debug hooks.
   ============================================================ */

var NonCombatHUD = (function() {
  'use strict';

  var _root = null;

  function init() {
    if (_root) return;

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
        '<div class="nch-title">EQUIPPED</div>' +
        '<div class="nch-equipped" id="nch-equipped">(none)</div>' +
        '<div class="nch-title">HAND</div>' +
        '<div class="nch-hand" id="nch-hand">Use the hand fan (🃏) below</div>' +
      '</div>' +
      '<div class="nch-col nch-right">' +
        '<div class="nch-title">PREVIEW</div>' +
        '<div class="nch-preview" id="nch-preview">idle</div>' +
      '</div>';

    document.body.appendChild(_root);

    if (typeof NonCombatStateStore !== 'undefined') {
      NonCombatStateStore.subscribe(function(prev, next) {
        _render(next);
      });
      _render(NonCombatStateStore.getState());
    }

    // Show/hide based on GoneRogue mode and STR combat state
    setInterval(function() {
      var rogueActive = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function' && GoneRogue.isActive());
      var strActive = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function' && GoneRogue.isStrCombatActive());
      var shouldShow = rogueActive && !strActive;
      _root.style.display = shouldShow ? 'flex' : 'none';
    }, 350);
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
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init: init
  };
})();
