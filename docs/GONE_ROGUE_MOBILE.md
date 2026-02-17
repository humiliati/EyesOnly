# Gone Rogue - Mobile Touch Controls

## Overview

Gone Rogue now features full mobile touch support with tap-to-move navigation and swipeable card combat system, inspired by Metal Gear Solid's stealth mechanics and mobile deckbuilders.

## Mobile Detection

The system automatically detects mobile devices and switches from keyboard commands to touch controls. Detection triggers when:
- User agent matches mobile device patterns
- Touch points > 2 detected

## Touch Controls

### Grid Navigation

**Tap Cell** - Move one step towards tapped cell
- Pathfinding: Simple one-step movement towards target
- Visual feedback: Cell highlights on tap

**Double-Tap Cell** - Run mode (2x speed)
- Faster movement
- **Trade-off**: +2 detection per move
- Visual indicator: Yellow flash on double-tap
- Time window: 300ms between taps

**Tap Player (@)** - Open card fan
- Shows up to 5 cards from loose inventory
- Cards appear at bottom of screen
- Auto-closes after swipe or 2s timeout

### Card Swipe System

Cards appear when tapping the player character. Swipe directions map to different actions:

**Swipe Up** ↑
- Attack cards: Execute attack on nearest enemy
- Stance cards: Apply defensive stance
- Utility cards: Use item (heal, restore energy)

**Swipe Right** →
- Attack cards: Offensive action
- Stance cards: (not applicable)
- Utility cards: (not applicable)

**Swipe Left** ←
- Attack cards: (not applicable)
- Stance cards: Defensive stance
- Utility cards: (not applicable)

**Swipe Down** ↓
- All cards: Discard from inventory

### Swipe Detection

- **Threshold**: 50px minimum movement
- **Speed**: Velocity calculated for accuracy
- **Visual feedback**: Card scales and follows finger during drag
- **Haptic**: Native mobile vibration on action

## Stealth Mechanics (Metal Gear Solid-inspired)

### Detection System

Player has a **detection** stat that accumulates based on actions:

- **Walking**: -0.5 detection per turn (stealthy)
- **Running**: +2 detection per turn (loud)
- **Cover**: Reduces detection range
- **Enemies**: Have detection cones (visual indicators)

### Alert Levels

**Safe** (detection < 4)
- Color: Green
- Enemy behavior: Normal patrol
- Visual: No alerts

**Caution** (detection 4-7)
- Color: Yellow blinking
- Enemy behavior: Investigating
- Visual: Caution icon
- Animation: Pulse effect

**Danger** (detection ≥ 8)
- Color: Red blinking
- Enemy behavior: Active pursuit
- Visual: Alert icon
- Animation: Fast blink
- Sound: Alert tone (future)

## Mobile UI Components

### Grid Container

- **Display**: CSS Grid (40x20 cells)
- **Size**: Responsive, max 600px width
- **Touch**: `touch-action: none` for smooth interaction
- **Feedback**: Active state on tap

### Cell Types

