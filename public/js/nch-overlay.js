/* ============================================================
   NCH Overlay — Portable Capsule Widget (Phase 0)
   ============================================================
   Standalone draggable joker-stack capsule that works on ANY page.
   Two operational modes:

     PORTHOLE MODE (default):
       Joker stack acts as a theme/page-selector toy.
       Click → opens a coin-card fan panel (splash-screen style,
       no background video) for theme selection & page navigation.
       No GoneRogue dependency.

     GAME MODE (when GoneRogue is active):
       Delegates rendering to NonCombatHUD for full deck management.
       Transitions seamlessly when the game launches/exits.

   Position persists per device via localStorage.
   Includes starfield init for pages that need the underlayment.
   ============================================================ */

var NchOverlay = (function () {
  'use strict';

  // ── State ────────────────────────────────────────────────
  var _capsule = null;         // .nch-overlay-wrapper (the draggable pill)
  var _stackEl = null;         // #nch-overlay-stack   (joker container)
  var _fanPanel = null;        // #nch-porthole-fan    (the coin-card overlay)
  var _fanOpen = false;
  var _mode = 'porthole';      // 'porthole' | 'game' | 'transitioning'
  var _initialized = false;
  var _visible = true;

  // Capsule drag
  var _capsuleDrag = null;     // { startX, startY, origLeft, origTop, moved }

  // Card drag-to-reorder (Phase 4)
  var _cardDrag = null;        // { cardEl, ghostEl, placeholderEl, index, startX, startY, grabOffsetX, grabOffsetY, moved }

  // Position persistence
  var POS_KEY = 'EYESONLY_NCH_OVERLAY_POS_V1';
  var ORDER_KEY = 'EYESONLY_NCH_CARD_ORDER_V1';

  // ── Mission / Card Data ──────────────────────────────────
  // Card data — loaded from /data/coin-cards.json at init, with inline fallback.
  // Shared source of truth with splash-screen.js so coin-cards are identical.
  var MISSIONS = [];
  var THEME_MAP = {};
  var PRICING_CONFIG = {};
  var _cardDataLoaded = false;

  var _FALLBACK_MISSIONS = [
    { id: 'scenario-1', title: '1 Day Scenario', desc: 'Live field exercise across Sandpoint, Idaho learn spycraft & treasure hunt to discover new secrets of our local history', suit: '\u2660', suitClass: 'suit-spade', theme: 'silver', classified: 'EYES ONLY', label: 'MISSION DOSSIER', route: '/booking.html#scenario-1', btnLabel: 'BOOK', btnDuration: '24 HR', btnClass: '', duration: '24 HR', defaultGroup: 2, minGroup: 2, maxGroup: 60, tags: [] },
    { id: 'scenario-2', title: '3 Day Scenario', desc: 'Seasonal operation across North Idaho\u2019s destinations. Experience the mystery of the Kaniksu forest.', suit: '\u2663', suitClass: 'suit-club', theme: 'amber', classified: 'TOP SECRET', label: 'MISSION DOSSIER', route: '/booking.html#scenario-2', btnLabel: 'BOOK', btnDuration: '72 HR', btnClass: '', duration: '72 HR', defaultGroup: 3, minGroup: 3, maxGroup: 30, tags: [] },
    { id: 'partner', title: 'Partners', desc: 'For Businesses, Actors, & Hosts', suit: '\u2665', suitClass: 'suit-heart', theme: 'phosphor', classified: 'UNCLASSIFIED', label: 'RECRUITMENT', route: '/partners.html', btnLabel: 'JOIN', btnDuration: 'NOW', btnClass: 'coin-book-partner', duration: null, tags: ['BUSINESSES', 'ACTORS'] },
    { id: 'minigames', title: 'Arcade', desc: 'Decryption keys, Puzzles & Toys', suit: '\u2666', suitClass: 'suit-diamond', theme: 'panther', classified: 'FIELD KIT', label: 'RECREATION', route: '/games.html', btnLabel: 'PLAY', btnDuration: 'NOW', btnClass: 'coin-book-diamond', duration: null, tags: ['PUZZLES', 'DECRYPTION'] },
  ];

  function _loadCardData(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/data/coin-cards.json?v=20260316c', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          MISSIONS = data.missions || _FALLBACK_MISSIONS;
          PRICING_CONFIG = data.pricing || {};
          console.log('[NchOverlay] Loaded ' + MISSIONS.length + ' cards from coin-cards.json');
        } catch (e) {
          console.warn('[NchOverlay] Failed to parse coin-cards.json, using fallback:', e);
          MISSIONS = _FALLBACK_MISSIONS;
        }
      } else {
        console.warn('[NchOverlay] Could not fetch coin-cards.json (status ' + xhr.status + '), using fallback');
        MISSIONS = _FALLBACK_MISSIONS;
      }
      // Build THEME_MAP from missions
      THEME_MAP = {};
      MISSIONS.forEach(function (m) {
        if (m.theme) THEME_MAP[m.id] = m.theme;
      });
      _cardDataLoaded = true;
      if (typeof callback === 'function') callback();
    };
    xhr.send();
  }

  // ── SFX (mirrors splash-screen.js sound arrays) ────────
  var HOVER_SOUNDS   = ['card-slide_card_1', 'card-slide_card_2', 'card-slide_card_3'];
  var SELECT_SOUNDS  = ['card-fold_hand_1', 'card-fold_hand_2', 'card-fold_hand_3'];
  var PICKUP_SOUNDS  = ['card-pick_up_card_1', 'card-pick_up_card_2', 'card-pick_up_card_3'];
  var PUTDOWN_SOUNDS = ['card-place_card_1', 'card-place_card_2', 'card-place_card_3'];
  var REORDER_SOUND  = 'clickandrelease-1';

  function _playAudio(key, opts) {
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      try { AudioSystem.play(key, opts || {}); } catch (_) {}
    }
  }

  // ── Porthole Lens Helpers (Phase 8) ────────────────────────
  //
  // Maps card theme → lens CSS class suffix.
  // Amber card gets blue lens (complementary), phosphor gets amber, etc.
  var THEME_LENS_MAP = {
    silver:  'silver',  // clear/neutral
    amber:   'blue',    // warm gold ↔ cool blue
    phosphor: 'amber',  // green-phosphor ↔ warm amber
    panther: 'pink',    // magenta reinforced
  };

  function _lensClassForTheme(theme) {
    return THEME_LENS_MAP[theme] || 'silver';
  }

  /**
   * Check if a card is the "gold lens" (♣ club / amber theme).
   * Only this card activates constellation tracing.
   */
  function _isGoldLensCard(cardIndex) {
    var mission = MISSIONS[cardIndex];
    return mission && mission.suitClass === 'suit-club';
  }

  /**
   * Activate the porthole lens effect on ANY card during drag.
   * Each card has its own lens technology (silver=aperture, blue=glow,
   * amber=vortex, pink=spin). This fires for ALL cards, not just gold lens.
   */
  function _activateLens(drag) {
    var ghost = drag.ghostEl;
    if (!ghost) return;

    // Activate lens effect on the ghost card (swap idle → active)
    var lensEl = ghost.querySelector('.porthole-lens-overlay');
    if (lensEl) {
      lensEl.classList.remove('lens-idle');
      lensEl.classList.add('lens-active');
    }

    // Flicker the suit symbol off so the porthole sky is unobstructed
    var suitEl = ghost.querySelector('.coin-suit-large');
    if (suitEl) {
      suitEl.classList.remove('suit-flicker-in', 'suit-dimmed');
      suitEl.classList.add('suit-flicker-off');
      setTimeout(function () {
        if (suitEl) {
          suitEl.classList.remove('suit-flicker-off');
          suitEl.classList.add('suit-dimmed');
        }
      }, 260);
    }
  }

  /**
   * Deactivate lens + flicker suit back on the source card.
   */
  function _deactivateLens() {
    if (_cardDrag && _cardDrag.cardEl) {
      // Restore lens to idle state on source card
      var lensEl = _cardDrag.cardEl.querySelector('.porthole-lens-overlay');
      if (lensEl) {
        lensEl.classList.remove('lens-active');
        lensEl.classList.add('lens-idle');
      }
      // Flicker suit symbol back
      var suitEl = _cardDrag.cardEl.querySelector('.coin-suit-large');
      if (suitEl) {
        suitEl.classList.remove('suit-flicker-off', 'suit-dimmed');
        suitEl.classList.add('suit-flicker-in');
        setTimeout(function () { if (suitEl) suitEl.classList.remove('suit-flicker-in'); }, 220);
      }
    }
  }

  /**
   * Start constellation tracing during card drag (gold lens only).
   * Lens activation is handled separately by _activateLens for ALL cards.
   */
  function _startConstellationTrace(drag) {
    if (!_isGoldLensCard(drag.index)) return;
    if (typeof ConstellationTracer === 'undefined') return;
    ConstellationTracer.beginSession();
  }

  // Track previous cursor for drag velocity calculation
  var _prevCursorX = 0;
  var _prevCursorY = 0;
  var _prevTracerState = 'idle';

  /**
   * Update lens velocity glow for ANY dragged card.
   * Also feeds constellation tracer if gold lens is active.
   */
  function _updateLensDuringDrag(ghost) {
    var portholeCanvas = ghost.querySelector('.starfield-window');
    var lensEl = portholeCanvas || ghost;
    var lr = lensEl.getBoundingClientRect();
    var cx = lr.left + lr.width / 2;
    var cy = lr.top + lr.height / 2;

    // Feed constellation tracer (gold lens only)
    if (typeof ConstellationTracer !== 'undefined' && ConstellationTracer.isEnabled()) {
      ConstellationTracer.updateCursor(cx, cy);
    }

    var lensOverlay = ghost.querySelector('.porthole-lens-overlay');

    if (lensOverlay) {
      // Constellation tracing class (gold lens only)
      if (typeof ConstellationTracer !== 'undefined' && ConstellationTracer.isEnabled()) {
        var state = ConstellationTracer.getState();
        if (state === 'hasNode' || state === 'tethered') {
          lensOverlay.classList.add('lens-tracing');
        } else {
          lensOverlay.classList.remove('lens-tracing');
        }

        // Ring pulse on tracer state transitions
        if (state !== _prevTracerState) {
          if (state === 'hasNode' || state === 'tethered') {
            lensOverlay.classList.remove('ring-pulse');
            void lensOverlay.offsetWidth;
            lensOverlay.classList.add('ring-pulse');
            setTimeout(function () {
              if (lensOverlay) lensOverlay.classList.remove('ring-pulse');
            }, 420);
          }
        }
        _prevTracerState = state;
      }

      // ── Drag velocity → ring brightness modulation (ALL cards) ──
      var dx = cx - _prevCursorX;
      var dy = cy - _prevCursorY;
      var speed = Math.sqrt(dx * dx + dy * dy);
      var speedBrightness = 1.0 + Math.min(0.35, speed / 85);
      lensOverlay.style.setProperty('--ring-vel', speedBrightness.toFixed(2));
    }

    _prevCursorX = cx;
    _prevCursorY = cy;
  }

  /**
   * End constellation tracing when card drag ends.
   */
  function _endConstellationTrace() {
    if (typeof ConstellationTracer === 'undefined') return;
    if (ConstellationTracer.isEnabled()) {
      ConstellationTracer.endSession();
    }
  }

  // ── Pricing — Non-linear group scaling (mirrors splash-screen.js) ──

  function _calcPrice(scenario, groupSize) {
    var cfg = PRICING_CONFIG[scenario];
    if (!cfg) return 0;
    var t = Math.min(1, Math.max(0, (groupSize - cfg.min) / (cfg.max - cfg.min)));
    var curved = (cfg.curve === 'linear') ? t : Math.sqrt(t);
    return Math.round(cfg.priceMin + (cfg.priceMax - cfg.priceMin) * curved);
  }

  // Per-card wheel state: { groupSize, price }
  var _cardState = {};

  function _initCardState() {
    MISSIONS.forEach(function (m) {
      if (m.duration !== null && m.defaultGroup) {
        _cardState[m.id] = {
          groupSize: m.defaultGroup,
          price: _calcPrice(m.id, m.defaultGroup),
        };
      }
    });
  }

  // ── Position Persistence ─────────────────────────────────

  function _loadPos() {
    try {
      var raw = localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function _savePos(left, top) {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ left: left, top: top })); } catch (e) {}
  }

  function _clearPos() {
    try { localStorage.removeItem(POS_KEY); } catch (e) {}
  }

  // ── Card Order Persistence ──────────────────────────────

  function _saveCardOrder() {
    try {
      var ids = MISSIONS.map(function (m) { return m.id; });
      localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    } catch (e) {}
  }

  function _restoreCardOrder() {
    try {
      var raw = localStorage.getItem(ORDER_KEY);
      if (!raw) return;
      var ids = JSON.parse(raw);
      if (!Array.isArray(ids) || ids.length !== MISSIONS.length) return;
      // Build lookup by id
      var byId = {};
      MISSIONS.forEach(function (m) { byId[m.id] = m; });
      var reordered = [];
      for (var i = 0; i < ids.length; i++) {
        if (!byId[ids[i]]) return; // corrupt — abort
        reordered.push(byId[ids[i]]);
      }
      // Replace MISSIONS contents in place
      for (var j = 0; j < reordered.length; j++) {
        MISSIONS[j] = reordered[j];
      }
    } catch (e) {}
  }

  function _applyPos() {
    if (!_capsule) return;
    var pos = _loadPos();
    if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
      _capsule.style.bottom = 'auto';
      _capsule.style.right  = 'auto';
      _capsule.style.left   = Math.max(0, Math.min(pos.left, window.innerWidth  - 40)) + 'px';
      _capsule.style.top    = Math.max(0, Math.min(pos.top,  window.innerHeight - 40)) + 'px';
    } else {
      _capsule.style.left   = '';
      _capsule.style.top    = '';
      _capsule.style.bottom = '';
      _capsule.style.right  = '';
    }
  }

  // ── Puzzle Badge (Phase 7) ─────────────────────────────────

  function _updatePuzzleBadge() {
    var badge = document.getElementById('nch-puzzle-badge');
    if (!badge) return;

    if (typeof PuzzleState === 'undefined' || !PuzzleState.getBadgeCount) {
      badge.style.display = 'none';
      return;
    }

    var counts = PuzzleState.getBadgeCount();
    if (counts.found === 0 && counts.solved === 0) {
      badge.style.display = 'none';
      return;
    }

    badge.style.display = '';
    if (counts.solved === counts.totalPuzzles && counts.totalPuzzles > 0) {
      badge.textContent = '\u2713'; // ✓ checkmark — all puzzles solved
      badge.className = 'nch-puzzle-badge nch-puzzle-badge-complete';
    } else {
      badge.textContent = counts.found;
      badge.className = 'nch-puzzle-badge';
    }
  }

  // ── Capsule Creation ─────────────────────────────────────

  function _createCapsule() {
    _capsule = document.createElement('div');
    _capsule.className = 'nch-overlay-wrapper';
    _capsule.setAttribute('tabindex', '-1');
    _capsule.setAttribute('inputmode', 'none');
    _capsule.style.display = _visible ? 'flex' : 'none';
    _capsule.innerHTML =
      '<div class="nch-overlay-inner">' +
        '<div class="nch-overlay-stack" id="nch-overlay-stack"></div>' +
        '<div class="nch-puzzle-badge" id="nch-puzzle-badge" style="display:none;"></div>' +
      '</div>';

    _stackEl = _capsule.querySelector('#nch-overlay-stack');

    // Phase 7: Update puzzle badge when PuzzleState changes
    _updatePuzzleBadge();
    if (typeof PuzzleState !== 'undefined' && PuzzleState.onChange) {
      PuzzleState.onChange(function () { _updatePuzzleBadge(); });
    }

    // ── Drag (pointer events — desktop + mobile) ──────────
    _capsule.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      // Dismiss virtual keyboard on mobile by blurring any focused element
      if (document.activeElement && document.activeElement !== document.body) {
        try { document.activeElement.blur(); } catch (_) {}
      }
      var rect = _capsule.getBoundingClientRect();
      _capsuleDrag = {
        startX: e.clientX,
        startY: e.clientY,
        origLeft: rect.left,
        origTop:  rect.top,
        moved: false,
      };
      _capsule.classList.add('nch-overlay-dragging');
      _capsule.setPointerCapture(e.pointerId);
    });

    _capsule.addEventListener('pointermove', function (e) {
      if (!_capsuleDrag) return;
      var dx = e.clientX - _capsuleDrag.startX;
      var dy = e.clientY - _capsuleDrag.startY;
      if (!_capsuleDrag.moved && Math.sqrt(dx * dx + dy * dy) < 6) return;
      _capsuleDrag.moved = true;
      var newLeft = Math.max(0, Math.min(_capsuleDrag.origLeft + dx, window.innerWidth  - 40));
      var newTop  = Math.max(0, Math.min(_capsuleDrag.origTop  + dy, window.innerHeight - 40));
      _capsule.style.bottom = 'auto';
      _capsule.style.right  = 'auto';
      _capsule.style.left   = newLeft + 'px';
      _capsule.style.top    = newTop  + 'px';
    });

    _capsule.addEventListener('pointerup', function (e) {
      if (!_capsuleDrag) return;
      _capsule.classList.remove('nch-overlay-dragging');
      if (_capsuleDrag.moved) {
        var rect = _capsule.getBoundingClientRect();
        _savePos(rect.left, rect.top);
      } else {
        _handleCapsuleClick();
      }
      _capsuleDrag = null;
    });

    _capsule.addEventListener('pointercancel', function () {
      _capsule.classList.remove('nch-overlay-dragging');
      _capsuleDrag = null;
    });

    document.body.appendChild(_capsule);
    _applyPos();
  }

  // ── Capsule Click Handler ────────────────────────────────

  function _handleCapsuleClick() {
    if (_mode === 'porthole') {
      if (_fanOpen) {
        _closeFan();
      } else {
        _openFan();
      }
    } else if (_mode === 'game') {
      _delegateToGameMode('expand');
    }
  }

  // ── Porthole Mode Rendering ──────────────────────────────

  function _renderPortholeStack() {
    if (!_stackEl || _mode !== 'porthole') return;

    var count = MISSIONS.length;
    var sig = 'p:' + count;
    if (_stackEl.dataset.sig === sig) return;
    _stackEl.dataset.sig = sig;

    _stackEl.innerHTML = '';
    var numJokers = Math.min(count, 8);
    _stackEl.style.width = (numJokers > 0 ? (20 + (numJokers - 1) * 6) : 20) + 'px';

    for (var i = 0; i < numJokers; i++) {
      var j = document.createElement('div');
      j.className = 'nch-overlay-joker joker-' + i;
      j.dataset.themeId = THEME_MAP[MISSIONS[i].id] || '';
      // Layered internals: emoji → dark tint → metallic sheen
      // (real DOM so tint reliably paints over emoji bitmap)
      j.innerHTML =
        '<span class="nch-joker-emoji">\uD83C\uDCCF</span>' +
        '<span class="nch-joker-tint"></span>' +
        '<span class="nch-joker-sheen"></span>';
      _stackEl.appendChild(j);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  PORTHOLE FAN PANEL
  //  Full coin-card fan overlay — identical to splash screen
  //  but without background video. Reuses splash-screen.css.
  // ════════════════════════════════════════════════════════════

  var _hoveredCard = null;

  function _buildCardHTML(mission, index) {
    var theme = THEME_MAP[mission.id] || 'phosphor';
    var cornerTL = '<div class="coin-corner coin-corner-tl"><span class="coin-corner-suit ' +
      mission.suitClass + '">' + mission.suit + '</span></div>';
    var cornerBR = '<div class="coin-corner coin-corner-br"><span class="coin-corner-suit ' +
      mission.suitClass + '">' + mission.suit + '</span></div>';

    var btnClass = mission.btnClass || '';
    var midRow = '<div class="coin-mid-row">' +
      '<button class="coin-book-btn ' + btnClass + '" data-mission="' + mission.id + '" data-index="' + index + '" tabindex="-1" inputmode="none">' +
        '<span class="coin-book-label">' + mission.btnLabel + '</span>' +
        '<span class="coin-book-dot">.</span>' +
        '<span class="coin-book-duration">' + mission.btnDuration + '</span>' +
      '</button>' +
    '</div>';

    // Bottom strip: decoder wheels (bookable missions) or tags
    var bottomStrip = '';
    var isBookable = mission.duration !== null && mission.defaultGroup;
    if (isBookable) {
      var state = _cardState[mission.id] || { groupSize: mission.defaultGroup, price: _calcPrice(mission.id, mission.defaultGroup) };
      bottomStrip =
        '<div class="coin-wheel-strip">' +
          '<div class="coin-wheel" data-wheel="price" data-mission="' + mission.id + '" tabindex="-1" inputmode="none">' +
            '<div class="coin-wheel-frame">' +
              '<div class="coin-wheel-track" id="nch-wheel-price-' + mission.id + '" tabindex="-1" inputmode="none">' +
                '<div class="coin-wheel-val coin-wheel-prev"></div>' +
                '<div class="coin-wheel-val coin-wheel-current">$' + state.price + '</div>' +
                '<div class="coin-wheel-val coin-wheel-next"></div>' +
              '</div>' +
            '</div>' +
            '<div class="coin-wheel-ctx">' + state.groupSize + ' players</div>' +
          '</div>' +
          '<div class="coin-wheel" data-wheel="group" data-mission="' + mission.id + '" tabindex="-1" inputmode="none">' +
            '<div class="coin-wheel-frame">' +
              '<div class="coin-wheel-track" id="nch-wheel-group-' + mission.id + '" tabindex="-1" inputmode="none">' +
                '<div class="coin-wheel-val coin-wheel-prev"></div>' +
                '<div class="coin-wheel-val coin-wheel-current">' + state.groupSize + '</div>' +
                '<div class="coin-wheel-val coin-wheel-next"></div>' +
              '</div>' +
            '</div>' +
            '<div class="coin-wheel-ctx">$' + state.price + '</div>' +
          '</div>' +
        '</div>';
    } else if (mission.tags) {
      bottomStrip = '<div class="coin-tag-strip">' +
        mission.tags.map(function (t) { return '<span class="coin-tag">' + t + '</span>'; }).join('') +
      '</div>';
    }

    return '<div class="splash-dossier coin-card" data-mission="' + mission.id +
      '" data-index="' + index + '" data-card-theme="' + theme + '">' +
      '<div class="coin-border-outer">' +
        '<div class="coin-border-inner">' +
          cornerTL + cornerBR +
          '<div class="coin-header">' +
            '<div class="coin-classified">' + mission.classified + '</div>' +
            '<div class="coin-label">' + mission.label + '</div>' +
          '</div>' +
          '<div class="coin-artwork" data-card-index="' + index + '">' +
            '<canvas class="starfield-window" width="200" height="200"></canvas>' +
            '<div class="porthole-lens-overlay lens-idle lens-' + _lensClassForTheme(mission.theme) + '"></div>' +
            '<div class="coin-rings"></div>' +
            '<div class="coin-suit-large ' + mission.suitClass + '">' + mission.suit + '</div>' +
          '</div>' +
          '<div class="coin-info">' +
            '<div class="coin-title">' + mission.title + '</div>' +
            '<div class="coin-desc">' + mission.desc + '</div>' +
          '</div>' +
          midRow +
          bottomStrip +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function _buildFanPanel() {
    if (_fanPanel) return;

    _fanPanel = document.createElement('div');
    _fanPanel.id = 'nch-porthole-fan';
    _fanPanel.className = 'nch-porthole-fan';
    _fanPanel.style.display = 'none';

    // No backdrop — cards float over page content which stays readable.
    // Close button sits above the card fan.
    _fanPanel.innerHTML =
      '<button class="nch-fan-close-btn" id="nch-fan-close-btn" aria-label="Close" tabindex="-1" inputmode="none">\u2715</button>' +
      '<div class="splash-card-fan" id="nch-card-fan">' +
        MISSIONS.map(function (m, i) { return _buildCardHTML(m, i); }).join('') +
      '</div>';

    document.body.appendChild(_fanPanel);

    // Prevent ANY element in the fan from gaining focus (keyboard prevention)
    _fanPanel.addEventListener('focusin', function (e) {
      if (e.target && e.target !== document.body) {
        try { e.target.blur(); } catch (_) {}
      }
    });

    // Make all interactive elements inside the fan non-focusable
    var allFocusable = _fanPanel.querySelectorAll('button, a, input, select, textarea, [tabindex]');
    allFocusable.forEach(function (el) {
      el.setAttribute('tabindex', '-1');
      el.setAttribute('inputmode', 'none');
    });

    // Close button
    var closeBtn = _fanPanel.querySelector('#nch-fan-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        _closeFan();
      });
    }

    // Bind card interactions
    _bindFanCards();

    // Bind decoder ring wheels
    _bindFanWheels();

    // Initialize wheel displays with prev/next values
    MISSIONS.forEach(function (m) {
      if (_cardState[m.id]) _updateWheelDisplay(m.id);
    });
  }

  function _bindFanCards() {
    if (!_fanPanel) return;
    var cards = _fanPanel.querySelectorAll('.splash-dossier');

    cards.forEach(function (cardEl) {
      var cardIndex = parseInt(cardEl.dataset.index, 10) || 0;

      // Desktop hover (suppress during drag)
      cardEl.addEventListener('mouseenter', function () {
        if (_cardDrag) return;
        if (_hoveredCard && _hoveredCard !== cardEl) {
          _hoveredCard.classList.remove('coin-card-hovered');
        }
        cardEl.classList.add('coin-card-hovered');
        _hoveredCard = cardEl;
        // Hover SFX
        _playAudio(HOVER_SOUNDS[cardIndex % HOVER_SOUNDS.length], { volume: 0.4 });
      });
      cardEl.addEventListener('mouseleave', function () {
        if (_cardDrag || _nchIsDraggingWheel) return;
        cardEl.classList.remove('coin-card-hovered');
        if (_hoveredCard === cardEl) _hoveredCard = null;
      });

      // ── Pointer events for drag-to-reorder ──────────────
      cardEl.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        // Don't drag from the action button or decoder wheels
        if (e.target.closest('.coin-book-btn')) return;
        if (e.target.closest('.coin-wheel')) return;
        if (e.target.closest('.coin-wheel-strip')) return;
        if (_nchIsDraggingWheel || _nchActiveWheelPointerId >= 0) return;
        e.preventDefault();

        var rect = cardEl.getBoundingClientRect();
        _cardDrag = {
          cardEl:       cardEl,
          ghostEl:      null,
          placeholderEl: null,
          index:        parseInt(cardEl.dataset.index, 10),
          startX:       e.clientX,
          startY:       e.clientY,
          grabOffsetX:  e.clientX - rect.left,
          grabOffsetY:  e.clientY - rect.top,
          moved:        false,
        };
        cardEl.setPointerCapture(e.pointerId);
      });

      cardEl.addEventListener('pointermove', function (e) {
        if (!_cardDrag || _cardDrag.cardEl !== cardEl) return;
        var dx = e.clientX - _cardDrag.startX;
        var dy = e.clientY - _cardDrag.startY;
        // Lower threshold on mobile (stacked cards have small exposed strips)
        var threshold = window.innerWidth < 769 ? 5 : 10;
        if (!_cardDrag.moved && Math.sqrt(dx * dx + dy * dy) < threshold) return;

        // First move past threshold — begin drag
        if (!_cardDrag.moved) {
          _cardDrag.moved = true;
          _beginCardDrag(_cardDrag);
        }
        _moveCardGhost(e.clientX, e.clientY);
        _updateDropGap(e.clientX, e.clientY);
      });

      cardEl.addEventListener('pointerup', function (e) {
        if (!_cardDrag || _cardDrag.cardEl !== cardEl) return;
        if (_cardDrag.moved) {
          _endCardDrag(false);
        } else {
          // Tap — treat as click → select mission
          _cardDrag = null;
          _selectMission(cardEl);
        }
      });

      cardEl.addEventListener('pointercancel', function () {
        if (_cardDrag && _cardDrag.cardEl === cardEl) {
          _endCardDrag(true);
        }
      });

      // BOOK/PLAY button click → select mission
      var btn = cardEl.querySelector('.coin-book-btn');
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          _selectMission(cardEl);
        });
      }
    });
  }

  // ── Decoder Ring Wheel Logic (mirrors splash-screen.js) ──

  function _updateWheelDisplay(missionId) {
    var state = _cardState[missionId];
    if (!state) return;
    var mission = null;
    for (var i = 0; i < MISSIONS.length; i++) {
      if (MISSIONS[i].id === missionId) { mission = MISSIONS[i]; break; }
    }
    if (!mission) return;

    // Update group wheel
    var groupTrack = document.getElementById('nch-wheel-group-' + missionId);
    if (groupTrack) {
      var prevG = state.groupSize > mission.minGroup ? state.groupSize - 1 : '';
      var nextG = state.groupSize < mission.maxGroup ? state.groupSize + 1 : '';
      groupTrack.querySelector('.coin-wheel-prev').textContent = prevG;
      groupTrack.querySelector('.coin-wheel-current').textContent = state.groupSize;
      groupTrack.querySelector('.coin-wheel-next').textContent = nextG;
    }

    // Update price wheel
    var priceTrack = document.getElementById('nch-wheel-price-' + missionId);
    if (priceTrack) {
      var prevPrice = state.groupSize > mission.minGroup
        ? '$' + _calcPrice(missionId, state.groupSize - 1) : '';
      var nextPrice = state.groupSize < mission.maxGroup
        ? '$' + _calcPrice(missionId, state.groupSize + 1) : '';
      priceTrack.querySelector('.coin-wheel-prev').textContent = prevPrice;
      priceTrack.querySelector('.coin-wheel-current').textContent = '$' + state.price;
      priceTrack.querySelector('.coin-wheel-next').textContent = nextPrice;
    }

    // Update context labels
    if (_fanPanel) {
      var card = _fanPanel.querySelector('[data-mission="' + missionId + '"]');
      if (card) {
        var priceWheel = card.querySelector('[data-wheel="price"] .coin-wheel-ctx');
        var groupWheel = card.querySelector('[data-wheel="group"] .coin-wheel-ctx');
        if (priceWheel) priceWheel.textContent = state.groupSize + ' players';
        if (groupWheel) groupWheel.textContent = '$' + state.price;
      }
    }
  }

  function _adjustGroup(missionId, delta) {
    var state = _cardState[missionId];
    var mission = null;
    for (var i = 0; i < MISSIONS.length; i++) {
      if (MISSIONS[i].id === missionId) { mission = MISSIONS[i]; break; }
    }
    if (!state || !mission) return;

    var newSize = state.groupSize + delta;
    if (newSize < mission.minGroup || newSize > mission.maxGroup) return;

    state.groupSize = newSize;
    state.price = _calcPrice(missionId, newSize);

    _playAudio(REORDER_SOUND, { volume: 0.35 });
    _updateWheelDisplay(missionId);

    // Persist to sessionStorage for booking page pickup
    try {
      sessionStorage.setItem('eo_group_size', String(state.groupSize));
      sessionStorage.setItem('eo_price', String(state.price));
    } catch (_) {}
  }

  var _nchActiveWheelPointerId = -1;
  var _nchIsDraggingWheel = false;

  function _bindFanWheels() {
    if (!_fanPanel) return;
    var wheels = _fanPanel.querySelectorAll('.coin-wheel');
    wheels.forEach(function (wheel) {
      var missionId = wheel.dataset.mission;
      var ownerCard = null;
      var dragStartY = null;
      var dragAccum = 0;
      var lastDragDir = 0;
      var edgeAccelTimer = null;
      var edgeAccelDelay = 200;
      var dragMoved = false;

      function getOwnerCard() {
        if (!ownerCard) ownerCard = wheel.closest('.coin-card');
        return ownerCard;
      }

      function isInsideCard(x, y) {
        var card = getOwnerCard();
        if (!card) return true;
        var r = card.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      }

      function startEdgeAccel(dir) {
        if (edgeAccelTimer) return;
        edgeAccelDelay = 200;
        function tick() { _adjustGroup(missionId, dir); }
        tick();
        edgeAccelTimer = setInterval(function () {
          tick();
          if (edgeAccelDelay > 50) {
            edgeAccelDelay = Math.max(50, edgeAccelDelay - 30);
            clearInterval(edgeAccelTimer);
            edgeAccelTimer = setInterval(tick, edgeAccelDelay);
          }
        }, edgeAccelDelay);
      }

      function stopEdgeAccel() {
        if (edgeAccelTimer) { clearInterval(edgeAccelTimer); edgeAccelTimer = null; }
      }

      function endWheelDrag() {
        dragStartY = null;
        _nchIsDraggingWheel = false;
        _nchActiveWheelPointerId = -1;
        stopEdgeAccel();
      }

      // Click cycles up (only if pointer didn't drag)
      wheel.addEventListener('click', function (e) {
        e.stopPropagation();
        if (dragMoved) return;
        _adjustGroup(missionId, 1);
      });

      // Right-click cycles down
      wheel.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        _adjustGroup(missionId, -1);
      });

      // Unified pointer down
      wheel.addEventListener('pointerdown', function (e) {
        if (_nchActiveWheelPointerId >= 0) return;
        e.preventDefault();
        e.stopPropagation();
        // Blur to prevent keyboard
        if (document.activeElement && document.activeElement !== document.body) {
          try { document.activeElement.blur(); } catch (_) {}
        }
        dragStartY = e.clientY;
        dragAccum = 0;
        lastDragDir = 0;
        dragMoved = false;
        _nchIsDraggingWheel = true;
        _nchActiveWheelPointerId = e.pointerId;
        try { wheel.setPointerCapture(e.pointerId); } catch (_) {}

        // Hover the card while dragging
        var card = getOwnerCard();
        if (card && _hoveredCard !== card) {
          if (_hoveredCard) _hoveredCard.classList.remove('coin-card-hovered');
          card.classList.add('coin-card-hovered');
          _hoveredCard = card;
        }
      });

      wheel.addEventListener('pointermove', function (e) {
        if (_nchActiveWheelPointerId !== e.pointerId || dragStartY === null) return;
        var x = e.clientX, y = e.clientY;
        if (Math.abs(y - dragStartY) > 3) dragMoved = true;

        if (!isInsideCard(x, y)) {
          if (lastDragDir !== 0 && !edgeAccelTimer) startEdgeAccel(lastDragDir);
          dragStartY = y;
          return;
        }

        stopEdgeAccel();
        var dy = dragStartY - y;
        dragAccum += dy;
        dragStartY = y;

        while (dragAccum > 20) {
          _adjustGroup(missionId, 1);
          lastDragDir = 1; dragAccum -= 20;
        }
        while (dragAccum < -20) {
          _adjustGroup(missionId, -1);
          lastDragDir = -1; dragAccum += 20;
        }
      });

      wheel.addEventListener('pointerup', function (e) {
        if (_nchActiveWheelPointerId !== e.pointerId) return;
        try { wheel.releasePointerCapture(e.pointerId); } catch (_) {}
        endWheelDrag();
      });

      wheel.addEventListener('pointercancel', function (e) {
        if (_nchActiveWheelPointerId !== e.pointerId) return;
        endWheelDrag();
      });

      wheel.addEventListener('lostpointercapture', function () {
        if (_nchActiveWheelPointerId >= 0) endWheelDrag();
      });

      // Scroll wheel on the element
      wheel.addEventListener('wheel', function (e) {
        e.preventDefault();
        e.stopPropagation();
        _adjustGroup(missionId, e.deltaY > 0 ? 1 : -1);
      }, { passive: false });
    });
  }

  // ── Card Drag Reveal Rendering ──────────────────────────
  // Renders RevealGrid zone content inside the card drag ghost's
  // porthole area (coin-artwork) using the same in-porthole approach
  // as magnifying-glass-drag.js.

  var _cardRevealEl = null;    // current reveal content inside card ghost
  var _cardRevealZoneId = null;

  function _updateCardRevealContent(ghost) {
    if (!window.RevealGrid || !ghost) {
      _clearCardRevealContent();
      return;
    }

    var reveal = RevealGrid.getActiveReveal();
    if (!reveal) {
      _clearCardRevealContent();
      return;
    }

    // Find the coin-artwork porthole area in the ghost
    var artwork = ghost.querySelector('.coin-artwork');
    if (!artwork) return;

    // Create reveal element if zone changed or doesn't exist
    if (!_cardRevealEl || _cardRevealZoneId !== reveal.zoneId) {
      _clearCardRevealContent();
      _cardRevealZoneId = reveal.zoneId;

      var el = document.createElement('div');
      el.className = 'nch-card-reveal-preview';
      el.style.cssText = [
        'position: absolute',
        'inset: 0',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'flex-direction: column',
        'pointer-events: none',
        'will-change: transform, opacity',
        'z-index: 5',
        'border-radius: 50%',
        'overflow: hidden'
      ].join(';');

      if (reveal.type === 'item') {
        el.innerHTML =
          '<span style="font-size:48px;line-height:1">' + (reveal.emoji || '❓') + '</span>' +
          (reveal.label
            ? '<span style="display:block;font-size:9px;color:var(--phosphor,#1cff9b);' +
              'text-transform:uppercase;letter-spacing:0.1em;margin-top:3px;' +
              'text-shadow:0 0 6px var(--phosphor-glow,rgba(28,255,155,0.4))">' +
              reveal.label + '</span>'
            : '');
      } else {
        el.textContent = reveal.emoji || '🔎';
        el.style.fontSize = '48px';
      }

      // Insert after starfield canvas, before coin-rings
      var canvas = artwork.querySelector('.starfield-window');
      artwork.insertBefore(el, canvas ? canvas.nextSibling : null);
      _cardRevealEl = el;
    }

    // Update position/opacity each frame
    if (_cardRevealEl) {
      _cardRevealEl.style.opacity = reveal.opacity;
      _cardRevealEl.style.transform = 'translate(' + reveal.offsetX + 'px, ' + reveal.offsetY + 'px)';

      if (reveal.locked && !_cardRevealEl.dataset.locked) {
        _cardRevealEl.dataset.locked = '1';
        _cardRevealEl.style.filter = 'drop-shadow(0 0 8px var(--phosphor-glow, rgba(28,255,155,0.5)))';
      }
    }
  }

  function _clearCardRevealContent() {
    if (_cardRevealEl && _cardRevealEl.parentNode) {
      _cardRevealEl.parentNode.removeChild(_cardRevealEl);
    }
    _cardRevealEl = null;
    _cardRevealZoneId = null;
  }

  // ── Card Drag-to-Reorder Internals ───────────────────────

  // Theme primary colors for placeholder — keyed by data-card-theme.
  // Avoids inheriting the body's applied theme; shows the CARD's color instead.
  var THEME_COLORS = {
    silver:  { border: 'rgba(176, 196, 222, 0.5)', bg: 'rgba(176, 196, 222, 0.06)' },
    amber:   { border: 'rgba(255, 176, 0, 0.5)',   bg: 'rgba(255, 176, 0, 0.06)'   },
    phosphor:{ border: 'rgba(51, 255, 51, 0.5)',    bg: 'rgba(51, 255, 51, 0.06)'    },
    panther: { border: 'rgba(255, 48, 144, 0.5)',   bg: 'rgba(255, 48, 144, 0.06)'   },
  };

  function _beginCardDrag(drag) {
    var cardEl = drag.cardEl;
    var isMobile = window.innerWidth < 769;

    // Remove hover from all cards
    if (_hoveredCard) {
      _hoveredCard.classList.remove('coin-card-hovered');
      _hoveredCard = null;
    }

    // ── Ghost (mirrors splash-screen's _createDragGhost exactly) ──
    var rect = cardEl.getBoundingClientRect();
    var ghost = cardEl.cloneNode(true);
    var ghostW = Math.round(rect.width);
    var ghostH = Math.round(rect.height);
    var ghostRadius = isMobile ? '8px' : '16px';

    // CRITICAL: coin-card-hovered has !important on transform + z-index
    // which overrides inline drag positioning. coin-card-ghost provides
    // hover visuals while letting inline transform/z-index work.
    ghost.classList.remove('coin-card-hovered', 'splash-selected', 'nch-fan-card-dragging');
    ghost.classList.add('coin-card-ghost');

    ghost.style.cssText = [
      'position: fixed',
      'top: ' + (drag.startY - ghostH / 2) + 'px',
      'left: ' + (drag.startX - ghostW / 2) + 'px',
      'width: ' + ghostW + 'px',
      'height: ' + ghostH + 'px',
      'opacity: 0.94',
      'pointer-events: none',
      'transition: transform 0.12s ease-out, opacity 0.12s ease-out, box-shadow 0.12s ease-out',
      'box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(180,160,80,0.12)',
      'border-radius: ' + ghostRadius,
      'will-change: transform, left, top',
      'overflow: hidden',
    ].join('; ');
    var dragScale = isMobile ? 1.20 : 1.05;
    ghost.style.setProperty('transform', 'scale(' + dragScale + ') rotate(0deg)', 'important');
    ghost.style.setProperty('z-index', '100000', 'important');

    // Center grab offset on the ghost (same as splash-screen)
    drag.grabOffsetX = ghostW / 2;
    drag.grabOffsetY = ghostH / 2;

    document.body.appendChild(ghost);
    drag.ghostEl = ghost;

    // Begin RevealGrid lens session (card's porthole aperture is the lens)
    if (window.RevealGrid) {
      var portholeCanvas = ghost.querySelector('.starfield-window');
      var lensEl = portholeCanvas || ghost;
      var lr = lensEl.getBoundingClientRect();
      RevealGrid.beginLensSession({
        left: lr.left, top: lr.top,
        right: lr.right, bottom: lr.bottom,
        width: lr.width, height: lr.height,
      });
    }

    // Phase 8: Activate porthole lens effect on ANY dragged card
    _activateLens(drag);

    // Phase 8: Begin constellation tracing if this is the gold lens (♣ club) card
    _startConstellationTrace(drag);

    // ── Placeholder (mirrors splash-screen's _createDragPlaceholder) ──
    var cs = window.getComputedStyle(cardEl);
    var placeholder = document.createElement('div');
    placeholder.className = 'splash-card-placeholder';
    placeholder.style.width = rect.width + 'px';
    placeholder.style.height = rect.height + 'px';
    placeholder.style.margin = cs.margin;
    placeholder.style.flexShrink = '0';

    // On mobile, cards have per-nth-child transform + z-index for the
    // vertical stack layout. Copy these onto the placeholder so it sits
    // in the exact same visual slot the card occupied.
    if (isMobile) {
      placeholder.style.transform = cs.transform;
      placeholder.style.zIndex = cs.zIndex;
    }

    // Color the placeholder to match the CARD's theme, not the body's.
    // Splash-screen's .splash-card-placeholder uses var(--theme-btn-border)
    // which resolves from the body theme — wrong when dragging a different card.
    var cardTheme = cardEl.dataset.cardTheme || '';
    var tc = THEME_COLORS[cardTheme];
    if (tc) {
      placeholder.style.borderColor = tc.border;
      placeholder.style.background = tc.bg;
    }

    cardEl.parentNode.insertBefore(placeholder, cardEl);
    drag.placeholderEl = placeholder;

    // Hide original card
    cardEl.classList.add('nch-fan-card-dragging');

    // Pickup SFX
    var pickIdx = drag.index % PICKUP_SOUNDS.length;
    _playAudio(PICKUP_SOUNDS[pickIdx], { volume: 0.4 });
  }

  function _moveCardGhost(clientX, clientY) {
    if (!_cardDrag || !_cardDrag.ghostEl) return;
    var ghost = _cardDrag.ghostEl;
    ghost.style.left = (clientX - _cardDrag.grabOffsetX) + 'px';
    ghost.style.top  = (clientY - _cardDrag.grabOffsetY) + 'px';

    // Subtle tilt based on horizontal drag delta (same as splash-screen)
    var dx = clientX - _cardDrag.startX;
    var tilt = Math.max(-8, Math.min(8, dx * 0.04));
    var dragScale = window.innerWidth < 769 ? 1.20 : 1.05;
    ghost.style.setProperty('transform', 'scale(' + dragScale + ') rotate(' + tilt + 'deg)', 'important');

    // Update RevealGrid lens position (porthole aperture, not full card)
    if (window.RevealGrid) {
      var portholeCanvas = ghost.querySelector('.starfield-window');
      var lensEl = portholeCanvas || ghost;
      var lr = lensEl.getBoundingClientRect();
      RevealGrid.updateLens({
        left: lr.left, top: lr.top,
        right: lr.right, bottom: lr.bottom,
        width: lr.width, height: lr.height,
      });
      // Render zone content inside card's porthole area
      _updateCardRevealContent(ghost);
    }

    // Phase 8: Update lens velocity + constellation tracer
    _updateLensDuringDrag(ghost);
  }

  function _updateDropGap(clientX, clientY) {
    // Find which gap the cursor is closest to and move the placeholder there.
    // Desktop: compare X (horizontal fan). Mobile: compare Y (vertical stack).
    if (!_cardDrag || !_cardDrag.placeholderEl) return;
    var fanEl = _fanPanel.querySelector('#nch-card-fan');
    if (!fanEl) return;

    var isMobile = window.innerWidth < 769;
    var cards = fanEl.querySelectorAll('.splash-dossier:not(.nch-fan-card-dragging)');
    var placeholder = _cardDrag.placeholderEl;

    // Find insert position: before which visible card?
    var insertBefore = null;
    for (var i = 0; i < cards.length; i++) {
      var rect = cards[i].getBoundingClientRect();
      if (isMobile) {
        // Vertical stack: compare Y midpoints
        var midY = rect.top + rect.height / 2;
        if (clientY < midY) {
          insertBefore = cards[i];
          break;
        }
      } else {
        // Horizontal fan: compare X midpoints
        var midX = rect.left + rect.width / 2;
        if (clientX < midX) {
          insertBefore = cards[i];
          break;
        }
      }
    }

    // Move placeholder to the right gap (only if it actually changes position)
    var moved = false;
    if (insertBefore) {
      if (placeholder.nextElementSibling !== insertBefore) {
        fanEl.insertBefore(placeholder, insertBefore);
        moved = true;
      }
    } else {
      // After all cards — append (but before the dragging card if it's last)
      var dragging = fanEl.querySelector('.nch-fan-card-dragging');
      if (dragging) {
        if (placeholder.nextElementSibling !== dragging) {
          fanEl.insertBefore(placeholder, dragging);
          moved = true;
        }
      } else if (placeholder !== fanEl.lastElementChild) {
        fanEl.appendChild(placeholder);
        moved = true;
      }
    }

    // Reorder SFX when placeholder snaps to a new position
    if (moved) {
      _playAudio(REORDER_SOUND, { volume: 0.35 });
    }
  }

  // ── Edge-of-screen detection for drag-to-select ─────────
  var EDGE_MARGIN = 60; // px from any viewport edge triggers selection

  function _isNearScreenEdge(x, y) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    return (x < EDGE_MARGIN || x > vw - EDGE_MARGIN ||
            y < EDGE_MARGIN || y > vh - EDGE_MARGIN);
  }

  function _endCardDrag(cancelled) {
    if (!_cardDrag) return;
    var drag = _cardDrag;
    _cardDrag = null;

    // End RevealGrid lens session before cleanup
    if (window.RevealGrid) {
      RevealGrid.endLensSession();
    }
    _clearCardRevealContent();

    // Phase 8: Deactivate lens + end constellation tracing
    _deactivateLens();
    _endConstellationTrace();

    var cardEl = drag.cardEl;
    var ghost = drag.ghostEl;
    var placeholder = drag.placeholderEl;
    var fanEl = _fanPanel ? _fanPanel.querySelector('#nch-card-fan') : null;

    // Detect drag-to-edge → select/navigate instead of reorder
    var lastX = ghost ? parseFloat(ghost.style.left) + drag.grabOffsetX : 0;
    var lastY = ghost ? parseFloat(ghost.style.top) + drag.grabOffsetY : 0;
    var droppedOnEdge = !cancelled && drag.moved && _isNearScreenEdge(lastX, lastY);

    // Remove ghost
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);

    // Restore card visibility
    cardEl.classList.remove('nch-fan-card-dragging');

    if (droppedOnEdge) {
      // Drag-to-edge: select this mission (navigate to its page)
      // Remove placeholder first
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
      }
      _playAudio(PUTDOWN_SOUNDS[(drag.index || 0) % PUTDOWN_SOUNDS.length], { volume: 0.5 });
      _selectMission(cardEl);
      return;
    }

    if (!cancelled && placeholder && fanEl) {
      // Insert card at placeholder position (this is the reorder)
      fanEl.insertBefore(cardEl, placeholder);

      // Read new order from DOM
      var newOrder = [];
      var domCards = fanEl.querySelectorAll('.splash-dossier');
      domCards.forEach(function (c) { newOrder.push(c.dataset.mission); });

      // Update MISSIONS array to match
      _reorderMissions(newOrder);
    }

    // Remove placeholder
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }

    // Update data-index attributes to reflect new order
    if (fanEl) {
      var allCards = fanEl.querySelectorAll('.splash-dossier');
      allCards.forEach(function (c, i) {
        c.dataset.index = i;
        var btn = c.querySelector('.coin-book-btn');
        if (btn) btn.dataset.index = i;
      });
    }

    // Refresh joker stack to reflect new card order
    if (_stackEl) _stackEl.dataset.sig = '';
    _renderPortholeStack();

    // Putdown SFX
    var putIdx = (drag.index || 0) % PUTDOWN_SOUNDS.length;
    _playAudio(PUTDOWN_SOUNDS[putIdx], { volume: 0.5 });
  }

  function _reorderMissions(idOrder) {
    var byId = {};
    MISSIONS.forEach(function (m) { byId[m.id] = m; });
    for (var i = 0; i < idOrder.length; i++) {
      if (byId[idOrder[i]]) MISSIONS[i] = byId[idOrder[i]];
    }
    _saveCardOrder();
  }

  function _selectMission(cardEl) {
    var missionId = cardEl.dataset.mission;
    var mission = null;
    for (var i = 0; i < MISSIONS.length; i++) {
      if (MISSIONS[i].id === missionId) { mission = MISSIONS[i]; break; }
    }
    if (!mission) return;

    // Easter egg: if amber (scenario-2) is in the last card position
    // and partner card is selected, activate white theme
    var selectedTheme = THEME_MAP[missionId] || 'phosphor';
    var lastMission = MISSIONS.length > 0 ? MISSIONS[MISSIONS.length - 1] : null;
    if (missionId === 'partner' && lastMission && lastMission.id === 'scenario-2') {
      selectedTheme = 'white';
    }

    // Apply theme (use ThemeWidget if available for starfield palette sync)
    if (typeof ThemeWidget !== 'undefined' && ThemeWidget.apply) {
      ThemeWidget.apply(selectedTheme);
      document.documentElement.setAttribute('data-theme', selectedTheme);
    } else {
      document.body.setAttribute('data-theme', selectedTheme);
      document.documentElement.setAttribute('data-theme', selectedTheme);
      try { localStorage.setItem('eyesonly_theme', selectedTheme); } catch (e) {}
      // Sync starfield palette manually if ThemeWidget not loaded
      if (typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.isRunning && EyesOnlyStarfield.isRunning()) {
        var sfPalette = (selectedTheme === 'white') ? 'white' : (EyesOnlyStarfield.PALETTES[selectedTheme] ? selectedTheme : 'night');
        EyesOnlyStarfield.setPalette(sfPalette);
      }
    }

    // Persist wheel state for booking page pre-fill
    if (_cardState[missionId]) {
      try {
        sessionStorage.setItem('eo_group_size', String(_cardState[missionId].groupSize));
        sessionStorage.setItem('eo_price', String(_cardState[missionId].price));
      } catch (_) {}
    }

    // Visual feedback
    cardEl.classList.add('splash-selected');

    // Selection SFX
    var selIdx = parseInt(cardEl.dataset.index, 10) || 0;
    _playAudio(SELECT_SOUNDS[selIdx % SELECT_SOUNDS.length], { volume: 0.6 });

    // Fan exit animation, then navigate
    setTimeout(function () {
      var fanEl = _fanPanel.querySelector('#nch-card-fan');
      if (fanEl) fanEl.classList.add('splash-fan-exit');
    }, 100);

    setTimeout(function () {
      _closeFan();
      if (mission.route) {
        // If we're already on the target page, just apply theme and close
        var currentPath = window.location.pathname;
        var targetPath = mission.route.split('#')[0];
        if (currentPath === targetPath || targetPath === '') {
          // Same page — just apply theme, already done above
        } else {
          window.location.href = mission.route;
        }
      }
    }, 600);
  }

  // ── Fan Open / Close ─────────────────────────────────────

  // ── Fan Open / Close (Morph Transitions) ────────────────
  //
  // Open:  capsule zooms toward screen center via JS-computed
  //        translate, crossfading into the card fan.
  // Close: fan zooms out, capsule materializes at center and
  //        curves back to its parked position.

  function _getCapsuleCenter() {
    if (!_capsule) return { x: window.innerWidth / 2, y: window.innerHeight - 80 };
    var r = _capsule.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function _getFanCenter() {
    // Fan is centered horizontally, bottom: 80px
    return { x: window.innerWidth / 2, y: window.innerHeight - 80 };
  }

  function _openFan() {
    if (_fanOpen) return;
    _fanOpen = true;

    // Dismiss virtual keyboard on mobile before opening fan
    if (document.activeElement && document.activeElement !== document.body) {
      try { document.activeElement.blur(); } catch (_) {}
    }

    // Expand SFX — shuffle sound as cards fan out
    _playAudio('card-shuffle_4', { volume: 0.5 });

    // Build panel if first time
    _buildFanPanel();

    // ── Phase A: Capsule zooms toward fan center ──────────
    var capPos = _getCapsuleCenter();
    var fanPos = _getFanCenter();
    var dx = fanPos.x - capPos.x;
    var dy = fanPos.y - capPos.y;

    if (_capsule) {
      // Enable transition, then set target transform
      _capsule.classList.add('nch-capsule-morphing');
      // Force from current position (no transform yet)
      void _capsule.offsetWidth;
      _capsule.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(1.2)';
      _capsule.style.opacity = '0';
    }

    // Ensure starfield is running for porthole canvases
    if (typeof EyesOnlyStarfield !== 'undefined') {
      if (!EyesOnlyStarfield.isRunning()) {
        EyesOnlyStarfield.init();
      }
    }

    // ── Phase B: Crossfade — fan appears as capsule fades ─
    // Remove previous exit class if re-opening
    var fanEl = _fanPanel.querySelector('#nch-card-fan');
    if (fanEl) fanEl.classList.remove('splash-fan-exit');

    // Reset card states
    var cards = _fanPanel.querySelectorAll('.splash-dossier');
    cards.forEach(function (c) {
      c.classList.remove('splash-selected', 'coin-card-hovered', 'nch-fan-card-dragging');
    });
    _hoveredCard = null;

    // Set up fan for morph-in: start scaled down + hidden
    _fanPanel.style.display = '';
    _fanPanel.classList.remove('nch-fan-active', 'nch-fan-morph-exit');
    _fanPanel.classList.add('nch-fan-morphing', 'nch-fan-morph-enter');
    void _fanPanel.offsetWidth; // force reflow

    // Trigger the transition to active state
    _fanPanel.classList.add('nch-fan-active');

    // ── Phase C: Cleanup after transitions complete ────────
    setTimeout(function () {
      if (_capsule) {
        _capsule.style.display = 'none';
        _capsule.classList.remove('nch-capsule-morphing');
        _capsule.style.transform = '';
        _capsule.style.opacity = '';
      }
      if (_fanPanel) {
        _fanPanel.classList.remove('nch-fan-morphing', 'nch-fan-morph-enter');
      }
    }, 400);

    // If the virtual keyboard STILL opens somehow, counteract it by
    // re-blurring whenever the visual viewport shrinks (keyboard appearing).
    if (window.visualViewport) {
      _fanViewportHandler = function () {
        // If viewport height is significantly smaller than window height,
        // the keyboard is likely open — force blur to dismiss it
        if (window.visualViewport.height < window.innerHeight * 0.85) {
          if (document.activeElement && document.activeElement !== document.body) {
            try { document.activeElement.blur(); } catch (_) {}
          }
        }
      };
      window.visualViewport.addEventListener('resize', _fanViewportHandler);
    }

    // Escape key closes
    _fanEscHandler = function (e) {
      if (e.key === 'Escape') _closeFan();
    };
    document.addEventListener('keydown', _fanEscHandler);
  }

  var _fanEscHandler = null;
  var _fanViewportHandler = null;

  function _closeFan() {
    if (!_fanOpen) return;
    _fanOpen = false;

    // Collapse SFX — UI close sound
    _playAudio('ui-01', { volume: 0.5 });

    // Cancel any active card drag
    if (_cardDrag) _endCardDrag(true);

    if (_fanEscHandler) {
      document.removeEventListener('keydown', _fanEscHandler);
      _fanEscHandler = null;
    }
    if (_fanViewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', _fanViewportHandler);
      _fanViewportHandler = null;
    }

    // ── Phase A: Fan zooms out + fades ────────────────────
    if (_fanPanel) {
      _fanPanel.classList.add('nch-fan-morphing');
      void _fanPanel.offsetWidth;
      _fanPanel.classList.remove('nch-fan-active');
      _fanPanel.classList.add('nch-fan-morph-exit');
    }

    // ── Phase B: Capsule materializes at fan center, curves home ─
    if (_capsule && _visible) {
      // Bounds check — clamp saved position to current viewport
      var pos = _loadPos();
      var homeLeft, homeTop;
      if (pos && typeof pos.left === 'number') {
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        homeLeft = Math.max(0, Math.min(pos.left, vw - 40));
        homeTop  = Math.max(0, Math.min(pos.top,  vh - 40));
        if (homeLeft !== pos.left || homeTop !== pos.top) {
          _savePos(homeLeft, homeTop);
        }
      } else {
        // No saved pos — use CSS default (bottom-right)
        homeLeft = window.innerWidth - 60;
        homeTop  = window.innerHeight - 80;
      }

      // Start capsule at fan center position with offset
      var fanPos = _getFanCenter();
      var startDx = fanPos.x - homeLeft - 25; // ~center of capsule width
      var startDy = fanPos.y - homeTop - 14;  // ~center of capsule height

      _capsule.style.bottom = 'auto';
      _capsule.style.right  = 'auto';
      _capsule.style.left   = homeLeft + 'px';
      _capsule.style.top    = homeTop + 'px';
      // Start at fan center via translate offset, scaled up
      _capsule.style.transform = 'translate(' + startDx + 'px, ' + startDy + 'px) scale(1.2)';
      _capsule.style.opacity = '0';
      _capsule.style.display = 'flex';

      // Enable morph transition, then animate to home (transform: none)
      void _capsule.offsetWidth; // force reflow
      _capsule.classList.add('nch-capsule-morphing');
      void _capsule.offsetWidth;
      _capsule.style.transform = 'translate(0, 0) scale(1)';
      _capsule.style.opacity = '1';
    }

    // ── Phase C: Cleanup after transitions complete ────────
    setTimeout(function () {
      if (_fanPanel) {
        _fanPanel.style.display = 'none';
        _fanPanel.classList.remove('nch-fan-morphing', 'nch-fan-morph-exit', 'nch-fan-morph-enter');
      }
      if (_capsule) {
        _capsule.classList.remove('nch-capsule-morphing');
        _capsule.style.transform = '';
        _capsule.style.opacity = '';
      }
    }, 400);
  }

  // ── Game Mode Bridge ─────────────────────────────────────

  function _delegateToGameMode(action) {
    if (typeof NonCombatHUD === 'undefined') return;
    if (action === 'expand') {
      NonCombatHUD.setMinimized(false, 'nch_overlay_click');
    }
  }

  function _enterGameMode() {
    if (_mode === 'game') return;
    var prevMode = _mode;
    _mode = 'transitioning';

    // Close fan if open
    if (_fanOpen) _closeFan();

    if (_capsule) _capsule.classList.add('nch-overlay-transitioning');

    setTimeout(function () {
      _mode = 'game';
      if (_capsule) {
        _capsule.classList.remove('nch-overlay-transitioning');
        _capsule.style.display = 'none';
      }
      if (typeof NonCombatHUD !== 'undefined' && NonCombatHUD.init) {
        NonCombatHUD.init();
      }
      window.dispatchEvent(new CustomEvent('nch-overlay:entered-game-mode', {
        detail: { previousMode: prevMode }
      }));
    }, 300);
  }

  function _exitGameMode() {
    if (_mode !== 'game') return;
    _mode = 'porthole';

    if (_capsule) {
      _capsule.style.display = _visible ? 'flex' : 'none';
      _stackEl.dataset.sig = '';
      _renderPortholeStack();
    }

    window.dispatchEvent(new CustomEvent('nch-overlay:exited-game-mode'));
  }

  // ── Mode Detection Polling ───────────────────────────────

  function _pollMode() {
    var rogueActive = false;
    try {
      rogueActive = (typeof GoneRogue !== 'undefined' &&
                     GoneRogue.isActive && GoneRogue.isActive());
    } catch (e) {}

    if (rogueActive && _mode === 'porthole') {
      _enterGameMode();
    } else if (!rogueActive && _mode === 'game') {
      _exitGameMode();
    }
  }

  // ── Starfield Init Helper ────────────────────────────────

  function _initStarfield(opts) {
    if (typeof EyesOnlyStarfield !== 'undefined' && !EyesOnlyStarfield.isRunning()) {
      EyesOnlyStarfield.init(opts || {});
    }
  }

  // ── Public API ───────────────────────────────────────────

  function init(opts) {
    if (_initialized) return;
    _initialized = true;
    opts = opts || {};

    if (opts.visible === false) _visible = false;

    // Load card data from external JSON, then build capsule
    _loadCardData(function () {
      _initCardState();
      _restoreCardOrder();
      _createCapsule();
      _renderPortholeStack();

      if (opts.autoStarfield !== false) {
        _initStarfield(opts.starfieldOpts || {});
      }

      // Phase 8: Initialize constellation subsystems
      if (typeof SuitNodeRenderer !== 'undefined') SuitNodeRenderer.init();
      if (typeof ConstellationGamestate !== 'undefined') ConstellationGamestate.init();
      if (typeof ConstellationRewards !== 'undefined') ConstellationRewards.init();
      if (typeof ConstellationTracer !== 'undefined') ConstellationTracer.init();
      if (typeof ConstellationLoader !== 'undefined') ConstellationLoader.init();

      setInterval(_pollMode, 500);

      window.addEventListener('gone-rogue-started', function () {
        if (_mode === 'porthole') _enterGameMode();
      });
      window.addEventListener('gone-rogue-ended', function () {
        if (_mode === 'game') _exitGameMode();
      });
    });
  }

  function destroy() {
    _closeFan();
    if (_fanPanel && _fanPanel.parentNode) _fanPanel.parentNode.removeChild(_fanPanel);
    if (_capsule && _capsule.parentNode) _capsule.parentNode.removeChild(_capsule);
    _capsule = null;
    _stackEl = null;
    _fanPanel = null;
    _initialized = false;
    _mode = 'porthole';
  }

  function show() {
    _visible = true;
    if (_capsule && _mode !== 'game') _capsule.style.display = 'flex';
  }

  function hide() {
    _visible = false;
    if (_capsule) _capsule.style.display = 'none';
    _closeFan();
  }

  function resetPosition() {
    _clearPos();
    if (_capsule) {
      _capsule.style.left   = '';
      _capsule.style.top    = '';
      _capsule.style.bottom = '';
      _capsule.style.right  = '';
    }
  }

  function getMode() { return _mode; }

  function isFanOpen() { return _fanOpen; }

  function openFan()  { _openFan();  }
  function closeFan() { _closeFan(); }

  function enterGameMode()  { _enterGameMode(); }
  function exitGameMode()   { _exitGameMode();  }

  function getCapsuleElement() { return _capsule; }

  return {
    init:             init,
    destroy:          destroy,
    show:             show,
    hide:             hide,
    resetPosition:    resetPosition,
    getMode:          getMode,
    isFanOpen:        isFanOpen,
    openFan:          openFan,
    closeFan:         closeFan,
    enterGameMode:    enterGameMode,
    exitGameMode:     exitGameMode,
    getCapsuleElement: getCapsuleElement,
  };
})();
