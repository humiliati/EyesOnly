/* ============================================================
   EYES ONLY - Name Utilities
   Unified functions for name abbreviation and formatting
   ============================================================ */

const NameUtils = (function() {
  'use strict';

  /**
   * Abbreviate name by removing vowels (except first letter of each word)
   * Preserves first letter of each word, even if it's a vowel
   *
   * Vowel-Drop Abbreviation Convention:
   * - Keep first letter of EACH WORD (regardless of vowel/consonant)
   * - Remove all vowels from remaining characters within each word
   *
   * Examples:
   *   "Sold Out"     → "SldOt"
   *   "Out"          → "Ot"
   *   "Energy Drink" → "EnrgyDrnk"
   *   "exhausted"    → "exhstd"
   *   "inventory"    → "invntry"
   *   "Attack"       → "Attck"
   *   "Rusty Key"    → "RstyKy"
   *
   * @param {string} name - Full name
   * @param {number} maxLength - Optional max length (0 = no limit)
   * @returns {string} Abbreviated name
   */
  function abbreviate(name, maxLength) {
    if (!name) return '';

    // Split into words, process each word
    var words = name.split(/\s+/);
    var result = '';

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (word.length === 0) continue;

      // Take first character of word (even if vowel)
      result += word.charAt(0);

      // Remove vowels from remaining characters in this word
      for (var j = 1; j < word.length; j++) {
        var char = word.charAt(j);
        var lower = char.toLowerCase();
        if (lower !== 'a' && lower !== 'e' && lower !== 'i' && lower !== 'o' && lower !== 'u') {
          result += char;
        }
      }
    }

    // Apply max length if specified
    if (maxLength && maxLength > 0) {
      return result.substring(0, maxLength);
    }

    return result;
  }

  /**
   * Get display name from item data
   * Falls back to abbreviating itemId if name is not available
   * Ensures XXXXX_XXX identifiers are never shown to players
   *
   * @param {Object|string} itemOrId - Item object or itemId string
   * @param {Object} options - Optional {maxLength: number}
   * @returns {string} Display name
   */
  function getDisplayName(itemOrId, options) {
    options = options || {};
    var maxLength = options.maxLength || 0;

    // Handle object with name property
    if (typeof itemOrId === 'object' && itemOrId !== null) {
      if (itemOrId.name) {
        return maxLength ? abbreviate(itemOrId.name, maxLength) : itemOrId.name;
      }
      if (itemOrId.itemId) {
        return _convertIdToName(itemOrId.itemId, maxLength);
      }
      if (itemOrId.id) {
        return _convertIdToName(itemOrId.id, maxLength);
      }
    }

    // Handle string (assumed to be itemId)
    if (typeof itemOrId === 'string') {
      return _convertIdToName(itemOrId, maxLength);
    }

    return 'Unknown';
  }

  /**
   * Convert itemId (XXXXX_XXX format) to human-readable name
   * RUSTY_KEY → Rusty Key → RstyKy (if abbreviated)
   *
   * @param {string} itemId - Item identifier (e.g., "RUSTY_KEY")
   * @param {number} maxLength - Optional max length for abbreviation
   * @returns {string} Display name
   * @private
   */
  function _convertIdToName(itemId, maxLength) {
    if (!itemId) return 'Unknown';

    // Convert RUSTY_KEY → Rusty Key
    var words = itemId.split('_');
    var titleCase = words.map(function(word) {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
    }).join(' ');

    // Apply abbreviation if maxLength specified
    if (maxLength && maxLength > 0) {
      return abbreviate(titleCase, maxLength);
    }

    return titleCase;
  }

  /**
   * Format item name for mobile landscape (space-constrained)
   * Uses aggressive abbreviation (6 char max)
   *
   * @param {Object|string} itemOrId - Item object or itemId
   * @returns {string} Abbreviated name for mobile
   */
  function formatForMobile(itemOrId) {
    return getDisplayName(itemOrId, { maxLength: 6 });
  }

  /**
   * Format item name for shop display
   * Uses moderate abbreviation (8 char max)
   *
   * @param {Object|string} itemOrId - Item object or itemId
   * @returns {string} Abbreviated name for shop
   */
  function formatForShop(itemOrId) {
    return getDisplayName(itemOrId, { maxLength: 8 });
  }

  // Public API
  return {
    abbreviate: abbreviate,
    getDisplayName: getDisplayName,
    formatForMobile: formatForMobile,
    formatForShop: formatForShop
  };
})();
