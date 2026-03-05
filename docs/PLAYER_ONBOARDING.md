# Player Onboarding — Floor 0 Tutorial System

## Status: REDESIGN PENDING

The original scripted walk system has been **gutted** (March 2026). This document preserves how it worked and outlines the replacement vision.

---

## 1. Old System: Scripted Walk (REMOVED)

### What It Did

On Floor 0 the player's input was completely disabled. The game auto-pathed the avatar from spawn to the exit door using a 3-phase state machine:

- **Phase 1** — Walk from spawn to tavern door. `beginGameplay()` set `_scriptedWalk = true`, found the forward exit tile, and called `GoneRogueMovement.setTarget()` after a 600ms delay.
- **Phase 2** — 3.5-second pause at tavern. Showed hint: "👆 Tap to explore the tavern — or wait to continue". After timeout, resumed walk toward exit.
- **Phase 3** — Walk from tavern to exit door. On arrival, showed hint: "🚪 Tap the door to enter the forest". Player could then tap the door to proceed to Floor 1.

### State Machine

```
_scriptedWalk       : bool  — true while auto-walking, blocks TapMoveSystem
_scriptedWalkTarget : {x,y} — current destination (tavern door or exit)
_scriptedWalkPhase  : int   — 0=off, 1=walking-to-tavern, 2=paused, 3=walking-to-exit
_scriptedWalkExitTarget : {x,y} — saved exit position for phase 3 resume
```

Note: `_scriptedWalkPhase` and `_scriptedWalkExitTarget` were never declared with `var` — they leaked as implicit globals on the window object.

### Files Involved (all now cleaned)

| File | What was removed |
|------|-----------------|
| `begin-gameplay-system.js` | Floor 0 branch (lines 31-82) that set scriptedWalk=true and triggered pathfinding |
| `game-tick-system.js` | Phase management block (lines 55-92) inside logical-position-changed check |
| `tap-move-system.js` | `if (ctx.scriptedWalk) return;` guard at line 107 |
| `gone-rogue.js` | `_scriptedWalk`, `_scriptedWalkTarget` var declarations; run-init clear; context builder getters/setters for all 4 scripted walk properties |

### Why It Was Removed

1. **Blocked all player input on Floor 0** — `TapMoveSystem.handleTapMove()` returned early when `scriptedWalk === true`, making the game appear broken.
2. **Implicit globals** — Phase and exit target were never declared, creating silent bugs.
3. **No teaching value** — Watching the avatar walk itself doesn't teach the player how to fish, tap-to-move, or sprint. The tutorial floor should be interactive.

---

## 2. New Vision: Pink Panther Pawprint Tutorial

### Concept

Replace the passive scripted walk with an **animated guide path** the player follows at their own pace. Think Pink Panther opening credits — a stylized pawprint or hand traces the fishing path ahead of the player, inviting them to draw their own line.

### Behavior

1. **Floor 0 loads normally** — player has full input control from the start.
2. **Animated guide overlay** — A translucent pawprint/hand emoji traces a fishing-style path from the player toward the first point of interest (e.g., tavern door). The animation loops slowly.
3. **Player interrupts by acting** — Any tap, drag, or fishing gesture dismisses the guide and proceeds normally. The tutorial adapts: if the player taps (walks), it shows the fishing gesture next. If the player fishes first, it congratulates them.
4. **Progressive hints** — After the player reaches the tavern area, a second guide traces toward the exit door with a sprint hint (double-tap + drag).
5. **Never blocks input** — The guide is purely visual. The player can ignore it entirely and explore freely.

### Implementation Notes (TODO)

- Overlay canvas or SVG layer on top of the game grid
- Animate a sequence of emoji stamps (🐾 or 👆) along a pre-computed path
- Dismiss on first `pointerdown` event
- Store tutorial progress in `localStorage` so it only shows on first run
- Reuse `_showFishingPath()` visual style for consistency
- Consider accessibility: provide a "Skip Tutorial" button for screen reader users

---

## 3. Floor 0 Design Principles

- **Immediate agency** — The player should feel in control from the first frame
- **Learn by doing** — Show the gesture, let the player replicate it
- **Non-blocking** — Tutorial hints are visual overlays, never input gates
- **Progressive disclosure** — Introduce one mechanic at a time: tap → fish → sprint → interact
- **Fail-safe** — If the tutorial system fails to load, the player still has full control
