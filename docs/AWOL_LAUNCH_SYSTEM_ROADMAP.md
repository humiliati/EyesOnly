# AWOL Launch System Roadmap

## Status: PHASE 2 IMPLEMENTED
## Date: 2026-03-07

---

## Problem Statement

Players currently launch Gone Rogue by typing `rogue` into the terminal console — a hidden command with no visual affordance. New players have no way to discover the game exists. Veteran players who want to replay at higher UBER difficulties or use specific seeds have no streamlined UI for doing so.

## Deliverable

Replace the terminal `rogue` command as the **primary** game entry point with a visual AWOL button → dropdown → seed field → play/pause launcher in the site header. The terminal `rogue` command remains as a hidden shortcut for power users.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER BAR                                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ MOK LINK ESTABLISHED        [ACTIVE ITEM] [¢00000]     │ │
│  │ Spy Games: Red Team [callsign]                          │ │
│  │                                            [ AWOL ▾ ]   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                    │         │
│                                         click ▾    │         │
│  ┌─────────────────────────────────────────────────┘         │
│  │  AWOL DROPDOWN (idle state)                               │
│  │  ┌───────────────────────────────────────────────┐       │
│  │  │ ▸ TRAILHEAD  ROGUE 0  (playable)               │       │
│  │  │   ELITE     ROGUE 1  (locked/unlocked)        │       │
│  │  │   HELL      ROGUE 2  (locked/unlocked)        │       │
│  │  └───────────────────────────────────────────────┘       │
│  │                                                           │
│  │  click TRAILHEAD row → row expands:                        │
│  │  ┌───────────────────────────────────────────────┐       │
│  │  │ ▾ TRAILHEAD  ROGUE 0                            │       │
│  │  │   SEED: [ adjective-noun-number ]  [▶ LAUNCH]  │       │
│  │  └───────────────────────────────────────────────┘       │
│  │                                                           │
│  └───────────────────────────────────────────────────────────│
│                                                               │
│  DURING RUN (header transforms):                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ MOK LINK ...                          [ ⏸ AWOL ▾ ]     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                              │               │
│                                    ┌─────────┘               │
│                                    │ PAUSE (freezes game)    │
│                                    │ ▾ opens UBER dropdown   │
│                                    │   for mid-run adjust    │
│                                    └─────────────────────────│
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1: AWOL Dropdown Menu (Replace Tooltip) ✅ IMPLEMENTED

**Goal**: Transform the existing AWOL tooltip into a proper dropdown with UBER tier rows.

### What Changes

| Component | Current | Target |
|-----------|---------|--------|
| `#awol-button` | Toggles flat tooltip | Toggles dropdown with ▾ arrow |
| `#awol-tooltip` | Flat panel with U0/U1/U2 toggle buttons | Vertical list of clickable tier rows |
| Tier display | `U0 U1 U2` inline buttons | Full rows: `TRAILHEAD ROGUE 0`, `ELITE ROGUE 1`, `HELL ROGUE 2` |
| Locked tiers | `disabled` attribute, dim opacity | Row shows 🔒 icon, non-interactive, muted text |
| Arrow indicator | None | `▾` chevron appended to AWOL label, rotates on open |

### HTML Structure (target)

```html
<!-- Replace existing #awol-button content -->
<button class="header-chip accountability-indicator" id="awol-button">
  <span class="accountability-label">AWOL</span>
  <span class="accountability-icon" id="accountability-icon">●</span>
  <span class="awol-chevron" id="awol-chevron">▾</span>
</button>

<!-- Replace existing #awol-tooltip -->
<div id="awol-dropdown" class="awol-dropdown" style="display: none;">
  <!-- M status row (collapsed by default, shown when M console is connected) -->
  <div class="awol-dropdown-row awol-m-row" id="awol-m-row" style="display: none;">
    <span class="awol-m-label">M /ops:</span>
    <span class="awol-m-value" id="m-status-value">OFFLINE</span>
    <button class="awol-m-ping" id="awol-pingback-btn" disabled>[M] PING</button>
  </div>

  <!-- Tier rows -->
  <div class="awol-dropdown-row awol-tier-row" data-tier="1" id="awol-tier-0">
    <span class="awol-tier-arrow" id="awol-tier-0-arrow">▸</span>
    <span class="awol-tier-label">TRAILHEAD</span>
    <span class="awol-tier-rogue">ROGUE 0</span>
  </div>
  <div class="awol-dropdown-row awol-tier-row" data-tier="2" id="awol-tier-1">
    <span class="awol-tier-arrow"></span>
    <span class="awol-tier-label">BLACK OPS</span>
    <span class="awol-tier-rogue">ROGUE 1</span>
    <span class="awol-tier-lock" id="awol-tier-1-lock">🔒</span>
  </div>
  <div class="awol-dropdown-row awol-tier-row" data-tier="3" id="awol-tier-2">
    <span class="awol-tier-arrow"></span>
    <span class="awol-tier-label">BURN NOTICE</span>
    <span class="awol-tier-rogue">ROGUE 2</span>
    <span class="awol-tier-lock" id="awol-tier-2-lock">🔒</span>
  </div>

  <!-- Expandable seed + launch panel (hidden until tier row clicked) -->
  <div class="awol-launch-panel" id="awol-launch-panel" style="display: none;">
    <div class="awol-seed-row">
      <label class="awol-seed-label" for="awol-seed-input">SEED:</label>
      <input type="text" class="awol-seed-input" id="awol-seed-input"
             placeholder="adjective-noun-number" autocomplete="off" spellcheck="false">
      <button class="awol-seed-randomize" id="awol-seed-randomize" title="Randomize seed">⟳</button>
    </div>
    <button class="awol-launch-btn" id="awol-launch-btn">▶ LAUNCH</button>
  </div>
</div>
```

