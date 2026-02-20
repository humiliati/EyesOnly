/* ============================================================
   EYES ONLY - Seeded Random Number Generator
   Provides deterministic random number generation for reproducible runs
   ============================================================ */

const SeededRNG = (function () {
  'use strict';

  var _seed = null;
  var _state = null;

  /**
   * Mulberry32 - Fast, high-quality 32-bit seeded RNG
   * Source: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
   */
  function _mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /**
   * Generate a random seed from current timestamp and random values
   * @returns {string} 8-character hex seed
   */
  function generateSeed() {
    var timestamp = Date.now();
    var random = Math.floor(Math.random() * 0xFFFFFF);
    var combined = timestamp ^ random;
    return combined.toString(16).substring(0, 8).toUpperCase();
  }

  /**
   * Initialize RNG with a seed
   * @param {string|number} seed - Seed value (8-char hex string or integer)
   */
  function init(seed) {
    if (seed === undefined || seed === null) {
      seed = generateSeed();
    }

    // Convert hex string to integer if needed
    if (typeof seed === 'string') {
      _seed = seed;
      _state = _mulberry32(parseInt(seed, 16));
    } else {
      _seed = seed.toString(16).substring(0, 8).toUpperCase();
      _state = _mulberry32(seed);
    }

    console.log('[SeededRNG] Initialized with seed:', _seed);
    return _seed;
  }

  /**
   * Get current seed
   * @returns {string} Current seed
   */
  function getSeed() {
    return _seed;
  }

  /**
   * Generate random number between 0 (inclusive) and 1 (exclusive)
   * @returns {number} Random number [0, 1)
   */
  function random() {
    if (_state === null) {
      console.warn('[SeededRNG] Not initialized, using Math.random()');
      return Math.random();
    }
    return _state();
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (exclusive)
   * @returns {number} Random integer
   */
  function randomInt(min, max) {
    return Math.floor(random() * (max - min)) + min;
  }

  /**
   * Pick random element from array
   * @param {Array} arr - Array to pick from
   * @returns {*} Random element
   */
  function pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(random() * arr.length)];
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * @param {Array} arr - Array to shuffle (modified in place)
   * @returns {Array} Shuffled array
   */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  /**
   * Generate random boolean with given probability
   * @param {number} probability - Probability of true (0-1)
   * @returns {boolean} Random boolean
   */
  function chance(probability) {
    return random() < probability;
  }

  /**
   * Pick weighted random element from array
   * @param {Array} items - Array of items
   * @param {Array} weights - Array of weights (same length as items)
   * @returns {*} Weighted random element
   */
  function weightedPick(items, weights) {
    if (!items || items.length === 0) return undefined;
    if (!weights || weights.length !== items.length) {
      console.warn('[SeededRNG] Weights mismatch, using uniform distribution');
      return pick(items);
    }

    var totalWeight = 0;
    for (var i = 0; i < weights.length; i++) {
      totalWeight += weights[i];
    }

    var roll = random() * totalWeight;
    var cumulative = 0;

    for (var j = 0; j < items.length; j++) {
      cumulative += weights[j];
      if (roll < cumulative) {
        return items[j];
      }
    }

    return items[items.length - 1];
  }

  /**
   * Reset RNG to use Math.random() (for testing or fallback)
   */
  function reset() {
    _seed = null;
    _state = null;
    console.log('[SeededRNG] Reset to Math.random()');
  }

  // Public API
  return {
    init: init,
    getSeed: getSeed,
    random: random,
    randomInt: randomInt,
    pick: pick,
    shuffle: shuffle,
    chance: chance,
    weightedPick: weightedPick,
    generateSeed: generateSeed,
    reset: reset
  };
})();
