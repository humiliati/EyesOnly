# Games Designer Pipeline — Roadmap

## Current Architecture

The platform already has two parallel content systems that a Games Designer would bridge:

**Puzzle Designer Portal** (`/puzzle-designer.html`) — a three-column CRUD editor with category management, code editor, live preview, QR generation, and a publish/archive lifecycle. Puzzles are stored server-side via `/api/ops`, loaded dynamically, and launched through `PuzzlePopup.register()`. Designers paste JS into a textarea, hit save, and it's live.

**Arcade Engine** (`arcade-engine.js`) — a canvas-based game framework providing a 60fps loop, state machine (MENU → PLAYING → PAUSED → GAME_OVER), unified input (tap/swipe/drag/keyboard via `ArcadeInput`), collision helpers, emoji/text rendering, scoring, currency, high scores, and a boss-encounter adapter for the roguelike. Games subclass `ArcadeEngine`, override lifecycle hooks (`onInit`, `onStart`, `onUpdate`, `onDraw`, `onInput`, `onResize`), and export via `instance.asMinigame()`. Six games are hardcoded in `minigame-modal.js`'s `GAMES` registry and wired to buttons in `games.html`.

The gap: puzzles have a designer pipeline; arcade games don't. Every arcade game is a hand-coded JS file with a hardcoded DOM button and registry entry. There's no way for a designer to create, test, or deploy a new arcade game without touching three files and redeploying.

---

## What the Games Designer Pipeline Needs

### Phase 1 — Dynamic Game Registry ✅

**Goal:** Decouple the game list from hardcoded HTML/JS so new games can appear without editing `games.html` or `minigame-modal.js`.

**Status: IMPLEMENTED**

1. **`MinigameModal.register(gameId, getterFn)`** — Public method on `MinigameModal` that pushes into the `GAMES` map at runtime. The six built-in games still register at load time; designer games register when their dynamically-loaded script executes.

2. **`MinigameModal.getRegisteredIds()`** — Returns all registered game IDs for dynamic grid rendering.

3. **Dynamic arcade grid in `games.html`** — After static tile wiring, `injectDynamicArcadeTiles()` queries `getRegisteredIds()`, creates `<button>` tiles for any IDs not already in the grid, wires click → `MinigameModal.open(id)`, and updates the game count badge.

4. **Self-registration pattern** — New games drop a JS file that creates an ArcadeEngine subclass, instantiates it, and calls `MinigameModal.register('game-id', function () { return instance.asMinigame(); })`. The dynamic grid picks it up automatically.

---

### Phase 2 — Game Designer Portal ✅

**Goal:** Give designers the same edit-preview-publish workflow that puzzles have, but for ArcadeEngine games.

**Status: IMPLEMENTED** — All four features landed in `puzzle-designer.html` (frontend-only, no DB migration; game metadata stored as JSON in existing `tag_class` field).

1. **Content-type toggle** ✅ — PUZZLE / GAME toggle at top of editor. Swaps form fields, labels, templates, and preview mode. Type filter in the left list (ALL / PUZZLES / GAMES) with type badges.

2. **Game blank template** ✅ — `BLANK_GAME_TEMPLATE` constant: complete ArcadeEngine subclass scaffold with constructor, prototype chain, all lifecycle hooks, and MinigameModal.register() call. Inserted when designer clicks "+ NEW GAME".

3. **Live canvas preview** ✅ — Canvas element in preview pane with PLAY / STOP / RESTART controls. `startGamePreview()` evaluates game code, intercepts `MinigameModal.register()` to capture the instance, starts it on the preview canvas. `stopGamePreview()` tears down cleanly.

4. **Validation layer** ✅ — 6-point validation before publish: ArcadeEngine.call present, prototype chain set, onDraw defined, onUpdate defined, MinigameModal.register() call, valid gameId. Results rendered as a checklist panel with pass/fail indicators.

**Game metadata storage:** `tag_class` field stores `{ type: 'game', gameId, difficulty }` as JSON. `isGameItem()` / `getGameMeta()` helpers detect type. No DB migration needed.

---

