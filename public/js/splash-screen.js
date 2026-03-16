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
      title: '1 Day Scenario',
      desc: 'Live field exercise across Sandpoint, Idaho learn spycraft & treasure hunt to discover new secrets of our local history',
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
      title: '3 Day Scenario',
      desc: 'Seasonal operation across North Idaho\u2019s destinations. Experience the mystery of the Kaniksu forest.',
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
      title: 'Partners',
      desc: 'For Businesses, Actors, & Hosts',
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
      title: 'Arcade',
      desc: 'Decryption keys, Puzzles & Toys',
      suit: '\u2666',        // ♦
      suitClass: 'suit-diamond',
      duration: null,         // no booking wheel
      defaultGroup: null,
      minGroup: null,
      maxGroup: null,
      classified: 'FIELD KIT',
      label: 'RECREATION',
      videoIndex: 3,
      route: '/games.html',
      btnLabel: 'PLAY',
      btnDuration: 'NOW',
      btnClass: 'coin-book-diamond',
      tags: ['PUZZLES', 'DECRYPTION'],
    },
  ];

  // Background drone footage (optimized 480p, no audio)
  // webm: clean names for future VP9 uploads; mp4: original R2 names (URL-encoded spaces)
  const VIDEO_SOURCES = [
    { webm: '/video/Sandpoint2_LakePendOreille.webm', mp4: '/video/Sandpoint2_%20Lake%20Pend%20Oreille.mp4' },
    { webm: '/video/Sandpoint3_LakePendOreille.webm', mp4: '/video/Sandpoint3_%20Lake%20Pend%20Oreille.mp4' },
    { webm: '/video/Sandpoint_LakePendOreille.webm',  mp4: '/video/Sandpoint%20_%20Lake%20Pend%20Oreille.mp4' },
    { webm: '/video/Sandpoint1_SchweitzerMountain.webm', mp4: '/video/Sandpoint1_%20Schweitzer%20Mountain%20Resort.mp4' },
  ];

  // Silhouette image assets
  const SIL_POOL = [
    '/assets/Images/Splash/spy_classic_splash.png',
    '/assets/Images/Splash/spy_female_splash.png',
    '/assets/Images/Splash/spy_female_classic_splash.png',
    '/assets/Images/Splash/spy_male2_splash.png',
    '/assets/Images/Splash/spy_male_splash.png',
  ];

  // Theme map — mission id → CSS data-card-theme value
  const THEME_MAP = {
    'scenario-1': 'silver',
    'scenario-2': 'amber',
    'partner':    'phosphor',
    'minigames':  'panther',
  };

  // Theme → default video index (mirrors THEME_MAP ↔ MISSIONS[].videoIndex)
  const THEME_VIDEO_INDEX = {
    'silver':   0,
    'amber':    1,
    'phosphor': 2,
    'panther':  3,
  };

  const HOVER_SOUNDS  = ['card-slide_card_1', 'card-slide_card_2', 'card-slide_card_3'];
  const SELECT_SOUNDS = ['card-fold_hand_1', 'card-fold_hand_2', 'card-fold_hand_3'];
  const WHEEL_SOUND   = 'clickandrelease-1';
  const PICKUP_SOUNDS = ['card-pick_up_card_1', 'card-pick_up_card_2', 'card-pick_up_card_3'];
  const PUTDOWN_SOUNDS = ['card-place_card_1', 'card-place_card_2', 'card-place_card_3'];

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
      <canvas id="starfield-master" class="starfield-master"></canvas>
      <div class="splash-atmosphere">
        <div class="splash-atmo-base"></div>
        <div class="splash-atmo-fog"></div>
        <div class="splash-atmo-noise"></div>
        <div class="splash-atmo-light"></div>
        <div class="splash-atmo-horizon"></div>
      </div>
      <div class="splash-video-layer" id="splash-video-layer">
        ${VIDEO_SOURCES.map((v, i) =>
          `<video id="splash-vid-${i}" muted loop playsinline preload="auto"
                  ${i === 0 ? 'autoplay class="splash-video-active"' : ''}>
            <source src="${v.webm}" type="video/webm">
            <source src="${v.mp4}" type="video/mp4">
          </video>`
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
          <div class="coin-wheel" data-wheel="price" data-mission="${mission.id}" tabindex="-1" inputmode="none">
            <div class="coin-wheel-frame">
              <div class="coin-wheel-track" id="wheel-price-${mission.id}" tabindex="-1" inputmode="none">
                <div class="coin-wheel-val coin-wheel-prev"></div>
                <div class="coin-wheel-val coin-wheel-current">$${price}</div>
                <div class="coin-wheel-val coin-wheel-next"></div>
              </div>
            </div>
            <div class="coin-wheel-ctx">${groupSize} players</div>
          </div>
          <div class="coin-wheel" data-wheel="group" data-mission="${mission.id}" tabindex="-1" inputmode="none">
            <div class="coin-wheel-frame">
              <div class="coin-wheel-track" id="wheel-group-${mission.id}" tabindex="-1" inputmode="none">
                <div class="coin-wheel-val coin-wheel-prev"></div>
                <div class="coin-wheel-val coin-wheel-current">${groupSize}</div>
                <div class="coin-wheel-val coin-wheel-next"></div>
              </div>
            </div>
            <div class="coin-wheel-ctx">$${price}</div>
          </div>
        </div>`;
    } else {
      var tags = mission.tags || ['BUSINESSES', 'ACTORS'];
      bottomStrip = `
        <div class="coin-tag-strip">
          ${tags.map(function (t) { return '<span class="coin-tag">' + t + '</span>'; }).join('')}
        </div>`;
    }

    return `
      <div class="splash-dossier coin-card" data-mission="${mission.id}" data-index="${index}" data-card-theme="${THEME_MAP[mission.id] || 'phosphor'}">
        <div class="coin-border-outer">
          <div class="coin-border-inner">
            ${cornerTL}
            ${cornerBR}
            <div class="coin-header">
              <div class="coin-classified">${mission.classified}</div>
              <div class="coin-label">${mission.label}</div>
            </div>
            <div class="coin-artwork" data-card-index="${index}">
              <canvas class="starfield-window" width="200" height="200"></canvas>
              <div class="coin-rings"></div>
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

  /* ---- Decoder Ring Wheel Binding ----
     Uses pointer events with setPointerCapture for guaranteed event delivery.
     Supports: click, right-click, vertical drag (20px/tick), edge-exit
     acceleration, scroll wheel, card stays hovered during interaction.
  */
  var _activeWheelPointerId = -1; // global: only one wheel drag at a time

  function bindWheels() {
    var wheels = splashEl.querySelectorAll('.coin-wheel');
    wheels.forEach(function (wheel) {
      var missionId = wheel.dataset.mission;
      var ownerCard = null;
      var dragStartY = null;
      var dragAccum = 0;
      var lastDragDir = 0;
      var edgeAccelTimer = null;
      var edgeAccelDelay = 200;
      var dragMoved = false;

      function getOwnerCard() {
        if (!ownerCard) ownerCard = wheel.closest('.coin-card');
        return ownerCard;
      }

      function isInsideCard(x, y) {
        var card = getOwnerCard();
        if (!card) return true;
        var r = card.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      }

      function startEdgeAccel(dir) {
        if (edgeAccelTimer) return;
        edgeAccelDelay = 200;
        function tick() { _ensureAudioInit(); adjustGroup(missionId, dir); }
        tick();
        edgeAccelTimer = setInterval(function () {
          tick();
          if (edgeAccelDelay > 50) {
            edgeAccelDelay = Math.max(50, edgeAccelDelay - 30);
            clearInterval(edgeAccelTimer);
            edgeAccelTimer = setInterval(tick, edgeAccelDelay);
          }
        }, edgeAccelDelay);
      }

      function stopEdgeAccel() {
        if (edgeAccelTimer) { clearInterval(edgeAccelTimer); edgeAccelTimer = null; }
      }

      function endWheelDrag() {
        dragStartY = null;
        isDraggingWheel = false;
        _activeWheelPointerId = -1;
        stopEdgeAccel();
      }

      // Click cycles up (only if pointer didn't drag)
      wheel.addEventListener('click', function (e) {
        e.stopPropagation();
        if (dismissed || dragMoved) return;
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

      // Unified pointer down (mouse + touch + pen)
      wheel.addEventListener('pointerdown', function (e) {
        if (dismissed || _activeWheelPointerId >= 0) return;
        e.preventDefault();
        e.stopPropagation();

        // Dismiss virtual keyboard on mobile by blurring any focused element
        if (document.activeElement && document.activeElement !== document.body) {
          try { document.activeElement.blur(); } catch (_) {}
        }

        dragStartY = e.clientY;
        dragAccum = 0;
        lastDragDir = 0;
        dragMoved = false;
        isDraggingWheel = true;
        _activeWheelPointerId = e.pointerId;

        try { wheel.setPointerCapture(e.pointerId); } catch (_) {}

        var card = getOwnerCard();
        if (card && hoveredCardEl !== card) hoverCard(card);
      });

      wheel.addEventListener('pointermove', function (e) {
        if (_activeWheelPointerId !== e.pointerId || dragStartY === null) return;

        var x = e.clientX, y = e.clientY;
        if (Math.abs(y - dragStartY) > 3) dragMoved = true;

        if (!isInsideCard(x, y)) {
          if (lastDragDir !== 0 && !edgeAccelTimer) startEdgeAccel(lastDragDir);
          dragStartY = y;
          return;
        }

        stopEdgeAccel();
        var dy = dragStartY - y;
        dragAccum += dy;
        dragStartY = y;

        while (dragAccum > 20) {
          _ensureAudioInit(); adjustGroup(missionId, 1);
          lastDragDir = 1; dragAccum -= 20;
        }
        while (dragAccum < -20) {
          _ensureAudioInit(); adjustGroup(missionId, -1);
          lastDragDir = -1; dragAccum += 20;
        }
      });

      wheel.addEventListener('pointerup', function (e) {
        if (_activeWheelPointerId !== e.pointerId) return;
        try { wheel.releasePointerCapture(e.pointerId); } catch (_) {}
        endWheelDrag();
      });

      wheel.addEventListener('pointercancel', function (e) {
        if (_activeWheelPointerId !== e.pointerId) return;
        endWheelDrag();
      });

      wheel.addEventListener('lostpointercapture', function () {
        if (_activeWheelPointerId >= 0) endWheelDrag();
      });

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

  /* ============================================================
     Starfield — Delegated to shared /js/starfield.js module.
     The splash screen's #starfield-master canvas is passed to the
     module as masterEl.  The module renders the full-page starfield
     and blits into every .starfield-window canvas each frame.
     ============================================================ */

  function _initStarfield() {
    if (!window.EyesOnlyStarfield) return;
    var masterCanvas = document.getElementById('starfield-master');
    if (!masterCanvas) return;
    window.EyesOnlyStarfield.init({
      masterEl: masterCanvas,
      selector: '.starfield-window',
      seed: 42,
    });
  }

  function _disposeStarfield() {
    if (window.EyesOnlyStarfield) {
      window.EyesOnlyStarfield.destroy();
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
    videos.forEach((v, i) => {
      v.play().catch(err => {
        console.warn('[Splash] video[' + i + '] play failed:', err.message);
      });
      // Surface source load failures to console for debugging
      v.addEventListener('error', function () {
        console.warn('[Splash] video[' + i + '] load error — check R2 filenames');
      });
    });
  }

  /* ---- Sound effects ---- */

  function playPopupSounds() {
    // BGM uses streaming playMusic path (not SFX decodeAudioData path)
    // to avoid EncodingError on missing/large music files
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playMusic) {
      try { AudioSystem.playMusic('music-as-solar-winds'); } catch (_) {}
    }
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
    if (hoveredCardEl) {
      var prevIdx = parseInt(hoveredCardEl.dataset.index, 10);
      hoveredCardEl.classList.remove('coin-card-hovered');
      Card3D.setHover(prevIdx, false);
    }
    hoveredCardEl = cardEl;
    cardEl.classList.add('coin-card-hovered');
    var idx = parseInt(cardEl.dataset.index, 10);
    Card3D.setHover(idx, true);
    var m = MISSIONS[idx];
    if (m && m.videoIndex !== undefined) switchVideo(m.videoIndex);
    playHoverSound(idx);
  }

  function unhoverAll() {
    if (hoveredCardEl) {
      var prevIdx = parseInt(hoveredCardEl.dataset.index, 10);
      hoveredCardEl.classList.remove('coin-card-hovered');
      Card3D.setHover(prevIdx, false);
      hoveredCardEl = null;
    }
  }

  function bindCards() {
    const cards = splashEl.querySelectorAll('.splash-dossier');

    cards.forEach((card) => {
      /* --- Desktop: mouseenter/mouseleave manages .coin-card-hovered class
             with debounced leave to prevent flicker when transform moves card --- */
      var _hoverLeaveTimer = null;

      card.addEventListener('mouseenter', () => {
        if (dismissed) return;
        // Cancel any pending un-hover
        if (_hoverLeaveTimer) { clearTimeout(_hoverLeaveTimer); _hoverLeaveTimer = null; }
        _ensureAudioInit();
        // Apply hover via the same class mobile uses
        if (hoveredCardEl !== card) {
          hoverCard(card);
        }
        const idx = parseInt(card.dataset.index, 10);
        var m = MISSIONS[idx];
        if (m && m.videoIndex !== undefined) switchVideo(m.videoIndex);
        playHoverSound(idx);
      });

      card.addEventListener('mouseleave', () => {
        if (dismissed) return;
        // Suppress un-hover while dragging a wheel or card — card should stay raised
        if (isDraggingWheel || _dragState) return;
        // Debounce un-hover — if mouse re-enters within 120ms the card stays hovered.
        // This prevents the flicker loop when transform shifts the card boundary.
        _hoverLeaveTimer = setTimeout(() => {
          _hoverLeaveTimer = null;
          if (hoveredCardEl === card && !isDraggingWheel && !_dragState) {
            unhoverAll();
          }
        }, 120);
      });

      /* --- Mobile touch: tap = hover, long-press = drag / select --- */
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

        // Check if touch is on drag-eligible artwork area
        var isOnDragArea = e.target.closest('.coin-artwork')
          && !e.target.closest('.coin-wheel-strip')
          && !e.target.closest('.coin-wheel-frame');

        // Start long-press timer → drag (artwork) or select (elsewhere)
        touchTimer = setTimeout(function () {
          if (!touchMoved && !dismissed) {
            longPressFired = true;
            // Haptic feedback if available
            if (navigator.vibrate) try { navigator.vibrate(30); } catch (_) {}
            if (isOnDragArea && !_dragState) { // guard: skip if another drag is already active
              // Long-press on artwork → begin card drag
              var idx = parseInt(card.dataset.index, 10);
              _beginCardDrag(card, idx, { clientX: touchStartX, clientY: touchStartY });
            } else {
              selectMission(card);
            }
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
        // If a drag is active, don't toggle hover
        if (_dragState) return;
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
      // Stash current theme's video for debrief feed (default or previously persisted)
      var currentTheme = document.body.getAttribute('data-theme') || 'phosphor';
      _stashThemeVideo(currentTheme);
      removeSplash();
    });
  }


  /* ============================================================
     Card Drag System — Pluck card from fan, drop to select
     Modeled after CardDragController from hand-fan-component.
     Drag zones: .coin-artwork dead space (not wheels/buttons).
     Drop anywhere outside the placeholder = select that card.
     Drop back on placeholder = return card to fan.
     ============================================================ */

  var _dragState = null;  // { cardEl, index, ghostEl, placeholderEl, startX, startY, grabOffsetX, grabOffsetY, phase }

  // ── Splash Drag Reveal Rendering (in-porthole) ─────────
  // Same pattern as nch-overlay.js: render RevealGrid zone content
  // inside the card drag ghost's porthole area (.coin-artwork).
  var _splashRevealEl = null;
  var _splashRevealZoneId = null;

  function _updateSplashRevealContent(ghost) {
    if (!window.RevealGrid || !ghost) {
      _clearSplashRevealContent();
      return;
    }
    var reveal = RevealGrid.getActiveReveal();
    if (!reveal) {
      _clearSplashRevealContent();
      return;
    }

    var artwork = ghost.querySelector('.coin-artwork');
    if (!artwork) return;

    if (!_splashRevealEl || _splashRevealZoneId !== reveal.zoneId) {
      _clearSplashRevealContent();
      _splashRevealZoneId = reveal.zoneId;

      var el = document.createElement('div');
      el.className = 'splash-card-reveal-preview';
      el.style.cssText = [
        'position: absolute',
        'inset: 0',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'flex-direction: column',
        'pointer-events: none',
        'will-change: transform, opacity',
        'z-index: 5',
        'border-radius: 50%',
        'overflow: hidden'
      ].join(';');

      if (reveal.type === 'item') {
        el.innerHTML =
          '<span style="font-size:48px;line-height:1">' + (reveal.emoji || '❓') + '</span>' +
          (reveal.label
            ? '<span style="display:block;font-size:9px;color:var(--phosphor,#1cff9b);' +
              'text-transform:uppercase;letter-spacing:0.1em;margin-top:3px;' +
              'text-shadow:0 0 6px var(--phosphor-glow,rgba(28,255,155,0.4))">' +
              reveal.label + '</span>'
            : '');
      } else {
        el.textContent = reveal.emoji || '🔎';
        el.style.fontSize = '48px';
      }

      var canvas = artwork.querySelector('.starfield-window');
      artwork.insertBefore(el, canvas ? canvas.nextSibling : null);
      _splashRevealEl = el;
    }

    if (_splashRevealEl) {
      _splashRevealEl.style.opacity = reveal.opacity;
      _splashRevealEl.style.transform = 'translate(' + reveal.offsetX + 'px, ' + reveal.offsetY + 'px)';
      if (reveal.locked && !_splashRevealEl.dataset.locked) {
        _splashRevealEl.dataset.locked = '1';
        _splashRevealEl.style.filter = 'drop-shadow(0 0 8px var(--phosphor-glow, rgba(28,255,155,0.5)))';
      }
    }
  }

  function _clearSplashRevealContent() {
    if (_splashRevealEl && _splashRevealEl.parentNode) {
      _splashRevealEl.parentNode.removeChild(_splashRevealEl);
    }
    _splashRevealEl = null;
    _splashRevealZoneId = null;
  }

  function _createDragGhost(cardEl, grabX, grabY) {
    var rect = cardEl.getBoundingClientRect();
    var ghost = cardEl.cloneNode(true);
    var isMobile = window.innerWidth < 769;

    // Strip interaction classes, add ghost class
    // CRITICAL: coin-card-hovered has !important on transform + z-index
    // which overrides inline drag positioning.  coin-card-ghost provides
    // hover visuals while letting inline transform/z-index work.
    ghost.classList.remove('coin-card-hovered', 'splash-selected', 'coin-card-dragging');
    ghost.classList.add('coin-card-ghost');

    // Full card ghost on both desktop and mobile
    var ghostW = Math.round(rect.width);
    var ghostH = Math.round(rect.height);
    var ghostRadius = isMobile ? '8px' : '16px';

    ghost.style.cssText = [
      'position: fixed',
      'top: ' + (grabY - ghostH / 2) + 'px',
      'left: ' + (grabX - ghostW / 2) + 'px',
      'width: ' + ghostW + 'px',
      'height: ' + ghostH + 'px',
      'opacity: 0.94',
      'pointer-events: none',
      'transition: transform 0.12s ease-out, opacity 0.12s ease-out, box-shadow 0.12s ease-out',
      'box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(180,160,80,0.12)',
      'border-radius: ' + ghostRadius,
      'will-change: transform, left, top',
      'overflow: hidden'
    ].join('; ');
    // Use setProperty with 'important' to override coin-card-hovered's !important
    // Zoom up on drag — 20% on mobile, 5% on desktop (matches NCH overlay)
    var dragScale = isMobile ? 1.20 : 1.05;
    ghost.style.setProperty('transform', 'scale(' + dragScale + ') rotate(0deg)', 'important');
    ghost.style.setProperty('z-index', '100000', 'important');

    // Center grab offset on the ghost
    _dragState.grabOffsetX = ghostW / 2;
    _dragState.grabOffsetY = ghostH / 2;

    document.body.appendChild(ghost);

    return ghost;
  }

  // Theme primary colors for placeholder — keyed by data-card-theme.
  var PLACEHOLDER_COLORS = {
    silver:   { border: 'rgba(176, 196, 222, 0.5)', bg: 'rgba(176, 196, 222, 0.06)' },
    amber:    { border: 'rgba(255, 176, 0, 0.5)',   bg: 'rgba(255, 176, 0, 0.06)'   },
    phosphor: { border: 'rgba(51, 255, 51, 0.5)',    bg: 'rgba(51, 255, 51, 0.06)'    },
    panther:  { border: 'rgba(255, 48, 144, 0.5)',   bg: 'rgba(255, 48, 144, 0.06)'   },
  };

  function _createDragPlaceholder(cardEl) {
    var rect = cardEl.getBoundingClientRect();
    var cs = window.getComputedStyle(cardEl);
    var isMobile = window.innerWidth < 769;
    var ph = document.createElement('div');
    ph.className = 'splash-card-placeholder';
    ph.style.width = rect.width + 'px';
    ph.style.height = rect.height + 'px';
    ph.style.margin = cs.margin;
    ph.style.flexShrink = '0';

    // On mobile, copy transform and z-index for stacked layout
    if (isMobile) {
      ph.style.transform = cs.transform;
      ph.style.zIndex = cs.zIndex;
    }

    // Color the placeholder to match the CARD's theme
    var cardTheme = cardEl.dataset.cardTheme || '';
    var tc = PLACEHOLDER_COLORS[cardTheme];
    if (tc) {
      ph.style.borderColor = tc.border;
      ph.style.background = tc.bg;
    }

    // Insert placeholder before the card
    cardEl.parentNode.insertBefore(ph, cardEl);
    return ph;
  }

  function _moveGhost(x, y) {
    if (!_dragState || !_dragState.ghostEl) return;
    _dragState.ghostEl.style.left = (x - _dragState.grabOffsetX) + 'px';
    _dragState.ghostEl.style.top = (y - _dragState.grabOffsetY) + 'px';
  }

  function _isOverPlaceholder(x, y) {
    if (!_dragState || !_dragState.placeholderEl) return false;
    var r = _dragState.placeholderEl.getBoundingClientRect();
    // Generous 30px margin around placeholder for forgiving drop-back
    var pad = 30;
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  }

  function _returnGhostToSlot(done) {
    var ghost = _dragState.ghostEl;
    var ph = _dragState.placeholderEl;
    if (!ghost || !ph) { if (done) done(); return; }

    var phRect = ph.getBoundingClientRect();
    ghost.style.transition = 'left 0.22s ease-out, top 0.22s ease-out, opacity 0.22s ease-out, transform 0.22s ease-out';
    ghost.style.left = phRect.left + 'px';
    ghost.style.top = phRect.top + 'px';
    ghost.style.opacity = '0.6';
    ghost.style.setProperty('transform', 'scale(1) rotate(0deg)', 'important');

    // Return-to-slot sound
    _playAudio(PUTDOWN_SOUNDS[_dragState.index % PUTDOWN_SOUNDS.length], { volume: 0.3 });

    setTimeout(function () {
      _cleanupDrag();
      if (done) done();
    }, 240);
  }

  function _cleanupDrag() {
    if (!_dragState) return;

    // End RevealGrid lens session before cleanup
    if (window.RevealGrid) {
      RevealGrid.endLensSession();
    }
    _clearSplashRevealContent();

    var cardEl = _dragState.cardEl;
    var ghost = _dragState.ghostEl;
    var ph = _dragState.placeholderEl;

    // Remove ghost
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    // Remove placeholder
    if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
    // Restore card in flow (removes display:none)
    if (cardEl) cardEl.classList.remove('coin-card-dragging');
    // Restore body cursor
    document.body.style.cursor = '';

    _dragState = null;
  }

  function _beginCardDrag(cardEl, index, ev) {
    if (_dragState || dismissed) return;

    var rect = cardEl.getBoundingClientRect();
    _dragState = {
      cardEl: cardEl,
      index: index,
      ghostEl: null,
      placeholderEl: null,
      startX: ev.clientX,
      startY: ev.clientY,
      grabOffsetX: ev.clientX - rect.left,
      grabOffsetY: ev.clientY - rect.top,
      phase: 'dragging'
    };

    // Ensure card is hovered (raised) during drag
    if (hoveredCardEl !== cardEl) hoverCard(cardEl);

    // Create placeholder in fan slot
    _dragState.placeholderEl = _createDragPlaceholder(cardEl);

    // Create ghost
    _dragState.ghostEl = _createDragGhost(cardEl, ev.clientX, ev.clientY);

    // Hide original card (display:none exits flex flow; placeholder holds slot)
    cardEl.classList.add('coin-card-dragging');

    // Body cursor during drag
    document.body.style.cursor = 'grabbing';

    // Begin RevealGrid lens session (card's porthole aperture is the lens)
    if (window.RevealGrid) {
      var portholeCanvas = _dragState.ghostEl.querySelector('.starfield-window');
      var lensEl = portholeCanvas || _dragState.ghostEl;
      var lr = lensEl.getBoundingClientRect();
      RevealGrid.beginLensSession({
        left: lr.left, top: lr.top,
        right: lr.right, bottom: lr.bottom,
        width: lr.width, height: lr.height,
      });
    }

    // Sound
    _ensureAudioInit();
    _playAudio(PICKUP_SOUNDS[index % PICKUP_SOUNDS.length], { volume: 0.4 });
  }

  function _updateCardDrag(ev) {
    if (!_dragState || _dragState.phase !== 'dragging') return;
    _moveGhost(ev.clientX, ev.clientY);

    // Subtle tilt based on drag velocity
    var dx = ev.clientX - _dragState.startX;
    var tilt = Math.max(-8, Math.min(8, dx * 0.04));
    var dragScale = window.innerWidth < 769 ? 1.20 : 1.05;
    _dragState.ghostEl.style.setProperty('transform', 'scale(' + dragScale + ') rotate(' + tilt + 'deg)', 'important');

    // Update RevealGrid lens position (porthole aperture)
    if (window.RevealGrid) {
      var ghost = _dragState.ghostEl;
      var portholeCanvas = ghost.querySelector('.starfield-window');
      var lensEl = portholeCanvas || ghost;
      var lr = lensEl.getBoundingClientRect();
      RevealGrid.updateLens({
        left: lr.left, top: lr.top,
        right: lr.right, bottom: lr.bottom,
        width: lr.width, height: lr.height,
      });
      // Render zone content inside card's porthole area
      _updateSplashRevealContent(ghost);
    }
  }

  function _endCardDrag(ev) {
    if (!_dragState || _dragState.phase !== 'dragging') return;
    _dragState.phase = 'ending';

    var x = ev.clientX;
    var y = ev.clientY;

    // If dropped back on placeholder → return to fan
    if (_isOverPlaceholder(x, y)) {
      _dragState.phase = 'returning';
      _returnGhostToSlot(function () {
        // Card returns to its fan position
      });
      return;
    }

    // Dropped outside placeholder → select this mission
    _dragState.phase = 'deploying';
    var cardEl = _dragState.cardEl;

    // Quick collapse animation on placeholder
    if (_dragState.placeholderEl) {
      _dragState.placeholderEl.classList.add('placeholder-collapsing');
    }

    // Ghost fades out with a slight scale-up
    if (_dragState.ghostEl) {
      _dragState.ghostEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      _dragState.ghostEl.style.opacity = '0';
      _dragState.ghostEl.style.setProperty('transform', 'scale(1.05)', 'important');
    }

    _playAudio(PUTDOWN_SOUNDS[_dragState.index % PUTDOWN_SOUNDS.length], { volume: 0.5 });

    setTimeout(function () {
      _cleanupDrag();
      if (cardEl && !dismissed) selectMission(cardEl);
    }, 250);
  }

  function _cancelCardDrag() {
    if (!_dragState) return;
    _dragState.phase = 'returning';
    _returnGhostToSlot(function () {});
  }

  function bindCardDrag() {
    // Pointer events work on both desktop and mobile (touch → pointer).
    // Mobile gets a circular porthole ghost; desktop gets the full card.
    var cards = splashEl.querySelectorAll('.splash-dossier');
    cards.forEach(function (card) {
      var dragStarted = false;
      var dragPointerId = -1;
      var startX = 0, startY = 0;

      // Drag pickup zone: artwork (porthole) AND info (title/desc) columns
      var dragZones = card.querySelectorAll('.coin-artwork, .coin-info');
      if (!dragZones.length) return;

      dragZones.forEach(function (zone) {
      zone.addEventListener('pointerdown', function (e) {
        if (dismissed || _dragState || isDraggingWheel || _activeWheelPointerId >= 0) return;
        // Don't capture if it's on a button or wheel
        if (e.target.closest('.coin-wheel') || e.target.closest('.coin-book-btn')) return;
        // Don't capture if it's on the wheel strip or mid-row controls
        if (e.target.closest('.coin-wheel-strip') || e.target.closest('.coin-wheel-frame')) return;

        e.stopPropagation();
        dragStarted = false;
        dragPointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;

        function onMove(ev) {
          if (ev.pointerId !== dragPointerId) return;
          if (isDraggingWheel || _activeWheelPointerId >= 0) return;

          // Sync: if long-press touch timer already started drag, catch up
          if (!dragStarted && _dragState && _dragState.cardEl === card) {
            dragStarted = true;
          }

          var dx = ev.clientX - startX;
          var dy = ev.clientY - startY;
          var dist = Math.sqrt(dx * dx + dy * dy);

          if (!dragStarted && dist > 10) {
            dragStarted = true;
            ev.preventDefault();
            var idx = parseInt(card.dataset.index, 10);
            _beginCardDrag(card, idx, e);
          }

          if (dragStarted) {
            ev.preventDefault();
            _updateCardDrag(ev);
          }
        }

        function onUp(ev) {
          if (ev.pointerId !== dragPointerId) return;
          window.removeEventListener('pointermove', onMove, true);
          window.removeEventListener('pointerup', onUp, true);
          window.removeEventListener('pointercancel', onCancel, true);
          dragPointerId = -1;

          // Sync: if long-press touch timer already started drag, catch up
          if (!dragStarted && _dragState && _dragState.cardEl === card) {
            dragStarted = true;
          }

          if (dragStarted) {
            _endCardDrag(ev);
          }
          dragStarted = false;
        }

        function onCancel(ev) {
          if (ev.pointerId !== dragPointerId) return;
          window.removeEventListener('pointermove', onMove, true);
          window.removeEventListener('pointerup', onUp, true);
          window.removeEventListener('pointercancel', onCancel, true);
          dragPointerId = -1;

          // Sync: if long-press touch timer already started drag, catch up
          if (!dragStarted && _dragState && _dragState.cardEl === card) {
            dragStarted = true;
          }

          if (dragStarted) {
            _cancelCardDrag();
          }
          dragStarted = false;
        }

        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onCancel, true);
      });
      }); // end dragZones.forEach
    });

    // Escape key cancels drag
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _dragState) {
        _cancelCardDrag();
      }
    });
  }


  /* ---- Theme → Video stash for debrief feed ---- */

  /**
   * Write the active theme's default video URL into sessionStorage
   * so the debrief-feed-controller can pick it up after init.
   * Uses webm with mp4 fallback based on browser support.
   */
  function _stashThemeVideo(themeId) {
    try {
      var idx = THEME_VIDEO_INDEX[themeId];
      if (idx == null || !VIDEO_SOURCES[idx]) return;
      var src = VIDEO_SOURCES[idx];
      // Prefer webm; most modern browsers support it
      var url = src.webm || src.mp4 || '';
      if (url) {
        sessionStorage.setItem('eo_theme_video', url);
        sessionStorage.setItem('eo_theme_video_theme', themeId);
      }
    } catch (_) {}
  }

  /* ---- Selection & transition ---- */

  function selectMission(cardEl) {
    dismissed = true;
    const missionId = cardEl.dataset.mission;
    const mission = MISSIONS.find(m => m.id === missionId);
    const cardIndex = parseInt(cardEl.dataset.index, 10);

    playSelectSound(cardIndex);
    cardEl.classList.add('splash-selected');

    // Propagate theme to body for terminal/HUD downstream
    const selectedTheme = THEME_MAP[missionId] || 'phosphor';
    document.body.setAttribute('data-theme', selectedTheme);
    try { localStorage.setItem('eyesonly_theme', selectedTheme); } catch (_) {}

    // Stash theme's default video for debrief feed to pick up after init
    _stashThemeVideo(selectedTheme);

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
    _disposeStarfield();
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
     Three.js 3D Card Integration
     Delegates to CardCoin3D (card-coin-3d.js) which lazy-loads
     Three.js and renders military challenge-coin meshes.
     CSS cards remain interactive underneath; 3D is visual only.
     ============================================================ */
  const Card3D = {
    get ready() {
      return window.CardCoin3D ? CardCoin3D.ready : false;
    },

    /**
     * Mount 3D coin layer. Loads Three.js lazily, builds meshes,
     * starts render loop. CSS cards stay interactive underneath.
     */
    mount: function (fanEl, missions) {
      // WebGL 3D renderer disabled — card depth now achieved via CSS preserve-3d.
      // CardCoin3D.mount() is no longer called.
    },

    /** Per-frame render — handled internally by CardCoin3D loop */
    tick: function () { /* CardCoin3D owns its own rAF loop */ },

    /**
     * Relay hover state to 3D mesh (tilt + specular brighten).
     */
    setHover: function (index, hovered) {
      if (window.CardCoin3D && CardCoin3D.ready) {
        CardCoin3D.setHover(index, hovered);
      }
    },

    /**
     * Play coin-flip select animation.
     * @returns {Promise} resolves when animation completes
     */
    selectCard: function (index) {
      if (window.CardCoin3D && CardCoin3D.ready) {
        return CardCoin3D.selectCard(index);
      }
      return Promise.resolve();
    },

    /** Dispose all Three.js resources. Called by removeSplash(). */
    dispose: function () {
      if (window.CardCoin3D) {
        CardCoin3D.dispose();
      }
    }
  };

  /* ---- Init ---- */

  function init() {
    // Restore persisted theme (applies to terminal even if splash is skipped)
    try {
      const saved = localStorage.getItem('eyesonly_theme');
      if (saved) document.body.setAttribute('data-theme', saved);
    } catch (_) {}

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
    bindCardDrag();
    bindCloseButton();

    // Mount Three.js 3D card layer (no-op — WebGL disabled)
    var fanEl = document.getElementById('splash-card-fan');
    if (fanEl) Card3D.mount(fanEl, MISSIONS);

    // Start shared parallax starfield (porthole windows in all cards)
    _initStarfield();

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
