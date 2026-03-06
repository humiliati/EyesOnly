# STR HUD Designer Roadmap

## Purpose

This roadmap identifies the **seams** in the current STR combat system that must be exposed as designer-tunable knobs before we can build an STR Combat Animation Studio inside `public/portal/`. The goal is a visual tool — on par with the Asset, Map, World, Item, and Loot designers — that lets a designer preview, time, and polish every frame of a combat resolution without touching code.

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
3. Add `setFrameRate(ms)` — currently the intent animator cycles frames at a fixed internal rate; expose it.
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

**Seam work:** Extract to `COUNTDOWN_PARAMS`, expose setter, support per-enemy-type contextual messages (already partially implemented via `countdownMessages`).

---

## Designer Tool Phases

### Phase D1 — Config Extraction (code-only, no UI)

Extract all magic numbers into named config objects. Add runtime setters. No portal page yet.

**Deliverables:**
- `RESOLUTION_TIMING` in `str-combat-integration.js`
- `LUNGE_PARAMS` in `str-combat-window.js`
- `COUNTDOWN_PARAMS` in `str-combat-window.js`
- `registerExpression()` / `registerWeaponIntent()` in `enemy-intent-system.js`
- `setTimerDuration()` in `str-combat-window.js`

### Phase D2 — Preview Sandbox Page

Create `str-combat-designer.html` with:
- A mock STR combat window (reads real `STRCombatWindow` + `EnemyIntentSystem` via shared JS)
- Dropdown to select enemy type → loads that type's timing profile
- "Play Resolution" button → calls `_playResolutionSequence()` in an isolated preview
- Real-time sliders for each timing knob → calls the runtime setters
- Expression palette grid showing all registered `FACE_EXPRESSIONS` with live animation preview
- "Add from Palette" button → opens `INTENT_GLYPH_PALETTE.md` entries as candidates to register

### Phase D3 — Unified Designer Integration

- Add `data-designer="str-combat"` button to `unified-designer.html` nav
- Wire iframe to `str-combat-designer.html`
- Add "Export STR Config" to the hub's Export All flow → writes timing + expression overrides into `world.json` or a dedicated `str-combat-config.json`

### Phase D4 — Per-Enemy-Type Profiles

- Designer can create named timing profiles ("Heavy Boss", "Rat Swarm", "Puzzle Guardian")
- Profiles are stored in `enemy-decks.json` or a new `str-combat-profiles.json`
- Runtime: `StrCombatEngine.enterCombat()` looks up the enemy's profile and applies overrides
- Preview: designer selects an enemy from `enemy-cards.json` → sees its full combat animation with that profile

### Phase D5 — Expression Authoring

- In the designer, user can type a kaomoji → see it rendered at the actual pixel size inside the STR window mock
- Set animation frames (comma-separated glyphs), preview the cycle
- Assign threat level, emotional state
- Tag the expression to enemy types / combat events
- "Import from Scratchpad" pulls candidates from `INTENT_GLYPH_PALETTE.md`

---

## Data Flow

```
Designer Tool (portal iframe)
  │
  ├─ reads ─→ FACE_EXPRESSIONS, WEAPON_INTENTS, TIMER_DURATIONS,
  │            RESOLUTION_TIMING, LUNGE_PARAMS, COUNTDOWN_PARAMS
  │
  ├─ writes → runtime overrides via setter functions
  │            (hot-patched in the same JS context via parent.STRCombatWindow etc.)
  │
  └─ exports → str-combat-config.json
                 │
                 └─ loaded at runtime by str-combat-integration.js init()
                    before first combat encounter
```

---

## File Change Matrix

| File | Phase | Changes |
|------|-------|---------|
| `str-combat-integration.js` | D1 | `RESOLUTION_TIMING` config, `setResolutionTiming()`, per-enemy-type merge in `_playResolutionSequence()` |
| `str-combat-window.js` | D1 | `LUNGE_PARAMS`, `COUNTDOWN_PARAMS`, `setLungeParams()`, `setTimerDuration()`, `getTimerDurations()` |
| `enemy-intent-system.js` | D1 | `registerExpression()`, `removeExpression()`, `registerWeaponIntent()`, `setFrameRate()` |
| `str-combat-designer.html` | D2 | New file: preview sandbox |
| `str-combat-designer.js` | D2 | New file: slider UI + preview logic |
| `str-combat-designer.css` | D2 | New file: studio layout |
| `unified-designer.html` | D3 | Add nav button |
| `unified-designer.js` | D3 | Handle new tab |
| `enemy-decks.json` or `str-combat-profiles.json` | D4 | Per-enemy timing profiles |
| `INTENT_GLYPH_PALETTE.md` | D5 | Consumed by designer import; may be enriched by designer export |

---

## Dependencies

- **UNIFIED_DESIGNER_GUIDE.md** — defines the Asset → Map → World pipeline; STR Combat Designer follows the same iframe-tab pattern.
- **INTENT_GLYPH_PALETTE.md** — raw kaomoji scratchpad consumed by Phase D5 expression authoring.
- **STR_COMBAT_UI_README.md** — current system documentation; will be updated to point here.
- **ENEMY_INTENT_SYSTEM_GUIDE.md** — intent system internals; expression registration hooks are specified here.

---

## Success Criteria

A designer should be able to:

1. Open the STR Combat tab in the Unified Designer
2. Select "Boss" enemy type from a dropdown
3. Adjust lunge distance from 38px to 60px with a slider and see the preview update instantly
4. Add a new kaomoji `(ノಠ益ಠ)ノ彡┻━┻` as a "Table-Flip Berserk" expression, tagged to boss enemies only
5. Set the boss resolution sequence to 3.5s total (lunges longer, impact pause longer)
6. Click "Export" and have the config land in a JSON file that the game loads at runtime
7. Enter combat with a boss in-game and see the new timings + expression active without code changes
