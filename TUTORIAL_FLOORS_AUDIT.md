# Tutorial Floors Audit Report
**Date:** 2026-03-06
**Scope:** Contrived floors 0–3, door mechanics, tavern interiors, contractor refactor, WBE compatibility

---

## Executive Summary

Seven bugs/misalignments found across the tutorial floor system. The contractor refactor partially succeeded (floor layouts, interior registration, door metadata are correct) but introduced regressions in spawn protection, enemy filtering, and door animation differentiation. The tavern `floor0.N` collectible testing broke the enemy-spawn guard and exposed a missing `suppressBackDoor` consumer.

---

## BUG 1 — Floor 0 has a return/back door (should not)

**Severity:** High
**Status:** Broken
**File:** `tutorial-floor-gen.js` lines 118–170

### What's happening
`generateContrivedTutorialFloor()` unconditionally stamps a back door at `(backX, backY)` on every floor — including floor 0. The `generateContrivedFloor()` function in `tutorial-floors.js` correctly sets `suppressBackDoor: true` when `layout.floorNumber === 0` (line 1308), but **nothing in `tutorial-floor-gen.js` reads that flag**.

### Root cause
```js
// tutorial-floors.js line 1308 — flag is SET
suppressBackDoor: layout.floorNumber === 0,

// tutorial-floor-gen.js — flag is NEVER READ
// Lines 118-170 always stamp the back door unconditionally:
ctx.grid[backY][backX] = ctx.TILES.DOOR;
ctx.tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };
```

The `floorData` object returned by `generateContrivedFloor()` contains `floorData.suppressBackDoor = true`, but the consumer in `tutorial-floor-gen.js` never checks it.

### Fix
In `tutorial-floor-gen.js`, wrap the back-door stamping block (lines ~118–170 and repeated stamps at ~658–659, ~731–732) in a conditional:

```js
if (!floorData.suppressBackDoor) {
  // ... all back door placement logic ...
  ctx.grid[backY][backX] = ctx.TILES.DOOR;
  ctx.tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };
}
```

Also suppress the back-door related final re-stamps at lines ~656–659 and ~730–733.

Additionally, in `floor-transition-system.js` line 66, the retreat guard `if (ctx.getFloor() <= 0) return;` is correct — but with the back door present on floor 0, a player can still visually see and walk onto it before `retreatFloor()` short-circuits. The door tile should simply not exist.

---

## BUG 2 — Floor 2: player spawns on top of advance door

**Severity:** High
**Status:** Partially fixed, still failing in edge cases

### What's happening
Floor 2 layout defines: `player: { x: 20, y: 2 }` and `exit: { x: 20, y: 18 }`. When a player *advances* from floor 1 to floor 2, the spawn logic in `tutorial-floor-gen.js` lines 36–45 tries to place the player on the "back" door position. But when the player *retreats* from floor 3 back to floor 2, the code at line 37–39 sets:

```js
var targetDoorKind = (ctx.getSpawnFromLastExitPos() === 'retreat') ? 'forward' : 'back';
var doorX = (targetDoorKind === 'forward') ? floorData.exit.x : floorData.player.x;
var doorY = (targetDoorKind === 'forward') ? floorData.exit.y : floorData.player.y;
```

On retreat, `targetDoorKind = 'forward'`, so `doorX = 20, doorY = 18` — the player is placed directly on the advance/forward exit at `(20, 18)`.

The fix at lines 86–113 tries to detect and relocate when `distSpawnExit <= 2`, but it only runs when `_doorTransitionMode !== 'retreat'`. Since retreat IS the problematic case, the safety net is explicitly skipped for the exact scenario that triggers the bug.

### Root cause
The comment at line 88 says: *"Skip this for retreat: the player SHOULD be near the exit when returning."* This is correct for the *forward* exit concept, but the logic confuses "near the exit" with "on top of the exit door tile." The player should be *adjacent to* but not *on* the door.

### Fix
1. Change the retreat skip condition. Instead of skipping entirely, still ensure the player isn't directly ON the forward door:

```js
// Line 89: change from
if (_doorTransitionMode !== 'retreat') {
// to
if (true) { // Always check — retreat can also land on the forward door
```

2. Or better: after the spawn-on-door placement at line 42, immediately offset by 1 tile in any empty direction:

```js
ctx.player.x = doorX;
ctx.player.y = doorY;
// Offset 1 tile away from the door to prevent immediate re-trigger
var offsets = [{dx:-1,dy:0},{dx:1,dy:0},{dx:0,dy:-1},{dx:0,dy:1}];
for (var oi = 0; oi < offsets.length; oi++) {
  var ox = doorX + offsets[oi].dx, oy = doorY + offsets[oi].dy;
  if (ox > 0 && ox < ctx.GRID_WIDTH-1 && oy > 0 && oy < ctx.GRID_HEIGHT-1
      && ctx.grid[oy] && ctx.grid[oy][ox] === ctx.TILES.EMPTY) {
    ctx.player.x = ox; ctx.player.y = oy; break;
  }
}
ctx.setDoorSpawnProtect({ x: doorX, y: doorY });
```

---

## BUG 3 — Door spawn protection is position-only (no step-count buffer)

**Severity:** Medium
**Status:** Design gap
**Files:** `player-interaction-system.js` lines 80–85, `gone-rogue.js` line 131

### What's happening
The current `_doorSpawnProtect` system works as a single `{x, y}` coordinate. When the player steps onto a non-door tile, `clearDoorSpawnProtect()` is called (line 31 of `player-interaction-system.js`). This means the protection clears the moment the player steps ONE tile away from the door. If the player then immediately steps back onto the door (1 step away → 1 step back = 2 total moves), they'll trigger the door transition.

### Your requirement
Players need ~4 steps of buffer OR must exit the door's tile and move ~4 tiles away before the door becomes active.

