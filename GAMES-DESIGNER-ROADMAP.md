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

### Phase 2 — Game Designer Portal

**Goal:** Give designers the same edit-preview-publish workflow that puzzles have, but for ArcadeEngine games.

**Approach:** Extend the existing puzzle designer rather than building a separate app. The puzzle designer already has auth, CRUD, categories, code editor, and preview infrastructure.

**Changes:**

1. **Content-type toggle** — Add a PUZZLE / GAME toggle at the top of the editor. When set to GAME, the form shows game-specific fields (gameId slug, icon emoji, subtitle, difficulty tag) and the code editor preloads the game blank template instead of the puzzle template.

2. **Game blank template** — A minimal `ArcadeEngine` subclass scaffold:

```js
// GAME TEMPLATE — Designer fills in the marked sections
window['__GAME_ID__'] = (function () {
  'use strict';

  function MyGame() {
    ArcadeEngine.call(this, {
      gameId: '__GAME_ID__',
      title:  '__TITLE__',
      lives:  3,
      currencyRate: 0.01
    });
  }
  MyGame.prototype = Object.create(ArcadeEngine.prototype);
  MyGame.prototype.constructor = MyGame;

  // ── Setup ──
  MyGame.prototype.onStart = function () {
    // Reset game state here
  };

  // ── Input ──
  MyGame.prototype.onInput = function (type, data) {
    // Handle tap, swipe, drag, keyaction
  };

  // ── Logic (called every frame at 60fps) ──
  MyGame.prototype.onUpdate = function (dt) {
    // Move entities, check collisions, update score
  };

  // ── Render ──
  MyGame.prototype.onDraw = function (ctx, W, H) {
    // Draw with ctx, this.drawEmoji(), this.drawText()
  };

  var instance = new MyGame();
  MinigameModal.register('__GAME_ID__', function () {
    return instance.asMinigame();
  });
  return instance.asMinigame();
})();
```

3. **Live preview** — The puzzle designer's preview pane uses an embedded div. For games, inject a `<canvas>` into the preview pane and call `game.start(canvas)`. Add play/pause/restart controls above the preview. On code save, tear down the old instance and re-evaluate.

4. **Validation layer** — Before publish, lint-check that the code:
   - Calls `ArcadeEngine.call(this, ...)` with a valid `gameId`
   - Defines at minimum `onDraw` and `onUpdate`
   - Calls `MinigameModal.register()` or sets a `window.*Game` global
   - Doesn't reference DOM outside the canvas

**Estimated effort:** Medium. The portal scaffold exists; the game-specific preview (canvas + lifecycle management) is the main new work.

---

### Phase 3 — Genre Helpers (Optional Modules)

**Goal:** Let designers build common game types faster by providing pre-built physics/camera/level modules they can import.

These are optional mix-ins, not required. A designer can always write raw `onUpdate`/`onDraw` from scratch.

| Module | Provides | Use Case |
|--------|----------|----------|
| `SideScrollCamera` | Viewport tracking, parallax layers, screen-edge clamping | Platformers, runners |
| `PlatformPhysics` | Gravity, jump arcs, ground/wall collision, one-way platforms | Platformers |
| `TileMap` | Grid-based level storage, tile collision lookup, scrolling render | Platformers, top-down |
| `SpriteSheet` | Frame-based animation from sprite strip images | Any game with animated characters |
| `EnemyPatrol` | Waypoint movement, edge-turn, aggro-chase patterns | Platformers, action games |
| `ParticleEmitter` | Configurable burst/stream particles | Juice/effects for any genre |

Each module would be a standalone JS file loaded alongside `arcade-engine.js`. Designers reference them in their game code:

```js
// Inside a designer's game
MyGame.prototype.onStart = function () {
  this.camera = new SideScrollCamera(this.logicalW, this.logicalH);
  this.physics = new PlatformPhysics({ gravity: 0.6, jumpForce: -12 });
  this.level = new TileMap(levelData, 32); // 32px tiles
};
```

**Estimated effort:** Each module is 200-400 lines. Build them as needed — the Goat Runner test game (below) would drive the first three.

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

**Sprint 2 — Platformer core** ← CURRENT
- `GoatRunner` ArcadeEngine subclass (`/public/js/minigames/goat-runner.js`)
- Camera scrolling + parallax background
- Gravity + vault + tether physics
- Procedural platform generation with gap scaling
- Platform collision (land on top, block sides)
- Goat followers via position history ring buffer
- Wire into `games.html` script loading
- *Deliverable: player can run, vault, and tether across procedural rooftops with goat followers*

**Sprint 3 — Obstacles + combat**
- Obstacle types (satellite dish, AC unit, laser wire)
- Breakable obstacles with intel drops
- Drone enemy (track X + fire downward)
- Tap-to-aim projectiles (reuse ski-free pattern)
- Hit/death/respawn
- *Deliverable: full gameplay loop with scoring*

**Sprint 4 — Polish + extraction**
- Extraction helicopter at 5000m
- Victory animation
- Difficulty ramp tuning
- Screen shake, particles, SFX mapping
- High score + currency integration
- *Deliverable: shippable game*

**Sprint 5 — Designer portal (Phase 2)**
- Game/puzzle content-type toggle in puzzle-designer.html
- Game blank template
- Canvas preview in editor
- Validation + publish flow
- *Deliverable: a non-developer can create and publish a game through the portal*

---

## File Inventory (New + Modified)

| File | Status | Purpose |
|------|--------|---------|
| `public/js/minigame-modal.js` | **Modified** ✅ | `register()` + `getRegisteredIds()` methods |
| `public/games.html` | **Modified** ✅ | Dynamic arcade grid via `injectDynamicArcadeTiles()` |
| `public/js/minigames/goat-runner.js` | **New** 🔨 | Goat Runner test game |
| `public/js/lib/side-scroll-camera.js` | **New** (Phase 3) | Camera helper module |
| `public/js/lib/platform-physics.js` | **New** (Phase 3) | Gravity/jump/collision module |
| `public/puzzle-designer.html` | **Modify** (Phase 2) | Game/puzzle toggle, canvas preview |
| `public/js/game-template-blank.js` | **New** (Phase 2) | Blank ArcadeEngine subclass template |
| `server: /api/ops` | **Modify** (Phase 2) | Support `type: 'game'` records |

---

## Risk / Open Questions

1. **Code editor limitations** — The puzzle designer uses a plain `<textarea>` for code. For games (which are typically 500+ lines), a proper code editor (CodeMirror/Monaco) would significantly improve the designer experience. Worth adding in Phase 2?

2. **Asset pipeline** — The current games use only emoji and canvas drawing. If designers want sprite sheets or audio, we'd need an asset upload system. Defer until demand exists.

3. **Security** — Designer game code runs in the same page context as the main app. A malicious or buggy game could access localStorage, the DOM, or other globals. Sandboxing options: `<iframe sandbox>` for preview, CSP restrictions for published games. Worth scoping before community sharing (Phase 4).

4. **Mobile performance** — Complex designer games on low-end mobile could degrade. The ArcadeEngine's 600px max canvas width and 60fps cap help, but there's no memory/CPU budget enforcement.

5. **Boss adapter** — Should designer games be mountable as boss encounters in the roguelike? The `onBossMount`/`onBossUnmount`/`onGetHazards` hooks exist in ArcadeEngine but require careful integration. Defer until the pipeline is stable.
