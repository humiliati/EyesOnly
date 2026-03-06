# STR Combat Window & Hand Fan UI System

## Overview

This implementation provides a Hearthstone-style card display system for STR (Simultaneous Turn Resolution) combat in the Gone Rogue mode. The system consists of three main components:

1. **STR Combat Window** - A minimize/maximize combat popup with timer
2. **Hand Fan Component** - Hearthstone-style card fan with transparency
3. **Integration Layer** - Connects new components with existing combat system

---

## Architecture

### Combat Cycle (Canonical)

The STR combat loop follows this exact sequence:

```
A. Combat starts
   ├─ Pre-combat world mechanics apply (ground effects, ambush detection)
   ├─ Advantage determined (ambush / neutral / disadvantaged / flanked)
   └─ Countdown overlay: 3 → 2 → 1 → FIGHT!

B. Hand fan up, timer counting
   ├─ Player draws 1 optional card from backup deck
   ├─ Player selects cards from equipped hand (tap to toggle)
   ├─ Certain cards/items force timer to zero (e.g. Redneck Obliterator)
   └─ Synergy combos, when fully selected, may also force resolution

C. Timer expires (or forced to zero)

D. Cards slide away (300 ms toward NCH capsule)
   └─ Combat resolves in engine (player cards applied → enemy response)

E. Attack lunges (~1.2 s)
   ├─ First attacker lunge: 500 ms (enemy-first unless player-initiated)
   ├─ 100 ms stagger
   ├─ Second attacker lunge: 500 ms
   └─ Impact flash on advantage indicator

F. Enemy intent system updates
   ├─ Telegraphs enemy next move (expression + weapon change)
   └─ On enemy death: death expression animates

G. Round advances
   └─ Round counter increments, state synced

H. Cards slide back (300 ms)
   └─ Phase resets to 'selecting', timer restarts
   └─ → Return to B (loop)

I. Combat ends
   ├─ Victory: enemy death sequence, loot spill
   └─ Defeat: camera shake → YOU DIED overlay → respawn

J. Post-combat
   ├─ Enemy loot deposits on map or directly to player deck/inventory
   │   (depends on enemy type configuration)
   └─ Ground effects persist or decay per their durations
```

### Phase State Machine

```
idle → countdown → selecting ⇄ resolving → post_resolve → selecting
                                                              ↓
                                                           (combat end)
                                                              ↓
                                                            idle
```

| Phase | Owner | Description |
|-------|-------|-------------|
| `idle` | StrCombatEngine | No active combat |
| `countdown` | StrCombatEngine | 3-2-1-FIGHT overlay playing |
| `selecting` | StrCombatEngine | Player choosing cards, timer running |
| `resolving` | StrCombatEngine | Combat math executing + animation playing |
| `post_resolve` | StrCombatEngine | Brief pause (600 ms) before next round |

**Dual phase variables:**
- `_phase` in `str-combat-engine.js` — authoritative engine phase
- `_strCombatPhase` in `gone-rogue.js` — synced copy via `_syncCombatState()`
- Both kept in sync via `GoneRogue.setStrCombatPhase()` / `StrCombatEngine.setPhase()`

### Module Inventory

| Module | File | Role |
|--------|------|------|
| STR Combat Engine | `str-combat-engine.js` | Phase state machine, hit/damage math, round execution |
| STR Combat Window | `str-combat-window.js` | Visual HUD: HP bars, timer, intent display, lunge anims |
| Hand Fan Component | `hand-fan-component.js` | Hearthstone-style card fan, selection, slide anims |
| Integration Layer | `str-combat-integration.js` | 100 ms poll bridge between engine and UI components |
| Enemy Intent System | `enemy-intent-system.js` | Kaomoji expressions, weapon intents, threat levels |
| Card Play System | `card-play-system.js` | Applies card effects (damage, heal, status, AoE, etc.) |
| Backup Action Container | `backup-action-container.js` | Expendable side-slots during combat |
| Information Duel Engine | `information-duel-engine.js` | Charges, mutation, momentum, escalation, overload, AI |
| Ground Effects System | `ground-effects-system.js` | Environmental tiles: fire, ice, water, electricity |
| Gone Rogue (host) | `gone-rogue.js` | Game state owner, STR combat entry/exit, loot, victory |

