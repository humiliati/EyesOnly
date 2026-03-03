/**
 * BreakableSystem — breakable destruction, loot spawning, and light source cleanup.
 * Extracted Phase 14 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var BreakableSystem = (function() {
  'use strict';

  /**
   * Damage a breakable and handle destruction + loot.
   * @param {Object} breakable - The breakable object
   * @param {number} amount - Damage amount
   * @param {Object} ctx - Context from monolith
   */
  function damageBreakable(breakable, amount, ctx) {
    breakable.hp = Math.max(0, (breakable.hp || 0) - amount);

    // Track for highscore
    ctx.totalBreakableDamage += amount;

    // Add hit animation state
    breakable.hitTime = Date.now();
    breakable.blinkCount = 0;

    if (breakable.hp === 0) {
      // Mark for destruction but delay it for animation
      breakable.destroying = true;
      breakable.destroyStartTime = Date.now();

      // Schedule the actual destruction after animation completes (2 blinks * 200ms each = 400ms)
      setTimeout(function() {
        if (breakable.destroying) {
          ctx.grid[breakable.y][breakable.x] = breakable.destroyedGlyph || ctx.TILES.DEBRIS;
          breakable.destroying = false;

          // Handle light source destruction
          _handleLightSourceDestruction(breakable, ctx);

          // Spawn loot
          _spawnBreakableLoot(breakable, ctx);

          // Trigger re-render
          if (ctx.updateMobileGrid) {
            ctx.updateMobileGrid();
          }
        }
      }, 400); // 2 blinks at 200ms each
    }
  }

  /**
   * Handle light source cleanup when a breakable is destroyed.
   */
  function _handleLightSourceDestruction(breakable, ctx) {
    if (!breakable.isLightSource || typeof LightingSystem === 'undefined') return;

    LightingSystem.removeLightSource(breakable.x, breakable.y);

    // Raise noise if configured
    if (breakable.noise > 0 && ctx.raiseNoise) {
      ctx.raiseNoise(breakable.x, breakable.y, breakable.noise);
    }

    // Spawn smoke if configured
    var lightingConfig = LightingSystem.getConfig();
    if (lightingConfig && lightingConfig.interactiveLights && lightingConfig.interactiveLights.onBreak.spawnSmoke) {
      if (typeof GroundEffects !== 'undefined' && GroundEffects.addEffect) {
        GroundEffects.addEffect(breakable.x, breakable.y, 'SMOKE');
      }
    }

    // Drop loot if chance succeeds
    if (breakable.dropChance > 0 && Math.random() < breakable.dropChance && breakable.dropType) {
      var lightDropItem = {
        x: breakable.x,
        y: breakable.y,
        type: 'item',
        itemId: breakable.dropType,
        spawnTime: Date.now(),
        decayTime: 60000,
        emoji: '\uD83D\uDCBE', // 💾
        name: 'Item'
      };
      if (typeof WorldItems !== 'undefined') { WorldItems.addItem(lightDropItem); } else { ctx.items.push(lightDropItem); }
      console.log('[Lighting] Destroyed light source dropped:', breakable.dropType);
    }

    // Update light map immediately
    ctx.rebuildWallCache();
    LightingSystem.updateLightMap(ctx.GRID_WIDTH, ctx.GRID_HEIGHT, ctx.getAllLightBlockers(ctx.wallCache));

    console.log('[Lighting] Removed light source at', breakable.x, ',', breakable.y);
  }

  /**
   * Spawn loot from a destroyed breakable.
   */
  function _spawnBreakableLoot(breakable, ctx) {
    // Use LootTableManager if available
    if (typeof LootTableManager !== 'undefined' && LootTableManager.rollBreakableLoot) {
      _spawnLootTableLoot(breakable, ctx);
    } else {
      _spawnFallbackLoot(breakable, ctx);
    }
  }

  /**
   * Spawn loot using LootTableManager.
   */
  function _spawnLootTableLoot(breakable, ctx) {
    var breakableType = breakable.type || 'default';
    var currentBiome = ctx.getBiome(ctx.floor) || 'COZY_FOREST';
    var rolledLoot = LootTableManager.rollBreakableLoot(breakableType, currentBiome);

    if (!rolledLoot) return;

    // Spawn currency
    if (rolledLoot.currency > 0) {
      ctx.spawnCurrency(breakable.x, breakable.y, rolledLoot.currency);
    }

    // Spawn ammo
    if (rolledLoot.ammo > 0) {
      var ammoLoot = {
        x: breakable.x,
        y: breakable.y,
        type: 'ammo',
        amount: rolledLoot.ammo,
        spawnTime: Date.now(),
        decayTime: LootTableManager.getDecayTime('ammo') * 1000 || 60000,
        emoji: '\u204D', // ⁍
        name: 'Ammo (' + rolledLoot.ammo + ')'
      };
      if (typeof WorldItems !== 'undefined') { WorldItems.addItem(ammoLoot); } else { ctx.items.push(ammoLoot); }
    }

    // Spawn gem (15% chance — battery recharge collectible)
    if (ctx.rng() < 0.15) {
      var gemLoot = {
        x: breakable.x,
        y: breakable.y,
        type: 'gem',
        amount: 1,
        spawnTime: Date.now(),
        decayTime: 45000,
        glyph: '\u25C8', // ◈
        name: 'Battery Cell'
      };
      if (typeof WorldItems !== 'undefined') { WorldItems.addItem(gemLoot); } else { ctx.items.push(gemLoot); }
    }

    // Spawn items (cards, charms, etc.)
    if (rolledLoot.items && rolledLoot.items.length > 0) {
      rolledLoot.items.forEach(function(item) {
        var lootItem;
        if (item.type === 'card' && item.card) {
          lootItem = {
            x: breakable.x,
            y: breakable.y,
            type: 'card',
            card: item.card,
            spawnTime: Date.now(),
            decayTime: LootTableManager.getDecayTime('card') * 1000 || 30000
          };
        } else if (item.type === 'charm' && item.card) {
          lootItem = {
            x: breakable.x,
            y: breakable.y,
            type: 'charm',
            card: item.card,
            spawnTime: Date.now(),
            decayTime: LootTableManager.getDecayTime('charm') * 1000 || 30000
          };
        } else {
          // Generic item
          lootItem = {
            x: breakable.x,
            y: breakable.y,
            type: item.type || 'item',
            item: item,
            emoji: item.emoji || '\uD83D\uDCE6', // 📦
            name: item.name || 'Item',
            spawnTime: Date.now(),
            decayTime: 60000
          };
        }
        if (typeof WorldItems !== 'undefined') { WorldItems.addItem(lootItem); } else { ctx.items.push(lootItem); }
      });
    }
  }

  /**
   * Spawn loot using fallback hardcoded tables.
   */
  function _spawnFallbackLoot(breakable, ctx) {
    var rng = ctx.rng;

    // Drop currency (cryptos) when breakable is destroyed
    var dropChance = rng();
    if (dropChance < 0.7) { // 70% chance to drop currency
      var cryptoAmount = Math.floor(rng() * 3) + 1; // 1-3 cryptos
      ctx.spawnCurrency(breakable.x, breakable.y, cryptoAmount);
    }

    // 60% chance to drop ammo
    if (rng() < 0.6) {
      var ammoAmount = rng() < 0.8 ? 1 : 2;
      var fallbackAmmo = {
        x: breakable.x,
        y: breakable.y,
        type: 'ammo',
        amount: ammoAmount,
        spawnTime: Date.now(),
        decayTime: 60000,
        emoji: '\u204D', // ⁍
        name: 'Ammo (' + ammoAmount + ')'
      };
      if (typeof WorldItems !== 'undefined') { WorldItems.addItem(fallbackAmmo); } else { ctx.items.push(fallbackAmmo); }
    }

    // 15% chance to drop gem (battery recharge)
    if (rng() < 0.15) {
      var fallbackGem = {
        x: breakable.x,
        y: breakable.y,
        type: 'gem',
        amount: 1,
        spawnTime: Date.now(),
        decayTime: 45000,
        glyph: '\u25C8', // ◈
        name: 'Battery Cell'
      };
      if (typeof WorldItems !== 'undefined') { WorldItems.addItem(fallbackGem); } else { ctx.items.push(fallbackGem); }
    }

    // Check for key item drops from specific breakables
    _spawnKeyDrops(breakable, ctx);

    // 30% chance to drop a card
    if (rng() < 0.3 && typeof CardSystem !== 'undefined') {
      var baseType = CardSystem.getRandomBaseCard();
      var card = CardSystem.rollCard(baseType);
      if (card) {
        var fallbackCard = {
          x: breakable.x,
          y: breakable.y,
          type: 'card',
          card: card,
          spawnTime: Date.now(),
          decayTime: 30000
        };
        if (typeof WorldItems !== 'undefined') { WorldItems.addItem(fallbackCard); } else { ctx.items.push(fallbackCard); }
      }
    }

    // 25% chance to drop a charm
    if (rng() < 0.25 && typeof CardSystem !== 'undefined') {
      var charm = CardSystem.rollCommonCharm();
      if (charm) {
        var fallbackCharm = {
          x: breakable.x,
          y: breakable.y,
          type: 'charm',
          card: charm,
          spawnTime: Date.now(),
          decayTime: 30000
        };
        if (typeof WorldItems !== 'undefined') { WorldItems.addItem(fallbackCharm); } else { ctx.items.push(fallbackCharm); }
      }
    }
  }

  /**
   * Handle key drops from specific breakable types.
   */
  function _spawnKeyDrops(breakable, ctx) {
    if (typeof EnvironmentalSynergy === 'undefined' || !breakable.name) return;

    var keyDropped = false;
    var rng = ctx.rng;

    // Tutorial / designer-defined key breakables can explicitly drop a key by id
    if (breakable.drops && breakable.drops.item) {
      var requested = ('' + breakable.drops.item).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (requested === 'RUSTY_KEY' || requested === 'RUSTYKEY' || requested === 'RUSTY__KEY') requested = 'RUSTY_KEY';

      var keyDefs2 = EnvironmentalSynergy.getKeyDefinitions();
      var def2 = keyDefs2[requested];
      if (def2) {
        var keyItem2 = {
          x: breakable.x,
          y: breakable.y,
          type: 'key',
          keyType: requested,
          emoji: def2.emoji,
          name: def2.name,
          description: def2.description,
          spawnTime: Date.now(),
          decayTime: 60000
        };
        if (typeof WorldItems !== 'undefined') { WorldItems.addItem(keyItem2); } else { ctx.items.push(keyItem2); }
        keyDropped = true;
      }
    }

    // Terminal breakables can drop thumb drives (OFFICE biome)
    if (breakable.name === 'Terminal' && rng() < 0.15) {
      var keyDefs = EnvironmentalSynergy.getKeyDefinitions();
      if (keyDefs.THUMB_DRIVE) {
        var thumbDriveItem = {
          x: breakable.x,
          y: breakable.y,
          type: 'key',
          keyType: 'THUMB_DRIVE',
          emoji: keyDefs.THUMB_DRIVE.emoji,
          name: keyDefs.THUMB_DRIVE.name,
          description: keyDefs.THUMB_DRIVE.description,
          spawnTime: Date.now(),
          decayTime: 120000
        };
        if (typeof WorldItems !== 'undefined') { WorldItems.addItem(thumbDriveItem); } else { ctx.items.push(thumbDriveItem); }
        keyDropped = true;
        console.log('[GoneRogue] Thumb drive dropped from terminal at', breakable.x, breakable.y);
      }
    }

    // Wooden gates/boxes can drop rusty keys (FOREST biome)
    if (!keyDropped && (breakable.name === 'Wooden Gate' || breakable.name === 'Wooden Box') && rng() < 0.10) {
      var keyDefs3 = EnvironmentalSynergy.getKeyDefinitions();
      if (keyDefs3.RUSTY_KEY) {
        var rustyKeyItem = {
          x: breakable.x,
          y: breakable.y,
          type: 'key',
          keyType: 'RUSTY_KEY',
          emoji: keyDefs3.RUSTY_KEY.emoji,
          name: keyDefs3.RUSTY_KEY.name,
          description: keyDefs3.RUSTY_KEY.description,
          spawnTime: Date.now(),
          decayTime: 120000
        };
        if (typeof WorldItems !== 'undefined') { WorldItems.addItem(rustyKeyItem); } else { ctx.items.push(rustyKeyItem); }
        console.log('[GoneRogue] Rusty key dropped at', breakable.x, breakable.y);
      }
    }
  }

  return {
    damageBreakable: damageBreakable
  };
})();
