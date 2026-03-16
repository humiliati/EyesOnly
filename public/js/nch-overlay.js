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

  // Drag
  var _capsuleDrag = null;     // { startX, startY, origLeft, origTop, moved }

  // Position persistence
  var POS_KEY = 'EYESONLY_NCH_OVERLAY_POS_V1';

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
      j.textContent = '\uD83C\uDCCF'; // 🃏
      j.dataset.themeId = THEME_MAP[MISSIONS[i].id] || '';
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
      // Desktop hover
      cardEl.addEventListener('mouseenter', function () {
        if (_hoveredCard && _hoveredCard !== cardEl) {
          _hoveredCard.classList.remove('coin-card-hovered');
        }
        cardEl.classList.add('coin-card-hovered');
        _hoveredCard = cardEl;
      });
      cardEl.addEventListener('mouseleave', function () {
        cardEl.classList.remove('coin-card-hovered');
        if (_hoveredCard === cardEl) _hoveredCard = null;
      });

      // Card body click → select mission
      cardEl.addEventListener('click', function (e) {
        // Don't double-fire if the button was clicked
        if (e.target.closest('.coin-book-btn')) return;
        _selectMission(cardEl);
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

  function _openFan() {
    if (_fanOpen) return;
    _fanOpen = true;

    // Build panel if first time
    _buildFanPanel();

    // Ensure starfield is running for porthole canvases
    if (typeof EyesOnlyStarfield !== 'undefined') {
      if (!EyesOnlyStarfield.isRunning()) {
        EyesOnlyStarfield.init();
      }
    }

    // Show with entrance animation
    _fanPanel.style.display = '';
    // Force reflow then add active class for CSS transition
    void _fanPanel.offsetWidth;
    _fanPanel.classList.add('nch-fan-active');

    // Remove previous exit class if re-opening
    var fanEl = _fanPanel.querySelector('#nch-card-fan');
    if (fanEl) fanEl.classList.remove('splash-fan-exit');

    // Reset card states
    var cards = _fanPanel.querySelectorAll('.splash-dossier');
    cards.forEach(function (c) {
      c.classList.remove('splash-selected', 'coin-card-hovered');
    });
    _hoveredCard = null;

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

    if (_fanPanel) {
      _fanPanel.classList.remove('nch-fan-active');
      // Wait for CSS transition out, then hide
      setTimeout(function () {
        if (_fanPanel) _fanPanel.style.display = 'none';
      }, 350);
    }

    if (_fanEscHandler) {
      document.removeEventListener('keydown', _fanEscHandler);
      _fanEscHandler = null;
    }
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
