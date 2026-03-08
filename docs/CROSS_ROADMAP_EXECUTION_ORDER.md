# Cross-Roadmap Execution Order — Unified Master

> **Last Updated:** 2026-03-07
> **Scope:** All 12 project roadmaps unified into execution tiers with cross-dependencies
> **Engine:** Gone Rogue · EYES ONLY

---

## Master Roadmap Index

| # | Abbr | Roadmap Document | Total Phases | Done | Remaining | Status |
|---|------|-----------------|-------------|------|-----------|--------|
| 1 | CHH | [CARD_HAND_HARMONIZATION_ROADMAP](./CARD_HAND_HARMONIZATION_ROADMAP.md) | 6 steps | 4 | 2 | Steps 1-4 ✅ |
| 2 | EB | [EXPLOSIVE_BREAKABLES_ROADMAP](./EXPLOSIVE_BREAKABLES_ROADMAP.md) | 6 phases | 3 | 3 | Phases 1-3 ✅ |
| 3 | ENI | [ENEMY_NCH_INTERACTION_ROADMAP](./ENEMY_NCH_INTERACTION_ROADMAP.md) | 6 phases | 0 | 6 | Not started |
| 4 | NCR | [NCH-COMBAT-ROADMAP](./NCH-COMBAT-ROADMAP.md) | 2 phases (6 sub) | 1 | 1 (5 sub) | Phase 1 ✅ |
| 5 | IPR | [ITEM-PIPELINE-ROADMAP](./ITEM-PIPELINE-ROADMAP.md) | 6 phases | 5 | 1 | Phases 1-5 ✅ |
| 6 | IDP | [ITEM_DROP_PIPELINE_ROADMAP](./ITEM_DROP_PIPELINE_ROADMAP.md) | 4 phases | 0 | 4 | Planned |
| 7 | WBE | [WORLD_BUILDING_ENGINE_ROADMAP](./WORLD_BUILDING_ENGINE_ROADMAP.md) | 4 tiers (14 items) | 0 | 14 | Infrastructure ✅, tiers pending |
| 8 | OAR | [OVERHEAD-ANIMATION-UNIFIED-ROADMAP](./OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md) | 5 phases | 2 | 3 | Phases 1-2 ✅ |
| 9 | ROPE | [ROPE_IMPLEMENTATION_ROADMAP](./ROPE_IMPLEMENTATION_ROADMAP.md) | 9 phases | 1 | 8 | Phase 0 ✅ |
| 10 | STR-HUD | [STR-HUD-DESIGNER-ROADMAP](./STR-HUD-DESIGNER-ROADMAP.md) | 7 phases | 0 | 7 | Design doc only |
| 11 | AWOL | [AWOL_LAUNCH_SYSTEM_ROADMAP](./AWOL_LAUNCH_SYSTEM_ROADMAP.md) | 5 phases | 2 | 3 | Phases 1-2 ✅ |
| 12 | UDG | [UNIFIED_DESIGNER_GUIDE](./UNIFIED_DESIGNER_GUIDE.md) | 6 sections | 0 | 6 | Portal exists, editors pending |

**Totals:** ~76 work units across 12 roadmaps. ~18 complete, ~58 remaining.

---

## Completion Summary by System

```
CHH  ████████████░░░░  4/6   67%   Card data model backbone
EB   ████████░░░░░░░░  3/6   50%   Explosive barrels + VFX
ENI  ░░░░░░░░░░░░░░░░  0/6    0%   Enemy card interaction
NCR  ████░░░░░░░░░░░░  1/6   17%   NCH combat animations (Phase 1 = bindings)
IPR  █████████████░░░  5/6   83%   Item pipeline (Phase 6 = doc updates, deferred)
IDP  ░░░░░░░░░░░░░░░░  0/4    0%   Item drop pipeline
WBE  ░░░░░░░░░░░░░░░░  0/14   0%   World building (infra done, tiers pending)
OAR  ██████░░░░░░░░░░  2/5   40%   Overhead animations
ROPE █░░░░░░░░░░░░░░░  1/9   11%   Rope system (Phase 0 = IIFE rewrite)
STR  ░░░░░░░░░░░░░░░░  0/7    0%   STR HUD designer tools
AWOL ██████░░░░░░░░░░  2/5   40%   AWOL launch system
UDG  ░░░░░░░░░░░░░░░░  0/6    0%   Designer portal editors
```

