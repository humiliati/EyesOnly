# player-AI-integration-guide-tutorialalpha

**Purpose:** A TODO + hookup guide for adding a **Highscore** surface to flapsandseals.com that supports **humans and AIs** (incl. OpenClaw-connected agents) competing across three games:
- **Gone Rogue**
- **Street-Chronicles**  
- **EyesOnly Live**

This document is written to hand to engineers: it lists *what to build*, *where it should live*, *what data we need*, and *how to plug in AI runners later*.

---

## 0) Target directories / routes

Create highscore page under:
- `flapsandseals.com/highscore/` (new)

Also reference existing areas:
- `flapsandseals.com/m` (main / modules)
- `flapsandseals.com/ops` (ops / admin / internal surfaces)

### 0.1 Left column navigation

Add a new left-column button alongside existing:
- `/help` - Context-aware help
- `/login` - Authentication portal
- `/back` - Navigation back
- `/map` - Street-Chronicles access

**New button:**
- `/highscore` - Leaderboards & competitions

**Current implementation location:**
- Button elements: `public/index.html:78-91`
- Button handler: `public/js/ui-controls.js:40-287` (handleButtonClick function)

**UI note:** Maintain site-wide aesthetic; add *pinball/classic arcade* embellishment to accent toyfulness **without breaking** the current design language.

---

## 1) Highscore page layout

### 1.1 Container + tabs

Highscore page contains a folder-like container with **3 tabs**:
1. **Gone Rogue** - Roguelike dungeon crawler
2. **Street-Chronicles** - Text adventure exploration
3. **EyesOnly Live** - ARPG live exercise

### 1.2 Context-sensitive default tab

When user navigates to `/highscore`, the default active tab should be inferred from current context:

- If user is in **command terminal → EyesOnly** context → open **EyesOnly Live** tab
- If user is in **Street-Chronicles** context → open **Street-Chronicles** tab
- If user is in **Gone Rogue** context → open **Gone Rogue** tab
- Otherwise → default to **Gone Rogue** tab

**Current context detection hookups:**
- **GAMESTATE module**: `public/js/gamestate.js:57-60` - `getState()` returns current mode
  - `mode: 'street'` → Street-Chronicles active
  - `mode: 'rogue'` → Gone Rogue active
- **GoneRogue.isActive()**: `public/js/gone-rogue.js` - Check if Gone Rogue running
- **StreetChronicles.isActive()**: `public/js/street-chronicles.js:71-91` - Check if Street-Chronicles active

**TODO:** 
- [x] Context signal source identified: `GAMESTATE.getState()`
- [ ] Implement context reader in highscore page
- [ ] Persist last selected tab in localStorage (`highscore:lastTab`)

---

## 2) Data model (canonical)

We need a shared scoreboard model with per-game schemas.

### 2.1 Common row fields

For every leaderboard row (human or agent):
- `entry_id` (uuid)
- `game_id` (enum: `gone_rogue|street_chronicles|eyesonly_live`)
- `mode` (enum: `human|agent`)
- `display_name` (string) — *player or agent name*
- `run_id` (string/uuid) — optional but recommended for audit/replay
- `score` (number) — **primary** sort key (descending)
- `metadata` (json) — game-specific stats (see below)
- `created_at` (timestamp)
- `client_version` (string) — optional
- `verdict` (enum: `pending|valid|rejected`) — if we add verification pipeline

### 2.2 Game-specific metadata

#### A) EyesOnly Live

Fields:
- `extracted` (boolean) — `[y/n]`
- `rank` (number|string) — rank achieved
- `note` (string) — description note sourced from `/m` (see hookup section)

**Current hookups:**
- Mission system: Likely in `public/m/` directory
- Scenario tracking: `public/js/api-client.js:92-95` - `getScenario()`
- Status: Would need to be captured from mission completion

#### B) Street-Chronicles

Fields:
- `completed` (boolean) — `[y/n]`
- `items_found` (number)

**Current hookups:**
- Active state: `public/js/street-chronicles.js:71-91` - `process()` function
- Inventory: `public/js/street-chronicles.js` - `_state.inventory` (internal state)
- Location: `public/js/street-chronicles.js` - `_state.location`
- Public accessor: `StreetChronicles.getInventory()` - Returns inventory array

