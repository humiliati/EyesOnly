# Interior System — Actionable Implementation Plan

> **Status:** Implementation Roadmap
> **Last Updated:** 2026-03-07
> **Canon:** [BUILDING_INTERIOR_SYSTEM.md](./BUILDING_INTERIOR_SYSTEM.md)
> **Cross-References:** [NPC_CANON.md](./NPC_CANON.md), [BIOME_SYSTEMS.md](./BIOME_SYSTEMS.md), [WORLD_BUILDING_ENGINE.md](./WORLD_BUILDING_ENGINE.md)

---

## 1. Floor Hierarchy (Canon-Aligned)

The interior system operates within the hierarchical floor ID scheme defined in BUILDING_INTERIOR_SYSTEM:

```
FloorN          — World floor (biome applies)
  └─ FloorN.N   — Building interior (interior biome applies)
       └─ FloorN.N.N — Nested interior / quest room
```

| Level | Name | Style Intent | Pattern Density | Lighting | Zoom |
|-------|------|-------------|----------------|----------|------|
| N | World | Biome default | 10-20% | 1.0 | 1.0 |
| N.N | Building Interior | Cozy, composed scenes | 40-60% | 0.6-0.8 | 1.08-1.15 |
| N.N.N | Quest Interior | Dense setpiece | 70%+ | 0.4-0.6 | 1.12-1.25 |

**Key insight (from Zomboid/Rimworld analysis):** Humans judge room size by contrast, detail density, lighting falloff, and visual barriers — not by tile counts. A 12×12 interior feels smaller than a 6×6 field if lighting is darker, floors have tight patterns, props are dense, and edges are shadowed.

---

## 2. Visual Compression System

The engine makes interiors feel small and intimate without changing the actual map grid. Five rendering tricks combine:

### 2.1 Interior Lighting Compression

When entering a building, apply a radial lighting mask:

```
center brightness: 1.0
edges: 0.65
```

Applied only to FloorN.N and deeper. The player's attention compresses toward the center — the brain reads a smaller space.

**Implementation:** In `lighting-system.js`, when `InteriorFloorSystem.isInteriorFloor(floorId)` is true, apply `interiorBiome.darknessMultiplier` (already implemented) PLUS a new radial falloff mask from center outward.

### 2.2 Floor Pattern Density

Interior biomes use higher-frequency tile patterns than world biomes:

| Interior | Floor Pattern | Character |
|----------|--------------|-----------|
| Church | Red crosshair tiles | `╬` |
| Tavern | Dark wood planks | `═` |
| Strip Mall | Lavender herringbone | `/` |
| Junkyard | Grass/dirt/metal alternating | mixed |
| Saloon | Dark plank | `│` |

The eye counts more detail per tile → the brain reads the area as denser → smaller.

**Implementation:** Already partially in `interior-biomes.json` via `floorTiles` arrays with weighted characters. Extend with `floorPatternDensity` to control how many tiles use the patterned character vs plain floor.

### 2.3 Wall Occlusion

Walls near the player fade or clip. In Zomboid, walls in front of the player become transparent. In Rimworld, roof overlay hides walls until the camera enters the room.

**Implementation:** In `gone-rogue-canvas.js`, when rendering interior floors, fade wall tiles that are between the player and the camera (south/east walls). Use alpha blending: walls within 2 tiles of player at `opacity: 0.3`, walls 3-4 tiles at `opacity: 0.6`.

### 2.4 Prop Density

Interiors contain more props per tile than world floors. Even if a room is 10×10, clutter makes it feel like 5×5 usable space.

| Floor Level | Fill Rate |
|-------------|-----------|
| World (N) | 10-20% |
| Interior (N.N) | 40-60% |
| Quest (N.N.N) | 70%+ |

**Implementation:** `propDensity` field on interior biome controls scatter pass in `interior-grammar.js` (see §3).

### 2.5 Door Threshold Events

When the player crosses a door tile, the renderer subtly changes color grading, ambient light, and zoom bias. The brain marks this as entering a new space even if the tile grid is identical.

