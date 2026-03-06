# STR HUD Designer Roadmap

## Purpose

This roadmap identifies the **seams** in the current STR combat system that must be exposed as designer-tunable knobs before we can build an STR Combat Animation Studio inside `public/portal/`. The goal is a visual tool — on par with the Asset, Map, World, Item, and Loot designers — that lets a designer preview, time, and polish every frame of a combat resolution without touching code.

Additionally, this roadmap catalogs **combat balance knobs** and **boss/special encounter overrides** so designers can create dramatically different combat experiences per enemy type, per floor, or per narrative encounter — all from config, zero code changes.

## Architecture Context

The Unified Designer (`unified-designer.html`) loads each tool as an iframe tab via a `data-designer` attribute on a nav button. The STR Combat Animation Studio will follow this pattern:

```
public/portal/
├── unified-designer.html          ← add data-designer="str-combat" nav button
├── str-combat-designer.html       ← new: the animation studio page
├── js/str-combat-designer.js      ← new: preview engine + knob UI logic
└── css/str-combat-designer.css    ← new: studio layout styles
```

---

## Current Seams (code locations where knobs are needed)

### Seam 1 — Resolution Sequence Timing

**File:** `str-combat-integration.js → _playResolutionSequence()`

The resolution plays a fixed chain of callbacks:

| Step | Current Value | Knob Name | Description |
|------|--------------|-----------|-------------|
| Hand fan slide-away duration | 300 ms | `slideAwayMs` | Time for hand fan to reach NCH capsule |
| First attacker lunge duration | 500 ms | `lungeMs` | Duration of the Pokemon-style lunge animation |
| Stagger between lunges | 100 ms | `lungeStaggerMs` | Delay before second attacker starts |
| Impact pause | 500 ms | `impactPauseMs` | Dramatic beat after lunges before slide-back |
| Hand fan slide-back duration | 300 ms | `slideBackMs` | Time for hand fan to return |

**Seam work required:**
1. Extract the five magic numbers into a `RESOLUTION_TIMING` config object at the top of `str-combat-integration.js`.
2. Add per-enemy-type overrides (keyed by `combatState.enemyType`) so that bosses feel heavier and quick enemies feel snappy:

```javascript
var RESOLUTION_TIMING = {
  _default:  { slideAwayMs: 300, lungeMs: 500, lungeStaggerMs: 100, impactPauseMs: 500, slideBackMs: 300 },
  standard:  { /* inherits _default */ },
  elite:     { lungeMs: 600, impactPauseMs: 650 },
  boss:      { slideAwayMs: 400, lungeMs: 750, lungeStaggerMs: 200, impactPauseMs: 800, slideBackMs: 400 },
  quick:     { slideAwayMs: 200, lungeMs: 350, lungeStaggerMs: 50,  impactPauseMs: 300, slideBackMs: 200 },
  puzzle:    { lungeMs: 450, impactPauseMs: 600 }
};
```

3. Expose a `setResolutionTiming(enemyType, overrides)` function so the designer tool can hot-patch values at runtime.

### Seam 2 — Lunge Animation Parameters

**File:** `str-combat-window.js → playAttackLunge()`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| Lunge distance (Y px) | 38 | `lungePx` | How far the emoji travels toward its opponent |
| Lunge scale | 1.25 | `lungeScale` | Scale multiplier at peak of lunge |
| Lunge easing | `ease-in-out` | `lungeEasing` | CSS easing function |
| Hit flash delay | 175 ms (35%) | `hitFlashDelayPct` | When flash triggers (% of lunge duration) |
| Hit flash duration | 250 ms | `hitFlashMs` | How long the target flashes white |
| Hit shake amplitude | 4 px | `hitShakePx` | Horizontal shake amplitude on hit |

**Seam work required:**
1. Extract into a `LUNGE_PARAMS` config object.
2. Per-enemy-type overrides (boss lunges farther, quick lunges are subtle).
3. Expose `setLungeParams(who, overrides)` for the designer tool.

### Seam 3 — Intent Expression Palette

**File:** `enemy-intent-system.js → FACE_EXPRESSIONS`

The current palette has 13 expressions. Each entry has:

```javascript
{
  glyph: '^_^',           // static display string
  frames: ['^_^', '^___^'], // animation frame array
  name: 'Happy/Calm',
  emotionalState: '...',
  threatLevel: 'low'       // low | medium | high | none
}
```

