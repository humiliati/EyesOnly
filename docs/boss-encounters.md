# Boss Encounter System - Documentation

## Overview

The Boss Encounter System adds arcade-style boss fights to the Gone Rogue minigame with unique mechanics, mythic victory conditions, and legendary loot drops. Boss encounters appear on specific floors (10, 16, 22, 30) and feature a "Readable → Learnable → Exploitable" gameplay loop.

## Core Concepts

### Boss Philosophy
Each boss is designed as an "arcade game within a roguelike":
- **Readable**: Boss telegraphs attacks and patterns clearly
- **Learnable**: Players learn the "dance" through repetition
- **Exploitable**: Hidden mechanics reward creative deck building and execution

### Mythic Victory Conditions
Each boss has a secret mythic condition that, when met during the killing blow, guarantees a legendary drop. Meeting the condition triggers:
- ⚡ "A strange energy shifts..." subtle feedback during combat
- ⚡⚡⚡ MYTHIC CONDITION MET! on boss defeat
- 💎 Guaranteed mythic loot (typically Inventory Charm for persistent slot unlock)
- 25-50 cryptos bonus reward

If the mythic condition is NOT met, there's a 10% chance for a rumor hint to appear, guiding players toward the hidden condition.

## The Ten Boss Types

### 1. Depot Crossing Boss (Depot Warden)
**Theme**: Frogger-style train hazard avoidance
**HP**: 60
**Floor**: Random boss floor

**Mechanics**:
- Boss positioned across train tracks
- 3 lanes of trains/drones moving at different speeds
- Safe zones between lanes (tiles 3, 7, 12)
- Boss fires sniper shots from distance

**Mythic Condition**: `TRAIN_IMPACT_KILL`
- Lure the boss into an active train lane
- Kill boss with a LURE card when boss is hit by train
- Requires timing and positioning

**Exploit**:
- Use **Lure** card when boss is in train path
- Deals 50 damage when executed correctly
- Visual: "🚂 BOSS HIT BY TRAIN!"

**Mythic Hint**: "RUMOR: If only the Warden had met a harsher fate..."

**Loot**:
- Whisper Item: "Conductor's Whistle"
- Mythic Drop: "Railyard Overpass Blueprint"

---

### 2. Sentry Nest Boss (Swarm Tower)
**Theme**: Swarm management with spawn pod destruction
**HP**: 80
**Floor**: Random boss floor (typically late game)

**Mechanics**:
- Central boss tower spawns weak swarm minions
- 3 spawn pods around arena (5 HP each)
- Swarm minions force STR combat on collision
- Max 50 swarm minions active

**Mythic Condition**: `NO_STR_ENTERED`
- Complete boss fight without entering STR combat mode
- Requires destroying spawn pods before swarm overwhelms
- Track via `player.combatEntries` counter

**Exploit**:
- Use **Grenade** or **Explosive Shot** to destroy spawn pods
- Destroying pods weakens boss shield
- Prevent swarm minions from touching player

**Mythic Hint**: "RUMOR: The swarm never touched a single ghost..."

**Loot**:
- Whisper Item: "Hive Node Fragment"
- Mythic Drop: "Perfect Stealth Theorem"

---

### 3. Bunker Commandant Boss
**Theme**: Whack-a-mole with destructible cover
**HP**: 70
**Floor**: Random boss floor

**Mechanics**:
- Boss pops up in random bunker (3x3 grid of 9 bunkers)
- Each bunker has 3 HP
- Boss only vulnerable when popped up
- Boss fires when visible, hides when attacked

**Mythic Condition**: `MELEE_KILL_NO_BUNKERS`
- Destroy all 9 bunkers with explosives
- Kill boss with **Melee Strike** card
- Requires specific deck composition

**Exploit**:
- Use **Grenade** or **Explosive Shot** to destroy bunkers
- Once all bunkers destroyed, boss has nowhere to hide
- Finish with melee for mythic condition

**Mythic Hint**: "RUMOR: Strip away all cover, then strike close..."

**Loot**:
- Whisper Item: "Fortified Helmet"
- Mythic Drop: "Demolition Expert License"

---

### 4. Mainframe Core Boss
**Theme**: Logic puzzle with node manipulation
**HP**: 50
**Floor**: Random boss floor

**Mechanics**:
- Central AI core surrounded by 8 firewall nodes
- Nodes rotate RED (active) and BLUE (safe) in patterns
- Core is invulnerable while any RED node exists
- Attacking RED nodes causes feedback damage

