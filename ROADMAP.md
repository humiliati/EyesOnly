# EyesOnly Triage Roadmap

Date: 2026-05-01
Status: portfolio salvage and stabilization plan
Primary goal: rewrap the abandoned stakeholder platform into a studio portfolio showcase without pretending the whole product is production-complete.

## Roadmap Index

This index is the working control panel for the roadmap. As this document expands, each phase should keep a short status here and a much deeper phase section below. Update this table whenever a phase changes state, grows new acceptance criteria, or inherits context from older docs.

### Agent Lane Locator

This table exists so an agent can jump directly to its assigned lane without reading the full roadmap. Line numbers are current as of the last index refresh and should be refreshed after large edits.

Refresh command:

```powershell
Select-String -Path ROADMAP.md -Pattern '^## |^### |^#### |^# ' | ForEach-Object { '{0}: {1}' -f $_.LineNumber, $_.Line }
```

| Lane | Current Heading Line | Anchor | Notes For Agents |
|---|---:|---|---|
| Phase 0: Stabilize The Repo | 601 | `### Phase 0: Stabilize The Repo` | Start here for install/build/dev-server/dependency context. Do not chase feature bugs until this phase has a known local baseline. |
| Phase 1: Repair Launch And Demo Paths | 628 | `### Phase 1: Repair Launch And Demo Paths` | Start here for Gone Rogue, AWOL, `/games`, URL, hash, and Street Chronicles launch work. |
| Phase 1A: Terminal And URL Launch Agent | 737 | `#### Phase 1A: Terminal And URL Launch Agent` | Use for terminal command, URL query/hash launches, seed preservation, and launch context. |
| Phase 1B: AWOL Launch Agent | 771 | `#### Phase 1B: AWOL Launch Agent` | Use for AWOL dropdown, seed entry, lazy-loader handoff, and AWOL failure state. |
| Phase 1C: `/games.html` Handoff Agent | 803 | `#### Phase 1C: /games.html Handoff Agent` | Use for the Arcade page launch button and generated Gone Rogue URL. |
| Phase 1D: Street Chronicles Transition Agent | 828 | `#### Phase 1D: Street Chronicles Transition Agent` | Use for Street Chronicles manual/invalid-direction transition into Gone Rogue. |
| Phase 1E: Visible Failure And Demo Exit Agent | 853 | `#### Phase 1E: Visible Failure And Demo Exit Agent` | Use for non-silent launch failure and eventual showcase return hooks. |
| Phase 2: Create Portfolio Wrapper | 991 | `### Phase 2: Create Portfolio Wrapper` | Start here for new showcase route, public copy, and first impression work. |
| Phase 2A: Route And Shell Agent | 1252 | `#### Phase 2A: Route And Shell Agent` | Use for adding `public/showcase.html`, CSS, page shell, and static sections. |
| Phase 2B: Public Copy Agent | 1278 | `#### Phase 2B: Public Copy Agent` | Use for stakeholder-neutral public copy, demo descriptions, and status language. |
| Phase 2C: Systems Map Agent | 1308 | `#### Phase 2C: Systems Map Agent` | Use for the architecture/system map section. |
| Phase 2D: Navigation And Safety Agent | 1339 | `#### Phase 2D: Navigation And Safety Agent` | Use for low-risk links to the showcase route without broad route gating. |
| Phase 3: Curate Demos | 1489 | `### Phase 3: Curate Demos` | Start here for selecting and hardening the three public demos. |
| Phase 4: Archive Or Lab-Gate Unfinished Systems | 1509 | `### Phase 4: Archive Or Lab-Gate Unfinished Systems` | Start here for route inventory, hiding unstable surfaces, and public navigation cleanup. |
| Phase 5: Portfolio Polish | 1527 | `### Phase 5: Portfolio Polish` | Start here for screenshots, diagrams, visual polish, and case-study completeness. |
| Deployment Checklist | 1740 | `## 15. Deployment Checklist` | Use after a phase changes public routes or runtime behavior. |

Status legend:

- `Not started`: no dedicated pass yet.
- `Context pull`: gathering source docs, code paths, screenshots, and known issues.
- `Planning`: scope and acceptance criteria are being written.
- `In progress`: implementation or content work has started.
- `Blocked`: waiting on a decision, dependency, deploy, or missing local capability.
- `Ready for review`: phase is drafted or implemented and needs review.
- `Done`: phase is complete for the current portfolio release.
- `Parked`: intentionally deferred.

| Phase | Current State | Portfolio Purpose | Primary Context To Pull | Immediate Next Action |
|---|---|---|---|---|
| Phase 0: Stabilize The Repo | Not started | Make the project runnable, inspectable, and safe to work on before public wrapping. | `README.md`, `package.json`, `wrangler.jsonc`, current git state, build/typecheck results, deployment assumptions. | Pull detailed context, then write install/dev/build/smoke-test checklist. |
| Phase 1: Repair Launch And Demo Paths | Context pull started | Ensure the best playable surfaces can actually be reached from clean public links. | `public/js/main.js`, `public/js/awol-difficulty.js`, `public/js/gone-rogue-loader.js`, `public/games.html`, `docs/AWOL_LAUNCH_SYSTEM_ROADMAP.md`. | Browser-verify terminal, AWOL, URL, `/games`, and hash launches after local launch fix. |
| Phase 2: Create Portfolio Wrapper | Context pull started | Reframe EyesOnly from stakeholder product to studio systems showcase. | Current homepage, `public/games.html`, `docs/SESSION-SUMMARY-20260318.md`, design/history docs, studio positioning copy. | Decide route name: `/portfolio.html`, `/showcase.html`, or home rewrite. |
| Phase 3: Curate Demos | Not started | Pick the few demos that can make a strong first impression. | Gone Rogue seed paths, QR puzzle pipeline docs, `/games` arcade roadmap, current minigame runtime status. | Choose canonical demo set: Gone Rogue, QR puzzle, one arcade/boss prototype. |
| Phase 4: Archive Or Lab-Gate Unfinished Systems | Not started | Prevent visitors from wandering into broken, stakeholder-specific, or admin-like surfaces. | Public route inventory, test pages, designer portals, M/Ops routes, legacy pages, docs archive. | Build public navigation audit and classify routes as Showcase, Lab, Internal, or Archive. |
| Phase 5: Portfolio Polish | Not started | Make the showcase read as intentional, emotionally coherent, and professionally finished. | Screenshots, architecture diagrams, copy blocks, visual design CSS, mobile screenshots, reuse story for Dungeon Gleaner. | Define final case-study page sections and asset capture list. |
| Cross-Cut A: Product Reframing | Planning | Keep the story honest: abandoned stakeholder product became reusable studio infrastructure. | This roadmap, stakeholder-neutral copy, portfolio positioning. | Refine public-facing language and avoid production-complete claims. |
| Cross-Cut B: Technical Debt Ledger | Context pull started | Track debt without letting it consume the portfolio release. | Load-order issues, naming debt, state persistence, docs drift, test gaps. | Expand each debt item with risk, public impact, and defer/fix decision. |
| Cross-Cut C: Deployment And Safety | Not started | Ensure the deployed showcase is safe, non-destructive, and free of private/stakeholder data. | Cloudflare config, route permissions, auth gates, public APIs, R2 media, D1 demo data. | Identify public mutation routes and decide whether to hide, gate, or demo-stub them. |
| Cross-Cut D: Documentation Source Of Truth | In progress | Keep this root roadmap as the current triage truth while preserving older docs as source material. | `docs/CRITICAL_TODOS_AND_BLOCKERS.md`, `docs/CROSS_ROADMAP_EXECUTION_ORDER.md`, roadmap archive. | Add source notes to each phase as context is pulled in. |