**Seam work required:**
1. Move `FACE_EXPRESSIONS` from a hardcoded `var` to a `_defaultExpressions` baseline + runtime `_customExpressions` overlay that the designer can populate.
2. Add `registerExpression(key, def)` and `removeExpression(key)` so the designer can add/preview entries from `INTENT_GLYPH_PALETTE.md` without reloading.
3. Add `setFrameRate(ms)` — currently the intent animator cycles frames at 350 ms; expose it.
4. Add per-enemy-type expression sets: a boss might have exclusive glyphs (sniper scope face, table-flip berserk) that standard enemies never show.

### Seam 4 — Weapon Intent Mapping

**File:** `enemy-intent-system.js → WEAPON_INTENTS`

Same pattern as expressions. Each weapon has emoji, name, attackPattern, damageType.

**Seam work required:**
1. Runtime `registerWeaponIntent(key, def)` / `removeWeaponIntent(key)`.
2. Per-enemy-type weapon pools (bosses can wield unique weapons).
3. Add an `animationHint` field (e.g. `'sweep'`, `'thrust'`, `'lob'`) that the lunge animation can use to vary the trajectory (future).

### Seam 5 — Turn Timer Durations

**File:** `str-combat-window.js → TIMER_DURATIONS`

Already keyed by enemy type. Seam work:
1. Expose `setTimerDuration(enemyType, ms)` for designer hot-patching.
2. Expose `getTimerDurations()` for the designer to read current values.
3. Support a `_scaleTimerForFloor` override for playtesting different curves.

### Seam 6 — Countdown Overlay

**File:** `str-combat-window.js → _showCombatCountdown()`

| Parameter | Current Value | Knob Name |
|-----------|--------------|-----------|
| Beat duration | 1000 ms each | `countdownBeatMs` |
| FIGHT! display time | 500 ms | `fightFlashMs` |
| Fade-out time | 400 ms | `countdownFadeMs` |
| Contextual messages | partial impl | `countdownMessages` |

**Seam work:** Extract to `COUNTDOWN_PARAMS`, expose setter, support per-enemy-type contextual messages (already partially implemented via `countdownMessages`).

---

## New Seams — Combat Balance & Boss Mechanics

### Seam 7 — Hit Chance Formula

**File:** `str-combat-engine.js → hit calculation (~line 110)`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| Base hit chance | 70% | `baseHitPct` | Starting accuracy |
| DEX scaling | ×2 per point | `dexScaling` | Per-point DEX difference multiplier |
| Ambush hit bonus | +40% | `ambushHitBonus` | Accuracy boost on ambush |
| Disadvantaged hit penalty | -25% | `disadvHitPenalty` | Accuracy loss when disadvantaged |
| Flanked hit penalty | -25% | `flankedHitPenalty` | Accuracy loss when flanked |
| Melee distance penalty | 0% | `distPenalty.melee` | Distance ≤ 1 tile |
| Close distance penalty | -5% | `distPenalty.close` | Distance 2–3 tiles |
| Mid distance penalty | -15% | `distPenalty.mid` | Distance 4–6 tiles |
| Far distance penalty | -35% | `distPenalty.far` | Distance > 6 tiles |
| Min hit chance | 5% | `hitFloor` | Absolute minimum |
| Max hit chance | 95% | `hitCeiling` | Absolute maximum |

**Seam work required:**
1. Extract into `HIT_CHANCE_CONFIG` object.
2. Per-enemy-type overrides: bosses might have innate accuracy bonuses, quick enemies might have evasion buffs.
3. Per-encounter overrides: a sniper encounter could halve distance penalties; a darkness encounter could double them.
4. Expose `setHitChanceConfig(overrides)` for designer tool.

### Seam 8 — Damage Formula

**File:** `str-combat-engine.js → damage calculation (~line 150)`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| Base damage | 2 | `baseDamage` | Starting damage per hit |
| STR scaling | /2 per point | `strScaling` | Per-point STR difference divisor |
| Ambush damage bonus | +2 | `ambushDmgBonus` | Extra damage on ambush |
| Flanked damage penalty | -1 | `flankedDmgPenalty` | Reduced damage when flanked |
| Critical multiplier | 1.75× | `critMultiplier` | Damage scaling on crit |
| Base crit threshold | 95% | `baseCritThreshold` | Roll needed for crit |
| Ambush crit reduction | -30 | `ambushCritReduction` | Makes crits easier (min 5%) |
| Disadvantaged crit threshold | 98% | `disadvCritThreshold` | Makes crits harder |
| Self-damage threshold | 10% max HP | `selfDmgThreshold` | Maximum self-inflicted damage |
| Enemy explosive reduction | 60% | `enemyExplosiveReduction` | Enemy self-damage dampening |

