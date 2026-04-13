# Blockout Visualizer — Engine Roadmap

Current state (v0.2, April 2026): visualizer with paint, lasso, resize, full/diff export, all-tile picker.
Reference frame: what a level designer coming from Tiled, Ogmo, Unity Tilemaps, Unreal, or a AAA in-house
editor would expect to find when they sit down at this tool.

This document is organized by **designer expectation tier** — not by implementation difficulty. Tier 1 is
"a working editor should obviously have this." Tier 4 is "this is specific to Dungeon Gleaner and
differentiates us from a generic tile editor."

---

## Phase 3 — Schema extraction (next up)

The immediate blocker before expanding the editor meaningfully. Right now the tool embeds a 77-entry
TILE_SCHEMA copy-pasted from `engine/tiles.js`. Every time `tiles.js` changes, the visualizer drifts.

- Parse `engine/tiles.js` in `extract-floors.js` and emit the schema into `floor-data.json`
- Pull category, walkability, opacity, door/freeform/floating predicates from source
- Include `isDoor()`, `isFreeform()`, `isFloating()` results so the editor can enforce constraints
- Load `data/cards.json`, `data/strings/en.js` for entity and display name resolution
  *(Decision: yes — emit as three separate schema sections: tile schema is mandatory; card manifest
  and string index are lazy-loaded enrichment for entity and metadata panels)*
- Surface builder metadata (`shops`, `spawn`, `doorTargets`, `doorFaces`, `biome`) as editable fields

Until this lands, any new tile added to the game is invisible to the tool.

---

## Tier 1 — Table stakes for a tile editor

What a designer will look for in the first ten minutes and be confused if it's missing.

### Drawing tools

- **Rectangle fill** — drag a box, release to fill with the paint tile (solid or outline mode)
- **Flood fill / bucket** — click a cell, fill all connected same-tile cells
- **Line tool** — click-drag to paint a straight line between two cells (Bresenham)
- **Brush size** — 1×1, 2×2, 3×3, 5×5 square brushes (modifier key or picker)
- **Replace-all-of-type** — select a tile ID, one-click replace every instance on the floor

### Selection improvements

- **Magic wand** — select all contiguous tiles of the same type (for moving a whole room, a whole path)
- **Select-by-tile** — select every instance of a tile ID, floor-wide
- **Invert selection**, **shrink/grow** by N cells, **select all**
- **Multi-rectangle selection** (shift+drag adds to selection)
- **Floating selection clipboard** — cut/copy/paste regions between floors
- **Cross-floor copy-paste** — lasso or select a region on floor N, switch to floor N.N, paste the
  captured tile group onto the target grid at an arbitrary position. The clipboard survives floor
  switches. This is the primary workflow for building window-scene exteriors: copy the street / trees /
  buildings from the parent exterior floor and paste them into the sub-grid outside a building's
  window on the interior floor, instead of recreating the exterior by hand. See also the Tier 4
  window-scene editor for the dedicated panel variant of this workflow.

### History

- **Redo** (Ctrl+Shift+Z / Ctrl+Y) — we only have undo right now
- **History panel** — scrollable list of operations with timestamps, click any entry to jump to that state
- **Named checkpoints** — manual save points the designer labels ("before door rework")

### View

- **Minimap** — small overview in a corner, click to jump, draggable viewport rect
- **Jump to coordinates** — text input, tile-snap camera
- **Bookmarks** — named camera positions per floor
- **Measure tool** — click two cells, show grid distance and Manhattan distance
- **Show cursor crosshair** across full row/column for alignment

### Keyboard discoverability

- **Shortcut cheatsheet overlay** (press `?` to show)
- **Customizable shortcuts** (probably defer — vanilla keymap is fine for now)

---

## Tier 2 — Professional expectations

Features found in every mature 2D level editor. Missing these makes the tool feel like a prototype.

### Layers

- **Logical tile layers**: terrain / structure / furniture / entities / lighting / freeform / floating
- **Per-layer visibility + lock toggles** — see the roof separately, lock terrain while editing furniture
- **Per-layer opacity slider** — fade structure to see terrain beneath
- **Layer reorder** via drag
- **Active layer indicator** — new paint goes to the active layer
- The current numeric grid becomes a *composite view* of layer stacks; export collapses back to grid

