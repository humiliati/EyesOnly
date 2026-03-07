# THEFT_MECHANICS.md

This document describes the theft system as it exists today, the plant mechanic (inverse of theft), the input fork (short press vs long press), ammo key spending, projectile context dispatch, the interchange UI evolution, and sprint timing for when each feature becomes available.

> **Companion doc:** `INPUT_PLAYER_CONTROLLER.md` covers the full input pipeline, controller mappings, and QuadStick accessibility considerations.

---

## Cross-Roadmap Sprint Alignment

> Theft touches multiple sprints. Pre-combat steal exists today but must migrate to the CardRef pipeline. The interchange UI replaces instant steal resolution. The plant mechanic is the inverse of steal and depends on explosive breakable systems.

| Feature | Sprint | Roadmap Source | Status |
|---|---|---|---|
| Pre-combat steal (STEAL command, tag matching) | Existing | ENEMY_CARDS Phase 1.2 | ✅ Functional, needs pipeline migration |
| Input fork: short press / long press | Sprint 2 | INPUT_PLAYER_CONTROLLER §8 | Pending — routes kick vs card hand |
| CardRef-based steal acquisition | Sprint 1 [CHH] | CHH Step 2–3 | Pending — replaces `addPrintedCards` |
| Ammo key spending for theft | Sprint 2 | This doc §6 | Pending — consumes Tier 1 keys as lockpick charges |
| Interchange UI (steal surface) | Sprint 3 [ENI] | ENI Phase 2 | Pending — replaces instant steal resolution |
| Plant mechanic (inverse of steal) | Sprint 3 [ENI] | ENI Phase 4–5, CHH Step 6 | Pending — requires EB Phase 5 explosive cards |
| Policy flag governance (`stealable`) | Sprint 5 [CHH] | CHH Step 6 | Pending — data-driven steal eligibility |
| Post-combat salvage | Sprint 3 [ENI] | ENI Phase 5 | Planned — victory screen card loot |
| Designer portal: theft config | Sprint 6 [UDG] | UDG expansion | Planned — card designer exposes stealable/plantable flags |

---

## §1 — Input Fork: Short Press vs Long Press

The core input decision when adjacent to an enemy is **short press** (instant action) vs **long press** (open enemy card hand). This multiplexes over the existing kick/steal/projectile dispatch without adding extra buttons — critical for touch and QuadStick accessibility.

### Timer

```
LONG_PRESS_THRESHOLD = 400ms

pointerdown / touchstart on enemy tile:
  → start timer (_pressStartTime = Date.now())
  → show subtle "hold" indicator ring (fills over 400ms)

pointerup / touchend:
  → elapsed = Date.now() - _pressStartTime

  IF elapsed < LONG_PRESS_THRESHOLD:
    → SHORT PRESS dispatch (see below)
  ELSE:
    → LONG PRESS → open enemy card hand as NCH capsule minimized
```

### Short Press Context Dispatch

Short press routes through `_processGridInput()` priority chain (see INPUT_PLAYER_CONTROLLER §2):

```
SHORT PRESS on adjacent enemy:
  IF player has equipped theft tool with stealTags:
    → EnemyStealSystem.attempt(ctx) — instant steal
  ELSE IF player has equipped projectile weapon AND minFireDistance <= 1:
    → fireProjectileAtTarget() — point-blank shot
  ELSE:
    → kick — TapMoveSystem treats enemy as kickable obstacle
    → applies kick damage (0.2), push if pushable

SHORT PRESS on distant enemy (distance > 1):
  → fireProjectileAtTarget() — ranged shot
  → consumes ammo (1 per shot from GAMESTATE.playerAmmo)

SHORT PRESS on adjacent breakable:
  → kick — existing pipeline (see INPUT_PLAYER_CONTROLLER §4)
```

### Long Press → Card Hand (NCH Capsule Minimized)

Long press on an adjacent enemy opens their card hand for interactive node selection:

```
LONG PRESS on adjacent enemy (≥400ms):
  1. Freeze game tick (pause movement/enemies/projectiles)
  2. Open NCH capsule minimized view anchored to enemy tile
  3. Render enemy.cardDeck as interactive nodes:
     · Each card = one node (face-down joker or revealed if previously scouted)
     · BLVCK slots shown as empty plantable nodes
  4. Player selects a node (tap / A button / sip) to see action menu:
     · PICKPOCKET — steal this card (requires stealTags match + ammo key)
     · PLANT — insert explosive/poison from player hand (requires plantable card)
     · REVEAL — flip card face-up (costs 1 interaction charge, future Sprint 3)
     · SWAP — exchange with a card from player hand (costs 2 ammo keys)
     · BRIBE — spend gold to remove card (costs proportional to stealValue)
  5. After action or B/Escape → close capsule, resume game tick
```

