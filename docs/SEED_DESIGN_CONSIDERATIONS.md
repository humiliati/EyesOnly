# Hybrid Seed Architecture and Live Moderation System

This document outlines the architecture for a hybrid procedural generation and live moderation system. The system is designed to be both predictable and dynamic, allowing for real-time adjustments to the game world while maintaining fairness and replayability.

## 1. Core Principles

The Hybrid Seed Architecture is built on a set of core principles that ensure a balance between predictability, fairness, and dynamic gameplay:

*   **Predictable by Default:** All runs are deterministic by default, based on a single base seed.
*   **Controlled Mutability:** Live moderation (both human and agent-driven) is possible, but it is strictly controlled and logged.
*   **Single-Step Horizon:** Mutations are only allowed on the next floor (F+1), preventing retroactive changes and far-future stacking.
*   **Player Agency:** Players can find and use items that allow them to influence the mutation system, giving them a degree of control over the game's dynamism.
*   **Transparent Scoring:** The high score system clearly distinguishes between different run types, ensuring competitive integrity.

## 2. Hybrid Seed Architecture

The Hybrid Seed Architecture is the foundation of the system. It combines a base seed with a series of mutation logs to create a complete and replayable record of each run.

### 2.1. Run Model

Each run is represented by a `Run` object with the following structure:

```javascript
{
  "runId": "string",
  "baseSeed": "string",
  "runClass": "RunClass",
  "mutationLog": [
    // StructuralMutationEvent objects
  ],
  "paramOverlayLog": [
    // ParamMutationEvent objects
  ],
  "mutationBudgetRemaining": "number",
  "structuralHash": "string",
  "paramHash": "string",
  "resolvedHash": "string"
}
```

*   **`baseSeed`:** The initial seed for the run, which determines the deterministic generation of all floors.
*   **`runClass`:** The integrity class of the run (e.g., `STATIC`, `HUMAN_MODERATED`).
*   **`mutationLog`:** A log of all structural mutations that have been applied to the run.
*   **`paramOverlayLog`:** A log of all parameter mutations that have been applied to the run.
*   **`mutationBudgetRemaining`:** The remaining budget for parameter mutations on the current floor.
*   **Hashes:** A series of hashes that can be used to verify the integrity of the run data.

### 2.2. Floor Resolution

When a floor is resolved, the following steps are taken:

1.  The base parameters for the floor are generated from the `baseSeed` and the difficulty band.
2.  Any `ParamMutationEvents` for the current floor are applied.
3.  The final parameters are clamped to their allowed ranges.
### 2.3. Engineering Considerations

The `Run` model will be implemented as an extension of the `world.json` file that is exported from the `unified-designer`. The `exportWorld` function in `world-designer.js` will be modified to include the `baseSeed`, `runClass`, and other relevant fields.

The floor resolution logic will be implemented in the game engine, and it will be responsible for applying the `ParamMutationEvents` from the `paramOverlayLog` to the base floor data.

## 3. Mutation Rules and Budget

To ensure that live moderation is fair and predictable, the system enforces a strict set of rules for all mutations.

### 3.1. Strict F+1 Mutation

The most important rule is that all mutations (both structural and parameter-based) are only allowed on the next floor (F+1). This has several key benefits:

*   **No mid-floor manipulation:** The current floor can never be changed while the player is on it.
*   **No retroactive changes:** Past floors cannot be altered.
*   **No far-future stacking:** Designers and agents cannot pre-stack a series of mutations deep into the run.

This rule is enforced by the `rejectMutation` function, which will reject any mutation that does not target the `currentFloorIndex + 1`.

### 3.2. Mutation Budget

To prevent abuse, each floor has a `paramBudget` that limits the amount of parameter drift that can be applied. The total weighted drift for all parameter mutations on a floor cannot exceed this budget. ### 3.3. Engineering Considerations

The "Strict F+1 Mutation" and "Mutation Budget" rules will be enforced by the M-Console's UI and the underlying game engine. The "BIG BROTHER" mode in the M-Console (implemented in `scenario-designer.html`) is the gateway to all live manipulation features. The `rejectMutation` function will be implemented in the game engine and will be responsible for validating all mutation requests.

## 4. Player-Driven Manipulation

Players can find and use special items that allow them to influence the mutation system, giving them a degree of control over the game's dynamism.

