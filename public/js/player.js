var Player = (function() {
  'use strict';

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
    lastCardType: null, // Track last card used (for boss mythic conditions)
    collectingCurrency: false, // Track currency collection for animation
    currencyCollectTime: 0, // Timestamp of last currency collection
    positionHistory: [] // Position history buffer for pet following (max 16 entries)
  };

  function getPlayer() {
    return _player;
  }

  function _movePlayer(dx, dy) {
    if (_playerMoveLocked) {
      return {
        lines: ['Movement is currently locked.'],
        prompt: getPrompt(),
        stayActive: true
      };
    }

    var newX = _player.x + dx;
    var newY = _player.y + dy;

    // Store last move direction for flanking logic
    if (dx === 1) _player.lastMoveDirection = 'east';
    if (dx === -1) _player.lastMoveDirection = 'west';
    if (dy === 1) _player.lastMoveDirection = 'south';
    if (dy === -1) _player.lastMoveDirection = 'north';

    if (isWalkable(newX, newY)) {
      _player.x = newX;
      _player.y = newY;

      // Update player light position
      _updatePlayerLight();

      // Invalidate stealth bonus cache
      _stealthBonusCache = null;

      // Update position history for pet following
      _updatePositionHistory();

      // Advance game turn
      _advanceTurn();

      // Handle mobile grid updates
      if (_useInteractiveGrid) {
        _updateMobileGrid();
        return { lines: [], prompt: getPrompt(), stayActive: true };
      }

      return { lines: _renderGrid(), prompt: getPrompt(), stayActive: true };
    } else {
      // Check for door interaction
      if (_grid[newY][newX] === TILES.EXIT) {
        return _attemptExtract();
      }
      return { lines: ['You can\'t move there.', ''], prompt: getPrompt(), stayActive: true };
    }
  }

  function _updatePlayerLight() {
    if (typeof LightingSystem !== 'undefined') {
      LightingSystem.updatePlayerLight(_player.x, _player.y, _player.stealth);
    }
  }

  return {
    getPlayer: getPlayer,
    movePlayer: _movePlayer,
    updatePlayerLight: _updatePlayerLight
  };
})();