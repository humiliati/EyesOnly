/* ============================================================
   EYES ONLY - Gone Rogue Mobile Touch Interface
   Tap-to-move grid + swipe cards + Metal Gear stealth
   ============================================================ */

const GoneRogueMobile = (function () {
  'use strict';

  // Constants
  var DOUBLE_TAP_THRESHOLD_MS = 300;

  var _gridContainer = null;
  var _cardContainer = null;
  var _inventoryContainer = null; // New: persistent inventory display
  var _lastTapTime = 0;
  var _lastTapCell = null;
  var _runMode = false;

  // Touch tracking for swipes
  var _touchStart = { x: 0, y: 0, time: 0 };
  var _activeCard = null;
  var _activeDragItem = null; // New: for inventory drag tracking

  /**
   * Initialize mobile UI
   */
  function init() {
    _createMobileUI();
    _setupTouchHandlers();
    _setupKeyboardHandlers(); // Add keyboard support for desktop
  }

  /**
   * Setup keyboard event handlers for desktop WASD navigation
   */
  function _setupKeyboardHandlers() {
    document.addEventListener('keydown', function(e) {
      // Only handle keyboard if Gone Rogue is active
      if (typeof GoneRogue === 'undefined' || !GoneRogue.isActive()) return;

      // Check if we're in STR combat - allow card selection but not movement
      var inStrCombat = GoneRogue.isStrCombatActive && GoneRogue.isStrCombatActive();

      var key = e.key.toLowerCase();
      var handled = false;

      // WASD movement (only if not in STR combat)
      if (!inStrCombat) {
        if (key === 'w' || key === 'arrowup') {
          e.preventDefault();
          GoneRogue.process('n');
          handled = true;
        } else if (key === 's' || key === 'arrowdown') {
          e.preventDefault();
          GoneRogue.process('s');
          handled = true;
        } else if (key === 'a' || key === 'arrowleft') {
          e.preventDefault();
          GoneRogue.process('a');
          handled = true;
        } else if (key === 'd' || key === 'arrowright') {
          e.preventDefault();
          GoneRogue.process('d');
          handled = true;
        }
      }

      // Number keys 1-5 for card selection (works in and out of combat)
      if (key >= '1' && key <= '5') {
        var cardIndex = parseInt(key) - 1;
        // Get loose inventory and use card
        if (typeof GAMESTATE !== 'undefined') {
          var loose = GAMESTATE.getLooseInventory();
          if (cardIndex < loose.length) {
            // Simulate card swipe up (use card)
            GoneRogue.handleCardSwipe(cardIndex, 'up');
            handled = true;
          }
        }
      }

      // If we handled a key, prevent the terminal from also processing it
      if (handled) {
        e.stopPropagation();
      }
    });
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

    // Create inventory container (persistent inventory for equipping)
    _inventoryContainer = document.createElement('div');
    _inventoryContainer.id = 'rogue-inventory-mobile';
    _inventoryContainer.className = 'rogue-inventory-mobile';
    _inventoryContainer.style.display = 'none';

    terminal.appendChild(_gridContainer);
    terminal.appendChild(_cardContainer);
    terminal.appendChild(_inventoryContainer);
  }

  /**
   * Setup touch event handlers
   */
  function _setupTouchHandlers() {
    if (!_gridContainer) return;

    // Grid tap/double-tap
    _gridContainer.addEventListener('touchstart', _handleGridTouchStart, { passive: false });
    _gridContainer.addEventListener('touchend', _handleGridTouchEnd, { passive: false });
    _gridContainer.addEventListener('click', _handleGridClick);

    // Card swipe (touch)
    if (_cardContainer) {
      _cardContainer.addEventListener('touchstart', _handleCardTouchStart, { passive: false });
      _cardContainer.addEventListener('touchmove', _handleCardTouchMove, { passive: false });
      _cardContainer.addEventListener('touchend', _handleCardTouchEnd, { passive: false });

      // Card interaction (mouse - desktop)
      _cardContainer.addEventListener('pointerdown', _handleCardPointerDown);
      _cardContainer.addEventListener('pointermove', _handleCardPointerMove);
      _cardContainer.addEventListener('pointerup', _handleCardPointerUp);
    }
  }

  /**
   * Render grid as interactive HTML cells
   */
  function renderGrid(grid, player, enemies, items, colorCycleTime, breakables, projectiles, alertLevel, strCombatActive) {
    if (!_gridContainer || !grid) return;

    breakables = breakables || [];
    projectiles = projectiles || [];
    alertLevel = alertLevel || 'safe';
    strCombatActive = strCombatActive || false;

    // Update grid border based on alert level
    if (strCombatActive) {
      _gridContainer.style.borderColor = '#ff0000';
      _gridContainer.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.5)';
    } else if (alertLevel === 'danger') {
      _gridContainer.style.borderColor = '#ff0000';
      _gridContainer.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.3)';
    } else if (alertLevel === 'caution') {
      _gridContainer.style.borderColor = '#ffff00';
      _gridContainer.style.boxShadow = '0 0 20px rgba(255, 255, 0, 0.3)';
    } else {
      _gridContainer.style.borderColor = '#1cff9b';
      _gridContainer.style.boxShadow = '0 0 20px rgba(28, 255, 155, 0.3)';
    }

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
        var enemy = enemies ? enemies.find(function(e) { return e.x === x && e.y === y && e.hp > 0; }) : null;
        var projectile = projectiles.find(function(p) { return p.x === x && p.y === y; });
        var breakable = breakables.find(function(b) { return b.x === x && b.y === y; });
        var item = items ? items.find(function(i) { return i.x === x && i.y === y; }) : null;

        if (player && player.x === x && player.y === y) {
          cell.textContent = '🥷';
          cell.classList.add('cell-player');

          // Add directional gun indicator
          if (player.lastMoveDirection) {
            var gunSpan = document.createElement('span');
            gunSpan.className = 'player-gun-indicator';

            // Set gun caret based on direction
            var gunChar = '';
            switch (player.lastMoveDirection) {
              case 'north':
                gunChar = '^';
                break;
              case 'south':
                gunChar = 'v';
                break;
              case 'east':
                gunChar = '>';
                break;
              case 'west':
                gunChar = '<';
                break;
            }

            gunSpan.textContent = gunChar;
            gunSpan.style.position = 'absolute';
            gunSpan.style.fontSize = '0.5em';
            gunSpan.style.color = '#666';
            gunSpan.style.fontWeight = 'bold';

            // Position gun based on direction
            if (player.lastMoveDirection === 'east') {
              gunSpan.style.right = '1px';
              gunSpan.style.top = '50%';
              gunSpan.style.transform = 'translateY(-50%)';
            } else if (player.lastMoveDirection === 'west') {
              gunSpan.style.left = '1px';
              gunSpan.style.top = '50%';
              gunSpan.style.transform = 'translateY(-50%)';
            } else if (player.lastMoveDirection === 'south') {
              gunSpan.style.bottom = '1px';
              gunSpan.style.left = '50%';
              gunSpan.style.transform = 'translateX(-50%)';
            } else if (player.lastMoveDirection === 'north') {
              gunSpan.style.top = '1px';
              gunSpan.style.left = '50%';
              gunSpan.style.transform = 'translateX(-50%)';
            }

            if (gunChar) {
              cell.appendChild(gunSpan);
            }
          }
        } else if (enemy) {
          // Check if this is an Elite enemy
          if (enemy.isElite) {
            cell.textContent = enemy.emoji || '🪖';
            cell.classList.add('cell-enemy', 'cell-elite');

            // Add pulsing glow effect for elites
            var glowIntensity = Math.sin(enemy.glowPhase * Math.PI / 180) * 0.5 + 0.5;
            cell.style.background = 'rgba(255, 0, 255, ' + (0.2 + glowIntensity * 0.3) + ')';
            cell.style.boxShadow = '0 0 10px rgba(255, 0, 255, ' + (0.5 + glowIntensity * 0.5) + ')';

            // Add intent icon overlay
            if (enemy.intentIcon) {
              var intentSpan = document.createElement('span');
              intentSpan.className = 'enemy-intent-icon';
              intentSpan.textContent = enemy.intentIcon;
              intentSpan.title = enemy.intent || 'UNKNOWN';
              cell.appendChild(intentSpan);
            }
          } else {
            // Normal enemy
            cell.textContent = '🪖';
            cell.classList.add('cell-enemy');

            // Apply awareness color with cycling effect
            _applyAwarenessColor(cell, enemy, colorCycleTime);
          }

          // Add detection cone visualization
          _addDetectionCone(cell, enemy);

          // Add sight cone overlay
          _addSightConeOverlay(cell, enemy, grid);
        } else if (projectile) {
          cell.textContent = projectile.emoji || projectile.glyph || '💥';
          cell.classList.add('cell-projectile');
        } else if (breakable) {
          // Show impact animation when destroying (blink twice)
          if (breakable.hp === 0 && breakable.destroying) {
            var elapsed = Date.now() - (breakable.destroyStartTime || 0);
            var blinkPhase = Math.floor(elapsed / 200) % 2; // Blink every 200ms
            if (blinkPhase === 0) {
              cell.textContent = '💥'; // Show impact emoji
              cell.classList.add('cell-projectile-impact');
            } else {
              cell.textContent = breakable.emoji || breakable.glyph || '📦';
              cell.classList.add('cell-breakable-destroying');
            }
          } else if (breakable.hp > 0) {
            cell.textContent = breakable.emoji || breakable.glyph || '📦';
            cell.classList.add('cell-breakable');
          } else {
            cell.textContent = breakable.destroyedGlyph || '░';
            cell.classList.add('cell-breakable-broken');
          }
        } else if (item) {
          cell.textContent = item.emoji || '💎';
          cell.classList.add('cell-item');
        } else {
          _setCellTile(cell, tile);
        }

        // Apply lighting effects if lighting system is available
        if (typeof LightingSystem !== 'undefined') {
          var light = LightingSystem.getLightAt(x, y);
          var intensity = light.intensity;

          // Apply darkness classes based on light intensity
          if (intensity < 0.15) {
            cell.classList.add('lit-very-dark');
            cell.setAttribute('data-light-level', '1');
          } else if (intensity < 0.3) {
            cell.classList.add('lit-dark');
            cell.setAttribute('data-light-level', '2');
          } else if (intensity < 0.5) {
            cell.classList.add('lit-dim');
            cell.setAttribute('data-light-level', '3');
          } else if (intensity < 0.7) {
            cell.classList.add('lit-normal');
            cell.setAttribute('data-light-level', '4');
          } else if (intensity < 0.9) {
            cell.classList.add('lit-bright');
            cell.setAttribute('data-light-level', '5');
          } else {
            cell.classList.add('lit-very-bright');
            cell.setAttribute('data-light-level', '6');
          }
        }

        _gridContainer.appendChild(cell);
      }
    }

    // Render sight cone highlights
    if (enemies) {
      enemies.forEach(function(enemy) {
        if (enemy.hp > 0) {
          _renderSightConeHighlight(grid, enemy);
        }
      });
    }

    // Render STR combat overlay if combat is active
    _renderStrCombatOverlay();
  }

  /**
   * Apply awareness state color to enemy cell
   */
  function _applyAwarenessColor(cell, enemy, colorCycleTime) {
    var state;
    
    // Use GoneRogue's awareness state function if available
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.getEnemyAwarenessState === 'function') {
      state = GoneRogue.getEnemyAwarenessState(enemy);
    } else {
      // Fallback: determine state locally
      var awareness = enemy.awareness || 0;
      if (awareness >= 100) {
        state = { color: '#ff00ff', name: 'ENGAGED' };
      } else if (awareness >= 71) {
        state = { color: '#ff0000', name: 'ALERTED' };
      } else if (awareness >= 31) {
        state = { color: '#ffaa00', name: 'SUSPICIOUS' };
      } else {
        state = { color: '#00ff00', name: 'UNAWARE' };
      }
    }

    // Cycle color opacity every 400ms
    var cycle = Math.floor((colorCycleTime || 0) / 400) % 2;
    var opacity = cycle === 0 ? 1.0 : 0.6;

    cell.style.backgroundColor = state.color;
    cell.style.opacity = opacity;
    cell.title = state.name + ' (' + Math.floor(enemy.awareness || 0) + ')';
  }

  /**
   * Render sight cone highlight overlay
   */
  function _renderSightConeHighlight(grid, enemy) {
    if (!enemy.orientation || !_gridContainer) return;

    var sightRange = enemy.sightRange || 5;
    var coneAngle = Math.PI / 3; // 60 degrees

    // Orientation angles
    var orientationAngles = {
      'east': 0,
      'south': Math.PI / 2,
      'west': Math.PI,
      'north': -Math.PI / 2
    };

    var orientationAngle = orientationAngles[enemy.orientation] || 0;

    // Highlight cells in sight cone
    for (var dy = -sightRange; dy <= sightRange; dy++) {
      for (var dx = -sightRange; dx <= sightRange; dx++) {
        if (dx === 0 && dy === 0) continue;

        var targetX = enemy.x + dx;
        var targetY = enemy.y + dy;

        if (targetX < 0 || targetX >= grid[0].length || targetY < 0 || targetY >= grid.length) continue;

        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > sightRange) continue;

        var angleToTarget = Math.atan2(dy, dx);
        var angleDiff = Math.abs(angleToTarget - orientationAngle);
        while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - 2 * Math.PI);

        if (angleDiff <= coneAngle / 2) {
          var cellIndex = targetY * grid[0].length + targetX;
          var cell = _gridContainer.children[cellIndex];
          if (cell && !cell.classList.contains('cell-player') && !cell.classList.contains('cell-enemy')) {
            cell.classList.add('in-sight-cone');
          }
        }
      }
    }
  }

  /**
   * Add sight cone indicator to enemy cell
   */
  function _addSightConeOverlay(cell, enemy, grid) {
    // Add direction arrow based on orientation
    var arrows = {
      'north': '↑',
      'south': '↓',
      'east': '→',
      'west': '←'
    };

    var arrow = arrows[enemy.orientation] || '';
    if (arrow) {
      var arrowSpan = document.createElement('span');
      arrowSpan.className = 'enemy-direction-arrow';
      arrowSpan.textContent = arrow;
      cell.appendChild(arrowSpan);
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
    } else if (tile === '☐') {
      cell.classList.add('cell-breakable');
    } else if (tile === '░') {
      cell.classList.add('cell-breakable-broken');
    } else if (tile === '🚪' || tile === '▼') {
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
   * Show click/tap feedback animation at coordinates
   * @param {number} clientX - X coordinate in viewport
   * @param {number} clientY - Y coordinate in viewport
   */
  function _showClickFeedback(clientX, clientY) {
    var dot = document.createElement('div');
    dot.className = 'click-feedback-dot';
    dot.style.left = clientX + 'px';
    dot.style.top = clientY + 'px';
    document.body.appendChild(dot);

    // Remove after animation completes
    setTimeout(function() {
      if (dot.parentNode) {
        dot.parentNode.removeChild(dot);
      }
    }, 400);
  }

  /**
   * Process grid input (shared by touch and click handlers)
   * @param {number} x - Grid X coordinate
   * @param {number} y - Grid Y coordinate
   * @param {boolean} runMode - Whether to run to target
   */
  function _processGridInput(x, y, runMode) {
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
      GoneRogue.handleTapMove(x, y, runMode);
    }
  }

  /**
   * Handle grid touch start (for double-tap detection)
   */
  function _handleGridTouchStart(e) {
    e.preventDefault();
    e.stopPropagation(); // Prevent document-level listeners

    var touch = e.touches[0];
    var target = document.elementFromPoint(touch.clientX, touch.clientY);

    if (!target || !target.classList.contains('rogue-cell')) return;

    var now = Date.now();
    var cellKey = target.dataset.x + ',' + target.dataset.y;

    // Check for double-tap (within threshold)
    if (_lastTapCell === cellKey && (now - _lastTapTime) < DOUBLE_TAP_THRESHOLD_MS) {
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
   * Handle grid touch end (execute movement)
   */
  function _handleGridTouchEnd(e) {
    e.preventDefault();
    e.stopPropagation();

    var touch = e.changedTouches[0];
    var target = document.elementFromPoint(touch.clientX, touch.clientY);

    if (!target || !target.classList.contains('rogue-cell')) return;

    // Show click feedback at touch point
    _showClickFeedback(touch.clientX, touch.clientY);

    var x = parseInt(target.dataset.x);
    var y = parseInt(target.dataset.y);

    _processGridInput(x, y, _runMode);
  }

  /**
   * Handle grid click/tap
   */
  function _handleGridClick(e) {
    var target = e.target;
    if (!target || !target.classList.contains('rogue-cell')) return;

    e.preventDefault(); // Prevent default click behavior
    e.stopPropagation(); // Prevent bubbling to document-level handlers

    // Show click feedback at mouse/pointer position
    _showClickFeedback(e.clientX, e.clientY);

    var x = parseInt(target.dataset.x);
    var y = parseInt(target.dataset.y);

    var now = Date.now();
    var cellKey = x + ',' + y;

    // Check for double-click on desktop (within threshold)
    if (_lastTapCell === cellKey && (now - _lastTapTime) < DOUBLE_TAP_THRESHOLD_MS) {
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

    _processGridInput(x, y, _runMode);
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
    e.stopPropagation(); // Prevent event from bubbling to grid and document

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
    e.stopPropagation(); // Prevent event from bubbling to grid and document

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
    e.stopPropagation(); // Prevent event from bubbling to grid and document

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

  /**
   * Get face expression based on state
   */
  function _getFaceExpression(isPlayer, state) {
    if (!state) state = 'neutral';

    var expressions = {
      player: {
        neutral: '(   )',
        charging: '(>_<)',
        hurt: '(T_T)',
        defending: '(=_=)',
        victory: '(^__^)',
        defeated: '(x__x)'
      },
      enemy: {
        neutral: '(^__^)',
        charging: '(ಠ_ಠ)',
        hurt: '(x__x)',
        defending: '(=_=)',
        attacking: '(>__<)',
        defeated: '(x__x)'
      }
    };

    return isPlayer ? expressions.player[state] : expressions.enemy[state];
  }

  /**
   * Render STR combat overlay (called from renderGrid when combat is active)
   */
  function _renderStrCombatOverlay() {
    if (typeof GoneRogue === 'undefined' || !GoneRogue.isStrCombatActive || !GoneRogue.isStrCombatActive()) {
      _hideCombatBubble();
      return;
    }

    var strState = GoneRogue.getStrCombatState();
    if (!strState || !strState.active) {
      _hideCombatBubble();
      return;
    }

    // Show combat bubble instead of just overlay
    _renderCombatBubble(strState);
  }

  /**
   * Render combat bubble with face animations
   */
  function _renderCombatBubble(strState) {
    var bubbleId = 'combat-bubble';
    var bubble = document.getElementById(bubbleId);

    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = bubbleId;
      bubble.className = 'combat-bubble';
      document.body.appendChild(bubble);
    }

    // Determine player and enemy states
    var playerState = 'neutral';
    var enemyState = 'neutral';

    // Get advantage emoji
    var advantageEmoji = {
      'ambush': '🎯',
      'neutral': '⚔️',
      'disadvantaged': '⚠️',
      'flanked': '❌'
    };

    // Build combat arena visual
    var html = '';

    // Header
    html += '<div class="combat-bubble-header">';
    html += '<span style="color: #ffaa00; font-weight: bold; font-size: 18px;">⚔️ STR COMBAT - ROUND ' + strState.round + '</span>';
    html += '</div>';

    // Combat arena with combatants
    html += '<div class="combat-arena">';

    // Enemy (top)
    html += '<div class="combatant">';
    html += '<div class="combatant-glyph glyph-' + enemyState + '" style="color: #ff1c4a;">';
    html += '🔫' + _getFaceExpression(false, enemyState) + 'p';
    html += '</div>';
    html += '<div class="hp-bar-container">';
    html += '<div class="hp-bar low" style="width: ' + ((strState.enemy ? (strState.enemy.hp || 0) / 5 : 0) * 100) + '%"></div>';
    html += '<div class="hp-text">' + (strState.enemy ? (strState.enemy.hp || 0) : 0) + ' / 5 HP</div>';
    html += '</div>';
    html += '</div>';

    // Spacing
    html += '<div style="text-align: center; font-size: 32px; margin: 20px 0;">';
    html += advantageEmoji[strState.advantage] || '⚔️';
    html += '</div>';

    // Player (bottom)
    var player = typeof GoneRogue !== 'undefined' && GoneRogue.getPlayer ? GoneRogue.getPlayer() : { hp: 10, maxHp: 10 };
    html += '<div class="combatant">';
    html += '<div class="hp-bar-container">';
    html += '<div class="hp-bar high" style="width: ' + ((player.hp / player.maxHp) * 100) + '%"></div>';
    html += '<div class="hp-text">' + player.hp + ' / ' + player.maxHp + ' HP</div>';
    html += '</div>';
    html += '<div class="combatant-glyph glyph-' + playerState + '" style="color: #1cff9b;">';
    html += 'd' + _getFaceExpression(true, playerState) + '🔫';
    html += '</div>';
    html += '</div>';

    html += '</div>'; // end combat-arena

    // Combat log
    if (strState.log && strState.log.length > 0) {
      html += '<div class="combat-log">';
      var recentLog = strState.log.slice(-5); // Last 5 messages
      recentLog.forEach(function(msg) {
        html += '<div class="combat-log-line">' + msg + '</div>';
      });
      html += '</div>';
    }

    bubble.innerHTML = html;
    bubble.style.display = 'block';
  }

  /**
   * Show floating damage number
   */
  function showFloatingDamage(damage, isPlayer) {
    var bubble = document.getElementById('combat-bubble');
    if (!bubble) return;

    var floater = document.createElement('div');
    floater.className = 'floating-damage';
    floater.textContent = '-' + damage + ' HP';
    floater.style.color = isPlayer ? '#ff1c4a' : '#ffaa00';
    floater.style.position = 'absolute';
    floater.style.fontSize = '24px';
    floater.style.fontWeight = 'bold';
    floater.style.pointerEvents = 'none';
    floater.style.animation = 'float-up 1s ease-out forwards';

    // Position based on target
    if (isPlayer) {
      floater.style.bottom = '80px';
      floater.style.left = '50%';
      floater.style.transform = 'translateX(-50%)';
    } else {
      floater.style.top = '80px';
      floater.style.left = '50%';
      floater.style.transform = 'translateX(-50%)';
    }

    bubble.appendChild(floater);

    // Remove after animation
    setTimeout(function() {
      if (floater.parentNode) {
        floater.parentNode.removeChild(floater);
      }
    }, 1000);
  }

  /**
   * Hide combat bubble
   */
  function _hideCombatBubble() {
    var bubble = document.getElementById('combat-bubble');
    if (bubble) {
      bubble.style.display = 'none';
    }
  }

  // ============================================================
  // POINTER/MOUSE EVENT HANDLERS (Desktop card interaction)
  // ============================================================

  var _pointerStart = { x: 0, y: 0, time: 0 };
  var _pointerCardIndex = -1;
  var _isPointerDrag = false;

  /**
   * Handle pointer down on card (mouse/stylus)
   */
  function _handleCardPointerDown(e) {
    // Only handle mouse/pen, not touch (touch uses separate handlers)
    if (e.pointerType === 'touch') return;

    var target = e.target.closest('.rogue-card');
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();

    _pointerStart = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    };
    _pointerCardIndex = parseInt(target.dataset.cardIndex);
    _activeCard = target;
    _isPointerDrag = false;

    target.classList.add('card-dragging');
    target.setPointerCapture(e.pointerId);
  }

  /**
   * Handle pointer move (detect drag)
   */
  function _handleCardPointerMove(e) {
    if (!_activeCard || e.pointerType === 'touch') return;

    var deltaX = e.clientX - _pointerStart.x;
    var deltaY = e.clientY - _pointerStart.y;
    var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 10) {
      _isPointerDrag = true;
      _activeCard.style.transform = 'translate(' + deltaX + 'px, ' + deltaY + 'px)';
    }
  }

  /**
   * Handle pointer up (click or drag-and-drop)
   */
  function _handleCardPointerUp(e) {
    if (!_activeCard || e.pointerType === 'touch') return;

    e.preventDefault();
    e.stopPropagation();

    _activeCard.classList.remove('card-dragging');
    _activeCard.style.transform = '';

    if (!_isPointerDrag) {
      // Simple click - show card info or quick-use
      _handleCardClick(_pointerCardIndex);
    } else {
      // Drag - interpret direction as swipe
      var deltaX = e.clientX - _pointerStart.x;
      var deltaY = e.clientY - _pointerStart.y;

      var direction = null;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      if (direction && typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleCardSwipe === 'function') {
        GoneRogue.handleCardSwipe(_pointerCardIndex, direction);
      }
    }

    _activeCard = null;
    _pointerCardIndex = -1;
    _isPointerDrag = false;
    _cardContainer.style.display = 'none';
  }

  /**
   * Handle card click (select/use card)
   */
  function _handleCardClick(cardIndex) {
    // Get the card
    var cards = [];
    if (typeof GAMESTATE !== 'undefined') {
      var loose = GAMESTATE.getLooseInventory();
      cards = loose.slice(0, 5);
    }

    if (cardIndex >= 0 && cardIndex < cards.length) {
      var card = cards[cardIndex];

      // Quick-use card (simulate swipe up)
      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleCardSwipe === 'function') {
        GoneRogue.handleCardSwipe(cardIndex, 'up');
      }
    }

    _cardContainer.style.display = 'none';
  }

  function showInventory() {
    if (!_inventoryContainer) {
      return;
    }

    // Get persistent inventory from GAMESTATE
    var persistentInv = [];
    var activeItem = null;

    if (typeof GAMESTATE !== 'undefined') {
      persistentInv = GAMESTATE.getPersistentInventory() || [];
      activeItem = GAMESTATE.getActiveItem();
    }

    // Clear existing inventory display
    _inventoryContainer.innerHTML = '';

    if (persistentInv.length === 0) {
      _inventoryContainer.style.display = 'none';
      return;
    }

    // Create inventory grid
    persistentInv.forEach(function(item, index) {
      if (!item) return;

      var itemDiv = document.createElement('div');
      itemDiv.className = 'rogue-inventory-item';
      itemDiv.dataset.index = index;

      // Check if this item is currently equipped
      var isEquipped = activeItem && activeItem.name === item.name;
      if (isEquipped) {
        itemDiv.classList.add('equipped');
      }

      // Item emoji and name
      var emojiSpan = document.createElement('span');
      emojiSpan.className = 'item-emoji';
      emojiSpan.textContent = item.emoji || '📦';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'item-name';
      nameSpan.textContent = item.name || 'Unknown';

      itemDiv.appendChild(emojiSpan);
      itemDiv.appendChild(nameSpan);

      // Add touch handlers for mobile
      itemDiv.addEventListener('touchstart', _handleInventoryTouchStart, { passive: false });
      itemDiv.addEventListener('touchmove', _handleInventoryTouchMove, { passive: false });
      itemDiv.addEventListener('touchend', _handleInventoryTouchEnd, { passive: false });

      // Add pointer handlers for desktop
      itemDiv.addEventListener('pointerdown', _handleInventoryPointerDown);
      itemDiv.addEventListener('click', _handleInventoryClick);

      _inventoryContainer.appendChild(itemDiv);
    });

    _inventoryContainer.style.display = 'grid';
  }

  function _handleInventoryTouchStart(e) {
    e.preventDefault();

    var itemDiv = e.currentTarget;
    var index = parseInt(itemDiv.dataset.index, 10);

    if (typeof GAMESTATE === 'undefined') return;

    var persistentInv = GAMESTATE.getPersistentInventory();
    var item = persistentInv[index];

    if (!item) return;

    _activeDragItem = {
      element: itemDiv,
      item: item,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      originalTransform: itemDiv.style.transform
    };

    itemDiv.classList.add('dragging');
  }

  function _handleInventoryTouchMove(e) {
    if (!_activeDragItem) return;

    e.preventDefault();

    var touch = e.touches[0];
    var deltaX = touch.clientX - _activeDragItem.startX;
    var deltaY = touch.clientY - _activeDragItem.startY;

    // Apply visual feedback
    _activeDragItem.element.style.transform = 'translate(' + deltaX + 'px, ' + deltaY + 'px) scale(1.1)';
  }

  function _handleInventoryTouchEnd(e) {
    if (!_activeDragItem) return;

    e.preventDefault();

    var touch = e.changedTouches[0];
    var element = document.elementFromPoint(touch.clientX, touch.clientY);

    // Check if dropped on active item slot
    var activeSlot = document.getElementById('active-item-slot');
    var activeDisplay = document.getElementById('active-item-display');

    var droppedOnActiveSlot = false;
    if (element) {
      if (element === activeSlot || element === activeDisplay ||
          activeSlot.contains(element) || activeDisplay.contains(element)) {
        droppedOnActiveSlot = true;
      }
    }

    if (droppedOnActiveSlot) {
      // Equip the item
      _equipItemToActiveSlot(_activeDragItem.item);
    }

    // Reset visual state
    _activeDragItem.element.style.transform = _activeDragItem.originalTransform || '';
    _activeDragItem.element.classList.remove('dragging');
    _activeDragItem = null;

    // Refresh inventory display
    showInventory();
  }

  function _handleInventoryPointerDown(e) {
    // Only handle mouse/pen, not touch (touch uses separate handlers)
    if (e.pointerType === 'touch') return;

    var itemDiv = e.currentTarget;
    var index = parseInt(itemDiv.dataset.index, 10);

    if (typeof GAMESTATE === 'undefined') return;

    var persistentInv = GAMESTATE.getPersistentInventory();
    var item = persistentInv[index];

    if (!item) return;

    _activeDragItem = {
      element: itemDiv,
      item: item,
      startX: e.clientX,
      startY: e.clientY,
      originalTransform: itemDiv.style.transform
    };

    itemDiv.classList.add('dragging');

    // Add move and up handlers to document
    var handleMove = function(moveE) {
      if (!_activeDragItem) return;

      var deltaX = moveE.clientX - _activeDragItem.startX;
      var deltaY = moveE.clientY - _activeDragItem.startY;

      _activeDragItem.element.style.transform = 'translate(' + deltaX + 'px, ' + deltaY + 'px) scale(1.1)';
    };

    var handleUp = function(upE) {
      if (!_activeDragItem) return;

      var element = document.elementFromPoint(upE.clientX, upE.clientY);

      // Check if dropped on active item slot
      var activeSlot = document.getElementById('active-item-slot');
      var activeDisplay = document.getElementById('active-item-display');

      var droppedOnActiveSlot = false;
      if (element) {
        if (element === activeSlot || element === activeDisplay ||
            activeSlot.contains(element) || activeDisplay.contains(element)) {
          droppedOnActiveSlot = true;
        }
      }

      if (droppedOnActiveSlot) {
        // Equip the item
        _equipItemToActiveSlot(_activeDragItem.item);
      }

      // Reset visual state
      _activeDragItem.element.style.transform = _activeDragItem.originalTransform || '';
      _activeDragItem.element.classList.remove('dragging');
      _activeDragItem = null;

      // Refresh inventory display
      showInventory();

      // Remove event listeners
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }

  function _handleInventoryClick(e) {
    // Quick tap/click to equip (for users who don't want to drag)
    var itemDiv = e.currentTarget;
    var index = parseInt(itemDiv.dataset.index, 10);

    if (typeof GAMESTATE === 'undefined') return;

    var persistentInv = GAMESTATE.getPersistentInventory();
    var item = persistentInv[index];

    if (!item) return;

    // Check if already equipped
    var activeItem = GAMESTATE.getActiveItem();
    if (activeItem && activeItem.name === item.name) {
      // Unequip
      _unequipActiveItem();
    } else {
      // Equip
      _equipItemToActiveSlot(item);
    }

    // Refresh inventory display
    showInventory();
  }

  function _equipItemToActiveSlot(item) {
    if (typeof GAMESTATE === 'undefined') return;

    GAMESTATE.setActiveItem(item);

    // Update active item display in header
    var activeDisplay = document.getElementById('active-item-display');
    if (activeDisplay) {
      activeDisplay.innerHTML = '<span class="item-emoji">' + (item.emoji || '📦') + '</span>';
      activeDisplay.classList.add('has-item');
    }

    // Update player lighting if this is a lighting item
    if (typeof _updatePlayerLight === 'function') {
      _updatePlayerLight();
    } else if (typeof window.GoneRogue !== 'undefined' && typeof window.GoneRogue.updatePlayerLight === 'function') {
      window.GoneRogue.updatePlayerLight();
    }

    // Show feedback message
    if (typeof window.appendLine === 'function') {
      window.appendLine('⚡ EQUIPPED: ' + item.emoji + ' ' + item.name);
    }

    // Tooltip: Item equipped
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('item-equip', { name: item.name });
    }
  }

  function _unequipActiveItem() {
    if (typeof GAMESTATE === 'undefined') return;

    var activeItem = GAMESTATE.getActiveItem();
    if (!activeItem) return;

    GAMESTATE.clearActiveItem();

    // Update active item display in header
    var activeDisplay = document.getElementById('active-item-display');
    if (activeDisplay) {
      activeDisplay.innerHTML = '<span class="empty-slot-indicator">·</span>';
      activeDisplay.classList.remove('has-item');
    }

    // Update player lighting
    if (typeof _updatePlayerLight === 'function') {
      _updatePlayerLight();
    } else if (typeof window.GoneRogue !== 'undefined' && typeof window.GoneRogue.updatePlayerLight === 'function') {
      window.GoneRogue.updatePlayerLight();
    }

    // Show feedback message
    if (typeof window.appendLine === 'function') {
      window.appendLine('⚠ UNEQUIPPED: ' + activeItem.emoji + ' ' + activeItem.name);
    }

    // Tooltip: Item unequipped
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showAction('item-unequip', { name: activeItem.name });
    }
  }

  return {
    init: init,
    renderGrid: renderGrid,
    hide: hide,
    show: show,
    showFloatingDamage: showFloatingDamage,
    showInventory: showInventory
  };
})();
