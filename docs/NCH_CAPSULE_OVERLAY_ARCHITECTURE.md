# NCH Capsule Overlay Architecture — Intelligent Node System

### v1.0 — March 2026

---

## Purpose

This document describes the **dynamic capsule overlay** system that lives in `non-combat-hud.js`. The NCH capsule is a shared DOM surface (`#nch-capsule-wrapper` / `#nch-capsule-stack`) that can render in multiple **modes** — each mode replaces the capsule's joker stack with context-specific "intelligent nodes" while reusing the same DOM, positioning, drag behavior, and visibility logic.

The architecture is designed so that THEFT_MECHANICS.md, ENI (Enemy NCH Interaction), and future systems can plug in new capsule modes without touching the core NCH exploration rendering.

---

## Shared DOM Surface

```
#nch-capsule-wrapper        ← fixed-position pill, draggable by player
  #nch-capsule-stack        ← holds N overlapping joker <div>s
    .nch-capsule-joker.joker-0
    .nch-capsule-joker.joker-1
    ...joker-N
```

All capsule modes render into `#nch-capsule-stack`. The wrapper handles:

- Fixed positioning (player-draggable via `_capsuleDrag` state)
- Visibility polling (`_pollVisibility`, 350ms interval)
- Show/hide based on `GoneRogue.isActive()` and `STRCombatWindow.isVisible()`
- Signature-based render skipping (`stackEl.dataset.sig`)

Each mode owns its own `_render*()` function that writes to `#nch-capsule-stack`. The poll loop dispatches to the correct renderer based on which mode state object is non-null.

---

## Mode Dispatch (Current)

```
_pollVisibility():
  if (!rogueActive)           → hide everything
  if (_isExpanded && !combat)  → show expanded view, hide capsule
  else:
    if (_combatCapsule)        → _renderCombatCapsule()     ← CH mode
    else                       → _renderCapsule()           ← NCH mode (default)
```

### Adding a new mode

To add a new capsule overlay (e.g. enemy interchange, enemy map capsule):

1. Add a state variable at the top of the IIFE (next to `_combatCapsule`):
   ```javascript
   var _interchangeCapsule = null;
   // When active: { playerCards: [...], enemyCards: [...], ... }
   ```

2. Add a renderer function:
   ```javascript
   function _renderInterchangeCapsule() {
     if (!_capsule || !_interchangeCapsule) return;
     var stackEl = _capsule.querySelector('#nch-capsule-stack');
     if (!stackEl) return;
     // Build signature, skip if unchanged
     var sig = 'ix:' + /* fields */;
     if (stackEl.dataset.sig === sig) return;
     stackEl.dataset.sig = sig;
     stackEl.innerHTML = '';
     // Render intelligent nodes...
   }
   ```

3. Add the mode to `_pollVisibility()` dispatch:
   ```javascript
   if (_interchangeCapsule) {
     _renderInterchangeCapsule();
   } else if (_combatCapsule) {
     _renderCombatCapsule();
   } else {
     _renderCapsule();
   }
   ```

4. Add public API functions (`showInterchange`, `hideInterchange`, etc.) and expose them in the `return { ... }` block.

5. Call `hidePreviousMode()` before entering the new mode (each `show*` should null-out other mode state variables to prevent conflicts).

**Priority rule:** Only one mode can be active at a time. Higher-priority modes (interchange > combat > exploration) should null-out lower ones on entry. Lower-priority modes should no-op if a higher-priority mode is active.

---

## Mode Reference

### 1. NCH Mode (Exploration — Default)

**State:** `_combatCapsule === null` (no special state variable — this is the fallback)

**Renderer:** `_renderCapsule()`

**Behavior:** Renders one 🃏 per card in `CardStateAuthority.getCardsInHand()`. BLVCK cards (`ACT-000`) get `.nch-joker-greyed`. Stranded hands (all BLVCK, no usable cards) collapse to a single greyed joker.

**Signature format:** `count:stranded:blvckMap` — e.g. `5:0:00100`

**Joker classes:**

| Class | Meaning |
|-------|---------|
| `.nch-capsule-joker` | Base class, all jokers |
| `.joker-N` | Position index (0-7), controls left/top offset via CSS |
| `.nch-joker-greyed` | BLVCK / unusable card — grayscale + dim |

**Entry:** Automatic (default when no other mode is active).
**Exit:** Another mode activates, or game becomes inactive.

