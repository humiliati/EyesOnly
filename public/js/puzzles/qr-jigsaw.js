/**
 * qr-jigsaw.js — QR-Activated Visual Recon Puzzle
 *
 * A tile-scramble puzzle for live field exercises.
 * Players scan a QR code → land on /games.html#jigsaw → this puzzle
 * auto-opens via PuzzlePopup.
 *
 * The player must rearrange scrambled grid tiles to reconstruct
 * a surveillance image (rendered as ASCII/block art for the CRT theme).
 *
 * Registers with PuzzlePopup under key 'qr-jigsaw'.
 */
(function () {
  'use strict';

  if (typeof PuzzlePopup === 'undefined') return;

  var SOLVED_KEY = 'eyesonly_qr_jigsaw_solved';
  var GRID_SIZE = 4; // 4x4 grid = 15 tiles + 1 empty
  var TOTAL = GRID_SIZE * GRID_SIZE;

  // The "image" is a grid of numbered cells. The solved state is 1..15, 0.
  // For the CRT aesthetic, each tile shows a code fragment.

  var TILE_LABELS = [
    '', // 0 = empty
    'N 47°',  'W 117°', '23.41"', 'SGNL:OK',
    'FREQ:',  '141.2',  'MHz',    'BRNG:NE',
    'ASSET:', 'FALCON', 'STATUS', ':ACTIVE',
    'DROP:',  'GRID',   'REF:7B'
  ];

  function isSolved() {
    try { return localStorage.getItem(SOLVED_KEY) === 'true'; }
    catch (_) { return false; }
  }

  function markSolved() {
    try { localStorage.setItem(SOLVED_KEY, 'true'); }
    catch (_) {}
  }

  function render(container) {
    var alreadySolved = isSolved();

    // Initialize board
    var board = [];
    for (var i = 1; i < TOTAL; i++) board.push(i);
    board.push(0); // empty in bottom-right = solved position

    if (!alreadySolved) {
      // Scramble with valid moves (ensures solvability)
      var emptyIdx = TOTAL - 1;
      for (var s = 0; s < 200; s++) {
        var neighbors = getNeighbors(emptyIdx);
        var pick = neighbors[Math.floor(Math.random() * neighbors.length)];
        board[emptyIdx] = board[pick];
        board[pick] = 0;
        emptyIdx = pick;
      }
    }

    container.innerHTML =
      '<div class="puzzle-qr-jigsaw">' +
        '<div class="puzzle-ddc-briefing">' +
          '<span class="puzzle-ddc-label">SURVEILLANCE RECON — IMAGE RECOVERY</span>' +
          '<p class="puzzle-ddc-flavor">A scrambled intelligence grid was intercepted at this waypoint. ' +
          'Slide the tiles to reconstruct the recon data. Click a tile adjacent to the empty space to move it.</p>' +
        '</div>' +
        '<div class="puzzle-jigsaw-board" id="qr-jigsaw-board" style="' +
          'display:grid;grid-template-columns:repeat(' + GRID_SIZE + ',1fr);' +
          'gap:3px;max-width:320px;margin:12px auto;aspect-ratio:1;' +
          'background:rgba(0,0,0,0.3);padding:4px;border:1px solid var(--phosphor-dim,#1a6b4a);border-radius:4px;' +
        '"></div>' +
        '<div class="puzzle-jigsaw-status" style="text-align:center;margin:8px 0;">' +
          '<span class="puzzle-ddc-cipher-label">MOVES: </span>' +
          '<span id="qr-jigsaw-moves" style="color:var(--phosphor,#1cff9b);">0</span>' +
        '</div>' +
        '<div class="puzzle-ddc-feedback" id="qr-jigsaw-feedback" style="text-align:center;">' +
          (alreadySolved ? '<span class="puzzle-ddc-success">&#10003; RECON IMAGE RECOVERED — Intelligence secured.</span>' : '') +
        '</div>' +
      '</div>';

    var boardEl = container.querySelector('#qr-jigsaw-board');
    var movesEl = container.querySelector('#qr-jigsaw-moves');
    var feedback = container.querySelector('#qr-jigsaw-feedback');
    var moveCount = 0;
    var solved = alreadySolved;

    function renderBoard() {
      boardEl.innerHTML = '';
      for (var i = 0; i < TOTAL; i++) {
        var val = board[i];
        var tile = document.createElement('button');
        tile.className = 'puzzle-jigsaw-tile';
        tile.setAttribute('data-index', i);
        tile.style.cssText =
          'display:flex;align-items:center;justify-content:center;' +
          'font-family:"Courier New",monospace;font-size:0.7em;font-weight:bold;' +
          'letter-spacing:0.05em;border:1px solid var(--phosphor-dim,#1a6b4a);' +
          'border-radius:2px;cursor:pointer;aspect-ratio:1;' +
          'text-transform:uppercase;transition:all 0.15s ease;';

        if (val === 0) {
          tile.style.background = 'transparent';
          tile.style.border = '1px solid transparent';
          tile.style.cursor = 'default';
          tile.textContent = '';
        } else {
          tile.style.background = 'rgba(0,0,0,0.5)';
          tile.style.color = solved ? 'var(--phosphor,#1cff9b)' : 'var(--phosphor-dim,#1a6b4a)';
          tile.textContent = TILE_LABELS[val] || val;
          if (!solved) {
            tile.addEventListener('click', (function (idx) {
              return function () { tryMove(idx); };
            })(i));
          }
        }

        boardEl.appendChild(tile);
      }
    }

    function getNeighbors(idx) {
      var row = Math.floor(idx / GRID_SIZE);
      var col = idx % GRID_SIZE;
      var neighbors = [];
      if (row > 0) neighbors.push(idx - GRID_SIZE);
      if (row < GRID_SIZE - 1) neighbors.push(idx + GRID_SIZE);
      if (col > 0) neighbors.push(idx - 1);
      if (col < GRID_SIZE - 1) neighbors.push(idx + 1);
      return neighbors;
    }

    function tryMove(idx) {
      if (solved) return;
      var emptyIdx = board.indexOf(0);
      var neighbors = getNeighbors(emptyIdx);
      if (neighbors.indexOf(idx) === -1) return;

      // Swap
      board[emptyIdx] = board[idx];
      board[idx] = 0;
      moveCount++;
      movesEl.textContent = moveCount;

      if (window.AudioSystem && AudioSystem.playSFX) AudioSystem.playSFX('ui-01');

      renderBoard();
      checkWin();
    }

    function checkWin() {
      for (var i = 0; i < TOTAL - 1; i++) {
        if (board[i] !== i + 1) return;
      }
      if (board[TOTAL - 1] !== 0) return;

      // Solved!
      solved = true;
      PuzzlePopup.solved();
      markSolved();
      feedback.innerHTML = '<span class="puzzle-ddc-success">&#10003; RECON IMAGE RECOVERED — Intelligence secured! (' + moveCount + ' moves)</span>';

      if (window.PuzzleState && PuzzleState.onClueFound) {
        PuzzleState.onClueFound('qr-jigsaw-solved', 'qr-puzzle');
      }

      if (window.AudioSystem && AudioSystem.playSFX) AudioSystem.playSFX('ui-04');

      renderBoard();
    }

    renderBoard();
  }

  PuzzlePopup.register('qr-jigsaw', {
    title: 'SURVEILLANCE RECON — IMAGE RECOVERY',
    render: render,
    onSolve: function () {
      try {
        var acct = JSON.parse(localStorage.getItem('eyesonly_account') || '{}');
        acct.puzzleCoins = (acct.puzzleCoins || 0) + 20;
        localStorage.setItem('eyesonly_account', JSON.stringify(acct));
      } catch (_) {}
    }
  });

})();
