




EYES ONLY
Card Hand Harmonization Roadmap
Unifying CardRefs, Killing Legacy cardHand, and Making Dynamic Rolls First-Class Citizens
March 2026  •  Gone Rogue Engine
Phase 5 follow-up: NCH backup-deck cascade harmonization
v2.0 — Includes cross-system integration with Plant Mechanic & Explosive Cards
 
Guiding Principles
The NCH (Non-Combat Hand) ref-based system is sacred. All harmonization flows toward it, never away from it. The target state is simple:
•	All cards everywhere are CardRefs — lightweight { id, qty, meta } objects
•	Registry cards point to static definitions (ACT-*, EATK-*)
•	Dynamic rolls become first-class instances with minted CI-* IDs, persisted in save state
•	Enemy-specific attack cards, empty card slots for planting cards, and enemy BLVCK placeholder cards use a policy flag (stealable, plantable, destroyable: true/false), not a structural fork

This document lays out the concrete harmonization plan. Each step is designed to be independently shippable so surface area stays contained.
Cross-System Scope
This roadmap intersects with three companion systems. Integration points are called out inline with orange sidebar callouts throughout the document.
•	ENEMY_NCH_INTERACTION_ROADMAP — enemy capsule rendering, plant mechanic, NCH interchange UI, STR combat enemy hand
•	EXPLOSIVE_BREAKABLES_ROADMAP — explosive cards (FRAG_GRENADE, PIPE_BOMB, C4_CHARGE), pickpocket-to-plant-detonate combat loop
•	ENEMY_CARDS — EATK-* database, enemy decks, Information Duel system, tag synergy ecosystem

Problem: Two Parallel Hand Systems
The game currently maintains two independent hand arrays in GAMESTATE that serve overlapping purposes:
System	State Key	Stores	Used By
Legacy	_state.cardHand	Full card objects (name, emoji, stats, affixes, quality)	addToHand(), addCard()
NCH (canonical)	_state.cardsInHand	Lightweight refs: { id, qty, meta }	addCardToHand(), acquireNewCardDuringCombat()

The legacy system was built for STR combat when cards were ephemeral: roll a card, push the full object into an array, play it, discard it. The NCH system was built later for persistent card management: cards exist by ID in a registry, hand/backup/vault hold references.
The core conflict: dynamically rolled cards (ID like card_1709…_abc) exist only as JS objects. They have no registry entry, so the NCH ref-based system can’t hydrate them. This is why acquireNewCardDuringCombat() can’t be used for enemy loot drops — the card ID resolves to nothing.

The plant mechanic makes this worse: when a player plants a card from their hand into an enemy’s deck (ENEMY_NCH_INTERACTION_ROADMAP Phase 2.4), the planted card lives in enemy.cardDeck[i].planted.cardId. If that card is a CI-* instance, both the player’s containers and the enemy’s deck must agree on how to hydrate it. Without harmonization, the enemy capsule renderer can’t display a planted procedural card.

Step 1: Make Dynamic Cards Persistable
A. Introduce CI-* Instance IDs
When a procedural roll happens (CardSystem.rollCard(), rollCommonCharm(), etc.), mint a first-class instance ID:
CI-<timestamp>-<rand>
 
Examples:
  CI-1709345678901-k8f2m    // rolled from enemy drop
  CI-1709345679022-p3x7n    // rolled from breakable

This replaces the old card_<timestamp>_<rand> format. The CI- prefix makes these instantly distinguishable from registry cards (ACT-, EATK-, ITM-).
B. Persist Instances in GAMESTATE
Add a new top-level map to GAMESTATE._state:
cardInstances: {
  "CI-1709345678901-k8f2m": {
    instanceId: "CI-1709345678901-k8f2m",
    baseId: "ACT-002",     // template card (or null for pure procedural)
    name: "Precision Strike",
    emoji: "🗡️",
    type: "attack",
    quality: "UNCOMMON",
    qualityName: "Uncommon",
    qualityColor: "#4fc3f7",
    stats: { damage: 12, accuracy: 85 },
    affixes: ["keen"],
    tags: [],
    createdAt: 1709345678901,
    seed: 0.7823,
    provenance: {
      source: "enemy_drop",
      floor: 5,
      enemyType: "GRUNT"
    }
  }
}

