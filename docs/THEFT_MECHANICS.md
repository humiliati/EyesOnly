# THEFT_MECHANICS.md

This document describes the theft system as it exists today and the intended evolution.

## Goals
- Make theft a **core stealth loop**: you bring tools, choose targets, and get paid.
- Make stolen rewards feel **precious** (synergy-active, economy-relevant, and legible).
- Avoid dead actions: even a failed/invalid steal should produce feedback and (optionally) a small consolation.

---

## Vocabulary

### Enemy deck exposure
- Each enemy deck type defines `exposedTags` (see `public/data/gone-rogue/enemy-decks.json`).
- Tags are a shared dictionary: `pickpocket`, `disarm`, `sleight`, `hack`, `intimidate`, `bribe`.

### Player theft tools
- A theft tool is an item with `stealTags` (e.g. `ITM-PICKPOCKET-GLOVES`).
- The player must equip the tool into the active slot.

---

## Pre-combat theft (realtime / exploration)

### Command
- `STEAL` (alias: `PICKPOCKET`)

### Requirements
- Not in STR combat.
- Player is **adjacent** (Manhattan distance 1) to an enemy.
- Player has an equipped item with `stealTags`.

### Resolution
- If `stealTags ∩ enemy.exposedTags` is non-empty, the steal is **valid**.
- If the enemy has a hydrated `enemy.cardDeck`, the system will:
  - choose an available (non-stolen) enemy card, preferring higher `stealValue`
  - mark the slot as `{ stolen: true }`
  - award the player that **specific** card ID (typically `EATK-###`)
- If the enemy deck is missing/unhydrated/empty, award a generic success card (`ACT-021`).

### Failure / invalid steal
- If tags do not match, award a generic consolation disposable (`ACT-020`) and show feedback.

### Permanence
- The awarded card is inserted via the normal CH/NCH pipeline (`GAMESTATE.addPrintedCards`).
- This means the steal is **permanent for the run** (it becomes part of your deck flow).

---

## Post-combat theft (STR combat / victory)

### Intended
After combat, we want a second theft surface that rewards stealth builds:
- If you entered combat with advantage (ambush) or maintained low alert, allow a "loot a card" action.
- Prefer awarding from the enemy's remaining (non-stolen) `cardDeck`.

### Status
Not fully implemented yet.

Planned behaviors:
- Victory screen shows `stolenCards` and optionally a "SALVAGE" / "STRIP" button.
- Salvage selects 1 card from the enemy deck (weighted by `stealValue`) and grants it.

---

## Data references
- Enemy cards: `public/data/gone-rogue/enemy-cards.json`
- Enemy decks: `public/data/gone-rogue/enemy-decks.json`
- Catalog source of truth: `public/data/gone-rogue/enemy-catalog.json`

## Code references
- Pre-combat attempt: `public/js/enemy-steal-system.js`
- Enemy deck hydration: `public/js/enemy-deck-hydrator.js`
- Command routing: `public/js/gone-rogue.js`
- Card lookup: `public/js/gone-rogue-data-registry.js` (supports EATK-### as player cards)
