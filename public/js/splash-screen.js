/* ============================================================
   Splash Screen — Mission Select Landing
   Renders three mission dossier cards over looping drone footage.
   On card selection: spy-noir silhouettes slide in, fade-to-black,
   then hand off to the main terminal / target route.
   ============================================================ */

const SplashScreen = (() => {
  'use strict';

  /* ---- Configuration ---- */

  const MISSIONS = [
    {
      id: 'scenario-1',
      title: 'Scenario 1',
      desc: 'Live field exercise',
      icon: '🎯',
      tags: ['24 HR', '$500', '2–60 PLAYERS'],
      classified: 'EYES ONLY',
      label: 'MISSION DOSSIER',
      videoIndex: 0,          // ski mountain footage
      route: null,             // stays on index, enters terminal
    },
    {
      id: 'scenario-2',
      title: 'Scenario 2',
      desc: 'Extended operation',
      icon: '🗺️',
      tags: ['72 HR', '$1200', '3–30 PLAYERS'],
      classified: 'TOP SECRET',
      label: 'MISSION DOSSIER',
      videoIndex: 1,          // lakeside / submarine base
      route: null,             // stays on index, enters terminal
    },
    {
      id: 'partner',
      title: 'Local Partner',
      desc: 'For businesses, actors & volunteers',
      icon: '🤝',
      tags: ['BUSINESSES', 'ACTORS', 'VOLUNTEERS'],
      classified: 'UNCLASSIFIED',
      label: 'RECRUITMENT',
      videoIndex: 2,          // downtown scene
      route: null,             // stays on index, enters terminal
    },
  ];

  // Background drone footage — served from R2 via /video/ route
  const VIDEO_SOURCES = [
    '/video/Sandpoint%20_%20Lake%20Pend%20Oreille.mp4',
    '/video/Sandpoint%20_%20Lake%20Pend%20Oreille.mp4',
    '/video/Sandpoint%20_%20Lake%20Pend%20Oreille.mp4',
  ];

  // Silhouette image assets — all slide up from bottom
  const SIL_POOL = [
    '/assets/Images/Splash/spy_classic_splash.png',
    '/assets/Images/Splash/spy_female_splash.png',
    '/assets/Images/Splash/spy_female_classic_splash.png',
    '/assets/Images/Splash/spy_male2_splash.png',
    '/assets/Images/Splash/spy_male_splash.png',
  ];

  // Sound keys mapped to each card index
  const HOVER_SOUNDS  = ['card-slide_card_1', 'card-slide_card_2', 'card-slide_card_3'];
  const SELECT_SOUNDS = ['card-fold_hand_1', 'card-fold_hand_2', 'card-fold_hand_3'];

  let splashEl = null;
  let dismissed = false;
  let audioReady = false;

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
      <!-- Background videos -->
      <div class="splash-video-layer" id="splash-video-layer">
        ${VIDEO_SOURCES.map((src, i) =>
          `<video id="splash-vid-${i}" src="${src}" muted loop playsinline preload="auto"
                  ${i === 0 ? 'class="splash-video-active"' : ''}></video>`
        ).join('')}
      </div>

      <!-- Scanlines -->
      <div class="splash-scanlines"></div>

      <!-- Particles -->
      <div class="splash-particles" id="splash-particles"></div>

      <!-- Close button (red terminal) — top right -->
      <button class="splash-close-btn" id="splash-close-btn" aria-label="Close splash and go to terminal" title="Skip to Terminal">
        <span class="splash-close-icon">&#x1F5B3;</span>
      </button>

      <!-- Header -->
      <div class="splash-header">
        <div class="splash-title">Eyes Only</div>
        <div class="splash-subtitle">Select Your Mission</div>
      </div>

      <!-- Card fan -->
      <div class="splash-card-fan" id="splash-card-fan">
        ${MISSIONS.map((m, i) => buildCard(m, i)).join('')}
      </div>

      <!-- Bottom prompt -->
      <div class="splash-prompt">
        <div class="splash-prompt-text">Choose a dossier to begin</div>
      </div>

      <!-- Silhouettes layer — all slide up from bottom -->
      <div class="splash-silhouettes" id="splash-silhouettes">
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

      <!-- Fade to black -->
      <div class="splash-fade-overlay" id="splash-fade-overlay"></div>
    `;

    return el;
  }

  function buildCard(mission, index) {
    const tags = mission.tags.map(t => `<span class="splash-dossier-tag">${t}</span>`).join('');
    return `
      <div class="splash-dossier" data-mission="${mission.id}" data-index="${index}">
        <div class="splash-dossier-inner">
          <div class="splash-dossier-header">
            <div class="splash-dossier-classified">${mission.classified}</div>
            <div class="splash-dossier-mission-label">${mission.label}</div>
          </div>
          <div class="splash-dossier-artwork">
            <div class="splash-dossier-icon">${mission.icon}</div>
          </div>
          <div class="splash-dossier-info">
            <div class="splash-dossier-title">${mission.title}</div>
            <div class="splash-dossier-desc">${mission.desc}</div>
            <div class="splash-dossier-meta">${tags}</div>
          </div>
        </div>
      </div>
    `;
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
    if (index === activeVideoIdx) return;
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
    videos.forEach(v => {
      v.play().catch(() => {});
    });
  }

  /* ---- Sound effects ---- */

  function playPopupSounds() {
    // Solar Winds atmosphere
    _playAudio('music-as-solar-winds', { volume: 0.3 });
    // Card shuffle 200ms later
    setTimeout(() => {
      _playAudio('card-shuffle_4', { volume: 0.5 });
    }, 200);
  }

  function playHoverSound(cardIndex) {
    const key = HOVER_SOUNDS[cardIndex] || HOVER_SOUNDS[0];
    _playAudio(key, { volume: 0.4 });
  }

  function playSelectSound(cardIndex) {
    const key = SELECT_SOUNDS[cardIndex] || SELECT_SOUNDS[0];
    _playAudio(key, { volume: 0.6 });
  }

  function playCloseSound() {
    // Same click sound used in terminal home page
    _playAudio('ui-01', { volume: 0.5 });
  }

  /* ---- Silhouette randomization ---- */

  function prepareBottomSilhouettes() {
    // Shuffle the full pool, pick 2 or 3
    const shuffled = SIL_POOL.slice().sort(() => Math.random() - 0.5);
    const count = Math.random() < 0.5 ? 2 : 3;
    const slots = ['sil-slot-a', 'sil-slot-b', 'sil-slot-c'];

    for (let i = 0; i < count; i++) {
      const slot = document.getElementById(slots[i]);
      if (slot && shuffled[i]) {
        slot.querySelector('img').src = shuffled[i];
        slot.style.display = '';
      }
    }
  }

  /* ---- Card interactions ---- */

  function bindCards() {
    const cards = splashEl.querySelectorAll('.splash-dossier');

    cards.forEach((card) => {
      // Hover → switch background video + play slide sound
      card.addEventListener('mouseenter', () => {
        if (dismissed) return;
        _ensureAudioInit();
        const idx = parseInt(card.dataset.index, 10);
        switchVideo(idx);
        playHoverSound(idx);
      });

      // Touch support
      card.addEventListener('touchstart', () => {
        if (dismissed) return;
        _ensureAudioInit();
        const idx = parseInt(card.dataset.index, 10);
        switchVideo(idx);
        playHoverSound(idx);
      }, { passive: true });

      // Click → select & transition
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dismissed) return;
        _ensureAudioInit();
        selectMission(card);
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
      // Visual feedback: button turns dark red
      btn.classList.add('splash-close-pressed');
      playCloseSound();
      // Immediately clean up splash — no fancy transition
      removeSplash();
    });
  }

  /* ---- Selection & transition ---- */

  function selectMission(cardEl) {
    dismissed = true;
    const missionId = cardEl.dataset.mission;
    const mission = MISSIONS.find(m => m.id === missionId);
    const cardIndex = parseInt(cardEl.dataset.index, 10);

    // Play card fold sound
    playSelectSound(cardIndex);

    // Visual feedback: selected glow
    cardEl.classList.add('splash-selected');

    // Step 0: Fade out the card fan immediately (100ms)
    setTimeout(() => {
      const fan = document.getElementById('splash-card-fan');
      if (fan) fan.classList.add('splash-fan-exit');
      // Also fade the header & prompt
      var hdr = splashEl.querySelector('.splash-header');
      var prm = splashEl.querySelector('.splash-prompt');
      if (hdr) hdr.classList.add('splash-fan-exit');
      if (prm) prm.classList.add('splash-fan-exit');
    }, 100);

    // Step 1: Silhouettes slide up from bottom (after 200ms)
    setTimeout(() => {
      const silLayer = document.getElementById('splash-silhouettes');
      silLayer.classList.add('splash-sil-active');
    }, 200);

    // Step 2: Fade to black — delayed +350ms to give silhouettes time
    // to reach near-top before black takes over (1150ms)
    setTimeout(() => {
      const fadeOverlay = document.getElementById('splash-fade-overlay');
      fadeOverlay.classList.add('splash-fade-active');
    }, 1150);

    // Step 3: Remove splash — extra 650ms total breathing room (2650ms)
    setTimeout(() => {
      removeSplash();

      // Route based on mission
      if (mission && mission.route) {
        window.location.href = mission.route;
      }
      // Otherwise: terminal is already visible beneath
    }, 2650);
  }

  /* ---- Lifecycle ---- */

  function removeSplash() {
    if (!splashEl) return;

    // Stop all videos
    splashEl.querySelectorAll('video').forEach(v => {
      v.pause();
      v.removeAttribute('src');
      v.load();
    });

    splashEl.classList.add('splash-hidden');

    // Clean up after transition
    setTimeout(() => {
      if (splashEl) {
        splashEl.remove();
        splashEl = null;
      }
    }, 500);

    // Mark as seen this session
    try {
      sessionStorage.setItem('splash_seen', '1');
    } catch (_) { /* private browsing */ }
  }

  /* ---- Init ---- */

  function init() {
    // Skip if already seen this session
    try {
      if (sessionStorage.getItem('splash_seen') === '1') return;
    } catch (_) { /* private browsing — always show */ }

    // Build and prepend splash to body
    splashEl = buildSplash();
    document.body.prepend(splashEl);

    // Prepare random bottom silhouettes
    prepareBottomSilhouettes();

    // Spawn particles
    const particleContainer = document.getElementById('splash-particles');
    if (particleContainer) spawnParticles(particleContainer);

    // Start videos
    startVideos();

    // Bind card interactions
    bindCards();

    // Bind close button
    bindCloseButton();

    // Play popup sounds (atmosphere + shuffle) after a brief moment
    // to allow AudioContext init on first user gesture fallback
    setTimeout(() => {
      _ensureAudioInit();
      playPopupSounds();
    }, 400);
  }

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, removeSplash };
})();
