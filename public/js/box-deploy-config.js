/* ============================================================
   BoxDeployConfig — Single source of truth for deployable box
   item IDs and quality-tier probability tables.

   IIFE module — loads before gone-rogue.js.
   All box tuning knobs live here for branding/launch iteration.
   ============================================================ */
var BoxDeployConfig = (function () {
  'use strict';

  // ── Item IDs that count as deployable boxes ────────────────
  // Maps to items.json entries. Add new box variants here.
  var _deployIds = ['ITM-020', 'ITM-021', 'ITM-022', 'ITM-023'];

  // ── Quality-tier probability tables ────────────────────────
  // Each table maps quality tier → probability (0.0–1.0).
  // These are the primary tuning knobs for box balance.

  /** Chance that hiding in this box evades an enemy walking past */
  var _evasionChance = {
    'common':    0.85,
    'uncommon':  0.90,
    'rare':      0.95,
    'legendary': 0.991
  };

  /** Chance that an enemy walks over (destroys) this box */
  var _walkOverChance = {
    'common':    0.70,
    'uncommon':  0.40,
    'rare':      0.20,
    'legendary': 0.00
  };

  /** Chance that an enemy notices (investigates) this box */
  var _noticeChance = {
    'common':    0.50,
    'uncommon':  0.35,
    'rare':      0.20,
    'legendary': 0.00
  };

  // ── Public API ─────────────────────────────────────────────

  /** Is this item ID a deployable box? */
  function isBoxItem(itemId) {
    return _deployIds.indexOf(itemId) !== -1;
  }

  /** Get the full list of box item IDs */
  function getDeployIds() {
    return _deployIds.slice(); // defensive copy
  }

  /** Get evasion chance for a quality tier (default 0.85) */
  function getEvasionChance(quality) {
    return _evasionChance[quality] !== undefined ? _evasionChance[quality] : 0.85;
  }

  /** Get walk-over chance for a quality tier (default 0.70) */
  function getWalkOverChance(quality) {
    return _evasionChance[quality] !== undefined ? _walkOverChance[quality] : 0.70;
  }

  /** Get notice chance for a quality tier (default 0.50) */
  function getNoticeChance(quality) {
    return _noticeChance[quality] !== undefined ? _noticeChance[quality] : 0.50;
  }

  /** Get full probability table (for UI display / debug) */
  function getTables() {
    return {
      evasion:  Object.assign({}, _evasionChance),
      walkOver: Object.assign({}, _walkOverChance),
      notice:   Object.assign({}, _noticeChance)
    };
  }

  /**
   * Override a probability value at runtime (for A/B testing, events, etc.)
   * @param {string} table - 'evasion'|'walkOver'|'notice'
   * @param {string} quality - 'common'|'uncommon'|'rare'|'legendary'
   * @param {number} value - New probability (0.0–1.0)
   */
  function tune(table, quality, value) {
    var target = table === 'evasion' ? _evasionChance
               : table === 'walkOver' ? _walkOverChance
               : table === 'notice' ? _noticeChance
               : null;
    if (!target) {
      console.warn('[BoxDeployConfig] tune: unknown table "' + table + '"');
      return;
    }
    if (typeof value !== 'number' || value < 0 || value > 1) {
      console.warn('[BoxDeployConfig] tune: value must be 0.0–1.0');
      return;
    }
    target[quality] = value;
  }

  return {
    isBoxItem:        isBoxItem,
    getDeployIds:     getDeployIds,
    getEvasionChance: getEvasionChance,
    getWalkOverChance: getWalkOverChance,
    getNoticeChance:  getNoticeChance,
    getTables:        getTables,
    tune:             tune
  };
})();
