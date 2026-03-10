/**
 * DoorContractAudio — IIFE module
 *
 * Pure data module: encodes the door/floor transition sound grammar.
 * Every floor transition produces a sound sequence derived from layer
 * distance between source and target floors.
 *
 * Token types:
 *   DoorOpen  — played before scene transition (player hears the door open)
 *   Ascend/Descend — played during fade (overlaps door open by ~30%)
 *   DoorClose — played after fade-in (player hears door shut behind them)
 *
 * Ascend/Descend suffix encodes magnitude:
 *   2 = one structural layer crossed
 *   3 = two layers or world-scale elevation
 *
 * See docs/AUDIO_WIRING_ROADMAP.md §10 for full spec.
 */
var DoorContractAudio = (function () {
  'use strict';

  // ── Manifest key prefix for door sounds ──────────────────────────
  var _D = 'doorset-ogg-qubodup-';

  // ── Transition table ─────────────────────────────────────────────
  // Keyed by "srcDepth:tgtDepth" where depth = floorId.split('.').length
  // Each entry: ordered array of { key, delay } sound instructions.
  //
  // Timing contract:
  //   delay 0     = DoorOpen plays immediately (scene waits ~350ms before fade)
  //   delay 250   = Ascend/Descend overlaps last ~30% of door open
  //   delay 600   = DoorClose plays after fade-in completes
  //
  // Special keys:
  //   "1:1"         = world elevation (N → N±), no door
  //   "1:2" / "2:1" = world ↔ building
  //   "2:3" / "3:2" = building ↔ basement
  //   "1:3" / "3:1" = world ↔ basement (skip building)
  //   "3:3+"/ "3+:3"= nested ↔ deeper/shallower nested

  var TRANSITION_TABLE = {
    // ── World ↔ Building (N ↔ N.N) ── Horizontal structure
    '1:2': [
      { key: _D + 'dooropen01', delay: 0, volume: 0.5 },
      { key: _D + 'doorclose03', delay: 600, volume: 0.45 }
    ],
    '2:1': [
      { key: _D + 'dooropen06', delay: 0, volume: 0.5 },
      { key: _D + 'doorclose06', delay: 600, volume: 0.45 }
    ],

    // ── Building ↔ Basement (N.N ↔ N.N.N) ── Door + vertical
    '2:3': [
      { key: _D + 'dooropen02', delay: 0, volume: 0.5 },
      { key: 'descend-2', delay: 250, volume: 0.4 },
      { key: _D + 'doorclose05', delay: 600, volume: 0.45 }
    ],
    '3:2': [
      { key: _D + 'dooropen01', delay: 0, volume: 0.5 },
      { key: 'ascend-2', delay: 250, volume: 0.4 },
      { key: _D + 'doorclose05', delay: 600, volume: 0.45 }
    ],

    // ── Basement ↔ World (N.N.N ↔ N) ── Door + long vertical, no close
    '3:1': [
      { key: _D + 'dooropen03', delay: 0, volume: 0.5 },
      { key: 'ascend-3', delay: 250, volume: 0.4 }
    ],
    '1:3': [
      { key: _D + 'dooropen04', delay: 0, volume: 0.5 },
      { key: 'descend-3', delay: 250, volume: 0.4 }
    ],

    // ── Nested ↔ Deeper Nested (N.N.N ↔ N.N.N+) ── Heavy door + vertical
    '3:3_deeper': [
      { key: _D + 'dooropen05', delay: 0, volume: 0.5 },
      { key: 'descend-2', delay: 250, volume: 0.4 },
      { key: _D + 'doorclose09', delay: 600, volume: 0.45 }
    ],
    '3:3_shallower': [
      { key: _D + 'dooropen05', delay: 0, volume: 0.5 },
      { key: 'ascend-2', delay: 250, volume: 0.4 },
      { key: _D + 'doorclose09', delay: 600, volume: 0.45 }
    ],

    // ── World elevation (N → N±) ── Pure vertical, no door
    '1:1_up': [
      { key: 'ascend-3', delay: 0, volume: 0.4 }
    ],
    '1:1_down': [
      { key: 'descend-3', delay: 0, volume: 0.4 }
    ]
  };

  // ── Helper: floor depth from floorId ─────────────────────────────
  // "1" → 1, "1.2" → 2, "1.2.3" → 3, null → 1 (world)
  function _depth(floorId) {
    if (!floorId) return 1;
    return String(floorId).split('.').length;
  }

  /**
   * Determine the sound sequence for a floor transition.
   *
   * @param {string|null} sourceFloorId - Current floor (null = world)
   * @param {string|null} targetFloorId - Destination floor (null = world)
   * @param {Object}      [opts]        - Optional hints
   * @param {string}      [opts.direction] - 'up'|'down' for same-depth transitions
   * @returns {Array<{key:string, delay:number, volume:number}>}
   */
  function getTransitionSounds(sourceFloorId, targetFloorId, opts) {
    var srcD = _depth(sourceFloorId);
    var tgtD = _depth(targetFloorId);
    opts = opts || {};

    // Same-depth transitions need directional hint
    if (srcD === tgtD) {
      if (srcD === 1) {
        // World elevation
        var dir = opts.direction || 'down';
        return (TRANSITION_TABLE['1:1_' + dir] || TRANSITION_TABLE['1:1_down']).slice();
      }
      if (srcD >= 3) {
        // Nested ↔ nested: use direction hint or infer from floorId comparison
        var nestedDir = opts.direction || _inferNestedDirection(sourceFloorId, targetFloorId);
        if (nestedDir === 'up' || nestedDir === 'shallower') {
          return (TRANSITION_TABLE['3:3_shallower'] || []).slice();
        }
        return (TRANSITION_TABLE['3:3_deeper'] || []).slice();
      }
    }

    // Cross-depth transitions: lookup by depth pair
    var tableKey = srcD + ':' + tgtD;
    var entry = TRANSITION_TABLE[tableKey];
    if (entry) return entry.slice();

    // Fallback: generic ascend or descend based on depth change
    if (tgtD > srcD) {
      return [{ key: 'descend-2', delay: 0, volume: 0.4 }];
    }
    return [{ key: 'ascend-2', delay: 0, volume: 0.4 }];
  }

  /**
   * Infer direction for same-depth nested transitions.
   * Compares the last numeric segment of each floorId.
   * "1.2.3" → "1.2.4" = deeper, "1.2.4" → "1.2.3" = shallower
   */
  function _inferNestedDirection(src, tgt) {
    var srcParts = String(src).split('.');
    var tgtParts = String(tgt).split('.');
    var srcLast = parseInt(srcParts[srcParts.length - 1], 10) || 0;
    var tgtLast = parseInt(tgtParts[tgtParts.length - 1], 10) || 0;
    return tgtLast > srcLast ? 'deeper' : 'shallower';
  }

  /**
   * Get the pre-fade delay in ms. This is how long the scene should
   * wait after starting the door open sound before beginning the
   * visual fade transition. Ensures the player hears the door creak
   * before the screen goes dark.
   *
   * @param {Array} sounds - Result from getTransitionSounds()
   * @returns {number} ms to wait before starting fade
   */
  function getPreFadeDelay(sounds) {
    if (!sounds || sounds.length === 0) return 0;
    // If there's a door open (delay: 0), wait 350ms so player hears
    // the initial creak. If it's pure vertical (no door), no delay.
    var hasDoor = false;
    for (var i = 0; i < sounds.length; i++) {
      if (sounds[i].delay === 0 && sounds[i].key.indexOf('doorset') !== -1) {
        hasDoor = true;
        break;
      }
    }
    return hasDoor ? 350 : 0;
  }

  /**
   * Get the post-fade delay in ms. This is how long to wait after
   * fade-in before playing the closing door sound (for sounds with
   * delay >= 600).
   *
   * @param {Array} sounds - Result from getTransitionSounds()
   * @returns {number} ms to wait after fade-in for door close
   */
  function getPostFadeDelay(sounds) {
    if (!sounds || sounds.length === 0) return 0;
    // Find the latest delay that's a door close (delay >= 600)
    for (var i = sounds.length - 1; i >= 0; i--) {
      if (sounds[i].delay >= 600) return 150; // small buffer after fade-in
    }
    return 0;
  }

  // ── Public API ───────────────────────────────────────────────────
  return {
    getTransitionSounds: getTransitionSounds,
    getPreFadeDelay: getPreFadeDelay,
    getPostFadeDelay: getPostFadeDelay,
    TRANSITION_TABLE: TRANSITION_TABLE
  };
})();
