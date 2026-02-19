/* ============================================================
   EYES ONLY - Synergy UI System
   Visual feedback for active synergies and card combinations
   ============================================================ */

const SynergyUI = (function () {
  'use strict';

  var _container = null;
  var _activeSynergies = [];
  var _initialized = false;

  /**
   * Initialize synergy UI
   */
  function init() {
    if (_initialized) return;

    // Create synergy display container
    _container = document.createElement('div');
    _container.id = 'synergy-display';
    _container.style.cssText = `
      position: fixed;
      top: 120px;
      right: 20px;
      z-index: 9999;
      pointer-events: none;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    `;

    document.body.appendChild(_container);
    _initialized = true;

    console.log('[SynergyUI] Synergy UI initialized');
  }

  /**
   * Display active synergies
   * @param {Array} synergies - Array of active synergy objects
   */
  function displaySynergies(synergies) {
    if (!_initialized) {
      init();
    }

    if (!synergies || synergies.length === 0) {
      _container.innerHTML = '';
      _activeSynergies = [];
      return;
    }

    _activeSynergies = synergies;

    // Build synergy display HTML
    var html = '<div style="background: rgba(20, 20, 40, 0.95); border: 2px solid #FFD700; border-radius: 8px; padding: 12px; box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);">';

    html += '<div style="color: #FFD700; font-weight: bold; margin-bottom: 8px; text-align: center; font-size: 16px;">⚡ ACTIVE SYNERGIES ⚡</div>';

    for (var i = 0; i < synergies.length; i++) {
      var syn = synergies[i];
      var def = syn.definition;

      html += '<div style="margin-bottom: 8px; padding: 8px; background: rgba(255, 215, 0, 0.1); border-left: 3px solid #FFD700; border-radius: 4px;">';
      html += '<div style="color: #FFD700; font-weight: bold; margin-bottom: 4px;">' + def.name + '</div>';
      html += '<div style="color: #FFF; font-size: 12px; opacity: 0.9;">' + def.description + '</div>';

      // Show bonuses
      if (syn.definition.bonus) {
        html += '<div style="margin-top: 4px; color: #00FF00; font-size: 11px;">';
        var bonus = syn.definition.bonus;

        if (bonus.damageMultiplier && bonus.damageMultiplier !== 1.0) {
          html += '🗡️ ' + (bonus.damageMultiplier * 100).toFixed(0) + '% damage ';
        }
        if (bonus.damageBonus) {
          html += '🗡️ +' + bonus.damageBonus + ' damage ';
        }
        if (bonus.energyRefund) {
          html += '⚡ +' + bonus.energyRefund + ' energy ';
        }
        if (bonus.guaranteedCrit) {
          html += '💥 GUARANTEED CRIT ';
        }
        if (bonus.drawCard) {
          html += '🃏 DRAW CARD ';
        }

        html += '</div>';
      }

      html += '</div>';
    }

    html += '</div>';

    _container.innerHTML = html;

    // Auto-fade after 3 seconds
    setTimeout(function() {
      fadeOut();
    }, 3000);
  }

  /**
   * Fade out synergy display
   */
  function fadeOut() {
    if (!_container) return;

    _container.style.transition = 'opacity 1s ease-out';
    _container.style.opacity = '0';

    setTimeout(function() {
      _container.style.opacity = '1';
      _container.style.transition = '';
      _container.innerHTML = '';
    }, 1000);
  }

  /**
   * Show synergy notification (flash animation)
   * @param {String} synergyName - Name of synergy triggered
   */
  function showNotification(synergyName) {
    if (!_initialized) {
      init();
    }

    // Create flash notification
    var flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #000;
      font-family: 'Courier New', monospace;
      font-size: 28px;
      font-weight: bold;
      padding: 20px 40px;
      border-radius: 12px;
      box-shadow: 0 0 40px rgba(255, 215, 0, 0.8);
      animation: synergyPulse 0.5s ease-out;
      pointer-events: none;
    `;
    flash.textContent = '⚡ ' + synergyName + ' ⚡';

    document.body.appendChild(flash);

    // Add animation keyframes if not already added
    if (!document.getElementById('synergy-animations')) {
      var style = document.createElement('style');
      style.id = 'synergy-animations';
      style.textContent = `
        @keyframes synergyPulse {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
        @keyframes synergyglow {
          0%, 100% {
            box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
          }
          50% {
            box-shadow: 0 0 20px rgba(255, 215, 0, 1);
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Remove after animation
    setTimeout(function() {
      flash.style.transition = 'opacity 0.5s ease-out';
      flash.style.opacity = '0';
      setTimeout(function() {
        flash.remove();
      }, 500);
    }, 1500);
  }

  /**
   * Highlight card with synergy glow
   * @param {HTMLElement} cardElement - Card DOM element
   * @param {String} glowColor - Color for glow effect (default: gold)
   */
  function highlightCard(cardElement, glowColor) {
    if (!cardElement) return;

    glowColor = glowColor || '#FFD700';

    cardElement.style.boxShadow = '0 0 15px ' + glowColor;
    cardElement.style.animation = 'synergyglow 2s infinite';

    // Remove highlight after 3 seconds
    setTimeout(function() {
      cardElement.style.boxShadow = '';
      cardElement.style.animation = '';
    }, 3000);
  }

  /**
   * Add synergy tags to card tooltip
   * @param {Object} card - Card object with synergy tags
   * @returns {String} - HTML for synergy tags
   */
  function getSynergyTagsHTML(card) {
    if (!card || !card.synergyTags || card.synergyTags.length === 0) {
      return '';
    }

    var html = '<div style="margin-top: 8px; padding: 6px; background: rgba(255, 215, 0, 0.1); border-radius: 4px;">';
    html += '<div style="color: #FFD700; font-weight: bold; font-size: 11px; margin-bottom: 4px;">🔗 SYNERGY TAGS:</div>';
    html += '<div style="color: #FFF; font-size: 11px;">';

    for (var i = 0; i < card.synergyTags.length; i++) {
      var tag = card.synergyTags[i];
      var displayTag = tag.replace(/_/g, ' ').toUpperCase();
      html += '<span style="background: rgba(255, 215, 0, 0.2); padding: 2px 6px; margin: 2px; border-radius: 3px; display: inline-block;">' + displayTag + '</span>';
    }

    html += '</div></div>';

    return html;
  }

  /**
   * Show potential synergies for a card (when hovering)
   * @param {Object} card - Card being hovered
   * @param {Array} potentialSynergies - Potential synergies for this card
   */
  function showPotentialSynergies(card, potentialSynergies) {
    if (!_initialized) {
      init();
    }

    if (!potentialSynergies || potentialSynergies.length === 0) {
      return;
    }

    // Show subtle hint about available synergies
    var html = '<div style="background: rgba(20, 40, 20, 0.95); border: 2px solid #00FF00; border-radius: 8px; padding: 10px; margin-top: 10px;">';
    html += '<div style="color: #00FF00; font-weight: bold; font-size: 12px; margin-bottom: 6px;">💡 POTENTIAL SYNERGIES:</div>';

    for (var i = 0; i < Math.min(potentialSynergies.length, 3); i++) {
      var potential = potentialSynergies[i];
      html += '<div style="color: #00FF00; font-size: 11px; opacity: 0.9; margin-bottom: 4px;">• ' + potential.synergy.name + '</div>';
    }

    html += '</div>';

    // Append to container temporarily
    var temp = document.createElement('div');
    temp.innerHTML = html;
    temp.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9998;';
    document.body.appendChild(temp);

    // Remove after 2 seconds
    setTimeout(function() {
      temp.remove();
    }, 2000);
  }

  /**
   * Clear all synergy displays
   */
  function clear() {
    if (_container) {
      _container.innerHTML = '';
    }
    _activeSynergies = [];
  }

  /**
   * Hide synergy UI
   */
  function hide() {
    if (_container) {
      _container.style.display = 'none';
    }
  }

  /**
   * Show synergy UI
   */
  function show() {
    if (_container) {
      _container.style.display = 'block';
    }
  }

  // Public API
  return {
    init: init,
    displaySynergies: displaySynergies,
    showNotification: showNotification,
    highlightCard: highlightCard,
    getSynergyTagsHTML: getSynergyTagsHTML,
    showPotentialSynergies: showPotentialSynergies,
    clear: clear,
    hide: hide,
    show: show
  };
})();

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    SynergyUI.init();
  });
} else {
  SynergyUI.init();
}

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SynergyUI;
}
