/* ============================================================
   Satellite Scrubber — Phase 9 Silver Lens Mechanic
   ============================================================
   Satellites are slow-drifting sprites in the starfield that
   interfere with constellation tethering. The silver card (♠)
   clears them using orbital-swipe physics.

   Mechanics:
     - Satellites drift across the master canvas at slow speeds
     - The silver porthole acts as a gravity well (orbital pull)
     - Gentle contact only nudges satellites off-path slightly
     - Vigorous "wind-up slash" (high velocity swipe) destroys
       them in a twirl animation → coin burst
     - Destroyed satellites spawn 2 replacements (hydra mechanic)
     - Diminishing returns: 6 → 5 → 3 → 1 → 0.04 → 0.01 coins
       (counter displays whole numbers only)

   Adapted from cosmic particle orbital system (satellite-scrubber-roadmap.md):
     - Orbital angle = perpendicular to cursor-to-particle vector
     - Pull force blends with orbital force for swirl effect
     - Return-to-drift damping when lens leaves proximity

   Integration:
     - Renders via starfield postRenderHook (same layer as nodes)
     - Silver card drag activates the scrubber (lens-silver)
     - Constellation tracer checks satellite collision for tether break

   Usage:
     SatelliteScrubber.init()
     SatelliteScrubber.beginSession(cursorX, cursorY)
     SatelliteScrubber.updateCursor(cursorX, cursorY)
     SatelliteScrubber.endSession()
   ============================================================ */