**Seam work required:**
1. Extract into `DAMAGE_CONFIG` object.
2. Per-enemy-type profiles: boss damage profile could increase `baseDamage` to 3, reduce `critMultiplier` to 1.5× (tanky feel). Quick enemies could have `baseDamage: 1, critMultiplier: 2.5×` (glass cannon).
3. Per-card-type overrides: certain cards could modify the formula (e.g. armor-piercing ignores STR defense).
4. Expose `setDamageConfig(overrides)` for designer tool.

### Seam 9 — Death & Victory Sequences

**File:** `str-combat-window.js → death/victory handlers`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| Camera shake duration | 500 ms | `deathShakeMs` | Screen shake on player death |
| YOU DIED delay | 300 ms | `deathOverlayDelayMs` | Pause before overlay appears |
| Death overlay display | 4000 ms | `deathOverlayMs` | Auto-dismiss timer |
| Vignette fade-out | 600 ms | `deathFadeMs` | Exit animation |
| Victory eye cycling | 120 ms | `victoryEyeCycleMs` | Eye animation frame rate |
| MEDBED HP restore | 50% max HP | `medbedRestorePct` | Respawn HP percentage |

**Seam work required:**
1. Extract into `DEATH_PARAMS` and `VICTORY_PARAMS` config objects.
2. Per-enemy-type overrides: boss kills could have longer dramatic sequences (2× shake, custom overlay message). Quick enemy deaths could skip the dramatic pause entirely.
3. Per-encounter overrides: tutorial death could show a hint instead of YOU DIED. Story-critical defeats could trigger cutscene hooks.
4. Expose `setDeathParams(overrides)` and `setVictoryParams(overrides)`.

### Seam 10 — Floor-Based Timer Scaling

**File:** `str-combat-window.js → _scaleTimerForFloor()`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| T1 tier base | 10000 ms | `tierBase.t1` | Floors 1–10 starting timer |
| T2 tier base | 7000 ms | `tierBase.t2` | Floors 11–22 starting timer |
| T3 tier base | 5000 ms | `tierBase.t3` | Floors 23–30 starting timer |
| T1 floor range | 1–10 | `tierRange.t1` | Floor boundaries |
| T2 floor range | 11–22 | `tierRange.t2` | Floor boundaries |
| T3 floor range | 23–30 | `tierRange.t3` | Floor boundaries |
| Shortening factor | 20% | `tierShortenPct` | Timer reduction across tier |
| Blend ratio | 85% tier / 15% enemy | `blendRatio` | Tier vs enemy-type weight |

**Seam work required:**
1. Extract into `TIMER_SCALING_CONFIG` object.
2. Support arbitrary tier definitions (not just 3 tiers).
3. Per-world overrides: a "nightmare" world config could halve all tier bases. A "practice" world could double them.
4. Expose `setTimerScaling(config)` for designer tool.

### Seam 11 — Information Duel Engine Thresholds

**File:** `information-duel-engine.js → constants`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| Charges per turn | 1 | `chargesPerTurn` | Interaction resource income |
| Escalation payoff threshold | 3 | `escalationPayoff` | Combos needed for payoff |
| Overload eligible threshold | 5 | `overloadEligible` | Minimum for overload state |
| Overload trigger threshold | 7 | `overloadTrigger` | 3-combo chain trigger |
| Momentum decay after overload | 1 | `momentumDecay` | Post-overload reset value |
| AI adaptation interval | 3 turns | `aiAdaptInterval` | Strategy reassessment cadence |
| Mutation stack cap | 3 | `mutationStackCap` | Maximum mutation stacks |
| RAGE damage bonus | +10% per stack | `rageDmgPct` | Per-stack damage multiplier |

**Seam work required:**
1. Extract into `DUEL_ENGINE_CONFIG` object.
2. Per-enemy-type profiles: bosses could have `chargesPerTurn: 2` and `aiAdaptInterval: 2` (faster, more aggressive AI). Puzzle enemies could have `overloadTrigger: 5` (easier to trigger overload for puzzle solving).
3. Per-encounter overrides: tutorial encounters disable mutation entirely. Story encounters could force specific mutation types.
4. Expose `setDuelConfig(overrides)` for designer tool.

