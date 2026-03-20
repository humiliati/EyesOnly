# MOK Avatar Unification & Interactivity Roadmap

> **Status:** Phase 1 — In Progress (March 19, 2026)
> **Priority:** MEDIUM — visual consistency + interactivity
> **Depends on:** Debrief feed controller, theme video system, kernel manager

---

## Current State (Working)

The MOK avatar is a **CSS 3D spinning pyramid** (`mok-pyramid.css`) rendered inside `#mok-avatar` in the debrief feed. Three JS modules coordinate to drive it:

### 1. MOKStateMachine (`mok-state-machine.js`)
Central state authority. Maps game/system events to CSS classes on `#mok-avatar` via a priority queue. Higher-priority events interrupt lower ones. Interactive states (poke, spin, squish) are priority 1 — any game event overrides them.

**Cycle → CSS class map:**
| Cycle ID | CSS Class | Trigger |
|----------|-----------|---------|
| idle_breathe | mok-state-idle | Default / decay |
| talking_active | mok-state-typing | Tooltip open |
| processing_think | mok-state-output | Card played, item disposed |
| alert_pulse | mok-state-active | Player input, poke |
| happy_response | mok-state-ping | Card success, combat victory, spin burst |
| warning_flash | mok-state-kernel-error | Card failed, resource low |
| error_critical | mok-state-kernel-error | Error, combat defeat |
| combat | mok-state-combat | Combat start |
| kernel_connected | mok-state-kernel-connected | Kernel connect |
| kernel_active | mok-state-kernel-active | Kernel running |

**Priority levels:** 0 (idle) → 1 (interactive poke/spin) → 3–4 (game events) → 5–7 (errors/warnings)

### 2. DebriefFeedController interactive system (`debrief-feed-controller.js`)
Handles pointer/keyboard input on the pyramid. Drives CSS poke/spin/squish classes directly on `#mok-avatar`. Notifies MOKStateMachine of interactive events via `triggerMOKEvent()`. Sets `loader._mokInteractionBound = true` flag so mok-ux.js defers to it.

**Interactions:**
- **Single tap** (upper/lower half) → `mok-poke-down` / `mok-poke-up` (spring boing, 600ms)
- **Double tap** (350ms gap) → `mok-spin-burst` (720° rotation, 850ms)
- **Long press** (400ms hold) → `mok-squish` (held scale deformation), release into directional boing
- **Drag** (8px threshold) → `mok-dragging` (manual spin via `--mok-drag-y`), release with momentum coast
- **Keyboard** Enter/Space → alternating poke-down and spin-burst (QuadStick accessible)

### 3. mok-ux.js (lightweight fallback driver)
Pre-interactive-system fallback. Patches Terminal.writeLine/typeText/typeLines to drive avatar states. Click/keydown handlers defer to DebriefFeedController when `_mokInteractionBound` is set. Also handles debrief window click-to-expand (one-way: expand only, background tap dismisses).

### Static SVG Fallback (index.html)
The `#mok-avatar` button contains a hardcoded SVG triangle glyph that renders with zero JS. The CSS pyramid layers over it when CSS loads. This is the no-JS / pre-init fallback.

---

## Completed Work

### Debrief Feed States (Fixed)
- **Default state**: Content taps don't change surrounding CSS layout
- **Maximized state**: `transform: scale(var(--debrief-zoom, 1.35))` — keeps frame, widgets, 4:3 ratio, background visible
- **Mobile portrait**: `transform-origin: top right` prevents right-edge bleed; `--debrief-zoom: 1.25`
- **Dismiss**: Background-tap only (document pointerdown capture phase, 200ms delay)
- **One-way expand**: Clicking inside debrief only expands, never collapses
- **Removed**: Transparent band state (broken), drag-to-resize HUD scale (ineffective), legacy `.expanded` toggle

### Mobile Layout Stability (Fixed)
- Compact header is now the DEFAULT on mobile portrait (not gated by `keyboard-visible` class)
- Eliminated jarring padding/spacing shift when tapping between debrief feed and log-column

### CSS 3D Pyramid Sizing (Adjusted)
- Perspective: 340px desktop / 290px mobile (was 400px/340px — 15% closer)
- Wrapper/sides: 80px desktop / 58px mobile (was 70px/50px — 15% larger)
- Shadow: 68px / 48px (proportional)

### Unified State Machine (Complete)
- `mok-state-machine.js` rewritten to drive CSS classes directly (no MOKVisualEngine dependency)
- Priority system: interactive states (1) < game events (3-7)
- Auto-decay back to idle after event duration
- Event queue for lower-priority events
- `canInteract()` gate for interactive system
- 30s idle timer → sleep_dormant state
- Backward compatible `init(target)` — accepts element or legacy visualEngine (ignored)

