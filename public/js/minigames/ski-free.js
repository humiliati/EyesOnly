/* ============================================================
   SKI FREE — Retro downhill skiing minigame
   Canvas-based, CRT-themed.  Dodge trees & rocks.
   ============================================================ */
window.SkiFreeGame = (function () {
  'use strict';

  var ctx, W, H, raf;
  var player, obstacles, score, alive, speed;
  var keys = {};
  var PLAYER_W = 14, PLAYER_H = 18;
  var yeti = null, yetiTimer = 0;

  function reset() {
    player = { x: 0, y: 0 };
    obstacles = [];
    score = 0;
    alive = true;
    speed = 2.5;
    yeti = null;
    yetiTimer = 0;
  }

  function spawnObstacle() {
    var type = Math.random() < 0.35 ? 'rock' : 'tree';
    obstacles.push({
      x: Math.random() * W,
      y: -20,
      w: type === 'rock' ? 12 : 10,
      h: type === 'rock' ? 10 : 20,
      type: type
    });
  }

  function spawnYeti() {
    yeti = {
      x: Math.random() < 0.5 ? -30 : W + 30,
      y: player.y - H * 0.3,
      w: 20, h: 24
    };
  }

  function update() {
    if (!alive) return;
    score += 1;
    if (score % 200 === 0) speed += 0.3;
    yetiTimer++;
    if (!yeti && yetiTimer > 1800 && Math.random() < 0.002) spawnYeti();

    // Player movement
    var moveX = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) moveX = -4;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) moveX = 4;
    player.x += moveX;
    if (player.x < PLAYER_W / 2) player.x = PLAYER_W / 2;
    if (player.x > W - PLAYER_W / 2) player.x = W - PLAYER_W / 2;
    player.y = H * 0.7;

    // Spawn obstacles
    if (Math.random() < 0.04 + speed * 0.005) spawnObstacle();

    // Move obstacles
    for (var i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].y += speed;
      if (obstacles[i].y > H + 30) { obstacles.splice(i, 1); continue; }

      // Collision
      var o = obstacles[i];
      if (Math.abs(player.x - o.x) < (PLAYER_W / 2 + o.w / 2) &&
          Math.abs(player.y - o.y) < (PLAYER_H / 2 + o.h / 2)) {
        alive = false;
      }
    }

    // Yeti chase
    if (yeti) {
      var dx = player.x - yeti.x;
      var dy = player.y - yeti.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      yeti.x += (dx / dist) * (speed + 1);
      yeti.y += (dy / dist) * (speed + 0.5);
      if (Math.abs(player.x - yeti.x) < 16 && Math.abs(player.y - yeti.y) < 18) {
        alive = false;
      }
    }
  }

  function draw() {
    var ph = getComputedStyle(document.documentElement).getPropertyValue('--phosphor').trim() || '#1cff9b';
    var dim = getComputedStyle(document.documentElement).getPropertyValue('--phosphor-dim').trim() || '#1a6b4a';

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Snow tracks (subtle)
    ctx.strokeStyle = dim;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.15;
    for (var t = 0; t < 6; t++) {
      var tx = (W / 6) * t + ((score * 0.3) % 40);
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx, H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Obstacles
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      ctx.fillStyle = dim;
      if (o.type === 'tree') {
        // Triangle tree
        ctx.beginPath();
        ctx.moveTo(o.x, o.y - o.h / 2);
        ctx.lineTo(o.x - o.w / 2, o.y + o.h / 2);
        ctx.lineTo(o.x + o.w / 2, o.y + o.h / 2);
        ctx.closePath();
        ctx.fill();
        // Trunk
        ctx.fillRect(o.x - 2, o.y + o.h / 2, 4, 4);
      } else {
        // Rock
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Yeti
    if (yeti) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(yeti.x - yeti.w / 2, yeti.y - yeti.h / 2, yeti.w, yeti.h);
      ctx.fillStyle = '#f44';
      ctx.fillRect(yeti.x - 3, yeti.y - yeti.h / 2 + 4, 3, 3);
      ctx.fillRect(yeti.x + 2, yeti.y - yeti.h / 2 + 4, 3, 3);
    }

    // Player (skier shape)
    ctx.fillStyle = ph;
    ctx.fillRect(player.x - 2, player.y - PLAYER_H / 2, 4, PLAYER_H);
    // Skis
    ctx.fillRect(player.x - PLAYER_W / 2, player.y + PLAYER_H / 2 - 3, PLAYER_W, 3);

    // Score
    ctx.fillStyle = ph;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DIST: ' + score, 8, 18);

    if (!alive) {
      ctx.fillStyle = ph;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WIPEOUT', W / 2, H / 2 - 10);
      ctx.font = '11px monospace';
      ctx.fillText('DISTANCE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('[SPACE] RETRY', W / 2, H / 2 + 30);
    }
  }

  function loop() {
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onKeyDown(e) {
    keys[e.key] = true;
    if (e.key === ' ' && !alive) { reset(); }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].indexOf(e.key) !== -1) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) { keys[e.key] = false; }

  return {
    start: function (canvas) {
      ctx = canvas.getContext('2d');
      W = canvas.width;
      H = canvas.height;
      reset();
      player.x = W / 2;
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      loop();
    },
    stop: function () {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      keys = {};
    },
    resize: function (canvas) {
      W = canvas.width;
      H = canvas.height;
      if (player) {
        player.x = Math.min(player.x, W - PLAYER_W / 2);
      }
    }
  };
})();
