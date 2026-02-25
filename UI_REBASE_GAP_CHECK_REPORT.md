# UI Rebase Gap Check Report — Phase A Gate Audit

**Date:** 2026-02-25
**Auditor:** Code-level static analysis (no live browser — manual playtest still needed for Tests 2–5 of disposal workflow)
**Build/Commit:** current HEAD on local workspace

---

## Gate Verdicts Summary

| Gate | Criterion | Verdict | Notes |
|------|-----------|---------|-------|
| **A** | STR Combat Play Pipeline (id-based) | **PASS** | Zero legacy `handleMultiCardCombat` callers found. All paths route through `playCardFromHand(cardId)` / `playCardsFromHand([ids])`. BLVCK failsafe confirmed. |
| **B** | STR Window Minimize / Maximize Loop | **PASS (code)** | Minimize button wired correctly. Minimized indicator click + touchend + mouseenter all route to `maximize()`. z-index layering looks correct. *Needs manual click-through to confirm HandFan doesn't visually occlude the minimize button.* |
| **C** | HandFan Stability + Input Reliability | **PASS (code)** | Repopulate locks interactions (`_isAnimating = true`, `hand-fan-interaction-lock` class). First-click during repopulate queues selection instead of dropping it. Hover lift delegated to CSS variables, not JS fighting transforms. |
| **D** | Drag-to-Map Ground Effects | **PASS (code)** | Full flow present: drag out of STR → collapse window → release over `.rogue-cell` → deploy via `GroundEffects.setGroundEffect` → 750ms delay → `STRCombatWindow.maximize()`. Invalid deploy (no mapping) does NOT consume cards. |
| **E** | NCH Functional Correctness | **CONDITIONAL PASS** | Hand→Backup and Backup→Hand both work via GAMESTATE canonical functions. Backup slots render as fixed 4 slots (no visual collapse). **Risk:** `selectedHandIndex` clamping after splice uses `Math.min(hIdx, hand.length - 1)` which can produce `-1` when hand empties — not a bug per se, but edge-case worth monitoring. |

---

## Gate A — STR Combat Play Pipeline (Canonical id-based)

### ✅ No legacy `handleMultiCardCombat` callers
Grepped entire codebase — **zero** matches for `handleMultiCardCombat(`. The comment in `hand-fan-component.js:777` explicitly states "Legacy indices-based combat path removed; keep id-based only."

### ✅ Desktop routes through `playCardFromHand(cardId)`
- `hand-fan-component.js:773–774`: drag release over enemy → `GoneRogue.playCardFromHand(c.id)`
- `str-combat-integration.js:333–338`: desktop selection → `GoneRogue.playCardsFromHand(ids)`

### ✅ Mobile routes through `playCardsFromHand([ids])`
- `gone-rogue-mobile.js:2254–2269`: "Play Selected" → `GoneRogue.playCardsFromHand(ids)`

### ✅ BLVCK failsafe works
- `str-combat-integration.js:161–177`: When canonical hand is empty or all cards unaffordable, injects `ACT-000` ("BLVCK") as a 1-damage fallback. Tooltip shows "■ STRUGGLE (BLVCK) — no cards available". Combat never softlocks.
- `hand-fan-component.js:342–346`: Visual placeholder rendered in fan when BLVCK is the only option.

### Evidence
- `test-phase3-str-combat.js` validates: `GoneRogue` module loads, `playCardFromHand` / `playCardsFromHand` are exported, STR combat state APIs exist, timer and mini indicator APIs present.

---

## Gate B — STR Window Minimize / Maximize Loop

### ✅ Minimize button exists and is wired
- `str-combat-window.js:292–295`: Header renders `<button class="str-minimize-btn">↓</button>`
- `str-combat-window.js:372–377`: Both `click` and `touchend` handlers call `minimize()`

### ✅ Minimized indicator appears and restores
- `str-combat-window.js:52–60`: `_minimizedIndicator` created at init, starts `display: none`
- `str-combat-window.js:226–229`: On minimize, indicator shown with `str-indicator-appear` animation
- `str-combat-window.js:67–82`: Indicator click, touchend, and mouseenter all call `maximize()`

### z-index stack (verified)
| Layer | z-index |
|-------|---------|
| STR minimized indicator | 1900 |
| HandFan mini indicator | 1950 |
| STR combat window | 2000 |
| HandFan container (combat) | 2100 |
| STR overlay (backdrop) | 3000 |
| STR death overlay | 4000 |

### ⚠️ Risk: HandFan occlusion on desktop
The hand fan at z-index 2100 sits above the STR window (2000). The fan is positioned at `top: 70vh` in combat mode — the minimize button is in the STR window header (typically top of STR window). These should not overlap on desktop, but on short viewports (< 700px height) the fan could potentially creep up over the header. **Recommend manual check on 768×600 viewport.**

---

## Gate C — HandFan Stability + Input Reliability

### ✅ No violent card jump on hover during repopulate
- `hand-fan-component.js:1281–1293`: During repopulate, `_isAnimating = true` and `hand-fan-interaction-lock` CSS class is applied. This locks pointer events for 320ms while new cards fade in, preventing hover transforms from fighting the repopulate animation.

### ✅ First-card selection works on first click each round
- `hand-fan-component.js:914–917`: During `_isAnimating`, `pointerdown` handler explicitly calls `_toggleCardSelection(index)` instead of dropping the event. This ensures the first tap is not swallowed.

