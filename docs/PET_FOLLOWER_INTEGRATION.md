# Pet Follower System Integration Guide

## Overview
The Pet Follower System is an ultra-lightweight companion system for Gone Rogue mode. Pets follow the player using position history echo (no pathfinding or AI).

## Pet Tiers

### 1. Rumba/Pikachu Tier (🐭)
- **Type**: Cosmetic follower with tiny passive buffs
- **Delay**: 4 steps behind player
- **Passive Effects**:
  - +2% scrap proc chance
  - +1 stealth grace
  - +5% breakable drop chance
- **Grid-bound**: Yes (snaps to grid tiles)

### 2. Humanoid Tier (🧍)
- **Type**: Breaks nearby breakables automatically
- **Delay**: 3 steps behind player
- **Abilities**:
  - 20-75% chance to break adjacent breakables (quality-dependent)
  - 1-2 tile break radius (quality-dependent)
- **Grid-bound**: No (smooth movement)

### 3. Mega Tier (🔫) - Tanya
- **Type**: Engages STR combat with bonuses
- **Delay**: 2 steps behind player
- **Combat Modifiers**:
  - +5-10% accuracy (quality-dependent)
  - +0.2-0.4 crit multiplier when enemy is stunned
  - 5% chance for auto-strike (3-6 damage based on quality)
- **Grid-bound**: Yes
- **Jealousy System**: Only 1 mega pet allowed at a time

## Quality Levels

| Quality  | Break Chance | Break Radius | Stat Multiplier | Death Timer |
|----------|--------------|--------------|-----------------|-------------|
| COMMON   | 20%          | 1 tile       | 1.0x            | ~5 min      |
| UNCOMMON | 35%          | 1 tile       | 1.2x            | ~7 min      |
| RARE     | 50%          | 2 tiles      | 1.5x            | ~10 min     |
| MEGA     | 75%          | 2 tiles      | 2.0x            | ~15 min     |

## API Reference

### Creating Pets
```javascript
const pet = PetFollower.createPet(
  tier,        // PET_TIERS.RUMBA, HUMANOID, or MEGA
  quality,     // 'COMMON', 'UNCOMMON', 'RARE', or 'MEGA'
  emoji,       // '🐭', '🧍', '🔫', etc.
  name,        // Display name
  passiveEffect // { scrapProc: 0.02, dropChance: 0.05, stealthGrace: 1 }
);
```

### Adding Pets
```javascript
// Initialize pet position
pet.x = player.x;
pet.y = player.y;

// Add to active pets (returns false if jealousy system blocks)
const success = PetFollower.addPet(pet);
```

### Updating Pets (Game Loop)
```javascript
// Update pet positions based on player history
PetFollower.updatePets(playerPositionHistory, Date.now());

// Check for breakable interactions (humanoid pets only)
PetFollower.checkBreakables(breakables, function(breakable, index) {
  // Handle breakable destruction
  breakables.splice(index, 1);
});
```

### Combat Integration (STR Combat)
```javascript
const combatContext = {
  playerAccuracy: 0,
  playerCritMultiplier: 0,
  enemyStatus: { stunned: false, intensity: 0 },
  petAutoStrike: false,
  petStrikeDamage: 0
};

PetFollower.applyCombatModifiers(combatContext);

// Apply modifiers to player stats
player.accuracy += combatContext.playerAccuracy;
player.critMultiplier += combatContext.playerCritMultiplier;

if (combatContext.petAutoStrike) {
  // Apply auto-strike damage
  enemy.hp -= combatContext.petStrikeDamage;
}
```

## Testing

### Browser Testing
1. Open `public/tests/test-pet-system.html` in a browser
2. Run the test suite by clicking the test buttons

### In-Game Testing
1. Start Gone Rogue mode: `rogue` command
2. In browser console: `GoneRogue.spawnTestPets()`
3. Move around to see pets following
4. Observe:
   - Pets follow at different delays based on tier
   - Humanoid pets break nearby breakables
   - Combat with mega pet shows accuracy/crit bonuses

### Manual Testing
```javascript
// Create a single pet
const pet = PetFollower.createPet(
  PetFollower.PET_TIERS.RUMBA,
  'UNCOMMON',
  '🐭',
  'Pikachu',
  { scrapProc: 0.02 }
);
pet.x = 10;
pet.y = 10;
PetFollower.addPet(pet);

// Get active pets
const pets = PetFollower.getActivePets();
console.log('Active pets:', pets);

// Check if player has mega pet
const hasMega = PetFollower.hasMegaPet();
console.log('Has mega pet:', hasMega);
```

## Performance Notes

- **No pathfinding**: Pets use position history echo (circular buffer)
- **No AI**: Pets follow exact player path with delay
- **No scanning loops**: Breakable checks only happen on humanoid pet positions
- **Minimal memory**: Position history limited to 16 entries
- **Grid snapping**: Most pets snap to grid to avoid sub-pixel calculations

## Death System

- Pets have limited lifespan based on quality (5-15 minutes)
- Death timer initialized on acquisition
- Timer checked during pet update loop
- Dead pets automatically removed from active pets list

## Future Enhancements

- **Cursed pets**: Steal scrap procs instead of giving them
- **Combat initialization**: Low-quality Tanya pets force combat if in enemy sight cone
- **Pet revival**: Special items or bonfire services to revive dead pets
- **Pet fusion**: Combine two pets to create higher quality version
- **Pet abilities**: Special abilities that trigger on conditions

## File Locations

- Core module: `public/js/pet-follower.js`
- Integration: `public/js/gone-rogue.js` (lines 604-622, 3159-3171, 4879-4895, 6375-6399, 8855-8903)
- Canvas rendering: `public/js/gone-rogue-canvas.js` (lines 87, 274-317)
- Test harness: `public/tests/test-pet-system.html`

## Dependencies

- `public/js/seeded-rng.js` - Optional, for deterministic randomness
- `public/js/gone-rogue.js` - Player position history tracking
- `public/js/overhead-animator.js` - Optional, for breakable destruction effects
