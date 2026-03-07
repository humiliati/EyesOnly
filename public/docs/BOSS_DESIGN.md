# Boss Design — Actionable Encounters
## Gone Rogue: Sandpoint, Idaho

**Status:** 3 settled bosses + final boss. ~3 bosses per run (randomly selected) + final boss on floor 30.
**Boss floors:** 10, 16, 22, 30

---

## Run Structure

Each run uses **3 random boss encounters** from the settled pool (floors 10, 16, 22) plus the **Final Boss** on floor 30. Multiple runs are required to see all boss types. The boss pool will eventually expand to 6+ encounters, but only 3 are drawn per run.

### Boss ↔ Biome Mapping

| Floor | Parent Biome | Boss Arena Biome | Boss Encounter |
|-------|-------------|-----------------|----------------|
| 10 | INDUSTRIAL (Kodiak Assembly Plant) | BOSS_TRAIN_DEPOT (Sandpoint Junction) | Depot Crossing — Frogger with intersecting tracks |
| 16 | LAKE (Pend Oreille Lakeshore) | BOSS_LONG_BRIDGE (The Long Bridge) | Bridge Crossing — Frogger traffic variant, water flanks |
| 22 | SKI_MOUNTAIN (Schweitzer Mountain) | BOSS_SKI_MOUNTAIN (Schweitzer Descent) | SkiFree Descent — vertical chase, ice acceleration |
| 30 | AEROSPACE (Farragut Naval Station) | TBD | Final Confrontation — all faction threads converge |

Normal floors in the parent biome lead up to each boss encounter, building atmosphere before the arena shift.

---

## Accessibility Contract

**CRITICAL:** All encounters must work in portrait, mobile, single-input priority. All input design is constrained for stakeholder accessibility requirements — these encounters must work (at minimum tier 1, no "perfect victory" action card modifiers) for quadriplegics using adaptive controllers (sip in, blow out).

Workaround for higher difficulty tiers: Perfect boss kill easter egg action cards solve locomotion and tactile difficulty in T2/T3.

**Examples:**
- Sniper boss dies to Camera card in 1 shot (accessibility path)
- Train boss has a Grapple action card synergy that pulls boss onto tracks (instead of player dodging)

---

## SETTLED BOSS 1: Depot Crossing (Floor 10)

### Narrative
The meet is compromised at Sandpoint Junction — the 1916 brick depot where BNSF main, Montana Rail Link from Missoula, and the Empire Builder Amtrak line converge. Three rail lines create a lethal grid of moving steel. Cross the active yard to reach the extraction point on the far platform.

### Arena: BOSS_TRAIN_DEPOT
- **Map size:** 40×20 (regular or XL)
- **Shape:** Open yard with intersecting train tracks
- **Track layout:** 5 horizontal tracks + 3 vertical tracks = ~15 intersections
- **Intersections marked:** `╬` (double-hazard tiles — trains from both axes)
- **Safe islands:** 4 platform clusters (2×3 tiles) between track intersections
- **Player start:** South edge
- **Extraction:** North edge (far platform)

### Hazard System
- **Horizontal trains** (`═` tiles): Speed 1–3, alternating directions, 2–5 car lengths, 3–6 tile gaps
- **Vertical trains** (`║` tiles): Speed 1–2, alternating directions, 2–4 car lengths, 4–8 tile gaps
- **Intersection tiles** (`╬`): Lethal from EITHER axis — the most dangerous tiles on the map
- **Express train alert:** Every 30 turns, all lanes clear briefly then a high-speed express crosses
- **Train contact damage:** 50 (effectively lethal for most builds)

### Boss Entity: Depot Warden
- **HP:** 60
- **Position:** Far platform (north edge) — fires sniper shots across the yard
- **Behavior:** Stationary shooter. Player must cross the yard while taking fire.
- **The yard IS the boss.** The Warden is the narrative wrapper; the trains are the real threat.

### Interactive Objects
- **Crossing Bell** (🔔): Ring to stun one lane for 3 seconds
- **Signal Light** (🚦): Hack to stop one track for 5 seconds

### Mythic Condition: `TRAIN_IMPACT_KILL`
Lure the Warden into an active train lane using a **Lure** card. Boss takes 50 damage from train impact.
- **Hint:** "RUMOR: If only the Warden had met a harsher fate..."

### Card Synergies
- **Lure** (🥩): Draws Warden onto tracks → train impact kill
- **Grapple** (accessibility): Pulls Warden onto tracks without player needing to cross
- **Grenade** (💣): Destroy Rail Barriers for new crossing paths

