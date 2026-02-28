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

  // ── Phase 3.2: Item Twinkle State ─────────────────────────────────────────
  // Tracks per-position bobbing phases so collectibles, currencies, and
  // interactive items gently pulse/shimmer on the ground.
  var _twinklePhases = {}; // key: "x,y" → float phase (radians)

  // Prime-number multipliers for stable per-tile phase seeding (avoids grid-aligned sync)
  var TWINKLE_SEED_X = 1.7;
  var TWINKLE_SEED_Y = 3.1;

  /**
   * Advance twinkle phases for the given set of ground entities.
   * Called once per renderGrid() invocation for non-enemy entities.
   * @param {Array} entities
   */
  function _advanceTwinklePhases(entities) {
    if (!entities) return;
    for (var i = 0; i < entities.length; i++) {
      var e = entities[i];
      if (!e || e.isEnemy) continue;
      var key = e.x + ',' + e.y;
      if (_twinklePhases[key] === undefined) {
        // Seed with a stable per-position offset so items don't all pulse together
        _twinklePhases[key] = ((e.x * TWINKLE_SEED_X + e.y * TWINKLE_SEED_Y) % (Math.PI * 2));
      }
      _twinklePhases[key] += 0.04; // ~2.4 rad/s at 60fps → ~2.5s cycle
    }
  }

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
    // Allow mobile to shrink emoji/text further via CSS var.
    var scale = 0.8;
    try {
      if (typeof document !== 'undefined' && document.body) {
        var css = getComputedStyle(document.body).getPropertyValue('--rogue-emoji-scale');
        var n = parseFloat(css);
        if (isFinite(n) && n > 0.2 && n <= 1.0) scale = scale * n;
      }
    } catch (e0) {}

    var fontSize = Math.floor(this.cellSize * scale);

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

    // Camera transform (optional): { zoom, offsetX, offsetY, worldOriginX, worldOriginY }
    var cam = (renderData && renderData.camera) ? renderData.camera : null;
    var zoom = cam && isFinite(cam.zoom) ? cam.zoom : 1;
    var offX = cam && isFinite(cam.offsetX) ? cam.offsetX : 0;
    var offY = cam && isFinite(cam.offsetY) ? cam.offsetY : 0;
    this._worldOriginX = cam && isFinite(cam.worldOriginX) ? cam.worldOriginX : 0;
    this._worldOriginY = cam && isFinite(cam.worldOriginY) ? cam.worldOriginY : 0;

    // Clear canvas in identity space
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply camera transform for subsequent draws
    this.ctx.setTransform(zoom, 0, 0, zoom, offX, offY);

    // Render in layers
    this._renderTiles(renderData.grid);

    // Advance twinkle phases for ground items / collectibles (Phase 3.2)
    _advanceTwinklePhases(renderData.entities);

    this._renderEntities(renderData.entities);
    this._renderPets(renderData.pets);
    this._renderPlayer(renderData.player);

    // Render pancake stack above player head
    this._renderPancakeStack(renderData.player);

    this._renderEffects(renderData.effects);

    // Render light source emojis BEFORE lighting passes so they are darkened/lit properly
    if (this.enableLighting && typeof LightingSystem !== 'undefined') {
      this._renderLightSourceEmojis(renderData.grid);
    }

    // Apply lighting passes AFTER all world/entity rendering so darkness acts as
    // a gameplay-visible stealth mask that affects everything the player can see.
    if (this.enableLighting && typeof LightingSystem !== 'undefined') {
      // Pass 1: darkness mask (per-tile darkness overlay + sight cone tint)
      this._renderDarknessMask(renderData.grid);
      // Pass 2: additive emissive glows (can spill onto entities)
      this._renderSourceGlows(renderData.grid);
    }
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

    // Pulsing glow highlight for special tiles (locked gates, etc.)
    if (tile.glow) {
      var glowRadius = this.cellSize * 1.5;
      var pulse = 0.4 + 0.3 * Math.sin(performance.now() * 0.003);
      var gr = parseInt(tile.glow.substr(1, 2), 16);
      var gg = parseInt(tile.glow.substr(3, 2), 16);
      var gb = parseInt(tile.glow.substr(5, 2), 16);
      var glowGrad = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
      glowGrad.addColorStop(0, 'rgba(' + gr + ',' + gg + ',' + gb + ',' + pulse + ')');
      glowGrad.addColorStop(0.5, 'rgba(' + gr + ',' + gg + ',' + gb + ',' + (pulse * 0.3) + ')');
      glowGrad.addColorStop(1, 'rgba(' + gr + ',' + gg + ',' + gb + ',0)');
      var prevComp = this.ctx.globalCompositeOperation;
      this.ctx.globalCompositeOperation = 'lighter';
      this.ctx.fillStyle = glowGrad;
      this.ctx.fillRect(centerX - glowRadius, centerY - glowRadius, glowRadius * 2, glowRadius * 2);
      this.ctx.globalCompositeOperation = prevComp;
    }

    // Check if we have multiple render objects for this tile (multi-tree scatter)
    var renderObjects = null;
    if (typeof GoneRogue !== 'undefined' && GoneRogue.getTileRenderObjects) {
      // When using camera-window rendering, map view coords back to world coords.
      var wx = x + (this._worldOriginX || 0);
      var wy = y + (this._worldOriginY || 0);
      renderObjects = GoneRogue.getTileRenderObjects(wx, wy);
    }

    if (renderObjects && renderObjects.length > 0) {
      // Render multiple objects per tile for visual density
      // Sort by layer order: trunk -> scatter -> edge (back to front)
      var layerOrder = { 'trunk': 0, 'scatter': 1, 'edge': 2 };
      var sorted = renderObjects.slice().sort(function(a, b) {
        return (layerOrder[a.layer] || 0) - (layerOrder[b.layer] || 0);
      });

      // Save font size for scale restoration
      var originalFont = this.ctx.font;

      var scale = 0.8;
      try {
        if (typeof document !== 'undefined' && document.body) {
          var css = getComputedStyle(document.body).getPropertyValue('--rogue-emoji-scale');
          var n = parseFloat(css);
          if (isFinite(n) && n > 0.2 && n <= 1.0) scale = scale * n;
        }
      } catch (e0) {}

      var baseFontSize = Math.floor(this.cellSize * scale);

      for (var i = 0; i < sorted.length; i++) {
        var obj = sorted[i];
        var objCenterX = centerX + (obj.offsetX || 0);
        var objCenterY = centerY + (obj.offsetY || 0);

        // Apply scale to font size
        var scaledFontSize = Math.floor(baseFontSize * (obj.scale || 1.0));
        if (this.renderMode === RENDER_MODE.ASCII) {
          this.ctx.font = scaledFontSize + 'px ' + FONT_FAMILY;
        } else {
          this.ctx.font = scaledFontSize + 'px ' + EMOJI_FONT_FAMILY;
        }

        // Render object emoji
        this.ctx.fillStyle = tile.color || '#FFFFFF';

        // Add text shadow for better visibility
        if (tile.color && tile.color !== '#000000') {
          this.ctx.shadowColor = tile.color;
          this.ctx.shadowBlur = 3;
        }

        this.ctx.fillText(obj.emoji, objCenterX, objCenterY);

        // Reset shadow
        this.ctx.shadowBlur = 0;
      }

      // Restore original font
      this.ctx.font = originalFont;
    } else {
      // Render single character/emoji (legacy path)
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
    }
  };

  /**
   * Render darkness mask overlay (per-tile darkness + enemy sight cone tint).
   * Called AFTER all world/entity rendering so it acts as a stealth visibility mask.
   * @param {Array} grid - 2D array of tile data
   */
  CanvasRenderer.prototype._renderDarknessMask = function(grid) {
    // Use source-over for direct darkness overlay (visible shadow gradients)
    this.ctx.globalCompositeOperation = 'source-over';

    for (var y = 0; y < grid.length; y++) {
      for (var x = 0; x < grid[y].length; x++) {
        var wx = x + (this._worldOriginX || 0);
        var wy = y + (this._worldOriginY || 0);
        var light = LightingSystem.getLightAt(wx, wy);

        // Calculate darkness level (inverse of light intensity)
        var darkness = 1 - light.intensity;

        var pixelX = x * this.cellSize;
        var pixelY = y * this.cellSize;

        // Only render darkness overlay if there's significant darkness
        if (darkness > 0.05) {
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

        // Render enemy sight cone as a red-tinted shadow overlay (darkens, not brightens)
        if (light.sightCone && light.sightCone > 0.01) {
          var coneAlpha = light.sightCone * 0.35; // Subtle red tint
          this.ctx.fillStyle = 'rgba(255,34,68,' + coneAlpha + ')';
          this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
        }
      }
    }

    // Restore composite operation after darkness mask pass
    this.ctx.globalCompositeOperation = 'source-over';
  };

  /**
   * Render smooth light gradients emanating from actual source positions.
   * Each light source gets one large radial gradient covering its full radius,
   * instead of per-tile orbs.
   */
  CanvasRenderer.prototype._renderSourceGlows = function(grid) {
    if (typeof LightingSystem === 'undefined') return;

    var prevComp = this.ctx.globalCompositeOperation;
    this.ctx.globalCompositeOperation = 'lighter';

    for (var y = 0; y < grid.length; y++) {
      for (var x = 0; x < grid[y].length; x++) {
        var wx = x + (this._worldOriginX || 0);
        var wy = y + (this._worldOriginY || 0);
        var light = LightingSystem.getLightAt(wx, wy);

        // Only add glow if there's significant light and it has a color
        if (light.intensity > 0.05 && light.color && light.color !== '#000000' && light.color !== '#888888') {
          var pixelX = x * this.cellSize;
          var pixelY = y * this.cellSize;
          
          var r = parseInt(light.color.substr(1, 2), 16);
          var g = parseInt(light.color.substr(3, 2), 16);
          var b = parseInt(light.color.substr(5, 2), 16);
          
          // Scale glow by intensity
          var alpha = light.intensity * 0.2; 
          this.ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
          this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
        }
      }
    }

    this.ctx.globalCompositeOperation = prevComp;
  };

  /**
   * Render light source emojis at their origin positions.
   * Each source gets its emoji with a colored glow halo matching its light color.
   * Flickering sources pulse in sync with the lighting system's flicker math.
   * Respects visibility configuration, layer ordering, and special bulb rendering.
   * @param {Array} grid - 2D array of tile data
   */
  CanvasRenderer.prototype._renderLightSourceEmojis = function(grid) {
    if (typeof LightingSystem === 'undefined') return;

    var lightSources = LightingSystem.getLightSourcePositions(grid);
    if (!lightSources || lightSources.length === 0) return;

    var frameCount = LightingSystem.getFrameCount();

    // Separate sources by layer for proper rendering order
    var layerOrder = ['below_all', 'below_doors', 'below_items', 'above_all'];
    var sourcesByLayer = {};
    for (var l = 0; l < layerOrder.length; l++) {
      sourcesByLayer[layerOrder[l]] = [];
    }

    // Sort sources into layers
    for (var i = 0; i < lightSources.length; i++) {
      var source = lightSources[i];
      // Skip if not visible
      if (!source.visible) continue;

      var layer = source.layer || 'below_items';
      if (!sourcesByLayer[layer]) sourcesByLayer[layer] = [];
      sourcesByLayer[layer].push(source);
    }

    // Render each layer in order
    for (var l = 0; l < layerOrder.length; l++) {
      var layer = layerOrder[l];
      var sources = sourcesByLayer[layer];

      for (var i = 0; i < sources.length; i++) {
        var source = sources[i];

        // Convert world coords to view coords
        var viewX = source.x - (this._worldOriginX || 0);
        var viewY = source.y - (this._worldOriginY || 0);

        // Skip if out of visible area
        if (viewX < 0 || viewX >= grid[0].length || viewY < 0 || viewY >= grid.length) {
          continue;
        }

        var centerX = (viewX + 0.5) * this.cellSize;
        var centerY = (viewY + 0.5) * this.cellSize;

        // Parse light color for glow halo
        var r = parseInt(source.color.substr(1, 2), 16);
        var g = parseInt(source.color.substr(3, 2), 16);
        var b = parseInt(source.color.substr(5, 2), 16);

        // Calculate flicker alpha if source flickers
        var alpha = 1.0;
        if (source.flickerRate > 0) {
          var flicker = Math.sin(source.flickerPhase + frameCount * 0.1) * source.flickerRate;
          alpha = 1 + flicker;
          alpha = Math.max(0.5, Math.min(1.0, alpha)); // Clamp to prevent invisible or over-bright
        }

        // Apply configured opacity
        alpha *= (source.opacity || 1.0);

        // Draw colored glow halo around the emoji (subtle radial gradient)
        var glowRadius = this.cellSize * 0.8;
        var grad = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
        var glowAlpha = alpha * 0.4; // Subtle glow
        grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + glowAlpha + ')');
        grad.addColorStop(0.6, 'rgba(' + r + ',' + g + ',' + b + ',' + (glowAlpha * 0.3) + ')');
        grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');

        this.ctx.fillStyle = grad;
        this.ctx.fillRect(centerX - glowRadius, centerY - glowRadius, glowRadius * 2, glowRadius * 2);

        // Draw the emoji with flicker-synced alpha
        var oldAlpha = this.ctx.globalAlpha;
        this.ctx.globalAlpha = alpha;

        // Add a subtle glow effect on the emoji itself
        this.ctx.shadowColor = source.color;
        this.ctx.shadowBlur = 4;

        // Apply bulb special rendering (upside-down)
        if (source.isBulb) {
          this.ctx.save();
          this.ctx.translate(centerX, centerY);
          this.ctx.rotate(Math.PI); // 180 degrees
          this.ctx.fillStyle = '#FFFFFF'; // Emoji renders in white, glow provides color
          this.ctx.fillText(source.emoji, 0, 0);
          this.ctx.restore();
        } else {
          this.ctx.fillStyle = '#FFFFFF'; // Emoji renders in white, glow provides color
          this.ctx.fillText(source.emoji, centerX, centerY);
        }

        // Reset
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = oldAlpha;
      }
    }
  };

  /**
   * Render entities (enemies, NPCs, items, collectibles).
   * Non-enemy entities (items, currencies, collectibles) receive a
   * gentle twinkle/pulse via globalAlpha oscillation (Phase 3.2).
   * @param {Array} entities - Array of entity objects { x, y, char, color }
   */
  CanvasRenderer.prototype._renderEntities = function(entities) {
    if (!entities || entities.length === 0) return;

    for (var i = 0; i < entities.length; i++) {
      var entity = entities[i];
      if (!entity || entity.x === undefined || entity.y === undefined) continue;

      var centerX = (entity.x + 0.5) * this.cellSize;
      var centerY = (entity.y + 0.5) * this.cellSize;

      // Draw ground drop shadow beneath entity
      this._drawDropShadow(centerX, (entity.y + 0.78) * this.cellSize, this.cellSize * 0.32, this.cellSize * 0.11, 0.28);

      // Phase 3.2: twinkle pulse for ground items / collectibles (not enemies)
      var savedAlpha = this.ctx.globalAlpha;
      if (!entity.isEnemy) {
        var key = entity.x + ',' + entity.y;
        var phase = _twinklePhases[key] || 0;
        // Gentle oscillation: alpha between 0.78 and 1.0
        this.ctx.globalAlpha = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(phase));
      }

      // Render entity character/emoji
      this.ctx.fillStyle = entity.color || '#FF0000';

      // Add glow for enemies
      if (entity.isEnemy) {
        this.ctx.shadowColor = entity.color || '#FF0000';
        this.ctx.shadowBlur = 5;
      }

      this.ctx.fillText(entity.char || '?', centerX, centerY);

      // Reset shadow and alpha
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = savedAlpha;
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

    // Draw ground drop shadow beneath player
    this._drawDropShadow(centerX, (player.y + 0.78) * this.cellSize, this.cellSize * 0.36, this.cellSize * 0.13, 0.35);

    // Render player with distinctive glow
    this.ctx.fillStyle = player.color || '#00FF00';
    this.ctx.shadowColor = player.color || '#00FF00';
    this.ctx.shadowBlur = 8;

    this.ctx.fillText(player.char || '@', centerX, centerY);

    // Reset shadow
    this.ctx.shadowBlur = 0;
  };

  /**
   * Render the pancake (collectible) stack above the player.
   * Delegates to the PlayerStackManager singleton which manages
   * update + draw for the persistent emoji stack.
   * @param {Object} player - Player object { x, y }
   */
  CanvasRenderer.prototype._renderPancakeStack = function(player) {
    if (!player || player.x === undefined || player.y === undefined) return;
    if (typeof PlayerStackManager === 'undefined' || !PlayerStackManager.render) return;

    var now = Date.now();
    PlayerStackManager.update(now);

    // Player center in canvas pixel space
    var screenX = (player.x + 0.5) * this.cellSize;
    var screenY = (player.y + 0.5) * this.cellSize;

    PlayerStackManager.render(this.ctx, screenX, screenY, this.cellSize);
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

      // Draw ground drop shadow beneath pet (scaled by pet opacity)
      var shadowAlpha = 0.25 * (pet.opacity !== undefined ? pet.opacity : 1);
      this._drawDropShadow(centerX, (pet.y + 0.78) * this.cellSize, this.cellSize * 0.30, this.cellSize * 0.10, shadowAlpha);

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
   * Draw an elliptical drop shadow at a given ground position.
   * Used by entity, player, and pet renderers for a consistent fake-3D shadow.
   * @param {number} centerX - Horizontal center of shadow
   * @param {number} groundY - Vertical ground position (Y of shadow center)
   * @param {number} radiusX - Half-width of ellipse
   * @param {number} radiusY - Half-height of ellipse
   * @param {number} opacity - Shadow alpha (0–1)
   */
  CanvasRenderer.prototype._drawDropShadow = function(centerX, groundY, radiusX, radiusY, opacity) {
    if (opacity <= 0) return;
    this.ctx.save();
    this.ctx.globalAlpha = opacity;
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, groundY, radiusX, radiusY, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
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
