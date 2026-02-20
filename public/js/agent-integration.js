/* ============================================================
   EYES ONLY - Agent Integration with UI
   Bridges agent testing system with actual Gone Rogue gameplay
   Supports both natural MOK-controlled play and developer mode
   ============================================================ */

const AgentIntegration = (function() {
  'use strict';

  // Agent state
  var agentActive = false;
  var agentMode = 'natural'; // 'natural' or 'developer'
  var adapter = null;
  var currentReport = null;
  var actionTimer = null;
  var isPaused = false;

  // Agent configuration
  var CONFIG = {
    natural: {
      minActionDelay: 200,     // Slower, more human-like
      maxActionDelay: 500,
      enableJitter: true,
      showTooltips: true,
      showCommentary: true,
      exploreThresholdPercent: 70  // Explore 70% of map
    },
    developer: {
      minActionDelay: 50,      // Fast testing
      maxActionDelay: 100,
      enableJitter: false,
      showTooltips: false,
      showCommentary: false,
      exploreThresholdPercent: 0  // Skip exploration, go to exit
    },
    kernel: {
      // External decision API (Kernel)
      minActionDelay: 200,
      maxActionDelay: 500,
      enableJitter: true,
      showTooltips: true,
      showCommentary: true,
      exploreThresholdPercent: 70
    }
  };

  // External agent (kernel decision API)
  var kernelAgentUrl = null;
  var kernelAgentName = null;

  /**
   * Initialize agent system
   */
  function init() {
    log('Agent integration system initialized');
  }

  /**
   * Start built-in agent takeover (called from UI or terminal)
   */
  function startAgentTakeover(mode = 'natural') {
    if (agentActive) {
      updateMOK('⚠️ Agent already active');
      return false;
    }

    // Check if Gone Rogue is active
    if (typeof GoneRogue === 'undefined' || !GoneRogue.isActive()) {
      updateMOK('❌ Must be in Gone Rogue mode to start agent');
      return false;
    }

    // Check if headless adapter is available
    if (typeof HeadlessAdapter === 'undefined') {
      updateMOK('❌ HeadlessAdapter not loaded');
      return false;
    }

    agentMode = mode;
    agentActive = true;
    isPaused = false;

    // Initialize adapter with mode-specific config
    var config = CONFIG[mode];
    adapter = new HeadlessAdapter.HeadlessGameAdapter({
      minActionDelay: config.minActionDelay,
      enableJitter: config.enableJitter,
      strictPathBinding: true,
      verbose: false
    });

    // Initialize with current GoneRogue instance
    adapter.init(GoneRogue);

    // Start agent loop
    currentReport = initializeReport(mode);

    var modeLabel = (mode === 'natural') ? 'MOK AGENT' :
                    (mode === 'developer') ? 'DEVELOPER AGENT' :
                    'KERNEL AGENT';
    updateMOK(`🤖 ${modeLabel} ACTIVATED`, true);

    if (mode === 'natural') {
      updateMOK('[MOK]: "Taking control. Proceeding with standard protocol."');
    } else if (mode === 'developer') {
      updateMOK('[DEV]: Fast testing mode enabled');
    } else {
      updateMOK('[KERNEL]: External decision API connected');
    }

    // Start agent action loop
    setTimeout(() => {
      agentLoop();
    }, 1000);

    return true;
  }

  /**
   * Start Kernel external decision agent takeover.
   * @param {{agentUrl:string, agentName?:string}} opts
   */
  function startKernelDecisionTakeover(opts) {
    opts = opts || {};
    kernelAgentUrl = opts.agentUrl || null;
    kernelAgentName = opts.agentName || null;

    if (!kernelAgentUrl) {
      updateMOK('❌ Kernel agent URL not set');
      return false;
    }

    return startAgentTakeover('kernel');
  }

  /**
   * Start Kernel decision takeover (external agent by URL)
   * @param {{agentUrl:string, agentName?:string}} options
   */
  function startKernelDecisionTakeover(options) {
    if (!options || !options.agentUrl) {
      updateMOK('❌ Kernel agent URL required');
      return false;
    }
    kernelAgentUrl = String(options.agentUrl || '').replace(/\/$/, '');
    kernelAgentName = options.agentName ? String(options.agentName) : 'KernelAgent';
    return startAgentTakeover('kernel');
  }

  /**
   * Stop agent takeover
   */
  function stopAgentTakeover() {
    if (!agentActive) {
      return;
    }

    agentActive = false;
    isPaused = false;

    if (actionTimer) {
      clearTimeout(actionTimer);
      actionTimer = null;
    }

    updateMOK('🛑 Agent control released', true);

    // Generate final report
    if (currentReport) {
      generateFinalReport();
    }

    adapter = null;
    currentReport = null;
  }

  /**
   * Pause/resume agent
   */
  function togglePause() {
    if (!agentActive) return;

    isPaused = !isPaused;
    updateMOK(isPaused ? '⏸️  Agent paused' : '▶️  Agent resumed');
  }

  /**
   * Main agent decision loop
   */
  async function agentLoop() {
    if (!agentActive) {
      return;
    }

    if (isPaused) {
      // Check again in 500ms if paused
      actionTimer = setTimeout(agentLoop, 500);
      return;
    }

    try {
      // Get current state
      var state = adapter.getState();

      if (!state || !state.active) {
        log('Game no longer active, stopping agent');
        stopAgentTakeover();
        return;
      }

      // Check if player died
      if (state.player.hp <= 0) {
        updateMOK('💀 Player defeated. Ending agent run.');
        currentReport.outcome = 'died';
        currentReport.finalFloor = state.floor;
        stopAgentTakeover();
        return;
      }

      // Get legal actions
      var actions = adapter.getLegalActions();

      if (actions.length === 0) {
        updateMOK('⚠️ No legal actions available');
        currentReport.stuckSituations++;
        stopAgentTakeover();
        return;
      }

      // Choose action based on mode
      var action = null;
      if (agentMode === 'kernel') {
        action = await chooseKernelActionAsync(actions, state);
      } else {
        action = chooseAction(actions, state);
      }

      if (!action) {
        log('No valid action chosen, stopping');
        stopAgentTakeover();
        return;
      }

      // Show action via MOK interjection (natural/kernel mode only)
      if ((agentMode === 'natural' || agentMode === 'kernel') && CONFIG[agentMode].showCommentary) {
        announceAction(action, state);
      }

      // Execute action
      var result = await adapter.applyAction(action);

      if (!result.success) {
        log('Action failed: ' + result.reason);
        currentReport.failedActions++;
      } else {
        // Track action in report
        currentReport.actionsExecuted++;
        trackActionMetrics(action, state, result);
      }

      // Check if reached exit
      if (action.type === 'exit') {
        currentReport.floorsCompleted++;
        updateMOK(`✓ Floor ${state.floor} complete!`);
      }

      // Get delay for next action
      var config = CONFIG[agentMode];
      var delay = config.minActionDelay +
                  Math.random() * (config.maxActionDelay - config.minActionDelay);

      // Schedule next action
      actionTimer = setTimeout(agentLoop, delay);

    } catch (error) {
      log('Error in agent loop: ' + error.message);
      updateMOK('❌ Agent error: ' + error.message);
      stopAgentTakeover();
    }
  }

  /**
   * Choose action based on mode and state
   */
  function chooseAction(actions, state) {
    if (agentMode === 'developer') {
      return chooseDeveloperAction(actions, state);
    } else {
      return chooseNaturalAction(actions, state);
    }
  }

  /**
   * Kernel mode: external decision API chooses from legal actions.
   */
  async function chooseKernelActionAsync(actions, state) {
    if (!kernelAgentUrl) {
      return actions.find(a => a.type === 'wait') || actions[0];
    }

    // Build minimal observation payload (do not leak more than needed)
    var obs = {
      floor: state.floor,
      hp: state.player ? state.player.hp : null,
      position: state.player ? { x: state.player.x, y: state.player.y } : null,
      legal_actions: actions.map(function (a) {
        // Keep action objects small and serializable
        var out = { type: a.type };
        if (a.direction) out.direction = a.direction;
        if (typeof a.dx === 'number') out.dx = a.dx;
        if (typeof a.dy === 'number') out.dy = a.dy;
        if (typeof a.cardIndex === 'number') out.cardIndex = a.cardIndex;
        if (typeof a.itemId !== 'undefined') out.itemId = a.itemId;
        return out;
      }),
      ux_hints: {
        lighting: state.lightingLevel || 'unknown',
        ground_effect: state.groundEffect || 'unknown'
      }
    };

    var payload = {
      protocol_version: 'kernel-decision-v1',
      session: {
        username: (typeof UserAccount !== 'undefined' && UserAccount.getCurrentUser) ? (UserAccount.getCurrentUser() || {}).username : null,
        callsign: (typeof UserAccount !== 'undefined' && UserAccount.getCurrentUser) ? (UserAccount.getCurrentUser() || {}).callsign : null,
        agent_name: kernelAgentName || 'KernelAgent',
        run_id: currentReport ? (currentReport.runId || null) : null,
        tick: currentReport ? (currentReport.actionsExecuted || 0) : 0
      },
      observation: obs
    };

    try {
      var controller = new AbortController();
      var t = setTimeout(function () { controller.abort(); }, 5000);
      var res = await fetch(kernelAgentUrl.replace(/\/$/, '') + '/next_action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(t);

      if (!res.ok) {
        throw new Error('agent http ' + res.status);
      }

      var data = await res.json().catch(function () { return null; });
      if (!data || !data.action) {
        return actions.find(a => a.type === 'wait') || actions[0];
      }

      // Find a matching legal action
      var chosen = null;
      for (var i = 0; i < actions.length; i++) {
        var a = actions[i];
        if (a.type !== data.action.type) continue;
        if (data.action.direction && a.direction !== data.action.direction) continue;
        if (typeof data.action.dx === 'number' && a.dx !== data.action.dx) continue;
        if (typeof data.action.dy === 'number' && a.dy !== data.action.dy) continue;
        if (typeof data.action.cardIndex === 'number' && a.cardIndex !== data.action.cardIndex) continue;
        chosen = a;
        break;
      }

      if (!chosen) {
        return actions.find(a => a.type === 'wait') || actions[0];
      }

      if (data.commentary && typeof data.commentary === 'string') {
        updateMOK('[KERNEL]: ' + data.commentary);
      }

      return chosen;

    } catch (e) {
      updateMOK('⚠️ Kernel agent error: ' + (e && e.message ? e.message : 'unknown'));
      return actions.find(a => a.type === 'wait') || actions[0];
    }
  }

  /**
   * Developer mode: optimal, efficient actions
   */
  function chooseDeveloperAction(actions, state) {
    // Priority 1: Take exit if available
    var exitAction = actions.find(a => a.type === 'exit');
    if (exitAction) {
      return exitAction;
    }

    // Priority 2: Pickup currency
    var pickupCurrency = actions.find(a => a.type === 'pickupCurrency');
    if (pickupCurrency) {
      return pickupCurrency;
    }

    // Priority 3: Move toward exit (simple heuristic: up and right)
    var moveActions = actions.filter(a => a.type === 'move');
    if (moveActions.length > 0) {
      // Prefer north or east
      var preferred = moveActions.find(a => a.direction === 'north' || a.direction === 'east');
      if (preferred) return preferred;

      // Otherwise any move
      return moveActions[Math.floor(Math.random() * moveActions.length)];
    }

    // Priority 4: Wait
    var waitAction = actions.find(a => a.type === 'wait');
    if (waitAction) {
      return waitAction;
    }

    return actions[0];
  }

  /**
   * Natural mode: human-like, exploratory actions
   */
  function chooseNaturalAction(actions, state) {
    // During STR combat, use cards
    if (state.strCombatActive) {
      var cardAction = actions.find(a => a.type === 'useCard');
      if (cardAction) {
        return cardAction;
      }

      // Flee if low HP
      if (state.player.hp < state.player.maxHp * 0.3) {
        var fleeAction = actions.find(a => a.type === 'flee');
        if (fleeAction) {
          return fleeAction;
        }
      }
    }

    // Pick up items and currency
    var pickup = actions.find(a => a.type === 'pickup' || a.type === 'pickupCurrency');
    if (pickup) {
      return pickup;
    }

    // Use active item occasionally
    if (state.player.activeItem && Math.random() < 0.1) {
      var useItem = actions.find(a => a.type === 'useActiveItem');
      if (useItem) {
        return useItem;
      }
    }

    // Take exit if explored enough
    var exploredPercent = currentReport.tilesVisited / (state.gridWidth * state.gridHeight) * 100;
    if (exploredPercent > CONFIG.natural.exploreThresholdPercent) {
      var exitAction = actions.find(a => a.type === 'exit');
      if (exitAction) {
        return exitAction;
      }
    }

    // Move to explore (somewhat random but track visited tiles)
    var moveActions = actions.filter(a => a.type === 'move');
    if (moveActions.length > 0) {
      // Prefer unvisited tiles
      var unvisited = moveActions.filter(a => {
        var key = a.targetX + ',' + a.targetY;
        return !currentReport.visitedTiles[key];
      });

      if (unvisited.length > 0) {
        return unvisited[Math.floor(Math.random() * unvisited.length)];
      }

      // Otherwise any move
      return moveActions[Math.floor(Math.random() * moveActions.length)];
    }

    // Wait as fallback
    var waitAction = actions.find(a => a.type === 'wait');
    if (waitAction) {
      return waitAction;
    }

    return actions[0];
  }

  /**
   * Announce action via MOK interjection
   */
  function announceAction(action, state) {
    var message = '';

    switch (action.type) {
      case 'move':
        message = `🥾 Moving ${action.direction}`;
        break;
      case 'useCard':
        message = `🃏 Using card ${action.cardIndex + 1}`;
        break;
      case 'flee':
        message = '🏃 Fleeing combat';
        break;
      case 'pickup':
        message = '📦 Picking up item';
        break;
      case 'pickupCurrency':
        message = `💰 Collecting ${action.amount} credits`;
        break;
      case 'exit':
        message = '🚪 Taking exit';
        break;
      case 'useActiveItem':
        message = '⚡ Using active item';
        break;
      case 'wait':
        message = '⏳ Waiting';
        break;
      default:
        message = `🤖 Action: ${action.type}`;
    }

    updateMOK(message);
  }

  /**
   * Track action metrics for report
   */
  function trackActionMetrics(action, state, result) {
    // Track visited tiles
    var key = state.player.x + ',' + state.player.y;
    if (!currentReport.visitedTiles[key]) {
      currentReport.visitedTiles[key] = true;
      currentReport.tilesVisited++;
    }

    // Track by action type
    if (!currentReport.actionsByType[action.type]) {
      currentReport.actionsByType[action.type] = 0;
    }
    currentReport.actionsByType[action.type]++;

    // Track combat
    if (action.type === 'useCard' || action.type === 'flee') {
      currentReport.combatActions++;
    }

    // Track exploration
    if (action.type === 'move') {
      currentReport.moveActions++;
    }
  }

  /**
   * Initialize report structure
   */
  function initializeReport(mode) {
    return {
      mode: mode,
      startTime: Date.now(),
      endTime: null,
      outcome: 'in_progress',
      finalFloor: 0,
      actionsExecuted: 0,
      failedActions: 0,
      floorsCompleted: 0,
      combatActions: 0,
      moveActions: 0,
      stuckSituations: 0,
      actionsByType: {},
      visitedTiles: {},
      tilesVisited: 0,
      mvpMetrics: {
        lightingUtility: 0,
        groundEffectsUtility: 0,
        combatBalance: 0,
        pathfindingQuality: 100
      }
    };
  }

  /**
   * Generate final MVP report
   */
  function generateFinalReport() {
    if (!currentReport) return;

    currentReport.endTime = Date.now();
    var duration = (currentReport.endTime - currentReport.startTime) / 1000;

    var reportLines = [
      '',
      '═══════════════════════════════════════════',
      '       MVP AUDIT REPORT - ' + (agentMode === 'natural' ? 'NATURAL PLAY' : 'DEVELOPER MODE'),
      '═══════════════════════════════════════════',
      '',
      'OUTCOME: ' + currentReport.outcome.toUpperCase(),
      'DURATION: ' + duration.toFixed(1) + 's',
      'FLOORS COMPLETED: ' + currentReport.floorsCompleted,
      'ACTIONS EXECUTED: ' + currentReport.actionsExecuted,
      'FAILED ACTIONS: ' + currentReport.failedActions,
      '',
      'ACTION BREAKDOWN:',
    ];

    Object.keys(currentReport.actionsByType).forEach(function(type) {
      reportLines.push('  ' + type + ': ' + currentReport.actionsByType[type]);
    });

    reportLines.push('');
    reportLines.push('EXPLORATION:');
    reportLines.push('  Tiles Visited: ' + currentReport.tilesVisited);
    reportLines.push('  Move Actions: ' + currentReport.moveActions);
    reportLines.push('  Combat Actions: ' + currentReport.combatActions);
    reportLines.push('  Stuck Situations: ' + currentReport.stuckSituations);

    reportLines.push('');
    reportLines.push('MVP METRICS:');
    reportLines.push('  Lighting Utility: ' + currentReport.mvpMetrics.lightingUtility.toFixed(1) + '%');
    reportLines.push('  Ground Effects Utility: ' + currentReport.mvpMetrics.groundEffectsUtility.toFixed(1) + '%');
    reportLines.push('  Combat Balance: ' + currentReport.mvpMetrics.combatBalance.toFixed(1) + '%');
    reportLines.push('  Pathfinding Quality: ' + currentReport.mvpMetrics.pathfindingQuality.toFixed(1) + '%');

    reportLines.push('');
    reportLines.push('═══════════════════════════════════════════');
    reportLines.push('');

    // Print to terminal
    if (typeof UIControls !== 'undefined' && typeof UIControls.printToTerminal === 'function') {
      UIControls.printToTerminal(reportLines);
    } else {
      console.log(reportLines.join('\n'));
    }

    // Also show summary in MOK
    updateMOK(`📊 Report generated: ${currentReport.outcome}`, true);
  }

  /**
   * Update MOK interjection field
   */
  function updateMOK(message, persistent = false) {
    if (typeof TooltipSystem !== 'undefined') {
      if (persistent) {
        TooltipSystem.showPersistent(message);
      } else {
        TooltipSystem.show(message, 2000);
      }
    }

    log('[MOK] ' + message);
  }

  /**
   * Set MOK expression (API hook for agents)
   * @param {string} expression - Expression name (idle, talking, warning, happy, error, etc.)
   * @param {Object} options - Optional color and timing overrides
   */
  function setMOKExpression(expression, options) {
    if (typeof DebriefFeedController === 'undefined' || !DebriefFeedController.setMOKExpression) {
      return;
    }

    DebriefFeedController.setMOKExpression(expression, options);
  }

  /**
   * Logging helper
   */
  function log(message) {
    console.log('[AgentIntegration] ' + message);
  }

  /**
   * Check if agent is active
   */
  function isActive() {
    return agentActive;
  }

  /**
   * Get current mode
   */
  function getMode() {
    return agentMode;
  }

  /**
   * Get current report
   */
  function getReport() {
    return currentReport;
  }

  // Public API
  return {
    init: init,
    startAgentTakeover: startAgentTakeover,
    startKernelDecisionTakeover: startKernelDecisionTakeover,
    stopAgentTakeover: stopAgentTakeover,
    togglePause: togglePause,
    isActive: isActive,
    getMode: getMode,
    getReport: getReport,
    setMOKExpression: setMOKExpression
  };
})();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    AgentIntegration.init();
  });
} else {
  AgentIntegration.init();
}
