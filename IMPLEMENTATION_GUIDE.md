# Highscore System & Kernel Integration - Implementation Guide

## Overview
This document describes the highscore leaderboard system and agent integration ("Kernel") feature implemented for EyesOnly, enabling human and AI agents to compete across three games: Gone Rogue, Street-Chronicles, and EyesOnly Live.

---

## What Was Implemented

### 1. Highscore Leaderboards (`/highscore`)

#### Location
- **URL:** `/highscore/` (opens in new window)
- **Files:**
  - `/public/highscore/index.html` - Main page structure
  - `/public/css/highscore.css` - Arcade-style CRT aesthetic
  - `/public/js/highscore-state.js` - Data management
  - `/public/js/highscore-ui.js` - UI controller

#### Features
✅ **Three Game Tabs:**
- Gone Rogue (🥷) - Stealth roguelike leaderboard
- Street-Chronicles (🗺️) - Text adventure completion scores
- EyesOnly Live (🎯) - Live ARPG mission rankings

✅ **Filter System:**
- All - Show all scores
- Humans - Human players only
- Agents - AI agent runs only

✅ **Context-Sensitive Tab Selection:**
- Automatically opens relevant tab based on current game context
- Persists last selected tab in localStorage
- Falls back to Gone Rogue as default

✅ **Visual Design:**
- CRT monitor aesthetic with scanlines
- Arcade-style embellishments (chrome borders, glow effects)
- Score flip animations
- Rank-based coloring (gold/silver/bronze for top 3)
- Mode badges (human/agent distinction)

✅ **Footer:**
- Version reset notice with asterisk (*)
- StellarAqua copyright
- "Scores will reset upon 1.0 launch" warning

---

### 2. Kernel Button (Agent Integration)

#### Location
- **Button:** Left navigation rail in main interface
- **State:** Disabled by default, enables after login
- **Files Modified:**
  - `/public/index.html` - Added button HTML
  - `/public/js/ui-controls.js` - Click handler logic
  - `/public/css/crt.css` - Styling for disabled/enabled states

#### Features
✅ **Authentication-Gated Access:**
- Button appears greyed out (disabled) on page load
- Requires user to be logged in before activation
- Visual feedback (purple glow) when enabled

✅ **Kernel Interface (Placeholder):**
When clicked (after login), displays:
```
KERNEL AGENT INTEGRATION
————————————————————————————————

[MOK]: "Agent API integration portal."
[MOK]: "Connect your own AI agent to play alongside me."

AVAILABLE COMMANDS:
  KERNEL CONNECT <api_key>  - Connect agent API
  KERNEL DISCONNECT         - Disconnect agent
  KERNEL STATUS             - View connection status
  KERNEL HELP               - Show detailed help

SUPPORTED AGENTS:
  • OpenClaw-compatible APIs
  • Custom API endpoints (with auth token)
  • Local agent runners

Agent capabilities:
  - Real-time game assistance and tooltips
  - Full gameplay takeover for speedruns
  - Performance benchmarking and analytics
  - Compete on highscore leaderboards
```

✅ **API Hooks:**
- `UIControls.enableKernelButton()` - Call after successful login
- `UIControls.disableKernelButton()` - Call on logout

---

### 3. Highscore Data Model

#### Schema
```javascript
{
  entry_id: "uuid",              // Unique entry identifier
  game_id: "gone_rogue",         // Game: gone_rogue | street_chronicles | eyesonly_live
  mode: "human",                 // Mode: human | agent
  display_name: "Player123",     // Player/agent name
  run_id: "uuid",                // Run identifier (for replay)
  score: 12500,                  // Primary score (higher is better)
  metadata: {...},               // Game-specific stats (see below)
  created_at: "2026-02-18...",   // ISO timestamp
  client_version: "0.9-alpha",   // Game version
  verdict: "valid"               // valid | pending | rejected
}
```

#### Game-Specific Metadata

**Gone Rogue:**
```javascript
{
  completions: 1,                         // Times reached floor 30
  player_deaths: 0,                       // Death count
  lowest_damage_taken: 5,                 // Best damage mitigation
  most_damage_dealt_run: 250,             // Total damage in best run
  most_damage_dealt_single_action: 45     // Highest single hit
}
```

**Street-Chronicles:**
```javascript
{
  completed: true,              // Finished story
  items_found: 15               // Collectibles discovered
}
```

**EyesOnly Live:**
```javascript
{
  extracted: true,              // Successfully extracted
  rank: "Operative",            // Achieved rank
  note: "Mission Alpha"         // Mission identifier
}
```

---

### 4. Score Calculation Formula (Gone Rogue)

The score is calculated using this formula:

```javascript
score = currencyFound
      + (interactivesFound * 10)
      + (enemiesAvoided * 5)
      + breakableDamage
      + damageMitigated
```