### Controller Mappings for Short/Long Press

| Input | Touch | Keyboard | Xbox | QuadStick |
|---|---|---|---|---|
| Short press | Tap (<400ms) | E (toward facing dir) | A (tap) | Light sip |
| Long press | Hold (≥400ms) | E (hold) | A (hold) | Sustained sip |
| Select node | Tap node | Arrow keys + Enter | D-pad + A | Joystick + light sip |
| Cancel capsule | Tap self / outside | Escape | B | Light puff |
| Confirm action | Tap action button | Enter | A | Light sip |

> **QuadStick note:** "Sustained sip" is a longer-duration sip, not a harder sip. Hard sip is reserved for LT/sprint. The 400ms threshold is generous enough for sip-tube timing. See INPUT_PLAYER_CONTROLLER §10 for full QuadStick design rules.

---

## §2 — Vocabulary

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

## §3 — Pre-combat Theft (Realtime / Exploration)

### Command
- `STEAL` (alias: `PICKPOCKET`)
- Triggered by: short press on adjacent enemy with theft tool equipped, OR selecting PICKPOCKET node in long-press capsule.

### Requirements
- Not in STR combat.
- Player is **adjacent** (Manhattan distance 1) to an enemy.
- Player has an equipped item with `stealTags`.
- Target card must have `stealable: true` (or not be BLVCK). Before Sprint 5, this is a hardcoded check against `isBlvckSlot`.
- **Ammo key cost** (§6): if the selected theft node requires a key, the key is consumed.

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

## §4 — Long-Press Card Hand: NCH Capsule Minimized

> **🗓 Sprint 2–3** — The NCH capsule minimized view reuses existing `NonCombatHud` capsule rendering at a smaller scale, anchored to the enemy tile.

### Visual Layout

```
        ┌─────────────────────────────────────────┐
        │  ENEMY NAME  ♥♥♥  (HP indicator)        │
        │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
        │ │ 🃏  │ │ 🃏  │ │ 💀  │ │ ▪▪▪ │        │
        │ │     │ │     │ │BLVCK│ │stolen│        │
        │ │ [1] │ │ [2] │ │ [3] │ │ [—] │        │
        │ └──┬──┘ └──┬──┘ └──┬──┘ └─────┘        │
        │    │       │       │                    │
        │  steal   steal   plant    (disabled)    │
        │  🔓1key  🔓1key  💣C4                   │
        └─────────────────────────────────────────┘
                        ▲
                    [enemy tile]
```

- Face-down cards: 🃏 joker icon, interactable (can attempt steal or reveal)
- BLVCK slots: 💀 icon, plantable only
- Stolen slots: greyed out, disabled (already taken)
- Lock icons (🔓) indicate ammo key cost
- Node size: 2×2 grid cells minimum for accessibility (QuadStick joystick precision)

### Interaction Nodes

Each node presents a context menu when selected:

| Node State | Available Actions | Cost |
|---|---|---|
| Face-down, stealTags match | PICKPOCKET, REVEAL | 1 ammo key (pickpocket), 1 interaction charge (reveal) |
| Face-down, no stealTags match | REVEAL only | 1 interaction charge |
| Face-up (revealed) | STEAL (if stealable), SWAP | 1 ammo key (steal), 2 ammo keys (swap) |
| BLVCK (empty slot) | PLANT | 1 plantable card from hand |
| Stolen (greyed) | (none) | — |

### Implementation Approach

```
1. Reuse NonCombatHud._renderCapsuleMinimized() — existing function
   renders a compact row of card slots (used for player hand today)
2. Adapt for enemy deck: read from enemy.cardDeck instead of player hand
3. Each slot click → open radial action menu (not a dropdown — better for
   touch and joystick navigation)
4. Radial menu segments: N=STEAL, E=REVEAL, S=PLANT, W=CANCEL
   · Maps to D-pad and joystick naturally
   · Missing actions are greyed segments
5. On action confirm → execute via EnemyStealSystem or PlantSystem
6. Close capsule → resume game tick
```

---

## §5 — In-combat Theft (STR Combat / Interaction Menu)

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

## §6 — Ammo Key Spending for Item-Enabled Theft

Tier 1 keys (RUSTY_KEY / ITM-017, BRONZE_KEY / ITM-018) double as **lockpick charges** for advanced theft actions. This creates resource tension: spend keys on gates/chests for guaranteed loot, or spend them on theft for potentially more valuable enemy cards.

### Key as lockpick model

