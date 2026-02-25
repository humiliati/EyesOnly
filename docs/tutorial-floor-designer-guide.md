# Tutorial Floor Designer Guide

## Overview

The Tutorial Floor System provides **hand-crafted, designer-controlled floor layouts** for Gone Rogue's Tier 1 Forest Biome tutorial experience (floors 1-3). Unlike the procedural generation used for floors 4+, these floors use explicit layout definitions that you can edit directly.

This system is inspired by the original Legend of Zelda's starting area: a bounded exploration space that teaches core mechanics through environmental discovery rather than explicit instruction.

## Architecture

**Module:** `public/js/tutorial-floors.js`
**Integration:** Hooks into `GoneRogue._generateFloor()` for floors 1-3 only
**Script Load Order:** Must load before `gone-rogue.js` in `public/index.html`

### Files Modified

- `public/js/tutorial-floors.js` - New module containing floor layouts
- `public/js/gone-rogue.js` - Integration hooks (`_generateContrivedTutorialFloor()`)
- `public/index.html` - Script tag added for tutorial-floors.js

## Floor Layout Structure

Each floor is defined as a JavaScript object with the following properties:

```javascript
var FLOOR_N_LAYOUT = {
  floorNumber: 1,           // Floor number (1-3)
  name: 'Floor Name',       // Display name
  description: 'Brief description',

  // ASCII template (optional - for visualization)
  template: [
    '########################################',
    '#......................................#',
    '#...🏠.....⛪.....P....................#',
    // ... more rows
  ],

  // Spawn points
  player: { x: 20, y: 10 },   // Player starting position
  exit: { x: 20, y: 17 },      // Exit location

  // Visual elements (walkable/non-walkable)
  buildings: [
    { x: 4, y: 2, emoji: '🏠', name: 'Village House' }
  ],

  decorations: [
    { x: 6, y: 3, emoji: '📬', name: 'Mailbox' }
  ],

  // Breakable objects
  breakables: [
    {
      x: 10, y: 8,
      emoji: '🌿',
      name: 'Bush',
      hp: 1,
      drops: { currency: [3, 5], cards: 0.3 }
    }
  ],

  // Enemies
  enemies: [
    {
      x: 4, y: 8,
      emoji: '🐌',
      name: 'Sleepy Snail',
      hp: 2,
      maxHp: 2,
      attack: 1,
      defense: 0,
      sightRange: 1,
      patrolType: 'stationary',
      orientation: 'south',
      dropTable: { currency: [5, 10], cards: 0.4 }
    }
  ],

  // Border configuration
  border: {
    thickness: 1,
    style: 'natural',
    tiles: ['🌳', '🌲', '🪨']
  }
};
```

## Floor 1: Village Entrance

**Teaching Objective:** Breakables contain things. Hit things, get things.

### Design Principles

1. **No Combat Threats:** Zero enemies, pure exploration
2. **Tutorial Gate:** Breakable wooden gate blocks path to exit
3. **Guaranteed Rewards:** Pickups behind gate teach value of exploration
4. **Village Cluster:** Buildings create natural exploration paths

### Current Layout

- **Player Spawn:** (30, 10) - Eastern side of map
- **Exit:** (20, 17) - Southern area, behind tutorial gate
- **Buildings:** 6 total (houses, cottage, chapel) in center-left quadrant
- **Decorations:** Mailbox, sign post, bench, lantern (visual ambiance)
- **Breakables:** 6 objects (bushes, logs, crates, picnic basket)
- **Tutorial Gate:** 3-tile wooden gate at (18-20, 14) blocks exit path

### Editing Floor 1

To modify Floor 1, edit `FLOOR_1_LAYOUT` in `tutorial-floors.js`:

```javascript
// Add a new breakable
breakables: [
  // ... existing breakables
  {
    x: 15, y: 12,
    emoji: '🪨',
    name: 'Boulder',
    hp: 3,
    drops: { currency: [10, 20], cards: 0.5 }
  }
],

// Move player spawn to different location
player: { x: 25, y: 8 },  // Further west

// Change gate material
tutorialGate: {
  positions: [
    { x: 18, y: 14 },
    { x: 19, y: 14 },
    { x: 20, y: 14 }
  ],
  emoji: '🚧',  // Change to '🪵' for log barrier
  name: 'Wooden Gate',
  hp: 2,
  message: 'A wooden gate blocks your path. Try breaking it!'
}
```

