Problem: when we exit a building interior ( especially floor 1.2, 1.3 -> floor1 transition of the tutorial floors ) we are deposited on the floor 1 near the advancefloordoor instead of being spawned in on floor1 near the door we entered/exited the building from

Deliverable: if we enter a building from floor1 into door 1.2a of a building, when we exit through door 1.2a we are deposited back on floor 1 near the door of building 1.2a
if we enter a building from floor1 into door 1.2a of a building, when we exit through door 1.2b we are deposited back on floor 1 near the 1.2b "back door" (this feature needs to be explicit for WBE roadmap to tie buildings together across floor tiles to bypass and funnel players).

Problem: during str combat when we minimize the str combat window with the toggle arrow in the top right, the equipped hand cards stay visible in the middle of the screen.

Deliverable:
During str combat if the player click/tap+drags on a card it is to lift out of the players hand with a placeholder and be able to be dragged around within the str combat frame, when the player moves the card drag operation to the exterior of the str combat frame after a brief delay the str combat frame and the hand fan component minimize to their respective minimized states while the player holds on to the card. If the player deploys the card to the map its spot that was held open in the hand fan component collapses as the hand fan component maximizes with the str-combat window.

What's happening visually: there's no dragging of a card happening unless the card is BLVCK. The blvck card isn't supposed to be draggable, all the other cards are supposed to be draggable. As the blvck card starts dragging for a second it stops and releases and returns from the hand (which is correct for that specific less interactive card)

Problem: when the player breaks a breakable and it yields multiple contents, particularly ammo, currency, and a key, and or key ammo. Instead of the collectibles all picking up simultaneously in their prioritized tight overlapping stack per OVERHEAD unification, a few pickup simultaneously with their animations TOTALLY overlapping and obscuring eachother, sliding off at different unrelated rates in different directions totally antithetical to the design document. The other items remain on the ground and the player has to pass over that tile again to collect them.

Problem: when a player picks up key ammo it appears to be overhead animating as an item and tool tipping as an item.

Key ammo key_ammo tier1keys are resources to be displayed only as monochromatic symbols and pickup as ammo, currency, batteries and other resources rendered in the debreif feed without tool tips that imply the key-ammo is going into the inventory or is related to key items.


Problem: when a breakable is broken and it yields its contents they are all stacked on the same tile.
Deliverable breakables with multiple contents shoud spread their contents out across their single tile and if the number of collectibles exceeds 3 the 4th spills into and adjacent tile with awareness to walls and other impassable obstacles

Problem: when an enemy is defeated (particularly tutorial test floors) its not clear if theyre giving any loot. At some point enemies had a loot popping function where the player has to chase it with corresponding items that magnetically attract collectibles. We want to ensure our entire enemy to loot pipeline stamps out enemies that have uniform loot spilling behavior into adjacent tiles after combat has resolved. If the player is defeated we need the player character to animate like a broken collectible and disappear, dropping their deck, equipped hand, currency, ammo, batteries, and their most recent picked up food emojis dramatically.

Problem: floor 3 npc is not interactive
