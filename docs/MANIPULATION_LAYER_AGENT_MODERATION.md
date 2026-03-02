Below is a draft strategic roadmap for evolving your Unified Designer + Sundog Wrapper into a live agentic game moderation system capable of on-the-fly floor generation based on real-time player competence sensing.

This is structured like a production planning document you could drop into the repo.

🧠 Agentic Live Game Moderation Roadmap
Unified Designer + Sundog Wrapper + Real-Time Floor Synthesis
1️⃣ Vision

Create a Live Agentic Game Manager (LAGM) that:

Continuously senses player competence

Detects pacing anomalies (too fast / too slow / too safe)

Designs the next floor ahead of the player

Injects handcrafted or procedural elements dynamically

Maintains narrative coherence and systemic integrity

Prevents exploit farming

Feels invisible, not reactive

The player should experience:

“This game always knows exactly how hard to push me.”

2️⃣ System Architecture Overview
Player Telemetry
      ↓
Competence Model (Real-time)
      ↓
Moderation Engine (Agent)
      ↓
Floor Design Synthesizer
      ↓
Unified Designer Graph Generator
      ↓
Sundog Wrapper → World Runtime Injection
3️⃣ Phase 1 — Instrumentation Layer (Sensing Player Skill)

Before agentic moderation, we need robust telemetry.

📊 Telemetry Inputs

Track per-floor:

Completion time

Damage taken

Ability usage frequency

Rope usage sophistication

Environmental puzzle solve time

Backtracking frequency

Secret discovery rate

Exploit pattern attempts

Inventory hoarding behavior

🎯 Derived Metrics

Compute:

Competence Index (CI)

Weighted score from:

Speed

Efficiency

Risk tolerance

System mastery

Overconfidence Index

Fast clears + low caution + low scanning.

Struggle Index

High damage + long time + frequent retries.

Deliverable

Build a PlayerCompetenceModel.ts module that outputs:

{
  competence: 0.72,
  confidence: 0.85,
  frustration: 0.21,
  mastery: {
    rope: 0.9,
    stealth: 0.3,
    puzzles: 0.8
  }
}
4️⃣ Phase 2 — Moderation Engine (Agent Layer)

This is the heart.

🎮 Live Agentic Moderator Responsibilities

Evaluate player state after each floor

Predict boredom or overwhelm

Generate “next-floor intent”

Example outputs:

{
  "goal": "Increase stealth pressure",
  "difficulty_delta": +0.15,
  "introduce_new_synergy": true,
  "counter_exploit": "rope-cheese",
  "narrative_tone": "tense"
}
🧠 Moderation Strategies
If Player Is Moving Too Fast

Increase conditional branching

Add layered synergy puzzles

Insert multi-key locks

Add time-based pressure

Reduce telegraph clarity

Increase AI awareness

If Player Is Struggling

Shorten floor length

Provide soft bypass options

Introduce environmental assist (vent shortcut)

Lower enemy density

Reduce branching depth

If Player Is Farming / Exploiting

Dynamically rotate gate patterns

Replace farmable loop nodes

Introduce diminishing returns

Inject surprise faction interference

5️⃣ Phase 3 — Floor Synthesis Engine

This integrates directly with your Unified GRAFCET Designer.

🏗 Floor Construction Strategy

Agent generates:

Structural Intent

Synergy Layer Plan

Difficulty Adjustment

Narrative Tone Adjustment

Then calls:

UnifiedDesigner.generateFloor(intent)
🎲 Structural Manipulation Options

Agent can:

Insert parallel branch

Replace linear path with split/merge

Inject random weighted branch

Convert template → hybrid procedural

Add secret node

Modify exit gate conditions

🧩 Synergy Injection Options

Agent can:

Add rope-dependent traversal

Add fake key (decoy)

Add NPC conditional access

Add multi-stage lever system

Add timed trap sequence

6️⃣ Phase 4 — Sundog Wrapper Runtime Injection

