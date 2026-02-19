# Card Synergy System - Implementation Guide

## Overview

The Card Synergy System transforms Gone Rogue's card-based combat into a tactical puzzle where resources enable combos, not maintenance anxiety. Players chain cards together to create explosive, game-breaking combinations.

## Core Philosophy

**Resources as Tactical Constraints, Not Maintenance**
- Energy isn't a cap to stay under; it's a timing puzzle to solve
- Ammo isn't a limit to respect; it's a resource to leverage with reload timing
- Fatigue isn't a penalty to avoid; it's a pressure valve that creates urgency

## System Components

### 1. Synergy Engine (`synergy-engine.js`)

Handles synergy detection and bonus calculation.

**Key Functions:**
- `SynergyEngine.init()` - Initialize for new combat
- `SynergyEngine.registerCardPlay(card)` - Register card and detect synergies
- `SynergyEngine.checkPotentialSynergies(card, cardsInPlay)` - Preview synergies for UI

### 2. Synergy Integration (`synergy-integration.js`)

Bridges synergy system with STR combat.

**Key Functions:**
- `SynergyIntegration.startCombat()` - Start combat tracking
- `SynergyIntegration.processCardPlay(card, context)` - Process card with synergy bonuses
- `SynergyIntegration.applyResourceEffects(card, result, gameState)` - Apply resource changes

### 3. Synergy UI (`synergy-ui.js`)

Visual feedback for active synergies.

**Key Functions:**
- `SynergyUI.displaySynergies(synergies)` - Show active synergies
- `SynergyUI.showNotification(synergyName)` - Flash notification
- `SynergyUI.highlightCard(cardElement, glowColor)` - Highlight synergy cards

## Synergy Types

### 1. Energy Dump Synergy
**Pattern:** Generate energy → Spend on powerful attack
**Example:**
```javascript
// Play Overcharge (+3 energy)
// Then play Thunder Strike (12 AOE damage)
// Result: +50% damage, refund 1 energy
```

### 2. Battery Overload Synergy
**Pattern:** Build battery → Unleash tech devastation
**Example:**
```javascript
// Play card with battery_gen tag
// Then play EMP Blast (tech attack)
// Result: Double damage + disrupt all enemies
```

### 3. Explosive Ignition Synergy
**Pattern:** Apply fire DoT → Explosive detonation
**Example:**
```javascript
// Play Inferno Round (burning)
// Then play Cluster Bomb (explosive)
// Result: +8 damage bonus, expanded AOE
```

### 4. Precision Execution Synergy
**Pattern:** Aim setup → High damage precision strike
**Example:**
```javascript
// Play Perfect Aim (+30% accuracy, +25% crit)
// Then play any ranged attack
// Result: Guaranteed crit with +80% damage
```

### 5. Aggressive Momentum Synergy
**Pattern:** Chain aggressive actions for escalating power
**Example:**
```javascript
// Play Burst Shot (aggressive)
// Then Execute (aggressive)
// Result: +2 damage per stack (max +10), +1 speed
```

### 6. Combo Devastation Synergy
**Pattern:** Starter → Finisher for massive burst
**Example:**
```javascript
// Play Chain Lightning (combo_starter)
// Then play Annihilation (combo_finisher)
// Result: 2.5x damage, refund 2 energy, draw card
```

### 7. Fatigue Mastery Synergy
**Pattern:** Reduce fatigue → Enable powerful repeated plays
**Example:**
```javascript
// Play Tactical Refresh (-30 fatigue, +2 energy)
// Then play sustained attack
// Result: -1 energy cost, ignore fatigue penalties
```

### 8. Ammo Efficiency Synergy
**Pattern:** Ammo generation → Sustained fire
**Example:**
```javascript
// Play Quick Reload (+5 ammo, +1 energy)
// Then play Suppressive Fire (sustained)
// Result: 50% chance to refund ammo, +3 damage
```

