/**
 * OnboardingTutorial — Pink Panther Pawprint Tutorial for Floor 0.
 *
 * 10-phase scripted walkthrough that teaches tap-to-move via a hijacked
 * cursor demonstration.  The player has full input from the start; if they
 * tap/move at any point the cursor demo self-aborts and play continues
 * organically.
 *
 * Stateless IIFE module — all mutable state via closure locals.
 */
var OnboardingTutorial = (function() {
  'use strict';

  // ── Base64-encoded cursor.cur for the hijack overlay ──────────────
  var CURSOR_BASE64 = 'data:image/x-icon;base64,AAACAAEAICAAAAAAAACoEAAAFgAAACgAAAAgAAAAQAAAAAEAIAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQH/AQEB/wEBAf8BAQH/AQEB/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEB/////f////3////9/////f8BAQH/AQEB/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYEAv8DAgH/BgEE/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAP8GAxL/o0mg//z9///6/v7/uVLe/wACBP8BAAT/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHACf/BgAY/wIALf8CBAL/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgUD/wIGEv+jSaD//P3///79/v+5Ut7/AgEG/wIBAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAf8AAwD/uVLe/8+R5v8DAAT/CAMD/wAAAAAAAAAAAAAAAAEDBP8AAwL/uVLe//39///9+///eDt2/wYBCv8AAwX/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEB/3pCeP/WttW1z5Hm/zguAP8xNwD/AAAAAAAAAAACAh7/BwYB/6NJoP/8/vr//v///7lS3v8kIgD/BAEF/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgL/ekJ4/9a21bXPkeb/uVLe/7lS3v8BAwn/SkZD/wEBGv8NBQD/o0mg//3//P/9//3/uVLe/ykrAP8GAgb/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICAv96Qnj/1rbVtf/+////////uVLe/7lS3v+5Ut7/BwMW/7lS3v/19/////7///br//8AADX/Jysg/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEB/3pCeP/WttXe//7///7///+5Ut6wuVLesLlS3v94O3b/uVLesP3+//+5Ut6wuVLe/2YoZP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/ekJ4/9a21d7///////////////+5Ut6wuVLe/7lS3rD+/v7/////////8f+5Ut7/AAQA/wACA/8AAQb/AQMB/wABAP8AAAL/AAAC/wAAAv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICAv96Qnj/1rbV3v/+//////////////3////9/v/////////////////////x/7lS3v89DU//VyZp/1cmaf9XJmn/VyZp/1cmaf9XJmn/AAIB/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgIC/3pCeP/WttXv///9//////////////////////////////////////////j/uVLe/7lS3v+5Ut7/uVLe/7lS3v+5Ut7/uVLe/7lS3v8DAQH/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQH/ekJ4/9a21e////3///////////////////////////////////////////////////////////////////////z/+/9mKGT/KR8c/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAf96Qnj/1rbV9v///f/////////////////////////////////////////////////////////////////+/P//uVLe/2YoZP8NExX/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEB/3pCeP/WttX2///////////////////////////////////////////////////////////////////9///+/f/9//r//////6Wc9v8AAwr/AAIB/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQH/ekJ4/9a21fb///3//////////////////////////////////////////////////////9a21bW5Ut7/BAkB/wsBCf+jSaD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICAv96Qnj/1rbV9v7//P////////////////////////////////////////////n//P////T/eDt2hQMADv8DAwT/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgIB/3pCeP/WttX2///9////////////////////////////////////////////7/r8/wAAM/8BAQH/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADx8fP/NjEz/wAAAP8AABX/ekJ4/9a21f/////////////////////////////////////////7/7lS3m+5Ut7/AAQb/2Vicf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEB/wEBAf/WttX/1rbV//7//P/5/vz/+fr8//////////////7/////////////////////+//6/f//o0mg/wQFAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/3pCeP/WttX2///////+///////////////////9//7/7fL//7lS3v8KEwL/BQcD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/ekJ4/9a21f////3//////////f////3///79/7lS3m94O3b/AwQL/0tJTf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP96Qnj/ekJ4/////////////v/8//79///38v//CggU/7lS3v+5Ut5vAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/3pCeP/WttX////9///////9//z/uVLeb7lS3v94O3aF1rbVtQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/ekJ4/9a21f////3////+///7//+jSaD/AAcA/9a21bUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP96Qnj/ekJ4///////0/f//uVLe/wAGEP8AAwH/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/3pCeP/WttX/z5Hm/3g7dv8BAAX/cHZz/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/ekJ4/9a21f89DU//AgQD/9a21bUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAQD/AgQL/wEEAP+5Ut5vAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///B////gP/+PwD//D8A//wOAf/8DAP//AAD//wAB//8AA///AAAH/wAAB/8AAAf/AAAP/wAAD/8AAAP/AAAf/wAAf/8AAf/4ABH/8AAH//8AB///AI///wA///8CP///AH///wD///8B////A////w///////////////////8=';

  // ── State ──────────────────────────────────────────────────────────
  var _active = false;
  var _phase = 0;
  var _startTime = 0;
  var _playerTookControl = false;
  var _cursorEl = null;
  var _trailEls = [];
  var _styleEl = null;
  var _ctx = null;
  var _exitX = 0;
  var _exitY = 0;
  var _path = null;         // A* waypoints from player to exit
  var _cursorPathIndex = 0; // current index along _path for cursor animation
  var _cursorAnimFrame = 0;
  var _phaseTimers = [];    // setTimeout handles for cleanup
  var _inputListener = null;
  var _floor1Hook = false;
  var _surviveFired = false; // Phase 9 "Survive." fires on floor 0 sprint

  // ── CSS injection ─────────────────────────────────────────────────
  // FIX 1: Cursor positioned on document.body with z-index 99990 (above HUD at 1801)
  // FIX 2: Glitch flicker changed from rapid infinite to 2 slow flashes over ~2s
  function _injectStyles() {
    if (_styleEl) return;
    _styleEl = document.createElement('style');
    _styleEl.id = 'onboarding-tutorial-styles';
    _styleEl.textContent = [
      '.onboarding-cursor {',
      '  position: fixed;',
      '  width: 32px; height: 32px;',
      '  background-image: url("' + CURSOR_BASE64 + '");',
      '  background-size: contain;',
      '  background-repeat: no-repeat;',
      '  pointer-events: none;',
      '  z-index: 99990;',
      '  transform: translate(-2px, -2px);',
      '  transition: none;',
      '  image-rendering: pixelated;',
      '}',
      // FIX 2: Slow glitch — 2 brief flashes across a 2.5s animation, then stops
      '.onboarding-cursor.glitch {',
      '  animation: onb-glitch 2.5s steps(1) forwards;',
      '}',
      '@keyframes onb-glitch {',
      '  0%   { filter: invert(0) hue-rotate(0deg); opacity: 1; }',
      '  20%  { filter: invert(0) hue-rotate(0deg); opacity: 1; }',
      '  22%  { filter: invert(1) hue-rotate(180deg); opacity: 0.7; }',
      '  26%  { filter: invert(0) hue-rotate(0deg); opacity: 1; }',
      '  60%  { filter: invert(0) hue-rotate(0deg); opacity: 1; }',
      '  62%  { filter: invert(1) hue-rotate(90deg); opacity: 0.8; }',
      '  66%  { filter: invert(0) hue-rotate(0deg); opacity: 1; }',
      '  100% { filter: invert(0) hue-rotate(0deg); opacity: 1; }',
      '}',
      '.onboarding-cursor.tap-pulse {',
      '  animation: onb-tap 0.4s ease-out;',
      '}',
      '@keyframes onb-tap {',
      '  0% { transform: translate(-2px, -2px) scale(1); }',
      '  50% { transform: translate(-2px, -2px) scale(1.4); }',
      '  100% { transform: translate(-2px, -2px) scale(1); }',
      '}',
      '.onboarding-trail-dot {',
      '  position: fixed;',
      '  width: 6px; height: 6px;',
      '  border-radius: 50%;',
      '  background: rgba(0, 220, 200, 0.6);',
      '  pointer-events: none;',
      '  z-index: 99989;',
      '  animation: onb-trail-fade 2s ease-out forwards;',
      '}',
      '@keyframes onb-trail-fade {',
      '  0% { opacity: 0.8; transform: scale(1); }',
      '  100% { opacity: 0; transform: scale(0.3); }',
      '}',
      '.onboarding-tap-ring {',
      '  position: fixed;',
      '  width: 24px; height: 24px;',
      '  border: 2px solid #ffaa00;',
      '  border-radius: 50%;',
      '  pointer-events: none;',
      '  z-index: 99991;',
      '  animation: onb-ring-expand 0.6s ease-out forwards;',
      '}',
      '@keyframes onb-ring-expand {',
      '  0% { transform: translate(-12px, -12px) scale(0.5); opacity: 1; }',
      '  100% { transform: translate(-12px, -12px) scale(2); opacity: 0; }',
      '}'
    ].join('\n');
    document.head.appendChild(_styleEl);
  }

  // ── Grid ↔ pixel coordinate helpers ───────────────────────────────
  function _getGridContainer() {
    return document.getElementById('rogue-grid-mobile');
  }

  function _getCellSize() {
    // Derive cell size from grid container dimensions / visible grid cells.
    var container = _getGridContainer();
    if (container && _ctx) {
      var rect = container.getBoundingClientRect();
      var viewW = 20;
      if (rect.width > 0) {
        return Math.round(rect.width / viewW) || 20;
      }
    }
    return 20;
  }

  function _getCameraOffset() {
    if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.getCameraState) {
      var cs = GoneRogueMobile.getCameraState();
      return { x: cs.originXi || 0, y: cs.originYi || 0 };
    }
    return { x: 0, y: 0 };
  }

  /**
   * FIX 1: Convert grid (tileX, tileY) to VIEWPORT-FIXED pixel position.
   * Since cursor/trail are now `position: fixed` on document.body,
   * we need the grid container's bounding rect to get absolute screen coords.
   */
  function _gridToViewport(tileX, tileY) {
    var container = _getGridContainer();
    if (!container) return { px: 0, py: 0 };
    var rect = container.getBoundingClientRect();
    var cellSize = _getCellSize();
    var cam = _getCameraOffset();
    return {
      px: rect.left + (tileX - cam.x) * cellSize,
      py: rect.top + (tileY - cam.y) * cellSize
    };
  }

  // ── Cursor overlay management ─────────────────────────────────────
  // FIX 1: Cursor now appended to document.body (escapes grid stacking context)
  function _createCursor() {
    if (_cursorEl) return _cursorEl;
    _cursorEl = document.createElement('div');
    _cursorEl.className = 'onboarding-cursor glitch';
    document.body.appendChild(_cursorEl);
    return _cursorEl;
  }

  function _positionCursor(tileX, tileY) {
    if (!_cursorEl) return;
    var pos = _gridToViewport(tileX, tileY);
    _cursorEl.style.left = pos.px + 'px';
    _cursorEl.style.top = pos.py + 'px';
  }

  function _removeCursor() {
    if (_cursorEl && _cursorEl.parentNode) {
      _cursorEl.parentNode.removeChild(_cursorEl);
    }
    _cursorEl = null;
  }

  function _dropTrailDot(tileX, tileY) {
    var pos = _gridToViewport(tileX, tileY);
    var dot = document.createElement('div');
    dot.className = 'onboarding-trail-dot';
    dot.style.left = (pos.px + 10) + 'px';
    dot.style.top = (pos.py + 10) + 'px';
    document.body.appendChild(dot);
    _trailEls.push(dot);
    setTimeout(function() {
      if (dot.parentNode) dot.parentNode.removeChild(dot);
      var idx = _trailEls.indexOf(dot);
      if (idx !== -1) _trailEls.splice(idx, 1);
    }, 2100);
  }

  function _showTapRing(tileX, tileY) {
    var pos = _gridToViewport(tileX, tileY);
    var cellSize = _getCellSize();
    var ring = document.createElement('div');
    ring.className = 'onboarding-tap-ring';
    ring.style.left = (pos.px + cellSize / 2) + 'px';
    ring.style.top = (pos.py + cellSize / 2) + 'px';
    document.body.appendChild(ring);
    setTimeout(function() {
      if (ring.parentNode) ring.parentNode.removeChild(ring);
    }, 700);
  }

  // ── Trail cleanup ─────────────────────────────────────────────────
  function _clearTrail() {
    _trailEls.forEach(function(el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    _trailEls = [];
  }

  // ── Timer management ──────────────────────────────────────────────
  function _delay(fn, ms) {
    var t = setTimeout(fn, ms);
    _phaseTimers.push(t);
    return t;
  }

  function _clearTimers() {
    _phaseTimers.forEach(function(t) { clearTimeout(t); });
    _phaseTimers = [];
    if (_cursorAnimFrame) {
      cancelAnimationFrame(_cursorAnimFrame);
      _cursorAnimFrame = 0;
    }
  }

  // ── Input detection (player took control) ─────────────────────────
  function _onPlayerInput() {
    if (!_active || _playerTookControl) return;
    _playerTookControl = true;
    _abort();
  }

  function _bindInputListener() {
    var container = _getGridContainer();
    if (!container) return;
    _inputListener = function(e) {
      _onPlayerInput();
    };
    container.addEventListener('touchstart', _inputListener, { passive: true });
    container.addEventListener('mousedown', _inputListener);
  }

  function _unbindInputListener() {
    var container = _getGridContainer();
    if (!container || !_inputListener) return;
    container.removeEventListener('touchstart', _inputListener);
    container.removeEventListener('mousedown', _inputListener);
    _inputListener = null;
  }

  // ── Phase implementations ─────────────────────────────────────────

  /** Phase 1: Player has full input.  Just start the timer. */
  function _phase1() {
    _phase = 1;
    _startTime = Date.now();
    console.log('[Onboarding] Phase 1: player has input, timer started');
    _delay(_phase2, 350);   // was 500 → 30% faster
  }

  /** Phase 2: Tooltip + overhead hint */
  function _phase2() {
    if (_playerTookControl) return;
    _phase = 2;
    console.log('[Onboarding] Phase 2: tooltip + overhead hint');

    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.show('\uD83D\uDC46 Tap + Drag to move', 2000);  // was 3000
    }
    if (typeof OverheadAnimator !== 'undefined' && _ctx) {
      OverheadAnimator.showGenericExpression(
        _ctx.player.x, _ctx.player.y,
        '\uD83D\uDC46', 2000, '#ffff00'    // was 3000
      );
    }
    _delay(_phase3, 500);   // was 750 → 30% faster
  }

  /** Phase 3: Cursor hijack */
  function _phase3() {
    if (_playerTookControl) return;
    _phase = 3;
    console.log('[Onboarding] Phase 3: cursor hijack');

    _injectStyles();
    _createCursor();
    _positionCursor(_ctx.player.x, _ctx.player.y);
    _computePath();
    _delay(_phase4, 150);   // was 250 → 40% faster
  }

  /** Phase 4: Cursor glides along A* path to exit door */
  function _phase4() {
    if (_playerTookControl) return;
    _phase = 4;
    console.log('[Onboarding] Phase 4: cursor glides to exit');

    if (!_path || _path.length === 0) {
      console.warn('[Onboarding] No path to exit, skipping glide');
      _phase5();
      return;
    }

    _cursorPathIndex = 0;
    var glideSpeed = 3.0;   // was 2.0 — ~33% faster cursor glide
    var lastTime = Date.now();

    function animateGlide() {
      if (_playerTookControl || !_active) return;

      var now = Date.now();
      var dt = (now - lastTime) / 1000;
      lastTime = now;

      _cursorPathIndex += dt * glideSpeed;

      var idx = Math.floor(_cursorPathIndex);
      if (idx >= _path.length - 1) {
        var lastWp = _path[_path.length - 1];
        _positionCursor(lastWp.x, lastWp.y);
        _dropTrailDot(lastWp.x, lastWp.y);
        _delay(_phase5, 300);
        return;
      }

      var frac = _cursorPathIndex - idx;
      var wp0 = _path[idx];
      var wp1 = _path[idx + 1];
      var interpX = wp0.x + (wp1.x - wp0.x) * frac;
      var interpY = wp0.y + (wp1.y - wp0.y) * frac;

      _positionCursor(interpX, interpY);

      if (idx > 0 && idx !== _lastTrailIdx) {
        _dropTrailDot(wp0.x, wp0.y);
        _lastTrailIdx = idx;
      }

      _cursorAnimFrame = requestAnimationFrame(animateGlide);
    }

    var _lastTrailIdx = -1;
    _cursorAnimFrame = requestAnimationFrame(animateGlide);
  }

  /** Phase 5: Cursor demonstrates tap at exit + shows fishing line */
  function _phase5() {
    if (_playerTookControl) return;
    _phase = 5;
    console.log('[Onboarding] Phase 5: cursor tap demo + fishing line');

    if (_cursorEl) {
      _cursorEl.classList.remove('glitch');
      _cursorEl.classList.add('tap-pulse');
    }
    _showTapRing(_exitX, _exitY);

    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.show('\uD83C\uDFA3 Drag to draw a path', 1800);  // was 2500
    }

    // After tap animation, show fishing line then schedule auto-walk
    _delay(function() {
      if (_playerTookControl) return;

      // Show fishing path visualization
      if (_path && _path.length > 1 && typeof GoneRogueMobile !== 'undefined') {
        if (GoneRogueMobile.showFishingPath) {
          GoneRogueMobile.showFishingPath(_path);
        }
      }

      // Schedule Phase 6 — auto-walk
      _delay(_phase6, 800);  // was 1200 → 33% faster
    }, 400);  // was 600 → 33% faster
  }

  /** Phase 6: Avatar auto-walks the fishing line to exit.
   *  Sequence: walk starts → short delay → "SURVIVE" + "!" → sprint kicks in → floor transition
   */
  function _phase6() {
    if (_playerTookControl) return;
    _phase = 6;
    console.log('[Onboarding] Phase 6: avatar auto-walks to exit');

    _removeCursor();
    _clearTrail();

    // Hide the fishing line BEFORE auto-walk starts (doesn't track camera scroll)
    if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.hideFishingPath) {
      GoneRogueMobile.hideFishingPath();
    }

    // Start the walk (not sprint yet)
    var collisionCheck = function(x, y) {
      if (typeof GoneRogue !== 'undefined' && GoneRogue.isWalkable) {
        return !GoneRogue.isWalkable(x, y);
      }
      return false;
    };

    if (typeof GoneRogueMovement !== 'undefined' && _ctx) {
      GoneRogueMovement.setTarget(_exitX, _exitY, collisionCheck, false);
    }

    // After a brief walk, fire "SURVIVE" tooltip + "!" overhead, then trigger sprint
    _delay(function() {
      if (_playerTookControl) return;

      // Fire "SURVIVE" on floor 0 during the walk
      if (!_surviveFired) {
        _surviveFired = true;
        if (typeof TooltipSystem !== 'undefined') {
          TooltipSystem.show('SURVIVE.', 1200);
        }
        if (typeof OverheadAnimator !== 'undefined' && _ctx) {
          OverheadAnimator.showGenericExpression(
            _ctx.player.x, _ctx.player.y,
            '\u2757', 1000, '#ff4444'
          );
        }
      }

      // After SURVIVE registers, kick into sprint
      _delay(function() {
        if (_playerTookControl) return;
        _phase8();
      }, 900);
    }, 700);  // 700ms of walk before SURVIVE fires
  }

  /** Phase 7 / abort: Player took control — clean up overlays */
  function _abort() {
    console.log('[Onboarding] Player took control — cleaning up tutorial overlays');
    _clearTimers();
    _removeCursor();
    _clearTrail();

    if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.hideFishingPath) {
      GoneRogueMobile.hideFishingPath();
    }

    if (typeof OverheadAnimator !== 'undefined' && _ctx) {
      OverheadAnimator.clearAnimation(_ctx.player.x, _ctx.player.y);
    }

    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.show('\uD83D\uDC4D Nice! Keep exploring.', 2000);
    }

    _unbindInputListener();
    _phase = 7;
  }

  /** Phase 8: Sprint — called from Phase 6 after SURVIVE fires.
   *  Shows double-tap cursor demo, switches movement to sprint,
   *  then player runs through to the exit door / floor transition.
   */
  function _phase8() {
    if (_playerTookControl) return;
    _phase = 8;
    console.log('[Onboarding] Phase 8: sprint demo');

    // Show cursor at exit, double-tap animation
    _injectStyles();
    _createCursor();
    _positionCursor(_exitX, _exitY);
    if (_cursorEl) {
      _cursorEl.classList.remove('glitch');
      _cursorEl.classList.add('tap-pulse');
    }
    _showTapRing(_exitX, _exitY);

    // Brief delay then second tap + sprint
    _delay(function() {
      if (_playerTookControl) return;
      _showTapRing(_exitX, _exitY);
      if (_cursorEl) {
        _cursorEl.classList.add('tap-pulse');
      }

      // Switch to sprint
      if (typeof GoneRogueMovement !== 'undefined') {
        var collisionCheck = function(x, y) {
          if (typeof GoneRogue !== 'undefined' && GoneRogue.isWalkable) {
            return !GoneRogue.isWalkable(x, y);
          }
          return false;
        };
        GoneRogueMovement.setTarget(_exitX, _exitY, collisionCheck, true);
      }

      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.show('\u26A1 Double-tap to sprint!', 1400);  // was 2000
      }

      _delay(function() {
        _removeCursor();
      }, 500);  // was 800
    }, 250);  // was 350
  }

  // ── Phase 9 & 10: Floor 1 transition tooltips ─────────────────────

  /**
   * Called externally when a floor transition happens.
   * "SURVIVE" already fired on Floor 0 during the fishing walk.
   * Floor 1 gets: "ESCAPE.", "EVADE.", "RESIST.", "EXTRACT."
   * Uses TooltipSystem.showSequence so there's no "standing by" reset between words.
   */
  function onFloorTransition(newFloor, ctx) {
    if (newFloor !== 1) return;
    if (_floor1Hook) return;
    _floor1Hook = true;

    console.log('[Onboarding] Phase 9: Floor 1 transition tooltips');

    var words = ['ESCAPE.', 'EVADE.', 'RESIST.', 'EXTRACT.'];
    var wordDuration = 1200;   // was 1500 — 20% faster per word
    var gapBetween = 200;      // was 300 — tighter gaps

    // Delay start by 1s so the floor transition animation completes first
    setTimeout(function() {
      if (typeof TooltipSystem !== 'undefined' && TooltipSystem.showSequence) {
        TooltipSystem.showSequence(words, wordDuration, gapBetween, function(word, i) {
          // Fire overhead "!" with each word
          if (typeof OverheadAnimator !== 'undefined' && ctx) {
            OverheadAnimator.showGenericExpression(
              ctx.player.x, ctx.player.y,
              '\u2757', 1000, '#ff4444'
            );
          }
        });
      } else if (typeof TooltipSystem !== 'undefined') {
        // Fallback if showSequence not available
        words.forEach(function(word, i) {
          setTimeout(function() {
            TooltipSystem.show(word, wordDuration);
          }, i * (wordDuration + gapBetween));
        });
      }
    }, 1000);  // was 1500
  }

  // ── Path computation ──────────────────────────────────────────────
  function _computePath() {
    if (!_ctx) return;

    if (typeof GoneRogueMovement !== 'undefined' && GoneRogueMovement.findPath) {
      var collisionCheck = function(x, y) {
        if (typeof GoneRogue !== 'undefined' && GoneRogue.isWalkable) {
          return !GoneRogue.isWalkable(x, y);
        }
        return false;
      };
      _path = GoneRogueMovement.findPath(
        _ctx.player.x, _ctx.player.y,
        _exitX, _exitY,
        collisionCheck
      );
      console.log('[Onboarding] Path computed:', (_path ? _path.length : 0), 'waypoints');
    }

    if (!_path || _path.length === 0) {
      _path = [];
      var steps = Math.max(Math.abs(_exitX - _ctx.player.x), Math.abs(_exitY - _ctx.player.y));
      for (var i = 0; i <= steps; i++) {
        var t = steps > 0 ? i / steps : 1;
        _path.push({
          x: Math.round(_ctx.player.x + (_exitX - _ctx.player.x) * t),
          y: Math.round(_ctx.player.y + (_exitY - _ctx.player.y) * t)
        });
      }
    }
  }

  // ── Full cleanup ──────────────────────────────────────────────────
  function _cleanup() {
    _clearTimers();
    _removeCursor();
    _clearTrail();
    _unbindInputListener();

    if (typeof GoneRogueMobile !== 'undefined' && GoneRogueMobile.hideFishingPath) {
      GoneRogueMobile.hideFishingPath();
    }

    _active = false;
    console.log('[Onboarding] Tutorial complete');
  }

  // ── Public API ────────────────────────────────────────────────────

  function start(ctx) {
    if (!ctx || ctx.getFloor() !== 0) return;
    if (ctx.getDifficultyTier && ctx.getDifficultyTier() > 1) return;

    console.log('[Onboarding] Starting Pink Panther tutorial on Floor 0');
    _active = true;
    _playerTookControl = false;
    _phase = 0;
    _ctx = ctx;
    _floor1Hook = false;
    _surviveFired = false;

    _exitX = 20;
    _exitY = 17;

    _delay(function() {
      _bindInputListener();
      _phase1();
    }, 50);  // was 100
  }

  function isActive() {
    return _active;
  }

  function getPhase() {
    return _phase;
  }

  return {
    start: start,
    isActive: isActive,
    getPhase: getPhase,
    onFloorTransition: onFloorTransition
  };
})();
