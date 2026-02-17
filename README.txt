EYES ONLY -- Live Urban Espionage ARPG Platform
=================================================

Flaps & Seals: A real-time director-operated live espionage game.
Players explore urban environments while M (the director) orchestrates
actors, events, and tension from a command console. Actors receive
directives on mobile devices and acknowledge in real-time.

Deployed at: flapsandseals.com
Stack: Cloudflare Workers + D1 + Durable Objects + R2
Frontend: DOM-based (MetaMask SES-safe, no framework dependency)

GONE ROGUE - ASCII Stealth Roguelike Minigame
==============================================

Gone Rogue is an embedded ASCII stealth roguelike minigame accessible through
the command terminal. It features:

**Core Gameplay:**
- 40x20 grid tactical stealth gameplay
- Metal Gear-inspired enemy awareness system with sight cones
- STR (Simultaneous Turn Resolution) combat with advantage/flanking mechanics
- Diablo-style loot system with 9 quality tiers and affixes
- Card-based combat deck (attack, stance, utility, tactical cards)

**Progression Systems:**
- Currency System: Collect cryptos (¢) from breakables and defeated enemies
- Card Drops: 30% from breakables, 50% from enemies
- Persistent Inventory: 9-12 slots safe across death
- Loose Carry: 8 slots lost on death
- Starter Deck: 5 cards provided at game start

**Features:**
- Procedural dungeon generation with room/corridor layouts
- Environmental tiles: shadows, cover, hazards, smoke
- Breakable objects with physics-based projectile system
- Enemy AI with patrol patterns (stationary, patrol, circular, ellipse)
- Mobile-optimized touch controls with tap-to-move and card swipe
- Real-time game loop (10 FPS) with awareness decay

**Combat:**
- Turn-based STR combat triggered on enemy collision
- Advantage states: ambush, neutral, disadvantaged, flanked
- Card-powered attacks and defensive stances
- Critical hits, damage multipliers, and timing mechanics

**Future Features:**
- Bonfire/vendor system every 3-5 floors
- Emoji sprite combat scenes with timing-based blocks
- Status ailments (poison, shock, freeze, fear, rage)
- Emoticon face system for combatants


