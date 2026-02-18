/* ============================================================
   EYES ONLY - Cooldown Tracker System
   Manages multi-combat, floor, and run cooldowns for cards
   ============================================================ */

const CooldownTracker = (function () {
  'use strict';

  // Cooldown types
  const COOLDOWN_TYPES = {
    COMBAT: 'combat',     // Card unusable for N combats after use
    FLOOR: 'floor',       // Card unusable for N floors after use
    RUN: 'run'           // Card unusable once per run (never refreshes)
  };

  /**
   * Card Cooldown Instance
   * Tracks when a specific card instance was last used and when it becomes available again
   */
  class CardCooldown {
    constructor(cardId, cooldownType, cooldownDuration) {
      this.cardId = cardId;                // Unique card instance ID
      this.cooldownType = cooldownType;    // 'combat', 'floor', or 'run'
      this.cooldownDuration = cooldownDuration; // How many combats/floors to wait
      this.usedAtCombat = null;            // Combat number when last used
      this.usedAtFloor = null;             // Floor number when last used
      this.availableAtCombat = null;       // Combat number when available again
      this.availableAtFloor = null;        // Floor number when available again
      this.usedThisRun = false;            // For run-level cooldowns
    }

    /**
     * Mark card as used at current combat/floor
     * @param {number} currentCombat - Current combat count
     * @param {number} currentFloor - Current floor count
     */
    use(currentCombat, currentFloor) {
      this.usedAtCombat = currentCombat;
      this.usedAtFloor = currentFloor;

      if (this.cooldownType === COOLDOWN_TYPES.COMBAT) {
        this.availableAtCombat = currentCombat + this.cooldownDuration;
      } else if (this.cooldownType === COOLDOWN_TYPES.FLOOR) {
        this.availableAtFloor = currentFloor + this.cooldownDuration;
      } else if (this.cooldownType === COOLDOWN_TYPES.RUN) {
        this.usedThisRun = true;
      }
    }

    /**
     * Check if card is available at current combat/floor
     * @param {number} currentCombat - Current combat count
     * @param {number} currentFloor - Current floor count
     * @returns {boolean} True if card is available
     */
    isAvailable(currentCombat, currentFloor) {
      if (this.cooldownType === COOLDOWN_TYPES.COMBAT) {
        return currentCombat >= this.availableAtCombat;
      } else if (this.cooldownType === COOLDOWN_TYPES.FLOOR) {
        return currentFloor >= this.availableAtFloor;
      } else if (this.cooldownType === COOLDOWN_TYPES.RUN) {
        return !this.usedThisRun;
      }
      return true;
    }

    /**
     * Get remaining cooldown duration
     * @param {number} currentCombat - Current combat count
     * @param {number} currentFloor - Current floor count
     * @returns {number} Number of combats/floors remaining, or -1 if run cooldown
     */
    getRemainingCooldown(currentCombat, currentFloor) {
      if (this.cooldownType === COOLDOWN_TYPES.COMBAT) {
        return Math.max(0, this.availableAtCombat - currentCombat);
      } else if (this.cooldownType === COOLDOWN_TYPES.FLOOR) {
        return Math.max(0, this.availableAtFloor - currentFloor);
      } else if (this.cooldownType === COOLDOWN_TYPES.RUN) {
        return this.usedThisRun ? -1 : 0;
      }
      return 0;
    }

    /**
     * Reset cooldown (e.g., via special item or event)
     */
    reset() {
      this.usedAtCombat = null;
      this.usedAtFloor = null;
      this.availableAtCombat = null;
      this.availableAtFloor = null;
      this.usedThisRun = false;
    }

    /**
     * Serialize to JSON for storage
     * @returns {Object}
     */
    toJSON() {
      return {
        cardId: this.cardId,
        cooldownType: this.cooldownType,
        cooldownDuration: this.cooldownDuration,
        usedAtCombat: this.usedAtCombat,
        usedAtFloor: this.usedAtFloor,
        availableAtCombat: this.availableAtCombat,
        availableAtFloor: this.availableAtFloor,
        usedThisRun: this.usedThisRun
      };
    }

    /**
     * Create from JSON
     * @param {Object} data
     * @returns {CardCooldown}
     */
    static fromJSON(data) {
      const cooldown = new CardCooldown(data.cardId, data.cooldownType, data.cooldownDuration);
      cooldown.usedAtCombat = data.usedAtCombat;
      cooldown.usedAtFloor = data.usedAtFloor;
      cooldown.availableAtCombat = data.availableAtCombat;
      cooldown.availableAtFloor = data.availableAtFloor;
      cooldown.usedThisRun = data.usedThisRun;
      return cooldown;
    }
  }

  /**
   * Cooldown Manager
   * Tracks all card cooldowns for the current run
   */
  class CooldownManager {
    constructor() {
      this.cooldowns = {}; // Map: cardId -> CardCooldown
    }

    /**
     * Register a card with cooldown properties
     * @param {string} cardId - Unique card instance ID
     * @param {Object} cooldownConfig - {type: 'combat'|'floor'|'run', duration: number}
     */
    registerCard(cardId, cooldownConfig) {
      if (!cooldownConfig || !cooldownConfig.type) {
        return; // Card has no cooldown
      }

      const cooldown = new CardCooldown(
        cardId,
        cooldownConfig.type,
        cooldownConfig.duration || 1
      );

      this.cooldowns[cardId] = cooldown;
    }

    /**
     * Mark a card as used (apply cooldown)
     * @param {string} cardId - Card instance ID
     * @param {number} currentCombat - Current combat count (from GAMESTATE)
     * @param {number} currentFloor - Current floor count (from GAMESTATE)
     * @returns {boolean} True if cooldown was applied
     */
    useCard(cardId, currentCombat, currentFloor) {
      const cooldown = this.cooldowns[cardId];
      if (!cooldown) {
        return false; // Card has no cooldown
      }

      cooldown.use(currentCombat, currentFloor);
      return true;
    }

    /**
     * Check if a card is available (not on cooldown)
     * @param {string} cardId - Card instance ID
     * @param {number} currentCombat - Current combat count
     * @param {number} currentFloor - Current floor count
     * @returns {boolean} True if card is available
     */
    isCardAvailable(cardId, currentCombat, currentFloor) {
      const cooldown = this.cooldowns[cardId];
      if (!cooldown) {
        return true; // Card has no cooldown, always available
      }

      return cooldown.isAvailable(currentCombat, currentFloor);
    }

    /**
     * Get remaining cooldown for a card
     * @param {string} cardId - Card instance ID
     * @param {number} currentCombat - Current combat count
     * @param {number} currentFloor - Current floor count
     * @returns {Object} {remaining: number, type: string, available: boolean}
     */
    getCooldownInfo(cardId, currentCombat, currentFloor) {
      const cooldown = this.cooldowns[cardId];
      if (!cooldown) {
        return { remaining: 0, type: null, available: true };
      }

      const remaining = cooldown.getRemainingCooldown(currentCombat, currentFloor);
      const available = cooldown.isAvailable(currentCombat, currentFloor);

      return {
        remaining: remaining,
        type: cooldown.cooldownType,
        duration: cooldown.cooldownDuration,
        available: available,
        usedAtCombat: cooldown.usedAtCombat,
        usedAtFloor: cooldown.usedAtFloor
      };
    }

    /**
     * Reset a specific card's cooldown
     * @param {string} cardId - Card instance ID
     */
    resetCard(cardId) {
      const cooldown = this.cooldowns[cardId];
      if (cooldown) {
        cooldown.reset();
      }
    }

    /**
     * Remove a card from tracking (e.g., card was consumed or removed)
     * @param {string} cardId - Card instance ID
     */
    removeCard(cardId) {
      delete this.cooldowns[cardId];
    }

    /**
     * Get all cards currently on cooldown
     * @param {number} currentCombat - Current combat count
     * @param {number} currentFloor - Current floor count
     * @returns {Array} Array of {cardId, cooldownInfo}
     */
    getCardsOnCooldown(currentCombat, currentFloor) {
      const onCooldown = [];

      for (const cardId in this.cooldowns) {
        const cooldown = this.cooldowns[cardId];
        if (!cooldown.isAvailable(currentCombat, currentFloor)) {
          onCooldown.push({
            cardId: cardId,
            cooldownInfo: this.getCooldownInfo(cardId, currentCombat, currentFloor)
          });
        }
      }

      return onCooldown;
    }

    /**
     * Clear all cooldowns (e.g., at end of run)
     */
    clear() {
      this.cooldowns = {};
    }

    /**
     * Serialize to JSON for storage
     * @returns {Object}
     */
    toJSON() {
      const serialized = {};
      for (const cardId in this.cooldowns) {
        serialized[cardId] = this.cooldowns[cardId].toJSON();
      }
      return serialized;
    }

    /**
     * Load from JSON
     * @param {Object} data
     */
    fromJSON(data) {
      this.cooldowns = {};
      for (const cardId in data) {
        this.cooldowns[cardId] = CardCooldown.fromJSON(data[cardId]);
      }
    }
  }

  // Public API
  return {
    COOLDOWN_TYPES: COOLDOWN_TYPES,
    CardCooldown: CardCooldown,
    CooldownManager: CooldownManager,

    /**
     * Create a new cooldown manager
     * @returns {CooldownManager}
     */
    createManager: function() {
      return new CooldownManager();
    },

    /**
     * Parse cooldown config from card baseStats
     * @param {Object} card - Card object with baseStats
     * @returns {Object|null} Cooldown config or null
     */
    parseCooldownFromCard: function(card) {
      if (!card || !card.baseStats) {
        return null;
      }

      const stats = card.baseStats;

      // Check for cooldown properties
      if (stats.cooldownCombat) {
        return { type: COOLDOWN_TYPES.COMBAT, duration: stats.cooldownCombat };
      } else if (stats.cooldownFloor) {
        return { type: COOLDOWN_TYPES.FLOOR, duration: stats.cooldownFloor };
      } else if (stats.cooldownRun || stats.oncePerRun) {
        return { type: COOLDOWN_TYPES.RUN, duration: 1 };
      }

      return null;
    }
  };
})();
