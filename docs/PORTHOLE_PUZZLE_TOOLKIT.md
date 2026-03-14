# Porthole & Puzzle Toolkit — Technical Reference

> **Status**: Canonical
> **Effective**: 2026-03-13 (rev 2)
> **Audience**: Developers, contractors, AI agents
> **Cost of ignoring this doc**: ~$1,000 (measured)

---

## 1. The $1,000 Bug — Read This First

A CSS stacking context bug made the porthole windows invisible for weeks. Multiple contractors attempted fixes to the starfield brightness, canvas sizing, and vignette strength — all wrong. The root cause was a single missing `z-index` declaration.

### What Happened

Every `.coin-card` has a `::after` pseudo-element that provides the card's 3D edge thickness:

```css
.splash-dossier.coin-card::after {
  position: absolute;
  inset: 0;
  background: var(--theme-face-gradient);   /* opaque warm gradient */
  transform: translateZ(-8px);               /* CREATES stacking context */
}
```

The `transform` property creates a stacking context at effective z-index 0. The starfield canvas inside the card also has z-index 0. When two elements share the same z-index, **DOM order wins** — and `::after` comes after all card children in the tree. Result: the opaque theme gradient painted directly on top of the starfield canvas, covering the porthole with the card's own background color.

### The Fix

```css
.splash-dossier.coin-card::after {
  /* ... existing properties ... */
  z-index: -1;   /* paint BEHIND card content */
}
```

One line. The `::after` now renders behind all card content, the starfield canvas is no longer covered, and the porthole shows through to the star volume.

### The Rule

**Any element with `transform`, `filter`, `will-change`, `opacity < 1`, or `contain: paint` creates a stacking context.** If that element has an opaque background and overlaps the porthole, it will cover the starfield. Always verify with:

```js
// Debug: sample porthole canvas center pixel
const canvas = document.querySelector('.starfield-window');
const px = canvas.getContext('2d').getImageData(100, 100, 1, 1).data;
console.log('Porthole center RGBA:', px);
// Expected: near-black [0, 0, 0, 255] or faint star [240+, 240+, 245+, α]
// Bug: warm olive [26, 24, 16, 255] ← card background bleeding through
```

---

## 2. Porthole Architecture

The porthole system creates the illusion of looking through a circular window in each card to a shared star volume that spans the entire viewport.

### Layer Stack (bottom to top)

```
Z-INDEX   ELEMENT                          ROLE
───────   ───────                          ────
-1        .coin-card::after                Card edge/shadow (MUST be -1)
 0        .starfield-master (opacity:0)    Offscreen render target
 0        .splash-atmosphere               CSS fog/gradient background
 1        .splash-video-layer              Optional video backdrop
 0        .starfield-window (per card)     Porthole canvas (inside card)
 1        .coin-rings                      Concentric ring frame
 5        .coin-suit-large                 Suit icon (♠♣♥♦)
 5        .coin-info, .coin-header         Text overlays
10        .coin-corner                     Corner suit symbols
50        .coin-border-inner::before       Metallic sheen sweep
```

### Render Pipeline

Rendering is handled by the **shared starfield module** (`/js/starfield.js`, see Section 2a). The module owns a hidden master canvas and blits into every `.starfield-window` canvas each frame.

```
┌────────────────────────────────────────────────────────────┐
│  Master Canvas (position: fixed, opacity: 0)               │
│  Full viewport, repainted every RAF tick by starfield.js   │
│                                                            │
│  Render order:                                             │
│    1. Pure black fill (#000000)                            │
│    2. Star layers ×4 (dust → foreground, varied drift)     │
│    3. Milky Way blue glow (faint diagonal band)            │
│    4. Milky Way dense stars (350 white pixel points)       │
│    5. Turing clusters (blue nebular glow + white stars)    │
└──────────────┬─────────────────────────────────────────────┘
               │
     getBoundingClientRect() per porthole
               │
               ▼
┌──────────────────────────────┐
│  Per-Porthole .starfield-    │
│  window canvas (200×200)     │
│  drawImage(master, sx,sy,    │
│            sw,sh, 0,0,cw,ch) │
│  + radial vignette overlay   │
└──────────────────────────────┘
```

Every `.starfield-window` canvas in the document — on any page — is automatically picked up by `document.querySelectorAll()` each frame. This means:

