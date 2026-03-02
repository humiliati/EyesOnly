/**
 * BiomeVisuals — owns biome visual state and provides designer-friendly API
 * for visual grid, background gradients, and tile render objects.
 * Extracted Phase 26 from gone-rogue.js.
 *
 * Designed for reuse by designer tools — all visual state lives here,
 * queried via getBiomeBackgroundColor / getTileRenderObjects.
 */
var BiomeVisuals = (function() {
  'use strict';

  // ── Visual state (owned by this module) ──
  var _biomeVisualGrid = null;
  var _biomeBackgroundColors = null;
  var _tileRenderObjects = null;

  // ── Colour math helpers ──

  /**
   * Parse hex color string to RGB object.
   * @param {string} hex - Color string like '#0a1a0a'
   * @returns {Object} { r, g, b } integers 0-255
   */
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  }

  /**
   * Convert RGB values to hex color string.
   * @param {number} r - Red 0-255
   * @param {number} g - Green 0-255
   * @param {number} b - Blue 0-255
   * @returns {string} Hex color string like '#0a1a0a'
   */
  function rgbToHex(r, g, b) {
    var rr = Math.max(0, Math.min(255, Math.round(r)));
    var gg = Math.max(0, Math.min(255, Math.round(g)));
    var bb = Math.max(0, Math.min(255, Math.round(b)));
    return '#' + ((1 << 24) + (rr << 16) + (gg << 8) + bb).toString(16).slice(1);
  }

  /**
   * Linear interpolate between two hex colors.
   * @param {string} color1 - Start hex color
   * @param {string} color2 - End hex color
   * @param {number} t - Interpolation factor 0.0 to 1.0
   * @returns {string} Interpolated hex color
   */
  function lerpColor(color1, color2, t) {
    var c1 = hexToRgb(color1);
    var c2 = hexToRgb(color2);
    return rgbToHex(
      c1.r + (c2.r - c1.r) * t,
      c1.g + (c2.g - c1.g) * t,
      c1.b + (c2.b - c1.b) * t
    );
  }

  // ── Grid builders ──

  /**
   * Build the biome visual grid: pre-compute wall/floor char substitutions
   * so the display is stable across render calls (no flickering).
   * Delegates heavy lifting to FloorGenerator if available.
   * @param {Object} biome - Biome definition
   * @param {Object} ctx - Context from monolith (floorGenCtx)
   */
  function buildBiomeVisualGrid(biome, ctx) {
    if (typeof FloorGenerator !== 'undefined') {
      _biomeVisualGrid = FloorGenerator.buildBiomeVisualGrid(biome, ctx);
    } else {
      _biomeVisualGrid = null;
    }
  }

  /**
   * Build tile render objects grid: pre-compute visual scatter objects
   * for each tile to create dense forest walls without changing collision.
   * @param {Object} biome - Biome definition
   * @param {Object} ctx - Context from monolith (floorGenCtx)
   */
  function buildTileRenderObjects(biome, ctx) {
    if (typeof FloorGenerator !== 'undefined') {
      _tileRenderObjects = FloorGenerator.buildTileRenderObjects(biome, ctx);
    } else {
      _tileRenderObjects = null;
    }
  }

  /**
   * Pre-compute per-tile background colors for the current biome gradient.
   * Uses 135-degree axial gradient (top-left to bottom-right diagonal).
   * @param {Object} biome - Biome definition with backgroundGradient
   * @param {boolean} isNight - Whether this is a night biome variant
   * @param {Object} ctx - Context from monolith (floorGenCtx)
   */
  function buildBiomeBackgroundColors(biome, isNight, ctx) {
    if (typeof FloorGenerator !== 'undefined') {
      _biomeBackgroundColors = FloorGenerator.buildBiomeBackgroundColors(biome, isNight, ctx);
    } else {
      _biomeBackgroundColors = null;
    }
  }

  // ── Per-tile lookups (designer tool API) ──

  /**
   * Get the biome background color for a specific tile position.
   * Returns null if no gradient is active.
   * @param {number} x - Grid X coordinate
   * @param {number} y - Grid Y coordinate
   * @returns {string|null} Hex color or null
   */
  function getBiomeBackgroundColor(x, y) {
    if (!_biomeBackgroundColors) return null;
    if (y < 0 || y >= _biomeBackgroundColors.length) return null;
    if (x < 0 || x >= _biomeBackgroundColors[y].length) return null;
    return _biomeBackgroundColors[y][x];
  }

  /**
   * Get tile render objects for a specific tile position.
   * @param {number} x - Tile X position
   * @param {number} y - Tile Y position
   * @returns {Array|null} Array of render objects or null
   */
  function getTileRenderObjects(x, y) {
    if (!_tileRenderObjects) return null;
    if (y < 0 || y >= _tileRenderObjects.length) return null;
    if (x < 0 || x >= _tileRenderObjects[y].length) return null;
    return _tileRenderObjects[y][x];
  }

  /**
   * Get the full biome visual grid (for renderers).
   * @returns {Array|null} 2D grid of visual characters or null
   */
  function getBiomeVisualGrid() {
    return _biomeVisualGrid;
  }

  /**
   * Get the full background colors grid (for designer preview).
   * @returns {Array|null} 2D grid of hex color strings or null
   */
  function getBackgroundColorsGrid() {
    return _biomeBackgroundColors;
  }

  /**
   * Get the full tile render objects grid (for designer preview).
   * @returns {Array|null} 2D grid of render object arrays or null
   */
  function getRenderObjectsGrid() {
    return _tileRenderObjects;
  }

  // ── FloorGenerator delegation helpers ──

  /**
   * Generate render objects for a single tile with seeded scatter.
   * @param {number} x - Tile X position
   * @param {number} y - Tile Y position
   * @param {Object} biome - Current biome definition
   * @param {Object} ctx - floorGenCtx
   * @returns {Array} Array of render objects
   */
  function generateTileRenderObjects(x, y, biome, ctx) {
    if (typeof FloorGenerator !== 'undefined') {
      return FloorGenerator.generateTileRenderObjects(x, y, biome, ctx);
    }
    return [];
  }

  /**
   * Pick a weighted character from a tile set.
   * @param {Array} tiles - Array of { char, weight }
   * @param {Object} ctx - floorGenCtx
   * @returns {string} Selected character
   */
  function pickWeightedChar(tiles, ctx) {
    if (typeof FloorGenerator !== 'undefined') {
      return FloorGenerator.pickWeightedChar(tiles, ctx);
    }
    return tiles[tiles.length - 1].char;
  }

  /**
   * Pick a weighted character using a specific RNG instance.
   * @param {Array} tiles - Array of { char, weight }
   * @param {Object} rng - RNG instance
   * @returns {string} Selected character
   */
  function pickWeightedCharWithRNG(tiles, rng) {
    if (typeof FloorGenerator !== 'undefined') {
      return FloorGenerator.pickWeightedCharWithRNG(tiles, rng);
    }
    return tiles[tiles.length - 1].char;
  }

  /**
   * Get neighbor tiles for a position.
   * @param {number} x - Tile X position
   * @param {number} y - Tile Y position
   * @param {Object} ctx - floorGenCtx
   * @returns {Array} Array of neighbor tile values
   */
  function getNeighborTiles(x, y, ctx) {
    if (typeof FloorGenerator !== 'undefined') {
      return FloorGenerator.getNeighborTiles(x, y, ctx);
    }
    return [];
  }

  /**
   * Reset all visual state (called on floor generation).
   */
  function reset() {
    _biomeVisualGrid = null;
    _biomeBackgroundColors = null;
    _tileRenderObjects = null;
  }

  return {
    // Builders (called during floor gen)
    buildBiomeVisualGrid: buildBiomeVisualGrid,
    buildTileRenderObjects: buildTileRenderObjects,
    buildBiomeBackgroundColors: buildBiomeBackgroundColors,
    reset: reset,

    // Per-tile lookups (public API / designer tools)
    getBiomeBackgroundColor: getBiomeBackgroundColor,
    getTileRenderObjects: getTileRenderObjects,

    // Full grid access (designer tools)
    getBiomeVisualGrid: getBiomeVisualGrid,
    getBackgroundColorsGrid: getBackgroundColorsGrid,
    getRenderObjectsGrid: getRenderObjectsGrid,

    // FloorGenerator delegation helpers
    generateTileRenderObjects: generateTileRenderObjects,
    pickWeightedChar: pickWeightedChar,
    pickWeightedCharWithRNG: pickWeightedCharWithRNG,
    getNeighborTiles: getNeighborTiles,

    // Colour math (reusable by designer tools)
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    lerpColor: lerpColor
  };
})();
