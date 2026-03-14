/**
 * account-inventory.js — Account-Level Persistent Inventory
 *
 * Manages the shared persistent inventory that exists in localStorage
 * for anonymous users and syncs to server-side storage on login.
 *
 * KEY CONCEPTS:
 * - Every new visitor gets DEFAULT_ITEMS seeded on first visit
 * - Items persist in localStorage under `eyesonly_account_inventory`
 * - On login/auth, the local inventory merges into the server account
 * - Items use the canonical ITM-XXX schema from items.json
 * - Platform items (_platformItem: true) bridge ARG → inventory → games
 *
 * STORAGE KEY: eyesonly_account_inventory
 * FORMAT: { version: 1, items: [ { id, qty, meta } ], seeded: true }
 */
var AccountInventory = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_account_inventory';
  var CURRENT_VERSION = 1;

  // ---- Default items seeded into every new account ----
  // These use the canonical items.json schema (ITM-XXX IDs).
  // _defaultAccountItem: true items in items.json should match this list.
  var DEFAULT_ITEMS = [
    {
      id: 'ITM-200',
      qty: 1,
      meta: {
        name: 'Magnifying Glass',
        emoji: '🔍',
        type: 'equipment',
        subtype: 'investigation',
        rarity: 'common',
        equipSlot: 'active',
        platformItem: true,
        description: 'Standard-issue field lens. Reveals hidden details when dragged across surfaces.',
        effects: [{ type: 'reveal', mode: 'lens' }],
        synergyTags: ['investigation', 'decryption', 'recon', 'platform']
      }
    }
  ];

  // ---- Internal state ----
  var _inventory = null; // cached parsed inventory
  var _listeners = [];

  // ---- Storage helpers ----
  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data && data.version === CURRENT_VERSION) return data;
      // Future: handle version migration here
      return null;
    } catch (_) {
      return null;
    }
  }

  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function _emit(eventName, detail) {
    _listeners.forEach(function (entry) {
      if (entry.event === eventName || entry.event === '*') {
        try { entry.fn(detail); } catch (_) {}
      }
    });
    // Also dispatch DOM event for cross-module communication
    try {
      document.dispatchEvent(new CustomEvent('account-inventory:' + eventName, { detail: detail }));
    } catch (_) {}
  }

  // ---- Core API ----

  /**
   * Initialize the account inventory.
   * Seeds default items if this is a first visit.
   * Returns the current inventory array.
   */
  function init() {
    var data = _load();
    if (!data || !data.seeded) {
      // First visit — seed default items
      data = {
        version: CURRENT_VERSION,
        items: DEFAULT_ITEMS.map(function (item) {
          return JSON.parse(JSON.stringify(item)); // deep clone
        }),
        seeded: true,
        createdAt: new Date().toISOString()
      };
      _save(data);
      _emit('seeded', { items: data.items });
    }
    _inventory = data;
    _emit('loaded', { items: data.items });
    return data.items;
  }

  /**
   * Get all items in the account inventory.
   */
  function getItems() {
    if (!_inventory) init();
    return _inventory.items.slice(); // return copy
  }

  /**
   * Get a specific item by ITM-XXX id.
   * Returns the item object or null.
   */
  function getItem(id) {
    if (!_inventory) init();
    for (var i = 0; i < _inventory.items.length; i++) {
      if (_inventory.items[i].id === id) return _inventory.items[i];
    }
    return null;
  }

  /**
   * Check if the inventory contains a specific item.
   */
  function hasItem(id) {
    return getItem(id) !== null;
  }

  /**
   * Add an item to the account inventory.
   * If the item already exists and is stackable, increments qty.
   * Returns the updated item entry.
   */
  function addItem(itemEntry) {
    if (!_inventory) init();
    var existing = null;
    for (var i = 0; i < _inventory.items.length; i++) {
      if (_inventory.items[i].id === itemEntry.id) {
        existing = _inventory.items[i];
        break;
      }
    }
    if (existing) {
      // Stack if possible
      var maxStack = (existing.meta && existing.meta.maxStack) || 1;
      if (existing.qty < maxStack) {
        existing.qty = Math.min(existing.qty + (itemEntry.qty || 1), maxStack);
      }
      _save(_inventory);
      _emit('item-updated', { item: existing });
      return existing;
    } else {
      var newItem = JSON.parse(JSON.stringify(itemEntry));
      _inventory.items.push(newItem);
      _save(_inventory);
      _emit('item-added', { item: newItem });
      return newItem;
    }
  }

  /**
   * Remove an item from the account inventory by id.
   * Returns true if removed, false if not found.
   */
  function removeItem(id) {
    if (!_inventory) init();
    for (var i = 0; i < _inventory.items.length; i++) {
      if (_inventory.items[i].id === id) {
        var removed = _inventory.items.splice(i, 1)[0];
        _save(_inventory);
        _emit('item-removed', { item: removed });
        return true;
      }
    }
    return false;
  }

  /**
   * Export the full inventory payload for server sync on login.
   * Returns { version, items, seeded, createdAt }.
   */
  function exportForSync() {
    if (!_inventory) init();
    return JSON.parse(JSON.stringify(_inventory));
  }

  /**
   * Import inventory from server (after login).
   * Merges server items with local items — server wins on conflicts.
   * New local items (not on server) are preserved.
   */
  function importFromServer(serverItems) {
    if (!_inventory) init();
    var serverById = {};
    serverItems.forEach(function (item) {
      serverById[item.id] = item;
    });

    // Merge: server items overwrite, local-only items preserved
    var merged = [];
    var seen = {};

    // Server items first (authoritative)
    serverItems.forEach(function (item) {
      merged.push(JSON.parse(JSON.stringify(item)));
      seen[item.id] = true;
    });

    // Local-only items appended
    _inventory.items.forEach(function (item) {
      if (!seen[item.id]) {
        merged.push(JSON.parse(JSON.stringify(item)));
      }
    });

    _inventory.items = merged;
    _save(_inventory);
    _emit('synced', { items: merged, source: 'server' });
    return merged;
  }

  /**
   * Listen for inventory events.
   * Events: 'seeded', 'loaded', 'item-added', 'item-updated', 'item-removed', 'synced', '*'
   */
  function on(eventName, fn) {
    _listeners.push({ event: eventName, fn: fn });
  }

  /**
   * Reset the inventory (for testing/debug).
   */
  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    _inventory = null;
  }

  // ---- Public API ----
  return {
    init: init,
    getItems: getItems,
    getItem: getItem,
    hasItem: hasItem,
    addItem: addItem,
    removeItem: removeItem,
    exportForSync: exportForSync,
    importFromServer: importFromServer,
    on: on,
    reset: reset,
    STORAGE_KEY: STORAGE_KEY
  };

})();
