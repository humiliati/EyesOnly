# Paper Terraria — Perspective, Viewport & Lighting Analysis

> **Created:** 2026-03-08
> **Purpose:** Identify legacy constraints, viewport problems, and lighting overlay concerns before implementing Paper Mario perspective skew.

---

## 1. The Rhombus Problem: Why 40×20 + Dramatic Skew = Dead Space

### Current State

The game renders a **40×20 tile grid** at **20px/cell** = **800×400px canvas**. The entire map is visible at once. Camera follow (`_applyMobileCanvasFollow`) pans and zooms the *CSS transform* on this canvas, but the canvas itself always contains the full 40×20 world.

### What Paper Mario Perspective Does

The PAPER_TERRARIA_TODO proposes Y-based scaling: row 0 (north/far) = **0.6x**, row 19 (south/near) = **1.4x**. This creates a trapezoid ground plane:

```
Row 0 (far):   40 tiles × 12px = 480px effective width  ← compressed
Row 10 (mid):  40 tiles × 20px = 800px effective width  ← normal
Row 19 (near): 40 tiles × 28px = 1120px effective width ← expanded

Vertical: rows compressed at top, stretched at bottom
Total projected height ≈ 380px (not 400px — top rows lose height)
```

Visualized in the viewport:

```
┌──────────────────────────────────────────────┐
│                  SKY / DEAD SPACE             │
│                                               │
│          ┌─────────────────────┐              │
│         ╱   Row 0 (12px tiles)  ╲             │  ← tiny, compressed
│        ╱     Row 1               ╲            │
│       ╱       Row 2               ╲           │
│      ╱         ...                  ╲         │
│     ╱          Row 10 (20px tiles)   ╲        │  ← normal
│    ╱            ...                    ╲      │
│   ╱              Row 15                 ╲     │
│  ╱                Row 18                 ╲    │
│ ╱                  Row 19 (28px tiles)    ╲   │  ← large
│╱─────────────────────────────────────────────╲│
│              GROUND / DEAD SPACE              │
└──────────────────────────────────────────────┘
```

The playable area is a **flat trapezoid/rhombus** in the center. The top half is so compressed the tiles are barely legible. The sides are dead wedges. On a 600px-wide container, the bottom row *overflows* while the top row only fills ~60% of the width.

### Why This Happens

Paper Mario solves this by showing **a small window onto a much larger map**. The camera follows the player and only renders ~15-20 tiles of width and ~10-12 tiles of depth at any time. The perspective is applied to this *viewport window*, not the entire world. The far rows are compressed, but there are always more rows beyond the horizon that scroll into view as you move north.

With a fixed 40×20 grid and no map larger than the viewport, you see *everything* at once — including the ugly compression at the edges.

### The Fix Options

| Option | Map Size | Camera | Perspective Feel | Effort |
|--------|----------|--------|-----------------|--------|
| **A: Larger maps + camera viewport** | 80×60+ | Track player, show ~25×18 tile window | Authentic Paper Mario | High — all generators change |
| **B: Moderate skew (0.85→1.15)** | 40×20 | Existing CSS camera | Subtle depth hint | Low — but doesn't look "Paper Mario" |
| **C: Hybrid — expand grid to 60×30, moderate skew 0.7→1.3** | 60×30 | Canvas-level camera with perspective-aware projection | Good compromise | Medium |

**Recommendation:** Option C. Expand the grid enough that the camera always has margin, use a moderate-but-visible skew, and let the camera viewport be the frame that fills the screen.

---

## 2. Legacy Constraints That Need Changing

### ⚠️ GRID_WIDTH / GRID_HEIGHT (gone-rogue.js:14-15)

```javascript
var GRID_WIDTH = 40;   // ← CHANGE: needs to be dynamic or larger (60+)
var GRID_HEIGHT = 20;  // ← CHANGE: needs to be dynamic or larger (30+)
```

**Why it exists:** Sized so entire map fits on screen without scrolling.
**What changes:** With camera tracking + perspective, the viewport shows a *subset* of the map. Grid can be larger.
**Impact:** Every system that references GRID_WIDTH/GRID_HEIGHT: floor generators, lighting spatial hash, boundary clamping, spawn/exit positioning.

### ⚠️ Canvas Size (gone-rogue-canvas.js:33-35)

```javascript
this.canvas.width = this.width * this.cellSize;    // 800px ← CHANGE
this.canvas.height = this.height * this.cellSize;  // 400px ← CHANGE
```

