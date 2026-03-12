/* ============================================================
   EYES ONLY — Booking Page Script
   Handles scroll-to-anchor from splash screen routing,
   "Book This Mission" button clicks, and nav scroll behavior.
   Phase 3 will add form validation + API calls.
   Phase 4 will add Stripe checkout redirect.
   ============================================================ */

(function () {
  'use strict';

  /* ---- Scroll to anchor on page load ---- */

  function scrollToAnchor() {
    var hash = window.location.hash;
    if (!hash) return;

    // Small delay to ensure DOM is fully rendered
    setTimeout(function () {
      var target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  /* ---- Book buttons → scroll to booking form ---- */

  function bindBookButtons() {
    var buttons = document.querySelectorAll('.scenario-book-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var scenario = btn.getAttribute('data-scenario');
        var formSection = document.getElementById('booking-form');
        if (formSection) {
          formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Store selected scenario for Phase 3 form pre-fill
        try {
          sessionStorage.setItem('selected_scenario', scenario);
        } catch (_) {}
      });
    });
  }

  /* ---- Nav scroll effect ---- */

  function bindNavScroll() {
    var nav = document.getElementById('eo-nav');
    if (!nav) return;

    var scrolled = false;
    window.addEventListener('scroll', function () {
      var shouldBeScrolled = window.scrollY > 40;
      if (shouldBeScrolled !== scrolled) {
        scrolled = shouldBeScrolled;
        nav.style.borderBottomColor = scrolled
          ? 'rgba(28, 255, 155, 0.3)'
          : 'rgba(28, 255, 155, 0.15)';
      }
    }, { passive: true });
  }

  /* ---- Init ---- */

  function init() {
    scrollToAnchor();
    bindBookButtons();
    bindNavScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
