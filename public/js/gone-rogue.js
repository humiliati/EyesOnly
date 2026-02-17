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
    initiative: 0 // Initiative bonus
  };

  var _enemies = [];
  var _items = [];
  var _projectiles = [];
  var _breakables = [];
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

  var TILES = {
    EMPTY: '.',
    WALL: '█',
    PLAYER: '@',
    ENEMY: 'E',
    ITEM: '*',
    EXIT: '▼',
    COVER: '▓',
    BREAKABLE: '☐',
    DEBRIS: '░',
    PROJECTILE: '•',
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

    // Initialize from GAMESTATE if available
    if (typeof GAMESTATE !== 'undefined') {
      var result = GAMESTATE.enterRogueMode(context);
      var lines = result.lines || [];
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
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles);

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
      '  HELP               - This help',
      '  EXIT               - Return to Street Chronicles',
      '',
      'LEGEND:',
      '  @ = You        E = Enemy      * = Item',
      '  ▼ = Exit       █ = Wall       ▓ = Cover',
      '  ░ = Shadow     , = Grass      ≈ = Smoke',
      '  ▒ = Hazard     ☐ = Breakable',
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

  function _generateFloor() {
    // Initialize generation state
    _projectiles = [];
    _breakables = [];
    _items = [];
    _enemies = [];
    _tileMetadata = {};

    var maxAttempts = 10;
    var attempt = 0;
    var validMap = false;

    // Try to generate a valid map (with stealth path validation)
    while (!validMap && attempt < maxAttempts) {
      attempt++;

      // Step 1: Create empty grid
      _grid = _createEmptyGrid();

      // Step 2: Generate rooms
      var rooms = _generateRooms();

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

      // Step 9: Place enemies
      _placeEnemies(rooms);

      // Step 10: Validate stealth path
      validMap = _validateStealthPath(_player.x, _player.y, exitX, exitY);

      if (!validMap && attempt < maxAttempts) {
        console.log('Map validation failed, regenerating... (attempt ' + attempt + ')');
      }
    }

    if (!validMap) {
      console.warn('Could not generate fully valid map after ' + maxAttempts + ' attempts. Using current map.');
    }

    // Place breakables (deterministic for tests)
    _spawnBreakables();

    // Place items
    _placeItems();

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

  function _generateRooms() {
    // Difficulty affects room count and size
    var difficulty = _floor;
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
    // Add environmental tiles based on difficulty
    var difficulty = _floor;

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

    // Place player in first room
    var firstRoom = rooms[0];
    var playerX = firstRoom.centerX;
    var playerY = firstRoom.centerY;

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

    // Place exit tile
    _grid[exitY][exitX] = TILES.EXIT;

    return { playerX: playerX, playerY: playerY, exitX: exitX, exitY: exitY };
  }

  function _placeEnemies(rooms) {
    // Enemy density based on difficulty
    var difficulty = _floor;
    var enemyCount;

    if (difficulty <= 3) {
      enemyCount = 4 + Math.floor(Math.random() * 3); // 4-6
    } else if (difficulty <= 7) {
      enemyCount = 7 + Math.floor(Math.random() * 4); // 7-10
    } else {
      enemyCount = 12 + Math.floor(Math.random() * 7); // 12-18
    }

    enemyCount = Math.min(enemyCount, rooms.length * 3); // Don't overcrowd

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
      pathTimer: 0
    };

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

  function _placeItems() {
    var itemCount = 5;
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
        _items.push({ x: ix, y: iy, card: card });
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
    // Clear path in front of player for deterministic projectile tests
    if (_isInsideBounds(_player.x + 1, _player.y)) _grid[_player.y][_player.x + 1] = TILES.EMPTY;
    if (_isInsideBounds(_player.x + 2, _player.y)) _grid[_player.y][_player.x + 2] = TILES.EMPTY;
    if (_isInsideBounds(_player.x + 3, _player.y)) _grid[_player.y][_player.x + 3] = TILES.EMPTY;

    _breakables = [
      { x: _player.x + 1, y: _player.y, hp: 3, glyph: TILES.BREAKABLE, destroyedGlyph: TILES.DEBRIS, emoji: '📦', tag: 'close_crate' },
      { x: _player.x + 6, y: _player.y - 2, hp: 2, glyph: TILES.BREAKABLE, destroyedGlyph: TILES.DEBRIS, emoji: '🧱', tag: 'far_crate' }
    ].filter(function(b) {
      return b.x > 0 && b.x < GRID_WIDTH - 1 && b.y > 0 && b.y < GRID_HEIGHT - 1;
    });

    _breakables.forEach(function(breakable) {
      _grid[breakable.y][breakable.x] = TILES.BREAKABLE;
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
    lines.push('HP: ' + _player.hp + '/' + _player.maxHp + ' | Floor: ' + _floor + ' | Turn: ' + _turn);
    lines.push('');

    return lines;
  }

  function _movePlayer(dx, dy, runMode) {
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
    } else {
      _player.detection = Math.max(0, _player.detection - 0.5);
      _updateAlertLevel();
    }

    // Check for enemy collision - trigger STR combat
    var hitEnemy = _enemies.find(function(e) { return e.x === newX && e.y === newY && e.hp > 0; });
    if (hitEnemy) {
      // Enter STR combat mode
      return _enterStrCombat(hitEnemy, 'collision');
    }

    _saveState();

    var lines = tileEffectMessage ? [tileEffectMessage, ''].concat(_renderGrid()) : _renderGrid();

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
        lines: ['NO EXIT HERE', 'FIND THE EXTRACTION POINT (▼)', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    return _exitRogue(true);
  }

  function _exitRogue(success) {
    _active = false;
    _stopGameLoop();

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

    // Update color cycle timer for visual feedback
    _enemyColorCycleTime += deltaMs;

    // Re-render if using interactive grid
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles);
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

    if (tile === TILES.SHADOW && metadata && metadata.stealthBonus) {
      return metadata.stealthBonus; // 30%
    } else if (tile === TILES.GRASS && metadata && metadata.stealthBonus) {
      return metadata.stealthBonus; // 20%
    } else if (tile === TILES.SMOKE && metadata && metadata.stealthBonus) {
      return metadata.stealthBonus; // 40%
    }

    return 0;
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
    if (breakable.hp === 0) {
      _grid[breakable.y][breakable.x] = breakable.destroyedGlyph || TILES.DEBRIS;
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
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles);
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
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles);
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
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles);
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
      _active = !!parsed.active;
    } catch (e) { /* ignore */ }
  }

  /**
   * Handle tap-to-move from mobile UI
   */
  function handleTapMove(targetX, targetY, runMode) {
    if (!_active) return;

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
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles);
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
    var result = _executeCardAction(action);

    // Update mobile UI
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items, _enemyColorCycleTime, _breakables, _projectiles);
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

    if (card.type === 'attack') {
      if (direction === 'up' || direction === 'right') {
        return { type: 'attack', card: card };
      }
    } else if (card.type === 'stance') {
      if (direction === 'up' || direction === 'left') {
        return { type: 'stance', card: card };
      }
    } else if (card.type === 'utility') {
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

    if (action.type === 'attack') {
      return _performAttack(action.card);
    } else if (action.type === 'stance') {
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

    // Initialize combat state
    _strCombatActive = true;
    _strCombatEnemy = enemy;
    _strCombatRound = 0;
    _strCombatLog = [];

    // Calculate advantage state
    _strCombatAdvantage = _calculateAdvantage(_player, enemy, trigger);

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
   * Execute a round of STR combat
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
    lines.push('Returning to realtime grid...');
    lines.push('');

    // Reset combat state
    _strCombatActive = false;
    _strCombatEnemy = null;
    _strCombatAdvantage = 'neutral';
    _strCombatRound = 0;
    _strCombatLog = [];

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
    getStrCombatState: getStrCombatState
  };
})();
