/* ============================================================
   EYES ONLY - Gone Rogue Mode Engine
   ASCII stealth roguelike inside terminal column
   ============================================================ */

const GoneRogue = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_rogue_state';
  var _active = false;
  var _loaded = false;

  // Grid configuration (mobile-first)
  var GRID_WIDTH = 40;
  var GRID_HEIGHT = 20;

  var _grid = [];
  var _player = {
    x: 5,
    y: 10,
    hp: 10,
    maxHp: 10,
    energy: 5,
    maxEnergy: 5,
    stealth: 3,
    detection: 0,
    lastMoveDirection: null, // Track last move direction for flanking logic (north, south, east, west)
    str: 5, // Strength for combat
    dex: 5, // Dexterity for hit/dodge
    initiative: 0, // Initiative bonus
    combatEntries: 0, // Track total combat entries (for boss mythic conditions)
    lastCardType: null // Track last card used (for boss mythic conditions)
  };

  var _enemies = [];
  var _items = [];
  var _projectiles = [];
  var _breakables = [];
  var _currencies = []; // Currency drops on floor (yellow dots ¢)
  var _turn = 0;
  var _floor = 1;
  var _alertLevel = 'safe'; // safe, caution, danger
  var _useInteractiveGrid = false; // Use interactive DOM grid instead of text-only

  // Game loop state
  var _gameLoopActive = false;
  var _lastTickTime = 0;
  var _tickInterval = 100; // ms between ticks (10 ticks per second)
  var _animationFrameId = null;
  var _enemyColorCycleTime = 0;

  // STR Combat state (Simultaneous Turn Resolution)
  var _strCombatActive = false;
  var _strCombatEnemy = null; // Enemy in current STR combat
  var _strCombatAdvantage = 'neutral'; // 'ambush', 'neutral', 'disadvantaged', 'flanked'
  var _strCombatRound = 0;
  var _strCombatLog = []; // Combat log messages

  // Boss encounter state
  var _activeBoss = null; // Current boss instance (from BossEncounters module)
  var _bossFloorActive = false; // Is this a boss floor
  var _bossDefeated = false; // Has boss been defeated this floor
  var _bossHazards = []; // Boss-specific hazards (trains, drones, etc.)
  var _bossEnvironment = {}; // Boss-specific environment data

  // Secret floor state
  var _activeSecretFloor = null; // Current secret floor type (if any)

  var TILES = {
    EMPTY: '.',
    WALL: '█',
    PLAYER: '🥷',
    ENEMY: '🪖',
    ITEM: '💎',
    EXIT: '🚪',
    COVER: '▓',
    BREAKABLE: '📦',
    DEBRIS: '░',
    PROJECTILE: '💥',
    DOOR: 'D',
    VENT: 'V',
    SHADOW: '░',
    SMOKE: '≈',
    GRASS: ',',
    HAZARD: '▒',
    WATER: '~'
  };

  // Tile metadata and effects
  var TILE_EFFECTS = {
    SHADOW: { stealthBonus: 30, emoji: '⬛' }, // -30% enemy detection range
    SMOKE: { stealthBonus: 40, movePenalty: 0, emoji: '🌫️' }, // Fog/smoke
    GRASS: { stealthBonus: 20, emoji: '🟩' }, // Grass/vegetation
    HAZARD: { damage: 1, emoji: '🟥' }, // Fire/acid/toxic
    WATER: { movePenalty: 1, emoji: '🟦' }, // Slow movement
    COVER: { blocksLOS: true, emoji: '▓' } // Full cover
  };

  // Map generation config
  var _tileMetadata = {}; // Stores tile-specific data (e.g., which tiles are shadow zones)

  // Enemy awareness states
  var AWARENESS_STATES = {
    UNAWARE: { min: 0, max: 30, color: '#00ff00', name: 'UNAWARE' },
    SUSPICIOUS: { min: 31, max: 70, color: '#ffaa00', name: 'SUSPICIOUS' },
    ALERTED: { min: 71, max: 100, color: '#ff0000', name: 'ALERTED' },
    ENGAGED: { min: 100, max: 999, color: '#ff00ff', name: 'ENGAGED' }
  };

  // Enemy path types
  var PATH_TYPES = {
    PATROL: 'patrol',        // A→B→C→B (reverse on endpoint)
    CIRCULAR: 'circular',    // A→B→C→A (loop)
    ELLIPSE: 'ellipse',      // Elliptical path
    STATIONARY: 'stationary' // Rotate in place
  };

  // Floor types for run structure
  var FLOOR_TYPES = {
    TUTORIAL: 'tutorial',           // Floors 1-2: no enemies, learn movement
    GHOST: 'ghost',                 // Floors 3-4: cameras only, no combat
    STEALTH: 'stealth',             // Floors 5-9: light stealth
    BONFIRE: 'bonfire',             // Floors 10, 16, 22: safe hub with vendor
    COMBAT: 'combat',               // Standard combat floors
    EXPLORATION: 'exploration',     // High loot, few/no enemies
    BOSS: 'boss',                   // Boss encounter floors
    FINAL: 'final'                  // Floor 30: final boss
  };

  // Biome types for environmental variety
  var BIOMES = {
    GREY_CAVE: {
      name: 'Grey Cave',
      wallChar: '█',
      floorChar: '.',
      description: 'Dark underground tunnels',
      floorRange: [1, 4], // Used for early floors and secret areas
      props: [
        { emoji: '🪨', name: 'Boulder', breakable: true, hp: 2 },
        { emoji: '💧', name: 'Water Drip', breakable: false }
      ]
    },
    OFFICE: {
      name: 'Commercial Office',
      wallChar: '█',
      floorChar: '.',
      description: 'Corporate cubicles and conference rooms',
      floorRange: [5, 9],
      props: [
        { emoji: '📂', name: 'Filing Cabinet', breakable: true, hp: 1 },
        { emoji: '🖨️', name: 'Printer', breakable: true, hp: 1 },
        { emoji: '🪑', name: 'Office Chair', breakable: false },
        { emoji: '💼', name: 'Briefcase', breakable: false }
      ]
    },
    MALL: {
      name: 'Shopping Mall',
      wallChar: '█',
      floorChar: '.',
      description: 'Abandoned retail stores',
      floorRange: [11, 15],
      props: [
        { emoji: '🛍️', name: 'Shopping Bag', breakable: true, hp: 1 },
        { emoji: '🧸', name: 'Toy', breakable: true, hp: 1 },
        { emoji: '🥫', name: 'Canned Food', breakable: true, hp: 1 }
      ]
    },
    INDUSTRIAL: {
      name: 'Industrial Complex',
      wallChar: '█',
      floorChar: '.',
      description: 'Hazardous factory floor',
      floorRange: [17, 21],
      props: [
        { emoji: '🛢️', name: 'Oil Drum', breakable: true, hp: 2 },
        { emoji: '⚡', name: 'Exposed Wiring', breakable: false },
        { emoji: '🔥', name: 'Vent Steam', breakable: false }
      ]
    },
    AEROSPACE: {
      name: 'Aerospace Museum',
      wallChar: '█',
      floorChar: '.',
      description: 'Vast halls with missile displays',
      floorRange: [23, 30],
      props: [
        { emoji: '🚀', name: 'Rocket Scaffold', breakable: false },
        { emoji: '✈️', name: 'Hanging Plane', breakable: false }
      ]
    }
  };

  // Bonfire floors (safe hubs with vendors)
  var BONFIRE_FLOORS = [10, 16, 22];

  // Boss floors
  var BOSS_FLOORS = [10, 16, 22, 30];

  // Vendor state
  var _vendor = null;
  var _vendorInventory = [];

  // Vendor types with different personalities
  var VENDOR_TYPES = {
    SCRAP_MERCHANT: {
      name: 'Scrap Merchant',
      emoji: '🧑‍💼',
      description: 'Sells cheap junk cards and supplies',
      priceMultiplier: 0.7,
      qualityRange: [30, 70] // Low quality items
    },
    ARMS_DEALER: {
      name: 'Arms Dealer',
      emoji: '🔫',
      description: 'Sells attack cards and explosives',
      priceMultiplier: 1.2,
      qualityRange: [50, 85],
      cardFilter: ['attack']
    },
    GHOST_BROKER: {
      name: 'Ghost Broker',
      emoji: '👻',
      description: 'Sells stealth and silent cards',
      priceMultiplier: 1.5,
      qualityRange: [60, 90],
      cardFilter: ['stealth', 'movement']
    },
    RELIC_SMUGGLER: {
      name: 'Relic Smuggler',
      emoji: '💎',
      description: 'Sells rare charms and inventory expanders',
      priceMultiplier: 2.0,
      qualityRange: [70, 95]
    }
  };

  /**
   * Determine floor type based on floor number
   */
  function _getFloorType(floorNum) {
    if (floorNum <= 2) return FLOOR_TYPES.TUTORIAL;
    if (floorNum <= 4) return FLOOR_TYPES.GHOST;
    if (BONFIRE_FLOORS.indexOf(floorNum) !== -1) return FLOOR_TYPES.BONFIRE;
    if (floorNum === 30) return FLOOR_TYPES.FINAL;
    if (BOSS_FLOORS.indexOf(floorNum) !== -1) return FLOOR_TYPES.BOSS;

    // Random exploration floors (5% chance on floors 15+)
    if (floorNum >= 15 && Math.random() < 0.05) return FLOOR_TYPES.EXPLORATION;

    // Light stealth early
    if (floorNum <= 9) return FLOOR_TYPES.STEALTH;

    // Standard combat floors
    return FLOOR_TYPES.COMBAT;
  }

  /**
   * Determine biome based on floor number
   */
  function _getBiome(floorNum) {
    if (floorNum >= 23) return BIOMES.AEROSPACE;
    if (floorNum >= 17) return BIOMES.INDUSTRIAL;
    if (floorNum >= 11) return BIOMES.MALL;
    if (floorNum >= 5) return BIOMES.OFFICE;
    return BIOMES.GREY_CAVE;
  }

  function init() {
    _loadState();

    // Enable interactive grid UI for all platforms (desktop and mobile)
    _useInteractiveGrid = (typeof GoneRogueMobile !== 'undefined');

    // Initialize interactive grid UI if available
    if (_useInteractiveGrid) {
      GoneRogueMobile.init();
    }

    return Promise.resolve();
  }

  /**
   * Detect if running on mobile device
   */
  function _isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  }

  function isActive() {
    return _active;
  }

  function getPrompt() {
    return 'ROGUE> ';
  }

  /**
   * Start Gone Rogue mode
   */
  function start(context) {
    _active = true;
    _loaded = true;

    // Initialize lighting system if available
    if (typeof LightingSystem !== 'undefined') {
      LightingSystem.init();
      console.log('[GoneRogue] Lighting system initialized');
    }

    // Initialize secret floors system if available
    if (typeof SecretFloors !== 'undefined') {
      SecretFloors.init();
      console.log('[GoneRogue] Secret floors system initialized');
    }

    // Initialize ground effects system if available
    if (typeof GroundEffects !== 'undefined') {
      GroundEffects.init();
      console.log('[GoneRogue] Ground effects system initialized');
    }

    // Initialize from GAMESTATE if available
    var lines = [];
    if (typeof GAMESTATE !== 'undefined') {
      var result = GAMESTATE.enterRogueMode(context);
      lines = result.lines || [];

      // Apply charm bonuses to player stats (charms work from inventory)
      var persistent = GAMESTATE.getPersistentInventory();
      var loose = GAMESTATE.getLooseInventory();
      var allItems = persistent.concat(loose);

      var hpBonus = 0;
      var energyBonus = 0;

      allItems.forEach(function(item) {
        if (item && item.category === 'charm' && item.stats) {
          if (item.stats.hp) hpBonus += item.stats.hp;
          if (item.stats.energy) energyBonus += item.stats.energy;
        }
      });

      // Apply bonuses to max HP and energy
      if (hpBonus > 0) {
        _player.maxHp += hpBonus;
        _player.hp += hpBonus; // Also heal
      }
      if (energyBonus > 0) {
        _player.maxEnergy += energyBonus;
        _player.energy += energyBonus; // Also restore
      }
    } else {
      lines = ['', 'GONE ROGUE MODE ACTIVATED', ''];
    }

    // Generate initial floor
    _generateFloor();

    // Start game loop
    _startGameLoop();

    // Use mobile UI if available
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      GoneRogueMobile.show();
      _updateMobileGrid();

      // Suppress mobile keyboard when interactive grid is active
      if (typeof Terminal !== 'undefined' && typeof Terminal.suppressMobileKeyboard === 'function') {
        Terminal.suppressMobileKeyboard();
      }

      // Hide input line since grid is the input mechanism
      if (typeof Terminal !== 'undefined' && typeof Terminal.hideInput === 'function') {
        Terminal.hideInput();
      }

      return {
        lines: lines,
        prompt: getPrompt(),
        stayActive: true
      };
    }

    return {
      lines: lines.concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Process player command
   */
  function process(raw) {
    if (!_active) return { lines: ['ROGUE MODE INACTIVE', ''], stayActive: false };

    var cmd = (raw || '').trim().toLowerCase();

    if (!cmd) {
      return { lines: [''], prompt: getPrompt(), stayActive: true };
    }

    // FLEE command during STR combat
    if (cmd === 'flee' && _strCombatActive) {
      // Tooltip: Fleeing combat
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('flee');
      }
      return _exitStrCombat('fled');
    }

    if (cmd === 'exit' || cmd === 'quit') {
      return _exitRogue(false);
    }

    if (cmd === 'help') {
      return { lines: _helpLines(), prompt: getPrompt(), stayActive: true };
    }

    if (cmd === 'status' || cmd === 'stats') {
      return { lines: _statusLines(), prompt: getPrompt(), stayActive: true };
    }

    if (cmd === 'inventory' || cmd === 'inv') {
      return { lines: _inventoryLines(), prompt: getPrompt(), stayActive: true };
    }

    if (cmd.indexOf('shoot') === 0 || cmd.indexOf('fire') === 0) {
      return _fireProjectile(cmd);
    }

    if (cmd.indexOf('kick') === 0 || cmd.indexOf('boot') === 0) {
      return _kickBreakable(cmd);
    }

    // Movement commands
    if (cmd === 'n' || cmd === 'north' || cmd === 'w') {
      return _movePlayer(0, -1);
    }
    if (cmd === 's' || cmd === 'south' || cmd === 'x') {
      return _movePlayer(0, 1);
    }
    if (cmd === 'e' || cmd === 'east' || cmd === 'd') {
      return _movePlayer(1, 0);
    }
    if (cmd === 'west' || cmd === 'a') {
      return _movePlayer(-1, 0);
    }

    // Action commands
    if (cmd === 'take' || cmd === 'pickup' || cmd === 'get') {
      return _pickupItem();
    }

    if (cmd === 'extract') {
      return _attemptExtract();
    }

    // Bonfire vendor commands
    if (cmd === 'vendor' || cmd === 'shop' || cmd === 'merchant') {
      return _showVendor();
    }

    if (cmd.indexOf('buy') === 0) {
      return _buyFromVendor(cmd);
    }

    if (cmd === 'heal') {
      return _healAtBonfire();
    }

    if (cmd.indexOf('gamble') === 0) {
      return _gambleCard();
    }

    // Inventory transfer commands (bonfire only)
    if (cmd.indexOf('stash') === 0) {
      return _stashCard(cmd);
    }

    if (cmd.indexOf('retrieve') === 0 || cmd.indexOf('withdraw') === 0) {
      return _retrieveCard(cmd);
    }

    // Equip item to active slot
    if (cmd.indexOf('equip') === 0) {
      return _equipItem(cmd);
    }

    // Unequip active item
    if (cmd === 'unequip') {
      return _unequipItem();
    }

    return {
      lines: ['UNKNOWN COMMAND: ' + cmd, 'TYPE HELP FOR COMMANDS', ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _helpLines() {
    return [
      '',
      'GONE ROGUE COMMANDS:',
      '  N/S/E/W (or WASD)  - Move',
      '  SHOOT <dir>        - Fire projectile (ascii/emoji)',
      '  KICK <dir>         - Boot adjacent breakable',
      '  TAKE/PICKUP        - Pick up item',
      '  EXTRACT            - Extract from exit point',
      '  STATUS             - Show player stats',
      '  INVENTORY          - Show inventory',
      '',
      'BONFIRE COMMANDS (Floors 10, 16, 22):',
      '  VENDOR/SHOP        - View vendor inventory',
      '  BUY <number>       - Purchase item from vendor',
      '  HEAL               - Restore HP for ¢30',
      '  GAMBLE             - Roll random card for ¢100',
      '  STASH <number>     - Move loose item to persistent storage',
      '  RETRIEVE <number>  - Move persistent item to loose carry',
      '  EQUIP <number>     - Equip persistent item to active slot',
      '  UNEQUIP            - Unequip active item',
      '',
      '  HELP               - This help',
      '  EXIT               - Return to Street Chronicles',
      '',
      'LEGEND:',
      '  🥷 = You        🪖 = Enemy      💎 = Item',
      '  🚪 = Exit       █ = Wall       ▓ = Cover',
      '  ░ = Shadow     , = Grass      ≈ = Smoke',
      '  ▒ = Hazard     📦 = Breakable',
      '',
      'TERRAIN EFFECTS:',
      '  Shadow/Grass/Smoke = Stealth bonus',
      '  Hazard = Damage on contact',
      '  Cover = Blocks enemy vision',
      ''
    ];
  }

  function _statusLines() {
    return [
      '',
      'PLAYER STATUS:',
      '  HP: ' + _player.hp + '/' + _player.maxHp,
      '  Energy: ' + _player.energy + '/' + _player.maxEnergy,
      '  Stealth: ' + _player.stealth,
      '  Detection: ' + _player.detection,
      '  Floor: ' + _floor,
      '  Turn: ' + _turn,
      ''
    ];
  }

  function _inventoryLines() {
    var lines = ['', 'INVENTORY:'];

    if (typeof GAMESTATE !== 'undefined') {
      var persistent = GAMESTATE.getPersistentInventory();
      var loose = GAMESTATE.getLooseInventory();
      var activeItem = GAMESTATE.getActiveItem();

      // Show active item slot
      lines.push('');
      lines.push('ACTIVE SLOT:');
      if (activeItem) {
        lines.push('  ⚡ ' + activeItem.emoji + ' ' + activeItem.name + ' [EQUIPPED]');
      } else {
        lines.push('  [EMPTY - Use EQUIP command]');
      }

      lines.push('');
      lines.push('PERSISTENT (' + persistent.length + '/' + GAMESTATE.getState().persistentSlots + '):');
      if (persistent.length) {
        persistent.forEach(function(item, i) {
          lines.push('  ' + (i+1) + '. ' + item.emoji + ' ' + item.name + ' [' + item.qualityName + ']');
        });
      } else {
        lines.push('  [EMPTY]');
      }

      lines.push('');
      lines.push('LOOSE CARRY (' + loose.length + '/' + GAMESTATE.getState().looseSlots + '):');
      if (loose.length) {
        loose.forEach(function(item, i) {
          lines.push('  ' + (i+1) + '. ' + item.emoji + ' ' + item.name + ' [' + item.qualityName + ']');
        });
      } else {
        lines.push('  [EMPTY]');
      }
    }

    lines.push('');
    return lines;
  }

  function _generateFloor(secretFloorData) {
    // Initialize generation state
    _projectiles = [];
    _breakables = [];
    _items = [];
    _enemies = [];
    _tileMetadata = {};
    _activeBoss = null;
    _bossFloorActive = false;
    _bossDefeated = false;
    _bossHazards = [];
    _bossEnvironment = {};
    _activeSecretFloor = null;

    // Determine floor type
    var floorType;
    var isSecretFloor = !!secretFloorData;

    if (isSecretFloor) {
      // Set active secret floor
      _activeSecretFloor = secretFloorData.type;

      // Secret floors use special type based on secret floor data
      if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
        floorType = FLOOR_TYPES.BOSS; // Uber Mega is boss-like
      } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
        floorType = FLOOR_TYPES.EXPLORATION; // Goblin vault is maze-like
      } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
        floorType = FLOOR_TYPES.EXPLORATION; // Gray cave is safe exploration
      }
    } else {
      floorType = _getFloorType(_floor);
    }

    // Check if this is a boss floor (or secret boss floor)
    if (floorType === FLOOR_TYPES.BOSS && typeof BossEncounters !== 'undefined') {
      _bossFloorActive = true;

      // Spawn hidden boss for secret floors
      if (isSecretFloor) {
        if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
          _activeBoss = new BossEncounters.UberMegaBoss(_floor);
        } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
          _activeBoss = new BossEncounters.TreasureGoblinKingBoss(_floor);
        }
      } else {
        // Normal boss for regular boss floors
        _activeBoss = BossEncounters.createBossForFloor(_floor);
      }
    }

    var maxAttempts = 10;
    var attempt = 0;
    var validMap = false;

    // Try to generate a valid map (with stealth path validation)
    while (!validMap && attempt < maxAttempts) {
      attempt++;

      // Step 1: Create empty grid
      _grid = _createEmptyGrid();

      // Step 2: Generate rooms (varies by floor type)
      var rooms = _generateRooms(floorType);

      // Step 3: Connect rooms with corridors
      _connectRooms(rooms);

      // Step 4: Add branch connections for loops
      _addBranchConnections(rooms);

      // Step 5: Place cover
      _placeCover();

      // Step 6: Place shadow zones
      _placeShadowZones();

      // Step 7: Place environmental tiles
      _placeEnvironmentalTiles();

      // Step 8: Place player and exit
      var spawnData = _placePlayerAndExit(rooms);
      _player.x = spawnData.playerX;
      _player.y = spawnData.playerY;
      var exitX = spawnData.exitX;
      var exitY = spawnData.exitY;

      // Step 9: Place enemies (based on floor type)
      _placeEnemies(rooms, floorType);

      // Step 9b: Initialize boss if this is a boss floor
      if (_bossFloorActive && _activeBoss) {
        var bossInit = _activeBoss.initialize(_grid, _player);
        if (bossInit.success) {
          _bossEnvironment = bossInit;
          // Boss floor skips normal stealth validation
          validMap = true;
        }
      } else {
        // Step 10: Validate stealth path (non-boss floors only)
        validMap = _validateStealthPath(_player.x, _player.y, exitX, exitY);
      }

      if (!validMap && attempt < maxAttempts) {
        console.log('Map validation failed, regenerating... (attempt ' + attempt + ')');
      }
    }

    if (!validMap) {
      console.warn('Could not generate fully valid map after ' + maxAttempts + ' attempts. Using current map.');
    }

    // Place breakables (deterministic for tests)
    _spawnBreakables();

    // Place items (increased loot for exploration floors)
    _placeItems(floorType);

    // Generate lighting for this floor
    if (typeof LightingSystem !== 'undefined') {
      // Set biome for lighting
      var biome;
      var biomeName;

      if (isSecretFloor) {
        // Secret floors have special biomes
        if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
          biomeName = 'UBER_MEGA'; // Reality-breaking dark
        } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
          biomeName = 'GOBLIN_VAULT'; // Golden treasure lighting
        } else if (secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
          biomeName = 'GRAY_CAVE'; // Faint violet
        }
      } else {
        biome = _getBiome(_floor);
        biomeName = biome.name.toUpperCase().replace(/ /g, '_');
      }

      LightingSystem.setBiome(biomeName);

      // Apply darkness multiplier for uber mega
      if (isSecretFloor && secretFloorData.type === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
        LightingSystem.setDarknessMultiplier(0.3); // Extreme darkness (70% darker)
      } else if (_floor === 30 && _bossFloorActive) {
        LightingSystem.setDarknessMultiplier(0.5); // Nerf light by 50%
      } else {
        LightingSystem.setDarknessMultiplier(1.0);
      }

      // Collect wall positions for light blocking
      var walls = [];
      for (var y = 0; y < GRID_HEIGHT; y++) {
        for (var x = 0; x < GRID_WIDTH; x++) {
          if (_grid[y][x] === TILES.WALL) {
            walls.push({ x: x, y: y });
          }
        }
      }

      // Generate biome-specific light sources
      LightingSystem.generateBiomeLights(GRID_WIDTH, GRID_HEIGHT, rooms, walls);

      // Update player light based on inventory
      _updatePlayerLight();

      // Update enemy lights
      LightingSystem.updateEnemyLights(_enemies);

      // Calculate initial light map
      LightingSystem.updateLightMap(GRID_WIDTH, GRID_HEIGHT, walls);
    }

    _turn = 0;
  }

  function _createEmptyGrid() {
    var grid = [];
    for (var y = 0; y < GRID_HEIGHT; y++) {
      var row = [];
      for (var x = 0; x < GRID_WIDTH; x++) {
        // Fill with walls initially
        row.push(TILES.WALL);
      }
      grid.push(row);
    }
    return grid;
  }

  function _generateRooms(floorType) {
    // Difficulty affects room count and size
    var difficulty = _floor;

    // Bonfire floors have one large room
    if (floorType === FLOOR_TYPES.BONFIRE) {
      return [{
        x: Math.floor(GRID_WIDTH / 4),
        y: Math.floor(GRID_HEIGHT / 4),
        w: Math.floor(GRID_WIDTH / 2),
        h: Math.floor(GRID_HEIGHT / 2),
        centerX: Math.floor(GRID_WIDTH / 2),
        centerY: Math.floor(GRID_HEIGHT / 2)
      }];
    }

    // Boss floors have one large arena room
    if (floorType === FLOOR_TYPES.BOSS) {
      return [{
        x: 5,
        y: 3,
        w: 30,
        h: 14,
        centerX: 20,
        centerY: 10,
        isBossArena: true
      }];
    }

    var numRooms = Math.min(4 + Math.floor(difficulty / 2), 8);

    var rooms = [];
    var maxAttempts = 50;

    for (var i = 0; i < numRooms; i++) {
      var attempts = 0;
      var room = null;

      while (attempts < maxAttempts && !room) {
        attempts++;

        // Room dimensions
        var minSize = 4;
        var maxWidth = difficulty > 5 ? 12 : 10;
        var maxHeight = difficulty > 5 ? 10 : 8;

        var w = Math.floor(Math.random() * (maxWidth - minSize + 1)) + minSize;
        var h = Math.floor(Math.random() * (maxHeight - minSize + 1)) + minSize;
        var x = Math.floor(Math.random() * (GRID_WIDTH - w - 4)) + 2;
        var y = Math.floor(Math.random() * (GRID_HEIGHT - h - 4)) + 2;

        // Check if room overlaps with existing rooms (including 1-2 tile spacing)
        var spacing = 2;
        var overlaps = false;

        for (var j = 0; j < rooms.length; j++) {
          var r = rooms[j];
          if (!(x + w + spacing < r.x || x > r.x + r.w + spacing ||
                y + h + spacing < r.y || y > r.y + r.h + spacing)) {
            overlaps = true;
            break;
          }
        }

        if (!overlaps) {
          room = { x: x, y: y, w: w, h: h, centerX: Math.floor(x + w / 2), centerY: Math.floor(y + h / 2) };
        }
      }

      if (room) {
        rooms.push(room);

        // Carve out room
        for (var ry = room.y; ry < room.y + room.h; ry++) {
          for (var rx = room.x; rx < room.x + room.w; rx++) {
            if (rx >= 0 && rx < GRID_WIDTH && ry >= 0 && ry < GRID_HEIGHT) {
              _grid[ry][rx] = TILES.EMPTY;
            }
          }
        }
      }
    }

    return rooms;
  }

  function _connectRooms(rooms) {
    // Connect each room to the next one (guarantees full traversal)
    for (var i = 0; i < rooms.length - 1; i++) {
      var room1 = rooms[i];
      var room2 = rooms[i + 1];

      _carveCorridor(room1.centerX, room1.centerY, room2.centerX, room2.centerY);
    }
  }

  function _carveCorridor(x1, y1, x2, y2) {
    // Create L-shaped corridor: horizontal first, then vertical
    var x = x1;
    var y = y1;

    // Horizontal segment
    while (x !== x2) {
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        _grid[y][x] = TILES.EMPTY;
        // Make corridors 2 tiles wide for better flow
        if (y + 1 < GRID_HEIGHT) {
          _grid[y + 1][x] = TILES.EMPTY;
        }
      }
      x += (x < x2) ? 1 : -1;
    }

    // Vertical segment
    while (y !== y2) {
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        _grid[y][x] = TILES.EMPTY;
        // Make corridors 2 tiles wide
        if (x + 1 < GRID_WIDTH) {
          _grid[y][x + 1] = TILES.EMPTY;
        }
      }
      y += (y < y2) ? 1 : -1;
    }
  }

  function _addBranchConnections(rooms) {
    // Add 2-4 extra connections to create loops
    var extraConnections = Math.min(2 + Math.floor(_floor / 3), 4);

    for (var i = 0; i < extraConnections && rooms.length > 2; i++) {
      var idx1 = Math.floor(Math.random() * rooms.length);
      var idx2 = Math.floor(Math.random() * rooms.length);

      if (idx1 !== idx2 && Math.abs(idx1 - idx2) > 1) {
        var room1 = rooms[idx1];
        var room2 = rooms[idx2];
        _carveCorridor(room1.centerX, room1.centerY, room2.centerX, room2.centerY);
      }
    }
  }

  function _placeCover() {
    // Place cover on 6-10% of floor tiles
    var coverChance = 0.06 + Math.random() * 0.04;

    for (var y = 1; y < GRID_HEIGHT - 1; y++) {
      for (var x = 1; x < GRID_WIDTH - 1; x++) {
        if (_grid[y][x] === TILES.EMPTY && Math.random() < coverChance) {
          _grid[y][x] = TILES.COVER;
        }
      }
    }
  }

  function _placeShadowZones() {
    // Mark ~15% of floor tiles as shadow zones (stored in metadata)
    var shadowChance = 0.15;

    for (var y = 1; y < GRID_HEIGHT - 1; y++) {
      for (var x = 1; x < GRID_WIDTH - 1; x++) {
        if (_grid[y][x] === TILES.EMPTY && Math.random() < shadowChance) {
          var key = x + ',' + y;
          _tileMetadata[key] = { type: 'shadow', stealthBonus: 30 };
          // Visual indicator: change tile to shadow tile
          _grid[y][x] = TILES.SHADOW;
        }
      }
    }
  }

  function _placeEnvironmentalTiles() {
    // Add environmental tiles based on difficulty and biome
    var difficulty = _floor;
    var biome = _getBiome(_floor);

    // Place biome-specific ground effects if system available
    if (typeof GroundEffects !== 'undefined') {
      var effectCount = 5 + Math.floor(difficulty / 3);

      // Determine ground effects by biome
      var biomeEffects = [];
      if (biome.name === 'Shopping Mall') {
        biomeEffects = ['GLASS', 'SODA_SPILL', 'WATER'];
      } else if (biome.name === 'Industrial Plant') {
        biomeEffects = ['OIL', 'FIRE', 'INDUSTRIAL_WASTE', 'STEAM'];
      } else if (biome.name === 'Commercial Office') {
        biomeEffects = ['WATER', 'GLASS'];
      } else if (biome.name === 'Grey Cave') {
        biomeEffects = ['WATER'];
      }

      // Place ground effects
      for (var i = 0; i < effectCount && biomeEffects.length > 0; i++) {
        var x = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
        var y = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;

        if (_grid[y][x] === TILES.EMPTY) {
          var effectType = biomeEffects[Math.floor(Math.random() * biomeEffects.length)];
          GroundEffects.setGroundEffect(x, y, effectType);

          // Mark in tile metadata for rendering
          var key = x + ',' + y;
          _tileMetadata[key] = { type: 'ground_effect', groundType: effectType };
        }
      }
    }

    // Late game: add hazards and difficult terrain
    if (difficulty >= 5) {
      var hazardCount = Math.floor(difficulty / 2);
      for (var i = 0; i < hazardCount; i++) {
        var x = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
        var y = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;

        if (_grid[y][x] === TILES.EMPTY) {
          _grid[y][x] = TILES.HAZARD;
          var key = x + ',' + y;
          _tileMetadata[key] = { type: 'hazard', damage: 1 };

          // Also add fire ground effect if available
          if (typeof GroundEffects !== 'undefined') {
            GroundEffects.setGroundEffect(x, y, 'FIRE');
          }
        }
      }
    }

    // Add some grass/vegetation for stealth
    if (difficulty < 5) {
      var grassCount = 8 + Math.floor(Math.random() * 5);
      for (var i = 0; i < grassCount; i++) {
        var x = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
        var y = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;

        if (_grid[y][x] === TILES.EMPTY) {
          _grid[y][x] = TILES.GRASS;
          var key = x + ',' + y;
          _tileMetadata[key] = { type: 'grass', stealthBonus: 20 };
        }
      }
    }
  }

  function _placePlayerAndExit(rooms) {
    if (rooms.length === 0) {
      // Fallback if no rooms generated
      return { playerX: 5, playerY: 10, exitX: GRID_WIDTH - 3, exitY: GRID_HEIGHT - 3 };
    }

    // Place player in first room - ensure it's on a floor tile
    var firstRoom = rooms[0];
    var playerX = firstRoom.centerX;
    var playerY = firstRoom.centerY;

    // Validate player spawn is on a floor tile, not a wall
    var maxSpawnAttempts = 10;
    for (var attempt = 0; attempt < maxSpawnAttempts; attempt++) {
      if (_grid[playerY] && _grid[playerY][playerX] && _grid[playerY][playerX] === TILES.EMPTY) {
        // Valid spawn point
        break;
      }
      // Try adjacent tiles if center is blocked
      var offsets = [
        {dx: 0, dy: 0}, {dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1},
        {dx: 1, dy: 1}, {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}
      ];
      for (var i = 0; i < offsets.length; i++) {
        var testX = firstRoom.centerX + offsets[i].dx;
        var testY = firstRoom.centerY + offsets[i].dy;
        if (testX > 0 && testX < GRID_WIDTH - 1 && testY > 0 && testY < GRID_HEIGHT - 1 &&
            _grid[testY][testX] === TILES.EMPTY) {
          playerX = testX;
          playerY = testY;
          break;
        }
      }
    }

    // Ensure player is within bounds
    playerX = Math.max(1, Math.min(GRID_WIDTH - 2, playerX));
    playerY = Math.max(1, Math.min(GRID_HEIGHT - 2, playerY));

    // Place exit in last room (opposite quadrant)
    var lastRoom = rooms[rooms.length - 1];
    var exitX = lastRoom.centerX;
    var exitY = lastRoom.centerY;

    // Ensure minimum distance
    var distance = Math.abs(exitX - playerX) + Math.abs(exitY - playerY);
    var minDistance = Math.floor((GRID_WIDTH + GRID_HEIGHT) * 0.6);

    if (distance < minDistance && rooms.length > 1) {
      // Try to find a more distant room
      for (var i = rooms.length - 1; i >= 0; i--) {
        var room = rooms[i];
        var dist = Math.abs(room.centerX - playerX) + Math.abs(room.centerY - playerY);
        if (dist >= minDistance) {
          exitX = room.centerX;
          exitY = room.centerY;
          break;
        }
      }
    }

    // Validate exit position is on floor tile
    if (_grid[exitY] && _grid[exitY][exitX] && _grid[exitY][exitX] !== TILES.EMPTY) {
      // Find nearest empty tile for exit
      for (var radius = 1; radius < 5; radius++) {
        for (var dy = -radius; dy <= radius; dy++) {
          for (var dx = -radius; dx <= radius; dx++) {
            var testX = exitX + dx;
            var testY = exitY + dy;
            if (testX > 0 && testX < GRID_WIDTH - 1 && testY > 0 && testY < GRID_HEIGHT - 1 &&
                _grid[testY][testX] === TILES.EMPTY) {
              exitX = testX;
              exitY = testY;
              radius = 999; // Break outer loop
              break;
            }
          }
          if (radius > 100) break;
        }
      }
    }

    // Place exit tile
    _grid[exitY][exitX] = TILES.EXIT;

    return { playerX: playerX, playerY: playerY, exitX: exitX, exitY: exitY };
  }

  function _placeEnemies(rooms, floorType) {
    // No enemies on tutorial floors (1-2)
    if (floorType === FLOOR_TYPES.TUTORIAL) {
      return;
    }

    // No enemies on bonfire floors (safe zones)
    if (floorType === FLOOR_TYPES.BONFIRE) {
      return;
    }

    // Boss floors: place boss enemy only
    if (floorType === FLOOR_TYPES.BOSS && _activeBoss) {
      var bossPos = _activeBoss.bossPosition || { x: 20, y: 10 };
      var bossEnemy = _createEnemy(bossPos.x, bossPos.y, 'STATIONARY', rooms[0]);

      // Enhance boss enemy stats
      bossEnemy.hp = _activeBoss.hp;
      bossEnemy.maxHp = _activeBoss.maxHp;
      bossEnemy.isBoss = true;
      bossEnemy.bossType = _activeBoss.type;
      bossEnemy.str = 8 + Math.floor(_floor * 0.5);
      bossEnemy.dex = 8 + Math.floor(_floor * 0.5);
      bossEnemy.awareness = 100; // Boss is always alert

      // Link boss enemy to boss instance
      _activeBoss.bossEntity = bossEnemy;

      _enemies.push(bossEnemy);
      return;
    }

    // Ghost floors (3-4): only cameras/surveillance, no lethal enemies
    if (floorType === FLOOR_TYPES.GHOST) {
      // TODO: Implement camera/drone surveillance system
      return;
    }

    // Exploration floors: very few enemies
    var enemyCount;
    if (floorType === FLOOR_TYPES.EXPLORATION) {
      enemyCount = 1 + Math.floor(Math.random() * 2); // 1-2 enemies max
    } else {
      // Enemy density based on difficulty
      var difficulty = _floor;

      if (difficulty <= 3) {
        enemyCount = 4 + Math.floor(Math.random() * 3); // 4-6
      } else if (difficulty <= 7) {
        enemyCount = 7 + Math.floor(Math.random() * 4); // 7-10
      } else if (difficulty <= 15) {
        enemyCount = 10 + Math.floor(Math.random() * 6); // 10-15
      } else {
        enemyCount = 12 + Math.floor(Math.random() * 7); // 12-18
      }
    }

    enemyCount = Math.min(enemyCount, rooms.length * 3); // Don't overcrowd

    // Check if an Elite enemy should spawn on this floor
    var eliteSpawned = false;
    if (typeof EliteEnemies !== 'undefined' && EliteEnemies.shouldSpawnElite(_floor)) {
      var eliteType = EliteEnemies.getRandomEliteForFloor(_floor);
      if (eliteType && rooms.length > 0) {
        // Place elite in a random room, away from player
        var eliteRoomIdx = Math.floor(Math.random() * rooms.length);
        var eliteRoom = rooms[eliteRoomIdx];
        var eliteX = eliteRoom.x + 1 + Math.floor(Math.random() * Math.max(1, eliteRoom.w - 2));
        var eliteY = eliteRoom.y + 1 + Math.floor(Math.random() * Math.max(1, eliteRoom.h - 2));

        // Ensure elite is far from player
        if (Math.abs(eliteX - _player.x) + Math.abs(eliteY - _player.y) >= 8) {
          var elite = EliteEnemies.createElite(eliteType, eliteX, eliteY, _floor);
          if (elite) {
            // Add basic enemy properties for compatibility
            elite.path = { type: PATH_TYPES.PATROL, waypoints: [] };
            elite.pathIndex = 0;
            elite.str = 6 + Math.floor(_floor * 0.3);
            elite.dex = 6 + Math.floor(_floor * 0.3);
            _enemies.push(elite);
            eliteSpawned = true;
          }
        }
      }
    }

    for (var i = 0; i < enemyCount && rooms.length > 0; i++) {
      var roomIdx = Math.floor(Math.random() * rooms.length);
      var room = rooms[roomIdx];

      // Random position within room (avoid edges)
      var x = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
      var y = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));

      // Check minimum separation from player and other enemies
      var tooClose = false;
      var minSep = 5;

      if (Math.abs(x - _player.x) + Math.abs(y - _player.y) < minSep) {
        tooClose = true;
      }

      for (var j = 0; j < _enemies.length; j++) {
        var sep = Math.abs(x - _enemies[j].x) + Math.abs(y - _enemies[j].y);
        if (sep < 3) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) {
        i--;
        continue;
      }

      // Determine patrol type
      var patrolType = _choosePatrolType(difficulty, room);
      var enemy = _createEnemy(x, y, patrolType, room);

      _enemies.push(enemy);
    }
  }

  function _choosePatrolType(difficulty, room) {
    var rand = Math.random();

    if (difficulty <= 3) {
      // Early game: more stationary sentries
      if (rand < 0.4) return PATH_TYPES.STATIONARY;
      if (rand < 0.7) return PATH_TYPES.PATROL;
      return PATH_TYPES.CIRCULAR;
    } else {
      // Late game: more patrols
      if (rand < 0.2) return PATH_TYPES.STATIONARY;
      if (rand < 0.6) return PATH_TYPES.PATROL;
      return PATH_TYPES.CIRCULAR;
    }
  }

  function _createEnemy(x, y, patrolType, room) {
    var enemy = {
      x: x,
      y: y,
      hp: 5,
      awareness: 0,
      orientation: ['north', 'south', 'east', 'west'][Math.floor(Math.random() * 4)],
      sightRange: _floor > 5 ? 7 : 5, // Increased range on late floors
      pathTimer: 0,
      isTreasureGoblin: false, // Special enemy type
      goblinSpawnTime: null // For timeout tracking
    };

    // 2% chance to spawn a treasure goblin after floor 5
    if (_floor > 5 && Math.random() < 0.02) {
      enemy.isTreasureGoblin = true;
      enemy.goblinSpawnTime = Date.now();
      enemy.hp = 3; // Low HP, must kill fast
      enemy.sightRange = 10; // Goblins see player from far
      enemy.awareness = 5; // Always aware, always fleeing
    }

    if (patrolType === PATH_TYPES.STATIONARY) {
      enemy.path = { type: PATH_TYPES.STATIONARY };
    } else if (patrolType === PATH_TYPES.PATROL) {
      // Create patrol path within room
      var points = [
        { x: room.x + 1, y: room.y + 1 },
        { x: room.x + room.w - 2, y: room.y + 1 },
        { x: room.x + room.w - 2, y: room.y + room.h - 2 },
        { x: room.x + 1, y: room.y + room.h - 2 }
      ];
      enemy.path = { type: PATH_TYPES.PATROL, points: points };
      enemy.pathIndex = 0;
      enemy.pathDirection = 1;
    } else if (patrolType === PATH_TYPES.CIRCULAR) {
      // Circular patrol around room center
      var cx = room.centerX;
      var cy = room.centerY;
      var radius = Math.min(room.w, room.h) / 3;
      var points = [
        { x: Math.floor(cx + radius), y: cy },
        { x: cx, y: Math.floor(cy + radius) },
        { x: Math.floor(cx - radius), y: cy },
        { x: cx, y: Math.floor(cy - radius) }
      ];
      enemy.path = { type: PATH_TYPES.CIRCULAR, points: points };
      enemy.pathIndex = 0;
    }

    return enemy;
  }

  function _placeItems(floorType) {
    // Base item count
    var itemCount = 5;

    // Increased loot on tutorial floors
    if (floorType === FLOOR_TYPES.TUTORIAL) {
      itemCount = 8;
    }

    // High loot on exploration floors
    if (floorType === FLOOR_TYPES.EXPLORATION) {
      itemCount = 12;
    }

    // Some loot on bonfire floors
    if (floorType === FLOOR_TYPES.BONFIRE) {
      itemCount = 3;
    }

    var attempts = 0;
    var maxAttempts = 50;

    for (var i = 0; i < itemCount && attempts < maxAttempts; i++) {
      attempts++;

      var ix = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
      var iy = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;

      var occupied = _grid[iy][ix] !== TILES.EMPTY ||
        (_breakables.some(function(b) { return b.x === ix && b.y === iy && b.hp > 0; })) ||
        _enemies.some(function(e) { return e.x === ix && e.y === iy; }) ||
        (ix === _player.x && iy === _player.y);

      if (occupied) {
        i--;
        continue;
      }

      // Generate random card
      if (typeof CardSystem !== 'undefined') {
        var baseType = CardSystem.getRandomBaseCard();
        var card = CardSystem.rollCard(baseType);
        _items.push({ x: ix, y: iy, card: card, spawnTime: Date.now(), decayTime: 30000 }); // 30 second decay
      }
    }
  }

  function _validateStealthPath(startX, startY, endX, endY) {
    // Simple BFS pathfinding to check if path exists
    // Count how many enemy vision cones the path crosses

    var queue = [{ x: startX, y: startY, steps: 0 }];
    var visited = {};
    visited[startX + ',' + startY] = true;

    var found = false;
    var minVisionCrosses = Infinity;

    while (queue.length > 0 && queue[0].steps < 100) {
      var current = queue.shift();

      if (current.x === endX && current.y === endY) {
        found = true;
        break;
      }

      var neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 }
      ];

      for (var i = 0; i < neighbors.length; i++) {
        var n = neighbors[i];
        var key = n.x + ',' + n.y;

        if (n.x >= 0 && n.x < GRID_WIDTH && n.y >= 0 && n.y < GRID_HEIGHT &&
            !visited[key] && _grid[n.y][n.x] !== TILES.WALL) {
          visited[key] = true;
          queue.push({ x: n.x, y: n.y, steps: current.steps + 1 });
        }
      }
    }

    // Map is valid if path exists
    return found;
  }

  function _spawnBreakables() {
    // Get current biome
    var biome = _getBiome(_floor);

    // Spawn biome-specific breakables
    _breakables = [];

    // Spawn 8-12 random breakables from the biome's prop list
    var breakableCount = 8 + Math.floor(Math.random() * 5);
    var breakableProps = biome.props.filter(function(p) { return p.breakable; });

    if (breakableProps.length === 0) {
      // Fallback to generic crates if biome has no breakable props
      breakableProps = [{ emoji: '📦', name: 'Crate', breakable: true, hp: 2 }];
    }

    for (var i = 0; i < breakableCount; i++) {
      var attempts = 0;
      var placed = false;

      while (!placed && attempts < 50) {
        var x = 2 + Math.floor(Math.random() * (GRID_WIDTH - 4));
        var y = 2 + Math.floor(Math.random() * (GRID_HEIGHT - 4));

        // Check if position is valid (floor tile, not player, not exit, not occupied)
        if (_grid[y] && _grid[y][x] === TILES.EMPTY &&
            !(x === _player.x && y === _player.y) &&
            !_breakables.find(function(b) { return b.x === x && b.y === y; })) {

          var propTemplate = breakableProps[Math.floor(Math.random() * breakableProps.length)];
          _breakables.push({
            x: x,
            y: y,
            hp: propTemplate.hp,
            maxHp: propTemplate.hp,
            glyph: TILES.BREAKABLE,
            destroyedGlyph: TILES.DEBRIS,
            emoji: propTemplate.emoji,
            name: propTemplate.name,
            tag: 'biome_prop_' + i
          });

          placed = true;
        }
        attempts++;
      }
    }

    // Place on grid
    _breakables.forEach(function(breakable) {
      if (_grid[breakable.y] && _grid[breakable.y][breakable.x]) {
        _grid[breakable.y][breakable.x] = TILES.BREAKABLE;
      }
    });
  }

  /**
   * Spawn currency (cryptos ¢) at a location
   */
  function _spawnCurrency(x, y, amount) {
    _currencies.push({
      x: x,
      y: y,
      amount: amount,
      glyph: '¢',
      emoji: '💰',
      spawnTime: Date.now(),
      decayTime: 20000 // 20 second decay for currency
    });
  }

  function _renderGrid() {
    var lines = [''];

    // Copy grid for rendering
    var display = _grid.map(function(row) { return row.slice(); });

    // Place breakables
    _breakables.forEach(function(breakable) {
      if (breakable.hp > 0) {
        display[breakable.y][breakable.x] = breakable.glyph || TILES.BREAKABLE;
      } else if (breakable.destroyedGlyph) {
        display[breakable.y][breakable.x] = breakable.destroyedGlyph;
      }
    });

    // Place enemies
    _enemies.forEach(function(enemy) {
      if (enemy.hp > 0) {
        display[enemy.y][enemy.x] = TILES.ENEMY;
      }
    });

    // Place items
    _items.forEach(function(item) {
      display[item.y][item.x] = TILES.ITEM;
    });

    // Place projectiles
    _projectiles.forEach(function(projectile) {
      display[projectile.y][projectile.x] = projectile.glyph || TILES.PROJECTILE;
    });

    // Place player
    display[_player.y][_player.x] = TILES.PLAYER;

    // Render grid
    for (var y = 0; y < GRID_HEIGHT; y++) {
      lines.push(display[y].join(''));
    }

    lines.push('');
    var biome = _getBiome(_floor);
    var floorLabel;

    // Show secret floor name if active
    if (_activeSecretFloor) {
      if (_activeSecretFloor === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
        floorLabel = 'SECRET: ⚠️ UBER MEGA ⚠️';
      } else if (_activeSecretFloor === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
        floorLabel = 'SECRET: 💰 Goblin Vault 💰';
      } else if (_activeSecretFloor === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
        floorLabel = 'SECRET: 🌫️ Gray Cave 🌫️';
      }
    } else {
      floorLabel = 'Floor: ' + _floor + ' | ' + biome.name;
    }

    if (_bossFloorActive && !_bossDefeated) {
      floorLabel += ' 👹 BOSS FLOOR';
    } else if (_bossFloorActive && _bossDefeated) {
      floorLabel += ' ✅ BOSS DEFEATED';
    }
    lines.push('HP: ' + _player.hp + '/' + _player.maxHp + ' | ' + floorLabel + ' | Turn: ' + _turn);
    if (_bossFloorActive && _activeBoss && !_bossDefeated) {
      lines.push('⚠️  Boss: ' + _activeBoss.type + ' | Phase: ' + _activeBoss.phase);
    }
    lines.push('');

    return lines;
  }

  /**
   * Helper to update mobile grid rendering with state
   */
  function _updateMobileGrid() {
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles, _alertLevel, _strCombatActive);
    }
  }

  function _movePlayer(dx, dy, runMode) {
    // Block movement during STR combat
    if (_strCombatActive) {
      return {
        lines: ['⚔️  MOVEMENT LOCKED - STR COMBAT IN PROGRESS', 'Use cards to fight or type FLEE to retreat', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var newX = _player.x + dx;
    var newY = _player.y + dy;

    // Track last move direction for flanking logic
    if (dx === 1) {
      _player.lastMoveDirection = 'east';
    } else if (dx === -1) {
      _player.lastMoveDirection = 'west';
    } else if (dy === 1) {
      _player.lastMoveDirection = 'south';
    } else if (dy === -1) {
      _player.lastMoveDirection = 'north';
    }

    // Check bounds
    if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) {
      return {
        lines: ['CANNOT MOVE THERE', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Check collision
    var tile = _grid[newY][newX];
    if (tile === TILES.WALL) {
      return {
        lines: ['WALL BLOCKS PATH', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var blockingBreakable = _getBreakableAt(newX, newY);
    if (blockingBreakable && blockingBreakable.hp > 0) {
      return {
        lines: [blockingBreakable.emoji + ' BREAKABLE BLOCKS PATH', 'USE SHOOT OR KICK TO CLEAR', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Move player
    _player.x = newX;
    _player.y = newY;
    _turn++;

    // Check if player walked onto EXIT tile - trigger level transition
    if (tile === TILES.EXIT) {
      return _attemptExtract();
    }

    // Check for currency pickup
    var cryptoPickup = _currencies.find(function(c) { return c.x === newX && c.y === newY; });
    var cryptoMessage = null;
    if (cryptoPickup) {
      if (typeof GAMESTATE !== 'undefined') {
        var result = GAMESTATE.addCryptos(cryptoPickup.amount);
        cryptoMessage = result.message;
      }
      // Remove currency from floor
      _currencies = _currencies.filter(function(c) { return c.x !== newX || c.y !== newY; });

      // Tooltip: Currency pickup
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('currency-pickup', { amount: cryptoPickup.amount });
      }
    }

    // Apply tile effects
    var tileEffectMessage = _applyTileEffects(newX, newY);

    // Run mode increases detection and makes noise
    if (runMode) {
      _player.detection += 2;
      _updateAlertLevel();

      // Nearby enemies hear player noise when running
      _enemies.forEach(function(enemy) {
        if (enemy.hp <= 0) return;
        var dist = Math.abs(enemy.x - newX) + Math.abs(enemy.y - newY);
        if (dist <= 5) {
          _increaseEnemyAwareness(enemy, 15); // Significant awareness increase from noise
        }
      });

      // Tooltip: Running
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('move', { run: true });
      }
    } else {
      _player.detection = Math.max(0, _player.detection - 0.5);
      _updateAlertLevel();

      // Tooltip: Walking
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('move', { run: false });
      }
    }

    // Check for enemy collision - trigger STR combat
    var hitEnemy = _enemies.find(function(e) { return e.x === newX && e.y === newY && e.hp > 0; });
    if (hitEnemy) {
      // Enter STR combat mode
      return _enterStrCombat(hitEnemy, 'collision');
    }

    _saveState();

    var messageLines = [];
    if (cryptoMessage) messageLines.push(cryptoMessage);
    if (tileEffectMessage) messageLines.push(tileEffectMessage);
    var lines = messageLines.length > 0 ? messageLines.concat(['']).concat(_renderGrid()) : _renderGrid();

    return {
      lines: lines,
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Apply tile effects when player enters a tile
   */
  function _applyTileEffects(x, y) {
    var tile = _grid[y][x];
    var key = x + ',' + y;
    var metadata = _tileMetadata[key];
    var message = null;

    // Hazard damage
    if (tile === TILES.HAZARD || (metadata && metadata.type === 'hazard')) {
      var damage = metadata ? metadata.damage : 1;
      _player.hp -= damage;
      message = '🟥 HAZARD! -' + damage + ' HP';

      if (_player.hp <= 0) {
        return _exitRogue(false);
      }
    }

    // Stealth bonuses (applied passively during detection checks)
    if (tile === TILES.SHADOW || tile === TILES.GRASS || tile === TILES.SMOKE) {
      if (tile === TILES.SHADOW) {
        message = '⬛ Entered shadow (stealth +30%)';
      } else if (tile === TILES.GRASS) {
        message = '🟩 Grass cover (stealth +20%)';
      } else if (tile === TILES.SMOKE) {
        message = '🌫️  Smoke/fog (stealth +40%)';
      }
    }

    return message;
  }

  /**
   * Update alert level based on detection
   */
  function _updateAlertLevel() {
    if (_player.detection >= 8) {
      _alertLevel = 'danger';
    } else if (_player.detection >= 4) {
      _alertLevel = 'caution';
    } else {
      _alertLevel = 'safe';
    }
  }

  function _pickupItem() {
    var item = _items.find(function(i) { return i.x === _player.x && i.y === _player.y; });
    if (!item) {
      return {
        lines: ['NO ITEM HERE', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Add to loose carry
    if (typeof GAMESTATE !== 'undefined') {
      var result = GAMESTATE.addToLoose(item.card);
      if (!result.success) {
        return {
          lines: [result.message, 'DROP SOMETHING FIRST', ''].concat(_renderGrid()),
          prompt: getPrompt(),
          stayActive: true
        };
      }
    }

    // Remove item from floor
    _items = _items.filter(function(i) { return i !== item; });

    // Tooltip: Item pickup
    if (typeof TooltipSystem !== 'undefined') {
      var isCard = item.card && (item.card.type === 'attack' || item.card.type === 'support' || item.card.type === 'item');
      if (isCard) {
        TooltipSystem.showAction('card-pickup', { name: item.card.name });
      } else {
        TooltipSystem.showAction('item-pickup', { name: item.card.name });
      }
    }

    return {
      lines: ['PICKED UP: ' + item.card.emoji + ' ' + item.card.name + ' [' + item.card.qualityName + ']', ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _attemptExtract() {
    var tile = _grid[_player.y][_player.x];
    if (tile !== TILES.EXIT) {
      return {
        lines: ['NO EXIT HERE', 'FIND THE EXTRACTION POINT (🚪)', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Check if this is the final floor (30) or if player wants to extract early
    var MAX_FLOORS = 30;
    if (_floor >= MAX_FLOORS) {
      return _exitRogue(true);
    }

    // Advance to next floor
    return _advanceFloor();
  }

  function _advanceFloor() {
    // Check for queued secret floor BEFORE normal floor generation
    var secretFloorData = null;
    if (typeof SecretFloors !== 'undefined' && SecretFloors.hasQueuedSecretFloor()) {
      secretFloorData = SecretFloors.popSecretFloor();
      console.log('[GoneRogue] Secret floor triggered:', secretFloorData.type);
    }

    // Check for low HP + high gold trigger (15% chance when conditions met)
    if (!secretFloorData && typeof SecretFloors !== 'undefined') {
      var triggerResult = SecretFloors.triggerSecretFloor(
        SecretFloors.TRIGGER_TYPES.LOW_HP_HIGH_GOLD,
        {
          playerHp: _player.hp,
          playerMaxHp: _player.maxHp,
          playerGold: _player.cryptos
        }
      );

      if (triggerResult.success) {
        secretFloorData = SecretFloors.popSecretFloor();
        console.log('[GoneRogue] Low HP + High Gold secret floor triggered:', secretFloorData.type);
      }
    }

    // Apply fade-out effect before transitioning
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      var gridContainer = document.getElementById('rogue-grid-mobile');
      if (gridContainer) {
        gridContainer.style.opacity = '0';
        gridContainer.style.transition = 'opacity 0.3s ease-out';
      }
    }

    // Wait for fade-out to complete before generating new floor
    setTimeout(function() {
      var isSecretFloor = !!secretFloorData;
      var secretFloorType = isSecretFloor ? secretFloorData.type : null;

      // Only advance floor number if NOT a secret floor
      if (!isSecretFloor) {
        _floor++;
      }
      _turn = 0;

      // Reset vendor for new bonfire
      _vendor = null;
      _vendorInventory = [];

      // Heal player slightly between floors (10-20% of max HP)
      var healAmount = Math.floor(_player.maxHp * (0.1 + Math.random() * 0.1));
      _player.hp = Math.min(_player.maxHp, _player.hp + healAmount);

      // After floor 1, give random 3 starter cards if player has 0 cards
      if (_floor === 2 && typeof GAMESTATE !== 'undefined' && typeof CardSystem !== 'undefined') {
        var looseInventory = GAMESTATE.getLooseInventory();
        if (looseInventory.length === 0) {
          // Define all 5 starter cards
          var allStarterCards = ['SINGLE_SHOT', 'PRONE', 'KATCHUP', 'DODGE', 'BURST_SHOT'];

          // Shuffle and pick 3 random cards
          var shuffled = allStarterCards.slice();
          for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
          }
          var selectedCards = shuffled.slice(0, 3);

          // Add the 3 selected cards to loose inventory
          for (var c = 0; c < selectedCards.length; c++) {
            var card = CardSystem.rollCard(selectedCards[c]);
            if (card) {
              GAMESTATE.addToLoose(card);
            }
          }

          lines.push('');
          lines.push('  📦 SUPPLY DROP RECEIVED');
          lines.push('  3 STARTER CARDS ADDED TO INVENTORY');
          lines.push('');
        }
      }

      // Generate next floor
      if (isSecretFloor) {
        _generateFloor(secretFloorData);
      } else {
        _generateFloor();
      }
      _startGameLoop();
      _saveState();

      var lines = [];

      if (isSecretFloor) {
        // Secret floor messaging
        lines.push('');
        lines.push('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');

        if (secretFloorType === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
          lines.push('  REALITY BREACH DETECTED');
          lines.push('  YOU SHOULD NOT BE HERE');
          lines.push('  SYSTEM INTEGRITY: 12%');
        } else if (secretFloorType === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
          lines.push('  ANOMALY DETECTED');
          lines.push('  SPACE WARPING...');
          lines.push('  TREASURE VAULT MANIFESTED');
        } else if (secretFloorType === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
          lines.push('  HIDDEN PATH REVEALED');
          lines.push('  GRAY CAVE PASSAGE');
        }

        lines.push('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');
        lines.push('');
        lines.push('  HP RESTORED: +' + healAmount);
        lines.push('');

        // Mark that we've entered a secret floor
        SecretFloors.clearCurrentSecretFloor();

      } else {
        // Normal floor messaging
        lines.push('');
        lines.push('═══════════════════════════════════════');
        lines.push('  FLOOR ' + _floor + ' - EXTRACTION SUCCESSFUL');
        lines.push('═══════════════════════════════════════');
        lines.push('');
        lines.push('  HP RESTORED: +' + healAmount);
        lines.push('  INFILTRATING DEEPER...');
        lines.push('');
      }

      // Show mobile UI with fade-in effect
      if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
        GoneRogueMobile.show();
        _updateMobileGrid();

        var gridContainer = document.getElementById('rogue-grid-mobile');
        if (gridContainer) {
          // Fade in the new floor
          setTimeout(function() {
            gridContainer.style.opacity = '1';
            gridContainer.style.transition = 'opacity 0.3s ease-in';
          }, 50);
        }
      }

      // Return result for text-based mode
      if (!_useInteractiveGrid) {
        return {
          lines: lines.concat(_renderGrid()),
          prompt: getPrompt(),
          stayActive: true
        };
      }
    }, 300); // Match fade-out duration

    // Immediately return for interactive mode
    return {
      lines: ['EXTRACTING...'],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Initialize vendor for bonfire floor
   */
  function _initializeVendor() {
    // Choose random vendor type
    var vendorTypes = Object.keys(VENDOR_TYPES);
    var randomType = vendorTypes[Math.floor(Math.random() * vendorTypes.length)];
    _vendor = VENDOR_TYPES[randomType];

    // Generate vendor inventory (5 cards)
    _vendorInventory = [];
    for (var i = 0; i < 5; i++) {
      if (typeof CardSystem !== 'undefined') {
        var baseType = CardSystem.getRandomBaseCard();
        var card = CardSystem.rollCard(baseType);

        // Calculate price based on quality and vendor multiplier
        var basePrice = 50 + Math.floor((card.quality / 100) * 150);
        var price = Math.floor(basePrice * _vendor.priceMultiplier);

        _vendorInventory.push({
          card: card,
          price: price
        });
      }
    }
  }

  /**
   * Show vendor shop
   */
  function _showVendor() {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO VENDOR HERE', 'Vendors only appear at bonfire floors (10, 16, 22)', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Initialize vendor if not done yet
    if (!_vendor) {
      _initializeVendor();
    }

    var lines = [
      '',
      '═══════════════════════════════════════',
      '  🔥 BONFIRE VENDOR 🔥',
      '  ' + _vendor.emoji + ' ' + _vendor.name,
      '  ' + _vendor.description,
      '═══════════════════════════════════════',
      ''
    ];

    // Show player's cryptos
    if (typeof GAMESTATE !== 'undefined') {
      var cryptos = GAMESTATE.getState().cryptos || 0;
      lines.push('  YOUR CRYPTOS: ¢' + cryptos);
      lines.push('');
    }

    // Show vendor inventory
    lines.push('VENDOR INVENTORY:');
    _vendorInventory.forEach(function(item, i) {
      lines.push('  ' + (i+1) + '. ' + item.card.emoji + ' ' + item.card.name + ' [' + item.card.qualityName + '] - ¢' + item.price);
    });

    lines.push('');
    lines.push('COMMANDS:');
    lines.push('  BUY <number>  - Purchase item');
    lines.push('  HEAL          - Restore 30-50% HP for ¢30');
    lines.push('  GAMBLE        - Random card roll for ¢100');
    lines.push('');

    return {
      lines: lines,
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Buy item from vendor
   */
  function _buyFromVendor(cmd) {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO VENDOR HERE', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    if (!_vendor) {
      _initializeVendor();
    }

    // Parse item number
    var parts = cmd.split(' ');
    var itemNum = parseInt(parts[1]);

    if (isNaN(itemNum) || itemNum < 1 || itemNum > _vendorInventory.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Use: BUY <1-' + _vendorInventory.length + '>', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var item = _vendorInventory[itemNum - 1];

    if (typeof GAMESTATE !== 'undefined') {
      var state = GAMESTATE.getState();
      var cryptos = state.cryptos || 0;

      if (cryptos < item.price) {
        return {
          lines: ['INSUFFICIENT FUNDS', 'Need ¢' + item.price + ', have ¢' + cryptos, ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      // Add to loose inventory
      var result = GAMESTATE.addToLoose(item.card);
      if (!result.success) {
        return {
          lines: [result.message, 'DROP SOMETHING FIRST', ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      // Deduct cryptos
      state.cryptos -= item.price;

      // Remove from vendor inventory
      _vendorInventory.splice(itemNum - 1, 1);

      _saveState();

      return {
        lines: ['PURCHASED: ' + item.card.emoji + ' ' + item.card.name, 'Remaining cryptos: ¢' + state.cryptos, ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    return {
      lines: ['PURCHASE FAILED', ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Heal at bonfire
   */
  function _healAtBonfire() {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO BONFIRE HERE', 'Healing only available at bonfire floors', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var HEAL_COST = 30;

    if (typeof GAMESTATE !== 'undefined') {
      var state = GAMESTATE.getState();
      var cryptos = state.cryptos || 0;

      if (cryptos < HEAL_COST) {
        return {
          lines: ['INSUFFICIENT FUNDS', 'Healing costs ¢' + HEAL_COST + ', have ¢' + cryptos, ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      // Heal 30-50% HP
      var healPercent = 0.3 + Math.random() * 0.2;
      var healAmount = Math.floor(_player.maxHp * healPercent);
      var oldHp = _player.hp;
      _player.hp = Math.min(_player.maxHp, _player.hp + healAmount);
      var actualHeal = _player.hp - oldHp;

      // Deduct cryptos
      state.cryptos -= HEAL_COST;

      _saveState();

      return {
        lines: [
          'HEALED: +' + actualHeal + ' HP',
          'HP: ' + _player.hp + '/' + _player.maxHp,
          'Remaining cryptos: ¢' + state.cryptos,
          ''
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    return {
      lines: ['HEAL FAILED', ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Gamble for a random card
   */
  function _gambleCard() {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO VENDOR HERE', 'Gambling only available at bonfire floors', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var GAMBLE_COST = 100;

    if (typeof GAMESTATE !== 'undefined' && typeof CardSystem !== 'undefined') {
      var state = GAMESTATE.getState();
      var cryptos = state.cryptos || 0;

      if (cryptos < GAMBLE_COST) {
        return {
          lines: ['INSUFFICIENT FUNDS', 'Gambling costs ¢' + GAMBLE_COST + ', have ¢' + cryptos, ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      // Roll random card with gambling odds
      // 70% junk (30-55%), 20% usable (55-75%), 8% strong (75-90%), 1.8% near-perfect (90-97%), 0.2% perfect (97-100%)
      var rand = Math.random() * 100;
      var targetQuality;

      if (rand < 0.2) {
        targetQuality = 97 + Math.random() * 3; // 97-100% (perfect)
      } else if (rand < 2) {
        targetQuality = 90 + Math.random() * 7; // 90-97% (near-perfect)
      } else if (rand < 10) {
        targetQuality = 75 + Math.random() * 15; // 75-90% (strong)
      } else if (rand < 30) {
        targetQuality = 55 + Math.random() * 20; // 55-75% (usable)
      } else {
        targetQuality = 30 + Math.random() * 25; // 30-55% (junk)
      }

      var baseType = CardSystem.getRandomBaseCard();
      var card = CardSystem.rollCard(baseType);

      // For simplicity, just use the rolled card's quality
      // The gambling mechanism is about the odds of getting different quality tiers

      // Add to loose inventory
      var result = GAMESTATE.addToLoose(card);
      if (!result.success) {
        return {
          lines: [result.message, 'DROP SOMETHING FIRST', ''],
          prompt: getPrompt(),
          stayActive: true
        };
      }

      // Deduct cryptos
      state.cryptos -= GAMBLE_COST;

      _saveState();

      var qualityDesc = card.quality >= 97 ? '✨ PERFECT ✨' :
                       card.quality >= 90 ? '🌟 NEAR-PERFECT' :
                       card.quality >= 75 ? '⭐ STRONG' :
                       card.quality >= 55 ? '• USABLE' : '• JUNK';

      return {
        lines: [
          '🎲 GAMBLE RESULT:',
          qualityDesc,
          card.emoji + ' ' + card.name + ' [' + card.qualityName + '] (' + Math.floor(card.quality) + '%)',
          'Remaining cryptos: ¢' + state.cryptos,
          ''
        ],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    return {
      lines: ['GAMBLE FAILED', ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Stash card from loose carry to persistent inventory (bonfire only)
   */
  function _stashCard(cmd) {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO BONFIRE HERE', 'Inventory transfer only available at bonfire floors', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Parse item number from command
    var parts = cmd.split(' ');
    if (parts.length < 2) {
      return {
        lines: ['USAGE: STASH <number>', 'Example: STASH 1', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var itemNum = parseInt(parts[1], 10) - 1; // Convert to 0-indexed
    var looseInv = GAMESTATE.getLooseInventory();

    if (itemNum < 0 || itemNum >= looseInv.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Loose carry has ' + looseInv.length + ' items', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var item = looseInv[itemNum];

    // Try to add to persistent
    var addResult = GAMESTATE.addToPersistent(item);
    if (!addResult.success) {
      return {
        lines: [addResult.message, ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Remove from loose
    GAMESTATE.removeFromLoose(itemNum);

    return {
      lines: [
        '📦 STASHED TO PERSISTENT STORAGE',
        item.emoji + ' ' + item.name,
        ''
      ].concat(_inventoryLines()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Retrieve card from persistent inventory to loose carry (bonfire only)
   */
  function _retrieveCard(cmd) {
    var floorType = _getFloorType(_floor);
    if (floorType !== FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO BONFIRE HERE', 'Inventory transfer only available at bonfire floors', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Parse item number from command
    var parts = cmd.split(' ');
    if (parts.length < 2) {
      return {
        lines: ['USAGE: RETRIEVE <number>', 'Example: RETRIEVE 1', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var itemNum = parseInt(parts[1], 10) - 1; // Convert to 0-indexed
    var persistentInv = GAMESTATE.getPersistentInventory();

    if (itemNum < 0 || itemNum >= persistentInv.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Persistent storage has ' + persistentInv.length + ' items', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var item = persistentInv[itemNum];

    // Try to add to loose
    var addResult = GAMESTATE.addToLoose(item);
    if (!addResult.success) {
      return {
        lines: [addResult.message, ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Remove from persistent
    GAMESTATE.removeFromPersistent(itemNum);

    return {
      lines: [
        '🎒 RETRIEVED TO LOOSE CARRY',
        item.emoji + ' ' + item.name,
        ''
      ].concat(_inventoryLines()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Equip item from persistent inventory to active slot
   */
  function _equipItem(cmd) {
    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Parse item number from command
    var parts = cmd.split(' ');
    if (parts.length < 2) {
      return {
        lines: ['USAGE: EQUIP <number>', 'Example: EQUIP 1', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var itemNum = parseInt(parts[1], 10) - 1; // Convert to 0-indexed
    var persistentInv = GAMESTATE.getPersistentInventory();

    if (itemNum < 0 || itemNum >= persistentInv.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Persistent inventory has ' + persistentInv.length + ' items', ''].concat(_inventoryLines()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var item = persistentInv[itemNum];

    // Set as active item (doesn't remove from inventory)
    GAMESTATE.setActiveItem(item);

    // Update player light if it's a lighting item
    _updatePlayerLight();

    return {
      lines: [
        '⚡ EQUIPPED TO ACTIVE SLOT',
        item.emoji + ' ' + item.name,
        ''
      ].concat(_inventoryLines()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Unequip active item
   */
  function _unequipItem() {
    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var activeItem = GAMESTATE.getActiveItem();
    if (!activeItem) {
      return {
        lines: ['NO ITEM EQUIPPED', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    GAMESTATE.clearActiveItem();

    // Update player light (will clear it)
    _updatePlayerLight();

    return {
      lines: [
        '⚪ UNEQUIPPED',
        'Active slot cleared',
        ''
      ].concat(_inventoryLines()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _exitRogue(success) {
    _active = false;
    _stopGameLoop();

    // Restore mobile keyboard behavior when exiting
    if (typeof Terminal !== 'undefined' && typeof Terminal.restoreMobileKeyboard === 'function') {
      Terminal.restoreMobileKeyboard();
    }

    // Hide mobile UI
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      GoneRogueMobile.hide();
    }

    var result = {
      success: success,
      unlockedSlot: success,
      extractedItem: null
    };

    if (typeof GAMESTATE !== 'undefined') {
      var exitResult = GAMESTATE.exitRogueMode(result);
      return {
        lines: exitResult.lines,
        stayActive: false
      };
    }

    return {
      lines: ['', 'EXITING GONE ROGUE', 'RETURNING TO STREET CHRONICLES', ''],
      stayActive: false
    };
  }

  /**
   * Start the game loop
   */
  function _startGameLoop() {
    if (_gameLoopActive) return;
    _gameLoopActive = true;
    _lastTickTime = Date.now();
    _enemyColorCycleTime = 0;
    _gameLoopTick();
  }

  /**
   * Stop the game loop
   */
  function _stopGameLoop() {
    _gameLoopActive = false;
    if (_animationFrameId) {
      cancelAnimationFrame(_animationFrameId);
      _animationFrameId = null;
    }
  }

  /**
   * Main game loop tick
   */
  function _gameLoopTick() {
    if (!_gameLoopActive) return;

    var now = Date.now();
    var delta = now - _lastTickTime;

    // Process game updates if enough time has passed
    if (delta >= _tickInterval) {
      _updateGameState(delta);
      _lastTickTime = now;
    }

    // Schedule next tick
    _animationFrameId = requestAnimationFrame(_gameLoopTick);
  }

  /**
   * Update all game state (enemies, awareness, etc.)
   */
  function _updateGameState(deltaMs) {
    // Update enemy positions and awareness
    _enemies.forEach(function(enemy) {
      if (enemy.hp <= 0) return;

      // Check treasure goblin timeout (15 seconds to kill)
      if (enemy.isTreasureGoblin && enemy.goblinSpawnTime && typeof SecretFloors !== 'undefined') {
        var goblinAge = (Date.now() - enemy.goblinSpawnTime) / 1000; // Age in seconds
        var goblinTimeout = 15; // 15 seconds to kill

        if (goblinAge > goblinTimeout) {
          // Goblin escaped! Trigger secret floor
          var triggerResult = SecretFloors.triggerSecretFloor(
            SecretFloors.TRIGGER_TYPES.GOBLIN_TIMEOUT,
            {
              goblinTimeExpired: true
            }
          );

          if (triggerResult.success) {
            console.log('[GoneRogue] Treasure goblin escaped - secret floor triggered!');
          }

          // Remove the goblin (it escaped)
          enemy.hp = 0;
        }
      }

      // Update Elite enemies with special behavior
      if (enemy.isElite && typeof EliteEnemies !== 'undefined') {
        EliteEnemies.updateElite(enemy, _player, _grid, deltaMs);
      }

      // Update enemy pathing
      _updateEnemyPath(enemy, deltaMs);

      // Update awareness decay
      _updateEnemyAwareness(enemy, deltaMs);

      // Check if player is in sight cone
      if (_isPlayerInSightCone(enemy)) {
        _increaseEnemyAwareness(enemy, 10); // Increase awareness when player spotted
        if (!_strCombatActive) {
          _enterStrCombat(enemy, 'enemy_sighting');
        }
      }
    });

    _updateProjectiles(deltaMs);

    // Update item decay timers
    var now = Date.now();
    _items = _items.filter(function(item) {
      if (item.spawnTime && item.decayTime) {
        var age = now - item.spawnTime;
        return age < item.decayTime;
      }
      return true; // Keep items without decay timers
    });

    // Update currency decay timers
    _currencies = _currencies.filter(function(currency) {
      if (currency.spawnTime && currency.decayTime) {
        var age = now - currency.spawnTime;
        return age < currency.decayTime;
      }
      return true; // Keep currency without decay timers
    });

    // Update color cycle timer for visual feedback
    _enemyColorCycleTime += deltaMs;

    // Update ground effects system (spreading fire, dissipating steam, etc.)
    if (typeof GroundEffects !== 'undefined') {
      GroundEffects.update(deltaMs, GRID_WIDTH, GRID_HEIGHT);

      // Apply ground effect damage to player
      var playerGroundDamage = GroundEffects.getDamage(_player.x, _player.y);
      if (playerGroundDamage > 0) {
        _player.hp = Math.max(0, _player.hp - playerGroundDamage);
        if (_player.hp <= 0) {
          // Player died from ground effect
          return _handlePlayerDeath('environmental_hazard');
        }
      }

      // Apply ground effect damage to enemies
      _enemies.forEach(function(enemy) {
        if (enemy.hp <= 0) return;
        var enemyGroundDamage = GroundEffects.getDamage(enemy.x, enemy.y);
        if (enemyGroundDamage > 0) {
          enemy.hp = Math.max(0, enemy.hp - enemyGroundDamage);
        }
      });
    }

    // Update lighting system
    if (typeof LightingSystem !== 'undefined') {
      // Update player light position
      _updatePlayerLight();

      // Update enemy lights
      LightingSystem.updateEnemyLights(_enemies);

      // Collect wall positions for light blocking
      var walls = [];
      for (var y = 0; y < GRID_HEIGHT; y++) {
        for (var x = 0; x < GRID_WIDTH; x++) {
          if (_grid[y][x] === TILES.WALL) {
            walls.push({ x: x, y: y });
          }
        }
      }

      // Recalculate light map with animation
      LightingSystem.updateLightMap(GRID_WIDTH, GRID_HEIGHT, walls);
    }

    // Re-render if using interactive grid
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }
  }

  /**
   * Update enemy path movement
   */
  function _updateEnemyPath(enemy, deltaMs) {
    if (!enemy.path) return;

    enemy.pathTimer = (enemy.pathTimer || 0) + deltaMs;

    // Move every 500ms
    if (enemy.pathTimer >= 500) {
      enemy.pathTimer = 0;

      if (enemy.path.type === PATH_TYPES.PATROL) {
        _moveEnemyPatrol(enemy);
      } else if (enemy.path.type === PATH_TYPES.CIRCULAR) {
        _moveEnemyCircular(enemy);
      } else if (enemy.path.type === PATH_TYPES.ELLIPSE) {
        _moveEnemyEllipse(enemy);
      } else if (enemy.path.type === PATH_TYPES.STATIONARY) {
        _rotateEnemyInPlace(enemy);
      }
    }
  }

  /**
   * Move enemy along patrol path (A→B→C→B)
   */
  function _moveEnemyPatrol(enemy) {
    if (!enemy.path.points || enemy.path.points.length < 2) return;

    var currentIndex = enemy.pathIndex || 0;
    var direction = enemy.pathDirection || 1;

    // Move to next point
    currentIndex += direction;

    // Reverse at endpoints
    if (currentIndex >= enemy.path.points.length) {
      currentIndex = enemy.path.points.length - 2;
      direction = -1;
    } else if (currentIndex < 0) {
      currentIndex = 1;
      direction = 1;
    }

    enemy.pathIndex = currentIndex;
    enemy.pathDirection = direction;

    var point = enemy.path.points[currentIndex];
    _moveEnemyToPoint(enemy, point);
  }

  /**
   * Move enemy along circular path (A→B→C→A)
   */
  function _moveEnemyCircular(enemy) {
    if (!enemy.path.points || enemy.path.points.length < 2) return;

    var currentIndex = (enemy.pathIndex || 0) + 1;
    if (currentIndex >= enemy.path.points.length) {
      currentIndex = 0;
    }

    enemy.pathIndex = currentIndex;
    var point = enemy.path.points[currentIndex];
    _moveEnemyToPoint(enemy, point);
  }

  /**
   * Move enemy along ellipse path
   */
  function _moveEnemyEllipse(enemy) {
    if (!enemy.path.ellipse) return;

    var angle = (enemy.pathAngle || 0) + 0.1; // Increment angle
    if (angle >= Math.PI * 2) angle = 0;

    enemy.pathAngle = angle;

    var cx = enemy.path.ellipse.cx;
    var cy = enemy.path.ellipse.cy;
    var rx = enemy.path.ellipse.rx;
    var ry = enemy.path.ellipse.ry;

    var x = Math.floor(cx + rx * Math.cos(angle));
    var y = Math.floor(cy + ry * Math.sin(angle));

    _moveEnemyToPoint(enemy, { x: x, y: y });
  }

  /**
   * Rotate enemy in place (change orientation)
   */
  function _rotateEnemyInPlace(enemy) {
    // Rotate orientation clockwise
    var orientations = ['north', 'east', 'south', 'west'];
    var currentIndex = orientations.indexOf(enemy.orientation || 'north');
    var nextIndex = (currentIndex + 1) % orientations.length;
    enemy.orientation = orientations[nextIndex];
  }

  /**
   * Move enemy to specific point (if not blocked)
   */
  function _moveEnemyToPoint(enemy, point) {
    // Check if point is valid and not blocked
    if (point.x < 0 || point.x >= GRID_WIDTH || point.y < 0 || point.y >= GRID_HEIGHT) return;
    if (_grid[point.y][point.x] === TILES.WALL) return;

    // Update orientation based on movement direction
    var dx = point.x - enemy.x;
    var dy = point.y - enemy.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      enemy.orientation = dx > 0 ? 'east' : 'west';
    } else {
      enemy.orientation = dy > 0 ? 'south' : 'north';
    }

    enemy.x = point.x;
    enemy.y = point.y;
  }

  /**
   * Update enemy awareness (decay over time)
   */
  function _updateEnemyAwareness(enemy, deltaMs) {
    if (!enemy.awareness) enemy.awareness = 0;

    // Decay awareness by 5 points per second
    var decay = (5 * deltaMs) / 1000;
    enemy.awareness = Math.max(0, enemy.awareness - decay);
  }

  /**
   * Increase enemy awareness
   */
  function _increaseEnemyAwareness(enemy, amount) {
    enemy.awareness = Math.min(150, (enemy.awareness || 0) + amount);
  }

  /**
   * Get enemy awareness state
   */
  function _getEnemyAwarenessState(enemy) {
    var awareness = enemy.awareness || 0;

    if (awareness >= AWARENESS_STATES.ENGAGED.min) return AWARENESS_STATES.ENGAGED;
    if (awareness >= AWARENESS_STATES.ALERTED.min) return AWARENESS_STATES.ALERTED;
    if (awareness >= AWARENESS_STATES.SUSPICIOUS.min) return AWARENESS_STATES.SUSPICIOUS;
    return AWARENESS_STATES.UNAWARE;
  }

  /**
   * Get enemy awareness state (exposed for external use)
   */
  function getEnemyAwarenessState(enemy) {
    return _getEnemyAwarenessState(enemy);
  }

  /**
   * Update player light based on inventory
   */
  function _updatePlayerLight() {
    if (typeof LightingSystem === 'undefined') return;

    // Check active item slot for light items (not inventory)
    var lightItem = null;

    if (typeof GAMESTATE !== 'undefined') {
      var activeItem = GAMESTATE.getActiveItem();

      // Only check active item slot for lighting items
      if (activeItem) {
        var itemName = activeItem.name ? activeItem.name.toLowerCase() : '';

        // Check for light items in active slot (priority order)
        if (itemName.indexOf('night vision') !== -1) {
          lightItem = 'NIGHT_VISION';
        } else if (itemName.indexOf('flashlight') !== -1) {
          lightItem = 'FLASHLIGHT';
        } else if (itemName.indexOf('lighter') !== -1) {
          lightItem = 'LIGHTER';
        }
      }
    }

    // Update lighting system
    LightingSystem.setPlayerLight(lightItem);
    LightingSystem.updatePlayerLight(_player.x, _player.y, _player.lastMoveDirection || 'north');
  }

  /**
   * Check if player is in enemy sight cone
   */
  function _isPlayerInSightCone(enemy) {
    if (!enemy.orientation) return false;

    var dx = _player.x - enemy.x;
    var dy = _player.y - enemy.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    // Sight cone range (modified by player's tile stealth bonus)
    var baseSightRange = enemy.sightRange || 5;
    var stealthBonus = _getPlayerStealthBonus();
    var effectiveSightRange = baseSightRange * (1 - stealthBonus / 100);

    if (distance > effectiveSightRange) return false;

    // Check if cover blocks line of sight
    if (_checkLineOfSight(enemy.x, enemy.y, _player.x, _player.y)) {
      return false; // LOS blocked by cover
    }

    // Calculate angle to player
    var angleToPlayer = Math.atan2(dy, dx);

    // Enemy orientation angles
    var orientationAngles = {
      'east': 0,
      'south': Math.PI / 2,
      'west': Math.PI,
      'north': -Math.PI / 2
    };

    var orientationAngle = orientationAngles[enemy.orientation] || 0;
    var coneAngle = Math.PI / 3; // 60 degree cone

    // Normalize angle difference
    var angleDiff = Math.abs(angleToPlayer - orientationAngle);
    while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - 2 * Math.PI);

    return angleDiff <= coneAngle / 2;
  }

  /**
   * Get player stealth bonus from current tile
   */
  function _getPlayerStealthBonus() {
    var tile = _grid[_player.y][_player.x];
    var key = _player.x + ',' + _player.y;
    var metadata = _tileMetadata[key];

    var bonus = 0;

    // Tile-based stealth bonuses
    if (tile === TILES.SHADOW && metadata && metadata.stealthBonus) {
      bonus += metadata.stealthBonus; // 30%
    } else if (tile === TILES.GRASS && metadata && metadata.stealthBonus) {
      bonus += metadata.stealthBonus; // 20%
    } else if (tile === TILES.SMOKE && metadata && metadata.stealthBonus) {
      bonus += metadata.stealthBonus; // 40%
    }

    // Darkness-based stealth bonus (from lighting system)
    if (typeof LightingSystem !== 'undefined') {
      var darknessBonus = LightingSystem.getDarknessStealthBonus(_player.x, _player.y);
      bonus += darknessBonus; // 0-50% based on darkness
    }

    // Charm bonuses from inventory (charms work from inventory, not active slot)
    if (typeof GAMESTATE !== 'undefined') {
      var persistent = GAMESTATE.getPersistentInventory();
      var loose = GAMESTATE.getLooseInventory();
      var allItems = persistent.concat(loose);

      allItems.forEach(function(item) {
        if (item && item.category === 'charm' && item.stats && item.stats.stealth) {
          bonus += item.stats.stealth;
        }
      });
    }

    return bonus;
  }

  /**
   * Check if line of sight is blocked by cover
   * Returns true if blocked, false if clear
   */
  function _checkLineOfSight(x1, y1, x2, y2) {
    // Simple raycast to check for cover
    var dx = Math.abs(x2 - x1);
    var dy = Math.abs(y2 - y1);
    var sx = x1 < x2 ? 1 : -1;
    var sy = y1 < y2 ? 1 : -1;
    var err = dx - dy;

    var x = x1;
    var y = y1;

    while (!(x === x2 && y === y2)) {
      // Check if this tile blocks LOS
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        var tile = _grid[y][x];
        if (tile === TILES.COVER || tile === TILES.WALL) {
          return true; // LOS blocked
        }
      }

      var e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return false; // LOS clear
  }

  function _isInsideBounds(x, y) {
    return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
  }

  function _getBreakableAt(x, y) {
    return _breakables.find(function(b) { return b.x === x && b.y === y; });
  }

  function _damageBreakable(breakable, amount) {
    breakable.hp = Math.max(0, (breakable.hp || 0) - amount);

    // Add hit animation state
    breakable.hitTime = Date.now();
    breakable.blinkCount = 0;

    if (breakable.hp === 0) {
      // Mark for destruction but delay it for animation
      breakable.destroying = true;
      breakable.destroyStartTime = Date.now();

      // Schedule the actual destruction after animation completes (2 blinks * 200ms each = 400ms)
      setTimeout(function() {
        if (breakable.destroying) {
          _grid[breakable.y][breakable.x] = breakable.destroyedGlyph || TILES.DEBRIS;
          breakable.destroying = false;

          // Drop currency (cryptos) when breakable is destroyed
          var dropChance = Math.random();
          if (dropChance < 0.7) { // 70% chance to drop currency
            var cryptoAmount = Math.floor(Math.random() * 3) + 1; // 1-3 cryptos
            _spawnCurrency(breakable.x, breakable.y, cryptoAmount);
          }

          // 30% chance to drop a card
          if (Math.random() < 0.3 && typeof CardSystem !== 'undefined') {
            var baseType = CardSystem.getRandomBaseCard();
            var card = CardSystem.rollCard(baseType);
            if (card) {
              _items.push({
                x: breakable.x,
                y: breakable.y,
                type: 'card',
                card: card,
                spawnTime: Date.now(),
                decayTime: 30000 // 30 second decay
              });
            }
          }

          // 25% chance to drop a charm (similar frequency to cards)
          if (Math.random() < 0.25 && typeof CardSystem !== 'undefined') {
            var charm = CardSystem.rollCommonCharm();
            if (charm) {
              _items.push({
                x: breakable.x,
                y: breakable.y,
                type: 'charm',
                card: charm, // Reuse card structure for charms
                spawnTime: Date.now(),
                decayTime: 30000 // 30 second decay
              });
            }
          }

          // Trigger re-render
          if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
            _updateMobileGrid();
          }
        }
      }, 400); // 2 blinks at 200ms each
    }
  }

  function _parseDirection(input) {
    var raw = (input || '').trim().split(/\s+/);
    var token = raw.length > 1 ? raw[1] : raw[0];

    var directions = {
      'n': { dx: 0, dy: -1, direction: 'north' },
      'north': { dx: 0, dy: -1, direction: 'north' },
      'u': { dx: 0, dy: -1, direction: 'north' },
      's': { dx: 0, dy: 1, direction: 'south' },
      'south': { dx: 0, dy: 1, direction: 'south' },
      'd': { dx: 0, dy: 1, direction: 'south' },
      'e': { dx: 1, dy: 0, direction: 'east' },
      'east': { dx: 1, dy: 0, direction: 'east' },
      'r': { dx: 1, dy: 0, direction: 'east' },
      'w': { dx: -1, dy: 0, direction: 'west' },
      'west': { dx: -1, dy: 0, direction: 'west' },
      'a': { dx: -1, dy: 0, direction: 'west' }
    };

    if (token && directions[token]) {
      return directions[token];
    }

    if (_player.lastMoveDirection && directions[_player.lastMoveDirection]) {
      return directions[_player.lastMoveDirection];
    }

    return directions['east'];
  }

  function _getProjectileGlyph(direction) {
    var glyphs = {
      'north': '↑',
      'south': '↓',
      'east': '→',
      'west': '←'
    };

    return glyphs[direction] || TILES.PROJECTILE;
  }

  function _fireProjectile(cmd) {
    var dir = _parseDirection(cmd);

    var projectile = {
      x: _player.x,
      y: _player.y,
      dx: dir.dx,
      dy: dir.dy,
      glyph: _getProjectileGlyph(dir.direction),
      emoji: '💥',
      range: 10,
      power: 2,
      owner: 'player'
    };

    _projectiles.push(projectile);
    var action = _updateProjectiles(0, 1);
    _saveState();

    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    if (action) {
      return action;
    }

    return {
      lines: ['FIRING ' + projectile.glyph + ' ' + dir.direction.toUpperCase(), ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _kickBreakable(cmd) {
    var dir = _parseDirection(cmd);
    var targetX = _player.x + dir.dx;
    var targetY = _player.y + dir.dy;
    var target = _getBreakableAt(targetX, targetY);

    if (!target || target.hp <= 0) {
      return {
        lines: ['NOTHING TO KICK THAT WAY', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    _damageBreakable(target, 2);
    _saveState();

    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return {
      lines: ['🥾 BOOTED ' + target.emoji + ' (HP ' + target.hp + ')', ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  function _updateProjectiles(deltaMs, steps) {
    var iterations = steps || 1;
    var action = null;

    for (var i = 0; i < iterations; i++) {
      var survivors = [];
      for (var j = 0; j < _projectiles.length; j++) {
        var result = _advanceProjectile(_projectiles[j]);
        if (result && result.action && !action) {
          action = result.action;
        }
        if (result && result.alive) {
          survivors.push(_projectiles[j]);
        }
      }
      _projectiles = survivors;
    }

    return action;
  }

  function _advanceProjectile(projectile) {
    if (!projectile) return { alive: false };

    var nextX = projectile.x + projectile.dx;
    var nextY = projectile.y + projectile.dy;

    if (!_isInsideBounds(nextX, nextY)) return { alive: false };

    var tile = _grid[nextY][nextX];
    if (tile === TILES.WALL) return { alive: false };

    var breakable = _getBreakableAt(nextX, nextY);
    if (breakable && breakable.hp > 0) {
      _damageBreakable(breakable, projectile.power || 1);
      return { alive: false };
    }

    var enemy = _enemies.find(function(e) { return e.x === nextX && e.y === nextY && e.hp > 0; });
    if (enemy) {
      if (projectile.owner === 'player') {
        return { alive: false, action: _enterStrCombat(enemy, 'player_attack', projectile.card) };
      }
      enemy.hp = Math.max(0, enemy.hp - (projectile.power || 1));
      return { alive: false };
    }

    var hitsPlayer = (_player.x === nextX && _player.y === nextY);
    if (hitsPlayer) {
      if (projectile.owner !== 'player') {
        var sourceEnemy = projectile.sourceEnemy || _enemies.find(function(e) { return e.hp > 0; });
        if (sourceEnemy) {
          return { alive: false, action: _enterStrCombat(sourceEnemy, 'enemy_attack') };
        }
      }
      return { alive: false };
    }

    projectile.x = nextX;
    projectile.y = nextY;
    projectile.range = (projectile.range || 1) - 1;

    return { alive: projectile.range > 0 };
  }

  function stepProjectiles(steps) {
    var action = _updateProjectiles(0, steps || 1);

    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return {
      projectiles: _projectiles,
      breakables: _breakables,
      action: action
    };
  }

  function _saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        active: _active,
        player: _player,
        enemies: _enemies,
        items: _items,
        projectiles: _projectiles,
        breakables: _breakables,
        turn: _turn,
        floor: _floor
      }));
    } catch (e) { /* ignore */ }
  }

  function _loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed.player) _player = parsed.player;
      if (parsed.enemies) _enemies = parsed.enemies;
      if (parsed.items) _items = parsed.items;
      if (parsed.projectiles) _projectiles = parsed.projectiles;
      if (parsed.breakables) _breakables = parsed.breakables;
      if (parsed.turn) _turn = parsed.turn;
      if (parsed.floor) _floor = parsed.floor;
      // DO NOT restore active state - user must explicitly enter rogue mode
      _active = false;
    } catch (e) { /* ignore */ }
  }

  /**
   * Handle tap-to-move from mobile UI
   */
  function handleTapMove(targetX, targetY, runMode) {
    if (!_active) return;

    // Check if clicking on a breakable - kick it instead of moving
    var breakableAtTarget = _getBreakableAt(targetX, targetY);
    if (breakableAtTarget && breakableAtTarget.hp > 0) {
      // Calculate direction to breakable
      var dx = targetX - _player.x;
      var dy = targetY - _player.y;

      // Only kick if adjacent (1 tile away)
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
        _damageBreakable(breakableAtTarget, 2);
        _saveState();

        if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
          _updateMobileGrid();
        }

        return {
          lines: ['🥾 BOOTED ' + (breakableAtTarget.emoji || '📦') + ' (HP ' + breakableAtTarget.hp + ')', ''].concat(_renderGrid()),
          prompt: getPrompt(),
          stayActive: true
        };
      }
    }

    // Calculate path (simple: move one step towards target)
    var dx = targetX - _player.x;
    var dy = targetY - _player.y;

    // Normalize to -1, 0, or 1
    var stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
    var stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

    // Execute move
    var moveResult = _movePlayer(stepX, stepY, runMode);

    // Update mobile UI
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return moveResult;
  }

  /**
   * Handle card swipe from mobile UI
   */
  function handleCardSwipe(cardIndex, direction) {
    if (!_active) return;

    // Get card from loose inventory
    var loose = typeof GAMESTATE !== 'undefined' ? GAMESTATE.getLooseInventory() : [];
    if (cardIndex < 0 || cardIndex >= loose.length) return;

    var card = loose[cardIndex];

    // Execute card action based on swipe direction
    var action = _getCardAction(card, direction);

    // Tooltip: Card deployment (if valid action)
    if (action.type !== 'none' && action.type !== 'discard' && typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('card-deploy', { name: card.name });
    }

    var result = _executeCardAction(action);

    // Update mobile UI
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return result;
  }

  /**
   * Map swipe direction to card action
   */
  function _getCardAction(card, direction) {
    // Direction mapping:
    // up = use/apply
    // down = discard
    // left = defensive
    // right = offensive

    var category = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(card) : card.type;

    // Interrupt cards (up/right/left)
    if (category === 'interrupt') {
      if (direction === 'up' || direction === 'right' || direction === 'left') {
        return { type: 'interrupt', card: card };
      }
    }
    // Defense cards (up/left)
    else if (category === 'defense' || card.type === 'stance') {
      if (direction === 'up' || direction === 'left') {
        return { type: 'defense', card: card };
      }
    }
    // Movement cards (up/left/right)
    else if (category === 'movement') {
      if (direction === 'up' || direction === 'left' || direction === 'right') {
        return { type: 'movement', card: card };
      }
    }
    // Attack cards (up/right)
    else if (category === 'attack' || card.type === 'attack') {
      if (direction === 'up' || direction === 'right') {
        return { type: 'attack', card: card };
      }
    }
    // Setup/Utility cards (up)
    else if (category === 'setup' || card.type === 'utility') {
      if (direction === 'up') {
        return { type: 'use', card: card };
      }
    }

    if (direction === 'down') {
      return { type: 'discard', card: card };
    }

    return { type: 'none' };
  }

  /**
   * Execute card action
   */
  function _executeCardAction(action) {
    if (!action || action.type === 'none') {
      return {
        lines: ['INVALID SWIPE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // All combat actions now route through the same handlers
    if (action.type === 'attack' || action.type === 'interrupt') {
      return _performAttack(action.card);
    } else if (action.type === 'defense' || action.type === 'stance' || action.type === 'movement') {
      return _performStance(action.card);
    } else if (action.type === 'use') {
      return _useUtility(action.card);
    } else if (action.type === 'discard') {
      return _discardCard(action.card);
    }

    return {
      lines: [''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Perform attack with card
   */
  function _performAttack(card) {
    // Tooltip: Attacking
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('attack');
    }

    // If already in STR combat, use simultaneous resolution
    if (_strCombatActive) {
      var enemyCard = _getEnemyAICard();
      return _executeSimultaneousRound(card, enemyCard);
    }

    // Find nearest enemy
    var nearest = _findNearestEnemy();
    if (!nearest) {
      return {
        lines: ['NO ENEMIES IN RANGE', ''],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Trigger STR combat mode with player-initiated attack
    return _enterStrCombat(nearest, 'player_attack', card);
  }

  /**
   * Perform stance with card
   */
  function _performStance(card) {
    // If in STR combat, use simultaneous resolution
    if (_strCombatActive) {
      var enemyCard = _getEnemyAICard();
      return _executeSimultaneousRound(card, enemyCard);
    }

    // Outside combat: apply stance benefits
    _player.stealth += (card.stats.stealth || 1);
    _turn++;
    _saveState();

    return {
      lines: ['STANCE: ' + card.name.toUpperCase(), 'STEALTH +' + (card.stats.stealth || 1), ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Use utility card
   */
  function _useUtility(card) {
    if (card.stats.hp) {
      _player.hp = Math.min(_player.maxHp, _player.hp + card.stats.hp);
    }
    if (card.stats.energy) {
      _player.energy = Math.min(_player.maxEnergy, _player.energy + card.stats.energy);
    }

    // Check for wrong item in safe zone trigger
    var floorType = _getFloorType(_floor);
    if (floorType === FLOOR_TYPES.BONFIRE && typeof SecretFloors !== 'undefined') {
      // Using combat cards or certain items in safe zones can trigger secret floors
      var hasSecretTag = card.category === 'attack' || card.category === 'interrupt' || card.type === 'attack';

      if (hasSecretTag) {
        var triggerResult = SecretFloors.triggerSecretFloor(
          SecretFloors.TRIGGER_TYPES.WRONG_ITEM_SAFE_ZONE,
          {
            inSafeZone: true,
            itemHasSecretTag: true
          }
        );

        if (triggerResult.success) {
          // Secret floor will trigger on next elevator use
          console.log('[GoneRogue] Wrong item in safe zone triggered secret floor');
        }
      }
    }

    _turn++;
    _saveState();

    return {
      lines: ['USED: ' + card.name.toUpperCase(), ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Discard card
   */
  function _discardCard(card) {
    // Remove from loose inventory (handled by GAMESTATE)
    return {
      lines: ['DISCARDED: ' + card.name, ''],
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Find nearest enemy to player
   */
  function _findNearestEnemy() {
    var nearest = null;
    var minDist = Infinity;

    _enemies.forEach(function(enemy) {
      if (enemy.hp <= 0) return;

      var dist = Math.abs(enemy.x - _player.x) + Math.abs(enemy.y - _player.y);
      if (dist < minDist && dist <= 5) {
        minDist = dist;
        nearest = enemy;
      }
    });

    return nearest;
  }

  // ============================================================
  // STR COMBAT SYSTEM (Simultaneous Turn Resolution)
  // ============================================================

  /**
   * Enter STR combat mode
   * @param {Object} enemy - Enemy to engage in combat
   * @param {String} trigger - How combat was triggered ('collision', 'player_attack', 'enemy_attack')
   * @param {Object} card - Optional card used to initiate combat
   */
  function _enterStrCombat(enemy, trigger, card) {
    // Freeze realtime game loop
    if (_gameLoopActive) {
      _pauseGameLoop();
    }

    // Check for combat in no-combat zone trigger (bonfire floors)
    var floorType = _getFloorType(_floor);
    if (floorType === FLOOR_TYPES.BONFIRE && typeof SecretFloors !== 'undefined') {
      var triggerResult = SecretFloors.triggerSecretFloor(
        SecretFloors.TRIGGER_TYPES.COMBAT_NO_COMBAT_ZONE,
        {
          inNoCombatZone: true
        }
      );

      if (triggerResult.success) {
        // Secret floor will trigger on next elevator use
        console.log('[GoneRogue] Combat in no-combat zone triggered secret floor');
      }
    }

    // Track combat entry for mythic conditions
    _player.combatEntries++;

    // Initialize combat state
    _strCombatActive = true;
    _strCombatEnemy = enemy;
    _strCombatRound = 0;
    _strCombatLog = [];

    // Tooltip: Engaging enemy
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('combat-enter');
    }

    // Calculate advantage state
    _strCombatAdvantage = _calculateAdvantage(_player, enemy, trigger);

    // Scan 3x3 tiles around player for ground effects and apply combat modifiers
    _applyGroundEffectModifiers();

    // Add combat entry message with emoji
    var advantageEmoji = _getAdvantageEmoji(_strCombatAdvantage);
    _strCombatLog.push('⚔️  STR COMBAT INITIATED ' + advantageEmoji);
    _strCombatLog.push('└─ Advantage: ' + _strCombatAdvantage.toUpperCase());
    _strCombatLog.push('');

    // Apply initiative rules
    var playerGoesFirst = false;
    if (_strCombatAdvantage === 'ambush') {
      _strCombatLog.push('🎯 PLAYER AMBUSH! Free opening attack!');
      playerGoesFirst = true;
    } else if (_strCombatAdvantage === 'flanked' || _strCombatAdvantage === 'disadvantaged') {
      _strCombatLog.push('⚠️  ENEMY HAS ADVANTAGE! They attack first!');
      playerGoesFirst = false;
    } else {
      playerGoesFirst = _player.initiative >= (enemy.initiative || 0);
    }

    // Enable combat zoom/focus for both desktop and mobile
    _enableCombatZoom();

    // Execute first round
    if (playerGoesFirst && trigger === 'player_attack' && card) {
      // Player initiated with attack card
      return _executeStrRound('player', card);
    } else if (!playerGoesFirst) {
      // Enemy goes first
      return _executeStrRound('enemy');
    } else {
      // Show combat UI and wait for player action
      return _showStrCombatUI();
    }
  }

  /**
   * Calculate advantage state based on positioning and awareness
   */
  function _calculateAdvantage(player, enemy, trigger) {
    var distance = _distanceBetween(player, enemy);
    var bracket = _getDistanceBracket(distance);
    var enemyAware = (enemy.awareness || 0) >= AWARENESS_STATES.SUSPICIOUS.min;
    var playerInitiated = trigger === 'player_attack' || trigger === 'collision';
    var enemyInitiated = trigger === 'enemy_attack' || trigger === 'enemy_sighting' || trigger === 'enemy_projectile';

    // Player Ambush: attacking from stealth or behind at melee
    if (playerInitiated && bracket === 'melee' && !enemyAware) {
      return 'ambush';
    }

    // Check if player is attacking from behind (flanking)
    var isFlanking = _checkFlanking(player, enemy);
    if (playerInitiated && isFlanking) {
      return 'ambush';
    }

    // Check if player is flanked/disadvantaged
    var playerFlanked = _checkFlanking(enemy, player);
    if (enemyInitiated && bracket === 'melee' && playerFlanked) {
      return 'flanked';
    }

    // Enemy alerted = player disadvantaged
    if (enemyInitiated && enemy.awareness >= 70) {
      return 'disadvantaged';
    }

    // Default: neutral
    return 'neutral';
  }

  /**
   * Check if attacker is flanking target based on facing and approach direction
   */
  function _checkFlanking(attacker, target) {
    var opposites = {
      'north': 'south',
      'south': 'north',
      'east': 'west',
      'west': 'east'
    };

    var targetFacing = target.orientation || target.lastMoveDirection;
    if (!targetFacing) return false;

    // Approach direction: use attacker last move if present, otherwise relative position
    var approachDirection = attacker.lastMoveDirection;
    if (!approachDirection && typeof attacker.x === 'number' && typeof target.x === 'number') {
      var dx = target.x - attacker.x;
      var dy = target.y - attacker.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        approachDirection = dx > 0 ? 'east' : 'west';
      } else if (Math.abs(dy) > 0) {
        approachDirection = dy > 0 ? 'south' : 'north';
      }
    }

    if (!approachDirection) return false;

    var opposite = opposites[targetFacing];
    return approachDirection === opposite;
  }

  /**
   * Get emoji for advantage state
   */
  function _getAdvantageEmoji(advantage) {
    switch (advantage) {
      case 'ambush': return '🎯';
      case 'neutral': return '⚔️';
      case 'disadvantaged': return '⚠️';
      case 'flanked': return '❌';
      default: return '⚔️';
    }
  }

  function _distanceBetween(a, b) {
    return Math.abs((a.x || 0) - (b.x || 0)) + Math.abs((a.y || 0) - (b.y || 0));
  }

  function _getDistanceBracket(distance) {
    if (distance <= 1) return 'melee';
    if (distance <= 3) return 'close';
    if (distance <= 6) return 'mid';
    return 'far';
  }

  /**
   * Execute a round of STR combat with simultaneous resolution
   * @param {Object} playerCard - Card player is using
   * @param {Object} enemyCard - Card enemy is using (from AI)
   */
  function _executeSimultaneousRound(playerCard, enemyCard) {
    _strCombatRound++;

    var actions = [];

    // Create player action
    if (playerCard) {
      var category = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(playerCard) : 'attack';
      var priority = typeof CardSystem !== 'undefined' ? CardSystem.getCardPriority(category) : 4;
      var speed = (playerCard.stats && playerCard.stats.speed) || _player.initiative || 0;
      
      actions.push({
        actor: 'player',
        card: playerCard,
        category: category,
        priority: priority,
        speed: speed
      });
    }

    // Create enemy action (simplified AI)
    if (enemyCard) {
      var enemyCategory = typeof CardSystem !== 'undefined' ? CardSystem.getCardCategory(enemyCard) : 'attack';
      var enemyPriority = typeof CardSystem !== 'undefined' ? CardSystem.getCardPriority(enemyCategory) : 4;
      var enemySpeed = (enemyCard.stats && enemyCard.stats.speed) || _strCombatEnemy.initiative || 0;
      
      actions.push({
        actor: 'enemy',
        card: enemyCard,
        category: enemyCategory,
        priority: enemyPriority,
        speed: enemySpeed
      });
    }

    // Sort by priority (lower priority number executes first), then by speed (higher speed breaks ties)
    actions.sort(function(a, b) {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower priority executes first
      }
      return b.speed - a.speed; // Higher speed breaks ties
    });

    // Execute actions in order
    var lines = [];
    lines.push('═══ ROUND ' + _strCombatRound + ' RESOLUTION ═══');
    lines.push('');

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      var result = _resolveAction(action);
      
      if (result && result.lines) {
        lines = lines.concat(result.lines);
      }

      // Check for combat end conditions
      if (_strCombatEnemy.hp <= 0) {
        lines.push('');
        lines.push('💀 ENEMY DEFEATED!');
        var exitResult = _exitStrCombat('player_victory');
        return {
          lines: lines.concat(exitResult.lines || []),
          stayActive: exitResult.stayActive
        };
      }

      if (_player.hp <= 0) {
        lines.push('');
        lines.push('💀 YOU HAVE BEEN DEFEATED...');
        return _exitRogue(false); // Player death
      }
    }

    // Continue combat
    lines.push('');
    lines.push('═══════════════════════════');
    lines.push('');
    return _showStrCombatUIWithLog(lines);
  }

  /**
   * Resolve a single action in the priority queue
   * @param {Object} action - Action object with actor, card, category, priority, speed
   */
  function _resolveAction(action) {
    var lines = [];
    var actor = action.actor === 'player' ? _player : _strCombatEnemy;
    var target = action.actor === 'player' ? _strCombatEnemy : _player;
    var card = action.card;
    var category = action.category;

    // Display action header with priority indicator
    var priorityLabel = {
      interrupt: '🚨 INTERRUPT',
      defense: '🛡️  DEFENSE',
      movement: '🏃 MOVEMENT',
      attack: '⚔️  ATTACK',
      setup: '🔧 SETUP'
    }[category] || '❓ ACTION';

    var actorName = action.actor === 'player' ? 'PLAYER' : 'ENEMY';
    lines.push(priorityLabel + ' — ' + actorName + ': ' + card.emoji + ' ' + card.name);

    // Resolve based on category
    switch (category) {
      case 'interrupt':
        lines = lines.concat(_resolveInterruptAction(actor, target, card));
        break;
      case 'defense':
        lines = lines.concat(_resolveDefenseAction(actor, target, card));
        break;
      case 'movement':
        lines = lines.concat(_resolveMovementAction(actor, target, card));
        break;
      case 'attack':
        lines = lines.concat(_resolveAttackAction(actor, target, card));
        break;
      case 'setup':
        lines = lines.concat(_resolveSetupAction(actor, target, card));
        break;
      default:
        lines.push('└─ Unknown action type');
    }

    lines.push('');
    return { lines: lines };
  }

  /**
   * Resolve interrupt action
   */
  function _resolveInterruptAction(actor, target, card) {
    var lines = [];

    // Track last card type for boss mythic conditions
    if (actor === _player) {
      _player.lastCardType = card.type || card.name;
    }

    // Boss-specific card interactions for interrupt cards
    if (_bossFloorActive && _activeBoss && actor === _player) {
      var bossInteraction = _handleBossCardInteraction(card, target);
      if (bossInteraction.handled) {
        return bossInteraction.lines;
      }
    }

    // Interrupt actions execute before other actions
    if (card.name === 'Dive for Cover') {
      var defense = card.stats.defense || 5;
      var evasion = card.stats.evasion || 3;
      actor.tempDefense = (actor.tempDefense || 0) + defense;
      actor.tempEvasion = (actor.tempEvasion || 0) + evasion;
      lines.push('├─ Gained +' + defense + ' defense, +' + evasion + ' evasion');
    } else if (card.name === 'Jam Weapon') {
      target.weaponJammed = true;
      lines.push('├─ Target\'s weapon jammed! Next attack canceled');
    } else if (card.name === 'Overwatch Shot') {
      // Immediate attack with bonus
      var damage = card.stats.damage || 3;
      target.hp -= damage;
      lines.push('├─ Dealt ' + damage + ' damage (preemptive strike)');
      lines.push('└─ Target HP: ' + Math.max(0, target.hp) + '/' + (target.maxHp || 5));
    } else {
      lines.push('└─ Interrupt executed');
    }

    return lines;
  }

  /**
   * Resolve defense action
   */
  function _resolveDefenseAction(actor, target, card) {
    var lines = [];
    
    var defense = card.stats.defense || 0;
    var evasion = card.stats.evasion || 0;
    
    if (defense > 0) {
      actor.tempDefense = (actor.tempDefense || 0) + defense;
      lines.push('├─ Gained +' + defense + ' defense');
    }
    if (evasion > 0) {
      actor.tempEvasion = (actor.tempEvasion || 0) + evasion;
      lines.push('├─ Gained +' + evasion + ' evasion');
    }
    
    var stealth = card.stats.stealth || 0;
    if (stealth > 0) {
      actor.stealth = Math.min((actor.maxStealth || 5), (actor.stealth || 0) + stealth);
      lines.push('└─ Stealth increased');
    }
    
    return lines;
  }

  /**
   * Resolve movement action
   */
  function _resolveMovementAction(actor, target, card) {
    var lines = [];
    
    var distance = card.stats.distance || 0;
    var evasion = card.stats.evasion || 0;
    
    if (distance !== 0) {
      // Movement affects distance (abstracted in STR combat)
      lines.push('├─ Position adjusted (' + (distance > 0 ? 'closing' : 'retreating') + ')');
    }
    
    if (evasion > 0) {
      actor.tempEvasion = (actor.tempEvasion || 0) + evasion;
      lines.push('└─ Gained +' + evasion + ' evasion from movement');
    }
    
    return lines;
  }

  /**
   * Resolve attack action
   */
  function _resolveAttackAction(actor, target, card) {
    var lines = [];

    // Track last card type for boss mythic conditions
    if (actor === _player) {
      _player.lastCardType = card.type || card.name;
    }

    // Check if weapon is jammed
    if (actor.weaponJammed) {
      lines.push('└─ Attack failed! Weapon is jammed');
      actor.weaponJammed = false; // Clear jam
      return lines;
    }

    // Boss-specific card interactions
    if (_bossFloorActive && _activeBoss && actor === _player) {
      var bossInteraction = _handleBossCardInteraction(card, target);
      if (bossInteraction.handled) {
        return bossInteraction.lines;
      }
    }

    // Calculate hit with target's temp evasion
    var advantage = actor === _player ? _strCombatAdvantage :
                    (_strCombatAdvantage === 'ambush' ? 'flanked' :
                     _strCombatAdvantage === 'flanked' ? 'ambush' : 'neutral');

    var hitResult = _calculateHit(actor, target, advantage);
    var evasionBonus = (target.tempEvasion || 0) * 5; // Each evasion point = 5% miss chance
    hitResult.target += evasionBonus;

    // Check if attack hit (considering evasion)
    if (!hitResult.hit || hitResult.roll < hitResult.target) {
      lines.push('├─ MISS! (Roll: ' + hitResult.roll + ' vs ' + hitResult.target + ')');
      if (evasionBonus > 0) {
        lines.push('└─ Target evaded with +' + evasionBonus + '% evasion bonus');
      }
      return lines;
    }

    // Calculate damage reduced by defense
    var damageResult = _calculateDamage(actor, target, advantage, card, hitResult.crit);
    var defenseReduction = (target.tempDefense || 0);
    var finalDamage = Math.max(1, damageResult.damage - defenseReduction);

    target.hp -= finalDamage;

    var critEmoji = hitResult.crit ? ' 💥 CRIT!' : '';
    lines.push('├─ HIT!' + critEmoji + ' (Roll: ' + hitResult.roll + ' vs ' + hitResult.target + ')');
    lines.push('├─ Damage: ' + damageResult.damage + (defenseReduction > 0 ? ' - ' + defenseReduction + ' defense' : ''));
    lines.push('└─ Final: ' + finalDamage + ' damage → Target HP: ' + Math.max(0, target.hp) + '/' + (target.maxHp || 5));

    return lines;
  }

  /**
   * Resolve setup/utility action
   */
  function _resolveSetupAction(actor, target, card) {
    var lines = [];

    // Track last card type for boss mythic conditions
    if (actor === _player) {
      _player.lastCardType = card.type || card.name;
    }

    // Boss-specific card interactions for setup cards
    if (_bossFloorActive && _activeBoss && actor === _player) {
      var bossInteraction = _handleBossCardInteraction(card, target);
      if (bossInteraction.handled) {
        return bossInteraction.lines;
      }
    }

    var hp = card.stats.hp || 0;
    if (hp > 0) {
      actor.hp = Math.min((actor.maxHp || 10), actor.hp + hp);
      lines.push('├─ Healed ' + hp + ' HP → ' + actor.hp + '/' + (actor.maxHp || 10));
    }

    // Use camelCase stat names
    var attackBoost = card.stats.attackBoost || card.stats.attack_boost || 0;
    if (attackBoost > 0) {
      actor.tempAttackBoost = (actor.tempAttackBoost || 0) + attackBoost;
      lines.push('├─ Gained +' + attackBoost + ' attack power (next turn)');
    }

    var speedBoost = card.stats.speedBoost || card.stats.speed_boost || 0;
    if (speedBoost > 0) {
      actor.tempSpeedBoost = (actor.tempSpeedBoost || 0) + speedBoost;
      lines.push('├─ Gained +' + speedBoost + ' speed (next turn)');
    }

    var accuracyBoost = card.stats.accuracyBoost || card.stats.accuracy_boost || 0;
    if (accuracyBoost > 0) {
      actor.tempAccuracyBoost = (actor.tempAccuracyBoost || 0) + accuracyBoost;
      lines.push('└─ Gained +' + accuracyBoost + '% accuracy (next turn)');
    }

    return lines;
  }

  /**
   * Handle boss-specific card interactions
   */
  function _handleBossCardInteraction(card, target) {
    var lines = [];
    var handled = false;

    if (!_activeBoss) {
      return { handled: false, lines: [] };
    }

    var cardName = card.name;
    var gameState = {
      player: _player,
      enemy: target,
      grid: _grid,
      bossEnvironment: _bossEnvironment
    };

    // LURE card interaction
    if (cardName === 'Lure') {
      handled = true;
      lines.push('├─ Using LURE on boss...');
      var playerAction = {
        type: 'LURE',
        target: 'TRAIN_PATH',
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        if (exploitResult.damage) {
          target.hp = Math.max(0, target.hp - exploitResult.damage);
          lines.push('└─ Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
        }
      } else {
        lines.push('└─ Lure had no effect (boss not in position)');
      }
    }

    // GRENADE card interaction
    else if (cardName === 'Grenade') {
      handled = true;
      lines.push('├─ Throwing GRENADE at boss environment...');
      var playerAction = {
        type: 'GRENADE',
        targetX: target.x || 20,
        targetY: target.y || 10,
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        if (exploitResult.shieldDown || exploitResult.bunkerDown) {
          // Environmental damage - apply some damage to boss
          var damage = card.stats.damage || 6;
          target.hp = Math.max(0, target.hp - damage);
          lines.push('└─ Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
        }
      } else {
        // Standard grenade damage
        var damage = card.stats.damage || 6;
        target.hp = Math.max(0, target.hp - damage);
        lines.push('├─ Grenade explodes! ' + damage + ' damage');
        lines.push('└─ Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
      }
    }

    // JAMMER card interaction
    else if (cardName === 'Jammer') {
      handled = true;
      lines.push('├─ Activating JAMMER on boss systems...');
      var playerAction = {
        type: 'JAMMER',
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        lines.push('└─ Boss systems disrupted!');
      } else {
        target.weaponJammed = true;
        lines.push('└─ Boss weapon systems jammed for 1 turn');
      }
    }

    // VIRUS card interaction
    else if (cardName === 'Virus') {
      handled = true;
      lines.push('├─ Uploading VIRUS to boss systems...');
      var damage = card.stats.damage || 2;
      target.hp = Math.max(0, target.hp - damage);
      target.virusDOT = (card.stats.dot || 3);
      target.virusDuration = (card.stats.duration || 3);
      lines.push('├─ Initial damage: ' + damage);
      lines.push('├─ Virus will deal ' + target.virusDOT + ' damage for ' + target.virusDuration + ' turns');
      lines.push('└─ Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
    }

    // HIGH_GROUND card interaction
    else if (cardName === 'High Ground') {
      handled = true;
      lines.push('├─ Taking HIGH GROUND position...');
      var playerAction = {
        type: 'HIGH_GROUND',
        target: 'CARRIER',
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited && exploitResult.bypassShield) {
        lines.push('├─ ' + exploitResult.message);
        var damage = exploitResult.damage || (card.stats.damage || 4) * 2;
        target.hp = Math.max(0, target.hp - damage);
        lines.push('└─ Piercing damage: ' + damage + ' → Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
      } else {
        var damage = card.stats.damage || 4;
        target.hp = Math.max(0, target.hp - damage);
        lines.push('├─ Piercing shot: ' + damage + ' damage');
        lines.push('└─ Boss HP: ' + target.hp + '/' + _activeBoss.maxHp);
      }
    }

    // LOGIC_HACK card interaction
    else if (cardName === 'Logic Hack') {
      handled = true;
      lines.push('├─ Executing LOGIC HACK on boss systems...');
      var targetNode = Math.floor(Math.random() * 8); // Random node 0-7
      var playerAction = {
        type: 'LOGIC_HACK',
        targetNode: targetNode,
        card: card
      };
      var exploitResult = _activeBoss.checkExploit(playerAction, gameState);
      if (exploitResult.exploited) {
        lines.push('├─ ' + exploitResult.message);
        lines.push('└─ Boss defenses manipulated!');
      } else {
        lines.push('└─ Hack had no effect (wrong boss type)');
      }
    }

    // MELEE_STRIKE card interaction
    else if (cardName === 'Melee Strike') {
      // Track as melee for mythic conditions
      _player.lastCardType = 'MELEE';
      // Let it fall through to standard attack resolution
      return { handled: false, lines: [] };
    }

    return { handled: handled, lines: lines };
  }

  /**
   * Show STR combat UI with additional log lines
   */
  function _showStrCombatUIWithLog(logLines) {
    var lines = logLines || [];
    
    // Add current combat state
    lines.push('╔═══════════════════════════╗');
    lines.push('║  PLAYER: ' + _player.hp + '/' + (_player.maxHp || 10) + ' HP         ║');
    lines.push('║  ENEMY:  ' + _strCombatEnemy.hp + '/' + (_strCombatEnemy.maxHp || 5) + ' HP         ║');
    lines.push('╚═══════════════════════════╝');
    lines.push('');
    lines.push('🃏 Use attack card (swipe/click) to strike');
    lines.push('🛡️  Use defense card to defend');
    lines.push('🏃 Type FLEE to attempt escape');
    lines.push('');

    // Clear temp effects for next round
    _player.tempDefense = 0;
    _player.tempEvasion = 0;
    _strCombatEnemy.tempDefense = 0;
    _strCombatEnemy.tempEvasion = 0;

    // Show grid underneath
    lines = lines.concat(_renderGrid());

    // Trigger header flash if UI exists
    _triggerCombatFlash();

    return {
      lines: lines,
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Simple enemy AI: select a card to use
   * @returns {Object} Simulated enemy card
   */
  function _getEnemyAICard() {
    // Simple AI: choose based on HP and situation
    var enemy = _strCombatEnemy;
    var enemyHpPercent = (enemy.hp / (enemy.maxHp || 5)) * 100;
    
    // If low HP, prefer defense/healing
    if (enemyHpPercent < 30) {
      var roll = Math.random();
      if (roll < 0.4 && typeof CardSystem !== 'undefined') {
        // Try to defend
        return CardSystem.rollCard('DODGE');
      } else if (roll < 0.7 && typeof CardSystem !== 'undefined') {
        return CardSystem.rollCard('PRONE');
      }
    }
    
    // If healthy, prefer attacks
    if (enemyHpPercent > 50) {
      var attackRoll = Math.random();
      if (typeof CardSystem !== 'undefined') {
        if (attackRoll < 0.5) {
          return CardSystem.rollCard('SINGLE_SHOT');
        } else if (attackRoll < 0.8) {
          return CardSystem.rollCard('BURST_SHOT');
        } else {
          return CardSystem.rollCard('OVERWATCH');
        }
      }
    }
    
    // Default: basic attack
    if (typeof CardSystem !== 'undefined') {
      return CardSystem.rollCard('SINGLE_SHOT');
    }
    
    // Fallback: create a basic attack card
    return {
      name: 'Basic Attack',
      emoji: '🔫',
      type: 'attack',
      category: 'attack',
      stats: { damage: 2, accuracy: 70, energy: 1, speed: 2 }
    };
  }

  /**
   * Execute a round of STR combat (legacy single-action system)
   */
  function _executeStrRound(initiator, card) {
    _strCombatRound++;

    if (initiator === 'player') {
      return _playerStrAttack(card);
    } else {
      return _enemyStrAttack();
    }
  }

  /**
   * Player attack in STR combat
   */
  function _playerStrAttack(card) {
    var enemy = _strCombatEnemy;
    if (!enemy || enemy.hp <= 0) {
      return _exitStrCombat('player_victory');
    }

    // Calculate hit
    var hitResult = _calculateHit(_player, enemy, _strCombatAdvantage);

    if (!hitResult.hit) {
      _strCombatLog.push('💨 PLAYER MISS!');
      _strCombatLog.push('');

      // Enemy counter-attack
      return _enemyStrAttack();
    }

    // Calculate damage
    var damageResult = _calculateDamage(_player, enemy, _strCombatAdvantage, card, hitResult.crit);
    enemy.hp -= damageResult.damage;

    // Log attack
    var critEmoji = hitResult.crit ? ' 💥 CRIT!' : '';
    _strCombatLog.push('⚡ PLAYER ATTACK' + critEmoji);
    _strCombatLog.push('├─ Hit: ' + (hitResult.roll || 0) + ' vs ' + (hitResult.target || 0));
    _strCombatLog.push('└─ Damage: ' + damageResult.damage + ' HP');
    if (damageResult.bonuses.length > 0) {
      _strCombatLog.push('   └─ Bonuses: ' + damageResult.bonuses.join(', '));
    }
    _strCombatLog.push('');

    // Check if enemy defeated
    if (enemy.hp <= 0) {
      _strCombatLog.push('💀 ENEMY DEFEATED!');
      return _exitStrCombat('player_victory');
    }

    // Enemy counter-attack
    return _enemyStrAttack();
  }

  /**
   * Enemy attack in STR combat
   */
  function _enemyStrAttack() {
    var enemy = _strCombatEnemy;
    if (!enemy || enemy.hp <= 0) {
      return _exitStrCombat('player_victory');
    }

    // Calculate hit (reverse advantage for enemy)
    var reverseAdvantage = _strCombatAdvantage === 'flanked' ? 'ambush' :
                          _strCombatAdvantage === 'ambush' ? 'flanked' : 'neutral';
    var hitResult = _calculateHit(enemy, _player, reverseAdvantage);

    if (!hitResult.hit) {
      _strCombatLog.push('💨 ENEMY MISS!');
      _strCombatLog.push('');
      return _showStrCombatUI();
    }

    // Calculate damage
    var damageResult = _calculateDamage(enemy, _player, reverseAdvantage, null, hitResult.crit);
    _player.hp -= damageResult.damage;

    // Log attack
    var critEmoji = hitResult.crit ? ' 💥 CRIT!' : '';
    _strCombatLog.push('🗡️  ENEMY ATTACK' + critEmoji);
    _strCombatLog.push('├─ Hit: ' + (hitResult.roll || 0) + ' vs ' + (hitResult.target || 0));
    _strCombatLog.push('└─ Damage: ' + damageResult.damage + ' HP');
    _strCombatLog.push('');

    // Check if player defeated
    if (_player.hp <= 0) {
      _strCombatLog.push('💀 YOU HAVE BEEN DEFEATED...');
      return _exitRogue(false); // Player death
    }

    // Continue combat - show UI for player's turn
    return _showStrCombatUI();
  }

  /**
   * Calculate hit chance and roll
   */
  function _calculateHit(attacker, defender, advantage) {
    var baseHitChance = 70; // Base 70% hit chance
    var attackerDex = attacker.dex || 5;
    var defenderDex = defender.dex || 5;
    var distance = _distanceBetween(attacker, defender);
    var bracket = _getDistanceBracket(distance);

    // Advantage modifiers
    var advantageBonus = 0;
    var critThreshold = 95; // Base crit on 95+

    if (advantage === 'ambush') {
      advantageBonus = 40;
      critThreshold = Math.max(5, critThreshold - 30); // Easier crits when ambushing
    } else if (advantage === 'flanked' || advantage === 'disadvantaged') {
      advantageBonus = -25;
      critThreshold = 98; // Harder crits when disadvantaged
    }

    var distancePenalty = {
      melee: 0,
      close: 5,
      mid: 15,
      far: 35
    }[bracket] || 0;

    // Calculate hit chance
    var hitChance = baseHitChance + (attackerDex - defenderDex) * 2 + advantageBonus - distancePenalty;
    hitChance = Math.max(5, Math.min(95, hitChance)); // Clamp between 5-95%

    // Roll d100
    var roll = Math.floor(Math.random() * 100) + 1;

    return {
      hit: roll <= hitChance,
      crit: roll >= critThreshold,
      roll: roll,
      target: hitChance
    };
  }

  /**
   * Calculate damage dealt
   */
  function _calculateDamage(attacker, defender, advantage, card, isCrit) {
    var baseDamage = 2;
    var attackerStr = attacker.str || 5;
    var defenderStr = defender.str || 5;
    var bonuses = [];

    // Card damage
    if (card && card.stats && card.stats.damage) {
      baseDamage = card.stats.damage;
      bonuses.push('Card: ' + card.stats.damage);
    }

    // Strength modifier
    var strMod = Math.floor((attackerStr - defenderStr) / 2);
    baseDamage += strMod;
    if (strMod > 0) {
      bonuses.push('STR: +' + strMod);
    }

    // Advantage damage modifiers
    if (advantage === 'ambush') {
      baseDamage += 2;
      bonuses.push('Ambush: +2');
    } else if (advantage === 'flanked') {
      baseDamage -= 1;
      bonuses.push('Flanked: -1');
    }

    // Minimum 1 damage
    baseDamage = Math.max(1, baseDamage);

    if (isCrit) {
      baseDamage = Math.ceil(baseDamage * 1.75);
      bonuses.push('CRIT x1.75');
    }

    return {
      damage: baseDamage,
      bonuses: bonuses
    };
  }

  /**
   * Show STR combat UI and wait for player action
   */
  function _showStrCombatUI() {
    var lines = [];
    lines.push('═══════════════════════════════════════');
    lines.push('⚔️  STR COMBAT - ROUND ' + _strCombatRound);
    lines.push('═══════════════════════════════════════');
    lines.push('');

    // Combat log
    _strCombatLog.forEach(function(logLine) {
      lines.push(logLine);
    });

    lines.push('───────────────────────────────────────');
    lines.push('PLAYER HP: ' + _player.hp + '/' + _player.maxHp + ' ❤️   |   ENEMY HP: ' + _strCombatEnemy.hp + '/5 💀');
    lines.push('Advantage: ' + _strCombatAdvantage.toUpperCase() + ' ' + _getAdvantageEmoji(_strCombatAdvantage));
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push('🃏 Use attack card (swipe/click) to strike');
    lines.push('🛡️  Use stance card to defend (+stealth)');
    lines.push('🏃 Type FLEE to attempt escape');
    lines.push('');

    // Show grid underneath
    lines = lines.concat(_renderGrid());

    // Trigger header flash if UI exists
    _triggerCombatFlash();

    return {
      lines: lines,
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Exit STR combat and return to realtime
   */
  function _exitStrCombat(reason) {
    var lines = [];

    if (reason === 'player_victory') {
      lines.push('✅ COMBAT VICTORY!');
      lines.push('└─ Enemy neutralized');

      // Check if this was a boss fight
      if (_bossFloorActive && _activeBoss && !_bossDefeated) {
        _bossDefeated = true;
        lines.push('');
        lines.push('🏆 BOSS DEFEATED!');

        // Check for boss overkill (200%+ damage) for secret floor trigger
        if (typeof SecretFloors !== 'undefined' && _strCombatEnemy) {
          var totalDamageDealt = _activeBoss.maxHp; // Boss HP that was depleted
          var overkillThreshold = _activeBoss.maxHp * 2; // 200% of max HP

          if (totalDamageDealt >= overkillThreshold) {
            var triggerResult = SecretFloors.triggerSecretFloor(
              SecretFloors.TRIGGER_TYPES.BOSS_OVERKILL,
              {
                damageDealt: totalDamageDealt,
                bossMaxHp: _activeBoss.maxHp
              }
            );

            if (triggerResult.success) {
              lines.push('');
              lines.push(triggerResult.message);
              lines.push('└─ Reality feels unstable...');
            } else if (triggerResult.suspicion) {
              lines.push('└─ Something feels... wrong. [' + triggerResult.suspicion + '/' + triggerResult.threshold + ']');
            }
          }
        }

        // Generate boss loot
        var bossLoot = _activeBoss.onDefeat(_player);
        lines.push('');

        // Process boss loot
        if (bossLoot.loot && bossLoot.loot.length > 0) {
          bossLoot.loot.forEach(function(lootItem) {
            if (lootItem.type === 'card') {
              var card;
              if (typeof CardSystem !== 'undefined') {
                var baseType = CardSystem.getRandomBaseCard();
                card = CardSystem.rollCard(baseType);
                // Force quality if specified
                if (lootItem.quality) {
                  card.quality = lootItem.quality;
                }
              }
              if (card) {
                _items.push({
                  x: _strCombatEnemy.x,
                  y: _strCombatEnemy.y,
                  type: 'card',
                  card: card,
                  spawnTime: Date.now(),
                  decayTime: 60000 // Boss loot lasts 60 seconds
                });
                lines.push('🎴 Boss dropped: ' + card.emoji + ' ' + card.name + ' (' + card.quality + ')');
              }
            } else if (lootItem.type === 'whisper') {
              lines.push('✨ WHISPER ITEM: ' + lootItem.item);
              // Spawn as special loot
              _spawnCurrency(_strCombatEnemy.x, _strCombatEnemy.y, 50); // Extra cryptos for whisper
            } else if (lootItem.type === 'mythic') {
              lines.push('');
              lines.push('⚡⚡⚡ MYTHIC CONDITION MET! ⚡⚡⚡');
              lines.push('💎 MYTHIC DROP: ' + lootItem.item);
              lines.push('');
              // Spawn legendary card
              if (typeof CardSystem !== 'undefined') {
                var legendaryCard = CardSystem.rollCard('INVENTORY_CHARM'); // Guaranteed inventory charm
                _items.push({
                  x: _strCombatEnemy.x,
                  y: _strCombatEnemy.y,
                  type: 'card',
                  card: legendaryCard,
                  spawnTime: Date.now(),
                  decayTime: 120000 // Mythic loot lasts 2 minutes
                });
              }
            } else if (lootItem.type === 'rumor') {
              lines.push('');
              lines.push('📜 ' + lootItem.message);
              lines.push('');
            }
          });
        }

        // Boss always drops significant cryptos
        var bossReward = 25 + Math.floor(Math.random() * 26); // 25-50 cryptos
        _spawnCurrency(_strCombatEnemy.x, _strCombatEnemy.y, bossReward);
        lines.push('💰 Boss dropped ¢' + bossReward);

        // Check for Impossible Charm drop (very rare)
        if (_activeBoss && typeof CardSystem !== 'undefined') {
          var isUberMega = _activeBoss.type === 'UBER_MEGA';
          var isFinalBoss = _floor === 30;
          var impossibleCharmChance = 0;

          if (isUberMega) {
            impossibleCharmChance = 0.05; // 5% chance from Uber Mega
          } else if (isFinalBoss) {
            impossibleCharmChance = 0.10; // 10% chance from final boss
          }

          if (impossibleCharmChance > 0 && Math.random() < impossibleCharmChance) {
            var impossibleCharm = CardSystem.rollImpossibleCharm();
            _items.push({
              x: _strCombatEnemy.x,
              y: _strCombatEnemy.y,
              type: 'charm',
              card: impossibleCharm,
              spawnTime: Date.now(),
              decayTime: 120000 // 2 minutes to pick up
            });
            lines.push('');
            lines.push('💠💠💠 IMPOSSIBLE BINARY CHARM DROPPED! 💠💠💠');
            lines.push('└─ A legendary artifact materializes...');
            lines.push('');
          }
        }
      } else {
        // Regular enemy loot
        var cryptoAmount = Math.floor(Math.random() * 5) + 2; // 2-6 cryptos
        _spawnCurrency(_strCombatEnemy.x, _strCombatEnemy.y, cryptoAmount);
        lines.push('💰 Enemy dropped ¢' + cryptoAmount);

        // 50% chance to drop a card
        if (Math.random() < 0.5 && typeof CardSystem !== 'undefined') {
          var baseType = CardSystem.getRandomBaseCard();
          var card = CardSystem.rollCard(baseType);
          if (card) {
            _items.push({
              x: _strCombatEnemy.x,
              y: _strCombatEnemy.y,
              type: 'card',
              card: card,
              spawnTime: Date.now(),
              decayTime: 30000 // 30 second decay
            });
            lines.push('🎴 Enemy dropped a card!');
          }
        }

        // 30% chance to drop a common charm
        if (Math.random() < 0.30 && typeof CardSystem !== 'undefined') {
          var charm = CardSystem.rollCommonCharm();
          if (charm) {
            _items.push({
              x: _strCombatEnemy.x,
              y: _strCombatEnemy.y,
              type: 'charm',
              card: charm,
              spawnTime: Date.now(),
              decayTime: 30000 // 30 second decay
            });
            lines.push('✨ Enemy dropped a charm!');
          }
        }
      }

      // Remove defeated enemy from map
      var enemyIndex = _enemies.indexOf(_strCombatEnemy);
      if (enemyIndex > -1) {
        _enemies[enemyIndex].hp = 0;
      }
    } else if (reason === 'fled') {
      lines.push('🏃 FLED COMBAT!');
      lines.push('└─ Repositioned to safety');

      // Move player back one space
      if (_player.lastMoveDirection) {
        var reverseDir = {
          'north': { dx: 0, dy: 1 },
          'south': { dx: 0, dy: -1 },
          'east': { dx: -1, dy: 0 },
          'west': { dx: 1, dy: 0 }
        };
        var move = reverseDir[_player.lastMoveDirection];
        if (move) {
          _player.x += move.dx;
          _player.y += move.dy;
        }
      }
    }

    lines.push('');
    lines.push('Movement unlocked. Returning to realtime grid...');
    lines.push('');

    // Reset combat state
    _strCombatActive = false;
    _strCombatEnemy = null;
    _strCombatAdvantage = 'neutral';
    _strCombatRound = 0;
    _strCombatLog = [];

    // Disable combat zoom
    _disableCombatZoom();

    // Resume game loop
    if (!_gameLoopActive) {
      _startGameLoop();
    }

    _saveState();

    return {
      lines: lines.concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Trigger combat flash effect on header
   */
  function _triggerCombatFlash() {
    if (typeof document === 'undefined') return;

    var header = document.querySelector('.monitor-header') || document.querySelector('#mok-header');
    if (header) {
      header.classList.add('attackFlash');
      setTimeout(function() {
        header.classList.remove('attackFlash');
      }, 500);
    }
  }

  /**
   * Pause game loop (for STR combat)
   */
  function _pauseGameLoop() {
    if (_animationFrameId) {
      cancelAnimationFrame(_animationFrameId);
      _animationFrameId = null;
    }
    _gameLoopActive = false;
  }

  /**
   * Check if STR combat is active
   */
  function isStrCombatActive() {
    return _strCombatActive;
  }

  /**
   * Get STR combat state (for mobile UI)
   */
  function getStrCombatState() {
    return {
      active: _strCombatActive,
      enemy: _strCombatEnemy,
      advantage: _strCombatAdvantage,
      round: _strCombatRound,
      log: _strCombatLog
    };
  }

  // ============================================================
  // END STR COMBAT SYSTEM
  // ============================================================

  /**
   * Get player state (for mobile UI)
   */
  function getPlayer() {
    return _player;
  }

  /**
   * Get enemies state (for mobile UI)
   */
  function getEnemies() {
    return _enemies;
  }

  /**
   * Enable combat zoom/focus (for desktop STR combat visual feedback)
   */
  function _enableCombatZoom() {
    if (typeof document === 'undefined') return;

    // Add combat-active class to grid for CSS zoom effect
    var gridContainer = document.getElementById('rogue-grid-mobile');
    if (gridContainer) {
      gridContainer.classList.add('combat-zoom-active');
    }

    // Flash the header to indicate combat start
    _triggerCombatFlash();

    // For desktop: optionally center view on player and enemy
    // This could be enhanced with CSS transforms or scrollIntoView
  }

  /**
   * Disable combat zoom (return to normal view)
   */
  function _disableCombatZoom() {
    if (typeof document === 'undefined') return;

    var gridContainer = document.getElementById('rogue-grid-mobile');
    if (gridContainer) {
      gridContainer.classList.remove('combat-zoom-active');
    }
  }

  // ============================================================
  // ACTIVE ITEM USAGE & GROUND INTERACTION SYSTEM
  // ============================================================

  /**
   * Trigger active item usage (called when clicking active slot with inventory closed)
   * Implements ground effects, buffs, healing, etc.
   */
  function triggerActiveItem() {
    if (typeof GAMESTATE === 'undefined') {
      return {
        lines: ['GAMESTATE UNAVAILABLE'],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var activeItem = GAMESTATE.getActiveItem();
    if (!activeItem) {
      return {
        lines: ['NO ACTIVE ITEM', 'Equip an item from inventory first'],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    // Determine targeting: player tile + adjacent tiles
    var targetTiles = [
      { x: _player.x, y: _player.y }, // Player tile
      { x: _player.x + 1, y: _player.y }, // Right
      { x: _player.x - 1, y: _player.y }, // Left
      { x: _player.x, y: _player.y + 1 }, // Down
      { x: _player.x, y: _player.y - 1 }  // Up
    ];

    // Resolve item-to-ground interaction
    var result = _resolveGroundInteraction(activeItem, targetTiles);

    // Update mobile grid if active
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      _updateMobileGrid();
    }

    return result;
  }

  /**
   * Resolve interaction between active item and ground tiles
   * @param {Object} item - Active item
   * @param {Array} tiles - Array of {x, y} target tiles
   * @returns {Object} - Command result
   */
  function _resolveGroundInteraction(item, tiles) {
    if (!item || !tiles || typeof GroundEffects === 'undefined') {
      return {
        lines: ['CANNOT USE ITEM HERE'],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var itemName = item.name ? item.name.toLowerCase() : '';
    var messages = [];
    var effectApplied = false;

    // LIGHTER: Ignite flammable surfaces (oil)
    if (itemName.indexOf('lighter') !== -1 || itemName.indexOf('🔥') !== -1) {
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        if (tile.x < 0 || tile.x >= GRID_WIDTH || tile.y < 0 || tile.y >= GRID_HEIGHT) continue;

        var groundEffect = GroundEffects.getGroundEffect(tile.x, tile.y);
        if (groundEffect && groundEffect.canIgnite) {
          // Ignite oil
          GroundEffects.igniteOil(tile.x, tile.y);
          messages.push('🔥 IGNITED OIL at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        } else if (!groundEffect || groundEffect.type === 'normal') {
          // Create small fire on empty tile
          GroundEffects.setGroundEffect(tile.x, tile.y, 'FIRE');
          messages.push('🔥 LIT FIRE at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        }
      }

      if (!effectApplied) {
        messages.push('💡 LIGHTER: No flammable surfaces nearby');
      }
    }
    // WATER BOTTLE: Extinguish fire, create water
    else if (itemName.indexOf('water') !== -1 || itemName.indexOf('bottle') !== -1 || itemName.indexOf('💧') !== -1) {
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        if (tile.x < 0 || tile.x >= GRID_WIDTH || tile.y < 0 || tile.y >= GRID_HEIGHT) continue;

        var groundEffect = GroundEffects.getGroundEffect(tile.x, tile.y);
        if (groundEffect && (groundEffect.type === 'FIRE' || groundEffect.type === 'OIL_IGNITED')) {
          // Extinguish fire
          GroundEffects.extinguishFire(tile.x, tile.y);
          messages.push('💧 EXTINGUISHED FIRE at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        } else if (!groundEffect || groundEffect.type === 'normal') {
          // Create water
          GroundEffects.setGroundEffect(tile.x, tile.y, 'WATER');
          messages.push('💧 WATER SPILLED at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        }
      }

      if (!effectApplied) {
        messages.push('💧 WATER: No fires to extinguish');
      }
    }
    // TAZER/SHOCK: Electrify conductive surfaces (water, rail)
    else if (itemName.indexOf('tazer') !== -1 || itemName.indexOf('taser') !== -1 ||
             itemName.indexOf('shock') !== -1 || itemName.indexOf('⚡') !== -1) {
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        if (tile.x < 0 || tile.x >= GRID_WIDTH || tile.y < 0 || tile.y >= GRID_HEIGHT) continue;

        var groundEffect = GroundEffects.getGroundEffect(tile.x, tile.y);
        if (groundEffect && (groundEffect.type === 'WATER' || groundEffect.conductive)) {
          // Electrify water (spread to adjacent water tiles)
          _electrifyWater(tile.x, tile.y, 2); // 2 tile radius spread
          messages.push('⚡ ELECTRIFIED WATER at (' + tile.x + ',' + tile.y + ')');
          effectApplied = true;
        }
      }

      if (!effectApplied) {
        messages.push('⚡ TAZER: No conductive surfaces nearby');
      }
    }
    // HEALING ITEMS: Restore HP
    else if (itemName.indexOf('medkit') !== -1 || itemName.indexOf('bandage') !== -1 ||
             itemName.indexOf('heal') !== -1 || itemName.indexOf('💊') !== -1) {
      var healAmount = 20 + Math.floor(Math.random() * 11); // 20-30 HP
      _player.hp = Math.min(_player.hp + healAmount, _player.maxHp);
      messages.push('💊 HEALED: +' + healAmount + ' HP');
      messages.push('HP: ' + _player.hp + '/' + _player.maxHp);
      effectApplied = true;
    }
    // DEFAULT: Item has passive effect or no ground interaction
    else {
      messages.push('📦 ' + item.emoji + ' ' + item.name);
      messages.push('This item provides passive benefits while equipped');
      effectApplied = true;
    }

    if (messages.length === 0) {
      messages.push('ITEM USED: ' + item.name);
    }

    return {
      lines: messages.concat(['']).concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
  }

  /**
   * Electrify water tiles in radius (for tazer effect)
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Spread radius
   */
  function _electrifyWater(x, y, radius) {
    if (typeof GroundEffects === 'undefined') return;

    var queue = [{x: x, y: y, dist: 0}];
    var visited = {};
    visited[x + ',' + y] = true;

    while (queue.length > 0) {
      var current = queue.shift();

      // Apply electrified effect
      var groundEffect = GroundEffects.getGroundEffect(current.x, current.y);
      if (groundEffect && groundEffect.type === 'WATER') {
        // Add electrified property to water
        GroundEffects.setGroundEffect(current.x, current.y, 'WATER', {
          electrified: true,
          electrifiedTime: Date.now(),
          electrifiedDuration: 6000 // 6 seconds
        });
      }

      // Spread to adjacent tiles within radius
      if (current.dist < radius) {
        var neighbors = [
          {x: current.x + 1, y: current.y},
          {x: current.x - 1, y: current.y},
          {x: current.x, y: current.y + 1},
          {x: current.x, y: current.y - 1}
        ];

        for (var i = 0; i < neighbors.length; i++) {
          var n = neighbors[i];
          var key = n.x + ',' + n.y;

          if (n.x >= 0 && n.x < GRID_WIDTH && n.y >= 0 && n.y < GRID_HEIGHT && !visited[key]) {
            visited[key] = true;

            var neighborEffect = GroundEffects.getGroundEffect(n.x, n.y);
            if (neighborEffect && (neighborEffect.type === 'WATER' || neighborEffect.conductive)) {
              queue.push({x: n.x, y: n.y, dist: current.dist + 1});
            }
          }
        }
      }
    }
  }

  // ============================================================
  // END ACTIVE ITEM USAGE SYSTEM
  // ============================================================

  // ============================================================
  // GROUND EFFECT COMBAT MODIFIERS
  // ============================================================

  /**
   * Apply ground effect modifiers when STR combat starts
   * Scans 3x3 tiles around player and enemy, applies status effects
   */
  function _applyGroundEffectModifiers() {
    if (typeof GroundEffects === 'undefined') return;

    var playerGroundEffect = GroundEffects.getGroundEffect(_player.x, _player.y);
    var enemyGroundEffect = null;

    if (_strCombatEnemy) {
      enemyGroundEffect = GroundEffects.getGroundEffect(_strCombatEnemy.x, _strCombatEnemy.y);
    }

    // Apply player ground effect modifiers
    if (playerGroundEffect) {
      _applyPlayerGroundModifier(playerGroundEffect);
    }

    // Apply enemy ground effect modifiers
    if (enemyGroundEffect && _strCombatEnemy) {
      _applyEnemyGroundModifier(enemyGroundEffect, _strCombatEnemy);
    }
  }

  /**
   * Apply ground effect modifier to player
   * @param {Object} effect - Ground effect
   */
  function _applyPlayerGroundModifier(effect) {
    if (!effect) return;

    // FIRE / OIL_IGNITED: Start combat with reduced HP and burn status
    if (effect.type === 'FIRE' || effect.type === 'OIL_IGNITED') {
      var burnDamage = Math.floor(_player.maxHp * 0.1); // 10% HP
      _player.hp = Math.max(1, _player.hp - burnDamage);
      _strCombatLog.push('🔥 STANDING IN FIRE! -' + burnDamage + ' HP');
      _strCombatLog.push('└─ Burn status applied');
    }
    // ELECTRIFIED WATER: Shock risk, reduced evasion
    else if (effect.type === 'WATER' && effect.electrified) {
      _strCombatLog.push('⚡ STANDING IN ELECTRIFIED WATER!');
      _strCombatLog.push('└─ Shock risk, -20% evasion');
      // Modifier will be checked during damage calculation
    }
    // INDUSTRIAL_WASTE: Random mutation or debuff
    else if (effect.type === 'INDUSTRIAL_WASTE') {
      if (Math.random() < 0.3) {
        _strCombatLog.push('☢️  TOXIC WASTE EXPOSURE!');
        _strCombatLog.push('└─ Random debuff applied');
        // Could implement specific debuffs here
      }
    }
    // WATER: Movement penalty, reduced evasion
    else if (effect.type === 'WATER') {
      _strCombatLog.push('💧 Standing in water: -10% evasion');
    }
  }

  /**
   * Apply ground effect modifier to enemy
   * @param {Object} effect - Ground effect
   * @param {Object} enemy - Enemy object
   */
  function _applyEnemyGroundModifier(effect, enemy) {
    if (!effect || !enemy) return;

    // FIRE / OIL_IGNITED: Enemy takes damage, may be stunned
    if (effect.type === 'FIRE' || effect.type === 'OIL_IGNITED') {
      var burnDamage = Math.floor(enemy.maxHp * 0.15); // 15% HP for enemies
      enemy.hp = Math.max(1, enemy.hp - burnDamage);
      _strCombatLog.push('🔥 ENEMY IN FIRE! -' + burnDamage + ' HP');

      // Weak enemies may be KO'd immediately
      if (enemy.hp <= burnDamage && enemy.tier === 'SCOUT') {
        enemy.hp = 0;
        _strCombatLog.push('└─ Enemy KO\'d by fire!');
      }
    }
    // ELECTRIFIED WATER: Stun enemy for first turn
    else if (effect.type === 'WATER' && effect.electrified) {
      _strCombatLog.push('⚡ ENEMY IN ELECTRIFIED WATER!');
      _strCombatLog.push('└─ Enemy stunned turn 1');
      enemy.stunnedTurns = 1;
    }
    // INDUSTRIAL_WASTE: Random debuff
    else if (effect.type === 'INDUSTRIAL_WASTE') {
      if (Math.random() < 0.3) {
        _strCombatLog.push('☢️  Enemy exposed to toxic waste');
        _strCombatLog.push('└─ Enemy weakened');
        enemy.weakened = true;
      }
    }
  }

  // ============================================================
  // END GROUND EFFECT COMBAT MODIFIERS
  // ============================================================

  return {
    init: init,
    start: start,
    process: process,
    isActive: isActive,
    getPrompt: getPrompt,
    handleTapMove: handleTapMove,
    handleCardSwipe: handleCardSwipe,
    getPlayer: getPlayer,
    getEnemies: getEnemies,
    getEnemyAwarenessState: getEnemyAwarenessState,
    getBreakables: function() { return _breakables; },
    getProjectiles: function() { return _projectiles; },
    fireProjectile: _fireProjectile,
    stepProjectiles: stepProjectiles,
    isStrCombatActive: isStrCombatActive,
    getStrCombatState: getStrCombatState,
    triggerActiveItem: triggerActiveItem,
    updatePlayerLight: _updatePlayerLight
  };
})();
