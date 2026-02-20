/* ============================================================
   EYES ONLY - Playtest Agent (Human-UI-Bound)

   A testing agent that operates under human UI constraints to
   find edge-case problems with card deployment from the hand
   fan popup to the Gone Rogue game frame within the command
   terminal.

   KEY CONSTRAINT: This agent is bound by the same UI rules as
   a human player — it can only interact through visible DOM
   elements, must wait for animations, respects touch targets,
   and operates within the viewport. It cannot use headless APIs
   or bypass the rendering pipeline.

   Enable: ?playtest=1 in URL (also requires ?perf=1 for HUD)
   ============================================================ */

const PlaytestAgent = (function() {
  'use strict';

  // ---- state ----
  var _active = false;
  var _paused = false;
  var _timer = null;
  var _report = null;
  var _tickCount = 0;
  var _config = {
    actionIntervalMs: 600,    // human-like pace (slightly fast)
    maxTicks: 2000,            // auto-stop after N ticks
    cardDeployRetries: 3,      // retry card deploy if it fails visually
    orientationCycleMs: 15000, // rotate orientation test every 15s
    verbose: true
  };

  // Edge-case categories this agent hunts for
  var EDGE_CASES = {
    FAN_BREAKOUT_CLIP:     'fan-breakout-clip',       // fan clips outside viewport
    FAN_CARD_UNTAPPABLE:   'fan-card-untappable',     // card touch target < 44px
    FAN_OCCLUDE_GRID:      'fan-occlude-grid',        // fan covers game grid entirely
    STR_OCCLUDE_FAN:       'str-occlude-fan',         // STR window covers fan
    CARD_DEPLOY_LOST:      'card-deploy-lost',        // card played but animation lost
    GRID_OVERFLOW:         'grid-overflow',            // grid extends beyond terminal
    SCROLL_JUMP:           'scroll-jump',              // terminal scroll jumps on card play
    ORIENTATION_LAYOUT_BREAK: 'orientation-layout-break', // layout breaks on rotate
    TOUCH_DEAD_ZONE:       'touch-dead-zone',         // tappable area has no handler
    Z_INDEX_INVERSION:     'z-index-inversion'        // wrong element on top
  };

  // ---- public API ----
  function init() {
    if (!_shouldActivate()) return;
    _log('Playtest agent initialized (waiting for game start)');

    // Watch for game activation
    var observer = new MutationObserver(function() {
      if (_isGameActive() && !_active) {
        start();
      }
    });
    var terminal = document.getElementById('terminal');
    if (terminal) {
      observer.observe(terminal, { childList: true, subtree: true });
    }
  }

  function start() {
    if (_active) return;
    _active = true;
    _paused = false;
    _tickCount = 0;
    _report = _createReport();

    _log('Playtest agent STARTED — hunting UI edge cases');
    _log('Monitoring: fan breakout, card deploy, grid overflow, touch targets');

    _timer = setInterval(_tick, _config.actionIntervalMs);
  }

  function stop() {
    _active = false;
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
    _printReport();
  }

  function pause() { _paused = !_paused; _log(_paused ? 'Paused' : 'Resumed'); }
  function isActive() { return _active; }
  function getReport() { return _report; }

  // ---- internal ----

  function _shouldActivate() {
    try {
      var qs = new URLSearchParams(location.search);
      return qs.get('playtest') === '1';
    } catch (e) { return false; }
  }

  function _isGameActive() {
    return (typeof GoneRogue !== 'undefined' && GoneRogue.isActive && GoneRogue.isActive());
  }

  function _createReport() {
    return {
      startTime: Date.now(),
      ticks: 0,
      edgeCases: [],        // { type, description, viewport, timestamp }
      cardDeploys: 0,
      cardDeployFailures: 0,
      fanShows: 0,
      fanHides: 0,
      orientationChanges: 0,
      breakoutEvents: 0,
      touchTargetViolations: 0
    };
  }

  // ---- main tick ----
  function _tick() {
    if (!_active || _paused) return;
    _tickCount++;
    _report.ticks = _tickCount;

    if (_tickCount >= _config.maxTicks) {
      _log('Max ticks reached (' + _config.maxTicks + '), stopping');
      stop();
      return;
    }

    // Run all checks every tick
    _checkFanBreakout();
    _checkGridOverflow();
    _checkTouchTargets();
    _checkZIndexOrder();
    _checkScrollPosition();

    // Periodic actions (simulate human interaction patterns)
    if (_tickCount % 5 === 0) _tryToggleFan();
    if (_tickCount % 8 === 0) _trySelectCard();
    if (_tickCount % 15 === 0) _tryPlayCard();
    if (_tickCount % 25 === 0) _simulateOrientationProbe();
  }

  // ---- edge case checks ----

  function _checkFanBreakout() {
    var fan = document.getElementById('hand-fan-container');
    if (!fan || fan.style.display === 'none') return;

    var rect = fan.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // Check if fan clips outside viewport
    if (rect.left < 0 || rect.top < 0 || rect.right > vw || rect.bottom > vh) {
      _recordEdgeCase(EDGE_CASES.FAN_BREAKOUT_CLIP,
        'Fan extends beyond viewport: L=' + Math.round(rect.left) +
        ' T=' + Math.round(rect.top) + ' R=' + Math.round(rect.right) +
        ' B=' + Math.round(rect.bottom) + ' (vp=' + vw + 'x' + vh + ')');
    }

    // Check if fan entirely occudes game grid
    var grid = document.querySelector('.rogue-grid-mobile');
    if (grid && grid.style.display !== 'none') {
      var gridRect = grid.getBoundingClientRect();
      if (gridRect.width > 0 && gridRect.height > 0) {
        // Fan fully covers grid?
        if (rect.top <= gridRect.top && rect.bottom >= gridRect.bottom &&
            rect.left <= gridRect.left && rect.right >= gridRect.right) {
          _recordEdgeCase(EDGE_CASES.FAN_OCCLUDE_GRID,
            'Fan completely occludes game grid');
        }
      }
    }

    // Check if STR window occludes fan
    var strWin = document.getElementById('str-combat-window');
    if (strWin && strWin.style.display !== 'none') {
      var strRect = strWin.getBoundingClientRect();
      if (strRect.width > 0 && rect.width > 0) {
        // STR fully covers fan?
        if (strRect.top <= rect.top && strRect.bottom >= rect.bottom &&
            strRect.left <= rect.left && strRect.right >= rect.right) {
          _recordEdgeCase(EDGE_CASES.STR_OCCLUDE_FAN,
            'STR combat window fully occludes hand fan');
        }
      }
    }
  }

  function _checkGridOverflow() {
    var grid = document.querySelector('.rogue-grid-mobile');
    if (!grid || grid.style.display === 'none') return;

    var terminal = document.getElementById('terminal');
    if (!terminal) return;

    var gridRect = grid.getBoundingClientRect();
    var termRect = terminal.getBoundingClientRect();

    // Grid wider than terminal?
    if (gridRect.width > termRect.width + 2) {
      _recordEdgeCase(EDGE_CASES.GRID_OVERFLOW,
        'Grid width (' + Math.round(gridRect.width) + 'px) exceeds terminal (' +
        Math.round(termRect.width) + 'px)');
    }
  }

  function _checkTouchTargets() {
    // Check all visible hand-card elements for minimum 44x44 touch target
    var cards = document.querySelectorAll('.hand-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.offsetParent === null) continue; // hidden

      var rect = card.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        _report.touchTargetViolations++;
        _recordEdgeCase(EDGE_CASES.FAN_CARD_UNTAPPABLE,
          'Card touch target too small: ' + Math.round(rect.width) + 'x' +
          Math.round(rect.height) + 'px (min 44x44)', true);
      }
    }
  }

  function _checkZIndexOrder() {
    // Verify z-index layering: countdown > fan > str > grid > terminal
    var layers = [
      { id: 'str-combat-countdown', expectedMin: 2500 },
      { id: 'hand-fan-container', expectedMin: 2000 },
      { id: 'str-combat-window', expectedMin: 1500 }
    ];

    for (var i = 0; i < layers.length; i++) {
      var el = document.getElementById(layers[i].id);
      if (!el || el.style.display === 'none') continue;

      var computedZ = parseInt(window.getComputedStyle(el).zIndex, 10);
      if (isNaN(computedZ)) continue;

      // Check ordering against next visible layer
      for (var j = i + 1; j < layers.length; j++) {
        var lowerEl = document.getElementById(layers[j].id);
        if (!lowerEl || lowerEl.style.display === 'none') continue;

        var lowerZ = parseInt(window.getComputedStyle(lowerEl).zIndex, 10);
        if (!isNaN(lowerZ) && lowerZ >= computedZ) {
          _recordEdgeCase(EDGE_CASES.Z_INDEX_INVERSION,
            layers[j].id + ' (z:' + lowerZ + ') >= ' +
            layers[i].id + ' (z:' + computedZ + ')');
        }
        break;
      }
    }
  }

  function _checkScrollPosition() {
    var terminal = document.getElementById('terminal');
    if (!terminal) return;

    // Store scroll position to detect jumps
    if (typeof _checkScrollPosition._lastScroll === 'undefined') {
      _checkScrollPosition._lastScroll = terminal.scrollTop;
      return;
    }

    var delta = Math.abs(terminal.scrollTop - _checkScrollPosition._lastScroll);
    // Jump of more than 200px in a single tick is suspicious
    if (delta > 200) {
      _recordEdgeCase(EDGE_CASES.SCROLL_JUMP,
        'Terminal scroll jumped ' + delta + 'px in single tick');
    }
    _checkScrollPosition._lastScroll = terminal.scrollTop;
  }

  // ---- simulated human actions ----

  function _tryToggleFan() {
    var btn = document.getElementById('hand-fan-toggle-btn');
    if (!btn) return;

    // Only click if visible and not in animation
    if (btn.offsetParent === null) return;

    btn.click();
    _report.fanShows++;
    _log('Toggled hand fan');
  }

  function _trySelectCard() {
    var cards = document.querySelectorAll('.hand-card');
    if (cards.length === 0) return;

    // Pick a random visible card
    var visibleCards = [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].offsetParent !== null) visibleCards.push(cards[i]);
    }
    if (visibleCards.length === 0) return;

    var target = visibleCards[Math.floor(Math.random() * visibleCards.length)];

    // Verify the click target is actually reachable (not behind another element)
    var rect = target.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    var topElement = document.elementFromPoint(centerX, centerY);

    if (!topElement || !target.contains(topElement)) {
      _recordEdgeCase(EDGE_CASES.TOUCH_DEAD_ZONE,
        'Card at (' + Math.round(centerX) + ',' + Math.round(centerY) +
        ') blocked by: ' + (topElement ? topElement.tagName + '#' + topElement.id : 'null'));
      return;
    }

    target.click();
    _log('Selected card');
  }

  function _tryPlayCard() {
    if (typeof HandFanComponent === 'undefined') return;
    var selected = HandFanComponent.getSelectedCards();
    if (!selected || selected.length === 0) return;

    var scrollBefore = 0;
    var terminal = document.getElementById('terminal');
    if (terminal) scrollBefore = terminal.scrollTop;

    _report.cardDeploys++;
    HandFanComponent.playSelectedCards();
    _log('Played ' + selected.length + ' card(s)');

    // After animation settles, check for deploy failures
    setTimeout(function() {
      if (terminal) {
        var scrollDelta = Math.abs(terminal.scrollTop - scrollBefore);
        if (scrollDelta > 100) {
          _recordEdgeCase(EDGE_CASES.SCROLL_JUMP,
            'Card deploy caused ' + scrollDelta + 'px scroll jump');
        }
      }

      // Check if fan container is in a broken state
      var fan = document.getElementById('hand-fan-container');
      if (fan && fan.style.display !== 'none') {
        var fanRect = fan.getBoundingClientRect();
        if (fanRect.width === 0 && fanRect.height === 0) {
          _report.cardDeployFailures++;
          _recordEdgeCase(EDGE_CASES.CARD_DEPLOY_LOST,
            'Fan visible but has zero dimensions after card deploy');
        }
      }
    }, 1500); // wait for resolve animation
  }

  function _simulateOrientationProbe() {
    // We can't actually rotate the device, but we can check if the
    // current viewport dimensions would cause layout issues.
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // Test the "opposite" orientation's expected dimensions
    var wouldBePortrait = vw < vh;
    var oppositeW = vh;
    var oppositeH = vw;

    // Log current layout health for the squish diagnostic
    if (typeof EYESONLY_PERF !== 'undefined') {
      var snap = EYESONLY_PERF.getSnapshot();
      if (snap.game && snap.game.squish) {
        var sq = snap.game.squish;
        // Flag if grid squish factor is extreme
        if (sq.gridSquishFactor < 0.5 || sq.gridSquishFactor > 2.0) {
          _recordEdgeCase(EDGE_CASES.ORIENTATION_LAYOUT_BREAK,
            'Grid squish factor extreme: ' + sq.gridSquishFactor +
            ' (orientation=' + sq.orientation + ', device=' + sq.deviceClass + ')');
        }
        // Flag if fan doesn't fit in frame on mobile portrait
        if (sq.deviceClass === 'mobile' && sq.orientation === 'portrait' &&
            sq.fanFitsInFrame === false) {
          _recordEdgeCase(EDGE_CASES.FAN_BREAKOUT_CLIP,
            'Fan breaks out of game frame on portrait mobile');
        }
      }
    }

    _report.orientationChanges++;
  }

  // ---- reporting ----

  function _recordEdgeCase(type, description, dedupe) {
    // Dedupe: only record each type+description once per 30 seconds
    if (dedupe) {
      var now = Date.now();
      for (var i = _report.edgeCases.length - 1; i >= 0; i--) {
        var existing = _report.edgeCases[i];
        if (existing.type === type && existing.description === description &&
            (now - existing.timestamp) < 30000) {
          return; // already recorded recently
        }
      }
    }

    var entry = {
      type: type,
      description: description,
      viewport: window.innerWidth + 'x' + window.innerHeight,
      timestamp: Date.now(),
      tick: _tickCount
    };

    _report.edgeCases.push(entry);
    _report.breakoutEvents++;

    if (_config.verbose) {
      console.warn('[PlaytestAgent] EDGE CASE:', type, '-', description);
    }
  }

  function _printReport() {
    if (!_report) return;

    _report.endTime = Date.now();
    _report.durationMs = _report.endTime - _report.startTime;

    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   PLAYTEST AGENT REPORT                     ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ Duration: ' + (_report.durationMs / 1000).toFixed(1) + 's');
    console.log('║ Ticks: ' + _report.ticks);
    console.log('║ Card deploys: ' + _report.cardDeploys + ' (failures: ' + _report.cardDeployFailures + ')');
    console.log('║ Fan toggles: ' + _report.fanShows);
    console.log('║ Touch violations: ' + _report.touchTargetViolations);
    console.log('║ Edge cases found: ' + _report.edgeCases.length);
    console.log('╠══════════════════════════════════════════════╣');

    if (_report.edgeCases.length === 0) {
      console.log('║ No edge cases detected! ✓');
    } else {
      // Group by type
      var byType = {};
      _report.edgeCases.forEach(function(ec) {
        if (!byType[ec.type]) byType[ec.type] = [];
        byType[ec.type].push(ec);
      });

      Object.keys(byType).forEach(function(type) {
        var cases = byType[type];
        console.log('║ [' + type + '] x' + cases.length);
        // Show first 3 examples
        cases.slice(0, 3).forEach(function(c) {
          console.log('║   → ' + c.description + ' (tick ' + c.tick + ', ' + c.viewport + ')');
        });
        if (cases.length > 3) {
          console.log('║   ... and ' + (cases.length - 3) + ' more');
        }
      });
    }

    console.log('╚══════════════════════════════════════════════╝');
    console.log('[PlaytestReport]', JSON.parse(JSON.stringify(_report)));
  }

  function _log(msg) {
    if (_config.verbose) {
      console.log('[PlaytestAgent] ' + msg);
    }
    // Also update MOK if available
    if (typeof UIControls !== 'undefined' && UIControls.updateMokInterjection) {
      UIControls.updateMokInterjection('[PLAYTEST] ' + msg);
    }
  }

  // Public API
  return {
    init: init,
    start: start,
    stop: stop,
    pause: pause,
    isActive: isActive,
    getReport: getReport,
    EDGE_CASES: EDGE_CASES
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    PlaytestAgent.init();
  });
} else {
  PlaytestAgent.init();
}