### Phase 3 — Genre Helpers (Optional Modules) ✅ (Core Set)

**Goal:** Let designers build common game types faster by providing pre-built physics/camera/level modules they can import.

These are optional mix-ins, not required. A designer can always write raw `onUpdate`/`onDraw` from scratch.

**Status: 8 MODULES BUILT, 2 GAMES REFACTORED**

| Module | File | Status | Provides |
|--------|------|--------|----------|
| `SideScrollCamera` | `js/lib/side-scroll-camera.js` | ✅ Built + validated | Auto-scroll, speed ramp, parallax, screen shake, world↔screen coords |
| `PlatformPhysics` | `js/lib/platform-physics.js` | ✅ Built + validated | Gravity, jump/double-jump, one-way platforms, friction, nudge, AABB |
| `ParticleEmitter` | `js/lib/particle-emitter.js` | ✅ Built + validated | Burst/stream particles, fade, gravity, integrates with drawEmoji() |
| `WeightedTable` | `js/lib/weighted-table.js` | ✅ Built + validated | Weighted random selection, pickN, pickFiltered, dynamic add/remove |
| `ProjectileSystem` | `js/lib/projectile-system.js` | ✅ Built + validated | Omnidirectional fire, cooldown, trail, collision (circle + AABB), draw |
| `DifficultyRamp` | `js/lib/difficulty-ramp.js` | ✅ Built + validated | Section-based + linear difficulty curves, lerp, scale, easing |
| `ScreenFX` | `js/lib/screen-fx.js` | ✅ Built + validated | Full-screen flash, vignette, fade — extracted from Gone Rogue combat flash |
| `LootDrop` | `js/lib/loot-drop.js` | ✅ Built + validated | Physics scatter, bob, blink-decay, platform collision, auto-collect |
| `TileMap` | — | ⬜ Planned | Grid-based level storage, tile collision, scrolling render |
| `SpriteSheet` | — | ⬜ Planned | Frame-based animation from sprite strip images |
| `EnemyPatrol` | — | ⬜ Planned | Waypoint movement, edge-turn, aggro-chase patterns |

All modules are standalone IIFEs with no dependencies, loaded as `<script>` tags in both `games.html` and `puzzle-designer.html` (for game preview).

**Extraction sources (Gone Rogue → Arcade helpers):**
- `ScreenFX` ← Gone Rogue's `_triggerCombatFlash()` + `StrCombatEngine.triggerCombatFlash()` pattern (CSS class toggle → canvas overlay with fade algebra)
- `LootDrop` ← Gone Rogue's `CurrencySpawning.scatterPostCombatNodes()` pattern (directional scatter, boundary validation, decay timer → physics bounce, platform collision, blink-decay)
- `WeightedTable` ← Ski Free's `OBSTACLE_TABLE` + `pickObstacle()` pattern
- `DifficultyRamp` ← Ski Free's `SECTIONS[]` + `getSection()` pattern
- `ProjectileSystem` ← Ski Free's projectile fire/move/collide/draw lifecycle

**Refactored games:**
- **Goat Runner** — uses all 8 modules: `SideScrollCamera`, `PlatformPhysics`, `ParticleEmitter`, `WeightedTable`, `DifficultyRamp`, `ProjectileSystem`, `ScreenFX`, `LootDrop`. Constructor instantiates all for safe MENU-state rendering.
- **Ski Free** — refactored to use `WeightedTable` (obstacle spawning), `DifficultyRamp` (section system), `ProjectileSystem` (fire/move/collide/draw), `ParticleEmitter` (text/emoji particles). 1108→972 lines (~12% reduction).

**Usage pattern** (validated by both games):
```js
// Inside a designer's game constructor
function MyGame() {
  ArcadeEngine.call(this, { gameId: 'my-game', title: 'MY GAME', lives: 3 });
  this._cam = new SideScrollCamera(400, 300, { speed: 2.0 });
  this._physics = new PlatformPhysics({ gravity: 0.5, jumpForce: -9.0 });
  this._emitter = new ParticleEmitter(200);
  this._bullets = new ProjectileSystem({ speed: 7, range: 500, cooldown: 12 });
  this._ramp = new DifficultyRamp({ sections: [...] });
  this._spawner = new WeightedTable([...]);
}
```

