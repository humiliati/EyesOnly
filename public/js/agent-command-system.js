/**
 * AgentCommandSystem — handles AGENT subcommands (natural, developer, stop, pause, report, mode).
 * Extracted Phase 15 from gone-rogue.js.
 * Stateless IIFE module — delegates to AgentIntegration global.
 */
var AgentCommandSystem = (function() {
  'use strict';

  /**
   * Handle an agent command string.
   * @param {string} cmd - The full command string (e.g. "agent natural")
   * @param {Object} ctx - Context with getPrompt callback
   * @returns {Object} { lines, prompt, stayActive }
   */
  function handleAgentCommand(cmd, ctx) {
    if (typeof AgentIntegration === 'undefined') {
      return {
        lines: [
          '',
          'AGENT SYSTEM NOT AVAILABLE',
          'Required modules not loaded',
          ''
        ],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var parts = cmd.split(' ');
    var subCommand = parts[1] ? parts[1].toLowerCase() : '';

    if (subCommand === 'natural') {
      return _startNatural(ctx);
    } else if (subCommand === 'developer' || subCommand === 'dev') {
      return _startDeveloper(ctx);
    } else if (subCommand === 'stop') {
      return _stop(ctx);
    } else if (subCommand === 'pause') {
      return _pause(ctx);
    } else if (subCommand === 'report') {
      return _report(ctx);
    } else if (subCommand === 'mode') {
      return _mode(ctx);
    } else {
      return _help(ctx);
    }
  }

  function _startNatural(ctx) {
    var started = AgentIntegration.startAgentTakeover('natural');
    if (started) {
      return {
        lines: [
          '',
          '\uD83E\uDD16 MOK AGENT ACTIVATED - NATURAL MODE',
          '',
          '[MOK]: "Control transferred. Beginning natural play protocol."',
          '[MOK]: "I will explore thoroughly and generate MVP report."',
          '',
          'The agent will now play for you.',
          'Watch the MOK interjection field for real-time updates.',
          '',
          'Type AGENT STOP to return control',
          ''
        ],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }
    return { lines: ['', 'Failed to start agent', ''], prompt: ctx.getPrompt(), stayActive: true };
  }

  function _startDeveloper(ctx) {
    var started = AgentIntegration.startAgentTakeover('developer');
    if (started) {
      return {
        lines: [
          '',
          '\uD83E\uDD16 DEVELOPER AGENT ACTIVATED - FAST MODE',
          '',
          '[DEV]: "Control transferred. Running optimal pathfinding."',
          '[DEV]: "This mode skips exploration for quick testing."',
          '',
          'The agent will now play for you.',
          'This mode is significantly faster than natural play.',
          '',
          'Type AGENT STOP to return control',
          ''
        ],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }
    return { lines: ['', 'Failed to start agent', ''], prompt: ctx.getPrompt(), stayActive: true };
  }

  function _stop(ctx) {
    AgentIntegration.stopAgentTakeover();
    return {
      lines: [
        '',
        '\uD83D\uDED1 AGENT CONTROL RELEASED',
        '',
        'Manual control restored.',
        'MVP report has been generated (check terminal).',
        ''
      ],
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  function _pause(ctx) {
    AgentIntegration.togglePause();
    var report = AgentIntegration.getReport();
    var status = report && report.outcome === 'in_progress' ? 'paused' : 'resumed';
    return {
      lines: [
        '',
        status === 'paused' ? '\u23F8\uFE0F  Agent paused' : '\u25B6\uFE0F  Agent resumed',
        ''
      ],
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  function _report(ctx) {
    var report = AgentIntegration.getReport();
    if (!report) {
      return { lines: ['', 'No agent report available', ''], prompt: ctx.getPrompt(), stayActive: true };
    }

    return {
      lines: [
        '',
        'CURRENT AGENT METRICS:',
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
        'Mode: ' + report.mode.toUpperCase(),
        'Status: ' + report.outcome.toUpperCase(),
        'Actions Executed: ' + report.actionsExecuted,
        'Floors Completed: ' + report.floorsCompleted,
        'Tiles Visited: ' + report.tilesVisited,
        'Failed Actions: ' + report.failedActions,
        ''
      ],
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  function _mode(ctx) {
    if (AgentIntegration.isActive()) {
      var mode = AgentIntegration.getMode();
      return {
        lines: [
          '',
          'AGENT MODE: ' + mode.toUpperCase(),
          '',
          mode === 'natural'
            ? 'Natural human-like play with thorough exploration'
            : 'Fast developer mode with optimal pathfinding',
          ''
        ],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }
    return { lines: ['', 'Agent not active', ''], prompt: ctx.getPrompt(), stayActive: true };
  }

  function _help(ctx) {
    return {
      lines: [
        '',
        'AGENT COMMANDS:',
        '  AGENT NATURAL   - Start natural play mode',
        '  AGENT DEVELOPER - Start fast testing mode',
        '  AGENT STOP      - Stop agent control',
        '  AGENT PAUSE     - Pause/resume agent',
        '  AGENT REPORT    - Show current metrics',
        '  AGENT MODE      - Show current mode',
        ''
      ],
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  return {
    handleAgentCommand: handleAgentCommand
  };
})();
