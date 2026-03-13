/* ============================================================
   EYES ONLY — Booking Page Script
   Phase 4: Full form validation, API calls to /api/booking/*,
   three-step flow (booking details → waiver → Stripe checkout → success).
   ============================================================ */

(function () {
  'use strict';

  /* ---- State ---- */

  var currentBookingId = null;

  /* ---- DOM refs ---- */

  var detailsForm   = null;
  var waiverStep    = null;
  var waiverForm    = null;
  var successPanel  = null;
  var bookingError  = null;
  var waiverError   = null;

  /* ---- Scroll to anchor on page load ---- */

  function scrollToAnchor() {
    var hash = window.location.hash;
    if (!hash) return;
    setTimeout(function () {
      var target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  /* ---- Pre-fill scenario from hash or sessionStorage ---- */

  function prefillScenario() {
    var hash = window.location.hash.replace('#', '');
    var scenario = hash || '';
    if (!scenario) {
      try { scenario = sessionStorage.getItem('selected_scenario') || ''; } catch (_) {}
    }
    if (scenario) {
      var sel = document.getElementById('bf-scenario');
      if (sel) {
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === scenario) {
            sel.value = scenario;
            updatePlayerHint(scenario);
            break;
          }
        }
      }
    }
  }

  /* ---- Update player count hint based on scenario ---- */

  function updatePlayerHint(scenario) {
    var hint = document.getElementById('player-hint');
    var input = document.getElementById('bf-players');
    if (!hint || !input) return;

    if (scenario === 'scenario-1') {
      hint.textContent = 'Scenario 1: 2\u201360 players';
      input.min = '2';
      input.max = '60';
      input.placeholder = '2-60';
    } else if (scenario === 'scenario-2') {
      hint.textContent = 'Scenario 2: 3\u201330 players';
      input.min = '3';
      input.max = '30';
      input.placeholder = '3-30';
    } else {
      hint.textContent = 'Scenario 1: 2\u201360 players \u2022 Scenario 2: 3\u201330 players';
      input.min = '2';
      input.max = '60';
      input.placeholder = '2-60';
    }
  }

  /* ---- Validation ---- */

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showFieldError(input, message) {
    var existing = input.parentElement.querySelector('.field-error');
    if (existing) existing.remove();

    var err = document.createElement('div');
    err.className = 'field-error';
    err.textContent = message;
    input.parentElement.appendChild(err);
    input.style.borderColor = 'rgba(255, 70, 70, 0.5)';
  }

  function clearFieldErrors(form) {
    var errors = form.querySelectorAll('.field-error');
    errors.forEach(function (e) { e.remove(); });
    var inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(function (inp) { inp.style.borderColor = ''; });
  }

  function validateBookingForm(form) {
    clearFieldErrors(form);
    var valid = true;

    var scenario = form.querySelector('[name="scenario_type"]');
    if (!scenario.value) {
      showFieldError(scenario, 'Please select a mission type');
      valid = false;
    }

    var name = form.querySelector('[name="lead_name"]');
    if (!name.value.trim()) {
      showFieldError(name, 'Lead contact name is required');
      valid = false;
    }

    var email = form.querySelector('[name="lead_email"]');
    if (!email.value.trim()) {
      showFieldError(email, 'Email is required');
      valid = false;
    } else if (!isValidEmail(email.value.trim())) {
      showFieldError(email, 'Please enter a valid email');
      valid = false;
    }

    var players = form.querySelector('[name="player_count"]');
    var count = parseInt(players.value, 10);
    if (!players.value || isNaN(count) || count < 1) {
      showFieldError(players, 'Player count is required');
      valid = false;
    } else if (scenario.value === 'scenario-1' && (count < 2 || count > 60)) {
      showFieldError(players, 'Scenario 1 requires 2\u201360 players');
      valid = false;
    } else if (scenario.value === 'scenario-2' && (count < 3 || count > 30)) {
      showFieldError(players, 'Scenario 2 requires 3\u201330 players');
      valid = false;
    }

    return valid;
  }

  function validateWaiverForm(form) {
    clearFieldErrors(form);
    var valid = true;

    var name = form.querySelector('[name="signature_name"]');
    if (!name.value.trim()) {
      showFieldError(name, 'Full legal name is required');
      valid = false;
    }

    var agree = form.querySelector('[name="waiver_agreed"]');
    if (!agree.checked) {
      showFieldError(agree, 'You must agree to the waiver');
      valid = false;
    }

    return valid;
  }

  /* ---- API helpers ---- */

  function showApiError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideApiError(el) {
    el.style.display = 'none';
    el.textContent = '';
  }

  function setButtonLoading(btn, loading, originalText) {
    if (loading) {
      btn.disabled = true;
      btn.classList.add('is-loading');
      btn.textContent = 'Processing\u2026';
    } else {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.textContent = originalText;
    }
  }

  /* ---- Step 1: Submit booking details ---- */

  function handleBookingSubmit(e) {
    e.preventDefault();
    if (!validateBookingForm(detailsForm)) return;

    var btn = document.getElementById('booking-submit-btn');
    hideApiError(bookingError);
    setButtonLoading(btn, true, 'Submit Booking Request');

    var body = {
      scenario_type:    detailsForm.querySelector('[name="scenario_type"]').value,
      group_name:       detailsForm.querySelector('[name="group_name"]').value.trim() || undefined,
      lead_name:        detailsForm.querySelector('[name="lead_name"]').value.trim(),
      lead_email:       detailsForm.querySelector('[name="lead_email"]').value.trim(),
      lead_phone:       detailsForm.querySelector('[name="lead_phone"]').value.trim() || undefined,
      player_count:     parseInt(detailsForm.querySelector('[name="player_count"]').value, 10),
      preferred_date:   detailsForm.querySelector('[name="preferred_date"]').value || undefined,
      preferred_time:   detailsForm.querySelector('[name="preferred_time"]').value || undefined,
      emergency_name:   detailsForm.querySelector('[name="emergency_name"]').value.trim() || undefined,
      emergency_phone:  detailsForm.querySelector('[name="emergency_phone"]').value.trim() || undefined,
      emergency_relation: detailsForm.querySelector('[name="emergency_relation"]').value.trim() || undefined,
      notes:            detailsForm.querySelector('[name="notes"]').value.trim() || undefined,
    };

    fetch('/api/booking/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        setButtonLoading(btn, false, 'Submit Booking Request');
        if (!data.ok) {
          showApiError(bookingError, data.error || 'Something went wrong. Please try again.');
          return;
        }

        // Booking created — move to waiver step
        currentBookingId = data.booking.id;

        // Persist booking ID for Stripe return
        try { sessionStorage.setItem('eo_booking_id', String(data.booking.id)); } catch (_) {}

        // Hide details form, show waiver
        detailsForm.style.display = 'none';
        waiverStep.style.display = 'block';

        // Pre-fill waiver email
        var waiverEmail = document.getElementById('wf-email');
        if (waiverEmail) waiverEmail.value = body.lead_email;

        // Show confirmation banner
        var banner = document.getElementById('booking-confirm-banner');
        var scenarioLabel = body.scenario_type === 'scenario-1'
          ? 'Scenario 1 \u2014 24-Hour Field Exercise'
          : 'Scenario 2 \u2014 72-Hour Extended Operation';
        banner.innerHTML = 'Booking <strong>#' + data.booking.id + '</strong> created for <strong>' +
          scenarioLabel + '</strong> (' + body.player_count + ' players).<br>' +
          'Please review and sign the liability waiver below to proceed to payment.';

        // Scroll to waiver
        setTimeout(function () {
          waiverStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        // Store scenario for reference
        try { sessionStorage.setItem('selected_scenario', body.scenario_type); } catch (_) {}
      })
      .catch(function () {
        setButtonLoading(btn, false, 'Submit Booking Request');
        showApiError(bookingError, 'Network error. Please check your connection and try again.');
      });
  }

  /* ---- Step 2: Submit waiver → then redirect to Stripe ---- */

  function handleWaiverSubmit(e) {
    e.preventDefault();
    if (!validateWaiverForm(waiverForm)) return;
    if (!currentBookingId) return;

    var btn = document.getElementById('waiver-submit-btn');
    hideApiError(waiverError);
    setButtonLoading(btn, true, 'Sign Waiver & Proceed to Payment');

    var body = {
      waiver_version: 'v1.0-draft',
      signature_name: waiverForm.querySelector('[name="signature_name"]').value.trim(),
    };

    fetch('/api/booking/' + currentBookingId + '/waiver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) {
          setButtonLoading(btn, false, 'Sign Waiver & Proceed to Payment');
          showApiError(waiverError, data.error || 'Failed to sign waiver. Please try again.');
          return;
        }

        // Waiver signed — now create Stripe Checkout session
        btn.textContent = 'Redirecting to payment\u2026';
        redirectToStripeCheckout();
      })
      .catch(function () {
        setButtonLoading(btn, false, 'Sign Waiver & Proceed to Payment');
        showApiError(waiverError, 'Network error. Please check your connection and try again.');
      });
  }

  /* ---- Step 3: Redirect to Stripe Hosted Checkout ---- */

  function redirectToStripeCheckout() {
    fetch('/api/booking/' + currentBookingId + '/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok || !data.checkout_url) {
          var btn = document.getElementById('waiver-submit-btn');
          setButtonLoading(btn, false, 'Sign Waiver & Proceed to Payment');
          showApiError(waiverError, data.error || 'Failed to create checkout session. Please try again.');
          return;
        }

        // Redirect to Stripe's hosted checkout page (SAQ A — no card data on our servers)
        window.location.href = data.checkout_url;
      })
      .catch(function () {
        var btn = document.getElementById('waiver-submit-btn');
        setButtonLoading(btn, false, 'Sign Waiver & Proceed to Payment');
        showApiError(waiverError, 'Network error. Could not reach payment provider.');
      });
  }

  /* ---- Handle return from Stripe Checkout ---- */

  function handleCheckoutReturn() {
    var params = new URLSearchParams(window.location.search);
    var checkoutStatus = params.get('checkout');
    var sessionId = params.get('session_id');
    var cancelBookingId = params.get('booking_id');

    if (!checkoutStatus) return false; // Not a checkout return

    // Hide the booking form, show appropriate state
    if (detailsForm) detailsForm.style.display = 'none';
    if (waiverStep) waiverStep.style.display = 'none';

    if (checkoutStatus === 'success' && sessionId) {
      // Verify payment with our API
      successPanel.style.display = 'block';
      var msg = document.getElementById('booking-success-msg');
      var ref = document.getElementById('booking-ref');
      if (msg) msg.textContent = 'Verifying your payment\u2026';
      if (ref) ref.textContent = '';

      fetch('/api/booking/verify-payment?session_id=' + encodeURIComponent(sessionId))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.ok && data.payment_status === 'paid') {
            if (msg) msg.textContent = 'Payment confirmed! Your mission booking is secured. Check your email for confirmation and next steps.';
            if (ref) ref.textContent = 'Booking Reference: #' + data.booking_id;
          } else {
            if (msg) msg.textContent = 'Payment is being processed. You will receive an email once confirmed.';
            if (ref && data.booking_id) ref.textContent = 'Booking Reference: #' + data.booking_id;
          }
        })
        .catch(function () {
          if (msg) msg.textContent = 'Payment received. If you do not receive a confirmation email within a few minutes, please contact us.';
        });

      // Clean up URL params without reload
      try { window.history.replaceState({}, '', '/booking.html'); } catch (_) {}
      return true;
    }

    if (checkoutStatus === 'cancel') {
      // User cancelled — show the form again with a message
      if (detailsForm) detailsForm.style.display = 'block';
      var cancelBanner = document.createElement('div');
      cancelBanner.className = 'form-api-error';
      cancelBanner.style.display = 'block';
      cancelBanner.style.marginBottom = '20px';
      cancelBanner.textContent = 'Payment was cancelled. Your booking is saved — you can try again by clicking "Book This Mission" above.';
      if (detailsForm) detailsForm.insertBefore(cancelBanner, detailsForm.firstChild);

      // Clean up URL params without reload
      try { window.history.replaceState({}, '', '/booking.html'); } catch (_) {}
      return true;
    }

    return false;
  }

  /* ---- Book buttons on scenario cards → scroll to form ---- */

  function bindBookButtons() {
    var buttons = document.querySelectorAll('.scenario-book-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var scenario = btn.getAttribute('data-scenario');

        // Pre-select scenario in form
        var sel = document.getElementById('bf-scenario');
        if (sel && scenario) {
          sel.value = scenario;
          updatePlayerHint(scenario);
        }

        // Store for backup
        try { sessionStorage.setItem('selected_scenario', scenario); } catch (_) {}

        // Scroll to form
        var formSection = document.getElementById('booking-form');
        if (formSection) {
          formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* ---- Scenario select change → update player hint ---- */

  function bindScenarioSelect() {
    var sel = document.getElementById('bf-scenario');
    if (!sel) return;
    sel.addEventListener('change', function () {
      updatePlayerHint(sel.value);
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
    detailsForm  = document.getElementById('booking-details-form');
    waiverStep   = document.getElementById('booking-waiver-step');
    waiverForm   = document.getElementById('waiver-form');
    successPanel = document.getElementById('booking-success');
    bookingError = document.getElementById('booking-api-error');
    waiverError  = document.getElementById('waiver-api-error');

    // Check if this is a return from Stripe Checkout
    var isReturn = handleCheckoutReturn();
    if (isReturn) {
      bindNavScroll();
      return; // Don't init the rest of the form
    }

    scrollToAnchor();
    prefillScenario();
    bindBookButtons();
    bindScenarioSelect();
    bindNavScroll();

    if (detailsForm) detailsForm.addEventListener('submit', handleBookingSubmit);
    if (waiverForm)  waiverForm.addEventListener('submit', handleWaiverSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