---

### Phase 4 — Community & Sharing

**Goal:** Let designers share games and fork each other's work.

- **Public game gallery** — A `/games/community` page showing all published designer games with play counts and ratings
- **Fork button** — Clone another designer's game source into your own draft
- **Version history** — Store previous code versions so designers can roll back
- **Embed codes** — Generate `<iframe>` snippets for embedding games on external sites

**Estimated effort:** Large. This is a social feature layer and can wait until the pipeline is proven.

---

## Test Game: Goat Runner

A side-scrolling platformer to validate the entire pipeline end-to-end: designer game JS file → self-registration via `MinigameModal.register()` → dynamic arcade tile → plays in MinigameModal cabinet.

### Concept

**Title:** Goat Runner
**Theme:** Eyes Only espionage — player sprints across aladdin-style rooftops, vaulting chasms, tethering poles to control steep descents, collecting intel drops, and reaching the extraction helicopter. A herd of goat followers trails behind, inheriting the player's path.

**Core fantasy:** Fluid downhill momentum. The player is always moving right, gravity pulling them down the roofscape. Tethering a pole slows and steers the descent; vaulting launches over gaps. The goats following behind prove the path was smooth — if they survive, you played well.

### Input Design

The input philosophy maps gesture type to player intent, keeping mobile and desktop equally viable through ArcadeInput's unified event system:

**Drag = Tether (continuous control)**
Touch-and-hold activates the tether. Drag direction controls descent angle; drag length controls braking force. Short drag = fast and risky, long drag = slow and stable. The drag vector is lerped for smoothness so goat followers don't jitter.

**Tap = Vault (discrete commitment)**
Quick tap = small hop. The player commits to an arc — no mid-air steering (except tether reattach, below). On desktop, Space/Up fires the same vault.

**Double-tap = Pole Strike (emergency action)**
Knockback burst that clears nearby obstacles. One use per life — the "oh shit" button. Sparingly available so it stays meaningful.

**Critical transitions:**
- Tether → Vault: release drag + tap within 100ms = vault. Input buffer prevents "I tried to jump but dropped instead."
- Vault → Tether: while airborne, touch + drag = reattach tether. This is the clutch save mechanic.
- Drag always wins after threshold: once drag is detected (>10px, >120ms), lock into tether mode. Micro-jitter deadzone prevents accidental mode switches.

### Entities

| Entity | Emoji | Size | Behavior |
|--------|-------|------|----------|
| Player | 🏃 | 0.8T × 1.0T | Gravity, vault, tether, left/right nudge |
| Rooftop | ▬ (rect) | variable × 0.3T | Static platforms, procedurally spaced |
| Satellite Dish | 📡 | 0.7T × 0.7T | Static obstacle on rooftop, jump over |
| AC Unit | 📦 | 0.6T × 0.6T | Breakable (1 hit), may drop intel |
| Laser Wire | ⚡ | 1.5T × 0.1T | Blinks on/off every 90 frames, duck under |
| Intel Drop | 💼 | 0.5T × 0.5T | Collectible, +200 score |
| Drone | 🛸 | 0.8T × 0.5T | Tracks player X with lag, fires down every 120 frames |
| Helicopter | 🚁 | 1.5T × 1.0T | Level-end extraction point at 5000m |
| Goat | 🐐 | 0.5T × 0.5T | Follows player path via position ring buffer, 6 goats |

### Terrain Generation

Procedural segment system — no hand-designed levels:

```
Segment = {
  platforms: [{ x, w, obstacles: [...] }],
  gap: number,        // gap width before next segment
  difficulty: number  // 0-1, controls obstacle density
}
```

Segments queue and scroll left. Difficulty ramps with distance. Every 2000m a drone spawns. At 5000m the extraction helicopter appears. Camera auto-scrolls right at a constant base speed that accelerates gently with distance.

### Architecture (ArcadeEngine subclass)

