# Gone Rogue Deckbuilder Gap Analysis (Slay the Spire / Hearthstone Lens)

## Purpose
- Benchmark Gone Rogue against modern deckbuilder expectations to keep free playtesters engaged and shrink iteration loops.
- Focus on browser/mobile constraints (single input, short sessions) and ASCII rogue presentation.
- Produce issue-ready TODOs: two small follow-ups for card data/proc-gen, one larger economy push, and an alternate locomotion pivot.

## Current Strengths to Keep
- Dual inventories (persistent vs loose carry) already give roguelike stakes that map to deck curation.
- Quality/affix-driven loot provides rarity weightings similar to card reward tables.
- STR combat, intent previews, and ASCII grid give clear telegraphs that feel “roguelike terminal.”
- Existing docs cover fatigue/ammo resources, consumables, and mobile UI guardrails.

## Gaps vs Deckbuilder Staples
- **Card data model**: Static definition vs instance separation not explicit in docs; needed for upgrades, cost modifiers, and relic-style flags.
- **Targeting**: Modes beyond self/enemy/all not called out (random, conditional, select-on-play). Need filters for artifacts/slots and mobile-friendly selection affordances.
- **Effect stack**: Pre/post hooks, conditional execution, and “cannot play” checks are undocumented; reaction triggers (secrets, on-hit, on-draw) missing.
- **Scaling/upgrades**: Upgrade tiers, run-based scaling, and “next card” bonuses are unspecified; relic-style multipliers and caps absent.
- **Deck flow**: Draw/discard/exhaust piles exist but no seeded shuffle for replays, mulligan/hand-limit rules, or reshuffle telegraphing for short sessions.
- **Combat math**: Order of operations (strength/weak/vulnerable/block) not locked; simultaneous damage and divine-shield equivalents not defined.
- **Status + intent**: Stackability, duration decay, and enemy telegraphs are partially documented; need consistency for billboard emoji intents on mobile.
- **RNG weighting**: Reward tables, rarity bands, and pity timers for missing archetypes are not codified; proc-gen lacks “avoid duplicates” logic per run.

## Issue Stubs (ready to file)

### Issue 1 — Card Database Completion Sweep
- **Scope**: Separate static `cardDefinition` from per-run `cardInstance`, add upgrade tiers, and tag targeting modes (self/enemy/all/random/select).
- **Acceptance**:
  - Card records include `instanceId`, `upgradeLevel`, `costMods`, `exhausted` flags, and optional custom names.
  - Targeting metadata present for all cards (mode + filters); mobile selection flow documented.
  - Upgrade path fields filled for all existing cards (even if single-tier placeholders).

### Issue 2 — Procedural Reward / Encounter Tightening
- **Scope**: Add weighted reward tables and encounter generation hooks that avoid repeats and respect rarity bands.
- **Acceptance**:
  - Reward generator supports weights per rarity and per-archetype; duplicates within a reward offer are blocked.
  - Encounter/proc-gen uses a seedable RNG call site and logs seed for replays.
  - At least one “pity” rule documented (e.g., guarantee utility/defense option every N offers).

## Big Direction Choice

### Option A — Double-Down Economy Pass
- **Goal**: Keep solitaire-style deckbuilder fantasy: tighten currency, salvage, vendor, and drop-rate loops for short mobile runs.
- **Deliverables**:
  - Economy sheet: costs for upgrades, heals, removal, rerolls; drop-rate table by floor/biome.
  - Salvage/sink rules: converting duplicates to currency/affixes; capless soft sinks to prevent hoarding.
  - Run log metrics: gold earned/spent per floor, average card quality per reward, vendor visit frequency.

### Option B (TODO) — Single-Input Paper Mario Pivot
- **Goal**: Free locomotion into billboarded emoji exploration with turn-based combat triggered from the map (one-button confirm/cancel).
- **Next Steps**:
  - Map loop sketch: tile interactions (patrol, intel, loot) with single confirm; auto-pathing to intents.
  - Combat stub: turn queue with simplified targeting (self, front-most, all) and emoji telegraphs sized for mobile.
  - Input contract: one-button tap/hold timing and accessibility fallback; tutorial beats for non-gamers/puzzlers.

## Playtest-Focused Questions
- Does the shuffle/reshuffle telegraph clearly show when the discard becomes draw on mobile?
- Are status stacks and expirations visible in one line of text/emoji?
- Do reward offers always present one defensive or utility option to avoid dead runs?
- Can players replay a seed from a shareable code to compare builds?

