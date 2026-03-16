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
  // Same MISSIONS structure as splash-screen.js so the coin-cards
  // are identical. When the fan opens, these build real coin-card DOM
  // reusing splash-screen.css classes.
  var MISSIONS = [
    {
      id: 'scenario-1',
      title: '1 Day Scenario',
      desc: 'Live field exercise across Sandpoint, Idaho learn spycraft & treasure hunt to discover new secrets of our local history',
      suit: '\u2660',            // ♠
      suitClass: 'suit-spade',
      classified: 'EYES ONLY',
      label: 'MISSION DOSSIER',
      route: '/booking.html#scenario-1',
      btnLabel: 'BOOK',
      btnDuration: '24 HR',
      btnClass: '',
    },
    {
      id: 'scenario-2',
      title: '3 Day Scenario',
      desc: 'Seasonal operation across North Idaho\u2019s destinations. Experience the mystery of the Kaniksu forest.',
      suit: '\u2663',            // ♣
      suitClass: 'suit-club',
      classified: 'TOP SECRET',
      label: 'MISSION DOSSIER',
      route: '/booking.html#scenario-2',
      btnLabel: 'BOOK',
      btnDuration: '72 HR',
      btnClass: '',
    },
    {
      id: 'partner',
      title: 'Partners',
      desc: 'For Businesses, Actors, & Hosts',
      suit: '\u2665',            // ♥
      suitClass: 'suit-heart',
      classified: 'UNCLASSIFIED',
      label: 'RECRUITMENT',
      route: '/partners.html',
      btnLabel: 'JOIN',
      btnDuration: 'NOW',
      btnClass: 'coin-book-partner',
    },
    {
      id: 'minigames',
      title: 'Arcade',
      desc: 'Decryption keys, Puzzles & Toys',
      suit: '\u2666',            // ♦
      suitClass: 'suit-diamond',
      classified: 'FIELD KIT',
      label: 'RECREATION',
      route: '/games.html',
      btnLabel: 'PLAY',
      btnDuration: 'NOW',
      btnClass: 'coin-book-diamond',
      tags: ['PUZZLES', 'DECRYPTION'],
    },
  ];

  var THEME_MAP = {
    'scenario-1': 'silver',
    'scenario-2': 'amber',
    'partner':    'phosphor',
    'minigames':  'panther',
  };

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

  // ── Capsule Creation ─────────────────────────────────────

  function _createCapsule() {
    _capsule = document.createElement('div');
    _capsule.className = 'nch-overlay-wrapper';
    _capsule.style.display = _visible ? 'flex' : 'none';
    _capsule.innerHTML =
      '<div class="nch-overlay-inner">' +
        '<div class="nch-overlay-stack" id="nch-overlay-stack"></div>' +
      '</div>';

    _stackEl = _capsule.querySelector('#nch-overlay-stack');

    // ── Drag (pointer events — desktop + mobile) ──────────
    _capsule.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
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
      '<button class="coin-book-btn ' + btnClass + '" data-mission="' + mission.id + '" data-index="' + index + '">' +
        '<span class="coin-book-label">' + mission.btnLabel + '</span>' +
        '<span class="coin-book-dot">.</span>' +
        '<span class="coin-book-duration">' + mission.btnDuration + '</span>' +
      '</button>' +
    '</div>';

    var bottomStrip = '';
    if (mission.tags) {
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
      '<button class="nch-fan-close-btn" id="nch-fan-close-btn" aria-label="Close">\u2715</button>' +
      '<div class="splash-card-fan" id="nch-card-fan">' +
        MISSIONS.map(function (m, i) { return _buildCardHTML(m, i); }).join('') +
      '</div>';

    document.body.appendChild(_fanPanel);

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
  }

  function _bindFanCards() {
    if (!_fanPanel) return;
    var cards = _fanPanel.querySelectorAll('.splash-dossier');

    cards.forEach(function (cardEl) {
      // Desktop hover (suppress during drag)
      cardEl.addEventListener('mouseenter', function () {
        if (_cardDrag) return;
        if (_hoveredCard && _hoveredCard !== cardEl) {
          _hoveredCard.classList.remove('coin-card-hovered');
        }
        cardEl.classList.add('coin-card-hovered');
        _hoveredCard = cardEl;
      });
      cardEl.addEventListener('mouseleave', function () {
        if (_cardDrag) return;
        cardEl.classList.remove('coin-card-hovered');
        if (_hoveredCard === cardEl) _hoveredCard = null;
      });

      // ── Pointer events for drag-to-reorder ──────────────
      cardEl.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        // Don't drag from the action button
        if (e.target.closest('.coin-book-btn')) return;
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
    ghost.style.setProperty('transform', 'scale(0.92) rotate(0deg)', 'important');
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

    // Sound feedback
    try {
      if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
        AudioSystem.play('card-fold_hand_1', { volume: 0.25 });
      }
    } catch (e) {}
  }

  function _moveCardGhost(clientX, clientY) {
    if (!_cardDrag || !_cardDrag.ghostEl) return;
    var ghost = _cardDrag.ghostEl;
    ghost.style.left = (clientX - _cardDrag.grabOffsetX) + 'px';
    ghost.style.top  = (clientY - _cardDrag.grabOffsetY) + 'px';

    // Subtle tilt based on horizontal drag delta (same as splash-screen)
    var dx = clientX - _cardDrag.startX;
    var tilt = Math.max(-8, Math.min(8, dx * 0.04));
    ghost.style.setProperty('transform', 'scale(0.92) rotate(' + tilt + 'deg)', 'important');

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
    }
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
    if (insertBefore) {
      if (placeholder.nextElementSibling !== insertBefore) {
        fanEl.insertBefore(placeholder, insertBefore);
      }
    } else {
      // After all cards — append (but before the dragging card if it's last)
      var dragging = fanEl.querySelector('.nch-fan-card-dragging');
      if (dragging) {
        fanEl.insertBefore(placeholder, dragging);
      } else if (placeholder !== fanEl.lastElementChild) {
        fanEl.appendChild(placeholder);
      }
    }
  }

  function _endCardDrag(cancelled) {
    if (!_cardDrag) return;
    var drag = _cardDrag;
    _cardDrag = null;

    // End RevealGrid lens session before cleanup
    if (window.RevealGrid) {
      RevealGrid.endLensSession();
    }

    var cardEl = drag.cardEl;
    var ghost = drag.ghostEl;
    var placeholder = drag.placeholderEl;
    var fanEl = _fanPanel ? _fanPanel.querySelector('#nch-card-fan') : null;

    // Remove ghost
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);

    // Restore card visibility
    cardEl.classList.remove('nch-fan-card-dragging');

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

    // Sound feedback
    try {
      if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
        AudioSystem.play('card-fold_hand_1', { volume: 0.2 });
      }
    } catch (e) {}
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

    // Apply theme
    var selectedTheme = THEME_MAP[missionId] || 'phosphor';
    document.body.setAttribute('data-theme', selectedTheme);
    document.documentElement.setAttribute('data-theme', selectedTheme);
    try { localStorage.setItem('eyesonly_theme', selectedTheme); } catch (e) {}

    // Visual feedback
    cardEl.classList.add('splash-selected');

    // Play selection sound if AudioSystem is available
    try {
      if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
        AudioSystem.play('card-fold_hand_1', { volume: 0.4 });
      }
    } catch (e) {}

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

    // Escape key closes
    _fanEscHandler = function (e) {
      if (e.key === 'Escape') _closeFan();
    };
    document.addEventListener('keydown', _fanEscHandler);
  }

  var _fanEscHandler = null;

  function _closeFan() {
    if (!_fanOpen) return;
    _fanOpen = false;

    // Cancel any active card drag
    if (_cardDrag) _endCardDrag(true);

    if (_fanEscHandler) {
      document.removeEventListener('keydown', _fanEscHandler);
      _fanEscHandler = null;
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

    _restoreCardOrder();
    _createCapsule();
    _renderPortholeStack();

    if (opts.autoStarfield !== false) {
      _initStarfield(opts.starfieldOpts || {});
    }

    setInterval(_pollMode, 500);

    window.addEventListener('gone-rogue-started', function () {
      if (_mode === 'porthole') _enterGameMode();
    });
    window.addEventListener('gone-rogue-ended', function () {
      if (_mode === 'game') _exitGameMode();
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