- All portholes on a page look into the **same** star volume
- Scrolling moves portholes through a static starfield (magnifying glass behavior)
- Drag-ghost portholes get free parallax via their changing `getBoundingClientRect()`
- Adding a new porthole anywhere in the DOM is instant — no registration needed

### Star Layer Definitions

| Layer | Count | Radius | Speed | Opacity | Drift Angle | Twinkle |
|-------|-------|--------|-------|---------|-------------|---------|
| Deep dust | 600 | 0.2–0.4 | 0.00003 | 0.35 | 0.2 rad | yes |
| Mid-field | 140 | 0.3–0.5 | 0.00012 | 0.65 | 1.1 rad | yes |
| Bright | 50 | 0.4–0.8 | 0.00025 | 0.85 | 2.5 rad | yes |
| Foreground | 18 | 0.5–1.0 | 0.0005 | 0.95 | 3.8 rad | no |

**Design intent**: Stars are crisp white pixel points on a pure black void. Radii are deliberately small so most stars render as single-pixel `fillRect` calls (threshold `r < 0.6`). Only the brightest foreground stars get a tight glow halo (2× radius, 3% alpha). Varied drift angles per layer prevent the "diagonal snow" effect.

### Star Color Distribution

- **85%** clean white (R: 240–255, G: 240–255, B: 245–255)
- **9%** cool blue-white (R: 220–240, G: 225–245, B: 255)
- **6%** rare warm pale (R: 255, G: 240–255, B: 220–240)

### Blue Cluster Glow

Dense star clusters (Turing pattern groupings and the Milky Way band) emit a subtle blue nebular glow, as if the concentration of stars is illuminating nearby gas. This is the **only color** in an otherwise black-and-white starfield.

- **Turing clusters**: radial gradient per cluster, `rgba(40, 80, 200, 0.12)` center fading to transparent, with a slow pulse animation
- **Milky Way band**: faint linear gradient along the diagonal, `rgba(35, 70, 200, 0.05)` peak

### Ring Frame Gradient

The `.coin-rings` element creates the porthole's engraved-coin frame via two radial gradients:

1. **Dark bands**: transparent 0–46% (the aperture), then 7 concentric bands fading from rgba(0,0,0,0.82) at 46% to transparent at 75%.
2. **Glow accents**: theme-colored hairlines at each band boundary (48%, 52.5%, 57%, 61.5%, 66%, 70.5%, 75%).

The `.coin-rings::after` pseudo adds fine radial hatching (repeating conic gradient) masked to the 30–100% ring zone so it doesn't cover the aperture.

### Porthole Vignette

After blitting from master, each porthole canvas applies a radial vignette:

```
Inner radius 35% → transparent
60% stop → rgba(4,3,8, 0.3)
Outer radius 50% → rgba(10,8,16, 0.85)
```

This softens the edge where the canvas meets the ring frame's dark innermost band.

---

## 2a. Shared Starfield Module (`/js/starfield.js`)

The starfield is now a standalone, reusable module. Any page can include it to get a full-viewport starfield with automatic porthole blitting.

### Quick Start

```html
<!-- Add to any page that needs porthole windows -->
<script src="/js/starfield.js"></script>
<script>
  EyesOnlyStarfield.init();
  // That's it. Drop <canvas class="starfield-window"> anywhere in the DOM.
</script>
```

### How It Works

1. `init()` creates a hidden `position: fixed` master canvas covering the viewport (or reuses an existing canvas via `masterEl`)
2. Every RAF tick, the module renders the starfield into the master canvas
3. Every RAF tick, the module queries `document.querySelectorAll('.starfield-window')` and blits each canvas's screen-space region from the master
4. Because the master is fixed and the porthole positions come from `getBoundingClientRect()`, scrolling the page moves portholes through the static starfield — the magnifying glass contract

### API

```js
EyesOnlyStarfield.init({
  selector:    '.starfield-window',  // CSS selector for porthole canvases
  seed:        42,                    // RNG seed (reproducible star placement)
  masterEl:    canvas,                // reuse existing canvas (splash screen)
  parentEl:    document.body,         // where to append auto-created master
  masterClass: 'starfield-master',   // CSS class for auto-created master
});

EyesOnlyStarfield.destroy();          // stop rendering, clean up
EyesOnlyStarfield.getMasterCanvas();   // access the master canvas element
EyesOnlyStarfield.isRunning();         // check if actively rendering
```

