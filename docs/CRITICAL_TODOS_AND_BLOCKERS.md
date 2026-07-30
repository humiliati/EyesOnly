# Critical TODOs and Blockers - Project Rollout Analysis

**Analysis Date**: 2026-02-19
**Purpose**: Identify critical TODOs and open questions stalling the EyesOnly project rollout

---

## Executive Summary

The EyesOnly project is a sophisticated full-stack platform combining live espionage operations (Flaps & Seals) with an ASCII roguelike minigame (Gone Rogue) and an ARG recruitment terminal. The codebase is well-documented with mature technical architecture, but **5 critical implementation gaps and 1 strategic decision** are blocking production rollout.

**Critical Path Items**:
1. ✅ **Canvas Rendering** - COMPLETE (Option C implemented)
2. 🔴 **Interactive Items Integration** - 3-4 hours, HIGH priority
3. 🔴 **User Account Creation** - 4 weeks, BLOCKING persistence
4. 🟡 **Kernel Persistence** - 1 week, blocks agent attribution
5. 🟡 **Card System Expansion** - 2+ weeks, affects gameplay depth
6. ⚠️ **Strategic Decision** - Architectural direction unclear

---

## 🟡 BLOCKER #1 (UPDATED): Account & Inventory Unification

**Status**: 🟡 In progress (core shipped; remaining standardization)
**Location**: `USER_ACCOUNT_CREATION_TODO.md`
**Impact**: Enables long-horizon seasonal play + cross-mode economy

### Shipped
- Account registration/login (`/api/user/register`, `/api/user/login`)
- Callsign uniqueness enforcement (`-2`, `-3`, …)
- Account-linked scenario join (`/api/join` requires user session)
- Ops moderation via `scenario_user_roles` + M UI
- Unified inventory grant path (ops retrieve → M GRANT → `user_inventory`)
- Cloud/local import (best-effort) via `POST /api/user/merge-local-data`
- Unified consume semantics via `POST /api/user/inventory/consume` (oldest-first)

### Remaining (still important)
- Standard inventory metadata schema (season/rarity/ladder tags)
- Wiring more client spend paths to server consume (beyond active item consume)
- Broader localStorage merge coverage + explicit conflict policy


### Legacy/Future: Why this blocked rollout (pre account-first model)

> **Legacy note:** The subsections below describe the older password/auth-code account creation design.
> We keep them as **future/optional** ideas.
>
> **Current blockers are captured above** under: _Remaining (still important)_.

- (LEGACY) Players cannot persist inventory across devices
- (LEGACY) Highscore submissions require login
- (FUTURE) Agent API integration depends on user accounts / kernel persistence
- (LEGACY) Currency/progress is lost on browser clear
- (FUTURE) Advanced attribution/retention tooling

### Legacy/Future: Missing Components (pre account-first model)

#### (FUTURE) 1. Frontend Registration UI (password/auth-code design)
**File**: `public/index.html`

- Username validation (3-20 chars, unique check)
- Email validation with regex
- Password strength meter
- M Console auth code input
- Optional agent API key fields
- Rate limiting

#### (FUTURE) 2. M Console Auth Code Generator
- 6-digit codes, expiry, single-use, countdown

#### (FUTURE) 3. Backend API Endpoints (auth-code model)
- `POST /api/auth/register`
- `POST /api/auth/verify-code`
- `GET /api/auth/check-username`
- `POST /api/auth/merge-local-data`

#### (FUTURE) 4. Data Migration Logic (broader localStorage import)
**Integration points**: `public/js/login-shell.js`, `public/js/gamestate.js`

- Read additional localStorage keys beyond `eyesonly_gamestate`
- Merge inventory/currency across sources
- Upload merged data to cloud
- Conflict resolution UI

### Database Schema Status
✅ **COMPLETE** - Schema defined in `migrations/0002_user_accounts.sql`:
- `user_accounts` - username, email, callsign, cryptos, preferences
- `webauthn_credentials` - WebAuthn registrations
- `user_sessions` - Session tokens with expiry
- `user_inventory` - Persistent inventory items
- `user_highscores` - Score tracking per game