### Seam 12 — Expression Selection Heuristics

**File:** `enemy-intent-system.js → expression selection logic`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| Low HP threshold | 25% | `lowHpPct` | CONFUSED expression trigger |
| Mid-low HP threshold | 50% | `midLowHpPct` | Varies by action type |
| Mid-high HP threshold | 75% | `midHighHpPct` | Varies by action type |
| High awareness | ≥ 80 | `highAwareness` | ANGRY_FOCUSED trigger |
| Mid awareness | 50–79 | `midAwareness` | DETERMINED trigger |
| Low awareness | 20–49 | `lowAwareness` | BORED_WAITING trigger |
| Dormant awareness | < 20 | `dormantAwareness` | HAPPY_CALM trigger |

**Seam work required:**
1. Extract thresholds into `EXPRESSION_HEURISTICS` config.
2. Per-enemy-type expression maps: bosses have unique expressions at each threshold (e.g. `ENRAGED` instead of `CONFUSED` at low HP — bosses get angrier, not confused). Quick enemies might cycle expressions faster.
3. Per-encounter overrides: stealth encounters could restrict expressions to low-threat only until detection.
4. Expose `setExpressionHeuristics(overrides)` for designer tool.

### Seam 13 — Ground Effect Combat Modifiers

**File:** `ground-effects-system.js → combat modifier constants`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| Fire/Oil player damage | 10% max HP | `firePlayerDmgPct` | Per-tick fire damage to player |
| Fire/Oil enemy damage | 15% max HP | `fireEnemyDmgPct` | Per-tick fire damage to enemy |
| Water evasion penalty | -10% | `waterEvasionPenalty` | Standing in water |
| Electrified water evasion | -20% | `elecWaterEvasionPenalty` | Standing in electrified water |
| Electrified duration | 6000 ms | `electrifyDurationMs` | How long water stays electrified |
| Ice accuracy penalty | -12% | `iceAccuracyPenalty` | Standing on ice |
| Ice evasion penalty | -2 pts | `iceEvasionPenalty` | Standing on ice |
| Industrial waste debuff | 30% chance | `wasteDebuffChance` | Chance per tick |
| Water slowdown anim | 1000 ms | `waterSlowdownMs` | Visual slowdown effect |

**Seam work required:**
1. Extract into `GROUND_EFFECT_COMBAT_CONFIG` object.
2. Per-encounter overrides: an "inferno" boss could double fire damage. An "ice cave" encounter could make ice penalties 2×.
3. Per-card overrides: certain cards could grant ground effect immunity.
4. Expose `setGroundEffectConfig(overrides)` for designer tool.

### Seam 14 — Card Transparency & Fan Layout

**File:** `hand-fan-component.js → lifecycle opacity values`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| Consumable opacity | 15% | `opacity.consumable` | LIFE_001 cards |
| Exhaust opacity | 35% | `opacity.exhaust` | LIFE_002 cards |
| Power opacity | 55% | `opacity.power` | LIFE_003 cards |
| Gated opacity | 45% | `opacity.gated` | LIFE_004 cards |
| Core opacity | 85% | `opacity.core` | LIFE_005 cards |
| Max visible cards | 5 | `maxVisibleCards` | Fan card limit |
| Card overlap | 30% | `cardOverlapPct` | Fan layout overlap |
| Hold-to-target threshold | 180 ms | `holdTargetMs` | Press-and-hold duration |

**Seam work required:**
1. Extract into `HAND_FAN_CONFIG` object.
2. Per-encounter overrides: a "fog of war" encounter could reduce all opacities by 50%. A "clarity" buff could set all to 100%.
3. Expose `setHandFanConfig(overrides)` for designer tool.

### Seam 15 — Backup Action Container

**File:** `backup-action-container.js → slot configuration`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| Total slots | 6 | `totalSlots` | 5 cards + 1 action |
| Visible backup cards | 5 | `visibleBackupCards` | Cards shown in container |
| Drag ghost (combat) | 60×84 px | `combatGhostSize` | Ghost dimensions |
| Drag ghost (NCH) | 48×64 px | `nchGhostSize` | Ghost dimensions |
| Ghost opacity | 0.85 | `ghostOpacity` | Drag ghost transparency |
| Minimize delay | 1500 ms | `minimizeDelayMs` | Long-drag auto-minimize |
| NCH margin detection | 80 px | `nchMarginPx` | Edge detection distance |