## Floor 2: The Key Quest (Hourglass Layout)

**Teaching Objective:** Items can unlock barriers. NPCs point you in directions. Equip keys from inventory.

### Design Principles

1. **Chip's Challenge Key-Gate Flow:** Key hidden in breakable → auto-equips to active slot → walk to gate → toggle + interact to poof gate open
2. **NPC Guidance:** Elder NPC uses `pointsAt` to physically orient toward key location
3. **Hourglass Topology:** Wide top half, 4-tile chokepoint with locked gate, wide bottom half. Both doors visible from spawn
4. **No Combat:** Safe environment to learn item + gate mechanics

### Current Layout (Hourglass Template)

```
########################################
#......................................#   ← Top half: open exploration
#..P...................................#   ← Player spawn (3, 2)
#......................................#
#......................................#   ← Elder NPC at (8, 4)
#......................................#   ← Key breakable at (34, 5)
#......................................#
##########....................##########   ← Hourglass narrows
##################LLLL##################   ← Locked gate: 4 tiles at x=18-21
##########....................##########   ← Hourglass widens
#####..............................#####
#......................................#   ← Bottom half: exit area
#......................................#
#......................................#
#......................................#
#......................................#
#......................................#
#......................................#
#...................E..................#   ← Exit at (20, 18)
########################################
```

- **Player Spawn:** (3, 2) — Top-left, can see both halves
- **Exit:** (20, 18) — Bottom center, visible through gate gap
- **Locked Gate:** 4-tile wall at (18-21, y=8), requires `RUSTY_KEY`
- **Key Breakable:** Flower patch at (34, 5), drops Tier 2 `RUSTY_KEY`
- **Elder NPC:** At (8, 4), `pointsAt: { x: 34, y: 5 }` — hints at key location
- **Breadcrumb Pickups:** Currency behind gate to reward unlocking

### Editing Floor 2

**Moving the Locked Gate:**

```javascript
lockedGate: {
  positions: [
    { x: 18, y: 8 }, { x: 19, y: 8 },
    { x: 20, y: 8 }, { x: 21, y: 8 }
  ],
  requiresKey: 'RUSTY_KEY',
  emoji: '🚪',
  name: 'Locked Gate'
}
```

**Changing Key Location:**

```javascript
keyBreakable: {
  x: 12, y: 6,
  emoji: '🧺',
  name: 'Picnic Basket',
  hp: 2,
  drops: {
    item: { keyType: 'RUSTY_KEY', tier: 2 },
    currency: [5, 10]
  }
}
```

**Key Pickup Behavior:** When the player breaks the `keyBreakable`, the Tier 2 key automatically goes to persistent inventory, plays a pancake-stacker overhead animation, auto-equips to the header active slot, and shows a tooltip hint. The player then walks to the locked gate, toggles the active item, and interacts — the gate poofs away with a 💨 effect.

## Floor 3: First Encounters

**Teaching Objective:** Combat basics with weakest possible enemies.

### Design Principles

1. **Passive Enemies:** Very low HP (2-3), minimal threat
2. **Small Sight Cones:** 1-3 tile awareness range (easy to avoid)
3. **Open Arena:** Clear sightlines for learning enemy awareness
4. **Attack Card Drops:** Breakables provide guaranteed combat cards

### Current Layout

- **Player Spawn:** (20, 5) - Northern-central area
- **Exit:** (20, 16) - Southern area (unblocked)
- **Enemies:** 3 passive creatures
  - 🐌 Sleepy Snail (HP: 2, sight: 1, stationary)
  - 🐝 Drowsy Bee (HP: 2, sight: 3, circular patrol)
  - 🐛 Lazy Caterpillar (HP: 3, sight: 1, stationary)
- **Breakables:** 4 objects with card drops

### Editing Floor 3

**Adjusting Enemy Difficulty:**

```javascript
enemies: [
  {
    x: 4, y: 8,
    emoji: '🐌',
    name: 'Sleepy Snail',
    hp: 3,              // Increase HP
    maxHp: 3,
    attack: 2,          // Increase attack
    defense: 1,         // Add defense
    sightRange: 2,      // Increase awareness
    patrolType: 'stationary',
    orientation: 'south',
    dropTable: { currency: [5, 10], cards: 0.4 }
  }
]
```