### Implementation Checklist
- [ ] Design registration form UI (CRT terminal aesthetic)
- [ ] Implement username availability check
- [ ] Add password strength validation
- [ ] Create M Console auth code generator panel
- [ ] Build auth code verification API
- [ ] Implement localStorage data migration
- [ ] Add conflict resolution for cloud sync
- [ ] Wire up highscore submission hooks
- [ ] Test full registration flow
- [ ] Add email recovery mechanism

### Dependencies
- Requires Cloudflare Workers deployment with D1 database
- Needs HTTPS for production (WebAuthn requirement)
- Email service for recovery (optional for alpha)

**Priority**: 🔴 **CRITICAL** - Blocks production release

---

## 🔴 BLOCKER #2: Interactive Items System Integration

**Status**: ✅ Code complete, ❌ Not integrated into game engine
**Location**: `INTERACTIVE_ITEMS_TODO.md` (548 lines)
**Impact**: Visual feedback missing, world interaction disabled, polish incomplete
**Estimated Effort**: 3-4 hours

### Why This Matters
Without interactive items:
- No visual feedback for currency pickup (bouncing animations)
- Enemy alert expressions missing (! emoji when spotted)
- World items cannot be examined (lore/story delivery broken)
- Polish and juice removed from gameplay
- Tutorial flow incomplete (interact command missing)

### What's Complete ✅
The code is already written and documented:
- `public/js/overhead-animator.js` - Animation system for icons above entities
- `public/js/interactive-items.js` - World item management
- `public/js/item-spawner.js` - Designer-friendly placement engine
- CSS animations in `public/css/gone-rogue-mobile.css` (lines 1186-1357)

### What's Missing ❌

#### 10 Integration Points (HIGH priority, documented in INTERACTIVE_ITEMS_TODO.md):

1. **HTML Script Tags** (5 min)
   - Add `<script>` tags to `public/index.html` before closing `</body>`
   - Load: `overhead-animator.js`, `interactive-items.js`, `item-spawner.js`

2. **Game Engine Init** (10 min)
   - File: `public/js/gone-rogue.js` (line ~303, `start()` function)
   - Initialize OverheadAnimator, InteractiveItems, ItemSpawner
   - Add console logs for verification

3. **Floor Generation** (15 min)
   - File: `public/js/gone-rogue.js` (line ~750, `_generateFloor()`)
   - Spawn interactive items after enemy placement
   - Requires access to `rooms` array from generation

4. **Currency Pickup Animation** (10 min)
   - File: `public/js/gone-rogue.js` (line ~1700-1750)
   - Find currency collection logic (search `_currencies`)
   - Call `OverheadAnimator.showCurrencyPickup()` on pickup

5. **Enemy Alert Expression** (15 min)
   - File: `public/js/gone-rogue.js` (line ~2832-2864, `_updateEnemyAwareness()`)
   - Show ! expression when awareness crosses 71 threshold
   - Track previous awareness state to detect transitions

6. **Interactive Item Rendering** (20 min)
   - File: `public/js/gone-rogue-mobile.js` (line ~190, `renderGrid()`)
   - Add after breakable/item rendering
   - Show emoji for items, add `interactive-in-range` class

7. **Overhead Animation Rendering** (30 min)
   - File: `public/js/gone-rogue-mobile.js` (after grid cells created)
   - Performance-sensitive: render all active animations
   - Apply transforms (opacity, position, scale)

8. **Interactive Item Command Handler** (25 min)
   - File: `public/js/gone-rogue.js` (line ~400-500, `process()` function)
   - Add `interact`, `examine`, `read` commands
   - Implement `_handleInteraction()` function
   - Show overhead animations on successful interaction

9. **Tap-to-Interact Mobile** (15 min)
   - File: `public/js/gone-rogue-mobile.js` (line ~531, `_processGridInput()`)
   - Check for interactive item at tap position before tap-to-move
   - Trigger interaction if in range