### Cross-System Integration Map

```
                    ┌──────────────────────┐
                    │   gone-rogue.js      │
                    │  (game state owner)  │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
   ┌──────────▼──────────┐ ┌──▼───────────┐ ┌──▼──────────────┐
   │ str-combat-engine.js│ │card-play-     │ │information-duel-│
   │ (phase + math)      │ │system.js      │ │engine.js        │
   └──────────┬──────────┘ │(card effects) │ │(AI adaptation)  │
              │            └──────┬────────┘ └────────┬────────┘
              │                   │                   │
   ┌──────────▼──────────────────────────────────────────────┐
   │              str-combat-integration.js                   │
   │              (100 ms poll — UI orchestrator)             │
   └────┬─────────────┬──────────────────┬───────────────────┘
        │             │                  │
   ┌────▼────┐  ┌─────▼──────┐  ┌───────▼────────────┐
   │STRCombat│  │HandFan     │  │BackupAction         │
   │Window   │  │Component   │  │Container            │
   └────┬────┘  └────────────┘  └─────────────────────┘
        │
   ┌────▼──────────┐
   │EnemyIntent    │
   │System         │
   └───────────────┘
```

---

## Combat Formulas

### Hit Chance

```
baseHitChance = 70%

Modifiers:
  + (attacker.dex - defender.dex) * 2     (DEX difference)
  + advantageBonus:
      ambush:        +40%
      neutral:         0%
      disadvantaged: -25%
      flanked:       -25%
  + distancePenalty:
      melee (≤1):     0%
      close (2-3):   -5%
      mid   (4-6):  -15%
      far   (>6):   -35%

Bounds: clamp(5%, 95%)
Distance = Manhattan: |a.x - b.x| + |a.y - b.y|
```

### Critical Hit

```
baseCritThreshold = 95%

Modifiers:
  ambush:        threshold - 30  (min 5%)   → easier crits
  flanked:       threshold = 98%            → harder crits
  disadvantaged: threshold = 98%

Roll ≥ critThreshold → critical hit
Critical damage multiplier: 1.75×
```

### Damage Calculation

```
baseDamage = 2

Modifiers:
  + (attacker.str - defender.str) / 2    (STR difference)
  + ambush bonus:       +2
  + flanked penalty:    -1
  × critical multiplier: 1.75 (if crit)

Self-damage threshold: 10% of max HP
Enemy explosive reduction: 60% (min 1 damage)
```

### Advantage Types

| Advantage | Hit Bonus | Crit Threshold | Damage Mod |
|-----------|-----------|----------------|------------|
| Ambush | +40% | -30 (easier) | +2 |
| Neutral | 0% | 95% | 0 |
| Disadvantaged | -25% | 98% (harder) | 0 |
| Flanked | -25% | 98% (harder) | -1 |

---

## Components

### 1. STR Combat Window (`str-combat-window.js`)

A centered combat popup that displays:
- Enemy and player HP bars
- **Enemy Intent Display** - Face expression + weapon icon
- Advantage indicator (Ambush, Neutral, Disadvantaged, Flanked)
- Round-based timer with enemy-type specific durations
- Minimize/maximize functionality

#### Timer System

| Enemy Type | Base Duration | Scaled Range (floor-adjusted) |
|------------|--------------|-------------------------------|
| Standard | 2000 ms | ~1600–2000 ms |
| Elite | 2500 ms | ~2000–2500 ms |
| Boss | 3000 ms | ~2400–3000 ms |
| Quick (rats, insects) | 1500 ms | ~1200–1500 ms |
| Puzzle | 2800 ms | ~2240–2800 ms |

**Floor-based timer scaling (`_scaleTimerForFloor`):**

| Tier | Floors | Tier Base | Formula |
|------|--------|-----------|---------|
| T1 | 1–10 | 10000 ms | `tierBase * (1 - progress * 0.20)` |
| T2 | 11–22 | 7000 ms | blended: `targetBase * 0.85 + enemyBase * 0.15` |
| T3 | 23–30 | 5000 ms | same blend formula |