### Fix
Replace the simple `{x, y}` with a step-count cooldown:

```js
// In gone-rogue.js, change:
var _doorSpawnProtect = null; // { x, y }

// To:
var _doorSpawnProtect = null; // { x, y, stepsRemaining: 4 }

// In player-interaction-system.js, change clearDoorSpawnProtect call:
// Line 31 — instead of clearing immediately when off a door tile:
} else {
  // Decrement steps instead of clearing
  var dsp = ctx.getDoorSpawnProtect();
  if (dsp && dsp.stepsRemaining > 0) {
    dsp.stepsRemaining--;
    if (dsp.stepsRemaining <= 0) ctx.clearDoorSpawnProtect();
  } else {
    ctx.clearDoorSpawnProtect();
  }
}

// And in the check at lines 80-84:
if (dsp && dsp.x === x && dsp.y === y && dsp.stepsRemaining > 0) {
  return false; // Still protected
}
```

---

## BUG 4 — Building doors vs floor doors use identical animation/rendering

**Severity:** Medium
**Status:** Missing feature
**Files:** `tutorial-floor-gen.js` line 588, `interior-floor-system.js` line 128, `player-interaction-system.js` lines 88–98

### What's happening
Both building entrance doors (tavern, church) and floor advance/retreat doors use the same `🚪` emoji tile and identical overhead animation. There's no visual distinction between "enter this building" and "advance to next floor."

### Current state
- Floor doors: `ctx.TILES.EXIT` (🚪) with metadata `{ type: 'door', doorKind: 'forward'|'back' }`
- Building doors: `ctx.TILES.DOOR` (🚪) with metadata `{ type: 'building_door', doorKind: 'building' }`

The tile glyphs and overhead animations are identical. The `OverheadAnimator` only shows a generic `↩️` hint for the back door (line 268 of `tutorial-floor-gen.js`). Building doors get no distinct animation.

### Fix
1. Add distinct overhead animation for building doors in the rendering/interaction layer, using the following symbols:
   - **Return floor doors:** `↩️` (return arrow)
   - **Advance floor doors:** `↪️` (forward arrow)
   - **Building entrance/exit doors:** `↔️` (`<->` arrow)
   - **Inside of buildings:** return/advance floor doors use `↩️` / `↪️` respectively; the exit building door uses `↔️`

```js
// When player approaches a door, show a distinct indicator:
if (md.type === 'building_door') {
  OverheadAnimator.showGenericExpression(x, y, '↔️', 900); // Building entrance/exit
} else if (md.doorKind === 'forward') {
  OverheadAnimator.showGenericExpression(x, y, '↪️', 900); // Advance floor
} else if (md.doorKind === 'back') {
  OverheadAnimator.showGenericExpression(x, y, '↩️', 900); // Return floor
}
```

2. Optionally use different tile characters or CSS classes to differentiate visually on the grid. The `doorKind` metadata already distinguishes them — the rendering layer just needs to consume it.

---

## BUG 5 — Floor 0 enemy not visible (filtered out by tutorial-floor-gen.js)

**Severity:** High
**Status:** Broken
**File:** `tutorial-floor-gen.js` lines 505–506

### What's happening
Floor 0 defines an enemy — the Ancient Snail at `(37, 2)` — as a punching-bag for STR-combat testing. The layout data is correct:

```js
// tutorial-floors.js line 855-874
enemies: [{
  x: 37, y: 2, emoji: '🐌', name: 'Ancient Snail',
  hp: 20, maxHp: 20, attack: 1, defense: 0,
  elite: true, sightRange: 2, patrolType: 'stationary', ...
}]
```

But `tutorial-floor-gen.js` line 506 explicitly filters ALL enemies on floors < 3:

```js
var tutorialEnemies = (Array.isArray(floorData.enemies) ? floorData.enemies : []);
if (ctx.getFloor() < 3) tutorialEnemies = [];  // ← KILLS floor 0 enemy
```

### Root cause
The contractor added this guard to prevent enemies on floors 1–2 (the original tutorial design had no combat until floor 3). But floor 0 was added later with an intentional punching-bag enemy, and the guard wasn't updated.

### Fix
Change the filter to exempt floor 0's intentional enemies:

```js
// Option A: Only filter floors 1-2 (keep 0 and 3+)
if (ctx.getFloor() >= 1 && ctx.getFloor() < 3) tutorialEnemies = [];

// Option B: Check a layout flag
var tutorialEnemies = (Array.isArray(floorData.enemies) ? floorData.enemies : []);
if (!layout.allowEnemies && ctx.getFloor() < 3) tutorialEnemies = [];
// Then add allowEnemies: true to FLOOR_0_LAYOUT
```

---

## BUG 6 — Tavern floor0.N regression from collectible testing

**Severity:** Medium-High
**Status:** Partially broken
**Files:** `interior-floor-system.js`, `tutorial-floors.js` lines 1127–1129

### What's happening
The tavern interior floors are registered as `'0.1'` and `'0.1.1'` (line 1128-1129 of `tutorial-floors.js`), but the building door on floor 0 points to `'0.1'` (line 809). The buildings.json has `BLD-TAVERN` with `interiorFloorId: "0.1"`.

**The inconsistency:** The original architecture doc describes tavern as `"0.0"` and `"0.0.1"`, but the code uses `"0.1"` and `"0.1.1"`. This is internally consistent within the code but misaligned with the documentation.

The actual regression: when `interior-floor-system.js` generates the tavern interior (line 49), it calls `TutorialFloors.generateContrivedFloor(layout)` which resets items via `WorldItems.init()` (line 62). The collectible testing on tavern floors likely added items to WorldItems, and re-entering the tavern wipes them. Additionally, the tavern basement at `"0.1.1"` has `buildingDoors: []` defined but the template uses a `B` character (line 917 of the tavern interior template) that isn't handled by the template parser — it falls through to `TILES.EMPTY`.