**Mythic Condition**: `VIRUS_KILL_ALL_BLUE`
- Synchronize all 8 nodes to BLUE state
- Kill boss with **Virus** card
- Requires timing or node manipulation

**Exploit**:
- Use **Jammer** or **Logic Hack** to flip individual nodes
- Use **Burst** cards to affect multiple nodes
- Time attacks when pattern aligns all BLUE

**Mythic Hint**: "RUMOR: Synchronize the grid perfectly, then deliver the payload..."

**Loot**:
- Whisper Item: "Quantum Decryption Key"
- Mythic Drop: "Zero-Day Exploit Archive"

---

### 5. Orbital Carrier Boss
**Theme**: Galaga-style vertical shooter
**HP**: 90
**Floor**: Random boss floor

**Mechanics**:
- Carrier at top of screen with drone shield
- 6-12 drones weaving in formation
- Carrier fires railgun every 3 turns (bottom row AOE)
- Drones respawn when destroyed

**Mythic Condition**: `CARRIER_KILL_DRONES_ALIVE`
- Kill carrier while 4+ drones still alive
- Requires piercing through shield
- Risk vs reward: clearing drones is safer but loses mythic

**Exploit**:
- Use **Jammer** to freeze drone patterns
- Use **High Ground** to pierce through drones and hit carrier directly
- Direct hits bypass drone shield

**Mythic Hint**: "RUMOR: The boldest strike through the swarm itself..."

**Loot**:
- Whisper Item: "Fighter Wing Insignia"
- Mythic Drop: "Orbital Strike Coordinates"

---

### 6. Asteroids Boss — Gravity Anchor
**Theme**: Movement-locked asteroid dodging with card-based offense
**HP**: 75
**Floor**: Random boss floor

**Core Mechanic**: The boss engages a gravity anchor that **locks player movement** for the duration of the fight.  Cards are the only offensive and defensive tool.  Waves of asteroid projectiles are injected into the existing game projectile pipeline each turn via `updateRealTime`; normal collision detection handles player hits.

**Wave Escalation**: Each wave spawns more asteroids (3 + wave number, capped at 8).  Clearing three consecutive waves without taking damage exposes the boss.

**Exploit**:
- **Fragment Shower** card clears all asteroids within a 4-tile radius

**Mythic Condition**: `THREE_WAVES_NO_DAMAGE`
- Clear three consecutive waves without the player taking any asteroid damage

**Mythic Hint**: "RUMOR: Survive the field untouched three times and the void answers..."

**Loot**:
- Whisper Item: "Debris Fragment"
- Mythic Drop: "Void Trajectory Chart"

---

### 7. Tower Offense Boss — Fortress Core
**Theme**: Inverted tower defense — player assaults a static saturating boss
**HP**: 85
**Floor**: Random boss floor

**Core Mechanic**: The boss fires escalating volleys of projectiles on a 3-turn timer.  Volley size **decreases** as the boss takes damage — aggressive offence is the optimal strategy.

**Volley Scaling**:
| Boss HP | Volley Size |
|---------|-------------|
| > 66%   | 2 projectiles |
| 34–66%  | 4 projectiles |
| ≤ 33%   | 6 projectiles (phase 3) |

**Exploit**:
- **Suppression Fire** card suppresses the boss's next volley for 2 full turns
- **High Ground** / **Grenade** cards deal bonus damage to the static target

**Mythic Condition**: `KILL_BEFORE_PHASE3`
- Defeat the boss before it ever reaches phase 3 (≤33% HP)

**Mythic Hint**: "RUMOR: Strike before the third volley and the fortress crumbles fully..."

**Loot**:
- Whisper Item: "Defensive Matrix Shard"
- Mythic Drop: "Siege Breaker Doctrine"

---

### 8. Sniper Boss — Ghost Sniper
**Theme**: Metal Gear Solid's The End — patience and observation as weapons
**HP**: 65
**Floor**: Random boss floor

**Core Mechanic**: The boss starts with **80% evasion** — attacks almost always miss.  Each use of the **Camera** card photographs the boss and applies a permanent −5% accuracy penalty (up to 10 stacks, −50% total).  Patient players who max out the penalty before striking have the highest DPS.

**Evasion Table**:
| Photos | Boss Evasion |
|--------|-------------|
| 0      | 80%         |
| 5      | 55%         |
| 10     | 30%         |

**Exploit**:
- **Camera** card — stack all 10 photographs before the killing blow

