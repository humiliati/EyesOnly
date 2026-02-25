/* ============================================================
   EYES ONLY - Onboarding Splash Screen
   "YOU'VE GONE ROGUE" title card with progress bar.
   Plays once before each run, then fires a callback to start.
   ============================================================ */

const OnboardingSplash = (function() {
  'use strict';

  var _isShowing = false;

  /**
   * Show the splash screen, then call onComplete when done.
   *
   * Timeline:
   *   0ms       — overlay fades in (500ms ease-out)
   *   500ms     — title + subtitle visible
   *   800ms     — progress bar begins filling (1200ms linear)
   *   2000ms    — progress bar full
   *   2200ms    — overlay fades up and out (400ms)
   *   2600ms    — overlay removed, onComplete() fires
   *
   * @param {Function} onComplete - Called after splash dismisses
   */
  function show(onComplete) {
    if (_isShowing) return;
    _isShowing = true;

    // Clean up any leftover
    var existing = document.getElementById('onboarding-splash');
    if (existing) existing.remove();

    // Build DOM
    var overlay = document.createElement('div');
    overlay.id = 'onboarding-splash';
    overlay.className = 'onboarding-overlay';

    // Title: "YOU'VE GONE" (white) + "ROGUE" (red accent)
    var titleEl = document.createElement('div');
    titleEl.className = 'onboarding-title';
    titleEl.innerHTML = "YOU'VE GONE <span class=\"title-accent\">ROGUE</span>";
    overlay.appendChild(titleEl);

    // Subtitle
    var subEl = document.createElement('div');
    subEl.className = 'onboarding-subtitle';
    subEl.textContent = '// INITIALIZING FIELD PROTOCOL';
    overlay.appendChild(subEl);

    // Progress bar container
    var barContainer = document.createElement('div');
    barContainer.className = 'onboarding-progress-container';

    var barFill = document.createElement('div');
    barFill.className = 'onboarding-progress-fill';
    barContainer.appendChild(barFill);

    overlay.appendChild(barContainer);

    // Scan line decoration (subtle horizontal line that sweeps down)
    var scanLine = document.createElement('div');
    scanLine.className = 'onboarding-scanline';
    overlay.appendChild(scanLine);

    document.body.appendChild(overlay);

    // Phase 1: Fade in (handled by CSS animation on .onboarding-overlay)

    // Phase 2: Start progress bar fill after title settles
    setTimeout(function() {
      barFill.classList.add('filling');
    }, 800);

    // Phase 3: Fade out and dismiss
    setTimeout(function() {
      overlay.classList.add('onboarding-fade-out');

      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        _isShowing = false;

        if (typeof onComplete === 'function') {
          onComplete();
        }
      }, 400);
    }, 2200);
  }

  /**
   * Skip/cancel the splash immediately (e.g., on tap/click).
   * Removes the overlay and fires onComplete if stored.
   */
  function skip() {
    var overlay = document.getElementById('onboarding-splash');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    _isShowing = false;
  }

  function isShowing() {
    return _isShowing;
  }

  return {
    show: show,
    skip: skip,
    isShowing: isShowing
  };
})();
