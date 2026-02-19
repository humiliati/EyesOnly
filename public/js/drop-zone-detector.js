/* ============================================================
   EYES ONLY - Drop Zone Detector
   Proximity-based detection and visual feedback for drag targets
   ============================================================ */

const DropZoneDetector = (function() {
  'use strict';

  // Drop zone configurations
  var DROP_ZONE_CONFIGS = [
    {
      zoneId: 'hand-fan-container',
      zoneType: 'hand',
      priority: 1,
      glowColor: '#4CAF50',
      glowIntensity: 0.6,
      enabled: true,
      capacityCheck: function() {
        var state = GAMESTATE.getState();
        var hand = state.cardHand || [];
        return hand.length < 5;
      }
    },
    {
      zoneId: 'action-button-container',
      zoneType: 'action_bar',
      priority: 2,
      glowColor: '#2196F3',
      glowIntensity: 0.5,
      enabled: true,
      capacityCheck: function() {
        var state = GAMESTATE.getState();
        var actionBar = state.actionButtonCards || [];
        return actionBar.length < 4;
      }
    },
    {
      zoneId: 'inventory-grid',
      zoneType: 'inventory',
      priority: 3,
      glowColor: '#9C27B0',
      glowIntensity: 0.4,
      enabled: true,
      capacityCheck: function() {
        var inventory = GAMESTATE.getLooseInventory ? GAMESTATE.getLooseInventory() : [];
        return inventory.length < 12;
      }
    },
    {
      zoneId: 'active-item-slot',
      zoneType: 'equipment',
      priority: 4,
      glowColor: '#FF9800',
      glowIntensity: 0.4,
      enabled: true,
      capacityCheck: function() {
        // Equipment slot always available for now
        return true;
      }
    }
  ];

  // State
  var _activeZones = new Set();
  var _isDragging = false;
  var _dragType = null; // 'purchase' | 'sell'
  var _proximityBuffer = 20; // pixels

  /**
   * Initialize drop zone detector
   */
  function init() {
    console.log('[DropZoneDetector] Initialized');
  }

  /**
   * Start drag operation
   * @param {string} dragType - 'purchase' or 'sell'
   */
  function startDrag(dragType) {
    _isDragging = true;
    _dragType = dragType;

    // Add drag move listener
    document.addEventListener('dragover', _handleDragMove);
    document.addEventListener('touchmove', _handleTouchMove);
  }

  /**
   * End drag operation
   */
  function endDrag() {
    _isDragging = false;
    _dragType = null;

    // Deactivate all zones
    _activeZones.forEach(function(zoneId) {
      _deactivateZone(zoneId);
    });
    _activeZones.clear();

    // Remove listeners
    document.removeEventListener('dragover', _handleDragMove);
    document.removeEventListener('touchmove', _handleTouchMove);
  }

  /**
   * Handle drag move event
   * @param {Event} e - Drag event
   */
  function _handleDragMove(e) {
    if (!_isDragging) return;

    var x = e.clientX;
    var y = e.clientY;

    _updateZoneProximity(x, y);
  }

  /**
   * Handle touch move event
   * @param {Event} e - Touch event
   */
  function _handleTouchMove(e) {
    if (!_isDragging || !e.touches || e.touches.length === 0) return;

    var touch = e.touches[0];
    var x = touch.clientX;
    var y = touch.clientY;

    _updateZoneProximity(x, y);
  }

  /**
   * Update zone proximity based on cursor/touch position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  function _updateZoneProximity(x, y) {
    DROP_ZONE_CONFIGS.forEach(function(zone) {
      if (!zone.enabled) return;

      var zoneElement = document.getElementById(zone.zoneId);
      if (!zoneElement) return;

      // Skip if zone doesn't have capacity
      if (zone.capacityCheck && !zone.capacityCheck()) return;

      // Check if zone is visible
      var display = window.getComputedStyle(zoneElement).display;
      if (display === 'none') return;

      var rect = zoneElement.getBoundingClientRect();
      var isProximate = _isPointNearRect(x, y, rect, _proximityBuffer);

      if (isProximate) {
        _activateZone(zone.zoneId, zone.glowColor, zone.glowIntensity);
      } else {
        _deactivateZone(zone.zoneId);
      }
    });
  }

  /**
   * Check if point is near rectangle (with buffer)
   * @param {number} x - Point X
   * @param {number} y - Point Y
   * @param {DOMRect} rect - Rectangle bounds
   * @param {number} buffer - Buffer distance in pixels
   * @returns {boolean} True if point is near rect
   */
  function _isPointNearRect(x, y, rect, buffer) {
    return (
      x >= rect.left - buffer &&
      x <= rect.right + buffer &&
      y >= rect.top - buffer &&
      y <= rect.bottom + buffer
    );
  }

  /**
   * Activate drop zone glow
   * @param {string} zoneId - Zone ID
   * @param {string} color - Glow color
   * @param {number} intensity - Glow intensity
   */
  function _activateZone(zoneId, color, intensity) {
    if (_activeZones.has(zoneId)) return;

    _activeZones.add(zoneId);
    var element = document.getElementById(zoneId);
    if (!element) return;

    element.classList.add('drop-zone-active');
    element.style.boxShadow = '0 0 ' + (16 * intensity) + 'px ' + color +
                              ', inset 0 0 ' + (12 * intensity) + 'px ' + color;
    element.style.borderColor = color;
    element.style.transition = 'all 0.2s ease';
  }

  /**
   * Deactivate drop zone glow
   * @param {string} zoneId - Zone ID
   */
  function _deactivateZone(zoneId) {
    if (!_activeZones.has(zoneId)) return;

    _activeZones.delete(zoneId);
    var element = document.getElementById(zoneId);
    if (!element) return;

    element.classList.remove('drop-zone-active');
    element.style.boxShadow = '';
    element.style.borderColor = '';
  }

  /**
   * Get available destination for drag preview hint
   * @returns {string} Destination hint ('hand', 'action bar', 'inventory', 'equipment')
   */
  function getAvailableDestination() {
    // Check capacity in priority order
    for (var i = 0; i < DROP_ZONE_CONFIGS.length; i++) {
      var zone = DROP_ZONE_CONFIGS[i];
      if (zone.enabled && zone.capacityCheck && zone.capacityCheck()) {
        return zone.zoneType === 'action_bar' ? 'action bar' : zone.zoneType;
      }
    }
    return 'debrief'; // Fallback to catch-all
  }

  /**
   * Get glow color for destination type
   * @param {string} destinationType - Type of destination
   * @returns {string} Hex color
   */
  function getGlowColorForDestination(destinationType) {
    for (var i = 0; i < DROP_ZONE_CONFIGS.length; i++) {
      var zone = DROP_ZONE_CONFIGS[i];
      var zoneTypeName = zone.zoneType === 'action_bar' ? 'action bar' : zone.zoneType;
      if (zoneTypeName === destinationType) {
        return zone.glowColor;
      }
    }
    return '#FFD700'; // Default gold
  }

  // Public API
  return {
    init: init,
    startDrag: startDrag,
    endDrag: endDrag,
    getAvailableDestination: getAvailableDestination,
    getGlowColorForDestination: getGlowColorForDestination
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    DropZoneDetector.init();
  });
} else {
  DropZoneDetector.init();
}