---

## Strategic Execution Tiers

The 12 roadmaps organize into **4 execution tiers** based on dependencies and critical path analysis. Within each tier, work streams can often run in parallel.

### Tier 1 — Active Sprint (Card Combat Pipeline)

The card combat pipeline is the critical path. Every system downstream depends on CHH's data model and EB's explosive mechanics.

| Sprint | Primary | Work Items | Depends On | Unlocks |
|--------|---------|-----------|------------|---------|
| S1 | CHH | Steps 1-4 | — | All card systems | ✅ COMPLETE |
| S2 | EB | Phases 4-5 | CHH Steps 1-4 | Plant-detonate data structures |
| S3 | ENI | Phases 1-5 | CHH Steps 1-4, EB Phase 5 | Full plant-detonate loop |
| S4 | NCR | Phase 2 (2.3-2.5) | ENI Phase 4 | Animation polish |
| S5 | CHH | Steps 5-6 | Sprints 1-4 | Harmonization complete |
| S6 | UDG | Card + Enemy Card designers | CHH Step 6 | Designer-facing editors |

**Current position:** Sprint 2 active (EB Phases 1-3 complete, Phase 4-5 next).

**Critical path:** CHH 1-4 → EB 4-5 → ENI 1-5 → NCR 2.3-2.5 → CHH 5-6 → UDG

#### Sprint 2 Detail: Explosive Breakables (ACTIVE)

Phases 1-3 ✅ complete (barrels, ExplosionSystem, VFX). Remaining:

- **EB Phase 4** — Breakable light interactions (explosion chain with lights, kick barrel into light). Optional polish, can defer.
- **EB Phase 5** — Explosive cards (FRAG_GRENADE, PIPE_BOMB, C4_CHARGE) + enemy explosive inventories + enemy AI usage + pre-combat pickpocket stub. This is the hard dependency for Sprint 3.

#### Sprint 3 Detail: Enemy NCH Interaction

Six phases building the full enemy card interaction surface:

- **ENI Phase 1** — Enemy capsule renderer on map, interactability indicators (green/orange/grey pulse), plantSlots data structure with BLVCK empty slots
- **ENI Phase 2** — Side-by-side interchange UI (steal & plant), drag animations, interaction budget (default 1 action)
- **ENI Phase 3** — STR combat enemy hand as interactive NCH, planted card triggers (manual + synergy), round-based refresh
- **ENI Phase 4** — Player NCH animation adjustments (acquisition/departure card flights, exploration↔combat transitions)
- **ENI Phase 5** — plantTags schema, explosive card plant flow end-to-end, validator updates, BLVCK as universal empty slot

#### Sprint 4 Detail: NCH Combat Animation

Phase 2 remainder (2.3-2.5) plus ENI Phase 4 animation integration:

- **NCR 2.3** — Backup scroll halo ring (25-card curved arc, perspective tilt, drag scroll)
- **NCR 2.4** — Map deploy collapse animation (fan → joker stack 200ms, halo → left column 300ms)
- **NCR 2.5** — Left column combat mode (60x84px thumbnails, DRAW button, resolve-phase minimize)
- **ENI P4 wire-up** — Dual hand layout in STR combat, exploration↔combat transitions

#### Sprint 5 Detail: CHH Finish

- **CHH Step 5** — Persistence rules (CI-* survive save/load/floor transitions, planted card lifecycle, GC on floor transition + save)
- **CHH Step 6** — Policy flags (stealable, plantable, destroyable, triggerable), BLVCK as universal empty slot, synergy-triggered detonation

#### Sprint 6 Detail: Designer Portal

- **UDG 6A** — Card Designer (ACT-* CRUD, plantable/triggerable flags, explosive card workflow)
- **UDG 6B** — Enemy Card Designer (EATK-* CRUD, deck editor, BLVCK slot count, synergy cross-reference)
- **UDG 6C** — Policy Flag Editor (inline toggles in Card + Enemy Card designers)
- **UDG 6D** — Loot Designer updates (explosive card drop rates, barrel spawn rates)
- **UDG 6E** — Item Designer updates (plantTags, interaction_charge_bonus, explosive effects)
- **UDG 6F** — Validators (validate-cards.js, validate-enemy-cards.js, plantTags validation)