### Page Integration Patterns

**Splash screen** (`index.html`): The splash screen has its own `#starfield-master` canvas in the DOM template. It passes this as `masterEl` so the module reuses it instead of creating a new one:

```js
EyesOnlyStarfield.init({
  masterEl: document.getElementById('starfield-master'),
  selector: '.starfield-window',
  seed: 42,
});
```

**Booking page** (`booking.html`): No pre-existing master canvas. The module auto-creates a `position: fixed` canvas on `document.body`. The two scenario portholes are regular `.starfield-window` canvases that scroll with the page:

```js
EyesOnlyStarfield.init();  // auto-creates master, finds porthole canvases
```

**Any future page**: Include the script, call `init()`, add `<canvas class="starfield-window" width="200" height="200">` wherever you need a porthole. No registration, no configuration — just DOM presence.

### Adding a Porthole to Any Page

```html
<div style="position: relative; width: 200px; height: 200px; border-radius: 50%; overflow: hidden;">
  <canvas class="starfield-window" width="200" height="200"
          style="position: absolute; width: 100%; height: 100%; border-radius: 50%;"></canvas>
  <!-- Optional: add .coin-rings or .scenario-rings overlay for the frame -->
  <!-- Optional: add suit symbol or other content on top -->
</div>
```

The porthole will immediately start showing the starfield region at its screen position. Scroll, drag, or animate the container and the starfield updates automatically.

---

## 3. CSS Stacking Context — Rules for Contributors

### Properties That Create Stacking Contexts

If you add ANY of these to an element that overlaps a porthole, you MUST verify the porthole still works:

- `transform` (any value except `none`)
- `filter` (any value except `none`)
- `will-change` (transform, opacity, filter, etc.)
- `opacity` less than 1
- `mix-blend-mode` (any value except `normal`)
- `contain: paint` or `contain: layout paint`
- `isolation: isolate`
- `position: fixed` or `position: sticky`
- `-webkit-overflow-scrolling: touch`
- `clip-path`, `mask`, `mask-image`

### Verification Checklist

Before merging any CSS change that touches card or porthole elements:

1. Open the splash screen — confirm portholes show sharp white stars on pure black (not warm olive card body)
2. Open the booking page — confirm both scenario portholes show starfield and scroll independently of it
3. Run the debug pixel sample (Section 1) on at least one card
4. Check all 4 card themes: silver, amber, phosphor, panther
5. Drag a card — confirm the ghost porthole shows the starfield updating as it moves
6. On mobile viewport — confirm the circular ghost porthole works

### Theme Variables That Affect the Porthole

```css
--theme-face-gradient     /* On ::after — MUST stay at z-index: -1 */
--theme-border-inner      /* Card body background — porthole contrasts against this */
--theme-primary-glow      /* Ring accent color */
--theme-ring-tint         /* Radial hatching color */
--theme-hover-ring        /* Inner border glow on hover */
```

---

## 3a. Drag Ghost as Magnifying Glass

When a player drags a card on the splash screen, the card becomes a floating porthole that reveals the starfield underneath as it moves. This is the magnifying glass effect in action.

### How It Works (Zero Extra Code)

1. `_createDragGhost()` calls `cardEl.cloneNode(true)` — the clone includes a `.starfield-window` canvas
2. The ghost is appended to `document.body`
3. The starfield module's blit loop queries `document.querySelectorAll('.starfield-window')` every frame
4. The ghost's cloned canvas is found by that query
5. `getBoundingClientRect()` reads the ghost's current screen position
6. The corresponding starfield region is blitted into the ghost's canvas
7. As the user drags, the position changes, the blit region changes, and the starfield scrolls through the porthole

No event wiring, no registration, no special case. The magnifying glass effect is a natural consequence of the architecture.

### Ghost CSS Class

The ghost uses `.coin-card-ghost` (not `.coin-card-hovered`) to avoid `!important` conflicts:

- All `transform` and `z-index` set via `style.setProperty('...', '...', 'important')` in JS
- Mobile (`< 769px`): circular porthole ghost, non-porthole content hidden via `display: none !important`
- Desktop: full card ghost with working porthole
- `touch-action: none` on `.coin-artwork` prevents browser scroll during drag

