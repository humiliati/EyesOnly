# EyesOnly (flapsandseals.com)

**EyesOnly** is the deployed Live ARG / Joint Tactical Training Exercise platform behind **flapsandseals.com**.
It includes:

- **M Console** (`/m`): director console (scenario control, lane grid, event feed, dead drops, ops moderation)
- **Ops UI** (`/ops`): field/ops interface (telemetry, pings, map-first ops dashboard)
- **Gone Rogue**: embedded ASCII stealth roguelike + STR combat
- **Street-Chronicles**: interactive fiction mode (kept separate from Live ARG portal)

## Stack

- Cloudflare Workers + D1 + Durable Objects (ScenarioRoom) + R2
- UI bundles built via **esbuild** (no Vite inside EyesOnly)

## Key architecture decisions (current)

### Account-first identity

- **Account callsign is canonical and immutable**.
- Scenario **actors are account-linked** via `actors.user_id` and should share the account callsign.

### Ops is a scenario-scoped moderator role

- Ops is not a separate identity.
- M grants/revokes ops capability per scenario via `scenario_user_roles`.

### Unified account inventory

- Single account-wide inventory: `user_inventory`.
- Both ARG and Gone Rogue read from the same pool.
- UI should **render instances**, not stacks; internal `quantity>1` is allowed for storage efficiency.

## Dev commands

```sh
npm run typecheck
npm run build:ui       # builds /ops + /m bundles
```

## Useful endpoints (selected)

### Accounts
- `POST /api/user/register`
- `POST /api/user/login`
- `GET /api/user/me`
- `GET /api/user/inventory`
- `GET /api/user/inventory/instances` (instance view; quantity expanded)
- `POST /api/user/inventory/consume` (oldest-first selector supported)
- `POST /api/user/merge-local-data` (import legacy localStorage once per device)

### M (director)
- `POST /api/m/login`
- `GET /api/m/events/:scenarioId`
- `POST /api/m/event`
- `POST /api/m/dead-drop`
- `DELETE /api/m/dead-drop/:id`
- `POST /api/m/inventory/grant` (GRANT dead drop items into account inventory; idempotent)
- `POST /api/m/scenario/user-role` (grant/revoke ops)
- `GET /api/m/scenario/user-roles/:scenarioId?role=ops`

### Ops
- `GET /api/ops/status`
- `GET /api/ops/pings`
- `POST /api/ops/ack`
- `POST /api/ops/telemetry`
- `POST /api/ops/telemetry/visibility` (hide GPS from other ops, not from M)
- `GET /api/ops/actors/positions?team=red` (requires ops moderator role)
- `POST /api/ops/dead-drop` (retrieve emits event with items; M can GRANT)

## Audio Pipeline

167 audio assets (SFX + music) live on R2 (`eyesonly-assets` bucket), transcoded to Opus/WebM with MP3 fallback. The pipeline consists of:

- **`AudioSystem`** (`public/js/audio-system.js`): singleton — `play(key)`, `playMusic(key)`, `playRandom(base, count)`, global `data-sound` attribute delegate
- **Audio manifest** (`public/audio/audio-manifest.json`): 167-entry registry across 8 categories (ui, movement, combat, magic, environment, collectible, creature, music)
- **R2 serving** (`src/worker/routes/audio.ts`): `GET /audio/sfx/*`, `GET /audio/music/*` with Range support, CORS, immutable caching
- **Upload API** (`src/worker/routes/audio-upload.ts`): `POST /api/audio/upload` for Media Designer portal
- **Audio controls widget** (`public/js/audio-controls-widget.js`): debrief feed header UI for master/music/SFX volume
- **Transcode** (`scripts/transcode-audio.sh`): WAV → Opus/WebM (96k SFX, 128k music) + MP3 fallback via ffmpeg
- **Upload** (`scripts/upload-audio-to-r2.sh`): batch R2 uploader

See `docs/AUDIO_WIRING_ROADMAP.md` for the full wiring plan.

## Designer Portals

The designer portals live in `public/portal/` and are accessible via the unified designer (`/portal/unified-designer.html`).

### Media Designer (`/portal/sound-designer.html`)

