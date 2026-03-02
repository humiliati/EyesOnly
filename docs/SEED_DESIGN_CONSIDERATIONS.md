## 1. Core Principles

The Hybrid Seed Architecture is built on a set of core principles that ensure a balance between predictability, fairness, and dynamic gameplay:

*   **Predictable by Default:** All runs are deterministic by default, based on a single base seed.
*   **Controlled Mutability:** Live moderation (both human and agent-driven) is possible, but it is strictly controlled and logged.
*   **Single-Step Horizon:** Mutations are only allowed on the next floor (F+1), preventing retroactive changes and far-future stacking.
*   **Player Agency:** Players can find and use items that allow them to influence the mutation system, giving them a degree of control over the game's dynamism.
*   **Transparent Scoring:** The high score system clearly distinguishes between different run types, ensuring competitive integrity.

## 2. Hybrid Seed Architecture

The Hybrid Seed Architecture is the foundation of the system. It combines a base seed with a series of mutation logs to create a complete and replayable record of each run.

### 2.1. Run Model

Each run is represented by a `Run` object with the following structure:

```javascript
{
  "runId": "string",
  "baseSeed": "string",
  "runClass": "RunClass",
  "mutationLog": [
    // StructuralMutationEvent objects
  ],
  "paramOverlayLog": [
    // ParamMutationEvent objects
  ],
  "mutationBudgetRemaining": "number",
  "structuralHash": "string",
  "paramHash": "string",
  "resolvedHash": "string"
}
```

*   **`baseSeed`:** The initial seed for the run, which determines the deterministic generation of all floors.
*   **`runClass`:** The integrity class of the run (e.g., `STATIC`, `HUMAN_MODERATED`).
*   **`mutationLog`:** A log of all structural mutations that have been applied to the run.
*   **`paramOverlayLog`:** A log of all parameter mutations that have been applied to the run.
*   **`mutationBudgetRemaining`:** The remaining budget for parameter mutations on the current floor.
*   **Hashes:** A series of hashes that can be used to verify the integrity of the run data.

### 2.2. Floor Resolution

When a floor is resolved, the following steps are taken:

1.  The base parameters for the floor are generated from the `baseSeed` and the difficulty band.
2.  Any `ParamMutationEvents` for the current floor are applied.
3.  The final parameters are clamped to their allowed ranges.

### 2.3. Biome System Integration

The procedural generation system integrates with the biome system for floor variety and thematic consistency.

#### 2.3.1. Biome Selection (biome-config.js)

Biomes are selected using weighted random distribution based on floor depth:

```javascript
// Weighted biome selection by floor range (from biome-config.js)
function getBiome(floorNum, ctx) {
  if (floorNum <= 3) return BIOMES.FOREST;       // Tutorial: 100% Forest
  if (floorNum === 4) return BIOMES.GREY_CAVE;   // Special floor
  
  var weights = {};
  if (floorNum >= 5 && floorNum <= 6) {
    // Early game: Forest dominant
    weights = { FOREST: 60, MALL: 20, INDUSTRIAL: 15, GREY_CAVE: 5 };
  } else if (floorNum >= 7 && floorNum <= 9) {
    // Mid-early: Mall becomes common
    weights = { FOREST: 25, MALL: 35, INDUSTRIAL: 30, GREY_CAVE: 10 };
  } else if (floorNum >= 10 && floorNum <= 15) {
    // Mid game: Industrial rises
    weights = { FOREST: 10, MALL: 25, INDUSTRIAL: 40, GREY_CAVE: 15, AEROSPACE: 10 };
  } else if (floorNum >= 16 && floorNum <= 22) {
    // Late game: Mix with Aerospace
    weights = { FOREST: 5, MALL: 20, INDUSTRIAL: 35, GREY_CAVE: 10, AEROSPACE: 30 };
  } else {
    // Endgame: Aerospace dominant
    weights = { MALL: 10, INDUSTRIAL: 20, AEROSPACE: 70 };
  }
  // Weighted random selection...
}
```

#### 2.3.2. Biome Catalog

| Biome | Floors | Primary Theme | Ground Effects |
|-------|--------|---------------|----------------|
| **Forest** | 1-3, 5-6 | Stealth/concealment | Grass, Water streams |
| **Grey Cave** | 4, 5-9 | Darkness/stealth | Shadow, Lava, minimal water |
| **Mall** | 5-9, 10-15 | Fire/utility | Oil, Debris, Water fountains |
| **Office** | 10-15 | Hack/dark | Monitors (shootable), Debris |
| **Industrial** | 10-15, 16-22 | Chain reactions | Oil, Fire, Water, Electric |
| **Aerospace** | 10-15, 16-22, 23-30 | Precision run | Minimal, imported via biome bleed |