**Implementation:** In `interior-floor-system.js`, `enterInteriorFloor()` already triggers visual cache rebuild and lighting change. Add `zoomBias` application to `gone-rogue-canvas.js` camera system.

### 2.6 Interior Camera Bias

The fake camera pan subtly zooms in for interiors:

```
exterior zoom: 1.0
interior zoom: 1.08-1.15
```

Just 8% zoom creates a cozy feel. The player rarely notices.

**Implementation:** Add `zoomBias` field to `interior-biomes.json`. Apply in `gone-rogue-canvas.js` when entering interior floors.

---

## 3. Structure Grammar System

### 3.1 Concept

Buildings are generated from rules, not templates. This is the key insight from Caves of Qud and Dwarf Fortress — every building type has 3-5 layout variations generated from a grammar, making rooms feel handcrafted even though they're procedural.

Each structure type has a grammar that defines:

- **Symmetry** — Does the layout enforce bilateral symmetry?
- **Anchors** — Key objects that define room logic (altar → pews, forge → anvil)
- **Prop Groups** — Auto-spawned props relative to anchors
- **Door Placement** — How doors align relative to structure (centered, offset, opposite)
- **Noise Tolerance** — How much random distortion applies (junkyard high, church low)

### 3.2 Grammar Schema

Designer-configurable via portal:

```javascript
// Structure Grammar (JSON in portal)
{
  "structure": "church",
  "grammar": {
    "symmetry": true,
    "anchors": {
      "altar": { "position": "south_wall", "required": true },
      "entrance": { "position": "center_north", "required": true }
    },
    "propGroups": [
      {
        "name": "pews",
        "anchor": "altar",
        "direction": "north",
        "spacing": 2,
        "until": "entrance"
      },
      {
        "name": "candles",
        "anchor": "entrance",
        "direction": "south",
        "count": 4,
        "random": true
      }
    ],
    "doorPlacement": "centered",
    "noiseTolerance": 0.2
  }
}
```

### 3.3 Supported Structures

| Structure | Symmetry | Anchors | Prop Groups | Noise |
|-----------|----------|---------|-------------|-------|
| church | true | altar, entrance | pews, candles | low |
| tavern | false | bar, entrance | tables, chairs, fireplace | medium |
| junkyard | false | workbench | scrap_piles, oil_stains | high |
| strip_mall | false | vendor_counter | shelves, displays | low |
| saloon | true | bar, piano | tables, doors | medium |
| forge | false | forge, anvil | tool_rack, coal_pile | low |
| house | false | stove, bed | table, cupboard | medium |
| office | true | desk | shelf, filing_cabinet | low |

### 3.4 Shape Grammar (from Caves of Qud)

Instead of generating rectangles, the grammar produces structural patterns:

**Pillar Hall:**
```
###########
#..#...#..#
#..#...#..#
###########
```

**Courtyard:**
```
###########
#.........#
#...###...#
#.........#
###########
```

**Cross Hall:**
```
###...###
..#...#..
..#####..
..#...#..
###...###
```

Players recognize shapes faster than tile textures. Architectural identity comes from layout geometry.

### 3.5 Implementation Steps

**Step 3.5.1: Grammar Registry**

Create `public/js/interior-grammar.js`:

```javascript
var StructureGrammar = (function() {
  var _grammars = {};

  function register(structureType, grammar) {
    _grammars[structureType] = grammar;
  }

  function getGrammar(structureType) {
    return _grammars[structureType] || _grammars['default'];
  }

  function generate(structureType, bounds, options) {
    var grammar = getGrammar(structureType);
    if (!grammar) return null;
    return _applyGrammar(grammar, bounds, options);
  }

  return { register: register, getGrammar: getGrammar, generate: generate };
})();
```

**Step 3.5.2: Anchor Resolution**

```javascript
function _resolveAnchors(grammar, bounds) {
  var anchors = {};
  for (var key in grammar.anchors) {
    var spec = grammar.anchors[key];
    anchors[key] = _positionFromSpec(spec, bounds);
  }
  return anchors;
}
```

