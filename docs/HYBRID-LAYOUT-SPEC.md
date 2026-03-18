# Hybrid Layout Spec: Paper Dossier + CRT Monitor

> **Target:** /games.html desktop revamp, eventual standard for all terminal pages
> **Status:** Design spec — review before implementation

---

## The Vision

A desk surface with a manila folder open. Sticky notes are pinned to the left side of the folder — these are the category nav. In the center of the desk sits a CRT monitor with its plastic bezel frame. The terminal screen shows the games content (puzzle list, arcade, etc.). The paper folder spills underneath and around the monitor, with sticky notes overlapping the monitor bezel. It's a physical desk diorama rendered in CSS.

---

## Desktop Wireframe (>768px)

```
┌─────────────────────────────────────────────────────────────────────┐
│  eo-nav: EYES ONLY   ♠ Booking   ♥ Partners   ♣ Contact   ♦ Arcade │
├─────────────────────────────────────────────────────────────────────┤
│  ░░░░░░░░░░░░░░░░░ DESK SURFACE (wood grain) ░░░░░░░░░░░░░░░░░░░░│
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│  ░░ ┌──────────────────────────────────────────────────────────┐ ░░│
│  ░░ │  MANILA FOLDER (dossier-folder)                          │ ░░│
│  ░░ │  ┌─────────────┐                                         │ ░░│
│  ░░ │  │ FOLDER TAB  │  "Field Kit"                            │ ░░│
│  ░░ │  └─────────────┘                                         │ ░░│
│  ░░ │                                                          │ ░░│
│  ░░ │  ┌──────────┐  ┌──────────────────────────────────────┐  │ ░░│
│  ░░ │  │ POSTIT 1 │  │░░░░░░░ CRT MONITOR BEZEL ░░░░░░░░░░│  │ ░░│
│  ░░ │  │ ◆ DECRYPT│  │░ ┌──────────────────────────────────┐░│  │ ░░│
│  ░░ │  │ ◆ PUZZLES│  │░ │  HEADER: EyesOnly Spy Games     │░│  │ ░░│
│  ░░ │  │ ◆ QR OPS │  │░ ├──────────────────────────────────┤░│  │ ░░│
│  ░░ │  │ ◆ ARCADE │  │░ │                                  │░│  │ ░░│
│  ░░ │  ├──────────┤  │░ │  GAMES CONTENT                   │░│  │ ░░│
│  ░░ │  │ POSTIT 2 │  │░ │  (scrollable log-frame)          │░│  │ ░░│
│  ░░ │  │ ◆ STR-CHR│  │░ │                                  │░│  │ ░░│
│  ░░ │  │ ◆ ROGUE  │  │░ │  [Puzzle tiles, arcade grid,    │░│  │ ░░│
│  ░░ │  ├──────────┤  │░ │   launchers, inventory, etc.]    │░│  │ ░░│
│  ░░ │  │ POSTIT 3 │  │░ │                                  │░│  │ ░░│
│  ░░ │  │ 3 QR LIVE│  │░ │                                  │░│  │ ░░│
│  ░░ │  │ 6 ARCADE │  │░ │                                  │░│  │ ░░│
│  ░░ │  │ [DESIGN] │  │░ │                                  │░│  │ ░░│
│  ░░ │  └──────────┘  │░ ├──────────────────────────────────┤░│  │ ░░│
│  ░░ │                 │░ │  FOOTER: FIELD KIT v1.0  00:00  │░│  │ ░░│
│  ░░ │                 │░ └──────────────────────────────────┘░│  │ ░░│
│  ░░ │                 │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │ ░░│
│  ░░ │                 └──────────────────────────────────────┘  │ ░░│
│  ░░ │                                                          │ ░░│
│  ░░ └──────────────────────────────────────────────────────────┘ ░░│
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────────────────────────────────────────┘
```

## Mobile Wireframe (≤768px)

Mobile stays essentially unchanged — full-screen CRT with no paper visible. The sticky note nav becomes the torso control-rail pattern from UI-CANON.md (horizontal band above the terminal content).

```
┌──────────────────────────┐
│  HEADER: EyesOnly        │
├──────────────────────────┤
│  TORSO: [DECRYPT] [QR]   │
│  [ARCADE] [STR] [ROGUE]  │
├──────────────────────────┤
│                          │
│  GAMES CONTENT           │
│  (vertical scroll)       │
│                          │
│  [Puzzle rows, arcade,   │
│   launchers, etc.]       │
│                          │
├──────────────────────────┤
│  FOOTER: FIELD KIT v1.0  │
└──────────────────────────┘
```

---

## HTML Structure (Desktop Hybrid)

