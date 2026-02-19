/* ============================================================
   EYES ONLY - Card Disposal System
   Drag-to-debrief mechanics for destroying unwanted cards
   ============================================================ */

const CardDisposalSystem = (function() {
  'use strict';

  // Configuration
  var DISPOSAL_CONFIG = {
    validCardTypes: ['disposable', 'consumable'],  // Can destroy
    invalidCardTypes: ['exhaust', 'power', 'persistent', 'gated'],  // Cannot destroy
    animationDuration: 400,
    feedbackOnInvalid: 'shake'
  };

  // State
  var _isDragOverDebrief = false;
  var _draggedCard = null;  // {element, card, index}
  var _dragPreviewElement = null;
  var _debriefFeedElement = null;

  /**
   * Initialize the disposal system
   */
  function init() {
    _debriefFeedElement = document.getElementById('debrief-screen');
    if (!_debriefFeedElement) {
      console.warn('[CardDisposalSystem] Debrief screen not found');
      return;
    }

    _setupDebriefDropZone();
  }

  /**
   * Set up debrief feed as drop zone
   */
  function _setupDebriefDropZone() {
    // Prevent default drag behaviors
    _debriefFeedElement.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (_draggedCard) {
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
   * Handle drag start from card or inventory item
   * @param {HTMLElement} element - Card or item DOM element
   * @param {Object} data - Card or item data
   * @param {number} index - Index in hand or inventory
   * @param {string} source - 'hand' or 'inventory'
   */
  function handleDragStart(element, data, index, source) {
    source = source || 'hand';  // Default to hand for backward compatibility
    
    _draggedCard = {
      element: element,
      card: data,  // Can be card or item
      index: index,
      source: source  // Track where it came from
    };

    // Set drag data
    var event = window.event;
    if (event && event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', element.innerHTML);
    }

    // Add dragging class
    element.classList.add('card-dragging');

    console.log('[CardDisposalSystem] Drag started from ' + source + ':', data.name);
  }

  /**
   * Handle drag end
   */
  function handleDragEnd() {
    if (_draggedCard && _draggedCard.element) {
      _draggedCard.element.classList.remove('card-dragging');
    }

    _handleDragOverDebrief(false);
    _draggedCard = null;
  }

  /**
   * Handle drag over debrief feed
   * @param {boolean} isOver - Whether drag is over debrief
   */
  function _handleDragOverDebrief(isOver) {
    _isDragOverDebrief = isOver;

    if (isOver && _draggedCard) {
      _updateDragPreviewToRecycling();
      _debriefFeedElement.classList.add('debrief-drop-target');
    } else {
      _restoreDragPreview();
      _debriefFeedElement.classList.remove('debrief-drop-target');
    }
  }

  /**
   * Update drag preview to show recycling emoji
   */
  function _updateDragPreviewToRecycling() {
    if (_draggedCard && _draggedCard.element) {
      _draggedCard.element.classList.add('drag-preview-recycling');
    }
  }

  /**
   * Restore normal drag preview
   */
  function _restoreDragPreview() {
    if (_draggedCard && _draggedCard.element) {
      _draggedCard.element.classList.remove('drag-preview-recycling');
    }
  }

  /**
   * Handle drop on debrief feed
   */
  function _handleDropOnDebrief() {
    if (!_draggedCard) {
      console.warn('[CardDisposalSystem] No card being dragged');
      return;
    }

    var data = _draggedCard.card;
    var element = _draggedCard.element;
    var source = _draggedCard.source || 'hand';

    // Check if card/item type allows disposal
    var lifecycle = _getCardLifecycle(data);
    var isDisposable = DISPOSAL_CONFIG.validCardTypes.indexOf(lifecycle) !== -1;

    if (!isDisposable) {
      _handleInvalidDisposal(data, element, lifecycle);
      _draggedCard = null;
      _handleDragOverDebrief(false);
      return;
    }

    // Valid disposal - destroy card or item
    _destroyCard(_draggedCard.card, _draggedCard.index, 'manual_disposal', source);
    _draggedCard = null;
    _handleDragOverDebrief(false);
  }

  /**
   * Get card lifecycle type
   * @param {Object} card - Card data
   * @returns {string} Lifecycle type
   */
  function _getCardLifecycle(card) {
    return card.lifecycleType || card.lifecycle || 'persistent';
  }

  /**
   * Handle invalid disposal attempt
   * @param {Object} card - Card data
   * @param {HTMLElement} cardElement - Card DOM element
   * @param {string} lifecycle - Card lifecycle type
   */
  function _handleInvalidDisposal(card, cardElement, lifecycle) {
    console.log('[CardDisposalSystem] Invalid disposal:', lifecycle, 'cards cannot be destroyed');

    // Shake animation
    if (cardElement) {
      cardElement.classList.add('card-shake');
      setTimeout(function() {
        cardElement.classList.remove('card-shake');
      }, DISPOSAL_CONFIG.animationDuration);
    }

    // MOK interjection
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      UIControls.updateMokInterjection('Cannot destroy ' + lifecycle + ' card: ' + card.name);
    }
  }

  /**
   * Destroy card or item and trigger animation
   * @param {Object} data - Card or item data
   * @param {number} index - Index
   * @param {string} reason - Destruction reason
   * @param {string} source - 'hand' or 'inventory'
   */
  function _destroyCard(data, index, reason, source) {
    source = source || 'hand';
    console.log('[CardDisposalSystem] Destroying from ' + source + ':', data.name, 'reason:', reason);

    // Trigger incinerator animation
    _triggerIncineratorAnimation();

    if (source === 'hand') {
      // Remove from hand via HandFanComponent
      if (typeof HandFanComponent !== 'undefined') {
        // Get current cards
        var currentCards = HandFanComponent._cards || [];

        // Remove the card
        currentCards.splice(index, 1);

        // Update hand display
        HandFanComponent.updateCards(currentCards);
      }

      // Remove from GAMESTATE hand if available
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getCardHand) {
        var hand = GAMESTATE.getCardHand();
        if (hand && hand[index]) {
          hand.splice(index, 1);
        }
      }
    } else if (source === 'inventory') {
      // Remove from inventory
      if (typeof UIControls !== 'undefined' && UIControls.removeInventoryItem) {
        UIControls.removeInventoryItem(index);
      }

      // Repopulate inventory to refresh display
      if (typeof UIControls !== 'undefined' && UIControls.populateInventory) {
        UIControls.populateInventory();
      }
    }

    // Trigger passive items (Scrapper Core)
    if (typeof PassiveItemsSystem !== 'undefined') {
      PassiveItemsSystem.handleDisposal(data, reason);
    }

    // MOK interjection
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      UIControls.updateMokInterjection('Card destroyed: ' + data.name);
    }
  }

  /**
   * Trigger incinerator animation on debrief feed
   */
  function _triggerIncineratorAnimation() {
    if (!_debriefFeedElement) return;

    // Add animation class
    _debriefFeedElement.classList.add('incinerator-active');

    // Remove after animation completes
    setTimeout(function() {
      _debriefFeedElement.classList.remove('incinerator-active');
    }, DISPOSAL_CONFIG.animationDuration);
  }

  /**
   * Check if a card is disposable
   * @param {Object} card - Card data
   * @returns {boolean} Whether card can be destroyed
   */
  function isDisposable(card) {
    var lifecycle = _getCardLifecycle(card);
    return DISPOSAL_CONFIG.validCardTypes.indexOf(lifecycle) !== -1;
  }

  // Public API
  return {
    init: init,
    handleDragStart: handleDragStart,
    handleDragEnd: handleDragEnd,
    isDisposable: isDisposable
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    CardDisposalSystem.init();
  });
} else {
  CardDisposalSystem.init();
}
