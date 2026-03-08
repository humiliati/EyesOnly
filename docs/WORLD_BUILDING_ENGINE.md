# World Building Engine Design Document

## 1. Overview

This document outlines the design for a new world-building engine for Gone Rogue. The engine will provide a designer-friendly interface for creating and connecting both contrived and procedurally generated floors, and it will output floor data in a format that is compatible with the existing game systems.

## 2. Goals

- To create a unified and intuitive world-building experience for designers.
- To support the creation of both hand-crafted (contrived) and procedurally generated floors.
- To enable designers to create complex building interiors with multiple floors.
- To output floor data in a format that is compatible with the existing floor loading and biome systems.
- To leverage existing tools and code as much as possible.

## 3. Architecture

The world-building engine will consist of two main components:

1.  **World Designer:** A new, flowchart-style editor for creating and connecting floors and buildings.
2.  **Map Designer:** An enhanced version of the existing map editor that supports ASCII-style floor layouts.

These two components will be integrated to provide a seamless world-building experience.

### 3.1. World Designer

The World Designer will be a new tool, located at `portal/world-designer.html`. It will allow designers to:

- Create a new world project.
- Add new floors and buildings to the world.
- Connect floors and buildings using a flowchart-style interface.
- Specify the properties of each floor, such as its name, ID, biome, and whether it is contrived or procedurally generated.
- Launch the Map Designer to edit the layout of a contrived floor.
- Export the entire world as a set of individual floor datasets.

### 3.2. Map Designer

The existing Map Designer at `portal/map-designer.html` will be enhanced to support:

-   **ASCII-Style Floor Layouts:** A new text area will be added to the Map Designer that allows designers to block out the basic structure of a floor using ASCII characters. This will be a quick and easy way to create the basic layout of a floor before adding more detailed entities.
-   **Two-Way Binding:** The ASCII layout will be two-way bound to the canvas editor, so that changes in one will be reflected in the other.

## 4. Data Format

The world will be saved as a single JSON file (`world.json`) that contains a list of all the floors and buildings in the world, as well as the connections between them.

Each contrived floor will also have its own individual JSON file (e.g., `Floor1.2.5.json`) that contains the layout of the floor, as defined in the Map Designer.

## 5. Implementation Plan

1.  **Create the `WORLD_BUILDING_ENGINE.md` design document.** (This document)
2.  **Create the `world-designer.html` and `world-designer.js` files.**
3.  **Implement the basic flowcharting functionality in the World Designer.**
4.  **Enhance the Map Designer to support ASCII-style floor layouts.**
5.  **Integrate the World Designer and the Map Designer.**
6.  **Implement the world export functionality.**

## 6. Door Contract Specification

> **CRITICAL:** This section defines how doors, player spawning, and floor transitions work. Every floor generator (contrived AND procedural) MUST follow these contracts. Violation of the door contract lets players skip floors. See `TUTORIAL_FLOORS_AUDIT.md` BUG 2 and BUG 13 for current violations.

### 6.1. Door Types

The WBE recognizes three categories of doors, each with distinct visual symbols and behavior:

| Door Type | Symbol | Metadata | Purpose |
|-----------|--------|----------|---------|
| Advance Floor Door | ↪️ | `{ type: 'door', doorKind: 'forward' }` | Moves player to the next floor (N → N+1) |
| Retreat Floor Door | ↩️ | `{ type: 'door', doorKind: 'back' }` | Moves player to the previous floor (N → N-1) |
| Building Door | ↔️ | `{ type: 'building_door', doorKind: 'building' }` | Enters/exits a building interior (N ↔ N.1) |
| Interior Exit Door | ↔️ | `{ type: 'door', doorKind: 'interior_exit' }` | Exits a building interior back to parent floor |

### 6.2. Floor Door Contract (Advance / Retreat)

Every floor (contrived or procedural) must have exactly TWO floor doors placed at opposite ends of the map:
- One **advance door** (↪️) — leads forward to floor N+1
- One **retreat door** (↩️) — leads backward to floor N-1

**Exception:** Floor 0 has NO retreat door (there is no floor -1). The layout sets `suppressBackDoor: true`.

**Spatial invariant:** The advance door and retreat door must be separated by a designer-specified minimum manhattan distance (default: 10+ tiles). This forces the player to traverse the floor.

#### 6.2.1. Advance Transition (Floor N → Floor N+1)

