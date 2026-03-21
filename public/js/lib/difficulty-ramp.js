/* ============================================================
   DifficultyRamp — Progressive difficulty curve system
   Standalone IIFE, no dependencies.

   Drives spawn rates, speed multipliers, enemy stats, and any
   other numeric parameter from a single distance/score/time value.

   Usage (section-based, like Ski Free):
     var ramp = new DifficultyRamp({
       metric: 'distance',
       sections: [
         { name: 'Upper Slopes', at: 0,    obstRate: 0.015, speedMul: 1.0  },
         { name: 'Treeline Run', at: 800,  obstRate: 0.05,  speedMul: 1.1  },
         { name: 'Mogul Field',  at: 2000, obstRate: 0.10,  speedMul: 1.25 },
         { name: 'Chute',        at: 3500, obstRate: 0.18,  speedMul: 1.45 }
       ]
     });
     ramp.update(distance);
     var sec  = ramp.section();        // current section object
     var rate = ramp.get('obstRate');   // current value (snapped to section)
     var smth = ramp.lerp('speedMul'); // smoothly interpolated between sections

   Usage (linear, like Goat Runner):
     var ramp = new DifficultyRamp({
       metric: 'distance',
       range: [0, 5000],   // metric range for 0→1 normalization
       clamp: true          // clamp t to [0, 1]
     });
     ramp.update(distance);
     var t = ramp.t();     // 0-1 normalized difficulty
     var spawnChance = ramp.scale(0.01, 0.08); // lerp between min/max

   Both modes can coexist — sections provide named thresholds while
   t() and scale() provide continuous interpolation.
   ============================================================ */