---

### 2. CH Mode (STR Combat Hand)

**State:** `_combatCapsule` object:
```javascript
{
  cards: [{ id, emoji, glyph, name, ... }, ...],  // current hand from CSA
  selectedIds: ['ACT-XXX', ...],                    // cards selected for resolution
  resolving: false,                                 // true during resolution animation
  timerPercent: 0.75                                // STR timer (1.0 = full, 0.0 = expired)
}
```

**Renderer:** `_renderCombatCapsule()`

**Behavior:** Each joker becomes an intelligent node. Selected cards reveal their actual `card.emoji` instead of 🃏. Resolving cards pulse. Timer colors the capsule outline.

**Signature format:** `ch:count:selectedIds:R|S:timerPct` — e.g. `ch:5:ACT-001,ACT-003:S:75`

**Joker classes (additive to base):**

| Class | Meaning |
|-------|---------|
| `.nch-joker-active` | Card is selected for play — shows card.emoji with green glow |
| `.nch-joker-resolving` | Card is resolving — adds pulse animation (green→gold) |
| `.nch-joker-greyed` | BLVCK card — same grey treatment as NCH mode |
| (no extra class) | Unselected non-BLVCK card — shows 🃏 in default style |

**Capsule-level classes:**

| Class | Meaning |
|-------|---------|
| `.nch-capsule-critical` | Timer < 20% — entire capsule pulses opacity |
| `.nch-capsule-flash` | Resolution edge — brief orange incinerator flash |

**Timer outline:** `_capsule.style.outline` set to `2px solid <color>` where color transitions green→teal→amber→orange→red based on `timerPercent` via `_timerColorForPercent()`.

**Public API:**

```javascript
NonCombatHUD.showCombatCapsule(cards, {
  selectedIds: ['ACT-001'],
  timerPercent: 0.65,
  resolving: false
});

NonCombatHUD.updateCombatCapsule({
  timerPercent: 0.40        // lightweight partial update
});

NonCombatHUD.flashCombatCapsule();  // resolution edge flash

NonCombatHUD.hideCombatCapsule();   // exit CH mode, return to NCH
```

**Entry:** Called by `str-combat-integration.js` on every 100ms poll tick during STR combat minimize.
**Exit:** `hideCombatCapsule()` called in `_hideHandFan()` when combat ends or hand fan re-expands.

**Caller pattern** (str-combat-integration.js):
```javascript
NonCombatHUD.showCombatCapsule(cards, {
  selectedIds: selectedIds,
  timerPercent: pct,
  resolving: !!isResolvingTurn
});
```

---

## Plugging In: ENI Enemy Capsule Mode

> This section describes the intended integration point for ENEMY_NCH_INTERACTION_ROADMAP.md Phase 2 (Interchange UI) and Phase 3 (STR Combat Enemy Hand).

### 3a. Interchange Mode (Exploration — Steal/Plant Surface)

**Proposed state:** `_interchangeCapsule`
```javascript
{
  mode: 'interchange',
  playerCards: [...],       // from CardStateAuthority.getCardsInHand()
  enemyCards: [...],        // from enemy.cardDeck
  enemyName: 'GUARD',
  actionsRemaining: 1,      // steal/plant budget
  dragSource: null,          // { side: 'player'|'enemy', index: N } during drag
  highlightedSlot: null      // drop target highlight
}
```

**Render approach:** The interchange needs TWO capsule surfaces (player + enemy) displayed simultaneously. Two approaches:

**Option A — Dual-stack in single wrapper:**
Render both card rows inside `#nch-capsule-stack` separated by a divider element. The capsule wrapper grows vertically to accommodate both rows. Minimal DOM changes.

```
#nch-capsule-stack
  .nch-interchange-row.enemy-row
    .nch-capsule-joker.joker-0  (enemy card)
    .nch-capsule-joker.joker-1  (enemy card, plantable)
    ...
  .nch-interchange-divider      (visual separator)
  .nch-interchange-row.player-row
    .nch-capsule-joker.joker-0  (player card)
    .nch-capsule-joker.joker-1  (player card)
    ...
```

**Option B — Separate overlay:**
Create a dedicated `#nch-interchange` container (like `#nch-expanded`) that renders above the capsule. The capsule itself stays in NCH mode (or hides). More DOM but cleaner separation.

