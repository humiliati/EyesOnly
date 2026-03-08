ENVIRONMENT GATE CONTRACT
& Procedural Generation Roadmap
Gone Rogue — Sandpoint ARG
Version 1.0 — March 2026
Biome-Specific Gate Standards • Asset Scene Designer Pipeline • Floor State Tracking • Respawn Rules
 
 
1. Overview
This document defines the canonical gate contract for Gone Rogue: how environmental gates are visually represented per biome, how they interact with the player, how they behave on floor revisits, and how the procedural generator should place them. It also specifies fixes for existing tutorial floor gate issues and outlines the asset scene designer pipeline for creating composite gate tiles.
Core Principle: Every gate must cover the full span of the passage it guards. A gate that leaves walkable tiles around it is not a gate — it is decoration.
2. Gate Taxonomy
All gates in Gone Rogue fall into one of four categories, each with distinct interaction patterns and visual signaling.
2.1 Breakable Gates (Tier 1)
The default gate type. The player attacks the gate to break through. Each biome uses a standard breakable emoji. HP scales with floor difficulty. Visual signal: single biome-standard emoji.
2.2 Locked Gates (Tier 2)
Requires a specific key item to unlock. The gate is visually distinguished from breakable gates by a composite tile (base gate emoji + lock overlay). Visual signal: asset scene composite of gate + lock emoji.
2.3 Mechanism Gates (Tier 3)
Requires interaction with a remote mechanism (lever, button, pressure plate) to open. The gate itself cannot be attacked or unlocked directly. Visual signal: asset scene composite of gate + mechanism emoji.
2.4 NPC Gates
A friendly or hostile NPC blocks passage. Cleared through combat or dialogue. These are NOT environmental gates — they use the NPC gate system (npc-gate-system.js) and are outside the scope of this contract.
3. Biome Gate Emoji Standards
Each biome defines a palette of gate emojis for Tier 1 (breakable), Tier 2 (locked), and Tier 3 (mechanism) gates. The base emoji is used standalone for breakable gates. Composite tiles are created in the Asset Scene Designer by layering the base + modifier emoji.
3.1 Cozy Forest (FOREST)
Gate Type	Emoji	Composite	HP/Req	Description
Breakable (wood)	🚧	—	2–4 HP	Wooden barricade. Standard forest gate.
Breakable (vine)	🌱	—	1–2 HP	Overgrown vine wall. Weaker alternative.
Locked (wood)	—	🚧+🔒	Rusty Key	Barricade with padlock overlay. Requires key.
Locked (vine)	—	🌱+🌱	Vine Key	Dense double-vine. Requires vine cutter.
Mechanism	—	🚧+⚙️	Lever	Barricade with gear overlay. Needs lever pull.

3.2 Grey Cave (GREY_CAVE)
Gate Type	Emoji	Composite	HP/Req	Description
Breakable (rocks)	🪨	—	3–5 HP	Loose rock pile. Cave standard.
Breakable (web)	🕸️	—	1–2 HP	Thick spider web. Weaker alternative.
Locked	—	🪨+🔒	Cave Key	Sealed rock wall with lock mechanism.
Mechanism	—	🪨+🛎️	Button	Rock slab with pressure plate.

3.3 Commercial Office (OFFICE)
Gate Type	Emoji	Composite	HP/Req	Description
Breakable (filing)	🗄️	—	2–4 HP	Toppled filing cabinets blocking the hall.
Breakable (boxes)	📦	—	1–3 HP	Stacked cardboard boxes.
Locked	—	🗄️+🔐	Keycard	Locked filing blockade. Requires keycard.
Mechanism	—	🗄️+🖥️	Terminal	Security terminal override required.

3.4 Shopping Mall (MALL)
Gate Type	Emoji	Composite	HP/Req	Description
Breakable (cart)	🛒	—	2–4 HP	Overturned shopping carts.
Breakable (shelf)	🗃️	—	3–5 HP	Collapsed store shelving.
Locked	—	🛒+🔒	Store Key	Chained carts with padlock.
Mechanism	—	🛒+🔔	Bell/Alarm	Alarm-rigged barricade. Disarm first.

3.5 Industrial Complex (INDUSTRIAL)
Gate Type	Emoji	Composite	HP/Req	Description
Breakable (barrel)	🛢️	—	3–6 HP	Stacked industrial drums.
Breakable (crate)	📦	—	2–4 HP	Heavy shipping crates.
Locked	—	🛢️+⛓️	Bolt Cutter	Chained barrels. Requires bolt cutter.
Mechanism	—	🛢️+🔧	Wrench	Valve-locked pipe barricade.

