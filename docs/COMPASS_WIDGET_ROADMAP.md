# Compass Widget Roadmap

## Overview

A persistent compass widget overlay that appears on all public-facing pages (`index.html`, `games.html`, `booking.html`, etc.) when the player has a compass item in their inventory. The widget serves dual purposes:

1. **Passive**: Tiny pixelated compass sprite pointing north (updates every 10s)
2. **Active**: Expanded overlay with shiny embellished compass needle (updates every 0.2s)
3. **Integration**: Provides orientation data for TELESCOPE mode mobile acceleration

---

## Item Definition

### Compass Item (ITM-XXX)

```json
{
  "id": "ITM-2XX",
  "name": "Compass",
  "emoji": "🧭",
  "type": "equipment",
  "subtype": "navigation",
  "rarity": "rare",
  "equipSlot": "accessory",
  "description": "A precision navigational instrument. Points to true north.",
  "effects": [
    { "type": "compass-widget", "mode": "always" }
  ],
  "synergyTags": ["navigation", "telescope", "exploration"]
}
```

---

## Widget States

### State 1: Minimized (Default)

```
┌─────┐
│  N  │  ← 16x16 pixelated compass sprite
│  ↑  │     - Fixed position: bottom-right corner
│     │     - Size: 32px × 32px
└─────┘     - Opacity: 0.7 (non-intrusive)
            - Updates: every 10 seconds
            - Click to expand
```

### State 2: Expanded

```
┌─────────────────────────────────────────┐
│  ╭────────────────────────────────────╮ │
│  │     ✦ SHINY COMPASS ✦             │ │
│  │                                      │ │
│  │            N                       │ │
│  │          ╱   ╲     ← Needle        │ │
│  │         ◯     ◯    (updates        │ │
│  │          ╲   ╱     every 0.2s)      │ │
│  │            ↓                        │ │
│  │      ═══════════════               │ │
│  │           S                        │ │
│  │                                      │ │
│  │   Azimuth: 245°  Alt: 35°          │ │
│  │   [MINIMIZE] [ACTIVATE]            │ │
│  │   [LAUNCH TELESCOPE]               │ │
│  ╰────────────────────────────────────╯ │
└─────────────────────────────────────────┘
```

---

## Technical Implementation

### Device Orientation API

```javascript
// Get compass heading
window.addEventListener('deviceorientation', (event) => {
  // alpha: compass direction (0-360)
  const heading = event.alpha; 
  
  // For more accurate heading, use magnetometer if available
  if (event.webkitCompassHeading) {
    // iOS specific
    heading = event.webkitCompassHeading;
  }
});
```

### Permission Flow (iOS 13+)

```javascript
async function requestCompassPermission() {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const permission = await DeviceOrientationEvent.requestPermission();
    return permission === 'granted';
  }
  return true; // Android / older iOS
}
```

### Fallback for Desktop

- Use `screen.orientation` API if available
- Otherwise show static "Desktop Mode" with no needle movement

---

## Widget Lifecycle

### 1. Initialization (Page Load)

```javascript
// Check if user has compass item
const hasCompass = AccountInventory && AccountInventory.hasItem('ITM-2XX');

if (hasCompass) {
  CompassWidget.init();
}
```

### 2. Position Persistence

```javascript
// Save position to localStorage
localStorage.setItem('compass_widget_position', JSON.stringify({
  x: 20,
  y: 20,
  expanded: false
}));
```

### 3. Auto-Hide Rules

- Hide during fullscreen experiences (video, games)
- Show in "paused" states (between rounds, on victory/defeat screens)
- User can toggle visibility via settings

---

## Files to Create

| File | Purpose |
|------|---------|
| `public/js/compass-widget.js` | Core widget logic, orientation tracking |
| `public/css/compass-widget.css` | Minimized sprite, expanded overlay styles |
| `public/data/items.json` | Add compass item definition |

---

## Page Integration

### All Public Pages

```html
<!-- In <head> -->
<link rel="stylesheet" href="css/compass-widget.css">

<!-- Before </body> -->
<script src="js/account-inventory.js"></script>
<script src="js/compass-widget.js"></script>
<script>
  // Initialize after AccountInventory loads
  document.addEventListener('account-inventory:ready', () => {
    if (AccountInventory.hasItem('ITM-2XX')) {
      CompassWidget.init();
    }
  });
</script>
```

### Existing Systems to Hook

| System | Hook Point |
|--------|-----------|
| `account-inventory.js` | Dispatch `account-inventory:ready` event |
| `nch-overlay.js` | Ensure compass doesn't conflict with NCH capsule |
| `starfield.js` | Share orientation data for TELESCOPE |

---

## TELESCOPE Integration

### Shared Orientation Data

```javascript
// compass-widget.js
window.addEventListener('deviceorientation', (e) => {
  // Broadcast orientation to Telescope
  window.dispatchEvent(new CustomEvent('telescope:orientation', {
    detail: { alpha: e.alpha, beta: e.beta, gamma: e.gamma }
  }));
});
```

### Accelerometer for Telescope

```javascript
// For Telescope mode on mobile, need acceleration
window.addEventListener('devicemotion', (event) => {
  const acc = event.accelerationIncludingGravity;
  // Use for telescope aim control
});
```

---

## Visual Design

### Minimized Sprite

```
Resolution: 16×16 pixels (scaled to 32×32)
Style: Pixel art, 4-color palette
Colors: 
  - #000000 (outline)
  - #ffffff (highlights)  
  - #888888 (shadows)
  - transparent (background)

Animation: None in minimized state
```

### Expanded Overlay

```
Size: 300px × 400px
Style: Steampunk/spy craft embellished compass
- Brass/gold bezels
- Ruby/ sapphire needle gems
- Engraved degree markers
- Glass dome effect

Animation: 
- Needle: 0.2s smooth rotation
- Glow pulse on cardinal directions
- Shimmer effect on hover
```

---

## Dependency Summary

| Phase | Feature | Depends On |
|-------|---------|-----------|
| 1 | Item definition (ITM-2XX) | items.json |
| 2 | Widget JS module | account-inventory.js |
| 3 | CSS styles (minimized + expanded) | themes.css |
| 4 | Page integration (all public pages) | Phase 2 + 3 |
| 5 | TELESCOPE orientation sharing | Phase 2 |
| 6 | Accelerometer for Telescope | Phase 5 |

---

## Acceptance Criteria

- [ ] Compass item exists in items.json
- [ ] Widget appears only when compass is in inventory
- [ ] Minimized state shows pixelated 16×16 compass
- [ ] Click expands to shiny compass overlay
- [ ] Needle rotates smoothly (0.2s updates)
- [ ] Works on mobile (DeviceOrientation API)
- [ ] Works on desktop (fallback message)
- [ ] Position persists across sessions
- [ ] Doesn't conflict with NCH overlay
- [ ] Shares orientation data with Telescope mode

---

## Performance Considerations

| Metric | Target |
|--------|--------|
| Widget init time | < 50ms |
| Orientation update latency | < 100ms |
| Battery impact | Low (10s sleep between updates in minimized) |
| Memory footprint | < 50KB |

---

## Future Enhancements

1. **Compass as Telescope Launcher**: Button in expanded view to launch Telescope mode
2. **Magnetic Declination**: Support for true vs magnetic north
3. **Calibration**: User can calibrate if compass is inaccurate
4. **Waypoints**: Mark locations for later reference
5. **Multi-compass**: Support multiple compass types (digital, analog, spy gadget)