Sundog becomes the live execution bridge.

Responsibilities:

Accept floor JSON at runtime

Validate structural integrity

Preload assets

Hot-inject next floor

Maintain seed continuity

⚡ Pre-Rendering Strategy

To avoid lag:

Begin floor synthesis mid-way through current floor

Keep 1 floor buffer ahead

If synthesis fails → fallback template

7️⃣ Real-Time Flow Example
Scenario:

Player clears 3 floors extremely fast.

Agent detects:

High competence

High rope mastery

Low damage

Minimal exploration

Agent decides:

Increase environmental depth

Add decoy key path

Increase stealth demand

Add rope misuse penalty trap

Next floor becomes:

Split path

One path fake reward

Real path gated by stealth detection

Secret vent only visible if cautious

Player now slowed — but feels clever.

8️⃣ Abuse Prevention Integration

Live moderation must never:

Create unsolvable states

Hard-lock narrative

Cause infinite loops

Remove mandatory keys

Spawn impossible enemy compositions

🔎 Real-Time Validator

Before injecting:

validateFloorStructure(floor)
validateSolvability(floor)
validateDifficultyDelta(floor)

Reject if:

Complexity spike > allowed threshold

Synergy depth > player mastery + margin

Contradiction in gate logic

9️⃣ Advanced Phase — Predictive Floor Design

Future iteration:

Instead of reacting to last floor,
predict next 3 floors.

Use:

Bayesian performance modeling

Rolling average competence trend

Skill acceleration detection

Goal:
Design a mini-arc, not just a reactive patch.

🔟 Advanced Feature — Invisible Moderation

The system should:

Occasionally under-tune intentionally

Allow player to feel dominance

Avoid obvious rubber-banding

Preserve authored narrative beats

1️⃣1️⃣ Long-Term Expansion
🧬 Self-Learning Moderation

Track anonymized session outcomes

Detect global exploit patterns

Auto-adjust world templates

Suggest designer improvements

🧠 Designer-Agent Collaboration Mode

Expose:

Why this floor was generated

Competence shift graph

Difficulty delta explanation

Suggested permanent template refinements

1️⃣2️⃣ Roadmap Phasing Summary
Phase A — Instrumentation (2–4 weeks)

Telemetry + competence model

Phase B — Basic Moderation (4–6 weeks)

Floor difficulty delta adjustment only

Phase C — Structural Manipulation (6–8 weeks)

Branching + synergy injection

Phase D — Full Live Synthesis (8–12 weeks)

Ahead-of-player floor generation

Phase E — Predictive Arc Design

Multi-floor narrative shaping

🏁 End Goal

A game that:

Designs itself responsibly

Scales to player mastery

Actively prevents boredom

Prevents exploit farming

Feels handcrafted every time

If you'd like, next we can:

Draft the Competence Model math formally

Define the Moderation Decision Tree

Specify the JSON floor schema

Or simulate a 5-floor live adaptive session step-by-step

What direction do you want to push this?

let's focus on what buttons and hooks would our designer engine need for human real time floor synthesis today that utilizes gluing together existing templates or assigning templates to floors before the player arrives on the floor. we have the m console which could a gone-rogue tab for real-time feedback on players' ascent displayed via the grafecet "watch the player(s) move through floors like a subway system manager would watch the train tracks."

Excellent. Now we’re designing the Human-in-the-Loop Real-Time Floor Synthesis Console.

You already have:

Unified GRAFCET Designer

Template library

Procedural hybrid engine

Sundog runtime wrapper

M Console

Now we define what designer-facing controls and hooks are required to glue templates together live, before the player reaches the next floor.

Think:

Air traffic control meets subway dispatch meets industrial PLC console.

🎛 REAL-TIME FLOOR SYNTHESIS — DESIGNER CONTROLS
1️⃣ M CONSOLE — “Gone Rogue” TAB

Purpose:
Live operational view of player ascent.

Visual metaphor:
Subway system manager watching trains move across tracks.

