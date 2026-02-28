# Enemy AI Roadmap — Commandos-Style Stealth Tactics

## Vision

Transform the Gone Rogue tutorial (contrived) floors into Commandos-inspired stealth puzzles where every encounter is a spatial logic problem solved through observation, timing, and creative use of existing systems. **No new engines** — only augmentation, interconnection, and recontextualization of what already exists.

### Design North Star

> The player looks at a floor, reads the ground effects, notes the patrol routes, checks their items, and forms a plan. Execution requires timing and spatial awareness, not reflexes or stat checks.

### Reference Games
- **Commandos: Behind Enemy Lines** — vision cones, patrol manipulation, environmental distractions, multi-tool problem solving
- **Metal Gear Solid** — alert cascades, awareness states (already partially implemented)
- **Into the Breach** — perfect information, readable threats, environmental chain reactions

---

## Existing Systems Inventory (What We Have)

| System | File(s) | Commandos Relevance |
|--------|---------|-------------------|
| **Enemy Awareness States** | `gone-rogue.js` | UNAWARE → SUSPICIOUS → ALERTED → ENGAGED is already a 4-state MGS/Commandos alert model |
| **Sight Cones** | `gone-rogue.js` | 60° directional sight, facing indicators — this IS the Commandos vision cone |
| **Patrol Routes** | `gone-rogue.js` | Stationary, Patrol, Circular, Ellipse — the backbone of Commandos level design |
| **Enemy Intent System** | `enemy-intent-system.js` | 13 face glyphs + 13 weapons — telegraphed threat info (Slay the Spire / Into the Breach style) |
| **Ground Effects** | `gone-rogue.js` | Fire, Water, Oil, Electrified Water — environmental hazards that affect both player AND enemies |
| **Stealth Tiles** | `gone-rogue.js` | Shadows (-30%), Grass (-20%), Smoke (-40%), Cover (blocks LOS) — concealment zones |
| **Lighting System** | `lighting-system.js` | Per-tile intensity, darkness stealth bonus (0-50%), directional flashlights — dynamic shadow play |
| **Interactive Items** | `interactive-items.js`, `item-spawner.js` | Designer-friendly item placement, biome-aware spawning |
| **Food/Pickup System** | `food-database.js` | Auto-pickup, overhead animations, movement penalties (picnic blanket) |
| **Overhead Animator** | `overhead-animator.js` | !, ?, 💤, 🔍 expressions — visual awareness feedback |
| **Theft/Steal System** | `enemy-steal-system.js` | Adjacent steal from UNAWARE enemies — the Commandos "knife from behind" |
| **Card System** | `card-system.js` | Lure, Cigarettes, Prone, Silent Shot, Suppressed affix — stealth-oriented tools exist |
| **Biome System** | `gone-rogue.js` | 6 biomes with distinct terrain profiles, bleed transitions |
| **Status Effects** | `gone-rogue.js` (tutorial doc) | Burning, Wet, Oiled, Stunned, Hidden, Exposed — environmental status layer |
| **Tutorial Floors** | `tutorial-floors.js` | Hand-crafted, designer-controlled layouts — perfect for Commandos-style puzzle levels |

---

## Phase 1: Enemy Awareness Overhaul (Augment Existing)

**Goal**: Make the existing 4-state awareness system behave like Commandos' alert model where awareness is *spatial* and *communicable*.

### 1.1 Awareness Responds to Ground Effects

Currently awareness is based on distance + sight cone. Augment `_updateEnemyAwareness()` to query ground effects and lighting at both the enemy's position and the player's position.

```
DETECTION MODIFIER STACK (applied to base detection range):
──────────────────────────────────────────────────────────
Player in Shadow tile:     -30% (existing)
Player in Grass tile:      -20% (existing)
Player in Smoke:           -40% (existing)
Player in Darkness (<0.2): -40% (from LightingSystem.getDarknessStealthBonus)
Player in Darkness (<0.4): -30%
Player behind Cover:       blocked LOS (existing)
Player is WET:             +0% (neutral)
Player is OILED:           +10% (slippery = noisy)
Player is BURNING:         +50% (fire is visible and loud)
Enemy is STUNNED:          detection disabled for 1 round
Enemy is BURNING:          -30% detection (distracted by own fire)
Enemy on OIL tile:         -10% detection (unsteady footing)
Enemy in SMOKE:            -20% detection (obscured own vision)
```