10. **Save/Load Integration** (10 min)
    - File: `public/js/gone-rogue.js` (`_saveState()`, `_loadState()`)
    - Serialize/deserialize interactive items
    - Persist interaction state across sessions

### Files to Modify
- `/home/runner/work/EyesOnly/EyesOnly/public/index.html` - Script tags
- `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue.js` (8,528 lines) - Core integration
- `/home/runner/work/EyesOnly/EyesOnly/public/js/gone-rogue-mobile.js` (2,279 lines) - Rendering

### Testing Checklist (from INTERACTIVE_ITEMS_TODO.md)
- [ ] Overhead animator initializes without errors
- [ ] Currency pickup shows bouncing animation
- [ ] Enemy alert shows ! expression
- [ ] Interactive items spawn on floor generation
- [ ] Items render with correct emoji
- [ ] Player can interact with items in range
- [ ] Interaction shows thinking/reading expression
- [ ] Tooltip displays item text
- [ ] Save/load preserves interactive items
- [ ] Performance stable (60 FPS with canvas rendering)

**Priority**: 🔴 **HIGH** - Required for polish and player feedback

---

## 🟡 BLOCKER #3: Kernel Server-Side Persistence

**Status**: ✅ Database schema ready, ❌ API endpoints missing
**Location**: `docs/KERNEL_SERVER_PERSISTENCE_TODO.md` (107 lines)
**Impact**: Agent connections don't persist, leaderboard attribution broken
**Estimated Effort**: 1 week

### Why This Blocks Agent Features
Without kernel persistence:
- User loses agent connection on browser refresh
- Cannot attribute highscores to specific agents
- No way to manage/revoke connected agents
- Agent API keys not saved securely
- Cross-device agent state not synchronized

### Database Schema Status
✅ **COMPLETE** - Schema defined in `migrations/0003_kernel_persistence.sql`:

```sql
kernel_agents (
  id, user_id, agent_name, agent_url,
  created_at, updated_at, last_connected_at, is_active
)

kernel_sessions (
  id, user_id, kernel_agent_id, status, last_error,
  connected_at, disconnected_at, last_seen_at
)
```

### Missing API Endpoints
**File**: `src/worker/routes/kernel.ts` (may need expansion)

Need to implement:
- `GET /api/kernel/me` - Fetch persisted kernel state
- `POST /api/kernel/connect` - Save agent connection
- `POST /api/kernel/disconnect` - Mark disconnected
- `GET /api/kernel/agents` - List saved agents
- `DELETE /api/kernel/agents/:id` - Remove agent

### Client Integration Points
**Files**: `public/js/kernel-manager.js`, `public/js/login-shell.js`

Missing:
- Call `GET /api/kernel/me` on login success
- Restore KernelManager state if status is CONNECTED/ACTIVE_RUN
- Update button labels accordingly
- Save agent connection on successful connect
- Clear state on logout