### Behavior Spec

1. **Click AWOL button** → dropdown appears below header-right, chevron rotates to `▴`
2. **Click outside** → dropdown closes, chevron returns to `▾`
3. **Tier rows**:
   - Unlocked tiers: clickable, highlights on hover
   - Locked tiers: non-interactive, shows 🔒, tooltip "Complete UBER N to unlock"
   - Currently selected tier: left arrow `▸` indicator, bold text
4. **Click unlocked tier row** → row expands downward, reveals seed field + launch button
   - Only one tier can be expanded at a time
   - Seed field pre-populated with a random seed phrase via `SeededRandom.generateSeedPhrase()`
   - Clicking a different tier collapses current, expands new
5. **Seed input**:
   - Editable text field — player can type a custom seed
   - `⟳` button randomizes to a new seed
   - Accepts any string — non-standard seeds are standardized by `SeededRandom` at launch time
6. **▶ LAUNCH button**:
   - Calls `GoneRogue.setSeed(seedValue)` then triggers `GoneRogue.start({})`
   - Same code path as terminal `rogue` command, but with explicit seed
   - Sets UBER difficulty via `AWOLDifficulty.setTier(selectedTier)` before start
   - Dropdown closes on launch

### Files Modified

| File | Changes |
|------|---------|
| `index.html` | Replace `#awol-tooltip` with `#awol-dropdown` structure |
| `awol-difficulty.js` | Rewrite `_attachEventListeners` for dropdown behavior, add tier row expand/collapse, seed management, launch trigger |
| `crt.css` | Replace `.awol-tooltip` styles with `.awol-dropdown` styles, add `.awol-tier-row`, `.awol-launch-panel`, `.awol-seed-input` |

### Dependencies

- `SeededRandom.generateSeedPhrase()` — already exists in codebase
- `GoneRogue.setSeed(seed)` — already exists (lines 3157-3168)
- `GoneRogue.start({})` — already exists (line 411)
- `AWOLDifficulty.getCurrentTier()` — already exists

---

## Phase 2: Play/Pause Button Transform ✅ IMPLEMENTED

**Goal**: During an active run, the AWOL button becomes a pause button with dropdown access for mid-run UBER adjustment.

### State Machine

```
                    ┌──────────────────┐
                    │   IDLE STATE     │
                    │                  │
                    │  [ AWOL ▾ ]      │
                    │                  │
                    │  Button label:   │
                    │    "AWOL"        │
                    │  Chevron: ▾      │
                    │  Click: dropdown │
                    └────────┬─────────┘
                             │
                      player clicks
                      ▶ LAUNCH
                             │
                    ┌────────▼─────────┐
                    │   RUN STATE      │
                    │                  │
                    │  [ ⏸ AWOL ▾ ]   │
                    │                  │
                    │  Button splits:  │
                    │   ⏸ = pause      │
                    │   ▾ = dropdown   │
                    │  Icon: tier      │
                    │    color pulse   │
                    └────────┬─────────┘
                             │
                      click ⏸ area
                             │
                    ┌────────▼─────────┐
                    │  PAUSED STATE    │
                    │                  │
                    │  [ ▶ AWOL ▾ ]   │
                    │                  │
                    │  Game frozen     │
                    │  Grid dimmed     │
                    │  Click ▶ resume  │
                    │  ▾ still opens   │
                    │    UBER dropdown │
                    └────────┬─────────┘
                             │
                      run ends (death,
                      extraction, quit)
                             │
                    ┌────────▼─────────┐
                    │   IDLE STATE     │
                    │   (cycle back)   │
                    └──────────────────┘
```

