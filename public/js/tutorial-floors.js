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

    // Decorations (visual overlay, walkable)
    decorations: [
      // Zone 1: Village atmosphere
      { x: 6, y: 1, emoji: '⛲', name: 'Fountain' },
      { x: 10, y: 3, emoji: '🏮', name: 'Lantern' },
      // Zone 2: Orchard/garden atmosphere
      { x: 32, y: 3, emoji: '🪑', name: 'Bench' },
      // Zone 3: Hidden grove atmosphere
      { x: 3, y: 15, emoji: '🏮', name: 'Hidden Lantern' }
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
      { x: 26, y: 4, type: 'FOOD', emoji: '🫐', name: 'Berry Bush',
        customData: { foodId: 'berries' } },
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

    // Locked chests (teach keys as "mystery" + reward exploration)
    lockedChests: [
      {
        x: 4,
        y: 15,
        emoji: '🧰',
        name: 'Locked Chest',
        // Ambiguous: either key might work
        acceptsKeys: ['RUSTY_KEY', 'BRONZE_KEY'],
        message: 'A small chest with a stubborn lock. It might take the right key...'
      }
    ],

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
    }
  };

  /**
   * Floor 2: The Key Quest
   *
   * Teaching objective: Items can unlock barriers. NPCs point you in directions.
   *
   * Layout:
   * - Two village clusters for exploration
   * - NPCs with directional indicators
   * - Hidden key in breakable object
   * - Locked gate requiring key
   */
  var FLOOR_2_LAYOUT = {
    floorNumber: 2,
    name: 'The Key Quest',
    description: 'Find the key to unlock the southern gate.',

    template: [
      '########################################',
      '#......................................#',
      '#...🏠.....🏠..........🏠.....🏠.......#',
      '#...🏠.....⛪..........🏠.....🏪.......#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#....................P.................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#.................LLL..................#',
      '#......................................#',
      '#......................................#',
      '#...................E..................#',
      '#......................................#',
      '########################################'
    ],

    // Player spawns at the back/entry door near the arrival point
    player: { x: 20, y: 15 },
    // Forward exit should be elsewhere (seek it out)
    exit: { x: 34, y: 17 },

    buildings: [
      { x: 4, y: 2, emoji: '🏠', name: 'Village House' },
      { x: 4, y: 3, emoji: '🏠', name: 'Village House' },
      { x: 8, y: 2, emoji: '🏠', name: 'Village House' },
      { x: 8, y: 3, emoji: '⛪', name: 'Village Chapel' },
      { x: 23, y: 2, emoji: '🏠', name: 'Village House' },
      { x: 23, y: 3, emoji: '🏠', name: 'Village House' },
      { x: 28, y: 2, emoji: '🏠', name: 'Village House' },
      { x: 28, y: 3, emoji: '🏪', name: 'Village Shop' }
    ],

    decorations: [
      { x: 6, y: 5, emoji: '📬', name: 'Mailbox' },
      { x: 12, y: 6, emoji: '⛲', name: 'Fountain' },
      { x: 25, y: 5, emoji: '🪧', name: 'Sign Post' },
      { x: 32, y: 6, emoji: '🪑', name: 'Bench' }
    ],

    // NPCs with directional indicators (and a defeatable gate example)
    npcs: [
      {
        x: 8, y: 5,
        emoji: '👱',
        name: 'Villager',
        direction: 'east',
        dialogues: [
          'I think I saw something shiny near the eastern bushes...',
          'Keys open gates, you know.'
        ],
        pointsAt: { x: 32, y: 10 } // Points toward key location
      },
      {
        x: 25, y: 7,
        emoji: '👵',
        name: 'Elder',
        direction: 'south',
        dialogues: [
          'The gate ahead is locked.',
          'Maybe try looking around for a key?'
        ]
      },
      {
        // Defeatable NPC gate: despawns on victory (demonstrates the variant)
        id: 'TUTORIAL-DEFEATABLE-GATE-01',
        x: 20,
        y: 15,
        emoji: '🧑‍✈️',
        name: 'Checkpoint Guard',
        direction: 'south',
        gate: {
          type: 'defeatable',
          warningDistance: 4,
          triggerDistance: 2,
          width: 1
        },
        dialogues: [
          '🧑‍✈️ Not until you prove it. This checkpoint is live.',
          '🧑‍✈️ Win, and I’m gone. Lose, and you’re reset.'
        ],
        reward: { currency: 20 }
      }
    ],

    // Locked gate (requires key)
    lockedGate: {
      positions: [
        { x: 18, y: 13 },
        { x: 19, y: 13 },
        { x: 20, y: 13 }
      ],
      emoji: '🔐',
      name: 'Locked Gate',
      requiresKey: 'rusty_key',
      message: 'The gate is locked. You need a key.'
    },

    // Key spawn location (in breakable)
    keyBreakable: {
      x: 32,
      y: 10,
      emoji: '🌸',
      name: 'Flower Patch',
      hp: 2,
      drops: {
        item: 'rusty_key',
        currency: [5, 10]
      },
      message: 'A pretty flower patch. Something glints inside...'
    },

    breakables: [
      { x: 10, y: 9, emoji: '🌿', name: 'Bush', hp: 1, drops: { currency: [3, 5], cards: 0.3 } },
      { x: 15, y: 11, emoji: '🪵', name: 'Hollow Log', hp: 2, drops: { currency: [4, 8], cards: 0.3 } },
      { x: 28, y: 12, emoji: '📦', name: 'Wooden Crate', hp: 2, drops: { currency: [5, 10], cards: 0.4 } },
      { x: 12, y: 14, emoji: '🧺', name: 'Picnic Basket', hp: 2, drops: { currency: [5, 10], cards: 0.5 } }
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
      '#......................................#',
      '#...🐌.................🐝..............#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#.................🐛...................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#...................E..................#',
      '#......................................#',
      '########################################'
    ],

    // Player spawns at the back/entry door near the arrival point
    player: { x: 20, y: 5 },
    // Forward exit should be elsewhere (seek it out)
    exit: { x: 34, y: 17 },

    // No buildings or decorations (combat focus)
    buildings: [],
    decorations: [],

    // Friendly gate NPC (Pokemon-style) that teaches STR combat before leaving
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
          '🧑‍🏫 You can’t leave yet. Show me you can fight.',
          '🧑‍🏫 Tip: you can soften a target before combat — but only one trick, once.'
        ],
        reward: { currency: 15 }
      }
    ],

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
        x: 24,
        y: 8,
        emoji: '🐝',
        name: 'Drowsy Bee',
        hp: 2,
        maxHp: 2,
        attack: 1,
        defense: 0,
        sightRange: 3, // Medium sight cone
        patrolType: 'circular',
        patrolPath: [
          { x: 24, y: 8 },
          { x: 26, y: 8 },
          { x: 26, y: 10 },
          { x: 24, y: 10 }
        ],
        orientation: 'south',
        dropTable: {
          currency: [10, 15],
          cards: 0.5
        }
      },
      {
        x: 18,
        y: 12,
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
    breakables: [
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

  /**
   * Get contrived floor layout for tutorial floors
   * @param {number} floorNumber - Floor number (1-3)
   * @returns {Object|null} Floor layout or null if not a tutorial floor
   */
  function getFloorLayout(floorNumber) {
    switch (floorNumber) {
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
    return floorNumber >= 1 && floorNumber <= 3;
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

    // Apply template if provided
    if (layout.template) {
      for (var ty = 0; ty < Math.min(layout.template.length, GRID_HEIGHT); ty++) {
        var row = layout.template[ty];
        for (var tx = 0; tx < Math.min(row.length, GRID_WIDTH); tx++) {
          var char = row.charAt(tx);
          if (char === '#') {
            grid[ty][tx] = TILES.WALL;
          } else if (char === '~') {
            grid[ty][tx] = '~'; // Water tile
          } else if (char !== 'P' && char !== 'E' && char !== 'G' && char !== 'L') {
            // Keep as floor, handle special markers separately
            grid[ty][tx] = TILES.EMPTY;
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

    return {
      grid: grid,
      player: layout.player,
      exit: layout.exit,
      buildings: layout.buildings || [],
      decorations: layout.decorations || [],
      breakables: layout.breakables || [],
      enemies: layout.enemies || [],
      npcs: layout.npcs || [],
      tutorialGate: layout.tutorialGate,
      lockedGate: layout.lockedGate,
      lockedChests: layout.lockedChests || [],
      keyBreakable: layout.keyBreakable,
      tutorialPickups: layout.tutorialPickups || [],
      interactiveItems: layout.interactiveItems || [],
      waterTiles: layout.waterTiles || [],
      breadcrumbPickups: layout.breadcrumbPickups || [],
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
    FLOOR_1_LAYOUT: FLOOR_1_LAYOUT,
    FLOOR_2_LAYOUT: FLOOR_2_LAYOUT,
    FLOOR_3_LAYOUT: FLOOR_3_LAYOUT
  };

})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TutorialFloors;
}
