# /games Revamp & Designer Portal Roadmap

> **Status:** Planning — March 18, 2026
> **Depends on:** QR Puzzle Pipeline (complete), Auth Gate (complete), QR Encode (complete)

---

## The Problem

**Mobile:** `/games` works well — single-column vertical scroll fits the phone. QR redirect → puzzle popup is snappy. But there's no visual distinction between "you just scanned a QR code" and "you're browsing the field kit." The arrival should feel louder.

**Desktop:** Every row is a full-width single column stretching across 1400+ px. It's a wall of text. No spatial navigation. The left-column / torso pattern from the terminal UI canon isn't being used at all. There are zero `@media` desktop breakpoints in games.css.

**Portal:** The designer portal can create/edit/publish puzzles, but can't manage categories, reorder items, archive/restore, or maintain the structure of the games page itself. Years from now, it'll be a bloated mess.

---

## Part 1: Designer Portal — Full CRUD & Category Management

### 1.1 Category System

Add a `qr_categories` table to D1:

```sql
CREATE TABLE IF NOT EXISTS qr_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  label       TEXT    NOT NULL,         -- Display name: "QR FIELD OPS", "RECON", etc.
  emoji       TEXT    DEFAULT '📁',
  sort_order  INTEGER DEFAULT 0,
  status      TEXT    DEFAULT 'live',   -- live | archived
  created_at  INTEGER DEFAULT (unixepoch() * 1000)
);
```

Add `category_slug` to `qr_puzzles` (nullable, defaults to 'qr-field-ops').

**Portal UI:** A "Categories" sidebar section listing all categories with drag-to-reorder. Click to filter puzzle list. "+" to create new category. The category label, emoji, and sort order map directly to the `games-row` section on the live page.

### 1.2 Puzzle Lifecycle Management

| Action | Current | Target |
|--------|---------|--------|
| Create | ✅ POST /api/ops/puzzles | ✅ No change |
| Edit | ✅ PUT /api/ops/puzzles/:slug | ✅ No change |
| Publish | ✅ POST /api/ops/puzzles/:slug/publish | ✅ No change |
| Archive | ✅ DELETE soft-deletes | Add "ARCHIVED" view in portal with restore button |
| Restore | ❌ | POST /api/ops/puzzles/:slug/restore → sets status=draft |
| Duplicate | ❌ | POST /api/ops/puzzles/:slug/clone → copies with new slug |
| Reorder | ❌ | PUT /api/ops/puzzles/reorder → batch update chain_order |
| Move category | ❌ | PUT /api/ops/puzzles/:slug with category_slug |
| Preview as player | ❌ | Link to /games#slug (opens in new tab) |
| Delete permanently | ❌ | Not implemented. Archive is final. Codes never die. |

### 1.3 Archive vs. Delete Philosophy

**Never permanently delete.** QR codes printed on physical media can't be recalled. An archived puzzle should:

- Disappear from the live /games page (status != 'live')
- Remain accessible in the portal's ARCHIVED filter
- Keep its QR code visible in the portal (so you can look up what that coffee mug pointed to)
- Optionally show a "MISSION EXPIRED" message if a player scans the old code
- Be restorable to draft with one click

### 1.4 QR Code Display in Portal

After save/publish, the portal already shows a QR code (client-side qrcodejs). Additionally:

- Show the QR PNG from the server (`/api/ops/puzzles/:slug/qr`) so it's the canonical image
- "Download PNG" button (for coffee mugs, stickers, posters)
- "Print Sticker" button (opens single-sticker print view)
- Show puzzle URL in a copyable field
- Status badge on the QR: DRAFT (grey overlay), LIVE (green border), ARCHIVED (red strikethrough)

### 1.5 Portal Buttons Wiring Checklist

| Button | Wired? | Notes |
|--------|--------|-------|
| + NEW PUZZLE | ✅ | Populates blank template |
| REFRESH | ✅ | Reloads puzzle list |
| SAVE | ✅ | POST or PUT depending on currentSlug |
| PUBLISH (GO LIVE) | ✅ | Sets status=live |
| ARCHIVE | ✅ | Soft delete |
| COPY template | ✅ | Clipboard copy of blank template |
| EXPORT puzzle | ✅ | Fetches static puzzle source |
| DOWNLOAD QR | ✅ | Downloads qrcodejs canvas as PNG |
| PRINT STICKER | ⬜ | Open single-sticker print view |
| RESTORE from archive | ⬜ | New button in archived view |
| DUPLICATE puzzle | ⬜ | Clone with new slug |
| REORDER (drag) | ⬜ | Drag-to-reorder in puzzle list |
| MOVE to category | ⬜ | Dropdown or drag to category |
| PREVIEW as player | ⬜ | Opens /games#slug in new tab |
| + NEW CATEGORY | ⬜ | Create category with label/emoji |
| VIEW ARCHIVED | ⬜ | Filter toggle showing archived puzzles |
| LOGOUT | ✅ | AuthGate.logout() |