**Why it exists:** Canvas sized to exactly contain the flat grid.
**What changes:** With perspective, the canvas needs to be sized for the *viewport window* (what the camera shows), not the entire world. Or, render to an offscreen canvas and project to the viewport.

### ⚠️ Floor Generator Room Placement (floor-generator.js)

All procedural room generation assumes bounds of `[1, GRID_WIDTH-2]` × `[1, GRID_HEIGHT-2]`. Tutorial floors (0-3) have hardcoded room layouts within 40×20.

**What changes:** Room generation needs parameterized bounds. Tutorial floors need redesign or scaling.

### ⚠️ Player Spawn / Exit Position (gone-rogue.js)

```javascript
player spawn: x: 5, y: 10              // ← center of 40×20
exit: GRID_WIDTH - 3, GRID_HEIGHT - 3  // ← bottom-right corner of 40×20
```

**What changes:** These need to be relative to grid dimensions, not hardcoded to 40×20 assumptions.

### ⚠️ Boundary Clamping (gone-rogue.js + movement)

```javascript
Math.max(1, Math.min(GRID_WIDTH - 2, x))  // ← assumes 40×20
```

**What changes:** Already uses GRID_WIDTH/GRID_HEIGHT variables, so just changing the constants *should* work. But verify no hardcoded `38`, `18`, `39`, `19` appear anywhere.

### ⚠️ Lighting Spatial Hash Cell Size (lighting-system.js)

```javascript
cellSize: 8  // divides 40 evenly (5 cells). May not divide new dimensions evenly.
```

**What changes:** Should be fine for any grid size, but verify performance with larger grids.

### ⚠️ Tap-to-Move Radius (gone-rogue-mobile.js:15)

```javascript
var TAP_TO_MOVE_MAX_RADIUS = 12;  // tiles from player
```

**What changes:** On a larger grid, this radius may need adjustment. Currently limits pathfinding to 12 tiles — fine for 40×20 but restrictive on 80×60.

### ⚠️ Camera Pan Clamping (gone-rogue-mobile.js:1190-1202)

```javascript
var minTx = (contRect.width / z) - canvasW;
var minTy = (contRect.height / z) - canvasH;
tx = Math.max(minTx, Math.min(0, tx));
ty = Math.max(minTy, Math.min(0, ty));
```

**What changes:** This clamps the camera to never show beyond map edges. Works with any canvas size, but needs perspective-awareness — the "edge" in perspective space isn't a straight line.

---

## 3. Viewport CSS: Desktop vs Mobile

### The Problem

On desktop, the game viewport is constrained by multiple CSS rules that were designed to keep it mobile-portrait-safe:

| Rule | File | Line(s) | Current Value | Problem |
|------|------|---------|---------------|---------|
| `.rogue-grid-mobile max-width` | gone-rogue-mobile.css | 12-33 | `min(600px, 100vw)` | **600px cap on desktop** — this is the main bottleneck |
| `#monitor-body grid-template-columns` | crt.css | 216-222 | `minmax(86px, 18vw) 1fr` | Left sidebar eats ~346px on 1920px screen |
| `#terminal min-height` | crt.css | 1341-1356 | `260px` | May be too small for perspective view |
| `#terminal padding` | crt.css | 1341-1356 | `clamp(12px, 2vw, 22px)` | Eats space around game canvas |
| Desktop zoom | gone-rogue-mobile.js | 1163 | `z = 1.2` | Low zoom + 600px container = small viewport |
| Mobile portrait zoom | gone-rogue-mobile.js | 1168 | `z = 1.5` | Adequate for portrait |
| Max zoom cap | gone-rogue-mobile.js | 1188 | `z = 3.0` | Safety cap is fine |
| Desktop canvas containment | crt.css | 2809-2881 | `width: fit-content; max-width: 100%` | Canvas fits content, not container |

### What Needs to Change

**For desktop with perspective rendering active:**

1. **`.rogue-grid-mobile`** — Remove or raise the 600px cap. Use `max-width: 100%` when perspective mode is active. Could be done via a CSS class: `body.perspective-active .rogue-grid-mobile { max-width: 100%; }`

2. **Canvas sizing** — The canvas should fill the available container width and compute its height from the perspective projection. Instead of `width * cellSize`, use `containerWidth` and derive cell size from that.

3. **Desktop zoom** — The base `z = 1.2` was chosen when the canvas was small. If the canvas fills the container, zoom should start at 1.0 or be driven by how many tiles you want visible.