**Mythic Condition**: `MAX_PENALTY_KILL`
- Deal the killing blow with 10 photographs taken (maximum penalty active)

**Mythic Hint**: "RUMOR: Those who wait long enough find the ghost cannot hide..."

**Loot**:
- Whisper Item: "Ghillie Fragment"
- Mythic Drop: "Spectral Crosshairs"

---

## Boss-Specific Action Cards

Ten cards enable boss mechanic interactions (seven original + three new):

### 1. Lure (🥩)
**Category**: Setup
**Energy**: 2
**Stats**: Range 3, Duration 2

**Usage**:
- Draws enemy attention to specific position
- **Depot Boss**: Lure boss onto train tracks
- **Dog enemies**: Vulnerable to lure (general use)

---

### 2. Grenade (💣)
**Category**: Attack
**Energy**: 3
**Stats**: 6 damage, AOE radius 2, Noise 5

**Usage**:
- Area of effect explosive damage
- Destroys environmental objects (bunkers, spawn pods)
- **Bunker Boss**: Destroy bunker covers
- **Sentry Boss**: Destroy spawn pods

---

### 3. Jammer (📡)
**Category**: Interrupt
**Energy**: 3
**Stats**: Disrupt 2, Range 5, Duration 3

**Usage**:
- Disrupts electronic systems
- **Orbital Boss**: Freezes drone movement patterns
- **Mainframe Boss**: Can affect node states
- General use: Jams enemy weapons for 1 turn

---

### 4. Virus (🦠)
**Category**: Attack
**Energy**: 3
**Stats**: 2 initial damage, 3 DOT per turn, Duration 3

**Usage**:
- Damage over time against machines
- **Mainframe Boss**: Required for mythic kill
- Affects all machine-type enemies

---

### 5. High Ground (🎯)
**Category**: Attack
**Energy**: 3
**Stats**: 4 damage, Piercing, 90% accuracy, Range 8

**Usage**:
- Pierces through cover and shields
- **Orbital Boss**: Bypasses drone shield to hit carrier
- Ignores defensive positioning

---

### 6. Melee Strike (⚔️)
**Category**: Attack
**Energy**: 2
**Stats**: 5 damage, 85% accuracy, Range 1

**Usage**:
- Close-range high-damage attack
- **Bunker Boss**: Required for mythic kill (after bunkers destroyed)
- Must be adjacent to target

---

### 7. Logic Hack (💻)
**Category**: Interrupt
**Energy**: 2
**Stats**: Manipulation 1, Range 3

**Usage**:
- Manipulates digital systems
- **Mainframe Boss**: Flips node states (RED↔BLUE)
- Affects system-based enemies

---

### 8. Camera (📷)
**Category**: Setup
**Energy**: 1
**Stats**: Range 10, Duration 1

**Usage**:
- Photographs the **Sniper Boss** to reduce its evasion by 5% per use (max 10×, −50% total)
- Stack all 10 photos before delivering the killing blow for the mythic condition
- Has no effect on other boss types

---

### 9. Fragment Shower (💫)
**Category**: Attack (Gated — costs 1 ammo)
**Energy**: 3
**Stats**: 3 damage, AOE 4, 80% accuracy

**Usage**:
- Clears all asteroids within a 4-tile radius around the target
- **Asteroids Boss**: Primary clearing tool while movement is locked
- Standard AOE damage against other enemies

---

### 10. Suppression Fire (🔥)
**Category**: Attack (Gated — costs 2 ammo)
**Energy**: 4
**Stats**: 2 damage, 70% accuracy

**Usage**:
- **Tower Offense Boss**: Suppresses the boss's next volley for 2 turns, giving breathing room to deal damage
- Standard damage against other enemies

---

## Boss Floor Generation

### Floor Schedule
Boss floors occur at: **10, 16, 22, 30**

- **Floor 10**: First boss (early-mid game)
- **Floor 16**: Second boss (mid game)
- **Floor 22**: Third boss (late game)
- **Floor 30**: Final boss (endgame)

Multiple runs required to encounter all 10 boss types (randomly selected).

### Arena Layout
Boss floors generate a single large arena room:
- **Size**: 30×14 (centered at x:5-35, y:3-17)
- **No stealth path validation** (combat-focused)
- **Enhanced loot**: Boss drops 25-50 cryptos + guaranteed rare card
- **Boss positioning**: Center of arena (x:20, y:10) by default

