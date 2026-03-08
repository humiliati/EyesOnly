# EyesOnly TODO

> **Last Updated:** 2026-03-07
> **Cross-Reference:** [WORLD_BUILDING_ENGINE_ROADMAP.md](./WORLD_BUILDING_ENGINE_ROADMAP.md) for implementation roadmap

This is a short, living TODO list tracking bugs, blockers, and next actions.

---

## P0 — Critical Bugs (from Playtesting)

- [x] ~~**STR combat minimize leaves cards visible**~~ — Fixed: `hand-fan-component.js` minimize guard now clears CSS classes, opacity, transforms, and pointer-events when STR combat minimizes. Restore path also resets these on maximize.
- [x] ~~**Card dragging broken (BLVCK inversion)**~~ — Fixed: BLVCK (ACT-000) now explicitly marked `dataset.unaffordable = 'true'` in `shared-card-renderer.js` so it's never draggable. Regular card draggability depends on `ResourceManager.canAffordCard()` — if cards with costs still can't drag, check resource state at runtime.
- [x] ~~**Breakable multi-item pickup overlapping**~~ — Fixed: `overhead-animator.js` now staggers stacked animations by 250ms and unifies CURRENCY_PICKUP curve to match EXPRESSION (same float-up, same timing). "Items remaining on ground" is by design — scattered items on adjacent tiles require player to walk there.
- [x] ~~**Breakable contents not spreading**~~ — Verified: `LootSpillSystem.scatterItems()` is correctly wired into `breakable-system.js _spawnBreakableLoot()`. Items 1-3 stay on center with sub-tile visual offset, items 4+ spill to adjacent walkable tiles. Script loading order confirmed correct (loot-spill loads before breakable-system). If items still stack, check that breakables produce 4+ items to trigger spill.
- [x] ~~**Key ammo rendering as item**~~ — Fixed: tooltip now uses monochromatic 🗝 glyph + resource-style format ("🗝 KeyName +1") instead of colored 🔑 + "KEY AMMO:" format. Debrief already routed to resource row.
- [x] ~~**Enemy loot pipeline incomplete**~~ — Fixed: `death-exit-system.js` was already the canonical loot spawner (currency, cards via CHH, charms, ammo, resource drops + LootSpillSystem scatter + overhead summary). `str-combat-engine.js` was duplicating all spawns from the same `deathResult`, giving 2x drops. Removed duplicate spawning from STR engine, now populates `_victoryCtx` from `deathResult._resolvedCards/_resolvedCharms` instead. Boss loot (unique to STR) still handled in STR engine. Player death scatter (`_scatterPlayerInventory`) already functional for cards, ammo, battery, currency. `_deathDrop` visual rendering and food emoji drops are future P1 features.
- [x] ~~**Floor 3 NPC not interactive**~~ — Fixed: Trainer NPC now has full `dialogueTree` with 6 nodes (greeting, tactics, cards, danger, deeper, ready) covering combat tips, enemy intel, and card mechanics.

### Resolved P0 Bugs
- [x] ~~Building exit spawn bug~~ — Fixed by `door-contract-system.js` with `applyBuildingDoorContract()` funnel pattern. Player now spawns near the correct exit door on the parent floor.

---

## P0 — Blockers

- [ ] **Standardize unified inventory metadata schema** (season/rarity/ladder/tags) and document it.
- [ ] Wire more **spend/consume paths** to server consume beyond active item (e.g., shop purchases, card disposal/spend semantics).
- [ ] Expand **merge-local-data** coverage beyond `eyesonly_gamestate` (identify canonical localStorage keys + conflict rules).

---

## P1 — Important