3.6 Aerospace Museum (AEROSPACE)
Gate Type	Emoji	Composite	HP/Req	Description
Breakable (panel)	🛡️	—	4–7 HP	Dislodged hull panels. Toughest base gate.
Breakable (glass)	🪟	—	1–2 HP	Cracked display case glass.
Locked	—	🛡️+🔐	Access Card	Security-sealed bulkhead panel.
Mechanism	—	🛡️+📟	Control Console	Automated blast door. Console override.

4. Full-Span Gate Rule
Cardinal Rule: A gate MUST occupy every walkable tile in the passage it guards. If a passage is 4 tiles wide, the gate must be 4 tiles wide. Any tile left open is a bypass and the gate serves no gameplay purpose.
4.1 Template Floor Gate Placement
For template (contrived) floors, the gate span is determined by the passage geometry in the layout. The floor designer MUST count the walkable tiles in the narrowest cross-section of the passage and configure that many gate tiles.
Current Bug — L Marker Mismatch: Floors 2 and 3 use 'L' template markers at 4 positions each (e.g., columns 18–21 on row 8), but the gate configs only instantiate 2-tile gates (columns 19–20). The 'L' markers become EMPTY tiles in the parser, creating 2-tile bypasses on each side. Fix: expand gate configs to cover all 4 positions, or narrow the passage to match the gate width.
4.2 Procedural Floor Gate Placement
The procedural generator must measure the passage width at the chosen gate location and spawn gate tiles for every walkable column. The gate placement function should scan the cross-section perpendicular to the path, find every EMPTY tile bounded by WALL on both ends, and fill the entire span with gate tiles.
Algorithm: For a horizontal passage at row Y, scan columns left-to-right. Find the first WALL after EMPTY tiles and the last WALL before EMPTY tiles. Fill everything between with gate tiles.
5. Asset Scene Designer Pipeline
Composite gate tiles (Tier 2 locked gates, Tier 3 mechanism gates) are created using the Asset Scene Designer tool. This pipeline produces layered emoji compositions where multiple emojis overlap on a single game tile, creating visually distinct gate variants that players can learn to recognize.
5.1 Layer Structure
The Asset Scene Designer uses three z-layers for composition:
•	Base Layer (z:0): The biome-standard gate emoji (e.g., 🚧 for Forest). This is the same emoji used for Tier 1 breakable gates, providing visual continuity.
•	Surface Layer (z:4): The modifier emoji (e.g., 🔒 lock, ⚙️ gear). Positioned with slight offset to create an overlapping composite effect.
•	Floating Layer (z:8): Optional sparkle, glow, or animation indicator for active mechanism gates.
5.2 Authoring Workflow
1. Open the Asset Scene Designer (asset-designer.html). 2. Select the base gate emoji from the biome palette. 3. Add the modifier emoji on the surface layer with density 1 (single instance, centered). 4. Adjust scatter and position offset to achieve desired overlap. 5. Use the density tester to preview at game scale. 6. Export to the Asset Cluster Registry with a naming convention: gate_{biome}_{tier} (e.g., gate_forest_locked, gate_cave_mechanism).
5.3 Registry Integration
Exported composite gate assets are stored in the Asset Cluster Registry (asset-cluster-registry.js) and referenced by the gate system modules. The biome-gate-system.js module queries the registry by biome ID and gate tier to retrieve the correct composite asset at floor generation time.
6. Tutorial Floor Fix Specifications
6.1 Floor 2 — Hourglass Gate
Problem: The hourglass passage at row 8 is approximately 20 tiles wide. The current tutorialGate config places a 2-tile gate at positions (19,8)–(20,8), leaving 18 tiles of walkable bypass. The 'L' markers at positions 18–21 suggest a 4-tile gate, which is still insufficient.
Fix: Redesign the hourglass narrowing to create a proper 3–4 tile bottleneck. The passage walls must pinch inward at row 8 so that the gate tiles fully block the only path. Move the wall tiles at row 8 to columns ~18 and ~22, creating a 4-tile opening filled entirely by the gate. Update the tutorialGate config to cover positions (18,8) through (21,8).
6.2 Floor 3 — Wall Funnel Gate
Problem: Floor 3 has a lockedGate at (20,9)–(21,9), but the passage marked with 'L' at positions 18–21 is 4 tiles wide, leaving 2-tile bypasses. More critically, there is no player incentive to engage this gate — the key (Marked Crate at 10,9) is behind the same wall structure, requiring the player to break a breakable just to get the key to open the gate that guards nothing of clear value beyond it.
Fix: 1. Expand the locked gate to cover all 4 positions (18–21, row 9). 2. Place a visible reward or story-critical item behind the gate to create incentive. 3. Ensure the keyBreakable (Marked Crate) is accessible without requiring the player to solve a separate puzzle first — move it to a position on the player's natural path. 4. Consider adding a visual teaser: the player can SEE the reward through the gate before finding the key.
6.3 Floor 1 — Wooden Gate (Reference)
Floor 1's 3-tile wooden gate at (18–20, row 14) correctly covers its passage span and serves as the first breakable gate tutorial. No changes needed. This is the reference implementation for proper gate placement.
7. Floor State Tracking System
A new module or extension to the existing DoorContractSystem must track per-floor state across visits. This prevents broken gates from reappearing when the player backtracks and enables differential respawn behavior.
7.1 FloorStateTracker Module
New IIFE module: floor-state-tracker.js. Maintains a map of floorId → state objects persisted for the duration of a run.
•	destroyedGates: Array of { x, y, gateType } for gates the player has broken or unlocked. On floor revisit, these positions remain EMPTY — the gate is NOT respawned.
•	destroyedBreakables: Array of { x, y, breakableType, originalLootTable } for breakables (crates, barrels, etc.) the player has smashed. On revisit, these respawn with a degraded loot table (see Section 8).
•	visitCount: Number of times the player has entered this floor. Used to scale enemy respawn difficulty and breakable loot degradation.
•	unlockedDoors: Array of { x, y } for building interior doors the player has already entered. Relevant for building interior access sensitivity (see Section 9).
7.2 Gate Respawn Rules
Element	First Visit	Subsequent Visits
Breakable Gate	Full HP, standard loot	NEVER respawns. Position remains EMPTY permanently.
Locked Gate	Requires key	NEVER respawns. Position remains EMPTY permanently.
Mechanism Gate	Requires mechanism	NEVER respawns. Position remains EMPTY permanently.
Breakable Object	Full HP, standard loot	Respawns with reduced HP and degraded loot table.
Enemies	Full spawn table	Dynamic respawn: fewer enemies, weaker variants.

