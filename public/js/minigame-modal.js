/* ============================================================
   MINIGAME MODAL — Cocktail Arcade Cabinet overlay
   3D reveal animation, pause menu, double-click exit guard.
   ============================================================ */
window.MinigameModal = (function () {
  'use strict';

  var overlay, scene, cabinet, bezel, canvas, titleEl, closeBtn;
  var pauseOverlay, currentGame, paused;
  var _animating = false; // true while the 3D roll-in is in flight

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
  var DBL_CLICK_WINDOW = 400;

  /* ── 3D starting pose (tilted flat on table) ── */
  var TILT_TRANSFORM = 'rotateX(78deg) rotateZ(-8deg) scale(0.58) translateY(55px)';

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
            '<div class="minigame-pause-overlay" id="minigame-pause">' +
              '<div class="minigame-pause-title">PAUSED</div>' +
              '<button class="minigame-pause-btn" id="minigame-resume">Resume Game</button>' +
              '<button class="minigame-pause-btn exit-btn" id="minigame-exit">Exit Game</button>' +
            '</div>' +
          '</div>' +
          '<div class="minigame-control-panel">' +
            '<div class="minigame-joystick"></div>' +
            '<div class="minigame-arcade-btn btn-red"></div>' +
            '<div class="minigame-arcade-btn btn-blue"></div>' +
          '</div>' +
          /* 3D box faces — visible only while the cabinet is tilted */
          '<div class="minigame-cab-depth cab-left"></div>' +
          '<div class="minigame-cab-depth cab-right"></div>' +
          '<div class="minigame-cab-depth cab-bottom"></div>' +
          '<div class="minigame-cab-depth cab-back"></div>' +
        '</div>' +
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

    // Move box-depth faces OUT of cabinet onto the scene so they
    // aren't clipped by cabinet's overflow:hidden after animation.
    var depthFaces = cabinet.querySelectorAll('.minigame-cab-depth');
    depthFaces.forEach(function (face) { scene.appendChild(face); });

    /* Close button → shows pause menu */
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      showPause();
    });

    /* Overlay background: single click = nothing, double-click toggles pause */
    overlay.addEventListener('click', function (e) {
      if (e.target !== overlay) return;
      var now = Date.now();
      if (now - _lastOverlayClick < DBL_CLICK_WINDOW) {
        _lastOverlayClick = 0;
        if (paused) {
          hidePause();
        } else {
          showPause();
        }
      } else {
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

    /* Escape → toggle pause */
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

    /* When the 3D roll-in animation finishes, strip all 3D transforms
       so the canvas has a clean flat coordinate space for input.
       Without this, getBoundingClientRect() returns warped values
       and click→canvas coordinate conversion is wrong. */
    scene.addEventListener('transitionend', function (e) {
      if (e.target !== scene) return;
      if (!_animating) return;
      _animating = false;
      // Kill perspective + preserve-3d on scene/cabinet so canvas rect is clean.
      // Control panel keeps its OWN perspective (set in CSS) — it's a sibling
      // of bezel, not a canvas ancestor, so it can't warp canvas coords.
      scene.style.transition = 'none';
      scene.style.transform  = 'none';
      scene.style.transformStyle = 'flat';
      overlay.style.perspective = 'none';
      cabinet.style.transformStyle = '';
      cabinet.style.overflow = 'hidden';  // restore after animation
      // Re-size canvas now that transforms are stripped (rect is accurate)
      sizeCanvas();
      syncDepthFaces();
      if (currentGame && currentGame.resize) {
        currentGame.resize(canvas);
      }
    });
  }

  /* ── Pause / unpause ── */
  function showPause() {
    if (paused) return;
    paused = true;
    if (pauseOverlay) pauseOverlay.classList.add('active');
    if (currentGame && currentGame.pause) currentGame.pause();
  }

  function hidePause() {
    if (!paused) return;
    paused = false;
    if (pauseOverlay) pauseOverlay.classList.remove('active');
    if (currentGame && currentGame.resume) currentGame.resume();
  }

  /* ── Sync depth-face dimensions to actual cabinet size ── */
  function syncDepthFaces() {
    if (!cabinet || !scene) return;
    var w = cabinet.offsetWidth;
    var h = cabinet.offsetHeight;
    var cabLeft   = scene.querySelector('.cab-left');
    var cabRight  = scene.querySelector('.cab-right');
    var cabBottom = scene.querySelector('.cab-bottom');
    var cabBack   = scene.querySelector('.cab-back');
    if (cabLeft)   { cabLeft.style.height = h + 'px'; }
    if (cabRight)  { cabRight.style.height = h + 'px'; }
    if (cabBottom) { cabBottom.style.width = w + 'px'; }
    if (cabBack)   { cabBack.style.width = w + 'px'; cabBack.style.height = h + 'px'; }
  }

  /* ── Canvas sizing ── */
  function sizeCanvas() {
    if (!canvas || !overlay) return;

    var isMobile = window.innerWidth < 769;
    var hh = 34, fh = 28;
    var header = bezel ? bezel.querySelector('.minigame-modal-header') : null;
    var footer = bezel ? bezel.querySelector('.minigame-modal-footer') : null;
    if (header) hh = header.offsetHeight;
    if (footer) fh = footer.offsetHeight;

    var w, h;

    // Only trust bezel.getBoundingClientRect when transforms are stripped
    if (!_animating && bezel) {
      var bezelRect = bezel.getBoundingClientRect();
      w = bezelRect.width - 6;
      h = bezelRect.height - hh - fh - 6;
    }

    // Fallback: compute from viewport
    if (!w || w < 100 || !h || h < 100) {
      w = isMobile
        ? Math.min(window.innerWidth - 32, 600)
        : Math.min(window.innerWidth - 80, 1010);
      h = isMobile
        ? Math.min(window.innerHeight - 80, 460) - hh - fh
        : Math.min(window.innerHeight - 160, 700) - hh - fh;
    }

    w = Math.floor(Math.max(200, w));
    h = Math.floor(Math.max(150, h));

    canvas.width  = w;
    canvas.height = h;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';

    syncDepthFaces();
  }

  function handleResize() {
    if (!overlay || !overlay.classList.contains('minigame-overlay-open')) return;
    sizeCanvas();
    if (currentGame && currentGame.resize) {
      currentGame.resize(canvas);
    }
  }

  /* ── Wire arcade control-panel visual feedback ── */
  function wireControlPanel() {
    if (!overlay) return;
    var joystick = overlay.querySelector('.minigame-joystick');
    var buttons  = Array.from(overlay.querySelectorAll('.minigame-arcade-btn'));

    var joyKeys = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      a: 'left', A: 'left', d: 'right', D: 'right',
      w: 'up', W: 'up', s: 'down', S: 'down'
    };
    var btnKeys = { ' ': 0, Enter: 0, z: 1, Z: 1, x: 1, X: 1 };
    var held = {};
    var joyTimer = null;

    function onDown(e) {
      if (!overlay.classList.contains('minigame-overlay-open') || held[e.key]) return;
      held[e.key] = true;
      var dir = joyKeys[e.key];
      if (dir && joystick) {
        joystick.className = 'minigame-joystick joystick-' + dir;
        clearTimeout(joyTimer);
        joyTimer = setTimeout(function () {
          joystick.className = 'minigame-joystick';
        }, 160);
      }
      var bi = btnKeys[e.key];
      if (bi !== undefined && buttons[bi]) {
        buttons[bi].classList.add('btn-pressed');
        setTimeout(function () { buttons[bi].classList.remove('btn-pressed'); }, 140);
      }
    }
    function onUp(e) { delete held[e.key]; }

    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);
    // Auto-clean when modal closes
    overlay.addEventListener('transitionend', function cleanup() {
      if (!overlay.classList.contains('minigame-overlay-open')) {
        document.removeEventListener('keydown', onDown);
        document.removeEventListener('keyup', onUp);
      }
    });
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

    // ── Reset 3D transform state for the roll-in animation ──
    // 1. Let CSS perspective: 1400px rule take effect (don't override)
    overlay.style.perspective = '';
    // 2. Force scene to the tilted starting pose (no transition)
    scene.style.transition     = 'none';
    scene.style.transformStyle = 'preserve-3d';
    scene.style.transform      = TILT_TRANSFORM;
    // 3. Cabinet needs preserve-3d so box-depth faces render during tilt
    cabinet.style.transformStyle = 'preserve-3d';
    // 4. Cabinet overflow visible so bezel edges aren't clipped during tilt
    cabinet.style.overflow = 'visible';

    // Show overlay (opacity 0→1 via CSS transition on overlay)
    overlay.classList.add('minigame-overlay-open');
    document.body.style.overflow = 'hidden';

    // Size canvas with viewport fallback (transforms still active)
    sizeCanvas();
    currentGame = game;
    game.start(canvas);

    // Double-rAF: first rAF lets the browser apply the tilted pose,
    // second rAF fires after the first paint frame, so the transition
    // genuinely starts from the tilted pose (not batched to identity).
    _animating = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        scene.style.transition = 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)';
        scene.style.transform  = 'rotateX(0deg) rotateZ(0deg) scale(1)';
      });
    });

    // Safety: if transitionend never fires (e.g. reduced-motion),
    // strip transforms after 1.4s anyway
    setTimeout(function () {
      if (_animating) {
        _animating = false;
        scene.style.transition     = 'none';
        scene.style.transform      = 'none';
        scene.style.transformStyle = 'flat';
        overlay.style.perspective  = 'none';
        cabinet.style.transformStyle = '';
        cabinet.style.overflow = 'hidden';
        sizeCanvas();
        syncDepthFaces();
        if (currentGame && currentGame.resize) {
          currentGame.resize(canvas);
        }
      }
    }, 1400);

    // Wire control-panel visual feedback (joystick + button presses)
    wireControlPanel();

    // SFX
    if (window.AudioSystem && AudioSystem.playSFX) {
      AudioSystem.playSFX('ui-04');
    }
  }

  /* ── Close game (for real) ── */
  function closeForReal() {
    _animating = false;
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
