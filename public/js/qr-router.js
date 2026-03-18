/**
 * qr-router.js — Hash-Based QR Code Router for /games.html
 *
 * When a player scans a QR code that points to e.g.:
 *   flapsandseals.com/games.html#cipher
 *   flapsandseals.com/games.html#jigsaw
 *   flapsandseals.com/games.html#riddle
 *
 * This script reads the hash fragment, waits for the page to initialize,
 * then auto-opens the corresponding puzzle via PuzzlePopup.
 *
 * Also expands the PUZZLES row and scrolls it into view for context.
 *
 * Hash → PuzzlePopup key mapping:
 *   #cipher  → 'qr-cipher'
 *   #jigsaw  → 'qr-jigsaw'
 *   #riddle  → 'qr-riddle'
 *   #decode  → 'dead-drop-cipher'  (existing puzzle, also QR-linkable)
 */
(function () {
  'use strict';

  var ROUTE_MAP = {
    'cipher':  'qr-cipher',
    'jigsaw':  'qr-jigsaw',
    'riddle':  'qr-riddle',
    'decode':  'dead-drop-cipher'
  };

  function getHashRoute() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return null;
    return hash.substring(1).toLowerCase().replace(/[^a-z0-9-]/g, '');
  }

  function expandPuzzlesRow() {
    var puzzleBtn = document.querySelector('#row-puzzles .games-row-header');
    var puzzleBody = document.getElementById('puzzles-body');
    if (puzzleBtn && puzzleBody && !puzzleBody.classList.contains('games-row-body-open')) {
      puzzleBtn.setAttribute('aria-expanded', 'true');
      puzzleBody.classList.add('games-row-body-open');
      var chevron = puzzleBtn.querySelector('.games-row-chevron');
      if (chevron) chevron.innerHTML = '&#9662;';
    }

    // Also expand the QR field ops row if it exists
    var qrBtn = document.querySelector('#row-qr-field-ops .games-row-header');
    var qrBody = document.getElementById('qr-field-ops-body');
    if (qrBtn && qrBody && !qrBody.classList.contains('games-row-body-open')) {
      qrBtn.setAttribute('aria-expanded', 'true');
      qrBody.classList.add('games-row-body-open');
      var qrChevron = qrBtn.querySelector('.games-row-chevron');
      if (qrChevron) qrChevron.innerHTML = '&#9662;';
    }
  }

  function scrollToQRSection() {
    var section = document.getElementById('row-qr-field-ops') ||
                  document.getElementById('row-puzzles');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function openPuzzle(puzzleKey) {
    if (typeof PuzzlePopup === 'undefined') {
      console.warn('[QR-Router] PuzzlePopup not available');
      return;
    }

    expandPuzzlesRow();

    // Small delay to let row expand animate, then open puzzle
    setTimeout(function () {
      scrollToQRSection();
      PuzzlePopup.open(puzzleKey);
      console.log('[QR-Router] Opened puzzle: ' + puzzleKey);
    }, 400);
  }

  function init() {
    var route = getHashRoute();
    if (!route) return;

    var puzzleKey = ROUTE_MAP[route];
    if (!puzzleKey) {
      console.log('[QR-Router] Unknown route: #' + route);
      return;
    }

    console.log('[QR-Router] QR route detected: #' + route + ' → ' + puzzleKey);

    // Wait for DOM + PuzzlePopup to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        // Additional delay for puzzle scripts to register
        setTimeout(function () { openPuzzle(puzzleKey); }, 600);
      });
    } else {
      setTimeout(function () { openPuzzle(puzzleKey); }, 600);
    }
  }

  // Also handle hash changes for in-page navigation
  window.addEventListener('hashchange', function () {
    var route = getHashRoute();
    if (route && ROUTE_MAP[route]) {
      openPuzzle(ROUTE_MAP[route]);
    }
  });

  // Run on load
  init();

})();
