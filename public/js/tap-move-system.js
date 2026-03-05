/**
 * TapMoveSystem — mobile tap-to-move and fishing-move handlers.
 * Extracted Phase 18 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var TapMoveSystem = (function() {
  'use strict';
  console.log('[TapMoveSystem] Module loaded (v20260304c)');

  /**
   * Build a collision-check function with terrain penalty callback.
   * @param {Object} ctx - Context from monolith
   * @returns {Function} collisionCheck(x,y) with getTileMovePenalty property
   */
  function _buildCollisionCheck(ctx) {
    var collisionCheck = function(x, y) {
      return !ctx.isWalkable(x, y);
    };

    collisionCheck.getTileMovePenalty = function(x, y) {
      if (x < 0 || x >= ctx.GRID_WIDTH || y < 0 || y >= ctx.GRID_HEIGHT) return 0;
      var tile = ctx.grid[y][x];

      if (tile === ctx.TILES.WATER && ctx.TILE_EFFECTS && ctx.TILE_EFFECTS.WATER) {
        return ctx.TILE_EFFECTS.WATER.movePenalty || 0;
      }

      var key = x + ',' + y;
      if (ctx.tileMetadata[key] && ctx.tileMetadata[key].movePenalty) {
        return ctx.tileMetadata[key].movePenalty;
      }

      // GroundEffects movement penalty (can be negative e.g. ICE)
      if (typeof GroundEffects !== 'undefined' && typeof GroundEffects.getMovementPenalty === 'function') {
        return GroundEffects.getMovementPenalty(x, y) || 0;
      }

      return 0;
    };

    return collisionCheck;
  }

  /**
   * Handle a tap-to-move from mobile UI.
   * @param {number} targetX
   * @param {number} targetY
   * @param {boolean} runMode
   * @param {Object} ctx - Context from monolith
   * @returns {Object|undefined} Terminal response
   */
  function handleTapMove(targetX, targetY, runMode, ctx) {
    console.log('[TapMove:ENTER] target=' + targetX + ',' + targetY + ' active=' + ctx.active + ' moveLocked=' + ctx.playerMoveLocked);
    if (!ctx.active) { console.log('[TapMove] BLOCKED by !active'); return; }

    // Check if clicking on a breakable - kick it instead of moving
    // NOTE: Kicks are allowed even during moveLocked — they are a local
    // melee action that doesn't relocate the player.
    var breakableAtTarget = ctx.getBreakableAt(targetX, targetY);
    console.log('[TapMove] Target=' + targetX + ',' + targetY + ' breakable=' + (breakableAtTarget ? (breakableAtTarget.name + ' hp=' + breakableAtTarget.hp) : 'none') + ' player=' + ctx.player.x + ',' + ctx.player.y);
    if (breakableAtTarget && breakableAtTarget.hp > 0) {
      // Calculate direction to breakable
      var dx = targetX - ctx.player.x;
      var dy = targetY - ctx.player.y;

      // Only kick if adjacent (1 tile away)
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
        // Normalize direction for push
        var ndx = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
        var ndy = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

        // Use BreakableSystem.kickBreakable if available (push + damage)
        var kickResult = null;
        if (typeof BreakableSystem !== 'undefined' && BreakableSystem.kickBreakable) {
          kickResult = BreakableSystem.kickBreakable(breakableAtTarget, ndx, ndy, ctx);
        } else {
          // Fallback: just damage
          ctx.damageBreakable(breakableAtTarget, 0.2);
          kickResult = { damage: 0.2, pushed: false, pushDist: 0, destroyed: breakableAtTarget.hp <= 0 };
        }

        ctx.saveState();

        if (ctx.useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
          ctx.updateMobileGrid();
        }

        // Build feedback message
        var kickMsg;
        if (kickResult.destroyed) {
          kickMsg = '🥾💥 SMASHED ' + (breakableAtTarget.emoji || '📦') + ' ' + (breakableAtTarget.name || 'breakable');
        } else if (kickResult.pushed) {
          kickMsg = '🥾 KICKED ' + (breakableAtTarget.emoji || '📦') + ' (' + kickResult.pushDist + ' tile' + (kickResult.pushDist > 1 ? 's' : '') + ') HP ' + breakableAtTarget.hp;
        } else {
          kickMsg = '🥾 BOOTED ' + (breakableAtTarget.emoji || '📦') + ' (HP ' + breakableAtTarget.hp + ')';
        }

        return {
          lines: [kickMsg, ''].concat(ctx.renderGrid()),
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }
    }

    // Asteroids boss locks player movement — tap only activates cards
    if (ctx.playerMoveLocked) {
      return {
        lines: ['\u2693 GRAVITY ANCHOR \u2014 movement disabled. Use cards to fight!', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Route tap-to-move through smooth movement system when available.
    // If already mid-travel, skip init() to avoid teleporting the avatar
    // back to the stale logical position.
    if (typeof GoneRogueMovement !== 'undefined') {
      if (GoneRogueMovement.isMoving && GoneRogueMovement.isMoving()) {
        // Already moving — setTarget() will re-path from current visual pos
      } else {
        var vis = GoneRogueMovement.getVisualPosition ? GoneRogueMovement.getVisualPosition() : null;
        var initX = (vis && isFinite(vis.x)) ? Math.round(vis.x) : ctx.player.x;
        var initY = (vis && isFinite(vis.y)) ? Math.round(vis.y) : ctx.player.y;
        GoneRogueMovement.init(initX, initY);
      }

      var collisionCheck = _buildCollisionCheck(ctx);
      GoneRogueMovement.setTarget(targetX, targetY, collisionCheck, !!runMode);

      if (ctx.useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        ctx.updateMobileGrid();
      }

      return {
        lines: ['Moving...', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    // Fallback: instant single-step move
    var dx2 = targetX - ctx.player.x;
    var dy2 = targetY - ctx.player.y;

    // Normalize to -1, 0, or 1
    var stepX = dx2 === 0 ? 0 : (dx2 > 0 ? 1 : -1);
    var stepY = dy2 === 0 ? 0 : (dy2 > 0 ? 1 : -1);

    var moveResult = ctx.movePlayer(stepX, stepY, runMode);

    if (ctx.useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      ctx.updateMobileGrid();
    }

    return moveResult;
  }

  /**
   * Handle fishing move from mobile UI (smooth movement along path).
   * @param {Array} path - Array of {x, y} waypoints
   * @param {boolean} isSprinting
   * @param {Object} ctx - Context from monolith
   * @returns {Object|undefined} Terminal response
   */
  function handleFishingMove(path, isSprinting, ctx) {
    if (!ctx.active) return;
    if (!path || path.length === 0) return;

    // Validate every waypoint in the path is walkable — reject paths that
    // cut through walls (safety net against pathfinder fallback bugs).
    for (var pi = 0; pi < path.length; pi++) {
      if (!ctx.isWalkable(path[pi].x, path[pi].y)) {
        // Trim path to the last walkable waypoint before the wall
        path = path.slice(0, pi);
        break;
      }
    }
    if (path.length === 0) return;

    // Start movement toward the fishing path destination.
    // If the player is already mid-travel, use their current visual position
    // as the origin instead of the logical grid position (which may lag behind
    // the avatar by several tiles). Only call init() when the movement system
    // has never been initialized (cold start).
    if (typeof GoneRogueMovement !== 'undefined') {
      if (GoneRogueMovement.isMoving && GoneRogueMovement.isMoving()) {
        // Already moving — do NOT call init() which would teleport the avatar
        // back to the logical position. setTarget() will re-path from the
        // current visual position.
      } else {
        // Cold start — initialize from visual position if available,
        // otherwise fall back to logical grid position.
        var vis = GoneRogueMovement.getVisualPosition ? GoneRogueMovement.getVisualPosition() : null;
        var initX = (vis && isFinite(vis.x)) ? Math.round(vis.x) : ctx.player.x;
        var initY = (vis && isFinite(vis.y)) ? Math.round(vis.y) : ctx.player.y;
        GoneRogueMovement.init(initX, initY);
      }

      var collisionCheck = _buildCollisionCheck(ctx);
      var destination = path[path.length - 1];
      GoneRogueMovement.setTarget(destination.x, destination.y, collisionCheck, isSprinting);

      // Update mobile UI to start animation
      if (ctx.useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        ctx.updateMobileGrid();
      }

      return {
        lines: ['Moving...', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    } else {
      // Fallback to instant move
      return handleTapMove(path[path.length - 1].x, path[path.length - 1].y, isSprinting || false, ctx);
    }
  }

  return {
    handleTapMove: handleTapMove,
    handleFishingMove: handleFishingMove
  };
})();
