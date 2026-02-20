/* ============================================================
   Gone Rogue Data Registry (v0)
   Loads JSON registries for items/cards/statuses/ground effects/synergies.
   Keeps game logic out of inline functions: resolve by id.
   ============================================================ */

var GoneRogueDataRegistry = (function() {
  'use strict';

  var BASE = 'data/gone-rogue/';
  var _loaded = false;
  var _loadingPromise = null;

  var _db = {
    items: [],
    cards: [],
    statuses: [],
    groundEffects: [],
    synergies: []
  };

  var _byId = {
    items: {},
    cards: {},
    statuses: {},
    groundEffects: {},
    synergies: {}
  };

  function _index() {
    function idx(list, out) {
      out = out || {};
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (it && it.id) out[it.id] = it;
      }
      return out;
    }

    _byId.items = idx(_db.items, {});
    _byId.cards = idx(_db.cards, {});
    _byId.statuses = idx(_db.statuses, {});
    _byId.groundEffects = idx(_db.groundEffects, {});
    _byId.synergies = idx(_db.synergies, {});
  }

  function _fetchJson(path) {
    return fetch(path, { cache: 'no-cache' }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + path);
      return r.json();
    });
  }

  function load() {
    if (_loaded) return Promise.resolve(true);
    if (_loadingPromise) return _loadingPromise;

    _loadingPromise = Promise.all([
      _fetchJson(BASE + 'items.json').catch(function() { return []; }),
      _fetchJson(BASE + 'cards.json').catch(function() { return []; }),
      _fetchJson(BASE + 'statuses.json').catch(function() { return []; }),
      _fetchJson(BASE + 'ground_effects.json').catch(function() { return []; }),
      _fetchJson(BASE + 'synergies.json').catch(function() { return []; })
    ]).then(function(arr) {
      _db.items = Array.isArray(arr[0]) ? arr[0] : [];
      _db.cards = Array.isArray(arr[1]) ? arr[1] : [];
      _db.statuses = Array.isArray(arr[2]) ? arr[2] : [];
      _db.groundEffects = Array.isArray(arr[3]) ? arr[3] : [];
      _db.synergies = Array.isArray(arr[4]) ? arr[4] : [];

      _index();
      _loaded = true;

      if (typeof NonCombatEventBus !== 'undefined') {
        NonCombatEventBus.emit('registry:loaded', { counts: {
          items: _db.items.length,
          cards: _db.cards.length,
          statuses: _db.statuses.length,
          groundEffects: _db.groundEffects.length,
          synergies: _db.synergies.length
        }});
      }

      return true;
    });

    return _loadingPromise;
  }

  function isLoaded() { return _loaded; }

  function getItem(id) { return _byId.items[id] || null; }
  function getCard(id) { return _byId.cards[id] || null; }
  function getStatus(id) { return _byId.statuses[id] || null; }
  function getGroundEffect(id) { return _byId.groundEffects[id] || null; }
  function getSynergy(id) { return _byId.synergies[id] || null; }

  function listCards() { return _db.cards.slice(); }
  function listItems() { return _db.items.slice(); }

  return {
    load: load,
    isLoaded: isLoaded,
    getItem: getItem,
    getCard: getCard,
    getStatus: getStatus,
    getGroundEffect: getGroundEffect,
    getSynergy: getSynergy,
    listCards: listCards,
    listItems: listItems
  };
})();
