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
  var _slot5Mode = 'backup'; // 'backup' | 'items' (swapper toggle in NCH)

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
      CardStateAuthority.on('backup:changed', function() { if (_isVisible) _render(); });
      CardStateAuthority.on('hand:changed', function() { if (_isVisible) _render(); });
      CardStateAuthority.on('draw:executed', function() { if (_isVisible) _render(); });
      CardStateAuthority.on('draw:reset', function() { if (_isVisible) _render(); });
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
    // Legacy fallback
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getBackupCards === 'function') {
      var b = GAMESTATE.getBackupCards();
      return Array.isArray(b) ? b.slice(0, 5) : [];
    }
    return [];
  }

  function _getCardDef(cardId) {
    if (typeof CardStateAuthority !== 'undefined') return CardStateAuthority.getCardDef(cardId);
    if (typeof GoneRogueDataRegistry !== 'undefined' && typeof GoneRogueDataRegistry.getCard === 'function') {
      return GoneRogueDataRegistry.getCard(cardId);
    }
    return null;
  }

  // ── Signature for change detection ────────────────────────

  function _buildSig() {
    var top = _getTopCards();
    var parts = [];
    for (var i = 0; i < top.length; i++) {
      parts.push((top[i].id || '?') + ':' + (top[i].qty || 1));
    }
    parts.push('mode:' + (_isCombat() ? 'combat' : 'gr'));
    parts.push('s5:' + _slot5Mode);
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

    var topCards = _getTopCards();
    var inCombat = _isCombat();

    // Slots 0-4: top 5 backup cards
    for (var i = 0; i < 5; i++) {
      var slot = _createCardSlot(i, topCards[i] || null, inCombat);
      _container.appendChild(slot);
    }

    // Slot 5: mode-dependent action button
    var actionSlot = _createActionSlot(inCombat);
    _container.appendChild(actionSlot);
  }

  // ── Card Slot (0-4) ───────────────────────────────────────

  function _createCardSlot(index, cardRef, inCombat) {
    var slot = document.createElement('div');
    slot.className = 'backup-slot';
    slot.dataset.slotIndex = String(index);

    if (!cardRef) {
      slot.classList.add('backup-slot-empty');
      slot.textContent = '+';
      return slot;
    }

    slot.classList.add('backup-slot-filled');

    var def = _getCardDef(cardRef.id) || {};
    var name = def.name || cardRef.id || 'Backup';
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

    var typeIcon = (def.type && ('' + def.type).toLowerCase().indexOf('attack') !== -1) ? '⚔️' : '⚡';

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
    slot.addEventListener('click', function(e) { _onCardSlotClick(e, index, inCombat); });
    slot.addEventListener('touchend', function(e) { e.preventDefault(); _onCardSlotClick(e, index, inCombat); });

    // Drag handler (NCH: reorder; Combat: draw with ghost)
    if (inCombat) {
      _attachCombatDragHandlers(slot, index, cardRef, def);
    } else {
      _attachNCHDragHandlers(slot, index, cardRef, def);
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

  function _onCardSlotClick(e, index, inCombat) {
    if (inCombat) {
      // Combat: clicking a card slot draws it (if draws remain)
      if (typeof CardStateAuthority !== 'undefined') {
        var modifier = CardStateAuthority.getEquippedDrawModifier();
        if (modifier === 'magnifying-glass') {
          // Exact pick from top 5
          var success = CardStateAuthority.drawFromBackup(index, 'pick');
          if (success) {
            _notifyDraw('exact pick', index);
          } else {
            _notifyError('Cannot draw — no draws remaining or invalid');
          }
        } else {
          // Default + true-joker: any of top 5
          var success2 = CardStateAuthority.drawFromBackup(index, 'pick');
          if (success2) {
            _notifyDraw('picked', index);
          } else {
            _notifyError('Cannot draw — no draws remaining');
          }
        }
      }
    } else {
      // NCH: move this backup card to hand
      if (typeof CardStateAuthority !== 'undefined') {
        var moved = CardStateAuthority.moveBackupToHand(index);
        if (moved) {
          _notify('➕ Backup card moved to hand');
        } else {
          _notifyError('Hand is full');
        }
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
    // Combat: drag from slot creates 60×84 thumbnail ghost for hand fan drop
    var _ghostEl = null;

    slot.addEventListener('pointerdown', function(e) {
      if (typeof CardStateAuthority !== 'undefined' && CardStateAuthority.getTurnDrawsRemaining() <= 0) return;

      _ghostEl = document.createElement('div');
      _ghostEl.className = 'backup-drag-ghost';
      _ghostEl.innerHTML = '<div class="backup-ghost-emoji">' + (def.emoji || '🃏') + '</div>';
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
          // Execute draw
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

  function _attachNCHDragHandlers(slot, index, cardRef, def) {
    // NCH: drag to reorder backup deck, or drag to hand fan, or drag to map
    // Full implementation in Phase 1.3 (CardTransferManager)
    // For now: basic drop-to-hand
    slot.draggable = true;
    slot.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'backup', index: index, cardId: cardRef.id }));
      e.dataTransfer.effectAllowed = 'move';
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