**Implementation**: Add a `_getDetectionModifiers(enemy, player)` function that queries `GroundEffects.getGroundAt()`, `LightingSystem.getLightAt()`, and entity status effects, then returns a multiplier applied to the existing sight range calculation.

**Files to modify**: `gone-rogue.js` → `_updateEnemyAwareness()`

### 1.2 Awareness Propagation (Alert Cascade)

When an enemy transitions to ALERTED, nearby enemies within a **communication radius** (5 tiles) also increase awareness. This creates the Commandos domino effect where alerting one guard can blow an entire zone.

```
ALERT CASCADE RULES:
────────────────────
SUSPICIOUS enemy:  broadcasts nothing
ALERTED enemy:     +30 awareness to allies within 5 tiles
ENGAGED enemy:     +50 awareness to allies within 8 tiles

BLOCKED BY:
- Walls (no LOS between enemies)
- Smoke ground effect (blocks cascade propagation)
- STUNNED ally (cannot receive cascade)
- SLEEPING ally (reduced cascade: +10 instead of +30)
```

**Implementation**: In `_updateEnemyAwareness()`, after an enemy crosses the ALERTED threshold, iterate nearby enemies and apply cascade bonuses. Check LOS between enemies using existing wall data.

**Commandos parallel**: This is exactly how Commandos works — one guard shouts, nearby guards investigate. Smoke bombs break the chain.

### 1.3 Investigation Behavior

When an enemy becomes SUSPICIOUS but can't see the player, they should **investigate the disturbance location** rather than standing still.

```
INVESTIGATION STATES (new sub-states of SUSPICIOUS):
─────────────────────────────────────────────────────
INVESTIGATING: Enemy walks toward last-known disturbance point
  - Duration: 3-5 turns
  - Movement: Uses existing patrol pathfinding toward target tile
  - On arrival: Looks around (rotates facing 4 directions over 4 turns)
  - On timeout: Returns to patrol route

DISTURBANCE SOURCES:
  - Player ran nearby (existing: running = +15 awareness within 5 tiles)
  - Ground effect appeared in enemy's awareness range (smoke, fire)
  - Breakable was destroyed within earshot (8 tiles)
  - Another enemy's alert cascade reached them
```

**Implementation**: Add `enemy.investigationTarget = {x, y}` and `enemy.investigationTimer`. In the patrol movement function, if `investigationTarget` exists, pathfind toward it instead of following the patrol route. Use existing `_moveEnemy()` with a temporary destination override.

**Commandos parallel**: Guards in Commandos walk to where they heard a noise, look around, then return. This is the core "distraction" loop.

---

## Phase 2: Ground Effects as Tactical Tools (Interconnect Existing)

**Goal**: Make every ground effect tile a potential tool in the player's Commandos toolkit by ensuring enemies react to them and items can create/modify them.

### 2.1 Enemy Ground Effect Reactions

Enemies should pathfind *around* dangerous ground effects, creating manipulable patrol routes.

```
ENEMY GROUND EFFECT AVOIDANCE:
──────────────────────────────
FIRE tiles:     Enemy avoids (pathfinds around), +3 tile buffer
OIL tiles:      Enemy avoids only if fire is within 3 tiles of oil
WATER tiles:    Enemy walks through (but becomes WET → shock vulnerable)
SMOKE tiles:    Enemy avoids if UNAWARE (can't see through)
                Enemy walks through if ALERTED+ (pursuing player)
ELECTRIFIED:    Enemy avoids (pathfinds around), +2 tile buffer

BEHAVIORAL OVERRIDE:
  - ENGAGED enemies ignore all avoidance (blind pursuit)
  - ALERTED enemies ignore SMOKE avoidance (investigating)
  - Avoidance creates predictable "safe corridors" for player
```

