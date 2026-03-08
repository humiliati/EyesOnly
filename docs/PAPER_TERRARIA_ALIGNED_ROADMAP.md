# Paper Terraria — Aligned Implementation Roadmap

> **Last Updated:** 2026-03-07
> **Source:** [PAPER_TERRARIA_TODO.md](./PAPER_TERRARIA_TODO.md)
> **Cross-Reference:** [WORLD_BUILDING_ENGINE_ROADMAP.md](./WORLD_BUILDING_ENGINE_ROADMAP.md), [UNIFIED_MOVEMENT_LIGHTING_VISION.md](./UNIFIED_MOVEMENT_LIGHTING_VISION.md)

This document aligns the Paper Terraria visual/rendering TODO with the existing EyesOnly codebase. Each phase is audited against what's already implemented, what's partially done, and what remains.

---

## Codebase Audit Summary

### Already Implemented (Skip or Verify Only)

| Phase | Feature | File | Evidence |
|-------|---------|------|----------|
| 1.1 | TILE_OPACITY constants (WALL 1.0, FLOOR 0.0, SHADOW 0.3, BREAKABLE 0.7, SMOKE 0.5) | `lighting-system.js` :11-17 | `TILE_OPACITY` object + `getTileOpacity()` exported |
| 1.2 | Ray casting with opacity accumulation | `lighting-system.js` :621-715 | `_hasLineOfSight()` Bresenham + opacity accumulation, wired into `_calculateLightFromSource()` |
| 3.2 | Item pulse/bob animation | `gone-rogue-canvas.js` :559-572 | Sine-wave bob (±2px) + scale pulse (±10%) for collectibles |
| 3.3 | Lighting interpolation (getLightAt lerp) | `lighting-system.js` :310-839 | `_interpPrevMap` + `_interpProgress` + `_interpSpeed = 0.08` (~12 frame transition) |
| 3.4 | Destructible light source properties | `lighting-system.js` :213-296 | `LIGHT_SOURCE_BREAKABLE_PROPS` for 9 light types |
| 3.4 | Light source destruction handling | `breakable-system.js` :_handleLightSourceDestruction | Type-specific VFX (campfire→scorch, torch→smoke, lamp→topple, etc.) |
| — | Universal drop shadows | `gone-rogue-canvas.js` :_renderAllShadows | Ellipse shadows under all entities, bob-aware |
| — | Emissive glow halos | `gone-rogue-canvas.js` :390-500 | Additive blending, radial gradient, color-weighted |
| 4.1 | Tap-to-move controls | `gone-rogue-mobile.js` | Tap, hold, double-tap sprint, swipe card select |
| 4.2 | A* pathfinding | `gone-rogue-movement.js` :41-184 | 8-directional octile A* with corner-cutting prevention |
| 4.2 | Path smoothing | `gone-rogue-movement.js` :198-221 | LOS-based waypoint pruning |
| 4.2 | Movement interpolation | `gone-rogue-movement.js` :_visualPosition | Float lerp, 3.2 tiles/sec base + 1.5x sprint |
| 4.2 | Portrait orientation | `gone-rogue-mobile.js` :1165 | Media query + viewport-aware zoom |

### Partially Implemented (Needs Completion)

| Phase | Feature | Current State | Remaining Work |
|-------|---------|---------------|----------------|
| 3.1 | Light orb emanation | Glow halos exist (static additive pass) | Add animated pulsing radius, flickering intensity, particle drift |
| 3.2 | Item twinkle (alpha pulse) | Scale pulse exists, NO alpha pulse 0.78→1.0 | Add alpha oscillation to ground items; add rarity-based sparkle bursts |
| 3.4 | Breakable light wiring | Props defined, destruction VFX exists | Wire card interactions (Dark Wave AOE, EMP), acceptance criteria testing |

### Not Implemented (New Work Required)

