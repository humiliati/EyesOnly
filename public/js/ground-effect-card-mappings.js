/* ============================================================
   Ground Effect Card Mappings
   Designer-configurable mapping from card -> GroundEffects
   ============================================================ */

var GroundEffectCardMappings = (function() {
  'use strict';

  var STORAGE_KEY = 'EYESONLY_GROUND_EFFECT_CARD_MAP_V1';

  // Defaults (very small starter set)
  // key is normalized card name (lowercase)
  var DEFAULTS = {
    'lighter': { type: 'FIRE', radius: 0, lifetimeSec: 6 },
    'katchup': { type: 'SODA_SPILL', radius: 0, lifetimeSec: 8 },
    'water bottle': { type: 'WATER', radius: 0, lifetimeSec: 10 },
    'propane': { type: 'OIL', radius: 0, lifetimeSec: 12 },
    // Gate: freeze water/toxic waste into ice
    'cooling': { type: 'ICE', radius: 0, lifetimeSec: 10 }
  };

  var _map = null;

  function _normalizeKey(name) {
    return ('' + (name || '')).trim().toLowerCase();
  }

  function _loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {}
    return null;
  }

  function _saveToStorage(mapObj) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapObj || {}));
    } catch (e) {}
  }

  function getAll() {
    if (!_map) {
      _map = Object.assign({}, DEFAULTS, _loadFromStorage() || {});
    }
    return Object.assign({}, _map);
  }

  function setAll(mapObj) {
    _map = Object.assign({}, mapObj || {});
    _saveToStorage(_map);
  }

  function getMappingForCard(card) {
    var name = (card && (card.name || card.displayName)) ? (card.name || card.displayName) : '';
    var key = _normalizeKey(name);
    var map = getAll();
    return map[key] || null;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    getAll: getAll,
    setAll: setAll,
    getMappingForCard: getMappingForCard
  };
})();
