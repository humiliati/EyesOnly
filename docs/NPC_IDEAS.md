1. What file type an emoji actually is

“Emoji” are not a single file format. They exist in three common forms:

Unicode glyph in a font

File types: .ttf, .otf, .woff2

Examples: Apple Color Emoji, Noto Color Emoji

Each emoji is a glyph inside a font file mapped to a Unicode codepoint.

Color vector emoji (modern systems)

Encoded inside fonts using formats like:

SVG-in-OpenType

COLR/CPAL

Internally these are SVG vector drawings.

Sprite images (what most games actually use)

File types:

.png

.webp

sprite sheets

This is what Discord, Slack, and most game engines use.

For a game engine, you almost always want PNG sprites.

2. The easiest pipeline for making your own emoji

A simple production pipeline used in games:

Draw vector → export PNG → pack sprite atlas → render

Tools that work well:

Vector creation

Illustrator

Figma

Inkscape (free)

Pixel / export

Aseprite

Photoshop

Krita

Sprite packing

TexturePacker

Free: aseprite --sheet

Game engine built-in atlas tools

Recommended base size:

128x128
or
256x256

Then downscale in-engine.

3. The real problem you’re solving

You are doing something clever but tricky:

You are using emoji as world actors in a pseudo-3D skewed map.

Once the north tiles skew, the illusion becomes:

south = facing camera
north = facing away from camera

Which means your character sprite needs directional facings.

Classic solution used by Ultima / Rimworld / Stardew / early roguelikes:

4-direction sprite set
south  (front)
north  (back)
east   (side)
west   (side flipped)

For emoji-style characters:

🙂  front
🙂‍🦱 back (hair + shoulders)
🙂  side

But the trick is designing the BACK sprite correctly.

4. How to design a “facing away” emoji

You don’t rotate the emoji.

You draw a new sprite.

Design rules that make it read correctly:

1. Remove the face

Back view:

head circle
hair
ears maybe
neck
shoulders

No eyes.

2. Shift the shoulders wider

Back silhouettes are slightly wider.

   O
  / \
 /   \

3. Add hair / hat silhouette

Hair is the easiest way to sell a back view.

Examples:

Front:   🙂
Back:    🟤 (hair blob)

4. Tilt the top of the head slightly

Because your north tiles are skewed.

Example silhouette:

   __
 /    \
|      |
 \____/

Slight top compression helps match perspective.

5. The extremely cheap trick many games use

You don't even need a real back sprite.

Use a back-of-head emoji style:

Front: 🙂  
North: 🧑‍🦲 (hair circle)

Implementation:

if direction == north:
    hide face layer
    show hair layer

Layered emoji components:

head
face
hair
body

North = hide face.

Very cheap.

6. Even cheaper: shadow trick

Roguelikes sometimes fake away-facing with:

darkened sprite

When walking north:

sprite.scaleY = 0.92
sprite.brightness = -10%

It reads subconsciously as “back”.

7. Best approach for your engine

Since your game already uses emoji-like assets, I recommend:

5 piece modular characters

head
face
hair
torso
legs

Direction logic:

south:
  show face

north:
  hide face
  widen shoulders
  slightly squash head

east/west:
  rotate torso slightly

You can generate thousands of NPCs cheaply.

This aligns perfectly with your procedural NPC system.

8. Bonus trick used in Rimworld / Project Zomboid

Characters lean forward when walking north.

Tiny transform:

sprite.y -= 2
sprite.scaleY = 0.94

Your brain reads it as depth.

9. If you want the real magic solution

There is a trick used in modern roguelikes that might fit your engine perfectly:

Billboard heads

Head is always camera-facing.

Body rotates.

   🙂   <- always front
  /|\
  / \

Even when walking north.

This preserves emoji readability.

10. My recommendation for your project

Given your engine constraints:

Use 3 facings only

front
side
back

Back = no face + hair blob.

This costs almost nothing in art time and sells the illusion.

