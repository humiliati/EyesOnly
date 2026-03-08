# World Building Engine — Unified Cross-Roadmap

> **Status:** Active Roadmap
> **Last Updated:** 2026-03-07
> **Master Design:** [WORLD_BUILDING_ENGINE.md](./WORLD_BUILDING_ENGINE.md)

This document is the unified execution roadmap across all WBE subsystems. Each subsystem has its own canonical document with detailed specs — this roadmap tracks cross-system dependencies and execution order.

---

## Canonical Documents

| Document | Scope | Status |
|----------|-------|--------|
| [WORLD_BUILDING_ENGINE.md](./WORLD_BUILDING_ENGINE.md) | SFC designer, door contracts, GRAFCET toolbar, floor resolver | ✅ Design complete, §6 implemented |
| [BUILDING_INTERIOR_SYSTEM.md](./BUILDING_INTERIOR_SYSTEM.md) | Floor hierarchy, biome resolution pipeline, InteriorFloors API | ✅ Implemented |
| [NPC_CANON.md](./NPC_CANON.md) | NPC invariants, dialogue, pathing, archetypes, proc gen stamping | Phase A ✅, Phases B-E ⬜ |
| [INTERIOR_SYSTEM_IDEAS.md](./INTERIOR_SYSTEM_IDEAS.md) | Structure grammar, visual compression, 12 procedural rules | All phases ⬜ |
| [PROCEDURAL_GENERATION_DESIGN_IDEAS.md](./PROCEDURAL_GENERATION_DESIGN_IDEAS.md) | Scalar field pattern engine (reaction-diffusion, voronoi, radial) | All phases ⬜ |
| [BIOME_SYSTEMS.md](./BIOME_SYSTEMS.md) | Vents, floor shuffling, biome bleed, card drops, biome catalog | ✅ Implemented |
| [TOOLTIP_SPACE_CANON.md](./TOOLTIP_SPACE_CANON.md) | Dynamic tooltip space, NPC dialogue rendering, priority system | ✅ Implemented |

---

## Completed Work (Phases 1-4 + Post-Roadmap)

### Infrastructure Extraction (Original 5-Phase Roadmap)

| Phase | Module | Lines | Status |
|-------|--------|-------|--------|
| 1 | `door-contract-system.js` — Door state + contract logic | 250 | ✅ |
| 2 | Wire door contract into proc gen + tutorial floor gen | — | ✅ |
| 3 | `biome-visual-facade.js` — Biome visual delegation | 135 | ✅ |
| 4 | `floor-metadata-registry.js` — WBE Floor Resolver data | 210 | ✅ |
| 5 | Documentation + monolith cleanup | — | ⚠️ Partial |

**Monolith reduction:** 3,661 → 3,263 lines (398 lines removed)

### Post-Roadmap Biome Work (2026-03-07)

- ✅ Rethemed 6 world biomes with Sandpoint narrative names
- ✅ Added 2 new world biomes (LAKE, SKI_MOUNTAIN)
- ✅ Created 3 boss arena biomes + `boss-floor-registry.js`
- ✅ Created 12 interior biome definitions in `interior-biomes.json`
- ✅ Wired interior biomes into data registry + biome resolution pipeline
- ✅ Per-interior-biome lighting profiles replacing hardcoded values

### NPC Dialogue System (2026-03-07)

- ✅ `dialogue-system.js` — Morrowind-style branching NPC conversations
- ✅ Tooltip priority system (NORMAL/PERSISTENT/DIALOGUE)
- ✅ NPC adjacency tap interaction in `tap-move-system.js`
- ✅ Walk-away interrupt in `move-player-system.js`
- ✅ 4 tutorial NPCs with dialogue trees (Elder, Father Aldric, Tavern Keeper, Blacksmith)

---

## Active Roadmap — Execution Order

The remaining work spans 4 subsystem roadmaps. Dependencies between them determine execution order.

### Tier 1: Foundation (No Dependencies)

These can be worked in any order:

| ID | Task | Document | Phase |
|----|------|----------|-------|
| **INT-1** | Interior biome schema extensions (zoomBias, propDensity, wallOcclusion) | [INTERIOR_SYSTEM_IDEAS](./INTERIOR_SYSTEM_IDEAS.md) §8 Phase 1 | ⬜ |
| **NPC-B** | NPC pathing system (`npc-pathing-system.js`) | [NPC_CANON](./NPC_CANON.md) §8 Phase B | ⬜ |
| **PAT-1** | Scalar field foundation (ScalarField class, BasePattern) | [PROC_GEN](./PROCEDURAL_GENERATION_DESIGN_IDEAS.md) Phase 1 | ⬜ |

**Estimated:** INT-1: 2-3h, NPC-B: 4-6h, PAT-1: 2-3h

### Tier 2: Core Systems (Depends on Tier 1)

| ID | Task | Document | Phase | Depends On |
|----|------|----------|-------|------------|
| **INT-2** | Structure grammar system (`interior-grammar.js`) | [INTERIOR_SYSTEM_IDEAS](./INTERIOR_SYSTEM_IDEAS.md) §8 Phase 2 | ⬜ | INT-1 |
| **NPC-C** | Avatar stack rendering (emoji stacker for NPCs) | [NPC_CANON](./NPC_CANON.md) §8 Phase C | ⬜ | NPC-B |
| **PAT-2** | Pattern modules (reaction-diffusion, voronoi, radial) | [PROC_GEN](./PROCEDURAL_GENERATION_DESIGN_IDEAS.md) Phase 2 | ⬜ | PAT-1 |
| **INT-3** | Visual compression (zoom bias, radial light mask, wall occlusion) | [INTERIOR_SYSTEM_IDEAS](./INTERIOR_SYSTEM_IDEAS.md) §8 Phase 3 | ⬜ | INT-1 |

