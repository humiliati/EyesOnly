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
    buildings: [],
    enemyCards: [],
    enemyDecks: {},
    lightingConfig: null,
    biomes: null,
    interiorBiomes: null
  };

  var _byId = {
    items: {},
    cards: {},
    statuses: {},
    groundEffects: {},
    synergies: {},
    buildings: {},
    enemyCards: {}
  };

  var _nameToId = {};  // item name → ITM-XXX, built at _index() time

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
    _byId.enemyCards = idx(_db.enemyCards, {});
    // enemyDecks is already keyed by enemy type, no re-index needed

    // Build item name→ID map for legacy lookup (used by gamestate._legacyItemNameToId)
    _nameToId = {};
    for (var ni = 0; ni < _db.items.length; ni++) {
      var nit = _db.items[ni];
      if (nit && nit.name && nit.id) _nameToId[nit.name] = nit.id;
    }
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

    check(_db.enemyCards, 'enemyCard', 'enemy-cards.json', /^EATK-\d{3}$/, ['name', 'emoji', 'intentType']);

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
    counts: { items: 0, cards: 0, statuses: 0, groundEffects: 0, synergies: 0, buildings: 0, enemyCards: 0, enemyDecks: 0 }
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
      _fetchJson(BASE + 'buildings.json').catch(function() { return []; }),
      _fetchJson(BASE + 'enemy-cards.json').catch(function() { return []; }),
      _fetchJson(BASE + 'enemy-decks.json').catch(function() { return {}; }),
      _fetchJson(BASE + 'lighting-config.json').catch(function() { return null; }),
      _fetchJson(BASE + 'biomes.json').catch(function() { return null; }),
      _fetchJson(BASE + 'boss-biomes.json').catch(function() { return null; }),
      _fetchJson(BASE + 'interior-biomes.json').catch(function() { return null; })
    ]).then(function(arr) {
      _db.items = Array.isArray(arr[0]) ? arr[0] : [];
      _db.cards = Array.isArray(arr[1]) ? arr[1] : [];
      _db.statuses = Array.isArray(arr[2]) ? arr[2] : [];
      _db.groundEffects = Array.isArray(arr[3]) ? arr[3] : [];
      _db.synergies = Array.isArray(arr[4]) ? arr[4] : [];
      _db.buildings = Array.isArray(arr[5]) ? arr[5] : [];
      _db.enemyCards = Array.isArray(arr[6]) ? arr[6] : [];
      _db.enemyDecks = (arr[7] && typeof arr[7] === 'object' && !Array.isArray(arr[7])) ? arr[7] : {};
      _db.lightingConfig = (arr[8] && typeof arr[8] === 'object') ? arr[8] : null;
      _db.biomes = (arr[9] && typeof arr[9] === 'object' && !Array.isArray(arr[9])) ? arr[9] : null;

      // Merge boss biomes into the main biomes map (BUG 11 FIX)
      var bossBiomes = (arr[10] && typeof arr[10] === 'object' && !Array.isArray(arr[10])) ? arr[10] : null;
      if (bossBiomes && _db.biomes) {
        var bossKeys = Object.keys(bossBiomes);
        for (var bi = 0; bi < bossKeys.length; bi++) {
          _db.biomes[bossKeys[bi]] = bossBiomes[bossKeys[bi]];
        }
        console.log('[Registry] Merged ' + bossKeys.length + ' boss biomes: ' + bossKeys.join(', '));
      } else if (bossBiomes && !_db.biomes) {
        _db.biomes = bossBiomes;
      }

      // Load interior biomes (separate from main biomes — keyed by INTERIOR_* ids)
      _db.interiorBiomes = (arr[11] && typeof arr[11] === 'object' && !Array.isArray(arr[11])) ? arr[11] : null;
      if (_db.interiorBiomes) {
        console.log('[Registry] Loaded ' + Object.keys(_db.interiorBiomes).length + ' interior biomes');
      }

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
        buildings: _db.buildings.length,
        enemyCards: _db.enemyCards.length,
        enemyDecks: Object.keys(_db.enemyDecks).filter(function(k) { return k !== '_schema'; }).length,
        lightingConfig: _db.lightingConfig ? 1 : 0,
        biomes: _db.biomes ? Object.keys(_db.biomes).length : 0
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

  /* ── Hot-reload support (Phase 4) ──
     Allows the designer portal to trigger a full re-fetch of all JSON
     registries without a page reload. Portal sends a BroadcastChannel
     message; the game picks it up and refreshes in-memory data.
  */
  function reload() {
    _loaded = false;
    _loadingPromise = null;
    return load().then(function(result) {
      try { console.log('[Registry] Hot-reloaded at ' + new Date().toLocaleTimeString()); } catch (e) {}

      if (typeof NonCombatEventBus !== 'undefined') {
        NonCombatEventBus.emit('registry:reloaded', { counts: info.counts, reloadedAt: Date.now() });
      }
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('gone-rogue-registry-reloaded', { detail: { counts: info.counts, reloadedAt: Date.now() } }));
        }
      } catch (err) {}

      return result;
    });
  }

  // Listen for portal reload messages via BroadcastChannel
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      var _portalChannel = new BroadcastChannel('gone-rogue-portal');
      _portalChannel.onmessage = function(ev) {
        if (!ev.data) return;
        if (ev.data.type === 'registry-reload') {
          console.log('[Registry] Reload requested by portal');
          reload();
        }
        if (ev.data.type === 'grant-item' && typeof window !== 'undefined') {
          // Forward item grant to game via CustomEvent
          window.dispatchEvent(new CustomEvent('gone-rogue-grant-item', { detail: ev.data.payload }));
        }
      };
    }
  } catch (bcErr) {
    try { console.warn('[Registry] BroadcastChannel not available:', bcErr.message); } catch (e) {}
  }

  function getItem(id) { return _byId.items[id] || _createMissingEntry(id, 'item'); }
  function _convertEnemyCardToPlayerCard(enemyCard) {
    if (!enemyCard || !enemyCard.id) return null;

    // Convert EATK-* shape into a player-card-like shape used across UI/combat.
    return {
      id: enemyCard.id,
      name: enemyCard.name || enemyCard.id,
      emoji: enemyCard.emoji || '🃏',
      targetType: (enemyCard.targetType === 'self') ? 'self' : 'enemy',
      cost: 0,
      costs: null,
      consumesOnPlay: true,
      rarity: enemyCard.rarity || 'uncommon',
      effects: Array.isArray(enemyCard.effects) ? enemyCard.effects : [{ type: 'damage', value: Math.max(1, Number(enemyCard.damage || 1) || 1) }],
      preCombat: true,
      synergyTags: Array.isArray(enemyCard.synergyTags) ? enemyCard.synergyTags : [],
      _enemyCard: true
    };
  }

  function getCard(id) {
    // Allow stolen enemy cards (EATK-###) to behave as player cards.
    if (typeof id === 'string' && /^EATK-\d{3}$/.test(id)) {
      var ec = getEnemyCard(id);
      if (ec && !ec._missing) {
        return _convertEnemyCardToPlayerCard(ec);
      }
    }
    return _byId.cards[id] || _createMissingEntry(id, 'card');
  }
  function listCards() { return Array.isArray(_db.cards) ? _db.cards.slice() : []; }
  function getStatus(id) { return _byId.statuses[id] || _createMissingEntry(id, 'status'); }
  function getGroundEffect(id) { return _byId.groundEffects[id] || _createMissingEntry(id, 'ground_effect'); }
  function getSynergy(id) { return _byId.synergies[id] || _createMissingEntry(id, 'synergy'); }
  function getBuilding(id) { return _byId.buildings[id] || _createMissingEntry(id, 'building'); }
  function listBuildings() { return Array.isArray(_db.buildings) ? _db.buildings.slice() : []; }

  // ── Enemy card/deck accessors ──
  function getEnemyCard(id) { return _byId.enemyCards[id] || _createMissingEntry(id, 'enemy_card'); }
  function listEnemyCards() { return Array.isArray(_db.enemyCards) ? _db.enemyCards.slice() : []; }
  function getEnemyDeck(enemyType) {
    var key = (enemyType || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    return _db.enemyDecks[key] || null;
  }
  function listEnemyDeckTypes() {
    return Object.keys(_db.enemyDecks).filter(function(k) { return k !== '_schema'; });
  }
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

  function getLightingConfig() {
    return _db.lightingConfig;
  }

  function getBiomes() {
    return _db.biomes;
  }

  function getInteriorBiomes() {
    return _db.interiorBiomes;
  }

  function getInteriorBiome(id) {
    return (_db.interiorBiomes && id) ? (_db.interiorBiomes[id] || null) : null;
  }

  function ready() {
    return load();
  }

  /** Look up an item's ITM-XXX id by its display name. Returns null if not found. */
  function getItemIdByName(name) {
    if (!name) return null;
    return _nameToId[name] || null;
  }

  return {
    load: load,
    reload: reload,
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
    getItemIdByName: getItemIdByName,
    findSynergiesFor: findSynergiesFor,
    getEnemyCard: getEnemyCard,
    listEnemyCards: listEnemyCards,
    getEnemyDeck: getEnemyDeck,
    listEnemyDeckTypes: listEnemyDeckTypes,
    getLightingConfig: getLightingConfig,
    getBiomes: getBiomes,
    getInteriorBiomes: getInteriorBiomes,
    getInteriorBiome: getInteriorBiome
  };
})();
