# Boss Encounter Ideas — Candidate Pool
## Gone Rogue: Sandpoint, Idaho

**Purpose:** Brainstorm and evaluation doc for boss encounters beyond the 3 settled designs. Goal is a pool of 6+ boss types so each run (which draws ~3) feels different. These are candidates — not committed to implementation.

**Settled bosses** (see BOSS_DESIGN.md): Depot Crossing, Long Bridge, Schweitzer Descent
**Final boss** (floor 30): TBD convergence encounter at Farragut Naval Station

---

## Evaluation Criteria

Every candidate must pass ALL of these:
1. **Accessibility:** Works with single directional input + one action button. Sip/blow adaptive compatible at T1.
2. **Portrait mobile:** Playable in portrait orientation on phone. No landscape requirement.
3. **Narrative fit:** Maps to a real Sandpoint/CDA location or the spy narrative.
4. **Arcade nostalgia:** Evokes a recognizable classic game mechanic.
5. **Card synergy:** At least 1 existing boss card has a meaningful interaction.
6. **Mythic condition:** Has a hidden skill-based condition for legendary drops.

---

## CANDIDATE 1: Ghost Sniper (HIGH PRIORITY)

**Inspiration:** Metal Gear Solid — The End
**Sandpoint Location:** Ridgeline overlooking Lake Pend Oreille / Sandpoint City Beach
**Narrative:** Target meeting a contact at the City Beach pavilion. Player sets up on the Selkirk ridgeline. Wind off the lake, boat traffic crossing the sightline, target moving between cover.

### Core Mechanic
Boss starts at **80% evasion** — attacks almost always miss. Each **Camera** card (📷) photographs the boss, applying permanent −5% evasion (10 stacks max = −50%, bringing evasion to 30%). Patient players who max photographs before striking have highest DPS.

### Why High Priority
- **Extreme accessibility:** Camera card is single-input. At T1, Camera kills boss in 1 shot (accessibility override). No movement required.
- **Patience-based:** No twitch reflex. Observation and timing.
- **Unique feel:** Every other boss is movement-focused. This one is stillness-focused.

### Arena: Observation Post
- Regular-size map. Player is stationary or near-stationary.
- Boss moves between cover points. Guards sweep the area.
- Environmental: wind indicator, boat traffic crossing sightlines, cloud cover affecting visibility.

### Mythic: `MAX_PENALTY_KILL`
Kill with all 10 photographs taken.
- **Hint:** "RUMOR: Those who wait long enough find the ghost cannot hide..."

### Evasion Table
| Photos | Boss Evasion |
|--------|-------------|
| 0      | 80%         |
| 5      | 55%         |
| 10     | 30%         |

### Loot
- Whisper: "Ghillie Fragment"
- Mythic: "Spectral Crosshairs"

---

## CANDIDATE 2: Gravity Anchor — Asteroids (MEDIUM PRIORITY)

**Inspiration:** Asteroids (arcade)
**Sandpoint Location:** Farragut Naval Station — underwater facility beneath Lake Pend Oreille
**Narrative:** The Falcon Initiative's deep-water facility is collapsing. "Asteroids" = structural debris. "Space" = the black void of 1,100-foot-deep freshwater. Enemy vessel = Kaniksu Network submarine drone.

### Core Mechanic
Boss engages a **gravity anchor** that **locks player movement** for the entire fight. Cards are the only offensive and defensive tool. Waves of asteroid projectiles injected into existing game projectile pipeline each turn.

### Why Medium Priority
- **Accessibility:** Movement locked = no locomotion requirement. Pure card play. Excellent for adaptive controllers.
- **Risk:** Purely static player may feel frustrating rather than tense. Needs strong visual feedback.
- **Card-heavy:** Requires specific cards (Fragment Shower) to function well.

### Wave Escalation
Each wave: 3 + wave number asteroids (capped at 8). Clear 3 consecutive waves without damage → boss exposed.

### Mythic: `THREE_WAVES_NO_DAMAGE`
Clear 3 consecutive waves without taking any asteroid damage.
- **Hint:** "RUMOR: Survive the field untouched three times and the void answers..."

### Loot
- Whisper: "Debris Fragment"
- Mythic: "Void Trajectory Chart"

---

## CANDIDATE 3: Data Heist — Snake (MEDIUM PRIORITY)

