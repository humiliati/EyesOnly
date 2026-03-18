# TELESCOPE Mode — AR Constellation Tracker

## Implementation Status: Phase 1 Complete ✅

The following files have been created:

| File | Status | Description |
|------|--------|-------------|
| `public/telescope.html` | ✅ Built | Main page with dual-layer starfield system |
| `public/css/telescope.css` | ✅ Built | Theme-styled HUD, lens selector, animations |
| `public/js/telescope.js` | ✅ Built | Core logic: orientation, rendering, constellation tracing |
| `public/data/real-stars.json` | ✅ Built | Celestial data: Big Dipper, Little Dipper, Cassiopeia, Polaris |

### Dual-Layer Architecture Implemented

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: Constellation Lines (drawn on top)               │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: Grid Overlay (azimuth/altitude lines + labels)   │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: Surface Stars (decorative, labels, local bodies) │
├─────────────────────────────────────────────────────────────┤
│  LAYER 0: Real Stars (nodes for constellation game)         │
│           ↑ revealed through portholes                      │
└─────────────────────────────────────────────────────────────┘
```

### Features Working

- ✅ Desktop drag-to-aim (mouse)
- ✅ Mobile orientation tracking (with iOS permission)
- ✅ Real star rendering based on azimuth/altitude
- ✅ Constellation path tracing (Big Dipper)
- ✅ Lens selector (Clear, Panther, Phosphor, Amber)
- ✅ Theme integration (body data-theme)
- ✅ HUD: compass, coordinates, tracker
- ✅ Porthole hand fan (3 cards)
- ✅ Progress persistence (localStorage)

### Next Steps (Phase 2)

- [ ] Polaris "blow up" effect with panther lens
- [ ] More constellations (Little Dipper, Cassiopeia)
- [ ] Camera feed integration (true AR)
- [ ] NCH overlay integration for lens selection

---

## Overview

**TELESCOPE** is a new standalone mode that turns the phone into an augmented reality window for finding and connecting real constellations in the night sky. Players point their device at the sky to reveal stars, trace constellations, and unlock rewards.

### Core Concept

- **AR-like experience**: Phone orientation controls viewport into a celestial coordinate system
- **Real constellations**: Big Dipper (Ursa Major), North Star (Polaris), and more
- **Panther lens**: Special mode that "blows up" (expands/zooms) the North Star
- **Own page**: `/telescope.html` — standalone, no game dependencies

---

## Technical Architecture

### Device Orientation API

```javascript
// Request compass/gyroscope access
async function requestOrientationAccess() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+ requires permission
    return await DeviceOrientationEvent.requestPermission();
  }
  return 'granted'; // Android / desktop fallback
}
```

### Orientation Data

| Property | Description | Range |
|----------|-------------|-------|
| `alpha` | Compass direction (0-360°) | 0-360 |
| `beta` | Tilt forward/back | -180 to 180 |
| `gamma` | Tilt left/right | -90 to 90 |

### Desktop Fallback

For desktop browsers without sensors:
- Mouse position simulates pointing direction
- Click-and-drag to "sweep" the sky
- Visual indicator: "Desktop Mode — Drag to aim"

---

## Celestial Coordinate System

### Real Star Data

```javascript
const REAL_STARS = {
  // Big Dipper (Ursa Major)
  'dubhe': { ra: 165.93, dec: 61.75, name: 'Dubhe', mag: 1.8 },
  'merak': { ra: 165.46, dec: 56.38, name: 'Merak', mag: 2.4 },
  'phecda': { ra: 178.46, dec: 53.69, name: 'Phecda', mag: 2.4 },
  'megrez': { ra: 183.86, dec: 57.03, name: 'Megrez', mag: 3.3 },
  'alioth': { ra: 193.51, dec: 55.96, name: 'Alioth', mag: 1.8 },
  'mizar': { ra: 200.98, dec: 54.93, name: 'Mizar', mag: 2.3 },
  'alkaid': { ra: 206.89, dec: 49.31, name: 'Alkaid', mag: 1.9 },
  
  // North Star
  'polaris': { ra: 37.95, dec: 89.26, name: 'Polaris', mag: 2.0 },
  
  // Additional reference stars
  'capella': { ra: 79.17, dec: 45.99, name: 'Capella', mag: 0.1 },
  'vega': { ra: 279.23, dec: 38.78, name: 'Vega', mag: 0.0 },
  'deneb': { ra: 310.36, dec: 45.28, name: 'Deneb', mag: 1.3 },
};
```

### Coordinate Conversion

```javascript
// Convert RA/Dec to Azimuth/Altitude
function celestialToHorizontal(ra, dec, lat, lon, datetime) {
  const LST = calculateLocalSiderealTime(datetime, lon);
  const HA = LST - ra;  // Hour Angle
  
  const decRad = dec * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const haRad = HA * Math.PI / 180;
  
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + 
                 Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const alt = Math.asin(sinAlt);
  
  const cosAz = (Math.sin(decRad) - Math.sin(alt) * Math.sin(latRad)) / 
                (Math.cos(alt) * Math.cos(latRad));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(haRad) > 0) az = 2 * Math.PI - az;
  
  return {
    azimuth: az * 180 / Math.PI,
    altitude: alt * 180 / Math.PI
  };
}
```

---

## Viewport Rendering

### Two Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Camera** | Live video feed + star overlay | True AR (requires camera permission) |
| **Simulated** | Star map rendered on canvas | Works everywhere, no camera needed |

### Default: Simulated Mode

The star map is rendered as a canvas that responds to device orientation:

```
┌─────────────────────────────────────────┐
│  ┌─────────────────────────────────┐  │
│  │     Celestial Sphere Canvas      │  │
│  │  - Stars at real positions      │  │
│  │  - Pan/zoom by orientation      │  │
│  │  - Constellation lines overlay  │  │
│  └─────────────────────────────────┘  │
│                                         │
│  HUD:                                  │
│  [N] [E] [S] [W] Compass • Alt: 45°    │
│  ─────────────────────────────────────  │
│  🎯 Big Dipper: 3/7 stars found         │
│  ─────────────────────────────────────  │
│  [🔍 PANTHER] [⚡ ZOOM] [📍 TARGET]    │
└─────────────────────────────────────────┘
```

### Star Visibility

```javascript
function isStarVisible(star, orientation, threshold = 0) {
  const { azimuth, altitude } = celestialToHorizontal(
    star.ra, star.dec, 
    userLat, userLon, 
    new Date()
  );
  
  // Check if star is in viewport
  const azDiff = Math.abs(azimuth - orientation.alpha);
  const altDiff = Math.abs(altitude - (90 - orientation.beta));
  
  const viewWidth = 60; // degrees
  const viewHeight = 80;
  
  return azDiff < viewWidth / 2 && 
         altDiff < viewHeight / 2 &&
         altitude > threshold;
}
```

---

## Lens System

### Available Lenses

| Lens | Color | Special Ability |
|------|-------|-----------------|
| **Clear** | Silver/White | Shows all stars above magnitude 4.0 |
| **Panther** | Hot Pink (#ff3090) | Reveals dim stars, **blows up Polaris** |
| **Phosphor** | Green (#33ff33) | Highlights constellation lines |
| **Amber** | Amber (#ffb000) | Shows star names on hover |

### Panther Lens — "Blow Up" Polaris

When panther lens targets Polaris (North Star):

```javascript
function pantherLensEffect(star, context) {
  if (star.id === 'polaris') {
    // "Blow up" effect — star expands dramatically
    const baseRadius = getStarRadius(star.mag);
    const blowupRadius = baseRadius * 8;
    
    // Pulsing glow
    const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
    
    // Draw expanded star
    drawStarGlow(star.x, star.y, blowupRadius, '#ff3090', pulse);
    drawCore(star.x, star.y, baseRadius * 2, '#ffffff');
    
    // Show "POLARIS" label
    drawLabel(star.x, star.y + blowupRadius + 20, 'NORTH STAR', '#ff3090');
    
    // Trigger reward if first time
    if (!state.polarisRevealed) {
      state.polarisRevealed = true;
      awardReward('polaris-reveal', 10);
      showNotification('🔭 North Star unlocked!', 'panther');
    }
  }
}
```

### Lens Activation

- Lenses selected from NCH widget (same joker stack)
- Active lens applies to entire viewport
- Swipe or tap to cycle lenses

---

## Constellation Stringing

### Big Dipper Tracing

```javascript
const BIG_DIPPER = {
  id: 'big-dipper',
  name: 'The Big Dipper',
  stars: ['dubhe', 'merak', 'phecda', 'megrez', 'alioth', 'mizar', 'alkaid'],
  connections: [
    ['dubhe', 'merak'],      // Handle start
    ['merak', 'phecda'],
    ['phecda', 'megrez'],
    ['megrez', 'alioth'],
    ['alioth', 'mizar'],
    ['mizar', 'alkaid'],
    ['megrez', 'merak'],     // Bowl
    ['merak', 'phecda'],
    ['phecda', 'megrez']
  ]
};
```

### Path Detection

```javascript
// As user sweeps phone, track which stars they've aimed at
function onOrientationChange(orientation) {
  const aimedStars = allStars.filter(star => 
    isStarInCrosshair(star, orientation)
  );
  
  // Add to path if new
  aimedStars.forEach(star => {
    if (!currentPath.includes(star.id)) {
      currentPath.push(star.id);
      drawPathLine(currentPath);
    }
  });
  
  // Check if path matches constellation
  if (isValidConstellation(currentPath, BIG_DIPPER)) {
    onConstellationComplete(BIG_DIPPER);
  }
}
```

### Validation Rules

| Rule | Description |
|------|-------------|
| `exact` | Must visit stars in exact order |
| `any_order` | Any star order, just need to visit all |
| `shape` | Geometry must match (closed loop) |

---

## Progression System

### Discovery Levels

| Level | Constellations | Requirement |
|-------|----------------|--------------|
| 1 | Big Dipper | Find all 7 stars |
| 2 | Polaris | Use Panther lens on North Star |
| 3 | Cassiopeia | New constellation unlocked |
| 4 | Leo | Challenge mode |
| 5 | Full Sky | All real constellations |

### Rewards

```javascript
const REWARDS = {
  'big-dipper': { coins: 15, badge: 'navigator-1', message: 'You found the Dipper!' },
  'polaris-reveal': { coins: 25, badge: 'polaris-hunter', message: 'The North Star reveals its secrets.' },
  'cassiopeia': { coins: 20, badge: 'queen', message: 'The Queen of the Night sky.' },
  // ...
};
```

---

## User Interface

### /telescope.html Layout

```html
<!-- Full screen star canvas -->
<canvas id="telescope-canvas"></canvas>