### Issues found
1. **WorldItems.init() on interior entry** (line 62 of `interior-floor-system.js`) wipes all floor items including any collectibles being tested
2. **The `B` marker** in the tavern interior template (row 17, col 35) is supposed to mark the basement door position but it's parsed as empty floor. The actual basement door is placed by `buildingDoors` at `{ x: 35, y: 17 }` which works, but the template marker is misleading
3. **Floor ID scheme mismatch** with docs: code uses `0.1` / `0.1.1`, docs describe `0.0` / `0.0.1`

### Fix
1. Guard WorldItems.init() to preserve parent-floor items when entering interiors:

```js
// interior-floor-system.js line 62 — change from:
WorldItems.init();
// to:
WorldItems.initForInterior(); // New method that scopes to interior only
```

2. Standardize floor IDs across docs and code (pick one scheme — `0.1` is fine, update docs)
3. Remove or document the `B` marker in the template comment

---

## BUG 7 — Contractor refactor: WBE compatibility assessment

**Severity:** Low-Medium (tech debt)
**Status:** Partially compatible

### What the contractor did right
- Separated floor generation into `tutorial-floor-gen.js` (consumer) and `tutorial-floors.js` (data)
- Used the `InteriorFloors` registry pattern for authored layouts
- Door metadata schema (`type`, `doorKind`, `buildingId`, `targetFloorId`) aligns with WBE Step Nodes
- `suppressBackDoor` flag exists (just isn't consumed)
- Template-based layouts with shift logic support anchoring
- `getFloorLayout()` switch statement is easy to replace with WBE resolver

### What needs alignment for WBE portal integration
1. **No `floorType` field on layouts** — WBE Step Nodes need `floorType: "template" | "procedural"` but the current layouts don't declare this. Add it.
2. **No `difficultyTier` field** — layouts don't specify their tier; it's inferred from `getDifficultyTier()` at runtime. WBE needs explicit tier on each node.
3. **No `narrativeTags` or `requiredPlayerState`** — WBE Transition Nodes need condition metadata. Current floors have no transition conditions.
4. **Hard-coded floor number routing** — `getFloorLayout()` uses a switch on floor number. WBE needs ID-based lookup from the world graph. Replace switch with registry:

```js
// Instead of:
switch (floorNumber) { case 0: return FLOOR_0_LAYOUT; ... }
// Use:
var _layouts = {};
function registerFloor(id, layout) { _layouts[id] = layout; }
function getFloorLayout(id) { return _layouts[id] || null; }
```

5. **No export format** — layouts are JS objects in a closure. WBE needs JSON export. The `generateContrivedFloor()` return value is close to what the WBE would consume, but needs a serialization step.

---

## BUG 8 — Building interiors render walls as parent biome (no interior biome)

**Severity:** High (visual)
**Status:** Broken
**File:** `interior-floor-system.js` lines 68–69, 231–232

### What's happening
When a player enters any building interior (tavern, church basement, etc.), the walls render as raw `█` characters against the parent floor's biome background. There are no interior-specific wall tiles, floor tiles, background gradients, or visual theming. Every interior looks like a generic grey dungeon regardless of the building type.

### Root cause
`interior-floor-system.js` line 69 calls `ctx.clearVisualCaches()` which wipes the biome visual grid, tile render objects, and background colors. But it never rebuilds them with an interior-appropriate biome. Line 232 hardcodes `LightingSystem.setBiome('COZY_FOREST_NIGHT')` for ALL interiors regardless of building type. No `buildBiomeVisualGrid()` or `buildTileRenderObjects()` call is made for the interior.

The result: walls are plain `█`, floors are plain `.`, background is whatever residual color remains after cache clear. The tavern interior looks identical to the church catacombs.

### What's needed
Each building type needs an interior biome definition that specifies:
- `wallTiles` — what wall characters/emojis represent this interior type
- `floorTiles` — floor surface appearance
- `backgroundGradient` — ambient color (warm amber for tavern, cold stone for catacombs, etc.)
- `props` — interior-appropriate breakables and decorations
- `tileEffects` — stealth/movement modifiers appropriate to the space

### Fix
1. Add interior biome definitions to `biomes.json` (see BUG 9 below for the full set)
2. In `interior-floor-system.js`, after `clearVisualCaches()` (line 69), resolve the interior biome from the building type and rebuild visual caches:

```js
// After line 69: ctx.clearVisualCaches();
var interiorBiome = _resolveInteriorBiome(targetFloorId, layout);
if (interiorBiome) {
  ctx.buildBiomeVisualGrid(interiorBiome);
  ctx.buildTileRenderObjects(interiorBiome);
  var isNight = true; // Interiors are always "night" (indoor lighting)
  ctx.buildBiomeBackgroundColors(interiorBiome, isNight);
}
```

3. Replace the hardcoded `COZY_FOREST_NIGHT` lighting with the interior biome's lighting profile:

```js
// Line 232: change from
LightingSystem.setBiome('COZY_FOREST_NIGHT');
// to
var lightingBiome = interiorBiome ? interiorBiome.lightingProfile : 'COZY_FOREST_NIGHT';
LightingSystem.setBiome(lightingBiome);
```

---

## BUG 9 — No building interior biome definitions exist

**Severity:** High (content gap)
**Status:** Missing feature
**Files:** `biomes.json`, new `interior-biomes.json` needed

### What's happening
`biomes.json` defines 6 exterior/overworld biomes (Forest, Grey Cave, Office, Mall, Industrial, Aerospace) but zero interior biomes. Building interiors have no visual identity system at all.

### What's needed
A set of interior biome definitions that map to building types. These were previously described in planning as: tavern, church, strip mall, factory, submarine/missile silo, apartment, junkyard. Below is the proposed interior biome registry aligned to the existing 6 overworld biomes, with bleed-over allowance noted.

### Proposed Interior Biome Registry

#### INTERIOR_TAVERN (parent biome: FOREST)
```json
{
  "id": "INTERIOR_TAVERN",
  "name": "Tavern Interior",
  "parentBiomes": ["FOREST", "MALL"],
  "wallChar": "▓",
  "wallTiles": [
    { "char": "▓", "weight": 50 },
    { "char": "🪵", "weight": 25 },
    { "char": "🏮", "weight": 10 },
    { "char": "🍺", "weight": 10 },
    { "char": "🪟", "weight": 5 }
  ],
  "floorTiles": [
    { "char": ".", "weight": 60 },
    { "char": "▬", "weight": 25 },
    { "char": "·", "weight": 15 }
  ],
  "props": [
    { "emoji": "🪑", "name": "Chair", "breakable": true, "hp": 1, "kickable": true },
    { "emoji": "🍺", "name": "Tankard", "breakable": true, "hp": 1, "drops": ["coins"] },
    { "emoji": "🛢️", "name": "Ale Barrel", "breakable": true, "hp": 2, "drops": ["drink", "coins"] },
    { "emoji": "📦", "name": "Crate", "breakable": true, "hp": 2, "drops": ["supplies"] },
    { "emoji": "🔥", "name": "Fireplace", "breakable": false, "lightType": "CAMPFIRE" }
  ],
  "backgroundGradient": {
    "night": { "start": "#1a0f05", "end": "#2a1808" }
  },
  "lightingProfile": "TAVERN_WARM",
  "ambientColor": "#FFD700"
}
```

#### INTERIOR_CHURCH (parent biome: FOREST)
```json
{
  "id": "INTERIOR_CHURCH",
  "name": "Church Interior",
  "parentBiomes": ["FOREST", "GREY_CAVE"],
  "wallChar": "█",
  "wallTiles": [
    { "char": "█", "weight": 50 },
    { "char": "▓", "weight": 20 },
    { "char": "⛪", "weight": 5 },
    { "char": "🕯️", "weight": 15 },
    { "char": "🪟", "weight": 10 }
  ],
  "floorTiles": [
    { "char": ".", "weight": 50 },
    { "char": "▬", "weight": 30 },
    { "char": "·", "weight": 20 }
  ],
  "props": [
    { "emoji": "🕯️", "name": "Candelabra", "breakable": true, "hp": 1, "lightType": "CANDLE" },
    { "emoji": "📖", "name": "Hymnal", "breakable": false, "interact": "read" },
    { "emoji": "🪑", "name": "Pew", "breakable": true, "hp": 3, "provides": "cover" },
    { "emoji": "⚱️", "name": "Urn", "breakable": true, "hp": 1, "drops": ["gems", "coins"] }
  ],
  "backgroundGradient": {
    "night": { "start": "#0a0812", "end": "#14101e" }
  },
  "lightingProfile": "CHURCH_DIM",
  "ambientColor": "#9370DB"
}
```

#### INTERIOR_CATACOMBS (parent biome: GREY_CAVE, nested under CHURCH)
```json
{
  "id": "INTERIOR_CATACOMBS",
  "name": "Catacombs",
  "parentBiomes": ["GREY_CAVE"],
  "wallChar": "█",
  "wallTiles": [
    { "char": "█", "weight": 40 },
    { "char": "▓", "weight": 25 },
    { "char": "💀", "weight": 15 },
    { "char": "🕸️", "weight": 10 },
    { "char": "🪨", "weight": 10 }
  ],
  "floorTiles": [
    { "char": ".", "weight": 40 },
    { "char": "·", "weight": 25 },
    { "char": "░", "weight": 20 },
    { "char": "~", "weight": 15, "animated": true }
  ],
  "props": [
    { "emoji": "💀", "name": "Skull Pile", "breakable": true, "hp": 1, "drops": ["bone", "coins"] },
    { "emoji": "⚰️", "name": "Coffin", "breakable": true, "hp": 3, "drops": ["gems", "rare_items"] },
    { "emoji": "🕯️", "name": "Wall Sconce", "breakable": true, "hp": 1, "lightType": "CANDLE" },
    { "emoji": "🕸️", "name": "Web Cluster", "breakable": true, "hp": 1, "slowsMovement": true }
  ],
  "backgroundGradient": {
    "night": { "start": "#08060a", "end": "#0f0a14" }
  },
  "lightingProfile": "CATACOMBS_DARK",
  "ambientColor": "#4B0082"
}
```

#### INTERIOR_STRIP_MALL (parent biome: MALL)
```json
{
  "id": "INTERIOR_STRIP_MALL",
  "name": "Strip Mall Store",
  "parentBiomes": ["MALL", "OFFICE"],
  "wallChar": "▓",
  "wallTiles": [
    { "char": "▓", "weight": 40 },
    { "char": "🪟", "weight": 25 },
    { "char": "🚪", "weight": 10 },
    { "char": "📋", "weight": 10 },
    { "char": "🪧", "weight": 15 }
  ],
  "floorTiles": [
    { "char": ".", "weight": 60 },
    { "char": "▬", "weight": 25 },
    { "char": "·", "weight": 15 }
  ],
  "props": [
    { "emoji": "🛍️", "name": "Shopping Bag", "breakable": true, "hp": 1, "drops": ["random"] },
    { "emoji": "🛒", "name": "Shopping Cart", "breakable": true, "hp": 2, "provides": "mobile_cover", "kickable": true },
    { "emoji": "📰", "name": "Magazine Rack", "breakable": true, "hp": 1, "drops": ["hints"] },
    { "emoji": "🥤", "name": "Vending Machine", "breakable": true, "hp": 4, "drops": ["drinks", "snacks"] }
  ],
  "backgroundGradient": {
    "night": { "start": "#0f0a0a", "end": "#1a1010" }
  },
  "lightingProfile": "MALL_FLUORESCENT",
  "ambientColor": "#F0F0F0"
}
```

#### INTERIOR_FACTORY (parent biome: INDUSTRIAL)
```json
{
  "id": "INTERIOR_FACTORY",
  "name": "Factory Floor",
  "parentBiomes": ["INDUSTRIAL"],
  "wallChar": "█",
  "wallTiles": [
    { "char": "█", "weight": 40 },
    { "char": "▓", "weight": 20 },
    { "char": "⚙️", "weight": 15 },
    { "char": "🔩", "weight": 15 },
    { "char": "🪟", "weight": 10 }
  ],
  "floorTiles": [
    { "char": ".", "weight": 40 },
    { "char": "▪", "weight": 20 },
    { "char": "_", "weight": 15, "animated": true },
    { "char": "·", "weight": 15 },
    { "char": "░", "weight": 10 }
  ],
  "props": [
    { "emoji": "⚙️", "name": "Machinery", "breakable": true, "hp": 4, "drops": ["scrap", "parts"] },
    { "emoji": "🛢️", "name": "Oil Drum", "breakable": true, "hp": 1, "explosive": true, "blastRadius": 2.75 },
    { "emoji": "🔧", "name": "Tool Rack", "breakable": true, "hp": 2, "drops": ["tools"] },
    { "emoji": "⏩", "name": "Conveyor Belt", "interact": "walk", "effect": "speed_boost" }
  ],
  "backgroundGradient": {
    "night": { "start": "#0a0a06", "end": "#1a1508" }
  },
  "lightingProfile": "INDUSTRIAL_HARSH",
  "ambientColor": "#FFA500"
}
```

#### INTERIOR_APARTMENT (parent biome: OFFICE, MALL)
```json
{
  "id": "INTERIOR_APARTMENT",
  "name": "Apartment",
  "parentBiomes": ["OFFICE", "MALL"],
  "wallChar": "▓",
  "wallTiles": [
    { "char": "▓", "weight": 45 },
    { "char": "🪟", "weight": 20 },
    { "char": "🚪", "weight": 10 },
    { "char": "🖼️", "weight": 15 },
    { "char": "📺", "weight": 10 }
  ],
  "floorTiles": [
    { "char": ".", "weight": 55 },
    { "char": "▬", "weight": 25 },
    { "char": "·", "weight": 20 }
  ],
  "props": [
    { "emoji": "🛋️", "name": "Couch", "breakable": true, "hp": 2, "provides": "cover" },
    { "emoji": "🪑", "name": "Chair", "breakable": true, "hp": 1, "kickable": true },
    { "emoji": "📺", "name": "Television", "breakable": true, "hp": 1, "noise": 2, "drops": ["parts"] },
    { "emoji": "🍳", "name": "Stove", "breakable": false, "interact": "cook", "hazard": "fire" }
  ],
  "backgroundGradient": {
    "night": { "start": "#0e0a08", "end": "#1a1410" }
  },
  "lightingProfile": "APARTMENT_WARM",
  "ambientColor": "#FFDEAD"
}
```

#### INTERIOR_JUNKYARD (parent biome: INDUSTRIAL)
```json
{
  "id": "INTERIOR_JUNKYARD",
  "name": "Junkyard",
  "parentBiomes": ["INDUSTRIAL", "GREY_CAVE"],
  "wallChar": "▓",
  "wallTiles": [
    { "char": "▓", "weight": 30 },
    { "char": "🗑️", "weight": 20 },
    { "char": "🛢️", "weight": 15 },
    { "char": "📦", "weight": 20 },
    { "char": "🪨", "weight": 15 }
  ],
  "floorTiles": [
    { "char": ".", "weight": 35 },
    { "char": "·", "weight": 20 },
    { "char": "░", "weight": 25 },
    { "char": "_", "weight": 10, "animated": true },
    { "char": "▪", "weight": 10 }
  ],
  "props": [
    { "emoji": "🗑️", "name": "Dumpster", "breakable": true, "hp": 3, "drops": ["scrap", "surprises"], "kickable": true },
    { "emoji": "🚗", "name": "Wrecked Car", "breakable": true, "hp": 5, "provides": "cover", "explosive": true },
    { "emoji": "🔩", "name": "Scrap Pile", "breakable": true, "hp": 1, "drops": ["parts", "scrap"] },
    { "emoji": "🐀", "name": "Rat Nest", "breakable": true, "hp": 1, "spawnsEnemy": true }
  ],
  "backgroundGradient": {
    "night": { "start": "#0a0806", "end": "#181208" }
  },
  "lightingProfile": "JUNKYARD_GRIM",
  "ambientColor": "#8B7355"
}
```

#### INTERIOR_SILO (parent biome: AEROSPACE)
```json
{
  "id": "INTERIOR_SILO",
  "name": "Missile Silo",
  "parentBiomes": ["AEROSPACE", "INDUSTRIAL"],
  "wallChar": "█",
  "wallTiles": [
    { "char": "█", "weight": 45 },
    { "char": "▓", "weight": 15 },
    { "char": "🔴", "weight": 10 },
    { "char": "⚡", "weight": 10 },
    { "char": "🪟", "weight": 10 },
    { "char": "🚀", "weight": 10 }
  ],
  "floorTiles": [
    { "char": ".", "weight": 50 },
    { "char": "▪", "weight": 25 },
    { "char": "·", "weight": 15 },
    { "char": "░", "weight": 10 }
  ],
  "props": [
    { "emoji": "🚀", "name": "Missile Housing", "breakable": false, "blocksPath": true },
    { "emoji": "🎛️", "name": "Launch Console", "interact": "hack", "effect": "reveals_map" },
    { "emoji": "⚡", "name": "Power Conduit", "breakable": true, "hp": 2, "hazard": "electric" },
    { "emoji": "🔴", "name": "Warning Light", "breakable": true, "hp": 1, "lightType": "ALARM" }
  ],
  "backgroundGradient": {
    "night": { "start": "#06080f", "end": "#0a101a" }
  },
  "lightingProfile": "SILO_EMERGENCY",
  "ambientColor": "#FF4500"
}
```

### Biome-to-Interior Bleed-Over Matrix

This table shows which interior types can appear inside which overworld biomes. Primary = always valid. Bleed = allowed when parent floor biome bleeds into an adjacent biome's range.

| Interior | Primary Biome | Bleed-Over Allowed |
|----------|--------------|-------------------|
| INTERIOR_TAVERN | Forest | Mall |
| INTERIOR_CHURCH | Forest | Grey Cave |
| INTERIOR_CATACOMBS | Grey Cave | (nested under Church only) |
| INTERIOR_STRIP_MALL | Mall | Office |
| INTERIOR_FACTORY | Industrial | — |
| INTERIOR_APARTMENT | Office | Mall |
| INTERIOR_JUNKYARD | Industrial | Grey Cave |
| INTERIOR_SILO | Aerospace | Industrial |

### Implementation
1. Create `public/data/gone-rogue/interior-biomes.json` with the definitions above
2. Add a `interiorBiome` field to `buildings.json` entries pointing to the interior biome ID
3. In `interior-floor-system.js`, resolve the interior biome and apply visual caches (per BUG 8 fix)
4. Add corresponding lighting profiles to the lighting system

---

## BUG 10 — WBE and docs don't cross-reference biome/interior/enemy systems

**Severity:** Medium (documentation/architecture debt)
**Status:** Missing
**Files:** `WORLD_BUILDING_ENGINE.md`, `BIOME_SYSTEMS.md`, `BUILDING_INTERIOR_SYSTEM.md`, `biomes.json`, `buildings.json`

### What's happening
The World Building Engine design doc describes a comprehensive GRAFCET node system with Environmental Synergy, narrative context, and designer tooling — but never references or links to:
- `BIOME_SYSTEMS.md` (the canonical biome catalog, vents, bleed, card drops)
- `biomes.json` (the runtime biome definitions with wallTiles, props, tileEffects)
- `buildings.json` (the building registry)
- `BUILDING_INTERIOR_SYSTEM.md` (the interior architecture)
- `enemy-catalog.json` / `enemy-cards.json` (biome-specific enemy variants)
- The proposed `interior-biomes.json` (once created)

Similarly, `BIOME_SYSTEMS.md` doesn't reference the WBE at all. The two systems are designed in isolation despite being deeply interdependent.

### What the WBE Step Nodes need from the biome system
Each WBE Step Node (floor state) needs to know:
- Which overworld biome applies (from `biome-config.js` weighted selection or designer override)
- Which building types are valid for that biome (from the biome-to-interior matrix in BUG 9)
- Which enemies can spawn (from `enemy-catalog.json` biome variants)
- Which breakable props are available (from `biomes.json` props array)
- Which lighting profile to use (from biome backgroundGradient + lighting system)
- Which card drops are weighted (from biome-specific card drop tables in `BIOME_SYSTEMS.md`)

### What's needed

#### 1. Add a "System Cross-References" section to `WORLD_BUILDING_ENGINE.md`:
```markdown
## System Cross-References
| System | File | WBE Integration |
|--------|------|----------------|
| Biome Catalog | BIOME_SYSTEMS.md | Step Node biome assignment |
| Biome Runtime | biomes.json | Visual theming per node |
| Interior Biomes | interior-biomes.json | Building interior visual identity |
| Building Registry | buildings.json | Building door placement in steps |
| Enemy Catalog | enemy-catalog.json | Biome-filtered enemy spawns |
| Card Drops | BIOME_SYSTEMS.md §6 | Loot table per biome per step |
| Lighting | lighting-system.js | Per-biome/interior lighting profile |
| Proc Gen Patterns | PROCEDURAL_GENERATION_DESIGN_IDEAS.md | Pattern type per biome |
```

#### 2. Add a "WBE Integration" section to `BIOME_SYSTEMS.md`:
Describe how each biome maps to WBE Step Node properties, which pattern engine types apply (from `PROCEDURAL_GENERATION_DESIGN_IDEAS.md` Phase 2.4), and which interior building types are valid.

#### 3. Easily implementable items from PROCEDURAL_GENERATION_DESIGN_IDEAS.md

The following Phase 1–2 items from the proc gen roadmap are low-effort and directly support the WBE + interior biome work:

**Phase 2.4 — Biome-to-Pattern Mapping** (already designed, just needs wiring):
| Biome | Pattern | Justification |
|-------|---------|---------------|
| Forest | ReactionDiffusion (spots) | Clustered hiding, organic feel |
| Grey Cave | ReactionDiffusion (labyrinth) | Maze navigation, claustrophobic |
| Mall | Voronoi (6-8 cells) | District shopping zones |
| Office | Voronoi (4-6 cells) | Cubicle territory blocks |
| Industrial | Voronoi + Branch (8 cells) | Chain reaction layouts |
| Aerospace | Radial (steep gradient) | Boss arena convergence |

This mapping should be added to `biomes.json` as a `patternType` and `patternParams` field per biome, and the WBE Step Node should inherit it by default (with designer override).

**Phase 4.4 — Pattern Parameter Scaling by Depth** (simple multiplier):
Instead of just stronger enemies on deeper floors, pattern parameters tighten: spots get denser, corridors narrow, voronoi cells shrink. This is a single scaling function that reads floor number and adjusts pattern params — easy to add to `floor-gen-core.js` without touching the existing room generator.

---

## Summary Table

| # | Bug | Severity | File(s) | Status |
|---|-----|----------|---------|--------|
| 1 | Floor 0 has back door | High | tutorial-floor-gen.js | `suppressBackDoor` set but never read |
| 2 | Floor 2 spawn on advance door | High | tutorial-floor-gen.js | Retreat case bypasses safety check |
| 3 | Door protection too weak | Medium | player-interaction-system.js | Position-only, needs step count |
| 4 | No door type animation distinction | Medium | rendering layer | Building vs floor doors look identical |
| 5 | Floor 0 enemy filtered out | High | tutorial-floor-gen.js:506 | `floor < 3` guard too aggressive |
| 6 | Tavern interior wipes collectibles | Medium-High | interior-floor-system.js:62 | WorldItems.init() is too broad |
| 7 | WBE compatibility gaps | Low-Medium | tutorial-floors.js | Missing metadata fields for WBE nodes |
| 8 | Interior walls default to parent biome | High | interior-floor-system.js:69 | Visual caches cleared but never rebuilt |
| 9 | No interior biome definitions | High | biomes.json / new file needed | 8 interior biomes proposed |
| 10 | WBE/docs don't cross-reference systems | Medium | multiple docs | Isolated designs need linking |

---

## BUG 11 — No boss floor biome definitions (Train Depot, Long Bridge)

**Severity:** High (content gap, blocks boss implementation)
**Status:** Missing
**Files:** `biomes.json`, `boss-encounters.js`, `BOSS_DESIGN.md`

### What's happening
`BOSS_DESIGN.md` defines 6 boss minigames (SkiFree, Tower Attack, Frogger/Train Depot, Asteroids, Sniper, Snake) but none of them have corresponding biome definitions. Boss floors currently fall through to the standard biome selection in `biome-config.js` (Aerospace for floors 23+, weighted random otherwise). There are no visual biomes for the train depot crossing, the Long Bridge frogger lane, or any boss-specific arena environment.

The Frogger boss ("Train Depot Crossing") explicitly needs a horizontal multi-lane environment with train tracks, platforms, and moving hazards — nothing in the current biome system supports this layout. Similarly, the stakeholder's Long Bridge concept (tight narrow horizontal path, water on both sides, car/traffic frogger) needs a completely new biome type.

### What's needed

#### BOSS_TRAIN_DEPOT (Frogger boss arena)
Based on Sandpoint's real BNSF rail junction — the historic 1916 Northern Pacific Depot where three rail lines converge ("the funnel").

```json
{
  "id": "BOSS_TRAIN_DEPOT",
  "name": "Train Depot",
  "type": "boss_arena",
  "wallChar": "█",
  "wallTiles": [
    { "char": "█", "weight": 30 },
    { "char": "▓", "weight": 20 },
    { "char": "🚂", "weight": 10 },
    { "char": "🔩", "weight": 15 },
    { "char": "🪵", "weight": 15 },
    { "char": "🏗️", "weight": 10 }
  ],
  "floorTiles": [
    { "char": "═", "weight": 40 },
    { "char": "─", "weight": 25 },
    { "char": "▪", "weight": 15 },
    { "char": "·", "weight": 10 },
    { "char": "░", "weight": 10 }
  ],
  "laneTiles": {
    "track": "═══",
    "platform": "▬▬▬",
    "gap": "···",
    "danger": "⚡⚡⚡"
  },
  "hazardSprites": {
    "freight": "🚂",
    "passenger": "🚃",
    "maintenance": "🏗️",
    "security": "👮"
  },
  "props": [
    { "emoji": "🚂", "name": "Freight Train", "lethal": true, "speed": "fast" },
    { "emoji": "🚃", "name": "Passenger Car", "lethal": true, "stops": true },
    { "emoji": "🏗️", "name": "Maintenance Crane", "lethal": true, "speed": "slow", "irregular": true },
    { "emoji": "📦", "name": "Cargo Stack", "breakable": false, "provides": "cover" },
    { "emoji": "🪵", "name": "Railroad Tie", "breakable": false, "provides": "platform" }
  ],
  "backgroundGradient": {
    "night": { "start": "#0a0808", "end": "#1a1210" }
  },
  "lightingProfile": "DEPOT_INDUSTRIAL",
  "ambientColor": "#CD853F",
  "layout": "horizontal_lanes",
  "laneCount": 7,
  "laneDirection": "alternating"
}
```

#### BOSS_LONG_BRIDGE (Frogger traffic variant)
Based on Sandpoint's real Long Bridge — the 2-mile crossing over Lake Pend Oreille connecting Sagle to Sandpoint. Tight narrow horizontal path, water on both sides, vehicles as hazards.

```json
{
  "id": "BOSS_LONG_BRIDGE",
  "name": "Long Bridge",
  "type": "boss_arena",
  "wallChar": "~",
  "wallTiles": [
    { "char": "~", "weight": 60, "animated": true },
    { "char": "≈", "weight": 30, "animated": true },
    { "char": "🌊", "weight": 10 }
  ],
  "floorTiles": [
    { "char": "▬", "weight": 50 },
    { "char": "═", "weight": 30 },
    { "char": "·", "weight": 20 }
  ],
  "laneTiles": {
    "road": "▬▬▬",
    "median": "║║║",
    "shoulder": "···",
    "water": "~~~"
  },
  "hazardSprites": {
    "car": "🚗",
    "truck": "🚛",
    "semi": "🚚",
    "motorcycle": "🏍️"
  },
  "props": [
    { "emoji": "🚗", "name": "Car", "lethal": true, "speed": "medium" },
    { "emoji": "🚛", "name": "Truck", "lethal": true, "speed": "slow", "wide": true },
    { "emoji": "🚚", "name": "Semi", "lethal": true, "speed": "fast", "long": true },
    { "emoji": "🏍️", "name": "Motorcycle", "lethal": true, "speed": "very_fast" },
    { "emoji": "🛡️", "name": "Jersey Barrier", "breakable": false, "provides": "cover" }
  ],
  "waterBorder": {
    "topRows": 3,
    "bottomRows": 3,
    "tiles": ["~", "≈", "🌊"],
    "animated": true,
    "lethal": true
  },
  "backgroundGradient": {
    "night": { "start": "#040810", "end": "#081018" }
  },
  "lightingProfile": "BRIDGE_TWILIGHT",
  "ambientColor": "#4682B4",
  "layout": "narrow_horizontal",
  "playableHeight": 5,
  "laneCount": 4,
  "laneDirection": "alternating"
}
```

#### BOSS_SKI_MOUNTAIN (SkiFree boss arena)
Based on Schweitzer Mountain Resort, Idaho's largest ski area, directly above Sandpoint.

```json
{
  "id": "BOSS_SKI_MOUNTAIN",
  "name": "Schweitzer Descent",
  "type": "boss_arena",
  "scrollDirection": "vertical_down",
  "wallTiles": [
    { "char": "🌲", "weight": 40 },
    { "char": "🪨", "weight": 25 },
    { "char": "⛷️", "weight": 5 },
    { "char": "🏔️", "weight": 10 },
    { "char": "❄️", "weight": 20 }
  ],
  "floorTiles": [
    { "char": "░", "weight": 50 },
    { "char": "·", "weight": 30 },
    { "char": "❄️", "weight": 20 }
  ],
  "backgroundGradient": {
    "day": { "start": "#d0e8f0", "end": "#a0c0d0" }
  },
  "lightingProfile": "MOUNTAIN_DAY"
}
```

### Fix
1. Add all boss arena biome definitions to a new `public/data/gone-rogue/boss-biomes.json`
2. In `floor-gen-core.js`, when `bossFloorActive` is true, load the boss-specific biome instead of the standard biome
3. The MinigameContainer framework from `BOSS_DESIGN.md` should consume these biome defs for its rendering layer
4. Each boss biome needs a corresponding lighting profile in the lighting system

---

## BUG 12 — Narrative setting not reflected in biome progression

**Severity:** Medium (content/design gap)
**Status:** Missing
**Files:** `biomes.json`, `biome-config.js`, narrative docs

### What's happening
The ARG narrative is set in Sandpoint, Idaho (Operation Kaniksu Eclipse, the Falcon Initiative vs. Kaniksu Network). The street-chronicles system uses real Sandpoint locations (Cedar St, Main St, Waterfront Ave). But the game's biome progression (Forest → Cave → Office → Mall → Industrial → Aerospace) has no relationship to the actual geography or industries of the Sandpoint/Coeur d'Alene area.

Sandpoint's real economy is: timber/forest products (20%+ of county payroll), Litehouse Foods (salad dressing factory), Daher/Quest Aircraft (Kodiak turboprop manufacturing), BNSF rail hub, tourism, Schweitzer Mountain Resort. The Silver Valley (40 miles east) adds silver/lead mining heritage with the historic Bunker Hill smelter.

The current biome names and themes are generic. They could be narratively aligned to real locations without changing any game mechanics — just renaming and re-theming.

### See: `NARRATIVE_ALIGNMENT.md` (companion document)
A full narrative alignment document maps real Sandpoint geography to the existing biome system and identifies gaps. Created alongside this audit.

---

## Summary Table

| # | Bug | Severity | File(s) | Status |
|---|-----|----------|---------|--------|
| 1 | Floor 0 has back door | High | tutorial-floor-gen.js | `suppressBackDoor` set but never read |
| 2 | Floor 2 spawn on advance door | High | tutorial-floor-gen.js | Retreat case bypasses safety check |
| 3 | Door protection too weak | Medium | player-interaction-system.js | Position-only, needs step count |
| 4 | No door type animation distinction | Medium | rendering layer | Building vs floor doors look identical |
| 5 | Floor 0 enemy filtered out | High | tutorial-floor-gen.js:506 | `floor < 3` guard too aggressive |
| 6 | Tavern interior wipes collectibles | Medium-High | interior-floor-system.js:62 | WorldItems.init() is too broad |
| 7 | WBE compatibility gaps | Low-Medium | tutorial-floors.js | Missing metadata fields for WBE nodes |
| 8 | Interior walls default to parent biome | High | interior-floor-system.js:69 | Visual caches cleared but never rebuilt |
| 9 | No interior biome definitions | High | biomes.json / new file needed | 8 interior biomes proposed |
| 10 | WBE/docs don't cross-reference systems | Medium | multiple docs | Isolated designs need linking |
| 11 | No boss floor biome definitions | High | biomes.json / new file needed | Train Depot, Long Bridge, Ski Mountain proposed |
| 12 | Narrative setting not in biome progression | Medium | biome-config.js | Sandpoint geography unmapped to biomes |

---

## Recommended Fix Priority

1. **BUG 5** (floor 0 enemy) — one-line fix, restores STR-combat testing
2. **BUG 1** (floor 0 back door) — wrap back-door stamps in `suppressBackDoor` check
3. **BUG 2** (floor 2 spawn) — remove retreat exemption from safety check
4. **BUG 3** (door step buffer) — upgrade `_doorSpawnProtect` to step-count
5. **BUG 11** (boss biomes) — create boss arena biome defs for Train Depot, Long Bridge, Ski Mountain
6. **BUG 9** (interior biome definitions) — create `interior-biomes.json` with 8 interior types
7. **BUG 8** (interior wall rendering) — wire interior biome into visual cache rebuild
8. **BUG 6** (tavern WorldItems wipe) — scope `init()` for interior context
9. **BUG 4** (door animation) — add distinct overhead animations per `doorKind`
10. **BUG 12** (narrative alignment) — retheme biomes to Sandpoint geography (see NARRATIVE_ALIGNMENT.md)
11. **BUG 10** (cross-reference docs) — add system linkage sections to WBE and BIOME_SYSTEMS
12. **BUG 7** (WBE compat) — add metadata fields, move to registry pattern
