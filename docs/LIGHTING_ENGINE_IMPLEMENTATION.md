# Lighting Engine Implementation Guide

## Overview

This document describes the comprehensive lighting manipulation system implemented for Eyes Only / Gone Rogue. The system leverages environmental lighting as a strategic resource, creating synergistic card combos that interact with light sources, ground effects, and enemy AI behavior.

## System Architecture

### Core Concepts

1. **Light sources as environmental state** - Arena tracks active light sources as a queryable variable
2. **Ground effects** - Environmental hazards that modify combat behavior based on lighting conditions
3. **Order-of-play conditions** - Card sequences that unlock powerful synergies
4. **Resource inversion** - Free plays when sequenced correctly
5. **STR combat timing windows** - Light manipulation affects combat phases

### Environmental Variables

The arena tracks these state variables:

```javascript
arena.lightSources = integer  // Count of active light sources
arena.groundState = [Normal, Darkened, Conductive, Radiant, Obscured, Sonic, Resonance]
arena.lumenLevel = 0-10       // Stored light resource
```

## Implementation Components

### 1. Ground Effects (7 new effects)

#### EFF-002: Darkened Ground 🌑
- **Duration**: 15 seconds, radius 2
- **Effects**:
  - Light level reduced to 0
  - Stealth bonus: +25%
  - Shadow-type cards gain +1 effect
  - Solar-type cards disabled
  - Certain enemies panic

**Strategic Use**: Created by light destruction, enables shadow builds

#### EFF-003: Conductive Field ⚡
- **Duration**: 12 seconds, radius 3
- **Effects**:
  - All electricity effects doubled (2.0x multiplier)
  - Metal-tag enemies take +50% damage
  - Player also vulnerable (1 shock damage/turn)
  - Light sources become unstable

**Strategic Use**: Amplifies electrical cards when Battery Spill is played

#### EFF-004: Radiant Ground 🌞
- **Duration**: 10 seconds, radius 2
- **Effects**:
  - Maximum light level (10)
  - Damages shadow-aligned enemies (2 HP/turn)
  - Removes stealth from all units
  - +10% accuracy bonus

**Strategic Use**: Payoff for Lumen-based combos, counters stealth enemies

#### EFF-005: Obscured Ground 💨
- **Duration**: 8 seconds, radius 3
- **Effects**:
  - Heavy accuracy penalty (-15%)
  - Visibility reduced by 50%
  - +15% stealth bonus
  - Dissipates over time

**Strategic Use**: Sets up Tactical Spotlight positional play

#### EFF-006: Sonic Ground Effect 🔊
- **Duration**: 8 seconds, radius 2
- **Effects**:
  - Amplifies sonic effects (1.5x multiplier)
  - Minor accuracy penalty (-3%)
  - Applies "Ringing" status (2 turns)
  - Burns battery per active light source

**Strategic Use**: Created by Ultrasonic Weapon

#### EFF-007: Resonance 🎤
- **Duration**: 6 seconds, radius 1
- **Effects**:
  - Next Sonic card costs 0 battery
  - Doubles light-based interactions (2.0x)
  - Enables free Ultrasonic Weapon cast

**Strategic Use**: Core enabler for Ultrasonic Feedback Chain

### 2. Player Cards (9 new cards)

#### 🌕 Ultrasonic Feedback Chain

**ACT-100: Ultrasonic Weapon** 🔊
- **Cost**: 2 Battery
- **Target**: Area
- **Effects**:
  - Shatters ALL lightbulbs in arena
  - Burns 1 Battery per active light source
  - Applies Ringing (minor disorient) to all units
  - Removes enemy stealth
  - Creates Sonic Ground Effect (EFF-006)
- **Synergy Tags**: sonic, tech, light_manipulation, aoe
- **Rarity**: Rare

**ACT-101: Feedback Microphone** 🎤
- **Cost**: 1 Battery
- **Target**: Self
- **Effects**:
  - Next Sonic card costs 0
  - Doubles light-based interactions this round
  - Creates Resonance ground effect (EFF-007)
- **Synergy Tags**: sonic, tech, combo_starter, resonance
- **Rarity**: Uncommon

**Synergy (SYN-100)**: When Feedback Microphone → Ultrasonic Weapon:
- Ultrasonic Weapon becomes FREE
- All light sources explode (3 damage to enemies)
- Each destroyed light applies Burn (2 damage)
- Removes enemy stealth
- Creates Darkened Ground per destroyed light

