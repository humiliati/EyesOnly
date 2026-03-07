/**
 * BiomeVisualFacade — owns biome visual state and wraps BiomeVisuals calls.
 * Extracted from gone-rogue.js monolith (Phase 3 of WBE roadmap).
 *
 * State owned:
 *   _biomeVisualGrid       – Pre-computed visual substitution grid (wall/floor chars)
 *   _biomeBackgroundColors  – Pre-computed per-tile background gradient colors (40x20)
 *   _tileRenderObjects      – Per-tile render objects for visual density (multi-tree scatter)
 *
 * All build* methods delegate to BiomeVisuals module with a provided ctx,
 * then store the results internally.
 *
 * Stateless IIFE module — loaded before gone-rogue.js via <script> tag.
 */
var BiomeVisualFacade = (function() {
  'use strict';

  // ── Owned State ──────────────────────────────────────────────────
  var _biomeVisualGrid = null;
  var _biomeBackgroundColors = null;
  var _tileRenderObjects = null;

  // ── Build Methods (delegate to BiomeVisuals, store result) ───────

  function buildBiomeVisualGrid(biome, ctx) {
    if (typeof BiomeVisuals !== 'undefined') {
      BiomeVisuals.buildBiomeVisualGrid(biome, ctx);
      _biomeVisualGrid = BiomeVisuals.getBiomeVisualGrid();
    } else {
      _biomeVisualGrid = null;
    }
  }

  function buildTileRenderObjects(biome, ctx) {
    if (typeof BiomeVisuals !== 'undefined') {
      BiomeVisuals.buildTileRenderObjects(biome, ctx);
      _tileRenderObjects = BiomeVisuals.getRenderObjectsGrid();
    } else {
      _tileRenderObjects = null;
    }
  }

  function buildBiomeBackgroundColors(biome, isNight, ctx) {
    if (typeof BiomeVisuals !== 'undefined') {
      BiomeVisuals.buildBiomeBackgroundColors(biome, isNight, ctx);
      _biomeBackgroundColors = BiomeVisuals.getBackgroundColorsGrid();
    } else {
      _biomeBackgroundColors = null;
    }
  }

  // ── Passthrough Getters (delegate to BiomeVisuals) ───────────────

  function generateTileRenderObjects(x, y, biome, ctx) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.generateTileRenderObjects(x, y, biome, ctx);
    return [];
  }

  function pickWeightedCharWithRNG(tiles, rng) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.pickWeightedCharWithRNG(tiles, rng);
    return tiles[tiles.length - 1].char;
  }

  function getNeighborTiles(x, y, ctx) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.getNeighborTiles(x, y, ctx);
    return [];
  }

  function getBiomeBackgroundColor(x, y) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.getBiomeBackgroundColor(x, y);
    return null;
  }

  function getTileRenderObjects(x, y) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.getTileRenderObjects(x, y);
    return null;
  }

  function hexToRgb(hex) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.hexToRgb(hex);
    return { r: 0, g: 0, b: 0 };
  }

  function rgbToHex(r, g, b) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.rgbToHex(r, g, b);
    return '#000000';
  }

  function lerpColor(color1, color2, t) {
    if (typeof BiomeVisuals !== 'undefined') return BiomeVisuals.lerpColor(color1, color2, t);
    return color1;
  }

  // ── State Accessors ──────────────────────────────────────────────

  function getVisualGrid()        { return _biomeVisualGrid; }
  function setVisualGrid(v)       { _biomeVisualGrid = v; }
  function getBackgroundColors()  { return _biomeBackgroundColors; }
  function setBackgroundColors(v) { _biomeBackgroundColors = v; }
  function getRenderObjects()     { return _tileRenderObjects; }
  function setRenderObjects(v)    { _tileRenderObjects = v; }

  function clearAll() {
    _biomeVisualGrid = null;
    _biomeBackgroundColors = null;
    _tileRenderObjects = null;
  }

  // ── Public API ───────────────────────────────────────────────────
  return {
    // Build methods
    buildBiomeVisualGrid: buildBiomeVisualGrid,
    buildTileRenderObjects: buildTileRenderObjects,
    buildBiomeBackgroundColors: buildBiomeBackgroundColors,

    // Passthrough getters
    generateTileRenderObjects: generateTileRenderObjects,
    pickWeightedCharWithRNG: pickWeightedCharWithRNG,
    getNeighborTiles: getNeighborTiles,
    getBiomeBackgroundColor: getBiomeBackgroundColor,
    getTileRenderObjects: getTileRenderObjects,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    lerpColor: lerpColor,

    // State accessors
    getVisualGrid: getVisualGrid,
    setVisualGrid: setVisualGrid,
    getBackgroundColors: getBackgroundColors,
    setBackgroundColors: setBackgroundColors,
    getRenderObjects: getRenderObjects,
    setRenderObjects: setRenderObjects,
    clearAll: clearAll
  };
})();
