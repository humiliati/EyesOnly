/* ============================================================
   RunProgressionState — Single source of truth for per-run
   progression tracking: gate/key pity timers, biome visit
   history, and milestone flags.

   IIFE module — loads before gone-rogue.js.

   OWNERSHIP MODEL:
   This module owns the live _runState object. It is passed by
   reference to satellite ctx factories (BiomeGateSystem,
   KeyLootGen, FloorGenCore, DeathExitSystem). Satellites read
   AND mutate fields directly via ctx.runState — the object is
   shared, not copied.

   SCHEMA CONTRACT:
   Any module that reads or writes runState fields MUST use only
   the fields defined in _createFreshState(). Adding a new field
   requires updating this module first.

   NOT TO BE CONFUSED WITH:
   - passive-items-system.js _runState (tracks fullHealUsed only)
   - highscore tracking vars (_runStartTime, _currencyCollected…)
   ============================================================ */
var RunProgressionState = (function () {
  'use strict';

  // ── Schema definition ──────────────────────────────────────
  // This is the CANONICAL field list. Any field not here is a bug.
  function _createFreshState() {
    return {
      // ── Gate pity system ────────────────────────────────────
      floorsSinceGate: 0,        // Floors since last gate spawn (pity timer, force at >=3)
      gatesSpawnedThisRun: 0,    // Total gates spawned this run

      // ── Key pity system ─────────────────────────────────────
      floorsSinceKey: 0,         // Floors since last key drop (pity timer, force at >=3)
      keysFoundThisRun: 0,       // Total keys found this run
      keysOwned: [],             // Keys currently in inventory [{type, biome}]

      // ── Biome visit tracking ────────────────────────────────
      visitedGateBiomes: [],     // Biomes entered via gates this run
      lastBiomeEntered: null,    // Last biome gate entered (for cooldown)
      biomeEntryCooldowns: {},   // Cooldown tracker {biomeName: floorsRemaining}

      // ── Milestone flags ─────────────────────────────────────
      firstCombatVictory: false, // Whether player has won first combat
      firstBonfire: false        // Whether player has reached first bonfire
    };
  }

  // ── Live state object ──────────────────────────────────────
  // This is the SAME object reference passed to all ctx factories.
  // Satellites mutate it directly. DO NOT reassign — only mutate.
  var _state = _createFreshState();

  // ── Public API ─────────────────────────────────────────────

  /**
   * Get the live state object (by reference).
   * Drop-in replacement for monolith's _runState.
   * Ctx factories should call: runState: RunProgressionState.getState()
   */
  function getState() {
    return _state;
  }

  /**
   * Reset all fields for a new run.
   * Mutates in-place so all existing references auto-update.
   */
  function reset() {
    var fresh = _createFreshState();
    var keys = Object.keys(_state);
    var i;
    // Remove any stale fields
    for (i = 0; i < keys.length; i++) {
      delete _state[keys[i]];
    }
    // Copy fresh fields into same object reference
    var freshKeys = Object.keys(fresh);
    for (i = 0; i < freshKeys.length; i++) {
      _state[freshKeys[i]] = fresh[freshKeys[i]];
    }
  }

  /**
   * Get a snapshot (deep copy) for save/debug.
   * Does NOT return the live reference.
   */
  function snapshot() {
    return JSON.parse(JSON.stringify(_state));
  }

  /**
   * Restore from a saved snapshot (e.g. localStorage load).
   * Merges into the live object — unknown fields are ignored.
   */
  function restore(saved) {
    if (!saved || typeof saved !== 'object') return;
    var fresh = _createFreshState();
    var validKeys = Object.keys(fresh);
    for (var i = 0; i < validKeys.length; i++) {
      var k = validKeys[i];
      if (saved[k] !== undefined) {
        _state[k] = saved[k];
      }
    }
  }

  /**
   * Get the schema field names (for validation / docs).
   */
  function getSchemaFields() {
    return Object.keys(_createFreshState());
  }

  return {
    getState:        getState,
    reset:           reset,
    snapshot:        snapshot,
    restore:         restore,
    getSchemaFields: getSchemaFields
  };
})();
