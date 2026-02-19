# Resource Color Palette System

## Overview

This document describes the resource-specific color palette system implemented to avoid visual confusion with the incinerator amber-red animation.

## Key Design Principles

1. **No Percentage-Based Colors**: Unlike traditional health bar systems that use green/yellow/red based on percentage remaining, each resource has its own unique color identity that remains constant.

2. **Distinct from Incinerator**: The incinerator animation uses amber (#FFA500), red-orange (#FF4500), and dark red (#8B0000). All resource colors are deliberately chosen to be visually distinct from this palette.

3. **Frame Animations for Feedback**: Instead of changing bar colors, resource changes are communicated through frame outline animations (pulse for gain, flash for loss).

## Resource Color Palette

| Resource | Color Name | Hex Code | Visual Description |
|----------|-----------|----------|-------------------|
| **HP** | Vibrant Pink | `#FF6B9D` | Health pink - not critical red, stays consistent |
| **Energy** | Electric Blue | `#00D4FF` | Bright cyan electric, energetic feeling |
| **Focus** | Bright Yellow-White | `#FFF9B0` | Almost white, represents sharp focus |
| **Battery** | Sickly Green-Cyan | `#00FFA6` | Toxic green with cyan undertone |
| **Fatigue** | Earthy Brown | `#A0522D` | Brown representing exhaustion |
| **Ammo** | Magenta-Purple | `#DA70D6` | Special ammo flows like currency, bright and nice |

## Frame Animation System

### Gaining Resources
- **Animation**: `resource-gain-pulse` (0.6s)
- **Effect**: Frame outline pulses with resource color and glow
- **Use Case**: Collecting batteries, resting for energy, picking up ammo

### Losing Resources
- **Animation**: `resource-loss-flash` (0.4s)
- **Effect**: Frame outline briefly flashes with resource color, then fades
- **Use Case**: Using cards, taking damage, spending resources

## Implementation Details

### JavaScript (debrief-feed-renderer.js)

```javascript
function _getResourceColor(resourceName) {
  var colors = {
    'HP': '#FF6B9D',
    'Energy': '#00D4FF',
    'Focus': '#FFF9B0',
    'Battery': '#00FFA6',
    'Fatigue': '#A0522D',
    'Ammo': '#DA70D6'
  };
  return colors[resourceName] || '#FFFFFF';
}
```

### CSS (crt.css)

Resource rows have:
- `data-resource` attribute for targeting
- CSS variables (`--resource-color`) for each resource type
- Animation classes (`.gaining`, `.losing`) for frame effects

### HTML Structure

```html
<div class="resource-row" data-resource="Energy">
  <span class="resource-icon">⚡</span>
  <span class="resource-name">Energy</span>
  <div class="resource-bar-container">
    <span class="resource-bar-filled" style="color: #00D4FF;">
      ██████░░░░
    </span>
  </div>
  <span class="resource-value">(6/10)</span>
</div>
```

## Visual Testing

Use `/public/tests/test-resource-colors.html` to:
1. View all resource colors side-by-side
2. Compare with incinerator colors to verify no conflicts
3. Test frame animations interactively
4. See live debrief feed with actual resource bars

## Color Psychology

- **HP (Pink)**: Softer than critical red, maintains health association without panic
- **Energy (Cyan)**: Electric, technological, movement
- **Focus (Yellow-White)**: Clarity, concentration, brightness
- **Battery (Toxic Green)**: Artificial, technological, limited resource
- **Fatigue (Brown)**: Earthy, heavy, weariness
- **Ammo (Magenta)**: Valuable, special, flows like currency

## Migration Notes

**Breaking Change**: Previous percentage-based coloring (green/yellow/red) has been removed.

**Benefits**:
- Clearer resource identity
- No confusion with incinerator animation
- Consistent visual language
- Frame animations provide better feedback for resource changes

**Compatibility**: The `isHP` parameter in `_renderResourceBar` is now unused but kept for backward compatibility.
