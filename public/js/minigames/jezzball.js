/* ============================================================
   JEZZBALL — Divide the field to trap bouncing balls
   Canvas-based, CRT-themed.
   Click to start building a wall (horizontal); click again or
   press SPACE to toggle vertical.  Trap balls in <20 % area.
   ============================================================ */
window.JezzBallGame = (function () {
  'use strict';

  var ctx, W, H, raf;
  var CELL = 8;
  var cols, rows, grid;            // 0 = open, 1 = wall, 2 = building
  var balls, level, lives, pct;
  var building = null;             // { dir:'h'|'v', cells:[], headA, headB, done }
  var direction = 'h';             // next wall direction
  var won = false, lost = false;

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
    won = false;
    lost = false;
    building = null;
    direction = 'h';
    spawnBalls(level + 1);
    calcPct();
  }

  function spawnBalls(n) {
    for (var i = 0; i < n; i++) {
      balls.push({
        x: CELL * 3 + Math.random() * (W - CELL * 6),
        y: CELL * 3 + Math.random() * (H - CELL * 6),
        vx: (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random()),
        vy: (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random()),
        r: 4
      });
    }
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
  }

  function advanceBuild() {
    if (!building) return;
    var b = building;
    // Advance head A
    if (!b.doneA) {
      var na = nextHead(b.headA, b.dir, -1);
      if (grid[na.r * cols + na.c] === 1) { b.doneA = true; }
      else { setCell(na.c, na.r, 2); b.headA = na; }
    }
    // Advance head B
    if (!b.doneB) {
      var nb = nextHead(b.headB, b.dir, 1);
      if (grid[nb.r * cols + nb.c] === 1) { b.doneB = true; }
      else { setCell(nb.c, nb.r, 2); b.headB = nb; }
    }
    // Check collisions with balls
    for (var i = 0; i < balls.length; i++) {
      var ball = balls[i];
      var bc = Math.floor(ball.x / CELL);
      var br = Math.floor(ball.y / CELL);
      if (grid[br * cols + bc] === 2) {
        destroyBuild();
        lives--;
        if (lives <= 0) lost = true;
        return;
      }
    }
    if (b.doneA && b.doneB) {
      // Convert building cells to walls
      for (var j = 0; j < grid.length; j++) { if (grid[j] === 2) grid[j] = 1; }
      building = null;
      floodFillOpen();
      calcPct();
      if (pct >= 75) {
        level++;
        nextLevel();
      }
    }
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
      // Wall bounce
      if (cellAt(b.x + b.r, b.y) === 1 || cellAt(b.x - b.r, b.y) === 1) b.vx = -b.vx;
      if (cellAt(b.x, b.y + b.r) === 1 || cellAt(b.x, b.y - b.r) === 1) b.vy = -b.vy;
      // Keep in bounds
      if (b.x < CELL + b.r) { b.x = CELL + b.r; b.vx = Math.abs(b.vx); }
      if (b.x > W - CELL - b.r) { b.x = W - CELL - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < CELL + b.r) { b.y = CELL + b.r; b.vy = Math.abs(b.vy); }
      if (b.y > H - CELL - b.r) { b.y = H - CELL - b.r; b.vy = -Math.abs(b.vy); }
    }
  }

  function update() {
    if (won || lost) return;
    updateBalls();
    if (building) { advanceBuild(); advanceBuild(); }
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
        if (v === 1) { ctx.fillStyle = dim; ctx.fillRect(c * CELL, r * CELL, CELL, CELL); }
        else if (v === 2) { ctx.fillStyle = ph; ctx.globalAlpha = 0.5; ctx.fillRect(c * CELL, r * CELL, CELL, CELL); ctx.globalAlpha = 1; }
      }
    }

    // Balls
    ctx.fillStyle = ph;
    for (var i = 0; i < balls.length; i++) {
      ctx.beginPath();
      ctx.arc(balls[i].x, balls[i].y, balls[i].r, 0, Math.PI * 2);
      ctx.fill();
    }

    // HUD
    ctx.fillStyle = ph;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LVL:' + level + '  FILLED:' + pct + '%  LIVES:' + lives + '  [' + (direction === 'h' ? 'HORIZ' : 'VERT') + ']', 8, 14);

    if (lost) {
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 6);
      ctx.font = '11px monospace';
      ctx.fillText('LEVEL ' + level + ' — ' + pct + '% FILLED', W / 2, H / 2 + 14);
      ctx.fillText('[SPACE] RETRY', W / 2, H / 2 + 30);
    }
  }

  function loop() {
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onClick(e) {
    var rect = ctx.canvas.getBoundingClientRect();
    var mx = (e.clientX - rect.left) * (W / rect.width);
    var my = (e.clientY - rect.top) * (H / rect.height);
    startBuild(mx, my);
  }

  function onKeyDown(e) {
    if (e.key === ' ') {
      e.preventDefault();
      if (lost) { reset(); return; }
      direction = direction === 'h' ? 'v' : 'h';
    }
  }

  return {
    start: function (canvas) {
      ctx = canvas.getContext('2d');
      W = canvas.width;
      H = canvas.height;
      reset();
      canvas.addEventListener('click', onClick);
      document.addEventListener('keydown', onKeyDown);
      loop();
    },
    stop: function () {
      cancelAnimationFrame(raf);
      if (ctx && ctx.canvas) ctx.canvas.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    },
    resize: function (canvas) {
      W = canvas.width;
      H = canvas.height;
      reset();
    }
  };
})();
