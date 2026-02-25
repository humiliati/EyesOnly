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
    synergies: [],
    buildings: []
  };

  var _byId = {
    items: {},
    cards: {},
    statuses: {},
    groundEffects: {},
    synergies: {},
    buildings: {}
  };

  function _createMissingEntry(id, type) {
    return {
      id: id,
      name: '[' + String(type || 'missing').toUpperCase() + ':' + id + ']',
      emoji: '❓',
      _missing: true
    };
  }

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
    _byId.buildings = idx(_db.buildings, {});
  }

  function _fetchJson(path) {
    return fetch(path, { cache: 'no-cache' }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + path);
      return r.json();
    });
  }

  function _validateLightweight() {
    // No hard failures at runtime. We just warn to keep designers informed.
    function warn(msg) {
      try { console.warn('[Registry] ' + msg); } catch (e) {}
    }

    function check(list, kind, fileName, re, requiredKeys) {
      var anyWarn = false;
      try { console.groupCollapsed('[Registry] validate ' + (fileName || kind)); } catch (e) {}

      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (!it || !it.id) { warn(kind + ' missing id at index ' + i); anyWarn = true; continue; }
        if (re && !re.test(it.id)) { warn(kind + ' id pattern mismatch: ' + it.id); anyWarn = true; }
        for (var k = 0; k < requiredKeys.length; k++) {
          var key = requiredKeys[k];
          if (typeof it[key] === 'undefined') { warn(kind + ' ' + it.id + ' missing key: ' + key); anyWarn = true; }
        }
      }

      try {
        if (!anyWarn) console.log('ok');
      } catch (e2) {}

      try { console.groupEnd(); } catch (e3) {}
    }

    check(_db.items, 'item', 'items.json', /^ITM-\d{3}$/, ['name', 'emoji', 'type']);
    check(_db.cards, 'card', 'cards.json', /^ACT-\d{3}$/, ['name', 'emoji', 'targetType', 'effects']);
    check(_db.statuses, 'status', 'statuses.json', /^STS-\d{3}$/, ['name', 'emoji']);
    check(_db.groundEffects, 'groundEffect', 'ground_effects.json', /^EFF-\d{3}$/, ['name', 'emoji']);
    check(_db.synergies, 'synergy', 'synergies.json', /^SYN-\d{3}$/, ['name']);
    check(_db.buildings, 'building', 'buildings.json', /^BLD-\d{3}$/, ['name', 'emoji', 'interiorFloorId']);

    // Deeper building validation: nested parent linkage + floorId prefixing
    try {
      for (var bi = 0; bi < _db.buildings.length; bi++) {
        var b = _db.buildings[bi];
        if (!b || !b.id) continue;
        var prefix = (b.interiorFloorId ? (String(b.interiorFloorId) + '.') : null);
        if (Array.isArray(b.nested)) {
          for (var ni = 0; ni < b.nested.length; ni++) {
            var n = b.nested[ni];
            if (!n) continue;
            if (n.parentBuildingId && n.parentBuildingId !== b.id) {
              warn('building ' + b.id + ' nested ' + (n.id || ('#' + ni)) + ' parentBuildingId mismatch: ' + n.parentBuildingId);
            }
            if (prefix && n.targetFloorId && String(n.targetFloorId).indexOf(prefix) !== 0) {
              warn('building ' + b.id + ' nested ' + (n.id || ('#' + ni)) + ' targetFloorId not under ' + b.interiorFloorId + ': ' + n.targetFloorId);
            }
          }
        }
      }
    } catch (e4) {}

  }

  var info = {
    loadedAt: null,
    counts: { items: 0, cards: 0, statuses: 0, groundEffects: 0, synergies: 0, buildings: 0 }
  };

  function load() {
    if (_loaded) return Promise.resolve(true);
    if (_loadingPromise) return _loadingPromise;

    _loadingPromise = Promise.all([
      _fetchJson(BASE + 'items.json').catch(function() { return []; }),
      _fetchJson(BASE + 'cards.json').catch(function() { return []; }),
      _fetchJson(BASE + 'statuses.json').catch(function() { return []; }),
      _fetchJson(BASE + 'ground_effects.json').catch(function() { return []; }),
      _fetchJson(BASE + 'synergies.json').catch(function() { return []; }),
      _fetchJson(BASE + 'buildings.json').catch(function() { return []; })
    ]).then(function(arr) {
      _db.items = Array.isArray(arr[0]) ? arr[0] : [];
      _db.cards = Array.isArray(arr[1]) ? arr[1] : [];
      _db.statuses = Array.isArray(arr[2]) ? arr[2] : [];
      _db.groundEffects = Array.isArray(arr[3]) ? arr[3] : [];
      _db.synergies = Array.isArray(arr[4]) ? arr[4] : [];
      _db.buildings = Array.isArray(arr[5]) ? arr[5] : [];

      _index();
      _validateLightweight();
      _loaded = true;

      info.loadedAt = Date.now();
      info.counts = {
        items: _db.items.length,
        cards: _db.cards.length,
        statuses: _db.statuses.length,
        groundEffects: _db.groundEffects.length,
        synergies: _db.synergies.length,
        buildings: _db.buildings.length
      };

      if (typeof NonCombatEventBus !== 'undefined') {
        NonCombatEventBus.emit('registry:loaded', { counts: info.counts, loadedAt: info.loadedAt });
      }

      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('gone-rogue-registry-ready', { detail: { counts: info.counts, loadedAt: info.loadedAt } }));
        }
      } catch (err) {}

      return true;
    });

    return _loadingPromise;
  }

  function isLoaded() { return _loaded; }

  function getItem(id) { return _byId.items[id] || _createMissingEntry(id, 'item'); }
  function getCard(id) { return _byId.cards[id] || _createMissingEntry(id, 'card'); }
  function listCards() { return Array.isArray(_db.cards) ? _db.cards.slice() : []; }
  function getStatus(id) { return _byId.statuses[id] || _createMissingEntry(id, 'status'); }
  function getGroundEffect(id) { return _byId.groundEffects[id] || _createMissingEntry(id, 'ground_effect'); }
  function getSynergy(id) { return _byId.synergies[id] || _createMissingEntry(id, 'synergy'); }
  function getBuilding(id) { return _byId.buildings[id] || _createMissingEntry(id, 'building'); }
  function listBuildings() { return Array.isArray(_db.buildings) ? _db.buildings.slice() : []; }
  function listInteractiveBuildings() {
    return listBuildings().filter(function(b) { return b && b.interiorFloorId && b.interiorFloorId !== 'none'; });
  }

  function listCards(filter) {
    filter = filter || {};
    var results = _db.cards.slice();

    if (filter.targetType) {
      results = results.filter(function(c) { return c && c.targetType === filter.targetType; });
    }
    if (filter.rarity) {
      results = results.filter(function(c) { return c && c.rarity === filter.rarity; });
    }
    if (typeof filter.preCombat === 'boolean') {
      results = results.filter(function(c) { return c && !!c.preCombat === filter.preCombat; });
    }
    if (Array.isArray(filter.synergyTags) && filter.synergyTags.length) {
      results = results.filter(function(c) {
        if (!c) return false;
        var tags = c.synergyTags || [];
        for (var i = 0; i < filter.synergyTags.length; i++) {
          if (tags.indexOf(filter.synergyTags[i]) !== -1) return true;
        }
        return false;
      });
    }

    return results;
  }

  function listItems() { return _db.items.slice(); }

  function findSynergiesFor(itemId, cardId) {
    // Returns synergies that either explicitly match item+card,
    // OR match itemId and share at least one tag with the card.
    var card = cardId ? getCard(cardId) : null;
    var cardTags = (card && card.synergyTags) ? card.synergyTags : [];

    return _db.synergies.filter(function(syn) {
      if (!syn) return false;
      if (syn.itemId !== itemId) return false;
      if (syn.cardId && cardId && syn.cardId === cardId) return true;

      var synTags = syn.tags || [];
      for (var i = 0; i < synTags.length; i++) {
        if (cardTags.indexOf(synTags[i]) !== -1) return true;
      }

      return false;
    });
  }

  // Eager auto-load for deterministic UI previews
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      load().catch(function() {});
    });
  } else {
    load().catch(function() {});
  }

  function ready() {
    return load();
  }

  return {
    load: load,
    ready: ready,
    info: info,
    isLoaded: isLoaded,
    getItem: getItem,
    getCard: getCard,
    listCards: listCards,
    getStatus: getStatus,
    getGroundEffect: getGroundEffect,
    getSynergy: getSynergy,
    getBuilding: getBuilding,
    listBuildings: listBuildings,
    listInteractiveBuildings: listInteractiveBuildings,
    listCards: listCards,
    listItems: listItems,
    findSynergiesFor: findSynergiesFor
  };
})();
