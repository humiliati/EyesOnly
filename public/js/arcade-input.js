/**
 * arcade-input.js — Unified Touch / Keyboard / Pointer Input Layer
 *
 * Provides gesture recognition for all arcade minigames:
 *   - Tap        (<200ms, <10px movement)   → discrete action
 *   - Swipe      (>30px in <300ms)          → directional input
 *   - Drag       (sustained >200ms)         → continuous position
 *   - Double-tap (two taps <300ms apart)    → secondary action
 *   - Long-press (held >500ms)              → flag / pause
 *   - Keyboard   (arrows, WASD, space)      → mapped to same events
 *   - Pointer    (mouse fallback)           → mapped to drag/tap
 *
 * USAGE:
 *   var input = new ArcadeInput(canvasElement);
 *   input.on('tap',       function(e) { // e.x, e.y (canvas-relative) });
 *   input.on('swipe',     function(e) { // e.direction: 'up'|'down'|'left'|'right', e.velocity });
 *   input.on('drag',      function(e) { // e.x, e.y, e.dx, e.dy });
 *   input.on('dragstart', function(e) { // e.x, e.y });
 *   input.on('dragend',   function(e) { // e.x, e.y });
 *   input.on('doubletap', function(e) { // e.x, e.y });
 *   input.on('longpress', function(e) { // e.x, e.y });
 *   input.on('keyaction', function(e) { // e.action: 'up'|'down'|'left'|'right'|'action'|'secondary' });
 *   input.destroy();
 *
 * All coordinates are canvas-relative (0,0 at top-left of canvas).
 */
