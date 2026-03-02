# World Building Engine Implementation Roadmap

This roadmap outlines the development plan for the World Building Engine, based on the design considerations in the `WORLD_BUILDING_ENGINE.md` document.

## Phase 1: Core Functionality & Basic Editors

**Objective:** Establish the foundational tools and data structures for the World Building Engine.

- **1.1: World Designer UI:**
    - Create the basic HTML structure for the World Designer, including the canvas, tool palette, and property inspector.
    - Implement basic styling using the existing `map-designer.css`.

- **1.2: Flowchart Implementation:**
    - Integrate `jsPlumb` to create a flowchart-style interface for adding and connecting nodes.
    - Implement basic node types: "Floor" and "Building".

- **1.3: ASCII Map Editor:**
    - Enhance the existing Map Designer with a text area for ASCII-style floor layouts.
    - Implement two-way binding between the ASCII editor and the visual tile editor.

- **1.4: World Data I/O:**
    - Implement the ability to import and export world data as a `world.json` file.
    - Implement the ability to save and load individual floor layouts as JSON files.

## Phase 2: Advanced Node Types & SFC Logic

**Objective:** Implement the core Sequential Function Chart (SFC) logic and advanced node types.

- **2.1: Advanced Node Types:**
    - Implement the following GRAFCET-style node types in the World Designer:
        - **Step Node:** Represents a floor, narrative beat, or world condition.
        - **Transition Node:** Defines the conditions for moving to the next step.
        - **Parallel Branch Node:** Allows for multiple active quest lines or exploration branches.
        - **Convergence Node:** Merges parallel branches.

- **2.2: SFC Evaluation Engine:**
    - Create a JavaScript module to evaluate the SFC graph.
    - The engine will determine the next floor to load based on the current world state and transition conditions.

- **2.3: Player State Integration:**
    - Integrate the SFC evaluation engine with the player's state (e.g., inventory, quest flags).
    - Transition conditions can now be based on player progress.

## Phase 3: Environmental Synergy & Gameplay Mechanics

**Objective:** Integrate the core gameplay mechanics and environmental synergies into the World Building Engine.

- **3.1: Synergy System Integration:**
    - Implement UI controls in the World Designer for adding and configuring environmental synergies:
        - Key + Gate Linker
        - Quest Key + NPC Binder
        - Vent Bypass Node
        - Secret Button

- **3.2: Rope System Integration:**
    - Add a dedicated Rope System panel to the World Designer.
    - Allow designers to configure rope actions, length, and visual settings.

- **3.3: Contrived vs. Procedural Generation:**
    - Implement the logic for selecting between template-based and procedurally generated floors based on the Step Node's properties.
    - Allow designers to specify seed modifiers for procedural generation.

## Phase 4: Validation, Debugging & Polish

**Objective:** Implement robust validation and debugging tools to ensure world integrity and provide a polished designer experience.

- **4.1: Validation Layer:**
    - Create a validation pass that checks for common design errors:
        - Unreachable steps or infinite loops.
        - Unsolvable gates or missing keys.
        - Rope system deadlocks.

- **4.2: Debugging Tools:**
    - Implement a designer preview mode that allows for:
        - Playing from a selected node.
        - Forcing transition conditions to be true or false.
        - Simulating player inventory.

- **4.3: Visual Polish:**
    - Enhance the visual language of the World Designer to clearly distinguish between different node and connection types.
    - Implement visual effects and audio cues for a more engaging design experience.

## Phase 5: Advanced Features & Abuse Prevention

**Objective:** Implement advanced features for narrative control and prevent potential exploits.

- **5.1: Narrative Control:**
    - Implement a narrative tone slider to influence procedural generation.
    - Add a dialogue trigger system to the World Designer.

- **5.2: Abuse Prevention:**
    - Implement an exploit detection system to identify potential issues:
        - Soft lock risks.
        - Rope bypass abuse.
        - Infinite farming loops.

- **5.3: Export & Versioning:**
    - Implement advanced export and versioning features:
        - Save as Template
        - Save as Procedural Pattern
        - Fork World Graph
        - Compare Versions