```
Floor N                          Floor N+1
┌─────────────────────┐          ┌─────────────────────┐
│                     │          │                     │
│  ↩️ retreat         │          │  ↩️ retreat ← SPAWN │
│                     │          │  (guardrailed ~5    │
│                     │  ──→     │   steps, anim off)  │
│                     │          │                     │
│            ↪️ STEP  │          │            ↪️ advance│
│         advance ON  │          │         (far away)  │
└─────────────────────┘          └─────────────────────┘
```

1. Player steps on ↪️ advance door on floor N
2. `advanceFloor()` sets `_spawnFromLastExitPos = 'advance'`, generates floor N+1
3. Floor N+1 generator places both doors, then calls `applyDoorContract('advance')`
4. Player spawns **adjacent to the ↩️ retreat door** on floor N+1
5. `doorSpawnProtect` activates on the retreat door: `{ x, y, stepsRemaining: 5, suppressAnimation: true }`
6. Retreat door animation (↩️) does NOT display while guardrailed
7. After ~5 steps away, guardrail expires, retreat door becomes active and shows ↩️

#### 6.2.2. Retreat Transition (Floor N → Floor N-1)

Same logic, mirrored: player spawns adjacent to the ↪️ advance door on floor N-1, with guardrails.

#### 6.2.3. Guardrail Rules

- `doorSpawnProtect` is a step-count countdown, NOT position-only
- Protected door is the one the player spawned near (the one leading BACK to where they came from)
- While guardrailed: door interaction is blocked AND overhead animation is suppressed
- Guardrail expires after `stepsRemaining` player moves (not time-based)
- Guardrail does NOT apply to building doors (see 6.3)

### 6.3. Building Door Contract (Enter / Exit Interiors)

Building doors follow a **fundamentally different contract** from floor doors. Buildings are optional exploration content — the player must be able to immediately exit.

#### 6.3.1. Entering a Building (Parent → Interior)

```
Parent Floor (N)                 Interior Floor (N.1)
┌─────────────────────┐          ┌─────────────────────┐
│                     │          │                     │
│  ↔️ entrance  STEP  │  ──→     │  ↔️ exit ← SPAWN   │
│     door      ON    │          │  (NO guardrails!)   │
│                     │          │  Player can exit    │
│                     │          │  immediately.       │
│                     │          │                     │
└─────────────────────┘          └─────────────────────┘
```

1. Player steps on ↔️ building door on parent floor
2. `enterInteriorFloor()` generates the interior floor (N.1)
3. Player spawns **adjacent to the ↔️ exit door** inside the interior
4. **NO guardrails** — player can immediately step on exit door to return
5. Exit door animation (↔️) plays immediately — the door is active from the start
6. `doorSpawnProtect` is NOT set

#### 6.3.2. The Building Funnel Pattern

Buildings with nested interior floors create a **funnel** — enter through one door, exit through a DIFFERENT door on the parent floor:

```
Parent Floor (N):
  [Front Door ↔️ A] ──enter──→ Interior N.1 ──deeper──→ Interior N.1.1
       (x:15, y:7)                                           │
                                                        exit building
                                                             │
                                                             ▼
  [Back Door ↔️ B] ←──return────────────────────────────────┘
       (x:25, y:15)
```

Each building in `buildings.json` can specify:
```json
{
  "id": "BLD-TAVERN",
  "entranceDoor": { "x": 15, "y": 7 },
  "exitDoor": { "x": 25, "y": 15 },
  "interiorFloorId": "0.1"
}
```

When `exitInteriorFloor()` fires from the deepest nested level, the player spawns at the building's `exitDoor` position on the parent floor (NOT at the entrance). If no separate `exitDoor` is defined, the player returns to the entrance position (same door in/out).

#### 6.3.3. Door Contract Comparison Table

| Property | Floor Doors (↪️/↩️) | Building Doors (↔️) |
|----------|---------------------|---------------------|
| Guardrails on spawn | Yes (~5 steps) | **No** |
| Animation on spawn | Suppressed during guardrail | **Always visible** |
| Spawn position | Adjacent to door leading BACK | Adjacent to EXIT door |
| Required traversal | Must cross entire floor | Optional — can exit immediately |
| Funnel pattern | N/A (linear floor chain) | Enter front → exit back |
| `doorSpawnProtect` | Set with `stepsRemaining` | **Never set** |
| Validation | Doors must be 10+ tiles apart | Exit door near spawn is correct |

### 6.4. Procedural Generator Door Requirements

The procedural floor generator (`floor-generator.js` → `placePlayerAndExit()`) currently places only ONE exit tile and no retreat door. To comply with the door contract, it must:

1. Place an advance door (↪️) at `lastRoom.center` (existing behavior)
2. Place a **retreat door (↩️)** at `firstRoom.center` (NEW)
3. After both doors are placed, call `applyDoorContract(transitionMode)` to position the player
4. The retreat door must have metadata: `{ type: 'door', doorKind: 'back' }`
5. Floor 0 procedural (if ever used) must suppress the retreat door

### 6.5. Validation Rules for Door Placement

The WBE validation layer (section 9️⃣) must include door contract checks:

**D. Door Contract Validation**
- Every non-zero floor must have exactly one advance door and one retreat door
- Floor 0 must have exactly one advance door and zero retreat doors
- Advance and retreat doors must be ≥ 10 manhattan distance apart
- Building interior floors must have at least one exit door (↔️ or `interior_exit`)
- Building funnel: if `exitDoor` is specified, it must exist as a valid building door on the parent floor
- No floor may have a door tile with missing or invalid metadata

## System Cross-References

| System | Document / File | WBE Integration |
|--------|----------------|----------------|
| Door Contract | This document §6 | Spawn rules for all floor transitions |
| Biome Catalog | [BIOME_SYSTEMS.md](./BIOME_SYSTEMS.md) | Step Node biome assignment, card drops, vents |
| Biome Runtime | `biomes.json` | Visual theming per node |
| Interior Biomes | `interior-biomes.json` (12 biomes) | Building interior visual identity — resolved by `InteriorFloorSystem._resolveInteriorBiome()` |
| Building Interiors | [BUILDING_INTERIOR_SYSTEM.md](./BUILDING_INTERIOR_SYSTEM.md) | Floor hierarchy, biome resolution pipeline, InteriorFloors API |
| Interior Generation | [INTERIOR_SYSTEM_IDEAS.md](./INTERIOR_SYSTEM_IDEAS.md) | Structure grammar, visual compression, 12 procedural rules |
| NPC System | [NPC_CANON.md](./NPC_CANON.md) | NPC invariants, pathing, archetypes, proc gen stamping pipeline |
| Pattern Engine | [PROCEDURAL_GENERATION_DESIGN_IDEAS.md](./PROCEDURAL_GENERATION_DESIGN_IDEAS.md) | Scalar field patterns per biome (reaction-diffusion, voronoi, radial) |
| Building Registry | `buildings.json` | Building door placement, funnel pattern |
| Enemy Catalog | `enemy-catalog.json` | Biome-filtered enemy spawns |
| Card Drops | [BIOME_SYSTEMS.md](./BIOME_SYSTEMS.md) §6 | Loot table per biome per step |
| Lighting | `lighting-system.js` | Per-biome/interior lighting profile |
| Dialogue System | [TOOLTIP_SPACE_CANON.md](./TOOLTIP_SPACE_CANON.md) | NPC dialogue rendering in tooltip space |
| Tutorial Floors Audit | [TUTORIAL_FLOORS_AUDIT.md](./TUTORIAL_FLOORS_AUDIT.md) | BUGs 1-13 affecting WBE integration |
| Implementation Roadmap | [WORLD_BUILDING_ENGINE_ROADMAP.md](./WORLD_BUILDING_ENGINE_ROADMAP.md) | Unified cross-roadmap for all systems |


🏗 WORLD BUILDING ENGINE (WBE)
Sequential Function Chart–Driven Narrative Flow System
1️⃣ Core Philosophy

Your world is not random.

It is a state machine with spatial embodiment.

Each floor is a:

Step (State) in a Sequential Function Chart

Transitions are:

Narrative or mechanical conditions

2️⃣ Top-Level Architecture
┌────────────────────────────────────┐
│        World Building Engine       │
├────────────────────────────────────┤
│                                    │
│  Narrative Flow Graph (SFC)        │
│       ↓                            │
│  Floor Resolver                    │
│       ↓                            │
│  Map Template Loader OR Proc Gen   │
│       ↓                            │
│  Validation + Synergy Pass         │
│       ↓                            │
│  Runtime Floor Instance            │
└────────────────────────────────────┘
3️⃣ SFC-Based Designer View

Designer sees something like:

[Start]
   |
   v
[Intro Floor]
   |
   v
[Key Obtained]
   |
   +----> [Gate Branch]
   |
   +----> [NPC Quest Branch]
   |
   v
[Convergence Floor]
   |
   v
[Boss or Narrative Event]

This mimics industrial sequential function charts.

4️⃣ Core Node Types (GRAFCET Style)

