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

  // Press-and-hold targeting state (Option 1: tap selects, hold targets)
  var _targeting = {
    active: false,
    cardIndex: -1,
    holdTimer: null,
    holdMs: 180,
    pointerId: null,
    startedAt: 0
  };

  // DOM elements
  var _fanContainer = null;

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
    _mode = mode;
    _position = position;

    if (_mode === 'hidden') {
      hide();
      return;
    }

    _updateFanPosition();
    _renderCards();
  }

  /**
   * Show the hand fan
   * @param {Array} cards - Array of card objects
   */
  function show(cards) {
    _cards = cards || [];
    _mode = 'combat';
    _position = 'centered';

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
    _fanContainer.classList.add('hand-fan-disappear');

    setTimeout(function() {
      _fanContainer.style.display = 'none';
      _fanContainer.classList.remove('hand-fan-disappear');
      _fanContainer.classList.remove('hand-fan-minimized'); // Remove minimized state
    }, 300);
  }

  /**
   * Minimize hand to single transparent card (during turn resolution)
   */
  function _animateCollapseToMiniIcon(done) {
    if (!_fanContainer) return done && done();

    var mini = document.getElementById('hand-fan-mini-indicator') || document.getElementById('str-combat-minimized');
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

    // Animate toward mini icon, then apply minimized class
    _animateCollapseToMiniIcon(function() {
      _fanContainer.classList.add('hand-fan-minimized');
    });
  }

  function _ensureMiniIndicator() {
    var el = document.getElementById('hand-fan-mini-indicator');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'hand-fan-mini-indicator';
    el.className = 'hand-fan-mini-indicator';
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }

  function _timerColorForPercent(pct) {
    // pct: 0..1
    function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

    var stops = [
      { p: 1.00, c: [ 76, 175,  80] }, // green
      { p: 0.80, c: [  0, 150, 136] }, // teal
      { p: 0.60, c: [255, 193,   7] }, // yellow
      { p: 0.40, c: [255, 152,   0] }, // orange
      { p: 0.20, c: [255,  87,  34] }, // red-orange
      { p: 0.10, c: [244,  67,  54] }, // deep red
      { p: 0.00, c: [244,  67,  54] }
    ];

    pct = Math.max(0, Math.min(1, pct));

    for (var i = 0; i < stops.length - 1; i++) {
      var a = stops[i];
      var b = stops[i + 1];
      if (pct <= a.p && pct >= b.p) {
        var span = (a.p - b.p) || 1;
        var t = (a.p - pct) / span;
        var r = lerp(a.c[0], b.c[0], t);
        var g = lerp(a.c[1], b.c[1], t);
        var bl = lerp(a.c[2], b.c[2], t);
        return 'rgb(' + r + ',' + g + ',' + bl + ')';
      }
    }

    return 'rgb(244,67,54)';
  }

  function flashMiniIndicator(kind) {
    var el = _ensureMiniIndicator();
    if (!el) return;

    // Coalesce by restarting the animation
    el.classList.remove('mini-flash');
    // force reflow
    void el.offsetWidth;
    el.classList.add('mini-flash');

    setTimeout(function() {
      el.classList.remove('mini-flash');
    }, 420);
  }

  function updateMiniIndicator(opts) {
    opts = opts || {};
    var el = _ensureMiniIndicator();

    var visible = !!opts.visible;
    el.style.display = visible ? 'block' : 'none';
    if (!visible) return;

    // Critical class based on timer
    if (opts.timerPercent != null && opts.timerPercent < 0.20) {
      el.classList.add('mini-critical');
    } else {
      el.classList.remove('mini-critical');
    }

    // Position: stacked above the STR minimized indicator
    var anchor = document.getElementById('str-combat-minimized');
    if (anchor) {
      var r = anchor.getBoundingClientRect();
      el.style.left = Math.round(r.left) + 'px';
      el.style.top = Math.round(r.top - 18) + 'px';
    }

    // Emoji + card count badge
    el.innerHTML = '';
    var emojiSpan = document.createElement('span');
    emojiSpan.className = 'mini-emoji';
    emojiSpan.textContent = opts.emoji || '🃏';
    el.appendChild(emojiSpan);

    var countSpan = document.createElement('span');
    countSpan.className = 'mini-count';
    countSpan.textContent = String(opts.count != null ? opts.count : 0);
    el.appendChild(countSpan);

    // Color: reflect timer percent
    if (opts.timerPercent != null) {
      var col = _timerColorForPercent(opts.timerPercent);
      el.style.borderColor = col;
      el.style.boxShadow = '0 0 12px ' + col + '66';
    }
  }

  /**
   * Restore hand from minimized state
   */
  function restore() {
    _fanContainer.classList.remove('hand-fan-minimized');
  }

  /**
   * Update cards in the fan
   * @param {Array} cards - New card array
   */
  function updateCards(cards) {
    _cards = cards || [];
    _renderCards();
  }

  /**
   * Update fan position based on mode and position
   */
  function _updateFanPosition() {
    _fanContainer.className = 'hand-fan-container';

    if (_mode === 'combat' && _position === 'centered') {
      _fanContainer.classList.add('hand-fan-combat');
    } else if (_mode === 'combat' && _position === 'peripheral') {
      _fanContainer.classList.add('hand-fan-combat-peripheral');
    } else if (_mode === 'contextual' && _position === 'bottom') {
      _fanContainer.classList.add('hand-fan-contextual');
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
    var cardWrapper = document.createElement('div');
    cardWrapper.className = 'hand-card-wrapper';
    cardWrapper.dataset.cardIndex = index;

    // Apply fan transformation
    _applyFanTransform(cardWrapper, index, _cards.length);

    // Create card element
    var cardEl = document.createElement('div');
    cardEl.className = 'hand-card';

    // Make card draggable
    cardEl.draggable = true;

    // Apply lifecycle-based transparency
    var lifecycle = _getCardLifecycle(card);
    cardEl.classList.add('hand-card-' + lifecycle);

    // Check if selected
    if (_selectedCards.indexOf(index) !== -1) {
      cardEl.classList.add('hand-card-selected');
    }

    // Apply quality border color
    if (card.quality || card.qualityName) {
      var quality = (card.quality || card.qualityName).toLowerCase().replace(/ /g, '_');
      cardEl.dataset.quality = quality;
    }

    // === RESOURCE VALIDATION ===
    // Check if player can afford this card
    var affordability = _validateCardAffordability(card);
    if (!affordability.canAfford) {
      cardEl.classList.add('card-insufficient-resources');
      cardEl.dataset.unaffordable = 'true';

      // Store shortage info for tooltip
      if (affordability.missingResources && affordability.missingResources.length > 0) {
        var shortageText = _formatResourceShortage(affordability.missingResources);
        cardEl.dataset.resourceShortage = shortageText;
        cardEl.title = shortageText; // Basic browser tooltip
      }
    }

    // Card content
    var html = '';

    // Cost badge (top-left)
    if (card.cost !== undefined && card.cost !== null) {
      html += '<div class="hand-card-cost">' + card.cost + '</div>';
    }

    // Card artwork/emoji (80% of card height) - tiny icon
    html += '<div class="hand-card-artwork">';
    html += '<div class="hand-card-emoji">' + (card.emoji || '🃏') + '</div>';
    html += '</div>';

    // Card name (bottom) - abbreviated for compact display in combat
    var cardName = card.name || 'Unknown Card';

    // Default: do NOT abbreviate unless we need to.
    // Only abbreviate aggressively when mobile portrait + minimized/collapsed.
    var maxLen = 0;
    try {
      var isPortrait = (window && window.innerHeight && window.innerWidth) ? (window.innerHeight > window.innerWidth) : false;
      var strMini = (typeof STRCombatWindow !== 'undefined' && STRCombatWindow.isMinimized && STRCombatWindow.isMinimized());
      var fanMini = _fanContainer && (_fanContainer.classList.contains('hand-fan-minimized') || _fanContainer.classList.contains('hand-fan-collapsing'));
      if (isPortrait && (strMini || fanMini)) {
        maxLen = 4;
      }
    } catch (e) {}

    if (typeof NameUtils !== 'undefined' && NameUtils.getDisplayName) {
      cardName = NameUtils.getDisplayName(card, { maxLength: maxLen });
    } else {
      cardName = _abbreviateCardName(cardName, maxLen);
    }

    html += '<div class="hand-card-name">' + cardName + '</div>';

    // Effect icons (if any)
    if (card.effects && card.effects.length > 0) {
      html += '<div class="hand-card-effects">';
      card.effects.slice(0, 3).forEach(function(effect) {
        html += '<span class="hand-card-effect-icon">' + (effect.icon || '•') + '</span>';
      });
      html += '</div>';
    }

    cardEl.innerHTML = html;

    // Selection badge (if selected)
    var selectionIndex = _selectedCards.indexOf(index);
    if (selectionIndex !== -1) {
      var badge = document.createElement('div');
      badge.className = 'hand-card-selection-badge';
      badge.textContent = selectionIndex + 1;
      cardEl.appendChild(badge);
    }

    // Attach event handlers
    _attachCardHandlers(cardEl, card, index);

    cardWrapper.appendChild(cardEl);
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

    // Z-index (center cards on top)
    var zIndex = 100 - Math.abs(offset * 10);

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
    // Map card types to lifecycle categories
    var lifecycle = card.lifecycleType || card.lifecycle || card.consumable || 'core';

    var lifecycleMap = {
      'disposable': 'consumable',
      'LIFE_001': 'consumable',
      'exhaust': 'exhaust',
      'LIFE_002': 'exhaust',
      'power': 'power',
      'LIFE_003': 'power',
      'gated': 'gated',
      'LIFE_004': 'gated',
      'persistent': 'core',
      'LIFE_005': 'core',
      'core': 'core'
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

  function _beginHoldTargeting(cardEl, index, pointerId) {
    _targeting.active = true;
    _targeting.cardIndex = index;
    _targeting.pointerId = pointerId;
    _targeting.startedAt = Date.now();

    var dragCollapse = {
      collapsed: false,
      prevX: null,
      prevY: null,
      prevT: null
    };

    cardEl.classList.add('hand-card-targeting');
    try { document.body.style.cursor = 'crosshair'; } catch (e) {}
    _setEnemyHoverState(true, false);

    function _maybeCollapseCombatUi(ev) {
      if (typeof STRCombatWindow === 'undefined' || typeof STRCombatWindow.isMinimized !== 'function') return;

      // Only collapse if the pointer exits the combat window bounds meaningfully.
      var win = document.getElementById('str-combat-window');
      if (!win) return;
      var rect = win.getBoundingClientRect();

      var dxOut = 0;
      var dyOut = 0;
      if (ev.clientX < rect.left) dxOut = rect.left - ev.clientX;
      else if (ev.clientX > rect.right) dxOut = ev.clientX - rect.right;
      if (ev.clientY < rect.top) dyOut = rect.top - ev.clientY;
      else if (ev.clientY > rect.bottom) dyOut = ev.clientY - rect.bottom;

      var outDist = Math.max(dxOut, dyOut);
      var threshold = Math.round(Math.min(rect.width, rect.height) * 0.15);

      // Velocity supplement
      var now = Date.now();
      var speed = 0;
      if (dragCollapse.prevT != null) {
        var dt = Math.max(1, now - dragCollapse.prevT);
        var ddx = ev.clientX - dragCollapse.prevX;
        var ddy = ev.clientY - dragCollapse.prevY;
        var dist = Math.sqrt(ddx * ddx + ddy * ddy);
        speed = (dist / dt) * 1000;
      }
      dragCollapse.prevX = ev.clientX;
      dragCollapse.prevY = ev.clientY;
      dragCollapse.prevT = now;

      var fastExit = speed >= 800;
      var exited = outDist >= threshold;

      if (!dragCollapse.collapsed && (exited || fastExit)) {
        // Collapse only when exiting toward the world/map area (avoid collapsing toward random UI)
        var grid = document.getElementById('rogue-grid');
        if (grid) {
          var g = grid.getBoundingClientRect();
          var towardGrid = (ev.clientX >= g.left && ev.clientX <= g.right && ev.clientY >= g.top && ev.clientY <= g.bottom);
          if (towardGrid) {
            STRCombatWindow.minimize();
            dragCollapse.collapsed = true;
          }
        } else {
          // If we don't have a grid element, still allow collapse (better than blocking drag)
          STRCombatWindow.minimize();
          dragCollapse.collapsed = true;
        }
      }
    }

    // Attach global listeners until release/cancel
    function onMove(ev) {
      if (!_targeting.active) return;
      if (ev.pointerId != null && _targeting.pointerId != null && ev.pointerId !== _targeting.pointerId) return;

      _maybeCollapseCombatUi(ev);

      var overEnemy = _isEnemyUnderPointer(ev.clientX, ev.clientY);
      _setEnemyHoverState(true, overEnemy);

      // AOE preview for map-deployable cards
      _scheduleAoePreviewUpdate(ev.clientX, ev.clientY, index);
    }

    function onUp(ev) {
      if (!_targeting.active) return;
      if (ev.pointerId != null && _targeting.pointerId != null && ev.pointerId !== _targeting.pointerId) return;

      var overEnemy = _isEnemyUnderPointer(ev.clientX, ev.clientY);
      var idx = _targeting.cardIndex;
      _targeting.active = false;
      _targeting.cardIndex = -1;
      _targeting.pointerId = null;

      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);

      _clearTargetingVisuals(cardEl);

      var didDeployGroundEffect = false;

      // Release over enemy = play immediately (canonical hook)
      if (overEnemy && typeof GoneRogue !== 'undefined') {
        var c = _cards && _cards[idx] ? _cards[idx] : null;
        if (c && c.id && typeof GoneRogue.playCardFromHand === 'function') {
          GoneRogue.playCardFromHand(c.id);
          return;
        }
        if (typeof GoneRogue.handleMultiCardCombat === 'function') {
          GoneRogue.handleMultiCardCombat([idx]);
          return;
        }
      }

      // Drag-to-map ground effects (v1): if released over a grid cell while STR UI is minimized/collapsed
      try {
        var elAt = document.elementFromPoint(ev.clientX, ev.clientY);
        var cell = elAt ? elAt.closest && elAt.closest('.rogue-cell') : null;
        if (cell && cell.dataset && cell.dataset.x != null && cell.dataset.y != null) {
          var gx = Number(cell.dataset.x);
          var gy = Number(cell.dataset.y);

          var mapping = (typeof GroundEffectCardMappings !== 'undefined' && GroundEffectCardMappings.getMappingForCard) ? GroundEffectCardMappings.getMappingForCard(_cards[idx]) : null;
          if (mapping && typeof GroundEffects !== 'undefined' && typeof GroundEffects.setGroundEffect === 'function') {
            var overrides = {};
            if (mapping.lifetimeSec && mapping.lifetimeSec > 0) {
              overrides.dissipates = true;
              overrides.lifetime = mapping.lifetimeSec;
            }

            // Radius v1: apply to a square radius (designer can tune later)
            var r = Number(mapping.radius || 0);
            for (var dy = -r; dy <= r; dy++) {
              for (var dx = -r; dx <= r; dx++) {
                var tx = gx + dx;
                var ty = gy + dy;

                // ICE gate: freeze water/toxic waste into ice for locomotive passability
                if (mapping.type === 'ICE' && typeof GroundEffects.freezeAt === 'function') {
                  GroundEffects.freezeAt(tx, ty, { lifetime: mapping.lifetimeSec });
                } else {
                  GroundEffects.setGroundEffect(tx, ty, mapping.type, overrides);
                }
              }
            }

            // Consume card from loose inventory
            if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.getLooseInventory === 'function') {
              var loose = GAMESTATE.getLooseInventory();
              if (Array.isArray(loose) && loose[idx]) {
                loose.splice(idx, 1);
                if (typeof HandFanComponent !== 'undefined' && typeof HandFanComponent.updateCards === 'function') {
                  HandFanComponent.updateCards(loose);
                }
              }
            }

            if (typeof TooltipSystem !== 'undefined') {
              TooltipSystem.showPersistent('🌋 DEPLOYED ' + (mapping.type || 'EFFECT') + ' @(' + gx + ',' + gy + ')', 1300);
            }

            didDeployGroundEffect = true;
          }
        }
      } catch (e) {}

      // Restore full combat window if we collapsed it during this drag.
      // If we deployed a ground effect, leave the window minimized briefly so
      // the player can see the map feedback/animation, then pop STR back.
      if (dragCollapse.collapsed && typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.maximize === 'function') {
        if (didDeployGroundEffect) {
          setTimeout(function() {
            try { STRCombatWindow.maximize(); } catch (e4) {}
          }, 750);
        } else {
          STRCombatWindow.maximize();
        }
      }
    }

    function onCancel(ev) {
      if (!_targeting.active) return;
      if (ev.pointerId != null && _targeting.pointerId != null && ev.pointerId !== _targeting.pointerId) return;

      _targeting.active = false;
      _targeting.cardIndex = -1;
      _targeting.pointerId = null;

      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);

      _clearTargetingVisuals(cardEl);

      if (dragCollapse.collapsed && typeof STRCombatWindow !== 'undefined' && typeof STRCombatWindow.maximize === 'function') {
        STRCombatWindow.maximize();
      }
    }

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
  }

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

    // Press-and-hold targeting (enemy default)
    cardEl.addEventListener('pointerdown', function(e) {
      if (_isAnimating) {
        // Don't drop the first click during repopulate; queue a selection.
        _toggleCardSelection(index);
        return;
      }

      // Only enable this behavior during STR combat mode
      if (_mode !== 'combat') return;

      // Don't start targeting if card is unaffordable
      if (cardEl.dataset.unaffordable === 'true') return;

      // Only primary button
      if (e && e.button != null && e.button !== 0) return;

      // Setup hold timer
      if (_targeting.holdTimer) {
        clearTimeout(_targeting.holdTimer);
        _targeting.holdTimer = null;
      }

      var pointerId = e.pointerId;
      _targeting.pointerId = pointerId;
      _targeting.holdTimer = setTimeout(function() {
        _targeting.holdTimer = null;
        _beginHoldTargeting(cardEl, index, pointerId);
      }, _targeting.holdMs);

      // If user releases quickly, cancel timer (tap will be handled by click)
      function cleanup(ev) {
        if (ev.pointerId != null && pointerId != null && ev.pointerId !== pointerId) return;
        if (_targeting.holdTimer) {
          clearTimeout(_targeting.holdTimer);
          _targeting.holdTimer = null;
        }
        window.removeEventListener('pointerup', cleanup, true);
        window.removeEventListener('pointercancel', cleanup, true);
      }

      window.addEventListener('pointerup', cleanup, true);
      window.addEventListener('pointercancel', cleanup, true);
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

    // Drag handlers for disposal system and commerce
    cardEl.addEventListener('dragstart', function(e) {
      // Check if shop is open for sell operations
      var isShopOpen = (typeof ShopSystem !== 'undefined' && ShopSystem.isOpen && ShopSystem.isOpen());

      if (isShopOpen && typeof CommerceDragDropSystem !== 'undefined') {
        // Commerce drag (sell to shop)
        CommerceDragDropSystem.handleDragStart({
          sourceZone: 'player_hand',
          itemId: card.id || ('card_' + index),
          itemType: 'card',
          cardData: card,
          itemPrice: 0  // Will be calculated by system
        });
        cardEl.classList.add('dragging-sell');
      } else if (typeof CardDisposalSystem !== 'undefined') {
        // Disposal drag (recycle/destroy)
        CardDisposalSystem.handleDragStart(cardEl, card, index, 'hand');
      }
    });

    cardEl.addEventListener('dragend', function(e) {
      cardEl.classList.remove('dragging-sell');

      // Check if shop is open
      var isShopOpen = (typeof ShopSystem !== 'undefined' && ShopSystem.isOpen && ShopSystem.isOpen());

      if (isShopOpen && typeof CommerceDragDropSystem !== 'undefined') {
        CommerceDragDropSystem.handleDragEnd();
      } else if (typeof CardDisposalSystem !== 'undefined') {
        CardDisposalSystem.handleDragEnd();
      }
    });

    // Hover tooltip - show card details immediately on mouseenter
    cardEl.addEventListener('mouseenter', function() {
      _showCardTooltip(card, cardEl);
    });

    cardEl.addEventListener('mouseleave', function() {
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
      }
    }

    // Fast path: update classes & badges in-place instead of full DOM rebuild.
    // This prevents the animation restart / visual quiver that occurs when
    // _renderCards() destroys and re-creates every card element.
    if (_fanContainer && _fanContainer.children.length > 0) {
      var wrappers = _fanContainer.querySelectorAll('.hand-card-wrapper');
      var patchedOk = wrappers.length > 0;

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

      // If fast path succeeded, skip full re-render
      if (patchedOk) return;
    }

    // Fallback: full re-render (initial render, or DOM is in unexpected state)
    _renderCards();
  }

  /**
   * Show card tooltip
   * @param {Object} card - Card data
   * @param {HTMLElement} cardEl - Card element
   */
  function _showCardTooltip(card, cardEl) {
    // Create tooltip element if it doesn't exist
    var tooltip = document.getElementById('hand-card-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'hand-card-tooltip';
      tooltip.className = 'hand-card-tooltip';
      document.body.appendChild(tooltip);
    }

    // Build tooltip content
    var html = '';
    html += '<div class="tooltip-title">' + (card.name || 'Unknown Card') + '</div>';

    if (card.description) {
      html += '<div class="tooltip-description">' + card.description + '</div>';
    }

    html += '<div class="tooltip-stats">';
    if (card.cost !== undefined) {
      html += '<div class="tooltip-stat">Cost: <span>' + card.cost + '</span></div>';
    }
    if (card.damage !== undefined) {
      html += '<div class="tooltip-stat">Damage: <span>' + card.damage + '</span></div>';
    }
    if (card.qualityName) {
      html += '<div class="tooltip-stat">Quality: <span>' + card.qualityName + '</span></div>';
    }
    html += '</div>';

    tooltip.innerHTML = html;

    // Position tooltip near card
    var rect = cardEl.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - 10) + 'px';
    tooltip.style.transform = 'translate(-50%, -100%)';
    tooltip.style.display = 'block';
  }

  /**
   * Hide card tooltip
   */
  function _hideCardTooltip() {
    var tooltip = document.getElementById('hand-card-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
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
          } else if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.handleMultiCardCombat === 'function') {
            GoneRogue.handleMultiCardCombat(capturedIndices);
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
    // Check if ResourceManager is available
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
    clearSelection: clearSelection,
    refreshAffordability: refreshAffordability,
    updateMiniIndicator: updateMiniIndicator,
    flashMiniIndicator: flashMiniIndicator,
    isVisible: isVisible,
    selectContextualCard: selectContextualCard,
    getContextualCard: getContextualCard,
    clearContextualSelection: clearContextualSelection,
    isContextualMode: isContextualMode
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
