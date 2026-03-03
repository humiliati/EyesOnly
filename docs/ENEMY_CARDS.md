# ENEMY CARDS ROADMAP

Based on my deep dive into your codebase, here's a phased roadmap that builds on your existing systems — `enemy-hand-display.js`, `enemy-intent-system.js`, `card-system.js`, `cards.json`, the NCH/combat roadmap, and the BLVCK/joker emoji infrastructure.


---

## Cross-Roadmap Sprint Alignment

> This document is executed primarily during **Sprint 3 [ENI]** of the Cross-Roadmap Execution Order, with dependencies on Sprints 0–2 and downstream consumers in Sprints 4–6.

| Phase | Sprint | Depends On | Unlocks |
|---|---|---|---|
| Phase 0 (Enemy Card DB) | Sprint 3 — ENI Phase 1 | IPR Phase 1 (items.json registry), CHH Step 2 (`hydrateCard`) | Phase 1 hydration, all downstream EATK-* lookups |
| Phase 1 (Wire to Map) | Sprint 3 — ENI Phase 1 | Phase 0, `enemy-deck-hydrator.js` | Pre-combat steal, combat hand, capsule display |
| Phase 2 (Combat Hand) | Sprint 3 — ENI Phase 3 | CHH Step 2 (`hydrateCard` for EATK-* resolution) | Deck-aware enemy hand in STR combat |
| Phase 3 (Visuals) | Sprint 3 — ENI Phase 3 | Sprint 0 (NCH left column unblocked) | Interactable jokers, drag+drop testable |
| Phase 4 (Interactions) | Sprint 3 — ENI Phase 4–5 | Phase 3 visuals, CHH Step 3 (policy flags stub) | Steal/reveal/destroy/plant menus, BLVCK slot planting |
| Phase 5 (Info Duel) | ✅ Complete | Phase 4 interaction surface | Charges, mutation, momentum, escalation, overload |
| Phase 5.11 (Stress Test) | ✅ Complete | Phase 5 + all combos | Synergy ecosystem validation (77/0/40) |
| Phase 6 (Env Synergy) | Sprint 3 — ENI Phase 5 | Phase 0 enemy cards, EB Phase 2 (explosive card defs) | Environment synergy cards, new decks, new combos |

### CHH Integration Points (Card Hand Harmonization)

These items from CARD_HAND_HARMONIZATION_ROADMAP must be complete before the corresponding phase here can execute:

- **CHH Step 2** (`hydrateCard()` + CI-* instances) → Required by Phase 0.3 (registry must resolve EATK-* via same pipeline) and Phase 2 (combat hand hydration)
- **CHH Step 3** (policy flags stub: `stealable`, `plantable`, `destroyable`, `triggerable`) → Required by Phase 4 (interaction menu reads flags to determine available actions)
- **CHH Step 5** (GC enemy deck scan) → Required by Phase 4+ (planted CI-* cards in enemy decks must survive garbage collection)
- **SharedItemRenderer.resolve()** → Phase 3 renderers can use this for EATK-* card display if emoji/name fallback is needed

### EB Integration Points (Explosive Breakables)

- **EB Phase 2** (explosive card definitions in registry) → Required by Phase 6 (environment synergy cards reference explosive tags)
- **EB Phase 5** (explosive combat card effects) → Required by Phase 4.1 BLVCK plant menu (player must have plantable explosive cards)
- Explosive inventory percentages: Common 20% PIPE_BOMB, Uncommon 35% FRAG, Elite 15% C4

---

## Current State Summary

**What exists already:**

|System|Status|Key Files|
|---|---|---|
|Player card database|✅ `cards.json` with `ACT-*` IDs|`public/data/gone-rogue/cards.json`|
|Enemy definitions|✅ HP/attack/defense/sightRange/dropTable|`tutorial-floors.js`, `elite-enemies.js`|
|Enemy intent system|✅ Weapon intents, face expressions, combat events|`enemy-intent-system.js`|
|Enemy hand display (combat)|✅ Shows `cardCount` hidden 🃏 jokers, reveal/steal/destroy API|`enemy-hand-display.js`|
|BLVCK fallback card|✅ `ACT-000`, greyed joker in NCH capsule|`card-state-authority.js`, `non-combat-hud.js`|
|Card state authority|✅ Canonical reads/writes for player hand/backup|`card-state-authority.js`|
|NCH joker stack (capsule)|✅ Pancake-stacked 🃏 with `.nch-joker-greyed` for BLVCK|`non-combat-hud.js`, `non-combat-hud.css`|

**What's missing (your roadmap targets):**

1. No **enemy-specific card decks** in the database — enemies just have a numeric `cardCount`/`attackCount`
2. No **tags on enemies** that expose cards for pre-combat stealing
3. Enemy hand display reads a count but doesn't know **which actual cards** the enemy holds
4. No interactability logic on enemy joker emojis tied to **player equipped items**
5. No visual distinction between interactable (ordinary) and non-interactable (greyed) enemy jokers

---

## Designer Workflow (Enemy Catalog)

Enemy card/deck data now has a **designer-facing source of truth**:

- `public/data/gone-rogue/enemy-catalog.json` (edit this)
- `public/data/gone-rogue/enemy-catalog.schema.json` (schema for validation/tooling)

From the catalog we **generate** the runtime tables consumed by `GoneRogueDataRegistry`:

- `public/data/gone-rogue/enemy-cards.json`
- `public/data/gone-rogue/enemy-decks.json`

### Commands

```bash
# (One-time) Bootstrap the catalog from existing runtime files
npm run init:enemyCatalog

# Build runtime enemy-cards.json + enemy-decks.json from the catalog
npm run build:enemyCatalog
```