Timer updates every 100 ms. Warning color (red) triggers at 30% remaining. Bounce attention animation triggers at 50% remaining, repeats every 3500 ms.

#### Countdown Overlay

| Parameter | Value | Description |
|-----------|-------|-------------|
| Beat duration | 1000 ms each | Per-number display time |
| FIGHT! display | 500 ms | Flash duration |
| Fade-out | 400 ms | Exit animation |
| Total pre-combat | ~3900 ms | Full countdown sequence |

#### Minimization

- Minimize button in header (arrow icon)
- Animates to 48×48px indicator in top-right corner (300 ms transition)
- Red background tint (8% opacity) when minimized
- Bounce animation at 50% timer remaining
- Hover-to-maximize delay: 500 ms
- Tap to maximize immediately

#### Death Screen Sequence

| Step | Timing | Description |
|------|--------|-------------|
| Camera shake | 500 ms | Screen vibration effect |
| YOU DIED delay | 300 ms | Pause before overlay |
| Overlay display | 4000 ms | Auto-dismiss timer |
| Vignette fade-out | 600 ms | Exit animation |

#### Victory Sequence

Eye cycling animation plays at 120 ms interval during victory. MEDBED restores 50% of max HP.

#### Lunge Animation Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Lunge distance | 38 px (Y-axis) | Emoji travel toward opponent |
| Lunge scale | 1.25× | Scale at peak |
| Lunge duration | 500 ms | Full lunge cycle |
| Lunge easing | `ease-in-out` | CSS timing function |
| Impact flash delay | 175 ms (35%) | Flash trigger point |
| Impact flash duration | 250 ms | White brightness flash |
| Hit shake amplitude | 4 px | Horizontal shake on impact |

#### Window Sizing

- Desktop: 500px max width (85% of viewport)
- Mobile: 90-95% of viewport width
- Centered in game window area

#### API

```javascript
STRCombatWindow.init();

STRCombatWindow.show({
  round: 1,
  enemy: {
    emoji: '👾',
    hp: 5,
    maxHp: 5,
    intentState: { /* from EnemyIntentSystem */ }
  },
  player: { hp: 10, maxHp: 10 },
  advantage: 'neutral',
  enemyType: 'standard'
});

STRCombatWindow.hide();
STRCombatWindow.minimize();
STRCombatWindow.maximize();
STRCombatWindow.updateState(newState);
STRCombatWindow.resetTimer('elite');
STRCombatWindow.playAttackLunge(who, done);
STRCombatWindow.flashImpact();

var isMin = STRCombatWindow.isMinimized();
var isVis = STRCombatWindow.isVisible();
```

### 2. Hand Fan Component (`hand-fan-component.js`)

A Hearthstone-style card fan with:
- Radial card arrangement with 30% overlap
- Card transparency based on lifecycle type
- Fan positioning over STR window or bottom of screen
- Card selection, hold-to-target, and animation sequences

#### Configuration Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `_maxVisibleCards` | 5 | Cards shown in fan |
| `_cardOverlapPercent` | 30% | Fan overlap amount |
| `_targeting.holdMs` | 180 ms | Hold duration to enter targeting mode |
| Resize debounce | 120 ms | Orientation change delay |
| Reposition check | 220 ms | Secondary layout pass |

#### Card Transparency (Lifecycle-Based)

| Type | Opacity | Visual Effect | Examples |
|------|---------|---------------|----------|
| Consumable (LIFE_001) | 15% | Almost transparent | Grenade, Emergency Dodge |
| Exhaust (LIFE_002) | 35% | Semi-transparent | Perfect Ambush, Full Block |
| Power (LIFE_003) | 55% | Moderately opaque | Scarface Mode, Ghost Protocol |
| Gated (LIFE_004) | 45% | Semi-opaque | Burst Fire, Tactical Roll |
| Core (LIFE_005) | 85% | Nearly opaque | Basic Attack, Core Stance |

#### Animation Timings

