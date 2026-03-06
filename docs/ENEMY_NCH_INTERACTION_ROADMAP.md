# Enemy NCH Capsule, Player Interaction & STR Combat Hand Roadmap

### v1.0 — March 2026

---

## Vision

Three interlocking systems that create a unified "card manipulation" surface across the game's two main modes:

1. **Enemy NCH Capsule (Exploration)** — Enemies carry an invisible joker-stack capsule identical in shape to the player's NCH. The player can cause enemy NCH to appear by use of certain items, by standing idle (time varies with use of passive items) nearby an enemy (passive items to vary this distance) interact with it pre-combat via equipped items (pickpocket, plant, reveal) spending the resource key_ammo along the way. The capsule shows the enemy's actual hydrated card deck with alternating "BLVCK" style joker.emojis for plantable nodes and regular joker.emojis representing enemy cards.

2. **Player NCH Interchange (Exploration)** — When the player initiates a successful steal/plant interaction, both the player's NCH and the enemy's NCH capsule open over-under, the enemy's NCH displayed across the top and the player's NCH displayed across the bottom, enabling drag-and-drop card interchange into plantable slots, from enemy inventory, toggle equipped items to destroy enemy cards. The player can pull cards out of the enemy's hand (steal) or push cards into empty enemy slots (plant). Animations handle the card flight between capsules.

3. **STR Combat Enemy Hand (Combat)** — During STR combat, the enemy's hand displays in the backup scroll space (per NCH-COMBAT-ROADMAP §1.5) as interactive card nodes. Each card slot is a player interaction point: reveal, steal, destroy, or trigger planted cards. The display matches the player's NCH capsule visual language (joker stacks, BLVCK greyed states, interactable pulsing).

---

## Existing System Inventory

| System | File | Status | Relevance |
|--------|------|--------|-----------|
| Enemy deck hydration | `enemy-deck-hydrator.js` | Complete | Attaches `cardDeck[]` to spawned enemies |
| Enemy hand display (combat) | `enemy-hand-display.js` | Complete | Shows joker cards, expose reveal/steal/destroy APIs |
| Enemy card interactability | `enemy-card-interactability.js` | Complete | Computes which actions are available per card |
| Enemy card interaction handler | `enemy-card-interaction-handler.js` | Complete | Context menu, action dispatch, charges |
| Pre-combat steal system | `enemy-steal-system.js` | Complete | Adjacent steal, tag matching, card extraction |
| Player NCH capsule | `non-combat-hud.js` | Complete | Joker stack, expand to 3-zone (hand/backup/vault) |
| Card state authority | `card-state-authority.js` | Complete | Canonical card state, event-driven updates |
| Card transfer manager | `card-transfer-manager.js` | Complete | Cross-container drag/drop (hand/backup/vault) |
| Information duel engine | `information-duel-engine.js` | Complete | Charges, mutation, momentum, escalation, overload |
| STR combat integration | `str-combat-integration.js` | Partial | 100ms poll loop, wires CSA round changes |
| STR combat window | `str-combat-window.js` | Partial | Timer, HP bars, intent display |
| Enemy intent system | `enemy-intent-system.js` | Complete | 13 face glyphs, weapon intents, combat events |
| Theft mechanics | THEFT_MECHANICS.md | Spec | Pre-combat steal flow, post-combat salvage |
| Explosive breakables | EXPLOSIVE_BREAKABLES_ROADMAP.md | Spec | §5.3: pickpocket-to-plant-explosive flow |
| Enemy AI | ENEMY_AI.md | Spec | §4: steal as silent takedown, investigation |

### What's Missing

1. **No enemy NCH capsule on the map** — enemies have `cardDeck` data but no visual capsule during exploration
2. **No plant mechanic** — steal pulls cards FROM enemies, but there's no inverse (push cards INTO enemy hand)
3. **No side-by-side NCH interchange UI** — steal is currently a single command with instant resolution, no visual card drag
4. **STR combat enemy hand is not yet rendered as interactive NCH-style nodes** — `enemy-hand-display.js` exists and works but renders in the backup scroll space as a flat row, not as a capsule that matches the player's NCH visual language
5. **No planted card tracking** — no data structure for "cards the player inserted into enemy inventory"
6. **No planted card detonation** — EXPLOSIVE_BREAKABLES_ROADMAP §5.3 describes the flow but it's not wired

---

## Phase 1 — Enemy NCH Capsule on the Map

**Goal:** Every enemy with a hydrated `cardDeck` displays a small joker-stack capsule overhead during exploration. The capsule visually communicates deck size, stolen slots, and interactability.

