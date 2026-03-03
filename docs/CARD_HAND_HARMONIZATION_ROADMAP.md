

EYES ONLY
Card Hand Harmonization Roadmap
Unifying CardRefs, Killing Legacy cardHand, and Making Dynamic Rolls First-Class Citizens
March 2026  •  Gone Rogue Engine
Phase 5 follow-up: NCH backup-deck cascade harmonization
 
Guiding Principles
The NCH (Non-Combat Hand) ref-based system is sacred. All harmonization flows toward it, never away from it. The target state is simple:
•	All cards everywhere are CardRefs — lightweight { id, qty, meta } objects
•	Registry cards point to static definitions (ACT-*, EATK-*)
•	Dynamic rolls become first-class instances with minted CI-* IDs, persisted in save state
•	Enemy-specific attack cards, empty card slots for planting cards, and enemy BLVCK placeholder cards use a policy flag (stealable,plantable,destroyable: true/false), not a structural fork

This document lays out the concrete harmonization plan. Each step is designed to be independently shippable so surface area stays contained.

Problem: Two Parallel Hand Systems
The game currently maintains two independent hand arrays in GAMESTATE that serve overlapping purposes:
System	State Key	Stores	Used By
Legacy	_state.cardHand	Full card objects (name, emoji, stats, affixes, quality)	addToHand(), addCard()
NCH (canonical)	_state.cardsInHand	Lightweight refs: { id, qty, meta }	addCardToHand(), acquireNewCardDuringCombat()

The legacy system was built for STR combat when cards were ephemeral: roll a card, push the full object into an array, play it, discard it. The NCH system was built later for persistent card management: cards exist by ID in a registry, hand/backup/vault hold references.
The core conflict: dynamically rolled cards (ID like card_1709…_abc) exist only as JS objects. They have no registry entry, so the NCH ref-based system can’t hydrate them. This is why acquireNewCardDuringCombat() can’t be used for enemy loot drops — the card ID resolves to nothing.

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
C. GAMESTATE API Additions
// Register a new dynamic card instance
GAMESTATE.registerCardInstance(instance)  // -> CI-* id
 
// Retrieve instance by ID
GAMESTATE.getCardInstance(id)             // -> full instance or null
 
// Garbage-collect unreferenced instances
GAMESTATE.gcCardInstances()               // scans all containers,
                                          // deletes orphaned CI-* entries

gcCardInstances() scans cardsInHand, backupCards, persistentCards, and burnPile for referenced CI-* IDs, then deletes any cardInstances entries with zero references. Called on floor transition and save.

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

Step 3: Kill _state.cardHand
Target State
After harmonization, all card containers use refs:
Container	State Key	Contents
STR Hand	cardsInHand	Refs (ACT-*, CI-*)
Backup Deck	backupCards	Refs (ACT-*, CI-*)
Vault (persistent)	persistentCards	Refs (ACT-*, CI-*)
Enemy Deck	enemy.cards	Refs (EATK-*, optionally CI-*)

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

Step 5: Persistence Rules
Because CI instances are now in GAMESTATE saved state, persistence becomes simple and powerful:
Card Lifecycle
•	Dropped / looted / purchased procedural cards can go into: hand, backup, or vault
•	Registry cards (ACT-*, EATK-*) are stateless definitions — refs point to them, no instance needed
•	CI-* instances carry full rolled state — they survive save/load, floor transitions, and vault storage
Incineration
When a card is incinerated (ejected from backup overflow, consumed in combat, etc.):
•	Registry ref: just remove the ref. The definition still exists in the registry.
•	CI-* ref: remove the ref. Then gcCardInstances() will clean up the instance if no other container references it.
Garbage Collection
GAMESTATE.gcCardInstances = function() {
  // Collect all CI-* IDs referenced anywhere
  var referenced = new Set();
  [cardsInHand, backupCards, persistentCards, burnPile]
    .forEach(function(arr) {
      arr.forEach(function(ref) {
        if (ref.id && ref.id.indexOf('CI-') === 0)
          referenced.add(ref.id);
      });
    });
 
  // Delete unreferenced instances
  Object.keys(_state.cardInstances).forEach(function(id) {
    if (!referenced.has(id)) delete _state.cardInstances[id];
  });
};

Called on floor transition and save. Prevents unbounded growth of cardInstances.

Step 6: Enemy "Never-Stealable" Attack Cards
Instead of special-casing steal logic throughout the codebase, make it a policy flag on the card definition itself.
Definition-Level Flag
Add to enemy card definitions (EATK-*):
// In enemy card registry or definition files
{
  id: "EATK-001",
  name: "Venom Spit",
  type: "enemy_attack",
  stealable: false,           // <-- policy flag
  restricted: ["steal"],      // <-- alternative: array of denied actions
  // ... other stats
}
Enforcement
•	EnemyCardInteractability.compute() checks the flag and suppresses steal actions
•	The NCH interchange UI shows non-stealable cards as greyed/locked (fits the “sacred capsule” doctrine)
•	Other interactions (reveal, destroy, etc.) remain available per Information Duel rules

Key insight: this keeps the Information Duel engine intact. The duel can still operate on enemy cards — reveal, destroy, corrupt — while steal is denied by policy, not by structural separation.

Implementation Sequence
Each step is independently shippable. Dependencies flow downward.
#	Module	Changes	Risk
1	GAMESTATE	Add _state.cardInstances, registerCardInstance(), getCardInstance(), gcCardInstances()	Low — additive only
2	Hydrator	Create hydrateCard(ref); replace ad-hoc lookups in all renderers	Medium — many call sites
3	Acquisition	Update acquireNewCardDuringCombat() and loot code to use CI-* refs	Medium — touches loot
4	Migration	One-time cardHand → refs + CI instances; deprecate addToHand() / addCard()	High — breaking change
5	Enemy policy	Add stealable: false to EATK-* defs; update EnemyCardInteractability	Low — isolated

Dependency Graph
  [1] GAMESTATE instances
       |
       v
  [2] hydrateCard()  <--- all renderers updated here
       |
       v
  [3] Acquisition pipeline (rollCard returns refs)
       |
       v
  [4] Migration (kill cardHand)  <--- BREAKING CHANGE
 
  [5] Enemy steal policy          (independent, ship anytime)

What This Unlocks
Once harmonization is complete:
•	Backup deck cascade works for all cards — enemy drops use acquireNewCardDuringCombat() with automatic hand → backup → incinerate overflow
•	Vault stores anything — procedural rolls, registry cards, and enemy-acquired cards all persist as refs to hydrate-able sources
•	UI is consistent — every renderer calls hydrateCard(ref) and gets the same shape back regardless of card origin
•	Save/load is clean — no more full card objects serialized inline; refs + instances separate identity from storage
•	Enemy card and empty enemy card slot interactions are policy-driven — steal/reveal/destroy/plant governed by definition flags, not structural forks
•	Analytics track provenance — every CI-* instance knows where it came from (floor, enemy type, source event)
