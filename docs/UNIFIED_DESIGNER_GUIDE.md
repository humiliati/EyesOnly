# Unified Designer Guide

This guide explains the workflow for using the Unified Designer to create game worlds, from assets to final deployment.

## 1. The Unified Designer Hub

The `unified-designer.html` file is the central hub for all design activities. It provides a top-level navigation bar to switch between the three main design tools:

*   **Asset Designer:** For creating and managing scene assets.
*   **Map Designer:** For creating 2D tile-based maps.
*   **World Designer:** For creating a flowchart-like graph of the game world.

## 2. The Asset Pipeline

The Unified Designer implements a clear pipeline for creating and using assets:

### 2.1. Create Assets in the Asset Designer

1.  Open the Unified Designer and select the "Asset Designer" tab.
2.  Create your scene assets, defining their properties (emojis, density, etc.).
3.  When you are finished, click the "Export to Registry" button. This will register the asset in the global asset registry, making it available to the other designers.

### 2.2. Use Assets in the Map Designer

1.  Switch to the "Map Designer" tab.
2.  In the tool palette on the left, you will see a new "Assets" section. This section will be populated with the assets you created in the Asset Designer.
3.  Click on an asset to select it as your current tool.
4.  Click on the map canvas to place the asset on the map.

### 2.3. Save Floors in the Map Designer

1.  Once you have finished designing your map, give it a unique name in the "Floor Info" section.
2.  Click the "Save" button. This will save the floor data to local storage and also register it with the `UnifiedDataManager`.

### 2.4. Build Worlds in the World Designer

1.  Switch to the "World Designer" tab.
2.  Create a "Step" node. This node represents a floor in your game world.
3.  In the property inspector for the "Step" node, you will see a new "Map" dropdown.
4.  This dropdown will be populated with the floors you saved in the Map Designer.
5.  Select the desired map from the dropdown to assign it to the "Step" node.

## 3. Exporting for Deployment

Once you have created your assets, maps, and world graph, you can export the entire world for deployment.

1.  In the Unified Designer hub, click the "Export All" button.
2.  This will generate a single `world.json` file that contains all the data for your game world, including the assets, maps, and the world graph itself. This file can then be loaded by the game engine.