**TODO:**
- [ ] Add `StreetChronicles.getStats()` public method to return:
  - `completed: boolean`
  - `itemsFound: number`
  - `locationsVisited: number`

#### C) Gone Rogue

Fields:
- `completions` (number) — successful extractions
- `lowest_damage_taken` (number) — minimum damage in any run
- `most_damage_dealt_run` (number) — max damage in any run
- `most_damage_dealt_single_action` (number) — highest single hit
- `player_deaths` (number) — total deaths

**Current hookups:**

*Player state* (`public/js/gone-rogue.js`):
- HP tracking: Line 537-550 - `_statusLines()` shows `_player.hp` and `_player.maxHp`
- Current floor: Line 30-53 - `_floor` variable
- Turn counter: Line 30-53 - `_turn` variable
- Combat entries: Line 30-53 - `_player.combatEntries`

*State persistence* (`public/js/gone-rogue.js:3214-3242`):
```javascript
function _saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    active: _active,
    player: _player,
    enemies: _enemies,
    items: _items,
    projectiles: _projectiles,
    breakables: _breakables,
    turn: _turn,
    floor: _floor
  }));
}
```

*STR Combat* (`public/js/gone-rogue.js:30-53`):
- Combat active: `_strCombatActive` flag
- Combat state: `_strCombatState` object with damage tracking

*Damage tracking* (needs enhancement):
- Current: Damage dealt in STR combat is tracked per-encounter
- **TODO**: Add global damage counters:
  - `_totalDamageTaken` -累积受到的伤害
  - `_totalDamageDealt` - 累积造成的伤害
  - `_maxSingleActionDamage` - 单次最大伤害
  - `_runDamageDealt` - 本次运行造成的伤害

*Death tracking* (**needs implementation**):
- **TODO**: Add `_playerDeaths` counter that persists across runs
- **TODO**: Add `_handlePlayerDeath()` function enhancement to increment counter
- **TODO**: Store in localStorage separate from run state

*Completion tracking* (**needs implementation**):
- **TODO**: Add `_successfulExtractions` counter
- **TODO**: Increment on successful extraction (exit command at extraction point)
- **TODO**: Store in localStorage for highscore submission

**Recommended new public API for Gone Rogue:**
```javascript
GoneRogue.getHighscoreStats() {
  return {
    completions: _successfulExtractions || 0,
    lowestDamageTaken: _lowestDamageInAnyRun || Infinity,
    mostDamageDealtRun: _maxDamageDealtInAnyRun || 0,
    mostDamageDealtSingleAction: _maxSingleActionDamage || 0,
    playerDeaths: _playerDeaths || 0,
    currentRunStats: {
      damageTaken: _totalDamageTaken || 0,
      damageDealt: _runDamageDealt || 0,
      floor: _floor,
      turn: _turn
    }
  };
}
```

---

## 3) Tables per tab (UI requirements)

Each tab shows a table with:
- **Name** (player/agent)
- **Achievement Score** (primary score)
- **Key stats** (compact columns from metadata)

### 3.1 Sorting
- Default: sort by `score` descending
- Secondary: `created_at` descending

### 3.2 Filters
- [ ] Filter toggle: `All | Humans | Agents`
- [ ] Optional: `This week | All time`

### 3.3 Row affordances (later)
- [ ] Expand row → show run details (seed, build, actions)
- [ ] "Replay" button if run_id can be replayed

---

## 4) Hookups (what to point at now)

We want to "point at current hook-ups in the doc while it's still fresh."

### 4.1 Current sources of truth

#### EyesOnly Live
**Where do we store "extracted, rank, note" today?**

Source locations:
- M-Mode interface: `src/m-mode/index.tsx:18-32` - Main app component
- Scenario state: `src/ops-ui/store.ts:97-273` - `fetchScenario()`, session management
- API client: `public/js/api-client.js:92-95` - `getScenario()`

**TODO:**
- [ ] Identify exact mission completion endpoint
- [ ] Define extraction success criteria
- [ ] Map rank calculation logic
- [ ] Define note field source (mission briefing? completion message?)

