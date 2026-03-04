/**
 * GameTickSystem — main game loop tick update (movement, enemies, projectiles,
 * ground effects, lighting, decay).
 * Extracted Phase 20 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var GameTickSystem = (function() {
  'use strict';

  /**
   * Update all game state for one tick.
   * @param {number} deltaMs - Elapsed ms since last tick
   * @param {Object} ctx - Context from monolith
   */
  function updateGameState(deltaMs, ctx) {
    // Update smooth movement system
    if (typeof GoneRogueMovement !== 'undefined' && GoneRogueMovement.isMoving()) {
      var collisionCheck = function(x, y) {
        return !ctx.isWalkable(x, y);
      };

      GoneRogueMovement.update(collisionCheck);

      // Update player position from movement system
      var logical = GoneRogueMovement.getLogicalPosition();
      var visual = GoneRogueMovement.getVisualPosition();

      // Check if logical position changed (player reached next tile)
      if (ctx.player.x !== logical.x || ctx.player.y !== logical.y) {
        // Update player grid position
        var oldX = ctx.player.x;
        var oldY = ctx.player.y;
        ctx.player.x = logical.x;
        ctx.player.y = logical.y;

        // Update last move direction for flanking
        if (logical.x > oldX) ctx.player.lastMoveDirection = 'east';
        else if (logical.x < oldX) ctx.player.lastMoveDirection = 'west';
        else if (logical.y > oldY) ctx.player.lastMoveDirection = 'south';
        else if (logical.y < oldY) ctx.player.lastMoveDirection = 'north';

        // Check for items, currency, enemies at new position
        ctx.checkPlayerInteractions();

        // Floor 0 scripted walk: two-phase system (tavern pause → exit stop)
        if (ctx.getScriptedWalk() && ctx.getScriptedWalkTarget()) {
          var swt = ctx.getScriptedWalkTarget();
          if (ctx.player.x === swt.x && ctx.player.y === swt.y) {
            if (typeof GoneRogueMovement !== 'undefined') GoneRogueMovement.stop();

            var phase = ctx.getScriptedWalkPhase();
            if (phase === 1) {
              // Phase 1 complete: arrived at tavern door — pause and show hint
              ctx.setScriptedWalkPhase(2);
              ctx.setScriptedWalk(false);
              ctx.setScriptedWalkTarget(null);
              ctx.showTutorialHint('tavern_hint', '\uD83D\uDC46 Tap to explore the tavern \u2014 or wait to continue', 3500);

              // After 3.5s pause, resume walk toward exit
              setTimeout(function() {
                if (ctx.getScriptedWalkPhase() === 2 && ctx.getScriptedWalkExitTarget()) {
                  ctx.setScriptedWalkPhase(3);
                  ctx.setScriptedWalk(true);
                  ctx.setScriptedWalkTarget(ctx.getScriptedWalkExitTarget());
                  if (typeof GoneRogueMovement !== 'undefined') {
                    GoneRogueMovement.startMoveTo(ctx.getScriptedWalkExitTarget().x, ctx.getScriptedWalkExitTarget().y);
                  }
                }
              }, 3500);
            } else if (phase === 3) {
              // Phase 3 complete: arrived at exit — stop and let player tap the door
              ctx.setScriptedWalk(false);
              ctx.setScriptedWalkTarget(null);
              ctx.setScriptedWalkPhase(0);
              ctx.showTutorialHint('exit_hint', '\uD83D\uDEAA Tap the door to enter the forest', 4000);
            } else {
              // Fallback: clear scripted walk
              ctx.setScriptedWalk(false);
              ctx.setScriptedWalkTarget(null);
            }
          }
        }
      }

      // Store visual position for rendering
      ctx.player.visualX = visual.x;
      ctx.player.visualY = visual.y;

      // Update tooltip positions for continuous movement
      if (typeof TooltipThumb !== 'undefined') {
        var playerPos = { x: visual.x, y: visual.y };
        TooltipThumb.updatePosition('player', playerPos);
      }

      // Update mobile UI with new positions
      if (ctx.useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        ctx.updateMobileGrid();
      }
    }

    // Update pets based on player position history
    if (typeof PetFollower !== 'undefined') {
      var currentTime = Date.now();
      PetFollower.updatePets(ctx.player.positionHistory, currentTime);

      PetFollower.checkBreakables(ctx.breakables, function(breakable, index) {
        ctx.breakables.splice(index, 1);
        console.log('[Pet] Broke breakable at', breakable.x, breakable.y);
        if (typeof OverheadAnimator !== 'undefined') {
          OverheadAnimator.showGenericExpression(breakable.x, breakable.y, '\uD83D\uDCA5', 800);
        }
      });
    }

    // Update enemy positions and awareness
    var _ep0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;
    var enemies = ctx.enemies;
    var player = ctx.player;
    for (var ei = 0; ei < enemies.length; ei++) {
      var enemy = enemies[ei];
      if (enemy.hp <= 0) continue;

      // Check treasure goblin timeout (15 seconds to kill)
      if (enemy.isTreasureGoblin && enemy.goblinSpawnTime && typeof SecretFloors !== 'undefined') {
        var goblinAge = (Date.now() - enemy.goblinSpawnTime) / 1000;
        var goblinTimeout = 15;

        if (goblinAge > goblinTimeout) {
          var triggerResult = SecretFloors.triggerSecretFloor(
            SecretFloors.TRIGGER_TYPES.GOBLIN_TIMEOUT,
            { goblinTimeExpired: true }
          );
          if (triggerResult.success) {
            console.log('[GoneRogue] Treasure goblin escaped - secret floor triggered!');
          }
          enemy.hp = 0;
        }
      }

      // Update Elite enemies with special behavior
      if (enemy.isElite && typeof EliteEnemies !== 'undefined') {
        EliteEnemies.updateElite(enemy, player, ctx.grid, deltaMs);
      }

      // Update enemy pathing
      ctx.updateEnemyPath(enemy, deltaMs);

      // Box interaction: check when enemy arrives at a new integer tile
      if (enemy.x !== enemy._lastBoxCheckX || enemy.y !== enemy._lastBoxCheckY) {
        enemy._lastBoxCheckX = enemy.x;
        enemy._lastBoxCheckY = enemy.y;
        ctx.checkEnemyBoxInteraction(enemy);
      }

      // Update awareness decay
      ctx.updateEnemyAwareness(enemy, deltaMs);

      // Coarse distance pre-cull
      var dxCull = player.x - enemy.x;
      var dyCull = player.y - enemy.y;
      if (dxCull * dxCull + dyCull * dyCull <= 100) {
        if (ctx.isPlayerInSightCone(enemy)) {
          ctx.increaseEnemyAwareness(enemy, 10);
          if (!ctx.strCombatActive) {
            ctx.enterStrCombat(enemy, 'enemy_sighting');
          }
        }
      }
    }
    if (_ep0 && typeof EYESONLY_PERF !== 'undefined') {
      EYESONLY_PERF.mark('rogue.enemyPathMs', performance.now() - _ep0);
    }

    // Throttle projectile advancement
    ctx.addProjectileTickAccum(deltaMs);
    var projectiles = ctx.projectiles;
    if (projectiles.length > 0 && ctx.getProjectileTickAccum() >= ctx.projectileAdvanceInterval) {
      ctx.resetProjectileTickAccum();
      ctx.updateProjectiles(deltaMs);
    } else if (projectiles.length === 0) {
      ctx.resetProjectileTickAccum();
    }

    // Let the active boss inject real-time hazard projectiles
    var activeBoss = ctx.getActiveBoss();
    if (ctx.bossFloorActive && activeBoss && !ctx.bossDefeated &&
        typeof activeBoss.updateRealTime === 'function') {
      var bossRt = activeBoss.updateRealTime(deltaMs, {
        player: player,
        grid: ctx.grid,
        enemies: enemies
      });
      if (bossRt && bossRt.bossProjectiles && bossRt.bossProjectiles.length) {
        bossRt.bossProjectiles.forEach(function(p) {
          if (typeof ProjectileSystem !== 'undefined') { ProjectileSystem.addProjectile(p); }
          else { projectiles.push(p); }
        });
        if (typeof ProjectileSystem !== 'undefined') ctx.syncProjectileState();
      }
      if (activeBoss.playerMoveLocked !== undefined) {
        ctx.setPlayerMoveLocked(!!activeBoss.playerMoveLocked);
      }
    }

    // Decay items and currencies
    var now = Date.now();
    ctx.setItems(ctx.filterFloorItems(function(item) {
      if (item.spawnTime && item.decayTime) {
        return (now - item.spawnTime) < item.decayTime;
      }
      return true;
    }));

    ctx.setCurrencies(ctx.filterCurrencies(function(currency) {
      if (currency.spawnTime && currency.decayTime) {
        return (now - currency.spawnTime) < currency.decayTime;
      }
      return true;
    }));

    // Magnet auto-collect
    ctx.magnetAutoCollect(now);

    // Update color cycle timer
    ctx.addEnemyColorCycleTime(deltaMs);

    // Update ground effects system
    if (typeof GroundEffects !== 'undefined') {
      GroundEffects.update(deltaMs, ctx.GRID_WIDTH, ctx.GRID_HEIGHT);

      // Apply ground effect damage to player (rate-limited DOT)
      var playerGroundEffect = GroundEffects.getGroundEffect(player.x, player.y);
      var playerGroundDamage = playerGroundEffect ? (playerGroundEffect.damage || 0) : 0;
      if (playerGroundDamage > 0) {
        // Rate-limit damage (damageCooldownMs) to prevent per-tick instakill
        var cooldownMs = playerGroundEffect.damageCooldownMs || 0;
        var _now = Date.now();
        var canApply = true;
        if (cooldownMs > 0) {
          var lastHit = playerGroundEffect._lastDamageTime || 0;
          if (_now - lastHit < cooldownMs) canApply = false;
          else playerGroundEffect._lastDamageTime = _now;
        }
        if (canApply) {
          player.hp = Math.max(0, player.hp - playerGroundDamage);
          // Overhead fire damage animation
          try {
            if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
              OverheadAnimator.showGenericExpression(player.x, player.y, '🔥', 350, '#ff3300');
            }
          } catch (eOH) {}
          // Report to debrief feed
          try {
            if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
              DebriefFeedController.reportResourceChange('HP', player.hp + playerGroundDamage, player.hp, '🔥 Burning');
            }
          } catch (eDF) {}
          if (player.hp <= 0) {
            return ctx.handlePlayerDeath('burning');
          }
        }
      }

      // Apply ground effect damage to enemies
      for (var gi = 0; gi < enemies.length; gi++) {
        var ge = enemies[gi];
        if (ge.hp <= 0) continue;
        var enemyGroundDamage = GroundEffects.getDamage(ge.x, ge.y);
        if (enemyGroundDamage > 0) {
          var hpBefore = ge.hp;
          ge.hp = Math.max(0, ge.hp - enemyGroundDamage);
          if (ge.hp <= 0 && hpBefore > 0) {
            ctx.handleEnemyDeath(ge, 'environment', {
              location: { x: ge.x, y: ge.y },
              hazardType: 'ground_effect',
              damage: enemyGroundDamage
            });
          }
        }
      }
    }

    // Update lighting system
    if (typeof LightingSystem !== 'undefined') {
      ctx.updatePlayerLight();
      LightingSystem.updateEnemyLights(enemies);

      ctx.incrementLightMapTickCounter();
      if (ctx.getLightMapTickCounter() >= 5) {
        ctx.resetLightMapTickCounter();
        var _lt0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;
        LightingSystem.updateLightMap(ctx.GRID_WIDTH, ctx.GRID_HEIGHT, ctx.getAllLightBlockers());
        if (_lt0 && typeof EYESONLY_PERF !== 'undefined') {
          EYESONLY_PERF.mark('lighting.updateLightMapMs', performance.now() - _lt0);
        }
      }
    }

    // Re-render if using interactive grid
    if (ctx.useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      ctx.updateMobileGrid();
    }
  }

  return {
    updateGameState: updateGameState
  };
})();