**Scoring Components:**
- **Currency Found:** 1 point per crypto (¢) collected (excludes starting balance)
- **Interactives Found:** 10 points each (books, terminals, signs, etc.)
- **Enemies Avoided:** 5 points per enemy not encountered (stealth bonus)
- **Breakable Damage:** 1 point per HP dealt to breakables (completionist)
- **Damage Mitigated:** 1 point per HP saved via dodging/blocking in STR combat

**Design Rationale:**
- Rewards exploration (interactives have 10x multiplier)
- Encourages stealth play (enemy avoidance)
- Balances completionist and speedrun strategies
- Currency provides baseline score
- Combat skill reflected in mitigation

---

### 5. API Reference

#### HighscoreState Module

**Location:** `/public/js/highscore-state.js`

**Public Methods:**

```javascript
// Initialize system (called automatically)
HighscoreState.init()

// Submit a highscore
HighscoreState.submitHighscore({
  game_id: 'gone_rogue',
  mode: 'human',
  display_name: 'PlayerName',
  score: 12500,
  metadata: {
    completions: 1,
    player_deaths: 0,
    // ... game-specific fields
  },
  run_id: 'optional-uuid',
  client_version: '0.9-alpha'
})
// Returns: { success: true, entry_id: "uuid" }

// Get highscores for a game
HighscoreState.getHighscores('gone_rogue', {
  mode: 'human',  // Optional filter: 'human' | 'agent'
  limit: 50       // Max results (default: 50)
})
// Returns: Array of highscore entries

// Calculate Gone Rogue score
HighscoreState.calculateGoneRogueScore({
  currencyFound: 100,
  interactivesFound: 5,
  enemiesAvoided: 20,
  breakableDamage: 50,
  damageMitigated: 25
})
// Returns: 775 (calculated score)

// Tab persistence
HighscoreState.getLastTab()       // Returns: 'gone_rogue' | 'street_chronicles' | 'eyesonly_live'
HighscoreState.setLastTab('gone_rogue')

// Clear all scores (testing/debugging)
HighscoreState.clearAllHighscores()
```

#### UIControls Module

**Location:** `/public/js/ui-controls.js`

**Public Methods:**

```javascript
// Enable Kernel button (call after login)
UIControls.enableKernelButton()

// Disable Kernel button (call on logout)
UIControls.disableKernelButton()

// Show inventory panel
UIControls.showInventory()

// Update currency display
UIControls.updateCurrency(12500)
```

---

## Integration Guide

### How to Submit Scores from Games

#### Example: Gone Rogue Extraction

Add this to `public/js/gone-rogue.js` in the `_exitRogue()` function:

```javascript
function _exitRogue(extracted) {
  // Existing extraction logic...

  // Calculate run statistics
  var runData = {
    currencyFound: _currencyCollected,        // Track separately from starting balance
    interactivesFound: InteractiveItems.getInteractionCount(),
    enemiesAvoided: _totalEnemies - _enemiesKilled,
    breakableDamage: _totalBreakableDamage,
    damageMitigated: _player.damageMitigated  // Track in STR combat
  };

  // Calculate score
  var score = HighscoreState.calculateGoneRogueScore(runData);

  // Submit if user is logged in
  if (typeof LoginShell !== 'undefined' && LoginShell.isAuthenticated()) {
    var isAgent = (typeof AgentIntegration !== 'undefined' && AgentIntegration.isActive());

    HighscoreState.submitHighscore({
      game_id: 'gone_rogue',
      mode: isAgent ? 'agent' : 'human',
      display_name: getUserCallsign() || 'Anonymous',
      score: score,
      run_id: _runId,  // Track run for replay
      metadata: {
        completions: extracted ? 1 : 0,
        player_deaths: extracted ? 0 : 1,
        lowest_damage_taken: _minDamageTaken,
        most_damage_dealt_run: _totalDamageDealt,
        most_damage_dealt_single_action: _maxSingleHit
      }
    });

    // Show feedback
    printToTerminal([
      '',
      'HIGHSCORE SUBMITTED',
      'Score: ' + score,
      'View leaderboard: /highscore',
      ''
    ]);
  }

  // Continue with normal exit flow...
}
```

#### Required Tracking Variables

Add these to your game state to enable scoring:

```javascript
// In game initialization
var _currencyCollected = 0;      // Currency found this run (not starting balance)
var _totalEnemies = 0;           // Total enemies spawned
var _enemiesKilled = 0;          // Enemies defeated
var _totalBreakableDamage = 0;   // HP dealt to breakables
var _totalDamageDealt = 0;       // Total damage player dealt
var _maxSingleHit = 0;           // Highest single attack
var _minDamageTaken = Infinity;  // Lowest damage taken
var _runId = generateUuid();     // Unique run identifier

// Track currency pickup
function _pickupCurrency(amount) {
  _currencyCollected += amount;
  // ... existing logic
}

// Track combat
function _dealDamage(target, amount) {
  _totalDamageDealt += amount;
  _maxSingleHit = Math.max(_maxSingleHit, amount);
  // ... existing logic
}
```

