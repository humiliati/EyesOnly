Still needed (future work):

Unify the two drag systems — the pointer-hold targeting and HTML5 drag should be one system, not two fighting systems. The pointer-hold targeting's ground effect deployment and enemy targeting should integrate with the HTML5 drag's ghost/placeholder visuals.
Resolution animation guards — _playResolutionSequence should force-maximize the STR window and restore the fan to combat/centered before running the lunge animations, so the visual sequence works regardless of what state the window was in.
Edge case: maximize during resolution — if dragend fires during _resolutionAnimRunning, the deferred mode restore + STR maximize could fight the resolution animation. Need a guard: skip deferred mode application if resolution is in progress.

let's make an environment gate contract document and corresponding proc gen roadmap that requires the use of standard, biome relevant emojis for breakable gates. so that each biome has a specified emoji to use during a breakable gate and variant emoji standards which require tier2keys or buttons or levers. We should make a pipeline out of the utilization of our scene asset designer to make gates (and other interactables) that combine 🚧+🔒 emojis overlapping on the same tile so that a player who's used to seeing 🚧 gate emoji breakables knows that the assetscene🚧🔒 is going to be requiring a different approach. see asset-designer.html

floor 3 the wall funnel doors and gate need to be reworked, there's no incentive for the player to handle this gate
the breakable gate emojis need definition per biome, for cozy forest we use 🚧 or assetscene🚧🔒 or 🌱 or assetscene🌱🌱
floor 2 the gate needs to cover the span
our door contract or some other module needs to track previous floors and not respawn previous gates, we should have dynamic enemy respawning on previous floors, breakables respawn (almost) empty with a crappier loot table on the way back. it should be sensitive though to players who travelled back to enter the nested interior of a building without trashing their breakables