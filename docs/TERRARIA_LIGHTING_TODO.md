# Terraria-Style Lighting & Paper Mario Mobile Enhancement TODO

> NOTE (2026-02-19): This document is now part of a unified movement+lighting plan.
> See: `docs/UNIFIED_MOVEMENT_LIGHTING_VISION.md` (canonical for lowest-impact free-move + occlusion).

## Vision Statement

Transform Gone Rogue's lighting system from simple 2D overlays into a Terraria-inspired volumetric lighting engine with true 3D collision detection, treating emoji tiles as opaque cubes in forced perspective. Add Paper Mario-style visual polish with emanating light orbs, item twinkle effects, and single-input mobile controls optimized for portrait-first high-fidelity movement.

## Current State (Baseline)

✅ **Canvas rendering system** implemented (Option C complete, 2026-02-19)
- CanvasRenderer class with single-pass rendering
- Basic lighting overlay with intensity-based darkening
- Light source glow effects with radial gradients
- Touch/click coordinate mapping
- 60fps target achieved (up from 10fps DOM rendering)

✅ **Lighting calculations** (lighting-system.js)
- Per-tile light intensity calculation
- Inverse square law falloff
- Biome-specific ambient lighting
- Directional lights (flashlight, enemy sight cones)
- Darkness-based stealth bonuses

⚠️ **Current Limitations:**
- **No 3D collision**: Light passes through walls (no occlusion)
- **No shadow casting**: Tiles don't block light properly
- **Flat rendering**: No depth perception or forced perspective
- **Simple overlays**: Darkness applied uniformly, no volumetric effects
- **Static lighting**: No dynamic light propagation animations

---

## Phase 1: 3D Tile Collision & Shadow Casting

### 1.1 Emoji Tiles as Opaque Cubes

**Goal**: Treat each emoji tile as a 3D cube that blocks light rays.

**Implementation:**

```javascript
// In lighting-system.js
var TILE_OPACITY = {
  WALL: 1.0,      // Fully opaque (blocks all light)
  FLOOR: 0.0,     // Transparent (light passes through)
  SHADOW: 0.3,    // Semi-transparent (reduces light)
  BREAKABLE: 0.7, // Mostly opaque
  SMOKE: 0.5      // Diffuses light
};

function getTileOpacity(tile) {
  if (!tile) return 0.0;

  if (tile.type === 'wall') return TILE_OPACITY.WALL;
  if (tile.type === 'shadow') return TILE_OPACITY.SHADOW;
  if (tile.isBreakable) return TILE_OPACITY.BREAKABLE;
  if (tile.hasSmoke) return TILE_OPACITY.SMOKE;

  return TILE_OPACITY.FLOOR;
}
```

**Files to modify:**
- `public/js/lighting-system.js` - Add tile opacity system
- `public/js/gone-rogue.js` - Pass tile type data to lighting system

**Acceptance Criteria:**
- [ ] Light rays stop at walls (full occlusion)
- [ ] Light is reduced by semi-transparent tiles
- [ ] Breakable objects cast shadows
- [ ] Smoke diffuses light realistically

---

### 1.2 Ray Casting with Tile Collision

**Goal**: Cast light rays from each source, checking tile collision at each step.

**Algorithm:**

```javascript
// Enhanced ray casting with 3D collision
function castLightRay(sourceX, sourceY, targetX, targetY, grid) {
  var dx = targetX - sourceX;
  var dy = targetY - sourceY;
  var distance = Math.sqrt(dx * dx + dy * dy);
  var steps = Math.ceil(distance * 2); // Fine-grained sampling

  var stepX = dx / steps;
  var stepY = dy / steps;

  var currentX = sourceX;
  var currentY = sourceY;
  var accumulatedOpacity = 0.0;

  for (var i = 0; i < steps; i++) {
    currentX += stepX;
    currentY += stepY;

    var gridX = Math.floor(currentX);
    var gridY = Math.floor(currentY);

    if (gridX < 0 || gridY < 0 || gridX >= grid[0].length || gridY >= grid.length) {
      return 0.0; // Out of bounds
    }

    var tile = grid[gridY][gridX];
    var opacity = getTileOpacity(tile);

    accumulatedOpacity += opacity;

    // Full occlusion - ray blocked
    if (accumulatedOpacity >= 1.0) {
      return 0.0;
    }
  }

  // Return remaining light intensity (1.0 - blocked amount)
  return Math.max(0, 1.0 - accumulatedOpacity);
}
```

**Performance Considerations:**
- Ray casting is O(n) per light per tile = O(lights × tiles × ray_length)
- Current system: 5-20 lights × 800 tiles = 4,000-16,000 rays per frame
- **Mitigation**: Spatial partitioning + distance culling + caching

