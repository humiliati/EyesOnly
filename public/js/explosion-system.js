/**
 * ExplosionSystem — Stateless IIFE for detonation, blast AoE, and entity knockback.
 * EB Phase 2 extraction from breakable-system.js _triggerExplosion / _applyBlastToTile.
 *
 * Public API:
 *   ExplosionSystem.detonate(x, y, radius, damage, ctx)
 *   ExplosionSystem.applyBlastToTile(tx, ty, distance, baseDamage, radius, ctx)
 *   ExplosionSystem.pushEntity(entity, epicenterX, epicenterY, force, ctx)
 *
 * All mutable state accessed via ctx — this module owns zero persistent state
 * except the per-cascade detonation guard (_detonatedThisCascade / _cascadeDepth).
 */
var ExplosionSystem = (function() {
  'use strict';

  // ── Chain detonation loop guard ──────────────────────────────────────
  // Tracks positions already detonated during the current cascade to
  // prevent infinite loops (barrel A → barrel B → barrel A).
  // Cleared when the root detonation finishes.
  var _detonatedThisCascade = {};
  var _cascadeDepth = 0;
  var MAX_CASCADE_DEPTH = 5;

  // ── Push force table (distance → push tiles) ────────────────────────
  // Distance 0 is the epicenter tile itself (barrel gone, no entity there).
  var PUSH_FORCE_BY_DISTANCE = {
    1: 2,   // Adjacent to epicenter → push 2 tiles
    2: 1,   // Mid-range → push 1 tile
    3: 0    // Outer ring → damage only, no push
  };

  var WALL_IMPACT_DAMAGE = 2;
  var ENTITY_COLLISION_DAMAGE = 1;
  var FRIENDLY_FIRE_MULTIPLIER = 0.5;

  // ════════════════════════════════════════════════════════════════════
  //  PUBLIC: detonate
  // ════════════════════════════════════════════════════════════════════

  /**
   * Detonate an explosion at (x, y) with the given radius and base damage.
   *
   * 1. Chain-detonation loop guard
   * 2. Replace tile with scorched debris '▓'
   * 3. Raise noise (radius 8 — loudest event in the game)
   * 4. Overhead 💥 at epicenter + screen shake
   * 5. Circular BFS — iterate tiles within radius, apply blast per tile
   * 6. Entity knockback for all entities in radius
   * 7. Permanent ground fire at epicenter
   * 8. Re-render
   * 9. Clear loop guard on root cascade exit
   *
   * @param {number} x - Epicenter tile X
   * @param {number} y - Epicenter tile Y
   * @param {number} radius - Blast radius in tiles (e.g. 2.75)
   * @param {number|number[]} damage - Base damage (number) or [min, max] range
   * @param {Object} ctx - Game context from monolith (_breakableCtx shape)
   * @returns {{ tilesHit: number, entitiesHit: number, chainsTriggered: number }}
   */
  function detonate(x, y, radius, damage, ctx) {
    var key = x + ',' + y;
    var stats = { tilesHit: 0, entitiesHit: 0, chainsTriggered: 0 };

    // ── 1. Chain detonation guard ──
    if (_detonatedThisCascade[key]) return stats;
    if (_cascadeDepth >= MAX_CASCADE_DEPTH) {
      console.warn('[ExplosionSystem] Max cascade depth (' + MAX_CASCADE_DEPTH + ') reached — skipping ' + key);
      return stats;
    }
    _detonatedThisCascade[key] = true;

    var isRoot = (_cascadeDepth === 0);
    _cascadeDepth++;

    // ── 2. Resolve base damage ──
    var baseDamage;
    if (Array.isArray(damage)) {
      var minD = (typeof damage[0] === 'number') ? damage[0] : 9;
      var maxD = (typeof damage[1] === 'number') ? damage[1] : 25;
      baseDamage = minD + Math.floor((ctx.rng ? ctx.rng() : Math.random()) * (maxD - minD + 1));
    } else {
      baseDamage = (typeof damage === 'number') ? damage : 15;
    }

    console.log('[ExplosionSystem] Detonate at ' + x + ',' + y +
      ' radius=' + radius + ' baseDmg=' + baseDamage + ' depth=' + _cascadeDepth);

    // ── 3. Replace tile with scorched debris ──
    if (ctx.grid && ctx.grid[y] && ctx.grid[y][x] !== undefined) {
      ctx.grid[y][x] = '▓';
    }

    // ── 4. Raise noise — loudest event in the game ──
    if (ctx.raiseNoise) {
      ctx.raiseNoise(x, y, 8);
    }

    // ── 5. Overhead 💥 at epicenter ──
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(x, y, '💥', 800, '#FF5000');
    }

    // ── 6. Screen shake ──
    _triggerScreenShake();

    // ── 7. Circular BFS — all tiles within radius ──
    var visited = {};
    var queue = [{ x: x, y: y, dist: 0 }];
    visited[key] = true;

    // Collect entities hit for knockback pass (avoid double-processing)
    var knockbackTargets = [];

    while (queue.length > 0) {
      var current = queue.shift();
      var cx = current.x;
      var cy = current.y;
      var dist = current.dist;

      // Apply blast to non-epicenter tiles
      if (dist > 0) {
        var tileResult = applyBlastToTile(cx, cy, dist, baseDamage, radius, ctx);
        stats.tilesHit++;
        stats.entitiesHit += tileResult.entitiesHit;
        stats.chainsTriggered += tileResult.chainsTriggered;

        // Collect entities at this tile for knockback
        if (tileResult.enemiesHit) {
          for (var k = 0; k < tileResult.enemiesHit.length; k++) {
            knockbackTargets.push({ entity: tileResult.enemiesHit[k], dist: dist });
          }
        }
        if (tileResult.playerHit) {
          knockbackTargets.push({ entity: ctx.player, dist: dist, isPlayer: true });
        }
      }

      // Expand neighbors if within radius (8-directional BFS — includes diagonals)
      // Diagonal distance is measured in tiles (Chebyshev), not Euclidean,
      // so the blast radius forms a diamond→square shape.
      if (dist < radius) {
        var dirs = [
          { x: cx + 1, y: cy },     // E
          { x: cx - 1, y: cy },     // W
          { x: cx, y: cy + 1 },     // S
          { x: cx, y: cy - 1 },     // N
          { x: cx + 1, y: cy + 1 }, // SE
          { x: cx - 1, y: cy + 1 }, // SW
          { x: cx + 1, y: cy - 1 }, // NE
          { x: cx - 1, y: cy - 1 }  // NW
        ];
        for (var di = 0; di < dirs.length; di++) {
          var n = dirs[di];
          var nk = n.x + ',' + n.y;
          if (n.x >= 0 && n.x < ctx.GRID_WIDTH && n.y >= 0 && n.y < ctx.GRID_HEIGHT && !visited[nk]) {
            visited[nk] = true;
            queue.push({ x: n.x, y: n.y, dist: dist + 1 });
          }
        }
      }
    }

    // ── 8. Staggered 🔥 overhead ripple for visual flair ──
    _spawnBlastRipple(x, y, radius, ctx);

    // ── 9. Entity knockback pass ──
    for (var ki = 0; ki < knockbackTargets.length; ki++) {
      var kt = knockbackTargets[ki];
      var pushForce = _getPushForce(kt.dist);
      if (pushForce > 0) {
        pushEntity(kt.entity, x, y, pushForce, ctx);
      }
    }

    // ── 10. Permanent ground fire at epicenter (tagged for lifecycle) ──
    if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
      GroundEffects.setGroundEffect(x, y, 'FIRE', {
        dissipates: false,
        _explosionFire: true,
        _explosionDistance: 0,
        _explosionMaxRadius: radius,
        _explosionSpawnTime: Date.now()
      });
    }

    // ── 11. MOK + Debrief + Tooltip ──
    _reportExplosion(x, y, baseDamage, stats);

    // ── 12. Trigger re-render ──
    if (ctx.updateMobileGrid) {
      ctx.updateMobileGrid();
    }

    // ── 13. Sound hook (future) ──
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play('explosion_large', { x: x, y: y, volume: 1.0 });
    }

    // ── 14. Clear cascade guard on root exit ──
    _cascadeDepth--;
    if (isRoot) {
      _detonatedThisCascade = {};
    }

    return stats;
  }

  // ════════════════════════════════════════════════════════════════════
  //  PUBLIC: applyBlastToTile
  // ════════════════════════════════════════════════════════════════════

  /**
   * Apply explosion effects to a single tile at distance from epicenter.
   *
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @param {number} distance - BFS distance from epicenter
   * @param {number} baseDamage - Epicenter damage
   * @param {number} radius - Total blast radius
   * @param {Object} ctx - Game context
   * @returns {{ entitiesHit: number, chainsTriggered: number, enemiesHit: Object[], playerHit: boolean }}
   */
  function applyBlastToTile(tx, ty, distance, baseDamage, radius, ctx) {
    var result = { entitiesHit: 0, chainsTriggered: 0, enemiesHit: [], playerHit: false };

    // Damage falloff: full at dist=1, zero at dist=radius+1
    var tileDamage = Math.floor(baseDamage * (1 - distance / (radius + 1)));
    if (tileDamage <= 0) return result;

    // ── Enemy damage ──
    if (ctx.enemies && ctx.enemies.length) {
      for (var ei = 0; ei < ctx.enemies.length; ei++) {
        var enemy = ctx.enemies[ei];
        if (enemy && enemy.hp > 0 && enemy.x === tx && enemy.y === ty) {
          enemy.hp = Math.max(0, enemy.hp - tileDamage);
          result.entitiesHit++;
          result.enemiesHit.push(enemy);

          console.log('[ExplosionSystem] Enemy ' + (enemy.name || '?') + ' took ' +
            tileDamage + ' blast dmg at ' + tx + ',' + ty + ' → HP ' + enemy.hp);

          // Overhead damage indicator (grey puff for reduced visual noise)
          if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
            var dmgEmoji = (distance <= 1) ? '🔥' : '💨';
            var dmgColor = (distance <= 1) ? '#ff3300' : '#666666';
            OverheadAnimator.showGenericExpression(tx, ty, dmgEmoji, 350, dmgColor);
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

    // ── Player damage (friendly fire reduction) ──
    if (ctx.player && ctx.player.x === tx && ctx.player.y === ty) {
      var playerDmg = Math.floor(tileDamage * FRIENDLY_FIRE_MULTIPLIER);
      if (playerDmg > 0) {
        ctx.player.hp = Math.max(0, (ctx.player.hp || 0) - playerDmg);
        result.entitiesHit++;
        result.playerHit = true;

        console.log('[ExplosionSystem] Player took ' + playerDmg + ' blast dmg → HP ' +
          ctx.player.hp + '/' + ctx.player.maxHp);

        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
          OverheadAnimator.showGenericExpression(tx, ty, '💥', 400, '#ff0000');
        }

        // Player death check
        if (ctx.player.hp <= 0) {
          ctx.player.hp = 0;
          console.log('[ExplosionSystem] Player killed by explosion!');
        }
      }
    }

    // ── Breakable damage (chain detonation for explosives) ──
    var breakableAtTile = ctx.getBreakableAt ? ctx.getBreakableAt(tx, ty) : null;
    if (breakableAtTile && breakableAtTile.hp > 0) {
      if (breakableAtTile.explosive) {
        result.chainsTriggered++;
      }
      // Recursive: damageBreakable → _triggerExplosion if explosive → detonate (re-enters us)
      if (typeof BreakableSystem !== 'undefined' && BreakableSystem.damageBreakable) {
        BreakableSystem.damageBreakable(breakableAtTile, tileDamage, ctx);
      }
    }

    // ── Light source destruction ──
    if (breakableAtTile && breakableAtTile.isLightSource && breakableAtTile.hp <= 0) {
      // Glass shatter for bulbs/monitors
      if (breakableAtTile.lightType === 'LIGHT_BULB' || breakableAtTile.lightType === 'MONITOR') {
        if (typeof GroundEffects !== 'undefined' && GroundEffects.setGroundEffect) {
          GroundEffects.setGroundEffect(tx, ty, 'GLASS');
        }
        // Spark shower overhead
        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
          OverheadAnimator.showGenericExpression(tx, ty, '✨', 600, '#ffdd00');
        }
      }
      console.log('[ExplosionSystem] Light destroyed at ' + tx + ',' + ty + ' — darkness zone created');
    }

    // ── Ground effects ──
    _applyGroundEffects(tx, ty, distance, radius, ctx);

    // ── Food item destruction ──
    _destroyFoodItems(tx, ty, ctx);

    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  //  PUBLIC: pushEntity
  // ════════════════════════════════════════════════════════════════════

  /**
   * Push an entity away from the explosion epicenter.
   * Walks tile-by-tile in the push direction; stops at walls (bonus damage),
   * other entities (both take impact damage), or grid bounds.
   *
   * @param {Object} entity - Must have { x, y, hp } at minimum
   * @param {number} epicenterX - Explosion epicenter X
   * @param {number} epicenterY - Explosion epicenter Y
   * @param {number} force - Number of tiles to push
   * @param {Object} ctx - Game context (grid, GRID_WIDTH, GRID_HEIGHT, enemies, player)
   * @returns {{ pushed: boolean, distance: number, impactDamage: number }}
   */
  function pushEntity(entity, epicenterX, epicenterY, force, ctx) {
    var result = { pushed: false, distance: 0, impactDamage: 0 };
    if (!entity || force <= 0) return result;
    if (entity.hp !== undefined && entity.hp <= 0) return result;

    // Direction: entity away from epicenter
    var rawDx = entity.x - epicenterX;
    var rawDy = entity.y - epicenterY;
    var mag = Math.sqrt(rawDx * rawDx + rawDy * rawDy) || 1;

    // Normalize to integer direction (round to nearest cardinal/diagonal)
    var ndx = Math.round(rawDx / mag);
    var ndy = Math.round(rawDy / mag);

    // Fallback: if entity IS at epicenter (shouldn't happen normally), push south
    if (ndx === 0 && ndy === 0) { ndy = 1; }

    console.log('[ExplosionSystem:Push] ' + (entity.name || 'entity') + ' at ' +
      entity.x + ',' + entity.y + ' dir=' + ndx + ',' + ndy + ' force=' + force);

    // Walk tile-by-tile toward target
    var startX = entity.x;
    var startY = entity.y;
    var actualDist = 0;
    var impactDmg = 0;

    for (var step = 1; step <= force; step++) {
      var nextX = startX + ndx * step;
      var nextY = startY + ndy * step;

      // Bounds check
      if (nextX < 0 || nextX >= ctx.GRID_WIDTH || nextY < 0 || nextY >= ctx.GRID_HEIGHT) {
        // Hit grid edge — treat like wall collision
        impactDmg = WALL_IMPACT_DAMAGE;
        break;
      }

      // Wall check
      var tileAt = (ctx.grid && ctx.grid[nextY]) ? ctx.grid[nextY][nextX] : null;
      if (tileAt === (ctx.TILES ? ctx.TILES.WALL : '#') || tileAt === '▓') {
        // Wall collision: stop, take bonus damage
        impactDmg = WALL_IMPACT_DAMAGE;
        console.log('[ExplosionSystem:Push] Wall collision at ' + nextX + ',' + nextY + ' → +' + WALL_IMPACT_DAMAGE + ' impact dmg');
        break;
      }

      // Entity collision check (other enemies or player)
      var entityBlocking = _getEntityAt(nextX, nextY, entity, ctx);
      if (entityBlocking) {
        // Both take impact damage
        impactDmg = ENTITY_COLLISION_DAMAGE;
        if (entityBlocking.hp !== undefined) {
          entityBlocking.hp = Math.max(0, entityBlocking.hp - ENTITY_COLLISION_DAMAGE);
          console.log('[ExplosionSystem:Push] Entity collision: ' +
            (entityBlocking.name || 'entity') + ' at ' + nextX + ',' + nextY +
            ' — both take ' + ENTITY_COLLISION_DAMAGE + ' impact dmg');
        }
        break;
      }

      // Breakable check (can't push through breakables)
      if (ctx.getBreakableAt) {
        var breakableBlocking = ctx.getBreakableAt(nextX, nextY);
        if (breakableBlocking && breakableBlocking.hp > 0) {
          impactDmg = WALL_IMPACT_DAMAGE;
          // Damage the breakable on collision
          if (typeof BreakableSystem !== 'undefined' && BreakableSystem.damageBreakable) {
            BreakableSystem.damageBreakable(breakableBlocking, ENTITY_COLLISION_DAMAGE, ctx);
          }
          break;
        }
      }

      // Tile is clear — entity can move here
      actualDist = step;
    }

    // Apply impact damage to the pushed entity
    if (impactDmg > 0 && entity.hp !== undefined) {
      entity.hp = Math.max(0, entity.hp - impactDmg);
      result.impactDamage = impactDmg;
      console.log('[ExplosionSystem:Push] ' + (entity.name || 'entity') +
        ' takes ' + impactDmg + ' impact damage → HP ' + entity.hp);

      // Check death from impact
      if (entity.hp <= 0) {
        entity.dead = true;
        if (typeof DeathExitSystem !== 'undefined' && DeathExitSystem.handleEnemyDeath && !entity.isPlayer) {
          DeathExitSystem.handleEnemyDeath(entity, ctx);
        }
      }
    }

    // Move entity to final position
    if (actualDist > 0) {
      var finalX = startX + ndx * actualDist;
      var finalY = startY + ndy * actualDist;

      entity.x = finalX;
      entity.y = finalY;
      result.pushed = true;
      result.distance = actualDist;

      console.log('[ExplosionSystem:Push] Pushed ' + (entity.name || 'entity') +
        ' from ' + startX + ',' + startY + ' → ' + finalX + ',' + finalY +
        ' (' + actualDist + ' tile' + (actualDist > 1 ? 's' : '') + ')');

      // Sync visual position for player knockback — the renderer uses a LERP
      // (_playerVisual) that only moves 35% per frame, plus GoneRogueMovement
      // maintains its own _visualPosition, and game-tick-system writes
      // player.visualX/Y from GoneRogueMovement each tick. We must snap all
      // three sources so the avatar teleports to the knockback destination
      // instead of appearing stuck.
      if (entity === ctx.player || entity.isPlayer) {
        // 1. Snap GoneRogueMovement's internal positions
        if (typeof GoneRogueMovement !== 'undefined' && GoneRogueMovement.setPosition) {
          GoneRogueMovement.setPosition(finalX, finalY);
        }
        // 2. Snap the player's visual hints read by the renderer
        entity.visualX = finalX;
        entity.visualY = finalY;
      }

      // Knockback FX002 sprite between source and entity (with southward z-shift)
      var usedKbSprite = false;
      try {
        if (typeof SpriteFxSystem !== 'undefined' && SpriteFxSystem.spawnKnockback) {
          SpriteFxSystem.spawnKnockback(startX, startY, epicenterX, epicenterY, ndx, ndy);
          usedKbSprite = true;
        }
      } catch (e) {}
      // Fallback to emoji overhead if sprite unavailable
      if (!usedKbSprite) {
        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
          OverheadAnimator.showGenericExpression(finalX, finalY, '💨', 400, '#ffaa00');
        }
      }
    }

    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════

  /**
   * Look up push force for a given BFS distance.
   * Distance 1 → 2 tiles, Distance 2 → 1 tile, Distance 3+ → 0.
   */
  function _getPushForce(dist) {
    var intDist = Math.ceil(dist);
    if (PUSH_FORCE_BY_DISTANCE[intDist] !== undefined) {
      return PUSH_FORCE_BY_DISTANCE[intDist];
    }
    return 0; // Beyond push range
  }

  /**
   * Check for an entity (enemy or player) at a given tile, excluding `self`.
   */
  function _getEntityAt(tx, ty, selfEntity, ctx) {
    // Check enemies
    if (ctx.enemies) {
      for (var i = 0; i < ctx.enemies.length; i++) {
        var e = ctx.enemies[i];
        if (e && e !== selfEntity && e.hp > 0 && e.x === tx && e.y === ty) {
          return e;
        }
      }
    }
    // Check player
    if (ctx.player && ctx.player !== selfEntity && ctx.player.x === tx && ctx.player.y === ty) {
      return ctx.player;
    }
    return null;
  }

  /**
   * Apply ground effects at a blast tile based on existing ground state.
   * OIL → ignite, WATER → steam, empty → fire (50%) or smoke (30%).
   */
  function _applyGroundEffects(tx, ty, distance, radius, ctx) {
    if (typeof GroundEffects === 'undefined' || !GroundEffects.setGroundEffect) return;

    var existing = (typeof GroundEffects.getGroundEffect === 'function')
      ? GroundEffects.getGroundEffect(tx, ty)
      : null;

    // OIL → ignite
    if (existing && existing.type === 'OIL' && typeof GroundEffects.igniteOil === 'function') {
      GroundEffects.igniteOil(tx, ty);
      return;
    }

    // WATER → steam
    if (existing && existing.type === 'WATER') {
      GroundEffects.setGroundEffect(tx, ty, 'STEAM');
      return;
    }

    // Empty floor / normal → chance of fire or smoke
    if (!existing || existing.type === 'NORMAL') {
      var rng = ctx.rng ? ctx.rng() : Math.random();
      if (rng < 0.50) {
        // All explosion fire tiles use the lifecycle system (no normal dissipation)
        // The lifecycle in ground-effects.js handles phased rescinding + scorch
        var fireOverrides = {
          dissipates: false,              // Lifecycle handles removal, not timer
          _explosionFire: true,           // Tag for lifecycle system
          _explosionDistance: distance,    // BFS distance from epicenter
          _explosionMaxRadius: radius,    // Total blast radius
          _explosionSpawnTime: Date.now() // When this fire was spawned
        };
        GroundEffects.setGroundEffect(tx, ty, 'FIRE', fireOverrides);
      } else if (rng < 0.80) {
        GroundEffects.setGroundEffect(tx, ty, 'SMOKE');
      }
    }
  }

  /**
   * Destroy any food items at the blast tile (burnt by explosion).
   */
  function _destroyFoodItems(tx, ty, ctx) {
    if (!ctx.items) return;
    for (var i = ctx.items.length - 1; i >= 0; i--) {
      var item = ctx.items[i];
      if (item && item.x === tx && item.y === ty && item.type === 'food') {
        console.log('[ExplosionSystem] Food item destroyed at ' + tx + ',' + ty + ': ' + (item.name || 'food'));
        if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
          OverheadAnimator.showGenericExpression(tx, ty, '🔥', 300, '#884400');
        }
        ctx.items.splice(i, 1);
      }
    }
  }

  /**
   * Trigger CSS screen shake animation on the game grid element.
   */
  function _triggerScreenShake() {
    try {
      var gridEl = document.getElementById('rogue-grid-mobile');
      if (gridEl) {
        // Shake: physical displacement
        gridEl.classList.remove('explosion-shake');
        void gridEl.offsetWidth; // Force reflow to restart animation (chain detonation)
        gridEl.classList.add('explosion-shake');
        gridEl.addEventListener('animationend', function onShakeEnd() {
          gridEl.classList.remove('explosion-shake');
          gridEl.removeEventListener('animationend', onShakeEnd);
        });

        // Flash: orange-red inset glow (layered on top of shake)
        gridEl.classList.remove('explosion-flash');
        void gridEl.offsetWidth;
        gridEl.classList.add('explosion-flash');
        gridEl.addEventListener('animationend', function onFlashEnd() {
          gridEl.classList.remove('explosion-flash');
          gridEl.removeEventListener('animationend', onFlashEnd);
        });
      }
    } catch (e) {
      // DOM not available (server-side or test context)
    }
  }

  /**
   * Spawn staggered 🔥 overhead emojis radiating out from epicenter.
   * Creates a visual ripple effect — each distance ring is delayed.
   */
  /**
   * Spawn staggered overhead emojis radiating out from epicenter.
   * Layer A lifecycle:
   *   Ring 1: 🔥 bright orange (closest to blast)
   *   Ring 2+: 💨 grey puff (reduced visual noise — "blvck joker" grey tint)
   * Duration and color scale with distance — farther = shorter, greyer.
   */
  function _spawnBlastRipple(epicX, epicY, radius, ctx) {
    if (typeof OverheadAnimator === 'undefined' || !OverheadAnimator.showGenericExpression) return;

    var intRadius = Math.ceil(radius);
    for (var d = 1; d <= intRadius; d++) {
      var tiles = _tilesAtDistance(epicX, epicY, d, ctx);
      // Ring 1 = fire, Ring 2+ = grey puff (less spammy)
      var ringEmoji = (d <= 1) ? '🔥' : '💨';
      var ringColor = (d <= 1) ? '#FF8800' : '#777777';
      var ringDuration = (d <= 1) ? 500 : Math.max(200, 400 - d * 60);
      for (var ti = 0; ti < tiles.length; ti++) {
        (function(tile, ring, idx, emoji, color, duration) {
          setTimeout(function() {
            OverheadAnimator.showGenericExpression(tile.x, tile.y, emoji, duration, color);
          }, ring * 80 + idx * 15);
        })(tiles[ti], d, ti, ringEmoji, ringColor, ringDuration);
      }
    }

    // Layer A Phase 4: After initial blast, spawn flickering tiny fire emojis
    // that rescind toward epicenter over ~3 seconds
    var rescindDelay = intRadius * 100 + 500; // After ripple finishes
    for (var rd = intRadius; rd >= 1; rd--) {
      var rTiles = _tilesAtDistance(epicX, epicY, rd, ctx);
      // Only ~30% of tiles get the rescind flicker (less spammy)
      for (var rti = 0; rti < rTiles.length; rti++) {
        if (Math.random() > 0.3) continue;
        (function(tile, ring, delay) {
          setTimeout(function() {
            // Small grey puff as the fire "pulls back"
            OverheadAnimator.showGenericExpression(tile.x, tile.y, '💨', 250, '#555555');
          }, delay + ring * 200);
        })(rTiles[rti], rd, rescindDelay);
      }
    }

    // Layer A Phase 5-6: Epicenter shrink + final grey puff
    var epicenterFinalDelay = rescindDelay + (intRadius * 200) + 800;
    setTimeout(function() {
      // Small fire flicker at epicenter
      OverheadAnimator.showGenericExpression(epicX, epicY, '🔥', 600, '#AA5500');
    }, epicenterFinalDelay);
    setTimeout(function() {
      // Final grey puff at epicenter
      OverheadAnimator.showGenericExpression(epicX, epicY, '💨', 400, '#444444');
    }, epicenterFinalDelay + 700);
  }

  /**
   * Get all in-bounds tiles at exactly `distance` Manhattan steps from (cx, cy).
   */
  function _tilesAtDistance(cx, cy, distance, ctx) {
    var tiles = [];
    for (var dx = -distance; dx <= distance; dx++) {
      var dy = distance - Math.abs(dx);
      // Two tiles per dx (positive and negative dy), except when dy === 0
      var candidates = (dy === 0) ? [{ x: cx + dx, y: cy }] :
        [{ x: cx + dx, y: cy + dy }, { x: cx + dx, y: cy - dy }];
      for (var ci = 0; ci < candidates.length; ci++) {
        var c = candidates[ci];
        if (c.x >= 0 && c.x < ctx.GRID_WIDTH && c.y >= 0 && c.y < ctx.GRID_HEIGHT) {
          tiles.push(c);
        }
      }
    }
    return tiles;
  }

  /**
   * Report the explosion to MOK, Debrief, and Tooltip systems.
   */
  function _reportExplosion(x, y, baseDamage, stats) {
    // MOK interjection
    if (typeof MOKSystem !== 'undefined' && MOKSystem.interject) {
      MOKSystem.interject('💥 Explosion! ' + stats.entitiesHit + ' target' +
        (stats.entitiesHit !== 1 ? 's' : '') + ' hit');
    }

    // Debrief feed
    if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportEvent) {
      DebriefFeedController.reportEvent('EXPLOSION', {
        x: x,
        y: y,
        damage: baseDamage,
        entitiesHit: stats.entitiesHit,
        chainsTriggered: stats.chainsTriggered
      });
    }

    // Tooltip
    if (typeof TooltipSystem !== 'undefined' && TooltipSystem.show) {
      TooltipSystem.show('💥 BOOM! ' + stats.entitiesHit + ' target' +
        (stats.entitiesHit !== 1 ? 's' : '') + ' hit', 2000);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ════════════════════════════════════════════════════════════════════

  return {
    detonate: detonate,
    applyBlastToTile: applyBlastToTile,
    pushEntity: pushEntity,

    // Expose constants for external configuration/testing
    MAX_CASCADE_DEPTH: MAX_CASCADE_DEPTH,
    PUSH_FORCE_BY_DISTANCE: PUSH_FORCE_BY_DISTANCE,
    WALL_IMPACT_DAMAGE: WALL_IMPACT_DAMAGE,
    ENTITY_COLLISION_DAMAGE: ENTITY_COLLISION_DAMAGE,
    FRIENDLY_FIRE_MULTIPLIER: FRIENDLY_FIRE_MULTIPLIER
  };
})();
