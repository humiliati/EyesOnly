# THEFT_MECHANICS.md

This document describes the theft system as it exists today, the plant mechanic (inverse of theft), the interchange UI evolution, and sprint timing for when each feature becomes available.

---

## Cross-Roadmap Sprint Alignment

> Theft touches multiple sprints. Pre-combat steal exists today but must migrate to the CardRef pipeline. The interchange UI replaces instant steal resolution. The plant mechanic is the inverse of steal and depends on explosive breakable systems.

| Feature | Sprint | Roadmap Source | Status |
|---|---|---|---|
| Pre-combat steal (STEAL command, tag matching) | Existing | ENEMY_CARDS Phase 1.2 | ✅ Functional, needs pipeline migration |
| CardRef-based steal acquisition | Sprint 1 [CHH] | CHH Step 2–3 | Pending — replaces `addPrintedCards` |
| Interchange UI (steal surface) | Sprint 3 [ENI] | ENI Phase 2 | Pending — replaces instant steal resolution |
| Plant mechanic (inverse of steal) | Sprint 3 [ENI] | ENI Phase 4–5, CHH Step 6 | Pending — requires EB Phase 5 explosive cards |
| Policy flag governance (`stealable`) | Sprint 5 [CHH] | CHH Step 6 | Pending — data-driven steal eligibility |
| Post-combat salvage | Sprint 3 [ENI] | ENI Phase 5 | Planned — victory screen card loot |
| Designer portal: theft config | Sprint 6 [UDG] | UDG expansion | Planned — card designer exposes stealable/plantable flags |

---

## Vocabulary

### Enemy deck exposure
- Each enemy deck type defines `exposedTags` (see `public/data/gone-rogue/enemy-decks.json`).
- Tags are a shared dictionary: `pickpocket`, `disarm`, `sleight`, `hack`, `intimidate`, `bribe`.

### Player theft tools
- A theft tool is an item with `stealTags` (e.g. `ITM-PICKPOCKET-GLOVES`).
- The player must equip the tool into the active slot.

### Policy flags (Sprint 5 [CHH Step 6])
- Each card definition carries policy flags that govern interaction eligibility:
  - `stealable: true/false` — whether the card can be stolen (default `true` for EATK-* cards, `false` for BLVCK/ACT-000)
  - `plantable: true/false` — whether the card can be planted into an enemy slot (default `false`, `true` for explosives and poisons)
  - `destroyable: true/false` — whether the card can be destroyed via EMP/Sabotage
  - `triggerable: true/false` — whether a planted card can auto-fire via synergy combo
- Until Sprint 5 ships policy flags, the interaction menu uses hardcoded eligibility checks. Sprint 5 replaces these with flag reads.

---

## Pre-combat theft (realtime / exploration)

### Command
- `STEAL` (alias: `PICKPOCKET`)

### Requirements
- Not in STR combat.
- Player is **adjacent** (Manhattan distance 1) to an enemy.
- Player has an equipped item with `stealTags`.
- Target card must have `stealable: true` (or not be BLVCK). Before Sprint 5, this is a hardcoded check against `isBlvckSlot`.

### Resolution
- If `stealTags ∩ enemy.exposedTags` is non-empty, the steal is **valid**.
- If the enemy has a hydrated `enemy.cardDeck`, the system will:
  - choose an available (non-stolen, non-BLVCK) enemy card, preferring higher `stealValue`
  - mark the slot as `{ stolen: true }`
  - award the player that **specific** card ID (typically `EATK-###`)
- If the enemy deck is missing/unhydrated/empty, award a generic success card (`ACT-021`).

### Failure / invalid steal
- If tags do not match, award a generic consolation disposable (`ACT-020`) and show feedback.

### Acquisition pipeline

> **⚠ Migration required (Sprint 1 [CHH Step 2–3])**

**Current (legacy):** Stolen cards are inserted via `GAMESTATE.addPrintedCards(cardId, qty)`. This creates a full card object in the legacy `_state.cardHand` array — the old STR combat hand. It does not create a `CardRef` or `CI-*` instance, meaning the card is invisible to `hydrateCard()`, the NCH system, and the GC scanner.

**Target (post-CHH Step 2):** Stolen cards are acquired as `CardRef` entries:
1. `enemy-steal-system.js` calls `CardStateAuthority.acquireCard(cardId)` (or equivalent)
2. This creates a `CI-*` instance in `GAMESTATE._state.cardInstances` if the card needs instance-level tracking (e.g. planted provenance)
3. The `CardRef` `{ id: cardId, qty: 1, meta: { stolenFrom: enemy.name, turn: N } }` is inserted into `_state.cardsInHand` (the NCH lightweight refs array)
4. `hydrateCard(ref)` can now resolve the stolen EATK-* card for display in any renderer
5. `gcCardInstances()` tracks the ref — it won't be garbage-collected while in the player's hand

