/* ============================================================
   Rogue Sidebar (6-slot) - v0
   Standardized inventory/cards access without frame pushing.
   Debrief remains adaptive/floating and is not owned here.
   ============================================================ */

var RogueSidebar = (function() {
  'use strict';

  var _container = null;
  var _originalHtml = null;
  var _interactionLockUntil = 0;

  var PREF_KEY = 'EYESONLY_ROGUE_SIDEBAR_PREFS_V1';
  var _prefs = {
    view: 'cards', // 'items' | 'cards'
    itemOffset: 0,
    cardOffset: 0
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

  var _lastSignature = null;

  function init() {
    if (_container) return;
    _loadPrefs();

    _container = document.querySelector('#control-rail .control-buttons');
    if (!_container) return;

    _originalHtml = _container.innerHTML;

    // Prevent interval re-render from swallowing the first click
    _container.addEventListener('pointerdown', function(e) {
      if (!e || e.pointerType === 'touch') return;
      _interactionLockUntil = Date.now() + 450;
    });
    _container.addEventListener('pointerup', function(e) {
      if (!e || e.pointerType === 'touch') return;
      _interactionLockUntil = Date.now() + 120;
    });
    _container.addEventListener('pointercancel', function(e) {
      if (!e || e.pointerType === 'touch') return;
      _interactionLockUntil = Date.now() + 120;
    });

    setInterval(_tick, 250);
  }

  function _tick() {
    if (_interactionLockUntil && Date.now() < _interactionLockUntil) {
      return;
    }

    var rogueActive = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function' && GoneRogue.isActive());

    if (!rogueActive) {
      if (_container && _originalHtml !== null && _container.dataset.rogueSidebarActive === '1') {
        _container.innerHTML = _originalHtml;
        delete _container.dataset.rogueSidebarActive;
      }
      return;
    }

    if (!_container) return;
    if (_container.dataset.rogueSidebarActive !== '1') {
      _container.dataset.rogueSidebarActive = '1';
    }

    _render();
  }

  function _render() {
    if (!_container) return;

    var view = _prefs.view === 'items' ? 'items' : 'cards';

    // Fetch refs
    var items = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentInventory) ? (GAMESTATE.getPersistentInventory() || []) : [];
    var cards = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentCards) ? (GAMESTATE.getPersistentCards() || []) : [];
    var activeItem = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;

    var list = (view === 'items') ? items : cards;
    var offsetKey = (view === 'items') ? 'itemOffset' : 'cardOffset';
    var offset = Number(_prefs[offsetKey] || 0);
    if (!isFinite(offset) || offset < 0) offset = 0;

    var maxVisible = 4;
    var maxOffset = Math.max(0, list.length - maxVisible);
    if (offset > maxOffset) offset = maxOffset;
    _prefs[offsetKey] = offset;

    // Signature to avoid re-render flicker (hover flashing)
    var sigParts = [
      'v=' + view,
      'io=' + (_prefs.itemOffset || 0),
      'co=' + (_prefs.cardOffset || 0),
      'il=' + items.length,
      'cl=' + cards.length,
      'ai=' + (activeItem && activeItem.id ? activeItem.id : '')
    ];

    // include visible slice ids/qty
    for (var si = 0; si < maxVisible; si++) {
      var refSig = list[offset + si];
      if (refSig && refSig.id) sigParts.push(refSig.id + ':' + (refSig.qty || 1));
      else sigParts.push('-');
    }

    var signature = sigParts.join('|');
    if (signature === _lastSignature) {
      return;
    }
    _lastSignature = signature;

    _container.innerHTML = '';

    // Slot 1: toggle view
    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'rogue-sidebar-btn rogue-sidebar-toggle';
    toggleBtn.textContent = (view === 'items') ? 'Cards →' : 'Items →';
    toggleBtn.addEventListener('click', function() {
      _prefs.view = (view === 'items') ? 'cards' : 'items';
      _savePrefs();
      _render();
    });
    _container.appendChild(toggleBtn);

    // Slots 2-5: entries
    for (var i = 0; i < maxVisible; i++) {
      var idx = offset + i;
      var ref = (idx < list.length) ? list[idx] : null;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rogue-sidebar-btn card-button';
      btn.dataset.index = String(idx);
      btn.dataset.view = view;

      if (!ref || !ref.id) {
        btn.classList.add('empty');
        btn.textContent = '—';
      } else {
        if (view === 'items') {
          var item = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) ? GoneRogueDataRegistry.getItem(ref.id) : null;
          var nm = item ? item.name : ref.id;
          var em = item ? item.emoji : '📦';
          btn.innerHTML = '<span class="rs-emoji">' + em + '</span><span class="rs-label">' + nm + '</span>';

          if (item && item.equipSlot && item.equipSlot !== 'none') {
            btn.classList.add('equippable');
          }

          if (activeItem && activeItem.id === ref.id) {
            btn.classList.add('selected');
          }

          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var id = (items[Number(e.currentTarget.dataset.index)] || {}).id;
            if (!id) return;

            var active = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;
            if (active && active.id === id) {
              GAMESTATE.clearActiveItem();
            } else {
              GAMESTATE.setActiveItem({ id: id, qty: 1 });
            }

            // Force refresh to reflect selection state
            _lastSignature = null;
            _render();
          });
        } else {
          var card = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(ref.id) : null;
          var nm2 = card ? card.name : ref.id;
          var em2 = card ? card.emoji : '🃏';
          var qty = ref.qty || 1;
          btn.innerHTML = '<span class="rs-emoji">' + em2 + '</span><span class="rs-label">' + nm2 + '</span><span class="rs-qty">x' + qty + '</span>';

          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var cardId = (cards[Number(e.currentTarget.dataset.index)] || {}).id;
            if (!cardId) return;

            // Move 1 from stash -> canonical hand (mirrors NCH + CH)
            var okAdd = false;
            if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addCardToHand === 'function') {
              okAdd = !!GAMESTATE.addCardToHand(cardId, 1).success;
            }
            if (!okAdd) {
              if (typeof TooltipSystem !== 'undefined') {
                TooltipSystem.showPersistent('❌ Cannot add card to hand', 900);
              }
              return;
            }

            if (typeof TooltipSystem !== 'undefined') {
              TooltipSystem.showPersistent('🃏 Added to hand', 650);
            }

            _lastSignature = null;
            _render();
          });
        }
      }

      _container.appendChild(btn);
    }

    // Slot 6: cycle (enabled only if overflow exists)
    var cycleBtn = document.createElement('button');
    cycleBtn.type = 'button';
    cycleBtn.className = 'rogue-sidebar-btn rogue-sidebar-cycle';

    var overflow = list.length > maxVisible;
    cycleBtn.textContent = overflow ? '↻ Cycle' : ' '; // keep height stable
    if (!overflow) {
      cycleBtn.classList.add('disabled');
      cycleBtn.disabled = true;
    } else {
      cycleBtn.addEventListener('click', function() {
        var next = (_prefs[offsetKey] || 0) + 1;
        if (next > maxOffset) next = 0;
        _prefs[offsetKey] = next;
        _savePrefs();
        _lastSignature = null;
        _render();
      });
    }
    _container.appendChild(cycleBtn);

    _savePrefs();
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