**Implementation**: Modify `_moveEnemy()` to check adjacent tiles for ground effects before stepping. If the next patrol waypoint requires crossing a hazard, the enemy pauses or re-routes. This is a simple "cost increase" on hazard tiles in the existing movement logic.

**Commandos parallel**: Commandos guards avoid hazards, which lets you use environmental obstacles to funnel patrols into killzones or create safe passages.

### 2.2 Item → Ground Effect Creation

Existing cards and items should *create* ground effects when used in the exploration (non-combat) phase. This turns items into spatial manipulation tools.

```
ITEM → GROUND EFFECT MAPPINGS:
──────────────────────────────
Card/Item               → Creates                  → Duration    → Tiles
─────────────────────────────────────────────────────────────────────────
Cigarettes (🚬)         → SMOKE at player position  → 5 turns     → 1 tile
Oil Slick Card (🛢️)    → OIL in target direction   → persistent  → 3 tiles
Water Bottle (💧)       → WATER at target           → 10 turns    → 2 tiles
Lighter (🔥) + OIL     → FIRE on oil tiles         → 8 turns     → spreads
Grenade (💣)            → destroys breakables +     → 3 turns     → 3x3 area
                          FIRE in blast radius
Lure Card               → NOISE at target location  → instant     → N/A
                          (triggers investigation)
```

**Implementation**: Add a `_useItemOnMap(card, direction)` handler in the command processor. When a card with `groundEffect` property is played outside combat, call `GroundEffects.createEffect()` at the calculated position. This reuses the existing `shoot` + direction parsing for targeting.

**New command**: `USE [card] [direction]` — e.g., `USE cigarettes` (creates smoke at feet), `USE oil east` (places oil 2 tiles east).

**Commandos parallel**: This is the Commandos toolkit — the Sapper places mines, the Marine throws molotovs, the Spy drops cigarettes. Each tool modifies the spatial puzzle.

### 2.3 Ground Effect Chains

Document and formalize the chain reaction system that's partially implied in existing docs.

```
CHAIN REACTION TABLE:
─────────────────────
Trigger           + Target          = Result
──────────────────────────────────────────────────
FIRE              + OIL tile        = FIRE spreads to all connected oil tiles
FIRE              + OILED entity    = 2x damage, removes OILED, applies BURNING
WATER             + FIRE tile       = Extinguishes fire, creates STEAM (smoke, 3 turns)
TAZER/ELECTRIC    + WATER tile      = ELECTRIFIED water (stuns all entities in water)
TAZER/ELECTRIC    + WET entity      = 2x stun duration
WATER             + BURNING entity  = Removes BURNING, applies WET
GRENADE           + OIL tile        = Massive fire spread (5x5)
LIGHTER           + GRASS tile      = FIRE (burns away concealment, 5 turns)
```

**Implementation**: In `GroundEffects.createEffect()`, after placing a new effect, check adjacent tiles for chain reactions. This is a simple adjacency scan with a lookup table.

**Commandos parallel**: Environmental chain reactions are rare in original Commandos but common in Commandos 2 and modern immersive sims. They reward planning and create emergent puzzle solutions.

---

## Phase 3: Tutorial Floor Puzzle Design (Supplement Existing)

**Goal**: Use the hand-crafted tutorial floor system (`tutorial-floors.js`) to create Commandos-style stealth puzzle encounters that teach the interconnected systems.

### 3.1 Tutorial Floor 2: "The Watchtower" (Stealth Basics)

**Teaching objective**: Vision cones, patrol timing, shadow/grass concealment.

```
LAYOUT CONCEPT:
───────────────
   ████████████████████████████████████████
   █..........E→→→→→→→→→→E...............█
   █..........█████████████...............█
   █...P......████SHADOW███.......🚪EXIT..█
   █..........████SHADOW███...............█
   █..........█████████████...............█
   █.....░░░░░░░░░░░░░░░░░░░░............█
   █..........E←←←←←←←←←←E...............█
   ████████████████████████████████████████

   P = Player spawn
   E = Enemies (patrol arrows show route)
   ░ = Grass tiles (stealth -20%)
   SHADOW = Shadow zone (stealth -30%)
```

