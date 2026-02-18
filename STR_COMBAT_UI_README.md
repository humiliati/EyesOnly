# STR Combat Window & Hand Fan UI System

## Overview

This implementation provides a Hearthstone-style card display system for STR (Simultaneous Turn Resolution) combat in the Gone Rogue mode. The system consists of three main components:

1. **STR Combat Window** - A minimize/maximize combat popup with timer
2. **Hand Fan Component** - Hearthstone-style card fan with transparency
3. **Integration Layer** - Connects new components with existing combat system

## Components

### 1. STR Combat Window (`str-combat-window.js`)

A centered combat popup that displays:
- Enemy and player HP bars
- **Enemy Intent Display** - Face expression + weapon icon (NEW)
- Advantage indicator (Ambush, Neutral, Disadvantaged, Flanked)
- Round-based timer with enemy-type specific durations
- Minimize/maximize functionality

#### Features

**Enemy Intent System (NEW):**
- Displays enemy face expression (^_^, >__<, O_O, etc.) and weapon icon (🔫, 💣, 🎯, etc.)
- Shows below enemy emoji with golden shimmer effect
- Updates dynamically based on enemy state and planned action
- Minimized view shows expression glyph only
- Gracefully handles when intent system is unavailable

**Timer System:**
- Standard enemies: 2.0 seconds
- Elite enemies: 2.5 seconds
- Boss enemies: 3.0 seconds
- Quick enemies (rats, insects): 1.5 seconds
- Puzzle enemies: 2.8 seconds

**Minimization:**
- Minimize button in header (↓ icon)
- Animates to 48×48px indicator in top-right corner
- Red background tint (8% opacity) when minimized
- Bounce attention animation triggers at 50% timer remaining
- Tap or hover to maximize

**Window Sizing:**
- Desktop: 500px max width (85% of viewport)
- Mobile: 90-95% of viewport width
- Centered in game window area

#### API

```javascript
// Initialize (auto-called on page load)
STRCombatWindow.init();

// Show combat window
STRCombatWindow.show({
  round: 1,
  enemy: {
    emoji: '👾',
    hp: 5,
    maxHp: 5,
    intentState: { /* enemy intent state from EnemyIntentSystem */ }
  },
  player: { hp: 10, maxHp: 10 },
  advantage: 'neutral',
  enemyType: 'standard'
});

// Hide window
STRCombatWindow.hide();

// Minimize/Maximize
STRCombatWindow.minimize();
STRCombatWindow.maximize();

// Update state
STRCombatWindow.updateState(newState);

// Reset timer for new round
STRCombatWindow.resetTimer('elite');

// Check state
var isMin = STRCombatWindow.isMinimized();
var isVis = STRCombatWindow.isVisible();
```

### 2. Hand Fan Component (`hand-fan-component.js`)

A Hearthstone-style card fan with:
- Radial card arrangement with 30% overlap
- Card transparency based on lifecycle type
- Fan positioning over STR window or bottom of screen
- Card selection and animation sequences

#### Card Transparency (Lifecycle-Based)

| Type | Opacity | Visual Effect | Examples |
|------|---------|---------------|----------|
| Consumable (LIFE_001) | 15% | Almost transparent | Grenade, Emergency Dodge |
| Exhaust (LIFE_002) | 35% | Semi-transparent | Perfect Ambush, Full Block |
| Power (LIFE_003) | 55% | Moderately opaque | Scarface Mode, Ghost Protocol |
| Gated (LIFE_004) | 45% | Semi-opaque | Burst Fire, Tactical Roll |
| Core (LIFE_005) | 85% | Nearly opaque | Basic Attack, Core Stance |

#### Animation Phases

1. **Commit** (200ms): Selected cards lift upward
2. **Resolve** (800-1500ms): Cards fly to center and fade
3. **Repopulate** (300ms): New cards fade in from center with 50ms stagger

#### Display Modes

**Combat Mode:**
- Position: Centered over STR combat window
- Width: 90% viewport (max 700px)
- Cards arranged in fan shape

**Contextual Mode:**
- Position: Bottom of screen
- Width: 90% viewport (max 600px)
- Background dimming (40% opacity)
- Covers mok interjection tooltips

#### API

