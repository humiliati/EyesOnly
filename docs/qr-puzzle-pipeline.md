# QR → Puzzle Pipeline — Technical Documentation

## Overview

The QR Field Ops pipeline connects physical QR code stickers placed at approved field locations to interactive puzzle widgets on `flapsandseals.com/games`. Players scan a QR code with their phone camera → the browser opens `/games#puzzletype` → the puzzle auto-opens in a full-viewport popup.

No app install. No login. Phone camera → puzzle → done.

---

## Architecture

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  QR STICKER  │ ──▶ │  /games#cipher    │ ──▶ │  PuzzlePopup     │
│  (physical)  │     │  /games#jigsaw    │     │  auto-opens      │
│              │     │  /games#riddle    │     │  target puzzle   │
│              │     │  /games#decode    │     │                  │
└──────────────┘     └───────────────────┘     └──────────────────┘
                            │                          │
                     qr-router.js               puzzle scripts
                     (hash router)              register w/
                                                PuzzlePopup
```

## File Manifest

### Core Pipeline Files

| File | Purpose |
|------|---------|
| `public/js/qr-router.js` | Hash-based router. Reads `#fragment`, waits for `window.load`, polls until puzzle is registered, then auto-opens via `PuzzlePopup.open()`. |
| `public/js/puzzle-popup.js` | Existing popup overlay system. Puzzles register via `PuzzlePopup.register(key, config)`. |
| `public/js/puzzle-state.js` | Cross-page clue tracker. QR puzzles call `PuzzleState.onClueFound()` on solve for progression integration. |

### Puzzle Widgets

| File | Hash Route | Puzzle Key | Type |
|------|-----------|------------|------|
| `public/js/puzzles/qr-cipher-wheel.js` | `#cipher` | `qr-cipher` | Rotating cipher wheel — shift to decode |
| `public/js/puzzles/qr-jigsaw.js` | `#jigsaw` | `qr-jigsaw` | 4×4 tile slide puzzle — recon data grid |
| `public/js/puzzles/qr-riddle.js` | `#riddle` | `qr-riddle` | 3-stage riddle chain with hints |
| `public/js/puzzles/dead-drop-cipher.js` | `#decode` | `dead-drop-cipher` | Caesar cipher (existing, pre-pipeline) |

### Supporting Files

| File | Purpose |
|------|---------|
| `public/qr-stickers.html` | Print-ready sticker sheet (Ctrl+P). 4 puzzle types × 2 sets. |
| `docs/qr-puzzle-pipeline.md` | This document. |

### games.html Integration Points

- **HTML section**: `#row-qr-field-ops` — collapsible row with 3 QR puzzle entries
- **Script tags**: After `puzzle-popup.js` and `dead-drop-cipher.js` (line ~503)
- **PuzzlePopup.bind()**: Called on `#games-content`, automatically wires click handlers for all `[data-puzzle]` items

---

## Route Map

The router (`qr-router.js`) maps URL hash fragments to PuzzlePopup registry keys:

```javascript
var ROUTE_MAP = {
  'cipher':  'qr-cipher',      // → qr-cipher-wheel.js
  'jigsaw':  'qr-jigsaw',      // → qr-jigsaw.js
  'riddle':  'qr-riddle',      // → qr-riddle.js
  'decode':  'dead-drop-cipher' // → dead-drop-cipher.js (legacy)
};
```

### QR Code URLs

```
https://flapsandseals.com/games#cipher
https://flapsandseals.com/games#jigsaw
https://flapsandseals.com/games#riddle
https://flapsandseals.com/games#decode
```

---

## Adding a New Puzzle Type (Designer Seam)

### Step 1: Create the puzzle script

Create `public/js/puzzles/qr-{name}.js` following this template:

```javascript
(function () {
  'use strict';

  function _register() {
    var SOLVED_KEY = 'eyesonly_qr_{name}_solved';

    // ... puzzle logic, render function, etc. ...

    function render(container) {
      // Build your puzzle UI inside container
      // Use existing CSS classes: puzzle-ddc-* for consistent styling
    }

    PuzzlePopup.register('qr-{name}', {
      title: 'YOUR PUZZLE TITLE',
      render: render,
      onSolve: function () {
        // Award coins
        try {
          var acct = JSON.parse(localStorage.getItem('eyesonly_account') || '{}');
          acct.puzzleCoins = (acct.puzzleCoins || 0) + 15;
          localStorage.setItem('eyesonly_account', JSON.stringify(acct));
        } catch (_) {}
      }
    });
  }

  // Deferred registration (load-order safe)
  if (typeof PuzzlePopup !== 'undefined') {
    _register();
  } else {
    window.addEventListener('load', function () {
      if (typeof PuzzlePopup !== 'undefined') _register();
    });
    var _attempts = 0;
    var _poll = setInterval(function () {
      _attempts++;
      if (typeof PuzzlePopup !== 'undefined') { clearInterval(_poll); _register(); }
      else if (_attempts > 100) { clearInterval(_poll); }
    }, 100);
  }
})();
```

### Step 2: Register the hash route

In `public/js/qr-router.js`, add to `ROUTE_MAP`:

```javascript
var ROUTE_MAP = {
  'cipher':  'qr-cipher',
  'jigsaw':  'qr-jigsaw',
  'riddle':  'qr-riddle',
  'decode':  'dead-drop-cipher',
  '{name}':  'qr-{name}'           // ← add here
};
```

