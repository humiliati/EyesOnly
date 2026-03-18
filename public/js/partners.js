/* ============================================================
   EYES ONLY — Partners Page Script
   Phase 3: FAQ accordions, form toggling, client validation,
   and API calls to POST /api/partners/apply.
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
          // SFX: deal card 14 on expand
          if (typeof AudioSystem !== 'undefined') {
            AudioSystem.play('deal_card_14', { volume: 0.45 });
          }
        }
      });
    });
  }

  /* ---- Post-it note hover SFX (deal_card 15-17 random) ---- */

  function bindPostitHoverSounds() {
    var postits = document.querySelectorAll('.postit, .action-card');
    postits.forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        if (typeof AudioSystem !== 'undefined') {
          var n = 15 + Math.floor(Math.random() * 3); // 15, 16, or 17
          AudioSystem.play('deal_card_' + n, { volume: 0.3 });
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

    // Reset any previous success states
    var successEls = document.querySelectorAll('.form-success');
    successEls.forEach(function (s) { s.style.display = 'none'; });
    var formEls = document.querySelectorAll('#business-form, #legal-form, #contact-form');
    formEls.forEach(function (f) { f.style.display = 'block'; });

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
    var buttons = document.querySelectorAll('.porthole-btn[data-form]');
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

  /* ---- API helpers ---- */

  function showApiError(form, msg) {
    var el = form.querySelector('.form-api-error') || createApiErrorEl(form);
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideApiError(form) {
    var el = form.querySelector('.form-api-error');
    if (el) {
      el.style.display = 'none';
      el.textContent = '';
    }
  }

  function createApiErrorEl(form) {
    var el = document.createElement('div');
    el.className = 'form-api-error';
    el.style.cssText = 'margin-top: 12px; padding: 12px 16px; border: 1px solid rgba(255,70,70,0.3); border-radius: 4px; background: rgba(255,70,70,0.06); color: #ff4646; font-size: 13px; text-align: center; display: none;';
    form.appendChild(el);
    return el;
  }

  function setButtonLoading(btn, loading, originalText) {
    var label = btn.querySelector('.porthole-btn-label');
    if (loading) {
      btn.disabled = true;
      btn.classList.add('is-loading');
      if (label) {
        label.setAttribute('data-original', label.innerHTML);
        label.textContent = 'Submitting\u2026';
      } else {
        btn.dataset.origText = btn.textContent;
        btn.textContent = 'Submitting\u2026';
      }
    } else {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (label) {
        var orig = label.getAttribute('data-original');
        if (orig) label.innerHTML = orig;
        else label.textContent = originalText || 'Submit';
      } else {
        btn.textContent = originalText || btn.dataset.origText || 'Submit';
      }
    }
  }

  /* ---- Build request body based on form type ---- */

  function buildRequestBody(form, formType) {
    var body = { form_type: formType };

    if (formType === 'business_signon') {
      body.business_name  = (form.querySelector('[name="business_name"]')  || {}).value || '';
      body.business_type  = (form.querySelector('[name="business_type"]')  || {}).value || '';
      body.contact_name   = (form.querySelector('[name="contact_name"]')   || {}).value || '';
      body.contact_email  = (form.querySelector('[name="contact_email"]')  || {}).value || '';
      body.contact_phone  = (form.querySelector('[name="contact_phone"]')  || {}).value || undefined;
      body.message        = (form.querySelector('[name="message"]')        || {}).value || undefined;
    }

    if (formType === 'legal_disclaimer') {
      body.contact_name   = (form.querySelector('[name="contact_name"]')   || {}).value || '';
      body.contact_email  = (form.querySelector('[name="contact_email"]')  || {}).value || '';
      body.legal_agreed   = !!((form.querySelector('[name="legal_agreed"]') || {}).checked);
    }

    if (formType === 'contact') {
      body.contact_name   = (form.querySelector('[name="contact_name"]')   || {}).value || '';
      body.contact_email  = (form.querySelector('[name="contact_email"]')  || {}).value || '';
      body.subject        = (form.querySelector('[name="subject"]')        || {}).value || undefined;
      body.message        = (form.querySelector('[name="message"]')        || {}).value || '';
    }

    return body;
  }

  /* ---- Form submission with API call ---- */

  function bindFormSubmissions() {
    var forms = [
      { id: 'business-form', successId: 'biz-success', type: 'business_signon', btnText: 'Submit Application' },
      { id: 'legal-form', successId: 'legal-success', type: 'legal_disclaimer', btnText: 'Sign Agreement' },
      { id: 'contact-form', successId: 'contact-success', type: 'contact', btnText: 'Send Message' },
    ];

    forms.forEach(function (cfg) {
      var form = document.getElementById(cfg.id);
      if (!form) return;

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateForm(form)) return;

        var btn = form.querySelector('[type="submit"]');
        hideApiError(form);
        setButtonLoading(btn, true, cfg.btnText);

        var body = buildRequestBody(form, cfg.type);

        fetch('/api/partners/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            setButtonLoading(btn, false, cfg.btnText);

            if (!data.ok) {
              showApiError(form, data.error || 'Something went wrong. Please try again.');
              return;
            }

            // Show success state
            var successEl = document.getElementById(cfg.successId);
            if (successEl) {
              form.style.display = 'none';
              successEl.style.display = 'block';

              // Append reference ID
              var refSpan = successEl.querySelector('.success-ref');
              if (!refSpan) {
                refSpan = document.createElement('div');
                refSpan.className = 'success-ref';
                refSpan.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 10px;';
                successEl.appendChild(refSpan);
              }
              refSpan.textContent = 'Reference ID: #' + data.application.id;
            }
          })
          .catch(function (err) {
            setButtonLoading(btn, false, cfg.btnText);
            showApiError(form, 'Network error. Please check your connection and try again.');
          });
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
    bindPostitHoverSounds();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
