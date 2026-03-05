# Roadmap: Rope Nodes, Triplines, Harpoon & Grappling Hook

This document describes the rope system — an interactive node type (like breakable lights and barrels) that functions as both a standalone tactical tool and as ammo for the harpoon and grappling hook equipped items.

**Companion docs:**
- [ROPE_BUTTONS_LEVERS_SYSTEM.md](./ROPE_BUTTONS_LEVERS_SYSTEM.md) — original design guide
- [THEFT_MECHANICS.md](./THEFT_MECHANICS.md) — card hand interaction, plantable slots, C4 flow
- [ENEMY_NCH_INTERACTION_ROADMAP.md](./ENEMY_NCH_INTERACTION_ROADMAP.md) — enemy capsule, plant mechanic, card interchange
- [INPUT_PLAYER_CONTROLLER.md](./INPUT_PLAYER_CONTROLLER.md) — movement pipeline, tile traversal, tap priority
- [LIGHTING_BREAKABLES.md](./LIGHTING_BREAKABLES.md) — breakable node pattern reference

---

## Core Design Principle

**Rope is NOT an inventory item. Rope is an interactive map node** — spawned during floor generation like lanterns, barrels, and other breakables. The player interacts with rope nodes by clicking them, running away to "let out" the rope, then clicking a breakable to "install" a tripline. Harpoon and grappling hook are *equipped items* that consume rope nodes as ammo.

Buttons, levers, and ropes are all **interactive nodes** — map objects with a universal contract, analogous to breakable lights. They are placed by floor generation systems and share the same collision, rendering, and interaction patterns as other breakable/interactive objects.

---

## Validation Audit (2026-03-05)

### Phase 0: Module Rewrite ✅ COMPLETE

| Task | Status |
|------|--------|
| Rewrote `ropeManager.js` as IIFE singleton | ✅ |
| Replaced ES6 class + template literals | ✅ |
| Removed test rope spawn at (5,5) from `floor-gen-core.js` | ✅ |
| Removed `_ropeManager` / `setRopeManager` from `gone-rogue.js` and `game.js` | ✅ |
| `RopeManager.reset()` wired in `run-start-system.js` | ✅ |
| Cache bust `?v=20260305k` on `index.html` | ✅ |
| OverheadAnimator feedback (➰/✅/❌) | ✅ |

**Note:** Phase 0 established the IIFE module and removed dead code. The `RopeManager` state machine and public API will be significantly reworked in Phase 1 to match the new node-based design below.

---

## Node Architecture

### Interactive Node Types

All interactive nodes share a universal contract and are placed by floor generation:

```
INTERACTIVE_NODE_PROPS = {
  ROPE: {
    emoji: '➰',
    hp: 1,
    kickable: true,
    type: 'rope',
    interactable: true,         // player can click to begin "letting out"
    collision: false,           // player can walk onto rope node tile
    destroyedGlyph: '·'        // rope consumed after use
  },
  LEVER: {
    emoji: '🔩',
    hp: 2,
    kickable: false,
    type: 'lever',
    interactable: true,
    ropeAnchorable: true,       // rope can install to this
    collision: true,
    toggle: function() { ... }
  },
  BUTTON: {
    emoji: '🔘',
    hp: 1,
    kickable: false,
    type: 'button',
    interactable: true,
    ropeAnchorable: false,
    collision: true,
    holdRequired: 0,
    press: function() { ... }
  }
}
```

Rope nodes are spawned by floor generation alongside breakable lights, barrels, etc. They appear as ➰ on map tiles and are walkable (no collision). They are the **ammo** for all rope-based mechanics.

### Interactive Node vs Breakable Node Comparison

| Property | Breakable (barrel, light) | Interactive Node (rope, lever, button) |
|----------|--------------------------|---------------------------------------|
| Placed by | Floor generation | Floor generation |
| Has HP | Yes | Yes (rope=1, lever=2, button=1) |
| Kickable | Some | Rope: yes, lever/button: no |
| Walkable | No (collision) | Rope: yes, lever/button: no |
| Tap interaction | Kick/smother/drag | Click to activate node behavior |
| Destruction | Visual VFX + loot | Node consumed (rope) or toggled (lever) |
| Grid representation | `TILES.BREAKABLE` | `TILES.INTERACTIVE` (new) or `TILES.BREAKABLE` |

---

## Rope Lifecycle: Let Out → Install → Tripline

### Step 1: Click Rope Node → "Letting Out the Rope"

Player taps/clicks an adjacent rope node (➰). The rope attaches to the player with an overhead ➰ animation. The rope node's originating tile becomes the **anchor point A**.

```
State: idle → lettingOut
Visual: ➰ overhead on player avatar, rope line draws from anchor tile to player
Audio: subtle rope uncoil sound
```

The player is now "letting out the rope" — as they move away from the anchor tile, the rope visually extends (rendered line from anchor A to player position). The rope has a maximum length (`MAX_ROPE_LENGTH = 8` tiles Manhattan distance).