### Step 3: Add the HTML entry

In `games.html`, inside `#qr-field-ops-body`:

```html
<div class="games-item games-item-playable" data-puzzle="qr-{name}" data-sound="ui-01">
  <span class="games-item-icon">&#9678;</span>
  <div class="games-item-info">
    <div class="games-item-name">Your Puzzle Name</div>
    <div class="games-item-desc">Description for the field kit list.</div>
  </div>
  <span class="games-item-tag games-tag-narrative">TAG</span>
</div>
```

### Step 4: Add the script tag

In `games.html`, after the existing QR puzzle scripts:

```html
<script src="js/puzzles/qr-{name}.js"></script>
```

### Step 5: Generate QR code

Add to `generate_qr_sheets.py` PUZZLES list and re-run, or manually create a QR code pointing to:

```
https://flapsandseals.com/games#{name}
```

---

## PuzzleState Integration (Clue System)

Each QR puzzle can register a clue on solve for the cross-page progression system:

```javascript
if (window.PuzzleState && PuzzleState.onClueFound) {
  PuzzleState.onClueFound('qr-{name}-solved', 'qr-puzzle');
}
```

To make a QR puzzle part of a multi-step puzzle chain, add the clue ID to `public/data/puzzles.json`:

```json
{
  "id": "your-chain-id",
  "name": "Chain Name",
  "clues": ["qr-cipher-solved", "qr-jigsaw-solved", "qr-{name}-solved"],
  "reward": { "coins": 50 }
}
```

---

## Reward Hooks

Current puzzles award coins on solve via `localStorage['eyesonly_account'].puzzleCoins`. Reward values:

| Puzzle | Coins |
|--------|-------|
| Field Cipher | 15 |
| Surveillance Recon | 20 |
| Intel Riddles | 25 |
| Dead Drop Cipher | 25 (via inventory item grant) |

---

## Designer Portal Seams (Next Phase)

### Seam 1: /ops QR Management Panel

The ops console (`/ops`) could expose a QR management UI for designers:

- **Create QR mission**: Select puzzle type, set custom parameters (shift key, tile count, riddle set), generate unique URL + printable sticker
- **Activate/deactivate**: Toggle QR routes live without redeployment
- **Track scans**: Log QR scan events via the existing D1 database

**Implementation path**: Add a `/api/ops/qr` route in `src/worker/routes/ops.ts`. Store QR configs in D1. The puzzle scripts read config from a `/api/qr/:id` endpoint instead of hardcoded values.

### Seam 2: Dynamic Puzzle Parameters via URL

Extend the hash route to support parameters:

```
/games#cipher?shift=11&msg=CUSTOM+MESSAGE
/games#jigsaw?grid=5&theme=coordinates
/games#riddle?set=advanced
```

`qr-router.js` already parses the hash — extend it to extract query params and pass them to the puzzle's `render()` function via a config object.

### Seam 3: Unique QR Codes (Per-Location Instances)

For unique-per-sticker puzzles:

```
/games#cipher-7B3F
```

Where `7B3F` is a short code that maps to a puzzle config stored in D1. The router would detect the compound hash, fetch `/api/qr/7B3F`, and pass the config to the puzzle widget. This enables location-specific challenges without changing client code.

### Seam 4: /m Director QR Deployment

The M-mode director console (`/m`) could add a "Deploy QR Mission" panel:

- Director selects puzzle type + difficulty
- System generates QR config + sticker PDF
- Director assigns QR to a physical zone on the ops map
- Live scan tracking appears on the ops dashboard grid

**Integration point**: `src/m-mode/panels/` — add a `qr-deploy.tsx` panel.

### Seam 5: Puzzle Result Reporting

After a player solves a QR puzzle, POST the result to the server:

```javascript
// In puzzle onSolve callback:
fetch('/api/ops/qr-solve', {
  method: 'POST',
  body: JSON.stringify({
    puzzleKey: 'qr-cipher',
    solvedAt: Date.now(),
    moves: moveCount  // puzzle-specific metrics
  })
});
```

This feeds the ops dashboard and enables real-time solve tracking for live exercises.

---

## CSS Reference

QR puzzles inherit styling from the existing puzzle system. Key classes:

| Class | Usage |
|-------|-------|
| `.puzzle-ddc-briefing` | Top briefing/flavor text block |
| `.puzzle-ddc-label` | Section label (uppercase, phosphor-dim) |
| `.puzzle-ddc-flavor` | Flavor text paragraph |
| `.puzzle-ddc-cipher` | Bordered cipher/message display box |
| `.puzzle-ddc-cipher-text` | Monospace cipher text |
| `.puzzle-ddc-input` | Text input field |
| `.puzzle-ddc-submit` | Submit/action button |
| `.puzzle-ddc-success` | Green success message |
| `.puzzle-ddc-error` | Red error message |
| `.puzzle-ddc-feedback` | Feedback container |

All colors respect CRT theme variables (`--phosphor`, `--phosphor-dim`, etc.).

---

## Print & Deploy Workflow

1. Open `flapsandseals.com/qr-stickers` in browser
2. Print on adhesive label stock (Ctrl+P / Cmd+P)
3. Cut along sticker borders
4. Place at approved field waypoints
5. Verify by scanning with phone camera — puzzle should auto-open

Sticker sheet includes 2 sets of 4 puzzle types (8 stickers total per page). Each sticker has the QR code, puzzle name, code identifier (QR-FC-001, etc.), and the target URL.
