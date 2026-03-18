/* ============================================================
   Constellation Proc-Gen — Phase 8
   ============================================================
   Generates random closed-shape constellations for endless play
   after the designer-authored templates are exhausted.

   Uses a seeded RNG so shapes are reproducible per session.
   Shapes are generated within the safe viewport zone (0.18–0.82)
   and always produce closed loops (validation: "shape").

   Techniques:
     - Regular polygon generation (3–8 sides)
     - Jittered polygon (regular + random vertex displacement)
     - Convex hull random (scatter points, take convex hull)

   Difficulty scaling:
     - More nodes as levels increase
     - Larger jitter / more irregular shapes
     - Eventually enables angleConstraints

   Usage:
     ConstellationProcGen.generate(levelIndex, seed)
       → constellation definition object

   ============================================================ */

;(function (root) {
  'use strict';

  // ── Seeded PRNG (mulberry32) ──────────────────────────

  function _mulberry32(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Safe viewport zone ─────────────────────────────────

  var SAFE_MIN = 0.18;
  var SAFE_MAX = 0.82;
  var SAFE_RANGE = SAFE_MAX - SAFE_MIN;

  // Center of the safe zone
  var CX = (SAFE_MIN + SAFE_MAX) / 2;
  var CY = (SAFE_MIN + SAFE_MAX) / 2;

  // ── Shape generators ───────────────────────────────────

  /**
   * Generate a regular polygon with optional jitter.
   * @param {number} sides — 3–12
   * @param {Function} rand — seeded PRNG
   * @param {number} jitter — max displacement fraction (0 = perfect, 0.15 = moderate)
   * @returns {Array<{x, y}>} normalized coordinates
   */
  function _regularPolygon(sides, rand, jitter) {
    var radius = SAFE_RANGE * 0.35; // fits within safe zone
    var angleOffset = -Math.PI / 2 + rand() * Math.PI * 2; // random rotation
    var points = [];

    for (var i = 0; i < sides; i++) {
      var angle = angleOffset + (i / sides) * Math.PI * 2;
      var r = radius * (1 + (rand() - 0.5) * 2 * jitter);
      var x = CX + Math.cos(angle) * r;
      var y = CY + Math.sin(angle) * r;
      // Clamp to safe zone
      x = Math.max(SAFE_MIN, Math.min(SAFE_MAX, x));
      y = Math.max(SAFE_MIN, Math.min(SAFE_MAX, y));
      points.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }

    return points;
  }

  /**
   * Generate a star shape (alternating inner/outer radii).
   * @param {number} points — number of star tips (5 = pentagram)
   * @param {Function} rand
   * @returns {Array<{x, y}>}
   */
  function _starShape(tips, rand) {
    var outerR = SAFE_RANGE * 0.35;
    var innerR = outerR * (0.35 + rand() * 0.15);
    var angleOffset = -Math.PI / 2 + rand() * Math.PI * 2;
    var pts = [];
    var total = tips * 2;

    for (var i = 0; i < total; i++) {
      var angle = angleOffset + (i / total) * Math.PI * 2;
      var r = (i % 2 === 0) ? outerR : innerR;
      var x = CX + Math.cos(angle) * r;
      var y = CY + Math.sin(angle) * r;
      x = Math.max(SAFE_MIN, Math.min(SAFE_MAX, x));
      y = Math.max(SAFE_MIN, Math.min(SAFE_MAX, y));
      pts.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }

    return pts;
  }

  /**
   * Generate random convex shape by scattering points and taking hull.
   */
  function _randomConvex(nodeCount, rand) {
    // Scatter random points in safe zone
    var raw = [];
    for (var i = 0; i < nodeCount + 4; i++) {
      raw.push({
        x: SAFE_MIN + rand() * SAFE_RANGE,
        y: SAFE_MIN + rand() * SAFE_RANGE,
      });
    }

    // Convex hull (Graham scan)
    var hull = _convexHull(raw);

    // Trim or pad to desired count
    while (hull.length > nodeCount) hull.pop();
    while (hull.length < nodeCount) {
      // Add midpoints
      var idx = Math.floor(rand() * (hull.length - 1));
      var mid = {
        x: (hull[idx].x + hull[idx + 1].x) / 2 + (rand() - 0.5) * 0.04,
        y: (hull[idx].y + hull[idx + 1].y) / 2 + (rand() - 0.5) * 0.04,
      };
      mid.x = Math.max(SAFE_MIN, Math.min(SAFE_MAX, mid.x));
      mid.y = Math.max(SAFE_MIN, Math.min(SAFE_MAX, mid.y));
      hull.splice(idx + 1, 0, mid);
    }

    return hull.map(function (p) {
      return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
    });
  }

  function _convexHull(points) {
    points = points.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    if (points.length <= 2) return points;

    function cross(O, A, B) {
      return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
    }

    var lower = [];
    for (var i = 0; i < points.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) lower.pop();
      lower.push(points[i]);
    }
    var upper = [];
    for (var j = points.length - 1; j >= 0; j--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[j]) <= 0) upper.pop();
      upper.push(points[j]);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  // ── Shape name pool ──────────────────────────────────

  var _NAMES = [
    'The Phantom', 'The Whisper', 'The Ghost Protocol', 'The Shadow',
    'The Cipher', 'The Enigma', 'The Raven', 'The Falcon',
    'The Interceptor', 'The Relay', 'The Waypoint', 'The Nexus',
    'The Anomaly', 'The Fragment', 'The Vector', 'The Trace',
    'The Override', 'The Frequency', 'The Lattice', 'The Conduit',
    'The Prism', 'The Keystone', 'The Circuit', 'The Beacon',
    'The Vanguard', 'The Eclipse', 'The Apex', 'The Crucible',
    'The Archive', 'The Manifest', 'The Axiom', 'The Zenith',
  ];

  // ── Generator ─────────────────────────────────────────

  /**
   * Generate a procedural constellation.
   * @param {number} levelIndex — 0-based index (higher = harder)
   * @param {number} [seed]     — optional seed (defaults to levelIndex * 7919)
   * @returns {Object} constellation definition
   */
  function generate(levelIndex, seed) {
    var s = seed || ((levelIndex + 1) * 7919);
    var rand = _mulberry32(s);

    // Scale difficulty with level index
    var nodeCount, jitter, technique, angleConstraints;

    if (levelIndex < 6) {
      // Early proc-gen: simple regular polygons
      nodeCount = 3 + Math.floor(rand() * 3); // 3–5 nodes
      jitter = 0.05 + rand() * 0.08;
      technique = 'polygon';
      angleConstraints = false;
    } else if (levelIndex < 15) {
      // Mid proc-gen: jittered polygons + occasional stars
      nodeCount = 4 + Math.floor(rand() * 4); // 4–7 nodes
      jitter = 0.08 + rand() * 0.12;
      technique = rand() < 0.3 ? 'star' : 'polygon';
      angleConstraints = false;
    } else {
      // Late proc-gen: complex convex shapes, angle constraints possible
      nodeCount = 5 + Math.floor(rand() * 5); // 5–9 nodes
      jitter = 0.10 + rand() * 0.15;
      technique = rand() < 0.25 ? 'star' : (rand() < 0.5 ? 'convex' : 'polygon');
      angleConstraints = rand() < 0.3;
    }

    // Generate points
    var points;
    if (technique === 'star') {
      var tips = 4 + Math.floor(rand() * 3); // 4–6 tips
      points = _starShape(tips, rand);
      nodeCount = points.length;
    } else if (technique === 'convex') {
      points = _randomConvex(nodeCount, rand);
      nodeCount = points.length;
    } else {
      points = _regularPolygon(nodeCount, rand, jitter);
    }

    // Build node array
    var id = 'pg-' + String(levelIndex).padStart(3, '0');
    var nodes = points.map(function (p, i) {
      return {
        id: id + '-' + String.fromCharCode(97 + i), // pg-000-a, pg-000-b, ...
        x: p.x,
        y: p.y,
        suit: 'club',
      };
    });

    var name = _NAMES[levelIndex % _NAMES.length];

    return {
      id: id,
      name: name,
      difficulty: angleConstraints ? 'intermediate' : 'beginner',
      tier: 1,
      validation: 'shape',
      angleConstraints: angleConstraints,
      procGen: true,
      seed: s,
      nodes: nodes,
    };
  }

  // ── Public API ────────────────────────────────────────

  root.ConstellationProcGen = {
    generate: generate,
  };

})(typeof window !== 'undefined' ? window : this);
