# /games Arcade Revamp Roadmap

> **Status**: Active
> **Effective**: 2026-03-20
> **Depends on**: docs/BOSS_DESIGN.md, docs/BOSS_ENCOUNTER_IDEAS.md

---

## Problem Statement

The six arcade minigames on `/games.html` are bare prototypes. They lack mobile input, audio, currency integration, emoji theming, and scoring persistence. Five of the six map directly to boss encounters planned for gone-rogue — but the current `/games` implementations share zero code with the boss system. Every hour spent polishing a `/games` minigame should produce a reusable module that also powers a boss encounter.

### Current State (audit 2026-03-20)

| Game | Mobile Input | Audio | Currency | Emoji Theme | Boss Mapping |
|------|-------------|-------|----------|-------------|-------------|
| SkiFree | ❌ keyboard only | ❌ | ❌ | ❌ | ✅ Ski Mountain / Infiltration Descent |
| Frogger | ❌ keyboard only | ❌ | ❌ | ❌ | ✅ Depot Crossing / Train Depot |
| Breakout | ✅ touch + mouse | ❌ | ❌ | ❌ | ❌ no boss mapping |
| Snake | ❌ keyboard only | ❌ | ❌ | ❌ | ✅ Data Heist (planned Phase 4) |
| JezzBall | ❌ mouse only | ❌ | ❌ | ❌ | ❌ no boss mapping |
| Minesweeper | ❌ mouse only | ❌ | ❌ | ❌ | ❌ no boss mapping |

### Boss encounters already implemented in gone-rogue STR combat

| Boss | Type | Gone Rogue Status |
|------|------|-------------------|
| Depot Warden | Frogger train lanes | ✅ shipped |
| Gravity Anchor | Asteroids dodge | ✅ shipped |
| Fortress Core | Tower offense | ✅ shipped |
| Ghost Sniper | Patience/camera | ✅ shipped |
| Swarm Tower | Spawn pod destruction | ✅ shipped |
| Bunker Commandant | Whack-a-mole | ✅ shipped |
| Mainframe Core | Node puzzle | ✅ shipped |
| Orbital Carrier | Galaga drone shield | ✅ shipped |

---

## Design Principles

**1. Boss-first development.** Every arcade module refactored on `/games` must export a `BossAdapter` interface so gone-rogue can mount it as a real-time boss encounter (suspending STR combat).

**2. Mobile-native input.** Touch is the primary input. Keyboard and mouse are secondary. Every game must support: tap (discrete action), swipe/drag (directional movement), and double-tap (secondary action). No game should require a physical keyboard.

**3. Emoji sprite system.** All game entities render as emoji characters on a canvas grid, consistent with gone-rogue's visual language. No pixel art, no sprite sheets — emoji are the sprites. The CRT phosphor glow post-process applies uniformly.

**4. Audio from frame one.** Every game action gets a sound: movement, collision, score, death, level-up. Use existing `AudioSystem.playSFX()` hooks. Boss encounters get music via `AudioSystem.playMusic()`.

**5. Currency on score.** Every arcade session awards cryptocurrency (¢) proportional to score. Formula: `¢ = floor(score × GAME_RATE)` where `GAME_RATE` is tuned per game. Currency persists to `localStorage('eyesonly_account')` via `CurrencySystem.award()`.

**6. Accessibility.** Per BOSS_DESIGN.md: portrait mode priority, adaptive controller support (sip/blow), T1 difficulty achievable without perfect execution.

---

## Shared Infrastructure (Phase 0)

Build once, used by all six games and all boss adapters.

### ArcadeEngine base class

```
ArcadeEngine
├── canvas setup (responsive, DPR-aware, max 600px)
├── game loop (RAF with fixed timestep 16.67ms)
├── input layer
│   ├── TouchInput (tap, swipe, drag, double-tap, long-press)
│   ├── KeyboardInput (arrows, WASD, space)
│   └── PointerInput (mouse fallback)
├── emoji renderer (canvas text with glow, scale, rotation)
├── collision (AABB grid, circle, swept)
├── audio bridge (AudioSystem.playSFX / playMusic)
├── score tracker (live score, high score, ¢ conversion)
├── currency bridge (CurrencySystem.award on game over)
├── state machine (MENU → PLAYING → PAUSED → GAME_OVER)
├── HUD overlay (score, lives, level, ¢ earned)
└── BossAdapter interface
    ├── mount(combatState) — enter from STR combat
    ├── unmount() → { result, loot }
    ├── updateRealTime(deltaMs) — called from gone-rogue game loop
    ├── getHazards() → projectile array for collision pipeline
    └── onMythicCheck() → boolean
```

