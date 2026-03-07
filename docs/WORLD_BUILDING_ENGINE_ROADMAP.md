# 5-Phase Roadmap: Door Contract System & Proc Gen Modularization

## Context

The monolith `gone-rogue.js` (3,661 lines) holds all door state and delegates to ~40 ctx factory functions. The door contract is systemically broken (BUG 2 in the audit): procedural floors have no retreat door, no guardrails, and no spawn-near-correct-door logic. Building interior doors (BUG 13) also lack their own contract. Meanwhile, the World Building Engine (WBE) needs a clean procedural generation API to support its SFC-based floor resolver.

Floor generation is already ~95% extracted to satellites — the monolith mostly contains ctx factory wrappers (~200 lines of delegation). The 3 door state vars (`_lastExitPos`, `_spawnFromLastExitPos`, `_doorSpawnProtect`) have **zero cross-dependencies** with other monolith state, making extraction clean.

All satellites use the established pattern: **IIFE + revealing module, stateless, ctx-driven, loaded before monolith**.

---

## Phase 1: Extract `door-contract-system.js`

**Goal:** Pull all door state and logic into a single-responsibility module.

**What moves out of the monolith:**
- 3 closure vars: `_lastExitPos`, `_spawnFromLastExitPos`, `_doorSpawnProtect` (lines ~125-132)
- Door state getters/setters currently spread across 4 ctx factories: `_playerInteractionCtx`, `_floorTransitionCtx`, `_tutorialFloorGenCtx`, `_runStartCtx`

**New module API (`door-contract-system.js`):**
```js
var DoorContractSystem = (function() {
    var _lastExitPos = null;
    var _spawnFromLastExitPos = null; // 'advance' | 'retreat' | null
    var _doorSpawnProtect = null;     // { x, y, stepsRemaining, suppressAnimation }

    // Core contract logic
    function applyDoorContract(floorData, transitionMode) { ... }
    function applyBuildingDoorContract(floorData) { ... }
    function findSpawnNearDoor(grid, targetDoor, avoidDoor, radius) { ... }

    // State accessors (replace monolith getters/setters)
    function getLastExitPos() { ... }
    function setLastExitPos(pos) { ... }
    function getSpawnFromLastExitPos() { ... }
    function setSpawnFromLastExitPos(mode) { ... }
    function getDoorSpawnProtect() { ... }
    function setDoorSpawnProtect(protect) { ... }
    function clearDoorSpawnProtect() { ... }
    function tickDoorSpawnProtect() { ... }
    function resetAll() { ... }

    return { /* public API */ };
})();
```

**Monolith changes:**
- Remove 3 closure vars
- Update 4 ctx factories to delegate to `DoorContractSystem.*` instead of direct closure access
- Add `<script>` tag for `door-contract-system.js` before `gone-rogue.js`

**Files touched:**
- Create: `public/js/door-contract-system.js` (~120 lines)
- Edit: `public/js/gone-rogue.js` (remove ~30 lines, update 4 ctx factories)
- Edit: `portal/index.html` (add script tag)

**Verification:** Door state round-trips correctly — advance through forward door, check spawn near retreat door with guardrails active. Retreat back, check spawn near forward door. Enter building, check no guardrails.

---

## Phase 2: Wire Door Contract into Procedural Generator

**Goal:** Fix the procedural generator gap — currently `floor-generator.js` places ONE exit and no retreat door.

**Changes to `floor-generator.js` (`placePlayerAndExit`):**
- Rename/refactor to `placeDoorsAndPlayer()`
- Place TWO doors: forward (↪️) and back (↩️)
- Back door placed at opposite end of floor from forward door
- Call `DoorContractSystem.applyDoorContract()` for spawn positioning

**Changes to `floor-gen-core.js`:**
- Update `_floorGenCoreCtx` to include door contract accessors (currently missing — the gap)
- After floor generation, call door contract application

**Changes to `tutorial-floor-gen.js`:**
- Remove inline door spawn logic (lines 36-46) and BUG 2 FIX patch (lines 88-114)
- Delegate to `DoorContractSystem.applyDoorContract()` instead
- Keep back door placement logic (lines 118-174) but route through door contract system

**Files touched:**
- Edit: `public/js/floor-generator.js` (~40 lines changed in placePlayerAndExit)
- Edit: `public/js/floor-gen-core.js` (~15 lines, ctx update + contract call)
- Edit: `public/js/tutorial-floor-gen.js` (~60 lines removed/replaced)
- Edit: `public/js/gone-rogue.js` (update `_floorGenCoreCtx` factory)

**Verification:** Generate procedural floors 4+ — confirm both doors present, spawn contract correct. Play through tutorial floors 0-3 — confirm no regression. Enter/exit buildings — confirm funnel pattern.

---

## Phase 3: Extract Biome Visual Facade

**Goal:** Pull the 36-line biome visual delegation wrapper out of the monolith into its own module.

