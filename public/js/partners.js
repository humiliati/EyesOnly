/* ============================================================
   EYES ONLY — Partners Page Script
   Handles FAQ accordions, form toggling, and basic validation.
   Phase 3 will wire forms to POST /api/partners/apply.
   ============================================================ */

(function () {
  'use strict';

  /* ---- FAQ Accordion ---- */

  function bindFAQ() {
    var items = document.querySelectorAll('.faq-item');
    items.forEach(function (item) {
      var btn = item.querySelector('.faq-question');
      if (!btn) return;

      btn.addEventListener('click', function () {
        var isOpen = item.classList.contains('faq-open');

        // Close all
        items.forEach(function (other) {
          other.classList.remove('faq-open');
          var otherBtn = other.querySelector('.faq-question');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        });

        // Toggle clicked
        if (!isOpen) {
          item.classList.add('faq-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---- Form toggling ---- */

  var activeFormId = null;

  function showForm(formType) {
    var formsSection = document.getElementById('forms-section');
    var allForms = document.querySelectorAll('.partner-form');

    // Hide all forms
    allForms.forEach(function (f) { f.style.display = 'none'; });

    // Show the target form
    var target = document.getElementById('form-' + formType);
    if (target) {
      formsSection.style.display = 'block';
      target.style.display = 'block';
      activeFormId = formType;

      // Scroll to form
      setTimeout(function () {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  function hideForm() {
    var formsSection = document.getElementById('forms-section');
    var allForms = document.querySelectorAll('.partner-form');
    allForms.forEach(function (f) { f.style.display = 'none'; });
    formsSection.style.display = 'none';
    activeFormId = null;
  }

  function bindActionCards() {
    var buttons = document.querySelectorAll('.action-card-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var formType = btn.getAttribute('data-form');
        if (formType) showForm(formType);
      });
    });
  }

  function bindFormCloseButtons() {
    var closeButtons = document.querySelectorAll('[data-close-form]');
    closeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        hideForm();
      });
    });
  }

  /* ---- Basic client-side validation ---- */

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showFieldError(input, message) {
    // Remove existing error
    var existing = input.parentElement.querySelector('.field-error');
    if (existing) existing.remove();

    var err = document.createElement('div');
    err.className = 'field-error';
    err.style.cssText = 'color: #ff4646; font-size: 11px; margin-top: 4px;';
    err.textContent = message;
    input.parentElement.appendChild(err);
    input.style.borderColor = 'rgba(255, 70, 70, 0.5)';
  }

  function clearFieldErrors(form) {
    var errors = form.querySelectorAll('.field-error');
    errors.forEach(function (e) { e.remove(); });
    var inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(function (inp) {
      inp.style.borderColor = '';
    });
  }

  function validateForm(form) {
    clearFieldErrors(form);
    var valid = true;

    // Required fields
    var required = form.querySelectorAll('[required]');
    required.forEach(function (field) {
      if (field.type === 'checkbox') {
        if (!field.checked) {
          showFieldError(field, 'This field is required');
          valid = false;
        }
      } else if (!field.value.trim()) {
        showFieldError(field, 'This field is required');
        valid = false;
      }
    });

    // Email validation
    var emails = form.querySelectorAll('input[type="email"]');
    emails.forEach(function (email) {
      if (email.value.trim() && !validateEmail(email.value.trim())) {
        showFieldError(email, 'Please enter a valid email address');
        valid = false;
      }
    });

    return valid;
  }

  /* ---- Form submission (Phase 3 placeholder) ---- */

  function bindFormSubmissions() {
    var forms = [
      { id: 'business-form', successId: 'biz-success', type: 'business_signon' },
      { id: 'legal-form', successId: 'legal-success', type: 'legal_disclaimer' },
      { id: 'contact-form', successId: 'contact-success', type: 'contact' },
    ];

    forms.forEach(function (cfg) {
      var form = document.getElementById(cfg.id);
      if (!form) return;

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        if (!validateForm(form)) return;

        // Phase 3: POST to /api/partners/apply
        // For now, show success state
        var successEl = document.getElementById(cfg.successId);
        if (successEl) {
          form.style.display = 'none';
          successEl.style.display = 'block';
        }
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
    bindFAQ();
    bindActionCards();
    bindFormCloseButtons();
    bindFormSubmissions();
    bindNavScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
