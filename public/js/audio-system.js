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
  var _musicVol = 70;         // 0-100
  var _sfxVol = 85;           // 0-100

  var _bufferCache = {};      // name → AudioBuffer
  var _loadingPromises = {};  // name → Promise<AudioBuffer>

  var _currentMusic = null;   // { source, name, title, artist }
  var _listeners = [];

  // ── Interior audio multipliers ──
  // These are system-controlled overlays on top of the user's volume settings.
  // Music dim: 1.0 = full user volume, 0.4 = 60% quieter (for interior n.n)
  // Footstep boost: 1.0 = default, 1.2 = 20% louder (for interiors)
  var _musicDimMultiplier = 1.0;
  var _footstepBoostMultiplier = 1.0;

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
      return { src: src, fallback: fb };
    }
    // Fallback: try /audio/sfx/{name}.webm → .mp3
    var defaultSrc = '/audio/sfx/' + name + '.webm';
    return { src: defaultSrc, fallback: defaultSrc.replace('.webm', '.mp3') };
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
        document.removeEventListener('keydown', handler, true);
      }
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('touchstart', handler, true);
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
    // If context is suspended (pre-gesture), try to resume and replay
    // the sound once active — don't just drop it.
    if (_ctx.state === 'suspended') {
      _ctx.resume().then(function () {
        play(name, opts);  // retry after resume
      }).catch(function () {});
      return;
    }
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

      // Optional per-clip volume
      if (typeof opts.volume === 'number' && opts.volume !== 1) {
        var g = _ctx.createGain();
        g.gain.value = opts.volume;
        source.connect(g);
        g.connect(_sfxGain);
      } else {
        source.connect(_sfxGain);
      }

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
        _currentMusic = null;
        _notify();
      }
    });

    _musicAudio.addEventListener('error', function () {
      var err = _musicAudio.error;
      console.warn('[AudioSystem] Music streaming error:', err ? err.message : 'unknown');
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
        audio.src = fallbackUrl;
        audio.load();
        audio.play().catch(function (err2) {
          console.warn('[AudioSystem] Music fallback also rejected:', err2);
        });
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
  // setFootstepBoost(1.2) = boost footsteps 20% inside buildings
  // setFootstepBoost(1.0) = restore to default
  function setFootstepBoost(v) {
    _footstepBoostMultiplier = Math.max(0.1, Math.min(3, Number(v) || 1));
  }

  // Return the logical name of the currently playing music track (or null)
  function getNowPlayingName() {
    return _currentMusic ? _currentMusic.name : null;
  }

  function getNowPlaying() {
    if (!_currentMusic) return null;
    return {
      title: _currentMusic.title || '',
      artist: _currentMusic.artist || ''
    };
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

  // ── Footstep system ───────────────────────────────────────
  // Alternates left/right, picks terrain from biome.
  // Biome → terrain mapping:
  //   grass: FOREST, LAKE
  //   stone: GREY_CAVE, OFFICE, MALL, INDUSTRIAL, AEROSPACE, interiors
  //   sand:  SKI_MOUNTAIN (snow ≈ sand crunch)
  //   dirt:  fallback / JUNKYARD
  var _footLeft = true;
  var _BIOME_TERRAIN = {
    FOREST:       'grass',
    LAKE:         'grass',
    GREY_CAVE:    'stone',
    OFFICE:       'stone',
    MALL:         'stone',
    INDUSTRIAL:   'stone',
    AEROSPACE:    'stone',
    SKI_MOUNTAIN: 'sand',
    JUNKYARD:     'dirt'
  };
  // Interior biomes default to stone (hard floors)
  var _INTERIOR_TERRAIN_DEFAULT = 'stone';

  /**
   * Play a footstep sound based on current biome.
   * Uses terrain-specific left/right alternating clips from R2:
   *   footstep-left-grass, footstep-right-stone, etc.
   * @param {string} [biomeName] - e.g. 'FOREST', 'GREY_CAVE'. Omit = dirt fallback.
   * @param {boolean} [isInterior] - true if inside a building
   * @param {boolean} [running] - true for faster steps (higher pitch)
   */
  function playFootstep(biomeName, isInterior, running) {
    var terrain;
    if (isInterior) {
      terrain = _INTERIOR_TERRAIN_DEFAULT;
    } else {
      terrain = (biomeName && _BIOME_TERRAIN[biomeName]) || 'dirt';
    }
    var side = _footLeft ? 'left' : 'right';
    _footLeft = !_footLeft;

    var name = 'footstep-' + side + '-' + terrain;
    // Audible base volume — leaves headroom for boost/equipment multipliers
    var vol = running ? 0.7 : 0.5;
    var pitch = running ? 1.15 : 1.0;

    // Apply interior boost multiplier (e.g. 1.2 inside buildings)
    vol *= _footstepBoostMultiplier;

    // Equipment modifiers (e.g. Stiletto Slippers quieter, Heavy Boots louder)
    if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getEquippedItems) {
      var equipped = PassiveItemsSystem.getEquippedItems();
      for (var i = 0; i < equipped.length; i++) {
        if (typeof equipped[i].footstep_volume_multiplier === 'number') {
          vol *= equipped[i].footstep_volume_multiplier;
        }
      }
    }

    play(name, { volume: vol, playbackRate: pitch });
  }

  // ── Return public interface ────────────────────────────────
  return {
    init: init,
    loadManifest: loadManifest,
    play: play,
    playRandom: playRandom,
    playFootstep: playFootstep,
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
    setFootstepBoost: setFootstepBoost
  };
})();