#### Street-Chronicles
**Where do we store completion + items found?**

Source: `public/js/street-chronicles.js`
- State object: `_state` (internal) contains:
  - `location` - Current location
  - `inventory` - Items collected
  - `visitedLocations` - Set of visited locations
  - `idleTurns` - Turn counter
- Public accessor: `getInventory()` - Returns inventory array
- Completion detection: Would be based on specific location or item collection trigger

**TODO:**
- [ ] Define completion criteria (reach specific location? collect all items?)
- [ ] Add `getCompletionStatus()` public method
- [ ] Track `itemsFound` counter separately from inventory (in case items are used/dropped)

#### Gone Rogue
**Where do we store completions + damage stats + deaths?**

Source: `public/js/gone-rogue.js`

*Existing tracking:*
- Player state: `_player` object (hp, maxHp, energy, stats, etc.)
- Floor progress: `_floor` variable
- Turn counter: `_turn` variable
- Combat entries: `_player.combatEntries`
- State persistence: `_saveState()` to localStorage
- Headless API: `GoneRogue.headless` namespace (lines added in recent commits)

*Extraction points:*
- Exit tiles: `▼` character in grid
- Command: `EXTRACT` or `EXIT` at extraction point

**TODO (prioritized):**
1. [ ] Add persistent stats storage (separate from run state):
   - `eyesonly_gonerogue_career_stats` localStorage key
   - Structure: `{ deaths: 0, completions: 0, maxDamageRun: 0, maxSingleHit: 0, minDamageTaken: Infinity }`
2. [ ] Enhance `_handlePlayerDeath()` to increment death counter
3. [ ] Add extraction success handler to increment completions
4. [ ] Track damage in real-time during STR combat and enemy attacks
5. [ ] Update career stats on extraction/death
6. [ ] Add `GoneRogue.getCareerStats()` public accessor

### 4.2 Score submission event (client)

Define a single client-side function:

```typescript
function submitHighscore(entry: HighscoreEntry): Promise<void>
```

**Location options:**
1. New module: `public/js/highscore-client.js`
2. Extension of ApiClient: `public/js/api-client.js` (add `submitHighscore` method)

**Called at:**
- End-of-run / extraction / completion
- For humans: invoked by game client
- For agents: invoked by agent runner / audit engine

**Integration points:**
- Gone Rogue: Call on extraction success or death
- Street-Chronicles: Call on completion trigger
- EyesOnly Live: Call on mission end

**Existing API structure:** `public/js/api-client.js`
- Pattern: `function methodName() { return _post('/endpoint', data); }`
- Already has session management
- Uses Promise pattern

---

## 5) Server endpoints (minimal MVP)

### 5.1 Public read
- `GET /api/highscore?game_id=...&mode=...&window=...`
  - Query params:
    - `game_id`: `gone_rogue|street_chronicles|eyesonly_live`
    - `mode`: `all|human|agent`
    - `window`: `week|month|alltime` (default: `alltime`)
    - `limit`: number (default: 100)
    - `offset`: number (default: 0)
  - Returns: `{ entries: HighscoreEntry[], total: number, hasMore: boolean }`

### 5.2 Write (guarded)
- `POST /api/highscore/submit`
  - Body: `HighscoreEntry` object
  - Returns: `{ entry_id: string, verdict: 'pending'|'valid' }`
  - Requires authentication (see below)

**TODO:** Server implementation locations
- Backend route handler: `src/worker/routes/` (new file: `highscore.ts`)
- Database schema: Define in backend (D1 or KV)
- Validation logic: Check metadata schema per game

**Existing route structure references:**
- M-Mode routes: `src/worker/routes/m-mode.ts`
- Ops routes: `src/worker/routes/ops.ts`
- Public routes: `src/worker/routes/public.ts`

### 5.3 Auth model

**For humans (logged in):**
- Use existing session auth from `ApiClient._session`
- Token stored in `eyesonly_api_session` localStorage key
- Pattern: `Authorization: Bearer <token>` header

**For agents:**
- Token-based auth with strict scoping
- Agent runner provides API key
- Separate token namespace from humans
- Rate limits per agent ID

