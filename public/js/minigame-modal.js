/* ============================================================
   MINIGAME MODAL — Cocktail Arcade Cabinet overlay
   3D reveal animation, pause menu, double-click exit guard.
   ============================================================ */
window.MinigameModal = (function () {
  'use strict';

  var overlay, scene, cabinet, bezel, canvas, titleEl, closeBtn;
  var pauseOverlay, currentGame, paused;

  /* Game registry — maps data-minigame keys to their global objects */
  var GAMES = {
    'ski-free':    function () { return window.SkiFreeGame; },
    'jezzball':    function () { return window.JezzBallGame; },
    'frogger':     function () { return window.FroggerGame; },
    'snake':       function () { return window.SnakeGame; },
    'minesweeper': function () { return window.MinesweeperGame; },
    'breakout':    function () { return window.BreakoutGame; }
  };

  /* ── Double-click guard state ── */
  var _lastOverlayClick = 0;
  var DBL_CLICK_WINDOW = 400; // ms — must click twice within this window

  function buildDOM() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'minigame-overlay';
    overlay.className = 'minigame-overlay';

    overlay.innerHTML =
      '<div class="minigame-cabinet-scene">' +
        '<div class="minigame-cabinet">' +
          '<div class="minigame-monitor-bezel">' +
            '<div class="minigame-modal-header">' +
              '<span class="minigame-modal-title" id="minigame-title">GAME</span>' +
              '<button class="minigame-modal-close" id="minigame-close" title="Close game">&times;</button>' +
            '</div>' +
            '<canvas id="minigame-canvas" class="minigame-canvas"></canvas>' +
            '<div class="minigame-modal-footer">' +
              '<span class="minigame-controls-hint" id="minigame-hint">' +
                'ARROWS / WASD to move &middot; SPACE to fire &middot; ESC to pause' +
              '</span>' +
            '</div>' +
            /* Pause overlay lives inside the bezel */
            '<div class="minigame-pause-overlay" id="minigame-pause">' +
              '<div class="minigame-pause-title">PAUSED</div>' +
              '<button class="minigame-pause-btn" id="minigame-resume">Resume Game</button>' +
              '<button class="minigame-pause-btn exit-btn" id="minigame-exit">Exit Game</button>' +
            '</div>' +
          '</div>' +
          /* Arcade control panel decoration (desktop) */
          '<div class="minigame-control-panel">' +
            '<div class="minigame-joystick"></div>' +
            '<div class="minigame-arcade-btn btn-red"></div>' +
            '<div class="minigame-arcade-btn btn-yellow"></div>' +
            '<div class="minigame-arcade-btn btn-white"></div>' +
            '<div class="minigame-arcade-btn btn-blue"></div>' +
          '</div>' +
        '</div>' +
        /* Table legs (desktop) */
        '<div class="minigame-cabinet-legs">' +
          '<div class="minigame-cabinet-leg"></div>' +
          '<div class="minigame-cabinet-leg"></div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    scene        = overlay.querySelector('.minigame-cabinet-scene');
    cabinet      = overlay.querySelector('.minigame-cabinet');
    bezel        = overlay.querySelector('.minigame-monitor-bezel');
    canvas       = document.getElementById('minigame-canvas');
    titleEl      = document.getElementById('minigame-title');
    closeBtn     = document.getElementById('minigame-close');
    pauseOverlay = document.getElementById('minigame-pause');

    /* Close button → shows pause menu instead of instant-closing */
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      showPause();
    });

    /* Overlay background: single click does nothing.
       Double-click toggles pause on/off.
       While paused, double-click again closes pause (back to game). */
    overlay.addEventListener('click', function (e) {
      if (e.target !== overlay) return;
      var now = Date.now();
      if (now - _lastOverlayClick < DBL_CLICK_WINDOW) {
        // Double-click detected — toggle pause
        _lastOverlayClick = 0; // reset so next single click is inert
        if (paused) {
          hidePause();
        } else {
          showPause();
        }
      } else {
        // Single click — just record timestamp, do nothing
        _lastOverlayClick = now;
      }
    });

    /* Pause menu buttons */
    document.getElementById('minigame-resume').addEventListener('click', function (e) {
      e.stopPropagation();
      hidePause();
    });
    document.getElementById('minigame-exit').addEventListener('click', function (e) {
      e.stopPropagation();
      closeForReal();
    });

    /* Stop clicks on the cabinet from bubbling to overlay */
    cabinet.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    window.addEventListener('resize', handleResize);

    /* Escape → toggle pause (not instant close) */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('minigame-overlay-open')) {
        e.preventDefault();
        if (paused) {
          hidePause();
        } else {
          showPause();
        }
      }
    });
  }

  /* ── Pause / unpause ── */
  function showPause() {
    if (paused) return;
    paused = true;
    if (pauseOverlay) pauseOverlay.classList.add('active');
    // Notify game of pause (if supported)
    if (currentGame && currentGame.pause) currentGame.pause();
  }

  function hidePause() {
    if (!paused) return;
    paused = false;
    if (pauseOverlay) pauseOverlay.classList.remove('active');
    if (currentGame && currentGame.resume) currentGame.resume();
  }

  /* ── Canvas sizing — 70% larger on desktop ── */
  function sizeCanvas() {
    if (!canvas || !overlay || !bezel) return;

    var header = bezel.querySelector('.minigame-modal-header');
    var footer = bezel.querySelector('.minigame-modal-footer');
    var hh = header ? header.offsetHeight : 34;
    var fh = footer ? footer.offsetHeight : 28;

    // Bezel internal dimensions
    var bezelRect = bezel.getBoundingClientRect();
    var availW = bezelRect.width - 6;   // minus bezel padding
    var availH = bezelRect.height - hh - fh - 6;

    // Fallback if bezel hasn't laid out yet
    if (availW < 100 || availH < 100) {
      var isMobile = window.innerWidth < 769;
      availW = isMobile
        ? Math.min(window.innerWidth - 32, 600)
        : Math.min(window.innerWidth - 80, 1010);
      availH = isMobile
        ? Math.min(window.innerHeight - 80, 460) - hh - fh
        : Math.min(window.innerHeight - 160, 700) - hh - fh;
    }

    var w = Math.floor(Math.max(200, availW));
    var h = Math.floor(Math.max(150, availH));

    canvas.width  = w;
    canvas.height = h;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
  }

  function handleResize() {
    if (!overlay || !overlay.classList.contains('minigame-overlay-open')) return;
    sizeCanvas();
    if (currentGame && currentGame.resize) {
      currentGame.resize(canvas);
    }
  }

  /* ── Open game ── */
  function open(gameKey) {
    buildDOM();
    var getter = GAMES[gameKey];
    if (!getter) { console.warn('MinigameModal: unknown game "' + gameKey + '"'); return; }
    var game = getter();
    if (!game) { console.warn('MinigameModal: game module not loaded "' + gameKey + '"'); return; }

    // Set title
    var title = gameKey.replace(/-/g, ' ').toUpperCase();
    if (titleEl) titleEl.textContent = title;

    // Reset pause state
    paused = false;
    if (pauseOverlay) pauseOverlay.classList.remove('active');
    _lastOverlayClick = 0;

    // Show overlay — the CSS transition on .minigame-cabinet-scene
    // handles the 3D roll-in animation automatically
    overlay.classList.add('minigame-overlay-open');
    document.body.style.overflow = 'hidden';

    // Size canvas after a frame so the layout has resolved
    requestAnimationFrame(function () {
      sizeCanvas();
      currentGame = game;
      game.start(canvas);
    });

    // SFX
    if (window.AudioSystem && AudioSystem.playSFX) {
      AudioSystem.playSFX('ui-04');
    }
  }

  /* ── Close game (for real) ── */
  function closeForReal() {
    paused = false;
    if (pauseOverlay) pauseOverlay.classList.remove('active');
    if (currentGame && currentGame.stop) currentGame.stop();
    currentGame = null;
    if (overlay) overlay.classList.remove('minigame-overlay-open');
    document.body.style.overflow = '';

    // SFX
    if (window.AudioSystem && AudioSystem.playSFX) {
      AudioSystem.playSFX('ui-01');
    }
  }

  return { open: open, close: closeForReal };
})();
