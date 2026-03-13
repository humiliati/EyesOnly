/* ============================================================
   Splash Screen — Mission Select Landing
   Phase 5: Metallic coin-card dossiers with decoder-ring wheels,
   card-suit branding, inline CTA booking with dynamic pricing.
   ============================================================ */

const SplashScreen = (() => {
  'use strict';

  /* ============================================================
     PRICING — Non-linear group scaling
     Scenario 1: 2 → $500, climbs fast then plateaus at 60 → $1100
     Scenario 2: 3 → $1200, climbs fast then plateaus at 30 → $4200
     Uses an ease-out curve (sqrt) for "climbs fast then flattens".
     ============================================================ */

  function calcPrice(scenario, groupSize) {
    if (scenario === 'scenario-1') {
      var min = 2, max = 60, pMin = 500, pMax = 1100;
      var t = Math.min(1, Math.max(0, (groupSize - min) / (max - min)));
      return Math.round(pMin + (pMax - pMin) * Math.sqrt(t));
    }
    if (scenario === 'scenario-2') {
      var min2 = 3, max2 = 30, pMin2 = 1200, pMax2 = 4200;
      var t2 = Math.min(1, Math.max(0, (groupSize - min2) / (max2 - min2)));
      return Math.round(pMin2 + (pMax2 - pMin2) * Math.sqrt(t2));
    }
    return 0;
  }

  /* ---- Configuration ---- */

  const MISSIONS = [
    {
      id: 'scenario-1',
      title: 'Scenario 1',
      desc: 'Live field exercise',
      suit: '\u2660',        // ♠
      suitClass: 'suit-spade',
      duration: '24 HR',
      defaultGroup: 2,
      minGroup: 2,
      maxGroup: 60,
      classified: 'EYES ONLY',
      label: 'MISSION DOSSIER',
      videoIndex: 0,
      route: '/booking.html#scenario-1',
    },
    {
      id: 'scenario-2',
      title: 'Scenario 2',
      desc: 'Extended operation',
      suit: '\u2663',        // ♣
      suitClass: 'suit-club',
      duration: '72 HR',
      defaultGroup: 3,
      minGroup: 3,
      maxGroup: 30,
      classified: 'TOP SECRET',
      label: 'MISSION DOSSIER',
      videoIndex: 1,
      route: '/booking.html#scenario-2',
    },
    {
      id: 'partner',
      title: 'Local Partner',
      desc: 'For businesses, actors & volunteers',
      suit: '\u2665',        // ♥
      suitClass: 'suit-heart',
      duration: null,         // no booking wheel
      defaultGroup: null,
      minGroup: null,
      maxGroup: null,
      classified: 'UNCLASSIFIED',
      label: 'RECRUITMENT',
      videoIndex: 2,
      route: '/partners.html',
    },
    {
      id: 'minigames',
      title: 'Mini Games',
      desc: 'Puzzles, decryption keys & toys',
      suit: '\u2666',        // ♦
      suitClass: 'suit-diamond',
      duration: null,         // no booking wheel
      defaultGroup: null,
      minGroup: null,
      maxGroup: null,
      classified: 'FIELD KIT',
      label: 'RECREATION',
      videoIndex: 0,          // reuse first video
      route: '/games.html',
      btnLabel: 'PLAY',
      btnDuration: 'NOW',
      btnClass: 'coin-book-diamond',
      tags: ['PUZZLES', 'DECRYPTION', 'TOYS'],
    },
  ];

  // Background drone footage
  const VIDEO_SOURCES = [
    '/video/Sandpoint2_%20Lake%20Pend%20Oreille.mp4',
    '/video/Sandpoint3_%20Lake%20Pend%20Oreille.mp4',
    '/video/Sandpoint%20_%20Lake%20Pend%20Oreille.mp4',
  ];

  // Silhouette image assets
  const SIL_POOL = [
    '/assets/Images/Splash/spy_classic_splash.png',
    '/assets/Images/Splash/spy_female_splash.png',
    '/assets/Images/Splash/spy_female_classic_splash.png',
    '/assets/Images/Splash/spy_male2_splash.png',
    '/assets/Images/Splash/spy_male_splash.png',
  ];

  const HOVER_SOUNDS  = ['card-slide_card_1', 'card-slide_card_2', 'card-slide_card_3'];
  const SELECT_SOUNDS = ['card-fold_hand_1', 'card-fold_hand_2', 'card-fold_hand_3'];
  const WHEEL_SOUND   = 'clickandrelease-1';

  let splashEl = null;
  let dismissed = false;
  let audioReady = false;

  // Per-card wheel state: { groupSize, price }
  const cardState = {};

  // Mobile touch state
  let hoveredCardEl = null;           // currently "hovered" card on touch devices
  let isDraggingWheel = false;        // true while a wheel drag is in progress
  const LONG_PRESS_MS = 500;          // ms threshold for long-press → select
  const TAP_MOVE_TOLERANCE = 12;      // px — if finger moves more, it's a drag not a tap

  /* ---- Helpers ---- */

  function _playAudio(key, opts) {
    if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
      try { AudioSystem.play(key, opts || {}); } catch (_) {}
    }
  }

  function _ensureAudioInit() {
    if (audioReady) return;
    if (typeof AudioSystem !== 'undefined' && AudioSystem.init) {
      try { AudioSystem.init(); } catch (_) {}
    }
    audioReady = true;
  }

  /* ---- Build DOM ---- */

  function buildSplash() {
    const el = document.createElement('div');
    el.id = 'splash-screen';

    el.innerHTML = `
      <div class="splash-atmosphere">
        <div class="splash-atmo-base"></div>
        <div class="splash-atmo-fog"></div>
        <div class="splash-atmo-noise"></div>
        <div class="splash-atmo-light"></div>
        <div class="splash-atmo-horizon"></div>
      </div>
      <div class="splash-video-layer" id="splash-video-layer">
        ${VIDEO_SOURCES.map((src, i) =>
          `<video id="splash-vid-${i}" src="${src}" muted loop playsinline preload="auto"
                  ${i === 0 ? 'class="splash-video-active"' : ''}></video>`
        ).join('')}
      </div>
      <div class="splash-scanlines"></div>
      <div class="splash-particles" id="splash-particles"></div>
      <button class="splash-close-btn" id="splash-close-btn" aria-label="Close splash" title="Skip to Terminal">
        <span class="splash-close-icon">&#x1F5B3;</span>
      </button>
      <div class="splash-header">
        <div class="splash-title">Eyes Only</div>
        <div class="splash-subtitle">Select Your Mission</div>
      </div>
      <div class="splash-card-fan" id="splash-card-fan">
        ${MISSIONS.map((m, i) => buildCard(m, i)).join('')}
      </div>
      <div class="splash-prompt">
        <div class="splash-prompt-text">Choose a dossier to begin</div>
      </div>
      <div class="splash-silhouettes" id="splash-silhouettes">
        <div class="splash-sil-css splash-sil-css-a"></div>
        <div class="splash-sil-css splash-sil-css-b"></div>
        <div class="splash-sil-css splash-sil-css-c"></div>
        <div class="splash-sil splash-sil-bottom splash-sil-slot-a" id="sil-slot-a" style="display:none">
          <img src="" alt="" class="splash-sil-img" />
        </div>
        <div class="splash-sil splash-sil-bottom splash-sil-slot-b" id="sil-slot-b" style="display:none">
          <img src="" alt="" class="splash-sil-img" />
        </div>
        <div class="splash-sil splash-sil-bottom splash-sil-slot-c" id="sil-slot-c" style="display:none">
          <img src="" alt="" class="splash-sil-img" />
        </div>
      </div>
      <div class="splash-fade-overlay" id="splash-fade-overlay"></div>
    `;

    return el;
  }

  function buildCard(mission, index) {
    const isBookable = mission.duration !== null;
    const groupSize = mission.defaultGroup || 0;
    const price = isBookable ? calcPrice(mission.id, groupSize) : 0;

    // Initialize card state
    if (isBookable) {
      cardState[mission.id] = { groupSize: groupSize, price: price };
    }

    // Corner suit symbols (top-left, bottom-right like playing cards)
    const cornerTL = `<div class="coin-corner coin-corner-tl"><span class="coin-corner-suit ${mission.suitClass}">${mission.suit}</span></div>`;
    const cornerBR = `<div class="coin-corner coin-corner-br"><span class="coin-corner-suit ${mission.suitClass}">${mission.suit}</span></div>`;

    // Mid-row: BOOK.duration button (bookable) or custom action button
    var btnLabel = mission.btnLabel || (isBookable ? 'BOOK' : 'JOIN');
    var btnDuration = mission.btnDuration || (isBookable ? mission.duration : 'NOW');
    var btnExtraClass = mission.btnClass || (isBookable ? '' : 'coin-book-partner');
    let midRow = `
        <div class="coin-mid-row">
          <button class="coin-book-btn ${btnExtraClass}" data-mission="${mission.id}" data-index="${index}">
            <span class="coin-book-label">${btnLabel}</span><span class="coin-book-dot">.</span><span class="coin-book-duration">${btnDuration}</span>
          </button>
        </div>`;

    // Bottom strip: decoder wheels (bookable) or tags
    let bottomStrip = '';
    if (isBookable) {
      bottomStrip = `
        <div class="coin-wheel-strip">
          <div class="coin-wheel" data-wheel="price" data-mission="${mission.id}">
            <div class="coin-wheel-frame">
              <div class="coin-wheel-track" id="wheel-price-${mission.id}">
                <div class="coin-wheel-val coin-wheel-prev"></div>
                <div class="coin-wheel-val coin-wheel-current">$${price}</div>
                <div class="coin-wheel-val coin-wheel-next"></div>
              </div>
            </div>
            <div class="coin-wheel-ctx">${groupSize} players</div>
          </div>
          <div class="coin-wheel" data-wheel="group" data-mission="${mission.id}">
            <div class="coin-wheel-frame">
              <div class="coin-wheel-track" id="wheel-group-${mission.id}">
                <div class="coin-wheel-val coin-wheel-prev"></div>
                <div class="coin-wheel-val coin-wheel-current">${groupSize}</div>
                <div class="coin-wheel-val coin-wheel-next"></div>
              </div>
            </div>
            <div class="coin-wheel-ctx">$${price}</div>
          </div>
        </div>`;
    } else {
      var tags = mission.tags || ['BUSINESSES', 'ACTORS', 'VOLUNTEERS'];
      bottomStrip = `
        <div class="coin-tag-strip">
          ${tags.map(function (t) { return '<span class="coin-tag">' + t + '</span>'; }).join('')}
        </div>`;
    }

    return `
      <div class="splash-dossier coin-card" data-mission="${mission.id}" data-index="${index}">
        <div class="coin-border-outer">
          <div class="coin-border-inner">
            ${cornerTL}
            ${cornerBR}
            <div class="coin-header">
              <div class="coin-classified">${mission.classified}</div>
              <div class="coin-label">${mission.label}</div>
            </div>
            <div class="coin-artwork">
              <div class="coin-suit-large ${mission.suitClass}">${mission.suit}</div>
            </div>
            <div class="coin-info">
              <div class="coin-title">${mission.title}</div>
              <div class="coin-desc">${mission.desc}</div>
            </div>
            ${midRow}
            ${bottomStrip}
          </div>
        </div>
      </div>
    `;
  }

  /* ---- Decoder Ring Wheel Logic ---- */

  function updateWheelDisplay(missionId) {
    var state = cardState[missionId];
    if (!state) return;
    var mission = MISSIONS.find(function (m) { return m.id === missionId; });
    if (!mission) return;

    // Update group wheel
    var groupTrack = document.getElementById('wheel-group-' + missionId);
    if (groupTrack) {
      var prevG = state.groupSize > mission.minGroup ? state.groupSize - 1 : '';
      var nextG = state.groupSize < mission.maxGroup ? state.groupSize + 1 : '';
      groupTrack.querySelector('.coin-wheel-prev').textContent = prevG;
      groupTrack.querySelector('.coin-wheel-current').textContent = state.groupSize;
      groupTrack.querySelector('.coin-wheel-next').textContent = nextG;
    }

    // Update price wheel
    var priceTrack = document.getElementById('wheel-price-' + missionId);
    if (priceTrack) {
      var prevPrice = state.groupSize > mission.minGroup
        ? '$' + calcPrice(missionId, state.groupSize - 1) : '';
      var nextPrice = state.groupSize < mission.maxGroup
        ? '$' + calcPrice(missionId, state.groupSize + 1) : '';
      priceTrack.querySelector('.coin-wheel-prev').textContent = prevPrice;
      priceTrack.querySelector('.coin-wheel-current').textContent = '$' + state.price;
      priceTrack.querySelector('.coin-wheel-next').textContent = nextPrice;
    }

    // Update context labels
    var card = splashEl.querySelector('[data-mission="' + missionId + '"]');
    if (card) {
      var priceWheel = card.querySelector('[data-wheel="price"] .coin-wheel-ctx');
      var groupWheel = card.querySelector('[data-wheel="group"] .coin-wheel-ctx');
      if (priceWheel) priceWheel.textContent = state.groupSize + ' players';
      if (groupWheel) groupWheel.textContent = '$' + state.price;
    }
  }

  function adjustGroup(missionId, delta) {
    var state = cardState[missionId];
    var mission = MISSIONS.find(function (m) { return m.id === missionId; });
    if (!state || !mission) return;

    var newSize = state.groupSize + delta;
    if (newSize < mission.minGroup || newSize > mission.maxGroup) return;

    state.groupSize = newSize;
    state.price = calcPrice(missionId, newSize);

    // Animate wheel tick
    _playAudio(WHEEL_SOUND, { volume: 0.35 });
    updateWheelDisplay(missionId);
  }

  function bindWheels() {
    var wheels = splashEl.querySelectorAll('.coin-wheel');
    wheels.forEach(function (wheel) {
      var missionId = wheel.dataset.mission;

      // Click cycles up
      wheel.addEventListener('click', function (e) {
        e.stopPropagation();
        if (dismissed) return;
        _ensureAudioInit();
        adjustGroup(missionId, 1);
      });

      // Right-click cycles down
      wheel.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (dismissed) return;
        _ensureAudioInit();
        adjustGroup(missionId, -1);
      });

      // Drag support: track Y delta
      var dragStartY = null;
      var dragAccum = 0;

      wheel.addEventListener('mousedown', function (e) {
        if (dismissed) return;
        e.stopPropagation();
        dragStartY = e.clientY;
        dragAccum = 0;
      });

      wheel.addEventListener('touchstart', function (e) {
        if (dismissed) return;
        e.stopPropagation();
        // preventDefault stops the card from seeing this touch
        // and prevents page scroll while dragging the wheel
        e.preventDefault();
        dragStartY = e.touches[0].clientY;
        dragAccum = 0;
        isDraggingWheel = true;
      }, { passive: false });

      function onDragMove(clientY) {
        if (dragStartY === null) return;
        var dy = dragStartY - clientY;
        dragAccum += dy;
        dragStartY = clientY;

        // Every 20px of drag = one tick
        while (dragAccum > 20) {
          _ensureAudioInit();
          adjustGroup(missionId, 1);
          dragAccum -= 20;
        }
        while (dragAccum < -20) {
          _ensureAudioInit();
          adjustGroup(missionId, -1);
          dragAccum += 20;
        }
      }

      document.addEventListener('mousemove', function (e) {
        if (dragStartY !== null) onDragMove(e.clientY);
      });

      document.addEventListener('touchmove', function (e) {
        if (dragStartY !== null && e.touches[0]) {
          // Prevent page scroll while dragging wheel
          e.preventDefault();
          onDragMove(e.touches[0].clientY);
        }
      }, { passive: false });

      document.addEventListener('mouseup', function () { dragStartY = null; isDraggingWheel = false; });
      document.addEventListener('touchend', function () { dragStartY = null; isDraggingWheel = false; });

      // Scroll wheel on the element
      wheel.addEventListener('wheel', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (dismissed) return;
        _ensureAudioInit();
        adjustGroup(missionId, e.deltaY > 0 ? 1 : -1);
      }, { passive: false });
    });
  }

  /* ---- Particles ---- */

  function spawnParticles(container, count) {
    count = count || 25;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'splash-particle';
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDuration = `${6 + Math.random() * 10}s`;
      p.style.animationDelay = `${Math.random() * 8}s`;
      p.style.width = p.style.height = `${1 + Math.random() * 2}px`;
      container.appendChild(p);
    }
  }

  /* ---- Video management ---- */

  let activeVideoIdx = 0;

  function switchVideo(index) {
    if (index === activeVideoIdx || index >= VIDEO_SOURCES.length) return;
    const videos = splashEl.querySelectorAll('.splash-video-layer video');
    videos.forEach((v, i) => {
      if (i === index) {
        v.classList.add('splash-video-active');
        v.play().catch(() => {});
      } else {
        v.classList.remove('splash-video-active');
      }
    });
    activeVideoIdx = index;
  }

  function startVideos() {
    const videos = splashEl.querySelectorAll('.splash-video-layer video');
    videos.forEach(v => { v.play().catch(() => {}); });
  }

  /* ---- Sound effects ---- */

  function playPopupSounds() {
    _playAudio('music-as-solar-winds', { volume: 0.3 });
    setTimeout(() => { _playAudio('card-shuffle_4', { volume: 0.5 }); }, 200);
  }

  function playHoverSound(cardIndex) {
    var key = HOVER_SOUNDS[cardIndex] || HOVER_SOUNDS[0];
    _playAudio(key, { volume: 0.4 });
  }

  function playSelectSound(cardIndex) {
    var key = SELECT_SOUNDS[cardIndex] || SELECT_SOUNDS[0];
    _playAudio(key, { volume: 0.6 });
  }

  function playCloseSound() {
    _playAudio('ui-01', { volume: 0.5 });
  }

  /* ---- Silhouette randomization ---- */

  function prepareBottomSilhouettes() {
    const shuffled = SIL_POOL.slice().sort(() => Math.random() - 0.5);
    const count = Math.random() < 0.5 ? 2 : 3;
    const slots = ['sil-slot-a', 'sil-slot-b', 'sil-slot-c'];
    const cssSlots = ['splash-sil-css-a', 'splash-sil-css-b', 'splash-sil-css-c'];
    var imgLoaded = [false, false, false]; // track which PNGs resolved

    for (let i = 0; i < count; i++) {
      const slot = document.getElementById(slots[i]);
      if (slot && shuffled[i]) {
        const img = slot.querySelector('img');

        // Capture index for closure
        (function (idx) {
          // When real PNG loads, mark it and ensure CSS shape stays hidden
          img.addEventListener('load', function () {
            imgLoaded[idx] = true;
            var cssShape = splashEl.querySelector('.' + cssSlots[idx]);
            if (cssShape) {
              cssShape.classList.remove('splash-sil-css-needed');
              cssShape.classList.add('splash-sil-img-loaded');
            }
          });

          // If PNG fails (offline/slow), activate CSS shape as fallback
          img.addEventListener('error', function () {
            console.log('[Splash] Silhouette image failed — CSS fallback for slot ' + idx);
            var cssShape = splashEl.querySelector('.' + cssSlots[idx]);
            if (cssShape) cssShape.classList.add('splash-sil-css-needed');
          });

          // Grace period: wait 200ms — if PNG hasn't loaded, reveal CSS shape
          setTimeout(function () {
            if (!imgLoaded[idx]) {
              var cssShape = splashEl.querySelector('.' + cssSlots[idx]);
              if (cssShape && !cssShape.classList.contains('splash-sil-img-loaded')) {
                cssShape.classList.add('splash-sil-css-needed');
              }
            }
          }, 200);
        })(i);

        img.src = shuffled[i];
        slot.style.display = '';
      }
    }
  }

  /* ---- Card interactions ---- */

  function hoverCard(cardEl) {
    if (hoveredCardEl === cardEl) return;
    // Un-hover previous
    if (hoveredCardEl) hoveredCardEl.classList.remove('coin-card-hovered');
    hoveredCardEl = cardEl;
    cardEl.classList.add('coin-card-hovered');
    var idx = parseInt(cardEl.dataset.index, 10);
    var m = MISSIONS[idx];
    if (m && m.videoIndex !== undefined) switchVideo(m.videoIndex);
    playHoverSound(idx);
  }

  function unhoverAll() {
    if (hoveredCardEl) {
      hoveredCardEl.classList.remove('coin-card-hovered');
      hoveredCardEl = null;
    }
  }

  function bindCards() {
    const cards = splashEl.querySelectorAll('.splash-dossier');

    cards.forEach((card) => {
      /* --- Desktop: mouseenter = hover as before --- */
      card.addEventListener('mouseenter', () => {
        if (dismissed) return;
        _ensureAudioInit();
        const idx = parseInt(card.dataset.index, 10);
        var m = MISSIONS[idx];
        if (m && m.videoIndex !== undefined) switchVideo(m.videoIndex);
        playHoverSound(idx);
      });

      /* --- Mobile touch: tap = hover, long-press = select --- */
      var touchTimer = null;
      var touchStartX = 0;
      var touchStartY = 0;
      var touchMoved = false;
      var longPressFired = false;

      card.addEventListener('touchstart', function (e) {
        if (dismissed) return;
        // If the touch originated inside a wheel, let the wheel handle it
        if (e.target.closest('.coin-wheel') || e.target.closest('.coin-book-btn')) return;

        _ensureAudioInit();
        touchMoved = false;
        longPressFired = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        // Start long-press timer → select
        touchTimer = setTimeout(function () {
          if (!touchMoved && !dismissed) {
            longPressFired = true;
            // Haptic feedback if available
            if (navigator.vibrate) try { navigator.vibrate(30); } catch (_) {}
            selectMission(card);
          }
        }, LONG_PRESS_MS);
      }, { passive: true });

      card.addEventListener('touchmove', function (e) {
        if (touchTimer === null) return;
        var dx = e.touches[0].clientX - touchStartX;
        var dy = e.touches[0].clientY - touchStartY;
        if (Math.abs(dx) > TAP_MOVE_TOLERANCE || Math.abs(dy) > TAP_MOVE_TOLERANCE) {
          touchMoved = true;
          clearTimeout(touchTimer);
          touchTimer = null;
        }
      }, { passive: true });

      card.addEventListener('touchend', function (e) {
        clearTimeout(touchTimer);
        touchTimer = null;
        if (dismissed || longPressFired || touchMoved) return;
        // If touch target was inside a wheel or button, skip hover toggle
        if (e.target.closest('.coin-wheel') || e.target.closest('.coin-book-btn')) return;

        // Short tap → hover toggle
        if (hoveredCardEl === card) {
          // Already hovered — un-hover (collapse)
          unhoverAll();
        } else {
          hoverCard(card);
        }
      }, { passive: true });

      card.addEventListener('touchcancel', function () {
        clearTimeout(touchTimer);
        touchTimer = null;
      }, { passive: true });
    });

    // Tap outside any card → un-hover
    splashEl.addEventListener('touchstart', function (e) {
      if (!e.target.closest('.splash-dossier') && hoveredCardEl) {
        unhoverAll();
      }
    }, { passive: true });

    // Book/Join buttons handle selection (desktop click + mobile tap)
    var bookBtns = splashEl.querySelectorAll('.coin-book-btn');
    bookBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (dismissed) return;
        _ensureAudioInit();
        var missionId = btn.dataset.mission;
        var card = splashEl.querySelector('[data-mission="' + missionId + '"].splash-dossier');
        if (card) selectMission(card);
      });

      // On mobile, the BOOK button also works on tap
      btn.addEventListener('touchend', function (e) {
        e.stopPropagation();
        // Prevent ghost click
        e.preventDefault();
        if (dismissed) return;
        _ensureAudioInit();
        var missionId = btn.dataset.mission;
        var card = splashEl.querySelector('[data-mission="' + missionId + '"].splash-dossier');
        if (card) selectMission(card);
      });
    });
  }

  /* ---- Close button ---- */

  function bindCloseButton() {
    const btn = document.getElementById('splash-close-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dismissed) return;
      _ensureAudioInit();
      dismissed = true;
      btn.classList.add('splash-close-pressed');
      playCloseSound();
      removeSplash();
    });
  }

  /* ---- Selection & transition ---- */

  function selectMission(cardEl) {
    dismissed = true;
    const missionId = cardEl.dataset.mission;
    const mission = MISSIONS.find(m => m.id === missionId);
    const cardIndex = parseInt(cardEl.dataset.index, 10);

    playSelectSound(cardIndex);
    cardEl.classList.add('splash-selected');

    // Store wheel state for pre-fill on booking page
    if (cardState[missionId]) {
      try {
        sessionStorage.setItem('eo_group_size', String(cardState[missionId].groupSize));
        sessionStorage.setItem('eo_price', String(cardState[missionId].price));
      } catch (_) {}
    }

    // Step 0: Fade out fan (100ms)
    setTimeout(() => {
      const fan = document.getElementById('splash-card-fan');
      if (fan) fan.classList.add('splash-fan-exit');
      var hdr = splashEl.querySelector('.splash-header');
      var prm = splashEl.querySelector('.splash-prompt');
      if (hdr) hdr.classList.add('splash-fan-exit');
      if (prm) prm.classList.add('splash-fan-exit');
    }, 100);

    // Step 1: Silhouettes (200ms)
    setTimeout(() => {
      const silLayer = document.getElementById('splash-silhouettes');
      silLayer.classList.add('splash-sil-active');
    }, 200);

    // Step 2: Fade to black (1150ms)
    setTimeout(() => {
      const fadeOverlay = document.getElementById('splash-fade-overlay');
      fadeOverlay.classList.add('splash-fade-active');
    }, 1150);

    // Step 3: Remove & route (2650ms)
    setTimeout(() => {
      removeSplash();
      if (mission && mission.route) {
        window.location.href = mission.route;
      }
    }, 2650);
  }

  /* ---- Lifecycle ---- */

  function removeSplash() {
    if (!splashEl) return;
    Card3D.dispose();
    splashEl.querySelectorAll('video').forEach(v => {
      v.pause();
      v.removeAttribute('src');
      v.load();
    });
    splashEl.classList.add('splash-hidden');
    setTimeout(() => {
      if (splashEl) { splashEl.remove(); splashEl = null; }
    }, 500);
    try { sessionStorage.setItem('splash_seen', '1'); } catch (_) {}
  }

  /* ============================================================
     Three.js 3D Card Integration — STUB
     Future phase: replace CSS coin-cards with WebGL-rendered
     metallic coin meshes.  The hooks below are called by init()
     and removeSplash() so the 3D layer can mount/unmount cleanly.
     ============================================================ */
  const Card3D = {
    /** True once Three.js is loaded and card meshes are ready */
    ready: false,

    /**
     * Mount a <canvas> inside each .coin-card, create Scene + meshes.
     * Called once after buildSplash() and DOM insertion.
     * @param {HTMLElement} fanEl — the .splash-card-fan container
     * @param {Array} missions  — MISSIONS config array
     */
    mount: function (/* fanEl, missions */) {
      // TODO: import Three.js, create renderer per card,
      //       build CoinGeometry (cylinder + edge bevel + face textures),
      //       attach to .coin-card-canvas divs, set Card3D.ready = true.
    },

    /**
     * Per-frame render tick (requestAnimationFrame loop).
     * Handles idle wobble, hover tilt, drag spin.
     */
    tick: function () {
      // TODO: update uniforms, animate idle rotation, render
    },

    /**
     * Set hover state on a specific card mesh.
     * @param {number} index — card index
     * @param {boolean} hovered
     */
    setHover: function (/* index, hovered */) {
      // TODO: tilt mesh toward camera, brighten specular
    },

    /**
     * Play select animation (flip + zoom) on a card mesh.
     * @param {number} index — card index
     * @returns {Promise} resolves when animation completes
     */
    selectCard: function (/* index */) {
      return Promise.resolve();
      // TODO: animate coin flip, camera zoom, resolve after ~800ms
    },

    /**
     * Dispose all Three.js resources (renderers, textures, geometries).
     * Called by removeSplash().
     */
    dispose: function () {
      // TODO: renderer.dispose(), geometry.dispose(), etc.
      Card3D.ready = false;
    }
  };

  /* ---- Init ---- */

  function init() {
    try {
      if (sessionStorage.getItem('splash_seen') === '1') return;
    } catch (_) {}

    splashEl = buildSplash();
    document.body.prepend(splashEl);
    prepareBottomSilhouettes();

    const particleContainer = document.getElementById('splash-particles');
    if (particleContainer) spawnParticles(particleContainer);

    startVideos();
    bindCards();
    bindWheels();
    bindCloseButton();

    // Mount Three.js 3D card layer (no-op until implemented)
    var fanEl = document.getElementById('splash-card-fan');
    if (fanEl) Card3D.mount(fanEl, MISSIONS);

    // Initialize wheel displays with prev/next values
    MISSIONS.forEach(function (m) {
      if (cardState[m.id]) updateWheelDisplay(m.id);
    });

    setTimeout(() => {
      _ensureAudioInit();
      playPopupSounds();
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, removeSplash, Card3D };
})();
