/* ============================================================
   MINESWEEPER — Minefield ArcadeEngine Implementation
   Touch/mobile-first with tap-to-reveal, long-press-to-flag,
   double-tap chord reveals. Full scoring with time-based currency.

   INPUT:
   - Tap on hidden cell → reveal it
   - Long-press on hidden cell → toggle flag (🚩)
   - Double-tap on revealed number → chord reveal
   - Space/action key when game over → restart

   ENTITIES: ⬛ hidden, ⬜ empty, 💣 mines, 🚩 flags, 1-8 numbers
   ============================================================ */
window.MinesweeperGame = (function () {
  'use strict';

  // ════════════════════════════════════════════════════════════
  // MINESWEEPER GAME CLASS
  // ════════════════════════════════════════════════════════════

  function Minesweeper() {
    ArcadeEngine.call(this, {
      gameId: 'minesweeper',
      title: 'MINEFIELD',
      lives: 1,
      currencyRate: 0.01
    });

    this.sfxMap = {
      'reveal':      'drop-1',
      'flag':        'coin-2',
      'unflag':      'water-1',
      'boom':        'kitty-1',
      'win':         'toad',
      'game-over':   'game-over-1',
      'game-start':  'power-up-1',
      'chord':       'hit-1',
      'death':       'kitty-1',
      'level-up':    'toad'
    };

    // ── Grid state ──
    this._grid = [];
    this._cols = 0;
    this._rows = 0;
    this._cellSize = 20;
    this._gridOffsetX = 0;
    this._gridOffsetY = 0;
    this._hudHeight = 28;

    // ── Game state ──
    this._firstClick = true;
    this._mineCount = 0;
    this._won = false;
    this._elapsedTime = 0;    // milliseconds
  }

  Minesweeper.prototype = Object.create(ArcadeEngine.prototype);
  Minesweeper.prototype.constructor = Minesweeper;

  // ════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ════════════════════════════════════════════════════════════

  Minesweeper.prototype.onInit = function () {
    this._resetState();
  };

  Minesweeper.prototype.onStart = function () {
    this._resetState();

    // ── Difficulty scaling ──
    var dm = this.difficultyMultiplier();
    // Adjust mine density and lives
    if (this.difficulty === 1) {
      // T1: fewer mines (0.7 multiplier), easier cells
      this._mineCount = Math.max(3, Math.floor(this._cols * this._rows * 0.15 * 0.6));
      this.lives = 2;
    } else if (this.difficulty === 2) {
      // T2: default mine count
      this._mineCount = Math.max(5, Math.floor(this._cols * this._rows * 0.15));
      this.lives = 1;
    } else if (this.difficulty === 3) {
      // T3: more mines (1.4 multiplier), harder
      this._mineCount = Math.max(8, Math.floor(this._cols * this._rows * 0.15 * 1.3));
      this.lives = 1;
    }
  };

  Minesweeper.prototype._resetState = function () {
    var W = this.logicalW, H = this.logicalH;

    // Calculate cell size from canvas (aim for ~20px cells)
    this._cellSize = 20;
    var playH = H - this._hudHeight;
    this._cols = Math.floor(W / this._cellSize);
    this._rows = Math.floor(playH / this._cellSize);
    if (this._cols < 5) this._cols = 5;
    if (this._rows < 5) this._rows = 5;

    // Center the grid
    var gridW = this._cols * this._cellSize;
    var gridH = this._rows * this._cellSize;
    this._gridOffsetX = Math.floor((W - gridW) / 2);
    this._gridOffsetY = this._hudHeight + Math.floor((playH - gridH) / 2);

    // Initialize grid
    this._mineCount = Math.max(5, Math.floor(this._cols * this._rows * 0.15));
    this._grid = [];
    for (var i = 0; i < this._cols * this._rows; i++) {
      this._grid.push({
        mine: false,
        revealed: false,
        flagged: false,
        adjacent: 0
      });
    }

    this._firstClick = true;
    this._won = false;
    this._elapsedTime = 0;
  };

  Minesweeper.prototype.onResize = function (w, h) {
    this._resetState();
  };

  // ════════════════════════════════════════════════════════════
  // INPUT HANDLING
  // ════════════════════════════════════════════════════════════

  Minesweeper.prototype.onInput = function (type, data) {
    if (this.state !== ArcadeEngine.STATE.PLAYING) return;

    // Tap → reveal cell
    if (type === 'tap') {
      var c = this._screenToGridCol(data.x);
      var r = this._screenToGridRow(data.y);
      if (c >= 0 && c < this._cols && r >= 0 && r < this._rows) {
        this._revealCell(c, r);
      }
      return;
    }

    // Long-press → toggle flag
    if (type === 'longpress') {
      var c = this._screenToGridCol(data.x);
      var r = this._screenToGridRow(data.y);
      if (c >= 0 && c < this._cols && r >= 0 && r < this._rows) {
        this._toggleFlag(c, r);
      }
      return;
    }

    // Double-tap → chord reveal
    if (type === 'doubletap') {
      var c = this._screenToGridCol(data.x);
      var r = this._screenToGridRow(data.y);
      if (c >= 0 && c < this._cols && r >= 0 && r < this._rows) {
        this._chordReveal(c, r);
      }
      return;
    }

    // Space/action key when game over → restart
    if (type === 'keyaction') {
      if (data.action === 'action' && this.state === ArcadeEngine.STATE.GAME_OVER) {
        this._restartGame();
        return;
      }
    }
  };

  /**
   * Convert screen x to grid column.
   */
  Minesweeper.prototype._screenToGridCol = function (screenX) {
    return Math.floor((screenX - this._gridOffsetX) / this._cellSize);
  };

  /**
   * Convert screen y to grid row.
   */
  Minesweeper.prototype._screenToGridRow = function (screenY) {
    return Math.floor((screenY - this._gridOffsetY) / this._cellSize);
  };

  /**
   * Reveal a cell. If first click, place mines first.
   */
  Minesweeper.prototype._revealCell = function (c, r) {
    if (this._firstClick) {
      this._placeMines(c, r);
      this._firstClick = false;
    }

    var cell = this._grid[r * this._cols + c];
    if (!cell || cell.revealed || cell.flagged) return;

    // Play reveal SFX only on user-initiated reveal (not recursive flood fill)
    this.playSFX('reveal');
    this._reveal(c, r);
    this._checkWinCondition();
  };

  /**
   * Toggle flag on a cell.
   */
  Minesweeper.prototype._toggleFlag = function (c, r) {
    if (c < 0 || c >= this._cols || r < 0 || r >= this._rows) return;
    var cell = this._grid[r * this._cols + c];
    if (cell.revealed) return;

    cell.flagged = !cell.flagged;
    if (cell.flagged) {
      this.playSFX('flag');
    } else {
      this.playSFX('unflag');
    }
  };

  /**
   * Chord reveal: if tapping a number cell with all adjacent mines flagged,
   * reveal all unflagged neighbors.
   */
  Minesweeper.prototype._chordReveal = function (c, r) {
    if (c < 0 || c >= this._cols || r < 0 || r >= this._rows) return;
    var cell = this._grid[r * this._cols + c];
    if (!cell.revealed || cell.adjacent === 0 || cell.mine) return;

    // Count flagged neighbors
    var flaggedCount = 0;
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < this._rows && nc >= 0 && nc < this._cols) {
          var neighbor = this._grid[nr * this._cols + nc];
          if (neighbor.flagged) flaggedCount++;
        }
      }
    }

    // Only chord if flag count matches adjacent count
    if (flaggedCount !== cell.adjacent) return;

    this.playSFX('chord');

    // Reveal all unflagged neighbors
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < this._rows && nc >= 0 && nc < this._cols) {
          var neighbor = this._grid[nr * this._cols + nc];
          if (!neighbor.flagged && !neighbor.revealed) {
            this._reveal(nc, nr);
          }
        }
      }
    }

    this._checkWinCondition();
  };

  // ════════════════════════════════════════════════════════════
  // GRID LOGIC
  // ════════════════════════════════════════════════════════════

  /**
   * Place mines on the grid, avoiding a 3x3 safe zone around first click.
   */
  Minesweeper.prototype._placeMines = function (safeC, safeR) {
    var placed = 0;
    while (placed < this._mineCount) {
      var c = Math.floor(Math.random() * this._cols);
      var r = Math.floor(Math.random() * this._rows);

      // Avoid safe zone (3x3 around first click)
      if (Math.abs(c - safeC) <= 1 && Math.abs(r - safeR) <= 1) continue;

      var idx = r * this._cols + c;
      if (this._grid[idx].mine) continue;

      this._grid[idx].mine = true;
      placed++;
    }

    // Calculate adjacent counts
    for (var r2 = 0; r2 < this._rows; r2++) {
      for (var c2 = 0; c2 < this._cols; c2++) {
        if (this._grid[r2 * this._cols + c2].mine) continue;

        var count = 0;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            var nr = r2 + dr, nc = c2 + dc;
            if (nr >= 0 && nr < this._rows && nc >= 0 && nc < this._cols) {
              if (this._grid[nr * this._cols + nc].mine) count++;
            }
          }
        }
        this._grid[r2 * this._cols + c2].adjacent = count;
      }
    }
  };

  /**
   * Reveal a cell. If it's a mine, game over. If 0 adjacent, flood fill.
   */
  Minesweeper.prototype._reveal = function (c, r) {
    if (c < 0 || c >= this._cols || r < 0 || r >= this._rows) return;
    var cell = this._grid[r * this._cols + c];
    if (cell.revealed || cell.flagged) return;

    cell.revealed = true;

    if (cell.mine) {
      // Hit a mine — boom then game over
      this.playSFX('boom');
      this._revealAllMines();
      this.setState(ArcadeEngine.STATE.GAME_OVER);
      return;
    }

    // Add score for safe cell reveal
    this.addScore(5);

    // Flood fill if no adjacent mines
    if (cell.adjacent === 0) {
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          this._reveal(c + dc, r + dr);
        }
      }
    }
  };

  /**
   * Reveal all mines when player hits one.
   */
  Minesweeper.prototype._revealAllMines = function () {
    for (var i = 0; i < this._grid.length; i++) {
      if (this._grid[i].mine) {
        this._grid[i].revealed = true;
      }
    }
  };

  /**
   * Check if all non-mine cells are revealed.
   */
  Minesweeper.prototype._checkWinCondition = function () {
    for (var i = 0; i < this._grid.length; i++) {
      var cell = this._grid[i];
      if (!cell.mine && !cell.revealed) return;
    }
    // Won!
    this._won = true;
    var winBonus = Math.max(0, 1000 - Math.floor(this._elapsedTime / 1000) * 5);
    this.addScore(winBonus);
    this.playSFX('win');
    // Suppress the sad game-over SFX — win fanfare is sufficient
    var savedGO = this.sfxMap['game-over'];
    this.sfxMap['game-over'] = null;
    this.setState(ArcadeEngine.STATE.GAME_OVER);
    this.sfxMap['game-over'] = savedGO;
  };

  // ════════════════════════════════════════════════════════════
  // UPDATE
  // ════════════════════════════════════════════════════════════

  Minesweeper.prototype.onUpdate = function (dt) {
    // Track elapsed time for scoring
    this._elapsedTime += dt;
  };

  // ════════════════════════════════════════════════════════════
  // DRAW
  // ════════════════════════════════════════════════════════════

  Minesweeper.prototype.onDraw = function (ctx, W, H) {
    var ph = this.colors.phosphor;
    var dim = this.colors.phosphorDim;
    var C = this._cellSize;
    var ox = this._gridOffsetX;
    var oy = this._gridOffsetY;

    // Color palette for numbers 1-8
    var numColors = [
      ph,         // 0 (unused)
      '#4488ff',  // 1 blue
      '#44cc44',  // 2 green
      '#ff4444',  // 3 red
      '#aa44ff',  // 4 purple
      '#ff8800',  // 5 orange
      '#44ffff',  // 6 cyan
      '#ff44ff',  // 7 pink
      '#ffffff'   // 8 white
    ];

    // Draw cells
    for (var r = 0; r < this._rows; r++) {
      for (var c = 0; c < this._cols; c++) {
        var cell = this._grid[r * this._cols + c];
        var x = ox + c * C;
        var y = oy + r * C;

        if (cell.revealed) {
          // Revealed cell — dark flat background
          ctx.fillStyle = '#111';
          ctx.fillRect(x, y, C, C);
          ctx.strokeStyle = '#1a1a1a';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, C, C);

          if (cell.mine) {
            // Boom! Draw mine with glow
            this.drawEmoji(ctx, '💣', x + C / 2, y + C / 2, C * 0.7, {
              glow: true,
              glowColor: '#ff4757',
              glowRadius: 6
            });
          } else if (cell.adjacent > 0) {
            // Draw number with appropriate color
            var numColor = numColors[cell.adjacent] || ph;
            ctx.save();
            ctx.fillStyle = numColor;
            ctx.shadowColor = numColor;
            ctx.shadowBlur = 3;
            ctx.font = 'bold ' + Math.floor(C * 0.6) + 'px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(cell.adjacent), x + C / 2, y + C / 2);
            ctx.restore();
          }
        } else {
          // Hidden cell — dark raised appearance with phosphor border
          ctx.fillStyle = dim;
          ctx.globalAlpha = 0.4;
          ctx.fillRect(x, y, C, C);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = dim;
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, C, C);

          // Draw as emoji hidden cell
          this.drawEmoji(ctx, '⬛', x + C / 2, y + C / 2, C * 0.75);

          // If flagged, draw flag emoji
          if (cell.flagged) {
            this.drawEmoji(ctx, '🚩', x + C / 2, y + C / 2, C * 0.6, {
              glow: true,
              glowColor: ph,
              glowRadius: 4
            });
          }
        }
      }
    }

    // HUD
    var mineCount = this._mineCount;
    var flagCount = 0;
    for (var i = 0; i < this._grid.length; i++) {
      if (this._grid[i].flagged) flagCount++;
    }
    var elapsedSeconds = Math.floor(this._elapsedTime / 1000);

    var hudY = 14;
    this.drawText(ctx, 'MINES: ' + mineCount + '  FLAGS: ' + flagCount + '  TIME: ' + elapsedSeconds + 's',
      8, hudY, 11, ph);

    // Game over overlay
    if (this.state === ArcadeEngine.STATE.GAME_OVER) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, W, H);

      var message = this._won ? 'CLEARED!' : 'BOOM!';
      var msgColor = this._won ? '#44cc44' : '#ff4444';
      this.drawText(ctx, message, W / 2, H / 2 - 20, 20, msgColor, 'center');

      var scoreMsg = 'SCORE: ' + this.score;
      this.drawText(ctx, scoreMsg, W / 2, H / 2 + 8, 12, ph, 'center');

      var timeMsg = 'TIME: ' + elapsedSeconds + 's';
      this.drawText(ctx, timeMsg, W / 2, H / 2 + 24, 11, dim, 'center');

      this.drawText(ctx, '[SPACE] RETRY', W / 2, H / 2 + 45, 10, ph, 'center');
    }
  };

  // ════════════════════════════════════════════════════════════
  // EXPORT — MinigameModal compatible
  // ════════════════════════════════════════════════════════════

  var instance = new Minesweeper();
  return instance.asMinigame();
})();
