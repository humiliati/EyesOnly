# STR Combat Drag Unification Roadmap

**EYES ONLY — Gone Rogue Engine**
**March 2026 · v1.0**

Cross-refs: CARD_HAND_HARMONIZATION_ROADMAP, ENEMY_NCH_INTERACTION_ROADMAP, HAND_FAN_AND_CARD_DEPLOYMENT, DRAG_DROP_UX_SUMMARY

---

## The Problem: Three Drag Systems, One Card

A player click+drags a card in STR combat and three independent systems compete for control:

| System | Trigger | Purpose | Minimize Logic | Ghost/Visual |
|---|---|---|---|---|
| **Pointer-hold targeting** | `pointerdown` → 180ms hold → `pointermove` | Play on enemy, deploy ground effect | Velocity ≥800px/s OR distance ≥15% of STR window | Crosshair cursor, AoE preview, enemy glow |
| **HTML5 drag (disposal)** | `dragstart` on `draggable="true"` wrapper | Drag to debrief feed (incinerate) or shop (sell) | 400ms dwell outside STR window | Browser ghost clone, dotted placeholder |
| **CardTransferManager** | HTML5 drag via NCH drop zones | Move between hand/backup/vault in NCH mode | N/A (NCH only) | `ctm-drop-highlight` zone glow |

When a player drags during STR combat, pointer-hold targeting AND HTML5 drag both activate from the same `pointerdown`. The velocity collapse fires instantly, minimizing the STR window. The `setMode('contextual','bottom')` call triggers a full DOM rebuild that destroys the drag placeholder, ghost clone, and hidden card wrapper. The player sees the hand fan rendered as a horizontal strip at the bottom — the "BLVCK bar" (Figure 1).

### Current Band-Aids (v=20260307b)

- `dragstart` cancels any active pointer-hold targeting (prevents velocity collapse)
- `setMode()` defers re-render when `_liftDrag.active` (prevents DOM destruction mid-drag)
- Ghost clone gets `cssText` override (prevents fan transforms making ghost look like a bar)

These patches stop the crash but don't fix the architecture. Two parallel systems still race.

---

## What Slay the Spire Does (Reference Model)

Slay the Spire's card interaction is clean because it uses ONE unified input model:

1. **Click a card** → card lifts up, follows cursor/finger, other cards spread apart
2. **Drag over enemy** → enemy highlights (targetable), release = play card on that enemy
3. **Drag over empty space / self** → AOE or self-targeting indicator appears
4. **Drag back to hand** → card returns to hand position, no effect
5. **Right-click** → inspect card (full art, text)
6. **No timer-based minimize** — the combat window IS the screen, there's no map underneath

Key differences from our game:
- We have a **map layer underneath** the STR combat window → need minimize/maximize flow
- We have **ground effects** → cards deploy to specific tiles, not just "on enemy"
- We have **card disposal** → drag to debrief feed to destroy
- We have **future enemy hand interactions** → drag cards INTO enemy's hand (plant mechanic)
- We have **NCH deck management** → drag between hand/backup/vault outside combat

So we need StS's clean drag UX PLUS our multi-layer minimize/deploy/dispose flow.

---

## Target Architecture: Unified Pointer Drag

Replace the three-system mess with **one pointer-based drag controller** that uses the same input fork for all contexts.

### The Single Input Model

```
pointerdown on card
  │
  ├─ tap (<200ms, <10px movement) → toggle card selection (existing)
  │
  └─ drag (>200ms OR >10px movement) → enter DRAG MODE
       │
       ├─ visual: card lifts out, placeholder holds slot, card follows cursor
       │
       ├─ while inside STR window:
       │    ├─ over enemy → enemy glow, release = play card on enemy
       │    ├─ over enemy hand slot → slot glow, release = plant card (future)
       │    ├─ over own hand → card returns to slot (cancel drag)
       │    └─ over backup draw zone → card moves to backup (future)
       │
       ├─ exits STR window (pointer leaves bounds + dwell ≥600ms):
       │    ├─ STR window minimizes with animation
       │    ├─ card ghost still follows cursor over map
       │    ├─ over grid cell → AoE preview, release = deploy ground effect
       │    ├─ over debrief feed → disposal glow, release = incinerate
       │    └─ release over nothing → card returns, STR maximizes
       │
       └─ dragend / pointerup:
            ├─ successful deploy → 500ms delay showing effect → STR maximizes
            ├─ successful incinerate → placeholder collapses → STR maximizes
            ├─ invalid drop → card animates back to slot → STR maximizes (if minimized)
            └─ drag cancelled → card returns to slot, state restored
```

### Why Pointer Events Instead of HTML5 Drag