ARCHITECTURE
------------

  Cloudflare Worker (Hono.js router)
    |-- Public routes:    /api/auth/login, /api/join
    |-- M Mode routes:    /api/m/*  (director-only, grid, pings, freeze)
    |-- Ops routes:       /api/ops/* (actor check-in, pings, ack)
    |-- WebSocket:        Durable Objects (ScenarioRoom) with hibernation API
    |-- Static assets:    Worker-first routing (run_worker_first: true)
    |-- D1 database:      Scenarios, actors, lanes, grid_cells, events, etc.
    |-- R2 storage:       Map images and scenario assets

  M Mode Console:     /m/          (director command & control)
  Ops Portal:         /ops/        (actor field interface)
  Player Terminal:    / (root)     (ARG recruitment terminal + Gone Rogue)



PROJECT STRUCTURE
-----------------
  src/
    worker/
      index.ts              - Worker entry point, route mounting
      routes/
        public.ts           - Auth, join code endpoints
        m-mode.ts           - Director API (grid, pings, freeze, actors)
        ops.ts              - Actor API (check-in, ack, pings, events)
      middleware/
        auth.ts             - JWT-like token auth + role checks
      db/
        queries.ts          - All D1 query functions
      durable/
        scenario-room.ts    - WebSocket Durable Object (hibernation API)
    m-mode/
      index.tsx             - M Mode director console (DOM fallback)
    ops-ui/
      index.tsx             - Ops actor portal (DOM fallback)
    shared/
      types.ts              - Shared TypeScript types

  public/
    m/
      index.html            - M Mode HTML + CSS
      app.js                - Built M Mode bundle
    ops/
      index.html            - Ops HTML + CSS
      app.js                - Built Ops bundle
    index.html              - Player ARG terminal
    css/, js/, data/        - Player terminal assets

  migrations/
    0001_init.sql           - Core schema (scenarios, actors, lanes, events, etc.)
    0002_ugrs_grid.sql      - UGRS grid cells, cell_id columns on actors/dead_drops

  docs/
    m-tutorial-alpha.md     - M Mode director tutorial (maps UI to tutorial design)
    ops-tutorial-alpha.md   - Ops actor field manual (maps UI to tutorial design)

  wrangler.jsonc            - Cloudflare Workers config


BUILD + DEPLOY
--------------
  npm run build:mmode       - Build M Mode bundle (esbuild)
  npm run build:ops         - Build Ops bundle (esbuild)
  npm run build:ui          - Build both UIs

  npx wrangler deploy       - Deploy to Cloudflare (needs API key + email env vars)

  Auth env vars for non-interactive deploy:
    CLOUDFLARE_API_KEY=...  CLOUDFLARE_EMAIL=...  npx wrangler deploy

  D1 migrations:
    npx wrangler d1 execute database_id --remote --file=migrations/0002_ugrs_grid.sql


DATABASE SCHEMA (D1)
--------------------
  scenarios       - id, name, status, config (JSON: grid, frozen state)
  actors          - id, scenario_id, callsign, team, status, lane_id, cell_id
  lanes           - id, scenario_id, lane_id, label, sort_order, config
  grid_cells      - id, scenario_id, cell_id, col, row, lane_id, status, tension, notes
  events          - id, scenario_id, actor_id, event_type, payload (JSON), created_at
  dead_drops      - id, scenario_id, lane_id, cell_id, label, status, placed_by, etc.
  join_codes      - id, code, scenario_id, team, uses_remaining
  auth_tokens     - id, token_hash, actor_id, scenario_id, expires_at


KEY SYSTEMS
-----------

  UGRS (Urban Grid Reference System)
    Coordinate grid overlaid on map. Cells have status (working/degraded/
    compromised/offline/unknown), tension (0-100), lane assignments, and
    contain actors and dead drops. Calibrated via cols x rows.

  M Ping System
    M sends structured directives to actors: MOVE, HOLD, ENGAGE, SHADOW,
    DROP, ESCALATE, FREEZE, EXTRACT. Actors receive full-screen flash
    notification with 30-second ACK countdown. M tracks ACK times.

  MOK (Director AI Layer)
    SVG triangle HUD in M header. 5 visual states (idle, monitoring,
    advisory, urgent, engaged). Private MOK feed with squelch controls.
    window._MOK API for future AI integration. Currently rule-based:
    reacts to WebSocket events (check-ins, escalations, ACKs, freezes).

  Operation Bar
    Persistent metrics: elapsed time, threat level (derived from avg
    tension), actor counts, tension %, cell count.

  Actor Network
    Full actor roster with status dots, cell assignments. Click-through
    to actor panel with ping buttons and ping history.

  Freeze System
    Global game freeze broadcasts to all connected clients. M Mode shows
    red overlay on map. Ops shows full-screen freeze notification.


SCENARIO ENGINE (NEXT PHASE)
-----------------------------
The scenario engine is the authoring and runtime system for live operations.
Design document: scenarioenginedesign.docx

Planned implementation layers:

  1. Mission Brief Layer
     - Scenario metadata: team size, playtime, difficulty, briefing text
     - Stored in scenarios.config JSON

  2. Lane Network Layer
     - Physical play space divided into lanes with grid cells
     - Lane statuses: safe, neutral, contested, burned, locked, extraction-only
     - ALREADY IMPLEMENTED: lanes + UGRS grid cells

  3. Objective Chain Engine
     - Modular objectives: locate, decode, retrieve, deliver, observe, avoid
     - Objectives can be skipped, moved, duplicated live by M
     - Need: objectives table, objective_chains table, objective status tracking
     - Need: UI for M to manage objective chain in real-time

  4. Escalation Timeline Engine
     - 6-phase emotional curve: calm -> observation -> contact -> pressure -> collapse -> extraction
     - Phase triggers: time-based, event-based, M-override
     - PARTIALLY IMPLEMENTED: tension system + escalation events
     - Need: phase state machine, auto-escalation timer, phase transition triggers

  5. Actor Script Matrix
     - Conditional behavior triggers (not fixed scripts)
     - When [condition] then [actor behavior]
     - PARTIALLY IMPLEMENTED: M pings define actor behavior directives
     - Need: script template system, conditional trigger engine

  6. Event Injection Library
     - Categories: Surveillance, Intel, Pressure, Environmental
     - Subtle and aggressive variants
     - PARTIALLY IMPLEMENTED: event injection endpoint
     - Need: categorized event library, pre-built event templates, quick-fire buttons

  7. Extraction Engine
     - Convergent extraction with trigger conditions
     - Multiple extraction modes: clean, hot, emergency
     - Need: extraction state, extraction trigger conditions, actor rally points

  8. Failure + Recovery Design
     - Every objective: success path, fail path, recovery path
     - No hard game-over states
     - Need: recovery branching logic in objective chain

  9. MOK Intelligence Integration
     - Rule-based stall detection (no events in N minutes)
     - Tension curve analysis
     - Suggestion engine (button-executable actions)
     - Auto-director mode (MOK can deploy hints, reposition actors)
     - Need: mok.ts service, periodic assessment endpoint, suggestion UI


SCENARIO ENGINE LANGUAGE (SEL)
-------------------------------
A declarative authoring format for scenarios. Compiles to scenario config
stored in D1. Human-readable, version-controllable.

Planned syntax concepts (from scenarioenginedesign.docx):

  SCENARIO "The Dead Letter" {
    duration: 90min
    difficulty: moderate
    teams: 1
    players: 2-4
    actors: 3-5
  }

  LANE ALPHA {
    blocks: 3
    status: safe
    cells: [A1, A2, A3, A4]
  }

  OBJECTIVE locate_drop {
    type: locate
    lane: ALPHA
    description: "Find the dead drop at the memorial"
    success: -> decode_message
    fail: -> hint_redirect
    recovery: -> actor_delivers_hint
  }

  ESCALATION phase_2 {
    trigger: after 20min OR objective_complete(locate_drop)
    tension: +30 on ALPHA
    actor_behavior: engagement_level 1
    event: surveillance_sweep
  }

  ACTOR_SCRIPT watcher_pattern {
    when: players_in(ALPHA) AND escalation >= 2
    do: SHADOW nearest_player
    duration: 10min
    then: HOLD
  }

  EXTRACTION convergence {
    trigger: all_objectives_complete OR escalation >= 5 OR m_override
    rally: F4
    mode: clean
  }


PERSISTENCE
-----------
  D1 database:        All server state (scenarios, actors, events, grid)
  localStorage:       Session tokens, map images, grid config (client-side)
  Durable Objects:    WebSocket rooms per scenario (real-time broadcast)
  R2:                 Map images, scenario assets (future)


KNOWN CONSTRAINTS
-----------------
  - MetaMask SES Lockdown: Breaks Preact's render() silently. All UI uses
    vanilla DOM API fallback. Preact code exists but is bypassed.
  - D1 database_name in wrangler.jsonc is literally "database_id" (not "eyesonly-db")
  - Build scripts: npm run build:mmode (not "build")
  - Non-interactive deploy needs CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL env vars
  - Auth tokens are SHA-256 hashed, single-scenario scoped
