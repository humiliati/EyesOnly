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

      // ── Phase 5: Two-Stage Pipeline ──
      // Revealed cards become stealable on later turns via InformationDuelEngine
      if (!card.hidden) {
        // Check if this revealed card is now stealable (two-stage pipeline)
        var twoStageSteal = false;
        if (typeof InformationDuelEngine !== 'undefined' && InformationDuelEngine.isRevealedStealable) {
          twoStageSteal = InformationDuelEngine.isRevealedStealable(result.index);
        }

        if (twoStageSteal) {
          // Revealed + stealable: check if player has steal capability
          if (Array.isArray(equipped.stealTags) && equipped.stealTags.length > 0) {
            if (_tagsOverlap(equipped.stealTags, exposedTags)) {
              result.canSteal = true;
              result.primaryAction = 'steal';
            }
          }
        }

        // Also allow destroy on revealed cards (always available if player has means)
        if (Array.isArray(equipped.destroyTags) && equipped.destroyTags.length > 0) {
          var revealedDef = _resolveCardDef(card);
          var revealedTags = _getCardTags(revealedDef);
          if (revealedTags.length === 0 || _tagsOverlap(equipped.destroyTags, revealedTags)) {
            result.canDestroy = true;
            if (!result.primaryAction) result.primaryAction = 'destroy';
          }
        }
        if (playedSabotage) {
          result.canDestroy = true;
          if (!result.primaryAction) result.primaryAction = 'destroy';
        }

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

  // ── Pre-combat capsule interactability ───────────────────

  /**
   * Compute simplified interactability for the map capsule context.
   * Used by enemy-capsule-renderer.js to decide joker visual states
   * (bright/greyed/plantable) during exploration — NOT in combat.
   *
   * @param {Object} enemy - Enemy object with cardDeck[], exposedTags[]
   * @param {Object} playerState
   *   { equippedItem: { id, stealTags?, plantTags?, revealTags?, destroyTags? } | null,
   *     passiveItems: [{ id, effects }] }
   *
   * @returns {Object}
   *   { canSteal: boolean,       — at least one card is stealable
   *     canPlant: boolean,       — at least one slot is plantable
   *     canReveal: boolean,      — equipped item has revealTags
   *     stealableCount: number,  — how many cards are stealable
   *     plantableCount: number,  — how many empty/BLVCK slots accept plants
   *     capsuleState: string }   — 'interactable' | 'plantable_only' | 'greyed' | 'hostile'
   */
  function computePreCombat(enemy, playerState) {
    var result = {
      canSteal: false,
      canPlant: false,
      canReveal: false,
      stealableCount: 0,
      plantableCount: 0,
      capsuleState: 'greyed'
    };

    if (!enemy || !Array.isArray(enemy.cardDeck) || !playerState) return result;

    var equipped = playerState.equippedItem || {};
    var exposedTags = Array.isArray(enemy.exposedTags) ? enemy.exposedTags : [];

    // Enemy awareness check: ENGAGED/ALERTED enemies cannot be interacted with
    var awareness = enemy.awareness || enemy.awarenessState || 'UNAWARE';
    if (awareness === 'ENGAGED' || awareness === 'ALERTED' || awareness === 'COMBAT') {
      result.capsuleState = 'hostile';
      return result;
    }

    // Check steal capability: equipped item stealTags intersect enemy.exposedTags
    var hasStealTool = Array.isArray(equipped.stealTags) && equipped.stealTags.length > 0;
    var stealTagMatch = hasStealTool && _tagsOverlap(equipped.stealTags, exposedTags);

    // Check plant capability: equipped item has plantTags intersecting enemy.exposedTags
    var hasPlantTool = Array.isArray(equipped.plantTags) && equipped.plantTags.length > 0;
    var plantTagMatch = hasPlantTool && _tagsOverlap(equipped.plantTags, exposedTags);

    // Check reveal capability
    result.canReveal = Array.isArray(equipped.revealTags) && equipped.revealTags.length > 0;

    // Count per-slot stealable and plantable
    for (var i = 0; i < enemy.cardDeck.length; i++) {
      var slot = enemy.cardDeck[i];

      // Stolen/destroyed slots are dead
      if (slot.stolen) continue;

      // Plantable: BLVCK slot or empty slot with no planted card
      if (slot.isBlvckSlot && !slot.planted) {
        if (plantTagMatch) {
          result.plantableCount++;
          result.canPlant = true;
        }
        continue;
      }

      // Already has a planted card — skip (not stealable, not plantable)
      if (slot.planted) continue;

      // Regular enemy card — check stealability
      if (stealTagMatch && slot.id) {
        result.stealableCount++;
        result.canSteal = true;
      }
    }

    // Determine capsule visual state
    if (result.canSteal) {
      result.capsuleState = 'interactable'; // green pulse
    } else if (result.canPlant) {
      result.capsuleState = 'plantable_only'; // orange pulse
    } else if (result.canReveal) {
      result.capsuleState = 'revealable'; // dim blue
    } else {
      result.capsuleState = 'greyed'; // BLVCK style, no interaction
    }

    return result;
  }

  // ── Public API ────────────────────────────────────────────

  return {
    compute: compute,
    computePreCombat: computePreCombat,
    autoReveal: autoReveal
  };

})();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnemyCardInteractability;
}
