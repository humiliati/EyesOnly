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

  // Card Lifecycle Types (spec section 7.4)
  var LIFECYCLE_TYPES = {
    Disposable: 'disposable',   // Single use, consumed on play (consumables)
    Exhaust: 'exhaust',         // Removed from deck after first use (powerful abilities)
    Power: 'power',             // Activated once, persists entire combat
    Gated: 'gated',             // Requires resource, not consumed (ammo/fatigue gated)
    Persistent: 'persistent'    // Always available, never consumed (basic actions)
  };

  var QUALITIES = {
    Cracked: { name: 'Cracked', color: 'gray', roll: 18 },
    Worn: { name: 'Worn', color: 'lightgray', roll: 22 },
    Standard: { name: 'Standard', color: 'white', roll: 25 },
    Fine: { name: 'Fine', color: 'lightblue', roll: 15 },
    Superior: { name: 'Superior', color: 'yellow', roll: 10 },
    Elite: { name: 'Elite', color: 'orange', roll: 6 },
    Masterwork: { name: 'Masterwork', color: 'gold', roll: 3 },
    'Near Perfect': { name: 'Near Perfect', color: 'lightgreen', roll: 0.9 },
    Perfect: { name: 'Perfect', color: 'violet', roll: 0.1 }
  };

  var BASE_CARDS = {
    // ========== INTERRUPT CARDS (Priority 1) ==========
    'Dive Cover': {
      category: 'interrupt',
      type: 'interrupt',
      name: 'Dive for Cover',
      emoji: '🤸',
      lifecycleType: 'persistent',
      baseStats: { defense: 5, evasion: 3, energy: 2, speed: 5 },
      resourceCost: { energy: 2, fatigue: 1 }
    },
    'Jam Weapon': {
      category: 'interrupt',
      type: 'interrupt',
      name: 'Jam Weapon',
      emoji: '🔧',
      lifecycleType: 'disposable',
      baseStats: { disrupt: 1, energy: 2, speed: 5 },
      resourceCost: { energy: 2, focus: 1 }
    },
    Overwatch: {
      category: 'interrupt',
      type: 'interrupt',
      name: 'Overwatch Shot',
      emoji: '👁️',
      lifecycleType: 'gated',
      baseStats: { damage: 3, accuracy: 85, energy: 3, speed: 5 },
      resourceCost: { ammo: 1, energy: 3, focus: 2 }
    },

    // ========== DEFENSE CARDS (Priority 2) ==========
    Block: {
      category: 'defense',
      type: 'defense',
      name: 'Block',
      emoji: '🛡️',
      lifecycleType: 'persistent',
      baseStats: { defense: 4, energy: 2, speed: 4 },
      resourceCost: { energy: 2 }
    },
    Dodge: {
      category: 'defense',
      type: 'defense',
      name: 'Dodge',
      emoji: '💨',
      lifecycleType: 'persistent',
      baseStats: { evasion: 3, energy: 2, speed: 4 },
      resourceCost: { energy: 2, focus: 1 }
    },
    Prone: {
      category: 'defense',
      type: 'defense',
      name: 'Prone',
      emoji: '🛡️',
      lifecycleType: 'persistent',
      baseStats: { defense: 3, stealth: 2, mobility: -1, energy: 1, speed: 3 },
      resourceCost: { energy: 1 }
    },
    Kneel: {
      category: 'defense',
      type: 'defense',
      name: 'Kneel',
      emoji: '🧎',
      lifecycleType: 'persistent',
      baseStats: { defense: 2, accuracy: 1, mobility: 0, energy: 1, speed: 3 },
      resourceCost: { energy: 1 }
    },

    // ========== MOVEMENT CARDS (Priority 3) ==========
    'Close Distance': {
      category: 'movement',
      type: 'movement',
      name: 'Close Distance',
      emoji: '⏩',
      lifecycleType: 'persistent',
      baseStats: { distance: 2, risk: 1, energy: 2, speed: 3, fatigue: 2 },
      resourceCost: { energy: 2, fatigue: 2 }
    },
    Retreat: {
      category: 'movement',
      type: 'movement',
      name: 'Retreat',
      emoji: '↩️',
      baseStats: { distance: -2, safety: 2, energy: 1, speed: 3, fatigue: 1 }
    },
    Strafe: {
      category: 'movement',
      type: 'movement',
      name: 'Strafe',
      emoji: '↔️',
      baseStats: { evasion: 2, distance: 1, energy: 2, speed: 3, fatigue: 2 }
    },
    Roll: {
      category: 'movement',
      type: 'movement',
      name: 'Combat Roll',
      emoji: '🔄',
      baseStats: { evasion: 4, distance: 1, energy: 3, speed: 4, fatigue: 4 }
    },

    // ========== ATTACK CARDS (Priority 4) ==========
    'Single Shot': {
      category: 'attack',
      type: 'attack',
      name: 'Single Shot',
      emoji: '🎯',
      baseStats: { damage: 3, noise: 1, accuracy: 80, energy: 2, speed: 3, ammo: 1, fatigue: 1 }
    },
    'Burst Shot': {
      category: 'attack',
      type: 'attack',
      name: 'Burst Shot',
      emoji: '💥',
      baseStats: { damage: 5, noise: 3, accuracy: 70, energy: 3, speed: 2, ammo: 3, fatigue: 2 }
    },
    'Silent Shot': {
      category: 'attack',
      type: 'attack',
      name: 'Silent Shot',
      emoji: '🔇',
      baseStats: { damage: 3, noise: 1, accuracy: 80, energy: 2, speed: 3, ammo: 1, fatigue: 1 }
    },
    'Explosive Shot': {
      category: 'attack',
      type: 'attack',
      name: 'Explosive Shot',
      emoji: '💣',
      baseStats: { damage: 8, noise: 5, accuracy: 60, energy: 4, speed: 1, ammo: 1, fatigue: 3, consumable: true }
    },
    'Suppressive Fire': {
      category: 'attack',
      type: 'attack',
      name: 'Suppressive Fire',
      emoji: '🔥',
      baseStats: { damage: 2, accuracy: 50, suppress: 3, energy: 3, speed: 2, ammo: 5, fatigue: 3 }
    },

    // ========== SETUP/UTILITY CARDS (Priority 5) ==========
    Cigarettes: {
      category: 'setup',
      type: 'setup',
      name: 'Cigarettes',
      emoji: '🚬',
      baseStats: {
        stress: -2,
        attackBoost: 2,  // Renamed from attack_boost for camelCase consistency
        speedBoost: 1,   // Renamed from speed_boost for camelCase consistency
        hpDrain: 1,      // Renamed from hp_drain for camelCase consistency
        duration: 1,
        energy: 1,
        speed: 2,
        consumable: true,  // Single use item
        fatigueReduction: 3  // Reduces fatigue when used
      }
    },
    Katchup: {
      category: 'setup',
      type: 'setup',
      name: 'Katchup',
      emoji: '🩹',
      baseStats: { hp: 3, energy: 1, speed: 2, consumable: true }
    },
    Rations: {
      category: 'setup',
      type: 'setup',
      name: 'Rations',
      emoji: '🍖',
      baseStats: { hp: 4, duration: 2, energy: 2, speed: 2, consumable: true, fatigueReduction: 5 }
    },
    'Total Evasion': {
      category: 'setup',
      type: 'setup',
      name: 'Total Evasion',
      emoji: '🌫️',
      baseStats: {
        evasion: 5,
        exhaust: true, // This card can only be used once per combat (exhausts after use)
        energy: 3,
        speed: 2,
        fatigue: 2
      }
    },
    Aim: {
      category: 'setup',
      type: 'setup',
      name: 'Aim',
      emoji: '🎯',
      baseStats: {
        accuracyBoost: 20,  // Renamed from accuracy_boost for camelCase consistency
        nextTurn: true,     // Renamed from next_turn for camelCase consistency
        energy: 1,
        speed: 2
      }
    },

    // ========== BOSS ENCOUNTER CARDS (Special tactical cards for boss fights) ==========
    Lure: {
      category: 'setup',
      type: 'setup',
      name: 'Lure',
      emoji: '🥩',
      baseStats: {
        range: 3,
        duration: 2,
        energy: 2,
        speed: 2,
        bossInteraction: true // Special flag for boss mechanics
      }
    },
    Grenade: {
      category: 'attack',
      type: 'attack',
      name: 'Grenade',
      emoji: '💣',
      lifecycleType: 'disposable',  // Single-use consumable
      baseStats: {
        damage: 6,
        aoe: 2, // Area of effect radius
        noise: 5,
        accuracy: 75,
        energy: 3,
        speed: 2,
        destroysEnvironment: true
      },
      resourceCost: { ammo: 2 }  // Costs 2 ammo to use
    },
    'Jammer': {
      category: 'interrupt',
      type: 'interrupt',
      name: 'Jammer',
      emoji: '📡',
      baseStats: {
        disrupt: 2,
        range: 5,
        duration: 3,
        energy: 3,
        speed: 4,
        affectsElectronics: true
      }
    },
    'Virus': {
      category: 'attack',
      type: 'attack',
      name: 'Virus',
      emoji: '🦠',
      baseStats: {
        damage: 2, // Initial damage
        dot: 3, // Damage over time per turn
        duration: 3,
        accuracy: 85,
        energy: 3,
        speed: 3,
        affectsMachines: true
      }
    },
    'High Ground': {
      category: 'attack',
      type: 'attack',
      name: 'High Ground',
      emoji: '🎯',
      baseStats: {
        damage: 4,
        piercing: true, // Ignores cover/shields
        accuracy: 90,
        range: 8,
        energy: 3,
        speed: 2
      }
    },
    'Melee Strike': {
      category: 'attack',
      type: 'attack',
      name: 'Melee Strike',
      emoji: '⚔️',
      baseStats: {
        damage: 5,
        accuracy: 85,
        range: 1, // Must be adjacent
        energy: 2,
        speed: 3,
        isMelee: true
      }
    },
    'Logic Hack': {
      category: 'interrupt',
      type: 'interrupt',
      name: 'Logic Hack',
      emoji: '💻',
      baseStats: {
        manipulation: 1, // Can flip/invert target state
        range: 3,
        energy: 2,
        speed: 5,
        affectsSystems: true
      }
    },

    // ========== CONSUMABLE CARDS (Single-use tactical items) ==========
    'Energy Drink': {
      category: 'consumable',
      type: 'consumable',
      name: 'Energy Drink',
      emoji: '⚡',
      lifecycleType: 'disposable',
      baseStats: {
        fatigueReduction: 20,
        energyBoost: 2,
        duration: 2,
        speed: 2,
        consumable: true
      }
    },
    'Medical Kit': {
      category: 'consumable',
      type: 'consumable',
      name: 'Medical Kit',
      emoji: '🏥',
      lifecycleType: 'disposable',
      baseStats: {
        hp: 30,
        energy: 0,
        speed: 2,
        consumable: true
      }
    },
    'Ammo Clip': {
      category: 'consumable',
      type: 'consumable',
      name: 'Ammo Clip',
      emoji: '📎',
      lifecycleType: 'disposable',
      baseStats: {
        ammoRestore: 10,
        energy: 0,
        speed: 1,
        consumable: true
      }
    },
    'Stim Pack': {
      category: 'consumable',
      type: 'consumable',
      name: 'Stim Pack',
      emoji: '💉',
      lifecycleType: 'disposable',
      baseStats: {
        hp: 15,
        fatigueReduction: 10,
        speedBoost: 2,
        duration: 1,
        energy: 1,
        speed: 2,
        consumable: true
      }
    },
    'Adrenaline': {
      category: 'consumable',
      type: 'consumable',
      name: 'Adrenaline',
      emoji: '💪',
      lifecycleType: 'disposable',
      baseStats: {
        attackBoost: 3,
        speedBoost: 3,
        fatigueReduction: 15,
        duration: 2,
        energy: 1,
        speed: 1,
        consumable: true
      }
    },

    // ========== ENVIRONMENTAL CARDS (Interact with tiles and status effects) ==========
    'Oil Slick': {
      category: 'setup',
      type: 'setup',
      name: 'Oil Slick',
      emoji: '🛢️',
      lifecycleType: 'disposable',
      baseStats: {
        range: 2,
        duration: 99, // Until ignited or cleaned
        energy: 2,
        speed: 2,
        createsTile: 'oil',
        consumable: true
      }
    },
    'Lighter': {
      category: 'setup',
      type: 'setup',
      name: 'Lighter',
      emoji: '🔥',
      lifecycleType: 'disposable',
      baseStats: {
        range: 1,
        ignitesOil: true,
        applyStatus: 'BURNING',
        energy: 1,
        speed: 2,
        consumable: true
      }
    },
    'Water Bottle': {
      category: 'setup',
      type: 'setup',
      name: 'Water Bottle',
      emoji: '💧',
      lifecycleType: 'disposable',
      baseStats: {
        range: 3,
        extinguishesFire: true,
        createsTile: 'water',
        applyStatus: 'WET',
        duration: 2,
        energy: 1,
        speed: 2,
        consumable: true
      }
    },

    // ========== POWER CARDS (Persistent combat-long buffs) ==========
    'Predator Focus': {
      category: 'setup',
      type: 'power',
      name: 'Predator Focus',
      emoji: '👁️',
      lifecycleType: 'power',
      baseStats: {
        accuracyBonus: 15,
        critBonus: 10,
        stealthBonus: 2,
        energy: 2,
        speed: 2,
        combatPersistent: true
      }
    },
    'Ghost Protocol': {
      category: 'setup',
      type: 'power',
      name: 'Ghost Protocol',
      emoji: '👻',
      lifecycleType: 'power',
      baseStats: {
        stealthBonus: 3,
        noiseReduction: -2,
        detectionReduction: -3,
        energy: 3,
        speed: 2,
        combatPersistent: true
      }
    },

    // ========== EXHAUST CARDS (Powerful one-time abilities) ==========
    'Last Stand': {
      category: 'defense',
      type: 'defense',
      name: 'Last Stand',
      emoji: '🛡️',
      lifecycleType: 'exhaust',
      baseStats: {
        defense: 8,
        damageReduction: 50,
        cannotDie: true, // Prevents HP from dropping below 1 this turn
        energy: 2,
        speed: 4,
        exhaust: true
      }
    },
    'Panic Dodge': {
      category: 'defense',
      type: 'defense',
      name: 'Panic Dodge',
      emoji: '😱',
      lifecycleType: 'exhaust',
      baseStats: {
        evasion: 5,
        triggersPanic: true,
        fatigueCost: 4,
        energy: 1,
        speed: 5,
        exhaust: true
      }
    },

    // ========== COOLDOWN CARDS (Multi-combat powerful abilities) ==========
    'Thermal Vision': {
      category: 'setup',
      type: 'power',
      name: 'Thermal Vision',
      emoji: '🔥',
      lifecycleType: 'power',
      baseStats: {
        visionBonus: 3,
        seeThroughWalls: true,
        detectHidden: true,
        battery: 1,
        energy: 2,
        speed: 2,
        cooldownCombat: 3,  // Usable once every 3 combats
        combatPersistent: true
      }
    },
    'Adrenaline Surge': {
      category: 'setup',
      type: 'power',
      name: 'Adrenaline Surge',
      emoji: '💉',
      lifecycleType: 'power',
      baseStats: {
        attackBoost: 5,
        speedBoost: 3,
        accuracyBonus: 20,
        energy: 3,
        speed: 1,
        cooldownCombat: 2,  // Usable once every 2 combats
        combatPersistent: true
      }
    },
    'Smoke Screen': {
      category: 'setup',
      type: 'setup',
      name: 'Smoke Screen',
      emoji: '💨',
      lifecycleType: 'exhaust',
      baseStats: {
        aoe: 3,
        concealment: true,
        enemyAccuracyPenalty: -40,
        duration: 2,
        battery: 1,
        energy: 2,
        speed: 2,
        cooldownFloor: 1,  // Usable once per floor
        exhaust: true
      }
    },
    'Perfect Ambush': {
      category: 'setup',
      type: 'power',
      name: 'Perfect Ambush',
      emoji: '🎯',
      lifecycleType: 'power',
      baseStats: {
        guaranteedFirstStrike: true,
        damageBonus: 5,
        critBonus: 20,
        energy: 3,
        speed: 1,
        cooldownCombat: 3,
        combatPersistent: true
      }
    },

    // ========== RESOURCE REPLENISHMENT CONSUMABLES ==========
    'Battery Pack': {
      category: 'consumable',
      type: 'consumable',
      name: 'Battery Pack',
      emoji: '🔋',
      lifecycleType: 'disposable',
      baseStats: {
        batteryRecharge: 2,
        energy: 0,
        speed: 1,
        consumable: true
      },
      resourceCost: {},
      description: 'Recharges 2 battery power for tech equipment'
    },
    'Power Cell': {
      category: 'consumable',
      type: 'consumable',
      name: 'Power Cell',
      emoji: '⚡',
      lifecycleType: 'disposable',
      baseStats: {
        batteryRecharge: 1,
        energy: 0,
        speed: 1,
        consumable: true
      },
      resourceCost: {},
      description: 'Recharges 1 battery power for tech equipment'
    },
    'Coffee Mug': {
      category: 'consumable',
      type: 'consumable',
      name: 'Coffee Mug',
      emoji: '☕',
      lifecycleType: 'disposable',
      baseStats: {
        fatigueReduction: 15,
        focusBoost: 1,
        energyBoost: 1,
        energy: 0,
        speed: 1,
        consumable: true
      },
      resourceCost: {},
      description: 'Hot coffee reduces fatigue and sharpens focus'
    },

    // ========== CHARM CARDS (Passive Bonuses) ==========

    // Special: Inventory Charm (rare)
    'Inventory Charm': {
      category: 'charm',
      type: 'charm',
      name: 'Inventory Charm',
      emoji: '🪬',
      baseStats: { slots: 0, speed: 1 }
    },

    // Common Charms (low utility, meant for early game)
    'Lucky Charm': {
      category: 'charm',
      type: 'charm',
      name: 'Lucky Charm',
      emoji: '🍀',
      baseStats: { luck: 1 }
    },
    'Speed Charm': {
      category: 'charm',
      type: 'charm',
      name: 'Speed Charm',
      emoji: '⚡',
      baseStats: { speed: 1 }
    },
    'Stealth Charm': {
      category: 'charm',
      type: 'charm',
      name: 'Stealth Charm',
      emoji: '🌙',
      baseStats: { stealth: 1 }
    },
    'Health Charm': {
      category: 'charm',
      type: 'charm',
      name: 'Health Charm',
      emoji: '❤️',
      baseStats: { hp: 2 }
    },
    'Energy Charm': {
      category: 'charm',
      type: 'charm',
      name: 'Energy Charm',
      emoji: '⭐',
      baseStats: { energy: 1 }
    },
    'Impossible Charm': {
      category: 'charm',
      type: 'charm',
      name: 'Impossible Binary Charm',
      emoji: '💠',
      baseStats: { impossible: 1 } // Permanent unlock, grants special ability
    },

    // ========== EQUIPMENT CARDS (Equipable items) ==========
    TRENCH_COAT: {
      category: 'equipment',
      type: 'equipment',
      name: 'Trench Coat',
      emoji: '🧥',
      baseStats: {
        actionButtonSlots: 2,  // Provides +2 action button slots when equipped
        defense: 1,            // Minor defense bonus
        stealth: 1             // Helps blend in urban environments
      }
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
   * Roll a common charm (low utility, for early game)
   * These are always CRACKED or WORN quality
   */
  function rollCommonCharm() {
    var commonCharmTypes = ['LUCKY_CHARM', 'SPEED_CHARM', 'STEALTH_CHARM', 'HEALTH_CHARM', 'ENERGY_CHARM'];
    var charmType = commonCharmTypes[Math.floor(Math.random() * commonCharmTypes.length)];
    var baseCharm = BASE_CARDS[charmType];

    // Common charms are always poor quality (97% cracked, 3% worn)
    var roll = Math.random() * 100;
    var quality = roll <= 97 ? 'CRACKED' : 'WORN';

    var charm = {
      base: charmType,
      name: baseCharm.name,
      emoji: baseCharm.emoji,
      type: 'charm',
      category: 'charm',
      quality: quality,
      qualityName: QUALITIES[quality].name,
      qualityColor: QUALITIES[quality].color,
      stats: rollStats(baseCharm.baseStats, quality),
      affixes: [],
      id: 'charm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };

    return charm;
  }

  /**
   * Roll the Impossible Binary Charm (permanent unlock)
   * Only drops from Uber Mega or final boss
   */
  function rollImpossibleCharm() {
    var charm = {
      base: 'IMPOSSIBLE_CHARM',
      name: 'Impossible Binary Charm',
      emoji: '💠',
      type: 'charm',
      category: 'charm',
      quality: 'PERFECT',
      qualityName: QUALITIES.PERFECT.name,
      qualityColor: QUALITIES.PERFECT.color,
      stats: { impossible: 1 },
      affixes: [],
      id: 'impossible_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };

    return charm;
  }

  /**
   * Roll trench coat equipment (guaranteed drop in grey biome)
   * Quality range: WORN to FINE (early game equipment)
   */
  function rollTrenchCoat() {
    var baseEquipment = BASE_CARDS.TRENCH_COAT;

    // Trench coat quality: 60% WORN, 30% STANDARD, 10% FINE
    var roll = Math.random() * 100;
    var quality;
    if (roll <= 60) {
      quality = 'WORN';
    } else if (roll <= 90) {
      quality = 'STANDARD';
    } else {
      quality = 'FINE';
    }

    var stats = rollStats(baseEquipment, quality);

    var trenchCoat = {
      base: 'TRENCH_COAT',
      name: baseEquipment.name,
      emoji: baseEquipment.emoji,
      type: 'equipment',
      category: 'equipment',
      quality: quality,
      qualityName: QUALITIES[quality].name,
      qualityColor: QUALITIES[quality].color,
      stats: stats,
      affixes: [],
      id: 'trench_coat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };

    return trenchCoat;
  }

  /**
   * Get a random base card type
   */
  function getRandomBaseCard() {
    var keys = Object.keys(BASE_CARDS).filter(function(k) {
      // Exclude all charms from normal card drops
      return BASE_CARDS[k].category !== 'charm';
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
    LIFECYCLE_TYPES: LIFECYCLE_TYPES,
    rollQuality: rollQuality,
    rollStats: rollStats,
    rollAffixes: rollAffixes,
    rollCard: rollCard,
    rollInventoryCharm: rollInventoryCharm,
    rollCommonCharm: rollCommonCharm,
    rollImpossibleCharm: rollImpossibleCharm,
    rollTrenchCoat: rollTrenchCoat,
    getRandomBaseCard: getRandomBaseCard,
    formatCard: formatCard,
    getCardPriority: getCardPriority,
    getCardCategory: getCardCategory
  };
})();
