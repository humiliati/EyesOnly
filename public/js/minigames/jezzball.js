/* ============================================================
   JEZZBALL — Field Containment Protocol
   Canvas-based, CRT-themed.

   Touch/click to start building a wall. Drag direction determines
   horizontal vs vertical orientation. Quick tap uses last direction.
   Trap all balls in < 25% of the area to advance.

   CLASSIC TRICK MECHANICS:
   - Click adjacent to existing wall → single-direction builder
   - Perpendicular builders meeting → form a sealed box
   - Opposing builders colliding → both destroyed (life lost)
   - Builder hitting another in-progress builder → cancelled (life lost)

   Mobile-first: pointerdown/move/up replaces click.
   ============================================================ */
window.JezzBallGame = (function () {
  'use strict';

  var ctx, W, H, raf;
  var CELL = 8;
  var cols, rows, grid;            // 0 = open, 1 = wall, 2+ = building (builderID + 2)
  var balls, level, lives, pct, score;
  var builders = [];               // array of active builders
  var nextBuilderID = 1;           // unique ID per builder
  var direction = 'h';             // next wall direction
  var won = false, lost = false;
  var MAX_BUILDERS = 4;            // max simultaneous builders
  var BUILD_SPEED = 0.95;          // cells per frame (deliberate, readable pace)
  var buildAccum = 0;              // fractional accumulator for builder steps

  // ── Seal sound pool + cooldown (prevents audio spam) ──
  var SEAL_SOUNDS = ['metal-hit-1', 'metal-hit-2', 'clang1', 'clang2', 'clang3',
                     'clang4', 'clang5', 'clang6', 'impact-1', 'impact-2'];
  var _lastSealSFXTime = 0;
  var SEAL_SFX_COOLDOWN = 200;     // ms between seal sounds

  // ── Level transition animation ──
  var levelTransition = null;      // { timer, nextLevel }

  // ── Touch/pointer state for drag-to-orient ──
  var pointerDown = false;
  var pointerStartX = 0;
  var pointerStartY = 0;
  var pointerStartTime = 0;
  var orientDecided = false;
  var DRAG_THRESHOLD = 8;
  var TAP_MAX_TIME = 250;

  // ── Direction indicator ──
  var dirIndicator = null;

  function reset() {
    cols = Math.floor(W / CELL);
    rows = Math.floor(H / CELL);
    grid = [];
    for (var i = 0; i < cols * rows; i++) grid[i] = 0;
    // Border walls
    for (var c = 0; c < cols; c++) { grid[c] = 1; grid[(rows - 1) * cols + c] = 1; }
    for (var r = 0; r < rows; r++) { grid[r * cols] = 1; grid[r * cols + cols - 1] = 1; }
    balls = [];
    builders = [];
    buildAccum = 0;
    nextBuilderID = 1;
    level = 1;
    lives = 3;
    score = 0;
    won = false;
    lost = false;
    direction = 'h';
    dirIndicator = null;
    levelTransition = null;
    spawnBalls(level + 1);
    calcPct();
  }

  // ── Ball spawning with safety checks ──
  function spawnBalls(n) {
    for (var i = 0; i < n; i++) {
      var bx, by, bc, br, attempts = 0;
      do {
        bx = CELL * 3 + Math.random() * (W - CELL * 6);
        by = CELL * 3 + Math.random() * (H - CELL * 6);
        bc = Math.floor(bx / CELL);
        br = Math.floor(by / CELL);
        attempts++;
      } while (attempts < 30 && !isSpawnSafe(bc, br));

      if (!isSpawnSafe(bc, br)) {
        var open = findOpenCell();
        if (open) {
          bc = open.c;
          br = open.r;
          bx = bc * CELL + CELL / 2;
          by = br * CELL + CELL / 2;
        }
      }

      // Exponential speed curve: starts at ~0.65x, reaches 1.0x around level 6,
      // then keeps climbing gently. Formula: 0.65 * 1.07^(level-1)
      var speedMul = 0.65 * Math.pow(1.07, level - 1);
      var baseSpeed = 1.2 + Math.random();
      balls.push({
        x: bx,
        y: by,
        vx: (Math.random() < 0.5 ? 1 : -1) * baseSpeed * speedMul,
        vy: (Math.random() < 0.5 ? 1 : -1) * baseSpeed * speedMul,
        r: 4
      });
    }
  }

  function isSpawnSafe(c, r) {
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

  function getCellVal(c, r) {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return 1;
    return grid[r * cols + c];
  }

  function calcPct() {
    var total = 0, filled = 0;
    for (var i = 0; i < grid.length; i++) { total++; if (grid[i] === 1) filled++; }
    pct = Math.round((filled / total) * 100);
  }

  // ── Check if a cell is adjacent to an existing wall ──
  function isAdjacentToWall(c, r, dir) {
    // Returns which heads should be disabled based on wall adjacency
    // For a horizontal builder: check left (-1) and right (+1)
    // For a vertical builder: check up (-1) and down (+1)
    var result = { singleBuilder: false, disableA: false, disableB: false };

    if (dir === 'h') {
      var leftC = c - 1;
      var rightC = c + 1;
      var leftIsWall = (leftC < 0 || leftC >= cols) || grid[r * cols + leftC] === 1;
      var rightIsWall = (rightC < 0 || rightC >= cols) || grid[r * cols + rightC] === 1;
      if (leftIsWall && !rightIsWall) {
        result.singleBuilder = true;
        result.disableA = true;  // head A goes left (sign -1), wall is left → disable A
      } else if (rightIsWall && !leftIsWall) {
        result.singleBuilder = true;
        result.disableB = true;  // head B goes right (sign +1), wall is right → disable B
      }
    } else {
      var upR = r - 1;
      var downR = r + 1;
      var upIsWall = (upR < 0 || upR >= rows) || grid[upR * cols + c] === 1;
      var downIsWall = (downR < 0 || downR >= rows) || grid[downR * cols + c] === 1;
      if (upIsWall && !downIsWall) {
        result.singleBuilder = true;
        result.disableA = true;  // head A goes up (sign -1), wall is up → disable A
      } else if (downIsWall && !upIsWall) {
        result.singleBuilder = true;
        result.disableB = true;  // head B goes down (sign +1), wall is down → disable B
      }
    }
    return result;
  }

  // ── Get the builder ID tag for grid cells (unique per builder) ──
  function builderTag(builder) {
    return builder.id + 2;  // 0=open, 1=wall, 2+=builder cells
  }

  function startBuild(mx, my) {
    if (won || lost || levelTransition) return;
    if (builders.length >= MAX_BUILDERS) return;

    var c = Math.floor(mx / CELL);
    var r = Math.floor(my / CELL);
    if (c < 1 || c >= cols - 1 || r < 1 || r >= rows - 1) return;
    if (grid[r * cols + c] !== 0) return;

    var adj = isAdjacentToWall(c, r, direction);
    var id = nextBuilderID++;
    var builder = {
      id: id,
      dir: direction,
      originC: c,              // spawn column (for two-color rendering)
      originR: r,              // spawn row
      headA: { c: c, r: r },
      headB: { c: c, r: r },
      doneA: adj.disableA,   // pre-done if adjacent wall
      doneB: adj.disableB,
      single: adj.singleBuilder
    };

    setCell(c, r, builderTag(builder));
    builders.push(builder);
    playSFX('drop-1', 0.4);
  }

  function advanceBuilders() {
    if (builders.length === 0) return;

    // Advance each builder
    for (var bi = builders.length - 1; bi >= 0; bi--) {
      // Guard: array may have shrunk during collision handling
      if (bi >= builders.length) continue;
      var b = builders[bi];
      if (!b) continue;
      var tag = builderTag(b);
      var destroyed = false;

      // Advance head A
      if (!b.doneA) {
        var na = nextHead(b.headA, b.dir, -1);
        var naVal = getCellVal(na.c, na.r);
        if (naVal === 1) {
          // Hit a sealed wall — seal this half immediately (classic JezzBall)
          b.doneA = true;
          sealHalf(b, 'A');
        } else if (naVal >= 2 && naVal !== tag) {
          // Hit another builder's in-progress wall
          destroyed = handleBuilderCollision(b, naVal - 2, bi);
          if (destroyed) continue;
        } else if (naVal === 0) {
          setCell(na.c, na.r, tag);
          b.headA = na;
        } else {
          b.doneA = true;  // out of bounds
        }
      }

      // Advance head B
      if (!b.doneB && !destroyed) {
        var nb = nextHead(b.headB, b.dir, 1);
        var nbVal = getCellVal(nb.c, nb.r);
        if (nbVal === 1) {
          // Hit a sealed wall — seal this half immediately (classic JezzBall)
          b.doneB = true;
          sealHalf(b, 'B');
        } else if (nbVal >= 2 && nbVal !== tag) {
          destroyed = handleBuilderCollision(b, nbVal - 2, bi);
          if (destroyed) continue;
        } else if (nbVal === 0) {
          setCell(nb.c, nb.r, tag);
          b.headB = nb;
        } else {
          b.doneB = true;
        }
      }

      // Check collisions with balls
      if (!destroyed) {
        var hitBall = false;
        for (var i = 0; i < balls.length; i++) {
          var ball = balls[i];
          var bc = Math.floor(ball.x / CELL);
          var br = Math.floor(ball.y / CELL);
          if (isCellOwnedBy(bc, br, tag) || isCellOwnedBy(bc - 1, br, tag) ||
              isCellOwnedBy(bc + 1, br, tag) || isCellOwnedBy(bc, br - 1, tag) ||
              isCellOwnedBy(bc, br + 1, tag)) {
            hitBall = true;
            break;
          }
        }
        if (hitBall) {
          destroyBuilder(bi);
          lives--;
          playSFX('hit-' + (1 + Math.floor(Math.random() * 4)), 0.5);
          if (lives <= 0) {
            lost = true;
            playSFX('game-over-1', 0.6);
          }
          continue;
        }
      }

      // Check if this builder is complete
      if (!destroyed && b.doneA && b.doneB) {
        sealBuilder(bi);
      }
    }
  }

  // ── Handle collision between two builders ──
  function handleBuilderCollision(currentBuilder, otherID, currentIdx) {
    // Find the other builder
    var otherIdx = -1;
    for (var i = 0; i < builders.length; i++) {
      if (builders[i].id === otherID) { otherIdx = i; break; }
    }
    if (otherIdx === -1) return false;  // other builder already gone

    var other = builders[otherIdx];

    // Check if perpendicular — perpendicular builders meeting = BOTH SEAL (form a box)
    if (currentBuilder.dir !== other.dir) {
      // Perpendicular meeting — seal both builders into walls (trick mechanic!)
      if (otherIdx > currentIdx) {
        sealBuilder(otherIdx);
        sealBuilder(currentIdx);
      } else {
        sealBuilder(currentIdx);
        sealBuilder(otherIdx);
      }
      playSealSFX(0.4);
      return true;
    }

    // Same direction (head-on collision) — preserve partial walls where anchored
    // A builder with doneA=true has its A-side anchored to a sealed wall,
    // so those cells from the anchor to the collision can be kept as partial wall.
    partialSealOrDestroy(currentBuilder, currentIdx);
    // Re-find other after possible splice
    otherIdx = -1;
    for (var j = 0; j < builders.length; j++) {
      if (builders[j].id === otherID) { otherIdx = j; break; }
    }
    if (otherIdx !== -1) partialSealOrDestroy(other, otherIdx);

    lives--;
    playSFX('hit-' + (1 + Math.floor(Math.random() * 4)), 0.5);
    if (lives <= 0) {
      lost = true;
      playSFX('game-over-1', 0.6);
    }
    return true;
  }

  // ── Partial seal: keep anchored portions, destroy unanchored ──
  // If a builder has one head done (reached a wall), the cells from that
  // anchored end form a partial wall. The unanchored side is erased.
  function partialSealOrDestroy(builder, idx) {
    var tag = builderTag(builder);

    if (!builder.doneA && !builder.doneB) {
      // Neither end anchored — full destroy
      destroyBuilder(idx);
      return;
    }

    if (builder.doneA && builder.doneB) {
      // Both ends anchored — full seal (shouldn't happen in collision, but safety)
      sealBuilder(idx);
      return;
    }

    // One end anchored — partial wall. Seal the anchored cells.
    // Walk from the origin cell toward the anchored direction, seal those.
    // Walk from origin toward unanchored direction, erase those.
    // The origin cell of the builder is the midpoint where it was placed.
    // We seal everything tagged with this builder since the anchored head
    // already reached a wall. The unanchored head's "frontier" cells are
    // the ones that didn't reach a wall, but they're still tagged.
    //
    // Strategy: flood-check which tagged cells connect to a sealed wall.
    // Connected cells → seal to wall (1). Unconnected → erase to open (0).

    var connected = {};
    var allCells = [];
    for (var j = 0; j < grid.length; j++) {
      if (grid[j] === tag) {
        allCells.push(j);
      }
    }

    // BFS from each tagged cell that is adjacent to a sealed wall
    var queue = [];
    for (var k = 0; k < allCells.length; k++) {
      var ci = allCells[k] % cols;
      var ri = Math.floor(allCells[k] / cols);
      // Check 4 neighbors for sealed wall
      if ((ci > 0 && grid[ri * cols + ci - 1] === 1) ||
          (ci < cols - 1 && grid[ri * cols + ci + 1] === 1) ||
          (ri > 0 && grid[(ri - 1) * cols + ci] === 1) ||
          (ri < rows - 1 && grid[(ri + 1) * cols + ci] === 1)) {
        connected[allCells[k]] = true;
        queue.push(allCells[k]);
      }
    }

    // Spread connectivity through tagged cells
    while (queue.length > 0) {
      var cur = queue.shift();
      var cc = cur % cols;
      var cr = Math.floor(cur / cols);
      var neighbors = [
        cr * cols + cc - 1,
        cr * cols + cc + 1,
        (cr - 1) * cols + cc,
        (cr + 1) * cols + cc
      ];
      for (var n = 0; n < neighbors.length; n++) {
        var ni = neighbors[n];
        if (ni >= 0 && ni < grid.length && grid[ni] === tag && !connected[ni]) {
          connected[ni] = true;
          queue.push(ni);
        }
      }
    }

    // Seal connected cells, erase unconnected
    var sealed = 0;
    for (var m = 0; m < allCells.length; m++) {
      if (connected[allCells[m]]) {
        grid[allCells[m]] = 1;
        sealed++;
      } else {
        grid[allCells[m]] = 0;
      }
    }

    // Remove builder from array
    builders.splice(idx, 1);

    if (sealed > 0) {
      // Partial wall created — do flood fill and recalc
      floodFillOpen();
      calcPct();
      score += sealed * 3;  // partial wall gets reduced score
      playSealSFX(0.2);

      if (pct >= 75 && !won) {
        won = true;
        score += 1000;
        playSFX('toad', 0.6);
        levelTransition = { timer: 1500 };
      }
    }
  }

  function isCellOwnedBy(c, r, tag) {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
    return grid[r * cols + c] === tag;
  }

  function nextHead(head, dir, sign) {
    return dir === 'h'
      ? { c: head.c + sign, r: head.r }
      : { c: head.c, r: head.r + sign };
  }

  // ── Destroy a builder's cells (erase from grid) ──
  function destroyBuilder(idx) {
    var b = builders[idx];
    var tag = builderTag(b);
    for (var j = 0; j < grid.length; j++) {
      if (grid[j] === tag) grid[j] = 0;
    }
    builders.splice(idx, 1);
  }

  // ── Seal a builder's cells into permanent walls ──
  function sealBuilder(idx) {
    var b = builders[idx];
    var tag = builderTag(b);
    var wallCells = 0;
    for (var j = 0; j < grid.length; j++) {
      if (grid[j] === tag) { grid[j] = 1; wallCells++; }
    }
    builders.splice(idx, 1);

    floodFillOpen();
    calcPct();

    score += wallCells * 5;
    playSealSFX(0.3);

    if (pct >= 75 && !won) {
      won = true;
      score += 1000;
      playSFX('toad', 0.6);
      // Start level transition with brief delay
      levelTransition = { timer: 1500 };
    }
  }

  // ── Seal one half of a builder immediately when that head reaches a wall ──
  // Classic JezzBall behavior: anchored half becomes permanent wall instantly,
  // while the other half keeps building. If the other half is destroyed by a
  // ball, only the unanchored portion is lost — the sealed half stays.
  function sealHalf(builder, side) {
    var tag = builderTag(builder);
    var sealed = 0;

    for (var j = 0; j < grid.length; j++) {
      if (grid[j] !== tag) continue;
      var c = j % cols;
      var r = Math.floor(j / cols);

      var onSide = false;
      if (side === 'A') {
        // Head A goes in -1 direction (left for h, up for v)
        onSide = builder.dir === 'h' ? (c <= builder.originC) : (r <= builder.originR);
      } else {
        // Head B goes in +1 direction (right for h, down for v)
        onSide = builder.dir === 'h' ? (c >= builder.originC) : (r >= builder.originR);
      }

      if (onSide) {
        grid[j] = 1;
        sealed++;
      }
    }

    if (sealed > 0) {
      floodFillOpen();
      calcPct();
      score += sealed * 4;  // partial wall score (slightly less than full seal)
      playSealSFX(0.2);

      if (pct >= 75 && !won) {
        won = true;
        score += 1000;
        playSFX('toad', 0.6);
        levelTransition = { timer: 1500 };
      }
    }
  }

  function floodFillOpen() {
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
    // Reset grid to borders only — clean slate for new level
    for (var i = 0; i < cols * rows; i++) grid[i] = 0;
    for (var c = 0; c < cols; c++) { grid[c] = 1; grid[(rows - 1) * cols + c] = 1; }
    for (var r = 0; r < rows; r++) { grid[r * cols] = 1; grid[r * cols + cols - 1] = 1; }

    // Clear all builders
    builders = [];
    buildAccum = 0;
    won = false;
    levelTransition = null;
    dirIndicator = null;

    // Spawn balls: level + 1 (level 2 = 3 balls, etc.)
    // Keep existing balls BUT reset their positions to avoid wall overlap
    balls = [];
    spawnBalls(level + 1);
    calcPct();
  }

  function updateBalls() {
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      b.x += b.vx;
      b.y += b.vy;
      var hitX = false, hitY = false;
      if (cellAt(b.x + b.r, b.y) === 1 || cellAt(b.x - b.r, b.y) === 1) hitX = true;
      if (cellAt(b.x, b.y + b.r) === 1 || cellAt(b.x, b.y - b.r) === 1) hitY = true;
      if (hitX) b.vx = -b.vx;
      if (hitY) b.vy = -b.vy;
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

  // Cooldown-aware seal sound — picks a random sound from the pool,
  // suppresses rapid-fire calls (sealHalf + sealBuilder in same frame)
  function playSealSFX(vol) {
    var now = Date.now();
    if (now - _lastSealSFXTime < SEAL_SFX_COOLDOWN) return;
    _lastSealSFXTime = now;
    var sound = SEAL_SOUNDS[Math.floor(Math.random() * SEAL_SOUNDS.length)];
    playSFX(sound, vol);
  }

  function update() {
    if (lost) return;

    // Level transition countdown
    if (levelTransition) {
      levelTransition.timer -= 16;
      if (levelTransition.timer <= 0) {
        level++;
        nextLevel();
      }
      return;  // freeze gameplay during transition
    }

    if (won) return;

    updateBalls();
    // Fractional builder advancement (~0.95 cells/frame)
    if (builders.length > 0) {
      buildAccum += BUILD_SPEED;
      while (buildAccum >= 1) {
        advanceBuilders();
        buildAccum -= 1;
      }
    }

    // Direction indicator decay
    if (dirIndicator) {
      dirIndicator.timer -= 16;
      if (dirIndicator.timer <= 0) dirIndicator = null;
    }
  }

  function draw() {
    var ph = getComputedStyle(document.documentElement).getPropertyValue('--phosphor').trim() || '#1cff9b';
    var dim = getComputedStyle(document.documentElement).getPropertyValue('--phosphor-dim').trim() || '#1a6b4a';

    // Parse phosphor hex → RGB for gradient construction
    var phR = parseInt(ph.substr(1, 2), 16) || 28;
    var phG = parseInt(ph.substr(3, 2), 16) || 255;
    var phB = parseInt(ph.substr(5, 2), 16) || 155;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Build a lookup map for two-color rendering
    var _builderMap = {};
    for (var bi = 0; bi < builders.length; bi++) {
      _builderMap[builders[bi].id] = builders[bi];
    }

    // Two-color pairs: [A-side, B-side] per builder slot
    var sideColors = [
      [ph, '#ff9b1c'],           // green / orange
      ['#ff1c9b', '#1c9bff'],    // pink / blue
      ['#ffff1c', '#9b1cff'],    // yellow / purple
      ['#1cffff', '#ff1c1c']     // cyan / red
    ];

    // ── Grid: perimeter walls = 3D blocks, interior = hollowed, builders = two-color ──
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var v = grid[r * cols + c];
        if (v === 1) {
          // Determine perimeter vs interior:
          // Perimeter = adjacent to any non-wall cell (open, builder, or OOB border)
          var bx = c * CELL, by = r * CELL;
          var isBorder = (c === 0 || c === cols - 1 || r === 0 || r === rows - 1);
          var isPerimeter = isBorder;
          if (!isBorder) {
            // Check cardinal neighbors for non-wall
            if (grid[r * cols + c - 1] !== 1 ||
                grid[r * cols + c + 1] !== 1 ||
                grid[(r - 1) * cols + c] !== 1 ||
                grid[(r + 1) * cols + c] !== 1) {
              isPerimeter = true;
            }
          }

          if (isPerimeter) {
            // ─ Solid block with 3D bevel (perimeter / active boundary) ─
            ctx.fillStyle = dim;
            ctx.fillRect(bx, by, CELL, CELL);
            // Top + left highlight
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            ctx.fillRect(bx, by, CELL, 1);
            ctx.fillRect(bx, by + 1, 1, CELL - 1);
            // Bottom + right shadow
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(bx, by + CELL - 1, CELL, 1);
            ctx.fillRect(bx + CELL - 1, by, 1, CELL - 1);
          } else {
            // ─ Hollowed interior (dead space) ─
            ctx.fillStyle = 'rgba(8,16,12,0.9)';
            ctx.fillRect(bx, by, CELL, CELL);
            // Subtle grid outline
            ctx.strokeStyle = 'rgba(' + phR + ',' + phG + ',' + phB + ',0.04)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(bx + 0.5, by + 0.5, CELL - 1, CELL - 1);
          }

        } else if (v >= 2) {
          // ─ Builder cells: two-color A/B rendering from spawn point ─
          var builderId = v - 2;
          var bld = _builderMap[builderId];
          var pair = sideColors[builderId % sideColors.length];
          var cellColor = pair[0];  // default to A-side color

          if (bld) {
            var isOrigin = (c === bld.originC && r === bld.originR);
            var isBSide = bld.dir === 'h' ? (c > bld.originC) : (r > bld.originR);
            if (isOrigin) {
              cellColor = '#ffffff';  // bright white spawn point
            } else if (isBSide) {
              cellColor = pair[1];    // B-side color
            }
          }

          var phaseOffset = builderId * 1.5;
          var pulse = 0.5 + 0.3 * Math.sin(Date.now() * 0.01 + phaseOffset);
          ctx.fillStyle = cellColor;
          ctx.globalAlpha = pulse;
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          ctx.globalAlpha = 1;
        }
      }
    }

    // ── Ball light emission (additive radial glow — Gone Rogue style) ──
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var li = 0; li < balls.length; li++) {
      var lb = balls[li];
      var glowR = CELL * 6;   // 6-cell glow radius
      var grad = ctx.createRadialGradient(lb.x, lb.y, lb.r * 0.5, lb.x, lb.y, glowR);
      grad.addColorStop(0,   'rgba(' + phR + ',' + phG + ',' + phB + ',0.22)');
      grad.addColorStop(0.2, 'rgba(' + phR + ',' + phG + ',' + phB + ',0.12)');
      grad.addColorStop(0.5, 'rgba(' + phR + ',' + phG + ',' + phB + ',0.04)');
      grad.addColorStop(1,   'rgba(' + phR + ',' + phG + ',' + phB + ',0)');
      ctx.fillStyle = grad;
      ctx.fillRect(lb.x - glowR, lb.y - glowR, glowR * 2, glowR * 2);
    }
    ctx.restore();

    // ── Balls (core) ──
    for (var i = 0; i < balls.length; i++) {
      var ball = balls[i];
      ctx.save();
      ctx.shadowColor = ph;
      ctx.shadowBlur = 8;
      ctx.fillStyle = ph;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      // Inner bright core
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(ball.x - 1, ball.y - 1, ball.r * 0.35, 0, Math.PI * 2);
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
    var livesStr = '';
    for (var li = 0; li < lives; li++) livesStr += '♥';
    ctx.fillText('LVL:' + level + '  FILLED:' + pct + '%  ' + livesStr + '  SCR:' + score, 8, 14);

    // Active builders count
    if (builders.length > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff9b1c';
      ctx.fillText('BUILDING: ' + builders.length + '/' + MAX_BUILDERS, W / 2, H - 6);
    }

    // Direction badge (top-right)
    ctx.textAlign = 'right';
    ctx.fillStyle = direction === 'h' ? ph : '#ff9b1c';
    ctx.fillText('[' + (direction === 'h' ? '━ HORIZ' : '┃ VERT') + ']', W - 8, 14);

    // Level transition overlay
    if (levelTransition) {
      var tPct = 1 - (levelTransition.timer / 1500);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.4 * tPct) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = ph;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LEVEL ' + level + ' CLEAR!', W / 2, H / 2 - 10);
      ctx.font = '11px monospace';
      ctx.fillText(pct + '% CONTAINED — +1000 PTS', W / 2, H / 2 + 10);
      ctx.fillText('LEVEL ' + (level + 1) + ' INCOMING...', W / 2, H / 2 + 28);
    }

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
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height)
    };
  }

  function onPointerDown(e) {
    e.preventDefault();
    if (lost) { reset(); return; }
    if (levelTransition) return;  // ignore during transition
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
      if (Math.abs(dx) >= Math.abs(dy)) {
        direction = 'h';
      } else {
        direction = 'v';
      }
      orientDecided = true;
      dirIndicator = { x: pointerStartX, y: pointerStartY, dir: direction, timer: 600 };
      startBuild(pointerStartX, pointerStartY);
      pointerDown = false;
    }
  }

  function onPointerUp(e) {
    if (!pointerDown) return;
    e.preventDefault();
    pointerDown = false;

    if (!orientDecided) {
      var pos;
      if (e.changedTouches && e.changedTouches.length > 0) {
        pos = getCanvasXY(e);
      } else if (e.clientX != null) {
        pos = getCanvasXY(e);
      } else {
        pos = { x: pointerStartX, y: pointerStartY };
      }
      dirIndicator = { x: pos.x, y: pos.y, dir: direction, timer: 400 };
      startBuild(pos.x, pos.y);
    }
  }

  function onKeyDown(e) {
    if (e.key === ' ') {
      e.preventDefault();
      if (lost) { reset(); return; }
      direction = direction === 'h' ? 'v' : 'h';
      dirIndicator = { x: W / 2, y: H / 2, dir: direction, timer: 500 };
    }
  }

  function onContextMenu(e) { e.preventDefault(); }

  return {
    start: function (canvas) {
      ctx = canvas.getContext('2d');
      W = canvas.width;
      H = canvas.height;
      if (typeof AudioSystem !== 'undefined' && AudioSystem.init) {
        try { AudioSystem.init(); } catch (_) {}
      }
      reset();
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
