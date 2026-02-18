/* ============================================================
   EYES ONLY - Reserve Card Slots Manager
   Manages the 5-slot card reserve interface for Gone Rogue mode
   ============================================================ */

const ReserveSlots = (function () {
  'use strict';

  var _reserveCards = []; // Array of card objects in reserve
  var _maxReserveSlots = 4; // 4 card slots + 1 cycle/action slot
  var _cycleOffset = 0; // Current pagination offset for reserve
  var _slotsContainer = null;
  var _longPressTimer = null;
  var _longPressThreshold = 500; // ms to trigger long-press tooltip

  /**
   * Initialize reserve slots system
   */
  function init() {
    // Create slots container if it doesn't exist
    _createSlotsContainer();
  }

  /**
   * Create the slots container in the control buttons area
   */
  function _createSlotsContainer() {
    var controlButtons = document.querySelector('.control-buttons');
    if (!controlButtons) return;

    // Check if container already exists
    _slotsContainer = document.getElementById('reserve-slots-container');
    if (_slotsContainer) return;

    _slotsContainer = document.createElement('div');
    _slotsContainer.id = 'reserve-slots-container';
    _slotsContainer.style.display = 'none'; // Hidden until Gone Rogue active

    // Append to control buttons area (will be positioned properly in render())
    controlButtons.appendChild(_slotsContainer);
  }

  /**
   * Show reserve slots (called when entering Gone Rogue)
   */
  function show() {
    if (!_slotsContainer) _createSlotsContainer();
    
    // Add Gone Rogue mode class to body
    document.body.classList.add('mode-gone-rogue');
    
    // Show slots container
    if (_slotsContainer) {
      _slotsContainer.style.display = 'flex';
    }
    
    // Render slots
    render();
  }

  /**
   * Hide reserve slots (called when exiting Gone Rogue)
   */
  function hide() {
    document.body.classList.remove('mode-gone-rogue');
    
    if (_slotsContainer) {
      _slotsContainer.style.display = 'none';
    }
  }

  /**
   * Set reserve cards
   * @param {Array} cards - Array of card objects to display in reserve
   */
  function setReserveCards(cards) {
    _reserveCards = cards || [];
    render();
  }

  /**
   * Add a card to the reserve
   * @param {Object} card - Card object to add
   */
  function addCard(card) {
    if (!card) return;
    _reserveCards.push(card);
    render();
  }

  /**
   * Remove a card from the reserve by index
   * @param {number} index - Index of card to remove
   */
  function removeCard(index) {
    if (index >= 0 && index < _reserveCards.length) {
      _reserveCards.splice(index, 1);
      render();
    }
  }

  /**
   * Render reserve slots
   */
  function render() {
    if (!_slotsContainer) return;

    var controlButtons = document.querySelector('.control-buttons');
    if (!controlButtons) return;

    // Clear existing slots
    _slotsContainer.innerHTML = '';

    // Insert slots container after action button
    var actionBtn = controlButtons.querySelector('button[data-action="action"]');
    if (actionBtn && actionBtn.parentNode === controlButtons) {
      controlButtons.insertBefore(_slotsContainer, actionBtn.nextSibling);
    } else {
      controlButtons.appendChild(_slotsContainer);
    }

    // Calculate visible cards based on pagination
    var visibleCards = _getVisibleCards();
    var needsPagination = _reserveCards.length > _maxReserveSlots;

    // Render each slot
    for (var i = 0; i < _maxReserveSlots; i++) {
      var card = visibleCards[i];
      var slot;

      // Last slot is cycle button if pagination needed
      if (i === _maxReserveSlots - 1 && needsPagination) {
        slot = _createCycleSlot();
      } else if (card) {
        slot = _createCardSlot(card, i + _cycleOffset);
      } else {
        slot = _createEmptySlot(i);
      }

      _slotsContainer.appendChild(slot);
    }
  }

  /**
   * Get visible cards based on pagination offset
   */
  function _getVisibleCards() {
    if (_reserveCards.length <= _maxReserveSlots) {
      return _reserveCards;
    }

    // Show 3 cards when pagination is needed (leaving room for cycle button in slot 4)
    var visibleCount = _maxReserveSlots - 1;
    var endIndex = _cycleOffset + visibleCount;
    return _reserveCards.slice(_cycleOffset, endIndex);
  }

  /**
   * Create a card slot element
   * @param {Object} card - Card data
   * @param {number} globalIndex - Global index in reserve array
   */
  function _createCardSlot(card, globalIndex) {
    var slot = document.createElement('div');
    slot.className = 'reserve-card-slot';
    slot.dataset.cardIndex = globalIndex;

    // Card thumbnail (emoji or icon)
    var thumbnail = document.createElement('div');
    thumbnail.className = 'reserve-card-thumbnail';
    thumbnail.textContent = card.icon || card.emoji || '🃏';
    slot.appendChild(thumbnail);

    // Card name
    var name = document.createElement('div');
    name.className = 'reserve-card-name';
    name.textContent = card.name || 'Card';
    slot.appendChild(name);

    // Card cost (if applicable)
    if (card.cost !== undefined && card.cost !== null) {
      var cost = document.createElement('div');
      cost.className = 'reserve-card-cost';
      cost.textContent = card.cost;
      slot.appendChild(cost);
    }

    // Click handler - instant play
    slot.addEventListener('click', function () {
      _handleCardClick(globalIndex, card);
    });

    // Touch handlers for long-press tooltip
    var touchTimer = null;
    
    slot.addEventListener('touchstart', function (e) {
      touchTimer = setTimeout(function () {
        _showCardTooltip(card, e.touches[0].clientX, e.touches[0].clientY);
      }, _longPressThreshold);
    });

    slot.addEventListener('touchend', function () {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
      _hideCardTooltip();
    });

    slot.addEventListener('touchmove', function () {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    });

    // Mouse handlers for desktop hover tooltip
    slot.addEventListener('mouseenter', function (e) {
      _longPressTimer = setTimeout(function () {
        _showCardTooltip(card, e.clientX, e.clientY);
      }, _longPressThreshold);
    });

    slot.addEventListener('mouseleave', function () {
      if (_longPressTimer) {
        clearTimeout(_longPressTimer);
        _longPressTimer = null;
      }
      _hideCardTooltip();
    });

    return slot;
  }

  /**
   * Create an empty slot element
   */
  function _createEmptySlot(index) {
    var slot = document.createElement('div');
    slot.className = 'reserve-card-slot empty';
    slot.dataset.slotIndex = index;

    var placeholder = document.createElement('div');
    placeholder.className = 'reserve-card-thumbnail';
    placeholder.textContent = '·';
    placeholder.style.opacity = '0.3';
    slot.appendChild(placeholder);

    var label = document.createElement('div');
    label.className = 'reserve-card-name';
    label.textContent = 'empty';
    slot.appendChild(label);

    return slot;
  }

  /**
   * Create cycle control button
   */
  function _createCycleSlot() {
    var slot = document.createElement('div');
    slot.className = 'reserve-cycle-btn';

    var icon = document.createElement('div');
    icon.className = 'reserve-cycle-icon';
    icon.innerHTML = '&#9650; &#9660;'; // Up/down arrows
    slot.appendChild(icon);

    slot.addEventListener('click', function () {
      _handleCycleClick();
    });

    return slot;
  }

  /**
   * Handle card click - instant play
   */
  function _handleCardClick(index, card) {
    console.log('[ReserveSlots] Playing card:', card.name || 'Unknown', 'at index', index);

    // Integrate with GoneRogue system
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleCardSwipe === 'function') {
      // Simulate "swipe up" to use the card
      GoneRogue.handleCardSwipe(index, 'up');
    } else {
      console.warn('[ReserveSlots] GoneRogue.handleCardSwipe not available');
    }

    // Hide tooltip if showing
    _hideCardTooltip();
  }

  /**
   * Handle cycle button click
   */
  function _handleCycleClick() {
    // Cycle forward one card at a time for smooth experience
    _cycleOffset += 1;
    
    // Wrap around if exceeded (ensure we can show full page)
    var maxOffset = _reserveCards.length - (_maxReserveSlots - 1);
    if (_cycleOffset >= maxOffset) {
      _cycleOffset = 0;
    }

    render();
  }

  /**
   * Show card tooltip with details
   */
  function _showCardTooltip(card, x, y) {
    _hideCardTooltip(); // Remove any existing tooltip

    var tooltip = document.createElement('div');
    tooltip.className = 'reserve-card-tooltip';
    tooltip.id = 'reserve-tooltip';

    // Position near touch/click point
    tooltip.style.left = Math.min(x + 10, window.innerWidth - 300) + 'px';
    tooltip.style.top = Math.min(y + 10, window.innerHeight - 200) + 'px';

    // Title
    var title = document.createElement('div');
    title.className = 'reserve-card-tooltip-title';
    title.textContent = card.name || 'Card';
    tooltip.appendChild(title);

    // Description
    if (card.description) {
      var desc = document.createElement('div');
      desc.className = 'reserve-card-tooltip-description';
      desc.textContent = card.description;
      tooltip.appendChild(desc);
    }

    // Stats
    if (card.cost !== undefined || card.damage || card.range) {
      var stats = document.createElement('div');
      stats.className = 'reserve-card-tooltip-stats';

      if (card.cost !== undefined) {
        var costStat = document.createElement('div');
        costStat.className = 'reserve-card-tooltip-stat';
        costStat.innerHTML = '<span>Cost:</span><span>' + card.cost + '</span>';
        stats.appendChild(costStat);
      }

      if (card.damage) {
        var dmgStat = document.createElement('div');
        dmgStat.className = 'reserve-card-tooltip-stat';
        dmgStat.innerHTML = '<span>Damage:</span><span>' + card.damage + '</span>';
        stats.appendChild(dmgStat);
      }

      if (card.range) {
        var rangeStat = document.createElement('div');
        rangeStat.className = 'reserve-card-tooltip-stat';
        rangeStat.innerHTML = '<span>Range:</span><span>' + card.range + '</span>';
        stats.appendChild(rangeStat);
      }

      tooltip.appendChild(stats);
    }

    document.body.appendChild(tooltip);
  }

  /**
   * Hide card tooltip
   */
  function _hideCardTooltip() {
    var tooltip = document.getElementById('reserve-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  /**
   * Get current reserve cards
   */
  function getReserveCards() {
    return _reserveCards;
  }

  /**
   * Clear all reserve cards
   */
  function clear() {
    _reserveCards = [];
    render();
  }

  // Public API
  return {
    init: init,
    show: show,
    hide: hide,
    setReserveCards: setReserveCards,
    addCard: addCard,
    removeCard: removeCard,
    getReserveCards: getReserveCards,
    clear: clear,
    render: render
  };
})();

// Initialize on load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      ReserveSlots.init();
    });
  } else {
    ReserveSlots.init();
  }
}