#### 2.3.3. Vents System (Risk/Reward Bypass)

```javascript
// Vent success probability formula (from BIOME_SYSTEMS.md)
var baseChance = 0.75;  // 75% base
baseChance -= (ventUseCount × 0.05);       // -5% per prior use
baseChance -= (currentFloor × 0.01);        // -1% per floor depth
baseChance -= (difficultyTier - 1) × 0.05;  // -5% per tier above T1
if (rustyVent) baseChance -= 0.05;         // -5% for rusty quality
baseChance = Math.max(0.25, baseChance);   // Minimum 25%

// Success: Skip to floor N+2, award 50% XP
// Failure: Backtrack 3 floors, +20% enemy stats, penalty marker 🔻
```

#### 2.3.4. Procedural Puzzle Ingredients

For non-tutorial floors, procedural generation scatters puzzle ingredients:

```
PER BIOME:
──────────
Forest:     2-4 grass clusters, 1-2 water tiles, 0-1 oil tile
Cave:       3-5 shadow clusters, 1-2 lava tiles, 1 shootable light per room
Mall:       2-3 oil tiles, 1-2 water tiles (fountains), lights everywhere
Office:     1 monitor per room (shootable), 1-2 debris clusters
Industrial: 3-5 oil tiles, 2-3 water tiles, 1-2 fire tiles, 1 electric source
Aerospace:  1-2 of anything (sparse), mostly clean

PER FLOOR (any biome):
──────────────────────
1 Lure card drop (weighted by biome)
1 smoke-capable item (Cigarettes or Smoke Bomb)
At least 1 ground-effect-creating item in floor loot
```

### 2.4. Resource System

The game uses 6 tracked resources that affect card play and procedural generation.

#### 2.4.1. RESOURCE_COLORS (Single Source of Truth)

```javascript
// From COLLECTIBLES_CANON.md - canonical colors for UI feedback
const RESOURCE_COLORS = {
  HP:       '#FF6B9D',  // vibrant pink
  Energy:   '#00D4FF',  // electric blue
  Focus:    '#FFF9B0',  // bright yellow-white
  Battery:  '#00FFA6',  // sickly cyan-green (NOT cyan #00ffff)
  Fatigue:  '#A0522D',  // earthy brown
  Ammo:     '#DA70D6',  // magenta-purple
  Currency: '#FFFF00',  // twinkly gold
  KeyAmmo:  '#FF8A3D',  // bright orange
  Cards:    '#800080',  // card purple
};
```

#### 2.4.2. Resource Definitions

| Resource | Scale | Purpose | Card Gating |
|----------|-------|---------|-------------|
| **HP** | 0-max | Survival | All damage cards |
| **Energy** | 0-5 | Tactical bandwidth for 3-second STR window | ❌ NOT IMPLEMENTED |
| **Focus** | 0-10 | Stealth/precision tracking, silent builds | ❌ NOT IMPLEMENTED |
| **Battery** | 0-5 | Tech cards (drones, thermal, tazer) | ❌ NOT IMPLEMENTED |
| **Fatigue** | 0-100→10 | Action cost | ✅ Implemented (scale mismatch) |
| **Ammo** | 0-50→20 | Attack cards | ✅ Implemented (max mismatch) |
| **Stability** | 0-10 (hidden) | RNG modifier, enemy crit bonus | ❌ NOT IMPLEMENTED |

#### 2.4.3. Canonical Collectible Categories

