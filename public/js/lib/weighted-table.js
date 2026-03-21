/* ============================================================
   WeightedTable — Weighted random selection utility
   Standalone IIFE, no dependencies.

   Usage:
     var table = new WeightedTable([
       { emoji: '🌲', weight: 30, damage: 10 },
       { emoji: '🗿', weight: 20, damage: 15 },
       { emoji: '🏔️', weight: 50, damage: 5  }
     ]);
     var item = table.pick();        // weighted random
     var item2 = table.pick(myRng);  // custom RNG (0-1)

   The `weight` property on each entry controls relative probability.
   All other properties are passed through untouched.

   Advanced:
     table.add({ emoji: '💣', weight: 10 });
     table.remove(entry);
     table.pickN(3);          // 3 unique picks (no repeats)
     table.pickFiltered(fn);  // pick from subset matching fn
   ============================================================ */
;(function () {
  'use strict';

  /**
   * @constructor
   * @param {Array} entries - Array of objects, each with a numeric `weight` property.
   */
  function WeightedTable(entries) {
    this._entries = [];
    this._totalWeight = 0;
    if (entries && entries.length) {
      for (var i = 0; i < entries.length; i++) {
        this.add(entries[i]);
      }
    }
  }

  /**
   * Add an entry to the table.
   * @param {Object} entry - Must have a numeric `weight` property > 0.
   * @returns {WeightedTable} this (chainable)
   */
  WeightedTable.prototype.add = function (entry) {
    var w = entry && entry.weight;
    if (typeof w !== 'number' || w <= 0) {
      throw new Error('WeightedTable.add: entry must have a positive numeric weight');
    }
    this._entries.push(entry);
    this._totalWeight += w;
    return this;
  };

  /**
   * Remove an entry by reference.
   * @param {Object} entry - The exact object reference to remove.
   * @returns {boolean} true if found and removed.
   */
  WeightedTable.prototype.remove = function (entry) {
    for (var i = 0; i < this._entries.length; i++) {
      if (this._entries[i] === entry) {
        this._totalWeight -= this._entries[i].weight;
        this._entries.splice(i, 1);
        return true;
      }
    }
    return false;
  };

  /**
   * Pick a single weighted-random entry.
   * @param {Function} [rng] - Optional RNG returning 0-1. Defaults to Math.random.
   * @returns {Object|null} The selected entry, or null if table is empty.
   */
  WeightedTable.prototype.pick = function (rng) {
    if (this._entries.length === 0) return null;
    var rand = (rng || Math.random)() * this._totalWeight;
    var acc = 0;
    for (var i = 0; i < this._entries.length; i++) {
      acc += this._entries[i].weight;
      if (rand < acc) return this._entries[i];
    }
    return this._entries[this._entries.length - 1];
  };

  /**
   * Pick N unique entries (no repeats). If N >= entries.length, returns
   * a shuffled copy of all entries.
   * @param {number} n - How many to pick.
   * @param {Function} [rng] - Optional RNG.
   * @returns {Array} Array of selected entries.
   */
  WeightedTable.prototype.pickN = function (n, rng) {
    if (n <= 0) return [];
    if (n >= this._entries.length) {
      // Return shuffled copy of all
      var all = this._entries.slice();
      for (var s = all.length - 1; s > 0; s--) {
        var j = Math.floor((rng || Math.random)() * (s + 1));
        var tmp = all[s]; all[s] = all[j]; all[j] = tmp;
      }
      return all;
    }

    // Build a temporary table and pick without replacement
    var remaining = this._entries.slice();
    var remWeights = [];
    var remTotal = this._totalWeight;
    for (var w = 0; w < remaining.length; w++) remWeights[w] = remaining[w].weight;

    var result = [];
    for (var k = 0; k < n; k++) {
      var rand = (rng || Math.random)() * remTotal;
      var acc = 0;
      for (var i = 0; i < remaining.length; i++) {
        acc += remWeights[i];
        if (rand < acc) {
          result.push(remaining[i]);
          remTotal -= remWeights[i];
          remaining.splice(i, 1);
          remWeights.splice(i, 1);
          break;
        }
      }
    }
    return result;
  };

  /**
   * Pick from a filtered subset of entries.
   * @param {Function} filterFn - Predicate function(entry) => boolean.
   * @param {Function} [rng] - Optional RNG.
   * @returns {Object|null} The selected entry from the filtered set.
   */
  WeightedTable.prototype.pickFiltered = function (filterFn, rng) {
    var filtered = [];
    var filteredTotal = 0;
    for (var i = 0; i < this._entries.length; i++) {
      if (filterFn(this._entries[i])) {
        filtered.push(this._entries[i]);
        filteredTotal += this._entries[i].weight;
      }
    }
    if (filtered.length === 0) return null;
    var rand = (rng || Math.random)() * filteredTotal;
    var acc = 0;
    for (var j = 0; j < filtered.length; j++) {
      acc += filtered[j].weight;
      if (rand < acc) return filtered[j];
    }
    return filtered[filtered.length - 1];
  };

  /**
   * @returns {number} Number of entries in the table.
   */
  WeightedTable.prototype.size = function () {
    return this._entries.length;
  };

  /**
   * @returns {number} Sum of all weights.
   */
  WeightedTable.prototype.totalWeight = function () {
    return this._totalWeight;
  };

  /**
   * @returns {Array} Shallow copy of entries array.
   */
  WeightedTable.prototype.entries = function () {
    return this._entries.slice();
  };

  // ── Export as global ──
  window.WeightedTable = WeightedTable;
})();