If you'd like, I can also show you a very powerful trick used by Dwarf Fortress and Rimworld that lets you generate infinite NPC appearances from only ~12 emoji parts while still supporting directional facings. It fits extremely well with the procedural NPC ontology system you described earlier.

how can we generate infinte npc appearances from only ~12 emoji parts if we are showing the back with a darkened render and a tiny transform

What you want is basically Rimworld-style pawn generation but simplified into an emoji modular stack.
Because the north-facing state hides the face and darkens the sprite, you get a huge combinatorial multiplier essentially “for free”.

The trick is to separate identity layers from render layers.

1. The core idea

Instead of making full sprites, build each NPC from stacked emoji components.

Example stack:

[Hair]
[Head]
[Face]
[Torso]
[Legs]
[Accessory]

Each layer is just a small emoji-like asset.

If you only have ~12 parts per category:

hair:        12
faces:       12
torsos:      12
legs:        12
accessories: 12

Possible characters:

12 × 12 × 12 × 12 × 12 = 248,832

That’s before color variation.

2. The key trick your system already enables

Because north-facing hides the face, half the combinations never need to visually match.

Example NPC:

hair: spiky
face: beard
torso: jacket
legs: jeans

Facing south:

🙂
🧥
👖

Facing north:

(hair only)
darkened torso
darkened legs

The face disappears, which:

• removes uncanny combinations
• increases perceived variety

3. Minimal 12-part emoji kit

You can get huge variety with only these:

Hair (6–12)
short
long
bun
afro
ponytail
bald
cap
hood
helmet
Face (6–12)
neutral
happy
tired
beard
mustache
scar
eye patch
mask
Torso (6–12)
shirt
jacket
coat
armor
robe
vest
dress
Legs (4–8)
pants
shorts
robe
armor
skirt
Accessory (optional)
backpack
sword
lantern
book
crate
nothing
4. Why the back-view trick works so well

Your north travel rule:

darken sprite
slightly squash
hide face

means the viewer only sees:

hair silhouette
shoulder silhouette
body color

So many characters that looked similar from the front become distinct silhouettes from behind.

This multiplies perceived variety.

5. Tiny procedural mutations (huge payoff)

Add very small random transforms:

scaleX: 0.95 – 1.05
scaleY: 0.95 – 1.05
hue shift: ±5°
brightness: ±5%

This alone multiplies visual diversity massively.

Example:

npcA: jacket + jeans
npcB: jacket + jeans

npcA scaleX 0.96
npcB scaleX 1.04

They read as different body types.

6. Silhouette is the real generator

Players recognize NPCs by silhouette first, not detail.

So ensure parts alter outline:

Good silhouette parts:

wide hat
cape
long coat
big hair
backpack
shoulder armor

Bad parts:

tiny chest logos
small color swaps
7. How roguelikes secretly do this

Games like Rimworld and Project Zomboid effectively do:

pawn = hash(seed)

hair      = hairSet[seed % hairCount]
face      = faceSet[(seed >> 4) % faceCount]
torso     = torsoSet[(seed >> 8) % torsoCount]
legs      = legSet[(seed >> 12) % legCount]
accessory = accSet[(seed >> 16) % accCount]

NPC identity is deterministic from one seed.

So:

npcID → appearance

Always reproducible.

8. Rendering logic for your engine

Pseudo-pipeline:

if direction == NORTH:

  hide(face)

  sprite.darkness = 0.85
  sprite.scaleY = 0.96

else:

  show(face)
  sprite.darkness = 1.0

That's it.

9. The huge trick that makes this feel infinite

Give jobs unique torso parts.

Example:

miner -> helmet + overalls
merchant -> robe
guard -> armor
farmer -> straw hat

Players then perceive:

role + silhouette

instead of raw randomness.

10. Why this works extremely well with emoji

Emoji are already iconographic silhouettes, which means:

• they read at tiny sizes
• they layer cleanly
• they survive rotation / skew

So they behave almost exactly like Rimworld pawns, just cuter.

✅ With ~12 parts per layer you can easily reach:

200k – 1M perceived NPC variants

with only ~60 total assets.