This makes the vault safe: persistentCards can store { id: 'CI-...', qty: 1 } and the card can always be hydrated. The key-value structure avoids duplicates and gives O(1) lookup.
⚠ Plant Mechanic Integration: The provenance field must also track plant events. When a player plants a card into an enemy deck (ENEMY_NCH_INTERACTION_ROADMAP §2.4), the instance’s provenance should record the plant:
provenance: {
  source: "player_hand",     // where the card was before planting
  plantedInto: "enemy_deck", // destination
  enemyId: "WAREHOUSE_ENFORCER_5_3",
  floor: 5,
  turn: 42
}
Explosive cards (FRAG_GRENADE, PIPE_BOMB, C4_CHARGE from EXPLOSIVE_BREAKABLES_ROADMAP §5.3) follow the same path: they are CI-* or ACT-* refs planted into enemy.cardDeck[i].planted.cardId. The cardInstances map is the single hydration source for both player and enemy containers.
C. GAMESTATE API Additions
// Register a new dynamic card instance
GAMESTATE.registerCardInstance(instance)  // -> CI-* id
 
// Retrieve instance by ID
GAMESTATE.getCardInstance(id)             // -> full instance or null
 
// Garbage-collect unreferenced instances
GAMESTATE.gcCardInstances()               // scans ALL containers,
                                          // including enemy decks
 
// Plant a card from player hand into an enemy's deck
GAMESTATE.plantCardOnEnemy(enemy, cardRef) // -> updates enemy.cardDeck

gcCardInstances() scans cardsInHand, backupCards, persistentCards, burnPile, and all enemy cardDeck arrays for referenced CI-* IDs, then deletes any cardInstances entries with zero references. Called on floor transition and save.
⚠ Critical GC Scope: Planted CI-* cards live in enemy.cardDeck[i].planted.cardId, not in any player container. If gcCardInstances() only scans player arrays, planted cards get orphaned and deleted on the next GC pass. The GC must enumerate all living enemies on the floor and scan their cardDeck entries for CI-* refs.
// Expanded GC scan (all containers + enemy decks)
GAMESTATE.gcCardInstances = function() {
  var referenced = new Set();
 
  // Player containers
  [cardsInHand, backupCards, persistentCards, burnPile]
    .forEach(function(arr) {
      arr.forEach(function(ref) {
        if (ref.id && ref.id.indexOf('CI-') === 0)
          referenced.add(ref.id);
      });
    });
 
  // Enemy decks (planted cards reference CI-* IDs)
  var enemies = ctx.enemies || [];
  enemies.forEach(function(enemy) {
    if (!enemy.cardDeck) return;
    enemy.cardDeck.forEach(function(slot) {
      if (slot.planted && slot.planted.cardId
          && slot.planted.cardId.indexOf('CI-') === 0)
        referenced.add(slot.planted.cardId);
    });
  });
 
  // Delete unreferenced instances
  Object.keys(_state.cardInstances).forEach(function(id) {
    if (!referenced.has(id)) delete _state.cardInstances[id];
  });
};

Step 2: One Hydration Function for Everything
Create a canonical resolver in CardStateAuthority (or a new card-hydrator.js module):
function hydrateCard(ref) {
  if (!ref || !ref.id) return null;
 
  // Dynamic instance (CI-*)
  if (ref.id.indexOf('CI-') === 0) {
    return GAMESTATE.getCardInstance(ref.id);
  }
 
  // Registry card (ACT-*, EATK-*, ITM-*, etc.)
  if (typeof GoneRogueDataRegistry !== 'undefined') {
    var reg = GoneRogueDataRegistry.getCard(ref.id);
    if (reg) return reg;
  }
 
  // Fallback: use embedded meta (for backward compat)
  if (ref.meta && ref.meta.name) return ref.meta;
 
  return null;
}

