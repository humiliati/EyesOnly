# EyesOnly Documentation — Table of Contents

> **Last Updated:** 2026-03-07
> **Active Docs:** 89 (.md/.txt) + 2 .docx | **Archived (dot-prefixed):** 24

---

## Meta / Project Management

| Document | Purpose |
|----------|---------|
| [TODO.md](./TODO.md) | Living bug/TODO tracker (P0-P2) |
| [CRITICAL_TODOS_AND_BLOCKERS.md](./CRITICAL_TODOS_AND_BLOCKERS.md) | Production rollout blockers analysis |
| [CROSS_ROADMAP_EXECUTION_ORDER.md](./CROSS_ROADMAP_EXECUTION_ORDER.md) | **Unified master cross-roadmap** — all 12 roadmaps, 4 tiers, dependency graph |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Deployment procedures |
| [ASSET_PORTAL_README.md](./ASSET_PORTAL_README.md) | Designer portal documentation |
| [UNIFIED_DESIGNER_GUIDE.md](./UNIFIED_DESIGNER_GUIDE.md) | Designer hub guide + runtime pipeline |

---

## World Building Engine (Canonical Cluster)

These 8 documents form the interconnected canonical reference for world generation, interiors, NPCs, and biomes.

| Document | Scope | Status |
|----------|-------|--------|
| [WORLD_BUILDING_ENGINE.md](./WORLD_BUILDING_ENGINE.md) | SFC designer, door contracts, GRAFCET toolbar | ✅ Design + §6 impl |
| [WORLD_BUILDING_ENGINE_ROADMAP.md](./WORLD_BUILDING_ENGINE_ROADMAP.md) | Unified cross-roadmap for all systems | ✅ Active roadmap |
| [BUILDING_INTERIOR_SYSTEM.md](./BUILDING_INTERIOR_SYSTEM.md) | Floor hierarchy, biome resolution, InteriorFloors API | ✅ Implemented |
| [INTERIOR_SYSTEM_IDEAS.md](./INTERIOR_SYSTEM_IDEAS.md) | Structure grammar, visual compression, 12 proc rules | ⬜ Roadmap |
| [NPC_CANON.md](./NPC_CANON.md) | NPC invariants, dialogue, pathing, proc gen stamping | Phase A ✅, B-E ⬜ |
| [BIOME_SYSTEMS.md](./BIOME_SYSTEMS.md) | Vents, shuffling, bleed, card drops, biome catalog | ✅ Implemented |
| [PROCEDURAL_GENERATION_DESIGN_IDEAS.md](./PROCEDURAL_GENERATION_DESIGN_IDEAS.md) | Scalar field pattern engine | ⬜ Roadmap |
| [TOOLTIP_SPACE_CANON.md](./TOOLTIP_SPACE_CANON.md) | Dynamic tooltip, NPC dialogue, priority system | ✅ Implemented |

### World Building Support Docs

| Document | Purpose |
|----------|---------|
| [SEED_DESIGN_CONSIDERATIONS.md](./SEED_DESIGN_CONSIDERATIONS.md) | Seed system design for run variety |
| [TUTORIAL_FLOORS_AUDIT.md](./TUTORIAL_FLOORS_AUDIT.md) | BUGs 1-13 for tutorial floors |
| [TUTORIAL_FLOORS_IMPLEMENTATION.md](./TUTORIAL_FLOORS_IMPLEMENTATION.md) | Tutorial floor implementation details |
| [TESTING_FLOORS_DESIGN.md](./TESTING_FLOORS_DESIGN.md) | Test floor design patterns |
| [tutorial-floor-designer-guide.md](./tutorial-floor-designer-guide.md) | Designer guide for tutorial floors |

---

## Narrative / Setting

| Document | Purpose |
|----------|---------|
| [NARRATIVE_ALIGNMENT.md](./NARRATIVE_ALIGNMENT.md) | Sandpoint setting, faction alignment, narrative tone |
| [BLVCK_PHILOSOPHY.md](./BLVCK_PHILOSOPHY.md) | BLVCK card design philosophy |
| [LIVE_EXERCISE_NARRATIVE_SAMPLE.md](./LIVE_EXERCISE_NARRATIVE_SAMPLE.md) | ARG live exercise narrative examples |
| [SCENARIO_ENGINE_DESIGN.md](./SCENARIO_ENGINE_DESIGN.md) | Scenario/mission engine architecture |
| [ENDGAME_PROGRESSION.md](./ENDGAME_PROGRESSION.md) | Endgame progression design |

