/**
 * BreakableSystem — breakable destruction, loot spawning, light source cleanup,
 * and explosive barrel detonation with chain reactions.
 * Extracted Phase 14 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var BreakableSystem = (function() {
  'use strict';

  // NOTE: Chain detonation loop guard moved to ExplosionSystem (explosion-system.js).
  // ExplosionSystem owns _detonatedThisCascade and _cascadeDepth.

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

    // ── Audio: breakable hit / destroy ──
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      if (breakable.hp <= 0) {
        // Destruction sound — wood/environment for most breakables
        AudioSystem.playRandom('impact', 4, { volume: 0.7 });
      } else {
        // Hit sound
        AudioSystem.playRandom('hit', 4, { volume: 0.5 });
      }
    }

    if (breakable.hp === 0) {
      // Mark for destruction but delay it for animation
      breakable.destroying = true;
      breakable.destroyStartTime = Date.now();

      // Record destruction in floor state tracker for revisit handling
      if (typeof FloorStateTracker !== 'undefined' && ctx.floor !== undefined) {
        if (breakable.isGate || breakable.isTutorialGate) {
          // Gates NEVER respawn on revisit
          FloorStateTracker.recordGateDestroyed(ctx.floor, breakable.x, breakable.y, breakable.gateType || breakable.type || 'UNKNOWN');
        } else {
          // Regular breakables respawn degraded on revisit
          FloorStateTracker.recordBreakableDestroyed(ctx.floor, breakable.x, breakable.y, breakable.type || 'UNKNOWN', breakable.lootTable || null);
        }
      }

      // Explosive breakables detonate immediately (no loot, consumed in blast)
      if (breakable.explosive) {
        setTimeout(function() {
          if (breakable.destroying) {
            breakable.destroying = false;
            _triggerExplosion(breakable, ctx);
          }
        }, 200); // Shorter delay for explosions (1 blink)
        return;
      }

      // Schedule the actual destruction after animation completes (2 blinks * 200ms each = 400ms)
      setTimeout(function() {
        if (breakable.destroying) {
          ctx.grid[breakable.y][breakable.x] = breakable.destroyedGlyph || ctx.TILES.DEBRIS;
          breakable.destroying = false;

          // FX001 removal smoke at destroyed position
          try {
            if (typeof SpriteFxSystem !== 'undefined' && SpriteFxSystem.spawnRemoval) {
              SpriteFxSystem.spawnRemoval(breakable.x, breakable.y);
            }
          } catch (e) {}

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

  // ── Explosion delegation (Phase 2 — extracted to ExplosionSystem) ──

  /**
   * Trigger an explosion at a breakable's position.
   * Delegates to ExplosionSystem.detonate() (explosion-system.js).
   * Falls back to minimal inline behavior if ExplosionSystem is not loaded.
   *
   * @param {Object} breakable - The explosive breakable
   * @param {Object} ctx - Game context
   */
  function _triggerExplosion(breakable, ctx) {
    var bx = breakable.x;
    var by = breakable.y;

    // Mark breakable as detonated
    breakable.hp = 0;
    breakable.destroying = false;
    breakable.detonated = true;

    // Resolve blast parameters from breakable definition
    var radius = breakable.blastRadius || 2.75;
    var damage = breakable.blastDamage || [9, 25];

    console.log('[BreakableSystem] Explosive barrel detonated at ' + bx + ',' + by +
      ' — delegating to ExplosionSystem');

    // Delegate to ExplosionSystem (Phase 2 module)
    if (typeof ExplosionSystem !== 'undefined' && ExplosionSystem.detonate) {
      ExplosionSystem.detonate(bx, by, radius, damage, ctx);
    } else {
      // Fallback: minimal inline behavior if explosion-system.js not loaded
      console.warn('[BreakableSystem] ExplosionSystem not loaded — using minimal fallback');
      ctx.grid[by][bx] = '▓';
      if (ctx.raiseNoise) ctx.raiseNoise(bx, by, 8);
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(bx, by, '💥', 600, '#ff6600');
      }
      if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
        GroundEffects.setGroundEffect(bx, by, 'FIRE', { dissipates: false });
      }
      if (ctx.updateMobileGrid) ctx.updateMobileGrid();
    }
  }

  /**
   * Handle light source cleanup when a breakable is destroyed.
   * Type-specific destruction effects:
   *   CAMPFIRE → scorched tile + smoke clouds (3-tile radius) + fire→smoke lifecycle
   *   TORCH   → silent smoke puff (💨 overhead) + single smoke cloud
   *   LAMP_POST → topple noise + glass ground effect
   *   MONITOR/TERMINAL → spark shower (✨ overhead) + glass ground effect
   *   LIGHT_BULB → glass shatter ground effect
   */
  function _handleLightSourceDestruction(breakable, ctx) {
    if (!breakable.isLightSource || typeof LightingSystem === 'undefined') return;

    var bx = breakable.x;
    var by = breakable.y;
    var lightType = breakable.lightType || '';

    LightingSystem.removeLightSource(bx, by);

    // Raise noise if configured
    if (breakable.noise > 0 && ctx.raiseNoise) {
      ctx.raiseNoise(bx, by, breakable.noise);
    }

    // ── Type-specific destruction VFX ──────────────────────────────

    if (lightType === 'CAMPFIRE') {
      _destroyCampfire(bx, by, ctx);
    } else if (lightType === 'TORCH') {
      _destroyTorch(bx, by, ctx);
    } else if (lightType === 'LAMP_POST') {
      _destroyLampPost(bx, by, ctx);
    } else if (lightType === 'MONITOR' || lightType === 'TERMINAL') {
      _destroyElectronic(bx, by, lightType, ctx);
    } else if (lightType === 'LIGHT_BULB') {
      _destroyLightBulb(bx, by, ctx);
    } else {
      // Generic: spawn smoke if configured
      _spawnGenericLightSmoke(bx, by);
    }

    // Drop loot if chance succeeds
    if (breakable.dropChance > 0 && Math.random() < breakable.dropChance && breakable.dropType) {
      var lightDropItem = {
        x: bx,
        y: by,
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

    console.log('[Lighting] Removed ' + lightType + ' light source at', bx, ',', by);
  }

  // ── Campfire destruction: scorched epicenter + smoke cloud burst ──
  function _destroyCampfire(x, y, ctx) {
    // Scorched tile at epicenter
    if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
      GroundEffects.setGroundEffect(x, y, 'SCORCHED');
    }

    // Overhead: extinguish puff
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(x, y, '💨', 600, '#888888');
    }

    // Smoke clouds in a 2-tile radius (staggered spawn)
    var dirs8 = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
                 {dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1}];
    for (var i = 0; i < dirs8.length; i++) {
      var sx = x + dirs8[i].dx;
      var sy = y + dirs8[i].dy;
      if (sx >= 0 && sx < ctx.GRID_WIDTH && sy >= 0 && sy < ctx.GRID_HEIGHT) {
        // 60% chance per adjacent tile — creates organic cloud shape
        if (Math.random() < 0.6) {
          (function(tx, ty, delay) {
            setTimeout(function() {
              if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
                GroundEffects.setGroundEffect(tx, ty, 'SMOKE');
              }
            }, delay);
          })(sx, sy, i * 80 + Math.random() * 100);
        }
      }
    }

    // Small chance (30%) to scorch 1-2 adjacent tiles (embers)
    for (var j = 0; j < 4; j++) {
      var d = dirs8[j]; // Cardinal only
      if (Math.random() < 0.3) {
        var scx = x + d.dx;
        var scy = y + d.dy;
        if (scx >= 0 && scx < ctx.GRID_WIDTH && scy >= 0 && scy < ctx.GRID_HEIGHT) {
          if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
            GroundEffects.setGroundEffect(scx, scy, 'SCORCHED');
          }
        }
      }
    }

    // ── Audio: campfire extinguish (fire rumble) ──
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play('rumble-1', { volume: 0.35 });
    }

    console.log('[Lighting] Campfire extinguished at ' + x + ',' + y + ' — scorched + smoke clouds');
  }

  // ── Torch destruction: silent smoke puff ──
  function _destroyTorch(x, y, ctx) {
    // Silent — noise = 0 already handled above
    // Single smoke cloud at torch position
    if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
      GroundEffects.setGroundEffect(x, y, 'SMOKE');
    }

    // Overhead: quiet wisp
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(x, y, '💨', 400, '#aaaaaa');
    }

    // Small chance (40%) for one adjacent smoke tile
    var adjDir = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
    var pick = adjDir[Math.floor(Math.random() * adjDir.length)];
    var nx = x + pick.dx;
    var ny = y + pick.dy;
    if (Math.random() < 0.4 && nx >= 0 && nx < ctx.GRID_WIDTH && ny >= 0 && ny < ctx.GRID_HEIGHT) {
      if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
        GroundEffects.setGroundEffect(nx, ny, 'SMOKE');
      }
    }

    // ── Audio: torch snuff (quiet whoosh) ──
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play('whoosh-1', { volume: 0.25 });
    }

    console.log('[Lighting] Torch smothered silently at ' + x + ',' + y);
  }

  // ── Lamp post destruction: topple + faint glass ──
  function _destroyLampPost(x, y, ctx) {
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(x, y, '💥', 400, '#ffbb44');
    }

    // Glass ground effect at base
    if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
      GroundEffects.setGroundEffect(x, y, 'GLASS');
    }

    // Small smoke puff from dust
    var adjDir = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
    var pick = adjDir[Math.floor(Math.random() * adjDir.length)];
    var nx = x + pick.dx;
    var ny = y + pick.dy;
    if (nx >= 0 && nx < ctx.GRID_WIDTH && ny >= 0 && ny < ctx.GRID_HEIGHT) {
      if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
        GroundEffects.setGroundEffect(nx, ny, 'SMOKE');
      }
    }

    // ── Audio: lamp post topple (metal clang) ──
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playRandom) {
      AudioSystem.playRandom('metal-hit', 2, { volume: 0.5 });
    }

    console.log('[Lighting] Lamp post toppled at ' + x + ',' + y);
  }

  // ── Electronic destruction: spark shower ──
  function _destroyElectronic(x, y, lightType, ctx) {
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(x, y, '✨', 600, '#FFD700');
    }

    // Glass ground effect (screen shatter)
    if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
      GroundEffects.setGroundEffect(x, y, 'GLASS');
    }

    // Brief smoke from electronics
    setTimeout(function() {
      if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
        GroundEffects.setGroundEffect(x, y, 'SMOKE');
      }
    }, 300);

    // ── Audio: electronic spark (dark particles zap) ──
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play('particles-dark', { volume: 0.45 });
    }

    console.log('[Lighting] ' + lightType + ' destroyed (spark shower) at ' + x + ',' + y);
  }

  // ── Light bulb destruction: glass shatter ──
  function _destroyLightBulb(x, y, ctx) {
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(x, y, '💥', 400, '#FFFFCC');
    }

    if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
      GroundEffects.setGroundEffect(x, y, 'GLASS');
    }

    // ── Audio: light bulb shatter (glass pop) ──
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play('impact-1', { volume: 0.4 });
    }

    console.log('[Lighting] Light bulb shattered at ' + x + ',' + y);
  }

  // ── Generic light smoke fallback ──
  function _spawnGenericLightSmoke(x, y) {
    var lightingConfig = (typeof LightingSystem !== 'undefined') ? LightingSystem.getConfig() : null;
    if (lightingConfig && lightingConfig.interactiveLights && lightingConfig.interactiveLights.onBreak.spawnSmoke) {
      if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
        GroundEffects.setGroundEffect(x, y, 'SMOKE');
      }
    }
  }

  // ── Smother a torch (silent interaction — hold-tap adjacent torch) ──
  function smotherTorch(breakable, ctx) {
    if (!breakable || !breakable.isLightSource) return false;
    var lightType = breakable.lightType || '';
    if (lightType !== 'TORCH') return false;

    // Check smotherable property
    var props = (typeof LightingSystem !== 'undefined') ? LightingSystem.getBreakableProps('TORCH') : null;
    if (props && !props.smotherable) return false;

    // Destroy the torch silently
    breakable.hp = 0;
    breakable.destroying = false;

    // Replace grid tile
    ctx.grid[breakable.y][breakable.x] = breakable.destroyedGlyph || ctx.TILES.DEBRIS;

    // Use torch-specific destruction effects (silent smoke)
    _handleLightSourceDestruction(breakable, ctx);

    // Trigger re-render
    if (ctx.updateMobileGrid) {
      ctx.updateMobileGrid();
    }

    console.log('[BreakableSystem] Torch smothered silently at ' + breakable.x + ',' + breakable.y);
    return true;
  }

  /**
   * Spawn loot from a destroyed breakable.
   */
  function _spawnBreakableLoot(breakable, ctx) {
    // ── LootSpillSystem integration: collect → scatter → place ──
    if (typeof LootSpillSystem !== 'undefined') {
      var pendingItems = [];

      // Temporarily intercept WorldItems.addItem to collect items
      var origAddItem = (typeof WorldItems !== 'undefined') ? WorldItems.addItem : null;
      if (origAddItem) {
        WorldItems.addItem = function(item) { pendingItems.push(item); };
      }

      // Proxy ctx to intercept spawnCurrency and items.push
      var collectCtx = {};
      for (var k in ctx) { collectCtx[k] = ctx[k]; }
      collectCtx.spawnCurrency = function(x, y, amount) {
        pendingItems.push({
          x: x, y: y, amount: amount,
          glyph: '\u00A2', emoji: '\uD83D\uDCB0',
          spawnTime: Date.now(), decayTime: 20000,
          _isCurrency: true
        });
      };
      // Wrap items array to intercept push
      var origItems = ctx.items;
      collectCtx.items = {
        push: function(item) { pendingItems.push(item); },
        find: origItems.find ? origItems.find.bind(origItems) : undefined,
        length: origItems.length
      };

      // Run all loot generation (collected, not yet placed)
      if (typeof LootTableManager !== 'undefined' && LootTableManager.rollBreakableLoot) {
        _spawnLootTableLoot(breakable, collectCtx);
        // Designer-explicit key drops (drops.item) must fire on BOTH loot
        // paths. Historically this lived only inside _spawnFallbackLoot, so
        // whenever LootTableManager was loaded the tutorial key breakables
        // (e.g. floor 3 Marked Crate → rusty_key) silently dropped nothing.
        _spawnDesignerKeyDrop(breakable, collectCtx);
      } else {
        _spawnFallbackLoot(breakable, collectCtx); // includes designer key drop
      }
      _spawnItemDrop(breakable, collectCtx);

      // Restore WorldItems.addItem
      if (origAddItem) { WorldItems.addItem = origAddItem; }

      // Scatter all collected items across tiles
      LootSpillSystem.scatterItems(breakable.x, breakable.y, pendingItems, ctx);

      // Enforce minimum decay floor for breakable loot (45s).
      // Protects edge case: 3+ breakables with 8+ contents each — player needs
      // time to walk to scattered tiles and pick everything up before despawn.
      var BREAKABLE_DECAY_FLOOR = 45000;
      for (var d = 0; d < pendingItems.length; d++) {
        if (pendingItems[d].decayTime && pendingItems[d].decayTime < BREAKABLE_DECAY_FLOOR) {
          pendingItems[d].decayTime = BREAKABLE_DECAY_FLOOR;
        }
      }

      // Place scattered items via their proper APIs
      for (var i = 0; i < pendingItems.length; i++) {
        var loot = pendingItems[i];
        if (loot._isCurrency) {
          delete loot._isCurrency;
          if (typeof WorldItems !== 'undefined') { WorldItems.addCurrency(loot); } else { ctx.currencies.push(loot); }
        } else {
          if (typeof WorldItems !== 'undefined') { WorldItems.addItem(loot); } else { origItems.push(loot); }
        }
      }
    } else {
      // Fallback: original behavior (no scatter)
      if (typeof LootTableManager !== 'undefined' && LootTableManager.rollBreakableLoot) {
        _spawnLootTableLoot(breakable, ctx);
        // Loot-table path skips _spawnFallbackLoot, so fire designer key
        // drops explicitly (see note in the spill branch above).
        _spawnDesignerKeyDrop(breakable, ctx);
      } else {
        _spawnFallbackLoot(breakable, ctx); // includes designer key drop
      }
      _spawnItemDrop(breakable, ctx);
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
   * Designer-explicit key drop (breakable.drops.item = '<key_id>').
   * Unconditional — this is authored content (e.g. floor 3 Marked Crate
   * drops rusty_key), not a probability roll. Called from BOTH loot paths
   * in _spawnBreakableLoot.
   * @returns {boolean} true if a key item was spawned
   */
  function _spawnDesignerKeyDrop(breakable, ctx) {
    if (typeof EnvironmentalSynergy === 'undefined') return false;
    if (!breakable || !breakable.drops || !breakable.drops.item) return false;

    var requested = ('' + breakable.drops.item).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (requested === 'RUSTY_KEY' || requested === 'RUSTYKEY' || requested === 'RUSTY__KEY') requested = 'RUSTY_KEY';

    var keyDefs2 = EnvironmentalSynergy.getKeyDefinitions();
    var def2 = keyDefs2[requested];
    if (!def2) return false;

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
    console.log('[Breakable] Designer key drop: ' + requested + ' at (' + breakable.x + ',' + breakable.y + ')');
    return true;
  }

  /**
   * Handle key drops from specific breakable types.
   */
  function _spawnKeyDrops(breakable, ctx) {
    if (typeof EnvironmentalSynergy === 'undefined' || !breakable.name) return;

    var rng = ctx.rng;

    // Tutorial / designer-defined key breakables can explicitly drop a key by id
    var keyDropped = _spawnDesignerKeyDrop(breakable, ctx);

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

  // ── Phase 2: Equipment / Consumable item drops from breakables ──────────

  /**
   * Spawn an equipment or consumable item from a breakable with drops.itemId.
   * Designer-defined: breakable.drops.itemId = 'ITM-###' guarantees that item.
   * Resolves full definition from GoneRogueDataRegistry (items.json).
   *
   * @param {Object} breakable - The destroyed breakable
   * @param {Object} ctx - Game context
   */
  function _spawnItemDrop(breakable, ctx) {
    if (!breakable.drops || !breakable.drops.itemId) return;

    var itemId = breakable.drops.itemId;

    // Resolve full definition from items.json data registry
    var itemDef = null;
    if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
      try {
        itemDef = GoneRogueDataRegistry.getItem(itemId);
        if (itemDef && itemDef._missing) itemDef = null;
      } catch (eResolve) {
        console.warn('[BreakableSystem] Error resolving item:', itemId, eResolve);
      }
    }

    if (!itemDef) {
      console.warn('[BreakableSystem] Unknown item drop: ' + itemId + ' — not in data registry');
      return;
    }

    var worldItem = {
      x: breakable.x,
      y: breakable.y,
      type: 'item',
      itemId: itemId,
      emoji: itemDef.emoji || '\uD83D\uDCE6', // 📦
      name: itemDef.name || itemId,
      description: itemDef.description || '',
      rarity: itemDef.rarity || 'common',
      spawnTime: Date.now(),
      decayTime: 120000
    };

    if (typeof WorldItems !== 'undefined') {
      WorldItems.addItem(worldItem);
    } else {
      ctx.items.push(worldItem);
    }

    console.log('[BreakableSystem] Item dropped: ' + itemId + ' (' + worldItem.name + ') at ' + breakable.x + ',' + breakable.y);
  }

  /**
   * Kick a breakable — deal damage + attempt to push it in the kick direction.
   * Called when player taps an adjacent kickable breakable.
   *
   * @param {Object} breakable - The breakable to kick
   * @param {number} dx - Direction X (-1, 0, or 1)
   * @param {number} dy - Direction Y (-1, 0, or 1)
   * @param {Object} ctx - Game context (needs: grid, TILES, GRID_WIDTH, GRID_HEIGHT, isWalkable, getBreakableAt, player)
   * @returns {{ damage: number, pushed: boolean, pushDist: number, destroyed: boolean }}
   */
  function kickBreakable(breakable, dx, dy, ctx) {
    var kickDamage = 0.2;
    var result = { damage: kickDamage, pushed: false, pushDist: 0, destroyed: false };

    console.log('[Kick] Kicking ' + (breakable.name || '?') + ' at ' + breakable.x + ',' + breakable.y +
      ' dir=' + dx + ',' + dy + ' HP=' + breakable.hp + '/' + breakable.maxHp);

    // 1. Deal kick damage (+ kick SFX + kick sprite FX003 + energy cost)
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.playRandom('low-attack', 3, { volume: 0.5 });
    }
    // Spawn kick flash between player and target
    try {
      if (typeof SpriteFxSystem !== 'undefined' && SpriteFxSystem.spawnKick && ctx.player) {
        SpriteFxSystem.spawnKick(ctx.player.x, ctx.player.y, dx, dy);
      }
    } catch (e) {}
    // Spend 0.01 energy (clamped at 0 — kick is never blocked by low energy)
    try {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getEnergy && GAMESTATE.useEnergy) {
        var energyBefore = GAMESTATE.getEnergy();
        if (energyBefore > 0) {
          GAMESTATE.useEnergy(0.01);
        }
        var energyAfter = GAMESTATE.getEnergy ? GAMESTATE.getEnergy() : Math.max(0, energyBefore - 0.01);
        // Flash debrief with Energy resource color (display whole numbers)
        if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
          DebriefFeedController.reportResourceChange('Energy',
            Math.floor(energyBefore), Math.floor(energyAfter), 'Kick');
        }
      }
    } catch (e2) {}
    damageBreakable(breakable, kickDamage, ctx);
    console.log('[Kick] After damage: HP=' + breakable.hp + ' destroying=' + breakable.destroying);
    if (breakable.hp <= 0) {
      result.destroyed = true;
      return result;
    }

    // Set kick animation state
    breakable.kickTime = Date.now();
    breakable.kickPushed = false;

    // 2. Only attempt push if kickable
    if (!breakable.kickable) return result;

    // 3. Calculate push chance (base 40%, buffable by equipped items)
    var pushChance = 0.40;
    var maxPushDist = 1;

    // Check for kick-buffing equipped item (legendary boots = 1.5 tile range + higher chance)
    if (ctx.player && typeof GAMESTATE !== 'undefined' && GAMESTATE.getEquippedItems) {
      var equipped = GAMESTATE.getEquippedItems();
      if (equipped) {
        for (var ei = 0; ei < equipped.length; ei++) {
          var eq = equipped[ei];
          if (eq && eq.meta && eq.meta.kickBuff) {
            pushChance = Math.min(0.90, pushChance + (eq.meta.kickBuff.chanceBonus || 0));
            maxPushDist = Math.max(maxPushDist, eq.meta.kickBuff.maxDist || 1);
          }
        }
      }
    }

    // 4. Roll push
    var rng = ctx.rng ? ctx.rng() : Math.random();
    if (rng >= pushChance) {
      // Push failed — show a wobble but no movement
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(breakable.x, breakable.y, '🥾', 300, '#aa8844');
      }
      console.log('[Kick] Push failed (roll ' + rng.toFixed(2) + ' >= ' + pushChance.toFixed(2) + ')');
      return result;
    }

    // 5. Determine push distance (1 tile normally, up to maxPushDist for buffed kicks)
    var actualDist = 0;
    var bx = breakable.x;
    var by = breakable.y;

    for (var step = 1; step <= Math.ceil(maxPushDist); step++) {
      var nx = bx + dx * step;
      var ny = by + dy * step;

      // Bounds check
      if (nx < 0 || nx >= ctx.GRID_WIDTH || ny < 0 || ny >= ctx.GRID_HEIGHT) break;

      // Check if target tile is walkable (empty floor) and no other breakable there
      var tileAtTarget = ctx.grid[ny] ? ctx.grid[ny][nx] : null;
      if (tileAtTarget !== ctx.TILES.EMPTY && tileAtTarget !== ctx.TILES.GRASS) break;

      // Check no breakable already at target
      if (ctx.getBreakableAt && ctx.getBreakableAt(nx, ny)) break;

      // Check no enemy at target
      if (ctx.enemies) {
        var blocked = false;
        for (var eIdx = 0; eIdx < ctx.enemies.length; eIdx++) {
          if (ctx.enemies[eIdx] && ctx.enemies[eIdx].x === nx && ctx.enemies[eIdx].y === ny && ctx.enemies[eIdx].hp > 0) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
      }

      actualDist = step;
      // Half-tile precision: if maxPushDist is 1.5, allow step 1 always but step 2 only 50%
      if (step >= maxPushDist && maxPushDist % 1 !== 0) {
        var halfChance = ctx.rng ? ctx.rng() : Math.random();
        if (halfChance >= 0.5) break;
      }
    }

    if (actualDist > 0) {
      // 6. Move the breakable
      var oldX = breakable.x;
      var oldY = breakable.y;
      var newX = oldX + dx * actualDist;
      var newY = oldY + dy * actualDist;

      // Clear old grid position
      ctx.grid[oldY][oldX] = breakable.destroyedGlyph === '.' ? ctx.TILES.EMPTY : ctx.TILES.EMPTY;

      // Update breakable position
      breakable.x = newX;
      breakable.y = newY;

      // Set new grid position
      ctx.grid[newY][newX] = ctx.TILES.BREAKABLE;

      result.pushed = true;
      result.pushDist = actualDist;
      breakable.kickPushed = true;

      // Show push animation
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(newX, newY, '🥾', 400, '#44aa44');
      }

      // Raise noise from the push
      if (ctx.raiseNoise) {
        ctx.raiseNoise(newX, newY, breakable.noise || 2);
      }

      console.log('[Kick] Pushed ' + breakable.name + ' from ' + oldX + ',' + oldY +
        ' to ' + newX + ',' + newY + ' (' + actualDist + ' tile' + (actualDist > 1 ? 's' : '') + ')');
    } else {
      // Blocked — can't push (wall/obstacle behind)
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(breakable.x, breakable.y, '🥾', 300, '#aa8844');
      }
      console.log('[Kick] Push blocked — obstacle behind ' + breakable.name);
    }

    return result;
  }

  return {
    damageBreakable: damageBreakable,
    kickBreakable: kickBreakable,
    smotherTorch: smotherTorch
  };
})();
