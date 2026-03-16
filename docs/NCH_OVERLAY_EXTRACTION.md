# NCH Overlay Extraction — Phase 0 Architecture

### v1.0 — March 2026

---

## Purpose

The NCH Overlay (`nch-overlay.js`) is a standalone, portable capsule widget extracted from `non-combat-hud.js`. It provides a draggable joker-stack that works on **any page** without requiring GoneRogue or any game dependencies.

---

## Two Modes

### Porthole Mode (default)

The overlay runs as a **theme/page-selector toy**. The joker stack appears at the user's last-dragged position. Clicking it dispatches `nch-overlay:open-porthole-fan` to open the hand-fan-component with coin-cards for theme selection and starfield portholes.

No GoneRogue, no CardStateAuthority, no game state needed.

### Game Mode (when GoneRogue is active)

When `GoneRogue.isActive()` becomes true, the overlay transitions to game mode:

1. Overlay capsule fades out (300ms morph animation)
2. `NonCombatHUD.init()` is called (inherits overlay's saved position)
3. NCH's own capsule takes over with full deck management
4. When GoneRogue deactivates, the process reverses

---

## Position Persistence

Both the overlay and NCH share position data via localStorage:

| Key | Owner | Purpose |
|-----|-------|---------|
| `EYESONLY_NCH_OVERLAY_POS_V1` | NchOverlay | Porthole-mode capsule position |
| `EYESONLY_NCH_CAPSULE_POS_V1` | NonCombatHUD | Game-mode capsule position |

On game mode entry, NCH reads the overlay's position key and applies it. On each NCH poll tick during game mode, the overlay key is synced back. This means the capsule stays at the same spot across mode transitions.

---

## Events

| Event | Dispatched by | When |
|-------|--------------|------|
| `nch-overlay:open-porthole-fan` | NchOverlay | User clicks capsule in porthole mode |
| `nch-overlay:entered-game-mode` | NchOverlay | Transition from porthole → game complete |
| `nch-overlay:exited-game-mode` | NchOverlay | Transition from game → porthole complete |
| `gone-rogue-started` | (external) | Optional explicit game start signal |
| `gone-rogue-ended` | (external) | Optional explicit game end signal |

---

## File Map

| File | Role |
|------|------|
| `public/js/nch-overlay.js` | Standalone overlay module — capsule, drag, position, mode polling |
| `public/css/nch-overlay.css` | Overlay-specific styles (`.nch-overlay-*` namespace) |
| `public/js/non-combat-hud.js` | Game-mode NCH — now has NchOverlay bridge in `init()` and `_pollVisibility()` |
| `public/css/non-combat-hud.css` | Game-mode NCH styles (unchanged) |

---

## Adding the Overlay to a New Page

```html
<link rel="stylesheet" href="css/nch-overlay.css">
<script src="js/starfield.js"></script>
<script src="js/nch-overlay.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    NchOverlay.init();
    // That's it. The capsule appears, drags, persists position,
    // and will auto-transition to game mode if GoneRogue loads.
  });
</script>
```

For pages that already manage their own starfield (splash screen), pass `autoStarfield: false`:

```js
NchOverlay.init({ autoStarfield: false });
```

---

## API Reference

```js
NchOverlay.init(opts)           // Initialize overlay
NchOverlay.destroy()            // Remove from DOM
NchOverlay.show() / .hide()    // Toggle visibility
NchOverlay.resetPosition()      // Reset to default bottom-right
NchOverlay.getMode()            // → 'porthole' | 'game' | 'transitioning'
NchOverlay.setPortholeCards([...]) // Set custom card configs
NchOverlay.enterGameMode()      // Force transition to game mode
NchOverlay.exitGameMode()       // Force transition to porthole mode
NchOverlay.getCapsuleElement()  // Get DOM element for animation anchoring
```

---

## Phase 0 Scope

This extraction covers:
- Capsule creation, drag, position persistence
- Porthole-mode joker stack rendering
- Event dispatch for hand-fan bridge
- Game-mode transition (porthole ↔ NCH handoff)
- Position sync between overlay and NCH

**Not yet implemented** (future phases):
- Phase 1: Starfield underlayment per-page (starfield.js is ready, needs page integration)
- Phase 3: Joker colorization via BLVCK card method (CSS hooks stubbed in nch-overlay.css)
- Phase 4: Drag-to-rearrange coin-cards (needs hand-fan-component bridge)
- Phase 5: Porthole puzzle integration (PORTHOLE_PUZZLE_TOOLKIT)

---

## Cross-References

- [NCH_CAPSULE_OVERLAY_ARCHITECTURE.md](./NCH_CAPSULE_OVERLAY_ARCHITECTURE.md) — Full NCH mode system (game mode internals)
- [PORTHOLE_PUZZLE_TOOLKIT.md](./PORTHOLE_PUZZLE_TOOLKIT.md) — Porthole rendering, z-index rules, puzzle integration
- [BLVCK_PHILOSOPHY.md](./BLVCK_PHILOSOPHY.md) — BLVCK card visual treatment
- [nch-porthole-roadmap.md](../nch-porthole-roadmap.md) — Full 6-phase roadmap

---

*Document Version: 1.0*
*Created: 2026-03-15*
*Status: Phase 0 implemented — extraction complete, bridge wired, index.html integrated*