---

## Combat / STR System

| Document | Purpose |
|----------|---------|
| [STR_COMBAT_UI_README.md](./STR_COMBAT_UI_README.md) | Current STR combat architecture (canonical) |
| [STR_COMBAT_DRAG_UNIFICATION.md](./STR_COMBAT_DRAG_UNIFICATION.md) | Drag-to-deploy unification |
| [STR-HUD-DESIGNER-ROADMAP.md](./STR-HUD-DESIGNER-ROADMAP.md) | HUD designer roadmap |
| [INFORMATION_DUEL_ENGINE_STATE_REPORT.md](./INFORMATION_DUEL_ENGINE_STATE_REPORT.md) | Information duel engine state |
| [NCH-COMBAT-ROADMAP.md](./NCH-COMBAT-ROADMAP.md) | NCH combat integration roadmap |
| [NCH_CAPSULE_OVERLAY_ARCHITECTURE.md](./NCH_CAPSULE_OVERLAY_ARCHITECTURE.md) | NCH capsule overlay architecture |
| [ENEMY_NCH_INTERACTION_ROADMAP.md](./ENEMY_NCH_INTERACTION_ROADMAP.md) | Enemy NCH interaction roadmap |

---

## Enemy Systems

| Document | Purpose |
|----------|---------|
| [ENEMY_AI.md](./ENEMY_AI.md) | Enemy AI behavior roadmap |
| [ENEMY_CARDS.md](./ENEMY_CARDS.md) | Enemy card catalog and deck building |
| [ENEMY_CQC_SYSTEM.md](./ENEMY_CQC_SYSTEM.md) | Close quarters combat system |
| [ENEMY_INTENT_SYSTEM_GUIDE.md](./ENEMY_INTENT_SYSTEM_GUIDE.md) | MGS-style intent telegraphing system |

---

## Boss Encounters

| Document | Purpose |
|----------|---------|
| [BOSS_DESIGN.md](./BOSS_DESIGN.md) | Boss encounter design specs |
| [BOSS_ENCOUNTER_IDEAS.md](./BOSS_ENCOUNTER_IDEAS.md) | Boss encounter candidate pool |

---

## Items / Cards / Economy

| Document | Purpose |
|----------|---------|
| [COLLECTIBLES_CANON.md](./COLLECTIBLES_CANON.md) | Collectibles system canon (9 categories) |
| [COLLECTIBLES-VISUAL-SYSTEM.md](./COLLECTIBLES-VISUAL-SYSTEM.md) | Collectibles visual rendering |
| [CARD_DB_TODO.md](./CARD_DB_TODO.md) | Card database TODOs |
| [CARD_HAND_HARMONIZATION_ROADMAP.md](./CARD_HAND_HARMONIZATION_ROADMAP.md) | Hand fan harmonization |
| [CARD_SYNERGY_SYSTEM.md](./CARD_SYNERGY_SYSTEM.md) | Card synergy design |
| [CARD_ZONE_AUDIT.md](./CARD_ZONE_AUDIT.md) | Card zone audit |
| [HAND_FAN_AND_CARD_DEPLOYMENT.md](./HAND_FAN_AND_CARD_DEPLOYMENT.md) | Hand fan + card deployment |
| [HAND_FAN_NONCOMBAT_AND_CARD_DEPLOYMENT.md](./HAND_FAN_NONCOMBAT_AND_CARD_DEPLOYMENT.md) | Non-combat card deployment |
| [ITEM-PIPELINE-ROADMAP.md](./ITEM-PIPELINE-ROADMAP.md) | Item pipeline roadmap |
| [ITEM_DROP_PIPELINE_ROADMAP.md](./ITEM_DROP_PIPELINE_ROADMAP.md) | Item drop pipeline |
| [LOOT_TABLE_SYSTEM.md](./LOOT_TABLE_SYSTEM.md) | Loot table design |
| [TREASURE_CHEST_SYSTEM.md](./TREASURE_CHEST_SYSTEM.md) | Treasure chest mechanics |
| [FOOD_AND_INTERACTIVE_ITEMS_GUIDE.md](./FOOD_AND_INTERACTIVE_ITEMS_GUIDE.md) | Food + interactive items guide |
| [INTERACTIVE_ITEMS_TODO.md](./INTERACTIVE_ITEMS_TODO.md) | Interactive items TODOs |
| [COOLDOWN_SYSTEM_GUIDE.md](./COOLDOWN_SYSTEM_GUIDE.md) | Card cooldown system |
| [STACK_SYSTEM_INTEGRATION.md](./STACK_SYSTEM_INTEGRATION.md) | Stack system integration |
| [RESOURCE_COLOR_SYSTEM.md](./RESOURCE_COLOR_SYSTEM.md) | Resource color assignments |
| [SHOP_SYSTEM_COMPLETE.md](./SHOP_SYSTEM_COMPLETE.md) | Shop system + testing checklist |
| [SHOP_VISUAL_DESIGN.md](./SHOP_VISUAL_DESIGN.md) | Shop visual design |
| [UNIFIED_INVENTORY_METADATA_CONTRACT.md](./UNIFIED_INVENTORY_METADATA_CONTRACT.md) | Inventory metadata contract |

