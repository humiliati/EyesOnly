/* ============================================================
   Discovery System — Extracted from gone-rogue.js
   Exploration mechanics with discovery tiers and rewards
   ============================================================ */

var DiscoverySystem = (function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────

  var DISCOVERY_TIERS = {
    SURFACE: {
      name: 'Surface',
      frequency: 0.40,
      visibility: 'immediate',
      rewardTypes: ['currency', 'consumable'],
      description: 'Immediately visible, modest rewards'
    },
    SEMI_HIDDEN: {
      name: 'Semi-Hidden',
      frequency: 0.30,
      visibility: 'minimal_investigation',
      rewardTypes: ['cards', 'equipment', 'currency'],
      description: 'Requires minimal investigation'
    },
    CONCEALED: {
      name: 'Concealed',
      frequency: 0.20,
      visibility: 'deliberate_action',
      rewardTypes: ['rare_cards', 'equipment'],
      description: 'Requires deliberate action to uncover'
    },
    HIDDEN: {
      name: 'Hidden',
      frequency: 0.08,
      visibility: 'outside_context',
      rewardTypes: ['legendary_items', 'secrets'],
      description: 'Requires outside-context knowledge'
    },
    META: {
      name: 'Meta',
      frequency: 0.02,
      visibility: 'multi_run',
      rewardTypes: ['narrative', 'achievements'],
      description: 'Multi-run discoveries'
    }
  };

  var DETAIL_LAYERS = {
    STRUCTURAL: 'structural',
    FUNCTIONAL: 'functional',
    NARRATIVE: 'narrative'
  };

  // ── Private State ──────────────────────────────────────────

  var _discoveries = [];
  var _metaDiscoveries = [];
  var _environmentalDetails = {};

  // ── RNG helper (uses SeededRNG if available) ───────────────

  function _rng() {
    if (typeof SeededRNG !== 'undefined' && SeededRNG.random) {
      return SeededRNG.random();
    }
    return Math.random();
  }

  // ── Discovery Generation ───────────────────────────────────

  /**
   * Generate discoveries for current floor based on tier distribution
   * @param {Array} rooms - Room objects from floor generation
   * @param {Object} biome - Current biome object
   * @param {Object} context - { floor, difficultyTier, grid, TILES, GRID_WIDTH, items, spawnCurrency, Terminal }
   * @returns {Array} discoveries array
   */
  function generateDiscoveries(rooms, biome, context) {
    _discoveries = [];

    var floor = context.floor || 1;
    var difficultyTier = context.difficultyTier || 1;

    var totalDiscoveries = Math.floor(rooms.length * 1.5) + Math.floor(difficultyTier * 0.5);

    for (var i = 0; i < totalDiscoveries; i++) {
      var tier = _selectDiscoveryTier();
      var room = rooms[Math.floor(_rng() * rooms.length)];
      var pos = _findDiscoveryPosition(room, tier, context);

      if (pos) {
        _discoveries.push({
          x: pos.x,
          y: pos.y,
          tier: tier,
          revealed: tier.visibility === 'immediate',
          contents: _generateDiscoveryContents(tier, biome),
          type: _selectDiscoveryType(tier, biome),
          interacted: false
        });
      }
    }

    return _discoveries;
  }

  function _selectDiscoveryTier() {
    var roll = _rng();
    var cumulative = 0;

    var tiers = [
      DISCOVERY_TIERS.SURFACE,
      DISCOVERY_TIERS.SEMI_HIDDEN,
      DISCOVERY_TIERS.CONCEALED,
      DISCOVERY_TIERS.HIDDEN,
      DISCOVERY_TIERS.META
    ];

    for (var i = 0; i < tiers.length; i++) {
      cumulative += tiers[i].frequency;
      if (roll <= cumulative) {
        return tiers[i];
      }
    }

    return DISCOVERY_TIERS.SURFACE;
  }

  function _findDiscoveryPosition(room, tier, context) {
    var attempts = 0;
    var maxAttempts = 20;
    var grid = context.grid;
    var TILES = context.TILES;

    while (attempts < maxAttempts) {
      var x = room.x + Math.floor(_rng() * room.width);
      var y = room.y + Math.floor(_rng() * room.height);

      if (grid[y] && grid[y][x] === TILES.EMPTY) {
        if (tier === DISCOVERY_TIERS.CONCEALED || tier === DISCOVERY_TIERS.HIDDEN) {
          var isEdge = (x === room.x || x === room.x + room.width - 1 ||
                       y === room.y || y === room.y + room.height - 1);
          if (isEdge || attempts > 10) {
            return { x: x, y: y };
          }
        } else {
          return { x: x, y: y };
        }
      }
      attempts++;
    }

    return null;
  }

  function _generateDiscoveryContents(tier, biome) {
    var contents = {
      currency: 0,
      items: [],
      cards: [],
      narrative: null
    };

    switch (tier) {
      case DISCOVERY_TIERS.SURFACE:
        contents.currency = Math.floor(_rng() * 20) + 5;
        break;
      case DISCOVERY_TIERS.SEMI_HIDDEN:
        contents.currency = Math.floor(_rng() * 40) + 15;
        if (_rng() < 0.3) {
          contents.cards.push('random_card');
        }
        break;
      case DISCOVERY_TIERS.CONCEALED:
        contents.currency = Math.floor(_rng() * 80) + 30;
        if (_rng() < 0.5) {
          contents.cards.push('rare_card');
        }
        break;
      case DISCOVERY_TIERS.HIDDEN:
        contents.currency = Math.floor(_rng() * 150) + 50;
        contents.cards.push('legendary_card');
        break;
      case DISCOVERY_TIERS.META:
        contents.narrative = _generateMetaNarrative(biome);
        break;
    }

    return contents;
  }

  function _selectDiscoveryType(tier, biome) {
    var types = {
      SURFACE: ['breakable_container', 'visible_treasure', 'obvious_crate'],
      SEMI_HIDDEN: ['locked_door', 'debris_pile', 'dark_corner'],
      CONCEALED: ['fake_wall', 'terminal_secret', 'breakable_pattern'],
      HIDDEN: ['puzzle_solution', 'secret_room', 'environmental_hint'],
      META: ['lore_fragment', 'achievement_unlock', 'cross_run_hint']
    };

    var tierTypes = types[tier.name.toUpperCase().replace('-', '_')];
    if (tierTypes && tierTypes.length > 0) {
      return tierTypes[Math.floor(_rng() * tierTypes.length)];
    }

    return 'breakable_container';
  }

  function _generateMetaNarrative(biome) {
    var narratives = [
      'You notice a pattern in the wall structure...',
      'A faded message hints at something deeper...',
      'The environment suggests a hidden connection...',
      'Something about this place feels familiar...'
    ];

    return narratives[Math.floor(_rng() * narratives.length)];
  }

  // ── Environmental Details ──────────────────────────────────

  function initializeEnvironmentalDetails(room, biome, context) {
    var BIOMES = context.BIOMES;
    var roomKey = room.x + '_' + room.y;

    _environmentalDetails[roomKey] = {
      structural: _generateStructuralLayer(room, biome),
      functional: _generateFunctionalLayer(room, biome, BIOMES),
      narrative: _generateNarrativeLayer(room, biome)
    };
  }

  function _generateStructuralLayer(room, biome) {
    return {
      walls: true,
      floor: true,
      ceiling: true,
      doors: room.doors || [],
      majorFeatures: []
    };
  }

  function _generateFunctionalLayer(room, biome, BIOMES) {
    var functional = {
      furniture: [],
      equipment: [],
      storage: []
    };

    if (BIOMES && biome === BIOMES.OFFICE) {
      functional.furniture = ['desks', 'chairs', 'cubicles'];
      functional.equipment = ['terminals', 'printers', 'phones'];
    } else if (BIOMES && biome === BIOMES.MALL) {
      functional.furniture = ['displays', 'racks', 'counters'];
      functional.equipment = ['registers', 'mannequins'];
    } else if (BIOMES && biome === BIOMES.INDUSTRIAL) {
      functional.equipment = ['machinery', 'conveyors', 'pipes'];
    }

    return functional;
  }

  function _generateNarrativeLayer(room, biome) {
    var narrative = {
      evidence: [],
      personalItems: [],
      environmentalChanges: []
    };

    if (_rng() < 0.3) {
      narrative.evidence.push('struggle_marks');
    }
    if (_rng() < 0.2) {
      narrative.personalItems.push('abandoned_photo');
    }
    if (_rng() < 0.25) {
      narrative.environmentalChanges.push('water_damage');
    }

    return narrative;
  }

  // ── Interaction ────────────────────────────────────────────

  /**
   * Reveal discovery when player interacts
   * @param {number} x
   * @param {number} y
   * @param {Object} context - { items, GRID_WIDTH, spawnCurrency, Terminal }
   * @returns {boolean} true if a discovery was revealed
   */
  function revealDiscovery(x, y, context) {
    for (var i = 0; i < _discoveries.length; i++) {
      var discovery = _discoveries[i];
      if (discovery.x === x && discovery.y === y && !discovery.revealed) {
        discovery.revealed = true;
        discovery.interacted = true;
        _grantDiscoveryRewards(discovery, context);
        return true;
      }
    }
    return false;
  }

  function _grantDiscoveryRewards(discovery, context) {
    var contents = discovery.contents;

    if (contents.currency > 0 && context.spawnCurrency) {
      context.spawnCurrency(discovery.x, discovery.y, contents.currency);
    }

    if (contents.cards && contents.cards.length > 0) {
      for (var i = 0; i < contents.cards.length; i++) {
        _spawnDiscoveryCard(discovery.x, discovery.y, context);
      }
    }

    if (contents.narrative) {
      _displayNarrative(contents.narrative);
    }
  }

  function _spawnDiscoveryCard(x, y, context) {
    var items = context.items;
    var GRID_WIDTH = context.GRID_WIDTH || 40;
    var offset = items.length % 2 === 0 ? 1 : -1;
    var spawnX = Math.max(1, Math.min(GRID_WIDTH - 2, x + offset));
    items.push({ x: spawnX, y: y, quality: _rng() });
  }

  function _displayNarrative(narrative) {
    if (typeof Terminal !== 'undefined' && Terminal.print) {
      Terminal.print(narrative, 'narrative');
    }
  }

  // ── State Access ───────────────────────────────────────────

  function getDiscoveries() {
    return _discoveries;
  }

  function getMetaDiscoveries() {
    return _metaDiscoveries;
  }

  function getEnvironmentalDetails() {
    return _environmentalDetails;
  }

  function clearFloorState() {
    _discoveries = [];
    _environmentalDetails = {};
  }

  // ── Public API ─────────────────────────────────────────────

  return {
    DISCOVERY_TIERS: DISCOVERY_TIERS,
    DETAIL_LAYERS: DETAIL_LAYERS,

    generateDiscoveries: generateDiscoveries,
    revealDiscovery: revealDiscovery,
    initializeEnvironmentalDetails: initializeEnvironmentalDetails,

    getDiscoveries: getDiscoveries,
    getMetaDiscoveries: getMetaDiscoveries,
    getEnvironmentalDetails: getEnvironmentalDetails,
    clearFloorState: clearFloorState
  };
})();