**Reference docs:** NCH-COMBAT-ROADMAP §2.1 (joker stack), ENEMY_CARDS Phase 3 (BLVCK vs ordinary joker visuals)

### 1.1 — Enemy Capsule Renderer

New module: `public/js/enemy-capsule-renderer.js`

Renders a small capsule above each enemy on the map during exploration (non-combat). Uses the same pancake-stacker pattern as the player's NCH joker stack from `non-combat-hud.js`:

- N overlapping joker emojis where N = non-stolen cards in `enemy.cardDeck`
- Each offset by 2px right, 1px down, with slight rotation jitter
- Scale: 60% of player capsule size (16px emoji vs 28px)
- Position: anchored to enemy tile, offset up-left from enemy emoji

Visual states per-joker:
- **Full color** 🃏 — card is interactable (player has matching equipped item)
- **Greyed** 🃏 with `.nch-joker-greyed` — card is not interactable
- **Empty slot** (dim outline) — card was stolen
- **Planted indicator** — subtle glow or different tint if player planted a card here

Capsule visibility rules:
- Only visible when player is within 4 tiles (awareness range)
- Fades in/out with distance (opacity scales with proximity)
- Hidden during STR combat (enemy hand display takes over)
- Hidden if enemy has no `cardDeck` or deck is empty

**Files touched:**
- New: `public/js/enemy-capsule-renderer.js`
- New: `public/css/enemy-capsule.css`
- Modified: `public/js/gone-rogue.js` — call renderer in `_renderEnemies()` loop
- Modified: `public/index.html` — add script tag

### 1.2 — Capsule Interactability Indicators

The capsule reflects what the player CAN do based on their equipped item. Reuse `EnemyCardInteractability.compute()` logic but in a simplified pre-combat context:

- **Pickpocket Gloves equipped + enemy has `exposedTags` matching `stealTags`**: capsule jokers pulse with steal indicator (green border pulse)
- **Pickpocket Gloves equipped + enemy has empty slots**: capsule shows dim empty-slot outlines with plant indicator (orange border pulse)
- **No matching tool equipped**: capsule shows all greyed jokers (BLVCK style)
- **Enemy is ENGAGED/ALERTED**: capsule shows red tint (cannot interact — too alert)

Check runs on: item equip/unequip, player movement, enemy awareness change.

**Files touched:**
- Modified: `public/js/enemy-capsule-renderer.js` — interactability check per render
- Modified: `public/js/enemy-card-interactability.js` — add `computePreCombat(enemy, playerState)` method for map context

### 1.3 — Enemy `plantSlots` Data Structure

Extend the enemy card deck model to support planted cards:

```
enemy.cardDeck[i] = {
  id: 'EATK-###',       // original enemy card ID
  stolen: false,         // true if player stole this card
  planted: null,         // null or { cardId: 'ACT-###', plantedBy: 'player', turn: N }
  meta: { t: timestamp }
}
```

New optional entries for planted cards (empty slots the player fills):

```
enemy.cardDeck.push({
  id: null,              // no original enemy card
  stolen: false,
  planted: { cardId: 'ACT-FRAG-GRENADE', plantedBy: 'player', turn: 42 },
  meta: { t: Date.now() }
})
```

**Files touched:**
- Modified: `public/js/enemy-deck-hydrator.js` — ensure `planted: null` default on hydration
- Modified: `public/js/gamestate.js` — add `plantCardOnEnemy(enemy, cardRef)` method
- Modified: `public/js/enemy-steal-system.js` — extend return shape to include plant info

---

## Phase 2 — Player NCH Interchange (Steal & Plant UI)

**Goal:** When the player initiates a steal/plant interaction on an adjacent enemy, both NCH capsules open side-by-side for visual drag-and-drop card exchange. This replaces the instant-resolution steal command with a tactile card manipulation surface.

**Reference docs:** THEFT_MECHANICS.md (steal flow), EXPLOSIVE_BREAKABLES_ROADMAP §5.3 (plant explosive flow), NCH-COMBAT-ROADMAP §1.3 (drag & drop between inventories)

### 2.1 — Interchange Trigger & Eligibility

The existing `STEAL` command (or tap-on-adjacent-enemy with Pickpocket Gloves toggled on) now opens the interchange UI instead of instantly resolving:

Eligibility:
- Player is adjacent (Manhattan distance 1) to an enemy
- Enemy is UNAWARE or SLEEPING (per ENEMY_AI §4.1)
- Player has an equipped item with `stealTags`
- `stealTags` intersect `enemy.exposedTags`