## Game-Breaking Cards

### Energy Generators (Enablers)

#### Overcharge (⚡)
- **Cost:** 1 energy
- **Effect:** Gain 3 energy immediately, gain 1 battery charge
- **Tags:** energy_gen, battery_gen, combo_starter
- **Combo Potential:** 5/5

#### Adrenaline Surge (💪)
- **Cost:** 0 energy (exhaust)
- **Effect:** Gain 5 energy, +2 speed
- **Tags:** energy_gen, aggressive, combo_starter
- **Combo Potential:** 5/5

### Massive Damage Payoffs

#### Thunder Strike (⚡)
- **Cost:** 4 energy, 2 ammo
- **Effect:** Deal 12 AOE damage (range 3)
- **Tags:** burst, aoe, tech, aggressive, combo_finisher
- **Synergy Bonus:** +50% damage with energy generation = 18 damage AOE
- **Combo Potential:** 5/5

#### Annihilation (💥)
- **Cost:** 5 energy, 3 ammo, 10 fatigue (exhaust)
- **Effect:** Deal 20 single-target damage
- **Tags:** burst, ranged, aggressive, combo_finisher
- **Synergy Bonus:** 2.5x damage with combo starter = 50 damage
- **Combo Potential:** 5/5 (Boss Killer)

### Battery Tech Devastation

#### EMP Blast (💻)
- **Cost:** 3 energy, 3 battery
- **Effect:** Deal 10 AOE damage (range 4), disrupt 3
- **Tags:** tech, aoe, burst, combo_finisher
- **Synergy Bonus:** 2x damage with battery gen = 20 damage AOE
- **Combo Potential:** 5/5

#### System Crash (🔥)
- **Cost:** 3 energy, 2 battery
- **Effect:** Deal 8 damage + 4 DoT for 3 turns
- **Tags:** tech, fire, sustained
- **Total Damage:** 20 over 3 turns
- **Combo Potential:** 4/5

### Chain Attack Starters

#### Chain Lightning (⚡)
- **Cost:** 3 energy, 2 battery
- **Effect:** Deal 6 damage, chains to 3 enemies
- **Tags:** tech, chain, ranged, combo_starter
- **Total Damage:** 24 (6 × 4 enemies)
- **Combo Potential:** 4/5

#### Incendiary Grenade (🔥)
- **Cost:** 3 energy, 2 ammo
- **Effect:** Create burning zone (5 DoT for 4 turns, AOE 2)
- **Tags:** fire, explosive, aoe, sustained, combo_starter
- **Total Damage:** 20 per enemy over 4 turns
- **Combo Potential:** 5/5

## Boss Integration

### Boss Loot with Synergy Cards

Bosses now drop synergy-tagged cards:
- **Standard Kill:** 50% chance for Superior quality synergy card
- **Mythic Kill:** Guaranteed Masterwork synergy card

```javascript
// Boss loot generation
if (this.mythicConditionMet) {
  loot.push({
    type: 'synergy_card',
    quality: 'MASTERWORK',
    guaranteed: true,
    message: '⚡⚡ LEGENDARY SYNERGY CARD! ⚡⚡'
  });
}
```

### Rolling Synergy Cards

```javascript
// Get all synergy cards from pool
var synergyCards = BossEncounters.getSynergyCardPool();

// Roll a specific quality synergy card
var legendaryCard = BossEncounters.rollSynergyCard('MASTERWORK');
```

## Integration with STR Combat

### Combat Flow

1. **Combat Start:**
```javascript
SynergyIntegration.startCombat();
SynergyUI.show();
```

2. **Card Play:**
```javascript
var result = SynergyIntegration.processCardPlay(card, {
  player: playerState,
  enemy: enemyState,
  gameState: GAMESTATE.getState()
});

// Apply effects
var damage = result.cardEffect.damage;
var energyRefund = result.cardEffect.energyRefund;

// Show synergies
if (result.synergies.length > 0) {
  SynergyUI.displaySynergies(result.synergies);
  SynergyUI.showNotification(result.synergies[0].definition.name);
}

// Apply resource changes
SynergyIntegration.applyResourceEffects(card, result, GAMESTATE.getState());
```

