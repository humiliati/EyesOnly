/**
 * EnemyHandDisplay — Shows enemy cards in backup scroll space during STR-combat.
 *
 * During combat, the backup scroll area is repurposed to display the enemy's hand.
 * Cards appear as hidden "back of the card" joker emojis by default.
 * Items can reveal, steal, or destroy enemy cards.
 *
 * Roadmap ref: Phase 1.5
 */
var EnemyHandDisplay = (function() {
  'use strict';

  var _container = null;
  var _isVisible = false;
  var _enemyCards = [];  // Array of { id, hidden: bool, emoji, name }
  var _lastSig = '';

  // ── Init ──────────────────────────────────────────────────

  function init(parentElement) {
    if (_container) return;

    _container = document.createElement('div');
    _container.id = 'enemy-hand-display';
    _container.className = 'enemy-hand-display';
    _container.style.display = 'none';

    if (parentElement) {
      parentElement.appendChild(_container);
    } else {
      document.body.appendChild(_container);
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

  // ── Update from combat state ──────────────────────────────

  /**
   * Update enemy hand from combat state.
   * @param {Object} combatState - from GoneRogue.getStrCombatState()
   */
  function updateFromCombatState(combatState) {
    if (!combatState || !combatState.enemy) {
      _enemyCards = [];
      if (_isVisible) _render();
      return;
    }

    var cardCount = combatState.enemy.cardCount || combatState.enemy.attackCount || 0;

    // Build enemy card array
    var newCards = [];
    for (var i = 0; i < cardCount; i++) {
      // Preserve revealed state from existing cards
      var existing = _enemyCards[i];
      newCards.push({
        index: i,
        hidden: existing ? existing.hidden : true,
        emoji: existing && !existing.hidden ? (existing.emoji || '❓') : '🃏',
        name: existing && !existing.hidden ? (existing.name || 'Enemy Card') : '???',
        destroyed: existing ? !!existing.destroyed : false
      });
    }

    _enemyCards = newCards;
    if (_isVisible) _render();
  }

  // ── Item interactions ─────────────────────────────────────

  /**
   * Reveal an enemy card (e.g. from Magnifying Glass or Scout item).
   * @param {number} index
   * @param {Object} cardInfo - { emoji, name, type }
   */
  function revealCard(index, cardInfo) {
    if (index < 0 || index >= _enemyCards.length) return;
    _enemyCards[index].hidden = false;
    _enemyCards[index].emoji = (cardInfo && cardInfo.emoji) || '❓';
    _enemyCards[index].name = (cardInfo && cardInfo.name) || 'Enemy Card';
    _render();

    if (typeof NonCombatEventBus !== 'undefined') {
      NonCombatEventBus.emit('enemy-card:revealed', { index: index, card: _enemyCards[index] });
    }
  }

  /**
   * Steal an enemy card (move to player hand).
   * @param {number} index
   * @returns {Object|null} the stolen card info
   */
  function stealCard(index) {
    if (index < 0 || index >= _enemyCards.length) return null;
    var card = _enemyCards[index];
    if (card.destroyed) return null;

    // Mark as destroyed (stolen)
    _enemyCards[index].destroyed = true;
    _render();

    if (typeof NonCombatEventBus !== 'undefined') {
      NonCombatEventBus.emit('enemy-card:stolen', { index: index, card: card });
    }

    return card;
  }

  /**
   * Destroy an enemy card (remove without gaining it).
   * @param {number} index
   */
  function destroyCard(index) {
    if (index < 0 || index >= _enemyCards.length) return;
    _enemyCards[index].destroyed = true;
    _render();

    if (typeof NonCombatEventBus !== 'undefined') {
      NonCombatEventBus.emit('enemy-card:destroyed', { index: index });
    }
  }

  // ── Render ────────────────────────────────────────────────

  function _render() {
    if (!_container) return;

    var sig = _enemyCards.map(function(c) {
      return (c.hidden ? 'H' : 'R') + (c.destroyed ? 'D' : '') + c.index;
    }).join('|');
    if (sig === _lastSig) return;
    _lastSig = sig;

    _container.innerHTML = '';

    if (_enemyCards.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'enemy-hand-empty';
      empty.textContent = 'No enemy cards';
      _container.appendChild(empty);
      return;
    }

    var label = document.createElement('div');
    label.className = 'enemy-hand-label';
    label.textContent = 'ENEMY HAND (' + _enemyCards.filter(function(c) { return !c.destroyed; }).length + ')';
    _container.appendChild(label);

    for (var i = 0; i < _enemyCards.length; i++) {
      var card = _enemyCards[i];
      var el = document.createElement('div');
      el.className = 'enemy-card-slot';
      el.dataset.enemyCardIndex = String(i);

      if (card.destroyed) {
        el.classList.add('enemy-card-destroyed');
        el.innerHTML = '<span class="enemy-card-glyph">💀</span>';
      } else if (card.hidden) {
        el.classList.add('enemy-card-hidden');
        el.innerHTML = '<span class="enemy-card-glyph">🃏</span>';
      } else {
        el.classList.add('enemy-card-revealed');
        el.innerHTML =
          '<span class="enemy-card-glyph">' + card.emoji + '</span>' +
          '<span class="enemy-card-name">' + card.name + '</span>';
      }

      _container.appendChild(el);
    }
  }

  // ── Public API ────────────────────────────────────────────

  return {
    init: init,
    show: show,
    hide: hide,
    isVisible: isVisible,
    updateFromCombatState: updateFromCombatState,
    revealCard: revealCard,
    stealCard: stealCard,
    destroyCard: destroyCard,
    getEnemyCards: function() { return _enemyCards.slice(); }
  };

})();