**Step 3.5.3: Prop Group Generation**

```javascript
function _generatePropGroups(grammar, anchors) {
  var props = [];
  for (var i = 0; i < grammar.propGroups.length; i++) {
    var group = grammar.propGroups[i];
    var anchorPos = anchors[group.anchor];
    var positions = _propagateFromAnchor(anchorPos, group);
    props.push({ group: group.name, positions: positions });
  }
  return props;
}
```

**Step 3.5.4: Symmetry + Noise Pass**

After anchor and prop placement, apply symmetry enforcement (mirror across axis) and noise distortion (random corner notches, missing tiles, jagged walls) controlled by `noiseTolerance`.

---

## 4. The 12 Procedural Interior Rules

These rules (derived from Dwarf Fortress / Rimworld analysis) generate infinite interior layouts from a small rule set. The generator performs operations on space — partition, assign, connect, decorate — rather than placing rooms directly.

### Rule 1: The Anchor Rule
Every interior contains one anchor node that defines the building's purpose. NPCs whose job relates to the anchor spawn near it.

`forge → blacksmith NPC, stove → granny NPC, bar → bartender NPC`

### Rule 2: The Door Gravity Rule
All interiors begin with a door node. NPC pathing radiates from the door. NPCs periodically path toward doors, preventing static interiors.

### Rule 3: The Flow Rule
Every room must have two connections (enter + exit). Single-connection rooms become storage/closets and spawn loot instead of NPCs.

### Rule 4: The Triangle Rule
Most interiors resolve into three functional zones: **public** (entry table), **work** (stove/forge), **private** (bed/safe). NPCs spawn based on zone type.

### Rule 5: The Anchor Orbit Rule
Functional furniture forms orbits around the anchor:
```
forge (anchor)
  ├ anvil
  ├ tool rack
  └ coal pile
```
NPC pathing loops between these nodes, creating natural idle movement.

### Rule 6: The Service Corridor Rule
When rooms exceed 3 nodes, generate a service path (hallway). Hallways become NPC crossing points — good for guards, messengers, servants.

### Rule 7: The Occupancy Rule
Each room has NPC capacity based on size: tiny (0-1), small (1), medium (1-2), large (3-5). NPC density emerges from room size alone. See [NPC_CANON.md](./NPC_CANON.md) Part 7 for full density table.

### Rule 8: The Furniture Node Rule
Furniture nodes define possible NPC interactions. NPCs spawn only if a compatible furniture node exists:
`no stove → no cook, no desk → no clerk, no forge → no blacksmith`

### Rule 9: The Path Loop Rule
Every NPC has a minimum 2-node loop (granny: stove↔bed, smith: forge↔anvil, guard: door→hall→door). See [NPC_CANON.md](./NPC_CANON.md) Part 3 for pathing archetypes.

### Rule 10: The Social Gravity Rule
NPCs cluster at interaction nodes: tables, bars, fires, benches. These nodes support multi-NPC gatherings.

### Rule 11: The Privacy Gradient Rule
Interiors transition: **public → semi-private → private**. NPC types spawn accordingly: public (strangers), semi (residents), private (owner).

### Rule 12: The Narrative Node Rule
Every interior must contain one narrative node supporting: quest, shop, minigame, rumor, or stat encounter. This guarantees every building is meaningful.

**Implementation:** These rules are applied as sequential passes in `interior-grammar.js`:
1. Partition space (BSP)
2. Apply anchor rule
3. Apply triangle/zone rule
4. Generate corridors (flow + service)
5. Place furniture nodes
6. Spawn NPCs from archetypes (→ NPC_CANON pipeline)
7. Apply narrative node rule (ensure ≥1 interaction)

---

## 5. Interior Biome Schema Extensions

### 5.1 Current Canon (BUILDING_INTERIOR_SYSTEM)

Each interior biome in `interior-biomes.json` already supports:

```json
{
  "name": "The Hound's Tooth Pub",
  "lightingProfile": "TAVERN_WARM",
  "darknessMultiplier": 0.8,
  "wallTiles": [{ "char": "█", "weight": 40 }],
  "floorTiles": [{ "char": ".", "weight": 55 }]
}
```

### 5.2 Extensions Needed

Add these designer-configurable properties to `interior-biomes.json`:

| Property | Type | Range | Default | Purpose |
|----------|------|-------|---------|---------|
| `zoomBias` | number | 1.0-1.5 | 1.2 | Camera zoom for cozy feel |
| `propDensity` | number | 0.1-1.0 | 0.5 | Props per tile |
| `floorPatternDensity` | number | 0.1-1.0 | 0.6 | Tile pattern frequency |
| `ambientSound` | string | — | "muffled" | Audio profile |
| `wallOcclusion` | boolean | — | true | Near-player wall fade |

### 5.3 Implementation Steps

**Step 5.3.1: Extend Schema** — Add new fields to `interior-biomes.json` entries.

**Step 5.3.2: Read in runtime** — Update `interior-floor-system.js` to read and apply `zoomBias`, `propDensity`, `wallOcclusion` during biome resolution (step 5 in pipeline).

**Step 5.3.3: Portal Designer** — Add sliders/dropdowns to scene asset designer or a new interior biome editor panel.

---

## 6. Multi-Tile Props

Some props occupy 2×2 or 3×3 tiles, breaking the grid illusion and making rooms feel designed:

| Prop | Size | Used In |
|------|------|---------|
| Workbench | 2×2 | Forge, Junkyard |
| Altar | 2×3 | Church |
| Bar counter | 1×4 | Tavern |
| Bed | 1×2 | House, Inn |
| Table | 2×2 | Tavern, Office |

**Implementation:** Extend `scene-asset-designer.html` with multi-tile emoji tool (2×1, 1×2, 2×2, 3×3). Port the scene portal emoji stacker for multi-tile rendering in `gone-rogue-canvas.js`.

---

## 7. Architectural Edge Variations

Walls use variants to create structural identity:

| Edge Type | Pattern | Used For |
|-----------|---------|----------|
| Pillar wall | `#O###O#` | Churches, halls |
| Double-thick | `##...##` | Fortified buildings |
| Windowed | `#.#.#.#` | Shops, houses |
| Ruined | `#..##.#` | Abandoned buildings |

**Implementation:** The grammar's `noiseTolerance` + a wall variant selector determines edge style. Applied during the structure generation pass in `interior-grammar.js`.

---

## 8. Implementation Roadmap

### Phase 1: Interior Biome Schema Extensions ⬜

| Task | File | Description |
|------|------|-------------|
| 1.1 | `interior-biomes.json` | Add zoomBias, propDensity, floorPatternDensity, ambientSound, wallOcclusion |
| 1.2 | `interior-floor-system.js` | Read new fields during biome resolution (step 5 in pipeline) |
| 1.3 | `gone-rogue-canvas.js` | Apply zoomBias to camera when entering interior |

**Estimated:** 2-3 hours

### Phase 2: Structure Grammar System ⬜

| Task | File | Description |
|------|------|-------------|
| 2.1 | `interior-grammar.js` | Create grammar registry + 12-rule generation engine |
| 2.2 | `interior-floors.js` | Add `registerStructureGrammar()` API |
| 2.3 | `tutorial-floors.js` | Define initial grammars for church, tavern, forge, house |
| 2.4 | `interior-grammar.js` | Implement BSP + anchor + corridor passes |
| 2.5 | `interior-grammar.js` | Wire NPC spawning from furniture nodes (→ NPC_CANON pipeline) |

**Estimated:** 6-10 hours

### Phase 3: Visual Compression ⬜