HTML5 Drag & Drop is fundamentally broken for this use case:

- **No control over ghost** — browser renders its own translucent clone, can't update it live
- **0,0 coordinate bug** — `drag` events report (0,0) for off-screen, breaking hit detection
- **Cross-frame issues** — ghost can't follow cursor into different DOM layers (map under STR)
- **Touch inconsistency** — HTML5 drag barely works on mobile, requires polyfills
- **Can't cancel mid-drag** — `dragend` fires asynchronously, state cleanup is unreliable

Pointer events give us:
- Full cursor tracking with `pointermove` (reliable coordinates)
- A real DOM element following the cursor (not a browser ghost)
- `setPointerCapture` for guaranteed `pointerup` delivery
- Touch + mouse + pen support natively
- Ability to hit-test drop zones in real time with `document.elementFromPoint`

---

## Phase Plan

### Phase 0: Prep — Isolate and Stabilize (Current Session)

**Status: DONE (v=20260307b)**

- [x] `dragstart` cancels pointer-hold targeting (prevents velocity race)
- [x] `setMode()` defers during active `_liftDrag` (prevents DOM destruction)
- [x] Ghost clone `cssText` override (prevents fan transform inheritance)
- [ ] Add resolution guard: force-maximize STR before `_playResolutionSequence`

No new files. Patches live in `hand-fan-component.js` until Phase 1 replaces them.

### Phase 1: CardDragController — Single Pointer Drag System

**New file:** `public/js/card-drag-controller.js`

IIFE singleton `CardDragController`. Owns ALL card drag state globally.

**1.1 — Core drag lifecycle**

```
CardDragController = {
  _state: null,  // { cardId, cardIndex, sourceZone, ghostEl, placeholderEl,
                 //   startX, startY, pointerId, strMinimized, phase }

  beginDrag(cardEl, cardIndex, card, sourceZone, pointerEvent)
  updateDrag(pointerEvent)      // called on pointermove
  endDrag(pointerEvent)         // called on pointerup
  cancelDrag()                  // escape key or pointercancel

  isDragging()                  // → bool
  getState()                    // → current drag state
}
```

**1.2 — Ghost element (real DOM, not browser clone)**

- On `beginDrag`: clone card element, append to `document.body` with `position: fixed`, `pointer-events: none`, `z-index: 10000`
- On `updateDrag`: set ghost `left`/`top` to pointer coordinates (offset by grab point)
- On `endDrag`: animate ghost to target or back to placeholder, then remove
- Ghost inherits card appearance but strips fan transforms (rotate, translateY)
- Ghost at 90% scale with subtle drop shadow for "lifted" feel

**1.3 — Placeholder in hand fan**

- On `beginDrag`: insert dotted placeholder at card's position (reuse existing `.hand-card-drag-placeholder` CSS)
- Placeholder inherits fan transform + marginLeft + zIndex for exact slot match
- Original card wrapper hidden (`visibility: hidden` not positional — avoids layout shift)
- On successful deploy/incinerate: placeholder collapses (`.placeholder-collapsing`)
- On cancel: placeholder removed, original card wrapper restored

**1.4 — Drop zone registry**

Merge `CardTransferManager._dropZones` pattern into `CardDragController`:

```
CardDragController.registerDropZone(element, {
  id: 'enemy-avatar',         // unique zone name
  accepts: fn(dragState),     // → bool
  onDragOver: fn(dragState),  // visual feedback (glow, AoE preview)
  onDragLeave: fn(),          // remove feedback
  onDrop: fn(dragState),      // execute action (play, deploy, dispose, plant)
  contexts: ['combat']        // only active in these modes
});
```

Built-in zones registered at init:

| Zone ID | Element | Context | Action |
|---|---|---|---|
| `enemy-avatar` | `.str-combatant.str-enemy` | combat | Play card on enemy |
| `enemy-hand-slot` | `.enemy-hand-slot` | combat | Plant card (future) |
| `map-grid` | `#rogue-grid` | combat (minimized) | Deploy ground effect |
| `debrief-feed` | `#debrief-screen` | combat (minimized), exploration | Incinerate/discard |
| `hand-fan` | `#hand-fan-container` | combat, exploration | Return to hand (cancel) |
| `nch-hand` | `[data-dropzone="hand"]` | nch-open | Move to hand |
| `nch-backup` | `[data-dropzone="backup"]` | nch-open | Move to backup |
| `nch-vault` | `[data-dropzone="vault"]` | nch-open | Move to vault |
| `shop-sell` | `.shop-sell-zone` | shop-open | Sell card |

**1.5 — STR window minimize/maximize integration**