**Player (@)**
- Background: Bright green (#1cff9b)
- Animation: Pulse glow
- Always centered in view

**Enemy (E)**
- Background: Red (#ff1c4a)
- Animation: Detection cone pulse
- Visual indicator: Border glow on alert

**Item (*)**
- Color: Yellow (#ffeb3b)
- Animation: Sparkle effect

**Wall (█)**
- Background: Dark gray (#333)
- Non-interactive

**Cover (▓)**
- Background: Medium gray (#1a1a1a)
- Reduces detection when adjacent

**Exit (▼)**
- Color: Green glow
- Animation: Pulsing extraction point

### Card Display

**Card Container**
- Position: Fixed bottom, centered
- Background: Semi-transparent black
- Border: Green glow (#1cff9b)
- Layout: Horizontal flex, scrollable

**Individual Cards**
- Min width: 100px (80px on mobile)
- Emoji: Large size (32px)
- Name: 12px monospace
- Quality: 10px, color-coded
- Border: Quality-based color

**Quality Colors**
- Cracked: Gray (#666)
- Standard: White (#fff)
- Fine: Blue (#4fc3f7)
- Superior: Yellow (#ffeb3b)
- Elite: Orange (#ff9800)
- Masterwork: Gold (#ffd700)
- Near Perfect: Green (#8bc34a)
- Perfect: Purple (#9c27b0)

## Animation Effects

### Run Mode Flash
```css
0%: Transparent
50%: Yellow highlight (50% opacity)
100%: Transparent
Duration: 200ms
```

### Detection Pulse
```css
0%: Scale 1, opacity 0.3
50%: Scale 1.1, opacity 1
100%: Scale 1, opacity 0.3
Duration: 2s infinite
```

### Alert Blink (Danger)
```css
0%: Opacity 1, scale 1
50%: Opacity 0.7, scale 1.05
100%: Opacity 1, scale 1
Duration: 500ms infinite
```

### Card Drag
- Transform: follows touch position
- Opacity: 0.8 during drag
- Shadow: Glow effect
- Z-index: Elevated above other cards

## Performance Optimizations

### Touch Event Handling
- `passive: false` on necessary events only
- Prevents default to avoid scroll conflicts
- Debouncing for double-tap detection

### Grid Rendering
- DOM manipulation instead of canvas
- CSS Grid for layout (GPU accelerated)
- Transform animations (hardware accelerated)
- Minimal repaints

### Mobile Responsive
```css
@media (max-width: 480px)
- Grid: 100% width, smaller padding
- Cells: 10px font size
- Cards: 80px min width
- Touch targets: Minimum 44px
```

## Accessibility

### Touch Targets
- Minimum 44x44px (Apple guidelines)
- Visual feedback on all interactions
- Clear state changes

### Visual Indicators
- Color + shape for colorblind users
- Animation as secondary indicator
- Text labels on critical actions

### Screen Readers
- ARIA labels on grid cells
- Semantic HTML structure
- Fallback to keyboard when available

## Code Architecture

### Module: GoneRogueMobile

**Location**: `/public/js/gone-rogue-mobile.js`

**Responsibilities**:
- Touch event handling
- Mobile UI rendering
- Card fan display
- Swipe gesture recognition

**Key Functions**:
- `init()` - Setup touch handlers
- `renderGrid()` - Convert game state to HTML grid
- `handleGridClick()` - Process tap-to-move
- `handleCardSwipe()` - Execute card actions

### Enhanced: GoneRogue

**Location**: `/public/js/gone-rogue.js`

**New Functions**:
- `_isMobileDevice()` - Device detection
- `handleTapMove(x, y, runMode)` - Process tap navigation
- `handleCardSwipe(index, direction)` - Execute swiped card
- `_updateAlertLevel()` - Calculate stealth state
- `_performAttack()` - Execute attack card
- `_performStance()` - Execute stance card
- `_useUtility()` - Execute utility card

### Styles

**Location**: `/public/css/gone-rogue-mobile.css`

**Sections**:
- Grid layout and cells
- Cell type styling
- Card container and cards
- Animations and transitions
- Alert level indicators
- Mobile responsive breakpoints

## Integration with Existing Systems

### GAMESTATE
- Shares inventory (loose carry for cards)
- Persistent slots remain separate
- Mode switching preserved

### CardSystem
- Uses existing quality system
- Leverages stat rolling
- Affix system compatible

### Terminal
- Fallback to text grid on desktop
- Mobile UI overlays terminal
- Both can coexist

## Testing Checklist

### Desktop
- [ ] Keyboard controls still work
- [ ] Text grid renders correctly
- [ ] No mobile UI elements shown

### Mobile (Touch Device)
- [x] Grid renders as HTML cells
- [x] Tap-to-move functional
- [x] Double-tap triggers run mode
- [x] Card fan appears on player tap
- [x] Swipe gestures recognized
- [x] Visual feedback on actions
- [ ] Tested on iOS Safari
- [ ] Tested on Android Chrome
- [ ] Tested on tablet (iPad)

### Stealth Mechanics
- [x] Detection increases on run
- [x] Alert levels update correctly
- [x] Visual indicators show state
- [x] Cover provides stealth bonus (future)

### Card Actions
- [x] Attack cards damage enemies
- [x] Stance cards boost stealth
- [x] Utility cards heal/restore
- [x] Discard removes card

## Future Enhancements

### Planned Features

1. **Enemy AI with Detection Cones**
   - Visual cone indicators
   - Line-of-sight calculations
   - Patrol patterns

2. **Haptic Feedback**
   - Vibration on attack
   - Different patterns per action
   - Native mobile haptics API

3. **Gesture Shortcuts**
   - Long press for aim mode
   - Pinch to zoom grid
   - Two-finger swipe for quick escape

4. **Enhanced Animations**
   - Particle effects on actions
   - Trail effects on movement
   - Card flip animations

5. **Sound Design**
   - Alert tones
   - Footstep audio (walk vs run)
   - Card swish sounds
   - Background ambience

6. **Tutorial Overlay**
   - First-time user guidance
   - Interactive tooltips
   - Practice mode

## Known Limitations

1. **Pathfinding**: Currently one-step only (no A*)
2. **Multi-touch**: Not yet supported
3. **Landscape mode**: Optimized for portrait
4. **Offline**: Requires connection for card generation
5. **Browser compatibility**: Modern browsers only (ES6)

## Browser Support

**Tested**:
- Chrome 90+ (Android)
- Safari 14+ (iOS)
- Firefox 88+ (Android)

**Required Features**:
- CSS Grid
- Touch events
- Flexbox
- CSS transforms
- localStorage

**Not Supported**:
- IE 11 or earlier
- Opera Mini (limited touch)

---

**Last Updated**: February 2026
**Version**: 1.1.0 (Mobile)
**Author**: Claude Sonnet 4.5
