/* ============================================================
   Audio Mini Widget — Minimal mute toggle for non-terminal pages
   ============================================================
   A tiny floating button that shows audio state (muted/unmuted).
   Initializes AudioSystem on first interaction.

   Placement:
     Default: bottom-right corner, above the NCH capsule.
     Can be positioned via CSS overrides per page.

   Usage:
     <script src="js/audio-mini-widget.js"></script>
     (auto-creates on DOMContentLoaded if AudioSystem is present)
   ============================================================ */

;(function () {
  'use strict';

  function init() {
    if (typeof AudioSystem === 'undefined') return;

    // Don't create if the full audio-controls-widget is present (terminal page)
    if (document.getElementById('audio-controls-inline')) return;

    // Create the widget
    var btn = document.createElement('button');
    btn.id = 'audio-mini-toggle';
    btn.className = 'audio-mini-toggle';
    btn.setAttribute('aria-label', 'Toggle audio');
    btn.setAttribute('title', 'Toggle audio');
    btn.innerHTML = AudioSystem.getMasterMute() ? '🔇' : '🔊';

    btn.addEventListener('click', function () {
      // Init audio on first interaction (user gesture requirement)
      if (!AudioSystem._initialized) {
        AudioSystem.init();
        AudioSystem._initialized = true;
      }
      AudioSystem.toggleMute();
      btn.innerHTML = AudioSystem.getMasterMute() ? '🔇' : '🔊';
    });

    // Listen for external mute state changes
    AudioSystem.onStateChange(function () {
      btn.innerHTML = AudioSystem.getMasterMute() ? '🔇' : '🔊';
    });

    // Style inline (so it works without a dedicated CSS file)
    btn.style.cssText = [
      'position: fixed',
      'bottom: 16px',
      'right: 16px',
      'z-index: 1500',
      'width: 36px',
      'height: 36px',
      'border-radius: 50%',
      'border: 1px solid rgba(255,255,255,0.15)',
      'background: rgba(0,0,0,0.6)',
      'color: #fff',
      'font-size: 16px',
      'cursor: pointer',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'backdrop-filter: blur(4px)',
      'transition: opacity 0.2s, transform 0.2s',
      'opacity: 0.5',
    ].join(';');

    btn.addEventListener('mouseenter', function () { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', function () { btn.style.opacity = '0.5'; });

    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