8. Breakable Respawn Rules
When a player revisits a floor, previously destroyed breakable objects (crates, barrels, etc. — NOT gates) respawn in their original positions but in a degraded state. This provides some reason to revisit floors while preventing the player from farming high-value loot.
8.1 Degradation Formula
HP: Respawned breakables have 1 HP regardless of original HP. They are trivially destroyed.
Loot Table: Each visit multiplies the loot table quality by a decay factor. Visit 2: 50% chance of any loot, quality tier reduced by 1. Visit 3+: 25% chance of any loot, quality tier reduced by 2. Common consumables only — no keys, no quest items, no equipment.
Visual Signal: Respawned breakables use a dimmed or "worn" visual variant. The Asset Scene Designer can produce these by adding a translucent grey overlay on the floating layer.
8.2 Quest Item Protection
Breakables that originally contained quest items (keys, story items) are NEVER respawned. Their positions remain EMPTY after the first destruction. This prevents duplicate quest item generation and softlock conditions.
9. Dynamic Enemy Respawn
When the player revisits a previously cleared floor, enemies respawn at reduced density to maintain gameplay tension while not punishing backtracking.
9.1 Respawn Density
Visit 2: 50% of original enemy count. Selected randomly from original spawn positions.
Visit 3: 30% of original enemy count.
Visit 4+: 20% of original enemy count (floor minimum: 1 enemy if the floor originally had enemies).
9.2 Respawn Quality
Respawned enemies are drawn from the same biome enemy pool but shifted one tier lower than the floor's standard difficulty. This makes backtracking feel like returning to familiar, now-easier territory rather than a fresh challenge.
10. Building Interior Access Sensitivity
Players may need to backtrack through cleared floors to reach building interiors they previously skipped. The floor state system must ensure this experience is smooth and not punishing.
10.1 Cleared Path Guarantee
All gates on the player's path between the retreat door and any building entrance remain permanently cleared. The floor state tracker's destroyedGates array ensures these positions stay EMPTY on revisit. The player walks through empty doorframes where gates once stood.
10.2 Building Door State
Building interior doors are NEVER gated on revisit. Once a player has seen a building entrance, the building door emoji and interaction remain available regardless of floor revisit state. Building doors are tracked separately from environmental gates.
10.3 Enemy Avoidance Path
Respawned enemies should preferentially spawn AWAY from the direct path between the retreat door and building entrances. The respawn position selection algorithm should weight positions further from building door tiles to minimize forced combat during building access runs.
 
