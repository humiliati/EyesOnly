# Live Agentic Game Moderation System

This document outlines the architecture and implementation of the Live Agentic Game Moderation (LAGM) system, a dynamic, real-time system for adjusting game difficulty and pacing based on player competence.

## 1. System Overview

The LAGM is designed to create a more engaging and personalized player experience by continuously sensing player skill and dynamically adjusting the game world. The system is composed of four main components:

*   **Player Competence Model:** A system for tracking and analyzing player telemetry.
*   **Live Agentic Moderator:** An agent that evaluates the player's state and generates "next-floor intent."
*   **Floor Synthesis Engine:** A system for generating new floors based on the agent's intent.
*   **Human-in-the-Loop Console:** A UI for human designers to monitor and intervene in the moderation process.

## 2. Player Competence Model

The Player Competence Model is responsible for tracking and analyzing player telemetry to generate a real-time model of player skill. This model is then used by the Live Agentic Moderator to make decisions about how to adjust the game world.

### 2.1. Telemetry Inputs

The following data points are tracked for each player on a per-floor basis:

*   Completion time
*   Damage taken
*   Ability usage frequency
*   Rope usage sophistication
*   Environmental puzzle solve time
*   Backtracking frequency
*   Secret discovery rate
*   Exploit pattern attempts
*   Inventory hoarding behavior

### 2.2. Derived Metrics

From these raw telemetry inputs, the following metrics are derived:

*   **Competence Index (CI):** A weighted score that represents the player's overall skill, taking into account speed, efficiency, risk tolerance, and system mastery.
*   **Overconfidence Index:** A measure of how quickly the player is clearing floors, combined with a low level of caution and scanning.
*   **Struggle Index:** A measure of how much damage the player is taking, combined with long clear times and frequent retries.

### 2.3. Output

The Player Competence Model outputs a JSON object that summarizes the player's current state. This object is then passed to the Live Agentic Moderator.

```json
{
  "competence": 0.72,
  "confidence": 0.85,
  "frustration": 0.21,
  "mastery": {
    "rope": 0.9,
    "stealth": 0.3,
    "puzzles": 0.8
  }
}
```

## 3. Live Agentic Moderator

The Live Agentic Moderator is the heart of the LAGM system. It is an agent that evaluates the player's state after each floor and generates a "next-floor intent" to guide the Floor Synthesis Engine.

### 3.1. Responsibilities

*   Evaluate the player state from the Player Competence Model.
*   Predict whether the player is likely to become bored or overwhelmed.
*   Generate a "next-floor intent" that specifies the desired changes to the game world.

### 3.2. Next-Floor Intent

The next-floor intent is a JSON object that describes the desired changes for the next floor. Here is an example:

```json
{
  "goal": "Increase stealth pressure",
  "difficulty_delta": 0.15,
  "introduce_new_synergy": true,
  "counter_exploit": "rope-cheese",
  "narrative_tone": "tense"
}
```

### 3.3. Moderation Strategies

The Live Agentic Moderator employs a variety of strategies to adjust the game world based on the player's state:

*   **If the player is moving too fast:**
    *   Increase conditional branching.
    *   Add layered synergy puzzles.
    *   Insert multi-key locks.
    *   Add time-based pressure.
    *   Reduce telegraph clarity.
    *   Increase AI awareness.
*   **If the player is struggling:**
    *   Shorten floor length.
    *   Provide soft bypass options.
    *   Introduce environmental assists (e.g., vent shortcuts).
    *   Lower enemy density.
    *   Reduce branching depth.
*   **If the player is farming or exploiting:**
    *   Dynamically rotate gate patterns.
    *   Replace farmable loop nodes.
    *   Introduce diminishing returns.
    *   Inject surprise faction interference.

## 4. Floor Synthesis Engine

The Floor Synthesis Engine is responsible for generating new floors based on the "next-floor intent" from the Live Agentic Moderator. It integrates directly with the Unified Designer to create new floor layouts.

### 4.1. Floor Construction Strategy

The agent generates a high-level intent, which is then passed to the `UnifiedDesigner.generateFloor(intent)` function. The intent includes:

*   **Structural Intent:** How the overall floor layout should be changed.
*   **Synergy Layer Plan:** What new environmental puzzles or interactions should be added.
*   **Difficulty Adjustment:** A delta to increase or decrease the difficulty.
*   **Narrative Tone Adjustment:** A change to the overall mood or feeling of the floor.

### 4.2. Structural Manipulation Options

The Floor Synthesis Engine can make the following structural changes to a floor:

*   Insert a parallel branch.
*   Replace a linear path with a split/merge.
*   Inject a random weighted branch.
*   Convert a template-based floor to a hybrid procedural floor.
*   Add a secret node.
*   Modify the exit gate conditions.

### 4.3. Synergy Injection Options

The Floor Synthesis Engine can inject the following environmental synergies into a floor:

*   Add rope-dependent traversal.
*   Add a fake key (decoy).
*   Add NPC conditional access.
*   Add a multi-stage lever system.
*   Add a timed trap sequence.

## 5. Human-in-the-Loop Console

The Human-in-the-Loop Console is a UI that allows human designers to monitor player progress and manually intervene in the moderation process. It is composed of two main parts: the "Gone Rogue" tab in the M Console and the Floor Buffer Control Panel.

### 5.1. "Gone Rogue" Tab

This tab provides a live operational view of player ascent, visualized as a subway system map. It includes:

*   **Ascent Map View:** A vertical stack of floors showing player markers moving upward in real time, with a color-coded difficulty heat overlay and a live competence graph.
*   **Live Telemetry Panel:** A detailed view of each player's current stats, including time on floor, damage taken, inventory flags, and more.
*   **Live Alerts:** A list of alerts that are triggered when the system detects that a player is accelerating too quickly, farming for exploits, or stagnating.

### 5.2. "BIG BROTHER" Mode

This is a global toggle in the AWOL tab that enables or disables the live manipulation features of the M Console. When enabled, the M Console can ping player accounts, and players must acknowledge the ping to enter the monitored ascent mode. This is a critical feature for ensuring transparency and player consent.

### 5.3. Floor Buffer Control Panel

This panel allows designers to control the floors that are ahead of the player. For each buffered floor (F+1, F+2, F+3), designers can:

*   **Assign a template:** Choose from a list of pre-made floor templates.
*   **Glue templates together:** Append, inject, or merge templates to create new floor layouts.
*   **Adjust variation:** Re-roll randomness, scale difficulty, and enforce narrative continuity.
*   **Commit changes:** Manually commit the changes to the floor buffer.

### 5.4. Real-Time Moderation Buttons

These buttons allow designers to make manual adjustments to the game's pacing and difficulty:

*   **Pace Controls:** Slow player ascent, increase branch depth, insert friction, or add a deceptive reward path.
*   **Difficulty Delta Slider:** A slider to increase or decrease the difficulty of the next floor.

### 5.5. Safety Rails

To prevent designers from creating unsolvable or frustrating game states, the console includes a number of safety rails:

*   **Validation:** Before a mutated graph is committed, it is validated for solvability and structural integrity.
*   **Difficulty Spike Threshold:** The system will reject any changes that would cause the difficulty to spike beyond a certain threshold.
*   **Synergy Depth Limit:** The system will prevent designers from creating puzzles that are too complex for the player's current mastery level.

## 6. Run Integrity and High Scores

To ensure that the high score boards are fair and transparent, the LAGM system includes a run integrity classification system. This system assigns a class to each tower run based on whether it was manipulated by a human or an agent.

### 6.1. Run Integrity Classes

*   **Class A (Static):** A deterministic run with no live manipulation. This is the only class that is eligible for the global leaderboard.
*   **Class B (Human-Moderated):** A run that was manipulated by a human designer using the Human-in-the-Loop Console.
*   **Class C (Agent-Moderated):** A run that was manipulated by the Live Agentic Moderator.
*   **Class D (Hybrid):** A run that was manipulated by a combination of human and agent intervention.

### 6.2. Scoreboard Layout

The high score board is divided into separate tabs for each run integrity class. This ensures that players are only competing against others who played under the same conditions.

### 6.3. Public Transparency

To ensure transparency, the run header for each high score permanently records the run's integrity class, the number of mutation events, and the average difficulty delta.
