/* ============================================================
   BREAKOUT — Brick-breaker arcade game
   Canvas-based, CRT-themed.
   ============================================================ */
window.BreakoutGame = (function () {
  'use strict';

  var ctx, W, H, raf;
  var paddle, ball, bricks, score, lives, level;
  var alive, serving;
  var BRICK_ROWS = 5, BRICK_COLS, BRICK_H = 12, BRICK_PAD = 2;
  var PADDLE_W = 60, PADDLE_H = 8;

  function reset() {
    BRICK_COLS = Math.floor(W / 36);
    paddle = { x: W / 2, w: PADDLE_W, h: PADDLE_H };
    score = 0;
    lives = 3;
    level = 1;
    alive = true;
    buildBricks();
    serveBall();
  }

  function buildBricks() {
    bricks = [];
    var bw = (W - BRICK_PAD * (BRICK_COLS + 1)) / BRICK_COLS;
    for (var r = 0; r < BRICK_ROWS; r++) {
      for (var c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_PAD + c * (bw + BRICK_PAD),
          y: 30 + r * (BRICK_H + BRICK_PAD),
          w: bw,
          h: BRICK_H,
          alive: true,
          tier: BRICK_ROWS - r
        });
      }
    }
  }

  function serveBall() {
    ball = {
      x: W / 2,
      y: H - 40,
      vx: (Math.random() < 0.5 ? 1 : -1) * (2 + level * 0.3),
      vy: -(3 + level * 0.3),
      r: 4
    };
    serving = true;
  }

  function update() {
    if (!alive) return;

    // Ball movement
    if (!serving) {
      ball.x += ball.vx;
      ball.y += ball.vy;
    } else {
      ball.x = paddle.x;
      ball.y = H - 30 - PADDLE_H;
    }

    // Wall bounce
    if (ball.x - ball.r <= 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.r >= W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.r <= 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

    // Death
    if (ball.y > H + 10) {
      lives--;
      if (lives <= 0) { alive = false; return; }
      serveBall();
      return;
    }

    // Paddle collision
    if (ball.vy > 0 &&
        ball.y + ball.r >= H - 20 - paddle.h &&
        ball.y + ball.r <= H - 20 &&
        ball.x >= paddle.x - paddle.w / 2 &&
        ball.x <= paddle.x + paddle.w / 2) {
      ball.vy = -Math.abs(ball.vy);
      // Angle based on where ball hit paddle
      var offset = (ball.x - paddle.x) / (paddle.w / 2);
      ball.vx += offset * 2;
      // Cap horizontal speed
      if (ball.vx > 5) ball.vx = 5;
      if (ball.vx < -5) ball.vx = -5;
    }

    // Brick collisions
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
          ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        b.alive = false;
        score += b.tier * 10;
        // Simple bounce direction
        var overlapLeft = (ball.x + ball.r) - b.x;
        var overlapRight = (b.x + b.w) - (ball.x - ball.r);
        var overlapTop = (ball.y + ball.r) - b.y;
        var overlapBottom = (b.y + b.h) - (ball.y - ball.r);
        var minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (minOverlap === overlapTop || minOverlap === overlapBottom) ball.vy = -ball.vy;
        else ball.vx = -ball.vx;
        break;
      }
    }

    // Level clear
    var remaining = bricks.filter(function (b) { return b.alive; }).length;
    if (remaining === 0) {
      level++;
      buildBricks();
      serveBall();
    }
  }

  function draw() {
    var ph = getComputedStyle(document.documentElement).getPropertyValue('--phosphor').trim() || '#1cff9b';
    var dim = getComputedStyle(document.documentElement).getPropertyValue('--phosphor-dim').trim() || '#1a6b4a';

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Bricks
    var tierColors = ['#f44', '#ff8800', '#ffcc00', dim, ph];
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      ctx.fillStyle = tierColors[b.tier - 1] || ph;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // Paddle
    ctx.fillStyle = ph;
    ctx.fillRect(paddle.x - paddle.w / 2, H - 20 - paddle.h, paddle.w, paddle.h);

    // Ball
    ctx.fillStyle = ph;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    // HUD
    ctx.fillStyle = ph;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE:' + score + '  LIVES:' + lives + '  LVL:' + level, 8, 14);

    if (serving) {
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[SPACE] SERVE', W / 2, H / 2);
    }

    if (!alive) {
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
      ctx.font = '11px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('[SPACE] RETRY', W / 2, H / 2 + 26);
    }
  }

  function loop() {
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onMouseMove(e) {
    var rect = ctx.canvas.getBoundingClientRect();
    paddle.x = (e.clientX - rect.left) * (W / rect.width);
    if (paddle.x < paddle.w / 2) paddle.x = paddle.w / 2;
    if (paddle.x > W - paddle.w / 2) paddle.x = W - paddle.w / 2;
  }

  function onKeyDown(e) {
    if (e.key === ' ') {
      e.preventDefault();
      if (!alive) { reset(); return; }
      if (serving) { serving = false; }
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { paddle.x -= 20; if (paddle.x < paddle.w / 2) paddle.x = paddle.w / 2; }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { paddle.x += 20; if (paddle.x > W - paddle.w / 2) paddle.x = W - paddle.w / 2; }
  }

  function onTouchMove(e) {
    e.preventDefault();
    var rect = ctx.canvas.getBoundingClientRect();
    var touch = e.touches[0];
    paddle.x = (touch.clientX - rect.left) * (W / rect.width);
    if (paddle.x < paddle.w / 2) paddle.x = paddle.w / 2;
    if (paddle.x > W - paddle.w / 2) paddle.x = W - paddle.w / 2;
  }

  function onTouchStart(e) {
    if (serving) { serving = false; }
    if (!alive) { reset(); }
  }

  return {
    start: function (canvas) {
      ctx = canvas.getContext('2d');
      W = canvas.width;
      H = canvas.height;
      reset();
      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchstart', onTouchStart);
      document.addEventListener('keydown', onKeyDown);
      loop();
    },
    stop: function () {
      cancelAnimationFrame(raf);
      if (ctx && ctx.canvas) {
        ctx.canvas.removeEventListener('mousemove', onMouseMove);
        ctx.canvas.removeEventListener('touchmove', onTouchMove);
        ctx.canvas.removeEventListener('touchstart', onTouchStart);
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
