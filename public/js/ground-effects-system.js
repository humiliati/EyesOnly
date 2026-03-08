/**
 * GroundEffectsSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless — reads GroundEffects external module + ctx)
 * Handles: tile effect application, water slowdown visuals,
 *          water electrification, and combat ground-effect modifiers.
 *
 * Loaded before gone-rogue.js via <script> tag.
 */
var GroundEffectsSystem = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // applyTileEffects — check tile + ground effect at (x,y), return message
  // ------------------------------------------------------------------
  function applyTileEffects(x, y, ctx) {
    var tile = ctx.grid[y][x];
    var key = x + ',' + y;
    var metadata = ctx.tileMetadata[key];
    var message = null;

    // Check for ground effects (water, oil, etc.)
    if (typeof GroundEffects !== 'undefined') {
      var groundEffect = GroundEffects.getGroundAt(x, y);
      if (groundEffect && groundEffect.movePenalty) {
        if (groundEffect.type === 'WATER' || groundEffect.char === '~') {
          applyWaterSlowdownEffect();
          // ── Audio: water splash step ──
          if (typeof AudioSystem !== 'undefined' && AudioSystem.playRandom) {
            AudioSystem.playRandom('water', 3, { volume: 0.3 });
          }
        }
      }
    }

    // Food × ground-effect interaction check (inert food history)
    if (typeof FoodGroundInteraction !== 'undefined') {
      var foodMsg = FoodGroundInteraction.checkAndApply(x, y, ctx);
      if (foodMsg) message = foodMsg;
    }

    // Hazard damage (check food buff immunity first)
    if (tile === ctx.TILES.HAZARD || (metadata && metadata.type === 'hazard')) {
      var hasFoodFireImmunity = (typeof GAMESTATE !== 'undefined' && GAMESTATE.hasFoodBuff
        && GAMESTATE.hasFoodBuff('fireImmunity', ctx.turn || 0));
      if (hasFoodFireImmunity) {
        message = '💧 Fire immunity active!';
      } else {
        var damage = metadata ? metadata.damage : 1;
        ctx.player.hp -= damage;
        message = '🟥 HAZARD! -' + damage + ' HP';

        // ── Audio: fire/hazard rumble ──
        if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
          AudioSystem.play('rumble-1', { volume: 0.4 });
        }

        if (ctx.player.hp <= 0) {
          return ctx.handlePlayerDeath('environmental_hazard', {
            damage: damage,
            location: { x: ctx.player.x, y: ctx.player.y }
          });
        }
      }
    }

    // Stealth bonuses
    if (tile === ctx.TILES.SHADOW || tile === ctx.TILES.GRASS || tile === ctx.TILES.SMOKE) {
      if (tile === ctx.TILES.SHADOW) {
        message = '⬛ Entered shadow (stealth +30%)';
      } else if (tile === ctx.TILES.GRASS) {
        message = '🟩 Grass cover (stealth +20%)';
      } else if (tile === ctx.TILES.SMOKE) {
        message = '🌫️  Smoke/fog (stealth +40%)';
      }
    }

    return message;
  }

  // ------------------------------------------------------------------
  // applyWaterSlowdownEffect — blue wave CSS animation on game frame
  // ------------------------------------------------------------------
  function applyWaterSlowdownEffect() {
    var gameFrame = document.getElementById('game-frame');
    if (!gameFrame) {
      gameFrame = document.querySelector('.game-window');
    }

    if (gameFrame) {
      gameFrame.classList.add('water-slowdown-effect');
      setTimeout(function () {
        gameFrame.classList.remove('water-slowdown-effect');
      }, 1000);
    }
  }

  // ------------------------------------------------------------------
  // electrifyWater — BFS spread electrified status on water tiles
  // ------------------------------------------------------------------
  function electrifyWater(x, y, radius) {
    if (typeof GroundEffects === 'undefined') return;

    var queue = [{ x: x, y: y, dist: 0 }];
    var visited = {};
    visited[x + ',' + y] = true;

    while (queue.length > 0) {
      var current = queue.shift();

      var groundEffect = GroundEffects.getGroundEffect(current.x, current.y);
      if (groundEffect && groundEffect.type === 'WATER') {
        GroundEffects.setGroundEffect(current.x, current.y, 'WATER', {
          electrified: true,
          electrifiedTime: Date.now(),
          electrifiedDuration: 6000
        });
      }

      if (current.dist < radius) {
        var neighbors = [
          { x: current.x + 1, y: current.y },
          { x: current.x - 1, y: current.y },
          { x: current.x, y: current.y + 1 },
          { x: current.x, y: current.y - 1 }
        ];

        for (var i = 0; i < neighbors.length; i++) {
          var n = neighbors[i];
          var key = n.x + ',' + n.y;

          if (n.x >= 0 && n.x < GRID_WIDTH && n.y >= 0 && n.y < GRID_HEIGHT && !visited[key]) {
            visited[key] = true;

            var neighborEffect = GroundEffects.getGroundEffect(n.x, n.y);
            if (neighborEffect && (neighborEffect.type === 'WATER' || neighborEffect.conductive)) {
              queue.push({ x: n.x, y: n.y, dist: current.dist + 1 });
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // applyGroundEffectModifiers — combat start: scan player + enemy tiles
  // ------------------------------------------------------------------
  function applyGroundEffectModifiers(ctx) {
    if (typeof GroundEffects === 'undefined') return;

    var playerGroundEffect = GroundEffects.getGroundEffect(ctx.player.x, ctx.player.y);
    var enemyGroundEffect = null;

    if (ctx.strCombatEnemy) {
      enemyGroundEffect = GroundEffects.getGroundEffect(ctx.strCombatEnemy.x, ctx.strCombatEnemy.y);
    }

    var log = [];

    if (playerGroundEffect) {
      log = log.concat(applyPlayerGroundModifier(playerGroundEffect, ctx));
    }

    if (enemyGroundEffect && ctx.strCombatEnemy) {
      log = log.concat(applyEnemyGroundModifier(enemyGroundEffect, ctx.strCombatEnemy, ctx));
    }

    return log;
  }

  // ------------------------------------------------------------------
  // applyPlayerGroundModifier — fire/water/ice/waste effects on player
  // ------------------------------------------------------------------
  function applyPlayerGroundModifier(effect, ctx) {
    if (!effect) return [];
    var log = [];

    if (effect.type === 'FIRE' || effect.type === 'OIL_IGNITED') {
      var burnDamage = Math.floor(ctx.player.maxHp * 0.1);
      ctx.player.hp = Math.max(1, ctx.player.hp - burnDamage);
      log.push('🔥 STANDING IN FIRE! -' + burnDamage + ' HP');
      log.push('└─ Burn status applied');
    } else if (effect.type === 'WATER' && effect.electrified) {
      log.push('⚡ STANDING IN ELECTRIFIED WATER!');
      log.push('└─ Shock risk, -20% evasion');
    } else if (effect.type === 'INDUSTRIAL_WASTE') {
      if (ctx.rng() < 0.3) {
        log.push('☢️  TOXIC WASTE EXPOSURE!');
        log.push('└─ Random debuff applied');
      }
    } else if (effect.type === 'WATER') {
      log.push('💧 Standing in water: -10% evasion');
    } else if (effect.type === 'ICE') {
      var accPen = (effect.accuracyPenaltyPct != null) ? effect.accuracyPenaltyPct : 12;
      var evPen = (effect.evasionPenaltyPts != null) ? effect.evasionPenaltyPts : 2;
      ctx.player.tempAccuracyBoost = (ctx.player.tempAccuracyBoost || 0) - accPen;
      ctx.player.tempEvasion = (ctx.player.tempEvasion || 0) - evPen;
      log.push('🧊 ICE: speed up, but slip risk');
      log.push('└─ Accuracy -' + accPen + '%, Evasion -' + evPen);
      // ── Audio: ice slide ──
      if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
        AudioSystem.play('ice-1', { volume: 0.3 });
      }
    }

    return log;
  }

  // ------------------------------------------------------------------
  // applyEnemyGroundModifier — fire/water/waste effects on enemy
  // ------------------------------------------------------------------
  function applyEnemyGroundModifier(effect, enemy, ctx) {
    if (!effect || !enemy) return [];
    var log = [];

    if (effect.type === 'FIRE' || effect.type === 'OIL_IGNITED') {
      var burnDamage = Math.floor(enemy.maxHp * 0.15);
      enemy.hp = Math.max(1, enemy.hp - burnDamage);
      log.push('🔥 ENEMY IN FIRE! -' + burnDamage + ' HP');

      if (enemy.hp <= burnDamage && enemy.tier === 'SCOUT') {
        enemy.hp = 0;
        log.push('└─ Enemy KO\'d by fire!');
      }
    } else if (effect.type === 'WATER' && effect.electrified) {
      log.push('⚡ ENEMY IN ELECTRIFIED WATER!');
      log.push('└─ Enemy stunned turn 1');
      enemy.stunnedTurns = 1;
    } else if (effect.type === 'INDUSTRIAL_WASTE') {
      if (ctx.rng() < 0.3) {
        log.push('☢️  Enemy exposed to toxic waste');
        log.push('└─ Enemy weakened');
        enemy.weakened = true;
      }
    }

    return log;
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    applyTileEffects: applyTileEffects,
    applyWaterSlowdownEffect: applyWaterSlowdownEffect,
    electrifyWater: electrifyWater,
    applyGroundEffectModifiers: applyGroundEffectModifiers
  };
})();
