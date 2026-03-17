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
| 8 — Gold Lens Constellation Tracing | ✅ Shipped (renderer, tracer, loader, rewards, gamestate, 6 levels, cross-page persistence) | Phase 5 + 6 |
| 9 — Multi-Lens Suit Transformation | ⬜ Transformation matrix designed (♦→♣, ♠→♣, ♥→♣) | Phase 8 |
| 10 — Procedural Generation, Cascades & Forever Sky | ⬜ Not started | Phase 8 + 9 |
| 11 — Constellation Ecosystem & Volatility | ⬜ Not started | Phase 9 + 10 |
| 12 — Trick Glasses (Compound Porthole / Benjamin Franklin Effect) | ⬜ Spec drafted | Phase 8 |

**Next up:** Phase 12 (trick glasses compound porthole system) → Phase 9 (multi-lens suit transformation).





---

## Constellation Resolution & Yield Economy — Refined Spec (Phase 8.5)

**Status:** ✅ constellation-rewards.js shipped (2026-03-17)
**File:** `public/js/constellation-rewards.js`

### Yield Economy (Phase 11 Risk Model)

Base formula: `(nodeCount × 3) + (revealedStars × 2) + (dirChanges × 1) + (intersections × 2)`
Clamped: min 6, max 60.

| Tier   | Nodes | Expected Yield | Bursts/Star | Trail |
|--------|-------|---------------|-------------|-------|
| Tiny   | 3     | 6–9           | 1           | none  |
| Small  | 4–6   | 12–20         | 2           | none  |
| Medium | 7–9   | 20–35         | 2           | faint |
| Large  | 10–12 | 35–50         | 3           | yes   |

### Resolution Animation Timeline (1.5 s)

```
  0 ms   SURGE — tether pops, line glows gold, width 1.5→5.5px, scale +6%
150 ms   ENERGY SWEEP — gold pulse travels parametric t=0→1 along path
         Stars ignite sequentially as pulse passes; 4 sparks per star
300 ms   LINE FRACTURE — emitters activate behind pulse (every 30px)
         Coins eject perpendicular to line direction from fracture points
500 ms   COIN WATERFALL — star burst coins (1–3 bursts/star, staggered 120ms)
         coin_rain.wav plays; coin_flip.wav per star (staggered 80ms)
1000 ms  COUNTER TICKS — currency-increment events dispatch (~60ms/tick)
         clickandrelease-1 SFX per tick
1200 ms  COIN POUCH — coin_pouch_1.wav; last coins fade; tether fully dissolved
1500 ms  COUNTER SETTLES — currency-settle event; animation complete
```

### Coin Particle System (Canvas)

- Sprite source: `assets/Sprites/Coin/Coin Flip (animation frames)/goldcoin-frame1..6.png`
- Animation: 12 fps (~83ms/frame), 6 frames, no loop
- Physics: vx random(±40), vy initial -40...-70, gravity 350 px/s²
- 30% of coins spawn as "background" depth (70% scale, slower fall, 50% opacity)
- Sparks: 1–2px gold dots, 200–350ms lifetime, light gravity

### Audio Stack (layered)

| Timing   | SFX                  | Volume | Source Path                           |
|----------|---------------------|--------|---------------------------------------|
| 500 ms   | coin_rain            | 0.45   | encoded_for_r2/coin_sfx/coin_rain     |
| 600+ ms  | coin_flip ×nodeCount | 0.30   | encoded_for_r2/coin_sfx/coin_flip     |
| 1000+ ms | clickandrelease-1    | 0.20   | encoded_for_r2/new_sfx/clickandrelease-1 |
| 1200 ms  | coin_pouch_1         | 0.55   | encoded_for_r2/coin_sfx/coin_pouch_1  |

### Integration Points

- `ConstellationTracer._resolveConstellation()` → calls `ConstellationRewards.play()`
- Render hook: tracer's `_renderHook()` calls `ConstellationRewards.renderFrame()` every frame
- Counter events: `currency-increment` and `currency-settle` CustomEvents on document

### Remaining Polish (not yet shipped)

- [ ] Coin motion trails (2 ghost frames behind each coin for streak illusion)
- [ ] Depth parallax: background coins fall slower (vy × 0.7)
- [ ] Star flare particle burst before coin spawn (spark spray → coin burst sequence)
- [ ] Moving gradient "liquid gold" shader on tether during surge phase
- [ ] Specular sweep (thin white shimmer band ahead of gold pulse)
- [ ] Micro-ripple sine-wave brightness along tether
- [ ] Ultra-polish: slight constellation plane tilt toward viewer (scaleY 1.05)
- [ ] Counter UI widget (visual coin counter with pulse animation on settle)
- [ ] Phase 11: revealed-star bonus wired to multi-suit lens prep system