> **Door Type Symbols:** When the visual node editor phase arrives, the World Building Engine should print the following symbols inside door-type nodes to distinguish their purpose at a glance:
> - **Return floor door:** `↩️` (return arrow)
> - **Advance floor door:** `↪️` (forward arrow)
> - **Building entrance/exit door:** `↔️` (`<->` arrow)
> - **Inside of buildings:** return/advance floor doors use `↩️` / `↪️` respectively; the exit building door uses `↔️`

Your system should support:

🟩 Step Node (Floor State)

Represents:

A floor

A narrative beat

A world condition

Contains:

{
  id,
  floorType: "template" | "procedural",
  difficultyTier,
  requiredPlayerState,
  allowedSynergies,
  narrativeTags
}
🔶 Transition Node

Represents:

Condition to move to next floor

Example:

{
  condition: "player.hasKey('red')",
  or: ["npcQuestComplete", "ventBypassUsed"]
}

Transitions evaluate after floor completion.

🔁 Parallel Branch Node

Supports:

Multiple active quest lines

Optional exploration branches

Risk/reward splits

Like PLC parallel branches.

🔷 Convergence Node

Waits until:

All required branches complete

Or at least one branch complete (configurable)

5️⃣ Environmental Synergy System

Now we embed your key logic.

🔐 Key + Gate

Template contract:

{
  synergyType: "keyGate",
  keyId: "blue",
  gateId: "blueDoor"
}

Validation ensures:

Key exists before gate

Gate not reachable before key unless bypass intended

🧍 Quest Key + NPC
{
  synergyType: "questGate",
  npcId: "mechanic",
  questId: "repairLift"
}

Transition requires:

NPC interaction

Quest flag set

🌬 Vent Bypass
{
  synergyType: "ventBypass",
  requiresUpgrade: "crawlKit"
}

Procedural generation must check:

Does player have crawlKit tier?

If not, disable vent link

🔘 Secret Button Bypass
{
  synergyType: "secretBypass",
  revealCondition: "ropeInteract",
  targetGate: "northDoor"
}

These are alternate transitions in SFC.

6️⃣ Contrived vs Procedural Floor Selection

Each Step Node decides:

if (node.floorType === "template")
    loadTemplate(node.templateId)
else
    generateProceduralFloor(node.seedModifiers)

Seed modifiers may include:

Enemy density

Anchor density

Rope allowed

Narrative tension level

7️⃣ Narrative Context-Aware Generation

Procedural floor generator receives:

{
  tensionLevel,
  playerHealthState,
  narrativeAct,
  ropeTier,
  questFlags
}

Example logic:

If tensionLevel high:

Reduce bypasses

Increase chokepoints

Reduce rope anchors

If exploration phase:

Increase optional vents

Add secret rope triggers

Add dual-path branches

8️⃣ Designer Visual Language

Your editor should visually resemble:

[STEP] ──(transition)──> [STEP]
    |                         |
   (branch)                (parallel)
    |                         |
   [STEP]                  [STEP]

Color code:

Color	Meaning
Green	Step
Yellow	Transition
Blue	Optional Branch
Red	Gate Condition
Purple	Narrative Trigger

This makes it feel industrial and intentional.

9️⃣ Validation Layer (Critical)

Before runtime:

Run validation pass:

A. Synergy Validation

Every gate must have a key or bypass

Every quest gate must reference valid NPC

B. Rope Safety Validation

Rope bypass cannot invalidate primary key progression unless intended

Anchor density within budget

C. Dead-End Detection

No unreachable steps

No infinite branch loops

🔟 Player Experience Balancer

Add flow shaping variables:

Variable	Effect
tensionLevel	Controls density & bypass availability
randomnessBias	% procedural vs template
narrativeWeight	Controls forced beats
explorationBias	Increases optional branches

This lets you shift between:

Carefully contrived chapter

Chaotic procedural dungeon

Hybrid

1️⃣1️⃣ Example Hybrid Flow
[Act 2 Start - Template]
   |
   v
[Procedural Exploration Cluster]
   |
   +----> Optional Secret Branch
   |
   v
[Quest NPC Floor - Template]
   |
   v
[High Tension Procedural]
   |
   v
[Boss Template]

Templates anchor narrative.
Procedural fills breathing space.

1️⃣2️⃣ Designer Power Guardrails

Designer cannot:

Create transition without condition

Place gate without key or bypass

Enable rope bypass on mandatory narrative gate unless flagged

Procedural engine cannot:

Spawn more anchors than ropeTier allows