4. **`#terminal` overflow** — Currently `overflow: hidden` on desktop when gone-rogue is active. This clips the scaled canvas. With a properly-sized canvas, this is fine, but verify it doesn't clip parallax layers that extend beyond the game grid.

// NO! 5. **Left sidebar** — Consider hiding it or making it collapsible when perspective mode is active, to give the game viewport more room. `18vw` at 1920px = 346px of sidebar.

### Proposed Responsive Strategy

```css
/* Mobile portrait — unchanged, already works */
@media (max-width: 600px) and (orientation: portrait) {
  .rogue-grid-mobile { max-width: 100vw; }
}

/* Desktop with perspective mode */
@media (min-width: 768px) {
  body.perspective-active .rogue-grid-mobile {
    max-width: 100%;           /* fill available column */
    width: 100%;               /* stretch to container */
  }
  body.perspective-active #monitor-body {
    grid-template-columns: 0 1fr;  /* hide sidebar, or: */
    /* grid-template-columns: minmax(60px, 10vw) 1fr; — reduce sidebar */
  }
  body.perspective-active #terminal {
    padding: 0;                /* maximize canvas space */
  }
}
```

---

## 4. Lighting Overlays — What Needs Perspective Tags

### Current Render Pipeline (gone-rogue-canvas.js)

```
Pass 1:  Tiles (floor, walls, biome visuals)          ← NEEDS PROJECTION
Pass 2:  Entities (enemies, NPCs)                     ← NEEDS PROJECTION + Y-SORT
Pass 3:  Pets                                          ← NEEDS PROJECTION
Pass 4:  Sprint trails                                 ← NEEDS PROJECTION
Pass 5:  Player                                        ← NEEDS PROJECTION
Pass 6:  Pancake stack                                 ← NEEDS PROJECTION
Pass 7:  Effects and animations                        ← NEEDS PROJECTION
Pass 8:  Light source emojis                           ← NEEDS PROJECTION
Pass 9:  ★ DARKNESS MASK ★                             ← NEEDS PERSPECTIVE-AWARE RECTS
Pass 10: ★ SOURCE GLOWS ★                              ← NEEDS PERSPECTIVE-AWARE GRADIENTS
Pass 11: All shadows (drop shadow ellipses)            ← NEEDS PERSPECTIVE-AWARE ELLIPSES
```

### Darkness Mask (_renderDarknessMask)

**Current implementation** (gone-rogue-canvas.js ~line 176):
```javascript
// Per-tile: fills a cellSize × cellSize rectangle
darkness = 1 - light.intensity;
alpha = Math.pow(darkness, 0.75) * 0.73;
ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
```

**What changes with perspective:**
- Each row's rectangle width and height differ (rowScales[y] × cellSize)
- The X position must account for the trapezoid offset (rows narrow toward center at top)
- The fill color mixing (15% light color tint) stays the same, but rect geometry changes

**Tag:** `// PERSPECTIVE: replace cellSize with projected cell dimensions per row`

### Source Glow Halos (_renderSourceGlows)

**Current implementation** (gone-rogue-canvas.js ~line 390-500):
```javascript
// Per light source: radial gradient centered on tile
var gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * cellSize);
```

**What changes with perspective:**
- Glow center must be projected through `projectToRender()`
- Radius should be an *ellipse* — wider horizontally than vertically when the row is far away (compressed Y)
- Near rows: glow is large. Far rows: glow is small and squished.
- Use `ctx.save(); ctx.scale(scaleX, scaleY); ctx.createRadialGradient(...)` to create elliptical glows

**Tag:** `// PERSPECTIVE: project center, scale radius by row, use elliptical gradient`

### Drop Shadow Ellipses (_renderAllShadows / _drawDropShadow)

**Current implementation:**
```javascript
// Flat ellipse under each entity
ctx.ellipse(cx, cy + offset, radiusX, radiusY, 0, 0, Math.PI * 2);
```

