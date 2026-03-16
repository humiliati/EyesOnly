# NCH Porthole Widget — Site-Wide Roadmap

## Phase 0: Foundation — Extract & Generalize

Decouple the NCH widget and hand-fan-component from `gone-rogue` into a standalone, importable module. The widget currently lives inside gone-rogue's splash screen; it needs to become a first-class overlay that any page can mount independently. This phase also involves auditing the existing drag-and-drop behavior and the BLVCK card colorization method so both can be reused downstream.

**Deliverables:** `nch-overlay` package/module, documented API surface, unit tests for card state management.

---

## Phase 1: Starfield Underlayment

Every page on the site (except gone-rogue) gets a hidden starfield layer sitting beneath the normal content. The starfield remains invisible until the hand-fan-component's coin-cards open a viewport into it. Each theme variant of the starfield uses a distinct color palette so that the "lens" color is immediately recognizable.

**Deliverables:** Starfield renderer with per-theme color configs, viewport clipping logic tied to the coin-card aperture, performance budget (GPU/CPU) for always-on underlayment.

---

## Phase 2: NCH Overlay — Desktop & Mobile Persistence

Mount the `nch-overlay` widget on every non-gone-rogue page. The widget remembers the last position the user dragged it to (per device class) via local storage or equivalent. On mobile this means a draggable floating button; on desktop a resizable mini-panel. Tapping/clicking the widget opens the hand-fan-component, which fans out the coin-cards over the starfield viewport.

**Deliverables:** Position-persistence layer, responsive drag behavior, open/close animation for the hand-fan.

---

## Phase 3: Joker Emoji Colorization (BLVCK Card Method)

Each joker emoji card in the NCH stack gets individually colorized to preview the theme it represents. Apply the BLVCK card technique — dark base card with a tinted highlight/glow that matches the theme's dominant color. When the user fans out the hand, each card visually communicates "this is the blue starfield," "this is the gold starfield," etc., before they even select it.

**Deliverables:** Per-card color mapping config, BLVCK card shader/CSS treatment, visual QA across all themes.

---

## Phase 4: Drag-to-Rearrange Polish

Rework the current drag-and-drop-to-select interaction on the coin-cards. Dragging a coin-card within the fan rearranges the card order instead of selecting it (selection moves to a tap/click). Rearranging the coin-cards simultaneously reorders the colors in the joker emoji stack so the two always stay in sync.

**Deliverables:** New drag-to-reorder gesture handler, synced state between fan order and emoji stack order, updated tap-to-select interaction.

---

## Phase 5: Porthole Puzzle Toolkit Integration

This is the vision phase. Each card in the NCH widget becomes a "porthole" — a themed lens the user holds up to the page, like Benjamin Franklin's bifocals. Different cards reveal different hidden layers:

- **Arcade card** → shows game-related clues scattered across the page, viewed through an arcade-colored starfield lens.
- **Other theme cards** → each exposes its own secret layer with unique clues, easter eggs, or hidden content specific to that theme's color/mood.

The `PORTHOLE_PUZZLE_TOOLKIT` defines the clue schema per page, the reveal mechanic (viewport masking tied to pointer/card position), and the hint system that ties clues together cross-page.

**Deliverables:** Porthole clue schema and authoring guide, per-page clue placement system, cross-page puzzle state tracker, reveal viewport renderer (card-shaped mask over the starfield secret layer).

---

## Dependency Summary

| Phase | Depends On |
|-------|-----------|
| 0 — Extract & Generalize | — |
| 1 — Starfield Underlayment | Phase 0 |
| 2 — NCH Overlay Persistence | Phase 0 |
| 3 — Joker Colorization | Phase 0 |
| 4 — Drag-to-Rearrange | Phase 2 + 3 |
| 5 — Porthole Puzzles | Phase 1 + 2 + 3 |

Phases 1, 2, and 3 can run in parallel once Phase 0 ships. Phase 4 is a polish pass that needs the overlay and colorization in place. Phase 5 is the capstone that ties everything together.
