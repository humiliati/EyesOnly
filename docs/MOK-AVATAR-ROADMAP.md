# MOK Avatar Unification & WebGL Roadmap

> **Status:** Planning — March 18, 2026
> **Priority:** MEDIUM — visual inconsistency, not data loss
> **Depends on:** Debrief feed controller, theme video system, kernel manager

---

## Current State (Broken)

There are at least 3 competing MOK avatar implementations rendering into the debrief feed:

### 1. Static SVG Avatar (index.html lines 304-321)
The HTML contains a hardcoded SVG MOK glyph (equilateral triangle with inner triangle):
```html
<button id="mok-avatar" class="mok-avatar idle">
  <svg viewBox="0 0 220 120"><!-- pentagram-like triangle glyph --></svg>
</button>
```
This renders when no game module has loaded and the DebriefFeedController hasn't initialized.

### 2. MOKVisualEngine (mok-visual-engine.js, lazy-loaded)
A canvas-based renderer that draws the MOK glyph with animated glow effects. Initialized by `DebriefFeedController._renderMOK()` into `#mok-visual-container`. The kernel manager can override its glow colors via `setCustomGlowColors()`.

### 3. DebriefFeedController Video Display (debrief-feed-controller.js, lazy-loaded)
The theme video system (`_scheduleThemeVideo`) renders a `<video>` element into `#debrief-screen`, replacing the MOK display entirely. This is the intended default for non-game mode.

### The Conflict
- On fresh page load (no game): Static SVG shows, video controls are visible but nonfunctional
- After game loader finishes: DebriefFeedController.init() replaces the static SVG, schedules theme video after 3s
- On login: KernelManager.init() → _syncButton() → _syncMOKToKernelButton() tries to drive MOKVisualEngine colors (which may not exist yet)
- After deferring game loader: DebriefFeedController NEVER loads unless user launches a game → static SVG stays forever → video controls are dead UI

---

## Immediate Fix (This Sprint)

### Problem: Deferred loader means no theme video, dead controls
Since we deferred `gone-rogue-loader.js` to only load on AWOL, the entire debrief feed controller system never initializes for visitors who don't play games.

### Solution: Extract DebriefFeedController from the lazy loader
Move `debrief-feed-controller.js` to the sync phase in index.html (same as we did for user-account.js). It has no game dependencies — it only needs the DOM `#debrief-screen` element.

Also extract `mok-visual-engine.js` and `mok-state-machine.js` if they have no game dependencies.

Then the theme video will schedule on page load regardless of whether the user plays games.

### Additional: Hide video controls until controller is ready
The inline video/audio controls in the debrief label bar should be hidden until DebriefFeedController has initialized and a video is playing:
```css
.video-controls-inline,
.audio-controls-inline {
  display: none;
}
.debrief-video-active .video-controls-inline,
.debrief-video-active .audio-controls-inline {
  display: flex;
}
```

### Additional: Kernel status should read from KernelManager
`_renderKernelStatus()` at line 1403 has `var status = 'connected'` HARDCODED. It should read from `KernelManager.getState().state` instead.

---

## Phase 1: Unified Avatar (Simple)

### Goal
One consistent MOK avatar that renders in all states: pre-login, post-login, game mode, and idle. The current SVG pentagram-with-triangle is the placeholder.

### Implementation
1. Keep the static SVG as the default (zero-JS fallback)
2. DebriefFeedController renders into `#mok-visual-container` OVER the SVG
3. When no game is active, show the SVG with gentle CSS pulse animation
4. When DebriefFeedController loads, it crossfades from SVG to canvas
5. KernelManager color overrides only apply to the canvas layer
6. Theme video replaces the entire debrief screen (correct current behavior)

### CSS States
```css
#mok-avatar.idle        { /* default gentle pulse */ }
#mok-avatar.kernel-connected { /* green accent glow */ }
#mok-avatar.kernel-active    { /* cyan-green fast pulse */ }
#mok-avatar.kernel-error     { /* red warning pulse */ }
```

---

## Phase 2: Layered 3D WebGL Avatar

### Vision
Replace the 2D SVG/canvas with a WebGL renderer (Three.js or raw WebGL). The MOK glyph becomes a 3D object that:

1. **Idle state:** Slowly rotates on Y-axis, pentagram with equilateral triangle layers
2. **Porthole interaction:** When a magnifying glass or coin-card porthole passes over the debrief feed, the avatar reveals different hidden layers (like the porthole system reveals starfield)
3. **Drag spin:** Player can pointer-drag to spin the avatar on its axis inside the feed
4. **Kernel states:** 3D glow layers change color/intensity based on kernel connection
5. **Super Mario 64 stretch:** Vertex-deformable mesh — touch/drag to pull the face (stretch vertices)
6. **API-connected squishy:** When an external agent is connected, the avatar responds to agent state changes with squishy deformations + special tooltips

### Architecture
```
┌────────────────────────────────────┐
│  #debrief-screen                    │
│  ┌──────────────────────────────┐  │
│  │  WebGL Canvas (Three.js)     │  │
│  │                              │  │
│  │  Layers:                     │  │
│  │   0. Deep glyph (pentagram)  │  │
│  │   1. Mid glyph (triangle)   │  │
│  │   2. Core glyph (inner △)   │  │
│  │   3. Glow shell (emissive)  │  │
│  │   4. Wire frame (outline)   │  │
│  │                              │  │
│  │  Interactions:               │  │
│  │   - Y-axis drag rotation    │  │
│  │   - Porthole reveal (layers)│  │
│  │   - Vertex deformation      │  │
│  │   - Kernel color drive      │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Porthole Layer Reveal
When a `.starfield-window` canvas overlaps the debrief feed area:
- The porthole "X-rays" through the outer layers
- Inner layers become visible only through the porthole aperture
- Uses the same `getBoundingClientRect()` blit pipeline as the existing starfield system
- The 3D avatar becomes a magnifying glass target — different layers visible at different depths

### Super Mario 64 Face Stretch
- Vertex buffer stores rest positions
- Pointer drag applies radial displacement from drag point
- Spring physics snaps vertices back when released
- Heavier deformation = bigger bounceback animation
- API agent gets responsive stretch (agent sends deformation vectors)

### Implementation Order
1. Three.js scene setup in `#mok-visual-container`
2. Basic pentagram + triangle geometry (extruded shapes)
3. Y-axis rotation (idle + drag)
4. Glow material driven by kernel state
5. Porthole interaction (layer masking via stencil buffer)
6. Vertex deformation (stretch face)
7. API agent responsive mode

---

## Files Reference

| File | Current State | Target |
|------|--------------|--------|
| `index.html` #mok-avatar SVG | Static fallback | Keep as no-JS fallback |
| `js/mok-ux.js` | Lightweight state driver | Keep for tooltip integration |
| `js/mok-visual-engine.js` | Canvas glyph renderer | Replace with WebGL in Phase 2 |
| `js/mok-state-machine.js` | Animation state machine | Extend for 3D states |
| `js/debrief-feed-controller.js` | Manages display mode | Extract from lazy loader |
| `js/kernel-manager.js` | Drives MOK colors | Wire to 3D glow materials |

---

## Hardcoded Kernel Status Bug

`debrief-feed-controller.js` line 1403:
```javascript
var status = 'connected'; // HARDCODED — always shows connected
```
Should be:
```javascript
var status = (typeof KernelManager !== 'undefined' && KernelManager.getState)
  ? KernelManager.getState().state.toLowerCase()
  : 'disconnected';
```
