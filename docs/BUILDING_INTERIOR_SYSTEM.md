# Building Interior System — Architecture

> For the broader world-building pipeline, see [WORLD_BUILDING_ENGINE.md](./WORLD_BUILDING_ENGINE.md).
> For biome data (world, boss, interior), see [BIOME_SYSTEMS.md](./BIOME_SYSTEMS.md).
> For interior generation roadmap (structure grammar, visual compression), see [INTERIOR_SYSTEM_IDEAS.md](./INTERIOR_SYSTEM_IDEAS.md).
> For NPC spawning in interiors, see [NPC_CANON.md](./NPC_CANON.md).
> For unified execution roadmap, see [WORLD_BUILDING_ENGINE_ROADMAP.md](./WORLD_BUILDING_ENGINE_ROADMAP.md).

## Overview

The building interior system enables players to enter buildings on world floors and navigate nested interior floors. It introduces a hierarchical floor ID scheme, a navigation stack for back-tracking, interior biome visual theming, and supports both hand-authored and procedurally generated interiors.

## Floor ID Hierarchy

Floor IDs are hierarchical dot-separated strings:

```
FloorN          — World floor (world biome applies)
  └─ FloorN.N   — Building interior starting floor (CONTRIVED, interior biome applies)
       └─ FloorN.N.0  — Nested interior (PROC GEN, same or deeper interior biome)
       └─ FloorN.N.1  — Nested interior (PROC GEN, e.g. tavern "basement")
       └─ FloorN.N.2  — Nested interior (PROC GEN, eventually exit door to FloorN)
```

Examples:
- `"1"` = World floor 1
- `"1.1"` = Interior of BLD-001 (tavern) on floor 1 — uses INTERIOR_TAVERN biome
- `"1.1.1"` = Nested basement beneath tavern — uses INTERIOR_TAVERN_BASEMENT biome
- `"1.2"` = Interior of BLD-002 (church) on floor 1 — uses INTERIOR_CHURCH biome
- `"1.2.1"` = Catacombs beneath the church — uses INTERIOR_CATACOMBS biome

**Key distinction:** The tavern's basement (INTERIOR_TAVERN_BASEMENT) and the church's catacombs (INTERIOR_CATACOMBS) are separate biomes owned by their respective buildings. A narrative connection between them (tavern basement → church catacombs passage) is a future TODO but the biome architecture keeps them cleanly separated.

## Floor Navigation Stack

State in `gone-rogue.js`:
- `_floorId`: Current hierarchical floor ID (string)
- `_floorNav`: Stack of `{ floorId, spawnX, spawnY, floor }` frames

When entering a building, push current state; when exiting, pop and restore parent floor.

## Building Door Metadata

```
_tileMetadata[key] = { type: 'door', doorKind: 'building', buildingId: 'BLD-002' }
```

Building details resolved at runtime from `GoneRogueDataRegistry.getBuilding(buildingId)`.

## Interior Floor Loading Order

1. Authored layout via `InteriorFloors.getAuthoredLayout(floorId)`
2. Procedural generator via `InteriorFloors.resolveNestedGen(floorId)`
3. Fallback empty room

## Interior Biome Resolution Pipeline

When `InteriorFloorSystem.enterInteriorFloor(targetFloorId, ctx)` fires, the following sequence applies interior visuals:

```
1. Layout loaded from InteriorFloors.getAuthoredLayout(targetFloorId)
2. Grid set, player spawned (with building door contract — no guardrails)
3. ctx.clearVisualCaches()
4. _resolveInteriorBiome(targetFloorId, layout)
   ├─ Primary: layout.interiorBiome field → GoneRogueDataRegistry.getInteriorBiome(key)
   └─ Fallback: infer from floor ID prefix (e.g. "tavern.main" → INTERIOR_TAVERN)
5. If resolved:
   ├─ ctx.buildBiomeVisualGrid(interiorBiome)
   ├─ ctx.buildTileRenderObjects(interiorBiome)
   └─ ctx.buildBiomeBackgroundColors(interiorBiome, true)  // always "night" for interiors
6. LightingSystem.setBiome(interiorBiome.lightingProfile || 'COZY_FOREST_NIGHT')
7. LightingSystem.setDarknessMultiplier(interiorBiome.darknessMultiplier || 1.2)
```

### How Layouts Specify Their Biome

Each authored layout in `tutorial-floors.js` has an `interiorBiome` field:

```javascript
var TAVERN_INTERIOR_LAYOUT = {
    name: 'The Rusty Mug',
    interiorBiome: 'INTERIOR_TAVERN',  // ← resolves to interior-biomes.json entry
    // ...
};

var TAVERN_BASEMENT_LAYOUT = {
    name: 'Tavern Basement',
    interiorBiome: 'INTERIOR_TAVERN_BASEMENT',  // ← NOT catacombs (that's the church's)
    // ...
};
```

Current layout → biome mappings:

