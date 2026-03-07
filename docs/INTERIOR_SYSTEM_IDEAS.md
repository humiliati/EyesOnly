# Interior System Ideas — Actionable Implementation Plan

> **Status:** Implementation Roadmap  
> **Last Updated:** 2026-03-07  
> **Canon:** [BUILDING_INTERIOR_SYSTEM.md](./BUILDING_INTERIOR_SYSTEM.md)

---

## 1. Floor Hierarchy (Canon-Aligned)

The interior system operates within the hierarchical floor ID scheme defined in BUILDING_INTERIOR_SYSTEM:

```
FloorN          — World floor (biome applies)
  └─ FloorN.N   — Building interior (interior biome applies)
       └─ FloorN.N.N — Nested interior / quest room
```

| Level | Name | Style Intent | Pattern Density |
|-------|------|-------------|----------------|
| N | World | Biome default | 10-20% |
| N.N | Building Interior | Cozy, composed scenes | 40-60% |
| N.N.N | Quest Interior | Dense setpiece | 70%+ |

---

## 2. Interior Biome System Extensions

### 2.1 Current Canon (BUILDING_INTERIOR_SYSTEM)

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

### 2.2 Extensions Needed

Add these designer-configurable properties to `interior-biomes.json`:

| Property | Type | Range | Default | Purpose |
|----------|------|-------|---------|---------|
| `zoomBias` | number | 1.0-1.5 | 1.2 | Camera zoom for cozy feel |
| `propDensity` | number | 0.1-1.0 | 0.5 | Props per tile |
| `floorPatternDensity` | number | 0.1-1.0 | 0.6 | Tile pattern frequency |
| `ambientSound` | string | — | "muffled" | Audio profile |
| `wallOcclusion` | boolean | — | true | Near-player wall fade |

### 2.3 Implementation Steps

**Step 2.3.1: Extend Schema**

In `interior-biomes.json`, add new fields:

```json
{
  "name": "INTERIOR_CHURCH",
  "zoomBias": 1.25,
  "propDensity": 0.55,
  "floorPatternDensity": 0.8,
  "ambientSound": "echo",
  "wallOcclusion": true,
  "floorTiles": [
    { "char": "╬", "weight": 60 },
    { "char": ".", "weight": 40 }
  ]
}
```

**Step 2.3.2: Portal Designer Integration**

Add these properties to `portal/interior-biome-designer.html` (or extend existing scene asset designer):

```html
<!-- Interior Biome Editor Panel -->
<div class="interior-props-panel">
  <label>Zoom Bias: <input type="range" min="1.0" max="1.5" step="0.05" v-model="biome.zoomBias"></label>
  <label>Prop Density: <input type="range" min="0.1" max="1.0" step="0.05" v-model="biome.propDensity"></label>
  <label>Floor Pattern: <input type="range" min="0.1" max="1.0" step="0.05" v-model="biome.floorPatternDensity"></label>
  <select v-model="biome.ambientSound">
    <option value="muffled">Muffled (default)</option>
    <option value="echo">Echo (church)</option>
    <option value="hum">Electrical Hum</option>
    <option value="silent">Silent</option>
  </select>
</div>
```

---

## 3. Structure Grammar System

### 3.1 Concept

Buildings should be generated from rules, not templates. Each structure type has a grammar that defines:

- **Symmetry** — Does the layout enforce bilateral symmetry?
- **Anchors** — Key objects that define room logic (altar → pews, workbench → scrap)
- **Prop Groups** — Auto-spawned props relative to anchors
- **Door Placement** — How doors align relative to structure

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

| Structure | Symmetry | Anchors | Prop Groups |
|-----------|----------|---------|-------------|
| church | true | altar, entrance | pews, candles |
| tavern | false | bar, entrance | tables, chairs |
| junkyard | false | workbench | scrap_piles, oil_stains |
| strip_mall | false | vendor_counter | shelves, displays |
| saloon | true | bar, piano | tables, doors |

### 3.4 Implementation Steps