**Optimization Strategy:**

```javascript
// Spatial Hash Grid for light sources
var LightSpatialHash = {
  cellSize: 8, // 8x8 grid cells
  grid: {},

  addLight: function(light) {
    var cellX = Math.floor(light.x / this.cellSize);
    var cellY = Math.floor(light.y / this.cellSize);
    var key = cellX + ',' + cellY;

    if (!this.grid[key]) this.grid[key] = [];
    this.grid[key].push(light);
  },

  getLightsNear: function(x, y, radius) {
    var minCellX = Math.floor((x - radius) / this.cellSize);
    var maxCellX = Math.floor((x + radius) / this.cellSize);
    var minCellY = Math.floor((y - radius) / this.cellSize);
    var maxCellY = Math.floor((y + radius) / this.cellSize);

    var lights = [];
    for (var cx = minCellX; cx <= maxCellX; cx++) {
      for (var cy = minCellY; cy <= maxCellY; cy++) {
        var key = cx + ',' + cy;
        if (this.grid[key]) {
          lights = lights.concat(this.grid[key]);
        }
      }
    }
    return lights;
  }
};
```

**Files to modify:**
- `public/js/lighting-system.js` - Enhanced ray casting algorithm
- `public/js/lighting-system.js` - Spatial hash implementation

**Acceptance Criteria:**
- [ ] Light rays properly stop at walls
- [ ] Semi-transparent tiles partially block light
- [ ] Performance maintains 60fps on mobile (< 2ms per frame for lighting)
- [ ] Spatial hash reduces ray cast count by 50%+

---

### 1.3 Shadow Casting Algorithm

**Goal**: Generate realistic shadows behind opaque tiles relative to light sources.

**Shadow Casting Strategy:**

```javascript
// Shadow polygon generation
function calculateShadowPolygon(tileX, tileY, lightX, lightY) {
  // Treat tile as cube in forced perspective
  var tileCorners = [
    { x: tileX, y: tileY },           // Top-left
    { x: tileX + 1, y: tileY },       // Top-right
    { x: tileX + 1, y: tileY + 1 },   // Bottom-right
    { x: tileX, y: tileY + 1 }        // Bottom-left
  ];

  // Find silhouette edges (edges facing away from light)
  var silhouetteEdges = [];
  for (var i = 0; i < tileCorners.length; i++) {
    var p1 = tileCorners[i];
    var p2 = tileCorners[(i + 1) % tileCorners.length];

    // Calculate edge normal
    var edgeX = p2.x - p1.x;
    var edgeY = p2.y - p1.y;
    var normalX = -edgeY;
    var normalY = edgeX;

    // Light direction to edge center
    var centerX = (p1.x + p2.x) / 2;
    var centerY = (p1.y + p2.y) / 2;
    var lightDirX = centerX - lightX;
    var lightDirY = centerY - lightY;

    // Dot product determines if edge faces light
    var dot = normalX * lightDirX + normalY * lightDirY;

    if (dot > 0) {
      silhouetteEdges.push({ p1: p1, p2: p2 });
    }
  }

  // Project silhouette edges to infinity (or max shadow distance)
  var shadowPolygon = [];
  var maxShadowDist = 20; // Shadow length in tiles

  silhouetteEdges.forEach(function(edge) {
    var dir1X = edge.p1.x - lightX;
    var dir1Y = edge.p1.y - lightY;
    var dir2X = edge.p2.x - lightX;
    var dir2Y = edge.p2.y - lightY;

    var len1 = Math.sqrt(dir1X * dir1X + dir1Y * dir1Y);
    var len2 = Math.sqrt(dir2X * dir2X + dir2Y * dir2Y);

    var proj1X = edge.p1.x + (dir1X / len1) * maxShadowDist;
    var proj1Y = edge.p1.y + (dir1Y / len1) * maxShadowDist;
    var proj2X = edge.p2.x + (dir2X / len2) * maxShadowDist;
    var proj2Y = edge.p2.y + (dir2Y / len2) * maxShadowDist;

    shadowPolygon.push({
      vertices: [edge.p1, edge.p2, { x: proj2X, y: proj2Y }, { x: proj1X, y: proj1Y }],
      opacity: 0.8
    });
  });

  return shadowPolygon;
}
```

**Canvas Rendering:**

