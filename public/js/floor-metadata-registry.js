/**
 * FloorMetadataRegistry — unified floor metadata for the World Building Engine.
 * Created as Phase 4 of the WBE roadmap.
 *
 * Provides a single source of truth for floor metadata that the WBE's Floor Resolver
 * can query. Replaces the scattered metadata across tutorial-floors.js layout objects,
 * biome-config.js, and buildings.json.
 *
 * WBE Step Node shape reference:
 *   { id, floorType, difficultyTier, requiredPlayerState, allowedSynergies, narrativeTags }
 *
 * Stateless IIFE module — loaded before gone-rogue.js via <script> tag.
 */
var FloorMetadataRegistry = (function() {
  'use strict';

  // ── Registry Storage ─────────────────────────────────────────────
  var _registry = {}; // floorId (string) → metadata object

  // ── Registration ─────────────────────────────────────────────────

  /**
   * Register metadata for a floor.
   * @param {string|number} floorId - Floor identifier (e.g. "0", "1", "1.2", "1.2.1")
   * @param {Object} metadata - Floor metadata
   */
  function register(floorId, metadata) {
    _registry[String(floorId)] = metadata;
  }

  /**
   * Bulk-register multiple floors.
   * @param {Object[]} entries - Array of { id, ...metadata } objects
   */
  function registerAll(entries) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      _registry[String(entry.id)] = entry;
    }
  }

  // ── Queries ──────────────────────────────────────────────────────

  /**
   * Get metadata for a specific floor.
   * @param {string|number} floorId
   * @returns {Object|null}
   */
  function get(floorId) {
    return _registry[String(floorId)] || null;
  }

  /**
   * Get all floors matching a biome.
   * @param {string} biomeId - e.g. "FOREST", "GREY_CAVE"
   * @returns {Object[]}
   */
  function getByBiome(biomeId) {
    var results = [];
    for (var id in _registry) {
      if (_registry[id].biomeId === biomeId) results.push(_registry[id]);
    }
    return results;
  }

  /**
   * Get all floors matching a type.
   * @param {string} floorType - 'template' | 'procedural' | 'hybrid'
   * @returns {Object[]}
   */
  function getByType(floorType) {
    var results = [];
    for (var id in _registry) {
      if (_registry[id].type === floorType) results.push(_registry[id]);
    }
    return results;
  }

  /**
   * Get all floors matching a narrative tag.
   * @param {string} tag - e.g. "tutorial", "boss", "building_interior"
   * @returns {Object[]}
   */
  function getByTag(tag) {
    var results = [];
    for (var id in _registry) {
      var tags = _registry[id].narrativeTags;
      if (tags && tags.indexOf(tag) !== -1) results.push(_registry[id]);
    }
    return results;
  }

  /**
   * Get all registered floor IDs.
   * @returns {string[]}
   */
  function getAllFloorIds() {
    return Object.keys(_registry);
  }

  /**
   * Get the full registry (for debugging/tooling).
   * @returns {Object}
   */
  function getAll() {
    return _registry;
  }

  // ── Auto-Registration from TutorialFloors ────────────────────────

  /**
   * Auto-register tutorial floors from TutorialFloors module.
   * Called once during startup (after TutorialFloors is loaded).
   */
  function registerTutorialFloors() {
    if (typeof TutorialFloors === 'undefined') return;

    var floorConfigs = [
      { id: '0', layoutKey: 'FLOOR_0_LAYOUT', biomeId: 'FOREST', difficultyTier: 0,
        narrativeTags: ['tutorial', 'spawn', 'tavern_road'], suppressBackDoor: true },
      { id: '1', layoutKey: 'FLOOR_1_LAYOUT', biomeId: 'FOREST', difficultyTier: 0,
        narrativeTags: ['tutorial', 'village_entrance', 'first_exploration'] },
      { id: '2', layoutKey: 'FLOOR_2_LAYOUT', biomeId: 'FOREST', difficultyTier: 0,
        narrativeTags: ['tutorial', 'the_gate', 'first_npc'] },
      { id: '3', layoutKey: 'FLOOR_3_LAYOUT', biomeId: 'FOREST', difficultyTier: 1,
        narrativeTags: ['tutorial', 'first_encounters', 'first_combat'] }
    ];

    for (var i = 0; i < floorConfigs.length; i++) {
      var cfg = floorConfigs[i];
      var layout = TutorialFloors[cfg.layoutKey];
      if (!layout) continue;

      register(cfg.id, {
        id: cfg.id,
        type: 'template',
        name: layout.name,
        description: layout.description || '',
        biomeId: cfg.biomeId,
        difficultyTier: cfg.difficultyTier,
        doors: {
          forward: layout.exit || null,
          back: cfg.suppressBackDoor ? null : (layout.player || null),
          building: (layout.buildingDoors || []).map(function(d) { return { x: d.x, y: d.y }; })
        },
        narrativeTags: cfg.narrativeTags,
        buildingId: null,
        parentFloorId: null,
        suppressBackDoor: cfg.suppressBackDoor || false
      });
    }

    // Register interior floors
    var interiorConfigs = [
      { id: '1.2', layoutKey: 'CHURCH_INTERIOR_LAYOUT', biomeId: 'INTERIOR_CHURCH',
        buildingId: 'BLD-002', parentFloorId: '1',
        narrativeTags: ['building_interior', 'church'] },
      { id: '0.1', layoutKey: 'TAVERN_INTERIOR_LAYOUT', biomeId: 'INTERIOR_TAVERN',
        buildingId: 'BLD-TAVERN', parentFloorId: '0',
        narrativeTags: ['building_interior', 'tavern'] },
      { id: '0.1.1', layoutKey: 'TAVERN_BASEMENT_LAYOUT', biomeId: 'INTERIOR_BASEMENT',
        buildingId: 'BLD-TAVERN', parentFloorId: '0.1',
        narrativeTags: ['building_interior', 'tavern_basement', 'nested'] }
    ];

    for (var j = 0; j < interiorConfigs.length; j++) {
      var icfg = interiorConfigs[j];
      var ilayout = TutorialFloors[icfg.layoutKey];
      if (!ilayout) continue;

      register(icfg.id, {
        id: icfg.id,
        type: 'template',
        name: ilayout.name,
        description: ilayout.description || '',
        biomeId: icfg.biomeId,
        difficultyTier: 0,
        doors: {
          forward: null,
          back: null,
          building: []
        },
        narrativeTags: icfg.narrativeTags,
        buildingId: icfg.buildingId,
        parentFloorId: icfg.parentFloorId,
        isInterior: true
      });
    }

    console.log('[FloorMetadataRegistry] Registered ' + getAllFloorIds().length + ' tutorial/interior floors');
  }

  // ── Public API ───────────────────────────────────────────────────
  return {
    register: register,
    registerAll: registerAll,
    get: get,
    getByBiome: getByBiome,
    getByType: getByType,
    getByTag: getByTag,
    getAllFloorIds: getAllFloorIds,
    getAll: getAll,
    registerTutorialFloors: registerTutorialFloors
  };
})();

// Auto-register tutorial floors on load (after TutorialFloors module is available)
if (typeof TutorialFloors !== 'undefined') {
  FloorMetadataRegistry.registerTutorialFloors();
}
