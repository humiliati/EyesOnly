/* ============================================================
   EYES ONLY - Item Spawner System
   Designer-friendly, code-light engine for spawning interactive items
   Based on database schema for procedural generation
   ============================================================ */

const ItemSpawner = (function() {
  'use strict';

  /**
   * Item definition database (mimics SQL schema)
   * In production, this would be loaded from JSON or database
   */
  var ITEM_DEFINITIONS = {
    // Office Biome Items
    'OFF_002': {
      itemId: 'OFF_002',
      itemName: 'Computer Terminal',
      category: 'Readable',
      baseEmoji: '💻',
      defaultExpression: 'THINKING',
      interactionType: 'text_display',
      breakable: false,
      biomes: ['office', 'museum'],
      spawnWeight: 40,
      spawnConditions: 'desk_adjacent',
      lightingAffected: true
    },
    'OFF_009': {
      itemId: 'OFF_009',
      itemName: 'Cardboard Box',
      category: 'Transform',
      baseEmoji: '📦',
      defaultExpression: 'none',
      interactionType: 'player_transform',
      breakable: false,
      biomes: ['all'],
      spawnWeight: 35,
      spawnConditions: 'floor_clear',
      lightingAffected: false
    },
    'OFF_020': {
      itemId: 'OFF_020',
      itemName: 'Poster',
      category: 'Readable',
      baseEmoji: '🖼️',
      defaultExpression: 'none',
      interactionType: 'ambient_decor',
      breakable: false,
      biomes: ['office'],
      spawnWeight: 35,
      spawnConditions: 'wall_clear',
      lightingAffected: false
    },

    // Mall Biome Items
    'MLL_002': {
      itemId: 'MLL_002',
      itemName: 'Teddy Bear',
      category: 'Breakable',
      baseEmoji: '🧸',
      defaultExpression: 'CONFUSED',
      interactionType: 'random_loot',
      breakable: true,
      biomes: ['mall'],
      spawnWeight: 30,
      spawnConditions: 'display_area',
      lootTable: 'toy_loot'
    },
    'MLL_003': {
      itemId: 'MLL_003',
      itemName: 'Mall Directory',
      category: 'Readable',
      baseEmoji: '🗺️',
      defaultExpression: 'THINKING',
      interactionType: 'waypoint',
      breakable: false,
      biomes: ['mall'],
      spawnWeight: 15,
      spawnConditions: 'atrium_center',
      lootTable: 'none'
    },

    // Cave Biome Items
    'CAV_002': {
      itemId: 'CAV_002',
      itemName: 'Lavalamps',
      category: 'Light Source',
      baseEmoji: '🫧',
      defaultExpression: 'none',
      interactionType: 'lighting_aura',
      breakable: false,
      biomes: ['cave'],
      spawnWeight: 30,
      spawnConditions: 'room_center',
      hidden: false
    },
    'CAV_010': {
      itemId: 'CAV_010',
      itemName: 'Cave Painting',
      category: 'Readable',
      baseEmoji: '🎨',
      defaultExpression: 'THINKING',
      interactionType: 'lore_item',
      breakable: false,
      biomes: ['cave'],
      spawnWeight: 10,
      spawnConditions: 'wall_adjacent',
      hidden: false
    },

    // Museum Biome Items
    'MSM_002': {
      itemId: 'MSM_002',
      itemName: 'Alien Artifact',
      category: 'Readable',
      baseEmoji: '🛸',
      defaultExpression: 'SURPRISED',
      interactionType: 'lore_reveal',
      breakable: false,
      biomes: ['museum', 'cave'],
      spawnWeight: 25,
      spawnConditions: 'artifact_pad',
      encounterType: 'none'
    },

    // Industrial Plant Items
    'IND_003': {
      itemId: 'IND_003',
      itemName: 'Hazard Cone',
      category: 'Breakable',
      baseEmoji: '⚠️',
      defaultExpression: 'ALERT',
      interactionType: 'warning_sign',
      breakable: true,
      biomes: ['plant'],
      spawnWeight: 35,
      spawnConditions: 'hazard_near',
      hazardType: 'visual'
    }
  };

  /**
   * Spawn rate configuration per floor range and biome
   */
  var SPAWN_RATES = {
    // Floor 1-10 (Tutorial/Early game)
    early: {
      minItems: 2,
      maxItems: 4,
      interactiveChance: 0.3 // 30% of items are interactive
    },
    // Floor 11-20 (Mid game)
    mid: {
      minItems: 3,
      maxItems: 6,
      interactiveChance: 0.5
    },
    // Floor 21-30 (Late game)
    late: {
      minItems: 4,
      maxItems: 8,
      interactiveChance: 0.7
    }
  };

  /**
   * Biome mapping (floor ranges)
   */
  var BIOME_FLOORS = {
    'cave': { min: 1, max: 4, name: 'GREY_CAVE' },
    'office': { min: 5, max: 9, name: 'OFFICE' },
    'mall': { min: 11, max: 15, name: 'MALL' },
    'museum': { min: 17, max: 21, name: 'INDUSTRIAL' }, // Museum is aerospace in spec
    'plant': { min: 23, max: 30, name: 'AEROSPACE' }
  };

  /**
   * Loot tables for breakable items
   */
  var LOOT_TABLES = {
    toy_loot: [
      { emoji: '🎎', name: 'Toy Figure', weight: 50, quantity: 1 },
      { emoji: '🧸', name: 'Rare Toy', weight: 15, quantity: 1 },
      { emoji: '🥤', name: 'Soda Can', weight: 35, quantity: 2 }
    ],
    office_loot: [
      { emoji: '📎', name: 'Paperclip', weight: 80, quantity: 3 },
      { emoji: '💾', name: 'USB Drive', weight: 40, quantity: 1 },
      { emoji: '🔑', name: 'Office Key', weight: 20, quantity: 1 }
    ]
  };

  /**
   * Text content library for interactive items
   */
  var TEXT_LIBRARY = {
    'OFF_002': [
      'System access denied. Clearance level insufficient.',
      'Email: Re: Budget cuts - All nonessential personnel...',
      'WARNING: Unauthorized access detected. Security has been notified.',
      'Project EYES ONLY - [REDACTED] - Access restricted'
    ],
    'OFF_020': [
      'MOTIVATIONAL POSTER: "Hang in there!"',
      'SAFETY NOTICE: Report all suspicious activity',
      'WANTED: Missing person - Last seen...',
      'EYES ONLY INITIATIVE - Classified'
    ],
    'MLL_003': [
      'You are here [X] - Food Court: Level 2, Electronics: Level 1',
      'Mall Directory - Store listings partially obscured',
      'Emergency Exit: Follow red signs'
    ],
    'CAV_010': [
      'Ancient cave painting depicts strange figures...',
      'Crude drawings suggest this was once inhabited',
      'Symbols you don\'t recognize cover the wall'
    ],
    'MSM_002': [
      'Artifact designation: UNKNOWN ORIGIN',
      'The object hums with an otherworldly energy...',
      'WARNING: Do not approach without protective gear'
    ]
  };

  /**
   * Initialize the spawner system
   */
  function init() {
    console.log('[ItemSpawner] Initialized with', Object.keys(ITEM_DEFINITIONS).length, 'item definitions');
  }

  /**
   * Get current biome name for a floor
   * @param {number} floor - Current floor number
   * @returns {string} Biome key
   */
  function getBiomeForFloor(floor) {
    for (var biomeKey in BIOME_FLOORS) {
      var biome = BIOME_FLOORS[biomeKey];
      if (floor >= biome.min && floor <= biome.max) {
        return biomeKey;
      }
    }
    return 'cave'; // Default fallback
  }

  /**
   * Get spawn rate configuration for floor
   * @param {number} floor - Current floor number
   * @returns {object} Spawn rate config
   */
  function getSpawnRateForFloor(floor) {
    if (floor <= 10) return SPAWN_RATES.early;
    if (floor <= 20) return SPAWN_RATES.mid;
    return SPAWN_RATES.late;
  }

  /**
   * Get eligible item definitions for biome
   * @param {string} biome - Biome key
   * @returns {array} Array of item definitions
   */
  function getItemsForBiome(biome) {
    var items = [];
    for (var itemId in ITEM_DEFINITIONS) {
      var item = ITEM_DEFINITIONS[itemId];
      if (item.biomes.includes(biome) || item.biomes.includes('all')) {
        items.push(item);
      }
    }
    return items;
  }

  /**
   * Spawn interactive items for a floor
   * @param {number} floor - Current floor number
   * @param {array} rooms - Room data from level generation
   * @param {object} grid - Level grid (for placement validation)
   * @returns {array} Array of spawned interactive items
   */
  function spawnItemsForFloor(floor, rooms, grid) {
    var biome = getBiomeForFloor(floor);
    var spawnConfig = getSpawnRateForFloor(floor);
    var eligibleItems = getItemsForBiome(biome);

    if (eligibleItems.length === 0) {
      console.log('[ItemSpawner] No items available for biome:', biome);
      return [];
    }

    // Calculate number of items to spawn
    var itemCount = Math.floor(
      spawnConfig.minItems +
      Math.random() * (spawnConfig.maxItems - spawnConfig.minItems)
    );

    // Filter for interactive items based on spawn chance
    var interactiveCount = Math.floor(itemCount * spawnConfig.interactiveChance);
    itemCount = Math.max(1, interactiveCount);

    var spawnedItems = [];
    var maxAttempts = 50;

    console.log('[ItemSpawner] Spawning', itemCount, 'items for floor', floor, 'biome:', biome);

    for (var i = 0; i < itemCount; i++) {
      var attempts = 0;
      var spawned = false;

      while (attempts < maxAttempts && !spawned) {
        attempts++;

        // Weighted random selection
        var selectedItem = _selectWeightedItem(eligibleItems);
        if (!selectedItem) continue;

        // Find valid spawn position
        var position = _findSpawnPosition(selectedItem, rooms, grid, spawnedItems);
        if (!position) continue;

        // Create interactive item instance
        var text = _getRandomText(selectedItem.itemId);
        var interactiveItem = null;

        if (typeof InteractiveItems !== 'undefined') {
          // Map to InteractiveItems.ITEM_TYPES
          var itemType = _mapToInteractiveType(selectedItem.category);

          interactiveItem = InteractiveItems.createItem(itemType, position.x, position.y, {
            emoji: selectedItem.baseEmoji,
            name: selectedItem.itemName,
            text: text,
            interactionEmoji: selectedItem.defaultExpression,
            customData: {
              itemId: selectedItem.itemId,
              biome: biome,
              floor: floor,
              breakable: selectedItem.breakable,
              lootTable: selectedItem.lootTable
            }
          });

          if (interactiveItem) {
            spawnedItems.push(interactiveItem);
            spawned = true;
          }
        }
      }
    }

    console.log('[ItemSpawner] Successfully spawned', spawnedItems.length, 'items');
    return spawnedItems;
  }

  /**
   * Select item using weighted random selection
   * @param {array} items - Array of item definitions
   * @returns {object} Selected item definition
   */
  function _selectWeightedItem(items) {
    var totalWeight = items.reduce(function(sum, item) {
      return sum + (item.spawnWeight || 10);
    }, 0);

    var random = Math.random() * totalWeight;
    var weightSum = 0;

    for (var i = 0; i < items.length; i++) {
      weightSum += items[i].spawnWeight || 10;
      if (random <= weightSum) {
        return items[i];
      }
    }

    return items[0]; // Fallback
  }

  /**
   * Find valid spawn position for item
   * @param {object} itemDef - Item definition
   * @param {array} rooms - Room data
   * @param {object} grid - Level grid
   * @param {array} existingItems - Already spawned items
   * @returns {object} Position {x, y} or null
   */
  function _findSpawnPosition(itemDef, rooms, grid, existingItems) {
    if (!rooms || rooms.length === 0) return null;

    // Select random room
    var room = rooms[Math.floor(Math.random() * rooms.length)];

    // Determine position based on spawn conditions
    var x, y;
    var condition = itemDef.spawnConditions;

    switch (condition) {
      case 'room_center':
        x = room.centerX || Math.floor(room.x + room.w / 2);
        y = room.centerY || Math.floor(room.y + room.h / 2);
        break;

      case 'wall_adjacent':
      case 'wall_clear':
        // Find position near room edge
        var side = Math.floor(Math.random() * 4);
        if (side === 0) { // Top
          x = room.x + Math.floor(Math.random() * room.w);
          y = room.y + 1;
        } else if (side === 1) { // Right
          x = room.x + room.w - 2;
          y = room.y + Math.floor(Math.random() * room.h);
        } else if (side === 2) { // Bottom
          x = room.x + Math.floor(Math.random() * room.w);
          y = room.y + room.h - 2;
        } else { // Left
          x = room.x + 1;
          y = room.y + Math.floor(Math.random() * room.h);
        }
        break;

      case 'floor_clear':
      case 'floor_adjacent':
      default:
        // Random position within room
        x = room.x + 2 + Math.floor(Math.random() * (room.w - 4));
        y = room.y + 2 + Math.floor(Math.random() * (room.h - 4));
        break;
    }

    // Validate position is within bounds
    if (!grid || !grid[y] || !grid[y][x]) {
      return null;
    }

    // Check not already occupied by another interactive item
    var occupied = existingItems.some(function(item) {
      return item.x === x && item.y === y;
    });

    if (occupied) return null;

    return { x: x, y: y };
  }

  /**
   * Get random text for item
   * @param {string} itemId - Item ID
   * @returns {string} Text content
   */
  function _getRandomText(itemId) {
    var texts = TEXT_LIBRARY[itemId];
    if (!texts || texts.length === 0) {
      return 'Nothing of interest here.';
    }
    return texts[Math.floor(Math.random() * texts.length)];
  }

  /**
   * Map item category to InteractiveItems type
   * @param {string} category - Item category from definition
   * @returns {string} InteractiveItems.ITEM_TYPES key
   */
  function _mapToInteractiveType(category) {
    var mapping = {
      'Readable': 'BOOK',
      'Transform': 'AREA_OF_INTEREST',
      'Breakable': 'LOCKER',
      'Light Source': 'AREA_OF_INTEREST',
      'Terminal': 'TERMINAL',
      'Storage': 'LOCKER'
    };
    return mapping[category] || 'AREA_OF_INTEREST';
  }

  /**
   * Add custom item definition at runtime
   * @param {object} itemDef - Item definition object
   */
  function addItemDefinition(itemDef) {
    if (!itemDef.itemId) {
      console.warn('[ItemSpawner] Item definition missing itemId');
      return;
    }
    ITEM_DEFINITIONS[itemDef.itemId] = itemDef;
    console.log('[ItemSpawner] Added custom item:', itemDef.itemId);
  }

  /**
   * Load item definitions from JSON
   * @param {object} definitionsJson - JSON object with item definitions
   */
  function loadDefinitions(definitionsJson) {
    if (!definitionsJson) return;

    for (var itemId in definitionsJson) {
      ITEM_DEFINITIONS[itemId] = definitionsJson[itemId];
    }

    console.log('[ItemSpawner] Loaded', Object.keys(definitionsJson).length, 'definitions');
  }

  /**
   * Get loot from loot table
   * @param {string} tableKey - Loot table key
   * @returns {array} Array of loot items
   */
  function rollLoot(tableKey) {
    var table = LOOT_TABLES[tableKey];
    if (!table) return [];

    // Weighted random selection
    var totalWeight = table.reduce(function(sum, item) {
      return sum + item.weight;
    }, 0);

    var random = Math.random() * totalWeight;
    var weightSum = 0;

    for (var i = 0; i < table.length; i++) {
      weightSum += table[i].weight;
      if (random <= weightSum) {
        return [{
          emoji: table[i].emoji,
          name: table[i].name,
          quantity: table[i].quantity
        }];
      }
    }

    return [];
  }

  // Public API
  return {
    init: init,
    getBiomeForFloor: getBiomeForFloor,
    getSpawnRateForFloor: getSpawnRateForFloor,
    getItemsForBiome: getItemsForBiome,
    spawnItemsForFloor: spawnItemsForFloor,
    addItemDefinition: addItemDefinition,
    loadDefinitions: loadDefinitions,
    rollLoot: rollLoot,
    ITEM_DEFINITIONS: ITEM_DEFINITIONS,
    SPAWN_RATES: SPAWN_RATES,
    BIOME_FLOORS: BIOME_FLOORS,
    LOOT_TABLES: LOOT_TABLES,
    TEXT_LIBRARY: TEXT_LIBRARY
  };
})();