| Animation | Duration | Description |
|-----------|----------|-------------|
| Fan appear | 300 ms | Fade/scale in |
| Fan disappear | 300 ms | Fade/scale out |
| Collapse to mini | 250 ms | Scale to 0.4, opacity 0.6 |
| Slide away | 300 ms | Scale to 0.15, opacity 0.2 (toward NCH) |
| Slide back | 300 ms | Scale from 0.15 back to 1.0 |
| Commit phase | 200 ms | Selected cards lift upward |
| Resolve phase | 800–1500 ms | Cards fly to center and fade |
| Repopulate | 300 ms | New cards fade in (50 ms stagger) |

#### Hold-to-Target Mode

- **Press-and-hold** (180 ms) enters enemy-targeting mode
- Hold lifts the card + shows crosshair cursor
- Dragging outside STR combat window (15% threshold or fast exit) auto-minimizes the window to expose the map
- Release over enemy plays that single card
- Release over `.rogue-cell` deploys ground effect (DOM grid only)
- Release elsewhere cancels
- On release/cancel, STR window restores if it was minimized by the drag
- Tap (< 180 ms) still toggles selection for multi-card commits

#### Display Modes

**Combat Mode:** centered over STR combat window, 90% viewport (max 700px)
**Contextual Mode:** bottom of screen, 90% viewport (max 600px), 40% background dim

#### API

```javascript
HandFanComponent.init();
HandFanComponent.show(cardArray);
HandFanComponent.hide();
HandFanComponent.setMode('combat', 'centered');
HandFanComponent.setMode('combat', 'peripheral');
HandFanComponent.setMode('contextual', 'bottom');
HandFanComponent.updateCards(newCardArray);
HandFanComponent.playSelectedCards();
HandFanComponent.repopulateCards(newCardArray);
HandFanComponent.slideAway(doneCallback);
HandFanComponent.slideBack(doneCallback);

var selected = HandFanComponent.getSelectedCards();      // indices
var selectedIds = HandFanComponent.getSelectedCardIds(); // card IDs
HandFanComponent.clearSelection();
```

### 3. Integration Layer (`str-combat-integration.js`)

Orchestrates UI components by polling engine state every 100 ms.

#### Poll Architecture

```
setInterval(100 ms) → _updateCombatUI()
  │
  ├─ reads GoneRogue.getStrCombatState()
  │    → { phase, active, round, enemy, player, advantage, enemyType,
  │        isResolvingTurn }
  │
  ├─ detects phase transitions via _lastResolvingTurn tracking
  │    → isResolvingTurn: false → true = EDGE DETECTED
  │
  ├─ if edge detected AND !_resolutionAnimRunning:
  │    → _playResolutionSequence()
  │
  └─ otherwise: sync STRCombatWindow + HandFan state
```

#### Resolution Sequence Timeline

```
t=0       HandFan.slideAway()              300 ms
t=300     STRCombatWindow.playAttackLunge() 500 ms  (first attacker)
t=800     100 ms stagger
t=900     STRCombatWindow.playAttackLunge() 500 ms  (second attacker)
t=1400    STRCombatWindow.flashImpact()
t=1400    500 ms dramatic pause (intent system updates visually)
t=1900    HandFan.slideBack()              300 ms
t=2200    Done callback: phase → 'selecting', timer restarts
          ─────
          ~2.2 s total (< 3 s budget)
```

**First attacker determination:** Enemy-first by default. Player-first if `combatState.playerInitiated` is true (synergy combo triggered resolution).

**`_resolutionAnimRunning` flag:** Set `true` during sequence, prevents poll from interfering.

#### Timer Expiry Flow

```
STRCombatWindow._onTimerExpired()
  → GoneRogue.handleStrTimerExpired()
    → str-combat-integration.js handleStrTimerExpired()
      │
      ├─ if cards selected:
      │    HandFan.clearSelection()
      │    GoneRogue.playCardsFromHand(cardIds)  → CardPlaySystem
      │    if combat not ended: GoneRogue.passStrTurn()  → enemy turn
      │
      └─ if no cards:
           GoneRogue.passPlayerTurn()  → skip + enemy turn
      │
      └─ Both paths set phase to 'resolving'
         → 100 ms poll detects edge → _playResolutionSequence()
```

