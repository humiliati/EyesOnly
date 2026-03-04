


EYES ONLY
Cross-Roadmap Execution Order
Staggered implementation guide across Card Hand Harmonization, Explosive Breakables,
Enemy NCH Interaction, NCH Combat Animations, and the Unified Designer Portal
March 2026  •  Gone Rogue Engine
7 sprints • 5 roadmaps • 1 goal: finish CHH with designer portal exposure
 
Document Legend & Roadmap Index
Each roadmap is color-coded throughout this document. Sprint headers use the color of the primary roadmap being executed.
Abbreviation	Roadmap	Status	Phases/Steps
CHH	CARD_HAND_HARMONIZATION_ROADMAP	Steps 1–4 done	6 steps (1: cardInstances ✔, 2: hydrateCard ✔, 3: kill cardHand ✔, 4: roll pipeline ✔, 5: persistence, 6: policy flags)
EB	EXPLOSIVE_BREAKABLES_ROADMAP	Phase 1 COMPLETE (2026-03-04)	6 phases (1: barrels ✔, 2: ExplosionSystem, 3: VFX, 4: light interact, 5: explosive cards, 6: polish)
ENI	ENEMY_NCH_INTERACTION_ROADMAP	Not started	6 phases (1: capsule, 2: interchange UI, 3: combat hand, 4: NCH adjust, 5: items, 6: polish)
NCR	NCH-COMBAT-ROADMAP	Phase 1 done	Phase 1 (bindings) ✔, Phase 2 (animations) pending
IPR	ITEM-PIPELINE-ROADMAP	Phases 1–5 done ✔	Phase 5 (collectibles rendering) complete. Phase 5 deferred "backup-deck cascade" resolved by CHH Step 3. Phase 6 (doc updates) deferred. Only ground effect items (water/oil) remain unaddressed — no such items exist yet.
UDG	UNIFIED_DESIGNER_GUIDE	Portal exists	Asset/Map/World/Item/Loot designers operational. Card + Enemy designers needed.

Strategic Rationale
The Blocking Problem
The NCH capsule’s maximized frame currently covers the left column (RogueSidebar) action buttons. Playtesters cannot test drag-and-drop between hand, backup, and left column containers. This blocks testing for every system that depends on card manipulation — which is all of them.
Why Not Just Fix NCH Animations First?
Full NCH animation polish (halo ring, collapse sequences, resolve-phase minimize) is a deep rabbit hole. We need the CHH data model in place before animating card transfers that depend on CI-* hydration. And we need explosive breakables implemented before we can test the plant-detonate loop that the enemy NCH interchange is built around.
The Staggered Strategy
•	// Sprint 0 DEFERED TILL LATER: Minimal NCH animation fix — unblock the left column so playtesters can test existing systems while we build new ones
•	Sprint 1: CHH Steps 1–2, 4 — lay the data foundation (cardInstances, hydrateCard, roll pipeline). Step 3 (kill cardHand) deferred.
•	Sprint 2: Explosive Breakables Phases 1–5 — build the barrel/explosion/explosive-card systems that the plant mechanic depends on
•	Sprint 3: Enemy NCH Interaction Phases 1–5 — capsule, interchange UI, STR combat enemy hand, planted card triggers
•	Sprint 4: NCH Combat Animation full pass — player and enemy hand animations inside and outside STR combat
•	Sprint 5: CHH Steps 4–6 — roll pipeline, persistence rules, policy flags. Finish the harmonization.
•	Sprint 6: Designer Portal expansion — card designer, enemy deck designer, policy flag editor, explosive card workflow
End state: CHH fully complete, all card containers unified under CardRefs, every seam exposed to the designer portal, and all companion systems (explosives, plant mechanic, enemy capsule) implemented and testable.