### Optimal Deck
- 3–4× Lure (mythic path)
- 2× Movement cards (crossing)
- 2× Attack cards (chip damage if not going mythic)
- 1× Healing (sustain through sniper shots)

---

## SETTLED BOSS 2: Long Bridge Crossing (Floor 16)

### Narrative
Extraction vehicle waits on the Sandpoint side. Player starts on the Sagle side. Two miles of narrow road over Lake Pend Oreille — no shoulder, just water on both sides. Traffic doesn't stop.

### Arena: BOSS_LONG_BRIDGE
- **Map size:** 60×14 (long horizontal)
- **Shape:** Extremely narrow playable corridor — claustrophobic
- **Water border:** 4 rows top (lake), 4 rows bottom (lake) — all lethal/impassable
- **Playable rows:** 6 total
  - 1 shoulder row (north)
  - 3 traffic lanes (the kill zone)
  - 1 median
  - 1 bike/pedestrian path (south, slower hazards)
- **Player start:** West edge (Sagle side)
- **Extraction:** East edge (Sandpoint side)

### Hazard System
- **Lane 1** (east-bound): Cars and trucks, speed 2–3, gap 3–5
- **Lane 2** (west-bound): Cars, semis, trucks, speed 2–4, gap 2–4
- **Lane 3** (east-bound): Cars and semis, speed 3–5, gap 2–3 (fastest lane)
- **Bike path** (west-bound): Motorcycle couriers, speed 1–2, gap 4–8 (relatively safe)
- **Speed escalation:** Traffic speeds increase every 20 turns
- **Vehicle contact damage:** 99 (instant kill)
- **Water contact damage:** 99 (instant kill)

### Boss Entity: None (Survival Objective)
This is a pure frogger survival crossing. No boss HP bar. The bridge IS the encounter. Victory = reaching the east edge alive.

### Interactive Objects
- **Traffic Light** (🚦): Hack to stop one lane for 5 seconds
- **Emergency Radio** (📻): Use to warn traffic, brief slowdown on all lanes (3 seconds)
- **Jersey Barriers** (🧱): Indestructible cover — sit in the median between traffic

### Mythic Condition: `NO_DAMAGE_CROSSING`
Cross the entire bridge without taking any damage from vehicles or water.
- **Hint:** "RUMOR: The bridge never touched them — not once..."

### Card Synergies
- **Movement cards:** Essential — this is a locomotion puzzle
- **Overwatch:** Auto-dodge one incoming vehicle per turn
- **Jammer** (📡): Freeze all traffic for 2 turns (huge window)

### Optimal Deck
- 4× Movement/dash cards
- 2× Jammer or slow effects
- 2× Healing (insurance)
- Patience-oriented build — timing matters more than DPS

---

## SETTLED BOSS 3: Schweitzer Descent (Floor 22)

### Narrative
The handoff went wrong at the Schweitzer summit lodge. Now the player is skiing down the mountain with a Kaniksu Network enforcer on a snowmobile in pursuit. Extraction helicopter waits at the base lodge.

### Arena: BOSS_SKI_MOUNTAIN
- **Map size:** 14×60 (long vertical — SkiFree proportions)
- **Shape:** Narrow vertical corridor with tree walls on both sides
- **Tree wall columns:** Left 0–2, Right 11–13 (impassable pine/fir/autumn trees)
- **Playable columns:** 3–10 (8 tiles wide)
- **Scroll direction:** Vertical down (player auto-advances south)
- **Player start:** North center (summit)
- **Extraction:** South center (base lodge)

### SkiFree Feel
- **Automatic southward drift:** Player always moves south. Speed modulated by tile type.
- **Ice sheets** (`~`, light blue `#88ccff`): Snaking streaks across the run. Stepping on ice = acceleration south (moveMod 1.5) + reduced lateral control (50% reduction) + slide 2–4 extra tiles south. Chain slides possible.
- **Obstacles:** Pine trees, rocks, snow banks, other skiers scattered in the playable corridor
- **Sections escalate:** Upper Slopes (easy) → Treeline Run → Mogul Field → Chute → Base Approach (dense)

### Ice Physics
- **Ice char:** `~` with tileColor `#88ccff`
- **Acceleration:** 2× south when on ice
- **Slide chance:** 80% chance to slide 2–4 tiles south on contact
- **Control reduction:** 50% lateral movement penalty while sliding
- **Chain slide:** If slide lands on more ice, chain continues
- **Visual:** Light blue tile tint distinguishes ice from snow