On trigger:
1. Game pauses (exploration freeze — no enemy movement)
2. Player NCH expands to show hand zone
3. Enemy NCH capsule expands to show enemy's card slots
4. Both render side-by-side in a centered overlay

**Files touched:**
- Modified: `public/js/enemy-steal-system.js` — replace instant resolution with interchange open
- New: `public/js/nch-interchange.js` — manages the side-by-side UI, drag routing, close/confirm

### 2.2 — Side-by-Side Layout

```
┌──────────────────────────────────────────────────────┐
│                  NCH INTERCHANGE                      │
│                                                       │
│   ┌─── PLAYER HAND ───┐    ┌─── ENEMY HAND ───┐     │
│   │ 🃏 🃏 🃏 🃏 🃏     │    │ 🃏 🃏 🃏 ░░      │     │
│   │ (your cards)       │    │ (their cards)     │     │
│   │                    │    │                   │     │
│   │ drag FROM here ────│───→│ drop TO here      │     │
│   │                    │←───│ drag FROM here    │     │
│   │  ← drop TO here   │    │                   │     │
│   └────────────────────┘    └───────────────────┘     │
│                                                       │
│   [CONFIRM]                              [CANCEL]     │
└──────────────────────────────────────────────────────┘

🃏 = card (bright = interactable, grey = locked)
░░ = empty slot (plantable)
```

Left panel: Player's current hand (from `CardStateAuthority.getCardsInHand()`)
Right panel: Enemy's `cardDeck` — non-stolen cards as jokers, stolen slots as empty, planted slots with planted card emoji

Drag rules:
- **Enemy card → Player hand**: STEAL (card must be interactable per tag match)
- **Player card → Enemy empty slot**: PLANT (slot must be empty or stolen)
- **Player card → Player hand**: reorder (existing NCH behavior)
- Cannot drag enemy cards between enemy slots
- Cannot plant into occupied enemy slots

### 2.3 — Steal Drag Animation

When player drags an enemy joker to their hand panel:

```
T+0ms:    Drag starts — joker lifts from enemy panel with scale 1.2x
T+0ms:    Enemy capsule slot shows "removing" animation (slot dims)
T+150ms:  Card ghost follows cursor, crosses the gap between panels
T+drop:   Card lands in player hand — joker flips to reveal actual card face
T+300ms:  Card slides into hand position
T+400ms:  Enemy slot replaced with empty outline (💀 or dim border)
T+500ms:  Sound hook: `AudioSystem.play('card_steal')`
```

On drop, calls:
- `EnemyStealSystem.executeSteal(enemy, cardIndex)` — marks slot `stolen: true`
- `GAMESTATE.acquireNewCardDuringCombat(stolenCardId, 1)` or `GAMESTATE.addPrintedCards([stolenCardId])` (exploration path)
- `CardStateAuthority.emit('hand:changed')`

### 2.4 — Plant Drag Animation

When player drags a card from their hand to an enemy empty slot:

```
T+0ms:    Drag starts — card lifts from player hand
T+150ms:  Card ghost crosses gap, enemy empty slot pulses orange (drop target)
T+drop:   Card inserts into enemy slot — card face flips to joker back (hidden from enemy)
T+300ms:  Enemy slot shows planted indicator (subtle orange inner glow)
T+400ms:  Original hand slot closes gap (remaining cards reflow)
T+500ms:  MOK interjection: '💣 Planted [card name]!'
```

On drop, calls:
- `GAMESTATE.plantCardOnEnemy(enemy, { cardId, fromHandIndex })` — adds to `enemy.cardDeck` with `planted` field
- `CardStateAuthority.removeFromHand(cardIndex)` — removes from player hand
- Update enemy capsule renderer

### 2.5 — Interaction Budget & Close

The interchange has a limited action budget per interaction (prevents infinite steal/plant loops):

- **Default**: 1 action (steal OR plant)
- **Pickpocket Gloves + Scrambler Chip (ITM-090)**: 2 actions
- Action count shown as pips in the interchange header
- Each successful steal or plant spends 1 action
- When actions exhausted OR player clicks CONFIRM, interchange closes

On close:
- Exploration resumes
- Enemy awareness check: 20% chance enemy becomes SUSPICIOUS (heard something)
- If enemy had Paranoia mutation (from ENEMY_CARDS Phase 5.2), 40% chance SUSPICIOUS
- Player NCH returns to minimized capsule state

**Files touched:**
- New: `public/js/nch-interchange.js`
- New: `public/css/nch-interchange.css`
- Modified: `public/js/enemy-steal-system.js` — plant action path
- Modified: `public/js/gamestate.js` — `plantCardOnEnemy()`, `removeFromHand()`
- Modified: `public/js/card-state-authority.js` — emit events on plant
- Modified: `public/js/non-combat-hud.js` — interchange-mode expansion
- Modified: `public/index.html` — script tags