```javascript
// From COLLECTIBLES_CANON.md - 9 canonical categories
const COLLECTIBLE_CATEGORIES = [
  { id: 'currency',  symbol: '¢', color: '#FFFF00', pickup: 'instant', example: '+N¢' },
  { id: 'ammo',     symbol: '⁍', color: '#DA70D6', pickup: 'instant', example: '+N⁍' },
  { id: 'battery',  symbol: '◈', color: '#00FFA6', pickup: 'instant', example: '+N◈' },
  { id: 'food',     symbol: 'emoji', pickup: 'instant', 
    effects: ['HP', 'Fatigue', 'Focus', 'Energy', 'Ammo', 'Currency'] },
  { id: 'cards',    symbol: '🂠', color: '#800080', pickup: 'instant-to-hand',
    overflow: 'oldest to backup, backup to incinerator' },
  { id: 'items',    symbol: '🎒', pickup: 'to-vault', 
    full: 'stays on map with tooltip' },
  { id: 'keyitems', symbol: 'emoji', color: '#FFD700', tier: 2, pickup: 'auto-equip',
    overflow: 'pushes existing to vault, vault to incinerator' },
  { id: 'keyammo',  symbol: '🗝', color: '#FFD700', tier: 1, pickup: 'resource',
    example: 'Key counts for locks' },
  { id: 'questkeys', symbol: 'emoji', color: '#FF4444', tier: 3, pickup: 'manual-click',
    empty: 'tooltip notification' },
];
```

### 2.5. Card System Integration

#### 2.5.1. Synergy Tags for Procedural Deck Generation

```javascript
// From CARD_DB_TODO.md - chain primitives for solitaire flow
const SYNERGY_TAGS = {
  'solitaire:draw':     'creates a new option',
  'solitaire:promote':  'moves card to hand-top / makes it live',
  'solitaire:compress': 'reduces clutter: combine, burn, or convert',
  'solitaire:stash':    'secure value card into persistent/vault',
  'solitaire:shuffle':  'reorders to recover tempo',
  'solitaire:theft':    'cards obtained by stealing; should be precious',
};

// Example chains:
// - Draw → Promote → Finish: solitaire:draw → solitaire:promote → combo_finisher
// - Theft → Covert payoff: pickpocket → covert
// - Shuffle → Sustained: solitaire:shuffle → sustained
// - Stash → Defensive reset: solitaire:stash → defensive
```

#### 2.5.2. Card Lifecycle Types

| Type | Flag | Behavior |
|------|------|----------|
| **Consumable** | `consumable: true` | Used once, removed from deck |
| **Exhaust** | `exhaust: true` | Used in combat, removed after |
| **Power** | `lifecycleType: 'power'` | Activated once, active entire combat, removed after |
| **Gated** | `lifecycleType: 'gated'` | Requires resource, not consumed, prevents infinite play |
| **Persistent** | (default) | Stays in deck across combats |

#### 2.5.3. CardStateAuthority (CSA) Pattern

```javascript
// From UI-CANON.md - single source of truth for hand, backup, vault
const CardStateAuthority = {
  // State arrays (GAMESTATE wrappers)
  hand:      [],    // max 5 cards
  backup:    [],    // max 25 cards
  vault:     [],    // 9-12 persistent slots
  
  // Events emitted
  events: [
    'hand:changed',
    'backup:changed', 
    'vault:changed',
    'draw:reset',
    'card:disposed'
  ],
  
  // Integration points
  GAMESTATE: 'Low-level state arrays',    // gamestate.js
  CTM:       'Cross-container drag/drop',  // card-transfer-manager.js
  CSA:       'Single source of truth',     // this module
};
```

### 2.6. Engineering Considerations

The `Run` model will be implemented as an extension of the `world.json` file that is exported from the `unified-designer`. The `exportWorld` function in `world-designer.js` will be modified to include the `baseSeed`, `runClass`, and other relevant fields.

The floor resolution logic will be implemented in the game engine, and it will be responsible for applying the `ParamMutationEvents` from the `paramOverlayLog` to the base floor data.

## 3. Designer Tool Integration (Portal)

The Unified Designer at `/portal` provides the workflow for creating worlds that integrate with the procedural generation system.

### 3.1. Unified Designer Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED DESIGNER HUB                         │
│                   (unified-designer.html)                       │
├─────────────────────────────────────────────────────────────────┤
│  [Asset Designer] → [Map Designer] → [World Designer] → [Export] │
└─────────────────────────────────────────────────────────────────┘
        │                │               │
        ▼                ▼               ▼
   ┌─────────┐     ┌──────────┐    ┌─────────────┐
   │ Assets  │     │ Floor    │    │ Step Nodes  │
   │ Registry│     │ Maps     │    │ (SFC Graph) │
   └─────────┘     └──────────┘    └─────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │   world.json    │
                                    │ (exported file) │
                                    └─────────────────┘
