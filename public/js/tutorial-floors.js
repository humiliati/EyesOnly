/**
 * Tutorial Floors System - Contrived Map Generator
 *
 * Provides hand-crafted, designer-controlled floor layouts for Tier 1 Forest Biome
 * tutorial experience (floors 1-3). These floors teach core mechanics through
 * environmental discovery rather than explicit instruction, inspired by original
 * Legend of Zelda's starting area design.
 *
 * Integration: Hooks into GoneRogue._generateFloor() for floors 1-3 only.
 * All other floors continue using procedural generation.
 */

var TutorialFloors = (function() {
  'use strict';

  // Grid dimensions (must match GoneRogue constants)
  var GRID_WIDTH = 40;
  var GRID_HEIGHT = 20;

  // Tile types (matches GoneRogue TILES)
  var TILES = {
    EMPTY: '.',
    WALL: '█',
    PLAYER: '🥷',
    EXIT: '🚪',
    BREAKABLE: '📦',
    DEBRIS: '░'
  };

  /**
   * Floor 1: Village Entrance — Zelda-style 4-zone layout
   *
   * Teaching objectives:
   * - Breakables contain things (break bushes, crates, logs)
   * - Interactive items provide clues (signs, books, mailbox)
   * - Exploration is rewarded (hidden grove, breadcrumb pickups)
   * - Environmental variety (water tiles, bush walls)
   *
   * Layout (4 zones):
   * - Zone 1 (upper-left): Village Hub — buildings, signs, fountain
   * - Zone 2 (upper-right): Garden & Orchard — food, flowers, apple trees
   * - Zone 3 (lower-left): Hidden Grove — behind breakable bush wall
   * - Zone 4 (center-south): Southern Path & Gate — tutorial gate to exit
   */
  var FLOOR_1_LAYOUT = {
    floorNumber: 1,
    name: 'Village Entrance',
    description: 'A peaceful forest village with secrets to discover.',

    // Grid layout template (ASCII representation)
    // '.' = floor, '#' = wall, 'P' = player spawn, 'E' = exit, 'G' = tutorial gate
    // '~' = water tile
    template: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '###...............................P....#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#.................GGG..................#',
      '#......................................#',
      '#..~~..................................#',
      '#...................E..................#',
      '#......................................#',
      '########################################'
    ],

    // Spawn points
    // Spawn near center-left of the main clearing (stable onboarding start)
    player: { x: 6, y: 10 },
    exit: { x: 20, y: 17 },

    // Buildings (visual overlay, impassable)
    // Zone 1: Village Hub — small hamlet in upper-left
    buildings: [
      { x: 4, y: 2, emoji: '🏠', name: 'Village House' },
      { x: 8, y: 2, emoji: '🏠', name: 'Village House' },
      { x: 4, y: 4, emoji: '🏡', name: 'Village Cottage' },
      { x: 8, y: 4, emoji: '⛪', name: 'Village Chapel' }
    ],

    // Building doors (interactive doors leading to building interiors)
    buildingDoors: [
      { x: 8, y: 5, buildingId: 'BLD-002' }
    ],

    // Decorations (visual overlay, walkable)
    decorations: [
      // Zone 1: Village atmosphere
      { x: 6, y: 1, emoji: '⛲', name: 'Fountain' },
      { x: 10, y: 3, emoji: '🏮', name: 'Lantern' },
      // Zone 2: Orchard/garden atmosphere
      { x: 32, y: 3, emoji: '🪑', name: 'Bench' },
      // Zone 3: Hidden grove atmosphere
      { x: 3, y: 15, emoji: '🏮', name: 'Hidden Lantern' },
      // Scene cluster: "two trees and a rock" framing the Hollow Log at (3,13)
      { x: 2, y: 12, emoji: '🌲', name: 'Pine Tree' },
      { x: 4, y: 12, emoji: '🌲', name: 'Pine Tree' },
      { x: 2, y: 14, emoji: '🪨', name: 'Rock' },
      // Scene cluster: "two rocks and a leaf" framing the Wooden Crate at (23,13)
      { x: 22, y: 13, emoji: '🪨', name: 'Rock' },
      { x: 24, y: 13, emoji: '🪨', name: 'Rock' },
      { x: 23, y: 14, emoji: '🍃', name: 'Fallen Leaf' },
      // Scene cluster: "a tree, a leaf, and a flower" framing the Flower Patch at (22,5)
      { x: 21, y: 4, emoji: '🌳', name: 'Oak Tree' },
      { x: 23, y: 6, emoji: '🍃', name: 'Fallen Leaf' },
      { x: 21, y: 6, emoji: '🌸', name: 'Wild Flower' }
    ],

    // Interactive items (use InteractiveItems system)
    interactiveItems: [
      // Zone 1: Tutorial signs & mailbox
      { x: 12, y: 5, type: 'SIGN', emoji: '🪧', name: 'Sign Post',
        text: 'Break bushes to find treasure! Try hitting anything that looks fragile.' },
      { x: 6, y: 3, type: 'SIGN', emoji: '📬', name: 'Mailbox',
        text: 'Welcome to the Cozy Forest village. Explore freely — secrets hide in every corner.' },
      // Zone 2: Orchard sign + berry bush
      { x: 28, y: 2, type: 'SIGN', emoji: '🪧', name: 'Orchard Sign',
        text: 'The orchard keeper left berries for travelers. Help yourself!' },
      { x: 26, y: 4, type: 'FOOD', emoji: '🍎', name: 'Fresh Apple',
        customData: { foodId: 'FOOD_APPLE' } },
      // Zone 1: Water fountain near village
      { x: 10, y: 8, type: 'FOOD', emoji: '💧', name: 'Spring Water',
        customData: { foodId: 'FOOD_WATER' } },
      // Zone 3: Hidden grove snack — moved off the bush breakable at (5,14)
      { x: 4, y: 15, type: 'FOOD', emoji: '🍬', name: 'Forest Candy',
        customData: { foodId: 'FOOD_CANDY' } },
      // Zone 3: Hidden grove discovery
      { x: 7, y: 15, type: 'AREA_OF_INTEREST', emoji: '❓', name: 'Strange Marking',
        text: 'Something glimmers in the undergrowth... Ancient runes are carved into the stone.' },
      // Zone 4: Exit hint
      { x: 17, y: 15, type: 'BOOK', emoji: '📚', name: 'Weathered Journal',
        text: 'The forest grows darker beyond this point. Prepare yourself before venturing further.' }
    ],

    // Water tiles (slow movement, visual variety)
    waterTiles: [
      { x: 3, y: 16 }, { x: 4, y: 16 }, { x: 5, y: 16 }
    ],

    // No locked chests on Floor 1 — keys are introduced on Floor 2
    lockedChests: [],

    // Tutorial gate (blocks path to exit)
    tutorialGate: {
      positions: [
        { x: 18, y: 14 },
        { x: 19, y: 14 },
        { x: 20, y: 14 }
      ],
      emoji: '🚧',
      name: 'Wooden Gate',
      hp: 2,
      message: 'A wooden gate blocks your path. Try breaking it!'
    },

    // Breakable objects — spread across all 4 zones
    breakables: [
      // Zone 1: Village bushes (easy, near spawn path)
      { x: 14, y: 3, emoji: '🌿', name: 'Bush', hp: 1, drops: { currency: [3, 5], cards: 0.2 } },
      { x: 16, y: 7, emoji: '🌿', name: 'Bush', hp: 1, drops: { currency: [3, 5], cards: 0.2 } },
      // Zone 2: Orchard trees & flowers
      { x: 24, y: 2, emoji: '🌳', name: 'Apple Tree', hp: 3, drops: { currency: [5, 10], cards: 0.3 } },
      { x: 28, y: 4, emoji: '🌳', name: 'Apple Tree', hp: 3, drops: { currency: [5, 10], cards: 0.3 } },
      { x: 32, y: 2, emoji: '🌳', name: 'Apple Tree', hp: 3, drops: { currency: [5, 10], cards: 0.3 } },
      { x: 22, y: 5, emoji: '🌸', name: 'Flower Patch', hp: 1, drops: { currency: [2, 4], cards: 0.4 } },
      { x: 35, y: 6, emoji: '🌸', name: 'Flower Patch', hp: 1, drops: { currency: [2, 4], cards: 0.4 } },
      // Zone 3: Hidden grove (breakable bush wall + rewards inside)
      { x: 5, y: 11, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [2, 3] } },
      { x: 5, y: 12, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [2, 3] } },
      { x: 5, y: 13, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [2, 3] } },
      { x: 5, y: 14, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [2, 3] } },
      { x: 3, y: 13, emoji: '🪵', name: 'Hollow Log', hp: 2, drops: { currency: [8, 15], cards: 0.7 } },
      { x: 3, y: 11, emoji: '🧺', name: 'Picnic Basket', hp: 2, drops: { currency: [10, 20], cards: 0.5 } },
      // Zone 4: Near gate
      { x: 23, y: 13, emoji: '📦', name: 'Wooden Crate', hp: 2, drops: { currency: [5, 10], cards: 0.5 } }
    ],

    // Breadcrumb pickups — small currency rewards along paths between zones
    breadcrumbPickups: [
      // Path from spawn toward village
      { x: 25, y: 9, amount: 3 },
      { x: 20, y: 8, amount: 3 },
      // Path from village toward orchard
      { x: 18, y: 3, amount: 3 },
      { x: 21, y: 3, amount: 3 },
      // Path toward gate
      { x: 20, y: 12, amount: 5 }
    ],

    // Tutorial pickups (behind gate, guaranteed rewards)
    tutorialPickups: [
      { x: 20, y: 16, type: 'currency', amount: 50 },
      { x: 19, y: 16, type: 'card', guaranteed: true }
    ],

    // No enemies
    enemies: [],

    // Border style
    border: {
      thickness: 1,
      style: 'natural', // Mix of tree emojis
      tiles: ['🌳', '🌲', '🪨']
    },

    // Tutorial highlight: nearest breakable to spawn gets ❗ pulse on floor load
    firstBreakableHighlight: { x: 14, y: 3 }
  };

  /**
   * Floor 2: The Gate — breakable barricade (projectile tutorial)
   *
   * Teaching objectives:
   * - Breakables can block progress (and can be cleared with normal attacks/projectiles)
   * - Breakables may hide useful items
   *
   * Note:
   * We previously used a key+locked-gate here, but it proved too easy to miss in
   * playtests (and in some OS emoji stacks the gate read as "solid wall").
   * Key+gate is now introduced more explicitly on Floor 3.
   *
   * Layout (hourglass shape):
   * - Wide top half: player spawn (back door) + gentle breadcrumb toward the pinch
   * - Narrow bottleneck at center: a breakable barricade blocks passage
   * - Wide bottom half: forward exit (floor 3 door) beyond the barricade
   *
   * Template fills entire 20×40 grid → templateFillsGrid=true → no anchor shifting.
   */
  var FLOOR_2_LAYOUT = {
    floorNumber: 2,
    name: 'The Gate',
    description: 'A barricade blocks the pinch. Clear it with normal attacks/projectiles to proceed.',

    // 20 rows × 40 cols — fills grid exactly, no shifting applied
    // '#' = wall, '.' = floor, 'P' = player spawn, 'E' = exit
    // Hourglass: wide top, pinch at rows 9-10, wide bottom
    template: [
      '########################################',
      '#......................................#',
      '#..P...................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '##########....................##########',
      '##################LLLL##################',
      '##########....................##########',
      '#####..............................#####',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#...................E..................#',
      '########################################'
    ],

    // Player spawns upper-left — sees both doors and the gate bottleneck
    player: { x: 3, y: 2 },
    // Forward exit at bottom-center — visible through the hourglass but unreachable
    exit: { x: 20, y: 18 },

    // No buildings — open field design so both doors + gate are clearly visible
    buildings: [],

    decorations: [
      // Breadcrumb trail toward the key alcove (right side)
      { x: 15, y: 3, emoji: '🪧', name: 'Hint Sign' },
      { x: 25, y: 4, emoji: '🏮', name: 'Lantern' },
      // Scene cluster: "two rocks and a leaf" framing the Picnic Basket at (18,7)
      { x: 17, y: 7, emoji: '🪨', name: 'Rock' },
      { x: 19, y: 7, emoji: '🪨', name: 'Rock' },
      { x: 18, y: 6, emoji: '🍃', name: 'Fallen Leaf' }
    ],

    // Single helpful NPC — points player toward key
    npcs: [
      {
        x: 8, y: 4,
        emoji: '👵',
        name: 'Elder',
        direction: 'east',
        dialogues: [
          'That pinch is blocked by a barricade...',
          'You can break it with normal attacks or projectiles.',
          'Smash a few crates if you want supplies first.'
        ],
        pointsAt: { x: 20, y: 8 }
      }
    ],

    // Breakable barricade at the hourglass bottleneck — always visible and always solvable.
    // Uses a single emoji (no stacked overlap) to avoid OS-dependent rendering failures.
    tutorialGate: {
      positions: [
        { x: 19, y: 8 },
        { x: 20, y: 8 }
      ],
      emoji: '🪵',
      name: 'Wooden Barricade',
      hp: 2,
      message: 'A wooden barricade blocks the pinch. Break it to proceed.'
    },

    // Breakables on the right side (reward / practice), but no key on Floor 2.
    breakables: [
      { x: 32, y: 4, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [2, 4] } },
      { x: 33, y: 4, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [2, 4] } },
      { x: 34, y: 4, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [2, 4] } },
      { x: 35, y: 4, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [2, 4] } },
      { x: 32, y: 5, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [2, 4] } },
      { x: 35, y: 5, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [2, 4] } },
      // A couple bonus breakables near spawn for early currency
      { x: 10, y: 6, emoji: '📦', name: 'Wooden Crate', hp: 2, drops: { currency: [5, 10], cards: 0.3 } },
      { x: 18, y: 7, emoji: '🧺', name: 'Picnic Basket', hp: 2, drops: { currency: [5, 10], cards: 0.4 } }
    ],

    // Food collectibles for health/fatigue recovery
    interactiveItems: [
      { x: 5, y: 3, type: 'FOOD', emoji: '🍎', name: 'Fresh Apple',
        customData: { foodId: 'FOOD_APPLE' } },
      { x: 20, y: 14, type: 'FOOD', emoji: '☕', name: 'Hot Coffee',
        customData: { foodId: 'FOOD_COFFEE' } },
      { x: 15, y: 3, type: 'SIGN', emoji: '🪧', name: 'Hint Sign',
        text: 'A barricade blocks the pinch. Break it with normal attacks/projectiles to proceed.' }
    ],

    // Breadcrumb pickups leading player toward the pinch
    breadcrumbPickups: [
      { x: 12, y: 3, amount: 3 },
      { x: 20, y: 3, amount: 3 },
      { x: 22, y: 6, amount: 3 },
      { x: 20, y: 7, amount: 3 }
    ],

    enemies: [],

    border: {
      thickness: 1,
      style: 'natural',
      tiles: ['🌳', '🌲', '🪨', '🌿']
    }
  };

  /**
   * Floor 3: Tutorial Combat
   *
   * Teaching objective: Combat basics with weakest possible enemies.
   *
   * Layout:
   * - Open combat arena
   * - 3 passive enemies (snail, bee, caterpillar)
   * - Very small sight cones (1-3 tiles)
   * - Breakables with attack cards
   */
  var FLOOR_3_LAYOUT = {
    floorNumber: 3,
    name: 'First Encounters',
    description: 'Practice combat with harmless creatures.',

    template: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#...................P..................#',
      '#......................................#',
      '#.............####....####.............#',
      '#.............#..#....#..#.............#',
      '#.............#..#LLLL#..#.............#',
      '#.............#..#....#..#.............#',
      '#.............####....####.............#',
      '#......................................#',
      '#..................##..................#',
      '#..................##..................#',
      '#......................................#',
      '#...................E..................#',
      '#......................................#',
      '########################################'
    ],

    // Player spawns at the back/entry door near the arrival point
    player: { x: 20, y: 5 },
    // Exit is beyond the key gate + combat gate
    exit: { x: 20, y: 16 },

    // No buildings — combat focus; add minimal scene clusters around key breakables
    buildings: [],
    decorations: [
      // Scene cluster: "two ferns and a flower" framing the Picnic Basket at (28,4)
      { x: 27, y: 4, emoji: '🌿', name: 'Fern' },
      { x: 29, y: 4, emoji: '🌿', name: 'Fern' },
      { x: 28, y: 3, emoji: '🌸', name: 'Wild Flower' },
      // Scene cluster: "two rocks and a leaf" framing the Hollow Log at (32,10)
      { x: 31, y: 10, emoji: '🪨', name: 'Rock' },
      { x: 33, y: 10, emoji: '🪨', name: 'Rock' },
      { x: 32, y: 9, emoji: '🍃', name: 'Fallen Leaf' }
    ],

    // Friendly gate NPC (Pokemon-style) that teaches STR combat before leaving
    // (This is the first time we *force* combat.)
    npcs: [
      {
        id: 'TUTORIAL-GATE-01',
        x: 20,
        y: 13,
        emoji: '🧑‍🏫',
        name: 'Trainer',
        direction: 'south',
        gate: {
          // Use 'friendly' for tutorial sparring gates (wall releases, NPC stays)
          // Use 'defeatable' for true gates (NPC despawns on victory)
          type: 'friendly',
          // warning zone extends farther; trigger zone is the inner boundary
          warningDistance: 6,
          triggerDistance: 3,
          width: 2
        },
        dialogues: [
          '🧑‍🏫 Not so fast. Past this point, creatures will fight back.',
          '🧑‍🏫 Prove you can handle yourself.'
        ],
        reward: { currency: 15 }
      }
    ],

    // Vertical funnel key gate (teaches equip + interact) before the combat gate.
    lockedGate: {
      positions: [
        { x: 20, y: 9 },
        { x: 21, y: 9 }
      ],
      emoji: '🚧',
      name: 'Locked Gate',
      requiresKey: 'rusty_key',
      message: 'A locked gate blocks the passage. You need a key to open it.'
    },

    // Key hidden behind a breakable cluster (enemies nearby, but combat not forced yet)
    keyBreakable: {
      x: 10,
      y: 9,
      emoji: '📦',
      name: 'Marked Crate',
      hp: 2,
      drops: {
        item: 'rusty_key',
        currency: [5, 10]
      },
      message: 'A key clinks inside the crate...',
      highlight: true
    },

    // Key cluster bushes are included in the main breakables list below.

    // Weak tutorial enemies
    enemies: [
      {
        x: 4,
        y: 8,
        emoji: '🐌',
        name: 'Sleepy Snail',
        hp: 2,
        maxHp: 2,
        attack: 1,
        defense: 0,
        sightRange: 1, // Very small sight cone
        patrolType: 'stationary',
        orientation: 'south',
        dropTable: {
          currency: [5, 10],
          cards: 0.4
        }
      },
      {
        x: 12,
        y: 9,
        emoji: '🐝',
        name: 'Drowsy Bee',
        hp: 2,
        maxHp: 2,
        attack: 1,
        defense: 0,
        sightRange: 2, // Keep small so player can choose to engage or slip past
        patrolType: 'stationary',
        patrolPath: [],
        orientation: 'south',
        dropTable: {
          currency: [10, 15],
          cards: 0.5
        }
      },
      {
        x: 8,
        y: 10,
        emoji: '🐛',
        name: 'Lazy Caterpillar',
        hp: 3,
        maxHp: 3,
        attack: 2,
        defense: 0,
        sightRange: 1, // Very small sight cone
        patrolType: 'stationary',
        orientation: 'north',
        dropTable: {
          currency: [8, 12],
          cards: 0.4
        }
      }
    ],

    // Breakables with guaranteed attack cards for practice
    // (Also includes the key cluster bushes around the marked crate.)
    breakables: [
      // Key cluster bushes (guarding the marked crate at 10,9)
      { x: 9, y: 9, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [1, 2] } },
      { x: 11, y: 9, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [1, 2] } },
      { x: 10, y: 8, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [1, 2] } },
      { x: 10, y: 10, emoji: '🌿', name: 'Thick Bush', hp: 1, drops: { currency: [1, 2] } },
      {
        x: 12, y: 4,
        emoji: '🌸',
        name: 'Flower Patch',
        hp: 1,
        drops: {
          card: 'strike',
          currency: [3, 5]
        }
      },
      {
        x: 28, y: 4,
        emoji: '🧺',
        name: 'Picnic Basket',
        hp: 2,
        drops: {
          card: 'defend',
          currency: [5, 10]
        }
      },
      {
        x: 8, y: 10,
        emoji: '📦',
        name: 'Wooden Crate',
        hp: 2,
        drops: {
          currency: [5, 10],
          cards: 0.5
        }
      },
      {
        x: 32, y: 10,
        emoji: '🪵',
        name: 'Hollow Log',
        hp: 2,
        drops: {
          currency: [4, 8],
          cards: 0.5
        }
      }
    ],

    border: {
      thickness: 1,
      style: 'natural',
      tiles: ['🌳', '🌲', '🪨']
    }
  };


  // Church Interior Layout (Floor ID: "1.2")
  var CHURCH_INTERIOR_LAYOUT = {
    name: 'Church Interior',
    template: [
      '########################################',
      '#......................................#',
      '#..####..........########..........##..#',
      '#..####..........#......#..........##..#',
      '#................#......#...........#..#',
      '#................########...........#..#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '########################################'
    ],
    player: { x: 20, y: 17 },
    exit: { x: 20, y: 18 },
    buildingDoors: [
      { x: 38, y: 10, buildingId: 'BLD-002', targetFloorId: '1.2.1' }
    ],
    npcs: [{
      id: 'NPC-PRIEST', x: 20, y: 4, emoji: '\uD83D\uDC74', name: 'Father Aldric',
      direction: 'south',
      dialogues: [
        'Welcome, traveler. This chapel has stood for centuries.',
        'Strange sounds echo from behind the eastern wall at night...',
        'They say the old catacombs hold treasures from a forgotten age.',
        'Be careful if you venture below. The dead do not rest easy here.'
      ],
      gate: null, reward: null
    }],
    decorations: [
      { x: 10, y: 8, emoji: '\uD83E\uDE91' }, { x: 11, y: 8, emoji: '\uD83E\uDE91' },
      { x: 12, y: 8, emoji: '\uD83E\uDE91' }, { x: 13, y: 8, emoji: '\uD83E\uDE91' },
      { x: 10, y: 10, emoji: '\uD83E\uDE91' }, { x: 11, y: 10, emoji: '\uD83E\uDE91' },
      { x: 12, y: 10, emoji: '\uD83E\uDE91' }, { x: 13, y: 10, emoji: '\uD83E\uDE91' },
      { x: 26, y: 8, emoji: '\uD83E\uDE91' }, { x: 27, y: 8, emoji: '\uD83E\uDE91' },
      { x: 28, y: 8, emoji: '\uD83E\uDE91' }, { x: 29, y: 8, emoji: '\uD83E\uDE91' },
      { x: 26, y: 10, emoji: '\uD83E\uDE91' }, { x: 27, y: 10, emoji: '\uD83E\uDE91' },
      { x: 28, y: 10, emoji: '\uD83E\uDE91' }, { x: 29, y: 10, emoji: '\uD83E\uDE91' },
      { x: 19, y: 3, emoji: '\uD83D\uDD6F\uFE0F' }, { x: 21, y: 3, emoji: '\uD83D\uDD6F\uFE0F' },
      { x: 20, y: 2, emoji: '\u271D\uFE0F' },
      { x: 3, y: 7, emoji: '\uD83D\uDD6F\uFE0F' }, { x: 3, y: 13, emoji: '\uD83D\uDD6F\uFE0F' },
      { x: 36, y: 7, emoji: '\uD83D\uDD6F\uFE0F' }, { x: 36, y: 13, emoji: '\uD83D\uDD6F\uFE0F' }
    ],
    breakables: [
      { x: 6, y: 5, emoji: '\uD83D\uDD6F\uFE0F', name: 'Candelabra', hp: 1, drops: { currency: [3, 7] } },
      { x: 33, y: 5, emoji: '\uD83D\uDD6F\uFE0F', name: 'Candelabra', hp: 1, drops: { currency: [3, 7] } },
      { x: 6, y: 14, emoji: '\uD83D\uDD6F\uFE0F', name: 'Candelabra', hp: 1, drops: { currency: [3, 7] } },
      { x: 33, y: 14, emoji: '\uD83D\uDD6F\uFE0F', name: 'Candelabra', hp: 1, drops: { currency: [3, 7] } }
    ],
    currencies: [{ x: 18, y: 5, amount: 5 }, { x: 22, y: 5, amount: 5 }],
    enemies: []
  };
  if (typeof InteriorFloors !== 'undefined') {
    InteriorFloors.registerAuthoredLayout('1.2', CHURCH_INTERIOR_LAYOUT);
  }

  /**
   * Shop Interior Layout — Cozy merchant shop with counter and shopkeeper
   *
   * Design inspired by early Zelda shops:
   * - Small, intimate space (roughly 15x10 center area)
   * - Counter in the upper-middle area with shopkeeper behind it
   * - Player spawns near the bottom
   * - Exit door at the bottom-center
   * - Display shelves and decorations around the walls
   * - Shop interaction triggered by talking to the shopkeeper NPC
   *
   * This shop serves dual purposes:
   * 1. Development tool for rapid playtesting (granted items from M console)
   * 2. Easter egg for players with basic cards for sale
   */
  var SHOP_INTERIOR_LAYOUT = {
    name: 'Village Shop',
    template: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#..........########..........########..#',
      '#..........#......#..........#......#..#',
      '#..........#..🧑..#..........#......#..#',
      '#..........########..........########..#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '########################################'
    ],
    player: { x: 20, y: 16 },
    exit: { x: 20, y: 18 },
    buildingDoors: [],
    npcs: [{
      id: 'NPC-SHOPKEEPER',
      x: 17,
      y: 6,
      emoji: '🧙',
      name: 'Merchant',
      direction: 'south',
      dialogues: [
        'Welcome to my humble shop! I have goods from near and far.',
        'These wares may help you on your journey through the forest.',
        'Some say I have items that can only be found here... care to browse?'
      ],
      gate: null,
      reward: null,
      shopkeeper: true // Special flag to trigger shop UI
    }],
    decorations: [
      // Counter/display case - left side
      { x: 11, y: 4, emoji: '📦' }, { x: 12, y: 4, emoji: '📦' }, { x: 13, y: 4, emoji: '📦' },
      { x: 14, y: 4, emoji: '📦' }, { x: 15, y: 4, emoji: '📦' }, { x: 16, y: 4, emoji: '📦' },
      { x: 17, y: 4, emoji: '📦' }, { x: 18, y: 4, emoji: '📦' },
      // Counter surface - left display
      { x: 11, y: 5, emoji: '🏺' }, { x: 12, y: 5, emoji: '🎒' }, { x: 13, y: 5, emoji: '🗡️' },
      { x: 14, y: 5, emoji: '🛡️' }, { x: 15, y: 5, emoji: '💎' }, { x: 16, y: 5, emoji: '🔮' },
      { x: 18, y: 5, emoji: '🧪' },
      // Counter back wall
      { x: 11, y: 6, emoji: '🪵' }, { x: 12, y: 6, emoji: '🪵' }, { x: 13, y: 6, emoji: '🪵' },
      { x: 14, y: 6, emoji: '🪵' }, { x: 15, y: 6, emoji: '🪵' }, { x: 16, y: 6, emoji: '🪵' },
      { x: 18, y: 6, emoji: '🪵' },
      { x: 11, y: 7, emoji: '🪵' }, { x: 12, y: 7, emoji: '🪵' }, { x: 13, y: 7, emoji: '🪵' },
      { x: 14, y: 7, emoji: '🪵' }, { x: 15, y: 7, emoji: '🪵' }, { x: 16, y: 7, emoji: '🪵' },
      { x: 17, y: 7, emoji: '🪵' }, { x: 18, y: 7, emoji: '🪵' },
      // Right side display
      { x: 22, y: 4, emoji: '📦' }, { x: 23, y: 4, emoji: '📦' }, { x: 24, y: 4, emoji: '📦' },
      { x: 25, y: 4, emoji: '📦' }, { x: 26, y: 4, emoji: '📦' }, { x: 27, y: 4, emoji: '📦' },
      { x: 28, y: 4, emoji: '📦' },
      { x: 22, y: 5, emoji: '🍎' }, { x: 23, y: 5, emoji: '🍞' }, { x: 24, y: 5, emoji: '🧀' },
      { x: 25, y: 5, emoji: '🥖' }, { x: 26, y: 5, emoji: '🍖' }, { x: 27, y: 5, emoji: '🥤' },
      { x: 28, y: 5, emoji: '🍺' },
      { x: 22, y: 6, emoji: '🪵' }, { x: 23, y: 6, emoji: '🪵' }, { x: 24, y: 6, emoji: '🪵' },
      { x: 25, y: 6, emoji: '🪵' }, { x: 26, y: 6, emoji: '🪵' }, { x: 27, y: 6, emoji: '🪵' },
      { x: 28, y: 6, emoji: '🪵' },
      { x: 22, y: 7, emoji: '🪵' }, { x: 23, y: 7, emoji: '🪵' }, { x: 24, y: 7, emoji: '🪵' },
      { x: 25, y: 7, emoji: '🪵' }, { x: 26, y: 7, emoji: '🪵' }, { x: 27, y: 7, emoji: '🪵' },
      { x: 28, y: 7, emoji: '🪵' },
      // Wall shelves - left wall
      { x: 3, y: 3, emoji: '🕯️' }, { x: 3, y: 5, emoji: '📜' }, { x: 3, y: 7, emoji: '🕯️' },
      { x: 3, y: 9, emoji: '🏺' }, { x: 3, y: 11, emoji: '🕯️' },
      // Wall shelves - right wall
      { x: 36, y: 3, emoji: '🕯️' }, { x: 36, y: 5, emoji: '🗡️' }, { x: 36, y: 7, emoji: '🕯️' },
      { x: 36, y: 9, emoji: '🛡️' }, { x: 36, y: 11, emoji: '🕯️' },
      // Rugs/floor decoration
      { x: 19, y: 10, emoji: '🟫' }, { x: 20, y: 10, emoji: '🟫' }, { x: 21, y: 10, emoji: '🟫' },
      { x: 19, y: 11, emoji: '🟫' }, { x: 20, y: 11, emoji: '🟫' }, { x: 21, y: 11, emoji: '🟫' },
      { x: 19, y: 12, emoji: '🟫' }, { x: 20, y: 12, emoji: '🟫' }, { x: 21, y: 12, emoji: '🟫' }
    ],
    breakables: [],
    currencies: [],
    enemies: []
  };
  if (typeof InteriorFloors !== 'undefined') {
    InteriorFloors.registerAuthoredLayout('0.3', SHOP_INTERIOR_LAYOUT);
  }


  /**
   * Floor 0: The Tavern Road — Onboarding hub with scripted walk
   *
   * Design:
   * - Player spawns on the left side of a forest road
   * - A tavern building sits mid-map (easter egg: explorable interior + basement)
   * - The road leads east to the Floor 1 exit (scripted auto-walk on first visit)
   * - No enemies — safe hub area
   * - Building door leads to tavern interior (floor ID 0.1)
   *
   * Template fills entire 20×40 grid → templateFillsGrid=true → no anchor shifting.
   */
  var FLOOR_0_LAYOUT = {
    floorNumber: 0,
    name: 'The Tavern Road',
    description: 'A quiet forest road leading past an old tavern.',
    templateFillsGrid: true,

    // 20 rows × 40 cols — fills grid exactly
    // Road runs left-to-right through the middle rows
    // Tavern building in upper-left with a doorway gap at (6,5)
    // Exit door at (30,10) — visible and within tap radius from spawn
    template: [
      '########################################',
      '#......................................#',
      '#..############........................#',
      '#..############........................#',
      '#..############........................#',
      '#..###.######..........................#',
      '#......................................#',
      '#..P...................................#',
      '#......................................#',
      '#......................................#',
      '#..............................E.......#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '########################################'
    ],

    // Player spawns on the left side of the road
    player: { x: 3, y: 7 },
    // Exit door visible at center-right — scripted walk targets this door tile
    exit: { x: 30, y: 10 },

    // Tavern building (visual overlay, impassable) — solid block (3-12, 2-4)
    // South wall (y=5) has a doorway gap at (6,5)
    // Template walls handle collision; buildings array adds emoji overlays
    buildings: [
      // Top row (y=2): full wall x=3-12
      { x: 3, y: 2, emoji: '🏚️', name: 'Old Tavern' },
      { x: 4, y: 2, emoji: '🏚️', name: 'Old Tavern' },
      { x: 5, y: 2, emoji: '🏚️', name: 'Old Tavern' },
      { x: 6, y: 2, emoji: '🏚️', name: 'Old Tavern' },
      { x: 7, y: 2, emoji: '🏚️', name: 'Old Tavern' },
      { x: 8, y: 2, emoji: '🏚️', name: 'Old Tavern' },
      { x: 9, y: 2, emoji: '🏚️', name: 'Old Tavern' },
      { x: 10, y: 2, emoji: '🏚️', name: 'Old Tavern' },
      { x: 11, y: 2, emoji: '🏚️', name: 'Old Tavern' },
      { x: 12, y: 2, emoji: '🏚️', name: 'Old Tavern' },
      // Middle rows (y=3-4): full wall x=3-12
      { x: 3, y: 3, emoji: '🏚️', name: 'Old Tavern' },
      { x: 4, y: 3, emoji: '🏚️', name: 'Old Tavern' },
      { x: 5, y: 3, emoji: '🏚️', name: 'Old Tavern' },
      { x: 6, y: 3, emoji: '🏚️', name: 'Old Tavern' },
      { x: 7, y: 3, emoji: '🏚️', name: 'Old Tavern' },
      { x: 8, y: 3, emoji: '🏚️', name: 'Old Tavern' },
      { x: 9, y: 3, emoji: '🏚️', name: 'Old Tavern' },
      { x: 10, y: 3, emoji: '🏚️', name: 'Old Tavern' },
      { x: 11, y: 3, emoji: '🏚️', name: 'Old Tavern' },
      { x: 12, y: 3, emoji: '🏚️', name: 'Old Tavern' },
      { x: 3, y: 4, emoji: '🏚️', name: 'Old Tavern' },
      { x: 4, y: 4, emoji: '🏚️', name: 'Old Tavern' },
      { x: 5, y: 4, emoji: '🏚️', name: 'Old Tavern' },
      { x: 6, y: 4, emoji: '🏚️', name: 'Old Tavern' },
      { x: 7, y: 4, emoji: '🏚️', name: 'Old Tavern' },
      { x: 8, y: 4, emoji: '🏚️', name: 'Old Tavern' },
      { x: 9, y: 4, emoji: '🏚️', name: 'Old Tavern' },
      { x: 10, y: 4, emoji: '🏚️', name: 'Old Tavern' },
      { x: 11, y: 4, emoji: '🏚️', name: 'Old Tavern' },
      { x: 12, y: 4, emoji: '🏚️', name: 'Old Tavern' },
      // South wall (y=5): gap at x=6 for doorway
      { x: 3, y: 5, emoji: '🏚️', name: 'Old Tavern' },
      { x: 4, y: 5, emoji: '🏚️', name: 'Old Tavern' },
      { x: 5, y: 5, emoji: '🏚️', name: 'Old Tavern' },
      // (6,5) = doorway — intentionally omitted
      { x: 7, y: 5, emoji: '🏚️', name: 'Old Tavern' },
      { x: 8, y: 5, emoji: '🏚️', name: 'Old Tavern' },
      { x: 9, y: 5, emoji: '🏚️', name: 'Old Tavern' },
      { x: 10, y: 5, emoji: '🏚️', name: 'Old Tavern' },
      { x: 11, y: 5, emoji: '🏚️', name: 'Old Tavern' },
      { x: 12, y: 5, emoji: '🏚️', name: 'Old Tavern' },
      // Shop building near the exit (right side of the road)
      { x: 33, y: 9, emoji: '🏪', name: 'Village Shop' },
      { x: 34, y: 9, emoji: '🏪', name: 'Village Shop' },
      { x: 35, y: 9, emoji: '🏪', name: 'Village Shop' },
      { x: 33, y: 10, emoji: '🏪', name: 'Village Shop' },
      { x: 34, y: 10, emoji: '🏪', name: 'Village Shop' },
      { x: 35, y: 10, emoji: '🏪', name: 'Village Shop' }
    ],

    // Tavern entrance door — at the doorway gap in the south wall (6,5)
    buildingDoors: [
      { x: 6, y: 5, buildingId: 'BLD-TAVERN', targetFloorId: '0.1' },
      { x: 34, y: 11, buildingId: 'BLD-003', targetFloorId: '0.3' }
    ],

    // Decorations (visual overlay, walkable)
    decorations: [
      // Trees along the road
      { x: 16, y: 3, emoji: '🌳', name: 'Oak Tree' },
      { x: 22, y: 2, emoji: '🌲', name: 'Pine Tree' },
      { x: 30, y: 4, emoji: '🌳', name: 'Oak Tree' },
      { x: 35, y: 2, emoji: '🌲', name: 'Pine Tree' },
      // Lanterns along the path — kept away from exit/door columns
      { x: 10, y: 8, emoji: '🏮', name: 'Lantern' },
      { x: 20, y: 8, emoji: '🏮', name: 'Lantern' },
      { x: 27, y: 8, emoji: '🏮', name: 'Lantern' },
      // Scenery
      { x: 14, y: 14, emoji: '🪨', name: 'Boulder' },
      { x: 25, y: 15, emoji: '🌿', name: 'Fern' },
      { x: 33, y: 13, emoji: '🪨', name: 'Boulder' },
      // Tavern sign near doorway
      { x: 6, y: 6, emoji: '🪧', name: 'Tavern Sign' }
    ],

    // Hint NPC outside the tavern
    npcs: [
      {
        id: 'NPC-TAVERN-KEEPER',
        x: 8, y: 6,
        emoji: '🧔',
        name: 'Tavern Keeper',
        direction: 'south',
        dialogues: [
          'Welcome, stranger. The road ahead leads to the forest.',
          'This old tavern has been here longer than anyone can remember.',
          'If you ever come back this way, take a look around the cellar...',
          'They say the previous owner left something valuable down there.'
        ],
        gate: null, reward: null
      }
    ],

    interactiveItems: [
      { x: 6, y: 6, type: 'SIGN', emoji: '🪧', name: 'Tavern Sign',
        text: 'The Rusty Mug — Est. ???. "All adventurers welcome."' }
    ],

    breakables: [],
    enemies: [],

    breadcrumbPickups: [
      { x: 10, y: 7, amount: 3 },
      { x: 16, y: 8, amount: 3 },
      { x: 22, y: 9, amount: 3 },
      { x: 27, y: 10, amount: 5 }
    ],

    // Key ammo (T1) collectibles along the road — teaches key resource before Floor 1 gates
    tutorialPickups: [
      { x: 12, y: 7, type: 'key', keyType: 'RUSTY_KEY', tier: 1, name: 'Rusty Key', emoji: '🗝' },
      { x: 18, y: 8, type: 'key', keyType: 'RUSTY_KEY', tier: 1, name: 'Rusty Key', emoji: '🗝' },
      { x: 24, y: 9, type: 'key', keyType: 'RUSTY_KEY', tier: 1, name: 'Rusty Key', emoji: '🗝' }
    ],

    border: {
      thickness: 1,
      style: 'natural',
      tiles: ['🌳', '🌲', '🪨']
    }
  };


  // =========================================================================
  // Tavern Interior Layout (Floor ID: "0.1")
  // COLLECTIBLES TEST BLOCKOUT — All collectible types in labeled rows
  // Tests: single-tooltip-per-pickup, overhead animations, debrief feed, resource counters
  // =========================================================================
  var TAVERN_INTERIOR_LAYOUT = {
    name: 'Tavern Interior — Collectibles Test Floor',
    template: [
      '########################################',
      '#......................................#',
      '# ROW A: CURRENCY..................... #',
      '#......................................#',
      '# ROW B: AMMO......................... #',
      '#......................................#',
      '# ROW C: BATTERY (GEM)................ #',
      '#......................................#',
      '# ROW D: FOOD (4 resourceTypes)....... #',
      '#......................................#',
      '# ROW E: CARDS........................ #',
      '#......................................#',
      '# ROW F: KEYS (3 tiers)............... #',
      '#......................................#',
      '# ROW G: STRESS TEST (same tile)...... #',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '########################################'
    ],
    player: { x: 2, y: 17 },
    exit: { x: 2, y: 18 },

    // Door back to floor 0 exterior
    buildingDoors: [],

    npcs: [{
      id: 'NPC-TEST-GUIDE', x: 10, y: 17, emoji: '🧙', name: 'Test Guide',
      direction: 'north',
      dialogues: [
        'Welcome to the Collectibles Test Floor.',
        'Each row tests a different collectible type.',
        'Walk over items to auto-pickup. Watch for:',
        '- Exactly 1 MOK tooltip per pickup',
        '- Correct overhead animation color',
        '- Debrief feed flash and counter update',
        'Row G tests simultaneous pickup stacking.'
      ],
      gate: null, reward: null
    }, {
      id: 'NPC-BLACKSMITH', x: 14, y: 12, emoji: '⚒️', name: 'Blacksmith',
      direction: 'west',
      dialogues: [
        'I\'ve been searching for my hammer everywhere!',
        'If you find it, bring it back to me.',
        'I\'ll forge you something special in return.'
      ],
      gate: null,
      reward: { type: 'card_upgrade' },
      questItem: 'BLACKSMITH_HAMMER',
      npcTarget: 'BLACKSMITH'
    }],

    decorations: [
      // Row labels (signs on left side)
      { x: 1, y: 2, emoji: '🪧', name: 'Row A Label' },
      { x: 1, y: 4, emoji: '🪧', name: 'Row B Label' },
      { x: 1, y: 6, emoji: '🪧', name: 'Row C Label' },
      { x: 1, y: 8, emoji: '🪧', name: 'Row D Label' },
      { x: 1, y: 10, emoji: '🪧', name: 'Row E Label' },
      { x: 1, y: 12, emoji: '🪧', name: 'Row F Label' },
      { x: 1, y: 14, emoji: '🪧', name: 'Row G Label' }
    ],

    interactiveItems: [
      // Row labels (interactive signs)
      { x: 1, y: 2, type: 'SIGN', emoji: '🪧', name: 'Row A: Currency',
        text: 'ROW A — CURRENCY: 3 crypto piles (amounts 1, 5, 25). Yellow #FFFF00 overhead, currency counter updates.' },
      { x: 1, y: 4, type: 'SIGN', emoji: '🪧', name: 'Row B: Ammo',
        text: 'ROW B — AMMO: 3 ammo pickups (amounts 1, 3, 5). Magenta #DA70D6 overhead, debrief ammo row flashes.' },
      { x: 1, y: 6, type: 'SIGN', emoji: '🪧', name: 'Row C: Battery',
        text: 'ROW C — BATTERY (GEM): 3 gems (amounts 1, 2, 3). Cyan-green #00FFA6 overhead, battery row flashes.' },
      { x: 1, y: 8, type: 'SIGN', emoji: '🪧', name: 'Row D: Food',
        text: 'ROW D — FOOD (4 resourceTypes): HP (stew, pizza, burger), Energy (coffee, energy drink), Fatigue (banana, orange), Inert (juice, water).' },
      { x: 1, y: 10, type: 'SIGN', emoji: '🪧', name: 'Row E: Cards',
        text: 'ROW E — CARDS: 1 attack card, 1 support card. Purple #800080 overhead, cards row updates.' },
      { x: 1, y: 12, type: 'SIGN', emoji: '🪧', name: 'Row F: Keys',
        text: 'ROW F — KEYS: Tier 1 (ammo key, orange #FF8A3D), Tier 2 (gate key, gold #FFD700), Tier 3 (quest key, red #FF4444).' },
      { x: 1, y: 14, type: 'SIGN', emoji: '🪧', name: 'Row G: Stress Test',
        text: 'ROW G — SIMULTANEOUS PICKUP: Ammo + currency + gem + food all on same/adjacent tiles. Tests overhead stacking (fan spacing) and single-tooltip-per-pickup.' },

      // Row D: Food items (auto-pickup)
      // HP food (Pink #FF6B9D)
      { x: 5, y: 8, type: 'FOOD', emoji: '🍲', name: 'Hot Stew', customData: { foodId: 'FOOD_STEW' } },
      { x: 7, y: 8, type: 'FOOD', emoji: '🍕', name: 'Pizza Slice', customData: { foodId: 'FOOD_PIZZA' } },
      { x: 9, y: 8, type: 'FOOD', emoji: '🍔', name: 'Hamburger', customData: { foodId: 'FOOD_BURGER' } },
      // Energy food (Blue #00D4FF)
      { x: 13, y: 8, type: 'FOOD', emoji: '☕', name: 'Coffee', customData: { foodId: 'FOOD_COFFEE' } },
      { x: 15, y: 8, type: 'FOOD', emoji: '🥤', name: 'Energy Drink', customData: { foodId: 'FOOD_ENERGY_DRINK' } },
      // Fatigue food (Brown #A0522D)
      { x: 19, y: 8, type: 'FOOD', emoji: '🍌', name: 'Banana', customData: { foodId: 'FOOD_BANANA' } },
      { x: 21, y: 8, type: 'FOOD', emoji: '🍊', name: 'Orange', customData: { foodId: 'FOOD_ORANGE' } },
      // Inert food (Grey #CCCCCC)
      { x: 25, y: 8, type: 'FOOD', emoji: '🧃', name: 'Fruit Juice', customData: { foodId: 'FOOD_JUICE' } },
      { x: 27, y: 8, type: 'FOOD', emoji: '💧', name: 'Water Bottle', customData: { foodId: 'FOOD_WATER' } }
    ],

    breakables: [
      // Row H: Barrels — Grey (inert, 2HP) and Red (explosive, 1HP)
      { x: 5, y: 16, emoji: '🗑️', name: 'Grey Barrel', hp: 2, drops: { currency: [3, 8] }, kickable: true, destroyedGlyph: '.' },
      { x: 8, y: 16, emoji: '🗑️', name: 'Grey Barrel', hp: 2, drops: { currency: [3, 8] }, kickable: true, destroyedGlyph: '.' },
      { x: 11, y: 16, emoji: '🛢️', name: 'Red Barrel', hp: 1, explosive: true, blastRadius: 2.75, blastDamage: [9, 25], noise: 4, kickable: true },
      { x: 14, y: 16, emoji: '🛢️', name: 'Red Barrel', hp: 1, explosive: true, blastRadius: 2.75, blastDamage: [9, 25], noise: 4, kickable: true },
      { x: 15, y: 16, emoji: '🛢️', name: 'Red Barrel', hp: 1, explosive: true, blastRadius: 2.75, blastDamage: [9, 25], noise: 4, kickable: true },
      { x: 17, y: 16, emoji: '🛢️', name: 'Red Barrel', hp: 1, explosive: true, blastRadius: 2.75, blastDamage: [9, 25], noise: 4, kickable: true }
    ],

    // Row A: Currency — 3 crypto piles (amounts 1, 5, 25)
    currencies: [
      { x: 5, y: 2, amount: 1 },
      { x: 8, y: 2, amount: 5 },
      { x: 11, y: 2, amount: 25 },
      // Row G: Stress test — currency component
      { x: 5, y: 14, amount: 3 }
    ],

    // Row B-G: Ammo, Gems, Cards, Keys in tutorialPickups
    tutorialPickups: [
      // Row B: Ammo (magenta #DA70D6) — amounts 1, 3, 5
      { x: 5, y: 4, type: 'ammo', amount: 1 },
      { x: 8, y: 4, type: 'ammo', amount: 3 },
      { x: 11, y: 4, type: 'ammo', amount: 5 },

      // Row C: Battery/Gem (cyan-green #00FFA6) — amounts 1, 2, 3
      { x: 5, y: 6, type: 'gem', amount: 1 },
      { x: 8, y: 6, type: 'gem', amount: 2 },
      { x: 11, y: 6, type: 'gem', amount: 3 },

      // Row E: Cards (purple #800080) — 1 attack card, 1 support card
      { x: 5, y: 10, type: 'card', guaranteed: true, cardType: 'ATTACK' },
      { x: 8, y: 10, type: 'card', guaranteed: true, cardType: 'SUPPORT' },

      // Row F: Keys — Tier 1 (ammo key), Tier 2 (gate key), Tier 3 (quest key)
      // Tier 1: Key ammo (orange #FF8A3D) — consumable chest keys
      { x: 5, y: 12, type: 'key', keyType: 'RUSTY_KEY', tier: 1, name: 'Rusty Key', emoji: '🗝' },
      // Tier 2: Key items (gold #FFD700) — persistent door keys, auto-equips
      { x: 8, y: 12, type: 'key', keyType: 'SECURITY_KEYCARD', tier: 2, name: 'Security Keycard', emoji: '💳' },
      // Tier 3: Quest keys (red #FF4444) — NPC turn-in items
      { x: 11, y: 12, type: 'key', keyType: 'BLACKSMITH_HAMMER', tier: 3, subtype: 'quest', registryId: 'ITM-030', name: 'Blacksmith\'s Hammer', emoji: '🔨', npcTarget: 'BLACKSMITH' },

      // Row G: Stress test — multiple items on adjacent tiles
      // Testing simultaneous pickup with overhead animation stacking
      { x: 6, y: 14, type: 'ammo', amount: 2 },
      { x: 7, y: 14, type: 'gem', amount: 1 }
    ],

    enemies: []
  };

  // =========================================================================
  // Tavern Basement Layout (Floor ID: "0.1.1")
  // Dark cellar with the BLACKSMITH_HAMMER quest key at the far end.
  // =========================================================================
  var TAVERN_BASEMENT_LAYOUT = {
    name: 'Tavern Basement',
    template: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#..########..........########.........#',
      '#..#......#..........#......#.........#',
      '#..#......#..........#......#.........#',
      '#..########..........########.........#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#..########..........########.........#',
      '#..#......#..........#......#.........#',
      '#..#......#..........#......#.........#',
      '#..########..........########.........#',
      '#......................................#',
      '#......................................#',
      '########################################'
    ],
    player: { x: 20, y: 17 },
    exit: { x: 20, y: 18 },

    // No nested doors — this is the deepest level
    buildingDoors: [],

    npcs: [],

    decorations: [
      // Cobwebs
      { x: 2, y: 1, emoji: '🕸️', name: 'Cobweb' },
      { x: 37, y: 1, emoji: '🕸️', name: 'Cobweb' },
      { x: 2, y: 18, emoji: '🕸️', name: 'Cobweb' },
      { x: 37, y: 18, emoji: '🕸️', name: 'Cobweb' },
      // Torches
      { x: 1, y: 5, emoji: '🔥', name: 'Wall Torch' },
      { x: 1, y: 14, emoji: '🔥', name: 'Wall Torch' },
      { x: 38, y: 5, emoji: '🔥', name: 'Wall Torch' },
      { x: 38, y: 14, emoji: '🔥', name: 'Wall Torch' }
    ],

    interactiveItems: [
      { x: 20, y: 10, type: 'SIGN', emoji: '🪧', name: 'Scratched Note',
        text: 'Mara hid the hammer here before she left. "For the one who returns to the forge."' }
    ],

    breakables: [
      { x: 10, y: 9, emoji: '📦', name: 'Rotting Crate', hp: 1, drops: { currency: [5, 10] } },
      { x: 11, y: 9, emoji: '📦', name: 'Rotting Crate', hp: 1, drops: { currency: [5, 10] } },
      { x: 28, y: 9, emoji: '🛢️', name: 'Rusted Barrel', hp: 1, drops: { currency: [3, 8] } },
      { x: 29, y: 9, emoji: '🛢️', name: 'Rusted Barrel', hp: 1, drops: { currency: [3, 8] } },
      // Crates guarding the hammer alcove
      { x: 34, y: 1, emoji: '📦', name: 'Heavy Crate', hp: 2, drops: { currency: [5, 12] } },
      { x: 35, y: 1, emoji: '📦', name: 'Heavy Crate', hp: 2, drops: { currency: [5, 12] } }
    ],

    // The BLACKSMITH_HAMMER quest key — freely pickable at the end of the basement
    tutorialPickups: [
      {
        x: 37, y: 2,
        type: 'key',
        keyType: 'BLACKSMITH_HAMMER',
        tier: 3,
        subtype: 'quest',
        registryId: 'ITM-030',
        emoji: '🔨',
        name: 'Blacksmith\'s Hammer',
        npcTarget: 'BLACKSMITH'
      }
    ],

    currencies: [
      { x: 15, y: 5, amount: 8 },
      { x: 25, y: 5, amount: 8 },
      { x: 15, y: 14, amount: 8 },
      { x: 25, y: 14, amount: 8 }
    ],
    enemies: []
  };

  // Register tavern interiors with InteriorFloors module
  if (typeof InteriorFloors !== 'undefined') {
    InteriorFloors.registerAuthoredLayout('0.1', TAVERN_INTERIOR_LAYOUT);
    InteriorFloors.registerAuthoredLayout('0.1.1', TAVERN_BASEMENT_LAYOUT);
  }


  /**
   * Get contrived floor layout for tutorial floors
   * @param {number} floorNumber - Floor number (0-3)
   * @returns {Object|null} Floor layout or null if not a tutorial floor
   */
  function getFloorLayout(floorNumber) {
    switch (floorNumber) {
      case 0:
        return FLOOR_0_LAYOUT;
      case 1:
        return FLOOR_1_LAYOUT;
      case 2:
        return FLOOR_2_LAYOUT;
      case 3:
        return FLOOR_3_LAYOUT;
      default:
        return null;
    }
  }

  /**
   * Check if floor should use contrived layout
   * @param {number} floorNumber - Floor number to check
   * @returns {boolean} True if floor uses contrived layout
   */
  function isContrivedFloor(floorNumber) {
    return floorNumber >= 0 && floorNumber <= 3;
  }

  /**
   * Generate a contrived floor grid from layout
   * @param {Object} layout - Floor layout definition
   * @returns {Object} Generated floor data (grid, entities, spawns)
   */
  function generateContrivedFloor(layout) {
    // Create empty grid
    var grid = [];
    for (var y = 0; y < GRID_HEIGHT; y++) {
      grid[y] = [];
      for (var x = 0; x < GRID_WIDTH; x++) {
        grid[y][x] = TILES.EMPTY;
      }
    }

    // Optional: shift the whole layout so the designed entry point lands at a target location.
    // This allows transitions to feel spatially consistent (anchor to the door you just used).
    var dx = 0;
    var dy = 0;
    var player = layout.player;
    var exit = layout.exit;

    var anchor = layout.anchorTo || null; // {x,y} in grid coordinates
    if (!anchor && layout.anchorPlayerToCenter && player && typeof player.x === 'number' && typeof player.y === 'number') {
      anchor = { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) };
    }

    // If the template already fills the entire grid, shifting it will necessarily crop content and
    // create "blank fields". In that case, ignore anchor shifts and keep the authored layout fixed.
    var templateFillsGrid = false;
    try {
      if (layout.template && layout.template.length >= GRID_HEIGHT) {
        var r0 = layout.template[0] || '';
        if (typeof r0 === 'string' && r0.length >= GRID_WIDTH) templateFillsGrid = true;
      }
    } catch (eT) {}

    if (!templateFillsGrid && anchor && player && typeof player.x === 'number' && typeof player.y === 'number') {
      dx = anchor.x - player.x;
      dy = anchor.y - player.y;

      // Clamp shift so the entry point and exit remain in-bounds.
      // This prevents doors from being shifted off-grid ("no doors visible").
      function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
      var minDx = 1 - player.x;
      var maxDx = (GRID_WIDTH - 2) - player.x;
      var minDy = 1 - player.y;
      var maxDy = (GRID_HEIGHT - 2) - player.y;

      if (exit && typeof exit.x === 'number' && typeof exit.y === 'number') {
        minDx = Math.max(minDx, 1 - exit.x);
        maxDx = Math.min(maxDx, (GRID_WIDTH - 2) - exit.x);
        minDy = Math.max(minDy, 1 - exit.y);
        maxDy = Math.min(maxDy, (GRID_HEIGHT - 2) - exit.y);
      }

      dx = clamp(dx, minDx, maxDx);
      dy = clamp(dy, minDy, maxDy);

      player = { x: player.x + dx, y: player.y + dy };
      if (exit && typeof exit.x === 'number' && typeof exit.y === 'number') {
        exit = { x: exit.x + dx, y: exit.y + dy };
      }
    }

    // Apply template if provided (with optional shift)
    if (layout.template) {
      for (var ty = 0; ty < Math.min(layout.template.length, GRID_HEIGHT); ty++) {
        var row = layout.template[ty];
        for (var tx = 0; tx < Math.min(row.length, GRID_WIDTH); tx++) {
          var char = row.charAt(tx);
          var gx = tx + dx;
          var gy = ty + dy;
          if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) continue;

          if (char === '#') {
            grid[gy][gx] = TILES.WALL;
          } else if (char === '~') {
            grid[gy][gx] = '~'; // Water tile
          } else if (char === 'P' || char === 'E') {
            // Entry/exit markers: always carve to empty so doors can be stamped reliably later.
            grid[gy][gx] = TILES.EMPTY;
          } else if (char !== 'G' && char !== 'L') {
            // Keep as floor, handle special markers separately
            grid[gy][gx] = TILES.EMPTY;
          }
        }
      }
    }

    // Generate border walls if not already in template
    if (layout.border) {
      for (var bx = 0; bx < GRID_WIDTH; bx++) {
        grid[0][bx] = TILES.WALL;
        grid[GRID_HEIGHT - 1][bx] = TILES.WALL;
      }
      for (var by = 0; by < GRID_HEIGHT; by++) {
        grid[by][0] = TILES.WALL;
        grid[by][GRID_WIDTH - 1] = TILES.WALL;
      }
    }

    function _shiftList(list) {
      var out = [];
      (list || []).forEach(function(o) {
        if (!o || typeof o.x !== 'number' || typeof o.y !== 'number') { out.push(o); return; }
        var nx = o.x + dx;
        var ny = o.y + dy;
        // Drop shifted objects that land out-of-bounds to avoid invisible blockers/metadata.
        if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) return;
        out.push(Object.assign({}, o, { x: nx, y: ny }));
      });
      return out;
    }

    // Shift a gate/barrier object that has a .positions array (lockedGate, tutorialGate).
    // Returns a new object with shifted positions (drops out-of-bounds positions).
    function _shiftGateObj(gateObj) {
      if (!gateObj) return null;
      var shifted = Object.assign({}, gateObj);
      if (Array.isArray(gateObj.positions)) {
        shifted.positions = [];
        gateObj.positions.forEach(function(pos) {
          var nx = pos.x + dx;
          var ny = pos.y + dy;
          if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) return;
          shifted.positions.push({ x: nx, y: ny });
        });
      }
      return shifted;
    }

    // Shift a single-position object (like keyBreakable) that has .x and .y.
    function _shiftSingleObj(obj) {
      if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number') return obj;
      var nx = obj.x + dx;
      var ny = obj.y + dy;
      if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) return null;
      return Object.assign({}, obj, { x: nx, y: ny });
    }

    return {
      grid: grid,
      player: player,
      exit: exit,
      buildings: _shiftList(layout.buildings),
      buildingDoors: _shiftList(layout.buildingDoors),
      decorations: _shiftList(layout.decorations),
      breakables: _shiftList(layout.breakables),
      enemies: _shiftList(layout.enemies),
      npcs: _shiftList(layout.npcs),
      tutorialGate: _shiftGateObj(layout.tutorialGate),
      lockedGate: _shiftGateObj(layout.lockedGate),
      lockedChests: _shiftList(layout.lockedChests),
      keyBreakable: _shiftSingleObj(layout.keyBreakable),
      tutorialPickups: _shiftList(layout.tutorialPickups),
      interactiveItems: _shiftList(layout.interactiveItems),
      waterTiles: _shiftList(layout.waterTiles),
      breadcrumbPickups: _shiftList(layout.breadcrumbPickups),
      border: layout.border,
      metadata: {
        name: layout.name,
        description: layout.description,
        floorNumber: layout.floorNumber
      }
    };
  }

  // Public API
  return {
    getFloorLayout: getFloorLayout,
    isContrivedFloor: isContrivedFloor,
    generateContrivedFloor: generateContrivedFloor,

    // Export for designer tooling
    FLOOR_0_LAYOUT: FLOOR_0_LAYOUT,
    FLOOR_1_LAYOUT: FLOOR_1_LAYOUT,
    FLOOR_2_LAYOUT: FLOOR_2_LAYOUT,
    FLOOR_3_LAYOUT: FLOOR_3_LAYOUT,
    CHURCH_INTERIOR_LAYOUT: CHURCH_INTERIOR_LAYOUT,
    TAVERN_INTERIOR_LAYOUT: TAVERN_INTERIOR_LAYOUT,
    TAVERN_BASEMENT_LAYOUT: TAVERN_BASEMENT_LAYOUT
  };

})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TutorialFloors;
}
