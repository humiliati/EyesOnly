# Player Onboarding — Implementation Roadmap

## Overview

Pink Panther Pawprint Tutorial — a 10-phase scripted walkthrough on Floor 0 that teaches tap-to-move, fishing line paths, and floor transitions through a hijacked cursor demonstration.

**Module:** `onboarding-tutorial.js` (new IIFE)
**Entry point:** `BeginGameplaySystem.beginGameplay()` → `OnboardingTutorial.start(ctx)` on Floor 0
**Cursor asset:** `/assets/cursor.cur` (32x32, base64 CSS embed in `CURSOR CSS.txt`)

---

## Phase Map

### Phase 1: Player Has Full Input (t=0)
- **Status:** Implementing
- **What:** Game starts normally. Player can tap/drag immediately. No locks.
- **Implementation:** No-op — default behavior. OnboardingTutorial just starts its internal timer.
- **File:** `onboarding-tutorial.js` → `start(ctx)` sets `_startTime = Date.now()`

### Phase 2: Tooltip + Overhead Hint (t=0.5s)
- **Status:** Implementing
- **What:** After 0.5s of no input, show tooltip "Tap + Drag to move" and overhead pointing emoji on player.
- **Cancel condition:** If player moves before 0.5s, skip to Phase 7 (player already knows).
- **Implementation:**
  - `TooltipSystem.show('Tap + Drag to move', 3000)`
  - `OverheadAnimator.showGenericExpression(player.x, player.y, '👆', 3000, '#ffff00')`
- **File:** `onboarding-tutorial.js` → `_phase2()`

### Phase 3: Cursor Hijack (t=1.25s)
- **Status:** Implementing
- **What:** If still no input by 1.25s, render a custom cursor on the grid using cursor.cur asset.
- **Cancel condition:** Player input → abort hijack, skip to Phase 7.
- **Implementation:**
  - Create a floating `<div>` overlay with cursor.cur as background-image (CSS base64 embed)
  - Position it at player's grid position (pixel coords from grid container)
  - Add CSS class `onboarding-cursor-hijack` with intermittent inverted-color flicker animation
  - Set `pointer-events: none` so it doesn't block real touches
- **File:** `onboarding-tutorial.js` → `_phase3()`, CSS injected via `<style>` tag

### Phase 4: Cursor Glides to Exit Door (t=1.5s → ~3s)
- **Status:** Implementing
- **What:** Hijacked cursor smoothly glides from player position toward the exit door tile.
- **Cancel condition:** Player taps anywhere → remove cursor, skip to Phase 7.
- **Implementation:**
  - Use `GoneRogueMovement.findPath(player.x, player.y, exit.x, exit.y, collisionCheck)` to get A* path
  - Animate cursor `<div>` along path waypoints using `requestAnimationFrame` + lerp
  - Speed: ~2 tiles/sec (slower than player for readability)
  - Cursor leaves faint trail (small cyan dots at visited waypoints, CSS opacity fade)
- **File:** `onboarding-tutorial.js` → `_phase4()`

### Phase 5: Cursor Demonstrates Tap + Fishing Line (arrival at exit)
- **Status:** Implementing
- **What:** Cursor arrives near exit door, "taps" (visual pulse animation), then draws fishing line path back.
- **Cancel condition:** Player taps → remove cursor and fishing line, skip to Phase 7.
- **Implementation:**
  - Cursor div plays "tap" animation (scale pulse 1.0 → 1.3 → 1.0, with orange ring)
  - After tap animation (0.5s), call GoneRogueMobile's fishing path visualization
  - Show fishing line from player position to exit door
  - `TooltipSystem.show('Drag to draw a path', 2500)`
- **File:** `onboarding-tutorial.js` → `_phase5()`

### Phase 6: Avatar Auto-Walks to Exit (post-fishing-line)
- **Status:** Implementing
- **What:** Player avatar begins walking the fishing line path toward exit.
- **Cancel condition:** Player taps to interrupt → Phase 7.
- **Implementation:**
  - `GoneRogueMovement.setTarget(exit.x, exit.y, collisionCheck, false)`
  - Normal game tick handles the movement and tile interactions
  - When player reaches exit door tile, normal door transition fires → Floor 1
  - Remove cursor overlay and fishing line on transition
- **File:** `onboarding-tutorial.js` → `_phase6()`

### Phase 7: Player Took Control (early exit)
- **Status:** Implementing
- **What:** Player tapped/moved at any point during Phases 2-6. Clean up all tutorial overlays.
- **Implementation:**
  - Remove cursor `<div>` overlay
  - Hide fishing line if visible
  - Clear overhead animations from tutorial
  - Set `_playerTookControl = true` — remaining phases still fire tooltips but no auto-movement
  - `TooltipSystem.show('Nice! Keep exploring.', 2000)`
- **File:** `onboarding-tutorial.js` → `_abort()`

### Phase 8: Sprint Demonstration (if auto-walk, ~1/3 to exit)
- **Status:** Implementing
- **What:** If auto-walk is still active and player is ~1/3 of the way, cursor double-taps exit to switch to sprint.
- **Implementation:**
  - Monitor `GoneRogueMovement.getLogicalPosition()` vs path progress
  - At 33% progress, cursor reappears at exit tile, plays double-tap animation
  - `GoneRogueMovement.setTarget(exit.x, exit.y, collisionCheck, true)` (isSprinting=true)
  - `TooltipSystem.show('Double-tap to sprint!', 2000)`
- **File:** `onboarding-tutorial.js` → `_phase8()`

### Phase 9: Floor 1 Transition Tooltips
- **Status:** Implementing
- **What:** On Floor 1 entry, show dramatic sequential tooltips: "Survive", "Evade", "Resist", "Extract".
- **Implementation:**
  - Hook into floor transition (listen for `ctx.getFloor() === 1` after `generateFloor()`)
  - Sequential tooltip cascade: each word shown for 1.5s with 0.3s gap
  - `TooltipSystem.show('Survive.', 1500)` → delay → `TooltipSystem.show('Evade.', 1500)` → etc.
- **File:** `onboarding-tutorial.js` → `_phase9()`

### Phase 10: Player Overhead Reactions
- **Status:** Implementing
- **What:** For each Floor 1 tooltip word, show "!" overhead on player.
- **Implementation:**
  - `OverheadAnimator.showGenericExpression(player.x, player.y, '!', 1200, '#ff4444')` synced to each tooltip
- **File:** `onboarding-tutorial.js` → part of `_phase9()`

---

## Broader Onboarding Phases (Future Work)

| Phase | Description | Status |
|-------|-------------|--------|
| Terminal Entry | ASCII boot sequence, typewriter login | Not started |
| Splash Screen | Animated title card | Not started |
| Character Selection | Class/build picker | Not started |
| Pre-Start Cutscene | Story context before Floor 0 | Not started |
| Victory Flow | Run completion sequence | Not started |
| Death Handler | Game over + retry flow | Partial |

---

## Files

| File | Purpose |
|------|---------|
| `public/js/onboarding-tutorial.js` | New IIFE module — all 10 phases |
| `public/js/begin-gameplay-system.js` | Hook: call `OnboardingTutorial.start(ctx)` on Floor 0 |
| `public/assets/cursor.cur` | 32x32 custom cursor asset |
| `public/index.html` | Add `<script>` tag for onboarding-tutorial.js |