```

### 3.2. World Designer Node Properties

Each step node in the World Designer supports:

```javascript
// Node data structure (from world-designer.js:489-497)
{
  id: 'node-id',
  name: 'Floor Name',
  top: '100px',
  left: '200px',
  type: 'step',                    // step, transition, parallel, convergence
  biome: 'FOREST | MALL | ...',    // biome selection
  generationType: 'CONTRIVED | PROCEDURAL',  // floor generation method
  // Extended for hybrid seed:
  seedModifier: 'string',          // optional seed override
  difficultyBand: 'EASY | NORMAL | HARD',
  mutationBudget: 100,             // param mutation budget
}
```

### 3.3. Export World Structure

```javascript
// Extended exportWorld() structure (from world-designer.js:478-515)
function exportWorld() {
  const worldData = {
    // World graph
    nodes: [...],      // Step nodes with biome, generationType
    connections: [...],
    
    // Hybrid seed extensions
    baseSeed: 'procedurally-generated-or-user-specified',
    runClass: 'STATIC',              // HUMAN_MODERATED, AGENT_MODERATED, HYBRID
    mutationLog: [],                 // StructuralMutationEvent[]
    paramOverlayLog: [],             // ParamMutationEvent[]
    mutationBudgetRemaining: 100,
    
    // Integrity verification
    structuralHash: 'sha256...',
    paramHash: 'sha256...',
    resolvedHash: 'sha256...',
  };
  
  // Downloads as world.json
}
```

### 3.4. Contrived vs. Procedural Generation

From `WORLD_BUILDING_ENGINE_ROADMAP.md`:

*   **Contrived (Template-based):** Designer-specified floor layouts from Map Designer
*   **Procedural:** Seed-driven generation via `floor-gen-core.js` with biome weighting

```javascript
// Floor type selection (from biome-config.js)
function getFloorType(floorNum, ctx) {
  if (floorNum <= 2) return FLOOR_TYPES.TUTORIAL;
  if (floorNum <= 4) return FLOOR_TYPES.GHOST;
  if (isBonfire(floorNum)) return FLOOR_TYPES.BONFIRE;
  if (floorNum === 30) return FLOOR_TYPES.FINAL;
  if (isBoss(floorNum)) return FLOOR_TYPES.BOSS;
  
  // Random exploration floors (5% chance on floors 15+)
  if (floorNum >= 15 && rng() < 0.05) return FLOOR_TYPES.EXPLORATION;
  
  // Light stealth early, combat later
  if (floorNum <= 9) return FLOOR_TYPES.STEALTH;
  return FLOOR_TYPES.COMBAT;
}
```

## 4. Mutation Rules and Budget

To ensure that live moderation is fair and predictable, the system enforces a strict set of rules for all mutations.

### 4.1. Strict F+1 Mutation

The most important rule is that all mutations (both structural and parameter-based) are only allowed on the next floor (F+1). This has several key benefits:

*   **No mid-floor manipulation:** The current floor can never be changed while the player is on it.
*   **No retroactive changes:** Past floors cannot be altered.
*   **No far-future stacking:** Designers and agents cannot pre-stack a series of mutations deep into the run.

This rule is enforced by the `rejectMutation` function, which will reject any mutation that does not target the `currentFloorIndex + 1`.

### 4.2. Mutation Budget

To prevent abuse, each floor has a `paramBudget` that limits the amount of parameter drift that can be applied. The total weighted drift for all parameter mutations on a floor cannot exceed this budget.

### 4.3. Engineering Considerations

The "Strict F+1 Mutation" and "Mutation Budget" rules will be enforced by the M-Console's UI and the underlying game engine. The "BIG BROTHER" mode in the M-Console (implemented in `scenario-designer.html`) is the gateway to all live manipulation features. The `rejectMutation` function will be implemented in the game engine and will be responsible for validating all mutation requests.

## 5. Player-Driven Manipulation

Players can find and use special items that allow them to influence the mutation system, giving them a degree of control over the game's dynamism.

### 5.1. They Live Glasses (Foresight)

The "They Live Glasses" are a player item that extends the mutation window to F+2, allowing the player to see and influence the floor after the next one. This provides a greater degree of foresight and control, but it comes with trade-offs.

#### 5.1.1. Mechanics

*   **Extended Window:** When equipped, the mutable floor window is extended to `F+2`.
*   **Limited Scope:** Mutations at F+2 are limited to parameter changes only. Structural changes are not allowed.
*   **Window Collapse:** The F+2 window is not permanent. It can collapse based on a variety of factors, such as time, player actions, or resource drain.

#### 5.1.2. Player State

The player's `futureVision` state is updated to reflect the extended window:

```javascript
{
  "maxWindow": 2,
  "currentWindow": 2,
  "closesAtFloor": null,
  "expiresAtTime": "timestamp",
  "energy": 100,
}
```

#### 5.1.3. Engineering Considerations

The `futureVision` object will be added to the player's data model in the game engine. The game engine will be responsible for enforcing the extended mutation window and the window collapse logic.

### 5.2. Winston Smith's Diary (Entropy)

The "Winston Smith's Diary" is a counter-item to the "They Live Glasses." It introduces "entropy" into the system, making future floors less predictable and hindering the effectiveness of live moderation.

#### 5.2.1. Mechanics

*   **Mutation Fog:** The Diary does not block mutations directly, but it corrupts foresight. When the Diary is active, the M-Console will see conflicting branches and flickering template options, and seed resolution will be delayed.
*   **Entropy Injection:** The Diary introduces an `entropyWeight` into the floor resolution process. Instead of resolving to a single, deterministic template, the system will resolve to a weighted random selection of templates.
*   **Ack Disruption:** The Diary can also disrupt the M-Console's ping and acknowledgment system, causing delayed or ghost acks and reducing the designer's confidence in the player's position.

#### 5.2.2. Player State

The player's `entropyField` state is updated to reflect the Diary's influence:

```javascript
{
  "strength": 0.35,
  "sourceItemId": "winston_diary",
}
```

#### 5.2.3. Engineering Considerations

The `entropyField` object will be added to the player's data model in the game engine. The game engine will be responsible for implementing the "Mutation Fog," "Entropy Injection," and "Ack Disruption" mechanics.

## 6. Leaderboard Integrity

To ensure competitive integrity, the high score system clearly distinguishes between different run types based on their "Run Integrity Class."

### 6.1. Run Integrity Classes

*   **Class A (Static):** A deterministic run with no live manipulation.
*   **Class B (Human-Moderated):** A run that was manipulated by a human designer.
*   **Class C (Agent-Moderated):** A run that was manipulated by the Live Agentic Moderator.
*   **Class D (Hybrid):** A run that was manipulated by a combination of human and agent intervention.

### 6.2. Scoreboard Layout

The high score board is divided into separate tabs for each run integrity class. This ensures that players are only competing against others who played under the same conditions.

### 6.3. Public Transparency

### 6.4. Engineering Considerations

The `runClass` will be a property of the `Run` model, and it will be set by the game engine based on whether the run has been manipulated. The high score board will need to be implemented on the game's backend, and it will need to be able to filter and display runs based on their `runClass`.

## 7. M-Console Integration

The M-Console provides a UI for designers and agents to interact with the Hybrid Seed Architecture and Live Moderation System.

### 7.1. "BIG BROTHER" Mode

As described in the "Live Agentic Game Moderation System" document, the "BIG BROTHER" mode in the AWOL tab is the gateway to all live manipulation features. It is a global toggle that enables or disables the M-Console's ability to ping player accounts and mutate future floors.

### 7.2. F+1 Mutation UI

When "BIG BROTHER" mode is active, the M-Console will display a new UI for the F+1 floor, which includes:

*   **Param Delta Meter:** A meter that shows the current parameter drift for the floor.
*   **Mutation Budget Bar:** A bar that shows the remaining budget for parameter mutations.

### 7.3. Engineering Considerations

The M-Console UI described in this document is a more advanced version of the `scenario-designer.html` file. The existing code in `scenario-designer.html` can be used as a starting point for implementing the new features, such as the "Param Delta Meter," "Mutation Budget Bar," and "Structural Edit Icon."

## 8. Reference Documentation

| Document | Purpose |
|----------|---------|
| `BIOME_SYSTEMS.md` | Biome selection, vents, floor shuffling, procedural ingredients |
| `biome-config.js` | Biome weight distribution by floor depth |
| `floor-gen-core.js` | Procedural floor generation pipeline |
| `COLLECTIBLES_CANON.md` | 9 canonical collectible categories, RESOURCE_COLORS |
| `CARD_DB_TODO.md` | Card database gap analysis, synergy tags, lifecycle types |
| `UI-CANON.md` | HUD component map, CardStateAuthority, Hand Fan state machine |
| `UNIFIED_DESIGNER_GUIDE.md` | Portal workflow: Asset → Map → World Designer |
| `world-designer.js` | `exportWorld()` implementation |
| `WORLD_BUILDING_ENGINE_ROADMAP.md` | World Designer phases, SFC evaluation |