### Expansion Order

We will expand the roadmap in this order:

1. Phase 0: Stabilize The Repo.
2. Phase 1: Repair Launch And Demo Paths.
3. Phase 2: Create Portfolio Wrapper.
4. Phase 3: Curate Demos.
5. Phase 4: Archive Or Lab-Gate Unfinished Systems.
6. Phase 5: Portfolio Polish.
7. Cross-cutting safety, debt, and documentation passes.

Each phase expansion should add:

- Source docs and code paths consulted.
- Current observed state.
- Known broken pieces.
- Decisions needed.
- Concrete tasks.
- Acceptance criteria.
- Demo/public impact.
- Parking lot items.

## 1. Executive Summary

EyesOnly began as a stakeholder-aligned live spy-game platform for flapsandseals.com. It combined a real-time ARG operations stack, browser-based procedural game systems, puzzle tooling, audio/media pipelines, and an embedded roguelike called Gone Rogue. The stakeholder ultimately went in a different direction, but the project contains a wide and unusually reusable body of work.

The correct next move is not to finish every original roadmap. The correct move is to triage the project as a studio systems showcase:

- Preserve the best interactive demos.
- Hide or archive incomplete stakeholder-specific surfaces.
- Stabilize the launch paths.
- Create a clear portfolio wrapper.
- Document what is reusable, what is experimental, and what is intentionally parked.

This roadmap is a root-level, current-state triage document. It does not replace the deeper implementation docs in `docs/`; it distills them into a practical path from abandoned product to portfolio case study.

## 2. Product Reframing

### Original Frame

The original product frame was:

- A live spy-game platform.
- Real-world Sandpoint, Idaho mission routing.
- M director console and Ops field interface.
- Account-linked actors, inventory, pings, telemetry, and dead drops.
- Gone Rogue as embedded training/gameplay.
- Puzzle designer and arcade minigames as supporting systems.

That is too broad and too stakeholder-specific to present as a clean public product now.

### New Frame

The new portfolio frame should be:

> EyesOnly is a studio systems prototype: a browser-native live game toolkit combining operations dashboards, procedural roguelike systems, QR puzzle tooling, arcade experiments, audio/media pipelines, and physical-digital interaction patterns.

The story is not "this is a finished platform." The story is:

- We built a complex, data-rich interactive system.
- We solved many hard design and engineering problems.
- We extracted reusable systems for later work, including Dungeon Gleaner.
- We can now present it as proof of studio capability.

### Suggested Public Label

Use one of these:

- "EyesOnly: Live Game Systems Prototype"
- "EyesOnly: Browser ARG and Procedural Game Toolkit"
- "EyesOnly: Studio Systems Case Study"

Avoid public claims like:

- "Production-ready live spy platform"
- "Fully launched ARG platform"
- "Complete roguelike"
- "Finished multiplayer ops product"

## 3. Current System Inventory

### A. Core Platform

Status: partially complete, too broad for portfolio-first use.

Present in the repo:

- Cloudflare Workers backend.
- D1 migrations.
- Durable Object scenario room.
- R2-backed audio/video routes.
- API routes for users, ops, M mode, puzzles, media, maps, and live scenario features.
- Preact bundles for `/ops` and `/m`.
- Static public app surfaces under `public/`.

Portfolio value:

- Shows full-stack capability.
- Shows Cloudflare-native architecture.
- Shows real-time/live-ops thinking.
- Shows practical data modeling for games.

Risk:

- Auth, inventory, scenario, and kernel persistence are not uniformly complete.
- Public users may enter flows that were designed for a stakeholder deployment rather than a portfolio demo.

Portfolio recommendation:

- Keep as architecture proof.
- Do not make it the first public interaction.
- Show screenshots, diagrams, and a limited demo account path rather than opening every live-ops control surface.

### B. Gone Rogue

Status: rich but unstable as a complete public game.

Present in the repo:

- Large modular roguelike engine.
- Procedural floor generation.
- Tutorial floors and onboarding systems.
- STR combat system.
- Card/loot systems.
- Inventory, pickup, breakables, projectiles, ground effects, keys, vendors, doors, interiors, bosses, audio hooks.
- Mobile-first grid UI and hand/card interfaces.
- Lazy loader for many game modules.

Portfolio value:

- Strongest playable technical proof.
- Shows procedural generation, systems design, UI density, data-driven content, and game-feel work.
- Contains reusable patterns already useful outside the original stakeholder project.

Risk:

- Launch paths recently needed repair.
- Some roadmap systems are partially integrated or stale.
- Heavy module count makes load order fragile.
- UI can expose too much unfinished game economy and account state.

Portfolio recommendation:

- Turn this into one curated seeded demo path.
- Use a "Play Demo Run" button.
- Provide one known-good seed.
- Hide advanced difficulty and account-dependent paths until verified.
- Consider a "systems tour" overlay that labels what the player is seeing.

### C. Games / Arcade

Status: uneven, but useful as a "lab" section.

Present in the repo:

- `/games.html` hybrid paper/CRT layout.
- Arcade engine infrastructure.
- Multiple minigames.
- QR puzzle widgets.
- Some minigames have mobile/audio/currency work.
- Roadmap to reuse arcade games as Gone Rogue boss encounters.

Current audit from existing docs:

- SkiFree: relatively advanced, touch, audio, currency, emoji theme, boss adapter direction.
- Frogger: relatively advanced, touch, audio, currency, emoji theme, boss adapter direction.
- JezzBall: rewritten into ArcadeEngine in docs, closer to reusable.
- Breakout: closer to playable but less integrated.
- Snake: likely underbuilt.
- Minesweeper: likely underbuilt.

Portfolio value:

- Great "experimental arcade lab."
- Shows reuse strategy between standalone minigames and boss encounters.
- Shows rapid prototyping breadth.

Risk:

- Inconsistent polish across games.
- Some games may not work on mobile.
- Currency/highscore persistence may be uneven.

Portfolio recommendation:

- Promote only two or three games.
- Label the rest as "Labs" or hide them.
- Prefer Frogger, SkiFree, and JezzBall for public demos.

### D. QR Puzzle Pipeline

Status: strong portfolio candidate.

Present in the repo:

- Puzzle designer page.
- QR puzzle CRUD and categories.
- QR encoder in Workers.
- Hash router for QR arrivals.
- Cipher wheel, jigsaw, riddle, and custom puzzle loader.
- Printable QR sticker sheet.
- Auth gate and public/live puzzle split.

Portfolio value:

- Very clear physical-digital demo.
- Easy to explain.
- Less dependent on the large Gone Rogue state machine.
- Useful for studio services: scavenger hunts, exhibits, live events, tabletop campaigns.

Risk:

- Designer auth and API dependencies need a clean demo path.
- Public puzzle examples need curation.

Portfolio recommendation:

- Make this one of the three main demos.
- Provide public sample puzzles that do not require login.
- Show the designer as screenshots or a gated demo.

### E. Media / Audio Designer

Status: strong systems proof, likely not first-play demo.

Present in the repo:

- AudioSystem.
- Audio manifest.
- R2 audio/video route support.
- Media designer portal.
- Assignment and inspector concepts.
- Upload/export flow.

Portfolio value:

- Demonstrates tooling, asset workflow, and live content pipeline.
- Strong for clients who need custom interactive media systems.

Risk:

- Upload/admin flows require deployed credentials and safe access.
- Large asset library may be noisy.

Portfolio recommendation:

- Include as a case study panel.
- Show screenshots or a local-only demo.
- Avoid public upload unless hardened.

### F. Live Ops: M Console and Ops UI

Status: architecturally valuable, not portfolio-entry safe.

Present in the repo:

- M mode.
- Ops UI.
- Scenario events.
- Ping/ack/telemetry concepts.
- Dead drops.
- Role grants.
- Actor/account linkage.
- Durable Object broadcast patterns.

Portfolio value:

- Shows live-event architecture and operational thinking.
- Strong differentiator for the studio.

Risk:

- Too stakeholder-specific.
- Sensitive if it implies an active real-world operation.
- Needs safe demo data and no accidental production controls.

Portfolio recommendation:

- Convert into "Live Ops Dashboard Demo" with seeded fake scenario data.
- Do not expose real admin flows as the primary public demo.
- Consider screenshots plus architecture diagram for the first version.

## 4. Roadmap Status Summary

This summary consolidates the deeper roadmap docs into a portfolio triage view.

### Completed Or Mostly Complete

- Core Cloudflare project structure.
- Static public app and hybrid visual treatment.
- Puzzle designer and QR puzzle runtime.
- Audio route and AudioSystem architecture.
- Gone Rogue modular extraction across many systems.
- AWOL dropdown/pause concept mostly implemented.
- Card hand harmonization steps 1-4 according to roadmap docs.
- Item pipeline phases 1-5 according to roadmap docs.
- Explosive breakables phases 1-3 according to roadmap docs.
- Overhead animation phases 1-2 according to roadmap docs.
- Several boss encounter concepts implemented in Gone Rogue.
- Arcade layout and some minigame refactors.

### Partially Complete

- Gone Rogue as a polished public game.
- Account and inventory unification.
- Highscore attribution.
- Kernel/agent persistence.
- M/Ops production workflow.
- Designer portal family.
- World-building engine tiers.
- Arcade-to-boss adapter reuse.
- AWOL seed and launch behavior.
- Mobile UX across every game surface.

### Not Started Or Design-Only

- Enemy NCH interaction roadmap.
- Full STR HUD designer.
- Full world-building engine tier execution.
- Full rope system beyond early module rewrite.
- Complete public portfolio wrapper.
- Safe demo-data mode across live-ops surfaces.

## 5. Obvious Broken Or Risky Areas

This section should be treated as the stabilization checklist.

### Launch And Routing

Risk:

- Gone Rogue had multiple launch paths: terminal command, AWOL dropdown, `/games.html` launch button, URL query deep-link, Street Chronicles transition.
- These paths were not all using the same loader and context pipeline.

Recent local status:

- The intended fix is to route AWOL and URL launches through the lazy loader before calling Gone Rogue.
- `/?rogue=1&seed=...` should be consumed on the home page and converted into a real run context.
- Seed and difficulty should survive into run initialization instead of being overwritten by random seed setup.

Next verification:

- Test on localhost with browser devtools.
- Test on deployed `flapsandseals.com` after deploy.
- Confirm `/games.html` button opens home and starts Gone Rogue.
- Confirm terminal `ROGUE` still works.
- Confirm AWOL launch still works on mobile.

### Dependency And Build Health

Risk:

- Local `npm run typecheck` may fail if dependencies are not installed.
- Some public JS is plain script-tag IIFE code and will not be covered well by TypeScript.

Immediate checks:

- Run `npm install`.
- Run `npm run typecheck`.
- Run `npm run build:ui`.
- Run a static JS syntax check across critical public scripts.

Portfolio recommendation:

- Add a `demo:check` script that covers the portfolio routes specifically.

### Docs Drift

Risk:

- Roadmap docs were written over time and do not perfectly match current code.
- Some docs say systems are missing even though modules now load.
- Some docs say phases are complete but public UX may still be broken.

Immediate action:

- Keep root `ROADMAP.md` as the current triage truth.
- Move older docs into `docs/archive/` only when they are superseded.
- Add "source of truth" notes at the top of stale docs if needed.

### Account, Inventory, And Persistence

Risk:

- Account creation exists but the system still has uneven cloud/local merge and consume paths.
- Inventory is shared across ARG and Gone Rogue but not fully standardized.
- Highscore attribution is still risky without complete account/kernel integration.

Portfolio recommendation:

- For demos, prefer local-only or seeded demo accounts.
- Do not require sign-up to experience the showcase.
- Treat cloud inventory as an advanced architecture feature, not the first public promise.

### Kernel / Agent Features

Risk:

- Kernel schema exists, but server endpoints and client restore behavior are incomplete.
- Agent attribution, connected agent persistence, and revocation flows are unfinished.

Portfolio recommendation:

- Present as "agent integration prototype" only if shown.
- Hide public agent connection flows unless hardened.

### Live Ops Safety

Risk:

- M/Ops surfaces can imply or expose operational controls.
- Portfolio visitors should not be dropped into role-gated, confusing, or live-looking workflows.

Immediate action:

- Add a demo scenario mode with fake data.
- Disable or hide destructive controls in public demo mode.
- Show architecture, event feed, map, and pings as non-mutating proof.

### Game UX Density

Risk:

- Gone Rogue can overwhelm users quickly.
- There are many unfinished or semi-finished mechanics visible in the UI.
- A portfolio visitor does not have the context a playtester had.

Immediate action:

- Create a curated seed.
- Add a short "what you are seeing" overlay outside the game canvas.
- Keep the first playable moment under 10 seconds.
- Hide advanced panels until after the game starts cleanly.

## 6. Portfolio Rewrap Strategy

### Top-Level Site Structure

Recommended first public route:

- `/portfolio.html` or `/showcase.html`

Suggested navigation:

- Overview
- Playable Demos
- Systems Map
- Case Study
- Archive / Labs

### Three Main Demos

#### Demo 1: Gone Rogue Seeded Run

Goal:

- Show the procedural roguelike, STR combat, cards, mobile grid, and atmosphere.

Requirements:

- Known-good seed.
- One-click launch.
- No account requirement.
- No broken advanced setup.
- Clean return-to-showcase path.

Acceptance:

- Visitor clicks "Play Gone Rogue Demo."
- Game loads.
- Player sees controllable grid.
- No console-blocking errors.
- Demo seed is repeatable.

#### Demo 2: QR Puzzle Pipeline

Goal:

- Show physical-digital puzzle design and runtime.

Requirements:

- One sample puzzle that opens immediately.
- QR code visible on the page.
- Designer screenshot or safe read-only designer.
- Explanation of how printable artifacts connect to browser state.

Acceptance:

- Visitor opens a puzzle.
- Solves or interacts with a short puzzle.
- Can see that QR -> route -> puzzle is real.

#### Demo 3: Arcade / Boss Prototype

Goal:

- Show the arcade engine and boss-adapter thinking.

Recommended choices:

- Frogger / Depot Crossing.
- SkiFree / Infiltration Descent.
- JezzBall / containment prototype.

Requirements:

- Touch and keyboard work.
- Audio either works or is gracefully muted.
- No account requirement.
- Score/currency can be local-only.

Acceptance:

- Visitor plays for 30 seconds without setup.
- Game loop, collision, score, and restart work.

### Systems Map

Create a visual systems map that shows:

- Cloudflare Worker backend.
- D1 data.
- Durable Object scenario room.
- R2 media.
- Public app shell.
- Gone Rogue engine.
- QR puzzle pipeline.
- Designer portals.
- Ops/M consoles.
- Arcade demos.

This can be a static Mermaid diagram in markdown first, then a polished webpage later.

## 7. Immediate Execution Plan

### Phase 0: Stabilize The Repo

Agent lane locator:

- Current phase heading line: 601.
- Start reading here for dependency, build, dev-server, and local baseline work.
- If this document has changed, refresh heading lines with the command in "Agent Lane Locator" before assigning work.

Goal:

- Make the project locally understandable and runnable.

Tasks:

- Install dependencies.
- Confirm `npm run typecheck`.
- Confirm `npm run build:ui`.
- Add or update local dev instructions.
- Verify the worker can run with `npm run dev`.
- Document any required Cloudflare secrets or local substitutes.
- Check for stale generated files and backups that should not appear in portfolio navigation.

Acceptance:

- A new collaborator can clone, install, and run the portfolio routes.
- Known failures are documented rather than mysterious.

### Phase 1: Repair Launch And Demo Paths

Lane status:

- Current state: context pull started.
- Primary owner: launch-path stabilization agent.
- Secondary owners: `/games` launch agent, Street Chronicles transition agent, visible error-state agent.
- Current heading line: see "Agent Lane Locator" near the top of this file; refresh after large edits.
- Agent reading budget: this section plus the files listed under "Minimum Context Packet" should be enough to begin.

Goal:

- Ensure users can reach the best playable surfaces.

Why this phase matters:

- The portfolio wrapper will only work if the demos launch reliably.
- Gone Rogue is likely the strongest playable proof in the project, but it has several launch avenues that historically diverged.
- A public visitor should never click "Play" and get silence, a half-loaded terminal, or an invisible module failure.
- Phase 1 is not about making Gone Rogue perfect. It is about making launch paths deterministic, observable, and safe.

Minimum Context Packet:

An agent assigned to this phase should start by reading only these files and sections:

- `ROADMAP.md`: this Phase 1 section and "Launch And Routing" under "Obvious Broken Or Risky Areas."
- `docs/AWOL_LAUNCH_SYSTEM_ROADMAP.md`: status, Phase 1, Phase 2, Phase 3, and Terminal compatibility sections.
- `public/js/gone-rogue-loader.js`: entire file, because it owns lazy module loading and subsystem initialization.
- `public/js/main.js`: startup, `_handleInitialRogueLaunch`, `_launchRogueWhenReady`, and the `case 'rogue'` branch.
- `public/js/awol-difficulty.js`: `_launchGame`, `_startRogueWhenReady`, pause/resume, and current tier/seed handling.
- `public/games.html`: Gone Rogue launcher markup and click handler for `#launch-gone-rogue`.
- `public/js/gamestate.js`: `requestRogue(context)` and `enterRogueMode(context)` if needed.
- `public/js/gone-rogue.js`: `start(context)`, `_applyLaunchContext(context)`, `setDifficulty`, `setSeed`, and public API export.
- `public/js/run-start-system.js`: `_initRunSeed(ctx, context)` and launch-time seed initialization.
- `public/js/street-chronicles.js`: the ROGUE command branch and invalid-direction auto-trigger branch.

Do not start by reading all of `public/js/`. The game is too broad for a single agent prompt. Follow the launch path first.

Known Current Launch Surfaces:

| Surface | User Action | Expected Route | Key Files |
|---|---|---|---|
| Terminal command | Type `ROGUE` or `GONE_ROGUE` in the home terminal. | `StateMachine` returns action type `rogue`; `main.js` ensures `RogueLoader`, then calls `GAMESTATE.requestRogue(action.data)`. | `public/js/state-machine.js`, `public/js/main.js`, `public/js/gone-rogue-loader.js`, `public/js/gamestate.js` |
| AWOL header launcher | Click AWOL, expand tier, choose seed, click play. | `awol-difficulty.js` should ensure lazy modules are loaded, apply difficulty/seed, then call `GAMESTATE.requestRogue(context)`. | `public/index.html`, `public/js/awol-difficulty.js`, `public/js/gone-rogue-loader.js` |
| Games page launcher | Click `LAUNCH GONE-ROGUE` on `/games.html`. | Browser navigates to `/?rogue=1` or `/?rogue=1&seed=...`; home startup consumes query and starts game. | `public/games.html`, `public/js/main.js` |
| URL deep link | Open `/?rogue=1`, `/?game=rogue`, `/?mode=rogue`, or `/#gone-rogue`. | Home startup detects launch intent, clears URL, loads modules, starts Gone Rogue. | `public/js/main.js` |
| Street Chronicles manual transition | Type `rogue` while Street Chronicles is active. | Street Chronicles yields control and calls `GAMESTATE.requestRogue({ reason: 'manual', carryInventory: true })`. | `public/js/street-chronicles.js`, `public/js/gamestate.js` |
| Street Chronicles repeated invalid direction | Repeat an invalid direction enough times. | Street Chronicles triggers Gone Rogue with carry-over context if game modules are loaded. | `public/js/street-chronicles.js`, `public/js/gamestate.js` |

Current Code Context Snapshot:

- `public/js/gone-rogue-loader.js` exposes `window.RogueLoader.ensureLoaded(cb)`, `isLoaded()`, `isLoading()`, `progress()`, and `scriptCount()`.
- `RogueLoader.ensureLoaded()` loads the large Gone Rogue script list sequentially and initializes `TerminalCommandRouter`, `GAMESTATE`, `GoneRogue`, `ShopSystem`, and `ApiClient`.
- `public/js/main.js` now contains `_handleInitialRogueLaunch()` and `_launchRogueWhenReady(context)` for URL/hash launch.
- `public/js/main.js` still has the original `case 'rogue'` terminal branch, which also goes through `RogueLoader.ensureLoaded()`.
- `public/js/awol-difficulty.js` now has `_startRogueWhenReady(context)` so AWOL launch does not call `GoneRogue` before the lazy modules exist.
- `public/games.html` currently builds the Gone Rogue URL as `/?rogue=1` plus optional `seed`.
- `public/js/gone-rogue.js` should apply launch context before run reset, including difficulty and seed.
- `public/js/run-start-system.js` should not overwrite a requested seed with a random seed during run initialization.
- `public/js/street-chronicles.js` calls `GAMESTATE.requestRogue()` directly from inside gameplay and may need loader protection if Street Chronicles can be active before Gone Rogue modules exist.

Recent Local Verification Notes:

- Static syntax checks passed for the critical launch files with `node --check`.
- A VM probe confirmed `/?rogue=1&seed=silent-viper-7&uber=2` queues `RogueLoader.ensureLoaded()`, maps UBER 2 to internal tier 3, applies the seed, and calls `GAMESTATE.requestRogue(context)`.
- A VM probe confirmed AWOL launch queues the lazy loader before start.
- `npm run typecheck` previously failed locally because `tsc` was unavailable, likely because dependencies were not installed.

These notes are not enough for completion. Browser verification is still required.

Source Docs To Pull From:

- `docs/AWOL_LAUNCH_SYSTEM_ROADMAP.md`
  - Status says Phase 2 implemented.
  - Original problem: terminal-only `rogue` launch had no discoverable visual affordance.
  - Desired primary path: AWOL button -> dropdown -> seed -> play/pause.
  - Terminal `rogue` must remain as a hidden shortcut.
  - Phase 3 seed standardization and Phase 5 compatibility are directly relevant to this phase.
- `docs/GAMES_REVAMP_ROADMAP.md`
  - `/games` is an arcade surface with uneven prototypes.
  - For Phase 1, only the Gone Rogue handoff from `/games.html` matters.
  - Do not attempt to polish all minigames inside Phase 1.
- `docs/CRITICAL_TODOS_AND_BLOCKERS.md`
  - Treat account/inventory/kernel issues as risks, not blockers for local demo launch.
  - Phase 1 should avoid introducing account requirements.
- `docs/SESSION-SUMMARY-20260318.md`
  - Confirms terminal boot overhaul and `/games` navigation were active project areas.

What Phase 1 Is Allowed To Change:

- Launch routing code.
- Explicit demo launch buttons or URLs.
- Visible loading/error messages for game module loading.
- Seed/difficulty context handoff.
- Basic route cleanup needed to prevent silent launch failure.
- Documentation of known launch failures.

