/* ============================================================
   Enemy Card Interactability Engine — Phase 3.2 of ENEMY_CARDS.md
   Pure-function module. No DOM. No side effects.

   Determines which enemy cards the player can interact with
   based on equipped items, played cards, and passive effects.

   Usage:
     var result = EnemyCardInteractability.compute(enemyCards, playerState);
     // result: [{ index, canReveal, canSteal, canDestroy, primaryAction }]

     EnemyCardInteractability.autoReveal(enemyCards, playerState);
     // returns: array of indices to auto-reveal at combat start
   ============================================================ */

var EnemyCardInteractability = (function() {
  'use strict';

  // ── Tag intersection helper ───────────────────────────────

  /**
   * Check if two tag arrays share at least one common tag.
   * @param {Array} tagsA
   * @param {Array} tagsB
   * @returns {boolean}
   */
  function _tagsOverlap(tagsA, tagsB) {
    if (!Array.isArray(tagsA) || !Array.isArray(tagsB)) return false;
    for (var i = 0; i < tagsA.length; i++) {
      if (tagsB.indexOf(tagsA[i]) !== -1) return true;
    }
    return false;
  }

  /**
   * Resolve the card definition for an enemy card slot.
   * Uses cached _def if available, falls back to registry lookup.
   * @param {Object} card - Enemy card slot { cardId, _def, ... }
   * @returns {Object|null} Card definition with tags
   */
  function _resolveCardDef(card) {
    if (card._def && !card._def._missing) return card._def;
    if (!card.cardId) return null;
    if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getEnemyCard) {
      try {
        var def = GoneRogueDataRegistry.getEnemyCard(card.cardId);
        if (def && !def._missing) return def;
      } catch (e) {}
    }
    return null;
  }

  /**
   * Get all tags for an enemy card (merges tags + synergyTags from definition).
   * @param {Object} cardDef - Enemy card definition
   * @returns {Array} Combined tags
   */
  function _getCardTags(cardDef) {
    if (!cardDef) return [];
    var tags = [];
    if (Array.isArray(cardDef.tags)) tags = tags.concat(cardDef.tags);
    if (Array.isArray(cardDef.synergyTags)) tags = tags.concat(cardDef.synergyTags);
    return tags;
  }

  // ── Core computation ──────────────────────────────────────

  /**
   * Compute interactability for each enemy card.
   *
   * @param {Array} enemyCards - From EnemyHandDisplay.getEnemyCards()
   *   Each: { index, cardId, hidden, destroyed, _def }
   *
   * @param {Object} playerState
   *   { equippedItem: { id, stealTags?, revealTags?, destroyTags? } | null,
   *     playedThisTurn: [{ id, synergyTags }],
   *     passiveItems: [{ id, effects }],
   *     exposedTags: [] }  ← from enemy.exposedTags (deck-level steal exposure)
   *
   * @returns {Array} [{ index, canReveal, canSteal, canDestroy, primaryAction }]
   *   primaryAction: 'reveal' | 'steal' | 'destroy' | null
   */
  function compute(enemyCards, playerState) {
    if (!Array.isArray(enemyCards) || !playerState) return [];

    var equipped = playerState.equippedItem || {};
    var played = Array.isArray(playerState.playedThisTurn) ? playerState.playedThisTurn : [];
    var exposedTags = Array.isArray(playerState.exposedTags) ? playerState.exposedTags : [];

    // Pre-compute: did player play a Sabotage-tagged card this turn?
    var playedSabotage = false;
    for (var p = 0; p < played.length; p++) {
      var pTags = played[p].synergyTags || [];
      if (pTags.indexOf('sabotage') !== -1) {
        playedSabotage = true;
        break;
      }
    }

    var results = [];

    for (var i = 0; i < enemyCards.length; i++) {
      var card = enemyCards[i];
      var result = {
        index: card.index !== undefined ? card.index : i,
        canReveal: false,
        canSteal: false,
        canDestroy: false,
        primaryAction: null
      };

      // Skip destroyed/stolen cards
      if (card.destroyed) {
        results.push(result);
        continue;
      }

      // Already revealed — no interaction needed (Phase 4 may add re-steal from revealed)
      if (!card.hidden) {
        results.push(result);
        continue;
      }

      var cardDef = _resolveCardDef(card);
      var cardTags = _getCardTags(cardDef);

      // ── REVEAL check ──
      // Item with revealTags that overlaps card's tags
      if (Array.isArray(equipped.revealTags) && equipped.revealTags.length > 0) {
        if (cardTags.length === 0 || _tagsOverlap(equipped.revealTags, cardTags)) {
          result.canReveal = true;
        }
      }

      // ── STEAL check ──
      // Item with stealTags that overlaps enemy's exposedTags (deck-level)
      if (Array.isArray(equipped.stealTags) && equipped.stealTags.length > 0) {
        if (_tagsOverlap(equipped.stealTags, exposedTags)) {
          result.canSteal = true;
        }
      }

      // ── DESTROY check ──
      // Item with destroyTags that overlaps card's tags
      if (Array.isArray(equipped.destroyTags) && equipped.destroyTags.length > 0) {
        if (cardTags.length === 0 || _tagsOverlap(equipped.destroyTags, cardTags)) {
          result.canDestroy = true;
        }
      }
      // Also: Sabotage card played this turn enables destroy on all
      if (playedSabotage) {
        result.canDestroy = true;
      }

      // ── Primary action (highest priority) ──
      // Steal > Destroy > Reveal (steal is most valuable, reveal is least)
      if (result.canSteal)       result.primaryAction = 'steal';
      else if (result.canDestroy) result.primaryAction = 'destroy';
      else if (result.canReveal)  result.primaryAction = 'reveal';

      results.push(result);
    }

    return results;
  }

  // ── Auto-reveal at combat start ───────────────────────────

  /**
   * Determine which enemy cards should auto-reveal at combat start.
   * Triggered by passive items like Wire Tap.
   *
   * @param {Array} enemyCards - Enemy card slots
   * @param {Object} playerState - { passiveItems: [...] }
   * @returns {Array<number>} Indices of cards to reveal
   */
  function autoReveal(enemyCards, playerState) {
    if (!Array.isArray(enemyCards) || !playerState) return [];

    var passives = Array.isArray(playerState.passiveItems) ? playerState.passiveItems : [];
    var revealCount = 0;

    // Check passive items for auto_reveal effects
    for (var i = 0; i < passives.length; i++) {
      var effects = passives[i].effects || [];
      for (var j = 0; j < effects.length; j++) {
        if (effects[j].type === 'auto_reveal' && effects[j].trigger === 'combat_start') {
          revealCount += (effects[j].count || 1);
        }
      }
    }

    if (revealCount <= 0) return [];

    // Collect indices of hidden, non-destroyed cards
    var hiddenIndices = [];
    for (var k = 0; k < enemyCards.length; k++) {
      if (enemyCards[k].hidden && !enemyCards[k].destroyed) {
        hiddenIndices.push(enemyCards[k].index !== undefined ? enemyCards[k].index : k);
      }
    }

    // Randomly select up to revealCount
    var toReveal = [];
    var pool = hiddenIndices.slice();
    for (var r = 0; r < revealCount && pool.length > 0; r++) {
      var idx = Math.floor(Math.random() * pool.length);
      toReveal.push(pool[idx]);
      pool.splice(idx, 1);
    }

    return toReveal;
  }

  // ── Public API ────────────────────────────────────────────

  return {
    compute: compute,
    autoReveal: autoReveal
  };

})();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnemyCardInteractability;
}
