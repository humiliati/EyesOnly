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
