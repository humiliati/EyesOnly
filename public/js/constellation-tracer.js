/* ============================================================
   Constellation Tracer — Phase 8
   ============================================================
   State-machine that lets a dragging card (gold lens / ♣ suit)
   trace constellations by connecting suit-symbol nodes in the
   starfield.

   State Machine:
     idle  →  highlighting  →  hasNode  →  tethered  →  resolve
       ↑           |              |            |
       └───────────┴──────────────┴────────────┘  (cancel)

   • idle:         No node under cursor.
   • highlighting:  Cursor overlaps a ♣ node — node glows, but no
                    tether yet. Player must dwell briefly OR move
                    away and back to confirm pickup.
   • hasNode:      First node committed. A golden tether extends
                   from it toward the cursor.
   • tethered:     Two+ nodes connected. Live tether follows cursor
                   from the last connected node.
   • resolve:      Path completes — triggers validation + reward.

   Angular constraints:
     Per-constellation opt-in. Tutorial / beginner constellations
     have NO angle constraints — any connection is valid. Advanced
     procedural constellations enable the angular rule set (12°,
     90°, 168° + mirrors, ±5° tolerance).
   ============================================================ */

;(function (root) {
  'use strict';

  // ── Constants ────────────────────────────────────────────
  var ALLOWED_ANGLES = [12, 90, 168, 192, 270, 348]; // degrees
  var ANGLE_TOLERANCE = 5; // ±degrees
  var SNAP_RADIUS = 32;    // px — how close porthole center must be to snap
  var HIT_RADIUS  = 48;    // px — hit-test radius for node detection
  var HIGHLIGHT_DWELL = 8; // frames cursor must overlap a node before pickup
  // Base tether colors (gold — for night/phosphor/silver/panther palettes)
  var _BASE_TETHER  = { color: 'rgba(212,168,67,0.85)', glow: 'rgba(212,168,67,0.25)', snap: 'rgba(255,220,100,1.0)' };
  // Per-palette overrides where gold tether would vanish
  var _TETHER_PALETTES = {
    amber: { color: 'rgba(100,180,255,0.85)', glow: 'rgba(100,180,255,0.25)', snap: 'rgba(160,220,255,1.0)' },
  };
  var INVALID_COLOR = 'rgba(255, 80, 60, 0.5)';

  function _getTetherColors() {
    var palette = 'night';
    if (typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.getPalette) {
      palette = EyesOnlyStarfield.getPalette();
    }
    return _TETHER_PALETTES[palette] || _BASE_TETHER;
  }

  // ── State ────────────────────────────────────────────────
  var _state = 'idle';        // idle | highlighting | hasNode | tethered | resolve
  var _path = [];             // Array of node IDs in visit order
  var _activeConstellationId = null;
  var _activeConstellation = null; // cached constellation object
  var _cursorScreen = null;   // { x, y } — current porthole center in screen px
  var _snapCandidate = null;  // node we're hovering near (valid candidate)
  var _unhookFn = null;       // starfield render hook unregister
  var _enabled = false;       // becomes true when gold lens card is being dragged
  var _animTime = 0;          // local animation counter

  // Highlight / dwell state
  var _highlightTarget = null;  // node being highlighted before pickup
  var _highlightFrames = 0;     // frames the cursor has dwelled over the target

  // Elastic overshoot animation state
  var _snapAnim = null;       // { nodeId, startTime, x, y }

  // ── Angular Constraint Helpers ───────────────────────────

  function _angleBetween(ax, ay, bx, by) {
    var rad = Math.atan2(by - ay, bx - ax);
    var deg = rad * (180 / Math.PI);
    if (deg < 0) deg += 360;
    return deg;
  }

  function _isAngleAllowed(angleDeg) {
    for (var i = 0; i < ALLOWED_ANGLES.length; i++) {
      var diff = Math.abs(angleDeg - ALLOWED_ANGLES[i]);
      if (diff > 180) diff = 360 - diff;
      if (diff <= ANGLE_TOLERANCE) return true;
    }
    return false;
  }

  /**
   * Are angle constraints active for the current constellation?
   * Tutorial/beginner constellations default to NO constraints.
   * Constellations opt in via `angleConstraints: true` in their def.
   */
  function _angleConstraintsActive() {
    if (!_activeConstellation) return false;
    // Explicit opt-in only
    return _activeConstellation.angleConstraints === true;
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

  /**
   * Look up the constellation object from SuitNodeRenderer.
   */
  function _findConstellation(id) {
    if (typeof SuitNodeRenderer === 'undefined') return null;
    var all = SuitNodeRenderer.getConstellations();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null;
  }

  // ── State Machine Transitions ────────────────────────────

  function beginSession() {
    _state = 'idle';
    _path = [];
    _activeConstellationId = null;
    _activeConstellation = null;
    _cursorScreen = null;
    _snapCandidate = null;
    _snapAnim = null;
    _highlightTarget = null;
    _highlightFrames = 0;
    _enabled = true;
    _animTime = 0;
    console.log('[ConstellationTracer] Session started');
  }

  function endSession() {
    if (_path.length > 0 && typeof SuitNodeRenderer !== 'undefined') {
      var cid = _activeConstellationId;
      if (cid) {
        SuitNodeRenderer.resetConstellation(cid);
      } else {
        _path.forEach(function (id) { SuitNodeRenderer.resetNode(id); });
      }
    }
    // Also unhighlight any target
    if (_highlightTarget && typeof SuitNodeRenderer !== 'undefined') {
      SuitNodeRenderer.resetNode(_highlightTarget.id);
    }
    _state = 'idle';
    _path = [];
    _activeConstellationId = null;
    _activeConstellation = null;
    _cursorScreen = null;
    _snapCandidate = null;
    _snapAnim = null;
    _highlightTarget = null;
    _highlightFrames = 0;
    _enabled = false;
    console.log('[ConstellationTracer] Session ended');
  }

  /**
   * Update the cursor (porthole center) position each frame.
   */
  function updateCursor(screenX, screenY) {
    if (!_enabled) return;
    _cursorScreen = { x: screenX, y: screenY };

    if (typeof SuitNodeRenderer === 'undefined') return;

    // ── Idle: look for a ♣ node to start highlighting ──
    if (_state === 'idle') {
      var hit = SuitNodeRenderer.hitTest(screenX, screenY, HIT_RADIUS, 'club');
      if (hit) {
        // Start highlighting — don't pick up yet
        _state = 'highlighting';
        _highlightTarget = hit;
        _highlightFrames = 0;
        SuitNodeRenderer.highlightNode(hit.id);
        console.log('[ConstellationTracer] Highlighting node:', hit.id);
      }
      return;
    }

    // ── Highlighting: dwell to confirm pickup ──
    if (_state === 'highlighting') {
      if (!_highlightTarget) { _state = 'idle'; return; }

      // Check if cursor is still over the same node
      var pos = _getNodeScreenPos(_highlightTarget);
      var dx = screenX - pos.x;
      var dy = screenY - pos.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > HIT_RADIUS * 1.2) {
        // Cursor moved away — cancel highlight
        SuitNodeRenderer.resetNode(_highlightTarget.id);
        _highlightTarget = null;
        _highlightFrames = 0;
        _state = 'idle';
        return;
      }

      _highlightFrames++;
      if (_highlightFrames >= HIGHLIGHT_DWELL) {
        // Dwell confirmed — pick up!
        _pickUpNode(_highlightTarget);
        _highlightTarget = null;
        _highlightFrames = 0;
      }
      return;
    }

    // ── hasNode / tethered: check for snap to next valid node ──
    if (_state === 'hasNode' || _state === 'tethered') {
      _evaluateSnap(screenX, screenY);
    }
  }

  /**
   * Pick up the first node (highlighting → hasNode).
   */
  function _pickUpNode(node) {
    _state = 'hasNode';
    _path = [node.id];
    _activeConstellationId = node.constellation;
    _activeConstellation = _findConstellation(node.constellation);
    SuitNodeRenderer.visitNode(node.id);
    console.log('[ConstellationTracer] Picked up node:', node.id,
                'constellation:', node.constellation,
                'angleConstraints:', _angleConstraintsActive());
  }

  /**
   * Evaluate snap: is cursor near a valid ♣ node?
   * If angle constraints are active, also checks angle validity.
   * If angle constraints are off (tutorial), any reachable node snaps.
   */
  function _evaluateSnap(screenX, screenY) {
    var lastId = _lastNodeId();
    if (!lastId) return;

    var lastNode = SuitNodeRenderer.getNodeById(lastId);
    if (!lastNode) return;

    var lastPos = _getNodeScreenPos(lastNode);

    // Find nearest connectable node within hit radius
    var candidate = SuitNodeRenderer.hitTest(screenX, screenY, HIT_RADIUS, 'club');

    if (!candidate || candidate.id === lastId) {
      // Clear previous candidate highlight if we moved away
      if (_snapCandidate) {
        if (!_isNodeInPath(_snapCandidate.id)) {
          SuitNodeRenderer.resetNode(_snapCandidate.id);
        }
        _snapCandidate = null;
      }
      return;
    }

    // Don't revisit already-visited nodes (except closing the loop)
    var isClosing = (candidate.id === _path[0] && _path.length >= 3);
    if (_isNodeInPath(candidate.id) && !isClosing) {
      if (_snapCandidate && _snapCandidate.id !== candidate.id) {
        SuitNodeRenderer.resetNode(_snapCandidate.id);
      }
      _snapCandidate = null;
      return;
    }

    // Must be in the same constellation
    if (candidate.constellation !== _activeConstellationId) {
      if (_snapCandidate) {
        SuitNodeRenderer.resetNode(_snapCandidate.id);
      }
      _snapCandidate = null;
      return;
    }

    // ── Angle constraint check (only if constellation opts in) ──
    var angleOk = true;
    if (_angleConstraintsActive()) {
      var candidatePos = _getNodeScreenPos(candidate);
      var angle = _angleBetween(lastPos.x, lastPos.y, candidatePos.x, candidatePos.y);
      angleOk = _isAngleAllowed(angle);
    }

    if (angleOk) {
      // Valid candidate — highlight it
      if (!_snapCandidate || _snapCandidate.id !== candidate.id) {
        // Clear old candidate
        if (_snapCandidate && !_isNodeInPath(_snapCandidate.id)) {
          SuitNodeRenderer.resetNode(_snapCandidate.id);
        }
        _snapCandidate = candidate;
        SuitNodeRenderer.highlightNode(candidate.id);
      }

      // Auto-snap: commit when porthole center is close enough
      var cp = _getNodeScreenPos(candidate);
      var cdx = screenX - cp.x;
      var cdy = screenY - cp.y;
      var cdist = Math.sqrt(cdx * cdx + cdy * cdy);
      if (cdist < SNAP_RADIUS * 0.7) {
        _commitSnap(candidate, isClosing);
      }
    } else {
      // Angle constraint failed — clear candidate, show rejection
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
      _state = 'resolve';
      console.log('[ConstellationTracer] Loop closed! Path:', _path.join(' → '));
      _resolveConstellation();
      return;
    }

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

    // Check if all nodes visited (only auto-resolves for path-based validation).
    // Shape-based constellations require loop closure (drag back to node 1).
    _checkAllNodesVisited();
  }

  function _checkAllNodesVisited() {
    if (!_activeConstellation) return;

    // Shape and rule validation require loop closure — don't auto-resolve
    var validation = _activeConstellation.validation;
    if (validation === 'shape' || validation === 'rule') return;

    // Exact and euler validation: resolve when all nodes are in path
    var allVisited = true;
    for (var j = 0; j < _activeConstellation.nodeIds.length; j++) {
      if (!_isNodeInPath(_activeConstellation.nodeIds[j])) {
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
    if (!_activeConstellation || typeof SuitNodeRenderer === 'undefined') {
      endSession();
      return;
    }

    var constellation = _activeConstellation;

    // Mark constellation solved
    SuitNodeRenderer.markConstellationSolved(_activeConstellationId);

    // Burn nodes into forever pixels
    SuitNodeRenderer.burnForever(constellation.nodeIds);

    // Reward: emit coins per node
    var rewardPerNode = constellation.rewardPerNode || 10;
    if (typeof CurrencySpawning !== 'undefined' && CurrencySpawning.scatterPostCombatNodes) {
      constellation.nodeIds.forEach(function (id, idx) {
        var node = SuitNodeRenderer.getNodeById(id);
        if (!node) return;
        var pos = _getNodeScreenPos(node);
        setTimeout(function () {
          try {
            CurrencySpawning.scatterPostCombatNodes(
              pos.x, pos.y, rewardPerNode,
              { burstRadius: 20, fallDuration: 800 }
            );
          } catch (e) {}
        }, idx * 50);
      });
    }

    // Dispatch custom event
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

    console.log('[ConstellationTracer] ★ Constellation solved!',
                _activeConstellationId,
                '| Reward:', rewardPerNode * constellation.nodeIds.length, 'coins');

    // Reset tracer state (keep enabled for continued dragging)
    _state = 'idle';
    _path = [];
    _activeConstellationId = null;
    _activeConstellation = null;
    _snapCandidate = null;
    _snapAnim = null;
  }

  // ── Render Hook ──────────────────────────────────────────

  function _renderHook(hookCtx) {
    if (!_enabled) return;

    var ctx = hookCtx.ctx;
    var W = hookCtx.W;
    var H = hookCtx.H;
    _animTime = hookCtx.time;

    if (typeof SuitNodeRenderer === 'undefined') return;

    // Resolve palette-aware tether colors once per frame
    var tc = _getTetherColors();

    // ── Highlight ring (before pickup) ──
    if (_state === 'highlighting' && _highlightTarget) {
      var hp = _getNodeScreenPos(_highlightTarget);
      var hPulse = 0.6 + 0.4 * Math.sin(_animTime * 0.15);
      var hRadius = HIT_RADIUS * 0.4 * hPulse;
      var progress = Math.min(1, _highlightFrames / HIGHLIGHT_DWELL);

      ctx.save();
      ctx.strokeStyle = tc.snap;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + 0.5 * progress;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, hRadius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (_path.length === 0) return;

    // ── Draw committed path segments ──
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (_path.length >= 2) {
      // Glow layer
      ctx.strokeStyle = tc.glow;
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

      // Solid line
      ctx.strokeStyle = tc.color;
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

    // ── Live tether from last node to cursor ──
    if ((_state === 'hasNode' || _state === 'tethered') && _cursorScreen) {
      var lastNode = SuitNodeRenderer.getNodeById(_lastNodeId());
      if (lastNode) {
        var lx = lastNode.x * W;
        var ly = lastNode.y * H;

        var tetherStyle = tc.color;
        if (_snapCandidate) {
          tetherStyle = tc.snap;
        } else if (_angleConstraintsActive()) {
          var rawAngle = _angleBetween(lx, ly, _cursorScreen.x, _cursorScreen.y);
          if (!_isAngleAllowed(rawAngle)) {
            tetherStyle = INVALID_COLOR;
          }
        }

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

      ctx.strokeStyle = tc.snap;
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
      if (elapsed < 20) {
        var t = elapsed / 20;
        var p = 0.3;
        var s = p / 4;
        var scale = 1 + Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) * 0.3;

        ctx.save();
        ctx.translate(_snapAnim.x, _snapAnim.y);
        ctx.scale(scale, scale);
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = tc.snap;
        ctx.globalAlpha = 1 - t * 0.5;
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        _snapAnim = null;
      }
    }

    // ── Pulsing dots on committed path nodes ──
    for (var pi = 0; pi < _path.length; pi++) {
      var pNode = SuitNodeRenderer.getNodeById(_path[pi]);
      if (!pNode || pNode.state === 'forever') continue;
      var pp = { x: pNode.x * W, y: pNode.y * H };
      var dotPulse = 0.5 + 0.5 * Math.sin(_animTime * 0.08 + pi * 1.2);
      ctx.fillStyle = tc.color;
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
    ALLOWED_ANGLES:   ALLOWED_ANGLES,
    ANGLE_TOLERANCE:  ANGLE_TOLERANCE,
    SNAP_RADIUS:      SNAP_RADIUS,
    HIT_RADIUS:       HIT_RADIUS,
  };

})(typeof window !== 'undefined' ? window : this);
