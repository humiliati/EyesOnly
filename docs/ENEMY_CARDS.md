# 

Based on my deep dive into your codebase, here's a phased roadmap that builds on your existing systems — `enemy-hand-display.js`, `enemy-intent-system.js`, `card-system.js`, `cards.json`, the NCH/combat roadmap, and the BLVCK/joker emoji infrastructure.

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

Available actions depend on which items/cards the player has:

|Action|Requires|Effect|
|---|---|---|
|**Reveal**|Magnifying Glass equipped OR Scout card played|Flips card face-up; player sees what enemy will attack with|
|**Steal**|Pickpocket Gloves equipped OR Sleight card played|Removes card from enemy; adds to player hand via `acquireNewCardDuringCombat()`|
|**Destroy**|EMP Disruptor equipped OR Sabotage card played|Removes card from enemy; triggers `card_killed` combat event (enemy goes Enraged `>:(`)|

### 4.2 — Wire to Existing APIs

The `EnemyHandDisplay` already exposes `revealCard()`, `stealCard()`, and `destroyCard()`. Phase 4 wires the interaction menu to these APIs and adds downstream effects:

- **Steal** → `stealCard(index)` → `GAMESTATE.acquireNewCardDuringCombat(cardId, 1)` → enemy `cardCount` decrements
- **Destroy** → `destroyCard(index)` → `EnemyIntentSystem.onCombatEvent(enemy, 'card_killed')` → enemy face goes `>:(`
- **Reveal** → `revealCard(index, cardDef)` → enemy card flips to actual emoji

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