```html
<body>
  <!-- Shared nav bar (same as /booking, /partners) -->
  <nav class="eo-nav">...</nav>

  <!-- DESK SURFACE (only visible on desktop) -->
  <div class="dossier-desk games-desk">

    <!-- MANILA FOLDER wraps everything -->
    <div class="dossier-folder games-folder">
      <div class="dossier-folder-tab">Field Kit</div>

      <!-- PAPER + MONITOR LAYOUT -->
      <div class="dossier-paper games-paper">

        <!-- LEFT: Sticky note nav (desktop only) -->
        <aside class="games-postit-nav">
          <div class="postit games-nav-postit">
            <div class="postit-label">OPERATIONS</div>
            <a href="#row-decryption" class="games-nav-item">◆ DECRYPTION</a>
            <a href="#row-puzzles" class="games-nav-item">◆ PUZZLES</a>
            <a href="#row-qr-field-ops" class="games-nav-item">◆ QR OPS</a>
            <a href="#row-arcade" class="games-nav-item">◆ ARCADE</a>
          </div>
          <div class="postit games-nav-postit">
            <div class="postit-label">CAMPAIGNS</div>
            <a href="#row-street-chronicles" class="games-nav-item">◆ STR-CHRONICLES</a>
            <a href="#row-gone-rogue" class="games-nav-item">◆ GONE ROGUE</a>
          </div>
          <div class="postit games-nav-postit games-nav-stats">
            <div class="postit-label">STATUS</div>
            <div class="games-nav-stat">3 QR LIVE</div>
            <div class="games-nav-stat">6 ARCADE</div>
            <a href="/puzzle-designer" class="games-nav-item games-nav-designer">⚙ DESIGNER</a>
          </div>
        </aside>

        <!-- RIGHT: CRT MONITOR (the actual games content) -->
        <div class="games-monitor-frame">
          <div id="crt-screen">
            <!-- Existing CRT structure unchanged -->
            <div id="phosphor-glow"></div>
            <div id="scanlines"></div>
            <div id="vignette"></div>
            <div id="crt-frame">
              <header id="mok-header">...</header>
              <div id="monitor-shell">
                <div class="log-frame games-log-frame">
                  <div class="games-content">
                    <!-- All existing game rows unchanged -->
                  </div>
                  <div class="games-footer-strip">...</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /dossier-paper -->
    </div><!-- /dossier-folder -->
  </div><!-- /dossier-desk -->
</body>
```

---

## CSS Strategy

### New file: `games-hybrid.css`

This file handles ONLY the desktop hybrid layout. It:
- Overrides `#crt-screen` from `position: fixed` to `position: relative` (same as games.css already does)
- Places the paper + monitor in a CSS grid on desktop
- Hides the paper layer on mobile
- Styles the sticky note nav items
- Positions the monitor frame within the paper

### Key Rules

```css
/* ---- Desktop: Paper + Monitor grid ---- */
@media (min-width: 769px) {
  .games-desk {
    /* Inherits desk surface from dossier-page.css */
  }

  .games-paper {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 0;
    padding: 20px;
    /* Paper background from dossier-page.css */
  }

  .games-postit-nav {
    position: sticky;
    top: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 16px;
    /* Sticky notes from dossier-page.css .postit class */
  }

  .games-monitor-frame {
    /* CRT plastic bezel */
    background: var(--metal-gradient, linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%));
    border-radius: 12px;
    padding: 8px;
    box-shadow:
      0 4px 20px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.05);
    /* Overlap: the monitor sits ON the paper */
    position: relative;
    z-index: 2;
  }

  .games-monitor-frame #crt-screen {
    position: relative !important;
    height: auto !important;
    min-height: 80vh;
    border-radius: 8px;
    overflow: hidden;
  }
}

/* ---- Mobile: Pure CRT, no paper ---- */
@media (max-width: 768px) {
  .dossier-desk,
  .dossier-folder,
  .dossier-paper {
    /* Strip all paper styling on mobile */
    background: none !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }

  .games-postit-nav {
    display: none;
  }

  .games-monitor-frame {
    background: none;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
  }
}
```

---

## What Changes, What Doesn't

### UNCHANGED:
- All existing games.html content rows (puzzles, arcade, gone rogue, etc.)
- games.css (existing row styles, inventory grid, launcher buttons)
- CRT effect layers (phosphor glow, scanlines, vignette)
- Theme engine (themes.css already has paper + CRT vars for all 4 themes)
- Mobile layout (completely unchanged)
- puzzle-popup.js, qr-router.js, all JS (no changes needed)

### CHANGED:
- games.html outer wrapper: wrap `#crt-screen` in dossier-desk > dossier-folder > dossier-paper > games-monitor-frame
- Add sticky note nav HTML alongside the monitor frame
- New CSS file: `games-hybrid.css` (desktop-only paper + monitor grid)
- Link dossier-page.css in games.html `<head>` (shared paper styles)

### NEW:
- `games-hybrid.css` — ~150 lines of desktop layout
- `games-nav.js` — ~50 lines: smooth scroll on nav click, active state tracking, scroll-spy for current section

---

## Sticky Notes as Nav Items

Each sticky note is a category group. They use the existing `.postit` class from dossier-page.css which already provides:
- Slightly rotated paper with tape strip
- Theme-aware background (`--postit-bg`)
- Lift-on-hover animation
- Box shadow for depth

Nav items inside sticky notes use a new `.games-nav-item` class:
- Monospace font (matches CRT aesthetic)
- Diamond bullet (◆) prefix
- Click → smooth scroll to section + highlight active
- Active state: brighter color, small left border accent

---

## Why This Works as a Standard

The pattern "paper desk → manila folder → content area" is already proven on /booking and /partners. The innovation is putting a CRT monitor inside the paper frame. This creates a "desk with a computer on it" metaphor that:

1. Works with all 4 themes (phosphor/silver/amber/panther) — each theme already defines both paper and CRT colors
2. Provides the left nav space desktop needs without breaking the terminal content
3. Gives mobile users the full-screen CRT they expect (paper layers hidden via media query)
4. Can be applied to other pages: /contact could get the same treatment (desk + monitor + paper notes)
5. The desk surface, folder, and sticky notes are all reusable CSS classes from dossier-page.css — zero new CSS for the paper parts

---

## Implementation Order

1. Add `dossier-page.css` link to games.html `<head>`
2. Create `games-hybrid.css` with desktop grid + mobile strip
3. Wrap existing `#crt-screen` in the paper hierarchy (non-breaking — mobile classes are transparent)
4. Add sticky note nav HTML
5. Create `games-nav.js` for scroll-spy + smooth scroll
6. Test all 4 themes on desktop + mobile
7. Test QR redirect flow (should be completely unaffected)
