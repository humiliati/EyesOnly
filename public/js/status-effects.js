/* ============================================================
   EYES ONLY - Status Effects System
   Implements all 12 status effect types from the card system spec.
   Manages status application, duration tracking, and interactions.
   ============================================================ */

const StatusEffects = (function () {
  'use strict';

  // Status effect categories
  const CATEGORIES = {
    DOT: 'dot',           // Damage over time
    CONTROL: 'control',   // Action/movement restrictions
    MENTAL: 'mental',     // Psychological effects
    STEALTH: 'stealth',   // Visibility/detection
    ENV: 'environmental'  // Environmental conditions
  };

  // Status effect definitions from spec (section 7.1)
  const STATUS_TYPES = {
    BURNING: {
      id: 'STAT_001',
      name: 'Burning',
      icon: '🔥',
      category: CATEGORIES.DOT,
      defaultDuration: 3,
      effects: {
        hpDrainPerTurn: 2,
        focusReduction: 2
      },
      counters: ['WET', 'ROLL_ACTION'],
      description: 'HP drain, focus reduction'
    },
    BLEEDING: {
      id: 'STAT_002',
      name: 'Bleeding',
      icon: '💉',
      category: CATEGORIES.DOT,
      defaultDuration: 3,
      effects: {
        hpDrainPerTurn: 1,
        fatigueOnMovement: 2
      },
      counters: ['BANDAGE'],
      description: 'HP drain, fatigue on movement'
    },
    STUNNED: {
      id: 'STAT_003',
      name: 'Stunned',
      icon: '⚡',
      category: CATEGORIES.CONTROL,
      defaultDuration: 1,
      effects: {
        skipNextAction: true
      },
      counters: ['TIME'],
      description: 'Skip next action'
    },
    SUPPRESSED: {
      id: 'STAT_004',
      name: 'Suppressed',
      icon: '💥',
      category: CATEGORIES.CONTROL,
      defaultDuration: 2,
      effects: {
        accuracyPenalty: -30,
        focusDisabled: true
      },
      counters: ['QUIET_ACTION'],
      description: 'Accuracy down, focus disabled'
    },
    KNOCKED_DOWN: {
      id: 'STAT_005',
      name: 'Knocked Down',
      icon: '🧱',
      category: CATEGORIES.CONTROL,
      defaultDuration: 1,
      effects: {
        movementDisabled: true,
        defensePenalty: -20
      },
      counters: ['STAND_UP'],
      description: 'Lose movement, defense down'
    },
    PANIC: {
      id: 'STAT_006',
      name: 'Panic',
      icon: '😱',
      category: CATEGORIES.MENTAL,
      defaultDuration: 3,
      effects: {
        misplayChance: 0.25,
        randomDiscard: true,
        accuracyPenalty: -20
      },
      counters: ['STEALTH', 'CIGARETTE'],
      description: 'Misplay chance, discard, accuracy down'
    },
    CALM: {
      id: 'STAT_007',
      name: 'Calm',
      icon: '🎯',
      category: CATEGORIES.MENTAL,
      defaultDuration: 3,
      effects: {
        accuracyBonus: 15,
        critBonus: 10,
        betterDraws: true
      },
      counters: ['LOUD_ACTION'],
      description: 'Accuracy up, crit up, better draws'
    },
    HIDDEN: {
      id: 'STAT_008',
      name: 'Hidden',
      icon: '👁️',
      category: CATEGORIES.STEALTH,
      defaultDuration: 99, // Until broken
      effects: {
        untargetable: true
      },
      counters: ['LOUD_SHOT', 'DAMAGE_TAKEN'],
      description: 'Enemy cannot target'
    },
    EXPOSED: {
      id: 'STAT_009',
      name: 'Exposed',
      icon: '💡',
      category: CATEGORIES.STEALTH,
      defaultDuration: 1,
      effects: {
        enemyAccuracyBonus: 20
      },
      counters: ['REPOSITION'],
      description: 'Enemy accuracy up'
    },
    OILED: {
      id: 'STAT_010',
      name: 'Oiled',
      icon: '🛢️',
      category: CATEGORIES.ENV,
      defaultDuration: 99, // Until cleaned
      effects: {
        slippery: true,
        fireVulnerable: true
      },
      counters: ['LIGHTER_IGNITE', 'CLEAN'],
      description: 'Slippery, fire vulnerable'
    },
    WET: {
      id: 'STAT_011',
      name: 'Wet',
      icon: '💧',
      category: CATEGORIES.ENV,
      defaultDuration: 2,
      effects: {
        shockVulnerable: true,
        burnResistant: true
      },
      counters: ['DRY', 'TIME'],
      description: 'Shock vulnerable, burn resistant'
    },
    ELECTRIFIED: {
      id: 'STAT_012',
      name: 'Electrified',
      icon: '⚡',
      category: CATEGORIES.ENV,
      defaultDuration: 1,
      effects: {
        stunRisk: 0.5,
        movementSlow: true
      },
      counters: ['EXIT_WATER'],
      description: 'Stun risk, slow'
    }
  };

  // Status effect class
  class StatusEffect {
    constructor(type, duration, source) {
      if (!STATUS_TYPES[type]) {
        throw new Error('Unknown status type: ' + type);
      }

      const template = STATUS_TYPES[type];
      this.id = template.id;
      this.type = type;
      this.name = template.name;
      this.icon = template.icon;
      this.category = template.category;
      this.duration = duration !== undefined ? duration : template.defaultDuration;
      this.maxDuration = this.duration;
      this.effects = Object.assign({}, template.effects);
      this.counters = template.counters.slice();
      this.description = template.description;
      this.source = source || 'unknown'; // What applied this status
      this.appliedAt = Date.now();
    }

    /**
     * Tick the status effect (reduce duration by 1)
     * @returns {boolean} True if status is still active
     */
    tick() {
      if (this.duration > 0) {
        this.duration--;
      }
      return this.duration > 0;
    }

    /**
     * Check if status effect has expired
     * @returns {boolean}
     */
    isExpired() {
      return this.duration <= 0;
    }

    /**
     * Apply the status effect's per-turn effects
     * @param {Object} target - Target entity (player or enemy)
     * @returns {Array} Array of effect messages
     */
    applyEffects(target) {
      const messages = [];

      // DOT effects
      if (this.effects.hpDrainPerTurn && target.health !== undefined) {
        target.health = Math.max(0, target.health - this.effects.hpDrainPerTurn);
        messages.push(target.name + ' takes ' + this.effects.hpDrainPerTurn + ' damage from ' + this.name);
      }

      // Focus reduction (for burning)
      if (this.effects.focusReduction && typeof GAMESTATE !== 'undefined') {
        GAMESTATE.loseFocus(this.effects.focusReduction);
        messages.push('Focus reduced by ' + this.effects.focusReduction + ' (Burning)');
      }

      // Fatigue from bleeding on movement
      if (this.effects.fatigueOnMovement && target.justMoved) {
        if (typeof GAMESTATE !== 'undefined') {
          GAMESTATE.addFatigue(this.effects.fatigueOnMovement);
          messages.push('Fatigue increased from Bleeding');
        }
      }

      return messages;
    }

    /**
     * Check if a counter removes this status
     * @param {string} counter - Counter action/item
     * @returns {boolean}
     */
    canBeCounteredBy(counter) {
      return this.counters.indexOf(counter) !== -1;
    }

    /**
     * Serialize to plain object for storage
     * @returns {Object}
     */
    toJSON() {
      return {
        type: this.type,
        duration: this.duration,
        maxDuration: this.maxDuration,
        source: this.source,
        appliedAt: this.appliedAt
      };
    }

    /**
     * Create from plain object
     * @param {Object} data
     * @returns {StatusEffect}
     */
    static fromJSON(data) {
      const status = new StatusEffect(data.type, data.duration, data.source);
      status.maxDuration = data.maxDuration;
      status.appliedAt = data.appliedAt;
      return status;
    }
  }

  // Status effect manager for tracking active statuses
  class StatusEffectManager {
    constructor() {
      this.activeStatuses = []; // Array of StatusEffect instances
      this.maxVisibleStatuses = 3; // Spec section 7.2
    }

    /**
     * Apply a status effect
     * @param {string} type - Status type (e.g., 'BURNING')
     * @param {number} duration - Optional custom duration
     * @param {string} source - What applied the status
     * @returns {StatusEffect} The applied status
     */
    apply(type, duration, source) {
      // Check if status already exists
      const existing = this.activeStatuses.find(s => s.type === type);
      if (existing) {
        // Refresh duration if new duration is longer
        const newDuration = duration !== undefined ? duration : STATUS_TYPES[type].defaultDuration;
        if (newDuration > existing.duration) {
          existing.duration = newDuration;
          existing.maxDuration = newDuration;
        }
        return existing;
      }

      // Create new status
      const status = new StatusEffect(type, duration, source);
      this.activeStatuses.push(status);
      return status;
    }

    /**
     * Remove a status effect by type
     * @param {string} type - Status type to remove
     * @returns {boolean} True if removed
     */
    remove(type) {
      const index = this.activeStatuses.findIndex(s => s.type === type);
      if (index !== -1) {
        this.activeStatuses.splice(index, 1);
        return true;
      }
      return false;
    }

    /**
     * Remove statuses by counter (e.g., water removes fire)
     * @param {string} counter - Counter action/item
     * @returns {Array} Array of removed status names
     */
    counter(counter) {
      const removed = [];
      this.activeStatuses = this.activeStatuses.filter(status => {
        if (status.canBeCounteredBy(counter)) {
          removed.push(status.name);
          return false;
        }
        return true;
      });
      return removed;
    }

    /**
     * Check if a specific status is active
     * @param {string} type - Status type
     * @returns {boolean}
     */
    has(type) {
      return this.activeStatuses.some(s => s.type === type);
    }

    /**
     * Get a specific active status
     * @param {string} type - Status type
     * @returns {StatusEffect|null}
     */
    get(type) {
      return this.activeStatuses.find(s => s.type === type) || null;
    }

    /**
     * Tick all status effects (called at end of turn)
     * @param {Object} target - Target entity
     * @returns {Array} Array of effect messages
     */
    tick(target) {
      const messages = [];

      // Apply effects and tick durations
      this.activeStatuses = this.activeStatuses.filter(status => {
        const effectMessages = status.applyEffects(target);
        messages.push(...effectMessages);

        const stillActive = status.tick();
        if (!stillActive) {
          messages.push(status.name + ' has worn off');
        }
        return stillActive;
      });

      return messages;
    }

    /**
     * Clear all status effects
     */
    clear() {
      this.activeStatuses = [];
    }

    /**
     * Get all active statuses
     * @returns {Array<StatusEffect>}
     */
    getAll() {
      return this.activeStatuses.slice();
    }

    /**
     * Get visible statuses (max 3 for UI display)
     * @returns {Array<StatusEffect>}
     */
    getVisible() {
      return this.activeStatuses.slice(0, this.maxVisibleStatuses);
    }

    /**
     * Get status effects by category
     * @param {string} category - Category name
     * @returns {Array<StatusEffect>}
     */
    getByCategory(category) {
      return this.activeStatuses.filter(s => s.category === category);
    }

    /**
     * Calculate total accuracy modifier from all statuses
     * @returns {number}
     */
    getAccuracyModifier() {
      let modifier = 0;
      for (let status of this.activeStatuses) {
        if (status.effects.accuracyPenalty) {
          modifier += status.effects.accuracyPenalty;
        }
        if (status.effects.accuracyBonus) {
          modifier += status.effects.accuracyBonus;
        }
      }
      return modifier;
    }

    /**
     * Calculate total defense modifier from all statuses
     * @returns {number}
     */
    getDefenseModifier() {
      let modifier = 0;
      for (let status of this.activeStatuses) {
        if (status.effects.defensePenalty) {
          modifier += status.effects.defensePenalty;
        }
        if (status.effects.defenseBonus) {
          modifier += status.effects.defenseBonus;
        }
      }
      return modifier;
    }

    /**
     * Check if movement is disabled
     * @returns {boolean}
     */
    isMovementDisabled() {
      return this.activeStatuses.some(s => s.effects.movementDisabled);
    }

    /**
     * Check if action is disabled (stunned)
     * @returns {boolean}
     */
    isActionDisabled() {
      return this.activeStatuses.some(s => s.effects.skipNextAction);
    }

    /**
     * Check if entity is untargetable
     * @returns {boolean}
     */
    isUntargetable() {
      return this.activeStatuses.some(s => s.effects.untargetable);
    }

    /**
     * Serialize to JSON for storage
     * @returns {Array}
     */
    toJSON() {
      return this.activeStatuses.map(s => s.toJSON());
    }

    /**
     * Load from JSON
     * @param {Array} data
     */
    fromJSON(data) {
      this.activeStatuses = data.map(d => StatusEffect.fromJSON(d));
    }
  }

  // Status interaction matrix (spec section 7.3)
  const INTERACTIONS = {
    // Fire + Oil = explosive spread
    BURNING_OILED: function(manager) {
      // Double burn damage when oiled
      const burning = manager.get('BURNING');
      if (burning) {
        burning.effects.hpDrainPerTurn *= 2;
      }
      return ['Oiled fuel causes intense burning!'];
    },
    // Water removes fire
    WET_BURNING: function(manager) {
      manager.remove('BURNING');
      return ['Water extinguishes the flames'];
    },
    // Electrified water causes stun
    WET_ELECTRIFIED: function(manager) {
      if (Math.random() < 0.5) {
        manager.apply('STUNNED', 1, 'electrified_water');
        return ['Electrified water causes stunning shock!'];
      }
      return [];
    }
  };

  /**
   * Process status interactions
   * @param {StatusEffectManager} manager
   * @returns {Array} Messages from interactions
   */
  function processInteractions(manager) {
    const messages = [];

    // Check for burning + oiled
    if (manager.has('BURNING') && manager.has('OILED')) {
      messages.push(...INTERACTIONS.BURNING_OILED(manager));
    }

    // Check for wet + burning
    if (manager.has('WET') && manager.has('BURNING')) {
      messages.push(...INTERACTIONS.WET_BURNING(manager));
    }

    // Check for wet + electrified
    if (manager.has('WET') && manager.has('ELECTRIFIED')) {
      messages.push(...INTERACTIONS.WET_ELECTRIFIED(manager));
    }

    return messages;
  }

  // Public API
  return {
    CATEGORIES: CATEGORIES,
    STATUS_TYPES: STATUS_TYPES,
    StatusEffect: StatusEffect,
    StatusEffectManager: StatusEffectManager,
    processInteractions: processInteractions,

    /**
     * Create a new status effect
     * @param {string} type - Status type
     * @param {number} duration - Optional duration
     * @param {string} source - Source of status
     * @returns {StatusEffect}
     */
    create: function(type, duration, source) {
      return new StatusEffect(type, duration, source);
    },

    /**
     * Create a new status effect manager
     * @returns {StatusEffectManager}
     */
    createManager: function() {
      return new StatusEffectManager();
    }
  };
})();