**Key dependency:** INT-2 (structure grammar) enables NPC-D (proc gen NPC stamping) — these must be sequenced.

### Tier 3: Integration (Depends on Tier 2)

| ID | Task | Document | Phase | Depends On |
|----|------|----------|-------|------------|
| **NPC-D** | Proc gen NPC stamping (`npc-generator.js`) | [NPC_CANON](./NPC_CANON.md) §8 Phase D | ⬜ | INT-2, NPC-C |
| **PAT-3** | Constraint & tile classification (connectivity, curvature spawns) | [PROC_GEN](./PROCEDURAL_GENERATION_DESIGN_IDEAS.md) Phase 3 | ⬜ | PAT-2 |

**NPC-D is the critical integration point:** The NPC generator wires into `interior-grammar.js` structure generation, reading furniture nodes to spawn appropriate NPC archetypes with dialogue trees, pathing loops, and vulnerability flags.

### Tier 4: Polish & Advanced (Depends on Tier 3)

| ID | Task | Document | Phase | Depends On |
|----|------|----------|-------|------------|
| **NPC-E** | Vulnerability systems (theft, plant, card game, gossip) | [NPC_CANON](./NPC_CANON.md) §8 Phase E | ⬜ | NPC-D |
| **INT-4** | Multi-tile props & edge variations | [INTERIOR_SYSTEM_IDEAS](./INTERIOR_SYSTEM_IDEAS.md) §8 Phase 4 | ⬜ | INT-2, INT-3 |
| **PAT-4** | Pressure fields & dynamic mutation | [PROC_GEN](./PROCEDURAL_GENERATION_DESIGN_IDEAS.md) Phase 4 | ⬜ | PAT-3 |
| **PAT-5** | Designer integration (World Designer pattern config) | [PROC_GEN](./PROCEDURAL_GENERATION_DESIGN_IDEAS.md) Phase 5 | ⬜ | PAT-4 |

---

## Dependency Graph

```
Tier 1 (Foundation)
├─ INT-1 (Biome Schema)
│    ├─► INT-2 (Structure Grammar) ──► NPC-D (Proc Gen NPC Stamping)
│    └─► INT-3 (Visual Compression)     │
│              └─► INT-4 (Multi-Tile)    └─► NPC-E (Vulnerability Systems)
│
├─ NPC-B (NPC Pathing)
│    └─► NPC-C (Avatar Stack) ──► NPC-D (above)
│
└─ PAT-1 (Scalar Field)
     └─► PAT-2 (Patterns) ──► PAT-3 (Constraints) ──► PAT-4 (Pressure) ──► PAT-5 (Designer)
```

**Critical path:** INT-1 → INT-2 → NPC-D → NPC-E

This is the path that enables procedurally generated building interiors with believable NPCs — the primary goal of the current phase.

---

## Recommended Execution Sequence

For maximum value with minimum risk:

1. **INT-1** — Extend interior biome schema (quick win, enables visual tuning)
2. **NPC-B** — NPC pathing system (NPCs move between furniture nodes)
3. **INT-2** — Structure grammar (enables proc gen interiors)
4. **INT-3** — Visual compression (interiors feel cozy)
5. **NPC-C** — Avatar stack rendering (NPCs look distinct)
6. **NPC-D** — Proc gen NPC stamping (the integration milestone)
7. **PAT-1 → PAT-2** — Pattern engine (world floor topology variety)
8. **NPC-E** — Vulnerability systems (theft, cards, gossip)
9. **PAT-3 → PAT-4** — Constraints + pressure fields
10. **INT-4** — Multi-tile props (polish)
11. **PAT-5** — Designer integration (last)

---

## Remaining Phase 5 Cleanup

From the original 5-phase roadmap:

- ⬜ Update TUTORIAL_FLOORS_AUDIT.md with fix status for all 13 bugs
- ⬜ Record formal playthrough validation results
- ⬜ Diagnostic logging cleanup in `door-contract-system.js` and `tutorial-floor-gen.js`

---

## New Files To Create

| File | Created By | Purpose |
|------|-----------|---------|
| `npc-pathing-system.js` | NPC-B | Tick-based NPC movement between waypoints |
| `npc-generator.js` | NPC-D | Proc gen NPC stamping with 6-invariant validation |
| `interior-grammar.js` | INT-2 | Structure grammar engine + 12-rule generation |
| `pattern-engine/ScalarField.js` | PAT-1 | Core scalar field container |
| `pattern-engine/BasePattern.js` | PAT-1 | Pattern interface |
| `pattern-engine/ReactionDiffusionPattern.js` | PAT-2 | Spots/stripes/labyrinths |
| `pattern-engine/VoronoiPattern.js` | PAT-2 | District/territory patterns |
| `pattern-engine/RadialPattern.js` | PAT-2 | Boss arena/anomaly patterns |

---

**Document Version**: 3.0
**Last Updated**: 2026-03-07
**Status**: Unified cross-roadmap — Tiers 1-4 pending, infrastructure complete