Full-featured media workstation portal for managing audio and video assets (formerly Sound Designer):

- **Media Library** — Uploaded Videos appear first (fetched dynamically from R2), followed by 524+ sounds baked as static HTML across 30 categories, with search filtering. Works offline (no manifest fetch required).
- **Preview** — Selecting any asset auto-switches to the Preview tab and begins playback. Audio uses streaming `<audio>` with live waveform visualization (AnalyserNode). Videos use an inline `<video>` player.
- **Assignment** — Drag/assign sounds to game entities (assets, maps, interiors) with per-context event grids.
- **Inspector** — Metadata editor for display name, category, volume, loop, tags. Shows all current assignments for the selected asset.
- **Upload** — Drag-and-drop upload to R2 with queue management, progress tracking, and destination routing (sfx/music/video).
- **Export** — Export `sound-assignments.json` mapping file for integration with game systems.

The portal works both when served by the worker (`https://flapsandseals.com/portal/sound-designer.html`) and when opened directly from disk (`file://`). When opened locally, all fetch URLs are rebased to `https://flapsandseals.com` automatically.

## Notes

- `README.txt` contains the longer-form lore/feature overview.

---

## Gone Rogue — Module Index

All modules live in `public/js/` and follow the IIFE delegate pattern (`var Module = (function(){ ... })();`). The monolith `gone-rogue.js` wires them together via context-builder functions that inject state and callbacks. Modules are loaded as plain `<script>` tags — no bundler, no ES modules.

**162 modules** across `public/js/`, `public/js/ui/`, `public/js/utils/`, and `public/js/terminal/`.

### Core Engine & State Management

| Module | Description |
|--------|-------------|
| `gone-rogue.js` | Monolith — closure state, context builders, delegation stubs, public API (~3,538 lines) |
| `gamestate.js` | Global game state controller — manages transitions between Street Chronicles and Gone Rogue |
| `game-loop.js` | RequestAnimationFrame loop with start/stop/pause and perf instrumentation |
| `game-tick-system.js` | Per-tick update: movement, enemies, projectiles, ground effects, lighting |
| `game-state-api.js` | Headless state queries (getState, getGrid, resetToState, spawnTestPets) |
| `begin-gameplay-system.js` | Kicks off floor generation, game loop, and UI after onboarding |
| `run-start-system.js` | Run initialization: seed setup, system inits, onboarding flow, charm bonuses |
| `state-machine.js` | ARG state machine — manages game mode transitions and event handling |
| `pancake-stack.js` | Stacked game state singleton |
| `save-load.js` | Save and load game state to localStorage / cloud |
| `gone-rogue-data-registry.js` | Loads JSON registries for items, cards, statuses, ground effects, synergies, buildings |
| `gone-rogue-effect-interpreter.js` | Data-first translation layer for item/card effect definitions |

### Floor Generation & Layout

| Module | Description |
|--------|-------------|
| `floor-generator.js` | Grid creation, room generation, biome visuals, entity spawning (high-level orchestrator) |
| `floor-gen-core.js` | Core floor generation pipeline — cleanup, init, room placement, corridor connection |
| `floor-transition-system.js` | Floor advance/retreat/interior-exit with fade transitions |
| `tutorial-floor-gen.js` | Contrived tutorial floor generation from authored layouts (floors 1–3) |
| `tutorial-floors.js` | Tutorial floor registry — authored ASCII maps and spawn data |
| `biome-config.js` | Floor type determination and biome selection (weighted by depth) |
| `biome-visuals.js` | Biome visual state ownership — visual grid, background colors, tile render objects |
| `biome-gate-system.js` | Tutorial gate placement with pity timers and weighted probability |
| `secret-floors.js` | Secret floor system for hidden content discovery |
| `interior-floor-system.js` | Entering interior floors (tavern, basement, etc.) |
| `interior-floors.js` | Interior floor configuration registry and authored layout storage |
| `catacombs-generator.js` | Procedural dungeon generator for church catacombs side-quest |
| `sfc-engine.js` | Sequential Function Chart evaluation engine for world graph traversal |

### Player & Movement

