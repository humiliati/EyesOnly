/* ============================================================
   VendorConfig — Single source of truth for merchant archetypes,
   pricing multipliers, and inventory filter rules.

   IIFE module — loads before gone-rogue.js.
   All vendor personality and economy tuning lives here.
   Satellites register new vendor types at boot time.
   ============================================================ */
var VendorConfig = (function () {
  'use strict';

  // ── Core vendor archetypes ─────────────────────────────────
  var _types = {
    SCRAP_MERCHANT: {
      name: 'Scrap Merchant',
      emoji: '🧑‍💼',
      description: 'Sells cheap junk cards and supplies',
      priceMultiplier: 0.7,
      qualityRange: [30, 70],
      cardFilter: null,
      // Expansion seams — populated by satellites or WBE
      specialInventory: null,   // Override function(floor, rng) → item[]
      dialogueOverride: null,   // Custom dialogue tree ref
      bonfireAffinity: null     // Preferred bonfire floor (null = any)
    },
    ARMS_DEALER: {
      name: 'Arms Dealer',
      emoji: '🔫',
      description: 'Sells attack cards and explosives',
      priceMultiplier: 1.2,
      qualityRange: [50, 85],
      cardFilter: ['attack'],
      specialInventory: null,
      dialogueOverride: null,
      bonfireAffinity: null
    },
    GHOST_BROKER: {
      name: 'Ghost Broker',
      emoji: '👻',
      description: 'Sells stealth and silent cards',
      priceMultiplier: 1.5,
      qualityRange: [60, 90],
      cardFilter: ['stealth', 'movement'],
      specialInventory: null,
      dialogueOverride: null,
      bonfireAffinity: null
    },
    RELIC_SMUGGLER: {
      name: 'Relic Smuggler',
      emoji: '💎',
      description: 'Sells rare charms and inventory expanders',
      priceMultiplier: 2.0,
      qualityRange: [70, 95],
      cardFilter: null,
      specialInventory: null,
      dialogueOverride: null,
      bonfireAffinity: null
    }
  };

  // ── Public API ─────────────────────────────────────────────

  /** Get the full vendor types object (drop-in for old VENDOR_TYPES) */
  function getTypes() {
    return _types;
  }

  /** Get a specific vendor type by key (or null) */
  function getType(key) {
    return _types[key] || null;
  }

  /** Get all vendor type keys */
  function keys() {
    return Object.keys(_types);
  }

  /**
   * Register a new vendor archetype at runtime.
   * @param {string} key - Unique vendor key (e.g. 'TECH_DEALER')
   * @param {object} config - { name, emoji, description, priceMultiplier, qualityRange, cardFilter?, ... }
   */
  function registerType(key, config) {
    if (!key || !config || !config.name) {
      console.warn('[VendorConfig] registerType: key and config.name required');
      return;
    }
    if (_types[key]) {
      console.warn('[VendorConfig] registerType: overwriting existing type "' + key + '"');
    }
    // Ensure expansion seam fields exist
    config.specialInventory = config.specialInventory || null;
    config.dialogueOverride = config.dialogueOverride || null;
    config.bonfireAffinity = config.bonfireAffinity || null;
    _types[key] = config;
  }

  /**
   * Tune a price multiplier at runtime (for events, difficulty, etc.)
   * @param {string} key - Vendor type key
   * @param {number} multiplier - New price multiplier
   */
  function tunePrice(key, multiplier) {
    if (!_types[key]) {
      console.warn('[VendorConfig] tunePrice: unknown type "' + key + '"');
      return;
    }
    if (typeof multiplier !== 'number' || multiplier <= 0) {
      console.warn('[VendorConfig] tunePrice: multiplier must be positive number');
      return;
    }
    _types[key].priceMultiplier = multiplier;
  }

  return {
    getTypes:     getTypes,
    getType:      getType,
    keys:         keys,
    registerType: registerType,
    tunePrice:    tunePrice
  };
})();
