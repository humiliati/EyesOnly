# Gone Rogue: Biome Systems - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Vents System](#vents-system)
4. [Floor Shuffling](#floor-shuffling)
5. [Biome Bleed](#biome-bleed)
6. [Biome-Specific Card Drops](#biome-specific-card-drops)
7. [Biome Background Gradients](#biome-background-gradients)
8. [Biome Catalog](#biome-catalog)
9. [Testing](#testing)
10. [Technical Implementation](#technical-implementation)

---

## Overview

Gone Rogue features a rich biome system that provides variety, strategic depth, and organic environmental transitions. This system includes:

- **🕳️ Vents**: Risk/reward bypass mechanic for skipping floors
- **🎲 Floor Shuffling**: Weighted random biome selection for replayability
- **🌊 Biome Bleed**: Tiles from adjacent biomes appear at floor edges
- **🎯 Biome-Specific Drops**: Cards weighted by biome theme

These systems work together to create unique runs with environmental storytelling and tactical variety.

---

## Quick Start

### What Was Added

**Three core systems:**
1. **Vents** - Skip floors (risky) or backtrack with penalties
2. **Floor Shuffling** - Random biome selection for variety
3. **Biome Bleed** - Tiles from adjacent biomes at edges

**Plus one enhancement:**
4. **Biome-Specific Card Drops** - Thematically appropriate loot per biome

### How to Test

#### Automated Tests
```bash
npm run dev
# Open: http://localhost:8787/tests/test-vents-biome-shuffle.html
```

#### Manual - Vents
1. Start Gone Rogue (`ROGUE` command)
2. Find 'V' tile (15% spawn rate on floors 5+)
3. Use `INTERACT` twice (discover, then attempt)
4. Outcomes:
   - ✅ Success: Skip to floor N+2
   - ❌ Failure: Backtrack 3 floors, see 🔻 PENALTY

#### Manual - Floor Shuffling
1. Start multiple runs
2. Check biome in status line
3. Verify variety after floor 4

#### Manual - Biome Bleed
1. Play through floors
2. Look for different tiles at map edges
3. Left side: previous biome, Right side: next biome

#### Manual - Card Drops
1. Pick up cards in different biomes
2. Verify thematic appropriateness:
   - Grey Cave: Stealth cards (Silent Shot, Cigarettes)
   - Industrial: Explosive cards (Grenade, Explosive Shot)
   - Mall: Utility cards (Medical Kit, Energy Drink)

### Key Numbers

**Vent Success:**
- Base: 75%
- Per use: -5%
- Per floor: -1%
- Per tier (T2/T3): -5%
- Rusty: -5%
- Minimum: 25%

**Penalty Floors:**
- Enemies: +20% stats, +1 sight
- Count: 3 floors
- Marker: 🔻

**Biome Weights (Floors 10-15):**
- Industrial: 40%
- Mall: 25%
- Cave: 15%
- Forest: 10%
- Aerospace: 10%

---

## Vents System

### Concept
Vents provide a risk/reward bypass mechanic, allowing players to skip floors at the cost of potential backtracking with increased difficulty.

### Spawning
- **Probability**: 15% chance per floor
- **Restrictions**: No vents on tutorial, bonfire, boss, or final floors
- **Placement**: Random position within mid-size rooms (4x4 to 8x8)
- **Quality Types**:
  - Standard (85%): Normal success rate
  - Rusty (15%): -5% success penalty

### Interaction Flow
1. **Discovery**: Player moves onto vent tile ('V'), uses INTERACT command
   - Displays vent quality and destination
   - "Use INTERACT again to attempt bypass"

2. **Bypass Attempt**: Player uses INTERACT again
   - Calculates success probability
   - Executes success or failure outcome

### Success Probability
```javascript
baseChance = 0.75  // 75% base
baseChance -= (ventUseCount × 0.05)  // -5% per prior use
baseChance -= (currentFloor × 0.01)   // -1% per floor depth
baseChance -= (difficultyTier - 1) × 0.05  // -5% per tier above T1
if (rustyVent) baseChance -= 0.05    // -5% for rusty quality
baseChance = Math.max(0.25, baseChance)  // Minimum 25%
```

### Success Outcome
- Skip to floor N+2
- Award 50% XP for skipped floor (floor N+1)
- Vent becomes unusable
- Normal floor generation at destination

### Failure Outcome
- Backtrack 3 floors (or to floor 1 if less than floor 4)
- Take 2 HP damage from fall
- Mark 3 floors as "penalty floors"
- Penalty floors spawn enhanced enemies:
  - +20% HP, STR, DEX
  - +1 sight range
  - Visual indicator: 🔻 PENALTY in status line

### Integration with Difficulty Tiers
- Higher tiers reduce vent success rate
- T1: 0% penalty
- T2: -5% penalty
- T3: -10% penalty

### Player Strategy
**When to use vents:**
- Low HP and want to skip dangerous floor
- High floor depth (harder but skips more)
- Early in run (better success rate)

**When to avoid vents:**
- Already used multiple vents (reduced success)
- High floor depth (very low success chance)
- Near boss floor (backtracking could be catastrophic)

---

## Floor Shuffling

### Concept
Instead of fixed biome progression, floors use weighted random selection to provide variety and replayability.

### Biome Weight Distribution

#### Floors 1-3 (Tutorial)
- **Forest**: 100%
- Guaranteed for new player onboarding

#### Floor 4 (Special)
- **Grey Cave**: 100%
- Fixed special floor

#### Floors 5-6 (Early Game)
- **Forest**: 60%
- **Mall**: 20%
- **Industrial**: 15%
- **Grey Cave**: 5%

#### Floors 7-9 (Mid-Early Game)
- **Forest**: 25%
- **Mall**: 35%
- **Industrial**: 30%
- **Grey Cave**: 10%

#### Floors 10-15 (Mid Game)
- **Forest**: 10%
- **Mall**: 25%
- **Industrial**: 40%
- **Grey Cave**: 15%
- **Aerospace**: 10%

#### Floors 16-22 (Late Game)
- **Forest**: 5%
- **Mall**: 20%
- **Industrial**: 35%
- **Grey Cave**: 10%
- **Aerospace**: 30%

#### Floors 23+ (Endgame)
- **Mall**: 10%
- **Industrial**: 20%
- **Aerospace**: 70%

### Boss Floor Overrides
Boss floors (10, 16, 22, 30) may use specific biomes appropriate to the boss encounter.

### Implementation
```javascript
function _getBiome(floorNum) {
  // Calculate weights based on floor range
  // Select random biome using weighted probability
  // Return BIOMES[selectedKey]
}
```

---

## Biome Bleed

### Concept
Tiles from adjacent biomes appear at floor edges, creating organic environmental transitions and foreshadowing upcoming areas.

### Bleed Types

#### Entrance Bleed (Previous Biome)
- Appears near player spawn (left side of map)
- 5-10 tiles from previous floor's biome
- Creates continuity from last floor

#### Exit Preview (Next Biome)
- Appears near exit (right side of map)
- 5-10 tiles previewing next floor's biome
- Cached to ensure consistency

### Bleed Tile Mapping

| Biome | Bleed Tile | Character | Description |
|-------|-----------|-----------|-------------|
| Cozy Forest | GRASS | , | Grass/foliage |
| Shopping Mall | DEBRIS | ░ | Mall debris/litter |
| Industrial Complex | HAZARD | ▒ | Oil/rust/waste |
| Grey Cave | SHADOW | ░ | Cave shadows/darkness |
| Aerospace Museum | DEBRIS | ░ | Metal debris |

### Implementation Details
```javascript
function _applyBiomeBleed(rooms) {
  // Apply entrance bleed from previous biome
  if (_previousBiome && _previousBiome !== currentBiome) {
    _applyBleedTiles(_previousBiome, 'entrance', 5, 10);
  }

  // Apply exit preview for next biome
  if (_floor < 30) {
    if (!_nextBiomePreview) {
      _nextBiomePreview = _getBiome(_floor + 1);
    }
    if (_nextBiomePreview !== currentBiome) {
      _applyBleedTiles(_nextBiomePreview, 'exit', 5, 10);
    }
  }

  // Cache for next floor
  _previousBiome = currentBiome;
  _nextBiomePreview = null;
}
```

### Placement Algorithm
```javascript
function _applyBleedTiles(biome, location, minCount, maxCount) {
  var count = minCount + random(maxCount - minCount + 1);

  for (i = 0; i < count; i++) {
    if (location === 'entrance') {
      // Place near left side (x: 1-8)
      x = 1 + random(8);
    } else {
      // Place near right side (x: GRID_WIDTH-9 to GRID_WIDTH-1)
      x = GRID_WIDTH - 9 + random(8);
    }
    y = 1 + random(GRID_HEIGHT - 2);

    // Only place on empty floor tiles
    if (_grid[y][x] === TILES.EMPTY) {
      _grid[y][x] = getBleedChar(biome);
    }
  }
}
```

---

## Biome-Specific Card Drops

### Overview
Each biome has thematically appropriate card drops with weighted probability tables. This creates biome identity and rewards strategic exploration.

### Implementation
**Function**: `CardSystem.getRandomBaseCardByBiome(biomeName, floorNum)`
**Location**: `public/js/card-system.js:962-1058`

### Biome Card Weight Tables

#### Grey Cave (Stealth/Tactical)
Strategic stealth operations in darkness.

| Card | Weight | Rationale |
|------|--------|-----------|
| Silent Shot | 2.0x | Perfect for cave stealth |
| Cigarettes | 1.8x | Stress relief in darkness |
| Prone | 1.5x | Enhanced concealment |
| Kneel | 1.5x | Tactical positioning |
| Dive Cover | 1.5x | Emergency defense |
| Lure | 1.5x | Distraction tactics |
| Aim | 1.3x | Precision in shadows |

**Theme**: Patient, tactical play with emphasis on stealth and precision.

#### Cozy Forest (Survival Basics)
Natural environment with basic survival needs.

| Card | Weight | Rationale |
|------|--------|-----------|
| Katchup | 1.8x | Natural healing |
| Rations | 1.8x | Food supplies |
| Single Shot | 1.5x | Basic hunting |
| Cigarettes | 1.5x | Calm in nature |
| Dodge | 1.3x | Evade wildlife |
| Retreat | 1.3x | Safe withdrawal |

**Theme**: Survival fundamentals, healing emphasis, basic tactics.

#### Shopping Mall (Urban Equipment)
Commercial space with varied consumer goods.

| Card | Weight | Rationale |
|------|--------|-----------|
| Energy Drink | 1.8x | Convenience store item |
| Burst Shot | 1.5x | Security response |
| Medical Kit | 1.5x | First aid stations |
| Suppressive Fire | 1.3x | Security tactics |
| Jam Weapon | 1.3x | Tech disruption |
| Strafe | 1.5x | Mobile combat |

**Theme**: Consumer goods, varied utility, urban tactical gear.

#### Commercial Office (Tech/Precision)
Corporate environment with technological focus.

| Card | Weight | Rationale |
|------|--------|-----------|
| Jammer | 1.8x | Network disruption |
| Virus | 1.8x | Digital infiltration |
| Logic Hack | 1.5x | System access |
| Overwatch | 1.5x | Security monitoring |
| Single Shot | 1.3x | Precision tools |
| Stim Pack | 1.3x | Corporate enhancement |

**Theme**: Technology, hacking, surveillance, precision operations.

#### Industrial Complex (Heavy Firepower)
Manufacturing facility with hazardous materials.

| Card | Weight | Rationale |
|------|--------|-----------|
| Explosive Shot | 1.8x | Industrial explosives |
| Grenade | 1.8x | Demolition equipment |
| Burst Shot | 1.5x | Heavy armament |
| Suppressive Fire | 1.5x | Area control |
| Block | 1.3x | Hard cover |
| Medical Kit | 1.3x | Workplace safety |

**Theme**: Heavy ordnance, area denial, dangerous environment.

#### Aerospace Museum (High-Tech/Precision)
Advanced technology showcase with precision equipment.

| Card | Weight | Rationale |
|------|--------|-----------|
| Aim | 1.8x | Targeting systems |
| Overwatch | 1.8x | Advanced sensors |
| High Ground | 1.8x | Strategic positioning |
| Explosive Shot | 1.5x | Military ordnance |
| Jammer | 1.5x | Electronic warfare |
| Virus | 1.5x | Cyber operations |

**Theme**: Military precision, advanced technology, strategic superiority.

### Floor Progression Scaling

In addition to biome weights, cards are scaled by floor depth:

**Early Game (Floors 1-5)**: +50% weight for basic cards
- Single Shot, Dodge, Katchup, Cigarettes, Retreat

**Late Game (Floors 16+)**: +50% weight for advanced cards
- Explosive Shot, Grenade, Suppressive Fire, Overwatch, High Ground

**Result**: Natural power curve through loot progression.

### Integration

**Modified Function**: `_placeItems()` in `gone-rogue.js:2477-2485`

```javascript
// Use biome-aware card selection if available
var baseType;
if (CardSystem.getRandomBaseCardByBiome) {
  baseType = CardSystem.getRandomBaseCardByBiome(biome.name, _floor);
} else {
  baseType = CardSystem.getRandomBaseCard();
}
card = CardSystem.rollCard(baseType);
```

**Fallback**: If biome function unavailable, uses random selection.

---

## Biome Catalog

### 1. Cozy Forest 🌳
**Theme**: Natural wilderness, basic survival
**Atmosphere**: Organic, calming, tutorial-friendly
**Key Features**:
- Grass tiles for stealth bonus
- Tree breakables for cover
- Natural healing items

**Drop Focus**: Survival basics, healing, basic weapons

### 2. Grey Cave 🗿
**Theme**: Dark underground, tactical stealth
**Atmosphere**: Claustrophobic, high-risk
**Key Features**:
- Shadow tiles for high stealth bonus
- Narrow corridors
- Trench coat guaranteed spawn

**Drop Focus**: Stealth cards, tactical positioning

### 3. Shopping Mall 🏬
**Theme**: Urban commercial, varied equipment
**Atmosphere**: Open spaces, consumer goods
**Key Features**:
- Debris tiles
- Multiple shops
- Varied loot density

**Drop Focus**: Utility items, urban gear, medical supplies

### 4. Commercial Office 🏢
**Theme**: Corporate space, tech focus
**Atmosphere**: Structured, technological
**Key Features**:
- Clean floors
- Cubicle layouts
- Security systems

**Drop Focus**: Hacking tools, precision weapons, surveillance

### 5. Industrial Complex 🏭
**Theme**: Manufacturing, heavy ordnance
**Atmosphere**: Hazardous, industrial
**Key Features**:
- Hazard tiles (oil, waste)
- Heavy machinery
- Dense enemy patrols

**Drop Focus**: Explosives, heavy weapons, area control

### 6. Aerospace Museum ✈️
**Theme**: Military technology, high-tech
**Atmosphere**: Open displays, strategic
**Key Features**:
- Open sight lines
- High ceilings
- Advanced positioning

**Drop Focus**: Precision weapons, advanced tech, strategic cards

---

## Testing

### Automated Tests
**Location**: `public/tests/test-vents-biome-shuffle.html`

**Tests Included:**
- GoneRogue module availability
- Difficulty tier methods
- Floor shuffling integration
- Vent system integration
- Biome bleed integration

### Manual Testing Checklist

#### Vents System
- [ ] Vent spawns on eligible floors (check ~15% rate over 10+ runs)
- [ ] Vent discovery message displays correctly
- [ ] Bypass success skips to floor N+2
- [ ] Bypass failure backtracks 3 floors
- [ ] Penalty enemies have enhanced stats
- [ ] Penalty floor indicator (🔻) appears
- [ ] Success rate decreases with multiple uses
- [ ] Rusty vents have lower success rate
- [ ] No vents on tutorial/bonfire/boss floors

#### Floor Shuffling
- [ ] Floors 1-3 always Forest
- [ ] Floor 4 always Grey Cave
- [ ] Floors 5+ show variety across runs
- [ ] Late-game heavily weighted toward Aerospace
- [ ] Boss floors use appropriate biomes

#### Biome Bleed
- [ ] Previous biome tiles appear near entrance
- [ ] Next biome tiles appear near exit
- [ ] Bleed tiles match expected types (grass, debris, etc.)
- [ ] Transitions feel organic
- [ ] No bleed on floor 1 (no previous biome)

#### Card Drops
- [ ] Grey Cave drops favor stealth cards
- [ ] Industrial drops favor explosive cards
- [ ] Mall drops provide varied utility
- [ ] Floor progression creates power curve
- [ ] Early floors provide basic cards
- [ ] Late floors provide advanced cards

---

## Technical Implementation

### State Variables
```javascript
// Vents
_vents = [];              // Current floor vents
_ventUseCount = 0;        // Total uses this run
_penaltyFloors = [];      // Floors marked as penalty

// Biome Bleed
_previousBiome = null;    // Last floor's biome
_nextBiomePreview = null; // Cached next floor preview
_visitedBiomes = [];      // All visited biomes
```

### Integration Points
1. **Floor Generation**: Vents spawn after rooms, before interactive items
2. **Biome Selection**: Called during floor generation, uses weighted random
3. **Biome Bleed**: Applied after floor generation, before lighting
4. **Card Drops**: Called during item placement, uses biome + floor context
5. **Enemy Creation**: Checks penalty floor status, applies stat multiplier
6. **Interaction Handler**: Checks for vent tile, routes to vent logic

### Performance Considerations
- Biome selection: O(1) with weighted random
- Bleed tile placement: O(n) where n = bleed count (5-10)
- Vent spawn: O(1) per floor
- Penalty floor check: O(1) array lookup
- Card weight calculation: O(n) where n = card pool size (~35 cards)

### Files Modified
- `public/js/gone-rogue.js` - Core systems (vents, bleed, floor shuffling)
- `public/js/card-system.js` - Biome-specific card drops
- `public/tests/test-vents-biome-shuffle.html` - Automated tests

---

## Environmental Puzzles TODO

### Overview

Environmental puzzles transform ground effects, lighting, and interactive items from passive hazards into active tactical tools — bringing Commandos-style stealth problem-solving to each biome. Every puzzle should be **readable** (player can see the solution elements), **plannable** (player forms a strategy before acting), and **multi-solution** (at least 2 valid approaches).

See [ENEMY_AI.md](./ENEMY_AI.md) for the full enemy behavior roadmap that these puzzles depend on.

### Design Rules

1. **No new tile types** — puzzles use existing ground effects (fire, water, oil, smoke, electrified) and stealth tiles (shadow, grass, cover)
2. **No new item systems** — puzzles use existing cards (Cigarettes, Lure, Oil Slick, Lighter, Water Bottle, Grenade) via a new `USE [item] [direction]` command
3. **Enemies must react** — puzzles only work if enemies avoid hazards, investigate disturbances, and propagate alerts (see ENEMY_AI.md Phases 1-2)
4. **Tutorial floors are hand-crafted** — puzzle floors use `tutorial-floors.js` contrived layout system, not procedural generation
5. **Procgen floors get puzzle _ingredients_** — procedural floors scatter ground effect tiles + items that allow emergent puzzle-solving, but don't guarantee solvable set-pieces

---

### Puzzle Vocabulary

These are the atomic interactions that combine into puzzles. All use existing systems.

#### Distraction Loop (Lure + Investigation)
- **Setup**: Enemy patrols near player's desired path
- **Action**: Player uses Lure card → creates noise at target location
- **Result**: Enemy enters INVESTIGATING state, walks toward noise source
- **Window**: 3-5 turns to cross while enemy is diverted
- **Systems**: Lure card (existing), Investigation behavior (ENEMY_AI.md §1.3)

#### Smoke Screen (Cigarettes + Vision Block)
- **Setup**: Open area with enemy sight coverage, no concealment tiles
- **Action**: Player uses Cigarettes → SMOKE ground effect at player position
- **Result**: Smoke blocks enemy LOS through affected tiles; also blocks alert cascade propagation
- **Window**: 5 turns before smoke dissipates
- **Systems**: Cigarettes card (existing), Smoke stealth bonus -40% (existing), alert cascade blocking (ENEMY_AI.md §1.2)

#### Fire Funnel (Oil + Lighter + Enemy Avoidance)
- **Setup**: Oil tiles placed between player and enemies, lighter available
- **Action**: Player uses Lighter on oil → FIRE spreads across connected oil tiles
- **Result**: Enemies pathfind around fire (ENEMY_AI.md §2.1), creating a new safe corridor
- **Duration**: 8 turns of fire, then extinguishes
- **Chain**: If water is adjacent to fire → STEAM (acts as smoke, 3 turns)
- **Systems**: Oil tiles (existing), Lighter item (existing), fire spread (existing per tutorial doc), enemy avoidance (ENEMY_AI.md §2.1)

#### Darkness Drop (Shootable Lights + Stealth)
- **Setup**: Well-lit room with environmental light sources, enemy patrols the lit zone
- **Action**: Player shoots light source (💡, 💻, 🪔) → area goes dark
- **Result**: Darkness stealth bonus activates (up to +50%), player can cross formerly-lit zone unseen
- **Noise tradeoff**: Breaking a light generates noise (8-12), may trigger investigation
- **Systems**: LightingSystem (existing), breakable system (existing for crates/barrels, extend to lights), darkness stealth bonus (existing)

#### Wet Trap (Water + Tazer/Electric + Chain Stun)
- **Setup**: Water tiles in a chokepoint, enemies patrol through water
- **Action**: Wait for enemy to step into water, then use Tazer card or throw battery
- **Result**: ELECTRIFIED WATER → all entities in connected water tiles are stunned for 1 round
- **Systems**: Water tiles (existing), Electrified Water (existing per tutorial doc), Tazer weapon (existing in enemy intent system)

#### Silent Takedown (Steal + Sleeping + Body Hiding)
- **Setup**: Isolated enemy away from patrol routes of other enemies
- **Action**: Approach from behind (UNAWARE), use STEAL with intimidate tool → enemy becomes SLEEPING
- **Result**: Enemy neutralized for 10 turns; if another enemy passes within 2 tiles, they discover the body and go ALERTED
- **Mitigation**: Neutralize enemies near cover/rooms where patrols don't pass
- **Systems**: Theft system (existing), intimidate stealTag (extend existing), body discovery (ENEMY_AI.md §4.2)

#### Concealment Burn (Lighter + Grass)
- **Setup**: Grass tiles providing stealth bonus, but also blocking player's desired path or hiding an enemy
- **Action**: Use Lighter on grass → grass burns away (FIRE, 5 turns), then tile becomes EMPTY
- **Result**: Removes concealment permanently; useful if grass is helping an enemy hide, or to create a fire barrier
- **Tradeoff**: Destroys YOUR stealth option too — irreversible
- **Systems**: Grass tiles (existing), Lighter (existing), fire (existing)

---

### Biome Puzzle Profiles

Each biome should feature puzzles that emphasize its environmental identity.

#### Forest (Floors 1-3) — "Patrol Gap" Puzzles
- **Primary tools**: Grass (concealment), Lure (distraction), Cigarettes (smoke)
- **Signature puzzle**: Time patrol gaps through grass corridors, use Lure to extend the window
- **Ground effects available**: Grass, Water (streams), Shadow (tree canopy)
- **Puzzle density**: LOW (1 set-piece per floor, tutorial pacing)
- **Card drops support**: Silent Shot (2.0x weight in cave, usable here), Lure (1.5x cave), Cigarettes (1.8x cave/1.5x forest)

#### Grey Cave (Floor 4) — "Darkness Maze" Puzzles
- **Primary tools**: Shootable lights (lava lamps, campfires), Lighter (temporary light), NVG
- **Signature puzzle**: Destroy lights to create dark corridors, navigate with minimal light, avoid enemy sight cones in remaining lit areas
- **Ground effects available**: Shadow (dense), Lava (hazard), minimal water
- **Puzzle density**: MEDIUM (cave is already the stealth-focused biome)
- **Card drops support**: Silent Shot (2.0x), Prone (1.5x), Dive Cover (1.5x)

#### Shopping Mall (Floors 5-9) — "Fire Funnel" Puzzles
- **Primary tools**: Oil slicks, Lighter, Water Bottle (extinguish), fire barriers
- **Signature puzzle**: Mall is too bright for stealth → must use fire to redirect enemy patrols instead of hiding
- **Ground effects available**: Oil (from maintenance areas), Debris, some Water (fountains)
- **Puzzle density**: MEDIUM (transition from pure stealth to environmental manipulation)
- **Card drops support**: Energy Drink (1.8x), Burst Shot (1.5x), Strafe (1.5x)
- **Special**: Light Bulbs (💡) are shootable, but mall has 80% lit ratio — shooting one doesn't create enough darkness alone

#### Office (Floors 10-15) — "Hack & Dark" Puzzles
- **Primary tools**: Jammer (disable enemy sight), shoot monitors (create darkness), Virus (confuse patrol)
- **Signature puzzle**: Offices have predictable monitor-lit corridors. Shoot monitors for darkness, use Jammer to temporarily blind a guard, cross in the dark
- **Ground effects available**: Minimal (clean offices), some Debris
- **Puzzle density**: HIGH (office layouts have cubicle walls creating interesting LOS puzzles)
- **Card drops support**: Jammer (1.8x), Virus (1.8x), Logic Hack (1.5x), Overwatch (1.5x)

#### Industrial (Floors 16-22) — "Chain Reaction" Puzzles
- **Primary tools**: ALL ground effect tools — Oil, Fire, Water, Electric, Smoke
- **Signature puzzle**: Set up multi-step chain reactions: Oil → Fire → Steam (smoke cover) → cross; or Water → Tazer → stun multiple enemies
- **Ground effects available**: Oil (abundant), Fire (hazards), Water (coolant), all chain combinations possible
- **Puzzle density**: HIGH (this is the "mastery" biome where all systems converge)
- **Card drops support**: Explosive Shot (1.8x), Grenade (1.8x), Suppressive Fire (1.5x)

#### Aerospace (Floors 23-30) — "Precision Run" Puzzles
- **Primary tools**: Everything learned, but with tighter margins
- **Signature puzzle**: High visibility, dense patrols, minimal ground effects. Must execute a precise sequence combining all previously learned techniques
- **Ground effects available**: Minimal (museum is clean), some imported via biome bleed
- **Puzzle density**: VERY HIGH (endgame tests all skills)
- **Card drops support**: Aim (1.8x), Overwatch (1.8x), High Ground (1.8x)
- **Special**: Floor 30 boss has 50% darkness multiplier on ALL lights — unique environmental shift

---

### Procedural Floor Puzzle Ingredients

For non-tutorial floors, the procedural generator should scatter puzzle ingredients that allow emergent Commandos-style play without guaranteeing a designed set-piece.

#### Ingredient Spawn Rules (add to `_generateFloor`)

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

#### Item Placement Heuristic

Place ground effect items **near the situations they solve**:
- Oil tiles near **narrow corridors** (fire funnel potential)
- Water tiles near **enemy patrol overlaps** (wet trap potential)
- Smoke-capable items near **open areas with no concealment** (smoke screen potential)
- Lure cards near **stationary enemies blocking key paths** (distraction potential)

This doesn't guarantee the player finds or uses them, but ensures the ingredients for emergent puzzle-solving are present.

---

### Implementation Checklist

#### Phase A: Foundation (enables any puzzle to work)
- [ ] `USE [item] [direction]` command in exploration mode
- [ ] Items with `groundEffect` property create ground effects on use
- [ ] Enemies check ground effects before moving (avoidance)
- [ ] Enemies investigate disturbance locations (noise sources)

#### Phase B: Tutorial Puzzles (hand-crafted set-pieces)
- [ ] Floor 2 layout in `tutorial-floors.js`: "The Watchtower" (patrol timing + concealment)
- [ ] Floor 3 layout in `tutorial-floors.js`: "The Distraction" (item → ground effect → patrol manipulation)
- [ ] Floor 4 layout in `tutorial-floors.js`: "The Alert Chain" (cascade + smoke blocking)
- [ ] Each puzzle floor includes MOK interjection hints (e.g., "💭 That oil looks flammable...")

#### Phase C: Procedural Ingredients (emergent puzzle support)
- [ ] Ground effect ingredient spawn rules per biome (see table above)
- [ ] Item placement heuristic (items near relevant terrain)
- [ ] Biome card drop tables updated with puzzle-relevant items
- [ ] At least 1 Lure + 1 smoke item guaranteed per procedural floor

#### Phase D: Polish (readability + feedback)
- [ ] Overhead animator shows ground effect creation (🔥 when oil ignites, 💨 when smoke appears)
- [ ] MOK tooltip when player stands near usable item + relevant terrain ("Oil nearby — USE LIGHTER to ignite")
- [ ] Enemy overhead shows investigation target (🔍 when walking toward disturbance)
- [ ] Sound indicators: noise radius preview when selecting a noisy action

---

### Testing Scenarios

#### Scenario 1: Smoke Bypass
1. Player has Cigarettes card
2. Enemy patrols corridor with no concealment
3. Player uses Cigarettes → smoke appears
4. Verify: enemy cannot detect player through smoke
5. Verify: smoke dissipates after 5 turns
6. Verify: enemy resumes normal patrol after smoke clears

#### Scenario 2: Fire Funnel
1. Floor has oil tiles in a corridor
2. Player has Lighter
3. Player ignites oil → fire spreads to connected oil tiles
4. Verify: enemy pathfinds around fire
5. Verify: fire burns out after 8 turns
6. Verify: if water is adjacent, steam (smoke) is created

#### Scenario 3: Alert Cascade + Smoke Block
1. Three enemies: E1 near player, E2 5 tiles from E1, E3 5 tiles from E2
2. Smoke tiles between E1 and E2
3. Player alerts E1
4. Verify: E1 goes ALERTED
5. Verify: E2 does NOT receive cascade (smoke blocks)
6. Verify: E3 does NOT receive cascade (E2 never alerted)

#### Scenario 4: Silent Takedown + Body Discovery
1. Enemy A patrols near enemy B (stationary)
2. Player neutralizes enemy B (STEAL → SLEEPING)
3. Enemy A's patrol passes within 2 tiles of sleeping B
4. Verify: A discovers body, goes ALERTED
5. Test mitigation: neutralize B behind cover where A doesn't patrol

---

## Future Enhancements

### Potential Additions
1. **Vent Mastery System**
   - Track successful vent uses
   - Unlock perks at milestones
   - Visual indicators for vent quality

2. **Biome-Specific Vent Effects**
   - Forest vents: Better success rate
   - Industrial vents: More dangerous failures
   - Aerospace vents: Longer skips

3. **Penalty Floor Mechanics**
   - Special penalty-only enemy types
   - Environmental hazards
   - Bonus rewards for clearing penalty floors

4. **Biome Affinity Tracking**
   - Track player performance per biome
   - Unlock biome-specific bonuses
   - Achievements for biome diversity

5. **Vent Networks**
   - Multiple connected vents on some floors
   - Choose destination
   - Risk of getting lost

6. **Dynamic Biome Bleed**
   - Bleed intensity increases near biome transitions
   - Mixed biome floors (50/50 split)
   - Environmental storytelling through bleed patterns

7. **Card Drop Pity Timer**
   - Guarantee defensive card every N drops
   - Avoid duplicate cards within single floor
   - Seedable RNG for deterministic runs

---

## Enemy Catalog Variants (BIOME_SYSTEMS Integration)

Enemy behavior and available cards can be patched at runtime by the ground-effect layer using the `variants` block in `public/data/gone-rogue/enemy-catalog.json`. The following variants were added as part of the **Environment Synergy** work (Phase 6 of the enemy card system):

### BIND_TERRAIN

| Property | Value |
|---|---|
| **Ground effects** | `bind_terrain`, `tangled_debris` |
| **Cards added** | EATK-021 (Rope) |
| **Exposed tags added** | `improvised` |
| **Stat mods** | `bindDurationBonus: 1`, `setupRangedAccuracyBonus: 10` |

**Behavior**: Rope-trap floors, tangled debris fields, and choke-point corridors. Enemy Rope bind lasts 1 extra round and the `setup_ranged` accuracy window is amplified by +10. Player movement already penalized by the ground effect — the bind combo punishes standing still.

**Biomes**: Warehouse interiors, transit tunnels, forest underbrush, catacombs tight corridors.

### INDUSTRIAL_DEBRIS

| Property | Value |
|---|---|
| **Ground effects** | `debris`, `rubble` |
| **Cards added** | EATK-022 (Broken Lever) |
| **Exposed tags added** | `improvised` |
| **Stat mods** | `improvisedDamageBonus: 1`, `leverJamChance: 0.5` |

**Behavior**: Cluttered industrial floors — rubble, broken equipment, scattered scrap. Improvised-tagged enemy cards deal +1 damage. Broken Lever's `environment_interact` effect has a 50% chance to jam the nearest door, blocking player escape routes.

**Biomes**: Junkyard, construction site, abandoned factory, transit infrastructure damage zones.

### HIDDEN_CHAMBER

| Property | Value |
|---|---|
| **Ground effects** | `carved_walls`, `statue_tiles` |
| **Cards added** | EATK-023 (Secret Button) |
| **Exposed tags added** | `bribe` |
| **Stat mods** | `covertActionBonus: 0.2`, `alertGenerationMultiplier: 0.0` |

**Behavior**: Carved stone halls with hidden mechanisms — statue niches, pressure plates, concealed alcoves. Secret Button unlocked only on these tile types. `alertGenerationMultiplier: 0.0` makes all enemy actions completely silent while inside a hidden chamber. Stealing Secret Button gives the player access to the same passage network for a mid-combat reposition.

**Biomes**: Church catacombs, manor chapels, black-market vaults, underground shrines.

### Existing Light-Behavior Variants

The following variants were added in the lighting-system phase and remain unchanged:

| Variant | Behavior summary |
|---|---|
| SURVEILLANCE_NODE | Ignores broken lights; infrared mode in darkness; hack/disable exposed |
| ADAPTIVE_DRONE | Moves toward brightest tile; no panic; hack/emp exposed |
| FLASHLIGHT_GUARD | Clusters in lit tiles; +acc in light, −acc in dark; intimidate exposed |
| INVESTIGATIVE_TECHNICIAN | Moves toward broken-light anomaly; alert on investigation; hack exposed |
| PARANOID_CULTIST | Gains Zeal on flicker; panics on total darkness; hybrid fear threshold |

### Build Workflow

```bash
# After editing enemy-catalog.json variants, regenerate runtime files:
npm run build:enemyCatalog
# Outputs: enemy-cards.json (23 cards), enemy-decks.json (41 decks)
```

---

## Known Issues

### Minor Issues
1. Biome bleed tiles may occasionally overlap with other objects
2. Very early vent failures (floor 1-2) have minimal penalty impact
3. No visual distinction between standard and rusty vents until discovered
4. Biome name strings must match exactly ("Grey Cave" vs "grey_cave")

### Limitations
1. Biome preview at exit may not match actual next floor if vent is used
2. Penalty floors persist across save/load (by design)
3. No limit on total penalty floors (could accumulate if many vent failures)
4. Card weights hardcoded in JavaScript (not designer-editable without code change)

---

## Biome Background Gradients

### Overview

Each biome defines a per-tile background gradient that replaces the former hardcoded `#0a0a0a` black floor background. This provides subtle environmental coloring that complements the biome's visual palette and improves readability of floor tiles against the background.

### Design Convention

The gradient system uses a **135-degree axial gradient** (top-left to bottom-right diagonal), matching the convention established by gambling card gradients in the Black Market shop system (`_getGambleGradientStyle` in `shop-system.js`). This consistency allows the gradient direction to hint at zone transitions and biome bleed.

### Day/Night Variants

Each biome defines two gradient configs:
- **Night** (`backgroundGradient.night`): Darker, more muted colors for even-numbered floors
- **Day** (`backgroundGradient.day`): Slightly brighter/warmer colors for odd-numbered floors

Floor parity determines variant: `isNight = (_floor % 2 === 0)`

### Gradient Configs by Biome

| Biome | Night Start | Night End | Day Start | Day End | Character |
|-------|-----------|---------|---------|-------|-----------|
| **Forest** | `#0a1a0a` | `#0d2a0d` | `#0a1a0a` | `#1a3a1a` | Two dark greens / dark to medium green |
| **Grey Cave** | `#0a0a0f` | `#0f0a1a` | `#0a0a0f` | `#0f0a1a` | Dark blue-grey (always dark) |
| **Office** | `#0a0a0a` | `#0f0f15` | `#0a0a12` | `#12121a` | Near-black to dark grey-blue |
| **Mall** | `#0a0a0a` | `#1a0a0a` | `#0f0a0a` | `#1a1010` | Dark to dark-red tint |
| **Industrial** | `#0a0a08` | `#1a1508` | `#0f0e08` | `#1a1a0a` | Dark to amber-tinted |
| **Aerospace** | `#08080f` | `#0f0f1a` | `#0a0a12` | `#141420` | Deep space blue |

### Technical Implementation

**Pre-computation:** At floor generation time, `_buildBiomeBackgroundColors(biome, isNight)` pre-computes a 40x20 array of hex color strings. The interpolation formula for 135-degree gradient:

```
t = (x + y) / (GRID_WIDTH + GRID_HEIGHT - 2)
color = lerp(startColor, endColor, clamp(t, 0, 1))
```

**Rendering:** The canvas renderer (`_renderWithCanvas` in `gone-rogue-mobile.js`) calls `GoneRogue.getBiomeBackgroundColor(x, y)` for each floor tile instead of using the hardcoded `#0a0a0a`. Wall tiles, door tiles, water tiles, and debris tiles keep their own distinct background colors.

**Files:**
- `gone-rogue.js`: `_hexToRgb()`, `_rgbToHex()`, `_lerpColor()`, `_buildBiomeBackgroundColors()`, `getBiomeBackgroundColor()` + `backgroundGradient` config on each BIOME
- `gone-rogue-mobile.js`: `_renderWithCanvas()` biome bg lookup for floor tiles

### Special Tile Overrides

These tiles ignore the biome gradient and use their own backgrounds:
- Walls (`█`, `▓`): `#333333`
- Debris (`░`): `#1a1a1a`
- Doors (`🚪`, `▼`): `#0a1a0a`
- Water (`~`): `#0a1a2a`

---

## Changelog

### 2026-02-20
- ✅ Added biome background gradient system (135-degree axial, per-biome day/night configs)
- ✅ Redesigned Floor 1 with 4-zone Zelda-style layout (Village Hub, Garden/Orchard, Hidden Grove, Gate Path)
- ✅ Added interactive items support to tutorial floors (signs, books, food, area of interest)
- ✅ Added water tile rendering and breadcrumb pickup system
- ✅ Added breakable bush wall mechanic for hidden grove discovery

### 2026-02-19
- ✅ Added biome-specific card drops with weighted tables
- ✅ Implemented floor progression scaling for card drops
- ✅ Documented all biome themes and card affinities

### 2026-02-18 (Initial Implementation)
- ✅ Vents system with success/failure mechanics
- ✅ Floor shuffling with weighted biome selection
- ✅ Biome bleed with entrance/exit tiles
- ✅ Integration with difficulty tier system
- ✅ Penalty floor system with enhanced enemies
- ✅ Test suite and documentation

---

## Credits

**Vents, Floor Shuffling, and Biome Bleed**:
Implementation based on design specifications from issue #47 ("Generic suggestions for new biome"), focusing on sections 3 (Vents Feature Repack) and 4 (Map Generator Modifications), with biome bleed from section 4.3 (Biome Bleed Algorithm).

**Biome-Specific Card Drops**:
Implementation based on GONE_ROGUE_DECKBUILDER_GAP_ANALYSIS.md Issue 2 (Procedural Reward / Encounter Tightening) and CARD_DB_TODO.md Section 10 (Biome Card Drop System Gap Analysis).

**Enemy Catalog Variants (BIND_TERRAIN, INDUSTRIAL_DEBRIS, HIDDEN_CHAMBER)**:
Added as part of the Environment Synergy / BIOME_SYSTEMS integration work (Phase 6 enemy cards). See `docs/ENEMY_CARDS.md` Phase 6 section for full card and deck details.

---

**Document Version**: 1.2
**Last Updated**: 2026-02-28
**Status**: Complete consolidated guide