3. **Combat End:**
```javascript
SynergyIntegration.endCombat();
SynergyUI.clear();
```

## Testing

Run the test suite to verify synergy system:

```javascript
// Load test page
// Open /tests/test-synergy-system.js in browser

// Tests validate:
// - Module loading
// - Synergy detection
// - Bonus application
// - Combat integration
// - Resource effects
```

## Example Game-Breaking Combos

### The Nuclear Option
**Cards:** Adrenaline Surge → Thunder Strike → Annihilation
**Total Cost:** 5 energy + 5 ammo
**Effect:**
1. Adrenaline Surge: Gain 5 energy
2. Thunder Strike with energy synergy: 18 AOE damage
3. Annihilation with combo synergy: 50 single-target damage
**Result:** Wipe entire enemy group + kill boss in single turn

### The Battery Nuke
**Cards:** Overcharge → EMP Blast → System Crash
**Total Cost:** 4 energy + 5 battery
**Effect:**
1. Overcharge: +3 energy, +1 battery
2. EMP Blast with battery synergy: 20 AOE damage + disable
3. System Crash: 20 DoT damage
**Result:** 40 damage AOE + lingering burn

### The Eternal Onslaught
**Cards:** Tactical Refresh → Execute × 3
**Total Cost:** 5 energy + 3 ammo
**Effect:**
1. Tactical Refresh: -30 fatigue, +2 energy
2. Execute with fatigue mastery: 10 damage, no fatigue
3. Repeat Execute: 10 damage each
**Result:** 30+ damage with no fatigue penalties

## Balance Notes

### Power Level Targets
- **Single Card Max Damage:** 20 (Annihilation)
- **Synergy Combo Max Damage:** 50 (Annihilation with 2.5x multiplier)
- **AOE Max Damage:** 20 (EMP Blast with 2x battery synergy)
- **Boss Kill Threshold:** 60-90 HP

### Resource Economics
- **Energy Generation:** 1-5 per card
- **Battery Generation:** 1-2 per card
- **Ammo Restoration:** 5-15 per card
- **Fatigue Reduction:** 15-50 per card

### Synergy Multipliers
- **Damage Multipliers:** 1.5x - 2.5x
- **Flat Damage Bonuses:** +2 - +10
- **Energy Refunds:** 1-2
- **Card Draw:** 0-1

## Future Enhancements

### Planned Features
1. **Visual combo chains** - Draw links between synergy cards
2. **Combo counter** - Track consecutive synergies
3. **Synergy achievements** - Reward discovering all synergy types
4. **Card synergy hints** - Tooltip shows potential combos
5. **Synergy deck archetypes** - Pre-built synergy-focused decks

### Balance Tuning
- Monitor combo win rates in playtesting
- Adjust multipliers if too powerful
- Add anti-synergy mechanics for balance
- Create boss immunities to specific synergy types

## Technical Notes

### Performance
- Synergy detection runs in O(n) time
- Maximum cards tracked per turn: 10
- UI updates throttled to 60fps

### Compatibility
- Works with existing card system
- Compatible with all STR combat mechanics
- Does not break existing card functionality

### Memory
- Synergy state resets between combats
- No persistent synergy tracking across runs
- Minimal memory footprint (<1MB)

## Conclusion

The Card Synergy System adds strategic depth to Gone Rogue without overwhelming players. Energy generation enables explosive combos, battery tech creates devastating bursts, and precision setups guarantee critical hits. Players who master synergies will shred bosses and dominate runs, while casual players can ignore synergies and play normally.

**Result:** Game-breaking combos for skilled players, accessible gameplay for everyone.