### Notes
- Treat `enemy-catalog.json` as the file designers edit.
- `enemy-cards.json` / `enemy-decks.json` are build outputs.
- The build script performs lightweight validation (missing cards, bad keys, etc.).

---

## Phase 0 — Enemy Attack Card Database

> **🗓 Sprint 3 [ENI Phase 1]** — Execute after CHH Steps 1–3 (Sprint 1) are complete. `hydrateCard()` and `getCard()`/`getEnemyCard()` must be operational.

> **Goal:** Define enemy attacks as cards in the same format as player cards, stored per-enemy-type.

### 0.1 — Create `enemy-cards.json`

A new data file alongside `cards.json` defining enemy-specific attack cards:

public/data/gone-rogue/enemy-cards.json

```
[
  {
    "id": "EATK-001",
    "name": "Pistol Shot",
    "emoji": "🔫",
    "targetType": "player",
```

### 0.2 — Create `enemy-decks.json`

Map each enemy type to its card loadout:

public/data/gone-rogue/enemy-decks.json

```
{
  "STANDARD_GUARD": {
    "cards": ["EATK-001", "EATK-002", "EATK-001"],
    "exposedTags": ["pickpocket", "disarm"]
  },
  "TRANSIT_ENFORCER": {
```

### 0.3 — Register in `GoneRogueDataRegistry`

Extend the existing data registry to load and serve enemy card definitions:

public/js/gone-rogue-data-registry.js

```
// New methods on GoneRogueDataRegistry:
// getEnemyCard(id)       → returns enemy card definition from enemy-cards.json
// getEnemyDeck(type)     → returns { cards: [...ids], exposedTags: [...] }
// getEnemyCardDef(id)    → alias for getEnemyCard

```

**Files touched:**

- New: `public/data/gone-rogue/enemy-cards.json`
- New: `public/data/gone-rogue/enemy-decks.json`
- Modified: `public/js/gone-rogue-data-registry.js` — load + cache the two new JSON files

---

## Phase 1 — Wire Enemy Cards to Enemies on the Map

> **🗓 Sprint 3 [ENI Phase 1–2]** — Enemy deck hydration uses the registry loaded in Phase 0. Pre-combat steal flows through `enemy-steal-system.js` and writes `CardRef` entries via the CHH pipeline (not legacy `addPrintedCards`). See THEFT_MECHANICS.md for updated steal acquisition path.

> **Goal:** Each spawned enemy carries an actual array of card IDs (its "deck"), and those cards are stealable outside of combat based on exposed tags.

### 1.1 — Attach Deck on Enemy Spawn

When enemies are spawned (in `tutorial-floors.js`, `elite-enemies.js`, `map-designer.js`), hydrate them with their deck:

enemy-spawn-hydration.js

```
// On enemy creation:
function hydrateEnemyDeck(enemy) {
  var deckDef = GoneRogueDataRegistry.getEnemyDeck(enemy.deckType || enemy.name);
  if (!deckDef) {
    // Fallback: generate generic deck from enemy.attack stat
    enemy.cardDeck = [{ id: 'EATK-001', stolen: false }];
```

Each enemy object now looks like:

Code

```
{
  x: 4, y: 8, emoji: '🐌', name: 'Sleepy Snail',
  hp: 2, maxHp: 2, attack: 1, defense: 0,
  // NEW:
  cardDeck: [
    { id: 'EATK-002', stolen: false }
  ],
  exposedTags: ['pickpocket', 'sleight']
}
```

**Files touched:**

- `public/js/tutorial-floors.js` — add `deckType` to enemy definitions
- `public/js/elite-enemies.js` — map `eliteType` → `deckType` in `createElite()`
- New utility: `public/js/enemy-deck-hydrator.js`

### 1.2 — Pre-Combat Card Stealing (Tag Matching)

When the player is adjacent to (but not in STR combat with) an enemy, items with matching `stealTags` can pull cards from the enemy's `cardDeck`:

pre-combat-steal-logic.js

```
function attemptSteal(player, enemy) {
  var equippedItem = GAMESTATE.getActiveItem();
  if (!equippedItem || !equippedItem.stealTags) return null;

  // Check if player item tags intersect enemy exposedTags
  var matchingTags = equippedItem.stealTags.filter(function(tag) {
```

**Files touched:**

- New: `public/js/enemy-steal-system.js`
- Modified: `public/js/gamestate.js` — wire steal action into player action menu
- Modified: item definitions — add `stealTags` array to relevant items (e.g., Magnifying Glass, Lockpick, etc.)

### 1.3 — Item Tag Schema for Stealing

Items in `GoneRogueDataRegistry` need a `stealTags` property:

item-steal-tags-example.json

```
{
  "id": "ITM-PICKPOCKET-GLOVES",
  "name": "Pickpocket Gloves",
  "emoji": "🧤",
  "stealTags": ["pickpocket", "sleight"],
  "description": "Steal cards from unaware enemies"
```

---

## Phase 2 — Enemy Deck Reflected in Combat Hand

> **🗓 Sprint 3 [ENI Phase 3]** — Requires Sprint 0 NCH left column fix so enemy hand is visible alongside action buttons. `hydrateCard()` from CHH Step 2 resolves EATK-* IDs into display data for the enemy hand renderer.

> **Goal:** When STR combat starts, the enemy's redacted hand shows the **remaining** (non-stolen) cards from `enemy.cardDeck`, not just a generic count.

### 2.1 — Feed Real Deck to `EnemyHandDisplay`

Currently `enemy-hand-display.js` reads a simple count:

humiliati / EyesOnly / public / js / enemy-hand-display.js

```
  function updateFromCombatState(combatState) {
    // ...
    var cardCount = combatState.enemy.cardCount || combatState.enemy.attackCount || 0;
    // Builds generic hidden cards
  }

```

