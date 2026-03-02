/**
 * KeyLootGen — Extracted from gone-rogue.js (Phase 6)
 * Key utility functions, weighted rolls, and context-aware key spawning.
 * Stateless module — all state passed via ctx.
 */
var KeyLootGen = (function() {
  'use strict';

  // ── Biome <-> Key mappings ──
  var _biomeToKey = {
    'Commercial Office': 'KEYCARD',
    'Shopping Mall': 'MALL_KEY',
    'Industrial Complex': 'INDUSTRIAL_PASS',
    'Aerospace Museum': 'ACCESS_CARD'
  };

  var _keyToBiome = {
    'KEYCARD': 'Commercial Office',
    'THUMB_DRIVE': 'Commercial Office',
    'MALL_KEY': 'Shopping Mall',
    'INDUSTRIAL_PASS': 'Industrial Complex',
    'ACCESS_CARD': 'Aerospace Museum'
  };

  // ── Helpers ──

  /**
   * Retrieve all currently owned keys from player inventory.
   * Filters quest keys by default.
   */
  function getPlayerKeys(opts) {
    opts = opts || {};
    var excludeQuest = opts.excludeQuest !== false;
    var keys = [];

    if (typeof InteractiveItems !== 'undefined') {
      var items = InteractiveItems.getAllItems();
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'key') {
          if (excludeQuest && items[i].subtype === 'quest') continue;
          keys.push(items[i].keyType || items[i].itemId);
        }
      }
    }

    if (typeof GAMESTATE !== 'undefined') {
      var loose = GAMESTATE.getLooseInventory();
      var persistent = GAMESTATE.getPersistentInventory();
      var allItems = loose.concat(persistent);
      for (var j = 0; j < allItems.length; j++) {
        if (allItems[j].type === 'key') {
          if (excludeQuest && allItems[j].subtype === 'quest') continue;
          keys.push(allItems[j].keyType || allItems[j].itemId);
        }
      }
    }

    return keys;
  }

  /**
   * Determine tier level of a key (1=ammo/breakable, 2=gate/door, 3=quest).
   * Checks EnvironmentalSynergy definitions first, then inventory metadata.
   */
  function getKeyTier(keyType) {
    if (typeof EnvironmentalSynergy !== 'undefined' && EnvironmentalSynergy.getKeyDefinitions) {
      var defs = EnvironmentalSynergy.getKeyDefinitions();
      for (var k in defs) {
        if (defs.hasOwnProperty(k)) {
          var def = defs[k];
          if (k === keyType || def.itemId === keyType || def.registryId === keyType) {
            return def.tier || 1;
          }
        }
      }
    }

    if (typeof GAMESTATE !== 'undefined') {
      var all = (GAMESTATE.getLooseInventory ? GAMESTATE.getLooseInventory() : [])
        .concat(GAMESTATE.getPersistentInventory ? GAMESTATE.getPersistentInventory() : []);
      for (var i = 0; i < all.length; i++) {
        var it = all[i];
        if (it && it.type === 'key') {
          var id = it.keyType || it.registryId || it.itemId;
          if (id === keyType && it.tier) return it.tier;
        }
      }
    }

    return 1;
  }

  /** Check if player has required key for accessing specific biome. */
  function playerHasKeyForBiome(playerKeys, biomeName) {
    var requiredKey = _biomeToKey[biomeName];
    if (!requiredKey) return false;
    return playerKeys.indexOf(requiredKey) !== -1;
  }

  /** Get biome name that a specific key unlocks. */
  function getBiomeForKey(keyType) {
    return _keyToBiome[keyType] || null;
  }

  /** Count keys that don't have matching gates available. */
  function countUnmatchedKeys(playerKeys, visitedGateBiomes) {
    var unmatched = 0;
    for (var i = 0; i < playerKeys.length; i++) {
      var biome = getBiomeForKey(playerKeys[i]);
      if (biome && visitedGateBiomes.indexOf(biome) === -1) {
        unmatched++;
      }
    }
    return unmatched;
  }

  /** Weighted random selection from a { key: weight } map. */
  function weightedRoll(weights, rng) {
    var totalWeight = 0;
    for (var k in weights) {
      totalWeight += weights[k];
    }
    if (totalWeight <= 0) return null;

    var roll = rng() * totalWeight;
    var cumulative = 0;
    for (var b in weights) {
      cumulative += weights[b];
      if (roll < cumulative) return b;
    }
    return null;
  }

  // ── Main: context-aware key spawning ──

  /**
   * Potentially spawn a key on the current floor.
   * ctx: { floor, rng, grid, player, items, runState, rooms }
   * runState: { floorsSinceKey, keysFoundThisRun, keysOwned, visitedGateBiomes }
   */
  function spawnContextAwareKey(ctx) {
    if (typeof EnvironmentalSynergy === 'undefined' || !ctx.rooms || ctx.rooms.length === 0) {
      return;
    }

    if (ctx.floor <= 1) {
      ctx.runState.floorsSinceKey++;
      return;
    }

    // Calculate key spawn chance based on run depth
    var baseChance = 0;
    if (ctx.floor === 1) baseChance = 0.25;
    else if (ctx.floor === 2) baseChance = 0.35;
    else baseChance = 0.45;

    var playerKeys = getPlayerKeys();

    if (playerKeys.length === 0) {
      baseChance += 0.20;
    }

    var hasUnusedKey = countUnmatchedKeys(playerKeys, ctx.runState.visitedGateBiomes) > 0;
    if (hasUnusedKey) {
      baseChance -= 0.10;
    }

    // Pity Timer — force key spawn after 3 floors without
    var forceKey = ctx.runState.floorsSinceKey >= 3;

    if (!forceKey && ctx.rng() > baseChance) {
      ctx.runState.floorsSinceKey++;
      return;
    }

    // Weighted key type selection
    var keyWeights = {
      'KEYCARD': 30,
      'ACCESS_CARD': 25,
      'INDUSTRIAL_PASS': 25,
      'MALL_KEY': 20
    };

    for (var keyType in keyWeights) {
      if (playerKeys.indexOf(keyType) === -1) {
        keyWeights[keyType] += 15;
      }
    }

    var selectedKeyType = weightedRoll(keyWeights, ctx.rng);
    if (!selectedKeyType) {
      ctx.runState.floorsSinceKey++;
      return;
    }

    var keyDef = EnvironmentalSynergy.getKeyDefinitions()[selectedKeyType];
    if (!keyDef) {
      ctx.runState.floorsSinceKey++;
      return;
    }

    // Find spawn position (in a random room, away from player)
    var roomIndex = Math.floor(ctx.rng() * ctx.rooms.length);
    var room = ctx.rooms[roomIndex];
    var keyX = room.x + 2 + Math.floor(ctx.rng() * (room.w - 4));
    var keyY = room.y + 2 + Math.floor(ctx.rng() * (room.h - 4));

    var attempts = 0;
    while (attempts < 20) {
      if (ctx.grid[keyY] && ctx.grid[keyY][keyX] === ctx.TILES.EMPTY) {
        var distToPlayer = Math.abs(keyX - ctx.player.x) + Math.abs(keyY - ctx.player.y);
        if (distToPlayer >= 5) break;
      }
      keyX = room.x + 2 + Math.floor(ctx.rng() * (room.w - 4));
      keyY = room.y + 2 + Math.floor(ctx.rng() * (room.h - 4));
      attempts++;
    }

    ctx.items.push({
      x: keyX, y: keyY,
      type: 'key',
      keyType: selectedKeyType,
      emoji: keyDef.emoji,
      name: keyDef.name,
      description: keyDef.description,
      spawnTime: Date.now(),
      decayTime: 180000
    });

    ctx.runState.floorsSinceKey = 0;
    ctx.runState.keysFoundThisRun++;
    ctx.runState.keysOwned.push(selectedKeyType);

    console.log('[KeyLootGen] Spawned context-aware key:', keyDef.name, 'at', keyX, keyY, 'on floor', ctx.floor, forceKey ? '(FORCED)' : '');
  }

  // ── Public API ──
  return {
    getPlayerKeys: getPlayerKeys,
    getKeyTier: getKeyTier,
    playerHasKeyForBiome: playerHasKeyForBiome,
    getBiomeForKey: getBiomeForKey,
    countUnmatchedKeys: countUnmatchedKeys,
    weightedRoll: weightedRoll,
    spawnContextAwareKey: spawnContextAwareKey
  };
})();