SPRINT 0: NCH Left Column Unblock - DEFERED TILL LATER
// [NCR] Phase 2.1 + 2.2 (partial) — Minimal animation work to stop the NCH frame from occluding the left column.
// Scope (do)
•	// 1. Hand Fan Renderer extraction (partial): Extract HandFanRenderer from hand-fan-component.js into a shared module. Both NCH and combat instantiate it. This unblocks the fan layout but does NOT require the halo ring or collapse animation.
//Scope (don’t)
•	//2.3 Backup Halo Ring — DEFERRED to Sprint 4
•	//2.4 Map Deploy Collapse Animation — DEFERRED to Sprint 4
•	//2.5 Left Column Combat Thumbnails — DEFERRED to Sprint 4
Files
•	non-combat-hud.js — joker stack renderer replaces capsule minimize
•	non-combat-hud.css — joker stack pancake styles + remove oversized frame
•	New: hand-fan-renderer.js — extracted shared fan layout
•	hand-fan-component.js — delegates to HandFanRenderer
Exit Criteria
•	Left column buttons fully visible and clickable when NCH is minimized
•	Drag-and-drop from left column to hand fan works in both NCH and GC PLANT / STEAL NCH noded capsule renders
•	Joker stack shows correct card count, click expands to hand fan
•	No halo ring yet — backup scroll stays as existing solitaire tableau temporarily

SPRINT 1: Card Hand Harmonization — Data Foundation ✔ COMPLETE
[CHH] Steps 1–4 — The structural backbone that every subsequent sprint depends on.
Step 1: Make Dynamic Cards Persistable
•	GAMESTATE._state.cardInstances map — key/value store for CI-* instances
•	registerCardInstance(instance) — mints CI-<timestamp>-<rand> ID, stores in map
•	getCardInstance(id) — O(1) lookup
•	gcCardInstances() — scans player containers AND enemy decks for CI-* refs, deletes orphans
•	plantCardOnEnemy(enemy, cardRef) — writes planted ref into enemy.cardDeck[i].planted
•	Provenance field: source, floor, enemyType, plantedInto (for plant tracking)
⚠ Cross-system note: The GC enemy deck scan is critical for Sprint 3 (ENI). Planted CI-* cards live exclusively in enemy decks — without this scan they’d be garbage-collected.
Step 2: One Hydration Function for Everything
•	hydrateCard(ref) — CI-* → getCardInstance(), registry → getCard(), fallback → ref.meta
•	Update all existing consumers: NCH capsule, vault grid, hand fan, tooltip, debrief, shared-item-renderer
•	Pre-wire 3 future consumers (stubs that will activate in Sprint 3): enemy capsule renderer, NCH interchange UI, planted card trigger system
Step 3: Kill _state.cardHand ✔ COMPLETE (2026-03-04)
•	One-time migration: cardHand full objects → refs + CI-* instances in cardsInHand ✔
•	Deprecate addToHand(card) and addCard(card) — all paths now use acquireNewCardDuringCombat() / addCardToHand() ✔
•	Verify save/load round-trips correctly with new ref-based hand ✔
•	drawCardsToHand() refactored to use cardsInHand + CI-* conversion ✔
•	passive-items-system.js _depositCard() routed through canonical pipeline ✔
•	Boss/mythic loot in str-combat-engine.js migrated to acquireNewCardDuringCombat() ✔
•	death-exit-system.js enemy death card drop migrated to canonical pipeline ✔
•	All charm rolls (rollInventoryCharm, rollCommonCharm, rollImpossibleCharm) now register CI-* instances ✔
•	Universal no-stack rule enforced across ALL containers (cardsInHand, backupCards, persistentCards, inventoryPersistent, actionButtonCards) — every slot is qty: 1 ✔
•	Legacy save migration unstacks any stacked vault entries on load ✔
•	Duplicate-in-backup guard removed — same-type cards allowed as individual slots ✔
Exit Criteria ✔ ALL MET
•	_state.cardHand is empty after migration. All cards hydrate through hydrateCard() ✔
•	Existing combat loot drops work: enemy card drops → direct to hand via refs ✔
•	Backup deck cascade (hand overflow → backup → incinerate) works for CI-* and ACT-* refs ✔
•	Save, quit, reload — all cards survive with correct display ✔
Playtest Gate ✔ PASSED
After Sprint 1, playtesters can: collect enemy card drops into hand, overflow into backup, incinerate oldest backup card, and have all cards render correctly through hydrateCard(). CI-* cards persist across save/load. Left column drag-drop routes correctly between vault and backup based on swapper tab mode.

