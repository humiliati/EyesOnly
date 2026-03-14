/* ============================================================
   MINESWEEPER — Classic grid mine puzzle
   Canvas-based, CRT-themed.
   Left-click to reveal, right-click to flag.
   ============================================================ */
window.MinesweeperGame = (function () {
  'use strict';

  var ctx, W, H, raf;
  var CELL, cols, rows, mines;
  var grid;    // { mine, revealed, flagged, adjacent }
  var gameOver, won, firstClick, mineCount;

  function reset() {
    CELL = 20;
    cols = Math.floor(W / CELL);
    rows = Math.floor((H - 20) / CELL);  // reserve HUD space
    if (cols < 5) cols = 5;
    if (rows < 5) rows = 5;
    mineCount = Math.max(5, Math.floor(cols * rows * 0.15));
    grid = [];
    for (var i = 0; i < cols * rows; i++) {
      grid.push({ mine: false, revealed: false, flagged: false, adjacent: 0 });
    }
    gameOver = false;
    won = false;
    firstClick = true;
  }

  function placeMines(safeC, safeR) {
    var placed = 0;
    while (placed < mineCount) {
      var c = Math.floor(Math.random() * cols);
      var r = Math.floor(Math.random() * rows);
      if (Math.abs(c - safeC) <= 1 && Math.abs(r - safeR) <= 1) continue;
      var idx = r * cols + c;
      if (grid[idx].mine) continue;
      grid[idx].mine = true;
      placed++;
    }
    // Calculate adjacents
    for (var r2 = 0; r2 < rows; r2++) {
      for (var c2 = 0; c2 < cols; c2++) {
        if (grid[r2 * cols + c2].mine) continue;
        var count = 0;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            var nr = r2 + dr, nc = c2 + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr * cols + nc].mine) count++;
          }
        }
        grid[r2 * cols + c2].adjacent = count;
      }
    }
  }

  function reveal(c, r) {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    var cell = grid[r * cols + c];
    if (cell.revealed || cell.flagged) return;
    cell.revealed = true;
    if (cell.mine) {
      gameOver = true;
      // Reveal all mines
      for (var i = 0; i < grid.length; i++) { if (grid[i].mine) grid[i].revealed = true; }
      return;
    }
    if (cell.adjacent === 0) {
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          reveal(c + dc, r + dr);
        }
      }
    }
    checkWin();
  }

  function checkWin() {
    for (var i = 0; i < grid.length; i++) {
      if (!grid[i].mine && !grid[i].revealed) return;
    }
    won = true;
    gameOver = true;
  }

  function draw() {
    var ph = getComputedStyle(document.documentElement).getPropertyValue('--phosphor').trim() || '#1cff9b';
    var dim = getComputedStyle(document.documentElement).getPropertyValue('--phosphor-dim').trim() || '#1a6b4a';

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    var numColors = [ph, '#4488ff', '#44cc44', '#ff4444', '#aa44ff', '#ff8800', '#44ffff', '#ff44ff', '#ffffff'];

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = grid[r * cols + c];
        var x = c * CELL;
        var y = r * CELL + 20;

        if (cell.revealed) {
          ctx.fillStyle = '#111';
          ctx.fillRect(x, y, CELL, CELL);
          ctx.strokeStyle = '#1a1a1a';
          ctx.strokeRect(x, y, CELL, CELL);
          if (cell.mine) {
            ctx.fillStyle = '#f44';
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 4, 0, Math.PI * 2);
            ctx.fill();
          } else if (cell.adjacent > 0) {
            ctx.fillStyle = numColors[cell.adjacent] || ph;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(cell.adjacent), x + CELL / 2, y + CELL / 2);
          }
        } else {
          ctx.fillStyle = dim;
          ctx.globalAlpha = 0.25;
          ctx.fillRect(x, y, CELL, CELL);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = dim;
          ctx.strokeRect(x, y, CELL, CELL);
          if (cell.flagged) {
            ctx.fillStyle = '#ff0';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚑', x + CELL / 2, y + CELL / 2);
          }
        }
      }
    }

    // HUD
    var flagCount = grid.filter(function (c) { return c.flagged; }).length;
    ctx.fillStyle = ph;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('MINES:' + mineCount + '  FLAGS:' + flagCount, 8, 4);

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = ph;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(won ? 'CLEARED!' : 'BOOM!', W / 2, H / 2 - 10);
      ctx.font = '11px monospace';
      ctx.fillText('[SPACE] RETRY', W / 2, H / 2 + 14);
    }
  }

  function loop() {
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onClick(e) {
    if (gameOver) return;
    var rect = ctx.canvas.getBoundingClientRect();
    var mx = (e.clientX - rect.left) * (W / rect.width);
    var my = (e.clientY - rect.top) * (H / rect.height);
    var c = Math.floor(mx / CELL);
    var r = Math.floor((my - 20) / CELL);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    if (firstClick) {
      placeMines(c, r);
      firstClick = false;
    }
    reveal(c, r);
  }

  function onContext(e) {
    e.preventDefault();
    if (gameOver) return;
    var rect = ctx.canvas.getBoundingClientRect();
    var mx = (e.clientX - rect.left) * (W / rect.width);
    var my = (e.clientY - rect.top) * (H / rect.height);
    var c = Math.floor(mx / CELL);
    var r = Math.floor((my - 20) / CELL);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    var cell = grid[r * cols + c];
    if (!cell.revealed) cell.flagged = !cell.flagged;
  }

  function onKeyDown(e) {
    if (e.key === ' ' && gameOver) { e.preventDefault(); reset(); }
  }

  return {
    start: function (canvas) {
      ctx = canvas.getContext('2d');
      W = canvas.width;
      H = canvas.height;
      reset();
      canvas.addEventListener('click', onClick);
      canvas.addEventListener('contextmenu', onContext);
      document.addEventListener('keydown', onKeyDown);
      loop();
    },
    stop: function () {
      cancelAnimationFrame(raf);
      if (ctx && ctx.canvas) {
        ctx.canvas.removeEventListener('click', onClick);
        ctx.canvas.removeEventListener('contextmenu', onContext);
      }
      document.removeEventListener('keydown', onKeyDown);
    },
    resize: function (canvas) {
      W = canvas.width;
      H = canvas.height;
      reset();
    }
  };
})();