### 4.1. They Live Glasses (Foresight)

The "They Live Glasses" are a player item that extends the mutation window to F+2, allowing the player to see and influence the floor after the next one. This provides a greater degree of foresight and control, but it comes with trade-offs.

#### 4.1.1. Mechanics

*   **Extended Window:** When equipped, the mutable floor window is extended to `F+2`.
*   **Limited Scope:** Mutations at F+2 are limited to parameter changes only. Structural changes are not allowed.
*   **Window Collapse:** The F+2 window is not permanent. It can collapse based on a variety of factors, such as time, player actions, or resource drain.

#### 4.1.2. Player State

The player's `futureVision` state is updated to reflect the extended window:

```javascript
{
  "maxWindow": 2,
  "currentWindow": 2,
  "closesAtFloor": null,
  "expiresAtTime": "timestamp",
  "energy": 100,
#### 4.1.3. Engineering Considerations

The `futureVision` object will be added to the player's data model in the game engine. The game engine will be responsible for enforcing the extended mutation window and the window collapse logic.

### 4.2. Winston Smith's Diary (Entropy)

The "Winston Smith's Diary" is a counter-item to the "They Live Glasses." It introduces "entropy" into the system, making future floors less predictable and hindering the effectiveness of live moderation.

#### 4.2.1. Mechanics

*   **Mutation Fog:** The Diary does not block mutations directly, but it corrupts foresight. When the Diary is active, the M-Console will see conflicting branches and flickering template options, and seed resolution will be delayed.
*   **Entropy Injection:** The Diary introduces an `entropyWeight` into the floor resolution process. Instead of resolving to a single, deterministic template, the system will resolve to a weighted random selection of templates.
*   **Ack Disruption:** The Diary can also disrupt the M-Console's ping and acknowledgment system, causing delayed or ghost acks and reducing the designer's confidence in the player's position.

#### 4.2.2. Player State

The player's `entropyField` state is updated to reflect the Diary's influence:

```javascript
{
  "strength": 0.35,
  "sourceItemId": "winston_diary",
#### 4.2.3. Engineering Considerations

The `entropyField` object will be added to the player's data model in the game engine. The game engine will be responsible for implementing the "Mutation Fog," "Entropy Injection," and "Ack Disruption" mechanics.

## 5. Leaderboard Integrity

To ensure competitive integrity, the high score system clearly distinguishes between different run types based on their "Run Integrity Class."

### 5.1. Run Integrity Classes

*   **Class A (Static):** A deterministic run with no live manipulation.
*   **Class B (Human-Moderated):** A run that was manipulated by a human designer.
*   **Class C (Agent-Moderated):** A run that was manipulated by the Live Agentic Moderator.
*   **Class D (Hybrid):** A run that was manipulated by a combination of human and agent intervention.

### 5.2. Scoreboard Layout

The high score board is divided into separate tabs for each run integrity class. This ensures that players are only competing against others who played under the same conditions.

### 5.3. Public Transparency

### 5.4. Engineering Considerations

The `runClass` will be a property of the `Run` model, and it will be set by the game engine based on whether the run has been manipulated. The high score board will need to be implemented on the game's backend, and it will need to be able to filter and display runs based on their `runClass`.

## 6. M-Console Integration

The M-Console provides a UI for designers and agents to interact with the Hybrid Seed Architecture and Live Moderation System.

### 6.1. "BIG BROTHER" Mode

As described in the "Live Agentic Game Moderation System" document, the "BIG BROTHER" mode in the AWOL tab is the gateway to all live manipulation features. It is a global toggle that enables or disables the M-Console's ability to ping player accounts and mutate future floors.

### 6.2. F+1 Mutation UI

When "BIG BROTHER" mode is active, the M-Console will display a new UI for the F+1 floor, which includes:

*   **Param Delta Meter:** A meter that shows the current parameter drift for the floor.
*   **Mutation Budget Bar:** A bar that shows the remaining budget for parameter mutations.
### 6.3. Engineering Considerations

The M-Console UI described in this document is a more advanced version of the `scenario-designer.html` file. The existing code in `scenario-designer.html` can be used as a starting point for implementing the new features, such as the "Param Delta Meter," "Mutation Budget Bar," and "Structural Edit Icon."
