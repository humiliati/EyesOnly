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
| SkiFree | ✅ touch drag+swipe | ✅ sfxMap | ✅ 0.005 rate | ✅ emoji entities | ✅ Schweitzer Descent (Floor 22) BossAdapter wired |
| Frogger | ✅ anchor tap+swipe | ✅ sfxMap | ✅ 0.02 rate | ✅ emoji entities | ✅ Depot Crossing BossAdapter ready |
| Breakout | ✅ touch + mouse | ❌ | ❌ | ❌ | ❌ no boss mapping |
| Snake | ❌ keyboard only | ❌ | ❌ | ❌ | ✅ Data Heist (planned Phase 4) |
| JezzBall | ✅ touch+drag | ✅ sfxMap | ❌ | ❌ CRT grid | ❌ Containment Warden (planned JB-5) |
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

**6. Accessibility.** Per BOSS_DESIGN.md: portrait mode priority, adaptive controller support (sip/blow), U1 (Casual) difficulty achievable without perfect execution.

**7. Tiers ≠ Ubers.** Two distinct difficulty axes exist across the system:

- **Tiers** describe the _progression stages within a single gone-rogue run_. A run moves through biome tiers: early floors are tutorial-level (slow enemies, simple layouts), mid-floors are regular difficulty (full mechanics), and endgame floors are frenzy-level (all mechanics active, dense spawns). Tiers are _not_ a player-selected setting — they are the natural difficulty curve of a playthrough.

- **Ubers** describe the _global challenge level_ selected by the player before starting any session (arcade or gone-rogue). Ubers scale the entire playthrough's baseline difficulty:
  - **U1 CASUAL** — enemies have ×0.9 HP, slower speeds, +1 life, forgiving windows
  - **U2 STANDARD** — baseline tuning (×1.0 everything)
  - **U3 HARD** — enemies have ×1.15 HP, faster speeds, fewer lives, tighter windows

  In arcade games, ubers are selected on the menu screen (swipe ▲▼). In gone-rogue, ubers apply to the entire run and persist per-game via `localStorage('eyesonly_arcade_difficulty')`.

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
| Accessibility | Swipe works with head-tracking or switch scanning. U1 = slow trains, wide safe zones. |

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
| Accessibility | Drag steering works with single-finger or head-tracking. U1 = slow speed, wide gaps. |

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

### 3B. JezzBall → Field Containment Protocol

**Vision**: The most sophisticated JezzBall on the internet. Port gone-rogue's ricochet physics, fireball sprites, and particle FX into a containment-themed arcade game. Balls are escaped test subjects (fireballs) ricocheting off containment walls. Player deploys energy barriers to partition the field and trap them.

**Current bugs** (pre-rewrite):
- Mobile broken: `click` event doesn't fire reliably on touch; no way to choose H/V orientation
- Ball spawning: balls can spawn inside border walls, causing immediate stuck bouncing
- No touch input, no audio, no currency, no difficulty scaling

#### JezzBall Sub-Phases

**JB-0: Hotfix (immediate)**
Fix mobile input and ball spawning on the existing 274-line implementation so it's playable while the full rewrite is planned.

| Fix | Detail |
|-----|--------|
| Mobile input | Replace `click` listener with `pointerdown` (covers touch+mouse). Add tap+drag gesture: short drag determines H/V orientation from drag angle, falls back to last-used direction if tap is < 5px movement. |
| Ball spawn safety | Validate spawn position is in open cell (grid value 0), retry up to 20 times. Minimum 2-cell margin from any wall. |
| Touch direction toggle | Swipe gesture or quick drag angle > 45° from horizontal = vertical; < 45° = horizontal. Visual indicator shows current orientation at touch point. |

**JB-1: ArcadeEngine rewrite**
Rewrite as `ArcadeEngine` subclass (like Frogger). Port to fixed-timestep loop, emoji renderer, HUD, SFX map, currency.

| Feature | Detail |
|---------|--------|
| Base class | `JezzBall.prototype = Object.create(ArcadeEngine.prototype)` |
| Input via ArcadeInput | Tap to place wall origin. Drag angle determines H/V. Double-tap to toggle. |
| Grid system | Upgrade from flat array to 2D typed array for faster flood-fill |
| SFX map | Wall build → `coin-1`, wall break → `kitty-2`, ball bounce → `sq-sq-pickup-success1`, level clear → `toad`, game over → `game-over-1` |
| Currency | `¢ = floor(score × 0.015)` |
| HUD | Level, fill %, lives, direction indicator, currency earned |

**JB-2: Gone-rogue ricochet physics**
Port the ricochet system from `projectile-system.js` for ball movement.

| Feature | Detail |
|---------|--------|
| Velocity normalization | Normalize dx/dy to unit vector × speed (from gone-rogue line 218-220) |
| Axis-aligned bounce | Port wall bounce logic: test X/Y collision independently, flip only the penetrating axis (lines 255-302) |
| Angular deflection | When ball hits a building-in-progress wall tip at an angle, deflect based on approach vector rather than simple axis flip |
| Speed variance | Each ball gets a base speed (1.2-2.5) that increases 5% per level |
| Ball-ball collision | Circle-circle detection (from `ArcadeEngine.collideCircle`), elastic response — balls deflect off each other |
| Sub-step collision | At high speeds, step collision in sub-increments to prevent tunneling through thin walls |

**JB-3: Fireball sprites & particle FX**
Replace plain circles with gone-rogue's fireball sprite assets and add particle effects.