**Seam work required:**
1. Extract into `BACKUP_ACTION_CONFIG` object.
2. Per-enemy-type overrides: boss encounters could grant extra slots. Quick encounters could restrict to 3.
3. Expose `setBackupActionConfig(overrides)` for designer tool.

### Seam 16 — Advantage Determination

**File:** `str-combat-engine.js / gone-rogue.js → advantage calculation`

| Parameter | Current Value | Knob Name | Description |
|-----------|--------------|-----------|-------------|
| Ambush detection range | (varies) | `ambushRange` | Tiles for ambush check |
| Flank angle threshold | (varies) | `flankAngle` | Degrees for flank detection |
| Stealth-to-ambush threshold | (varies) | `stealthAmbushMin` | Min stealth for ambush |

**Seam work required:**
1. Document and extract advantage determination logic into `ADVANTAGE_CONFIG`.
2. Per-enemy-type overrides: bosses could be immune to ambush. Quick enemies could always be flanked from behind.
3. Per-encounter overrides: a "darkness" encounter could guarantee ambush for both sides.
4. Expose `setAdvantageConfig(overrides)` for designer tool.

---

## Boss Encounter Override System

Bosses require dramatic departures from standard combat feel. The override system layers configs:

```
Base defaults (RESOLUTION_TIMING._default, DAMAGE_CONFIG._default, etc.)
  ↓ merge
Enemy-type profile (boss, elite, quick, puzzle, standard)
  ↓ merge
Named encounter profile ("The Warden", "Rat King", "Puzzle Guardian")
  ↓ merge
Floor-specific overrides (floor 10 mid-boss, floor 30 final boss)
  ↓ merge
Runtime designer hot-patches (from STR Combat Designer tool)
```

### Example: Boss Profile — "The Warden"

```javascript
var WARDEN_PROFILE = {
  // Resolution timing — slow, heavy, cinematic
  resolution: {
    slideAwayMs: 400,
    lungeMs: 750,
    lungeStaggerMs: 200,
    impactPauseMs: 800,
    slideBackMs: 400
  },

  // Lunge — big, dramatic movements
  lunge: {
    lungePx: 60,
    lungeScale: 1.4,
    lungeEasing: 'cubic-bezier(0.2, 0, 0.8, 1)',
    hitFlashMs: 350,
    hitShakePx: 8
  },

  // Timer — generous but tense
  timer: {
    baseDuration: 3500,
    warningPct: 0.40,
    bounceIntervalMs: 2500
  },

  // Combat math — tanky, punishing
  hitChance: {
    baseHitPct: 60,
    ambushHitBonus: 20    // harder to ambush
  },
  damage: {
    baseDamage: 3,
    critMultiplier: 1.5,  // tanky: less crit spike
    ambushCritReduction: -15  // harder to crit from ambush
  },

  // Intent — exclusive boss expressions
  expressions: {
    WARDEN_GLARE:   { glyph: '⊙_⊙', frames: ['⊙_⊙', '⊙__⊙'], threatLevel: 'high' },
    WARDEN_RAGE:    { glyph: '╬(▔皿▔)', frames: ['╬(▔皿▔)', '╬(▔益▔)'], threatLevel: 'high' },
    WARDEN_PLEASED: { glyph: '¬‿¬', frames: ['¬‿¬', '¬_¬'], threatLevel: 'medium' }
  },
  expressionHeuristics: {
    lowHpPct: 25,
    lowHpExpression: 'WARDEN_RAGE'  // gets angrier, not confused
  },

  // Weapons — unique boss weapons
  weapons: {
    WARDEN_MACE:  { emoji: '🔨', attackPattern: 'melee', damageType: 'physical', animationHint: 'sweep' },
    WARDEN_CHAIN: { emoji: '⛓️', attackPattern: 'ranged', damageType: 'physical', animationHint: 'lob' }
  },

  // Duel engine — aggressive AI
  duel: {
    chargesPerTurn: 2,
    aiAdaptInterval: 2,
    mutationStackCap: 5
  },

  // Death sequence — cinematic
  death: {
    deathShakeMs: 1000,
    deathOverlayMs: 6000,
    deathOverlayMessage: 'THE WARDEN FALLS'
  },

  // Victory — epic
  victory: {
    victoryEyeCycleMs: 80,
    lootMethod: 'map_spill',     // vs 'direct_deposit'
    lootMultiplier: 3.0
  }
};
```

