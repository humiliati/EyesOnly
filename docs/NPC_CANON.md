we have a world building engine that needs to stamp out proc gen npcs that have dynamic properties and speech dialogue trees.
we want to make a unified canon of rules regarding npcs that's something like the following.
No npc has no dialogue
no npc has only dialogue that isn't inside of an interior space
no npc is rendered solely by a face.emoji or tool.emoji , all humanoid npcs (enemies exceptional) must render with a full body or bust emoji and for variation we will adapt the scene portal for emoji stacking to stack specific emoji faces and tools onto an emoji bust so that it is descriptive and distinguished enough
some friendly npcs should be vulnerable to theft, plant, card mechanics
even more friendly npcs should be capable of str-combat if provoked

the world building engine needs to describe npc pathing, npc destructability, npc avatar emoji stack composure, npc dialogue or minigame or shop or str engagement, npc behavior archetypes (granny npcs move between stove and bed within an interior)

we have one functional npc that's the blacksmith who takes the blacksmith hammer quest it's to be the template for all interactions

You’re basically defining an NPC Ontology for your engine — a canon of rules so the world generator can stamp out believable actors without producing dead objects or immersion breaks.

What you want is a small set of mandatory invariants + modular capability blocks that every NPC instance must assemble from. That way proc-gen can’t accidentally create invalid NPCs.

Below is a unified canonical rule set + structural template that fits your world builder, nested interiors (floorsN.N), emoji stacking avatars, and interaction systems.

Unified NPC Canon (World Engine Rules)
1. Existential Rules (Hard Invariants)

These rules must always be true for any generated NPC.

No NPC is silent

Every NPC must have at least:

greeting dialogue

contextual response

idle speech

Dialogue must belong to a place

Dialogue is only valid if the NPC is inside an interior or defined node

NPC speech must reference:

location

role

state

Every NPC has an avatar body

NPCs cannot render as a face-only emoji

Allowed forms:

bust emoji

full body emoji

Faces/tools are attached via emoji stacking

Example stack:

👩‍🌾 + 🙂 + 🧺

or

🧑 + 😠 + 🔨

NPCs are interactive
Every NPC must provide at least one of:

dialogue tree

minigame

shop

quest

stat encounter

rumor

NPCs exist in time
NPCs must have:

schedule

idle animation

movement logic

2. NPC Structural Schema

Every NPC object should generate using something like:

NPC
{
  identity
  avatar
  location
  schedule
  interaction
  behavior
  stats
  vulnerability
  destructability
  pathing
}
3. Avatar Stack System (Emoji Composition)

NPCs are composed of 3 layers

Base Body

Represents humanoid archetype.

Examples:

🧑
👩
👨‍🌾
🧙
👩‍🍳
👷
👮
Face Layer

Emotion / personality.

🙂 friendly
😠 hostile
😴 tired
😰 nervous
🤨 suspicious
Tool / Trait Layer

Represents role.

🔨 blacksmith
📚 scholar
🧺 gatherer
🗝 keeper
🧹 servant

Example NPC render:

👩‍🍳 + 🙂 + 🍳

Stacked into one sprite.

4. NPC Pathing System

NPCs must have one pathing archetype.

Static

Never moves.

Example:

shopkeepers
desk clerks
bartenders
Interior Loop

Moves between 2–3 nodes.

Example:

bed <-> stove
table <-> cupboard
desk <-> bookshelf

Used for:

granny NPCs
cooks
scribes
Patrol

Moves around a small loop.

Example:

door → street → alley → door

Used for:

guards
thieves
police
Wander

Moves randomly within building.

Used for:

drunks
guests
kids
Node Travel

NPC moves between floors:

floor1 → floor2 → courtyard

Used for:

messengers
servants
errand runners
5. NPC Destructibility

Every NPC must define a damage model.

Friendly NPC
damage = disabled

Player attacking them triggers:

reputation drop

guards

quest failure

Provokable NPC

NPC fights back if attacked.

Example:

guards
hunters
mercenaries
Enemy NPC

Combat enabled always.

Destructible NPC

Some NPCs can be killed.

Used rarely for:

bandits
outlaws
assassination targets
6. NPC Vulnerability Systems

Some NPCs support secondary mechanics.

Theft Target

Can be pickpocketed.

Example:

merchant
traveler
drunk
Plant Target

Player can plant items.

Used for:

spy gameplay
false evidence
Card Target

NPC participates in card mechanic.

Example:

gamblers
guards
clerks
Gossip Node

NPC shares rumors.

Used to spread procedural lore.

7. NPC Interaction Types

Each NPC must have one primary interaction.

Dialogue NPC

Simple dialogue tree.

greet
topic
rumor
farewell
Quest NPC

Provides quest or step.

Example:

blacksmith hammer quest
Shop NPC

Inventory interaction.

