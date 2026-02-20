/* ============================================================
   EYES ONLY - Hand Fan Component (Hearthstone-Style)
   Card display with transparency based on lifecycle
   ============================================================ */

const HandFanComponent = (function () {
  'use strict';

  // State
  var _mode = 'hidden'; // 'hidden', 'combat', 'contextual'
  var _position = 'centered'; // 'centered', 'bottom'
  var _cards = [];
  var _selectedCards = [];
  var _animationPhase = 'idle'; // 'idle', 'commit', 'resolve', 'repopulate'
  var _isAnimating = false;

  // DOM elements
  var _fanContainer = null;

  // Configuration
  var _maxVisibleCards = 5;
  var _cardOverlapPercent = 30; // 30% overlap for fan effect

  /**
   * Initialize the Hand Fan Component
   */
  function init() {
    _createFanContainer();
    _attachEventListeners();
  }

  /**
   * Create fan container element
   */
  function _createFanContainer() {
    _fanContainer = document.createElement('div');
    _fanContainer.id = 'hand-fan-container';
    _fanContainer.className = 'hand-fan-container';
    _fanContainer.style.display = 'none';
    document.body.appendChild(_fanContainer);
  }

  /**
   * Attach event listeners
   */
  function _attachEventListeners() {
    // Card selection handlers will be added to individual cards
  }

  /**
   * Set mode and position
   * @param {string} mode - 'combat' or 'contextual'
   * @param {string} position - 'centered' or 'bottom'
   */
  function setMode(mode, position) {
    _mode = mode;
    _position = position;

    if (_mode === 'hidden') {
      hide();
      return;
    }

    _updateFanPosition();
    _renderCards();
  }

  /**
   * Show the hand fan
   * @param {Array} cards - Array of card objects
   */
  function show(cards) {
    _cards = cards || [];
    _mode = 'combat';
    _position = 'centered';

    _renderCards();
    _fanContainer.style.display = 'flex';
    _fanContainer.classList.add('hand-fan-appear');

    setTimeout(function() {
      _fanContainer.classList.remove('hand-fan-appear');
    }, 300);
  }

  /**
   * Hide the hand fan
   */
  function hide() {
    _fanContainer.classList.add('hand-fan-disappear');

    setTimeout(function() {
      _fanContainer.style.display = 'none';
      _fanContainer.classList.remove('hand-fan-disappear');
      _fanContainer.classList.remove('hand-fan-minimized'); // Remove minimized state
    }, 300);
  }

  /**
   * Minimize hand to single transparent card (during turn resolution)
   */
  function minimize() {
    _fanContainer.classList.add('hand-fan-minimized');
  }

  /**
   * Restore hand from minimized state
   */
  function restore() {
    _fanContainer.classList.remove('hand-fan-minimized');
  }

  /**
   * Update cards in the fan
   * @param {Array} cards - New card array
   */
  function updateCards(cards) {
    _cards = cards || [];
    _renderCards();
  }

  /**
   * Update fan position based on mode and position
   */
  function _updateFanPosition() {
    _fanContainer.className = 'hand-fan-container';

    if (_mode === 'combat' && _position === 'centered') {
      _fanContainer.classList.add('hand-fan-combat');
    } else if (_mode === 'contextual' && _position === 'bottom') {
      _fanContainer.classList.add('hand-fan-contextual');
    }
  }

  /**
   * Render cards in the fan
   */
  function _renderCards() {
    if (!_fanContainer) return;
    var _fr0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;

    _fanContainer.innerHTML = '';
    _updateFanPosition();

    // Check if hand is empty or all cards are unaffordable
    var hasAffordableCards = false;
    if (_cards.length > 0) {
      for (var i = 0; i < _cards.length; i++) {
        var affordability = _validateCardAffordability(_cards[i]);
        if (affordability.canAfford) {
          hasAffordableCards = true;
          break;
        }
      }
    }

    // Show placeholder if no cards or no affordable cards
    if (_cards.length === 0 || !hasAffordableCards) {
      var placeholder = document.createElement('div');
      placeholder.className = 'hand-card-placeholder';
      placeholder.textContent = 'BLCK';
      _fanContainer.appendChild(placeholder);
      return;
    }

    // Limit visible cards
    var visibleCards = _cards.slice(0, _maxVisibleCards);

    visibleCards.forEach(function(card, index) {
      var cardEl = _createCardElement(card, index);
      _fanContainer.appendChild(cardEl);
    });

    if (_fr0 && typeof EYESONLY_PERF !== 'undefined') {
      EYESONLY_PERF.mark('fan.renderMs', performance.now() - _fr0);
    }
  }

  /**
   * Create a single card element
   * @param {Object} card - Card data
   * @param {number} index - Index in hand
   */
  function _createCardElement(card, index) {
    var cardWrapper = document.createElement('div');
    cardWrapper.className = 'hand-card-wrapper';
    cardWrapper.dataset.cardIndex = index;

    // Apply fan transformation
    _applyFanTransform(cardWrapper, index, _cards.length);

    // Create card element
    var cardEl = document.createElement('div');
    cardEl.className = 'hand-card';

    // Make card draggable
    cardEl.draggable = true;

    // Apply lifecycle-based transparency
    var lifecycle = _getCardLifecycle(card);
    cardEl.classList.add('hand-card-' + lifecycle);

    // Check if selected
    if (_selectedCards.indexOf(index) !== -1) {
      cardEl.classList.add('hand-card-selected');
    }

    // Apply quality border color
    if (card.quality || card.qualityName) {
      var quality = (card.quality || card.qualityName).toLowerCase().replace(/ /g, '_');
      cardEl.dataset.quality = quality;
    }

    // === RESOURCE VALIDATION ===
    // Check if player can afford this card
    var affordability = _validateCardAffordability(card);
    if (!affordability.canAfford) {
      cardEl.classList.add('card-insufficient-resources');
      cardEl.dataset.unaffordable = 'true';

      // Store shortage info for tooltip
      if (affordability.missingResources && affordability.missingResources.length > 0) {
        var shortageText = _formatResourceShortage(affordability.missingResources);
        cardEl.dataset.resourceShortage = shortageText;
        cardEl.title = shortageText; // Basic browser tooltip
      }
    }

    // Card content
    var html = '';

    // Cost badge (top-left)
    if (card.cost !== undefined && card.cost !== null) {
      html += '<div class="hand-card-cost">' + card.cost + '</div>';
    }

    // Card artwork/emoji (80% of card height) - tiny icon
    html += '<div class="hand-card-artwork">';
    html += '<div class="hand-card-emoji">' + (card.emoji || '🃏') + '</div>';
    html += '</div>';

    // Card name (bottom) — always abbreviated for compact display in combat
    var cardName = card.name || 'Unknown Card';
    if (typeof NameUtils !== 'undefined' && NameUtils.formatForMobile) {
      cardName = NameUtils.formatForMobile(card);
    } else {
      // Fallback abbreviation (max 6 chars)
      cardName = _abbreviateCardName(cardName, 6);
    }

    html += '<div class="hand-card-name">' + cardName + '</div>';

    // Effect icons (if any)
    if (card.effects && card.effects.length > 0) {
      html += '<div class="hand-card-effects">';
      card.effects.slice(0, 3).forEach(function(effect) {
        html += '<span class="hand-card-effect-icon">' + (effect.icon || '•') + '</span>';
      });
      html += '</div>';
    }

    cardEl.innerHTML = html;

    // Selection badge (if selected)
    var selectionIndex = _selectedCards.indexOf(index);
    if (selectionIndex !== -1) {
      var badge = document.createElement('div');
      badge.className = 'hand-card-selection-badge';
      badge.textContent = selectionIndex + 1;
      cardEl.appendChild(badge);
    }

    // Attach event handlers
    _attachCardHandlers(cardEl, card, index);

    cardWrapper.appendChild(cardEl);
    return cardWrapper;
  }

  /**
   * Apply fan transformation to card wrapper
   * @param {HTMLElement} wrapper - Card wrapper element
   * @param {number} index - Card index
   * @param {number} total - Total number of cards
   */
  function _applyFanTransform(wrapper, index, total) {
    var _ft0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;
    // Calculate fan spread
    var centerIndex = (total - 1) / 2;
    var offset = index - centerIndex;

    // Rotation angle (degrees)
    var maxRotation = 8; // Maximum rotation at edges
    var rotation = offset * (maxRotation / centerIndex);

    // Vertical offset (pixels) - creates arc
    var maxVerticalOffset = 15;
    var verticalOffset = Math.abs(offset) * (maxVerticalOffset / centerIndex);

    // Horizontal offset for overlap
    var baseWidth = 120; // Card width in px
    var overlapWidth = baseWidth * (_cardOverlapPercent / 100);
    var horizontalSpacing = baseWidth - overlapWidth;

    // Z-index (center cards on top)
    var zIndex = 100 - Math.abs(offset * 10);

    // Apply transforms
    wrapper.style.transform = 'translateY(' + verticalOffset + 'px) rotate(' + rotation + 'deg)';
    wrapper.style.marginLeft = (index === 0 ? 0 : -overlapWidth) + 'px';
    wrapper.style.zIndex = zIndex;

    // Add hover lift effect
    wrapper.addEventListener('mouseenter', function() {
      if (!_isAnimating) {
        wrapper.style.transform = 'translateY(' + (verticalOffset - 20) + 'px) rotate(' + rotation + 'deg) scale(1.05)';
        wrapper.style.zIndex = 200;
      }
    });

    wrapper.addEventListener('mouseleave', function() {
      if (!_isAnimating) {
        wrapper.style.transform = 'translateY(' + verticalOffset + 'px) rotate(' + rotation + 'deg)';
        wrapper.style.zIndex = zIndex;
      }
    });

    if (_ft0 && typeof EYESONLY_PERF !== 'undefined') {
      EYESONLY_PERF.mark('fan.transformMs', performance.now() - _ft0);
    }
  }

  /**
   * Get card lifecycle type for transparency
   * @param {Object} card - Card data
   * @returns {string} Lifecycle type
   */
  function _getCardLifecycle(card) {
    // Map card types to lifecycle categories
    var lifecycle = card.lifecycleType || card.lifecycle || card.consumable || 'core';

    var lifecycleMap = {
      'disposable': 'consumable',
      'LIFE_001': 'consumable',
      'exhaust': 'exhaust',
      'LIFE_002': 'exhaust',
      'power': 'power',
      'LIFE_003': 'power',
      'gated': 'gated',
      'LIFE_004': 'gated',
      'persistent': 'core',
      'LIFE_005': 'core',
      'core': 'core'
    };

    return lifecycleMap[lifecycle] || 'core';
  }

  /**
   * Attach event handlers to card
   * @param {HTMLElement} cardEl - Card element
   * @param {Object} card - Card data
   * @param {number} index - Card index
   */
  function _attachCardHandlers(cardEl, card, index) {
    // Click to select/deselect (only if affordable)
    cardEl.addEventListener('click', function(e) {
      // On touch devices, a touchend can be followed by a synthetic click.
      // If we just handled a touch interaction, ignore this click to prevent rapid toggle ("shaking").
      var lastTouch = Number(cardEl.dataset.lastTouchTs || 0);
      if (lastTouch && Date.now() - lastTouch < 800) {
        if (e && e.preventDefault) e.preventDefault();
        return;
      }

      // Check if card is unaffordable
      if (cardEl.dataset.unaffordable === 'true') {
        // Shake animation for visual feedback
        cardEl.classList.add('card-shake');
        setTimeout(function() {
          cardEl.classList.remove('card-shake');
        }, 400);

        // Show MOK interjection with shortage info
        if (cardEl.dataset.resourceShortage && typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
          UIControls.updateMokInterjection('Cannot play: ' + cardEl.dataset.resourceShortage);
        }

        return; // Prevent selection
      }

      _toggleCardSelection(index);
    });

    // Touch handlers
    cardEl.addEventListener('touchend', function(e) {
      e.preventDefault();
      // Mark touch timestamp to suppress the follow-up synthetic click
      cardEl.dataset.lastTouchTs = String(Date.now());

      // Check if card is unaffordable
      if (cardEl.dataset.unaffordable === 'true') {
        cardEl.classList.add('card-shake');
        setTimeout(function() {
          cardEl.classList.remove('card-shake');
        }, 400);

        if (cardEl.dataset.resourceShortage && typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
          UIControls.updateMokInterjection('Cannot play: ' + cardEl.dataset.resourceShortage);
        }

        return;
      }

      _toggleCardSelection(index);
    });

    // Drag handlers for disposal system and commerce
    cardEl.addEventListener('dragstart', function(e) {
      // Check if shop is open for sell operations
      var isShopOpen = (typeof ShopSystem !== 'undefined' && ShopSystem.isOpen && ShopSystem.isOpen());

      if (isShopOpen && typeof CommerceDragDropSystem !== 'undefined') {
        // Commerce drag (sell to shop)
        CommerceDragDropSystem.handleDragStart({
          sourceZone: 'player_hand',
          itemId: card.id || ('card_' + index),
          itemType: 'card',
          cardData: card,
          itemPrice: 0  // Will be calculated by system
        });
        cardEl.classList.add('dragging-sell');
      } else if (typeof CardDisposalSystem !== 'undefined') {
        // Disposal drag (recycle/destroy)
        CardDisposalSystem.handleDragStart(cardEl, card, index, 'hand');
      }
    });

    cardEl.addEventListener('dragend', function(e) {
      cardEl.classList.remove('dragging-sell');

      // Check if shop is open
      var isShopOpen = (typeof ShopSystem !== 'undefined' && ShopSystem.isOpen && ShopSystem.isOpen());

      if (isShopOpen && typeof CommerceDragDropSystem !== 'undefined') {
        CommerceDragDropSystem.handleDragEnd();
      } else if (typeof CardDisposalSystem !== 'undefined') {
        CardDisposalSystem.handleDragEnd();
      }
    });

    // Hover tooltip — show card details immediately on mouseenter
    cardEl.addEventListener('mouseenter', function() {
      _showCardTooltip(card, cardEl);
    });

    cardEl.addEventListener('mouseleave', function() {
      _hideCardTooltip();
    });
  }

  /**
   * Toggle card selection
   * @param {number} index - Card index
   */
  function _toggleCardSelection(index) {
    var selectedIndex = _selectedCards.indexOf(index);

    if (selectedIndex !== -1) {
      // Deselect
      _selectedCards.splice(selectedIndex, 1);
    } else {
      // Select (max 5 cards)
      if (_selectedCards.length < 5) {
        _selectedCards.push(index);
      }
    }

    _renderCards();
  }

  /**
   * Show card tooltip
   * @param {Object} card - Card data
   * @param {HTMLElement} cardEl - Card element
   */
  function _showCardTooltip(card, cardEl) {
    // Create tooltip element if it doesn't exist
    var tooltip = document.getElementById('hand-card-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'hand-card-tooltip';
      tooltip.className = 'hand-card-tooltip';
      document.body.appendChild(tooltip);
    }

    // Build tooltip content
    var html = '';
    html += '<div class="tooltip-title">' + (card.name || 'Unknown Card') + '</div>';

    if (card.description) {
      html += '<div class="tooltip-description">' + card.description + '</div>';
    }

    html += '<div class="tooltip-stats">';
    if (card.cost !== undefined) {
      html += '<div class="tooltip-stat">Cost: <span>' + card.cost + '</span></div>';
    }
    if (card.damage !== undefined) {
      html += '<div class="tooltip-stat">Damage: <span>' + card.damage + '</span></div>';
    }
    if (card.qualityName) {
      html += '<div class="tooltip-stat">Quality: <span>' + card.qualityName + '</span></div>';
    }
    html += '</div>';

    tooltip.innerHTML = html;

    // Position tooltip near card
    var rect = cardEl.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - 10) + 'px';
    tooltip.style.transform = 'translate(-50%, -100%)';
    tooltip.style.display = 'block';
  }

  /**
   * Hide card tooltip
   */
  function _hideCardTooltip() {
    var tooltip = document.getElementById('hand-card-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  /**
   * Play selected cards (commit animation)
   */
  function playSelectedCards() {
    if (_selectedCards.length === 0) return;

    _animationPhase = 'commit';
    _isAnimating = true;

    // Commit animation: lift selected cards
    _animateCommit(function() {
      // Check for single-use/consumable cards and apply incinerator effect
      var selectedCardObjects = _selectedCards.map(function(index) {
        return _cards[index];
      });

      _animateIncinerator(selectedCardObjects, function() {
        // Resolve animation: fly to center
        _animateResolve(function() {
          // Notify game logic
          if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.executeMultiCardRound === 'function') {
            GoneRogue.executeMultiCardRound(selectedCardObjects);
          }

          // Repopulate animation will be triggered by updateCards call
          _selectedCards = [];
        });
      });
    });
  }

  /**
   * Animate incinerator effect for single-use cards
   * @param {Array} cards - Array of card objects
   * @param {Function} callback - Callback when animation completes
   */
  function _animateIncinerator(cards, callback) {
    var hasConsumables = false;

    // Check if any cards are consumable/disposable using helper function
    for (var i = 0; i < cards.length; i++) {
      var lifecycle = _getCardLifecycle(cards[i]);
      if (lifecycle === 'consumable') {
        hasConsumables = true;
        break;
      }
    }

    if (!hasConsumables) {
      // No consumables, proceed immediately
      if (callback) callback();
      return;
    }

    // Apply incinerator animation to consumable cards
    var cardElements = _fanContainer.querySelectorAll('.hand-card.hand-card-selected');
    var consumableCount = 0;

    for (var i = 0; i < cardElements.length; i++) {
      var cardEl = cardElements[i];
      var cardIndex = parseInt(cardEl.parentElement.dataset.cardIndex, 10);
      var card = _cards[cardIndex];
      var lifecycle = _getCardLifecycle(card);

      if (lifecycle === 'consumable') {
        cardEl.classList.add('card-incinerating');
        consumableCount++;
      }
    }

    // Wait for incinerator animation to complete
    var duration = consumableCount > 0 ? 600 : 0;
    setTimeout(function() {
      if (callback) callback();
    }, duration);
  }

  /**
   * Commit animation - lift selected cards
   * @param {Function} callback - Callback when animation completes
   */
  function _animateCommit(callback) {
    _fanContainer.classList.add('hand-fan-commit');

    setTimeout(function() {
      _fanContainer.classList.remove('hand-fan-commit');
      _animationPhase = 'resolve';
      if (callback) callback();
    }, 200);
  }

  /**
   * Resolve animation - cards fly to center and fade
   * @param {Function} callback - Callback when animation completes
   */
  function _animateResolve(callback) {
    _fanContainer.classList.add('hand-fan-resolve');

    // Duration varies by card count (800-1500ms)
    var duration = 800 + (_selectedCards.length * 140);

    setTimeout(function() {
      _fanContainer.classList.remove('hand-fan-resolve');
      _animationPhase = 'repopulate';
      _isAnimating = false;
      if (callback) callback();
    }, duration);
  }

  /**
   * Repopulate animation - new cards fade in from center
   */
  function repopulateCards(newCards) {
    _cards = newCards || [];
    _animationPhase = 'repopulate';

    _fanContainer.classList.add('hand-fan-repopulate');
    _renderCards();

    setTimeout(function() {
      _fanContainer.classList.remove('hand-fan-repopulate');
      _animationPhase = 'idle';
    }, 300);
  }

  /**
   * Get selected card indices
   * @returns {Array} Selected card indices
   */
  function getSelectedCards() {
    return _selectedCards.slice();
  }

  /**
   * Clear card selection
   */
  function clearSelection() {
    _selectedCards = [];
    _renderCards();
  }

  /**
   * Validate if player can afford a card
   * @param {Object} card - Card data
   * @returns {Object} {canAfford: boolean, missingResources: Array}
   */
  function _validateCardAffordability(card) {
    // Check if ResourceManager is available
    if (typeof ResourceManager === 'undefined') {
      // No resource manager, assume all cards are affordable
      return { canAfford: true, missingResources: [] };
    }

    // Use ResourceManager to check affordability
    return ResourceManager.canAffordCard(card);
  }

  /**
   * Format resource shortage for display
   * @param {Array} missingResources - Array of missing resource objects
   * @returns {string} Formatted shortage message
   */
  function _formatResourceShortage(missingResources) {
    if (!missingResources || missingResources.length === 0) {
      return '';
    }

    var parts = missingResources.map(function(r) {
      var resourceName = r.resource.charAt(0).toUpperCase() + r.resource.slice(1);
      return resourceName + ' (' + r.current + '/' + r.needed + ')';
    });

    return 'Insufficient ' + parts.join(', ');
  }

  /**
   * Refresh card affordability (call when resources change)
   */
  function refreshAffordability() {
    _renderCards();
  }

  /**
   * Check if the hand fan is currently visible
   * @returns {boolean}
   */
  function isVisible() {
    return _fanContainer !== null && _fanContainer.style.display !== 'none';
  }

  /**
   * Set contextual (non-combat) card selection
   * In contextual mode, only one card can be selected at a time
   * and it stays highlighted until used
   * @param {number} index - Card index to select
   */
  function selectContextualCard(index) {
    // Clear any previous selection
    _selectedCards = [];

    // Select the new card
    if (index >= 0 && index < _cards.length) {
      _selectedCards.push(index);
    }

    // Re-render to show selection
    _renderCards();

    // Add contextual selection class for different visual style
    if (_fanContainer) {
      _fanContainer.classList.add('hand-fan-contextual-mode');
    }
  }

  /**
   * Get the currently selected contextual card
   * @returns {Object|null} Selected card object or null
   */
  function getContextualCard() {
    if (_selectedCards.length > 0 && _cards[_selectedCards[0]]) {
      return _cards[_selectedCards[0]];
    }
    return null;
  }

  /**
   * Clear contextual selection and minimize hand
   * Called after card is used in contextual mode
   */
  function clearContextualSelection() {
    _selectedCards = [];

    // Remove contextual mode class
    if (_fanContainer) {
      _fanContainer.classList.remove('hand-fan-contextual-mode');
    }

    // Minimize the hand after card use
    minimize();

    // Re-render after a brief delay
    setTimeout(function() {
      _renderCards();
    }, 300);
  }

  /**
   * Check if in contextual mode
   * @returns {boolean} True if in contextual mode
   */
  function isContextualMode() {
    return _mode === 'contextual';
  }

  /**
   * Fallback abbreviation function if NameUtils not available
   * Removes vowels except first letter of each word
   * @param {string} name - Full name
   * @param {number} maxLength - Maximum length
   * @returns {string} Abbreviated name
   * @private
   */
  function _abbreviateCardName(name, maxLength) {
    if (!name) return '';

    var words = name.split(/\s+/);
    var result = '';

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (word.length === 0) continue;

      // Take first character of word (even if vowel)
      result += word.charAt(0);

      // Remove vowels from remaining characters
      for (var j = 1; j < word.length; j++) {
        var char = word.charAt(j);
        var lower = char.toLowerCase();
        if (lower !== 'a' && lower !== 'e' && lower !== 'i' && lower !== 'o' && lower !== 'u') {
          result += char;
        }
      }
    }

    return maxLength ? result.substring(0, maxLength) : result;
  }

  // Public API
  return {
    init: init,
    show: show,
    hide: hide,
    minimize: minimize,
    restore: restore,
    setMode: setMode,
    updateCards: updateCards,
    playSelectedCards: playSelectedCards,
    repopulateCards: repopulateCards,
    getSelectedCards: getSelectedCards,
    clearSelection: clearSelection,
    refreshAffordability: refreshAffordability,
    isVisible: isVisible,
    selectContextualCard: selectContextualCard,
    getContextualCard: getContextualCard,
    clearContextualSelection: clearContextualSelection,
    isContextualMode: isContextualMode
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    HandFanComponent.init();
  });
} else {
  HandFanComponent.init();
}