**Change:** Replace the count-based approach with deck-aware construction:

enemy-hand-display-upgrade.js

```
function updateFromCombatState(combatState) {
  if (!combatState || !combatState.enemy) { /* ... */ return; }

  var deck = combatState.enemy.cardDeck || [];
  var remaining = deck.filter(function(slot) { return !slot.stolen; });

```

### 2.2 — Pass `cardDeck` Through Combat State

In `GoneRogue.enterStrCombat()` and `getStrCombatState()`, ensure the enemy's `cardDeck` array is included on `combatState.enemy`:

combat-state-deck-passthrough.js

```
// When STR combat starts:
_strCombatState.enemy.cardDeck = enemy.cardDeck;
_strCombatState.enemy.cardCount = enemy.cardDeck.filter(
  function(s) { return !s.stolen; }
).length;

```

**Files touched:**

- `public/js/enemy-hand-display.js` — deck-aware `updateFromCombatState`
- `public/js/str-combat-integration.js` — pass `cardDeck` into `_showCombatWindow`
- `public/js/gonerogue.js` (or wherever `enterStrCombat` lives) — include `cardDeck` in state

---

## Phase 3 — Joker Emoji Visuals + Interactability

> **🗓 Sprint 3 [ENI Phase 3]** — The BLVCK vs ordinary joker distinction becomes testable here because Sprint 0 unblocked the left column. `SharedItemRenderer.resolve()` (CHH Step 5) can be used for EATK-* → emoji/name fallback in the render pipeline.

> **Goal:** Enemy cards render as `blvck.joker.emoji` (NCH capsule style) by default, and become interactable (ordinary jokers) based on player's equipped items/played cards.

### 3.1 — Visual Asset Mapping

|State|Visual|CSS Class|Emoji|
|---|---|---|---|
|**Hidden + Non-interactable**|Greyed/dark joker (BLVCK style)|`.enemy-card-blvck`|🃏 with `.nch-joker-greyed` filter|
|**Hidden + Interactable**|Ordinary bright joker|`.enemy-card-interactable`|🃏 (full color, pulsing border)|
|**Revealed**|Card face with emoji + name|`.enemy-card-revealed`|Card's actual emoji|
|**Destroyed/Stolen**|Skull or empty|`.enemy-card-destroyed`|💀|

Reuse the existing greyed joker filter from `non-combat-hud.css`:

public/css/enemy-hand-display.css

```
/* BLVCK joker — non-interactable enemy card */
.enemy-card-blvck .enemy-card-glyph {
  filter: grayscale(1) brightness(0.5) drop-shadow(1px 1px 2px rgba(0,0,0,0.7));
  opacity: 0.55;
  pointer-events: none;
  cursor: not-allowed;
```

### 3.2 — Interactability Engine

Each enemy card slot checks whether the player has the means to interact with it:

interactability-check.js

```
function computeInteractability(enemyCard, playerState) {
  if (enemyCard.destroyed) return false;
  
  var cardDef = GoneRogueDataRegistry.getEnemyCard(enemyCard.cardId);
  if (!cardDef) return false;

```

### 3.3 — Updated Render Pipeline

Modify `_render()` in `enemy-hand-display.js`:

enemy-hand-display-render-upgrade.js

```
function _render() {
  // ...existing setup...

  for (var i = 0; i < _enemyCards.length; i++) {
    var card = _enemyCards[i];
    var el = document.createElement('div');
```

**Files touched:**

- `public/js/enemy-hand-display.js` — interactability flag + render branching
- `public/css/enemy-hand-display.css` (or inline in existing CSS) — blvck vs interactable styles
- `public/js/str-combat-integration.js` — recalculate interactability each round
- New: `public/js/enemy-card-interactability.js` — interactability computation module

---

## Phase 4 — In-Combat Interactions on Joker Cards

> **🗓 Sprint 3 [ENI Phase 4–5]** — The interaction menu reads **policy flags** (`stealable`, `plantable`, `destroyable`, `triggerable`) from card definitions (CHH Step 3). BLVCK plant menu requires EB Phase 5 explosive combat cards to be available in the player's hand. Steal acquisition must use `CardRef` pipeline, not legacy `GAMESTATE.addPrintedCards`.

> **Goal:** Clicking an interactable enemy joker triggers reveal/steal/destroy based on context.

### 4.1 — Interaction Menu

When player clicks an interactable enemy joker during STR combat:

Code

```
┌──────────────────────────┐
│  🃏 ENEMY CARD #2         │
│  ─────────────────────── │
│  👁️  REVEAL  (Scout)      │
│  🤏  STEAL   (Gloves)     │
│  💥  DESTROY (EMP)        │
└──────────────────────────┘
```

