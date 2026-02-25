EYES ONLY — SCENARIO ENGINE
Live Urban Espionage ARPG Authoring System
For 90–240 minute orchestrated operations
This is the mission design brain behind everything.
It allows you to build operations like military training scenarios — not escape rooms.
Your client wants to feel like M running a red-team exercise.
So this engine must support:
•	branching outcomes
•	controllable pacing
•	live orchestration
•	physical-world logistics
•	actor coordination
•	emotional escalation
Think:
CIA training sim + capture-the-flag + immersive theater + Command & Conquer briefing system
________________________________________
1. What the Scenario Engine Actually Is
A scenario is not a story.
It is a live operational timeline with:
players
actors
lanes
dead drops
events
fail states
extraction logic
Everything must be:
•	adjustable live
•	visible to M
•	survivable if things go wrong
________________________________________
2. Scenario Structure Overview
Each scenario consists of 6 layers:
1. Mission Brief
2. Lane Network
3. Objective Chain
4. Escalation Timeline
5. Actor Script Matrix
6. Extraction Logic
Designers build these in advance.
M manipulates them live.
________________________________________
3. Mission Brief Layer
This sets tone + player purpose.
Must answer:
•	who are we
•	what are we retrieving
•	who opposes us
•	why now
Keep simple:
“Recover asset before transfer.”
Never over-lore.
Brief Variables
team size
playtime (90/120/180/240)
difficulty
actor count
lanes used
public sensitivity
Engine must generate:
•	printable brief
•	terminal intro
•	optional audio brief
________________________________________
4. Lane Network Layer
This is the physical play space.
Each lane = 1–4 city blocks.
Each block contains data:
block id
business cooperation
dead drop location
visibility risk
actor staging spots
escape routes
police sensitivity
night/day behavior
Lane Status Types
safe
neutral
contested
burned
locked
extraction-only
Designer Tool
Map editor must allow:
•	snap-to-grid lanes
•	color-coded status
•	dead drop placement
•	actor routes
•	safe zones
________________________________________
5. Objective Chain Engine
This is the spine of gameplay.
Objectives must be modular and movable.
Objective Types
locate
decode
retrieve
deliver
observe
avoid
escort
verify
Each objective has:
trigger condition
location block
required item/info
success result
failure result
fallback option
________________________________________
Example Chain
1. Find locker
2. Decode key
3. Retrieve dossier
4. Meet contact
5. Discover betrayal
6. Locate real asset
7. Extraction
But M must be able to:
•	skip steps
•	move steps
•	duplicate steps
•	accelerate chain
Live.
________________________________________
6. Escalation Timeline Engine
This is the emotional backbone.
Scenario must have predesigned escalation curve:
phase 0 — calm
phase 1 — awareness
phase 2 — contact
phase 3 — pressure
phase 4 — collapse
phase 5 — extraction
Each phase defines:
actor aggression
clue clarity
time pressure
surveillance level
music/sound (if used)
M can:
•	advance phase early
•	delay phase
•	spike temporary escalation
•	drop tension if overwhelmed
________________________________________
7. Actor Script Matrix
Actors do not follow scripts.
They follow conditional behaviors.
Each actor has:
role
home lane
mobility range
engagement level
fallback role
Behavior Triggers
Example:
IF players solve clue fast → misdirect
IF players stalled 15m → assist
IF escalation high → shadow
IF asset near → guard
This allows dynamic realism.
________________________________________
8. Event Injection Library
Every scenario includes event deck.
Events categorized:
Surveillance
•	followed
•	watched
•	photographed
Intel
•	new info
•	false info
•	intercepted message
Pressure
•	time limit
•	actor warning
•	location burned
Environmental
•	business closed
•	police presence
•	weather shift
M can deploy anytime.
________________________________________
9. Failure + Recovery Design (CRITICAL)
Players must be able to fail without game collapsing.
Every objective must include:
success path
fail path
recovery path
Example:
If code unsolved → actor intervenes
If dead drop lost → alternate drop
If wrong location → misdirect then recover
Never allow hard stop.
________________________________________
10. Extraction Engine
All scenarios must converge to extraction.
Extraction types:
vehicle pickup
foot exfil
handoff
secure location arrival
Trigger conditions:
•	time elapsed
•	objective reached
•	M decision
•	collapse state
Extraction must be:
fast
clear
cinematic
________________________________________
11. Designer Authoring Interface
Scenario builder should look like:
Subway map + timeline editor
Designers can:
•	drag objective nodes
•	assign to lanes
•	assign actors
•	set triggers
•	define escalation curve
•	preview timing
________________________________________
12. Live M Override System
During play M can:
move objective
spawn actor
remove actor
duplicate clue
lock lane
open lane
force extraction
reset block
Nothing should be fixed.
________________________________________
13. Scenario Health Monitor
Engine must warn M:
Players stalled 22m
No actor in Bravo lane
Dead drop not reset
Escalation too low
Players near finale too early
This prevents flat sessions.
________________________________________
14. Scenario Types to Support
1. Asset Recovery
Find + extract
2. Counterintelligence
Identify mole
3. Courier Run
Transport item safely
4. Multi-Team Race
Two teams competing
5. Deep Conspiracy
Long narrative (240m)
Engine should template these.
________________________________________
15. Data Logging (important)
After session:
generate playback:
•	player path map
•	actor movement
•	escalation timeline
•	near misses
•	decision log
Used for:
•	debrief
•	marketing
•	improvement
•	training new M operators
________________________________________
16. The Golden Scenario Formula
Perfect session includes:
•	3 surveillance moments
•	2 actor contacts
•	1 betrayal or twist
•	1 collapse moment
•	1 high-adrenaline extraction
If any missing → feels flat.

