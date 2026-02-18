/* ============================================================
   EYES ONLY - Interactive Items System
   World items that trigger animations, tooltips, and dialogue
   ============================================================ */

const InteractiveItems = (function() {
  'use strict';

  var _interactiveItems = []; // Active interactive items in the world
  var _interactionRange = 2; // Default range in tiles

  /**
   * Interactive item types and their properties
   */
  var ITEM_TYPES = {
    BOOK: {
      emoji: '📚',
      name: 'Book',
      interactionEmoji: 'READING',
      tooltipPrefix: '📖 ',
      canInteract: true,
      breakable: false
    },
    TERMINAL: {
      emoji: '💻',
      name: 'Terminal',
      interactionEmoji: 'INSPECTING',
      tooltipPrefix: '💻 ',
      canInteract: true,
      breakable: false,
      lightSource: 'MONITOR' // Can be lit
    },
    SIGN: {
      emoji: '🪧',
      name: 'Sign',
      interactionEmoji: 'READING',
      tooltipPrefix: '🪧 ',
      canInteract: true,
      breakable: false
    },
    POSTER: {
      emoji: '📜',
      name: 'Poster',
      interactionEmoji: 'READING',
      tooltipPrefix: '📜 ',
      canInteract: true,
      breakable: false
    },
    GRAFFITI: {
      emoji: '🎨',
      name: 'Graffiti',
      interactionEmoji: 'INSPECTING',
      tooltipPrefix: '🎨 ',
      canInteract: true,
      breakable: false
    },
    CORPSE: {
      emoji: '💀',
      name: 'Corpse',
      interactionEmoji: 'INSPECTING',
      tooltipPrefix: '💀 ',
      canInteract: true,
      breakable: false
    },
    LOCKER: {
      emoji: '🗄️',
      name: 'Locker',
      interactionEmoji: 'INSPECTING',
      tooltipPrefix: '🗄️ ',
      canInteract: true,
      breakable: true
    },
    SAFE: {
      emoji: '🔒',
      name: 'Safe',
      interactionEmoji: 'INSPECTING',
      tooltipPrefix: '🔒 ',
      canInteract: true,
      breakable: false
    },
    RADIO: {
      emoji: '📻',
      name: 'Radio',
      interactionEmoji: 'LISTENING',
      tooltipPrefix: '📻 ',
      canInteract: true,
      breakable: true
    },
    PAINTING: {
      emoji: '🖼️',
      name: 'Painting',
      interactionEmoji: 'INSPECTING',
      tooltipPrefix: '🖼️ ',
      canInteract: true,
      breakable: true
    },
    AREA_OF_INTEREST: {
      emoji: '❓',
      name: 'Point of Interest',
      interactionEmoji: 'INSPECTING',
      tooltipPrefix: '❓ ',
      canInteract: true,
      breakable: false
    }
  };

  /**
   * Initialize interactive items system
   */
  function init() {
    _interactiveItems = [];
    console.log('[InteractiveItems] Initialized');
  }

  /**
   * Create an interactive item from template
   * @param {string} typeKey - Key from ITEM_TYPES
   * @param {number} x - Grid X position
   * @param {number} y - Grid Y position
   * @param {object} config - Custom configuration
   * @returns {object} Interactive item object
   */
  function createItem(typeKey, x, y, config) {
    var itemType = ITEM_TYPES[typeKey];
    if (!itemType) {
      console.warn('[InteractiveItems] Unknown item type:', typeKey);
      return null;
    }

    config = config || {};

    var item = {
      id: 'interactive_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      type: typeKey,
      x: x,
      y: y,
      emoji: config.emoji || itemType.emoji,
      name: config.name || itemType.name,
      text: config.text || '',
      interactionEmoji: config.interactionEmoji || itemType.interactionEmoji,
      tooltipPrefix: config.tooltipPrefix || itemType.tooltipPrefix,
      interactionRange: config.interactionRange || _interactionRange,
      canInteract: config.canInteract !== undefined ? config.canInteract : itemType.canInteract,
      breakable: config.breakable !== undefined ? config.breakable : itemType.breakable,
      interacted: false,
      onInteract: config.onInteract || null, // Custom callback function
      customData: config.customData || {} // Designer-defined data
    };

    return item;
  }

  /**
   * Add interactive item to world
   * @param {object} item - Interactive item object
   */
  function addItem(item) {
    if (!item) return;
    _interactiveItems.push(item);
    console.log('[InteractiveItems] Added:', item.type, 'at', item.x, item.y);
  }

  /**
   * Remove interactive item by ID
   * @param {string} itemId - Item ID
   */
  function removeItem(itemId) {
    var index = _interactiveItems.findIndex(function(item) {
      return item.id === itemId;
    });
    if (index >= 0) {
      _interactiveItems.splice(index, 1);
      console.log('[InteractiveItems] Removed item:', itemId);
    }
  }

  /**
   * Get interactive item at position
   * @param {number} x - Grid X position
   * @param {number} y - Grid Y position
   * @returns {object} Item or null
   */
  function getItemAt(x, y) {
    return _interactiveItems.find(function(item) {
      return item.x === x && item.y === y;
    }) || null;
  }

  /**
   * Get all items within range of position
   * @param {number} x - Grid X position
   * @param {number} y - Grid Y position
   * @param {number} range - Range in tiles
   * @returns {array} Array of items
   */
  function getItemsInRange(x, y, range) {
    return _interactiveItems.filter(function(item) {
      var dx = Math.abs(item.x - x);
      var dy = Math.abs(item.y - y);
      var distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= range;
    });
  }

  /**
   * Check if player can interact with item
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   * @param {object} item - Interactive item
   * @returns {boolean} True if in range
   */
  function canInteractWith(playerX, playerY, item) {
    if (!item || !item.canInteract) return false;

    var dx = Math.abs(item.x - playerX);
    var dy = Math.abs(item.y - playerY);
    var distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= item.interactionRange;
  }

  /**
   * Interact with item
   * @param {object} item - Interactive item
   * @param {object} player - Player object
   * @returns {object} Interaction result with animation/tooltip data
   */
  function interact(item, player) {
    if (!item || !item.canInteract) {
      return { success: false, reason: 'Cannot interact' };
    }

    // Mark as interacted
    item.interacted = true;

    // Build interaction result
    var result = {
      success: true,
      item: item,
      animation: {
        expressionKey: item.interactionEmoji,
        duration: 2000
      },
      tooltip: {
        message: item.tooltipPrefix + item.text,
        duration: 3000
      }
    };

    // Call custom callback if provided
    if (item.onInteract && typeof item.onInteract === 'function') {
      try {
        var customResult = item.onInteract(item, player);
        if (customResult) {
          // Merge custom result
          result = Object.assign({}, result, customResult);
        }
      } catch (e) {
        console.error('[InteractiveItems] Error in custom callback:', e);
      }
    }

    console.log('[InteractiveItems] Interaction:', item.type, 'at', item.x, item.y);
    return result;
  }

  /**
   * Get all interactive items
   * @returns {array} Array of all items
   */
  function getAllItems() {
    return _interactiveItems;
  }

  /**
   * Clear all interactive items
   */
  function clearAll() {
    _interactiveItems = [];
    console.log('[InteractiveItems] Cleared all items');
  }

  /**
   * Get nearest interactive item to position
   * @param {number} x - Grid X position
   * @param {number} y - Grid Y position
   * @returns {object} Nearest item or null
   */
  function getNearestItem(x, y) {
    if (_interactiveItems.length === 0) return null;

    var nearest = null;
    var minDistance = Infinity;

    _interactiveItems.forEach(function(item) {
      var dx = item.x - x;
      var dy = item.y - y;
      var distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = item;
      }
    });

    return nearest;
  }

  /**
   * Serialize interactive items for save/load
   * @returns {array} Serialized item data
   */
  function serialize() {
    return _interactiveItems.map(function(item) {
      return {
        id: item.id,
        type: item.type,
        x: item.x,
        y: item.y,
        text: item.text,
        interacted: item.interacted,
        customData: item.customData
      };
    });
  }

  /**
   * Deserialize and restore interactive items
   * @param {array} data - Serialized item data
   */
  function deserialize(data) {
    if (!data || !Array.isArray(data)) return;

    _interactiveItems = [];
    data.forEach(function(itemData) {
      var item = createItem(itemData.type, itemData.x, itemData.y, {
        text: itemData.text,
        customData: itemData.customData
      });
      if (item) {
        item.id = itemData.id;
        item.interacted = itemData.interacted;
        _interactiveItems.push(item);
      }
    });

    console.log('[InteractiveItems] Restored', _interactiveItems.length, 'items');
  }

  // Public API
  return {
    init: init,
    createItem: createItem,
    addItem: addItem,
    removeItem: removeItem,
    getItemAt: getItemAt,
    getItemsInRange: getItemsInRange,
    canInteractWith: canInteractWith,
    interact: interact,
    getAllItems: getAllItems,
    clearAll: clearAll,
    getNearestItem: getNearestItem,
    serialize: serialize,
    deserialize: deserialize,
    ITEM_TYPES: ITEM_TYPES
  };
})();
