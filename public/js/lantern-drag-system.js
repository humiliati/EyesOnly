/**
 * LanternDragSystem — When the player collides with a draggable breakable
 * light source (🏮 Lamp Post / Lantern), the light source attaches to
 * the player and "drags" along with them. While dragging:
 *   · Light source follows player tile position each frame
 *   · Player movement speed reduced by DRAG_SPEED_PENALTY (10%)
 *   · The breakable's grid position updates to the player's tile
 *   · Overhead glow indicator shows the dragged lantern emoji
 *
 * Detach conditions:
 *   · Player taps self (cancel)
 *   · Player kicks another breakable
 *   · STR combat starts
 *   · Player moves > DROP_DISTANCE tiles from attach point without stopping
 *   · Player explicitly drops via dropDraggedLantern()
 *
 * Stateless IIFE — all game state accessed via ctx or module-level state.
 */
var LanternDragSystem = (function() {
  'use strict';

  // ── Config ──
  var DRAG_SPEED_PENALTY = 0.10;   // 10% movement speed reduction
  var DROP_DISTANCE = 8;           // Auto-drop if player drags too far (active grab)
  var WAFT_DISTANCE = 3;           // Auto-drop for passive waft (walk-through)
  var DRAG_GLOW_COLOR = '#ffe7b0'; // Warm lantern glow for overhead
  var DRAG_GLOW_INTERVAL = 2400;   // ms between glow pulses

  // ── State ──
  var _draggedBreakable = null;    // The breakable object being dragged
  var _attachTileX = 0;            // Where the lantern was picked up
  var _attachTileY = 0;
  var _lastGlowTime = 0;
  var _isPassiveWaft = false;      // true = passive walk-through, false = active tap grab

  /**
   * Check if a breakable is draggable (lantern/lamp post).
   * Uses tile-animation-system metadata: { draggable: true }
   * AND the breakable must be a light source with kickable=true.
   */
  function isDraggable(breakable) {
    if (!breakable || !breakable.isLightSource) return false;
    var lightType = breakable.lightType || '';
    // Only LAMP_POST type is draggable (matches tile-animation-system metadata)
    return lightType === 'LAMP_POST';
  }

  /**
   * Attempt to attach a draggable breakable to the player.
   * Called from game-tick tile traversal (passive) or tap-move (active).
   *
   * @param {Object} breakable - The breakable at the player's tile
   * @param {Object} ctx - Game context
   * @param {boolean} [passive] - true if triggered by walking through (shorter waft distance)
   * @returns {boolean} true if attached
   */
  function tryAttach(breakable, ctx, passive) {
    if (_draggedBreakable) return false; // Already dragging
    if (!isDraggable(breakable)) return false;
    if (breakable.hp <= 0) return false;

    _draggedBreakable = breakable;
    _attachTileX = breakable.x;
    _attachTileY = breakable.y;
    _lastGlowTime = Date.now();
    _isPassiveWaft = !!passive;

    // Visual feedback: subtle overhead indicator
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(breakable.x, breakable.y, '🏮', 500, DRAG_GLOW_COLOR);
    }

    console.log('[LanternDrag] ' + (_isPassiveWaft ? 'Wafted' : 'Grabbed') +
      ' ' + (breakable.name || 'lantern') +
      ' at ' + breakable.x + ',' + breakable.y);

    return true;
  }

  /**
   * Update dragged lantern position to follow the player.
   * Called every frame from game-tick when movement is active.
   *
   * @param {Object} ctx - Game context
   */
  function update(ctx) {
    if (!_draggedBreakable) return;

    var px = ctx.player.x;
    var py = ctx.player.y;
    var bx = _draggedBreakable.x;
    var by = _draggedBreakable.y;

    // Auto-drop if too far from attach point
    // Passive waft uses shorter distance; active grab uses full distance
    var maxDist = _isPassiveWaft ? WAFT_DISTANCE : DROP_DISTANCE;
    var dist = Math.abs(px - _attachTileX) + Math.abs(py - _attachTileY);
    if (dist > maxDist) {
      drop(ctx);
      return;
    }

    // Auto-drop if combat started
    if (ctx.strCombatActive) {
      drop(ctx);
      return;
    }

    // Move the breakable to the player's tile
    if (bx !== px || by !== py) {
      // Clear old grid position (only if it's still marked as BREAKABLE)
      if (ctx.grid[by] && ctx.grid[by][bx] === ctx.TILES.BREAKABLE) {
        ctx.grid[by][bx] = ctx.TILES.EMPTY;
      }

      // Update breakable position
      _draggedBreakable.x = px;
      _draggedBreakable.y = py;

      // Set new grid position
      if (ctx.grid[py] && ctx.grid[py][px] !== undefined) {
        ctx.grid[py][px] = ctx.TILES.BREAKABLE;
      }

      // Move the light source in the lighting system
      if (typeof LightingSystem !== 'undefined' && LightingSystem.moveLightSource) {
        LightingSystem.moveLightSource(bx, by, px, py);
      }
    }

    // Periodic glow pulse (subtle reminder the lantern is attached)
    var now = Date.now();
    if (now - _lastGlowTime > DRAG_GLOW_INTERVAL) {
      _lastGlowTime = now;
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(px, py, '🏮', 300, DRAG_GLOW_COLOR);
      }
    }
  }

  /**
   * Drop the dragged lantern at the player's current tile.
   *
   * @param {Object} ctx - Game context
   */
  function drop(ctx) {
    if (!_draggedBreakable) return;

    var bx = _draggedBreakable.x;
    var by = _draggedBreakable.y;

    console.log('[LanternDrag] Dropped ' + (_draggedBreakable.name || 'lantern') +
      ' at ' + bx + ',' + by +
      ' (dragged from ' + _attachTileX + ',' + _attachTileY + ')');

    // Overhead: drop indicator
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(bx, by, '🏮', 400, '#888888');
    }

    _draggedBreakable = null;
    _attachTileX = 0;
    _attachTileY = 0;
    _isPassiveWaft = false;
  }

  /**
   * Get the current drag speed penalty (0 if not dragging).
   * This is read by the movement system to reduce player speed.
   *
   * @returns {number} Movement penalty (0-1 range, e.g. 0.1 = 10% slower)
   */
  function getDragSpeedPenalty() {
    return _draggedBreakable ? DRAG_SPEED_PENALTY : 0;
  }

  /**
   * Check if currently dragging a lantern.
   * @returns {boolean}
   */
  function isDragging() {
    return !!_draggedBreakable;
  }

  /**
   * Get the dragged breakable object (or null).
   * @returns {Object|null}
   */
  function getDraggedBreakable() {
    return _draggedBreakable;
  }

  /**
   * Force-detach (e.g. on floor change).
   */
  function reset() {
    _draggedBreakable = null;
    _attachTileX = 0;
    _attachTileY = 0;
    _isPassiveWaft = false;
  }

  /**
   * Check if current drag is a passive waft (walk-through) vs active grab (tap).
   * @returns {boolean}
   */
  function isPassiveWaft() {
    return _isPassiveWaft && !!_draggedBreakable;
  }

  return {
    isDraggable: isDraggable,
    tryAttach: tryAttach,
    update: update,
    drop: drop,
    getDragSpeedPenalty: getDragSpeedPenalty,
    isDragging: isDragging,
    isPassiveWaft: isPassiveWaft,
    getDraggedBreakable: getDraggedBreakable,
    reset: reset
  };
})();