#### 💡 Battery Overload Engine

**ACT-102: Battery Spill** 🔋
- **Cost**: 1 Energy
- **Target**: Ground
- **Effects**:
  - Creates Conductive Field (EFF-003)
  - All light sources become unstable
  - +50% electrical vulnerability
- **Synergy Tags**: electrical, tech, combo_starter, hazard
- **Rarity**: Common

**ACT-103: Overload Grid** ⚡
- **Cost**: 3 Energy
- **Target**: Area
- **Effects**:
  - Chain lightning arcs per light source (2 damage each)
  - Applies Shock status (1 turn)
  - Consumes all light sources
  - If 4+ lights: creates Blinding Flash (enemy accuracy -50%)
- **Synergy Tags**: electrical, tech, combo_finisher, aoe
- **Rarity**: Rare

**Synergy (SYN-101)**: When Battery Spill → Overload Grid:
- If Conductive Ground exists: spreads across ENTIRE arena
- Light count multiplies arc damage
- 4+ lights creates Blinding Flash (2 turns)

#### 🔦 Light Harvest Engine

**ACT-104: Prism Mine** 🔆
- **Cost**: 2 Energy
- **Target**: Ground
- **Effects**:
  - Plants reflective nodes on floor
  - Converts light sources into Stored Lumens (1:1 ratio)
  - Broken bulbs on Darkened Ground count as +1 Lumen
- **Synergy Tags**: light_manipulation, setup, solar, tech
- **Rarity**: Uncommon

**ACT-105: Solar Flare Step** 🌞
- **Cost**: 1 Energy
- **Target**: Ground
- **Effects**:
  - Consumes all Stored Lumens
  - Creates Radiant Ground (EFF-004)
  - Damages shadow-aligned enemies (2 damage per Lumen)
- **Synergy Tags**: solar, light_manipulation, combo_finisher
- **Rarity**: Uncommon

**Synergy (SYN-102)**: When Prism Mine → Solar Flare Step:
- If Ultrasonic Weapon shattered bulbs earlier (creating Darkened Ground)
- Each broken bulb counts as +1 Stored Lumen
- Delayed combo payoff mechanic

#### 🌫 Smoke & Spotlight Engine

**ACT-106: Smoke Bomb** 💨
- **Cost**: 1 Energy
- **Target**: Ground
- **Effects**:
  - Creates Obscured Ground (EFF-005)
  - Heavy accuracy penalty (-15%) for all units
  - +15% stealth bonus
- **Synergy Tags**: smoke, stealth, combo_starter, covert
- **Rarity**: Common

**ACT-107: Tactical Spotlight** 🔦
- **Cost**: 2 Energy
- **Target**: Ground
- **Effects**:
  - Redirects all light to 1 tile
  - Concentrates brightness (3.0x multiplier)
  - Non-spotlight tiles become Shadowed (enemy miss chance)
  - Spotlight tile becomes Overexposed (+50% crit damage to enemies)
- **Synergy Tags**: light_manipulation, tactical, combo_finisher
- **Rarity**: Uncommon

**Synergy (SYN-103)**: When Smoke Bomb → Tactical Spotlight:
- All non-spotlight tiles become Shadowed (30% enemy miss chance)
- Spotlight tile becomes Overexposed (enemies take +50% crit damage)
- Creates positional light economy

#### 🔁 Feedback Loop Engine

**ACT-108: Loop Recorder** 📼
- **Cost**: 1 Energy
- **Target**: Self
- **Effects**:
  - Stores last played tag
  - Echoes tag for 2 turns
  - If Sonic tag played twice in sequence: next Sonic card is free
- **Synergy Tags**: sonic, tech, combo_starter, chain
- **Rarity**: Rare

**Synergy (SYN-104)**: When Loop Recorder echoes Sonic tag:
- If Sonic tag played twice in sequence
- Next Sonic card is FREE
- Applies Overdrive (Sonic Ground duration +1)
- Can chain up to 3 times

### 3. Enemy AI Behavior

Five new enemy variants with distinct lighting behavior:

#### SURVEILLANCE_NODE (Non-Reactive)
- **Type**: Cameras, drones, automated turrets
- **Behavior**:
  - Ignores emotional triggers
  - Does NOT reposition when lights break
  - Switches to Infrared Mode if lightSources == 0
  - +15% accuracy in darkness