### 4. Enemy Intent System (`enemy-intent-system.js`)

Displays kaomoji face expressions and weapon icons to telegraph enemy actions.

#### Face Expressions (13 built-in)

| Key | Glyph | Frames | Emotional State | Threat Level |
|-----|-------|--------|-----------------|--------------|
| HAPPY_CALM | `^_^` | `^_^`, `^___^` | content | low |
| ANGRY_FOCUSED | `>__<` | `>__<`, `>_<` | aggressive | high |
| SURPRISED | `O_O` | `O_O`, `o_o` | startled | medium |
| DAZED_STUNNED | `X_X` | `X_X`, `x_x` | incapacitated | none |
| ENRAGED | `>:(` | `>:(`, `>:<` | berserk | high |
| BORED_WAITING | `·_·` | `·_·`, `·__·` | passive | low |
| ANNOYED | `¬_¬` | `¬_¬`, `¬__¬` | irritated | medium |
| GREEDY | `$_$` | `$_$`, `$__$` | acquisitive | medium |
| CONFUSED | `@_@` | `@_@`, `@__@` | disoriented | low |
| SLEEPING | `-_-` | `-_-`, `-__-` | dormant | none |
| ALERT | `o_o` | `o_o`, `O_O` | watchful | medium |
| PLEASED | `^w^` | `^w^`, `^_ ^` | satisfied | low |
| DETERMINED | `•_•` | `•_•`, `•__•` | focused | high |

#### Expression Selection by HP

| HP Range | Attack | Defense | Special |
|----------|--------|---------|---------|
| < 25% | CONFUSED | CONFUSED | DAZED_STUNNED |
| 25–50% | varies | varies | varies |
| 50–75% | varies | varies | varies |
| > 75% | PLEASED | DETERMINED | ALERT |

#### Expression Selection by Awareness

| Awareness | Expression |
|-----------|------------|
| ≥ 80 | ANGRY_FOCUSED |
| 50–79 | DETERMINED |
| 20–49 | BORED_WAITING |
| < 20 | HAPPY_CALM |

#### Animation Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Frame cadence | 350 ms | Time per animation frame |
| Phase offset formula | `(animSeed % 997) * 17 % 400` | Per-enemy desync |
| Intent update cadence | 250 ms | STR window shimmer refresh |
| Golden shimmer cycle | 3000 ms | `intent-shimmer` CSS animation |

#### Weapon Intents (13 built-in)

Each weapon has: emoji, name, attackPattern (melee/ranged/area), damageType (physical/energy/explosive).

### 5. Backup Action Container (`backup-action-container.js`)

#### Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| Total slots | 6 | 5 cards + 1 action slot |
| Backup deck view | Top 5 cards | Visible in container |
| Combat portrait abbreviation | 4 chars | Mobile portrait mode |
| Items mode abbreviation | 6 chars | Micro abbreviation |
| Drag ghost size (combat) | 60×84 px | Opacity 0.85 |
| Drag ghost size (NCH) | 48×64 px | Opacity 0.85 |
| Minimize delay on long drag | 1500 ms | Auto-minimize threshold |
| Margin detection | 80 px | Distance from NCH edge |
| Resize debounce | 120 ms | Orientation change |

### 6. Information Duel Engine (`information-duel-engine.js`)

#### Sub-Systems

| System | Description |
|--------|-------------|
| Charges | Resource per turn for interactions |
| Mutation | Enemy behavioral shifts (rage, paranoia, adaptation) |
| Momentum | Consecutive action tracking |
| Escalation | Payoff threshold for combo chains |
| Overload | High-combo chain trigger |
| Pipeline | Action queue processing |
| AI Adaptation | Periodic strategy shifts |