This is the single biggest harmonization win. Every renderer, tooltip, combat system, and UI component calls hydrateCard(ref) instead of ad-hoc lookups. The resolution chain is:
•	CI-* → GAMESTATE.getCardInstance()
•	Registry ID → GoneRogueDataRegistry.getCard()
•	Fallback → ref.meta (embedded snapshot)

Consumers that must be updated to use hydrateCard():
Consumer	Current Lookup Method
NCH capsule renderer	GoneRogueDataRegistry.getCard()
Vault grid UI	GoneRogueDataRegistry.getCard()
Hand fan (STR combat)	Direct object access (full card in array)
Enemy NCH capsule	EATK-* lookup from enemy defs
Tooltip system	Mixed: object access + registry lookup
Debrief feed	Object access from card param
shared-item-renderer.js	resolve() with multi-source fallback
Enemy capsule renderer (NEW)	Needs CI-* for planted cards
NCH interchange UI (NEW)	Drag source/target → hydrateCard()
Planted card trigger system (NEW)	STR combat detonation needs card stats
⚠ Enemy NCH Consumers: Three new consumers come from the ENEMY_NCH_INTERACTION_ROADMAP: the enemy capsule renderer (Phase 1.1 — shows joker stack on map, must hydrate planted cards to show planted indicator), the NCH interchange UI (Phase 2.2 — side-by-side drag/drop, both panels call hydrateCard), and the planted card trigger system (Phase 3.2 — explosive detonation in STR combat reads card damage stats via hydration).

Step 3: Kill _state.cardHand
Target State
After harmonization, all card containers use refs:
Container	State Key	Contents
STR Hand	cardsInHand	Refs (ACT-*, CI-*)
Backup Deck	backupCards	Refs (ACT-*, CI-*)
Vault (persistent)	persistentCards	Refs (ACT-*, CI-*)
Enemy Deck	enemy.cardDeck	Refs (EATK-*, optionally CI-*)
Planted Slots (NEW)	enemy.cardDeck[i].planted.cardId	Refs (ACT-*, CI-*)

Migration Path
Add a one-time migration function in GAMESTATE.init() or a dedicated migrateCardHand():
1.	Check if _state.cardHand exists and has entries
2.	For each full card object in cardHand:
•	If it matches a registry card deterministically (by base + id pattern) → create ref to registry ID
•	Else → register as CI-* instance via registerCardInstance() → create ref to CI-* ID
3.	Write all refs into cardsInHand
4.	Clear cardHand (set to empty array)
5.	Save state

After migration: delete or deprecate addToHand(card) and addCard(card) — the pathways that push full objects. All acquisition routes through acquireNewCardDuringCombat() or addCardToHand() which work with refs.

Step 4: Update CardSystem Roll Pipeline
Change CardSystem.rollCard() (and all loot award points) so it returns a ref after persisting the instance:
// Before (anonymous object, no persistence)
function rollCard(baseType) {
  ...
  return {
    id: 'card_' + Date.now() + '_' + rand,
    base: baseType, name, emoji, quality, stats, affixes
  };
}
 
// After (first-class CI instance)
function rollCard(baseType) {
  ...
  var instance = {
    baseId: baseType ? BASE_CARDS[baseType].registryId : null,
    name, emoji, type, quality, qualityName, qualityColor,
    stats, affixes, tags: [],
    createdAt: Date.now(),
    seed: _rng(),
    provenance: null  // caller sets this
  };
 
  // Persist and get CI-* ID
  var id = GAMESTATE.registerCardInstance(instance);
 
  return { id: id, qty: 1 };  // CardRef
}

Callers then use the returned ref directly with acquireNewCardDuringCombat(ref.id, ref.qty). No more anonymous objects that only exist inside one array.
Provenance tagging: the caller sets instance.provenance before or after registration to track where the card came from (floor, enemy type, source event). This enables analytics and debugging.
⚠ Explosive Card Creation: When explosive cards (FRAG_GRENADE, PIPE_BOMB, C4_CHARGE) are created for enemy inventories (EXPLOSIVE_BREAKABLES_ROADMAP §5.2), the creation path is CardSystem.createCard(explosiveCardForTier[enemy.tier]). Post-harmonization, this must also flow through registerCardInstance() and return a CI-* ref, so the explosive card can later be planted and hydrated from any container.