```javascript
// In gone-rogue-canvas.js _renderLighting()
CanvasRenderer.prototype._renderShadows = function(grid, lights) {
  this.ctx.save();
  this.ctx.globalCompositeOperation = 'multiply';

  lights.forEach(function(light) {
    for (var y = 0; y < grid.length; y++) {
      for (var x = 0; x < grid[y].length; x++) {
        var tile = grid[y][x];
        if (getTileOpacity(tile) > 0.5) {
          var shadowPolygons = calculateShadowPolygon(x, y, light.x, light.y);

          shadowPolygons.forEach(function(shadow) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, ' + shadow.opacity + ')';
            this.ctx.beginPath();
            this.ctx.moveTo(
              shadow.vertices[0].x * this.cellSize,
              shadow.vertices[0].y * this.cellSize
            );
            for (var i = 1; i < shadow.vertices.length; i++) {
              this.ctx.lineTo(
                shadow.vertices[i].x * this.cellSize,
                shadow.vertices[i].y * this.cellSize
              );
            }
            this.ctx.closePath();
            this.ctx.fill();
          }.bind(this));
        }
      }
    }
  }.bind(this));

  this.ctx.restore();
};
```

**Files to modify:**
- `public/js/lighting-system.js` - Shadow polygon calculation
- `public/js/gone-rogue-canvas.js` - Shadow rendering

**Acceptance Criteria:**
- [ ] Walls cast shadows behind them
- [ ] Shadow length proportional to distance from light
- [ ] Multiple light sources create complex shadow patterns
- [ ] Shadow edges are smooth (no jagged artifacts)

---

## Phase 2: Forced Perspective & 3D Depth

### 2.1 Isometric Perspective Rendering

**Goal**: Render tiles with forced perspective to create 3D depth illusion.

**Perspective Transform:**

```javascript
// Convert grid coordinates to isometric screen coordinates
function gridToIsometric(gridX, gridY, tileHeight) {
  tileHeight = tileHeight || 0; // Z-height for stacking

  var isoX = (gridX - gridY) * (cellSize / 2);
  var isoY = (gridX + gridY) * (cellSize / 4) - tileHeight * (cellSize / 8);

  return { x: isoX, y: isoY };
}

// Reverse transform for click handling
function isometricToGrid(isoX, isoY) {
  var gridX = (isoX / (cellSize / 2) + isoY / (cellSize / 4)) / 2;
  var gridY = (isoY / (cellSize / 4) - isoX / (cellSize / 2)) / 2;

  return {
    x: Math.floor(gridX),
    y: Math.floor(gridY)
  };
}
```

**Tile Height System:**

```javascript
var TILE_HEIGHTS = {
  FLOOR: 0,
  ITEM: 0.3,      // Items hover slightly
  PLAYER: 1.0,    // Player at ground level
  BREAKABLE: 1.0, // Boxes/crates at ground
  WALL: 2.0       // Walls are taller
};
```

**Files to modify:**
- `public/js/gone-rogue-canvas.js` - Add isometric rendering mode
- `public/js/gone-rogue-canvas.js` - Update coordinate mapping

**Acceptance Criteria:**
- [ ] Tiles render with depth perception
- [ ] Objects appear to stack vertically
- [ ] Click handling works correctly in isometric view
- [ ] Smooth transition from top-down to isometric mode (optional toggle)

---

### 2.2 Depth Sorting & Occlusion

**Goal**: Render tiles in correct depth order so foreground tiles occlude background.

**Painter's Algorithm:**

```javascript
CanvasRenderer.prototype._renderWithDepthSorting = function(renderData) {
  // Collect all renderable objects with depth
  var renderQueue = [];

  // Add tiles
  for (var y = 0; y < renderData.grid.length; y++) {
    for (var x = 0; x < renderData.grid[y].length; x++) {
      var tile = renderData.grid[y][x];
      if (tile && tile.char) {
        renderQueue.push({
          type: 'tile',
          x: x, y: y,
          depth: x + y, // Sort key
          height: TILE_HEIGHTS[tile.type] || 0,
          data: tile
        });
      }
    }
  }

  // Add entities
  renderData.entities.forEach(function(entity) {
    renderQueue.push({
      type: 'entity',
      x: entity.x, y: entity.y,
      depth: entity.x + entity.y,
      height: TILE_HEIGHTS.PLAYER,
      data: entity
    });
  });

  // Add player
  if (renderData.player) {
    renderQueue.push({
      type: 'player',
      x: renderData.player.x, y: renderData.player.y,
      depth: renderData.player.x + renderData.player.y,
      height: TILE_HEIGHTS.PLAYER,
      data: renderData.player
    });
  }

  // Sort by depth (back to front)
  renderQueue.sort(function(a, b) {
    return a.depth - b.depth;
  });

  // Render in order
  renderQueue.forEach(function(item) {
    if (item.type === 'tile') {
      this._renderTileIsometric(item.x, item.y, item.data, item.height);
    } else if (item.type === 'entity') {
      this._renderEntityIsometric(item.x, item.y, item.data, item.height);
    } else if (item.type === 'player') {
      this._renderPlayerIsometric(item.x, item.y, item.data, item.height);
    }
  }.bind(this));
};
```

