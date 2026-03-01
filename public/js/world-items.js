/* ============================================================
   EYES ONLY - WorldItems Manager
   Unified single source of truth for all collectible ground items:
   currencies (¢), ammo (؋), floor items (cards, gems, keys),
   and interactive items (food, books, terminals, etc.)
   ============================================================ */

var WorldItems = (function () {
  'use strict';

  // ── Internal state ────────────────────────────────────────────
  var _floorItems = [];  // Cards, ammo, gems, keys (was _items in gone-rogue.js)
  var _currencies = [];  // Currency / ammo drops ¢ ؋ (was _currencies in gone-rogue.js)

  // ── Lifecycle ─────────────────────────────────────────────────

  /**
   * Reset both arrays — call on new floor / new game.
   */
  function init() {
    _floorItems = [];
    _currencies = [];
  }

  function clearFloorItems() {
    _floorItems = [];
  }

  function clearCurrencies() {
    _currencies = [];
  }

  // ── Direct array access ────────────────────────────────────────
  // Returns the live array reference so callers can use .push / .find / .forEach
  // without going through wrapper methods.

  function getFloorItems() { return _floorItems; }
  function getCurrencies()  { return _currencies; }

  // ── Bulk set (used for save/load restore) ─────────────────────

  function setFloorItems(arr) { _floorItems = arr || []; }
  function setCurrencies(arr)  { _currencies = arr || []; }

  // ── Filter helpers (replace filter-reassign pattern) ──────────
  // Both methods update the internal reference AND return it so
  // callers can keep their local alias in sync with one assignment.

  function filterFloorItems(fn) {
    _floorItems = _floorItems.filter(fn);
    return _floorItems;
  }

  function filterCurrencies(fn) {
    _currencies = _currencies.filter(fn);
    return _currencies;
  }

  // ── Unified rendering view ─────────────────────────────────────
  /**
   * Returns a flat array of all renderable ground items, combining:
   *   1. Non-collected currencies / ammo drops from _currencies
   *   2. Floor items (cards, gems, keys, ammo pickups) from _floorItems
   *   3. Interactive items (food, books, terminals …) from InteractiveItems
   *
   * Each entry is a shallow copy of the source object augmented with a
   * `_wt` (world-type) tag so the renderer can select colour / glyph:
   *   'currency'    – rendered as yellow ¢ / magenta ؋
   *   'item'        – rendered as cyan gem / emoji card loot
   *   'interactive' – rendered as item emoji (food, etc.)
   */
  function getAllForRendering() {
    var all = [];

    // Currencies / ammo drops (skip already-collected entries)
    for (var ci = 0; ci < _currencies.length; ci++) {
      var c = _currencies[ci];
      if (!c.collected) {
        all.push(Object.assign({ _wt: 'currency' }, c));
      }
    }

    // Floor loot (cards, gems, keys …)
    for (var fi = 0; fi < _floorItems.length; fi++) {
      all.push(Object.assign({ _wt: 'item' }, _floorItems[fi]));
    }

    // Interactive items (food, books, terminals …)
    if (typeof InteractiveItems !== 'undefined') {
      var interactive = InteractiveItems.getAllItems();
      for (var ii = 0; ii < interactive.length; ii++) {
        all.push(Object.assign({ _wt: 'interactive' }, interactive[ii]));
      }
    }

    return all;
  }

  // ── Public API ─────────────────────────────────────────────────
  return {
    init:             init,
    clearFloorItems:  clearFloorItems,
    clearCurrencies:  clearCurrencies,
    getFloorItems:    getFloorItems,
    getCurrencies:    getCurrencies,
    setFloorItems:    setFloorItems,
    setCurrencies:    setCurrencies,
    filterFloorItems: filterFloorItems,
    filterCurrencies: filterCurrencies,
    getAllForRendering: getAllForRendering
  };
})();