```
THEFT ACTION COSTS:
  · PICKPOCKET (face-down card)  → 1 ammo key
  · STEAL (revealed card)        → 1 ammo key
  · SWAP (exchange cards)        → 2 ammo keys
  · PLANT (insert explosive)     → 0 keys (costs the planted card itself)
  · REVEAL                       → 0 keys (costs 1 interaction charge)
  · BRIBE                        → 0 keys (costs gold proportional to stealValue)
```

### Where keys are consumed

```
Pre-combat (exploration):
  · Short press steal: 1 key consumed on SUCCESS (not on failure)
  · Long press capsule → PICKPOCKET node: 1 key consumed on confirm
  · No key required for basic kick (non-theft)

In-combat (STR):
  · Same costs, but also costs 1 interaction charge per action
  · Keys consumed from GAMESTATE.keys.ammo (same pool as gun ammo keys)
```

### Theft without keys

If the player has no keys but has a theft tool equipped:
- Short press → still attempts steal, but auto-downgrades to **FUMBLED GRAB** (ACT-020 consolation)
- Long press → capsule opens but PICKPOCKET/STEAL nodes show "🔒 NO KEY" and are disabled
- PLANT and REVEAL nodes remain available (no key cost)

### Key acquisition feedback

When stealing costs a key, show overhead animation:
```
"🔑→🃏"  (key consumed, card acquired)
"🔑→❌"  (key consumed, steal failed — should not happen with current tag-match system)
```

### Data changes needed

Add to `items.json` for ITM-017 / ITM-018:
```json
{
  "useAsLockpick": true,
  "lockpickUses": 1,
  "consumeOnTheft": true
}
```

Add to `enemy-steal-system.js`:
```javascript
// Before returning success, consume a key
if (ctx.consumeKey && typeof ctx.consumeKey === 'function') {
  var keyConsumed = ctx.consumeKey(1);
  if (!keyConsumed) {
    return { ok: true, success: false, cardId: DEFAULT_FAIL_CARD,
             enemy: target, message: 'NO KEY — fumbled grab' };
  }
}
```

---

## §7 — Projectile Minimum Distance & Equipped-Item Context

The input fork (§1) uses **equipped item type** and **target distance** to determine what a short press does. This section specifies the distance thresholds and item-type precedence.

### Distance thresholds

```
ADJACENT (Manhattan distance == 1):
  · Kick, steal, interact, plant — all available
  · Projectile only fires if weapon has minFireDistance <= 1
    (most ranged weapons have minFireDistance: 2, preventing point-blank)

CLOSE RANGE (Manhattan distance 2–3):
  · Projectile fires normally
  · Cannot kick/steal/interact (too far)

LONG RANGE (Manhattan distance 4+):
  · Projectile fires normally
  · Projectile range stat caps maximum distance (default: 15 tiles)
```

### Equipped item precedence (adjacent enemy)

When the player short-presses an adjacent enemy, the dispatch checks equipped item type in order:

```
1. IF activeItem.stealTags exists AND stealTags.length > 0:
   → STEAL (theft tool takes priority)

2. ELSE IF activeItem.type === 'weapon' AND activeItem.minFireDistance <= 1:
   → SHOOT (point-blank capable weapon)

3. ELSE IF activeItem.type === 'explosive' AND activeItem.plantable:
   → PLANT (auto-plant into nearest BLVCK slot, skip capsule)

4. ELSE:
   → CQC KICK (default melee — see ENEMY_CQC_SYSTEM.md for item-buffed strikes)
   → Items with cqcDamage (knives, knuckles, shotguns) modify the kick into a real attack
   → Resource cost (fatigue, energy, ammo) checked; falls back to bare kick if insufficient
```

### Item data shape

```json
{
  "id": "ITM-PICKPOCKET-GLOVES",
  "stealTags": ["pickpocket", "sleight"],
  "minFireDistance": null
}

{
  "id": "ITM-REVOLVER",
  "type": "weapon",
  "stealTags": [],
  "minFireDistance": 2,
  "ammoPerShot": 1
}

{
  "id": "ITM-SHOTGUN",
  "type": "weapon",
  "stealTags": [],
  "minFireDistance": 1,
  "ammoPerShot": 2,
  "spread": 3
}

{
  "id": "ITM-C4-PACK",
  "type": "explosive",
  "plantable": true,
  "stealTags": [],
  "minFireDistance": null
}
```

---

## §8 — Interchange UI (Replacing Instant Steal Resolution)

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

## §9 — Plant Mechanic (Inverse of Steal)

> **🗓 Sprint 3 [ENI Phase 4–5]** — Requires EB Phase 5 (explosive combat cards) and CHH Step 3 (policy flags stub).

### Concept
Planting is the mirror of stealing: instead of taking a card FROM an enemy, you place a card INTO an enemy's deck. The planted card sits dormant until either the player manually triggers it, or the enemy plays a card that synergy-triggers it.

### Entry points