| Task | File | Description |
|------|------|-------------|
| 3.1 | `gone-rogue-canvas.js` | Implement zoom bias application |
| 3.2 | `lighting-system.js` | Apply radial interior light mask |
| 3.3 | `gone-rogue-canvas.js` | Wall occlusion (alpha fade for near-player walls) |
| 3.4 | `interior-floor-system.js` | Trigger door threshold events (lighting + zoom on entry) |

**Estimated:** 3-4 hours

### Phase 4: Multi-Tile Props & Edge Variations ⬜

| Task | File | Description |
|------|------|-------------|
| 4.1 | `portal/scene-asset-designer.html` | Add multi-tile emoji tool (2×1, 1×2, 2×2, 3×3) |
| 4.2 | `scene-asset-designer.js` | Add anchor-relative positioning |
| 4.3 | `gone-rogue-canvas.js` | Multi-tile prop rendering |
| 4.4 | `interior-grammar.js` | Wall variant selector + pillar injection |

**Estimated:** 6-8 hours

---

## 9. Integration Points

### With NPC_CANON

- Structure grammar generates furniture nodes → NPC spawning uses furniture node rule (§4 Rule 8)
- Anchor positions define NPC pathing loops (§4 Rule 9)
- Room zones (public/work/private) determine NPC type spawning (§4 Rule 11)
- Occupancy rule feeds NPC density limits from room size (§4 Rule 7)
- Full NPC stamping pipeline: [NPC_CANON.md](./NPC_CANON.md) Part 6

### With BUILDING_INTERIOR_SYSTEM

- Interior biome selection happens during floor loading (BUILDING_INTERIOR_SYSTEM pipeline)
- Door contracts (WORLD_BUILDING_ENGINE §6) define entrance/exit positions
- Structure grammar generates interior layout around door positions

### With BIOME_SYSTEMS

- Interior biome visual data (12 biomes in `interior-biomes.json`) drives wall/floor tile selection
- Lighting profiles from biome data control the lighting compression pass
- Prop lists from biome data seed the prop density pass

### With PROCEDURAL_GENERATION_DESIGN_IDEAS

- Prop density integrates with scalar field constraint system (Phase 3 of proc gen roadmap)
- Floor pattern density could use reaction-diffusion noise for organic tile variation
- The structure grammar's noise tolerance maps to the pattern engine's distortion parameters

### With WORLD_BUILDING_ENGINE

- Structure grammars register with the WBE Floor Resolver
- Building type selection from `buildings.json` determines which grammar applies
- The WBE validation layer verifies grammar output meets door contract and NPC invariants

---

## 10. Files Reference

| File | Status | Purpose |
|------|--------|---------|
| `interior-biomes.json` | ✅ EXISTS | Interior biome definitions (EXTEND: zoomBias, propDensity, etc.) |
| `interior-floor-system.js` | ✅ EXISTS | Enter/exit logic, biome resolution |
| `interior-floors.js` | ✅ EXISTS | Layout registry, grammar API |
| `interior-grammar.js` | ⬜ NEW | Structure grammar engine + 12-rule generation |
| `gone-rogue-canvas.js` | ⬜ MODIFY | Apply zoom bias, wall occlusion, multi-tile props |
| `gone-rogue.js` | ✅ EXISTS | Floor nav stack |
| `lighting-system.js` | ⬜ MODIFY | Interior radial light mask |
| `portal/scene-asset-designer.html` | ⬜ MODIFY | Multi-tile emoji support |

---

## 11. Dependencies

```
Phase 1 (Biome Schema Extensions)
    │
    ├─► Phase 2 (Structure Grammar)
    │         │
    │         └─► Phase 4 (Multi-Tile Props)
    │
    └─► Phase 3 (Visual Compression)
              │
              └─► Phase 4 (Multi-Tile Props)
```

Phase 2 (Structure Grammar) is the highest priority — it enables proc gen NPC spawning from [NPC_CANON.md](./NPC_CANON.md) Phase D.

Phase 4 (Multi-Tile Props) is lowest priority and can be deferred until Phases 1-3 are stable.

---

**Document Version:** 2.0
**Status:** Actionable roadmap — all phases pending, Phase 1 next
