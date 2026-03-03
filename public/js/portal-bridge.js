/* ============================================================
   Portal ↔ Game Bridge (Phase 4)
   Listens for portal-originated events and routes them to
   the appropriate game systems (GAMESTATE, renderers, etc.).

   The BroadcastChannel listener lives in gone-rogue-data-registry.js
   and dispatches CustomEvents on window. This script picks those up.
   ============================================================ */
(function() {
  'use strict';

  // ── Item Grant: portal sends an item → game adds to persistent inventory ──
  window.addEventListener('gone-rogue-grant-item', function(ev) {
    var payload = ev.detail;
    if (!payload || !payload.itemId) {
      console.warn('[PortalBridge] grant-item missing itemId', payload);
      return;
    }

    var itemDef = (typeof GoneRogueDataRegistry !== 'undefined')
      ? GoneRogueDataRegistry.getItem(payload.itemId)
      : null;

    if (!itemDef || itemDef._missing) {
      console.warn('[PortalBridge] Unknown item: ' + payload.itemId);
      _respond('grant-item-result', { success: false, message: 'Unknown item: ' + payload.itemId });
      return;
    }

    var ref = {
      id: payload.itemId,
      qty: payload.qty || 1,
      meta: payload.meta || {}
    };

    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.addToPersistent) {
      var result = GAMESTATE.addToPersistent(ref);
      console.log('[PortalBridge] Grant ' + payload.itemId + ': ' + result.message);
      _respond('grant-item-result', result);

      // Trigger inventory re-render so the player sees it immediately
      if (result.success) {
        _refreshInventoryUI();
      }
    } else {
      console.warn('[PortalBridge] GAMESTATE not available');
      _respond('grant-item-result', { success: false, message: 'Game not running' });
    }
  });

  // ── Registry reloaded: re-render anything that caches item data ──
  window.addEventListener('gone-rogue-registry-reloaded', function() {
    console.log('[PortalBridge] Registry reloaded — refreshing UI');
    _refreshInventoryUI();
  });

  // ── Helpers ──

  function _respond(type, payload) {
    try {
      var ch = new BroadcastChannel('gone-rogue-portal');
      ch.postMessage({ type: type, payload: payload });
      ch.close();
    } catch (e) {}
  }

  function _refreshInventoryUI() {
    // NCH vault
    if (typeof NonCombatHud !== 'undefined' && NonCombatHud.renderAll) {
      try { NonCombatHud.renderAll(); } catch (e) {}
    }
    // Sidebar
    if (typeof RogueSidebar !== 'undefined' && RogueSidebar.render) {
      try { RogueSidebar.render(); } catch (e) {}
    }
    // Mobile
    if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.renderInventory) {
      try { GoneRogueMobile.renderInventory(); } catch (e) {}
    }
    // Generic event for any other listeners
    try {
      window.dispatchEvent(new CustomEvent('gone-rogue-inventory-changed'));
    } catch (e) {}
  }

})();