**What changes with perspective:**
- Shadow position projected through `projectToRender()`
- Shadow *width* scales with row scale (wider at near rows)
- Shadow *height* (depth) scales less dramatically (it's on the ground plane)
- Shadow offset from entity increases at near rows (entity appears taller)

**Tag:** `// PERSPECTIVE: project shadow center, scale ellipse by rowScales[y]`

### Sight Cone Tint Overlay

**Current implementation:**
```javascript
// Enemy awareness indicator overlay on visible tiles
ctx.fillRect(tileX * cellSize, tileY * cellSize, cellSize, cellSize);
```

**What changes:** Same as darkness mask — perspective-projected rectangles.

**Tag:** `// PERSPECTIVE: same treatment as darkness mask rects`

### Lighting Interpolation (lighting-system.js)

The interpolation system (`_interpPrevMap`, `_interpProgress`, `getLightAt()`) operates in **grid space** and returns intensity/color values per tile. This is **perspective-agnostic** and needs **no changes**. The projection happens at render time, not calculation time.

**Tag:** `// NO CHANGE — grid-space calculation, projection applied at render`

---

## 5. Recommended Approach: Unified Projection Function

Every rendering call site should go through a single projection function:

```javascript
// Precomputed per frame (or on grid resize / perspective change)
var _rowScales = [];   // scale factor per Y row
var _rowYOffsets = [];  // projected Y position per row
var _rowXOffsets = [];  // horizontal center offset per row (for trapezoid)

function initPerspective(gridHeight, isInterior) {
  var minScale = isInterior ? 0.95 : 0.7;
  var maxScale = isInterior ? 1.05 : 1.3;
  var accumulatedY = 0;

  for (var y = 0; y < gridHeight; y++) {
    var t = y / (gridHeight - 1);
    _rowScales[y] = minScale + (maxScale - minScale) * t;
    _rowYOffsets[y] = accumulatedY;
    accumulatedY += cellSize * _rowScales[y]; // each row is a different height

    // Horizontal offset: center the narrower rows
    var rowWidth = gridWidth * cellSize * _rowScales[y];
    _rowXOffsets[y] = (canvasWidth - rowWidth) / 2;
  }
}

function projectToRender(gridX, gridY) {
  var scale = _rowScales[Math.floor(gridY)] || 1.0;
  return {
    x: _rowXOffsets[Math.floor(gridY)] + gridX * cellSize * scale,
    y: _rowYOffsets[Math.floor(gridY)],
    scale: scale,
    cellW: cellSize * scale,
    cellH: cellSize * scale
  };
}
```

Then every `x * this.cellSize` becomes `projectToRender(x, y).x` and every `this.cellSize` for width/height becomes `proj.cellW` / `proj.cellH`.

---

## 6. Tuning Order Recommendation

Before implementing the full perspective system, get comfortable with the lighting:

1. **First:** Add `projectToRender()` as a pass-through (scale=1.0 everywhere) and refactor all render calls to use it. Verify nothing breaks.
2. **Second:** Enable perspective with a subtle range (0.9→1.1). Verify lighting overlays, shadows, and glows look correct with small distortion.
3. **Third:** Crank up the perspective (0.7→1.3) and see where things break.
4. **Fourth:** Expand grid dimensions and add camera viewport.
5. **Fifth:** Add parallax layers into the dead space above the horizon.

This lets you tune lighting in perspective incrementally rather than debugging everything at once.

---

## 7. Perspective-Aware Movement & Depth Shading

### The Problem

Entities (player, enemies, projectiles) currently move across a flat plane. With perspective, movement toward the far rows (north, away from camera) should feel like moving *into* the screen, and movement toward the near rows (south) should feel like approaching.

### What Needs to Happen

**Size interpolation during movement:** An entity walking from row 15 to row 5 should shrink smoothly frame-by-frame as it transitions through each row's scale factor. The existing `player.visualX` / `player.visualY` tween system handles sub-tile interpolation — the projection function already returns per-row scale, so mid-movement the entity should use a lerped scale between the departure and arrival row scales.

**Depth shading (blvck.joker.emoji overlay):** Entities moving *away* from the camera (increasing distance / decreasing row index) should receive a darkening overlay — a semi-transparent tint that increases with distance. This sells the depth:

```
Near rows (19):  no overlay, full brightness
Mid rows (10):   ~15% dark tint
Far rows (0):    ~40% dark tint
Moving away:     tint ramps UP during movement (gradual darken)
Moving toward:   tint ramps DOWN during movement (gradual brighten)
```

Implementation approach: apply the shading as a `globalCompositeOperation: 'source-atop'` pass after drawing the entity sprite, using the blvck.joker.emoji shading palette. This keeps the shading tied to the entity silhouette rather than a rectangular overlay.

**Size pulse on depth transitions:** A subtle scale transform (shrink ~5-8% over the movement duration) when an entity moves away from camera, and a corresponding grow when approaching. This is additive to the row-scale — it emphasizes the *motion* through depth, not just the static position.

### Projectiles

Projectiles moving along the 8-axis floor plane use the same system. A thrown knife heading north shrinks and darkens. A bullet heading south grows and brightens. Projectiles should also get a slight motion blur stretch along their travel vector, scaled by the perspective — far projectiles blur less (they're "slower" visually), near ones blur more.

---

## 8. Accessibility: Single-Tap Input & Perspective Tile Selection

### The Problem

The game supports single-tap / quadstick accessibility controllers. With perspective, the far rows (top of screen) compress tiles to ~60% of their normal size. A 20px tile at row 0 becomes ~12px — below the 44px minimum tap target. Players physically cannot select individual tiles at the far end of the grid.

### Tap-to-Move Enhancement

**Selected tile highlight:** When a floor tile is tapped/clicked, it should visually highlight with a glowing border before the move executes. This gives:

- Confirmation feedback ("I'm about to move HERE")
- Error recovery (tap again to cancel, tap elsewhere to redirect)
- Accessibility signal (the glow is visible even on tiny far tiles)

```
Selected tile:
  border: 2px solid rgba(28, 255, 155, 0.8)
  box-shadow: 0 0 8px rgba(28, 255, 155, 0.4), inset 0 0 4px rgba(28, 255, 155, 0.2)
  background: rgba(28, 255, 155, 0.06)
  transition: all 0.15s ease
```

**Dead space cursor feedback:** Tapping in dead space (outside the playable grid, or on impassable tiles) should show a brief "invalid target" ripple — a fading ring at the tap point. This confirms the input was received even though no action was taken.

**Perspective-aware hit areas:** The tap-to-move hit detection must use *projected* coordinates, not flat grid coordinates. A tap at screen position (x, y) needs to be un-projected through `projectToRender` in reverse to find the actual grid tile. Far tiles have larger hit areas than their visual size — the hit box should use at minimum 20px per tile (the unscaled size) even when the tile renders at 12px. This means adjacent far tiles may overlap in hit space; resolve by picking the tile whose *center* is closest to the tap point.

**Tap+drag fishing system:** The existing fishing mechanic uses tap+drag. With perspective, the drag vector needs to be un-projected too. A drag that appears vertical on screen maps to a longer grid distance at far rows than near rows. The haptic feedback (vibration patterns, visual tension line) should scale with the *grid distance*, not the screen distance, so the interaction feels consistent regardless of where on the grid the player is fishing.

### Minimum Interactive Tile Size

Even with enhanced hit detection, there should be a minimum *visual* tile size floor. If perspective would compress a tile below 10px on screen, the camera should auto-zoom to keep the player's local area above this threshold. The `coverZ` auto-zoom system could factor in the player's current row scale:

```javascript
var playerRowScale = _rowScales[Math.floor(player.y)] || 1.0;
var effectiveCellSize = cellSize * playerRowScale * z;
if (effectiveCellSize < 14) {
  z = 14 / (cellSize * playerRowScale);
}
```

---

## 9. Ceiling Grid: Vertical Stealth Mechanics

### The Problem

This is a stealth action game. Players need to shoot *upward* at ceiling-mounted targets — light bulbs, security cameras, ventilation grates — not just across the floor plane. The current 2D grid has no concept of a vertical axis. With perspective rendering, a ceiling layer needs to exist, be rendered, and be interactable.

### Design Constraints

- Ceiling targets must be selectable via the same single-tap input system
- The ceiling grid shares the same X/Z coordinates as the floor (it's directly above)
- Ceiling perspective skew is the *inverse* of floor skew: the ceiling appears to recede toward the *bottom* of the screen (vanishing point convergence), while the floor recedes toward the top
- Projectiles traveling floor→ceiling need a brief vertical animation (a "shooting up" arc or straight-line trajectory)
- Ceiling objects cast shadows and light downward onto the floor grid (already handled by the lighting system, but the *source positions* need to be marked as ceiling-mounted)

### Proposed Architecture

**Separate canvas or DOM layer** above the floor canvas, with mirrored perspective:

```
┌─────────────────────────────────────────┐
│  CEILING LAYER (canvas or DOM)          │  ← inverse perspective
│  - Light fixtures (shootable)           │     far rows LARGE at top
│  - Security cameras (shootable)         │     near rows SMALL at bottom
│  - Vents (interactable)                 │
│  - Ceiling texture/tiles                │
├─────────────────────────────────────────┤
│  ← vanishing horizon line →            │  ← where floor and ceiling meet
├─────────────────────────────────────────┤
│  FLOOR LAYER (existing canvas)          │  ← normal perspective
│  - Player, enemies, items              │     far rows SMALL at top
│  - Floor tiles, walls                  │     near rows LARGE at bottom
└─────────────────────────────────────────┘
```

The ceiling layer uses the same `projectToRender()` function but with inverted row scales:

```javascript
// Floor:   row 0 = 0.7x (far/small),  row 19 = 1.3x (near/large)
// Ceiling: row 0 = 1.3x (near/large), row 19 = 0.7x (far/small)
var ceilingScale = maxScale + minScale - floorScale;
```

### Interaction Model

**Look-up toggle:** A button or gesture switches the camera "focus" between floor and ceiling. When ceiling-focused:

- Floor layer dims (30-40% darkened overlay)
- Ceiling layer becomes fully interactive (tap-to-target)
- A crosshair or targeting reticle appears
- Projectile trajectory is shown as a preview line before firing

**Contextual aim:** Alternatively, tapping above the horizon line auto-targets the ceiling, tapping below targets the floor. This avoids a mode toggle and feels more natural with single-tap input. The hit detection checks both layers and picks the one matching the tap's vertical zone.

### Rendering Considerations

- Ceiling tiles should be partially transparent (you're looking up through the floor plane conceptually) or rendered as a separate overlay with opacity
- Only ceiling objects near the player's X/Z position should be rendered to avoid visual clutter
- Destroyed ceiling objects (shot light bulbs, broken cameras) affect the lighting system — the light source is removed, darkness spreads
- Ceiling vents could be entry/exit points for a vertical traversal mechanic

### Open Questions

- Should the ceiling grid be the same dimensions as the floor (40×20 / 60×30)?
- How much of the ceiling is visible at once? (Probably a smaller viewport than the floor)
- Do ceiling objects have health/durability, or are they one-shot destroyable?
- Should the ceiling be visible at all times (split screen effect) or only when aiming up?
- How does this interact with rooms that have different ceiling heights (open areas vs corridors)?

---

## Quick Reference: Files to Modify

| File | What to Change | Priority |
|------|---------------|----------|
| `gone-rogue.js:14-15` | GRID_WIDTH, GRID_HEIGHT → larger or dynamic | P1 |
| `gone-rogue-canvas.js:10,26-35` | Canvas sizing → viewport-driven, not grid-driven | P1 |
| `gone-rogue-canvas.js:104-186` | All render passes → route through `projectToRender()` | P1 |
| `gone-rogue-canvas.js:_renderDarknessMask` | Flat rects → perspective-projected rects | P1 |
| `gone-rogue-canvas.js:_renderSourceGlows` | Circular gradients → elliptical projected gradients | P2 |
| `gone-rogue-canvas.js:_drawDropShadow` | Flat ellipses → row-scaled ellipses | P2 |
| `gone-rogue-mobile.css:12-33` | `.rogue-grid-mobile max-width` → remove 600px cap on desktop | ~~P1~~ DONE |
| `crt.css:216-222` | `#monitor-body` columns → more space for game on desktop | ~~P1~~ DONE |
| `crt.css:2809-2881` | Desktop canvas containment → fill container | ~~P1~~ DONE |
| `gone-rogue-mobile.js:1159-1217` | Camera follow → perspective-aware pan clamping | P2 |
| `gone-rogue-mobile.js:1163` | Desktop zoom `z=1.2` → `z=2.0`, mobile portrait stays 1.5 | ~~P2~~ DONE |
| `floor-generator.js` | Room bounds → use new grid dimensions | P1 |
| `floor-gen-core.js` | Tutorial floors → parameterize for new grid size | P2 |
| `lighting-system.js` | No changes to calculation — projection is render-side | — |

---

| `gone-rogue-canvas.js` | Depth shading overlay on entities (blvck.joker.emoji palette) | P2 |
| `gone-rogue-canvas.js` | Size interpolation during depth movement (lerped row scale) | P2 |
| `gone-rogue-mobile.js` | Reverse-project tap coordinates through perspective | P1 |
| `gone-rogue-mobile.js` | Selected tile highlight + dead space cursor feedback | P1 |
| `gone-rogue-mobile.js` | Minimum interactive tile size auto-zoom | P2 |
| `gone-rogue-canvas.js` | Ceiling grid layer (inverse perspective, separate canvas) | P3 |
| `gone-rogue.js` | Ceiling object data model (lights, cameras, vents) | P3 |
| `lighting-system.js` | Ceiling-mounted light sources → downward shadow casting | P3 |

---

**Document Version:** 1.1
**Status:** Analysis + Accessibility/Depth/Ceiling Concerns — Ready for Implementation Planning
