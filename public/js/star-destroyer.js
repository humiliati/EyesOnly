/* ============================================================
   Star Destroyer — Phase 10 Endgame Widget
   ============================================================
   An equippable item (ITM-210) that turns the cursor into a
   porthole crosshair. When active, clicking/tapping on forever
   pixels destroys them and converts them to currency.

   Mechanics:
     - Toggle on/off via equipment system or console command
     - When active: cursor becomes a circular crosshair overlay
     - Click on a forever pixel → destroy it → earn coins
     - Coin yield scales by the destroyed pixel's tier and age
     - Destroyed pixels leave a grey ghost (#444444) at 0.3 opacity
     - Ghost pixels persist (the sky remembers sacrifice)

   Currency per pixel:
     Tier 1 (1px, beginner solve):  1 coin
     Tier 2 (2px, intermediate):    3 coins
     Tier 2+ with constellation:    5 coins (complex shape)

   Integration:
     - Reads forever pixels from SuitNodeRenderer
     - Dispatches currency-increment events
     - Persists ghost pixels in constellation-gamestate

   Usage:
     StarDestroyer.toggle()    — equip/unequip
     StarDestroyer.isActive()  — check if equipped
   ============================================================ */

;(function (root) {
  'use strict';

  // ── Config ──────────────────────────────────────────────

  var CROSSHAIR_RADIUS = 24;   // px — click detection radius
  var GHOST_COLOR      = '#444444';
  var GHOST_OPACITY    = 0.3;
  var DESTROY_SFX      = 'snap-1';
  var DESTROY_SFX_BIG  = 'snap-3';

  // Coin yield per tier
  var TIER_COINS = { 1: 1, 2: 3 };
  var CONSTELLATION_BONUS = 2; // extra coins if pixel has constellation metadata

  // ── State ──────────────────────────────────────────────

  var _active = false;
  var _crosshairEl = null;
  var _ghostPixels = [];       // { x, y, tier } — destroyed pixels rendered as ghosts
  var _destroyAnims = [];      // { x, y, startTime } — flash animations
  var _unhookFn = null;
  var GHOST_KEY = 'eyesonly_ghost_pixels';

  // ── Ghost Persistence ──────────────────────────────────

  function _loadGhosts() {
    try {
      var raw = localStorage.getItem(GHOST_KEY);
      if (raw) _ghostPixels = JSON.parse(raw);
    } catch (e) {}
  }

  function _saveGhosts() {
    try {
      localStorage.setItem(GHOST_KEY, JSON.stringify(_ghostPixels));
    } catch (e) {}
  }

  // ── Toggle ─────────────────────────────────────────────

  function toggle() {
    _active = !_active;

    if (_active) {
      _createCrosshair();
      document.addEventListener('pointermove', _onMove);
      document.addEventListener('pointerdown', _onClick);
      console.log('[StarDestroyer] Equipped — cursor is now a destruction crosshair');
    } else {
      _removeCrosshair();
      document.removeEventListener('pointermove', _onMove);
      document.removeEventListener('pointerdown', _onClick);
      console.log('[StarDestroyer] Unequipped');
    }

    try {
      document.dispatchEvent(new CustomEvent('star-destroyer-toggled', {
        detail: { active: _active },
      }));
    } catch (e) {}
  }

  function isActive() { return _active; }

  // ── Crosshair Overlay ──────────────────────────────────

  function _createCrosshair() {
    if (_crosshairEl) return;
    _crosshairEl = document.createElement('div');
    _crosshairEl.id = 'star-destroyer-crosshair';
    _crosshairEl.style.cssText = [
      'position: fixed',
      'width: ' + (CROSSHAIR_RADIUS * 2) + 'px',
      'height: ' + (CROSSHAIR_RADIUS * 2) + 'px',
      'border-radius: 50%',
      'border: 1px solid rgba(255, 60, 60, 0.6)',
      'box-shadow: 0 0 8px rgba(255, 60, 60, 0.3), inset 0 0 6px rgba(255, 60, 60, 0.15)',
      'pointer-events: none',
      'z-index: 9999',
      'transform: translate(-50%, -50%)',
      'transition: opacity 0.2s',
      'opacity: 0.7',
    ].join(';');

    // Crosshair lines
    var vLine = document.createElement('div');
    vLine.style.cssText = 'position:absolute; left:50%; top:15%; width:1px; height:70%; background:rgba(255,60,60,0.4); transform:translateX(-50%);';
    var hLine = document.createElement('div');
    hLine.style.cssText = 'position:absolute; top:50%; left:15%; width:70%; height:1px; background:rgba(255,60,60,0.4); transform:translateY(-50%);';
    _crosshairEl.appendChild(vLine);
    _crosshairEl.appendChild(hLine);

    document.body.appendChild(_crosshairEl);
    document.body.style.cursor = 'none';
  }

  function _removeCrosshair() {
    if (_crosshairEl && _crosshairEl.parentNode) {
      _crosshairEl.parentNode.removeChild(_crosshairEl);
    }
    _crosshairEl = null;
    document.body.style.cursor = '';
  }

  function _onMove(e) {
    if (_crosshairEl) {
      _crosshairEl.style.left = e.clientX + 'px';
      _crosshairEl.style.top = e.clientY + 'px';
    }
  }

  // ── Click → Destroy ────────────────────────────────────

  function _onClick(e) {
    if (!_active) return;
    if (typeof SuitNodeRenderer === 'undefined') return;

    var W = window.innerWidth;
    var H = window.innerHeight;
    var cx = e.clientX;
    var cy = e.clientY;

    var pixels = SuitNodeRenderer.getForeverPixels();
    var bestIdx = -1;
    var bestDist = CROSSHAIR_RADIUS * CROSSHAIR_RADIUS;

    for (var i = 0; i < pixels.length; i++) {
      var fp = pixels[i];
      var fpx = fp.x * W;
      var fpy = fp.y * H;
      var dx = cx - fpx;
      var dy = cy - fpy;
      var d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) return; // no pixel in range

    var target = pixels[bestIdx];
    var tier = target.tier || 1;

    // Calculate coins
    var coins = TIER_COINS[tier] || 1;
    if (target.constellation) coins += CONSTELLATION_BONUS;

    // Play SFX
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      AudioSystem.play(tier >= 2 ? DESTROY_SFX_BIG : DESTROY_SFX, { volume: 0.35 });
    }

    // Create ghost pixel (persists as a scar)
    _ghostPixels.push({ x: target.x, y: target.y, tier: tier });
    _saveGhosts();

    // Destroy flash animation
    _destroyAnims.push({
      x: target.x * W, y: target.y * H,
      startTime: performance.now(),
    });

    // Remove the forever pixel from the renderer
    pixels.splice(bestIdx, 1);
    if (SuitNodeRenderer._setForeverPixels) {
      SuitNodeRenderer._setForeverPixels(pixels);
    }

    // Award coins
    try {
      document.dispatchEvent(new CustomEvent('currency-increment', {
        detail: { amount: coins, remaining: 0, total: coins },
      }));
    } catch (e2) {}

    console.log('[StarDestroyer] Destroyed pixel at (' +
                target.x.toFixed(2) + ',' + target.y.toFixed(2) +
                ') tier ' + tier + ' → ' + coins + ' coins');
  }

  // ── Render Hook (destroy flash only — ghosts render in suit-node-renderer) ──

  function _renderHook(hookCtx) {
    var ctx = hookCtx.ctx;
    var W = hookCtx.W;
    var H = hookCtx.H;

    // Ghost pixels now render in suit-node-renderer.js (before forever pixels)
    // so new stars layer on top of old sacrifice marks.

    // Destroy flash animations
    for (var d = _destroyAnims.length - 1; d >= 0; d--) {
      var da = _destroyAnims[d];
      var elapsed = performance.now() - da.startTime;
      if (elapsed > 300) {
        _destroyAnims.splice(d, 1);
        continue;
      }
      var t = elapsed / 300;
      var fade = 1 - t;
      var radius = 3 + t * 12;

      ctx.save();
      ctx.globalAlpha = fade * 0.6;
      ctx.strokeStyle = 'rgba(255, 60, 60, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(da.x, da.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // X mark
      ctx.globalAlpha = fade * 0.4;
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 1;
      var xSize = 3 + t * 4;
      ctx.beginPath();
      ctx.moveTo(da.x - xSize, da.y - xSize);
      ctx.lineTo(da.x + xSize, da.y + xSize);
      ctx.moveTo(da.x + xSize, da.y - xSize);
      ctx.lineTo(da.x - xSize, da.y + xSize);
      ctx.stroke();

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ── Init ──────────────────────────────────────────────

  function init() {
    _loadGhosts();

    if (typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
      _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderHook);
    } else {
      setTimeout(function () {
        if (!_unhookFn && typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.addPostRenderHook) {
          _unhookFn = EyesOnlyStarfield.addPostRenderHook(_renderHook);
        }
      }, 1200);
    }

    if (_ghostPixels.length > 0) {
      console.log('[StarDestroyer] Loaded', _ghostPixels.length, 'ghost pixels');
    }
  }

  function destroy() {
    if (_active) toggle();
    if (_unhookFn) { _unhookFn(); _unhookFn = null; }
  }

  // ── Public API ────────────────────────────────────────

  root.StarDestroyer = {
    init:      init,
    destroy:   destroy,
    toggle:    toggle,
    isActive:  isActive,
    _getGhosts: function () { return _ghostPixels; },
  };

})(typeof window !== 'undefined' ? window : this);
