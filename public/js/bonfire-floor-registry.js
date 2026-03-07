/* ============================================================
   BonfireFloorRegistry — Single source of truth for bonfire
   (safe hub) floor numbers with WBE scene seams.

   IIFE module — loads before gone-rogue.js and shop-system.js.
   Pattern: stateless config provider with extension hooks.
   ============================================================ */
var BonfireFloorRegistry = (function () {
  'use strict';

  // ── Core bonfire floor list ────────────────────────────────
  // Each entry defines the floor number, hub type, and WBE scene
  // hooks that can be populated by the World-Building Engine.
  var _floors = [
    {
      floor: 10,
      hubType: 'campfire',
      label: 'First Rest',
      vendor: true,
      // WBE scene seams — populated by WBE at runtime
      wbe: {
        sceneId: null,          // WBE scene identifier
        npcs: [],               // Contrived NPCs for this bonfire
        dialogue: null,         // Dialogue tree reference
        environmentOverride: null, // Custom biome visual override
        musicCue: null,         // Audio cue for this hub
        loreFragments: [],      // Discoverable lore at this bonfire
        exitCondition: null     // Custom exit gate condition (null = default)
      }
    },
    {
      floor: 16,
      hubType: 'safehouse',
      label: 'Mid-Run Refuge',
      vendor: true,
      wbe: {
        sceneId: null,
        npcs: [],
        dialogue: null,
        environmentOverride: null,
        musicCue: null,
        loreFragments: [],
        exitCondition: null
      }
    },
    {
      floor: 22,
      hubType: 'armory',
      label: 'Final Preparation',
      vendor: true,
      wbe: {
        sceneId: null,
        npcs: [],
        dialogue: null,
        environmentOverride: null,
        musicCue: null,
        loreFragments: [],
        exitCondition: null
      }
    }
  ];

  // ── Flat array for backwards-compat (ctx.BONFIRE_FLOORS) ──
  var _floorNumbers = _floors.map(function (e) { return e.floor; });

  // ── WBE scene registration ────────────────────────────────
  // Satellites (WBE scenes) call this at boot to wire contrived
  // content into specific bonfire floors.
  var _sceneHandlers = {};

  // ── Public API ─────────────────────────────────────────────

  /** Get the flat [10, 16, 22] array (drop-in for old BONFIRE_FLOORS) */
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

  /** Is this floor number a bonfire floor? */
  function isBonfireFloor(floorNum) {
    return _floorNumbers.indexOf(floorNum) !== -1;
  }

  /** Does this bonfire have a vendor? */
  function hasVendor(floorNum) {
    var entry = getEntry(floorNum);
    return entry ? entry.vendor : false;
  }

  /**
   * Register a WBE scene for a specific bonfire floor.
   * @param {number} floorNum - 10, 16, or 22
   * @param {object} scene - { sceneId, npcs[], dialogue, environmentOverride, musicCue, loreFragments[], exitCondition }
   */
  function registerScene(floorNum, scene) {
    var entry = getEntry(floorNum);
    if (!entry) {
      console.warn('[BonfireFloorRegistry] registerScene: floor ' + floorNum + ' is not a bonfire floor');
      return;
    }
    if (!scene || !scene.sceneId) {
      console.warn('[BonfireFloorRegistry] registerScene: scene must have a sceneId');
      return;
    }
    // Merge scene data into WBE seam
    var wbe = entry.wbe;
    wbe.sceneId = scene.sceneId;
    if (scene.npcs) wbe.npcs = scene.npcs;
    if (scene.dialogue) wbe.dialogue = scene.dialogue;
    if (scene.environmentOverride) wbe.environmentOverride = scene.environmentOverride;
    if (scene.musicCue) wbe.musicCue = scene.musicCue;
    if (scene.loreFragments) wbe.loreFragments = scene.loreFragments;
    if (scene.exitCondition) wbe.exitCondition = scene.exitCondition;

    _sceneHandlers[floorNum] = scene;
  }

  /** Get the WBE scene for a floor (or null) */
  function getScene(floorNum) {
    return _sceneHandlers[floorNum] || null;
  }

  /** Get the WBE data block for a floor (always returns object) */
  function getWBE(floorNum) {
    var entry = getEntry(floorNum);
    return entry ? entry.wbe : { sceneId: null, npcs: [], dialogue: null, environmentOverride: null, musicCue: null, loreFragments: [], exitCondition: null };
  }

  return {
    getFloors:      getFloors,
    getEntry:       getEntry,
    isBonfireFloor: isBonfireFloor,
    hasVendor:      hasVendor,
    registerScene:  registerScene,
    getScene:       getScene,
    getWBE:         getWBE
  };
})();
