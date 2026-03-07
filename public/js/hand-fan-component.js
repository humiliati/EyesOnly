/* ============================================================
   EYES ONLY - Hand Fan Component (Hearthstone-Style)
   Card display with transparency based on lifecycle
   ============================================================ */

const HandFanComponent = (function () {
  'use strict';

  // State
  var _mode = 'hidden'; // 'hidden', 'combat', 'contextual'
  var _position = 'centered'; // 'centered', 'peripheral', 'bottom'
  var _cards = [];
  var _selectedCards = [];
  var _animationPhase = 'idle'; // 'idle', 'commit', 'resolve', 'repopulate'
  var _isAnimating = false;

  // Z-index layering: last-clicked card floats to top.
  // Reset to default (center-on-top) after minimize/maximize cycle.
  var _topCardIndex = -1; // -1 = default center-on-top layering

  // Press-and-hold targeting state (Option 1: tap selects, hold targets)
  var _targeting = {
    active: false,
    cardIndex: -1,
    cardId: null,
    holdTimer: null,
    holdMs: 180,
    pointerId: null,
    startedAt: 0
  };

  // DOM elements
  var _fanContainer = null;

  // Tooltip hover-dwell state (desktop only: 0.5s dwell with <8px movement)
  var _tooltipDwell = {
    timer: null,
    startX: 0,
    startY: 0,
    moveThreshold: 8,    // px — movement beyond this resets the dwell
    dwellMs: 500,        // ms before tooltip unrolls
    activeCard: null,     // cardEl currently showing tooltip
    moveHandler: null     // reference for cleanup
  };

  // ── Legacy drag state DELETED (Phase 3) ──
  // _html5DragCollapse and _liftDrag fully removed. All drag state lives in CardDragController.

  // Configuration
  var _maxVisibleCards = 5;
  var _cardOverlapPercent = 30; // 30% overlap for fan effect

  /**
   * Initialize the Hand Fan Component
   */
  var _resizeDebounce = null;

  function init() {
    _createFanContainer();
    _attachEventListeners();

    // Orientation/resize: re-render so abbreviation reacts to portrait/landscape flips.
    window.addEventListener('resize', function() {
      if (_resizeDebounce) clearTimeout(_resizeDebounce);
      _resizeDebounce = setTimeout(function() {
        _resizeDebounce = null;
        // Only re-render when the fan is active/visible
        if (_fanContainer && _fanContainer.style.display !== 'none') {
          _renderCards();
          // Re-anchor after resize (STR window + hand fan layout change)
          if (_mode === 'combat') {
            _positionRelativeToStrWindow();
            setTimeout(function() { try { _positionRelativeToStrWindow(); } catch (e2) {} }, 220);
          }
        }
      }, 120);
    });
  }

  /**
   * Create fan container element
   */
  function _createFanContainer() {
    _fanContainer = document.createElement('div');
    _fanContainer.id = 'hand-fan-container';
    _fanContainer.className = 'hand-fan-container';
    _fanContainer.style.display = 'none';
    document.body.appendChild(_fanContainer);
  }

  /**
   * Attach event listeners
   */
  function _attachEventListeners() {
    // Card selection handlers will be added to individual cards
  }

  /**
   * Set mode and position
   * @param {string} mode - 'combat' or 'contextual'
   * @param {string} position - 'centered', 'peripheral', or 'bottom'
   */
  function setMode(mode, position) {
    // Avoid expensive re-renders when callers poll.
    if (mode === _mode && position === _position) {
      // Still ensure anchoring is up-to-date in combat mode.
      try { if (_mode === 'combat') _positionRelativeToStrWindow(); } catch (e0) {}
      return;
    }

    // ── Block mode change when CardDragController owns positioning ──
    // When CDC minimizes STR during a pointer-drag, it sets this flag to
    // prevent the resulting setMode('contextual','bottom') from destroying
    // the fan layout.  The fan stays in combat position with the placeholder
    // visible; CDC will release the lock on drag finalization.
    if (HandFanComponent._dragControllerOwnsMode) {
      _mode = mode;
      _position = position;
      return;
    }

    // ── Legacy _liftDrag defer REMOVED (Phase 2) ──
    // CDC's _dragControllerOwnsMode flag above handles this case now.

    _mode = mode;
    _position = position;

    if (_mode === 'hidden') {
      hide();
      return;
    }

    _updateFanPosition();

    // Only re-render when the fan is actually visible. Mode/position changes
    // can affect abbreviation/layout, but should not churn DOM every tick.
    if (_fanContainer && _fanContainer.style.display !== 'none') {
      _renderCards();
    }
  }

  /**
   * Show the hand fan
   * @param {Array} cards - Array of card objects
   */
  function show(cards) {
    _cards = cards || [];
    _mode = 'combat';
    _position = 'centered';

    // Clear any stale minimized state from a previous combat's resolution.
    // The CSS animation's `forwards` fill can leave scale(0.2) / opacity(0.3)
    // baked in even after class removal — force-clear inline overrides too.
    _fanContainer.classList.remove('hand-fan-minimized');
    _fanContainer.classList.remove('hand-fan-collapsing');
    _fanContainer.style.transform = '';
    _fanContainer.style.opacity = '';

    _renderCards();
    _fanContainer.style.display = 'flex';
    _fanContainer.classList.add('hand-fan-appear');

    setTimeout(function() {
      _fanContainer.classList.remove('hand-fan-appear');
    }, 300);
  }

  /**
   * Hide the hand fan
   */
  function hide() {
    _hideCardTooltip(); // Kill any lingering tooltip on combat cleanup
    _fanContainer.classList.add('hand-fan-disappear');

    setTimeout(function() {
      _fanContainer.style.display = 'none';
      _fanContainer.classList.remove('hand-fan-disappear');
      _fanContainer.classList.remove('hand-fan-minimized');
      _fanContainer.classList.remove('hand-fan-collapsing');
      // Clear any residual animation state so the next show() starts clean
      _fanContainer.style.transform = '';
      _fanContainer.style.opacity = '';
    }, 300);
  }

  /**
   * Minimize hand to single transparent card (during turn resolution)
   */
  function _animateCollapseToMiniIcon(done) {
    if (!_fanContainer) return done && done();

    var mini = document.getElementById('nch-capsule-wrapper') || document.getElementById('str-combat-minimized');
    if (!mini || !mini.getBoundingClientRect) {
      if (done) done();
      return;
    }

    var fr = _fanContainer.getBoundingClientRect();
    var mr = mini.getBoundingClientRect();

    var fx = fr.left + fr.width / 2;
    var fy = fr.top + fr.height / 2;
    var mx = mr.left + mr.width / 2;
    var my = mr.top + mr.height / 2;

    var dx = mx - fx;
    var dy = my - fy;

    try {
      _fanContainer.classList.add('hand-fan-collapsing');
      var anim = _fanContainer.animate([
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
        { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(0.4)', opacity: 0.6 }
      ], {
        duration: 250,
        easing: 'ease-out',
        fill: 'forwards'
      });

      anim.onfinish = function() {
        _fanContainer.classList.remove('hand-fan-collapsing');
        // Clear animation side effects
        _fanContainer.style.transform = '';
        _fanContainer.style.opacity = '';
        if (done) done();
      };
    } catch (e) {
      _fanContainer.classList.remove('hand-fan-collapsing');
      if (done) done();
    }
  }

  function minimize() {
    if (!_fanContainer) return;

    _hideCardTooltip(); // Kill tooltip before collapsing
    // Reset z-index layering so next show uses default center-on-top
    _topCardIndex = -1;

    // Animate toward mini icon, then apply minimized class
    _animateCollapseToMiniIcon(function() {
      _fanContainer.classList.add('hand-fan-minimized');
    });
  }

  // ── hand-fan-mini-indicator DELETED ──
  // Replaced by Combat Capsule (CH) in NonCombatHUD.
  // See: NonCombatHUD.showCombatCapsule / hideCombatCapsule

  /**
   * Restore hand from minimized state
   */
  function restore() {
    _fanContainer.classList.remove('hand-fan-minimized');
    _fanContainer.classList.remove('hand-fan-collapsing');
    // Force-clear any residual transform/opacity from the `forwards`-filled
    // CSS animation or the Web Animations API collapse.
    _fanContainer.style.transform = '';
    _fanContainer.style.opacity = '';
  }

  /**
   * Update cards in the fan
   * @param {Array} cards - New card array
   */
  function updateCards(cards) {
    _cards = cards || [];
    _renderCards();
  }

  function _positionRelativeToStrWindow() {
    if (!_fanContainer) return false;

    // Anchor to STR combat window so we never occlude the header/minimize button
    // on short viewports. This also makes placement resilient to future STR
    // layout changes.
    var win = document.getElementById('str-combat-window');
    if (!win || !win.getBoundingClientRect) return false;

    // If STR window isn't visible, don't anchor.
    try {
      if (win.style && win.style.display === 'none') return false;
    } catch (e0) {}

    var r = win.getBoundingClientRect();
    if (!isFinite(r.left) || !isFinite(r.top) || r.width <= 0 || r.height <= 0) return false;

    var cx = r.left + (r.width / 2);

    // Default: bias toward bottom (player + timer area) to avoid enemy intent.
    var relY = 0.78;
    if (_position === 'peripheral') {
      // Peripheral mode should sit higher but still below the header.
      relY = 0.60;
    }

    var cy = r.top + (r.height * relY);

    _fanContainer.style.left = Math.round(cx) + 'px';
    _fanContainer.style.top = Math.round(cy) + 'px';
    _fanContainer.style.transform = 'translate(-50%, -50%)';

    return true;
  }

  /**
   * Update fan position based on mode and position
   */
  function _updateFanPosition() {
    _fanContainer.className = 'hand-fan-container';

    // Clear any previous anchoring overrides unless we're in combat mode.
    if (!(_mode === 'combat')) {
      try {
        _fanContainer.style.left = '';
        _fanContainer.style.top = '';
        _fanContainer.style.transform = '';
      } catch (e1) {}
    }

    if (_mode === 'combat' && _position === 'centered') {
      _fanContainer.classList.add('hand-fan-combat');
    } else if (_mode === 'combat' && _position === 'peripheral') {
      _fanContainer.classList.add('hand-fan-combat-peripheral');
    } else if (_mode === 'contextual' && _position === 'bottom') {
      _fanContainer.classList.add('hand-fan-contextual');
    }

    if (_mode === 'combat') {
      // Anchor to STR window when available.
      _positionRelativeToStrWindow();
    }
  }

  /**
   * Render cards in the fan
   */
  function _renderCards() {
    if (!_fanContainer) return;
    var _fr0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;

    _fanContainer.innerHTML = '';
    _updateFanPosition();

    // Check if hand is empty or all cards are unaffordable
    var hasAffordableCards = false;
    if (_cards.length > 0) {
      for (var i = 0; i < _cards.length; i++) {
        var affordability = _validateCardAffordability(_cards[i]);
        if (affordability.canAfford) {
          hasAffordableCards = true;
          break;
        }
      }
    }

    // Show placeholder(s) if no cards or no affordable cards
    if (_cards.length === 0 || !hasAffordableCards) {
      // Grey EMPTY joker (always present)
      var emptyJoker = document.createElement('div');
      emptyJoker.className = 'hand-card-placeholder hand-card-placeholder-empty';
      emptyJoker.textContent = 'JOKER';
      _fanContainer.appendChild(emptyJoker);

      // BLVCK safety net (non-interactive for now; will become conditional)
      var blvck = document.createElement('div');
      blvck.className = 'hand-card-placeholder hand-card-placeholder-blvck';
      blvck.textContent = 'BLVCK';
      _fanContainer.appendChild(blvck);

      return;
    }

    // Limit visible cards
    var visibleCards = _cards.slice(0, _maxVisibleCards);

    visibleCards.forEach(function(card, index) {
      var cardEl = _createCardElement(card, index);
      _fanContainer.appendChild(cardEl);
    });

    if (_fr0 && typeof EYESONLY_PERF !== 'undefined') {
      EYESONLY_PERF.mark('fan.renderMs', performance.now() - _fr0);
    }
  }

  /**
   * Create a single card element
   * @param {Object} card - Card data
   * @param {number} index - Index in hand
   */
  function _createCardElement(card, index) {
    // Delegate card DOM building to SharedCardRenderer
    var cardWrapper;
    if (typeof SharedCardRenderer !== 'undefined' && SharedCardRenderer.createCardElement) {
      cardWrapper = SharedCardRenderer.createCardElement(card, index, 'combat');
    } else {
      // Fallback: minimal card element
      cardWrapper = document.createElement('div');
      cardWrapper.className = 'hand-card-wrapper';
      cardWrapper.dataset.cardIndex = index;
      var cardEl = document.createElement('div');
      cardEl.className = 'hand-card';
      cardEl.innerHTML = '<div class="hand-card-artwork"><div class="hand-card-emoji">' + (card.emoji || '🃏') + '</div></div><div class="hand-card-name">' + (card.name || '?') + '</div>';
      cardWrapper.appendChild(cardEl);
    }

    // HTML5 draggable REMOVED (Phase 2) — all drag is pointer-based via CardDragController.
    // BLVCK (ACT-000) guard is now in the CDC pointerdown handler (unaffordable check).

    // Apply fan transformation (combat-specific geometry)
    _applyFanTransform(cardWrapper, index, _cards.length);

    // Check if selected (combat-specific state)
    var cardEl = cardWrapper.querySelector('.hand-card');
    if (cardEl && _selectedCards.indexOf(index) !== -1) {
      cardEl.classList.add('hand-card-selected');
      var badge = document.createElement('div');
      badge.className = 'hand-card-selection-badge';
      badge.textContent = _selectedCards.indexOf(index) + 1;
      cardEl.appendChild(badge);
    }

    // Attach combat-specific event handlers
    if (cardEl) {
      _attachCardHandlers(cardEl, card, index);
    }

    return cardWrapper;
  }

  /**
   * Apply fan transformation to card wrapper
   * @param {HTMLElement} wrapper - Card wrapper element
   * @param {number} index - Card index
   * @param {number} total - Total number of cards
   */
  function _applyFanTransform(wrapper, index, total) {
    var _ft0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;
    // Calculate fan spread
    var centerIndex = (total - 1) / 2;
    var offset = index - centerIndex;

    // Rotation angle (degrees)
    var maxRotation = 8; // Maximum rotation at edges
    var rotation = offset * (maxRotation / centerIndex);

    // Vertical offset (pixels) - creates arc
    var maxVerticalOffset = 15;
    var verticalOffset = Math.abs(offset) * (maxVerticalOffset / centerIndex);

    // Horizontal offset for overlap
    var baseWidth = 120; // Card width in px
    var overlapWidth = baseWidth * (_cardOverlapPercent / 100);
    var horizontalSpacing = baseWidth - overlapWidth;

    // Z-index: last-clicked card floats to top; default is center-on-top.
    var zIndex;
    if (_topCardIndex >= 0 && index === _topCardIndex) {
      zIndex = 200; // above all other cards
    } else {
      zIndex = 100 - Math.abs(offset * 10); // default: center highest
    }

    // Expose base transform via CSS variables; CSS handles hover lift.
    wrapper.style.setProperty('--fan-ty', String(verticalOffset) + 'px');
    wrapper.style.setProperty('--fan-rot', String(rotation) + 'deg');
    wrapper.style.transform = 'translateY(' + verticalOffset + 'px) rotate(' + rotation + 'deg)';
    wrapper.style.marginLeft = (index === 0 ? 0 : -overlapWidth) + 'px';
    wrapper.style.zIndex = zIndex;

    // NOTE: no JS hover transform mutation (prevents violent jumps + missed clicks).

    if (_ft0 && typeof EYESONLY_PERF !== 'undefined') {
      EYESONLY_PERF.mark('fan.transformMs', performance.now() - _ft0);
    }
  }

  /**
   * Get card lifecycle type for transparency
   * @param {Object} card - Card data
   * @returns {string} Lifecycle type
   */
  function _getCardLifecycle(card) {
    if (typeof SharedCardRenderer !== 'undefined' && SharedCardRenderer.getCardLifecycle) {
      return SharedCardRenderer.getCardLifecycle(card);
    }
    var lifecycle = card.lifecycleType || card.lifecycle || card.consumable || 'core';
    var lifecycleMap = {
      'disposable': 'consumable', 'LIFE_001': 'consumable',
      'exhaust': 'exhaust', 'LIFE_002': 'exhaust',
      'power': 'power', 'LIFE_003': 'power',
      'gated': 'gated', 'LIFE_004': 'gated',
      'persistent': 'core', 'LIFE_005': 'core', 'core': 'core'
    };
    return lifecycleMap[lifecycle] || 'core';
  }

  /**
   * Attach event handlers to card
   * @param {HTMLElement} cardEl - Card element
   * @param {Object} card - Card data
   * @param {number} index - Card index
   */
  function _isEnemyUnderPointer(clientX, clientY) {
    var enemyEl = document.querySelector('.str-combatant.str-enemy');
    if (!enemyEl) return false;
    var rect = enemyEl.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function _setEnemyHoverState(isTargetable, isTargeted) {
    var enemyEl = document.querySelector('.str-combatant.str-enemy');
    if (!enemyEl) return;

    if (isTargetable) enemyEl.classList.add('str-enemy-targetable');
    else enemyEl.classList.remove('str-enemy-targetable');

    if (isTargeted) enemyEl.classList.add('str-enemy-targeted');
    else enemyEl.classList.remove('str-enemy-targeted');
  }

  var _aoePreview = {
    raf: null,
    lastKey: null
  };

  function _clearAoePreview() {
    try {
      var cells = document.querySelectorAll('.rogue-cell.aoe-exact, .rogue-cell.aoe-prob, .rogue-cell.aoe-far');
      for (var i = 0; i < cells.length; i++) {
        cells[i].classList.remove('aoe-exact', 'aoe-prob', 'aoe-far');
      }
    } catch (e) {}
    _aoePreview.lastKey = null;
  }

  function _scheduleAoePreviewUpdate(clientX, clientY, cardIndex) {
    if (_aoePreview.raf) return;
    _aoePreview.raf = requestAnimationFrame(function() {
      _aoePreview.raf = null;
      _updateAoePreviewNow(clientX, clientY, cardIndex);
    });
  }

  function _updateAoePreviewNow(clientX, clientY, cardIndex) {
    if (typeof GroundEffectCardMappings === 'undefined' || typeof GroundEffectCardMappings.getMappingForCard !== 'function') {
      _clearAoePreview();
      return;
    }

    var card = _cards[cardIndex];
    var mapping = GroundEffectCardMappings.getMappingForCard(card);
    if (!mapping || !mapping.type) {
      _clearAoePreview();
      return;
    }

    // Only preview when hovering a grid cell
    var elAt = document.elementFromPoint(clientX, clientY);
    var cell = elAt ? (elAt.closest && elAt.closest('.rogue-cell')) : null;
    if (!cell || !cell.dataset) {
      _clearAoePreview();
      return;
    }

    var gx = Number(cell.dataset.x);
    var gy = Number(cell.dataset.y);
    if (!isFinite(gx) || !isFinite(gy)) {
      _clearAoePreview();
      return;
    }

    var key = gx + ',' + gy + ':' + String(mapping.type) + ':' + String(mapping.radius || 0);
    if (_aoePreview.lastKey === key) return;
    _aoePreview.lastKey = key;

    _clearAoePreview();

    var r = Math.max(0, Number(mapping.radius || 0));
    var pr = r + 1; // probabilistic ring

    // Exact tiles
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        var c = document.querySelector('.rogue-cell[data-x="' + (gx + dx) + '"][data-y="' + (gy + dy) + '"]');
        if (c) c.classList.add('aoe-exact');
      }
    }

    // Probabilistic ring tiles (border around exact)
    for (var dy2 = -pr; dy2 <= pr; dy2++) {
      for (var dx2 = -pr; dx2 <= pr; dx2++) {
        if (Math.abs(dx2) <= r && Math.abs(dy2) <= r) continue;
        var c2 = document.querySelector('.rogue-cell[data-x="' + (gx + dx2) + '"][data-y="' + (gy + dy2) + '"]');
        if (c2) c2.classList.add('aoe-prob');
      }
    }

    // Far faint "reach" highlight so it shows beyond a finger.
    // Highlight a plus-shape out to ~half the scene width.
    var reach = 10;
    for (var i = 1; i <= reach; i++) {
      var up = document.querySelector('.rogue-cell[data-x="' + gx + '"][data-y="' + (gy - i) + '"]');
      var dn = document.querySelector('.rogue-cell[data-x="' + gx + '"][data-y="' + (gy + i) + '"]');
      var lf = document.querySelector('.rogue-cell[data-x="' + (gx - i) + '"][data-y="' + gy + '"]');
      var rt = document.querySelector('.rogue-cell[data-x="' + (gx + i) + '"][data-y="' + gy + '"]');
      if (up) up.classList.add('aoe-far');
      if (dn) dn.classList.add('aoe-far');
      if (lf) lf.classList.add('aoe-far');
      if (rt) rt.classList.add('aoe-far');
    }
  }

  function _clearTargetingVisuals(cardEl) {
    try { document.body.style.cursor = ''; } catch (e) {}
    _setEnemyHoverState(false, false);
    _clearAoePreview();
    if (cardEl) cardEl.classList.remove('hand-card-targeting');
  }

  // ── _beginHoldTargeting REMOVED (Phase 2) ──
  // All targeting/drag logic now lives in CardDragController.
  // Enemy targeting = 'enemy-avatar' drop zone.
  // Ground effect deployment = 'map-grid' drop zone.
  // STR minimize/maximize = CardDragController._handleStrCollapseLogic.

  function _attachCardHandlers(cardEl, card, index) {
    // Click to select/deselect (only if affordable)
    cardEl.addEventListener('click', function(e) {
      // On touch devices, a touchend can be followed by a synthetic click.
      // If we just handled a touch interaction, ignore this click to prevent rapid toggle ("shaking").
      var lastTouch = Number(cardEl.dataset.lastTouchTs || 0);
      if (lastTouch && Date.now() - lastTouch < 800) {
        if (e && e.preventDefault) e.preventDefault();
        return;
      }

      // If a swipe gesture was just handled, suppress the follow-on click.
      var lastSwipe = Number(cardEl.dataset.lastSwipeTs || 0);
      if (lastSwipe && Date.now() - lastSwipe < 800) {
        try { delete cardEl.dataset.lastSwipeTs; } catch (e0) {}
        if (e && e.preventDefault) e.preventDefault();
        return;
      }

      // If we queued a selection during an animation on pointerdown, suppress
      // the subsequent click (otherwise it toggles twice and feels like
      // triple-click is required).
      var lastPtrSel = Number(cardEl.dataset.lastPtrSelectTs || 0);
      if (lastPtrSel && Date.now() - lastPtrSel < 600) {
        try { delete cardEl.dataset.lastPtrSelectTs; } catch (e0) {}
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        return;
      }

      // Check if card is unaffordable
      if (cardEl.dataset.unaffordable === 'true') {
        // Shake animation for visual feedback
        cardEl.classList.add('card-shake');
        setTimeout(function() {
          cardEl.classList.remove('card-shake');
        }, 400);

        // Show MOK interjection with shortage info
        if (cardEl.dataset.resourceShortage && typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
          UIControls.updateMokInterjection('Cannot play: ' + cardEl.dataset.resourceShortage);
        }

        return; // Prevent selection
      }

      // If we were in hold-targeting mode, don't toggle selection.
      if (_targeting && _targeting.active) {
        if (e && e.preventDefault) e.preventDefault();
        return;
      }

      // If we are targeting, ignore selection toggles
      if (_targeting && _targeting.active) {
        return;
      }

      _toggleCardSelection(index);
    });

    // ── Unified pointer-drag via CardDragController (Phase 2) ──
    // Replaces the old press-and-hold targeting system.
    // Tap (<10px movement) = toggle selection.
    // Drag (>10px movement) = enter CardDragController drag mode.
    cardEl.addEventListener('pointerdown', function(e) {
      if (_isAnimating) {
        try { cardEl.dataset.lastPtrSelectTs = String(Date.now()); } catch (e0) {}
        _toggleCardSelection(index);
        return;
      }

      // Only enable drag during STR combat mode
      if (_mode !== 'combat') return;
      if (cardEl.dataset.unaffordable === 'true') return;
      if (e && e.button != null && e.button !== 0) return;

      // Guard: CardDragController must be loaded
      if (typeof CardDragController === 'undefined' || !CardDragController.isEnabled()) return;

      var startX = e.clientX, startY = e.clientY;
      var pointerId = e.pointerId;
      var dragStarted = false;

      function onMove(ev) {
        if (ev.pointerId !== pointerId) return;
        var dx = ev.clientX - startX;
        var dy = ev.clientY - startY;
        if (!dragStarted && Math.sqrt(dx * dx + dy * dy) > 10) {
          dragStarted = true;
          CardDragController.beginDrag(cardEl, index, card, 'hand-fan', e);
        }
        if (dragStarted) {
          CardDragController.updateDrag(ev);
        }
      }

      function onUp(ev) {
        if (ev.pointerId !== pointerId) return;
        cdcCleanup();
        if (dragStarted) {
          CardDragController.endDrag(ev);
        }
        // If not dragged, the click handler above handles selection toggle
      }

      function onCancel(ev) {
        if (ev.pointerId !== pointerId) return;
        cdcCleanup();
        if (dragStarted) CardDragController.cancelDrag();
      }

      function cdcCleanup() {
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onCancel, true);
      }

      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onCancel, true);
    });

    // Touch handlers
    cardEl.addEventListener('touchend', function(e) {
      e.preventDefault();
      // Mark touch timestamp to suppress the follow-up synthetic click
      cardEl.dataset.lastTouchTs = String(Date.now());

      // Check if card is unaffordable
      if (cardEl.dataset.unaffordable === 'true') {
        cardEl.classList.add('card-shake');
        setTimeout(function() {
          cardEl.classList.remove('card-shake');
        }, 400);

        if (cardEl.dataset.resourceShortage && typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
          UIControls.updateMokInterjection('Cannot play: ' + cardEl.dataset.resourceShortage);
        }

        return;
      }

      // If we are targeting, ignore selection toggles
      if (_targeting && _targeting.active) {
        return;
      }

      _toggleCardSelection(index);
    });

    // Swipe gesture detection for directional card actions (requires swipeActivate passive).
    // Up = offensive push round; Down = defensive/self effects (or discard if no qualifying passive).
    // Left/Right are ignored. Uses a one-shot pointerup listener to avoid accumulating window listeners.
    (function() {
      var SWIPE_THRESHOLD = 30;

      cardEl.addEventListener('pointerdown', function(e) {
        if (_mode !== 'combat') return;
        if (e && e.button != null && e.button !== 0) return;

        var startX = e.clientX;
        var startY = e.clientY;
        var pointerId = e.pointerId;

        function onSwipeEnd(ev) {
          if (ev.pointerId !== pointerId) return;
          window.removeEventListener('pointerup', onSwipeEnd, true);
          window.removeEventListener('pointercancel', onSwipeEnd, true);

          if (cardEl.dataset.unaffordable === 'true') return;

          var dx = ev.clientX - startX;
          var dy = ev.clientY - startY;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < SWIPE_THRESHOLD) return;

          // Determine primary direction (vertical only; ignore horizontal swipes)
          if (Math.abs(dy) <= Math.abs(dx)) return;

          var direction = dy < 0 ? 'up' : 'down';

          if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleCardSwipe === 'function') {
            // Mark swipe to suppress the follow-on click event
            try { cardEl.dataset.lastSwipeTs = String(Date.now()); } catch (e0) {}
            GoneRogue.handleCardSwipe(index, direction);
          }
        }

        window.addEventListener('pointerup', onSwipeEnd, true);
        window.addEventListener('pointercancel', onSwipeEnd, true);
      });
    })();

    // ── HTML5 drag handlers REMOVED (Phase 2) ──
    // All drag is now handled by CardDragController via pointer events.
    // Disposal, commerce, and ground effect deployment are registered as
    // drop zone callbacks in CardDragController.

    // Hover tooltip — desktop only, 0.5s dwell with minimal movement triggers unroll.
    // Resets if cursor moves significantly. Not mobile-accessible (touch has press-hold).
    cardEl.addEventListener('mouseenter', function(e) {
      // Skip on touch devices (coarse pointer)
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

      _tooltipDwellStart(card, cardEl, e.clientX, e.clientY);
    });

    cardEl.addEventListener('mouseleave', function() {
      _tooltipDwellCancel();
      _hideCardTooltip();
    });
  }

  /**
   * Toggle card selection
   * @param {number} index - Card index
   */
  function _toggleCardSelection(index) {
    var selectedIndex = _selectedCards.indexOf(index);

    if (selectedIndex !== -1) {
      // Deselect
      _selectedCards.splice(selectedIndex, 1);
    } else {
      // Select (max 5 cards)
      if (_selectedCards.length < 5) {
        _selectedCards.push(index);
        // Check for instant-resolution passive items (e.g. Redneck Obliterator)
        if (_checkInstantResolveHook()) return;
      }
    }

    // Bring last-clicked card to top layer
    _topCardIndex = index;

    // Fast path: update classes, badges & z-index in-place instead of full
    // DOM rebuild.  This prevents the animation restart / visual quiver that
    // occurs when _renderCards() destroys and re-creates every card element.
    if (_fanContainer && _fanContainer.children.length > 0) {
      var wrappers = _fanContainer.querySelectorAll('.hand-card-wrapper');
      var patchedOk = wrappers.length > 0;
      var total = wrappers.length;

      for (var i = 0; i < wrappers.length; i++) {
        var wrapper = wrappers[i];
        var wrapperIndex = parseInt(wrapper.dataset.cardIndex, 10);
        var cardEl = wrapper.querySelector('.hand-card');
        if (!cardEl) { patchedOk = false; break; }

        var isSelected = _selectedCards.indexOf(wrapperIndex) !== -1;
        var selOrder = _selectedCards.indexOf(wrapperIndex);

        // Toggle selected class
        if (isSelected) {
          cardEl.classList.add('hand-card-selected');
        } else {
          cardEl.classList.remove('hand-card-selected');
        }

        // Update z-index: last-clicked card floats to top
        var centerIndex = (total - 1) / 2;
        var offset = wrapperIndex - centerIndex;
        if (_topCardIndex >= 0 && wrapperIndex === _topCardIndex) {
          wrapper.style.zIndex = 200;
        } else {
          wrapper.style.zIndex = 100 - Math.abs(offset * 10);
        }

        // Update or remove selection badge
        var existingBadge = cardEl.querySelector('.hand-card-selection-badge');
        if (isSelected) {
          if (existingBadge) {
            existingBadge.textContent = selOrder + 1;
          } else {
            var badge = document.createElement('div');
            badge.className = 'hand-card-selection-badge';
            badge.textContent = selOrder + 1;
            cardEl.appendChild(badge);
          }
        } else if (existingBadge) {
          existingBadge.parentNode.removeChild(existingBadge);
        }
      }

      // Synergy underglow: check if 2+ selected cards share synergy tags
      _updateSynergyUnderglow(wrappers);

      // If fast path succeeded, skip full re-render
      if (patchedOk) return;
    }

    // Fallback: full re-render (initial render, or DOM is in unexpected state)
    _renderCards();
  }

  // Synergy tag → color mapping (used for underglow gradient)
  var SYNERGY_TAG_COLORS = {
    'energy_gen':      { r: 0,   g: 212, b: 255 },  // cyan
    'burst':           { r: 255, g: 68,  b: 68  },   // red
    'battery_gen':     { r: 0,   g: 255, b: 166 },   // green
    'tech':            { r: 0,   g: 200, b: 255 },   // blue
    'fire':            { r: 255, g: 120, b: 0   },   // orange
    'explosive':       { r: 255, g: 60,  b: 0   },   // red-orange
    'precision':       { r: 255, g: 249, b: 176 },   // pale yellow
    'ranged':          { r: 200, g: 200, b: 100 },   // olive
    'aggressive':      { r: 255, g: 50,  b: 50  },   // aggressive red
    'combo_starter':   { r: 255, g: 215, b: 0   },   // gold
    'combo_finisher':  { r: 255, g: 215, b: 0   },   // gold
    'aoe':             { r: 255, g: 100, b: 0   },   // flame
    'sustained':       { r: 160, g: 82,  b: 45  },   // brown
    'covert':          { r: 100, g: 100, b: 180 },   // slate blue
    'pickpocket':      { r: 180, g: 80,  b: 220 },   // violet
    'disarm':          { r: 200, g: 200, b: 200 }    // silver
  };

  /**
   * Check selected cards for shared synergy tags. If 2+ selected cards
   * share at least one tag, apply synergy-glow class with the tag's color.
   */
  function _updateSynergyUnderglow(wrappers) {
    // Gather synergy tags from selected cards
    var selectedTags = {}; // tag → count of selected cards with that tag
    var synergyColor = null;

    for (var si = 0; si < _selectedCards.length; si++) {
      var cardIdx = _selectedCards[si];
      var card = _cards[cardIdx];
      if (!card) continue;
      var tags = card.synergyTags || card.tags || [];
      for (var ti = 0; ti < tags.length; ti++) {
        var tag = tags[ti];
        selectedTags[tag] = (selectedTags[tag] || 0) + 1;
        if (selectedTags[tag] >= 2 && !synergyColor) {
          // Found a shared tag — use its color
          synergyColor = SYNERGY_TAG_COLORS[tag] || { r: 128, g: 0, b: 128 };
        }
      }
    }

    // Apply or remove glow from all cards
    for (var wi = 0; wi < wrappers.length; wi++) {
      var cardEl = wrappers[wi].querySelector('.hand-card');
      if (!cardEl) continue;
      var wIdx = parseInt(wrappers[wi].dataset.cardIndex, 10);
      var isSelected = _selectedCards.indexOf(wIdx) !== -1;

      if (synergyColor && isSelected) {
        cardEl.classList.add('hand-card-synergy-glow');
        cardEl.style.setProperty('--synergy-r', String(synergyColor.r));
        cardEl.style.setProperty('--synergy-g', String(synergyColor.g));
        cardEl.style.setProperty('--synergy-b', String(synergyColor.b));
      } else {
        cardEl.classList.remove('hand-card-synergy-glow');
        cardEl.style.removeProperty('--synergy-r');
        cardEl.style.removeProperty('--synergy-g');
        cardEl.style.removeProperty('--synergy-b');
      }
    }
  }

  /**
   * Check for instant-resolution item hook.
   * Passive items with `instantResolve: true` (e.g. Redneck Obliterator) trigger
   * immediate card play when any card is selected, bypassing the timer.
   * PVE only — PVP is a future TODO.
   */
  function _checkInstantResolveHook() {
    if (_selectedCards.length === 0) return;
    try {
      if (typeof PassiveItemsSystem !== 'undefined' &&
          typeof PassiveItemsSystem.hasTraitActive === 'function' &&
          PassiveItemsSystem.hasTraitActive('instantResolve')) {
        console.log('[HandFan] Instant-resolve item active — auto-committing ' + _selectedCards.length + ' card(s)');
        // Brief visual flash before auto-commit
        setTimeout(function() {
          playSelectedCards();
        }, 200);
        return true;
      }
    } catch (e) {}
    // Also check via custom event for extensibility
    try {
      var evt = new CustomEvent('hand-fan-card-selected', {
        detail: {
          selectedCount: _selectedCards.length,
          cards: _selectedCards.map(function(idx) { return _cards[idx]; })
        }
      });
      window.dispatchEvent(evt);
    } catch (e2) {}
    return false;
  }

  /**
   * Show card tooltip
   * @param {Object} card - Card data
   * @param {HTMLElement} cardEl - Card element
   */
  // Resource color map from RESOURCE_COLOR_SYSTEM.md
  var RESOURCE_COLORS = {
    'HP': '#FF6B9D', 'hp': '#FF6B9D',
    'Energy': '#00D4FF', 'energy': '#00D4FF',
    'Focus': '#FFF9B0', 'focus': '#FFF9B0',
    'Battery': '#00FFA6', 'battery': '#00FFA6',
    'Fatigue': '#A0522D', 'fatigue': '#A0522D',
    'Ammo': '#DA70D6', 'ammo': '#DA70D6',
    'Currency': '#FFFF00', 'currency': '#FFFF00',
    'key_ammo': '#FF8A3D', 'Key Ammo': '#FF8A3D',
    'Cards': '#800080', 'cards': '#800080'
  };

  function _getResourceColor(resourceName) {
    if (!resourceName) return '#808080';
    return RESOURCE_COLORS[resourceName] || RESOURCE_COLORS[resourceName.toLowerCase()] || '#808080';
  }

  /**
   * Start tooltip dwell timer. After dwellMs with <moveThreshold movement, tooltip unrolls.
   */
  function _tooltipDwellStart(card, cardEl, startX, startY) {
    _tooltipDwellCancel(); // clear any previous

    _tooltipDwell.startX = startX;
    _tooltipDwell.startY = startY;

    // Track movement — reset dwell if cursor moves too far
    function onMove(e) {
      var dx = e.clientX - _tooltipDwell.startX;
      var dy = e.clientY - _tooltipDwell.startY;
      if (Math.sqrt(dx * dx + dy * dy) > _tooltipDwell.moveThreshold) {
        // Moved too far — reset dwell, roll back if already showing
        _tooltipDwellCancel();
        _hideCardTooltip();
        // Restart dwell from new position
        _tooltipDwell.startX = e.clientX;
        _tooltipDwell.startY = e.clientY;
        _tooltipDwell.timer = setTimeout(function() {
          _tooltipDwell.timer = null;
          _showCardTooltip(card, cardEl);
        }, _tooltipDwell.dwellMs);
        _tooltipDwell.moveHandler = onMove;
        // Keep the listener active (it's already attached)
      }
    }

    _tooltipDwell.moveHandler = onMove;
    cardEl.addEventListener('mousemove', onMove);

    _tooltipDwell.timer = setTimeout(function() {
      _tooltipDwell.timer = null;
      _tooltipDwell.activeCard = cardEl;
      _showCardTooltip(card, cardEl);
    }, _tooltipDwell.dwellMs);
  }

  /**
   * Cancel tooltip dwell timer and detach mousemove listener.
   */
  function _tooltipDwellCancel() {
    if (_tooltipDwell.timer) {
      clearTimeout(_tooltipDwell.timer);
      _tooltipDwell.timer = null;
    }
    if (_tooltipDwell.moveHandler && _tooltipDwell.activeCard) {
      _tooltipDwell.activeCard.removeEventListener('mousemove', _tooltipDwell.moveHandler);
    }
    _tooltipDwell.moveHandler = null;
    _tooltipDwell.activeCard = null;
  }

  function _showCardTooltip(card, cardEl) {
    // Create tooltip element if it doesn't exist
    var tooltip = document.getElementById('hand-card-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'hand-card-tooltip';
      tooltip.className = 'hand-card-tooltip';
      document.body.appendChild(tooltip);
    }

    // Build CHH-relevant tooltip content
    var html = '';
    html += '<div class="tooltip-title">' + (card.name || 'Unknown Card') + '</div>';

    if (card.description) {
      html += '<div class="tooltip-description">' + card.description + '</div>';
    }

    html += '<div class="tooltip-stats">';

    // Quality + rarity
    if (card.qualityName) {
      var qColor = (typeof SharedCardRenderer !== 'undefined' && SharedCardRenderer.getQualityBorderColor)
        ? SharedCardRenderer.getQualityBorderColor(card.qualityName)
        : '#fff';
      html += '<div class="tooltip-stat">Quality: <span style="color:' + qColor + '">' + card.qualityName + '</span></div>';
    }

    // Resource cost (color-coded)
    var costResource = card.costResource || card.resource || card.spendResource || null;
    if (card.cost !== undefined && card.cost !== null) {
      var rColor = _getResourceColor(costResource);
      html += '<div class="tooltip-stat tooltip-resource-cost">Cost: <span style="color:' + rColor + '">' + card.cost + (costResource ? ' ' + costResource : '') + '</span></div>';
    }

    // Damage
    if (card.damage !== undefined) {
      html += '<div class="tooltip-stat">Dmg: <span style="color:#FF6B9D">' + card.damage + '</span></div>';
    }

    // Lifecycle type
    var lifecycle = (typeof SharedCardRenderer !== 'undefined' && SharedCardRenderer.getCardLifecycle)
      ? SharedCardRenderer.getCardLifecycle(card)
      : (card.lifecycleType || card.lifecycle || 'core');
    html += '<div class="tooltip-stat">Use: <span>' + lifecycle + '</span></div>';

    html += '</div>';

    // Synergy tags
    if (card.tags && card.tags.length > 0) {
      html += '<div class="tooltip-tags">' + card.tags.join(' · ') + '</div>';
    }

    // CardRef ID
    if (card.id) {
      html += '<div class="tooltip-card-id">' + card.id + '</div>';
    }

    tooltip.innerHTML = html;

    // Position tooltip above card, centered
    var rect = cardEl.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - 6) + 'px';
    tooltip.style.transform = 'translate(-50%, -100%) scaleY(0)';
    tooltip.style.transformOrigin = 'bottom center';
    tooltip.style.display = 'block';
    tooltip.style.opacity = '0';

    // Force reflow then trigger unroll
    void tooltip.offsetWidth;
    tooltip.style.transition = 'transform 0.2s ease-out, opacity 0.15s ease-out';
    tooltip.style.transform = 'translate(-50%, -100%) scaleY(1)';
    tooltip.style.opacity = '1';

    _tooltipDwell.activeCard = cardEl;
  }

  /**
   * Hide card tooltip with roll-back animation
   */
  function _hideCardTooltip() {
    _tooltipDwellCancel();

    var tooltip = document.getElementById('hand-card-tooltip');
    if (!tooltip || tooltip.style.display === 'none') return;

    // Roll back up
    tooltip.style.transition = 'transform 0.15s ease-in, opacity 0.12s ease-in';
    tooltip.style.transform = 'translate(-50%, -100%) scaleY(0)';
    tooltip.style.opacity = '0';

    // Remove after animation
    setTimeout(function() {
      if (tooltip) tooltip.style.display = 'none';
    }, 160);
  }

  /**
   * Play selected cards (commit animation)
   */
  function playSelectedCards() {
    if (_selectedCards.length === 0) return;

    _animationPhase = 'commit';
    _isAnimating = true;

    // Capture indices before any async callbacks can clear them
    var capturedIndices = _selectedCards.slice();

    // Commit animation: lift selected cards
    _animateCommit(function() {
      // Check for single-use/consumable cards and apply incinerator effect
      var selectedCardObjects = capturedIndices.map(function(index) {
        return _cards[index];
      });

      _animateIncinerator(selectedCardObjects, function() {
        // Resolve animation: fly to center
        _animateResolve(function() {
          // Notify game logic: prefer canonical playCardsFromHand (by cardId).
          if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.playCardsFromHand === 'function') {
            var ids = [];
            for (var k = 0; k < capturedIndices.length; k++) {
              var c = _cards && _cards[capturedIndices[k]] ? _cards[capturedIndices[k]] : null;
              if (c && c.id) ids.push(c.id);
            }
            if (ids.length) {
              GoneRogue.playCardsFromHand(ids);
            }
          } else {
            // Legacy indices-based combat path removed; keep id-based only.
          }

          // Repopulate animation will be triggered by updateCards call
          _selectedCards = [];
        });
      });
    });
  }

  /**
   * Animate incinerator effect for single-use cards
   * @param {Array} cards - Array of card objects
   * @param {Function} callback - Callback when animation completes
   */
  function _animateIncinerator(cards, callback) {
    var hasConsumables = false;

    // Check if any cards are consumable/disposable using helper function
    for (var i = 0; i < cards.length; i++) {
      var lifecycle = _getCardLifecycle(cards[i]);
      if (lifecycle === 'consumable') {
        hasConsumables = true;
        break;
      }
    }

    if (!hasConsumables) {
      // No consumables, proceed immediately
      if (callback) callback();
      return;
    }

    // Apply incinerator animation to consumable cards
    var cardElements = _fanContainer.querySelectorAll('.hand-card.hand-card-selected');
    var consumableCount = 0;

    for (var i = 0; i < cardElements.length; i++) {
      var cardEl = cardElements[i];
      var cardIndex = parseInt(cardEl.parentElement.dataset.cardIndex, 10);
      var card = _cards[cardIndex];
      var lifecycle = _getCardLifecycle(card);

      if (lifecycle === 'consumable') {
        cardEl.classList.add('card-incinerating');
        consumableCount++;
      }
    }

    // Wait for incinerator animation to complete
    var duration = consumableCount > 0 ? 600 : 0;
    setTimeout(function() {
      if (callback) callback();
    }, duration);
  }

  /**
   * Commit animation - lift selected cards
   * @param {Function} callback - Callback when animation completes
   */
  function _animateCommit(callback) {
    _fanContainer.classList.add('hand-fan-commit');

    setTimeout(function() {
      _fanContainer.classList.remove('hand-fan-commit');
      _animationPhase = 'resolve';
      if (callback) callback();
    }, 200);
  }

  /**
   * Resolve animation - cards fly to center and fade
   * @param {Function} callback - Callback when animation completes
   */
  function _animateResolve(callback) {
    _fanContainer.classList.add('hand-fan-resolve');

    // Duration varies by card count (800-1500ms)
    var duration = 800 + (_selectedCards.length * 140);

    setTimeout(function() {
      _fanContainer.classList.remove('hand-fan-resolve');
      _fanContainer.classList.add('hand-fan-shuffle');
      setTimeout(function() {
        _fanContainer.classList.remove('hand-fan-shuffle');
      }, 220);

      _animationPhase = 'repopulate';
      _isAnimating = false;
      if (callback) callback();
    }, duration);
  }

  /**
   * Repopulate animation - new cards fade in from center
   */
  function repopulateCards(newCards) {
    _cards = newCards || [];
    _animationPhase = 'repopulate';

    // Lock interactions during repopulate so hover/click can't fight transforms.
    _isAnimating = true;
    try { if (_fanContainer) _fanContainer.classList.add('hand-fan-interaction-lock'); } catch (e0) {}

    _fanContainer.classList.add('hand-fan-repopulate');
    _renderCards();

    setTimeout(function() {
      _fanContainer.classList.remove('hand-fan-repopulate');
      _animationPhase = 'idle';
      _isAnimating = false;
      try { if (_fanContainer) _fanContainer.classList.remove('hand-fan-interaction-lock'); } catch (e1) {}
    }, 320);
  }

  /**
   * Get selected card indices
   * @returns {Array} Selected card indices
   */
  function getSelectedCards() {
    return _selectedCards.slice();
  }

  /**
   * Return card IDs (not indices) for the currently selected cards.
   * Used by handleStrTimerExpired to resolve combat without per-card animation.
   * @returns {Array<string>} Card IDs for selected cards
   */
  function getSelectedCardIds() {
    var ids = [];
    for (var i = 0; i < _selectedCards.length; i++) {
      var idx = _selectedCards[i];
      if (_cards[idx] && _cards[idx].id) {
        ids.push(_cards[idx].id);
      }
    }
    return ids;
  }

  /**
   * Clear card selection
   */
  function clearSelection() {
    _selectedCards = [];
    _renderCards();
  }

  /**
   * Validate if player can afford a card
   * @param {Object} card - Card data
   * @returns {Object} {canAfford: boolean, missingResources: Array}
   */
  function _validateCardAffordability(card) {
    if (typeof SharedCardRenderer !== 'undefined' && SharedCardRenderer.validateCardAffordability) {
      return SharedCardRenderer.validateCardAffordability(card);
    }
    if (typeof ResourceManager === 'undefined') {
      // No resource manager, assume all cards are affordable
      return { canAfford: true, missingResources: [] };
    }

    // Use ResourceManager to check affordability
    return ResourceManager.canAffordCard(card);
  }

  /**
   * Format resource shortage for display
   * @param {Array} missingResources - Array of missing resource objects
   * @returns {string} Formatted shortage message
   */
  function _formatResourceShortage(missingResources) {
    if (typeof SharedCardRenderer !== 'undefined' && SharedCardRenderer.formatResourceShortage) {
      return SharedCardRenderer.formatResourceShortage(missingResources);
    }
    if (!missingResources || missingResources.length === 0) {
      return '';
    }

    var parts = missingResources.map(function(r) {
      var resourceName = r.resource.charAt(0).toUpperCase() + r.resource.slice(1);
      return resourceName + ' (' + r.current + '/' + r.needed + ')';
    });

    return 'Insufficient ' + parts.join(', ');
  }

  /**
   * Refresh card affordability (call when resources change)
   */
  function refreshAffordability() {
    _renderCards();
  }

  /**
   * Check if the hand fan is currently visible
   * @returns {boolean}
   */
  function isVisible() {
    return _fanContainer !== null && _fanContainer.style.display !== 'none';
  }

  /**
   * Set contextual (non-combat) card selection
   * In contextual mode, only one card can be selected at a time
   * and it stays highlighted until used
   * @param {number} index - Card index to select
   */
  function selectContextualCard(index) {
    // Clear any previous selection
    _selectedCards = [];

    // Select the new card
    if (index >= 0 && index < _cards.length) {
      _selectedCards.push(index);
    }

    // Re-render to show selection
    _renderCards();

    // Add contextual selection class for different visual style
    if (_fanContainer) {
      _fanContainer.classList.add('hand-fan-contextual-mode');
    }
  }

  /**
   * Get the currently selected contextual card
   * @returns {Object|null} Selected card object or null
   */
  function getContextualCard() {
    if (_selectedCards.length > 0 && _cards[_selectedCards[0]]) {
      return _cards[_selectedCards[0]];
    }
    return null;
  }

  /**
   * Clear contextual selection and minimize hand
   * Called after card is used in contextual mode
   */
  function clearContextualSelection() {
    _selectedCards = [];

    // Remove contextual mode class
    if (_fanContainer) {
      _fanContainer.classList.remove('hand-fan-contextual-mode');
    }

    // Minimize the hand after card use
    minimize();

    // Re-render after a brief delay
    setTimeout(function() {
      _renderCards();
    }, 300);
  }

  /**
   * Check if in contextual mode
   * @returns {boolean} True if in contextual mode
   */
  function isContextualMode() {
    return _mode === 'contextual';
  }

  /**
   * Fallback abbreviation function if NameUtils not available
   * Removes vowels except first letter of each word
   * @param {string} name - Full name
   * @param {number} maxLength - Maximum length
   * @returns {string} Abbreviated name
   * @private
   */
  function _abbreviateCardName(name, maxLength) {
    if (!name) return '';

    var words = name.split(/\s+/);
    var result = '';

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (word.length === 0) continue;

      // Take first character of word (even if vowel)
      result += word.charAt(0);

      // Remove vowels from remaining characters
      for (var j = 1; j < word.length; j++) {
        var char = word.charAt(j);
        var lower = char.toLowerCase();
        if (lower !== 'a' && lower !== 'e' && lower !== 'i' && lower !== 'o' && lower !== 'u') {
          result += char;
        }
      }
    }

    return maxLength ? result.substring(0, maxLength) : result;
  }

  // ── Resolution slide-away / slide-back ──────────────────

  var _slidState = 'visible'; // 'visible' | 'away' | 'animating'

  /**
   * Slide the hand fan toward the NCH capsule (minimized HUD) position.
   * Used at the start of the resolution phase so the combat area is clear.
   * @param {Function} [done] - Callback when slide-away completes
   */
  function slideAway(done) {
    if (!_fanContainer || _slidState === 'away') { if (done) done(); return; }
    _slidState = 'animating';

    // Reset z-index layering: next round starts with default center-on-top
    _topCardIndex = -1;

    // Find NCH capsule target position
    var target = document.querySelector('.nch-capsule-wrapper');
    var tx = 0, ty = 0;
    if (target && target.getBoundingClientRect) {
      var tr = target.getBoundingClientRect();
      var fr = _fanContainer.getBoundingClientRect();
      tx = (tr.left + tr.width / 2) - (fr.left + fr.width / 2);
      ty = (tr.top + tr.height / 2) - (fr.top + fr.height / 2);
    } else {
      // Fallback: slide down off-screen
      tx = 0;
      ty = window.innerHeight;
    }

    try {
      // Do NOT use fill:'forwards' — it creates a persistent animation effect
      // that getAnimations().cancel() may fail to clear in some browsers.
      // Instead, bake the end state into inline styles in onfinish.
      var anim = _fanContainer.animate([
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
        { transform: 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(0.15)', opacity: 0.2 }
      ], {
        duration: 300,
        easing: 'ease-in',
        fill: 'none'
      });

      anim.onfinish = function() {
        // Persist end state as inline styles (replaces fill:'forwards')
        _fanContainer.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(0.15)';
        _fanContainer.style.opacity = '0.2';
        _fanContainer.style.pointerEvents = 'none';
        _slidState = 'away';
        if (done) done();
      };
    } catch (e) {
      _fanContainer.style.transform = 'scale(0.15)';
      _fanContainer.style.opacity = '0.2';
      _fanContainer.style.pointerEvents = 'none';
      _slidState = 'away';
      if (done) done();
    }
  }

  /**
   * Slide the hand fan back from the NCH capsule position.
   * Used after the resolution phase completes.
   * @param {Function} [done] - Callback when slide-back completes
   */
  function slideBack(done) {
    if (!_fanContainer || _slidState === 'visible') { if (done) done(); return; }
    _slidState = 'animating';

    // Belt-and-suspenders: cancel any lingering Web Animations API effects
    // AND clear inline styles that slideAway baked in.
    try { _fanContainer.getAnimations().forEach(function(a) { a.cancel(); }); } catch (e) {}
    _fanContainer.style.pointerEvents = '';

    // Read the CSS-class transform so keyframes keep the fan centered.
    // In combat mode _positionRelativeToStrWindow sets translate(-50%,-50%)
    // as inline style, but we just cancelled/cleared everything. Reapply
    // the centering transform so the slide-back animation doesn't jump.
    var cssTransform = 'translate(-50%, -50%)';
    try {
      var cs = window.getComputedStyle(_fanContainer);
      // If the class already supplies a translate via CSS, honour it
      if (cs.transform && cs.transform !== 'none') {
        cssTransform = cs.transform;
      }
    } catch (e) {}

    // Force the element to its shrunken starting state via inline styles
    // (not via animation fill) so there's no ambiguity.
    _fanContainer.style.transform = cssTransform + ' scale(0.15)';
    _fanContainer.style.opacity = '0.2';

    try {
      var anim = _fanContainer.animate([
        { transform: cssTransform + ' scale(0.15)', opacity: 0.2 },
        { transform: cssTransform + ' scale(1)', opacity: 1 }
      ], {
        duration: 300,
        easing: 'ease-out',
        fill: 'none'
      });

      anim.onfinish = function() {
        _slidState = 'visible';
        // Restore to normal: clear inline overrides, let CSS class rule
        _fanContainer.style.transform = '';
        _fanContainer.style.opacity = '';
        if (done) done();
      };
    } catch (e) {
      _slidState = 'visible';
      _fanContainer.style.transform = '';
      _fanContainer.style.opacity = '';
      if (done) done();
    }
  }

  function getSlideState() { return _slidState; }

  /**
   * Force-cancel any active drag / targeting state.
   * Called externally by resolution guards so that the hand fan
   * is in a clean, settled state before resolution animations run.
   */
  function cancelActiveDrag() {
    // 1. Delegate to CardDragController (primary drag system)
    if (typeof CardDragController !== 'undefined' && typeof CardDragController.cancelDrag === 'function') {
      CardDragController.cancelDrag();
    }

    // 2. Cancel legacy targeting state (kept for transition safety)
    if (_targeting.active) {
      _targeting.active = false;
      _targeting.cardIndex = -1;
      _targeting.cardId = null;
      _targeting.pointerId = null;
    }
    if (_targeting.holdTimer) {
      clearTimeout(_targeting.holdTimer);
      _targeting.holdTimer = null;
    }

    // 3. Clean up any residual enemy hover / AoE preview visuals
    _setEnemyHoverState(false, false);
    _clearAoePreview();
    try { document.body.style.cursor = ''; } catch (e) {}
  }

  // Public API
  return {
    init: init,
    show: show,
    hide: hide,
    minimize: minimize,
    restore: restore,
    setMode: setMode,
    updateCards: updateCards,
    playSelectedCards: playSelectedCards,
    repopulateCards: repopulateCards,
    getSelectedCards: getSelectedCards,
    getSelectedCardIds: getSelectedCardIds,
    clearSelection: clearSelection,
    refreshAffordability: refreshAffordability,
    isVisible: isVisible,
    selectContextualCard: selectContextualCard,
    getContextualCard: getContextualCard,
    clearContextualSelection: clearContextualSelection,
    isContextualMode: isContextualMode,
    slideAway: slideAway,
    slideBack: slideBack,
    getSlideState: getSlideState,
    cancelActiveDrag: cancelActiveDrag,
    _dragControllerOwnsMode: false  // set by CardDragController during pointer-drag minimize
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    HandFanComponent.init();
  });
} else {
  HandFanComponent.init();
}