SPRINT 2: Explosive Breakables — Barrels Through Combat Cards ← ACTIVE
[EB] Phases 1–5 — Build the explosive systems that the plant-detonate loop depends on. Phase 6 (polish) deferred to Sprint 6. CHH Steps 1-4 complete. Phase 1 in progress.
Phase 1: Explosive Barrel Breakable Type ✔ COMPLETE (2026-03-04)
•	BARREL_GREY (🗑️, 2HP, inert cover, standard loot) + BARREL_RED (🛢️, 1HP, explosive, blast radius 2.75, 9-25 damage) ✔
•	Destruction override: `breakable.explosive` → `_triggerExplosion()` with scorched debris ▓, AoE damage via circular BFS, ground fire/smoke, 💥 overhead, noise radius 8 ✔
•	Chain detonation with `_detonatedThisTick` object + `_detonationDepth` counter (infinite loop guard, cleared on root cascade exit) ✔
•	Barrel definitions added to biomes: FOREST, GREY_CAVE, MALL (grey+red), INDUSTRIAL (Oil Drum upgraded to explosive schema + grey barrel) ✔
•	Spawning rules: maxPerFloor: 3 on red barrels, kickable: true on both types ✔
•	CSS explosive-idle-pulse animation: 2s infinite red-to-dark-red glow (drop-shadow + color cycle), applied via `cell-explosive-idle` class when `breakable.explosive && hp > 0` ✔
•	Test barrels placed on tavern collectibles test floor Row H (y:16): 2 grey + 3 red for chain detonation testing ✔
•	Blast effects per tile: enemy damage (full) + awareness ENGAGED, player damage (50% reduction), breakable chain damage, ground fire (50%) / smoke (30%) / oil ignition / water evaporation ✔
Phase 2: ExplosionSystem Module
•	New: explosion-system.js — stateless IIFE, detonate(x, y, radius, damage, ctx)
•	Circular BFS with damage falloff, per-tile effects (enemy damage, breakable chain, ground fire/smoke, oil ignite, water evaporate)
•	Entity push/knockback (distance-scaled force, wall collision bonus damage)
•	Noise 8 at epicenter — loudest event in the game
Phase 3: Visual Effects & Screen Shake
•	CSS explosion-shake (0.4s) + explosion-flash (0.6s orange-red)
•	Overhead explosion emoji ripple (staggered fire emojis by distance ring)
•	Breakable light explosion polish (glass shatter, spark shower, darkness ripple)
•	MOK + debrief + tooltip integration
Phase 4: Breakable Lights — More Interactive & Dynamic
•	Explosion chain with lights (HP-based survival, torch → fire ground)
•	Kick barrel into breakable light → light damage + possible detonation
•	Phase 4 is optional polish — can ship without, revisit in Sprint 6
Phase 5: Explosive Cards & STR Combat Integration
•	Three explosive cards: FRAG_GRENADE (12 dmg, AoE 2), PIPE_BOMB (8 dmg, stun), C4_CHARGE (20 dmg, AoE 3, delayed)
•	Enemy explosive inventories: tier-based chance to carry explosive cards
•	This is where CHH Step 1 matters: explosive card creation must flow through registerCardInstance() to produce CI-* refs that the plant mechanic can later hydrate
•	Enemy AI explosive usage (60% damage reduction, telegraph indicators)
•	Pre-combat pickpocket flow stub — the full interchange UI comes in Sprint 3 (ENI Phase 2), but EB Phase 5 establishes the data structures and combat card effects
⚠ Dependency on CHH: EB Phase 5 requires CHH Step 1 (registerCardInstance) and Step 2 (hydrateCard) to be complete. Explosive cards created for enemy inventories must be persistable CI-* instances so they survive the plant → combat → trigger lifecycle.
Exit Criteria
•	Red barrels spawn, detonate, chain-react, apply ground effects
•	Screen shake and VFX play correctly
•	Explosive cards exist in card pool, appear in enemy inventories
•	Explosive cards can be played in STR combat (by enemy AI)
•	Explosive cards are CI-* instances stored via registerCardInstance()
Playtest Gate
After Sprint 2, playtesters should be able to: shoot/kick red barrels to trigger explosions with chain reactions, see explosive cards in enemy inventories (via telegraph indicators), and watch enemy AI play explosive cards in STR combat. The plant-into-enemy flow is not yet available (that’s Sprint 3).

