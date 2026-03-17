/* ============================================================
   Constellation Loader — Phase 8
   ============================================================
   Fetches constellation definitions from /data/constellations.json
   and registers the NEXT UNSOLVED level with SuitNodeRenderer.

   Uses ConstellationGamestate to determine which constellations
   are already solved. Only loads ONE level at a time — the next
   unsolved all-♣ constellation.

   After a constellation is solved (via constellation-solved event),
   the loader automatically registers the next level.

   Usage:
     ConstellationLoader.init()   — loads next unsolved level
   ============================================================ */

;(function (root) {
  'use strict';

  var _loaded = false;
  var _allConstellations = null;

  // Inline fallback: level 1 triangle
  var _FALLBACK = [
    {
      id: 'level-1-signal', level: 1,
      difficulty: 'beginner', validation: 'shape',
      angleConstraints: false,
      nodes: [
        { id: 'l1-1', x: 0.44, y: 0.32, suit: 'club' },
        { id: 'l1-2', x: 0.56, y: 0.32, suit: 'club' },
        { id: 'l1-3', x: 0.50, y: 0.48, suit: 'club' },
      ],
    },
  ];

  function init() {
    if (_loaded) return;
    _loaded = true;

    _fetchData(function (constellations) {
      _allConstellations = constellations;

      // Filter to all-club constellations only (Phase 8)
      _allConstellations = _allConstellations.filter(function (c) {
        return c.nodes.every(function (n) { return n.suit === 'club'; });
      });

      // Sort by level number
      _allConstellations.sort(function (a, b) {
        return (a.level || 0) - (b.level || 0);
      });

      // Register the next unsolved level
      _registerNextLevel();

      // Listen for solved events to auto-advance
      document.addEventListener('constellation-solved', function () {
        // Small delay so gamestate persists first
        setTimeout(function () {
          _registerNextLevel();
        }, 200);
      });

      console.log('[ConstellationLoader] Loaded ' + _allConstellations.length +
                  ' constellation definitions');
    });
  }

  /**
   * Register the next unsolved constellation with SuitNodeRenderer.
   */
  function _registerNextLevel() {
    if (!_allConstellations || !_allConstellations.length) return;
    if (typeof SuitNodeRenderer === 'undefined') return;

    // Clear any existing constellation nodes (clean slate for next level)
    SuitNodeRenderer.clearConstellations();

    // Find the next unsolved constellation
    var nextDef = null;
    for (var i = 0; i < _allConstellations.length; i++) {
      var def = _allConstellations[i];
      var solved = false;
      if (typeof ConstellationGamestate !== 'undefined') {
        solved = ConstellationGamestate.isSolved(def.id);
      }
      if (!solved) {
        nextDef = def;
        break;
      }
    }

    if (!nextDef) {
      console.log('[ConstellationLoader] All constellations solved!');
      // Dispatch event for UI
      try {
        document.dispatchEvent(new CustomEvent('all-constellations-solved'));
      } catch (e) {}
      return;
    }

    SuitNodeRenderer.registerConstellation(nextDef);
    console.log('[ConstellationLoader] Registered level', nextDef.level || '?',
                ':', nextDef.id, '(' + nextDef.nodes.length + ' nodes)');

    // Dispatch event so UI can update level indicator
    try {
      document.dispatchEvent(new CustomEvent('constellation-level-loaded', {
        detail: {
          id: nextDef.id,
          level: nextDef.level || 0,
          name: nextDef.name || nextDef.id,
          nodeCount: nextDef.nodes.length,
        },
      }));
    } catch (e) {}
  }

  function _fetchData(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/data/constellations.json?v=20260317b', true);
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

  function getAllConstellations() { return _allConstellations; }

  root.ConstellationLoader = {
    init: init,
    getAllConstellations: getAllConstellations,
  };

})(typeof window !== 'undefined' ? window : this);
