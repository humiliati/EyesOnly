/* ============================================================
   EYES ONLY — Audio Controls Widget
   Wires the debrief-label audio UI to AudioSystem.
   Lives outside debrief-feed-controller to avoid bloating it.

   Loaded AFTER: audio-system.js, debrief-feed-controller.js
   ============================================================ */

const AudioControlsWidget = (function () {
  'use strict';

  var _bound = false;
  var _dropdownOpen = false;

  // Long-press config
  var LONG_PRESS_MS = 400;
  var _pressTimer = null;
  var _longPressed = false;

  // Element refs (cached on init)
  var _el = {};

  function _$(id) { return document.getElementById(id); }

  function _render() {
    if (!_el.speakerBtn) return;

    var muted = AudioSystem.getMasterMute();
    var musicVol = AudioSystem.getMusicVolume();
    var sfxVol = AudioSystem.getSFXVolume();
    var nowPlaying = AudioSystem.getNowPlaying();

    // Icon swap
    _el.iconOn.style.display    = muted ? 'none' : '';
    _el.iconMuted.style.display = muted ? ''     : 'none';

    // Muted class on speaker
    _el.speakerBtn.classList.toggle('muted', muted);

    // Dropdown state
    _el.dropdown.classList.toggle('open', _dropdownOpen);
    _el.chevron.classList.toggle('open', _dropdownOpen);

    // Mute toggle button text
    _el.muteToggle.textContent = muted ? 'muted' : 'on';
    _el.muteToggle.classList.toggle('muted', muted);

    // Slider values (only update if user isn't dragging)
    if (document.activeElement !== _el.musicSlider) {
      _el.musicSlider.value = musicVol;
    }
    _el.musicVal.textContent = musicVol;

    if (document.activeElement !== _el.sfxSlider) {
      _el.sfxSlider.value = sfxVol;
    }
    _el.sfxVal.textContent = sfxVol;

    // Disabled sliders when muted
    _el.musicRow.classList.toggle('disabled', muted);
    _el.sfxRow.classList.toggle('disabled', muted);

    // Track info
    if (nowPlaying && nowPlaying.title) {
      _el.trackTitle.textContent = nowPlaying.title;
      _el.trackArtist.textContent = nowPlaying.artist || '';
      _el.trackRow.style.display = '';
    } else {
      _el.trackTitle.textContent = '\u2014'; // em-dash
      _el.trackArtist.textContent = '';
    }
  }

  function _toggleDropdown() {
    _dropdownOpen = !_dropdownOpen;
    _render();
  }

  function _openDropdown() {
    _dropdownOpen = true;
    _render();
  }

  function _closeDropdown() {
    _dropdownOpen = false;
    _render();
  }

  function init() {
    if (_bound) return;

    // Cache elements
    _el.speakerBtn  = _$('audio-speaker-btn');
    _el.chevronBtn  = _$('audio-chevron-btn');
    _el.chevron     = _$('audio-chevron');
    _el.dropdown    = _$('audio-dropdown');
    _el.iconOn      = _$('audio-icon-on');
    _el.iconMuted   = _$('audio-icon-muted');
    _el.muteToggle  = _$('audio-mute-toggle');
    _el.musicSlider = _$('audio-music-slider');
    _el.sfxSlider   = _$('audio-sfx-slider');
    _el.musicVal    = _$('audio-music-val');
    _el.sfxVal      = _$('audio-sfx-val');
    _el.musicRow    = _$('audio-music-row');
    _el.sfxRow      = _$('audio-sfx-row');
    _el.trackTitle  = _$('audio-track-title');
    _el.trackArtist = _$('audio-track-artist');
    _el.trackRow    = _$('audio-track-row');

    if (!_el.speakerBtn) {
      console.warn('[AudioControlsWidget] Audio controls not found in DOM');
      return;
    }

    _bound = true;

    // ── Speaker button: click = mute, long-press = open dropdown ──

    _el.speakerBtn.addEventListener('pointerdown', function (e) {
      _longPressed = false;
      _el.speakerBtn.classList.add('pressing');
      _pressTimer = setTimeout(function () {
        _longPressed = true;
        _el.speakerBtn.classList.remove('pressing');
        _openDropdown();
      }, LONG_PRESS_MS);
      // Stop event from reaching debrief-label drag/resize handlers
      e.stopPropagation();
    });

    _el.speakerBtn.addEventListener('pointerup', function (e) {
      clearTimeout(_pressTimer);
      _el.speakerBtn.classList.remove('pressing');
      if (!_longPressed) {
        AudioSystem.toggleMute();
      }
      e.stopPropagation();
    });

    _el.speakerBtn.addEventListener('pointerleave', function () {
      clearTimeout(_pressTimer);
      _el.speakerBtn.classList.remove('pressing');
    });

    // Prevent context menu on mobile long-press
    _el.speakerBtn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    // Prevent click from bubbling to debrief-label toggle logic
    _el.speakerBtn.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    // ── Chevron: click = toggle dropdown ──

    _el.chevronBtn.addEventListener('click', function (e) {
      _toggleDropdown();
      e.stopPropagation();
    });

    // ── Dropdown mute toggle ──

    _el.muteToggle.addEventListener('click', function (e) {
      AudioSystem.toggleMute();
      e.stopPropagation();
    });

    // ── Sliders ──

    _el.musicSlider.addEventListener('input', function () {
      AudioSystem.setMusicVolume(Number(this.value));
    });
    // Prevent pointer events from reaching debrief drag
    _el.musicSlider.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    _el.sfxSlider.addEventListener('input', function () {
      AudioSystem.setSFXVolume(Number(this.value));
    });
    _el.sfxSlider.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    // ── Close dropdown on outside click ──

    document.addEventListener('click', function (e) {
      if (!_dropdownOpen) return;
      var inside = e.target.closest &&
                   (e.target.closest('.audio-controls-inline') ||
                    e.target.closest('.audio-dropdown'));
      if (!inside) _closeDropdown();
    });

    // ── Subscribe to AudioSystem state changes ──

    AudioSystem.onStateChange(_render);

    // Prevent all debrief-label interactive events from reaching
    // audio controls (and vice versa)
    var inlineWrap = _$('audio-controls-inline');
    if (inlineWrap) {
      ['pointerdown', 'pointermove', 'pointerup', 'dblclick'].forEach(function (evt) {
        inlineWrap.addEventListener(evt, function (e) { e.stopPropagation(); });
      });
    }
    var dropdown = _$('audio-dropdown');
    if (dropdown) {
      ['pointerdown', 'pointermove', 'pointerup', 'click', 'dblclick'].forEach(function (evt) {
        dropdown.addEventListener(evt, function (e) { e.stopPropagation(); });
      });
    }

    // Initialize AudioSystem and render
    AudioSystem.init();
    _render();

    console.log('[AudioControlsWidget] Initialized');
  }

  /**
   * Update track info from external source
   * (e.g. when DebriefFeedController switches to video mode)
   */
  function setTrackInfo(title, artist) {
    var trackTitle = _$('audio-track-title');
    var trackArtist = _$('audio-track-artist');
    if (trackTitle) trackTitle.textContent = title || '\u2014';
    if (trackArtist) trackArtist.textContent = artist || '';
  }

  return {
    init: init,
    setTrackInfo: setTrackInfo
  };
})();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    AudioControlsWidget.init();
  });
} else {
  AudioControlsWidget.init();
}