```javascript
// Initialize (auto-called on page load)
HandFanComponent.init();

// Show fan with cards
HandFanComponent.show(cardArray);

// Hide fan
HandFanComponent.hide();

// Set mode and position
HandFanComponent.setMode('combat', 'centered');
HandFanComponent.setMode('contextual', 'bottom');

// Update cards
HandFanComponent.updateCards(newCardArray);

// Play selected cards (triggers animation)
HandFanComponent.playSelectedCards();

// Repopulate with new cards (after combat round)
HandFanComponent.repopulateCards(newCardArray);

// Get/clear selection
var selected = HandFanComponent.getSelectedCards();
HandFanComponent.clearSelection();
```

### 3. Integration Layer (`str-combat-integration.js`)

Automatically connects the new components with GoneRogue's existing combat system:

- Monitors `GoneRogue.isStrCombatActive()` every 100ms
- Shows/hides STR Combat Window based on combat state
- Shows/hides Hand Fan based on combat state
- Syncs hand fan position with window minimize state
- Handles timer expiration with default card auto-play

#### Automatic Features

The integration layer provides:
- Seamless component activation when STR combat begins
- Automatic window/fan positioning based on minimize state
- Timer expiration handling
- Multi-card combat execution bridging

## File Structure

```
public/
├── js/
│   ├── str-combat-window.js          # Combat window component
│   ├── hand-fan-component.js         # Hand fan component
│   ├── str-combat-integration.js     # Integration layer
│   ├── gone-rogue.js                 # Existing combat logic
│   └── gone-rogue-mobile.js          # Existing mobile UI
├── css/
│   ├── str-combat-window.css         # Combat window styles
│   ├── hand-fan-component.css        # Hand fan styles
│   └── gone-rogue-mobile.css         # Existing mobile styles
└── index.html                         # Updated with new includes
```

## Usage Examples

### Basic STR Combat Flow

```javascript
// 1. Combat initiates (handled by GoneRogue)
GoneRogue.enterStrCombat(enemy, 'player_attack', card);

// 2. Integration layer detects combat state
// 3. STR Combat Window appears automatically
// 4. Hand Fan appears with player's cards

// 5. Player selects cards in fan (up to 5)
// 6. Player clicks PLAY or timer expires

// 7. Cards animate (commit → resolve → repopulate)
// 8. Combat resolves, new round begins or combat ends

// 9. Window and fan hide when combat ends
```

### Manual Control

```javascript
// Show STR window manually
STRCombatWindow.show({
  round: 3,
  enemy: { emoji: '👹', hp: 8, maxHp: 12 },
  player: { hp: 15, maxHp: 20 },
  advantage: 'ambush',
  enemyType: 'elite'
});

// Show hand fan manually
var cards = GAMESTATE.getLooseInventory();
HandFanComponent.show(cards);
HandFanComponent.setMode('combat', 'centered');

// Handle user interactions
HandFanComponent.playSelectedCards(); // When player commits
```

## Quality Tier Colors

Cards display border colors based on quality:

| Quality | Color | Hex |
|---------|-------|-----|
| Cracked | Gray | #666 |
| Worn | Light Gray | #999 |
| Standard | White | #fff |
| Fine | Cyan | #4fc3f7 |
| Superior | Yellow | #ffeb3b |
| Elite | Orange | #ff9800 |
| Masterwork | Gold | #ffd700 |
| Near Perfect | Green | #8bc34a |
| Perfect | Purple | #9c27b0 |

## Responsive Design

### Desktop (>768px)
- Combat window: 500px width
- Hand fan: 700px max width
- Cards: 120×168px
- Hover effects enabled
- Minimized indicator: top-right corner

### Mobile (≤768px)
- Combat window: 90% viewport width
- Hand fan: 90% viewport width
- Cards: 100×140px
- Touch gestures enabled
- Minimized indicator: top-right corner

### Small Mobile (≤480px)
- Combat window: 95% viewport width
- Hand fan: 95% viewport width
- Cards: 80×112px
- Optimized touch targets (44px minimum)

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus indicators (2px solid #1cff9b)
- Screen reader announcements for combat state
- High contrast mode support
- Reduced motion support (`prefers-reduced-motion`)
- Color-independent indicators (icons + colors)

## Browser Compatibility

Tested and supported:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)

Uses modern CSS features:
- `backdrop-filter` for blur effects
- CSS Grid and Flexbox
- CSS Custom Properties (variables)
- CSS Animations and Transitions

## Performance Considerations