**Inspiration:** Snake (Nokia / Windows)
**Sandpoint Location:** Litehouse Foods corporate network / factory industrial control system
**Narrative:** Hack into Litehouse Foods ICS to extract encrypted data. The "snake" = data extraction probe navigating network topology. Security programs = factory cyber-defense. Data reveals shipping manifests proving the dressing factory is a logistics front for Project Chimera biological material.

### Core Mechanic
Player controls a growing data probe on a network grid. Consume data packets to grow. Avoid security programs (antivirus patrols). Growing length = faster collection but harder to maneuver. Extraction phase: navigate back to entry point while carrying data.

### Why Medium Priority
- **Grid-based:** Maps well to existing tile system.
- **Growing complexity:** Self-inflicted difficulty curve is compelling.
- **Risk:** Classic snake on mobile in portrait needs careful input design. One-directional-change-per-turn model works.

### Security Programs
- **Pursuers:** Chase snake when in range
- **Blockers:** Occupy nodes, impassable
- **Scanners:** Sweep areas in learnable patterns

### Mythic: `FULL_DATA_EXTRACT_NO_SECURITY_CONTACT`
Collect 100% of data packets without touching any security program.
- **Hint:** "RUMOR: The probe passed like a ghost through every firewall..."

### Loot
- Whisper: "Encrypted Shard"
- Mythic: "Zero-Day Exploit Archive"

---

## CANDIDATE 4: Fortress Core — Tower Offense (LOW PRIORITY)

**Inspiration:** Tower Defense (inverted — player attacks)
**Sandpoint Location:** Daher/Quest Aircraft hangar at Sandpoint Airport
**Narrative:** Kodiak assembly hangar fortified as Kaniksu Network forward operating base. Automated defense grid. Breach from the airfield perimeter, taking out systems tier by tier.

### Core Mechanic
Boss fires escalating volleys on a 3-turn timer. Volley size DECREASES as boss takes damage — aggressive offense is optimal. The more you attack, the less you have to dodge.

### Why Low Priority
- **Inverted TD is novel** but hard to make feel distinct from regular STR combat with projectile dodging.
- **Static boss:** Similar feel to Asteroids boss (stationary target, projectile avoidance).
- **Could work as a variant** of Depot Crossing (industrial theme, same biome parent).

### Volley Scaling
| Boss HP | Volley Size |
|---------|-------------|
| > 66%   | 2 projectiles |
| 34–66%  | 4 projectiles |
| ≤ 33%   | 6 projectiles (phase 3) |

### Mythic: `KILL_BEFORE_PHASE3`
Defeat boss before it reaches phase 3 (≤33% HP).
- **Hint:** "RUMOR: Strike before the third volley and the fortress crumbles fully..."

### Loot
- Whisper: "Defensive Matrix Shard"
- Mythic: "Siege Breaker Doctrine"

---

## CANDIDATE 5: Sentry Nest — Swarm Tower (LOW PRIORITY)

**Inspiration:** Swarm management / tower spawn mechanics
**Sandpoint Location:** Schweitzer Mountain communication towers / forest fire watchtower
**Narrative:** Kaniksu Network converted a mountaintop communication array into a drone hive. Central tower spawns surveillance drones. Destroy spawn pods before swarm overwhelms.

### Core Mechanic
Central boss spawns weak swarm minions from 3 pods (5 HP each). Minions force STR combat on collision. Max 50 active. Destroy pods to weaken boss shield, then attack core.

### Why Low Priority
- **Swarm management** on mobile single-input is tricky — lots of entities to track.
- **STR combat integration** is tight (swarm forces combat mode) but could feel like punishment rather than challenge.
- **Mythic is interesting:** Complete fight without EVER entering STR combat. Pure avoidance.

### Mythic: `NO_STR_ENTERED`
Complete boss fight without entering STR combat mode.
- **Hint:** "RUMOR: The swarm never touched a single ghost..."

### Loot
- Whisper: "Hive Node Fragment"
- Mythic: "Perfect Stealth Theorem"

---

## CANDIDATE 6: Bunker Commandant — Whac-A-Mole (LOW PRIORITY)

**Inspiration:** Whac-A-Mole
**Sandpoint Location:** Sandpoint Gun Club range buildings / military-style bunkers
**Narrative:** Network commander pops up from bunker to bunker across a 3×3 grid. Destroy the bunkers, then finish the commander in the open.