### The `!important` Lesson

`.coin-card-hovered` uses `!important` on `transform` and `z-index` for hover lift. If the drag ghost kept that class, inline drag positioning would be overridden. The fix was a dedicated `.coin-card-ghost` class with no `!important` declarations, letting JS `setProperty('...', '...', 'important')` win.

**Rule**: Never add `!important` to `transform` or `z-index` on an element that might be dragged. Use a separate class for drag ghosts.

---

## 3b. Booking Page Portholes

The booking page (`/booking.html`) uses the same porthole system as the splash screen, replacing emoji placeholders (🎯 and 🗺) with live starfield windows.

### Structure

```html
<div class="scenario-icon-wrap">
  <canvas class="starfield-window" width="200" height="200"></canvas>
  <div class="scenario-rings"></div>          <!-- or scenario-rings-alt -->
  <div class="scenario-suit suit-spade">♠</div>  <!-- or suit-club ♣ -->
</div>
```

### Ring Variants

- **Scenario 1**: `.scenario-rings` — green accent lines (`rgba(28, 255, 155)`)
- **Scenario 2**: `.scenario-rings-alt` — amber/gold accent lines (`rgba(201, 168, 76)`)

### Scroll Behavior

Because the starfield module uses a `position: fixed` master canvas and the porthole canvases scroll with the page, scrolling moves the portholes through the static starfield. Each porthole shows a different region of the starfield depending on its vertical position on the page.

### Suit Mapping

| Scenario | Suit | Class | Accent Color |
|----------|------|-------|-------------|
| Scenario 1 | ♠ spade | `suit-spade` | Green `#1cff9b` |
| Scenario 2 | ♣ club | `suit-club` | Amber `#c9a84c` |

---

## 4. Magnifying Glass Widget Spec

The porthole technique — a CSS-masked hole through a foreground element revealing a background canvas — can be reused as a **magnifying glass puzzle widget** throughout the site.

### Concept

A draggable or positionable circular lens that reveals hidden content beneath a surface layer. The player moves the lens to discover clues, decode messages, find hidden objects, or read invisible ink.

### Architecture

```
┌────────────────────────────────────────────┐
│  Hidden Layer (canvas or DOM)              │
│  Contains: clues, decoded text, ARG items  │
│  Position: absolute, z-index: 0            │
│  Visibility: hidden from direct view       │
└────────────┬───────────────────────────────┘
             │
             │  Revealed through lens aperture
             │
┌────────────▼───────────────────────────────┐
│  Surface Layer (opaque cover)              │
│  Contains: visible page content            │
│  Position: absolute, z-index: 1            │
│  Mask: circular hole follows lens position │
└────────────────────────────────────────────┘
             │
┌────────────▼───────────────────────────────┐
│  Lens Frame (cosmetic ring overlay)        │
│  Contains: ring graphics, glow effects     │
│  Position: absolute, z-index: 2            │
│  Follows: mouse/touch input                │
└────────────────────────────────────────────┘
```

### Implementation Pattern

```css
/* Surface layer — the "cover" hiding the puzzle content */
.puzzle-surface {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--surface-content);
  /* Circular mask that follows the lens — updated via JS */
  mask-image: radial-gradient(
    circle 80px at var(--lens-x) var(--lens-y),
    transparent 0%, transparent 78px,
    black 80px, black 100%
  );
  -webkit-mask-image: radial-gradient(
    circle 80px at var(--lens-x) var(--lens-y),
    transparent 0%, transparent 78px,
    black 80px, black 100%
  );
}

/* Hidden layer — revealed through the mask hole */
.puzzle-hidden {
  position: absolute;
  inset: 0;
  z-index: 0;
}

/* Lens frame — decorative ring that follows cursor */
.puzzle-lens {
  position: absolute;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  z-index: 2;
  pointer-events: none;
  transform: translate(-50%, -50%);
  left: var(--lens-x);
  top: var(--lens-y);
  /* Reuse the coin-rings porthole aesthetic */
  background: /* same radial-gradient bands as .coin-rings */;
  box-shadow:
    inset 0 0 12px rgba(0, 0, 0, 0.8),
    0 0 8px rgba(20, 10, 40, 0.3);
}
```