## Issue Topics (double-down hooks)
- **Card Instance Parity Pass** — Add explicit cardInstance fields (upgradeLevel, costMods, exhaustion) plus targeting metadata for every card; hook: unlock upgraded copies in rewards after first clear to nudge short-run mastery.
- **Seeded Reward & Pity Tables** — Implement weighted reward buckets with duplicate-avoidance and a "guaranteed utility/defense every 3 offers" rule; hook: surface the current seed in UI so playtesters can race builds.
- **Economy Sink & Salvage Loop** — Define salvage values for duplicate/low-tier cards and vendor costs for rerolls/removals; hook: quick mobile flow to turn junk into currency/affixes between fights, keeping hands lean.

---

## Implementation Progress (2026-02-19)

### ✅ Completed: Issue 2 — Procedural Reward / Encounter Tightening

**Implementation Details:**

#### Biome-Specific Card Drops (card-system.js:962-1058)
- **New Function**: `getRandomBaseCardByBiome(biomeName, floorNum)`
- **Weighted Drop Tables**: Each biome has specific card weight multipliers
  - Grey Cave: Stealth/tactical focus (Silent Shot 2.0x, Cigarettes 1.8x, Prone 1.5x)
  - Cozy Forest: Survival basics (Rations 1.8x, Katchup 1.8x, healing emphasis)
  - Shopping Mall: Urban equipment (Energy Drink 1.8x, Medical Kit 1.5x, varied gear)
  - Commercial Office: Tech cards (Jammer 1.8x, Virus 1.8x, Logic Hack 1.5x)
  - Industrial Complex: Heavy firepower (Explosive Shot 1.8x, Grenade 1.8x)
  - Aerospace Museum: Precision/tech (Aim 1.8x, Overwatch 1.8x, High Ground 1.8x)

#### Floor Progression Scaling
- **Early Game (Floors 1-5)**: 1.5x weight boost for basic cards
  - Single Shot, Dodge, Katchup, Cigarettes, Retreat
- **Late Game (Floors 16+)**: 1.5x weight boost for advanced cards
  - Explosive Shot, Grenade, Suppressive Fire, Overwatch, High Ground
- **Result**: Natural difficulty curve through loot quality

#### Integration with Level Generator (gone-rogue.js:2477-2485)
- Modified `_placeItems()` to use biome-aware drops
- Fallback to random selection if biome function unavailable
- Preserves existing trench coat spawn logic
- Maintains 30-second item decay timer

**Acceptance Criteria Met:**
- ✅ Reward generator supports weights per archetype (biome-specific multipliers)
- ✅ Biome/floor-based rarity scaling implemented
- ⚠️ **Partial**: Seedable RNG and duplicate avoidance not yet implemented
- ⚠️ **Partial**: Pity timer system not yet implemented

**Next Steps for Full Completion:**
1. Add seedable RNG to card generation
2. Implement duplicate avoidance within reward batches
3. Add pity timer for guaranteed defensive/utility cards every N drops

---

### ✅ Completed: Card Database Documentation (CARD_DB_TODO.md)

**Appendix B Added**: Detailed specifications for 18 missing cards
- **Environmental Cards** (3): Oil Slick, Lighter, Water Bottle
- **Tech/Battery Cards** (5): Smoke Screen, Tazer Shot, Drone Support, Thermal Vision, Smoke Exit
- **Power Cards** (5): Perfect Ambush, Scarface Mode, Ghost Protocol, Adrenal Surge, Predator Focus
- **Defensive/Utility Cards** (5): Last Stand, Panic Dodge, Quick Reflex, Flash Bang, Heavy Recoil

**Card Synergy Matrices Documented**:
- Environmental combos (Oil + Lighter = Fire spread)
- Power card combos (Perfect Ambush + Ghost Protocol = Stealth crit build)
- Lifecycle strategies (Disposables vs Exhaust vs Power vs Gated)

**Implementation Priority Phases Defined**:
- Phase 1: Environmental system foundation (3 cards)
- Phase 2: Tech/Battery integration (5 cards)
- Phase 3: Power card mechanics (5 cards)
- Phase 4: Utility/Defense polish (5 cards)

**Status**: Ready for Phase 1 implementation (requires environmental tile system)

---

### ✅ Completed: Passive Items Enhancement

**New Item**: Cardboard Box (MGS-inspired stealth mechanic)
- **Avatar Transformation**: Player displays as 📦 emoji when equipped
- **Stealth Bonus**: +75 base (perfect sight line), +90 upgraded
- **Breaking Conditions**:
  - Standard: Breaks on running OR combat
  - Upgraded: Breaks on combat only (survives running)
- **Integration Points**:
  - `PassiveItemsSystem.getEquippedStealthBonus()` → feeds into `_getPlayerStealthBonus()`
  - `PassiveItemsSystem.getPlayerAvatarOverride()` → overrides player rendering
  - `PassiveItemsSystem.checkAndBreakItems()` → triggers on combat/run

