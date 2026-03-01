# Roadmap: Rope, Buttons, and Levers System Implementation

This document outlines the development roadmap for implementing the rope interaction system as detailed in the [ROPE_BUTTONS_LEVERS_SYSTEM.md](file:///c%3A%5CUsers%5Chughe%5C.openclaw%5Cworkspace%5CEyesOnly%5Cdocs%5CROPE_BUTTONS_LEVERS_SYSTEM.md) guide.

---

### Phase 1: Core RopeManager Setup

**Objective:** Establish the foundational `ropeManager` and its core state management.

- **Tasks:**
  - [ ] Create `ropeManager.js` module.
  - [ ] Implement the core state machine (idle, hasRope, ropeActive).
  - [ ] Initialize `ropeManager` in the main game file (`gone-rogue.js`).
  - [ ] Add a temporary rope pickup mechanism for testing.

- **Acceptance Criteria:**
  - `ropeManager` is initialized on game start.
  - Player can acquire and lose the rope state.
  - All state transitions are logged correctly.

---

### Phase 2: Basic Interactive Objects (Levers & Buttons)

**Objective:** Implement basic, instant-resolve interactions.

- **Tasks:**
  - [ ] Define the universal interactive object contract.
  - [ ] Create a sample lever object with a `toggle()` method.
  - [ ] Create a sample button object with a `press()` method.
  - [ ] Implement `ropeManager.deploy()` to handle interactions.
  - [ ] Add distance validation within the `deploy` function.

- **Acceptance Criteria:**
  - Player can successfully use the rope to toggle the lever from a distance.
  - Player can press the button from a distance.
  - Interactions fail correctly when the player is out of range.

---

### Phase 3: Advanced Interactives & Gating

**Objective:** Introduce more complex interaction behaviors.

- **Tasks:**
  - [ ] Implement a `holdRequired` option for buttons.
  - [ ] Create the `tripWireMode` logic and anchor points.
  - [ ] Hand off persistent tripwires to a separate `trapSystem`.
  - [ ] Add support for `requiredItem` to gate interactions based on inventory.

- **Acceptance Criteria:**
  - Hold-to-activate buttons work as expected.
  - Players can create tripwires between two anchors.
  - Interactions are correctly blocked if the player lacks the required item.

---

### Phase 4: System Hardening & Abuse Prevention

**Objective:** Implement the designer checklists and abuse prevention rules.

- **Tasks:**
  - [ ] Add developer warnings for objects that don't meet the universal contract.
  - [ ] Implement `maxRopeDistanceOverride` and `requiresUpgrade` checks.
  - [ ] Add `maxActiveTripWires` and `tripWireDuration` to prevent spam.

- **Acceptance Criteria:**
  - The system correctly limits or prevents interactions based on the defined abuse prevention rules.
  - The console provides clear warnings for designers when rules are violated.

---

### Phase 5: UI/UX Polish & Rendering

**Objective:** Implement the visual components of the rope system.

- **Tasks:**
  - [ ] Create an SVG overlay for rendering the rope line.
  - [ ] Connect the `ropeManager` to the rendering layer.
  - [ ] Implement the `overheadAnimationHook` for the scaling rope emoji.
  - [ ] Add visual feedback for valid targets and interaction states.

- **Acceptance Criteria:**
  - A visual rope is drawn between the player and the target.
  - The overhead rope emoji scales correctly with rope length.
  - The system provides a polished and intuitive user experience.