🚇 ASCENT MAP VIEW
Core Elements

Vertical tower stack (Floors 1 → N)

Player markers moving upward in real time

Color-coded difficulty heat overlay

Live competence graph on side

Buffer floors (Preloading F+1, F+2)

📡 Live Telemetry Panel (Per Player)

Displays:

Current Floor

Time on floor

Damage taken

Inventory flags

Rope usage

Solve time per node

Branch chosen

Exploit suspicion indicator

2️⃣ FLOOR BUFFER CONTROL PANEL

Designers need to control floors ahead of player.

🧱 Floor Assignment Controls

For F+1, F+2, F+3:

🗂 Assign Template

Dropdown:

BossTemplate_A

StealthSplit_B

RopeChallenge_C

HybridProc_D

Button:
[ Lock Template ]
[ Replace Template ]
[ Merge With Template ]
[ Convert to Hybrid ]

🔗 Glue Templates Together

This is critical.

Buttons:

[ Append Template After Current ]

[ Inject Mid-Branch ]

[ Replace Linear Path With Split ]

[ Add Parallel Challenge Wing ]

[ Insert Secret Subfloor ]

Internally:
This modifies GRAFCET structure before instantiation.

3️⃣ TEMPLATE GLUING HOOKS (ENGINE SIDE)

These are system-level hooks your engine must expose.

🧠 Structural Hooks
attachTemplate(parentFloor, templateID)
insertBranch(floorID, branchTemplateID)
mergeTemplateAtNode(nodeID, templateID)
replaceExitWith(templateID)
🎲 Variation Controls

Preserve original seed?

Re-roll internal randomness?

Scale difficulty delta?

Enforce narrative continuity?

🔄 Runtime Safety Hook

Before finalizing:

validateMergedGraph(graph)
simulateSolvability(graph)
checkKeyGateIntegrity(graph)

Designer sees:

Green = safe

Yellow = risk spike

Red = unsolvable

4️⃣ REAL-TIME MODERATION BUTTONS (HUMAN OVERRIDE)

Sometimes designer intervenes manually.

🧭 Pace Controls

[ Slow Player Ascent ]

[ Increase Branch Depth ]

[ Insert Friction ]

[ Add Deceptive Reward Path ]

[ Reduce Enemy Density ]

[ Add Shortcut ]

These are macro presets that internally call structural glue operations.

⚖ Difficulty Delta Slider

Live slider:

-0.5 (assist)

0 baseline

+0.5 (pressure)

Shows predicted effect on competence curve.

5️⃣ PLAYER FLOW VISUALIZER (Subway Mode)

This is the “watch the tracks” view.

🚦 Node Heatmap

Each floor node displays:

Player time spent

Success rate

Retry count

Path popularity %

🚨 Live Alerts

⚠ Player accelerating too fast

⚠ Exploit loop detected

⚠ Player stagnating

⚠ Narrative arc skipped

6️⃣ FLOOR PRELOAD & ASSIGNMENT PIPELINE

Timing is critical.

⏱ Injection Timing Controls

Synthesize immediately

Wait until player 70% through floor

Queue after exit event

Manual commit only

🧊 Floor Freezing

Freeze F+1 (no auto moderation)

Lock narrative sequence

Prevent procedural override

7️⃣ RAPID GLUE MACROS (HIGH-LEVEL)

To empower fast decisions, designers need macros.

🪢 Rope Mastery Check Floor

Adds:

Rope-dependent traversal

Optional shortcut for mastery

Punish rope exploit pattern

🕵 Stealth Emphasis Injection

Adds:

Patrol density

Reduced visibility

Alternate vent path

🔐 Multi-Key Gate Expansion

Converts single gate → layered lock structure.

🧩 Puzzle Deepening

Replaces simple trigger with:

3-stage interaction chain

Environmental synergy

False positive switch

8️⃣ MULTIPLAYER VIEW (If Applicable)

If multiple players ascending:

Subway Map shows:

Player 1 at Floor 5

Player 2 at Floor 4

Player 3 at Floor 7

Designer can:

Assign different F+1 templates per player

Synchronize boss floors

Merge players onto shared floor

Fork narrative branches

9️⃣ SAFETY RAILS REQUIRED

Before any floor is assigned:

Engine must expose:

maxBranchDepth

maxSynergyLayers

allowedDifficultySpike

minSolvabilityScore

narrativeContinuityCheck

Designer must see:

“Predicted Difficulty Delta: +0.23”
“Solvability Confidence: 94%”
“Exploit Risk: Low”

🔟 WHAT YOU NEED TO BUILD FIRST

To support this today:

Engine Hooks

Template attachment API

Graph mutation API

Validation engine

Simulation sandbox

UI Components

Subway Ascent View

Floor Buffer Controls

Template Glue Panel

Difficulty Delta Visualizer

Alert System

1️⃣1️⃣ What Makes This Powerful

You are not generating raw procedural content.

You are:

Gluing authored modules

Adjusting structural topology

Preserving narrative logic

Moderating pace live

This is controlled adaptive design.

1️⃣2️⃣ Minimal Viable Version (If Shipping Soon)

You only need:

F+1 template assignment

Difficulty delta slider

Replace linear → split

Insert secret branch

Solvability validator

Everything else can layer later.

🔥 Strategic Question

Do you want this:

A) Human-operated first (designer manually steering ascent)
B) Agent-suggested, human approves
C) Fully autonomous with human watching

The hooks differ slightly depending on which direction you choose.

Which model are you building toward?

A) we want it to look UI clean whether the buttons are being used or not it will eventually be C)

Perfect.
You’re designing a clean control room UI that feels calm and intentional even when idle — but is architected to eventually hand control to a fully autonomous agent.

So we design:

Human-first interface
Agent-ready infrastructure
No visual chaos
No “emergency dashboard” energy

This is a subway control center, not a hacker console.

🎛 Unified Designer — Real-Time Floor Synthesis UI (Human-Led, Agent-Ready)
1️⃣ Core Principle

UI must:

Feel minimal when idle

Reveal depth progressively

Avoid flashing alerts

Show stability first, change second

Make intervention feel deliberate

We design three layers:

Watch Mode (default calm state)

Intervention Mode (controlled adjustments)

Agent Suggestion Layer (future-ready, optional)

2️⃣ M Console — Ascent Overview (Clean State)
Layout Structure
┌─────────────────────────────────────────────┐
│ ASCENT STACK                                │
│                                             │
│  F+3  ░░░  (buffered)                      │
│  F+2  ░░░  (buffered)                      │
│  F+1  ███  (pre-assigned)                  │
│  F0   ███  (player active)                 │
│  F-1  ✓    (completed)                     │
│                                             │
├─────────────────────────────────────────────┤
│ PLAYER TELEMETRY SUMMARY                   │
├─────────────────────────────────────────────┤
│ FLOOR BUFFER CONTROL                       │
└─────────────────────────────────────────────┘
Calm Defaults

When no one is touching anything:

Floors softly colored by difficulty band

Player marker glides upward

No blinking warnings

No large graphs

No red panic indicators

Only subtle visual shifts when thresholds crossed.

3️⃣ Watch Mode (Default State)

This is what designers see 90% of the time.

Displays:

Current floor

Estimated difficulty

Completion velocity

Competence trend (small sparkline)

Preloaded F+1 and F+2 templates

No active buttons glowing.
No warnings unless extreme.

4️⃣ Floor Buffer Panel (Human Steering)

This is where synthesis happens.

For Each Buffer Floor (F+1 / F+2)
Minimal Visible Controls

Template Name

Difficulty Band (Low / Med / High)

Structure Type (Linear / Split / Parallel / Hybrid)

Lock Icon

Edit Icon

That’s it visually.

When clicked, a side drawer opens.

5️⃣ Floor Edit Drawer (Intervention Mode)