---

## Part 2: /games Desktop Revamp

### 2.1 The Vision: Two Modes, One Page

**Mobile (≤768px):** What we have now — vertical scroll, expandable rows, QR-first. When arriving via QR code, the puzzle popup dominates. The page underneath is a compact field kit.

**Desktop (>768px):** A spatial "dossier" layout. The left column is a persistent category nav (same pattern as the terminal's RogueSidebar / torso). The main area shows the currently selected category's contents with room to breathe. Special elements like the decoder ring and arcade grid get more visual real estate.

### 2.2 Desktop Layout (Proposed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER: EYESONLY SPY GAMES: Field Kit  [BKNG] [PRTNRS] [CNTCT]   │
├────────────────┬────────────────────────────────────────────────────┤
│  LEFT NAV      │  MAIN CONTENT AREA                                │
│  (sticky)      │                                                    │
│                │  ┌─────────────────────────────────────────────┐  │
│  ◆ DECRYPT     │  │  DECODER RING           ACTIVE ITEM SLOT   │  │
│  ◆ PUZZLES     │  │  [  canvas  ]           [equipped item]    │  │
│  ◆ QR OPS  ←   │  │                                            │  │
│  ◆ ARCADE      │  └─────────────────────────────────────────────┘  │
│  ◆ STR-CHRON   │                                                    │
│  ◆ GONE ROGUE  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│                │  │ CIPHER   │ │ RECON    │ │ RIDDLES  │         │
│  ────────────  │  │ WHEEL    │ │ JIGSAW   │ │ 3-STAGE  │         │
│  STATUS:       │  │ [emoji]  │ │ [emoji]  │ │ [emoji]  │         │
│  3 QR LIVE     │  │          │ │          │ │          │         │
│  6 ARCADE      │  └──────────┘ └──────────┘ └──────────┘         │
│                │                                                    │
│  [DESIGNER ⚙]  │  + designer-created puzzles flow in here          │
├────────────────┴────────────────────────────────────────────────────┤
│  FOOTER: EYES ONLY // FIELD KIT v1.0                    00:00:00   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Key Differences from Mobile

| Element | Mobile | Desktop |
|---------|--------|---------|
| Category rows | Vertically stacked, chevron-expandable | Left nav links, click to scroll/filter |
| Puzzle items | List items with tag badges | Card tiles in a responsive grid (2-3 up) |
| Decoder ring | Full-width inline | Pinned hero element at top of content |
| Arcade games | 3×2 button grid | 6-up tile grid with hover previews |
| Gone Rogue launcher | Full-width card | Feature card with seed input alongside |
| Inventory | Horizontal scroll strip | 2-row grid, always visible |
| QR redirect arrival | Popup over page | Popup + category auto-selected in nav |

### 2.4 Left Nav Implementation

Reuse the RogueSidebar pattern from UI-CANON.md but adapted for the games page:

```css
@media (min-width: 769px) {
  .games-content {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 0;
  }

  .games-left-nav {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    border-right: 1px solid var(--panel-border-soft);
    padding: 8px;
  }

  .games-main {
    padding: 12px 16px;
    overflow-y: auto;
  }
}

@media (max-width: 768px) {
  .games-left-nav { display: none; }
}
```

The left nav items are generated from: static categories (DECRYPTION, PUZZLES, ARCADE, etc.) + dynamic categories from the designer portal's `qr_categories` table.

### 2.5 Puzzle Tiles (Desktop Cards)

Instead of list items, puzzles on desktop render as cards in a CSS grid:

```css
@media (min-width: 769px) {
  .games-puzzle-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .games-puzzle-card {
    border: 1px solid var(--panel-border-soft);
    border-radius: 8px;
    padding: 16px;
    background: var(--phosphor-glow);
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s;
  }

  .games-puzzle-card:hover {
    border-color: var(--phosphor);
    transform: translateY(-2px);
  }
}
```

### 2.6 QR Redirect — Making Arrival "Louder"

When a player scans a QR code on mobile, the current flow is: page loads → puzzle popup auto-opens. This works but feels generic. To make it louder:

**Mobile arrival splash (300ms):** Before the puzzle popup opens, flash a full-screen "MISSION ACTIVATED" overlay with the puzzle emoji and title. The qr-router.js already has a 400ms delay — use it for the splash, then open the puzzle.

```
┌─────────────────────────┐
│                         │
│       ☕                │
│                         │
│  MISSION ACTIVATED      │
│  CAFÉ DEAD DROP         │
│                         │
│  ████████████ loading   │
│                         │
└─────────────────────────┘
       ↓ 400ms ↓
  [Puzzle popup opens]
```

**Desktop arrival:** Same splash but positioned in the main content area (not full-screen), with the left nav auto-highlighting the correct category.

### 2.7 "Toy" Elements for Desktop

Desktop has screen real estate to spare. Use it for "toy" elements that don't make sense on mobile:

- **Decoder ring hero:** Full 300px canvas with ring manipulation, always visible when DECRYPTION category is selected
- **Arcade attract mode:** Tiny animated previews in the game tiles (miniature game loops running in background)
- **Constellation viewer:** If player has earned constellation rewards, show a small star map in the left nav footer
- **QR Field Ops map:** A visual map of all QR waypoints (placeholder dots) showing which puzzles have been solved
- **Chain visualizer:** When hovering a puzzle in a treasure hunt chain, show the full chain path with arrows

---

## Part 3: Implementation Phases

### Phase 1: Portal CRUD (Current Sprint)
- Add category CRUD endpoints + migration
- Add archive/restore/duplicate/reorder to portal UI
- Wire remaining portal buttons (PRINT STICKER, PREVIEW, VIEW ARCHIVED)
- Add "MISSION EXPIRED" fallback for archived puzzle QR codes

### Phase 1.5: Lazy-Load Scalability (When Needed)
- Currently `/api/puzzles/live` returns all live puzzles with full `puzzle_js` source (~3-4KB each)
- Comfortable to ~200-300 live puzzles before first-time mobile visitors feel latency
- Fix when needed: split into metadata-only list endpoint + on-demand `/api/puzzles/live/:slug` for JS
- Archived puzzles already cost zero at scan-time (status != 'live')
- D1 storage limit (~50K puzzles with QR images) is the theoretical hard cap

### Phase 2: Desktop Layout Foundation
- Add `games-left-nav` and `games-main` containers to games.html
- Write desktop media queries in games.css (grid layout, sticky nav)
- Convert row items to card tiles on desktop (keep list items on mobile)
- Add smooth scroll-to-section on left nav click

### Phase 3: QR Arrival Polish
- Build the "MISSION ACTIVATED" splash overlay
- Wire it into qr-router.js (before puzzle popup open)
- Add category auto-highlight in left nav on QR arrival
- Desktop: animate the splash into the content area

### Phase 4: Desktop Toys
- Decoder ring hero element (larger canvas, pinned)
- Arcade attract mode (tiny game loops in tiles)
- Chain visualizer on puzzle hover
- QR waypoint map (static placeholder → dynamic from D1)

### Phase 5: Grafcet Integration
- Puzzle slugs become gate nodes in the grafcet system
- M-mode QR Deploy panel creates puzzles + assigns to map zones
- Door-contract solver checks puzzle completion before advancing
- Proc-gen treasure hunts: chain_order + next_slug + grafcet graph

---

## File Impact Summary

| File | Phase | Change |
|------|-------|--------|
| `migrations/0015_qr_categories.sql` | 1 | New table |
| `migrations/0014_qr_puzzles.sql` | 1 | Add category_slug column (ALTER) |
| `src/worker/routes/puzzle-designer.ts` | 1 | Category CRUD + restore/clone/reorder endpoints |
| `public/puzzle-designer.html` | 1 | Category sidebar, archive view, remaining buttons |
| `public/games.html` | 2 | Add left-nav + main containers, restructure content |
| `public/css/games.css` | 2-4 | Desktop breakpoints, card grid, left nav, toys |
| `public/js/qr-router.js` | 3 | Splash overlay before puzzle open |
| `public/css/qr-splash.css` | 3 | New: splash animation styles |
| `public/js/puzzles/qr-custom.js` | 1 | Category-aware injection |
| `public/js/games-nav.js` | 2 | New: left nav interaction + scroll-to-section |