### Example: Quick Enemy Profile — "Rat Swarm"

```javascript
var RAT_SWARM_PROFILE = {
  resolution: {
    slideAwayMs: 200, lungeMs: 350, lungeStaggerMs: 50,
    impactPauseMs: 200, slideBackMs: 200
  },
  lunge: {
    lungePx: 20, lungeScale: 1.1, hitFlashMs: 150, hitShakePx: 2
  },
  timer: { baseDuration: 1200 },
  damage: {
    baseDamage: 1, critMultiplier: 2.5  // glass cannon
  },
  duel: {
    chargesPerTurn: 1, aiAdaptInterval: 5  // dumber AI
  },
  death: {
    deathShakeMs: 200, deathOverlayMs: 1500  // quick death
  }
};
```

### Example: Puzzle Encounter Profile — "Puzzle Guardian"

```javascript
var PUZZLE_GUARDIAN_PROFILE = {
  resolution: {
    lungeMs: 450, impactPauseMs: 600
  },
  timer: { baseDuration: 3500 },  // generous thinking time
  hitChance: {
    baseHitPct: 50  // combat is secondary to puzzle
  },
  damage: {
    baseDamage: 1  // non-lethal
  },
  duel: {
    overloadTrigger: 5,  // easier to trigger for puzzle solving
    mutationStackCap: 1  // minimal mutation
  },
  expressions: {
    PUZZLE_THINK: { glyph: '🤔', frames: ['🤔', '💭'], threatLevel: 'none' }
  }
};
```

---

## Designer Tool Phases

### Phase D1 — Config Extraction (code-only, no UI)

Extract all magic numbers into named config objects. Add runtime setters. No portal page yet.

**Deliverables:**
- `RESOLUTION_TIMING` in `str-combat-integration.js`
- `LUNGE_PARAMS` in `str-combat-window.js`
- `COUNTDOWN_PARAMS` in `str-combat-window.js`
- `DEATH_PARAMS` + `VICTORY_PARAMS` in `str-combat-window.js`
- `registerExpression()` / `registerWeaponIntent()` in `enemy-intent-system.js`
- `setTimerDuration()` + `TIMER_SCALING_CONFIG` in `str-combat-window.js`
- `HIT_CHANCE_CONFIG` + `DAMAGE_CONFIG` in `str-combat-engine.js`
- `DUEL_ENGINE_CONFIG` in `information-duel-engine.js`
- `GROUND_EFFECT_COMBAT_CONFIG` in `ground-effects-system.js`
- `HAND_FAN_CONFIG` in `hand-fan-component.js`
- `BACKUP_ACTION_CONFIG` in `backup-action-container.js`

### Phase D2 — Preview Sandbox Page

Create `str-combat-designer.html` with:
- A mock STR combat window (reads real `STRCombatWindow` + `EnemyIntentSystem` via shared JS)
- Dropdown to select enemy type → loads that type's timing profile
- "Play Resolution" button → calls `_playResolutionSequence()` in an isolated preview
- Real-time sliders for each timing knob → calls the runtime setters
- Expression palette grid showing all registered `FACE_EXPRESSIONS` with live animation preview
- "Add from Palette" button → opens `INTENT_GLYPH_PALETTE.md` entries as candidates to register
- **NEW: Combat formula preview** — input attacker/defender stats, see hit chance and damage output in real time
- **NEW: Timer scaling curve** — visual graph showing timer duration vs floor number for each enemy type

### Phase D3 — Unified Designer Integration

- Add `data-designer="str-combat"` button to `unified-designer.html` nav
- Wire iframe to `str-combat-designer.html`
- Add "Export STR Config" to the hub's Export All flow → writes timing + expression overrides into `world.json` or a dedicated `str-combat-config.json`

### Phase D4 — Per-Enemy-Type Profiles

- Designer can create named timing profiles ("Heavy Boss", "Rat Swarm", "Puzzle Guardian")
- Profiles are stored in `enemy-decks.json` or a new `str-combat-profiles.json`
- Runtime: `StrCombatEngine.enterCombat()` looks up the enemy's profile and applies overrides
- Preview: designer selects an enemy from `enemy-cards.json` → sees its full combat animation with that profile
- **NEW: Full profile editing** — all 16 seams editable per profile, with inheritance visualization showing which values are defaults vs overrides

