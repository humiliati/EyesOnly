/**
 * BreakableSystem — breakable destruction, loot spawning, light source cleanup,
 * and explosive barrel detonation with chain reactions.
 * Extracted Phase 14 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var BreakableSystem = (function() {
  'use strict';

  // ── Chain detonation loop guard ──
  // Tracks barrels already detonated this tick to prevent infinite loops.
  // Cleared at the end of each detonation cascade.
  var _detonatedThisTick = {};
  var _detonationDepth = 0;

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

  // ── Explosion System (Phase 1 — inline, extracted to ExplosionSystem in Phase 2) ──

  /**
   * Trigger an explosion at a breakable's position.
   * Replaces tile with scorched debris, applies AoE damage via circular BFS,
   * spawns ground fire/smoke, raises noise, and triggers chain detonations.
   *
   * @param {Object} breakable - The explosive breakable (must have .explosive, .blastRadius, .blastDamage)
   * @param {Object} ctx - Game context
   */
  function _triggerExplosion(breakable, ctx) {
    var bx = breakable.x;
    var by = breakable.y;
    var key = bx + ',' + by;

    // ── Chain detonation loop guard ──
    if (_detonatedThisTick[key]) return;
    _detonatedThisTick[key] = true;

    var isRoot = (_detonationDepth === 0);
    _detonationDepth++;

    // 1. Replace tile with scorched debris
    ctx.grid[by][bx] = '▓'; // Scorched variant of DEBRIS
    breakable.hp = 0;
    breakable.destroying = false;
    breakable.detonated = true;

    // 2. Resolve blast parameters
    var radius = breakable.blastRadius || 2.75;
    var dmgRange = breakable.blastDamage || [9, 25];
    var minDmg = (typeof dmgRange[0] === 'number') ? dmgRange[0] : 9;
    var maxDmg = (typeof dmgRange[1] === 'number') ? dmgRange[1] : 25;
    var baseDamage = minDmg + Math.floor((ctx.rng ? ctx.rng() : Math.random()) * (maxDmg - minDmg + 1));

    console.log('[Explosion] Red barrel detonated at ' + bx + ',' + by +
      ' | radius=' + radius + ' baseDmg=' + baseDamage);

    // 3. Raise noise — explosions are LOUD (radius 8 Manhattan)
    if (ctx.raiseNoise) {
      ctx.raiseNoise(bx, by, 8);
    }

    // 4. Overhead explosion emoji at epicenter
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(bx, by, '💥', 600, '#ff6600');
    }

    // 5. Circular BFS — iterate all tiles within blast radius
    var queue = [{ x: bx, y: by, dist: 0 }];
    var visited = {};
    visited[key] = true;

    while (queue.length > 0) {
      var current = queue.shift();
      var cx = current.x;
      var cy = current.y;
      var dist = current.dist;

      // Apply blast effects to this tile (skip epicenter for entity damage — barrel is gone)
      if (dist > 0) {
        _applyBlastToTile(cx, cy, dist, baseDamage, radius, ctx);
      }

      // Expand to neighbors if within radius (4-directional)
      if (dist < radius) {
        var neighbors = [
          { x: cx + 1, y: cy },
          { x: cx - 1, y: cy },
          { x: cx, y: cy + 1 },
          { x: cx, y: cy - 1 }
        ];
        for (var ni = 0; ni < neighbors.length; ni++) {
          var n = neighbors[ni];
          var nk = n.x + ',' + n.y;
          if (n.x >= 0 && n.x < ctx.GRID_WIDTH && n.y >= 0 && n.y < ctx.GRID_HEIGHT && !visited[nk]) {
            visited[nk] = true;
            queue.push({ x: n.x, y: n.y, dist: dist + 1 });
          }
        }
      }
    }

    // 6. Ground fire at epicenter
    if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
      GroundEffects.setGroundEffect(bx, by, 'FIRE');
    }

    // 7. Trigger re-render
    if (ctx.updateMobileGrid) {
      ctx.updateMobileGrid();
    }

    // 8. Clear loop guard when root detonation finishes
    _detonationDepth--;
    if (isRoot) {
      _detonatedThisTick = {};
    }
  }

  /**
   * Apply blast effects to a single tile at a given distance from epicenter.
   * Handles: enemy damage, player damage, breakable chain damage, ground effects.
   *
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @param {number} dist - Distance from epicenter
   * @param {number} baseDamage - Base damage at epicenter
   * @param {number} radius - Blast radius
   * @param {Object} ctx - Game context
   */
  function _applyBlastToTile(tx, ty, dist, baseDamage, radius, ctx) {
    // Damage falloff: full damage at dist=1, zero at dist=radius+1
    var tileDamage = Math.floor(baseDamage * (1 - dist / (radius + 1)));
    if (tileDamage <= 0) return;

    // ── Enemy damage ──
    if (ctx.enemies && ctx.enemies.length) {
      for (var ei = 0; ei < ctx.enemies.length; ei++) {
        var enemy = ctx.enemies[ei];
        if (enemy && enemy.hp > 0 && enemy.x === tx && enemy.y === ty) {
          enemy.hp = Math.max(0, enemy.hp - tileDamage);
          console.log('[Explosion] Enemy ' + (enemy.name || '?') + ' took ' + tileDamage + ' blast damage at ' + tx + ',' + ty);

          // Overhead damage indicator
          if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
            OverheadAnimator.showGenericExpression(tx, ty, '🔥', 400, '#ff3300');
          }

          // Set awareness to ENGAGED
          if (typeof EnemyAISystem !== 'undefined' && EnemyAISystem.increaseEnemyAwareness) {
            EnemyAISystem.increaseEnemyAwareness(enemy, 150, { AWARENESS_STATES: ctx.AWARENESS_STATES });
          }

          // Handle death
          if (enemy.hp <= 0) {
            enemy.dead = true;
            if (typeof DeathExitSystem !== 'undefined' && DeathExitSystem.handleEnemyDeath) {
              DeathExitSystem.handleEnemyDeath(enemy, ctx);
            }
          }
        }
      }
    }

    // ── Player damage (50% friendly fire reduction) ──
    if (ctx.player && ctx.player.x === tx && ctx.player.y === ty) {
      var playerDmg = Math.floor(tileDamage * 0.5);
      if (playerDmg > 0) {
        ctx.player.hp = Math.max(0, (ctx.player.hp || 0) - playerDmg);
        console.log('[Explosion] Player took ' + playerDmg + ' blast damage → HP ' + ctx.player.hp + '/' + ctx.player.maxHp);
        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
          OverheadAnimator.showGenericExpression(tx, ty, '💥', 400, '#ff0000');
        }
        // Check for death
        if (ctx.player.hp <= 0) {
          ctx.player.hp = 0;
          console.log('[Explosion] Player killed by explosion!');
        }
      }
    }

    // ── Breakable damage (chain detonation for explosives) ──
    var breakableAtTile = ctx.getBreakableAt ? ctx.getBreakableAt(tx, ty) : null;
    if (breakableAtTile && breakableAtTile.hp > 0) {
      // Recursive call — damageBreakable will trigger _triggerExplosion if explosive
      damageBreakable(breakableAtTile, tileDamage, ctx);
    }

    // ── Ground effects: fire (50%) or smoke (30%) on empty floor ──
    if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
      var existingEffect = (typeof GroundEffects.getGroundEffect === 'function')
        ? GroundEffects.getGroundEffect(tx, ty)
        : null;

      if (existingEffect && existingEffect.type === 'OIL' && typeof GroundEffects.igniteOil === 'function') {
        // Ignite oil
        GroundEffects.igniteOil(tx, ty);
      } else if (existingEffect && existingEffect.type === 'WATER') {
        // Evaporate water → steam
        GroundEffects.setGroundEffect(tx, ty, 'STEAM');
      } else if (!existingEffect || existingEffect.type === 'NORMAL') {
        var rng = ctx.rng ? ctx.rng() : Math.random();
        if (rng < 0.50) {
          GroundEffects.setGroundEffect(tx, ty, 'FIRE');
        } else if (rng < 0.80) {
          GroundEffects.setGroundEffect(tx, ty, 'SMOKE');
        }
      }
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
    var kickDamage = 2;
    var result = { damage: kickDamage, pushed: false, pushDist: 0, destroyed: false };

    console.log('[Kick] Kicking ' + (breakable.name || '?') + ' at ' + breakable.x + ',' + breakable.y +
      ' dir=' + dx + ',' + dy + ' HP=' + breakable.hp + '/' + breakable.maxHp);

    // 1. Deal kick damage
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
    kickBreakable: kickBreakable
  };
})();