**TODO:**
- [ ] Define agent registration flow
- [ ] Create agent API key generation endpoint
- [ ] Add agent scoping to existing auth middleware

---

## 6) AI integration (OpenClaw / bring-your-own-agent)

Goal: players can plug in their own agent API (including OpenClaw) so AIs and humans can compete.

### 6.1 Concept: "Agent Runner Adapter"

We define a strict interface for any agent runner to participate:

```typescript
interface AgentRunner {
  id: string
  displayName: string
  version: string
  // called to start a run in a given game
  run(gameId: GameId, scenario: ScenarioSpec): Promise<RunResult>
  // optional: provide action trace for audit/replay
  getTrace?(): ActionTrace
}
```

**Current implementation:** `public/tests/agent-headless-adapter.js`
- Class: `HeadlessGameAdapter`
- Features:
  - Human-like IO constraints (timing, jitter)
  - Path binding (no teleportation)
  - Action validation
  - History tracking
  - Trace export

**Integration points:**
- Headless API: `public/js/gone-rogue.js` - `GoneRogue.headless` namespace
  - `getState()` - Get complete game state
  - `getLegalActions()` - Get valid actions
  - `applyAction(action)` - Execute action
  - `getGrid()` - Export map data
  - `resetToState(state)` - Restore state

### 6.2 Constraint: same rules as humans

**Enforced constraints:**
- Agents must be bound to the same UI/action primitives (single tap/click, swipe, wait)
- No hidden state peeking beyond what `getState()` provides
- Movement must follow pathfinding rules (no teleportation)
- Action timing constraints (minimum delay between actions)

**Implementation:** `public/tests/agent-headless-adapter.js`
```javascript
class HeadlessGameAdapter {
  constructor(options) {
    this.minActionDelay = options.minActionDelay || 50; // ms
    this.enableJitter = options.enableJitter !== false;
    this.strictPathBinding = options.strictPathBinding !== false;
  }
  
  async applyAction(action) {
    // Enforce timing
    await this._waitForNextAction();
    // Validate legality
    if (!this._isActionLegal(action)) {
      return { success: false, error: 'Illegal action' };
    }
    // Execute through headless API
    return this.gameInstance.headless.applyAction(action);
  }
}
```

**Any privileged APIs used for automation must be:**
1. Mirrored with a human-accessible affordance, OR
2. Treated as "training only" and excluded from public leaderboards

### 6.3 OpenClaw hookup path

We want a clear on-ramp:

**UI Flow:**
1. Navigate to `/highscore` page
2. Click "Connect Your Agent" button (in Agents filter view)
3. Wizard presents options:
   - **Option A:** Provide your own model API
     - Input: API key
     - Input: Agent runner URL
   - **Option B:** Use OpenClaw relay
     - Input: OpenClaw relay token (scoped)
4. System validates connection
5. Agent appears in agent roster
6. Can now run agent through run harness

**Current agent integration:** `public/js/agent-integration.js`
- Two modes: Natural play, Developer mode
- Integration with UI via MOK interjection
- Real-time action announcements
- MVP report generation

**TODO:**
- [ ] Create "Connect Your Agent" UI wizard
- [ ] Add agent configuration storage (localStorage: `agent_configs`)
- [ ] Implement agent runner loader (loads agent script from URL)
- [ ] Add OpenClaw relay client
- [ ] Integrate with highscore submission flow

**Security guardrails:**
- [ ] No exposure of user secrets to the game client
  - API keys sent to backend only
  - Backend proxies agent requests
- [ ] Agent runner must be sandboxable
  - Load in iframe or worker
  - Strict CSP headers
  - Local-first option supported
- [ ] Rate limits per account
  - Max runs per hour/day
  - Throttle submission frequency
- [ ] Audit log of agent actions per submitted score
  - Store action trace with submission
  - Hash trace for verification

### 6.4 Verification pipeline (optional but recommended)

To prevent obvious cheating:

**Action trace verification:**
- [ ] Require action trace hash + seed with submission
- [ ] Server can re-simulate runs using:
  - Agent headless adapter
  - Same seed
  - Same action sequence