**Puzzle solution**: Wait for top patrol to move right, cross through grass to shadow zone, wait for bottom patrol to move left, exit through gap.

**What it teaches**: Sight cones have gaps. Grass and shadow reduce detection. Timing patrol routes is essential.

### 3.2 Tutorial Floor 3: "The Distraction" (Item + Environment)

**Teaching objective**: Using items to create ground effects that manipulate enemy behavior.

```
LAYOUT CONCEPT:
───────────────
   ████████████████████████████████████████
   █.......................................█
   █...P...............OIL.OIL.OIL........█
   █.......████████....OIL.OIL.OIL........█
   █.......█LOOT RM█.....................🚪█
   █.......████ ████..........E→→→→→→→E..█
   █..............█.......................█
   █..🚬CIGARETTES█....GRASS.GRASS.GRASS..█
   █..............█.......................█
   █.......████████.......E↓   ↑E........█
   ████████████████████████████████████████

   🚬 = Cigarette pickup (creates smoke)
   OIL = Oil slick tiles
   E = Enemies with patrol routes
```

**Puzzle solution A (stealth)**: Pick up cigarettes, use them to create smoke screen, cross through smoke while enemies can't see. Loot room contains lighter.

**Puzzle solution B (chaos)**: Use lighter on oil to create fire barrier, funneling patrol enemy away from exit. Fire + oil chain reaction blocks pursuit.

**What it teaches**: Items create ground effects. Ground effects block enemy vision AND movement. Multiple valid solutions exist.

### 3.3 Tutorial Floor 4: "The Alert Chain" (Awareness Cascade)

**Teaching objective**: Alert propagation, investigation behavior, isolating enemies.

```
LAYOUT CONCEPT:
───────────────
   ████████████████████████████████████████
   █..................E1(stationary).......█
   █.......................................█
   █...P.........SMOKE.SMOKE..............█
   █..........████SMOKE████...E2(patrol)..█
   █..........█        █..................█
   █..........█  SAFE  █........E3.......🚪█
   █..........█  ZONE  █..................█
   █..........██████████..................█
   █..................E4(stationary).......█
   ████████████████████████████████████████

   SMOKE = Pre-placed smoke tiles (block alert cascade)
```

**Puzzle solution**: E1 and E4 are stationary guards that would cascade-alert E2 and E3 if disturbed. Smoke tiles between zones block cascade propagation. Player must use the smoke barrier to deal with E1 without alerting the rest, then navigate past E2's patrol to reach exit.

**What it teaches**: Alerting one enemy alerts nearby enemies. Smoke blocks alert propagation. Isolate enemies before engaging.

---

## Phase 4: Steal System as "Knife Kill" (Augment Existing)

**Goal**: Make the existing theft mechanic function as the Commandos "silent takedown" — the primary way to neutralize enemies without triggering alerts.

### 4.1 Silent Neutralization

Extend the existing `STEAL` command to support silent incapacitation when the player has appropriate tools and the enemy is UNAWARE.

```
STEAL OUTCOMES (augmented):
───────────────────────────
Condition                                    → Result
─────────────────────────────────────────────────────────────
Adjacent + UNAWARE + tool has "sleight" tag  → Steal card (existing)
Adjacent + UNAWARE + tool has "disarm" tag   → Disarm (enemy loses next attack card)
Adjacent + UNAWARE + tool has "intimidate"   → Enemy becomes SLEEPING for 10 turns
Adjacent + SLEEPING enemy                    → Auto-steal best card, no tool needed
Adjacent + STUNNED enemy                     → Steal at 2x value (bonus loot)

NOISE GENERATION:
  - Successful steal: 0 noise (silent)
  - Failed steal: 15 noise (alerts nearby enemies)
  - Disarm: 5 noise (small sound)
  - Intimidate: 0 noise (silent)
```

**Implementation**: Extend `enemy-steal-system.js` to check `stealTags` against new outcomes. The "intimidate → SLEEPING" path is the Commandos "tie up" mechanic — neutralized enemies are out of commission but could theoretically be found and woken by patrolling allies.