**Files to modify:**
- `public/js/gone-rogue-canvas.js` - Depth sorting system

**Acceptance Criteria:**
- [ ] Objects render in correct depth order
- [ ] Foreground objects properly occlude background
- [ ] No z-fighting or flickering
- [ ] Performance remains 60fps with sorting overhead

---

## Phase 3: Emanating Light Orbs & Visual Polish

### 3.1 Dynamic Light Orb Effects

**Goal**: Create pulsing, glowing light orbs that emanate from light sources.

**Multi-Layer Glow System:**

```javascript
CanvasRenderer.prototype._renderLightOrb = function(x, y, light, time) {
  var centerX = (x + 0.5) * this.cellSize;
  var centerY = (y + 0.5) * this.cellSize;

  // Parse light color
  var r = parseInt(light.color.substr(1, 2), 16);
  var g = parseInt(light.color.substr(3, 2), 16);
  var b = parseInt(light.color.substr(5, 2), 16);

  // Pulsing animation
  var pulse = 0.8 + 0.2 * Math.sin(time * 0.003 + x * 0.5 + y * 0.3);

  // Render multiple concentric glows
  var glowLayers = [
    { radius: light.radius * 0.3 * pulse, alpha: 0.9 },
    { radius: light.radius * 0.6 * pulse, alpha: 0.5 },
    { radius: light.radius * 1.0 * pulse, alpha: 0.2 },
    { radius: light.radius * 1.5 * pulse, alpha: 0.1 }
  ];

  glowLayers.forEach(function(layer) {
    var gradient = this.ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, layer.radius * this.cellSize
    );

    gradient.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + layer.alpha + ')');
    gradient.addColorStop(0.7, 'rgba(' + r + ',' + g + ',' + b + ',' + (layer.alpha * 0.3) + ')');
    gradient.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      centerX - layer.radius * this.cellSize,
      centerY - layer.radius * this.cellSize,
      layer.radius * 2 * this.cellSize,
      layer.radius * 2 * this.cellSize
    );
  }.bind(this));

  // Core bright spot
  this.ctx.save();
  this.ctx.globalCompositeOperation = 'lighter'; // Additive blending
  this.ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ', 0.8)';
  this.ctx.beginPath();
  this.ctx.arc(centerX, centerY, this.cellSize * 0.15 * pulse, 0, Math.PI * 2);
  this.ctx.fill();
  this.ctx.restore();
};
```

**Occlusion by Tiles:**

```javascript
// Only render orb if not occluded by opaque tiles
CanvasRenderer.prototype._shouldRenderLightOrb = function(lightX, lightY, viewerX, viewerY, grid) {
  // Simple LOS check - enhance with ray casting from Phase 1
  var dx = viewerX - lightX;
  var dy = viewerY - lightY;
  var distance = Math.sqrt(dx * dx + dy * dy);
  var steps = Math.ceil(distance);

  for (var i = 0; i < steps; i++) {
    var checkX = Math.floor(lightX + (dx / distance) * i);
    var checkY = Math.floor(lightY + (dy / distance) * i);

    var tile = grid[checkY] && grid[checkY][checkX];
    if (tile && getTileOpacity(tile) >= 1.0) {
      return false; // Occluded
    }
  }

  return true; // Visible
};
```

**Files to modify:**
- `public/js/gone-rogue-canvas.js` - Light orb rendering

**Acceptance Criteria:**
- [ ] Light orbs pulse smoothly over time
- [ ] Multiple glow layers create depth
- [ ] Orbs are occluded by walls
- [ ] Additive blending makes overlapping lights brighter
- [ ] Performance: < 1ms per orb rendering

---

### 3.2 Item Twinkle Effect System

**Goal**: Add sparkle/twinkle effects to items for visual appeal and item discovery.

**Twinkle Animation:**