<!-- Compass HUD -->
<div class="hud-compass">
  <span class="compass-n">N</span>
  <span class="compass-e">E</span>
  <span class="compass-s">S</span>
  <span class="compass-w">W</span>
</div>

<!-- Status bar -->
<div class="hud-status">
  <span class="azimuth">Az: 245°</span>
  <span class="altitude">Alt: 35°</span>
</div>

<!-- Constellation tracker -->
<div class="hud-tracker">
  <div class="tracker-dipper">
    <span class="stars-found">3/7</span>
    <span class="constellation-name">Big Dipper</span>
  </div>
</div>

<!-- Lens selector -->
<div class="hud-lenses">
  <button class="lens-btn" data-lens="clear">⚪</button>
  <button class="lens-btn active" data-lens="panther">🔴</button>
  <button class="lens-btn" data-lens="phosphor">🟢</button>
  <button class="lens-btn" data-lens="amber">🟡</button>
</div>
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `public/telescope.html` | Standalone telescope page |
| `public/js/telescope.js` | Core telescope logic |
| `public/css/telescope.css` | Telescope styles |
| `public/data/real-stars.json` | Real celestial star data |
| `public/data/telescope-achievements.json` | Achievement definitions |

---

## Dependencies

- **Existing**: `starfield.js` — reuse star rendering for simulated mode
- **Existing**: `nch-overlay.js` — lens selection from NCH
- **Existing**: Constellation validation from `constellations.json`
- **New**: DeviceOrientation API wrapper
- **New**: Celestial coordinate calculations