*(Decision: keep the flat `grid[y][x]` and synthesize layers at display time. The engine's tile
predicates — `isDoor()`, `isFloating()`, `isFreeform()`, `isCrenellated()`, `isWindow()`,
`isTorch()` — already encode enough category information to bucket tiles into virtual layers. A
`categoryOf(tileId)` function derived from the Phase 3 schema extraction lets the editor render
per-layer visibility/opacity/lock toggles without touching the data format. The one limitation —
inability to stack e.g. a torch ON a wall — is already solved by the engine placing torches as
separate adjacent tiles, not stacked in the same cell.)*

### Named brushes / stamps

- **Save selection as a brush** — multi-cell patterns with a name and thumbnail
- **Brush library panel** — categorize ("building corner NE", "6×4 stall", "cathedral window")
- **Paint with a stamp** — click to place, rotation modifier keys
- **Random variant brush** — paint grass with 10% flower, 5% rubble; configurable weights
- **Ship default brushes** derived from existing floors (door frames, pod corners, pergola runs)

### Auto-tiling / Wang tiles

- **Terrain brush** — paint a "road" region, corners auto-place ROAD + PATH shoulder + grass transitions
- **Wall corner autofill** — paint a rectangle border, corners resolve to the right wall variant
- **Rule tiles** — if you paint tile X with tile Y to the north, substitute tile Z

For DG this could encode patterns like: "if ARCH_DOORWAY is placed, auto-populate adjacent tiles with
the required road, pillar stubs, and back-face tile."

### Validation

- **Walkability check** — flood-fill from spawn, flag unreachable walkable tiles in red
- **Door contract validation** — every DOOR has a `doorTargets` entry, target floor exists, target floor
  has an inbound door
- **Spawn validity** — spawn on a walkable tile, not blocked by entities
- **Missing required tiles** — e.g. floor "0" must have a SPAWN, exterior floors must have ARCH_DOORWAY pairs
- **Heatmaps**: distance from spawn, distance from nearest door, lighting coverage, line-of-sight
  from key tiles

### File integration

- **Direct file write** — skip the copy-paste step; write directly to `floor-blockout-*.js` with a
  confirmation diff preview
