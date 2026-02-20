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
  var batchQueue = [];
  var batchStopConditions = null;
  var batchGuardState = null;
  var batchActionsExecuted = 0;
  var lastUtilityAlignment = null;

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
    clearBatch();

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

    clearBatch();

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

  function snapshotForStop(state) {
    if (!state || !state.player) return null;
    return {
      hp: state.player.hp,
      enemies: Array.isArray(state.enemies) ? state.enemies.length : 0,
      items: (Array.isArray(state.items) ? state.items.length : 0) + (Array.isArray(state.currencies) ? state.currencies.length : 0),
      floor: state.floor,
      turn: state.turn
    };
  }

  function normalizeStopConditions(stop, fallbackMax) {
    stop = stop || {};
    return {
      onEnemy: stop.onEnemy !== undefined ? !!stop.onEnemy : true,
      onDamage: stop.onDamage !== undefined ? !!stop.onDamage : true,
      onNewItem: stop.onNewItem !== undefined ? !!stop.onNewItem : false,
      onExit: stop.onExit !== undefined ? !!stop.onExit : false,
      maxActions: typeof stop.maxActions === 'number' && stop.maxActions > 0 ? stop.maxActions : fallbackMax
    };
  }

  function clearBatch() {
    batchQueue = [];
    batchStopConditions = null;
    batchGuardState = null;
    batchActionsExecuted = 0;
  }

  function shouldStopBatch(state, legalActions) {
    if (!batchStopConditions || !batchGuardState || !state) return false;
    var stop = batchStopConditions;
    if (stop.onDamage && state.player && state.player.hp < batchGuardState.hp) return true;

    var enemyCount = Array.isArray(state.enemies) ? state.enemies.length : 0;
    if (stop.onEnemy && enemyCount > batchGuardState.enemies) return true;

    var itemCount = (Array.isArray(state.items) ? state.items.length : 0) + (Array.isArray(state.currencies) ? state.currencies.length : 0);
    if (stop.onNewItem && itemCount > batchGuardState.items) return true;

    if (stop.onExit && Array.isArray(legalActions) && legalActions.some(function(a) { return a && a.type === 'exit'; })) {
      return true;
    }

    if (stop.maxActions && batchActionsExecuted >= stop.maxActions) {
      return true;
    }

    return false;
  }

  function deriveUtilityFrame(state) {
    var hp = state && state.player ? state.player.hp : 0;
    var maxHp = state && state.player ? (state.player.maxHp || 1) : 1;
    var hpPct = maxHp ? hp / maxHp : 0;
    var enemyCount = state && Array.isArray(state.enemies) ? state.enemies.length : 0;
    var currency = state && state.player ? (state.player.credits || 0) : 0;
    var alignment = 'progression';
    var rationale = 'Default: moving toward exit';

    if (hpPct < 0.4 || enemyCount > 0) {
      alignment = 'survival';
      rationale = 'Low HP or active threats';
    } else if (currency < 10 && enemyCount === 0) {
      alignment = 'resources';
      rationale = 'Safe corridor, building economy';
    }

    return { axis: alignment, rationale: rationale };
  }

  function computeSpatialPerception(state) {
    var width = state && state.gridWidth ? state.gridWidth : 0;
    var height = state && state.gridHeight ? state.gridHeight : 0;
    var walkable = 0;
    var obstacles = Array.isArray(state.breakables) ? state.breakables.length : 0;
    var enemies = Array.isArray(state.enemies) ? state.enemies.length : 0;
    var items = (Array.isArray(state.items) ? state.items.length : 0) + (Array.isArray(state.currencies) ? state.currencies.length : 0);

    if (state && Array.isArray(state.grid)) {
      for (var y = 0; y < state.grid.length; y++) {
        var row = state.grid[y] || [];
        for (var x = 0; x < row.length; x++) {
          if (row[x] !== null && row[x] !== undefined && row[x] !== 1 && row[x] !== 'WALL') {
            walkable++;
          }
        }
      }
    } else if (width && height) {
      walkable = width * height;
    }

    var density = (width && height) ? ((obstacles + enemies) / (width * height)) : 0;
    var pathAssessment = 'clear';
    if (enemies > 0) pathAssessment = 'contested';
    else if (density > 0.12) pathAssessment = 'blocked';
    else if (density > 0.05) pathAssessment = 'moderate';

    var corridorComplexity = Math.max(0, Math.min(10, Math.round(density * 40)));

    return {
      visibleRadius: 5,
      tileCounts: {
        walkable: walkable,
        obstacles: obstacles,
        enemies: enemies,
        items: items
      },
      pathAssessment: pathAssessment,
      corridorComplexity: corridorComplexity
    };
  }

  function computeThreatPerception(state) {
    var enemies = Array.isArray(state && state.enemies) ? state.enemies : [];
    var player = state && state.player ? state.player : { x: 0, y: 0 };
    var nearest = null;

    enemies.forEach(function(e) {
      var dist = Math.abs((e.x || 0) - player.x) + Math.abs((e.y || 0) - player.y);
      if (!nearest || dist < nearest.distance) {
        nearest = { type: e.type, tier: e.tier, distance: dist, intent: e.awarenessState || 'unknown' };
      }
    });

    return {
      count: enemies.length,
      nearest: nearest,
      alertLevel: state && state.alertLevel !== undefined ? state.alertLevel : 'unknown'
    };
  }

  function buildPerceptionSummary(state, legalActions) {
    var spatial = computeSpatialPerception(state || {});
    var utility = deriveUtilityFrame(state || {});
    return {
      spatial: spatial,
      inventory: {
        keys: state && state.player && typeof state.player.keys === 'number' ? state.player.keys : 0,
        currency: state && state.player ? (state.player.credits || 0) : 0,
        cardsInHand: state && state.player && Array.isArray(state.player.deck) ? state.player.deck.length : 0,
        activeEffects: (state && state.statusEffects) || (state && state.player && state.player.statusEffects) || [],
        equipmentState: state && state.player && state.player.activeItem ? { activeItem: state.player.activeItem } : {}
      },
      threats: computeThreatPerception(state || {}),
      temporal: {
        floor: state && state.floor,
        turn: state && state.turn,
        bossFloor: !!(state && state.bossFloorActive),
        strCombat: !!(state && state.strCombatActive)
      },
      legalActions: (legalActions || []).map(function (a) {
        var out = { type: a.type };
        if (a.direction) out.direction = a.direction;
        if (typeof a.dx === 'number') out.dx = a.dx;
        if (typeof a.dy === 'number') out.dy = a.dy;
        if (typeof a.cardIndex === 'number') out.cardIndex = a.cardIndex;
        if (typeof a.itemId !== 'undefined') out.itemId = a.itemId;
        if (typeof a.targetX === 'number' && typeof a.targetY === 'number') {
          out.targetX = a.targetX;
          out.targetY = a.targetY;
        }
        return out;
      }),
      utilityFrame: utility
    };
  }

  function suggestBatchSize(state, legalActions) {
    var enemies = Array.isArray(state && state.enemies) ? state.enemies.length : 0;
    var exitAvailable = Array.isArray(legalActions) && legalActions.some(function (a) { return a.type === 'exit'; });
    if (enemies > 0) return 2;
    if (exitAvailable) return 3;
    return 4;
  }

  function buildTurnEnvelope(state, legalActions) {
    return {
      envelopeId: 'env-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
      turnNumber: state && typeof state.turn === 'number' ? state.turn : 0,
      timestamp: Date.now(),
      perception: buildPerceptionSummary(state || {}, legalActions || []),
      utilityFrame: deriveUtilityFrame(state || {}),
      execution: {
        legalActions: (legalActions || []).map(function (a) {
          var out = { type: a.type };
          if (a.direction) out.direction = a.direction;
          if (typeof a.dx === 'number') out.dx = a.dx;
          if (typeof a.dy === 'number') out.dy = a.dy;
          if (typeof a.cardIndex === 'number') out.cardIndex = a.cardIndex;
          if (typeof a.itemId !== 'undefined') out.itemId = a.itemId;
          if (typeof a.targetX === 'number' && typeof a.targetY === 'number') {
            out.targetX = a.targetX;
            out.targetY = a.targetY;
          }
          return out;
        }),
        suggestedBatchSize: suggestBatchSize(state, legalActions)
      }
    };
  }

  function matchAgentAction(agentAction, legalActions) {
    if (!agentAction || !Array.isArray(legalActions)) return null;
    for (var i = 0; i < legalActions.length; i++) {
      var a = legalActions[i];
      if (!a || a.type !== agentAction.type) continue;
      if (agentAction.direction && a.direction !== agentAction.direction) continue;
      if (typeof agentAction.dx === 'number' && a.dx !== agentAction.dx) continue;
      if (typeof agentAction.dy === 'number' && a.dy !== agentAction.dy) continue;
      if (typeof agentAction.cardIndex === 'number' && a.cardIndex !== agentAction.cardIndex) continue;
      if (typeof agentAction.targetX === 'number' && a.targetX !== agentAction.targetX) continue;
      if (typeof agentAction.targetY === 'number' && a.targetY !== agentAction.targetY) continue;
      return a;
    }
    return null;
  }

  function normalizeBatchActions(agentActions, legalActions) {
    var batch = [];
    if (!Array.isArray(agentActions)) return batch;
    agentActions.forEach(function (act) {
      var matched = matchAgentAction(act, legalActions);
      if (matched) batch.push(matched);
    });
    return batch;
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

      var decision = null;
      var action = null;
      var fromBatch = false;
      var decisionCommentary = null;

      if (agentMode === 'kernel' && batchQueue.length > 0) {
        if (shouldStopBatch(state, actions)) {
          clearBatch();
        } else {
          action = batchQueue.shift();
          fromBatch = true;
        }
      }

      if (!action) {
        decision = agentMode === 'kernel'
          ? await chooseKernelActionAsync(actions, state)
          : { action: chooseAction(actions, state) };

        if (decision && decision.batch && decision.batch.length) {
          batchQueue = decision.batch.slice();
          batchStopConditions = normalizeStopConditions(decision.stopConditions || {}, decision.batch.length);
          batchGuardState = snapshotForStop(state);
          batchActionsExecuted = 0;
          if (decision.alignment) {
            lastUtilityAlignment = decision.alignment;
            if (!decisionCommentary) decisionCommentary = 'Alignment: ' + decision.alignment;
          }
          if (decision.commentary) decisionCommentary = decision.commentary;
          action = batchQueue.shift();
          fromBatch = true;
        } else {
          decisionCommentary = decision ? decision.commentary : null;
          action = decision ? decision.action : null;
        }
      }

      if (!action) {
        log('No valid action chosen, stopping');
        stopAgentTakeover();
        return;
      }

      if (agentMode === 'kernel' && decisionCommentary) {
        updateMOK('[KERNEL]: ' + decisionCommentary);
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

      if (fromBatch) {
        batchActionsExecuted++;
        var postState = (result && result.state) ? result.state : adapter.getState();
        if (batchQueue.length === 0 || shouldStopBatch(postState || state, adapter.getLegalActions())) {
          clearBatch();
        } else {
          batchGuardState = snapshotForStop(postState || state);
        }
      } else {
        clearBatch();
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

  async function requestTurnEnvelope(actions, state) {
    var payload = {
      protocol_version: 'kernel-turn-envelope-v1',
      session: {
        username: (typeof UserAccount !== 'undefined' && UserAccount.getCurrentUser) ? (UserAccount.getCurrentUser() || {}).username : null,
        callsign: (typeof UserAccount !== 'undefined' && UserAccount.getCurrentUser) ? (UserAccount.getCurrentUser() || {}).callsign : null,
        agent_name: kernelAgentName || 'KernelAgent',
        run_id: currentReport ? (currentReport.runId || null) : null,
        tick: currentReport ? (currentReport.actionsExecuted || 0) : 0
      },
      envelope: buildTurnEnvelope(state, actions)
    };

    var controller = new AbortController();
    var t = setTimeout(function () { controller.abort(); }, 5000);

    try {
      var res = await fetch(kernelAgentUrl.replace(/\/$/, '') + '/turn_envelope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(t);

      if (!res.ok) return null;

      var data = await res.json().catch(function () { return null; });
      if (!data) return null;

      var rawActions = (data.execution && data.execution.actions) || data.actions;
      var batch = normalizeBatchActions(rawActions, actions);
      if (!batch.length) return null;

      return {
        batch: batch,
        stopConditions: normalizeStopConditions((data.execution && data.execution.stop) || data.stop || {}, (data.execution && data.execution.maxActions) || batch.length),
        alignment: (data.utility && data.utility.axis) || data.alignment || null,
        commentary: data.commentary || (data.utility && data.utility.rationale) || null
      };
    } catch (e) {
      clearTimeout(t);
      return null;
    }
  }

  async function requestLegacyKernelAction(actions, state) {
    var obs = {
      floor: state.floor,
      hp: state.player ? state.player.hp : null,
      position: state.player ? { x: state.player.x, y: state.player.y } : null,
      legal_actions: actions.map(function (a) {
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

    var controller = new AbortController();
    var t = setTimeout(function () { controller.abort(); }, 5000);

    try {
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
      var chosen = data && data.action ? matchAgentAction(data.action, actions) : null;

      return {
        action: chosen || actions.find(function (a) { return a.type === 'wait'; }) || actions[0],
        commentary: data && typeof data.commentary === 'string' ? data.commentary : null
      };
    } catch (e) {
      clearTimeout(t);
      return {
        action: actions.find(function (a) { return a.type === 'wait'; }) || actions[0],
        commentary: null
      };
    }
  }

  /**
   * Kernel mode: external decision API chooses from legal actions.
   */
  async function chooseKernelActionAsync(actions, state) {
    if (!kernelAgentUrl) {
      return { action: actions.find(a => a.type === 'wait') || actions[0] };
    }

    var envelopeDecision = await requestTurnEnvelope(actions, state);
    if (envelopeDecision) {
      return envelopeDecision;
    }

    return requestLegacyKernelAction(actions, state);
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
