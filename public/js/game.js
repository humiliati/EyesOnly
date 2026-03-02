/* ============================================================
   EYES ONLY - Gone Rogue Mode Engine
   ASCII stealth roguelike inside terminal column
   ============================================================ */

var GoneRogue = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_rogue_state';
  var _active = false;
  var _loaded = false;

  // Grid configuration (mobile-first)
  var GRID_WIDTH = 40;
  var GRID_HEIGHT = 20;

  var _grid = [];
  var _player = Player.getPlayer();


  var _ropeManager = null;

  var _enemies = [];
  var _npcs = []; // NPCs on floor (tutorial gates, etc.)
  // NOTE: Don't touch WorldItems at script-load time.
  // Some pages load GoneRogue before WorldItems is initialized; referencing it
  // here prevents the entire module from registering (breaking requestRogue).
  // We sync with WorldItems lazily when the game starts / floor loads.

  var _placedBoxes = []; // Deployable box entities placed on the map {id, x, y, quality, state, discoveryCount}
  var _playerInBox = null; // Box entity the player is currently hiding inside (or null)
  var TILES = {};
  var TILE_EFFECTS = {};
  var AWARENESS_STATES = {};
  var PATH_TYPES = {};
  var FLOOR_TYPES = {};
  var BONFIRE_FLOORS = [];
  var BOSS_FLOORS = [];
  var _turn = 0;
  var _floor = 1;
  var _alertLevel = 'safe'; // safe, caution, danger
  var _useInteractiveGrid = false; // Use interactive DOM grid instead of text-only
  var _muzzleFlash = null; // Track muzzle flash {x, y, time}
  var _impactEffects = []; // Track impact effects {x, y, type, time}

  // Performance caches — rebuilt on floor generation, reused every tick
  var _wallCache = []; // Cached wall positions for LightingSystem (avoids 800-iteration scan per tick)
  var _lightMapTickCounter = 0; // Throttle full light-map recalc to every 5 ticks (~500ms)

  // Game loop state
  var _gameLoopActive = false;
  var _lastTickTime = 0;
  var _tickInterval = 100; // ms between ticks (10 ticks per second)
  var _animationFrameId = null;
  var _projectileTickAccum = 0; // Accumulator for projectile speed throttle (ms)
  var _projectileAdvanceInterval = 150; // Advance projectiles every 150ms for visible animation
  var _enemyColorCycleTime = 0;



  // Performance caches
  var _stealthBonusCache = null; // { bonus, px, py } — invalidated when player moves

  // Boss encounter state
  var _activeBoss = null; // Current boss instance (from BossEncounters module)
  var _bossFloorActive = false; // Is this a boss floor
  var _bossDefeated = false; // Has boss been defeated this floor
  var _bossHazards = []; // Boss-specific hazards (trains, drones, etc.)
  var _bossEnvironment = {}; // Boss-specific environment data
  var _playerMoveLocked = false; // Set by Asteroids boss; disables walk commands
  return {
    init: init,
    start: start,
    process: process,
    isActive: isActive,
    getPrompt: getPrompt,
    handleTapMove: handleTapMove,
    handleFishingMove: handleFishingMove,
    isWalkable: isWalkable,
    handleCardSwipe: handleCardSwipe,
    playCardFromHand: playCardFromHand,
    playCardsFromHand: playCardsFromHand,
    getPlayer: Player.getPlayer,
    movePlayer: Player.movePlayer,
    updatePlayerLight: Player.updatePlayerLight,
    getBreakables: Items.getBreakables,
    getBreakableAt: _getBreakableAt,
    removeBreakableAt: _removeBreakableAt,
    pickupItem: Items.pickupItem,
    kickBreakable: Items.kickBreakable,
    showVendor: Items.showVendor,
    buyFromVendor: Items.buyFromVendor,

    // Deployed box system
    isBoxDeployItem: function(itemId) { return _BOX_DEPLOY_IDS.indexOf(itemId) !== -1; },
    isValidBoxPlacement: _isValidBoxPlacement,
    placeBox: function(gridPos, itemId, quality) {
      if (!gridPos || !_isValidBoxPlacement(gridPos.x, gridPos.y)) return null;
      var box = _placeBoxAt(gridPos.x, gridPos.y, quality, itemId);
      // Remove item from persistent inventory
      if (typeof GAMESTATE !== 'undefined') {
        var inv = GAMESTATE.getPersistentInventory();
        var idx = -1;
        for (var _bi = 0; _bi < inv.length; _bi++) {
          if (inv[_bi] && inv[_bi].id === itemId) { idx = _bi; break; }
        }
        if (idx !== -1 && GAMESTATE.removePersistentInventoryItem) {
          GAMESTATE.removePersistentInventoryItem(idx);
        }
      }
      return box;
    },
    getBoxAt: _getBoxAt,
    removeBoxAt: function(x, y) {
      var box = _getBoxAt(x, y);
      if (box) _destroyBox(box);
    },
    getPlacedBoxes: function() { return _placedBoxes.slice(); },
    getProjectiles: function() { return _projectiles; },
    fireProjectile: _fireProjectile,
    fireProjectileAtTarget: fireProjectileAtTarget,
    stepProjectiles: stepProjectiles,
    isStrCombatActive: Combat.isStrCombatActive,
    getStrCombatState: Combat.getStrCombatState,
    setStrCombatPhase: Combat.setStrCombatPhase,
    passStrTurn: function() {
      // Pass player's combat turn — enemy attacks unopposed (called on timer expiry)
      if (Combat.isStrCombatActive()) {
        return Combat.executeStrRound('enemy');
      }
    },
    triggerActiveItem: triggerActiveItem,
    useActiveItemAt: useActiveItemAt,
    applyNonCombatCardAt: applyNonCombatCardAt,
    updatePlayerLight: _updatePlayerLight,
    getBiomeBackgroundColor: Rendering.getBiomeBackgroundColor,
    getTileRenderObjects: Rendering.getTileRenderObjects,

    // Difficulty tier system
    setDifficulty: setDifficulty,
    getDifficulty: getDifficulty,
    getDesiredDifficulty: getDesiredDifficulty,
    onStateChange: onStateChange,

    // Seed-based generation system
    getSeed: getSeed,
    getSeedPhrase: getSeedPhrase,
    setSeed: setSeed,
    getSeededRNG: getSeededRNG,

    // Forest biome generation API (per spec)
    createBordersForest: createBordersForest,
    generateForestOpenSpace: generateForestOpenSpace,
    placeVillageCluster: placeVillageCluster,

    // Exploration framework API (for testing)
    DISCOVERY_TIERS: DISCOVERY_TIERS,
    DETAIL_LAYERS: DETAIL_LAYERS,
    _generateDiscoveries: _generateDiscoveries,
    _revealDiscovery: _revealDiscovery,
    _initializeEnvironmentalDetails: _initializeEnvironmentalDetails,

    // Pet system debug API
    spawnTestPets: spawnTestPets,

    // Headless mode API (for testing/agent simulation)
    headless: {
      getState: getState,
      getLegalActions: getLegalActions,
      applyAction: applyAction,
      getGrid: getGrid,
      resetToState: resetToState
    }
  };
})();