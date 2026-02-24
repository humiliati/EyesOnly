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
   * Get resource-specific color
   * Each resource has its own unique color identity (not percentage-based)
   * @param {string} resourceName - Name of the resource
   * @returns {string} Hex color code
   */
  function _getResourceColor(resourceName) {
    var colors = {
      'HP': '#FF6B9D',           // Vibrant health pink
      'Energy': '#00D4FF',       // Electric blue cyan
      'Focus': '#FFF9B0',        // Bright yellow-white
      'Battery': '#00FFA6',      // Sickly green-cyan
      'Fatigue': '#A0522D',      // Earthy brown
      'Ammo': '#DA70D6'          // Magenta-purple (special ammo flow)
    };

    return colors[resourceName] || '#FFFFFF';  // Default to white if unknown
  }

  /**
   * Render a resource bar
   * @param {string} name - Resource name
   * @param {number} current - Current value
   * @param {number} max - Maximum value
   * @param {string} icon - Emoji icon
   * @param {boolean} isHP - Whether this is HP (not used for coloring anymore)
   * @returns {string} HTML
   */
  function _renderResourceBar(name, current, max, icon, isHP) {
    var percentage = current / max;
    var filledBars = Math.round(percentage * 10);
    var emptyBars = 10 - filledBars;

    // Use resource-specific color (not percentage-based)
    var barColor = _getResourceColor(name);

    var html = '<div class="resource-row" data-resource="' + name + '">';
    html += '<span class="resource-icon">' + icon + '</span>';
    html += '<span class="resource-name">' + name + '</span>';
    html += '<div class="resource-bar-container">';
    html += '<span class="resource-bar-filled" style="color: ' + barColor + '; text-shadow: 0 0 4px ' + barColor + '80">';
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
      cycleBtn.addEventListener('click', function(e) {
        // Prevent debrief-window click-to-expand from hijacking resource UI clicks
        if (e && e.stopPropagation) e.stopPropagation();
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

  /**
   * Render into a specific element (used by DebriefFeedController)
   * @param {HTMLElement} targetElement - Element to render into
   */
  function renderInto(targetElement) {
    var savedScreen = _debriefScreen;
    _debriefScreen = targetElement;
    try {
      render();
    } finally {
      _debriefScreen = savedScreen;
    }
  }

  // Public API
  return {
    init: init,
    render: render,
    renderInto: renderInto,
    refresh: refresh,
    cycle: cycle,
    toggleExpanded: toggleExpanded
  };
})();

// Auto-initialize when DOM is ready (unless controller will handle it)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    // Only auto-init if DebriefFeedController is not present
    if (typeof DebriefFeedController === 'undefined') {
      DebriefFeedRenderer.init();
    }
  });
} else {
  // Only auto-init if DebriefFeedController is not present
  setTimeout(function() {
    if (typeof DebriefFeedController === 'undefined') {
      DebriefFeedRenderer.init();
    }
  }, 100);
}