SPRINT 3: Enemy NCH Interaction — Capsule Through Combat
[ENI] Phases 1–5 — The full enemy card interaction surface. Phase 6 (polish) deferred to Sprint 6.
Phase 1: Enemy NCH Capsule on the Map
•	1.1 Enemy Capsule Renderer: New enemy-capsule-renderer.js — joker-stack above enemies, 60% scale, proximity fade
•	1.2 Capsule Interactability: Reuses EnemyCardInteractability.computePreCombat() — green pulse (stealable), orange pulse (plantable), grey (no tool)
•	1.3 plantSlots Data Structure: Extend enemy.cardDeck[i] with planted: null | { cardId, plantedBy, turn }. Default planted: null on hydration. BLVCK empty slots (ACT-000 with isBlvckSlot: true) appended to enemy decks as plantable targets.
⚠ CHH dependency: Phase 1.1 calls hydrateCard() (CHH Step 2) to display planted card indicators. Phase 1.3 uses CardRef format (planted.cardId is ACT-* or CI-*) established by CHH Step 1.
Phase 2: Player NCH Interchange (Steal & Plant UI)
•	2.1 Interchange Trigger: STEAL command opens side-by-side overlay instead of instant resolution
•	2.2 Side-by-Side Layout: Player hand (left) + enemy hand (right). Drag enemy card → player = steal. Drag player card → enemy empty slot = plant.
•	2.3 Steal Drag Animation: Joker lifts, crosses gap, flips to reveal card face, slides into hand position
•	2.4 Plant Drag Animation: Card lifts from player hand, crosses gap, flips to joker back, enemy slot shows planted indicator
•	2.5 Interaction Budget: Default 1 action (steal OR plant). Scrambler Chip (ITM-090) grants 2.
⚠ EB dependency: Phase 2 enables planting explosive cards (EB Phase 5). The full pickpocket-to-detonate loop becomes testable after this phase: plant FRAG_GRENADE via interchange → enter combat → trigger or enemy self-plays.
Phase 3: STR Combat Enemy Hand as Interactive NCH
•	3.1 NCH-Capsule-Style Combat Layout: Refactor enemy-hand-display.js from flat row to capsule layout in backup scroll space
•	3.2 Planted Card Triggers: Explosive cards detonated on click (triggerable: true check). Non-explosive planted cards fizzle when enemy plays them. C4 has 1-turn delay.
•	3.2.1 Synergy-Triggered Detonation: If enemy’s played card forms a tag combo with a planted explosive, the explosive auto-fires. Full damage (not 60% reduction). C4 still has 1-turn armed delay.
•	3.3 Round-Based Refresh: Interactability, momentum dots, mutation badges, charges all recalculate per round
•	3.4 Enemy Card Play Animation: Select → lift → flip → fly → resolve → consume. Planted card play shows orange highlight + MOK interjection.
Phase 4: Player NCH Animation Adjustments
•	4.1 Card acquisition animation (stolen card flies into player NCH)
•	4.2 Card departure animation (planted card flies from player NCH toward enemy)
•	4.3 Combat dual layout (player hand fan bottom + enemy hand capsule top)
•	4.4 Exploration ↔ combat transitions (map capsule dissolves → combat capsule fades in)
Phase 5: Item & Card Integration
•	5.1 plantTags schema extension: Add plantTags alongside stealTags on items
•	5.2 Explosive card plant flow: Full pickpocket-to-detonate loop wired end-to-end
•	5.3 Validator update for plantTags
•	BLVCK as empty slot node (Step 6.1 from CHH): BLVCK (ACT-000) is the universal plantable empty slot. Policy: stealable: false, plantable: true, destroyable: false. When all real cards stolen and nothing planted, enemy plays BLVCK as desperation action (0-2 dmg, no tags, (ಥ_ಥ) face).
Exit Criteria
•	Enemy capsules visible on map with correct interactability indicators
•	Interchange UI opens, steal and plant both work with animation
•	Planted explosive cards triggerable in STR combat (manual + synergy-triggered)
•	BLVCK empty slots render as dim jokers, pulse orange when Pickpocket Gloves equipped
•	Enemy with all cards stolen plays BLVCK desperation action
Playtest Gate
After Sprint 3, playtesters should be able to: see enemy card capsules on the map, open the interchange UI to steal/plant cards, plant explosive cards into enemies, trigger explosives in combat (click or synergy), watch enemies play planted traps. This is the first time the full plant-detonate loop is testable end-to-end.

