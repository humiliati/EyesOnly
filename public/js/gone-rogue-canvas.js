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

    // Store base font size for per-entity scaling (Phase 5)
    this._baseFontSize = fontSize;
    this._fontFamily = (this.renderMode === RENDER_MODE.ASCII) ? FONT_FAMILY : EMOJI_FONT_FAMILY;

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

    // Render entities WITHOUT shadows first (shadows will be drawn after lighting)
    this._renderEntities(renderData.entities, true);
    this._renderPets(renderData.pets, true);

    // Sprint trail renders BEHIND the player (so player overlaps trails)
    this._renderSprintTrails();

    this._renderPlayer(renderData.player, true);

    // Render pancake stack above player head (without shadow first)
    this._renderPancakeStack(renderData.player, true);

    // Integrate OverheadAnimator into effects array for canvas rendering
    // This ensures parity with mobile renderer (gone-rogue-mobile.js:828-868)
    var effects = renderData.effects || [];
    if (typeof OverheadAnimator !== 'undefined' && typeof OverheadAnimator.getAllAnimations === 'function') {
      try {
        var currentTime = Date.now();
        OverheadAnimator.update(currentTime);
        var animations = OverheadAnimator.getAllAnimations();

        for (var akey in animations) {
          var parts = akey.split(',');
          var ax = parseInt(parts[0]);
          var ay = parseInt(parts[1]);
          var anim = animations[akey];

          // Convert world coords to local grid coords (accounting for world origin)
          var localX = ax - this._worldOriginX;
          var localY = ay - this._worldOriginY;

          var list = Array.isArray(anim) ? anim : [anim];
          var stackCount = list.length;
          for (var li = 0; li < stackCount; li++) {
            var a1 = list[li];
            if (!a1) continue;

            var transform = (typeof OverheadAnimator.calculateAnimationTransform === 'function')
              ? OverheadAnimator.calculateAnimationTransform(a1, currentTime)
              : { x: 0, y: -12, opacity: 1, scale: 1 };

            // Convert pixel offset to cell offset
            var dyCells = (transform.y || 0) / this.cellSize;
            var dxCells = (transform.x || 0) / this.cellSize;

            effects.push({
              x: localX + dxCells,
              y: localY - 0.6 + dyCells, // Stack offset handled by calculateAnimationTransform
              char: a1.text || a1.emoji,
              color: a1.color || '#FFFFFF',
              glow: true,
              alpha: (transform.opacity !== undefined ? transform.opacity : 1)
            });
          }
        }
      } catch (e) {
        // Silently fail if OverheadAnimator has issues
      }
    }

    this._renderEffects(effects);

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

    // Render all shadows AFTER lighting/darkness passes so they remain visible
    // and properly darken the ground beneath entities regardless of lighting
    this._renderAllShadows(renderData.entities, renderData.pets, renderData.player);
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

    // Per-tile alpha (used by drifting smoke for fade-out)
    var hasTileAlpha = tile.alpha !== undefined && tile.alpha < 1;
    if (hasTileAlpha) {
      this.ctx.save();
      this.ctx.globalAlpha = tile.alpha;
    }

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

    // Restore alpha if we applied per-tile alpha
    if (hasTileAlpha) {
      this.ctx.restore();
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
          // Apply darkness overlay — 73% max with power curve for sharper light/dark boundary
          var alpha = Math.pow(darkness, 0.75) * 0.73;

          // Parse light color for tinting
          var r = parseInt(light.color.substr(1, 2), 16);
          var g = parseInt(light.color.substr(3, 2), 16);
          var b = parseInt(light.color.substr(5, 2), 16);

          // Create darkness with color tint from nearby light sources
          var tintFactor = 0.15; // 15% of light color mixed into darkness (was 10%)
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
          var alpha = light.intensity * 0.24;
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
   * Phase 5: Collectibles render with per-entity scale and vertical bob animation.
   *   - Resource symbols (currency, ammo, batteries, key ammo): 1.0x + bob
   *   - Emoji collectibles (items, keys, quest keys, food): 0.6x + bob
   *   - Cards on map: 1.1x + bob
   *   - Interactive items (buttons, levers, ropes, monitors): pulse animation
   *   - Enemies: no bob, glow effect
   * Bob uses sine wave with deterministic phase offset per tile position.
   * Pulse uses scale oscillation for interactive-only items.
   * @param {Array} entities - Array of entity objects { x, y, char, color, scale?, bobEnabled?, pulseEnabled?, collectibleType? }
   * @param {boolean} skipShadows - If true, skip drawing shadows (they'll be drawn later)
   */
  CanvasRenderer.prototype._renderEntities = function(entities, skipShadows) {
    if (!entities || entities.length === 0) return;

    var now = Date.now();
    var baseFontSize = this._baseFontSize || Math.floor(this.cellSize * 0.8);
    var fontFamily = this._fontFamily || EMOJI_FONT_FAMILY;
    var needFontReset = false;

    for (var i = 0; i < entities.length; i++) {
      var entity = entities[i];
      if (!entity || entity.x === undefined || entity.y === undefined) continue;

      var scale = entity.scale || 1.0;
      var centerX = (entity.x + 0.5) * this.cellSize;
      var centerY = (entity.y + 0.5) * this.cellSize;

      // Bob animation for collectibles (±2px, ~1.6s period, phase offset by position)
      var bobOffset = 0;
      if (entity.bobEnabled) {
        var phase = ((entity.x * 7 + entity.y * 13) % 100) * 0.1; // 0–10 radians spread
        bobOffset = Math.sin((now * 0.004) + phase) * 2; // ±2px amplitude
        centerY += bobOffset;
      }

      // Pulse animation for interactive items (grow/shrink scale, ~2s period)
      if (entity.pulseEnabled) {
        var pulsePhase = ((entity.x * 5 + entity.y * 11) % 100) * 0.1; // 0–10 radians spread
        var pulseAmount = Math.sin((now * 0.003) + pulsePhase) * 0.1; // ±10% scale
        scale *= (1.0 + pulseAmount); // Oscillate between 0.9x and 1.1x
      }

      // Draw ground drop shadow beneath entity (unless skipped)
      if (!skipShadows) {
        // Bob scales shadow: higher bob = smaller shadow (entity farther from ground)
        var shadowScale = entity.bobEnabled ? (1 - Math.abs(bobOffset) * 0.04) : 1;
        this._drawDropShadow(
          centerX,
          (entity.y + 0.78) * this.cellSize,
          this.cellSize * 0.32 * shadowScale,
          this.cellSize * 0.11 * shadowScale,
          0.28 * shadowScale
        );
      }

      // Apply per-entity font scale if different from base
      if (scale !== 1.0) {
        var scaledFontSize = Math.floor(baseFontSize * scale);
        this.ctx.font = scaledFontSize + 'px ' + fontFamily;
        needFontReset = true;
      } else if (needFontReset) {
        this.ctx.font = baseFontSize + 'px ' + fontFamily;
        needFontReset = false;
      }

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

    // Restore base font if last entity was scaled
    if (needFontReset) {
      this.ctx.font = baseFontSize + 'px ' + fontFamily;
    }
  };

  /**
   * Render sprint trail particles (((( behind the sprinting player.
   * SprintTrailSystem stores positions in world-space, but our canvas
   * context is camera-transformed to view-local space (world minus origin).
   * We render manually to apply the offset.
   */
  CanvasRenderer.prototype._renderSprintTrails = function() {
    if (typeof SprintTrailSystem === 'undefined') return;
    var trails = SprintTrailSystem._getTrails ? SprintTrailSystem._getTrails() : null;
    if (!trails || trails.length === 0) return;

    var now = performance.now() / 1000;
    var cs = this.cellSize;
    var oxW = this._worldOriginX || 0;
    var oyW = this._worldOriginY || 0;

    for (var i = 0; i < trails.length; i++) {
      var t = trails[i];
      var age = now - t.spawnTime;
      if (age >= t.lifespan) continue;
      var opacity = Math.max(0, 1 - (age / t.lifespan));

      // Convert world → view-local → pixel
      var px = (t.x - oxW + 0.5) * cs;
      var py = (t.y - oyW + 0.5) * cs;

      // Build trail text: "(" repeated by layer count
      var text = '';
      for (var j = 0; j < t.layer; j++) text += ')';

      this.ctx.save();
      this.ctx.globalAlpha = opacity;
      this.ctx.fillStyle = t.color || '#1cff9b';
      this.ctx.font = 'bold ' + (12 + (t.layer * 2)) + 'px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowColor = t.color || '#1cff9b';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(text, px, py);
      this.ctx.restore();
    }
  };

  /**
   * Render player
   * @param {Object} player - Player object { x, y, char, color }
   * @param {boolean} skipShadows - If true, skip drawing shadows (they'll be drawn later)
   */
  CanvasRenderer.prototype._renderPlayer = function(player, skipShadows) {
    if (!player || player.x === undefined || player.y === undefined) return;

    var centerX = (player.x + 0.5) * this.cellSize;
    var centerY = (player.y + 0.5) * this.cellSize;

    // Draw ground drop shadow beneath player (unless skipped)
    if (!skipShadows) {
      this._drawDropShadow(centerX, (player.y + 0.78) * this.cellSize, this.cellSize * 0.36, this.cellSize * 0.13, 0.35);
    }

    // Render player with distinctive glow
    this.ctx.fillStyle = player.color || '#00FF00';
    this.ctx.shadowColor = player.color || '#00FF00';
    this.ctx.shadowBlur = 8;

    this.ctx.fillText(player.char || '@', centerX, centerY);

    // Reset shadow
    this.ctx.shadowBlur = 0;

    // ── Orbiting weapon arrow ───────────────────────────────────────
    if (typeof PlayerWeaponArrow !== 'undefined') {
      PlayerWeaponArrow.render(this.ctx, centerX, centerY, this.cellSize);
    }
  };

  /**
   * Render the pancake (collectible) stack above the player.
   * Delegates to the PlayerStackManager singleton which manages
   * update + draw for the persistent emoji stack.
   * @param {Object} player - Player object { x, y }
   * @param {boolean} skipShadows - If true, skip drawing shadows (they'll be drawn later)
   */
  CanvasRenderer.prototype._renderPancakeStack = function(player, skipShadows) {
    if (!player || player.x === undefined || player.y === undefined) return;
    if (typeof PlayerStackManager === 'undefined' || !PlayerStackManager.render) return;

    var now = Date.now();
    PlayerStackManager.update(now);

    // Player center in canvas pixel space
    var screenX = (player.x + 0.5) * this.cellSize;
    var screenY = (player.y + 0.5) * this.cellSize;

    PlayerStackManager.render(this.ctx, screenX, screenY, this.cellSize, skipShadows);
  };

  /**
   * Render pets (follower companions)
   * @param {Array} pets - Array of pet objects { x, y, emoji, opacity, type }
   * @param {boolean} skipShadows - If true, skip drawing shadows (they'll be drawn later)
   */
  CanvasRenderer.prototype._renderPets = function(pets, skipShadows) {
    if (!pets || pets.length === 0) return;

    for (var i = 0; i < pets.length; i++) {
      var pet = pets[i];
      if (!pet || pet.x === undefined || pet.y === undefined) continue;

      var centerX = (pet.x + 0.5) * this.cellSize;
      var centerY = (pet.y + 0.5) * this.cellSize;

      // Draw ground drop shadow beneath pet (scaled by pet opacity) (unless skipped)
      if (!skipShadows) {
        var shadowAlpha = 0.25 * (pet.opacity !== undefined ? pet.opacity : 1);
        this._drawDropShadow(centerX, (pet.y + 0.78) * this.cellSize, this.cellSize * 0.30, this.cellSize * 0.10, shadowAlpha);
      }

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
   *
   * Universal shadow system for all game entities (player, enemies, NPCs, pets, collectibles).
   * Uses flat ellipse geometry (NOT canvas shadowBlur) for accurate ground-plane shadows
   * that create fake-3D/isometric visual depth. Compliant with Terraria lighting spec
   * (docs/TERRARIA_LIGHTING_TODO.md Phase 1.3, visual polish).
   *
   * Standard parameters by entity type:
   * - Player: groundY = (y + 0.78) * cellSize, radiusX = 0.36 * cellSize, radiusY = 0.13 * cellSize, opacity = 0.35
   * - Entities: groundY = (y + 0.78) * cellSize, radiusX = 0.32 * cellSize, radiusY = 0.11 * cellSize, opacity = 0.28
   * - Pets: groundY = (y + 0.78) * cellSize, radiusX = 0.30 * cellSize, radiusY = 0.10 * cellSize, opacity = 0.25 * pet.opacity
   * - Pancake stack: inline render at screenY + 0.28 * cellSize (= player.y + 0.78 total), radiusX = 0.38 * cellSize, radiusY = 0.13 * cellSize, opacity = 0.35 * fadeIn * fadeOut
   *
   * @param {number} centerX - Horizontal center of shadow in canvas pixel space
   * @param {number} groundY - Vertical ground position (Y of shadow center) in canvas pixel space
   * @param {number} radiusX - Half-width of ellipse in pixels
   * @param {number} radiusY - Half-height of ellipse in pixels (smaller than radiusX for perspective)
   * @param {number} opacity - Shadow alpha (0–1), modulates base shadow darkness
   */
  CanvasRenderer.prototype._drawDropShadow = function(centerX, groundY, radiusX, radiusY, opacity) {
    if (opacity <= 0) return;
    this.ctx.save();
    this.ctx.globalAlpha = opacity;
    this.ctx.shadowBlur = 0; // Critical: no blur for flat ground shadow (shadowBlur reserved for glow effects)
    this.ctx.fillStyle = 'rgba(0,0,0,0.55)'; // Semi-transparent black (base darkness before opacity multiplier)
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, groundY, radiusX, radiusY, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  };

  /**
   * Render all entity shadows AFTER lighting passes.
   * Shadows are drawn last so they remain visible on top of darkness overlays,
   * using multiply composite to darken the ground beneath entities.
   * This ensures shadows are always visible regardless of lighting conditions.
   *
   * @param {Array} entities - Array of entity objects
   * @param {Array} pets - Array of pet objects
   * @param {Object} player - Player object
   */
  CanvasRenderer.prototype._renderAllShadows = function(entities, pets, player) {
    // Use multiply composite so shadows darken what's beneath them
    var prevComp = this.ctx.globalCompositeOperation;
    this.ctx.globalCompositeOperation = 'multiply';

    // Draw entity shadows (Phase 5: bob-aware shadow scaling for collectibles)
    if (entities && entities.length > 0) {
      var now = Date.now();
      for (var i = 0; i < entities.length; i++) {
        var entity = entities[i];
        if (!entity || entity.x === undefined || entity.y === undefined) continue;
        var centerX = (entity.x + 0.5) * this.cellSize;
        var shadowScale = 1;
        if (entity.bobEnabled) {
          var phase = ((entity.x * 7 + entity.y * 13) % 100) * 0.1;
          var bobOffset = Math.sin((now * 0.004) + phase) * 2;
          shadowScale = 1 - Math.abs(bobOffset) * 0.04;
        }
        this._drawDropShadow(
          centerX,
          (entity.y + 0.78) * this.cellSize,
          this.cellSize * 0.32 * shadowScale,
          this.cellSize * 0.11 * shadowScale,
          0.28 * shadowScale
        );
      }
    }

    // Draw pet shadows
    if (pets && pets.length > 0) {
      for (var i = 0; i < pets.length; i++) {
        var pet = pets[i];
        if (!pet || pet.x === undefined || pet.y === undefined) continue;
        var centerX = (pet.x + 0.5) * this.cellSize;
        var shadowAlpha = 0.25 * (pet.opacity !== undefined ? pet.opacity : 1);
        this._drawDropShadow(centerX, (pet.y + 0.78) * this.cellSize, this.cellSize * 0.30, this.cellSize * 0.10, shadowAlpha);
      }
    }

    // Draw player shadow
    if (player && player.x !== undefined && player.y !== undefined) {
      var centerX = (player.x + 0.5) * this.cellSize;
      this._drawDropShadow(centerX, (player.y + 0.78) * this.cellSize, this.cellSize * 0.36, this.cellSize * 0.13, 0.35);
    }

    // Draw pancake stack shadow
    if (player && player.x !== undefined && player.y !== undefined) {
      if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.getStackCount && PlayerStackManager.getStackCount() > 0) {
        var screenX = (player.x + 0.5) * this.cellSize;
        var screenY = (player.y + 0.5) * this.cellSize;

        // Replicate pancake shadow logic
        var now = Date.now();
        var stack = PlayerStackManager.getStack();
        if (stack && stack.length > 0) {
          var newestAge = now - stack[stack.length - 1].collectedAt;
          var fadeIn = Math.min(1, newestAge / 300);
          var oldestAge = now - stack[0].collectedAt;
          var decayMs = 4000; // From PlayerStackManager._decayMs
          var fadeOut = Math.max(0, 1 - Math.max(0, oldestAge - (decayMs - 600)) / 600);
          var shadowOpacity = 0.35 * fadeIn * fadeOut;
          if (shadowOpacity > 0.005) {
            this._drawDropShadow(screenX, screenY + this.cellSize * 0.28, this.cellSize * 0.38, this.cellSize * 0.13, shadowOpacity);
          }
        }
      }
    }

    // Restore composite operation
    this.ctx.globalCompositeOperation = prevComp;
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