**Recommended:** Option A for the capsule-minimized long-press view (§4 of THEFT_MECHANICS.md), Option B for the full interchange overlay (ENI Phase 2). Both should set `_interchangeCapsule` state so `_pollVisibility` keeps the capsule visible and blocks NCH/CH rendering.

**New joker classes needed:**

| Class | Meaning | Visual |
|-------|---------|--------|
| `.nch-joker-stealable` | Enemy card, player can steal | Green pulsing border |
| `.nch-joker-plantable` | Empty enemy slot, accepts plant | Orange pulsing border |
| `.nch-joker-stolen` | Previously stolen slot | 💀 emoji, `.nch-joker-greyed` |
| `.nch-joker-planted` | Player card inserted here | Card emoji + orange inner glow |
| `.nch-joker-dragging` | Currently being dragged | Scale 1.2x, reduced opacity at source |
| `.nch-joker-drop-target` | Valid drop target highlight | Bright border + scale pulse |
| `.nch-joker-locked` | Non-interactable (no matching tags) | Greyed + 🔒 overlay |

**Drag integration:** The existing `CardDragController` (CDC) should register interchange drop zones dynamically when the interchange opens:

```javascript
// On interchange open:
CardDragController.registerDropZone(enemyRowEl, {
  id: 'interchange-enemy',
  contexts: ['interchange'],
  accepts: function(dragState) { /* check plantable */ },
  onDrop: function(dragState) { /* execute plant */ }
});

CardDragController.registerDropZone(playerRowEl, {
  id: 'interchange-player',
  contexts: ['interchange'],
  accepts: function(dragState) { /* check stealable */ },
  onDrop: function(dragState) { /* execute steal */ }
});

// On interchange close:
CardDragController.unregisterDropZone('interchange-enemy');
CardDragController.unregisterDropZone('interchange-player');
```

### 3b. Enemy Combat Capsule Mode (STR Combat — Enemy Hand Display)

**Proposed state:** `_enemyCombatCapsule`
```javascript
{
  mode: 'enemy-combat',
  cards: [...],              // enemy.cardDeck entries
  revealedIds: [...],        // cards the player has revealed
  plantedSlots: [            // indices of planted cards
    { index: 3, cardId: 'ACT-FRAG-GRENADE', triggerable: true }
  ],
  interactableIds: [...],    // cards player can interact with this round
  chargesRemaining: 2,
  momentum: { dots: [...], color: '#ff4444' }
}
```

**Render location:** This should NOT render in the player's capsule wrapper. Instead, reuse the same renderer pattern but target a **separate** DOM element positioned in the backup scroll space (per ENI Phase 3.1). The renderer function pattern is identical:

```javascript
function _renderEnemyCombatCapsule() {
  var stackEl = document.getElementById('enemy-combat-capsule-stack');
  if (!stackEl || !_enemyCombatCapsule) return;
  // Same sig-based rebuild pattern as _renderCombatCapsule()
  // Render per-card intelligent nodes with enemy-specific classes
}
```

**New joker classes for enemy combat nodes:**

| Class | Meaning | Visual |
|-------|---------|--------|
| `.nch-joker-enemy` | Base class for enemy card nodes | Slightly different scale/color to distinguish from player |
| `.nch-joker-revealed` | Player has revealed this card | Shows actual card emoji (like `.nch-joker-active`) |
| `.nch-joker-interactable` | Player can interact this round | Green pulse border, pointer-events enabled |
| `.nch-joker-planted` | Player's planted card in enemy deck | Card emoji + orange inner glow |
| `.nch-joker-triggerable` | Planted explosive ready to detonate | Orange pulse + 💣 overlay |
| `.nch-joker-destroyed` | Slot destroyed/stolen | 💀 emoji, non-interactive |
| `.nch-joker-playing` | Enemy is playing this card (their turn) | Yellow border pulse → lift → fly animation |

---

## Signature System

Every renderer uses a string signature stored in `stackEl.dataset.sig` to skip unnecessary DOM rebuilds. This is critical for performance since `_pollVisibility` fires every 350ms and combat capsule updates fire every 100ms.

**Signature rules:**

1. Prefix with mode identifier: `ch:`, `ix:`, `ec:`, or no prefix for NCH default
2. Include all fields that affect DOM output (card count, selection state, timer bucket, etc.)
3. Round continuous values (timer percent → integer 0-100)
4. Use `:` as field separator, `,` for arrays
5. Compare strictly: if sig matches, return immediately (no DOM touch)

