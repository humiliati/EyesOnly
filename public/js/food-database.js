/* ============================================================
   EYES ONLY - Food Database System
   Food items that modify status/resources like currency/ammo
   Auto-pickup on interaction, disappear cleanly from map
   Spawn ghost collision nodes for overhead animator tooltips
   ============================================================ */

const FoodDatabase = (function() {
  'use strict';

  /**
   * Food item definitions
   * Each food item modifies player stats/resources on pickup
   * Behaves like currency/ammo: auto-pickup, clean disappearance
   */
  var FOOD_ITEMS = {
    // Health restoration
    'FOOD_APPLE': {
      id: 'FOOD_APPLE',
      name: 'Fresh Apple',
      emoji: '🍎',
      category: 'health',
      autoPickup: true,
      effects: {
        hp: 10,
        fatigue: -5 // Reduces fatigue
      },
      tooltipText: '+10 HP, -5 Fatigue',
      spawnWeight: 40,
      biomes: ['forest', 'all']
    },
    'FOOD_BREAD': {
      id: 'FOOD_BREAD',
      name: 'Bread Loaf',
      emoji: '🍞',
      category: 'health',
      autoPickup: true,
      effects: {
        hp: 15,
        fatigue: -10
      },
      tooltipText: '+15 HP, -10 Fatigue',
      spawnWeight: 35,
      biomes: ['office', 'mall', 'all']
    },
    'FOOD_PIZZA': {
      id: 'FOOD_PIZZA',
      name: 'Pizza Slice',
      emoji: '🍕',
      category: 'health',
      autoPickup: true,
      effects: {
        hp: 20,
        fatigue: -15
      },
      tooltipText: '+20 HP, -15 Fatigue',
      spawnWeight: 25,
      biomes: ['mall', 'office']
    },
    'FOOD_BURGER': {
      id: 'FOOD_BURGER',
      name: 'Hamburger',
      emoji: '🍔',
      category: 'health',
      autoPickup: true,
      effects: {
        hp: 25,
        fatigue: -20
      },
      tooltipText: '+25 HP, -20 Fatigue',
      spawnWeight: 20,
      biomes: ['mall']
    },
    'FOOD_SUSHI': {
      id: 'FOOD_SUSHI',
      name: 'Sushi Roll',
      emoji: '🍣',
      category: 'health',
      autoPickup: true,
      effects: {
        hp: 30,
        fatigue: -10
      },
      tooltipText: '+30 HP, -10 Fatigue',
      spawnWeight: 15,
      biomes: ['mall', 'museum']
    },

    // Fatigue recovery (coffee/energy)
    'FOOD_COFFEE': {
      id: 'FOOD_COFFEE',
      name: 'Hot Coffee',
      emoji: '☕',
      category: 'energy',
      autoPickup: true,
      effects: {
        hp: 5,
        fatigue: -25 // Strong fatigue reduction
      },
      tooltipText: '+5 HP, -25 Fatigue',
      spawnWeight: 30,
      biomes: ['office', 'all']
    },
    'FOOD_ENERGY_DRINK': {
      id: 'FOOD_ENERGY_DRINK',
      name: 'Energy Drink',
      emoji: '🥤',
      category: 'energy',
      autoPickup: true,
      effects: {
        hp: 10,
        fatigue: -30 // Maximum fatigue reduction
      },
      tooltipText: '+10 HP, -30 Fatigue',
      spawnWeight: 20,
      biomes: ['mall', 'plant']
    },
    'FOOD_TEA': {
      id: 'FOOD_TEA',
      name: 'Green Tea',
      emoji: '🍵',
      category: 'energy',
      autoPickup: true,
      effects: {
        hp: 8,
        fatigue: -15
      },
      tooltipText: '+8 HP, -15 Fatigue',
      spawnWeight: 25,
      biomes: ['museum', 'office']
    },

    // Special items (ammo/currency)
    'FOOD_RATION': {
      id: 'FOOD_RATION',
      name: 'Field Ration',
      emoji: '🥫',
      category: 'special',
      autoPickup: true,
      effects: {
        hp: 35,
        fatigue: -20,
        ammo: 3 // Also restores ammo
      },
      tooltipText: '+35 HP, -20 Fatigue, +3 Ammo',
      spawnWeight: 10,
      biomes: ['plant', 'cave']
    },
    'FOOD_CANDY': {
      id: 'FOOD_CANDY',
      name: 'Candy',
      emoji: '🍬',
      category: 'special',
      autoPickup: true,
      effects: {
        hp: 5,
        fatigue: -5,
        cryptos: 10 // Small currency bonus
      },
      tooltipText: '+5 HP, -5 Fatigue, +10¢',
      spawnWeight: 30,
      biomes: ['mall', 'all']
    },
    'FOOD_DONUT': {
      id: 'FOOD_DONUT',
      name: 'Donut',
      emoji: '🍩',
      category: 'health',
      autoPickup: true,
      effects: {
        hp: 15,
        fatigue: -12
      },
      tooltipText: '+15 HP, -12 Fatigue',
      spawnWeight: 28,
      biomes: ['office', 'mall']
    },

    // Water (status effect removal)
    'FOOD_WATER': {
      id: 'FOOD_WATER',
      name: 'Water Bottle',
      emoji: '💧',
      category: 'status',
      autoPickup: true,
      effects: {
        hp: 5,
        fatigue: -8,
        removeStatus: ['burning', 'poisoned'] // Removes negative status effects
      },
      tooltipText: '+5 HP, -8 Fatigue, Cleanse',
      spawnWeight: 35,
      biomes: ['all']
    },
    'FOOD_JUICE': {
      id: 'FOOD_JUICE',
      name: 'Fruit Juice',
      emoji: '🧃',
      category: 'status',
      autoPickup: true,
      effects: {
        hp: 12,
        fatigue: -10
      },
      tooltipText: '+12 HP, -10 Fatigue',
      spawnWeight: 25,
      biomes: ['mall', 'office']
    }
  };

  /**
   * Picnic blanket definition
   * Spawns 2-3 food items nearby, causes movement penalty
   */
  var PICNIC_BLANKET = {
    id: 'PICNIC_BLANKET',
    name: 'Cozy Picnic Blanket',
    emoji: '🧺', // Using picnic basket emoji (close to blanket concept)
    category: 'movement_penalty',
    autoPickup: false,
    movementPenalty: 0.5, // 50% movement speed reduction
    tooltipText: 'Cozy picnic area - slows movement',
    spawnWeight: 15,
    foodSpawnCount: { min: 2, max: 3 }, // Spawns 2-3 food items nearby
    foodSpawnRadius: 2, // Within 2 tiles
    biomes: ['forest', 'all'],
    interactionType: 'movement_impediment', // Non-resource changing
    lightingAffected: false
  };

  /**
   * Initialize food database
   */
  function init() {
    console.log('[FoodDatabase] Initialized with', Object.keys(FOOD_ITEMS).length, 'food items');
  }

  /**
   * Get food item by ID
   * @param {string} id - Food item ID
   * @returns {object|null} Food item definition
   */
  function getFoodItem(id) {
    return FOOD_ITEMS[id] || null;
  }

  /**
   * Get all food items for a biome
   * @param {string} biome - Biome name
   * @returns {array} Array of food item IDs
   */
  function getFoodItemsForBiome(biome) {
    var items = [];
    for (var id in FOOD_ITEMS) {
      var food = FOOD_ITEMS[id];
      if (food.biomes.includes(biome) || food.biomes.includes('all')) {
        items.push(id);
      }
    }
    return items;
  }

  /**
   * Get random food items for picnic blanket spawn
   * @param {string} biome - Current biome
   * @param {number} count - Number of items to spawn
   * @returns {array} Array of food item IDs
   */
  function getRandomFoodItems(biome, count) {
    var eligibleItems = getFoodItemsForBiome(biome);
    var selected = [];

    // Weight-based selection
    for (var i = 0; i < count && eligibleItems.length > 0; i++) {
      var totalWeight = 0;
      var weights = [];

      for (var j = 0; j < eligibleItems.length; j++) {
        var food = FOOD_ITEMS[eligibleItems[j]];
        totalWeight += food.spawnWeight;
        weights.push({ id: eligibleItems[j], weight: totalWeight });
      }

      var random = Math.random() * totalWeight;
      for (var k = 0; k < weights.length; k++) {
        if (random <= weights[k].weight) {
          selected.push(weights[k].id);
          // Remove selected item to avoid duplicates
          eligibleItems.splice(k, 0);
          break;
        }
      }
    }

    return selected;
  }

  /**
   * Apply food effects to player
   * @param {string} foodId - Food item ID
   * @param {object} player - Player object
   * @returns {object} Result with success status and effects applied
   */
  function applyFoodEffects(foodId, player) {
    var food = getFoodItem(foodId);
    if (!food) {
      return { success: false, error: 'Unknown food item' };
    }

    var effectsApplied = [];
    var effects = food.effects;

    // Apply HP restoration (HP lives on player object, not GAMESTATE)
    if (effects.hp && player) {
      var hpBefore = player.hp || 0;
      var maxHp = player.maxHp || 10;
      player.hp = Math.min(maxHp, hpBefore + effects.hp);
      effectsApplied.push({ type: 'hp', amount: player.hp - hpBefore });
    }

    // Apply fatigue reduction (negative fatigue value = reduce fatigue)
    if (effects.fatigue && typeof GAMESTATE !== 'undefined') {
      var absReduction = Math.abs(effects.fatigue);
      if (effects.fatigue < 0 && GAMESTATE.reduceFatigue) {
        GAMESTATE.reduceFatigue(absReduction);
      } else if (effects.fatigue > 0 && GAMESTATE.addFatigue) {
        GAMESTATE.addFatigue(effects.fatigue);
      }
      effectsApplied.push({ type: 'fatigue', amount: effects.fatigue });
    }

    // Apply ammo restoration
    if (effects.ammo && typeof GAMESTATE !== 'undefined') {
      GAMESTATE.addAmmo(effects.ammo);
      effectsApplied.push({ type: 'ammo', amount: effects.ammo });
    }

    // Apply currency bonus
    if (effects.cryptos && typeof GAMESTATE !== 'undefined') {
      GAMESTATE.addCryptos(effects.cryptos);
      effectsApplied.push({ type: 'cryptos', amount: effects.cryptos });
    }

    // Remove status effects
    if (effects.removeStatus && typeof GAMESTATE !== 'undefined') {
      for (var i = 0; i < effects.removeStatus.length; i++) {
        // TODO: Integrate with status effect system when implemented
        effectsApplied.push({ type: 'status_removed', status: effects.removeStatus[i] });
      }
    }

    return {
      success: true,
      foodName: food.name,
      emoji: food.emoji,
      effectsApplied: effectsApplied,
      tooltipText: food.tooltipText
    };
  }

  /**
   * Get picnic blanket definition
   * @returns {object} Picnic blanket definition
   */
  function getPicnicBlanket() {
    return PICNIC_BLANKET;
  }

  // Public API
  return {
    init: init,
    getFoodItem: getFoodItem,
    getFoodItemsForBiome: getFoodItemsForBiome,
    getRandomFoodItems: getRandomFoodItems,
    applyFoodEffects: applyFoodEffects,
    getPicnicBlanket: getPicnicBlanket,
    FOOD_ITEMS: FOOD_ITEMS
  };
})();