Step 5: Persistence Rules
Because CI instances are now in GAMESTATE saved state, persistence becomes simple and powerful:
Card Lifecycle
•	Dropped / looted / purchased procedural cards can go into: hand, backup, or vault
•	Registry cards (ACT-*, EATK-*) are stateless definitions — refs point to them, no instance needed
•	CI-* instances carry full rolled state — they survive save/load, floor transitions, and vault storage
•	Planted cards are CI-* or ACT-* refs living in enemy.cardDeck[i].planted.cardId — they persist as long as the enemy is alive on the floor
Incineration
When a card is incinerated (ejected from backup overflow, consumed in combat, etc.):
•	Registry ref: just remove the ref. The definition still exists in the registry.
•	CI-* ref: remove the ref. Then gcCardInstances() will clean up the instance if no other container references it.
•	Planted CI-* ref: if a planted card detonates or the enemy dies, the ref is removed from enemy.cardDeck. The CI-* instance survives until the next GC pass confirms zero references.
Garbage Collection
The GC scan covers all containers where CI-* refs can live:
Container	Access Path	How CI-* Refs Appear
Player hand	_state.cardsInHand	ref.id
Backup deck	_state.backupCards	ref.id
Vault	_state.persistentCards	ref.id
Burn pile	_state.burnPile	ref.id
Enemy decks	ctx.enemies[*].cardDeck	slot.planted.cardId

Called on floor transition and save. Prevents unbounded growth of cardInstances.
⚠ Plant Lifecycle & GC Edge Case: When an enemy dies with planted cards in their deck, the enemy object is removed from ctx.enemies. If the death-exit awards the planted card back to the player (e.g., post-combat salvage), the card transfers to a player container before the enemy is removed — no GC issue. But if the card is NOT recovered (enemy explodes, or planted card was consumed by detonation), the CI-* ref disappears from all containers and the next GC pass correctly garbage-collects the instance.

Step 6: Policy Flags on Card Definitions
Instead of special-casing interaction logic throughout the codebase, make it a policy flag system on the card definition itself. This governs steal, plant, destroy, and trigger actions through data, not structural forks.
Definition-Level Flags
Add to card definitions (EATK-* in enemy cards, ACT-* in player cards):
// Enemy card definition (EATK-*)
{
  id: "EATK-001",
  name: "Venom Spit",
  type: "enemy_attack",
  stealable: false,       // can player steal this card?
  plantable: false,       // can this slot receive a planted card?
  destroyable: true,      // can player destroy this card?
  triggerable: false,     // can a planted card here be manually triggered?
}
 
// Player card definition (ACT-*) with explosive tags
{
  id: "ACT-FRAG-GRENADE",
  name: "Frag Grenade",
  type: "attack",
  tags: ["explosive", "ballistic", "disposable"],
  plantable: true,        // player can plant this into enemy decks
  triggerable: true,      // once planted, can be manually detonated
}

Flag Semantics
Flag	Scope	Default	Description
stealable	EATK-* defs	true	Whether the player can steal this card from an enemy via Pickpocket Gloves
plantable	ACT-* defs, slot level	false	Whether this card can be planted into an enemy deck; also used on empty enemy slots
destroyable	EATK-* defs	true	Whether the player can destroy this card (costs interaction charge)
triggerable	ACT-* defs	false	Whether a planted card can be manually triggered (explosives only)
Enforcement
•	EnemyCardInteractability.compute() checks all four flags and suppresses unavailable actions
•	The NCH interchange UI (ENEMY_NCH_INTERACTION_ROADMAP Phase 2.2) shows non-stealable cards as greyed/locked and non-plantable slots without the orange drop-target indicator
•	The STR combat enemy hand (Phase 3.2) shows triggerable planted cards with orange glow and a TRIGGER action; non-triggerable planted cards are inert traps that fizzle when the enemy plays them
•	Other interactions (reveal, destroy, etc.) remain available per Information Duel rules

