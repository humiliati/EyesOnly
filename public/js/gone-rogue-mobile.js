/* ============================================================
   EYES ONLY - Gone Rogue Mobile Touch Interface
   Tap-to-move grid + swipe cards + Metal Gear stealth
   ============================================================ */

const GoneRogueMobile = (function () {
  'use strict';

  // Feature flags
  var USE_CANVAS_RENDERER = true; // Enable high-performance canvas rendering

  // Constants
  var DOUBLE_TAP_THRESHOLD_MS = 300;
  var CLICK_FEEDBACK_DURATION_MS = 400;
  var TAP_TO_MOVE_MAX_RADIUS = 12; // Maximum distance (in tiles) from player for tap-to-move (extended by ~15% from original ~10.4)

  var _gridContainer = null;
  var _canvasRenderer = null; // Canvas renderer instance
  var _cardContainer = null;
  var _inventoryContainer = null; // New: persistent inventory display
  var _lastTapTime = 0;
  var _lastTapCell = null;
  var _runMode = false; // Actually "sprint mode" (double-tap), NOT a separate "run" speed

  // Pinch-to-zoom state
  var _initialPinchDistance = 0;
  var _currentZoom = 1.0;
  var _minZoom = 0.5;
  var _maxZoom = 2.0;

  // Pan state
  var _panOffset = { x: 0, y: 0 };
  var _initialPinchCenter = { x: 0, y: 0 };
  var _isPanning = false;

  // Touch tracking for swipes
  var _touchStart = { x: 0, y: 0, time: 0 };
  var _activeCard = null;
  var _activeDragItem = null; // New: for inventory drag tracking

  // Touch cooldowns and thresholds
  var _lastMovementTime = 0;
  var _cardFanCooldown = 800; // ms cooldown after movement before allowing card fan
  var _touchMoveThreshold = 10; // px - if touch moves more than this, it's a swipe not a tap

  // Card pagination
  var _cardPageIndex = 0;
  var _cardsPerPage = 4; // 4 cards + 1 navigation slot when paginating
  var _maxCardsWithoutPagination = 5;

  // Multi-card selection for combat
  var _selectedCards = []; // Array of card indices
  var _maxSelectedCards = 5; // Maximum cards that can be selected per round

  // Fishing input model state
  var _fishingActive = false;
  var _fishingStart = { x: 0, y: 0 };
  var _fishingCurrent = { x: 0, y: 0 };
  var _fishingPath = [];
  var _fishingPathOverlay = null;
  var FISHING_THRESHOLD = 20; // pixels to activate fishing mode
  var FISHING_UPDATE_INTERVAL = 50; // ms between path recalculations

  // Desktop pointer-based fishing
  var _desktopPointerDown = false;
  var _desktopPointerStart = { x: 0, y: 0 };
  var _desktopFishingActive = false;
  var _suppressNextClick = false;

  // Active-slot drag targeting
  var _activeSlotDrag = null; // { startX, startY, dragging, ghostEl }

  /**
   * Initialize mobile UI
   */
  function init() {
    _createMobileUI();
    _setupTouchHandlers();
    _setupKeyboardHandlers(); // Add keyboard support for desktop
    _setupHandFanButton(); // Setup the MOK footer card button
    _setupActiveSlotTargeting();
  }

  /**
   * Setup hand fan toggle button in MOK footer
   */
  function _setupActiveSlotTargeting() {
    var slot = document.getElementById('active-item-slot');
    if (!slot) return;

    // Touch drag targeting (mobile)
    slot.addEventListener('touchstart', function(e) {
      if (!e || !e.touches || !e.touches.length) return;
      if (typeof GAMESTATE === 'undefined' || !GAMESTATE.getActiveItem || !GAMESTATE.getActiveItem()) return;

      var t = e.touches[0];
      _activeSlotDrag = { startX: t.clientX, startY: t.clientY, dragging: false, ghostEl: null };
    }, { passive: true });

    slot.addEventListener('touchmove', function(e) {
      if (!_activeSlotDrag || !_activeSlotDrag) return;
      if (!e || !e.touches || !e.touches.length) return;

      var t = e.touches[0];
      var dx = t.clientX - _activeSlotDrag.startX;
      var dy = t.clientY - _activeSlotDrag.startY;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (!_activeSlotDrag.dragging && dist > 12) {
        _activeSlotDrag.dragging = true;
        var activeItem = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;
        if (activeItem) {
          var ghost = document.createElement('div');
          ghost.className = 'active-slot-drag-ghost';
          ghost.textContent = activeItem.emoji || '📦';
          ghost.style.position = 'fixed';
          ghost.style.left = (t.clientX - 10) + 'px';
          ghost.style.top = (t.clientY - 10) + 'px';
          ghost.style.zIndex = '99999';
          ghost.style.pointerEvents = 'none';
          ghost.style.fontSize = '20px';
          document.body.appendChild(ghost);
          _activeSlotDrag.ghostEl = ghost;
        }
      }

      if (_activeSlotDrag.dragging && _activeSlotDrag.ghostEl) {
        _activeSlotDrag.ghostEl.style.left = (t.clientX - 10) + 'px';
        _activeSlotDrag.ghostEl.style.top = (t.clientY - 10) + 'px';
      }
    }, { passive: true });

    slot.addEventListener('touchend', function(e) {
      if (!_activeSlotDrag) return;
      var dragWasActive = _activeSlotDrag.dragging;
      var ghost = _activeSlotDrag.ghostEl;
      _activeSlotDrag = null;
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      if (!dragWasActive) return;

      var t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t) return;

      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.useActiveItemAt === 'function') {
        var coords = _getGridCoordsFromEvent(t.clientX, t.clientY);
        if (coords) {
          GoneRogue.useActiveItemAt(coords.x, coords.y);
          _suppressNextClick = true;
        }
      }
    }, { passive: true });

    // Pointer-based drag targeting (desktop)
    slot.addEventListener('pointerdown', function(e) {
      if (!e || e.pointerType === 'touch') return;
      if (e.button !== undefined && e.button !== 0) return;
      if (typeof GAMESTATE === 'undefined' || !GAMESTATE.getActiveItem || !GAMESTATE.getActiveItem()) return;

      _activeSlotDrag = {
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        ghostEl: null
      };
    });

    document.addEventListener('pointermove', function(e) {
      if (!_activeSlotDrag) return;
      if (!e || e.pointerType === 'touch') return;

      var dx = e.clientX - _activeSlotDrag.startX;
      var dy = e.clientY - _activeSlotDrag.startY;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (!_activeSlotDrag.dragging && dist > 12) {
        _activeSlotDrag.dragging = true;

        // Create a small ghost indicator
        var activeItem = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;
        if (activeItem) {
          var ghost = document.createElement('div');
          ghost.className = 'active-slot-drag-ghost';
          ghost.textContent = activeItem.emoji || '📦';
          ghost.style.position = 'fixed';
          ghost.style.left = (e.clientX - 10) + 'px';
          ghost.style.top = (e.clientY - 10) + 'px';
          ghost.style.zIndex = '99999';
          ghost.style.pointerEvents = 'none';
          ghost.style.fontSize = '20px';
          document.body.appendChild(ghost);
          _activeSlotDrag.ghostEl = ghost;
        }
      }

      if (_activeSlotDrag.dragging && _activeSlotDrag.ghostEl) {
        _activeSlotDrag.ghostEl.style.left = (e.clientX - 10) + 'px';
        _activeSlotDrag.ghostEl.style.top = (e.clientY - 10) + 'px';
      }
    });

    document.addEventListener('pointerup', function(e) {
      if (!_activeSlotDrag) return;
      if (!e || e.pointerType === 'touch') { _activeSlotDrag = null; return; }

      var dragWasActive = _activeSlotDrag.dragging;
      var ghost = _activeSlotDrag.ghostEl;
      _activeSlotDrag = null;

      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);

      if (!dragWasActive) return;

      // Dropped somewhere: if over grid, target-use at coords
      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.useActiveItemAt === 'function') {
        var coords = _getGridCoordsFromEvent(e.clientX, e.clientY);
        if (coords) {
          GoneRogue.useActiveItemAt(coords.x, coords.y);
          _suppressNextClick = true;
        }
      }
    });
  }

  function _setupHandFanButton() {
    var handFanBtn = document.getElementById('hand-fan-toggle-btn');
    if (!handFanBtn) {
      console.warn('[GoneRogueMobile] Hand fan toggle button not found');
      return;
    }

    handFanBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();

      // Only show hand fan if Gone Rogue is active
      if (typeof GoneRogue === 'undefined' || !GoneRogue.isActive()) {
        console.log('[GoneRogueMobile] Hand fan toggle suppressed: Gone Rogue not active');
        return;
      }

      // Don't show card fan if in STR combat
      var inStrCombat = GoneRogue.isStrCombatActive && GoneRogue.isStrCombatActive();
      if (inStrCombat) {
        console.log('[GoneRogueMobile] Hand fan toggle suppressed: in STR combat');
        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.show('Hand fan disabled during combat', 2000);
        }
        return;
      }

      // Toggle the hand fan
      _showCardFan();
    });
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

    // Initialize canvas renderer if enabled and available
    if (USE_CANVAS_RENDERER && typeof CanvasRenderer !== 'undefined') {
      try {
        _canvasRenderer = new CanvasRenderer.CanvasRenderer({
          width: 40,
          height: 20,
          cellSize: 20,
          renderMode: CanvasRenderer.RENDER_MODE.EMOJI,
          enableLighting: true
        });

        // Add canvas to grid container
        _gridContainer.appendChild(_canvasRenderer.getCanvas());

        console.log('[GoneRogueMobile] Canvas renderer initialized');
      } catch (e) {
        console.warn('[GoneRogueMobile] Failed to initialize canvas renderer, falling back to DOM:', e);
        _canvasRenderer = null;
      }
    }

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
    _gridContainer.addEventListener('touchmove', _handleGridTouchMove, { passive: false });
    _gridContainer.addEventListener('touchend', _handleGridTouchEnd, { passive: false });
    _gridContainer.addEventListener('click', _handleGridClick);

    // Desktop: pointer-based fishing (hold-to-move)
    _gridContainer.addEventListener('pointerdown', _handleGridPointerDown);
    _gridContainer.addEventListener('pointermove', _handleGridPointerMove);
    _gridContainer.addEventListener('pointerup', _handleGridPointerUp);
    _gridContainer.addEventListener('pointercancel', _handleGridPointerUp);

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
   * Render using canvas renderer (high performance path)
   */
  function _renderWithCanvas(grid, player, enemies, items, breakables, projectiles, muzzleFlash, impactEffects, currencies, colorCycleTime) {
    // Prepare grid data for canvas renderer
    var canvasGrid = [];

    for (var y = 0; y < grid.length; y++) {
      canvasGrid[y] = [];
      for (var x = 0; x < grid[y].length; x++) {
        var tile = grid[y][x];
        var cellData = {
          char: null,
          color: '#FFFFFF',
          bg: null,
          type: tile ? tile.type : 'empty'
        };

        // Get biome background color for this tile (gradient system)
        var biomeBg = null;
        if (typeof GoneRogue !== 'undefined' && GoneRogue.getBiomeBackgroundColor) {
          biomeBg = GoneRogue.getBiomeBackgroundColor(x, y);
        }

        // Set tile appearance
        if (tile) {
          if (typeof tile === 'string') {
            // Raw string/character tile from _biomeVisualGrid or _grid
            cellData.char = tile;
            if (tile === '█' || tile === '▓') {
              cellData.bg = '#333333';
              cellData.color = '#666666';
            } else if (tile === '░') {
              cellData.bg = '#1a1a1a';
              cellData.color = '#555555';
            } else if (tile === '🚪' || tile === '▼') {
              cellData.bg = '#0a1a0a';
              cellData.color = '#00ff88';
            } else if (tile === '~') {
              // Water tile — dark blue background
              cellData.bg = '#0a1a2a';
              cellData.color = '#2a5a8a';
            } else {
              // Floor tiles (ASCII grass, dirt) and emoji wall/deco tiles
              // Use biome gradient background if available, else fallback
              cellData.bg = biomeBg || '#0a0a0a';
              cellData.color = '#2a6e3f'; // Green for ASCII floor readability
            }
          } else {
            // Object tile format
            if (tile.emoji) {
              cellData.char = tile.emoji;
            } else if (tile.glyph) {
              cellData.char = tile.glyph;
            }

            if (tile.color) {
              cellData.color = tile.color;
            }

            // Background color for specific tiles
            if (tile.type === 'wall') {
              cellData.bg = '#2a2a2a';
            } else if (tile.type === 'floor') {
              cellData.bg = biomeBg || '#0a0a0a';
            }
          }
        }

        canvasGrid[y][x] = cellData;
      }
    }

    // Prepare entities array (enemies, breakables, currencies, items, projectiles)
    var entities = [];

    // Add enemies
    if (enemies) {
      enemies.forEach(function(enemy) {
        if (enemy.hp > 0) {
          var color = '#FF0000';

          // Color based on awareness state
          if (enemy.awareness === 'detected') {
            color = '#FF0000';
          } else if (enemy.awareness === 'suspicious') {
            color = '#FFFF00';
          } else if (enemy.awareness === 'calm') {
            color = '#00FF00';
          }

          entities.push({
            x: enemy.x,
            y: enemy.y,
            char: enemy.emoji || '🪖',
            color: color,
            isEnemy: true
          });
        }
      });
    }

    // Add breakables
    if (breakables) {
      breakables.forEach(function(breakable) {
        if (breakable.hp > 0) {
          entities.push({
            x: breakable.x,
            y: breakable.y,
            char: breakable.emoji || breakable.glyph || '📦',
            color: '#8B4513'
          });
        }
      });
    }

    // Add currencies
    if (currencies) {
      currencies.forEach(function(currency) {
        entities.push({
          x: currency.x,
          y: currency.y,
          char: currency.glyph || '¢',
          color: '#FFFF00'
        });
      });
    }

    // Add items
    if (items) {
      items.forEach(function(item) {
        entities.push({
          x: item.x,
          y: item.y,
          char: item.emoji || '💎',
          color: '#00FFFF'
        });
      });
    }

    // Add projectiles
    if (projectiles) {
      projectiles.forEach(function(projectile) {
        entities.push({
          x: projectile.x,
          y: projectile.y,
          char: projectile.emoji || projectile.glyph || '💥',
          color: '#FF00FF'
        });
      });
    }

    // Add interactive items
    if (typeof InteractiveItems !== 'undefined') {
      var interactiveItems = InteractiveItems.getAllItems();
      interactiveItems.forEach(function(item) {
        entities.push({
          x: item.x,
          y: item.y,
          char: item.emoji,
          color: '#00FFFF'
        });
      });
    }

    // Prepare effects array
    var effects = [];

    // Add muzzle flash
    if (muzzleFlash) {
      effects.push({
        x: muzzleFlash.x,
        y: muzzleFlash.y,
        char: '💥',
        color: '#FFFF00',
        glow: true,
        alpha: 0.8
      });
    }

    // Add impact effects
    if (impactEffects) {
      impactEffects.forEach(function(impact) {
        var impactChar = '💥';
        var impactColor = '#FFFFFF';

        if (impact.type === 'enemy') {
          impactColor = '#FF0000';
        } else if (impact.type === 'breakable') {
          impactColor = '#FFA500';
        } else if (impact.type === 'wall') {
          impactColor = '#808080';
        }

        effects.push({
          x: impact.x,
          y: impact.y,
          char: impactChar,
          color: impactColor,
          glow: true,
          alpha: 0.9
        });
      });
    }

    // Render using canvas renderer
    _canvasRenderer.renderGrid({
      grid: canvasGrid,
      entities: entities,
      effects: effects,
      player: player ? {
        x: player.visualX !== undefined ? player.visualX : player.x,
        y: player.visualY !== undefined ? player.visualY : player.y,
        char: '🥷',
        color: '#00FF00'
      } : null
    });

    // Render sprint trails on canvas
    if (typeof SprintTrailSystem !== 'undefined' && _canvasRenderer && _canvasRenderer.getContext) {
      var cellWidth = _canvasRenderer.getCellWidth ? _canvasRenderer.getCellWidth() : 32;
      var cellHeight = _canvasRenderer.getCellHeight ? _canvasRenderer.getCellHeight() : 32;
      SprintTrailSystem.renderToCanvas(_canvasRenderer.getContext(), cellWidth, cellHeight);
    }
  }

  /**
   * Render grid as interactive HTML cells (or canvas if enabled)
   */
  function renderGrid(grid, player, enemies, items, colorCycleTime, breakables, projectiles, alertLevel, strCombatActive, muzzleFlash, impactEffects, currencies, npcs, tileMetadata) {
    var _rg0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;
    if (!_gridContainer || !grid) return;

    breakables = breakables || [];
    projectiles = projectiles || [];
    currencies = currencies || [];
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

    // Use canvas renderer if available
    if (_canvasRenderer) {
      _renderWithCanvas(grid, player, enemies, items, breakables, projectiles, muzzleFlash, impactEffects, currencies, colorCycleTime);
      if (_rg0 && typeof EYESONLY_PERF !== 'undefined') {
        EYESONLY_PERF.mark('rogue.renderGridMs', performance.now() - _rg0);
      }
      return;
    }

    // Fallback to DOM rendering
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
        var npc = npcs ? npcs.find(function(n) { return n.x === x && n.y === y; }) : null;
        var projectile = projectiles.find(function(p) { return p.x === x && p.y === y; });
        var breakable = breakables.find(function(b) { return b.x === x && b.y === y; });
        var item = items ? items.find(function(i) { return i.x === x && i.y === y; }) : null;
        var currency = currencies.find(function(c) { return c.x === x && c.y === y; });
        var md = tileMetadata ? tileMetadata[x + ',' + y] : null;

        // Check for muzzle flash at this position
        var hasMuzzleFlash = muzzleFlash && muzzleFlash.x === x && muzzleFlash.y === y;

        // Check for impact effects at this position
        var impact = impactEffects ? impactEffects.find(function(e) { return e.x === x && e.y === y; }) : null;

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

          // Add muzzle flash effect
          if (hasMuzzleFlash) {
            cell.classList.add('cell-muzzle-flash');
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
        } else if (npc) {
          cell.textContent = npc.emoji || '🧑';
          cell.classList.add('cell-npc');
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
        } else if (currency) {
          // Render currency with twinkle animation
          // Use a simple text representation with CSS animation for twinkle effect
          cell.textContent = currency.glyph || '¢';
          cell.classList.add('cell-currency');

          // Calculate twinkle phase based on time (cycle every 1000ms)
          var elapsed = Date.now() - (currency.spawnTime || Date.now());
          var twinklePhase = (elapsed % 1000) / 1000; // 0 to 1

          // Brightness cycles: 0 -> 1 -> 0 (using sine wave)
          var brightness = 0.7 + 0.3 * Math.sin(twinklePhase * Math.PI * 2);
          cell.style.filter = 'brightness(' + brightness + ')';
          cell.style.color = '#ffff00'; // Yellow for currency
        } else {
          // Metadata overlays (locked doors/chests + gate zones)
          if (md && (md.type === 'locked_gate' || md.type === 'locked_chest')) {
            cell.textContent = md.emoji || (md.type === 'locked_gate' ? '🚪' : '🧰');
            cell.classList.add(md.type === 'locked_gate' ? 'cell-locked-gate' : 'cell-locked-chest');
          } else if (md && (md.type === 'npc_gate_warning' || md.type === 'npc_gate_trigger')) {
            // Subtle approach indicator: don't replace tile, just tint
            cell.classList.add(md.type === 'npc_gate_trigger' ? 'cell-npc-gate-trigger' : 'cell-npc-gate-warning');
          }

          // Check for interactive items
          var interactiveItem = null;
          if (typeof InteractiveItems !== 'undefined') {
            interactiveItem = InteractiveItems.getItemAt(x, y);
          }

          if (interactiveItem) {
            cell.textContent = interactiveItem.emoji;
            cell.classList.add('cell-interactive-item');

            // Add interaction indicator if player is in range
            if (player && typeof InteractiveItems !== 'undefined') {
              if (InteractiveItems.canInteractWith(player.x, player.y, interactiveItem)) {
                cell.classList.add('interactive-in-range');
              }
            }
          } else {
            _setCellTile(cell, tile);
          }
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

        // Add impact effect classes
        if (impact) {
          if (impact.type === 'breakable') {
            cell.classList.add('cell-impact-breakable');
          } else if (impact.type === 'enemy') {
            cell.classList.add('cell-impact-enemy');
          } else if (impact.type === 'wall') {
            cell.classList.add('cell-impact-wall');
          } else if (impact.type === 'miss') {
            cell.classList.add('cell-impact-miss');
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

    // Render overhead animations
    if (typeof OverheadAnimator !== 'undefined') {
      var currentTime = Date.now();
      OverheadAnimator.update(currentTime);

      var animations = OverheadAnimator.getAllAnimations();
      for (var key in animations) {
        var parts = key.split(',');
        var animX = parseInt(parts[0]);
        var animY = parseInt(parts[1]);
        var anim = animations[key];

        // Find corresponding cell
        var cellIndex = animY * grid[0].length + animX;
        var cell = _gridContainer.children[cellIndex];

        if (cell) {
          var transform = OverheadAnimator.calculateAnimationTransform(anim, currentTime);

          // Create animation element
          var animEl = document.createElement('div');
          animEl.className = 'overhead-animation ' + anim.type.toLowerCase().replace(/_/g, '-');
          animEl.textContent = anim.text || anim.emoji;
          animEl.style.color = anim.color;
          animEl.style.opacity = transform.opacity;
          animEl.style.transform = 'translate(' + transform.x + 'px, ' + transform.y + 'px) scale(' + transform.scale + ')';

          cell.appendChild(animEl);
        }
      }
    }

    // Render sprint trails (DOM mode)
    if (typeof SprintTrailSystem !== 'undefined') {
      var cellWidth = _gridContainer.offsetWidth / grid[0].length;
      var cellHeight = _gridContainer.offsetHeight / grid.length;
      SprintTrailSystem.renderToDOM(_gridContainer, cellWidth, cellHeight);
    }

    // Render STR combat overlay if combat is active
    _renderStrCombatOverlay();

    if (_rg0 && typeof EYESONLY_PERF !== 'undefined') {
      EYESONLY_PERF.mark('rogue.renderGridMs', performance.now() - _rg0);
    }
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
    }, CLICK_FEEDBACK_DURATION_MS);
  }

  /**
   * Process grid input (shared by touch and click handlers)
   * @param {number} x - Grid X coordinate
   * @param {number} y - Grid Y coordinate
   * @param {boolean} runMode - Whether to run to target
   */
  function _processGridInput(x, y, runMode) {
    if (typeof GoneRogue !== 'undefined') {
      var player = GoneRogue.getPlayer ? GoneRogue.getPlayer() : null;
      var now = Date.now();

      // Check if tapping self (show card fan)
      // BUT NOT if in STR combat, if clicking on a breakable, or within cooldown after movement
      if (player && player.x === x && player.y === y) {
        // Tap on player now resets MOK windows instead of showing card fan
        // Card fan is now toggled via the dedicated card button in MOK footer
        console.log('[GoneRogueMobile] Player tapped: resetting MOK windows to default');

        // Reset MOK history window to minimized state
        if (typeof TooltipSystem !== 'undefined' && TooltipSystem.collapseHistory) {
          TooltipSystem.collapseHistory();
        }

        // Reset debrief feed to default display for current mode
        if (typeof DebriefFeedController !== 'undefined') {
          var currentMode = document.body.classList.contains('mode-gone-rogue') ||
                           document.body.classList.contains('in-gone-rogue');
          if (currentMode) {
            // In Gone Rogue, default is resources view
            if (DebriefFeedController.getCurrentDisplay() !== 'resources') {
              DebriefFeedController.toggleDisplay();
            }
          } else {
            // Outside Gone Rogue, default is MOK view
            if (DebriefFeedController.getCurrentDisplay() !== 'mok') {
              DebriefFeedController.toggleDisplay();
            }
          }
        }

        // Collapse debrief window if expanded
        var debriefWindow = document.getElementById('debrief-window');
        if (debriefWindow && debriefWindow.classList.contains('expanded')) {
          debriefWindow.classList.remove('expanded');
        }

        return;
      }

      // Validate tap distance from player
      if (player) {
        var dx = x - player.x;
        var dy = y - player.y;
        var distance = Math.sqrt(dx * dx + dy * dy);

        // Reject taps beyond maximum radius
        if (distance > TAP_TO_MOVE_MAX_RADIUS) {
          console.log('[GoneRogueMobile] Tap rejected: distance ' + distance.toFixed(1) + ' exceeds max radius ' + TAP_TO_MOVE_MAX_RADIUS);
          return;
        }

        // Check if tapping interactive item
        if (typeof InteractiveItems !== 'undefined') {
          var item = InteractiveItems.getItemAt(x, y);
          if (item && InteractiveItems.canInteractWith(player.x, player.y, item)) {
            // Trigger interaction
            GoneRogue.process('interact');
            _lastMovementTime = now; // Track as movement-like action
            return;
          }
        }
      }
    }

    // Click-on-enemy: fire projectile instead of moving
    if (typeof GoneRogue !== 'undefined') {
      var enemies = GoneRogue.getEnemies ? GoneRogue.getEnemies() : [];
      if (enemies && enemies.length) {
        for (var i = 0; i < enemies.length; i++) {
          var en = enemies[i];
          if (en && en.hp > 0 && en.x === x && en.y === y) {
            if (typeof GoneRogue.fireProjectileAtTarget === 'function') {
              GoneRogue.fireProjectileAtTarget(x, y);
              _lastMovementTime = Date.now();
              return;
            }
          }
        }
      }
    }

    // Send tap-to-move command and track movement time
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleTapMove === 'function') {
      GoneRogue.handleTapMove(x, y, runMode);
      _lastMovementTime = Date.now(); // Track movement time to prevent immediate card fan
    }
  }

  /**
   * Calculate distance between two touch points
   */
  function _getTouchDistance(touches) {
    if (touches.length < 2) return 0;
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get center point between two touches
   */
  function _getTouchCenter(touches) {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  /**
   * Handle grid touch move (for fishing input, pinch-to-zoom and pan)
   */
  function _handleGridTouchMove(e) {
    // Handle pinch-to-zoom and pan with two fingers
    if (e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();

      // Cancel fishing mode if active
      if (_fishingActive) {
        _hideFishingPath();
        _fishingActive = false;
      }

      var currentDistance = _getTouchDistance(e.touches);
      var currentCenter = _getTouchCenter(e.touches);

      if (_initialPinchDistance === 0) {
        _initialPinchDistance = currentDistance;
        _initialPinchCenter = currentCenter;
        _isPanning = false;
      } else {
        // Calculate zoom scale
        var scale = currentDistance / _initialPinchDistance;
        var newZoom = _currentZoom * scale;

        // Clamp zoom level
        newZoom = Math.max(_minZoom, Math.min(_maxZoom, newZoom));

        // Calculate pan delta
        var panDeltaX = currentCenter.x - _initialPinchCenter.x;
        var panDeltaY = currentCenter.y - _initialPinchCenter.y;

        // Apply pan sensitivity based on zoom level (higher zoom = lower sensitivity)
        var panSensitivity = 0.5 - (newZoom - _minZoom) / (_maxZoom - _minZoom) * 0.3;
        panSensitivity = Math.max(0.2, Math.min(0.5, panSensitivity));

        var newPanX = _panOffset.x + panDeltaX * panSensitivity;
        var newPanY = _panOffset.y + panDeltaY * panSensitivity;

        // Calculate bounds based on zoom level and container size
        if (_gridContainer) {
          var containerRect = _gridContainer.getBoundingClientRect();
          var parentRect = _gridContainer.parentElement.getBoundingClientRect();

          // Maximum pan distance (prevent showing void beyond map)
          var scaledWidth = containerRect.width * newZoom;
          var scaledHeight = containerRect.height * newZoom;
          var maxPanX = Math.max(0, (scaledWidth - parentRect.width) / 2);
          var maxPanY = Math.max(0, (scaledHeight - parentRect.height) / 2);

          // Clamp pan offsets
          newPanX = Math.max(-maxPanX, Math.min(maxPanX, newPanX));
          newPanY = Math.max(-maxPanY, Math.min(maxPanY, newPanY));

          // Apply zoom and pan to grid container
          _gridContainer.style.transform = 'scale(' + newZoom + ') translate(' + newPanX + 'px, ' + newPanY + 'px)';
          _gridContainer.style.transformOrigin = 'center center';

          // Update initial center for continuous panning
          _initialPinchCenter = currentCenter;
          _isPanning = true;
        }
      }
      return;
    }

    // Single finger - check for fishing input
    if (e.touches.length === 1 && _fishingStart) {
      var touch = e.touches[0];
      _fishingCurrent = { x: touch.clientX, y: touch.clientY };

      // Calculate distance from start
      var dx = _fishingCurrent.x - _fishingStart.x;
      var dy = _fishingCurrent.y - _fishingStart.y;
      var distance = Math.sqrt(dx * dx + dy * dy);

      // Activate fishing mode if drag exceeds threshold
      if (!_fishingActive && distance > FISHING_THRESHOLD) {
        _fishingActive = true;
      }

      // If fishing is active, calculate and show path
      if (_fishingActive) {
        e.preventDefault();
        e.stopPropagation();

        var targetCoords = _getGridCoordsFromEvent(touch.clientX, touch.clientY);
        if (targetCoords && typeof GoneRogueMovement !== 'undefined') {
          var player = typeof GoneRogue !== 'undefined' && GoneRogue.getPlayer ? GoneRogue.getPlayer() : null;
          if (player) {
            // Calculate path from player to target
            var collisionCheck = (typeof GoneRogue !== 'undefined' && GoneRogue.isWalkable)
              ? function(x, y) { return !GoneRogue.isWalkable(x, y); }
              : null;
            _fishingPath = GoneRogueMovement.findPath(player.x, player.y, targetCoords.x, targetCoords.y, collisionCheck);

            // Show path overlay
            _showFishingPath(_fishingPath);
          }
        }
      }
    }
  }

  /**
   * Get grid coordinates from touch/click event
   * Works with both DOM and canvas rendering
   */
  function _getGridCoordsFromEvent(clientX, clientY) {
    // If using canvas renderer, convert canvas coordinates to grid coordinates
    if (_canvasRenderer) {
      var canvas = _canvasRenderer.getCanvas();
      var rect = canvas.getBoundingClientRect();
      var canvasX = clientX - rect.left;
      var canvasY = clientY - rect.top;

      // Convert to grid coordinates
      var gridCoords = _canvasRenderer.canvasToGrid(canvasX, canvasY);
      return gridCoords;
    }

    // Fallback to DOM element lookup
    var target = document.elementFromPoint(clientX, clientY);
    if (target && target.classList.contains('rogue-cell')) {
      return {
        x: parseInt(target.dataset.x),
        y: parseInt(target.dataset.y)
      };
    }

    return null;
  }

  /**
   * Show fishing path overlay
   */
  function _showFishingPath(path) {
    if (!path || path.length === 0) return;

    // Remove existing overlay
    _hideFishingPath();

    // Create path overlay element
    _fishingPathOverlay = document.createElement('div');
    _fishingPathOverlay.className = 'fishing-path-overlay';
    _fishingPathOverlay.style.position = 'absolute';
    _fishingPathOverlay.style.top = '0';
    _fishingPathOverlay.style.left = '0';
    _fishingPathOverlay.style.width = '100%';
    _fishingPathOverlay.style.height = '100%';
    _fishingPathOverlay.style.pointerEvents = 'none';
    _fishingPathOverlay.style.zIndex = '1000';

    // Draw path using SVG
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.position = 'absolute';

    // Calculate cell size
    var gridRect = _gridContainer.getBoundingClientRect();
    var cellWidth = gridRect.width / 40; // GRID_WIDTH = 40
    var cellHeight = gridRect.height / 20; // GRID_HEIGHT = 20

    // Draw path segments
    for (var i = 0; i < path.length - 1; i++) {
      var from = path[i];
      var to = path[i + 1];

      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', (from.x + 0.5) * cellWidth);
      line.setAttribute('y1', (from.y + 0.5) * cellHeight);
      line.setAttribute('x2', (to.x + 0.5) * cellWidth);
      line.setAttribute('y2', (to.y + 0.5) * cellHeight);
      line.setAttribute('stroke', 'rgba(28, 255, 155, 0.8)');
      line.setAttribute('stroke-width', '3');
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);
    }

    // Draw endpoint marker
    if (path.length > 0) {
      var endpoint = path[path.length - 1];
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', (endpoint.x + 0.5) * cellWidth);
      circle.setAttribute('cy', (endpoint.y + 0.5) * cellHeight);
      circle.setAttribute('r', '8');
      circle.setAttribute('fill', 'rgba(28, 255, 155, 0.6)');
      circle.setAttribute('stroke', 'rgba(28, 255, 155, 1)');
      circle.setAttribute('stroke-width', '2');
      svg.appendChild(circle);
    }

    _fishingPathOverlay.appendChild(svg);
    _gridContainer.appendChild(_fishingPathOverlay);
  }

  /**
   * Hide fishing path overlay
   */
  function _hideFishingPath() {
    if (_fishingPathOverlay && _fishingPathOverlay.parentNode) {
      _fishingPathOverlay.parentNode.removeChild(_fishingPathOverlay);
    }
    _fishingPathOverlay = null;
  }

  /**
   * Handle grid touch start (for double-tap detection and fishing input)
   */
  function _handleGridTouchStart(e) {
    e.preventDefault();
    e.stopPropagation(); // Prevent document-level listeners

    // Initialize pinch distance for two-finger gestures
    if (e.touches.length === 2) {
      _initialPinchDistance = _getTouchDistance(e.touches);
      return; // Don't process as tap
    }

    var touch = e.touches[0];
    var coords = _getGridCoordsFromEvent(touch.clientX, touch.clientY);

    if (!coords) return;

    var now = Date.now();
    var cellKey = coords.x + ',' + coords.y;

    // Initialize fishing state
    _fishingStart = { x: touch.clientX, y: touch.clientY, gridX: coords.x, gridY: coords.y };
    _fishingCurrent = { x: touch.clientX, y: touch.clientY };
    _fishingActive = false; // Will activate if drag exceeds threshold
    _fishingPath = [];

    // Check for double-tap (within threshold)
    if (_lastTapCell === cellKey && (now - _lastTapTime) < DOUBLE_TAP_THRESHOLD_MS) {
      // Check if sprint is allowed (not blocked by food pickup delay or exhaustion)
      var canSprint = typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.canSprint === 'function'
        ? GAMESTATE.canSprint()
        : true;

      _runMode = canSprint;

      // For DOM mode, add visual feedback only if sprint is allowed
      if (_runMode && !_canvasRenderer) {
        var target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target) {
          target.classList.add('run-mode-flash');
          setTimeout(function() {
            target.classList.remove('run-mode-flash');
          }, 200);
        }
      }
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

    // If pinch gesture ended, save current zoom and pan state, reset pinch distance
    if (_initialPinchDistance > 0) {
      var currentTransform = _gridContainer ? window.getComputedStyle(_gridContainer).transform : 'none';
      if (currentTransform && currentTransform !== 'none') {
        var matrix = currentTransform.match(/matrix\(([^)]+)\)/);
        if (matrix) {
          var values = matrix[1].split(', ');
          _currentZoom = parseFloat(values[0]) || 1.0;
          // Extract translate values if present (matrix includes translate)
          if (values.length >= 6) {
            _panOffset.x = parseFloat(values[4]) || 0;
            _panOffset.y = parseFloat(values[5]) || 0;
          }
        }
      }
      _initialPinchDistance = 0;
      _initialPinchCenter = { x: 0, y: 0 };
      _isPanning = false;
      return; // Don't process as tap
    }

    var touch = e.changedTouches[0];
    var coords = _getGridCoordsFromEvent(touch.clientX, touch.clientY);

    if (!coords) {
      // Hide fishing path if touch ended outside grid
      if (_fishingActive) {
        _hideFishingPath();
        _fishingActive = false;
      }
      return;
    }

    // Show click feedback at touch point
    _showClickFeedback(touch.clientX, touch.clientY);

    // If fishing was active, execute the path movement
    if (_fishingActive && _fishingPath.length > 0) {
      _hideFishingPath();
      _fishingActive = false;

      // Execute smooth movement along fishing path
      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleFishingMove === 'function') {
        GoneRogue.handleFishingMove(_fishingPath, _runMode);
      } else {
        // Fallback to tap-to-move with final destination
        var destination = _fishingPath[_fishingPath.length - 1];
        _processGridInput(destination.x, destination.y, _runMode);
      }

      _fishingPath = [];
      return;
    }

    // Normal tap-to-move
    _processGridInput(coords.x, coords.y, _runMode);
  }

  /**
   * Desktop pointerdown (hold-to-move / fishing)
   */
  function _handleGridPointerDown(e) {
    if (!e || e.pointerType === 'touch') return;
    if (e.button !== undefined && e.button !== 0) return; // left click only

    _desktopPointerDown = true;
    _desktopFishingActive = false;
    _desktopPointerStart = { x: e.clientX, y: e.clientY };
    _fishingStart = { x: e.clientX, y: e.clientY };
    _fishingPath = [];

    try {
      if (_gridContainer && _gridContainer.setPointerCapture) {
        _gridContainer.setPointerCapture(e.pointerId);
      }
    } catch (err) { /* ignore */ }
  }

  /**
   * Desktop pointermove (drag to preview A* path)
   */
  function _handleGridPointerMove(e) {
    if (!e || e.pointerType === 'touch') return;
    if (!_desktopPointerDown) return;

    var dx = e.clientX - _desktopPointerStart.x;
    var dy = e.clientY - _desktopPointerStart.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (!_desktopFishingActive && distance > FISHING_THRESHOLD) {
      _desktopFishingActive = true;
    }

    if (_desktopFishingActive) {
      e.preventDefault();
      e.stopPropagation();

      var targetCoords = _getGridCoordsFromEvent(e.clientX, e.clientY);
      if (targetCoords && typeof GoneRogueMovement !== 'undefined') {
        var player = typeof GoneRogue !== 'undefined' && GoneRogue.getPlayer ? GoneRogue.getPlayer() : null;
        if (player) {
          var collisionCheck = (typeof GoneRogue !== 'undefined' && GoneRogue.isWalkable)
            ? function(x, y) { return !GoneRogue.isWalkable(x, y); }
            : null;

          _fishingPath = GoneRogueMovement.findPath(player.x, player.y, targetCoords.x, targetCoords.y, collisionCheck);
          _showFishingPath(_fishingPath);
        }
      }
    }
  }

  /**
   * Desktop pointerup (execute fishing move if active)
   */
  function _handleGridPointerUp(e) {
    if (!e || e.pointerType === 'touch') return;

    if (!_desktopPointerDown) return;
    _desktopPointerDown = false;

    try {
      if (_gridContainer && _gridContainer.releasePointerCapture) {
        _gridContainer.releasePointerCapture(e.pointerId);
      }
    } catch (err) { /* ignore */ }

    if (_desktopFishingActive && _fishingPath.length > 0) {
      _hideFishingPath();
      _desktopFishingActive = false;

      // Prevent the subsequent click from also firing movement
      _suppressNextClick = true;

      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleFishingMove === 'function') {
        GoneRogue.handleFishingMove(_fishingPath, _runMode);
      } else {
        var destination = _fishingPath[_fishingPath.length - 1];
        _processGridInput(destination.x, destination.y, _runMode);
      }

      _fishingPath = [];
    }
  }

  /**
   * Handle grid click/tap
   */
  function _handleGridClick(e) {
    if (_suppressNextClick) {
      _suppressNextClick = false;
      return;
    }

    var coords = _getGridCoordsFromEvent(e.clientX, e.clientY);

    if (!coords) return;

    e.preventDefault(); // Prevent default click behavior
    e.stopPropagation(); // Prevent bubbling to document-level handlers

    // Show click feedback at mouse/pointer position
    _showClickFeedback(e.clientX, e.clientY);

    var now = Date.now();
    var cellKey = coords.x + ',' + coords.y;

    // Check for double-click on desktop (within threshold)
    if (_lastTapCell === cellKey && (now - _lastTapTime) < DOUBLE_TAP_THRESHOLD_MS) {
      // Check if sprint is allowed (not blocked by food pickup delay or exhaustion)
      var canSprint = typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.canSprint === 'function'
        ? GAMESTATE.canSprint()
        : true;

      _runMode = canSprint;

      // For DOM mode, add visual feedback only if sprint is allowed
      if (_runMode && !_canvasRenderer) {
        var target = e.target;
        if (target) {
          target.classList.add('run-mode-flash');
          setTimeout(function() {
            target.classList.remove('run-mode-flash');
          }, 200);
        }
      }
    } else {
      _runMode = false;
    }

    _lastTapTime = now;
    _lastTapCell = cellKey;

    _processGridInput(coords.x, coords.y, _runMode);
  }

  /**
   * Show card fan when tapping self
   */
  function _showCardFan() {
    if (!_cardContainer) return;

    _cardContainer.style.display = 'flex';
    _cardContainer.innerHTML = '';

    // Get all cards from GAMESTATE
    var allCards = [];
    if (typeof GAMESTATE !== 'undefined') {
      allCards = GAMESTATE.getLooseInventory();
    }

    if (allCards.length === 0) {
      _cardContainer.innerHTML = '<div class="no-cards">NO CARDS AVAILABLE</div>';
      setTimeout(function() {
        _cardContainer.style.display = 'none';
      }, 2000);
      return;
    }

    // Check if in STR combat (enables multi-card selection)
    var inStrCombat = typeof GoneRogue !== 'undefined' && GoneRogue.isStrCombatActive && GoneRogue.isStrCombatActive();

    // Determine if pagination is needed
    var needsPagination = allCards.length > _maxCardsWithoutPagination;
    var totalPages = needsPagination ? Math.ceil(allCards.length / _cardsPerPage) : 1;

    // Clamp page index to valid range
    _cardPageIndex = Math.max(0, Math.min(_cardPageIndex, totalPages - 1));

    // Calculate slice range for current page
    var startIndex, endIndex, cardsToShow;
    if (needsPagination) {
      startIndex = _cardPageIndex * _cardsPerPage;
      endIndex = Math.min(startIndex + _cardsPerPage, allCards.length);
      cardsToShow = allCards.slice(startIndex, endIndex);
    } else {
      cardsToShow = allCards;
      startIndex = 0;
    }

    // Create card elements
    cardsToShow.forEach(function(card, localIndex) {
      var globalIndex = startIndex + localIndex;
      var cardEl = document.createElement('div');
      cardEl.className = 'rogue-card';
      cardEl.dataset.cardIndex = globalIndex;

      // Check if this card is selected
      var isSelected = _selectedCards.indexOf(globalIndex) !== -1;
      if (isSelected) {
        cardEl.classList.add('card-selected');
      }

      // Add selection indicator if in combat
      var selectionIndicator = '';
      if (inStrCombat) {
        var selectionNumber = _selectedCards.indexOf(globalIndex);
        if (selectionNumber !== -1) {
          selectionIndicator = '<div class="card-selection-badge">' + (selectionNumber + 1) + '</div>';
        }
      }

      cardEl.innerHTML =
        selectionIndicator +
        '<div class="card-emoji">' + card.emoji + '</div>' +
        '<div class="card-name">' + card.name + '</div>' +
        '<div class="card-quality">' + card.qualityName + '</div>';

      _cardContainer.appendChild(cardEl);
    });

    // Add navigation arrow if pagination is needed
    if (needsPagination) {
      var navEl = document.createElement('div');
      navEl.className = 'rogue-card card-nav';

      // Determine if we should show "next" or "prev" arrow
      var isLastPage = _cardPageIndex === totalPages - 1;
      var arrow = isLastPage ? '←' : '→';
      var label = isLastPage ? 'PREV' : 'NEXT';

      navEl.innerHTML =
        '<div class="card-emoji card-nav-arrow">' + arrow + '</div>' +
        '<div class="card-name">' + label + '</div>' +
        '<div class="card-quality">Page ' + (_cardPageIndex + 1) + '/' + totalPages + '</div>';

      navEl.addEventListener('click', _handleCardNavClick);
      navEl.addEventListener('touchend', _handleCardNavClick);

      _cardContainer.appendChild(navEl);
    }

    // Add "Play Selected" button if in STR combat and cards are selected
    if (inStrCombat && _selectedCards.length > 0) {
      var playBtn = document.createElement('div');
      playBtn.className = 'rogue-card card-play-selected';
      playBtn.innerHTML =
        '<div class="card-emoji">⚔</div>' +
        '<div class="card-name">PLAY</div>' +
        '<div class="card-quality">' + _selectedCards.length + ' selected</div>';

      playBtn.addEventListener('click', _handlePlaySelectedCards);
      playBtn.addEventListener('touchend', _handlePlaySelectedCards);

      _cardContainer.appendChild(playBtn);
    }
  }

  /**
   * Handle card navigation arrow click/tap
   */
  function _handleCardNavClick(e) {
    e.preventDefault();
    e.stopPropagation();

    // Get all cards to determine total pages
    var allCards = [];
    if (typeof GAMESTATE !== 'undefined') {
      allCards = GAMESTATE.getLooseInventory();
    }

    var totalPages = Math.ceil(allCards.length / _cardsPerPage);
    var isLastPage = _cardPageIndex === totalPages - 1;

    // Cycle page index
    if (isLastPage) {
      _cardPageIndex = Math.max(0, _cardPageIndex - 1);
    } else {
      _cardPageIndex = Math.min(totalPages - 1, _cardPageIndex + 1);
    }

    // Re-render card fan with new page
    _showCardFan();
  }

  /**
   * Toggle card selection (add/remove from selected array)
   */
  function _toggleCardSelection(cardIndex) {
    var idx = _selectedCards.indexOf(cardIndex);

    if (idx !== -1) {
      // Card is already selected - remove it
      _selectedCards.splice(idx, 1);
    } else {
      // Card not selected - add it (if under max)
      if (_selectedCards.length < _maxSelectedCards) {
        _selectedCards.push(cardIndex);
      } else {
        // Max cards selected - show feedback via console
        console.log('[GoneRogueMobile] Maximum ' + _maxSelectedCards + ' cards can be selected per round');
      }
    }

    // Re-render card fan to update selection state
    _showCardFan();
  }

  /**
   * Handle "Play Selected" button click - execute all selected cards
   */
  function _handlePlaySelectedCards(e) {
    e.preventDefault();
    e.stopPropagation();

    if (_selectedCards.length === 0) return;

    // Check if we're still in STR combat
    var inStrCombat = typeof GoneRogue !== 'undefined' && GoneRogue.isStrCombatActive && GoneRogue.isStrCombatActive();
    if (!inStrCombat) {
      _selectedCards = [];
      _cardContainer.style.display = 'none';
      return;
    }

    // Execute multi-card combat round
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleMultiCardCombat === 'function') {
      // Pass selected card indices to GoneRogue for execution
      GoneRogue.handleMultiCardCombat(_selectedCards.slice()); // Pass a copy

      // Clear selection
      _selectedCards = [];

      // Hide card fan temporarily - it will reappear after combat round resolves
      _cardContainer.style.display = 'none';

      // Check if combat is still active after a delay
      setTimeout(function() {
        if (typeof GoneRogue !== 'undefined' && GoneRogue.isStrCombatActive && GoneRogue.isStrCombatActive()) {
          // Combat still active - re-show card fan for next round
          _showCardFan();
        } else {
          // Combat ended - reset page index
          _cardPageIndex = 0;
        }
      }, 500);
    }
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
   * Handle card touch end (execute swipe action or toggle selection)
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
    var tapThreshold = 10; // If movement < 10px, it's a tap
    var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check if in STR combat
    var inStrCombat = typeof GoneRogue !== 'undefined' && GoneRogue.isStrCombatActive && GoneRogue.isStrCombatActive();

    // If tap (not swipe) and in STR combat → toggle selection
    if (distance < tapThreshold && inStrCombat) {
      var cardIndex = parseInt(_activeCard.dataset.cardIndex);
      _toggleCardSelection(cardIndex);
      _activeCard = null;
      return;
    }

    // Swipe detected - execute card action immediately
    var direction = null;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > swipeThreshold) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else if (Math.abs(deltaY) > swipeThreshold) {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    if (direction && typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleCardSwipe === 'function') {
      var cardIndex = parseInt(_activeCard.dataset.cardIndex);
      GoneRogue.handleCardSwipe(cardIndex, direction);

      // Clear selection after immediate use
      _selectedCards = [];

      // Check if STR combat is still active after card use
      // If so, re-show card fan after a delay for next round
      setTimeout(function() {
        if (typeof GoneRogue !== 'undefined' && GoneRogue.isStrCombatActive && GoneRogue.isStrCombatActive()) {
          // Combat still active - re-show card fan for next round
          // Keep current page index so player doesn't have to navigate back
          _showCardFan();
        } else {
          // Combat ended - hide card container and reset page index
          _cardContainer.style.display = 'none';
          _cardPageIndex = 0;
        }
      }, 500); // 500ms delay to allow combat log animation to complete
    } else {
      // No valid swipe - just hide card fan (unless in combat with selections)
      if (!inStrCombat || _selectedCards.length === 0) {
        _cardContainer.style.display = 'none';
      }
    }

    _activeCard = null;
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
    html += '🔫' + _getFaceExpression(true, playerState) + 'p';
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

    // Get persistent inventory refs from GAMESTATE
    var persistentInv = [];
    var activeItemRef = null;

    if (typeof GAMESTATE !== 'undefined') {
      persistentInv = GAMESTATE.getPersistentInventory() || [];
      activeItemRef = GAMESTATE.getActiveItem();
    }

    // Clear existing inventory display
    _inventoryContainer.innerHTML = '';

    // Build view model: items + cards (cards are refs resolved via registry)
    var persistentCards = [];
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getPersistentCards === 'function') {
      persistentCards = GAMESTATE.getPersistentCards() || [];
    }

    if (persistentInv.length === 0 && persistentCards.length === 0) {
      _inventoryContainer.style.display = 'none';
      return;
    }

    // Items section
    if (persistentInv.length > 0) {
      var itemsHeader = document.createElement('div');
      itemsHeader.className = 'rogue-inventory-section';
      itemsHeader.textContent = 'ITEMS';
      _inventoryContainer.appendChild(itemsHeader);
    }

    // Create inventory grid (items)
    persistentInv.forEach(function(itemRef, index) {
      if (!itemRef) return;

      var itemDiv = document.createElement('div');
      itemDiv.className = 'rogue-inventory-item';
      itemDiv.dataset.index = index;

      var item = null;
      if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
        item = GoneRogueDataRegistry.getItem(itemRef.id);
      }
      if (!item) item = { name: itemRef.id, emoji: '📦' };

      // Allow migrated legacy overrides
      var displayName = (itemRef.meta && itemRef.meta.legacyName) ? itemRef.meta.legacyName : (item.name || itemRef.id);
      var displayEmoji = (itemRef.meta && itemRef.meta.emoji) ? itemRef.meta.emoji : (item.emoji || '📦');

      // Check if this item is currently equipped
      var isEquipped = activeItemRef && activeItemRef.id === itemRef.id;
      if (isEquipped) {
        itemDiv.classList.add('equipped');
      }

      // Item emoji and name
      var emojiSpan = document.createElement('span');
      emojiSpan.className = 'item-emoji';
      emojiSpan.textContent = displayEmoji;

      var nameSpan = document.createElement('span');
      nameSpan.className = 'item-name';
      nameSpan.textContent = displayName;

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

    // Cards section
    if (persistentCards.length > 0) {
      var cardsHeader = document.createElement('div');
      cardsHeader.className = 'rogue-inventory-section';
      cardsHeader.textContent = 'CARDS';
      _inventoryContainer.appendChild(cardsHeader);

      persistentCards.forEach(function(cardRef, cIndex) {
        if (!cardRef) return;

        var cardDiv = document.createElement('div');
        cardDiv.className = 'rogue-inventory-item rogue-inventory-card';
        cardDiv.dataset.cardIndex = cIndex;
        cardDiv.dataset.kind = 'card';

        var card = null;
        if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
          card = GoneRogueDataRegistry.getCard(cardRef.id);
        }
        if (!card) card = { name: cardRef.id, emoji: '🃏' };

        var cEmoji = card.emoji || '🃏';
        var cName = card.name || cardRef.id;

        var emojiSpan2 = document.createElement('span');
        emojiSpan2.className = 'item-emoji';
        emojiSpan2.textContent = cEmoji;

        var nameSpan2 = document.createElement('span');
        nameSpan2.className = 'item-name';
        nameSpan2.textContent = cName + (cardRef.qty ? (' x' + cardRef.qty) : '');

        cardDiv.appendChild(emojiSpan2);
        cardDiv.appendChild(nameSpan2);

        // Drag handlers for cards (to non-combat hand)
        cardDiv.addEventListener('touchstart', _handleInventoryTouchStart, { passive: false });
        cardDiv.addEventListener('touchmove', _handleInventoryTouchMove, { passive: false });
        cardDiv.addEventListener('touchend', _handleInventoryTouchEnd, { passive: false });

        cardDiv.addEventListener('pointerdown', _handleInventoryPointerDown);
        cardDiv.addEventListener('click', function(e) {
          // Click-to-add to non-combat hand (fast path)
          try {
            var idx = parseInt(e.currentTarget.dataset.cardIndex, 10);
            var cards = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentCards) ? GAMESTATE.getPersistentCards() : [];
            var ref = cards[idx];
            if (ref && typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.addCardToHand) {
              NonCombatStateStore.addCardToHand(ref.id, 1, 'inventory:click_add_card');
            }
          } catch (err) {}
        });

        _inventoryContainer.appendChild(cardDiv);
      });
    }

    _inventoryContainer.style.display = 'grid';
  }

  function _handleInventoryTouchStart(e) {
    e.preventDefault();

    var itemDiv = e.currentTarget;

    if (typeof GAMESTATE === 'undefined') return;

    // Card drag
    if (itemDiv.dataset.kind === 'card') {
      var cIndex = parseInt(itemDiv.dataset.cardIndex, 10);
      var cards = (typeof GAMESTATE.getPersistentCards === 'function') ? GAMESTATE.getPersistentCards() : [];
      var cardRef = cards[cIndex];
      if (!cardRef) return;

      _activeDragItem = {
        element: itemDiv,
        item: cardRef,
        kind: 'card',
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        originalTransform: itemDiv.style.transform
      };

      itemDiv.classList.add('dragging');
      return;
    }

    // Item drag
    var index = parseInt(itemDiv.dataset.index, 10);
    var persistentInv = GAMESTATE.getPersistentInventory();
    var itemRef = persistentInv[index];

    if (!itemRef) return;

    _activeDragItem = {
      element: itemDiv,
      item: itemRef,
      kind: 'item',
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

    // Card drop -> Non-combat hand zone
    if (_activeDragItem.kind === 'card') {
      var handZone = document.getElementById('nch-hand');
      var droppedOnHand = false;
      if (element && handZone) {
        if (element === handZone || handZone.contains(element)) droppedOnHand = true;
      }

      if (droppedOnHand && typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.addCardToHand) {
        NonCombatStateStore.addCardToHand(_activeDragItem.item.id, 1, 'inventory:drag_add_card');
      }
    } else {
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

    if (typeof GAMESTATE === 'undefined') return;

    // Card drag
    if (itemDiv.dataset.kind === 'card') {
      var cIndex = parseInt(itemDiv.dataset.cardIndex, 10);
      var cards = (typeof GAMESTATE.getPersistentCards === 'function') ? GAMESTATE.getPersistentCards() : [];
      var cardRef = cards[cIndex];
      if (!cardRef) return;

      _activeDragItem = {
        element: itemDiv,
        item: cardRef,
        kind: 'card',
        startX: e.clientX,
        startY: e.clientY,
        originalTransform: itemDiv.style.transform
      };

      itemDiv.classList.add('dragging');

      // Add move and up handlers to document
      var handleMoveC = function(moveE) {
        if (!_activeDragItem) return;
        var deltaX = moveE.clientX - _activeDragItem.startX;
        var deltaY = moveE.clientY - _activeDragItem.startY;
        _activeDragItem.element.style.transform = 'translate(' + deltaX + 'px, ' + deltaY + 'px) scale(1.1)';
      };

      var handleUpC = function(upE) {
        if (!_activeDragItem) return;

        var element = document.elementFromPoint(upE.clientX, upE.clientY);
        var handZone = document.getElementById('nch-hand');
        var droppedOnHand = false;
        if (element && handZone) {
          if (element === handZone || handZone.contains(element)) droppedOnHand = true;
        }

        if (droppedOnHand && typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.addCardToHand) {
          NonCombatStateStore.addCardToHand(_activeDragItem.item.id, 1, 'inventory:drag_add_card');
        }

        _activeDragItem.element.style.transform = _activeDragItem.originalTransform || '';
        _activeDragItem.element.classList.remove('dragging');
        _activeDragItem = null;

        showInventory();

        document.removeEventListener('pointermove', handleMoveC);
        document.removeEventListener('pointerup', handleUpC);
      };

      document.addEventListener('pointermove', handleMoveC);
      document.addEventListener('pointerup', handleUpC);
      return;
    }

    // Item drag
    var index = parseInt(itemDiv.dataset.index, 10);
    var persistentInv = GAMESTATE.getPersistentInventory();
    var itemRef = persistentInv[index];

    if (!itemRef) return;

    _activeDragItem = {
      element: itemDiv,
      item: itemRef,
      kind: 'item',
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
    var itemRef = persistentInv[index];

    if (!itemRef) return;

    // Check if already equipped
    var activeItem = GAMESTATE.getActiveItem();
    if (activeItem && activeItem.id === itemRef.id) {
      // Unequip
      _unequipActiveItem();
    } else {
      // Equip
      _equipItemToActiveSlot(itemRef);
    }

    // Refresh inventory display
    showInventory();
  }

  function _equipItemToActiveSlot(itemRef) {
    if (typeof GAMESTATE === 'undefined') return;

    GAMESTATE.setActiveItem(itemRef);

    var item = null;
    if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
      item = GoneRogueDataRegistry.getItem(itemRef.id);
    }
    if (!item) item = { name: itemRef.id, emoji: '📦' };

    var displayName = (itemRef.meta && itemRef.meta.legacyName) ? itemRef.meta.legacyName : (item.name || itemRef.id);
    var displayEmoji = (itemRef.meta && itemRef.meta.emoji) ? itemRef.meta.emoji : (item.emoji || '📦');

    // Update active item display in header
    var activeDisplay = document.getElementById('active-item-display');
    if (activeDisplay) {
      activeDisplay.innerHTML = '<span class="item-emoji">' + displayEmoji + '</span>';
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
      window.appendLine('⚡ EQUIPPED: ' + displayEmoji + ' ' + displayName);
    }

    // Tooltip: Item equipped (include a little stats/quality if present)
    if (typeof TooltipSystem !== 'undefined') {
      var extra = '';
      if (item.qualityName) extra += ' (' + item.qualityName + ')';
      if (item.keyType) extra += ' [' + item.keyType + ']';
      TooltipSystem.showAction('item-equip', { name: (displayName + extra) });
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

  /**
   * Toggle action menu (card fan) for Gone Rogue action button
   */
  function toggleActionMenu() {
    if (!_cardContainer) return;

    // If action menu is currently visible, hide it and reset page index
    if (_cardContainer.style.display !== 'none' && _cardContainer.innerHTML !== '') {
      _cardContainer.style.display = 'none';
      _cardContainer.innerHTML = '';
      _cardPageIndex = 0; // Reset to first page
      return;
    }

    // Show action menu with card fan (starting from page 0)
    _cardPageIndex = 0; // Reset to first page
    _showCardFan();
  }

  return {
    init: init,
    renderGrid: renderGrid,
    hide: hide,
    show: show,
    showFloatingDamage: showFloatingDamage,
    showInventory: showInventory,
    toggleActionMenu: toggleActionMenu
  };
})();
