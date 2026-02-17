/* ============================================================
   EYES ONLY - Headless Adapter for Agent Testing
   Wraps GoneRogue headless API with human-like IO constraints
   ============================================================ */

const HeadlessAdapter = (function() {
  'use strict';

  /**
   * Headless Game Adapter
   * Provides human-like IO constraints and action validation
   */
  class HeadlessGameAdapter {
    constructor(options = {}) {
      this.options = {
        minActionDelay: options.minActionDelay || 50, // ms between actions
        enableJitter: options.enableJitter !== undefined ? options.enableJitter : true,
        strictPathBinding: options.strictPathBinding !== undefined ? options.strictPathBinding : true,
        verbose: options.verbose || false
      };

      this.lastActionTime = 0;
      this.actionHistory = [];
      this.stateHistory = [];
      this.gameInstance = null;
    }

    /**
     * Initialize adapter with Gone Rogue instance
     */
    init(GoneRogueInstance) {
      if (typeof GoneRogueInstance === 'undefined') {
        throw new Error('GoneRogue module not available');
      }

      if (!GoneRogueInstance.headless) {
        throw new Error('GoneRogue headless API not available');
      }

      this.gameInstance = GoneRogueInstance;
      this.log('Headless adapter initialized');
      return true;
    }

    /**
     * Start new game
     */
    startGame(options = {}) {
      if (!this.gameInstance) {
        throw new Error('Adapter not initialized');
      }

      // Start game through normal API
      var result = this.gameInstance.start(options);
      
      if (result && this.gameInstance.isActive()) {
        // Capture initial state
        var initialState = this.gameInstance.headless.getState();
        this.stateHistory.push({
          tick: 0,
          state: initialState,
          action: null
        });

        this.log('Game started - Floor ' + initialState.floor);
        return {
          success: true,
          state: initialState
        };
      }

      return {
        success: false,
        reason: 'Failed to start game'
      };
    }

    /**
     * Get current game state
     */
    getState() {
      if (!this.gameInstance || !this.gameInstance.isActive()) {
        return null;
      }

      return this.gameInstance.headless.getState();
    }

    /**
     * Get legal actions with human-like constraints
     */
    getLegalActions() {
      if (!this.gameInstance || !this.gameInstance.isActive()) {
        return [];
      }

      // Get raw legal actions from game
      var rawActions = this.gameInstance.headless.getLegalActions();

      // Apply human-like constraints
      var constrainedActions = rawActions.filter(action => {
        return this.isActionHumanLike(action);
      });

      return constrainedActions;
    }

    /**
     * Check if action follows human-like constraints
     */
    isActionHumanLike(action) {
      // All actions must be single primitive operations
      // No compound actions
      // No hidden API access
      
      if (!action || !action.type) return false;

      // Allowed action types (human can perform these)
      var allowedTypes = [
        'move',        // Tap to move
        'useCard',     // Swipe card
        'flee',        // Tap flee button
        'pickup',      // Tap pickup
        'pickupCurrency', // Auto on move
        'exit',        // Tap exit
        'useActiveItem', // Tap active item
        'wait'         // Tap wait/pass
      ];

      if (allowedTypes.indexOf(action.type) === -1) {
        return false;
      }

      // Movement must be to adjacent tile only (no teleportation)
      if (action.type === 'move' && this.options.strictPathBinding) {
        var state = this.getState();
        if (!state) return false;

        var distX = Math.abs(action.targetX - state.player.x);
        var distY = Math.abs(action.targetY - state.player.y);

        // Must be exactly 1 tile away (Manhattan distance = 1)
        if (distX + distY !== 1) {
          this.log('Action rejected: movement not adjacent');
          return false;
        }
      }

      return true;
    }

    /**
     * Apply action with timing constraints
     */
    async applyAction(action) {
      if (!this.gameInstance || !this.gameInstance.isActive()) {
        return {
          success: false,
          reason: 'Game not active'
        };
      }

      // Check timing constraint
      var now = Date.now();
      var timeSinceLastAction = now - this.lastActionTime;

      if (timeSinceLastAction < this.options.minActionDelay) {
        var waitTime = this.options.minActionDelay - timeSinceLastAction;
        
        // Wait for required delay
        await this.sleep(waitTime);
      }

      // Apply jitter if enabled (realistic human timing variation)
      if (this.options.enableJitter) {
        var jitter = Math.floor(Math.random() * 30); // 0-30ms jitter
        await this.sleep(jitter);
      }

      // Validate action is legal
      var legalActions = this.getLegalActions();
      var isLegal = legalActions.some(legal => 
        this.actionsEqual(legal, action)
      );

      if (!isLegal) {
        this.log('Action rejected: not in legal action set');
        return {
          success: false,
          reason: 'Illegal action',
          action: action
        };
      }

      // Capture state before action
      var stateBefore = this.getState();

      // Apply action through headless API
      var result = this.gameInstance.headless.applyAction(action);

      // Update last action time
      this.lastActionTime = Date.now();

      // Record action in history
      var stateAfter = result.state;
      this.actionHistory.push({
        tick: this.actionHistory.length,
        action: action,
        stateBefore: this.snapshotState(stateBefore),
        stateAfter: this.snapshotState(stateAfter),
        success: result.success,
        messages: result.messages
      });

      this.stateHistory.push({
        tick: this.stateHistory.length,
        state: stateAfter,
        action: action
      });

      if (result.success) {
        this.log('Action executed: ' + action.type);
      } else {
        this.log('Action failed: ' + result.reason);
      }

      return result;
    }

    /**
     * Compare two actions for equality
     */
    actionsEqual(a, b) {
      if (!a || !b) return false;
      if (a.type !== b.type) return false;

      // Type-specific comparison
      if (a.type === 'move') {
        return a.targetX === b.targetX && a.targetY === b.targetY;
      } else if (a.type === 'useCard') {
        return a.cardIndex === b.cardIndex;
      }

      // Default: same type is enough
      return true;
    }

    /**
     * Create lightweight state snapshot
     */
    snapshotState(state) {
      if (!state) return null;

      return {
        floor: state.floor,
        turn: state.turn,
        playerPos: { x: state.player.x, y: state.player.y },
        playerHP: state.player.hp,
        playerCredits: state.player.credits,
        enemyCount: state.enemies.length,
        strCombatActive: state.strCombatActive
      };
    }

    /**
     * Get grid data (for map parsing)
     */
    getGrid() {
      if (!this.gameInstance) {
        return null;
      }

      return this.gameInstance.headless.getGrid();
    }

    /**
     * Export action trace for replay
     */
    exportTrace() {
      return {
        metadata: {
          timestamp: new Date().toISOString(),
          totalActions: this.actionHistory.length,
          totalTicks: this.stateHistory.length
        },
        actionHistory: this.actionHistory,
        stateHistory: this.stateHistory.map(h => h.state)
      };
    }

    /**
     * Validate action trace (determinism check)
     */
    async validateTrace(trace, seed) {
      // TODO: Replay trace and verify states match
      // Requires seed support in GoneRogue
      this.log('Trace validation not yet implemented (needs seed support)');
      return {
        valid: false,
        reason: 'Seed support required for deterministic replay'
      };
    }

    /**
     * Reset to specific state
     */
    resetToState(state) {
      if (!this.gameInstance) {
        return false;
      }

      return this.gameInstance.headless.resetToState(state);
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Logging helper
     */
    log(message) {
      if (this.options.verbose) {
        console.log('[HeadlessAdapter] ' + message);
      }
    }
  }

  /**
   * Parse real game map into analysis-friendly format
   */
  class MapParser {
    static parseMap(gridData) {
      if (!gridData || !gridData.grid) {
        return null;
      }

      var analysis = {
        width: gridData.width,
        height: gridData.height,
        tiles: {
          walls: [],
          empty: [],
          cover: [],
          shadow: [],
          exits: [],
          special: []
        },
        walkableTiles: 0,
        coveragePercent: 0,
        shadowPercent: 0
      };

      // Parse each tile
      for (var y = 0; y < gridData.height; y++) {
        for (var x = 0; x < gridData.width; x++) {
          var tile = gridData.grid[y][x];
          var pos = { x: x, y: y };

          if (tile === gridData.tiles.WALL) {
            analysis.tiles.walls.push(pos);
          } else if (tile === gridData.tiles.EMPTY) {
            analysis.tiles.empty.push(pos);
            analysis.walkableTiles++;
          } else if (tile === gridData.tiles.COVER) {
            analysis.tiles.cover.push(pos);
            analysis.walkableTiles++;
          } else if (tile === gridData.tiles.SHADOW) {
            analysis.tiles.shadow.push(pos);
            analysis.walkableTiles++;
          } else if (tile === gridData.tiles.EXIT) {
            analysis.tiles.exits.push(pos);
            analysis.walkableTiles++;
          } else {
            analysis.tiles.special.push({ pos: pos, tile: tile });
            analysis.walkableTiles++;
          }
        }
      }

      // Calculate percentages
      var totalTiles = gridData.width * gridData.height;
      analysis.coveragePercent = (analysis.tiles.cover.length / totalTiles * 100).toFixed(1);
      analysis.shadowPercent = (analysis.tiles.shadow.length / totalTiles * 100).toFixed(1);
      analysis.walkablePercent = (analysis.walkableTiles / totalTiles * 100).toFixed(1);

      return analysis;
    }

    /**
     * Find path between two points (for validation)
     */
    static findPath(gridData, startX, startY, endX, endY) {
      if (!gridData || !gridData.grid) {
        return null;
      }

      // Simple BFS pathfinding
      var queue = [{ x: startX, y: startY, path: [] }];
      var visited = {};
      visited[startX + ',' + startY] = true;

      while (queue.length > 0) {
        var current = queue.shift();

        // Found target
        if (current.x === endX && current.y === endY) {
          return {
            found: true,
            length: current.path.length,
            path: current.path
          };
        }

        // Explore neighbors
        var neighbors = [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 }
        ];

        neighbors.forEach(function(dir) {
          var nx = current.x + dir.dx;
          var ny = current.y + dir.dy;
          var key = nx + ',' + ny;

          if (visited[key]) return;
          
          // Check bounds
          if (nx < 0 || nx >= gridData.width || ny < 0 || ny >= gridData.height) {
            return;
          }

          // Check walkable
          var tile = gridData.grid[ny][nx];
          if (tile === gridData.tiles.WALL) {
            return;
          }

          visited[key] = true;
          queue.push({
            x: nx,
            y: ny,
            path: current.path.concat([{ x: nx, y: ny }])
          });
        });
      }

      return {
        found: false,
        reason: 'No path exists'
      };
    }
  }

  // Export classes
  return {
    HeadlessGameAdapter: HeadlessGameAdapter,
    MapParser: MapParser
  };
})();

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HeadlessAdapter;
}