Key insight: this keeps the Information Duel engine intact. The duel can still operate on enemy cards — reveal, destroy, corrupt — while steal/plant/trigger are governed by definition-level policy, not by structural separation.
⚠ Explosive Trigger Policy: Per EXPLOSIVE_BREAKABLES_ROADMAP §5.4, only cards with triggerable: true can be manually detonated in STR combat. Non-explosive planted cards (triggerable: false) act as junk that wastes the enemy’s action when they play it. The triggerable flag is checked by enemy-card-interaction-handler.js when the player clicks a planted card slot.

Cross-System Integration: Plant Mechanic & Explosive Cards
This section consolidates all integration points between the harmonization plan and the plant/explosive systems. Each subsection maps a companion roadmap’s requirement to a specific harmonization step.
Enemy Deck Data Structure (ENEMY_NCH_INTERACTION §1.3)
The enemy card deck model must support planted cards using the CardRef format established by harmonization:
// Enemy card deck slot — post-harmonization
enemy.cardDeck[i] = {
  id: 'EATK-001',             // original enemy card ID (or null for empty slot)
  stolen: false,               // true if player stole this card
  planted: null,               // null or CardRef:
  // planted: {
  //   cardId: 'CI-170934...',  // CI-* or ACT-* ref (hydrate-able!)
  //   plantedBy: 'player',
  //   turn: 42
  // }
  meta: { t: timestamp }
}

Key compatibility point: planted.cardId is a string that follows the same ID conventions as all other CardRefs. It can be ACT-FRAG-GRENADE (registry card) or CI-1709345679022-p3x7n (dynamic instance). Both resolve through hydrateCard({ id: planted.cardId }).
Interchange UI Card Transfer (ENEMY_NCH_INTERACTION §2.3–2.4)
When the player drags a card from their hand to an enemy empty slot in the NCH interchange UI:
6.	The card’s ref is removed from cardsInHand via CardStateAuthority.removeFromHand(index)
7.	A plant entry is written: GAMESTATE.plantCardOnEnemy(enemy, { cardId: ref.id, plantedBy: 'player', turn: N })
8.	The CI-* instance (if dynamic) remains in cardInstances — it is now referenced by enemy.cardDeck[i].planted.cardId instead of cardsInHand
9.	The GC will NOT collect it because the enemy deck scan finds the reference

The reverse (steal from enemy to player hand) works symmetrically: the card enters the player’s hand as a ref and the enemy slot is marked stolen.
Explosive Card Combat Flow (EXPLOSIVE_BREAKABLES §5.3–5.4)
The complete pickpocket-to-detonate loop through harmonized systems:
10.	Pre-combat: Player has FRAG_GRENADE in hand (as ACT-FRAG-GRENADE ref or CI-* instance). Initiates STEAL on adjacent UNAWARE enemy.
11.	Interchange: Player drags explosive from hand to enemy empty slot. Plant animation plays. Card inserted as planted: { cardId: 'ACT-FRAG-GRENADE', plantedBy: 'player', turn: 42 }
12.	STR combat entry: Enemy hand renders planted card with orange glow. hydrateCard({ id: 'ACT-FRAG-GRENADE' }) resolves via registry to get damage stats.
13.	Player trigger: Click planted slot → triggerable: true check passes → ExplosionSystem.detonate() → card damage applied to enemy.
14.	OR enemy self-play: Enemy AI plays the planted card on their turn → if explosive, self-inflicted damage + screen shake; if non-explosive, card fizzles.
15.	Cleanup: Planted card slot becomes 💀 (consumed). If CI-* instance, next GC pass collects it.
hydrateCard() in Enemy Contexts
The hydration function must handle three enemy-related card types:
Card in Enemy Deck	ID Format	Hydration Source	Display
Original enemy card	EATK-*	GoneRogueDataRegistry.getCard()	Hidden joker (BLVCK or interactable)
Planted registry card	ACT-*	GoneRogueDataRegistry.getCard()	Card emoji with orange glow
Planted dynamic card	CI-*	GAMESTATE.getCardInstance()	Card emoji with orange glow
Stolen/destroyed slot	null	N/A	💀 skull

