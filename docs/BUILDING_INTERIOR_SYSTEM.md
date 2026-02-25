# Building Interior System — Architecture

## Overview
The building interior system enables players to enter buildings on tutorial floors and navigate nested interior floors. It introduces a hierarchical floor ID scheme, a navigation stack for back-tracking, and supports both hand-authored and procedurally generated interiors.

## Floor ID Hierarchy
Floor IDs are hierarchical dot-separated strings:
- "1" = World floor 1
- "1.2" = Interior of BLD-002 (church) on floor 1
- "1.2.1" = Nested interior (catacombs) beneath the church

## Floor Navigation Stack
State in gone-rogue.js:
- _floorId: Current hierarchical floor ID (string)
- _floorNav: Stack of { floorId, spawnX, spawnY, floor } frames

When entering a building, push current state; when exiting, pop and restore parent floor.

## Building Door Metadata
```
_tileMetadata[key] = { type: 'door', doorKind: 'building', buildingId: 'BLD-002' }
```
Building details resolved at runtime from GoneRogueDataRegistry.getBuilding(buildingId).

## Interior Floor Loading Order
1. Authored layout via InteriorFloors.getAuthoredLayout(floorId)
2. Procedural generator via InteriorFloors.resolveNestedGen(floorId)
3. Fallback empty room

## InteriorFloors Module API
- registerAuthoredLayout(floorId, layoutDef)
- getAuthoredLayout(floorId) -> layout|null
- registerGenerator(name, genFn)
- generateProceduralInterior(name, config) -> result|null
- isInteriorFloor(floorId) -> boolean
- getParentFloorId(floorId) -> string|null
- resolveNestedGen(targetFloorId) -> {genName, config}|null
- hasGenerator(name) -> boolean

## Church + Catacombs Workflow
1. Floor 1 has building door at (8,5) with buildingId BLD-002
2. _enterBuilding pushes nav stack, sets _floorId to "1.2"
3. _loadInteriorFloor("1.2") finds authored CHURCH_INTERIOR_LAYOUT
4. Church has hidden door at (38,10) linking to "1.2.1"
5. _loadInteriorFloor("1.2.1") resolves catacombs generator
6. CatacombsGenerator produces rooms, enemies, loot
7. Back doors pop nav stack returning to parent

## Files
- interior-floors.js: Layout + generator registry
- catacombs-generator.js: Procedural dungeon gen
- gone-rogue.js: Floor nav stack, enter/exit functions
- tutorial-floors.js: Church layout, building doors on Floor 1
- gone-rogue-data-registry.js: Loads buildings.json
- buildings.json: Building definitions
- portal/map-designer.html: Visual floor editor