var ArcadeInput = (function () {
  'use strict';

  // ── Gesture thresholds ──
  var TAP_MAX_TIME = 200;       // ms
  var TAP_MAX_DIST = 10;        // px
  var SWIPE_MIN_DIST = 30;      // px
  var SWIPE_MAX_TIME = 300;     // ms
  var DRAG_MIN_TIME = 200;      // ms
  var DOUBLE_TAP_WINDOW = 300;  // ms
  var LONG_PRESS_TIME = 500;    // ms

  // ── Keyboard → action mapping ──
  var KEY_MAP = {
    ArrowUp:    'up',
    ArrowDown:  'down',
    ArrowLeft:  'left',
    ArrowRight: 'right',
    KeyW:       'up',
    KeyS:       'down',
    KeyA:       'left',
    KeyD:       'right',
    Space:      'action',
    Enter:      'action',
    ShiftLeft:  'secondary',
    ShiftRight: 'secondary'
  };

  /**
   * @constructor
   * @param {HTMLCanvasElement} canvas — the game canvas
   */
  function ArcadeInput(canvas) {
    this._canvas = canvas;
    this._listeners = {};
    this._destroyed = false;

    // ── Touch tracking state ──
    this._touchId = null;          // active touch identifier
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchStartTime = 0;
    this._touchMoved = false;
    this._touchDragging = false;
    this._lastTapTime = 0;
    this._lastTapX = 0;
    this._lastTapY = 0;
    this._longPressTimer = null;
    this._dragCheckTimer = null;

    // ── Mouse tracking state ──
    this._mouseDown = false;
    this._mouseStartX = 0;
    this._mouseStartY = 0;
    this._mouseStartTime = 0;
    this._mouseDragging = false;

    // ── Held keys (for polling) ──
    this._keysHeld = {};

    // ── Bind handlers (store refs for cleanup) ──
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);
    this._onTouchCancel = this._handleTouchCancel.bind(this);
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onContextMenu = function (e) { e.preventDefault(); };

    // ── Attach ──
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this._onTouchCancel, { passive: false });
    canvas.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  // ── Event emitter ──

  ArcadeInput.prototype.on = function (event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return this;
  };

  ArcadeInput.prototype.off = function (event, fn) {
    var list = this._listeners[event];
    if (!list) return this;
    if (!fn) { this._listeners[event] = []; return this; }
    this._listeners[event] = list.filter(function (f) { return f !== fn; });
    return this;
  };

  ArcadeInput.prototype._emit = function (event, data) {
    var list = this._listeners[event];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      try { list[i](data); } catch (_) {}
    }
  };

  // ── Canvas-relative coordinates ──

  ArcadeInput.prototype._canvasXY = function (clientX, clientY) {
    var rect = this._canvas.getBoundingClientRect();
    var scaleX = this._canvas.width / rect.width;
    var scaleY = this._canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // ── Touch handlers ──

  ArcadeInput.prototype._handleTouchStart = function (e) {
    if (this._destroyed) return;
    // Only track first finger
    if (this._touchId !== null) return;

    var touch = e.changedTouches[0];
    this._touchId = touch.identifier;
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
    this._touchStartTime = Date.now();
    this._touchMoved = false;
    this._touchDragging = false;

    e.preventDefault();

    var self = this;

    // Long-press timer
    this._longPressTimer = setTimeout(function () {
      if (self._touchId !== null && !self._touchMoved) {
        var pos = self._canvasXY(self._touchStartX, self._touchStartY);
        self._emit('longpress', pos);
        self._touchId = null; // consume the touch
      }
    }, LONG_PRESS_TIME);

    // Drag detection timer
    this._dragCheckTimer = setTimeout(function () {
      if (self._touchId !== null && self._touchMoved) {
        self._touchDragging = true;
        var pos = self._canvasXY(self._touchStartX, self._touchStartY);
        self._emit('dragstart', pos);
      }
    }, DRAG_MIN_TIME);
  };

  ArcadeInput.prototype._handleTouchMove = function (e) {
    if (this._destroyed || this._touchId === null) return;

    var touch = this._findTouch(e.changedTouches, this._touchId);
    if (!touch) return;

    e.preventDefault();

    var dx = touch.clientX - this._touchStartX;
    var dy = touch.clientY - this._touchStartY;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > TAP_MAX_DIST) {
      this._touchMoved = true;
      clearTimeout(this._longPressTimer);
    }

    if (this._touchDragging) {
      var pos = this._canvasXY(touch.clientX, touch.clientY);
      pos.dx = dx;
      pos.dy = dy;
      this._emit('drag', pos);
    }
  };

  ArcadeInput.prototype._handleTouchEnd = function (e) {
    if (this._destroyed || this._touchId === null) return;

    var touch = this._findTouch(e.changedTouches, this._touchId);
    if (!touch) return;

    e.preventDefault();
    clearTimeout(this._longPressTimer);
    clearTimeout(this._dragCheckTimer);

    var elapsed = Date.now() - this._touchStartTime;
    var dx = touch.clientX - this._touchStartX;
    var dy = touch.clientY - this._touchStartY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var pos = this._canvasXY(touch.clientX, touch.clientY);

    this._touchId = null;

    // Drag end
    if (this._touchDragging) {
      this._emit('dragend', pos);
      return;
    }

    // Swipe detection
    if (dist >= SWIPE_MIN_DIST && elapsed <= SWIPE_MAX_TIME) {
      var dir = this._swipeDirection(dx, dy);
      this._emit('swipe', {
        direction: dir,
        velocity: dist / elapsed,
        x: pos.x,
        y: pos.y
      });
      // Swipe also emits keyaction for game compatibility
      this._emit('keyaction', { action: dir });
      return;
    }

    // Tap detection
    if (dist < TAP_MAX_DIST && elapsed < TAP_MAX_TIME) {
      var now = Date.now();
      // Double-tap check
      if (now - this._lastTapTime < DOUBLE_TAP_WINDOW &&
          Math.abs(touch.clientX - this._lastTapX) < 30 &&
          Math.abs(touch.clientY - this._lastTapY) < 30) {
        this._emit('doubletap', pos);
        this._emit('keyaction', { action: 'secondary' });
        this._lastTapTime = 0;
      } else {
        this._emit('tap', pos);
        // Directional tap: if anchor is set, compute direction and emit
        // swipe+keyaction with that direction instead of generic 'action'
        var anchorDir = this._anchorDirection(pos.x, pos.y);
        if (anchorDir) {
          this._emit('swipe', { direction: anchorDir, velocity: 0.5, x: pos.x, y: pos.y });
          this._emit('keyaction', { action: anchorDir });
        } else {
          this._emit('keyaction', { action: 'action' });
        }
        this._lastTapTime = now;
        this._lastTapX = touch.clientX;
        this._lastTapY = touch.clientY;
      }
      return;
    }
  };

  ArcadeInput.prototype._handleTouchCancel = function (e) {
    if (this._destroyed) return;
    clearTimeout(this._longPressTimer);
    clearTimeout(this._dragCheckTimer);
    if (this._touchDragging) {
      var pos = this._canvasXY(this._touchStartX, this._touchStartY);
      this._emit('dragend', pos);
    }
    this._touchId = null;
    this._touchDragging = false;
  };

  // ── Mouse handlers (fallback for desktop) ──

  ArcadeInput.prototype._handleMouseDown = function (e) {
    if (this._destroyed) return;
    this._mouseDown = true;
    this._mouseStartX = e.clientX;
    this._mouseStartY = e.clientY;
    this._mouseStartTime = Date.now();
    this._mouseDragging = false;
  };

  ArcadeInput.prototype._handleMouseMove = function (e) {
    if (this._destroyed || !this._mouseDown) return;
    var dx = e.clientX - this._mouseStartX;
    var dy = e.clientY - this._mouseStartY;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (!this._mouseDragging && dist > TAP_MAX_DIST &&
        Date.now() - this._mouseStartTime > DRAG_MIN_TIME / 2) {
      this._mouseDragging = true;
      var startPos = this._canvasXY(this._mouseStartX, this._mouseStartY);
      this._emit('dragstart', startPos);
    }

    if (this._mouseDragging) {
      var pos = this._canvasXY(e.clientX, e.clientY);
      pos.dx = dx;
      pos.dy = dy;
      this._emit('drag', pos);
    }
  };

  ArcadeInput.prototype._handleMouseUp = function (e) {
    if (this._destroyed || !this._mouseDown) return;
    this._mouseDown = false;

    var elapsed = Date.now() - this._mouseStartTime;
    var dx = e.clientX - this._mouseStartX;
    var dy = e.clientY - this._mouseStartY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var pos = this._canvasXY(e.clientX, e.clientY);

    if (this._mouseDragging) {
      this._mouseDragging = false;
      this._emit('dragend', pos);
      return;
    }

    // Mouse click → tap
    if (dist < TAP_MAX_DIST && elapsed < TAP_MAX_TIME) {
      var now = Date.now();
      if (now - this._lastTapTime < DOUBLE_TAP_WINDOW) {
        this._emit('doubletap', pos);
        this._emit('keyaction', { action: 'secondary' });
        this._lastTapTime = 0;
      } else {
        this._emit('tap', pos);
        var anchorDir = this._anchorDirection(pos.x, pos.y);
        if (anchorDir) {
          this._emit('swipe', { direction: anchorDir, velocity: 0.5, x: pos.x, y: pos.y });
          this._emit('keyaction', { action: anchorDir });
        } else {
          this._emit('keyaction', { action: 'action' });
        }
        this._lastTapTime = now;
        this._lastTapX = e.clientX;
        this._lastTapY = e.clientY;
      }
    }
  };

  // ── Keyboard handlers ──

  ArcadeInput.prototype._handleKeyDown = function (e) {
    if (this._destroyed) return;
    var action = KEY_MAP[e.code];
    if (!action) return;

    // Prevent repeat events from held keys
    if (this._keysHeld[e.code]) return;
    this._keysHeld[e.code] = true;

    e.preventDefault();
    this._emit('keyaction', { action: action });

    // Map directional keys to swipe events for game compatibility
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      this._emit('swipe', { direction: action, velocity: 1, x: 0, y: 0 });
    }
  };

  ArcadeInput.prototype._handleKeyUp = function (e) {
    if (this._destroyed) return;
    if (KEY_MAP[e.code]) {
      this._keysHeld[e.code] = false;
    }
  };

  // ── Utilities ──

  ArcadeInput.prototype._findTouch = function (touchList, id) {
    for (var i = 0; i < touchList.length; i++) {
      if (touchList[i].identifier === id) return touchList[i];
    }
    return null;
  };

  ArcadeInput.prototype._swipeDirection = function (dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  };

  // ── Directional tap (zone-based, ported from gone-rogue tap-to-move) ──

  /**
   * Enable directional tap mode. When set, taps compute direction
   * relative to the anchor point and emit 'swipe' + 'keyaction' events
   * instead of plain 'tap' + 'keyaction:action'.
   *
   * The anchor should be updated each frame by the game (e.g. frog position).
   * When anchor is null, taps behave normally (emit 'tap' + 'action').
   *
   * @param {number|null} x — anchor x in canvas coordinates (null to disable)
   * @param {number|null} y — anchor y in canvas coordinates
   */
  ArcadeInput.prototype.setAnchor = function (x, y) {
    if (x == null || y == null) {
      this._anchor = null;
    } else {
      if (!this._anchor) this._anchor = {};
      this._anchor.x = x;
      this._anchor.y = y;
    }
  };

  /**
   * Convert a tap at (tx, ty) into a cardinal direction relative to
   * the current anchor point. Uses the dominant axis (same logic as
   * gone-rogue's 8-axis tap-to-move, collapsed to 4 cardinals for
   * grid-based arcade games).
   *
   * @param {number} tx — tap x (canvas coords)
   * @param {number} ty — tap y (canvas coords)
   * @returns {string|null} — 'up','down','left','right' or null if on anchor
   */
  ArcadeInput.prototype._anchorDirection = function (tx, ty) {
    if (!this._anchor) return null;
    var dx = tx - this._anchor.x;
    var dy = ty - this._anchor.y;
    // Dead zone: taps very close to anchor don't produce a direction
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return null;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  };

  /**
   * Check if a key action is currently held down.
   * Useful for continuous movement polling in game loops.
   *
   * @param {string} action — 'up', 'down', 'left', 'right', 'action', 'secondary'
   * @returns {boolean}
   */
  ArcadeInput.prototype.isHeld = function (action) {
    for (var code in KEY_MAP) {
      if (KEY_MAP[code] === action && this._keysHeld[code]) return true;
    }
    return false;
  };

  /**
   * Detach all event listeners and release references.
   */
  ArcadeInput.prototype.destroy = function () {
    this._destroyed = true;
    clearTimeout(this._longPressTimer);
    clearTimeout(this._dragCheckTimer);

    this._canvas.removeEventListener('touchstart', this._onTouchStart);
    this._canvas.removeEventListener('touchmove', this._onTouchMove);
    this._canvas.removeEventListener('touchend', this._onTouchEnd);
    this._canvas.removeEventListener('touchcancel', this._onTouchCancel);
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    this._canvas.removeEventListener('contextmenu', this._onContextMenu);

    this._listeners = {};
    this._canvas = null;
  };

  return ArcadeInput;
})();
