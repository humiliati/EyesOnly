# NCH ↔ Combat Card System Roadmap

**Two-phase plan to fix state bindings and rebuild animations**

---

## Architecture Snapshot

| Container | Cards | Accessibility |
|---|---|---|

| **Hand Fan** IN GONE ROGUE MINIGAME NOT COMBAT | 5 [expandable w/ items] | default minimized in gone rogue minigame, minimizes to bottom right NCH capsule overlay joker.emoji stack |
| **Hand Fan** STR-COMBAT | 5 [expandable w/ items] | default visible unless turn is resolving (attacks animating on enemy or player (timer hit zero)) in which case it's temporarily minimized to bottom right like nch animation collapse |

| **Left Column** IN GONE ROGUE MINIGAME NOT COMBAT (backup deck top) | 6 button slots (top 5 cards + a single items.inventory/backup.card containers swapper button) | Full access |
| **Left Column** STR-COMBAT (backup deck top redacted) | 6 button slots (top 5 cards possible to draw + a single drawx[variable based on items, default 1] button) | default draw button grabs any one of any visible cards from deck top in STR-combat. dragging and dropping on any card container behaves like the draw button[variable, based on items (true joker item toggled from equipped item slot = draw anywhere from the deck not just top cards) (magifying glass item toggled from equipped item slot = draw exactly the card you're selecting from the deck top, or a true joker from anywhere in the deck with the draw button)] |

| **Backup Scroll** IN GONE ROGUE MINIGAME NOT COMBAT (full deck) | 25 [expandable w/ items] | Fully expands out of combat when maximized (NCH) |
| **Backup Scroll** STR-COMBAT (locked, invisible, interface with deck through backup deck top redacted) | # of attack cards enemy is holding (using) | backup scroll space is TO BE used in STR combat to show enemy hand without hiding/covering enemy intent patterns. the enemy cards display as hidden by default, "back of the card" joker.emojis that can be revealed or stolen or destroyed with items  | 



### State Modes

```
NCH (Non-Combat)          STR-Combat
┌─────────────────┐       ┌─────────────────┐
│ Backup Scroll    │       │ ██ LOCKED ██    │
│  (halo ring)     │       │ (enemy Hand fan)│
│ Hand Fan         │       │ Hand Fan        │
│  (full interact) │       │  (play cards)   │
│ Left Column      │       │ Left Column     │
│  (full manage)   │       │  (draw 1 only)  │
└─────────────────┘       └─────────────────┘
```

---

## Root Cause Analysis

The regressions stem from **three competing state sources** with no single authority:

1. `NonCombatStateStore.backupCards` / `.cardsInHand` — NCH reads from here
2. `GAMESTATE.getCardsInHand()` / `.backupCards` — Combat hand fan reads from here
3. `BackupActionContainer._cards` / `._slots` — Left column maintains its own local copy

There is no reconciliation layer. When the mode flips between NCH and STR-combat, each component snapshots its own state independently, so edits made in one (drag reorder in NCH, draw in combat) are invisible to the others.

The "draw row" appearing in NCH-maximized is a symptom: the NCH rebuild path doesn't gate UI elements by mode, so combat-only affordances bleed through.

---

## Phase 1 — Bindings Check (State & Sync)

**Goal:** Every component reads from one canonical source. Drag, drop, draw, and reorder operations propagate correctly across all containers in both modes. No UI elements appear outside their correct mode.

### 1.1 — Unify Card State Authority

**Single source of truth:** `GAMESTATE` becomes the only authority for both hand and backup deck contents. `NonCombatStateStore` becomes a read-through cache that subscribes to `GAMESTATE` change events.

**Files touched:**
- `non-combat-hud.js` — replace direct `NonCombatStateStore` card mutations with `GAMESTATE` writes
- `str-combat-integration.js` — remove redundant card expansion; read canonical hand directly
- `backup-action-container.js` — replace `_cards` local array with `GAMESTATE.backupCards` slice

**Deliverable:** Single `CardStateAuthority` module that wraps `GAMESTATE` card arrays and emits change events.

### 1.2 — Left Column ↔ Backup Deck Sync (Mode-Aware Slot 6)

**Problem:** Left column slots are populated independently of the backup scroll order, and slot 6 behavior differs by mode but isn't gated.

**Fix:**
- Slots 1-5 always render `GAMESTATE.backupCards.slice(0, 5)` as thumbnail buttons in both modes.
- **Slot 6 in NCH:** Items.inventory / backup.card containers **swapper** button — toggles what the left column is browsing (equipped items vs backup deck cards). No draw behavior.
- **Slot 6 in STR-Combat:** `drawx[N]` button where N defaults to 1, modified by equipped items:
  - **Default:** Draw button grabs any one of the 5 visible top cards (player picks which)
  - **True Joker item equipped:** Draw from *anywhere* in the full 25-card deck, not just top 5
  - **Magnifying Glass item equipped:** Draw *exactly* the card you select from the top 5, OR use the draw button to pull a true joker from anywhere in the deck
- Any reorder in NCH backup scroll writes back to `GAMESTATE.backupCards`, triggering left column re-render via event bus.
- Dragging and dropping onto any card container in combat behaves like the draw button (with the same item-variable rules).

**Files touched:**
- `backup-action-container.js` — rewrite to be a pure view of `GAMESTATE.backupCards[0..4]` + mode-switched slot 6
- `non-combat-event-bus.js` — add `backup:reorder`, `backup:draw`, `hand:update`, `slot6:swap` events
- `str-combat-integration.js` — wire equipped item checks for draw-modifier logic

### 1.3 — Drag & Drop Between Inventories (NCH)

**Problem:** Drag-and-drop between hand fan, backup scroll, and left column doesn't properly move cards.

**Fix:** Implement a `CardTransferManager` that handles all cross-container moves:

```
Transfer operations (NCH only):
  backup[i] → hand        (if hand.length < max)
  hand[i]   → backup[j]   (insert at position j)
  backup[i] → leftCol[j]  (reorder: swap positions in backup array)
  hand[i]   → map          (deploy ground effect, triggers minimize)
  backup[i] → map          (deploy ground effect, triggers minimize)
```

Each transfer writes to `GAMESTATE` arrays → event fires → all containers re-render.

**Files touched:**
- New: `card-transfer-manager.js`
- `hand-fan-component.js` — emit `transfer:request` on drop outside fan
- `non-combat-hud.js` — register drop zones, delegate to `CardTransferManager`
- `backup-action-container.js` — register as drop target for reorder

### 1.4 — Combat Draw Logic (Item-Modified)

**Problem:** Drawing from backup during combat doesn't respect deck order or item modifiers.

**Fix — three draw paths based on equipped item:**

1. **Default (no special item):** `drawFromBackup(selectedIndex)` — player picks any one of the visible top-5 cards. The chosen card is spliced from `GAMESTATE.backupCards`, remaining cards shift up. Left column re-renders.
2. **True Joker equipped:** `drawFromBackupAnywhere(selectedIndex)` — player can select from the *entire* 25-card deck (via the halo in NCH, or the draw button in combat which opens a temporary full-deck picker overlay). Chosen card spliced from wherever it sits in the array.
3. **Magnifying Glass equipped:** `drawExact(selectedIndex)` from top-5 (precise pick), OR `drawTrueJokerViaButton()` which searches full deck for a true joker card specifically.

- Per-turn draw count (`GAMESTATE.turnDrawsRemaining`, default 1, item-expandable) persists in `GAMESTATE`, not in integration module local var.
- Draw count resets via `GAMESTATE.resetTurnDraws()` on round change.

**Files touched:**
- `str-combat-integration.js` — replace `_lastRound` local tracking with `GAMESTATE.turnDrawsRemaining`
- `backup-action-container.js` — draw action routes through item-aware `GAMESTATE.drawBackupCard(index, mode)`
- New methods on GAMESTATE: `drawBackupCard(index, mode)`, `resetTurnDraws()`, `getEquippedDrawModifier()`

### 1.5 — Mode-Gated UI Elements

**Problem:** NCH maximized shows a "draw row" that should only exist in left column during STR-combat. Hand fan defaults to visible in GR but should default to minimized (joker stack).

**Fix:** Audit every DOM builder and gate with explicit mode checks:

```javascript
var mode = GAMESTATE.isStrCombatActive() ? 'combat' : 'gr';

if (mode === 'combat') {
  // Left column slot 6 = drawx[N] button (item-variable)
  // Backup scroll space = enemy hand (hidden joker backs)
  // Hand fan = visible by default, minimize during resolve phase
} else {
  // Left column slot 6 = inventory/backup swapper button
  // Backup scroll = full halo ring (player's 25 cards)
  // Hand fan = default MINIMIZED to joker stack, maximize on tap
}
```

**Backup scroll space in combat (new binding):**
- Repurposed to display **enemy hand** — count of cards matches `combatState.enemy.cardCount`
- Each enemy card renders as a hidden 🃏 "back of card" by default
- Items can **reveal** (flip face-up), **steal** (move to player hand), or **destroy** (remove from enemy hand) these cards
- Must not obscure enemy intent patterns already displayed in STR combat window

**Files touched:**
- `non-combat-hud.js` — remove/gate combat-only UI branches; set hand fan default to minimized in GR
- `str-combat-window.js` — ensure draw affordance lives exclusively in left column
- `str-combat-integration.js` — wire enemy card count into backup scroll space renderer
- New: enemy hand display logic (can live in `str-combat-window.js` or extracted to `enemy-hand-display.js`)

### 1.6 — Combat Cursor Ghost for Left Column Draw

**Problem:** During STR-combat, dragging from left column should show the card thumbnail as cursor ghost, not the default drag image.

**Fix:**
- On `pointerdown` of left column slot during combat, create a 60×84px card thumbnail clone, attach as drag image via `setDragImage()` or as a pointer-following element.
- On drop into hand fan, execute `GAMESTATE.drawBackupCard()` and animate card into fan.

**Files touched:**
- `backup-action-container.js` — add combat-mode drag handler with thumbnail ghost
- `hand-fan-component.js` — accept drop from left column during combat

---

## Phase 2 — Animations Check (Visual & Interaction)

**Goal:** NCH and combat visuals match the canon description. Minimize/maximize uses joker emoji stacks. Backup scroll renders as a halo ring. All transitions are smooth and interruptible.

### 2.1 — Joker Emoji Minimize Stack

**Problem:** Minimize/maximize toggle needs to show as overlapping joker emojis matching card count.

**Implementation:**
- When NCH is minimized, render `N` overlapping 🃏 emojis (where N = `cardsInHand.length`) using the "pancake stacker" effect: each offset by 3px right and 2px down, with slight rotation jitter (±5°).
- Clicking the stack maximizes NCH.
- Stack pulses gently (scale 1.0→1.05 at 2s interval) to indicate interactivity.

```css
.joker-stack-item {
  position: absolute;
  font-size: 28px;
  transition: transform 0.2s ease;
}
.joker-stack-item:nth-child(1) { transform: translate(0, 0) rotate(-3deg); }
.joker-stack-item:nth-child(2) { transform: translate(3px, 2px) rotate(1deg); }
.joker-stack-item:nth-child(3) { transform: translate(6px, 4px) rotate(-2deg); }
/* ... up to 5 */
```

**Files touched:**
- `non-combat-hud.js` — replace capsule minimize with joker stack renderer
- `non-combat-hud.css` — joker stack styles + pancake stacker keyframes

### 2.2 — NCH Hand Fan (Matching Combat Fan)

**Problem:** NCH needs an animated hand fan identical to the STR-combat fan.

**Fix:** Extract `HandFanComponent` rendering logic into a shared `HandFanRenderer` that both combat and NCH instantiate:

- Same radial layout, 30% overlap, hover lift
- NCH fan is interactive for drag-reorder (combat fan is play-only)
- NCH fan cards show full affordability and can be dragged to backup or map

**Files touched:**
- New: `hand-fan-renderer.js` (extracted from `hand-fan-component.js`)
- `hand-fan-component.js` — delegates to `HandFanRenderer` for DOM + layout
- `non-combat-hud.js` — instantiates `HandFanRenderer` for NCH hand display

### 2.3 — Backup Scroll Halo Ring

**Problem:** Backup deck in NCH should render as a ring/halo of cards above the hand fan.

**Implementation:**
- 25 cards arranged in a curved arc (180° semicircle or full ring depending on count)
- Nearest card to deck-top faces camera at full size, cards descend to the right with increasing perspective tilt and decreasing scale
- Horizontal drag scrolls the halo (carousel behavior), snapping to nearest card
- Each card is individually draggable from the halo to: left column slot, hand fan, or map

```
         ┌──┐
       ┌─┤05├─┐
     ┌─┤04├──┤06├─┐
   ┌─┤03├──┘  └──┤07├─┐
 ┌─┤02├──┘        └──┤08├─┐
 │01│                  │09│  ← halo arc
 └──┘                  └──┘
        [HAND FAN]
```

**Interaction model:**
- Swipe/drag horizontally to scroll through all 25
- Tap a card to select → shows detail popover
- Drag a card downward to hand fan → `CardTransferManager.backupToHand(i)`
- Drag a card to left column → `CardTransferManager.reorderBackup(i, slotJ)`
- Drag a card to map (behind NCH) → triggers 2.4 collapse animation

**Files touched:**
- New: `backup-halo-renderer.js`
- `non-combat-hud.js` — replace solitaire tableau with halo renderer
- `non-combat-hud.css` — halo arc layout, perspective transforms, scroll snap

### 2.4 — Map Deploy Collapse Animation

**Problem:** When dragging a card to the map (behind NCH), the NCH should minimize and the backup halo should animate collapsing toward the left column.

**Animation sequence (≈600ms total):**

```
T+0ms:    Card drag crosses NCH boundary → animation starts
T+0ms:    Hand fan begins shrinking toward joker stack position
T+200ms:  Halo cards begin cascading toward left column (staggered, 20ms each)
T+400ms:  Hand fan replaced by joker emoji stack (pancake stacker)
T+500ms:  Last halo card reaches left column
T+600ms:  NCH is fully minimized, map is fully visible
          Dragged card ghost follows cursor to map tile
T+drop:   Ground effect deploys, card consumed from source inventory
```

**Reverse (maximize):** Joker stack tap → stack expands outward into fan (200ms) → halo rises from left column into arc (300ms).

**Files touched:**
- `non-combat-hud.js` — orchestrate collapse/expand sequence
- `non-combat-hud.css` — collapse keyframes, halo-to-leftcol trajectory
- `hand-fan-renderer.js` — fan↔stack morph transition
- `backup-halo-renderer.js` — halo↔leftcol morph transition

### 2.5 — Left Column Combat Mode (Thumbnails + Draw UX)

**Problem:** During combat, left column needs distinct visual treatment and item-aware draw interactions.

**Implementation:**
- Combat mode: slots 1-5 render 60×84px card thumbnails (mini art + cost pip) showing the top 5 drawable backup cards
- Slot 6 = pulsing `DRAW x[N]` indicator where N reflects equipped item modifier (default 1)
- **Default draw:** Click/tap any of slots 1-5 OR the draw button to pull that card into hand. The draw button picks any one visible card (player's choice via tap).
- **True Joker equipped:** Draw button opens a temporary overlay showing full deck; player picks any card
- **Magnifying Glass equipped:** Tap a specific slot 1-5 to draw exactly that card; draw button searches for a true joker specifically
- Dragging from slot onto any card container (hand fan) behaves like the draw button with the same item rules
- Ghost thumbnail (60×84px) follows cursor during drag

**Hand fan resolve-phase minimize:**
- During attack animation (timer hit zero, resolve phase), hand fan temporarily collapses to bottom-right joker stack (same animation as NCH collapse from 2.4)
- Restores to visible after resolve completes

**Files touched:**
- `backup-action-container.js` — dual render mode (full buttons NCH / thumbnails combat) + item-aware draw routing
- `backup-action-container.css` — thumbnail layout + combat-mode overrides
- `hand-fan-component.js` — resolve-phase temporary minimize trigger

---

## Dependency Graph

```
Phase 1 (Bindings)                    Phase 2 (Animations)

1.1 CardStateAuthority ──────────┐
  │                              │
  ├─→ 1.2 Left Col Sync         │
  │     │                        │
  │     ├─→ 1.4 Combat Draw     ├──→ 2.5 Left Col Thumbnails
  │     │                        │
  │     └─→ 1.3 Drag & Drop ────├──→ 2.3 Backup Halo Ring
  │           │                  │      │
  │           └──────────────────├──→ 2.4 Map Deploy Collapse
  │                              │      │
  ├─→ 1.5 Mode-Gated UI ────────├──→ 2.1 Joker Minimize Stack
  │                              │      │
  └─→ 1.6 Cursor Ghost ─────────┘    2.2 NCH Hand Fan Renderer
                                        │
                                      (all 2.x depend on 1.x being stable)
```

---

## New Files Summary

| File | Phase | Purpose |
|---|---|---|
| `card-state-authority.js` | 1.1 | Single source of truth wrapper around GAMESTATE |
| `card-transfer-manager.js` | 1.3 | Cross-container drag/drop operations |
| `enemy-hand-display.js` | 1.5 | Enemy hidden cards in backup scroll space during combat |
| `hand-fan-renderer.js` | 2.2 | Shared fan layout logic (combat + NCH) |
| `backup-halo-renderer.js` | 2.3 | Halo/ring renderer for backup scroll |

## Modified Files Summary

| File | Phase(s) | Changes |
|---|---|---|
| `non-combat-hud.js` | 1.1, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4 | Heaviest changes — state source swap, new renderers, collapse anim |
| `non-combat-hud.css` | 2.1, 2.3, 2.4 | Joker stack, halo arc, collapse keyframes |
| `backup-action-container.js` | 1.2, 1.4, 1.6, 2.5 | Rewrite as GAMESTATE view + dual render mode |
| `backup-action-container.css` | 2.5 | Combat thumbnail styles |
| `hand-fan-component.js` | 1.3, 1.6, 2.2 | Drop zone registration, delegate to shared renderer |
| `str-combat-integration.js` | 1.1, 1.4 | Remove local state, use CardStateAuthority |
| `non-combat-event-bus.js` | 1.2 | New event types for backup/hand sync |

---

## Regression Prevention

**Why things keep breaking:** Changes to one component's state don't propagate because there's no shared event contract. A fix to NCH drag-drop inadvertently changes when `_cards` is mutated in the left column, which breaks combat draw order.

**Phase 1 solves this structurally** by making `CardStateAuthority` the only write path. Components become pure views that re-render on events. No component holds mutable card state locally.

**Testing checkpoints after Phase 1:**
- [ ] NCH hand fan shows same cards as `GAMESTATE.getCardsInHand()`
- [ ] Left column slots 1-5 match `GAMESTATE.backupCards[0..4]` at all times
- [ ] NCH slot 6 = inventory/backup swapper (no draw behavior)
- [ ] Combat slot 6 = drawx1 button (default, no items)
- [ ] Combat draw: tap any slot 1-5 picks that specific card into hand
- [ ] True Joker equipped: draw button opens full deck picker
- [ ] Magnifying Glass equipped: tap slot = exact pick; draw button = find true joker
- [ ] Drag card from backup to hand in NCH → both containers update
- [ ] Enter combat → hand fan shows pre-arranged hand, left column shows backup top
- [ ] Enter combat → backup scroll space shows enemy hidden cards (🃏 backs)
- [ ] Exit combat → NCH reflects all changes made during combat
- [ ] No "draw row" visible anywhere in NCH
- [ ] Hand fan defaults to minimized (joker stack) in GR non-combat

**Testing checkpoints after Phase 2:**
- [ ] NCH minimize shows joker stack with correct card count
- [ ] NCH maximize expands joker stack into hand fan + halo
- [ ] Halo scrolls horizontally through all 25 backup cards
- [ ] Drag from halo to hand fan transfers card
- [ ] Drag from halo/hand to map triggers collapse animation
- [ ] Collapse animation completes in ≤600ms without jank
- [ ] Left column shows thumbnails during combat, full buttons in NCH
- [ ] Combat draw from left column shows thumbnail ghost cursor
- [ ] Hand fan temporarily minimizes during resolve phase (attacks animating)
- [ ] Hand fan restores after resolve completes
- [ ] Enemy cards in backup scroll space can be revealed/stolen/destroyed with items