SPRINT 4: NCH Combat Animation — Full Pass
[NCR] Phase 2 remainder (2.3–2.5) — All the animation polish that was deferred from Sprint 0. Now that CHH data model and ENI interactions are in place, we can animate everything knowing the final card transfer flows.
2.3 Backup Scroll Halo Ring
•	25-card curved arc (180° semicircle), perspective tilt, horizontal drag scroll
•	Individual cards draggable from halo to hand fan, left column, or map
•	Snap-to-nearest card on scroll release
2.4 Map Deploy Collapse Animation
•	Card drag crosses NCH boundary → hand fan shrinks to joker stack (200ms) → halo cascades to left column (300ms)
•	Reverse: joker stack tap → expand to fan + halo rises from left column
•	Total sequence ≤ 600ms, interruptible
2.5 Left Column Combat Mode (Thumbnails + Draw UX)
•	60×84px card thumbnails for top 5 backup cards
•	Pulsing DRAW x[N] button with item-modifier awareness (True Joker, Magnifying Glass)
•	Hand fan resolve-phase temporary minimize (attacks animating)
Additional: Player + Enemy Hand Coexistence Animation
•	Wire ENI Phase 4 animations (acquisition/departure card flights) into the NCR animation system
•	Exploration ↔ combat transitions: map capsule dissolves, combat capsule fades in, player hand fan expands
•	Dual hand layout in STR combat: enemy capsule top (backup scroll space), player fan bottom
Exit Criteria
•	Halo ring renders 25-card arc, scrolls, individual cards draggable
•	Collapse/expand animations run smoothly in ≤ 600ms
•	Combat left column shows thumbnails + draw button with item modifiers
•	Player and enemy hands coexist in STR combat without visual overlap
•	All card flight animations (steal, plant, acquire, depart) play smoothly

SPRINT 5: Card Hand Harmonization — Finish
[CHH] Steps 4–6 — Complete the harmonization. All card systems now use unified refs, all interaction is policy-driven.
Step 4: Update CardSystem Roll Pipeline
•	rollCard() returns { id: 'CI-...', qty: 1 } CardRef after registering instance
•	All loot award points updated: enemy drops, breakable drops, quest rewards, vendor purchases
•	Provenance tagging on all creation paths (source, floor, enemyType)
•	EB integration: explosive card creation via CardSystem.createCard() also flows through registerCardInstance()
Step 5: Persistence Rules
•	CI-* instances survive save/load, floor transitions, vault storage
•	Incineration: registry refs just remove, CI-* refs remove + GC collects
•	Planted card lifecycle: planted CI-* refs in enemy decks, GC scans enemy arrays
•	GC runs on floor transition and save (all containers + enemy decks)
Step 6: Policy Flags on Card Definitions
•	Four flags on card defs: stealable, plantable, destroyable, triggerable
•	EnemyCardInteractability.compute() checks all four flags
•	Step 6.1 — BLVCK as Universal Empty Slot: ACT-000 is the plantable empty slot node. Enemies spawn with at least one BLVCK slot. Policy: stealable: false, plantable: true, destroyable: false, triggerable: false. When all real cards stolen + nothing planted, enemy plays BLVCK as desperation action.
•	Step 6.2 — Synergy-Triggered Planted Explosive: Enemy’s played card tags evaluated against planted card tags for combo. If combo fires with triggerable: true planted explosive, auto-detonation at full damage. C4 enters 1-turn armed state.
Exit Criteria
•	_state.cardHand does not exist in any save file. All paths use refs.
•	rollCard() returns CardRefs everywhere. No anonymous card objects in the codebase.
•	Policy flags govern all interactions. No structural forks for steal/plant/destroy/trigger.
•	BLVCK empty slots function correctly as plant targets and desperation actions.
•	Synergy-triggered detonation works for all three explosive card types.
•	Save/load/floor-transition all clean with GC running correctly.

