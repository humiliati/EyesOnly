/* ============================================================
   EYES ONLY - Tooltip Thumb System
   Frameless emoji-rich feedback popups over player/NPC heads
   Integrates with continuous movement and expression database
   ============================================================ */

const TooltipThumb = (function() {
  'use strict';

  // Configuration
  var TOOLTIP_OFFSET_Y = -30; // Pixels above entity
  var TOOLTIP_FADE_IN = 150; // ms
  var TOOLTIP_FADE_OUT = 200; // ms
  var DEFAULT_DURATION = 2000; // ms
  var THOUGHT_DURATION = 3000; // ms for thought bubbles
  var ALERT_DURATION = 1500; // ms for alerts

  // Active tooltips tracked by entity ID
  var _activeTooltips = {}; // key: entityId, value: tooltip data
  var _tooltipElements = {}; // key: entityId, value: DOM element
  var _renderContainer = null;

  /**
   * Initialize tooltip thumb system
   * @param {HTMLElement} container - Container for rendering tooltips (usually canvas overlay)
   */
  function init(container) {
    _renderContainer = container || document.body;
    _activeTooltips = {};
    _tooltipElements = {};
    console.log('[TooltipThumb] Initialized');
  }

  /**
   * Show thought bubble over entity
   * @param {string} entityId - Unique entity identifier
   * @param {string} thoughtContext - Context key from ExpressionDatabase.THOUGHT_EMOJIS
   * @param {Object} position - {x, y} world position (can be float for continuous movement)
   * @param {number} duration - Optional custom duration
   */
  function showThought(entityId, thoughtContext, position, duration) {
    var thought = ExpressionDatabase.getThoughtEmoji(thoughtContext);
    if (!thought) {
      console.warn('[TooltipThumb] Unknown thought context:', thoughtContext);
      return;
    }

    var tooltip = {
      type: 'thought',
      emoji: thought.emoji,
      text: thought.text,
      position: position,
      startTime: Date.now(),
      duration: duration || THOUGHT_DURATION,
      entityId: entityId
    };

    _showTooltip(entityId, tooltip);
  }

  /**
   * Show alert popup over entity
   * @param {string} entityId - Unique entity identifier
   * @param {string} alertType - Alert type from ExpressionDatabase.ALERT_EMOJIS
   * @param {Object} position - {x, y} world position
   * @param {string} message - Optional additional message text
   * @param {number} duration - Optional custom duration
   */
  function showAlert(entityId, alertType, position, message, duration) {
    var alert = ExpressionDatabase.getAlertEmoji(alertType);
    if (!alert) {
      console.warn('[TooltipThumb] Unknown alert type:', alertType);
      return;
    }

    var tooltip = {
      type: 'alert',
      emoji: alert.emoji,
      text: message || '',
      color: alert.color,
      position: position,
      startTime: Date.now(),
      duration: duration || ALERT_DURATION,
      entityId: entityId,
      animation: {
        shake: alert.shake,
        pulse: alert.pulse,
        flash: alert.flash,
        bounce: alert.bounce
      }
    };

    _showTooltip(entityId, tooltip);
  }

  /**
   * Show status glyph over entity
   * @param {string} entityId - Unique entity identifier
   * @param {string} glyphKey - Glyph key from ExpressionDatabase.STATUS_GLYPHS
   * @param {Object} position - {x, y} world position
   * @param {number} duration - Optional custom duration
   */
  function showStatusGlyph(entityId, glyphKey, position, duration) {
    var glyph = ExpressionDatabase.getStatusGlyph(glyphKey);
    if (!glyph) {
      console.warn('[TooltipThumb] Unknown status glyph:', glyphKey);
      return;
    }

    var tooltip = {
      type: 'status_glyph',
      glyph: glyph.glyph,
      text: glyph.desc,
      color: glyph.color,
      position: position,
      startTime: Date.now(),
      duration: duration || DEFAULT_DURATION,
      entityId: entityId
    };

    _showTooltip(entityId, tooltip);
  }

  /**
   * Show food item popup over entity (for consumption or consideration)
   * @param {string} entityId - Unique entity identifier
   * @param {string} foodKey - Food key from ExpressionDatabase.FOOD_ITEMS
   * @param {Object} position - {x, y} world position
   * @param {string} action - Action type: 'pickup', 'consume', 'consider'
   * @param {number} duration - Optional custom duration
   */
  function showFoodPopup(entityId, foodKey, position, action, duration) {
    var food = ExpressionDatabase.getFoodItem(foodKey);
    if (!food) {
      console.warn('[TooltipThumb] Unknown food item:', foodKey);
      return;
    }

    var text = '';
    switch (action) {
      case 'pickup':
        text = '+' + food.name;
        break;
      case 'consume':
        text = food.name + ' ❤️+' + food.heal + ' ⚡+' + food.energy;
        break;
      case 'consider':
        text = food.name + '?';
        break;
      default:
        text = food.name;
    }

    var tooltip = {
      type: 'food',
      emoji: food.emoji,
      text: text,
      position: position,
      startTime: Date.now(),
      duration: duration || DEFAULT_DURATION,
      entityId: entityId,
      foodData: food
    };

    _showTooltip(entityId, tooltip);
  }

  /**
   * Show custom tooltip with emoji and text
   * @param {string} entityId - Unique entity identifier
   * @param {string} emoji - Emoji to display
   * @param {string} text - Text to display
   * @param {Object} position - {x, y} world position
   * @param {Object} options - Optional styling {color, duration, animation}
   */
  function showCustom(entityId, emoji, text, position, options) {
    options = options || {};

    var tooltip = {
      type: 'custom',
      emoji: emoji,
      text: text,
      color: options.color || '#ffffff',
      position: position,
      startTime: Date.now(),
      duration: options.duration || DEFAULT_DURATION,
      entityId: entityId,
      animation: options.animation || {}
    };

    _showTooltip(entityId, tooltip);
  }

  /**
   * Internal: Show tooltip (create or update DOM element)
   */
  function _showTooltip(entityId, tooltipData) {
    // Store tooltip data
    _activeTooltips[entityId] = tooltipData;

    // Create or update DOM element
    var element = _tooltipElements[entityId];
    if (!element) {
      element = document.createElement('div');
      element.className = 'tooltip-thumb';
      element.style.position = 'absolute';
      element.style.pointerEvents = 'none';
      element.style.zIndex = '1000';
      element.style.transition = 'opacity ' + TOOLTIP_FADE_IN + 'ms ease-in';
      element.style.opacity = '0';
      _renderContainer.appendChild(element);
      _tooltipElements[entityId] = element;
    }

    // Build tooltip content
    var html = '<div class="tooltip-thumb-content">';

    if (tooltipData.type === 'status_glyph') {
      // Use text glyph (^__^, @__@, etc.)
      html += '<span class="tooltip-glyph" style="color: ' + tooltipData.color + '">';
      html += tooltipData.glyph;
      html += '</span>';
    } else {
      // Use emoji
      html += '<span class="tooltip-emoji">' + tooltipData.emoji + '</span>';
    }

    if (tooltipData.text) {
      html += '<span class="tooltip-text">' + tooltipData.text + '</span>';
    }

    html += '</div>';
    element.innerHTML = html;

    // Position tooltip
    _updateTooltipPosition(entityId, tooltipData.position);

    // Apply animation classes
    element.className = 'tooltip-thumb tooltip-' + tooltipData.type;
    if (tooltipData.animation) {
      if (tooltipData.animation.shake) element.classList.add('tooltip-shake');
      if (tooltipData.animation.pulse) element.classList.add('tooltip-pulse');
      if (tooltipData.animation.flash) element.classList.add('tooltip-flash');
      if (tooltipData.animation.bounce) element.classList.add('tooltip-bounce');
    }

    // Fade in
    setTimeout(function() {
      element.style.opacity = '1';
    }, 10);

    // Schedule auto-clear
    setTimeout(function() {
      clearTooltip(entityId);
    }, tooltipData.duration);

    console.log('[TooltipThumb] Showing ' + tooltipData.type + ' for entity:', entityId);
  }

  /**
   * Update tooltip position (for continuous movement)
   * @param {string} entityId - Entity identifier
   * @param {Object} position - {x, y} world position (can be float)
   */
  function updatePosition(entityId, position) {
    var tooltipData = _activeTooltips[entityId];
    if (!tooltipData) return;

    tooltipData.position = position;
    _updateTooltipPosition(entityId, position);
  }

  /**
   * Internal: Update DOM element position based on world coordinates
   */
  function _updateTooltipPosition(entityId, position) {
    var element = _tooltipElements[entityId];
    if (!element) return;

    // Convert world position to screen position
    // This assumes we have access to a camera/viewport transform function
    // For now, using simple pixel-based positioning
    var screenPos = _worldToScreen(position);

    element.style.left = screenPos.x + 'px';
    element.style.top = (screenPos.y + TOOLTIP_OFFSET_Y) + 'px';
    element.style.transform = 'translate(-50%, -100%)'; // Center horizontally, align above position
  }

  /**
   * Convert world coordinates to screen coordinates
   * This should be customized based on the game's camera/viewport system
   */
  function _worldToScreen(worldPos) {
    // Placeholder: assumes direct pixel mapping
    // In a real implementation, this would use the camera transform
    // from gone-rogue.js or gone-rogue-mobile.js

    // Try to get tile size from game if available
    var tileSize = 32; // Default
    if (typeof GoneRogue !== 'undefined' && GoneRogue.getTileSize) {
      tileSize = GoneRogue.getTileSize();
    }

    return {
      x: worldPos.x * tileSize,
      y: worldPos.y * tileSize
    };
  }

  /**
   * Set custom world-to-screen transform function
   * @param {function} transformFn - Function that takes {x, y} world coords and returns {x, y} screen coords
   */
  function setWorldToScreenTransform(transformFn) {
    _worldToScreen = transformFn;
  }

  /**
   * Clear tooltip for entity
   * @param {string} entityId - Entity identifier
   */
  function clearTooltip(entityId) {
    var element = _tooltipElements[entityId];
    if (!element) return;

    // Fade out
    element.style.transition = 'opacity ' + TOOLTIP_FADE_OUT + 'ms ease-out';
    element.style.opacity = '0';

    // Remove after fade
    setTimeout(function() {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      delete _tooltipElements[entityId];
      delete _activeTooltips[entityId];
    }, TOOLTIP_FADE_OUT);

    console.log('[TooltipThumb] Cleared tooltip for entity:', entityId);
  }

  /**
   * Clear all tooltips
   */
  function clearAll() {
    for (var entityId in _tooltipElements) {
      clearTooltip(entityId);
    }
  }

  /**
   * Update all tooltip positions (call this in game loop for continuous movement)
   * @param {Object} entityPositions - Map of entityId to {x, y} positions
   */
  function updateAll(entityPositions) {
    for (var entityId in _activeTooltips) {
      if (entityPositions[entityId]) {
        updatePosition(entityId, entityPositions[entityId]);
      }
    }
  }

  /**
   * Get active tooltip for entity
   * @param {string} entityId - Entity identifier
   * @returns {Object} Tooltip data or null
   */
  function getTooltip(entityId) {
    return _activeTooltips[entityId] || null;
  }

  /**
   * Check if entity has active tooltip
   * @param {string} entityId - Entity identifier
   * @returns {boolean}
   */
  function hasTooltip(entityId) {
    return entityId in _activeTooltips;
  }

  // Public API
  return {
    init: init,
    showThought: showThought,
    showAlert: showAlert,
    showStatusGlyph: showStatusGlyph,
    showFoodPopup: showFoodPopup,
    showCustom: showCustom,
    updatePosition: updatePosition,
    updateAll: updateAll,
    clearTooltip: clearTooltip,
    clearAll: clearAll,
    getTooltip: getTooltip,
    hasTooltip: hasTooltip,
    setWorldToScreenTransform: setWorldToScreenTransform
  };
})();
