/* ============================================================
   EYES ONLY - Food Database System
   Food items that modify status/resources like currency/ammo
   Auto-pickup on interaction, disappear cleanly from map
   Spawn ghost collision nodes for overhead animator tooltips
   
   Schema: All items include resourceType, resourceColor, primaryEffect
   for procedural generators, designer tools, and real-time game.
   ============================================================ */

const FoodDatabase = (function() {
  'use strict';

  /**
   * Canonical resource colors for overhead animations
   * Used by procedural generators, designer tools, and game engine
   */
  var FOOD_RESOURCE_COLORS = {
    'HP':      '#FF6B9D',  // vibrant pink
    'Energy':  '#00D4FF',  // electric blue
    'Fatigue': '#A0522D',  // earthy brown
    'Inert':   '#CCCCCC'   // light grey (special items, no status)
  };

  /**
   * Food item definitions
   * Each food item modifies player stats/resources on pickup
   * Behaves like currency/ammo: auto-pickup, clean disappearance
   * 
   * Schema:
   * - id: unique identifier
   * - name: display name
   * - emoji: map/world render emoji
   * - category: food/drink/ration/special (for designer tools)
   * - resourceType: HP/Energy/Fatigue/Inert (for overhead color)
   * - resourceColor: hex color (canonical, computed from resourceType)
   * - primaryEffect: primary effect amount (for procedural gen)
   * - effects: effect values (hp, fatigue, energy, etc.)
   * - tooltipText: display string for tooltip
   * - spawnWeight: procedural spawn probability
   * - biomes: eligible biomes
   * - autoPickup: instant collection vs manual interaction
   * - groundEffect: oil/water/fire (forward-declare for environmental)
   */
  var FOOD_ITEMS = {
    // ═══════════════════════════════════════════════════════════
    // HP ITEMS — Pink #FF6B9D
    // Primary: +HP, Secondary: -Fatigue
    // Emojis: burger, vegetable, drumstick, sushi, ration
    // ═══════════════════════════════════════════════════════════
    'FOOD_APPLE': {
      id: 'FOOD_APPLE',
      name: 'Fresh Apple',
      emoji: '🍎',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 10,
      effects: { hp: 10, fatigue: -5 },
      tooltipText: '+10 HP, -5 Fatigue',
      spawnWeight: 40,
      biomes: ['forest', 'all'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_BREAD': {
      id: 'FOOD_BREAD',
      name: 'Bread Loaf',
      emoji: '🍞',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 15,
      effects: { hp: 15, fatigue: -10 },
      tooltipText: '+15 HP, -10 Fatigue',
      spawnWeight: 35,
      biomes: ['office', 'mall', 'all'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_PIZZA': {
      id: 'FOOD_PIZZA',
      name: 'Pizza Slice',
      emoji: '🍕',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 20,
      effects: { hp: 20, fatigue: -15 },
      tooltipText: '+20 HP, -15 Fatigue',
      spawnWeight: 25,
      biomes: ['mall', 'office'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_BURGER': {
      id: 'FOOD_BURGER',
      name: 'Hamburger',
      emoji: '🍔',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 25,
      effects: { hp: 25, fatigue: -20 },
      tooltipText: '+25 HP, -20 Fatigue',
      spawnWeight: 20,
      biomes: ['mall'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_SUSHI': {
      id: 'FOOD_SUSHI',
      name: 'Sushi Roll',
      emoji: '🍣',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 30,
      effects: { hp: 30, fatigue: -10 },
      tooltipText: '+30 HP, -10 Fatigue',
      spawnWeight: 15,
      biomes: ['mall', 'museum'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_DONUT': {
      id: 'FOOD_DONUT',
      name: 'Donut',
      emoji: '🍩',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 15,
      effects: { hp: 15, fatigue: -12 },
      tooltipText: '+15 HP, -12 Fatigue',
      spawnWeight: 28,
      biomes: ['office', 'mall'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_RATION': {
      id: 'FOOD_RATION',
      name: 'Field Ration',
      emoji: '🥫',
      category: 'ration',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 35,
      effects: { hp: 35, fatigue: -20, ammo: 3 },
      tooltipText: '+35 HP, -20 Fatigue, +3 Ammo',
      spawnWeight: 10,
      biomes: ['plant', 'cave'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_SALAD': {
      id: 'FOOD_SALAD',
      name: 'Garden Salad',
      emoji: '🥗',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 18,
      effects: { hp: 18, fatigue: -8 },
      tooltipText: '+18 HP, -8 Fatigue',
      spawnWeight: 22,
      biomes: ['mall', 'office', 'forest'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_DRUMSTICK': {
      id: 'FOOD_DRUMSTICK',
      name: 'Chicken Drumstick',
      emoji: '🍗',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 22,
      effects: { hp: 22, fatigue: -15 },
      tooltipText: '+22 HP, -15 Fatigue',
      spawnWeight: 25,
      biomes: ['forest', 'mall', 'cave'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_STEAK': {
      id: 'FOOD_STEAK',
      name: 'Grilled Steak',
      emoji: '🍖',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 40,
      effects: { hp: 40, fatigue: -25 },
      tooltipText: '+40 HP, -25 Fatigue',
      spawnWeight: 8,
      biomes: ['mall', 'industrial'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_CUTLET': {
      id: 'FOOD_CUTLET',
      name: 'Pork Cutlet',
      emoji: '🥩',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 32,
      effects: { hp: 32, fatigue: -18 },
      tooltipText: '+32 HP, -18 Fatigue',
      spawnWeight: 12,
      biomes: ['mall', 'office'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_SHRIMP': {
      id: 'FOOD_SHRIMP',
      name: 'Shrimp',
      emoji: '🍤',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 20,
      effects: { hp: 20, fatigue: -12 },
      tooltipText: '+20 HP, -12 Fatigue',
      spawnWeight: 18,
      biomes: ['mall', 'museum'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_EGG': {
      id: 'FOOD_EGG',
      name: 'Boiled Egg',
      emoji: '🥚',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 12,
      effects: { hp: 12, fatigue: -6 },
      tooltipText: '+12 HP, -6 Fatigue',
      spawnWeight: 30,
      biomes: ['forest', 'mall', 'all'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_CHEESE': {
      id: 'FOOD_CHEESE',
      name: 'Cheese Wedge',
      emoji: '🧀',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 14,
      effects: { hp: 14, fatigue: -7 },
      tooltipText: '+14 HP, -7 Fatigue',
      spawnWeight: 26,
      biomes: ['forest', 'mall'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_CARROT': {
      id: 'FOOD_CARROT',
      name: 'Carrot',
      emoji: '🥕',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 8,
      effects: { hp: 8, fatigue: -4 },
      tooltipText: '+8 HP, -4 Fatigue',
      spawnWeight: 35,
      biomes: ['forest', 'all'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_CORN': {
      id: 'FOOD_CORN',
      name: 'Corn Cob',
      emoji: '🌽',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 10,
      effects: { hp: 10, fatigue: -5 },
      tooltipText: '+10 HP, -5 Fatigue',
      spawnWeight: 32,
      biomes: ['forest', 'mall'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_STEW': {
      id: 'FOOD_STEW',
      name: 'Hot Stew',
      emoji: '🍲',
      category: 'food',
      resourceType: 'HP',
      resourceColor: FOOD_RESOURCE_COLORS.HP,
      primaryEffect: 35,
      effects: { hp: 35, fatigue: -22 },
      tooltipText: '+35 HP, -22 Fatigue',
      spawnWeight: 10,
      biomes: ['cave', 'industrial', 'office'],
      autoPickup: true,
      groundEffect: null
    },

    // ═══════════════════════════════════════════════════════════
    // ENERGY ITEMS — Electric Blue #00D4FF
    // Primary: -Fatigue (restores energy), Secondary: +HP
    // Emojis: coffee, energy drink, tea, etc.
    // ═══════════════════════════════════════════════════════════
    'FOOD_COFFEE': {
      id: 'FOOD_COFFEE',
      name: 'Hot Coffee',
      emoji: '☕',
      category: 'drink',
      resourceType: 'Energy',
      resourceColor: FOOD_RESOURCE_COLORS.Energy,
      primaryEffect: 25,
      effects: { hp: 5, fatigue: -25 },
      tooltipText: '+5 HP, -25 Fatigue',
      spawnWeight: 30,
      biomes: ['office', 'all'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_ENERGY_DRINK': {
      id: 'FOOD_ENERGY_DRINK',
      name: 'Energy Drink',
      emoji: '🥤',
      category: 'drink',
      resourceType: 'Energy',
      resourceColor: FOOD_RESOURCE_COLORS.Energy,
      primaryEffect: 30,
      effects: { hp: 10, fatigue: -30 },
      tooltipText: '+10 HP, -30 Fatigue',
      spawnWeight: 20,
      biomes: ['mall', 'plant'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_TEA': {
      id: 'FOOD_TEA',
      name: 'Green Tea',
      emoji: '🍵',
      category: 'drink',
      resourceType: 'Energy',
      resourceColor: FOOD_RESOURCE_COLORS.Energy,
      primaryEffect: 15,
      effects: { hp: 8, fatigue: -15 },
      tooltipText: '+8 HP, -15 Fatigue',
      spawnWeight: 25,
      biomes: ['museum', 'office'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_ESPRESSO': {
      id: 'FOOD_ESPRESSO',
      name: 'Espresso Shot',
      emoji: '🫖',
      category: 'drink',
      resourceType: 'Energy',
      resourceColor: FOOD_RESOURCE_COLORS.Energy,
      primaryEffect: 35,
      effects: { hp: 3, fatigue: -35 },
      tooltipText: '+3 HP, -35 Fatigue',
      spawnWeight: 12,
      biomes: ['office', 'mall'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_SMOOTHIE': {
      id: 'FOOD_SMOOTHIE',
      name: 'Fruit Smoothie',
      emoji: '🥛',
      category: 'drink',
      resourceType: 'Energy',
      resourceColor: FOOD_RESOURCE_COLORS.Energy,
      primaryEffect: 20,
      effects: { hp: 12, fatigue: -20 },
      tooltipText: '+12 HP, -20 Fatigue',
      spawnWeight: 18,
      biomes: ['mall', 'museum'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_SPORTS_DRINK': {
      id: 'FOOD_SPORTS_DRINK',
      name: 'Sports Drink',
      emoji: '🍶',
      category: 'drink',
      resourceType: 'Energy',
      resourceColor: FOOD_RESOURCE_COLORS.Energy,
      primaryEffect: 28,
      effects: { hp: 8, fatigue: -28 },
      tooltipText: '+8 HP, -28 Fatigue',
      spawnWeight: 15,
      biomes: ['mall', 'plant', 'industrial'],
      autoPickup: true,
      groundEffect: null
    },

    // ═══════════════════════════════════════════════════════════
    // FATIGUE ITEMS — Earthy Brown #A0522D
    // Primary: -Fatigue (mild), Secondary: +HP
    // Emojis: fruit, rice, bread
    // ═══════════════════════════════════════════════════════════
    'FOOD_BANANA': {
      id: 'FOOD_BANANA',
      name: 'Banana',
      emoji: '🍌',
      category: 'food',
      resourceType: 'Fatigue',
      resourceColor: FOOD_RESOURCE_COLORS.Fatigue,
      primaryEffect: 10,
      effects: { hp: 10, fatigue: -10 },
      tooltipText: '+10 HP, -10 Fatigue',
      spawnWeight: 30,
      biomes: ['forest', 'mall', 'all'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_ORANGE': {
      id: 'FOOD_ORANGE',
      name: 'Orange',
      emoji: '🍊',
      category: 'food',
      resourceType: 'Fatigue',
      resourceColor: FOOD_RESOURCE_COLORS.Fatigue,
      primaryEffect: 12,
      effects: { hp: 12, fatigue: -12 },
      tooltipText: '+12 HP, -12 Fatigue',
      spawnWeight: 28,
      biomes: ['forest', 'mall'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_GRAPES': {
      id: 'FOOD_GRAPES',
      name: 'Grapes',
      emoji: '🍇',
      category: 'food',
      resourceType: 'Fatigue',
      resourceColor: FOOD_RESOURCE_COLORS.Fatigue,
      primaryEffect: 8,
      effects: { hp: 8, fatigue: -8 },
      tooltipText: '+8 HP, -8 Fatigue',
      spawnWeight: 32,
      biomes: ['forest', 'mall', 'all'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_STRAWBERRY': {
      id: 'FOOD_STRAWBERRY',
      name: 'Strawberry',
      emoji: '🍓',
      category: 'food',
      resourceType: 'Fatigue',
      resourceColor: FOOD_RESOURCE_COLORS.Fatigue,
      primaryEffect: 7,
      effects: { hp: 7, fatigue: -7 },
      tooltipText: '+7 HP, -7 Fatigue',
      spawnWeight: 34,
      biomes: ['forest', 'mall'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_KIWI': {
      id: 'FOOD_KIWI',
      name: 'Kiwi Fruit',
      emoji: '🥝',
      category: 'food',
      resourceType: 'Fatigue',
      resourceColor: FOOD_RESOURCE_COLORS.Fatigue,
      primaryEffect: 11,
      effects: { hp: 11, fatigue: -11 },
      tooltipText: '+11 HP, -11 Fatigue',
      spawnWeight: 22,
      biomes: ['mall', 'museum'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_RICE': {
      id: 'FOOD_RICE',
      name: 'Rice Bowl',
      emoji: '🍚',
      category: 'food',
      resourceType: 'Fatigue',
      resourceColor: FOOD_RESOURCE_COLORS.Fatigue,
      primaryEffect: 16,
      effects: { hp: 16, fatigue: -16 },
      tooltipText: '+16 HP, -16 Fatigue',
      spawnWeight: 24,
      biomes: ['mall', 'office'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_COOKIE': {
      id: 'FOOD_COOKIE',
      name: 'Cookie',
      emoji: '🍪',
      category: 'food',
      resourceType: 'Fatigue',
      resourceColor: FOOD_RESOURCE_COLORS.Fatigue,
      primaryEffect: 6,
      effects: { hp: 6, fatigue: -6 },
      tooltipText: '+6 HP, -6 Fatigue',
      spawnWeight: 38,
      biomes: ['mall', 'office', 'all'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_CUPCAKE': {
      id: 'FOOD_CUPCAKE',
      name: 'Cupcake',
      emoji: '🧁',
      category: 'food',
      resourceType: 'Fatigue',
      resourceColor: FOOD_RESOURCE_COLORS.Fatigue,
      primaryEffect: 13,
      effects: { hp: 13, fatigue: -13 },
      tooltipText: '+13 HP, -13 Fatigue',
      spawnWeight: 26,
      biomes: ['mall', 'museum'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_CAKE': {
      id: 'FOOD_CAKE',
      name: 'Cake Slice',
      emoji: '🍰',
      category: 'food',
      resourceType: 'Fatigue',
      resourceColor: FOOD_RESOURCE_COLORS.Fatigue,
      primaryEffect: 19,
      effects: { hp: 19, fatigue: -19 },
      tooltipText: '+19 HP, -19 Fatigue',
      spawnWeight: 16,
      biomes: ['mall'],
      autoPickup: true,
      groundEffect: null
    },

    // ═══════════════════════════════════════════════════════════
    // INERT ITEMS — Light Grey #CCCCCC
    // Primary: No status effect, special items (water cleanse, candy bonus)
    // Emojis: water, candy (special, no resource status)
    // ═══════════════════════════════════════════════════════════
    'FOOD_CANDY': {
      id: 'FOOD_CANDY',
      name: 'Candy',
      emoji: '🍬',
      category: 'special',
      resourceType: 'Inert',
      resourceColor: FOOD_RESOURCE_COLORS.Inert,
      primaryEffect: 0,
      effects: { hp: 5, fatigue: -5, cryptos: 10 },
      tooltipText: '+5 HP, -5 Fatigue, +10¢',
      spawnWeight: 30,
      biomes: ['mall', 'all'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_WATER': {
      id: 'FOOD_WATER',
      name: 'Water Bottle',
      emoji: '💧',
      category: 'special',
      resourceType: 'Inert',
      resourceColor: FOOD_RESOURCE_COLORS.Inert,
      primaryEffect: 0,
      effects: { hp: 5, fatigue: -8, removeStatus: ['burning', 'poisoned'] },
      tooltipText: '+5 HP, -8 Fatigue, Cleanse',
      spawnWeight: 35,
      biomes: ['all'],
      autoPickup: true,
      groundEffect: 'water'
    },
    'FOOD_JUICE': {
      id: 'FOOD_JUICE',
      name: 'Fruit Juice',
      emoji: '🧃',
      category: 'special',
      resourceType: 'Inert',
      resourceColor: FOOD_RESOURCE_COLORS.Inert,
      primaryEffect: 0,
      effects: { hp: 12, fatigue: -10 },
      tooltipText: '+12 HP, -10 Fatigue',
      spawnWeight: 25,
      biomes: ['mall', 'office'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_LOLLIPOP': {
      id: 'FOOD_LOLLIPOP',
      name: 'Lollipop',
      emoji: '🍭',
      category: 'special',
      resourceType: 'Inert',
      resourceColor: FOOD_RESOURCE_COLORS.Inert,
      primaryEffect: 0,
      effects: { hp: 4, fatigue: -3, cryptos: 5 },
      tooltipText: '+4 HP, -3 Fatigue, +5¢',
      spawnWeight: 28,
      biomes: ['mall', 'all'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_DANGO': {
      id: 'FOOD_DANGO',
      name: 'Dango',
      emoji: '🍡',
      category: 'special',
      resourceType: 'Inert',
      resourceColor: FOOD_RESOURCE_COLORS.Inert,
      primaryEffect: 0,
      effects: { hp: 9, fatigue: -9 },
      tooltipText: '+9 HP, -9 Fatigue',
      spawnWeight: 20,
      biomes: ['museum', 'mall'],
      autoPickup: true,
      groundEffect: null
    },
    'FOOD_HONEY': {
      id: 'FOOD_HONEY',
      name: 'Honey Pot',
      emoji: '🍯',
      category: 'special',
      resourceType: 'Inert',
      resourceColor: FOOD_RESOURCE_COLORS.Inert,
      primaryEffect: 0,
      effects: { hp: 17, fatigue: -17 },
      tooltipText: '+17 HP, -17 Fatigue',
      spawnWeight: 14,
      biomes: ['forest', 'mall'],
      autoPickup: true,
      groundEffect: 'sticky'
    }
  };

  /**
   * Picnic blanket definition
   * Spawns 2-3 food items nearby, causes movement penalty
   */
  var PICNIC_BLANKET = {
    id: 'PICNIC_BLANKET',
    name: 'Cozy Picnic Blanket',
    emoji: '🧺',
    category: 'movement_penalty',
    resourceType: 'Inert',
    resourceColor: FOOD_RESOURCE_COLORS.Inert,
    primaryEffect: 0,
    autoPickup: false,
    movementPenalty: 0.5,
    tooltipText: 'Cozy picnic area - slows movement',
    spawnWeight: 15,
    foodSpawnCount: { min: 2, max: 3 },
    foodSpawnRadius: 2,
    biomes: ['forest', 'all'],
    interactionType: 'movement_impediment',
    lightingAffected: false,
    groundEffect: null
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
   * Get resource color for overhead animation
   * Used by procedural generators, designer tools, and game engine
   * @param {string} foodId - Food item ID
   * @returns {string} Hex color code
   */
  function getFoodResourceColor(foodId) {
    var food = FOOD_ITEMS[foodId];
    if (!food) return FOOD_RESOURCE_COLORS.HP;
    return food.resourceColor || FOOD_RESOURCE_COLORS.HP;
  }

  /**
   * Get resource type for categorization
   * @param {string} foodId - Food item ID
   * @returns {string} Resource type (HP/Energy/Fatigue/Inert)
   */
  function getFoodResourceType(foodId) {
    var food = FOOD_ITEMS[foodId];
    if (!food) return 'HP';
    return food.resourceType || 'HP';
  }

  /**
   * Get primary effect amount for procedural generation
   * @param {string} foodId - Food item ID
   * @returns {number} Primary effect value
   */
  function getFoodPrimaryEffect(foodId) {
    var food = FOOD_ITEMS[foodId];
    if (!food || !food.effects) return 0;
    var rt = food.resourceType;
    if (!rt) return food.effects.hp || 0;
    // Map resourceType to effects key
    var effectKey = rt.toLowerCase();
    return food.effects[effectKey] || food.effects.hp || 0;
  }

  /**
   * Get ground effect for environmental interactions
   * @param {string} foodId - Food item ID
   * @returns {string|null} Ground effect type (oil/water/fire/sticky/null)
   */
  function getFoodGroundEffect(foodId) {
    var food = FOOD_ITEMS[foodId];
    if (!food) return null;
    return food.groundEffect || null;
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
      if (food.biomes && (food.biomes.indexOf(biome) !== -1 || food.biomes.indexOf('all') !== -1)) {
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

    for (var i = 0; i < count && eligibleItems.length > 0; i++) {
      var totalWeight = 0;
      var weights = [];

      for (var j = 0; j < eligibleItems.length; j++) {
        var food = FOOD_ITEMS[eligibleItems[j]];
        totalWeight += food.spawnWeight || 1;
        weights.push({ id: eligibleItems[j], weight: totalWeight });
      }

      var random = Math.random() * totalWeight;
      for (var k = 0; k < weights.length; k++) {
        if (random <= weights[k].weight) {
          selected.push(weights[k].id);
          eligibleItems.splice(k, 1);
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
    var food = FOOD_ITEMS[foodId];
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
      resourceType: food.resourceType,
      resourceColor: food.resourceColor,
      primaryEffect: food.primaryEffect,
      groundEffect: food.groundEffect,
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

  /**
   * Get all items grouped by resource type
   * Useful for procedural generation and designer tools
   * @returns {object} Items grouped by resourceType
   */
  function getItemsByResourceType() {
    var grouped = {
      'HP': [],
      'Energy': [],
      'Fatigue': [],
      'Inert': []
    };
    for (var id in FOOD_ITEMS) {
      var food = FOOD_ITEMS[id];
      if (grouped[food.resourceType]) {
        grouped[food.resourceType].push(id);
      }
    }
    return grouped;
  }

  // Public API
  return {
    init: init,
    getFoodItem: getFoodItem,
    getFoodResourceColor: getFoodResourceColor,
    getFoodResourceType: getFoodResourceType,
    getFoodPrimaryEffect: getFoodPrimaryEffect,
    getFoodGroundEffect: getFoodGroundEffect,
    getFoodItemsForBiome: getFoodItemsForBiome,
    getRandomFoodItems: getRandomFoodItems,
    applyFoodEffects: applyFoodEffects,
    getPicnicBlanket: getPicnicBlanket,
    getItemsByResourceType: getItemsByResourceType,
    FOOD_ITEMS: FOOD_ITEMS,
    FOOD_RESOURCE_COLORS: FOOD_RESOURCE_COLORS
  };
})();
