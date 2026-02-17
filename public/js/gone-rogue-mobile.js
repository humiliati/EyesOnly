/* ============================================================
   EYES ONLY - Gone Rogue Mobile Touch Interface
   Tap-to-move grid + swipe cards + Metal Gear stealth
   ============================================================ */

const GoneRogueMobile = (function () {
  'use strict';

  var _gridContainer = null;
  var _cardContainer = null;
  var _lastTapTime = 0;
  var _lastTapCell = null;
  var _runMode = false;

  // Touch tracking for swipes
  var _touchStart = { x: 0, y: 0, time: 0 };
  var _activeCard = null;

  /**
   * Initialize mobile UI
   */
  function init() {
    _createMobileUI();
    _setupTouchHandlers();
  }

  /**
   * Create mobile-specific UI elements
   */
  function _createMobileUI() {
    var terminal = document.getElementById('terminal');
    if (!terminal) return;

    // Create grid container (will replace text grid)
    _gridContainer = document.createElement('div');
    _gridContainer.id = 'rogue-grid-mobile';
    _gridContainer.className = 'rogue-grid-mobile';
    _gridContainer.style.display = 'none'; // Hidden until rogue mode active

    // Create card deck container
    _cardContainer = document.createElement('div');
    _cardContainer.id = 'rogue-cards-mobile';
    _cardContainer.className = 'rogue-cards-mobile';
    _cardContainer.style.display = 'none';

    terminal.appendChild(_gridContainer);
    terminal.appendChild(_cardContainer);
  }

  /**
   * Setup touch event handlers
   */
  function _setupTouchHandlers() {
    if (!_gridContainer) return;

    // Grid tap/double-tap
    _gridContainer.addEventListener('touchstart', _handleGridTouchStart, { passive: false });
    _gridContainer.addEventListener('click', _handleGridClick);

    // Card swipe
    if (_cardContainer) {
      _cardContainer.addEventListener('touchstart', _handleCardTouchStart, { passive: false });
      _cardContainer.addEventListener('touchmove', _handleCardTouchMove, { passive: false });
      _cardContainer.addEventListener('touchend', _handleCardTouchEnd, { passive: false });
    }
  }

  /**
   * Render grid as interactive HTML cells
   */
  function renderGrid(grid, player, enemies, items) {
    if (!_gridContainer || !grid) return;

    _gridContainer.innerHTML = '';
    _gridContainer.style.display = 'grid';
    _gridContainer.style.gridTemplateColumns = 'repeat(' + grid[0].length + ', 1fr)';
    _gridContainer.style.gridTemplateRows = 'repeat(' + grid.length + ', 1fr)';

    // Create cells
    for (var y = 0; y < grid.length; y++) {
      for (var x = 0; x < grid[y].length; x++) {
        var cell = document.createElement('div');
        cell.className = 'rogue-cell';
        cell.dataset.x = x;
        cell.dataset.y = y;

        var tile = grid[y][x];

        // Check if player is here
        if (player && player.x === x && player.y === y) {
          cell.textContent = '@';
          cell.classList.add('cell-player');
        }
        // Check if enemy is here
        else if (enemies) {
          var enemy = enemies.find(function(e) { return e.x === x && e.y === y && e.hp > 0; });
          if (enemy) {
            cell.textContent = 'E';
            cell.classList.add('cell-enemy');
            // Add detection cone visualization
            _addDetectionCone(cell, enemy);
          } else {
            _setCellTile(cell, tile);
          }
        }
        // Check if item is here
        else if (items) {
          var item = items.find(function(i) { return i.x === x && i.y === y; });
          if (item) {
            cell.textContent = '*';
            cell.classList.add('cell-item');
          } else {
            _setCellTile(cell, tile);
          }
        } else {
          _setCellTile(cell, tile);
        }

        _gridContainer.appendChild(cell);
      }
    }
  }

  /**
   * Set cell appearance based on tile type
   */
  function _setCellTile(cell, tile) {
    cell.textContent = tile;

    if (tile === '█') {
      cell.classList.add('cell-wall');
    } else if (tile === '▓') {
      cell.classList.add('cell-cover');
    } else if (tile === '▼') {
      cell.classList.add('cell-exit');
    } else {
      cell.classList.add('cell-empty');
    }
  }

  /**
   * Add visual detection cone for enemy
   */
  function _addDetectionCone(cell, enemy) {
    // Simple cone indicator
    cell.classList.add('has-detection-cone');
    cell.title = 'Enemy alert range';
  }

  /**
   * Handle grid touch start (for double-tap detection)
   */
  function _handleGridTouchStart(e) {
    e.preventDefault();

    var touch = e.touches[0];
    var target = document.elementFromPoint(touch.clientX, touch.clientY);

    if (!target || !target.classList.contains('rogue-cell')) return;

    var now = Date.now();
    var cellKey = target.dataset.x + ',' + target.dataset.y;

    // Check for double-tap (within 300ms)
    if (_lastTapCell === cellKey && (now - _lastTapTime) < 300) {
      _runMode = true;
      target.classList.add('run-mode-flash');
      setTimeout(function() {
        target.classList.remove('run-mode-flash');
      }, 200);
    } else {
      _runMode = false;
    }

    _lastTapTime = now;
    _lastTapCell = cellKey;
  }

  /**
   * Handle grid click/tap
   */
  function _handleGridClick(e) {
    var target = e.target;
    if (!target || !target.classList.contains('rogue-cell')) return;

    e.stopPropagation(); // Prevent bubbling to parent handlers

    var x = parseInt(target.dataset.x);
    var y = parseInt(target.dataset.y);

    // Check if tapping self (show card fan)
    if (typeof GoneRogue !== 'undefined') {
      var player = GoneRogue.getPlayer ? GoneRogue.getPlayer() : null;
      if (player && player.x === x && player.y === y) {
        _showCardFan();
        return;
      }
    }

    // Send tap-to-move command
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleTapMove === 'function') {
      GoneRogue.handleTapMove(x, y, _runMode);
    }
  }

  /**
   * Show card fan when tapping self
   */
  function _showCardFan() {
    if (!_cardContainer) return;

    _cardContainer.style.display = 'flex';
    _cardContainer.innerHTML = '';

    // Get cards from GAMESTATE
    var cards = [];
    if (typeof GAMESTATE !== 'undefined') {
      var loose = GAMESTATE.getLooseInventory();
      cards = loose.slice(0, 5); // Show up to 5 cards
    }

    if (cards.length === 0) {
      _cardContainer.innerHTML = '<div class="no-cards">NO CARDS AVAILABLE</div>';
      setTimeout(function() {
        _cardContainer.style.display = 'none';
      }, 2000);
      return;
    }

    // Create card elements
    cards.forEach(function(card, index) {
      var cardEl = document.createElement('div');
      cardEl.className = 'rogue-card';
      cardEl.dataset.cardIndex = index;
      cardEl.innerHTML =
        '<div class="card-emoji">' + card.emoji + '</div>' +
        '<div class="card-name">' + card.name + '</div>' +
        '<div class="card-quality">' + card.qualityName + '</div>';

      _cardContainer.appendChild(cardEl);
    });
  }

  /**
   * Handle card touch start (for swipe)
   */
  function _handleCardTouchStart(e) {
    var target = e.target.closest('.rogue-card');
    if (!target) return;

    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to grid

    var touch = e.touches[0];
    _touchStart = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    _activeCard = target;
    target.classList.add('card-dragging');
  }

  /**
   * Handle card touch move
   */
  function _handleCardTouchMove(e) {
    if (!_activeCard) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to grid

    var touch = e.touches[0];
    var deltaX = touch.clientX - _touchStart.x;
    var deltaY = touch.clientY - _touchStart.y;

    // Apply transform
    _activeCard.style.transform = 'translate(' + deltaX + 'px, ' + deltaY + 'px)';
  }

  /**
   * Handle card touch end (execute swipe action)
   */
  function _handleCardTouchEnd(e) {
    if (!_activeCard) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to grid

    var touch = e.changedTouches[0];
    var deltaX = touch.clientX - _touchStart.x;
    var deltaY = touch.clientY - _touchStart.y;
    var deltaTime = Date.now() - _touchStart.time;

    _activeCard.classList.remove('card-dragging');
    _activeCard.style.transform = '';

    // Detect swipe direction
    var swipeThreshold = 50;
    var swipeSpeed = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;

    var direction = null;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > swipeThreshold) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else if (Math.abs(deltaY) > swipeThreshold) {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    if (direction && typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleCardSwipe === 'function') {
      var cardIndex = parseInt(_activeCard.dataset.cardIndex);
      GoneRogue.handleCardSwipe(cardIndex, direction);
    }

    _activeCard = null;
    _cardContainer.style.display = 'none';
  }

  /**
   * Hide mobile UI
   */
  function hide() {
    if (_gridContainer) _gridContainer.style.display = 'none';
    if (_cardContainer) _cardContainer.style.display = 'none';
  }

  /**
   * Show mobile UI
   */
  function show() {
    if (_gridContainer) _gridContainer.style.display = 'grid';
  }

  return {
    init: init,
    renderGrid: renderGrid,
    hide: hide,
    show: show
  };
})();