```js
// Lens position tracking
const container = document.querySelector('.puzzle-container');
container.addEventListener('pointermove', (e) => {
  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  container.style.setProperty('--lens-x', x + 'px');
  container.style.setProperty('--lens-y', y + 'px');
});
```

### Critical Rule: No Stacking Context Conflicts

The surface layer uses `mask-image` which **creates a stacking context**. Any child of the surface with `transform`, `filter`, or other stacking-context triggers will be isolated inside that context. If hidden content needs to be interactive, place interactive elements in a separate layer above the surface (z-index 3+), not inside the masked surface.

---

## 5. Puzzle Integration Patterns

### Pattern A: Hidden Object Discovery

Players sweep the magnifying glass over a scene to find ARG items.

```
Surface:    A normal-looking photograph or document
Hidden:     Same image with highlighted hotspots (glowing outlines)
Trigger:    Lens reveals hotspot → click to collect ARG item
Data:       arg_items.json (ITM-001 through ITM-013)
```

**Integration with Discovery System** (`discovery-system.js`):

```js
// Map discovery tiers to lens reveal difficulty
const LENS_TIERS = {
  SURFACE: { hint: true, glowRadius: 40 },      // obvious glow even without lens
  SEMI_HIDDEN: { hint: false, glowRadius: 30 },  // only visible through lens
  CONCEALED: { hint: false, glowRadius: 20 },    // small reveal radius
  HIDDEN: { hint: false, glowRadius: 10 },       // nearly pixel-hunt
  META: { hint: false, glowRadius: 5 },           // requires external knowledge
};
```

### Pattern B: Decoder Lens

The magnifying glass reveals decoded text beneath an encoded surface.

```
Surface:    Cipher text, redacted document, or scrambled message
Hidden:     Decoded plaintext positioned to align with cipher
Trigger:    Lens reveals decoded text in-place as player reads
Data:       arg_beats.json (narrative beats unlocked by decoding)
```

**Implementation note**: Use a shared canvas for the hidden layer (same as starfield master pattern). The decoder content renders to the canvas, and the lens mask reveals it through the surface.

### Pattern C: Starfield Porthole Puzzles

Puzzles embedded directly in the existing splash card portholes.

```
Surface:    The coin-rings frame (already transparent center)
Hidden:     Starfield master canvas with embedded puzzle elements
Trigger:    Specific star patterns, constellations, or Turing clusters
Data:       arg_synergies.json (item combos that unlock star patterns)
```

**Extension point**: The shared starfield module's master canvas can be extended to render puzzle elements (constellation lines, hidden symbols, the 25%-off checkout code) that are only visible through porthole canvases based on their screen position. Since `starfield.js` is a single global module, puzzle overlays can be rendered onto `EyesOnlyStarfield.getMasterCanvas()` in a post-render hook, and they'll automatically appear in any porthole that happens to cover that region — including a dragged ghost card.

### Pattern D: UV / Blacklight Lens

A lens that changes the rendering mode of the hidden layer rather than revealing a pre-rendered layer.

```
Surface:    Normal page content
Hidden:     Same content re-rendered with UV shader (dark bg, fluorescent highlights)
Trigger:    Lens applies CSS filter to the visible region
Data:       Interactive items (BOOK, POSTER, PAINTING from interactive-items.js)
```

```css
/* UV lens effect — filter applied to revealed region */
.puzzle-hidden.uv-mode {
  filter: invert(1) hue-rotate(180deg) saturate(3) brightness(0.8);
  background: #0a0020;
}
```

---

## 6. Widget API Spec

### MagnifyingGlass Class