| Module | Description |
|--------|-------------|
| `player.js` | Player object definition and state |
| `move-player-system.js` | Core player movement — collision detection, tile interactions, grid-step logic |
| `player-action-system.js` | Pickpocket and extraction action handlers |
| `player-interaction-system.js` | Tile-arrival interactions: doors, shops, pickups, food, combat triggers |
| `player-stack-manager.js` | Player stack management singleton |
| `gone-rogue-movement.js` | Smooth continuous movement with A* pathfinding for mobile |
| `tap-move-system.js` | Mobile tap-to-move and fishing-move handlers |
| `stealth-system.js` | Stealth bonus calculation from tiles, darkness, charms, boxes |
| `ropeManager.js` | Rope management — length tracking, anchor points, traversal |
| `box-deployment.js` | Deployable hiding-box placement, entry/exit, enemy interaction |

### Combat — STR (Simultaneous Turn Resolution)

| Module | Description |
|--------|-------------|
| `str-combat-engine.js` | Core STR combat loop — turn resolution, damage, card effects |
| `str-combat-integration.js` | Connects STR engine to UI visuals |
| `str-combat-window.js` | STR combat window component |
| `str-victory-sequence.js` | 5-phase victory animation sequence |
| `str-exit-sequence.js` | Non-victory combat exit sequence (flee, stalemate) |
| `combat-narration-system.js` | 3-beat countdown messages for STR combat entry |
| `combat.js` | Combat state tracking wrapper |
| `information-duel-engine.js` | Information duel mechanics (Phase 5 interrogation combat) |
| `information-duel-hud.js` | Information duel HUD visual layer |

### Card System

| Module | Description |
|--------|-------------|
| `card-system.js` | Card definitions, Diablo-style loot generation, quality/affixes, 35+ cards |
| `card-state-authority.js` | Single source of truth for hand/backup/vault with change events |
| `card-play-system.js` | Card playing logic during STR combat |
| `card-action-system.js` | Maps swipe directions to card actions (attack, stance, utility, discard) |
| `card-disposal-system.js` | Drag-to-debrief card destruction |
| `card-transfer-manager.js` | Cross-container drag & drop (hand, backup, vault, map) |
| `cascade-resolver.js` | Recursive cascade chain resolution for synergy-driven card play |
| `hand-fan-component.js` | Hearthstone-style hand fan display with lifecycle transparency |
| `reserve-slots.js` | Reserve card slot management |
| `zone-manager.js` | Card zone tracking (which container holds which card) |

### Synergy System

| Module | Description |
|--------|-------------|
| `synergy-engine.js` | Core synergy engine — tag matching, combo triggers |
| `synergy-integration.js` | Synergy system integration with game state |
| `synergy-ui.js` | Synergy visual feedback display |
| `tag-synergy-engine.js` | Auto-resolve tag combo system |

### Enemy System

| Module | Description |
|--------|-------------|
| `enemy-ai-system.js` | Enemy patrol, awareness, sight cones, line-of-sight, chase behavior |
| `enemy-deck-hydrator.js` | Attaches card deck and exposed tags to spawned enemies |
| `enemy-hand-display.js` | Displays enemy cards in backup scroll during STR combat |
| `enemy-card-interactability.js` | Determines which enemy cards the player can interact with |
| `enemy-card-interaction-handler.js` | In-combat interactions on enemy joker cards |
| `enemy-intent-system.js` | MGS-inspired tactical communication of enemy intent |
| `enemy-steal-system.js` | Pre-combat pickpocket flow for stealing enemy cards |
| `elite-enemies.js` | Mini-boss encounters based on scaled-down boss mechanics |
| `boss-encounters.js` | Arcade-style boss fights with mythic conditions |

### Items, Inventory & Economy