;(function () {
  'use strict';

  /**
   * @constructor
   * @param {Object} opts
   * @param {string} [opts.metric='distance'] - Label for the driving metric
   * @param {Array}  [opts.sections]          - Array of section objects with `at` thresholds
   * @param {Array}  [opts.range=[0, 1000]]   - [min, max] for linear normalization
   * @param {boolean} [opts.clamp=true]       - Clamp t to [0, 1]
   */
  function DifficultyRamp(opts) {
    opts = opts || {};
    this._metric = opts.metric || 'distance';
    this._sections = opts.sections || [];
    this._range = opts.range || [0, 1000];
    this._clamp = opts.clamp !== false;
    this._value = 0;
    this._t = 0;
    this._currentIdx = 0;
    this._prevIdx = -1;

    // Sort sections by `at` ascending
    if (this._sections.length > 0) {
      this._sections.sort(function (a, b) { return a.at - b.at; });
    }
  }

  // ── Core ────────────────────────────────────────────────

  /**
   * Feed the current metric value. Call once per frame.
   * @param {number} value - Current distance / score / time / etc.
   * @returns {DifficultyRamp} this (chainable)
   */
  DifficultyRamp.prototype.update = function (value) {
    this._value = value;

    // Linear normalization
    var min = this._range[0], max = this._range[1];
    var span = max - min;
    this._t = span > 0 ? (value - min) / span : 0;
    if (this._clamp) {
      if (this._t < 0) this._t = 0;
      if (this._t > 1) this._t = 1;
    }

    // Section lookup (highest `at` <= value)
    this._prevIdx = this._currentIdx;
    for (var i = this._sections.length - 1; i >= 0; i--) {
      if (value >= this._sections[i].at) {
        this._currentIdx = i;
        break;
      }
    }

    return this;
  };

  // ── Accessors ───────────────────────────────────────────

  /**
   * @returns {number} Current raw metric value.
   */
  DifficultyRamp.prototype.value = function () {
    return this._value;
  };

  /**
   * @returns {number} Normalized difficulty 0-1 (linear mode).
   */
  DifficultyRamp.prototype.t = function () {
    return this._t;
  };

  /**
   * Scale a value linearly between min and max based on current t.
   * @param {number} min - Value at t=0
   * @param {number} max - Value at t=1
   * @returns {number}
   */
  DifficultyRamp.prototype.scale = function (min, max) {
    return min + (max - min) * this._t;
  };

  /**
   * Scale with an easing curve (quadratic ease-in by default).
   * @param {number} min
   * @param {number} max
   * @param {string} [ease='quadIn'] - 'linear', 'quadIn', 'quadOut', 'smooth'
   * @returns {number}
   */
  DifficultyRamp.prototype.scaleEased = function (min, max, ease) {
    var t = this._t;
    switch (ease) {
      case 'quadOut':  t = t * (2 - t); break;
      case 'smooth':   t = t * t * (3 - 2 * t); break;
      case 'linear':   break;
      case 'quadIn':   // fall through
      default:         t = t * t; break;
    }
    return min + (max - min) * t;
  };

  // ── Section mode ────────────────────────────────────────

  /**
   * @returns {Object|null} The current active section, or null if no sections.
   */
  DifficultyRamp.prototype.section = function () {
    if (this._sections.length === 0) return null;
    return this._sections[this._currentIdx];
  };

  /**
   * @returns {string|null} Name of current section.
   */
  DifficultyRamp.prototype.sectionName = function () {
    var s = this.section();
    return s ? (s.name || null) : null;
  };

  /**
   * @returns {number} Index of current section.
   */
  DifficultyRamp.prototype.sectionIndex = function () {
    return this._currentIdx;
  };

  /**
   * Did the section change since last update()?
   * @returns {boolean}
   */
  DifficultyRamp.prototype.sectionChanged = function () {
    return this._currentIdx !== this._prevIdx;
  };

  /**
   * Get a property value from the current section (snapped, no interpolation).
   * @param {string} key - Property name on the section object.
   * @param {*} [fallback] - Default if key doesn't exist.
   * @returns {*}
   */
  DifficultyRamp.prototype.get = function (key, fallback) {
    var s = this.section();
    if (!s || !(key in s)) return fallback !== undefined ? fallback : 0;
    return s[key];
  };

  /**
   * Smoothly interpolate a numeric property between current and next section.
   * If at the last section, returns that section's value.
   * @param {string} key - Property name (must be numeric on both sections).
   * @param {*} [fallback=0]
   * @returns {number}
   */
  DifficultyRamp.prototype.lerp = function (key, fallback) {
    var fb = fallback !== undefined ? fallback : 0;
    if (this._sections.length === 0) return fb;

    var idx = this._currentIdx;
    var cur = this._sections[idx];
    if (!(key in cur)) return fb;

    // Last section — no interpolation
    if (idx >= this._sections.length - 1) return cur[key];

    var next = this._sections[idx + 1];
    if (!(key in next)) return cur[key];

    // Interpolate based on position between thresholds
    var span = next.at - cur.at;
    if (span <= 0) return cur[key];
    var localT = (this._value - cur.at) / span;
    if (localT < 0) localT = 0;
    if (localT > 1) localT = 1;

    return cur[key] + (next[key] - cur[key]) * localT;
  };

  // ── Utilities ───────────────────────────────────────────

  /**
   * Reset to initial state.
   */
  DifficultyRamp.prototype.reset = function () {
    this._value = 0;
    this._t = 0;
    this._currentIdx = 0;
    this._prevIdx = -1;
  };

  /**
   * @returns {Array} Shallow copy of sections array.
   */
  DifficultyRamp.prototype.sections = function () {
    return this._sections.slice();
  };

  /**
   * Add a section dynamically (e.g. from designer).
   * @param {Object} section - Must have `at` property.
   * @returns {DifficultyRamp} this
   */
  DifficultyRamp.prototype.addSection = function (section) {
    this._sections.push(section);
    this._sections.sort(function (a, b) { return a.at - b.at; });
    return this;
  };

  // ── Export as global ──
  window.DifficultyRamp = DifficultyRamp;
})();