| Layout | Floor ID | Interior Biome |
|--------|----------|---------------|
| TAVERN_INTERIOR_LAYOUT | `0.1` | INTERIOR_TAVERN |
| TAVERN_BASEMENT_LAYOUT | `0.1.1` | INTERIOR_TAVERN_BASEMENT |
| CHURCH_INTERIOR_LAYOUT | `1.2` | INTERIOR_CHURCH |
| SHOP_INTERIOR_LAYOUT | `1.3` | INTERIOR_STRIP_MALL |

### Interior Biome Data Shape

Each entry in `interior-biomes.json` has:

```json
{
    "name": "The Hound's Tooth Pub",
    "description": "...",
    "wallChar": "█",
    "floorChar": ".",
    "lightingProfile": "TAVERN_WARM",
    "darknessMultiplier": 0.8,
    "wallTiles": [{ "char": "█", "weight": 40 }],
    "floorTiles": [{ "char": ".", "weight": 55 }],
    "props": [{ "emoji": "🪑", "name": "Bar Stool", "breakable": true, "hp": 1 }],
    "tileEffects": { ".": { "stealth": 10, "moveMod": 1.0, "name": "Wood Floor" } },
    "backgroundGradient": {
        "night": { "start": "#1a0e05", "end": "#2a1a0a" },
        "day": { "start": "#1a0e05", "end": "#2a1a0a" }
    }
}
```

## InteriorFloors Module API

- `registerAuthoredLayout(floorId, layoutDef)`
- `getAuthoredLayout(floorId)` → layout|null
- `registerGenerator(name, genFn)`
- `generateProceduralInterior(name, config)` → result|null
- `isInteriorFloor(floorId)` → boolean
- `getParentFloorId(floorId)` → string|null
- `resolveNestedGen(targetFloorId)` → {genName, config}|null
- `hasGenerator(name)` → boolean

## Church + Catacombs Workflow

1. Floor 1 has building door at (8,5) with buildingId BLD-002
2. `_enterBuilding` pushes nav stack, sets `_floorId` to `"1.2"`
3. `_loadInteriorFloor("1.2")` finds authored CHURCH_INTERIOR_LAYOUT → resolves INTERIOR_CHURCH biome
4. Church has hidden door at (38,10) linking to `"1.2.1"`
5. `_loadInteriorFloor("1.2.1")` resolves catacombs generator → INTERIOR_CATACOMBS biome
6. CatacombsGenerator produces rooms, enemies, loot
7. Back doors pop nav stack returning to parent

## Tavern + Basement Workflow

1. Floor 0 has building door with buildingId BLD-TAVERN
2. `_enterBuilding` pushes nav stack, sets `_floorId` to `"0.1"`
3. `_loadInteriorFloor("0.1")` finds authored TAVERN_INTERIOR_LAYOUT → resolves INTERIOR_TAVERN biome
4. Tavern has door linking to `"0.1.1"` (basement)
5. `_loadInteriorFloor("0.1.1")` finds authored TAVERN_BASEMENT_LAYOUT → resolves INTERIOR_TAVERN_BASEMENT biome
6. Eventually deeper levels (`"0.1.2"`, `"0.1.3"`, ...) via proc gen with exit door back to FloorN near tavern entrance or back door

## Files

| File | Purpose |
|------|---------|
| `interior-floors.js` | Layout + generator registry |
| `interior-floor-system.js` | Enter/exit logic, biome resolution, visual cache rebuild, lighting |
| `catacombs-generator.js` | Procedural dungeon gen for church catacombs |
| `gone-rogue.js` | Floor nav stack, enter/exit functions |
| `tutorial-floors.js` | Authored layouts with `interiorBiome` fields |
| `gone-rogue-data-registry.js` | Loads `buildings.json` and `interior-biomes.json` |
| `buildings.json` | Building definitions (BLD-TAVERN, BLD-001, BLD-002, BLD-003) |
| `interior-biomes.json` | 12 interior biome definitions |
| `portal/map-designer.html` | Visual floor editor |

## WBE Cross-Reference

| System | File | WBE Integration |
|--------|------|----------------|
| Door Contract | [WORLD_BUILDING_ENGINE.md §6](./WORLD_BUILDING_ENGINE.md) | Spawn rules for all floor transitions |
| Biome Catalog | [BIOME_SYSTEMS.md](./BIOME_SYSTEMS.md) | World, boss, and interior biome definitions |
| Interior Biome Data | `interior-biomes.json` | Visual identity per building type |
| Building Registry | `buildings.json` | Building door placement, funnel pattern |
| Lighting | `lighting-system.js` | Per-interior `lightingProfile` and `darknessMultiplier` |
| Tutorial Floors Audit | [TUTORIAL_FLOORS_AUDIT.md](./TUTORIAL_FLOORS_AUDIT.md) | BUGs 1-13 affecting interior system |

---

**Document Version**: 2.0
**Last Updated**: 2026-03-07
**Status**: Updated with interior biome resolution pipeline