```javascript
// Item twinkle state
var ItemTwinkles = {
  items: {}, // itemId -> { phase, lastTwinkle, intensity }

  update: function(deltaTime) {
    Object.keys(this.items).forEach(function(id) {
      var twinkle = this.items[id];
      twinkle.phase += deltaTime * 0.002; // Slow phase progression

      // Random sparkle triggers
      if (Math.random() < 0.01) {
        twinkle.lastTwinkle = Date.now();
        twinkle.intensity = 1.0;
      } else {
        twinkle.intensity *= 0.95; // Decay
      }
    }.bind(this));
  },

  registerItem: function(itemId, x, y, rarity) {
    this.items[itemId] = {
      x: x, y: y,
      phase: Math.random() * Math.PI * 2,
      lastTwinkle: 0,
      intensity: 0,
      rarity: rarity // affects twinkle frequency
    };
  },

  getTwinkleIntensity: function(itemId) {
    var item = this.items[itemId];
    if (!item) return 0;

    // Base brightness oscillation
    var base = 0.7 + 0.3 * Math.sin(item.phase);

    // Add sparkle spike
    var timeSinceTwinkle = Date.now() - item.lastTwinkle;
    var sparkle = timeSinceTwinkle < 300 ? item.intensity : 0;

    return Math.min(1.0, base + sparkle * 0.5);
  }
};
```

**Canvas Rendering:**

```javascript
CanvasRenderer.prototype._renderItemWithTwinkle = function(item, itemId) {
  var intensity = ItemTwinkles.getTwinkleIntensity(itemId);

  // Base item rendering
  var centerX = (item.x + 0.5) * this.cellSize;
  var centerY = (item.y + 0.5) * this.cellSize;

  // Brightness filter
  this.ctx.save();
  this.ctx.filter = 'brightness(' + (0.7 + intensity * 0.6) + ')';
  this.ctx.fillStyle = item.color || '#FFD700';
  this.ctx.fillText(item.char || '💎', centerX, centerY);
  this.ctx.restore();

  // Sparkle particles
  if (intensity > 0.8) {
    this._renderSparkleParticles(item.x, item.y, intensity);
  }
};

CanvasRenderer.prototype._renderSparkleParticles = function(x, y, intensity) {
  var centerX = (x + 0.5) * this.cellSize;
  var centerY = (y + 0.5) * this.cellSize;

  // 4 sparkles around item
  for (var i = 0; i < 4; i++) {
    var angle = (i / 4) * Math.PI * 2;
    var distance = this.cellSize * 0.4;
    var px = centerX + Math.cos(angle) * distance;
    var py = centerY + Math.sin(angle) * distance;

    this.ctx.save();
    this.ctx.globalAlpha = intensity * 0.8;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillText('✨', px, py);
    this.ctx.restore();
  }
};
```

**Rarity-Based Twinkle Rates:**

```javascript
var TWINKLE_RATES = {
  COMMON: 0.005,      // Rare sparkles
  UNCOMMON: 0.01,     // Occasional sparkles
  RARE: 0.02,         // Frequent sparkles
  LEGENDARY: 0.05     // Constant sparkles
};
```

**Files to modify:**
- `public/js/gone-rogue-canvas.js` - Twinkle rendering
- `public/js/card-system.js` or item system - Register items with twinkle system

**Acceptance Criteria:**
- [ ] Items pulse with subtle brightness oscillation
- [ ] Random sparkle bursts occur at rarity-based frequency
- [ ] Sparkle particles rotate around item
- [ ] Legendary items sparkle almost constantly
- [ ] Performance: < 0.5ms per item with twinkle

---

### 3.3 Brightness Ramp-Up Animation (Baked Lighting Cheat)

**Goal**: When entering a lit area, smoothly ramp up brightness to avoid jarring transitions.

**Lighting Interpolation:**

```javascript
// Track previous and target lighting states
var LightingInterpolator = {
  previousLightMap: {},
  targetLightMap: {},
  interpolationProgress: 1.0,
  interpolationSpeed: 0.05, // 20 frames to full brightness

  setTarget: function(newLightMap) {
    this.previousLightMap = JSON.parse(JSON.stringify(this.targetLightMap));
    this.targetLightMap = newLightMap;
    this.interpolationProgress = 0.0;
  },

  update: function() {
    if (this.interpolationProgress < 1.0) {
      this.interpolationProgress += this.interpolationSpeed;
      this.interpolationProgress = Math.min(1.0, this.interpolationProgress);
    }
  },

  getLightAt: function(x, y) {
    var key = x + ',' + y;
    var prev = this.previousLightMap[key] || { intensity: 0, color: '#000000' };
    var target = this.targetLightMap[key] || { intensity: 0, color: '#000000' };

    // Lerp intensity
    var intensity = prev.intensity + (target.intensity - prev.intensity) * this.interpolationProgress;

    // Color remains target (color interpolation is complex)
    return {
      intensity: intensity,
      color: target.color
    };
  }
};
```

**Integration:**

