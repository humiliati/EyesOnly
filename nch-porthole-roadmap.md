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

## Phase 3: Joker Emoji Colorization (BLVCK Card Method)

Each joker emoji in the NCH stack gets individually colorized to preview the theme it represents. Apply the BLVCK card technique — dark base with a tinted highlight/glow matching the theme's dominant color. CSS attribute hooks are already stubbed in `nch-overlay.css` (`[data-theme-id="silver"]`, etc.) — just need the filter values filled in.

**Deliverables:** Per-card color mapping (fill in the stubbed CSS), BLVCK card glow treatment, visual QA across silver/amber/phosphor/panther.

---

## Phase 4: Drag-to-Rearrange Polish

Rework the current drag-and-drop-to-select interaction on the coin-cards. Dragging a coin-card within the fan rearranges the card order instead of selecting it (selection stays on tap/click). Rearranging the coin-cards simultaneously reorders the colors in the joker emoji stack so the two stay in sync.

**Deliverables:** Drag-to-reorder gesture handler, synced state between fan card order and joker stack order, updated tap-to-select interaction.

---

## Phase 5: Porthole Puzzle Toolkit Integration

The vision phase. Each card in the NCH widget becomes a "porthole" — a themed lens the user holds up to the page, like Benjamin Franklin's bifocals. Different cards reveal different hidden layers:

- **Arcade card** → game-related clues scattered across the page, viewed through an arcade-colored starfield lens.
- **Other theme cards** → each exposes its own secret layer with unique clues, easter eggs, or hidden content specific to that theme's color/mood.

The `PORTHOLE_PUZZLE_TOOLKIT` defines the clue schema per page, the reveal mechanic (viewport masking tied to pointer/card position), and the hint system that ties clues together cross-page.

**Deliverables:** Porthole clue schema and authoring guide, per-page clue placement system, cross-page puzzle state tracker, reveal viewport renderer (card-shaped mask over the starfield secret layer).

---

## Dependency Summary

| Phase | Status | Depends On |
|-------|--------|-----------|
| 0 — Extract & Generalize | ✅ Shipped | — |
| 1 — Starfield Underlayment | 🔜 Palette engine done, page rollout remaining | Phase 0 |
| 2 — Overlay Persistence | ✅ Merged into Phase 0 | Phase 0 |
| 3 — Joker Colorization | ⬜ CSS hooks stubbed | Phase 0 |
| 4 — Drag-to-Rearrange | ⬜ Not started | Phase 2 + 3 |
| 5 — Porthole Puzzles | ⬜ Not started | Phase 1 + 2 + 3 |

Next up: Phase 1 (starfield on all pages) and Phase 3 (joker colorization) can run in parallel. Phase 2 rollout (adding the script tag to remaining pages) is a quick task that can happen anytime.
