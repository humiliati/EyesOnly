/* ============================================================
   SNAKE — Classic snake game
   Canvas-based, CRT-themed.
   ============================================================ */
window.SnakeGame = (function () {
  'use strict';

  var ctx, W, H, raf;
  var CELL = 12;
  var snake, dir, nextDir, food, score, alive, tickTimer, tickRate;

  function reset() {
    var cols = Math.floor(W / CELL);
    var rows = Math.floor(H / CELL);
    var cx = Math.floor(cols / 2);
    var cy = Math.floor(rows / 2);
    snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy }
    ];
    dir = 'right';
    nextDir = 'right';
    score = 0;
    alive = true;
    tickTimer = 0;
    tickRate = 8;
    placeFood();
  }

  function placeFood() {
    var cols = Math.floor(W / CELL);
    var rows = Math.floor(H / CELL);
    var attempts = 0;
    do {
      food = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
      attempts++;
    } while (isSnake(food.x, food.y) && attempts < 200);
  }

  function isSnake(x, y) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    return false;
  }

  function tick() {
    dir = nextDir;
    var head = { x: snake[0].x, y: snake[0].y };
    if (dir === 'right') head.x++;
    else if (dir === 'left') head.x--;
    else if (dir === 'up') head.y--;
    else if (dir === 'down') head.y++;

    var cols = Math.floor(W / CELL);
    var rows = Math.floor(H / CELL);

    // Wall collision
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
      alive = false;
      return;
    }
    // Self collision
    if (isSnake(head.x, head.y)) {
      alive = false;
      return;
    }

    snake.unshift(head);

    // Eat food
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      if (tickRate > 3) tickRate -= 0.3;
      placeFood();
    } else {
      snake.pop();
    }
  }

  function update() {
    if (!alive) return;
    tickTimer++;
    if (tickTimer >= tickRate) {
      tickTimer = 0;
      tick();
    }
  }

  function draw() {
    var ph = getComputedStyle(document.documentElement).getPropertyValue('--phosphor').trim() || '#1cff9b';
    var dim = getComputedStyle(document.documentElement).getPropertyValue('--phosphor-dim').trim() || '#1a6b4a';

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = dim;
    ctx.lineWidth = 0.3;
    ctx.globalAlpha = 0.1;
    var cols = Math.floor(W / CELL);
    var rows = Math.floor(H / CELL);
    for (var c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, rows * CELL); ctx.stroke(); }
    for (var r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(cols * CELL, r * CELL); ctx.stroke(); }
    ctx.globalAlpha = 1;

    // Snake
    for (var i = 0; i < snake.length; i++) {
      ctx.fillStyle = i === 0 ? ph : dim;
      ctx.fillRect(snake[i].x * CELL + 1, snake[i].y * CELL + 1, CELL - 2, CELL - 2);
    }

    // Food
    ctx.fillStyle = '#f44';
    ctx.fillRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4);

    // HUD
    ctx.fillStyle = ph;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + score + '  LEN: ' + snake.length, 8, 14);

    if (!alive) {
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
    if (e.key === ' ' && !alive) { e.preventDefault(); reset(); return; }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { if (dir !== 'down') nextDir = 'up'; }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { if (dir !== 'up') nextDir = 'down'; }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { if (dir !== 'right') nextDir = 'left'; }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { if (dir !== 'left') nextDir = 'right'; }
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
