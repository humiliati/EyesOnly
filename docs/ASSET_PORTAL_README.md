# Scene Asset Designer Portal

## Overview

The Scene Asset Designer Portal is a visual editor for composing emoji-based scene clusters for the Gone Rogue game. Designers can create, test, and export asset definitions that combine multiple emojis with precise positioning, scaling, and layering.

## Quick Start

1. Open `public/portal/asset-designer.html` in a web browser
2. Use the emoji palette to add emojis to your composition
3. Click and drag emojis to reposition them
4. Use mouse wheel to scale selected emoji
5. Adjust properties in the right panel
6. Export your asset to JSON

## Features

### Visual Editor
- **Canvas Preview**: Real-time preview of your asset composition
- **Emoji Palette**: 16 common emojis + custom emoji input
- **Grid Overlay**: Toggle grid for precise positioning
- **Selection Indicator**: Visual feedback for selected emoji

### Interaction Model
- **Click**: Select emoji for editing
- **Drag**: Reposition selected emoji
- **Scroll**: Scale selected emoji (0.1x to 2.0x)
- **Keyboard Shortcuts**:
  - `1-9`: Switch between emoji layers
  - `Delete/Backspace`: Remove selected emoji
  - `Ctrl/Cmd + D`: Duplicate selected emoji

### Asset Properties
- **Asset ID**: Unique identifier for registry
- **Name**: Display name
- **Category**: furniture, nature, structure, abstract
- **Valid Tiles**: Tile types where asset can be placed
- **Density**: Base density for placement (0-100%)
- **Scatter**: Random scatter chance (0-100%)
- **Layers**: Configure z-offset for base/surface/floating layers
- **Animation**: Choose placement animation (slideUp, pop, fade, none)
- **Shadows**: Toggle shadow rendering

### Emoji Properties
When an emoji is selected, the properties panel shows:
- Emoji character
- Layer assignment
- Offset X/Y position
- Scale factor
- Rotation angle

### Asset Library
Pre-built asset templates organized by category:
- **Furniture**: Desk, Chair, Computer
- **Nature**: Tree, Flower, Rock
- **Structure**: Wall, Door, Window
- **Abstract**: Glow effects

## Asset Schema

Assets are saved with the following structure:

```javascript
{
  "id": "DESK_CLUSTER_OFFICE",
  "name": "Office Desk Cluster",
  "description": "Computer setup with coffee and supplies",
  "category": "furniture",
  "emojiSet": [
    {
      "emoji": "💻",
      "offsetX": 0,
      "offsetY": -6,
      "scale": 0.85,
      "layer": "base",
      "rotation": 0
    }
    // ... more emojis
  ],
  "anchor": { "x": 0, "y": 0, "origin": "center" },
  "validTiles": ["FLOOR_OFFICE", "FLOOR_CORRIDOR"],
  "placementRules": {
    "minSeparation": 3,
    "maxPerRegion": 4,
    "preferAgainstWall": false,
    "avoidHighTraffic": true,
    "seedModifier": 0
  },
  "densityConfig": {
    "baseDensity": 0.3,
    "scatterChance": 0.4,
    "maxClustersPerChunk": 8
  },
  "renderConfig": {
    "layers": [
      { "name": "base", "zOffset": 0 },
      { "name": "surface", "zOffset": 4 },
      { "name": "floating", "zOffset": 8 }
    ],
    "shadows": true,
    "ambientOcclusion": true
  },
  "animations": {
    "onPlace": "slideUp",
    "onInteract": "wiggle",
    "onDestroy": "shrinkFade"
  },
  "tags": ["office", "furniture", "workstation"],
  "author": "designer_name",
  "version": "1.0.0",
  "created": "2026-02-21",
  "modified": "2026-02-21"
}
```

## Density Testing

Click "Test Density" to open a modal showing how your asset appears when placed across multiple tiles with the current density and scatter settings. Adjust the seed to see different random variations.

## Persistence

- **LocalStorage**: Work-in-progress assets are saved to `eyesonly_asset_registry_v1`
- **Export**: Download assets as JSON files for version control
- **Import**: (Future) Load JSON files back into the editor

## Files

### Portal Files
- `public/portal/asset-designer.html` - Main portal HTML
- `public/portal/css/asset-designer.css` - Portal styles
- `public/portal/js/asset-editor.js` - Main editor controller
- `public/portal/js/asset-cluster-registry.js` - Asset storage/management
- `public/portal/js/asset-preview-renderer.js` - Preview rendering
- `public/portal/js/density-tester.js` - Density testing modal

### Integration
Assets created in the portal can be integrated into the game by:
1. Exporting to JSON
2. Loading into the game's asset system
3. Referencing by ID in scene generation code

## Tips

1. **Start Simple**: Begin with a single emoji and add complexity
2. **Layer Wisely**: Use base for main objects, surface for decorations, floating for effects
3. **Test Density**: Always test how your asset looks at different densities
4. **Consistent Scale**: Keep scale between 0.5-1.5 for best results
5. **Name Clearly**: Use descriptive IDs like DESK_CLUSTER_OFFICE

## Browser Compatibility

Works best in modern browsers with:
- Canvas 2D support
- LocalStorage support
- ES5+ JavaScript support

Tested in Chrome, Firefox, Safari, Edge.

## Future Enhancements

- Animation preview in editor
- Asset composition templates
- Bulk import/export
- Asset sharing/marketplace
- Live game preview integration
- Undo/redo functionality
- Asset versioning