**Examples:**

| Mode | Signature | Meaning |
|------|-----------|---------|
| NCH | `5:0:00100` | 5 cards, not stranded, card[2] is BLVCK |
| CH | `ch:5:ACT-001,ACT-003:S:75` | 5 cards, 2 selected, not resolving, timer at 75% |
| Interchange | `ix:3:2:1:plant-2` | 3 player cards, 2 enemy cards, 1 action, highlighting slot 2 |
| Enemy Combat | `ec:4:EATK-005:3,ACT-FRAG:2:0` | 4 enemy cards, 1 revealed, planted at 3, 2 charges, 0 momentum |

---

## CSS Class Hierarchy

All joker classes follow a consistent naming pattern:

```
.nch-capsule-joker          ← base (size, position, emoji rendering)
  .joker-N                  ← positional offset (0-7)
  .nch-joker-greyed         ← BLVCK / unusable / non-interactable
  .nch-joker-active         ← selected for play (green glow, card emoji)
  .nch-joker-resolving      ← resolution animation (green→gold pulse)
  .nch-joker-stealable      ← [ENI] stealable enemy card (green pulse border)
  .nch-joker-plantable      ← [ENI] empty slot accepting plant (orange pulse)
  .nch-joker-stolen         ← [ENI] previously stolen (💀, greyed)
  .nch-joker-planted        ← [ENI] player card planted here (orange glow)
  .nch-joker-triggerable    ← [ENI] planted explosive ready (💣 overlay)
  .nch-joker-revealed       ← [ENI] enemy card revealed (card emoji visible)
  .nch-joker-interactable   ← [ENI] can interact this round (green border)
  .nch-joker-destroyed      ← [ENI] slot destroyed (💀, non-interactive)
  .nch-joker-enemy          ← [ENI] enemy card base (visual distinction)
  .nch-joker-dragging       ← [ENI] being dragged (scale, opacity)
  .nch-joker-drop-target    ← [ENI] valid drop zone highlight
  .nch-joker-locked         ← [ENI] non-interactable (🔒 overlay)
  .nch-joker-playing        ← [ENI] enemy playing this card (fly animation)
```

Capsule-level classes:

```
.nch-capsule-wrapper        ← base wrapper
  .nch-capsule-critical     ← timer critical (<20%), opacity pulse
  .nch-capsule-flash        ← resolution edge flash
  .nch-capsule-interchange  ← [ENI] interchange mode active (expanded layout)
  .nch-capsule-enemy        ← [ENI] enemy combat capsule variant
```

---

## Integration Checklist for New Modes

When implementing a new capsule mode (e.g. for ENI):

1. **State variable:** Add `var _newModeCapsule = null;` near top of IIFE, next to `_combatCapsule`

2. **Renderer:** Write `_renderNewModeCapsule()` following the sig-skip pattern:
   - Check `_capsule` and state exist
   - Get `stackEl`
   - Build signature string
   - Compare to `stackEl.dataset.sig` → early return if match
   - Clear `innerHTML`, rebuild joker nodes
   - Apply mode-specific classes and emoji content

3. **Poll dispatch:** Add to `_pollVisibility()` priority chain:
   ```javascript
   if (_newModeCapsule) {
     _renderNewModeCapsule();
   } else if (_combatCapsule) { ... }
   ```

4. **Public API:** Add `show*`, `update*`, `hide*` functions:
   - `show*` sets state, forces `_capsule.style.display = 'flex'`, calls renderer
   - `update*` patches state fields, calls renderer
   - `hide*` nulls state, clears styling, resets `stackEl.dataset.sig`

5. **Expose in return block:** Add to `return { ... }` at bottom of IIFE

6. **CSS:** Add joker classes to `non-combat-hud.css` after the existing CH section

7. **CDC zones:** If the mode involves drag/drop, register/unregister CDC drop zones on mode enter/exit

8. **Mutual exclusion:** Each `show*` should null-out other mode states:
   ```javascript
   function showInterchangeCapsule(data) {
     _combatCapsule = null;  // can't be in CH and interchange simultaneously
     _interchangeCapsule = { ... };
     // ...
   }
   ```

9. **Cleanup on exit:** `hide*` should reset all mode-specific styling:
   - `_capsule.style.outline = ''`
   - Remove all mode-specific classes from capsule wrapper
   - Reset `stackEl.dataset.sig = ''` to force NCH rebuild on next poll