---

## Game Systems

| Document | Purpose |
|----------|---------|
| [THEFT_MECHANICS.md](./THEFT_MECHANICS.md) | Theft/steal mechanics design |
| [ROPE_IMPLEMENTATION_ROADMAP.md](./ROPE_IMPLEMENTATION_ROADMAP.md) | Rope system roadmap |
| [EXPLOSIVE_BREAKABLES_ROADMAP.md](./EXPLOSIVE_BREAKABLES_ROADMAP.md) | Explosive breakables roadmap |
| [LIGHTING_SYSTEM.md](./LIGHTING_SYSTEM.md) | Lighting system design |
| [LIGHTING_BREAKABLES.md](./LIGHTING_BREAKABLES.md) | Lighting + breakable interaction |
| [OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md](./OVERHEAD-ANIMATION-UNIFIED-ROADMAP.md) | Overhead animation unification |
| [UNIFIED_MOVEMENT_LIGHTING_VISION.md](./UNIFIED_MOVEMENT_LIGHTING_VISION.md) | Movement, lighting, vision unification |
| [TERRARIA_LIGHTING_TODO.md](./TERRARIA_LIGHTING_TODO.md) | Terraria-style lighting TODOs |
| [PET_FOLLOWER_INTEGRATION.md](./PET_FOLLOWER_INTEGRATION.md) | Pet/follower system |
| [PLAYER_ONBOARDING_TODO.md](./PLAYER_ONBOARDING_TODO.md) | Player onboarding TODOs |

---

## UI / UX

| Document | Purpose |
|----------|---------|
| [UI-CANON.md](./UI-CANON.md) | UI canonical styles, fonts, colors |
| [UI_REBASE_BENCHMARK_CHECKLIST.md](./UI_REBASE_BENCHMARK_CHECKLIST.md) | UI rebase benchmark checklist |
| [UI_REBASE_GAP_CHECK_REPORT.md](./UI_REBASE_GAP_CHECK_REPORT.md) | UI rebase gap check report |
| [INPUT_PLAYER_CONTROLLER.md](./INPUT_PLAYER_CONTROLLER.md) | Input/player controller architecture |
| [LEFT_COLUMN_BUTTON_SPEC.md](./LEFT_COLUMN_BUTTON_SPEC.md) | Left column button spec |
| [MOBILE_KEYBOARD_IMPLEMENTATION.md](./MOBILE_KEYBOARD_IMPLEMENTATION.md) | Mobile keyboard detection/adaptation |
| [EMOJI_REUSE.md](./EMOJI_REUSE.md) | Emoji reuse tracking |
| [INTENT_GLYPH_PALETTE.md](./INTENT_GLYPH_PALETTE.md) | Intent glyph visual palette |
| [INTENT_VISUAL_EXAMPLES.md](./INTENT_VISUAL_EXAMPLES.md) | Intent visual examples |

---

## Gone Rogue — Game Docs