- `CardDragController` owns the minimize decision, not the drag handler
- Minimize triggers when pointer exits STR window bounds and dwells ≥600ms (configurable)
- Minimize is reversible: if pointer re-enters STR bounds before releasing, STR maximizes immediately
- On minimize: `STRCombatWindow.minimize()` called, but `HandFanComponent.setMode` is **blocked** (controller handles fan visibility)
- Fan stays in combat position with placeholder visible — does NOT reposition to bottom
- Ghost continues following cursor over map layer

### Phase 2: Wire Into HandFanComponent

**2.1 — Remove old drag systems from `_attachCardHandlers`**

Delete from `hand-fan-component.js`:
- The `dragstart` handler (lines 1140-1234) → replaced by CardDragController.beginDrag
- The `drag` handler (lines 1238-1268) → replaced by CardDragController.updateDrag
- The `dragend` handler (lines 1270-1350) → replaced by CardDragController.endDrag
- The `_html5DragCollapse` state object → replaced by CardDragController._state.strMinimized
- The `_liftDrag` state object → replaced by CardDragController._state

**2.2 — Merge pointer-hold targeting into CardDragController**

The `_beginHoldTargeting` function (lines 744-955) contains the actual card deployment logic:
- Enemy hit detection (`_isEnemyUnderPointer`)
- Ground effect deployment (AoE preview, GroundEffects.setGroundEffect)
- STR window collapse (`_maybeCollapseCombatUi`)
- Card consumption on successful deploy

Move all of this INTO `CardDragController` as zone callbacks:
- `_isEnemyUnderPointer` → `enemy-avatar` zone's `accepts` check
- Ground effect deployment → `map-grid` zone's `onDrop` callback
- AoE preview → `map-grid` zone's `onDragOver` callback
- Velocity collapse → removed (replaced by dwell-based minimize in Phase 1.5)

**2.3 — New `pointerdown` handler in HandFanComponent**

Replace the current dual `pointerdown` (hold timer + swipe detector) with:

```javascript
cardEl.addEventListener('pointerdown', function(e) {
  if (e.button !== 0) return;
  if (_mode !== 'combat') return;
  if (cardEl.dataset.unaffordable === 'true') return;

  var startX = e.clientX, startY = e.clientY;
  var pointerId = e.pointerId;
  var dragStarted = false;

  function onMove(ev) {
    if (ev.pointerId !== pointerId) return;
    var dx = ev.clientX - startX;
    var dy = ev.clientY - startY;
    if (!dragStarted && Math.sqrt(dx*dx + dy*dy) > 10) {
      dragStarted = true;
      CardDragController.beginDrag(cardEl, index, card, 'hand-fan', e);
    }
    if (dragStarted) {
      CardDragController.updateDrag(ev);
    }
  }

  function onUp(ev) {
    if (ev.pointerId !== pointerId) return;
    cleanup();
    if (dragStarted) {
      CardDragController.endDrag(ev);
    } else {
      // Tap — toggle selection
      _toggleCardSelection(index);
    }
  }

  function cleanup() {
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
  }

  function onCancel(ev) {
    cleanup();
    if (dragStarted) CardDragController.cancelDrag();
  }

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
});
```

**2.4 — Remove `draggable="true"` from card wrappers**

No more HTML5 drag. Card wrappers are plain `div`s. All drag is pointer-based.

### Phase 3: Retire Legacy Systems

**3.1 — CardDisposalSystem becomes a drop zone callback**

`CardDisposalSystem.handleDragStart/End/Drop` → absorbed into the `debrief-feed` drop zone's `onDrop`. The disposal validation logic (lifecycle checks, BLVCK guard, animation) stays but is called from `CardDragController` instead of from HTML5 drag events.

**3.2 — CommerceDragDropSystem becomes a drop zone callback**

Shop sell logic → `shop-sell` zone's `onDrop`. `DropZoneDetector` glow system → `CardDragController.registerDropZone.onDragOver`.

**3.3 — CardTransferManager merges into CardDragController**

The NCH drop zones (`nch-hand`, `nch-backup`, `nch-vault`) register via `CardDragController.registerDropZone`. The HTML5 drag listeners in `CardTransferManager` are deleted. The `CardStateAuthority` write-through logic stays in the zone callbacks.

**3.4 — Delete dead code**

- `_html5DragCollapse` object in hand-fan-component.js
- `_liftDrag` object in hand-fan-component.js
- `_beginHoldTargeting` function in hand-fan-component.js
- `_maybeCollapseCombatUi` function (nested in `_beginHoldTargeting`)
- HTML5 drag handlers (`dragstart`, `drag`, `dragend`) in `_attachCardHandlers`
- `CardTransferManager.js` → entirely replaced (or kept as thin wrapper calling CardDragController)