### Security Controls Needed
- Rate limit connect/disconnect (prevent spam)
- Validate agent_url scheme (https in prod, http://127.0.0.1 for local)
- Sanitize URLs before storage
- Encrypt agent API keys at rest
- Rate limit agent API calls (10 req/sec)

### Highscore Attribution
**Future enhancement** - When highscore submission happens:
- Include `kernel_agent_id` (nullable)
- Include `agent_name` snapshot for display
- Enable mixed human/agent leaderboards

**Priority**: 🟡 **MEDIUM** - Blocks agent persistence and attribution

---

## 🟡 BLOCKER #4: Card Database Expansion

**Status**: ✅ 35+ cards implemented, ❌ Gap analysis identifies missing systems
**Location**: `CARD_DB_TODO.md` (58KB analysis, 1,665 lines)
**Impact**: Gameplay depth limited, resource system incomplete
**Estimated Effort**: 2+ weeks (large scope)

### Critical Resource System Gaps

#### Current Resources ✅
- Fatigue: 0-100 scale (functional)
- Ammo: 0-50 max (functional)
- HP: Pink bar tracking (functional)

#### Missing Resources ❌
- **Energy**: 0-5, resets per STR round (gates combo cards)
- **Focus**: 0-10, stealth/precision tracking (enables silent builds, critical hits)
- **Battery**: 0-5, gates tech cards (tech archetype blocked)
- **Stability**: 0-10 hidden stat (affects status effect resistance)

**Impact**: Without these resources, entire card archetypes are unplayable (tech, precision, combo builds).

### Missing Card Lifecycle Types

#### Implemented ✅
- Consumable cards (9 implemented)
- Exhaust cards (TOTAL_EVASION)

#### Missing ❌
- **Power cards**: Activated once, persist entire combat (missing type)
- **Multi-combat cooldown system**: Cards unavailable for N combats after use
- **Upgrade tiers**: Static definitions without instance-level upgrades

**Impact**: Limits deck-building strategy depth, no permanent buffs, no cooldown management.

### Missing Systems

#### 1. Environmental Tiles (NOT IMPLEMENTED)
- Oil tiles (slippery, flammable)
- Water tiles (conducts electricity)
- Fire tiles (damage over time)
- Needed for advanced combat interactions and elemental synergies

#### 2. Status Effect Integration (INCOMPLETE)
- Status effects defined in `status-effects.js` (577 lines)
- Display and tracking integration gaps
- Duration decay not fully wired
- Stack limits not enforced

#### 3. Inventory System (NOT IMPLEMENTED)
- 12-slot bonfire inventory (not implemented)
- 5-slot action bar system (not implemented)
- Needed for out-of-combat item management

### Files Requiring Changes
- `public/js/card-system.js` (1,537 lines) - Add new card types
- `public/js/gamestate.js` (1,188 lines) - Add 4 new resources
- `public/js/status-effects.js` (577 lines) - Complete integration
- New file: `public/js/environmental-tiles.js` - Create tile system
- New file: `public/js/bonfire-inventory.js` - Create inventory UI

### Implementation Phases

**Phase 1: Core Resources** (1 week)
- Add Energy, Focus, Battery, Stability to gamestate
- Wire resource bars to UI
- Test resource consumption/regeneration

**Phase 2: Power Cards** (3-4 days)
- Implement Power card lifecycle
- Add "persist until combat end" flag
- Test with 5-10 Power card definitions

**Phase 3: Environmental Tiles** (1 week)
- Design tile interaction system
- Implement oil/water/fire mechanics
- Add visual feedback (emoji or color overlay)

**Phase 4: Inventory System** (1 week)
- Build bonfire 12-slot inventory UI
- Implement 5-slot action bar
- Add drag-and-drop or tap selection

### Scope Reduction Option
If time-constrained, implement **Phase 1 only** (new resources) to unblock tech/precision archetypes. Defer Power cards and environmental tiles to post-launch.

**Priority**: 🟡 **MEDIUM-HIGH** - Affects gameplay depth, can be phased

---

## ⚠️ STRATEGIC DECISION: Rendering Architecture

**Status**: ✅ Canvas rendering (Option C) implemented, but architectural direction unclear
**Location**: `docs/GONE_ROGUE_DECKBUILDER_GAP_ANALYSIS.md` (24KB)
**Impact**: Future development direction undefined, may cause divergent work

### Context
Three architectural paths were identified, each with different technical debt and engagement benefits:

### Option A: Economy Pass (Double-Down ASCII/DOM)
**Philosophy**: Embrace terminal aesthetic, focus on deckbuilder depth

**Strengths**:
- ✅ Preserves unique terminal hacker aesthetic
- ✅ No rendering refactor required
- ✅ Works with existing 40x20 grid system
- ✅ Low technical risk

**Constraints**:
- ⚠️ DOM performance ceiling (8000 ops/sec bottleneck) - **SOLVED by Option C**
- ⚠️ Mobile readability challenges
- ⚠️ Limited visual feedback

**Scope**: Economy sheet, salvage/sink rules, vendor bonfire, duplicate detection
**Effort**: 2-3 weeks
**Target Audience**: Desktop terminal enthusiasts, ASCII roguelike fans

---

### Option B: Paper Mario Emoji Pivot (Locomotion Overhaul)
**Philosophy**: Break free from grid, create billboarded emoji world

**Strengths**:
- ✅ Mass-market accessibility (emoji universal language)
- ✅ Mobile-optimized visual clarity
- ✅ One-button input (confirm/cancel only)
- ✅ Differentiates from ASCII saturation

**Risks**:
- 🔴 Loses terminal hacker aesthetic identity
- 🔴 Entire locomotion system rewrite
- 🔴 Stealth mechanics need redesign
- 🔴 High technical debt

**Scope**: Free movement pathfinding, emoji sprite system, combat refactor, tutorial
**Effort**: 6-8 weeks
**Target Audience**: Mobile casual gamers, JRPG fans, non-gamers

**Note**: Requires canvas rendering (Option C) as foundation

---

### Option C: Canvas Rendering (Performance Foundation) ✅ IMPLEMENTED
**Philosophy**: Keep gameplay, fix engine

**Strengths**:
- ✅ **10-50x performance improvement** (measured)
- ✅ Enables 60fps gameplay on mobile
- ✅ Removes 4+ patrol enemy stutter
- ✅ Supports BOTH ASCII and emoji rendering
- ✅ Foundation for Option A or Option B

**Status**: ✅ **COMPLETE** as of 2026-02-19
- File: `public/js/gone-rogue-canvas.js` (11,813 lines)
- Feature flag: `USE_CANVAS_RENDERER` (default: true)
- Performance bottleneck eliminated

**Scope**: Canvas renderer module, touch coordinate mapping
**Effort**: Complete
**Impact**: Foundation in place, enables Option A or B

---

### ✅ STRATEGIC DECISION MADE: Option A (Economy Pass)

**Decision**: Going with Option A - finish existing systems wiring and leverage agent audit for expansion

**Rationale**:
- Target audience: Boomer puzzlers and iPad toddlers (authoritative)
- Focus on puzzle mechanics, accessibility, clear visual feedback
- Leverage terminal aesthetic with strong visual polish
- TODO: Designer-facing portals that match existing designer portals

**Next Steps**:
1. Complete interactive items wiring
2. Implement food/resource system
3. Wire up tutorial gate mechanics
4. Add visual feedback improvements (water slowdown animation, etc.)
5. Create designer portals for item placement
6. Focus on economy depth, salvage, vendor systems

**Priority**: ✅ **DECIDED** - Option A is the path forward

---

## 🟢 COMPLETE: Canvas Rendering Implementation

**Status**: ✅ **COMPLETE**
**Location**: `public/js/gone-rogue-canvas.js` (11,813 lines)
**Impact**: Performance bottleneck eliminated, 10-50x improvement

This was previously a critical blocker (Option C in gap analysis) but has been **fully implemented**:
- Single canvas rendering replaces 800 DOM element manipulation
- 60fps gameplay on mobile devices
- Feature flag: `USE_CANVAS_RENDERER` (default: true)
- Supports both ASCII and emoji rendering modes
- Removes 4+ patrol enemy stutter
- Foundation for future visual enhancements

**No further action required** ✅

---

## 🟡 BLOCKER #5: Blockout Visualizer — Phase 3 Schema Extraction

**Status**: ❌ Not started
**Location**: `BLOCKOUT_VISUALIZER_ROADMAP.md` (Phase 3), DCgamejam2026 `tools/extract-floors.js`
**Impact**: Blocks all meaningful expansion of the blockout visualizer editor
**Estimated Effort**: 1–2 days

### Why This Blocks Editor Work
The blockout visualizer (`tools/blockout-visualizer.html` in DCgamejam2026) embeds a hardcoded
77-entry `TILE_SCHEMA` copy-pasted from `engine/tiles.js`. The engine now has 80 tile types with
12 predicate functions — the visualizer is already 3 tiles behind. Every time `tiles.js` changes,
the visualizer drifts further. Without schema extraction:
- New tiles (WINDOW_SHOP, WINDOW_BAY, WINDOW_SLIT, DOOR_FACADE, TRAPDOOR_DN/UP) are invisible to the tool
- Predicate results (isDoor, isWalkable, isOpaque, isFreeform, isFloating, isWindow, etc.) are not available
  to enforce constraints in the editor
- Builder metadata (shops, spawn, doorTargets, doorFaces, biome) cannot be surfaced as editable fields
- The entire Tier 1–4 feature roadmap is gated behind correct schema data

### What Exists Today
- `tools/extract-floors.js` — Node script that loads `tiles.js` + `floor-manager.js` + all
  `floor-blockout-*.js` in a VM sandbox and extracts grid data into `tools/floor-data.json`
- `tools/floor-data.json` — Currently contains grid/rooms/doors/spawn/biome per floor, but **no
  tile schema, no predicate results, no card manifest, no string index**

### What Phase 3 Adds
Upgrade `extract-floors.js` to emit three additional sections in `floor-data.json`:

1. **Tile schema** (mandatory, loaded immediately by visualizer):
   - For each tile ID: name, numeric value, category, comment/description
   - Predicate results: `isWalkable`, `isOpaque`, `isDoor`, `isHazard`, `isTorch`, `isFloating`,
     `isCrenellated`, `isFloatingBackFace`, `isFloatingMoss`, `isFloatingLid`, `isFreeform`, `isWindow`
   - Derived `categoryOf(tileId)` buckets for synthesized layer display

2. **Card manifest** (lazy-loaded enrichment for entity/metadata panels):
   - Parse `data/cards.json` → id, name, emoji, rarity, type per card

3. **String index** (lazy-loaded enrichment for display name resolution):
   - Parse `data/strings/en.js` → entity/shop/NPC display names

### Implementation Notes
- The VM sandbox in `extract-floors.js` already loads `tiles.js` into `sandbox.TILES` — the
  predicates are callable. Phase 3 iterates all tile IDs (0–79), calls each predicate, and emits
  the results.
- `cards.json` and `strings/en.js` are plain data files — parse with `JSON.parse` / regex extraction.
- Output goes into the existing `floor-data.json` under new top-level keys (`tileSchema`, `cardManifest`,
  `stringIndex`) so the visualizer can feature-detect and lazy-load.

### What This Unlocks
- **Tier 1**: Cross-floor copy-paste, drawing tools, selection improvements, history — all need
  correct tile metadata for constraints and display
- **Tier 2**: Synthesized layers (via `categoryOf`), validation (walkability flood-fill, door
  contracts), file integration
- **Tier 4**: Window-scene editor (detect window tiles on interior floors), tile height offset
  editor, DOOR_FACADE recess visualization

### Files to Modify (in DCgamejam2026)
- `tools/extract-floors.js` — Add tile schema extraction loop + card/string parsing
- `tools/floor-data.json` — Output gains `tileSchema`, `cardManifest`, `stringIndex` keys
- `tools/blockout-visualizer.html` — Replace hardcoded `TILE_SCHEMA` with `floor-data.json` load

**Priority**: 🟡 **MEDIUM** — Blocks designer tooling expansion, not production rollout

---

## Additional Code-Level TODOs (Lower Priority)

### Inline TODOs Found in Codebase

| File | Line | Comment | Priority |
|------|------|---------|----------|
| `public/js/debrief-feed-controller.js` | 207 | `TODO: Connect to actual kernel API system` | MEDIUM |
| `public/js/gone-rogue.js` | 2256 | `TODO: Implement camera/drone surveillance system` | LOW |
| `public/js/gone-rogue.js` | 4267 | `interactivesFound: 0, // TODO: Track interactive items` | MEDIUM (part of Blocker #2) |
| `public/js/mok-animation-cycles.js` | 23 | `TODO: Implement sprite sheet cutting engine` | MEDIUM |
| `public/js/mok-visual-engine.js` | 38 | `TODO: Replace with sprite sheet system` | MEDIUM |

### Intentional ARG TODOs (Not Blockers)
The following TODOs are **intentional** parts of the ARG gameplay and should NOT be removed:
- `src/worker/db/user-queries.ts:46` - Fake filesystem TODOs (`[TODO][IT] hide hardcoded credentials`)
- `/home/user/todo.txt` - Fictional IT notes
- `/home/admin/todo-admin.txt` - Fake admin notes
- `/sys/kernel.todo` - ARG flavor text

---

## BLOCKER PRIORITIZATION MATRIX

| # | Blocker | Impact | Effort | Priority | Rollout Block? |
|---|---------|--------|--------|----------|----------------|
| 1 | User Account Creation | CRITICAL | 4 weeks | 🔴 P0 | YES - Blocks persistence |
| 2 | Interactive Items Integration | HIGH | 3-4 hours | 🔴 P1 | NO - Polish only |
| 3 | Kernel Persistence | MEDIUM | 1 week | 🟡 P2 | NO - Agent feature only |
| 4 | Card Database Expansion | MEDIUM-HIGH | 2+ weeks | 🟡 P2 | NO - Depth enhancement |
| 5 | Strategic Direction (A vs B) | STRATEGIC | Decision | ⚠️ P3 | NO - Post-alpha |
| 6 | Blockout Visualizer Schema Extraction | MEDIUM | 1–2 days | 🟡 P2 | NO - Designer tooling |

---

## CRITICAL PATH TO PRODUCTION ROLLOUT

### Minimum Viable Product (MVP) Requirements

**Must-Have for Alpha Launch**:
1. ✅ Canvas rendering (COMPLETE)
2. 🔴 User account creation (4 weeks) - **CRITICAL**
3. 🔴 Interactive items integration (3-4 hours) - **HIGH**
4. 🟡 Basic kernel persistence (1 week) - **NICE TO HAVE**

**Can Defer to Post-Alpha**:
- Card database expansion (gameplay depth)
- Strategic direction decision (Option A vs B)
- Sprite sheet animation system
- Advanced lighting (Terraria-style)

### Estimated Timeline to Production

**With full team focus**:
- Week 1: User account creation (frontend + M Console)
- Week 2: User account creation (backend + migration)
- Week 3: User account creation (testing + security)
- Week 4: Kernel persistence + interactive items integration
- Week 5: Integration testing, bug fixes, polish
- Week 6: Soft launch / alpha testing

**Total**: 6 weeks to production-ready alpha

**With interim release** (skip account creation for initial alpha):
- Week 1: Interactive items integration (3-4 hours) + polish
- Week 2: Bug fixes, playtesting, soft launch
- **Total**: 2 weeks to alpha (local storage only, no persistence)
- Then build account system post-launch based on feedback

---

## OPEN QUESTIONS REQUIRING DECISIONS ✅ ANSWERED

### Strategic Questions

1. **Target Audience**: ✅ **ANSWERED**
   - **Decision**: Target audience is intended to be boomer puzzlers, expected to be iPad toddlers (authoritative)
   - Impact: Focus on accessibility, puzzle mechanics, clear visual feedback
   - Implication: Option A (terminal/ASCII) with strong visual polish

2. **Monetization Strategy**: ✅ **ANSWERED**
   - **Decision**: No monetization of Gone Rogue. This is a primer for a Live team-based ARG that's very expensive, geared for alpine ski lodge vacationers
   - Stakeholder: Real-life James Bond M who wants hooks from ARG terminal into Gone Rogue experience
   - Implication: Account system doesn't need payment integration; focus on hooks between systems

3. **Agent Integration Priority**: ✅ **ANSWERED**
   - **Decision**: Moderate priority for free economic playtesting
   - Impact: Kernel persistence is P2 (medium priority)
   - Use case: Agents provide automated playtesting for game balance

### Technical Questions

4. **Authentication Method**: ⏳ **DEFERRED**
   - Decision: Remains TODO
   - Timeline: After core systems are wired and functional

5. **Cloud Sync Strategy**: ✅ **ANSWERED**
   - **Decision**: Save on bonfire or run completion/death conditions
   - Optional: Provide hooks TODO for an item that consumes for on-demand manual cloud sync
   - Implication: Event-based sync, not real-time

6. **Data Migration Conflict Resolution**: ✅ **ANSWERED**
   - **Decision**: Save on bonfire or completion/death → score to highscore
   - Special item for manual sync
   - Implication: Simple event-driven model, no complex conflict resolution needed

### Design Questions

7. **Rendering Mode Default**: ✅ **ANSWERED**
   - **Decision**:
     - **Floor tiles**: ASCII (motion with status mods, default grid for obvious path)
     - **Walls and interactives**: Emoji
     - Rule: Don't use breakable leaves with practically no collision speed modifiers
     - Overlap is acceptable but maintain clear visual hierarchy
   - Implication: Hybrid rendering mode is the default

8. **Tutorial Flow**: ✅ **ANSWERED**
   - **Decision**: TODO after everything works as expected, before API agent plugin for tuning, before user portal
   - **Approach**: Manually block out T1 forest biome to enforce environment learning
   - Maintain procedural generator for T2, T3 forest biomes
   - Hook contrived T1 forest biome to procedural generation for collectibles, NPC variety (but not walls/gates or special items)
   - **Tutorial UX Gates**:
     - Key item found in bush near gate
     - Player must drag key from inventory to equip slot in header
     - Player must drag key item from header into gate on map
     - Leverage existing debrief feed for unlock animation (key+gate emojis like commerce/destruction)
     - Define database for item synergy and item world event combos now for "functional, local, immediate friends and children playtest polish"

---

## RECOMMENDED IMMEDIATE ACTIONS

### This Week (Sprint 1)
1. **Decide MVP scope**: Account creation required for alpha, or defer?
2. ~~**Integrate interactive items** (3-4 hours) - quick win for polish~~ ✅ **COMPLETED**
   - Environmental synergy system (key+gate interactions) wired into floor generation
   - Food consumption system integrated with player resources
   - Water slowdown and tile effect visual feedback already implemented
   - Overhead animator and interactive items fully functional
3. **Answer strategic question #1**: Option A (terminal) or Option B (emoji)?
4. **Create account system design doc** if required for MVP

### Next 2 Weeks (Sprint 2-3)
1. **If account creation in MVP**: Start frontend registration UI
2. **If account creation deferred**: Focus on gameplay polish and playtesting
3. **Tutorial level blockout**: Add randomness hooks for contrived T1 forest biome
   - Hook collectibles and NPC variety into procedural generation
   - Maintain manual wall/gate placement for tutorial gate mechanics
   - Test key+gate interaction flow end-to-end
4. **Kernel persistence**: Implement basic API endpoints
5. **Testing**: E2E flow for current features

### Month 2
1. **Account system completion** (if in MVP)
2. **Closed alpha testing** with 10-20 players
3. **Bug fixes** based on alpha feedback
4. **Prepare for public beta**

---

## CONCLUSION

The EyesOnly project has **strong technical foundations** with canvas rendering complete, comprehensive documentation, and mature architecture. However, **user account creation** is the critical blocker for production rollout, affecting all persistence, leaderboards, and cross-device play.

**Recommended path forward**:
1. **Decide**: Full MVP with accounts (6 weeks) OR interim release without accounts (2 weeks)
2. **Quick win**: Integrate interactive items this week (3-4 hours)
3. **Strategic clarity**: Choose Option A (terminal/ASCII) or Option B (emoji/mobile)
4. **Answer open questions**: Target audience, authentication method, sync strategy

**Bottom line**: The project can ship an alpha **without accounts** in 2 weeks for early feedback, or invest 6 weeks for a **production-ready system** with full persistence. Both paths are viable depending on business priorities.

---

**Document Owner**: Claude Analysis
**Review Date**: 2026-02-19
**Next Review**: After strategic decisions made

