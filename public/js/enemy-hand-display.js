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
  var _enemyCards = [];  // Array of { index, cardId, hidden, emoji, name, destroyed, _def }
  var _interactability = []; // From EnemyCardInteractability.compute() — [{ index, canReveal, canSteal, canDestroy, primaryAction }]
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

    var enemy = combatState.enemy;
    var deck = Array.isArray(enemy.cardDeck) ? enemy.cardDeck : [];

    // Phase 2: build from real cardDeck (stolen slots show as destroyed)
    // Fallback to generic count if no deck hydrated
    var newCards = [];

    if (deck.length > 0) {
      for (var i = 0; i < deck.length; i++) {
        var slot = deck[i];
        var existing = _enemyCards[i];
        var isStolen = !!(slot && slot.stolen);
        var cardId = (slot && slot.id) ? slot.id : null;

        // Resolve card def for revealed state
        var cardDef = null;
        if (cardId && typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getEnemyCard) {
          try { cardDef = GoneRogueDataRegistry.getEnemyCard(cardId); } catch (e) {}
          if (cardDef && cardDef._missing) cardDef = null;
        }

        newCards.push({
          index: i,
          cardId: cardId,
          hidden: existing ? existing.hidden : true,
          emoji: existing && !existing.hidden ? (existing.emoji || '❓') : '🃏',
          name: existing && !existing.hidden ? (existing.name || 'Enemy Card') : '???',
          destroyed: isStolen || (existing ? !!existing.destroyed : false),
          _def: cardDef  // cached for reveal/steal/destroy
        });
      }
    } else {
      // Legacy fallback: generic count-based
      var cardCount = enemy.cardCount || enemy.attackCount || 0;
      for (var j = 0; j < cardCount; j++) {
        var existingJ = _enemyCards[j];
        newCards.push({
          index: j,
          cardId: null,
          hidden: existingJ ? existingJ.hidden : true,
          emoji: existingJ && !existingJ.hidden ? (existingJ.emoji || '❓') : '🃏',
          name: existingJ && !existingJ.hidden ? (existingJ.name || 'Enemy Card') : '???',
          destroyed: existingJ ? !!existingJ.destroyed : false,
          _def: null
        });
      }
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

    // Build signature that includes interactability state
    var sig = _enemyCards.map(function(c, idx) {
      var ia = _interactability[idx];
      var actionKey = (ia && ia.primaryAction) ? ia.primaryAction[0] : 'n';
      return (c.hidden ? 'H' : 'R') + (c.destroyed ? 'D' : '') + actionKey + c.index;
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
      var ia = _interactability[i] || { canReveal: false, canSteal: false, canDestroy: false, primaryAction: null };
      var el = document.createElement('div');
      el.className = 'enemy-card-slot';
      el.dataset.enemyCardIndex = String(i);

      if (card.destroyed) {
        // ── Destroyed / Stolen ──
        el.classList.add('enemy-card-destroyed');
        el.innerHTML = '<span class="enemy-card-glyph">💀</span>';

      } else if (!card.hidden) {
        // ── Revealed (face-up) ──
        el.classList.add('enemy-card-revealed');
        el.innerHTML =
          '<span class="enemy-card-glyph">' + card.emoji + '</span>' +
          '<span class="enemy-card-name">' + card.name + '</span>';

      } else if (ia.primaryAction) {
        // ── Hidden + Interactable ──
        el.classList.add('enemy-card-interactable');
        el.dataset.action = ia.primaryAction; // CSS uses [data-action] for color tint
        el.innerHTML = '<span class="enemy-card-glyph">🃏</span>';

        // Click → dispatch interaction event (Phase 4 consumes this)
        (function(index, interactInfo) {
          el.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof NonCombatEventBus !== 'undefined') {
              NonCombatEventBus.emit('enemy-card:interact', {
                index: index,
                canReveal: interactInfo.canReveal,
                canSteal: interactInfo.canSteal,
                canDestroy: interactInfo.canDestroy,
                primaryAction: interactInfo.primaryAction
              });
            }
          });
        })(i, ia);

      } else {
        // ── Hidden + Non-interactable (BLVCK) ──
        el.classList.add('enemy-card-blvck');
        el.innerHTML = '<span class="enemy-card-glyph">🃏</span>';
      }

      _container.appendChild(el);
    }
  }

  // ── Interactability ──────────────────────────────────────

  /**
   * Set interactability state for enemy cards.
   * Called by combat integration each round after EnemyCardInteractability.compute().
   * @param {Array} interactArr - [{ index, canReveal, canSteal, canDestroy, primaryAction }]
   */
  function setInteractability(interactArr) {
    _interactability = Array.isArray(interactArr) ? interactArr : [];
    _lastSig = ''; // Force re-render
    if (_isVisible) _render();
  }

  // ── Public API ────────────────────────────────────────────

  return {
    init: init,
    show: show,
    hide: hide,
    isVisible: isVisible,
    updateFromCombatState: updateFromCombatState,
    setInteractability: setInteractability,
    revealCard: revealCard,
    stealCard: stealCard,
    destroyCard: destroyCard,
    getEnemyCards: function() { return _enemyCards.slice(); }
  };

})();