| Module | Description |
|--------|-------------|
| `world-items.js` | WorldItems manager — item placement, floor items, currencies |
| `interactive-items.js` | Interactive world item system (examine, lore delivery) |
| `item-spawner.js` | Generates and places items on procedural floors |
| `active-item-system.js` | Active item triggers, drag/drop targeting, ground deployment |
| `inventory-management.js` | Stash/retrieve, equip/unequip, consumption logic |
| `inventory-ui.js` | Collectible gallery UI for player inventory |
| `passive-items-system.js` | Passive item effects and stat bonuses |
| `passive-items-ui.js` | Passive items UI display |
| `pickup-system.js` | Item pickup logic — ammo, gems, cards, keys, generic items |
| `food-database.js` | Food items that modify status and resources with auto-pickup |
| `vendor-system.js` | Bonfire vendor, shop, healing, gambling mechanics |
| `shop-system.js` | Commerce system for shops and vendors |
| `cost-printer-system.js` | Cost affordability checks and 3D printer item duplication |
| `key-loot-gen.js` | Key utility functions for weighted rolls and drop generation |
| `loot-table-manager.js` | Loot table generation and drop probability |
| `currency-spawning.js` | Currency spawn, post-combat scatter, magnet auto-collect |

### Environmental Systems

| Module | Description |
|--------|-------------|
| `ground-effects.js` | Environmental hazards: fire, water, oil, ice, electric |
| `ground-effects-system.js` | Tile effect application, water slowdown, electrification, combat modifiers |
| `ground-effect-card-mappings.js` | Designer-configurable card-to-ground-effect mappings |
| `breakable-system.js` | Breakable destruction, loot spawning, light source cleanup |
| `breakable-spawner.js` | Biome-specific breakable prop placement (8–12 per floor) |
| `environmental-synergy.js` | Key-gate interactions and item-object combinations |
| `environmental-drag-drop.js` | Key-to-gate and item-destruction drag mechanics |
| `locked-gate-system.js` | Locked gate interaction and unlocking |
| `npc-gate-system.js` | NPC-triggered gate interactions |
| `vent-system.js` | Vent/passage navigation with success probability |

### Projectiles & Animation

| Module | Description |
|--------|-------------|
| `projectile-system.js` | Projectile creation, movement, collision, cleanup |
| `sprint-trail-system.js` | Visual trail effects for sprint movement |
| `overhead-animator.js` | Floating text, damage numbers, currency pickup animations |
| `tile-animation-system.js` | Tile-level animation for visual feedback |

### Health, Status & Resources

| Module | Description |
|--------|-------------|
| `health-system.js` | Centralized health state for player and enemies |
| `status-effects.js` | Status effect system — stun, poison, burn, bleed, etc. |
| `cooldown-tracker.js` | Multi-level cooldown management (combat, floor, run) |
| `resource-manager.js` | Resource management for ammo, energy, fatigue |
| `pity-system.js` | Pity timer system for guaranteed drops |

### Difficulty & Progression

| Module | Description |
|--------|-------------|
| `awol-difficulty.js` | AWOL button UBER difficulty selector and M-ping surface |
| `discovery-system.js` | Exploration mechanics with discovery tiers and rewards |
| `missions.js` | Mission registry and management |
| `highscore-system.js` | Score calculation and submission at end of run |
| `highscore-state.js` | Highscore state management |
| `highscore-ui.js` | Highscore display UI controller |
| `death-handler.js` | Unified death screen and cause determination |
| `death-exit-system.js` | Player death, enemy death, and run exit handling |

### Rendering & Canvas

| Module | Description |
|--------|-------------|
| `gone-rogue-canvas.js` | High-performance canvas renderer (replaces DOM grid, 10–50× faster) |
| `gone-rogue-mobile.js` | Mobile touch interface — tap-to-move, swipe cards, Metal Gear stealth HUD |
| `rendering-ui.js` | Grid rendering, HUD status display, alert layers |
| `rendering.js` | Rendering state wrapper |
| `lighting-system.js` | Dynamic lighting system — player light, enemy lights, biome ambience |
| `shared-card-renderer.js` | Shared card rendering utilities |
| `expression-database.js` | Expression database — food emojis, thought bubbles, reaction icons |

### HUD & UI Components