```js
/**
 * Reusable magnifying glass widget.
 * Creates a draggable lens that reveals hidden content beneath a surface.
 *
 * @param {HTMLElement} container - The puzzle container element
 * @param {Object} options
 * @param {number}  options.radius       - Lens radius in px (default: 80)
 * @param {string}  options.theme        - Theme name: 'amber'|'silver'|'phosphor'|'panther'
 * @param {boolean} options.draggable    - Allow drag vs follow-cursor (default: false)
 * @param {string}  options.ringStyle    - 'coin' (default) | 'minimal' | 'none'
 * @param {number}  options.feather      - Edge feather in px (default: 2)
 * @param {Function} options.onReveal    - Callback when hotspot enters lens: (hotspotId, element) => {}
 * @param {Function} options.onCollect   - Callback when hotspot clicked inside lens: (hotspotId) => {}
 */
class MagnifyingGlass {
  constructor(container, options = {}) { /* ... */ }

  /** Move lens to position (px relative to container) */
  moveTo(x, y) { /* ... */ }

  /** Show/hide the lens */
  show() { /* ... */ }
  hide() { /* ... */ }

  /** Register a hotspot (clickable discovery point) */
  addHotspot(id, x, y, radius, tier = 'SEMI_HIDDEN') { /* ... */ }

  /** Remove a hotspot (after collection) */
  removeHotspot(id) { /* ... */ }

  /** Switch hidden layer content */
  setHiddenContent(element) { /* ... */ }

  /** Apply a filter mode to the hidden layer */
  setFilter(filterCSS) { /* ... */ }

  /** Clean up event listeners and DOM */
  dispose() { /* ... */ }
}
```

### Event Hooks

```js
const lens = new MagnifyingGlass(container, {
  radius: 80,
  theme: 'amber',
  onReveal: (hotspotId, el) => {
    // Hotspot entered lens view — play audio cue
    AudioSystem.play('discovery-ping');
  },
  onCollect: (hotspotId) => {
    // Player clicked revealed hotspot — award ARG item
    const item = ARG_ITEMS.find(i => i.id === hotspotId);
    InventorySystem.addItem(item);
    lens.removeHotspot(hotspotId);
  },
});

// Dynamic hotspots from arg_items.json
argItems.forEach(item => {
  lens.addHotspot(item.id, item.location.x, item.location.y, 20, item.discoveryTier);
});
```

### DOM Structure (generated)

```html
<div class="puzzle-container" style="position: relative; overflow: hidden;">
  <!-- Hidden layer: puzzle content (z-index 0) -->
  <div class="puzzle-hidden">
    <!-- Hotspots, decoded text, starfield, etc. -->
  </div>

  <!-- Surface layer: opaque cover with CSS mask hole (z-index 1) -->
  <div class="puzzle-surface" style="mask-image: radial-gradient(...)">
    <!-- Visible page content -->
  </div>

  <!-- Lens frame: decorative ring (z-index 2) -->
  <div class="puzzle-lens">
    <div class="puzzle-lens-rings"></div>
    <div class="puzzle-lens-glow"></div>
  </div>

  <!-- Interaction layer: clickable hotspot targets (z-index 3) -->
  <div class="puzzle-interaction">
    <!-- Transparent click targets aligned with hotspots -->
  </div>
</div>
```

### Stacking Context Safety Checklist

Before adding a magnifying glass widget to any page:

1. **Audit parent elements** for `transform`, `filter`, `will-change`, `opacity < 1`
2. **Verify mask-image support** — fallback to canvas-based clipping for older browsers
3. **Test all 4 themes** — ring colors and glow accents change per theme
4. **Confirm no z-index collisions** — especially with existing `position: fixed` or `position: sticky` elements
5. **Check mobile touch** — `pointermove` works on touch; add `touch-action: none` to container
6. **Verify no elements with `pointer-events: none`** sit between the interaction layer and the user

---

## 7. Integration with Existing Systems

### Draw Modifier (Magnifying Glass Item)

The in-game magnifying glass item (`backup-action-container.js`) already exists as a draw modifier:

- **Detection**: item ID contains `'magnif'`, `'mag-glass'`, or equals `'itm-mag'`
- **Behavior**: changes backup deck draw to targeted pick (tap slot 1–5)
- **Emoji**: 🔍
- **State query**: `CardStateAuthority.getEquippedDrawModifier()` returns `'magnifying-glass'`

The puzzle toolkit lens should use the same item ID pattern so equipping the magnifying glass in-game also enables the puzzle lens on ARG pages.

### ARG Item Integration

```
arg_items.json    →  Hotspot data (id, location, type, rarity)
arg_beats.json    →  Narrative rewards (unlocked when item found)
arg_synergies.json → Combo triggers (pairs of items unlock beats)
```

### Discovery Tier Mapping

