/**
 * RopeManager — State-driven tool for remote interactions.
 * The rope is a temporary interaction conduit (not a persistent inventory item)
 * enabling players to trigger objects like levers and buttons from a distance,
 * deploy tripwires between anchor points, and (future) grapple/harpoon enemies.
 *
 * State machine:
 *   idle ──(acquireRope)──► hasRope ──(deploy)──► ropeActive
 *     ▲                       │                      │
 *     │  (drop / use last)    │   (resolve/cancel)   │
 *     └───────────────────────┘◄─────────────────────┘
 *
 * Integration points (mirrors LanternDragSystem wiring):
 *   · tap-move-system.js   — adjacency deploy + cancel on kick
 *   · game-tick-system.js  — per-frame update (holdRequired timer) + combat cancel
 *   · gone-rogue-movement.js — speed penalty while rope is active
 *   · gone-rogue-mobile.js — self-tap cancel
 *   · run-start-system.js  — floor-init reset
 *
 * Stateless IIFE — all game state accessed via ctx or module-level state.
 */
var RopeManager = (function() {
  'use strict';

  // ── Config ──
  var ROPE_SPEED_PENALTY = 0.05;    // 5% movement speed reduction while rope active
  var MAX_ROPE_DISTANCE = 6;        // Default max deployment range (Manhattan tiles)
  var ROPE_EMOJI = '➰';
  var ROPE_GLOW_COLOR = '#c4a265';  // Natural hemp tone

  // ── State ──
  var _state = 'idle';               // 'idle' | 'hasRope' | 'ropeActive'
  var _target = null;                // Current rope target object
  var _deployTileX = 0;              // Player tile when rope was deployed
  var _deployTileY = 0;
  var _holdElapsed = 0;              // ms accumulated for holdRequired buttons
  var _ropeCount = 0;                // Number of ropes available (0 = idle)

  // ── State machine ──

  function _setState(newState) {
    if (_state === newState) return;
    console.log('[RopeManager] ' + _state + ' -> ' + newState);
    _state = newState;
  }

  /**
   * Player acquires a rope (from loot, pickup, etc.).
   * Can stack — each acquisition increments _ropeCount.
   */
  function acquireRope() {
    _ropeCount++;
    if (_state === 'idle') {
      _setState('hasRope');
    }
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      // Brief overhead indicator — rope acquired
      // Use player position from wherever the caller provides
    }
    console.log('[RopeManager] Rope acquired (count: ' + _ropeCount + ')');
  }

  /**
   * Deploy rope to a target object.
   * Validates ropeInteractable flag and Manhattan distance.
   *
   * @param {Object} target - Must have { x, y, ropeInteractable: true, type }
   * @param {Object} ctx - Game context with player, grid, etc.
   * @returns {boolean} true if deployment started
   */
  function deploy(target, ctx) {
    if (_state !== 'hasRope') {
      console.warn('[RopeManager] Cannot deploy — state is ' + _state);
      return false;
    }
    if (!target || !target.ropeInteractable) {
      console.warn('[RopeManager] Target is not rope-interactable');
      return false;
    }

    // Distance check (Manhattan)
    var maxDist = target.maxRopeDistance || MAX_ROPE_DISTANCE;
    var dist = Math.abs(ctx.player.x - target.x) + Math.abs(ctx.player.y - target.y);
    if (dist > maxDist) {
      console.warn('[RopeManager] Target out of range (' + dist + ' > ' + maxDist + ')');
      if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
        OverheadAnimator.showGenericExpression(ctx.player.x, ctx.player.y, '❌', 400, '#ff4444');
      }
      return false;
    }

    // Required item gate
    if (target.requiredItem) {
      var hasItem = false;
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getLooseInventory) {
        var inv = GAMESTATE.getLooseInventory();
        for (var i = 0; i < inv.length; i++) {
          if (inv[i] && inv[i].name === target.requiredItem) { hasItem = true; break; }
        }
      }
      if (!hasItem) {
        console.warn('[RopeManager] Missing required item: ' + target.requiredItem);
        return false;
      }
    }

    _target = target;
    _deployTileX = ctx.player.x;
    _deployTileY = ctx.player.y;
    _holdElapsed = 0;
    _setState('ropeActive');

    // Overhead feedback — rope deployed
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(ctx.player.x, ctx.player.y, ROPE_EMOJI, 500, ROPE_GLOW_COLOR);
    }

    // Instant-resolve targets (no holdRequired)
    if (!target.holdRequired) {
      _resolve(ctx);
    }

    return true;
  }

  /**
   * Per-frame update while rope is active.
   * Handles holdRequired countdown and distance checks.
   *
   * @param {Object} ctx - Game context
   * @param {number} dt - Frame delta in ms
   */
  function update(ctx, dt) {
    if (_state !== 'ropeActive' || !_target) return;

    // Combat cancels rope
    if (ctx.strCombatActive) {
      cancel(ctx);
      return;
    }

    // If player moved too far from deploy point, cancel
    var dist = Math.abs(ctx.player.x - _deployTileX) + Math.abs(ctx.player.y - _deployTileY);
    var maxDist = _target.maxRopeDistance || MAX_ROPE_DISTANCE;
    if (dist > maxDist) {
      cancel(ctx);
      return;
    }

    // holdRequired accumulation
    if (_target.holdRequired) {
      _holdElapsed += (dt || 16); // fallback ~60fps
      if (_holdElapsed >= _target.holdRequired) {
        _resolve(ctx);
      }
    }
  }

  /**
   * Resolve the active rope interaction — call the target's action method.
   * @param {Object} ctx
   */
  function _resolve(ctx) {
    if (!_target) return;

    var targetType = _target.type || 'unknown';
    console.log('[RopeManager] Resolving ' + targetType + ' interaction');

    // Dispatch to target action
    if (targetType === 'lever' && typeof _target.toggle === 'function') {
      _target.toggle();
    } else if (targetType === 'button' && typeof _target.press === 'function') {
      _target.press();
    } else if (typeof _target.resolve === 'function') {
      // Generic fallback — universal contract
      _target.resolve();
    }

    // Overhead success indicator
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      OverheadAnimator.showGenericExpression(
        _target.x, _target.y, '✅', 500, '#44ff44'
      );
    }

    // Consume one rope
    _ropeCount--;
    _target = null;
    _holdElapsed = 0;
    _setState(_ropeCount > 0 ? 'hasRope' : 'idle');
  }

  /**
   * Cancel the active rope deployment without resolving.
   * @param {Object} ctx
   */
  function cancel(ctx) {
    if (_state !== 'ropeActive') return;

    console.log('[RopeManager] Cancelled rope deployment');

    // Overhead cancel indicator
    if (typeof OverheadAnimator !== 'undefined' && OverheadAnimator.showGenericExpression) {
      var px = (ctx && ctx.player) ? ctx.player.x : _deployTileX;
      var py = (ctx && ctx.player) ? ctx.player.y : _deployTileY;
      OverheadAnimator.showGenericExpression(px, py, '❌', 400, '#ff4444');
    }

    _target = null;
    _holdElapsed = 0;
    _setState(_ropeCount > 0 ? 'hasRope' : 'idle');
  }

  /**
   * Get speed penalty while rope is actively deployed (0 if not active).
   * @returns {number}
   */
  function getSpeedPenalty() {
    return _state === 'ropeActive' ? ROPE_SPEED_PENALTY : 0;
  }

  /**
   * @returns {boolean} true if rope is actively deployed to a target
   */
  function isActive() {
    return _state === 'ropeActive';
  }

  /**
   * @returns {boolean} true if player has at least one rope available
   */
  function hasRope() {
    return _state === 'hasRope' || _state === 'ropeActive';
  }

  /**
   * @returns {string} Current state: 'idle' | 'hasRope' | 'ropeActive'
   */
  function getState() {
    return _state;
  }

  /**
   * @returns {Object|null} Current rope target
   */
  function getTarget() {
    return _target;
  }

  /**
   * @returns {number} Ropes available
   */
  function getRopeCount() {
    return _ropeCount;
  }

  /**
   * Force-reset all state (floor transitions, run start).
   */
  function reset() {
    _state = 'idle';
    _target = null;
    _deployTileX = 0;
    _deployTileY = 0;
    _holdElapsed = 0;
    _ropeCount = 0;
  }

  return {
    acquireRope: acquireRope,
    deploy: deploy,
    update: update,
    cancel: cancel,
    getSpeedPenalty: getSpeedPenalty,
    isActive: isActive,
    hasRope: hasRope,
    getState: getState,
    getTarget: getTarget,
    getRopeCount: getRopeCount,
    reset: reset
  };
})();
