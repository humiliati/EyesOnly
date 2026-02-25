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
    // New-player UX: default to items view (empty slots prime item collection)
    view: 'items', // 'items' | 'cards'
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
  var _lastItemsLen = null;

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

    var strActive = false;
    try {
      strActive = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function' && GoneRogue.isStrCombatActive());
    } catch (e0) { strActive = false; }

    // Fetch refs
    var items = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentInventory) ? (GAMESTATE.getPersistentInventory() || []) : [];
    var cards = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentCards) ? (GAMESTATE.getPersistentCards() || []) : [];
    var activeItem = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;

    // STR combat view: left column becomes redacted BACKUP deck surface
    if (strActive) {
      var backup = (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getBackupCards === 'function') ? (GAMESTATE.getBackupCards() || []) : [];
      var canDraw = (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.canDrawBackupThisCombat === 'function') ? !!GAMESTATE.canDrawBackupThisCombat() : false;
      var hasBackup = Array.isArray(backup) && backup.some(function(r) { return r && r.id; });

      var sigB = ['v=str', 'draw=' + (canDraw ? '1' : '0')];
      for (var bi = 0; bi < 4; bi++) {
        var br = backup[bi];
        sigB.push(br && br.id ? (br.id + ':' + (br.qty || 1)) : '-');
      }
      var signatureB = sigB.join('|');
      if (signatureB === _lastSignature) return;
      _lastSignature = signatureB;

      _container.innerHTML = '';

      // Slot 1 becomes DRAW button
      var drawBtn = document.createElement('button');
      drawBtn.type = 'button';
      drawBtn.className = 'rogue-sidebar-btn rogue-sidebar-toggle';
      drawBtn.textContent = (canDraw && hasBackup) ? 'DRAW 1' : 'BACKUP';
      drawBtn.disabled = !(canDraw && hasBackup);
      drawBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (drawBtn.disabled) return;
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.drawOneFromBackupOncePerCombat === 'function') {
          GAMESTATE.drawOneFromBackupOncePerCombat();
        }
        // force refresh
        _lastSignature = null;
        _render();
      });
      _container.appendChild(drawBtn);

      // Slots 2-5: preview backup (redacted/non-interactive baseline)
      for (var i = 0; i < 4; i++) {
        var ref = backup[i] || null;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rogue-sidebar-btn card-button';
        btn.disabled = true;

        if (!ref || !ref.id) {
          btn.classList.add('empty');
          btn.textContent = '—';
        } else {
          var cardDef = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(ref.id) : null;
          var em = cardDef && cardDef.emoji ? cardDef.emoji : '🃏';
          btn.innerHTML = '<span class="rs-emoji">' + em + '</span><span class="rs-label">' + 'REDACTED' + '</span>';
        }

        _container.appendChild(btn);
      }

      // Slot 6: cycle placeholder (disabled)
      var cycleBtn = document.createElement('button');
      cycleBtn.type = 'button';
      cycleBtn.className = 'rogue-sidebar-btn rogue-sidebar-cycle disabled';
      cycleBtn.textContent = ' ';
      cycleBtn.disabled = true;
      _container.appendChild(cycleBtn);

      return;
    }

    var list = (view === 'items') ? items : cards;
    var offsetKey = (view === 'items') ? 'itemOffset' : 'cardOffset';
    var offset = Number(_prefs[offsetKey] || 0);

    // 3D Printer armed state (for x2 cue on eligible ammo/battery cards)
    var printerArmed = false;
    try {
      if (activeItem && activeItem.id && activeItem.meta && activeItem.meta.toggled) {
        var idef = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) ? GoneRogueDataRegistry.getItem(activeItem.id) : null;
        if (idef && Array.isArray(idef.effects)) {
          for (var pi = 0; pi < idef.effects.length; pi++) {
            if (idef.effects[pi] && idef.effects[pi].type === 'printer_3d') { printerArmed = true; break; }
          }
        }
      }
    } catch (e0) {}
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
      'ai=' + (activeItem && activeItem.id ? activeItem.id : ''),
      'pa=' + (printerArmed ? '1' : '0')
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

    // Highlight the container when items list grows (e.g., first key pickup)
    try {
      if (view === 'items') {
        var curLen = items.length;
        if (_lastItemsLen === null) _lastItemsLen = curLen;
        if (curLen > _lastItemsLen) {
          _container.classList.remove('rs-flash');
          void _container.offsetWidth;
          _container.classList.add('rs-flash');
          setTimeout(function() {
            try { _container.classList.remove('rs-flash'); } catch (e0) {}
          }, 420);
        }
        _lastItemsLen = curLen;
      }
    } catch (eF0) {}

    _container.innerHTML = '';

    // Slot 1: toggle view
    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'rogue-sidebar-btn rogue-sidebar-toggle';
    // Swapper copy: items view should clearly indicate "back to cards".
    toggleBtn.textContent = (view === 'items') ? '← Cards' : 'Items →';
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
        btn.textContent = '[     ]';
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

          var x2 = '';
          try {
            if (printerArmed && card && Array.isArray(card.costs)) {
              for (var ci = 0; ci < card.costs.length; ci++) {
                var cst = card.costs[ci];
                if (cst && (cst.kind === 'ammo' || cst.kind === 'battery')) { x2 = '<span class="printer-x2">x2</span>'; btn.classList.add('printer-eligible'); break; }
              }
            }
          } catch (e1) {}

          btn.innerHTML = '<span class="rs-emoji">' + em2 + '</span><span class="rs-label">' + nm2 + '</span>' + x2 + '<span class="rs-qty">x' + qty + '</span>';

          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var cardId = (cards[Number(e.currentTarget.dataset.index)] || {}).id;
            if (!cardId) return;

            // Shift-click: stash -> BACKUP (convenience)
            if (e.shiftKey && typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveStashCardToBackup === 'function') {
              var r = GAMESTATE.moveStashCardToBackup(cardId);
              if (typeof TooltipSystem !== 'undefined') {
                TooltipSystem.showPersistent(r && r.success ? '📦 Stash → BACKUP' : ('❌ Backup: ' + ((r && r.reason) ? r.reason : 'failed')), 900);
              }
              _lastSignature = null;
              _render();
              return;
            }

            // Default: stash -> HAND (mirrors NCH + CH)
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
