# AWOL Button: UBER Difficulty + M Ping (Implementation Summary)

## Overview
The AWOL button is a **dual-purpose** surface:
1) **M Ping**: a canonical prompt to check in with **M** for the IRL ARG experience (via `/m`).
2) **UBER difficulty selector**: sets the run/floor difficulty **without changing biome packs**.

> Note: *tiers describe biome packs*, so the player-facing selector is **UBER 0/1/2**. Internally the legacy tier index (1..3) is still used in code paths for now.

**Status:** M ping/pressure loop is currently placeholders + TODOs; the UI is canonized per stakeholder.

## Visual Layout

```
┌─────────────────────────────────────────────────────────┐
│ MOK LINK ESTABLISHED                                    │
│ Spy Games: Red Team [player_name]       AWOL ● (green) │
└─────────────────────────────────────────────────────────┘
                                             ↓ (click)
                              ┌─────────────────────────────┐
                              │ MISSION PARAMETERS          │
                              ├─────────────────────────────┤
                              │ M /ops link status:         │
                              │ READY / OFFLINE / PINGED…   │
                              │ [M] PING BACK               │
                              │                             │
                              │ UBER (difficulty):          │
                              │ ┌────┐ ┌────┐ ┌────┐       │
                              │ │ U0 │ │ U1 │ │ U2 │       │
                              │ └────┘ └────┘ └────┘       │
                              │ (green)(yellow)(red)        │
                              └─────────────────────────────┘
```

## Button States

### AWOL Icon Colors
- **Green (●)**: T1 - Standard difficulty selected
- **Yellow (●)**: T2 - Advanced difficulty selected  
- **Red (●)**: T3 - Extreme difficulty selected
- **Cycling**: No tier selected (default animation)

### UBER Button States
- **U0 (Green)**: Always available for logged-in users
- **U1 (Yellow)**: Unlocked after completing U0 (defeat the last boss on Uber 0)
- **U2 (Red)**: Unlocked after completing U1 (defeat the last boss on Uber 1)
- **Disabled (Gray)**: Not yet unlocked or not logged in

### Downgrading
- Player may select a **lower UBER** while currently in a higher UBER.
- **Expected behavior:** the *next spawned floor* should use the lower UBER difficulty.
- **TODO:** enforce this by storing a `desiredUber` / `pendingUber` and applying it on next floor generation / run start (not instant biome teleport).

## Difficulty Multipliers

| Tier | Name     | Enemy Count | Enemy Stats | Sight Range | Color  |
|------|----------|-------------|-------------|-------------|--------|
| T1   | Standard | 1.0x        | 1.0x        | +0          | Green  |
| T2   | Advanced | 1.3x        | 1.3x        | +1          | Yellow |
| T3   | Extreme  | 1.6x        | 1.6x        | +2          | Red    |

## User Flow

1. **New User (Not Logged In)**
   - AWOL button shows cycling color animation
   - Click shows tooltip with "M status: OFFLINE"
   - All difficulty buttons disabled
   - Message: "Log in to access difficulty settings"

2. **Logged In User (No Completions)**
   - AWOL icon shows green (T1 default)
   - Click shows tooltip with "M status: ACTIVE"
   - T1 button enabled, T2/T3 disabled
   - Can select T1 to start standard difficulty run

3. **Experienced User (Completed T1)**
   - AWOL icon shows selected tier color
   - Click shows tooltip
   - T1 and T2 buttons enabled, T3 disabled
   - Can toggle between T1 and T2

4. **Veteran User (Completed T2)**
   - All tier buttons enabled
   - Full difficulty selection available
   - Can challenge maximum difficulty (T3)

## Integration Points

### Gone Rogue Game Mechanics
- Enemy count increased by multiplier
- Enemy HP scaled by multiplier
- Enemy STR/DEX scaled by multiplier
- Enemy sight range increased by tier level
- Tier completion tracked on floor 30 exit

### User Account System
- Authentication check before showing options
- Tier completion saved to localStorage
- Current selection persisted across sessions

### MOK Interjection System
- Difficulty change messages displayed
- Tier completion congratulations shown
- Status updates via MOK advisory system

## Responsive Design

### Desktop (1024px+)
- Full button text "AWOL" visible
- Tooltip positioned below button
- All text and labels visible

### Tablet (768px - 1023px)
- Button text hidden, icon only
- Tooltip width reduced to 240px
- Hover tooltip shows full label

### Mobile (<768px)
- Icon becomes nested indicator (badge style)
- Tooltip becomes full-width modal
- Fixed positioning for better visibility
- Touch-optimized button sizes

## Code Structure

### New Files
- `public/js/awol-difficulty.js` - Main difficulty selector logic (289 lines)

### Modified Files
- `public/index.html` - Added button and tooltip markup
- `public/css/crt.css` - Added styling and responsive rules
- `public/js/gone-rogue.js` - Integrated difficulty system

## Storage Format

```javascript
// localStorage: 'eyesonly_awol_difficulty'
{
  "currentTier": 2,           // Selected tier (1-3)
  "completedTiers": [1, 2]    // Array of completed tiers
}
```

## API Interface

### AWOLDifficulty Module
```javascript
AWOLDifficulty.init()                      // Initialize system
AWOLDifficulty.getCurrentTier()            // Get selected tier
AWOLDifficulty.markTierCompleted(tier)     // Mark tier complete
AWOLDifficulty.resetProgress()             // Reset for testing
```

### GoneRogue Module
```javascript
GoneRogue.setDifficulty(tier)    // Set difficulty (1-3)
GoneRogue.getDifficulty()        // Get current difficulty
GoneRogue.onStateChange(cb)      // Register state callback
```

## Testing Checklist

✅ Syntax validation passed
✅ Code review completed  
✅ Security scan passed (CodeQL)
✅ Responsive CSS breakpoints defined
✅ Authentication integration verified
✅ localStorage persistence implemented
✅ Difficulty multipliers applied
✅ Tier completion tracking added

⚠️ Manual browser testing required:
- Click interactions
- Tooltip positioning
- Color transitions
- Mobile responsiveness
- Authentication flow
- Progression unlocking

## Known Limitations

1. Tooltip only shows when Gone Rogue is active
2. Tier completion requires beating floor 30 (not just reaching)
3. No difficulty preview or detailed stats in tooltip
4. No difficulty indicator in Gone Rogue main screen
5. Difficulty change requires new run (doesn't affect current run)

## Future Enhancements

- Add difficulty preview stats to tooltip
- Show current difficulty in Gone Rogue status bar
- Add achievements for tier completions
- Implement leaderboards per difficulty tier
- Add difficulty-specific enemy variants
- Include difficulty in highscore submissions