---

## Phase 3 — STR Combat Enemy Hand as Interactive NCH

**Goal:** During STR combat, the enemy's hand renders in the backup scroll space as an NCH-style capsule with interactive card nodes. Each node is a player interaction point. The display should feel like "the enemy's NCH" — same visual language as the player's capsule but mirrored.

**Reference docs:** NCH-COMBAT-ROADMAP §1.5 (backup scroll space repurposed for enemy hand), ENEMY_CARDS Phase 2 (deck-aware combat hand), Phase 3 (BLVCK vs interactable jokers), Phase 4 (in-combat interactions)

### 3.1 — Combat Enemy Hand as Capsule Layout

Refactor `enemy-hand-display.js` rendering from a flat row of small jokers into an NCH-capsule-style layout that mirrors the player's hand fan:

```
┌─── STR COMBAT WINDOW ───────────────────────────────┐
│                                                      │
│   [HP BAR]  😡 ENEMY NAME  [INTENT DISPLAY]         │
│                                                      │
│   ┌─── ENEMY HAND (NCH-style but with nodes)─────┐   │
│   │                                              │   │
│   │   🃏   🃏   🃏   💀   ░░                    │   │
│   │   [1]  [2]  [3]  [X]  [+]                   │   │
│   │                                              │   │
│   │   ▪▪   ▪▪▪  ▪    —    —   ← momentum dots   │   │
│   │                                              │   │
│   └──────────────────────────────────────────────┘   │
│                                                      │
│   CHARGES: ██░  ESCALATION: ████░░  MUTATION: RAGE   │
│                                                      │
└──────────────────────────────────────────────────────┘

🃏 = hidden card (bright if interactable, BLVCK if not)
💀 = destroyed/stolen slot
░░ = empty slot or BLVCK card (plantable during combat if player has charges)
[+] = planted card (player's card, triggerable)
▪  = momentum dots (color-coded by dominant tag)
```

Each card slot is a clickable/tappable node:
- **Hidden + interactable**: full-color joker with pulsing green border → click opens action menu (reveal/steal/destroy per existing `enemy-card-interaction-handler.js`)
- **Hidden + non-interactable**: greyed BLVCK joker, `pointer-events: none`
- **Revealed**: shows actual card emoji + name, still interactable for steal/destroy
- **Destroyed/stolen**: 💀 skull, non-interactive
- **Planted**: player card emoji with orange glow, click to trigger (if triggerable)

### 3.2 — Planted Card Triggers in Combat

Cards planted by the player into enemy hands can be triggered during combat:

**Explosive cards** (FRAG_GRENADE, PIPE_BOMB, C4_CHARGE per EXPLOSIVE_BREAKABLES §5.4):
- Click planted card slot → confirmation prompt → detonate
- Detonation deals full card damage to enemy (not reduced like enemy self-play)
- Triggers `ExplosionSystem.detonate()` if AoE card, or direct damage if single-target
- Consumes the planted card slot (becomes 💀)
- Costs 1 interaction charge

**Non-explosive planted cards**:
- Planted cards that are NOT explosive act as "dummy" cards in the enemy's hand
- Enemy AI may "play" them on their turn — the card fizzles (does nothing useful) and wastes the enemy's action
- Design intent: planting junk cards into enemy inventory forces them to waste turns

**Trigger eligibility**:
- Player must have Pickpocket Gloves equipped AND toggled active
- Costs 1 interaction charge (shared pool with reveal/steal/destroy from InformationDuelEngine)
- Only explosive-tagged planted cards can be manually triggered
- Non-explosive planted cards trigger automatically when enemy plays them

### 3.3 — Round-Based Interactability Refresh

Each STR combat round, the interactability state is recalculated:

1. `EnemyCardInteractionHandler.computeInteractability(combatState)` runs at round start
2. Planted card trigger availability recalculated
3. Momentum dots update per `InformationDuelEngine.updateMomentum()`
4. Mutation badge updates based on player's interaction pattern
5. Charges refill per `InformationDuelEngine.advanceTurn()`

The enemy hand capsule re-renders after each state change, using the same event-driven pattern as the player's NCH (subscribe to `hand:changed`, `card:disposed`, `draw:reset` from CSA).

### 3.4 — Enemy Card Play Animation

When the enemy plays a card on their turn, the corresponding joker slot in the enemy hand capsule animates:

```
T+0ms:    Selected slot highlights (yellow border pulse)
T+200ms:  Card lifts from slot, flips to face-up (reveals card emoji + name)
T+400ms:  Card flies toward the STR combat action area (center of window)
T+600ms:  Card effect resolves (damage numbers, status applied)
T+800ms:  Card fades out, slot shows 💀 (consumed)
T+1000ms: Remaining cards shift to fill gap
```

If enemy plays a PLANTED card (player's trap):
```
T+0ms:    Slot highlights orange (planted indicator)
T+200ms:  Card flips — reveals player's card emoji instead of enemy card
T+400ms:  MOK interjection: "Ha! They played your trap!"
T+600ms:  Card fizzles (non-explosive) or detonates (explosive)
T+800ms:  If explosive: screen shake + damage to enemy (self-inflicted)
```

**Files touched:**
- Modified: `public/js/enemy-hand-display.js` — NCH-capsule-style layout, planted card rendering, play animation
- Modified: `public/css/enemy-hand-display.css` — capsule layout, planted glow, play animation keyframes
- Modified: `public/js/enemy-card-interaction-handler.js` — planted card trigger action
- Modified: `public/js/str-combat-integration.js` — wire planted card tracking, round refresh
- Modified: `public/js/str-combat-window.js` — allocate space for capsule-style enemy hand

---

## Phase 4 — Player NCH Animation Adjustments

**Goal:** Adjust the player's NCH to accommodate card interchange visuals. When cards are stolen from or planted into enemies, the player's NCH must animate the transfer. During STR combat, the player's hand fan coexists with the enemy's hand capsule without visual collision.

**Reference docs:** NCH-COMBAT-ROADMAP §2.1-2.4 (joker stack, hand fan, halo ring, collapse animation)

### 4.1 — Card Acquisition Animation (Steal Result)

When a stolen card enters the player's hand (from either pre-combat interchange or in-combat steal):

```
T+0ms:    Card arrives at player NCH boundary (from enemy capsule direction)
T+0ms:    NCH capsule joker stack count increments (new joker appears)
T+100ms:  New joker separates from stack, scales up
T+200ms:  If NCH is expanded: card slides into hand fan at position 0 (front)
          If NCH is minimized: joker lands on top of stack with bounce
T+400ms:  Card face reveal: joker flips to show actual card emoji + name
T+600ms:  Toast: "Acquired [card name]!"
```

### 4.2 — Card Departure Animation (Plant Action)

When a card leaves the player's hand for planting:

```
T+0ms:    Card lifts from hand fan slot (scale 1.1x, slight rotation)
T+100ms:  Remaining cards in hand fan close the gap (200ms reflow)
T+200ms:  Card ghost flies toward enemy capsule direction
T+400ms:  Card flips to joker back (hidden from enemy perspective)
T+500ms:  Hand count decrements in NCH capsule stack
```

### 4.3 — Combat Layout: Player Hand + Enemy Hand Coexistence

During STR combat, both the player's hand fan (bottom) and the enemy's hand capsule (top, in backup scroll space per NCH-COMBAT-ROADMAP §1.5) must coexist:

```
┌─────────────────────────────────────┐
│  ENEMY HAND CAPSULE (top)           │
│  🃏  🃏  🃏  💀  ░░                │  ← backup scroll space (repurposed)
│                                      │
│  ┌──── STR COMBAT WINDOW ────────┐  │
│  │  Timer  |  HP Bars  | Intent  │  │
│  └───────────────────────────────┘  │
│                                      │
│  PLAYER HAND FAN (bottom)           │
│  [card] [card] [card] [card] [card] │  ← hand fan component
│                                      │
│  LEFT COLUMN                        │
│  [1][2][3][4][5][DRAW]              │  ← rogue sidebar (backup top 5 + draw) not on actual STR window but in terminal HUD
└─────────────────────────────────────┘
```

The enemy hand capsule occupies the space where the backup scroll halo would normally be. This is already specified in NCH-COMBAT-ROADMAP §1.5 ("Backup scroll space in combat → display enemy hand"). Phase 4 ensures the layout doesn't break when both are rendered simultaneously.

### 4.4 — Transition Animations: Exploration → Combat

When STR combat begins:
1. Enemy capsule on map dissolves (fade out from map position)
2. Enemy hand capsule fades in at backup scroll space position (top of combat area)
3. Player NCH minimizes to joker stack (existing behavior)
4. Player hand fan expands from joker stack (existing combat entry behavior)

When STR combat ends:
1. Enemy hand capsule dissolves (fade out)
2. If enemy survived: enemy capsule re-renders on map at enemy's tile (with updated stolen/destroyed slots)
3. Player hand fan collapses to joker stack (existing combat exit behavior)
4. Player NCH restores to exploration mode

**Files touched:**
- Modified: `public/js/non-combat-hud.js` — steal/plant card flight animations
- Modified: `public/js/hand-fan-component.js` — card acquisition/departure hooks
- Modified: `public/js/str-combat-integration.js` — layout management for dual hand display
- Modified: `public/css/non-combat-hud.css` — card flight keyframes
- Modified: `public/js/enemy-capsule-renderer.js` — combat enter/exit transitions

---

## Phase 5 — Item & Card Integration

**Goal:** Wire specific items and cards to the new interaction surfaces. Define which items enable steal, plant, reveal, and trigger actions across both exploration and combat contexts.

**Reference docs:** THEFT_MECHANICS.md (steal tools), EXPLOSIVE_BREAKABLES_ROADMAP §5.2-5.5 (explosive inventories), ENEMY_CARDS Phase 5 (Information Duel items)

### 5.1 — Item Tag Schema Extension

Add `plantTags` to the item schema alongside existing `stealTags`, `revealTags`, `destroyTags`:

```json
{
  "id": "ITM-006",
  "name": "Pickpocket Gloves",
  "stealTags": ["pickpocket", "sleight"],
  "plantTags": ["pickpocket", "sleight"],
  "revealTags": [],
  "destroyTags": []
}
```

Items with `plantTags` enable the plant mechanic. Tag matching works identically to steal: `plantTags` must intersect `enemy.exposedTags`.

New/updated items for the interaction pipeline:

| Item | stealTags | plantTags | revealTags | destroyTags | Notes |
|------|-----------|-----------|------------|-------------|-------|
| ITM-006 Pickpocket Gloves | pickpocket, sleight | pickpocket, sleight | — | — | Core steal+plant tool |
| ITM-007 Scout Scope | — | — | recon, surveillance | — | Reveal only |
| ITM-008 EMP Disruptor | — | — | — | hack, electronic | Destroy only |
| ITM-070 Thermal Goggles | — | — | thermal, recon | — | Reveal + auto-reveal |
| ITM-087 Pattern Lens | — | — | momentum | — | See momentum, auto-reveal at M3+ |
| ITM-090 Scrambler Chip | — | — | — | — | +1 interaction charge/turn |

### 5.2 — Explosive Card Plant Flow

Per EXPLOSIVE_BREAKABLES_ROADMAP §5.3, the full pickpocket-to-detonate loop:

**Pre-combat (interchange UI):**
1. Player has FRAG_GRENADE/PIPE_BOMB/C4_CHARGE in hand
2. Player initiates steal on adjacent UNAWARE enemy
3. Interchange opens — player drags explosive card from hand to enemy empty slot
4. Plant animation plays, card inserted as `planted: { cardId: 'ACT-FRAG-GRENADE', ... }`
5. Interchange closes

**In STR combat:**
1. Enemy hand shows planted card with orange glow
2. Player clicks planted card slot → "TRIGGER" action (if Pickpocket Gloves equipped)
3. Explosive detonates: card damage applied to enemy, screen shake, VFX
4. OR: enemy plays the card on their turn → self-inflicted explosive damage

### 5.3 — Validator Update

Extend `tools/validate-items.js` to check new tag arrays:

```javascript
// New checks:
case 'plantTags':
  if (!Array.isArray(item.plantTags))
    warn(item.id + ' plantTags should be an array');
  break;
```

Also add `plantTags` to the effect editor EFFECT_REGISTRY in `portal/item-designer.html` so designers can configure plant tags visually.

**Files touched:**
- Modified: `public/data/gone-rogue/items.json` — add `plantTags` to relevant items
- Modified: `tools/validate-items.js` — plantTags validation
- Modified: `public/portal/item-designer.html` — plantTags field in editor
- Modified: `public/js/enemy-card-interactability.js` — check `plantTags` for plant eligibility
- Modified: `public/js/enemy-card-interaction-handler.js` — trigger action for planted explosives

---

## Phase 6 — Polish & Integration

### 6.1 — MOK Interjections

| Event | MOK Line |
|-------|----------|
| Successful steal (exploration) | "Nice fingers. That card's yours now." |
| Successful plant (exploration) | "Planted. Now we wait..." |
| Plant triggered (combat, manual) | "BOOM! Your little surprise just went off." |
| Plant triggered (combat, enemy played) | "Ha! They played your trap!" |
| Steal in combat | "CARD SEIZED! That's ours now." |
| Failed steal (no tag match) | "Can't get at those cards. Wrong tools." |
| Enemy plays after steal | "They noticed something missing..." |

### 6.2 — Tooltip & Overhead Telegraphing

Per EXPLOSIVE_BREAKABLES_ROADMAP §5.5:
- Enemies with explosive cards in inventory show `💣` overhead when player has Pickpocket Gloves equipped and is within sight range
- Enemies with empty slots (plantable) show a dim `░` overhead indicator
- In combat, planted card slots show persistent `💣` indicator on the card node

### 6.3 — Sound Design Hooks

```javascript
// Placeholders for future audio:
AudioSystem.play('card_steal', { volume: 0.6 });
AudioSystem.play('card_plant', { volume: 0.5 });
AudioSystem.play('plant_trigger_explosive', { volume: 1.0 });
AudioSystem.play('plant_trigger_fizzle', { volume: 0.3 });
AudioSystem.play('interchange_open', { volume: 0.4 });
AudioSystem.play('interchange_close', { volume: 0.3 });
```

### 6.4 — Script Load Order

New scripts in `index.html` (after existing enemy system scripts):

```html
<script src="js/enemy-capsule-renderer.js"></script>
<script src="js/nch-interchange.js"></script>
```

---

## Dependency Graph

```
Phase 1 (Enemy Capsule)           Phase 2 (Interchange)           Phase 3 (Combat Hand)

1.1 Capsule renderer ──────────→ 2.1 Interchange trigger          3.1 NCH-style combat layout
    │                                 │                                │
1.2 Capsule interactability ───→ 2.2 Side-by-side layout          3.2 Planted card triggers
    │                                 │                                │
1.3 plantSlots data ───────────→ 2.3 Steal drag animation ──────→ 3.3 Round refresh
                                      │                                │
                                 2.4 Plant drag animation ──────→ 3.4 Enemy card play animation
                                      │
                                 2.5 Interaction budget

Phase 4 (Player NCH Adjust)      Phase 5 (Items)                 Phase 6 (Polish)

4.1 Card acquisition anim ←───── 5.1 plantTags schema             6.1 MOK interjections
4.2 Card departure anim   ←───── 5.2 Explosive plant flow         6.2 Tooltip/overhead
4.3 Combat dual layout    ←───── 5.3 Validator update             6.3 Sound hooks
4.4 Explore↔combat transition                                     6.4 Load order
```

**Critical path:** Phase 1 → Phase 2 → Phase 3 (sequential — each builds on the previous)
**Parallel work:** Phase 4 can start after Phase 2. Phase 5 can start after Phase 1.3. Phase 6 starts after Phase 3.

---

## New Files Summary

| File | Phase | Purpose |
|------|-------|---------|
| `public/js/enemy-capsule-renderer.js` | 1.1 | Renders joker-stack capsule above enemies on map |
| `public/css/enemy-capsule.css` | 1.1 | Capsule positioning, joker sizing, interactability states |
| `public/js/nch-interchange.js` | 2.1 | Side-by-side steal/plant UI overlay |
| `public/css/nch-interchange.css` | 2.2 | Interchange layout, drag zones, card flight animations |

## Modified Files Summary

| File | Phase(s) | Changes |
|------|----------|---------|
| `gone-rogue.js` | 1.1 | Render enemy capsules in `_renderEnemies()` |
| `enemy-card-interactability.js` | 1.2, 3.3 | Add `computePreCombat()`, add plant eligibility check |
| `enemy-deck-hydrator.js` | 1.3 | Default `planted: null` on hydration |
| `gamestate.js` | 1.3, 2.3 | Add `plantCardOnEnemy()`, `removeFromHand()` |
| `enemy-steal-system.js` | 2.1 | Open interchange instead of instant resolve |
| `card-state-authority.js` | 2.3 | Emit events on plant/steal from interchange |
| `non-combat-hud.js` | 2.2, 4.1-4.2 | Interchange-mode expansion, card flight animations |
| `enemy-hand-display.js` | 3.1, 3.4 | NCH-capsule layout, planted card rendering, play animation |
| `enemy-hand-display.css` | 3.1 | Capsule layout, planted glow, play animation keyframes |
| `enemy-card-interaction-handler.js` | 3.2, 5.2 | Planted card trigger action, explosive detonation |
| `str-combat-integration.js` | 3.3, 4.3 | Planted card tracking, round refresh, dual hand layout |
| `str-combat-window.js` | 3.1 | Allocate space for capsule-style enemy hand |
| `hand-fan-component.js` | 4.1-4.2 | Card acquisition/departure hooks |
| `enemy-capsule-renderer.js` | 4.4 | Combat enter/exit transitions |
| `items.json` | 5.1 | Add `plantTags` to relevant items |
| `validate-items.js` | 5.3 | plantTags validation |
| `portal/item-designer.html` | 5.3 | plantTags field in editor |
| `index.html` | 6.4 | New script tags |

---

## Testing Checklist

### After Phase 1:
- [ ] Enemy capsule appears above enemies with hydrated decks on map
- [ ] Capsule joker count matches non-stolen cards in `enemy.cardDeck`
- [ ] Capsule fades in/out based on player proximity (4-tile range)
- [ ] Capsule hidden during STR combat
- [ ] Jokers show BLVCK (greyed) when player has no matching steal tool
- [ ] Jokers pulse green when player has Pickpocket Gloves with matching tags
- [ ] Empty slots visible with dim plant indicator when tool equipped
- [ ] `plantSlots` data structure persists through save/load

### After Phase 2:
- [ ] STEAL command opens interchange overlay (not instant resolve)
- [ ] Player hand and enemy hand render side-by-side
- [ ] Drag enemy joker → player hand = steal (card transfers)
- [ ] Drag player card → enemy empty slot = plant (card transfers)
- [ ] Cannot plant into occupied enemy slots
- [ ] Cannot steal non-interactable cards
- [ ] Action budget limits interactions (default 1, Scrambler Chip = 2)
- [ ] Interchange closes on CONFIRM or budget exhaustion
- [ ] Enemy awareness check fires on close (20% SUSPICIOUS)
- [ ] Steal/plant animations play smoothly (no flicker)
- [ ] Game pauses during interchange (no enemy movement)

### After Phase 3:
- [ ] STR combat enemy hand renders as NCH-capsule-style layout
- [ ] Planted cards show orange glow in combat enemy hand
- [ ] Clicking planted explosive → trigger action → damage to enemy
- [ ] Enemy playing planted card → fizzle (non-explosive) or self-damage (explosive)
- [ ] Interactability refreshes each round
- [ ] Momentum dots render per-slot
- [ ] Enemy card play animation: lift → flip → fly → resolve → consumed
- [ ] Destroyed/stolen slots show 💀
- [ ] Charges, escalation, mutation from InformationDuelEngine still work

### After Phase 4:
- [ ] Card acquisition animation: card flies from enemy direction into player NCH
- [ ] Card departure animation: card flies from player NCH toward enemy
- [ ] Combat layout: player hand fan (bottom) + enemy hand capsule (top) coexist
- [ ] No visual overlap between player and enemy hands
- [ ] Exploration → combat transition: map capsule dissolves, combat capsule fades in
- [ ] Combat → exploration transition: combat capsule dissolves, map capsule restores

### After Phase 5:
- [ ] Pickpocket Gloves enable both steal AND plant
- [ ] `plantTags` field in items.json validates correctly
- [ ] Explosive cards plantable and triggerable
- [ ] Non-explosive planted cards fizzle when enemy plays them
- [ ] Item designer shows plantTags field
- [ ] Validator catches missing plantTags arrays

### After Phase 6:
- [ ] MOK interjections fire for all steal/plant/trigger events
- [ ] 💣 overhead shows on enemies carrying explosives (when player has gloves)
- [ ] Tooltips show on hover for all enemy card states
- [ ] No console errors on any interaction path
- [ ] Scripts load in correct order

---

## Cross-References

- [NCH-COMBAT-ROADMAP.md](./NCH-COMBAT-ROADMAP.md) — §1.5 (mode-gated enemy hand), §2.1 (joker stack)
- [ENEMY_CARDS.md](./ENEMY_CARDS.md) — Phase 0-5 (enemy card database through Information Duel)
- [THEFT_MECHANICS.md](./THEFT_MECHANICS.md) — Pre-combat steal flow, tag matching
- [EXPLOSIVE_BREAKABLES_ROADMAP.md](./EXPLOSIVE_BREAKABLES_ROADMAP.md) — §5.2-5.5 (explosive plant + combat trigger)
- [ENEMY_AI.md](./ENEMY_AI.md) — §4 (steal as silent takedown), §1.3 (investigation behavior)
- [ITEM-PIPELINE-ROADMAP.md](../ITEM-PIPELINE-ROADMAP.md) — Item schema, designer portal, validator
- [UI-CANON.md](./UI-CANON.md) — ASCII layout diagrams, container modes

---

*Document Version: 1.0*
*Created: 2026-03-03*
*Status: Roadmap — no implementation yet*
*Philosophy: Unify visual language across player and enemy card surfaces. The enemy's cards should feel like "their NCH" that the player can infiltrate.*