```javascript
// In lighting-system.js updateLightMap()
LightingSystem.updateLightMap = function(width, height, walls) {
  var newLightMap = {};

  // Calculate lighting...
  // (existing logic)

  // Set as interpolation target
  LightingInterpolator.setTarget(newLightMap);
};

// In render loop
function renderFrame() {
  LightingInterpolator.update();

  // Use interpolated lighting instead of instant
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var light = LightingInterpolator.getLightAt(x, y);
      // Apply to rendering...
    }
  }
}
```

**Files to modify:**
- `public/js/lighting-system.js` - Add interpolator
- `public/js/gone-rogue-canvas.js` - Use interpolated values

**Acceptance Criteria:**
- [ ] Lighting changes smoothly over ~20 frames
- [ ] No jarring brightness jumps when moving
- [ ] Works with dynamic light sources (player, enemies)
- [ ] Performance: negligible overhead (< 0.1ms)

---

## Phase 4: Paper Mario Mobile Controls

### 4.1 Single-Input Control Scheme

**Goal**: Simplify controls to single tap/hold for mobile portrait play.

**Control Mapping:**

```
Single Tap:         Move to tile (pathfinding)
Tap & Hold (0.5s):  Interact with object/enemy
Double Tap:         Run mode toggle
Swipe:              Quick card selection (out of combat)
```

**Implementation:**

```javascript
var MobileControls = {
  touchStartTime: 0,
  touchStartPos: { x: 0, y: 0 },
  isHolding: false,
  holdThreshold: 500, // ms

  onTouchStart: function(e) {
    this.touchStartTime = Date.now();
    this.touchStartPos = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };

    // Start hold timer
    setTimeout(function() {
      if (this.touchStartTime > 0) {
        this.isHolding = true;
        this.onHold(this.touchStartPos);
      }
    }.bind(this), this.holdThreshold);
  },

  onTouchEnd: function(e) {
    var holdDuration = Date.now() - this.touchStartTime;
    var endPos = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    var dx = endPos.x - this.touchStartPos.x;
    var dy = endPos.y - this.touchStartPos.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (!this.isHolding && distance < 10) {
      // Tap
      this.onTap(endPos);
    } else if (distance > 50) {
      // Swipe
      var angle = Math.atan2(dy, dx);
      this.onSwipe(angle);
    }

    this.touchStartTime = 0;
    this.isHolding = false;
  },

  onTap: function(pos) {
    // Convert to grid coords and move
    var gridCoords = renderer.canvasToGrid(pos.x, pos.y);
    Game.movePlayerTo(gridCoords.x, gridCoords.y);
  },

  onHold: function(pos) {
    // Show interaction menu
    var gridCoords = renderer.canvasToGrid(pos.x, pos.y);
    Game.showInteractionMenu(gridCoords.x, gridCoords.y);
  },

  onSwipe: function(angle) {
    // Quick card selection
    CardSystem.showQuickSelect(angle);
  }
};
```

**Files to modify:**
- `public/js/gone-rogue-mobile.js` - Unified control system

**Acceptance Criteria:**
- [ ] Single tap moves player (A* pathfinding)
- [ ] Hold shows interaction menu
- [ ] Swipe opens card selection
- [ ] All controls work smoothly in portrait orientation
- [ ] No accidental inputs (proper thresholds)

---

### 4.2 High-Fidelity Movement System

**Goal**: Smooth 60fps player movement with interpolation between grid cells.

**Movement Interpolation:**

```javascript
var PlayerMovement = {
  currentPos: { x: 10, y: 10 },      // Visual position (float)
  targetPos: { x: 10, y: 10 },       // Target grid cell (int)
  moveSpeed: 0.15,                    // Cells per frame (9 frames to move 1 cell)

  setTarget: function(gridX, gridY) {
    this.targetPos = { x: gridX, y: gridY };
  },

  update: function() {
    var dx = this.targetPos.x - this.currentPos.x;
    var dy = this.targetPos.y - this.currentPos.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0.01) {
      // Move towards target
      var moveX = (dx / distance) * this.moveSpeed;
      var moveY = (dy / distance) * this.moveSpeed;

      this.currentPos.x += moveX;
      this.currentPos.y += moveY;

      // Snap to target if close enough
      if (distance < this.moveSpeed) {
        this.currentPos.x = this.targetPos.x;
        this.currentPos.y = this.targetPos.y;
      }
    }
  },

  getVisualPosition: function() {
    return this.currentPos;
  }
};
```

**Render with Interpolation:**

```javascript
// In renderFrame()
PlayerMovement.update();
var visualPos = PlayerMovement.getVisualPosition();

renderer.renderGrid({
  // ... other data
  player: {
    x: visualPos.x, // Float coordinates for smooth movement
    y: visualPos.y,
    char: '🥷',
    color: '#00FF00'
  }
});
```

