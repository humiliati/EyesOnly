/**
 * qr-custom.js — Dynamic Runtime Loader for Designer-Created Puzzles
 *
 * On page load, fetches all 'live' puzzles from /api/puzzles/live
 * and registers each one with PuzzlePopup. Also injects their entries
 * into the QR FIELD OPS section of the games page.
 *
 * This is the bridge between the designer portal and the live site:
 * Designer creates puzzle → API stores it → this script loads it → player sees it.
 *
 * Also extends the QR router's ROUTE_MAP dynamically so that
 * /games#designer-slug auto-opens the correct puzzle.
 */
(function () {
  'use strict';

  var API_URL = '/api/puzzles/live';

  function waitForPuzzlePopup(callback) {
    if (typeof PuzzlePopup !== 'undefined') return callback();
    var attempts = 0;
    var poll = setInterval(function () {
      attempts++;
      if (typeof PuzzlePopup !== 'undefined') {
        clearInterval(poll);
        callback();
      } else if (attempts > 100) {
        clearInterval(poll);
        console.warn('[QR-Custom] PuzzlePopup never loaded');
      }
    }, 100);
  }

  function injectPuzzleEntry(puzzle) {
    var container = document.getElementById('qr-field-ops-body');
    if (!container) return;

    // Check if already injected
    if (container.querySelector('[data-puzzle="custom-' + puzzle.slug + '"]')) return;

    var div = document.createElement('div');
    div.className = 'games-item games-item-playable';
    div.setAttribute('data-puzzle', 'custom-' + puzzle.slug);
    div.setAttribute('data-sound', 'ui-01');

    div.innerHTML =
      '<span class="games-item-icon">' + (puzzle.emoji || '🔐') + '</span>' +
      '<div class="games-item-info">' +
        '<div class="games-item-name">' + escapeHtml(puzzle.title) + '</div>' +
        '<div class="games-item-desc">' + escapeHtml(puzzle.description || '') + '</div>' +
      '</div>' +
      '<span class="games-item-tag ' + escapeHtml(puzzle.tag_class || 'games-tag-narrative') + '">' +
        escapeHtml(puzzle.tag || 'PUZZLE') +
      '</span>';

    container.appendChild(div);

    // Re-bind PuzzlePopup click handlers
    if (typeof PuzzlePopup !== 'undefined' && PuzzlePopup.bind) {
      PuzzlePopup.bind(container);
    }
  }

  function registerPuzzle(puzzle) {
    var key = 'custom-' + puzzle.slug;

    // Execute the designer's puzzle_js in a scoped context
    // The puzzle_js is expected to call PuzzlePopup.register() itself,
    // OR export a render function we can wrap.
    try {
      // Create a function scope with PuzzlePopup available
      var fn = new Function('PuzzlePopup', 'PuzzleState', 'AudioSystem', puzzle.puzzle_js);
      fn(
        typeof PuzzlePopup !== 'undefined' ? PuzzlePopup : null,
        typeof PuzzleState !== 'undefined' ? PuzzleState : null,
        typeof AudioSystem !== 'undefined' ? AudioSystem : null
      );
      console.log('[QR-Custom] Registered puzzle: ' + key);
    } catch (err) {
      console.error('[QR-Custom] Failed to load puzzle "' + puzzle.slug + '":', err);

      // Fallback: register a simple error display
      PuzzlePopup.register(key, {
        title: puzzle.title || 'PUZZLE ERROR',
        render: function (container) {
          container.innerHTML =
            '<div class="puzzle-ddc-briefing">' +
              '<span class="puzzle-ddc-label">PUZZLE LOAD ERROR</span>' +
              '<p class="puzzle-ddc-flavor">This puzzle failed to load. Please contact ops.</p>' +
              '<pre style="color:red;font-size:0.7em;white-space:pre-wrap;">' + escapeHtml(String(err)) + '</pre>' +
            '</div>';
        }
      });
    }

    // Inject into the page
    injectPuzzleEntry(puzzle);

    // Extend the QR router's route map dynamically
    if (typeof window.__qrRouteMap === 'undefined') {
      window.__qrRouteMap = {};
    }
    window.__qrRouteMap[puzzle.slug] = key;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function loadLivePuzzles() {
    fetch(API_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var puzzles = data.puzzles || [];
        if (!puzzles.length) {
          console.log('[QR-Custom] No live designer puzzles');
          return;
        }

        console.log('[QR-Custom] Loading ' + puzzles.length + ' live puzzle(s)');

        // Update the QR FIELD OPS count
        var countEl = document.querySelector('#row-qr-field-ops .games-row-count');
        if (countEl) {
          var staticCount = document.querySelectorAll('#qr-field-ops-body > .games-item').length;
          var total = staticCount + puzzles.length;
          countEl.textContent = total + ' MISSIONS';
        }

        puzzles.forEach(function (puzzle) {
          registerPuzzle(puzzle);
        });

        // Check if current hash matches a newly loaded puzzle
        var hash = window.location.hash.substring(1).toLowerCase();
        if (hash && window.__qrRouteMap && window.__qrRouteMap[hash]) {
          // Trigger the router to open this puzzle
          setTimeout(function () {
            if (typeof PuzzlePopup !== 'undefined' && !PuzzlePopup.isOpen()) {
              PuzzlePopup.open(window.__qrRouteMap[hash]);
            }
          }, 300);
        }
      })
      .catch(function (err) {
        console.warn('[QR-Custom] Failed to load live puzzles:', err);
      });
  }

  // Wait for PuzzlePopup, then load
  waitForPuzzlePopup(function () {
    // Small delay to let static puzzles register first
    setTimeout(loadLivePuzzles, 200);
  });

})();