| Asset | Source | Usage |
|-------|--------|-------|
| Fireball moving (7 frames, 80ms) | `assets/fireBallStylOo/.../fireballMoving1-7.png` | Ball idle/moving animation |
| Fireball explosion (5 frames, 60ms) | `assets/fireBallStylOo/.../fireballExplosion1-5.png` | Ball hits building wall (life lost) |
| FX001 smoke poof (5 frames, 60ms) | `assets/Sprites/Smoke/FX001/` | Wall segment destroyed |
| FX002 knockback (8 frames, 40ms) | `assets/Sprites/Smoke/FX002/` | Ball-ball collision spark |
| FX003 light flash (5 frames, 50ms) | `assets/Sprites/LightFX/FX003/` | Wall completes (energy seal) |

| Effect | Detail |
|--------|--------|
| Ball trail | 3-frame ghost trail behind each ball using previous positions at reduced alpha |
| Wall build glow | Building cells pulse phosphor-bright as they extend |
| Wall complete flash | FX003 burst along completed wall line |
| Containment fill | Trapped areas fill with a subtle phosphor wash animation (0 → 0.15 alpha over 300ms) |
| Ball destruction warning | When fill % approaches threshold, remaining balls glow amber then red |

**JB-4: Progressive difficulty & scoring**

| Level | Balls | Speed | Special |
|-------|-------|-------|---------|
| 1 | 2 | 1.2 | Tutorial: arrow shows tap-to-build |
| 2-3 | 3 | 1.4 | Normal bouncing |
| 4-5 | 4 | 1.6 | Balls gain slight homing toward building walls |
| 6-7 | 5 | 1.8 | Ball-ball collisions enabled |
| 8-9 | 6 | 2.0 | "Phantom ball" — one ball is semi-transparent, harder to track |
| 10+ | 6+lvl/3 | 2.0+lvl×0.08 | Speed ramp continues, occasional "splitter" ball that divides on wall hit |

| Scoring | Points |
|---------|--------|
| Wall completed | +50 × wall_length_in_cells |
| Area trapped (no balls) | +200 × percentage_trapped |
| Level clear (≥75%) | +1000 |
| Speed bonus | ×1.5 if cleared in < 30s |
| No-damage bonus | +500 if no walls destroyed this level |

**JB-5: Boss mapping (Containment Warden)**
Create a BossAdapter so JezzBall can be mounted as a gone-rogue boss encounter.

| Feature | Detail |
|---------|--------|
| Boss concept | "Containment Warden" — escaped test subjects (fireballs) in a research facility. Player must contain them before they breach the perimeter. |
| `mount(combatState)` | Spawn balls based on boss HP remaining (more HP = fewer balls to start, HP acts as timer) |
| `getHazards()` | Ball positions as hazard rects for gone-rogue collision pipeline |
| `onMythicCheck()` | Clear level without losing any walls (perfect containment) |
| Boss music | Tense electronic track from Aila Scott collection |
| Damage mapping | `bossHP -= floor(trappedPercentage × 0.8)` — trapping 75% of the field does 60 damage |

**JB-6: Polish & juice**

| Feature | Detail |
|---------|--------|
| Screen shake | Subtle 2px shake when ball hits a building wall (life lost) |
| Slow-motion | 200ms slow-mo when wall completes (dramatic pause) |
| Combo system | Complete multiple walls within 3s = combo multiplier (×2, ×3, ×4) |
| Replay ghost | After game over, show a ghost replay of your best run's wall placements |
| Color themes | Balls tint by speed: green (slow) → amber (medium) → red (fast) |
| Sound design | Per-ball-speed pitch shifting on bounce SFX (faster = higher pitch) |

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
| Uber difficulty | U1 (casual ×0.9), U2 (standard ×1.0), U3 (hard ×1.15) — affects speed, density, lives, enemy HP |
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


### Debugging notes For Ski Free

the way that the map scrolls is somewhat disorienting. we need to look at how these layers pass. the obstacles seem to come from the top while the sides seem to scroll from the bottom. we get the impression that ideal is scrolling the obstacles and sides up from the bottom for a sliding down sensation, the player should start by scrolling in from the top, once centered gain controls, and at the end of the level the pursuer would come to follow from the player's spawn point



we want to use few obstacles at the beginning with an increase in obstacles as the level progresses



we're using the skiier ⛷️ player which works when we're travelling left but should narrow and flip gradually along a sine when the player is carving back and forth.

let's use the same ⛷️ emoji animator for pursuer(s) but with the blvck emoji overlay so they appear as almost black smudges.



player controller needs to accelerate when clicking at the bottom and decelerate when clicking or dragging near the top



we can keep the motorcycle emoji for a possible support npc or the victory condition win state is arriving at the motorcycle, the emojis collide the skiier poofs into a second motorcycle and the two ride off together



we want paint a subtle grey trail behind the player and the pursuers (player trail can be long, pursuers should be resource savvy). we should spawn in the first pursuer somewhat early. the second should spawn in much later.



we have a projectile system from gone-rogue that when in gone-rogue will depend on ammo but in ski free should have infinite ammo for dispatching pursuers (a dispatched pursuer turns into just a blvck.shadow overlay under a breakable's poof sprite animation). a ski free level from arcade will have dozens of progressively stronger pusuers the first few sparse pursuers fall easily against just a single projectile till eventually the player is overwhelmed by level ~15-20 against enemies that take 3-4 projectiles to fell. we want more breakable obstacles on the map that contain collectibles (currency in arcade, all collectibles from loot tables in gone-rogue). 

players should be able to ski BEHIND tree emojis once they've passed the bottom ~15-20 of a row containing obstacles they should be able to carve back and disappear momentarily behind a tree emoji