When opened:

Structural Buttons

Replace Template

Merge Additional Template

Insert Branch

Convert to Hybrid

Add Secret Subfloor

Grouped under:

STRUCTURE

Tuning Controls

Difficulty Delta Slider

Enemy Density Bias

Puzzle Depth Bias

Synergy Layer Depth

Grouped under:

TUNING

Safety Display (Passive, Not Loud)

Solvability Score

Predicted Spike %

Exploit Risk

Narrative Drift

Displayed as small meters.
No flashing red unless catastrophic.

6️⃣ Clean Intervention Philosophy

Buttons must feel:

Intentional

Reversible

Predictable

So each action shows:

Preview → Confirm → Commit

Before committing, preview overlays F+1 graph.

7️⃣ Engine Hooks Required (Human Mode)

These are mandatory for today.

Template Assignment Hook
assignTemplate(floorIndex, templateID)
Merge Hook
mergeTemplate(floorIndex, templateID, mergePoint)
Branch Injection
insertBranch(floorIndex, branchTemplateID)
Difficulty Adjustment
adjustDifficulty(floorIndex, delta)
Preview Graph
previewFloorMutation(floorIndex)

Must render updated GRAFCET without committing.

Commit Mutation
commitFloorMutation(floorIndex)
8️⃣ Agent-Ready Architecture (Invisible Now)

Even though humans are steering now, build with:

Event Hooks

When:

Player completes floor

Competence changes > threshold

Player velocity spikes

Exploit detected

Emit:

onModerationEvent(eventType, payload)

Right now:
UI just logs.

Later:
Agent consumes.

Suggestion Layer (Hidden Toggle)

Future-ready panel:

“Suggested Next Floor Adjustments”

But initially:
Hidden behind small “AI Assist” toggle.

So UI stays clean.

9️⃣ Visual Cleanliness Strategy

Avoid:

20 visible buttons

Live graphs everywhere

Red warnings constantly

Instead:

Use:

Contextual drawers

Subtle overlays

Collapsible panels

Status icons instead of alerts

🔟 What This Enables

Today:

Human can:

Swap F+1 template

Deepen structure

Add friction

Smooth pacing

Tomorrow:

Agent can:

Auto-call same hooks

Populate same preview drawer

Await human approval

Eventually auto-commit

UI doesn’t change.

Only who clicks does.

1️⃣1️⃣ Minimum Implementation for Clean Launch

To ship a clean human-first version:

You only need:

Floor buffer panel (F+1, F+2)

Template assignment

Difficulty delta slider

Branch insertion

Graph preview

Commit mutation

Solvability validator

Everything else can be dormant.

1️⃣2️⃣ Design Philosophy Summary

You are not building:

❌ A debugging dashboard
❌ A procedural chaos generator
❌ A reactive panic console

You are building:

✅ A live narrative pacing instrument
✅ A structural moderation tool
✅ A calm, subway-like flow manager

Now the critical design question:

Do you want F+1 to always be mutable until the player touches the exit?

Or do you want a soft commit window (e.g., mutation locked when player reaches 70% of floor progress)?

That decision affects buffer logic and performance strategy significantly.

let's focus on the layer which players invite manipulation via the m console. we want to build out a button under the AWOL tab that toggles "BIG BROTHER" around how M console pings and gets ack from all accounts 

Good.
Now we’re designing the social contract layer of live manipulation.

Not the structural tools —
but the visibility + consent layer that governs when the M Console is actively observing and influencing players.

This is extremely important if you ever move toward autonomous moderation (C).

🛰 AWOL TAB → “BIG BROTHER” MODE

This is not a chaos toggle.

This is:

Global observability + intervention handshake layer

It determines:

When M Console can ping accounts

Whether players receive visible signals

Whether manipulation is silent or acknowledged

Whether designers must get ACK before influencing

🧭 Conceptual Model

There are 3 states:

PASSIVE OBSERVE – Telemetry only