### Phase 4: Enemy Hand Interactions (Future — ENI Roadmap)

**4.1 — Enemy hand drop zones**

When enemy hand display is rendered in STR combat, register each enemy card slot as a drop zone:

```
CardDragController.registerDropZone(enemySlotEl, {
  id: 'enemy-hand-slot-' + i,
  accepts: fn(drag) { return drag.sourceZone === 'hand-fan' && isPlantableCard(drag.card); },
  onDragOver: fn() { /* glow slot, show "PLANT" label */ },
  onDrop: fn(drag) { /* execute plant mechanic via CardStateAuthority */ },
  contexts: ['combat']
});
```

**4.2 — Enemy card theft (drag FROM enemy hand)**

The reverse flow: player drags a card OUT of the enemy hand into their own hand. Same controller, different `sourceZone`:

```
CardDragController.beginDrag(enemyCardEl, enemyIndex, enemyCard, 'enemy-hand', pointerEvent);
```

The `hand-fan` and `nch-backup` zones accept cards from `enemy-hand` source.

### Phase 5: Polish and Edge Cases

**5.1 — Resolution guard**

At the start of `_playResolutionSequence` in `str-combat-integration.js`:
- If `STRCombatWindow.isMinimized()`, force `STRCombatWindow.maximize()` before running slide animations
- If `CardDragController.isDragging()`, force `CardDragController.cancelDrag()` before resolution

**5.2 — Timer expiry during drag**

If the STR timer expires while a card is being dragged:
- Cancel the drag (card returns to hand)
- Run normal timer expiry flow (`handleStrTimerExpired`)
- Visual: ghost snaps back to placeholder, then hand fan does its resolution slide-away

**5.3 — Swipe gestures**

The existing swipe detector (pointerdown → pointerup with vertical distance > 30px) stays as a separate gesture recognizer. It does NOT conflict with drag because drag requires >10px movement in any direction before activating, and swipe requires >30px vertical on quick release. The two are distinguished by hold duration and movement pattern.

**5.4 — Touch scroll disambiguation**

On mobile, vertical drag on a card could be confused with page scroll. Use `touch-action: none` on card elements during combat mode to prevent scroll interference. Already partially handled by pointer capture.

**5.5 — Keyboard shortcut (accessibility)**

Future: number keys 1-5 select cards, Enter commits, Escape cancels drag. Drag-to-target can be replaced by arrow-key targeting mode for keyboard users.

---

## File Impact Summary

| File | Action | Phase |
|---|---|---|
| `card-drag-controller.js` | **NEW** — unified drag singleton | 1 |
| `hand-fan-component.js` | Remove 3 drag systems, add pointer-based drag initiation | 2 |
| `card-disposal-system.js` | Convert to drop zone callback | 3 |
| `commerce-drag-drop-system.js` | Convert to drop zone callback | 3 |
| `card-transfer-manager.js` | Merge into CardDragController or thin wrapper | 3 |
| `drop-zone-detector.js` | Retire (replaced by CardDragController zone registry) | 3 |
| `str-combat-integration.js` | Add resolution guard (maximize + cancel drag) | 5 |
| `str-combat-window.js` | No changes (minimize/maximize API stays the same) | — |
| `non-combat-hud.js` | Register NCH zones via CardDragController instead of HTML5 | 3 |
| `index.html` | Add `card-drag-controller.js` script tag | 1 |

---

## Migration Strategy

Phases 1-2 can ship together as one PR. The new `CardDragController` is wired in, the old `dragstart`/`drag`/`dragend` handlers are deleted, and pointer-hold targeting is absorbed. This is the "big bang" — but scoped to `hand-fan-component.js` + 1 new file.

Phase 3 ships separately: each legacy system (CardDisposalSystem, CommerceDragDropSystem, CardTransferManager) is converted one at a time. Each conversion is independently testable.

Phases 4-5 ship with their parent roadmaps (ENI, CHH respectively).

---

## Anti-Patterns to Avoid

- **Never have two systems listening to the same `pointerdown`** on the same element for overlapping purposes. One controller, one state machine.
- **Never rebuild DOM during an active drag.** If mode changes are needed, defer them.
- **Never use HTML5 drag for gameplay interactions.** It was designed for file managers, not card games. Pointer events are the standard for game-like drag interactions.
- **Never use velocity-based collapse.** Dwell-based (time outside bounds) is predictable and reversible. Velocity checks fire on fast flicks and surprise the player.
- **Never minimize STR during resolution.** Force-maximize before running slide animations.