- [ ] Compare final state (score, completion, stats)
- [ ] Mark entries `pending` until verified

**Implementation approach:**
1. Client submits: `{ entry, actionTrace, seed }`
2. Server stores entry with `verdict: 'pending'`
3. Background worker re-runs simulation
4. Worker updates `verdict: 'valid'` or `'rejected'`
5. Only `valid` entries appear on public leaderboards

**Spot-check strategy:**
- Verify 100% of agent submissions initially
- After trust established, spot-check 10-20%
- Always verify top 10 entries
- Flag suspicious patterns (too fast, impossible damage, etc.)

**Current replay infrastructure:**
- Deterministic agent: `public/tests/agent-enhanced-features.js` - `DeterministicAgent` class
- Seed system: RNG with seeding support
- Action trace export: Already implemented in agent adapter

---

## 7) UX notes (keep it playful, keep it legible)

- Maintain current site aesthetic
  - Monospace font (current: likely 'Courier New' or 'Consolas')
  - Green-on-black terminal aesthetic
  - Minimal, clean lines

**Add subtle arcade/pinball flair:**
- Chrome highlights on tab headers (CSS `text-shadow`, `box-shadow`)
- Scanlines (very light, CSS overlay with opacity ~0.05)
- Score "flip" animation (CSS transition on number change)
- Cabinet-style tab headers (beveled edges, gradient)
- Retro color accents (amber, cyan for highlights)

**Reference current style:**
- CSS root: `public/css/` directory
- Color variables: Likely `--accent`, `--text-dim`, etc.
- Button styles: See `public/index.html:162-181` (ctrl-btn classes)

**Avoid:**
- Heavy neon (keep subtle)
- Gimmicky particles that reduce readability
- Excessive animation (performance + distraction)
- Breaking existing color scheme

---

## 8) Engineer TODO checklist (handoff)

### UI
- [ ] Add `/highscore` left-nav button
  - Location: `public/index.html` - Add button element
  - Handler: `public/js/ui-controls.js` - Add `case 'highscore'` to `handleButtonClick()`
- [ ] Create highscore page HTML (`public/highscore.html` or integrate in main page)
- [ ] Implement 3-tab container (Gone Rogue, Street-Chronicles, EyesOnly Live)
- [ ] Context-sensitive default tab
  - Read from `GAMESTATE.getState().mode`
  - Persist in `localStorage.getItem('highscore:lastTab')`
- [ ] Build leaderboard tables with columns:
  - Name, Score, Key Stats (game-specific)
- [ ] Add filters: All/Humans/Agents toggle
- [ ] Style with arcade/pinball aesthetic (subtle)

### Data + API
- [ ] Define `HighscoreEntry` TypeScript interface
- [ ] Create database schema (D1 or KV)
- [ ] Implement `GET /api/highscore` endpoint
  - File: `src/worker/routes/highscore.ts` (new)
  - Query handling, filtering, pagination
- [ ] Implement `POST /api/highscore/submit` endpoint
  - Validation, auth check, rate limiting
- [ ] Add to router: `src/worker/index.ts` or similar
- [ ] Test endpoints with Postman/curl

### Hookups per game

#### Gone Rogue
- [ ] Add persistent career stats storage
  - localStorage key: `eyesonly_gonerogue_career_stats`
  - Fields: deaths, completions, damage stats
- [ ] Implement death counter
  - Enhance `_handlePlayerDeath()` function
  - Increment `_careerStats.deaths`
- [ ] Implement completion counter
  - Add extraction success handler
  - Increment `_careerStats.completions`
- [ ] Add damage tracking
  - Track `_totalDamageTaken` during enemy attacks
  - Track `_runDamageDealt` during STR combat
  - Update `_maxSingleActionDamage` on hits
- [ ] Create `GoneRogue.getCareerStats()` public method
- [ ] Call `submitHighscore()` on extraction or death

#### Street-Chronicles
- [ ] Define completion criteria
  - Specific location reached?
  - All key items collected?
- [ ] Add completion status tracker
  - Add `_completionStatus` to state
  - Check on each action
