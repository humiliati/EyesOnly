/* ============================================================
   MINIGAME MODAL — Fullscreen overlay for arcade minigames
   Manages launching, resizing, and closing canvas-based games.
   ============================================================ */
window.MinigameModal = (function () {
  'use strict';

  var overlay, canvas, titleEl, closeBtn, currentGame;

  /* Game registry — maps data-minigame keys to their global objects */
  var GAMES = {
    'ski-free':    function () { return window.SkiFreeGame; },
    'jezzball':    function () { return window.JezzBallGame; },
    'frogger':     function () { return window.FroggerGame; },
    'snake':       function () { return window.SnakeGame; },
    'minesweeper': function () { return window.MinesweeperGame; },
    'breakout':    function () { return window.BreakoutGame; }
  };

  function buildDOM() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'minigame-overlay';
    overlay.className = 'minigame-overlay';
    overlay.innerHTML =
      '<div class="minigame-modal">' +
        '<div class="minigame-modal-header">' +
          '<span class="minigame-modal-title" id="minigame-title">GAME</span>' +
          '<button class="minigame-modal-close" id="minigame-close" title="Close game">&times;</button>' +
        '</div>' +
        '<canvas id="minigame-canvas" class="minigame-canvas"></canvas>' +
        '<div class="minigame-modal-footer">' +
          '<span class="minigame-controls-hint" id="minigame-hint">ARROWS / WASD to move &middot; SPACE to retry</span>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    canvas   = document.getElementById('minigame-canvas');
    titleEl  = document.getElementById('minigame-title');
    closeBtn = document.getElementById('minigame-close');

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    window.addEventListener('resize', handleResize);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('minigame-overlay-open')) {
        close();
      }
    });
  }

  function sizeCanvas() {
    if (!canvas || !overlay) return;
    var modal = overlay.querySelector('.minigame-modal');
    var header = overlay.querySelector('.minigame-modal-header');
    var footer = overlay.querySelector('.minigame-modal-footer');
    var hh = header ? header.offsetHeight : 30;
    var fh = footer ? footer.offsetHeight : 24;
    var maxW = Math.min(window.innerWidth - 32, 600);
    var maxH = Math.min(window.innerHeight - 80, 460) - hh - fh;
    canvas.width  = maxW;
    canvas.height = maxH;
    canvas.style.width  = maxW + 'px';
    canvas.style.height = maxH + 'px';
  }

  function handleResize() {
    if (!overlay || !overlay.classList.contains('minigame-overlay-open')) return;
    sizeCanvas();
    if (currentGame && currentGame.resize) {
      currentGame.resize(canvas);
    }
  }

  function open(gameKey) {
    buildDOM();
    var getter = GAMES[gameKey];
    if (!getter) { console.warn('MinigameModal: unknown game "' + gameKey + '"'); return; }
    var game = getter();
    if (!game) { console.warn('MinigameModal: game module not loaded "' + gameKey + '"'); return; }

    // Set title
    var title = gameKey.replace(/-/g, ' ').toUpperCase();
    if (titleEl) titleEl.textContent = title;

    // Show overlay
    overlay.classList.add('minigame-overlay-open');
    document.body.style.overflow = 'hidden';

    // Size canvas and start
    sizeCanvas();
    currentGame = game;
    game.start(canvas);

    // SFX
    if (window.AudioSystem && AudioSystem.playSFX) {
      AudioSystem.playSFX('ui-04');
    }
  }

  function close() {
    if (currentGame && currentGame.stop) currentGame.stop();
    currentGame = null;
    if (overlay) overlay.classList.remove('minigame-overlay-open');
    document.body.style.overflow = '';

    // SFX
    if (window.AudioSystem && AudioSystem.playSFX) {
      AudioSystem.playSFX('ui-01');
    }
  }

  return { open: open, close: close };
})();
