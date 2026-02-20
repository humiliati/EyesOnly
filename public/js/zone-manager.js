/* ============================================================
   EYES ONLY - Card Zone Manager
   Manages card zone boundaries and movement rules
   ============================================================ */

const CardZoneManager = (function () {
  'use strict';

  // Zone types definition
  var ZONES = {
    HAND: 'hand',                        // Loose inventory (8 slots), lost on death
    ACTION_BUTTONS: 'action_buttons',    // Variable slots (equipment-modified), persistent during combat
    INVENTORY: 'inventory',              // Persistent inventory (9-12 slots), bonfire/shop only access
    ACTIVE_ITEM: 'active_item',          // Equipment slot (trench coat, etc.)
    DISCARD: 'discard',                  // Consumed cards (not implemented yet)
    EXHAUST: 'exhaust',                  // Exhausted cards (not implemented yet)
    DECK: 'deck'                         // Draw pile (not implemented yet)
  };

  // Movement context/game states
  var CONTEXTS = {
    COMBAT_ACTIVE: 'combat_active',
    COMBAT_PLANNING: 'combat_planning',
    COMBAT_RESOLUTION: 'combat_resolution',
    BONFIRE: 'bonfire',
    SHOP: 'shop',
    EXPLORATION: 'exploration',
    DEATH: 'death'
  };

  // Current game context (defaults to exploration)
  var _currentContext = CONTEXTS.EXPLORATION;

  // Cards moved from action buttons to hand this turn (for one-per-turn rule)
  var _cardsMovedThisTurn = 0;

  /**
   * Set the current game context
   * @param {string} context - One of CONTEXTS values
   */
  function setContext(context) {
    if (CONTEXTS[context.toUpperCase()]) {
      _currentContext = context;

      // Reset turn counter when entering new combat phase
      if (context === CONTEXTS.COMBAT_PLANNING) {
        _cardsMovedThisTurn = 0;
      }
    }
  }

  /**
   * Get the current game context
   * @returns {string} Current context
   */
  function getContext() {
    return _currentContext;
  }

  /**
   * Reset turn counter (call at start of each combat turn)
   */
  function resetTurnCounter() {
    _cardsMovedThisTurn = 0;
  }

  /**
   * Check if a card movement between zones is allowed
   * @param {string} fromZone - Source zone
   * @param {string} toZone - Destination zone
   * @param {Object} options - Additional options {skipTurnLimit: bool}
   * @returns {Object} {allowed: bool, reason: string}
   */
  function canMoveCard(fromZone, toZone, options) {
    options = options || {};

    // Normalize zone names to uppercase for comparison
    var from = fromZone.toUpperCase();
    var to = toZone.toUpperCase();

    // Hand -> Action Buttons (commit action)
    if (from === 'HAND' && to === 'ACTION_BUTTONS') {
      // Check if action buttons have space
      if (typeof GAMESTATE !== 'undefined') {
        var actionCards = GAMESTATE.getActionButtonCards();
        var maxSlots = getActionButtonCapacity();
        if (actionCards.length >= maxSlots) {
          return {
            allowed: false,
            reason: 'ACTION BUTTON SLOTS FULL (' + actionCards.length + '/' + maxSlots + ')'
          };
        }
      }
      return { allowed: true };
    }

    // Action Buttons -> Hand (one per turn during combat)
    if (from === 'ACTION_BUTTONS' && to === 'HAND') {
      // Check if in combat
      if (_currentContext === CONTEXTS.COMBAT_ACTIVE ||
          _currentContext === CONTEXTS.COMBAT_PLANNING ||
          _currentContext === CONTEXTS.COMBAT_RESOLUTION) {

        // Enforce one-card-per-turn limit unless explicitly skipped
        if (!options.skipTurnLimit && _cardsMovedThisTurn >= 1) {
          return {
            allowed: false,
            reason: 'Only one card can be moved from action buttons to hand per turn during combat'
          };
        }
      }

      // Check if hand has space
      if (typeof GAMESTATE !== 'undefined') {
        var looseInv = GAMESTATE.getLooseInventory();
        var looseSlots = GAMESTATE.getState().looseSlots || 8;
        if (looseInv.length >= looseSlots) {
          return {
            allowed: false,
            reason: 'HAND FULL (' + looseInv.length + '/' + looseSlots + ')'
          };
        }
      }

      return { allowed: true };
    }

    // Action Buttons -> Inventory (bonfire or shop only)
    if (from === 'ACTION_BUTTONS' && to === 'INVENTORY') {
      if (_currentContext !== CONTEXTS.BONFIRE && _currentContext !== CONTEXTS.SHOP) {
        return {
          allowed: false,
          reason: 'Can only move cards to inventory at bonfire or shop'
        };
      }
      return { allowed: true };
    }

    // Inventory -> Action Buttons (bonfire or shop only)
    if (from === 'INVENTORY' && to === 'ACTION_BUTTONS') {
      if (_currentContext !== CONTEXTS.BONFIRE && _currentContext !== CONTEXTS.SHOP) {
        return {
          allowed: false,
          reason: 'Can only access inventory at bonfire or shop'
        };
      }

      // Check if action buttons have space
      if (typeof GAMESTATE !== 'undefined') {
        var actionCards = GAMESTATE.getActionButtonCards();
        var maxSlots = getActionButtonCapacity();
        if (actionCards.length >= maxSlots) {
          return {
            allowed: false,
            reason: 'ACTION BUTTON SLOTS FULL (' + actionCards.length + '/' + maxSlots + ')'
          };
        }
      }

      return { allowed: true };
    }

    // Inventory -> Active Item (equipment)
    if (from === 'INVENTORY' && to === 'ACTIVE_ITEM') {
      return { allowed: true };
    }

    // Active Item -> Inventory (unequip)
    if (from === 'ACTIVE_ITEM' && to === 'INVENTORY') {
      return { allowed: true };
    }

    // Hand -> Inventory (not allowed - must use bonfire stash)
    if (from === 'HAND' && to === 'INVENTORY') {
      if (_currentContext !== CONTEXTS.BONFIRE && _currentContext !== CONTEXTS.SHOP) {
        return {
          allowed: false,
          reason: 'Can only stash to inventory at bonfire or shop'
        };
      }
      return { allowed: true };
    }

    // Inventory -> Hand (bonfire or shop only)
    if (from === 'INVENTORY' && to === 'HAND') {
      if (_currentContext !== CONTEXTS.BONFIRE && _currentContext !== CONTEXTS.SHOP) {
        return {
          allowed: false,
          reason: 'Can only retrieve from inventory at bonfire or shop'
        };
      }
      return { allowed: true };
    }

    // Default: movement not allowed
    return {
      allowed: false,
      reason: 'Movement from ' + fromZone + ' to ' + toZone + ' is not permitted'
    };
  }

  /**
   * Execute a card movement (validates and performs the move)
   * @param {Object} card - Card object to move
   * @param {string} fromZone - Source zone
   * @param {string} toZone - Destination zone
   * @param {Object} options - Additional options
   * @returns {Object} {success: bool, message: string}
   */
  function moveCard(card, fromZone, toZone, options) {
    // Check if movement is allowed
    var validation = canMoveCard(fromZone, toZone, options);
    if (!validation.allowed) {
      return {
        success: false,
        message: validation.reason
      };
    }

    // Perform the movement using GAMESTATE functions
    if (typeof GAMESTATE === 'undefined') {
      return {
        success: false,
        message: 'GAMESTATE module not available'
      };
    }

    var from = fromZone.toUpperCase();
    var to = toZone.toUpperCase();

    // Execute the movement based on zones
    try {
      // Action Buttons -> Hand
      if (from === 'ACTION_BUTTONS' && to === 'HAND') {
        var actionCards = GAMESTATE.getActionButtonCards();
        var cardIndex = actionCards.findIndex(function(c) {
          return c.id === card.id || c === card;
        });

        if (cardIndex === -1) {
          return { success: false, message: 'Card not found in action buttons' };
        }

        var removeResult = GAMESTATE.removeFromActionButtons(cardIndex);
        if (!removeResult.success) {
          return { success: false, message: 'Failed to remove card from action buttons' };
        }

        var addResult = GAMESTATE.addToLoose(card);
        if (!addResult.success) {
          GAMESTATE.addToActionButtons(card);
          return { success: false, message: addResult.message };
        }

        _cardsMovedThisTurn++;

        return {
          success: true,
          message: 'Card moved from action buttons to hand'
        };
      }

      // Hand -> Action Buttons
      if (from === 'HAND' && to === 'ACTION_BUTTONS') {
        var looseInv = GAMESTATE.getLooseInventory();
        var cardIndex = looseInv.findIndex(function(c) {
          return c.id === card.id || c === card;
        });

        if (cardIndex === -1) {
          return { success: false, message: 'Card not found in hand' };
        }

        var removeResult = GAMESTATE.removeFromLoose(cardIndex);
        if (!removeResult.success) {
          return { success: false, message: 'Failed to remove card from hand' };
        }

        var addResult = GAMESTATE.addToActionButtons(card);
        if (!addResult.success) {
          GAMESTATE.addToLoose(card);
          return { success: false, message: addResult.message };
        }

        return {
          success: true,
          message: 'Card moved from hand to action buttons'
        };
      }

      // Action Buttons -> Inventory
      if (from === 'ACTION_BUTTONS' && to === 'INVENTORY') {
        var actionCards = GAMESTATE.getActionButtonCards();
        var cardIndex = actionCards.findIndex(function(c) {
          return c.id === card.id || c === card;
        });

        if (cardIndex === -1) {
          return { success: false, message: 'Card not found in action buttons' };
        }

        var removeResult = GAMESTATE.removeFromActionButtons(cardIndex);
        if (!removeResult.success) {
          return { success: false, message: 'Failed to remove card from action buttons' };
        }

        var addResult = GAMESTATE.addToPersistent(card);
        if (!addResult.success) {
          GAMESTATE.addToActionButtons(card);
          return { success: false, message: addResult.message };
        }

        return {
          success: true,
          message: 'Card moved from action buttons to inventory'
        };
      }

      // Inventory -> Action Buttons
      if (from === 'INVENTORY' && to === 'ACTION_BUTTONS') {
        var persistentInv = GAMESTATE.getPersistentInventory();
        var cardIndex = persistentInv.findIndex(function(c) {
          return c.id === card.id || c === card;
        });

        if (cardIndex === -1) {
          return { success: false, message: 'Card not found in inventory' };
        }

        var removeResult = GAMESTATE.removeFromPersistent(cardIndex);
        if (!removeResult.success) {
          return { success: false, message: 'Failed to remove card from inventory' };
        }

        var addResult = GAMESTATE.addToActionButtons(card);
        if (!addResult.success) {
          GAMESTATE.addToPersistent(card);
          return { success: false, message: addResult.message };
        }

        return {
          success: true,
          message: 'Card moved from inventory to action buttons'
        };
      }

      // Hand -> Inventory
      if (from === 'HAND' && to === 'INVENTORY') {
        var looseInv = GAMESTATE.getLooseInventory();
        var cardIndex = looseInv.findIndex(function(c) {
          return c.id === card.id || c === card;
        });

        if (cardIndex === -1) {
          return { success: false, message: 'Card not found in hand' };
        }

        var removeResult = GAMESTATE.removeFromLoose(cardIndex);
        if (!removeResult.success) {
          return { success: false, message: 'Failed to remove card from hand' };
        }

        var addResult = GAMESTATE.addToPersistent(card);
        if (!addResult.success) {
          GAMESTATE.addToLoose(card);
          return { success: false, message: addResult.message };
        }

        return {
          success: true,
          message: 'Card moved from hand to inventory'
        };
      }

      // Inventory -> Hand
      if (from === 'INVENTORY' && to === 'HAND') {
        var persistentInv = GAMESTATE.getPersistentInventory();
        var cardIndex = persistentInv.findIndex(function(c) {
          return c.id === card.id || c === card;
        });

        if (cardIndex === -1) {
          return { success: false, message: 'Card not found in inventory' };
        }

        var removeResult = GAMESTATE.removeFromPersistent(cardIndex);
        if (!removeResult.success) {
          return { success: false, message: 'Failed to remove card from inventory' };
        }

        var addResult = GAMESTATE.addToLoose(card);
        if (!addResult.success) {
          GAMESTATE.addToPersistent(card);
          return { success: false, message: addResult.message };
        }

        return {
          success: true,
          message: 'Card moved from inventory to hand'
        };
      }

      // Inventory -> Active Item (equip)
      if (from === 'INVENTORY' && to === 'ACTIVE_ITEM') {
        var persistentInv = GAMESTATE.getPersistentInventory();
        var cardIndex = persistentInv.findIndex(function(c) {
          return c.id === card.id || c === card;
        });

        if (cardIndex === -1) {
          return { success: false, message: 'Card not found in inventory' };
        }

        // Check if slot is occupied
        var currentActiveItem = GAMESTATE.getActiveItem();
        if (currentActiveItem) {
          return { success: false, message: 'Active item slot is occupied. Unequip first.' };
        }

        var removeResult = GAMESTATE.removeFromPersistent(cardIndex);
        if (!removeResult.success) {
          return { success: false, message: 'Failed to remove card from inventory' };
        }

        GAMESTATE.setActiveItem(card);

        return {
          success: true,
          message: 'Card equipped to active item slot'
        };
      }

      // Active Item -> Inventory (unequip)
      if (from === 'ACTIVE_ITEM' && to === 'INVENTORY') {
        var activeItem = GAMESTATE.getActiveItem();
        if (!activeItem) {
          return { success: false, message: 'No item in active slot' };
        }

        if (activeItem.id !== card.id) {
          return { success: false, message: 'Card does not match active item' };
        }

        var addResult = GAMESTATE.addToPersistent(card);
        if (!addResult.success) {
          return { success: false, message: addResult.message };
        }

        GAMESTATE.clearActiveItem();

        return {
          success: true,
          message: 'Card unequipped from active item slot'
        };
      }

      return {
        success: false,
        message: 'Movement from ' + fromZone + ' to ' + toZone + ' not yet implemented'
      };

    } catch (e) {
      console.error('[CardZoneManager] Error moving card:', e);
      return {
        success: false,
        message: 'Error during card movement: ' + e.message
      };
    }
  }

  /**
   * Get action button capacity (base + equipment modifiers)
   * @returns {number} Total action button slots available
   */
  function getActionButtonCapacity() {
    var baseCapacity = 4; // Base capacity

    // Check if equipment provides capacity bonus
    if (typeof GAMESTATE !== 'undefined') {
      var activeItem = GAMESTATE.getActiveItem();

      // Check if active item has actionButtonSlots stat
      if (activeItem && activeItem.stats && activeItem.stats.actionButtonSlots) {
        baseCapacity += activeItem.stats.actionButtonSlots;
      }
      // Legacy check: trench coat provides +2 slots
      else if (activeItem && activeItem.id && activeItem.id.indexOf('trench_coat') !== -1) {
        baseCapacity += 2;
      }
    }

    return baseCapacity;
  }

  /**
   * Get zone limits
   * @param {string} zone - Zone name
   * @returns {Object} {current: number, max: number}
   */
  function getZoneLimits(zone) {
    if (typeof GAMESTATE === 'undefined') {
      return { current: 0, max: 0 };
    }

    var zoneUpper = zone.toUpperCase();

    if (zoneUpper === 'HAND') {
      var looseInv = GAMESTATE.getLooseInventory();
      var looseSlots = GAMESTATE.getState().looseSlots || 8;
      return { current: looseInv.length, max: looseSlots };
    }

    if (zoneUpper === 'ACTION_BUTTONS') {
      var actionCards = GAMESTATE.getActionButtonCards();
      return { current: actionCards.length, max: getActionButtonCapacity() };
    }

    if (zoneUpper === 'INVENTORY') {
      var persistentInv = GAMESTATE.getPersistentInventory();
      var persistentSlots = GAMESTATE.getState().persistentSlots || 9;
      return { current: persistentInv.length, max: persistentSlots };
    }

    return { current: 0, max: 0 };
  }

  // Public API
  return {
    ZONES: ZONES,
    CONTEXTS: CONTEXTS,
    setContext: setContext,
    getContext: getContext,
    resetTurnCounter: resetTurnCounter,
    canMoveCard: canMoveCard,
    moveCard: moveCard,
    getActionButtonCapacity: getActionButtonCapacity,
    getZoneLimits: getZoneLimits
  };
})();
