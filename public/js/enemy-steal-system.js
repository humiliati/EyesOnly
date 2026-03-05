/* ============================================================
   Enemy Steal System (Phase 1 - minimal)
   Pre-combat pickpocket flow.

   Design:
   - Player equips a theft tool (e.g., ITM-PICKPOCKET-GLOVES) which carries stealTags.
   - When adjacent to an enemy, player can attempt STEAL / PICKPOCKET.
   - If enemy deck exposes any matching tag, grant a "stolen" disposable card.
   - If mismatch, grant a generic disposable (consolation) so the action never feels dead.

   This module is intentionally lightweight; it DOES mark a stolen slot on the
   target enemy when enemy.cardDeck is present, so later combat can reflect it.
   ============================================================ */

var EnemyStealSystem = (function() {
  'use strict';

  var DEFAULT_SUCCESS_CARD = 'ACT-021'; // Stolen Technique
  var DEFAULT_FAIL_CARD = 'ACT-020';    // Fumbled Grab

  function _intersects(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    for (var i = 0; i < a.length; i++) {
      if (b.indexOf(a[i]) !== -1) return true;
    }
    return false;
  }

  /**
   * Attempt pickpocket.
   * @param {Object} ctx
   * @param {Object} ctx.player
   * @param {Array}  ctx.enemies
   * @param {Function} ctx.getEnemyDeck (enemyType)->{cards,exposedTags}
   * @param {Object|null} ctx.activeItem
   * @param {Function} [ctx.getEnemyCard] (cardId)->enemyCard
   * @returns {{ ok:boolean, success:boolean, cardId?:string, enemy?:any, message:string, stolenEnemyCardId?:string }}
   */
  function attempt(ctx) {
    if (!ctx || !ctx.player || !Array.isArray(ctx.enemies)) {
      return { ok: false, success: false, message: 'STEAL UNAVAILABLE' };
    }

    var item = ctx.activeItem || null;
    var stealTags = item && Array.isArray(item.stealTags) ? item.stealTags : [];
    if (!stealTags.length) {
      return { ok: true, success: false, message: 'NO THEFT TOOL EQUIPPED (equip Pickpocket Gloves)' };
    }

    // Find an adjacent enemy (4-neighborhood)
    var px = ctx.player.x, py = ctx.player.y;
    var target = null;
    for (var i = 0; i < ctx.enemies.length; i++) {
      var e = ctx.enemies[i];
      if (!e) continue;
      var dist = Math.abs((e.x||0) - px) + Math.abs((e.y||0) - py);
      if (dist === 1) { target = e; break; }
    }

    if (!target) {
      return { ok: true, success: false, message: 'NO ENEMY IN RANGE (stand adjacent)' };
    }

    var deck = null;
    try {
      if (typeof ctx.getEnemyDeck === 'function') {
        deck = ctx.getEnemyDeck(target.deckType || target.enemyType || target.name || '');
      }
    } catch (e0) { deck = null; }

    var exposed = deck && Array.isArray(deck.exposedTags) ? deck.exposedTags : [];
    var canSteal = _intersects(stealTags, exposed);

    if (!canSteal) {
      return {
        ok: true,
        success: false,
        cardId: DEFAULT_FAIL_CARD,
        enemy: target,
        message: 'FUMBLED — you only got junk'
      };
    }

    // Attempt to steal a specific enemy card if the enemy has a hydrated deck.
    var stolenId = null;
    try {
      if (Array.isArray(target.cardDeck) && target.cardDeck.length) {
        // Prefer highest stealValue among available cards.
        var best = null;
        for (var si = 0; si < target.cardDeck.length; si++) {
          var slot = target.cardDeck[si];
          if (!slot || !slot.id || slot.stolen) continue;
          var ev = 0;
          try {
            if (typeof ctx.getEnemyCard === 'function') {
              var cdef = ctx.getEnemyCard(slot.id);
              ev = cdef && typeof cdef.stealValue === 'number' ? cdef.stealValue : 0;
            }
          } catch (e1) { ev = 0; }
          if (!best || ev > best.v) best = { i: si, id: slot.id, v: ev };
        }
        if (best && best.id) {
          stolenId = best.id;
          // Mark stolen so future systems can reflect it.
          try { target.cardDeck[best.i].stolen = true; } catch (e2) {}
        }
      }
    } catch (e0) {}

    return {
      ok: true,
      success: true,
      cardId: stolenId || DEFAULT_SUCCESS_CARD,
      stolenEnemyCardId: stolenId || null,
      enemy: target,
      message: stolenId ? ('STOLEN — you lifted ' + stolenId) : 'STOLEN — you lifted a technique'
    };
  }

  /**
   * Pre-combat plant stub: plant a card from player inventory onto an adjacent enemy.
   * This is the data-structure foundation for Sprint 3 (ENI Phase 2) interchange UI.
   * For now, supports planting explosive cards (ACT-066/067/068) as CI-* instances.
   *
   * @param {Object} ctx
   * @param {Object} ctx.player
   * @param {Array}  ctx.enemies
   * @param {string} ctx.cardId — the ACT-* or CI-* card ID to plant
   * @param {Function} [ctx.getCard] — (cardId)->cardDef
   * @returns {{ ok:boolean, success:boolean, message:string, plantedSlotIndex?:number }}
   */
  function plantCard(ctx) {
    if (!ctx || !ctx.player || !Array.isArray(ctx.enemies) || !ctx.cardId) {
      return { ok: false, success: false, message: 'PLANT UNAVAILABLE' };
    }

    // Validate the card is plantable
    var cardDef = null;
    try {
      if (typeof GoneRogueDataRegistry !== 'undefined' && typeof GoneRogueDataRegistry.getCard === 'function') {
        cardDef = GoneRogueDataRegistry.getCard(ctx.cardId);
      } else if (typeof ctx.getCard === 'function') {
        cardDef = ctx.getCard(ctx.cardId);
      }
    } catch (e0) {}

    if (!cardDef || cardDef._missing) {
      // Try CI-* instance lookup
      try {
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getCardInstance === 'function') {
          var ci = GAMESTATE.getCardInstance(ctx.cardId);
          if (ci) cardDef = ci;
        }
      } catch (e1) {}
    }

    if (!cardDef) {
      return { ok: true, success: false, message: 'UNKNOWN CARD — cannot plant' };
    }

    if (!cardDef.plantable) {
      return { ok: true, success: false, message: 'CARD NOT PLANTABLE — only explosive cards can be planted' };
    }

    // Find adjacent enemy
    var px = ctx.player.x, py = ctx.player.y;
    var target = null;
    for (var i = 0; i < ctx.enemies.length; i++) {
      var e = ctx.enemies[i];
      if (!e) continue;
      var dist = Math.abs((e.x || 0) - px) + Math.abs((e.y || 0) - py);
      if (dist === 1) { target = e; break; }
    }

    if (!target) {
      return { ok: true, success: false, message: 'NO ENEMY IN RANGE (stand adjacent)' };
    }

    // Ensure enemy has a cardDeck
    if (!Array.isArray(target.cardDeck)) {
      target.cardDeck = [];
    }

    // Find a BLVCK slot (ACT-000 with isBlvckSlot) or append one
    var plantedIndex = -1;
    for (var si = 0; si < target.cardDeck.length; si++) {
      var slot = target.cardDeck[si];
      if (slot && slot.id === 'ACT-000' && slot.isBlvckSlot && !slot.planted) {
        plantedIndex = si;
        break;
      }
    }

    if (plantedIndex === -1) {
      // Append a new BLVCK slot and plant into it
      plantedIndex = target.cardDeck.length;
      target.cardDeck.push({
        id: 'ACT-000',
        isBlvckSlot: true,
        stolen: false,
        meta: { t: Date.now() }
      });
    }

    // Plant the card
    target.cardDeck[plantedIndex].planted = {
      cardId: ctx.cardId,
      plantedBy: 'player',
      turn: typeof GAMESTATE !== 'undefined' && GAMESTATE.getTurn ? GAMESTATE.getTurn() : 0,
      triggerable: cardDef.triggerable || false
    };

    // Register as CI-* instance if not already (for persistence across save/load)
    try {
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.registerCardInstance === 'function') {
        if (ctx.cardId.indexOf('CI-') !== 0) {
          var ciRef = GAMESTATE.registerCardInstance({
            baseId: ctx.cardId,
            name: cardDef.name || ctx.cardId,
            emoji: cardDef.emoji || '💣',
            plantedInto: target.name || target.enemyType || 'enemy',
            source: 'plant',
            floor: typeof GAMESTATE.getFloorNumber === 'function' ? GAMESTATE.getFloorNumber() : 0
          });
          if (ciRef && ciRef.id) {
            target.cardDeck[plantedIndex].planted.cardId = ciRef.id;
          }
        }
      }
    } catch (eReg) {
      console.warn('[EnemyStealSystem] CI registration error:', eReg);
    }

    // Remove from player hand/inventory
    try {
      if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.consumeCardFromHand === 'function') {
        GAMESTATE.consumeCardFromHand(ctx.cardId, 1);
      }
    } catch (eConsume) {}

    return {
      ok: true,
      success: true,
      plantedSlotIndex: plantedIndex,
      enemy: target,
      message: 'PLANTED — ' + (cardDef.emoji || '💣') + ' ' + (cardDef.name || ctx.cardId) + ' hidden in enemy deck'
    };
  }

  /**
   * Check if an enemy has any planted explosive cards (for combat trigger UI).
   * @param {Object} enemy
   * @returns {Array} Array of { slotIndex, planted } objects
   */
  function getPlantedCards(enemy) {
    if (!enemy || !Array.isArray(enemy.cardDeck)) return [];
    var planted = [];
    for (var i = 0; i < enemy.cardDeck.length; i++) {
      var slot = enemy.cardDeck[i];
      if (slot && slot.planted && slot.planted.cardId) {
        planted.push({ slotIndex: i, planted: slot.planted });
      }
    }
    return planted;
  }

  return {
    attempt: attempt,
    plantCard: plantCard,
    getPlantedCards: getPlantedCards
  };
})();