### Files

| File | Role |
|------|------|
| `js/arcade-engine.js` | Base class with loop, input, rendering, audio, scoring |
| `js/arcade-input.js` | Unified touch/keyboard/pointer input with gesture recognition |
| `js/arcade-hud.js` | Score display, lives, level, ¢ ticker, boss health bar |
| `css/arcade-engine.css` | Canvas container, HUD overlay, responsive sizing, CRT glow |

### Touch Input Spec

| Gesture | Detection | Common Use |
|---------|-----------|-----------|
| Tap | `touchstart` → `touchend` < 200ms, < 10px movement | Discrete action (place wall, reveal cell, fire) |
| Swipe | `touchstart` → `touchmove` > 30px in < 300ms | Directional input (move frog, turn snake) |
| Drag | `touchstart` → `touchmove` sustained > 200ms | Continuous position (paddle, aim) |
| Double-tap | Two taps < 300ms apart | Secondary action (toggle direction, use item) |
| Long-press | `touchstart` held > 500ms | Flag (minesweeper), pause |

### Emoji Sprite Palette

Consistent across all games. Each entity type gets a fixed emoji so players recognize patterns across games and boss encounters.

| Entity | Emoji | Used In |
|--------|-------|---------|
| Player | 🕵️ | All |
| Player (skiing) | ⛷️ | SkiFree |
| Player (frog) | 🐸 | Frogger |
| Player (snake head) | 🐍 | Snake |
| Tree | 🌲 | SkiFree |
| Rock | 🪨 | SkiFree |
| Yeti / Pursuer | 🏔️ | SkiFree |
| Train (freight) | 🚂 | Frogger |
| Train (passenger) | 🚃 | Frogger |
| Car | 🚗 | Frogger |
| Log / Safe platform | 🪵 | Frogger |
| Goal / Extraction | 🏁 | Frogger, SkiFree |
| Food / Data packet | 🍎 | Snake |
| Snake body | 🟢 | Snake |
| Antivirus / Pursuer | 🔴 | Snake |
| Wall segment | 🧱 | JezzBall |
| Ball | ⚪ | JezzBall, Breakout |
| Paddle | 🏓 | Breakout |
| Brick (tier 1) | 🟩 | Breakout |
| Brick (tier 2) | 🟨 | Breakout |
| Brick (tier 3) | 🟥 | Breakout |
| Mine | 💣 | Minesweeper |
| Flag | 🚩 | Minesweeper |
| Safe cell | ⬜ | Minesweeper |
| Hidden cell | ⬛ | Minesweeper |
| Coin reward | 🪙 | All (score popup) |

---

## Phase 1: Boss-Priority Games (Frogger + SkiFree)

These two map directly to shipped gone-rogue bosses AND the Phase 2/3 standalone boss minigames from BOSS_DESIGN.md. Refactoring them first gives the highest reuse.

### 1A. Frogger → Depot Crossing Module

**Current**: `js/minigames/frogger.js` — keyboard only, no audio, no currency, basic lane system.

**Target**: Full emoji Frogger with train theming, touch swipe movement, audio, currency, and BossAdapter for Depot Warden encounter.

| Feature | Detail |
|---------|--------|
| Input | Swipe in 4 directions (up/down/left/right). Tap = move one cell in last direction. |
| Entities | 🐸 player, 🚂 freight (fast), 🚃 passenger (stops briefly), 🚗 car, 🪵 safe zone, 🏁 extraction |
| Lanes | 5-7 horizontal lanes, scrolling left/right at varying speeds |
| Audio | Train horn on lane entry, hop SFX on move, splat on death, fanfare on goal |
| Score | +10 per forward hop, +100 per goal slot, +500 level clear |
| Currency | `¢ = floor(score × 0.02)` — ~10¢ per level clear |
| Boss adapter | `mount()` overlays Depot Warden (HP bar, sniper shots from boss position), `getHazards()` returns train collision rects, `onMythicCheck()` checks `TRAIN_IMPACT_KILL` |
| Accessibility | Swipe works with head-tracking or switch scanning. T1 = slow trains, wide safe zones. |