;(function (root) {
  'use strict';

  // ── Config ──────────────────────────────────────────────

  // No hard cap — let it get hectic. Performance degrades naturally
  // as hundreds of satellites overwhelm the canvas. That's the point.
  var INITIAL_COUNT     = 3;     // spawn on first page load
  var ORBIT_RADIUS      = 120;   // px — porthole gravitational range
  var ORBITAL_STRENGTH  = 2.0;   // perpendicular orbital force multiplier
  var PULL_STRENGTH     = 0.3;   // radial pull toward cursor
  var RETURN_DAMPING    = 0.02;  // how fast sats return to base drift
  var FRICTION          = 0.99;  // velocity damping per frame
  var DESTROY_VELOCITY  = 8;     // min speed (px/frame) for destruction
  var NUDGE_VELOCITY    = 2;     // min speed for a gentle nudge
  var APEX_VELOCITY     = 4;     // speed threshold for orbital "woop" SFX
  var TWIRL_DURATION    = 400;   // ms — destruction twirl animation
  var HYDRA_DELAY       = 600;   // ms — delay before hydra spawn
  var SAT_SIZE          = 2;     // base radius px
  var SAT_GLOW          = 5;     // glow halo radius

  // Snap SFX variants for orbital apex (hosted on R2 at /audio/sfx/)
  var SNAP_VARIANTS     = 4;     // snap-1 through snap-4

  // Diminishing coin returns per generation
  var COIN_TIERS = [6, 5, 3, 1, 0.04, 0.01];

  // ── State ──────────────────────────────────────────────

  var _satellites = [];    // active satellite objects
  var _twirls    = [];     // destruction animations in progress
  var _enabled   = false;  // true when silver lens is dragging
  var _cursorX   = 0;
  var _cursorY   = 0;
  var _generation = 0;     // hydra generation counter (resets per page)
  var _unhookFn  = null;
  var _totalCoins = 0;
  var _lastSnapTime = 0;   // throttle snap SFX (min 120ms between snaps)

  // ── Satellite Object ──────────────────────────────────

  function _createSatellite(x, y, gen) {
    var angle = Math.random() * Math.PI * 2;
    var speed = 0.15 + Math.random() * 0.25;
    return {
      x: x || Math.random(),             // normalized 0..1
      y: y || Math.random(),
      vx: Math.cos(angle) * speed,        // px/frame drift
      vy: Math.sin(angle) * speed,
      baseVx: Math.cos(angle) * speed,
      baseVy: Math.sin(angle) * speed,
      size: SAT_SIZE + Math.random() * 1.5,
      brightness: 0.5 + Math.random() * 0.3,
      hue: 200 + Math.random() * 40,      // cool blue-white
      generation: gen || 0,
      age: 0,
    };
  }

  function _spawnInitial() {
    for (var i = 0; i < INITIAL_COUNT; i++) {
      if (_satellites.length < MAX_SATELLITES) {
        _satellites.push(_createSatellite(null, null, 0));
      }
    }
  }

  // ── Physics ───────────────────────────────────────────

  function _updateSatellite(sat, W, H) {
    var sx = sat.x * W;
    var sy = sat.y * H;

    if (_enabled) {
      var dx = _cursorX - sx;
      var dy = _cursorY - sy;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ORBIT_RADIUS && dist > 1) {
        var force = (1 - dist / ORBIT_RADIUS) * 0.5;
        var angle = Math.atan2(dy, dx);

        // Orbital: perpendicular to line between sat and cursor
        var orbAngle = angle + Math.PI / 2;
        sat.vx += Math.cos(orbAngle) * ORBITAL_STRENGTH * force;
        sat.vy += Math.sin(orbAngle) * ORBITAL_STRENGTH * force;

        // Pull: toward cursor
        sat.vx += Math.cos(angle) * PULL_STRENGTH * force;
        sat.vy += Math.sin(angle) * PULL_STRENGTH * force;
      }
    }

    // Return to base drift
    sat.vx += (sat.baseVx - sat.vx) * RETURN_DAMPING;
    sat.vy += (sat.baseVy - sat.vy) * RETURN_DAMPING;

    // Friction
    sat.vx *= FRICTION;
    sat.vy *= FRICTION;

    // Move (in screen px, then normalize back)
    sx += sat.vx;
    sy += sat.vy;

    // Wrap
    if (sx < 0) sx += W;
    if (sx > W) sx -= W;
    if (sy < 0) sy += H;
    if (sy > H) sy -= H;

    sat.x = sx / W;
    sat.y = sy / H;
    sat.age++;
  }

  // ── Destruction Check ──────────────────────────────────

  function _checkDestruction(sat, W, H) {
    if (!_enabled) return false;

    var sx = sat.x * W;
    var sy = sat.y * H;
    var dx = _cursorX - sx;
    var dy = _cursorY - sy;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > ORBIT_RADIUS * 0.6) return false;

    var speed = Math.sqrt(sat.vx * sat.vx + sat.vy * sat.vy);

    if (speed >= DESTROY_VELOCITY) {
      // Vigorous slash → destroy with twirl
      _destroySatellite(sat, W, H);
      return true;
    }

    if (speed >= NUDGE_VELOCITY && dist < ORBIT_RADIUS * 0.3) {
      // Gentle nudge — knock off path slightly
      var pushAngle = Math.atan2(sy - _cursorY, sx - _cursorX);
      sat.vx += Math.cos(pushAngle) * 1.5;
      sat.vy += Math.sin(pushAngle) * 1.5;
      sat.baseVx = sat.vx * 0.3;
      sat.baseVy = sat.vy * 0.3;
    }

    return false;
  }

  function _destroySatellite(sat, W, H) {
    var sx = sat.x * W;
    var sy = sat.y * H;

    // Start twirl animation
    _twirls.push({
      x: sx, y: sy,
      startTime: performance.now(),
      duration: TWIRL_DURATION,
      size: sat.size,
      hue: sat.hue,
    });

    // Award coins (diminishing returns by generation)
    var tier = Math.min(sat.generation, COIN_TIERS.length - 1);
    var coins = COIN_TIERS[tier];
    _totalCoins += coins;

    // Dispatch currency event (whole numbers only for display)
    var displayAmount = Math.floor(coins);
    if (displayAmount >= 1) {
      try {
        document.dispatchEvent(new CustomEvent('currency-increment', {
          detail: { amount: displayAmount, remaining: 0, total: displayAmount },
        }));
      } catch (e) {}
    }

    // Play SFX
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play('coin-flip', { volume: 0.25 });
    }

    // Hydra spawn (2 replacements after delay)
    var gen = sat.generation + 1;
    var spawnX = sat.x;
    var spawnY = sat.y;
    setTimeout(function () {
      for (var h = 0; h < 2; h++) {
        if (_satellites.length < MAX_SATELLITES) {
          var offset = 0.03 + Math.random() * 0.04;
          var angle = Math.random() * Math.PI * 2;
          _satellites.push(_createSatellite(
            spawnX + Math.cos(angle) * offset,
            spawnY + Math.sin(angle) * offset,
            gen
          ));
        }
      }
      _generation = Math.max(_generation, gen);
    }, HYDRA_DELAY);

    console.log('[SatelliteScrubber] Destroyed gen-' + sat.generation +
                ' satellite. Coins: ' + coins.toFixed(2) + ' Total: ' + _totalCoins.toFixed(2));
  }

  // ── Tether Collision (for constellation tracer) ────────

  /**
   * Check if a line segment (tether) intersects any satellite.
   * Used by constellation tracer to break active tethers.
   * @returns {boolean} true if any satellite blocks the path
   */
  function checkTetherCollision(x1, y1, x2, y2, W, H) {
    for (var i = 0; i < _satellites.length; i++) {
      var s = _satellites[i];
      var sx = s.x * W;
      var sy = s.y * H;
      var r = s.size * 3;

      // Point-to-segment distance
      var dx = x2 - x1, dy = y2 - y1;
      var len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      var t = Math.max(0, Math.min(1, ((sx - x1) * dx + (sy - y1) * dy) / len2));
      var px = x1 + t * dx;
      var py = y1 + t * dy;
      var dist = Math.sqrt((sx - px) * (sx - px) + (sy - py) * (sy - py));
      if (dist < r) return true;
    }
    return false;
  }

  // ── Render Hook ───────────────────────────────────────

  function _renderHook(hookCtx) {
    var ctx = hookCtx.ctx;
    var W = hookCtx.W;
    var H = hookCtx.H;

    // Update + render satellites
    for (var i = _satellites.length - 1; i >= 0; i--) {
      var sat = _satellites[i];
      _updateSatellite(sat, W, H);

      // Check destruction (only when silver lens active)
      if (_enabled && _checkDestruction(sat, W, H)) {
        _satellites.splice(i, 1);
        continue;
      }

      // Render
      var sx = sat.x * W;
      var sy = sat.y * H;
      var speed = Math.sqrt(sat.vx * sat.vx + sat.vy * sat.vy);
      var dynBright = Math.min(1, sat.brightness + speed * 0.05);

      // Glow halo
      ctx.save();
      var grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, SAT_GLOW);
      grad.addColorStop(0, 'rgba(180, 200, 255, ' + (dynBright * 0.3) + ')');
      grad.addColorStop(0.5, 'rgba(140, 170, 220, ' + (dynBright * 0.1) + ')');
      grad.addColorStop(1, 'rgba(100, 130, 180, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx - SAT_GLOW, sy - SAT_GLOW, SAT_GLOW * 2, SAT_GLOW * 2);

      // Core
      ctx.fillStyle = 'rgba(220, 230, 255, ' + dynBright + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, sat.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render twirl destruction animations
    for (var t = _twirls.length - 1; t >= 0; t--) {
      var tw = _twirls[t];
      var elapsed = performance.now() - tw.startTime;
      if (elapsed > tw.duration) {
        _twirls.splice(t, 1);
        continue;
      }

      var progress = elapsed / tw.duration;
      var fade = 1 - progress;
      var spin = progress * Math.PI * 4; // 2 full rotations
      var expand = 1 + progress * 3;     // expand outward as it spins

      ctx.save();
      ctx.translate(tw.x, tw.y);
      ctx.rotate(spin);

      // 3 twirl fragments
      for (var f = 0; f < 3; f++) {
        var fragAngle = (f / 3) * Math.PI * 2;
        var fragDist = tw.size * expand * 3;
        var fx = Math.cos(fragAngle) * fragDist;
        var fy = Math.sin(fragAngle) * fragDist;

        ctx.globalAlpha = fade * 0.8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx, fy, tw.size * fade, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ── Session Management ────────────────────────────────

  function beginSession() {
    _enabled = true;
  }

  function endSession() {
    _enabled = false;
  }

  function updateCursor(x, y) {
    _cursorX = x;
    _cursorY = y;
  }

  // ── Init ──────────────────────────────────────────────

  function init() {
    _spawnInitial();

    if (typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
      _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderHook);
    } else {
      setTimeout(function () {
        if (!_unhookFn && typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
          _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderHook);
        }
      }, 1000);
    }

    console.log('[SatelliteScrubber] Initialized with', _satellites.length, 'satellites');
  }

  function destroy() {
    if (_unhookFn) { _unhookFn(); _unhookFn = null; }
    _satellites = [];
    _twirls = [];
    _enabled = false;
  }

  function getSatelliteCount() { return _satellites.length; }
  function getTotalCoins()     { return _totalCoins; }
  function getGeneration()     { return _generation; }

  // ── Public API ────────────────────────────────────────

  root.SatelliteScrubber = {
    init:                  init,
    destroy:               destroy,
    beginSession:          beginSession,
    endSession:            endSession,
    updateCursor:          updateCursor,
    checkTetherCollision:  checkTetherCollision,
    getSatelliteCount:     getSatelliteCount,
    getTotalCoins:         getTotalCoins,
    getGeneration:         getGeneration,
  };

})(typeof window !== 'undefined' ? window : this);
