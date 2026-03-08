/**
 * FloorStateTracker — IIFE module (Standalone)
 *
 * Owns: _floorStates map — per-floor persistence across revisits within a run.
 * Tracks: destroyed gates, destroyed breakables, visit counts, unlocked doors.
 *
 * Purpose: Prevents broken gates from reappearing on backtrack, enables
 * degraded breakable respawning, and scales enemy density on revisits.
 *
 * Dependencies: none (standalone — all data passed via API params)
 * Depended on by: floor-gen-core.js, tutorial-floor-gen.js, gone-rogue.js (ctx)
 *
 * See: ENVIRONMENT_GATE_CONTRACT.md §7 Floor State Tracking System
 */
var FloorStateTracker = (function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────
  // floorId → { destroyedGates[], destroyedBreakables[], visitCount, unlockedDoors[] }
  var _floorStates = {};

  // ── Internal helpers ─────────────────────────────────────────────

  /** Return (or create) the state object for a floor. */
  function _ensure(floorId) {
    if (!_floorStates[floorId]) {
      _floorStates[floorId] = {
        destroyedGates: [],
        destroyedBreakables: [],
        visitCount: 0,
        unlockedDoors: []
      };
    }
    return _floorStates[floorId];
  }

  /** Check if an {x,y} entry already exists in an array. */
  function _hasPosition(arr, x, y) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].x === x && arr[i].y === y) return true;
    }
    return false;
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Record that a gate was destroyed on a floor.
   * On revisit, this position should remain EMPTY — gates never respawn.
   *
   * @param {string|number} floorId
   * @param {number} x
   * @param {number} y
   * @param {string} gateType  e.g. 'WOODEN_GATE', 'LOCKED_ROCK', etc.
   */
  function recordGateDestroyed(floorId, x, y, gateType) {
    var state = _ensure(floorId);
    if (!_hasPosition(state.destroyedGates, x, y)) {
      state.destroyedGates.push({ x: x, y: y, gateType: gateType || 'UNKNOWN' });
    }
  }

  /**
   * Record that a breakable object was destroyed on a floor.
   * On revisit, breakables respawn in degraded form (1 HP, reduced loot).
   *
   * @param {string|number} floorId
   * @param {number} x
   * @param {number} y
   * @param {string} breakableType  e.g. 'CRATE', 'BARREL', etc.
   * @param {string} [lootTable]    Original loot table ID (for degradation calc)
   */
  function recordBreakableDestroyed(floorId, x, y, breakableType, lootTable) {
    var state = _ensure(floorId);
    if (!_hasPosition(state.destroyedBreakables, x, y)) {
      state.destroyedBreakables.push({
        x: x, y: y,
        breakableType: breakableType || 'UNKNOWN',
        originalLootTable: lootTable || null
      });
    }
  }

  /**
   * Record that a door has been unlocked / entered on a floor.
   * Building doors remain accessible on all future visits.
   *
   * @param {string|number} floorId
   * @param {number} x
   * @param {number} y
   */
  function recordDoorUnlocked(floorId, x, y) {
    var state = _ensure(floorId);
    if (!_hasPosition(state.unlockedDoors, x, y)) {
      state.unlockedDoors.push({ x: x, y: y });
    }
  }

  /**
   * Increment the visit counter for a floor.
   * Called each time the player enters or re-enters a floor.
   *
   * @param {string|number} floorId
   * @returns {number} The new visit count
   */
  function incrementVisit(floorId) {
    var state = _ensure(floorId);
    state.visitCount++;
    return state.visitCount;
  }

  /**
   * Get the full state object for a floor, or null if never visited.
   *
   * @param {string|number} floorId
   * @returns {{ destroyedGates: Array, destroyedBreakables: Array,
   *             visitCount: number, unlockedDoors: Array } | null}
   */
  function getFloorState(floorId) {
    return _floorStates[floorId] || null;
  }

  /**
   * Check if a specific position was a destroyed gate on a floor.
   *
   * @param {string|number} floorId
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function isGateDestroyed(floorId, x, y) {
    var state = _floorStates[floorId];
    return state ? _hasPosition(state.destroyedGates, x, y) : false;
  }

  /**
   * Check if a specific position was a destroyed breakable on a floor.
   *
   * @param {string|number} floorId
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function isBreakableDestroyed(floorId, x, y) {
    var state = _floorStates[floorId];
    return state ? _hasPosition(state.destroyedBreakables, x, y) : false;
  }

  /**
   * Check if a specific door was unlocked on a floor.
   *
   * @param {string|number} floorId
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function isDoorUnlocked(floorId, x, y) {
    var state = _floorStates[floorId];
    return state ? _hasPosition(state.unlockedDoors, x, y) : false;
  }

  /**
   * Get the visit count for a floor (0 if never visited).
   *
   * @param {string|number} floorId
   * @returns {number}
   */
  function getVisitCount(floorId) {
    var state = _floorStates[floorId];
    return state ? state.visitCount : 0;
  }

  /**
   * Compute breakable degradation for a revisited floor.
   * Per ENVIRONMENT_GATE_CONTRACT.md §8:
   *   Visit 2: 50% loot chance, quality tier -1
   *   Visit 3+: 25% loot chance, quality tier -2
   *
   * @param {string|number} floorId
   * @returns {{ hp: number, lootChance: number, qualityReduction: number }}
   */
  function getBreakableDegradation(floorId) {
    var visits = getVisitCount(floorId);
    if (visits <= 1) {
      return { hp: -1, lootChance: 1.0, qualityReduction: 0 }; // -1 = use original HP
    }
    if (visits === 2) {
      return { hp: 1, lootChance: 0.5, qualityReduction: 1 };
    }
    // visits >= 3
    return { hp: 1, lootChance: 0.25, qualityReduction: 2 };
  }

  /**
   * Compute enemy respawn density multiplier for a revisited floor.
   * Per ENVIRONMENT_GATE_CONTRACT.md §9:
   *   Visit 2: 50%, Visit 3: 30%, Visit 4+: 20% (minimum 1 enemy)
   *
   * @param {string|number} floorId
   * @returns {number} Multiplier between 0.0 and 1.0
   */
  function getEnemyDensityMultiplier(floorId) {
    var visits = getVisitCount(floorId);
    if (visits <= 1) return 1.0;
    if (visits === 2) return 0.5;
    if (visits === 3) return 0.3;
    return 0.2;
  }

  /**
   * Get positions where enemies should NOT respawn (near building doors).
   * Per ENVIRONMENT_GATE_CONTRACT.md §10.3: respawned enemies spawn
   * away from the direct path between retreat door and building entrances.
   *
   * @param {string|number} floorId
   * @returns {Array<{x: number, y: number}>} Door positions to avoid
   */
  function getUnlockedDoorPositions(floorId) {
    var state = _floorStates[floorId];
    return state ? state.unlockedDoors.slice() : [];
  }

  /**
   * Reset all floor state. Called on new run start.
   */
  function resetAll() {
    _floorStates = {};
  }

  /**
   * Export state for save/load. Returns a plain object safe for JSON.stringify.
   * @returns {Object}
   */
  function serialize() {
    return JSON.parse(JSON.stringify(_floorStates));
  }

  /**
   * Import state from save data. Replaces current state entirely.
   * @param {Object} data  Output of a previous serialize() call
   */
  function deserialize(data) {
    _floorStates = {};
    if (data && typeof data === 'object') {
      for (var key in data) {
        if (data.hasOwnProperty(key)) {
          _floorStates[key] = {
            destroyedGates: data[key].destroyedGates || [],
            destroyedBreakables: data[key].destroyedBreakables || [],
            visitCount: data[key].visitCount || 0,
            unlockedDoors: data[key].unlockedDoors || []
          };
        }
      }
    }
  }

  // ── Module API ───────────────────────────────────────────────────
  return {
    // Recording
    recordGateDestroyed: recordGateDestroyed,
    recordBreakableDestroyed: recordBreakableDestroyed,
    recordDoorUnlocked: recordDoorUnlocked,
    incrementVisit: incrementVisit,

    // Queries
    getFloorState: getFloorState,
    isGateDestroyed: isGateDestroyed,
    isBreakableDestroyed: isBreakableDestroyed,
    isDoorUnlocked: isDoorUnlocked,
    getVisitCount: getVisitCount,

    // Degradation helpers
    getBreakableDegradation: getBreakableDegradation,
    getEnemyDensityMultiplier: getEnemyDensityMultiplier,
    getUnlockedDoorPositions: getUnlockedDoorPositions,

    // Lifecycle
    resetAll: resetAll,
    serialize: serialize,
    deserialize: deserialize
  };
})();