#### Thresholds

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_CHARGES_PER_TURN` | 1 | Charges gained each turn |
| `ESCALATION_PAYOFF_THRESHOLD` | 3 | Combos needed for payoff |
| `OVERLOAD_ELIGIBLE_THRESHOLD` | 5 | Minimum for overload |
| `OVERLOAD_TRIGGER_THRESHOLD` | 7 | 3-combo chain trigger |
| `MOMENTUM_DECAY_AFTER_OVERLOAD` | 1 | Reset after overload |
| `AI_ADAPT_INTERVAL` | 3 turns | AI strategy reassessment |
| `mutationStacks` cap | 3 | Maximum mutation stacks |
| RAGE damage bonus | +10% | Per stack multiplier |

### 7. Ground Effects System (`ground-effects-system.js`)

#### Effect Damage & Durations

| Effect | Player Damage | Enemy Damage | Duration |
|--------|--------------|--------------|----------|
| Fire / Ignited Oil | 10% max HP | 15% max HP | Per-tick |
| Electrified Water | — | — | 6000 ms |
| Industrial Waste | — | — | 30% debuff chance |
| Ice | -12% accuracy, -2 evasion | same | While standing |
| Water | -10% evasion | same | While standing |
| Electrified Water | -20% evasion | same | While electrified |

Water slowdown animation: 1000 ms. Electricity spread uses 4-directional BFS.

---

## Card Play System (`card-play-system.js`)

Applies card effects without advancing rounds. Effects include:
- **Damage** — direct HP reduction
- **Heal** — HP restoration
- **Status effects** — stun, burn, poison, bleed (default 1 turn)
- **AoE** — area damage
- **Knockback** — tile displacement
- **Ground effects** — deploy environmental tiles
- **Delayed detonation** — 1-turn fuse explosives
- **Flee** — exit combat
- **Cascade draw** — pull from backup deck (synergy bonus)
- **Energy refund** — synergy-based resource return

Enemy explosive self-damage reduced by 60% (minimum 1).

Pending explosives tick at the start of each STR round.

---

## Resolution Phase Animation

The resolution phase uses a choreographed animation sequence orchestrated by `_playResolutionSequence()` in `str-combat-integration.js`:

```
selecting → resolving edge detected
  │
  ├─ 1. HandFanComponent.slideAway()     300 ms   Fan shrinks toward NCH capsule
  ├─ 2. STRCombatWindow.playAttackLunge() 500 ms   First attacker (Pokemon-style lunge)
  ├─ 3. 100ms stagger
  ├─ 4. STRCombatWindow.playAttackLunge() 500 ms   Second attacker lunge
  ├─ 5. STRCombatWindow.flashImpact()              Impact flash on advantage indicator
  ├─ 6. 500 ms dramatic pause                      Intent system updates visually
  └─ 7. HandFanComponent.slideBack()     300 ms   Fan returns, next card selection begins
                                         ─────
                                         ~2.2 s total (< 3 s budget)
