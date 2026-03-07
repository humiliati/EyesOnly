/**
 * BiomeDataProvider — shim that owns the BIOMES object.
 * Extracted from gone-rogue.js monolith (lines 230-574).
 *
 * Provides the canonical BIOMES map to the monolith and all satellite
 * modules via getBiomes(). Two hydration modes:
 *
 *   1. SYNC (immediate):  Returns a minimal FOREST-only fallback so
 *      the monolith IIFE can capture a reference to BIOMES during its
 *      synchronous execution phase.  No biome functions are called at
 *      IIFE time — only during startNewRun(), which is always async.
 *
 *   2. ASYNC (registry):  When GoneRogueDataRegistry finishes loading
 *      biomes.json, call BiomeDataProvider.hydrate() to replace the
 *      fallback with the full 6-biome dataset.  Because the monolith
 *      holds a reference to the SAME object (via getBiomes()), all
 *      consumers see the hydrated data without any rewiring.
 *
 * Pattern: stateless IIFE, consistent with all satellite modules.
 */
var BiomeDataProvider = (function() {
  'use strict';

  // ── The single BIOMES object. Starts as minimal fallback,
  //    hydrated in-place when the data registry loads biomes.json. ──
  var _biomes = {
    FOREST: {
      name: 'Cozy Forest',
      wallChar: '\uD83C\uDF33',  // 🌳
      floorChar: ',',
      description: 'Welcoming woodland with tall grass',
      floorRange: [1, 3],
      wallDensity: 2,
      wallTiles: [
        { char: '\uD83C\uDF33', weight: 40 },
        { char: '\uD83C\uDF32', weight: 30 },
        { char: '\uD83E\uDEB5', weight: 15 },
        { char: '\uD83E\uDEA8', weight: 10 },
        { char: '\uD83C\uDF3F', weight: 5 }
      ],
      floorTiles: [
        { char: ',', weight: 50, animated: true },
        { char: '`', weight: 25, animated: true },
        { char: "'", weight: 15, animated: true },
        { char: '"', weight: 5, animated: true },
        { char: '\u00B7', weight: 5 }
      ],
      props: [],
      interactiveObjects: [],
      tileEffects: {},
      spawnFeatures: {},
      enemies: [],
      enemyDensity: 0.0,
      backgroundGradient: {
        night: { start: '#061206', end: '#0d2a12' },
        day:   { start: '#081a08', end: '#1e4a1e' }
      }
    }
  };

  var _hydrated = false;

  /**
   * Hydrate _biomes in-place from the data registry's parsed JSON.
   * Mutates the existing object so all references update automatically.
   * @param {Object} jsonBiomes — the raw object from biomes.json
   */
  function hydrate(jsonBiomes) {
    if (!jsonBiomes || typeof jsonBiomes !== 'object') {
      console.warn('[BiomeDataProvider] hydrate() called with invalid data — keeping fallback');
      return;
    }

    // Clear existing keys (fallback FOREST)
    var existingKeys = Object.keys(_biomes);
    for (var i = 0; i < existingKeys.length; i++) {
      delete _biomes[existingKeys[i]];
    }

    // Copy all biome definitions from JSON into the same object reference
    var newKeys = Object.keys(jsonBiomes);
    for (var j = 0; j < newKeys.length; j++) {
      _biomes[newKeys[j]] = jsonBiomes[newKeys[j]];
    }

    _hydrated = true;
    console.log('[BiomeDataProvider] Hydrated ' + newKeys.length + ' biomes from registry: ' + newKeys.join(', '));
  }

  /**
   * Returns the single BIOMES object reference.
   * Before hydration: contains only FOREST fallback.
   * After hydration: contains all biomes from biomes.json.
   * @returns {Object} The BIOMES map (FOREST, GREY_CAVE, OFFICE, etc.)
   */
  function getBiomes() {
    return _biomes;
  }

  /**
   * Check if hydration has completed.
   * @returns {boolean}
   */
  function isHydrated() {
    return _hydrated;
  }

  /**
   * Get a specific biome by key, with FOREST fallback.
   * @param {string} key — e.g. 'FOREST', 'GREY_CAVE', 'OFFICE'
   * @returns {Object} The biome definition
   */
  function get(key) {
    return _biomes[key] || _biomes.FOREST || null;
  }

  /**
   * List all available biome keys.
   * @returns {string[]}
   */
  function keys() {
    return Object.keys(_biomes);
  }

  return {
    getBiomes: getBiomes,
    hydrate: hydrate,
    isHydrated: isHydrated,
    get: get,
    keys: keys
  };
})();