### Core Mechanic
9 bunkers in a 3×3 grid. Boss pops up randomly, fires when visible, hides when attacked. Each bunker: 3 HP. Boss only vulnerable when exposed. Destroy all bunkers → nowhere to hide → finish with melee.

### Why Low Priority
- **Simple but satisfying.** Low complexity = easy to implement.
- **Feels like a mini-encounter** rather than a full boss. Could be a sub-boss or mid-floor event instead.
- **Limited card interaction** beyond Grenade (bunker destruction) and Melee (mythic kill).

### Mythic: `MELEE_KILL_NO_BUNKERS`
Destroy all 9 bunkers, then kill boss with Melee Strike card.
- **Hint:** "RUMOR: Strip away all cover, then strike close..."

### Loot
- Whisper: "Fortified Helmet"
- Mythic: "Demolition Expert License"

---

## CANDIDATE 7: Orbital Carrier — Galaga (SPECULATIVE)

**Inspiration:** Galaga
**Sandpoint Location:** Farragut Naval Station / satellite uplink facility
**Narrative:** Falcon Initiative activating a satellite weapon via the Farragut uplink. Carrier at top of screen with drone shield. Shoot through drones to hit carrier.

### Core Mechanic
Carrier at top, 6–12 drones in formation weaving. Carrier fires railgun AOE every 3 turns. Drones respawn. Pierce through drones with High Ground card.

### Why Speculative
- **Galaga-style vertical shooter** in a turn-based roguelike is a hard translation.
- **Multiple entities** (drones) are complex to render and track on mobile.
- **Could work as a simplified version** with fewer drones and slower pace.

### Mythic: `CARRIER_KILL_DRONES_ALIVE`
Kill carrier while 4+ drones still alive (pierce through shield instead of clearing it).
- **Hint:** "RUMOR: The boldest strike through the swarm itself..."

---

## CANDIDATE 8: Mainframe Core — Logic Puzzle (SPECULATIVE)

**Inspiration:** Puzzle games / Minesweeper logic
**Sandpoint Location:** Litehouse Foods data center / factory control mainframe
**Narrative:** AI core surrounded by 8 firewall nodes. Nodes rotate RED/BLUE. Core invulnerable while any RED exists. Synchronize all to BLUE, then Virus card for the kill.

### Core Mechanic
Pattern recognition + timing. Nodes cycle on predictable but phase-offset timers. Logic Hack flips individual nodes. Burst cards affect multiple. Wait for alignment or force it.

### Why Speculative
- **Puzzle boss** is great variety but may feel too cerebral for the arcade nostalgia vibe.
- **Timing-based** pattern reading works well with single input.
- **Virus card mythic** is compelling but requires specific deck composition.

### Mythic: `VIRUS_KILL_ALL_BLUE`
Synchronize all 8 nodes to BLUE, then deliver killing blow with Virus card.
- **Hint:** "RUMOR: Synchronize the grid perfectly, then deliver the payload..."

---

## Summary Priority Table

| # | Candidate | Priority | Arcade Source | Accessibility | Narrative Fit |
|---|-----------|----------|--------------|---------------|---------------|
| 1 | Ghost Sniper | **HIGH** | MGS: The End | Excellent (Camera card) | Lake overlook |
| 2 | Gravity Anchor | **MEDIUM** | Asteroids | Excellent (no movement) | Farragut underwater |
| 3 | Data Heist | **MEDIUM** | Snake | Good (grid-based) | Litehouse network |
| 4 | Fortress Core | LOW | Tower Defense | Good | Kodiak hangar |
| 5 | Sentry Nest | LOW | Swarm mgmt | Moderate (many entities) | Schweitzer towers |
| 6 | Bunker Commandant | LOW | Whac-A-Mole | Good | Gun Club |
| 7 | Orbital Carrier | SPECULATIVE | Galaga | Moderate | Farragut satellite |
| 8 | Mainframe Core | SPECULATIVE | Puzzle/Minesweeper | Good | Litehouse data center |

**Recommended next 3 for implementation** (to reach pool of 6):
1. Ghost Sniper — highest accessibility, unique patience mechanic
2. Gravity Anchor — zero movement requirement, card-only
3. Data Heist — grid-based, good mobile translation, strong narrative
