/* ============================================================
   Constellation Loader — Phase 8
   ============================================================
   Fetches constellation definitions from /data/constellations.json
   and registers them with SuitNodeRenderer.

   For Phase 8 MVP, only the "tutorial-triangle" (beginner, all ♣)
   is playable — intermediate+ constellations with ♦/♠/♥ nodes
   require multi-lens support from Phase 9.

   Usage:
     ConstellationLoader.init();            // load & register all
     ConstellationLoader.init('beginner');   // only beginner level
   ============================================================ */

;(function (root) {
  'use strict';

  var _loaded = false;
  var _constellationData = null;

  // Inline fallback: the tutorial triangle, so Phase 8 always works
  var _FALLBACK = [
    {
      id: 'tutorial-triangle',
      difficulty: 'beginner',
      validation: 'shape',
      rewardPerNode: 10,
      nodes: [
        { id: 'tt-1', x: 0.42, y: 0.35, suit: 'club' },
        { id: 'tt-2', x: 0.58, y: 0.35, suit: 'club' },
        { id: 'tt-3', x: 0.50, y: 0.55, suit: 'club' },
      ],
    },
  ];

  function init(difficultyFilter) {
    if (_loaded) return;
    _loaded = true;

    _fetchData(function (constellations) {
      // Apply difficulty filter if specified
      var toRegister = constellations;
      if (difficultyFilter) {
        toRegister = constellations.filter(function (c) {
          return c.difficulty === difficultyFilter;
        });
      }

      // For Phase 8 MVP: only register constellations whose nodes are all ♣ clubs
      // (multi-suit constellations need Phase 9 multi-lens support)
      toRegister = toRegister.filter(function (c) {
        return c.nodes.every(function (n) { return n.suit === 'club'; });
      });

      if (typeof SuitNodeRenderer === 'undefined') {
        console.warn('[ConstellationLoader] SuitNodeRenderer not available');
        return;
      }

      toRegister.forEach(function (def) {
        SuitNodeRenderer.registerConstellation(def);
        console.log('[ConstellationLoader] Registered:', def.id,
                    '(' + def.nodes.length + ' nodes, ' + def.difficulty + ')');
      });

      console.log('[ConstellationLoader] Loaded ' + toRegister.length + ' constellation(s)');
    });
  }

  function _fetchData(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/data/constellations.json?v=20260316d', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          _constellationData = data.constellations || _FALLBACK;
          callback(_constellationData);
          return;
        } catch (e) {
          console.warn('[ConstellationLoader] Parse error, using fallback:', e);
        }
      } else {
        console.warn('[ConstellationLoader] Fetch failed (status ' + xhr.status + '), using fallback');
      }
      _constellationData = _FALLBACK;
      callback(_constellationData);
    };
    xhr.send();
  }

  function getConstellationData() { return _constellationData; }

  root.ConstellationLoader = {
    init: init,
    getConstellationData: getConstellationData,
  };

})(typeof window !== 'undefined' ? window : this);