### Step 2: Move Away → Rope Extends

While in `lettingOut` state, every frame the rope line renders from anchor A to the player's current tile. Moving increases rope length. The player has a small speed penalty (`ROPE_SPEED_PENALTY = 0.05`, 5% slower — carrying weight).

**Auto-cancel conditions:**
- Player moves beyond `MAX_ROPE_LENGTH` → rope snaps, overhead ❌, state → `idle`
- Player enters STR combat → rope cancelled, combat takes priority
- Player taps self → rope cancelled (deliberate cancel)

### Step 3: Click Breakable → "Install the Rope" (Tripline)

While in `lettingOut` state, if the player taps an adjacent breakable (barrel, tree/wall tile, another breakable), the rope **installs** as a tripline between anchor A (rope node) and anchor B (the breakable).

```
State: lettingOut → idle
Action: Tripline created between anchor A and anchor B
Visual: ➰ overhead releases from player, persistent rope line between A and B
Rope node consumed: hp → 0, tile glyph → destroyedGlyph
```

The installed tripline is a persistent environmental trap managed by a `TriplineSystem` (or integrated into `RopeManager`).

### Step 4: Installed Tripline → Enemy Binding

An installed tripline (rope between two anchor points) acts as a **movement blocker for enemies**. When an enemy's pathfinding crosses the tripline:

```
Enemy contacts tripline:
  1. Enemy halts movement immediately (pathfinding blocked)
  2. Enemy enters BOUND state:
     · Enemy spins facing direction (visual: rotating face glyph cycle)
     · Enemy alerts nearby enemies (raises awareness within 3-tile radius)
     · Enemy CANNOT engage player in combat while bound
     · Enemy CANNOT move while bound
  3. Tripline breaks (single use — rope consumed on catch)
  4. Enemy stays bound until:
     · Player engages enemy (tap to initiate STR combat — enemy starts at disadvantage)
     · Player plants on enemy (see §Tripline + C4 Plant below)
     · Timer expires (BOUND_DURATION = 8 turns — eventually wriggles free)
```

**Bound enemy properties:**
- `enemy.bound = true`
- `enemy.boundTurns = 0` (increments each turn, breaks free at `BOUND_DURATION`)
- `enemy.alertedOthers = true` (one-time alert pulse on bind)
- Cannot move, cannot initiate combat, CAN be engaged by player
- Visual: enemy emoji rotates through facing directions (↑→↓← cycle every 400ms)

### Self-Tap Cancel

At any point during `lettingOut` state, the player can tap themselves to cancel:

```
Self-tap during lettingOut:
  1. Rope releases from player (overhead ➰ disappears)
  2. Rope node at anchor A is NOT consumed (still usable)
  3. State → idle
  4. No penalty
```

---

## Tripline + C4 Plant Integration

When an enemy is caught in a tripline (bound state), the player can interact with them via the existing card hand system (see THEFT_MECHANICS.md §9, ENEMY_NCH_INTERACTION_ROADMAP.md Phase 2).

**Key mechanic:** A bound enemy's card deck hand is hydrated with a **plantable BLVCK slot for C4** that wouldn't normally be there. This is the rope system's reward — catching an enemy in a tripline opens up a planting opportunity.

```
Bound enemy card deck modification:
  1. On bind: enemy.cardDeck gets an extra BLVCK slot appended:
     {
       id: null,
       stolen: false,
       planted: null,
       isBlvckSlot: true,
       ropeBonus: true,        // flag: this slot was created by tripline bind
       meta: { source: 'tripline', turn: currentTurn }
     }
  2. Player can long-press bound enemy → opens NCH capsule minimized
  3. The bonus BLVCK slot is available for PLANT action
  4. Player drags C4_CHARGE (or other plantable) into the bonus slot
  5. Planted card follows standard detonation rules (THEFT_MECHANICS.md §9):
     · Manual trigger via R / RB / puff-tube-2 with detonator
     · Synergy-triggered auto-fire if enemy plays matching tag card
     · C4 has 1-turn armed delay before triggerable
```

**Why this matters for gameplay:**
- Tripline catches create a safe window to plant explosives without entering combat
- The bonus BLVCK slot is ONLY available while the enemy is bound (disappears if they break free)
- Creates a loop: find rope node → let out → install on breakable → catch enemy → plant C4 → detonate remotely or enter combat with planted advantage
- Ties into ENEMY_NCH_INTERACTION_ROADMAP Phase 2 (plant drag animation) and Phase 5 (explosive plant flow)

---

## Harpoon Item 🔱

**The harpoon is an EQUIPPED ITEM (not a node).** It uses rope nodes as ammo.

### Fantasy

"I spear that enemy with my harpoon and drag them across the map to me."

### Mechanic

The harpoon changes the behavior of the player's projectile tap. When the harpoon is equipped AND the player is in one of two states:

**State A — Standing adjacent to a rope node:**
Player taps an enemy within range → instead of normal projectile, the harpoon fires an arrow projectile at the enemy. On hit, the enemy is dragged from their tile to a tile adjacent to the player. The rope node is consumed as ammo.

**State B — Currently "letting out the rope" at distance:**
Player is in `lettingOut` state (rope already attached from a node) and taps an enemy → harpoon fires using the extended rope as a tether. Enemy is dragged to the player. Rope consumed.

In both cases, the projectile uses the existing `projectile-system.js` pipeline — the harpoon fires an arrow emoji (🏹 or 🔱) along the path, and on hit, the drag begins.

### Enemy Drag Path + Ground Effects

The dragged enemy traverses every tile between their start position and the player. At each tile, `ground-effects.js` effects apply:

| Ground Effect | Result on Dragged Enemy |
|--------------|------------------------|
| `SCORCHED` | Fire damage tick per tile |
| `WET` | Slow debuff stack |
| `TOXIC` | Poison tick per tile |
| `ICE` | Enemy slides extra tiles (bonus displacement) |
| `OIL` | If enemy passes through fire afterward, ignite |
| `GLASS` | Minor bleed damage per tile |

**Drag path calculation:** Bresenham line from enemy position to player position. Enemy slides through each tile at 2 tiles/frame visual speed. Drag blocked by walls — enemy stops at last open tile before wall.

### STR Combat Initialization

On arrival at the player's adjacent tile, STR combat auto-initiates with the enemy in a **bound + damaged** state:

```
Combat modifiers from harpoon drag:
  · Enemy starts BOUND (cannot act turn 1)
  · Enemy has "Reeled In" debuff: -20% DEF for first 2 combat rounds
  · All ground-effect damage from drag path already applied
  · Player gets "Harpoon Strike" opener: +15% first-hit damage
```

This creates a powerful pre-combat combo: set up ground effects (scorched/toxic tiles) along the drag path → harpoon enemy through them → arrive at combat with a weakened, bound enemy.

### Card Synergy Tie-Ins

Harpoon and rope should have extensive card synergy for pre-combat into STR-combat combos:

| Card / Item | Synergy with Harpoon |
|------------|---------------------|
| **Chain cards** (EATK-CHAIN-*) | Extend drag distance by 2 tiles per chain card in hand |
| **Rope cards** (ACT-ROPE-*) | +1 turn of enemy BOUND state per rope card |
| **Binding Strike** (combat card) | If enemy was harpooned, Binding Strike does 2x damage |
| **Anchor Chain** (passive) | Harpooned enemies cannot break free from bound state |
| **Barbed Line** (weapon mod) | Harpoon drag deals +2 bleed damage per tile traversed |
| **Winch Mechanism** (passive) | Harpoon drag speed doubled (4 tiles/frame), enemy takes impact damage on arrival |
| **Net Throw** (card) | After harpoon drag, adjacent enemies also get 1-turn slow |

### Harpoon Item Properties

```json
{
  "id": "ITM-HARPOON",
  "name": "Harpoon",
  "type": "weapon",
  "emoji": "🔱",
  "slot": "active",
  "ammoType": "rope",
  "minFireDistance": 2,
  "maxFireDistance": 8,
  "requiresRopeAmmo": true,
  "dragOnHit": true,
  "groundEffectDrag": true,
  "boundOnArrival": true,
  "combatModifiers": {
    "enemyDefReduction": 0.20,
    "enemyBoundTurns": 1,
    "playerFirstHitBonus": 0.15
  }
}
```

---

## Grappling Hook Item 🪝

**The grappling hook is an INVENTORY ITEM (passive).** It uses rope nodes as both targets and ammo. Its presence in inventory enables special click behaviors.

### Fantasy

"I click a distant rope node and zip across the map to it. Or I click an enemy and yank myself into combat."

### Mechanic: Rope Node Teleport

When the grappling hook is in the player's inventory (passive — doesn't need to be equipped in active slot):

**Player clicks a rope node at large distance** (beyond normal adjacency range, up to `GRAPPLE_MAX_DISTANCE`):
1. Player fires grappling hook projectile at the rope node
2. On connect: player teleports to the rope node's tile (fishing-style movement — lerp-dash through tiles)
3. **Can pass through walls** (grapple teleport is the same physics as fishing rod movement — see INPUT_PLAYER_CONTROLLER.md)
4. Rope node consumed as ammo
5. Overhead 🪝 animation on arrival

This enables massive map traversal — the player can grapple to distant rope nodes to skip sections, escape combat, or reposition strategically.

### Mechanic: Enemy Grapple

When the grappling hook is in inventory AND the player clicks an enemy:

1. Player fires grappling hook at enemy
2. On connect: player teleports to tile adjacent to enemy (lerp-dash)
3. **Cannot pass through walls** (enemy grapple requires LOS — clear path)
4. On arrival: STR combat auto-initiates with "Grapple Strike" opener (+15% first-hit)
5. Rope node consumed (must have been standing adjacent to one, or in `lettingOut` state)
6. Enemy gets 1-turn BOUND at combat start

