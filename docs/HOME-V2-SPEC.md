# Home Terminal Hybrid (home-v2) — Design Spec

> **Status:** Spec — review before implementation
> **Depends on:** games-hybrid.css (shared), dossier-page.css (shared)
> **Risk:** HIGH — this is the main game page with ~130 loaded modules

---

## The Challenge

The home terminal is not like /games or /contact. It has active gameplay surfaces:

- **Control rail** (left sidebar): 6 action buttons + debrief feed window
- **Debrief feed**: MOK avatar, video/audio controls, resource display, item disposal dropzone, combat self-target zone, card disposal incinerator animation
- **Log column**: Terminal input/output + Gone Rogue game viewport
- **Hand fan**: Combat card selection overlay
- **MOK interjection**: Tooltip/dialogue system at bottom
- **NCH overlay**: Non-combat HUD with card vault, backup scroll
- **Inventory grid**: Equipment overlay
- **Login overlay**: User auth forms

ALL of these are CRT-native and must stay in the CRT context. The paper wraps the outside.

---

## Desktop Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  WOODEN HEADER: EYES ONLY   ♠ Booking  ♥ Partners  ♣ Contact  ♦ Arcade │
├─────────────────────────────────────────────────────────────────────┤
│  ░░░░░░░░░░░░░░░░░ DESK SURFACE (wood grain) ░░░░░░░░░░░░░░░░░░░░│
│  ░░ ┌──────────────────────────────────────────────────────────┐ ░░│
│  ░░ │  MANILA FOLDER                                           │ ░░│
│  ░░ │  ┌───────────────┐                                       │ ░░│
│  ░░ │  │ FOLDER TAB    │  "Terminal"                           │ ░░│
│  ░░ │  └───────────────┘                                       │ ░░│
│  ░░ │                                                          │ ░░│
│  ░░ │  ┌──────────┐  ┌────────────────────────────────────┐   │ ░░│
│  ░░ │  │ PAPER    │  │░░░░░ CRT MONITOR BEZEL ░░░░░░░░░░│   │ ░░│
│  ░░ │  │ LEFT COL │  │░ ┌──────────────────────────────┐ ░│   │ ░░│
│  ░░ │  │          │  │░ │  CRT INTERIOR               │ ░│   │ ░░│
│  ░░ │  │ Post-its │  │░ │  ┌────────┬─────────────────┐│ ░│   │ ░░│
│  ░░ │  │ with     │  │░ │  │CONTROL │  LOG COLUMN     ││ ░│   │ ░░│
│  ░░ │  │ nav &    │  │░ │  │ RAIL   │  (terminal /    ││ ░│   │ ░░│
│  ░░ │  │ status   │  │░ │  │(buttons│   game viewport)││ ░│   │ ░░│
│  ░░ │  │          │  │░ │  │+debrief│                 ││ ░│   │ ░░│
│  ░░ │  │ AWOL     │  │░ │  │ feed)  │                 ││ ░│   │ ░░│
│  ░░ │  │ launcher │  │░ │  └────────┴─────────────────┘│ ░│   │ ░░│
│  ░░ │  │          │  │░ │  MOK INTERJECTION / TOOLTIP  │ ░│   │ ░░│
│  ░░ │  └──────────┘  │░ └──────────────────────────────┘ ░│   │ ░░│
│  ░░ │                 │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │ ░░│
│  ░░ │                 └────────────────────────────────────┘   │ ░░│
│  ░░ └──────────────────────────────────────────────────────────┘ ░░│
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
├─────────────────────────────────────────────────────────────────────┤
│  TAPE-ON-PAPER FOOTER: ♠ BKNG  ♥ PRTNRS  ♣ CNTCT  ♦ ARCD          │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Difference from /games Hybrid

The entire existing `#crt-screen > #crt-frame > #monitor-shell` hierarchy stays **INSIDE** the CRT monitor bezel, **unchanged**. The control rail, debrief feed, log column, and all game systems remain exactly where they are in the CRT context.

What changes:
1. **Wooden header** replaces `#mok-header` (the brass monitor header)
2. **Paper left column** (outside the CRT bezel) has post-it notes for nav/status
3. **Desk surface** wraps the folder which contains paper + CRT monitor
4. **Tape footer** at the bottom of the page
5. **MOK interjection tooltip** moves to clear tape scrolls overlaying the game screen

## What Does NOT Change

- `#control-rail` position and behavior (stays inside CRT)
- `#log-column` position and behavior (stays inside CRT)
- `.debrief-window` and all its modes (avatar, disposal, combat targeting)
- Hand fan component
- NCH overlay
- Gone Rogue game engine
- All ~130 JS modules

## The Paper Left Column

On desktop, the paper left column sits OUTSIDE the CRT bezel (same as /games post-it nav). It contains:

1. **Post-it: NAVIGATION** — links to /booking, /partners, /contact, /games
2. **Post-it: AWOL LAUNCHER** — tier selector, seed input, play button (duplicates the AWOL dropdown but on paper instead of CRT chrome)
3. **Post-it: STATUS** — player callsign, crypto balance, equipped item

On mobile, this becomes the paper torso (same pattern as /games).

## Tooltip as Clear Tape

The MOK interjection tooltip currently sits at the bottom of the log column. In the hybrid, it could overlay the game screen as a semi-transparent "clear tape" strip — mostly see-through so the game is visible underneath, with text readable against the slight frosted-glass effect.

This aligns with the TOOLTIP_SPACE_CANON:
- Desktop: max 70vh, 11px font, full timestamp
- Mobile: max 45vh, 9px font, abbreviated timestamp
- Priority system (NORMAL < PERSISTENT < DIALOGUE) unchanged

The tape aesthetic:
```css
.tooltip-tape {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(2px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  /* Tape edge highlight */
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.1);
}
```

## Mobile Layout

```
┌──────────────────────────┐
│  WOODEN HEADER: EYES ONLY│
├──────────────────────────┤
│  TORSO: [BKNG] [PRTNRS] │
│  [CNTCT] [ARCD] [AWOL]  │
├──────────────────────────┤
│  CRT BODY                │
│  (control rail + log col │
│   exactly as they are    │
│   today — unchanged)     │
│                          │
│  [clear tape tooltip     │
│   overlays bottom]       │
├──────────────────────────┤
│  TAPE FOOTER             │
└──────────────────────────┘
```

## Implementation Approach

1. Copy `index.html` → `home-v2.html`
2. Add dossier-page.css + games-hybrid.css to `<head>`
3. Wrap `#crt-screen` in `dossier-desk > dossier-folder > dossier-paper > games-v2-monitor`
4. Add wooden header, paper left column, torso, tape footer (same HTML patterns as games-v2)
5. Hide `#mok-header` via CSS (same as games/contact)
6. Add `min-height: 0 !important` overrides (same pattern)
7. Test that ALL game systems still work (combat, cards, drag, disposal)

## Risk Mitigation

- **Zero JS changes** — only CSS + HTML wrapper changes
- **All game DOM stays exactly where it is** — just wrapped in paper containers
- **Fallback**: `index.html` is renamed to `index-legacy.html`, `home-v2.html` → `index.html`
- **Test checklist**: terminal input, AWOL launch, combat, card fan, debrief feed modes, item disposal, magnifying glass drag, NCH overlay, inventory grid, login overlay
