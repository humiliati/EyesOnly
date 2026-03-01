# World Building Engine Design Document

## 1. Overview

This document outlines the design for a new world-building engine for Gone Rogue. The engine will provide a designer-friendly interface for creating and connecting both contrived and procedurally generated floors, and it will output floor data in a format that is compatible with the existing game systems.

## 2. Goals

- To create a unified and intuitive world-building experience for designers.
- To support the creation of both hand-crafted (contrived) and procedurally generated floors.
- To enable designers to create complex building interiors with multiple floors.
- To output floor data in a format that is compatible with the existing floor loading and biome systems.
- To leverage existing tools and code as much as possible.

## 3. Architecture

The world-building engine will consist of two main components:

1.  **World Designer:** A new, flowchart-style editor for creating and connecting floors and buildings.
2.  **Map Designer:** An enhanced version of the existing map editor that supports ASCII-style floor layouts.

These two components will be integrated to provide a seamless world-building experience.

### 3.1. World Designer

The World Designer will be a new tool, located at `portal/world-designer.html`. It will allow designers to:

- Create a new world project.
- Add new floors and buildings to the world.
- Connect floors and buildings using a flowchart-style interface.
- Specify the properties of each floor, such as its name, ID, biome, and whether it is contrived or procedurally generated.
- Launch the Map Designer to edit the layout of a contrived floor.
- Export the entire world as a set of individual floor datasets.

### 3.2. Map Designer

The existing Map Designer at `portal/map-designer.html` will be enhanced to support:

-   **ASCII-Style Floor Layouts:** A new text area will be added to the Map Designer that allows designers to block out the basic structure of a floor using ASCII characters. This will be a quick and easy way to create the basic layout of a floor before adding more detailed entities.
-   **Two-Way Binding:** The ASCII layout will be two-way bound to the canvas editor, so that changes in one will be reflected in the other.

## 4. Data Format

The world will be saved as a single JSON file (`world.json`) that contains a list of all the floors and buildings in the world, as well as the connections between them.

Each contrived floor will also have its own individual JSON file (e.g., `Floor1.2.5.json`) that contains the layout of the floor, as defined in the Map Designer.

## 5. Implementation Plan

1.  **Create the `WORLD_BUILDING_ENGINE.md` design document.** (This document)
2.  **Create the `world-designer.html` and `world-designer.js` files.**
3.  **Implement the basic flowcharting functionality in the World Designer.**
4.  **Enhance the Map Designer to support ASCII-style floor layouts.**
5.  **Integrate the World Designer and the Map Designer.**
6.  **Implement the world export functionality.**