| Module | Description |
|--------|-------------|
| `non-combat-hud.js` | Non-combat HUD capsule and resource display |
| `debrief-feed-controller.js` | MOK vs Resource feed display based on game mode |
| `debrief-feed-renderer.js` | Resource display with cycling and status effects |
| `backup-action-container.js` | Left column backup action/item display (6 slots) |
| `rogue-sidebar.js` | 6-slot sidebar for card and item display |
| `ui-controls.js` | Button handlers and inventory management |
| `tooltip-system.js` | Universal tooltip system |
| `tooltip-thumb.js` | Tooltip thumbnail component |
| `drop-zone-detector.js` | Proximity-based drag target detection and visual feedback |
| `commerce-drag-drop-system.js` | Drag-to-debrief buying/selling mechanics |
| `stack-ui-counter.js` | Stack UI counter for HUD display |
| `button.js` | Button class definition |
| `lever.js` | Lever class definition |

### MOK (Mini AI Companion)

| Module | Description |
|--------|-------------|
| `mok-state-machine.js` | MOK state machine — manages mini AI behavior states |
| `mok-animation-cycles.js` | MOK animation cycle definitions |
| `mok-visual-engine.js` | MOK visual rendering engine |
| `mok-ux.js` | Lightweight MOK avatar driver for landing CRT |

### Terminal & Command Systems

| Module | Description |
|--------|-------------|
| `main.js` | Main orchestrator — wires Terminal, Parser, StateMachine together |
| `terminal.js` | Terminal rendering engine (CRT aesthetic) |
| `parser.js` | Command parser for terminal input |
| `command-process-system.js` | Text command dispatcher for keyboard/terminal input |
| `login-shell.js` | Nested login / filesystem shell simulation (ARG content) |
| `login-ui.js` | Login UI for user account management |
| `user-account.js` | User account client |
| `api-client.js` | Thin fetch wrapper connecting terminal to backend |
| `terminal/command-router.js` | Terminal command router for stats, inventory, dev mode |

### UI Screens (`ui/`)

| Module | Description |
|--------|-------------|
| `ui/character-creation.js` | Character creation screen |
| `ui/onboarding-splash.js` | Onboarding splash screen |
| `ui/welcome-back.js` | Welcome back / returning player screen |
| `ui/run-summary.js` | Post-run summary screen |
| `ui/tier-up-announcement.js` | Tier-up announcement dialog |

### Agent & Automation

| Module | Description |
|--------|-------------|
| `agent-integration.js` | Agent testing bridge with UI — natural and developer modes |
| `agent-api-system.js` | Headless agent API (getLegalActions, applyAction) |
| `agent-command-system.js` | AGENT subcommands (natural, developer, stop, pause, report, mode) |
| `playtest-agent.js` | Human-like playtest agent for automated testing |

### Meta & Cross-Mode

| Module | Description |
|--------|-------------|
| `street-chronicles.js` | Street-level chronicles interactive fiction mode |
| `kernel-manager.js` | External kernel manager (agent integration layer) |
| `game.js` | Gone Rogue mode engine wrapper |
| `items.js` | Items module wrapper |
| `pet-follower.js` | Pet follower system for companion mechanics |
| `non-combat-event-bus.js` | Lightweight pub/sub event bus for non-combat events |
| `non-combat-state-store.js` | Non-combat state store with history tracking |

### Utilities

| Module | Description |
|--------|-------------|
| `utils/name-utils.js` | Name generation — ensures internal IDs are never shown to players |
| `seeded-random.js` | Seeded random number generator (LCG) |
| `seeded-rng.js` | Seeded RNG implementation (alternative) |
| `perf-hook.js` | Local performance profiling hook (dev-only) |

### Architecture Notes

All extracted modules follow the **IIFE Delegate Pattern**:

```js
var ModuleName = (function() {
  'use strict';
  function doWork(ctx) {
    // ctx contains state refs + callbacks injected by monolith
  }
  return { doWork: doWork };
})();
```

The monolith (`gone-rogue.js`) owns all mutable state as closure variables and builds **context objects** (ctx) that pass references and setter functions to each module. This avoids cross-file closure capture while keeping the no-build-tool, plain `<script>` tag architecture.

Key conventions:

- `typeof` guards for graceful degradation when modules aren't loaded
- Fallback returns in delegation stubs
- Cache-buster query params on `<script>` tags (`?v=20260302v`)
- State ownership: most modules use ctx injection; `biome-visuals.js` and `game-loop.js` own their own state
