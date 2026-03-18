/**
 * games-nav.js — Sticky Note Nav + Torso Button Controller
 *
 * Handles:
 * - Desktop: Sticky note nav click → smooth scroll to section + active state
 * - Mobile: Torso button click → smooth scroll to section + expand row
 * - Scroll-spy: highlights current section in nav as user scrolls
 */
(function () {
  'use strict';

  // ---- Scroll to section ----
  function scrollToRow(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return;

    // Expand the row if collapsed
    var btn = el.querySelector('.games-row-header');
    var bodyId = btn ? btn.getAttribute('data-target') : null;
    var body = bodyId ? document.getElementById(bodyId) : null;

    if (btn && body && btn.getAttribute('aria-expanded') !== 'true') {
      btn.setAttribute('aria-expanded', 'true');
      body.classList.add('games-row-body-open');
      var chevron = btn.querySelector('.games-row-chevron');
      if (chevron) chevron.innerHTML = '&#9662;';
    }

    // Smooth scroll
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Desktop: sticky note nav items ----
  document.querySelectorAll('.games-v2-nav-item[data-target]').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToRow(item.getAttribute('data-target'));
    });
  });

  // ---- Mobile: torso porthole buttons ----
  document.querySelectorAll('.games-v2-torso-btn[data-target]').forEach(function (btn) {
    // Init starfield canvas
    var canvas = btn.querySelector('.torso-starfield');
    if (canvas) initTorsoStarfield(canvas);

    btn.addEventListener('click', function () {
      scrollToRow(btn.getAttribute('data-target'));

      // Update active state
      document.querySelectorAll('.games-v2-torso-btn').forEach(function (b) { b.classList.remove('active', 'porthole-open'); });
      btn.classList.add('active');

      // Porthole flash: open for 600ms then close
      btn.classList.add('porthole-open');
      setTimeout(function () { btn.classList.remove('porthole-open'); }, 600);
    });
  });

  // ---- Tiny starfield for torso porthole effect ----
  function initTorsoStarfield(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var w = canvas.width;
    var h = canvas.height;
    var stars = [];
    for (var i = 0; i < 30; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        a: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.3 + 0.1
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#060808';
      ctx.fillRect(0, 0, w, h);
      for (var j = 0; j < stars.length; j++) {
        var s = stars[j];
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + s.a + ')';
        ctx.fill();
        s.x -= s.speed;
        if (s.x < 0) { s.x = w; s.y = Math.random() * h; }
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  // ---- Scroll-spy: track which section is in view ----
  var navItems = document.querySelectorAll('.games-v2-nav-item[data-target]');
  var torsoButtons = document.querySelectorAll('.games-v2-torso-btn[data-target]');

  if (navItems.length || torsoButtons.length) {
    var rowIds = [];
    navItems.forEach(function (item) { rowIds.push(item.getAttribute('data-target')); });

    var scrollContainer = document.querySelector('.games-content') || window;
    var scrollEl = scrollContainer === window ? document.documentElement : scrollContainer;

    function updateScrollSpy() {
      var currentId = null;
      var scrollTop = (scrollContainer === window) ? window.scrollY : scrollContainer.scrollTop;

      for (var i = rowIds.length - 1; i >= 0; i--) {
        var el = document.getElementById(rowIds[i]);
        if (!el) continue;
        var rect = el.getBoundingClientRect();
        if (rect.top <= 150) {
          currentId = rowIds[i];
          break;
        }
      }

      // Update desktop nav
      navItems.forEach(function (item) {
        if (item.getAttribute('data-target') === currentId) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      // Update mobile torso
      torsoButtons.forEach(function (btn) {
        if (btn.getAttribute('data-target') === currentId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // Debounced scroll listener
    var scrollTimer = null;
    var target = document.querySelector('.games-content') || window;
    target.addEventListener('scroll', function () {
      if (scrollTimer) return;
      scrollTimer = setTimeout(function () {
        scrollTimer = null;
        updateScrollSpy();
      }, 100);
    }, { passive: true });

    // Also listen on window scroll for the desktop layout where games-content may not scroll
    if (target !== window) {
      window.addEventListener('scroll', function () {
        if (scrollTimer) return;
        scrollTimer = setTimeout(function () {
          scrollTimer = null;
          updateScrollSpy();
        }, 100);
      }, { passive: true });
    }

    // Initial
    updateScrollSpy();
  }

})();
