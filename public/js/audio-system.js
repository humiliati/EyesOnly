/* ============================================================
   EYES ONLY — Audio System
   Singleton module for SFX + Music playback via Web Audio API.

   Public API:
     AudioSystem.init()                — create AudioContext on user gesture
     AudioSystem.play(name, opts)      — fire-and-forget SFX
     AudioSystem.playMusic(name)       — crossfade to music track
     AudioSystem.stopMusic()           — fade out current music
     AudioSystem.setMasterMute(bool)   — global mute
     AudioSystem.setMusicVolume(0-100) — music gain
     AudioSystem.setSFXVolume(0-100)   — sfx gain
     AudioSystem.getMasterMute()       — read mute state
     AudioSystem.getMusicVolume()      — read music vol (0-100)
     AudioSystem.getSFXVolume()        — read sfx vol (0-100)
     AudioSystem.getNowPlaying()       — { title, artist } or null
     AudioSystem.onStateChange(fn)     — subscribe to state changes
   ============================================================ */

const AudioSystem = (function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  var _ctx = null;            // AudioContext
  var _masterGain = null;     // GainNode → destination
  var _musicGain = null;      // GainNode → masterGain (music bus)
  var _sfxGain = null;        // GainNode → masterGain (sfx bus)

  var _muted = false;
  var _musicVol = 25;         // 0-100 — default 25% BGM
  var _sfxVol = 85;           // 0-100 — default 85% SFX

  var _bufferCache = {};      // name → AudioBuffer
  var _loadingPromises = {};  // name → Promise<AudioBuffer>
  var _webmSupported = null;  // null=untested, true/false after probe

  var _currentMusic = null;   // { source, name, title, artist }
  var _listeners = [];

  // ── Interior music dim multiplier ──
  // System-controlled overlay on top of the user's music volume.
  // 1.0 = full user volume, 0.25 = 75% quieter (for shallow interiors)
  var _musicDimMultiplier = 1.0;

  // ── Gesture-active flag ──
  // Set true while the first-gesture handler is synchronously calling
  // playMusic(), so playMusic can proceed even if AudioContext still
  // reports 'suspended' (it transitions momentarily).
  var _gestureActive = false;

  // ── Onboarding music guard ──
  // When true, floor-transition music logic should not interrupt the
  // current track (CLUBBED_TO_DEATH spans launch → char creation →
  // floor 0 → tavern).  Cleared automatically when biome music takes
  // over on floor ≥ 1.
  var _onboardingMusic = false;

  // ── Persistence keys ──
  var KEY_MUTE = 'EYESONLY_AUDIO_MUTE';
  var KEY_MUSIC = 'EYESONLY_AUDIO_MUSIC_VOL';
  var KEY_SFX = 'EYESONLY_AUDIO_SFX_VOL';

  // ── SFX manifest (logical name → file path + metadata) ──
  // Paths are relative to /audio/sfx/ or /audio/music/
  // This can later be loaded from a JSON file.
  var _manifest = null;

  // ── SFX rate-limiter + debug trace ───────────────────────
  // Prevents any single SFX from firing more than once per cooldown window.
  // Also logs spam detection to help diagnose runaway callers.
  var _sfxLastPlayed = {};          // name → timestamp (ms)
  var _SFX_COOLDOWN_MS = 80;       // min ms between plays of the same clip
  var _sfxSpamCount = {};           // name → count of suppressed plays
  var _sfxSpamLogTimer = null;      // debounced spam summary logger

  // ── Helpers ────────────────────────────────────────────────

  function _notify() {
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](); } catch (e) {}
    }
  }

  function _applyGains() {
    if (!_masterGain) return;
    // Master: 0 when muted, 1 otherwise
    _masterGain.gain.value = _muted ? 0 : 1;
    if (_musicGain) _musicGain.gain.value = (_musicVol / 100) * _musicDimMultiplier;
    if (_sfxGain)   _sfxGain.gain.value   = _sfxVol / 100;
  }

  function _persist() {
    try {
      localStorage.setItem(KEY_MUTE, _muted ? '1' : '0');
      localStorage.setItem(KEY_MUSIC, String(_musicVol));
      localStorage.setItem(KEY_SFX, String(_sfxVol));
    } catch (e) {}
  }

  function _restore() {
    try {
      var m = localStorage.getItem(KEY_MUTE);
      if (m === '1') _muted = true;
      else if (m === '0') _muted = false;

      var mv = Number(localStorage.getItem(KEY_MUSIC));
      if (isFinite(mv)) _musicVol = Math.max(0, Math.min(100, mv));

      var sv = Number(localStorage.getItem(KEY_SFX));
      if (isFinite(sv)) _sfxVol = Math.max(0, Math.min(100, sv));
    } catch (e) {}
  }

  // ── WebM decode probe ──────────────────────────────────────
  // One-time test: decode a tiny valid WebM/Opus frame.  If it fails
  // (Safari <17, some iOS WebViews) we route ALL SFX resolves to the
  // MP3 fallback immediately — no per-clip decode-fail-then-retry lag.
  //
  // The probe buffer is a 48kHz mono Opus frame inside a minimal WebM
  // container (just the EBML header + a single SimpleBlock).
  var _WEBM_PROBE_B64 =
    'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOA' +
    'ZwEAAAAAAAITEE2bZBMAAAAAAAAAAAAAfQEAAAAAAAAWV64BAUWj' +
    'h88BAgAAAAAAABhTYW5lCEWjiIQAYAAAAAAASJqBAQA=';

  function _probeWebM() {
    if (_webmSupported !== null) return;   // already tested
    if (!_ctx) return;
    try {
      var raw = atob(_WEBM_PROBE_B64);
      var buf = new ArrayBuffer(raw.length);
      var view = new Uint8Array(buf);
      for (var i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);

      _ctx.decodeAudioData(buf.slice(0), function () {
        _webmSupported = true;
        console.log('[AudioSystem] WebM/Opus decode: supported');
      }, function () {
        _webmSupported = false;
        console.warn('[AudioSystem] WebM/Opus decode: NOT supported — using MP3 fallbacks');
      });
    } catch (e) {
      _webmSupported = false;
      console.warn('[AudioSystem] WebM probe error — assuming no support:', e);
    }
  }

  // ── Audio context bootstrap ────────────────────────────────

  function _ensureCtx() {
    if (_ctx) return _ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      _ctx = new AC();

      _masterGain = _ctx.createGain();
      _masterGain.connect(_ctx.destination);

      _musicGain = _ctx.createGain();
      _musicGain.connect(_masterGain);

      _sfxGain = _ctx.createGain();
      _sfxGain.connect(_masterGain);

      _applyGains();
      _probeWebM();
    } catch (e) {
      console.warn('[AudioSystem] Web Audio API not available:', e);
    }
    return _ctx;
  }

  // Resume suspended context (browsers require user gesture)
  function _resume() {
    if (_ctx && _ctx.state === 'suspended') {
      _ctx.resume().catch(function () {});
    }
  }

  // ── Buffer loading ─────────────────────────────────────────

  function _loadBuffer(url, fallbackUrl) {
    if (_bufferCache[url]) return Promise.resolve(_bufferCache[url]);
    if (_loadingPromises[url]) return _loadingPromises[url];

    function _fetchAndDecode(targetUrl) {
      return fetch(targetUrl)
        .then(function (resp) {
          if (!resp.ok) throw new Error('HTTP ' + resp.status + ' for ' + targetUrl);
          return resp.arrayBuffer();
        })
        .then(function (ab) {
          return _ctx.decodeAudioData(ab);
        });
    }

    _loadingPromises[url] = _fetchAndDecode(url)
      .then(function (buf) {
        _bufferCache[url] = buf;
        delete _loadingPromises[url];
        return buf;
      })
      .catch(function (err) {
        // WebM decode failed (iOS Safari) — try MP3 fallback
        if (fallbackUrl && fallbackUrl !== url) {
          console.warn('[AudioSystem] Primary decode failed for', url, '— trying fallback', fallbackUrl);
          return _fetchAndDecode(fallbackUrl).then(function (buf) {
            _bufferCache[url] = buf;   // cache under primary key
            delete _loadingPromises[url];
            return buf;
          });
        }
        throw err;
      })
      .catch(function (err) {
        console.warn('[AudioSystem] Failed to load', url, err);
        delete _loadingPromises[url];
        return null;
      });

    return _loadingPromises[url];
  }

  function _resolveURL(name) {
    // If manifest loaded, use it; otherwise guess a path
    if (_manifest && _manifest[name]) {
      var entry = _manifest[name];
      var src = entry.src || entry.file;
      // Explicit fallback or auto-generate .mp3 from .webm
      var fb = entry.fallback || null;
      if (!fb && src && src.endsWith('.webm')) {
        fb = src.replace(/\.webm$/, '.mp3');
      }
      // If WebM probe failed, swap primary to MP3 immediately
      // (avoids per-clip decode-fail-then-retry delay on Safari)
      if (_webmSupported === false && fb && src && src.endsWith('.webm')) {
        return { src: fb, fallback: null };
      }
      return { src: src, fallback: fb };
    }
    // Fallback: try /audio/sfx/{name}.webm → .mp3
    var defaultSrc = '/audio/sfx/' + name + '.webm';
    var defaultFb  = defaultSrc.replace('.webm', '.mp3');
    if (_webmSupported === false) {
      return { src: defaultFb, fallback: null };
    }
    return { src: defaultSrc, fallback: defaultFb };
  }

  // ── Public API ─────────────────────────────────────────────

  function init() {
    _restore();
    _ensureCtx();

    // Auto-load manifest from canonical location
    loadManifest('/audio/audio-manifest.json');

    // ── Persistent gesture handler ─────────────────────────────
    // Browsers (Chrome, Brave, Safari) require a real user gesture to
    // unlock AudioContext and HTMLAudioElement.play().  Different browsers
    // have different thresholds — some need the VERY FIRST click, others
    // accept any click.  Instead of removing the listener after one try,
    // we keep it alive until the context is confirmed 'running' AND any
    // pending music has been started.  This survives Brave's aggressive
    // autoplay blocking and Chrome's strict activation window.
    var _gestureHandlerDone = false;
    var handler = function () {
      if (_gestureHandlerDone) return;

      // Always try to resume if suspended
      if (_ctx && _ctx.state === 'suspended') {
        _ctx.resume().catch(function () {});
      }

      // Replay pending music SYNCHRONOUSLY in the gesture call-stack.
      if (_pendingMusicName) {
        var n = _pendingMusicName;
        _pendingMusicName = null;
        _gestureActive = true;
        playMusic(n);
        _gestureActive = false;
      }

      // Only remove listeners once context is running and no music is pending
      if (_ctx && _ctx.state === 'running' && !_pendingMusicName) {
        _gestureHandlerDone = true;
        document.removeEventListener('click', handler, true);
        document.removeEventListener('touchstart', handler, true);
        document.removeEventListener('touchend', handler, true);
        document.removeEventListener('keydown', handler, true);
      }
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('touchstart', handler, true);
    document.addEventListener('touchend', handler, true);    // iOS Safari activation
    document.addEventListener('keydown', handler, true);

    // Also listen for context state change — some browsers resume the
    // context asynchronously AFTER the gesture handler returns.  When
    // that happens, replay any pending music immediately.
    if (_ctx) {
      _ctx.addEventListener('statechange', function () {
        if (_ctx.state === 'running' && _pendingMusicName) {
          var n = _pendingMusicName;
          _pendingMusicName = null;
          playMusic(n);
        }
      });
    }

    // Bind data-sound delegate for UI buttons (UI-CANON §17)
    _bindDataSoundDelegate();

    _notify();
  }

  /**
   * Load a JSON manifest mapping names → { src, title?, artist?, loop? }
   */
  function loadManifest(url) {
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) { _manifest = data; })
      .catch(function (e) { console.warn('[AudioSystem] Manifest load failed', e); });
  }

  /**
   * Play a one-shot SFX
   * @param {string} name - logical SFX name (e.g. 'hit-1')
   * @param {Object} [opts] - { volume: 0-1, x, y } (positional is future)
   */
  function play(name, opts) {
    if (!_ctx) _ensureCtx();
    if (!_ctx) return;
    // If context is suspended (no user gesture yet), silently drop.
    // The persistent gesture handler will unlock the context on first
    // interaction, and SFX will work from that point on.
    if (_ctx.state === 'suspended') return;
    _resume();

    // ── Rate-limiter: suppress duplicate SFX within cooldown window ──
    var now = performance.now();
    if (_sfxLastPlayed[name] && (now - _sfxLastPlayed[name]) < _SFX_COOLDOWN_MS) {
      // Track suppressed plays for debug logging
      _sfxSpamCount[name] = (_sfxSpamCount[name] || 0) + 1;
      if (!_sfxSpamLogTimer) {
        _sfxSpamLogTimer = setTimeout(function () {
          var keys = Object.keys(_sfxSpamCount);
          for (var i = 0; i < keys.length; i++) {
            console.warn('[AudioSystem] SFX spam suppressed: "' + keys[i] +
              '" × ' + _sfxSpamCount[keys[i]] + ' (cooldown ' + _SFX_COOLDOWN_MS + 'ms)');
          }
          _sfxSpamCount = {};
          _sfxSpamLogTimer = null;
        }, 1000);
      }
      return;
    }
    _sfxLastPlayed[name] = now;

    opts = opts || {};
    var resolved = _resolveURL(name);

    _loadBuffer(resolved.src, resolved.fallback).then(function (buf) {
      if (!buf) return;
      var source = _ctx.createBufferSource();
      source.buffer = buf;

      // Optional playback rate (pitch/speed modulation)
      if (typeof opts.playbackRate === 'number' && opts.playbackRate !== 1) {
        source.playbackRate.value = opts.playbackRate;
      }

      // Build audio graph chain: source → [gain] → [panner] → sfxGain
      var lastNode = source;

      // Per-clip volume
      if (typeof opts.volume === 'number' && opts.volume !== 1) {
        var g = _ctx.createGain();
        g.gain.value = opts.volume;
        lastNode.connect(g);
        lastNode = g;
      }

      // Stereo panning (e.g. -0.35 left foot, +0.35 right foot)
      if (typeof opts.pan === 'number' && opts.pan !== 0 && typeof _ctx.createStereoPanner === 'function') {
        var panner = _ctx.createStereoPanner();
        panner.pan.value = opts.pan;
        lastNode.connect(panner);
        lastNode = panner;
      }

      lastNode.connect(_sfxGain);
      source.start(0);
    });
  }

  // ── Streaming music via <audio> element ───────────────────
  // Large music files must NOT be decoded into a single AudioBuffer
  // (memory-heavy, slow to load, decodeAudioData can fail silently).
  // Instead we use an HTMLAudioElement that streams via Range requests,
  // routed through a MediaElementAudioSourceNode into the music gain bus.
  var _musicAudio = null;           // HTMLAudioElement (reused)
  var _musicMediaSource = null;     // MediaElementAudioSourceNode (created once)
  var _pendingMusicName = null;     // deferred name while context is suspended

  function _ensureMusicAudio() {
    if (_musicAudio) return _musicAudio;
    _ensureCtx();
    if (!_ctx) return null;

    _musicAudio = new Audio();
    _musicAudio.crossOrigin = 'anonymous';
    _musicAudio.preload = 'auto';

    // Route through Web Audio graph → _musicGain → _masterGain → dest
    _musicMediaSource = _ctx.createMediaElementSource(_musicAudio);
    _musicMediaSource.connect(_musicGain);

    // When track ends naturally
    _musicAudio.addEventListener('ended', function () {
      // If looping, the <audio>.loop attribute handles it natively
      if (!_musicAudio.loop) {
        var wasOnboarding = _onboardingMusic;
        _currentMusic = null;
        _notify();
        // Onboarding track finished — clear guard so biome music can take over
        if (wasOnboarding) {
          _onboardingMusic = false;
          console.log('[AudioSystem] Onboarding music ended — transitioning to biome music');
          // Dispatch event for monolith to trigger biome music (needs ctx)
          try { document.dispatchEvent(new CustomEvent('onboarding-music-ended')); } catch (e) {}
        }
      }
    });

    _musicAudio.addEventListener('error', function () {
      var err = _musicAudio.error;
      console.warn('[AudioSystem] Music streaming error:', err ? err.message : 'unknown',
        err ? '(code ' + err.code + ')' : '');
    });

    // Stalled: network fetch hung — try resuming
    _musicAudio.addEventListener('stalled', function () {
      console.warn('[AudioSystem] Music stalled — attempting recovery');
      if (_musicAudio.networkState === 2) {  // NETWORK_LOADING
        var ct = _musicAudio.currentTime;
        _musicAudio.load();
        _musicAudio.currentTime = ct;
        _musicAudio.play().catch(function () {});
      }
    });

    return _musicAudio;
  }

  /**
   * Start music track (streaming — no full-file download).
   * @param {string} name - logical music name (e.g. 'music-clubbed-to-death')
   */
  function playMusic(name) {
    if (!_ctx) _ensureCtx();
    if (!_ctx) return;

    // If context is still suspended (no user gesture yet), stash the
    // request and replay it once a gesture fires.  The gesture handler
    // sets _gestureActive = true and calls playMusic synchronously, so
    // we must NOT defer in that case (audio.play needs the activation).
    if (_ctx.state === 'suspended' && !_gestureActive) {
      _pendingMusicName = name;
      return;
    }
    _resume();
    _pendingMusicName = null;

    // Skip if the same track is already playing (prevents restart on same-biome floor change)
    if (_currentMusic && _currentMusic.name === name && _musicAudio && !_musicAudio.paused) {
      return;
    }

    var audio = _ensureMusicAudio();
    if (!audio) return;

    var entry = (_manifest && _manifest[name]) || {};
    var url = entry.src || ('/audio/music/' + name + '.webm');
    var fallbackUrl = entry.fallback || null;
    // Auto-generate MP3 fallback if none specified
    if (!fallbackUrl && url && url.endsWith('.webm')) {
      fallbackUrl = url.replace(/\.webm$/, '.mp3');
    }

    // Stop previous playback
    audio.pause();

    audio.loop = !!(entry.loop);

    // If browser can't play WebM, try MP3 fallback (iOS Safari <17)
    if (fallbackUrl && audio.canPlayType && !audio.canPlayType('audio/webm; codecs=opus')) {
      url = fallbackUrl;
    }

    audio.src = url;
    audio.load();

    audio.play().then(function () {
      console.log('[AudioSystem] Music streaming: ' + name);
    }).catch(function (err) {
      // If WebM failed, try fallback
      if (fallbackUrl && url !== fallbackUrl) {
        console.warn('[AudioSystem] Music play() failed for', url, '— trying fallback');
        // Abort previous load before switching source
        audio.pause();
        audio.src = fallbackUrl;
        audio.load();
        // Wait for enough data before playing to avoid race
        var canPlayHandler = function () {
          audio.removeEventListener('canplaythrough', canPlayHandler);
          audio.play().catch(function (err2) {
            console.warn('[AudioSystem] Music fallback also rejected:', err2);
          });
        };
        audio.addEventListener('canplaythrough', canPlayHandler);
        // Safety timeout in case canplaythrough never fires
        setTimeout(function () {
          audio.removeEventListener('canplaythrough', canPlayHandler);
          if (audio.paused && audio.src) {
            audio.play().catch(function () {});
          }
        }, 3000);
      } else {
        console.warn('[AudioSystem] Music play() rejected:', err);
      }
    });

    // Set metadata immediately so debrief widget shows the title
    _currentMusic = {
      source: audio,            // HTMLAudioElement instead of BufferSource
      name: name,
      title: entry.title || name,
      artist: entry.artist || ''
    };
    _notify();
  }

  function stopMusic() {
    if (_musicAudio) {
      _musicAudio.pause();
      _musicAudio.removeAttribute('src');
      _musicAudio.load();           // reset internal state
    }
    _currentMusic = null;
    _notify();
  }

  function setMasterMute(v) {
    _muted = !!v;
    _applyGains();
    _persist();
    _notify();
  }

  function toggleMute() {
    setMasterMute(!_muted);
  }

  function setMusicVolume(v) {
    _musicVol = Math.max(0, Math.min(100, Number(v) || 0));
    _applyGains();
    _persist();
    _notify();
  }

  function setSFXVolume(v) {
    _sfxVol = Math.max(0, Math.min(100, Number(v) || 0));
    _applyGains();
    _persist();
    _notify();
  }

  function getMasterMute()  { return _muted; }
  function getMusicVolume() { return _musicVol; }
  function getSFXVolume()   { return _sfxVol; }

  // ── Onboarding music guard API ──
  function setOnboardingMusic(v) { _onboardingMusic = !!v; }
  function isOnboardingMusic()   { return _onboardingMusic; }

  // ── Interior audio multiplier API ──
  // setMusicDim(0.25) = reduce music to 25% for shallow interiors
  // setMusicDim(1.0) = restore to user's normal volume
  function setMusicDim(v) {
    _musicDimMultiplier = Math.max(0, Math.min(1, Number(v) || 1));
    _applyGains();
  }
  // setFootstepBoost — DEPRECATED: footstep volume is now controlled by
  // floor-depth table in tickFootsteps().  Kept as no-op for compat.
  function setFootstepBoost(v) { /* no-op — depth table handles this */ }

  // Return the logical name of the currently playing music track (or null)
  function getNowPlayingName() {
    return _currentMusic ? _currentMusic.name : null;
  }

  function getNowPlaying() {
    // Music takes priority; video shows when no music is playing
    if (_currentMusic) {
      return {
        title: _currentMusic.title || '',
        artist: _currentMusic.artist || ''
      };
    }
    if (_videoNowPlaying) {
      return _videoNowPlaying;
    }
    return null;
  }

  function onStateChange(fn) {
    if (typeof fn === 'function') _listeners.push(fn);
    // Return unsubscribe
    return function () {
      _listeners = _listeners.filter(function (f) { return f !== fn; });
    };
  }

  // ── Global data-sound delegate (UI-CANON §17) ─────────────
  // Any element with data-sound="<name>" auto-plays on pointerdown.
  // Attached once by init() via event delegation on document.body.
  function _bindDataSoundDelegate() {
    document.body.addEventListener('pointerdown', function (e) {
      var el = e.target.closest('[data-sound]');
      if (!el) return;
      var name = el.getAttribute('data-sound');
      if (name) play(name, { volume: 0.6 });
    }, true);
  }

  /**
   * Play a random variant from a base name pattern.
   * e.g. playRandom('hit', 4) picks one of hit-1 … hit-4
   * @param {string} base  - base name prefix
   * @param {number} count - number of variants (1-indexed)
   * @param {Object} [opts] - same as play()
   */
  function playRandom(base, count, opts) {
    var n = Math.floor(Math.random() * count) + 1;
    play(base + '-' + n, opts);
  }

  /**
   * Play an ordered sequence of sounds with per-item delays.
   * Used by the door contract audio system for transition sequences
   * like DoorOpen → Ascend → DoorClose.
   *
   * @param {Array<{key:string, delay:number, volume?:number, playbackRate?:number}>} sounds
   * @param {number} [baseOffset=0] - Additional ms offset added to all delays
   */
  function playSequence(sounds, baseOffset) {
    if (!sounds || !sounds.length) return;
    baseOffset = baseOffset || 0;
    for (var i = 0; i < sounds.length; i++) {
      (function (snd) {
        var totalDelay = (snd.delay || 0) + baseOffset;
        var opts = { volume: snd.volume || 0.5 };
        if (snd.playbackRate) opts.playbackRate = snd.playbackRate;
        if (totalDelay <= 0) {
          play(snd.key, opts);
        } else {
          setTimeout(function () { play(snd.key, opts); }, totalDelay);
        }
      })(sounds[i]);
    }
  }

  // ── Footstep engine ──────────────────────────────────────
  // Time-based step clock with stereo panning, floor-depth volume,
  // injury limp cadence, and humanization.  Called every frame from
  // game-tick-system via tickFootsteps().
  //
  // Architecture:
  //   movement state → step timer → foot toggle → buffer playback
  //   → stereo pan → floor-depth multiplier → random variation

  // Biome → terrain mapping
  var _BIOME_TERRAIN = {
    FOREST: 'grass', LAKE: 'grass',
    GREY_CAVE: 'stone', OFFICE: 'stone', MALL: 'stone',
    INDUSTRIAL: 'stone', AEROSPACE: 'stone',
    SKI_MOUNTAIN: 'sand',
    JUNKYARD: 'dirt'
  };

  // Floor-depth volume table: [walkVol, runVol]
  // Wider spread so exterior→interior feels more distinct
  var _DEPTH_VOL = {
    0: [0.70, 0.80],   // exterior (slightly quieter open air)
    1: [1.05, 1.20],   // shallow interior (floor n.n — enclosed reverb)
    2: [1.20, 1.35]    // deep interior (floor n.n.n — tight space)
  };

  // Floor-depth pitch modifier (subtle — softens exterior→stone sample transition)
  var _DEPTH_PITCH = {
    0: 1.0,    // exterior — natural pitch
    1: 0.97,   // shallow interior — slightly warmer / less bright
    2: 0.95    // deep interior — even warmer stone resonance
  };

  // Cadence timing (ms)
  var _WALK_CADENCE  = 150;   // brisk walk (~45% faster than original 420ms)
  var _SPRINT_FULL   = 80;   // +10% faster (was 115ms), sprint ≈ 2.2× walk cadence
  var _LIMP_SHORT    = 150;   // injured: L step (quick) — matches walk cadence
  var _LIMP_LONG     = 300;   // injured: R step (drag)
  var _HEALTH_LIMP   = 0.30;  // limp when HP < 30%

  // Fatigue-based sprint deceleration
  // At fatigue 0   → sprint cadence = _SPRINT_FULL  (104ms, ~2.2× walk speed)
  // At fatigue 100 → sprint cadence = _WALK_CADENCE (229ms, exhausted = walking)
  // Linear interpolation between the two.
  // Future: wire sprint movement into fatigue spending so exhausted players
  //         can't maintain sprint speed.  The audio cadence already reflects this.

  // Stereo pan values (subtle, headphone-safe)
  var _PAN_LEFT  = -0.22;
  var _PAN_RIGHT =  0.22;

  // Player footstep volume multiplier (total ~78% reduction from original)
  var _PLAYER_FOOTSTEP_VOL = 0.224;  // -30% from 0.32

  // Step clock state
  var _stepFoot = 0;            // 0 = left, 1 = right
  var _stepNextTime = 0;        // performance.now() target for next step
  var _stepWasMoving = false;   // track movement start/stop

  /**
   * Tick the footstep engine.  Call once per game-tick frame.
   * The engine manages its own cadence timer internally — callers
   * just provide current movement state each frame.
   *
   * @param {boolean} moving        - is the player moving?
   * @param {boolean} sprinting     - is the player sprinting?
   * @param {string}  [biomeName]   - e.g. 'FOREST'. null = dirt fallback
   * @param {number}  interiorDepth - 0 = exterior, 1 = n.n, 2+ = n.n.n
   * @param {number}  healthPct     - 0-1 (player HP / maxHP)
   * @param {Object}  [opts]        - { fatigue: 0-100, isPlayer: true }
   */
  function tickFootsteps(moving, sprinting, biomeName, interiorDepth, healthPct, opts) {
    if (!_ctx || _ctx.state !== 'running') return;
    var now = performance.now();
    opts = opts || {};

    // Default to player footsteps (isPlayer true unless explicitly false)
    var isPlayer = (opts.isPlayer !== false);

    // Fatigue: 0 = fresh, 100 = exhausted (from GAMESTATE.getFatigue)
    var fatigue = (typeof opts.fatigue === 'number') ? Math.max(0, Math.min(100, opts.fatigue)) : 0;
    var fatiguePct = fatigue / 100;   // 0.0 (fresh) → 1.0 (exhausted)

    // Reset timer on movement start
    if (moving && !_stepWasMoving) {
      _stepNextTime = now;    // fire immediately on first step
      _stepFoot = 0;          // always start with left
    }
    _stepWasMoving = moving;
    if (!moving) return;

    // Not time yet?
    if (now < _stepNextTime) return;

    // ── Cadence ────────────────────────────────────────
    var isLimp = (typeof healthPct === 'number') && healthPct < _HEALTH_LIMP;
    var cadence;
    if (isLimp) {
      // Injured: L=quick step, R=drag (asymmetric cadence)
      cadence = (_stepFoot === 0) ? _LIMP_SHORT : _LIMP_LONG;
    } else if (sprinting) {
      // Sprint cadence: lerp between _SPRINT_FULL and _WALK_CADENCE
      // based on fatigue.  Fresh (0) → fastest.  Exhausted (100) → walk speed.
      cadence = _SPRINT_FULL + (_WALK_CADENCE - _SPRINT_FULL) * fatiguePct;
    } else {
      cadence = _WALK_CADENCE;
    }
    _stepNextTime = now + cadence;

    // ── Terrain from biome ─────────────────────────────
    var depth = Math.min(interiorDepth || 0, 2);
    var isInterior = depth > 0;
    var terrain = isInterior ? 'stone'
      : ((biomeName && _BIOME_TERRAIN[biomeName]) || 'dirt');

    // ── Foot toggle + side name ────────────────────────
    var side = (_stepFoot === 0) ? 'left' : 'right';
    var pan  = (_stepFoot === 0) ? _PAN_LEFT : _PAN_RIGHT;
    _stepFoot = 1 - _stepFoot;       // strict alternation

    // ── Volume from floor-depth table ──────────────────
    var depthVols = _DEPTH_VOL[depth] || _DEPTH_VOL[0];
    var vol = sprinting ? depthVols[1] : depthVols[0];

    // Player footstep volume reduction (60% quieter than base)
    if (isPlayer) {
      vol *= _PLAYER_FOOTSTEP_VOL;
    }

    // NPC/enemy/pet volume: use opts.volumeScale if provided (0-1)
    if (!isPlayer && typeof opts.volumeScale === 'number') {
      vol *= opts.volumeScale;
    }

    // Equipment modifiers (e.g. Stiletto Slippers quieter, Heavy Boots louder)
    if (isPlayer && typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getEquippedItems) {
      var equipped = PassiveItemsSystem.getEquippedItems();
      for (var i = 0; i < equipped.length; i++) {
        if (typeof equipped[i].footstep_volume_multiplier === 'number') {
          vol *= equipped[i].footstep_volume_multiplier;
        }
      }
    }

    // ── Humanization: ±5% volume, ±2% pitch ───────────
    var volJitter   = 0.95 + Math.random() * 0.10;   // 0.95–1.05
    var pitchJitter = 0.98 + Math.random() * 0.04;   // 0.98–1.02
    vol *= volJitter;

    var pitch = sprinting ? 1.08 : 1.0;              // sprint pitch reduced (was 1.15)
    pitch *= (_DEPTH_PITCH[depth] || 1.0);            // soften interior timbre
    pitch *= pitchJitter;

    // Limp pitch: injured drag step is lower
    if (isLimp && side === 'right') {
      pitch *= 0.85;   // drag foot sounds heavier / slower
      vol *= 1.15;     // louder thud on drag
    }

    // ── Fire the sound ─────────────────────────────────
    var name = 'footstep-' + side + '-' + terrain;
    play(name, { volume: vol, playbackRate: pitch, pan: pan });
  }

  // Legacy API — delegates to tickFootsteps for backward compatibility
  function playFootstep(biomeName, isInterior, running) {
    var depth = isInterior ? 1 : 0;
    tickFootsteps(true, running, biomeName, depth, 1.0, { isPlayer: true });
  }

  // ── Video element routing (through music/BGM bus) ─────────
  // Routes a <video> element's audio through the Web Audio music gain node
  // so it respects the BGM slider and master mute.
  // Optional mConsoleOverride: when true, video plays at 75% regardless of user BGM setting.
  var _videoMediaSource = null;
  var _videoElement = null;
  var _videoNowPlaying = null; // { title, artist } shown in audio widget when video is active

  function connectVideoElement(videoEl, mConsoleOverride, nowPlayingInfo) {
    disconnectVideoElement(); // Clean up any prior connection
    _ensureCtx();
    if (!_ctx || !_musicGain || !videoEl) {
      // AudioContext not available (no user gesture yet on iOS) —
      // set now-playing info but leave video muted; audio will be silent.
      _videoNowPlaying = nowPlayingInfo || null;
      _videoElement = videoEl;
      _notify();
      return;
    }
    try {
      _videoElement = videoEl;
      // Unmute: audio routes through Web Audio graph, not the element speaker
      // iOS: only works after AudioContext is resumed (requires prior user gesture)
      videoEl.muted = false;
      videoEl.volume = 1;
      _videoMediaSource = _ctx.createMediaElementSource(videoEl);
      if (mConsoleOverride) {
        // M-console narrative push: dedicated gain at 75% → master (bypasses user BGM setting)
        var overrideGain = _ctx.createGain();
        overrideGain.gain.value = 0.75;
        _videoMediaSource.connect(overrideGain);
        overrideGain.connect(_masterGain);
        _videoMediaSource._overrideGain = overrideGain; // Stash ref for cleanup
      } else {
        // Normal: route through music gain (respects BGM slider)
        _videoMediaSource.connect(_musicGain);
      }
      // Set now-playing info for the audio widget display
      _videoNowPlaying = nowPlayingInfo || null;
      _notify(); // Triggers widget re-render with new track info
    } catch (e) {
      console.warn('[AudioSystem] connectVideoElement failed:', e);
    }
  }

  function disconnectVideoElement() {
    try {
      if (_videoMediaSource) {
        _videoMediaSource.disconnect();
        if (_videoMediaSource._overrideGain) {
          _videoMediaSource._overrideGain.disconnect();
        }
        _videoMediaSource = null;
      }
      _videoElement = null;
      _videoNowPlaying = null;
      _notify(); // Widget re-renders, clears video track info
    } catch (e) {}
  }

  // Alias for external callers who might expect playSFX
  function playSFX(name, opts) {
    return play(name, opts || {});
  }

  // ── Return public interface ────────────────────────────────
  return {
    init: init,
    loadManifest: loadManifest,
    play: play,
    playRandom: playRandom,
    playSequence: playSequence,
    playFootstep: playFootstep,
    tickFootsteps: tickFootsteps,
    playMusic: playMusic,
    stopMusic: stopMusic,
    setMasterMute: setMasterMute,
    toggleMute: toggleMute,
    setMusicVolume: setMusicVolume,
    setSFXVolume: setSFXVolume,
    getMasterMute: getMasterMute,
    getMusicVolume: getMusicVolume,
    getSFXVolume: getSFXVolume,
    getNowPlaying: getNowPlaying,
    getNowPlayingName: getNowPlayingName,
    onStateChange: onStateChange,
    setOnboardingMusic: setOnboardingMusic,
    isOnboardingMusic: isOnboardingMusic,
    setMusicDim: setMusicDim,
    setFootstepBoost: setFootstepBoost,
    connectVideoElement: connectVideoElement,
    disconnectVideoElement: disconnectVideoElement,
    playSFX: playSFX
  };
})();
