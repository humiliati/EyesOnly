/* ============================================================
   Rogue Sidebar (6-slot) - v0
   Standardized inventory/cards access without frame pushing.
   Debrief remains adaptive/floating and is not owned here.
   ============================================================ */

var RogueSidebar = (function() {
  // STR draw feedback: lightweight "ghost joker" cursor helper.
  // We DO NOT hide the real cursor (precision matters); we only show a small
  // trailing 🃏 while hovering the STR DRAW button to convey "random card".
  var _ghostEl = null;
  var _ghostMoveHandler = null;

  function _activateGhostJokerCursor() {
    if (_ghostEl) return;
    _ghostEl = document.createElement('div');
    _ghostEl.className = 'rs-ghost-joker';
    _ghostEl.textContent = '🃏';
    document.body.appendChild(_ghostEl);

    _ghostMoveHandler = function(e) {
      if (!_ghostEl) return;
      _ghostEl.style.left = (e.clientX + 14) + 'px';
      _ghostEl.style.top = (e.clientY + 14) + 'px';
    };
    document.addEventListener('pointermove', _ghostMoveHandler);
  }

  function _deactivateGhostJokerCursor() {
    if (_ghostEl && _ghostEl.parentNode) _ghostEl.parentNode.removeChild(_ghostEl);
    _ghostEl = null;
    if (_ghostMoveHandler) document.removeEventListener('pointermove', _ghostMoveHandler);
    _ghostMoveHandler = null;
  }

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

    // Immediate re-render on CSA vault/hand/backup changes (supplements the 250ms poll)
    window.addEventListener('csa-event', function(ev) {
      var t = ev && ev.detail && ev.detail.type;
      if (t === 'vault:changed' || t === 'hand:changed' || t === 'backup:changed') {
        _lastSignature = null;
        _render();
      }
    });

    // Re-render when data registry loads card/item definitions
    window.addEventListener('gone-rogue-registry-ready', function() {
      _lastSignature = null;
      _render();
    });
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
        delete _container.dataset.dropzone;
      }
      return;
    }

    // RogueSidebar is now the PRIMARY left-column display.
    // BAC floating popup is retired — ensure we're always visible when rogue is active.
    if (_container) _container.style.display = '';

    if (!_container) return;
    if (_container.dataset.rogueSidebarActive !== '1') {
      _container.dataset.rogueSidebarActive = '1';
      _container.dataset.dropzone = 'backup';

      // NCH stays in its current state (minimized capsule by default).
      // Players expand it manually when they need deck management.
      // Previously this force-expanded the NCH, covering the game screen.
    }

    _render();
  }

  function _render() {
    if (!_container) return;

    // Fetch refs early so we can enforce first-pickup UX.
    // Items view combines BOTH persistent items (ITM-*) and vault cards (ACT-*),
    // mirroring BAC's _getItemCards() logic. Items appear first, then vault cards.
    var rawItems = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentInventory) ? (GAMESTATE.getPersistentInventory() || []) : [];
    var vaultCards = [];
    if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.getVault === 'function') {
      vaultCards = CardStateAuthority.getVault() || [];
    } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getPersistentCards === 'function') {
      vaultCards = GAMESTATE.getPersistentCards() || [];
    }
    var items = rawItems.concat(vaultCards);

    // The "cards" view shows the NCH backup deck (canonical, shared with NCH panel).
    var backupCards = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getBackupCards) ? (GAMESTATE.getBackupCards() || []) : [];

    // New-player UX: if items just became non-empty (e.g., first key pickup), force items view.
    try {
      if ((_lastItemsLen === null || _lastItemsLen === 0) && items.length > 0) {
        _prefs.view = 'items';
        _prefs.itemOffset = 0;
        _savePrefs();
      }
    } catch (e0) {}

    var view = _prefs.view === 'items' ? 'items' : 'cards';

    var strActive = false;
    try {
      strActive = (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function' && GoneRogue.isStrCombatActive());
    } catch (e0) { strActive = false; }

    // Fetch refs
    var activeItem = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;

    // Ensure any prior STR draw hover cursor is cleared when switching modes.
    _deactivateGhostJokerCursor();

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
        var drawRes = null;
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.drawOneFromBackupPerTurn === 'function') {
          drawRes = GAMESTATE.drawOneFromBackupPerTurn();
        } else if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.drawOneFromBackupOncePerCombat === 'function') {
          drawRes = GAMESTATE.drawOneFromBackupOncePerCombat();
        }
        // Notify hand changed so BLVCK can auto-remove if drawn card is playable
        if (drawRes && drawRes.success) {
          try { window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'sidebar-str-draw', cardId: drawRes.cardId } })); } catch (e0) {}
        }
        // force refresh
        _lastSignature = null;
        _render();
      });
      // Hover feedback: show a joker "ghost" cursor to reinforce randomness.
      drawBtn.addEventListener('pointerenter', function() {
        if (!drawBtn.disabled) _activateGhostJokerCursor();
      });
      drawBtn.addEventListener('pointerleave', function() {
        _deactivateGhostJokerCursor();
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

    var list = (view === 'items') ? items : backupCards;
    var offsetKey = (view === 'items') ? 'itemOffset' : 'cardOffset';
    var offset = (view === 'items') ? Number(_prefs.itemOffset || 0) : 0;

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
    var maxOffset = (view === 'items') ? Math.max(0, list.length - maxVisible) : 0;
    if (offset > maxOffset) offset = maxOffset;
    if (view === 'items') _prefs.itemOffset = offset;

    // Signature to avoid re-render flicker (hover flashing)
    var sigParts = [
      'v=' + view,
      'io=' + (_prefs.itemOffset || 0),
      'il=' + items.length,
      'cl=' + backupCards.filter(function(r) { return r && r.id; }).length,
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
        btn.disabled = true;
      } else {
        if (view === 'items') {
          // Differentiate ACT-* vault cards from ITM-* items
          var isVaultCard = !!(ref.id && ref.id.indexOf('ACT-') === 0);
          var def = null;
          if (isVaultCard) {
            // Vault card: look up from card registry, display with joker emoji
            def = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(ref.id) : null;
            if (def && def._missing) def = null; // registry not loaded yet
          } else {
            // Regular item: look up from item registry
            def = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) ? GoneRogueDataRegistry.getItem(ref.id) : null;
            if (def && def._missing) def = null;
          }
          var nm = def ? def.name : ref.id;
          var em = isVaultCard ? '🃏' : (def ? def.emoji : '📦');
          btn.innerHTML = '<span class="rs-emoji">' + em + '</span><span class="rs-label">' + nm + '</span>';

          if (!isVaultCard && def && def.equipSlot && def.equipSlot !== 'none') {
            btn.classList.add('equippable');
          }

          if (!isVaultCard && activeItem && activeItem.id === ref.id) {
            btn.classList.add('selected');
          }

          if (isVaultCard) {
            // Vault cards: drag to NCH hand/backup/capsule, or click to cascade into hand
            btn.classList.add('vault-card');

            // Drag handler: use NCH external drag engine for vault cards
            btn.addEventListener('pointerdown', function(e) {
              if (!e || e.pointerType === 'touch') return;
              if (e.button !== undefined && e.button !== 0) return;

              var vIdx = Number(e.currentTarget.dataset.index);
              var vRef = items[vIdx] || null;
              var vId = vRef ? vRef.id : null;
              if (!vId) return;

              var vDef = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(vId) : null;
              var vEmoji = (vDef && vDef.emoji) ? vDef.emoji : '🃏';

              try {
                if (typeof NonCombatHUD !== 'undefined' && typeof NonCombatHUD.startExternalDrag === 'function') {
                  NonCombatHUD.startExternalDrag({ kind: 'vault', id: vId, emoji: vEmoji }, e);
                  return;
                }
              } catch (e0) {}
            });

            // Click fallback: cascade vault card into hand (bumps last card to backup if full)
            btn.addEventListener('click', function(e) {
              e.stopPropagation();
              var id = (items[Number(e.currentTarget.dataset.index)] || {}).id;
              if (!id) return;

              var ok = false;
              if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.cascadeVaultToHandTop === 'function') {
                ok = !!CardStateAuthority.cascadeVaultToHandTop(id);
              } else if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.moveVaultToHand === 'function') {
                ok = !!CardStateAuthority.moveVaultToHand(id, 1);
              }
              if (ok) {
                if (typeof TooltipSystem !== 'undefined') TooltipSystem.showPersistent('🃏 → Hand', 650);
              } else {
                if (typeof TooltipSystem !== 'undefined') TooltipSystem.showPersistent('❌ Hand full', 900);
              }

              _lastSignature = null;
              _render();
            });
          } else {
            // Regular items: click to equip/unequip (original behavior)
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
          }
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

          btn.addEventListener('pointerdown', function(e) {
            if (!e || e.pointerType === 'touch') return;
            if (e.button !== undefined && e.button !== 0) return;

            var bIdx = Number(e.currentTarget.dataset.index);
            var bRef = (backupCards[bIdx] || null);
            var bCardId = bRef ? bRef.id : null;
            if (!bCardId) return;

            var bCardDef = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) ? GoneRogueDataRegistry.getCard(bCardId) : null;
            var bEmoji = bCardDef ? (bCardDef.emoji || '🃏') : '🃏';

            // Use the canonical NCH drag engine with kind:'backup' so drop onto NCH hand
            // calls moveBackupIndexToHand, which is the same as clicking the HAND→ button.
            try {
              if (typeof NonCombatHUD !== 'undefined' && typeof NonCombatHUD.startExternalDrag === 'function') {
                NonCombatHUD.startExternalDrag({ kind: 'backup', backupIndex: bIdx, id: bCardId, emoji: bEmoji }, e);
                return;
              }
              if (typeof TooltipSystem !== 'undefined') {
                TooltipSystem.showPersistent('⚠️ NCH not ready (drag disabled)', 900);
              }
            } catch (e0) {}
          });

          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var bIdx = Number(e.currentTarget.dataset.index);
            var bRef = (backupCards[bIdx] || null);
            if (!bRef || !bRef.id) return;

            // Click: backup -> HAND (canonical move via GAMESTATE, mirrors NCH "HAND→" button)
            var okMove = false;
            if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.moveBackupIndexToHand === 'function') {
              okMove = !!GAMESTATE.moveBackupIndexToHand(bIdx).success;
            }
            if (!okMove) {
              if (typeof TooltipSystem !== 'undefined') {
                TooltipSystem.showPersistent('❌ Cannot move to hand', 900);
              }
              return;
            }

            if (typeof TooltipSystem !== 'undefined') {
              TooltipSystem.showPersistent('🃏 Moved to hand', 650);
            }

            _lastSignature = null;
            _render();
          });
        }
      }

      _container.appendChild(btn);
    }

    // Slot 6: cycle (enabled only for items view overflow)
    var cycleBtn = document.createElement('button');
    cycleBtn.type = 'button';
    cycleBtn.className = 'rogue-sidebar-btn rogue-sidebar-cycle';

    var overflow = view === 'items' && list.length > maxVisible;
    cycleBtn.textContent = overflow ? '↻ Cycle' : ' '; // keep height stable
    if (!overflow) {
      cycleBtn.classList.add('disabled');
      cycleBtn.disabled = true;
    } else {
      cycleBtn.addEventListener('click', function() {
        var next = (_prefs.itemOffset || 0) + 1;
        if (next > maxOffset) next = 0;
        _prefs.itemOffset = next;
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
