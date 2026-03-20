# Smart Watch Widget — Polish Roadmap

> **Status:** Stage 1 Complete — March 19, 2026
> **Priority:** MEDIUM-HIGH — site-wide audio + MOK access
> **Depends on:** AccountInventory, AudioSystem, mok-pyramid.css, MOKStateMachine

---

## Stage 1: Foundation (Complete)

Pixel art wristwatch widget with CRT green screen. Opens a modal overlay containing the full MOK debrief feed (pyramid + interactive poke/spin/squish) and audio controls panel (master mute, music/SFX sliders, now playing).

**Delivered:**
- ITM-204 Smart Watch in items.json, seeded as default account item
- `debrief_feed: true` meta tag — any item with this tag unlocks the widget
- CSS sprite: leather straps, metallic case, side crown, CRT screen with scanlines
- Pulsing MOK triangle glyph on mini screen, audio status dot
- Draggable minimized state, localStorage position persistence
- Full 4:3 debrief viewport with MOK pyramid and interactive states
- Audio panel: mute, music vol, SFX vol, now playing
- Item-gated via AccountInventory, hides audio-mini-widget when present
- Wired into index.html, games.html, booking.html, contact.html, partners.html
- Keyboard: W to toggle, Escape to close

**Files:**
- `css/smart-watch-widget.css`
- `js/smart-watch-widget.js`
- `data/gone-rogue/items.json` (ITM-204)
- `js/account-inventory.js` (DEFAULT_ITEMS seed)

---

## Stage 2: Visual Polish

Refine the pixel art sprite and overlay to match the game's CRT aesthetic more tightly.

### 2a. Sprite Refinement
- Add subtle idle animation to the mini screen (MOK glyph breathing, occasional flicker)
- Watch crown button: press animation on expand (CSS transform squeeze)
- Leather strap wear texture: darker edges, stitch marks via box-shadow pixel dots
- Theme-aware strap color: darker leather for panther theme, warm brown for amber
- Add a tiny pixel time display on the screen (cycles between time and MOK glyph)

### 2b. Overlay Polish
- CRT power-on animation when expanding (horizontal line → full screen, like the terminal splash)
- Degauss color sweep on the 4:3 viewport (reuse splash-screen CRT effect)
- Subtle vignette and curvature on the viewport corners
- Close animation: CRT power-off (screen collapses to horizontal line, then dot, then gone)
- Add theme video background behind the MOK pyramid (same as terminal debrief feed)

### 2c. Sound Integration
- Click/tap on watch: mechanical click SFX (wind-up watch)
- Expand: CRT buzz-on SFX
- Minimize: CRT power-down whine
- Slider interaction: soft tick SFX on thumb snap points

---

## Stage 3: Watch Faces

Multiple watch face variants unlocked by different items. Each face has a distinct visual style and potentially different functionality focus.

### 3a. Watch Face System
- `watchFace` meta field on items: `"watchFace": "standard"`, `"oscilloscope"`, `"tactical"`, etc.
- SmartWatchWidget reads the equipped face from inventory and swaps sprite + overlay skin
- CSS class on widget root: `.sw-face-standard`, `.sw-face-oscilloscope`, `.sw-face-tactical`
- Face-specific mini screen content (different glyphs, different idle animations)

### 3b. Standard Face (Current)
- The default leather strap + CRT screen. MOK glyph, audio dot.
- Full debrief feed overlay with audio controls.

### 3c. Tactical Face
- Metal bracelet strap (gunmetal/brushed steel pixel art)
- Mini screen shows: compass heading + MOK state icon
- Overlay adds: compass readout, kernel status, resource summary alongside debrief feed
- Unlocked by a "Field Watch Upgrade" item

### 3d. Oscilloscope Face (Target Feature)
- Lab equipment aesthetic: chunky gray plastic case, BNC connector nubs on sides
- Mini screen: animated sine wave trace (CSS animation or tiny canvas)
- Two test leads (probes) that hang from the widget with rope physics
- See Stage 4 for full lead/rope spec

---

## Stage 4: Oscilloscope Test Leads & Rope Physics