What Phase 1 Should Not Change:

- Core combat mechanics.
- Card balancing.
- Account schema.
- M/Ops authorization.
- Full portfolio page design.
- Arcade game internals beyond the handoff to Gone Rogue.
- Broad refactors of the lazy loader.

Agent Sub-Lanes:

#### Phase 1A: Terminal And URL Launch Agent

Scope:

- `public/js/main.js`
- `public/js/state-machine.js`
- `public/js/gone-rogue-loader.js`
- `public/js/gamestate.js`
- `public/js/gone-rogue.js`
- `public/js/run-start-system.js`

Task:

- Verify terminal `ROGUE` launch still works.
- Verify URL launches work:
  - `/?rogue=1`
  - `/?rogue=1&seed=silent-viper-7`
  - `/?game=rogue`
  - `/?mode=rogue`
  - `/#gone-rogue`
- Confirm launch context reaches `GAMESTATE.requestRogue(context)` and `GoneRogue.start(context)`.
- Confirm requested seed is not overwritten by random seed initialization.
- Confirm difficulty mapping is documented and deterministic.

Deliverable:

- Patch if needed.
- Short report listing each tested URL, result, and any console errors.

Acceptance:

- Each URL either starts Gone Rogue or shows a visible non-silent error.
- Terminal `ROGUE` still works after any URL-launch changes.

#### Phase 1B: AWOL Launch Agent

Scope:

- `public/index.html`
- `public/js/awol-difficulty.js`
- `public/js/gone-rogue-loader.js`
- `public/css/gone-rogue-mobile.css`
- relevant AWOL styles in CSS files only if visual state is broken.

Task:

- Verify AWOL dropdown opens.
- Verify tier row expansion works.
- Verify seed entry and randomization work.
- Verify clicking play calls `RogueLoader.ensureLoaded()` when needed.
- Verify context includes:
  - `reason: 'awol'`
  - `difficulty`
  - `seed`
- Verify AWOL running/paused UI does not claim the game is running if launch fails.

Deliverable:

- Patch if needed.
- Short report with idle, loading, running, and failed states.

Acceptance:

- AWOL launch works from a cold page load.
- AWOL launch failure produces an inspectable console warning and visible UI reset or error.

#### Phase 1C: `/games.html` Handoff Agent

Scope:

- `public/games.html`
- any shared games navigation script if the launcher was moved there.
- `public/js/main.js` only if query parameters need adjustment.

Task:

- Verify the `LAUNCH GONE-ROGUE` button exists and is reachable.
- Verify seed input value is included in the URL.
- Verify URL format matches what `main.js` consumes.
- Decide whether `/games.html` should pass difficulty/uber in Phase 1 or defer it to Phase 3.
- Do not rewrite the entire games page.

Deliverable:

- Patch if needed.
- Short report with generated URLs for empty seed and custom seed.

Acceptance:

- `/games.html` launches Gone Rogue through the same home-page URL path used by direct links.

#### Phase 1D: Street Chronicles Transition Agent

Scope:

- `public/js/street-chronicles.js`
- `public/js/gamestate.js`
- `public/js/main.js` only if Street mode startup needs loader handling.

Task:

- Verify Street Chronicles can enter Gone Rogue manually by typing `rogue`.
- Verify repeated invalid-direction trigger does not fail silently.
- Check whether Street Chronicles can ever be active before `GAMESTATE` exists.
- If yes, add a minimal loader guard or visible fallback.
- Preserve carry-inventory behavior.

Deliverable:

- Patch if needed.
- Short report with manual and invalid-direction transition status.

Acceptance:

- Street -> Rogue transition either works or is intentionally hidden/parked for portfolio.

#### Phase 1E: Visible Failure And Demo Exit Agent

Scope:

- `public/js/gone-rogue-loader.js`
- `public/js/main.js`
- `public/js/awol-difficulty.js`
- portfolio/showcase route later, once Phase 2 exists.

Task:

- Identify where module load failure is currently only logged to console.
- Add a small visible message for failed launch where feasible.
- Do not invent a full notification system.
- Add a future hook for "Back to Showcase" once Phase 2 creates the route.

Deliverable:

- Patch if needed.
- Short report listing failure states and what the user sees.

Acceptance:

- Launch failure is not silent.
- The app can recover back to normal terminal input or idle AWOL state.

Suggested Test Commands:

```powershell
node --check public\js\main.js
node --check public\js\awol-difficulty.js
node --check public\js\gone-rogue-loader.js
node --check public\js\gamestate.js
node --check public\js\gone-rogue.js
node --check public\js\run-start-system.js
node --check public\js\street-chronicles.js
```

If dependencies are installed:

```powershell
npm run typecheck
npm run build:ui
npm run dev
```

Browser URLs to smoke test:

```text
http://localhost:8787/
http://localhost:8787/?rogue=1
http://localhost:8787/?rogue=1&seed=silent-viper-7
http://localhost:8787/?game=rogue
http://localhost:8787/?mode=rogue
http://localhost:8787/#gone-rogue
http://localhost:8787/games.html
```

Use the actual Wrangler port if different.

Manual Browser Checklist:

- [ ] Home loads without fatal console errors.
- [ ] Terminal accepts input after splash/boot.
- [ ] Typing `ROGUE` starts module loading if needed.
- [ ] Typing `ROGUE` eventually shows Gone Rogue UI.
- [ ] `/?rogue=1` starts a run without typing.
- [ ] `/?rogue=1&seed=silent-viper-7` preserves the seed.
- [ ] `/#gone-rogue` starts or intentionally redirects into the same launch path.
- [ ] AWOL dropdown opens.
- [ ] AWOL seed field accepts typed seed.
- [ ] AWOL play starts a run from cold page load.
- [ ] `/games.html` launch button reaches home and starts a run.
- [ ] Failed module load, if simulated, is visible to the user.
- [ ] Back/exit behavior is at least documented if not implemented.

Completion Criteria:

- At least three independent public launch paths work locally:
  - terminal `ROGUE`
  - AWOL play
  - `/games.html` -> `/?rogue=1`
- URL seed launch works locally.
- No launch path silently fails.
- Known production-only blockers are documented.
- Phase 2 can safely point demo cards at these launch URLs.

Known Deferrals:

- Full AWOL history/favorites/shareable URL polish.
- Full mid-run UBER overlay polish.
- Account-backed save/resume.
- Highscore attribution.
- Full Street Chronicles portfolio inclusion.
- Full arcade game polish.

Agent Report Template:

```markdown
Phase 1 Report: <sub-lane>

Files read:
- ...

Files changed:
- ...

Commands run:
- ...

Launch paths tested:
- ...

Result:
- ...

Remaining risks:
- ...

Recommended next agent lane:
- ...
```

Tasks:

- Verify Gone Rogue terminal launch.
- Verify AWOL launch.
- Verify `/games.html` -> `/?rogue=1` launch.
- Verify hash launch: `/#gone-rogue`.
- Verify Street Chronicles -> Gone Rogue transition or hide it.
- Add visible error state if game modules fail to load.
- Add portfolio-safe "Back to Showcase" route.

Acceptance:

- Three launch paths work locally and on production.
- No launch path silently fails.

### Phase 2: Create Portfolio Wrapper

Lane status:

- Current state: context pull started.
- Primary owner: portfolio wrapper agent.
- Secondary owners: public copy agent, systems-map agent, visual/layout agent, routing/navigation agent.
- Current heading line: see "Agent Lane Locator" near the top of this file; refresh after large edits.
- Agent reading budget: this section plus the files listed under "Minimum Context Packet" should be enough to begin.

Goal:

- Stop presenting the site as only a stakeholder product.