- **Git diff preview panel** — see the pending change as a unified diff before committing
- **Watch mode** — hot-reload `floor-data.json` on disk change
- **Autosave** draft state to localStorage (with the caveat that CLAUDE.md rules out `localStorage` in
  artifacts — but this is a dev tool, not an artifact, so it's fair game)

---

## Tier 3 — The difference between a tool and a platform

### Per-floor metadata editor

All the fields around the grid — not just the grid itself.

- **Rooms array editor** — draw a rect, name it, set `cx/cy`; optional tags (shop, bedroom, hall)
- **Door targets map editor** — click a door tile, dropdown to pick target floor
- **Door faces editor** — click a door tile, pick exterior face direction (N/E/S/W)
- **Shops array editor** — position + shop type
- **Spawn drag** — pick up the spawn marker and drop it somewhere new
- **Biome picker** — per-floor biome assignment affecting texture atlas and fog config
- **Spatial contract inspector** — read-only view of the frozen `SpatialContract.*` for this floor depth

### Entity + decoration layer

The grid holds static tiles. Real level design needs dynamic content on top.

*(Decision: entities live in a parallel entities array, not in the grid. The grid keeps marker tiles
like SPAWN, SHOP, BONFIRE, CHEST — they tell the engine "an entity system should do something here."
The actual identity and properties (which NPC, what loot table, which enemy card ID) live in a
lightweight `entities` array alongside the grid in `floor-data.json`. The visualizer renders entities
as an overlay layer — one of the synthesized layers from the Layers decision above.)*

- **Entity palette** — NPCs, enemies (by card ID), loot spawns, trigger volumes, dialogue zones
- **Drag-drop entity placement** — not grid-snapped necessarily
- **Entity inspector** — properties panel for the selected entity
- **Link tool** — draw arrows between entities to express relationships (patrol path, trigger link)
- **Loot table picker** — click a CHEST, assign a loot table by ID

### 3D preview

This is the killer feature for DG specifically.

*(Decision: sibling iframe first, mini raycast deferred. Point an iframe at
`index.html?floor=<id>&camera=<x>,<y>,<dir>&editor=true` — the designer sees the exact rendered
output of the real engine, not an approximation. The mini raycast inset comes later as a lightweight
~200×150 preview for quick feedback without the iframe's full load time.)*

- **Mini raycast window** — 200×150 inset showing first-person view from a "camera tile"
- **Click-drag camera tile** — move the preview around the grid
- **Face direction** — click-drag to rotate preview heading
- **Vertical slice** — preview wall heights, tile height offsets (the Doom-rule step visualization)
- **Texture preview toggle** — swap flat tile colors for actual rendered wall textures
- **Fog preview** — render with the active SpatialContract fog
- **Sun position slider** — time-of-day preview for exterior floors

### Collaboration + handoff

- **Annotations** — pin a note to a cell or a region ("Tarek's house interior pending")
- **TODO markers** — special tile annotations that list in a sidebar
- **Change summary** — generate a written summary of edits since last save (for commit messages)
- **Designer/programmer handoff mode** — export a spec document showing what tiles/doors were touched,
  which need engineering work (new tile ID, new contract)

---

## Tier 4 — Dungeon Gleaner specific

Features that only make sense because of how DG's engine works. These are the differentiators — no
generic editor has these.

### Window-scene editor (the thing that started this conversation)

When a window tile (`WINDOW_TAVERN`) is placed on an interior floor, the raycaster needs something to
render *beyond* the window. The current engine doesn't model this. The editor should:

- **Detect window tiles** on depth-2 interior floors
- **Open a window-scene panel** — a small separate grid (say 8×6) that represents what's visible
  outside that window
- **Borrow tiles from floor N** (the parent exterior) as a starting palette
- **Allow any tile** regardless of depth, because this is a *visual facade*, not a walkable space
- **Export as a named sub-grid** that the raycaster can look up at render time
- **Preview alignment** — the window-scene panel renders adjacent to the window position so the
  designer sees the intended sightline
- **Cross-floor paste shortcut** — from the window-scene panel, a "Paste from…" button opens
  the parent exterior floor in a side-by-side view, lets the designer lasso the relevant region
  (the street outside the building, surrounding trees, neighboring structures), and pastes it
  directly into the window-scene sub-grid. This is the guided version of the Tier 1 cross-floor
  copy-paste — same clipboard mechanism, but with the source floor pre-selected and the paste
  target constrained to the window-scene bounds. The designer shouldn't have to eyeball which
  tiles sit outside a building's window; the panel should highlight the parent floor's tiles
  that align with the window's world-space position and facing direction.

Same pattern for PORTHOLE, ARCH_DOORWAY back-faces, and any "see-through" tile.

### Tile height offset editor

CLAUDE.md documents the Doom-rule tile height system: each transition tile renders vertically
displaced from the floor plane per the `tileHeightOffsets` contract. Right now these values are
frozen in `SpatialContract` constants.

- **Per-cell height offset override** — click a cell, enter an offset (-0.3 to +0.3)
- **Visual indicator** — raised/sunken tiles rendered with a shadow stripe
- **Preview in 3D** — the mini raycast shows the offset in perspective
- **Step color editor** — per-contract step fill color
- **Bulk apply** — "all DOOR_FACADE on this floor get +0.15"

### DOOR_FACADE recess visualization

Wolfenstein-style thin-wall offset is invisible in a top-down ASCII view. The editor should:

- **Draw the recess depth** as a chevron or inset stripe on DOOR_FACADE tiles
- **Show which face is the exterior face** (already in tooltip, promote to overlay)
- **Validate jamb boundaries** — warn if a DOOR_FACADE is adjacent to empty space where the jamb
  would fall

### Building footprint grouping

Right now a "building" is implicit — a cluster of WALL tiles on an exterior floor with a DOOR_FACADE
on one face, a name in the BuildingRegistry, and a doorTarget pointing to an interior floor.

- **Building registry editor** — create, name, tag buildings
- **Group selection of building tiles** — select all tiles belonging to a building at once
- **Auto-generate interior floor scaffold** — from a building footprint, generate a starter interior
  grid with walls at the right dimensions
- **Round-trip check** — exterior building dimensions match interior floor gridW/gridH where relevant

### Biome palette swapping

DG has multiple biomes planned. A designer should be able to:

- **Swap palette** — view the same grid with desert/forest/coastal/night palettes
- **Preview texture atlas swaps** — without committing changes
- **Copy-as-biome** — clone a floor and rebias its tiles to a different biome's equivalents

### Narrative layer

From `STREET_CHRONICLES_NARRATIVE_OUTLINE.md`: conspiracy reveals are staged per floor.

- **Narrative beat markers** — pin "Act 1 reveal: hero's trophy wall" to a cell
- **NPC dialogue link** — click an NPC entity, see their dialogue ID from `data/strings/en.js`
- **Faction territory overlay** — tint regions by controlling faction

---

## Tier 5 — Aspirational / post-jam

Things that would be lovely but aren't shipping before Winter 2026 webOS launch.

- **Procedural floor recipe editor** — for the floors we *don't* blockout by hand. Visual node graph
  for "generate N rooms, connect with corridors, place 3 torches per room."
- **Procedural + handcrafted hybrid** — hand-place the entry + boss rooms, let the editor fill the
  middle with procgen, preview the result
- **Multi-floor view** — render the full world graph as a 3D stack of floors
- **Collaborative editing** — multiple designers on the same floor (probably overkill; DG is small team)
- **Playtesting instrumentation** — in the editor, replay player paths from analytics, see heatmaps
  of actual player movement
- **Accessibility check** — validate against WCAG-adjacent rules: contrast between walkable and
  non-walkable, color-blind-safe tile palette, glyph readability
- **i18n preview** — swap `data/strings/en.js` for other locales to check UI overflow

---

## Suggested implementation order

Assuming the current jam timeline (post-jam cleanup through Winter 2026 launch):

1. **Phase 3 (schema extraction)** — 1–2 days. Unlocks everything downstream.
2. **Tier 1 drawing tools** — rectangle fill, flood fill, line, brush size. 1–2 days.
3. **Tier 1 selection + history + cross-floor clipboard** — magic wand, redo, history panel,
   cross-floor copy-paste. 1–2 days. The clipboard surviving floor switches is the enabling
   primitive for both general multi-floor editing and the Tier 4 window-scene workflow.
4. **Direct file write** (Tier 2 file integration) — skip the copy-paste dance. Half a day.
5. **Tier 4 window-scene editor** — the thing that motivated this conversation. 2–3 days. Now
   that cross-floor clipboard exists, the window-scene panel can offer a guided "Paste from
   parent floor" flow on top of the same mechanism.
6. **Tier 2 validation** — walkability, door contracts, spawn check. 2 days.
7. **Tier 3 metadata editor** — rooms, doorTargets, spawn drag. 2–3 days.
8. **Tier 4 tile height offset editor** — 1–2 days.
9. **Tier 2 layers** — significant refactor. Save for when the compositional needs are clear.
10. **Tier 3 3D preview** — defer until the editor is otherwise mature; then it becomes the wow feature.

Items that are probably **never worth it** for DG's scope: collaborative editing, procedural recipe
editor, history tree with branching, customizable shortcuts. A small team building one game doesn't
need those.

---

## Design principles for this tool

As features accumulate, these should stay true:

1. **Zero build tools.** Same constraint as the engine. Single HTML file, no npm, no bundler. If a
   feature requires React, reconsider the feature.
2. **The grid literal is the source of truth.** The editor reads from and writes to the same
   `_FLOOR_GRID` array a contributor would hand-edit. No proprietary file format.
3. **Post-builder baseline (Option 2).** The editor works against the built, decorated grid — what
   the player sees. See the fidelity discussion in the session transcript.
4. **Designers shouldn't need to understand IIFEs.** The editor hides the module pattern; the
   exported grid pastes into a builder function transparently.
5. **Every overlay is toggleable.** Rooms, doors, grid lines, IDs, spawn, entities — all off by
   default except the essentials. Readable ASCII-style view first, diagnostic overlays on demand.
6. **Undo everything.** Any state change — paint, lasso, resize, metadata edit, entity placement —
   goes through the undo stack.

---

## Resolved decisions (April 2026 planning session)

These were the open questions from the original roadmap. Decisions recorded here for reference.

### 1. Layered grid format vs. flat grid with synthesized layers

**Decision: Keep flat `grid[y][x]`, synthesize layers at display time.**

The entire engine is built around `grid[y][x]` as a single tile-ID. The raycaster, `FloorManager`,
`extract-floors.js`, the `_testGetBuilders()` pipeline, `SpatialContract`, `Lighting`, `Minimap` —
everything indexes into a flat 2D array. Design Principle #2 says *"The grid literal is the source
of truth."*

The tile system already encodes enough category information to synthesize layers: `isDoor()`,
`isFloating()`, `isFreeform()`, `isCrenellated()`, `isWindow()`, `isTorch()`. The visualizer builds
a `categoryOf(tileId)` function from the Phase 3 schema extraction and renders virtual layers as
view-only overlays with per-layer visibility/opacity/lock toggles.

The one limitation — inability to stack (e.g. torch ON a wall) — is already solved by the engine's
approach: wall tiles are opaque and torches are separate adjacent tiles. The engine doesn't stack
tiles in the same cell; the editor shouldn't pretend it does.

### 2. Entity placement: grid meta-tiles vs. parallel array

**Decision: Parallel entities array, separate from the grid.**

Entities are already completely separate from the grid in the engine:
- `EnemyAI.spawn()` / `EnemyAI.spawnEnemies()` places enemies at runtime
- `WorldItems.placeFloorItems()` places collectibles at runtime
- `npc-system.js` manages NPCs with their own position/state
- `CorpseRegistry`, `CobwebSystem`, `TorchState`, `BonfireSprites`, `DumpTruckSpawner` — all
  runtime overlay systems

Grid tiles like SPAWN, SHOP, BONFIRE, CHEST are markers that tell the engine "an entity system
should do something here." The actual entities (which NPC, what loot table, which enemy card ID)
are metadata that doesn't fit in a single integer tile ID.

The editor introduces a lightweight `entities` array alongside the grid in `floor-data.json`.
This is additive — it doesn't touch the existing grid format. The visualizer renders entities as
an overlay layer (one of the synthesized layers from Decision #1).

### 3. Mini raycast engine vs. sibling iframe

**Decision: Sibling iframe first, mini raycast deferred to Tier 3+.**

The full raycaster is deeply coupled to `SpatialContract`, `TextureAtlas`, `DoorSprites`,
`WindowSprites`, `Lighting`, `Skybox`, `arch-peek.js`, freeform rendering, floating tile passes,
crenel silhouettes. Bundling a mini version that handles all of this correctly would be a multi-week
project that drifts from the real engine's output.

A sibling iframe approach:
- Point at `index.html?floor=<id>&camera=<x>,<y>,<dir>&editor=true`
- Add a minimal `editor=true` query-param mode that skips splash/title, loads the target floor,
  positions the camera, and disables gameplay
- The editor sends `postMessage` updates when the grid changes; the iframe re-renders
- The designer sees the *exact* rendered output, not an approximation

This aligns with Design Principles #3 and #1. The Tier 3 mini raycast comes later as a lightweight
~200×150 preview for quick feedback without the iframe's full load time.

### 4. Undo across floor switches

**Decision: Per-floor undo stacks keyed by floor ID, preserved across switches.**

Maintain a `Map<floorId, undoStack[]>` instead of a single global stack. On floor switch, park the
current stack under the outgoing floor ID, restore the incoming floor's stack. Each stack has a
configurable max depth (e.g. 200 operations) to bound memory. Named checkpoints (from Tier 1
History) are per-floor as well.

Cross-floor operations (e.g. editing a `doorTarget` that affects two floors) record an entry in
both stacks with a shared operation ID, so undoing on either floor undoes both halves.

### 5. Parse cards.json + strings/en.js during schema extraction

**Decision: Yes — emit as three separate schema sections.**

Phase 3 schema extraction will:
1. Parse `tiles.js` → tile schema with all predicates (mandatory, loaded immediately)
2. Parse `cards.json` → card manifest with id, name, emoji, rarity, type (lazy-loaded enrichment)
3. Parse `strings/en.js` → string index for entity/shop/NPC display name resolution (lazy-loaded)

Three separate keys in `floor-data.json` (or split files) so the visualizer can load tiles-only
for the basic editor and lazy-load cards + strings when entity/metadata panels open.
