/**
 * BiomeConfig — floor type + biome selection: _getFloorType, _getBiome.
 * Extracted Phase 24 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var BiomeConfig = (function() {
  'use strict';

  /**
   * Determine floor type from floor number.
   * @param {number} floorNum
   * @param {Object} ctx - Context from monolith
   * @returns {string} Floor type constant
   */
  function getFloorType(floorNum, ctx) {
    var FLOOR_TYPES = ctx.FLOOR_TYPES;
    var difficultyTier = ctx.getDifficultyTier();
    var rng = ctx.rng;
    var BONFIRE_FLOORS = ctx.BONFIRE_FLOORS;
    var BOSS_FLOORS = ctx.BOSS_FLOORS;

    // On Uber 1+, early floors use stealth (enemies spawn) instead of tutorial (safe)
    if (floorNum <= 2) return (difficultyTier <= 1) ? FLOOR_TYPES.TUTORIAL : FLOOR_TYPES.STEALTH;
    if (floorNum <= 4) return FLOOR_TYPES.GHOST;
    if (BONFIRE_FLOORS.indexOf(floorNum) !== -1) return FLOOR_TYPES.BONFIRE;
    if (floorNum === 30) return FLOOR_TYPES.FINAL;
    if (BOSS_FLOORS.indexOf(floorNum) !== -1) return FLOOR_TYPES.BOSS;

    // Random exploration floors (5% chance on floors 15+)
    if (floorNum >= 15 && rng() < 0.05) return FLOOR_TYPES.EXPLORATION;

    // Light stealth early
    if (floorNum <= 9) return FLOOR_TYPES.STEALTH;

    // Standard combat floors
    return FLOOR_TYPES.COMBAT;
  }

  /**
   * Get biome for floor using weighted random selection (floor shuffling).
   * Floors 1-3 are always Forest for new player experience.
   * Other floors use weighted probabilities based on depth.
   * @param {number} floorNum
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Biome object
   */
  function getBiome(floorNum, ctx) {
    var BIOMES = ctx.BIOMES;
    var BOSS_FLOORS = ctx.BOSS_FLOORS;
    var rng = ctx.rng;

    // Floors 1-3: Always Forest (tutorial/starting experience)
    if (floorNum <= 3) return BIOMES.FOREST;

    // Floor 4: Special Grey Cave floor
    if (floorNum === 4) return BIOMES.GREY_CAVE;

    // Boss floors: Use boss-appropriate biomes (Aerospace for high floors)
    if (BOSS_FLOORS.indexOf(floorNum) !== -1 && floorNum >= 23) {
      return BIOMES.AEROSPACE;
    }

    // Weighted biome selection based on floor depth
    var weights = {};

    if (floorNum >= 5 && floorNum <= 6) {
      // Early game: Forest dominant
      weights = {
        FOREST: 60,
        MALL: 20,
        INDUSTRIAL: 15,
        GREY_CAVE: 5
      };
    } else if (floorNum >= 7 && floorNum <= 9) {
      // Mid-early game: Mall becomes common
      weights = {
        FOREST: 25,
        MALL: 35,
        INDUSTRIAL: 30,
        GREY_CAVE: 10
      };
    } else if (floorNum >= 10 && floorNum <= 15) {
      // Mid game: Industrial rises
      weights = {
        FOREST: 10,
        MALL: 25,
        INDUSTRIAL: 40,
        GREY_CAVE: 15,
        AEROSPACE: 10
      };
    } else if (floorNum >= 16 && floorNum <= 22) {
      // Late game: Mix with Aerospace
      weights = {
        FOREST: 5,
        MALL: 20,
        INDUSTRIAL: 35,
        GREY_CAVE: 10,
        AEROSPACE: 30
      };
    } else {
      // Endgame: Aerospace dominant
      weights = {
        MALL: 10,
        INDUSTRIAL: 20,
        AEROSPACE: 70
      };
    }

    // Calculate total weight
    var totalWeight = 0;
    for (var key in weights) {
      totalWeight += weights[key];
    }

    // Select random biome based on weights
    var rand = rng() * totalWeight;
    var cumulative = 0;

    for (var biomeKey in weights) {
      cumulative += weights[biomeKey];
      if (rand <= cumulative) {
        return BIOMES[biomeKey];
      }
    }

    // Fallback (should never happen)
    return BIOMES.OFFICE;
  }

  return {
    getFloorType: getFloorType,
    getBiome: getBiome
  };
})();
