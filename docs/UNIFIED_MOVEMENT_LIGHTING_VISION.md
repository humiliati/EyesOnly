# Unified Vision: Low-Impact Free-Move Animation + Terraria Lighting (Tutorial Alpha)

**Goal:** make Gone Rogue *feel* like Paper Mario / Bastion movement (continuous, natural, obstacle-aware) while keeping the existing grid+stealth+combat logic intact.

**Constraint:** lowest-impact change set. Preserve:
- 40×20 grid as authoritative simulation
- existing collision + legality checks
- existing lighting system API (`LightingSystem`) and canvas renderer path

We will add **continuous rendering + drag-to-continue (“fishing”) input** on top.

---

## 0) The unification thesis

Two efforts must converge:
1) **Movement feel**: continuous motion with intuitive pathing and tile-speed variance
2) **Lighting feel**: Terraria-like legibility (occlusion/shadows) that supports stealth + navigation

If movement becomes continuous but lighting remains flat/through-walls, players lose spatial trust.
If lighting becomes richer but movement remains tap-to-teleport-per-cell, it feels like UI math not embodiment.

So the minimal path is:
- keep grid simulation
- add a **continuous mover** (render position lerp + velocity)
- add a **drag-to-update target** loop that re-paths around obstacles
- add **cheap lighting occlusion** (raycast attenuation) to stop light through walls

---

## 1) Movement: “grid true, motion smooth”

### 1.1 Authoritative model (unchanged)
- Player state remains `{x:int, y:int}` in grid cells for:
  - stealth checks
  - enemy LOS and collision
  - pickups
  - STR combat triggers

### 1.2 New render state (added)
Add render-only position:
- `player.renderX`, `player.renderY` (float, in grid coordinates)
- `player.renderFacing` (derived from velocity)

Render position chases authoritative cell center.

**Key rule:** authoritative cell only advances when the mover crosses into the next cell center and the move is legal.

### 1.3 Continuous mover
A small module/class (or functions) that:
- maintains `currentPath: Cell[]`
- advances along path with `speedCellsPerSecond`
- slows by tile type (floor friction / hazards)

**Tile speed multiplier examples:**
- normal floor: 1.0
- shallow water / sludge: 0.75
- oil: 0.9 (or fast+slip later)
- smoke: 0.85

### 1.4 “Fishing” input (tap/click + drag)

**User intent:**
- Tap/click sets a destination.
- Holding + dragging updates the destination continuously.
- Player follows the destination until release.

**Implementation:**
- On pointer down:
  - enter `isFishing = true`
  - set `desiredTargetCell`
- On pointer move (throttled to e.g. 10–20hz):
  - update `desiredTargetCell`
  - if desired target changed enough, recompute path from current cell
- On pointer up:
  - keep last destination OR stop (design choice)

Recommended MVP behavior:
- release **keeps last destination** (feels intentional)
- a second tap cancels (or `BACK` cancels)

### 1.5 Pathing around obstacles (low impact)

Use grid A* (or BFS) on the existing walkability map.
- Recompute path when destination changes (throttle + debounce)
- If path fails, fall back to nearest reachable cell.

**Avoid heavy churn:**
- throttle repath to 100ms
- if new target is within N cells of old, do nothing

### 1.6 Acceptance tests (movement)
- Drag along a wall: player smoothly slides around using pathing, no jitter.
- Drag across blocked area: player routes around or stops at nearest reachable.
- Drag release: player continues to last target and stops centered.
- Tile speed: moving across slow tile visibly slows, then resumes.

---

## 2) Lighting: lowest-impact Terraria legibility

The existing `LightingSystem` is strong on *sources, falloff, stealth integration*.
The missing piece is **occlusion** (light-through-walls breaks trust).

### 2.1 Phase-1 lighting occlusion (cheap ray attenuation)
Implement `castLightRay()`-style attenuation (from `TERRARIA_LIGHTING_TODO.md`) but keep it minimal:
- For each tile receiving light, compute a small number of rays per source (or per tile) and attenuate based on wall hits.
- Use existing wall grid data (no new geometry).

**MVP rule:** walls are fully opaque; breakables partially opaque.

### 2.2 Performance guardrails
- Light map already throttles ~every 5 ticks.
- Add caching: `(sourceCell, targetCell)` occlusion result cached per tick.

### 2.3 Acceptance tests (lighting)
- A wall between player and lamp blocks light behind it.
- Breakables dim light behind them.
- Performance stays playable on mobile.

---

## 3) Unified TODO list (lowest-impact execution order)

### P0 — Movement feel without rewriting game logic
1. Add render position fields to player state (render-only floats).
2. Implement continuous mover that follows a path of grid cells.
3. Implement fishing input (pointer down/move/up) that updates destination.
4. Implement throttled A* pathing recompute on destination change.
5. Integrate tile-speed multipliers (floor friction) into mover speed.
6. Add debug toggles:
   - show path
   - show destination cell
   - show speed multiplier

### P1 — Lighting trust (occlusion)
7. Add tile opacity map (walls/breakables/smoke).
8. Add ray attenuation occlusion into lighting intensity calculation.
9. Cache occlusion per tick.

### P1 — UX polish that makes it *feel* like free-move
10. Sub-cell animation: slight bob or easing between cell centers.
11. Facing direction derived from velocity.
12. Camera follow/pan near edges (if playfield exceeds viewport).

### P2 — Instrumentation / auditability
13. Log input traces (drag path + timestamps).
14. Deterministic seed hooks for replay (movement+lighting).

---

## 4) Where this plugs into the current codebase (suggested)

- Movement input lives near mobile/grid input mapping:
  - `public/js/gone-rogue-mobile.js` (pointer/touch)
  - or canvas input handler if using canvas renderer

- Pathing utilities may already exist in headless adapter / tests; reuse patterns.

- Lighting occlusion implementation:
  - `public/js/lighting-system.js`

---

## 5) Non-goals (for MVP)
- true 3D volumetrics
- dynamic shadow polygons
- navmesh
- physics-based sliding

Those can come later once the “feels free-move” baseline is achieved.