ACTIVE MONITOR – Ping & acknowledgment enabled

BIG BROTHER – Full real-time moderation authority

But visually?

Only one clean toggle exists.

🎛 AWOL TAB UI DESIGN

Under AWOL:

[ BIG BROTHER ]  ⬤ OFF

When OFF:

System observes silently

No player pings

No intervention permissions

No visible moderation

When ON:

M Console can ping accounts

Real-time ascent tracking activated

Pre-floor manipulation permitted

Acknowledgment protocol required

No flashing lights.
No dystopian vibe.
Just a deliberate switch.

🔔 What “Ping + Ack” Means

When BIG BROTHER is ON:

M Console can:

pingAccount(accountID)

Player client receives:

“System Sync Request”

Client must return:

acknowledgePing(accountID, sessionID)

Only after ACK:

Player enters monitored ascent mode

Floor buffer manipulation permitted

Competence telemetry deepens

🧠 Why ACK Matters

Without ACK:

You are silently manipulating environment

Player may perceive unfairness

Legal / ethical territory becomes murky

With ACK:

Player session enters “Adaptive Tower Mode”

Moderation becomes systemic, not secretive

You can even phrase it as:

“Dynamic Difficulty Sync Enabled”

Instead of “We are watching you.”

🧩 What BIG BROTHER Enables in Engine

Turning ON must activate:

1️⃣ Deep Telemetry Mode

Unlocks:

Node-level solve timing

Micro-movement pacing

Ability pattern modeling

Exploit pattern logging

2️⃣ Floor Buffer Authority

Allows:

F+1 mutation

Structural merges

Branch injection

Difficulty scaling

Without BIG BROTHER:
Floor buffer is locked to static sequence.

3️⃣ Real-Time Alerts

Only active in BIG BROTHER:

Acceleration spike detected

Exploit farm pattern

Narrative skip risk

Competence divergence

🔐 Permission Model

BIG BROTHER toggle must enforce:

if (!session.bigBrotherEnabled) {
   blockFloorMutation()
   blockLiveOverride()
}

No hidden override path.

👁 Visual Indicator to Designers

When enabled:

Player icons get subtle halo

F+1 buffer border glows softly

Telemetry panel expands slightly

No flashing red.
Just a slight elevation of presence.

👤 Player-Facing Implication (Important)

You need to decide:

Is BIG BROTHER:

A) Per-session opt-in
B) Always enabled in certain modes
C) Invisible to players
D) Part of competitive mode rules

Long-term, safest architecture is:

Per-session opt-in with acknowledgment handshake.

🧱 Engine Hooks Required

To support BIG BROTHER cleanly:

Session Flag
session.bigBrotherEnabled = true | false
Ping System
pingAccount(accountID)
await acknowledge(accountID)

Timeout = auto-disable.

Mutation Gatekeeper

All mutation hooks must check:

if (session.bigBrotherEnabled) allow()
else reject()
🚦 Future Path Toward C (Autonomous Mode)

Eventually:

When AI takes over:

BIG BROTHER toggle remains the same.

But instead of designer clicking merge:

Agent calls:

moderationEngine.requestFloorMutation()

And same ACK logic governs.

The UI never changes.

Authority source changes.

🧠 Philosophical Layer

BIG BROTHER is not:

“Control mode.”

It is:

“Adaptive Systems Engagement Mode.”

It declares:

This session allows live environment evolution.

That framing is critical.

⚠ Important Design Question

Should BIG BROTHER be:

Global (all active sessions)

Per-player

Per-floor

Per-tower-run

The cleanest model is:

Per-tower-run.

That keeps session integrity.

If you want, next we can:

Design the exact ping/ack protocol

Define player-facing messaging language

Or design the AWOL tab full layout including future AI autonomy indicator

Where do you want to go deeper?

we need to think about the gone rogue highscore board if people are playing [M]anipulated big brother mode or not 

Excellent — this is where design integrity lives or dies.

