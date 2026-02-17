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
    inventoryLoose: [],            // 8 slots (lost on death)
    persistentSlots: 9,            // Start at 9, expand to 12
    maxPersistentSlots: 12,
    looseSlots: 8,
    cryptos: 0,                    // Currency (¢) - persistent across death
    rogueRun: null
  };

  function init() {
    _loadState();
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
      enemiesKilled: 0,
      cardsFound: 0
    };

    // Transfer street inventory to loose carry if specified
    if (context.carryInventory && typeof StreetChronicles !== 'undefined') {
      var streetInv = StreetChronicles.getInventory() || [];
      // Take up to looseSlots items from street inventory
      _state.inventoryLoose = streetInv.slice(0, _state.looseSlots);
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
   * Get loose inventory
   */
  function getLooseInventory() {
    return _state.inventoryLoose.slice(); // Return copy
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

  function reset() {
    _state = {
      mode: MODES.STREET,
      submode: null,
      inventoryPersistent: [],
      inventoryLoose: [],
      persistentSlots: 9,
      maxPersistentSlots: 12,
      looseSlots: 8,
      cryptos: 0,
      rogueRun: null
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
    getLooseInventory: getLooseInventory,
    addCryptos: addCryptos,
    spendCryptos: spendCryptos,
    getCryptos: getCryptos,
    reset: reset,
    requestRogue: requestRogue
  };
})();