```
GoatRunner extends ArcadeEngine
├── _camera        { x, speed, shakeTimer, shakeIntensity }
├── _player        { x, y, vx, vy, w, h, grounded, tethering, canVault }
├── _goats[]       { x, y, delay } — follow player via _posHistory ring buffer
├── _posHistory[]  { x, y } — ring buffer of player positions (last 300 frames)
├── _platforms[]   { x, y, w, h }
├── _obstacles[]   { x, y, w, h, type, hp, active }
├── _collectibles[]{ x, y, type }
├── _enemies[]     { x, y, type, hp, fireTimer }
├── _projectiles[] { x, y, vx, vy }
├── _particles[]   { x, y, text, life, vx, vy }
├── _distance      number (score basis)
├── _difficulty     number (0-1, ramps with distance)
│
├── onStart()      → reset all state, seed initial platforms
├── onInput()      → vault (tap), tether (drag), strike (doubletap), duck (keyaction:down)
├── onUpdate(dt)   → camera scroll, gravity, tether physics, platform collision,
│                    obstacle collision, enemy AI, goat pathing, segment spawning,
│                    extraction check, difficulty ramp
├── onDraw(ctx)    → parallax BG, platforms, obstacles, collectibles,
│                    goats, player, enemies, projectiles, particles, HUD
└── onResize()     → recalc camera viewport
```

### Visual Style