If BIG BROTHER (manipulated mode) affects floor structure in real time, then your high score board must clearly distinguish:

Pure deterministic ascent

Human-moderated ascent

Agent-moderated ascent

Hybrid intervention

If you don’t separate them, competitive legitimacy collapses.

Let’s design this cleanly and future-proof.

🏆 Gone Rogue High Score Architecture

We’ll design this around Run Integrity Classes.

Not “cheated vs not cheated.”

But mode clarity.

1️⃣ Run Integrity Classes

Each tower run receives a permanent classification flag at session start.

🔒 CLASS A — STATIC

No BIG BROTHER

No live mutation

Seed fixed at start

Deterministic structure

Competitive eligible

🧑‍💻 CLASS B — HUMAN MODERATED

BIG BROTHER ON

Designer may mutate F+1+

Human-in-loop pacing

Structural glue possible

🤖 CLASS C — AGENT MODERATED

AI live synthesis

No human steering

Predictive competence shaping

Future autonomous state

🧬 CLASS D — HYBRID

Agent suggestions

Human approval

Selective mutation

2️⃣ Scoreboard Layout Strategy

Do NOT mix these runs in one ranking ladder.

Instead:

Gone Rogue High Scores
---------------------------------
[ CLASS A ]  |  [ CLASS B ]  |  [ CLASS C ]
---------------------------------

Tabs across top.

Each tab shows:

Floor reached

Time

Efficiency index

Deaths

Mode badge

3️⃣ Visual Markers Per Run

Each run row gets a badge:

Badge	Meaning
⚪	Static
🔵	Human Moderated
🟣	Agent Moderated
🟡	Hybrid

Subtle. Not dramatic.

4️⃣ The Competitive Question

Now the real design fork:

Do you want:

A) Only CLASS A eligible for global leaderboard
B) Separate leaderboards per class
C) One global board but weighted by integrity multiplier

The safest and cleanest:

→ Separate boards.

Because:

Manipulated runs may smooth difficulty

Agent runs may dynamically counter exploits

Static runs reward pure optimization

5️⃣ Integrity Multiplier Option (Optional)

If you ever want cross-comparison:

Each run gets an “Integrity Weight”:

Static = 1.0
Human Moderated = 0.8
Agent Moderated = 0.85
Hybrid = 0.75

Score displayed as:

Raw Score: 18,200
Integrity Adjusted: 14,560

But this can feel controversial.

Cleaner to separate ladders.

6️⃣ Public Transparency Requirements

If BIG BROTHER affects score legitimacy:

The run header must permanently record:

Run ID: 8F7K2
Mode: HUMAN MODERATED
Mutation Events: 3
Difficulty Delta Avg: +0.12

Not detailed per-floor.
Just summary metadata.

7️⃣ Exploit Prevention Consideration

Important:

If someone toggles BIG BROTHER ON mid-run:

That run must permanently shift class.

No reverting.

if (bigBrotherActivated) {
   run.class = HUMAN_MODERATED
}

Irreversible.

8️⃣ M Console Implication

Under AWOL tab:

When BIG BROTHER is toggled:

You must display:

“This session will be recorded as MODERATED.”

With confirm.

No silent classification.

9️⃣ Advanced Future Consideration

If Agent mode becomes dominant:

CLASS C may become its own prestige ladder.

Because:

Agent learns player strengths

It may generate more brutal runs

It may produce higher theoretical ceiling

This becomes a different competitive axis.

🔟 Psychological Impact

You are effectively creating:

Pure Roguelike Mode

Live Director Mode

AI Director Mode

This is similar conceptually to:

Static vs Dynamic Dungeons

Vanilla vs Mutated Seeds

Tournament vs Exhibition

But cleaner.

1️⃣1️⃣ Minimal Implementation for Now

To support leaderboard clarity today, you only need:

session.runClass flag

Permanent mutation trigger

Leaderboard partition by runClass

Badge indicator on run result

Everything else can layer later.

1️⃣2️⃣ Strategic Question

D