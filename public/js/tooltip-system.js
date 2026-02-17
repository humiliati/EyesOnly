/* ============================================================
   EYES ONLY - Tooltip System
   Universal activity reporting using MOK interjection field
   ============================================================ */

const TooltipSystem = (function() {
  'use strict';

  var _currentTimer = null;
  var _mokInterjectionElement = null;
  var DEFAULT_MESSAGE = 'Standing by for advisories.';

  /**
   * Initialize tooltip system
   */
  function init() {
    _mokInterjectionElement = document.getElementById('mok-interject-body');
    if (!_mokInterjectionElement) {
      console.warn('TooltipSystem: MOK interjection element not found');
    }
  }

  /**
   * Get current context (what mode the user is in)
   * @returns {string} Context name
   */
  function _getCurrentContext() {
    // Check if Gone Rogue is active
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function') {
      if (GoneRogue.isActive()) {
        // Check if in STR combat
        if (typeof GoneRogue.isInStrCombat === 'function' && GoneRogue.isInStrCombat()) {
          return 'str-combat';
        }
        return 'gone-rogue';
      }
    }

    // Check if Street Chronicles is active
    if (typeof StreetChronicles !== 'undefined' && typeof StreetChronicles.isActive === 'function') {
      if (StreetChronicles.isActive()) {
        return 'street-chronicles';
      }
    }

    // Default context is terminal/event-log
    return 'terminal';
  }

  /**
   * Show a tooltip message with auto-clear
   * @param {string} message - Message to display
   * @param {number} durationMs - Duration in milliseconds (default: 2500)
   */
  function show(message, durationMs) {
    if (!_mokInterjectionElement) {
      init(); // Try to initialize again
      if (!_mokInterjectionElement) return;
    }

    // Clear any existing timer
    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    // Set the message
    _mokInterjectionElement.textContent = message;

    // Set auto-clear timer
    var duration = durationMs || 2500;
    _currentTimer = setTimeout(function() {
      _mokInterjectionElement.textContent = DEFAULT_MESSAGE;
      _currentTimer = null;
    }, duration);
  }

  /**
   * Show a persistent tooltip message (stays until replaced)
   * @param {string} message - Message to display
   */
  function showPersistent(message) {
    if (!_mokInterjectionElement) {
      init();
      if (!_mokInterjectionElement) return;
    }

    // Clear any existing timer
    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    // Set the message without auto-clear
    _mokInterjectionElement.textContent = message;
  }

  /**
   * Clear the current tooltip and reset to default
   */
  function clear() {
    if (!_mokInterjectionElement) return;

    // Clear timer if active
    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    // Reset to default message
    _mokInterjectionElement.textContent = DEFAULT_MESSAGE;
  }

  /**
   * Show context-appropriate tooltip
   * @param {string} action - Action being performed
   * @param {Object} data - Optional data about the action
   */
  function showAction(action, data) {
    var context = _getCurrentContext();
    var message = '';

    switch (action) {
      case 'move':
        message = (data && data.run) ? '🏃 RUNNING' : '🥾 WALKING';
        break;
      case 'combat-enter':
        message = '⚔️ ENGAGING ENEMY';
        break;
      case 'attack':
        message = '🔫 ATTACKING';
        break;
      case 'currency-pickup':
        var amount = (data && data.amount) || 'X';
        message = '💰 COLLECTED ' + amount + ' CRYPTOS';
        break;
      case 'item-pickup':
        var itemName = (data && data.name) || 'ITEM';
        message = '📦 PICKED UP ' + itemName;
        break;
      case 'card-pickup':
        var cardName = (data && data.name) || 'CARD';
        message = '🃏 PICKED UP ' + cardName;
        break;
      case 'item-use':
        var useName = (data && data.name) || 'ITEM';
        message = '⚡ USED ' + useName;
        break;
      case 'item-use-invalid':
        message = '❌ INVALID ITEM USE';
        break;
      case 'item-equip':
        var equipName = (data && data.name) || 'ITEM';
        message = '⚡ EQUIPPED ' + equipName;
        break;
      case 'item-unequip':
        var unequipName = (data && data.name) || 'ITEM';
        message = '⚠ UNEQUIPPED ' + unequipName;
        break;
      case 'card-deploy':
        var deployName = (data && data.name) || 'CARD';
        message = '🃏 DEPLOYED ' + deployName;
        break;
      case 'flee':
        message = '🏃 FLEEING COMBAT';
        break;
      case 'interact':
        message = '🤝 INTERACTING';
        break;
      case 'link-open':
        var linkDesc = (data && data.description) || 'LINK';
        message = '🔗 OPENING ' + linkDesc;
        break;
      default:
        message = action;
    }

    show(message);
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    show: show,
    showPersistent: showPersistent,
    showAction: showAction,
    clear: clear,
    init: init
  };
})();