**Adding Patrol Paths:**

```javascript
{
  x: 24, y: 8,
  emoji: '🐝',
  name: 'Drowsy Bee',
  // ... other properties
  patrolType: 'circular',
  patrolPath: [
    { x: 24, y: 8 },
    { x: 26, y: 8 },
    { x: 26, y: 10 },
    { x: 24, y: 10 }
  ],
  orientation: 'south'
}
```

**Adding New Enemy:**

```javascript
enemies: [
  // ... existing enemies
  {
    x: 12, y: 14,
    emoji: '🦗',
    name: 'Confused Cricket',
    hp: 1,
    maxHp: 1,
    attack: 1,
    defense: 0,
    sightRange: 1,
    patrolType: 'stationary',
    orientation: 'west',
    dropTable: { currency: [3, 8], cards: 0.3 }
  }
]
```

## Grid Coordinate System

```
     X →
   0 1 2 3 4 ... 39
Y  ┌─────────────────┐
0  │ # # # # # # # # │  (Border walls)
1  │ # . . . . . . # │
2  │ # . 🏠 . . . . # │
3  │ # . . . . . . # │
↓  │ . . . . . . . . │
19 │ # # # # # # # # │  (Border walls)
   └─────────────────┘

Grid Dimensions: 40 wide × 20 tall
```

- **Origin:** Top-left (0, 0)
- **X-axis:** Left to right (0-39)
- **Y-axis:** Top to bottom (0-19)
- **Border:** Walls automatically placed at edges if `border` config present
- **Safe Zone:** (1, 1) to (38, 18) for entity placement

## Property Reference

### Breakable Objects

```javascript
{
  x: 10,              // X coordinate (1-38)
  y: 8,               // Y coordinate (1-18)
  emoji: '🌿',        // Visual representation
  name: 'Bush',       // Display name
  hp: 1,              // Hit points to destroy
  drops: {
    currency: [3, 5], // Min/max currency drop range
    cards: 0.3,       // Card drop chance (0.0-1.0)
    item: 'key_id'    // Specific item ID (optional)
  }
}
```

### Enemy Configuration

```javascript
{
  x: 4,                     // X coordinate
  y: 8,                     // Y coordinate
  emoji: '🐌',              // Visual sprite
  name: 'Sleepy Snail',     // Display name
  hp: 2,                    // Current HP
  maxHp: 2,                 // Maximum HP
  attack: 1,                // Attack damage
  defense: 0,               // Defense value
  sightRange: 1,            // Sight cone radius (tiles)
  patrolType: 'stationary', // 'stationary' | 'circular' | 'patrol'
  patrolPath: [             // Required for circular/patrol
    { x: 4, y: 8 },
    { x: 6, y: 8 }
  ],
  orientation: 'south',     // 'north' | 'south' | 'east' | 'west'
  dropTable: {
    currency: [5, 10],      // Currency drop range
    cards: 0.4              // Card drop chance
  }
}
```

### Building Placement

```javascript
{
  x: 4,           // X coordinate
  y: 2,           // Y coordinate
  emoji: '🏠',    // Building emoji
  name: 'Village House'
}
```

**Note:** Buildings are placed as `TILES.WALL` in the logical grid (impassable) but rendered with emoji overlay.

### Decoration Placement

```javascript
{
  x: 6,           // X coordinate
  y: 3,           // Y coordinate
  emoji: '📬',    // Decoration emoji
  name: 'Mailbox'
}
```

**Note:** Decorations are walkable (visual-only overlay).

## Testing Your Changes

### 1. Save Changes

Edit `public/js/tutorial-floors.js` and save the file.

### 2. Clear Browser Cache

Shift+Reload or clear cache to ensure new script loads.

### 3. Start Game

- Navigate to the site in browser
- Enter Gone Rogue mode
- Type `ROGUE` at terminal

### 4. Test Floor

- Observe floor layout matches your changes
- Break objects to test drop rates
- Engage enemies to test combat stats
- Reach exit to test progression

### 5. Iterate

