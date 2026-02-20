/* ============================================================
   EYES ONLY - Global Game State Controller
   Manages transitions between Street Chronicles and Gone Rogue
   ============================================================ */

const GAMESTATE = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_gamestate';

  var MODES = {
    STREET: 'street',
    ROGUE: 'rogue'
  };

  var _state = {
    mode: MODES.STREET,
    submode: null,
    inventoryPersistent: [],      // 9-12 slots (safe across death)
    inventoryLoose: [],            // 8 slots (lost on death) - LEGACY, being phased out for card system
    actionButtonCards: [],         // 4 slots - cards available to draw from (reserve/deck)
    cardHand: [],                  // Cards in play hand (drawn for immediate use)
    persistentSlots: 9,            // Start at 9, expand to 12
    maxPersistentSlots: 12,
    looseSlots: 8,                 // LEGACY - for non-card items
    actionButtonSlots: 4,          // Fixed at 4 for Gone Rogue mode (reserve)
    maxHandSize: 5,                // Maximum cards in play hand
    cardDrawPerTurn: 1,            // Base card draw per STR combat turn (can be modified by items)
    cryptos: 0,                    // Currency (¢) - persistent across death
    rogueRun: null,
    activeItemSlot: null,          // Active item slot (for lighting items, etc.)

    // Resource tracking (for STR combat and card system)
    playerFatigue: 0,              // 0-100 scale (0 = no fatigue, 100 = exhausted)
    maxFatigue: 100,
    fatigueRecovery: 5,            // Per turn baseline recovery
    fatigueThreshold: 70,          // Above this, cards cost more/become less effective
    _playerFatigueDecimal: 0.0,    // Hidden decimal fatigue (for smooth sprint drain)

    playerAmmo: 7,                 // Pooled ammunition resource (reduced for balanced economy)
    maxAmmo: 50,                   // Maximum ammo capacity

    // Additional resources (planned for full card system integration)
    playerEnergy: 5,               // 0-5 scale (powers special abilities)
    maxEnergy: 5,
    playerFocus: 10,               // 0-10 scale (improves accuracy)
    maxFocus: 10,
    playerBattery: 5,              // 0-5 scale (powers equipment)
    maxBattery: 5,
    playerStability: 10,           // 0-10 scale (prevents panic)
    maxStability: 10,

    // Consumables inventory (separate from card inventory)
    consumables: [],               // Array of consumable items with counts: {type, count}
    consumableSlots: 3,            // How many different types can be carried
    maxConsumableSlots: 5          // Can be upgraded
  };

  function init() {
    _loadState();
    _ensureDefaultPersistentInventory();

    // Initialize UI currency display
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(_state.cryptos || 0);
    }
  }

  /**
   * Ensure player has default persistent inventory items on first run
   */
  function _ensureDefaultPersistentInventory() {
    // If persistent inventory is empty, add the 3 core items
    if (_state.inventoryPersistent.length === 0) {
      _state.inventoryPersistent = [
        { name: 'Radio Transceiver', emoji: '📻', type: 'equipment', description: 'Encrypted communication device' },
        { name: 'Surveillance Cam', emoji: '📷', type: 'equipment', description: 'Compact surveillance camera' },
        { name: 'Personal Journal', emoji: '📓', type: 'equipment', description: 'Your operational notes and observations' }
      ];
      _saveState();
    }
  }

  function getMode() {
    return _state.mode;
  }

  function getState() {
    return Object.assign({}, _state);
  }

  /**
   * Enter Gone Rogue mode from Street Chronicles
   * @param {Object} context - {reason, seed, difficulty, carryInventory}
   */
  function enterRogueMode(context) {
    context = context || {};

    _state.mode = MODES.ROGUE;
    _state.rogueRun = {
      reason: context.reason || 'story_event',
      seed: context.seed || Date.now(),
      difficulty: context.difficulty || 1,
      startTime: Date.now(),
      turnsElapsed: 0,
      floor: 1,
      combatsCompleted: 0,        // Track combats for cooldown system
      enemiesKilled: 0,
      cardsFound: 0
    };

    // Transfer street inventory to loose carry if specified
    if (context.carryInventory && typeof StreetChronicles !== 'undefined') {
      var streetInv = StreetChronicles.getInventory() || [];
      // Convert card name strings to actual card objects
      var convertedInv = [];
      for (var i = 0; i < streetInv.length && i < _state.looseSlots; i++) {
        var itemStr = streetInv[i];
        var convertedItem = _convertStreetItemToCard(itemStr);
        if (convertedItem) {
          convertedInv.push(convertedItem);
        }
      }
      _state.inventoryLoose = convertedInv;
    }

    _saveState();

    return {
      lines: [
        '',
        '--- CONNECTION UNSTABLE ---',
        '--- ROUTING TO INTERNAL PROCESS ---',
        '',
        'SIGNAL DEGRADATION DETECTED',
        'MEMORY FRAGMENTATION IN PROGRESS',
        'ENTERING GONE ROGUE SUBSYSTEM',
        '',
        'OBJECTIVE: SURVIVE AND EXTRACT',
        'PERSISTENT INVENTORY: ' + _state.persistentSlots + ' SLOTS SAFE',
        'LOOSE CARRY: ' + _state.looseSlots + ' SLOTS (LOST ON DEATH)',
        ''
      ]
    };
  }

  /**
   * Exit Gone Rogue mode back to Street Chronicles
   * @param {Object} result - {success, extractedItem, xp, unlockedSlot}
   */
  function exitRogueMode(result) {
    result = result || {};

    var previousMode = _state.mode;
    _state.mode = MODES.STREET;

    var lines = [''];

    if (result.success) {
      lines.push('=== EXTRACTION SUCCESSFUL ===');
      lines.push('');
      lines.push('You wake at the terminal.');
      lines.push('Memory reconstruction complete.');

      if (result.unlockedSlot && _state.persistentSlots < _state.maxPersistentSlots) {
        _state.persistentSlots++;
        lines.push('');
        lines.push('ARCHIVE EXPANSION AUTHORIZED');
        lines.push('Persistent capacity increased to ' + _state.persistentSlots + ' slots.');
      }

      if (result.extractedItem) {
        lines.push('');
        lines.push('Recovered: ' + result.extractedItem);
      }
    } else {
      lines.push('=== SIGNAL LOST ===');
      lines.push('');
      lines.push('You wake at the terminal.');
      lines.push('Memory fragmentation detected.');
      lines.push('Recovered: ' + _state.persistentSlots + ' archived tactics.');
      lines.push('');
      lines.push('Loose inventory lost.');

      // Clear loose inventory on death
      _state.inventoryLoose = [];
    }

    lines.push('');
    lines.push('Returning to Street Chronicles...');
    lines.push('');

    // Clear rogue run data
    _state.rogueRun = null;
    _saveState();

    return {
      lines: lines,
      mode: MODES.STREET
    };
  }

  /**
   * Add item to persistent inventory (if space available)
   */
  function addToPersistent(item) {
    if (_state.inventoryPersistent.length >= _state.persistentSlots) {
      return {
        success: false,
        message: 'PERSISTENT INVENTORY FULL (' + _state.inventoryPersistent.length + '/' + _state.persistentSlots + ')'
      };
    }

    _state.inventoryPersistent.push(item);
    _saveState();

    return {
      success: true,
      message: 'Item added to persistent inventory: ' + item.name
    };
  }

  /**
   * Add item to loose carry (if space available)
   */
  function addToLoose(item) {
    if (_state.inventoryLoose.length >= _state.looseSlots) {
      return {
        success: false,
        message: 'LOOSE CARRY FULL (' + _state.inventoryLoose.length + '/' + _state.looseSlots + ')'
      };
    }

    _state.inventoryLoose.push(item);
    _saveState();

    return {
      success: true,
      message: 'Item added to loose carry: ' + item.name
    };
  }

  /**
   * Remove item from persistent inventory
   */
  function removeFromPersistent(index) {
    if (index < 0 || index >= _state.inventoryPersistent.length) {
      return { success: false };
    }

    var removed = _state.inventoryPersistent.splice(index, 1)[0];
    _saveState();

    return {
      success: true,
      item: removed
    };
  }

  /**
   * Remove item from loose carry
   */
  function removeFromLoose(index) {
    if (index < 0 || index >= _state.inventoryLoose.length) {
      return { success: false };
    }

    var removed = _state.inventoryLoose.splice(index, 1)[0];
    _saveState();

    return {
      success: true,
      item: removed
    };
  }

  /**
   * Clear loose inventory (on death)
   */
  function clearLooseInventory() {
    _state.inventoryLoose = [];
    _saveState();
  }

  /**
   * Get persistent inventory
   */
  function getPersistentInventory() {
    return _state.inventoryPersistent.slice(); // Return copy
  }

  /**
   * Remove item from persistent inventory by index
   * @param {number} index - Index of item to remove
   */
  function removePersistentInventoryItem(index) {
    if (index >= 0 && index < _state.inventoryPersistent.length) {
      _state.inventoryPersistent.splice(index, 1);
      _saveState();
      console.log('[GAMESTATE] Removed persistent inventory item at index', index);
    } else {
      console.warn('[GAMESTATE] Invalid inventory index:', index);
    }
  }

  /**
   * Get loose inventory
   */
  function getLooseInventory() {
    return _state.inventoryLoose.slice(); // Return copy
  }

  /**
   * Add card to action button slots (Gone Rogue mode)
   * @param {Object} card - Card object to add
   */
  function addToActionButtons(card) {
    // Get capacity from CardZoneManager if available, otherwise use default
    var maxSlots = _state.actionButtonSlots;
    if (typeof CardZoneManager !== 'undefined' && typeof CardZoneManager.getActionButtonCapacity === 'function') {
      maxSlots = CardZoneManager.getActionButtonCapacity();
    }

    if (_state.actionButtonCards.length >= maxSlots) {
      return {
        success: false,
        message: 'ACTION BUTTON SLOTS FULL (' + _state.actionButtonCards.length + '/' + maxSlots + ')'
      };
    }

    _state.actionButtonCards.push(card);
    _saveState();

    // Update ReserveSlots UI if available
    if (typeof ReserveSlots !== 'undefined' && typeof ReserveSlots.setActionButtonCards === 'function') {
      ReserveSlots.setActionButtonCards(_state.actionButtonCards);
    }

    return {
      success: true,
      location: 'action_buttons',
      message: 'Card added to action buttons: ' + card.name
    };
  }

  /**
   * Add card to hand (play area) - NEW LOOT FLOW
   * Cards go to hand first, then overflow to action buttons
   * @param {Object} card - Card object to add
   */
  function addToHand(card) {
    var maxHand = _state.maxHandSize || 5;

    if (_state.cardHand.length >= maxHand) {
      // Hand is full, try action buttons
      return addToActionButtons(card);
    }

    _state.cardHand.push(card);
    _saveState();

    return {
      success: true,
      location: 'hand',
      message: 'Card added to hand: ' + card.name
    };
  }

  /**
   * Add card following proper loot flow priority
   * 1. Try hand first
   * 2. If hand full, go to action buttons
   * 3. If both full, return failure
   * @param {Object} card - Card object to add
   */
  function addCard(card) {
    // Try hand first
    var handResult = addToHand(card);
    if (handResult.success) {
      return handResult;
    }

    // Hand was full, addToHand already tried action buttons
    return handResult;
  }

  /**
   * Draw card from action buttons to hand (STR combat turn)
   * @param {number} count - Number of cards to draw (default: cardDrawPerTurn)
   */
  function drawCardsToHand(count) {
    count = count || _state.cardDrawPerTurn || 1;
    var drawn = [];
    var maxHand = _state.maxHandSize || 5;

    for (var i = 0; i < count; i++) {
      // Check if hand is full
      if (_state.cardHand.length >= maxHand) {
        break;
      }

      // Check if action buttons have cards
      if (_state.actionButtonCards.length === 0) {
        break;
      }

      // Draw first card from action buttons
      var card = _state.actionButtonCards.shift();
      _state.cardHand.push(card);
      drawn.push(card);
    }

    _saveState();

    return {
      success: drawn.length > 0,
      drawn: drawn,
      count: drawn.length,
      message: drawn.length + ' card(s) drawn to hand'
    };
  }

  /**
   * Get card hand
   */
  function getCardHand() {
    return _state.cardHand.slice(); // Return copy
  }

  /**
   * Get action button cards
   */
  function getActionButtonCards() {
    return _state.actionButtonCards.slice(); // Return copy
  }

  /**
   * Set card draw per turn rate (modified by items)
   */
  function setCardDrawRate(rate) {
    _state.cardDrawPerTurn = Math.max(1, rate);
    _saveState();
  }

  /**
   * Get current card draw rate
   */
  function getCardDrawRate() {
    return _state.cardDrawPerTurn || 1;
  }

  /**
   * Remove card from action button slots by index
   * @param {number} index - Index of card to remove
   */
  function removeFromActionButtons(index) {
    if (index < 0 || index >= _state.actionButtonCards.length) {
      return { success: false };
    }

    var removed = _state.actionButtonCards.splice(index, 1)[0];
    _saveState();

    // Update ReserveSlots UI if available
    if (typeof ReserveSlots !== 'undefined' && typeof ReserveSlots.setActionButtonCards === 'function') {
      ReserveSlots.setActionButtonCards(_state.actionButtonCards);
    }

    return {
      success: true,
      item: removed
    };
  }

  /**
   * Get action button cards
   */
  function getActionButtonCards() {
    return _state.actionButtonCards.slice(); // Return copy
  }

  /**
   * Set action button cards (replaces entire array)
   * @param {Array} cards - Array of card objects
   */
  function setActionButtonCards(cards) {
    _state.actionButtonCards = cards.slice(0, _state.actionButtonSlots);
    _saveState();

    // Update ReserveSlots UI if available
    if (typeof ReserveSlots !== 'undefined' && typeof ReserveSlots.setActionButtonCards === 'function') {
      ReserveSlots.setActionButtonCards(_state.actionButtonCards);
    }
  }

  /**
   * Clear action button cards
   */
  function clearActionButtonCards() {
    _state.actionButtonCards = [];
    _saveState();

    // Update ReserveSlots UI if available
    if (typeof ReserveSlots !== 'undefined' && typeof ReserveSlots.setActionButtonCards === 'function') {
      ReserveSlots.setActionButtonCards(_state.actionButtonCards);
    }
  }

  /**
   * Set active item slot (for equipment that needs to be "equipped")
   */
  function setActiveItem(item) {
    _state.activeItemSlot = item;
    _saveState();
  }

  /**
   * Get active item slot
   */
  function getActiveItem() {
    return _state.activeItemSlot;
  }

  /**
   * Clear active item slot
   */
  function clearActiveItem() {
    _state.activeItemSlot = null;
    _saveState();
  }

  function _saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.error('Failed to save gamestate:', e);
    }
  }

  function _loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed) {
        _state = Object.assign(_state, parsed);
      }
    } catch (e) {
      console.error('Failed to load gamestate:', e);
    }
  }

  /**
   * Convert street inventory item string to card object
   * @param {String} itemStr - Item string from Street Chronicles
   * @returns {Object|null} Card object or null if not a card
   */
  function _convertStreetItemToCard(itemStr) {
    if (!itemStr) return null;

    // Map street item names to CardSystem card types
    var cardMapping = {
      'SINGLE_SHOT card': 'SINGLE_SHOT',
      'PRONE card': 'PRONE',
      'KATCHUP card': 'KATCHUP',
      'DODGE card': 'DODGE',
      'BURST_SHOT card': 'BURST_SHOT'
    };

    // Check if item is a card
    for (var key in cardMapping) {
      if (itemStr.indexOf(key) !== -1) {
        if (typeof CardSystem !== 'undefined' && typeof CardSystem.rollCard === 'function') {
          return CardSystem.rollCard(cardMapping[key]);
        }
      }
    }

    // Not a card - return as-is (for non-card items like festival flyer)
    return { name: itemStr, type: 'misc' };
  }

  function reset() {
    _state = {
      mode: MODES.STREET,
      submode: null,
      inventoryPersistent: [],
      inventoryLoose: [],
      actionButtonCards: [],
      persistentSlots: 9,
      maxPersistentSlots: 12,
      looseSlots: 8,
      actionButtonSlots: 4,
      cryptos: 0,
      rogueRun: null,
      activeItemSlot: null,
      playerFatigue: 0,
      maxFatigue: 100,
      fatigueRecovery: 5,
      fatigueThreshold: 70,
      playerAmmo: 7,  // Match initial state
      maxAmmo: 50,
      playerEnergy: 5,
      maxEnergy: 5,
      playerFocus: 10,
      maxFocus: 10,
      playerBattery: 5,
      maxBattery: 5,
      playerStability: 10,
      maxStability: 10,
      consumables: [],
      consumableSlots: 3,
      maxConsumableSlots: 5
    };
    _saveState();
  }

  /**
   * Helper to check if StreetChronicles is available and active
   * @returns {boolean}
   */
  function _isStreetChroniclesActive() {
    return typeof StreetChronicles !== 'undefined' && 
           typeof StreetChronicles.isActive === 'function' && 
           StreetChronicles.isActive();
  }

  /**
   * Central transition helper for entering Gone Rogue mode.
   * Handles Street Chronicles deactivation, inventory transfer, and mode switching.
   * @param {Object} context - {reason, seed, difficulty, carryInventory}
   * @returns {Object} Action object for main.js with lines, prompt, and stayActive
   */
  function requestRogue(context) {
    context = context || {};
    console.debug('[GAMESTATE.requestRogue] Initiating Gone Rogue transition', context);

    // Step 1: If StreetChronicles is active and carryInventory requested, collect inventory
    if (_isStreetChroniclesActive()) {
      console.debug('[GAMESTATE.requestRogue] StreetChronicles is active');
      
      if (context.carryInventory && typeof StreetChronicles.getInventory === 'function') {
        var streetInv = StreetChronicles.getInventory();
        console.debug('[GAMESTATE.requestRogue] Carrying street inventory:', streetInv.length, 'items');
        context._streetInventory = streetInv;
        context.carryInventory = true;
      }

      // Step 2: Signal StreetChronicles to deactivate/yield control
      if (typeof StreetChronicles.deactivate === 'function') {
        console.debug('[GAMESTATE.requestRogue] Calling StreetChronicles.deactivate()');
        StreetChronicles.deactivate();
      } else {
        console.debug('[GAMESTATE.requestRogue] StreetChronicles.deactivate() not available');
      }
    }

    // Step 3: Update persisted state via enterRogueMode
    var intro = enterRogueMode(context);
    console.debug('[GAMESTATE.requestRogue] enterRogueMode completed');

    // Step 4: Start GoneRogue module and return its action object
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.start === 'function') {
      console.debug('[GAMESTATE.requestRogue] Starting GoneRogue module');
      return GoneRogue.start(context);
    }

    // Fallback if GoneRogue module is missing
    console.warn('[GAMESTATE.requestRogue] GoneRogue module not available, returning fallback');
    return {
      lines: intro.lines || ['GONE ROGUE MODE UNAVAILABLE'],
      prompt: 'ROGUE> ',
      stayActive: false
    };
  }

  /**
   * Add cryptos (currency) to player's wallet
   * @param {number} amount - Amount of cryptos to add
   */
  function addCryptos(amount) {
    _state.cryptos = (_state.cryptos || 0) + amount;
    _saveState();

    // Update UI display if available
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(_state.cryptos);
    }

    return {
      success: true,
      total: _state.cryptos,
      message: 'Collected ¢' + amount + ' (Total: ¢' + _state.cryptos + ')'
    };
  }

  /**
   * Remove cryptos (for purchases)
   * @param {number} amount - Amount of cryptos to spend
   */
  function spendCryptos(amount) {
    if ((_state.cryptos || 0) < amount) {
      return {
        success: false,
        message: 'Insufficient cryptos (Have: ¢' + (_state.cryptos || 0) + ', Need: ¢' + amount + ')'
      };
    }
    _state.cryptos -= amount;
    _saveState();

    // Update UI display if available
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(_state.cryptos);
    }

    return {
      success: true,
      remaining: _state.cryptos,
      message: 'Spent ¢' + amount + ' (Remaining: ¢' + _state.cryptos + ')'
    };
  }

  /**
   * Get current crypto balance
   */
  function getCryptos() {
    return _state.cryptos || 0;
  }

  // ========== FATIGUE MANAGEMENT ==========

  /**
   * Get current fatigue level
   */
  function getFatigue() {
    return _state.playerFatigue || 0;
  }

  /**
   * Add fatigue (from actions like combat, movement)
   * @param {number} amount - Amount of fatigue to add
   */
  function addFatigue(amount) {
    _state.playerFatigue = Math.min(_state.maxFatigue, (_state.playerFatigue || 0) + amount);
    _saveState();
    return _state.playerFatigue;
  }

  /**
   * Reduce fatigue (from rest, items, etc.)
   * @param {number} amount - Amount of fatigue to remove
   */
  function reduceFatigue(amount) {
    _state.playerFatigue = Math.max(0, (_state.playerFatigue || 0) - amount);
    _saveState();
    return _state.playerFatigue;
  }

  /**
   * Reset fatigue (after combat or rest)
   */
  function resetFatigue() {
    _state.playerFatigue = 0;
    _state._playerFatigueDecimal = 0.0;
    _saveState();
  }

  /**
   * Drain sprint fatigue (continuous, fractional)
   * Called each frame during sprint movement
   * @param {number} deltaTime - Time elapsed in seconds
   * @returns {boolean} True if fatigue increased (rolled over to next integer)
   */
  function drainSprintFatigue(deltaTime) {
    // Sprint fatigue drain rate: ~70% of a 50-tile map before 1 full fatigue point
    // Assuming 50 tiles traversed in ~6.25 seconds at sprint speed (8 * 1.5 = 12 tiles/sec)
    // We want to drain 1.0 fatigue over 6.25 * 0.7 = ~4.4 seconds
    // Rate = 1.0 / 4.4 = ~0.227 fatigue per second
    var SPRINT_FATIGUE_RATE = 0.227;

    // Apply modifiers from equipment (Moon Boots, etc.)
    var fatigueModifier = 1.0;
    if (typeof PassiveItemsSystem !== 'undefined') {
      var equipped = PassiveItemsSystem.getEquippedItems();
      for (var i = 0; i < equipped.length; i++) {
        if (equipped[i].sprintFatigueModifier) {
          fatigueModifier *= equipped[i].sprintFatigueModifier;
        }
      }
    }

    // Add fractional fatigue
    _state._playerFatigueDecimal += SPRINT_FATIGUE_RATE * fatigueModifier * deltaTime;

    // Check if we've accumulated a full integer point
    var rolled = false;
    if (_state._playerFatigueDecimal >= 1.0) {
      var integerPart = Math.floor(_state._playerFatigueDecimal);
      _state.playerFatigue = Math.min(_state.maxFatigue, _state.playerFatigue + integerPart);
      _state._playerFatigueDecimal -= integerPart;
      rolled = true;
      _saveState();
    }

    return rolled;
  }

  // ========== AMMO MANAGEMENT ==========

  /**
   * Get current ammo count
   */
  function getAmmo() {
    return _state.playerAmmo || 0;
  }

  /**
   * Use ammo (for shooting cards)
   * @param {number} amount - Amount of ammo to use
   */
  function useAmmo(amount) {
    if ((_state.playerAmmo || 0) < amount) {
      return {
        success: false,
        message: 'Insufficient ammo (Have: ' + (_state.playerAmmo || 0) + ', Need: ' + amount + ')'
      };
    }
    _state.playerAmmo -= amount;
    _saveState();
    return {
      success: true,
      remaining: _state.playerAmmo
    };
  }

  /**
   * Add ammo (from pickups, purchases)
   * @param {number} amount - Amount of ammo to add
   */
  function addAmmo(amount) {
    _state.playerAmmo = Math.min(_state.maxAmmo, (_state.playerAmmo || 0) + amount);
    _saveState();
    return _state.playerAmmo;
  }

  // ========== CONSUMABLES MANAGEMENT ==========

  /**
   * Get all consumables
   */
  function getConsumables() {
    return _state.consumables || [];
  }

  /**
   * Add a consumable item
   * @param {string} type - Type of consumable (e.g., 'ENERGY_DRINK')
   * @param {number} count - How many to add (default 1)
   */
  function addConsumable(type, count) {
    count = count || 1;
    var consumables = _state.consumables || [];

    // Check if we already have this consumable type
    var existing = consumables.find(function(c) { return c.type === type; });
    if (existing) {
      existing.count += count;
    } else {
      // Check if we have room for a new type
      if (consumables.length >= (_state.consumableSlots || 3)) {
        return {
          success: false,
          message: 'Consumable slots full (' + consumables.length + '/' + (_state.consumableSlots || 3) + ')'
        };
      }
      consumables.push({ type: type, count: count });
    }

    _state.consumables = consumables;
    _saveState();
    return {
      success: true,
      consumables: consumables
    };
  }

  /**
   * Use a consumable item
   * @param {string} type - Type of consumable to use
   */
  function useConsumable(type) {
    var consumables = _state.consumables || [];
    var consumable = consumables.find(function(c) { return c.type === type; });

    if (!consumable || consumable.count <= 0) {
      return {
        success: false,
        message: 'No ' + type + ' available'
      };
    }

    consumable.count--;
    if (consumable.count === 0) {
      // Remove from array if count reaches 0
      _state.consumables = consumables.filter(function(c) { return c.type !== type; });
    }

    _saveState();
    return {
      success: true,
      remaining: consumable.count
    };
  }

  /**
   * Get count of a specific consumable
   * @param {string} type - Type of consumable
   */
  function getConsumableCount(type) {
    var consumables = _state.consumables || [];
    var consumable = consumables.find(function(c) { return c.type === type; });
    return consumable ? consumable.count : 0;
  }

  // ========== ENERGY MANAGEMENT ==========

  /**
   * Get current energy level
   */
  function getEnergy() {
    return _state.playerEnergy !== undefined ? _state.playerEnergy : _state.maxEnergy;
  }

  /**
   * Use energy (for special abilities)
   * @param {number} amount - Amount of energy to use
   */
  function useEnergy(amount) {
    var current = getEnergy();
    if (current < amount) {
      return {
        success: false,
        message: 'Insufficient energy (Have: ' + current + ', Need: ' + amount + ')'
      };
    }
    _state.playerEnergy = current - amount;
    _saveState();
    return {
      success: true,
      remaining: _state.playerEnergy
    };
  }

  /**
   * Restore energy
   * @param {number} amount - Amount of energy to restore
   */
  function restoreEnergy(amount) {
    var current = getEnergy();
    _state.playerEnergy = Math.min(_state.maxEnergy, current + amount);
    _saveState();
    return _state.playerEnergy;
  }
  
  /**
   * Add energy (alias for restoreEnergy for consistency)
   * @param {number} amount - Amount of energy to add
   */
  function addEnergy(amount) {
    return restoreEnergy(amount);
  }

  // ========== FOCUS MANAGEMENT ==========

  /**
   * Get current focus level
   */
  function getFocus() {
    return _state.playerFocus !== undefined ? _state.playerFocus : _state.maxFocus;
  }

  /**
   * Lose focus (from distractions, panic)
   * @param {number} amount - Amount of focus to lose
   */
  function loseFocus(amount) {
    var current = getFocus();
    _state.playerFocus = Math.max(0, current - amount);
    _saveState();
    return _state.playerFocus;
  }

  /**
   * Restore focus
   * @param {number} amount - Amount of focus to restore
   */
  function restoreFocus(amount) {
    var current = getFocus();
    _state.playerFocus = Math.min(_state.maxFocus, current + amount);
    _saveState();
    return _state.playerFocus;
  }
  
  /**
   * Add focus (alias for restoreFocus for consistency)
   * @param {number} amount - Amount of focus to add
   */
  function addFocus(amount) {
    return restoreFocus(amount);
  }

  // ========== BATTERY MANAGEMENT ==========

  /**
   * Get current battery level
   */
  function getBattery() {
    return _state.playerBattery !== undefined ? _state.playerBattery : _state.maxBattery;
  }

  /**
   * Use battery (for equipment)
   * @param {number} amount - Amount of battery to use
   */
  function useBattery(amount) {
    var current = getBattery();
    if (current < amount) {
      return {
        success: false,
        message: 'Insufficient battery (Have: ' + current + ', Need: ' + amount + ')'
      };
    }
    _state.playerBattery = current - amount;
    _saveState();
    return {
      success: true,
      remaining: _state.playerBattery
    };
  }

  /**
   * Recharge battery
   * @param {number} amount - Amount of battery to recharge
   */
  function rechargeBattery(amount) {
    var current = getBattery();
    _state.playerBattery = Math.min(_state.maxBattery, current + amount);
    _saveState();
    return _state.playerBattery;
  }

  // ========== STABILITY MANAGEMENT ==========

  /**
   * Get current stability level
   */
  function getStability() {
    return _state.playerStability !== undefined ? _state.playerStability : _state.maxStability;
  }

  /**
   * Lose stability (from fear, panic)
   * @param {number} amount - Amount of stability to lose
   */
  function loseStability(amount) {
    var current = getStability();
    _state.playerStability = Math.max(0, current - amount);
    _saveState();
    return _state.playerStability;
  }

  /**
   * Restore stability
   * @param {number} amount - Amount of stability to restore
   */
  function restoreStability(amount) {
    var current = getStability();
    _state.playerStability = Math.min(_state.maxStability, current + amount);
    _saveState();
    return _state.playerStability;
  }

  // ========== USER DATA MANAGEMENT ==========

  /**
   * Load user data from server (called after login)
   * @param {Object} userData - User data from server
   */
  function loadUserData(userData) {
    if (!userData) return;

    // Update crypto balance from server
    if (userData.cryptos !== undefined) {
      _state.cryptos = userData.cryptos;
      if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
        UIControls.updateCurrency(_state.cryptos);
      }
    }

    _saveState();
  }

  // ========== COOLDOWN TRACKING ==========

  /**
   * Increment combat counter (call after each combat completion)
   */
  function incrementCombatCounter() {
    if (_state.rogueRun) {
      _state.rogueRun.combatsCompleted = (_state.rogueRun.combatsCompleted || 0) + 1;
      _saveState();
      return _state.rogueRun.combatsCompleted;
    }
    return 0;
  }

  /**
   * Increment floor counter (call after ascending to next floor)
   */
  function incrementFloorCounter() {
    if (_state.rogueRun) {
      _state.rogueRun.floor = (_state.rogueRun.floor || 1) + 1;
      _saveState();
      return _state.rogueRun.floor;
    }
    return 1;
  }

  /**
   * Get current combat count
   */
  function getCombatCount() {
    return _state.rogueRun ? (_state.rogueRun.combatsCompleted || 0) : 0;
  }

  /**
   * Get current floor count
   */
  function getFloorCount() {
    return _state.rogueRun ? (_state.rogueRun.floor || 1) : 1;
  }

  /**
   * Get current action button capacity (base + equipment bonuses)
   */
  function getActionButtonCapacity() {
    if (typeof CardZoneManager !== 'undefined' && typeof CardZoneManager.getActionButtonCapacity === 'function') {
      return CardZoneManager.getActionButtonCapacity();
    }
    return _state.actionButtonSlots || 4;
  }

  return {
    MODES: MODES,
    init: init,
    getMode: getMode,
    getState: getState,
    enterRogueMode: enterRogueMode,
    exitRogueMode: exitRogueMode,
    addToPersistent: addToPersistent,
    addToLoose: addToLoose,
    removeFromPersistent: removeFromPersistent,
    removeFromLoose: removeFromLoose,
    clearLooseInventory: clearLooseInventory,
    getPersistentInventory: getPersistentInventory,
    removePersistentInventoryItem: removePersistentInventoryItem,
    getLooseInventory: getLooseInventory,
    // Card system - NEW LOOT FLOW
    addCard: addCard,              // Main entry point for card loot
    addToHand: addToHand,          // Add to play hand
    getCardHand: getCardHand,
    drawCardsToHand: drawCardsToHand,  // Draw from action buttons to hand
    setCardDrawRate: setCardDrawRate,
    getCardDrawRate: getCardDrawRate,
    // Action button cards management (Gone Rogue mode)
    addToActionButtons: addToActionButtons,
    removeFromActionButtons: removeFromActionButtons,
    getActionButtonCards: getActionButtonCards,
    setActionButtonCards: setActionButtonCards,
    clearActionButtonCards: clearActionButtonCards,
    getActionButtonCapacity: getActionButtonCapacity,
    setActiveItem: setActiveItem,
    getActiveItem: getActiveItem,
    clearActiveItem: clearActiveItem,
    addCryptos: addCryptos,
    spendCryptos: spendCryptos,
    getCryptos: getCryptos,
    reset: reset,
    requestRogue: requestRogue,
    // Fatigue management
    getFatigue: getFatigue,
    addFatigue: addFatigue,
    reduceFatigue: reduceFatigue,
    resetFatigue: resetFatigue,
    drainSprintFatigue: drainSprintFatigue,
    // Ammo management
    getAmmo: getAmmo,
    useAmmo: useAmmo,
    addAmmo: addAmmo,
    // Consumables management
    getConsumables: getConsumables,
    addConsumable: addConsumable,
    useConsumable: useConsumable,
    getConsumableCount: getConsumableCount,
    // Energy management
    getEnergy: getEnergy,
    useEnergy: useEnergy,
    restoreEnergy: restoreEnergy,
    addEnergy: addEnergy,
    // Focus management
    getFocus: getFocus,
    loseFocus: loseFocus,
    restoreFocus: restoreFocus,
    addFocus: addFocus,
    // Battery management
    getBattery: getBattery,
    useBattery: useBattery,
    rechargeBattery: rechargeBattery,
    // Stability management
    getStability: getStability,
    loseStability: loseStability,
    restoreStability: restoreStability,
    // User data management
    loadUserData: loadUserData,
    // Cooldown tracking
    incrementCombatCounter: incrementCombatCounter,
    incrementFloorCounter: incrementFloorCounter,
    getCombatCount: getCombatCount,
    getFloorCount: getFloorCount
  };
})();
