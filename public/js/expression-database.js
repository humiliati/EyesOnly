/* ============================================================
   EYES ONLY - Expression Database
   Comprehensive database for visual feedback, food emojis,
   thought bubbles, and status effects
   ============================================================ */

const ExpressionDatabase = (function() {
  'use strict';

  /**
   * Food Emoji Collectibles Database
   * Each food item can be collected, consumed, or used in interactions
   */
  var FOOD_ITEMS = {
    // Basic Foods
    APPLE: { emoji: '🍎', name: 'Apple', heal: 5, energy: 3, rarity: 'common' },
    BANANA: { emoji: '🍌', name: 'Banana', heal: 4, energy: 5, rarity: 'common' },
    ORANGE: { emoji: '🍊', name: 'Orange', heal: 6, energy: 2, rarity: 'common' },
    GRAPES: { emoji: '🍇', name: 'Grapes', heal: 3, energy: 4, rarity: 'common' },
    WATERMELON: { emoji: '🍉', name: 'Watermelon', heal: 8, energy: 6, rarity: 'uncommon' },
    STRAWBERRY: { emoji: '🍓', name: 'Strawberry', heal: 4, energy: 3, rarity: 'common' },
    CHERRY: { emoji: '🍒', name: 'Cherry', heal: 3, energy: 2, rarity: 'common' },
    PEACH: { emoji: '🍑', name: 'Peach', heal: 5, energy: 4, rarity: 'common' },
    PEAR: { emoji: '🍐', name: 'Pear', heal: 5, energy: 3, rarity: 'common' },
    PINEAPPLE: { emoji: '🍍', name: 'Pineapple', heal: 10, energy: 8, rarity: 'rare' },

    // Vegetables
    CARROT: { emoji: '🥕', name: 'Carrot', heal: 4, energy: 2, rarity: 'common' },
    BROCCOLI: { emoji: '🥦', name: 'Broccoli', heal: 6, energy: 3, rarity: 'common' },
    CORN: { emoji: '🌽', name: 'Corn', heal: 7, energy: 5, rarity: 'common' },
    POTATO: { emoji: '🥔', name: 'Potato', heal: 5, energy: 6, rarity: 'common' },
    EGGPLANT: { emoji: '🍆', name: 'Eggplant', heal: 5, energy: 4, rarity: 'common' },
    TOMATO: { emoji: '🍅', name: 'Tomato', heal: 4, energy: 3, rarity: 'common' },

    // Fast Food / Prepared
    BURGER: { emoji: '🍔', name: 'Burger', heal: 15, energy: 10, rarity: 'uncommon' },
    PIZZA: { emoji: '🍕', name: 'Pizza', heal: 12, energy: 8, rarity: 'uncommon' },
    HOT_DOG: { emoji: '🌭', name: 'Hot Dog', heal: 10, energy: 7, rarity: 'common' },
    TACO: { emoji: '🌮', name: 'Taco', heal: 11, energy: 8, rarity: 'uncommon' },
    BURRITO: { emoji: '🌯', name: 'Burrito', heal: 14, energy: 12, rarity: 'uncommon' },
    SANDWICH: { emoji: '🥪', name: 'Sandwich', heal: 10, energy: 8, rarity: 'common' },
    FRIES: { emoji: '🍟', name: 'Fries', heal: 6, energy: 5, rarity: 'common' },

    // Snacks
    COOKIE: { emoji: '🍪', name: 'Cookie', heal: 5, energy: 4, rarity: 'common' },
    DONUT: { emoji: '🍩', name: 'Donut', heal: 7, energy: 6, rarity: 'common' },
    CANDY: { emoji: '🍬', name: 'Candy', heal: 3, energy: 5, rarity: 'common' },
    CHOCOLATE: { emoji: '🍫', name: 'Chocolate', heal: 8, energy: 7, rarity: 'uncommon' },
    POPCORN: { emoji: '🍿', name: 'Popcorn', heal: 4, energy: 3, rarity: 'common' },
    PRETZEL: { emoji: '🥨', name: 'Pretzel', heal: 6, energy: 5, rarity: 'common' },

    // Drinks
    COFFEE: { emoji: '☕', name: 'Coffee', heal: 0, energy: 15, rarity: 'common' },
    TEA: { emoji: '🍵', name: 'Tea', heal: 2, energy: 8, rarity: 'common' },
    MILK: { emoji: '🥛', name: 'Milk', heal: 5, energy: 4, rarity: 'common' },
    BEER: { emoji: '🍺', name: 'Beer', heal: 3, energy: -5, rarity: 'uncommon' },
    WINE: { emoji: '🍷', name: 'Wine', heal: 2, energy: -3, rarity: 'uncommon' },
    COCKTAIL: { emoji: '🍹', name: 'Cocktail', heal: 5, energy: -2, rarity: 'rare' },
    SODA: { emoji: '🥤', name: 'Soda', heal: 2, energy: 8, rarity: 'common' },

    // Asian Cuisine
    SUSHI: { emoji: '🍣', name: 'Sushi', heal: 12, energy: 10, rarity: 'rare' },
    RAMEN: { emoji: '🍜', name: 'Ramen', heal: 15, energy: 12, rarity: 'uncommon' },
    BENTO: { emoji: '🍱', name: 'Bento Box', heal: 18, energy: 15, rarity: 'rare' },
    RICE_BALL: { emoji: '🍙', name: 'Rice Ball', heal: 8, energy: 6, rarity: 'common' },
    CURRY: { emoji: '🍛', name: 'Curry', heal: 14, energy: 11, rarity: 'uncommon' },
    DUMPLINGS: { emoji: '🥟', name: 'Dumplings', heal: 10, energy: 8, rarity: 'uncommon' },

    // Desserts
    CAKE: { emoji: '🍰', name: 'Cake', heal: 10, energy: 8, rarity: 'uncommon' },
    PIE: { emoji: '🥧', name: 'Pie', heal: 12, energy: 9, rarity: 'uncommon' },
    ICE_CREAM: { emoji: '🍦', name: 'Ice Cream', heal: 8, energy: 6, rarity: 'common' },
    CUPCAKE: { emoji: '🧁', name: 'Cupcake', heal: 7, energy: 6, rarity: 'common' },

    // Special/Rare Items
    GOLDEN_APPLE: { emoji: '🏆', name: 'Golden Apple', heal: 50, energy: 50, rarity: 'legendary' },
    MYSTERY_BOX: { emoji: '🎁', name: 'Mystery Box', heal: 0, energy: 0, rarity: 'rare', special: 'random_effect' },
    ENERGY_DRINK: { emoji: '🧪', name: 'Energy Drink', heal: 0, energy: 30, rarity: 'rare' },
    HEALTH_POTION: { emoji: '💊', name: 'Health Potion', heal: 25, energy: 0, rarity: 'uncommon' }
  };

  /**
   * Thought Emoji Vocabulary
   * Used for player thinking about items, interactions, or decisions
   */
  var THOUGHT_EMOJIS = {
    // Item Consideration
    THINKING_FOOD: { emoji: '🤔', text: 'Should I eat this?', context: 'food_consideration' },
    THINKING_USE: { emoji: '💭', text: 'How should I use this?', context: 'item_use' },
    THINKING_EQUIP: { emoji: '⚔️', text: 'Should I equip this?', context: 'equipment' },
    THINKING_DROP: { emoji: '🗑️', text: 'Should I drop this?', context: 'inventory_management' },

    // Direction/Navigation
    THINKING_PATH: { emoji: '🧭', text: 'Which way?', context: 'navigation' },
    THINKING_DANGER: { emoji: '⚠️', text: 'This looks dangerous...', context: 'risk_assessment' },

    // NPC Interaction
    THINKING_TALK: { emoji: '💬', text: 'Should I talk to them?', context: 'social' },
    THINKING_TRADE: { emoji: '💰', text: 'What should I trade?', context: 'commerce' },
    THINKING_ATTACK: { emoji: '⚔️', text: 'Should I attack?', context: 'combat_decision' },

    // Puzzle/Mystery
    THINKING_PUZZLE: { emoji: '🧩', text: 'How does this work?', context: 'puzzle' },
    THINKING_CLUE: { emoji: '🔍', text: 'This is a clue...', context: 'investigation' },
    THINKING_SECRET: { emoji: '🔐', text: 'Something hidden here?', context: 'secret_discovery' },

    // Emotional
    THINKING_WORRY: { emoji: '😟', text: 'I\'m worried...', context: 'anxiety' },
    THINKING_EXCITED: { emoji: '✨', text: 'This is exciting!', context: 'anticipation' },
    THINKING_CONFUSED: { emoji: '😕', text: 'I\'m confused...', context: 'confusion' }
  };

  /**
   * Alert Emojis
   * Used for popup alerts and danger warnings
   */
  var ALERT_EMOJIS = {
    DANGER: { emoji: '!', color: '#ff0000', shake: true },
    WARNING: { emoji: '⚠️', color: '#ffaa00', pulse: true },
    INFO: { emoji: 'ℹ️', color: '#4488ff', fade: true },
    SPOTTED: { emoji: '👁️', color: '#ff0000', shake: true },
    NOISE: { emoji: '👂', color: '#ffff00', pulse: true },
    LOCKED: { emoji: '🔒', color: '#888888', static: true },
    UNLOCKED: { emoji: '🔓', color: '#00ff00', bounce: true },
    TRAP: { emoji: '💥', color: '#ff4444', flash: true }
  };

  /**
   * Status Effect Glyphs
   * ASCII-style expressions for combat and status effects
   */
  var STATUS_GLYPHS = {
    // Positive States
    HAPPY: { glyph: '^__^', color: '#00ff88', desc: 'Happy/Victorious' },
    CONFIDENT: { glyph: '^_^', color: '#00ff00', desc: 'Confident' },
    EXCITED: { glyph: '*_*', color: '#ffff00', desc: 'Excited/Amazed' },
    COOL: { glyph: '8-)', color: '#00ffff', desc: 'Cool/Relaxed' },
    LOVE: { glyph: '<3', color: '#ff88ff', desc: 'Love/Affection' },

    // Negative States
    SAD: { glyph: 'T_T', color: '#4488ff', desc: 'Crying/Sad' },
    HURT: { glyph: '>_<', color: '#ff4444', desc: 'Hurt/Pain' },
    ANGRY: { glyph: '>:(', color: '#ff0000', desc: 'Angry' },
    SHOCKED: { glyph: '@__@', color: '#ffff00', desc: 'Shocked/Dazed' },
    DEAD: { glyph: 'x_x', color: '#666666', desc: 'Defeated/Dead' },
    DIZZY: { glyph: '@_@', color: '#ff88ff', desc: 'Dizzy/Confused' },
    SLEEPY: { glyph: '-_-', color: '#88ccff', desc: 'Sleepy/Tired' },

    // Neutral/Special
    THINKING: { glyph: '..', color: '#aaaaaa', desc: 'Thinking' },
    SUSPICIOUS: { glyph: '-_-', color: '#ffaa00', desc: 'Suspicious' },
    DETERMINED: { glyph: '`_´', color: '#ff8800', desc: 'Determined' },
    SMIRK: { glyph: '¬_¬', color: '#ff88ff', desc: 'Smirking' },
    SWEAT: { glyph: '^^;', color: '#aaddff', desc: 'Nervous/Sweating' }
  };

  /**
   * Collectible Animation Definitions
   * Bounce patterns for items appearing in world
   */
  var COLLECTIBLE_ANIMATIONS = {
    BOUNCE_STANDARD: {
      type: 'bounce',
      height: 20,
      duration: 800,
      easing: 'ease-out',
      loop: true
    },
    BOUNCE_RARE: {
      type: 'bounce_sparkle',
      height: 30,
      duration: 600,
      easing: 'ease-in-out',
      loop: true,
      particles: '✨'
    },
    BOUNCE_LEGENDARY: {
      type: 'bounce_glow',
      height: 40,
      duration: 500,
      easing: 'ease-in-out',
      loop: true,
      glow: true,
      particles: '⭐'
    },
    FLOAT_GENTLE: {
      type: 'float',
      height: 5,
      duration: 2000,
      easing: 'ease-in-out',
      loop: true
    }
  };

  /**
   * MOK Interjection Templates
   * Pre-formatted speech for MOK AI director
   */
  var MOK_INTERJECTIONS = {
    // Pickup Actions
    FOOD_PICKUP: { template: '🍴 {playerName} acquired {itemName}', type: 'info' },
    RARE_PICKUP: { template: '✨ {playerName} found {itemName}!', type: 'exciting' },
    CURRENCY_PICKUP: { template: '💰 {playerName} collected {amount}¢', type: 'info' },

    // Combat
    COMBAT_START: { template: '⚔️ {playerName} engaging {enemyName}', type: 'alert' },
    COMBAT_VICTORY: { template: '🏆 {playerName} defeated {enemyName}', type: 'victory' },
    COMBAT_DEFEAT: { template: '💀 {playerName} was defeated', type: 'warning' },
    CRITICAL_HIT: { template: '‼️ CRITICAL HIT by {attackerName}!', type: 'exciting' },

    // Status Changes
    LEVEL_UP: { template: '⬆️ {playerName} reached level {level}!', type: 'victory' },
    STATUS_EFFECT: { template: '💫 {playerName} is {statusName}', type: 'info' },
    LOW_HEALTH: { template: '⚠️ {playerName} health critical!', type: 'warning' },

    // Exploration
    SECRET_FOUND: { template: '🔍 {playerName} discovered a secret!', type: 'exciting' },
    TRAP_TRIGGERED: { template: '💥 {playerName} triggered a trap!', type: 'alert' },
    DOOR_LOCKED: { template: '🔒 Door is locked. Need key.', type: 'info' },
    DOOR_UNLOCKED: { template: '🔓 Door unlocked!', type: 'info' }
  };

  /**
   * Get food item by key
   */
  function getFoodItem(key) {
    return FOOD_ITEMS[key] || null;
  }

  /**
   * Get random food item by rarity
   */
  function getRandomFoodByRarity(rarity) {
    var items = Object.keys(FOOD_ITEMS).filter(function(key) {
      return FOOD_ITEMS[key].rarity === rarity;
    });
    if (items.length === 0) return null;
    var randomKey = items[Math.floor(Math.random() * items.length)];
    return FOOD_ITEMS[randomKey];
  }

  /**
   * Get thought emoji by context
   */
  function getThoughtEmoji(context) {
    for (var key in THOUGHT_EMOJIS) {
      if (THOUGHT_EMOJIS[key].context === context) {
        return THOUGHT_EMOJIS[key];
      }
    }
    return THOUGHT_EMOJIS.THINKING_USE; // Default
  }

  /**
   * Get alert emoji by type
   */
  function getAlertEmoji(alertType) {
    return ALERT_EMOJIS[alertType] || ALERT_EMOJIS.INFO;
  }

  /**
   * Get status glyph by key
   */
  function getStatusGlyph(key) {
    return STATUS_GLYPHS[key] || STATUS_GLYPHS.THINKING;
  }

  /**
   * Get collectible animation by rarity
   */
  function getCollectibleAnimation(rarity) {
    switch (rarity) {
      case 'legendary':
        return COLLECTIBLE_ANIMATIONS.BOUNCE_LEGENDARY;
      case 'rare':
        return COLLECTIBLE_ANIMATIONS.BOUNCE_RARE;
      default:
        return COLLECTIBLE_ANIMATIONS.BOUNCE_STANDARD;
    }
  }

  /**
   * Format MOK interjection message
   */
  function formatMOKInterjection(templateKey, data) {
    var template = MOK_INTERJECTIONS[templateKey];
    if (!template) return null;

    var message = template.template;
    for (var key in data) {
      message = message.replace('{' + key + '}', data[key]);
    }

    return {
      message: message,
      type: template.type
    };
  }

  /**
   * Get all food items (for inventory system)
   */
  function getAllFoodItems() {
    return FOOD_ITEMS;
  }

  /**
   * Search food items by name
   */
  function searchFoodByName(searchTerm) {
    var results = [];
    var lowerSearch = searchTerm.toLowerCase();

    for (var key in FOOD_ITEMS) {
      if (FOOD_ITEMS[key].name.toLowerCase().indexOf(lowerSearch) !== -1) {
        results.push(FOOD_ITEMS[key]);
      }
    }

    return results;
  }

  // Public API
  return {
    // Data Access
    getFoodItem: getFoodItem,
    getRandomFoodByRarity: getRandomFoodByRarity,
    getThoughtEmoji: getThoughtEmoji,
    getAlertEmoji: getAlertEmoji,
    getStatusGlyph: getStatusGlyph,
    getCollectibleAnimation: getCollectibleAnimation,
    formatMOKInterjection: formatMOKInterjection,
    getAllFoodItems: getAllFoodItems,
    searchFoodByName: searchFoodByName,

    // Direct access to databases (for iteration/reference)
    FOOD_ITEMS: FOOD_ITEMS,
    THOUGHT_EMOJIS: THOUGHT_EMOJIS,
    ALERT_EMOJIS: ALERT_EMOJIS,
    STATUS_GLYPHS: STATUS_GLYPHS,
    COLLECTIBLE_ANIMATIONS: COLLECTIBLE_ANIMATIONS,
    MOK_INTERJECTIONS: MOK_INTERJECTIONS
  };
})();
