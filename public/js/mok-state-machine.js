/* ============================================================
   EYES ONLY - MOK State Machine
   Manages MOK AI animation states and event responses
   ============================================================ */

const MOKStateMachine = (function() {
  'use strict';

  /**
   * @typedef {Object} MOKEvent
   * @property {string} type - Event type
   * @property {*} data - Event data
   */

  /**
   * @typedef {Object} MOKState
   * @property {string} currentCycle - Current animation cycle ID
   * @property {number} priority - Current priority (higher interrupts lower)
   * @property {MOKEvent[]} queue - Event queue
   * @property {number} idleTime - Time in ms since last event
   */

  var _state = {
    currentCycle: 'idle_breathe',
    priority: 0,
    queue: [],
    idleTime: 0
  };

  var _visualEngine = null;
  var _idleThreshold = 30000; // 30 seconds before sleep mode

  /**
   * Initialize the state machine
   */
  function init(visualEngine) {
    _visualEngine = visualEngine;
    _setState('idle_breathe', 0);
  }

  /**
   * Handle incoming event
   * @param {MOKEvent} event
   */
  function handleEvent(event) {
    _state.idleTime = 0; // Reset idle timer

    var transition = _getTransitionForEvent(event);
    
    if (!transition) {
      // No specific transition, use default response
      _queueDefaultResponse(event);
      return;
    }

    // Check priority - higher priority interrupts
    if (transition.priority > _state.priority) {
      _interruptCurrentAnimation(transition);
    } else {
      _queueEvent(event);
    }
  }

  /**
   * Get animation transition for event
   */
  function _getTransitionForEvent(event) {
    var transitionMap = {
      'player_input': { cycleId: 'alert_pulse', priority: 4 },
      'card_played': { cycleId: 'processing_think', priority: 3 },
      'card_success': { cycleId: 'happy_response', priority: 3 },
      'card_failed': { cycleId: 'warning_flash', priority: 6 },
      'resource_low': { cycleId: 'warning_flash', priority: 6 },
      'combat_start': { cycleId: 'alert_pulse', priority: 4 },
      'combat_victory': { cycleId: 'happy_response', priority: 3 },
      'combat_defeat': { cycleId: 'error_critical', priority: 7 },
      'item_acquired': { cycleId: 'happy_response', priority: 3 },
      'item_disposed': { cycleId: 'processing_think', priority: 3 },
      'error': { cycleId: 'error_critical', priority: 7 },
      'kernel_connected': { cycleId: 'happy_response', priority: 3 },
      'kernel_disconnected': { cycleId: 'error_critical', priority: 7 },
      'tooltip_open': { cycleId: 'talking_active', priority: 5 },
      'tooltip_close': { cycleId: 'idle_breathe', priority: 0 },
      'idle_timer': { cycleId: 'sleep_dormant', priority: 0 }
    };

    return transitionMap[event.type] || null;
  }

  /**
   * Set current state
   */
  function _setState(cycleId, priority) {
    _state.currentCycle = cycleId;
    _state.priority = priority;
    
    if (_visualEngine) {
      _visualEngine.playAnimation(cycleId);
    }
  }

  /**
   * Interrupt current animation
   */
  function _interruptCurrentAnimation(transition) {
    _setState(transition.cycleId, transition.priority);
  }

  /**
   * Queue event for later processing
   */
  function _queueEvent(event) {
    _state.queue.push(event);
  }

  /**
   * Queue default response
   */
  function _queueDefaultResponse(event) {
    // Default to brief alert then back to idle
    _setState('alert_pulse', 4);
    setTimeout(function() {
      _setState('idle_breathe', 0);
    }, 1500);
  }

  /**
   * Update idle timer
   */
  function updateIdleTimer(deltaMs) {
    _state.idleTime += deltaMs;
    
    if (_state.idleTime > _idleThreshold && _state.currentCycle !== 'sleep_dormant') {
      handleEvent({ type: 'idle_timer', data: { duration: _state.idleTime } });
    }
  }

  /**
   * Process queued events
   */
  function processQueue() {
    if (_state.queue.length === 0) return;
    
    // Process next event if current animation allows
    if (_state.priority < 5) {
      var nextEvent = _state.queue.shift();
      handleEvent(nextEvent);
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
    _setState('idle_breathe', 0);
    _state.queue = [];
    _state.idleTime = 0;
  }

  // Public API
  return {
    init: init,
    handleEvent: handleEvent,
    updateIdleTimer: updateIdleTimer,
    processQueue: processQueue,
    getState: getState,
    resetToIdle: resetToIdle
  };
})();
