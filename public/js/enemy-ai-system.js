/* ============================================================
   Enemy AI System — Extracted from gone-rogue.js
   Patrol movement, awareness, sight cones, line-of-sight
   ============================================================ */

var EnemyAISystem = (function () {
  'use strict';

  // ── Patrol Movement ────────────────────────────────────────

  /**
   * Update enemy path movement
   * @param {Object} enemy - Enemy object (mutated in-place)
   * @param {number} deltaMs - Time since last tick
   * @param {Object} ctx - { grid, GRID_WIDTH, GRID_HEIGHT, TILES, PATH_TYPES }
   */
  function updateEnemyPath(enemy, deltaMs, ctx) {
    if (!enemy.path) return;

    enemy.pathTimer = (enemy.pathTimer || 0) + deltaMs;

    if (enemy.pathTimer >= 500) {
      enemy.pathTimer = 0;

      if (enemy.path.type === ctx.PATH_TYPES.PATROL) {
        _moveEnemyPatrol(enemy, ctx);
      } else if (enemy.path.type === ctx.PATH_TYPES.CIRCULAR) {
        _moveEnemyCircular(enemy, ctx);
      } else if (enemy.path.type === ctx.PATH_TYPES.ELLIPSE) {
        _moveEnemyEllipse(enemy, ctx);
      } else if (enemy.path.type === ctx.PATH_TYPES.STATIONARY) {
        _rotateEnemyInPlace(enemy);
      }
    }
  }

  function _moveEnemyPatrol(enemy, ctx) {
    if (!enemy.path.points || enemy.path.points.length < 2) return;

    var currentIndex = enemy.pathIndex || 0;
    var direction = enemy.pathDirection || 1;

    currentIndex += direction;

    if (currentIndex >= enemy.path.points.length) {
      currentIndex = enemy.path.points.length - 2;
      direction = -1;
    } else if (currentIndex < 0) {
      currentIndex = 1;
      direction = 1;
    }

    enemy.pathIndex = currentIndex;
    enemy.pathDirection = direction;

    var point = enemy.path.points[currentIndex];
    _moveEnemyToPoint(enemy, point, ctx);
  }

  function _moveEnemyCircular(enemy, ctx) {
    if (!enemy.path.points || enemy.path.points.length < 2) return;

    var currentIndex = (enemy.pathIndex || 0) + 1;
    if (currentIndex >= enemy.path.points.length) {
      currentIndex = 0;
    }

    enemy.pathIndex = currentIndex;
    var point = enemy.path.points[currentIndex];
    _moveEnemyToPoint(enemy, point, ctx);
  }

  function _moveEnemyEllipse(enemy, ctx) {
    if (!enemy.path.ellipse) return;

    var angle = (enemy.pathAngle || 0) + 0.1;
    if (angle >= Math.PI * 2) angle = 0;

    enemy.pathAngle = angle;

    var cx = enemy.path.ellipse.cx;
    var cy = enemy.path.ellipse.cy;
    var rx = enemy.path.ellipse.rx;
    var ry = enemy.path.ellipse.ry;

    var x = Math.floor(cx + rx * Math.cos(angle));
    var y = Math.floor(cy + ry * Math.sin(angle));

    _moveEnemyToPoint(enemy, { x: x, y: y }, ctx);
  }

  function _rotateEnemyInPlace(enemy) {
    var orientations = ['north', 'east', 'south', 'west'];
    var currentIndex = orientations.indexOf(enemy.orientation || 'north');
    var nextIndex = (currentIndex + 1) % orientations.length;
    enemy.orientation = orientations[nextIndex];
  }

  function _moveEnemyToPoint(enemy, point, ctx) {
    if (point.x < 0 || point.x >= ctx.GRID_WIDTH || point.y < 0 || point.y >= ctx.GRID_HEIGHT) return;
    if (ctx.grid[point.y][point.x] === ctx.TILES.WALL) return;

    var dx = point.x - enemy.x;
    var dy = point.y - enemy.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      enemy.orientation = dx > 0 ? 'east' : 'west';
    } else {
      enemy.orientation = dy > 0 ? 'south' : 'north';
    }

    enemy.x = point.x;
    enemy.y = point.y;
  }

  // ── Awareness ──────────────────────────────────────────────

  /**
   * Update enemy awareness (decay over time)
   * @param {Object} enemy - Enemy object (mutated in-place)
   * @param {number} deltaMs - Time since last tick
   */
  function updateEnemyAwareness(enemy, deltaMs) {
    if (!enemy.awareness) enemy.awareness = 0;

    var decay = (5 * deltaMs) / 1000;
    enemy.awareness = Math.max(0, enemy.awareness - decay);
  }

  /**
   * Increase enemy awareness
   * @param {Object} enemy - Enemy object (mutated in-place)
   * @param {number} amount - Amount to increase
   * @param {Object} ctx - { AWARENESS_STATES }
   */
  function increaseEnemyAwareness(enemy, amount, ctx) {
    var previousAwareness = enemy.awareness || 0;
    enemy.awareness = Math.min(150, previousAwareness + amount);

    if (previousAwareness < ctx.AWARENESS_STATES.ALERTED.min && enemy.awareness >= ctx.AWARENESS_STATES.ALERTED.min) {
      // MGS-style "!" alert — overhead animation + sound
      if (typeof OverheadAnimator !== 'undefined') {
        OverheadAnimator.showExpression(enemy.x, enemy.y, 'ALERT', 1000);
      }
      if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
        AudioSystem.play('enemy-alert', { volume: 0.6 });
      }
      if (typeof TooltipSystem !== 'undefined' && TooltipSystem.show) {
        TooltipSystem.show('! Enemy alerted!', 1500);
      }
    }

    // Suspicious threshold — "?" expression
    if (previousAwareness < ctx.AWARENESS_STATES.SUSPICIOUS.min && enemy.awareness >= ctx.AWARENESS_STATES.SUSPICIOUS.min) {
      if (typeof OverheadAnimator !== 'undefined') {
        OverheadAnimator.showExpression(enemy.x, enemy.y, 'QUESTION', 800);
      }
    }
  }

  /**
   * Get enemy awareness state
   * @param {Object} enemy - Enemy object
   * @param {Object} ctx - { AWARENESS_STATES }
   * @returns {Object} awareness state object
   */
  function getEnemyAwarenessState(enemy, ctx) {
    var awareness = enemy.awareness || 0;

    if (awareness >= ctx.AWARENESS_STATES.ENGAGED.min) return ctx.AWARENESS_STATES.ENGAGED;
    if (awareness >= ctx.AWARENESS_STATES.ALERTED.min) return ctx.AWARENESS_STATES.ALERTED;
    if (awareness >= ctx.AWARENESS_STATES.SUSPICIOUS.min) return ctx.AWARENESS_STATES.SUSPICIOUS;
    return ctx.AWARENESS_STATES.UNAWARE;
  }

  // ── Sight & Line of Sight ─────────────────────────────────

  /**
   * Check if player is in enemy sight cone
   * @param {Object} enemy - Enemy object
   * @param {Object} ctx - { player, grid, GRID_WIDTH, GRID_HEIGHT, TILES, getPlayerStealthBonus, playerInBox, BOX_EVASION_CHANCE }
   * @returns {boolean}
   */
  function isPlayerInSightCone(enemy, ctx) {
    if (!enemy.orientation) return false;

    var dx = ctx.player.x - enemy.x;
    var dy = ctx.player.y - enemy.y;

    var maxPossibleSightRange = (enemy.sightRange || 5) + 1;
    if (Math.abs(dx) > maxPossibleSightRange || Math.abs(dy) > maxPossibleSightRange) {
      return false;
    }

    var distanceSq = dx * dx + dy * dy;

    var baseSightRange = enemy.sightRange || 5;
    var stealthBonus = ctx.getPlayerStealthBonus();
    var effectiveSightRange = baseSightRange * (1 - stealthBonus / 100);

    if (distanceSq > effectiveSightRange * effectiveSightRange) return false;

    if (checkLineOfSight(enemy.x, enemy.y, ctx.player.x, ctx.player.y, ctx)) {
      return false;
    }

    // Box evasion
    if (ctx.playerInBox) {
      var boxEvasion = ctx.BOX_EVASION_CHANCE[ctx.playerInBox.quality] || 0.85;
      if (Math.random() < boxEvasion) {
        return false;
      }
    }

    var angleToPlayer = Math.atan2(dy, dx);

    var orientationAngles = {
      'east': 0,
      'south': Math.PI / 2,
      'west': Math.PI,
      'north': -Math.PI / 2
    };

    var orientationAngle = orientationAngles[enemy.orientation] || 0;
    var coneAngle = Math.PI / 3;

    var angleDiff = Math.abs(angleToPlayer - orientationAngle);
    while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - 2 * Math.PI);

    return angleDiff <= coneAngle / 2;
  }

  /**
   * Check if line of sight is blocked by cover
   * @returns {boolean} true if blocked, false if clear
   */
  function checkLineOfSight(x1, y1, x2, y2, ctx) {
    var dx = Math.abs(x2 - x1);
    var dy = Math.abs(y2 - y1);
    var sx = x1 < x2 ? 1 : -1;
    var sy = y1 < y2 ? 1 : -1;
    var err = dx - dy;

    var x = x1;
    var y = y1;

    while (!(x === x2 && y === y2)) {
      if (x >= 0 && x < ctx.GRID_WIDTH && y >= 0 && y < ctx.GRID_HEIGHT) {
        var tile = ctx.grid[y][x];
        if (tile === ctx.TILES.COVER || tile === ctx.TILES.WALL) {
          return true;
        }
      }

      var e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return false;
  }

  // ── Public API ─────────────────────────────────────────────

  return {
    updateEnemyPath: updateEnemyPath,
    updateEnemyAwareness: updateEnemyAwareness,
    increaseEnemyAwareness: increaseEnemyAwareness,
    getEnemyAwarenessState: getEnemyAwarenessState,
    isPlayerInSightCone: isPlayerInSightCone,
    checkLineOfSight: checkLineOfSight
  };
})();