Bypass boss gate unintentionally

Place secret bypass before narrative reveal

1️⃣3️⃣ Mental Model

This is not a dungeon generator.

It is:

A programmable world-state machine
that manifests as floors.

It behaves like a PLC controlling narrative tension.


Below is a fully polished, production-ready designer-facing control list for your World Builder GRAFCET Editor — modeled after a Schneider EcoStruxure Control Expert / RSLogix 5000 style Sequential Function Chart (SFC) environment, but adapted for game world design.

This assumes:

Emoji-based DOM canvas maps

Rope system (ropeManager)

Environmental synergy system (key+gate, vent bypass, secret button, etc.)

Mixed handcrafted + procedural floors

Seed-aware world generation

🎛 WORLD BUILDER GRAFCET – DESIGNER TOOLBAR
🧱 1. STRUCTURE PANEL (Flow Construction)

These are the core SFC-style building blocks.

➕ Step Node

Creates a world state (floor, room, encounter, event).

Label field

Narrative tag dropdown

Difficulty tier selector

Template / Procedural toggle

🔀 Transition

Conditional flow logic between steps.

Boolean condition builder

Context-aware conditions

Player state reference

RNG % gate

Seed dependency toggle

⬅ Parallel Split (AND)

Branch player into simultaneous world states.

➡ Parallel Join

Merge parallel branches.

🔁 Loop Connector

Repeat until condition met.

🎲 Random Branch

Weighted distribution split.

Adjustable weights

Seed stable toggle

Player context adaptive toggle

🗺 MAP GENERATION PANEL
🏗 Floor Type Selector

Template Floor

Procedural Floor

Hybrid (template shell + procedural internals)

🌱 Seed Controls

Lock seed

Generate new seed

Contextual seed (player state driven)

Deterministic preview toggle

🧩 Template Selector

Load template

Edit template

Mark as boss template

Mark as narrative anchor

🧠 ENVIRONMENTAL SYNERGY PANEL

This is your core mechanic integration layer.

🔑 Key + Gate Linker

Create Key

Assign Gate

Soft gate (optional)

Hard gate (mandatory)

Multi-key lock

Timed unlock

Destroy on use toggle

🧑‍🤝‍🧑 Quest Key + NPC Binder

Assign NPC

Dialogue trigger

Quest state requirement

Betrayal branch

Death persistence rule

🕳 Vent Bypass Node

Requires rope?

Requires size modifier?

One-way / two-way

Noise generation toggle

🔘 Secret Button

Hidden by default

Visibility condition

Rope operable

Line of sight required

Emits audio cue

🪜 Ladder / Bridge Pull

Rope required

Physics drop animation

One time use

Resettable

Multiplayer visible state

🪢 Tripwire / Net

Deployable by player

AI triggered

Single use

Resettable

Enemy faction filter

🪢 ROPE SYSTEM PANEL (RopeManager Controls)

Integrates your existing overhead rope emoji animation.

🎣 Rope Action Node

Deploy Tripline

Deploy Net

Pull Object

Bind Enemy

Operate Lever

Trigger Hidden

📏 Rope Length Settings

Max length

Shrink rate

Auto retract

Break under tension toggle

🎭 Visual Settings

Emoji type override

Max scale (1.3)

Min scale (.1)

Glow when active

Snap animation style

🎮 PLAYER CONTEXT CONDITIONS
🧍 Player State Conditions

Has rope?

Has key?

Inventory contains X?

Reputation state

Health threshold

Stealth mode

Alarm active?

🤖 AI Context

Faction hostility

Alert level

Patrol state

Boss alive?

Reinforcement enabled?

📖 NARRATIVE PANEL
🗨 Dialogue Trigger

Pre-step

On entry

On exit

Conditional branch

Randomized flavor lines

📜 Narrative Tone Slider

Contrived

Semi-random

Emergent

Chaos

Affects procedural weighting.

🎛 BALANCE & DIFFICULTY PANEL
📈 Difficulty Curve

Linear

Spike

Wave

Context reactive

💀 Failure Handling

Soft fail

Hard fail

Loop retry

World mutation on fail

Spawn alternate path

🧪 DEBUG & VALIDATION PANEL
🔎 Flow Validator

Checks:

Unreachable steps

Infinite loops

Unsolvable gates

Missing keys

Rope deadlocks

Procedural contradictions

🧬 Seed Simulator

Run 1000 seeds and:

Visualize path variance

Measure average length

Detect dead branches

Detect exploit loops

👁 Designer Preview Mode