**A* Pathfinding for Tap-to-Move:**

```javascript
function findPath(startX, startY, endX, endY, grid) {
  // A* implementation
  var openSet = [{ x: startX, y: startY, g: 0, h: heuristic(startX, startY, endX, endY), parent: null }];
  var closedSet = {};

  while (openSet.length > 0) {
    // Sort by f = g + h
    openSet.sort(function(a, b) {
      return (a.g + a.h) - (b.g + b.h);
    });

    var current = openSet.shift();
    var key = current.x + ',' + current.y;

    if (current.x === endX && current.y === endY) {
      // Reconstruct path
      var path = [];
      while (current) {
        path.unshift({ x: current.x, y: current.y });
        current = current.parent;
      }
      return path;
    }

    closedSet[key] = true;

    // Check neighbors
    var neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];

    neighbors.forEach(function(neighbor) {
      var nKey = neighbor.x + ',' + neighbor.y;
      if (closedSet[nKey]) return;

      var tile = grid[neighbor.y] && grid[neighbor.y][neighbor.x];
      if (!tile || tile.type === 'wall') return; // Unwalkable

      var g = current.g + 1;
      var h = heuristic(neighbor.x, neighbor.y, endX, endY);

      var existing = openSet.find(function(n) {
        return n.x === neighbor.x && n.y === neighbor.y;
      });

      if (!existing) {
        openSet.push({
          x: neighbor.x, y: neighbor.y,
          g: g, h: h,
          parent: current
        });
      } else if (g < existing.g) {
        existing.g = g;
        existing.parent = current;
      }
    });
  }

  return null; // No path found
}

function heuristic(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2); // Manhattan distance
}
```

**Files to modify:**
- `public/js/gone-rogue-mobile.js` - Movement interpolation
- `public/js/gone-rogue.js` - Pathfinding system

**Acceptance Criteria:**
- [ ] Player moves smoothly between grid cells (60fps)
- [ ] Tap any reachable tile to pathfind
- [ ] Diagonal movement feels natural
- [ ] Movement animation completes in ~150ms per tile
- [ ] Works flawlessly in portrait orientation

---

## Phase 5: Performance Optimization & Polish

### 5.1 Lighting Calculation Caching

**Goal**: Reduce redundant lighting calculations.

**Strategies:**

```javascript
// Cache unchanged tiles
var LightingCache = {
  tileCache: {}, // tileKey -> lightIntensity
  lightPositions: {}, // lightId -> { x, y }

  invalidateTile: function(x, y) {
    delete this.tileCache[x + ',' + y];
  },

  invalidateLight: function(lightId) {
    var oldPos = this.lightPositions[lightId];
    if (oldPos) {
      // Invalidate all tiles in radius
      for (var dy = -light.radius; dy <= light.radius; dy++) {
        for (var dx = -light.radius; dx <= light.radius; dx++) {
          this.invalidateTile(oldPos.x + dx, oldPos.y + dy);
        }
      }
    }
  },

  getCachedLight: function(x, y) {
    return this.tileCache[x + ',' + y];
  },

  setCachedLight: function(x, y, intensity) {
    this.tileCache[x + ',' + y] = intensity;
  }
};
```

**Files to modify:**
- `public/js/lighting-system.js` - Add caching layer

**Acceptance Criteria:**
- [ ] Static lights don't recalculate every frame
- [ ] Only tiles affected by moving lights update
- [ ] Cache invalidation is correct (no stale data)
- [ ] Performance: 50% reduction in lighting calculations

---

### 5.2 Mobile Battery Optimization

**Goal**: Minimize battery drain on mobile devices.

**Techniques:**

```javascript
// Dynamic frame rate based on activity
var FrameRateController = {
  targetFPS: 60,
  idleThreshold: 1000, // ms without input
  lastInputTime: Date.now(),

  updateActivity: function() {
    this.lastInputTime = Date.now();
  },

  getTargetFPS: function() {
    var timeSinceInput = Date.now() - this.lastInputTime;

    if (timeSinceInput > this.idleThreshold) {
      return 30; // Lower FPS when idle
    } else {
      return 60; // Full FPS during action
    }
  }
};

// Render loop with adaptive FPS
var lastFrameTime = 0;
function renderLoop(currentTime) {
  var targetFPS = FrameRateController.getTargetFPS();
  var frameInterval = 1000 / targetFPS;

  if (currentTime - lastFrameTime >= frameInterval) {
    render();
    lastFrameTime = currentTime;
  }

  requestAnimationFrame(renderLoop);
}
```

