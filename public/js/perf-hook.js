/* ============================================================
   EYES ONLY - Local Perf Hook (dev-only, zero deps)

   Purpose:
   - Give developers a simple, always-available perf overlay + logging
   - Similar spirit to “open DevTools (F12) and see what’s slow”, but
     with a lightweight on-screen HUD for mobile + quick console dumps.

   Enable:
   - Add `?perf=1` to URL, OR
   - `localStorage.EYESONLY_PERF = '1'`

   Disable:
   - Remove query param and clear localStorage key.
   ============================================================ */

(function PerfHook() {
  'use strict';

  function enabled() {
    try {
      var qs = new URLSearchParams(location.search);
      if (qs.get('perf') === '1') return true;
      return localStorage.getItem('EYESONLY_PERF') === '1';
    } catch (e) {
      return false;
    }
  }

  // Only run on localhost/loopback unless explicitly forced
  function isLocalHost() {
    return (
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '0.0.0.0'
    );
  }

  if (!enabled() && !isLocalHost()) return;

  // If local host, allow `?perf=0` to force-disable
  try {
    var qs0 = new URLSearchParams(location.search);
    if (qs0.get('perf') === '0') return;
  } catch (e0) {}

  var state = {
    startMs: performance.now(),
    frames: 0,
    fps: 0,
    fpsMin: Infinity,
    fpsMax: 0,
    lastFpsSampleMs: performance.now(),
    lastFrameMs: performance.now(),
    longTasks: 0,
    longTaskMsTotal: 0,
    longTaskMsMax: 0,
    resources: 0,
    resourceMsTotal: 0,
    largestResourceMs: 0,
    lastPaintMs: null,
    lastLcpMs: null,
    errors: 0,

    // Game-specific timers (populated by instrumentation hooks)
    game: {
      last: {},
      avg: {},
      max: {},
      n: {},
      ui: {
        terminalRect: null,
        rogueRect: null,
        strRect: null,
        fanRect: null,
        breakout: null,
        // CSS/JS relationship tracking
        fanOverlap: null,       // how much fan bleeds outside game frame
        strOverlap: null,       // how much STR window bleeds outside game frame
        gameFrameRect: null,    // #log-column (actual game viewport)
        crtFrameRect: null,     // #crt-frame (command terminal shell)
        viewportMode: null      // 'portrait-mobile' | 'landscape-desktop' | 'landscape-mobile' | 'portrait-tablet'
      },
      // Squish diagnostics: portrait vs landscape layout health
      squish: {
        viewportW: 0,
        viewportH: 0,
        orientation: null,      // 'portrait' | 'landscape'
        deviceClass: null,      // 'mobile' | 'tablet' | 'desktop'
        gameFrameRatio: 0,      // game frame height / viewport height
        fanFitsInFrame: null,   // does hand fan fit within game frame bounds?
        cardScale: null,        // effective card px width vs baseline 120px
        terminalScrollable: null, // is terminal scrolling behind game grid?
        gridSquishFactor: 0     // effective cell px / baseline cell px
      }
    }
  };

  // ---------- Observers ----------
  try {
    if ('PerformanceObserver' in window) {
      // Long tasks (main thread stalls)
      if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.indexOf('longtask') !== -1) {
        new PerformanceObserver(function(list) {
          var entries = list.getEntries();
          for (var i = 0; i < entries.length; i++) {
            var d = entries[i].duration || 0;
            state.longTasks++;
            state.longTaskMsTotal += d;
            if (d > state.longTaskMsMax) state.longTaskMsMax = d;
          }
        }).observe({ type: 'longtask', buffered: true });
      }

      // Paint
      if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.indexOf('paint') !== -1) {
        new PerformanceObserver(function(list) {
          var entries = list.getEntries();
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].name === 'first-contentful-paint') {
              state.lastPaintMs = entries[i].startTime;
            }
          }
        }).observe({ type: 'paint', buffered: true });
      }

      // LCP
      if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.indexOf('largest-contentful-paint') !== -1) {
        new PerformanceObserver(function(list) {
          var entries = list.getEntries();
          if (entries && entries.length) {
            state.lastLcpMs = entries[entries.length - 1].startTime;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      }

      // Resources (rough load cost)
      if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.indexOf('resource') !== -1) {
        new PerformanceObserver(function(list) {
          var entries = list.getEntries();
          for (var i = 0; i < entries.length; i++) {
            var dur = entries[i].duration || 0;
            state.resources++;
            state.resourceMsTotal += dur;
            if (dur > state.largestResourceMs) state.largestResourceMs = dur;
          }
        }).observe({ type: 'resource', buffered: true });
      }
    }
  } catch (e1) {
    // ignore
  }

  window.addEventListener('error', function() { state.errors++; });
  window.addEventListener('unhandledrejection', function() { state.errors++; });

  function _rectOf(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x), y: Math.round(r.y),
      w: Math.round(r.width), h: Math.round(r.height),
      visible: (r.width > 0 && r.height > 0)
    };
  }

  function _sampleBreakoutGeometry() {
    var t0 = performance.now();

    // Relationships we care about:
    // - Gone Rogue game surface inside the command terminal
    // - STR combat window breaks out into surrounding UI
    // - Hand fan component breaks out too
    // (Implementation note: these overlays are appended to body)

    state.game.ui.terminalRect = _rectOf('terminal');
    state.game.ui.gameFrameRect = _rectOf('log-column');
    state.game.ui.crtFrameRect = _rectOf('crt-frame');
    // Rogue surface might be canvas or grid; attempt common ids
    state.game.ui.rogueRect = _rectOf('gone-rogue-canvas') || _rectOf('gone-rogue-grid') || _rectOf('gone-rogue');
    state.game.ui.strRect = _rectOf('str-combat-window');
    state.game.ui.fanRect = _rectOf('hand-fan-container');

    // Simple breakout heuristic: if overlay rect exists and terminal rect exists,
    // report whether it extends beyond terminal bounds.
    function breakout(overlay, container) {
      if (!overlay || !container || !overlay.visible) return null;
      return {
        left: overlay.x < container.x,
        right: (overlay.x + overlay.w) > (container.x + container.w),
        top: overlay.y < container.y,
        bottom: (overlay.y + overlay.h) > (container.y + container.h)
      };
    }

    // Pixel overlap calculation (how many px the overlay bleeds past container)
    function overlapPx(overlay, container) {
      if (!overlay || !container || !overlay.visible) return null;
      return {
        left: Math.max(0, container.x - overlay.x),
        right: Math.max(0, (overlay.x + overlay.w) - (container.x + container.w)),
        top: Math.max(0, container.y - overlay.y),
        bottom: Math.max(0, (overlay.y + overlay.h) - (container.y + container.h)),
        totalPx: 0 // filled below
      };
    }

    state.game.ui.breakout = {
      str: breakout(state.game.ui.strRect, state.game.ui.terminalRect),
      fan: breakout(state.game.ui.fanRect, state.game.ui.terminalRect)
    };

    // CSS/JS relationship: measure fan & STR overlap with the game frame
    var gameFrame = state.game.ui.gameFrameRect || state.game.ui.terminalRect;
    state.game.ui.fanOverlap = overlapPx(state.game.ui.fanRect, gameFrame);
    state.game.ui.strOverlap = overlapPx(state.game.ui.strRect, gameFrame);
    if (state.game.ui.fanOverlap) {
      var fo = state.game.ui.fanOverlap;
      fo.totalPx = fo.left + fo.right + fo.top + fo.bottom;
    }
    if (state.game.ui.strOverlap) {
      var so = state.game.ui.strOverlap;
      so.totalPx = so.left + so.right + so.top + so.bottom;
    }

    // Viewport / orientation / squish diagnostics
    _sampleSquishDiagnostics(gameFrame);

    // Detect viewport mode
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var isPortrait = vh > vw;
    if (vw <= 480) {
      state.game.ui.viewportMode = isPortrait ? 'portrait-mobile' : 'landscape-mobile';
    } else if (vw <= 768) {
      state.game.ui.viewportMode = isPortrait ? 'portrait-tablet' : 'landscape-tablet';
    } else {
      state.game.ui.viewportMode = isPortrait ? 'portrait-desktop' : 'landscape-desktop';
    }

    var t1 = performance.now();
    _accumMetric('css.breakoutSampleMs', (t1 - t0));
  }

  /**
   * Squish diagnostics: portrait mobile vs desktop landscape transition health
   * Measures how well the game frame, cards, and grid adapt to viewport shape
   */
  function _sampleSquishDiagnostics(gameFrame) {
    var sq = state.game.squish;
    sq.viewportW = window.innerWidth;
    sq.viewportH = window.innerHeight;
    sq.orientation = (sq.viewportH > sq.viewportW) ? 'portrait' : 'landscape';

    if (sq.viewportW <= 480) sq.deviceClass = 'mobile';
    else if (sq.viewportW <= 768) sq.deviceClass = 'tablet';
    else sq.deviceClass = 'desktop';

    // Game frame ratio: how much of viewport height the game area consumes
    if (gameFrame && gameFrame.visible) {
      sq.gameFrameRatio = +(gameFrame.h / sq.viewportH).toFixed(3);
    }

    // Card scale relative to baseline 120px (desktop combat card width)
    var sampleCard = document.querySelector('.hand-card');
    if (sampleCard) {
      var cardRect = sampleCard.getBoundingClientRect();
      sq.cardScale = +(cardRect.width / 120).toFixed(3);
    }

    // Does hand fan fit within game frame?
    var fan = state.game.ui.fanRect;
    if (fan && fan.visible && gameFrame && gameFrame.visible) {
      sq.fanFitsInFrame = (
        fan.x >= gameFrame.x &&
        fan.y >= gameFrame.y &&
        (fan.x + fan.w) <= (gameFrame.x + gameFrame.w) &&
        (fan.y + fan.h) <= (gameFrame.y + gameFrame.h)
      );
    } else {
      sq.fanFitsInFrame = null;
    }

    // Is terminal scrollable (content overflows)?
    var terminal = document.getElementById('terminal');
    if (terminal) {
      sq.terminalScrollable = terminal.scrollHeight > terminal.clientHeight;
    }

    // Grid cell squish factor: effective cell size vs baseline 14px
    var sampleCell = document.querySelector('.rogue-cell');
    if (sampleCell) {
      var cellRect = sampleCell.getBoundingClientRect();
      sq.gridSquishFactor = +(cellRect.width / 14).toFixed(3);
    }
  }

  var _lastBreakoutSampleMs = 0;

  // ---------- FPS sampler ----------
  function tick() {
    state.frames++;
    var now = performance.now();
    var dt = now - state.lastFrameMs;
    state.lastFrameMs = now;

    // sample every ~500ms
    var sampleWindow = now - state.lastFpsSampleMs;
    if (sampleWindow >= 500) {
      var fps = Math.round((state.frames * 1000) / sampleWindow);
      state.fps = fps;
      if (fps < state.fpsMin) state.fpsMin = fps;
      if (fps > state.fpsMax) state.fpsMax = fps;
      state.frames = 0;
      state.lastFpsSampleMs = now;

      // sample breakout geometry a bit slower (layout reads)
      if ((now - _lastBreakoutSampleMs) > 1000) {
        _sampleBreakoutGeometry();
        _lastBreakoutSampleMs = now;
      }

      renderHud();
    }

    requestAnimationFrame(tick);
  }

  // ---------- HUD ----------
  var hud = document.createElement('div');
  hud.id = 'eyesonly-perf-hud';
  hud.style.cssText = [
    'position:fixed',
    'right:8px',
    'bottom:8px',
    'z-index:99999',
    'padding:8px 10px',
    'background:rgba(0,0,0,0.72)',
    'border:1px solid rgba(33,255,144,0.55)',
    'border-radius:6px',
    'color:#21ff90',
    'font:12px/1.2 monospace',
    'max-width:280px',
    'pointer-events:auto'
  ].join(';');

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'dump';
  btn.style.cssText = [
    'margin-top:6px',
    'padding:2px 6px',
    'font:12px monospace',
    'background:rgba(33,255,144,0.12)',
    'color:#21ff90',
    'border:1px solid rgba(33,255,144,0.5)',
    'border-radius:4px',
    'cursor:pointer'
  ].join(';');

  btn.addEventListener('click', function() {
    // concise one-liner in console; useful when recording devtools performance
    console.log('[PerfDump]', getSnapshot());
  });

  hud.appendChild(document.createElement('div'));
  hud.appendChild(btn);

  function renderHud() {
    var snap = getSnapshot();
    var lines = [];
    lines.push('FPS: ' + snap.fps + ' (min ' + snap.fpsMin + ', max ' + snap.fpsMax + ')');

    // Game loop hot spots (if instrumented)
    if (snap.game && snap.game.avg) {
      if (snap.game.avg['rogue.renderGridMs'] != null) {
        lines.push('Rogue render: ' + snap.game.avg['rogue.renderGridMs'].toFixed(2) + 'ms');
      }
      if (snap.game.avg['rogue.gameTickMs'] != null) {
        lines.push('Game tick: ' + snap.game.avg['rogue.gameTickMs'].toFixed(2) + 'ms');
      }
      if (snap.game.avg['lighting.updateLightMapMs'] != null) {
        lines.push('LightMap: ' + snap.game.avg['lighting.updateLightMapMs'].toFixed(2) + 'ms');
      }
      if (snap.game.avg['rogue.enemyPathMs'] != null) {
        lines.push('Enemy path: ' + snap.game.avg['rogue.enemyPathMs'].toFixed(2) + 'ms');
      }
      if (snap.game.avg['css.breakoutSampleMs'] != null) {
        lines.push('UI geom chk: ' + snap.game.avg['css.breakoutSampleMs'].toFixed(2) + 'ms');
      }
      // Hand fan metrics
      if (snap.game.avg['fan.renderMs'] != null) {
        lines.push('Fan render: ' + snap.game.avg['fan.renderMs'].toFixed(2) + 'ms');
      }
      if (snap.game.avg['fan.transformMs'] != null) {
        lines.push('Fan xform: ' + snap.game.avg['fan.transformMs'].toFixed(2) + 'ms');
      }
      // STR combat window metrics
      if (snap.game.avg['str.renderWindowMs'] != null) {
        lines.push('STR render: ' + snap.game.avg['str.renderWindowMs'].toFixed(2) + 'ms');
      }
    }

    // CSS/JS breakout status line
    var ui = snap.game && snap.game.ui;
    if (ui) {
      var breakoutParts = [];
      if (ui.fanOverlap && ui.fanOverlap.totalPx > 0) {
        breakoutParts.push('Fan:' + ui.fanOverlap.totalPx + 'px');
      }
      if (ui.strOverlap && ui.strOverlap.totalPx > 0) {
        breakoutParts.push('STR:' + ui.strOverlap.totalPx + 'px');
      }
      if (breakoutParts.length > 0) {
        lines.push('Breakout: ' + breakoutParts.join(' '));
      }
      if (ui.viewportMode) {
        lines.push('Mode: ' + ui.viewportMode);
      }
    }

    // Squish diagnostics
    var sq = snap.game && snap.game.squish;
    if (sq && sq.viewportW > 0) {
      lines.push('Squish: ' + sq.viewportW + 'x' + sq.viewportH + ' ' + (sq.orientation || '?'));
      if (sq.gridSquishFactor > 0) {
        lines.push('  grid:' + sq.gridSquishFactor + 'x card:' + (sq.cardScale || '?') + 'x');
      }
      if (sq.fanFitsInFrame === false) {
        lines.push('  !! FAN OUTSIDE FRAME');
      }
    }

    lines.push('LongTasks: ' + snap.longTasks + ' (max ' + snap.longTaskMsMax + 'ms)');
    lines.push('Errors: ' + snap.errors);
    if (snap.lcpMs != null) lines.push('LCP: ' + Math.round(snap.lcpMs) + 'ms');
    if (snap.fcpMs != null) lines.push('FCP: ' + Math.round(snap.fcpMs) + 'ms');

    hud.firstChild.textContent = lines.join('\n');
  }

  function getSnapshot() {
    return {
      tMs: Math.round(performance.now() - state.startMs),
      fps: state.fps,
      fpsMin: (state.fpsMin === Infinity ? state.fps : state.fpsMin),
      fpsMax: state.fpsMax,
      longTasks: state.longTasks,
      longTaskMsTotal: Math.round(state.longTaskMsTotal),
      longTaskMsMax: Math.round(state.longTaskMsMax),
      resources: state.resources,
      resourceMsTotal: Math.round(state.resourceMsTotal),
      largestResourceMs: Math.round(state.largestResourceMs),
      fcpMs: state.lastPaintMs,
      lcpMs: state.lastLcpMs,
      errors: state.errors,
      game: {
        last: state.game.last,
        avg: state.game.avg,
        max: state.game.max,
        n: state.game.n,
        ui: state.game.ui,
        squish: state.game.squish
      }
    };
  }

  function _accumMetric(name, ms) {
    if (typeof ms !== 'number' || !isFinite(ms)) return;

    state.game.last[name] = ms;
    state.game.n[name] = (state.game.n[name] || 0) + 1;

    // EWMA average (stable, low overhead)
    var prev = state.game.avg[name];
    if (typeof prev !== 'number') {
      state.game.avg[name] = ms;
    } else {
      state.game.avg[name] = prev * 0.9 + ms * 0.1;
    }

    var prevMax = state.game.max[name];
    if (typeof prevMax !== 'number' || ms > prevMax) state.game.max[name] = ms;
  }

  // Expose a stable handle for scripts/tests + in-engine instrumentation
  window.EYESONLY_PERF = {
    getSnapshot: getSnapshot,
    dump: function() { console.log('[PerfDump]', getSnapshot()); },
    enable: function() { try { localStorage.setItem('EYESONLY_PERF', '1'); } catch (e) {} },
    disable: function() { try { localStorage.removeItem('EYESONLY_PERF'); } catch (e) {} },

    // Instrumentation API
    mark: function(name, ms) { _accumMetric(String(name || 'unknown'), ms); },

    // Utility: time a function (keeps overhead low)
    time: function(name, fn) {
      if (typeof fn !== 'function') return;
      var t0 = performance.now();
      var out = fn();
      var t1 = performance.now();
      _accumMetric(String(name || 'unknown'), (t1 - t0));
      return out;
    }
  };

  // Attach HUD after DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(hud);
      renderHud();
      requestAnimationFrame(tick);
    });
  } else {
    document.body.appendChild(hud);
    renderHud();
    requestAnimationFrame(tick);
  }
})();
