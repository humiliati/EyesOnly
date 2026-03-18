/**
 * qr-router.js — Hash-Based QR Code Router for /games.html
 *
 * When a player scans a QR code that points to e.g.:
 *   flapsandseals.com/games.html#cipher
 *   flapsandseals.com/games.html#jigsaw
 *   flapsandseals.com/games.html#riddle
 *
 * This script reads the hash fragment, waits for PuzzlePopup AND the
 * target puzzle to register, then auto-opens the puzzle popup.
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

  /**
   * Try to open the puzzle. If PuzzlePopup isn't ready or the puzzle
   * hasn't registered yet, returns false so the caller can retry.
   */
  function tryOpenPuzzle(puzzleKey) {
    if (typeof PuzzlePopup === 'undefined') return false;
    if (PuzzlePopup.isOpen()) return false;

    // Attempt open — if the puzzle is registered, isOpen() will become true
    PuzzlePopup.open(puzzleKey);
    return PuzzlePopup.isOpen();
  }

  function openPuzzleWithRetry(puzzleKey) {
    console.log('[QR-Router] QR route detected: → ' + puzzleKey);

    expandPuzzlesRow();
    scrollToQRSection();

    // Poll until PuzzlePopup AND the target puzzle are ready (up to 8s)
    var attempts = 0;
    var maxAttempts = 80; // 80 × 100ms = 8 seconds
    var poller = setInterval(function () {
      attempts++;
      if (tryOpenPuzzle(puzzleKey)) {
        clearInterval(poller);
        console.log('[QR-Router] Opened puzzle: ' + puzzleKey + ' (attempt ' + attempts + ')');
      } else if (attempts >= maxAttempts) {
        clearInterval(poller);
        console.warn('[QR-Router] Gave up opening puzzle: ' + puzzleKey + ' after ' + attempts + ' attempts');
      }
    }, 100);
  }

  function init() {
    var route = getHashRoute();
    if (!route) return;

    var puzzleKey = ROUTE_MAP[route];
    if (!puzzleKey) {
      console.log('[QR-Router] Unknown route: #' + route);
      return;
    }

    // Wait for DOM ready, then start trying to open
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        openPuzzleWithRetry(puzzleKey);
      });
    } else {
      openPuzzleWithRetry(puzzleKey);
    }
  }

  // Handle hash changes for in-page navigation
  window.addEventListener('hashchange', function () {
    var route = getHashRoute();
    if (route && ROUTE_MAP[route]) {
      openPuzzleWithRetry(ROUTE_MAP[route]);
    }
  });

  init();

})();