### Pursuer: Kaniksu Enforcer (🏍️ Snowmobile)
- **Starts** 8 tiles north of player
- **Base speed:** 0.8× player speed (slowly gaining)
- **Acceleration:** +0.02 per turn (eventually catches up)
- **Catch damage:** 25 HP (not instant kill, but devastating)
- **Behavior:** Slows slightly when player is moving fast; accelerates when player stops or hits obstacles
- **NOT killable** — pure pursuit pressure
- **Visual tension:** Screen shake when close, red vignette at distance ≤3

### Obstacle Damage
- Tree collision: 10 damage + full stop (enforcer gains ground)
- Rock collision: 15 damage + full stop
- Other skier: 5 damage (ghost collision, no stop)
- Snow bank: Breakable (1 HP), slows player

### Mythic Condition: `PERFECT_DESCENT_NO_TREE_HIT`
Reach the base without hitting any tree obstacle.
- **Hint:** "RUMOR: They say one agent skied the whole mountain without touching a single tree..."

### Card Synergies
- **Movement cards:** Critical for lateral dodging
- **Fragment Shower** (💫): Clears obstacles in a radius ahead
- **High Ground** (🎯): Could slow the enforcer briefly if allowed

### Optimal Deck
- 4× Movement/dodge cards
- 2× Fragment Shower (obstacle clearing)
- 2× Healing (sustain through mistakes)
- Speed-oriented build — momentum is life

---

## FINAL BOSS: Farragut Convergence (Floor 30)

### Narrative
The decommissioned Farragut Naval Station at the south end of Lake Pend Oreille. WWII submarine docks beneath the lake. The Falcon Initiative's hidden command center. All faction threads — Kaniksu Protocol, Project Chimera, the Falcon Initiative — converge here.

### Arena: TBD
**Status:** Not yet designed. The final boss should synthesize mechanics from the 3 settled bosses the player encountered during this run. Possible approaches:

1. **Phase boss:** 3 phases, each echoing one of the run's bosses (e.g., phase 1 = train hazards, phase 2 = traffic crossing, phase 3 = descent chase)
2. **Choose-your-approach:** Player picks which final encounter style to face based on cards collected
3. **Composite arena:** All three hazard types present simultaneously in a large arena

### Design Constraints
- Must work with ANY combination of the 3 boss encounters the player saw this run
- Must serve as narrative climax — Kaniksu Protocol resolution
- Must have a mythic condition that references the run's journey
- Must respect the accessibility contract (single input, adaptive controller compatible)

### TBD Items
- [ ] Boss entity design
- [ ] Arena biome definition
- [ ] Mythic condition
- [ ] Loot table
- [ ] How the 3 prior bosses feed into this encounter

---

## Boss Pool Expansion Plan

The 3 settled bosses above are **confirmed for implementation.** Additional boss encounters in BOSS_ENCOUNTER_IDEAS.md are candidates for expanding the pool to 6+ types, increasing run variety. Only ~3 are drawn per run, so a pool of 6 means each run feels different.

### Priority for next 3 bosses (from IDEAS doc):
1. **Sniper Boss** — Camera card mechanic, patience-based, high accessibility (dies to Camera in 1 shot)
2. **Asteroids Boss** — Gravity anchor locks movement, card-only offense, wave-based
3. **Snake Boss** — Data heist through network topology, growth mechanics

---

## Shared Systems

### MinigameContainer Interface
All boss encounters implement:
```
init(ctx)       — Load arena, place hazards
tick(ctx)       — Update hazards, check collisions
render(ctx)     — Draw arena-specific elements
isComplete(ctx) — Check win/loss conditions
```

### Input Contract (Accessibility)
- **Single directional input** per turn (N/S/E/W or equivalent)
- **One action button** (use card / interact)
- **Sip/blow adaptive mapping:** Sip = confirm/advance, Blow = cancel/retreat
- **No simultaneous inputs required**
- **No twitch reflexes required at T1 difficulty**

### Mythic System Integration
- Track condition during encounter via `_activeBoss.mythicState`
- Flash "⚡ A strange energy shifts..." when condition partially met
- "⚡⚡⚡ MYTHIC CONDITION MET!" on boss defeat with condition active
- 💎 Guaranteed mythic loot (Inventory Charm for persistent slot unlock)
- 25–50 cryptos bonus
- 10% rumor hint chance when mythic NOT met
