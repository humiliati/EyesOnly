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
    detection: 0
  };

  var _enemies = [];
  var _items = [];
  var _turn = 0;
  var _floor = 1;
  var _alertLevel = 'safe'; // safe, caution, danger
  var _useInteractiveGrid = false; // Use interactive DOM grid instead of text-only

  var TILES = {
    EMPTY: '.',
    WALL: '█',
    PLAYER: '@',
    ENEMY: 'E',
    ITEM: '*',
    EXIT: '▼',
    COVER: '▓'
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

    // Use mobile UI if available
    if (_useInteractiveGrid && typeof GoneRogueMobile !== 'undefined') {
      GoneRogueMobile.show();
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items);

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
      '  TAKE/PICKUP        - Pick up item',
      '  EXTRACT            - Extract from exit point',
      '  STATUS             - Show player stats',
      '  INVENTORY          - Show inventory',
      '  HELP               - This help',
      '  EXIT               - Return to Street Chronicles',
      '',
      'LEGEND:',
      '  @ = You',
      '  E = Enemy',
      '  * = Item',
      '  ▼ = Exit',
      '  █ = Wall',
      '  ▓ = Cover',
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
    // Initialize empty grid
    _grid = [];
    for (var y = 0; y < GRID_HEIGHT; y++) {
      var row = [];
      for (var x = 0; x < GRID_WIDTH; x++) {
        row.push(TILES.EMPTY);
      }
      _grid.push(row);
    }

    // Add walls (border)
    for (var x = 0; x < GRID_WIDTH; x++) {
      _grid[0][x] = TILES.WALL;
      _grid[GRID_HEIGHT - 1][x] = TILES.WALL;
    }
    for (var y = 0; y < GRID_HEIGHT; y++) {
      _grid[y][0] = TILES.WALL;
      _grid[y][GRID_WIDTH - 1] = TILES.WALL;
    }

    // Add some random walls and cover
    for (var i = 0; i < 20; i++) {
      var rx = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
      var ry = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;
      _grid[ry][rx] = Math.random() > 0.5 ? TILES.WALL : TILES.COVER;
    }

    // Place player
    _player.x = 5;
    _player.y = 10;

    // Place exit
    var exitX = GRID_WIDTH - 3;
    var exitY = GRID_HEIGHT - 3;
    _grid[exitY][exitX] = TILES.EXIT;

    // Place enemies
    _enemies = [];
    for (var i = 0; i < 3; i++) {
      var ex = Math.floor(Math.random() * (GRID_WIDTH - 10)) + 10;
      var ey = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;
      _enemies.push({ x: ex, y: ey, hp: 5 });
    }

    // Place items
    _items = [];
    for (var i = 0; i < 5; i++) {
      var ix = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
      var iy = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;

      // Generate random card
      if (typeof CardSystem !== 'undefined') {
        var baseType = CardSystem.getRandomBaseCard();
        var card = CardSystem.rollCard(baseType);
        _items.push({ x: ix, y: iy, card: card });
      }
    }

    _turn = 0;
  }

  function _renderGrid() {
    var lines = [''];

    // Copy grid for rendering
    var display = _grid.map(function(row) { return row.slice(); });

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

    // Move player
    _player.x = newX;
    _player.y = newY;
    _turn++;

    // Run mode increases detection
    if (runMode) {
      _player.detection += 2;
      _updateAlertLevel();
    } else {
      _player.detection = Math.max(0, _player.detection - 0.5);
      _updateAlertLevel();
    }

    // Check for enemy collision
    var hitEnemy = _enemies.find(function(e) { return e.x === newX && e.y === newY && e.hp > 0; });
    if (hitEnemy) {
      _player.hp -= 2;
      if (_player.hp <= 0) {
        return _exitRogue(false); // Death
      }
      return {
        lines: ['ENEMY ATTACK! -2 HP', ''].concat(_renderGrid()),
        prompt: getPrompt(),
        stayActive: true
      };
    }

    _saveState();
    return {
      lines: _renderGrid(),
      prompt: getPrompt(),
      stayActive: true
    };
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

  function _saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        active: _active,
        player: _player,
        enemies: _enemies,
        items: _items,
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
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items);
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
      GoneRogueMobile.renderGrid(_grid, _player, _enemies, _items);
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

    var damage = card.stats.damage || 3;
    nearest.hp -= damage;

    _turn++;
    _saveState();

    return {
      lines: ['ATTACK! -' + damage + ' HP TO ENEMY', ''].concat(_renderGrid()),
      prompt: getPrompt(),
      stayActive: true
    };
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

  /**
   * Get player state (for mobile UI)
   */
  function getPlayer() {
    return _player;
  }

  return {
    init: init,
    start: start,
    process: process,
    isActive: isActive,
    getPrompt: getPrompt,
    handleTapMove: handleTapMove,
    handleCardSwipe: handleCardSwipe,
    getPlayer: getPlayer
  };
})();
