# NCH Porthole Widget — Site-Wide Roadmap

## Phase 0: Foundation — Extract & Generalize ✅

Decouple the NCH widget from `gone-rogue` into a standalone module. The capsule (draggable joker stack) now lives in `nch-overlay.js` and works on any page without game dependencies. Clicking it opens a floating coin-card fan — identical cards to the splash screen, no backdrop, page stays readable underneath. The overlay auto-transitions to full NCH game mode when GoneRogue launches and back to porthole mode when it exits. Position persists across sessions via localStorage.

**Shipped:**
- `public/js/nch-overlay.js` — standalone capsule + floating coin-card fan panel
- `public/css/nch-overlay.css` — capsule styles, fan panel (no backdrop, pointer-events pass-through)
- `non-combat-hud.js` bridge — position sync between overlay and game NCH on mode transitions
- `index.html` wired — overlay loads early, `autoStarfield: false` (splash owns its own master canvas)
- `docs/NCH_OVERLAY_EXTRACTION.md` — architecture reference

**What works:**
- Splash screen plays → dismisses → overlay capsule appears
- Desktop hover fans out joker stack; drag repositions; click toggles coin-card fan
- Coin-cards reuse `splash-screen.css` classes — identical look to splash screen
- Card click applies theme (`data-theme` + localStorage) and navigates to route
- Starfield auto-inits when fan opens if splash already destroyed it
- Escape key closes fan
- GoneRogue launch → overlay morphs out, NCH takes over at same position
- GoneRogue exit → overlay returns to porthole mode

**Known gaps for future iteration:**
- Mobile tap-to-expand on the capsule joker stack (may need explicit tap handler vs hover)
- Fan panel doesn't yet have decoder-ring wheels (splash screen's booking widgets)
- No drag-to-rearrange on fan cards yet (Phase 4)

---

## Phase 1: Starfield Underlayment 🔜

Every page on the site (except gone-rogue) gets a hidden starfield layer sitting beneath the normal content. The starfield remains invisible until the coin-cards' porthole canvases open a viewport into it. Each theme variant of the starfield uses a distinct color palette so that the "lens" color is immediately recognizable.

**Palette system: ✅ Complete.** `starfield.js` now has a full palette engine with 8 named presets (night, sunset, mono, silver, amber, phosphor, panther, daytime). All 7 color domains in the renderer are palette-driven: void fill, star tint/bias, Milky Way glow + stars, cluster glow + stars, and atmosphere wash. Palettes can be set at `init()` time or switched live via `setPalette()`. The daytime preset includes a blue-sky atmosphere gradient; clouds/sunshine are a future enhancement.

**Remaining deliverables:** Auto-init starfield on all pages via `nch-overlay.js` init (currently only index.html is wired), performance budget (GPU/CPU) for always-on underlayment, wire theme-card selection to `setPalette()` for live preview in portholes.

---

## Phase 2: NCH Overlay — Desktop & Mobile Persistence ✅

Originally scoped as a separate phase, this was pulled into Phase 0 since the extraction naturally required it. The overlay mounts on any page, remembers position via localStorage, and works on both desktop (drag) and mobile (touch drag via pointer events).

**Shipped:** NCH overlay (`nch-overlay.css` + `nch-overlay.js` + `NchOverlay.init()`) now wired on ALL public pages: `index.html`, `games.html`, `booking.html`, `partners.html`, `contact.html`. Coin-card data externalized from hardcoded MISSIONS arrays into `/data/coin-cards.json`, loaded at init by both `splash-screen.js` and `nch-overlay.js` with inline fallback. Designer-facing editor at `/portal/coin-card-editor.html` for quick editing of card contents, pricing curves, video sources, and silhouette pool without touching JS source files.

---

## Phase 3: Joker Emoji Colorization (BLVCK Card Method) ✅

