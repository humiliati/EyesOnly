/* ============================================================
   EYES ONLY - Card System (Diablo-style loot)
   Quality rolls, affixes, and item generation
   ============================================================ */

const CardSystem = (function () {
  'use strict';

  // STR Combat Priority System
  // Lower number = executes first in simultaneous resolution
  var CARD_PRIORITIES = {
    interrupt: 1,  // Interrupt actions (dive for cover, jam weapon, overwatch)
    defense: 2,    // Defense actions (block, dodge)
    movement: 3,   // Movement actions (close distance, retreat, strafe)
    attack: 4,     // Attack actions (fire weapon)
    setup: 5       // Setup/utility actions (next-round buffs, items)
  };

  var QUALITIES = {
    CRACKED: { name: 'Cracked', color: 'gray', roll: 18 },
    WORN: { name: 'Worn', color: 'lightgray', roll: 22 },
    STANDARD: { name: 'Standard', color: 'white', roll: 25 },
    FINE: { name: 'Fine', color: 'lightblue', roll: 15 },
    SUPERIOR: { name: 'Superior', color: 'yellow', roll: 10 },
    ELITE: { name: 'Elite', color: 'orange', roll: 6 },
    MASTERWORK: { name: 'Masterwork', color: 'gold', roll: 3 },
    NEAR_PERFECT: { name: 'Near Perfect', color: 'lightgreen', roll: 0.9 },
    PERFECT: { name: 'Perfect', color: 'violet', roll: 0.1 }
  };

  var BASE_CARDS = {
    // ========== INTERRUPT CARDS (Priority 1) ==========
    DIVE_COVER: {
      category: 'interrupt',
      type: 'interrupt',
      name: 'Dive for Cover',
      emoji: '🤸',
      baseStats: { defense: 5, evasion: 3, energy: 2, speed: 5 }
    },
    JAM_WEAPON: {
      category: 'interrupt',
      type: 'interrupt',
      name: 'Jam Weapon',
      emoji: '🔧',
      baseStats: { disrupt: 1, energy: 2, speed: 5 }
    },
    OVERWATCH: {
      category: 'interrupt',
      type: 'interrupt',
      name: 'Overwatch Shot',
      emoji: '👁️',
      baseStats: { damage: 3, accuracy: 85, energy: 3, speed: 5 }
    },

    // ========== DEFENSE CARDS (Priority 2) ==========
    BLOCK: {
      category: 'defense',
      type: 'defense',
      name: 'Block',
      emoji: '🛡️',
      baseStats: { defense: 4, energy: 2, speed: 4 }
    },
    DODGE: {
      category: 'defense',
      type: 'defense',
      name: 'Dodge',
      emoji: '💨',
      baseStats: { evasion: 3, energy: 2, speed: 4 }
    },
    PRONE: {
      category: 'defense',
      type: 'defense',
      name: 'Prone',
      emoji: '🛡️',
      baseStats: { defense: 3, stealth: 2, mobility: -1, energy: 1, speed: 3 }
    },
    KNEEL: {
      category: 'defense',
      type: 'defense',
      name: 'Kneel',
      emoji: '🧎',
      baseStats: { defense: 2, accuracy: 1, mobility: 0, energy: 1, speed: 3 }
    },

    // ========== MOVEMENT CARDS (Priority 3) ==========
    CLOSE_DISTANCE: {
      category: 'movement',
      type: 'movement',
      name: 'Close Distance',
      emoji: '⏩',
      baseStats: { distance: 2, risk: 1, energy: 2, speed: 3 }
    },
    RETREAT: {
      category: 'movement',
      type: 'movement',
      name: 'Retreat',
      emoji: '↩️',
      baseStats: { distance: -2, safety: 2, energy: 1, speed: 3 }
    },
    STRAFE: {
      category: 'movement',
      type: 'movement',
      name: 'Strafe',
      emoji: '↔️',
      baseStats: { evasion: 2, distance: 1, energy: 2, speed: 3 }
    },
    ROLL: {
      category: 'movement',
      type: 'movement',
      name: 'Combat Roll',
      emoji: '🔄',
      baseStats: { evasion: 4, distance: 1, energy: 3, speed: 4 }
    },

    // ========== ATTACK CARDS (Priority 4) ==========
    SINGLE_SHOT: {
      category: 'attack',
      type: 'attack',
      name: 'Single Shot',
      emoji: '🎯',
      baseStats: { damage: 3, noise: 1, accuracy: 80, energy: 2, speed: 3 }
    },
    BURST_SHOT: {
      category: 'attack',
      type: 'attack',
      name: 'Burst Shot',
      emoji: '💥',
      baseStats: { damage: 5, noise: 3, accuracy: 70, energy: 3, speed: 2 }
    },
    SILENT_SHOT: {
      category: 'attack',
      type: 'attack',
      name: 'Silent Shot',
      emoji: '🔇',
      baseStats: { damage: 3, noise: 1, accuracy: 80, energy: 2, speed: 3 }
    },
    EXPLOSIVE_SHOT: {
      category: 'attack',
      type: 'attack',
      name: 'Explosive Shot',
      emoji: '💣',
      baseStats: { damage: 8, noise: 5, accuracy: 60, energy: 4, speed: 1 }
    },
    SUPPRESSIVE_FIRE: {
      category: 'attack',
      type: 'attack',
      name: 'Suppressive Fire',
      emoji: '🔥',
      baseStats: { damage: 2, accuracy: 50, suppress: 3, energy: 3, speed: 2 }
    },

    // ========== SETUP/UTILITY CARDS (Priority 5) ==========
    CIGARETTES: {
      category: 'setup',
      type: 'setup',
      name: 'Cigarettes',
      emoji: '🚬',
      baseStats: { stress: -2, attack_boost: 2, speed_boost: 1, hp_drain: 1, duration: 1, energy: 1, speed: 2 }
    },
    KATCHUP: {
      category: 'setup',
      type: 'setup',
      name: 'Katchup',
      emoji: '🩹',
      baseStats: { hp: 3, energy: 1, speed: 2 }
    },
    RATIONS: {
      category: 'setup',
      type: 'setup',
      name: 'Rations',
      emoji: '🍖',
      baseStats: { hp: 4, duration: 2, energy: 2, speed: 2 }
    },
    TOTAL_EVASION: {
      category: 'setup',
      type: 'setup',
      name: 'Total Evasion',
      emoji: '🌫️',
      baseStats: { evasion: 5, exhaust: true, energy: 3, speed: 2 }
    },
    AIM: {
      category: 'setup',
      type: 'setup',
      name: 'Aim',
      emoji: '🎯',
      baseStats: { accuracy_boost: 20, next_turn: true, energy: 1, speed: 2 }
    },

    // ========== DEPRECATED/LEGACY CARDS (for backward compatibility) ==========
    // Defense/Stance cards (now in defense category)

    // Tactical cards (now split into movement/interrupt categories)

    // Special: Inventory Charm (rare)
    INVENTORY_CHARM: {
      category: 'charm',
      type: 'charm',
      name: 'Inventory Charm',
      emoji: '🪬',
      baseStats: { slots: 0, speed: 1 }
    }
  };

  var AFFIXES = {
    // Weapon affixes
    SUPPRESSED: { name: 'Suppressed', stat: 'noise', mod: -0.5 },
    HAIR_TRIGGER: { name: 'Hair Trigger', stat: 'energy', mod: -1 },
    ARMOR_PIERCING: { name: 'Armor Piercing', stat: 'damage', mod: 1.2 },
    HOLLOW_POINT: { name: 'Hollow Point', stat: 'damage', mod: 1.3 },
    GHOSTED: { name: 'Ghosted', stat: 'detection', mod: -2 },
    RICOCHET: { name: 'Ricochet', stat: 'bonus', value: 'hits_twice' },
    DOUBLE_TAP: { name: 'Double Tap', stat: 'bonus', value: 'fire_twice' },

    // Stance affixes
    GHILLIE_THREADED: { name: 'Ghillie Threaded', stat: 'stealth', mod: 2 },
    COMBAT_ROLL: { name: 'Combat Roll Ready', stat: 'bonus', value: 'free_dodge' },
    SNIPER_TRAINED: { name: 'Sniper Trained', stat: 'accuracy', mod: 10 },

    // Utility affixes
    UNFILTERED: { name: 'Unfiltered', stat: 'bonus', value: 'attack_boost_hp_drain' },
    CALMING: { name: 'Calming', stat: 'stealth', mod: 1 },
    ADRENAL: { name: 'Adrenal', stat: 'speed', mod: 1 }
  };

  /**
   * Roll a quality tier based on probability distribution
   */
  function rollQuality() {
    var roll = Math.random() * 100;
    var cumulative = 0;

    for (var key in QUALITIES) {
      cumulative += QUALITIES[key].roll;
      if (roll <= cumulative) {
        return key;
      }
    }

    return 'STANDARD'; // Fallback
  }

  /**
   * Roll stats based on base card and quality
   */
  function rollStats(baseCard, quality) {
    var stats = Object.assign({}, baseCard.baseStats);
    var qualityMod = 1.0;

    switch (quality) {
      case 'CRACKED': qualityMod = 0.7; break;
      case 'WORN': qualityMod = 0.85; break;
      case 'STANDARD': qualityMod = 1.0; break;
      case 'FINE': qualityMod = 1.15; break;
      case 'SUPERIOR': qualityMod = 1.3; break;
      case 'ELITE': qualityMod = 1.5; break;
      case 'MASTERWORK': qualityMod = 1.7; break;
      case 'NEAR_PERFECT': qualityMod = 1.9; break;
      case 'PERFECT': qualityMod = 2.0; break;
    }

    // Apply quality modifier to all numeric stats
    for (var stat in stats) {
      if (typeof stats[stat] === 'number') {
        stats[stat] = Math.round(stats[stat] * qualityMod);
      }
    }

    return stats;
  }

  /**
   * Roll affixes based on quality (higher quality = more chance)
   */
  function rollAffixes(quality) {
    var affixes = [];
    var affixChance = 0;

    switch (quality) {
      case 'CRACKED': affixChance = 0; break;
      case 'WORN': affixChance = 0; break;
      case 'STANDARD': affixChance = 5; break;
      case 'FINE': affixChance = 15; break;
      case 'SUPERIOR': affixChance = 30; break;
      case 'ELITE': affixChance = 50; break;
      case 'MASTERWORK': affixChance = 75; break;
      case 'NEAR_PERFECT': affixChance = 90; break;
      case 'PERFECT': affixChance = 100; break;
    }

    if (Math.random() * 100 < affixChance) {
      var affixKeys = Object.keys(AFFIXES);
      var randomAffix = affixKeys[Math.floor(Math.random() * affixKeys.length)];
      affixes.push(AFFIXES[randomAffix]);
    }

    return affixes;
  }

  /**
   * Generate a card drop
   * @param {String} baseType - Key from BASE_CARDS
   */
  function rollCard(baseType) {
    var baseCard = BASE_CARDS[baseType];
    if (!baseCard) return null;

    var quality = rollQuality();
    var stats = rollStats(baseCard, quality);
    var affixes = rollAffixes(quality);

    return {
      base: baseType,
      name: baseCard.name,
      emoji: baseCard.emoji,
      type: baseCard.type,
      category: baseCard.category || baseCard.type, // Include category for priority system
      quality: quality,
      qualityName: QUALITIES[quality].name,
      qualityColor: QUALITIES[quality].color,
      stats: stats,
      affixes: affixes,
      id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };
  }

  /**
   * Special: Roll inventory charm (binary: cracked or perfect)
   */
  function rollInventoryCharm() {
    var roll = Math.random() * 100;
    var quality = roll <= 97 ? 'CRACKED' : 'PERFECT';

    var charm = {
      base: 'INVENTORY_CHARM',
      name: 'Inventory Charm',
      emoji: '🪬',
      type: 'charm',
      quality: quality,
      qualityName: QUALITIES[quality].name,
      qualityColor: QUALITIES[quality].color,
      stats: quality === 'PERFECT' ? { slots: 1 } : { slots: 0 },
      affixes: [],
      id: 'charm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };

    return charm;
  }

  /**
   * Get a random base card type
   */
  function getRandomBaseCard() {
    var keys = Object.keys(BASE_CARDS).filter(function(k) {
      return k !== 'INVENTORY_CHARM'; // Exclude charm from normal drops
    });
    return keys[Math.floor(Math.random() * keys.length)];
  }

  /**
   * Format card for display
   */
  function formatCard(card) {
    var lines = [];
    lines.push(card.emoji + ' ' + card.name + ' [' + card.qualityName + ']');
    lines.push('Type: ' + card.type);

    var statLines = [];
    for (var stat in card.stats) {
      statLines.push(stat + ': ' + card.stats[stat]);
    }
    lines.push('Stats: ' + statLines.join(', '));

    if (card.affixes.length) {
      lines.push('Affixes: ' + card.affixes.map(function(a) { return a.name; }).join(', '));
    }

    return lines.join('\n');
  }

  /**
   * Get priority value for a card type
   * @param {String} cardType - Card type (interrupt, defense, movement, attack, setup)
   * @returns {Number} Priority value (1-5, lower executes first)
   */
  function getCardPriority(cardType) {
    return CARD_PRIORITIES[cardType] || 5; // Default to setup priority
  }

  /**
   * Get card category from a card object
   * @param {Object} card - Card object
   * @returns {String} Category (interrupt, defense, movement, attack, setup)
   */
  function getCardCategory(card) {
    if (!card) return 'setup';
    
    // Check if card has category field
    if (card.category) return card.category;
    
    // Fallback to type field
    if (card.type) {
      // Map legacy types to new categories
      if (card.type === 'stance') return 'defense';
      if (card.type === 'utility') return 'setup';
      if (card.type === 'tactical') return 'movement';
      return card.type;
    }
    
    return 'setup';
  }

  return {
    QUALITIES: QUALITIES,
    BASE_CARDS: BASE_CARDS,
    AFFIXES: AFFIXES,
    CARD_PRIORITIES: CARD_PRIORITIES,
    rollQuality: rollQuality,
    rollStats: rollStats,
    rollAffixes: rollAffixes,
    rollCard: rollCard,
    rollInventoryCharm: rollInventoryCharm,
    getRandomBaseCard: getRandomBaseCard,
    formatCard: formatCard,
    getCardPriority: getCardPriority,
    getCardCategory: getCardCategory
  };
})();