---

### Tier 2 — Parallel Streams (Independent of Card Combat)

These roadmaps have minimal or no dependencies on the Tier 1 card combat pipeline. They can execute in parallel once their own prerequisites are met.

#### Stream A: Item Drop Pipeline (IDP)

| Phase | Work | Depends On | Status |
|-------|------|-----------|--------|
| IDP 1 | Fix dead-end else branch in pickup-system.js `_addToInventory()` | IPR (done) | Planned |
| IDP 2 | Add `_spawnItemDrop()` to breakable-system.js | IDP 1 | Planned |
| IDP 3 | Map rendering for item drops + ITM-103 Flipper Zero definition | IDP 2 | Planned |
| IDP 4 | Polish (stacking, visual sorting, tooltip integration) | IDP 3 | Planned |

**Can start immediately.** No Tier 1 dependency. Blocks Flipper Zero (ITM-103) tutorial drop.

#### Stream B: AWOL Launch System (AWOL)

| Phase | Work | Depends On | Status |
|-------|------|-----------|--------|
| AWOL 1 | Dropdown menu | — | ✅ Done |
| AWOL 2 | Play/pause state machine | AWOL 1 | ✅ Done |
| AWOL 3 | Seed validation + canonical phrase | AWOL 2 | Pending |
| AWOL 4 | Mid-run UBER overlay | AWOL 3 | Pending |
| AWOL 5 | Polish (history, favourites, shareable URLs) | AWOL 4 | Pending |

**Can start immediately.** Self-contained in awol-difficulty.js + crt.css.

#### Stream C: Overhead Animation (OAR)

| Phase | Work | Depends On | Status |
|-------|------|-----------|--------|
| OAR 1 | RESOURCE_COLOR pipeline + key tiers | — | ✅ Done |
| OAR 2 | Pickup system extraction + tooltip pipeline | OAR 1 | ✅ Done |
| OAR 3 | Designer guidelines + map animation uniformity audit | OAR 2 | Pending |
| OAR 4 | Environment interaction animations (breakable drops, explosions) | OAR 3, EB 1-3 | Pending |
| OAR 5 | Visual coordination (multi-source stacking, PancakeStack refinement) | OAR 4 | Pending |

**OAR 3 can start immediately.** OAR 4 has a soft dependency on EB Phases 1-3 (done) for explosion animation integration.

#### Stream D: World Building Engine (WBE)

Four tiers of world generation work, independent of card combat:

| Tier | Items | Work | Depends On |
|------|-------|------|-----------|
| WBE T1 | INT-1, NPC-B, PAT-1 | Interior biome schema extensions, NPC pathing, scalar field foundation | WBE infrastructure (done) |
| WBE T2 | INT-2, NPC-C, PAT-2, INT-3 | Structure grammar, avatar stack rendering, scalar field templates, visual compression | WBE T1 |
| WBE T3 | NPC-D, PAT-3 | Proc gen NPC stamping, scalar field biome integration | WBE T2 |
| WBE T4 | NPC-E, INT-4, PAT-4, PAT-5 | Vulnerability systems, interior proc gen pipeline, scalar field polish | WBE T3 |

**WBE T1 can start immediately.** Critical path within WBE: INT-1 → INT-2 → NPC-D → NPC-E. All 14 items are self-contained world generation work.

---

### Tier 3 — Late Dependencies (Require Tier 1 or Tier 2 completion)

These streams depend on multiple earlier systems being in place.

#### Stream E: Rope System (ROPE)

| Phase | Work | Depends On | Status |
|-------|------|-----------|--------|
| ROPE 0 | IIFE module rewrite | — | ✅ Done |
| ROPE 1 | Rope node (interactive map object) | ROPE 0 | Pending |
| ROPE 2 | Tripline install mechanic | ROPE 1 | Pending |
| ROPE 3 | C4 plant integration | ROPE 2, **EB Phase 5** | Pending |
| ROPE 4 | Harpoon (equipped weapon, consumes rope as ammo) | ROPE 2 | Pending |
| ROPE 5 | Grappling hook (passive item, teleport to rope nodes) | ROPE 1 | Pending |
| ROPE 6 | Rendering (rope lines, tripline wires, grapple arcs) | ROPE 4-5 | Pending |
| ROPE 7 | Card synergy (bound enemies get bonus BLVCK slot) | ROPE 2, **ENI Phase 1** | Pending |
| ROPE 8 | Hardening (edge cases, AI awareness, save/load) | ROPE 6-7 | Pending |

