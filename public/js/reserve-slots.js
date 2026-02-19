/* ============================================================
   EYES ONLY - Reserve Card Slots Manager
   Manages the 5-slot card reserve interface for Gone Rogue mode
   ============================================================ */

const ReserveSlots = (function () {
  'use strict';

  var _actionButtonCards = []; // Array of up to 4 card objects in action buttons
  var _maxActionButtonSlots = 4; // Default capacity (can be increased by equipment)
  var _maxVisibleSlots = 4; // Maximum slots to show at once (before cycling needed)
  var _cycleOffset = 0; // Current pagination offset for card cycling
  var _slotsContainer = null;
  var _longPressTimer = null;
  var _longPressThreshold = 500; // ms to trigger long-press tooltip
  var _viewMode = 'cards'; // 'cards' or 'inventory'
  var _inventoryCycleOffset = 0; // Pagination offset for inventory view

  /**
   * Get current action button capacity (including equipment bonuses)
   */
  function _getMaxSlots() {
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getActionButtonCapacity === 'function') {
      return GAMESTATE.getActionButtonCapacity();
    }
    return _maxActionButtonSlots;
  }

  /**
   * Abbreviate card name by removing vowels (except first letter of each word)
   * Preserves first letter of each word, even if it's a vowel
   * Example: "Sold Out" → "SldOt", "Energy Drink" → "EnrgyDrnk"
   * @param {string} name - Full card name
   * @returns {string} Abbreviated name
   */
  function _abbreviateCardName(name) {
    if (!name) return '';

    // Split into words, process each word
    var words = name.split(/\s+/);
    var result = '';

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (word.length === 0) continue;

      // Take first character of word (even if vowel)
      result += word.charAt(0);

      // Remove vowels from remaining characters in this word
      for (var j = 1; j < word.length; j++) {
        var char = word.charAt(j);
        var lower = char.toLowerCase();
        if (lower !== 'a' && lower !== 'e' && lower !== 'i' && lower !== 'o' && lower !== 'u') {
          result += char;
        }
      }
    }

    return result;
  }

  /**
   * Get quality color for card display
   * @param {string} quality - Quality tier name
   * @returns {string} CSS color value
   */
  function _getQualityColor(quality) {
    var qualityColors = {
      'cracked': '#666',
      'worn': '#999',
      'standard': '#fff',
      'fine': '#4fc3f7',
      'superior': '#ffeb3b',
      'elite': '#ff9800',
      'masterwork': '#ffd700',
      'near_perfect': '#8bc34a',
      'perfect': '#9c27b0'
    };

    return qualityColors[quality] || '#fff';
  }

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

    // Don't add Gone Rogue mode class - keep normal button visibility
    // We'll replace buttons dynamically

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
    if (_slotsContainer) {
      _slotsContainer.style.display = 'none';
    }

    // Reset cycle offset and view mode
    _cycleOffset = 0;
    _inventoryCycleOffset = 0;
    _viewMode = 'cards';
  }

  /**
   * Set action button cards
   * @param {Array} cards - Array of card objects to display in action buttons
   */
  function setActionButtonCards(cards) {
    _actionButtonCards = cards || [];
    render();
  }

  /**
   * Add a card to the action buttons
   * @param {Object} card - Card object to add
   */
  function addCard(card) {
    if (!card) return;
    var maxSlots = _getMaxSlots();
    if (_actionButtonCards.length < maxSlots) {
      _actionButtonCards.push(card);
      render();
    }
  }

  /**
   * Remove a card from the action buttons by index
   * @param {number} index - Index of card to remove
   */
  function removeCard(index) {
    if (index >= 0 && index < _actionButtonCards.length) {
      _actionButtonCards.splice(index, 1);
      render();
    }
  }

  /**
   * Get action button cards
   * @returns {Array} Copy of action button cards array
   */
  function getCards() {
    return _actionButtonCards.slice();
  }

  /**
   * Cycle to next set of cards
   * Advances the offset by 1 to show the next card in rotation
   */
  function cycleCards() {
    if (_actionButtonCards.length > _maxVisibleSlots) {
      _cycleOffset = (_cycleOffset + 1) % _actionButtonCards.length;
      render();
    }
  }

  /**
   * Render reserve slots with natural collapsing behavior
   * Shows:
   * - Back button (always)
   * - Inventory button (always)
   * - Cycle button (only if > _maxVisibleSlots cards)
   * - Up to _maxVisibleSlots card slots (4 by default)
   *
   * Total buttons shown: 3-7 depending on card count
   * - With 0-4 cards: back + inventory + 0-4 slots = 2-6 buttons
   * - With > 4 cards: back + inventory + cycle + 4 slots = 7 buttons
   */
  function render() {
    if (!_slotsContainer) return;

    var controlButtons = document.querySelector('.control-buttons');
    if (!controlButtons) return;

    // Clear existing content
    _slotsContainer.innerHTML = '';

    // Hide default control buttons when in Gone Rogue mode
    var defaultButtons = controlButtons.querySelectorAll('button');
    defaultButtons.forEach(function(btn) {
      btn.style.display = 'none';
    });

    if (_viewMode === 'inventory') {
      _renderInventoryView();
    } else {
      _renderCardsView();
    }

    // Position the container at the top of control buttons
    controlButtons.insertBefore(_slotsContainer, controlButtons.firstChild);
  }

  /**
   * Render the cards view (default)
   */
  function _renderCardsView() {
    var maxSlots = _getMaxSlots();
    var totalCards = _actionButtonCards.length;
    var needsCycling = totalCards > _maxVisibleSlots;

    // Button 1: Back (always shown)
    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'control-button gone-rogue-btn';
    backBtn.dataset.action = 'back';
    backBtn.textContent = 'back';
    backBtn.addEventListener('click', function() {
      _handleBackClick();
    });
    _slotsContainer.appendChild(backBtn);

    // Button 2: Inventory — switches to inventory view
    var inventoryBtn = document.createElement('button');
    inventoryBtn.type = 'button';
    inventoryBtn.className = 'control-button gone-rogue-btn';
    inventoryBtn.dataset.action = 'inventory';
    inventoryBtn.textContent = 'inventory';
    inventoryBtn.addEventListener('click', function() {
      _viewMode = 'inventory';
      _inventoryCycleOffset = 0;
      render();
    });
    _slotsContainer.appendChild(inventoryBtn);

    // Button 3: Cycle (only shown if > _maxVisibleSlots cards)
    if (needsCycling) {
      var cycleBtn = document.createElement('button');
      cycleBtn.type = 'button';
      cycleBtn.className = 'control-button gone-rogue-btn cycle-btn';
      cycleBtn.dataset.action = 'cycle';
      cycleBtn.innerHTML = '↑↓';
      cycleBtn.title = 'Cycle cards (' + totalCards + ' total)';
      cycleBtn.addEventListener('click', function() {
        cycleCards();
      });
      _slotsContainer.appendChild(cycleBtn);
    }

    // Buttons 4-N: Card slots (show up to _maxVisibleSlots, with empty placeholders)
    var slotsToShow = Math.min(_maxVisibleSlots, maxSlots);
    for (var i = 0; i < slotsToShow; i++) {
      var slotBtn = _createCardSlotButton(i);
      _slotsContainer.appendChild(slotBtn);
    }
  }

  /**
   * Render the inventory view (replaces card slots in left column)
   * Shows 4 inventory items with a "+N more" badge if > 4, plus a "← cards" swap button
   */
  function _renderInventoryView() {
    var items = [];
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getPersistentInventory === 'function') {
      items = GAMESTATE.getPersistentInventory() || [];
    }

    var totalItems = items.length;
    var visibleItems = items.slice(_inventoryCycleOffset, _inventoryCycleOffset + _maxVisibleSlots);
    var remaining = totalItems - (_inventoryCycleOffset + visibleItems.length);

    // Button 1: Back to cards view
    var cardsBtn = document.createElement('button');
    cardsBtn.type = 'button';
    cardsBtn.className = 'control-button gone-rogue-btn';
    cardsBtn.dataset.action = 'cards';
    cardsBtn.textContent = '← cards';
    cardsBtn.addEventListener('click', function() {
      _viewMode = 'cards';
      render();
    });
    _slotsContainer.appendChild(cardsBtn);

    // Button 2: Cycle inventory (only shown if > _maxVisibleSlots items)
    if (totalItems > _maxVisibleSlots) {
      var cycleBtn = document.createElement('button');
      cycleBtn.type = 'button';
      cycleBtn.className = 'control-button gone-rogue-btn cycle-btn';
      cycleBtn.dataset.action = 'inv-cycle';
      cycleBtn.innerHTML = '↑↓';
      cycleBtn.title = 'Cycle inventory (' + totalItems + ' total)';
      cycleBtn.addEventListener('click', function() {
        _inventoryCycleOffset = (_inventoryCycleOffset + _maxVisibleSlots) % totalItems;
        render();
      });
      _slotsContainer.appendChild(cycleBtn);
    }

    // Buttons 3-N: Inventory item slots (up to _maxVisibleSlots)
    for (var i = 0; i < _maxVisibleSlots; i++) {
      var item = visibleItems[i] || null;
      var itemBtn = _createInventorySlotButton(item, _inventoryCycleOffset + i);
      _slotsContainer.appendChild(itemBtn);
    }

    // "+N more" badge appended to last non-empty slot when there are remaining items
    if (remaining > 0) {
      var lastBtn = _slotsContainer.lastElementChild;
      if (lastBtn) {
        var badge = document.createElement('span');
        badge.className = 'inv-remaining-badge';
        badge.textContent = '+' + remaining;
        lastBtn.appendChild(badge);
      }
    }
  }

  /**
   * Create an inventory slot button
   * @param {Object|null} item - Inventory item or null for empty slot
   * @param {number} itemIndex - Global item index in persistent inventory
   * @returns {HTMLElement}
   */
  function _createInventorySlotButton(item, itemIndex) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'control-button gone-rogue-btn inv-slot-btn';

    if (item) {
      var emoji = item.emoji || '📦';
      var abbrevName = _abbreviateCardName(item.name || 'Item');
      btn.innerHTML = '<span class="card-emoji">' + emoji + '</span><span class="card-abbrev">' + abbrevName + '</span>';
      btn.title = item.name || 'Item';

      btn.addEventListener('click', function() {
        _handleInventoryItemClick(itemIndex, item);
      });

      // Long-press tooltip
      var touchTimer = null;
      btn.addEventListener('mouseenter', function(e) {
        touchTimer = setTimeout(function() {
          _showCardTooltip(item, e.clientX, e.clientY);
        }, _longPressThreshold);
      });
      btn.addEventListener('mouseleave', function() {
        if (touchTimer) clearTimeout(touchTimer);
        _hideCardTooltip();
      });
    } else {
      btn.innerHTML = '<span class="card-empty">empty</span>';
      btn.classList.add('empty-slot');
      btn.disabled = true;
      btn.title = 'Empty slot';
    }

    return btn;
  }

  /**
   * Handle inventory item click — use item if usable
   */
  function _handleInventoryItemClick(index, item) {
    console.log('[ReserveSlots] Using inventory item:', item.name || 'Unknown', 'at index', index);
    if (typeof UIControls !== 'undefined' && typeof UIControls.useInventoryItem === 'function') {
      UIControls.useInventoryItem(index, item);
    }
    _hideCardTooltip();
  }

  /**
   * Create a card slot button
   * @param {number} slotIndex - Index of the visible slot (0 to _maxVisibleSlots-1)
   * @returns {HTMLElement} Button element
   */
  function _createCardSlotButton(slotIndex) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'control-button gone-rogue-btn card-slot-btn';
    btn.dataset.slotIndex = slotIndex;

    // Calculate which card to show based on cycle offset
    // With cycling, we rotate through all cards
    // Guard against empty array to prevent NaN from modulo operation
    var cardIndex = _actionButtonCards.length > 0 
      ? (_cycleOffset + slotIndex) % _actionButtonCards.length 
      : -1;
    var card = cardIndex >= 0 ? _actionButtonCards[cardIndex] : null;

    if (card) {
      // Card exists - show emoji and abbreviated name
      var emoji = card.emoji || '🃏';
      var abbrevName = _abbreviateCardName(card.name);
      var quality = card.quality || card.qualityName || 'standard';
      var color = _getQualityColor(quality.toLowerCase());

      btn.innerHTML = '<span class="card-emoji">' + emoji + '</span><span class="card-abbrev" style="color: ' + color + ';">' + abbrevName + '</span>';
      btn.title = card.name; // Full name on hover

      // Click handler - use the card
      btn.addEventListener('click', function() {
        _handleCardSlotClick(cardIndex, card);
      });

      // Long-press for tooltip
      var touchTimer = null;
      btn.addEventListener('touchstart', function(e) {
        touchTimer = setTimeout(function() {
          _showCardTooltip(card, e.touches[0].clientX, e.touches[0].clientY);
        }, _longPressThreshold);
      });

      btn.addEventListener('touchend', function() {
        if (touchTimer) clearTimeout(touchTimer);
      });

      btn.addEventListener('mouseenter', function(e) {
        touchTimer = setTimeout(function() {
          _showCardTooltip(card, e.clientX, e.clientY);
        }, _longPressThreshold);
      });

      btn.addEventListener('mouseleave', function() {
        if (touchTimer) clearTimeout(touchTimer);
        _hideCardTooltip();
      });
    } else {
      // Empty slot - show placeholder with "Exhstd" (exhausted - vowel drop)
      btn.innerHTML = '<span class="card-empty">Exhstd</span>';
      btn.classList.add('empty-slot');
      btn.disabled = true;
      btn.title = 'Empty Slot';
    }

    return btn;
  }

  /**
   * Handle back button click
   */
  function _handleBackClick() {
    // Trigger the back action through GoneRogue or main UI
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.process === 'function') {
      GoneRogue.process('exit');
    } else if (typeof UIControls !== 'undefined') {
      // Fallback to UI controls
      var backBtn = document.querySelector('button[data-action="back"]');
      if (backBtn) backBtn.click();
    }
  }

  /**
   * Handle inventory button click
   */
  function _handleInventoryClick() {
    // Trigger inventory toggle through UI controls
    if (typeof UIControls !== 'undefined' && typeof UIControls.toggleInventory === 'function') {
      UIControls.toggleInventory();
    } else {
      // Fallback to clicking the inventory button
      var inventoryBtn = document.querySelector('button[data-action="inventory"]');
      if (inventoryBtn) inventoryBtn.click();
    }
  }

  /**
   * Handle card slot click - use the card
   */
  function _handleCardSlotClick(index, card) {
    console.log('[ReserveSlots] Using card from action button:', card.name || 'Unknown', 'at index', index);

    // Integrate with GoneRogue system
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleCardSwipe === 'function') {
      // Simulate "swipe up" to use the card from loose inventory
      // The index needs to map to the loose inventory index
      GoneRogue.handleCardSwipe(index, 'up');
    } else {
      console.warn('[ReserveSlots] GoneRogue.handleCardSwipe not available');
    }

    // Hide tooltip if showing
    _hideCardTooltip();
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
   * Get current action button cards
   */
  function getActionButtonCards() {
    return _actionButtonCards;
  }

  /**
   * Clear all action button cards
   */
  function clear() {
    _actionButtonCards = [];
    _cycleOffset = 0;
    render();
  }

  // Public API
  return {
    init: init,
    show: show,
    hide: hide,
    setActionButtonCards: setActionButtonCards,
    setReserveCards: setActionButtonCards, // Alias for backward compatibility
    addCard: addCard,
    removeCard: removeCard,
    getCards: getCards,
    getActionButtonCards: getActionButtonCards,
    cycleCards: cycleCards,
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
