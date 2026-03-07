/* ============================================================
   FloorPathEnums — Single source of truth for floor type and
   enemy path type enumerations.

   IIFE module — loads before gone-rogue.js.
   Consumed by: BiomeConfig, FloorGenerator, FloorGenCore,
   EnemyAISystem, VendorSystem, InventoryManagement, and more.
   ============================================================ */
var FloorPathEnums = (function () {
  'use strict';

  // ── Floor types for run structure ──────────────────────────
  var FLOOR_TYPES = {
    TUTORIAL:    'tutorial',     // Floors 1-2: no enemies, learn movement
    GHOST:       'ghost',        // Floors 3-4: cameras only, no combat
    STEALTH:     'stealth',      // Floors 5-9: light stealth
    BONFIRE:     'bonfire',      // Floors 10, 16, 22: safe hub with vendor
    COMBAT:      'combat',       // Standard combat floors
    EXPLORATION: 'exploration',  // High loot, few/no enemies
    BOSS:        'boss',         // Boss encounter floors
    FINAL:       'final'         // Floor 30: final boss
  };

  // ── Enemy path types ───────────────────────────────────────
  var PATH_TYPES = {
    PATROL:     'patrol',       // A→B→C→B (reverse on endpoint)
    CIRCULAR:   'circular',     // A→B→C→A (loop)
    ELLIPSE:    'ellipse',      // Elliptical path
    STATIONARY: 'stationary'    // Rotate in place
  };

  // ── Public API ─────────────────────────────────────────────

  /** Get the FLOOR_TYPES enum (drop-in replacement) */
  function getFloorTypes() {
    return FLOOR_TYPES;
  }

  /** Get the PATH_TYPES enum (drop-in replacement) */
  function getPathTypes() {
    return PATH_TYPES;
  }

  /** Is this string a valid floor type? */
  function isValidFloorType(type) {
    var keys = Object.keys(FLOOR_TYPES);
    for (var i = 0; i < keys.length; i++) {
      if (FLOOR_TYPES[keys[i]] === type) return true;
    }
    return false;
  }

  /** Is this string a valid path type? */
  function isValidPathType(type) {
    var keys = Object.keys(PATH_TYPES);
    for (var i = 0; i < keys.length; i++) {
      if (PATH_TYPES[keys[i]] === type) return true;
    }
    return false;
  }

  return {
    getFloorTypes:    getFloorTypes,
    getPathTypes:     getPathTypes,
    isValidFloorType: isValidFloorType,
    isValidPathType:  isValidPathType,
    FLOOR_TYPES:      FLOOR_TYPES,
    PATH_TYPES:       PATH_TYPES
  };
})();
