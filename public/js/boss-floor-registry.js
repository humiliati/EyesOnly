/* ============================================================
   BossFloorRegistry — Single source of truth for boss floor
   numbers, encounter types, and minigame branch points.

   IIFE module — loads before gone-rogue.js.
   Pattern: stateless config provider with extension seams.
   ============================================================ */
var BossFloorRegistry = (function () {
  'use strict';

  // ── Core boss floor list ───────────────────────────────────
  // Each entry defines the floor number, the encounter archetype,
  // and an optional minigame branch that overrides default combat.
  // ── Boss biome constants ──────────────────────────────────
  // Keys into boss-biomes.json (loaded via GoneRogueDataRegistry).
  var BOSS_BIOMES = {
    BOSS_TRAIN_DEPOT:  'BOSS_TRAIN_DEPOT',   // Frogger lane-crossing (Sandpoint rail junction)
    BOSS_LONG_BRIDGE:  'BOSS_LONG_BRIDGE',   // Traffic variant (Lake Pend Oreille bridge)
    BOSS_SKI_MOUNTAIN: 'BOSS_SKI_MOUNTAIN'   // SkiFree vertical descent (Schweitzer Mountain)
  };

  var _floors = [
    { floor: 10, archetype: 'guardian',  minigame: null, label: 'Depot Crossing',        biome: BOSS_BIOMES.BOSS_TRAIN_DEPOT,  parentBiome: 'INDUSTRIAL' },
    { floor: 16, archetype: 'warden',    minigame: null, label: 'Long Bridge Crossing',  biome: BOSS_BIOMES.BOSS_LONG_BRIDGE,  parentBiome: 'LAKE' },
    { floor: 22, archetype: 'overlord',  minigame: null, label: 'Schweitzer Descent',    biome: BOSS_BIOMES.BOSS_SKI_MOUNTAIN, parentBiome: 'SKI_MOUNTAIN' },
    { floor: 30, archetype: 'final',     minigame: null, label: 'Farragut Convergence',  biome: null,                          parentBiome: 'AEROSPACE' }
  ];

  // ── Flat array for backwards-compat (ctx.BOSS_FLOORS) ─────
  var _floorNumbers = _floors.map(function (e) { return e.floor; });

  // ── Minigame registry ──────────────────────────────────────
  // Keyed by archetype. Satellites register minigames at boot
  // so the boss encounter can branch into them at runtime.
  var _minigames = {};

  // ── Public API ─────────────────────────────────────────────

  /** Get the flat [10, 16, 22, 30] array (drop-in for old BOSS_FLOORS) */
  function getFloors() {
    return _floorNumbers;
  }

  /** Get full entry for a floor (or null) */
  function getEntry(floorNum) {
    for (var i = 0; i < _floors.length; i++) {
      if (_floors[i].floor === floorNum) return _floors[i];
    }
    return null;
  }

  /** Is this floor number a boss floor? */
  function isBossFloor(floorNum) {
    return _floorNumbers.indexOf(floorNum) !== -1;
  }

  /**
   * Register a minigame branch for an archetype.
   * Called by satellite modules at load time.
   * @param {string} archetype - 'guardian'|'warden'|'overlord'|'final'
   * @param {object} handler  - { id, name, init(ctx), tick(ctx), render(ctx), isComplete(ctx) }
   */
  function registerMinigame(archetype, handler) {
    if (!handler || !handler.id) {
      console.warn('[BossFloorRegistry] registerMinigame: handler must have an id');
      return;
    }
    _minigames[archetype] = handler;
    // Wire it into the matching floor entry
    for (var i = 0; i < _floors.length; i++) {
      if (_floors[i].archetype === archetype) {
        _floors[i].minigame = handler.id;
        break;
      }
    }
  }

  /** Get the registered minigame for an archetype (or null) */
  function getMinigame(archetype) {
    return _minigames[archetype] || null;
  }

  /** Get minigame for a specific floor number (convenience) */
  function getMinigameForFloor(floorNum) {
    var entry = getEntry(floorNum);
    if (!entry || !entry.minigame) return null;
    return _minigames[entry.archetype] || null;
  }

  /** All registered minigame IDs (for debug/diagnostics) */
  function listMinigames() {
    return Object.keys(_minigames);
  }

  /** Get the boss biome key for a specific floor number (or null) */
  function getBiomeForFloor(floorNum) {
    var entry = getEntry(floorNum);
    return entry ? (entry.biome || null) : null;
  }

  return {
    getFloors:           getFloors,
    getEntry:            getEntry,
    isBossFloor:         isBossFloor,
    registerMinigame:    registerMinigame,
    getMinigame:         getMinigame,
    getMinigameForFloor: getMinigameForFloor,
    getBiomeForFloor:    getBiomeForFloor,
    listMinigames:       listMinigames,
    BOSS_BIOMES:         BOSS_BIOMES
  };
})();