If changes don't work as expected:
- Check browser console for errors (`F12` → Console tab)
- Look for `[TutorialFloors]` log messages
- Verify coordinates are within grid bounds (1-38, 1-18)
- Ensure HP values are positive integers
- Check drop chance values are between 0.0 and 1.0

## Common Modifications

### Increasing Floor Difficulty

```javascript
// More enemies
enemies: [
  // ... add more enemy objects
],

// Tougher breakables
breakables: [
  {
    x: 10, y: 8,
    emoji: '🪨',
    name: 'Boulder',
    hp: 5,  // Increase HP
    drops: { currency: [8, 15], cards: 0.6 }
  }
]
```

### Adding More Buildings

```javascript
buildings: [
  // ... existing buildings
  { x: 20, y: 5, emoji: '🏛️', name: 'Temple' },
  { x: 25, y: 8, emoji: '🏗️', name: 'Workshop' }
]
```

### Creating Dense Forest

```javascript
// Add many trees/bushes
buildings: [
  { x: 10, y: 5, emoji: '🌳', name: 'Tree' },
  { x: 12, y: 5, emoji: '🌲', name: 'Pine' },
  { x: 14, y: 5, emoji: '🌳', name: 'Tree' },
  { x: 16, y: 5, emoji: '🌲', name: 'Pine' },
  // ... more trees for dense forest feel
]
```

### Changing Rewards

```javascript
// Higher currency drops
tutorialPickups: [
  { x: 20, y: 16, type: 'currency', amount: 100 },  // Was 50
  { x: 19, y: 16, type: 'card', guaranteed: true },
  { x: 21, y: 16, type: 'card', guaranteed: true }   // Extra card
]
```

## Key System Reference (3 Tiers + ID Conventions)

Tutorial floors rely on a **3-tier key model**. The tiers deliberately use **two different ID systems** so designers can tell at a glance how a key behaves.

### Quick Table

| Tier | What it unlocks | ID pattern | Lives in | Storage | Consumption |
|---:|---|---|---|---|---|
| 1 | Cheap locks / breakable puzzles (ammo-like) | `KEY_0X2`, `KEY_0X4` (even suffix) | `public/js/environmental-synergy.js` → `KEY_ITEMS` | **loose inventory** | auto-consume at lock; **lost on death** |
| 2 | Doors / gates (real inventory items) | `ITM-01X` (`ITM-010`–`ITM-019`) | `public/data/gone-rogue/items.json` + data registry | **persistent inventory** + **active slot** | consume-on-use via active-item workflow |
| 3 | Quest turn-ins (NPC rewards) | `ITM-03X` (`ITM-030`–`ITM-039`) | `items.json` + data registry | persistent inventory | **never** consumed by gates; only by NPC turn-in |

### Tier 1 — Ammo Keys (environmental / consumable)

- **ID pattern:** `KEY_0X2`, `KEY_0X4` (even suffix convention)
- **Definition:** `public/js/environmental-synergy.js` → `KEY_ITEMS`
- **Required fields (in KEY_ITEMS):**
  - `consumeOnUse: true`
  - `tier: 1` (added for standardization)
- **Behavior:** goes to **loose inventory**, auto-consumed at matching locks, **lost on death**.

Example placement inside a breakable:

```js
breakables: [{
  x: 10, y: 5,
  emoji: '🏺',
  name: 'Clay Pot',
  hp: 1,
  drops: { item: 'KEY_002', currency: [2, 5] }
}]
```

### Tier 2 — Gate/Door Keys (inventory items)

- **ID pattern:** `ITM-01X` (reserved range `ITM-010`–`ITM-019`)
- **Definition:** `public/data/gone-rogue/items.json` (loaded by `GoneRogueDataRegistry`)
- **Required fields (items.json):**
  - `type: "key"`
  - `subtype: "gate"` (or `"door"` if you prefer—keep it consistent)
  - `equipSlot: "active"`
  - `consumeOnUse: true`
- **Behavior:** goes to **persistent inventory**, triggers overhead pickup feedback, typically **auto-equips** to active slot for tutorial flow.

### Tier 3 — Quest Keys (NPC turn-in)

- **ID pattern:** `ITM-03X` (reserved range `ITM-030`–`ITM-039`)
- **Definition:** `items.json` with `type:"key"`, `subtype:"quest"`
- **Behavior:** goes to **persistent inventory**, **does not** auto-equip, and is **not** consumed by gates.