All three live-card types resolve through the same hydrateCard() function. The enemy capsule renderer (Phase 1.1), NCH interchange UI (Phase 2.2), and STR combat enemy hand (Phase 3.1) all call hydrateCard() uniformly — no special-casing.

Implementation Sequence
Each step is independently shippable. Dependencies flow downward. Cross-system steps are tagged with their companion roadmap.
#	Module	Changes	Risk
1	GAMESTATE	Add _state.cardInstances, registerCardInstance(), getCardInstance(), gcCardInstances() (with enemy deck scan), plantCardOnEnemy()	Low — additive only
2	Hydrator	Create hydrateCard(ref); replace ad-hoc lookups in all renderers + 3 new enemy consumers	Medium — many call sites
3	Acquisition	Update acquireNewCardDuringCombat() and loot code to use CI-* refs; wire explosive card creation	Medium — touches loot
4	Migration	One-time cardHand → refs + CI instances; deprecate addToHand() / addCard()	High — breaking change
5	Policy flags	Add stealable, plantable, destroyable, triggerable to card defs; update EnemyCardInteractability	Low — isolated

Dependency Graph
  [1] GAMESTATE instances + plantCardOnEnemy()
       |
       v
  [2] hydrateCard()  <--- all renderers + enemy capsule + interchange UI
       |
       v
  [3] Acquisition pipeline (rollCard returns refs)
       |           \
       |            \--- explosive card creation (EXPLOSIVE_BREAKABLES)
       v
  [4] Migration (kill cardHand)  <--- BREAKING CHANGE
 
  [5] Policy flags (stealable + plantable + destroyable + triggerable)
       ^--- independent, ship anytime
       ^--- ENEMY_NCH_INTERACTION reads these in interchange + combat UI

