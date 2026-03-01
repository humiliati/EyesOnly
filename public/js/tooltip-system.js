/* ============================================================
   EYES ONLY - Tooltip System
   Universal activity reporting using MOK interjection field
   ============================================================ */

const TooltipSystem = (function() {
  'use strict';

  var _currentTimer = null;
  var _mokInterjectionElement = null;
  var _mokHistoryContainer = null;
  var _isExpanded = false;
  var _messageHistory = [];
  var MAX_HISTORY_LINES = 30;
  var DEFAULT_MESSAGE = 'Standing by for advisories.';

  /**
   * Initialize tooltip system
   */
  function init() {
    _mokInterjectionElement = document.getElementById('mok-interject-body');
    if (!_mokInterjectionElement) {
      console.warn('TooltipSystem: MOK interjection element not found');
    }

    // Create history container if it doesn't exist
    _createHistoryContainer();
  }

  /**
   * Create scrollable history container for MOK interjection
   */
  function _createHistoryContainer() {
    // Check if history container already exists
    var existingContainer = document.getElementById('mok-history-container');
    if (existingContainer) {
      _mokHistoryContainer = existingContainer;
      return;
    }

    // Find the MOK interjection parent element (#mok-interjections)
    var mokParent = _mokInterjectionElement ? _mokInterjectionElement.parentElement : null;
    if (!mokParent) {
      return;
    }

    // Create expand/collapse button that will be positioned on the same line
    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'mok-history-toggle';
    toggleBtn.className = 'mok-history-toggle';
    toggleBtn.textContent = '▼ History';
    toggleBtn.addEventListener('click', toggleHistory);

    // Insert button right after the interjection body (will be styled to float right)
    mokParent.insertBefore(toggleBtn, _mokInterjectionElement.nextSibling);

    // Create history container
    _mokHistoryContainer = document.createElement('div');
    _mokHistoryContainer.id = 'mok-history-container';
    _mokHistoryContainer.className = 'mok-history-container mok-history-collapsed';
    _mokHistoryContainer.style.display = 'none';

    // Add history content area
    var historyContent = document.createElement('div');
    historyContent.id = 'mok-history-content';
    historyContent.className = 'mok-history-content';
    _mokHistoryContainer.appendChild(historyContent);

    // Insert history container after the toggle button
    mokParent.insertBefore(_mokHistoryContainer, toggleBtn.nextSibling);
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

    // Add to history
    _addToHistory(message);

    // Set auto-clear timer
    var duration = durationMs || 2500;
    _currentTimer = setTimeout(function() {
      _mokInterjectionElement.textContent = DEFAULT_MESSAGE;
      _currentTimer = null;
    }, duration);
  }

  /**
   * Add message to history
   * @param {string} message - Message to add
   */
  function _addToHistory(message) {
    // Don't add default message or empty messages
    if (!message || message === DEFAULT_MESSAGE) {
      return;
    }

    // Add timestamp
    var timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    var entry = {
      time: timestamp,
      message: message
    };

    // Add to history array
    _messageHistory.unshift(entry);

    // Keep only MAX_HISTORY_LINES
    if (_messageHistory.length > MAX_HISTORY_LINES) {
      _messageHistory = _messageHistory.slice(0, MAX_HISTORY_LINES);
    }

    // Update history display if expanded
    if (_isExpanded) {
      _renderHistory();
    }
  }

  /**
   * Render message history
   */
  function _renderHistory() {
    if (!_mokHistoryContainer) return;

    var content = document.getElementById('mok-history-content');
    if (!content) return;

    var html = '';
    for (var i = 0; i < _messageHistory.length; i++) {
      var entry = _messageHistory[i];
      html += '<div class="mok-history-entry">';
      html += '<span class="mok-history-time">[' + entry.time + ']</span> ';
      html += '<span class="mok-history-message">' + entry.message + '</span>';
      html += '</div>';
    }

    if (html === '') {
      html = '<div class="mok-history-empty">No messages yet</div>';
    }

    content.innerHTML = html;

    // Auto-scroll to bottom (newest messages)
    content.scrollTop = 0;
  }

  /**
   * Toggle history visibility
   */
  function toggleHistory() {
    _isExpanded = !_isExpanded;

    var toggleBtn = document.getElementById('mok-history-toggle');

    if (_isExpanded) {
      _mokHistoryContainer.style.display = 'block';
      _mokHistoryContainer.classList.remove('mok-history-collapsed');
      _mokHistoryContainer.classList.add('mok-history-expanded');
      if (toggleBtn) toggleBtn.textContent = '▲ Hide History';
      _renderHistory();
    } else {
      _mokHistoryContainer.style.display = 'none';
      _mokHistoryContainer.classList.remove('mok-history-expanded');
      _mokHistoryContainer.classList.add('mok-history-collapsed');
      if (toggleBtn) toggleBtn.textContent = '▼ History';
    }
  }

  /**
   * Collapse history (force to minimized state)
   */
  function collapseHistory() {
    if (!_isExpanded) return; // Already collapsed

    _isExpanded = false;
    var toggleBtn = document.getElementById('mok-history-toggle');

    _mokHistoryContainer.style.display = 'none';
    _mokHistoryContainer.classList.remove('mok-history-expanded');
    _mokHistoryContainer.classList.add('mok-history-collapsed');
    if (toggleBtn) toggleBtn.textContent = '▼ History';
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

    // Add to history
    _addToHistory(message);
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
      case 'key-ammo-pickup':
        var keyAmmoName = (data && data.name) || 'KEY';
        message = '🔑 KEY AMMO: ' + keyAmmoName;
        break;
      case 'key-item-pickup':
        var keyItemName = (data && data.name) || 'KEY';
        message = '🔑 KEY ITEM: ' + keyItemName + ' → INVENTORY';
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
    init: init,
    toggleHistory: toggleHistory,
    collapseHistory: collapseHistory
  };
})();
