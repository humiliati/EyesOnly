# 5-Phase Roadmap: Door Contract System & Proc Gen Modularization

> See [WORLD_BUILDING_ENGINE.md](./WORLD_BUILDING_ENGINE.md) for the full WBE design.
> See [BIOME_SYSTEMS.md](./BIOME_SYSTEMS.md) for biome data (world, boss, interior).
> See [BUILDING_INTERIOR_SYSTEM.md](./BUILDING_INTERIOR_SYSTEM.md) for interior floor architecture.

## Context

The monolith `gone-rogue.js` started at 3,661 lines holding all door state and delegating to ~40 ctx factory functions. The door contract was systemically broken (BUG 2 in the audit): procedural floors had no retreat door, no guardrails, and no spawn-near-correct-door logic. Building interior doors (BUG 13) also lacked their own contract. The World Building Engine (WBE) needed a clean procedural generation API to support its SFC-based floor resolver.

All satellites use the established pattern: **IIFE + revealing module, stateless, ctx-driven, loaded before monolith**.

---

## Phase 1: Extract `door-contract-system.js` — ✅ COMPLETE

**Goal:** Pull all door state and logic into a single-responsibility module.

**Implemented:** `public/js/door-contract-system.js` (250 lines)

**API delivered:**
- State accessors: `getLastExitPos`, `setLastExitPos`, `getSpawnFromLastExitPos`, `setSpawnFromLastExitPos`, `getDoorSpawnProtect`, `setDoorSpawnProtect`, `clearDoorSpawnProtect`, `tickDoorSpawnProtect`, `resetAll`
- Contract logic: `applyDoorContract(opts)`, `applyBuildingDoorContract(opts)`, `findSpawnNearDoor(grid, TILES, w, h, target, avoid, radius)`
- Constants: `GUARDRAIL_STEPS`

**Monolith changes completed:**
- 3 closure vars removed from monolith
- 4 ctx factories updated to delegate to `DoorContractSystem.*`
- Script tag added to `public/index.html`

---

## Phase 2: Wire Door Contract into Procedural Generator — ✅ COMPLETE

**Goal:** Fix the procedural generator gap — procedural floors now place both doors and use the contract system.

**Changes delivered:**

`floor-generator.js` — `placePlayerAndExit()` (name kept for backward compat):
- Places forward door (↪️) at `lastRoom.center` with metadata `{ type: 'door', doorKind: 'forward' }`
- Places back door (↩️) near `firstRoom.center` with metadata `{ type: 'door', doorKind: 'back' }`
- Returns `{ playerX, playerY, exitX, exitY, backX, backY }`

`floor-gen-core.js`:
- Calls `DoorContractSystem.applyDoorContract()` after floor generation with full opts

`tutorial-floor-gen.js`:
- Inline BUG 2 FIX patch removed
- Delegates to `DoorContractSystem.applyDoorContract()` for spawn positioning
- BUG 1 FIX: `suppressBackDoor` guard on final re-stamp section

---

## Phase 3: Extract Biome Visual Facade — ✅ COMPLETE

**Goal:** Pull biome visual delegation wrappers out of the monolith.

**Implemented:** `public/js/biome-visual-facade.js` (135 lines)

**API delivered:**
- Build functions: `buildBiomeVisualGrid(biome, ctx)`, `buildTileRenderObjects(biome, ctx)`, `buildBiomeBackgroundColors(biome, isNight, ctx)`
- Utilities: `hexToRgb`, `rgbToHex`, `lerpColor`, `getNeighborTiles`
- State accessors: `getVisualGrid()`, `setVisualGrid()`, `getBackgroundColors()`, `setBackgroundColors()`, `getRenderObjects()`, `setRenderObjects()`, `clearAll()`

**WBE integration:** The Map Template Loader and Proc Gen pipeline use this facade for biome visual application. Interior biome resolution in `interior-floor-system.js` calls the ctx-wrapped versions of these functions.

---

## Phase 4: Create Floor Metadata Registry — ✅ COMPLETE

**Goal:** Build a data-driven registry that the WBE's Floor Resolver can query.

**Implemented:** `public/js/floor-metadata-registry.js` (210 lines)