### SM64-Inspired Interactive States (Complete)
- All CSS keyframe animations in `mok-pyramid.css`
- Pointer event handling in `debrief-feed-controller.js` `_setupMokInteraction()`
- QuadStick/keyboard accessibility
- Focus-visible ring on `#mok-avatar`

### Hardcoded Kernel Status Bug
- `debrief-feed-controller.js` `_renderKernelStatus()` — status was hardcoded to `'connected'`
- Fixed: reads from `KernelManager.getState().state` with disconnected fallback

---

## Phase 1: Remaining Work — All Complete

### Wire MOKStateMachine into interactive system ✅
- `_setupMokInteraction()` now gates on `MOKStateMachine.canInteract()` before allowing poke/spin/squish
- Calls `_notifySM('poke')`, `_notifySM('spin_burst')`, `_notifySM('squish')` to notify the state machine
- Guard: `typeof MOKStateMachine !== 'undefined'` on all references

### Wire MOKStateMachine into mok-ux.js ✅
- `setAvatarState()` routes through `MOKStateMachine.handleEvent()` via `STATE_TO_EVENT` map
- Map: typing→tooltip_open, output→card_played, ping→item_acquired, active→player_input, idle→idle_timer
- Terminal patches (writeLine, typeText, typeLines) all flow through the state machine priority system
- Falls back to direct class manipulation if MOKStateMachine hasn't loaded yet

### MOKStateMachine.init() call ✅
- Called in `DebriefFeedController.init()` targeting `#mok-avatar`
- Guarded with `typeof MOKStateMachine !== 'undefined'`

### Smart Watch Widget — Site-Wide Debrief Feed ✅
- ITM-204 Smart Watch added to items.json, seeded as default account item
- `debrief_feed: true` meta tag gates the widget (extensible to other items)
- Full MOK pyramid + interactive poke/spin/squish in overlay (uses `#sw-mok-avatar`)
- Audio controls: master mute, music/SFX volume, now playing
- Wired into all 5 public pages
- See `docs/SMART-WATCH-ROADMAP.md` for polish stages through oscilloscope variant

---

## Phase 1.5: Legacy Deprecation (Complete)

### MOKVisualEngine bypass ✅
- `setMOKExpression()` now routes through `MOKStateMachine.handleEvent()` via `EXPRESSION_TO_EVENT` map
- Expression names (idle, talking, warning, happy, error, combat, active) map to SM event types
- Falls back to legacy MOKVisualEngine only if SM is unavailable

### CSS custom property glow API ✅
- `setMOKGlowColors(primary, secondary, pulseSpeed)` now sets `--mok-color-1`, `--mok-color-2`, `--mok-glow`, `--mok-spin-duration` on `#mok-avatar`
- `getMOKGlowColors()` reads from the same CSS properties
- Agent integration (`agent-integration.js`) calls flow through to CSS without needing MOKVisualEngine
- `kernel-manager.js` backward-compat call still present but no longer required

### Remaining cleanup (low priority)
- `mok-visual-engine.js` and `mok-animation-cycles.js` still loaded in index.html — can be removed once confirmed no callers remain
- kernel-manager.js legacy `MOKVisualEngine.setCustomGlowColors()` call can be removed

---

## Phase 2: WebGL Avatar (Future — No Current Plans)

### Vision (Deferred)
Replace the CSS 3D pyramid with a Three.js WebGL renderer. The MOK glyph becomes a proper 3D object with:
- Layered pentagram + triangle geometry
- Porthole layer reveal (stencil buffer masking)
- Vertex-deformable mesh (SM64 face stretch)
- API agent responsive deformations

This is documented for reference but not actively planned.

---

## Files Reference

| File | Role | Status |
|------|------|--------|
| `index.html` #mok-avatar SVG | No-JS fallback | ✅ Stable |
| `css/mok-pyramid.css` | 3D pyramid + state animations + interactive keyframes | ✅ Complete |
| `js/mok-ux.js` | Lightweight fallback driver, Terminal patches | ✅ Wired to SM |
| `js/mok-state-machine.js` | Central state authority (CSS class driven) | ✅ Rewritten + wired |
| `js/debrief-feed-controller.js` | Feed management + interactive poke system | ✅ Wired to SM |
| `js/smart-watch-widget.js` | Site-wide debrief feed + audio overlay | ✅ Complete |
| `css/smart-watch-widget.css` | Watch sprite + overlay styles | ✅ Complete |
| `js/mok-visual-engine.js` | Legacy canvas renderer | ⚠️ Deprecated (still loaded) |
| `js/kernel-manager.js` | Drives kernel state colors | ✅ Compatible |