### Button Layout During Run

```html
<button class="header-chip accountability-indicator awol-running" id="awol-button">
  <span class="awol-pause-icon" id="awol-pause-icon">⏸</span>
  <span class="accountability-label">AWOL</span>
  <span class="accountability-icon" id="accountability-icon">●</span>
  <span class="awol-chevron" id="awol-chevron">▾</span>
</button>
```

### Behavior Spec

1. **On game start** → button gains `.awol-running` class:
   - Pause icon `⏸` appears left of "AWOL" label
   - Tier color dot pulses (existing animation, but steady during run)
2. **Click pause icon (⏸)** → game pauses:
   - `GameLoop.stop()` called (freezes tick updates)
   - Grid container gets `.paused` class (dim overlay, "PAUSED" text)
   - Pause icon changes to `▶` (resume)
   - Dropdown chevron still functional
3. **Click resume icon (▶)** → game resumes:
   - `GameLoop.start()` called
   - Grid overlay removed
   - Icon returns to `⏸`
4. **Click chevron (▾) during run** → dropdown opens with:
   - UBER tier rows (mid-run adjustment, applies on next floor per existing behavior)
   - Seed display (read-only during run, shows current seed phrase)
   - No LAUNCH button (already running)
5. **On run end** → button reverts to idle state:
   - `.awol-running` class removed
   - Pause icon hidden
   - Dropdown returns to full launch mode

### Pause System

```javascript
// New function in awol-difficulty.js or new awol-launch-system.js
function togglePause() {
  if (!GoneRogue.isActive()) return;

  if (_isPaused) {
    // Resume
    GameLoop.start();
    _isPaused = false;
    _updatePauseUI();
  } else {
    // Pause
    GameLoop.stop();
    _isPaused = true;
    _updatePauseUI();
    // Show dim overlay on grid
    var grid = document.getElementById('rogue-grid-mobile');
    if (grid) grid.classList.add('paused');
  }
}
```

### Files Modified

| File | Changes |
|------|---------|
| `awol-difficulty.js` | Add pause/resume state machine, split click zones (pause vs chevron), listen for `GoneRogue.onStateChange` to toggle idle/run/paused |
| `crt.css` | `.awol-running` styles, pause icon positioning, `.paused` grid overlay |
| `gone-rogue-mobile.css` | `.rogue-grid-mobile.paused` dim overlay + "PAUSED" pseudo-element |
| `gone-rogue.js` | Expose `GameLoop.stop()`/`GameLoop.start()` if not already public |

---

## Phase 3: Seed Validation & Standardization

**Goal**: The seed input accepts any string and standardizes it into a deterministic seed phrase before launch.

### Seed Flow

```
Player types:          "my cool seed 42"
                              │
                    ┌─────────▼──────────┐
                    │  standardizeSeed() │
                    │                    │
                    │  1. lowercase      │
                    │  2. trim           │
                    │  3. hash to int    │
                    │  4. generatePhrase │
                    └─────────┬──────────┘
                              │
Standardized phrase:  "crimson-falcon-7291"
                              │
                    ┌─────────▼──────────┐
                    │  GoneRogue.setSeed │
                    │  ("crimson-falcon  │
                    │   -7291")          │
                    └────────────────────┘
```

### Behavior

- **Empty field** → auto-generate random seed on launch (same as current behavior)
- **Valid seed phrase** (matches `adjective-noun-number` pattern) → use directly
- **Arbitrary string** → hash to integer, generate canonical phrase, display in field
- **Seed display during run** → read-only, shows the canonical phrase used for this run
- **Post-run** → seed remains in field for easy replay

### Validation Function

```javascript
function standardizeSeed(input) {
  if (!input || !input.trim()) {
    // Generate random
    return SeededRandom.generateSeedPhrase(Math.floor(Math.random() * 999999));
  }

  var trimmed = input.trim();

  // Check if already a valid phrase (adjective-noun-number pattern)
  if (/^[a-z]+-[a-z]+-\d+$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // Hash arbitrary string to integer seed
  var hash = 0;
  for (var i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  return SeededRandom.generateSeedPhrase(Math.abs(hash));
}
```

### Files Modified

| File | Changes |
|------|---------|
| `awol-difficulty.js` | Add `standardizeSeed()`, wire into launch flow |
| `seeded-random.js` | Verify `generateSeedPhrase` handles all integer inputs (already should) |

---

## Phase 4: Dropdown During Run (UBER Mid-Run Adjustment)

**Goal**: Veteran players can adjust UBER difficulty mid-run via the dropdown. Change applies on next floor (existing behavior preserved).

### Run-State Dropdown Content