CRT phosphor aesthetic matching the existing arcade cabinet:
- Dark background (#060808) with parallax city silhouette layers in phosphor-dim green
- Platforms rendered as solid rects with phosphor border glow
- Player and enemies drawn with `drawEmoji()` + glow
- Goats drawn with `drawEmoji()` at reduced alpha, trailing behind
- HUD: distance counter, lives, intel count — same layout as ski-free
- Screen shake on hit, particle burst on collectible pickup

### Implementation Sprints

**Sprint 1 — Pipeline plumbing (Phase 1)** ✅
- `MinigameModal.register()` method
- Dynamic arcade grid rendering
- Self-registration pattern validated

**Sprint 2 — Platformer core** ✅
- `GoatRunner` ArcadeEngine subclass (`/public/js/minigames/goat-runner.js`)
- Camera scrolling + parallax background (via `SideScrollCamera`)
- Gravity + vault + tether physics (via `PlatformPhysics`)
- Procedural platform generation with gap scaling
- Platform collision (land on top, block sides)
- Goat followers via position history ring buffer
- Wire into `games.html` script loading
- Fixed constructor crash: all state pre-initialized for safe MENU-state rendering
- Refactored to use all three Phase 3 core modules
- *Delivered: player can run, vault, and tether across procedural rooftops with goat followers*

**Sprint 2.5 — Genre helpers + refactors (Phase 3)** ✅
- Built 6 genre helper modules (see Phase 3 table above)
- Refactored Goat Runner → `SideScrollCamera` + `PlatformPhysics` + `ParticleEmitter`
- Refactored Ski Free → `WeightedTable` + `DifficultyRamp` + `ProjectileSystem` + `ParticleEmitter`
- All modules wired into `games.html` + `puzzle-designer.html`
- *Delivered: reusable module library validated by two production games*

**Sprint 3 — Obstacles + combat** ✅
- Obstacle types: satellite dish (📡), AC unit (📦), laser wire (⚡) — all via `WeightedTable` (`obstacleTable.pick()`)
- Breakable AC units with intel drops, double-obstacle spawning at high difficulty
- Drone enemy tracks player X with lerp, fires downward via `ProjectileSystem` (`this._droneBullets`)
- Player counter-fire on pole strike via `ProjectileSystem` (`this._bullets.fireAt()` at nearest drone)
- Drone→player and player→drone collision via `collideFirst()` module calls
- `DifficultyRamp` 5-section integration: Rooftops → District Edge → Contested Zone → Drone Corridor → Extraction Run
- Section flash HUD (amber text center-screen on threshold crossing), kill count display
- Hit/death/respawn with invulnerability frames
- Removed all hand-rolled `this._projectiles` / `this._difficulty` — fully module-driven
- *Delivered: full gameplay loop with scoring, 21 module integration points, zero stale references*

**Sprint 4 — Polish + extraction** ✅
- Extraction helicopter (🚁) spawns at 4800m, approaches with spotlight beam, hovers at screen right
- 3-phase victory sequence: approach → boarding (player rises, confetti bursts) → fly away → GAME_OVER
- Score bonuses on extraction: +5000 base, +1000/life, +500/goat, +300/intel, +200/kill
- Victory overlay with breakdown text ("Extraction +5000 | Lives ×3 | Goats ×4")
- Player invulnerable during boarding/flyaway, normal gameplay paused
- Difficulty ramp tuned: Drone Corridor peak intensified (0.65 obst, 0.008 drone), Extraction Run eased to 4800m
- Landing particle burst (💨) on big falls, shake on heavy impacts
- Drone kill polish: dual burst (💥 + 🔥), screen shake
- Section transition: SFX fanfare + screen shake on zone change
- High score + currency wired via ArcadeEngine's `_onGameOver()` (currencyRate: 0.015)
- *Delivered: shippable game with complete gameplay loop, 1009 lines*

**Sprint 5 — Designer portal (Phase 2)** ✅
- Game/puzzle content-type toggle in puzzle-designer.html
- Game blank template
- Canvas preview in editor with play/stop/restart
- 6-point validation + publish flow
- *Delivered: a non-developer can create and publish a game through the portal*

---

## File Inventory (New + Modified)

| File | Status | Purpose |
|------|--------|---------|
| `public/js/minigame-modal.js` | **Modified** ✅ | `register()` + `getRegisteredIds()` methods |
| `public/games.html` | **Modified** ✅ | Dynamic arcade grid, lib + game script tags |
| `public/js/minigames/goat-runner.js` | **New** ✅ | Goat Runner test game (uses all 8 genre modules) |
| `public/js/minigames/ski-free.js` | **Refactored** ✅ | Uses 4 genre modules (1108→972 lines) |
| `public/js/lib/side-scroll-camera.js` | **New** ✅ | Camera helper module |
| `public/js/lib/platform-physics.js` | **New** ✅ | Gravity/jump/collision module |
| `public/js/lib/particle-emitter.js` | **New** ✅ | Burst/stream particle module |
| `public/js/lib/weighted-table.js` | **New** ✅ | Weighted random selection module |
| `public/js/lib/projectile-system.js` | **New** ✅ | Projectile lifecycle module |
| `public/js/lib/difficulty-ramp.js` | **New** ✅ | Difficulty curve module |
| `public/js/lib/screen-fx.js` | **New** ✅ | Screen flash/vignette/fade module |
| `public/js/lib/loot-drop.js` | **New** ✅ | Physics-based loot scatter module |
| `public/puzzle-designer.html` | **Modified** ✅ | Game/puzzle toggle, canvas preview, validation, lib scripts |
| `server: /api/ops` | **No change** | Game metadata stored in existing `tag_class` field as JSON |

---

## Risk / Open Questions

1. **Code editor limitations** — The puzzle designer uses a plain `<textarea>` for code. For games (which are typically 500+ lines), a proper code editor (CodeMirror/Monaco) would significantly improve the designer experience. Worth adding in Phase 2?

2. **Asset pipeline** — The current games use only emoji and canvas drawing. If designers want sprite sheets or audio, we'd need an asset upload system. Defer until demand exists.

3. **Security** — Designer game code runs in the same page context as the main app. A malicious or buggy game could access localStorage, the DOM, or other globals. Sandboxing options: `<iframe sandbox>` for preview, CSP restrictions for published games. Worth scoping before community sharing (Phase 4).

4. **Mobile performance** — Complex designer games on low-end mobile could degrade. The ArcadeEngine's 600px max canvas width and 60fps cap help, but there's no memory/CPU budget enforcement.

5. **Boss adapter** — Should designer games be mountable as boss encounters in the roguelike? The `onBossMount`/`onBossUnmount`/`onGetHazards` hooks exist in ArcadeEngine but require careful integration. Defer until the pipeline is stable.
