# EyesOnly Triage Roadmap

Date: 2026-05-01
Status: portfolio salvage and stabilization plan
Primary goal: rewrap the abandoned stakeholder platform into a studio portfolio showcase without pretending the whole product is production-complete.

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

Goal:

- Ensure users can reach the best playable surfaces.

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

Goal:

- Stop presenting the site as only a stakeholder product.

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