Play from selected node

Force condition true/false

Visual rope overlay test

Simulate player inventory

🛡 ABUSE PREVENTION PANEL
🚫 Exploit Detection

Soft lock risk

Rope bypass abuse

Gate stacking abuse

Infinite farm detection

🎯 Player Intent Analyzer

Flags:

Sequence breaking

Rope cheesing

Key hoarding

Loop farming

🎨 POLISH PANEL
✨ Visual FX Attach

Screen shake

Rope tension spark

Dust burst

Audio cue

Mini camera zoom

🎵 Audio Binding

Attach SFX

Attach ambient trigger

Tension escalation

🧩 EXPORT / VERSIONING PANEL
💾 Save as Template
🌍 Save as Procedural Pattern
🔁 Fork World Graph
🧠 Compare Versions
📦 Export Seed Pack
🧪 Snapshot Playtest
🏗 If Fully Polished, Designers Would See:

Drag-and-drop SFC canvas

Step nodes styled like industrial GRAFCET blocks

Condition diamonds

Parallel bars

Rope interactions visually linked with curved cable lines

Context validation warnings in red

Replay seed preview heatmap

Interactive simulation playback

---

## Extracted Modules (WBE Infrastructure)

The following modules were extracted from the `gone-rogue.js` monolith to support WBE integration:

### `door-contract-system.js`
**Purpose:** Owns all door transition state and canonical door contract logic.

**State owned:**
- `_lastExitPos` — position of the door the player just used
- `_spawnFromLastExitPos` — 'advance' | 'retreat' | null
- `_doorSpawnProtect` — guardrail step countdown (prevents accidental re-trigger)

**Key API:**
- `applyDoorContract(opts)` — applies canonical contract (advance → near back door, retreat → near forward door)
- `applyBuildingDoorContract(opts)` — building funnel (spawn near exit, no guardrails)
- `findSpawnNearDoor(grid, TILES, w, h, target, avoid, radius)` — spatial search utility
- `tickDoorSpawnProtect()` — step countdown for guardrails
- Get/set accessors for all three state vars

**Consumers:** `floor-gen-core.js`, `tutorial-floor-gen.js`, `player-interaction-system.js`, `floor-transition-system.js` (via monolith ctx)

### `biome-visual-facade.js`
**Purpose:** Owns biome visual state and wraps `BiomeVisuals` module calls.

**State owned:**
- `_biomeVisualGrid` — pre-computed visual substitution grid
- `_biomeBackgroundColors` — per-tile background gradient colors
- `_tileRenderObjects` — per-tile render objects for visual density

**Key API:**
- `buildBiomeVisualGrid(biome, ctx)` / `buildTileRenderObjects(biome, ctx)` / `buildBiomeBackgroundColors(biome, isNight, ctx)`
- Passthrough utility functions: `hexToRgb`, `rgbToHex`, `lerpColor`, `getNeighborTiles`
- State accessors: `getVisualGrid()`, `getBackgroundColors()`, `getRenderObjects()`, `clearAll()`

**WBE integration:** The Map Template Loader and Proc Gen pipeline use this facade for biome visual application.

### `floor-metadata-registry.js`
**Purpose:** Unified floor metadata registry for the WBE Floor Resolver.

**Key API:**
- `register(floorId, metadata)` / `registerAll(entries)` — registration
- `get(floorId)` — single floor lookup
- `getByBiome(biomeId)` / `getByType(type)` / `getByTag(tag)` — filtered queries
- `registerTutorialFloors()` — auto-registers floors 0-3 and interior floors from `TutorialFloors`

**Metadata shape (per floor):**
```
{
  id, type, name, description, biomeId, difficultyTier,
  doors: { forward, back, building[] },
  narrativeTags[], buildingId, parentFloorId, isInterior
}
```

**WBE integration:** Step Nodes in the GRAFCET editor read/write to this registry. The Floor Resolver queries it to determine floor type, biome, and door layout.

### System Cross-References

| WBE Component | Module | Data Source |
|---|---|---|
| Step Node metadata | `FloorMetadataRegistry` | `tutorial-floors.js`, `biome-config.js` |
| Door Contract | `DoorContractSystem` | Applied by `floor-gen-core.js`, `tutorial-floor-gen.js` |
| Biome Visuals | `BiomeVisualFacade` → `BiomeVisuals` | `biomes.json` |
| Floor Type | `BiomeConfig.getFloorType()` | Floor number + difficulty tier |
| Building Interiors | `interior-floor-system.js` | `buildings.json` |