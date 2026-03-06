/* ============================================================
   Enemy Deck Hydrator

   Phase 1 (ENEMY_CARDS.md): attach deck + exposedTags onto spawned enemies.
   - Uses GoneRogueDataRegistry.getEnemyDeck()
   - Adds:
     enemy.deckType (best-effort)
     enemy.cardDeck: [{ id:'EATK-###', stolen:false, planted:null }, ...]
     enemy.exposedTags: ['pickpocket', ...]
     + 1 BLVCK slot (ACT-000, isBlvckSlot:true) appended as plantable target

   Notes:
   - This does not yet implement in-combat stealing/destroying of specific slots.
   - It is safe to call multiple times (idempotent).
   ============================================================ */

var EnemyDeckHydrator = (function() {
  'use strict';

  function _floorBandKey(floorNum) {
    var f = Math.max(1, Math.floor(Number(floorNum || 1) || 1));
    if (f <= 5) return 'GENERIC_FLOOR_5';
    if (f <= 10) return 'GENERIC_FLOOR_10';
    if (f <= 15) return 'GENERIC_FLOOR_15';
    if (f <= 20) return 'GENERIC_FLOOR_20';
    if (f <= 25) return 'GENERIC_FLOOR_25';
    return 'GENERIC_FLOOR_30';
  }

  function hydrate(enemy, floorNum) {
    if (!enemy) return enemy;

    // Already hydrated?
    if (Array.isArray(enemy.cardDeck) && enemy.cardDeck.length) {
      if (!Array.isArray(enemy.exposedTags)) enemy.exposedTags = [];
      return enemy;
    }

    var getEnemyDeck = (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getEnemyDeck)
      ? GoneRogueDataRegistry.getEnemyDeck
      : null;

    if (!getEnemyDeck) {
      enemy.cardDeck = [];
      enemy.exposedTags = [];
      return enemy;
    }

    // Choose a deck key
    var deckKey = enemy.deckType || enemy.enemyType || enemy.eliteType || enemy.name || '';

    // Treasure goblin special-case
    if (enemy.isTreasureGoblin) {
      deckKey = 'TREASURE_GOBLIN';
      enemy.deckType = 'TREASURE_GOBLIN';
      if (!enemy.name) enemy.name = 'Treasure Goblin';
      if (!enemy.emoji) enemy.emoji = '🪙';
    }

    var deck = null;
    try { deck = getEnemyDeck(deckKey); } catch (e0) { deck = null; }

    // Fallback to generic floor band for anonymous procedural enemies
    if (!deck) {
      var band = _floorBandKey(floorNum);
      enemy.deckType = band;
      try { deck = getEnemyDeck(band); } catch (e1) { deck = null; }
    }

    var cards = (deck && Array.isArray(deck.cards)) ? deck.cards : [];
    enemy.exposedTags = (deck && Array.isArray(deck.exposedTags)) ? deck.exposedTags.slice() : [];

    enemy.cardDeck = cards.map(function(id) {
      return { id: id, stolen: false, planted: null, meta: { t: Date.now() } };
    });

    // Append one BLVCK empty slot (ACT-000) as the universal plantable target
    // per CHH Step 6.1 — every enemy gets at least one plantable node
    enemy.cardDeck.push({
      id: 'ACT-000',
      stolen: false,
      planted: null,
      isBlvckSlot: true,
      meta: { t: Date.now() }
    });

    return enemy;
  }

  return {
    hydrate: hydrate
  };
})();