When player clicks an enemy BLVCK card (plantable slot) during STR combat (nothing happens if player doesn't have plantable explosives or poisons):

Code

```
┌──────────────────────────┐
│  BLVCK.🃏 ENEMY CARD #1   │
│  ─────────────────────── │
│  💣 PLANT PIPEBOMB (if in hand)
│  💣 PLANT C4 (if in hand) |
└──────────────────────────┘
```


Available actions depend on which items/cards the player has:

|Action|Requires|Effect|
|---|---|---|
|**Reveal**|Magnifying Glass equipped OR Scout card played|Flips card face-up; player sees what enemy will attack with|
|**Steal**|Pickpocket Gloves equipped OR Sleight card played|Removes card from enemy; adds to player hand via `acquireNewCardDuringCombat()`|
|**Destroy**|EMP Disruptor equipped OR Sabotage card played|Removes card from enemy; triggers `card_killed` combat event (enemy goes Enraged `>:(`)|


### 4.1.1 — Edge Case: BLVCK as Universal Empty Slot Node

> **Policy flags:** `stealable: false, plantable: true, destroyable: false, triggerable: false`

When a player steals **all** real attack cards from an enemy's hand, the enemy hydrates a BLVCK card (`ACT-000`) into the now-empty slot. This card:

- **Cannot be stolen** (`stealable: false`) — prevents infinite steal loops
- **Acts as a plantable slot** (`plantable: true`) — the player can plant explosives or poisons into it
- **Cannot be destroyed** (`destroyable: false`) — always occupies at least one slot
- **Cannot be synergy-triggered** (`triggerable: false`) — no combo potential

**Desperation action:** If the enemy has all real cards stolen AND nothing planted in BLVCK slots, the enemy must play BLVCK as a desperation action:
- Damage: 0–2 (random)
- Tags: none
- Face expression: `(ಥ_ಥ)` (despair)
- No combo potential, no synergy chains

**Spawn rule:** Every enemy spawns with at least one BLVCK slot (`isBlvckSlot: true` on the first `cardDeck` entry). This ensures planting is always available even before any cards are stolen.

**Data shape:**
```
enemy.cardDeck[0] = {
  id: 'ACT-000',
  stolen: false,
  isBlvckSlot: true,
  planted: null  // becomes { cardId: 'ACT-###', plantedBy: 'player', turn: N }
}
```

### 4.2 — Wire to Existing APIs

The `EnemyHandDisplay` already exposes `revealCard()`, `stealCard()`, and `destroyCard()`. Phase 4 wires the interaction menu to these APIs and adds downstream effects:

- **Steal** → `stealCard(index)` → `GAMESTATE.acquireNewCardDuringCombat(cardId, 1)` → enemy `cardCount` decrements
- **Destroy** → `destroyCard(index)` → `EnemyIntentSystem.onCombatEvent(enemy, 'card_killed')` → enemy face goes `>:(`
- **Reveal** → `revealCard(index, cardDef)` → enemy card flips to actual emoji

---


### 4.2.1 — Edge Case: Synergy-Triggered Planted Explosive Detonation

When an enemy plays a card whose tags form a valid combo with a planted explosive's tags, the explosive **auto-fires at full damage** (no 60% reduction — the enemy triggered it themselves).

**Resolution flow:**
1. Enemy selects card to play from their hand
2. Combat resolver evaluates tag combos across ALL cards in play (including planted cards in enemy slots)
3. If `planted.cardId` resolves to a card with `triggerable: true` AND the played card's tags form a combo with the planted card's tags → **auto-detonate**
4. Detonation deals full card damage to the enemy (self-inflicted)
5. Planted card is consumed (removed from slot, CI-* instance garbage-collected)

**C4 exception:** C4_CHARGE has a 1-turn armed delay. If planted this turn, it cannot be synergy-triggered until the next turn. The `planted.turn` field is checked: `currentTurn - planted.turn >= 1`.

**Interaction charge bypass:** Synergy-triggered detonation does NOT consume an interaction charge. It fires during combo resolution, not as a player action. The `triggerable: true` flag is checked during combo resolution phase, not during the manual click phase.

**Combo examples:**
- Enemy plays EATK-001 (Pistol Shot, tags: `ranged, ballistic`) while player planted FRAG_GRENADE (tags: `explosive, ballistic, aoe`) → `ballistic` tag match → auto-detonate FRAG for 12 AoE damage
- Enemy plays EATK-022 (Broken Lever, tags: `melee, improvised, black_market`) while player planted PIPE_BOMB (tags: `explosive, improvised, stun`) → `improvised` tag match → auto-detonate PIPE_BOMB for 8 damage + stun

---

## Dependency Graph

Code

```
Phase 0 (Data)                    Phase 1 (Map)                   Phase 2 (Combat)           Phase 3 (Visuals)        Phase 4 (Interactions)

0.1 enemy-cards.json ──────┐
                           │
0.2 enemy-decks.json ──────┼──→ 1.1 Hydrate enemy deck ──────→ 2.1 Deck-aware hand ──────→ 3.1 BLVCK vs ordinary ──→ 4.1 Interaction menu
                           │         on spawn                      display                      joker rendering
0.3 Registry loading ──────┘                                                                                          4.2 Wire to existing
                                1.2 Pre-combat steal ─────────→ 2.2 cardDeck in            3.2 Interactability           reveal/steal/destroy
                                     system                         combatState                  engine
                                1.3 Item stealTags ────────────────────────────────────────→ 3.3 Updated render
```

---

## New Files Summary

|File|Phase|Purpose|
|---|---|---|
|`public/data/gone-rogue/enemy-cards.json`|0.1|Enemy attack card definitions|
|`public/data/gone-rogue/enemy-decks.json`|0.2|Enemy type → card loadout mapping|
|`public/js/enemy-deck-hydrator.js`|1.1|Attaches card decks to spawned enemies|
|`public/js/enemy-steal-system.js`|1.2|Pre-combat card stealing via item tags|
|`public/js/enemy-card-interactability.js`|3.2|Computes which enemy cards are interactable|
|`public/js/enemy-card-interaction-handler.js`|4.1, 4.2|Context menu, action dispatch, interactability compute loop|

## Modified Files Summary

|File|Phase(s)|Changes|
|---|---|---|
|`gone-rogue-data-registry.js`|0.3|Load enemy-cards.json + enemy-decks.json|
|`tutorial-floors.js`|1.1|Add `deckType` to enemy definitions|
|`elite-enemies.js`|1.1|Map eliteType → deckType|
|`gamestate.js`|1.2, 4.2|Wire steal action, acquireNewCardDuringCombat|
|`enemy-hand-display.js`|2.1, 3.3, 4.1|Deck-aware update, BLVCK/interactable render, click handler|
|`str-combat-integration.js`|2.2, 3.2|Pass cardDeck through, recalculate interactability per round|
|`non-combat-hud.css` / `enemy-hand-display.css`|3.1|BLVCK greyed joker + interactable joker styles|
|`enemy-intent-system.js`|4.2|`card_killed` event already handled ✅|

---

## Testing Checkpoints

### After Phase 0:

- [ ]  `GoneRogueDataRegistry.getEnemyCard('EATK-001')` returns a valid definition
- [ ]  `GoneRogueDataRegistry.getEnemyDeck('STANDARD_GUARD')` returns cards + exposedTags

### After Phase 1:

- [ ]  Spawned enemies have `cardDeck` array with correct card IDs
- [ ]  Player with Pickpocket Gloves can steal a card from adjacent unaware enemy
- [ ]  Stolen card appears in player inventory; enemy's `cardDeck` marks slot as `stolen: true`
- [ ]  Enemy without matching exposedTags cannot be stolen from

### After Phase 2:

- [ ]  Entering STR combat → enemy hand shows N jokers where N = remaining (non-stolen) cards
- [ ]  If 2 of 4 cards were stolen pre-combat, enemy hand shows 2 jokers (not 4)
- [ ]  Existing reveal/steal/destroy APIs still work

### After Phase 3:

- [ ]  Enemy jokers default to BLVCK style (greyed, `filter: grayscale(1) brightness(0.5)`)
- [ ]  Equipping Pickpocket Gloves turns matching enemy jokers to ordinary (full color, pulsing)
- [ ]  Playing a Scan card turns all enemy jokers interactable for that round
- [ ]  Non-interactable jokers have `pointer-events: none`

### After Phase 4:

- [ ]  Clicking interactable joker opens context menu (Reveal/Steal/Destroy)
- [ ]  Steal removes joker, adds card to player hand, decrements enemy hand count label
- [ ]  Destroy removes joker, triggers `card_killed` → enemy face goes `>:(`
- [ ]  Reveal flips joker to show actual card emoji + name
---

## Phase 5 — Information Duel System

> **✅ Complete** — All sub-phases (5.1–5.11) implemented and tested. The Information Duel system was built before the cross-roadmap execution order was established. No sprint dependencies remain.

> **Goal:** Transform enemy card interactions from an "Interrupt Engine" into a psychological "Information Duel" with multi-turn memory, escalation pressure, adaptive AI, and constrained interaction economy.

### 5.1 — Interaction Charges (GAP 3)

One interaction charge per turn (reveal OR steal OR destroy). Items can add bonus charges.

- [x] `InformationDuelEngine.canInteract()` / `spendCharge()` — charge gate before any action
- [x] `_computeMaxCharges()` — reads `interaction_charge_bonus` effects from items
- [x] Charges refill on `advanceTurn()` (resolving to selecting edge)
- [x] Toast "No interaction charges remaining" when blocked
- [x] New item: ITM-090 Scrambler Chip (epic) — +1 charge/turn

### 5.2 — Intent Mutation System (GAP 1)

Enemy mechanical states triggered by player interactions:

| Action | Mutation | Effect |
|---|---|---|
| Destroy | RAGE | +10% damage per stack (caps at 3 = +30%) |
| Steal | PARANOIA | Hides extra card(s) per stack |
| Reveal | ADAPTATION | At 2+ stacks, swaps combo ordering |

- [x] `applyMutation(actionType)` — stacking same type, switching on different
- [x] `getMutationDisplay()` — emoji + label + stack count for HUD
- [x] Face expression override via `_applyMutationFace()` — Enraged / Alert / Determined
- [x] New item: ITM-089 Precision Tools — destroy reduces Rage spike by 1

### 5.3 — Intent Momentum (Multi-Turn Tag Tracking)

Per-slot tag momentum: each turn a tag survives in a slot, it gains +1 Momentum.

- [x] `updateMomentum(enemyCards)` — called on turn advance
- [x] `getSlotMomentum(index)` / `getAllMomentum()` — read momentum state
- [x] `getDestroyDisruptionBonus(index)` — high-momentum slots give disruption bonus
- [x] `clearSlotMomentum(index)` — reset on destroy/steal
- [x] Momentum dots rendered per-slot (color-coded by dominant tag)
- [x] New item: ITM-087 Pattern Lens — see momentum + auto-reveal at Momentum 3+

### 5.4 — Hidden Escalation Clock

Prevents defensive stall meta. +1 per turn without a destroy.

- [x] `advanceEscalation(destroyedThisTurn)` — tracks turns since destroy
- [x] At Escalation 3+: all Payoff tags gain +1 damage per point above threshold
- [x] HUD bar with urgent-red pulse near threshold
- [x] New item: ITM-088 Dampener Coil — 15% Overload reduction + 1 grace turn

### 5.5 — Overload Meter

Global tension gauge fed by momentum reaching 2, combo resolves, and instability triggers.

- [x] `feedOverload(source, amount)` — increment meter
- [x] At 5: Overload Eligible (next combo turn)
- [x] At 7: Overload Active (all combo effects +1, instability checks doubled)
- [x] `resolveOverload()` — resets meter, decays all momentum by 1
- [x] No back-to-back Overload (reset to 0 after trigger)
- [x] HUD bar with yellow-pulse animation at active state

### 5.6 — Two-Stage Interaction Pipeline (GAP 2)

Revealed cards become stealable on subsequent turns.

- [x] `markRevealed(slotIndex)` — records turn of reveal
- [x] `isRevealedStealable(slotIndex)` — true if revealed on a previous turn
- [x] `enemy-card-interactability.js` updated: revealed + stealable check
- [x] Existing CSS `.enemy-card-revealed.enemy-card-interactable[data-action="steal"]` already supports visual

### 5.7 — Adaptive Pattern AI

Enemy adjusts behavior every 3 turns based on player interaction patterns.

- [x] `trackPlayerAction(actionType)` — accumulates destroy/steal/reveal counts
- [x] `checkAIAdaptation()` — triggers at interval, applies adaptations
- [x] `getAIAdaptations()` — active adaptations for combat behavior
- [x] Emits `ai:adapted` event for UI feedback

### 5.8 — Information Duel HUD

Visual layer rendering duel state into combat UI.

- [x] Charge pips (active / grey spent)
- [x] Mutation badge (emoji + label + stacks, color-coded)
- [x] Escalation bar (amber to red near threshold)
- [x] Overload meter (blue to yellow to pulsing at active)
- [x] Momentum dots per card slot (color-coded by dominant tag)
- [x] Power fantasy flash: "INTENT DENIED" (destroy), "CARD SEIZED" (steal), "OVERLOAD"

### 5.9 — Phase 5 Items

| Item | Rarity | Effect |
|---|---|---|
| ITM-087 Pattern Lens | Uncommon | See momentum counters; auto-reveal at Momentum 3+ |
| ITM-088 Dampener Coil | Rare | -15% Overload damage; escalation +1 grace turn |
| ITM-089 Precision Tools | Rare | Destroy Payoff reduces Rage by 1; +1 momentum disruption |
| ITM-090 Scrambler Chip | Epic | +1 interaction charge per turn |

### New Files (Phase 5)

| File | Sub-phase | Purpose |
|---|---|---|
| `public/js/information-duel-engine.js` | 5.1-5.7 | Core engine: charges, mutation, momentum, escalation, overload, AI |
| `public/js/information-duel-hud.js` | 5.8 | Visual HUD rendering for duel state |

### Modified Files (Phase 5)

| File | Changes |
|---|---|
| `enemy-card-interactability.js` | Two-stage pipeline: revealed cards now stealable/destroyable |
| `enemy-card-interaction-handler.js` | Charge gate, mutation triggers, momentum disruption, overload feed |
| `str-combat-integration.js` | Duel engine lifecycle (start/advance/end), HUD rendering |
| `enemy-hand-display.css` | Phase 5 HUD styles, momentum dots, power flash animation |
| `items.json` | 4 new items (ITM-087 through ITM-090) |
| `index.html` | Script tags for information-duel-engine.js + information-duel-hud.js |

### 5.10 — Canon-Compliance Refactor (HUD Gutting)

> **Goal:** All Information Duel visual state routed through existing canon surfaces per UI-CANON.md. No standalone bars, badges, or new HUD containers.

| Duel State | Canon Surface | Method |
|---|---|---|
| **Charges** | Debrief Feed resource row | Same `█░` block format as HP/Ammo/Energy |
| **Escalation** | STR combat window frame border | `str-frame-escalation` — border shifts gold→red |
| **Overload rising** | STR combat window frame border | `str-frame-overload-rising` — border shifts gold→bright yellow |
| **Overload active** | STR combat window frame border | `str-frame-overload` — pulsing white-yellow animation |
| **Mutation** | Enemy kaomoji face expression | `EnemyIntentSystem.FACE_EXPRESSIONS` (ENRAGED/ALERT/DETERMINED) |
| **Momentum** | Dots on enemy card slots | `.idh-momentum-dot` color-coded by dominant tag |
| **Details** | Tooltip on enemy card hover | `TooltipSystem.showPersistent()` shows momentum/mutation/escalation |
| **Power flash** | Temporary overlay (1.2s) | "INTENT DENIED", "CARD SEIZED", "OVERLOAD" |

**Gutted CSS (~170 lines removed):**
- `.info-duel-hud`, `.idh-top-row`, `.idh-charge-pips`, `.idh-charge-pip`
- `.idh-mutation-badge` and all children
- `.idh-bottom-row`, `.idh-escalation`, `.idh-overload` and all children
- All associated `@keyframes` (idh-mutation-pulse, idh-esc-urgent, idh-ovl-active)

**Kept:**
- `.idh-momentum-indicator`, `.idh-momentum-dot` (on existing enemy card slots)
- `.idh-power-flash` (temporary, no persistent clutter)

**Added to `str-combat-window.css`:**
- `.str-frame-escalation` — red border tint + glow
- `.str-frame-overload-rising` — bright yellow border tint
- `.str-frame-overload` + `@keyframes str-frame-overload-pulse` — pulsing white-yellow
- `prefers-reduced-motion` coverage for overload pulse


---

## Phase 5.11 — Synergy Ecosystem Stress Test & Remediation

### Stress Test System
New headless synergy stress-test engine (`public/tests/test-synergy-stress.js`) with 11 test suites:
1. **Dead-End Tags** — tags appearing on cards but not in any combo or risk
2. **Orphan Cards** — cards whose tags never fire a combo
3. **Supply/Demand Gap** — combos that can't be built from available cards
4. **Enemy Deck Combo Coverage** — internal combo potential per deck
5. **Information Duel Interaction Budget** — charges vs high-value targets
6. **Tag Risk Threshold Reachability** — can each risk actually fire?
7. **Self-Combo Cards** — dual-tag cards that trigger their own combo
8. **Resource Loop Sustainability** — disposable combos self-fund?
9. **Steal Priority Matrix** — ranked steal targets per complex deck
10. **Duel Edge Cases** — small decks, momentum, escalation pressure
11. **Cross-Ecosystem Combo Chains** — status produce/consume chains

Runners: `test-synergy-stress.html` (browser), `run-synergy-stress.js` (Node.js CLI).

### Initial Run Results (Pre-Fix)
- **69 passed, 0 failed, 42 warnings** across 111 tests
- 32 dead-end synergy tags (mostly functional role tags)
- 11 orphan player cards, 5 orphan enemy cards
- Burn Notice (COMBO-026) lacked resource feedback
- 0 energy/focus combo generators
- `fire` tag had no direct combo path (condition-only via Poison Ignition)

### Fixes Applied (v5.0)

#### COMBO-026 Burn Notice — Focus Refund Added
Disposable+Covert now refunds 1 Focus. Design: "composure from clean tradecraft." All 5 disposable combos now have resource feedback:
- ballistic → ammo refund (Expendable Ordnance)
- electrical → battery refund (Overclocked Gadget)
- black_market → currency bonus (Dead Drop)
- improvised → card generation (Field Salvage)
- covert → **focus refund** (Burn Notice) ← NEW

#### COMBO-030 Evidence Wash (NEW)
`disposable + wet` — Remove marked/tracked/exposed statuses + stealth bonus + focus refund. Completes the disposable matrix: every core tag now has a disposable partner combo.

#### COMBO-031 Controlled Burn (NEW)
`fire + improvised` — Creates fire ground + DoT area + cost reduction for next improvised card. Molotov (both tags) self-combos. Gives `fire` tag a direct combo path (was previously condition-only via Poison Ignition).

#### COMBO-032 Silent Surge (NEW)
`electrical + covert` (requires stealth) — Guaranteed stun + disable + noise reduction. Fills the electrical+covert gap. Advanced tier because it requires stealth setup.

### Post-Fix Results
- **77 passed, 0 failed, 40 warnings** across 117 tests
- Dead-end tags: 32 → 1 (only `burst` on 1 card)
- Burn Notice resource gap: FIXED
- Fire tag dead-end: FIXED
- Combo count: 29 → 32
- Focus now has 2 combo generators (Burn Notice + Evidence Wash) + 1 risk drain

### Remaining Warnings (By Design)

| Category | Count | Status |
|----------|-------|--------|
| Orphan player cards (starter/tutorial) | 5 | Intentional — BLVCK, Field Dressing, Basic Shot, Cardboard Box, Cyanide Capsule are role cards |
| Orphan player cards (Ultrasonic chain) | 6 | Intentional — sonic/light cards are their own subsystem |
| Orphan enemy cards | 4 | Intentional — Axe Swing, Shield Wall, Nibble, Ram Charge are melee role cards |
| Small decks (≤2 cards) | 13 | Intentional — civilians/critters don't need duel depth |
| Elite decks exceeding interaction budget | 5 | Intentional — Scrambler Chip (+1 charge/turn) is the answer |
| Status prerequisites from card effects | 4 | By design — stealth, poison, marked, burn come from cards not combos |
| Decks with no exposed tags | 2 | Design debt — GENERIC_FLOOR_30 and HEAVY_DRIFTER need exposedTags |

### Resource Loop Coverage (Post-Fix)

| Resource | Combo Generators | Risk Drains | Net |
|----------|-----------------|-------------|-----|
| Ammo | 1 (Expendable Ordnance) | 0 | +1 |
| Battery | 1 (Overclocked Gadget) | 1 (Feedback Burn) | 0 |
| Focus | 2 (Burn Notice, Evidence Wash) | 1 (Heat Score) | +1 |
| Energy | 0 | 0 | 0 |

Energy has no combo loop — it's managed by card costs and turn economy, not the synergy system.

---

## Phase 6 — Environment Synergy Cards (Basic Attack Type)

> **🗓 Sprint 3 [ENI Phase 5]** — Environment synergy cards (EATK-021/022/023) depend on EB Phase 2 explosive card definitions being in the registry. New tag synergy combos (Bind & Blast, Salvage Rights, Ghost Passage) must be added to `tag-synergy-data.json` before the stress test rerun.

> **Goal:** Add basic attack-type enemy cards with long but simple synergy chains that involve status modifiers or one-time-use attacks, contextually relevant to the environment. Focus on Environment Synergy and ENEMY_AI via BIOME_SYSTEMS.

### New Enemy Cards

| ID | Name | Emoji | Intent Type | Tags | Synergy Tags | Rarity | Steal Value |
|---|---|---|---|---|---|---|---|
| EATK-021 | Rope | 🪢 | GRAPPLE | melee, control, setup, bind | control, improvised, bind, ranged_chain | common | 2 |
| EATK-022 | Broken Lever | 🔧 | GRAPPLE | melee, improvised, black_market | melee, improvised, black_market, chain, structural | common | 3 |
| EATK-023 | Secret Button | 🗿 | ENVIRONMENTAL_TRIGGER | utility, covert, black_market, environmental | black_market, covert, environmental_trigger, structural | rare | 4 |

#### EATK-021 — Rope (Bind)

- **Effect chain**: `bound` status (2 turns) + self `setup_ranged` buff (+20 accuracy, 1 turn)
- **Synergy**: Naturally chains with Basic Shot / Pistol Shot (EATK-001) in the next action — the bind holds the player still while the accuracy window is open. Fires the **Bind & Blast** tag combo (`bind` + `ranged_chain`, requires `bound` status on target).
- **Environment synergy**: BIND_TERRAIN biome variant extends bound duration by +1 and amplifies the accuracy window.
- **Design note**: Teaches setup → payoff sequencing. Long synergy chain but each link is obvious: bind first, then shoot.

#### EATK-022 — Broken Lever

- **Effect chain**: `damage` (2) + `stagger` (1 turn) + `environment_interact` (jams nearest door/gate for 1 round, value=1)
- **Synergy**: `melee` + `black_market` tags fire existing **Combo Strike** and **Contraband Hack** combos. `improvised` + `black_market` fires **Contraband Hack** (Salvage Rights follow-up). Stealing it removes an enemy's black-market chain anchor.
- **Environment synergy**: INDUSTRIAL_DEBRIS biome variant grants +1 damage on debris tiles and raises lever-jam probability to 50%.
- **Design note**: Improvised weapon that doubles as an environmental interaction. Junkyard, construction, and warehouse biomes.

#### EATK-023 — Secret Button (Statue Bust)

- **Effect chain**: `cover_disrupted` (2 turns on area) + `environment_trigger` (secret passage, 1-tile radius) + `repositioned` (self, 1 turn)
- **Synergy**: `black_market` + `covert` tags fire existing **Silent Recovery** combo. `environmental_trigger` + `covert` fires the new **Ghost Passage** combo (stealth preserved + silent reposition + noise −5). Zero alert generated — purely covert.
- **Environment synergy**: HIDDEN_CHAMBER biome variant makes Secret Button available only on `carved_walls`/`statue_tiles` ground, and sets `alertGenerationMultiplier: 0` for all enemy actions while in the chamber.
- **Design note**: Stealing Secret Button gives the player access to the same passage network — powerful mid-combat reposition. Only available in catacombs, manor, or black-market biomes.

### New Enemy Decks

| Deck Key | Cards | Hand Size | Exposed Tags | Chain Design |
|---|---|---|---|---|
| WAREHOUSE_ENFORCER | EATK-021 (guaranteed) × 1, EATK-001 × 2 | 3 | disarm, improvised | Rope bind opener → double Pistol Shot with +20 accuracy. Pure bind→blast chain. |
| BLACK_MARKET_FENCE | EATK-022, EATK-019, EATK-020 | 3 | bribe, pickpocket, sleight | Broken Lever stagger + Coin Toss distraction + Flee escape. `black_market + improvised` fires Contraband Hack. |
| CATACOMB_SENTINEL | EATK-023 (guaranteed) × 1, EATK-010, EATK-013, EATK-009 | 4 | hack, bribe | Secret Button guaranteed opener (silent cover disruption + reposition) + Spotlight detection + Shield Wall + Grapple flanking. Near-statue biomes only. |

**Updated deck:** JUNKYARD_SCAVENGER now includes EATK-022 (Broken Lever) as the fourth card in its fixed 4-card hand, adding `black_market + improvised` synergy chain capability.

### New Tag Synergy Combos

Three new combos added to `public/data/gone-rogue/tag-synergy-data.json`:

| Combo | Tags | Condition | Effect |
|---|---|---|---|
| **Bind & Blast** | `bind` + `ranged_chain` | `requireTargetStatus: bound` | +20 accuracy for next ranged attack; target gains `exposed` (1 turn) |
| **Salvage Rights** | `structural` + `black_market` | `requirePreviousTag: melee` | Drops 2 scrap resource; staggers enemy (1 turn) |
| **Ghost Passage** | `environmental_trigger` + `covert` | `requireStatus: undetected OR requireGroundEffect: statue_tiles` | Stealth preserved (1 turn); silent reposition; noise −5 |

### Updated Stress Test Counts (Post Phase 6)

- Enemy cards: **20 → 23** (EATK-021, EATK-022, EATK-023 added)
- Enemy decks: **37 → 41** (WAREHOUSE_ENFORCER, BLACK_MARKET_FENCE, CATACOMB_SENTINEL added; JUNKYARD_SCAVENGER updated)
- Tag synergy combos: **35 → 38** (Bind & Blast, Salvage Rights, Ghost Passage added)
- New tags introduced: `bind`, `ranged_chain`, `structural`, `environmental_trigger`

---

## Sprint Playtest Gates (from Cross-Roadmap Execution Order)

### After Sprint 3 (this document's primary sprint)

The following must all pass before advancing to Sprint 4:

- [ ] `GoneRogueDataRegistry.getEnemyCard('EATK-001')` returns valid definition
- [ ] `GoneRogueDataRegistry.getEnemyDeck('STANDARD_GUARD')` returns cards + exposedTags
- [ ] Spawned enemies have `cardDeck` array with at least one BLVCK slot (`isBlvckSlot: true`)
- [ ] Player with Pickpocket Gloves can steal via tag match → card acquired through `CardRef` pipeline (not `addPrintedCards`)
- [ ] Stolen card renders correctly in player hand via `hydrateCard()` (EATK-* resolved from registry)
- [ ] Enemy hand in STR combat shows N jokers where N = remaining non-stolen cards
- [ ] BLVCK jokers render as greyed; interactable jokers pulse when player has matching tools
- [ ] Clicking interactable joker → context menu shows available actions based on policy flags
- [ ] BLVCK slot shows PLANT menu when player holds plantable explosive cards
- [ ] Planting explosive into BLVCK slot → `planted: { cardId, plantedBy, turn }` written to cardDeck entry
- [ ] Enemy plays card that tag-matches planted explosive → synergy-triggered detonation at full damage
- [ ] C4 planted this turn does NOT auto-fire (armed delay check on `planted.turn`)
- [ ] Enemy with all cards stolen plays BLVCK as desperation action (0–2 dmg, (ಥ_ಥ) face)
- [ ] Information Duel HUD still functional (charges, mutation, momentum, escalation, overload)
- [ ] Environment synergy cards (EATK-021/022/023) appear in correct biome enemy decks
- [ ] Stress test rerun: ≥77 passed, 0 failed (new combos may shift warning count)

### Cross-Sprint Dependencies to Verify

- [ ] CHH Step 2 `hydrateCard()` resolves EATK-* IDs → confirms Sprint 1 foundation
- [ ] CHH Step 5 GC scan includes enemy decks → planted CI-* cards not garbage-collected
- [ ] EB Phase 5 explosive cards available in player hand → plantable into BLVCK slots
- [ ] Sprint 0 NCH left column visible → enemy hand + action buttons both accessible