- [ ] Create `StreetChronicles.getStats()` public method
  - Return: `{ completed, itemsFound, locationsVisited }`
- [ ] Call `submitHighscore()` on completion

#### EyesOnly Live
- [ ] Identify mission completion hook
  - Check M-Mode integration
  - Check ops/scenario endpoints
- [ ] Track extraction status
- [ ] Track rank/score
- [ ] Capture completion notes
- [ ] Call `submitHighscore()` on mission end

### Agent integration
- [ ] Define `AgentRunner` adapter interface (TypeScript)
- [ ] Build "Connect your agent" wizard UI
  - Modal or separate page
  - Forms for API key, runner URL, or OpenClaw token
- [ ] Implement agent configuration storage
  - localStorage: `agent_configs` array
- [ ] Create agent runner loader
  - Load agent script from URL
  - Sandboxing (iframe/worker)
- [ ] Implement OpenClaw relay client
  - API endpoint for relay
  - Token validation
- [ ] Add agent submission flow
  - Agent runs game
  - Captures action trace
  - Submits with seed
- [ ] Implement trace hashing
  - Hash action trace for verification
  - Store hash with submission
- [ ] Build verification worker (optional Phase 2)
  - Re-simulate runs
  - Compare results
  - Update verdict

---

## 9) Open questions (for next pass)

### Scoring
- **Q:** What is the canonical definition of `score` per game? (single number)
  - Gone Rogue: Floor reached? (floor × 1000 + turns remaining?)
  - Street-Chronicles: Locations visited? Items collected?
  - EyesOnly Live: Mission rank? Extraction speed?
- **A:** TODO - Define scoring formula per game

### Versioning
- **Q:** Do we allow separate leaderboards per version/season?
  - E.g., "Season 1", "v1.2.0"
- **A:** TODO - Decide on version strategy
  - Option: Add `season_id` field to entries
  - Option: Archive old leaderboards periodically

### Private leaderboards
- **Q:** Do we allow private leaderboards (per user) for training/testing?
  - Useful for agent developers
  - Separate from public leaderboard
- **A:** TODO - Decide on private leaderboard support
  - Could use `visibility: 'public'|'private'` field
  - Filter on public leaderboard API

### Minimum verification
- **Q:** What's the minimum verification needed before opening to public agents?
  - Action trace validation?
  - Spot-checking?
  - Full re-simulation?
- **A:** Recommendation:
  - Phase 1 (MVP): Manual review of top entries
  - Phase 2: Automated spot-checking (10-20% of submissions)
  - Phase 3: Full verification pipeline with re-simulation

### Replay storage
- **Q:** Where do we store action traces for replay?
  - With entry in database?
  - Separate blob storage?
  - Expiration policy?
- **A:** TODO - Design replay storage strategy
  - Recommendation: Store trace hash always, full trace for top 100

---

## 10) Implementation roadmap (recommended)

### Phase 1: MVP (2-3 weeks)
**Goal:** Basic highscore page with manual submission

- [ ] UI: Highscore page with 3 tabs, basic tables
- [ ] API: GET/POST endpoints with auth
- [ ] Gone Rogue: Add career stats, submission hook
- [ ] Manual testing and bug fixes

**Deliverables:**
- Working highscore page
- Human players can submit scores
- Leaderboards display correctly

### Phase 2: Automation (1-2 weeks)
**Goal:** Automatic score submission from all games

- [ ] Gone Rogue: Auto-submit on extraction/death
- [ ] Street-Chronicles: Auto-submit on completion
- [ ] EyesOnly Live: Auto-submit on mission end
- [ ] Add filters, sorting, time windows

**Deliverables:**
- Scores automatically recorded
- Rich filtering and sorting
- Game completion metrics tracked

### Phase 3: AI Integration (2-4 weeks)
**Goal:** Agent competition enabled

- [ ] Agent runner interface finalized
- [ ] "Connect your agent" wizard
- [ ] OpenClaw integration
- [ ] Verification pipeline (spot-checking)
- [ ] Agent leaderboard

**Deliverables:**
- AI agents can compete
- OpenClaw agents supported
- Verification prevents obvious cheating
- Public + agent leaderboards live

---

## 11) Current codebase integration summary

