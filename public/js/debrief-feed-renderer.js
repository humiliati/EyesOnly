/* ============================================================
   EYES ONLY - Debrief Feed Renderer
   Resource display with cycling and status effects
   ============================================================ */

const DebriefFeedRenderer = (function() {
  'use strict';

  // Configuration
  var _cycleMode = 'primary';  // 'primary', 'secondary'
  var _isExpanded = false;
  var _debriefScreen = null;

  /**
   * Initialize the debrief feed renderer
   */
  function init() {
    _debriefScreen = document.getElementById('debrief-screen');
    if (!_debriefScreen) {
      console.warn('[DebriefFeedRenderer] Debrief screen not found');
      return;
    }

    render();
  }

  /**
   * Render the debrief feed content
   */
  function render() {
    if (!_debriefScreen) return;

    var resources = _getResources();
    var html = '';

    html += '<div class="debrief-feed-content">';
    
    if (_cycleMode === 'primary') {
      html += _renderPrimaryResources(resources);
    } else {
      html += _renderSecondaryResources(resources);
    }

    html += _renderCycleButton();

    if (_isExpanded) {
      html += _renderExpandedContent(resources);
    }

    html += '</div>';

    _debriefScreen.innerHTML = html;
    _attachEventHandlers();
  }

  /**
   * Get current resources from GAMESTATE
   * @returns {Object} Resource data
   */
  function _getResources() {
    if (typeof GAMESTATE === 'undefined') {
      return _getMockResources();
    }

    var state = GAMESTATE.getState();
    
    return {
      // Primary resources
      hp: state.playerHP || 12,
      maxHp: state.maxPlayerHP || 12,
      energy: GAMESTATE.getEnergy ? GAMESTATE.getEnergy() : 5,
      maxEnergy: state.maxEnergy || 5,
      focus: GAMESTATE.getFocus ? GAMESTATE.getFocus() : 10,
      maxFocus: state.maxFocus || 10,
      
      // Secondary resources
      battery: GAMESTATE.getBattery ? GAMESTATE.getBattery() : 5,
      maxBattery: state.maxBattery || 5,
      fatigue: GAMESTATE.getFatigue ? GAMESTATE.getFatigue() : 0,
      maxFatigue: state.maxFatigue || 100,
      ammo: GAMESTATE.getAmmo ? GAMESTATE.getAmmo() : 30,
      maxAmmo: state.maxAmmo || 50
    };
  }

  /**
   * Get mock resources for testing
   * @returns {Object} Mock resource data
   */
  function _getMockResources() {
    return {
      hp: 12, maxHp: 12,
      energy: 3, maxEnergy: 5,
      focus: 4, maxFocus: 10,
      battery: 2, maxBattery: 5,
      fatigue: 3, maxFatigue: 10,
      ammo: 15, maxAmmo: 50
    };
  }

  /**
   * Render primary resources (HP, Energy, Focus)
   * @param {Object} resources - Resource data
   * @returns {string} HTML
   */
  function _renderPrimaryResources(resources) {
    var html = '<div class="resource-section primary">';
    
    html += _renderResourceBar('HP', resources.hp, resources.maxHp, '💖', true);
    html += _renderResourceBar('Energy', resources.energy, resources.maxEnergy, '⚡', false);
    html += _renderResourceBar('Focus', resources.focus, resources.maxFocus, '🎯', false);
    
    html += '</div>';
    return html;
  }

  /**
   * Render secondary resources (Battery, Fatigue, Ammo)
   * @param {Object} resources - Resource data
   * @returns {string} HTML
   */
  function _renderSecondaryResources(resources) {
    var html = '<div class="resource-section secondary">';
    
    html += _renderResourceBar('Battery', resources.battery, resources.maxBattery, '🔋', false);
    html += _renderResourceBar('Fatigue', resources.fatigue, resources.maxFatigue, '🏋️', false);
    html += _renderResourceBar('Ammo', resources.ammo, resources.maxAmmo, '🔫', false);
    
    html += '</div>';
    return html;
  }

  /**
   * Render a resource bar
   * @param {string} name - Resource name
   * @param {number} current - Current value
   * @param {number} max - Maximum value
   * @param {string} icon - Emoji icon
   * @param {boolean} isHP - Whether this is HP (special coloring)
   * @returns {string} HTML
   */
  function _renderResourceBar(name, current, max, icon, isHP) {
    var percentage = current / max;
    var filledBars = Math.round(percentage * 10);
    var emptyBars = 10 - filledBars;
    
    // Color based on percentage
    var barColor = '#4CAF50';  // Green
    if (percentage < 0.3) barColor = '#F44336';  // Red
    else if (percentage < 0.6) barColor = '#FF9800';  // Orange
    
    // HP uses different color scheme
    if (isHP) {
      if (percentage < 0.3) barColor = '#F44336';  // Red
      else if (percentage < 0.6) barColor = '#FFA726';  // Orange  
      else barColor = '#66BB6A';  // Green
    }

    var html = '<div class="resource-row">';
    html += '<span class="resource-icon">' + icon + '</span>';
    html += '<span class="resource-name">' + name + '</span>';
    html += '<div class="resource-bar-container">';
    html += '<span class="resource-bar-filled" style="color: ' + barColor + '">';
    html += '█'.repeat(filledBars) + '░'.repeat(emptyBars);
    html += '</span>';
    html += '</div>';
    html += '<span class="resource-value">(' + current + '/' + max + ')</span>';
    html += '</div>';

    return html;
  }

  /**
   * Render cycle button
   * @returns {string} HTML
   */
  function _renderCycleButton() {
    var html = '<div class="resource-cycle-button" id="resource-cycle-btn">';
    html += '<span class="cycle-icon">◀▶</span>';
    html += '<span class="cycle-text">';
    html += _cycleMode === 'primary' ? 'More resources' : 'Primary resources';
    html += '</span>';
    html += '</div>';
    return html;
  }

  /**
   * Render expanded content (not currently used)
   * @param {Object} resources - Resource data
   * @returns {string} HTML
   */
  function _renderExpandedContent(resources) {
    // Placeholder for status effects, stealth, etc.
    return '';
  }

  /**
   * Attach event handlers
   */
  function _attachEventHandlers() {
    var cycleBtn = document.getElementById('resource-cycle-btn');
    if (cycleBtn) {
      cycleBtn.addEventListener('click', function() {
        cycle();
      });
    }
  }

  /**
   * Cycle between primary and secondary resources
   */
  function cycle() {
    _cycleMode = _cycleMode === 'primary' ? 'secondary' : 'primary';
    render();
  }

  /**
   * Refresh display (call when resources change)
   */
  function refresh() {
    render();
  }

  /**
   * Toggle expanded mode
   */
  function toggleExpanded() {
    _isExpanded = !_isExpanded;
    render();
  }

  // Public API
  return {
    init: init,
    render: render,
    refresh: refresh,
    cycle: cycle,
    toggleExpanded: toggleExpanded
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    DebriefFeedRenderer.init();
  });
} else {
  DebriefFeedRenderer.init();
}