```
1. Long press → capsule → select BLVCK node → PLANT menu
   (full control, pick which slot and which card)

2. Short press with explosive equipped (§7 precedence rule 3)
   (quick-plant into nearest BLVCK, skips capsule)

3. In-combat interaction menu → PLANT action
   (same flow as capsule but during STR combat turns)
```

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
- **Remote:** Player presses R / RB / puff-tube-2 while detonator is in active slot
- **Synergy-triggered:** Enemy plays a card whose tags form a combo with the planted card's tags → auto-detonation at full damage (no 60% reduction). See ENEMY_CARDS Phase 4.2.1 for full spec.
- **C4 delay:** C4_CHARGE has a 1-turn armed delay. Cannot be triggered (manually or via synergy) until `currentTurn - planted.turn >= 1`.

### Damage values
| Card | Damage | AoE | Special |
|---|---|---|---|
| FRAG_GRENADE | 12 | 2-tile radius | — |
| PIPE_BOMB | 8 | single target | Stun (1 turn) |
| C4_CHARGE | 20 | 3-tile radius | Delayed 1 turn |

---

## §10 — BLVCK as Universal Empty Slot Node

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

## §11 — Post-combat Theft (STR Combat / Victory)

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

## §12 — Sprint Implementation Checklist

### Phase 1 — Input Fork (Sprint 2)
- [ ] Add `LONG_PRESS_THRESHOLD = 400` constant to `gone-rogue-mobile.js`
- [ ] Implement hold indicator ring (CSS radial animation on enemy tile)
- [ ] Wire `pointerdown` timer → short press / long press dispatch in `_processGridInput`
- [ ] Short press: equipped-item precedence chain (steal → shoot → plant → kick)
- [ ] Long press: open NCH capsule minimized anchored to enemy tile
- [ ] Add `minFireDistance` field to weapon items in `items.json`
- [ ] Keyboard: E key hold detection in `_setupKeyboardHandlers`
- [ ] Xbox: A button hold detection via Gamepad API poll in game tick

### Phase 2 — Ammo Key Integration (Sprint 2)
- [ ] Add `useAsLockpick`, `lockpickUses`, `consumeOnTheft` to ITM-017 / ITM-018 in `items.json`
- [ ] Modify `enemy-steal-system.js` → `attempt()` to accept `ctx.consumeKey` callback
- [ ] Wire key consumption in `gone-rogue.js` → `_attemptPickpocket()` context builder
- [ ] Show "🔒 NO KEY" on capsule nodes when player has no keys
- [ ] Overhead animation "🔑→🃏" on successful key-funded steal
- [ ] Fall back to FUMBLED GRAB (ACT-020) when no keys and short-press steal

### Phase 3 — NCH Capsule Minimized for Enemies (Sprint 2–3)
- [ ] Adapt `NonCombatHud._renderCapsuleMinimized()` to accept enemy deck data
- [ ] Render face-down / BLVCK / stolen node states
- [ ] Radial action menu (N=STEAL, E=REVEAL, S=PLANT, W=CANCEL)
- [ ] D-pad / joystick navigation for radial segments
- [ ] Game tick freeze during capsule open
- [ ] Capsule close on B / Escape / tap outside / timeout (5s idle)

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
- [ ] Remote detonation via R / RB / puff-tube-2 with detonator in active slot
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
- Items: `public/data/gone-rogue/items.json`
- Tag synergy combos: `public/data/gone-rogue/tag-synergy-data.json`
- Explosive card definitions: defined in EB Phase 2, registered in `gone-rogue-data-registry.js`

## Code references
- Pre-combat attempt: `public/js/enemy-steal-system.js`
- Enemy deck hydration: `public/js/enemy-deck-hydrator.js`
- Command routing: `public/js/gone-rogue.js`
- Input pipeline: `public/js/gone-rogue-mobile.js` (event handlers, `_processGridInput`)
- Tap/kick dispatch: `public/js/tap-move-system.js`
- Breakable kick: `public/js/breakable-system.js`
- Projectiles: `public/js/projectile-system.js`
- Card lookup: `public/js/gone-rogue-data-registry.js` (supports EATK-### as player cards)
- Card state authority: `public/js/card-state-authority.js` (CardRef reads/writes)
- Interchange UI: `public/js/nch-interchange-ui.js` (new, Sprint 3)
- NCH capsule rendering: `public/js/non-combat-hud.js` (reuse `_renderCapsuleMinimized`)
- Information Duel engine: `public/js/information-duel-engine.js` (interaction charges)
- GC scanner: `public/js/gamestate.js` → `gcCardInstances()` (must scan enemy decks post-CHH Step 5)
- Companion doc: `docs/INPUT_PLAYER_CONTROLLER.md`