---

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| iOS Safari | ⚠️ | Requires DeviceOrientationEvent.requestPermission() |
| Android Chrome | ✅ | Full support |
| Desktop Chrome | ✅ | Mouse fallback |
| Desktop Firefox | ⚠️ | May require flags |
| Desktop Safari | ⚠️ | No orientation API |

### iOS Permission Flow

```javascript
// Show custom prompt before requesting
function initTelescope() {
  if (isMobileSafari) {
    showPermissionPrompt()
      .then(() => DeviceOrientationEvent.requestPermission())
      .then(granted => {
        if (granted) startOrientationTracking();
        else enableDesktopMode();
      });
  } else {
    startOrientationTracking();
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Create `/telescope.html` skeleton
- [ ] Implement DeviceOrientation API wrapper
- [ ] Add desktop mouse fallback
- [ ] Build star coordinate system

### Phase 2: Star Rendering
- [ ] Load real stars data (Big Dipper, Polaris)
- [ ] Render stars on canvas
- [ ] Pan/zoom by orientation
- [ ] Add compass HUD

### Phase 3: Constellation Tracing
- [ ] Track aimed stars
- [ ] Draw path lines
- [ ] Validate against Big Dipper
- [ ] Award rewards on completion

### Phase 4: Lens System
- [ ] Integrate lens selector from NCH
- [ ] Implement panther lens visual effect
- [ ] Add "blow up" Polaris mechanic
- [ ] Other lens effects

### Phase 5: Polish
- [ ] Add more constellations
- [ ] Achievement system
- [ ] Persistent progress (localStorage)
- [ ] Mobile optimization

---

## Success Metrics

- Page load < 2 seconds
- Orientation response < 16ms (60fps)
- Star detection accuracy: within 5° of actual position
- Desktop fallback feels natural