Each joker emoji in the NCH stack is individually colorized to preview the theme it represents. Uses a layered DOM approach (not pseudo-elements, which can't reliably paint over emoji bitmaps):

1. **Bright glow** — per-theme `drop-shadow` on the joker div (2px spread, 50% opacity of primary)
2. **Emoji** — `.nch-joker-emoji` at z-index 1
3. **Dark tint overlay** — `.nch-joker-tint` at z-index 2 (deep dark shade of theme hue, 20% opacity, 10% narrower, +3px taller)
4. **Metallic sheen** — `.nch-joker-sheen` at z-index 3 (theme-tinted sweep animation, 8s cycle)

Colors match themes.css primaries: silver `#b0c4de` → dark `#1a2535`, amber `#ffb000` → dark `#2a1a00`, phosphor `#33ff33` → dark `#0a2a0a`, panther `#ff3090` → dark `#2a0a18`. Hover boosts tint to 30%. Greyed state zeroes all layers.

---

## Phase 4: Drag-to-Rearrange ✅

Coin-cards in the fan support drag-to-reorder with gap insertion. Tap/click still selects (navigates + applies theme); drag reorders. Changes propagate immediately to the joker emoji stack.

**Shipped:**
- Splash-screen-style ghost (`.coin-card-ghost`, `cloneNode(true)`) with live porthole starfield blit during drag
- Gap-insertion placeholders (`.splash-card-placeholder`) slide between cards as the ghost moves
- Placeholder colors match the dragged card's theme (inline `THEME_COLORS` lookup), not the body's applied theme
- Mobile: lower drag threshold (5px vs 10px), Y-axis gap detection for vertical stack, placeholder copies card's computed `transform`/`z-index` from `:nth-child` rules
- Card order persists to localStorage (`EYESONLY_NCH_CARD_ORDER_V1`), restored on init
- Capsule↔fan morph transition: capsule zooms toward screen center along `cubic-bezier(0.4, 0, 0.2, 1)`, crossfades into fan; fan zooms out and capsule curves back to parked position. Bounds check clamps home position to viewport on orientation change.

---

## Phase 5: Porthole Reveal Grid System ✅

Modular, designer-friendly system for embedding hidden content between the starfield layer and the presented page. Each page defines a **reveal grid** — named zones in screen space where secrets live. Coin-card portholes (and eventually other lenses) expose these zones when held over them.

### What it replaced

The old `/games.html` had a hardcoded reveal mechanic: `magnifying-glass-drag.js` detected overlap with `[data-mag-reveal="cypher-note-2"]` on slot 2, popped an emoji into the porthole center, and deposited the item on drop. Problems: emoji popped instead of sliding, no lock-in moment, scroll-away dropped instantly, single hardcoded item, magnifying glass duplicated coin-card porthole.

### Shipped

- `public/js/reveal-grid.js` — zone manager IIFE: overlap detection, slide-in animation (approach-direction-aware), lock-in threshold, release actions (`deposit-to-inventory`, `persist-found`, `pause-and-persist`), QR canvas renderer, localStorage persistence via `eyesonly_revealed_items`
- `public/css/reveal-zone.css` — zone containers (z:50), content type renderers (emoji, QR, video, image, text), tier-based glow (SURFACE/SEMI_HIDDEN/CONCEALED/HIDDEN), palette tints (silver/amber/phosphor/panther), three lock animations (pulse-glow, scan-line, border-glow with palette variants), deposit animation, persist state, exit animation, responsive mobile rules
- `/games.html` migration — hardcoded reveal logic replaced with `GAMES_ZONES` array and `RevealGrid.init()` call; `depositToSlot()` callback for inventory; `restoreRevealed()` on page load
- `magnifying-glass-drag.js` integrated — calls `RevealGrid.beginLensSession` / `updateLens` / `endLensSession` during drag; `_updateRevealContent()` renders zone content inside porthole with directional slide

### What works

- Drag magnifying glass over slot 2 → cypher-note emoji slides in from approach direction → overlap exceeds 75% → locks with pulse-glow → release deposits to inventory (one-shot)
- In-porthole rendering: zone content rendered INSIDE the lens source's porthole element (`overflow:hidden; border-radius:50%` provides natural circular clipping) — not on an external grid layer
- Slide-in/slide-out animation with eased progress ramp (0.25 lerp) and 40px travel distance
- Lock-in SFX via `AudioSystem.playSFX('ui-04')` on threshold cross
- Persistence: one-shot zones skip on reload; revealed items tracked in localStorage

### Completed (previously remaining)

- ✅ 3 zones authored (`cypher-note-2` emoji, `qr-arcade-secret` QR, `briefing-rogue` video)
- ✅ NCH overlay wired on `/games.html` (and all other pages via Phase 2 rollout)
- ✅ Dead `data-mag-reveal` attribute removed from games.html
- ✅ PuzzleState integration: `reveal-grid.js` calls `PuzzleState.onClueFound()` on lock-in + dispatches `revealGrid:locked` CustomEvent
- ✅ JSON schema embedded in `/data/reveal-zones-games.json` (`definitions` block with Zone, Anchor, RevealConfig types)
- ✅ Zone definitions externalized to `/data/reveal-zones-games.json` — games.html loads via XHR with inline fallback

### Reveal grid architecture

```
┌──────────────────────────── Page ────────────────────────────┐
│                                                               │
│   ┌─ Starfield master canvas (hidden, full viewport) ─┐      │
│   │                                                     │      │
│   │   ┌── Reveal Grid Layer ──────────────────────┐    │      │
│   │   │                                            │    │      │
│   │   │   [zone-A]  [zone-B]        [zone-C]     │    │      │
│   │   │   QR code   .webm video     emoji clue    │    │      │
│   │   │                                            │    │      │
│   │   └────────────────────────────────────────────┘    │      │
│   │                                                     │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                               │
│   ┌── Visible Page Content ──────────────────────────────┐    │
│   │   Normal page HTML (games grid, booking cards, etc.) │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                               │
│   ┌── Porthole lens (coin-card fan, mag glass, etc.) ────┐   │
│   │   Blits starfield + reveal grid through viewport      │   │
│   └───────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### Zone definition (designer-facing JSON)

Each page gets a `reveal-zones.json` (or inline `<script type="application/json">` block):

```json
{
  "page": "/games.html",
  "zones": [
    {
      "id": "cypher-note-2",
      "type": "item",
      "anchor": { "selector": "[data-slot='2']", "offset": [0, 0] },
      "size": [120, 120],
      "content": {
        "emoji": "📋",
        "itemId": "ITM-201",
        "label": "CYPHER NOTE"
      },
      "reveal": {
        "enter": "slide",
        "lockThreshold": 0.75,
        "lockAnimation": "pulse-glow",
        "onRelease": "deposit-to-inventory"
      },
      "tier": "SEMI_HIDDEN",
      "oneShot": true,
      "palette": "phosphor"
    },
    {
      "id": "qr-secret-1",
      "type": "qr",
      "anchor": { "selector": ".arcade-section", "offset": [200, 50] },
      "size": [100, 100],
      "content": {
        "qrData": "https://eyesonly.game/secret/s01-e03",
        "fgColor": "#33ff33",
        "bgColor": "transparent"
      },
      "reveal": {
        "enter": "fade",
        "lockThreshold": 0.6,
        "lockAnimation": "scan-line",
        "onRelease": "persist-found"
      },
      "tier": "CONCEALED",
      "oneShot": false,
      "palette": "phosphor"
    },
    {
      "id": "easter-egg-video",
      "type": "video",
      "anchor": { "selector": "#gone-rogue-launcher", "offset": [-30, 100] },
      "size": [200, 150],
      "content": {
        "src": "/media/secret-briefing.webm",
        "autoplay": true,
        "loop": false
      },
      "reveal": {
        "enter": "slide",
        "lockThreshold": 0.8,
        "lockAnimation": "border-glow",
        "onRelease": "pause-and-persist"
      },
      "tier": "HIDDEN",
      "oneShot": false,
      "palette": "panther"
    }
  ]
}
```

### Content types

| Type | Renderer | Lock behavior |
|------|----------|--------------|
| `item` | Emoji/icon on grid, animates to inventory on release | One-shot deposit |
| `qr` | Canvas-rendered QR code (theme-colored) | Stays on grid |
| `video` | `<video>` element, plays while visible through lens | Pauses on release |
| `image` | Static image (PNG/SVG) | Stays on grid |
| `text` | Styled text block (cipher fragments, coordinates) | Stays on grid |
| `component` | Custom HTML injected by ID reference | Callback on lock |

### Lens sources (what can reveal)

1. **Coin-card porthole** — each card in the NCH fan is a lens. Zone's `palette` field determines which card can reveal it (or `"any"` for universal).
2. **Magnifying glass (ITM-200)** — legacy drag item, repurposed in Phase 6 as a zoom lens rather than a porthole lens.
3. **Future lenses** — decoder ring overlay, UV/blacklight mode, thermal mode, etc.

---

## Phase 6: Magnifying Glass Repurpose (Zoom Lens) ⬜

ITM-200 (magnifying glass) currently duplicates the coin-card porthole mechanic — both drag a starfield viewport over the page. With coin-cards handling porthole reveals in Phase 5, the magnifying glass is freed up for a distinct mechanic: **optical zoom**.

Instead of revealing a hidden starfield layer, the magnifying glass zooms into the actual visible page content — enlarging text, images, map details, fine print, hidden-in-plain-sight micro-text. Think "zoom and enhance" vs "see through walls."

**Potential uses:**
- Zoom into the gone-rogue game map to read tiny labels, spot hidden markers
- Enlarge micro-printed text on booking pages (hidden discount codes, flavor text)
- Inspect high-res artwork for embedded steganographic clues
- Read fine print on "classified" document props

**Deliverables:**
- Repurpose `magnifying-glass-drag.js` ghost to render a zoomed blit of the page content (CSS `transform: scale(2)` on a clipped viewport) instead of a starfield blit
- Keep the same drag UX, ring/vignette chrome, and inventory slot
- The zoom lens and porthole lens become two distinct tools in the player's kit

---

## Phase 7: Cross-Page Puzzle State ✅

Clues found via porthole reveals on different pages connect into multi-step puzzles. A shared puzzle-state tracker persists progress in localStorage and syncs to account when online. This is the connective tissue that turns isolated per-page reveals into a site-wide meta-game.

### Design

The reveal grid (Phase 5) already tracks individual zone discovery via `eyesonly_revealed_items` in localStorage. Phase 7 layers a **puzzle registry** on top: each puzzle is a named collection of clue IDs drawn from zones across multiple pages. When all clues for a puzzle are found, the puzzle resolves — triggering a reward, unlocking a route, or revealing a new set of zones.

### Shipped

- `public/js/puzzle-state.js` — stateless IIFE: puzzle registry (loaded from `/data/puzzles.json` via XHR), clue tracking keyed by zone/constellation ID, completion detection, reward dispatch (coins → `eyesonly_account`, routes → `eyesonly_unlocked_routes`, zone reveals via `puzzlestate:reveal-zones` CustomEvent), hint system, badge count API
- `public/data/puzzles.json` — 3 puzzle chains: "night-flight-cipher" (beginner, 3 field-kit clues), "celestial-passport" (advanced, 3 constellation solves), "grand-key" (expert, 2 constellation solves)
- `puzzle-state.js` wired on ALL 5 public pages (index, games, booking, partners, contact) with `PuzzleState.init()` call in DOMContentLoaded
- `reveal-grid.js` integration: `_executeRelease()` calls `PuzzleState.onClueFound(zone.id, 'reveal')` + dispatches `revealGrid:locked` CustomEvent
- NCH puzzle badge: `.nch-puzzle-badge` element on joker capsule, updates via `PuzzleState.onChange()` listener, shows clue count or checkmark when all solved
- Badge CSS in `nch-overlay.css` Section 8 (green pill, gold `.nch-puzzle-badge-complete` variant, pop animation)
- Init-time sync: `_syncRevealedItems()` cross-references already-revealed zones with puzzle clues on load

### What it enables

- QR fragment on `/games.html` + cipher note on index + briefing on gone-rogue row → combined they unlock `/itinerary/night-flight`
- Puzzle progress visible from any page via NCH widget badge count
- Stuck-player hints delivered through `PuzzleState.getHint()` (NPC-style cryptic dialogue, keyed to most-progressed puzzle)
- Constellation-tracer integration point: `PuzzleState.onConstellationSolved(id)` prefixes `constellation:` for Phase 8+

### Remaining (nice-to-have)

- Server sync endpoint for authenticated accounts (cross-device continuity)
- Timed hint delivery (auto-surface hint after N minutes idle)
- Fan panel hint UI integration

---

## Phase 8: Gold Lens — Constellation Tracing 🔧 (~60% shipped)

The gold lens becomes a **navigator's instrument** for tracing constellations in the starfield. The interaction feels like a phone unlock pattern: the player drags the gold porthole across suit-symbol nodes, and the system records a path graph constrained by angular rules. Valid shapes lock in, flash gold, rain coins, and burn permanent white pixels into the forever sky.

### Suit Symbols as Constellation Node Types

The four card suits stop being decoration and become the **node-type language** of the constellation system. Every node in the starfield is rendered as a tiny suit symbol. The suit determines which lens can interact with it:

| Suit Symbol | Starfield Rendering | Native Lens | Card (Theme) | Interaction | Result |
|-------------|-------------------|-------------|--------------|-------------|--------|
| ♣ Club | Visible, bright, gold-tinted | Gold | Amber (♣) | Connect directly | Path node |
| ♦ Diamond | Visible, pink-tinted, faceted sparkle | Pink | Panther (♦) | Transform | ♦ → ♣ node |
| ♠ Spade | Dim, flickering, grey | Silver | Silver (♠) | Amplify brightness | ♠ → ♣ node |
| ♥ Heart | Invisible (completely hidden) | Amber | Phosphor (♥) | Reveal by warmth | ♥ → ♣ node |

**The club ♣ is the universal "connectable" state.** Every non-club suit is a problem that a specific lens solves, and solving it always converts the node into a ♣. The gold lens can only string lines between ♣ nodes. This is why the club symbol works as the navigator's mark — it's the only suit you can rope through.

**Three-lobed hint:** The ♣ trefoil has three lobes. The angular constraint system has three axes (12°, 90°, 168°). The suit symbol itself is a literal diagram of the allowed angles. Players who notice will have an "aha" moment: the club shape IS the constraint rules hiding in plain sight.

### Porthole Lens Gradients

Each card's porthole gets a colored gradient overlay to solve the dark-hole-into-dark-sky visibility problem and make each lens visually distinct at a glance:

| Card | Theme | Lens Gradient | Rationale |
|------|-------|--------------|-----------|
| Amber (♣) | `#ffb000` | `radial-gradient(circle, rgba(70,130,200,0.25) 0%, transparent 70%)` — blue center | Complementary contrast: blue atmosphere makes gold constellation lines pop |
| Panther (♦) | `#ff3090` | `radial-gradient(circle, rgba(255,48,144,0.20) 0%, transparent 70%)` — pink center | Monochromatic intensity: the "infrared detector" eye |
| Silver (♠) | `#b0c4de` | None, or `rgba(176,196,222,0.08)` subtle silver mist | Clarity IS the feature: amplification means removing obscurity |
| Phosphor (♥) | `#33ff33` | `radial-gradient(circle, rgba(255,176,0,0.22) 0%, rgba(255,140,0,0.08) 60%, transparent 85%)` — amber center | Warm amber over green card = vintage phosphor instrument panel; warmth reveals hidden hearts |

Gradients are applied as a CSS pseudo-element on the porthole viewport, composited over the starfield blit. They don't affect the underlying canvas — purely a visual filter on the lens itself.

### Angular Constraint System

Connections between stars snap to a restricted set of angles, creating an emergent glyph alphabet from a small rule set. The allowed angles and their symmetries define six directional axes:

| Allowed Angle | Symmetry (+ 180°) | Axis Character |
|---------------|-------------------|----------------|
| 12° | 192° | Shallow rising diagonal |
| 90° | 270° | Orthogonal (vertical) |
| 168° | 348° | Shallow falling diagonal |

**Tolerance window:** ±5° around each allowed angle. Connections outside all six windows are rejected with a visual flicker.

**Why these angles:** Three non-orthogonal axes (12°, 90°, 168°) produce glyph-like shapes that look intentional — arrows, runes, circuit traces, skeleton keys — without requiring a font or hardcoded path library. The shapes emerge from the constraint rules applied to random star positions.

**Phone-unlock feel:** Stars auto-snap when the lens enters a tolerance window. The golden connection line draws with a slight elastic overshoot. Stars glow brighter as the lens approaches, dim back if the angle is rejected. Start and end nodes have distinct rendering (filled vs ring). No revisiting: once a star is in the path, dragging back through it is ignored.

### Line-Tethering Mechanic (RopeManager Pattern)

The constellation tracer follows the same state machine as `ropeManager.js`:

```
idle ──(lens overlaps ♣ node)──► hasNode ──(lens reaches next ♣)──► tethered
  ▲                                │                                    │
  │  (release / abandon)           │      (resolve: shape valid)        │
  └────────────────────────────────┘◄───────────────────────────────────┘
```

**Deploy:** Gold porthole overlaps a ♣ node → node highlights (gold glow pulse), node added to path. A golden tether line extends from the node and follows the porthole cursor.

**Tether:** Line stretches from last-visited node to current porthole center. The line is semi-transparent until the porthole enters the tolerance window of another ♣ node's angle — then the line snaps taut with an elastic overshoot (like a rubber band).

**Snap:** When the porthole overlaps the next valid ♣ node AND the angle passes constraint check → line locks between the two nodes, new tether extends from the new node. The angle check replaces RopeManager's distance check.

**Reject:** Porthole overlaps a ♣ node but the angle fails → line flickers orange, node dims briefly (same pattern as RopeManager's "target out of range" rejection). Tether remains attached to the previous node.

**Resolve:** When the path forms a valid shape (closes a polygon, matches a pattern, or satisfies a rule) → all lines pulse gold, coin waterfall fires, forever pixels burn in.

### Player Discovery — Tutorial Progression

**Level 1 — Triangle (Gold lens only, 3 ♣ nodes):**
Three tiny ♣ club symbols appear in a triangle formation among the dust stars. Player grabs the amber card and drags it over the first ♣ — it highlights with a gold glow. Dragging to the second ♣ snaps a golden line between them and ties a tether from node 2 to the cursor. Player recognizes they need to hit the third ♣ because they're stringing a rope. They hit the third ♣ — line snaps in but the triangle isn't closed. Player drags back toward node 1, the closing edge snaps, and the shape resolves. Coin waterfall cascades from each node (50ms stagger). Lines clean up. Three permanent white 1px dots burn into the starfield where the ♣ symbols were. The player just learned: clubs are connectable, the gold card strings them, completed shapes are permanent.

**Level 2 — Square (Gold + Pink, 3 ♣ + 1 ♦):**
A new constellation appears: 3 ♣ clubs and 1 ♦ diamond in a square. Player starts connecting ♣ nodes with the amber card. Arrives at the ♦ — the tether line trails past it. Nothing happens. The diamond is inert to the gold lens. Knowledge gate: the ♦ matches the panther card's suit. Player grabs the panther card, drags it over the ♦. The pink lens transforms it — the ♦ rotates 45°, edges fold inward, and it re-blooms as a ♣ trefoil (color shifts pink → gold during the fold). Now the player can return to the amber card and complete the 4-node square. Four forever-white pixels earned. The player just learned: diamonds need the panther card first, different suits need different cards.

**Level 3 — Pentagon (Gold + Silver + Pink, 3 ♣ + 1 ♠ + 1 ♦):**
Five nodes, mixed suits. The ♠ spade is dim, barely visible, flickering. Gold lens sees it but can't connect — too dim, below brightness threshold. Player grabs the silver card, holds it over the ♠. The clear lens amplifies: ♠ brightens, stem retracts, lobes split into three → becomes a ♣. Now gold traces the full shape with the transformed ♦ and ♠. Five forever pixels.

**Level 4 — Hexagon (All four lenses, ♣ + ♦ + ♠ + ♥):**
Six nodes. The ♥ heart is completely invisible — a gap in the shape where a node should be. Player must use the phosphor card (♥ is its suit). The amber lens reveals the hidden heart (warmth makes it appear, fading in with a warm amber pulse). Heart splits at the top cleft into three lobes → becomes ♣. Now all nodes are connectable. Gold traces the full hexagon. Full instrument-panel mastery demonstrated.

### Background Star Types

Not every point in the sky is a constellation node. Between the suit-symbol nodes, the starfield contains:

| Type | Rendering | Behavior |
|------|-----------|----------|
| Dust stars | Tiny pixels (1px) | Decoration only, not interactive |
| Satellites | Slow-moving sprites | Interference — break active tether if crossed |
| Dead stars | Faint flicker, grey | Visual noise, not interactive |
| Forever stars | Fixed white 1px, `#ffffff` | Permanent marks from solved constellations |

### Validation Rules

Four validation modes, used at different difficulty tiers:

| Rule | Description | Example |
|------|-------------|---------|
| `exact` | Match a known node-ID sequence | `[12, 4, 9, 3, 8]` = "KEY" glyph |
| `shape` | Geometric pattern match (rotation-invariant) | Triangle, arrow, spiral, infinity — normalized coordinate comparison |
| `rule` | Structural constraints only | No crossing lines, clockwise only, alternating brightness |
| `euler` | Visit all nodes exactly once | Seven Bridges-style — path exists only if graph has 0 or 2 odd-degree nodes |

### Visual Feedback

- **While tracing:** Faint golden tether from last node to porthole. Stars brighten on visit. Connection line has subtle particle trail.
- **Angle snap:** Line goes from translucent to solid gold with elastic overshoot when entering a valid angle window.
- **Angle reject:** Line flickers orange, target node dims 0.3s, tether remains on previous node.
- **Valid constellation:** Lines pulse gold (3 flashes), nodes flare to white, coin waterfall fires per-node with 50ms stagger, constellation holds 3s with halo, then lines fade away.
- **Forever pixel burn-in:** After coin waterfall completes, each node location gets a single fixed `#ffffff` 1px dot rendered permanently onto the starfield master canvas. These pixels don't animate, don't twinkle, don't belong to any palette. They are the player's permanent marks on the sky.
- **Suit transformation (♦/♠/♥ → ♣):** Each suit has a distinct origami-fold animation. ♦ rotates 45° and folds inward to trefoil. ♠ stem retracts, lobes split to three. ♥ splits at cleft into three lobes. Color shifts from the source lens color to gold during the fold.

### Coin Waterfall Reward

On valid constellation completion, each node fires a coin burst sequentially (50ms stagger per node along the path order), creating a cascade effect like a fuse burning along the constellation lines. Mirrors `CurrencySpawning.scatterPostCombatNodes()` pattern from gone-rogue:

```javascript
function fireConstellationReward(path, rewardPerNode) {
  path.forEach((nodeId, i) => {
    setTimeout(() => {
      // 2-3 ¢ sprites fountain upward with gravity falloff from node position
      spawnCoinBurst(nodeId, rewardPerNode);
      // Coins arc toward currency display in header (or NCH capsule)
      AudioSystem.playSFX('coin-collect');
    }, i * 50);
  });
  // Bank total after cascade completes
  setTimeout(() => {
    awardConstellationReward(path.length * rewardPerNode);
  }, path.length * 50 + 500);
}
```

### Deliverables

- `constellation-tracer.js` — line-tethering state machine (RopeManager pattern), angular constraint validation, snap detection, elastic line rendering, suit-node type detection
- `constellation-validator.js` — shape matching algorithms (exact sequence, rotation-invariant geometry, structural rules, Euler path check)
- `constellation-rewards.js` — coin waterfall cascade, currency integration with `eyesonly_account`, forever-pixel burn-in
- `suit-node-renderer.js` — renders ♣/♦/♠/♥ symbols in starfield at constellation node positions, handles transformation animations (♦→♣, ♠→♣, ♥→♣)
- `porthole-lens-gradient.css` — per-card radial gradient overlays (blue, pink, clear, amber)
- Gold lens rendering in starfield — distinct golden glow, navigator HUD overlay, tether line renderer
- Unlock hint: "Golden glass charts the sky."

### Shipped ✅

- **`public/js/starfield.js`** — Added `addPostRenderHook(fn)` and `getTime()` to public API. Hooks paint onto master canvas after stars render but before blit into portholes. Returns unregister function.
- **`public/js/suit-node-renderer.js`** (new) — Full IIFE exposing `SuitNodeRenderer`. Node registry with `{ id, x, y, suit, state, constellation, brightness, pulsePhase, transformedTo }`. Constellation registry with validation rules and difficulty tiers. State-dependent rendering: clubs bright/gold, diamonds pink, spades dim/flickering, hearts invisible. `hitTest()` with suit filtering, `transformNode()` for ♦/♠/♥→♣ conversion, `burnForever()` for permanent white 1px pixels. Forever sky persistence via localStorage.
- **`public/js/constellation-tracer.js`** (new) — State machine: `idle → hasNode → tethered → resolve`. Angular constraint validation (12°/90°/168° + 180° mirrors, ±5° tolerance). Golden tether line rendering with dashed animation. Snap detection with elastic overshoot animation. Auto-snap within 60% of snap radius. Loop closure detection and all-nodes-visited detection. Coin waterfall reward via CurrencySpawning integration. Custom `constellation-solved` event dispatch.
- **`public/js/constellation-loader.js`** (new) — Fetches `/data/constellations.json` via XHR with inline fallback (tutorial triangle). Phase 8 MVP filter: only registers all-♣ constellations (multi-suit needs Phase 9). Registers constellations with SuitNodeRenderer on load.
- **`public/data/constellations.json`** (new) — Three constellation definitions: tutorial-triangle (3 ♣, beginner), tutorial-diamond-path (2♣+2♦, intermediate), tutorial-spade-chain (3♣+2♠, intermediate). Only the triangle is active in Phase 8.
- **`public/css/nch-overlay.css`** — Added porthole lens gradient overlays: `.lens-silver` (clear/neutral), `.lens-blue` (for amber/gold card, complementary contrast), `.lens-amber` (for phosphor card, warm complement), `.lens-pink` (for panther card, reinforced neon). Mix-blend-mode screen, 0.4s fade transition, pulse animation during active tracing.
- **`public/js/nch-overlay.js`** — Integrated constellation tracing into card drag system. Added `_lensClassForTheme()`, `_isGoldLensCard()`, `_startConstellationTrace()`, `_updateConstellationTrace()`, `_endConstellationTrace()`. Gold lens (♣ club/amber card) activates constellation mode on drag. Porthole center feeds cursor position to tracer each frame. Lens overlay activates with tracing pulse class during active connections. Injected `.porthole-lens-overlay` div into card HTML template between starfield-window and coin-rings.
- **All 5 public pages** — Added script tags for suit-node-renderer.js, constellation-tracer.js, constellation-loader.js (loaded before nch-overlay.js). Cache-busted to v=20260316d.

### Remaining

- Dedicated `constellation-validator.js` — shape matching (rotation-invariant geometry), structural rules, Euler path check
- Dedicated `constellation-rewards.js` — proper coin waterfall cascade with per-node staggered fountain animation, currency integration with `eyesonly_account`
- Tutorial hint system — "Drag the gold card over the ♣ symbols" nudge for first-time players
- Visual feedback: angle-reject flicker (orange flash + node dim), valid-constellation gold pulse (3 flashes + halo), constellation hold (3s glow before fade)
- Satellite interference — moving sprites that break active tether if crossed
- Advanced constellations with non-trivial angular paths (more than 3 nodes, using all 6 angle axes)

---

## Phase 9: Multi-Lens Suit Transformation ⬜

Each non-club suit is a puzzle that a specific card's lens solves. The lens doesn't just "reveal" the node — it physically transforms the suit symbol into a ♣ club through a distinct animation, making the node connectable by the gold lens. Players don't gain new inventory keys — they gain new ways of converting the world into a traceable graph.

### Lens-to-Suit Transformation Matrix

| Source Suit | Required Card | Lens Color | Transformation | Visual |
|-------------|--------------|------------|----------------|--------|
| ♦ Diamond | Panther (pink) | Pink spectral | Refract: diamond prism splits light, re-forms as club | ♦ rotates 45°, edges fold inward, re-blooms as ♣. Pink → gold color shift. |
| ♠ Spade | Silver (clear) | Clear amplifier | Amplify: dim spade brightens until readable as club | ♠ brightens, stem retracts, lobes split to three → ♣. Grey → gold color shift. |
| ♥ Heart | Phosphor (amber) | Amber warmth | Reveal: invisible heart warms into existence, opens into club | ♥ fades in from nothing with amber pulse, cleft splits into three lobes → ♣. Amber → gold color shift. |
| ♣ Club | Amber (gold) | Gold navigator | Native: no transformation needed | Already connectable. Gold glow on hover. |

### Transformation Mechanics

**Proximity trigger:** The transformation lens must overlap the suit node for a brief hold (300ms) — not just pass over. This prevents accidental transformations during drag traversal. A radial progress ring fills around the node during the hold.

**Persistence:** Once a suit is transformed to ♣, it stays ♣ for the current session (sessionStorage). The original suit type is recorded so the system knows it was transformed (affects scoring). On page reload, untransformed suits reset to their original state — players must re-prepare nodes each session unless the constellation was completed and burned to forever pixels.

**Transformation state per node:**

```javascript
{
  "id": 14,
  "x": 0.42,
  "y": 0.61,
  "originalSuit": "diamond",    // ♦ — native type, never changes
  "currentSuit": "club",        // ♣ — after pink lens transformation
  "transformedBy": "panther",   // which card transformed it
  "transformedAt": 1710000000,  // timestamp
  "connectable": true           // now true (was false as ♦)
}
```

### Layered Star Graph Data Model

Each constellation node carries properties mapped to the suit system:

```javascript
{
  "id": 14,
  "x": 0.42,          // normalized viewport position
  "y": 0.61,
  "suit": "diamond",  // ♦ — determines which lens can transform it
  "brightness": 0.3,  // ♠ spades are dim (< 0.6), ♣ clubs are bright (> 0.6)
  "visible": false,   // ♥ hearts start invisible, revealed by amber lens
  "connectable": false // becomes true only when currentSuit === "club"
}
```

### Cross-Lens State

```javascript
const lensState = {
  transformed: Map<nodeId, { from: suit, by: card, at: timestamp }>,
  goldTraced: Array<nodeId>,      // current gold lens path
  activeConstellation: string|null // which puzzle is in progress
};
```

### Progressive Difficulty (Suit Mix Scaling)

| Level | Nodes | Suit Mix | Lenses Required | Teaching Goal |
|-------|-------|----------|-----------------|---------------|
| 1 | 3 | 3 ♣ | Gold only | Basic tracing + angular snapping |
| 2 | 4 | 3 ♣ + 1 ♦ | Gold + Pink | "Diamonds need the panther card" |
| 3 | 5 | 3 ♣ + 1 ♠ + 1 ♦ | Gold + Silver + Pink | "Spades need the silver card" |
| 4 | 6 | 2 ♣ + 1 ♦ + 1 ♠ + 1 ♥ + 1 ♣ | All four lenses | Full instrument mastery |
| 5+ | 4–9 | Procedural mix | Variable | Difficulty from suit ratio + angular complexity |

### Shipped (when complete)

- `public/js/suit-transformer.js` — per-suit transformation logic, hold-timer, progress ring, origami-fold animations
- `public/js/lens-state.js` — cross-lens state manager, transformation persistence (sessionStorage), constellation session tracking
- `public/js/star-layer-renderer.js` — renders suit symbols at node positions, brightness/visibility per suit type, transformation animation sequences
- Porthole lens gradient CSS — per-card radial gradient overlays integrated into existing porthole rendering pipeline
- Pink lens: diamond refraction transformation (particle burst + fold animation)
- Silver lens: spade amplification (brightness ramp + morph animation)
- Amber lens: heart reveal (fade-in + warmth pulse + morph animation)

### Deliverables

- `suit-transformer.js` — transformation engine with hold-timer, per-suit animations, state persistence
- `lens-state.js` — cross-lens state manager
- `star-layer-renderer.js` — per-lens node rendering pipeline, suit symbol renderer
- Porthole lens gradient overlays (CSS pseudo-elements per card theme)
- Transformation SFX per suit type (distinct audio cues so player knows which conversion happened)
- Hint system that detects which suits the player hasn't tried transforming yet

---

## Phase 10: Procedural Generation, Cascades & Forever Sky ⬜

As players solve constellations, the system generates new puzzles procedurally, reveals hidden puzzle chains, and permanently marks the starfield with solved nodes. The sky becomes a living journal of achievements — and a resource that can be harvested or destroyed.

### Procedural Generation Algorithm

Instead of hand-authoring every constellation, the system generates valid puzzles from the starfield:

```
1. SEED — Random starfield of N nodes with assigned suits (weighted by difficulty tier)
2. PROXIMITY GRAPH — Connect all node pairs within distance threshold D
3. ANGLE FILTER — Remove edges whose angle ∉ {12°±5°, 90°±5°, 168°±5°, 192°±5°, 270°±5°, 348°±5°}
4. PATH SEARCH — DFS from each node:
     - 4–9 nodes, no revisiting
     - Each edge must use an allowed angle
     - Track shape bounding box and aspect ratio
5. SHAPE FILTER — Reject paths that are:
     - Too linear (aspect ratio > 4:1)
     - Too compact (bounding box < 15% of viewport)
     - Self-intersecting (unless intersection is at 90°/180° or on an existing node)
6. SUIT MIX — Assign non-club suits to N nodes based on difficulty tier:
     - Easy: 0-1 non-club suits (mostly ♣)
     - Medium: 1-2 non-club suits (♦ and/or ♠)
     - Hard: 2-3 non-club suits (♦ + ♠ + ♥)
7. DIFFICULTY SCORE — Node count × axis variety × suit diversity × path uniqueness
8. OUTPUT — Constellation definition: node IDs + suits, expected path, difficulty tier, reward
```

### Intersection Rules

Paths may only cross at 90° or 180° angles, or at a node already in the path. All other intersections are invalid. This prevents visual tangles while allowing elegant crossover shapes (figure-8, Celtic knot patterns).

### Constellation Cascades

A solved constellation **unlocks another constellation** as a reward chain. Solving one puzzle illuminates new suit-symbol nodes elsewhere in the sky, making previously impossible shapes traceable.

```javascript
const CASCADE = {
  'triangle':  { unlocks: 'arrow',   newNodes: [
    { id: 5, suit: 'club' }, { id: 6, suit: 'club' }, { id: 7, suit: 'club' }
  ], reward: 5 },
  'arrow':     { unlocks: 'key',     newNodes: [
    { id: 8, suit: 'club' }, { id: 9, suit: 'diamond' }, { id: 10, suit: 'club' }, { id: 11, suit: 'club' }
  ], reward: 10 },
  'key':       { unlocks: 'compass', newNodes: [
    { id: 12, suit: 'club' }, { id: 13, suit: 'spade' }, { id: 14, suit: 'diamond' }, { id: 15, suit: 'heart' }
  ], reward: 15 },
  'compass':   { unlocks: null,      newNodes: [], reward: 50,
                 bonusRoute: '/itinerary/night-flight' }
};
```

**Cascade mechanics:** When a constellation is solved, its reward nodes don't appear instantly — they fade in over 2-3 seconds with a subtle ripple from the solved constellation's center. Later cascades introduce non-club suits, creating a natural difficulty ramp.

### Forever Sky — Persistent Star Mapping

Solved constellation nodes are **permanently burned** into the starfield as fixed white 1px dots at `#ffffff`. These forever stars:

- Don't animate, don't twinkle, don't belong to any palette
- Are pure `#ffffff` at exactly 1px — visually distinct from all dynamic star types
- Persist in `localStorage.eyesonly_forever_sky` as coordinate + constellation ID pairs
- Render on the starfield master canvas on every page load, before any dynamic stars
- Accumulate over time — the player's sky gradually fills with their marks
- Pulse faintly (opacity 1.0 → 0.8) when the gold lens hovers near a cluster, confirming "you've been here"

```javascript
const foreverSky = {
  stars: [
    { x: 0.32, y: 0.45, constellation: 'triangle', solvedAt: 1710000000 },
    { x: 0.38, y: 0.41, constellation: 'triangle', solvedAt: 1710000000 },
    { x: 0.35, y: 0.50, constellation: 'triangle', solvedAt: 1710000000 },
    // ... accumulates with each solved constellation
  ],
  totalSolved: 1,
  skyMapped: 0.03  // percentage of possible constellations completed
};
```

### Star Destroyer (Endgame Hook — gone-rogue.js)

A future widget in gone-rogue's endgame that lets players **sacrifice forever stars for currency**. Each white pixel destroyed yields coins proportional to the difficulty of the constellation it came from. This creates a meaningful tension: "my achievement map" vs "currency I need." Destroyed stars leave a faint grey ghost pixel (opacity 0.1) — the sky remembers, even after sacrifice.

### The Grand Constellation

A massive hand-authored constellation requiring **all four lenses** and spanning the full viewport. It is the endgame capstone — not procedurally generated.

1. **Amber lens (♥):** Reveals invisible heart nodes at the constellation's extremities
2. **Pink lens (♦):** Transforms diamond nodes at junction points
3. **Silver lens (♠):** Amplifies dim spade nodes along the mid-path
4. **Gold lens (♣):** Traces the complete path through all transformed nodes

The grand constellation's shape is a skeleton key. Reward: large coin waterfall + hidden travel page unlock (`/itinerary/night-flight`).

### Shipped (when complete)

- `public/js/constellation-generator.js` — procedural puzzle generation (seed → proximity graph → angle filter → DFS search → shape filter → suit mix → difficulty score)
- `public/js/constellation-cascade.js` — unlock chain manager, new-node fade-in animation, cascade state persistence
- `public/js/forever-sky.js` — persistent white pixel renderer, localStorage sync, hover-pulse detection, sky-mapped percentage tracker
- `public/js/grand-constellation.js` — endgame multi-lens puzzle, hand-authored path, capstone reward
- `public/data/cascade-chains.json` — cascade definitions (unlock sequences, suit assignments, reward tiers)

### Deliverables

- Procedural constellation generator with angular constraint filtering and suit-mix assignment
- Cascade unlock chain manager with fade-in ripple animation
- Forever sky renderer (permanent white pixels, localStorage persistence, hover pulse)
- Grand constellation endgame puzzle (hand-authored skeleton key shape)
- Star destroyer endgame hook specification (for future gone-rogue.js integration)
- Coin waterfall animation system (per-node staggered burst, arc-to-currency-display)
- Difficulty scoring system for generated puzzles
- Optional: leaderboard integration (show "sky mapped: X%")

---

## Phase 11: Constellation Ecosystem — Volatility, Gambling & Decay ⬜

The forever sky is not safe. Suits carry inherent risk properties that create an ecosystem where the sky is simultaneously a garden the player grows and a minefield they navigate. Diamonds are unstable, hearts are gambles, and failed constellations send shockwaves through nearby achievements. The system transitions from purely additive (trace → earn → burn pixels) to a living economy with real loss.

### Diamond Volatility (♦ Instability)

Transformed ♦→♣ nodes are **unstable**. Unlike ♠→♣ and ♥→♣ transformations which hold indefinitely within a session, diamond conversions are on a timer.

**Decay sequence:**
1. **Stable phase (0–15s):** ♦→♣ node looks and behaves like a normal ♣. No visual difference.
2. **Warning phase (15–18s):** The ♣ trefoil starts flickering — pink diamond facets bleed through the gold. A faint crystalline chime plays (escalating pitch). The node's glow pulses between gold and pink.
3. **Reversion (18s):** Node snaps back to ♦. If the node was part of an active tether chain, the entire in-progress constellation **shatters** from the reverted node outward — lines fracture into orange sparks radiating away from the diamond. All path progress is lost. All visited nodes in that chain reset to unvisited.

**Design intent:** Every ♦ in a constellation is a ticking clock. The player must either trace fast enough to complete the shape before any diamonds revert, or plan a route that hits diamonds last. This creates routing puzzles on top of the spatial puzzle — the order you visit nodes matters.

**Difficulty scaling via diamond count:**

| ♦ Count | Timer | Effective Pressure |
|---------|-------|--------------------|
| 1 | 18s | Gentle — one clock to beat |
| 2 | 15s each | Medium — must route efficiently |
| 3+ | 12s each | Intense — near-optimal routing required |

Timers shorten as more diamonds appear in a single constellation, preventing the player from casually transforming them all at once.

**Re-transformation:** After a diamond reverts, it can be re-transformed by the pink lens. There is no limit on re-transformations — the cost is time and the risk of repeated shattering. Each reversion adds a faint crack texture to the diamond node (purely cosmetic, tracks how many times it's reverted in this session).

### Heart Gambling (♥ Outcome Roulette)

Hearts are invisible until the amber lens reveals them. But revelation is not deterministic — the ♥ node's outcome is rolled on reveal, creating a gamble each time the phosphor card touches one.

**Outcome table:**

| Outcome | Probability | Visual | Effect |
|---------|-------------|--------|--------|
| **Healthy heart** | ~60% | ♥ transforms to ♣ normally. Standard gold glow. | Clean conversion — node is connectable, no side effects. |
| **Wild heart** | ~25% | ♥ transforms to a rainbow-shimmer ♣ with prismatic edges. | **Wild node** — connects at ANY angle, not just constraint axes. Massive tactical advantage. Makes otherwise impossible shapes traceable. |
| **Broken heart** | ~15% | ♥ cracks open with a red flash. Fracture lines radiate outward. Node turns grey and dies. | **Dead node** — permanently unusable for this session. Releases a **damage pulse** that harms nearby forever stars. |

**Wild heart mechanics:** A wild ♣ ignores angular constraints entirely. The tether line snaps to it from any direction and accepts connections out at any angle. In a tight constellation with difficult geometry, a wild node is a lifeline — it bridges gaps that the three-axis constraint system would otherwise forbid. Wild nodes have a faint rainbow particle orbit so the player can identify them at a glance. Wild status persists for the session.

**Broken heart damage pulse:** When a heart breaks, a circular shockwave expands from the dead node outward (radius: 8% of viewport, expansion over 0.5s). Any **forever-white pixels** within the blast radius are downgraded:

```javascript
function damageForeverStars(pulseCenter, radius) {
  foreverSky.stars.forEach(star => {
    const dist = Math.hypot(star.x - pulseCenter.x, star.y - pulseCenter.y);
    if (dist <= radius) {
      star.damaged = true;
      star.color = '#666666';   // white → grey
      star.damagedAt = Date.now();
      star.damagedBy = 'broken-heart';
    }
  });
}
```

Damaged stars render at `#666666` instead of `#ffffff` — still visible on the sky map but clearly hurt. They are ghost-marks of former achievements. The visual distinction is immediate: white = healthy, grey = damaged.

**Healing damaged stars:** A damaged forever star can be restored to `#ffffff` by completing a new constellation that includes a node within healing range (4% of viewport) of the damaged pixel. The solve's coin waterfall passes through the damaged star, re-burning it white. This creates a repair loop: break something, then you need to solve nearby to fix it.

### Constellation Shatter (Failed Trace Fallout)

When an in-progress constellation fails — whether from diamond reversion, satellite collision, or player abandonment (releasing the card mid-trace) — the failure doesn't just reset silently. It **shatters**.

**Shatter sequence:**
1. **Fracture (0ms):** All tether lines in the active path break simultaneously. Lines fragment into particle sparks that radiate outward along each line's direction.
2. **Shockwave (100ms):** A faint circular pulse expands from the constellation's centroid. Radius: 5% of viewport.
3. **Scar (200ms):** Every node that was part of the failed path gets a faint red X overlay. Scarred nodes enter a **cooldown** (30 seconds) during which no lens can interact with them. This prevents instant retry spam.
4. **Collateral (300ms):** If the shatter shockwave reaches any forever-white pixels, they take minor damage — not full `#666666` downgrade, but a subtle dim to `#dddddd` (lightly scratched). Lightly scratched stars self-heal after 60 seconds. Only broken-heart damage is permanent until repaired.

**Shatter severity scales with constellation size:**

| Failed Constellation Size | Shockwave Radius | Scar Cooldown | Collateral Severity |
|--------------------------|------------------|---------------|---------------------|
| 3–4 nodes | 3% viewport | 15s | None — too small to cause collateral |
| 5–6 nodes | 5% viewport | 30s | Light scratch (`#dddddd`, self-heals 60s) |
| 7–9 nodes | 8% viewport | 45s | Moderate scratch (`#bbbbbb`, self-heals 120s) |

**Design intent:** Shattering near your proudest star cluster is dangerous. Players learn spatial awareness — you don't attempt risky multi-diamond constellations in crowded sky regions. You practice dangerous shapes in empty sky first.

### The Ecosystem Loop

The suit risk properties create interlocking feedback loops:

```
Solve constellations → earn forever stars → cascades spawn new constellations nearby
    → new constellations contain ♦ and ♥ → attempting them risks existing stars
        → ♦ diamonds create time pressure (revert → shatter → collateral damage)
        → ♥ hearts create outcome pressure (broken → damage pulse → grey stars)
            → damaged stars need repair solves → repair solves cascade more constellations
                → more constellations near more stars → higher density = higher risk
```

**The density paradox:** Success makes the sky more dangerous. A sky full of forever stars is a sky full of targets. Early gameplay is carefree — empty sky, nothing to lose. Late gameplay is tense — every new constellation sits in a minefield of achievements. This is the natural difficulty curve: the player's own success creates the challenge.

**Risk-reward escalation by suit:**

| Suit | Risk | Reward | Player Decision |
|------|------|--------|-----------------|
| ♣ Club | None — native, stable | Standard node | No decision — always safe |
| ♠ Spade | None — stable once amplified | Standard node | No decision — just needs silver pass |
| ♦ Diamond | Timer bomb — reverts, shatters chain | Standard node (but enables shapes) | Routing decision — when to hit diamonds in sequence |
| ♥ Heart | 15% chance to destroy nearby achievements | 25% chance of wild node (huge tactical bonus) | Gamble decision — is the potential wild worth the risk near my best stars? |

### Strategic Depth

**Diamond routing:** In a constellation with 2+ diamonds, the player must plan which order to transform and visit them. Transform all diamonds first, then speed-trace? Or transform-and-immediately-visit each diamond to minimize decay time? The optimal strategy depends on the constellation's geometry and the player's confidence in their tracing speed.

**Heart scouting:** Before committing to a constellation in a crowded sky region, a cautious player might reveal hearts first (using the amber lens) to check for broken outcomes BEFORE starting a gold-lens trace. If a heart breaks, the damage happens but the player hasn't invested tether progress yet. Heart scouting costs time but protects against mid-trace disasters.

**Sacrifice zones:** Experienced players may intentionally leave regions of sky empty as "sacrifice zones" — safe areas to attempt risky constellations without endangering achievements. The grand constellation, spanning the full viewport, deliberately makes this impossible: there IS no safe zone for the endgame. You have to be good enough to win without collateral.

**Star destroyer arbitrage:** With the gone-rogue star destroyer widget (Phase 10), players can harvest forever stars for currency. A dense damaged cluster (grey stars from a broken heart) is worth less currency than healthy white stars. This creates incentive to repair before harvesting — or to strategically let damaged regions stay grey if you plan to rebuild there anyway.

### Node State Machine (Full Lifecycle)

```
                    ♦ Diamond                        ♥ Heart
                   ┌─────────┐                    ┌─────────┐
                   │ visible  │                    │invisible│
                   │ pink-tint│                    │ hidden  │
                   └────┬─────┘                    └────┬────┘
                        │ pink lens (300ms hold)        │ amber lens (300ms hold)
                        ▼                               ▼
                   ┌─────────┐                    ┌───────────┐
                   │  ♦→♣    │                    │  ROLL     │
                   │ UNSTABLE│                    │  d100     │
                   │ 12-18s  │                    └─────┬─────┘
                   └────┬────┘                     ╱    │     ╲
                   timer│expires              ≤60  │  ≤85│    ≤100│
                        ▼                     ♣    ▼    ▼       ▼
                   ┌─────────┐           healthy  wild   broken
                   │ REVERT  │             ♣      ♣★      💀
                   │  → ♦    │             │      │    ┌──────┐
                   │ shatter │             │      │    │DAMAGE│
                   └─────────┘             │      │    │PULSE │
                                           ▼      ▼    └──┬───┘
            ♠ Spade                   ┌──────────┐        │
           ┌─────────┐               │CONNECTABLE│        ▼
           │  dim     │               │  by gold  │   forever stars
           │ flickery │               └─────┬─────┘   take damage
           └────┬─────┘                     │
                │ silver lens               │ gold lens traces path
                │ (300ms hold)              │ shape validates
                ▼                           ▼
           ┌─────────┐               ┌──────────┐
           │  ♠→♣    │               │  SOLVE   │
           │ STABLE  │               │ coin rain│
           │ no timer│               │ burn px  │
           └─────────┘               └──────────┘
```

### Shipped (when complete)

- `public/js/diamond-decay.js` — timer system, warning-phase visual (pink bleed-through, chime escalation), reversion trigger, shatter dispatch
- `public/js/heart-roulette.js` — outcome roller (weighted random), wild-node flag, broken-heart damage pulse, dead-node rendering
- `public/js/constellation-shatter.js` — fracture particle system, shockwave expansion, scar overlay + cooldown timer, collateral damage calculator
- `public/js/forever-sky-damage.js` — damage/heal state per pixel, `#ffffff` → `#666666` downgrade, `#dddddd` scratch + self-heal timer, heal-by-proximity on new solves
- Updated `constellation-tracer.js` — diamond timer awareness during trace, shatter-on-reversion hook, satellite collision shatter
- Updated `suit-transformer.js` — heart outcome roll on amber reveal, wild-node rendering, broken-heart dead-node state

### Deliverables

- Diamond decay timer system with visual warning phase
- Heart outcome roulette (60/25/15 weighted roll on reveal)
- Wild node mechanics (any-angle connections, rainbow shimmer rendering)
- Broken heart damage pulse (8% viewport radius, forever-star downgrade)
- Constellation shatter system (fracture particles, shockwave, scar cooldowns, collateral scaling)
- Forever sky damage/heal state machine (`#ffffff` → `#dddddd` scratch → self-heal | `#ffffff` → `#666666` damage → repair-by-solve)
- Star destroyer currency adjustment (damaged stars worth less than healthy)
- Strategic hint system: "Diamonds don't wait." / "Not every heart is kind."

---

## Dependency Summary

| Phase | Status | Depends On |
|-------|--------|-----------|
| 0 — Extract & Generalize | ✅ Shipped | — |
| 1 — Starfield Underlayment | 🔜 Palette engine done, page rollout remaining | Phase 0 |
| 2 — Overlay Persistence | ✅ Shipped (all 5 pages wired, card data externalized to JSON, portal editor built) | Phase 0 |
| 3 — Joker Colorization | ✅ Shipped (layered DOM, 4 themes, sheen animation) | Phase 0 |
| 4 — Drag-to-Rearrange | ✅ Shipped (ghost+placeholder, morph transitions, order persistence) | Phase 2 + 3 |
| 5 — Porthole Reveal Grid | ✅ Shipped (3 zone types, PuzzleState integration, dead attrs cleaned) | Phase 1 + 4 |
| 6 — Magnifying Glass Repurpose | ⬜ Not started | Phase 5 |
| 7 — Cross-Page Puzzle State | ✅ Shipped (puzzle-state.js, puzzles.json, NCH badge, reveal-grid integration) | Phase 5 |
| 8 — Gold Lens Constellation Tracing | 🔧 Core engine shipped (renderer, tracer, loader, lens overlays, card drag wiring) | Phase 5 + 6 |
| 9 — Multi-Lens Suit Transformation | ⬜ Transformation matrix designed (♦→♣, ♠→♣, ♥→♣) | Phase 8 |
| 10 — Procedural Generation, Cascades & Forever Sky | ⬜ Not started | Phase 8 + 9 |
| 11 — Constellation Ecosystem & Volatility | ⬜ Not started | Phase 9 + 10 |

**Next up:** Phase 6 (magnifying glass zoom repurpose) → Phase 8 (gold lens constellation tracing with suit-symbol nodes and lens gradients) → Phase 9 (multi-lens suit transformation).