---

## Intelligent Node Contract

Every joker node in any mode follows this contract:

```javascript
var j = document.createElement('div');
j.className = 'nch-capsule-joker joker-' + i;

// Content: either 🃏 (hidden/default) or card.emoji (revealed/selected)
j.textContent = isRevealed ? (card.emoji || card.glyph || '\uD83C\uDCCF') : '\uD83C\uDCCF';

// State classes (additive):
if (isSelected)     j.classList.add('nch-joker-active');
if (isResolving)    j.classList.add('nch-joker-resolving');
if (isBlvck)        j.classList.add('nch-joker-greyed');
if (isStealable)    j.classList.add('nch-joker-stealable');
if (isPlantable)    j.classList.add('nch-joker-plantable');
if (isPlanted)      j.classList.add('nch-joker-planted');
if (isTriggerable)  j.classList.add('nch-joker-triggerable');
// etc.

// Optional: data attributes for drag/drop and interaction handlers
j.dataset.cardId = card.id || '';
j.dataset.slotIndex = i;
j.dataset.side = 'player'; // or 'enemy'

stackEl.appendChild(j);
```

The `textContent` toggle (🃏 ↔ card.emoji) is the core "intelligent node" behavior. Every mode uses this same mechanism — the difference is WHEN a card transitions from joker to emoji:

| Mode | Transition trigger |
|------|--------------------|
| NCH (default) | Never — always 🃏 |
| CH (combat) | When card is selected for resolution |
| Interchange | When card is dragged (reveals during drag) |
| Enemy Combat | When player spends a reveal charge |
| CQC/Planting | When player initiates plant action on adjacent enemy |

This consistent pattern means the transition animation CSS (`.nch-joker-active` scale + glow) works identically across all modes. The only variable is what triggers the class addition.

---

## Timer Color Utility

`_timerColorForPercent(pct)` returns an `rgb()` string for the STR combat timer:

```
100% → green  (76, 175, 80)
 80% → teal   (0, 150, 136)
 60% → amber  (255, 193, 7)
 40% → orange (255, 152, 0)
 20% → red-orange (255, 87, 34)
 10% → red    (244, 67, 54)
  0% → red    (244, 67, 54)
```

Linear interpolation between stops. Available to any mode that needs timer visualization — not combat-specific despite current usage.

---

## File Map

| File | What it owns |
|------|-------------|
| `non-combat-hud.js` | All capsule mode state, renderers, public API, poll dispatch |
| `non-combat-hud.css` | All `.nch-joker-*` classes, capsule layout, animations |
| `str-combat-integration.js` | Calls `showCombatCapsule` / `hideCombatCapsule` on combat tick |
| `card-drag-controller.js` | CDC drop zone registry — interchange will register zones here |
| `hand-fan-component.js` | `_animateCollapseToMiniIcon` targets `#nch-capsule-wrapper` as collapse anchor |

**Future files (ENI):**

| File | Purpose |
|------|---------|
| `nch-interchange.js` | Interchange mode orchestrator — calls `showInterchangeCapsule` / `hideInterchangeCapsule` |
| `nch-interchange.css` | Interchange-specific layout (dual-row, divider, action pips) |
| `enemy-capsule-renderer.js` | Map-mode enemy capsule (separate DOM, same joker class vocabulary) |

---

## Cross-References

- [ENEMY_NCH_INTERACTION_ROADMAP.md](./ENEMY_NCH_INTERACTION_ROADMAP.md) — Full ENI phase breakdown, interchange UI spec, enemy combat hand
- [THEFT_MECHANICS.md](./THEFT_MECHANICS.md) — §4 long-press capsule, §8 interchange UI, §9 plant mechanic
- [STR_COMBAT_DRAG_UNIFICATION.md](./STR_COMBAT_DRAG_UNIFICATION.md) — CDC drop zone registry pattern
- [ENEMY_CARDS.md](./ENEMY_CARDS.md) — BLVCK semantics, card interactability, Information Duel

---

*Document Version: 1.0*
*Created: 2026-03-07*
*Status: Architecture reference — CH mode implemented, ENI modes are roadmap*
*Philosophy: One capsule surface, many modes. Intelligent nodes transition from 🃏 to card.emoji based on context. Every future card-interaction UI plugs into this same pattern.*
