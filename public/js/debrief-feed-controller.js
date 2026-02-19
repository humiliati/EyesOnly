/* ============================================================
   EYES ONLY - Debrief Feed Controller
   Manages MOK vs Resource Feed display based on game mode
   ============================================================ */

const DebriefFeedController = (function() {
  'use strict';

  /**
   * @typedef {Object} GameMode
   * @property {string} name - Mode name
   * @property {string} defaultDisplay - 'mok' or 'resources'
   * @property {boolean} allowCycle - Whether cycle button is shown
   * @property {boolean} videoOverride - Whether video takes priority
   */

  var _currentMode = null;
  var _currentDisplay = 'mok'; // 'mok', 'resources', or 'video'
  var _debriefScreen = null;
  var _mokInitialized = false;
  var _videoPlaying = false;

  /**
   * Game mode configurations
   */
  var MODES = {
    goneRogue: {
      name: 'Gone Rogue',
      defaultDisplay: 'resources',
      allowCycle: true,
      videoOverride: false
    },
    streetChronicles: {
      name: 'Street Chronicles',
      defaultDisplay: 'mok',
      allowCycle: true,
      videoOverride: true
    },
    eyesOnlyARG: {
      name: 'EyesOnly ARG',
      defaultDisplay: 'mok',
      allowCycle: true,
      videoOverride: true
    },
    mainMenu: {
      name: 'Main Menu',
      defaultDisplay: 'mok',
      allowCycle: false,
      videoOverride: true
    }
  };

  /**
   * Initialize the controller
   */
  function init() {
    _debriefScreen = document.getElementById('debrief-screen');
    if (!_debriefScreen) {
      console.warn('[DebriefFeedController] Debrief screen not found');
      return;
    }

    // Detect initial game mode
    _currentMode = _detectGameMode();
    _currentDisplay = _currentMode.defaultDisplay;

    // Initialize display
    _render();
  }

  /**
   * Detect current game mode
   * @returns {GameMode}
   */
  function _detectGameMode() {
    var body = document.body;

    // Check for Gone Rogue mode
    if (body.classList.contains('mode-gone-rogue') || 
        body.classList.contains('in-gone-rogue')) {
      return MODES.goneRogue;
    }

    // Check for Street Chronicles (placeholder check)
    if (body.classList.contains('mode-street-chronicles')) {
      return MODES.streetChronicles;
    }

    // Check for EyesOnly ARG (placeholder check)
    if (body.classList.contains('mode-eyesonly-arg')) {
      return MODES.eyesOnlyARG;
    }

    // Default to main menu
    return MODES.mainMenu;
  }

  /**
   * Render current display
   */
  function _render() {
    if (!_debriefScreen) return;

    // Check for video override
    if (_videoPlaying && _currentMode.videoOverride) {
      _currentDisplay = 'video';
      _renderVideo();
      return;
    }

    // Render based on current display mode
    if (_currentDisplay === 'mok') {
      _renderMOK();
    } else if (_currentDisplay === 'resources') {
      _renderResources();
    }
  }

  /**
   * Render MOK display
   */
  function _renderMOK() {
    var html = '<div class="debrief-mok-display">';
    
    // MOK visual container
    html += '<div id="mok-visual-container" class="mok-visual-container"></div>';
    
    // MOK interjection area (existing system)
    html += '<div id="mok-interjection" class="mok-interjection"></div>';

    // Kernel API status (if in Gone Rogue)
    if (_currentMode === MODES.goneRogue) {
      html += _renderKernelStatus();
    }

    // Cycle button (if allowed)
    if (_currentMode.allowCycle) {
      html += _renderCycleButton('Show Resources');
    }

    html += '</div>';

    _debriefScreen.innerHTML = html;

    // Initialize MOK visual engine
    if (!_mokInitialized) {
      setTimeout(function() {
        var container = document.getElementById('mok-visual-container');
        if (container) {
          MOKVisualEngine.init(container);
          MOKStateMachine.init(MOKVisualEngine);
          _mokInitialized = true;
        }
      }, 100);
    }

    _attachEventHandlers();
  }

  /**
   * Render resources display
   */
  function _renderResources() {
    // Use existing DebriefFeedRenderer
    if (typeof DebriefFeedRenderer !== 'undefined') {
      var html = '<div class="debrief-resources-display">';
      
      // Render resources using existing renderer
      html += '<div id="debrief-resources-content"></div>';

      // Add cycle button to switch to MOK (if in Gone Rogue)
      if (_currentMode === MODES.goneRogue && _currentMode.allowCycle) {
        html += _renderCycleButton('Show MOK');
      }

      html += '</div>';

      _debriefScreen.innerHTML = html;

      // Render resources into content area
      setTimeout(function() {
        var contentArea = document.getElementById('debrief-resources-content');
        if (contentArea && DebriefFeedRenderer) {
          // Temporarily replace debrief screen with content area
          var originalScreen = _debriefScreen;
          _debriefScreen = contentArea;
          DebriefFeedRenderer.render();
          _debriefScreen = originalScreen;
        }
      }, 100);
    }

    _attachEventHandlers();
  }

  /**
   * Render video display
   */
  function _renderVideo() {
    // Video takes full priority
    // Placeholder implementation
    var html = '<div class="debrief-video-display">';
    html += '<div class="video-player-container">';
    html += '<p>Video player would display here</p>';
    html += '</div>';
    html += '</div>';

    _debriefScreen.innerHTML = html;
  }

  /**
   * Render kernel API status
   * @returns {string} HTML
   */
  function _renderKernelStatus() {
    // TODO: Connect to actual kernel API system
    var status = 'connected'; // 'connected', 'disconnected', 'error'
    var statusIcon = status === 'connected' ? '🟢' : status === 'disconnected' ? '🔴' : '🟡';
    var statusText = status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Disconnected' : 'Error';

    var html = '<div class="kernel-api-status">';
    html += '<span class="kernel-icon">' + statusIcon + '</span>';
    html += '<span class="kernel-text">Kernel API: ' + statusText + '</span>';
    html += '</div>';

    return html;
  }

  /**
   * Render cycle button
   * @param {string} label - Button label
   * @returns {string} HTML
   */
  function _renderCycleButton(label) {
    var html = '<div class="debrief-cycle-button" id="debrief-cycle-btn">';
    html += '<span class="cycle-icon">◀▶</span>';
    html += '<span class="cycle-text">' + label + '</span>';
    html += '</div>';
    return html;
  }

  /**
   * Attach event handlers
   */
  function _attachEventHandlers() {
    var cycleBtn = document.getElementById('debrief-cycle-btn');
    if (cycleBtn) {
      cycleBtn.addEventListener('click', function() {
        toggleDisplay();
      });
    }
  }

  /**
   * Toggle between MOK and resources
   */
  function toggleDisplay() {
    if (_currentDisplay === 'mok') {
      _currentDisplay = 'resources';
    } else {
      _currentDisplay = 'mok';
    }

    _render();
  }

  /**
   * Set game mode
   * @param {string} modeName - Mode name (goneRogue, streetChronicles, etc.)
   */
  function setMode(modeName) {
    if (MODES[modeName]) {
      _currentMode = MODES[modeName];
      _currentDisplay = _currentMode.defaultDisplay;
      _render();
    }
  }

  /**
   * Set video playing state
   * @param {boolean} playing
   */
  function setVideoPlaying(playing) {
    _videoPlaying = playing;
    _render();
  }

  /**
   * Refresh display
   */
  function refresh() {
    _render();
  }

  /**
   * Get current display mode
   */
  function getCurrentDisplay() {
    return _currentDisplay;
  }

  /**
   * Trigger MOK event
   * @param {string} eventType - Event type
   * @param {*} eventData - Event data
   */
  function triggerMOKEvent(eventType, eventData) {
    if (_mokInitialized && MOKStateMachine) {
      MOKStateMachine.handleEvent({
        type: eventType,
        data: eventData
      });
    }
  }

  /**
   * Set MOK expression directly (API hook for agents)
   * @param {string} expression - Expression name (idle, talking, warning, happy, error, etc.)
   * @param {Object} options - Optional color and timing overrides
   */
  function setMOKExpression(expression, options) {
    if (!_mokInitialized || !MOKVisualEngine) {
      return;
    }
    
    MOKVisualEngine.setExpression(expression, options);
  }

  /**
   * Set custom MOK glow colors (API hook for agents)
   * @param {string} primaryColor - Primary glow color (hex)
   * @param {string} secondaryColor - Secondary glow color (hex)
   * @param {number} pulseSpeed - Pulse speed in ms (optional)
   */
  function setMOKGlowColors(primaryColor, secondaryColor, pulseSpeed) {
    if (!_mokInitialized || !MOKVisualEngine) {
      return;
    }
    
    MOKVisualEngine.setCustomGlowColors(primaryColor, secondaryColor, pulseSpeed);
  }

  /**
   * Get current MOK glow colors
   */
  function getMOKGlowColors() {
    if (!_mokInitialized || !MOKVisualEngine || !MOKVisualEngine.getCurrentGlowColors) {
      return null;
    }
    
    return MOKVisualEngine.getCurrentGlowColors();
  }

  /**
   * Report resource change in debrief feed
   * @param {string} resourceType - Type of resource (ammo, energy, etc.)
   * @param {number} oldValue - Previous value
   * @param {number} newValue - New value
   * @param {string} reason - Reason for change (e.g., "Card Played: Grenade")
   */
  function reportResourceChange(resourceType, oldValue, newValue, reason) {
    // Update MOK interjection with resource change
    var change = newValue - oldValue;
    var changeIcon = change >= 0 ? '▲' : '▼';
    var changeColor = change >= 0 ? '#1cff9b' : '#ff4444';
    
    var message = resourceType.toUpperCase() + ' ' + changeIcon + ' ';
    message += oldValue + ' → ' + newValue;
    
    if (reason) {
      message += ' (' + reason + ')';
    }

    // Show in MOK interjection
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      UIControls.updateMokInterjection(message);
    }

    // If in resource display mode, refresh to show updated values
    if (_currentDisplay === 'resources' && typeof DebriefFeedRenderer !== 'undefined') {
      DebriefFeedRenderer.render();
    }
  }

  /**
   * Report card played in debrief feed
   * @param {Object} card - Card that was played
   * @param {Object} resourceChanges - Object with resource changes {ammo: -2, energy: -3, etc.}
   */
  function reportCardPlayed(card, resourceChanges) {
    var message = '🎴 CARD PLAYED: ' + card.name;
    
    // Add resource cost details
    if (resourceChanges && Object.keys(resourceChanges).length > 0) {
      var costs = [];
      for (var resource in resourceChanges) {
        if (resourceChanges[resource] < 0) {
          costs.push(resource.toUpperCase() + ' ' + Math.abs(resourceChanges[resource]));
        }
      }
      if (costs.length > 0) {
        message += ' (Cost: ' + costs.join(', ') + ')';
      }
    }

    // Show in MOK interjection
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      UIControls.updateMokInterjection(message);
    }

    // Report individual resource changes
    if (resourceChanges) {
      for (var resource in resourceChanges) {
        var change = resourceChanges[resource];
        if (change !== 0) {
          // Get current value from GAMESTATE
          var currentValue = 0;
          if (typeof GAMESTATE !== 'undefined') {
            if (resource === 'ammo') currentValue = GAMESTATE.getAmmo();
            else if (resource === 'energy') currentValue = GAMESTATE.getEnergy();
            else if (resource === 'focus') currentValue = GAMESTATE.getFocus();
            else if (resource === 'battery') currentValue = GAMESTATE.getBattery();
            else if (resource === 'fatigue') currentValue = GAMESTATE.getFatigue();
          }
          
          reportResourceChange(resource, currentValue - change, currentValue, 'Card: ' + card.name);
        }
      }
    }
  }

  // Public API
  return {
    init: init,
    toggleDisplay: toggleDisplay,
    setMode: setMode,
    setVideoPlaying: setVideoPlaying,
    refresh: refresh,
    getCurrentDisplay: getCurrentDisplay,
    triggerMOKEvent: triggerMOKEvent,
    setMOKExpression: setMOKExpression,
    setMOKGlowColors: setMOKGlowColors,
    getMOKGlowColors: getMOKGlowColors,
    reportResourceChange: reportResourceChange,
    reportCardPlayed: reportCardPlayed
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    DebriefFeedController.init();
  });
} else {
  DebriefFeedController.init();
}