### Boss Enemy Stats
- **HP**: 50-90 (varies by boss type)
- **STR**: 8 + (floor × 0.5)
- **DEX**: 8 + (floor × 0.5)
- **Awareness**: 100 (always alert)
- **isBoss flag**: `true`

---

## Implementation Details

### File Structure
```
/public/js/boss-encounters.js  - Boss class definitions
/public/js/card-system.js      - Boss card definitions
/public/js/gone-rogue.js       - Integration & combat logic
```

### Boss State Variables
```javascript
_activeBoss         // Current boss instance
_bossFloorActive    // Boolean: is this a boss floor
_bossDefeated       // Boolean: has boss been defeated
_bossHazards        // Array of boss-specific hazards
_bossEnvironment    // Boss-specific environment data
_playerMoveLocked   // Boolean: set by Asteroids boss; disables walk commands
```

### Player Tracking
```javascript
player.combatEntries  // Total STR combat entries (for mythic)
player.lastCardType   // Last card used (for mythic)
```

### Boss Phases
```javascript
IDLE            // Waiting state
PATTERN         // Executing attack pattern
TELEGRAPH       // Telegraphing next move
PUNISHMENT      // Punishing player mistake
EXPLOIT_WINDOW  // Vulnerable state
VULNERABLE      // Exploit successfully executed
```

---

## Integration with Existing Systems

### STR Combat Integration
- Boss fights use existing STR (Simultaneous Turn Resolution) system
- Boss cards resolved during action priority queue
- Boss-specific interactions checked in `_handleBossCardInteraction()`
- Mythic tracking occurs during combat resolution

### Real-Time Hazard Integration
Bosses that need continuous hazard injection (Asteroids) implement `updateRealTime(deltaMs, gameState)`.  This method is called from the existing `_updateGameState` game loop each tick.  It returns `{ bossProjectiles }` — an array of projectile objects in the same format as player-fired projectiles.  These are merged into `_projectiles` so the existing `_updateProjectiles` pipeline handles movement and player collision without any new engine code.

### Loot System Integration
- Boss defeat triggers `_activeBoss.onDefeat(player)`
- Loot generation in `_exitStrCombat()` function
- Boss loot decay time: 60-120 seconds (vs 30s for normal loot)
- Mythic drops always include Inventory Charm

### Map Generation Integration
- Boss floors detected in `_getFloorType()`
- Boss arena created in `_generateRooms()` (single large room)
- Boss enemy placed in `_placeEnemies()` with enhanced stats
- Boss initialization in `_generateFloor()` after room creation

### Card System Integration
- Boss cards added to BASE_CARDS in card-system.js
- Card interactions handled in action resolvers:
  - `_resolveAttackAction()`
  - `_resolveSetupAction()`
  - `_resolveInterruptAction()`
- `_handleBossCardInteraction()` centralizes boss logic

---

## UI/UX Elements

### Visual Indicators
```
Floor status: Floor: 10 👹 BOSS FLOOR
Boss info:    ⚠️  Boss: DEPOT_WARDEN | Phase: PATTERN
On defeat:    ✅ BOSS DEFEATED
```

### Combat Messages
```
Standard:     🏆 BOSS DEFEATED!
Mythic:       ⚡⚡⚡ MYTHIC CONDITION MET! ⚡⚡⚡
              💎 MYTHIC DROP: [item name]
Whisper:      ✨ WHISPER ITEM: [item name]
Rumor:        📜 [hint text]
```

### Boss Interactions
```
Lure:         "├─ Using LURE on boss..."
              "🚂 BOSS HIT BY TRAIN!"
Grenade:      "💥 SPAWN POD DESTROYED! Boss shield weakened!"
Jammer:       "📡 DRONES FROZEN! Easy targets!"
Virus:        "├─ Virus will deal 3 damage for 3 turns"
```

---

## Deck Building Strategy

### Depot Boss Optimal Deck
- 3-4× **Lure** cards (for mythic condition)
- 2-3× Attack cards (damage dealer)
- 2× Movement cards (dodging trains)
- 1-2× Healing cards (sustain)

### Sentry Boss Optimal Deck
- 2-3× **Grenade** or **Explosive Shot** (destroy pods)
- 3× Stealth/Evasion cards (avoid swarm)
- 1-2× Movement cards (positioning)
- Critical: NO cards that auto-trigger combat

### Bunker Boss Optimal Deck
- 3-4× **Grenade** cards (bunker destruction)
- 1× **Melee Strike** (killing blow)
- 2-3× Attack cards (damage dealer)
- 1-2× Defense cards (survival)

