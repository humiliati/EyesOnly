/* ============================================================
   Constellation Generator — Phase 10 (Advanced Procgen)
   ============================================================
   Generates valid constellation puzzles from a proximity graph
   with angular constraint filtering and DFS path search.

   Algorithm:
     1. SEED — Scatter N candidate nodes in safe viewport zone
     2. PROXIMITY GRAPH — Connect pairs within distance threshold
     3. ANGLE FILTER — Keep only edges on allowed angular axes
     4. DFS PATH SEARCH — Find closed loops of 4–9 nodes
     5. SHAPE FILTER — Reject too-linear or too-compact shapes
     6. SUIT MIX — Assign non-club suits by difficulty tier
     7. OUTPUT — Constellation definition ready for registration

   This is the "smart" generator that produces shapes aligned
   to the angular constraint system, unlike the basic procgen
   (constellation-procgen.js) which generates regular polygons.

   Usage:
     ConstellationGenerator.generate(difficulty, seed)
       → constellation definition or null (if no valid shape found)

   ============================================================ */

;(function (root) {
  'use strict';

  // ── Config ──────────────────────────────────────────────

  var SAFE_MIN = 0.18;
  var SAFE_MAX = 0.82;
  var SAFE_RANGE = SAFE_MAX - SAFE_MIN;

  var ALLOWED_ANGLES = [12, 90, 168, 192, 270, 348];
  var ANGLE_TOLERANCE = 8;  // slightly more forgiving for generation
  var PROXIMITY_THRESHOLD = 0.22; // max normalized distance for edge
  var MIN_EDGE_LENGTH = 0.08; // min normalized distance (too close = ugly)

  var MIN_NODES = 4;
  var MAX_NODES = 9;
  var CANDIDATE_COUNT = 18; // scatter this many candidates, find paths among them
  var MAX_ATTEMPTS = 50;    // DFS search budget per generation call

  // ── Seeded PRNG ──────────────────────────────────────

  function _mulberry32(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Name pool ──────────────────────────────────────────

  var _NAMES = [
    'The Fracture', 'The Lattice', 'The Meridian', 'The Catalyst',
    'The Threshold', 'The Conduit', 'The Terminus', 'The Vertex',
    'The Filament', 'The Nexus', 'The Oscillation', 'The Parallax',
    'The Resonance', 'The Schematic', 'The Tangent', 'The Algorithm',
  ];

  // ── Step 1: Scatter candidate nodes ────────────────────

  function _scatterCandidates(count, rand) {
    var pts = [];
    for (var i = 0; i < count; i++) {
      pts.push({
        id: i,
        x: SAFE_MIN + rand() * SAFE_RANGE,
        y: SAFE_MIN + rand() * SAFE_RANGE,
      });
    }
    return pts;
  }

  // ── Step 2 + 3: Proximity graph with angle filtering ───

  function _buildGraph(candidates, rand) {
    var adj = {}; // id → [id, ...]
    for (var i = 0; i < candidates.length; i++) {
      adj[i] = [];
    }

    for (var a = 0; a < candidates.length; a++) {
      for (var b = a + 1; b < candidates.length; b++) {
        var dx = candidates[b].x - candidates[a].x;
        var dy = candidates[b].y - candidates[a].y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MIN_EDGE_LENGTH || dist > PROXIMITY_THRESHOLD) continue;

        // Check angle
        var angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angleDeg < 0) angleDeg += 360;

        if (_isAngleAllowed(angleDeg)) {
          adj[a].push(b);
          adj[b].push(a);
        }
      }
    }

    return adj;
  }

  function _isAngleAllowed(angleDeg) {
    for (var i = 0; i < ALLOWED_ANGLES.length; i++) {
      var diff = Math.abs(angleDeg - ALLOWED_ANGLES[i]);
      if (diff > 180) diff = 360 - diff;
      if (diff <= ANGLE_TOLERANCE) return true;
    }
    return false;
  }

  // ── Step 4: DFS for closed loops ───────────────────────

  function _findClosedLoop(adj, candidates, targetSize, rand) {
    var bestPath = null;
    var attempts = 0;

    // Try random starting nodes
    var starts = [];
    for (var k in adj) {
      if (adj[k].length >= 2) starts.push(parseInt(k));
    }
    // Shuffle starts
    for (var si = starts.length - 1; si > 0; si--) {
      var sj = Math.floor(rand() * (si + 1));
      var tmp = starts[si]; starts[si] = starts[sj]; starts[sj] = tmp;
    }

    for (var s = 0; s < starts.length && attempts < MAX_ATTEMPTS; s++) {
      var startNode = starts[s];
      var visited = {};
      visited[startNode] = true;
      var path = [startNode];

      var found = _dfs(adj, startNode, startNode, path, visited, targetSize, attempts);
      attempts += found.attempts;

      if (found.path) {
        bestPath = found.path;
        break;
      }
    }

    return bestPath;
  }

  function _dfs(adj, startNode, current, path, visited, targetSize, attemptsSoFar) {
    var localAttempts = 0;

    if (path.length >= targetSize) {
      // Check if we can close the loop back to start
      var neighbors = adj[current];
      for (var n = 0; n < neighbors.length; n++) {
        if (neighbors[n] === startNode) {
          return { path: path.slice(), attempts: localAttempts };
        }
      }
      return { path: null, attempts: localAttempts + 1 };
    }

    var neighbors2 = adj[current];
    for (var i = 0; i < neighbors2.length; i++) {
      var next = neighbors2[i];
      if (visited[next]) continue;
      if (attemptsSoFar + localAttempts >= MAX_ATTEMPTS) break;

      visited[next] = true;
      path.push(next);

      var result = _dfs(adj, startNode, next, path, visited, targetSize, attemptsSoFar + localAttempts);
      localAttempts += result.attempts;

      if (result.path) return { path: result.path, attempts: localAttempts };

      path.pop();
      delete visited[next];
    }

    return { path: null, attempts: localAttempts + 1 };
  }

  // ── Step 5: Shape filter ───────────────────────────────

  function _isShapeValid(path, candidates) {
    var xs = [], ys = [];
    for (var i = 0; i < path.length; i++) {
      xs.push(candidates[path[i]].x);
      ys.push(candidates[path[i]].y);
    }

    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var w = maxX - minX;
    var h = maxY - minY;

    // Too compact
    if (w < 0.10 || h < 0.10) return false;

    // Too linear (aspect ratio > 3.5:1)
    var ratio = Math.max(w, h) / (Math.min(w, h) || 0.01);
    if (ratio > 3.5) return false;

    return true;
  }

  // ── Step 6: Suit mix ───────────────────────────────────

  function _assignSuits(nodeCount, difficulty, rand) {
    var suits = [];
    for (var i = 0; i < nodeCount; i++) suits.push('club');

    if (difficulty === 'intermediate') {
      // 1-2 non-club
      var nonClub = 1 + Math.floor(rand() * 2);
      var suitPool = ['diamond', 'spade'];
      for (var j = 0; j < nonClub && j < nodeCount - 2; j++) {
        var idx = 1 + Math.floor(rand() * (nodeCount - 2)); // don't replace first/last
        suits[idx] = suitPool[Math.floor(rand() * suitPool.length)];
      }
    } else if (difficulty === 'advanced') {
      // 2-3 non-club, all suit types
      var nonClub2 = 2 + Math.floor(rand() * 2);
      var allSuits = ['diamond', 'spade', 'heart'];
      for (var k = 0; k < nonClub2 && k < nodeCount - 2; k++) {
        var idx2 = 1 + Math.floor(rand() * (nodeCount - 2));
        suits[idx2] = allSuits[Math.floor(rand() * allSuits.length)];
      }
    }

    return suits;
  }

  // ── Main generator ─────────────────────────────────────

  /**
   * Generate a constellation using proximity graph + angular constraints.
   * @param {string} difficulty — 'beginner' | 'intermediate' | 'advanced'
   * @param {number} [seed] — optional PRNG seed
   * @returns {Object|null} constellation definition, or null if generation fails
   */
  function generate(difficulty, seed) {
    difficulty = difficulty || 'beginner';
    var s = seed || (Date.now() ^ (Math.random() * 0xFFFFFF));
    var rand = _mulberry32(s);

    var targetNodes = MIN_NODES + Math.floor(rand() * (MAX_NODES - MIN_NODES + 1));
    if (difficulty === 'beginner') targetNodes = Math.min(targetNodes, 6);

    // Scatter candidates
    var candidates = _scatterCandidates(CANDIDATE_COUNT, rand);

    // Build proximity graph with angle filtering
    var adj = _buildGraph(candidates, rand);

    // DFS: find a closed loop of target size
    var path = _findClosedLoop(adj, candidates, targetNodes, rand);

    // Fallback: try smaller sizes
    if (!path && targetNodes > MIN_NODES) {
      for (var fallback = targetNodes - 1; fallback >= MIN_NODES; fallback--) {
        path = _findClosedLoop(adj, candidates, fallback, rand);
        if (path) break;
      }
    }

    if (!path) return null; // generation failed

    // Shape filter
    if (!_isShapeValid(path, candidates)) return null;

    // Assign suits
    var suits = _assignSuits(path.length, difficulty, rand);

    // Build constellation def
    var id = 'gen-' + s.toString(16).slice(0, 8);
    var nodes = path.map(function (ci, i) {
      return {
        id: id + '-' + String.fromCharCode(97 + i),
        x: Math.round(candidates[ci].x * 100) / 100,
        y: Math.round(candidates[ci].y * 100) / 100,
        suit: suits[i],
      };
    });

    var allClub = suits.every(function (s2) { return s2 === 'club'; });

    return {
      id: id,
      name: _NAMES[Math.floor(rand() * _NAMES.length)],
      difficulty: difficulty,
      tier: allClub ? 1 : 2,
      validation: 'shape',
      angleConstraints: difficulty !== 'beginner',
      procGen: true,
      advanced: true,
      seed: s,
      nodes: nodes,
    };
  }

  // ── Public API ────────────────────────────────────────

  root.ConstellationGenerator = {
    generate: generate,
  };

})(typeof window !== 'undefined' ? window : this);
