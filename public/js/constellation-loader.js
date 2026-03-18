/* ============================================================
   Constellation Loader — Phase 8
   ============================================================
   Manages the constellation progression sequence:

   1. First level: always the first designed template (t1-01-triangle)
   2. After that: shuffle 2–3 proc-gen shapes between each designed template
   3. As tier increases: higher ratio of proc-gen to designed
   4. Infinite play: after all designed templates are exhausted,
      pure proc-gen with increasing difficulty

   Uses ConstellationGamestate for solved tracking + persistence.
   Uses ConstellationProcGen for procedural shape generation.

   Usage:
     ConstellationLoader.init()
   ============================================================ */

;(function (root) {
  'use strict';

  var _loaded = false;
  var _designedTemplates = [];  // from constellations.json
  var _sequence = [];           // built progression: designed + proc-gen interleaved
  var _sequenceIndex = 0;       // current position in sequence

  // How many proc-gen shapes to insert between designed templates
  var PROCGEN_PER_DESIGNED_EARLY = 2;  // levels 1–6
  var PROCGEN_PER_DESIGNED_MID   = 3;  // levels 7–12
  var PROCGEN_PER_DESIGNED_LATE  = 4;  // levels 13+

  // Inline fallback
  var _FALLBACK = [
    {
      id: 't1-01-triangle', tier: 1,
      difficulty: 'beginner', validation: 'shape',
      angleConstraints: false,
      nodes: [
        { id: 't1-01-a', x: 0.42, y: 0.28, suit: 'club' },
        { id: 't1-01-b', x: 0.58, y: 0.28, suit: 'club' },
        { id: 't1-01-c', x: 0.50, y: 0.48, suit: 'club' },
      ],
    },
  ];

  function init() {
    if (_loaded) return;
    _loaded = true;

    _fetchData(function (constellations) {
      // Filter out section dividers and entries without nodes
      _designedTemplates = constellations.filter(function (c) {
        return c.nodes && c.nodes.length > 0;
      });

      // Phase 8: only tier 1
      _designedTemplates = _designedTemplates.filter(function (c) {
        return (c.tier || 1) <= 1;
      });

      // Sort by id
      _designedTemplates.sort(function (a, b) {
        return (a.id || '').localeCompare(b.id || '');
      });

      // Build the progression sequence
      _buildSequence();

      // Skip already-solved levels
      _advanceToNextUnsolved();

      // Register the current level
      _registerCurrentLevel();

      // Listen for solved events to auto-advance
      document.addEventListener('constellation-solved', function () {
        setTimeout(function () {
          _sequenceIndex++;
          // Extend sequence if needed (proc-gen is infinite)
          if (_sequenceIndex >= _sequence.length) {
            _extendSequence();
          }
          _registerCurrentLevel();
        }, 200);
      });

      console.log('[ConstellationLoader] Built sequence: ' + _sequence.length +
                  ' levels (' + _designedTemplates.length + ' designed, rest proc-gen)');
    });
  }

  /**
   * Build the interleaved sequence of designed + proc-gen levels.
   * Pattern: designed → N proc-gen → designed → N proc-gen → ...
   * First level is always designed (no proc-gen before it).
   */
  function _buildSequence() {
    _sequence = [];
    var pgIndex = 0; // proc-gen counter for unique seeds

    for (var i = 0; i < _designedTemplates.length; i++) {
      // Add the designed template
      _sequence.push(_designedTemplates[i]);

      // After the first designed template, start inserting proc-gen
      if (i >= 0) {
        var pgCount = _getProcGenCount(i);
        for (var p = 0; p < pgCount; p++) {
          if (typeof ConstellationProcGen !== 'undefined') {
            var pgDef = ConstellationProcGen.generate(pgIndex, (i * 100) + p + 42);
            pgDef.id = 'pg-' + String(i).padStart(2, '0') + '-' + String(p).padStart(2, '0');
            _sequence.push(pgDef);
            pgIndex++;
          }
        }
      }
    }
  }

  /**
   * How many proc-gen shapes to insert after designed template index i.
   */
  function _getProcGenCount(designedIndex) {
    if (designedIndex === 0) return PROCGEN_PER_DESIGNED_EARLY;
    if (designedIndex < 6) return PROCGEN_PER_DESIGNED_EARLY;
    if (designedIndex < 12) return PROCGEN_PER_DESIGNED_MID;
    return PROCGEN_PER_DESIGNED_LATE;
  }

  /**
   * Extend the sequence with more proc-gen (when all designed templates used up).
   */
  function _extendSequence() {
    if (typeof ConstellationProcGen === 'undefined') return;
    var baseIdx = _sequence.length;
    for (var i = 0; i < 5; i++) {
      var def = ConstellationProcGen.generate(baseIdx + i);
      def.id = 'pg-ext-' + String(baseIdx + i).padStart(3, '0');
      _sequence.push(def);
    }
    console.log('[ConstellationLoader] Extended sequence to ' + _sequence.length + ' levels');
  }

  /**
   * Skip already-solved levels.
   */
  function _advanceToNextUnsolved() {
    while (_sequenceIndex < _sequence.length) {
      var def = _sequence[_sequenceIndex];
      if (typeof ConstellationGamestate !== 'undefined' && ConstellationGamestate.isSolved(def.id)) {
        _sequenceIndex++;
      } else {
        break;
      }
    }
    // If past the end, extend
    if (_sequenceIndex >= _sequence.length) {
      _extendSequence();
    }
  }

  /**
   * Register the current level with SuitNodeRenderer.
   */
  function _registerCurrentLevel() {
    if (typeof SuitNodeRenderer === 'undefined') return;

    SuitNodeRenderer.clearConstellations();

    if (_sequenceIndex >= _sequence.length) {
      console.log('[ConstellationLoader] All levels complete!');
      try { document.dispatchEvent(new CustomEvent('all-constellations-solved')); } catch (e) {}
      return;
    }

    var def = _sequence[_sequenceIndex];

    SuitNodeRenderer.registerConstellation(def);

    var levelNum = _sequenceIndex + 1;
    console.log('[ConstellationLoader] Level ' + levelNum + ': ' + def.id +
                ' (' + def.nodes.length + ' nodes' +
                (def.procGen ? ', proc-gen' : ', designed') + ')');

    try {
      document.dispatchEvent(new CustomEvent('constellation-level-loaded', {
        detail: {
          id: def.id,
          level: levelNum,
          name: def.name || def.id,
          nodeCount: def.nodes.length,
          procGen: !!def.procGen,
        },
      }));
    } catch (e) {}
  }

  function _fetchData(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/data/constellations.json?v=20260317d', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          callback(data.constellations || _FALLBACK);
          return;
        } catch (e) {
          console.warn('[ConstellationLoader] Parse error, using fallback:', e);
        }
      } else {
        console.warn('[ConstellationLoader] Fetch failed (' + xhr.status + '), using fallback');
      }
      callback(_FALLBACK);
    };
    xhr.send();
  }

  function getCurrentLevel() { return _sequenceIndex; }
  function getSequence() { return _sequence; }

  root.ConstellationLoader = {
    init: init,
    getCurrentLevel: getCurrentLevel,
    getSequence: getSequence,
  };

})(typeof window !== 'undefined' ? window : this);