```

### Related Files

| File | Role |
|------|------|
| `str-combat-integration.js` | Orchestrates the full sequence via `_playResolutionSequence()` |
| `hand-fan-component.js` | `slideAway(done)` / `slideBack(done)` — Web Animations API |
| `str-combat-window.js` | `playAttackLunge(who, done)` / `flashImpact()` |
| `str-combat-window.css` | `.str-lunge-hit`, `.str-impact-flash` keyframes |

---

## Quality Tier Colors

| Quality | Color | Hex |
|---------|-------|-----|
| Cracked | Gray | #666 |
| Worn | Light Gray | #999 |
| Standard | White | #fff |
| Fine | Cyan | #4fc3f7 |
| Superior | Yellow | #ffeb3b |
| Elite | Orange | #ff9800 |
| Masterwork | Gold | #ffd700 |
| Near Perfect | Green | #8bc34a |
| Perfect | Purple | #9c27b0 |

---

## Responsive Design

### Desktop (>768px)
- Combat window: 500px width
- Hand fan: 700px max width
- Cards: 120×168px
- Hover effects enabled

### Mobile (≤768px)
- Combat window: 90% viewport width
- Hand fan: 90% viewport width
- Cards: 100×140px
- Touch gestures enabled

### Small Mobile (≤480px)
- Combat window: 95% viewport width
- Hand fan: 95% viewport width
- Cards: 80×112px
- Optimized touch targets (44px minimum)

### Mobile Portrait Abbreviation

When combat UI is minimized/collapsed on mobile portrait, HandFan abbreviates card names (max 4 chars) via `NameUtils.getDisplayName(..., {maxLength})`. Backup Action Container follows the same rule. Auto-updates on orientation change.

---

## Awareness & Detection System

| State | Range | Color | Hex |
|-------|-------|-------|-----|
| Unaware | 0–30 | Green | #00ff00 |
| Suspicious | 31–70 | Orange | #ffaa00 |
| Alerted | 71–100 | Red | #ff0000 |
| Engaged | 100+ | Magenta | #ff00ff |

---

## Game Loop Timing

| Interval | Value | Description |
|----------|-------|-------------|
| Game tick | 100 ms | Main loop (10 Hz) |
| Projectile advance | 150 ms | Projectile movement |
| Light map throttle | Every 5 ticks (~500 ms) | Lighting recalculation |
| STR integration poll | 100 ms | Combat UI sync |
| Timer update | 100 ms | Countdown decrement |

---

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus indicators (2px solid #1cff9b)
- Screen reader announcements for combat state
- High contrast mode support
- Reduced motion support (`prefers-reduced-motion`)
- Color-independent indicators (icons + colors)

## Browser Compatibility

Tested and supported: Chrome/Edge 90+, Firefox 88+, Safari 14+, Mobile Safari (iOS 14+), Chrome Mobile (Android 10+).

Uses modern CSS features: `backdrop-filter`, CSS Grid/Flexbox, CSS Custom Properties, CSS Animations/Transitions.

## File Structure

```
public/
├── js/
│   ├── str-combat-engine.js          # Phase state machine + combat math
│   ├── str-combat-window.js          # Visual HUD component
│   ├── str-combat-integration.js     # 100ms poll bridge
│   ├── hand-fan-component.js         # Card fan component
│   ├── backup-action-container.js    # Expendable side-slots
│   ├── enemy-intent-system.js        # Kaomoji expressions + weapon intents
│   ├── card-play-system.js           # Card effect application
│   ├── information-duel-engine.js    # AI adaptation sub-systems
│   ├── ground-effects-system.js      # Environmental tile effects
│   ├── gone-rogue.js                 # Host game state
│   └── gone-rogue-mobile.js          # Mobile UI layer
├── css/
│   ├── str-combat-window.css         # Combat window styles
│   ├── hand-fan-component.css        # Hand fan styles
│   ├── backup-action-container.css   # Backup container styles
│   └── gone-rogue-mobile.css         # Mobile styles
└── index.html                        # Script includes
```

## Troubleshooting

### Cards not showing in fan
- Check `GAMESTATE.getLooseInventory()` returns cards
- Verify card objects have required properties (name, emoji, lifecycle)

### Window not appearing
- Ensure `GoneRogue.isStrCombatActive()` returns true
- Check `GoneRogue.getStrCombatState()` returns valid state
- Verify integration script loaded after components

### Resolution animation not playing
- Verify `showCombatUI()` preserves `'resolving'` phase (not clobbering to `'selecting'`)
- Check `_resolutionAnimRunning` flag is not stuck true
- Ensure `_lastResolvingTurn` tracking detects the false→true edge

### Timer stuck at 0.0
- Check `handleStrTimerExpired()` is being called
- Verify `passStrTurn()` or `playCardsFromHand()` sets phase to `'resolving'`
- Ensure enemy HP > 0 (combat may have ended)

### Intent not displaying
- Ensure `enemy-intent-system.js` loaded before `str-combat-window.js`
- Verify enemy object has `intentState` property
- Check `EnemyIntentSystem.formatIntentDisplay()` returns valid string

---

## STR Combat Animation Studio (Designer Roadmap)

All timing values, lunge parameters, kaomoji expressions, and weapon intents are identified as **designable seams** in a separate roadmap document.

**See:** [`STR-HUD-DESIGNER-ROADMAP.md`](STR-HUD-DESIGNER-ROADMAP.md)

---

## License

Part of the EYES ONLY // 1977 project.
