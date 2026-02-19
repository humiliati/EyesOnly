# Vents, Floor Shuffling, and Biome Bleed Implementation

## Overview

This document describes the implementation of three interconnected systems for Gone Rogue: Vents, Floor Shuffling, and Biome Bleed. These systems add strategic depth, replayability, and organic environmental transitions to the roguelike experience.

---

## 1. Vents System

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

---

## 2. Floor Shuffling System

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

## 3. Biome Bleed System

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

## Player Experience

### Discovery Phase
1. Player encounters first vent
2. Learns about bypass mechanics through discovery message
3. Decides whether to take risk

### Strategic Decisions
- **When to use vents**:
  - Low HP and want to skip dangerous floor
  - High floor depth (harder but skips more)
  - Early in run (better success rate)

- **When to avoid vents**:
  - Already used multiple vents (reduced success)
  - High floor depth (very low success chance)
  - Near boss floor (backtracking could be catastrophic)

### Visual Feedback
- Vents: 'V' character on grid
- Penalty floors: 🔻 PENALTY in status line
- Penalty enemies: Enhanced stats (not visually distinct from normal)
- Biome bleed: Visible tile variety at edges

### Biome Variety
- Multiple runs feel different due to floor shuffling
- Players learn to adapt to different biome challenges
- Late-game dominance by Aerospace creates endgame identity

---

## Technical Notes

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
4. **Enemy Creation**: Checks penalty floor status, applies stat multiplier
5. **Interaction Handler**: Checks for vent tile, routes to vent logic

### Performance Considerations
- Biome selection: O(1) with weighted random
- Bleed tile placement: O(n) where n = bleed count (5-10)
- Vent spawn: O(1) per floor
- Penalty floor check: O(1) array lookup

---

## Testing

### Automated Tests
Location: `public/tests/test-vents-biome-shuffle.html`

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

---

## Future Enhancements

### Potential Additions
1. **Vent Mastery System** (skipped in this implementation)
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

---

## Changelog

### v1.0.0 (Initial Implementation)
- ✅ Vents system with success/failure mechanics
- ✅ Floor shuffling with weighted biome selection
- ✅ Biome bleed with entrance/exit tiles
- ✅ Integration with difficulty tier system
- ✅ Penalty floor system with enhanced enemies
- ✅ Test suite and documentation

---

## Known Issues

### Minor Issues
1. Biome bleed tiles may occasionally overlap with other objects
2. Very early vent failures (floor 1-2) have minimal penalty impact
3. No visual distinction between standard and rusty vents until discovered

### Limitations
1. Biome preview at exit may not match actual next floor if vent is used
2. Penalty floors persist across save/load (by design)
3. No limit on total penalty floors (could accumulate if many vent failures)

---

## Credits

Implementation based on design specifications from issue #47 ("Generic suggestions for new biome"), focusing on sections 3 (Vents Feature Repack) and 4 (Map Generator Modifications), with biome bleed from section 4.3 (Biome Bleed Algorithm).
