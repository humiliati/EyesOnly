/* ============================================================
   FROGGER — Classic road / river crossing
   Canvas-based, CRT-themed.
   ============================================================ */
window.FroggerGame = (function () {
  'use strict';

  var ctx, W, H, raf;
  var ROWS = 13, TILE;
  var frog, lives, level, score;
  var lanes = [];
  var alive, winSlots;

  function reset() {
    TILE = Math.floor(H / ROWS);
    lives = 3;
    level = 1;
    score = 0;
    alive = true;
    winSlots = [false, false, false, false, false];
    buildLanes();
    resetFrog();
  }

  function resetFrog() {
    frog = { col: Math.floor((W / TILE) / 2), row: ROWS - 1 };
    alive = true;
  }

  function buildLanes() {
    lanes = [];
    var totalCols = Math.ceil(W / TILE) + 4;
    for (var r = 0; r < ROWS; r++) {
      if (r === 0) { lanes.push({ type: 'goal' }); continue; }
      if (r === ROWS - 1) { lanes.push({ type: 'safe' }); continue; }
      if (r === 6) { lanes.push({ type: 'safe' }); continue; }

      var isWater = r >= 1 && r <= 5;
      var spd = (0.5 + Math.random() * 1.5) * (r % 2 === 0 ? 1 : -1) * (1 + level * 0.1);
      var objW = isWater ? (2 + Math.floor(Math.random() * 3)) : (1 + Math.floor(Math.random() * 2));
      var gap = objW + 2 + Math.floor(Math.random() * 3);
      var objs = [];
      for (var x = -2; x < totalCols; x += gap) {
        objs.push({ x: x, w: objW });
      }
      lanes.push({ type: isWater ? 'water' : 'road', speed: spd, objs: objs });
    }
  }

  function update() {
    if (!alive) return;

    // Move lane objects
    for (var r = 0; r < lanes.length; r++) {
      var lane = lanes[r];
      if (!lane.objs) continue;
      for (var i = 0; i < lane.objs.length; i++) {
        lane.objs[i].x += lane.speed * 0.02;
      }
    }

    // Frog interactions
    var fr = frog.row;
    var fx = frog.col;
    var lane = lanes[fr];
    if (!lane) return;

    if (lane.type === 'road') {
      // Check car collision
      for (var i = 0; i < lane.objs.length; i++) {
        var o = lane.objs[i];
        if (fx >= o.x && fx < o.x + o.w) {
          die();
          return;
        }
      }
    } else if (lane.type === 'water') {
      // Must be on a log
      var onLog = false;
      for (var i = 0; i < lane.objs.length; i++) {
        var o = lane.objs[i];
        if (fx >= o.x - 0.3 && fx < o.x + o.w + 0.3) {
          onLog = true;
          frog.col += lane.speed * 0.02;
          break;
        }
      }
      if (!onLog) {
        die();
        return;
      }
    } else if (lane.type === 'goal' && fr === 0) {
      // Win slot
      var slot = Math.floor(fx / (Math.ceil(W / TILE) / 5));
      if (slot < 0) slot = 0;
      if (slot > 4) slot = 4;
      if (!winSlots[slot]) {
        winSlots[slot] = true;
        score += 100;
      }
      // Check all slots filled
      if (winSlots.every(function (s) { return s; })) {
        level++;
        winSlots = [false, false, false, false, false];
        buildLanes();
      }
      resetFrog();
    }

    // Out of bounds
    if (frog.col < 0 || frog.col >= Math.ceil(W / TILE)) {
      die();
    }
  }

  function die() {
    lives--;
    alive = false;
    if (lives > 0) {
      setTimeout(function () { resetFrog(); }, 600);
    }
  }

  function draw() {
    var ph = getComputedStyle(document.documentElement).getPropertyValue('--phosphor').trim() || '#1cff9b';
    var dim = getComputedStyle(document.documentElement).getPropertyValue('--phosphor-dim').trim() || '#1a6b4a';

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Draw lanes
    for (var r = 0; r < ROWS; r++) {
      var lane = lanes[r];
      if (!lane) continue;
      var ly = r * TILE;

      if (lane.type === 'road') {
        ctx.fillStyle = '#0f0f0f';
        ctx.fillRect(0, ly, W, TILE);
        // Cars
        ctx.fillStyle = '#c44';
        for (var i = 0; i < lane.objs.length; i++) {
          var o = lane.objs[i];
          ctx.fillRect(o.x * TILE, ly + 2, o.w * TILE, TILE - 4);
        }
      } else if (lane.type === 'water') {
        ctx.fillStyle = '#001a33';
        ctx.fillRect(0, ly, W, TILE);
        // Logs
        ctx.fillStyle = dim;
        for (var i = 0; i < lane.objs.length; i++) {
          var o = lane.objs[i];
          ctx.fillRect(o.x * TILE, ly + 3, o.w * TILE, TILE - 6);
        }
      } else if (lane.type === 'goal') {
        ctx.fillStyle = '#001a33';
        ctx.fillRect(0, ly, W, TILE);
        // Win slots
        var slotW = Math.ceil(W / TILE) / 5;
        for (var s = 0; s < 5; s++) {
          if (winSlots[s]) {
            ctx.fillStyle = ph;
            ctx.globalAlpha = 0.3;
            ctx.fillRect(s * slotW * TILE, ly, slotW * TILE, TILE);
            ctx.globalAlpha = 1;
          }
        }
      } else {
        // Safe zone
        ctx.fillStyle = '#0a120a';
        ctx.fillRect(0, ly, W, TILE);
      }
    }

    // Frog
    if (alive) {
      ctx.fillStyle = ph;
      var fx = frog.col * TILE + TILE * 0.15;
      var fy = frog.row * TILE + TILE * 0.15;
      var fs = TILE * 0.7;
      ctx.fillRect(fx, fy, fs, fs);
      // Eyes
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(fx + fs * 0.2, fy + fs * 0.15, 3, 3);
      ctx.fillRect(fx + fs * 0.6, fy + fs * 0.15, 3, 3);
    }

    // HUD
    ctx.fillStyle = ph;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LVL:' + level + '  SCORE:' + score + '  LIVES:' + lives, 8, H - 6);

    if (lives <= 0) {
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 6);
      ctx.font = '11px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 14);
      ctx.fillText('[SPACE] RETRY', W / 2, H / 2 + 30);
    }
  }

  function loop() {
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onKeyDown(e) {
    if (e.key === ' ' && lives <= 0) { e.preventDefault(); reset(); return; }
    if (!alive || lives <= 0) return;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { frog.row--; score += 10; }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { frog.row = Math.min(frog.row + 1, ROWS - 1); }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { frog.col--; }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { frog.col++; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) !== -1) e.preventDefault();
  }

  return {
    start: function (canvas) {
      ctx = canvas.getContext('2d');
      W = canvas.width;
      H = canvas.height;
      reset();
      document.addEventListener('keydown', onKeyDown);
      loop();
    },
    stop: function () {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
    },
    resize: function (canvas) {
      W = canvas.width;
      H = canvas.height;
      reset();
    }
  };
})();
