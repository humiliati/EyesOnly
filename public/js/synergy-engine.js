/* ============================================================
   EYES ONLY - Card Synergy Engine
   Enables tactical card combinations and combos
   ============================================================ */

const SynergyEngine = (function () {
  'use strict';

  // Synergy types for categorization
  var SYNERGY_TYPES = {
    IMMEDIATE: 'immediate',     // Triggers within same turn
    SEQUENTIAL: 'sequential',   // Builds over multiple turns
    STATEFUL: 'stateful'        // Changes player condition
  };

  // Synergy tags for matching cards
  var SYNERGY_TAGS = {
    // Damage types
    FIRE: 'fire',
    EXPLOSIVE: 'explosive',
    TECH: 'tech',
    MELEE: 'melee',
    RANGED: 'ranged',
    PRECISION: 'precision',
    AOE: 'aoe',

    // Resource generation
    ENERGY_GEN: 'energy_gen',
    BATTERY_GEN: 'battery_gen',
    AMMO_GEN: 'ammo_gen',
    FATIGUE_REDUCE: 'fatigue_reduce',

    // Combat patterns
    COMBO_STARTER: 'combo_starter',
    COMBO_FINISHER: 'combo_finisher',
    CHAIN: 'chain',
    BURST: 'burst',
    SUSTAINED: 'sustained',

    // Tactical
    STEALTH: 'stealth',
    AGGRESSIVE: 'aggressive',
    DEFENSIVE: 'defensive',
    MOBILE: 'mobile',
    CONTROL: 'control',

    // Spy Layer (tag-combo system)
    BALLISTIC: 'ballistic',        // 🟥 Firearms, kinetic
    WET: 'wet',                    // 🟦 Water, chemical
    ELECTRICAL: 'electrical',      // 🟨 Shock, EMP
    COVERT: 'covert',              // 🟪 Stealth, intel
    IMPROVISED: 'improvised',      // 🟩 Jury-rigged, junk
    BLACK_MARKET: 'black_market',  // ⬛ Illegal, volatile

    // Theft layer (pre-combat + in-combat stealing hooks)
    PICKPOCKET: 'pickpocket',
    DISARM: 'disarm',
    SLEIGHT: 'sleight',
    HACK: 'hack',
    INTIMIDATE: 'intimidate',
    BRIBE: 'bribe'
  };

  // Synergy definitions (enabler -> payoff relationships)
  var SYNERGY_DEFINITIONS = {
    // Energy Dump Synergy: Generate energy -> Spend on powerful attack
    ENERGY_DUMP: {
      name: 'Energy Surge',
      type: SYNERGY_TYPES.IMMEDIATE,
      enablerTags: [SYNERGY_TAGS.ENERGY_GEN],
      payoffTags: [SYNERGY_TAGS.BURST, SYNERGY_TAGS.AOE],
      bonus: {
        damageMultiplier: 1.5,
        energyRefund: 1
      },
      description: 'Energy generation followed by burst attack deals +50% damage and refunds 1 energy'
    },

    // Battery Chain Synergy: Build battery -> Unleash tech devastation
    BATTERY_OVERLOAD: {
      name: 'Battery Overload',
      type: SYNERGY_TYPES.IMMEDIATE,
      enablerTags: [SYNERGY_TAGS.BATTERY_GEN],
      payoffTags: [SYNERGY_TAGS.TECH],
      bonus: {
        damageMultiplier: 2.0,
        applyDisrupt: true
      },
      description: 'Tech attacks after battery charge deal double damage and disrupt enemies'
    },

    // Fire Chain Synergy: Fire DoT -> Explosive detonation
    EXPLOSIVE_IGNITION: {
      name: 'Explosive Ignition',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.FIRE],
      payoffTags: [SYNERGY_TAGS.EXPLOSIVE],
      bonus: {
        damageBonus: 8,
        aoeExpansion: 1
      },
      description: 'Explosive attacks on burning targets deal +8 damage with expanded AOE'
    },

    // Precision Chain: Aim setup -> High damage precision strike
    PRECISION_EXECUTION: {
      name: 'Precision Execution',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.PRECISION],
      payoffTags: [SYNERGY_TAGS.RANGED],
      bonus: {
        guaranteedCrit: true,
        damageMultiplier: 1.8
      },
      description: 'Ranged attacks after precision setup always crit with +80% damage'
    },

    // Aggressive Rush: Chain attacks for escalating power
    AGGRESSIVE_MOMENTUM: {
      name: 'Aggressive Momentum',
      type: SYNERGY_TYPES.STATEFUL,
      enablerTags: [SYNERGY_TAGS.AGGRESSIVE],
      payoffTags: [SYNERGY_TAGS.AGGRESSIVE],
      bonus: {
        damagePerStack: 2,
        maxStacks: 5,
        speedBonus: 1
      },
      description: 'Each consecutive aggressive action deals +2 damage (max +10) and grants +1 speed'
    },

    // Combo Chain: Starter -> Finisher for massive burst
    COMBO_DEVASTATION: {
      name: 'Combo Devastation',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.COMBO_STARTER],
      payoffTags: [SYNERGY_TAGS.COMBO_FINISHER],
      bonus: {
        damageMultiplier: 2.5,
        energyRefund: 2,
        drawCard: true
      },
      description: 'Combo finishers after starters deal 2.5x damage, refund 2 energy, and draw a card'
    },

    // Fatigue Recovery: Reduce fatigue -> Enable powerful repeated plays
    FATIGUE_MASTERY: {
      name: 'Fatigue Mastery',
      type: SYNERGY_TYPES.STATEFUL,
      enablerTags: [SYNERGY_TAGS.FATIGUE_REDUCE],
      payoffTags: [SYNERGY_TAGS.SUSTAINED],
      bonus: {
        costReduction: 1,
        fatigueImmune: true
      },
      description: 'Sustained attacks after fatigue reduction cost 1 less energy and ignore fatigue'
    },

    // Ammo Chain: Ammo generation -> Sustained fire
    AMMO_EFFICIENCY: {
      name: 'Ammo Efficiency',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.AMMO_GEN],
      payoffTags: [SYNERGY_TAGS.SUSTAINED],
      bonus: {
        ammoRefund: 0.5,  // 50% chance to refund ammo
        damageBonus: 3
      },
      cascadeChance: 0,
      description: 'Sustained fire after ammo generation has 50% chance to refund ammo and deals +3 damage'
    },

    // ─── THEFT TAG SYNERGIES ───────────────────────────────

    // pickpocket → covert payoff: draw + reduce cost (reward theft builds)
    FIVE_FINGER_DISCOUNT: {
      name: 'Five-Finger Discount',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.PICKPOCKET],
      payoffTags: [SYNERGY_TAGS.COVERT],
      bonus: {
        drawCard: true,
        costReduction: 1
      },
      cascadeChance: 0.15,
      description: 'Pickpocket setup into covert action: draw 1 and -1 cost (15% chain)'
    },

    // disarm → ballistic payoff: +damage + speed (tempo swing)
    DISARMING_OPENING: {
      name: 'Disarming Opening',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.DISARM],
      payoffTags: [SYNERGY_TAGS.BALLISTIC],
      bonus: {
        damageBonus: 2,
        speedBonus: 1
      },
      cascadeChance: 0,
      description: 'Disarm into ballistic: +2 damage and +1 speed'
    },

    // hack → tech/electrical payoff: disrupt + draw
    SILENT_OVERRIDE: {
      name: 'Silent Override',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.HACK],
      payoffTags: [SYNERGY_TAGS.TECH, SYNERGY_TAGS.ELECTRICAL],
      bonus: {
        applyDisrupt: true,
        drawCard: true
      },
      cascadeChance: 0,
      description: 'Hack into tech/electrical: disrupt the enemy and draw 1'
    },

    // sleight → black market payoff: refund energy + draw
    CONTRABAND_SLEIGHT: {
      name: 'Contraband Sleight',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.SLEIGHT],
      payoffTags: [SYNERGY_TAGS.BLACK_MARKET],
      bonus: {
        energyRefund: 1,
        drawCard: true
      },
      cascadeChance: 0.1,
      description: 'Sleight into black market: refund 1 energy and draw 1 (10% chain)'
    },

    // intimidate → aggressive payoff: multiplier
    PRESSURE_POINT: {
      name: 'Pressure Point',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.INTIMIDATE],
      payoffTags: [SYNERGY_TAGS.AGGRESSIVE],
      bonus: {
        damageMultiplier: 1.35
      },
      cascadeChance: 0,
      description: 'Intimidation into aggression: +35% damage'
    },

    // bribe → defensive payoff: cost reduction (escape / stall builds)
    PAYOFF_PROTOCOL: {
      name: 'Payoff Protocol',
      type: SYNERGY_TYPES.IMMEDIATE,
      enablerTags: [SYNERGY_TAGS.BRIBE],
      payoffTags: [SYNERGY_TAGS.DEFENSIVE, SYNERGY_TAGS.COVERT],
      bonus: {
        costReduction: 1
      },
      cascadeChance: 0,
      description: 'Bribe into defense/covert: -1 cost'
    },

    // ─── SPY LAYER TAG-COMBO SYNERGIES ──────────────────────

    // 🟦 Wet + 🟥 Ballistic → Flash Boil
    FLASH_BOIL: {
      name: 'Flash Boil',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.WET],
      payoffTags: [SYNERGY_TAGS.BALLISTIC],
      bonus: {
        damageBonus: 6,
        applyDot: { type: 'fire', damage: 2, turns: 2 }
      },
      cascadeChance: 0,
      description: '🟦+🟥 Wet target hit with ballistic: +6 damage, fire DoT'
    },

    // 🟩 Improvised + 🟪 Covert → Stealth Cascade
    STEALTH_CASCADE: {
      name: 'Stealth Cascade',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.IMPROVISED],
      payoffTags: [SYNERGY_TAGS.COVERT],
      bonus: {
        drawCard: true,
        stealthBonus: 1
      },
      cascadeChance: 0.2,
      description: '🟩+🟪 Improvised setup into covert action: draw 1 card, +1 stealth turn'
    },

    // 🟥 Ballistic × 2 → Overkill
    OVERKILL: {
      name: 'Overkill',
      type: SYNERGY_TYPES.IMMEDIATE,
      enablerTags: [SYNERGY_TAGS.BALLISTIC],
      payoffTags: [SYNERGY_TAGS.BALLISTIC],
      bonus: {
        damageMultiplier: 1.25,
        enemyDamageReduction: -0.25
      },
      cascadeChance: 0,
      description: '🟥×2 Consecutive ballistic: +25% damage, enemy damage reduced 25%'
    },

    // 🟨 Electrical + 🟦 Wet → Electrocution
    ELECTROCUTION: {
      name: 'Electrocution',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.ELECTRICAL],
      payoffTags: [SYNERGY_TAGS.WET],
      bonus: {
        damageBonus: 4,
        enemyStun: 1
      },
      cascadeChance: 0,
      description: '🟨+🟦 Electrical into wet: +4 damage, enemy stunned 1 turn'
    },

    // 🟩 Improvised + 🟨 Electrical → Jury-Rig Surge
    JURY_RIG_SURGE: {
      name: 'Jury-Rig Surge',
      type: SYNERGY_TYPES.SEQUENTIAL,
      enablerTags: [SYNERGY_TAGS.IMPROVISED],
      payoffTags: [SYNERGY_TAGS.ELECTRICAL],
      bonus: {
        drawCard: true,
        damageBonus: 2
      },
      cascadeChance: 0.3,
      description: '🟩+🟨 Improvised electrical: draw 1, +2 damage, 30% chain'
    },

    // ⬛ Black Market + any tag → Contraband Boost
    CONTRABAND_BOOST: {
      name: 'Contraband Boost',
      type: SYNERGY_TYPES.IMMEDIATE,
      enablerTags: [SYNERGY_TAGS.BLACK_MARKET],
      payoffTags: [
        SYNERGY_TAGS.BALLISTIC, SYNERGY_TAGS.WET, SYNERGY_TAGS.ELECTRICAL,
        SYNERGY_TAGS.COVERT, SYNERGY_TAGS.IMPROVISED,
        SYNERGY_TAGS.FIRE, SYNERGY_TAGS.EXPLOSIVE, SYNERGY_TAGS.TECH,
        SYNERGY_TAGS.MELEE, SYNERGY_TAGS.RANGED
      ],
      bonus: {
        damageBonus: 3,
        costReduction: 1
      },
      cascadeChance: 0,
      description: '⬛ Black market gear boosts any attack: +3 damage, -1 cost'
    }
  };

  // Active synergy state (tracks current combat synergies)
  var _activeState = {
    cardsPlayedThisTurn: [],
    synergyChains: [],
    aggressiveStacks: 0,
    lastCardPlayed: null,
    combatStartTime: null
  };

  /**
   * Initialize synergy engine for new combat
   */
  function init() {
    _activeState = {
      cardsPlayedThisTurn: [],
      synergyChains: [],
      aggressiveStacks: 0,
      lastCardPlayed: null,
      combatStartTime: Date.now()
    };
  }

  /**
   * Reset synergy state between turns
   */
  function resetTurn() {
    _activeState.cardsPlayedThisTurn = [];
    // Keep synergy chains and stacks across turns for sequential synergies
  }

  /**
   * Reset all synergy state (between combats)
   */
  function reset() {
    init();
  }

  /**
   * Register a card being played
   * @param {Object} card - The card being played
   * @returns {Object} - Synergy effects to apply
   */
  function registerCardPlay(card) {
    if (!card || !card.synergyTags) {
      return { synergies: [], bonuses: {} };
    }

    _activeState.cardsPlayedThisTurn.push(card);
    _activeState.lastCardPlayed = card;

    // Detect active synergies
    var activeSynergies = detectSynergies(card);

    // Calculate bonuses from synergies
    var bonuses = calculateBonuses(activeSynergies, card);

    // Update synergy chains
    updateSynergyChains(card, activeSynergies);

    return {
      synergies: activeSynergies,
      bonuses: bonuses,
      description: formatSynergyDescription(activeSynergies)
    };
  }

  /**
   * Detect active synergies for a card being played
   * @param {Object} card - The card being played
   * @returns {Array} - Array of active synergy definitions
   */
  function detectSynergies(card) {
    var activeSynergies = [];

    // Check each synergy definition
    for (var synergyKey in SYNERGY_DEFINITIONS) {
      var synergy = SYNERGY_DEFINITIONS[synergyKey];

      // Check if this card can be a payoff for this synergy
      var isPayoff = hasAnyTag(card.synergyTags, synergy.payoffTags);

      if (isPayoff) {
        // Check if an enabler was played recently
        var enablerFound = findEnablerInHistory(synergy);

        if (enablerFound) {
          activeSynergies.push({
            definition: synergy,
            enabler: enablerFound,
            payoff: card,
            key: synergyKey
          });
        }
      }
    }

    return activeSynergies;
  }

  /**
   * Check if card has any of the specified tags
   * @param {Array} cardTags - Tags on the card
   * @param {Array} requiredTags - Tags required for synergy
   * @returns {Boolean}
   */
  function hasAnyTag(cardTags, requiredTags) {
    if (!cardTags || !requiredTags) return false;

    for (var i = 0; i < requiredTags.length; i++) {
      if (cardTags.indexOf(requiredTags[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find an enabler card in play history
   * @param {Object} synergy - Synergy definition
   * @returns {Object|null} - Enabler card or null
   */
  function findEnablerInHistory(synergy) {
    // For immediate synergies, check cards played this turn
    if (synergy.type === SYNERGY_TYPES.IMMEDIATE) {
      for (var i = _activeState.cardsPlayedThisTurn.length - 1; i >= 0; i--) {
        var card = _activeState.cardsPlayedThisTurn[i];
        if (card.synergyTags && hasAnyTag(card.synergyTags, synergy.enablerTags)) {
          return card;
        }
      }
    }

    // For sequential/stateful synergies, check last 3 turns
    // (simplified: just check all cards this turn for now)
    for (var j = 0; j < _activeState.cardsPlayedThisTurn.length; j++) {
      var c = _activeState.cardsPlayedThisTurn[j];
      if (c.synergyTags && hasAnyTag(c.synergyTags, synergy.enablerTags)) {
        return c;
      }
    }

    return null;
  }

  /**
   * Calculate bonuses from active synergies
   * @param {Array} activeSynergies - Active synergy definitions
   * @param {Object} card - The card being played
   * @returns {Object} - Calculated bonuses
   */
  function calculateBonuses(activeSynergies, card) {
    var bonuses = {
      damageMultiplier: 1.0,
      damageBonus: 0,
      energyRefund: 0,
      costReduction: 0,
      ammoRefund: 0,
      aoeExpansion: 0,
      guaranteedCrit: false,
      applyDisrupt: false,
      drawCard: false,
      fatigueImmune: false,
      speedBonus: 0
    };

    // Apply bonuses from each active synergy
    for (var i = 0; i < activeSynergies.length; i++) {
      var syn = activeSynergies[i].definition;
      var bonus = syn.bonus;

      if (bonus.damageMultiplier) {
        bonuses.damageMultiplier *= bonus.damageMultiplier;
      }
      if (bonus.damageBonus) {
        bonuses.damageBonus += bonus.damageBonus;
      }
      if (bonus.energyRefund) {
        bonuses.energyRefund += bonus.energyRefund;
      }
      if (bonus.costReduction) {
        bonuses.costReduction += bonus.costReduction;
      }
      if (bonus.ammoRefund) {
        bonuses.ammoRefund += bonus.ammoRefund;
      }
      if (bonus.aoeExpansion) {
        bonuses.aoeExpansion += bonus.aoeExpansion;
      }
      if (bonus.guaranteedCrit) {
        bonuses.guaranteedCrit = true;
      }
      if (bonus.applyDisrupt) {
        bonuses.applyDisrupt = true;
      }
      if (bonus.drawCard) {
        bonuses.drawCard = true;
      }
      if (bonus.fatigueImmune) {
        bonuses.fatigueImmune = true;
      }
      if (bonus.speedBonus) {
        bonuses.speedBonus += bonus.speedBonus;
      }

      // Handle aggressive stacks
      if (bonus.damagePerStack) {
        if (hasAnyTag(card.synergyTags, [SYNERGY_TAGS.AGGRESSIVE])) {
          _activeState.aggressiveStacks = Math.min(
            (_activeState.aggressiveStacks || 0) + 1,
            bonus.maxStacks || 5
          );
          bonuses.damageBonus += _activeState.aggressiveStacks * bonus.damagePerStack;
        }
      }
    }

    return bonuses;
  }

  /**
   * Update synergy chains for tracking
   * @param {Object} card - Card being played
   * @param {Array} activeSynergies - Active synergies
   */
  function updateSynergyChains(card, activeSynergies) {
    if (activeSynergies.length > 0) {
      _activeState.synergyChains.push({
        card: card,
        synergies: activeSynergies,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Format synergy description for display
   * @param {Array} activeSynergies - Active synergies
   * @returns {String} - Formatted description
   */
  function formatSynergyDescription(activeSynergies) {
    if (activeSynergies.length === 0) {
      return '';
    }

    var descriptions = [];
    for (var i = 0; i < activeSynergies.length; i++) {
      var syn = activeSynergies[i];
      descriptions.push('⚡ ' + syn.definition.name + ': ' + syn.definition.description);
    }

    return descriptions.join('\n');
  }

  /**
   * Get current synergy state for debugging
   * @returns {Object} - Current state
   */
  function getState() {
    return Object.assign({}, _activeState);
  }

  /**
   * Check if a card would trigger synergies (for UI highlighting)
   * @param {Object} card - Card to check
   * @param {Array} cardsInPlay - Other cards in current context
   * @returns {Array} - Potential synergies
   */
  function checkPotentialSynergies(card, cardsInPlay) {
    if (!card || !card.synergyTags) {
      return [];
    }

    var potentials = [];

    for (var synergyKey in SYNERGY_DEFINITIONS) {
      var synergy = SYNERGY_DEFINITIONS[synergyKey];

      // Check if this card is an enabler
      if (hasAnyTag(card.synergyTags, synergy.enablerTags)) {
        // Find potential payoffs in hand
        for (var i = 0; i < cardsInPlay.length; i++) {
          var other = cardsInPlay[i];
          if (other.synergyTags && hasAnyTag(other.synergyTags, synergy.payoffTags)) {
            potentials.push({
              synergy: synergy,
              role: 'enabler',
              partner: other
            });
          }
        }
      }

      // Check if this card is a payoff
      if (hasAnyTag(card.synergyTags, synergy.payoffTags)) {
        // Check if enabler was played
        var enabler = findEnablerInHistory(synergy);
        if (enabler) {
          potentials.push({
            synergy: synergy,
            role: 'payoff',
            partner: enabler
          });
        }
      }
    }

    return potentials;
  }

  // Public API
  return {
    init: init,
    reset: reset,
    resetTurn: resetTurn,
    registerCardPlay: registerCardPlay,
    checkPotentialSynergies: checkPotentialSynergies,
    getState: getState,
    SYNERGY_TAGS: SYNERGY_TAGS,
    SYNERGY_TYPES: SYNERGY_TYPES,
    SYNERGY_DEFINITIONS: SYNERGY_DEFINITIONS
  };
})();

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SynergyEngine;
}