**API delivered:**
- `register(floorId, metadata)` / `registerAll(entries)`
- `get(floorId)` — single floor lookup
- `getByBiome(biomeId)` / `getByType(type)` / `getByTag(tag)` — filtered queries
- `registerTutorialFloors()` — auto-registers floors 0-3 and interior floors from TutorialFloors

**Metadata shape (per floor):**
```js
{
    id, type, name, description, biomeId, difficultyTier,
    doors: { forward, back, building[] },
    narrativeTags[], buildingId, parentFloorId, isInterior,
    suppressBackDoor
}
```

**Registered floors:** Floors 0-3 (tutorial), `1.2` (church), `0.1` (tavern), `0.1.1` (tavern basement), `1.3` (shop)

---

## Phase 5: Documentation & Monolith Cleanup — ⚠️ PARTIAL

**Goal:** Update design docs, clean monolith, verify net line reduction.

**Completed tasks:**
1. ✅ WBE doc §6 (Door Contract) references `door-contract-system.js` as implementation
2. ✅ WBE doc "Extracted Modules" section lists all satellites with APIs
3. ✅ WBE doc cross-references `FloorMetadataRegistry`, `DoorContractSystem`, `BiomeVisualFacade`
4. ⬜ TUTORIAL_FLOORS_AUDIT.md BUG status markers not yet formally updated (BUGs 1, 2, 4, 8, 9, 10, 11, 12, 13 are all fixed but audit doc doesn't reflect this)
5. ✅ Monolith reduction verified: 3,661 → 3,263 lines (**398 lines removed**, exceeding the 100-130 estimate)
6. ⬜ Full playthrough validation not formally recorded

**Remaining Phase 5 work:**
- Update TUTORIAL_FLOORS_AUDIT.md with fix status for all 13 bugs (8 validated PASS as of 2026-03-06)
- Record playthrough validation results

---

## New Files Created (Summary)

| File | Planned Lines | Actual Lines | Purpose |
|------|---------------|--------------|---------|
| `door-contract-system.js` | ~120 | 250 | Door state ownership + contract logic |
| `biome-visual-facade.js` | ~50 | 135 | Clean biome visual entry point for WBE |
| `floor-metadata-registry.js` | ~80 | 210 | Unified floor metadata for WBE Floor Resolver |

## Post-Roadmap Work (Completed Since)

The following work was completed after the original 5-phase roadmap, extending the biome and interior systems:

| Date | Work | Files |
|------|------|-------|
| 2026-03-07 | Rethemed all 6 original biomes with Sandpoint narrative names | `biomes.json` |
| 2026-03-07 | Added 2 new world biomes: LAKE, SKI_MOUNTAIN | `biomes.json` |
| 2026-03-07 | Created 3 boss arena biomes (Train Depot, Long Bridge, Ski Mountain) | `boss-biomes.json`, `boss-floor-registry.js` |
| 2026-03-07 | Wired boss biomes into data registry (merged into main biomes map) | `gone-rogue-data-registry.js` |
| 2026-03-07 | Created 12 interior biome definitions | `interior-biomes.json` |
| 2026-03-07 | Wired interior biomes into data registry (`getInteriorBiome()`, `getInteriorBiomes()`) | `gone-rogue-data-registry.js` |
| 2026-03-07 | Added `_resolveInteriorBiome()` — biome resolution for building interiors | `interior-floor-system.js` |
| 2026-03-07 | Replaced hardcoded lighting with per-interior-biome profiles | `interior-floor-system.js` |
| 2026-03-07 | Tagged all 4 authored layouts with `interiorBiome` fields | `tutorial-floors.js` |
| 2026-03-07 | Updated BIOME_SYSTEMS.md, BUILDING_INTERIOR_SYSTEM.md, WBE cross-references | docs/ |

## Phase Dependencies

```
Phase 1 (door-contract-system.js)      ✅
    ↓
Phase 2 (wire into proc gen)            ✅
    ↓
Phase 3 (biome visual facade)           ✅  (ran parallel with Phase 2)
    ↓
Phase 4 (floor metadata registry)       ✅
    ↓
Phase 5 (docs + cleanup)                ⚠️  (audit doc bug statuses pending)
```

---

**Document Version**: 2.0
**Last Updated**: 2026-03-07
**Status**: Phases 1-4 complete, Phase 5 partial (audit doc update pending)
