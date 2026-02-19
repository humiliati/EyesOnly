# Gone Rogue: Biome Systems - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Vents System](#vents-system)
4. [Floor Shuffling](#floor-shuffling)
5. [Biome Bleed](#biome-bleed)
6. [Biome-Specific Card Drops](#biome-specific-card-drops)
7. [Biome Catalog](#biome-catalog)
8. [Testing](#testing)
9. [Technical Implementation](#technical-implementation)

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

## Changelog

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

---

**Document Version**: 1.0
**Last Updated**: 2026-02-19
**Status**: Complete consolidated guide
