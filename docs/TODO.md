# EyesOnly TODO

> **Last Updated:** 2026-03-07
> **Cross-Reference:** [WORLD_BUILDING_ENGINE_ROADMAP.md](./WORLD_BUILDING_ENGINE_ROADMAP.md) for implementation roadmap

This is a short, living TODO list tracking bugs, blockers, and next actions.

---

## P0 — Critical Bugs (from Playtesting)

- [ ] **STR combat minimize leaves cards visible** — When minimizing the STR combat window with the toggle arrow, equipped hand cards stay visible in the middle of the screen. Cards should minimize with the combat window.
- [ ] **Card dragging broken** — No card dragging occurs unless the BLVCK card (which shouldn't be draggable). All other cards should be draggable. Drag-to-deploy from hand fan to map not working.
- [ ] **Breakable multi-item pickup overlapping** — When a breakable yields multiple contents (ammo, currency, key), collectibles overlap and slide off at different unrelated rates in different directions. Some items remain on the ground requiring a second pass.
- [ ] **Breakable contents not spreading** — Multi-content breakables stack all items on the same tile. Items >3 should spill to adjacent tiles with wall/obstacle awareness. (`loot-spill-system.js` exists at 125 lines but spread behavior may be incomplete.)
- [ ] **Key ammo rendering as item** — `key_ammo` / `tier1keys` overhead-animate and tooltip as items. They should render as monochromatic resource symbols (like ammo/currency/batteries) in the debrief feed without inventory-style tooltips.
- [ ] **Enemy loot pipeline incomplete** — Defeated enemies don't clearly yield loot. Need uniform loot-spill behavior into adjacent tiles after combat resolves. Player death should animate as broken collectible, dropping deck, equipped hand, currency, ammo, batteries, and recent food emojis.
- [ ] **Floor 3 NPC not interactive** — Floor 3 NPC has no dialogue tree. (Floor 1 Elder, Floor 1.2 Father Aldric, Floor 0.1 Tavern Keeper/Blacksmith have dialogue trees but Floor 3 NPC was missed.)

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
- [ ] **Tavern basement empty doors** — Interior doors on floor 0.1.1 may be non-functional (runtime debugging needed).
- [ ] **Diagnostic logging cleanup** — Remove verbose diagnostic logging from `door-contract-system.js` and `tutorial-floor-gen.js`.
- [ ] **TUTORIAL_FLOORS_AUDIT.md bug status update** — Bugs 1-13 status markers not formally updated (8 validated PASS as of 2026-03-06).
- [ ] **Highscore system game integration** — Hook up Gone Rogue score submission on extraction. Add Street-Chronicles completion tracking. Backend endpoints needed. See `.IMPLEMENTATION_GUIDE.md` for leaderboard spec.
- [ ] Add username availability endpoint/UI polish.
- [ ] Add M UI convenience: typeahead callsign/user lookup when granting roles and inventory.
- [ ] **Phase C loot-spill-system.js** — Player death animation + backup deck, equipped hand, and resources scatter. Inventory persists death only when bonfired.
- [ ] **Shop system manual testing** — Testing checklist in `SHOP_SYSTEM_COMPLETE.md` has unchecked items.

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
