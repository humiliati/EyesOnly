/* Lightweight MOK avatar driver for the landing CRT */
(function () {
  'use strict';

  var avatar = document.getElementById('mok-avatar');
  var interject = document.getElementById('mok-interject-body');
  var interjectTimer = null;
  var decayMs = 1400;

  function updateInterject(text) {
    if (interject && text) interject.textContent = text;
  }

  function setAvatarState(state, message, ttl) {
    if (!avatar) return;
    avatar.classList.remove('idle', 'typing', 'output', 'active');
    avatar.classList.add(state || 'idle');
    updateInterject(message);
    if (interjectTimer) clearTimeout(interjectTimer);
    interjectTimer = window.setTimeout(function () {
      avatar.classList.remove('typing', 'output', 'active');
      avatar.classList.add('idle');
    }, ttl || decayMs);
  }

  function markTyping() {
    setAvatarState('typing', 'MOK: listening for input', 900);
  }

  function markOutput(msg) {
    setAvatarState('output', msg || 'MOK relays console output', 1500);
  }

  if (avatar) {
    avatar.addEventListener('click', function (e) {
      e.stopPropagation(); // Prevent debrief window expansion when clicking MOK
      setAvatarState('active', 'MOK is processing...', 1700);
    });
    avatar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setAvatarState('active', 'MOK is processing...', 1700);
      }
    });
  }

  var debriefWindow = document.getElementById('debrief-window');
  if (debriefWindow) {
    debriefWindow.addEventListener('click', function (e) {
      // Gone Rogue owns debrief behavior; don't toggle global "expanded" here.
      if (document.body && (document.body.classList.contains('mode-gone-rogue') || document.body.classList.contains('in-gone-rogue') || document.body.classList.contains('gone-rogue-active'))) {
        return;
      }
      // Only toggle expansion when it won't conflict with in-window UI.
      // If the debrief is showing resources, clicks should interact with resources (cycle, select lines, etc.).
      try {
        var display = (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.getCurrentDisplay)
          ? DebriefFeedController.getCurrentDisplay()
          : null;
        if (display === 'resources') {
          return;
        }
      } catch (err) { /* ignore */ }

      // Never toggle when clicking the MOK avatar itself
      if (avatar && (e.target === avatar || avatar.contains(e.target))) {
        return;
      }

      // Only toggle when clicking non-interactive chrome (avoid hijacking clicks on buttons/inputs)
      if (e.target && (e.target.closest && e.target.closest('button, a, input, select, textarea'))) {
        return;
      }

      debriefWindow.classList.toggle('expanded');
    });
  }

  // Input listeners to signal gentle animation
  var mobileInput = document.getElementById('mobile-input');
  if (mobileInput) {
    mobileInput.addEventListener('input', markTyping);
  }

  document.addEventListener('keydown', function (e) {
    var line = document.getElementById('input-line');
    if (!line || line.style.display === 'none') return;
    if (e.key.length === 1 || e.key === 'Backspace') {
      markTyping();
    }
  });

  // Patch Terminal output methods to drive avatar state
  if (typeof Terminal !== 'undefined') {
    var originalWriteLine = Terminal.writeLine;
    Terminal.writeLine = function () {
      markOutput('MOK echoes transmission');
      return originalWriteLine.apply(Terminal, arguments);
    };

    var originalTypeText = Terminal.typeText;
    Terminal.typeText = function () {
      markOutput('MOK printing signal');
      return originalTypeText.apply(Terminal, arguments).then(function (result) {
        setAvatarState('idle');
        return result;
      });
    };

    var originalTypeLines = Terminal.typeLines;
    Terminal.typeLines = function () {
      markOutput('MOK printing signal');
      return originalTypeLines.apply(Terminal, arguments).then(function (result) {
        setAvatarState('idle', null, 1200);
        return result;
      });
    };
  }
})();