### ✅ Hover lift via CSS, not JS fighting animations
- `hand-fan-component.js:505`: "Expose base transform via CSS variables; CSS handles hover lift." The `:hover` transform is CSS-only, avoiding JS-vs-animation conflicts.

---

## Gate D — Drag-to-Map Ground Effects (Combat)

### ✅ Dragging valid ground-effect card collapses STR
- `hand-fan-component.js:781–831`: On pointer-up, code checks `document.elementFromPoint` for `.rogue-cell`. If the card has a `GroundEffectCardMappings.getMappingForCard(card)` mapping, it deploys via `GroundEffects.setGroundEffect()` with radius support.

### ✅ STR stays minimized briefly, then returns
- `hand-fan-component.js:834–844`: If `didDeployGroundEffect === true`, `STRCombatWindow.maximize()` is called after a 750ms `setTimeout`, giving the player time to see map feedback. If no ground effect was deployed, maximize happens immediately.

### ✅ Invalid deploy does not consume cards
- The card consumption (`loose.splice(idx, 1)`) only happens inside the `if (mapping && GroundEffects.setGroundEffect)` block. If no mapping exists for the card, execution skips the entire deploy branch and the card is never consumed.

---

## Gate E — NCH Functional Correctness

### ✅ Hand → Backup works (button + drag)
- `non-combat-hud.js:91–118`: "To Backup" button calls `GAMESTATE.moveHandIndexToBackup(sel)` with fallback logic for single-card hands.
- `non-combat-state-store.js:198–247`: `moveSelectedHandToBackup()` decrements hand qty, places card into first empty backup slot, updates selection indices.

### ✅ Backup → Hand works
- `non-combat-hud.js:121–151`: "To Hand" button calls `GAMESTATE.moveBackupIndexToHand(sel)` with fallback for single-backup-card scenarios.
- `non-combat-state-store.js:250–287`: `moveSelectedBackupToHand()` nulls the backup slot, stacks qty into hand, resets `selectedBackupIndex` to -1.

### ✅ Backup slots never visually collapse
- `non-combat-hud.js:470–471`: Render loop is `for (var s = 0; s < 4; s++)` — always renders exactly 4 slots regardless of occupancy. Empty slots show "—" with `.empty` class.
- `non-combat-state-store.js:206–209`: `moveSelectedHandToBackup` pads backup array to `maxSlots` (default 4) before any operation.

### ⚠️ Selection clamping edge case
- `non-combat-state-store.js:234`: After splice, `hIdx = Math.min(hIdx, hand.length - 1)`. When the hand empties entirely (`hand.length === 0`), this produces `hIdx = -1`. This is actually correct behavior (no card to select), but the NCH HUD should handle `selectedHandIndex === -1` gracefully. The code at `non-combat-hud.js:98` does check `sel < 0` as a guard, so this is safe.
- `consumeHandIndex` (line 302–306) also adjusts selection on splice, using `sel = -1` when the consumed card was selected. This is correct.

---

## Test Harness Status

| Harness | Can Run Headlessly? | Status |
|---------|---------------------|--------|
| `test-phase3-str-combat.js` | No (needs full `GoneRogue` engine in DOM) | **Needs browser run** — test structure validated, all assert calls reference exported APIs |
| `test-disposal-mobile-workflow.html` | No (manual test, interactive UI) | **Manual only** — Tests 2,3,4,5 require live gameplay |
| `non-combat-debug.html` | No (needs `NonCombatStateStore` + `NonCombatEventBus`) | **Needs browser run** — debug tool only, no pass/fail |

---

## Pass

- **Gate A:** Zero legacy callers. All STR play paths are canonical id-based. BLVCK failsafe prevents softlock.
- **Gate B:** Minimize/maximize wiring complete with click, touch, and hover handlers. Indicator lifecycle is clean.
- **Gate C:** Repopulate interaction lock prevents hover/click fighting. First-click queued instead of dropped.
- **Gate D:** Ground effect drag-deploy flow is complete with card consumption gating and post-deploy delay.
- **Gate E:** Hand↔Backup moves work through GAMESTATE canonical functions. Fixed 4-slot rendering prevents visual collapse.

## Fail

- **(none at code level)**

## Risks / Follow-ups

1. **Short-viewport HandFan occlusion (Gate B):** On viewports < ~700px tall, the HandFan combat position (`top: 70vh`) could overlap the STR header minimize button. Recommend manual test at 768×600.
2. **Browser test harnesses not run:** `test-phase3-str-combat.js` needs a live browser session with the full engine loaded. Recommend running before signing off the gate.
3. **NCH selectedHandIndex -1 edge:** When hand empties via move-to-backup, selection goes to -1. Code handles this, but worth a manual walkthrough (empty hand → try "To Backup" → should show error tooltip, not crash).
4. **Ground effect card consumption uses loose inventory splice** (`hand-fan-component.js:816`), which assumes `loose[idx]` maps to the dragged card. If the hand was mutated between drag-start and drag-end (e.g., by a timer-based round resolution), the wrong card could be consumed. Low probability but worth a stress test.

---

## Recommendation

**Phase A gate is GREEN at the code level.** All five criteria pass static analysis. Three risks are flagged for manual verification before entering Phase B. The browser test harnesses should be run in a live session to complete the gate sign-off.