The signature feature. The oscilloscope face has two test leads (red + black probes) connected by flexible cables that exhibit rope physics behavior. Leads can be "plugged into" UI elements to inspect/interact with them.

### Reference: Obi Rope Physics (Unity)
The project includes Obi Advanced Ropes (`/EyesOnly/Obi/`) — a Unity constraint-based rope simulation with bend-twist constraints, Darboux vector quaternion orientation, and procedural mesh rendering. We won't port Obi directly but will implement a lightweight JS verlet rope inspired by its constraint-solving approach.

### 4a. Verlet Rope Engine (`rope-physics.js`)
A standalone, reusable verlet integration rope simulator:

- **Particles:** N points along the cable (12–16 segments), each with position + previous position
- **Constraints:** Distance constraints between adjacent particles (maintains cable length)
- **Gravity:** Gentle downward pull (configurable per cable)
- **Damping:** Velocity damping to prevent perpetual oscillation
- **Twist:** Visual twist along the cable using a parallel transport frame
  - Each segment tracks a twist angle accumulated from the endpoints
  - When a lead is moved, twist propagates along the cable
  - Inspired by Obi's BendTwist constraints but simplified to 2D projected twist
- **Collision:** Simple rectangle collision against the widget bounding box and viewport edges
- **Rendering:** Canvas 2D or SVG path with round linecap, gradient stroke (rubber insulation look)
- **Performance:** requestAnimationFrame loop, only runs when widget is visible
  - Pause simulation when overlay is closed and leads are docked
  - 60fps target with automatic substep reduction on low-end devices

### 4b. Test Lead Probes
Two probes (red, black) that hang from the oscilloscope widget:

**Docked State (default):**
- Leads hang from BNC connectors on the sides of the oscilloscope case
- Cables drape naturally under gravity (verlet sim settles into catenary)
- Probe tips point downward, resting against the widget housing
- Subtle idle sway animation (gentle perturbation every few seconds)

**Dragging State:**
- User drags a probe tip away from the dock
- Cable stretches and follows with realistic rope physics
- Cable twists when the user rotates/circles the probe
  - Twist accumulates visually (cable appears to wind up)
  - Inspired by Obi's Plectoneme sample: helical bunching when over-twisted
- Other probe stays docked (or can be dragged independently)

**Attached State:**
- Probe tip snaps to a compatible UI element (see 4c)
- Cable maintains physical connection, still simulated
- Probe tip glows with the theme color when successfully attached
- Oscilloscope screen shows the "signal" from the attached element

**Released State (not properly hung up):**
- If user closes the overlay without re-docking the leads:
  - Cables bounce and twist as the overlay collapses
  - Leads swing freely, dangling from the minimized widget
  - Cable physics continue on the minimized sprite (tiny dangling leads)
  - Subtle bounce on each page navigation (rehang SFX plays)
  - A "hang up your leads!" tooltip appears after 10s
  - Tapping the minimized widget auto-re-docks the leads with a snap animation

### 4c. UI Element Attachment Points
Certain UI elements become "probe targets" when the oscilloscope face is active:

- **Audio sliders:** Attach to read volume level as waveform on oscilloscope screen
- **MOK pyramid:** Attach to read MOK state as signal pattern
- **Terminal output:** Attach to see text as signal bursts
- **Kernel status:** Attach to see connection heartbeat
- **NCH capsule:** Attach to read card values
- **Theme selector:** Attach to preview theme colors as frequency spectrum

Each target element gets a subtle pulsing ring indicator when a probe is being dragged near it. Attachment uses proximity snapping (within 20px of center).

### 4d. Oscilloscope Screen Rendering
When leads are attached, the mini screen and overlay viewport show:

- **Waveform display:** Horizontal time-domain trace (sine, square, noise depending on source)
- **Grid overlay:** Classic green-on-black oscilloscope grid (8x10 divisions)
- **Trigger level:** Horizontal dashed line
- **Signal label:** Source name in top-left (e.g., "CH1: MUSIC VOL", "CH2: MOK STATE")
- **Dual channel:** Red trace (CH1) and white trace (CH2) when both leads attached
- Canvas 2D rendering, shared with the rope physics animation loop