- [ ] **Ghost floors (3-4) have no enemies** — `_placeEnemies()` returns early for `FLOOR_TYPES.GHOST` with a TODO for camera/drone surveillance system. Floors 3-4 are trivially empty. Needs surveillance enemy implementation (cameras, drones, or hybrid). See `.GHOST_FLOOR_ISSUE.md` for design options.
- [ ] **M ping/pressure loop placeholder** — AWOL button UI is canonical but M ping backend is placeholders + TODOs. See `.UBER_AWOL_IMPLEMENTATION_SUMMARY.md`.
- [x] ~~**Tavern basement empty doors**~~ — Fixed: Player spawn moved from (20,17) to (35,17) to match cellar stairs entry point in tavern interior. Exit door moved from (20,18) to (37,17) — valid tile within grid bounds, near entry point. Player now explores leftward toward BLACKSMITH_HAMMER quest item.
- [x] ~~**Diagnostic logging cleanup**~~ — Removed 24 verbose console.log/warn statements from `door-contract-system.js` (7) and `tutorial-floor-gen.js` (17).
- [x] ~~**TUTORIAL_FLOORS_AUDIT.md bug status update**~~ — All 13 bug status markers formally updated. 11/13 ✅ FIXED, 2 partial (BUG 4 suppressAnimation needs wiring, BUG 13 building door contract needs wiring).
- [ ] **Highscore system game integration** — Hook up Gone Rogue score submission on extraction. Add Street-Chronicles completion tracking. Backend endpoints needed. See `.IMPLEMENTATION_GUIDE.md` for leaderboard spec.
- [ ] Add username availability endpoint/UI polish.
- [ ] Add M UI convenience: typeahead callsign/user lookup when granting roles and inventory.
- [x] ~~**Phase C loot-spill-system.js**~~ — Player death scatter implemented in `death-exit-system.js _scatterPlayerInventory()`: drops equipped hand, backup deck, ammo, battery, and 50% currency via LootSpillSystem. Remaining: `_deathDrop` visual rendering (broken card art), food emoji tracking/drops, death animation cascade.
- [x] ~~**Food consumption history + ground-effect interactions**~~ — Implemented: GAMESTATE ring buffer (`recentFood[]`, max 5, 20-step duration) tracks inert food consumption. New `food-ground-interaction.js` module checks food×ground-effect matrix when player steps on tiles. One-shot: food consumed from buffer on first matching interaction. 5 inert foods with interactions: Water→FIRE/OIL_IGNITED (fire immunity 2 steps), Honey→OIL (oil spread), Juice→CONDUCTIVE (shock immunity 3 steps), Candy→SODA_SPILL (soda spread), Dango→ICE (melt to water). Fire/shock immunity guards in both `ground-effects-system.js` and `game-tick-system.js` DOT sections. Tooltip-only feedback, no HUD elements.
- [ ] **Shop system manual testing** — Testing checklist in `SHOP_SYSTEM_COMPLETE.md` has unchecked items.
- [x] ~~**Lighting contract: utility vs ambient lights**~~ — Fixed: Implemented `purpose` field on all light sources (`'ambient'` | `'utility'` | `'legacy'`). Ambient lights (biome-generated) are always visible + interactive/breakable (if hp > 0). Utility lights (doors, exits, gates, spawn highlights) are invisible + non-interactive — purely for illumination. Replaced old probabilistic visibility system (20-45% visible, 25-70% interactive) with deterministic contract. Updated: `lighting-system.js` (addLightSource 7-param, generateBiomeLights, getLightSourcePositions), `floor-gen-core.js` (breakable registration), `tutorial-floor-gen.js`, `biome-gate-system.js`, `interior-floor-system.js` (all utility callers).

---

## P2 — Future / Optional

- [ ] Password-based auth (if re-adopted) and account recovery flows.
- [ ] Agent API key binding / kernel persistence integration.
- [ ] Kernel command system + agent runner adapter.
- [ ] Score replay system, challenges, achievements.

---

## Implementation Roadmap Items

The following are tracked in the unified roadmap ([WORLD_BUILDING_ENGINE_ROADMAP.md](./WORLD_BUILDING_ENGINE_ROADMAP.md)):

| ID | Task | Priority |
|----|------|----------|
| INT-1 | Interior biome schema extensions | Tier 1 |
| NPC-B | NPC pathing system | Tier 1 |
| PAT-1 | Scalar field foundation | Tier 1 |
| INT-2 | Structure grammar system | Tier 2 |
| NPC-C | Avatar stack rendering | Tier 2 |
| INT-3 | Visual compression | Tier 2 |
| NPC-D | Proc gen NPC stamping | Tier 3 |
| NPC-E | Vulnerability systems | Tier 4 |

See roadmap for full dependency graph and execution order.

Paper Terraria visual/rendering work tracked in [PAPER_TERRARIA_ALIGNED_ROADMAP.md](./PAPER_TERRARIA_ALIGNED_ROADMAP.md):

| Sprint | Focus | Status |
|--------|-------|--------|
| 1 | Shadow polygon casting (Phase 1.3) | ⬜ |
| 2 | Paper Mario perspective + parallax (Phase 2.3) | ⬜ Assets generated |
| 3 | Light orbs + twinkle polish (Phases 3.1-3.2) | ⬜ |
| 4 | Lighting cache + adaptive FPS (Phase 5) | ⬜ |
| 5 | Test pages + validation | ⬜ |

Environment Gate Contract tracked in [ENVIRONMENT_GATE_CONTRACT.md](./ENVIRONMENT_GATE_CONTRACT.md):

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Floor State Tracker module | ✅ Done |
| 2 | Tutorial floor gate fixes (Floors 2-3) | ✅ Done |
| 3 | Biome gate emoji registry | ⬜ |
| 4 | Asset Scene Designer composite gates | ⬜ |
| 5 | Full-span procedural gate placement | ⬜ |
| 6 | Respawn integration (gates/breakables/enemies) | ⬜ |