| Discovery Tier | Lens Glow Radius | Hint Visible | Typical Use |
|---------------|-----------------|-------------|-------------|
| SURFACE | 40px | yes (glows without lens) | Tutorial items |
| SEMI_HIDDEN | 30px | no | Standard puzzle items |
| CONCEALED | 20px | no | Challenge items |
| HIDDEN | 10px | no | Expert items |
| META | 5px | no | Multi-session / cross-page |

### Theme Variables for Lens

```css
/* Reuse existing theme variables for lens styling */
--theme-primary-glow     /* Lens ring accent color */
--theme-ring-tint        /* Lens hatching tint */
--theme-hover-highlight  /* Lens edge highlight on hover */
--theme-hover-glow       /* Lens outer glow */
--theme-btn-border       /* Lens frame border */
```

---

## 8. Files Reference

### Shared Starfield Module
| File | Role |
|------|------|
| `public/js/starfield.js` | **Shared starfield module** — master canvas, star generation, porthole blit pipeline. Include on any page that needs porthole windows. |

### Splash Screen
| File | Role |
|------|------|
| `public/js/splash-screen.js` | Card interactions, drag-ghost system. Delegates starfield to `starfield.js` via `EyesOnlyStarfield.init({ masterEl })` |
| `public/css/splash-screen.css` | Card layout, ring gradients, z-index stack, ghost class, drag styles |
| `public/js/card-coin-3d.js` | Three.js coin with starfield texture injection (currently disabled) |
| `public/css/themes.css` | Theme variables (4 themes × ~50 vars each) |

### Booking Page
| File | Role |
|------|------|
| `public/booking.html` | Scenario detail pages with porthole + suit symbol replacing emoji placeholders |
| `public/js/booking.js` | Booking form logic. Calls `EyesOnlyStarfield.init()` (auto-creates master) |
| `public/css/booking.css` | Porthole rings, suit symbols, scenario-specific ring accents (green / amber) |

### Puzzle / ARG Data
| File | Role |
|------|------|
| `public/data/arg_items.json` | 13 collectible ARG items |
| `public/data/arg_beats.json` | 4 narrative beats |
| `public/data/arg_synergies.json` | Item combo triggers |
| `public/data/arg/` | JSON schemas for all ARG data |
| `public/js/discovery-system.js` | 5-tier discovery generation |

### Magnifying Glass (In-Game)
| File | Role |
|------|------|
| `public/js/backup-action-container.js` | Draw modifier UI (🔍 mode) |
| `public/js/card-state-authority.js` | Equipment state query |

### Related Documentation
| File | Topic |
|------|-------|
| `docs/COLLECTIBLES_CANON.md` | Collectible categories and pickup pipeline |
| `docs/COLLECTIBLES-VISUAL-SYSTEM.md` | Emoji vs ASCII rendering rules |
| `docs/NCH-COMBAT-ROADMAP.md` | Draw modifier system design |
| `docs/UI-CANON.md` | UI standards |

---

## Appendix: Quick Diagnostic

If a porthole stops working after a CSS change, run this in the console:

```js
(function diagnosePorthole() {
  const card = document.querySelector('.coin-card');
  const canvas = card.querySelector('.starfield-window');
  const after = getComputedStyle(card, '::after');

  // 1. Check ::after z-index
  const afterZ = after.zIndex;
  console.log('::after z-index:', afterZ, afterZ === '-1' ? '✓' : '✗ MUST be -1');

  // 2. Check canvas pixel
  const ctx = canvas.getContext('2d');
  const px = ctx.getImageData(100, 100, 1, 1).data;
  const isBlack = px[0] < 30 && px[1] < 30 && px[2] < 30;
  console.log('Canvas center:', px, isBlack ? '✓ (dark/star)' : '✗ (bright — covered?)');

  // 3. Check stacking contexts between canvas and viewer
  let el = canvas.parentElement;
  while (el && !el.classList.contains('coin-card')) {
    const cs = getComputedStyle(el);
    const triggers = [];
    if (cs.transform !== 'none') triggers.push('transform');
    if (cs.filter !== 'none') triggers.push('filter');
    if (cs.opacity !== '1') triggers.push('opacity:' + cs.opacity);
    if (cs.willChange !== 'auto') triggers.push('will-change:' + cs.willChange);
    if (triggers.length) {
      console.warn('Stacking context on', el.className, '→', triggers.join(', '));
    }
    el = el.parentElement;
  }
})();
```
