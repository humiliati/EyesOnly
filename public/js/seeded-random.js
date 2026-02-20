/**
 * Seeded Random Number Generator
 * Uses a simple LCG (Linear Congruential Generator) for deterministic randomness
 *
 * This enables:
 * - Reproducible floor generation for high score validation
 * - Deterministic testing and debugging
 * - Shareable seeds for specific run configurations
 */

var SeededRandom = (function() {
  'use strict';

  /**
   * Seeded RNG using mulberry32 algorithm
   * Fast, simple, and sufficient quality for game generation
   */
  function SeededRNG(seed) {
    this.seed = seed >>> 0; // Ensure unsigned 32-bit integer
    this.state = this.seed;
  }

  /**
   * Generate next random number [0, 1)
   */
  SeededRNG.prototype.next = function() {
    this.state = (this.state + 0x6D2B79F5) | 0;
    var t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /**
   * Generate random integer [min, max) (exclusive of max)
   */
  SeededRNG.prototype.nextInt = function(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  };

  /**
   * Generate random integer [min, max] (inclusive)
   */
  SeededRNG.prototype.nextIntInclusive = function(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  };

  /**
   * Pick random element from array
   */
  SeededRNG.prototype.choice = function(array) {
    if (!array || array.length === 0) return null;
    return array[this.nextInt(0, array.length)];
  };

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  SeededRNG.prototype.shuffle = function(array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = this.nextInt(0, i + 1);
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  };

  /**
   * Generate seed phrase from seed number
   * Format: WORD-WORD-WORD (3 words from word list)
   */
  function generateSeedPhrase(seedNumber) {
    // Simple word list for memorable seeds
    var words = [
      'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT',
      'GOLF', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA',
      'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO',
      'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'XRAY',
      'YANKEE', 'ZULU', 'FOREST', 'SHADOW', 'ROGUE', 'VAULT',
      'CIPHER', 'GHOST', 'STORM', 'TITAN', 'NEXUS', 'PRISM'
    ];

    // Use seed to deterministically select 3 words
    var rng = new SeededRNG(seedNumber);
    var word1 = words[rng.nextInt(0, words.length)];
    var word2 = words[rng.nextInt(0, words.length)];
    var word3 = words[rng.nextInt(0, words.length)];

    return word1 + '-' + word2 + '-' + word3;
  }

  /**
   * Parse seed phrase back to seed number
   */
  function parseSeedPhrase(phrase) {
    if (!phrase || typeof phrase !== 'string') {
      return null;
    }

    // If it's already a number, return it
    if (/^\d+$/.test(phrase)) {
      return parseInt(phrase, 10);
    }

    // If it's a phrase, hash it to a number
    // Simple string hash (djb2)
    var hash = 5381;
    for (var i = 0; i < phrase.length; i++) {
      hash = ((hash << 5) + hash) + phrase.charCodeAt(i);
      hash = hash >>> 0; // Convert to unsigned 32-bit
    }
    return hash;
  }

  /**
   * Generate random seed number
   */
  function generateRandomSeed() {
    return Math.floor(Math.random() * 0xFFFFFFFF);
  }

  /**
   * Get current date-based seed (same seed for all runs today)
   */
  function getDailySeed() {
    var today = new Date();
    var daysSinceEpoch = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
    return daysSinceEpoch;
  }

  // Public API
  return {
    SeededRNG: SeededRNG,
    generateSeedPhrase: generateSeedPhrase,
    parseSeedPhrase: parseSeedPhrase,
    generateRandomSeed: generateRandomSeed,
    getDailySeed: getDailySeed
  };
})();

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SeededRandom;
}
