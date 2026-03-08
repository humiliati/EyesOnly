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
    if (_musicGain) _musicGain.gain.value = _musicVol / 100;
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

  function _loadBuffer(url) {
    if (_bufferCache[url]) return Promise.resolve(_bufferCache[url]);
    if (_loadingPromises[url]) return _loadingPromises[url];

    _loadingPromises[url] = fetch(url)
      .then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status + ' for ' + url);
        return resp.arrayBuffer();
      })
      .then(function (ab) {
        return _ctx.decodeAudioData(ab);
      })
      .then(function (buf) {
        _bufferCache[url] = buf;
        delete _loadingPromises[url];
        return buf;
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
      return _manifest[name].src || _manifest[name].file;
    }
    // Fallback: try /audio/sfx/{name}.webm → .wav
    return '/audio/sfx/' + name + '.webm';
  }

  // ── Public API ─────────────────────────────────────────────

  function init() {
    _restore();
    _ensureCtx();

    // Auto-load manifest from canonical location
    loadManifest('/audio/audio-manifest.json');

    // Resume on first user gesture (click/touch anywhere)
    var handler = function () {
      _resume();
      document.removeEventListener('click', handler, true);
      document.removeEventListener('touchstart', handler, true);
      document.removeEventListener('keydown', handler, true);
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('touchstart', handler, true);
    document.addEventListener('keydown', handler, true);

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
    // Don't attempt playback while context is suspended (pre-gesture).
    // The buffer load + decode would succeed but source.start() would
    // generate "AudioContext was not allowed to start" warnings.
    if (_ctx.state === 'suspended') {
      _resume();          // queue a resume for next gesture
      return;             // silently skip this play request
    }
    _resume();

    opts = opts || {};
    var url = _resolveURL(name);

    _loadBuffer(url).then(function (buf) {
      if (!buf) return;
      var source = _ctx.createBufferSource();
      source.buffer = buf;

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

  /**
   * Start music track (crossfade from current)
   * @param {string} name - logical music name
   */
  function playMusic(name) {
    if (!_ctx) _ensureCtx();
    if (!_ctx) return;
    // If context is still suspended (no user gesture yet), defer the
    // playMusic call until the context resumes.
    if (_ctx.state === 'suspended') {
      var _pendingName = name;
      _ctx.resume().then(function () {
        playMusic(_pendingName);
      }).catch(function () {});
      return;
    }
    _resume();

    // Stop current if any
    if (_currentMusic && _currentMusic.source) {
      try { _currentMusic.source.stop(); } catch (e) {}
    }

    var entry = (_manifest && _manifest[name]) || {};
    var url = entry.src || ('/audio/music/' + name + '.webm');

    _loadBuffer(url).then(function (buf) {
      if (!buf) return;
      var source = _ctx.createBufferSource();
      source.buffer = buf;
      source.loop = !!(entry.loop);
      source.connect(_musicGain);
      source.start(0);

      _currentMusic = {
        source: source,
        name: name,
        title: entry.title || name,
        artist: entry.artist || ''
      };
      _notify();
    });
  }

  function stopMusic() {
    if (_currentMusic && _currentMusic.source) {
      try { _currentMusic.source.stop(); } catch (e) {}
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

  // ── Return public interface ────────────────────────────────
  return {
    init: init,
    loadManifest: loadManifest,
    play: play,
    playRandom: playRandom,
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
    onStateChange: onStateChange,
    setOnboardingMusic: setOnboardingMusic,
    isOnboardingMusic: isOnboardingMusic
  };
})();