**Deliverables**: `js/minigames/frogger.js` (rewrite), boss adapter methods, audio hooks, currency integration, touch input.

### 1B. SkiFree → Infiltration Descent Module

**Current**: `js/minigames/ski-free.js` — keyboard only, distance-based score, basic obstacle avoidance.

**Target**: Emoji ski descent with yeti pursuit, touch tilt/swipe steering, audio, currency, and BossAdapter for Ski Mountain encounter.

| Feature | Detail |
|---------|--------|
| Input | Drag left/right for steering (continuous). Swipe down = tuck (speed boost). Swipe up = slow. |
| Entities | ⛷️ player, 🌲 trees, 🪨 rocks, 🏔️ yeti pursuer, 🏁 extraction zone |
| Terrain | Procedural vertical scroll, increasing obstacle density + speed |
| Audio | Wind ambient, tree whoosh on near-miss, crash SFX, yeti roar on pursuit, ski scrape |
| Score | Distance-based (1 per frame), speed multiplier, near-miss bonus (+25) |
| Currency | `¢ = floor(distance × 0.005)` — ~5¢ per 1000m |
| Boss adapter | `mount()` activates pursuit + ice physics, `updateRealTime()` spawns obstacles, `getHazards()` returns obstacle rects, `onMythicCheck()` checks escape without damage |
| Accessibility | Drag steering works with single-finger or head-tracking. T1 = slow speed, wide gaps. |

**Deliverables**: `js/minigames/ski-free.js` (rewrite), boss adapter, audio, currency, touch.

---

## Phase 2: Snake → Data Heist Module

Maps to BOSS_DESIGN.md Phase 4 boss and the planned (not yet implemented) Snake boss in gone-rogue.

**Current**: `js/minigames/snake.js` — keyboard only, classic grow-and-avoid.

**Target**: Network topology snake with data collection mechanic, swipe directional control, audio, currency. BossAdapter for Data Heist encounter.

| Feature | Detail |
|---------|--------|
| Input | Swipe in 4 directions to change heading. Tap = boost (move 2 cells). |
| Entities | 🐍 head, 🟢 body segments, 🍎 data packets, 🔴 antivirus pursuers, 🟡 encrypted packets (need processing time) |
| Grid | Network topology with one-way paths and gates |
| Audio | Collect blip, grow SFX, antivirus alert, data crunch on encrypted packet, death static |
| Score | +10 per data packet, +50 per encrypted packet, length bonus at extraction |
| Currency | `¢ = floor(score × 0.015)` |
| Boss adapter | `mount()` activates network grid + pursuers, extraction phase when data quota met |

**Deliverables**: `js/minigames/snake.js` (rewrite), boss adapter, audio, currency, touch.

---

## Phase 3: Non-Boss Games (Breakout, JezzBall, Minesweeper)

These three don't map to boss encounters. They get the shared infrastructure treatment (mobile input, audio, currency, emoji) but no BossAdapter. Lower priority — refactor after boss-mapped games ship.

### 3A. Breakout

**Current**: Only game with touch input (paddle drag). Closest to shippable.

**Refactor scope**: Emoji bricks (🟩🟨🟥), paddle (🏓), ball (⚪). Add audio (bounce, break, death). Add currency. Already has touch — just needs polish and emoji renderer swap.

### 3B. JezzBall

**Current**: Mouse click to place walls. No touch.

**Refactor scope**: Tap to place wall at position, double-tap to toggle direction. Emoji walls (🧱), balls (⚪). Add audio (wall build, wall break, level clear). Add currency.

### 3C. Minesweeper

**Current**: Mouse click to reveal, right-click to flag. No touch.

**Refactor scope**: Tap to reveal, long-press to flag. Emoji mines (💣), flags (🚩), safe cells (⬜), hidden cells (⬛), number cells as colored emoji digits. Add audio (reveal, flag, boom, win fanfare). Add currency (time-based: faster solve = more ¢).

