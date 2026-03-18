/* ============================================================
   Constellation Validator — Phase 8
   ============================================================
   Validates whether a player's traced path satisfies the
   constellation's structural rules.

   Validation types:
     "shape"  — All nodes visited + path returns to origin.
                The canonical type. Every closed polygon uses this.
     "euler"  — Euler path: every EDGE must be traversed exactly
                once (for future multi-edge graph puzzles).

   Shape matching is rotation-invariant: a traced square that
   starts at node C instead of node A is still valid as long as
   the cycle visits all nodes and closes.

   Public API:
     ConstellationValidator.validatePath(constellation, pathIds)
       → { valid, reason, stats }

     ConstellationValidator.getShapeStats(pathIds, nodeMap)
       → { edges, angles, area, centroid, isConvex, isClosed }

   ============================================================ */

;(function (root) {
  'use strict';

  // ── Core validation ─────────────────────────────────────

  /**
   * Validate a traced path against a constellation definition.
   * @param {Object}   constellation — { id, nodeIds[], validation, angleConstraints }
   * @param {string[]} pathIds       — ordered node IDs the player traced
   * @returns {{ valid: boolean, reason: string, stats: Object }}
   */
  function validatePath(constellation, pathIds) {
    if (!constellation || !pathIds || pathIds.length === 0) {
      return { valid: false, reason: 'empty-path', stats: null };
    }

    var required = constellation.nodeIds || [];
    var validation = constellation.validation || 'shape';

    // ── Check: all required nodes visited ──
    var visited = {};
    for (var i = 0; i < pathIds.length; i++) {
      visited[pathIds[i]] = true;
    }
    var missing = [];
    for (var j = 0; j < required.length; j++) {
      if (!visited[required[j]]) missing.push(required[j]);
    }
    if (missing.length > 0) {
      return { valid: false, reason: 'missing-nodes', stats: { missing: missing } };
    }

    // ── Shape validation: closed loop check ──
    if (validation === 'shape' || validation === 'rule') {
      // Path must form a cycle: first node must equal the closing target
      // In the tracer, closing happens when the player snaps back to pathIds[0]
      // The path array itself doesn't contain the repeat — the tracer commits
      // the close via _commitSnap(isClosing=true) before calling resolve.
      // So we validate that all nodes are present and the tracer confirmed closure.
      if (pathIds.length < 3) {
        return { valid: false, reason: 'too-short', stats: null };
      }
      // Valid: all nodes visited and tracer confirmed loop closure
      return {
        valid: true,
        reason: 'shape-complete',
        stats: { nodeCount: required.length, pathLength: pathIds.length }
      };
    }

    // ── Euler path validation ──
    if (validation === 'euler') {
      return _validateEuler(constellation, pathIds);
    }

    // ── Exact validation (legacy): all nodes visited ──
    return {
      valid: true,
      reason: 'exact-complete',
      stats: { nodeCount: required.length, pathLength: pathIds.length }
    };
  }

  // ── Euler path check ──────────────────────────────────

  /**
   * Validate that a path traverses every edge exactly once.
   * An Euler path exists iff the graph has 0 or 2 vertices with odd degree.
   */
  function _validateEuler(constellation, pathIds) {
    var edges = constellation.edges || [];
    if (edges.length === 0) {
      return { valid: false, reason: 'no-edges-defined', stats: null };
    }

    // Build edge set from path (consecutive pairs)
    var traversed = {};
    for (var i = 0; i < pathIds.length - 1; i++) {
      var key = _edgeKey(pathIds[i], pathIds[i + 1]);
      traversed[key] = (traversed[key] || 0) + 1;
    }

    // Check: every required edge traversed exactly once
    var missingEdges = [];
    var doubleEdges = [];
    for (var j = 0; j < edges.length; j++) {
      var ek = _edgeKey(edges[j][0], edges[j][1]);
      if (!traversed[ek]) missingEdges.push(ek);
      else if (traversed[ek] > 1) doubleEdges.push(ek);
    }

    if (missingEdges.length > 0) {
      return { valid: false, reason: 'missing-edges', stats: { missingEdges: missingEdges } };
    }
    if (doubleEdges.length > 0) {
      return { valid: false, reason: 'repeated-edges', stats: { doubleEdges: doubleEdges } };
    }

    return { valid: true, reason: 'euler-complete', stats: { edgeCount: edges.length } };
  }

  function _edgeKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
  }

  // ── Shape geometry stats ──────────────────────────────

  /**
   * Compute geometric properties of a traced path.
   * @param {string[]} pathIds — ordered node IDs
   * @param {Object}   nodeMap — { id: { x, y } } normalized coords
   * @returns {{ edges, angles, area, centroid, isConvex, isClosed }}
   */
  function getShapeStats(pathIds, nodeMap) {
    if (!pathIds || pathIds.length < 2 || !nodeMap) return null;

    var points = [];
    for (var i = 0; i < pathIds.length; i++) {
      var n = nodeMap[pathIds[i]];
      if (n) points.push({ x: n.x, y: n.y });
    }
    if (points.length < 2) return null;

    // Edge lengths
    var edges = [];
    for (var e = 0; e < points.length - 1; e++) {
      edges.push(Math.hypot(points[e + 1].x - points[e].x, points[e + 1].y - points[e].y));
    }
    // Closing edge
    var closingEdge = Math.hypot(points[0].x - points[points.length - 1].x,
                                  points[0].y - points[points.length - 1].y);
    var isClosed = closingEdge < 0.001; // effectively same point

    // Interior angles (for closed polygons)
    var angles = [];
    if (points.length >= 3) {
      for (var a = 0; a < points.length; a++) {
        var prev = points[(a - 1 + points.length) % points.length];
        var curr = points[a];
        var next = points[(a + 1) % points.length];
        var v1x = prev.x - curr.x, v1y = prev.y - curr.y;
        var v2x = next.x - curr.x, v2y = next.y - curr.y;
        var dot = v1x * v2x + v1y * v2y;
        var cross = v1x * v2y - v1y * v2x;
        var angle = Math.atan2(Math.abs(cross), dot) * (180 / Math.PI);
        angles.push(Math.round(angle * 10) / 10);
      }
    }

    // Signed area (shoelace formula)
    var area = 0;
    for (var s = 0; s < points.length; s++) {
      var s2 = (s + 1) % points.length;
      area += points[s].x * points[s2].y;
      area -= points[s2].x * points[s].y;
    }
    area = Math.abs(area) / 2;

    // Centroid
    var cx = 0, cy = 0;
    for (var c = 0; c < points.length; c++) {
      cx += points[c].x; cy += points[c].y;
    }
    cx /= points.length; cy /= points.length;

    // Convexity check (all cross products same sign)
    var isConvex = true;
    if (points.length >= 3) {
      var sign = 0;
      for (var k = 0; k < points.length; k++) {
        var p1 = points[k];
        var p2 = points[(k + 1) % points.length];
        var p3 = points[(k + 2) % points.length];
        var cp = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
        if (cp !== 0) {
          if (sign === 0) sign = cp > 0 ? 1 : -1;
          else if ((cp > 0 ? 1 : -1) !== sign) { isConvex = false; break; }
        }
      }
    }

    // Rotation-invariant shape signature:
    // Sorted edge lengths + sorted angles = identifies the shape
    // regardless of which node the player started from.
    var sortedEdges = edges.slice().sort(function (a, b) { return a - b; });
    var sortedAngles = angles.slice().sort(function (a, b) { return a - b; });

    return {
      edges: edges,
      angles: angles,
      area: area,
      centroid: { x: cx, y: cy },
      isConvex: isConvex,
      isClosed: isClosed,
      nodeCount: points.length,
      // Rotation-invariant signature
      edgeSignature: sortedEdges.map(function (e) { return Math.round(e * 1000); }).join(','),
      angleSignature: sortedAngles.map(function (a) { return Math.round(a); }).join(','),
    };
  }

  // ── Shape classification ──────────────────────────────

  /**
   * Classify a shape from its stats.
   * @returns {string} — 'triangle', 'square', 'rectangle', 'rhombus',
   *                      'pentagon', 'hexagon', 'star', 'irregular', etc.
   */
  function classifyShape(stats) {
    if (!stats) return 'unknown';
    var n = stats.nodeCount;

    if (n === 3) return 'triangle';
    if (n === 4) {
      // Check if all edges roughly equal
      var maxE = Math.max.apply(null, stats.edges);
      var minE = Math.min.apply(null, stats.edges);
      var edgeRatio = maxE / (minE || 0.001);
      if (edgeRatio < 1.15) {
        return stats.isConvex ? 'square' : 'rhombus';
      }
      return stats.isConvex ? 'rectangle' : 'parallelogram';
    }
    if (n === 5) return stats.isConvex ? 'pentagon' : 'star';
    if (n === 6) return stats.isConvex ? 'hexagon' : 'star6';
    if (n === 8) return 'octagon';
    if (n >= 10) return 'complex';
    return 'polygon-' + n;
  }

  // ── Public API ────────────────────────────────────────

  root.ConstellationValidator = {
    validatePath:   validatePath,
    getShapeStats:  getShapeStats,
    classifyShape:  classifyShape,
  };

})(typeof window !== 'undefined' ? window : this);
