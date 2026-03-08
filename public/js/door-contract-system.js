/**
 * DoorContractSystem — owns all door transition state and contract logic.
 * Extracted from gone-rogue.js monolith (Phase 1 of WBE roadmap).
 *
 * State owned:
 *   _lastExitPos          – { x, y } of the door the player just used
 *   _spawnFromLastExitPos  – 'advance' | 'retreat' | null
 *   _doorSpawnProtect      – { x, y, stepsRemaining, suppressAnimation } | null
 *
 * Canonical Door Contract:
 *   advance  → spawn adjacent to BACK door, guardrails ~5 steps, animation suppressed
 *   retreat  → spawn adjacent to FORWARD door, guardrails ~5 steps, animation suppressed
 *   building → spawn adjacent to EXIT door, NO guardrails, can exit immediately
 *
 * Stateless IIFE module — loaded before gone-rogue.js via <script> tag.
 */
var DoorContractSystem = (function() {
  'use strict';

  // ── Owned State ──────────────────────────────────────────────────
  var _lastExitPos = null;
  var _spawnFromLastExitPos = null; // 'advance' | 'retreat' | null
  var _doorSpawnProtect = null;     // { x, y, stepsRemaining, suppressAnimation }

  var GUARDRAIL_STEPS = 5;

  // ── State Accessors ──────────────────────────────────────────────

  function getLastExitPos()  { return _lastExitPos; }
  function setLastExitPos(v) { _lastExitPos = v; }

  function getSpawnFromLastExitPos()  { return _spawnFromLastExitPos; }
  function setSpawnFromLastExitPos(v) { _spawnFromLastExitPos = v; }

  function getDoorSpawnProtect()    { return _doorSpawnProtect; }
  function setDoorSpawnProtect(v)   { _doorSpawnProtect = v; }
  function clearDoorSpawnProtect()  { _doorSpawnProtect = null; }

  /**
   * Tick the guardrail step counter. Called each time the player moves
   * onto a non-door tile.
   * @returns {boolean} true if protect was cleared this tick
   */
  function tickDoorSpawnProtect() {
    if (!_doorSpawnProtect) return false;
    if (_doorSpawnProtect.stepsRemaining > 0) {
      _doorSpawnProtect.stepsRemaining--;
      if (_doorSpawnProtect.stepsRemaining <= 0) {
        _doorSpawnProtect = null;
        return true;
      }
    } else {
      _doorSpawnProtect = null;
      return true;
    }
    return false;
  }

  function resetAll() {
    _lastExitPos = null;
    _spawnFromLastExitPos = null;
    _doorSpawnProtect = null;
  }

  // ── Spawn Helper ─────────────────────────────────────────────────

  /**
   * Find an empty tile adjacent to targetDoor, preferring tiles far from avoidDoor.
   * Searches in expanding rings up to `radius` tiles out.
   *
   * @param {Array[]} grid       – 2D tile grid
   * @param {Object}  TILES      – tile constants (needs TILES.EMPTY)
   * @param {number}  gridW      – grid width
   * @param {number}  gridH      – grid height
   * @param {Object}  targetDoor – { x, y } door to spawn near
   * @param {Object}  avoidDoor  – { x, y } door to stay away from (may be null)
   * @param {number}  radius     – max search radius (default GUARDRAIL_STEPS)
   * @returns {Object|null} { x, y } or null if no valid spot found
   */
  function findSpawnNearDoor(grid, TILES, gridW, gridH, targetDoor, avoidDoor, radius) {
    radius = radius || GUARDRAIL_STEPS;
    var best = null;
    var bestAvoidDist = -1;

    for (var r = 1; r <= radius; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          // Only check ring perimeter for this radius
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;

          var tx = targetDoor.x + dx;
          var ty = targetDoor.y + dy;

          // Bounds check (stay 1 tile off edges)
          if (tx <= 0 || tx >= gridW - 1 || ty <= 0 || ty >= gridH - 1) continue;
          // Must be walkable empty tile
          if (!grid[ty] || grid[ty][tx] !== TILES.EMPTY) continue;

          var avoidDist = 0;
          if (avoidDoor) {
            avoidDist = Math.abs(tx - avoidDoor.x) + Math.abs(ty - avoidDoor.y);
          }

          // Prefer spots further from avoidDoor; among equal, prefer first found at this ring
          if (!best || avoidDist > bestAvoidDist) {
            best = { x: tx, y: ty };
            bestAvoidDist = avoidDist;
          }
        }
      }

      // If we found a valid spot on this ring, return it
      // (prefer closest ring to targetDoor with best avoidance)
      if (best) return best;
    }
    return best; // null if nothing found
  }

  // ── Core Contract Logic ──────────────────────────────────────────

  /**
   * Apply the standard door contract after floor generation.
   *
   * Canonical contract:
   *   advance  → player spawns adjacent to BACK door (retreat door)
   *   retreat  → player spawns adjacent to FORWARD door (advance door)
   *
   * Sets doorSpawnProtect with guardrail step countdown.
   * Clears spawnFromLastExitPos after application.
   *
   * @param {Object} opts
   * @param {Object} opts.grid          – 2D tile grid
   * @param {Object} opts.TILES         – tile constants
   * @param {number} opts.gridW         – grid width
   * @param {number} opts.gridH         – grid height
   * @param {Object} opts.player        – { x, y } player object (mutated)
   * @param {Object} opts.backDoorPos   – { x, y } of back/retreat door
   * @param {Object} opts.forwardDoorPos – { x, y } of forward/advance door
   * @returns {boolean} true if contract was applied, false if no transition mode set
   */
  function applyDoorContract(opts) {
    var mode = _spawnFromLastExitPos;
    if (!mode) return false;

    var targetDoor, avoidDoor;
    if (mode === 'advance') {
      targetDoor = opts.backDoorPos;
      avoidDoor  = opts.forwardDoorPos;
    } else if (mode === 'retreat') {
      targetDoor = opts.forwardDoorPos;
      avoidDoor  = opts.backDoorPos;
    } else {
      _spawnFromLastExitPos = null;
      return false;
    }

    if (!targetDoor) {
      _spawnFromLastExitPos = null;
      return false;
    }

    var spawnPos = findSpawnNearDoor(
      opts.grid, opts.TILES, opts.gridW, opts.gridH,
      targetDoor, avoidDoor, GUARDRAIL_STEPS
    );

    if (spawnPos) {
      opts.player.x = spawnPos.x;
      opts.player.y = spawnPos.y;
    } else {
      opts.player.x = targetDoor.x;
      opts.player.y = targetDoor.y;
    }

    // Activate guardrails
    _doorSpawnProtect = {
      x: targetDoor.x,
      y: targetDoor.y,
      stepsRemaining: GUARDRAIL_STEPS,
      suppressAnimation: true
    };

    _spawnFromLastExitPos = null;
    return true;
  }

  /**
   * Apply the building door contract.
   *
   * Building funnel pattern:
   *   Enter building → spawn adjacent to EXIT door
   *   NO guardrails — player can exit immediately
   *
   * @param {Object} opts
   * @param {Object} opts.grid     – 2D tile grid
   * @param {Object} opts.TILES    – tile constants
   * @param {number} opts.gridW    – grid width
   * @param {number} opts.gridH    – grid height
   * @param {Object} opts.player   – { x, y } player object (mutated)
   * @param {Object} opts.exitDoorPos – { x, y } of building exit door
   * @returns {boolean} true if contract was applied
   */
  function applyBuildingDoorContract(opts) {
    if (!opts.exitDoorPos) return false;

    var spawnPos = findSpawnNearDoor(
      opts.grid, opts.TILES, opts.gridW, opts.gridH,
      opts.exitDoorPos, null, 3
    );

    if (spawnPos) {
      opts.player.x = spawnPos.x;
      opts.player.y = spawnPos.y;
    } else {
      opts.player.x = opts.exitDoorPos.x;
      opts.player.y = opts.exitDoorPos.y;
    }

    // NO guardrails for buildings — player can immediately walk out
    _doorSpawnProtect = null;
    _spawnFromLastExitPos = null;
    return true;
  }

  // ── Public API ───────────────────────────────────────────────────
  return {
    // State accessors
    getLastExitPos: getLastExitPos,
    setLastExitPos: setLastExitPos,
    getSpawnFromLastExitPos: getSpawnFromLastExitPos,
    setSpawnFromLastExitPos: setSpawnFromLastExitPos,
    getDoorSpawnProtect: getDoorSpawnProtect,
    setDoorSpawnProtect: setDoorSpawnProtect,
    clearDoorSpawnProtect: clearDoorSpawnProtect,
    tickDoorSpawnProtect: tickDoorSpawnProtect,
    resetAll: resetAll,

    // Contract logic
    applyDoorContract: applyDoorContract,
    applyBuildingDoorContract: applyBuildingDoorContract,
    findSpawnNearDoor: findSpawnNearDoor,

    // Constants
    GUARDRAIL_STEPS: GUARDRAIL_STEPS
  };
})();