Why this phase matters:

- The original site surfaces still read as an active stakeholder product: booking, partners, missions, actors, field kit, live ops, and ARG terminal.
- The new goal is different: present EyesOnly as a studio case study and reusable systems showcase.
- A portfolio visitor should understand the project before being asked to type terminal commands, join a scenario, log in, or parse lore.
- The wrapper should make unfinished systems feel intentionally archived or experimental, not accidentally broken.

Primary decision:

- Build a new route first, likely `/showcase.html` or `/portfolio.html`, instead of immediately rewriting `/`.

Recommended decision:

- Use `/showcase.html` for the first pass.
- Keep `/` intact until Phase 1 launch paths are verified and Phase 4 route gating is planned.
- Later decide whether `/` redirects to `/showcase.html`, links to it prominently, or becomes the showcase itself.

Route Name Options:

| Route | Pros | Cons | Recommendation |
|---|---|---|---|
| `/showcase.html` | Feels like an interactive demo hub; avoids resume/agency cliche; can include playable systems. | Slightly less standard for portfolio visitors. | Best first implementation. |
| `/portfolio.html` | Clear visitor expectation; easy to share professionally. | Can feel static or generic; less playful. | Acceptable if studio site convention prefers it. |
| Rewrite `/` | Strongest first impression once ready. | Risky because current home owns terminal boot, AWOL, launch, auth overlays, and game shell. | Defer until Phase 2-4 are stable. |
| Add `/case-study.html` | Useful for long-form writeup. | Less useful as first interactive hub. | Good later companion route. |

Minimum Context Packet:

An agent assigned to this phase should start by reading only these files and sections:

- `ROADMAP.md`: Product Reframing, Current System Inventory, Portfolio Rewrap Strategy, Phase 2.
- `README.md`: elevator pitch, stack, architecture decisions, module index.
- `docs/SESSION-SUMMARY-20260318.md`: hybrid page work, QR puzzle pipeline, terminal boot overhaul, known resolved issues, remaining roadmap.
- `docs/GAMES_REVAMP_ROADMAP.md`: current arcade state and boss-first framing.
- `public/index.html`: current home header, AWOL button, terminal shell, auth overlay, script loading order.
- `public/games.html`: current Field Kit layout, arcade tiles, Gone Rogue launcher, QR puzzle rows.
- `public/css/games-hybrid.css`: reusable paper/CRT hybrid visual language.
- `public/css/terminal-polish.css`: terminal polish and CRT overlay adjustments.
- `public/css/crt.css`: if reusing home/terminal visual motifs.

Do not start by reading all routes or all docs. Phase 2 is about the wrapper and public story, not a full platform audit.

Current Public Surface Snapshot:

- `public/index.html`
  - Metadata still describes "an archival command terminal awaiting authenticated input" and "classified recruitment terminal."
  - Header links emphasize Booking, Partners, Arcade, active item, currency, and AWOL.
  - The home page owns the terminal shell, login overlay, AWOL dropdown, Gone Rogue lazy loader, and many sync script dependencies.
  - This page is functionally important and should not be heavily rewritten until launch paths are stable.
- `public/games.html`
  - Metadata describes "FIELD KIT - Puzzles, decryption keys, and reconnaissance toys."
  - Uses the hybrid paper/CRT desk-folder visual language.
  - Contains QR field ops, arcade tiles, Street Chronicles launcher, and Gone Rogue launcher.
  - Some arcade entries are uneven; this page should be treated as a source of demo cards, not the final portfolio wrapper.
- `README.md`
  - Strong architecture and stack summary.
  - Still frames EyesOnly as the deployed Live ARG / Joint Tactical Training Exercise platform.
  - Useful for systems-map and tech-stack copy, but too product-assertive for public portfolio copy.
- `docs/SESSION-SUMMARY-20260318.md`
  - Confirms the QR puzzle pipeline, puzzle designer, hybrid paper/CRT layout, and terminal boot overhaul were major recent wins.
  - Good source for "What we built" and "Reusable systems" sections.

Portfolio Wrapper Goals:

- Explain what EyesOnly is now within 30 seconds.
- Offer three clear demo paths.
- Separate finished demos from labs/archive.
- Make the abandoned stakeholder context honest but not bitter.
- Show the breadth of the work without overwhelming the visitor.
- Give future agents a stable place to wire Phase 1 launch URLs and Phase 3 curated demos.

Suggested Page Structure:

1. Hero / thesis
   - Name: "EyesOnly"
   - Label: "Live game systems prototype"
   - Short blurb: browser-native ARG, procedural roguelike, QR puzzle tooling, arcade experiments, live ops architecture.
   - Primary CTA: "Play Gone Rogue Demo" or "Explore The Systems."
   - Secondary CTA: "Open Field Kit" or "View Systems Map."

2. Three playable demos
   - Gone Rogue seeded run.
   - QR puzzle pipeline.
   - Arcade/boss prototype.
   - Each card should have:
     - what it demonstrates
     - status badge
     - launch button
     - fallback note if the demo is experimental

3. Systems map
   - Cloudflare Workers backend.
   - D1 data.
   - Durable Object scenario room.
   - R2 media.
   - Public app shell.
   - Gone Rogue engine.
   - QR puzzle pipeline.
   - Designer portals.
   - Ops/M consoles.
   - Arcade demos.

4. Case study summary
   - Original brief.
   - What changed.
   - What was built.
   - What was reused elsewhere, including Dungeon Gleaner.
   - What is intentionally parked.

5. Labs / archive
   - Link to Field Kit, designer portals, M/Ops screenshots or gated routes.
   - Label clearly as experimental/internal where needed.

6. Technical stack
   - Cloudflare Workers.
   - D1.
   - Durable Objects.
   - R2.
   - Plain-script browser game modules.
   - Preact for `/ops` and `/m`.
   - Canvas/CRT/QR/audio systems.

Copy Direction:

Use honest, studio-centered language:

- "Originally developed for a stakeholder live-game concept."
- "The stakeholder direction changed."
- "The systems became reusable studio infrastructure."
- "This showcase collects the strongest playable and technical pieces."
- "Some surfaces are demos, some are labs, and some are archived experiments."

Avoid:

- Blaming the stakeholder.
- Claiming a full production launch.
- Overstating multiplayer/live readiness.
- Making visitors think they can book an active real-world mission.
- Presenting auth-required or admin-like flows as normal public demos.

Suggested Hero Copy:

```text
EyesOnly is a browser-native live game systems prototype: part ARG operations console, part procedural roguelike, part QR puzzle toolkit, part arcade lab.

Originally built for a stakeholder live-game concept, it now serves as a studio case study in dense, playful, data-rich systems. Some pieces are playable demos; others are preserved as labs and architecture proofs.
```

Suggested Status Badges:

- `Playable Demo`
- `Systems Proof`
- `Lab Build`
- `Archived Experiment`
- `Internal Tool`
- `Needs Hardening`

Suggested Demo Cards:

| Demo | Public Label | Status | Launch Target | Notes |
|---|---|---|---|---|
| Gone Rogue | "Procedural stealth roguelike" | `Playable Demo` after Phase 1 verification | `/?rogue=1&seed=<chosen-seed>` or future showcase helper button | Strongest interactive proof. |
| QR Puzzle Pipeline | "QR puzzle toolkit" | `Systems Proof` / `Playable Demo` | A known public puzzle hash or `/games.html#<puzzle>` | Best physical-digital proof. |
| Arcade/Boss Prototype | "Arcade boss lab" | `Lab Build` or `Playable Demo` depending on chosen game | `/games.html` with target section or future direct minigame route | Pick one game in Phase 3. |
| Live Ops Console | "Director/Ops architecture" | `Systems Proof` | screenshots, diagram, or gated route | Avoid public mutation controls in Phase 2. |
| Media Designer | "Audio/media tooling" | `Internal Tool` | screenshots or gated route | Good case-study panel, not first-click demo. |

