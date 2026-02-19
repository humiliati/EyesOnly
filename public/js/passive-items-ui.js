/* ============================================================
   EYES ONLY - Passive Items UI
   Display and manage equipped passive items
   ============================================================ */

const PassiveItemsUI = (function() {
  'use strict';

  var _container = null;
  var _synergyIndicator = null;

  /**
   * Initialize passive items UI
   */
  function init() {
    _createContainer();
    _createSynergyIndicator();
    console.log('[PassiveItemsUI] Initialized');
  }

  /**
   * Create passive items container
   */
  function _createContainer() {
    _container = document.createElement('div');
    _container.className = 'passive-equipment-indicator';
    _container.id = 'passive-equipment-indicator';
    document.body.appendChild(_container);
  }

  /**
   * Create synergy indicator
   */
  function _createSynergyIndicator() {
    _synergyIndicator = document.createElement('div');
    _synergyIndicator.className = 'passive-synergy-active';
    _synergyIndicator.id = 'passive-synergy-indicator';
    _synergyIndicator.style.display = 'none';
    _synergyIndicator.innerHTML = '<div class="synergy-text">⚙️ SYNERGY ACTIVE ⚙️</div>';
    document.body.appendChild(_synergyIndicator);
  }

  /**
   * Refresh display of equipped passive items
   */
  function refresh() {
    if (!_container) return;

    var equippedItems = PassiveItemsSystem.getEquippedPassives();
    var html = '';

    equippedItems.forEach(function(itemId) {
      var item = PassiveItemsSystem.getPassiveItem(itemId);
      if (!item) return;

      var badgeClass = itemId.indexOf('scrapper') !== -1 ? 'scrapper' : 'thrift';

      html += '<div class="passive-item-badge ' + badgeClass + '" data-item-id="' + itemId + '">';
      html += '<span>' + item.emoji + '</span>';
      html += '<div class="passive-item-tooltip">';
      html += '<div class="passive-item-tooltip-title">' + item.name + '</div>';
      html += '<div class="passive-item-tooltip-desc">' + item.description + '</div>';
      html += '<div class="passive-item-tooltip-proc">Proc: ' + Math.round(item.proc_base * 100) + '%</div>';
      html += '</div>';
      html += '</div>';
    });

    _container.innerHTML = html;

    // Update synergy indicator
    if (_synergyIndicator) {
      if (PassiveItemsSystem.hasSynergy()) {
        _synergyIndicator.style.display = 'block';
      } else {
        _synergyIndicator.style.display = 'none';
      }
    }
  }

  /**
   * Show card spawn notification
   * @param {Object} card - Spawned card
   * @param {string} source - Source ('scrapper' or 'thrift')
   * @param {boolean} isPerfectEcho - Is perfect echo
   */
  function showSpawnNotification(card, source, isPerfectEcho) {
    var notification = document.createElement('div');
    notification.className = 'card-spawn-notification';

    var emoji = source === 'scrapper' ? '♻️' : '👻';
    var text = source === 'scrapper' ? 'FABRICATED' : 'DUPLICATED';

    if (isPerfectEcho) {
      text = 'PERFECT ECHO';
      emoji = '✨';
    }

    notification.innerHTML =
      '<div class="spawn-notification-emoji">' + emoji + '</div>' +
      '<div class="spawn-notification-text">' + text + '</div>' +
      '<div class="spawn-notification-detail">' + card.name + '</div>';

    document.body.appendChild(notification);

    // Remove after animation
    setTimeout(function() {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 2000);
  }

  // Public API
  return {
    init: init,
    refresh: refresh,
    showSpawnNotification: showSpawnNotification
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    PassiveItemsUI.init();
  });
} else {
  PassiveItemsUI.init();
}