11. Procedural Generation Roadmap
The following phases implement the gate contract into the existing module architecture. Each phase builds on the previous and can be verified independently.
Phase 1: Floor State Tracker Module
Create: floor-state-tracker.js (~150 lines)
•	IIFE module following established satellite pattern (stateless, ctx-driven)
•	Owns _floorStates map: floorId → { destroyedGates[], destroyedBreakables[], visitCount, unlockedDoors[] }
•	API: recordGateDestroyed(floorId, x, y, type), recordBreakableDestroyed(floorId, x, y, type, lootTable), incrementVisit(floorId), getFloorState(floorId), resetAll()
•	Wire into gone-rogue.js ctx factories: _playerInteractionCtx, _floorTransitionCtx
•	Verify: Break a gate on Floor 1, advance to Floor 2, retreat to Floor 1 — gate position should be EMPTY.
Phase 2: Tutorial Floor Gate Fixes
Edit: tutorial-floors.js, tutorial-floor-gen.js
•	Floor 2: Narrow the hourglass passage walls at row 8 to create a 4-tile bottleneck. Update tutorialGate config to cover all 4 positions.
•	Floor 3: Expand locked gate to 4 tiles. Relocate keyBreakable to player's natural path. Add visible reward behind gate.
•	Remove all 'L' template markers — replace with WALL tiles where passage should be blocked or EMPTY where gate tiles will be placed programmatically.
•	Verify: Play through Floors 0–3 — all gates cover full span, no bypasses, key is on natural path.
Phase 3: Biome Gate Emoji Registry
Create: gate-emoji-registry.js (~100 lines)
•	IIFE module: maps biomeId → { breakable: [emojis], locked: [compositeIds], mechanism: [compositeIds] }
•	Populated from the biome gate emoji standards defined in Section 3 of this document
•	Query API: getBreakableEmoji(biomeId), getLockedComposite(biomeId), getMechanismComposite(biomeId)
•	Wire into biome-gate-system.js to replace hardcoded emoji references
•	Verify: Generate floors in each biome — gates use correct biome-specific emojis.
Phase 4: Asset Scene Designer Composite Gate Assets
Author: Composite gate assets for all 6 biomes using Asset Scene Designer
•	Create locked gate composites (base + lock emoji) for each biome: 6 assets
•	Create mechanism gate composites (base + mechanism emoji) for each biome: 6 assets
•	Create degraded breakable overlays (dimmed variant) for each biome: 6 assets
•	Export all to Asset Cluster Registry with gate_{biome}_{tier} naming convention
•	Verify: Visual inspection of all 18 composite assets at game scale in density tester.
Phase 5: Full-Span Procedural Gate Placement
Edit: biome-gate-system.js, floor-generator.js
•	Implement passage-width scanning algorithm: given a gate position, scan perpendicular to path direction and fill the entire WALL-to-WALL span
•	Update placeTutorialGate() and placeBiomeGates() to use span-filling logic
•	Add gate type selection: floors 4–6 use breakable only, floors 7–10 introduce locked gates, floors 11+ introduce mechanism gates
•	Verify: Generate 20 procedural floors — every gate covers its full passage span, no bypasses.
Phase 6: Respawn Integration
Edit: floor-gen-core.js, tutorial-floor-gen.js, gone-rogue.js
•	After floor generation, check FloorStateTracker for existing state
•	Remove destroyed gates from the generated grid (set positions to EMPTY)
•	Respawn breakables with degraded HP and loot tables per visit count
•	Respawn enemies at reduced density, shifted away from building door positions
•	Verify: Full backtracking playthrough: break gates, advance 3 floors, retreat back — gates gone, breakables degraded, enemies reduced, building access clear.
12. Module Dependency Graph
The following shows the load order and dependency relationships for gate-related modules. All new modules follow the established IIFE satellite pattern.
Module	Depends On	Depended On By
floor-state-tracker.js	(none — standalone)	floor-gen-core.js, tutorial-floor-gen.js, gone-rogue.js (ctx)
gate-emoji-registry.js	(none — standalone)	biome-gate-system.js, tutorial-floor-gen.js
asset-cluster-registry.js	(none — standalone)	gate-emoji-registry.js, biome-visual-facade.js
biome-gate-system.js	gate-emoji-registry.js, floor-state-tracker.js	floor-gen-core.js
door-contract-system.js	(none — standalone)	floor-gen-core.js, tutorial-floor-gen.js, gone-rogue.js (ctx)

13. Phase Dependencies
Phases 1 and 3 are independent and can be developed in parallel. Phase 2 depends on Phase 1 (floor state tracking needed for gate destruction recording). Phase 4 is independent (art authoring). Phase 5 depends on Phase 3 (needs emoji registry). Phase 6 depends on Phases 1, 3, 4, and 5.
Phase 1	Phase 2	Phase 3	Phase 4	Phase 5	Phase 6
State Tracker	Tutorial Fixes	Emoji Registry	Asset Authoring	Full-Span Proc	Respawn Integ.
Independent	Needs Phase 1	Independent	Independent	Needs Phase 3	Needs 1,3,4,5

— End of Document —
