/* ============================================================
   Constellation Tracer — Phase 8
   ============================================================
   State-machine that lets a dragging card (gold lens / ♣ suit)
   trace constellations by connecting suit-symbol nodes in the
   starfield.

   The tracer hooks into the starfield post-render pipeline and
   responds to porthole position updates from NchOverlay's card-
   drag system.

   State Machine:
     idle  →  hasNode  →  tethered  →  resolve
       ↑         |            |
       └─────────┴────────────┘  (cancel / invalid)

   • idle:     No drag active, tracer dormant.
   • hasNode:  Drag started, porthole overlaps a ♣ node. First
               node "picked up" — golden tether extends from it
               toward cursor.
   • tethered: One or more nodes connected. Live line follows
               cursor; snaps when cursor approaches a valid node
               at an allowed angle.
   • resolve:  Path completes (returns to first node or meets
               constellation rule). Triggers validation + reward.

   Angular constraints (from design doc):
     Allowed angles: 12°, 90°, 168° and their 180° mirrors
     (192°, 270°, 348°). ±5° tolerance window. These angles
     produce the distinctive glyph shapes when connecting nodes.
   ============================================================ */

;(function (root) {
  'use strict';

  // ── Constants ────────────────────────────────────────────
  var ALLOWED_ANGLES = [12, 90, 168, 192, 270, 348]; // degrees
  var ANGLE_TOLERANCE = 5; // ±degrees
  var SNAP_RADIUS = 32;    // px — how close porthole center must be to snap
  var HIT_RADIUS  = 40;    // px — hit-test radius for node detection
  var TETHER_COLOR = 'rgba(212, 168, 67, 0.85)';
  var TETHER_GLOW  = 'rgba(212, 168, 67, 0.25)';
  var SNAP_COLOR   = 'rgba(255, 220, 100, 1.0)';
  var INVALID_COLOR = 'rgba(255, 80, 60, 0.5)';

  // ── State ────────────────────────────────────────────────
  var _state = 'idle';        // idle | hasNode | tethered | resolve
  var _path = [];             // Array of node IDs in visit order
  var _activeConstellationId = null;
  var _cursorScreen = null;   // { x, y } — current porthole center in screen px
  var _snapCandidate = null;  // node we're hovering near (valid angle)
  var _unhookFn = null;       // starfield render hook unregister
  var _enabled = false;       // becomes true when gold lens card is being dragged
  var _animTime = 0;          // local animation counter

  // Elastic overshoot animation state
  var _snapAnim = null;       // { nodeId, startTime, fromX, fromY, toX, toY }

  // ── Angular Constraint Validation ────────────────────────

  /**
   * Calculate angle in degrees from node A → node B (screen coords).
   * Returns 0–360 range, 0 = right, 90 = down.
   */
  function _angleBetween(ax, ay, bx, by) {
    var rad = Math.atan2(by - ay, bx - ax);
    var deg = rad * (180 / Math.PI);
    if (deg < 0) deg += 360;
    return deg;
  }

  /**
   * Check if an angle (degrees) is within tolerance of any allowed angle.
   */
  function _isAngleAllowed(angleDeg) {
    for (var i = 0; i < ALLOWED_ANGLES.length; i++) {
      var diff = Math.abs(angleDeg - ALLOWED_ANGLES[i]);
      if (diff > 180) diff = 360 - diff;
      if (diff <= ANGLE_TOLERANCE) return true;
    }
    return false;
  }

  /**
   * Find the closest allowed angle to a given angle. Returns null if none
   * within a generous search window (3× tolerance).
   */
  function _closestAllowedAngle(angleDeg) {
    var best = null;
    var bestDiff = ANGLE_TOLERANCE * 3;
    for (var i = 0; i < ALLOWED_ANGLES.length; i++) {
      var diff = Math.abs(angleDeg - ALLOWED_ANGLES[i]);
      if (diff > 180) diff = 360 - diff;
      if (diff < bestDiff) {
        bestDiff = diff;
        best = ALLOWED_ANGLES[i];
      }
    }
    return best;
  }

  // ── Path Helpers ─────────────────────────────────────────

  function _lastNodeId() {
    return _path.length > 0 ? _path[_path.length - 1] : null;
  }

  function _isNodeInPath(nodeId) {
    for (var i = 0; i < _path.length; i++) {
      if (_path[i] === nodeId) return true;
    }
    return false;
  }

  function _getNodeScreenPos(node) {
    return {
      x: node.x * window.innerWidth,
      y: node.y * window.innerHeight,
    };
  }

  // ── State Machine Transitions ────────────────────────────

  /**
   * Begin a constellation trace session.
   * Called when gold lens card drag starts.
   */
  function beginSession() {
    _state = 'idle';
    _path = [];
    _activeConstellationId = null;
    _cursorScreen = null;
    _snapCandidate = null;
    _snapAnim = null;
    _enabled = true;
    _animTime = 0;
    console.log('[ConstellationTracer] Session started');
  }

  /**
   * End the current session (card dropped, cancelled, etc.).
   */
  function endSession() {
    // Reset any visited nodes
    if (_path.length > 0 && typeof SuitNodeRenderer !== 'undefined') {
      var cid = _activeConstellationId;
      if (cid) {
        SuitNodeRenderer.resetConstellation(cid);
      } else {
        _path.forEach(function (id) { SuitNodeRenderer.resetNode(id); });
      }
    }
    _state = 'idle';
    _path = [];
    _activeConstellationId = null;
    _cursorScreen = null;
    _snapCandidate = null;
    _snapAnim = null;
    _enabled = false;
    console.log('[ConstellationTracer] Session ended');
  }

  /**
   * Update the cursor (porthole center) position each frame.
   * This drives the tethering and snap detection.
   * @param {number} screenX  Porthole center X in screen pixels
   * @param {number} screenY  Porthole center Y in screen pixels
   */
  function updateCursor(screenX, screenY) {
    if (!_enabled) return;
    _cursorScreen = { x: screenX, y: screenY };

    if (typeof SuitNodeRenderer === 'undefined') return;

    // ── Idle: detect if cursor is near a ♣ node to pick it up ──
    if (_state === 'idle') {
      var hit = SuitNodeRenderer.hitTest(screenX, screenY, HIT_RADIUS, 'club');
      if (hit) {
        _pickUpNode(hit);
      }
      return;
    }

    // ── hasNode / tethered: check for snap to next valid node ──
    if (_state === 'hasNode' || _state === 'tethered') {
      _evaluateSnap(screenX, screenY);
    }
  }

  /**
   * Pick up the first node (idle → hasNode).
   */
  function _pickUpNode(node) {
    _state = 'hasNode';
    _path = [node.id];
    _activeConstellationId = node.constellation;
    SuitNodeRenderer.visitNode(node.id);
    console.log('[ConstellationTracer] Picked up node:', node.id,
                'constellation:', node.constellation);
  }

  /**
   * Evaluate snap: is cursor near a valid ♣ node at an allowed angle
   * from the last visited node?
   */
  function _evaluateSnap(screenX, screenY) {
    var lastId = _lastNodeId();
    if (!lastId) return;

    var lastNode = SuitNodeRenderer.getNodeById(lastId);
    if (!lastNode) return;

    var lastPos = _getNodeScreenPos(lastNode);

    // Find nearest connectable node within snap radius
    var candidate = SuitNodeRenderer.hitTest(screenX, screenY, SNAP_RADIUS, 'club');

    if (!candidate || candidate.id === lastId) {
      _snapCandidate = null;
      return;
    }

    // Don't revisit already-visited nodes (except closing the loop)
    var isClosing = (candidate.id === _path[0] && _path.length >= 3);
    if (_isNodeInPath(candidate.id) && !isClosing) {
      _snapCandidate = null;
      return;
    }

    // Must be in the same constellation
    if (candidate.constellation !== _activeConstellationId) {
      _snapCandidate = null;
      return;
    }

    // Angular constraint check
    var candidatePos = _getNodeScreenPos(candidate);
    var angle = _angleBetween(lastPos.x, lastPos.y, candidatePos.x, candidatePos.y);

    if (_isAngleAllowed(angle)) {
      // Valid snap!
      if (!_snapCandidate || _snapCandidate.id !== candidate.id) {
        _snapCandidate = candidate;
        SuitNodeRenderer.highlightNode(candidate.id);
      }

      // Auto-snap: if cursor is very close, commit the connection
      var dx = screenX - candidatePos.x;
      var dy = screenY - candidatePos.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SNAP_RADIUS * 0.6) {
        _commitSnap(candidate, isClosing);
      }
    } else {
      // Angle not allowed — clear candidate
      if (_snapCandidate && _snapCandidate.id === candidate.id) {
        SuitNodeRenderer.resetNode(candidate.id);
      }
      _snapCandidate = null;
    }
  }

  /**
   * Commit a snap connection to a node.
   */
  function _commitSnap(node, isClosing) {
    _snapCandidate = null;

    if (isClosing) {
      // Loop closed — resolve!
      _state = 'resolve';
      console.log('[ConstellationTracer] Loop closed! Path:', _path.join(' → '));
      _resolveConstellation();
      return;
    }

    // Add to path
    _path.push(node.id);
    SuitNodeRenderer.visitNode(node.id);
    _state = 'tethered';

    // Trigger snap animation
    var pos = _getNodeScreenPos(node);
    _snapAnim = {
      nodeId: node.id,
      startTime: _animTime,
      x: pos.x,
      y: pos.y,
    };

    console.log('[ConstellationTracer] Connected node:', node.id,
                'Path length:', _path.length);

    // Check if all nodes in constellation are visited (non-loop solve)
    _checkAllNodesVisited();
  }

  /**
   * Check if every node in the active constellation has been visited.
   * If so, resolve without needing to close the loop.
   */
  function _checkAllNodesVisited() {
    if (!_activeConstellationId || typeof SuitNodeRenderer === 'undefined') return;

    var constellations = SuitNodeRenderer.getConstellations();
    var constellation = null;
    for (var i = 0; i < constellations.length; i++) {
      if (constellations[i].id === _activeConstellationId) {
        constellation = constellations[i];
        break;
      }
    }
    if (!constellation) return;

    // Check if all constellation nodes are in path
    var allVisited = true;
    for (var j = 0; j < constellation.nodeIds.length; j++) {
      if (!_isNodeInPath(constellation.nodeIds[j])) {
        allVisited = false;
        break;
      }
    }

    if (allVisited) {
      _state = 'resolve';
      console.log('[ConstellationTracer] All nodes visited! Path:', _path.join(' → '));
      _resolveConstellation();
    }
  }

  // ── Resolve / Validation ─────────────────────────────────

  function _resolveConstellation() {
    if (!_activeConstellationId || typeof SuitNodeRenderer === 'undefined') return;

    var constellations = SuitNodeRenderer.getConstellations();
    var constellation = null;
    for (var i = 0; i < constellations.length; i++) {
      if (constellations[i].id === _activeConstellationId) {
        constellation = constellations[i];
        break;
      }
    }
    if (!constellation) { endSession(); return; }

    // Mark constellation solved
    SuitNodeRenderer.markConstellationSolved(_activeConstellationId);

    // Burn nodes into forever pixels
    SuitNodeRenderer.burnForever(constellation.nodeIds);

    // Reward: emit coins per node (if CurrencySpawning is available)
    var rewardPerNode = constellation.rewardPerNode || 10;
    if (typeof CurrencySpawning !== 'undefined' && CurrencySpawning.scatterPostCombatNodes) {
      // Staggered burst — 50ms per node for cascade effect
      constellation.nodeIds.forEach(function (id, idx) {
        var node = SuitNodeRenderer.getNodeById(id);
        if (!node) return;
        var pos = _getNodeScreenPos(node);
        setTimeout(function () {
          try {
            CurrencySpawning.scatterPostCombatNodes(
              pos.x, pos.y,
              rewardPerNode,
              { burstRadius: 20, fallDuration: 800 }
            );
          } catch (e) {}
        }, idx * 50);
      });
    }

    // Dispatch custom event for other systems to react to
    try {
      var evt = new CustomEvent('constellation-solved', {
        detail: {
          constellationId: _activeConstellationId,
          path: _path.slice(),
          nodeCount: constellation.nodeIds.length,
          totalReward: rewardPerNode * constellation.nodeIds.length,
          difficulty: constellation.difficulty,
        },
      });
      document.dispatchEvent(evt);
    } catch (e) {}

    console.log('[ConstellationTracer] Constellation solved!',
                _activeConstellationId,
                '| Reward:', rewardPerNode * constellation.nodeIds.length, 'coins');

    // Reset tracer state (but keep enabled for continued dragging)
    _state = 'idle';
    _path = [];
    _activeConstellationId = null;
    _snapCandidate = null;
    _snapAnim = null;
  }

  // ── Render Hook ──────────────────────────────────────────
  //
  // Draws tether lines, snap indicators, and connection paths
  // onto the starfield master canvas each frame.

  function _renderHook(hookCtx) {
    if (!_enabled) return;

    var ctx = hookCtx.ctx;
    var W = hookCtx.W;
    var H = hookCtx.H;
    _animTime = hookCtx.time;

    if (_path.length === 0) return;
    if (typeof SuitNodeRenderer === 'undefined') return;

    // ── Draw committed path segments ──
    ctx.save();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Glow layer (thicker, translucent)
    if (_path.length >= 2) {
      ctx.strokeStyle = TETHER_GLOW;
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (var i = 0; i < _path.length; i++) {
        var node = SuitNodeRenderer.getNodeById(_path[i]);
        if (!node) continue;
        var px = node.x * W;
        var py = node.y * H;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Solid line layer
      ctx.strokeStyle = TETHER_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var j = 0; j < _path.length; j++) {
        var node2 = SuitNodeRenderer.getNodeById(_path[j]);
        if (!node2) continue;
        var px2 = node2.x * W;
        var py2 = node2.y * H;
        if (j === 0) ctx.moveTo(px2, py2);
        else ctx.lineTo(px2, py2);
      }
      ctx.stroke();
    }

    // ── Draw live tether from last node to cursor ──
    if ((_state === 'hasNode' || _state === 'tethered') && _cursorScreen) {
      var lastNode = SuitNodeRenderer.getNodeById(_lastNodeId());
      if (lastNode) {
        var lx = lastNode.x * W;
        var ly = lastNode.y * H;

        // Determine tether color based on snap validity
        var tetherStyle = TETHER_COLOR;
        if (_snapCandidate) {
          tetherStyle = SNAP_COLOR;
        } else if (_cursorScreen) {
          // Check if current angle would be invalid
          var rawAngle = _angleBetween(lx, ly, _cursorScreen.x, _cursorScreen.y);
          var closest = _closestAllowedAngle(rawAngle);
          if (closest === null) {
            tetherStyle = INVALID_COLOR;
          }
        }

        // Animated dash pattern
        var dashPhase = (_animTime * 0.5) % 20;

        ctx.strokeStyle = tetherStyle;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -dashPhase;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(_cursorScreen.x, _cursorScreen.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── Snap candidate highlight ring ──
    if (_snapCandidate) {
      var sp = _getNodeScreenPos(_snapCandidate);
      var ringPulse = 0.7 + 0.3 * Math.sin(_animTime * 0.1);
      var ringRadius = SNAP_RADIUS * 0.5 * ringPulse;

      ctx.strokeStyle = SNAP_COLOR;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6 + 0.4 * ringPulse;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── Snap overshoot animation ──
    if (_snapAnim) {
      var elapsed = _animTime - _snapAnim.startTime;
      if (elapsed < 20) { // ~20 frames of animation
        var t = elapsed / 20;
        // Elastic easeOut
        var p = 0.3;
        var s = p / 4;
        var scale = 1 + Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) * 0.3;

        ctx.save();
        ctx.translate(_snapAnim.x, _snapAnim.y);
        ctx.scale(scale, scale);
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = SNAP_COLOR;
        ctx.globalAlpha = 1 - t * 0.5;
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        _snapAnim = null;
      }
    }

    // ── Node connection dots (pulse on path nodes) ──
    for (var pi = 0; pi < _path.length; pi++) {
      var pNode = SuitNodeRenderer.getNodeById(_path[pi]);
      if (!pNode || pNode.state === 'forever') continue;
      var pp = { x: pNode.x * W, y: pNode.y * H };
      var dotPulse = 0.5 + 0.5 * Math.sin(_animTime * 0.08 + pi * 1.2);
      ctx.fillStyle = TETHER_COLOR;
      ctx.globalAlpha = 0.6 + 0.4 * dotPulse;
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Init / Destroy ───────────────────────────────────────

  function init() {
    if (typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
      _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderHook);
    } else {
      setTimeout(function () {
        if (!_unhookFn && typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
          _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderHook);
        }
      }, 1000);
    }
  }

  function destroy() {
    if (_unhookFn) { _unhookFn(); _unhookFn = null; }
    endSession();
  }

  // ── Queries ──────────────────────────────────────────────

  function getState() { return _state; }
  function getPath()  { return _path.slice(); }
  function isEnabled() { return _enabled; }
  function getActiveConstellationId() { return _activeConstellationId; }

  // ── Public API ───────────────────────────────────────────

  root.ConstellationTracer = {
    init:             init,
    destroy:          destroy,
    beginSession:     beginSession,
    endSession:       endSession,
    updateCursor:     updateCursor,
    getState:         getState,
    getPath:          getPath,
    isEnabled:        isEnabled,
    getActiveConstellationId: getActiveConstellationId,
    // Constants exposed for tuning
    ALLOWED_ANGLES:   ALLOWED_ANGLES,
    ANGLE_TOLERANCE:  ANGLE_TOLERANCE,
    SNAP_RADIUS:      SNAP_RADIUS,
    HIT_RADIUS:       HIT_RADIUS,
  };

})(typeof window !== 'undefined' ? window : this);