### Existing infrastructure we can leverage

#### Game State Management ✅
- **GAMESTATE module**: `public/js/gamestate.js`
  - Mode tracking (street vs rogue)
  - Inventory persistence
  - Save/load functionality
  - Already integrated with both games

#### Agent Testing Infrastructure ✅
- **Headless API**: `public/js/gone-rogue.js`
  - Complete game state export
  - Legal actions enumeration
  - Action execution
  - State restoration
- **Agent Adapter**: `public/tests/agent-headless-adapter.js`
  - Human-like constraints
  - Action validation
  - Trace export
- **Agent Integration**: `public/js/agent-integration.js`
  - UI integration via MOK
  - Natural vs developer modes
  - Real-time feedback

#### API Client ✅
- **ApiClient module**: `public/js/api-client.js`
  - Session management
  - Auth handling
  - Promise-based API calls
  - Easy to extend with `submitHighscore()`

#### UI Framework ✅
- **UI Controls**: `public/js/ui-controls.js`
  - Button handlers
  - Context switching
  - Terminal integration
- **HTML Structure**: `public/index.html`
  - Left column buttons
  - Terminal display
  - Debrief feed

### What needs to be built

#### New Pages/Components
- [ ] Highscore page UI
- [ ] Leaderboard tables
- [ ] Agent connection wizard
- [ ] Replay viewer (future)

#### New Backend
- [ ] Highscore API endpoints
- [ ] Database schema
- [ ] Verification worker
- [ ] Agent auth system

#### Game Enhancements
- [ ] Gone Rogue: Career stats tracking
- [ ] Street-Chronicles: Completion detection
- [ ] EyesOnly Live: Mission completion hooks
- [ ] All games: Score submission calls

---

## 12) File path quick reference

For engineer convenience, here's a quick lookup of all key files mentioned:

### Frontend - UI
- `public/index.html` - Main page structure, button definitions
- `public/js/ui-controls.js` - Button handlers, navigation logic

### Frontend - Games
- `public/js/gone-rogue.js` - Gone Rogue game engine
- `public/js/street-chronicles.js` - Street-Chronicles game engine
- `public/js/gamestate.js` - Global game state management

### Frontend - Agent Testing
- `public/tests/agent-headless-adapter.js` - Agent adapter with constraints
- `public/tests/agent-mvp-audit.js` - Agent testing framework
- `public/js/agent-integration.js` - Agent UI integration
- `public/tests/agent-enhanced-features.js` - Deterministic agent, boss checker, A/B testing

### Frontend - API
- `public/js/api-client.js` - API client, auth, session management

### Backend (TypeScript)
- `src/worker/routes/m-mode.ts` - M-Mode API routes
- `src/worker/routes/ops.ts` - Ops API routes
- `src/worker/routes/public.ts` - Public API routes
- `src/worker/routes/` - **NEW:** `highscore.ts` (to be created)

### Documentation
- `docs/GONE_ROGUE.md` - Gone Rogue documentation
- `docs/PHASE3_STR_COMBAT_COMPLETE.md` - STR combat system docs
- `public/tests/README-AGENT-ENGINE.md` - Agent engine documentation
- `public/tests/AGENT-UI-INTEGRATION-GUIDE.md` - Agent UI integration guide
- `public/tests/HEADLESS-INTEGRATION-COMPLETE.md` - Headless API docs
- `public/tests/MVP-AUDIT-GAP-ANALYSIS.md` - MVP audit analysis

---

## Conclusion

This document provides a complete roadmap for implementing the highscore system with AI agent integration. Engineers now have:

✅ **Clear architecture** - 3-tab page, data model, API structure
✅ **Exact file paths** - All integration points identified
✅ **Current hookups** - What exists and where to find it
✅ **Missing pieces** - What needs to be built
✅ **Security guidelines** - Agent constraints and verification
✅ **Implementation roadmap** - Phased approach

**Next steps:**
1. Review this document with team
2. Prioritize Phase 1 features
3. Assign tasks to engineers
4. Begin implementation

**Questions?** Reference the file paths in Section 12 and explore the existing code. Most integration patterns already exist in the codebase.