### 4.2 Body Discovery

If an enemy is put to SLEEPING state and another enemy's patrol route passes within 2 tiles, the patrolling enemy should "discover" the body and immediately transition to ALERTED.

```
BODY DISCOVERY:
───────────────
For each SLEEPING enemy:
  For each other enemy within 2 tiles:
    If discoverer is not SLEEPING/STUNNED:
      discoverer.awareness = MAX (ALERTED)
      discoverer.investigationTarget = sleeping enemy position
      Overhead: discoverer shows "!" expression
      Cascade: triggers alert propagation to nearby allies
```

**Commandos parallel**: This IS Commandos. You tie up a guard, another guard finds them, the alarm sounds. The solution is to hide bodies in rooms or behind cover where patrols don't pass — or neutralize enemies in the right order.

---

## Phase 5: Lighting as Tactical Layer (Interconnect Existing)

**Goal**: Make the existing lighting system a first-class stealth tool that players can manipulate.

### 5.1 Shootable Light Sources

Environmental light sources (monitors, bulbs, campfires) become breakable. Destroying them darkens an area, creating new stealth routes.

```
SHOOTABLE LIGHTS:
─────────────────
Light Source    HP   Shoot Result              Noise
──────────────────────────────────────────────────────
💡 Light Bulb  1    Area goes dark             10 (glass break)
💻 Monitor     2    Area goes dark, sparks     8
🏕️ Campfire    3    Extinguished, SMOKE (3t)   5
🪔 Lava Lamp   2    Area goes dark, OIL spill  8
🔥 Fire barrel 1    Extinguished, STEAM (3t)   12 (loud hiss)

NOISE triggers investigation from enemies within earshot radius.
Destroying a light = trading noise now for darkness later.
```

**Implementation**: Add light sources to the breakable system (they already have positions from `LightingSystem.addLightSource()`). On destruction, call `LightingSystem.removeLightSource(x, y)` and optionally spawn a ground effect. Reuse existing breakable HP/damage pipeline.

### 5.2 Player Light as Risk/Reward

Equipping a light item (flashlight, lighter, NVG) already increases visibility. Formalize the tradeoff:

```
LIGHT ITEM RISK/REWARD:
───────────────────────
Item                See Range    Stealth Penalty    Special
─────────────────────────────────────────────────────────────
None (dark)         2 tiles      +0%                Darkness bonus active
🔥 Lighter          3 tiles      +10%               Can ignite oil/grass
🔦 Flashlight       6 tiles      +30%               Directional (enemies see cone)
🥽 Night Vision     8 tiles      +5%                Best stealth/vision ratio
```

**Commandos parallel**: In Commandos, you generally DON'T want to carry a light in stealth situations. The player must choose: do I want to see, or do I want to be unseen?

---

## Phase 6: Biome-Specific Puzzle Archetypes

Each biome should have a signature Commandos-style puzzle archetype that leverages its unique ground effects and lighting.

### Forest (Floors 1-3): The Patrol Gap
- **Signature**: Grass concealment + timed patrol crossing
- **Tools**: Cigarettes (smoke), Lure (distraction)
- **Archetype**: Wait, observe, cross during gap

### Grey Cave (Floor 4): The Darkness Maze
- **Signature**: Near-zero ambient light + shootable light sources
- **Tools**: Lighter (temporary light), flashlight (risky), NVG (optimal)
- **Archetype**: Navigate darkness, destroy lights to create safe zones

### Mall (Floors 5-9): The Fire Funnel
- **Signature**: Oil slicks + lighter = fire barriers, well-lit (hard stealth)
- **Tools**: Oil Slick card, Lighter, Water Bottle (extinguish)
- **Archetype**: Can't hide (too bright), must redirect enemies with fire

### Office (Floors 10-15): The Hack & Distract
- **Signature**: Monitors as light sources + breakable for darkness, electronic disruption
- **Tools**: Jammer (disables enemy sight for 2 turns), Virus (confuses patrol)
- **Archetype**: Shoot monitors for darkness, jam electronics, silent movement

