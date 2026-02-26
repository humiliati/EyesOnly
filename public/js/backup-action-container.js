/* ============================================================
   EYES ONLY - Backup Action Container (Left Column)
   Rewritten for Phase 1.2: Pure view of CardStateAuthority.

   Renders 6 slots:
   - Slots 0-4: Top 5 cards from backup deck
   - Slot 5 (mode-dependent):
     - GR (non-combat): items.inventory / backup.card container swapper
     - STR-combat: drawx[N] button (item-variable, default 1)
   ============================================================ */

var BackupActionContainer = (function() {
  'use strict';

  var _container = null;
  var _isVisible = false;
  var _totalSlots = 6;     // Always 6: 5 top cards + 1 action slot
  var _resizeDebounce = null;
  var _lastSig = null;      // Signature-based change detection
  // Default to 'items' so new players see their inventory items in the left column.
  // The swapper button (slot 5) shows "DECK" label, allowing savvy players to toggle to cards.
  // This primes new players to notice their first item pickup appearing.
  var _slot5Mode = 'items'; // 'backup' | 'items' (swapper toggle in NCH)

  // ── Init ──────────────────────────────────────────────────

  function init() {
    if (_container) return;

    _container = document.createElement('div');
    _container.id = 'backup-action-container';
    _container.className = 'backup-action-container';
    _container.style.display = 'none';

    document.body.appendChild(_container);
    _render();

    // Orientation/resize: re-render for abbreviation
    window.addEventListener('resize', function() {
      if (_resizeDebounce) clearTimeout(_resizeDebounce);
      _resizeDebounce = setTimeout(function() {
        _resizeDebounce = null;
        if (_isVisible) _render();
      }, 120);
    });

    // Subscribe to CardStateAuthority events for auto-re-render
    if (typeof CardStateAuthority !== 'undefined') {
      CardStateAuthority.on('backup:changed', function() { if (_isVisible) { _lastSig = null; _render(); } });
      CardStateAuthority.on('hand:changed', function() { if (_isVisible) { _lastSig = null; _render(); } });
      CardStateAuthority.on('vault:changed', function() { if (_isVisible) { _lastSig = null; _render(); } });
      CardStateAuthority.on('draw:executed', function() { if (_isVisible) { _lastSig = null; _render(); } });
      CardStateAuthority.on('draw:reset', function() { if (_isVisible) { _lastSig = null; _render(); } });
      CardStateAuthority.on('equipped:changed', function() { if (_isVisible) { _lastSig = null; _render(); } });
    }
  }

  // ── Visibility ────────────────────────────────────────────

  function show() {
    if (!_container) init();
    _isVisible = true;
    _container.style.display = 'flex';
    _render();
  }

  function hide() {
    if (!_container) return;
    _isVisible = false;
    _container.style.display = 'none';
  }

  function isVisible() {
    return _isVisible;
  }

  // ── Mode Detection ────────────────────────────────────────

  function _isCombat() {
    if (typeof CardStateAuthority !== 'undefined') return CardStateAuthority.isCombat();
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isStrCombatActive === 'function') return GoneRogue.isStrCombatActive();
    return false;
  }

  // ── Card Data (reads from CardStateAuthority) ─────────────

  function _getTopCards() {
    if (typeof CardStateAuthority !== 'undefined') {
      return CardStateAuthority.getBackupTop(5);
    }
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getBackupCards === 'function') {
      var b = GAMESTATE.getBackupCards();
      return Array.isArray(b) ? b.slice(0, 5) : [];
    }
    return [];
  }

  /**
   * Returns item/vault inventory cards for slots 0-4 when swapper is in 'items' mode.
   * These are the account-level persistent cards (shared across platforms).
   */
  function _getItemCards() {
    if (typeof CardStateAuthority !== 'undefined') {
      return CardStateAuthority.getVault().slice(0, 5);
    }
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getPersistentCards === 'function') {
      var v = GAMESTATE.getPersistentCards();
      return Array.isArray(v) ? v.slice(0, 5) : [];
    }
    return [];
  }

  /**
   * Returns the cards to display in slots 0-4 based on current swapper mode.
   * - 'backup': top 5 from backup deck
   * - 'items': first 5 from account vault/inventory
   */
  function _getSlotCards() {
    if (_isCombat()) return _getTopCards(); // Always backup in combat
    return (_slot5Mode === 'items') ? _getItemCards() : _getTopCards();
  }

  function _getCardDef(cardId) {
    if (typeof CardStateAuthority !== 'undefined') return CardStateAuthority.getCardDef(cardId);
    if (typeof GoneRogueDataRegistry !== 'undefined' && typeof GoneRogueDataRegistry.getCard === 'function') {
      return GoneRogueDataRegistry.getCard(cardId);
    }
    return null;
  }

  /**
   * Returns the draw ghost emoji based on equipped item modifier.
   * Default: 🃏 (joker), True Joker: card's own emoji, Magnifying Glass: 🔍
   */
  function _getDrawGhostEmoji(cardDef, modifier) {
    if (!modifier) {
      modifier = (typeof CardStateAuthority !== 'undefined') ? CardStateAuthority.getEquippedDrawModifier() : 'default';
    }
    if (modifier === 'magnifying-glass') return '🔍';
    if (modifier === 'true-joker' && cardDef && cardDef.emoji) return cardDef.emoji;
    return '🃏'; // default joker
  }

  // ── Signature for change detection ────────────────────────

  function _buildSig() {
    var slotCards = _getSlotCards();
    var parts = [];
    for (var i = 0; i < slotCards.length; i++) {
      parts.push((slotCards[i].id || '?') + ':' + (slotCards[i].qty || 1));
    }
    parts.push('mode:' + (_isCombat() ? 'combat' : 'gr'));
    parts.push('s5:' + _slot5Mode);
    parts.push('src:' + (_slot5Mode === 'items' ? 'vault' : 'backup'));
    if (_isCombat() && typeof CardStateAuthority !== 'undefined') {
      parts.push('dr:' + CardStateAuthority.getTurnDrawsRemaining());
      parts.push('mod:' + CardStateAuthority.getEquippedDrawModifier());
    }
    return parts.join('|');
  }

  // ── Render ────────────────────────────────────────────────

  function _render() {
    if (!_container) return;

    // Signature-based skip to prevent churn
    var sig = _buildSig();
    if (sig === _lastSig) return;
    _lastSig = sig;

    _container.innerHTML = '';

    var slotCards = _getSlotCards();
    var inCombat = _isCombat();
    var source = (inCombat || _slot5Mode === 'backup') ? 'backup' : 'items';

    // Slots 0-4: cards from active source (backup deck top OR item vault)
    for (var i = 0; i < 5; i++) {
      var slot = _createCardSlot(i, slotCards[i] || null, inCombat, source);
      _container.appendChild(slot);
    }

    // Slot 5: mode-dependent action button
    var actionSlot = _createActionSlot(inCombat);
    _container.appendChild(actionSlot);
  }

  // ── Card Slot (0-4) ───────────────────────────────────────

  function _createCardSlot(index, cardRef, inCombat, source) {
    source = source || 'backup';
    var slot = document.createElement('div');
    slot.className = 'backup-slot';
    slot.dataset.slotIndex = String(index);
    slot.dataset.source = source;

    if (!cardRef) {
      slot.classList.add('backup-slot-empty');
      slot.textContent = (source === 'items') ? '—' : '+';
      return slot;
    }

    slot.classList.add('backup-slot-filled');
    if (source === 'items') slot.classList.add('backup-slot-item');

    var def = _getCardDef(cardRef.id) || {};
    var name = def.name || cardRef.id || (source === 'items' ? 'Item' : 'Backup');
    var emoji = def.emoji || '🃏';

    // Abbreviation for mobile portrait
    var maxLen = 0;
    try {
      var isPortrait = (window.innerHeight > window.innerWidth);
      if (isPortrait && inCombat) maxLen = 4;
    } catch (e) {}

    if (typeof NameUtils !== 'undefined' && NameUtils.getDisplayName) {
      name = NameUtils.getDisplayName(def, { maxLength: maxLen });
    } else if (maxLen > 0) {
      name = name.substring(0, maxLen);
    }

    var typeIcon = (source === 'items') ? '🎒' :
      (def.type && ('' + def.type).toLowerCase().indexOf('attack') !== -1) ? '⚔️' : '⚡';

    if (inCombat) {
      // Combat: 60×84 thumbnail with cost pip
      slot.classList.add('backup-slot-combat-thumb');
      var costStr = '';
      if (Array.isArray(def.costs) && def.costs.length) {
        costStr = '<div class="backup-thumb-cost">' + def.costs[0].amount + '</div>';
      }
      slot.innerHTML =
        '<div class="backup-thumb-emoji">' + emoji + '</div>' +
        '<div class="backup-thumb-name">' + name + '</div>' +
        costStr;
    } else {
      // NCH: full button with meta
      slot.innerHTML =
        '<div class="backup-card-emoji">' + emoji + '</div>' +
        '<div class="backup-card-meta">' +
          '<div class="backup-card-name">' + name + '</div>' +
          '<div class="backup-card-type">' + typeIcon + '</div>' +
        '</div>';
    }

    // Click/touch handlers
    slot.addEventListener('click', function(e) { _onCardSlotClick(e, index, inCombat, source); });
    slot.addEventListener('touchend', function(e) { e.preventDefault(); _onCardSlotClick(e, index, inCombat, source); });

    // Drag handler
    if (inCombat) {
      _attachCombatDragHandlers(slot, index, cardRef, def);
    } else {
      _attachNCHDragHandlers(slot, index, cardRef, def, source);
    }

    return slot;
  }

  // ── Action Slot (slot 5) ──────────────────────────────────

  function _createActionSlot(inCombat) {
    var slot = document.createElement('div');
    slot.className = 'backup-slot backup-slot-action';
    slot.dataset.slotIndex = '5';

    if (inCombat) {
      // STR-Combat: drawx[N] button
      var drawsLeft = 0;
      var modifier = 'default';
      if (typeof CardStateAuthority !== 'undefined') {
        drawsLeft = CardStateAuthority.getTurnDrawsRemaining();
        modifier = CardStateAuthority.getEquippedDrawModifier();
      }

      slot.classList.add('backup-slot-draw');
      if (drawsLeft > 0) {
        slot.classList.add('backup-slot-draw-active');
      } else {
        slot.classList.add('backup-slot-draw-spent');
      }

      var label = 'DRAW';
      if (drawsLeft > 1) label = 'DRAW x' + drawsLeft;
      if (drawsLeft <= 0) label = 'DRAWN';

      var modIcon = '';
      if (modifier === 'true-joker') modIcon = ' 🃏';
      if (modifier === 'magnifying-glass') modIcon = ' 🔍';

      slot.innerHTML =
        '<div class="backup-draw-label">' + label + modIcon + '</div>';

      slot.addEventListener('click', function(e) { _onDrawButtonClick(e); });
      slot.addEventListener('touchend', function(e) { e.preventDefault(); _onDrawButtonClick(e); });

    } else {
      // NCH: inventory/backup swapper button
      slot.classList.add('backup-slot-swapper');
      var icon = (_slot5Mode === 'backup') ? '🎴' : '🎒';
      var swapLabel = (_slot5Mode === 'backup') ? 'ITEMS' : 'DECK';

      slot.innerHTML =
        '<div class="backup-swap-icon">' + icon + '</div>' +
        '<div class="backup-swap-label">' + swapLabel + '</div>';

      slot.addEventListener('click', function(e) { _onSwapperClick(e); });
      slot.addEventListener('touchend', function(e) { e.preventDefault(); _onSwapperClick(e); });
    }

    return slot;
  }

  // ── Click Handlers ────────────────────────────────────────

  function _onCardSlotClick(e, index, inCombat, source) {
    source = source || 'backup';

    if (inCombat) {
      // Combat: clicking a card slot draws it (if draws remain)
      if (typeof CardStateAuthority !== 'undefined') {
        var modifier = CardStateAuthority.getEquippedDrawModifier();
        if (modifier === 'magnifying-glass') {
          var success = CardStateAuthority.drawFromBackup(index, 'pick');
          if (success) { _notifyDraw('exact pick', index); }
          else { _notifyError('Cannot draw — no draws remaining or invalid'); }
        } else {
          var success2 = CardStateAuthority.drawFromBackup(index, 'pick');
          if (success2) { _notifyDraw('picked', index); }
          else { _notifyError('Cannot draw — no draws remaining'); }
        }
      }
    } else if (source === 'items') {
      // NCH items mode: move vault card to hand (seamless transfer)
      if (typeof CardTransferManager !== 'undefined') {
        var vault = (typeof CardStateAuthority !== 'undefined') ? CardStateAuthority.getVault() : [];
        if (index < vault.length && vault[index]) {
          var ok = CardTransferManager.vaultToHand(vault[index].id, 1);
          if (ok) { _notify('🎒 Item card → hand'); }
          else { _notifyError('Hand is full'); }
        }
      } else if (typeof CardStateAuthority !== 'undefined') {
        var vault2 = CardStateAuthority.getVault();
        if (index < vault2.length && vault2[index]) {
          var ok2 = CardStateAuthority.moveVaultToHand(vault2[index].id, 1);
          if (ok2) { _notify('🎒 Item card → hand'); }
          else { _notifyError('Hand is full'); }
        }
      }
    } else {
      // NCH backup mode: move backup card to hand (seamless transfer)
      if (typeof CardTransferManager !== 'undefined') {
        var moved = CardTransferManager.backupToHand(index);
        if (moved) { _notify('🎴 Backup card → hand'); }
        else { _notifyError('Hand is full'); }
      } else if (typeof CardStateAuthority !== 'undefined') {
        var moved2 = CardStateAuthority.moveBackupToHand(index);
        if (moved2) { _notify('🎴 Backup card → hand'); }
        else { _notifyError('Hand is full'); }
      }
    }
  }

  function _onDrawButtonClick(e) {
    if (!_isCombat()) return;
    if (typeof CardStateAuthority === 'undefined') return;

    var modifier = CardStateAuthority.getEquippedDrawModifier();

    if (modifier === 'magnifying-glass') {
      // Draw button with magnifying glass: search for true joker in full deck
      var success = CardStateAuthority.drawFromBackup(0, 'button');
      if (success) {
        _notifyDraw('joker search', -1);
      } else {
        _notifyError('No true joker found in deck');
      }
    } else if (modifier === 'true-joker') {
      // True joker equipped: open full deck picker (TODO: overlay in Phase 2)
      // For now, draw from top (index 0) as default
      var success2 = CardStateAuthority.drawFromBackup(0, 'button');
      if (success2) {
        _notifyDraw('from full deck', 0);
      } else {
        _notifyError('Cannot draw — no draws remaining');
      }
    } else {
      // Default: draw any one of visible top 5 (draw button picks index 0)
      var success3 = CardStateAuthority.drawFromBackup(0, 'button');
      if (success3) {
        _notifyDraw('default', 0);
      } else {
        _notifyError('Cannot draw — no draws remaining');
      }
    }
  }

  function _onSwapperClick(e) {
    // Toggle between backup deck view and items inventory view
    _slot5Mode = (_slot5Mode === 'backup') ? 'items' : 'backup';
    _lastSig = null; // Force re-render
    _render();

    if (typeof NonCombatEventBus !== 'undefined') {
      NonCombatEventBus.emit('slot6:swap', { mode: _slot5Mode });
    }
  }

  // ── Drag Handlers (Combat) ────────────────────────────────

  function _attachCombatDragHandlers(slot, index, cardRef, def) {
    // Combat: drag from slot creates ghost with item-specific emoji
    var _ghostEl = null;

    slot.addEventListener('pointerdown', function(e) {
      if (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.getTurnDrawsRemaining() <= 0) return;

      // Item-specific ghost emoji
      var modifier = (typeof CardStateAuthority !== 'undefined') ? CardStateAuthority.getEquippedDrawModifier() : 'default';
      var ghostEmoji = _getDrawGhostEmoji(def, modifier);

      _ghostEl = document.createElement('div');
      _ghostEl.className = 'backup-drag-ghost backup-drag-ghost-' + modifier;
      _ghostEl.innerHTML = '<div class="backup-ghost-emoji">' + ghostEmoji + '</div>';
      _ghostEl.style.position = 'fixed';
      _ghostEl.style.width = '60px';
      _ghostEl.style.height = '84px';
      _ghostEl.style.pointerEvents = 'none';
      _ghostEl.style.zIndex = '99999';
      _ghostEl.style.opacity = '0.85';
      _ghostEl.style.left = (e.clientX - 30) + 'px';
      _ghostEl.style.top = (e.clientY - 42) + 'px';
      document.body.appendChild(_ghostEl);

      function onMove(ev) {
        if (_ghostEl) {
          _ghostEl.style.left = (ev.clientX - 30) + 'px';
          _ghostEl.style.top = (ev.clientY - 42) + 'px';
        }
      }
      function onUp(ev) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (_ghostEl) {
          _ghostEl.remove();
          _ghostEl = null;
        }
        // Check if dropped on hand fan
        var dropTarget = document.elementFromPoint(ev.clientX, ev.clientY);
        if (dropTarget && _isHandFanElement(dropTarget)) {
          if (typeof CardStateAuthority !== 'undefined') {
            CardStateAuthority.drawFromBackup(index, 'pick');
            _notifyDraw('drag-to-hand', index);
          }
        }
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  // ── Drag Handlers (NCH) ───────────────────────────────────

  function _attachNCHDragHandlers(slot, index, cardRef, def, source) {
    source = source || 'backup';

    // Pointer-based drag for seamless transfer to NCH hand/backup/map
    var _ghostEl = null;
    var _startX = 0;
    var _startY = 0;
    var _dragging = false;

    slot.addEventListener('pointerdown', function(e) {
      if (e.button !== undefined && e.button !== 0) return;
      _startX = e.clientX;
      _startY = e.clientY;
      _dragging = false;

      function onMove(ev) {
        var dx = ev.clientX - _startX;
        var dy = ev.clientY - _startY;
        if (!_dragging && Math.sqrt(dx * dx + dy * dy) > 6) {
          _dragging = true;
          _ghostEl = document.createElement('div');
          _ghostEl.className = 'backup-drag-ghost';
          _ghostEl.innerHTML = '<div class="backup-ghost-emoji">' + (def.emoji || '🃏') + '</div>';
          _ghostEl.style.cssText = 'position:fixed;width:48px;height:64px;pointer-events:none;z-index:99999;opacity:0.85;';
          _ghostEl.style.left = (ev.clientX - 24) + 'px';
          _ghostEl.style.top = (ev.clientY - 32) + 'px';
          document.body.appendChild(_ghostEl);

          // Notify CardTransferManager
          if (typeof CardTransferManager !== 'undefined') {
            CardTransferManager.startDrag({
              source: source === 'items' ? 'vault' : 'backup',
              index: index,
              cardId: cardRef.id,
              cardRef: cardRef,
              ghostEl: _ghostEl
            });
          }
        }
        if (_dragging && _ghostEl) {
          _ghostEl.style.left = (ev.clientX - 24) + 'px';
          _ghostEl.style.top = (ev.clientY - 32) + 'px';
        }
      }

      function onUp(ev) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (_ghostEl) {
          _ghostEl.remove();
          _ghostEl = null;
        }
        if (!_dragging) return;

        var dropTarget = document.elementFromPoint(ev.clientX, ev.clientY);

        // Drop on equip slot → equip item (items source only)
        if (dropTarget && source === 'items' && _isEquipSlotElement(dropTarget)) {
          if (typeof CardTransferManager !== 'undefined') {
            CardTransferManager.equipFromVault(cardRef.id);
          } else if (typeof CardStateAuthority !== 'undefined') {
            CardStateAuthority.equipItemFromVault(cardRef.id);
          }
          _notify('🎒 Item → equipped');
          if (typeof CardTransferManager !== 'undefined') CardTransferManager.cancelDrag();
          return;
        }

        // Drop on hand fan → transfer to hand
        if (dropTarget && _isHandFanElement(dropTarget)) {
          if (source === 'items') {
            if (typeof CardTransferManager !== 'undefined') {
              CardTransferManager.vaultToHand(cardRef.id, 1);
            } else if (typeof CardStateAuthority !== 'undefined') {
              CardStateAuthority.moveVaultToHand(cardRef.id, 1);
            }
            _notify('🎒 Item → hand');
          } else {
            if (typeof CardTransferManager !== 'undefined') {
              CardTransferManager.backupToHand(index);
            } else if (typeof CardStateAuthority !== 'undefined') {
              CardStateAuthority.moveBackupToHand(index);
            }
            _notify('🎴 Backup → hand');
          }
          if (typeof CardTransferManager !== 'undefined') CardTransferManager.cancelDrag();
          return;
        }

        // Drop on NCH expanded zones → delegate to NCH drop handling
        if (dropTarget && dropTarget.closest) {
          var equipZone = dropTarget.closest('[data-dropzone="equip"]');
          var backupZone = dropTarget.closest('[data-dropzone="backup"]');
          var handZone = dropTarget.closest('[data-dropzone="hand"]');
          var vaultZone = dropTarget.closest('[data-dropzone="vault"]');

          if (equipZone && source === 'items') {
            // Item → equip slot
            if (typeof CardTransferManager !== 'undefined') CardTransferManager.equipFromVault(cardRef.id);
            else if (typeof CardStateAuthority !== 'undefined') CardStateAuthority.equipItemFromVault(cardRef.id);
            _notify('🎒 Item → equipped');
          } else if (handZone) {
            // Same as hand fan drop
            if (source === 'items') {
              if (typeof CardTransferManager !== 'undefined') CardTransferManager.vaultToHand(cardRef.id, 1);
              else if (typeof CardStateAuthority !== 'undefined') CardStateAuthority.moveVaultToHand(cardRef.id, 1);
              _notify('🎒 Item → hand');
            } else {
              if (typeof CardTransferManager !== 'undefined') CardTransferManager.backupToHand(index);
              else if (typeof CardStateAuthority !== 'undefined') CardStateAuthority.moveBackupToHand(index);
              _notify('🎴 Backup → hand');
            }
          } else if (backupZone && source === 'items') {
            // Item → backup deck
            if (typeof CardTransferManager !== 'undefined') CardTransferManager.vaultToBackup(cardRef.id);
            else if (typeof CardStateAuthority !== 'undefined') CardStateAuthority.moveVaultToBackup(cardRef.id);
            _notify('🎒 Item → backup deck');
          } else if (vaultZone && source === 'backup') {
            // Backup → vault
            if (typeof CardTransferManager !== 'undefined') CardTransferManager.backupToVault(index);
            else if (typeof CardStateAuthority !== 'undefined') CardStateAuthority.moveBackupToVault(index);
            _notify('🎴 Backup → vault');
          }
        }

        if (typeof CardTransferManager !== 'undefined') {
          CardTransferManager.cancelDrag();
        }
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  // ── Helpers ───────────────────────────────────────────────

  function _isHandFanElement(el) {
    while (el) {
      if (el.classList && (el.classList.contains('hand-fan-container') || el.classList.contains('hand-card'))) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  /**
   * Check if element is an equip item slot in the website header.
   */
  function _isEquipSlotElement(el) {
    while (el) {
      if (el.classList && (el.classList.contains('equipped-item-slot') || el.classList.contains('header-item-slot'))) {
        return true;
      }
      if (el.dataset && el.dataset.dropzone === 'equip') return true;
      el = el.parentElement;
    }
    return false;
  }

  function _notify(msg) {
    if (typeof TooltipSystem !== 'undefined' && typeof TooltipSystem.showPersistent === 'function') {
      TooltipSystem.showPersistent(msg, 1200);
    }
  }

  function _notifyDraw(type, index) {
    _notify('📥 Drew card (' + type + ')');
  }

  function _notifyError(msg) {
    _notify('⛔ ' + msg);
  }

  // ── Legacy Compat API ─────────────────────────────────────

  function resetForCombat() {
    _lastSig = null;
    _render();
  }

  function getCards() {
    return _getTopCards();
  }

  function setSlots() {
    // No-op: always 6 slots now
  }

  function drawCardForRound() {
    // No-op: draw is now handled through CardStateAuthority.drawFromBackup()
    return false;
  }

  // ── Auto-init ─────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init: init,
    show: show,
    hide: hide,
    isVisible: isVisible,
    setSlots: setSlots,
    resetForCombat: resetForCombat,
    drawCardForRound: drawCardForRound,
    getCards: getCards,
    render: _render
  };
})();
