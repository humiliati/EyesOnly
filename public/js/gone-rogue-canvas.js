/* ============================================================
   EYES ONLY - Canvas Renderer for Gone Rogue
   High-performance canvas-based rendering system
   ============================================================ */

const CanvasRenderer = (function() {
  'use strict';

  // Configuration
  const DEFAULT_CELL_SIZE = 20; // Base cell size in pixels
  const FONT_FAMILY = 'Courier New, monospace';
  const EMOJI_FONT_FAMILY = 'Arial, sans-serif';

  // Render modes
  const RENDER_MODE = {
    ASCII: 'ascii',
    EMOJI: 'emoji'
  };

  /**
   * CanvasRenderer class - High-performance grid renderer
   */
  function CanvasRenderer(options) {
    options = options || {};

    this.width = options.width || 40;  // Grid width in cells
    this.height = options.height || 20; // Grid height in cells
    this.cellSize = options.cellSize || DEFAULT_CELL_SIZE;
    this.renderMode = options.renderMode || RENDER_MODE.EMOJI;
    this.enableLighting = options.enableLighting !== false; // Default true

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width * this.cellSize;
    this.canvas.height = this.height * this.cellSize;
    this.canvas.className = 'rogue-canvas';

    // Get 2D context
    this.ctx = this.canvas.getContext('2d');

    // Set up text rendering
    this._setupTextRendering();

    // Cache for performance
    this._tileCache = {};
    this._lastGrid = null;
  }

  /**
   * Setup text rendering properties
   */
  CanvasRenderer.prototype._setupTextRendering = function() {
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Font size should be slightly smaller than cell size for padding
    var fontSize = Math.floor(this.cellSize * 0.8);

    if (this.renderMode === RENDER_MODE.ASCII) {
      this.ctx.font = fontSize + 'px ' + FONT_FAMILY;
    } else {
      this.ctx.font = fontSize + 'px ' + EMOJI_FONT_FAMILY;
    }
  };

  /**
   * Main render function - single pass rendering
   * @param {Object} renderData - { grid, entities, effects, player }
   */
  CanvasRenderer.prototype.renderGrid = function(renderData) {
    if (!renderData || !renderData.grid) {
      return;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render in layers
    this._renderTiles(renderData.grid);

    // Apply lighting overlay if enabled
    if (this.enableLighting && typeof LightingSystem !== 'undefined') {
      this._renderLighting(renderData.grid);
    }

    this._renderEntities(renderData.entities);
    this._renderPets(renderData.pets);
    this._renderPlayer(renderData.player);
    this._renderEffects(renderData.effects);
  };

  /**
   * Render base tiles (floor, walls, items)
   * @param {Array} grid - 2D array of tile data
   */
  CanvasRenderer.prototype._renderTiles = function(grid) {
    for (var y = 0; y < grid.length; y++) {
      for (var x = 0; x < grid[y].length; x++) {
        var tile = grid[y][x];
        if (!tile) continue;

        this._renderTile(x, y, tile);
      }
    }
  };

  /**
   * Render a single tile
   * @param {number} x - Grid X position
   * @param {number} y - Grid Y position
   * @param {Object} tile - Tile data { char, color, bg, type }
   */
  CanvasRenderer.prototype._renderTile = function(x, y, tile) {
    var pixelX = x * this.cellSize;
    var pixelY = y * this.cellSize;
    var centerX = pixelX + this.cellSize / 2;
    var centerY = pixelY + this.cellSize / 2;

    // Render background if specified
    if (tile.bg) {
      this.ctx.fillStyle = tile.bg;
      this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
    }

    // Render character/emoji
    if (tile.char) {
      this.ctx.fillStyle = tile.color || '#FFFFFF';

      // Add text shadow for better visibility
      if (tile.color && tile.color !== '#000000') {
        this.ctx.shadowColor = tile.color;
        this.ctx.shadowBlur = 3;
      }

      this.ctx.fillText(tile.char, centerX, centerY);

      // Reset shadow
      this.ctx.shadowBlur = 0;
    }
  };

  /**
   * Render lighting overlay
   * @param {Array} grid - 2D array of tile data
   */
  CanvasRenderer.prototype._renderLighting = function(grid) {
    // Use source-over for direct darkness overlay (visible shadow gradients)
    this.ctx.globalCompositeOperation = 'source-over';

    for (var y = 0; y < grid.length; y++) {
      for (var x = 0; x < grid[y].length; x++) {
        var light = LightingSystem.getLightAt(x, y);

        // Calculate darkness level (inverse of light intensity)
        var darkness = 1 - light.intensity;

        // Only render darkness overlay if there's significant darkness
        if (darkness > 0.05) {
          var pixelX = x * this.cellSize;
          var pixelY = y * this.cellSize;

          // Apply darkness overlay — 70% max for visible shadows while staying playable
          var alpha = darkness * 0.7;

          // Parse light color for tinting
          var r = parseInt(light.color.substr(1, 2), 16);
          var g = parseInt(light.color.substr(3, 2), 16);
          var b = parseInt(light.color.substr(5, 2), 16);

          // Create darkness with subtle color tint
          var tintFactor = 0.1; // 10% of light color mixed into darkness
          var darkR = Math.floor(r * tintFactor);
          var darkG = Math.floor(g * tintFactor);
          var darkB = Math.floor(b * tintFactor);

          this.ctx.fillStyle = 'rgba(' + darkR + ',' + darkG + ',' + darkB + ',' + alpha + ')';
          this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
        }

        // Render light source glow if tile has a light source
        if (light.sources && light.sources.length > 0 && light.intensity > 0.6) {
          this._renderLightGlow(x, y, light);
        }

        // Render enemy sight cone as a red-tinted shadow overlay (darkens, not brightens)
        if (light.sightCone && light.sightCone > 0.01) {
          var coneAlpha = light.sightCone * 0.35; // Subtle red tint
          this.ctx.fillStyle = 'rgba(255,34,68,' + coneAlpha + ')';
          this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
        }
      }
    }
  };

  /**
   * Render light source glow effect
   * @param {number} x - Grid X position
   * @param {number} y - Grid Y position
   * @param {Object} light - Light data from LightingSystem
   */
  CanvasRenderer.prototype._renderLightGlow = function(x, y, light) {
    var centerX = (x + 0.5) * this.cellSize;
    var centerY = (y + 0.5) * this.cellSize;
    var radius = this.cellSize * 0.4;

    // Create radial gradient for glow
    var gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

    // Parse light color
    var r = parseInt(light.color.substr(1, 2), 16);
    var g = parseInt(light.color.substr(3, 2), 16);
    var b = parseInt(light.color.substr(5, 2), 16);

    var glowAlpha = light.intensity * 0.3;
    gradient.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + glowAlpha + ')');
    gradient.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      centerX - radius,
      centerY - radius,
      radius * 2,
      radius * 2
    );
  };

  /**
   * Render entities (enemies, NPCs)
   * @param {Array} entities - Array of entity objects { x, y, char, color }
   */
  CanvasRenderer.prototype._renderEntities = function(entities) {
    if (!entities || entities.length === 0) return;

    for (var i = 0; i < entities.length; i++) {
      var entity = entities[i];
      if (!entity || entity.x === undefined || entity.y === undefined) continue;

      var centerX = (entity.x + 0.5) * this.cellSize;
      var centerY = (entity.y + 0.5) * this.cellSize;

      // Render entity character/emoji
      this.ctx.fillStyle = entity.color || '#FF0000';

      // Add glow for enemies
      if (entity.isEnemy) {
        this.ctx.shadowColor = entity.color || '#FF0000';
        this.ctx.shadowBlur = 5;
      }

      this.ctx.fillText(entity.char || '?', centerX, centerY);

      // Reset shadow
      this.ctx.shadowBlur = 0;
    }
  };

  /**
   * Render player
   * @param {Object} player - Player object { x, y, char, color }
   */
  CanvasRenderer.prototype._renderPlayer = function(player) {
    if (!player || player.x === undefined || player.y === undefined) return;

    var centerX = (player.x + 0.5) * this.cellSize;
    var centerY = (player.y + 0.5) * this.cellSize;

    // Render player with distinctive glow
    this.ctx.fillStyle = player.color || '#00FF00';
    this.ctx.shadowColor = player.color || '#00FF00';
    this.ctx.shadowBlur = 8;

    this.ctx.fillText(player.char || '@', centerX, centerY);

    // Reset shadow
    this.ctx.shadowBlur = 0;
  };

  /**
   * Render pets (follower companions)
   * @param {Array} pets - Array of pet objects { x, y, emoji, opacity, type }
   */
  CanvasRenderer.prototype._renderPets = function(pets) {
    if (!pets || pets.length === 0) return;

    for (var i = 0; i < pets.length; i++) {
      var pet = pets[i];
      if (!pet || pet.x === undefined || pet.y === undefined) continue;

      var centerX = (pet.x + 0.5) * this.cellSize;
      var centerY = (pet.y + 0.5) * this.cellSize;

      // Save current alpha
      var oldAlpha = this.ctx.globalAlpha;

      // Apply pet opacity for subtle semi-transparency
      if (pet.opacity !== undefined) {
        this.ctx.globalAlpha = pet.opacity;
      }

      // Render pet emoji/character
      this.ctx.fillStyle = pet.color || '#FFFF88';

      // Add subtle glow based on pet tier
      if (pet.type === 'mega') {
        this.ctx.shadowColor = '#FF6B6B';
        this.ctx.shadowBlur = 6;
      } else if (pet.type === 'humanoid') {
        this.ctx.shadowColor = '#7BD7FF';
        this.ctx.shadowBlur = 4;
      } else {
        this.ctx.shadowColor = '#FFFF88';
        this.ctx.shadowBlur = 3;
      }

      this.ctx.fillText(pet.emoji || '🐾', centerX, centerY);

      // Reset
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = oldAlpha;
    }
  };

  /**
   * Render effects (animations, particles)
   * @param {Array} effects - Array of effect objects { x, y, char, color, alpha }
   */
  CanvasRenderer.prototype._renderEffects = function(effects) {
    if (!effects || effects.length === 0) return;

    for (var i = 0; i < effects.length; i++) {
      var effect = effects[i];
      if (!effect || effect.x === undefined || effect.y === undefined) continue;

      var centerX = (effect.x + 0.5) * this.cellSize;
      var centerY = (effect.y + 0.5) * this.cellSize;

      // Save current alpha
      var oldAlpha = this.ctx.globalAlpha;

      // Apply effect alpha if specified
      if (effect.alpha !== undefined) {
        this.ctx.globalAlpha = effect.alpha;
      }

      // Render effect
      this.ctx.fillStyle = effect.color || '#FFFFFF';

      if (effect.glow) {
        this.ctx.shadowColor = effect.color || '#FFFFFF';
        this.ctx.shadowBlur = 10;
      }

      this.ctx.fillText(effect.char || '*', centerX, centerY);

      // Reset
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = oldAlpha;
    }
  };

  /**
   * Convert canvas pixel coordinates to grid cell coordinates
   * @param {number} canvasX - Canvas X pixel coordinate
   * @param {number} canvasY - Canvas Y pixel coordinate
   * @returns {Object} { x, y } grid coordinates
   */
  CanvasRenderer.prototype.canvasToGrid = function(canvasX, canvasY) {
    return {
      x: Math.floor(canvasX / this.cellSize),
      y: Math.floor(canvasY / this.cellSize)
    };
  };

  /**
   * Convert grid coordinates to canvas pixel coordinates (center of cell)
   * @param {number} gridX - Grid X coordinate
   * @param {number} gridY - Grid Y coordinate
   * @returns {Object} { x, y } canvas pixel coordinates
   */
  CanvasRenderer.prototype.gridToCanvas = function(gridX, gridY) {
    return {
      x: (gridX + 0.5) * this.cellSize,
      y: (gridY + 0.5) * this.cellSize
    };
  };

  /**
   * Set render mode (ascii or emoji)
   * @param {string} mode - RENDER_MODE.ASCII or RENDER_MODE.EMOJI
   */
  CanvasRenderer.prototype.setRenderMode = function(mode) {
    if (mode === RENDER_MODE.ASCII || mode === RENDER_MODE.EMOJI) {
      this.renderMode = mode;
      this._setupTextRendering();
    }
  };

  /**
   * Toggle lighting on/off
   * @param {boolean} enabled - Enable or disable lighting
   */
  CanvasRenderer.prototype.setLightingEnabled = function(enabled) {
    this.enableLighting = !!enabled;
  };

  /**
   * Resize canvas (for responsive design)
   * @param {number} cellSize - New cell size in pixels
   */
  CanvasRenderer.prototype.resize = function(cellSize) {
    this.cellSize = cellSize;
    this.canvas.width = this.width * this.cellSize;
    this.canvas.height = this.height * this.cellSize;
    this._setupTextRendering();
  };

  /**
   * Get canvas element
   * @returns {HTMLCanvasElement}
   */
  CanvasRenderer.prototype.getCanvas = function() {
    return this.canvas;
  };

  /**
   * Clear the canvas
   */
  CanvasRenderer.prototype.clear = function() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };

  // Export
  return {
    CanvasRenderer: CanvasRenderer,
    RENDER_MODE: RENDER_MODE
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasRenderer;
}
