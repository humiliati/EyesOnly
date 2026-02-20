/* ============================================================
   EYES ONLY - Backup Action Container
   Extra expendable cards per round ("sloppy play" support)
   ============================================================ */

var BackupActionContainer = (function() {
  'use strict';

  var _container = null;
  var _isVisible = false;
  var _slots = 3;
  var _cards = [];
  var _lastRound = 0;

  function init() {
    if (_container) return;

    _container = document.createElement('div');
    _container.id = 'backup-action-container';
    _container.className = 'backup-action-container';
    _container.style.display = 'none';

    _cards = new Array(_slots).fill(null);

    document.body.appendChild(_container);
    _render();
  }

  function setSlots(count) {
    count = Math.max(2, Math.min(4, Number(count || 3)));
    _slots = count;
    _cards = new Array(_slots).fill(null);
    _render();
  }

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

  function resetForCombat() {
    _cards = new Array(_slots).fill(null);
    _lastRound = 0;
    _render();
  }

  function getCards() {
    return _cards.slice();
  }

  function _render() {
    if (!_container) return;

    _container.innerHTML = '';

    for (var i = 0; i < _slots; i++) {
      var slot = document.createElement('div');
      slot.className = 'backup-slot';
      slot.dataset.slotIndex = String(i);

      var card = _cards[i];
      if (!card) {
        slot.classList.add('backup-slot-empty');
        slot.textContent = '+';
      } else {
        slot.classList.add('backup-slot-filled');

        var name = (card.name || 'Backup');
        var emoji = card.emoji || '🃏';
        var typeIcon = (card.type && ('' + card.type).toLowerCase().indexOf('attack') !== -1) ? '⚔️' : '⚡';

        slot.innerHTML =
          '<div class="backup-card-emoji">' + emoji + '</div>' +
          '<div class="backup-card-meta">' +
            '<div class="backup-card-name">' + name + '</div>' +
            '<div class="backup-card-type">' + typeIcon + '</div>' +
          '</div>';

        // Click: move into hand (safe v1)
        slot.addEventListener('click', _onSlotClick);
        slot.addEventListener('touchend', function(e) {
          e.preventDefault();
          _onSlotClick(e);
        });
      }

      _container.appendChild(slot);
    }
  }

  function _onSlotClick(e) {
    var target = e.currentTarget;
    if (!target) return;

    var idx = Number(target.dataset.slotIndex || -1);
    if (idx < 0 || idx >= _cards.length) return;

    var card = _cards[idx];
    if (!card) return;

    // v1 behavior: move backup card into loose inventory (hand)
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getLooseInventory === 'function') {
      var loose = GAMESTATE.getLooseInventory();
      if (Array.isArray(loose)) {
        loose.push(card);
        _cards[idx] = null;
        _render();

        if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.updateCards === 'function') {
          HandFanComponent.updateCards(loose);
        }

        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.showPersistent('➕ BACKUP DEPLOYED TO HAND: ' + (card.name || 'CARD'), 1400);
        }

        return;
      }
    }

    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent('❌ Cannot move backup card to hand', 1200);
    }
  }

  function _rollExpendableCard() {
    // Keep v1 simple: roll a random base card and mark as consumable.
    if (typeof CardSystem === 'undefined' || typeof CardSystem.rollCard !== 'function') {
      return { name: 'Expendable', emoji: '🃏', lifecycle: 'consumable', type: 'utility' };
    }

    var base = (typeof CardSystem.getRandomBaseCard === 'function') ? CardSystem.getRandomBaseCard() : 'Single Shot';
    var card = CardSystem.rollCard(base) || { name: base };

    // Mark as expendable (consumable) for UI + later rules
    card.lifecycle = card.lifecycle || 'consumable';
    card.lifecycleType = card.lifecycleType || 'consumable';
    card.isBackup = true;
    card.description = (card.description ? (card.description + ' ') : '') + '[BACKUP: expendable]';

    return card;
  }

  function drawCardForRound(roundNumber) {
    roundNumber = Number(roundNumber || 0);
    if (!roundNumber) return false;

    // Only draw once per round
    if (roundNumber === _lastRound) return false;
    _lastRound = roundNumber;

    // Find first empty slot
    var emptyIdx = -1;
    for (var i = 0; i < _cards.length; i++) {
      if (_cards[i] === null) {
        emptyIdx = i;
        break;
      }
    }

    if (emptyIdx === -1) return false;

    _cards[emptyIdx] = _rollExpendableCard();
    _render();

    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent('＋ BACKUP CARD AVAILABLE', 900);
    }

    return true;
  }

  // Auto-init
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
    getCards: getCards
  };
})();