### Phase D5 — Expression Authoring

- In the designer, user can type a kaomoji → see it rendered at the actual pixel size inside the STR window mock
- Set animation frames (comma-separated glyphs), preview the cycle
- Assign threat level, emotional state
- Tag the expression to enemy types / combat events
- "Import from Scratchpad" pulls candidates from `INTENT_GLYPH_PALETTE.md`

### Phase D6 — Boss Encounter Builder (NEW)

- **Boss Profile Editor:** Create/edit named boss profiles with all 16 seam overrides
- **Phase Timeline:** Visual timeline showing the full resolution sequence with adjustable keyframes
- **A/B Preview:** Side-by-side comparison of standard vs boss combat feel
- **Loot Configuration:** Configure loot method (map_spill vs direct_deposit), multiplier, drop table
- **Expression Choreography:** Script expression changes across combat phases (e.g. pleased → angry → enraged as HP drops)
- **Ground Effect Presets:** Configure which ground effects are active for the encounter arena
- **Win/Lose Conditions:** Configure alternative victory conditions (survive N rounds, deal X damage, solve puzzle)

### Phase D7 — Encounter Scripting (NEW)

- **Encounter Script Editor:** Sequence of phases with transition conditions
- **Phase Triggers:** HP thresholds, round numbers, card plays, mutations
- **Mid-fight Config Swaps:** Boss changes profile mid-fight (e.g. phase 2 at 50% HP)
- **Narrative Hooks:** Trigger dialogue, cutscenes, or UI changes at scripted moments
- **Encounter Testing:** Play through scripted encounters in the designer with simulated player input

---

## Data Flow

```
Designer Tool (portal iframe)
  │
  ├─ reads ─→ FACE_EXPRESSIONS, WEAPON_INTENTS, TIMER_DURATIONS,
  │            RESOLUTION_TIMING, LUNGE_PARAMS, COUNTDOWN_PARAMS,
  │            HIT_CHANCE_CONFIG, DAMAGE_CONFIG, DEATH_PARAMS,
  │            VICTORY_PARAMS, TIMER_SCALING_CONFIG, DUEL_ENGINE_CONFIG,
  │            GROUND_EFFECT_COMBAT_CONFIG, HAND_FAN_CONFIG,
  │            BACKUP_ACTION_CONFIG, EXPRESSION_HEURISTICS,
  │            ADVANTAGE_CONFIG
  │
  ├─ writes → runtime overrides via setter functions
  │            (hot-patched in the same JS context via parent.STRCombatWindow etc.)
  │
  └─ exports → str-combat-config.json
                 │
                 ├─ _profiles: { "The Warden": {...}, "Rat Swarm": {...} }
                 ├─ _encounters: { "floor10_boss": {...}, "tutorial_rat": {...} }
                 ├─ _expressions: { custom kaomoji additions }
                 ├─ _weapons: { custom weapon additions }
                 └─ _timerScaling: { tier overrides }
                 │
                 └─ loaded at runtime by str-combat-integration.js init()
                    before first combat encounter
```

---

## File Change Matrix

| File | Phase | Changes |
|------|-------|---------|
| `str-combat-integration.js` | D1 | `RESOLUTION_TIMING` config, `setResolutionTiming()`, per-enemy-type merge in `_playResolutionSequence()` |
| `str-combat-window.js` | D1 | `LUNGE_PARAMS`, `COUNTDOWN_PARAMS`, `DEATH_PARAMS`, `VICTORY_PARAMS`, `TIMER_SCALING_CONFIG`, setters for all |
| `str-combat-engine.js` | D1 | `HIT_CHANCE_CONFIG`, `DAMAGE_CONFIG`, `ADVANTAGE_CONFIG`, setters, per-profile merge in `executeRound()` |
| `enemy-intent-system.js` | D1 | `registerExpression()`, `removeExpression()`, `registerWeaponIntent()`, `setFrameRate()`, `EXPRESSION_HEURISTICS`, `setExpressionHeuristics()` |
| `information-duel-engine.js` | D1 | `DUEL_ENGINE_CONFIG`, `setDuelConfig()` |
| `ground-effects-system.js` | D1 | `GROUND_EFFECT_COMBAT_CONFIG`, `setGroundEffectConfig()` |
| `hand-fan-component.js` | D1 | `HAND_FAN_CONFIG`, `setHandFanConfig()` |
| `backup-action-container.js` | D1 | `BACKUP_ACTION_CONFIG`, `setBackupActionConfig()` |
| `str-combat-designer.html` | D2 | New file: preview sandbox |
| `str-combat-designer.js` | D2 | New file: slider UI + preview logic + formula preview |
| `str-combat-designer.css` | D2 | New file: studio layout |
| `unified-designer.html` | D3 | Add nav button |
| `unified-designer.js` | D3 | Handle new tab |
| `enemy-decks.json` or `str-combat-profiles.json` | D4 | Per-enemy timing profiles + full 16-seam configs |
| `str-combat-encounters.json` | D6 | Boss encounter definitions |
| `INTENT_GLYPH_PALETTE.md` | D5 | Consumed by designer import; may be enriched by designer export |

