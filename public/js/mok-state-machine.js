/* ============================================================
   EYES ONLY - MOK State Machine (Unified)
   Manages MOK avatar animation states, event responses, and
   interactive poke/spin states from debrief feed.

   Drives the CSS 3D pyramid via classes on #mok-avatar.
   Replaces legacy MOKVisualEngine dependency with direct CSS class control.

   Priority system: higher priority events interrupt lower ones.
   Interactive states (poke, spin, squish) are priority 1 — any
   game event overrides them, but they override idle.
   ============================================================ */

const MOKStateMachine = (function() {
  'use strict';

  // ── State class mapping ──
  // Maps internal cycle IDs to CSS classes on #mok-avatar
  var CYCLE_TO_CLASS = {
    'idle_breathe':     'mok-state-idle',
    'talking_active':   'mok-state-typing',
    'processing_think': 'mok-state-output',
    'alert_pulse':      'mok-state-active',
    'happy_response':   'mok-state-ping',
    'warning_flash':    'mok-state-kernel-error',
    'error_critical':   'mok-state-kernel-error',
    'sleep_dormant':    'mok-state-idle',
    'shocked_reaction': 'mok-state-combat',
    // Kernel states (set directly by KernelManager)
    'kernel_connected': 'mok-state-kernel-connected',
    'kernel_active':    'mok-state-kernel-active',
    'kernel_error':     'mok-state-kernel-error',
    // Combat
    'combat':           'mok-state-combat'
  };

  // All CSS state classes (for cleanup)
  var ALL_STATE_CLASSES = [
    'idle', 'typing', 'output', 'active',
    'mok-state-idle', 'mok-state-typing', 'mok-state-output',
    'mok-state-active', 'mok-state-ping', 'mok-state-combat',
    'mok-state-kernel-connected', 'mok-state-kernel-active', 'mok-state-kernel-error'
  ];

  // Interactive poke classes (cleared before game state changes)
  var POKE_CLASSES = [
    'mok-poke-down', 'mok-poke-up', 'mok-spin-burst',
    'mok-dragging', 'mok-drag-release', 'mok-squish'
  ];

  // ── Event → transition map ──
  var TRANSITIONS = {
    'player_input':        { cycleId: 'alert_pulse',      priority: 4, duration: 1500 },
    'card_played':         { cycleId: 'processing_think', priority: 3, duration: 3000 },
    'card_success':        { cycleId: 'happy_response',   priority: 3, duration: 2000 },
    'card_failed':         { cycleId: 'warning_flash',    priority: 6, duration: 3000 },
    'resource_low':        { cycleId: 'warning_flash',    priority: 6, duration: 2000 },
    'combat_start':        { cycleId: 'combat',           priority: 4, duration: 0 },
    'combat_victory':      { cycleId: 'happy_response',   priority: 3, duration: 3000 },
    'combat_defeat':       { cycleId: 'error_critical',   priority: 7, duration: 5000 },
    'item_acquired':       { cycleId: 'happy_response',   priority: 3, duration: 2000 },
    'item_disposed':       { cycleId: 'processing_think', priority: 3, duration: 1500 },
    'error':               { cycleId: 'error_critical',   priority: 7, duration: 5000 },
    'kernel_connected':    { cycleId: 'kernel_connected', priority: 3, duration: 0 },
    'kernel_disconnected': { cycleId: 'error_critical',   priority: 7, duration: 3000 },
    'kernel_active':       { cycleId: 'kernel_active',    priority: 3, duration: 0 },
    'tooltip_open':        { cycleId: 'talking_active',   priority: 5, duration: 0 },
    'tooltip_close':       { cycleId: 'idle_breathe',     priority: 0, duration: 0 },
    'idle_timer':          { cycleId: 'sleep_dormant',    priority: 0, duration: 0 },
    // Interactive events from debrief feed (low priority, any game event overrides)
    'poke':                { cycleId: 'alert_pulse',      priority: 1, duration: 650 },
    'spin_burst':          { cycleId: 'happy_response',   priority: 1, duration: 850 },
    'squish':              { cycleId: 'processing_think', priority: 1, duration: 400 }
  };

  var _state = {
    currentCycle: 'idle_breathe',
    priority: 0,
    queue: [],
    idleTime: 0
  };

  var _avatarEl = null;
  var _decayTimer = null;
  var _idleThreshold = 30000; // 30s before sleep
  var _idleInterval = null;

  /**
   * Initialize the state machine.
   * @param {HTMLElement|object} [target] - The #mok-avatar element (or legacy visualEngine, ignored)
   */
  function init(target) {
    // Accept either an element or legacy visualEngine (backward compat)
    if (target && target.nodeType) {
      _avatarEl = target;
    } else {
      _avatarEl = document.getElementById('mok-avatar');
    }
    _setState('idle_breathe', 0);

    // Start idle timer
    if (_idleInterval) clearInterval(_idleInterval);
    _idleInterval = setInterval(function() {
      updateIdleTimer(1000);
    }, 1000);
  }

  /**
   * Handle incoming event
   */
  function handleEvent(event) {
    if (!event || !event.type) return;
    _state.idleTime = 0;

    var transition = TRANSITIONS[event.type];
    if (!transition) {
      // Unknown event — brief alert then idle
      _setState('alert_pulse', 2);
      _scheduleDecay(1500);
      return;
    }

    if (transition.priority >= _state.priority) {
      _setState(transition.cycleId, transition.priority);
      if (transition.duration > 0) {
        _scheduleDecay(transition.duration);
      }
    } else {
      _state.queue.push(event);
    }
  }

  /**
   * Set current animation state via CSS classes
   */
  function _setState(cycleId, priority) {
    _state.currentCycle = cycleId;
    _state.priority = priority;

    if (!_avatarEl) _avatarEl = document.getElementById('mok-avatar');
    if (!_avatarEl) return;

    // Clear all state + poke classes
    var i;
    for (i = 0; i < ALL_STATE_CLASSES.length; i++) {
      _avatarEl.classList.remove(ALL_STATE_CLASSES[i]);
    }
    for (i = 0; i < POKE_CLASSES.length; i++) {
      _avatarEl.classList.remove(POKE_CLASSES[i]);
    }

    // Apply new state class
    var cls = CYCLE_TO_CLASS[cycleId] || 'mok-state-idle';
    _avatarEl.classList.add(cls);

    // Also add legacy shorthand class (for mok-ux.js compat)
    var shorthand = cls.replace('mok-state-', '');
    if (ALL_STATE_CLASSES.indexOf(shorthand) !== -1) {
      _avatarEl.classList.add(shorthand);
    }
  }

  /**
   * Schedule decay back to idle after duration
   */
  function _scheduleDecay(ms) {
    if (_decayTimer) clearTimeout(_decayTimer);
    _decayTimer = setTimeout(function() {
      _decayTimer = null;
      _processQueueOrIdle();
    }, ms);
  }

  /**
   * Process next queued event or return to idle
   */
  function _processQueueOrIdle() {
    if (_state.queue.length > 0) {
      var next = _state.queue.shift();
      handleEvent(next);
    } else {
      _setState('idle_breathe', 0);
    }
  }

  /**
   * Update idle timer
   */
  function updateIdleTimer(deltaMs) {
    _state.idleTime += deltaMs;
    if (_state.idleTime > _idleThreshold && _state.currentCycle !== 'sleep_dormant') {
      handleEvent({ type: 'idle_timer' });
    }
  }

  /**
   * Process queued events (called externally if needed)
   */
  function processQueue() {
    if (_state.queue.length === 0) return;
    if (_state.priority < 3) {
      _processQueueOrIdle();
    }
  }

  /**
   * Get current state
   */
  function getState() {
    return {
      currentCycle: _state.currentCycle,
      priority: _state.priority,
      queueLength: _state.queue.length,
      idleTime: _state.idleTime
    };
  }

  /**
   * Reset to idle
   */
  function resetToIdle() {
    if (_decayTimer) { clearTimeout(_decayTimer); _decayTimer = null; }
    _state.queue = [];
    _state.idleTime = 0;
    _setState('idle_breathe', 0);
  }

  /**
   * Check if an interactive poke/spin is allowed right now.
   * Returns true if current priority is low enough for interaction.
   */
  function canInteract() {
    return _state.priority <= 1;
  }

  return {
    init: init,
    handleEvent: handleEvent,
    updateIdleTimer: updateIdleTimer,
    processQueue: processQueue,
    getState: getState,
    resetToIdle: resetToIdle,
    canInteract: canInteract
  };
})();