Step 6.1 — BLVCK as Universal Empty Slot Node
When a player steals the last remaining attack card from an enemy's hand, the enemy doesn't end up with an empty deck — they hydrate a BLVCK placeholder card (ACT-000). This BLVCK card serves a dual purpose:
The BLVCK card is the universal "empty plantable slot" node. Every enemy spawns with at least one BLVCK slot appended to their cardDeck alongside their normal EATK-* hand. Enemies with larger decks may have two. This means the interchange UI always has at least one orange drop-target available for planting, even on a full-handed enemy.
Policy flags on BLVCK: stealable: false, plantable: true, destroyable: false, triggerable: false. It can't be stolen (it's not a real card), can't be destroyed (nothing to destroy), but it IS the designated plant target. Once a card is planted into a BLVCK slot, the slot's planted field populates and the BLVCK joker is replaced by the planted card's emoji with orange glow.
The edge case: if an enemy has had ALL their real cards stolen and nothing has been planted into their BLVCK slots, the enemy must still be able to act in STR combat. In this situation, the enemy "plays" the BLVCK card — it resolves as a weak desperation action (0-2 damage, no tags, no synergy potential, no combo contribution). The intent system shows the BLVCK play with a (ಥ_ಥ) face expression and the overhead telegraph reads '🃏 ???'. This is intentionally pathetic — the player is rewarded for a full steal. But the enemy isn't completely helpless; they still get a turn and can still trigger awareness/investigation behaviors.
BLVCK in the enemy capsule renderer: BLVCK slots render as the existing .nch-joker-greyed dim joker with a faint dashed border (distinguishing them from hidden-but-real cards which have solid borders). When the player has Pickpocket Gloves equipped, BLVCK slots pulse orange to indicate plantability.
Data structure for BLVCK in enemy deck:
enemy.cardDeck.push({
  id: 'ACT-000',           // BLVCK placeholder
  stolen: false,
  planted: null,            // null until player plants
  isBlvckSlot: true,        // flag for renderer/AI distinction
  meta: { t: Date.now() }
})
The isBlvckSlot: true flag lets the enemy AI distinguish between "I had a real card and it was stolen" (stolen: true on a real slot) and "this is a plantable empty slot" (BLVCK). The AI only falls back to playing BLVCK as a desperation action when ALL non-BLVCK slots are either stolen or destroyed AND no planted cards exist.
________________________________________
Step 6.2 — Synergy-Triggered Planted Explosive Detonation
When an enemy plays a card from their hand during STR combat, the tag synergy system evaluates the played card's tags against all other cards in the enemy's active hand — including planted cards. If the enemy's played card would form a combo with a planted explosive (matching the combo's tag requirements), the planted explosive auto-fires as part of the combo chain resolution.
Example: Enemy plays EATK-022 Broken Lever (tags: melee, improvised, black_market). The player previously planted ACT-FRAG-GRENADE (tags: explosive, ballistic, disposable) into a BLVCK slot. If a tag synergy combo exists that chains improvised + explosive (e.g., "Improvised Detonation" or any future combo), the planted grenade auto-detonates as part of the enemy's own combo resolution — the enemy inadvertently triggered the player's trap through their own synergy chain.
Resolution order:
1.	Enemy selects card to play (normal AI selection, avoids planted cards unless desperate)
2.	Card tags are evaluated against all active slots (including planted cards) for combo potential
3.	If a combo fires that includes a planted explosive's tags, the explosive triggers as a secondary effect
4.	Explosive damage is applied to the enemy (self-inflicted, full damage — not the 60% reduction that applies when enemies intentionally play their own explosives)
5.	The combo's other effects still resolve for the enemy (they get their Broken Lever stagger, but also eat a grenade)
6.	MOK interjection: 'Their own combo set off your trap!'
7.	Planted card slot consumed (becomes skull)
This creates a deeper planting strategy: instead of planting into any empty slot, the player is incentivized to study the enemy's remaining deck and plant explosives that are tag-compatible with cards the enemy is likely to play. The Pattern Lens (ITM-087) becomes extra valuable here — seeing momentum and tag composition helps the player predict which enemy card will fire next and plant accordingly.
The triggerable: true flag is checked during combo resolution, not just on manual click. Auto-trigger via synergy is a second activation path that bypasses the interaction charge cost (the enemy is doing it to themselves). Non-explosive planted cards with triggerable: false can still participate in synergy evaluation for fizzle combos — the combo "fires" but the planted card contributes nothing, wasting the enemy's combo potential.
The C4_CHARGE special case: C4 has a 1-turn delay even when synergy-triggered. If an enemy combo would fire C4, the C4 enters "armed" state (orange pulse intensifies, ticking sound hook) and detonates at the START of the next enemy turn, before they select a card. This preserves C4's identity as the delayed-but-devastating option while still letting synergy be the trigger mechanism

What This Unlocks
Once harmonization is complete:
•	Backup deck cascade works for all cards — enemy drops use acquireNewCardDuringCombat() with automatic hand → backup → incinerate overflow
•	Vault stores anything — procedural rolls, registry cards, and enemy-acquired cards all persist as refs to hydrate-able sources
•	UI is consistent — every renderer calls hydrateCard(ref) and gets the same shape back regardless of card origin
•	Save/load is clean — no more full card objects serialized inline; refs + instances separate identity from storage
•	Enemy card and empty card slot interactions are policy-driven — steal/reveal/destroy/plant/trigger governed by definition flags, not structural forks
•	Analytics track provenance — every CI-* instance knows where it came from (floor, enemy type, source event) and where it went (planted into which enemy)
•	Plant mechanic uses harmonized refs — cards planted into enemy decks are CardRefs that hydrate through the same function as everything else. No parallel system needed.
•	Explosive combat loop is clean — FRAG_GRENADE/PIPE_BOMB/C4_CHARGE planted via interchange, hydrated in combat, triggered via policy flags, garbage-collected on death. One data model, one hydration function, one GC.