---

## Phase 12 — Trick Glasses (Compound Porthole / Benjamin Franklin Effect)

**Status:** ⬜ Spec drafted (2026-03-17)
**Depends on:** Phase 8 (constellation tracing + gamestate), drag-to-reorder parity

### Concept

Benjamin Franklin invented bifocal glasses by cutting two lenses and combining them. Our "trick glasses" mechanic works the same way: each of the 4 card portholes shows a different slice of the starfield, and when two portholes overlap (drag one card over another's resting position), their combined views reveal something hidden that neither shows alone.

The starfield already does this naturally — each `.starfield-window` canvas blits its screen-space rectangle from the shared master canvas via `getBoundingClientRect()`. Cards at different horizontal positions already see different regions of the sky. The trick is to paint hidden content into the master canvas that is **split across a spatial band** so that it only becomes visible when the right pair of portholes align.

### Core Mechanic: The Reveal Band

A **reveal band** is a horizontal strip (desktop) or vertical strip (mobile) embedded in the starfield master canvas. It contains a hidden image/pattern/message that is intentionally distributed so that:

- No single porthole can see the complete image (it's wider than one porthole)
- Two specific portholes at the right positions (card order slots) see complementary halves
- The 4 card slots map to 4 equally-spaced sample points along the band
- Reordering cards changes which porthole sees which slice

```
Desktop band (horizontal, ~center Y of viewport):

  slot 0          slot 1          slot 2          slot 3
  [panther]       [silver]        [amber]         [phosphor]
     ●───────────────●───────────────●───────────────●
     │   slice A     │   slice B     │   slice C     │   slice D
     └───────────────┴───────────────┴───────────────┘
                    THE REVEAL BAND

Mobile band (vertical, ~center X):
  Same idea rotated 90°, cards stacked top-to-bottom
```

### How Overlap Reveals the Hidden Image

When a player drags the amber card (slot 2) and hovers its porthole over the panther card's resting position (slot 0):

1. The **resting** panther porthole shows slice A (its screen position)
2. The **dragged** amber porthole is now AT slot 0's screen position — it also shows slice A
3. But amber has a **lens filter** (blue complementary tint via the glowing ring)
4. The hidden content is painted with a **dual-channel encoding**: half the detail in a color that panther's pink lens reveals, half in a color that amber's blue lens reveals
5. When both portholes show the same slice with different filters → the image completes

This is a CSS `mix-blend-mode` trick: each porthole canvas gets composited through its lens filter. The hidden image is painted with colors that are invisible under one filter but visible under another.

### Dual-Channel Encoding

Hidden content in the reveal band is painted in two spectral channels:

| Channel    | Visible through | Invisible through | Color             |
|-----------|----------------|------------------|-------------------|
| Channel A | Pink lens (panther) | Blue lens (amber) | Cyan-shifted      |
| Channel B | Blue lens (amber) | Pink lens (panther) | Red-shifted       |
| Channel C | Amber lens (phosphor) | Silver lens (silver) | Blue-shifted |
| Channel D | Silver lens (silver) | Amber lens (phosphor) | Warm-shifted |

Half the hidden glyph is painted in Channel A, half in Channel B. Looking through only one lens shows noise/fragments. Both lenses at the same position → complete image.

### Implementation Architecture

#### 1. Reveal Band Renderer (`reveal-band.js`)

New module that paints hidden content into the starfield master canvas via `addPostRenderHook`. Content is loaded from `/data/reveal-bands.json` which defines:

```json
{
  "bands": [
    {
      "id": "band-1-cipher",
      "axis": "auto",
      "y": 0.45,
      "height": 0.12,
      "content": {
        "type": "glyph-pair",
        "channelA": { "glyphs": "♣▲◆", "color": "rgba(0,200,200,0.08)" },
        "channelB": { "glyphs": "♠★●", "color": "rgba(200,50,50,0.08)" }
      },
      "requiredLenses": ["panther", "amber"],
      "reward": "cipher-key-1"
    }
  ]
}
```

The renderer paints glyphs / patterns at very low opacity into the master canvas at the band's Y position, distributed horizontally across the viewport width. Without a lens filter, they're invisible (8% opacity blends into star noise). With the right CSS filter on the porthole, they emerge.

#### 2. Porthole Lens Filters (CSS layer on `.starfield-window`)

Each card's porthole already has a theme-associated lens (via `.porthole-lens-overlay`). For trick glasses, we add a CSS `filter` to the `.starfield-window` canvas itself (not the overlay ring) that shifts the color response:

```css
/* Applied via JS when card is in "lens mode" (during drag or inspection) */
.starfield-window.lens-filter-blue   { filter: hue-rotate(180deg) saturate(2); }
.starfield-window.lens-filter-pink   { filter: hue-rotate(300deg) saturate(2); }
.starfield-window.lens-filter-amber  { filter: hue-rotate(40deg) saturate(1.5); }
.starfield-window.lens-filter-silver { filter: contrast(1.3) brightness(1.1); }
```

These filters amplify one channel while suppressing another, making the dual-encoded hidden content selectively visible.

#### 3. Overlap Detection (`porthole-overlap.js`)

When a dragged card's porthole overlaps a resting card's porthole:

```
overlap = intersection_area(dragged_porthole_rect, resting_porthole_rect)
                / min(dragged_area, resting_area)
```

If overlap > 60%:
- Fire `porthole-overlap` event with `{ draggedLens, restingLens, overlapPct }`
- Apply compound filter to the resting card's `.starfield-window`
- Trigger visual feedback: both glowing rings pulse in sync, brightness surge

If both lenses match a band's `requiredLenses` → the hidden content is fully revealed. Fire `trick-reveal` event → reward.

#### 4. Drag-to-Reorder Standardization

**CRITICAL PREREQUISITE**: The splash-screen drag system must support card reordering (not just drag-to-edge-select). Parity with nch-overlay's `_updateDropGap` system:

- Splash-screen `_updateCardDrag` calls `_updateDropGap(ev.clientX, ev.clientY)`
- `_updateDropGap` moves placeholder in DOM based on cursor position vs card midpoints
- `_endCardDrag` inserts card at placeholder position if not edge-dropped
- Card order persists to `localStorage` via existing `_saveCardOrder` / `_restoreCardOrder`

This is required because card slot position determines which slice of the reveal band each porthole shows. Reordering changes the puzzle.

### Gameplay Flow

1. **Passive discovery:** Player notices faint shapes in one card's porthole while idly looking at the fan. "Is that... something?"

2. **Experimentation:** Player drags cards around, notices the shapes change based on card order. They reorder to put panther leftmost — the shape almost resolves.

3. **The compound moment:** Player picks up the amber card and slowly drags its porthole over the resting panther porthole. Both rings pulse. The hidden glyph completes — a cipher key, a map fragment, a code word.

4. **Reward:** `trick-reveal` event fires. Cipher key unlocks a terminal command or reveal-zone puzzle. Coins awarded. The discovery is persisted in gamestate.

### Actionable Implementation Steps

```
□ Step 1: Splash-screen drag-to-reorder parity
    - Port _updateDropGap logic from nch-overlay.js into splash-screen.js
    - Add placeholder movement during drag
    - Insert card at placeholder on drop (if not edge-dropped)
    - Persist new order to localStorage
    - Wire _saveCardOrder / _restoreCardOrder

□ Step 2: Build reveal-band.js
    - Post-render hook that paints dual-channel encoded content
    - Load band definitions from /data/reveal-bands.json
    - Paint at low opacity (6-10%) so invisible without filter
    - Content types: glyphs, dot patterns, line fragments

□ Step 3: Build porthole-overlap.js
    - Track dragged porthole rect vs all resting porthole rects
    - Calculate overlap percentage per frame
    - Fire porthole-overlap / porthole-separate events
    - Threshold: 60% overlap → compound mode

□ Step 4: CSS lens filters on .starfield-window
    - Per-theme hue-rotate + saturate filters
    - Applied via class toggle when card is in compound mode
    - Compound mode: resting card gets BOTH filters stacked

□ Step 5: Compound visual feedback
    - Both glowing rings pulse in sync when overlap > 60%
    - Brightness surge on both portholes
    - Ring color blends to white at 100% overlap
    - Subtle audio cue (low hum or chime)

□ Step 6: Trick-reveal resolution
    - When requiredLenses both active at same band position
    - Hidden content fully visible → fire trick-reveal event
    - Reward: cipher key / coins / narrative unlock
    - Persist to gamestate

□ Step 7: Content authoring
    - Design 3-4 reveal band puzzles
    - Each requires a different lens pair
    - Progressive difficulty: obvious → subtle → requires 3+ cards
```

### File Plan

| File | Purpose |
|------|---------|
| `js/reveal-band.js` | Post-render hook: paints dual-channel hidden content into master canvas |
| `js/porthole-overlap.js` | Overlap detection + compound mode management |
| `data/reveal-bands.json` | Band definitions (position, content, required lenses, reward) |
| `css/trick-glasses.css` | Lens filter classes, compound mode visual effects |

### Design Constraints

- **No extra canvases.** The dual-channel content is painted directly into the existing master starfield canvas via post-render hooks. The existing blit pipeline handles everything.
- **No performance cost at rest.** The reveal band renderer only paints during the post-render hook (already runs every frame). Hidden content is a few dozen fillText/fillRect calls at near-zero opacity.
- **Mobile-aware.** On mobile, cards stack vertically, so the band axis flips to vertical. Overlap happens when a dragged card moves over a card above/below it in the stack.
- **Progressive disclosure.** First trick reveals are obvious (large glyphs, high-ish opacity). Later ones are subtle (dot patterns, very low opacity, require precise alignment).

---

### Original Design Notes (archived)

Below are the raw brainstorm notes that produced the above spec. Kept for reference.



rough ideas:



3 node puzzles should only yield~ 6 coins

4 node puzzles with multiple star reveals yield ~ 15 coins

12 node puzzles all multiple stars ~ 50 coins



let's design a skeleton for a coherent yield economy that incentivizes risk per phase 11



then



we have at C:\Users\hughe\.openclaw\workspace\EyesOnly\MEDIA_ASSETS\SFX\ coin sfx that needs to be encoded and moved to encoded_for_r2 folder , and ready for deployment to r2 via the r2-gap-upload . 

we want to Play coin rain once or twice depending on yeld with a normal Coin Pouch 1 that finishes the rain sound as our new coin sprite "waterfalls" from the star nodes. 



we have a new set of sprites to utilize at C:\Users\hughe\.openclaw\workspace\EyesOnly\public\assets\Sprites\Coin\Coin Flip



the vision is these coins are rendered at the same width as the club.star node, and when a constellation resolution happens, each symbol as it burns in "rains" 1 or 2 coin flip animations as the sfx play and currency cointer updates.



the currency counter should start updating at about 1 second into the animation and be the last thing moving at the 2 & 3nd second as it updates while the waterfall and sounds had been complete for ~a seconds



the tether line needs to pop and glow and rise towards the screen with a zoom and a fade as the coin waterfalls and the currency counter updates



the currency counter should make the same click-release sfx as the decoder rings while they're spinning to update. so we're playing 

coin rain + coin flip to finalize

currency counter starts sounding click-release, based on yeld, halfway through coin rain and should tick a few times after coin rain has been finalized by coin flip.



the total animation time should take ~1.5 second


You’re designing two systems simultaneously:

Puzzle yield economy (risk vs reward progression)

Resolution animation pipeline (visual + audio choreography)

Below is a clean skeleton that ties them together so the economy, animation timing, and asset pipeline all stay consistent.

1. Constellation Yield Economy (Phase 11 Risk Model)

The reward should reflect three risk variables:

Variable	Meaning
Nodes	path length / effort
Hidden stars	required lens prep
Path complexity	angles / intersections

Define a base yield per node and multiply by modifiers.

Base Node Value
baseNodeValue = 3 coins

Example baseline:

Nodes	Base
3	9
4	12
8	24
12	36
Lens Preparation Bonus

Each revealed star adds risk.

+2 coins per revealed star

Examples:

Puzzle	Calculation	Yield
3 nodes	3×3	~9 → clamp to 6
4 nodes +2 reveals	12 +4	16
12 nodes +6 reveals	36 +12	48

This lands very close to your targets.

Complexity Bonus

Add small bonuses for interesting shapes.

+1 coin per direction change
+2 coins per intersection

Final yield clamped:

min = 6
max = 60
Risk Incentive Curve

Players should want to attempt bigger shapes.

Tier	Nodes	Yield
Tiny	3	6
Small	4-6	12-20
Medium	7-9	20-35
Large	10-12	35-50

The yield per node rises slightly for longer puzzles to encourage risk.

2. Constellation Resolution Animation

Total target time:

1.5 seconds

Timeline below.

Animation Timeline
0 ms — Lock Event

When the final node connects:

tether line pops

line glows gold

quick scale-up toward camera

slight fade

Duration:

0 → 200 ms
200 ms — Constellation Burn-In

Stars brighten sequentially along the path.

Each star:

glow → flare → coin spawn

Duration:

200 → 600 ms
600 ms — Coin Waterfall Begins

Each star emits 1–2 coins.

Rules:

Yield	Coins per star
≤15	1

15 | 2 |

Coins:

use Coin Flip sprites

same width as club.star nodes

Motion:

spawn at star
fall ~80px
fade out

Duration:

600 → 1100 ms

Sound:

coin_rain.wav
1000 ms — Counter Begins Updating

The currency counter delays intentionally.

Start update:

~1 second

Sound:

click-release (decoder ring)

Each increment:

~60 ms per tick

Example:

+15 coins → 15 ticks

But visually batch them:

tick every 2–3 coins

to prevent long sequences.

1200 ms — Coin Rain Finalization

Play:

Coin Pouch 1

Sound effect marks coin rain completion.

Coin flips stop.

1200 → 1500 ms — Counter Finish

Currency counter continues ticking slightly after rain ends.

Final visual moment:

counter pulse

small glow

Visual Flow Summary
0ms    tether pop + glow
200ms  constellation burn
600ms  coin waterfall + rain sfx
1000ms counter starts ticking
1200ms coin pouch finish
1500ms counter settles
Coin Spawn Logic

Example pseudo-code:

function spawnCoins(stars, yield){
  const coinsPerStar = yield > 15 ? 2 : 1

  stars.forEach(star=>{
    for(let i=0;i<coinsPerStar;i++){
      spawnCoinFlip(star.x, star.y)
    }
  })
}
Counter Update Logic
function animateCounter(yield){
  const step = Math.ceil(yield / 8)

  let remaining = yield

  const interval = setInterval(()=>{
    const add = Math.min(step, remaining)
    account.balance += add
    updateCounterUI()

    remaining -= add
    if(remaining <= 0) clearInterval(interval)
  },60)
}

This keeps the counter active but fast.

Audio Stack

During a victory event:

1. coin_rain.wav
2. coin_flip.wav (per star)
3. coin_pouch_1.wav
4. click_release.wav (counter)

The key is overlapping layers.

The ear hears:

rain → flip → pouch → counter ticks

which feels rich but controlled.

Asset Pipeline (R2 Deployment)

Source folder:

MEDIA_ASSETS/SFX/coin

Target:

encoded_for_r2

Pipeline:

source WAV
→ encode OGG + MP3
→ place in encoded_for_r2
→ r2-gap-upload

Example encoded structure:

encoded_for_r2/
  coin_rain.ogg
  coin_flip.ogg
  coin_pouch_1.ogg
  click_release.ogg
Coin Sprite Behavior

Sprites:

Sprites/Coin/Coin Flip

Animation properties:

fps: 12
duration: ~450 ms
loop: false

Physics:

velocityY: 120px/s
gravity: 350px/s²

Coins fade before reaching bottom so the screen never fills.

Psychological Effect

The sequence should feel like:

Constellation ignites

Stars pay tribute

Coins rain from the sky

Account acknowledges the bounty

This reinforces the fantasy that the sky itself rewards discovery.

If you'd like, I can also show a very powerful UI trick for the coin rain that will make the waterfall look 10× richer without spawning hundreds of DOM elements (it uses a single canvas particle layer that renders coin sprites extremely cheaply).

how do we make the waterfall look richer while only pouring from star.node . we also want the yield animation to somewhat align with yield.

To make the coin waterfall feel rich while still spawning only from star nodes, the trick is not increasing the number of objects — it’s increasing visual depth per coin event. You can make a small number of coins feel like a large cascade by layering staggering, parallax, trails, and burst timing.

The second goal is making the animation visually proportional to yield without extending total animation time.

Below is a system that accomplishes both.

1. Yield → Visual Intensity Mapping

Instead of directly mapping coins to yield, map yield to three parameters:

coinBursts
burstDensity
trailIntensity

Example scaling:

Yield	Bursts per star	Coins per burst	Trail
6	1	1	none
15	2	1–2	faint
50	3	2	strong

This keeps object count small but visual richness increases.

2. Burst Waterfall Instead of Continuous Rain

Instead of coins dripping steadily, each star releases burst clusters.

Example:

star.node
   ↓
burst 1 (3 coins)
burst 2 (2 coins)
burst 3 (3 coins)

Stagger bursts slightly:

0ms
120ms
260ms

The brain reads this as a flowing waterfall even with ~6 coins total.

3. Micro-Arc Motion

Straight vertical falls look cheap.

Give each coin a slight horizontal arc.

Example physics:

vx = random(-40,40)
vy = 120
gravity = 350

Coins drift outward slightly from the star before falling.

This creates spray like a fountain.

4. Motion Trails

Instead of spawning more coins, give each coin a faint streak trail.

Implementation:

coin sprite
+ 2 fading ghost frames behind it

or canvas trail:

draw previous positions with opacity decay

Visually this turns:

1 coin

into something that looks like:

3-4 streaks
5. Depth Parallax

Spawn two coin layers:

foreground coins (100%)
background coins (70% scale)

Background coins:

fall slower
fade sooner

This creates depth without extra objects.

Example:

foreground: vy = 130
background: vy = 90
6. Star Flare Emitters

Before coins spawn, the star briefly flares and ejects particles.

Sequence per star:

flare
spark spray
coin burst

Spark particles are cheap (small circles) but give the feeling of energy release.

7. Constellation Wave Trigger

Instead of all stars raining simultaneously, activate them along the constellation path.

Example:

star1 → star2 → star3 → star4

Delay:

40ms per star

This makes the constellation feel like a fuse burning.

Then the coins cascade after each ignition.

8. Coin Flip Timing

Your coin flip animation should finish just before the coin disappears.

Example:

spawn
flip animation (450ms)
fade

Coins should vanish mid-fall before reaching the bottom of the screen so the scene never fills up.

9. Yield-Proportional Coin Logic

Use yield to control burst count rather than object count.

Example logic:

function waterfallForStar(star, yield){
  const bursts = Math.min(3, Math.ceil(yield / 20))

  for(let b=0;b<bursts;b++){
    setTimeout(()=>{
      spawnBurst(star)
    }, b * 120)
  }
}

Burst definition:

function spawnBurst(star){
  const coins = 1 + Math.floor(Math.random()*2)

  for(let i=0;i<coins;i++){
    spawnCoin(star.x, star.y)
  }
}

Typical outcome:

small puzzle → ~3 coins total
large puzzle → ~15 coins total

But visually it feels much larger.

10. Coin Pouch Finale

When the rain finishes:

coin_pouch_1.wav

At that moment:

last coin flips

star glow fades

counter accelerates its final ticks

This gives closure to the cascade.

11. Synchronizing With the Counter

Counter should begin after the first coin burst.

Suggested timing:

0ms   constellation lock
200ms stars ignite
500ms coin bursts begin
1000ms counter ticks start
1200ms coin pouch
1500ms counter settles

This way the counter feels like the accounting system catching up to the sky’s reward.

12. Cheap Rendering Trick

Instead of individual DOM nodes, use a single canvas particle system for coins.

Each coin stores:

x
y
vx
vy
frame
opacity

Rendering loop draws all coins in one pass.

Benefits:

50+ coins possible
minimal performance cost

Even if you only spawn ~10 coins, canvas lets them feel fluid.

13. Visual Density Multiplier

You can multiply perceived density by adding coin echo sprites.

Example:

coin
+ faint mirrored copy offset by 3px

This creates the illusion of more coins than exist.

Resulting Experience

When a constellation resolves:

tether line surges toward the viewer

stars ignite sequentially

coins burst from each star in small fountains

streak trails create a waterfall illusion

coin rain sound fills the space

coin pouch closes the cascade

counter ticks upward

All within ~1.5 seconds, but it feels dense and rewarding.

If you want, I can also show a very slick constellation-to-coin animation trick where the tether lines themselves dissolve into coins as they rise toward the camera.

It looks like the constellation is literally melting into currency, and it costs almost no extra rendering work.

let's look at the constellation to coin animation trick where the tether lines themselves dissolve into coins

The tether-to-coin dissolve works well because it converts an existing visual element (the constellation lines) into the reward particles instead of spawning everything from scratch. It looks richer, keeps object counts low, and visually explains “the constellation turning into money.”

The idea is: the line itself fractures into coin emitters that travel along the path before falling.

Below is a clean structure for implementing it.

Core Idea

Instead of:

stars → coins

You do:

stars → line ignition → line fracture → coins emerge from the line

The player sees the tether line melt into currency.

Visual Sequence
Phase 1 — Lock & Surge (0–200 ms)

The constellation line:

thickens

glows gold

scales slightly toward camera

opacity ↑
width ↑
bloom effect

Purpose: focus the player on the constellation shape.

Phase 2 — Energy Sweep (200–450 ms)

A gold pulse travels along the line path.

Think of it as a fuse.

star1 → star2 → star3 → star4

The pulse width should be about:

8–12px

It leaves a heated trail.

Implementation trick:

gradient sweep along line path
Phase 3 — Line Fracture (450–750 ms)

As the energy pulse travels, the line breaks into segments.

Each segment becomes a coin emitter.

Visual look:

----->____->____->____

Where each break point spawns coins.

Segment spacing:

every 24–40px along the line

So even a small constellation line yields multiple coin sources.

Phase 4 — Coin Emergence (600–1100 ms)

Coins spawn along the line segments, not just the stars.

This dramatically increases perceived density.

Example for a 4-node constellation:

stars: 4
line segments: ~8
emitters: 12

But each emitter spawns only 1 coin.

So you might spawn:

12 coins total

but it looks like a full waterfall.

Phase 5 — Coin Waterfall Motion

Coins appear to peel off the line.

Initial motion:

vx: random(-50,50)
vy: 80

Then gravity pulls them downward.

Add slight rotation while falling.

Phase 6 — Star Final Burst (900 ms)

After line emitters finish, stars release one final coin burst.

This ties the animation back to the star nodes.

Example:

each star → 1–2 coins
Phase 7 — Coin Pouch Finale (1200 ms)

Play:

coin_pouch_1.wav

At that moment:

last coins flip

constellation line fades

Aligning With Yield

Yield determines how many fracture emitters activate.

Example:

Yield	Line Emitters Activated
6	stars only
15	stars + 30% line segments
50	stars + all line segments

Example logic:

emitters = lineSegments.slice(0, yield / 3)

This ties animation density to reward.

Efficient Rendering

Instead of DOM elements, treat coins as particles in a canvas.

Each coin object:

x
y
vx
vy
rotation
frame
opacity

Rendering loop:

draw coin sprite
update physics
fade

You can render 50+ coins cheaply.

Visual Trick: Coin Sparks

When the line fractures, emit tiny gold sparks.

These are just 2px glowing dots.

3 sparks per fracture

They make the break feel energetic without heavy rendering.

Making the Line “Melt”

Instead of abruptly removing the line, shrink its opacity behind the pulse.

pulse position → line opacity = 0

So it appears the energy consumes the constellation.

Example Timing
0 ms     line lock + glow
200 ms   energy sweep begins
450 ms   line fractures
600 ms   coins peel from line
900 ms   star burst coins
1200 ms  coin pouch
1500 ms  counter settles
Resulting Visual Narrative

The player experiences:

constellation ignites

golden energy travels the path

the tether lines fracture

coins burst from the fracture points

stars pay tribute with final coins

pouch sound closes the cascade

counter tallies the reward

The constellation literally transmutes into currency.

Optional Ultra-Polish Trick

At the start of the animation, slightly tilt the constellation plane toward the viewer (scale Y ~1.05, X ~1.1).

When the coins fall, they appear to drop out of the sky plane, making the reward feel dimensional.


The elegant trick is to treat the constellation lines as a parametric path and place emitters using a normalized distance parameter (t) along that path.

Instead of hard-coding emitter positions, you sample the line geometry itself. This guarantees that fracture emitters always sit exactly on the tether line, even if the constellation shape changes.

This is a standard technique in particle systems called path sampling or arc-length emission.

1. Represent the Constellation as Segments

Your constellation is already a sequence of nodes.

Example:

A → B → C → D

Convert this into line segments:

[A,B]
[B,C]
[C,D]

Each segment has a length.

2. Compute Total Path Length

You measure the entire constellation path.

function segmentLength(a,b){
  return Math.hypot(b.x - a.x, b.y - a.y)
}

Then sum:

totalLength = segments.reduce(
  (sum,s)=>sum + segmentLength(s.a,s.b),
  0
)

Now the entire constellation can be addressed as:

t = 0 → start
t = 1 → end
3. Sample Emitters Along the Path

Instead of placing emitters per node, sample them along the path at regular intervals.

Example spacing:

every 30px

Convert to normalized parameter:

spacing = 30 / totalLength

Emitter loop:

for(let t = 0; t <= 1; t += spacing){
  emitters.push(samplePointOnPath(t))
}
4. Sampling Function (The Key Trick)

The sampler walks the path until it finds where t lands.

function samplePointOnPath(t){
  let target = t * totalLength
  let acc = 0

  for(const s of segments){
    const len = segmentLength(s.a,s.b)

    if(acc + len >= target){
      const localT = (target - acc) / len

      return {
        x: s.a.x + (s.b.x - s.a.x) * localT,
        y: s.a.y + (s.b.y - s.a.y) * localT
      }
    }

    acc += len
  }
}

Now emitters perfectly follow the constellation geometry.

5. Fracture Pulse Along the Path

Use the same t parameter for the energy sweep.

Example pulse position:

pulseT = time / duration

Emit coins when:

abs(emitter.t - pulseT) < threshold

This makes emitters activate exactly as the pulse passes them.

Result:

star → line → star → line → star

fractures naturally.

6. Coin Ejection Direction

You can compute the local line direction for each emitter.

Segment direction:

dx = b.x - a.x
dy = b.y - a.y

Perpendicular vector:

px = -dy
py = dx

Use it to push coins outward:

vx = px * random(20,50)
vy = py * random(20,50)

Coins peel away from the line, which looks like the tether exploding.

7. Yield Scaling

Instead of adding more emitters, activate more of the sampled points.

Example:

emitters = allEmitters.slice(0, yield / 3)

So high yield means:

more fracture points
denser coin rain

without changing the geometry logic.

8. Why This Is Powerful

This technique automatically adapts to:

any constellation shape

any node count

procedural constellations

curved paths if you add splines later

No manual placement.

9. Visual Result

When the constellation resolves:

tether line glows

energy pulse travels along the path

fracture emitters activate along the geometry

coins peel outward from those points

star nodes finish with coin bursts

The constellation literally dissolves into currency along its exact geometry.


1. Use a Moving Gradient Instead of a Static Line

Instead of rendering the tether as a flat color, render it as a linear gradient whose offset moves over time.

Conceptually:

dark gold → bright gold → white highlight → bright gold → dark gold

As this gradient shifts along the line, it appears like liquid metal flowing.

Example gradient stops:

0%   #6e4b00
40%  #c69200
50%  #fff3b0
60%  #c69200
100% #6e4b00

Then animate the gradient offset.

Pseudo-logic:

flowOffset += time * flowSpeed

Each frame the highlight moves forward.

2. Pulse Thickness With the Flow

As the golden wave passes a section of line, briefly increase the line width.

Example:

base width: 3px
pulse width: 6px

Use the same t parameter from the path sampling system.

distance = abs(segment.t - pulseT)
width = base + max(0, (1 - distance * falloff)) * pulseAmount

This gives the impression of pressure pushing through the conduit.

3. Add a Specular Sweep

Metal looks metallic because of moving highlights.

Add a thin white shimmer band slightly ahead of the gold pulse.

white highlight width ≈ 2px
opacity ≈ 0.6

Offset it slightly:

highlightT = pulseT + 0.02

So visually:

white shimmer → molten gold → cooling gold

This layering makes the line look molten rather than glowing.

4. Add Micro Ripples

Introduce a tiny sine-wave distortion to the brightness along the line.

Concept:

brightness = base + sin(t * rippleFrequency + time * rippleSpeed)

This creates subtle liquid movement instead of a flat gradient.

Use small values:

frequency ≈ 12
amplitude ≈ 0.1

The ripple makes the gold appear to flow turbulently.

5. Coin Fracture Synchronization

Your fracture emitters should activate exactly when the gold pulse reaches them.

If each emitter has parameter t:

if abs(emitter.t - pulseT) < 0.02
    fracture()

At the fracture moment:

line brightness spikes

tiny gold sparks eject

coin particles spawn

Visually:

gold flow → pressure spike → line cracks → coins erupt

It looks like gold liquefying and breaking apart into coins.

6. Add Gold Sparks Along the Pulse

Before coins appear, emit a few tiny particles from the line:

size: 1–2px
lifetime: 200ms
color: warm gold

They travel slightly upward before fading.

This makes the line feel energetic and molten.

7. Fade the Line Behind the Pulse

As the gold wave travels, fade the line behind it.

opacity = 1 - smoothstep(pulseT - fadeDistance, pulseT, segmentT)

This gives the illusion that the pulse consumes the constellation.

Eventually the line disappears entirely, replaced by coins.

8. Timing With the Full Animation

Recommended timeline:

0ms   constellation locks
150ms gold flow begins
300ms pulse traveling
450ms fracture emitters trigger
600ms coin waterfall starts
1000ms counter starts ticking
1200ms coin pouch sound
1500ms animation complete

The gold flow and fracture must overlap slightly so the transition feels natural.

9. Rendering Efficiency Trick

Instead of drawing each segment individually:

draw the constellation path once on a canvas layer

apply the moving gradient shader-style

This avoids per-segment DOM updates and makes the animation smooth.

10. Visual Narrative

When the player completes a constellation:

the tether ignites

molten gold begins flowing through the path

a bright shimmer leads the wave

the line thickens as pressure builds

fracture points burst open

coins peel from the golden stream

the constellation dissolves into falling currency

The result feels like the sky itself is minting coins from the discovered constellation.