Example (quest key in items.json):

```json
{
  "id": "ITM-030",
  "name": "Blacksmith's Hammer",
  "emoji": "🔨",
  "type": "key",
  "subtype": "quest",
  "rarity": "rare",
  "stackable": false,
  "maxStack": 1,
  "equipSlot": "active",
  "effects": [{ "type": "quest_turn_in", "npcTarget": "BLACKSMITH", "rewardType": "card_upgrade" }],
  "description": "Return it to the forge for a powerful reward.",
  "consumeOnUse": true
}
```

### ID Range Reservations

- `KEY_0X2`, `KEY_0X4` → Tier 1 ammo keys (even suffix)
- `ITM-010`–`ITM-019` → Tier 2 gate/door keys
- `ITM-020`–`ITM-029` → deployables (boxes)
- `ITM-030`–`ITM-039` → Tier 3 quest keys

### Implementation Notes (for designers)

- **Pickup branching** is implemented in `public/js/gone-rogue.js`:
  - Tier 1 → loose inventory
  - Tier 2 → persistent inventory + auto-equip (tutorial flow)
  - Tier 3 → persistent inventory + quest tooltip (no auto-equip)
- **Consumption branching** in `gone-rogue.js`:
  - Tier 1 → consumed from loose inventory
  - Tier 2 → consumed from active item slot
  - Tier 3 → consumed only via NPC turn-in interaction

## Planned Features

### Implemented

1. **NPC Interaction System** ✓
   - NPCs render on map with dialogue on interact
   - `pointsAt` directional indicators functional (NPC faces target location)
   - Gate-blocking NPCs relocate during final guarantee pass

2. **Locked Gate Mechanics** ✓
   - Tier 1 + Tier 2 key pickup, storage, and consumption fully functional
   - Multi-tile gate clearing with 💨 poof effect
   - Active slot equip → toggle → interact workflow

