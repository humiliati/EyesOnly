/**
 * GameLoop — requestAnimationFrame game loop: start, stop, pause, tick.
 * Extracted Phase 26 from gone-rogue.js.
 *
 * Owns loop state (_gameLoopActive, _animationFrameId, _lastTickTime)
 * so the monolith no longer needs these closure variables.
 */
var GameLoop = (function() {
  'use strict';

  // ── Loop state (owned by this module) ──
  var _gameLoopActive = false;
  var _animationFrameId = null;
  var _lastTickTime = 0;
  var _tickInterval = 100; // ms between ticks (10 fps)

  // Callback for game state update — set via init()
  var _updateGameState = null;
  // Callbacks to reset per-loop counters
  var _onStart = null;

  /**
   * Initialise the game loop with callbacks.
   * @param {Object} opts
   * @param {Function} opts.updateGameState - Called each tick with deltaMs
   * @param {Function} [opts.onStart] - Called when loop starts (reset counters)
   * @param {number}   [opts.tickInterval] - ms between ticks (default 100)
   */
  function init(opts) {
    _updateGameState = opts.updateGameState;
    _onStart = opts.onStart || null;
    if (opts.tickInterval) _tickInterval = opts.tickInterval;
  }

  /**
   * Start the game loop (idempotent — does nothing if already running).
   */
  function start() {
    if (_gameLoopActive) return;
    _gameLoopActive = true;
    _lastTickTime = Date.now();
    if (_onStart) _onStart();
    _tick();
  }

  /**
   * Stop the game loop and cancel any pending animation frame.
   */
  function stop() {
    _gameLoopActive = false;
    if (_animationFrameId) {
      cancelAnimationFrame(_animationFrameId);
      _animationFrameId = null;
    }
  }

  /**
   * Pause the game loop (alias for stop, keeps state intact).
   */
  function pause() {
    stop();
  }

  /**
   * Check if the game loop is currently running.
   * @returns {boolean}
   */
  function isRunning() {
    return _gameLoopActive;
  }

  /**
   * Internal tick — called via requestAnimationFrame.
   */
  function _tick() {
    if (!_gameLoopActive) return;

    try {
      var now = Date.now();
      var delta = now - _lastTickTime;

      // Process game updates if enough time has passed
      if (delta >= _tickInterval) {
        var _t0 = (typeof EYESONLY_PERF !== 'undefined') ? performance.now() : 0;
        if (_updateGameState) _updateGameState(delta);
        if (_t0 && typeof EYESONLY_PERF !== 'undefined') {
          EYESONLY_PERF.mark('rogue.gameTickMs', performance.now() - _t0);
        }
        _lastTickTime = now;
      }
    } catch (e) {
      // Keep the loop alive even if an update throws, so the world doesn't hard-freeze.
      try { console.error('[GoneRogue] game loop tick error:', e); } catch (e2) {}
    }

    // Schedule next tick
    _animationFrameId = requestAnimationFrame(_tick);
  }

  return {
    init: init,
    start: start,
    stop: stop,
    pause: pause,
    isRunning: isRunning
  };
})();