SPRINT 6: Designer Portal Expansion — Expose Every Seam
[UDG] + [IPR] + [ENI] + [EB]  — Extend the Unified Designer portal to cover every system built in Sprints 1–5. The existing Item Designer and Loot Designer are templates for these new editors.
6A. Card Designer (new tab in Unified Designer)
•	Scope: CRUD for cards.json (ACT-* player cards). Same pattern as Item Designer.
•	Browse/filter by tags, rarity, type. Edit name, emoji, stats, tags, effects.
•	New fields from CHH: plantable (can this card be planted?), triggerable (can it be manually triggered once planted?)
•	Explosive card workflow: Designer creates FRAG_GRENADE/PIPE_BOMB/C4_CHARGE with plantable: true, triggerable: true, sets damage/AoE/delay stats, tags include explosive
•	Export to cards.json, hot-reload via BroadcastChannel to game
•	Grant to Game: push card into player hand as CI-* instance via registerCardInstance() + acquireNewCardDuringCombat()
6B. Enemy Card Designer (new tab in Unified Designer)
•	Scope: CRUD for enemy-cards.json (EATK-* definitions) and enemy-decks.json (deck loadouts)
•	Browse/edit enemy attack cards: name, emoji, intent type, tags, synergy tags, steal value
•	New fields from CHH: stealable, destroyable on EATK-* defs
•	Deck editor: assign EATK-* cards to enemy types, set hand size, set exposedTags, configure BLVCK empty slot count
•	Enemy catalog pipeline: Designer edits enemy-catalog.json → build script generates enemy-cards.json + enemy-decks.json → registry reloads
•	Synergy tag cross-reference: show which combos each card participates in
6C. Policy Flag Editor (inline in Card + Enemy Card designers)
•	Not a separate tab — integrated into both the Card Designer (ACT-* plantable/triggerable flags) and Enemy Card Designer (EATK-* stealable/destroyable flags)
•	Visual indicators: toggle switches with color-coded labels matching the Information Duel interaction types
•	Validation: warn if EATK-* card has stealable: true but the enemy deck has no exposedTags that would allow stealing
6D. Loot Designer Updates (existing tab)
•	Add explosive card drop rates to enemy loot tables (SCOUT 10% PIPE_BOMB, GUARD 15% FRAG, ELITE 5% C4)
•	Add explosive barrel spawn rates to breakable loot config
•	Visualize the explosive card distribution across enemy tiers
6E. Item Designer Updates (existing tab)
•	Add plantTags field to effect editor (alongside existing stealTags, revealTags, destroyTags)
•	Add interaction_charge_bonus effect type for Scrambler Chip style items
•	Add explosive-interaction effects for items that modify plant/trigger behavior
6F. Validator Updates
•	validate-items.js: add plantTags array validation
•	New: validate-cards.js: schema check for ACT-* cards including plantable/triggerable flags
•	New: validate-enemy-cards.js: schema check for EATK-* cards including stealable/destroyable flags, cross-ref with deck exposedTags
•	All validators runnable via npm scripts, CI-friendly
Exit Criteria
•	Unified Designer has 8 tabs: Asset, Map, World, Item, Loot, Card, Enemy Card, (future: Biome)
•	Every policy flag (stealable, plantable, destroyable, triggerable) editable from the portal
•	Explosive cards creatable from Card Designer, immediately grantable to player hand for testing
•	Enemy decks configurable with BLVCK slot count, exposed tags, and explosive card loadout
•	All validators pass on export. Hot-reload works for all data files.

