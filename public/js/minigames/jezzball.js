/* ============================================================
   JEZZBALL — Field Containment Protocol
   Canvas-based, CRT-themed.

   Touch/click to start building a wall. Drag direction determines
   horizontal vs vertical orientation. Quick tap uses last direction.
   Trap all balls in < 25% of the area to advance.

   Mobile-first: pointerdown/move/up replaces click.
   ============================================================ */
window.JezzBallGame = (function () {
  'use strict';

  var ctx, W, H, raf;
  var CELL = 8;
  var cols, rows, grid;            // 0 = open, 1 = wall, 2 = building
  var balls, level, lives, pct, score;
  var building = null;             // { dir:'h'|'v', headA, headB, doneA, doneB }
  var direction = 'h';             // next wall direction
  var won = false, lost = false;

  // ── Touch/pointer state for drag-to-orient ──
  var pointerDown = false;
  var pointerStartX = 0;
  var pointerStartY = 0;
  var pointerStartTime = 0;
  var orientDecided = false;       // did this gesture decide H/V?
  var DRAG_THRESHOLD = 8;          // px movement before orientation is locked
  var TAP_MAX_TIME = 250;          // ms — quick release = use last direction

  // ── Direction indicator ──
  var dirIndicator = null;         // { x, y, dir, timer }

  function reset() {
    cols = Math.floor(W / CELL);
    rows = Math.floor(H / CELL);
    grid = [];
    for (var i = 0; i < cols * rows; i++) grid[i] = 0;
    // Border walls
    for (var c = 0; c < cols; c++) { grid[c] = 1; grid[(rows - 1) * cols + c] = 1; }
    for (var r = 0; r < rows; r++) { grid[r * cols] = 1; grid[r * cols + cols - 1] = 1; }
    balls = [];
    level = 1;
    lives = 3;
    score = 0;
    won = false;
    lost = false;
    building = null;
    direction = 'h';
    dirIndicator = null;
    spawnBalls(level + 1);
    calcPct();
  }

  // ── Ball spawning with safety checks ──
  function spawnBalls(n) {
    for (var i = 0; i < n; i++) {
      var bx, by, bc, br, attempts = 0;
      // Try up to 30 times to find a spawn position in an open cell
      // with at least 2 cells margin from any wall
      do {
        bx = CELL * 3 + Math.random() * (W - CELL * 6);
        by = CELL * 3 + Math.random() * (H - CELL * 6);
        bc = Math.floor(bx / CELL);
        br = Math.floor(by / CELL);
        attempts++;
      } while (attempts < 30 && !isSpawnSafe(bc, br));

      // If still not safe after 30 tries, snap to center of a known open cell
      if (!isSpawnSafe(bc, br)) {
        var open = findOpenCell();
        if (open) {
          bc = open.c;
          br = open.r;
          bx = bc * CELL + CELL / 2;
          by = br * CELL + CELL / 2;
        }
      }

      balls.push({
        x: bx,
        y: by,
        vx: (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random()),
        vy: (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random()),
        r: 4
      });
    }
  }

  function isSpawnSafe(c, r) {
    // Check a 5×5 area around the cell is all open (2-cell margin)
    for (var dr = -2; dr <= 2; dr++) {
      for (var dc = -2; dc <= 2; dc++) {
        var nc = c + dc;
        var nr = r + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) return false;
        if (grid[nr * cols + nc] !== 0) return false;
      }
    }
    return true;
  }

  function findOpenCell() {
    // Scan from center outward for an open cell
    var midC = Math.floor(cols / 2);
    var midR = Math.floor(rows / 2);
    for (var d = 0; d < Math.max(cols, rows); d++) {
      for (var dr = -d; dr <= d; dr++) {
        for (var dc = -d; dc <= d; dc++) {
          if (Math.abs(dr) !== d && Math.abs(dc) !== d) continue;
          var nc = midC + dc;
          var nr = midR + dr;
          if (nc >= 2 && nc < cols - 2 && nr >= 2 && nr < rows - 2) {
            if (grid[nr * cols + nc] === 0) return { c: nc, r: nr };
          }
        }
      }
    }
    return null;
  }

  function cellAt(px, py) {
    var c = Math.floor(px / CELL);
    var r = Math.floor(py / CELL);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return 1;
    return grid[r * cols + c];
  }

  function setCell(c, r, v) {
    if (c >= 0 && c < cols && r >= 0 && r < rows) grid[r * cols + c] = v;
  }

  function calcPct() {
    var total = 0, filled = 0;
    for (var i = 0; i < grid.length; i++) { total++; if (grid[i] === 1) filled++; }
    pct = Math.round((filled / total) * 100);
  }

  function startBuild(mx, my) {
    if (building || won || lost) return;
    var c = Math.floor(mx / CELL);
    var r = Math.floor(my / CELL);
    if (c < 1 || c >= cols - 1 || r < 1 || r >= rows - 1) return;
    if (grid[r * cols + c] !== 0) return;
    building = {
      dir: direction,
      headA: { c: c, r: r },
      headB: { c: c, r: r },
      doneA: false,
      doneB: false
    };
    setCell(c, r, 2);
    playSFX('drop-1', 0.4);       // wall start — short blip
  }

  function advanceBuild() {
    if (!building) return;
    var b = building;
    // Advance head A
    if (!b.doneA) {
      var na = nextHead(b.headA, b.dir, -1);
      if (na.c < 0 || na.c >= cols || na.r < 0 || na.r >= rows || grid[na.r * cols + na.c] === 1) {
        b.doneA = true;
      } else {
        setCell(na.c, na.r, 2);
        b.headA = na;
      }
    }
    // Advance head B
    if (!b.doneB) {
      var nb = nextHead(b.headB, b.dir, 1);
      if (nb.c < 0 || nb.c >= cols || nb.r < 0 || nb.r >= rows || grid[nb.r * cols + nb.c] === 1) {
        b.doneB = true;
      } else {
        setCell(nb.c, nb.r, 2);
        b.headB = nb;
      }
    }
    // Check collisions with balls
    for (var i = 0; i < balls.length; i++) {
      var ball = balls[i];
      var bc = Math.floor(ball.x / CELL);
      var br = Math.floor(ball.y / CELL);
      // Check ball center cell and adjacent cells within ball radius
      if (isBuildingAt(bc, br) || isBuildingAt(bc - 1, br) || isBuildingAt(bc + 1, br) ||
          isBuildingAt(bc, br - 1) || isBuildingAt(bc, br + 1)) {
        destroyBuild();
        lives--;
        playSFX('hit-' + (1 + Math.floor(Math.random() * 4)), 0.5);  // wall destruction
        if (lives <= 0) {
          lost = true;
          playSFX('game-over-1', 0.6);
        }
        return;
      }
    }
    if (b.doneA && b.doneB) {
      // Convert building cells to walls
      var wallCells = 0;
      for (var j = 0; j < grid.length; j++) {
        if (grid[j] === 2) { grid[j] = 1; wallCells++; }
      }
      building = null;
      floodFillOpen();
      calcPct();

      // Score for wall completion
      score += wallCells * 5;
      playSFX('metal-hit-1', 0.3);   // wall sealed — metallic click

      if (pct >= 75) {
        score += 1000;
        playSFX('toad', 0.6);
        level++;
        nextLevel();
      }
    }
  }

  function isBuildingAt(c, r) {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
    return grid[r * cols + c] === 2;
  }

  function nextHead(head, dir, sign) {
    return dir === 'h'
      ? { c: head.c + sign, r: head.r }
      : { c: head.c, r: head.r + sign };
  }

  function destroyBuild() {
    for (var j = 0; j < grid.length; j++) { if (grid[j] === 2) grid[j] = 0; }
    building = null;
  }

  function floodFillOpen() {
    // Flood-fill from each ball; cells reachable by any ball stay open.
    // Everything else becomes wall.
    var visited = new Uint8Array(cols * rows);
    for (var i = 0; i < balls.length; i++) {
      var bc = Math.floor(balls[i].x / CELL);
      var br = Math.floor(balls[i].y / CELL);
      if (bc < 0 || bc >= cols || br < 0 || br >= rows) continue;
      flood(visited, bc, br);
    }
    for (var j = 0; j < grid.length; j++) {
      if (grid[j] === 0 && !visited[j]) grid[j] = 1;
    }
  }

  function flood(visited, c, r) {
    var stack = [[c, r]];
    while (stack.length) {
      var cur = stack.pop();
      var cc = cur[0], cr = cur[1];
      if (cc < 0 || cc >= cols || cr < 0 || cr >= rows) continue;
      var idx = cr * cols + cc;
      if (visited[idx] || grid[idx] === 1) continue;
      visited[idx] = 1;
      stack.push([cc - 1, cr], [cc + 1, cr], [cc, cr - 1], [cc, cr + 1]);
    }
  }

  function nextLevel() {
    // Keep walls, spawn more balls
    won = false;
    building = null;
    spawnBalls(level + 1);
    calcPct();
  }

  function updateBalls() {
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      b.x += b.vx;
      b.y += b.vy;
      // Wall bounce — test each axis independently for correct deflection
      var hitX = false, hitY = false;
      if (cellAt(b.x + b.r, b.y) === 1 || cellAt(b.x - b.r, b.y) === 1) hitX = true;
      if (cellAt(b.x, b.y + b.r) === 1 || cellAt(b.x, b.y - b.r) === 1) hitY = true;
      if (hitX) b.vx = -b.vx;
      if (hitY) b.vy = -b.vy;
      // Keep in bounds (hard clamp)
      if (b.x < CELL + b.r) { b.x = CELL + b.r; b.vx = Math.abs(b.vx); }
      if (b.x > W - CELL - b.r) { b.x = W - CELL - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < CELL + b.r) { b.y = CELL + b.r; b.vy = Math.abs(b.vy); }
      if (b.y > H - CELL - b.r) { b.y = H - CELL - b.r; b.vy = -Math.abs(b.vy); }
    }
  }

  // ── Audio bridge ──
  function playSFX(name, vol) {
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playSFX) {
      AudioSystem.playSFX(name, { volume: vol || 0.5 });
    } else if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play(name, { volume: vol || 0.5 });
    }
  }

  function update() {
    if (won || lost) return;
    updateBalls();
    if (building) { advanceBuild(); advanceBuild(); }
    // Direction indicator decay
    if (dirIndicator) {
      dirIndicator.timer -= 16;
      if (dirIndicator.timer <= 0) dirIndicator = null;
    }
  }

  function draw() {
    var ph = getComputedStyle(document.documentElement).getPropertyValue('--phosphor').trim() || '#1cff9b';
    var dim = getComputedStyle(document.documentElement).getPropertyValue('--phosphor-dim').trim() || '#1a6b4a';

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var v = grid[r * cols + c];
        if (v === 1) {
          ctx.fillStyle = dim;
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        } else if (v === 2) {
          // Building wall — pulsing glow
          var pulse = 0.4 + 0.3 * Math.sin(Date.now() * 0.01);
          ctx.fillStyle = ph;
          ctx.globalAlpha = pulse;
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Balls with glow
    for (var i = 0; i < balls.length; i++) {
      var ball = balls[i];
      ctx.save();
      ctx.shadowColor = ph;
      ctx.shadowBlur = 6;
      ctx.fillStyle = ph;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Direction indicator at touch point
    if (dirIndicator) {
      var alpha = Math.min(1, dirIndicator.timer / 300);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ph;
      ctx.lineWidth = 2;
      ctx.beginPath();
      var len = 14;
      if (dirIndicator.dir === 'h') {
        ctx.moveTo(dirIndicator.x - len, dirIndicator.y);
        ctx.lineTo(dirIndicator.x + len, dirIndicator.y);
        // Arrow heads
        ctx.moveTo(dirIndicator.x - len, dirIndicator.y);
        ctx.lineTo(dirIndicator.x - len + 4, dirIndicator.y - 3);
        ctx.moveTo(dirIndicator.x - len, dirIndicator.y);
        ctx.lineTo(dirIndicator.x - len + 4, dirIndicator.y + 3);
        ctx.moveTo(dirIndicator.x + len, dirIndicator.y);
        ctx.lineTo(dirIndicator.x + len - 4, dirIndicator.y - 3);
        ctx.moveTo(dirIndicator.x + len, dirIndicator.y);
        ctx.lineTo(dirIndicator.x + len - 4, dirIndicator.y + 3);
      } else {
        ctx.moveTo(dirIndicator.x, dirIndicator.y - len);
        ctx.lineTo(dirIndicator.x, dirIndicator.y + len);
        ctx.moveTo(dirIndicator.x, dirIndicator.y - len);
        ctx.lineTo(dirIndicator.x - 3, dirIndicator.y - len + 4);
        ctx.moveTo(dirIndicator.x, dirIndicator.y - len);
        ctx.lineTo(dirIndicator.x + 3, dirIndicator.y - len + 4);
        ctx.moveTo(dirIndicator.x, dirIndicator.y + len);
        ctx.lineTo(dirIndicator.x - 3, dirIndicator.y + len - 4);
        ctx.moveTo(dirIndicator.x, dirIndicator.y + len);
        ctx.lineTo(dirIndicator.x + 3, dirIndicator.y + len - 4);
      }
      ctx.stroke();
      ctx.restore();
    }

    // HUD
    ctx.fillStyle = ph;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LVL:' + level + '  FILLED:' + pct + '%  LIVES:' + lives + '  SCR:' + score, 8, 14);

    // Direction badge (top-right)
    ctx.textAlign = 'right';
    ctx.fillStyle = direction === 'h' ? ph : '#ff9b1c';
    ctx.fillText('[' + (direction === 'h' ? '━ HORIZ' : '┃ VERT') + ']', W - 8, 14);

    if (lost) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = ph;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 16);
      ctx.font = '11px monospace';
      ctx.fillText('LEVEL ' + level + ' — ' + pct + '% FILLED', W / 2, H / 2 + 4);
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 20);
      ctx.fillText('TAP or [SPACE] to RETRY', W / 2, H / 2 + 40);
    }
  }

  function loop() {
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  // ════════════════════════════════════════════
  // POINTER INPUT (touch + mouse unified)
  // ════════════════════════════════════════════

  function getCanvasXY(e) {
    var rect = ctx.canvas.getBoundingClientRect();
    var clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    // Return CSS-relative coords (canvas is 1:1 CSS px = canvas px in this game)
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height)
    };
  }

  function onPointerDown(e) {
    e.preventDefault();
    if (lost) { reset(); return; }
    var pos = getCanvasXY(e);
    pointerDown = true;
    pointerStartX = pos.x;
    pointerStartY = pos.y;
    pointerStartTime = Date.now();
    orientDecided = false;
  }

  function onPointerMove(e) {
    if (!pointerDown || orientDecided) return;
    e.preventDefault();
    var pos = getCanvasXY(e);
    var dx = pos.x - pointerStartX;
    var dy = pos.y - pointerStartY;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= DRAG_THRESHOLD) {
      // Decide orientation from drag angle
      if (Math.abs(dx) >= Math.abs(dy)) {
        direction = 'h';
      } else {
        direction = 'v';
      }
      orientDecided = true;

      // Show direction indicator
      dirIndicator = { x: pointerStartX, y: pointerStartY, dir: direction, timer: 600 };

      // Start the wall at the original touch point
      startBuild(pointerStartX, pointerStartY);
      pointerDown = false;
    }
  }

  function onPointerUp(e) {
    if (!pointerDown) return;
    e.preventDefault();
    pointerDown = false;

    var elapsed = Date.now() - pointerStartTime;
    var pos;

    // If orientation wasn't decided by drag (quick tap), use last direction
    if (!orientDecided) {
      if (e.changedTouches && e.changedTouches.length > 0) {
        pos = getCanvasXY(e);
      } else if (e.clientX != null) {
        pos = getCanvasXY(e);
      } else {
        pos = { x: pointerStartX, y: pointerStartY };
      }

      // Show direction indicator for quick taps too
      dirIndicator = { x: pos.x, y: pos.y, dir: direction, timer: 400 };

      startBuild(pos.x, pos.y);
    }
  }

  function onKeyDown(e) {
    if (e.key === ' ') {
      e.preventDefault();
      if (lost) { reset(); return; }
      direction = direction === 'h' ? 'v' : 'h';
      // Show indicator at center
      dirIndicator = { x: W / 2, y: H / 2, dir: direction, timer: 500 };
    }
  }

  // Prevent context menu on long press
  function onContextMenu(e) { e.preventDefault(); }

  return {
    start: function (canvas) {
      ctx = canvas.getContext('2d');
      W = canvas.width;
      H = canvas.height;
      // Ensure AudioSystem manifest is loaded for SFX
      if (typeof AudioSystem !== 'undefined' && AudioSystem.init) {
        try { AudioSystem.init(); } catch (_) {}
      }
      reset();
      // Use touch events + mouse events for full coverage
      canvas.addEventListener('touchstart', onPointerDown, { passive: false });
      canvas.addEventListener('touchmove', onPointerMove, { passive: false });
      canvas.addEventListener('touchend', onPointerUp, { passive: false });
      canvas.addEventListener('mousedown', onPointerDown);
      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      canvas.addEventListener('contextmenu', onContextMenu);
      document.addEventListener('keydown', onKeyDown);
      loop();
    },
    stop: function () {
      cancelAnimationFrame(raf);
      if (ctx && ctx.canvas) {
        ctx.canvas.removeEventListener('touchstart', onPointerDown);
        ctx.canvas.removeEventListener('touchmove', onPointerMove);
        ctx.canvas.removeEventListener('touchend', onPointerUp);
        ctx.canvas.removeEventListener('mousedown', onPointerDown);
        ctx.canvas.removeEventListener('contextmenu', onContextMenu);
      }
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('keydown', onKeyDown);
    },
    resize: function (canvas) {
      W = canvas.width;
      H = canvas.height;
      reset();
    }
  };
})();