### Industrial (Floors 16-22): The Chain Reaction
- **Signature**: Oil + Fire + Water + Electric = maximum chain potential
- **Tools**: Every ground effect tool matters here
- **Archetype**: Set up Rube Goldberg chain reactions to clear paths

### Aerospace (Floors 23-30): The Precision Run
- **Signature**: Mostly bright, minimal concealment, tight patrol coverage
- **Tools**: All previously learned techniques, but with smaller margins
- **Archetype**: Execute a perfect plan with no room for error

---

## Implementation Priority

### Must-Have (enables Commandos feel)
1. **Phase 1.1**: Detection modifier stack (ground effects affect awareness)
2. **Phase 2.1**: Enemy ground effect avoidance (pathfind around hazards)
3. **Phase 2.2**: Item → ground effect creation (`USE` command)
4. **Phase 1.3**: Investigation behavior (enemies walk toward disturbances)

### Should-Have (deepens tactical options)
5. **Phase 1.2**: Alert cascade propagation
6. **Phase 4.1**: Silent neutralization (steal → incapacitate)
7. **Phase 5.1**: Shootable light sources
8. **Phase 3.1-3.3**: Tutorial puzzle floors

### Nice-to-Have (polish and emergence)
9. **Phase 4.2**: Body discovery mechanic
10. **Phase 2.3**: Ground effect chains (formalized)
11. **Phase 5.2**: Light item risk/reward tuning
12. **Phase 6**: Biome-specific puzzle archetypes

---

## Success Metrics

The system is working when a player can:

1. **Read the level** — Look at ground effects, enemy patrols, and lighting to form a plan before moving
2. **Use items spatially** — Drop smoke, ignite oil, lure enemies with noise — all outside of combat
3. **Manipulate patrols** — Create ground effects that force enemies to reroute
4. **Chain reactions** — Set up multi-step environmental interactions (oil → fire → steam → cover)
5. **Silent takedowns** — Neutralize isolated enemies without triggering cascading alerts
6. **Feel clever** — Every successful floor clear feels like solving a puzzle, not winning a stat check

---

## Anti-Goals

Things we are NOT building:

- ❌ New pathfinding engine (reuse existing movement with cost modifications)
- ❌ New AI state machine (augment existing 4-state awareness)
- ❌ New rendering system (reuse overhead animator, CSS classes, existing tile rendering)
- ❌ New item system (extend existing cards with `groundEffect` property)
- ❌ Real-time gameplay (this is still turn-based / command-based, which actually makes it MORE like Commandos since you can plan)

---

## Cross-References

- [BIOME_SYSTEMS.md](./BIOME_SYSTEMS.md) — Ground effect tiles, biome catalog, environmental transitions
- [ENEMY_INTENT_SYSTEM_GUIDE.md](./ENEMY_INTENT_SYSTEM_GUIDE.md) — Face glyphs, threat levels, combat telegraphing
- [LIGHTING_SYSTEM.md](./LIGHTING_SYSTEM.md) — Per-tile illumination, darkness stealth bonuses, biome lights
- [GONE_ROGUE_TUTORIAL.md](./GONE_ROGUE_TUTORIAL.md) — Awareness states, stealth bonuses, ground effect interactions
- [INTERACTIVE_ITEMS_TODO.md](./INTERACTIVE_ITEMS_TODO.md) — Item spawner, overhead animator integration
- [FOOD_AND_INTERACTIVE_ITEMS_GUIDE.md](./FOOD_AND_INTERACTIVE_ITEMS_GUIDE.md) — Auto-pickup, movement penalties, visual feedback
- [THEFT_MECHANICS.md](./THEFT_MECHANICS.md) — Pre-combat steal, exposed tags, steal tools
- [CARD_SYNERGY_SYSTEM.md](./CARD_SYNERGY_SYSTEM.md) — Card interactions and synergy types

---

**Document Version**: 1.0
**Created**: 2026-02-28
**Status**: Roadmap — no implementation yet
**Philosophy**: Augment, Supplement, Interconnect — never replace