| Phase | Feature | Estimated Effort | Dependencies |
|-------|---------|-----------------|--------------|
| 1.3 | Shadow polygon casting | 6-8h | Phase 1.2 (done) |
| 2.3 | Paper Mario perspective scaling | 8-12h | None |
| 2.3 | Depth sorting (painter's algorithm) | 4-6h | Phase 2.3 |
| 2.3 | Parallax layers (sky, mountains, trees, foreground) | 4-6h | Phase 2.3 |
| 2.3 | Interior perspective flattening | 2-3h | Phase 2.3 |
| 5.1 | Lighting calculation caching | 3-4h | None |
| 5.2 | Adaptive frame rate (idle→30fps, active→60fps) | 2-3h | None |
| — | Visual test pages | 4-6h | Phases 1.3, 2.3 |

---

## Aligned Execution Roadmap

### Sprint 1: Shadow Casting (Phase 1.3)

**Prerequisite:** Phase 1.1 ✅ and 1.2 ✅ already done.

**Deliverable:** Geometric shadow polygons cast by opaque tiles, rendered as darkened regions behind walls.

**Files to modify:**
- `lighting-system.js` — Add `calculateShadowPolygon(lightX, lightY, wallX, wallY)` and `_castShadowsForLight()`. Integrate into `updateLightMap()`.
- `gone-rogue-canvas.js` — Add `_renderShadowPolygons()` pass between darkness mask and entity rendering.

**Assets needed:**
- None (procedural shadow generation from existing tile data)

**Acceptance criteria from PAPER_TERRARIA_TODO:**
- [ ] Light blocked by WALL tiles (opacity 1.0)
- [ ] Partial light through BREAKABLE (opacity 0.7) and SMOKE (0.5)
- [ ] Shadow polygons projected behind opaque tiles
- [ ] Smooth shadow edges (anti-aliased or soft falloff)
- [ ] Performance: <2ms per frame for shadow calculations

**Risk:** Shadow polygon math is complex. Fallback: simplified blob shadows using existing ray-cast attenuation (which already works). Feature flag `ENABLE_SHADOW_POLYGONS` recommended.

---

### Sprint 2: Paper Mario Perspective (Phase 2.3)

**Deliverable:** Y-based scaling where top-of-screen = far (small), bottom = near (large). Depth-sorted rendering. Parallax background layers.

**Files to modify:**
- `gone-rogue-canvas.js` — Add `projectToRender(x, y)`, row precomputation (`rowScales[]`, `rowOffsets[]`), depth-sorted render queue, wall height stretch
- `gone-rogue.js` — Interior detection to flatten scale range (0.9→1.1) vs exterior (0.6→1.4)

**New files:**
- `parallax-system.js` — Sky gradient, 2-3 parallax layers (mountains 0.25, trees 0.6, foreground 1.2). Camera offset multiplied by layer speed. DOM `translateX()` transforms.

**Assets needed:**
- Sky gradient colors per biome (data, not art — CSS gradients)
- Mountain silhouette strip (single horizontal tile-able image, ~200×40px, per biome family)
- Tree line silhouette strip (single horizontal tile-able image, ~200×60px, per biome family)
- Foreground decoration strip (branches/fog/railings, optional, ~200×40px)

**Sub-tasks (from Phase 2.3.1-2.3.13):**

| ID | Task | File | Status |
|----|------|------|--------|
| 2.3.1 | `projectToRender()` function | `gone-rogue-canvas.js` | ⬜ |
| 2.3.2 | Apply scale to entity rendering | `gone-rogue-canvas.js` | ⬜ |
| 2.3.3 | Wall render with height stretch | `gone-rogue-canvas.js` | ⬜ |
| 2.3.4 | Depth sorting (Y-ordered render) | `gone-rogue-canvas.js` | ⬜ |
| 2.3.5 | Parallax layers (optional) | `parallax-system.js` | ⬜ |
| 2.3.6 | Building interior anchors | `gone-rogue.js` | ⬜ |
| 2.3.7 | Row precomputation | `gone-rogue-canvas.js` | ⬜ |
| 2.3.8 | Sky gradient layer (static) | `parallax-system.js` | ⬜ |
| 2.3.9 | Far parallax (mountains, 0.25) | `parallax-system.js` | ⬜ |
| 2.3.10 | Mid parallax (trees, 0.6) | `parallax-system.js` | ⬜ |
| 2.3.11 | Foreground parallax (1.2) | `parallax-system.js` | ⬜ |
| 2.3.12 | Remove horizon when entering interior | `gone-rogue.js` | ⬜ |
| 2.3.13 | Flatten scale range indoors | `gone-rogue-canvas.js` | ⬜ |

**Artistic decisions (confirmed in PAPER_TERRARIA_TODO):**
- Fixed horizon at top of screen (enables row precomputation, zero per-frame math)
- Hybrid background: gradient + 2 parallax layers
- Remove horizon entirely when indoors
- Exterior scale 0.6→1.4, Interior scale 0.9→1.1

**Assets generated:**
- `public/assets/parallax/parallax-mountains.svg` + `.png` — Far ridge silhouette (800×80px, tile-able, dual-ridge)
- `public/assets/parallax/parallax-treeline.svg` + `.png` — Mid tree/structure silhouette (800×100px, tile-able, mixed conifers/deciduous/rooftops)
- `public/assets/parallax/parallax-foreground.svg` + `.png` — Near branches/fog/railing (800×60px, tile-able, sparse framing)

All 3 are dark monochrome on transparent — biome tinting applied at runtime via `globalCompositeOperation = 'source-atop'`.

**Risk:** Perspective scaling touches the core render loop. Feature flag `ENABLE_PERSPECTIVE` recommended. Collision stays grid-based (footpoint only).

#### Camera Scaling Interaction (Critical Design Note)

The existing camera system uses **two independent scaling layers** that compound:

| Layer | Where | Current Behavior | Affects Perspective? |
|-------|-------|-----------------|---------------------|
| Canvas camera | `gone-rogue-canvas.js:102` `ctx.setTransform(zoom, 0, 0, zoom, offX, offY)` | zoom=1 always, offX/offY for sub-tile pan smoothing | **Yes** — perspective `projectToRender()` runs inside this transform |
| CSS camera | `gone-rogue-mobile.js:1216` `canvas.style.transform = 'scale(z) translate(tx, ty)'` | z=1.2 desktop, 1.5 mobile portrait, up to 3.0. Player-following pan. | **No** — uniform post-hoc zoom, perspective already baked into pixels |

**What this means for interiors:**

The PAPER_TERRARIA_TODO proposed flattening interior scale to 0.9→1.1 while exteriors use 0.6→1.4. But the CSS camera already scales everything 1.2x–1.5x *uniformly on top of* perspective. The actual perceived scale compounds:

| Context | Perspective Range | × CSS Zoom | Effective Perceived Range |
|---------|------------------|-----------|--------------------------|
| Exterior (desktop) | 0.6→1.4 | × 1.2 | 0.72→1.68 |
| Exterior (mobile) | 0.6→1.4 | × 1.5 | 0.90→2.10 |
| Interior (desktop) | 0.9→1.1 | × 1.2 | 1.08→1.32 |
| Interior (mobile) | 0.9→1.1 | × 1.5 | 1.35→1.65 |

**The CSS zoom doesn't break perspective** — it's applied uniformly after the canvas renders, so Y-scaling ratios are preserved. However, on mobile the CSS zoom is already large enough that even the "flattened" interior perspective (0.9→1.1) will produce visible variation (1.35→1.65 effective).

**Recommended approach for `projectToRender()`:**

```javascript
// Row precomputation respects interior/exterior context
function initPerspective(isInterior) {
  var min = isInterior ? 0.95 : 0.6;
  var max = isInterior ? 1.05 : 1.4;
  for (var y = 0; y < SIM_HEIGHT; y++) {
    var depth = y / SIM_HEIGHT;
    rowScales[y] = min + (max - min) * depth;
    rowOffsets[y] = y * rowScales[y];
  }
}
```

Interior range tightened to 0.95→1.05 (from the TODO's 0.9→1.1) to account for CSS zoom compounding. This keeps interior perspective subtle — just enough to suggest depth without feeling warped. `initPerspective()` is called on floor transition, reading the floor's `isInterior` flag from `floor-metadata-registry.js`.

The CSS camera layer (`_applyMobileCanvasFollow`) requires **no changes** — it stays a uniform scale+translate that follows the player. The perspective math lives entirely inside the canvas renderer.

---

### Sprint 3: Visual Polish (Phases 3.1, 3.2 completion)

**Deliverable:** Animated light orbs, alpha-pulsing ground items, rarity-based sparkle bursts.

**Files to modify:**
- `gone-rogue-canvas.js` — Add `_renderLightOrbs()` pass with animated radius pulsing, random flicker. Add alpha oscillation (0.78→1.0) to ground item rendering. Add sparkle particle system keyed to item rarity.
- `lighting-system.js` — Add `getOrbAnimationState(lightId, time)` for per-orb animation phase offset.

**Assets needed:**
- None (procedural effects — canvas gradients, alpha blending, particle math)

**Acceptance criteria:**
- [ ] Light sources visually emanate (pulsing glow radius)
- [ ] Ground items alpha-pulse 0.78→1.0 (~2s period)
- [ ] Rare items sparkle more frequently than common
- [ ] Sparkle bursts are random (not periodic)
- [ ] No perceptible FPS impact (<0.5ms added per frame)

---

### Sprint 4: Performance Optimization (Phase 5)

**Deliverable:** Lighting cache for static lights, adaptive frame rate for battery savings.

**Files to modify:**
- `lighting-system.js` — Add `LightingCache` object: `tileCache{}`, `lightPositions{}`, `invalidateTile()`, `invalidateLight()`, `getCachedLight()`, `setCachedLight()`. Wire into `updateLightMap()` to skip unchanged tiles.
- `gone-rogue.js` — Add `FrameRateController`: track `lastInputTime`, drop to 30fps after 1s idle, ramp to 60fps on input. Wire into `requestAnimationFrame` loop.

**Assets needed:**
- None

**Acceptance criteria:**
- [ ] Static lights don't recalculate every frame
- [ ] Cache invalidation correct (no stale lighting)
- [ ] 50% reduction in lighting calculations (measurable via perf-hook.js)
- [ ] FPS drops to 30 when idle (>1s without input)
- [ ] No perceived lag when resuming action
- [ ] Battery savings 20-30% on mobile (measurable)

---

### Sprint 5: Testing & Validation

**New files to create:**
- `tests/test-terraria-lighting.html` — Light occlusion test scene (maze with positioned lights, toggle shadow polygons)
- `tests/test-perspective.html` — Perspective scaling demo (entities at different Y positions, parallax layers visible)
- `tests/test-movement.html` — Movement interpolation + pathfinding demo

**Test matrix:**

| Category | Test | Target |
|----------|------|--------|
| Performance | Lighting calc benchmark | <2ms per frame |
| Performance | FPS with 20+ light sources | 60fps desktop, 30fps low-end mobile |
| Performance | Battery drain measurement | <20% increase vs current |
| Visual | Shadow occlusion correctness | No light leaking through walls |
| Visual | Perspective scaling consistency | Smooth Y-scaling, no jumps |
| Visual | Twinkle + sparkle appearance | Visible, not distracting |
| Gameplay | Stealth mechanics with new lighting | Still functional |
| Gameplay | Touch controls responsiveness | <100ms input-to-action |
| Gameplay | Pathfinding obstacle handling | No stuck states |

---

## Cross-Roadmap Dependencies

The Paper Terraria work is **independent** of the World Building Engine roadmap (INT-1 through NPC-E). However, two intersection points exist:

| Paper Terraria Phase | WBE Item | Intersection |
|---------------------|----------|--------------|
| 2.3.6 Building interior anchors | INT-1 Interior biome schema | Interior perspective flattening should read `zoomBias` from interior biome definitions when INT-1 lands |
| 2.3.12-13 Interior horizon/scale | INT-3 Visual compression | INT-3's "radial light mask" and "wall occlusion" should compose with shadow polygon system from Phase 1.3 |

**Recommendation:** Paper Terraria Sprints 1-3 can proceed in parallel with WBE Tier 1. Sprint 2's interior detection (2.3.12-13) should use a simple floor-type check initially, then be upgraded to read INT-1 schema when available.

---

## Asset Inventory

### Required Assets (Minimal)

| Asset | Type | Purpose | Sprint | Priority |
|-------|------|---------|--------|----------|
| Mountain silhouette strip | Image (tile-able, ~200×40px) | Far parallax background | 2 | P1 |
| Tree line silhouette strip | Image (tile-able, ~200×60px) | Mid parallax background | 2 | P1 |
| Biome sky gradient palette | Data (JSON/JS object) | Per-biome sky colors (top→bottom) | 2 | P1 |
| Foreground decoration strip | Image (tile-able, ~200×40px) | Near parallax (branches/fog) | 2 | P2 optional |

### No Assets Required (Procedural)

All other visual effects are procedural: shadow polygons (calculated from tile geometry), light orbs (canvas gradients), item twinkle (alpha math), sparkle bursts (particle emitter), depth sorting (render queue), perspective scaling (row precomputation), lighting cache (data structure), adaptive FPS (timer logic).

### Asset Production Notes

Parallax strips should be created as simple monochrome silhouettes (dark on transparent). The rendering system applies biome-specific tinting at runtime using `globalCompositeOperation = 'source-atop'` + `fillStyle = biomeColor`. This means **3 base silhouette images** serve all biomes.

---

## Priority & Time Estimate

| Sprint | Focus | Estimated Hours | Depends On |
|--------|-------|----------------|------------|
| 1 | Shadow polygon casting | 6-8h | Nothing (1.1 & 1.2 done) |
| 2 | Perspective + parallax + depth sort | 12-16h | Nothing (can parallel Sprint 1) |
| 3 | Light orbs + twinkle + sparkle polish | 4-6h | Sprint 1 (shadow system informs orb rendering) |
| 4 | Lighting cache + adaptive FPS | 5-7h | Sprint 1 (cache builds on lighting changes) |
| 5 | Test pages + validation | 4-6h | Sprints 1-4 |

**Total estimated: 31-43 hours (roughly 1 week full-time)**

This is reduced from the original 5-week estimate because Phases 1.1, 1.2, 3.2 (partial), 3.3, 3.4, 4.1, and 4.2 are already complete — approximately 60% of the original scope.

---

## Recommended Execution Order

1. **Sprint 1 + Sprint 2 in parallel** — Shadow casting and perspective are independent subsystems touching different render passes. Work both simultaneously.
2. **Sprint 3** — Polish builds on Sprint 1's shadow rendering knowledge.
3. **Sprint 4** — Optimization after features stabilize.
4. **Sprint 5** — Testing last, after all features land.

---

**Document Version:** 1.0
**Status:** Aligned & Ready for Execution