**Files to modify:**
- `public/js/enemy-steal-system.js` — replace `GAMESTATE.addPrintedCards` call with `CardStateAuthority.acquireCard` (or direct CardRef insert)
- `public/js/gamestate.js` — ensure `acquireNewCardDuringCombat()` also uses CardRef path

### Permanence
- The awarded card is permanent for the run (it becomes part of your deck flow).
- Stolen EATK-* cards are usable by the player — `hydrateCard()` resolves them from the enemy card registry.

---

## In-combat theft (STR combat / interaction menu)

> **🗓 Sprint 3 [ENI Phase 4]** — Available once the interaction menu (ENEMY_CARDS Phase 4.1) is wired.

### Interaction charge cost
- Stealing during combat costs 1 interaction charge (from Information Duel system, Phase 5.1).
- Items like ITM-090 Scrambler Chip grant +1 charge/turn.

### Two-stage pipeline (Phase 5.6)
- Cards must be **revealed first** (via Reveal action or ITM-087 Pattern Lens auto-reveal).
- Revealed cards become **stealable on a subsequent turn** — not the same turn they were revealed.
- This prevents instant reveal+steal combos and creates meaningful turn economy decisions.

### Mutation consequences
- Stealing triggers **PARANOIA** mutation on the enemy (Phase 5.2):
  - +1 stack per steal
  - Each stack hides an additional card (enemy "protects" remaining hand)
  - Face expression: Alert `(°_°)`
- This creates diminishing returns on repeated steals against the same enemy.

---

## Interchange UI (replacing instant steal resolution)

> **🗓 Sprint 3 [ENI Phase 2]** — The interchange UI is a modal overlay that replaces the current instant-resolution steal flow with a visual card-transfer interface.

### Current behavior (pre-Sprint 3)
- `STEAL` command → instant tag match check → card transferred silently → toast notification
- No visual representation of the transfer
- No opportunity for player to choose which card to steal (system picks highest stealValue)

### Target behavior (post-Sprint 3)
- `STEAL` command (or clicking enemy capsule) → opens **interchange UI**
- Player sees enemy's exposed cards (face-down jokers with interactability indicators)
- Player selects which card to target (if multiple are stealable)
- Visual card-transfer animation: card slides from enemy capsule to player hand
- Transfer writes a `CardRef` into `_state.cardsInHand` via the CHH pipeline
- Closes interchange UI; enemy hand updates in real-time

### Interchange UI also surfaces:
- **Plant action** — drag a plantable card from player hand INTO an enemy's BLVCK slot
- **Reveal action** — spend interaction charge to flip a card face-up
- **Destroy action** — spend interaction charge to remove a card (triggers RAGE mutation)

### Files
- `public/js/nch-interchange-ui.js` (new, ENI Phase 2)
- `public/css/nch-interchange-ui.css` (new)
- `public/js/enemy-steal-system.js` (modified — delegates to interchange UI instead of instant resolution)

---

## Plant mechanic (inverse of steal)

> **🗓 Sprint 3 [ENI Phase 4–5]** — Requires EB Phase 5 (explosive combat cards) and CHH Step 3 (policy flags stub).

### Concept
Planting is the mirror of stealing: instead of taking a card FROM an enemy, you place a card INTO an enemy's deck. The planted card sits dormant until either the player manually triggers it, or the enemy plays a card that synergy-triggers it.

### Eligible cards
Only cards with `plantable: true` can be planted. In the current design:
- Explosive cards: FRAG_GRENADE, PIPE_BOMB, C4_CHARGE (from EB Phase 5)
- Poison cards: (future — not yet defined)
- BLVCK (`ACT-000`) has `plantable: true` but is an enemy card, not a player-plantable card — it represents the **slot** that accepts plants

### Plant flow
1. Player opens interchange UI (or clicks BLVCK slot in enemy hand during STR combat)
2. Plant menu shows eligible cards from player's hand (cards with `plantable: true`)
3. Player selects a card to plant
4. The card is removed from `_state.cardsInHand` and written to the enemy's `cardDeck` entry:
   ```
   enemy.cardDeck[slotIndex].planted = {
     cardId: 'ACT-###' or 'CI-###',
     plantedBy: 'player',
     turn: currentTurn
   }
   ```
5. The planted card is invisible to the enemy (no visual indicator on their hand)
6. If the planted card was a CI-* instance, the GC scanner must find it in `enemy.cardDeck` (CHH Step 5 GC enemy deck scan)