- **Exposed Tags**: hack, disable
- **Design Note**: Destroying lights weakens humans but buffs surveillance

#### ADAPTIVE_DRONE (Optimization AI)
- **Type**: Patrol AI
- **Behavior**:
  - Recalculates pathing if darkness spreads
  - Moves toward brightest tile to maintain scanning grid
  - Does not panic - optimizes
  - +20% move speed, +30% sight range
- **Exposed Tags**: hack, emp

#### FLASHLIGHT_GUARD (Photophilic)
- **Type**: Security guards with survival instincts
- **Behavior**:
  - If light breaks: moves toward remaining lit tiles
  - Clusters with other guards
  - In Light: +10% accuracy, reduced fear
  - In Darkness: -20% accuracy, may skip aggressive action
- **Exposed Tags**: intimidate
- **Adds Card**: EATK-010 (Spotlight)
- **Design Note**: Breaking lights forces clustering → creates AoE opportunities

#### INVESTIGATIVE_TECHNICIAN (Curious)
- **Type**: Techs, detectives, cultists, scientists
- **Behavior**:
  - Moves TOWARD tile where light was destroyed
  - If multiple lights break: moves to most recent
  - Gains Alert status when lights break
  - +20% damage when investigating
- **Exposed Tags**: hack
- **Adds Cards**: EATK-010 (Spotlight), EATK-017 (Paint Target)

#### PARANOID_CULTIST (Hybrid)
- **Type**: Cultist with nonlinear reactions
- **Behavior**:
  - Fears darkness BUT worships flickering lights
  - If light flickers: gains Zeal (+30% combat effectiveness)
  - If total darkness: enters Panic (-40% effectiveness)
  - Creates nonlinear reactions to controlled vs chaotic lighting
- **Adds Cards**: EATK-006 (Chemical Splash), EATK-007 (Taze)

### Reaction Table Comparison

| Event | Surveillance | Concerned Human | Curious Human |
|-------|-------------|----------------|---------------|
| Light breaks | No movement | Retreat to light | Advance to darkness |
| Darkness spreads | Switch to infrared | Defensive stance | Investigative patrol |
| Flash event | No reaction | Shield eyes | Study effect |
| No light sources | +Accuracy buff | Hide/call backup | Patrol anomaly zone |

## Advanced Combo Examples

### 1. Full Light Destruction Chain
```
Turn 1: Feedback Microphone (1 battery)
Turn 2: Ultrasonic Weapon (FREE via synergy)
        → Destroys all 6 lights
        → 6 light explosions (3 dmg each = 18 total)
        → Burns applied to all enemies (2 dmg/turn)
        → Creates 6 Darkened Ground tiles
        → Stealth +25% for player
```

### 2. Battery Overload Cascade
```
Turn 1: Battery Spill (1 energy)
        → Creates Conductive Field (radius 3)
Turn 2: Overload Grid (3 energy)
        → If 5 lights active:
          - 5 chain lightning arcs (2 dmg each = 10 total)
          - Shock status on all enemies
          - Blinding Flash (-50% enemy accuracy for 2 turns)
          - Consumes all lights
```

### 3. Light Harvest Delayed Payoff
```
Turn 1: Feedback Microphone + Ultrasonic Weapon
        → Destroys 8 lights, creates 8 Darkened Ground tiles
Turn 2-4: Wait (other actions)
Turn 5: Prism Mine (2 energy)
        → Harvests 8 broken bulbs on Darkened Ground
        → Stores 8+8 = 16 Lumens
Turn 6: Solar Flare Step (1 energy)
        → Consumes 16 Lumens
        → 32 damage to shadow enemies
        → Creates Radiant Ground
```

### 4. Positional Light Control
```
Turn 1: Smoke Bomb (1 energy)
        → Heavy obscure (-15% accuracy all)
Turn 2: Tactical Spotlight (2 energy)
        → Redirects all light to enemy cluster position
        → Enemy cluster: Overexposed (+50% crit)
        → Other enemies: Shadowed (30% miss chance)
        → Creates tactical killzone
```

## Integration Points

### In Synergy Engine (synergy-engine.js)
- Add "sonic", "light_manipulation", "solar" to synergy tags
- Implement cost_reduction_next detection
- Track arena.lightSources count
- Track arena.lumenLevel resource

### In Ground Effects (ground-effects.js)
- ✅ Added GROUND_TYPES: DARKENED, CONDUCTIVE, RADIANT, OBSCURED, SONIC, RESONANCE
- ✅ Added GROUND_EFFECTS definitions with all properties
- Implement light source destruction mechanics
- Implement light level queries