3. **Item-Based Puzzle System** (Partial) ✓
   - Tier 1 ammo keys and Tier 2 gate keys implemented
   - Tier 3 quest keys registered but NPC turn-in reward flow pending
   - See [Key System Reference](#key-system-reference) for full details

4. **Dynamic NPC Pointing** ✓
   - NPCs use `pointsAt` to orient toward key/item locations
   - Rendered with directional emoji indicators

### Not Yet Implemented

1. **Tutorial Message System**
   - No in-game hints or tutorial text overlays
   - Players learn through environmental design only

2. **Quest Key NPC Turn-In Rewards**
   - `_consumeQuestItem()` is registered but reward dispensing (card upgrades, gems) requires CardSystem integration
   - Blacksmith + Runesmith NPCs need onInteract callbacks wired up

## Advanced: Creating New Floors

To add Floor 4 (or extend beyond Floor 3):

### Step 1: Define Layout

Add to `tutorial-floors.js`:

```javascript
var FLOOR_4_LAYOUT = {
  floorNumber: 4,
  name: 'Advanced Combat',
  description: 'Face multiple enemies at once.',

  player: { x: 20, y: 5 },
  exit: { x: 20, y: 18 },

  buildings: [],
  decorations: [],
  breakables: [
    // ... define breakables
  ],
  enemies: [
    // ... define 5-8 enemies with varied patrol paths
  ],
  border: {
    thickness: 1,
    style: 'natural',
    tiles: ['🌳', '🌲', '🪨']
  }
};
```

### Step 2: Add to Switch Statement

```javascript
function getFloorLayout(floorNumber) {
  switch (floorNumber) {
    case 1:
      return FLOOR_1_LAYOUT;
    case 2:
      return FLOOR_2_LAYOUT;
    case 3:
      return FLOOR_3_LAYOUT;
    case 4:
      return FLOOR_4_LAYOUT;  // Add new case
    default:
      return null;
  }
}
```

### Step 3: Update Bounds Check

```javascript
function isContrivedFloor(floorNumber) {
  return floorNumber >= 1 && floorNumber <= 4;  // Change upper bound
}
```

### Step 4: Export for Tooling

```javascript
return {
  // ... existing exports
  FLOOR_4_LAYOUT: FLOOR_4_LAYOUT  // Add export
};
```

## Troubleshooting

### Floor Doesn't Generate

**Symptom:** Procedural floor appears instead of custom layout
**Causes:**
- Script load order incorrect in `index.html`
- Browser cache not cleared
- Syntax error in layout definition
- Floor number outside 1-3 range

**Solutions:**
- Verify `tutorial-floors.js` loads before `gone-rogue.js`
- Hard reload browser (Ctrl+Shift+R)
- Check console for JavaScript errors
- Extend `isContrivedFloor()` if adding new floors

### Entities Don't Appear

**Symptom:** Buildings, enemies, or breakables missing
**Causes:**
- Coordinates outside grid bounds (0-39, 0-19)
- Coordinates overlap with walls
- Missing required properties (x, y, emoji)

**Solutions:**
- Verify coordinates within safe zone (1-38, 1-18)
- Check template for wall conflicts
- Add console.log to `_generateContrivedTutorialFloor()` to debug

### Game Crashes on Floor Load

**Symptom:** Error in console, floor fails to load
**Causes:**
- Invalid property types (string instead of number)
- Missing required layout properties
- Circular reference in patrol paths

**Solutions:**
- Check all HP/damage values are positive integers
- Ensure `player`, `exit`, and `border` are defined
- Verify patrol paths don't reference same point twice

### Drop Rates Not Working

**Symptom:** Breakables drop wrong items or amounts
**Causes:**
- Drop chance outside 0.0-1.0 range
- Currency range malformed [min, max]
- Drop system integration incomplete

**Solutions:**
- Set card drop chance between 0.0 (never) and 1.0 (always)
- Ensure currency is `[minAmount, maxAmount]` array
- Check console for drop calculation errors

## Designer Workflow

### Recommended Process

1. **Plan on Paper**
   - Sketch 40×20 grid layout
   - Mark player spawn, exit, key locations
   - Design enemy patrol routes
   - Identify teaching moments

2. **Edit Layout Object**
   - Update coordinates in `tutorial-floors.js`
   - Set HP, damage, sight ranges
   - Configure drop rates

3. **Test in Browser**
   - Load game, enter Gone Rogue
   - Play through floor multiple times
   - Note issues or improvements

4. **Iterate**
   - Adjust based on playtest feedback
   - Fine-tune difficulty curve
   - Polish visual layout

5. **Document Changes**
   - Add comments explaining design intent
   - Note any dependencies or special mechanics
   - Update this guide if adding new features

## API Reference

### TutorialFloors Module

```javascript
// Check if floor uses custom layout
TutorialFloors.isContrivedFloor(floorNumber: number): boolean

// Get layout definition for floor
TutorialFloors.getFloorLayout(floorNumber: number): Object | null

// Generate floor data from layout
TutorialFloors.generateContrivedFloor(layout: Object): FloorData

// Direct access to layouts (for tooling)
TutorialFloors.FLOOR_1_LAYOUT: Object
TutorialFloors.FLOOR_2_LAYOUT: Object
TutorialFloors.FLOOR_3_LAYOUT: Object
```

### FloorData Structure

```javascript
{
  grid: Array<Array<string>>,     // 2D grid array (40×20)
  player: { x: number, y: number },
  exit: { x: number, y: number },
  buildings: Array<Building>,
  decorations: Array<Decoration>,
  breakables: Array<Breakable>,
  enemies: Array<Enemy>,
  npcs: Array<NPC>,
  tutorialGate: Object | undefined,
  lockedGate: Object | undefined,
  keyBreakable: Object | undefined,
  tutorialPickups: Array<Pickup>,
  border: BorderConfig,
  metadata: {
    name: string,
    description: string,
    floorNumber: number
  }
}
```

## Version History

### v1.0.0 (2026-02-20)
- Initial implementation of tutorial floor system
- Floor 1: Village Entrance (complete)
- Floor 2: Key Quest (partial - NPCs pending)
- Floor 3: First Encounters (complete)
- Integration with gone-rogue.js generation pipeline

---

## Support

For questions, issues, or feature requests related to the tutorial floor system:

1. Check console for `[TutorialFloors]` debug messages
2. Review this guide's [Troubleshooting](#troubleshooting) section
3. Test changes in isolation (one floor at a time)
4. Document unexpected behavior with screenshots and console logs