### Mainframe Boss Optimal Deck
- 2× **Logic Hack** or **Jammer** (node manipulation)
- 1× **Virus** card (killing blow)
- 3× Timing/Patience cards
- 2× Burst/AOE cards (multi-node targeting)

### Orbital Boss Optimal Deck
- 2× **High Ground** (piercing shots)
- 1× **Jammer** (freeze drones)
- 3× High-damage single target cards
- 2× Dodge/Evasion cards (railgun avoidance)

### Asteroids Boss Optimal Deck
- 3–4× **Fragment Shower** (wave clearing; requires ammo)
- 2× **Overwatch** (auto-target nearest asteroid)
- Ammo-generating items (Fragment Shower is gated)
- 0× movement cards — movement is locked for the fight

### Tower Offense Boss Optimal Deck
- 2–3× **Suppression Fire** (window to deal damage safely)
- 2× **High Ground** or **Grenade** (bonus direct damage)
- 3–4× high-damage burst cards (finish before phase 3)
- 1× healing card (sustain through volleys)

### Sniper Boss Optimal Deck
- 10× **Camera** (fill the hand — need all 10 stacks)
- 2–3× high-accuracy attack cards (for the mythic kill shot)
- Patience; use Camera until fully stacked before attacking

---

## Testing Checklist

- [ ] Boss spawns correctly on floors 10, 16, 22, 30
- [ ] All 10 boss types can spawn randomly
  - [ ] DEPOT_CROSSING, SENTRY_NEST, BUNKER_COMMANDANT, MAINFRAME_CORE, ORBITAL_CARRIER
  - [ ] TREASURE_GOBLIN_KING, UBER_MEGA (secret floors)
  - [ ] ASTEROIDS, TOWER_OFFENSE, SNIPER (new boss types)
- [ ] Boss enemy has correct HP and stats
- [ ] Boss arena room generates properly
- [ ] Boss combat enters STR mode on contact
- [ ] Each boss card interaction works correctly:
  - [ ] Lure (Depot Boss)
  - [ ] Grenade (Sentry Boss, Bunker Boss)
  - [ ] Jammer (Orbital Boss, Mainframe Boss)
  - [ ] Virus (Mainframe Boss)
  - [ ] High Ground (Orbital Boss)
  - [ ] Melee Strike (Bunker Boss)
  - [ ] Logic Hack (Mainframe Boss)
  - [ ] Camera (Sniper Boss)
  - [ ] Fragment Shower (Asteroids Boss)
  - [ ] Suppression Fire (Tower Offense Boss)
- [ ] Mythic conditions track correctly:
  - [ ] Depot: Train impact kill
  - [ ] Sentry: No STR entered
  - [ ] Bunker: All bunkers destroyed + melee
  - [ ] Mainframe: All nodes blue + virus
  - [ ] Asteroids: Three waves without damage
  - [ ] Tower Offense: Kill before phase 3
  - [ ] Sniper: Max penalty kill (10 photographs)
- [ ] Boss loot generation works:
  - [ ] Guaranteed rare card drops
  - [ ] Whisper items drop (3-5% chance)
  - [ ] Mythic drops on condition met
  - [ ] Rumor hints appear (10% when mythic not met)
- [ ] Boss defeat unlocks floor exit
- [ ] Visual indicators display correctly
- [ ] Combat entries tracked for Sentry Boss mythic

---

## Future Enhancements

### Boss Variants
- Boss difficulty scaling with floor depth
- Boss mutation system (randomized modifiers)
- Boss "enrage" phases at low HP

### Meta-Progression
- Completing all boss mythic conditions unlocks special mode
- Boss journal tracking which mythic conditions achieved
- Cumulative rewards for mastering all bosses

### Additional Boss Types
- **Memory Bank Boss**: Simon Says pattern matching
- **Fabrication Plant Boss**: Assembly line hazards
- **Satellite Array Boss**: Laser grid puzzle

---

## Credits

Boss encounter design inspired by:
- **Frogger** (Depot Crossing)
- **Galaga** (Orbital Carrier)
- **Whac-A-Mole** (Bunker Commandant)
- **Minesweeper/Puzzle Games** (Mainframe Core)
- **Tower Defense** (Sentry Nest)
- **Asteroids** (Gravity Anchor)
- **Tower Defense inverted** (Fortress Core)
- **Metal Gear Solid: The End** (Ghost Sniper)

Implementation follows the arcade-within-roguelike philosophy with high-skill mythic conditions rewarding deck mastery and execution.