### In Enemy Intent System (enemy-intent-system.js)
- Add lightBehavior property to enemy definitions
- Implement light break event handlers
- Add movement AI for:
  - moveToBrightestTile (Adaptive Drone)
  - moveToAnomalyLocation (Investigative Technician)
  - clusterInLight (Flashlight Guard)

### In Gone Rogue Effect Interpreter (gone-rogue-effect-interpreter.js)
Add effect type handlers:
- `shatter_lights` - Destroy light sources
- `battery_burn_per_light` - Cost scaling
- `light_instability` - Mark lights as unstable
- `chain_lightning_per_light` - Damage scaling
- `consume_lights` - Remove light sources
- `plant_prism_node` - Create light converter
- `convert_lights_to_lumens` - Resource conversion
- `consume_lumens` - Resource expenditure
- `redirect_light` - Positional manipulation
- `store_last_tag` - Tag tracking

## Testing Scenarios

### 1. Light Destruction
```
Arena: 8 light sources active
Player casts: Feedback Microphone → Ultrasonic Weapon
Expected:
  - All 8 lights destroyed
  - 8 explosions deal 24 damage total
  - 8 Darkened Ground tiles created
  - Flashlight Guard moves to edge (no lights remain)
  - Surveillance Node switches to infrared (+15% accuracy)
  - Investigative Technician moves to last destroyed light
```

### 2. Electrical Amplification
```
Arena: 5 light sources, Conductive Field active
Player casts: Overload Grid
Expected:
  - 5 chain lightning arcs (10 damage total)
  - Amplified by Conductive Field (20 damage total)
  - Blinding Flash triggered (5 >= 4 lights)
  - All enemies: -50% accuracy for 2 turns
  - All lights consumed
```

### 3. Enemy Behavior Differentiation
```
Arena: 3 light sources, player destroys 1 light
Expected Reactions:
  - Surveillance Node: No movement
  - Flashlight Guard: Moves toward nearest remaining light
  - Investigative Technician: Moves toward destroyed light location
  - Paranoid Cultist: If flicker → Zeal; if all dark → Panic
```

## Design Philosophy

### Resource Axis
Lighting is now a strategic resource layer:
- Can be harvested (Prism Mine)
- Can be destroyed (Ultrasonic Weapon)
- Can be redirected (Tactical Spotlight)
- Can be amplified (Conductive Field)

### Order Awareness
Card sequencing matters:
- Feedback Microphone → Ultrasonic Weapon (free cast)
- Battery Spill → Overload Grid (arena-wide spread)
- Prism Mine → Solar Flare Step (delayed payoff)

### Faction Asymmetry
Different enemies react differently to light manipulation:
- Machines: Ignore emotions, may buff in darkness
- Guards: Cluster in light, vulnerable when grouped
- Investigators: Move toward anomalies, become aggressive
- Cultists: Nonlinear reactions to flicker vs darkness

### Positional Economy
Light creates tactical geography:
- Darkened zones: Stealth advantage
- Radiant zones: Shadow enemy disadvantage
- Spotlight: Concentrated damage
- Obscured: Accuracy penalty

## Future Enhancements

### Potential Additions
1. **Light Memory System**: Enemies remember last light positions
2. **Flicker Mechanics**: Different reactions to unstable vs stable lights
3. **Light Color**: Different colored lights affect different enemy types
4. **Light Temperature**: Hot lights (fire) vs cold lights (LED)
5. **Mirror Cards**: Reflect light for puzzle-like positioning

### Balancing Considerations
- Ultrasonic Weapon battery cost scales with light count
- Synergies have cooldowns or max uses per combat
- Enemy AI adapts after multiple light destructions
- Certain bosses immune to light manipulation

## Summary

This implementation adds a complete lighting manipulation system with:
- **7 new ground effects** with light-based interactions
- **9 new player cards** across 5 synergy engines
- **5 new synergies** for card combos
- **5 enemy AI variants** with distinct lighting behavior
- **Environmental variables** for systemic interactions

The system transforms lighting from cosmetic to strategic, creating depth through:
- Order-of-play rewards
- Resource inversion mechanics
- Faction-specific AI responses
- Positional light economy

All data is implemented in JSON (cards, ground effects, synergies, enemy variants) and ready for integration with the game engine.