### 4e. Item & Unlock
- ITM-205 "Oscilloscope Probe Kit" — equipment, rare
  - `"watchFace": "oscilloscope"`, `"debrief_feed": true`
  - Unlocks oscilloscope face on the smart watch
  - Description: "Portable signal analyzer with dual-channel probes. Plug the leads into any UI element to read its signal. Don't forget to hang up your leads."
  - Could be a reward from completing a puzzle or reaching a game milestone

---

## Stage 5: Advanced Rope Interactions

Further rope physics polish once the verlet engine is stable.

### 5a. Cable Tangling
- When both cables cross paths, they visually intertwine
- Untangling requires dragging one probe around the other (like real cables)
- Achievement: "Cable Management" for untangling without detaching

### 5b. Cable Customization
- Cable color/material variants (rubber, braided, coiled retractable)
- Cable length adjustment (longer = more droop, shorter = taut)
- Unlockable via items or achievements

### 5c. Environmental Interaction
- Cables react to page scroll (gentle sway)
- Cables react to device tilt (accelerometer on mobile)
- Wind effect when near the starfield background (particles push cables)

### 5d. Easter Eggs
- Plug both leads into the same element: sparks + overload animation
- Wrap cable around MOK pyramid: pyramid gets "lassoed," struggles to spin
- Leave leads dangling for 60s: they start swinging in sync (pendulum resonance)

---

## Implementation Priority

| Stage | Effort | Value | Priority |
|-------|--------|-------|----------|
| Stage 1: Foundation | Done | High | ✅ Complete |
| Stage 2a: Sprite refinement | Small | Medium | Next |
| Stage 2b: Overlay CRT effects | Medium | High | Next |
| Stage 2c: Sound integration | Small | Medium | After 2b |
| Stage 3a: Watch face system | Medium | High | After Stage 2 |
| Stage 3d: Oscilloscope face | Medium | High | After 3a |
| Stage 4a: Verlet rope engine | Large | Very High | Core feature |
| Stage 4b: Test lead probes | Large | Very High | After 4a |
| Stage 4c: UI attachment points | Medium | High | After 4b |
| Stage 4d: Oscilloscope screen | Medium | High | After 4c |
| Stage 5: Advanced rope | Large | Medium | Future |

---

## Technical Notes

### Verlet Rope Performance Budget
- Target: 60fps with 2 cables × 16 particles each = 32 particles total
- Constraint iterations: 3–5 per frame (sufficient for stable drape)
- Canvas render: single pass, batch stroke calls
- Should consume < 2ms/frame on mobile (budget allows ~6ms for 60fps headroom)

### Rope ↔ Obi Mapping
| Obi Concept | JS Implementation |
|-------------|-------------------|
| Particle solver | Verlet integration loop |
| Distance constraints | Fixed-length segment enforcement |
| BendTwist constraints | Accumulated twist angle per segment |
| Darboux vector | Simplified: scalar twist angle (not full quaternion) |
| ObiRopeExtrudedRenderer | Canvas 2D quadratic curves with lineWidth gradient |
| Burst jobs | Single-threaded (32 particles doesn't need workers) |
| Collision detection | AABB against widget bounds + viewport edges |

### Accessibility (QuadStick)
- Probe drag: also triggerable via keyboard (Tab to select probe, arrow keys to move)
- Snap-to-target: pressing Enter when near a target auto-attaches
- Cable physics visual-only (no gameplay gating behind cable interaction)
- Screen reader: "Oscilloscope probe 1, attached to Music Volume, reading 25%"

---

## Files (Planned)

| File | Stage | Role |
|------|-------|------|
| `css/smart-watch-widget.css` | 1 ✅ | Base styles |
| `js/smart-watch-widget.js` | 1 ✅ | Core widget module |
| `css/sw-oscilloscope.css` | 3d | Oscilloscope face skin |
| `js/sw-watch-faces.js` | 3a | Face system + switching |
| `js/rope-physics.js` | 4a | Verlet rope engine (reusable) |
| `js/sw-test-leads.js` | 4b | Probe interaction + attachment |
| `js/sw-oscilloscope-screen.js` | 4d | Waveform rendering |
