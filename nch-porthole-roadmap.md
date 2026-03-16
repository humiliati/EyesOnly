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

## Phase 2: NCH Overlay — Desktop & Mobile Persistence ✅ (merged into Phase 0)

Originally scoped as a separate phase, this was pulled into Phase 0 since the extraction naturally required it. The overlay mounts on any page, remembers position via localStorage, and works on both desktop (drag) and mobile (touch drag via pointer events).

**Remaining:** Roll out the `<script>` tag + `NchOverlay.init()` call to `/games.html`, `/booking.html`, `/partners.html`, and any other pages. Currently only `index.html` is wired.

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

## Phase 5: Porthole Reveal Grid System

Modular, designer-friendly system for embedding hidden content between the starfield layer and the presented page. Each page defines a **reveal grid** — named zones in screen space where secrets live. Coin-card portholes (and eventually other lenses) expose these zones when held over them.

### What it replaces

The current `/games.html` has a hardcoded reveal mechanic: `magnifying-glass-drag.js` detects overlap with `[data-mag-reveal="cypher-note-2"]` on slot 2, pops an emoji into the porthole center, and deposits the item on drop. This has several problems:

- **Emoji pops instead of sliding** — the preview appears instantly centered in the porthole instead of scrolling into view naturally as the lens moves over the hidden content
- **No "framed" lock-in** — once the item is visible, there's no moment where it "locks" into the porthole; it just stays or disappears
- **Scroll-away drops immediately** — moving the porthole away from the reveal zone clears the preview instantly instead of leaving the item on the grid until the lens is released
- **Single hardcoded item** — adding a second reveal zone means duplicating the entire collision + reveal + persist flow
- **Magnifying glass is redundant** — coin-card portholes already provide the same lens mechanic

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

### Reveal behavior (fixing current bugs)

**Slide-in, not pop-in:** When a porthole overlaps a reveal zone, the hidden content slides into the viewport from the approach direction (based on pointer velocity vector). The content is rendered onto the reveal grid layer at its grid position — the porthole simply exposes the region. No content is injected into the porthole itself.

**Lock-in threshold:** Once the porthole's overlap with the zone exceeds `lockThreshold` (percentage of zone area visible through the lens), the content "locks" — a brief `lockAnimation` plays (pulse-glow, scan-line, border-glow) and the zone gains a `revealed-locked` state.

**Scroll-away persistence:** Moving the porthole away from a locked zone does NOT hide the content. It remains visible on the reveal grid (between starfield and page content) until the user **releases** the porthole (pointerup / card-drop). On release:
- `deposit-to-inventory` — item animates from grid position into inventory slot
- `persist-found` — content stays rendered on the grid permanently (QR codes, easter eggs)
- `pause-and-persist` — video pauses at current frame, stays on grid

**Unlocked scroll-away:** If the user moves the porthole away before reaching `lockThreshold`, the content has NOT locked and scrolls back out of view smoothly (reverse of the slide-in).

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

### Deliverables

- `reveal-grid.js` — zone manager: loads zone definitions, renders hidden content onto the grid layer, handles overlap detection + lock + release lifecycle
- `reveal-zone.css` — zone container styles, lock animations, tier-based glow intensity
- Zone definition schema + validation
- `/games.html` migration: replace hardcoded `data-mag-reveal` + inline reveal logic with zone JSON
- Deprecate magnifying glass as a porthole tool (prepare for Phase 6 repurpose)

---

## Phase 6: Magnifying Glass Repurpose (Zoom Lens)

ITM-200 (magnifying glass) currently duplicates the coin-card porthole mechanic — both drag a starfield viewport over the page. With coin-cards handling porthole reveals in Phase 5, the magnifying glass is freed up for a distinct mechanic: **optical zoom**.

Instead of revealing a hidden starfield layer, the magnifying glass zooms into the actual visible page content — enlarging text, images, map details, fine print, hidden-in-plain-sight micro-text. Think "zoom and enhance" vs "see through walls."

**Potential uses:**
- Zoom into the gone-rogue game map to read tiny labels, spot hidden markers
- Enlarge micro-printed text on booking pages (hidden discount codes, flavor text)
- Inspect high-res artwork for embedded steganographic clues
- Read fine print on "classified" document props

**Deliverables:** Repurpose `magnifying-glass-drag.js` ghost to render a zoomed blit of the page content (CSS `transform: scale(2)` on a clipped viewport) instead of a starfield blit. Keep the same drag UX, ring/vignette chrome, and inventory slot. The zoom lens and porthole lens become two distinct tools in the player's kit.

---

## Phase 7: Cross-Page Puzzle State

Clues found via porthole reveals on different pages connect into multi-step puzzles. A shared puzzle-state tracker persists progress in localStorage and syncs to account when online.

**Deliverables:** Puzzle state schema, cross-page clue registry, progress UI in NCH widget (badge count on joker stack), hint system for stuck players.

---

## Dependency Summary

| Phase | Status | Depends On |
|-------|--------|-----------|
| 0 — Extract & Generalize | ✅ Shipped | — |
| 1 — Starfield Underlayment | 🔜 Palette engine done, page rollout remaining | Phase 0 |
| 2 — Overlay Persistence | ✅ Merged into Phase 0 | Phase 0 |
| 3 — Joker Colorization | ✅ Shipped (layered DOM, 4 themes, sheen animation) | Phase 0 |
| 4 — Drag-to-Rearrange | ✅ Shipped (ghost+placeholder, morph transitions, order persistence) | Phase 2 + 3 |
| 5 — Porthole Reveal Grid | ⬜ Design spec complete, implementation next | Phase 1 + 4 |
| 6 — Magnifying Glass Repurpose | ⬜ Not started | Phase 5 |
| 7 — Cross-Page Puzzles | ⬜ Not started | Phase 5 |

Next up: Phase 1 page rollout (adding nch-overlay script to remaining pages) and Phase 5 implementation (reveal-grid.js + /games.html migration).
