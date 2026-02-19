/* ============================================================
   EYES ONLY - MOK Animation Cycle Definitions
   Animation patterns for MOK AI expressions
   ============================================================ */

const MOKAnimationCycles = (function() {
  'use strict';

  /**
   * Animation cycle definition
   * @typedef {Object} AnimationCycle
   * @property {string} cycleId - Unique identifier
   * @property {string} expression - Expression name
   * @property {number[]} frames - Frame indices  
   * @property {number[]} timing - Duration per frame in ms
   * @property {boolean} loop - Whether to loop
   * @property {Object} exitCondition - When to exit (optional)
   */

  /**
   * Standard animation cycles
   * For now these use placeholder frame counts
   * TODO: Implement sprite sheet cutting engine for actual frames
   */
  var CYCLES = {
    // Default idle breathing animation
    idle_breathe: {
      cycleId: 'idle_breathe',
      expression: 'neutral',
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      timing: [500, 500, 500, 500, 500, 500, 500, 500],
      loop: true,
      priority: 0
    },

    // Active speech/response
    talking_active: {
      cycleId: 'talking_active',
      expression: 'talking',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
      timing: Array(24).fill(100),
      loop: true,
      priority: 5,
      exitCondition: { type: 'event', value: 'speech_complete' }
    },

    // Thinking/calculating
    processing_think: {
      cycleId: 'processing_think',
      expression: 'processing',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      timing: Array(12).fill(200),
      loop: true,
      priority: 3,
      exitCondition: { type: 'time', value: 3000 }
    },

    // Notice player input
    alert_pulse: {
      cycleId: 'alert_pulse',
      expression: 'alert',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      timing: Array(10).fill(150),
      loop: false,
      priority: 4
    },

    // Positive feedback
    happy_response: {
      cycleId: 'happy_response',
      expression: 'happy',
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      timing: Array(8).fill(500),
      loop: false,
      priority: 3
    },

    // Warning state
    warning_flash: {
      cycleId: 'warning_flash',
      expression: 'warning',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      timing: Array(10).fill(300),
      loop: true,
      priority: 6
    },

    // Error state
    error_critical: {
      cycleId: 'error_critical',
      expression: 'error',
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      timing: Array(16).fill(200),
      loop: true,
      priority: 7
    },

    // Sleep/idle for extended periods
    sleep_dormant: {
      cycleId: 'sleep_dormant',
      expression: 'sleep',
      frames: [0, 1, 2, 3, 4, 5],
      timing: Array(6).fill(1000),
      loop: true,
      priority: 0
    },

    // Shocked/unexpected
    shocked_reaction: {
      cycleId: 'shocked_reaction',
      expression: 'shocked',
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      timing: Array(8).fill(150),
      loop: false,
      priority: 5
    }
  };

  /**
   * LED glow states for the interior triangle
   */
  var GLOW_STATES = {
    idle: {
      primaryColor: '#00FF88',
      secondaryColor: '#00CC66',
      pulseSpeed: 4000
    },
    processing: {
      primaryColor: '#00FFCC',
      secondaryColor: '#00AA88',
      pulseSpeed: 2000
    },
    talking: {
      primaryColor: '#00FF88',
      secondaryColor: '#88FFCC',
      pulseSpeed: 500
    },
    warning: {
      primaryColor: '#FFCC00',
      secondaryColor: '#FF8800',
      pulseSpeed: 1000
    },
    error: {
      primaryColor: '#FF4444',
      secondaryColor: '#CC0000',
      pulseSpeed: 300
    },
    sleep: {
      primaryColor: '#4466FF',
      secondaryColor: '#223388',
      pulseSpeed: 8000
    }
  };

  /**
   * Get animation cycle by ID
   */
  function getCycle(cycleId) {
    return CYCLES[cycleId] || CYCLES.idle_breathe;
  }

  /**
   * Get glow state by expression
   */
  function getGlowState(expression) {
    return GLOW_STATES[expression] || GLOW_STATES.idle;
  }

  /**
   * Get all available cycles
   */
  function getAllCycles() {
    return Object.keys(CYCLES).map(function(key) {
      return CYCLES[key];
    });
  }

  // Public API
  return {
    getCycle: getCycle,
    getGlowState: getGlowState,
    getAllCycles: getAllCycles,
    CYCLES: CYCLES,
    GLOW_STATES: GLOW_STATES
  };
})();