- Timer updates: 100ms intervals (10 FPS)
- Combat state checks: 100ms intervals
- Card animations: Hardware-accelerated transforms
- Minimal DOM manipulations
- Efficient event delegation

## Troubleshooting

### Cards not showing in fan
- Check `GAMESTATE.getLooseInventory()` returns cards
- Verify card objects have required properties (name, emoji, lifecycle)
- Check browser console for errors

### Window not appearing
- Ensure `GoneRogue.isStrCombatActive()` returns true
- Check `GoneRogue.getStrCombatState()` returns valid state
- Verify integration script loaded after components

### Animations not working
- Check browser supports CSS animations
- Verify `prefers-reduced-motion` not set to reduce
- Check for JavaScript errors blocking animation code

### Timer not counting down
- Verify enemy type is valid (standard/elite/boss/quick/puzzle)
- Check timer interval is running (console should show updates)
- Ensure STR window is visible (not hidden)

### Intent not displaying
- Ensure `enemy-intent-system.js` is loaded before `str-combat-window.js`
- Verify enemy object has `intentState` property
- Check `EnemyIntentSystem.formatIntentDisplay()` returns valid string
- See ENEMY_INTENT_SYSTEM_GUIDE.md for troubleshooting

## Enemy Intent System Integration

### Overview

The STR Combat Window now displays enemy intent information, providing Metal Gear Solid-style tactical feedback to players.

### Features

**Main Window Display:**
- Enemy face expression (e.g., ^_^, >__<, O_O)
- Weapon icon (e.g., 🔫, 💣, 🎯)
- Golden shimmer animation effect
- Updates each combat round
- Positioned below enemy emoji

**Minimized View:**
- Shows expression glyph only (space-efficient)
- Displayed between enemy emoji and timer
- Maintains golden glow effect

### Implementation

The intent display integrates seamlessly with existing systems:

```javascript
// Integration layer automatically passes intent state
var windowState = {
  enemy: {
    emoji: '👾',
    hp: 5,
    maxHp: 5,
    intentState: combatState.enemy.intentState // From EnemyIntentSystem
  }
};

STRCombatWindow.show(windowState);
```

**Rendering:**
```javascript
// In _renderWindow()
if (typeof EnemyIntentSystem !== 'undefined' && enemy.intentState) {
  var intentDisplay = EnemyIntentSystem.formatIntentDisplay(enemy.intentState);
  html += '<div class="str-intent-display">' + intentDisplay + '</div>';
}
```

**Styling:**
```css
.str-intent-display {
  font-size: 24px;
  color: #ffaa00;
  text-shadow: 0 0 10px rgba(255, 170, 0, 0.8);
  animation: intent-shimmer 3s ease-in-out infinite;
}
```

### Visual Examples

**Main Window with Intent:**
```
┌─────────────────────┐
│  ⚔️ STR COMBAT - R2 │
├─────────────────────┤
│       👾           │ ← Enemy emoji
│     >__< 🎯        │ ← Intent (angry + aimed shot)
│  ████████ 3/5 HP   │ ← HP bar
│                    │
│        ⚔️          │ ← Advantage
│      NEUTRAL       │
│                    │
│   █████████ 7/10   │ ← Player HP
│        🧑          │ ← Player emoji
│                    │
│  TIME: 1.8s        │ ← Timer
└─────────────────────┘
```

**Minimized with Intent:**
```
┌──────┐
│  👾  │ ← Enemy emoji
│ >__< │ ← Expression only
│⏱️1.2s│ ← Timer
│  ↑   │ ← Expand button
└──────┘
```

### Dependencies

- **enemy-intent-system.js** - Must be loaded before str-combat-window.js
- **gone-rogue.js** - Must initialize enemy.intentState on combat entry
- **EnemyIntentSystem.formatIntentDisplay()** - Formats intent for display

### Related Documentation

- `ENEMY_INTENT_SYSTEM_GUIDE.md` - Complete intent system documentation
- `INTENT_VISUAL_EXAMPLES.md` - Visual examples of intent in combat
- Enemy intent updates automatically via `str-combat-integration.js`

## Future Enhancements

Potential additions:
- Sound effects for timer ticks, card selections, combat hits
- Particle effects for card animations
- Card preview with full stats on long-press
- Deck building interface integration
- Replay system for combat sequences
- Tutorial overlays for first-time users
- Advanced AI opponent behaviors

## License

Part of the EYES ONLY // 1977 project.