Design Direction:

- Reuse the hybrid paper/CRT language from `games.html` if practical.
- Keep the first screen clearer and less lore-heavy than the original home page.
- Avoid making a marketing-only landing page. The page should immediately expose actual demo options.
- Use restrained cards for repeated demo items only.
- Do not nest cards inside cards.
- The brand/product signal should be visible in the first viewport.
- Make status labels plain and honest.
- The page should work as a standalone static HTML page if possible.

Implementation Options:

#### Option A: New Static Showcase Page

Files likely touched:

- Add `public/showcase.html`.
- Add `public/css/showcase.css`.
- Optionally add `public/js/showcase.js` for small interactions only.
- Add links to `/showcase.html` from `public/index.html` and `public/games.html`.

Pros:

- Lowest risk.
- Does not disturb terminal boot/game shell.
- Easy for agents to reason about.
- Can be deployed before route gating is complete.

Cons:

- The existing homepage remains stakeholder/product framed unless linked clearly.

Recommendation:

- Use this for the first Phase 2 implementation.

#### Option B: Home Page Banner / Interstitial

Files likely touched:

- `public/index.html`
- Possibly `public/js/main.js`
- Existing CSS.

Pros:

- Visitors to `/` immediately see the new framing.

Cons:

- Higher risk because `index.html` is also the game shell.
- Can interfere with terminal boot, AWOL, auth, and launch behavior.

Recommendation:

- Defer until after `/showcase.html` exists.

#### Option C: Replace Home Page

Files likely touched:

- `public/index.html`
- several script/style dependencies.

Pros:

- Cleanest final public identity.

Cons:

- Highest risk.
- Requires careful preservation of Gone Rogue launch shell.

Recommendation:

- Do not do this in first Phase 2 pass.

Agent Sub-Lanes:

#### Phase 2A: Route And Shell Agent

Scope:

- `public/showcase.html`
- `public/css/showcase.css`
- minimal navigation links from `public/index.html` and `public/games.html` if approved.

Task:

- Create the standalone showcase page.
- Keep it mostly static.
- Include hero, demo cards, systems map placeholder, case-study summary, labs/archive section, and tech stack.
- Avoid requiring auth or JS-heavy initialization.

Deliverable:

- New static page and CSS.
- Short report with route, linked assets, and responsive behavior.

Acceptance:

- `/showcase.html` opens directly.
- The page explains EyesOnly in under 30 seconds.
- It has three demo cards, even if some targets are placeholders pending Phase 3.

#### Phase 2B: Public Copy Agent

Scope:

- `ROADMAP.md`
- `public/showcase.html`
- optional future `docs/SHOWCASE_COPY.md`.

Task:

- Refine public-facing language.
- Write concise copy for:
  - hero
  - demo cards
  - original-context note
  - "what we built"
  - "what is still lab/archived"
  - tech stack
- Keep language stakeholder-neutral.

Deliverable:

- Copy blocks inserted into showcase page or collected in doc.

Acceptance:

- The page does not read as an active stakeholder product.
- The page does not read as an apology.
- The page clearly frames EyesOnly as a systems showcase.

#### Phase 2C: Systems Map Agent

Scope:

- `ROADMAP.md`
- `README.md`
- `public/showcase.html`
- optional Mermaid diagram inside the page or markdown.

Task:

- Create a first-pass systems map.
- Use the system inventory in this roadmap.
- Do not over-model every module.
- Show the high-level relationship between:
  - public shell
  - Gone Rogue
  - Field Kit / Arcade
  - QR puzzle pipeline
  - designer portals
  - M/Ops live stack
  - Cloudflare backend services

Deliverable:

- Static diagram or simple visual section.

Acceptance:

- A technical visitor can understand the breadth without reading the repo.

#### Phase 2D: Navigation And Safety Agent

Scope:

- `public/index.html`
- `public/games.html`
- `public/showcase.html`
- route links only, not full route-gating.

Task:

- Decide where to link `/showcase.html`.
- Add a low-risk link from existing pages if approved.
- Avoid breaking current nav.
- Do not hide existing stakeholder routes yet; that is Phase 4.

Deliverable:

- Minimal nav patch or recommendation to defer nav changes.

Acceptance:

- A visitor can find the showcase.
- Existing launch and terminal routes are not broken.

What Phase 2 Is Allowed To Change:

- Add a new static showcase page.
- Add showcase CSS.
- Add very small showcase JS if needed.
- Add links to showcase from existing pages.
- Add public copy.
- Add static systems map.
- Add demo cards that link to already-known or placeholder targets.

What Phase 2 Should Not Change:

- Gone Rogue mechanics.
- Launch path internals, unless Phase 1 explicitly requires it.
- M/Ops backend routes.
- Auth flows.
- Account persistence.
- `/games` arcade internals.
- Full homepage replacement.
- Route gating for every unfinished page.

Suggested Test Commands:

```powershell
node --check public\js\showcase.js
```

Only run that if `showcase.js` exists.

If dependencies are installed:

```powershell
npm run typecheck
npm run build:ui
npm run dev
```

Browser URLs to smoke test:

```text
http://localhost:8787/showcase.html
http://localhost:8787/
http://localhost:8787/games.html
```

Use the actual Wrangler port if different.

Manual Browser Checklist:

- [ ] `/showcase.html` loads without auth.
- [ ] First viewport clearly says what EyesOnly is now.
- [ ] Demo cards are visible on desktop.
- [ ] Demo cards are visible and readable on mobile.
- [ ] Links do not point to obviously broken routes unless labeled as placeholder/lab.
- [ ] Existing `/` still loads.
- [ ] Existing `/games.html` still loads.
- [ ] No stakeholder-private data or claims appear.
- [ ] Page includes honest prototype/showcase status.

Completion Criteria:

- Showcase route exists or route decision is documented.
- Showcase page explains the reframed project clearly.
- Three demo cards exist.
- Systems map section exists.
- Labs/archive distinction exists.
- Existing home and games pages are not broken.
- Phase 3 can use the wrapper to plug in curated demo targets.

Known Deferrals:

- Rewriting `/`.
- Full route gating.
- Screenshot capture and final art direction.
- Video clips.
- Live demo scenario for M/Ops.
- Public upload-safe media designer.
- Full case-study longform page.

Agent Report Template:

```markdown
Phase 2 Report: <sub-lane>

Files read:
- ...

Files changed:
- ...

Route decision:
- ...

Copy decisions:
- ...

Links added:
- ...

Browser checks:
- ...

Remaining risks:
- ...

Recommended next agent lane:
- ...
```

Tasks:

- Add `/portfolio.html` or `/showcase.html`.
- Add studio-oriented copy.
- Add three demo cards.
- Add systems map.
- Add case-study summary.
- Add "original stakeholder direction changed" language in a careful, non-blaming way.
- Link archive/labs separately.

Acceptance:

- A visitor understands the project in under 30 seconds.
- The first click leads to a working demo.
- Incomplete systems are not disguised as finished product.

### Phase 3: Curate Demos

Goal:

- Make each demo feel intentional.

Tasks:

- Choose one Gone Rogue seed.
- Choose one QR puzzle.
- Choose one arcade game.
- Add short contextual copy for each.
- Remove or hide broken launch buttons.
- Add route-level guardrails for auth-required tools.
- Add screenshots or short looping clips where live demo is too risky.

Acceptance:

- Each showcased demo has a stable path, a fallback, and a clear point.