**Step 3.4.1: Grammar Registry**

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

  return { register, getGrammar, generate };
})();
```

**Step 3.4.2: Anchor Resolution**

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

**Step 3.4.3: Prop Group Generation**

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

---

## 4. Implementation Roadmap

### Phase 1: Interior Biome Schema Extensions

| Task | File | Description |
|------|------|-------------|
| 1.1 | `interior-biomes.json` | Add zoomBias, propDensity, floorPatternDensity, ambientSound, wallOcclusion fields |
| 1.2 | `interior-floor-system.js` | Read new fields during biome resolution (step 5 in pipeline) |
| 1.3 | `gone-rogue-canvas.js` | Apply zoomBias to camera when entering interior |

**Estimated:** 2-3 hours

### Phase 2: Structure Grammar System

| Task | File | Description |
|------|------|-------------|
| 2.1 | `interior-grammar.js` | Create grammar registry and generation engine |
| 2.2 | `interior-floors.js` | Add `registerStructureGrammar()` API |
| 2.3 | `tutorial-floors.js` | Define initial grammars for church, tavern, junkyard |

**Estimated:** 4-6 hours

### Phase 3: Visual Compression

| Task | File | Description |
|------|------|-------------|
| 3.1 | `gone-rogue-canvas.js` | Implement zoom bias application |
| 3.2 | `lighting-system.js` | Apply interior light multiplier |
| 3.3 | `interior-floor-system.js` | Trigger door threshold events (lighting change on entry) |

**Estimated:** 2-3 hours

### Phase 4: Scene Asset Designer Rework

| Task | File | Description |
|------|------|-------------|
| 4.1 | `portal/scene-asset-designer.html` | Add multi-tile emoji tool (2x1, 1x2, 2x2, 3x3) |
| 4.2 | `scene-asset-designer.js` | Add anchor-relative positioning |
| 4.3 | `scene-asset-designer.js` | Add auto-propagation rules (e.g., "fill until wall") |
| 4.4 | `interior-grammar.js` | Bind scene assets to grammar propGroups |

**Estimated:** 6-8 hours (user-facing, prioritize last)

---

## 5. Integration Points

### With WORLD_BUILDING_ENGINE

- Interior biome selection happens during floor loading (BUILDING_INTERIOR_SYSTEM pipeline)
- Door contracts (WORLD_BUILDING_ENGINE §6) define entrance/exit positions
- Structure grammar generates interior layout around door positions

### With PROCEDURAL_GENERATION_DESIGN_IDEAS

- Prop density integrates with scalar field constraint system (Phase 3)
- Floor pattern density uses reaction-diffusion or voronoi patterns

### With SEED_DESIGN_CONSIDERATIONS

- Interior biome selection weighted by floor depth and biome configuration
- Hybrid seed system can mutate interior properties for run variety

---

## 6. Files Reference

| File | Purpose |
|------|---------|
| `interior-biomes.json` | Interior biome definitions (ADD: zoomBias, propDensity, etc.) |
| `interior-floor-system.js` | Enter/exit logic, biome resolution |
| `interior-floors.js` | Layout registry, grammar API |
| `interior-grammar.js` | **NEW** Structure grammar engine |
| `gone-rogue-canvas.js` | **MODIFY** Apply zoom bias |
| `gone-rogue.js` | Floor nav stack |
| `lighting-system.js` | **MODIFY** Interior light multiplier |
| `portal/interior-biome-designer.html` | **NEW** Designer for interior biome properties |
| `portal/scene-asset-designer.html` | **MODIFY** Multi-tile emoji support |

---

## 7. Dependencies

```
Phase 1 (Biome Schema)
    │
    ├─► Phase 2 (Grammar)
    │         │
    │         └─► Phase 4 (Scene Designer)
    │
    └─► Phase 3 (Visual Compression)
              │
              └─► Phase 4 (Scene Designer)
