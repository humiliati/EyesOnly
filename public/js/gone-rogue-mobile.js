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
  var _floorBadgeEl = null;
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

  // Mobile follow smoothing state (canvas transform lerp)
  var _followState = null;

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

  // Player visual smoothing (for canvas/mobile feel)
  var _playerVisual = { x: 0, y: 0, inited: false };

  // Fishing input model state
  var _fishingActive = false;
  var _fishingStart = { x: 0, y: 0 };
  var _fishingCurrent = { x: 0, y: 0 };
  var _fishingPath = [];
  var _fishingPathOverlay = null;
  var FISHING_THRESHOLD = 20; // pixels to activate fishing mode
  var FISHING_UPDATE_INTERVAL = 50; // ms between path recalculations
  var FISHING_SPRINT_DRAG_SPEED = 1.2; // px/ms — rapid drag activates sprint (Phase 5)

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

          var ghostEmoji = '📦';
          if (activeItem && activeItem.id && typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
            var itemDef = GoneRogueDataRegistry.getItem(activeItem.id);
            if (itemDef && itemDef.emoji) ghostEmoji = itemDef.emoji;
          }
          ghost.textContent = ghostEmoji;

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

      var coords = _getGridCoordsFromEvent(t.clientX, t.clientY);
      if (!coords) return;

      var activeItemRef = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;

      // Box deployables: drag-to-place
      if (activeItemRef && activeItemRef.id && typeof GoneRogue !== 'undefined' && GoneRogue.isBoxDeployItem && GoneRogue.isBoxDeployItem(activeItemRef.id) && GoneRogue.placeBox) {
        var quality = 'common';
        if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
          var def = GoneRogueDataRegistry.getItem(activeItemRef.id);
          if (def && def.boxQuality) quality = def.boxQuality;
        }
        GoneRogue.placeBox(coords, activeItemRef.id, quality);
        _suppressNextClick = true;
        return;
      }

      // Default: active item targeting
      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.useActiveItemAt === 'function') {
        GoneRogue.useActiveItemAt(coords.x, coords.y);
        _suppressNextClick = true;
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

          var ghostEmoji = '📦';
          if (activeItem && activeItem.id && typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
            var itemDef = GoneRogueDataRegistry.getItem(activeItem.id);
            if (itemDef && itemDef.emoji) ghostEmoji = itemDef.emoji;
          }
          ghost.textContent = ghostEmoji;

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
      var coords = _getGridCoordsFromEvent(e.clientX, e.clientY);
      if (!coords) return;

      var activeItemRef = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) ? GAMESTATE.getActiveItem() : null;

      // Box deployables: drag-to-place
      if (activeItemRef && activeItemRef.id && typeof GoneRogue !== 'undefined' && GoneRogue.isBoxDeployItem && GoneRogue.isBoxDeployItem(activeItemRef.id) && GoneRogue.placeBox) {
        var quality = 'common';
        if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
          var def = GoneRogueDataRegistry.getItem(activeItemRef.id);
          if (def && def.boxQuality) quality = def.boxQuality;
        }
        GoneRogue.placeBox(coords, activeItemRef.id, quality);
        _suppressNextClick = true;
        return;
      }

      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.useActiveItemAt === 'function') {
        GoneRogue.useActiveItemAt(coords.x, coords.y);
        _suppressNextClick = true;
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

      // Never steal WASD/arrow keys from text inputs (onboarding / callsign entry, etc.)
      try {
        var ae = document.activeElement;
        var t = e && e.target ? e.target : null;
        function isTypingEl(el) {
          if (!el) return false;
          var tag = (el.tagName || '').toLowerCase();
          if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
          if (el.isContentEditable) return true;
          return false;
        }
        if (isTypingEl(ae) || isTypingEl(t)) return;
      } catch (e0) {}

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

    // _cardContainer — Card fan popup (rogue-cards-mobile)
    // Fixed-position overlay at bottom of screen showing the player's
    // hand of cards. Toggled by the .hand-fan-toggle (🃏 CARDS) button
    // via _showCardFan(). CSS: position:fixed, bottom:20px, z-index:1000.
    // See _showCardFan() for full details and future retirement plan.
    _cardContainer = document.createElement('div');
    _cardContainer.id = 'rogue-cards-mobile';
    _cardContainer.className = 'rogue-cards-mobile';
    _cardContainer.style.display = 'none';

    // ─── REDUNDANT: _inventoryContainer (rogue-inventory-mobile) ─────
    // Inventory/equip grid popup. Rendered by showInventory().
    // REDUNDANT — equip flow is now handled by header equipped slot →
    // left-column action buttons and NCH → header. This popup
    // needlessly appears during NPC turn-in and quest key interactions
    // (called from inventory-management.js, locked-gate-system.js,
    // ui-controls.js). Should stay display:none. Has a minimize arrow
    // as safety valve during playtesting before full removal.
    // ─────────────────────────────────────────────────────────────────
    _inventoryContainer = document.createElement('div');
    _inventoryContainer.id = 'rogue-inventory-mobile';
    _inventoryContainer.className = 'rogue-inventory-mobile';
    _inventoryContainer.style.display = 'none';

    terminal.appendChild(_gridContainer);

    // Floor badge (micro overlay) — shows callsign + floor + tier
    _floorBadgeEl = document.createElement('div');
    _floorBadgeEl.id = 'rogue-floor-badge';
    _floorBadgeEl.className = 'rogue-floor-badge';

    var _initBadge = 'FLOOR 1';
    if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState) {
      var _ibps = TerminalCommandRouter.getPlayerState();
      if (_ibps.callsign) {
        var _ibAvatar = _ibps.avatarEmoji ? _ibps.avatarEmoji + ' ' : '';
        _initBadge = _ibAvatar + _ibps.callsign + ' · F1 · T' + (_ibps.completedTiers || 0);
      }
    }
    _floorBadgeEl.textContent = _initBadge;

    _gridContainer.appendChild(_floorBadgeEl);

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
  var _cameraState = {
    cx: 0,
    cy: 0,
    originXi: 0,
    originYi: 0,
    windowActive: false,
    inited: false
  };

  function _useCameraWindow(grid, viewW, viewH) {
    return grid.length > viewH || (grid[0] && grid[0].length > viewW);
  }

  function _renderWithCanvas(grid, player, enemies, items, breakables, projectiles, muzzleFlash, impactEffects, currencies, colorCycleTime, npcs) {
    // Prepare grid data for canvas renderer
    var canvasGrid = [];

    var viewW = _canvasRenderer ? (_canvasRenderer.width || 40) : 40;
    var viewH = _canvasRenderer ? (_canvasRenderer.height || 20) : 20;
    var cellSize = _canvasRenderer ? (_canvasRenderer.cellSize || 20) : 20;

    var cameraWindow = _useCameraWindow(grid, viewW, viewH);
    _cameraState.windowActive = cameraWindow;

    // Camera target in world cell coords (center player)
    var px = player ? (player.visualX !== undefined ? player.visualX : player.x) : 0;
    var py = player ? (player.visualY !== undefined ? player.visualY : player.y) : 0;

    var originXi = 0;
    var originYi = 0;
    var camOffsetPxX = 0;
    var camOffsetPxY = 0;

    if (cameraWindow) {
      if (!_cameraState.inited) {
        _cameraState.cx = px;
        _cameraState.cy = py;
        _cameraState.inited = true;
      }

      // Smooth the camera center (sub-tile)
      var lerp = 0.18;
      _cameraState.cx += (px - _cameraState.cx) * lerp;
      _cameraState.cy += (py - _cameraState.cy) * lerp;

      var originXf = _cameraState.cx - (viewW / 2);
      var originYf = _cameraState.cy - (viewH / 2);

      // Clamp to map bounds so camera never reveals void beyond grid edges
      var gridW = grid[0] ? grid[0].length : viewW;
      var gridH = grid.length;
      originXf = Math.max(0, Math.min(gridW - viewW, originXf));
      originYf = Math.max(0, Math.min(gridH - viewH, originYf));

      originXi = Math.floor(originXf);
      originYi = Math.floor(originYf);
      _cameraState.originXi = originXi;
      _cameraState.originYi = originYi;

      // Fractional offset used to smooth between tiles
      var fracX = originXf - originXi;
      var fracY = originYf - originYi;

      // Negative offset shifts the world opposite the camera drift
      camOffsetPxX = -fracX * cellSize;
      camOffsetPxY = -fracY * cellSize;
    } else {
      // Desktop/static viewport: do not pan into blank space
      _cameraState.originXi = 0;
      _cameraState.originYi = 0;
      _cameraState.cx = px;
      _cameraState.cy = py;
      _cameraState.inited = true;
    }

    // Sample the world grid into a viewport-sized grid
    for (var sy = 0; sy < viewH; sy++) {
      canvasGrid[sy] = [];
      for (var sx = 0; sx < viewW; sx++) {
        var wx = cameraWindow ? (originXi + sx) : sx;
        var wy = cameraWindow ? (originYi + sy) : sy;
        var tile = (grid[wy] && grid[wy][wx]) ? grid[wy][wx] : null;
        var cellData = {
          char: null,
          color: '#FFFFFF',
          bg: null,
          type: tile ? tile.type : 'empty'
        };

        // Get biome background color for this tile (gradient system)
        var biomeBg = null;
        if (typeof GoneRogue !== 'undefined' && GoneRogue.getBiomeBackgroundColor) {
          biomeBg = GoneRogue.getBiomeBackgroundColor(wx, wy);
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
            } else if (tile === '🚧') {
              // Locked gate — bright orange-gold background so playtesters spot it
              cellData.bg = '#3d2800';
              cellData.color = '#ffaa00';
              cellData.glow = '#ff8800'; // custom flag for canvas glow pass
            } else if (tile === '⁍') {
              // Ammo pickup — magenta per RESOURCE_COLOR_SYSTEM.md
              cellData.bg = '#2a0a2a';
              cellData.color = '#DA70D6';
              cellData.glow = '#DA70D6';
            } else if (tile === '💎') {
              // Gem / battery recharge — purple glow
              cellData.bg = '#1a0a2a';
              cellData.color = '#aa66ff';
              cellData.glow = '#8844cc';
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

        canvasGrid[sy][sx] = cellData;
      }
    }

    // Overlay ground effects onto the canvas grid (fire, water, oil, steam, etc.)
    if (typeof GroundEffects !== 'undefined' && typeof GroundEffects.getAllEffects === 'function') {
      var allGroundEffects = GroundEffects.getAllEffects();
      allGroundEffects.forEach(function(ge) {
        if (!ge || ge.x === undefined || ge.y === undefined) return;
        var gvx = ge.x - originXi;
        var gvy = ge.y - originYi;
        if (gvx < 0 || gvy < 0 || gvx >= viewW || gvy >= viewH) return;
        var cell = canvasGrid[gvy] && canvasGrid[gvy][gvx];
        if (!cell) return;
        // Get the visual definition for this ground type
        var def = GroundEffects.getDefinition ? GroundEffects.getDefinition(ge.type) : null;
        if (def) {
          // Use the emoji if available, otherwise the char
          cell.char = def.emoji || def.char || cell.char;
          cell.color = def.color || cell.color;
          // Tint the background slightly with the effect color for visibility
          if (def.color && def.color !== '#000000') {
            cell.bg = def.color.replace(')', ', 0.15)').replace('rgb', 'rgba');
            // If it's a hex color, darken it for background
            if (def.color.charAt(0) === '#') {
              var gr = parseInt(def.color.substr(1, 2), 16);
              var gg = parseInt(def.color.substr(3, 2), 16);
              var gb = parseInt(def.color.substr(5, 2), 16);
              cell.bg = 'rgb(' + Math.floor(gr * 0.2) + ',' + Math.floor(gg * 0.2) + ',' + Math.floor(gb * 0.2) + ')';
            }
          }
        }
      });
    }

    // Prepare entities array (enemies, breakables, currencies, items, projectiles)
    var entities = [];

    function _toViewX(wx) { return wx - originXi; }
    function _toViewY(wy) { return wy - originYi; }
    function _inView(vx, vy) { return vx >= 0 && vy >= 0 && vx < viewW && vy < viewH; }

    // Add enemies
    if (enemies) {
      enemies.forEach(function(enemy) {
        if (enemy.hp > 0) {
          var vx = _toViewX(enemy.x);
          var vy = _toViewY(enemy.y);
          if (!_inView(vx, vy)) return;

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
            x: vx,
            y: vy,
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
          var vx = _toViewX(breakable.x);
          var vy = _toViewY(breakable.y);
          if (!_inView(vx, vy)) return;
          entities.push({
            x: vx,
            y: vy,
            char: breakable.emoji || breakable.glyph || '📦',
            color: '#8B4513'
          });
        }
      });
    }

    // Add NPCs
    if (npcs && npcs.length) {
      npcs.forEach(function(npc) {
        var vx = _toViewX(npc.x);
        var vy = _toViewY(npc.y);
        if (!_inView(vx, vy)) return;
        entities.push({
          x: vx,
          y: vy,
          char: npc.emoji || '\uD83E\uDDD1',
          color: '#FFD700',
          isNpc: true
        });
      });
    }

    // Add all ground items from WorldItems (single source of truth)
    // Phase 5: Collectibles Rendering Standardization
    //   - Resource symbols (currency, ammo, batteries): symbol char + RESOURCE_COLOR + bob
    //   - Key ammo (tier 1 keys): 🗝 resource symbol at #FF8A3D + bob
    //   - Emoji collectibles (items, key items, quest keys, food): 0.6x scale + bob
    //   - Cards: 🂠 at 1.1x + bob
    //   - Interactive items: no bob, no scale change
    if (typeof WorldItems !== 'undefined') {
      WorldItems.getAllForRendering().forEach(function(item) {
        var vx = _toViewX(item.x);
        var vy = _toViewY(item.y);
        if (!_inView(vx, vy)) return;

        var char, color, scale = 1.0, bobEnabled = false, collectibleType = null;

        if (item._wt === 'currency') {
          // Resource symbol: Currency ¢
          char = item.glyph || '¢';
          color = '#FFFF00';
          collectibleType = 'resource';
          bobEnabled = true;
        } else if (item._wt === 'item') {
          if (item.type === 'gem') {
            // Resource symbol: Batteries ◈
            char = item.glyph || '◈';
            color = '#00FFA6';
            collectibleType = 'resource';
            bobEnabled = true;
          } else if (item.type === 'ammo') {
            // Resource symbol: Ammo ⁍
            char = item.glyph || item.emoji || '⁍';
            color = '#DA70D6';
            collectibleType = 'resource';
            bobEnabled = true;
          } else if (item.type === 'card' || (item.card && !item.type)) {
            // Card: 🂠 at 1.1x scale
            char = '🂠';
            color = '#800080';
            scale = 1.1;
            collectibleType = 'card';
            bobEnabled = true;
          } else if (item.type === 'key') {
            // Keys: classify by tier for render treatment
            var keyTier = item.tier || 1;
            if (!item.tier && typeof KeyLootGen !== 'undefined' && KeyLootGen.getKeyTier) {
              keyTier = KeyLootGen.getKeyTier(item.keyType || '');
            }
            if (keyTier === 1) {
              // Key ammo (tier 1) — resource symbol
              char = '🗝';
              color = '#FF8A3D';
              collectibleType = 'resource';
            } else if (keyTier >= 3 || item.subtype === 'quest') {
              // Quest key (tier 3) — emoji collectible
              char = item.emoji || '🗝';
              color = '#FF4444';
              scale = 0.6;
              collectibleType = 'emoji';
            } else {
              // Key item (tier 2) — emoji collectible
              char = item.emoji || '🗝';
              color = '#FFD700';
              scale = 0.6;
              collectibleType = 'emoji';
            }
            bobEnabled = true;
          } else if (item.type === 'food') {
            // Food — emoji collectible at 0.6x
            char = item.emoji || '🍖';
            color = item.resourceColor || '#FF6B9D';
            scale = 0.6;
            collectibleType = 'emoji';
            bobEnabled = true;
          } else {
            // Generic item (charms, equipment, etc.) — emoji collectible at 0.6x
            char = item.glyph || item.emoji || '💎';
            color = item.resourceColor || '#00FFFF';
            scale = 0.6;
            collectibleType = 'emoji';
            bobEnabled = true;
          }
        } else if (item._wt === 'interactive') {
          // Interactive items: classify by type
          if (item.type === 'FOOD') {
            // Food items — emoji collectible at 0.6x + bob
            char = item.emoji || '🍖';
            color = item.customData && item.customData.resourceColor ? item.customData.resourceColor : '#FF6B9D';
            scale = 0.6;
            collectibleType = 'emoji';
            bobEnabled = true;
          } else {
            // Interactive-only items (buttons, levers, ropes, monitors) — pulse instead of bob
            char = item.emoji;
            color = '#00FFFF';
            // No bob — pulse animation will be added separately
          }
        } else {
          // Fallback for unknown types
          char = item.emoji || item.glyph || '?';
          color = '#FFFFFF';
        }

        entities.push({
          x: vx, y: vy, char: char, color: color,
          scale: scale, bobEnabled: bobEnabled, pulseEnabled: !bobEnabled && item._wt === 'interactive', collectibleType: collectibleType
        });
      });
    } else {
      // Fallback when WorldItems is unavailable (mirrors Phase 5 classification above)
      if (currencies) {
        currencies.forEach(function(currency) {
          if (currency.collected) return;
          var vx = _toViewX(currency.x);
          var vy = _toViewY(currency.y);
          if (!_inView(vx, vy)) return;
          entities.push({ x: vx, y: vy, char: currency.glyph || '¢', color: '#FFFF00',
            scale: 1.0, bobEnabled: true, collectibleType: 'resource' });
        });
      }
      if (items) {
        items.forEach(function(item) {
          var vx = _toViewX(item.x);
          var vy = _toViewY(item.y);
          if (!_inView(vx, vy)) return;
          var char, color, scale = 1.0, bobEnabled = true, collectibleType = 'resource';
          if (item.type === 'gem') {
            char = item.glyph || '◈';
            color = '#00FFA6';
          } else if (item.type === 'ammo') {
            char = item.glyph || item.emoji || '⁍';
            color = '#DA70D6';
          } else if (item.type === 'card' || (item.card && !item.type)) {
            char = '🂠';
            color = '#800080';
            scale = 1.1;
            collectibleType = 'card';
          } else if (item.type === 'key') {
            var kTier = item.tier || 1;
            if (!item.tier && typeof KeyLootGen !== 'undefined' && KeyLootGen.getKeyTier) {
              kTier = KeyLootGen.getKeyTier(item.keyType || '');
            }
            if (kTier === 1) {
              char = '🗝'; color = '#FF8A3D';
            } else if (kTier >= 3 || item.subtype === 'quest') {
              char = item.emoji || '🗝'; color = '#FF4444'; scale = 0.6; collectibleType = 'emoji';
            } else {
              char = item.emoji || '🗝'; color = '#FFD700'; scale = 0.6; collectibleType = 'emoji';
            }
          } else if (item.type === 'food') {
            char = item.emoji || '🍖'; color = item.resourceColor || '#FF6B9D';
            scale = 0.6; collectibleType = 'emoji';
          } else {
            char = item.glyph || item.emoji || '💎';
            color = item.resourceColor || '#00FFFF';
            scale = 0.6; collectibleType = 'emoji';
          }
          entities.push({ x: vx, y: vy, char: char, color: color,
            scale: scale, bobEnabled: bobEnabled, collectibleType: collectibleType });
        });
      }
    }

    // Add placed boxes
    if (typeof GoneRogue !== 'undefined' && GoneRogue.getPlacedBoxes) {
      var placedBoxes = GoneRogue.getPlacedBoxes();
      placedBoxes.forEach(function(box) {
        var vx = _toViewX(box.x);
        var vy = _toViewY(box.y);
        if (!_inView(vx, vy)) return;
        entities.push({
          x: vx,
          y: vy,
          char: '📦',
          color: box.state === 'occupied' ? '#FFD700' : '#8B6914'
        });
      });
    }

    // Add projectiles
    if (projectiles) {
      projectiles.forEach(function(projectile) {
        var pX = projectile.fx !== undefined ? projectile.fx : projectile.x;
        var pY = projectile.fy !== undefined ? projectile.fy : projectile.y;
        var vx = _toViewX(pX);
        var vy = _toViewY(pY);
        // Round for culling check only
        if (!_inView(Math.round(vx), Math.round(vy))) return;
        entities.push({
          x: vx,
          y: vy,
          char: projectile.emoji || projectile.glyph || '💥',
          color: '#FF00FF'
        });
      });
    }

    // Prepare effects array
    var effects = [];

    // OverheadAnimator (canvas path): render overhead emojis/text as effects
    if (typeof OverheadAnimator !== 'undefined' && typeof OverheadAnimator.getAllAnimations === 'function') {
      try {
        var currentTime = Date.now();
        OverheadAnimator.update(currentTime);
        var animations = OverheadAnimator.getAllAnimations();
        for (var akey in animations) {
          var parts = akey.split(',');
          var ax = parseInt(parts[0]);
          var ay = parseInt(parts[1]);
          var anim = animations[akey];

          var vx = _toViewX(ax);
          var vy = _toViewY(ay);
          if (!_inView(vx, vy)) continue;

          var list = Array.isArray(anim) ? anim : [anim];
          var stackCountMb = list.length;
          for (var li = 0; li < stackCountMb; li++) {
            var a1 = list[li];
            if (!a1) continue;

            var t = (typeof OverheadAnimator.calculateAnimationTransform === 'function')
              ? OverheadAnimator.calculateAnimationTransform(a1, currentTime)
              : { x: 0, y: -12, opacity: 1, scale: 1 };

            // Convert pixel offset to cell offset
            var dyCells = (t.y || 0) / cellSize;
            var dxCells = (t.x || 0) / cellSize;

            effects.push({
              x: vx + dxCells,
              y: vy - 0.6 + dyCells, // Stack offset handled by calculateAnimationTransform
              char: a1.text || a1.emoji,
              color: a1.color || '#FFFFFF',
              glow: true,
              alpha: (t.opacity !== undefined ? t.opacity : 1)
            });
          }
        }
      } catch (e0) {}
    }

    // Add muzzle flash
    if (muzzleFlash) {
      var mvx = _toViewX(muzzleFlash.x);
      var mvy = _toViewY(muzzleFlash.y);
      if (_inView(mvx, mvy)) {
        effects.push({
          x: mvx,
          y: mvy,
          char: '💥',
        color: '#FFFF00',
        glow: true,
          alpha: 0.8
        });
      }
    }

    // Add impact effects
    if (impactEffects) {
      impactEffects.forEach(function(impact) {
        var impactChar = (impact && impact.char) ? impact.char : '💥';
        var impactColor = '#FFFFFF';

        if (impact.type === 'enemy') {
          impactColor = '#FF0000';
        } else if (impact.type === 'breakable') {
          impactColor = '#FFA500';
        } else if (impact.type === 'wall') {
          impactColor = '#808080';
        } else if (impact.type === 'poof') {
          impactColor = 'rgba(191, 255, 227, 0.95)';
        }

        var ivx = _toViewX(impact.x);
        var ivy = _toViewY(impact.y);
        if (!_inView(ivx, ivy)) return;

        effects.push({
          x: ivx,
          y: ivy,
          char: impactChar,
          color: impactColor,
          glow: true,
          alpha: 0.9
        });
      });
    }

    // Smooth visual player position (tile->float) for nicer feel.
    // IMPORTANT: do this BEFORE rendering so the player glyph itself glides.
    // Phase 1: when GoneRogueMovement is active, player.visualX/Y are already
    // sub-tile positions — use them directly to prevent double-interpolation
    // and the resulting snap/lurch on each tile boundary.
    if (player) {
      if (player.visualX !== undefined && player.visualY !== undefined) {
        // GoneRogueMovement already provided smooth sub-tile positions.
        _playerVisual.x = player.visualX;
        _playerVisual.y = player.visualY;
        _playerVisual.inited = true;
      } else if (!_playerVisual.inited) {
        _playerVisual.x = player.x;
        _playerVisual.y = player.y;
        _playerVisual.inited = true;
      } else {
        var pvA = 0.35;
        _playerVisual.x += (player.x - _playerVisual.x) * pvA;
        _playerVisual.y += (player.y - _playerVisual.y) * pvA;
      }
      player = Object.assign({}, player, { visualX: _playerVisual.x, visualY: _playerVisual.y });
    }

    // Render using canvas renderer
    _canvasRenderer.renderGrid({
      grid: canvasGrid,
      camera: { zoom: 1, offsetX: camOffsetPxX, offsetY: camOffsetPxY, worldOriginX: originXi, worldOriginY: originYi },
      entities: entities,
      effects: effects,
      player: player ? (function() {
        var playerChar = (typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent || '')) ? '@' : '🥷';

        // Use selected avatar emoji from character creation (if available)
        if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState) {
          var _ps = TerminalCommandRouter.getPlayerState();
          if (_ps.avatarEmoji) playerChar = _ps.avatarEmoji;
        }

        // Passive items can override avatar (highest priority — e.g. costume items)
        if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getPlayerAvatarOverride) {
          var avatarOverride = PassiveItemsSystem.getPlayerAvatarOverride();
          if (avatarOverride && (typeof avatarOverride === 'string')) {
            playerChar = avatarOverride;
          } else if (avatarOverride && typeof avatarOverride.char === 'string') {
            playerChar = avatarOverride.char;
          }
        }

        return {
          x: _toViewX(player.visualX !== undefined ? player.visualX : player.x),
          y: _toViewY(player.visualY !== undefined ? player.visualY : player.y),
          char: playerChar,
          color: '#00FF00'
        };
      })() : null
    });

    // Render sprint trails on canvas
    if (typeof SprintTrailSystem !== 'undefined' && _canvasRenderer && _canvasRenderer.getContext) {
      var cellWidth = _canvasRenderer.getCellWidth ? _canvasRenderer.getCellWidth() : 32;
      var cellHeight = _canvasRenderer.getCellHeight ? _canvasRenderer.getCellHeight() : 32;
      SprintTrailSystem.renderToCanvas(_canvasRenderer.getContext(), cellWidth, cellHeight);
    }

    // Mobile-only: zoomed-in viewport that pans by translating the canvas element under a fixed frame.
    _applyMobileCanvasFollow(player, viewW, viewH, cellSize);
  }

  function _applyMobileCanvasFollow(player, viewW, viewH, cellSize) {
    if (!_canvasRenderer || !player) return;

    // Base zoom: lower on desktop, higher on mobile portrait
    var z = 1.2;
    try {
      if (window.matchMedia && window.matchMedia('(max-width: 700px) and (orientation: portrait)').matches) {
        z = 1.5;
      }
    } catch (e0) {}

    var canvas = _canvasRenderer.getCanvas();
    if (!canvas || !_gridContainer) return;
    if (!_followState) {
      _followState = { tx: 0, ty: 0, inited: false };
    }

    var contRect = _gridContainer.getBoundingClientRect();
    var canvasW = viewW * cellSize;
    var canvasH = viewH * cellSize;

    // Ensure the scaled canvas always covers the visible frame.
    // This prevents "gutters" when the terminal/frame is larger than the
    // default zoomed canvas. We intentionally OVERFILL so panning still works.
    // (Browser zoom Ctrl++ scales everything uniformly; this is about filling
    // the container at whatever zoom the user is already at.)
    var coverZ = Math.max(contRect.width / canvasW, contRect.height / canvasH);
    if (isFinite(coverZ) && coverZ > z) z = coverZ;
    // Safety cap to avoid absurd scales on ultrawide terminals.
    if (z > 3.0) z = 3.0;

    // Player center in canvas pixel coords (unscaled)
    var px = ((player.visualX !== undefined ? player.visualX : player.x) + 0.5) * cellSize;
    var py = ((player.visualY !== undefined ? player.visualY : player.y) + 0.5) * cellSize;

    // Compute translate in unscaled units (because we apply scale() first)
    var tx = (contRect.width / (2 * z)) - px;
    var ty = (contRect.height / (2 * z)) - py;

    // Clamp so we never reveal void beyond map bounds
    var minTx = (contRect.width / z) - canvasW;
    var minTy = (contRect.height / z) - canvasH;
    tx = Math.max(minTx, Math.min(0, tx));
    ty = Math.max(minTy, Math.min(0, ty));

    // Smooth camera
    var a = 0.22;
    if (!_followState.inited) {
      _followState.tx = tx;
      _followState.ty = ty;
      _followState.inited = true;
    } else {
      _followState.tx += (tx - _followState.tx) * a;
      _followState.ty += (ty - _followState.ty) * a;
    }

    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = 'scale(' + z + ') translate(' + _followState.tx + 'px, ' + _followState.ty + 'px)';
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

    // Update floor badge with player identity + floor
    try {
      if (_floorBadgeEl) {
        var _floorNum = '';
        if (typeof GoneRogue !== 'undefined' && GoneRogue.getFloor) {
          _floorNum = GoneRogue.getFloor();
        } else if (typeof GoneRogue !== 'undefined' && GoneRogue.getStrCombatState) {
          var st = GoneRogue.getStrCombatState();
          if (st && typeof st.floor === 'number') _floorNum = st.floor;
        }

        // Build badge text: "AVATAR CALLSIGN · F5 · T2"
        var badgeText = 'FLOOR ' + _floorNum;
        if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState) {
          var _bps = TerminalCommandRouter.getPlayerState();
          if (_bps.callsign) {
            var _bAvatar = _bps.avatarEmoji ? _bps.avatarEmoji + ' ' : '';
            badgeText = _bAvatar + _bps.callsign + ' · F' + _floorNum + ' · T' + (_bps.completedTiers || 0);
          }
        }

        _floorBadgeEl.textContent = badgeText;
      }
    } catch (e0) {}

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
      _renderWithCanvas(grid, player, enemies, items, breakables, projectiles, muzzleFlash, impactEffects, currencies, colorCycleTime, npcs);
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
          var basePlayerChar = (typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent || '')) ? '@' : '🥷';

          // Use selected avatar emoji from character creation
          if (typeof TerminalCommandRouter !== 'undefined' && TerminalCommandRouter.getPlayerState) {
            var _gps = TerminalCommandRouter.getPlayerState();
            if (_gps.avatarEmoji) basePlayerChar = _gps.avatarEmoji;
          }

          cell.textContent = basePlayerChar;
          cell.classList.add('cell-player');

          // Passive items override avatar (highest priority)
          if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getPlayerAvatarOverride) {
            try {
              var av = PassiveItemsSystem.getPlayerAvatarOverride();
              if (av && typeof av === 'string') {
                cell.textContent = av;
              } else if (av && typeof av.char === 'string') {
                cell.textContent = av.char;
              }
            } catch (err) {}
          }

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
            if (breakable.explosive) {
              cell.classList.add('cell-explosive-idle');
            }
            // Kick wobble animation (300ms window)
            if (breakable.kickTime && (Date.now() - breakable.kickTime) < 300) {
              cell.classList.add(breakable.kickPushed ? 'cell-kick-pushed' : 'cell-kick-wobble');
            }
          } else {
            var dGlyph = breakable.destroyedGlyph || '░';
            cell.textContent = dGlyph;
            // Only apply broken-debris styling for actual debris tiles, not clean floor
            if (dGlyph !== '.') {
              cell.classList.add('cell-breakable-broken');
            }
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

        if (!cell) continue;

        var list = Array.isArray(anim) ? anim : [anim];
        for (var li = 0; li < list.length; li++) {
          var a1 = list[li];
          if (!a1) continue;
          var transform = OverheadAnimator.calculateAnimationTransform(a1, currentTime);

          // Create animation element
          var animEl = document.createElement('div');
          animEl.className = 'overhead-animation ' + a1.type.toLowerCase().replace(/_/g, '-');
          animEl.textContent = a1.text || a1.emoji;
          animEl.style.color = a1.color;
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
    console.log('[ProcessGridInput] x=' + x + ' y=' + y + ' runMode=' + runMode);
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

        // Minimize debrief chrome (but do NOT change which section the player was inspecting).
        // Goal: bring essential resources into view without trampling the user's current debrief context.
        try {
          var body = document.body;
          if (body) {
            body.classList.remove('rogue-debrief-expanded');
            // Nudge debrief width smaller for focus mode; don't persist to localStorage.
            body.style.setProperty('--rogue-debrief-pct', '28%');
          }
        } catch (e1) {}

        // Collapse debrief window if expanded (legacy/global expanded class)
        var debriefWindow = document.getElementById('debrief-window');
        if (debriefWindow) {
          try { debriefWindow.classList.remove('expanded'); } catch (e2) {}
        }

        // Scroll resources container toward top so HP bar is visible again.
        try {
          var content = document.getElementById('debrief-feed-content');
          if (content && typeof content.scrollTo === 'function') {
            content.scrollTo({ top: 0, behavior: 'smooth' });
          } else if (content) {
            content.scrollTop = 0;
          }
        } catch (e3) {}

        // Reset NCH capsule to its default bottom-right position
        if (typeof NonCombatHUD !== 'undefined' && typeof NonCombatHUD.resetCapsulePosition === 'function') {
          NonCombatHUD.resetCapsulePosition();
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
            // Auto-pickup items (food and other autoPickup collectibles) are collected by walking over them — let movement proceed
            if (!item.autoPickup) {
              GoneRogue.process('interact');
              _lastMovementTime = now; // Track as movement-like action
              return;
            }
          }
        }
      }
    }

    // Click-on-NPC: adjacent tap triggers interact (quest turn-in, dialogue, etc.)
    if (typeof GoneRogue !== 'undefined' && player) {
      var npcs = GoneRogue.getNpcs ? GoneRogue.getNpcs() : [];
      if (npcs && npcs.length) {
        for (var ni = 0; ni < npcs.length; ni++) {
          var npc = npcs[ni];
          if (npc && npc.x === x && npc.y === y) {
            var ndx = x - player.x;
            var ndy = y - player.y;
            if (Math.abs(ndx) <= 1 && Math.abs(ndy) <= 1) {
              console.log('[ProcessGridInput] Adjacent NPC tap: ' + (npc.name || npc.id) + ' at ' + x + ',' + y);
              GoneRogue.process('interact');
              _lastMovementTime = Date.now();
              return;
            }
          }
        }
      }
    }

    // Click-on-enemy: adjacent tap triggers steal (Phase 4), ranged tap fires projectile.
    if (typeof GoneRogue !== 'undefined') {
      var enemies = GoneRogue.getEnemies ? GoneRogue.getEnemies() : [];
      if (enemies && enemies.length) {
        for (var i = 0; i < enemies.length; i++) {
          var en = enemies[i];
          if (en && en.hp > 0 && en.x === x && en.y === y) {
            if (player) {
              var edx = x - player.x;
              var edy = y - player.y;
              var eDist = Math.abs(edx) + Math.abs(edy);
              // Phase 4: adjacent enemy tap (Manhattan dist ≤ 1) → attempt steal.
              // Ranged enemy tap fires projectile as before.
              if (eDist <= 1 && GoneRogue.process) {
                GoneRogue.process('steal');
                _lastMovementTime = Date.now();
                return;
              }
            }
            if (typeof GoneRogue.fireProjectileAtTarget === 'function') {
              GoneRogue.fireProjectileAtTarget(x, y);
              _lastMovementTime = Date.now();
              return;
            }
          }
        }
      }
    }

    // Click-on-breakable from range: fire projectile at breakable (noise tradeoff)
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.fireProjectileAtTarget === 'function') {
      var breakables = GoneRogue.getBreakables ? GoneRogue.getBreakables() : [];
      if (breakables && breakables.length) {
        for (var bi = 0; bi < breakables.length; bi++) {
          var br = breakables[bi];
          if (br && br.hp > 0 && br.x === x && br.y === y) {
            // If adjacent, handleTapMove will kick it. Only shoot from range (distance > 1).
            if (player) {
              var bdx = x - player.x;
              var bdy = y - player.y;
              if (Math.abs(bdx) > 1 || Math.abs(bdy) > 1) {
                GoneRogue.fireProjectileAtTarget(x, y);
                _lastMovementTime = Date.now();
                return;
              }
            }
          }
        }
      }
    }

    // Send tap-to-move command and track movement time
    console.log('[ProcessGridInput] Reached handleTapMove dispatch. GoneRogue=' + (typeof GoneRogue) + ' handleTapMove=' + (typeof GoneRogue !== 'undefined' ? typeof GoneRogue.handleTapMove : 'N/A'));
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
    // Pinch-to-zoom + drag-pan is DISABLED on mobile.
    // The mobile camera follow already applies a controlled transform to the canvas.
    if (e.touches && e.touches.length >= 2) {
      try { e.preventDefault(); } catch (e0) {}
      try { e.stopPropagation(); } catch (e1) {}

      // Cancel fishing mode if active
      if (_fishingActive) {
        _hideFishingPath();
        _fishingActive = false;
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

        // Phase 5: sprint via rapid fishing drag — fast initial drag activates sprint.
        if (_fishingStart.time) {
          var elapsed = Date.now() - _fishingStart.time;
          if (elapsed > 0) {
            var dragSpeed = distance / elapsed; // pixels per millisecond
            var canSprint = typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.canSprint === 'function'
              ? GAMESTATE.canSprint()
              : true;
            if (dragSpeed >= FISHING_SPRINT_DRAG_SPEED && canSprint) {
              _runMode = true;
            }
          }
        }
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

      // Account for CSS scaling (canvas internal pixels may not match rect)
      var scaleX = rect.width ? (_canvasRenderer.getCanvas().width / rect.width) : 1;
      var scaleY = rect.height ? (_canvasRenderer.getCanvas().height / rect.height) : 1;
      canvasX *= scaleX;
      canvasY *= scaleY;

      // Convert to grid coordinates
      var gridCoords = _canvasRenderer.canvasToGrid(canvasX, canvasY);
      if (!gridCoords) return null;
      // Camera-window rendering: input coords are in viewport space; map back into world space.
      var ox = (_cameraState.windowActive ? (_cameraState.originXi || 0) : 0);
      var oy = (_cameraState.windowActive ? (_cameraState.originYi || 0) : 0);
      return {
        x: gridCoords.x + ox,
        y: gridCoords.y + oy
      };
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
    // Ensure absolute overlay is positioned relative to the grid container
    if (_gridContainer && !_gridContainer.style.position) {
      _gridContainer.style.position = 'relative';
    }

    // Align overlay to the canvas region (canvas may not fill the container)
    var gridRect = _gridContainer.getBoundingClientRect();
    var canvasRect = null;
    try {
      if (_canvasRenderer && _canvasRenderer.getCanvas) {
        canvasRect = _canvasRenderer.getCanvas().getBoundingClientRect();
      }
    } catch (e0) {}

    if (canvasRect) {
      _fishingPathOverlay.style.left = (canvasRect.left - gridRect.left) + 'px';
      _fishingPathOverlay.style.top = (canvasRect.top - gridRect.top) + 'px';
      _fishingPathOverlay.style.width = canvasRect.width + 'px';
      _fishingPathOverlay.style.height = canvasRect.height + 'px';
    } else {
      _fishingPathOverlay.style.top = '0';
      _fishingPathOverlay.style.left = '0';
      _fishingPathOverlay.style.width = '100%';
      _fishingPathOverlay.style.height = '100%';
    }
    _fishingPathOverlay.style.pointerEvents = 'none';
    _fishingPathOverlay.style.zIndex = '1000';

    // Draw path using SVG
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.position = 'absolute';

    // Calculate cell size (prefer renderer dims; canvas may be scaled)
    var viewW = (_canvasRenderer && _canvasRenderer.width) ? _canvasRenderer.width : 40;
    var viewH = (_canvasRenderer && _canvasRenderer.height) ? _canvasRenderer.height : 20;
    var pxW = (canvasRect && canvasRect.width) ? canvasRect.width : _gridContainer.getBoundingClientRect().width;
    var pxH = (canvasRect && canvasRect.height) ? canvasRect.height : _gridContainer.getBoundingClientRect().height;
    var cellWidth = pxW / viewW;
    var cellHeight = pxH / viewH;

    // Camera-window rendering: path is in WORLD coords; convert to VIEW coords.
    var originXi = (_canvasRenderer && _cameraState && _cameraState.windowActive && isFinite(_cameraState.originXi)) ? _cameraState.originXi : 0;
    var originYi = (_canvasRenderer && _cameraState && _cameraState.windowActive && isFinite(_cameraState.originYi)) ? _cameraState.originYi : 0;
    function _toView(pt) {
      return { x: pt.x - originXi, y: pt.y - originYi };
    }

    // Ensure path originates at player tile (some path outputs omit start)
    try {
      if (_canvasRenderer && typeof GoneRogue !== 'undefined' && GoneRogue.getPlayer && path && path.length) {
        var p = GoneRogue.getPlayer();
        if (p && (path[0].x !== p.x || path[0].y !== p.y)) {
          path = [{ x: p.x, y: p.y }].concat(path);
        }
      }
    } catch (e0) {}

    // Draw path segments
    for (var i = 0; i < path.length - 1; i++) {
      var from = _toView(path[i]);
      var to = _toView(path[i + 1]);

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
      var endpoint = _toView(path[path.length - 1]);
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

    // Pinch-to-zoom is disabled; ignore 2-finger gesture and do not enter pinch mode.
    if (e.touches.length >= 2) {
      _initialPinchDistance = 0;
      _initialPinchCenter = { x: 0, y: 0 };
      _isPanning = false;
      return; // Don't process as tap
    }

    var touch = e.touches[0];
    var coords = _getGridCoordsFromEvent(touch.clientX, touch.clientY);

    if (!coords) return;

    var now = Date.now();
    var cellKey = coords.x + ',' + coords.y;

    // Initialize fishing state (Phase 5: include timestamp for sprint-via-drag detection)
    _fishingStart = { x: touch.clientX, y: touch.clientY, gridX: coords.x, gridY: coords.y, time: now };
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
    console.log('[GridTouchEnd] fired. fishingActive=' + _fishingActive + ' pathLen=' + _fishingPath.length);
    e.preventDefault();
    e.stopPropagation();

    // Pinch-to-zoom is disabled; ignore pinch bookkeeping if any legacy state exists.
    if (_initialPinchDistance > 0) {
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
      // Fishing completed — execute path and suppress the follow-up click
      _hideFishingPath();
      _desktopFishingActive = false;
      _suppressNextClick = true;
      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleFishingMove === 'function') {
        GoneRogue.handleFishingMove(_fishingPath, _runMode);
      } else {
        var destination = _fishingPath[_fishingPath.length - 1];
        _processGridInput(destination.x, destination.y, _runMode);
      }
      _fishingPath = [];
    } else {
      // Drag didn't reach fishing threshold — clean up fishing state
      // but do NOT suppress the upcoming click event, so it falls through
      // to _handleGridClick → _processGridInput for tap-to-move
      _desktopFishingActive = false;
      _fishingPath = [];
      _hideFishingPath();
      // Deliberately NOT setting _suppressNextClick here
    }
  }

  /**
   * Handle grid click/tap
   */
  function _handleGridClick(e) {
    console.log('[GridClick] fired. suppressNextClick=' + _suppressNextClick + ' pointerType=' + (e.pointerType || 'click'));
    if (_suppressNextClick) {
      _suppressNextClick = false;
      console.log('[GridClick] Suppressed by fishing.');
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
   * Show card fan popup (rogue-cards-mobile).
   *
   * Card fan overlay — renders loose-inventory cards as swipeable tiles
   * in a fixed-position bar at the bottom of the screen.
   * Element: <div id="rogue-cards-mobile" class="rogue-cards-mobile">
   * CSS: position:fixed, bottom:20px, z-index:1000 (gone-rogue-mobile.css).
   *
   * Triggered by: 🃏 CARDS button in MOK footer (_setupHandFanButton),
   * pagination cycling, and card selection toggles.
   *
   * Related but separate card UIs:
   *   • NCH Zone 1 (hand) — NonCombatHUD._renderHand() in non-combat-hud.js
   *   • Left-column "Cards" view — rogue-sidebar.js
   *
   * TODO: Once NCH Zone 1 fully replaces this popup for all card
   * interactions (play, swipe, multi-select in STR combat), this function
   * and the _cardContainer element can be retired.
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

    // Execute multi-card combat round (prefer id-based hand play so BLVCK/fallback
    // and affordability logic stay consistent across desktop/mobile).
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.playCardsFromHand === 'function') {
      var loose = null;
      try {
        if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getLooseInventory === 'function') {
          loose = GAMESTATE.getLooseInventory();
        }
      } catch (e0) {}

      var ids = [];
      for (var i = 0; i < _selectedCards.length; i++) {
        var idx = _selectedCards[i];
        var c = (loose && loose[idx]) ? loose[idx] : null;
        if (c && c.id) ids.push(c.id);
      }

      GoneRogue.playCardsFromHand(ids);

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
    if (_gridContainer) {
      _gridContainer.style.display = 'none';
      _gridContainer.style.transform = '';
      _gridContainer.style.transformOrigin = '';
    }
    if (_cardContainer) _cardContainer.style.display = 'none';

    _currentZoom = 1.0;
    _panOffset = { x: 0, y: 0 };
    _followState = null;
    _playerVisual.inited = false;
    _initialPinchDistance = 0;
    _initialPinchCenter = { x: 0, y: 0 };
    _isPanning = false;

    _cameraState.inited = false;
    _cameraState.windowActive = false;
    _cameraState.originXi = 0;
    _cameraState.originYi = 0;
  }

  /**
   * Show mobile UI
   */
  function show() {
    if (_gridContainer) {
      _gridContainer.style.display = 'grid';
      // Reset any pinch-zoom/pan transforms so the viewport isn't stuck on a corner
      _gridContainer.style.transform = '';
      _gridContainer.style.transformOrigin = '';
    }

    _currentZoom = 1.0;
    _panOffset = { x: 0, y: 0 };
    _followState = null;
    _playerVisual.inited = false;
    _initialPinchDistance = 0;
    _initialPinchCenter = { x: 0, y: 0 };
    _isPanning = false;

    // Reset camera so it recenters immediately on first frame after show
    _cameraState.inited = false;
    _cameraState.windowActive = false;
    _cameraState.originXi = 0;
    _cameraState.originYi = 0;
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

  // ─── REDUNDANT: showInventory() ────────────────────────────────────
  // Renders into _inventoryContainer (id="rogue-inventory-mobile").
  // This equip grid is REDUNDANT — item equipping is now handled by
  // header → left-column and NCH → header flows. This function still
  // gets called from inventory-management.js, locked-gate-system.js,
  // ui-controls.js, and internal equip handlers during NPC/quest
  // interactions. Slated for removal once all callers are updated.
  // ─────────────────────────────────────────────────────────────────
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

    // Minimize arrow — safety valve to dismiss this redundant popup
    var minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'rogue-inventory-minimize';
    minimizeBtn.textContent = '\u25BE'; // ▾
    minimizeBtn.title = 'Minimize';
    minimizeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      _inventoryContainer.style.display = 'none';
    });
    _inventoryContainer.appendChild(minimizeBtn);

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

      // SharedItemRenderer resolves item with full fallback + meta override chain
      var resolved = (typeof SharedItemRenderer !== 'undefined')
        ? SharedItemRenderer.resolve(itemRef)
        : { emoji: '📦', name: itemRef.id };
      var displayName = resolved.name;
      var displayEmoji = resolved.emoji;

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

        // SharedItemRenderer resolves card with full fallback chain
        var cardResolved = (typeof SharedItemRenderer !== 'undefined')
          ? SharedItemRenderer.resolve(cardRef)
          : { emoji: '🃏', name: cardRef.id, def: null };
        var card = cardResolved.def || { name: cardResolved.name, emoji: cardResolved.emoji };
        var cEmoji = cardResolved.emoji;
        var cName = cardResolved.name;

        var emojiSpan2 = document.createElement('span');
        emojiSpan2.className = 'item-emoji';
        emojiSpan2.textContent = cEmoji;

        var nameSpan2 = document.createElement('span');
        nameSpan2.className = 'item-name';
        // Quantity badges are handled elsewhere; here we show a duping cue if the active item is toggled.
        var cue = '';
        try {
          if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem && typeof GoneRogueDataRegistry !== 'undefined') {
            var ar = GAMESTATE.getActiveItem();
            var ad = ar && ar.id && GoneRogueDataRegistry.getItem ? GoneRogueDataRegistry.getItem(ar.id) : null;
            var isPrinter = false;
            if (ad && Array.isArray(ad.effects)) {
              for (var ei = 0; ei < ad.effects.length; ei++) {
                if (ad.effects[ei] && ad.effects[ei].type === 'printer_3d') { isPrinter = true; break; }
              }
            }
            if (isPrinter && ar && ar.meta && ar.meta.toggled) {
              // Show a simple x2 cue for any ammo/battery cards
              var cd = (GoneRogueDataRegistry.getCard ? GoneRogueDataRegistry.getCard(cardRef.id) : null);
              var costs = cd && Array.isArray(cd.costs) ? cd.costs : [];
              for (var ci = 0; ci < costs.length; ci++) {
                var cst = costs[ci];
                if (cst && (cst.kind === 'ammo' || cst.kind === 'battery')) { cue = ' x2'; break; }
              }
            }
          }
        } catch (e0) {}
        nameSpan2.textContent = cName + cue;

        cardDiv.appendChild(emojiSpan2);
        cardDiv.appendChild(nameSpan2);

        // Drag handlers for cards (to non-combat hand)
        cardDiv.addEventListener('touchstart', _handleInventoryTouchStart, { passive: false });
        cardDiv.addEventListener('touchmove', _handleInventoryTouchMove, { passive: false });
        cardDiv.addEventListener('touchend', _handleInventoryTouchEnd, { passive: false });

        cardDiv.addEventListener('pointerdown', _handleInventoryPointerDown);
        cardDiv.addEventListener('click', function(e) {
          // Click-to-move card to non-combat hand (commit)
          try {
            var idx = parseInt(e.currentTarget.dataset.cardIndex, 10);
            var cards = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentCards) ? GAMESTATE.getPersistentCards() : [];
            var ref = cards[idx];
            if (!ref) return;

            var okAdd = false;
            if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addCardToHand === 'function') {
              okAdd = GAMESTATE.addCardToHand(ref.id, 1).success;
            }

            if (okAdd) {
              // Keep NonCombat selection UI in sync (optional)
              if (typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.setSelectedHandIndex) {
                try { NonCombatStateStore.setSelectedHandIndex(0); } catch (e3) {}
              }

              // Legacy event bus hooks
              if (typeof NonCombatEventBus !== 'undefined') {
                var remaining = 0;
                try {
                  var after = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentCards) ? GAMESTATE.getPersistentCards() : [];
                  for (var i = 0; i < after.length; i++) {
                    if (after[i] && after[i].id === ref.id) remaining = after[i].qty || 0;
                  }
                } catch (e2) {}

                NonCombatEventBus.emit('card:moved_to_hand', { cardId: ref.id, qty: 1, remainingInStash: remaining, source: 'click' });
              }

              if (typeof TooltipSystem !== 'undefined') {
                TooltipSystem.showAction('card-move', { name: ref.id });
              }
            } else {
              if (typeof NonCombatEventBus !== 'undefined') {
                NonCombatEventBus.emit('hand:add_failed', { cardId: ref.id, reason: 'insufficient_qty' });
              }
            }

            showInventory();
            return;

            // legacy NonCombatStateStore hand-mutation path removed (GAMESTATE is canonical)

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
            (activeSlot && activeSlot.contains(element)) ||
            (activeDisplay && activeDisplay.contains(element))) {
          droppedOnActiveSlot = true;
        }
      }

      if (droppedOnActiveSlot) {
        // Equip the item
        _equipItemToActiveSlot(_activeDragItem.item);
      } else {
        // Check if dropped on debrief feed (incineration) — mirrors pointer handler
        var debriefScreen = document.getElementById('debrief-screen');
        var droppedOnDebrief = false;
        if (element && debriefScreen) {
          if (element === debriefScreen || debriefScreen.contains(element)) {
            droppedOnDebrief = true;
          }
        }

        if (droppedOnDebrief) {
          var dragIndex = parseInt(_activeDragItem.element.dataset.index, 10);
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.removePersistentInventoryItem === 'function') {
            GAMESTATE.removePersistentInventoryItem(dragIndex);
          }
          if (debriefScreen) {
            debriefScreen.classList.add('incinerator-active');
            setTimeout(function() { debriefScreen.classList.remove('incinerator-active'); }, 600);
          }
          if (typeof DebriefFeedController !== 'undefined' && typeof DebriefFeedController.flashIncinerator === 'function') {
            DebriefFeedController.flashIncinerator({ kind: 'disposal', durationMs: 600 });
          }
          if (typeof TooltipSystem !== 'undefined') {
            TooltipSystem.show('\uD83D\uDD25 Item disposed', 2000);
          }
        }
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

        if (droppedOnHand) {
          var okRemove = true;
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.removePersistentCard === 'function') {
            okRemove = GAMESTATE.removePersistentCard(_activeDragItem.item.id, 1).success;
          }

          if (okRemove && typeof NonCombatStateStore !== 'undefined' && NonCombatStateStore.addCardToHand) {
            NonCombatStateStore.addCardToHand(_activeDragItem.item.id, 1, 'inventory:drag_move_card');

            if (typeof NonCombatEventBus !== 'undefined') {
              var remaining = 0;
              try {
                var after = (typeof GAMESTATE !== 'undefined' && GAMESTATE.getPersistentCards) ? GAMESTATE.getPersistentCards() : [];
                for (var i = 0; i < after.length; i++) {
                  if (after[i] && after[i].id === _activeDragItem.item.id) remaining = after[i].qty || 0;
                }
              } catch (e2) {}

              NonCombatEventBus.emit('card:moved_to_hand', { cardId: _activeDragItem.item.id, qty: 1, remainingInStash: remaining, source: 'drag' });
            }
          } else {
            if (typeof NonCombatEventBus !== 'undefined') {
              NonCombatEventBus.emit('hand:add_failed', { cardId: _activeDragItem.item.id, reason: 'insufficient_qty' });
            }
          }
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
            (activeSlot && activeSlot.contains(element)) ||
            (activeDisplay && activeDisplay.contains(element))) {
          droppedOnActiveSlot = true;
        }
      }

      if (droppedOnActiveSlot) {
        // Equip the item
        _equipItemToActiveSlot(_activeDragItem.item);
      } else {
        // Check if dropped on debrief feed (incineration)
        var debriefScreen = document.getElementById('debrief-screen');
        var droppedOnDebrief = false;
        if (element && debriefScreen) {
          if (element === debriefScreen || debriefScreen.contains(element)) {
            droppedOnDebrief = true;
          }
        }

        if (droppedOnDebrief) {
          // Remove from persistent inventory
          var dragIndex = parseInt(_activeDragItem.element.dataset.index, 10);
          if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.removePersistentInventoryItem === 'function') {
            GAMESTATE.removePersistentInventoryItem(dragIndex);
          }
          // Fire incinerator animation
          if (debriefScreen) {
            debriefScreen.classList.add('incinerator-active');
            setTimeout(function() { debriefScreen.classList.remove('incinerator-active'); }, 600);
          }
          if (typeof DebriefFeedController !== 'undefined' && typeof DebriefFeedController.flashIncinerator === 'function') {
            DebriefFeedController.flashIncinerator({ kind: 'disposal', durationMs: 600 });
          }
          // Tooltip
          if (typeof TooltipSystem !== 'undefined') {
            TooltipSystem.show('\uD83D\uDD25 Item disposed', 2000);
          }
        }
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

    // SharedItemRenderer resolves item with full fallback + meta override chain
    var resolved = (typeof SharedItemRenderer !== 'undefined')
      ? SharedItemRenderer.resolve(itemRef)
      : { emoji: '📦', name: itemRef.id, def: null };
    var item = resolved.def || { name: resolved.name, emoji: resolved.emoji };
    var displayName = resolved.name;
    var displayEmoji = resolved.emoji;

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

  // ── Controller hooks (QuadStick / Gamepad API) ────────────────────────────
  // These three functions expose the fishing drag-preview / commit behaviour to
  // external controller adapters without synthesising DOM pointer events.
  // All three are safe to call even when the Gone Rogue module is not loaded.

  /**
   * Controller hook – begin a fishing gesture anchored at the player's tile.
   *
   * Call this when the QuadStick (or other Gamepad-API adapter) starts an aim
   * gesture.  Resets any in-progress fishing state so a fresh preview can be
   * built with `updateFishingTarget`.
   *
   * No-op when GoneRogue is not loaded.
   */
  function beginFishingFromPlayer() {
    if (typeof GoneRogue === 'undefined') return;
    _hideFishingPath();
    _fishingPath = [];
    _fishingActive = true;
    _desktopFishingActive = false;
  }

  /**
   * Controller hook – update the fishing preview to a new grid tile.
   *
   * Computes a fresh A* path from the player to (x, y) and renders the path
   * overlay.  Call this repeatedly as the controller cursor moves.
   *
   * No-op when GoneRogue or GoneRogueMovement are not loaded.
   *
   * @param {number} x - Target grid X coordinate
   * @param {number} y - Target grid Y coordinate
   */
  function updateFishingTarget(x, y) {
    if (typeof GoneRogue === 'undefined' || typeof GoneRogueMovement === 'undefined') return;
    var player = GoneRogue.getPlayer ? GoneRogue.getPlayer() : null;
    if (!player) return;
    var collisionCheck = GoneRogue.isWalkable
      ? function(cx, cy) { return !GoneRogue.isWalkable(cx, cy); }
      : null;
    _fishingPath = GoneRogueMovement.findPath(player.x, player.y, x, y, collisionCheck);
    _showFishingPath(_fishingPath);
  }

  /**
   * Controller hook – commit movement along the current fishing path.
   *
   * Hides the path overlay and executes movement via the same path that the
   * touch/mouse handlers use (`GoneRogue.handleFishingMove` when available,
   * falling back to tap-to-move with the final destination).  If
   * `updateFishingTarget` was not called first the path is computed on-demand
   * from (x, y).
   *
   * No-op when GoneRogue is not loaded.
   *
   * @param {number} x - Target grid X coordinate
   * @param {number} y - Target grid Y coordinate
   */
  function commitFishingTarget(x, y) {
    if (typeof GoneRogue === 'undefined') return;

    // Compute path on demand if the caller skipped updateFishingTarget
    if (_fishingPath.length === 0 && typeof GoneRogueMovement !== 'undefined') {
      var player = GoneRogue.getPlayer ? GoneRogue.getPlayer() : null;
      if (player) {
        var collisionCheck = GoneRogue.isWalkable
          ? function(cx, cy) { return !GoneRogue.isWalkable(cx, cy); }
          : null;
        _fishingPath = GoneRogueMovement.findPath(player.x, player.y, x, y, collisionCheck);
      }
    }

    _hideFishingPath();
    _fishingActive = false;
    _desktopFishingActive = false;

    if (_fishingPath.length > 0) {
      if (typeof GoneRogue.handleFishingMove === 'function') {
        GoneRogue.handleFishingMove(_fishingPath, _runMode);
      } else {
        var destination = _fishingPath[_fishingPath.length - 1];
        _processGridInput(destination.x, destination.y, _runMode);
      }
    }

    _fishingPath = [];
  }

  /**
   * Controller hook – tap-to-move to a specific tile.
   *
   * Call this when the QuadStick (or other Gamepad-API adapter) triggers
   * a single-step move (e.g. Button A).  Routes through _processGridInput
   * so all target-type checks (enemy → shoot, breakable → kick/shoot,
   * interactive → interact, empty → move) are applied identically to a
   * touch-tap or mouse-click.
   *
   * No-op when GoneRogue is not loaded.
   *
   * @param {number} x - Target grid X coordinate
   * @param {number} y - Target grid Y coordinate
   */
  function controllerTapMove(x, y) {
    if (typeof GoneRogue === 'undefined') return;
    _processGridInput(x, y, _runMode);
  }

  /**
   * Controller hook – set sprint mode for the next movement.
   *
   * Call this when the QuadStick (or other Gamepad-API adapter) activates
   * sprint (e.g. double-puff).  The sprint flag persists until the next
   * movement is executed, at which point it resets to false (matching
   * double-tap behaviour).
   *
   * @param {boolean} sprint - Whether to sprint
   */
  function setControllerSprint(sprint) {
    _runMode = !!sprint;
  }

  return {
    init: init,
    renderGrid: renderGrid,
    hide: hide,
    show: show,
    showFloatingDamage: showFloatingDamage,
    showInventory: showInventory,
    toggleActionMenu: toggleActionMenu,
    // QuadStick / Gamepad-API controller hooks
    beginFishingFromPlayer: beginFishingFromPlayer,
    updateFishingTarget: updateFishingTarget,
    commitFishingTarget: commitFishingTarget,
    controllerTapMove: controllerTapMove,
    setControllerSprint: setControllerSprint
  };
})();
