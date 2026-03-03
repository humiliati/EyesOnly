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
  var MAX_HISTORY_LINES = 256;
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
   * Create scrollable history container for MOK interjection.
   * Layout: toggle button lives in the footer row (always visible).
   * History panel pops UP from the footer using absolute positioning
   * so it overlays the game screen, not pushes content down.
   */
  function _createHistoryContainer() {
    var existingContainer = document.getElementById('mok-history-container');
    if (existingContainer) {
      _mokHistoryContainer = existingContainer;
      return;
    }

    // The MOK interjection parent (#mok-interjections)
    var mokParent = _mokInterjectionElement ? _mokInterjectionElement.parentElement : null;
    if (!mokParent) return;

    // Make parent the positioning anchor for the upward-expanding history
    mokParent.style.position = 'relative';

    // Create toggle button — stays in the footer row alongside interject-body
    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'mok-history-toggle';
    toggleBtn.className = 'mok-history-toggle';
    toggleBtn.textContent = '▼ History';
    toggleBtn.addEventListener('click', toggleHistory);

    // Insert button right after the interjection body (floats right in footer)
    mokParent.insertBefore(toggleBtn, _mokInterjectionElement.nextSibling);

    // Create history container — absolutely positioned ABOVE the footer
    _mokHistoryContainer = document.createElement('div');
    _mokHistoryContainer.id = 'mok-history-container';
    _mokHistoryContainer.className = 'mok-history-container mok-history-collapsed';

    // History content (scrollable area)
    var historyContent = document.createElement('div');
    historyContent.id = 'mok-history-content';
    historyContent.className = 'mok-history-content';
    _mokHistoryContainer.appendChild(historyContent);

    // Append container to parent — CSS positions it above via bottom:100%
    mokParent.appendChild(_mokHistoryContainer);
  }

  /**
   * Get current context (what mode the user is in)
   */
  function _getCurrentContext() {
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function') {
      if (GoneRogue.isActive()) {
        if (typeof GoneRogue.isInStrCombat === 'function' && GoneRogue.isInStrCombat()) {
          return 'str-combat';
        }
        return 'gone-rogue';
      }
    }
    if (typeof StreetChronicles !== 'undefined' && typeof StreetChronicles.isActive === 'function') {
      if (StreetChronicles.isActive()) {
        return 'street-chronicles';
      }
    }
    return 'terminal';
  }

  /**
   * Show a tooltip message with auto-clear
   */
  function show(message, durationMs) {
    if (!_mokInterjectionElement) {
      init();
      if (!_mokInterjectionElement) return;
    }

    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    _mokInterjectionElement.textContent = message;
    _addToHistory(message);

    var duration = durationMs || 2500;
    _currentTimer = setTimeout(function() {
      _mokInterjectionElement.textContent = DEFAULT_MESSAGE;
      _currentTimer = null;
    }, duration);
  }

  /**
   * Add message to history
   */
  function _addToHistory(message) {
    if (!message || message === DEFAULT_MESSAGE) return;

    var timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    _messageHistory.unshift({ time: timestamp, message: message });

    if (_messageHistory.length > MAX_HISTORY_LINES) {
      _messageHistory = _messageHistory.slice(0, MAX_HISTORY_LINES);
    }

    if (_isExpanded) {
      _renderHistory();
    }
  }

  /**
   * Render history with progressive transparency and compaction.
   *
   * Rows 0-9   (newest):  full opacity, normal spacing
   * Rows 10-19 (middle):  fading opacity, slightly compacted
   * Rows 20+   (oldest):  very transparent, heavily compacted "rolodex" look
   */
  function _renderHistory() {
    if (!_mokHistoryContainer) return;

    var content = document.getElementById('mok-history-content');
    if (!content) return;

    var html = '';
    for (var i = 0; i < _messageHistory.length; i++) {
      var entry = _messageHistory[i];

      // Progressive opacity: newest = 1.0, fading toward 0.15 for oldest
      var opacity;
      if (i < 10) {
        opacity = 1.0 - (i * 0.03);        // 1.0 → 0.73
      } else if (i < 20) {
        opacity = 0.7 - ((i - 10) * 0.04);  // 0.7 → 0.34
      } else {
        opacity = Math.max(0.15, 0.3 - ((i - 20) * 0.005)); // 0.3 → 0.15
      }

      // Progressive compaction: tight rows that get tighter
      var marginTop;
      var scale;
      if (i < 10) {
        marginTop = 0;      // tight, no extra space
        scale = 1.0;
      } else if (i < 20) {
        marginTop = -1;      // start overlapping slightly
        scale = 0.97;
      } else {
        marginTop = -2;      // rolodex overlap
        scale = 0.94;
      }

      var style = 'opacity:' + opacity.toFixed(2) + ';';
      if (marginTop !== 0) {
        style += 'margin-top:' + marginTop + 'px;';
      }
      if (scale !== 1.0) {
        style += 'transform:scaleY(' + scale + ');transform-origin:bottom;';
      }

      html += '<div class="mok-history-entry" style="' + style + '">';
      html += '<span class="mok-history-time">[' + entry.time + ']</span> ';
      html += '<span class="mok-history-message">' + entry.message + '</span>';
      html += '</div>';
    }

    if (html === '') {
      html = '<div class="mok-history-empty">No messages yet</div>';
    }

    content.innerHTML = html;

    // Scroll to top (newest first)
    content.scrollTop = 0;
  }

  /**
   * Toggle history visibility
   */
  function toggleHistory() {
    _isExpanded = !_isExpanded;

    var toggleBtn = document.getElementById('mok-history-toggle');

    // The parent (#mok-interjections) may have overflow:hidden and low z-index
    // from CRT mobile rules. Override when expanding so the upward panel is visible.
    var mokParent = _mokHistoryContainer ? _mokHistoryContainer.parentElement : null;

    if (_isExpanded) {
      _mokHistoryContainer.classList.remove('mok-history-collapsed');
      _mokHistoryContainer.classList.add('mok-history-expanded');
      if (toggleBtn) toggleBtn.textContent = '▲ Hide';
      // Override parent constraints so absolute-positioned panel escapes
      if (mokParent) {
        mokParent.style.overflow = 'visible';
        mokParent.style.zIndex = '9000';
      }
      _renderHistory();
    } else {
      _mokHistoryContainer.classList.remove('mok-history-expanded');
      _mokHistoryContainer.classList.add('mok-history-collapsed');
      if (toggleBtn) toggleBtn.textContent = '▼ History';
      // Restore parent overflow so footer stays compact when collapsed
      if (mokParent) {
        mokParent.style.overflow = '';
        mokParent.style.zIndex = '';
      }
    }
  }

  /**
   * Collapse history (force to minimized state)
   */
  function collapseHistory() {
    if (!_isExpanded) return;

    _isExpanded = false;
    var toggleBtn = document.getElementById('mok-history-toggle');

    _mokHistoryContainer.classList.remove('mok-history-expanded');
    _mokHistoryContainer.classList.add('mok-history-collapsed');
    if (toggleBtn) toggleBtn.textContent = '▼ History';

    // Restore parent overflow/z-index
    var mokParent = _mokHistoryContainer ? _mokHistoryContainer.parentElement : null;
    if (mokParent) {
      mokParent.style.overflow = '';
      mokParent.style.zIndex = '';
    }
  }

  /**
   * Show a persistent tooltip message (stays until replaced)
   */
  function showPersistent(message) {
    if (!_mokInterjectionElement) {
      init();
      if (!_mokInterjectionElement) return;
    }

    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    _mokInterjectionElement.textContent = message;
    _addToHistory(message);
  }

  /**
   * Clear the current tooltip and reset to default
   */
  function clear() {
    if (!_mokInterjectionElement) return;

    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    _mokInterjectionElement.textContent = DEFAULT_MESSAGE;
  }

  /**
   * Show context-appropriate tooltip
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
