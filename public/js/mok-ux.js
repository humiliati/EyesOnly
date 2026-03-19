/* ============================================================
   Lightweight MOK avatar driver for the landing CRT
   Routes all state changes through MOKStateMachine when available.
   Falls back to direct class manipulation pre-init.
   ============================================================ */
(function () {
  'use strict';

  var avatar = document.getElementById('mok-avatar');
  var interject = document.getElementById('mok-interject-body');
  var interjectTimer = null;
  var decayMs = 1400;

  function updateInterject(text) {
    if (interject && text) interject.textContent = text;
  }

  // ── State event map: mok-ux state names → MOKStateMachine event types ──
  var STATE_TO_EVENT = {
    'idle':    'idle_timer',
    'typing':  'tooltip_open',
    'output':  'card_played',
    'active':  'player_input',
    'ping':    'item_acquired',
    'combat':  'combat_start'
  };

  // All MOK state classes (for direct fallback only)
  var ALL_STATES = ['idle', 'typing', 'output', 'active',
    'mok-state-idle', 'mok-state-typing', 'mok-state-output',
    'mok-state-active', 'mok-state-ping', 'mok-state-combat',
    'mok-state-kernel-connected', 'mok-state-kernel-active', 'mok-state-kernel-error'];

  /**
   * Set avatar state — routes through MOKStateMachine if available,
   * falls back to direct class manipulation otherwise.
   */
  function setAvatarState(state, message, ttl) {
    if (!avatar) return;
    updateInterject(message);

    // Route through unified state machine when available
    if (typeof MOKStateMachine !== 'undefined' && MOKStateMachine.handleEvent) {
      var eventType = STATE_TO_EVENT[state];
      if (eventType) {
        MOKStateMachine.handleEvent({ type: eventType });
        return;
      }
      // For tooltip_close / idle, just reset
      if (state === 'idle') {
        MOKStateMachine.resetToIdle();
        return;
      }
    }

    // Fallback: direct class manipulation (pre-init)
    var i;
    for (i = 0; i < ALL_STATES.length; i++) avatar.classList.remove(ALL_STATES[i]);
    avatar.classList.add(state || 'idle');
    avatar.classList.add('mok-state-' + (state || 'idle'));
    if (interjectTimer) clearTimeout(interjectTimer);
    interjectTimer = window.setTimeout(function () {
      for (var j = 0; j < ALL_STATES.length; j++) avatar.classList.remove(ALL_STATES[j]);
      avatar.classList.add('idle');
      avatar.classList.add('mok-state-idle');
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
      e.stopPropagation();
      // If DebriefFeedController has wired interactive poke/spin handlers,
      // defer to those (they drive animation classes directly).
      // Only fall back to the basic ping state when the interactive system
      // hasn't bound yet (pre-controller init).
      if (avatar._mokInteractionBound) return;
      setAvatarState('ping', 'MOK is processing...', 1200);
    });
    avatar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        // Defer to interactive system if bound
        if (avatar._mokInteractionBound) return;
        e.preventDefault();
        setAvatarState('active', 'MOK is processing...', 1700);
      }
    });
  }

  var debriefWindow = document.getElementById('debrief-window');
  if (debriefWindow) {
    debriefWindow.addEventListener('click', function (e) {
      // Gone Rogue owns debrief behavior via DebriefFeedController; don't toggle here.
      if (document.body && (document.body.classList.contains('mode-gone-rogue') || document.body.classList.contains('in-gone-rogue') || document.body.classList.contains('gone-rogue-active'))) {
        return;
      }
      // Only toggle expansion when it won't conflict with in-window UI.
      // If the debrief is showing resources, clicks should interact with resources.
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

      // Only toggle when clicking non-interactive chrome (avoid hijacking buttons/inputs)
      if (e.target && (e.target.closest && e.target.closest('button, a, input, select, textarea'))) {
        return;
      }

      // Only EXPAND (normal → maximized). Never collapse from inside the feed.
      // Dismissing back to normal is handled by the background-tap handler
      // in debrief-feed-controller.js (_onBackgroundTap) so users can interact
      // with the maximized feed content without accidentally closing it.
      if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController._setDebriefState) {
        var currentState = DebriefFeedController._getDebriefState();
        if (currentState !== 'maximized') {
          DebriefFeedController._setDebriefState('maximized');
        }
      } else {
        // Fallback: only add, never remove
        if (!debriefWindow.classList.contains('debrief-maximized')) {
          debriefWindow.classList.add('debrief-maximized');
        }
      }
    });
  }

  // Input listeners to signal gentle animation via state machine
  var mobileInput = document.getElementById('mobile-input');
  if (mobileInput) {
    mobileInput.addEventListener('input', markTyping);
  }

  document.addEventListener('keydown', function (e) {
    var line = document.getElementById('input-line');
    if (!line || line.style.display === 'none') return;
    if (e.key && (e.key.length === 1 || e.key === 'Backspace')) {
      markTyping();
    }
  });

  // Patch Terminal output methods to drive avatar state via MOKStateMachine
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