**Files to modify:**
- `public/js/gone-rogue.js` - Adaptive frame rate

**Acceptance Criteria:**
- [ ] FPS drops to 30 when idle (> 1s without input)
- [ ] FPS ramps up to 60 during action
- [ ] Battery life improved by 20-30%
- [ ] No perceived lag when resuming action

---

## Implementation Priority & Timeline

### Sprint 1 (Week 1): Foundation
- [ ] Phase 1.1: Tile opacity system
- [ ] Phase 1.2: Ray casting with collision
- [ ] Test page for collision visualization

### Sprint 2 (Week 2): Shadows & Depth
- [ ] Phase 1.3: Shadow casting
- [ ] Phase 2.1: Isometric perspective (optional)
- [ ] Phase 2.2: Depth sorting

### Sprint 3 (Week 3): Visual Polish
- [ ] Phase 3.1: Emanating light orbs
- [ ] Phase 3.2: Item twinkle effects
- [ ] Phase 3.3: Brightness interpolation

### Sprint 4 (Week 4): Mobile Controls
- [ ] Phase 4.1: Single-input controls
- [ ] Phase 4.2: High-fidelity movement
- [ ] A* pathfinding

### Sprint 5 (Week 5): Optimization
- [ ] Phase 5.1: Lighting caching
- [ ] Phase 5.2: Battery optimization
- [ ] Performance profiling
- [ ] Final polish

---

## Testing Strategy

### Visual Tests
- [ ] Create `/tests/test-terraria-lighting.html`
- [ ] Light occlusion test scene (maze with lights)
- [ ] Shadow casting visualization
- [ ] Twinkle effect showcase
- [ ] Movement interpolation demo

### Performance Tests
- [ ] Benchmark lighting calculations (target: < 2ms per frame)
- [ ] FPS monitoring with 20+ light sources
- [ ] Mobile device testing (iOS Safari, Chrome Android)
- [ ] Battery drain measurement

### Gameplay Tests
- [ ] Stealth mechanics still work with new lighting
- [ ] Touch controls feel responsive
- [ ] No rendering glitches in corners/edges
- [ ] Pathfinding handles obstacles correctly

---

## Risk Mitigation

### Technical Risks

1. **Performance degradation from complex lighting**
   - Mitigation: Spatial partitioning, caching, distance culling
   - Fallback: Feature flag to disable advanced lighting

2. **Shadow casting artifacts**
   - Mitigation: Smooth shadow edges, anti-aliasing
   - Fallback: Simplified shadow system (blob shadows)

3. **Mobile compatibility issues**
   - Mitigation: Test on real devices early
   - Fallback: Detect device and reduce quality on low-end

4. **Battery drain concerns**
   - Mitigation: Adaptive frame rate, efficient rendering
   - Fallback: User toggle for "battery saver mode"

---

## Success Metrics

### Performance Targets
- ✅ 60fps on desktop (baseline already achieved)
- 🎯 60fps on mid-tier mobile (iPhone 11, Galaxy S10)
- 🎯 30fps on low-end mobile (graceful degradation)
- 🎯 < 2ms per frame for lighting calculations
- 🎯 < 20% battery drain increase vs current system

### Visual Quality Goals
- 🎯 Realistic shadows behind walls
- 🎯 Light properly blocked by opaque tiles
- 🎯 Smooth movement (no jitter or teleporting)
- 🎯 Eye-catching item twinkles
- 🎯 Atmospheric light orb effects

### UX Improvements
- 🎯 Single-tap movement feels intuitive
- 🎯 Portrait mode is primary experience
- 🎯 No accidental inputs on mobile
- 🎯 Game feels "Paper Mario-esque" in visual polish

---

## References & Inspiration

### Terraria Lighting System
- Light color blending (colored torches)
- Liquid light propagation (lava glow)
- Sky light vs artificial light
- Smooth lighting interpolation

### Paper Mario Visual Style
- Forced perspective billboarding
- Flat characters in 3D space
- Exaggerated shadow casting
- Item collection sparkles

### Technical Resources
- [Canvas API Performance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [A* Pathfinding Algorithm](https://en.wikipedia.org/wiki/A*_search_algorithm)
- [Shadow Mapping Techniques](https://en.wikipedia.org/wiki/Shadow_mapping)
- [Mobile Touch Event Handling](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)

---

## Changelog

### 2026-02-19
- ✅ Initial TODO created
- ✅ README.txt updated with canvas helper hooks documentation
- 🔄 Planning phase complete, ready for implementation

---

**Last Updated**: 2026-02-19
**Status**: Planning Complete - Ready for Sprint 1
**Estimated Total Effort**: 5 weeks (1 developer, full-time)