```html
<div id="awol-dropdown" class="awol-dropdown awol-dropdown-running">
  <!-- Current run info -->
  <div class="awol-dropdown-row awol-run-info">
    <span class="awol-run-seed-label">SEED:</span>
    <span class="awol-run-seed-value" id="awol-run-seed">crimson-falcon-7291</span>
  </div>

  <!-- UBER tier selector (same rows, but changes apply on next floor) -->
  <div class="awol-dropdown-row awol-tier-row" data-tier="1">
    <span class="awol-tier-check">✓</span>
    <span class="awol-tier-label">TRAILHEAD</span>
    <span class="awol-tier-rogue">ROGUE 0</span>
  </div>
  <div class="awol-dropdown-row awol-tier-row" data-tier="2">
    <span class="awol-tier-check"></span>
    <span class="awol-tier-label">ELITE</span>
    <span class="awol-tier-rogue">ROGUE 1</span>
  </div>
  <!-- ... -->

  <!-- Note about when changes take effect -->
  <div class="awol-dropdown-note">
    Changes apply on next floor
  </div>
</div>
```

### Behavior

- Tier rows show `✓` for current applied difficulty
- Clicking a different unlocked tier → calls `GoneRogue.setDifficulty(tier)` (existing function, applies on next floor)
- "Changes apply on next floor" note visible when pending change differs from current
- Locked tiers still show 🔒 and are non-interactive

### Files Modified

| File | Changes |
|------|---------|
| `awol-difficulty.js` | Conditional dropdown content based on `GoneRogue.isActive()` |
| `crt.css` | `.awol-dropdown-running` variant styles |

---

## Phase 5: Polish & Terminal Compatibility

**Goal**: Ensure backward compatibility and polish edge cases.

### Terminal `rogue` Command

- **Preserved** as hidden shortcut — still works exactly as before
- If typed during a run → `GoneRogue.process()` handles it (existing behavior)
- If AWOL dropdown is open when `rogue` is typed → dropdown closes, game starts with current AWOL settings

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Player types `rogue` while dropdown open | Close dropdown, start game with dropdown's selected tier + seed |
| Player closes browser mid-run, returns | `saveState`/`loadState` restores run; AWOL button shows pause state |
| Player clicks LAUNCH while game already running | Ignored (button hidden during run) |
| Player changes UBER mid-run, then dies | Next run resets to selected UBER (persisted in localStorage) |
| Player on interior floor clicks pause | Same pause behavior — `GameLoop.stop()` freezes everything |
| Seed field contains emoji/unicode | `standardizeSeed()` hashes it to integer, generates clean phrase |

### Files Modified

| File | Changes |
|------|---------|
| `main.js` | On `rogue` command, read AWOL dropdown state for seed/tier if dropdown is populated |
| `awol-difficulty.js` | Final polish, edge case handling |

---

## Implementation Order

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
 dropdown     pause       seed        mid-run     polish
 + launch     button      validate    UBER adj    + compat

 ~200 LOC    ~150 LOC    ~50 LOC     ~80 LOC     ~30 LOC
```

**Phase 1 is the critical path** — it replaces the hidden terminal command with a visible launch UI. All other phases are additive.

---

## File Inventory

| File | Role | Phase |
|------|------|-------|
| `public/index.html` | AWOL dropdown HTML structure | 1 |
| `public/js/awol-difficulty.js` | Core module: dropdown behavior, tier selection, seed management, pause/resume, launch trigger | 1-5 |
| `public/css/crt.css` | Dropdown styles, tier rows, seed input, pause state, chevron animation | 1-4 |
| `public/css/gone-rogue-mobile.css` | `.paused` grid overlay | 2 |
| `public/js/gone-rogue.js` | `getFloor()`, `getCurrentInteriorFloorId()` already exposed; may need `GameLoop` exposure | 2 |
| `public/js/main.js` | Terminal `rogue` command reads AWOL state | 5 |
| `public/js/seeded-random.js` | Seed phrase generation (no changes expected) | 3 |

---

## Design Constraints

1. **No new JS files** — all logic lives in `awol-difficulty.js` (existing module)
2. **No new CSS files** — styles extend existing `crt.css`
3. **Terminal command preserved** — `rogue` still works as hidden shortcut
4. **UBER tier gating preserved** — `markTierCompleted()` + `_completedTiers` logic unchanged
5. **Seed system preserved** — `GoneRogue.setSeed()` + `SeededRandom` unchanged
6. **Mid-run difficulty preserved** — `GoneRogue.setDifficulty()` still applies on next floor
7. **Mobile responsive** — dropdown must work on mobile (touch targets ≥ 44px)
8. **CRT aesthetic** — all new UI follows existing monochrome-green CRT terminal style from `crt.css`