**What moves out:**
- Monolith lines ~985-1020: pure delegation wrappers that forward calls to `BiomeVisuals.*`
- These are trivial pass-throughs with zero monolith state dependency

**New module (`biome-visual-facade.js`):**
```js
var BiomeVisualFacade = (function() {
    function applyBiomeVisuals(grid, biomeId) { return BiomeVisuals.apply(grid, biomeId); }
    function getBiomeTheme(biomeId) { return BiomeVisuals.getTheme(biomeId); }
    // ... remaining wrappers
    return { /* public API */ };
})();
```

**Why:** This is the easiest extraction win (~36 lines, zero state), and the WBE's "Map Template Loader OR Proc Gen" pipeline needs a clean biome visual entry point.

**Files touched:**
- Create: `public/js/biome-visual-facade.js` (~50 lines)
- Edit: `public/js/gone-rogue.js` (remove ~36 lines, update ctx factory)
- Edit: `portal/index.html` (add script tag)

**Verification:** Load any floor — biome visuals render identically. Check all biome types render.

---

## Phase 4: Create Floor Metadata Registry

**Goal:** Build a data-driven registry that the WBE's Floor Resolver can query for floor metadata.

**New module (`floor-metadata-registry.js`):**
```js
var FloorMetadataRegistry = (function() {
    var _registry = {};  // floorId → metadata

    function register(floorId, metadata) { ... }
    function get(floorId) { ... }
    function getByBiome(biomeId) { ... }
    function getByType(type) { ... }  // 'template' | 'procedural'
    function getAllFloorIds() { ... }

    return { register, get, getByBiome, getByType, getAllFloorIds };
})();
```

**Metadata shape (per floor):**
```js
{
    id: "2",
    type: "template",          // or "procedural"
    biomeId: "downtown",
    difficultyTier: 1,
    doors: { forward: {x,y}, back: {x,y}, building: [{x,y}] },
    narrativeTags: ["tutorial", "first_key"],
    buildingId: null,          // or "church" for interior floors
    parentFloorId: null        // or "1" for interior floors
}
```

**Why:** The WBE design doc (Section 4) specifies each Step Node contains `{ id, floorType, difficultyTier, requiredPlayerState, allowedSynergies, narrativeTags }`. This registry is where that data lives at runtime. Currently floor metadata is scattered across `tutorial-floors.js` layout objects, `biome-config.js`, and `buildings.json` — no unified source of truth.

**Files touched:**
- Create: `public/js/floor-metadata-registry.js` (~80 lines)
- Edit: `public/js/tutorial-floors.js` (register tutorial floor metadata on load)
- Edit: `portal/index.html` (add script tag)

**Verification:** After page load, `FloorMetadataRegistry.get("0")` returns correct metadata for Floor 0. `getByType("template")` returns floors 0-3. `getByBiome("downtown")` returns matching floors.

---

## Phase 5: Documentation & Monolith Cleanup

**Goal:** Update design docs, clean monolith, verify net line reduction.

**Tasks:**
1. Update `WORLD_BUILDING_ENGINE.md` Section 6 (Door Contract) to reference `door-contract-system.js` as the implementation
2. Add new section to WBE doc: "Extracted Modules" listing all new satellites and their APIs
3. Add cross-references from WBE node types to `FloorMetadataRegistry` fields
4. Update `TUTORIAL_FLOORS_AUDIT.md` BUG 2 and BUG 13 status to "Fixed" with implementation references
5. Verify monolith net reduction (~100-130 lines removed)
6. Run full playthrough: tutorial floors 0-3 → procedural floor 4+ → building enter/exit → retreat back through floors

**Files touched:**
- Edit: `WORLD_BUILDING_ENGINE.md`
- Edit: `TUTORIAL_FLOORS_AUDIT.md`
- Edit: `public/js/gone-rogue.js` (final cleanup of orphaned ctx fields)

**Expected monolith reduction:** ~100-130 lines (3 door vars + 4 ctx factory simplifications + 36 biome wrappers + assorted delegation)

---

## New Files Created (Summary)

| File | ~Lines | Purpose |
|------|--------|---------|
| `door-contract-system.js` | 120 | Door state ownership + contract logic |
| `biome-visual-facade.js` | 50 | Clean biome visual entry point for WBE |
| `floor-metadata-registry.js` | 80 | Unified floor metadata for WBE Floor Resolver |

## Phase Dependencies

```
Phase 1 (door-contract-system.js)
    ↓
Phase 2 (wire into proc gen + tutorial gen)
    ↓
Phase 3 (biome visual facade)  ← independent, can parallel with Phase 2
    ↓
Phase 4 (floor metadata registry)  ← needs Phase 1-2 door data shapes
    ↓
Phase 5 (docs + cleanup)
```

Phases 2 and 3 can run in parallel. All others are sequential.