### Phase 4: Archive Or Lab-Gate Unfinished Systems

Goal:

- Reduce public confusion.

Tasks:

- Move incomplete routes behind "Labs" copy.
- Hide underbuilt arcade games.
- Hide or gate M/Ops controls.
- Make designer upload/admin flows local-only or auth-gated.
- Audit navigation links for dead ends.

Acceptance:

- Portfolio visitors cannot easily wander into broken stakeholder remnants.

### Phase 5: Portfolio Polish

Goal:

- Make the work feel finished even if the product is not.

Tasks:

- Add a coherent visual hierarchy.
- Add screenshots for complex systems.
- Add architecture diagram.
- Add "What we built" and "What we learned" sections.
- Add "Reusable systems extracted" section, including Dungeon Gleaner.
- Add accessibility and mobile notes.
- Add performance notes where impressive.

Acceptance:

- The project reads as a mature case study, not an abandoned build.

## 8. Demo Readiness Checklist

### Gone Rogue Demo

- [ ] One-click launch from portfolio.
- [ ] Query launch works.
- [ ] AWOL launch works.
- [ ] Terminal launch works.
- [ ] Seed is repeatable.
- [ ] Difficulty is clear and simplified.
- [ ] Mobile grid accepts input.
- [ ] Keyboard input works where expected.
- [ ] No account required.
- [ ] No fatal console errors during first minute.
- [ ] Back/exit route works.

### QR Puzzle Demo

- [ ] Public puzzle opens without auth.
- [ ] QR code displays.
- [ ] Hash routing works.
- [ ] Puzzle can be completed or meaningfully interacted with.
- [ ] Designer is either read-only or safely gated.
- [ ] No stale mission/customer data appears.

### Arcade Demo

- [ ] Chosen game starts.
- [ ] Touch input works.
- [ ] Keyboard or pointer fallback works.
- [ ] Restart works.
- [ ] Score works.
- [ ] Audio failure is graceful.
- [ ] No broken highscore/account dependency blocks play.

### Portfolio Wrapper

- [ ] Explains what EyesOnly is now.
- [ ] Explains original context without over-sharing.
- [ ] Shows three demo links.
- [ ] Includes systems map.
- [ ] Includes tech stack.
- [ ] Includes "reused for Dungeon Gleaner" note.
- [ ] Avoids promising production availability.

## 9. Suggested Public Copy

### Short Blurb

EyesOnly is a browser-native live game systems prototype. It combines a real-time operations console, procedural roguelike engine, QR puzzle pipeline, arcade experiments, media tooling, and physical-digital play patterns. Originally built for a stakeholder live-game concept, it now serves as a studio case study and reusable systems library.

### Longer Case Study Intro

EyesOnly started as a full-stack platform for live spy games: director dashboards, field operations, actor coordination, dead drops, QR puzzles, and an embedded roguelike training mode. The stakeholder direction changed, but the work produced a broad set of reusable systems. We now treat EyesOnly as a portfolio case study in building dense, playful, data-rich browser experiences.

### Honest Status Note

This is a prototype and systems showcase, not a finished consumer product. Some features are live demos, some are architecture proofs, and some are archived experiments. The point is to show the breadth of the engine, tooling, and design thinking.

## 10. What To Preserve

Preserve these as high-value studio assets:

- Gone Rogue engine architecture.
- Procedural floor and biome systems.
- STR combat concepts.
- Card/loot/inventory data models.
- QR puzzle designer and runtime.
- Printable QR artifact generation.
- Audio/media designer patterns.
- ArcadeEngine and minigame modules.
- Live ops dashboard architecture.
- Cloudflare Workers/D1/Durable/R2 patterns.
- Hybrid paper/CRT visual direction.
- Documentation discipline and roadmap history.

## 11. What To De-Emphasize

De-emphasize these until they are hardened:

- Production booking/partner claims.
- Real-world live mission promises.
- Account-required demo paths.
- Agent/kernel integrations.
- Ops moderation controls.
- Underbuilt arcade games.
- Deep inventory economy.
- Unfinished designer editors.
- Any stakeholder-specific copy.

## 12. What To Cut Or Hide For First Portfolio Release

Hide from primary navigation:

- Incomplete M/Ops admin actions.
- Upload portals unless authenticated.
- Broken or underbuilt minigames.
- Old legacy pages.
- Internal test pages.
- Roadmap-only features.
- Anything requiring production secrets.

Keep accessible for internal work:

- `/docs`.
- `/public/tests`.
- Designer portals.
- M/Ops routes.
- Roadmap documents.

## 13. Development Priorities

### Priority 1: Public First Impression

- Portfolio landing page.
- Working demo links.
- Clear explanation.
- No broken first-click paths.

### Priority 2: Demo Stability

- Gone Rogue launch reliability.
- QR puzzle reliability.
- One arcade game reliability.
- Mobile smoke tests.

### Priority 3: Case Study Depth

- Architecture diagram.
- Screenshots.
- System descriptions.
- Reuse story.

### Priority 4: Optional Feature Work

- Improve AWOL seed UX.
- Harden account inventory.
- Build demo scenario mode for M/Ops.
- Polish arcade boss adapters.
- Add read-only designer demos.

## 14. Technical Debt Ledger

### Load Order Debt

The public app uses many plain script tags and a lazy loader. This works but is fragile. For portfolio use, focus on verifying routes rather than refactoring the whole app.

Possible future fix:

- Keep plain scripts for legacy game modules.
- Add a small route-level smoke test harness.
- Create a generated module manifest.

### Naming Debt

Difficulty terms conflict:

- Rogue 0-2.
- UBER 0-2.
- U1-U3.
- Tier 1-3.
- Biome tiers.

Portfolio fix:

- Use "Demo", "Standard", and "Hard" publicly.
- Keep internal tier names in code for now.

### State Debt

Multiple systems store state:

- localStorage.
- D1 account data.
- game state.
- puzzle state.
- scenario state.

Portfolio fix:

- Prefer stateless or local-only demos.
- Add "Reset Demo" buttons.

### Documentation Debt

Docs are valuable but sprawling.

Portfolio fix:

- Root `ROADMAP.md` is current triage truth.
- Add `SHOWCASE.md` later if needed.
- Keep old docs for archaeology and implementation detail.

## 15. Deployment Checklist

Before promoting the portfolio version:

- [ ] Run dependency install.
- [ ] Run typecheck.
- [ ] Run UI builds.
- [ ] Run local Worker dev server.
- [ ] Test `/`.
- [ ] Test `/portfolio.html` or `/showcase.html`.
- [ ] Test `/games.html`.
- [ ] Test Gone Rogue launch.
- [ ] Test QR puzzle route.
- [ ] Test chosen arcade demo.
- [ ] Test mobile viewport.
- [ ] Confirm no stakeholder-private copy or data is exposed.
- [ ] Confirm public routes do not expose admin mutation controls.
- [ ] Deploy.
- [ ] Test deployed routes.
- [ ] Clear or bust CDN cache if needed.

## 16. Recommended Next Tasks

1. Create the portfolio/showcase page.
2. Add a stable Gone Rogue demo button.
3. Add a stable QR puzzle demo button.
4. Pick and polish one arcade demo.
5. Add systems map and case-study copy.
6. Hide or lab-gate unstable navigation.
7. Deploy and smoke test.

## 17. North Star

The first release does not need to prove that EyesOnly is a finished platform. It needs to prove that the studio can design and build unusually rich interactive systems.

The portfolio should make visitors think:

- This team can build complex browser games.
- This team can connect digital and physical play.
- This team can build custom tools, not just frontends.
- This team can handle live ops and procedural systems.
- This team knows how to turn abandoned product work into reusable creative infrastructure.

That is the win.
