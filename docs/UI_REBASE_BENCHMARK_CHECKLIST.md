# UI Rebase Benchmark Checklist (Phase A → Phase B Gate)

This page is the **single benchmark + gap-check** for the STR / HandFan / NCH UI rebase.

**Goal:** confirm the current UI is **functionally stable** (inputs + state + flows) before doing **Phase B** (visual redesign: chip grids, pill thumbnails, non-text layout).

> Principle: **Phase A = function first, visuals later.**

---

## Quick Start (What to run)

### 1) STR Combat baseline (automated-ish)
- Run: `public/tests/test-phase3-str-combat.js`
- Launcher: `public/tests/index.html` (open in browser, pick Phase 3 / STR Combat test page if linked)

### 2) STR / HandFan drag workflows (manual checklist)
- Run: `public/tests/test-disposal-mobile-workflow.html`
- Focus tests: **2, 3, 4, 5**

### 3) NCH functional state debug (manual / diagnostic)
- Run: `public/tests/non-combat-debug.html`

---

## Phase A “Gate” Criteria (must be true before Phase B)

### A) STR Combat Play Pipeline (Canonical id-based)
- [ ] **No callers** remain for legacy indices-based STR play (e.g. `handleMultiCardCombat`).
- [ ] Desktop: playing 1+ selected cards routes through `GoneRogue.playCardFromHand(cardId)` / `GoneRogue.playCardsFromHand([ids])`.
- [ ] Mobile: "Play Selected" routes through `GoneRogue.playCardsFromHand([ids])`.
- [ ] BLVCK failsafe works when no playable cards exist (no softlock).

**Expected evidence:**
- `test-phase3-str-combat.js` runs without console errors.
- Grep/search finds no `handleMultiCardCombat(` references.

### B) STR Window Minimize / Maximize Loop
- [ ] STR window minimize button is clickable on desktop (not blocked by HandFan overlay).
- [ ] Minimizing shows the minimized indicator.
- [ ] Clicking minimized indicator restores the STR window.

### C) HandFan Stability + Input Reliability
- [ ] No violent card "jump" on hover during repopulate.
- [ ] First-card selection works on the first click each round.
- [ ] Hover lift does not fight repopulate/commit/resolve animations.

### D) Drag-to-Map Ground Effects (Combat)
- [ ] Dragging a valid ground-effect card from CH/HandFan out of STR collapses STR.
- [ ] Releasing over a valid grid cell deploys the effect.
- [ ] STR stays minimized briefly so the player can see map feedback, then returns.
- [ ] Invalid deploy attempts do not consume cards.

### E) NCH (Non-Combat HUD) Functional Correctness
- [ ] Hand → Backup moves work (button action + drag drop).
- [ ] Backup → Hand moves work.
- [ ] Selection indices clamp correctly (no out-of-range selection after state changes).
- [ ] Backup slots never visually collapse into nothing (layout stability).

---

## Test Harness Notes (What each proves)

### `public/tests/test-phase3-str-combat.js`
Proves:
- STR core modules load
- STR window timer APIs exist
- HandFan mini indicator APIs exist

Does **not** prove:
- Full UI workflows (minimize, drag deploy) end-to-end

### `public/tests/test-disposal-mobile-workflow.html`
Proves (manually):
- z-index / layering stability
- drag/drop disposal feedback still works
- HandFan doesn’t occlude critical surfaces

### `public/tests/non-combat-debug.html`
Proves (manually):
- NCH state correctness + selection state
- backup/hand data integrity

---

## Gap Check Output (fill this in after a run)

Date: ____________
Build/Commit: ____________

### Pass
- 

### Fail
- 

### Risks / Follow-ups
- 

---

## Phase B Scope Reminder (do NOT start until Phase A gate is green)

Phase B is **visual + interaction redesign**, e.g.:
- Minimized NCH pill: animated card thumbnails (1–3 chips)
- NCH hand rows → chip grid
- NCH backup slots → chip slots
- Stronger selection highlighting + deposit feedback

The purpose of this checklist is to keep Phase B from becoming a functional bug-hunt.