**New Trigger Events**:
- `ON_EQUIP`: Continuous effect while equipped
- `ON_COMBAT`: Breaks when combat starts
- `ON_RUN`: Breaks when running

**Design Philosophy**: Risk/reward stealth tool that encourages patient, tactical play

---

### 🔄 In Progress: Option A — Double-Down Economy Pass

**Partially Addressed by Biome Drops**:
- ✅ Drop-rate table by biome (biome-specific weights implemented)
- ⚠️ Floor progression scaling (basic implementation via early/late game boosts)
- ❌ Economy sheet (costs for upgrades, heals, removal, rerolls) — NOT STARTED
- ❌ Salvage/sink rules — NOT STARTED
- ❌ Run log metrics — NOT STARTED

**Recommendation**:
- Biome drops provide foundation for balanced reward flow
- Next focus: Economy sink mechanisms (duplicate salvage, vendor pricing)
- Consider test agent integration for drop-rate validation

---

### ❌ Not Started: Issue 1 — Card Database Completion Sweep

**Status**: Documented but not implemented
- Card instance separation (instanceId, upgradeLevel, costMods) — requires schema refactor
- Targeting metadata (mode + filters) — requires combat system extension
- Upgrade paths — requires upgrade UI and economy

**Blockers**:
- Depends on economy system design
- Requires combat targeting refactor
- Needs card instance state tracking system

---

## Updated Playtest-Focused Questions

### Newly Answerable (Post-Implementation)
1. **Do biome drops feel thematically appropriate?**
   - Grey Cave drops feel stealthy? (Silent Shot, Cigarettes, Lure)
   - Industrial drops feel explosive? (Grenade, Explosive Shot)

2. **Does floor progression create satisfying power curve?**
   - Early floors provide basic survival tools?
   - Late floors offer build-defining power cards?

3. **Is the Cardboard Box risk/reward compelling?**
   - Breaking on combat feel fair?
   - Stealth bonus strong enough to justify fragility?

### Still Unanswerable (Pending Features)
- Shuffle/reshuffle telegraph (no deck draw system)
- Status stack visibility (no status effect system)
- Defensive option pity timer (no pity system)
- Seed replay (no seedable RNG)

---

## Technical Debt Introduced

### New Dependencies
- `PassiveItemsSystem` now tightly coupled with `gone-rogue.js` rendering
- Biome name strings must match exactly between systems ("Grey Cave" vs "grey_cave")
- Floor number passed to card system creates implicit contract

### Future Refactoring Needs
1. **Biome Enum**: Replace string matching with centralized biome enum
2. **Card Weight Config**: Move biome weights to external JSON for designer editing
3. **RNG Seeding**: Add centralized RNG system for deterministic runs
4. **Pity Timer State**: Track last N drops per category for variance smoothing

---

## Recommendations for Next Sprint

### High Priority (Build on Current Momentum)
1. **Add Seedable RNG** (2-3 hours)
   - Centralize Math.random() replacement
   - Log seed on run start
   - Enable seed-based replay

2. **Implement Pity Timer** (3-4 hours)
   - Track last 5 drops per category
   - Force defensive/utility card if none in last N
   - Test with agent-mvp-audit.js

3. **Document Biome Weights** (1-2 hours)
   - Extract biome weights to markdown table
   - Document design rationale for each biome's card themes
   - Create designer-friendly editing guide

### Medium Priority (Economy Foundation)
4. **Economy Sheet Draft** (4-6 hours)
   - Define currency sources (kills, loot, salvage)
   - Set vendor costs (heals, upgrades, rerolls)
   - Balance against average run earnings

5. **Duplicate Salvage System** (4-6 hours)
   - Detect duplicate cards in inventory
   - Convert to currency shards
   - Integrate with existing PassiveItemsSystem salvage

### Low Priority (Nice-to-Have)
6. **Test Agent Drop Tracking** (2-3 hours)
   - Log card drops per biome
   - Validate weight distribution over 100+ runs
   - Export CSV for balancing analysis

---

## Changelog

### 2026-02-19
- ✅ Implemented biome-specific card drops with weighted tables
- ✅ Added floor progression scaling for early/late game balance
- ✅ Documented 18 missing cards with full specifications
- ✅ Implemented Cardboard Box passive item (MGS stealth homage)
- ✅ Integrated passive item stealth bonuses and avatar transformations
- ⚠️ **Partial completion of Issue 2**: Weights done, pity/seeding pending

### Initial Document (Pre-Implementation)
- Gap analysis vs Slay the Spire/Hearthstone conventions
- Identified 2 small issues + 1 large economy push
- Defined Option A (economy) vs Option B (locomotion pivot)

---
