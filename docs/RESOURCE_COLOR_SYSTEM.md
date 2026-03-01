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
| **Energy** | Electric Blue | `#00D4FF` | Bright electric blue, energetic feeling |
| **Focus** | Bright Yellow-White | `#FFF9B0` | Almost white, represents sharp focus |
| **Battery** | Sickly Green-Cyan | `#00FFA6` | Toxic green with cyan undertone |
| **Fatigue** | Earthy Brown | `#A0522D` | Brown representing exhaustion |
| **Ammo** | Magenta-Purple | `#DA70D6` | Special ammo flows like currency, bright and nice |
| **Currency** | Yellow Gold | `#FFFF00` | Twinkly Gold |
| **Key Ammo** (Tier 1 Key) | `#FF8A3D` | Bright Orange |

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
    'Ammo': '#DA70D6',
    'Currency': '#FFFF00',
    'key_ammo': '#FF8A3D',
    'Cards': '#800080'
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

Use `node public/tests/test-resource-colors.js` to audit the canonical RESOURCE_COLOR mappings against the debrief-feed implementation:
1. Verifies all nine resources (HP, Energy, Focus, Battery, Fatigue, Ammo, Currency, Key Ammo, Cards) exist
2. Confirms each hex code matches canon and key ammo uses bright orange `#FF8A3D`
3. Ensures no unexpected resource entries have drifted into the map

## Color Psychology

- **HP (Pink)**: Softer than critical red, maintains health association without panic
- **Energy (Electric Blue)**: Electric, technological, movement
- **Focus (Yellow-White)**: Clarity, concentration, brightness
- **Battery (Toxic Green)**: Artificial, technological, limited resource
- **Fatigue (Brown)**: Earthy, heavy, weariness
- **Ammo (Magenta)**: Valuable, special, flows like currency
- **Currency (Yellow-Gold)**: Twinkle yellow, irresistable Gold
- **Key Ammo (Tier 1 Key)**: Hunter orange, distintict


## Collectible Categories

All 9 canonical collectible categories and their RESOURCE_COLOR mappings are documented in `COLLECTIBLES_CANON.md`. Resource pickups (currency, ammo, battery, food) must use their RESOURCE_COLOR for overhead animations via `OverheadAnimator.showGenericExpression()` and debrief frame flash via `DebriefFeedController.reportResourceChange()`.


## Migration Notes

**Breaking Change**: Previous percentage-based coloring (green/yellow/red) has been removed.

**Benefits**:
- Clearer resource identity
- No confusion with incinerator animation
- Consistent visual language
- Frame animations provide better feedback for resource changes
