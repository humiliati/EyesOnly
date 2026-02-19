/* ============================================================
   EYES ONLY - Commerce Drag-Drop System
   Drag-to-debrief mechanics for buying/selling items
   Visual feedback based on drag source context
   ============================================================ */

const CommerceDragDropSystem = (function() {
  'use strict';

  // Drag context types
  var CONTEXT_TYPES = {
    IDLE: 'idle',
    BUYING: 'buying',
    SELLING: 'selling',
    GAMBLING: 'gambling',
    DISABLED: 'disabled'
  };

  // State
  var _currentContext = CONTEXT_TYPES.IDLE;
  var _dragContext = null;  // {sourceZone, itemId, itemType, cardData, itemPrice}
  var _debriefFeedElement = null;
  var _isShopOpen = false;

  /**
   * Initialize the commerce drag-drop system
   */
  function init() {
    _debriefFeedElement = document.getElementById('debrief-screen');
    if (!_debriefFeedElement) {
      console.warn('[CommerceDragDropSystem] Debrief screen not found');
      return;
    }

    _setupDebriefDropZone();
    console.log('[CommerceDragDropSystem] Initialized');
  }

  /**
   * Set up debrief feed as drop zone for commerce
   */
  function _setupDebriefDropZone() {
    // Prevent default drag behaviors
    _debriefFeedElement.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (_dragContext) {
        _handleDragOverDebrief(true);
      }
    });

    _debriefFeedElement.addEventListener('dragleave', function(e) {
      // Only trigger if leaving the debrief element itself
      if (e.target === _debriefFeedElement) {
        _handleDragOverDebrief(false);
      }
    });

    _debriefFeedElement.addEventListener('drop', function(e) {
      e.preventDefault();
      _handleDropOnDebrief();
    });
  }

  /**
   * Handle drag start from shop or hand
   * @param {Object} context - Drag context data
   */
  function handleDragStart(context) {
    _dragContext = context;

    // Determine context based on source zone
    var contextType = _getContextFromSource(context.sourceZone);
    _setContext(contextType);

    // Start drop zone detection for purchase operations
    if (typeof DropZoneDetector !== 'undefined' && contextType === CONTEXT_TYPES.BUYING) {
      DropZoneDetector.startDrag('purchase');
    }

    console.log('[CommerceDragDropSystem] Drag started:', contextType, context);
  }

  /**
   * Handle drag end
   */
  function handleDragEnd() {
    // End drop zone detection
    if (typeof DropZoneDetector !== 'undefined') {
      DropZoneDetector.endDrag();
    }

    _setContext(CONTEXT_TYPES.IDLE);
    _dragContext = null;
  }

  /**
   * Get context type from source zone
   * @param {string} sourceZone - Source zone identifier
   * @returns {string} Context type
   */
  function _getContextFromSource(sourceZone) {
    switch (sourceZone) {
      case 'shop_items':
        return CONTEXT_TYPES.BUYING;
      case 'shop_gamble':
        return CONTEXT_TYPES.GAMBLING;
      case 'player_hand':
      case 'player_action_bar':
        return _isShopOpen ? CONTEXT_TYPES.SELLING : CONTEXT_TYPES.IDLE;
      default:
        return CONTEXT_TYPES.IDLE;
    }
  }

  /**
   * Set the current context and update visual feedback
   * @param {string} context - Context type
   */
  function _setContext(context) {
    // Remove all context classes
    Object.keys(CONTEXT_TYPES).forEach(function(key) {
      var className = 'context-' + CONTEXT_TYPES[key];
      _debriefFeedElement.classList.remove(className);
    });

    _currentContext = context;

    // Add new context class
    if (context !== CONTEXT_TYPES.IDLE) {
      _debriefFeedElement.classList.add('context-' + context);
    }

    // Emit event for other systems to listen
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('debrief:contextChanged', {
        detail: { context: context }
      }));
    }
  }

  /**
   * Handle drag over debrief feed
   * @param {boolean} isOver - Whether drag is over debrief
   */
  function _handleDragOverDebrief(isOver) {
    if (isOver && _dragContext) {
      _debriefFeedElement.classList.add('debrief-drop-target-active');
    } else {
      _debriefFeedElement.classList.remove('debrief-drop-target-active');
    }
  }

  /**
   * Handle drop on debrief feed
   */
  function _handleDropOnDebrief() {
    if (!_dragContext) {
      console.warn('[CommerceDragDropSystem] No drag context');
      return;
    }

    var result = null;

    // Process based on source zone
    switch (_dragContext.sourceZone) {
      case 'shop_items':
        result = _processPurchase(_dragContext);
        break;
      case 'shop_gamble':
        result = _processGamble(_dragContext);
        break;
      case 'player_hand':
      case 'player_action_bar':
        if (_isShopOpen) {
          result = _processSell(_dragContext);
        }
        break;
      default:
        console.warn('[CommerceDragDropSystem] Unknown source zone:', _dragContext.sourceZone);
    }

    // Trigger feedback animation based on result
    if (result && result.success) {
      _triggerSuccessAnimation(_currentContext);
    } else if (result && !result.success) {
      _triggerFailureAnimation(result.reason);
    }

    // Clean up
    _handleDragOverDebrief(false);
    handleDragEnd();
  }

  /**
   * Process purchase transaction
   * @param {Object} context - Drag context
   * @returns {Object} Result object
   */
  function _processPurchase(context) {
    if (typeof ShopSystem === 'undefined') {
      return { success: false, reason: 'SHOP_SYSTEM_NOT_FOUND' };
    }

    // Validate affordability
    var playerState = GAMESTATE.getState();
    if (playerState.cryptos < context.itemPrice) {
      if (typeof MokUX !== 'undefined') {
        MokUX.speak("Not enough cryptos!", 'NEGATIVE');
      }
      return { success: false, reason: 'INSUFFICIENT_FUNDS' };
    }

    // Check space availability
    var hand = playerState.cardHand || [];
    var actionBar = playerState.actionButtonCards || [];
    var inventory = GAMESTATE.getLooseInventory ? GAMESTATE.getLooseInventory() : [];

    if (hand.length >= 5 && actionBar.length >= 4 && inventory.length >= 12) {
      if (typeof MokUX !== 'undefined') {
        MokUX.speak("No space available!", 'NEGATIVE');
      }
      return { success: false, reason: 'NO_SPACE' };
    }

    // Deduct currency
    playerState.cryptos -= context.itemPrice;

    // Add item to player inventory (prioritize hand)
    if (context.cardData) {
      if (hand.length < 5) {
        hand.push(context.cardData);
      } else if (actionBar.length < 4) {
        actionBar.push(context.cardData);
      } else if (inventory.length < 12) {
        inventory.push(context.cardData);
      }
    }

    // Update currency display
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(playerState.cryptos);
    }

    // Update hand display
    if (typeof HandFanComponent !== 'undefined' && HandFanComponent.updateCards) {
      HandFanComponent.updateCards(hand);
    }

    // MOK feedback
    if (typeof MokUX !== 'undefined') {
      MokUX.speak('Purchased ' + (context.cardData ? context.cardData.name : 'item') + '!', 'POSITIVE');
    }

    // Remove from shop inventory
    if (typeof ShopSystem !== 'undefined' && ShopSystem.getCurrentShop) {
      var shop = ShopSystem.getCurrentShop();
      if (shop && shop.inventory) {
        var itemIndex = shop.inventory.findIndex(function(item) {
          return item.id === context.itemId;
        });
        if (itemIndex > -1) {
          shop.inventory.splice(itemIndex, 1);
        }
      }
    }

    // Trigger passive items (Thrift Ghost)
    if (typeof PassiveItemsSystem !== 'undefined' && context.cardData) {
      var isGamble = context.sourceZone === 'shop_gamble';
      PassiveItemsSystem.handlePurchase(context.cardData, isGamble);
    }

    return {
      success: true,
      remainingCurrency: playerState.cryptos,
      itemName: context.cardData ? context.cardData.name : 'item'
    };
  }

  /**
   * Process sell transaction
   * @param {Object} context - Drag context
   * @returns {Object} Result object
   */
  function _processSell(context) {
    if (typeof ShopSystem === 'undefined' || typeof GAMESTATE === 'undefined') {
      return { success: false, reason: 'SYSTEM_NOT_FOUND' };
    }

    // Find card in player hand
    var playerState = GAMESTATE.getState();
    var hand = playerState.cardHand || [];
    var cardIndex = hand.findIndex(function(c) {
      return c.id === context.itemId || c === context.cardData;
    });

    if (cardIndex === -1) {
      return { success: false, reason: 'CARD_NOT_FOUND' };
    }

    var card = hand[cardIndex];

    // Calculate sell price
    var sellPrice = ShopSystem.calculateSellPrice(card);

    // Remove card from hand
    hand.splice(cardIndex, 1);

    // Add currency
    playerState.cryptos += sellPrice;

    // Update displays
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(playerState.cryptos);
    }

    if (typeof HandFanComponent !== 'undefined' && HandFanComponent.updateCards) {
      HandFanComponent.updateCards(hand);
    }

    // MOK feedback
    if (typeof MokUX !== 'undefined') {
      MokUX.speak('Sold for ' + sellPrice + '¢!', 'POSITIVE');
    }

    return {
      success: true,
      sellPrice: sellPrice,
      remainingCurrency: playerState.cryptos,
      cardName: card.name
    };
  }

  /**
   * Process gamble transaction
   * @param {Object} context - Drag context
   * @returns {Object} Result object
   */
  function _processGamble(context) {
    // Validate affordability
    var playerState = GAMESTATE.getState();
    if (playerState.cryptos < context.itemPrice) {
      if (typeof MokUX !== 'undefined') {
        MokUX.speak("Not enough cryptos!", 'NEGATIVE');
      }
      return { success: false, reason: 'INSUFFICIENT_FUNDS' };
    }

    // Deduct currency
    playerState.cryptos -= context.itemPrice;

    // Update currency display
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(playerState.cryptos);
    }

    // MOK feedback
    if (typeof MokUX !== 'undefined') {
      MokUX.speak('Rolling the dice...', 'NEUTRAL');
    }

    return {
      success: true,
      remainingCurrency: playerState.cryptos
    };
  }

  /**
   * Trigger success animation
   * @param {string} contextType - Context type
   */
  function _triggerSuccessAnimation(contextType) {
    var animationClass = '';

    switch (contextType) {
      case CONTEXT_TYPES.BUYING:
        animationClass = 'money-bag-active';
        break;
      case CONTEXT_TYPES.SELLING:
        animationClass = 'incinerator-active';
        break;
      case CONTEXT_TYPES.GAMBLING:
        animationClass = 'slot-active';
        break;
    }

    if (animationClass) {
      _debriefFeedElement.classList.add(animationClass);
      setTimeout(function() {
        _debriefFeedElement.classList.remove(animationClass);
      }, 600);
    }
  }

  /**
   * Trigger failure animation
   * @param {string} reason - Failure reason
   */
  function _triggerFailureAnimation(reason) {
    _debriefFeedElement.classList.add('transaction-failed');
    setTimeout(function() {
      _debriefFeedElement.classList.remove('transaction-failed');
    }, 400);
  }

  /**
   * Set shop open state
   * @param {boolean} isOpen - Whether shop is open
   */
  function setShopOpen(isOpen) {
    _isShopOpen = isOpen;
    console.log('[CommerceDragDropSystem] Shop open state:', isOpen);
  }

  /**
   * Get current context
   * @returns {string} Current context type
   */
  function getCurrentContext() {
    return _currentContext;
  }

  // Public API
  return {
    init: init,
    handleDragStart: handleDragStart,
    handleDragEnd: handleDragEnd,
    setShopOpen: setShopOpen,
    getCurrentContext: getCurrentContext,
    CONTEXT_TYPES: CONTEXT_TYPES
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    CommerceDragDropSystem.init();
  });
} else {
  CommerceDragDropSystem.init();
}