### Detonation triggers
- **Manual:** Player clicks the planted slot during their interaction phase (costs 1 interaction charge)
- **Synergy-triggered:** Enemy plays a card whose tags form a combo with the planted card's tags → auto-detonation at full damage (no 60% reduction). See ENEMY_CARDS Phase 4.2.1 for full spec.
- **C4 delay:** C4_CHARGE has a 1-turn armed delay. Cannot be triggered (manually or via synergy) until `currentTurn - planted.turn >= 1`.

### Damage values
| Card | Damage | AoE | Special |
|---|---|---|---|
| FRAG_GRENADE | 12 | 2-tile radius | — |
| PIPE_BOMB | 8 | single target | Stun (1 turn) |
| C4_CHARGE | 20 | 3-tile radius | Delayed 1 turn |

---

## BLVCK as Universal Empty Slot Node

> **🗓 Sprint 3 [ENI Phase 4]** — See ENEMY_CARDS Phase 4.1.1 for full specification.

Every enemy spawns with at least one BLVCK slot (`isBlvckSlot: true`). This serves dual purposes:

1. **Plantable slot** — Always available for the player to plant explosives/poisons, even before stealing any cards
2. **Desperation action** — If the enemy has all real cards stolen AND nothing planted, they play BLVCK as a 0–2 damage action with `(ಥ_ಥ)` face expression

**Policy flags for BLVCK (ACT-000):**
- `stealable: false` — cannot be stolen (prevents infinite steal loops)
- `plantable: true` — accepts planted cards
- `destroyable: false` — cannot be destroyed
- `triggerable: false` — no synergy combo potential

---

## Post-combat theft (STR combat / victory)

> **🗓 Sprint 3 [ENI Phase 5]** — Becomes available after the full interaction surface is wired.

### Intended
After combat, a second theft surface rewards stealth builds:
- If you entered combat with advantage (ambush) or maintained low alert, allow a "loot a card" action.
- Prefer awarding from the enemy's remaining (non-stolen) `cardDeck`.

### Status
Not fully implemented yet.

### Planned behaviors
- Victory screen shows `stolenCards` and optionally a "SALVAGE" / "STRIP" button.
- Salvage selects 1 card from the enemy deck (weighted by `stealValue`) and grants it.
- Salvaged cards use the CardRef acquisition pipeline (same as pre-combat steal post-migration).
- If the enemy had planted explosives that were never triggered, they are **not** salvageable (consumed on combat end).

---

## Sprint Implementation Checklist

### Sprint 1 [CHH Steps 1–3] — Pipeline migration prep
- [ ] `hydrateCard()` resolves EATK-* IDs from enemy card registry
- [ ] `CardRef` format supports `meta.stolenFrom` and `meta.turn` fields
- [ ] `gcCardInstances()` scans enemy decks for planted CI-* refs

### Sprint 3 [ENI Phases 1–5] — Full theft + plant surface
- [ ] `enemy-steal-system.js` uses `CardStateAuthority.acquireCard()` instead of `addPrintedCards`
- [ ] Interchange UI opens on STEAL command (replaces instant resolution)
- [ ] Player can select which card to steal from interchange UI
- [ ] BLVCK slots show PLANT menu with eligible cards
- [ ] Planted explosives detonate on manual trigger or synergy-triggered auto-fire
- [ ] Post-combat salvage button appears on victory screen for stealth builds
- [ ] All stolen/planted cards render correctly via `hydrateCard()` in every renderer

### Sprint 5 [CHH Steps 4–6] — Policy flag governance
- [ ] `stealable` flag on card definitions governs steal eligibility (replaces hardcoded BLVCK check)
- [ ] `plantable` flag governs plant eligibility
- [ ] `destroyable` and `triggerable` flags respected by interaction menu and combo resolver
- [ ] Policy flags editable in designer portal (Sprint 6)

---

## Data references
- Enemy cards: `public/data/gone-rogue/enemy-cards.json`
- Enemy decks: `public/data/gone-rogue/enemy-decks.json`
- Catalog source of truth: `public/data/gone-rogue/enemy-catalog.json`
- Player cards: `public/data/gone-rogue/cards.json`
- Tag synergy combos: `public/data/gone-rogue/tag-synergy-data.json`
- Explosive card definitions: defined in EB Phase 2, registered in `gone-rogue-data-registry.js`

## Code references
- Pre-combat attempt: `public/js/enemy-steal-system.js`
- Enemy deck hydration: `public/js/enemy-deck-hydrator.js`
- Command routing: `public/js/gone-rogue.js`
- Card lookup: `public/js/gone-rogue-data-registry.js` (supports EATK-### as player cards)
- Card state authority: `public/js/card-state-authority.js` (CardRef reads/writes)
- Interchange UI: `public/js/nch-interchange-ui.js` (new, Sprint 3)
- Information Duel engine: `public/js/information-duel-engine.js` (interaction charges)
- GC scanner: `public/js/gamestate.js` → `gcCardInstances()` (must scan enemy decks post-CHH Step 5)