**ROPE 1-2 can start after Sprint 2.** ROPE 3 requires EB Phase 5 (explosive cards). ROPE 7 requires ENI Phase 1 (BLVCK slots). Full rope system completes after both Tier 1 and Tier 2 work.

#### Stream F: STR HUD Designer (STR-HUD)

| Phase | Work | Depends On |
|-------|------|-----------|
| D1 | Config extraction (16 seams → JSON knobs) | — |
| D2 | Preview sandbox (live tuning with mock combat) | D1 |
| D3 | Unified designer integration (new tab in portal) | D2, **UDG Sprint 6** |
| D4 | Per-enemy profiles (The Warden, Rat Swarm, etc.) | D3, **ENI Phase 3** |
| D5 | Expression authoring (intent glyph editor) | D4 |
| D6 | Boss encounter builder (layered config merging) | D5 |
| D7 | Encounter scripting (multi-phase bosses, triggers) | D6 |

**D1-D2 can start immediately** (pure extraction + sandbox). D3 requires the designer portal expansion (Tier 1 Sprint 6). D4 requires enemy hand in STR combat (ENI Phase 3). Full STR-HUD is a late-stage system.

---

### Tier 4 — Polish & Deferred

Items that are non-blocking, optional, or post-launch scope.

| Item | Source | Why Deferred |
|------|--------|-------------|
| EB Phase 4 (breakable light interactions) | EB | Optional polish |
| EB Phase 6 (config extraction + sound hooks) | EB | Integration glue, low priority |
| ENI Phase 6 (MOK + tooltips + sound polish) | ENI | Polish, not blocking testability |
| IPR Phase 6 (doc updates) | IPR | Non-functional |
| NCR item-modifier draw (True Joker, Mag Glass) | NCR | Partially implemented |
| Ground effect items (water, oil) | IPR | No items of these types exist yet |
| AWOL Phase 5 (history, favourites, shareable URLs) | AWOL | Nice-to-have polish |
| OAR Phase 5 (PancakeStack refinement) | OAR | Polish layer |
| ROPE Phase 8 (hardening) | ROPE | Edge cases, post-feature |
| STR-HUD D6-D7 (boss builder + scripting) | STR-HUD | Late-stage designer tools |
| WBE T4 (vulnerability, proc gen pipeline, scalar polish) | WBE | Aspirational scope |

---

## Cross-System Dependency Graph