---

## Phase 4: Gone Rogue Boss Integration

Wire the BossAdapter interfaces from Phases 1-2 into the existing boss encounter system. This replaces the current STR-only boss implementations with full minigame sequences that suspend STR combat.

### Integration points

| System | Hook |
|--------|------|
| `boss-encounters.js` | Each boss class gains `launchMinigame()` that mounts the ArcadeEngine module |
| `gone-rogue.js` | `_handleBossEncounter()` checks for minigame-capable boss, calls `launchMinigame()` instead of entering STR |
| `combat-manager.js` | STR paused during minigame, resumes on `unmount()` with result applied to boss HP |
| `minigame-modal.js` | Shared modal hosts both `/games` standalone and boss encounter modes |
| Score → damage | Minigame score maps to boss damage: `bossHP -= floor(score × DAMAGE_RATE)` |
| Mythic conditions | `onMythicCheck()` evaluated at `unmount()`, feeds into existing mythic loot pipeline |

### Boss music

Per AUDIO_WIRING_ROADMAP.md, boss encounters get dedicated music tracks from the Aila Scott collection (14 tracks staged). Each boss type gets a thematic track assignment.

---

## Phase 5: Polish

| Task | Detail |
|------|--------|
| High score persistence | `localStorage('eyesonly_arcade_highscores')` keyed by game ID |
| Leaderboard display | High score table on `/games.html` per game, shows top 10 + player rank |
| Practice mode | Boss-mapped games offer "practice" (no currency) and "ranked" (currency + high score) |
| Difficulty tiers | T1 (accessible), T2 (standard), T3 (hard) — affects speed, density, lives |
| Achievement badges | Tied to score thresholds, displayed on `/games.html` next to game tile |
| CRT post-process | Scanline + phosphor glow shader applied to all arcade canvases |
| Game-over currency animation | 🪙 sprites cascade from score display to currency counter on game end |

---

## Priority Order

```
Phase 0: ArcadeEngine base class + input + audio + currency bridges
    ↓
Phase 1A: Frogger rewrite (boss-mapped, highest reuse)
Phase 1B: SkiFree rewrite (boss-mapped)
    ↓
Phase 2: Snake rewrite (boss-mapped, planned boss)
    ↓
Phase 3A-C: Breakout / JezzBall / Minesweeper (no boss mapping)
    ↓
Phase 4: Gone Rogue BossAdapter wiring
    ↓
Phase 5: Polish, leaderboards, achievements
```

---

## Files Reference

### Existing (to be rewritten)

| File | Lines | Game |
|------|-------|------|
| `js/minigames/frogger.js` | ~400 | Frogger |
| `js/minigames/ski-free.js` | ~350 | SkiFree |
| `js/minigames/snake.js` | ~300 | Snake |
| `js/minigames/breakout.js` | ~450 | Breakout |
| `js/minigames/jezzball.js` | ~400 | JezzBall |
| `js/minigames/minesweeper.js` | ~350 | Minesweeper |

### New (to be created)

| File | Role |
|------|------|
| `js/arcade-engine.js` | Base class: loop, input, rendering, audio, scoring |
| `js/arcade-input.js` | Unified gesture recognition |
| `js/arcade-hud.js` | Score/lives/currency HUD overlay |
| `css/arcade-engine.css` | Canvas, HUD, responsive, CRT glow |

### System files (exist, need hooks)

| File | Integration |
|------|-------------|
| `js/minigame-modal.js` | Already manages canvas modal — add BossAdapter mount/unmount |
| `js/boss-encounters.js` | Add `launchMinigame()` to each boss class |
| `js/gone-rogue.js` | Add minigame branch to `_handleBossEncounter()` |
| `js/audio-system.js` | Already has `playSFX()` / `playMusic()` — just call them |

### Documentation

| File | Topic |
|------|-------|
| `docs/BOSS_DESIGN.md` | 6-boss minigame vision, accessibility, phases |
| `docs/BOSS_ENCOUNTER_IDEAS.md` | 8-boss gone-rogue STR integration |
| `docs/AUDIO_WIRING_ROADMAP.md` | Audio system architecture, boss music staging |
