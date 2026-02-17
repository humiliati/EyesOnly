/* ============================================================
   EYES ONLY - Card System (Diablo-style loot)
   Quality rolls, affixes, and item generation
   ============================================================ */

const CardSystem = (function () {
  'use strict';

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
    // Attack cards
    SINGLE_SHOT: {
      type: 'attack',
      name: 'Single Shot',
      emoji: '🎯',
      baseStats: { damage: 3, noise: 1, accuracy: 80, energy: 2 }
    },
    BURST_SHOT: {
      type: 'attack',
      name: 'Burst Shot',
      emoji: '💥',
      baseStats: { damage: 5, noise: 3, accuracy: 70, energy: 3 }
    },
    SILENT_SHOT: {
      type: 'attack',
      name: 'Silent Shot',
      emoji: '🔇',
      baseStats: { damage: 3, noise: 1, accuracy: 80, energy: 2 }
    },
    EXPLOSIVE_SHOT: {
      type: 'attack',
      name: 'Explosive Shot',
      emoji: '💣',
      baseStats: { damage: 8, noise: 5, accuracy: 60, energy: 4 }
    },

    // Defense/Stance cards
    PRONE: {
      type: 'stance',
      name: 'Prone',
      emoji: '🛡️',
      baseStats: { defense: 3, stealth: 2, mobility: -1, energy: 1 }
    },
    KNEEL: {
      type: 'stance',
      name: 'Kneel',
      emoji: '🧎',
      baseStats: { defense: 2, accuracy: 1, mobility: 0, energy: 1 }
    },
    DODGE: {
      type: 'stance',
      name: 'Dodge',
      emoji: '💨',
      baseStats: { evasion: 3, energy: 2 }
    },
    BLOCK: {
      type: 'stance',
      name: 'Block',
      emoji: '🛡️',
      baseStats: { defense: 4, energy: 2 }
    },

    // Utility cards
    CIGARETTES: {
      type: 'utility',
      name: 'Cigarettes',
      emoji: '🚬',
      baseStats: { stress: -2, detection: 1, hp: -1 }
    },
    KATCHUP: {
      type: 'utility',
      name: 'Katchup',
      emoji: '🩹',
      baseStats: { hp: 3 }
    },
    RATIONS: {
      type: 'utility',
      name: 'Rations',
      emoji: '🍖',
      baseStats: { hp: 2, energy: 1 }
    },

    // Tactical cards
    RETREAT: {
      type: 'tactical',
      name: 'Retreat',
      emoji: '↩️',
      baseStats: { distance: -2, safety: 2, energy: 1 }
    },
    CLOSE_DISTANCE: {
      type: 'tactical',
      name: 'Close Distance',
      emoji: '⏩',
      baseStats: { distance: 2, risk: 1, energy: 2 }
    },
    TOTAL_EVASION: {
      type: 'tactical',
      name: 'Total Evasion',
      emoji: '🌫️',
      baseStats: { evasion: 5, energy: 3 }
    },

    // Special: Inventory Charm (rare)
    INVENTORY_CHARM: {
      type: 'charm',
      name: 'Inventory Charm',
      emoji: '🪬',
      baseStats: { slots: 0 }
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

  return {
    QUALITIES: QUALITIES,
    BASE_CARDS: BASE_CARDS,
    AFFIXES: AFFIXES,
    rollQuality: rollQuality,
    rollStats: rollStats,
    rollAffixes: rollAffixes,
    rollCard: rollCard,
    rollInventoryCharm: rollInventoryCharm,
    getRandomBaseCard: getRandomBaseCard,
    formatCard: formatCard
  };
})();