Full Dependency Map
SPRINT 0  [NCR 2.1, 2.2p]  NCH left column unblock
  |
  v
SPRINT 1  [CHH 1-4]  cardInstances + hydrateCard + kill cardHand + roll pipeline ✔ COMPLETE
  |
  |--- CHH Step 1 (registerCardInstance) ----+
  |--- CHH Step 2 (hydrateCard)         ----|--- required by Sprint 2 (EB Phase 5)
  |--- CHH Step 3 (kill cardHand) ✔     ----|--- required by Sprint 3 (ENI Phase 1)
  |--- CHH Step 4 (roll pipeline) ✔          +--- all charm/card rolls use CI-*
  v
SPRINT 2  [EB 1-5]  barrels + explosions + explosive cards  ← ACTIVE (Phase 1 in progress)
  |
  |--- EB Phase 5 (explosive card instances) --+
  |                                             +- required by Sprint 3 (ENI Phase 2
  v                                                plant explosive flow)
SPRINT 3  [ENI 1-5]  capsule + interchange + combat hand + BLVCK
  |
  |--- ENI Phase 4 (card flight animations) ---+
  |                                             +- required by Sprint 4 (NCR 2.3-2.5
  v                                                dual hand layout)
SPRINT 4  [NCR 2.3-2.5]  halo ring + collapse + thumbnails + dual layout
  |
  v
SPRINT 5  [CHH 5-6]  persistence + policy flags + BLVCK + synergy trigger (Step 3 completed early in Sprint 1)
  |
  |--- CHH Step 6 (policy flags) ---+
  |                                  +- required by Sprint 6 (UDG portal editors)
  v
SPRINT 6  [UDG]  Card Designer + Enemy Card Designer + policy editor + validators

Sprint Summary
Sprint	Primary	Phases/Steps	Depends On	Unlocks
0	NCR	2.1, 2.2 (partial)	NCR Phase 1 (done)	Playtesting: left column visible
1	CHH	Steps 1–4 ✓	Sprint 0	Data foundation for all card systems
2	EB	Phases 1–5	CHH Steps 1–4 (done)	Explosive barrels + cards in pool
3	ENI	Phases 1–5	CHH Steps 1–4, EB Phase 5	Full plant-detonate loop testable
4	NCR	2.3–2.5 + ENI P4	ENI Phase 4	Full animation polish
5	CHH	Steps 5–6 (Step 3 done early)	Sprints 1–4, EB (complete)	Harmonization complete
6	UDG	Portal expansion	CHH Step 6	Designer-facing for everything

Total scope: CHH 6 steps + EB 5 phases + ENI 5 phases + NCR Phase 2 (6 sub-phases) + UDG 6 sub-sections = ~28 work units across 7 sprints.

Deferred & Optional Items
Item	Source	Why Deferred	When to Revisit
EB Phase 4 (light interactions)	EB	Optional polish, not on critical path	Sprint 6 or post-launch
EB Phase 6 (config + sound hooks)	EB	Integration glue, low priority	Sprint 6
ENI Phase 6 (MOK + tooltips + sound)	ENI	Polish, not blocking testability	Sprint 6
IPR Phase 6 (doc updates)	IPR	Non-functional	After Sprint 6
NCR item-modifier draw (True Joker, Mag Glass)	NCR	Partially implemented, not blocking	Sprint 4 or 5
Ground effect items (water, oil)	IPR	No items of these types exist yet	Post-launch
~~IPR Phase 5 backup-deck cascade~~	IPR	~~Resolved by CHH Step 3 (2026-03-04)~~	N/A — drawCardsToHand() now uses cardsInHand refs