### Durability System

The grappling hook has a **durability factor based on item quality** that scales exponentially. A common hook barely holds together while a legendary one lasts the whole run:

| Quality | Failure Rate | Approximate Uses |
|---------|-------------|-----------------|
| Common (⚪) | 25% per use | ~3-4 uses before break |
| Uncommon (🟢) | 15% per use | ~6 uses |
| Rare (🔵) | 8% per use | ~12 uses |
| Epic (🟣) | 3% per use | ~30 uses |
| Legendary (🟡) | 1% per use | ~100 uses (effectively unlimited) |

**Failure behavior:**
- On failure: grappling hook breaks mid-flight, player stays at original position
- Overhead: 🪝❌ "Hook snapped!"
- Item removed from inventory (consumed on break)
- Exponential scaling formula: `failureChance = BASE_FAILURE * Math.pow(QUALITY_DECAY, qualityTier)`
  - `BASE_FAILURE = 0.25`, `QUALITY_DECAY = 0.55`
  - Common (tier 0): 0.25, Uncommon (tier 1): 0.1375, Rare (tier 2): 0.0756, Epic (tier 3): 0.0416, Legendary (tier 4): 0.0229

### Card Synergy Tie-Ins

| Card / Item | Synergy with Grappling Hook |
|------------|---------------------------|
| **Chain cards** (EATK-CHAIN-*) | +2 tiles grapple range per chain card in hand |
| **Rope cards** (ACT-ROPE-*) | -5% failure rate per rope card (stacks) |
| **Binding Strike** (combat card) | If grappled to enemy, Binding Strike auto-crits |
| **Hookshot** (combat card) | After grapple arrival, next ranged attack has +50% accuracy |
| **Reinforced Line** (passive) | Grappling hook failure rate halved |
| **Momentum Swing** (combat card) | Grapple arrival grants +1 free action (doesn't cost a turn) |
| **Anchor Chain** (passive) | Grapple teleport leaves a persistent rope line behind (free tripline) |

### Grappling Hook Item Properties

```json
{
  "id": "ITM-GRAPPLE-HOOK",
  "name": "Grappling Hook",
  "type": "tool",
  "emoji": "🪝",
  "slot": "passive",
  "ammoType": "rope",
  "requiresRopeAmmo": true,
  "grappleMaxDistance": 15,
  "grappleThroughWalls": true,
  "enemyGrappleThroughWalls": false,
  "durability": {
    "baseFailureRate": 0.25,
    "qualityDecay": 0.55
  },
  "combatModifiers": {
    "enemyBoundTurns": 1,
    "playerFirstHitBonus": 0.15
  }
}
```

---

## Rope as Ammo

Rope nodes serve dual purpose: standalone tripline tool AND ammo for harpoon/grappling hook.

```
Rope consumption rules:
  · Tripline install: rope node consumed (hp → 0)
  · Harpoon fire: rope node consumed (must be adjacent to one OR in lettingOut state)
  · Grapple to rope node: target rope node consumed on arrival
  · Grapple to enemy: nearest rope node consumed (must have one within adjacency or lettingOut)
  · Self-tap cancel during lettingOut: rope node NOT consumed (returned to map)
```

Rope nodes spawn via floor generation like other interactive nodes. Spawn density is tunable per floor tier and biome. Rope is renewable — it spawns each floor, not carried between floors.

---

## RopeManager State Machine (Revised)

```
                    click rope node
idle ─────────────────────────────────────► lettingOut
  ▲                                            │
  │  self-tap / snap / combat                  │
  ├────────────────────────────────────────────┘
  │                                            │
  │  click breakable (install)                 │
  ├────────────────────────────────────────────┘
  │                                            │
  │  harpoon fire / grapple fire               │
  └────────────────────────────────────────────┘
```

States:
- **`idle`** — No rope interaction active. Player moves freely.
- **`lettingOut`** — Rope attached from anchor tile, extending as player moves. Overhead ➰. Speed penalty active. Waiting for install target, harpoon fire, grapple fire, or cancel.

The harpoon drag and grapple teleport are **resolved immediately** (not a persistent state) — they fire a projectile or teleport and return to `idle`.

### Revised Public API

```javascript
RopeManager.clickRopeNode(ropeNode, ctx)  // Start letting out from this node
RopeManager.installTripline(target, ctx)   // Install rope between anchor and target breakable
RopeManager.consumeAsAmmo(ctx)             // Harpoon/grapple consumes the active rope
RopeManager.cancel(ctx)                    // Self-tap cancel, snap, combat interrupt
RopeManager.update(ctx, dt)                // Per-frame: rope line render, distance check, snap
RopeManager.getSpeedPenalty()              // 0.05 if lettingOut, 0 otherwise
RopeManager.isLettingOut()                 // true if lettingOut
RopeManager.getAnchorTile()                // {x, y} of rope node anchor, or null
RopeManager.getRopeLength()                // Current Manhattan distance from anchor
RopeManager.reset()                        // Clear all state (floor init)
```

---

## Revised Phases

### Phase 0: Module Rewrite ✅ COMPLETE (2026-03-05)

See validation audit above. IIFE singleton established, dead code removed, `reset()` wired.

---

### Phase 1: Rope Node + Letting Out

**Objective:** Implement rope as an interactive map node. Player clicks rope node → `lettingOut` state → overhead ➰ → rope line extends as player moves.

- **Tasks:**
  - [ ] Define `INTERACTIVE_NODE_PROPS.ROPE` in new `interactive-node-system.js` (or extend breakable-system)
  - [ ] Add rope node spawning to floor generation (alongside breakable lights/barrels)
  - [ ] Rewrite `RopeManager` state machine: `idle` → `lettingOut` (remove old `hasRope`/`ropeActive` states)
  - [ ] Implement `clickRopeNode(ropeNode, ctx)` — attach rope, set anchor A, enter `lettingOut`
  - [ ] Implement `cancel(ctx)` — release rope, return to `idle`, rope node NOT consumed
  - [ ] Implement `update(ctx, dt)` — check distance, auto-snap if > `MAX_ROPE_LENGTH`
  - [ ] Overhead ➰ animation on player while `lettingOut`
  - [ ] Speed penalty 5% while `lettingOut`
  - [ ] Rewrite `lever.js` and `button.js` from ES6 classes to IIFE or plain object factories (match codebase convention)

- **Wiring — tap-move-system.js:**
  - [ ] If player taps adjacent rope node AND state is `idle`: call `RopeManager.clickRopeNode()`
  - [ ] If player taps adjacent breakable AND state is `lettingOut`: call `RopeManager.installTripline()`
  - [ ] If state is `lettingOut` and player taps non-target: continue movement (rope extends)

- **Wiring — game-tick-system.js:**
  - [ ] Per-frame: if `RopeManager.isLettingOut()`, call `RopeManager.update(ctx, dt)`
  - [ ] Combat interrupt: if `ctx.strCombatActive && RopeManager.isLettingOut()`, call `RopeManager.cancel(ctx)`

- **Wiring — gone-rogue-mobile.js:**
  - [ ] Self-tap: if `RopeManager.isLettingOut()`, call `RopeManager.cancel(ctx)`

- **Wiring — gone-rogue-movement.js:**
  - [ ] Add rope speed penalty in `_getEffectiveSpeed()`: `RopeManager.getSpeedPenalty()`

- **Acceptance Criteria:**
  - Rope nodes spawn on map as ➰ interactive tiles
  - Player can click adjacent rope node → overhead ➰ appears
  - Moving away extends visual rope line from anchor
  - Self-tap cancels without consuming rope
  - Moving beyond MAX_ROPE_LENGTH auto-snaps
  - Combat interrupts cancel rope
  - Speed reduced 5% while letting out

---

### Phase 2: Tripline Installation + Enemy Binding

**Objective:** Clicking a breakable while letting out rope installs a tripline. Enemies crossing the tripline get bound.

- **Tasks:**
  - [ ] Implement `installTripline(breakableTarget, ctx)`:
    - Validate target is a breakable or wall-adjacent tile (`ropeAnchorable`)
    - Create persistent tripline object: `{ anchorA: {x,y}, anchorB: {x,y}, active: true }`
    - Consume rope node (hp → 0, destroyedGlyph)
    - Release ➰ overhead from player
    - State → `idle`
  - [ ] Create `TriplineSystem` IIFE (or integrate into RopeManager):
    - Track active triplines per floor
    - Each game tick: check if any enemy path crosses an active tripline (Bresenham intersection)
    - On enemy contact: bind enemy, break tripline
  - [ ] Implement enemy BOUND state:
    - `enemy.bound = true`, `enemy.boundTurns = 0`
    - Enemy halts movement (pathfinding returns empty)
    - Enemy spins facing direction (visual: rotate face glyph every 400ms)
    - Enemy alerts nearby enemies (awareness pulse, 3-tile radius, one-time on bind)
    - Enemy CANNOT engage player or initiate combat while bound
    - Bound expires after `BOUND_DURATION = 8` turns OR when player engages
  - [ ] Tripline rendering: persistent line between anchor A and anchor B (canvas overlay)
  - [ ] Tripline breaks on catch (single use) — visual: line snaps with brief particle
  - [ ] `maxActiveTriplines` limit (default: 3 per floor)
  - [ ] Overhead on enemy: 🪢 "Bound!" when caught

- **Acceptance Criteria:**
  - Player can install tripline between rope node and breakable
  - Tripline visually renders as persistent line on map
  - Enemy crossing tripline gets bound (halts, spins, alerts)
  - Bound enemy cannot move or engage until player initiates or timer expires
  - Tripline breaks on catch
  - Max 3 active triplines per floor

---

### Phase 3: Tripline + C4 Plant (Card Hand Hydration)

**Objective:** Bound enemies from triplines get a bonus plantable BLVCK slot in their card deck for C4 planting.

- **Tasks:**
  - [ ] On enemy bind from tripline: hydrate `enemy.cardDeck` with bonus BLVCK slot:
    ```javascript
    enemy.cardDeck.push({
      id: null,
      stolen: false,
      planted: null,
      isBlvckSlot: true,
      ropeBonus: true,
      meta: { source: 'tripline', turn: currentTurn }
    });
    ```
  - [ ] Bonus slot appears in NCH capsule minimized when player long-presses bound enemy
  - [ ] Bonus slot accepts PLANT action (C4_CHARGE, FRAG_GRENADE, PIPE_BOMB per THEFT_MECHANICS §9)
  - [ ] If enemy breaks free from bound state before plant: remove bonus BLVCK slot from deck
  - [ ] If player plants into bonus slot AND then engages combat: planted card persists into STR combat hand
  - [ ] Detonation follows standard rules: manual trigger, synergy trigger, or C4 1-turn delay

- **Cross-references:**
  - THEFT_MECHANICS.md §9 (Plant Mechanic) — plantable card eligibility, detonation triggers
  - THEFT_MECHANICS.md §10 (BLVCK as Universal Empty Slot Node) — BLVCK slot contract
  - ENEMY_NCH_INTERACTION_ROADMAP.md Phase 1.3 (plantSlots data structure)
  - ENEMY_NCH_INTERACTION_ROADMAP.md Phase 2.4 (Plant drag animation)
  - ENEMY_NCH_INTERACTION_ROADMAP.md Phase 3.2 (Planted card triggers in combat)

- **Acceptance Criteria:**
  - Bound enemy shows bonus BLVCK slot in card hand
  - Player can plant C4 into bonus slot while enemy is bound
  - Slot disappears if enemy breaks free before plant
  - Planted card carries into STR combat if player engages
  - Standard detonation rules apply

---

### Phase 4: Harpoon Item 🔱

**Objective:** Equipped harpoon fires projectile at enemy, drags them across ground effects to player, initiates STR combat with bound+damaged enemy.

- **Tasks:**
  - [ ] Add `ITM-HARPOON` to `items.json` with `ammoType: "rope"`, `requiresRopeAmmo: true`, `dragOnHit: true`
  - [ ] Modify projectile dispatch in `_processGridInput()` (INPUT_PLAYER_CONTROLLER §7):
    - If equipped item is harpoon AND (player adjacent to rope node OR `RopeManager.isLettingOut()`):
      - Fire harpoon projectile (🔱 emoji) at target enemy
      - Consume rope node as ammo
  - [ ] Implement `RopeManager.consumeAsAmmo(ctx)` — consume rope node or active lettingOut rope
  - [ ] On harpoon hit: begin enemy drag sequence:
    - Calculate Bresenham path from enemy position to player-adjacent tile
    - Enemy slides through each tile at 2 tiles/frame visual speed
    - At each tile: apply `GroundEffects.getGroundEffect(tileX, tileY)` traversal damage
    - Drag blocked by walls (enemy stops at last open tile)
    - If drag path crosses another enemy: collision damage to both
  - [ ] Add `applyTraversalEffect(enemy, effectType)` to ground-effects pipeline
  - [ ] On drag arrival: auto-initiate STR combat:
    - Enemy BOUND for 1 turn
    - Enemy "Reeled In" debuff: -20% DEF for 2 rounds
    - Player "Harpoon Strike" opener: +15% first-hit damage
  - [ ] Harpoon speed penalty while reeling: 10% (stacks with rope if applicable)
  - [ ] Rope line renderer: taut 🔱 line during drag, snaps on arrival
  - [ ] Add harpoon card synergy hooks (chain, rope, binding strike, barbed line, etc.)

- **Acceptance Criteria:**
  - Harpoon fires only when rope ammo is available (adjacent node or lettingOut)
  - Projectile hits enemy → enemy dragged across tiles
  - Ground effects apply at each tile during drag
  - Walls block drag
  - STR combat starts with enemy bound + debuffed
  - Rope consumed on fire

---

### Phase 5: Grappling Hook Item 🪝

**Objective:** Passive inventory item enabling long-range teleport to rope nodes (through walls) and enemy grapple (LOS only).

- **Tasks:**
  - [ ] Add `ITM-GRAPPLE-HOOK` to `items.json` with `slot: "passive"`, `ammoType: "rope"`, quality tiers
  - [ ] Modify `_processGridInput()` click dispatch:
    - If grappling hook in inventory AND player clicks distant rope node (beyond adjacency):
      - Check durability → roll failure chance based on quality
      - If success: fire grapple projectile, player teleport-lerp to rope node tile (fishing movement, through walls)
      - Consume target rope node
    - If grappling hook in inventory AND player clicks enemy:
      - Check durability → roll failure
      - Check LOS (cannot grapple enemy through walls)
      - If success: fire grapple, player teleport-lerp to enemy-adjacent tile
      - Consume nearest rope node (adjacent or lettingOut)
      - Auto-initiate STR combat: enemy BOUND 1 turn, player +15% first-hit
  - [ ] Implement fishing-style teleport movement: `GoneRogueMovement.teleportTo(x, y, throughWalls)`
    - Lerp-dash visual from current tile to target tile
    - If `throughWalls`: ignore collision during lerp (same as fishing rod pull)
    - Brief invulnerability window (0.3s) on arrival
  - [ ] Implement durability system:
    - `failureChance = BASE_FAILURE * Math.pow(QUALITY_DECAY, qualityTier)`
    - On failure: hook breaks, item removed, overhead 🪝❌, player stays put
    - On success: durability unchanged (failure rate is per-use chance, not degrading)
  - [ ] Add grappling hook card synergy hooks (chain, rope, hookshot, momentum swing, etc.)

- **Acceptance Criteria:**
  - Player with grappling hook can click distant rope nodes to teleport
  - Teleport passes through walls (fishing movement)
  - Player can click enemies to grapple (requires LOS, no wall pass)
  - Rope consumed on each use
  - Failure rate scales exponentially with quality (common=25%, legendary=~1%)
  - Hook breaks on failure
  - Combat starts with bound enemy on enemy grapple

---

### Phase 6: Rope Line Rendering + Visual Polish

**Objective:** Canvas overlay rendering for rope lines (lettingOut, triplines, harpoon drag, grapple dash).

- **Tasks:**
  - [ ] Create rope line renderer (canvas overlay, rendered after tiles but before UI):
    - `lettingOut`: animated line from anchor tile to player position, sways slightly
    - Installed tripline: persistent line between anchor A and anchor B, taut
    - Harpoon drag: taut line from player to enemy, enemy sliding along it
    - Grapple dash: brief flash line from player start to destination
  - [ ] Rope color: `#c4a265` (natural hemp), opacity pulsing during lettingOut
  - [ ] Tripline color: `#8B4513` (darker, installed/taut look)
  - [ ] Valid rope node highlight when player has grappling hook (subtle glow on distant ➰ nodes)
  - [ ] Bound enemy visual: spinning facing direction, overhead 🪢
  - [ ] Tripline break animation: line snaps with brief particle burst at intersection point
  - [ ] Harpoon drag trail: brief ground-effect-colored sparks at each tile during drag

- **Acceptance Criteria:**
  - All rope states have clear visual feedback
  - Lines render in world space (follow camera transforms)
  - Triplines persist visually until broken
  - Bound enemies have clear visual indicator

---

### Phase 7: Card Synergy + Combat Integration

**Objective:** Wire rope/chain card synergies for harpoon and grappling hook pre-combat into STR-combat combos that actually bind the enemy.

- **Tasks:**
  - [ ] Define rope/chain card family in `cards.json`:
    - `ACT-ROPE-BIND` — "Binding Rope": extends bound duration by 2 turns
    - `ACT-CHAIN-LINK` — "Chain Link": +2 harpoon/grapple range per chain card in hand
    - `ACT-BARBED-LINE` — "Barbed Line": harpoon drag deals +2 bleed per tile
    - `EATK-BINDING-STRIKE` — "Binding Strike": 2x damage if enemy is bound (harpoon/tripline)
    - `ACT-HOOKSHOT` — "Hookshot": after grapple, next ranged attack +50% accuracy
    - `ACT-MOMENTUM-SWING` — "Momentum Swing": grapple arrival grants +1 free action
    - `ACT-ANCHOR-CHAIN` — "Anchor Chain": grapple teleport leaves tripline behind (free install)
  - [ ] Add `boundCombatModifiers` to STR combat system:
    - Bound enemies: cannot act turn 1, -20% DEF
    - Cards that reference `enemy.bound` check: Binding Strike, etc.
  - [ ] Implement combo detection: if player enters STR combat via harpoon/grapple AND has matching cards in hand, apply combo bonuses:
    - Harpoon + Binding Strike = auto-crit first hit
    - Grapple + Momentum Swing = free first action
    - Any rope entry + Chain Link = extended bound duration
  - [ ] Tag synergy system integration: add `rope`, `chain`, `bind` to `tag-synergy-data.json`
  - [ ] Ensure bound state persists from pre-combat (tripline/harpoon/grapple) into STR combat hand

- **Acceptance Criteria:**
  - Rope/chain cards provide meaningful synergies with harpoon and grappling hook
  - Bound state carries from pre-combat into combat
  - Card combos detected and applied correctly
  - Tag synergy system recognizes rope/chain/bind tags

---

### Phase 8: System Hardening + Abuse Prevention

**Objective:** Balance, edge cases, and designer safety nets.

- **Tasks:**
  - [ ] Max active triplines per floor (default: 3)
  - [ ] Rope node spawn density tuning per biome/floor tier
  - [ ] Boss immunity: `bindable: false` flag prevents tripline/harpoon/grapple bind
  - [ ] Heavy elite immunity: enemies above weight threshold immune to harpoon drag
  - [ ] Grapple cooldown: 2 turns between uses (prevents grapple-spam escape)
  - [ ] Harpoon cannot fire if path to enemy is fully blocked by walls
  - [ ] Tripline intersection algorithm optimization (spatial hash for many triplines)
  - [ ] Console warnings for malformed interactive nodes (missing required props)
  - [ ] Lever/button ES6→IIFE rewrite validation
  - [ ] Floor progression: rope density increases on higher floors, harpoon/grapple appear mid-late game

- **Acceptance Criteria:**
  - No exploit: infinite triplines, grapple spam, harpoon through walls
  - Bosses/heavy elites immune to bind
  - Performance stable with max triplines
  - All interactive nodes validate on spawn

---

## Execution Priority

```
Phase 0  ✅ Module rewrite (IIFE, reset, cleanup)
Phase 1  ⏳ Rope node + letting out (core interaction loop)
Phase 2     Tripline installation + enemy binding
Phase 3     Tripline + C4 plant (card hand hydration)
Phase 4     Harpoon item 🔱 (projectile → drag → STR combat)
Phase 5     Grappling hook item 🪝 (teleport to node/enemy)
Phase 6     Rope line rendering + visual polish
Phase 7     Card synergy + combat integration
Phase 8     System hardening + abuse prevention
```

**Critical path:** Phase 1 → Phase 2 → Phase 3 (core rope loop must work before items or cards)

**Parallel work:** Phase 6 (rendering) can start after Phase 1. Phase 7 (cards) can start after Phase 4+5. Phase 4 and Phase 5 can develop in parallel once Phase 2 is stable.

---

## Files Impact Summary

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `interactive-node-system.js` | 1 | Interactive node props, spawn, contract validation |
| `tripline-system.js` | 2 | Tripline tracking, intersection detection, enemy binding |

### Modified Files

| File | Phase(s) | Changes |
|------|----------|---------|
| `ropeManager.js` | 1 | Rewrite state machine: idle → lettingOut, new API |
| `lever.js` | 1 | ES6 class → IIFE/object factory |
| `button.js` | 1 | ES6 class → IIFE/object factory |
| `tap-move-system.js` | 1, 2 | Rope node click, tripline install, harpoon/grapple dispatch |
| `game-tick-system.js` | 1, 2 | Per-frame rope update, tripline intersection check |
| `gone-rogue-movement.js` | 1, 5 | Rope speed penalty, teleportTo() for grapple |
| `gone-rogue-mobile.js` | 1 | Self-tap cancel for lettingOut |
| `run-start-system.js` | 1 | Already wired ✅ |
| `floor-gen-core.js` | 1, 2 | Rope node + lever/button spawning |
| `projectile-system.js` | 4 | Harpoon projectile variant, drag-on-hit |
| `ground-effects.js` | 4 | `applyTraversalEffect()` for harpoon drag |
| `items.json` | 4, 5 | ITM-HARPOON, ITM-GRAPPLE-HOOK definitions |
| `cards.json` | 7 | Rope/chain card family |
| `tag-synergy-data.json` | 7 | rope, chain, bind tags |
| `enemy-deck-hydrator.js` | 3 | Bonus BLVCK slot for bound enemies |
| `str-combat-window.js` | 4, 5 | Bound/debuff modifiers on combat init |
| `index.html` | 1+ | Script tags, cache busts |

---

## References

- **Lantern Drag System:** `public/js/lantern-drag-system.js` — IIFE pattern, 7-point wiring template
- **Breakable System:** `public/js/breakable-system.js` — breakable node pattern, kick priority
- **Lighting System:** `public/js/lighting-system.js` — `LIGHT_SOURCE_BREAKABLE_PROPS` as node definition reference
- **Ground Effects:** `public/js/ground-effects.js` — GROUND_TYPES, GROUND_EFFECTS, traversal damage
- **Projectile System:** `public/js/projectile-system.js` — projectile dispatch, fire context
- **Theft Mechanics:** `docs/THEFT_MECHANICS.md` — card hand, plantable slots, C4, input fork
- **Enemy NCH Interaction:** `docs/ENEMY_NCH_INTERACTION_ROADMAP.md` — enemy capsule, plant UI, combat hand
- **Input Controller:** `docs/INPUT_PLAYER_CONTROLLER.md` — movement pipeline, fishing teleport, tile traversal
- **Rope Design Doc:** `docs/ROPE_BUTTONS_LEVERS_SYSTEM.md` — original design guide