```

Phase 4 (Scene Asset Designer) is lowest priority and can be deferred until Phase 1-3 are stable.

---

**Document Version:** 1.0  
**Status:** Ready for implementation


Playtester / designer notes:





Whats the most elegant solution for rendering building interiors? In this Playtest problem statement we have the following recommendation: Problem: the building interiors on floor 1.2 , 1.3 feature just the biome walls, biome floor, instead of having their own size and dimension and color. The floors need to contrast gracefully from the walls inside buildings and the building interior space should be rather small focusing on composed scenes and coherent npc interactions. Instead of making the interior floor map x,y and more narrow make the biome parameters walls ~10 tiles thicker with an interior border of interior.biome walls along the biome parameter walls. Give each interior biome distinct comfy floors, like the church floor would be red with crosshairs for the tiles, the strip_mall would have lavender floors with slashes for tiles to look like herringbone, the junkyard would have alternating grassy and grey and brown floor tiles

The recommendation in your playtest note is directionally correct, but it’s solving the problem at the map geometry level. The most elegant solutions in games usually solve this at the rendering / tile-rule level, not by changing the map grid itself.

What you want is essentially:

Interiors that feel small and composed, while the world grid stays consistent.

The industry-standard elegant approach is usually one of these three systems (often combined).

1. Interior Overlay Layer (Most Elegant for Roguelikes)
Instead of shrinking the grid or thickening walls, treat interiors as a rendered overlay biome.

Concept

The world still uses the normal biome floor/walls.

When a tile is flagged interior = church or interior = strip_mall, the renderer swaps the tileset.

Rendering stack

World Floor
Interior Floor Override
Interior Props
Interior Walls
Lighting
NPCs
So a tile might be:

tile:
  biome: forest
  structure: church
  interior_floor: church_floor
  interior_wall: church_wall
Renderer resolves it like:

if structure:
    render interior_floor
else:
    render biome_floor
Benefits
Map size never changes

Interiors can have unique floors instantly

Designers don't fight the grid

NPC scenes are easy to compose

Example floors
Interior	Floor Pattern
church	red crosshair tiles
strip mall	lavender herringbone
junkyard shack	grass/dirt/metal alternating
saloon	dark plank
Exactly what you described.

2. Auto-Interior Border System
Your instinct about thicker walls is good — but you shouldn't manually do it.

Instead use auto-tiling borders.

When a building region is defined:

BBBBBBBBBBBB
BIIIIIIIIIB
BIIIIIIIIIB
BIIIIIIIIIB
BBBBBBBBBBBB
The engine automatically creates:

Biome Wall
Interior Wall
Interior Floor
Like:

[Biome wall][Interior wall][Interior floor]
So the perceived interior feels smaller and cozy, but the map grid never changed.

3. Scene Pods (Best for NPC Interaction)
You mentioned:

composed scenes and coherent npc interactions

This is where scene pods shine.

Instead of filling interiors with random tiles:

A building loads a scene template.

Example:

Church Scene Pod
Entrance
Pews
Altar
Priest NPC
Candle props
Strip Mall Pod
Food counter
Vendor NPC
Tables
Trash can
Poster
Junkyard Pod
Workbench
Scrap pile
Mechanic NPC
Oil stains
The building interior becomes a stage rather than a random room.

This massively improves vibe and storytelling.

4. Lighting Is the Secret Sauce
One trick used everywhere:

Interiors have darker walls + warmer floors.

Example:

biome walls: dark desaturated
interior floors: warm + patterned
Even with simple tiles this makes interiors pop.

5. The Most Elegant Combined System
The best architecture for your engine would be:

Map Data
tile.biome
tile.structure
tile.interior_type
Renderer Logic
if tile.structure:
    draw interior_floor[tile.interior_type]
    draw interior_walls
else:
    draw biome_floor
Scene System
structure loads scene template
Auto Border
structure edges spawn interior walls
No map resizing needed.

What Slay the Spire / Kenshi / Rimworld do
They all use tile overrides and scene pods, not map resizing.

Interior feel comes from:

tiles

lighting

props

NPC placement

not grid changes.

Recommendation for Your Engine
Implement these systems:

Interior biome override

Auto interior border

Scene pods

Interior lighting modifier

Then designers only write:

building: church
interior: church_biome
scene: small_congregation
And the engine handles the rest.

If you'd like
I can also show you a very clever trick used in Project Zomboid and Rimworld that makes interiors feel dramatically smaller and cozier without changing a single tile size.

It's one of the most elegant rendering hacks in games and would fit your engine extremely well.


How does project zomboid and rimworld make interiors feel smaller? How can it align with our existing zoomed in to fake a camera pan dual rendering dom canvas system? We also have a world building engine that glues floorsN , Building interiors floorsN.N , and nested procedural side quests building interiors and floor bypasses at floorsN.N.N all as separate maps with scene transitions 

Both  and  make interiors feel smaller and intimate using a combination of visual compression tricks, not by changing the actual map dimensions. Those tricks can integrate cleanly with your dual-canvas zoom/pan renderer and your floorsN / floorsN.N / floorsN.N.N map hierarchy.

I'll break this into three parts:

The tricks those games use

How they work perceptually

How to implement them in your current engine architecture

1. How Zomboid and RimWorld Fake Smaller Interiors
1. Interior Lighting Compression
Interiors are rendered darker and warmer than the outside world.

Typical pipeline:

World lighting
→ Interior light multiplier
→ Local light sources
Example values:

outside light: 1.0
interior ambient: 0.6
torch/candle radius: +0.4
Effect:

Edges of rooms fall into shadow

Player attention compresses toward the center

The brain interprets that as a smaller space.

2. Floor Pattern Density
Interiors use higher-frequency tile patterns.

Examples:

Exterior	Interior
grass blobs	tight wood planks
dirt	checkered tile
gravel	parquet
Because the eye counts more detail per tile, the brain reads the area as denser → smaller.

Your examples already match this idea:

church → red crosshair tiles

strip mall → lavender herringbone

junkyard → alternating patchwork

3. Wall Occlusion
Both games cheat by clipping or fading walls near the player.

In Zomboid:

walls in front of player → transparent
In RimWorld:

roof overlay hides walls until camera enters room
Effect:

You subconsciously perceive the room boundary closer to the player.

4. Prop Density
Interiors contain more props per tile:

chairs

shelves

crates

machines

Even if the room is 10×10 tiles, clutter makes it feel like 5×5 usable space.

5. Door Framing Trick
Doorways create visual thresholds.

When you pass a doorway, the renderer subtly changes:

color grading
ambient light
prop density
Your brain marks that as entering a new space, even if the tile grid is identical.

2. Why These Tricks Work
Humans judge room size by:

contrast
detail density
lighting falloff
visual barriers
Not by tile counts.

So a 12×12 interior can feel smaller than a 6×6 field if:

lighting is darker

floors have tight patterns

props are dense

edges are shadowed

3. How This Fits Your Engine
You described an engine with:

floorsN
floorsN.N
floorsN.N.N
and

dual canvas rendering
(fake camera pan zoom system)
This architecture actually makes these tricks very easy.

Interior Compression Layer
When a player enters a building:

world canvas: still renders biome edges
interior canvas: overlays interior styling
So the render stack becomes:

Canvas 1: world floor
Canvas 2: interior floor override
Canvas 3: props
Canvas 4: NPCs
Canvas 5: lighting
You already have the layering ability.

Interior Camera Bias
Your fake camera pan can subtly bias toward the room center.

Example:

exterior zoom: 1.0
interior zoom: 1.08
Just 8% zoom creates a cozy interior feel.

The player rarely notices.

Interior Lighting Mask
Generate a simple radial mask:

center brightness: 1.0
edges: 0.65
Applied only to floorsN.N.

Pseudo:

if map.depth > floorsN:
    applyInteriorMask()
Prop Density Pass
When spawning interiors:

tile fill rate:
outside = 10–20%
inside = 40–60%
Scene pods help here.

Example church pod:

pew pew pew pew
pew pew pew pew
altar candle
Door Threshold Event
When player crosses a door tile:

trigger:
interior_color_grade
ambient_change
zoom_bias
Even if the map transition is invisible, the brain reads entering a building.

Perfect Fit for Your Map Hierarchy
Your system:

floorsN           world
floorsN.N         building
floorsN.N.N       sidequest rooms
Recommended styling:

level	style
N	biome
N.N	cozy interior
N.N.N	dense setpiece
So a quest basement might have:

lighting: 0.5
prop density: 70%
tile pattern: highest frequency
That creates claustrophobic dungeon vibes.

One More Trick Zomboid Uses (Very Powerful)
Interior sound dampening.

Outside:

wind
ambient noise
music
Inside:

muffled audio
footsteps louder
Players instantly feel enclosed.

Even in 2D games this is incredibly effective.

My Recommendation for Your Engine
Add a small InteriorStyle object.

Example:

InteriorStyle {
    floorTiles
    wallTiles
    lightMultiplier
    propDensity
    zoomBias
    floorPatternDensity
}
Example:

church:
lightMultiplier: 0.7
zoomBias: 1.08
floorPattern: crosshair
propDensity: medium
✅ This keeps your map system unchanged
✅ Uses your dual canvas renderer
✅ Works with scene pods and procedural interiors

If you'd like, I can also show you a very clever trick used in roguelikes like Caves of Qud that makes interiors feel architecturally unique without increasing tile count at all — it's perfect for procedural towns like the one you're building.


How does caves of mud make interiors architecturally unique 

I assume you meant  (often mis-typed as “Caves of Mud”). Qud is a great reference because it achieves distinct architecture with extremely simple tiles. The trick is that uniqueness comes from generation rules, not art complexity.

Below are the main systems it uses and how they could map directly onto your floorsN / floorsN.N / floorsN.N.N scene architecture.

1. Shape Grammar Instead of Rectangles
Most roguelikes generate rooms like this:

########
#......#
#......#
########
Qud uses shape grammar — rooms are assembled from structural patterns rather than rectangles.

Example shapes:

pillar hall
###########
#..#...#..#
#..#...#..#
###########
courtyard
###########
#.........#
#...###...#
#.........#
###########
cross hall
###...###
..#...#..
..#####..
..#...#..
###...###
Even with the same tiles, the room silhouette changes.

Why this works
Players recognize shapes faster than tile textures.
So architectural identity comes from layout geometry.

2. Structural Motifs
Every faction or culture in Qud has motifs:

Examples:

culture	motif
Putus Templar	symmetry
Sultan ruins	courtyards
villages	central hearth
dungeons	offset corridors
Generation rule example:

if structure = church
    enforce axial symmetry
if structure = junkyard
    disable symmetry
    allow tile noise
This creates architecture that feels intentional.

3. Anchor Objects
Qud generates interiors around anchor props.

Instead of placing furniture randomly:

place altar
generate pew rows from altar
place furnace
spawn workstations around furnace
So objects define the room’s logic.

Your church example could be:

altar
↓
pew grid
↓
side candle rows
The layout writes itself.

4. Negative Space
Another Qud trick: unused space is meaningful.

Example:

###########
#.........#
#...###...#
#.........#
###########
That empty courtyard in the middle isn't filled with props.

This makes rooms feel intentional and architectural.

5. Door Alignment Rules
Qud places doors with rules like:

door opposite door
door centered
door offset
This subtly changes the flow of rooms.

Examples:

Symmetrical hall

###D#######
#.........#
D.........D
#.........#
#######D###
Crooked ruin

###D#######
#.........#
#......D..#
#.........#
###########
Same tiles — different personality.

6. Tile Noise
Qud uses controlled randomness.

Example junkyard floor:

grass dirt metal grass dirt
dirt metal dirt grass metal
This is generated with noise patterns like:

perlinNoise(tileX,tileY)
Result: floors look organic instead of tiled.

Your junkyard example fits perfectly here.

7. Multi-Tile Props
Another trick:

Some props occupy 2×2 or 3×3 tiles.

Example:

workbench
██
██
Or

altar
 ███
 ███
This breaks the grid illusion.

Rooms instantly feel designed.

8. Architectural Edges
Qud uses wall variants.

Instead of:

########
It mixes:

pillar wall pillar
Example:

#O###O###
#.......#
O.......O
#.......#
#O###O###
Where O = pillar.

That creates a sense of structure.

How This Fits Your Engine
Your hierarchy:

floorsN       town biome
floorsN.N     building
floorsN.N.N   quest interiors
Architecture should evolve across those levels.

floorsN (town)
Simple shapes:

rectangle buildings
small props
floorsN.N (interior)
Apply shape grammar + anchors.

Example church:

###########
#..PPP....#
#..PPP....#
#....A....#
###########
P = pew
A = altar

floorsN.N.N (quest interior)
Apply dramatic motifs.

Example cult basement:

###########
#...###...#
#..#...#..#
#..#.O.#..#
###########
O = ritual object.

Why This Works With Your Engine
Because your maps are separate scenes, each layer can use stronger rules.

Example pipeline:

world generator
→ building generator
→ interior grammar
→ quest modifier
So a normal tavern interior might become a smuggler hideout just by altering anchors.

The Single Most Powerful Trick
The biggest reason Qud interiors feel unique:

every building type has 3-5 layout templates.

Example tavern templates:

bar along wall
center bar
corner bar
L-shaped bar
Even that tiny change makes rooms feel handcrafted.

My Suggestion for Your Engine
Create a StructureGrammar system.

Example:

structure: church

grammar:
  symmetry: true
  anchors:
    altar: south wall
  props:
    pew_rows: 4
  door:
    centered
structure: strip_mall

grammar:
  symmetry: false
  anchors:
    vendor_counter
  props:
    tables: random
structure: junkyard_shack

grammar:
  noise_floor: true
  anchors:
    workbench
  props:
    scrap_piles
If you'd like
I can also show you a very powerful procedural trick used by Dwarf Fortress and Caves of Qud that generates infinite building layouts from just ~12 rules.

It would plug perfectly into your scene transition system and rogue sidequest interiors.


How does dwarf fortress generate infinite building layouts from just 12 rules 

 creates the feeling of infinite architectural variation by using a very small rule set applied recursively and contextually. The trick is not a giant library of rooms — it’s rules that mutate space.

Think of it as procedural grammar for architecture.

Below is the core concept distilled to roughly the ~12 structural rules that produce huge variety.

Core Idea
Instead of placing rooms, the generator performs operations on space.

Example:

start rectangle
→ divide
→ assign function
→ add anchors
→ distort
→ connect
Those operations repeat and combine.

The 12 Architectural Rules
1. Partition Space
Split a region into smaller regions.

###########
#.........#
#.........#
###########
↓

##### #####
#...# #...#
#...# #...#
##### #####
Simple binary space partitioning creates most layouts.

Rule:

if region > sizeThreshold
    split horizontal or vertical
2. Assign Room Function
Each partition receives a purpose tag.

Example:

kitchen
bedroom
storage
hall
The tag determines later decoration.

3. Create a Circulation Spine
Buildings generate a main corridor or flow axis.

Example:

###########
#..#.#.#..#
#..#.#.#..#
###########
The corridor connects rooms logically.

Without this rule buildings feel random.

4. Place Anchors
Each room type has a primary object.

Examples:

room	anchor
church	altar
tavern	bar
smith	forge
junkyard	workbench
Room layout forms around the anchor.

5. Door Alignment
Doors follow patterns.

Example rules:

center door
offset door
opposite door
corner door
Different door logic drastically changes navigation.

6. Edge Thickening
Exterior walls become structural boundaries.

Example:

###
#.#
###
↓

#####
##.##
##.##
#####
This creates a sense of structure and insulation.

You already suggested something similar in your playtest note.

7. Symmetry Toggle
Some structures enforce symmetry.

Example:

Church:

###...###
#.......#
#.......#
###...###
Junkyard:

###..####
#.......#
##....#.#
#########
One boolean dramatically changes architecture.

8. Pillar Injection
Large rooms get structural supports.

Example:

###########
#.........#
#.........#
###########
↓

###########
#..#...#..#
#..#...#..#
###########
Adds visual complexity without new tiles.

9. Noise Distortion
Slight irregularity is applied.

Example:

rectangle room
↓

corner notch
missing tile
jagged wall
This avoids perfect geometry.

10. Prop Density Pass
Rooms receive props based on type.

Example:

type	density
tavern	high
temple	medium
warehouse	low
Density creates perceived scale.

11. Threshold Marking
Transitions get markers:

door frames
arches
steps
carpets
These visually divide spaces.

12. Iterative Mutation
The system runs multiple passes.

Example:

pass 1: partition
pass 2: anchors
pass 3: corridors
pass 4: distortion
pass 5: props
Small randomness in each pass multiplies variation.

Why This Creates Infinite Layouts
The number of combinations grows explosively.

Example rough count:

partition patterns ~20
room assignments ~30
door placements ~10
anchor positions ~10
noise patterns ~20
Total combinations:

20 × 30 × 10 × 10 × 20
= 1,200,000 layouts
And that’s with extremely simple rules.

How This Fits Your Engine
Your hierarchy:

floorsN       world
floorsN.N     building interior
floorsN.N.N   quest interior
Each level can apply more rules.

floorsN
Basic partitioning.

Example:

town blocks
building footprints
floorsN.N
Apply interior architecture rules.

Example church:

symmetry = true
anchor = altar
pillar injection = allowed
floorsN.N.N
Add mutation layers.

Example cult basement:

symmetry = broken
noise distortion = high
prop density = extreme
The room becomes a unique dungeon.

How This Fits Your Dual Canvas Renderer
Your rendering stack could be:

Canvas 1: base tiles
Canvas 2: structure geometry
Canvas 3: props
Canvas 4: NPCs
Canvas 5: lighting
The architecture generator only affects:

structure geometry
prop placement
Rendering stays simple.

Why This System Is Elegant
Because designers only define rules, not rooms.

Example:

church:
  symmetry: true
  anchor: altar
  pillars: yes
junkyard shack:
  symmetry: false
  noise: high
  anchors: workbench
From that, the engine creates endless layouts.

The Trick Used by Modern Roguelikes
Games like  and  extend this with a powerful addition:

architectural “verbs” instead of templates.

Example verbs:

split
mirror
shift
carve
decorate
ruin
A building becomes a sequence of verbs.