```
                    ┌──────────────────────────────────────────────────────┐
                    │              TIER 1: CARD COMBAT PIPELINE            │
                    │                                                      │
  ┌─────────┐      │  ┌─────────┐    ┌─────────┐    ┌─────────┐          │
  │ CHH 1-4 │──────┼─►│ EB 4-5  │───►│ ENI 1-5 │───►│ NCR 2.x │          │
  │   ✅    │      │  │ active  │    │         │    │         │          │
  └─────────┘      │  └────┬────┘    └────┬────┘    └────┬────┘          │
       │           │       │              │              │               │
       │           │       │              │              v               │
       │           │       │              │         ┌─────────┐          │
       └───────────┼───────┼──────────────┼────────►│ CHH 5-6 │          │
                   │       │              │         └────┬────┘          │
                   │       │              │              │               │
                   │       │              │              v               │
                   │       │              │         ┌─────────┐          │
                   │       │              │         │ UDG 6A-F│          │
                   │       │              │         └────┬────┘          │
                   │       │              │              │               │
                   └───────┼──────────────┼──────────────┼───────────────┘
                           │              │              │
           ┌───────────────┼──────────────┼──────────────┼──────────────┐
           │  TIER 3       │              │              │              │
           │               v              v              v              │
           │          ┌─────────┐    ┌─────────┐    ┌─────────┐        │
           │          │ ROPE 3  │    │ ROPE 7  │    │STR-HUD  │        │
           │          │(C4 int.)│    │(BLVCK)  │    │  D3-D7  │        │
           │          └─────────┘    └─────────┘    └─────────┘        │
           └────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────┐
  │                    TIER 2: PARALLEL STREAMS                         │
  │                                                                      │
  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
  │  │  IDP    │  │  AWOL   │  │  OAR    │  │  WBE    │  │STR-HUD  │  │
  │  │ 1-4    │  │  3-5    │  │  3-5    │  │ T1-T3   │  │  D1-D2  │  │
  │  │(no dep)│  │(no dep) │  │(EB soft)│  │(no dep) │  │(no dep) │  │
  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## Recommended Execution Schedule

Given a single-developer workflow, the recommended execution interleaves Tier 1 sprints with Tier 2 streams to avoid burnout and keep multiple systems progressing.

| Week | Primary (Tier 1) | Secondary (Tier 2) | Milestone |
|------|------------------|--------------------|-----------|
| 1-2 | EB Phases 4-5 | IDP Phases 1-2 | Explosive cards in pool, item drops functional |
| 3-4 | ENI Phases 1-2 | AWOL Phase 3, OAR Phase 3 | Enemy capsules visible, seed validation |
| 5-6 | ENI Phases 3-5 | WBE Tier 1 (INT-1, NPC-B) | Plant-detonate loop testable |
| 7-8 | NCR Phase 2 (2.3-2.5) | IDP Phases 3-4, AWOL Phase 4 | Full animation polish |
| 9-10 | CHH Steps 5-6 | WBE Tier 1 (PAT-1), ROPE Phases 1-2 | Harmonization complete |
| 11-12 | UDG Sprint 6 | STR-HUD D1-D2, OAR Phase 4 | Designer portal expansion |
| 13+ | — | ROPE 3-7, WBE T2-T3, STR-HUD D3-D5 | Late-stage systems |

---

## P0 Bug Integration

The following P0 bugs from [TODO.md](./TODO.md) intersect with roadmap work:

| Bug | Affected Roadmap | Resolution Path |
|-----|-----------------|----------------|
| Card dragging broken | CHH / NCR | NCR Phase 2 drag system rework |
| Breakable multi-item pickup overlapping | OAR / IDP | IDP Phase 2 `_spawnItemDrop()` + OAR Phase 4 animation coordination |
| Breakable contents not spreading | IDP | IDP Phase 2 (loot-spill-system.js completion) |
| Key ammo rendering as item | OAR | OAR Phase 3 (resource symbol rendering audit) |
| Enemy loot pipeline incomplete | IDP / EB | IDP Phase 2 + EB Phase 5 (enemy loot from combat) |
| Floor 3 NPC not interactive | WBE | WBE Tier 1 NPC-B (pathing system includes dialogue wiring) |

---

## Files Referenced

| File | Roadmap | Purpose |
|------|---------|---------|
| `card-state-authority.js` | CHH, NCR | Card transfer authority (✅ exists) |
| `card-transfer-manager.js` | CHH, NCR | Transfer operations (✅ exists) |
| `explosion-system.js` | EB | Stateless explosion IIFE (✅ exists) |
| `breakable-system.js` | EB, IDP | Breakable lifecycle (✅ exists) |
| `enemy-capsule-renderer.js` | ENI | Enemy card capsule on map (❌ to create) |
| `nch-interchange.js` | ENI | Steal/plant interchange UI (❌ to create) |
| `hand-fan-renderer.js` | NCR | Shared fan layout module (❌ to create) |
| `backup-halo-renderer.js` | NCR | Backup scroll halo ring (❌ to create) |
| `rope-system.js` | ROPE | Rope IIFE module (✅ exists, Phase 0 rewrite) |
| `pickup-system.js` | IDP, OAR | Pickup routes (✅ exists, needs IDP Phase 1 fix) |
| `awol-difficulty.js` | AWOL | AWOL state machine (✅ exists) |
| `floor-gen-core.js` | WBE | Floor generation pipeline (✅ exists) |
| `interior-floor-system.js` | WBE | Interior biome resolution (✅ exists) |
| `loot-spill-system.js` | IDP | Loot spread behavior (✅ exists, 125 lines, incomplete) |

---

**Document Version:** 3.0 — Unified across all 12 roadmaps
**Previous Version:** 2.0 — Covered CHH/EB/ENI/NCR/IPR/UDG only (7 sprints)
**Last Updated:** 2026-03-07