---

## Complete Knob Inventory (All 16 Seams)

| # | Seam | File | Knob Count | Category |
|---|------|------|------------|----------|
| 1 | Resolution Timing | `str-combat-integration.js` | 5 | Animation |
| 2 | Lunge Parameters | `str-combat-window.js` | 6 | Animation |
| 3 | Intent Expressions | `enemy-intent-system.js` | 13+ entries | Content |
| 4 | Weapon Intents | `enemy-intent-system.js` | 13+ entries | Content |
| 5 | Timer Durations | `str-combat-window.js` | 5 types | Pacing |
| 6 | Countdown Overlay | `str-combat-window.js` | 3 | Animation |
| 7 | Hit Chance Formula | `str-combat-engine.js` | 11 | Balance |
| 8 | Damage Formula | `str-combat-engine.js` | 10 | Balance |
| 9 | Death/Victory | `str-combat-window.js` | 6+2 | Sequence |
| 10 | Timer Scaling | `str-combat-window.js` | 8 | Pacing |
| 11 | Duel Engine | `information-duel-engine.js` | 8 | AI |
| 12 | Expression Heuristics | `enemy-intent-system.js` | 7 | AI/Content |
| 13 | Ground Effects | `ground-effects-system.js` | 9 | Environment |
| 14 | Card Transparency/Fan | `hand-fan-component.js` | 8 | Visual |
| 15 | Backup Actions | `backup-action-container.js` | 7 | Layout |
| 16 | Advantage | `str-combat-engine.js` | 3+ | Balance |

**Total: ~120+ individual knobs** across 10 source files.

---

## Dependencies

- **UNIFIED_DESIGNER_GUIDE.md** — defines the Asset → Map → World pipeline; STR Combat Designer follows the same iframe-tab pattern.
- **INTENT_GLYPH_PALETTE.md** — raw kaomoji scratchpad consumed by Phase D5 expression authoring.
- **STR_COMBAT_UI_README.md** — current system documentation; updated with full architecture specs.
- **ENEMY_INTENT_SYSTEM_GUIDE.md** — intent system internals; expression registration hooks are specified here.
- **INFORMATION_DUEL_ENGINE_STATE_REPORT.md** — duel engine sub-system documentation.
- **ENEMY_NCH_INTERACTION_ROADMAP.md** — enemy interaction and NPC gate mechanics.
- **HAND_FAN_AND_CARD_DEPLOYMENT.md** — card deployment and targeting mechanics.

---

## Success Criteria

A designer should be able to:

1. Open the STR Combat tab in the Unified Designer
2. Select "Boss" enemy type from a dropdown
3. Adjust lunge distance from 38px to 60px with a slider and see the preview update instantly
4. Add a new kaomoji `(ノಠ益ಠ)ノ彡┻━┻` as a "Table-Flip Berserk" expression, tagged to boss enemies only
5. Set the boss resolution sequence to 3.5s total (lunges longer, impact pause longer)
6. Modify the hit chance formula: base 60%, remove ambush bonus, add +15% flanked penalty
7. Configure boss damage profile: base 3, crit 1.5×, no ambush bonus
8. Set boss death sequence to 2× dramatic timing with custom overlay message
9. Configure Information Duel Engine: 2 charges/turn, adaptation every 2 turns, mutation cap 5
10. Set custom ground effect modifiers for a fire-themed boss arena
11. Script a two-phase boss fight: phase 1 (standard profile) → phase 2 at 50% HP (enraged profile)
12. Click "Export" and have the full config land in JSON that the game loads at runtime
13. Enter combat with a boss in-game and see all customizations active without code changes