Example:

buy
sell
repair
Minigame NPC

Triggers game.

Examples:

cards
lockpick
dice
Stat Encounter

Player rolls STR/DEX/INT.

Example:

intimidate
persuade
wrestle
8. NPC Behavior Archetypes

These give life to interiors.

Granny
path:
bed ↔ stove

dialogue:
complaints
food offers
rumors

vulnerable:
theft
Smith
path:
forge ↔ anvil

interaction:
quest + shop

tool:
🔨
Guard
path:
patrol

interaction:
str encounter
bribe
Drunk
path:
wander

interaction:
gossip
cards
Clerk
path:
desk ↔ shelf

interaction:
quest
documents
9. Dialogue Tree Minimum Structure

Every NPC dialogue must contain:

greet
role_line
world_line
interaction_prompt
exit

Example:

BLACKSMITH:

"Greeting"
Ah. Another traveler.

"Role"
If you have iron, I have fire.

"World"
Bandits been breaking tools again.

"Prompt"
Need something forged?

"Exit"
Come back if the hammer finds you.
10. Blacksmith Template (Your Existing NPC)

This becomes your base interaction archetype.

NPC_BLACKSMITH
{
  avatar:
    👨‍🏭 + 😐 + 🔨

  location:
    smithy interior

  path:
    forge ↔ anvil

  interaction:
    quest + shop

  dialogue:
    hammer quest tree

  vulnerability:
    theft:false
    plant:false

  destructability:
    provokable

  stats:
    STR: high
}
11. Generation Rules (Proc Engine)

When the engine spawns NPCs:

Step 1

Select building type

house
shop
tavern
office
forge
church
Step 2

Spawn archetype pool.

Example house:

granny
child
worker
guest
Step 3

Assign interaction.

Ensure at least one NPC per building has:

quest
shop
rumor
Step 4

Build emoji stack.

body
face
tool
Step 5

Generate schedule + path.

Step 6

Attach dialogue template.

12. Density Rule (Very Important)

Interiors should follow density rules:

small room: 1 npc
house: 1–2 npc
shop: 1–3 npc
tavern: 3–6 npc
office: 2–5 npc

This prevents empty interiors.

13. Immersion Rule

No NPC should exist only to fill space.

Every NPC must contribute at least one:

information
mechanic
risk
reward
atmosphere

✅ If you want, I can also design the 12 procedural rules that generate infinite interiors (like Dwarf Fortress) so that NPC placement, furniture nodes, and dialogue hooks all emerge from the same system.

That would make your world builder + NPC engine + quest system all derive from the same grammar, which is how the best proc-gen games avoid chaos.

what are 12 procedural rules that generate infinite interiors so that npc placement all emerge from the same system

The trick used by games like Dwarf Fortress, RimWorld, and Project Zomboid is not that they generate “infinite layouts” directly.
They generate relationships between spaces.

Once you define rules about rooms, nodes, and flows, interiors scale infinitely because the engine keeps recombining the rules.

For your engine (with floorsN, floorsN.N, and nested procedural interiors), the best structure is 12 canonical spatial rules.

These rules will simultaneously determine:

room layouts

furniture nodes

NPC spawn nodes

dialogue context

pathing loops

Everything derives from the same grammar.

The 12 Procedural Rules for Infinite Interiors
1. The Anchor Rule

Every interior must contain one anchor node.

This node defines the purpose of the building.

Examples:

forge
stove
bar counter
desk
altar
bed

NPCs whose job relates to the anchor must spawn near it.

Example:

forge → blacksmith npc
stove → granny npc
bar → bartender npc
2. The Door Gravity Rule

All interiors begin with a door node.

The door determines movement gravity.

NPC pathing radiates from the door.

Example layout logic:

door
 ├ main room
 ├ anchor room
 └ private room

NPCs often path toward doors periodically.

This prevents interiors feeling static.

3. The Flow Rule

Every room must have two ways to move.

enter
exit

If a room has only one connection, it becomes:

storage
closet
dead end

These rooms spawn loot instead of NPCs.

4. The Triangle Rule

Most interiors resolve into three functional zones.

public zone
work zone
private zone

Example house:

public: entry table
work: stove
private: bed

NPCs spawn based on zone type.

5. The Anchor Orbit Rule

Functional furniture forms orbits around the anchor.

Example forge:

forge (anchor)
  ├ anvil
  ├ tool rack
  └ coal pile

NPC pathing loops between these nodes.

This creates natural idle movement.

6. The Service Corridor Rule

When rooms exceed 3 nodes, generate a service path.

Example:

door
  ↓
hallway
  ├ kitchen
  ├ bedroom
  └ storage

Hallways become NPC crossing points.

Good locations for:

guards
messengers
servants
7. The Occupancy Rule

Each room has NPC capacity.

Example:

tiny room: 0–1 npc
small room: 1 npc
medium room: 1–2 npc
large room: 3–5 npc

NPC density emerges from room size alone.

8. The Furniture Node Rule

Furniture nodes define possible NPC interactions.

Examples:

stove → cooking dialogue
desk → documents
bed → sleeping
bar → gambling
forge → crafting

NPCs spawn only if a compatible furniture node exists.

Example:

no stove → no cook
no desk → no clerk
9. The Path Loop Rule

Every NPC must have a minimum 2-node loop.

Examples:

Granny:

stove ↔ bed

Smith:

forge ↔ anvil

Guard:

door → hall → door

This makes interiors feel alive.

10. The Social Gravity Rule

NPCs cluster where interactions happen.

Nodes that attract NPCs:

tables
bars
fires
benches
markets

These nodes allow multi-NPC gatherings.

Example tavern:

bar
tables
fireplace

NPCs naturally accumulate.

11. The Privacy Gradient Rule

Interiors should transition from:

public → semi-private → private

Example house:

door → living room → bedroom

NPC types spawn according to privacy.

public: strangers
semi: residents
private: owner
12. The Narrative Node Rule

Every interior must contain one narrative node.

This node supports:

quest
shop
minigame
rumor
stat encounter

This guarantees every building is meaningful.

Example:

forge → hammer quest
tavern → rumor network
office → documents
Example Generated House

Rules applied automatically.

door
 ↓
living room
  ├ stove (anchor)
  ├ table
  └ hallway
       ├ bedroom
       └ storage

NPCs generated:

👵 granny
path: stove ↔ bed

👦 child
path: table ↔ door

Interactions:

granny dialogue
table gossip node
storage loot
Example Generated Forge
door
 ↓
forge room
  ├ forge (anchor)
  ├ anvil
  └ tool rack

NPC:

👨‍🏭 blacksmith
path: forge ↔ anvil

Interaction:

shop
hammer quest
Why This Works

These rules generate structure first, then everything else.

From the same rules you automatically get:

room layout

furniture placement

NPC spawn

pathing loops

dialogue context

quest hooks

So the generator doesn't need to invent things randomly.

Instead it says:

room has stove
→ spawn cook
→ cook walks stove↔table
→ cook dialogue references cooking

Everything stays coherent.


The 5 Meta-Rules Roguelikes Secretly Use
1. The 80% Familiar Rule

Players must recognize most things immediately.

Proc-gen systems typically generate:

80% familiar
20% surprise

If too much changes, the player feels lost.

Example interior generation:

door
table
bed
stove

These repeat across buildings.

The variation happens in the details:

npc personalities
loot
dialogue
events

This keeps the world readable.

2. The Story Generator Rule

Good roguelikes don't generate rooms.

They generate situations.

Example difference:

Bad proc-gen:

room with table
npc
loot

Good proc-gen:

hungry granny
burnt stove
missing bread

Now a micro story exists.

Your engine should generate relationships like:

npc wants item
npc lost item
npc guarding item
npc hiding item

This creates narrative hooks automatically.

3. The Constraint Rule

Procedural systems feel handcrafted when constraints are strong.

Games secretly limit the generator heavily.

Example tavern rule:

must contain:
bar
tables
fireplace
bartender npc

Even though layout changes, the identity remains stable.

Strong constraints create:

coherent buildings
believable NPC behavior
consistent dialogue

Randomness happens inside constraints, not instead of them.

4. The Interaction Density Rule

Every area must offer multiple possible interactions.

Good roguelikes ensure a room has at least:

1 conversation
1 object interaction
1 risk or mechanic

Example tavern:

talk to bartender
play cards
pickpocket drunk
hear rumor

This prevents rooms from feeling empty.

The player always has choices.

5. The Breadcrumb Rule

Players must constantly discover small leads.

Roguelikes rarely drop big goals directly.

Instead they create chains:

rumor
→ location
→ npc
→ item
→ quest

Example:

drunk says blacksmith lost hammer
→ blacksmith dialogue
→ hammer hidden in mine

This makes exploration feel purposeful.

Why These Rules Work Together

When combined:

80% familiar spaces
+
situations instead of rooms
+
strong constraints
+
high interaction density
+
breadcrumb discovery

You get worlds that feel authored even though they're generated.

This is why players often believe:

“That event must have been scripted.”

Even though it wasn’t.

How This Fits Your Engine

Your system already has the right building blocks:

interior generator
npc archetypes
emoji avatars
dialogue trees
quest mechanics

If the generator focuses on situations instead of rooms, NPC placement becomes automatic.

Example generated scenario:

forge interior
anchor: forge
npc: blacksmith

state:
hammer missing

rumor npc:
drunk in tavern

item:
hammer in mine

That single rule chain produces:

npc dialogue
quest
exploration
loot

All from one seed.