| Document | Purpose |
|----------|---------|
| [GONE_ROGUE.md](./GONE_ROGUE.md) | Gone Rogue overview/README |
| [GONE_ROGUE_TUTORIAL.md](./GONE_ROGUE_TUTORIAL.md) | Tutorial design |
| [GONE_ROGUE_DECKBUILDER_GAP_ANALYSIS.md](./GONE_ROGUE_DECKBUILDER_GAP_ANALYSIS.md) | Deckbuilder gap analysis |
| [GONE_ROGUE_SYNERGY_GUIDE.md](./GONE_ROGUE_SYNERGY_GUIDE.md) | Environmental synergy guide |
| [AWOL_LAUNCH_SYSTEM_ROADMAP.md](./AWOL_LAUNCH_SYSTEM_ROADMAP.md) | AWOL launch system roadmap |

---

## Platform / Backend

| Document | Purpose |
|----------|---------|
| [KERNEL_DECISION_API_SPEC.md](./KERNEL_DECISION_API_SPEC.md) | Kernel decision API spec |
| [KERNEL_SERVER_PERSISTENCE_TODO.md](./KERNEL_SERVER_PERSISTENCE_TODO.md) | Kernel persistence TODOs |
| [MANIPULATION_LAYER_AGENT_MODERATION.md](./MANIPULATION_LAYER_AGENT_MODERATION.md) | Agent moderation layer |
| [USER_ACCOUNT_CREATION_TODO.md](./USER_ACCOUNT_CREATION_TODO.md) | Account creation design |
| [NATIVE_COMPANION_GUIDE.md](./NATIVE_COMPANION_GUIDE.md) | Native companion app guide |
| [SMARTWATCH_APP_TODO.md](./SMARTWATCH_APP_TODO.md) | Smartwatch app TODOs |
| [TODO-ios-wrapper-port.md](./TODO-ios-wrapper-port.md) | iOS wrapper port TODOs |
| [AUDIO_COMMISSIONING.md](./AUDIO_COMMISSIONING.md) | Audio musician commissioning brief |

---

## Tutorials / Guides (Player-Facing)

| Document | Purpose |
|----------|---------|
| [m-tutorial-alpha.md](./m-tutorial-alpha.md) | M tutorial alpha |
| [ops-tutorial-alpha.md](./ops-tutorial-alpha.md) | Ops tutorial alpha |

---

## Other

| Document | Purpose |
|----------|---------|
| [NPC Gate System Implementation Plan.txt](./NPC%20Gate%20System%20Implementation%20Plan.txt) | NPC gate system plan (legacy .txt) |

---

## Archived Documents (dot-prefixed, pending deletion)

24 documents have been dot-prefixed. These are completed implementation summaries, superseded bug fix reports, or sprint checklists with all items resolved. Any unresolved TODOs were extracted to [TODO.md](./TODO.md) before archiving.

```
.AUDIT_SUMMARY.md
.BOSS_IMPLEMENTATION_SUMMARY.md
.COLLECTIBLES-BUG-FIX.md
.COLLECTIBLES-IMPROVEMENTS-SUMMARY.md
.COMMERCE-DRAG-DROP-IMPLEMENTATION.md
.DEATH_SYSTEM_IMPLEMENTATION.md
.DRAG_DROP_UX_SUMMARY.md
.GHOST_FLOOR_ISSUE.md                    (TODOs extracted to TODO.md P1)
.IMPLEMENTATION_GUIDE.md                 (leaderboard TODOs extracted to TODO.md P1)
.IMPLEMENTATION_SUMMARY.md
.ITEM_DISPLAY_NAME_IMPLEMENTATION.md
.KEYBOARD_IMPLEMENTATION_SUMMARY.md
.LIGHTING_ENGINE_IMPLEMENTATION.md
.PHASE3_STR_COMBAT_COMPLETE.md
.PHASE5_IMPLEMENTATION.md
.PLAYTEST_BUGS.md                        (bugs extracted to TODO.md P0)
.QUICKSTART_VENTS.md
.RESOURCE_ECONOMY_IMPLEMENTATION.md
.SHOP_SYSTEM_IMPLEMENTATION.md
.STAKEHOLDER_SPRINT_TODO.md
.STR_CARD_SYSTEM_REDESIGN.md
.UBER_AWOL_IMPLEMENTATION_SUMMARY.md     (TODOs extracted to TODO.md P1)
.UI_IMPLEMENTATION_SUMMARY.md
.VENTS_BIOME_IMPLEMENTATION.md
```