---

## Testing

### Manual Testing Checklist

**Highscore Page:**
- [ ] Navigate to `/highscore` from main page
- [ ] Verify all three tabs render correctly
- [ ] Click between tabs - check smooth transition
- [ ] Toggle filters (All/Humans/Agents)
- [ ] Submit test scores via console
- [ ] Verify scores appear in correct table
- [ ] Check rank coloring (gold/silver/bronze)
- [ ] Test with no scores (empty state)
- [ ] Verify footer displays correctly
- [ ] Test responsive layout on mobile

**Kernel Button:**
- [ ] Button appears in left nav
- [ ] Button is disabled by default (grey, unclickable)
- [ ] Login as user
- [ ] Call `UIControls.enableKernelButton()`
- [ ] Verify button becomes enabled (purple glow)
- [ ] Click button - check kernel interface displays
- [ ] Logout
- [ ] Call `UIControls.disableKernelButton()`
- [ ] Verify button is disabled again

**Score Submission:**
- [ ] Complete a Gone Rogue run
- [ ] Verify score is calculated correctly
- [ ] Check score appears on leaderboard
- [ ] Verify mode badge (human/agent)
- [ ] Test score sorting (highest first)
- [ ] Verify timestamp is recent

### Console Testing

Open browser console and run:

```javascript
// Test score submission
HighscoreState.submitHighscore({
  game_id: 'gone_rogue',
  mode: 'human',
  display_name: 'TestPlayer',
  score: 9999,
  metadata: {
    completions: 1,
    player_deaths: 0,
    most_damage_dealt_single_action: 50
  }
});

// View scores
console.log(HighscoreState.getHighscores('gone_rogue'));

// Calculate sample score
var testScore = HighscoreState.calculateGoneRogueScore({
  currencyFound: 100,
  interactivesFound: 5,
  enemiesAvoided: 20,
  breakableDamage: 30,
  damageMitigated: 15
});
console.log('Calculated score:', testScore);
// Expected: 100 + (5*10) + (20*5) + 30 + 15 = 295

// Enable kernel button
UIControls.enableKernelButton();

// Clear all scores (debugging)
HighscoreState.clearAllHighscores();
```

---

## Known Limitations & Future Work

### Current State (MVP)
✅ Client-side only (localStorage)
✅ No server API (all data local)
✅ No authentication system (kernel button placeholder)
✅ No agent runner implementation (interface defined)
✅ Manual score submission (must be called by game)

### Next Phase Implementation Needed

**Priority 1: Game Integration**
- [ ] Hook up Gone Rogue score submission on extraction
- [ ] Add Street-Chronicles completion tracking
- [ ] Implement EyesOnly Live scoring
- [ ] Track all required statistics in game engines

**Priority 2: Server API**
- [ ] Create backend highscore endpoints
- [ ] Implement user authentication
- [ ] Add score verification system
- [ ] Enable cloud persistence

**Priority 3: Agent Integration**
- [ ] Build full Kernel command system
- [ ] Implement agent runner adapter
- [ ] Add OpenClaw compatibility layer
- [ ] Create agent connection wizard

**Priority 4: Polish**
- [ ] Add replay system
- [ ] Implement score challenges
- [ ] Create achievement system
- [ ] Add social features (friends, teams)

---

## File Reference

### New Files Created
```
/public/highscore/
  └── index.html                 # Leaderboard page

/public/css/
  └── highscore.css              # Arcade-style CRT theme

/public/js/
  ├── highscore-state.js         # Data management & scoring
  └── highscore-ui.js            # UI controller & rendering
```

### Modified Files
```
/public/index.html                # Added kernel & highscore buttons, script tag
/public/css/crt.css               # Kernel button styling (disabled/enabled)
/public/js/ui-controls.js         # Button handlers, kernel logic
```

### Documentation
```
/USER_ACCOUNT_CREATION_TODO.md   # User registration system design
/IMPLEMENTATION_GUIDE.md         # This file
```

---

## Support & Questions

For implementation questions or issues:
- Check existing code patterns in `public/js/` modules
- Reference CRT aesthetic in `public/css/crt.css`
- Follow IIFE pattern (no frameworks)
- Contact: admin@stellaraqua.com

---

**Implementation Date:** February 2026
**Version:** 0.9-alpha
**Status:** MVP Complete - Ready for Game Integration

