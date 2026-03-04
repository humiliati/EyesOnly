/* ============================================================
   EYES ONLY - Gone Rogue Movement System
   Smooth continuous movement with grid-based simulation
   ============================================================ */

const GoneRogueMovement = (function () {
  'use strict';

  // Configuration
  var MOVEMENT_SPEED = 3.2; // tiles per second (base speed) — tuned down ~60% (was 8.0) per speed audit 2026-03-04
  var SPRINT_MULTIPLIER = 1.5; // speed multiplier when sprinting
  var LERP_SMOOTHING = 0.2; // smoothing factor for interpolation
  var MIN_PATH_DISTANCE = 0.1; // minimum distance to consider "arrived"

  // State
  var _visualPosition = { x: 0, y: 0 }; // Continuous float position for rendering
  var _logicalPosition = { x: 0, y: 0 }; // Discrete grid position for game logic
  var _targetPath = []; // Array of grid positions to traverse
  var _currentPathIndex = 0;
  var _isMoving = false;
  var _isSprinting = false; // sprint mode flag
  var _lastUpdateTime = 0;

  /**
   * Initialize movement system with player position
   */
  function init(playerX, playerY) {
    _visualPosition = { x: playerX, y: playerY };
    _logicalPosition = { x: playerX, y: playerY };
    _targetPath = [];
    _currentPathIndex = 0;
    _isMoving = false;
    _lastUpdateTime = performance.now();
  }

  /**
   * A* pathfinding implementation
   * Returns array of grid positions from start to goal
   */
  function findPath(startX, startY, goalX, goalY, collisionCheck) {
    // Early exit if start == goal
    if (startX === goalX && startY === goalY) {
      return [{ x: goalX, y: goalY }];
    }

    // Node structure for A*
    function Node(x, y, parent, g, h) {
      this.x = x;
      this.y = y;
      this.parent = parent;
      this.g = g || 0; // cost from start
      this.h = h || 0; // heuristic to goal
      this.f = this.g + this.h; // total cost
    }

    // Heuristic: Octile distance (admissible for 8-directional movement)
    function heuristic(x1, y1, x2, y2) {
      var dx = Math.abs(x2 - x1);
      var dy = Math.abs(y2 - y1);
      var F = Math.SQRT2 - 1;
      return (dx < dy) ? (F * dx + dy) : (F * dy + dx);
    }

    // Check if position is in list
    function inList(list, x, y) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].x === x && list[i].y === y) return list[i];
      }
      return null;
    }

    // Remove node from list
    function removeFromList(list, node) {
      var idx = list.indexOf(node);
      if (idx !== -1) list.splice(idx, 1);
    }

    // Get neighbors (8-directional)
    function getNeighbors(node) {
      var neighbors = [];
      var dirs = [
        { dx: 0, dy: -1, cost: 1 }, // north
        { dx: 1, dy: 0, cost: 1 },  // east
        { dx: 0, dy: 1, cost: 1 },  // south
        { dx: -1, dy: 0, cost: 1 }, // west
        { dx: 1, dy: -1, cost: Math.SQRT2 },  // northeast
        { dx: 1, dy: 1, cost: Math.SQRT2 },   // southeast
        { dx: -1, dy: 1, cost: Math.SQRT2 },  // southwest
        { dx: -1, dy: -1, cost: Math.SQRT2 }  // northwest
      ];

      for (var i = 0; i < dirs.length; i++) {
        var nx = node.x + dirs[i].dx;
        var ny = node.y + dirs[i].dy;

        // Walkability check for the destination
        if (collisionCheck && collisionCheck(nx, ny)) continue;

        // Prevent diagonal corner-cutting through blocked orthogonals
        var isDiagonal = (dirs[i].dx !== 0 && dirs[i].dy !== 0);
        if (isDiagonal && collisionCheck) {
          if (collisionCheck(node.x + dirs[i].dx, node.y) || collisionCheck(node.x, node.y + dirs[i].dy)) {
            continue;
          }
        }

        neighbors.push({ x: nx, y: ny, cost: dirs[i].cost });
      }

      return neighbors;
    }

    // A* algorithm
    var openList = [];
    var closedList = [];

    var startNode = new Node(startX, startY, null, 0, heuristic(startX, startY, goalX, goalY));
    openList.push(startNode);

    var maxIterations = 1000; // prevent infinite loops
    var iterations = 0;

    while (openList.length > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest f in open list
      var current = openList[0];
      var currentIndex = 0;
      for (var i = 1; i < openList.length; i++) {
        if (openList[i].f < current.f) {
          current = openList[i];
          currentIndex = i;
        }
      }

      // Remove current from open list and add to closed list
      openList.splice(currentIndex, 1);
      closedList.push(current);

      // Check if we reached the goal
      if (current.x === goalX && current.y === goalY) {
        // Reconstruct path
        var path = [];
        var node = current;
        while (node) {
          path.unshift({ x: node.x, y: node.y });
          node = node.parent;
        }
        return path;
      }

      // Check neighbors
      var neighbors = getNeighbors(current);
      for (var j = 0; j < neighbors.length; j++) {
        var neighbor = neighbors[j];

        // Skip if in closed list
        if (inList(closedList, neighbor.x, neighbor.y)) continue;

        var g = current.g + (neighbor.cost || 1); // cost to reach this neighbor
        var h = heuristic(neighbor.x, neighbor.y, goalX, goalY);

        var existingOpen = inList(openList, neighbor.x, neighbor.y);
        if (existingOpen) {
          // If this path to neighbor is better, update it
          if (g < existingOpen.g) {
            existingOpen.g = g;
            existingOpen.f = g + existingOpen.h;
            existingOpen.parent = current;
          }
        } else {
          // Add to open list
          var newNode = new Node(neighbor.x, neighbor.y, current, g, h);
          openList.push(newNode);
        }
      }
    }

    // No path found — return empty array so caller knows the target is unreachable.
    // Previously this returned the goal directly, which let the movement system
    // lerp the player straight through walls (the "fishing drag through walls" bug).
    return [];
  }

  /**
   * Smooth an A* path by removing redundant intermediate waypoints.
   * Uses Bresenham-style line-of-sight checks: if the player can walk in
   * a straight line from waypoint A to waypoint C without hitting a wall,
   * waypoint B is redundant and gets pruned.  The result is fewer, more
   * spread-out waypoints which the movement system traverses in smooth
   * straight-line segments instead of zigzagging tile-to-tile.
   *
   * @param {Array} path - [{x,y}, ...] A* waypoints (integer coords)
   * @param {Function|null} collisionCheck - returns true if tile is blocked
   * @returns {Array} smoothed path (subset of original)
   */
  function _smoothPath(path, collisionCheck) {
    if (!collisionCheck || path.length <= 2) return path;

    var smoothed = [path[0]];
    var anchor = 0;

    while (anchor < path.length - 1) {
      var farthest = anchor + 1; // at minimum, keep the next waypoint

      // Probe forward: can we skip intermediate points?
      for (var probe = anchor + 2; probe < path.length; probe++) {
        if (_hasLineOfSight(path[anchor].x, path[anchor].y, path[probe].x, path[probe].y, collisionCheck)) {
          farthest = probe;
        } else {
          break; // once LOS fails, stop probing (path bends around obstacle)
        }
      }

      smoothed.push(path[farthest]);
      anchor = farthest;
    }

    return smoothed;
  }

  /**
   * Bresenham line-of-sight: walk all integer tiles between (x0,y0) and
   * (x1,y1). Returns true if NONE of them are blocked by collisionCheck.
   */
  function _hasLineOfSight(x0, y0, x1, y1, collisionCheck) {
    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1;
    var sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;

    var cx = x0;
    var cy = y0;

    while (true) {
      // Skip start position; check every intermediate + end tile
      if ((cx !== x0 || cy !== y0) && collisionCheck(cx, cy)) return false;

      if (cx === x1 && cy === y1) break;

      var e2 = 2 * err;
      // Diagonal movement: check both orthogonal neighbors to prevent
      // corner-cutting through diagonal wall gaps
      if (e2 > -dy && e2 < dx) {
        // Moving diagonally this step
        if (collisionCheck(cx + sx, cy) && collisionCheck(cx, cy + sy)) return false;
      }
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }

    return true;
  }

  /**
   * Set new movement target.
   * Calculates A* path, smooths it, and starts smooth movement.
   * @param {boolean} isSprinting - Whether player is sprinting (optional)
   */
  function setTarget(targetX, targetY, collisionCheck, isSprinting) {
    // Calculate path from current logical position
    var path = findPath(_logicalPosition.x, _logicalPosition.y, targetX, targetY, collisionCheck);

    // Remove first element (current position)
    if (path.length > 0 && path[0].x === _logicalPosition.x && path[0].y === _logicalPosition.y) {
      path.shift();
    }

    // Smooth: remove redundant intermediate waypoints where line-of-sight
    // exists.  This turns the A* zigzag into long straight-line segments
    // giving Paper-Mario-style fluid traversal.
    if (path.length > 2 && collisionCheck) {
      path = _smoothPath(path, collisionCheck);
    }

    if (path.length > 0) {
      _targetPath = path;
      _currentPathIndex = 0;
      _isMoving = true;
      _isSprinting = isSprinting || false;
      _lastUpdateTime = performance.now();
      return true;
    }

    return false;
  }

  /**
   * Compute effective movement speed for this frame (base + sprint + equipment
   * + terrain modifiers).
   */
  function _getEffectiveSpeed(collisionCheck, targetX, targetY) {
    var currentSpeed = MOVEMENT_SPEED;

    if (_isSprinting) {
      var sprintMultiplier = SPRINT_MULTIPLIER;
      var terrainPenaltyReduction = 0;

      // Equipment sprint speed modifiers (Stiletto Slippers, etc.)
      if (typeof PassiveItemsSystem !== 'undefined') {
        var equipped = (PassiveItemsSystem.getEquippedItems ? PassiveItemsSystem.getEquippedItems() : []);
        for (var i = 0; i < equipped.length; i++) {
          if (equipped[i].sprint_speed_multiplier) {
            sprintMultiplier *= equipped[i].sprint_speed_multiplier;
          }
          if (equipped[i].terrain_penalty_reduction) {
            terrainPenaltyReduction = Math.max(terrainPenaltyReduction, equipped[i].terrain_penalty_reduction);
          }
        }
      }

      currentSpeed *= sprintMultiplier;

      // Terrain penalties (water, etc.)
      if (collisionCheck && typeof collisionCheck.getTileMovePenalty === 'function') {
        var terrainPenalty = collisionCheck.getTileMovePenalty(Math.floor(targetX), Math.floor(targetY));
        if (terrainPenalty > 0) {
          var effectivePenalty = terrainPenalty * (1 - terrainPenaltyReduction);
          currentSpeed *= (1 / (1 + effectivePenalty));
        }
      }
    }

    return currentSpeed;
  }

  /**
   * Update movement interpolation.
   * Call this every frame (requestAnimationFrame).
   * Returns true if position changed.
   *
   * KEY FIX (2026-03-04): Excess movement at each waypoint is now carried
   * forward into the next waypoint within the same frame.  Previously the
   * leftover distance was clamped/lost, which caused visible "lurching" —
   * the player decelerated as it approached each grid-tile center and then
   * re-accelerated from zero toward the next one.
   */
  function update(collisionCheck) {
    if (!_isMoving || _targetPath.length === 0) {
      // Snap visual to logical when idle
      _visualPosition.x = _logicalPosition.x;
      _visualPosition.y = _logicalPosition.y;
      return false;
    }

    var now = performance.now();
    var deltaTime = (now - _lastUpdateTime) / 1000; // seconds
    _lastUpdateTime = now;

    // Drain sprint fatigue
    if (_isSprinting && typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.drainSprintFatigue === 'function') {
      GAMESTATE.drainSprintFatigue(deltaTime);
    }

    // Sprint trail VFX
    if (typeof SprintTrailSystem !== 'undefined') {
      SprintTrailSystem.update(deltaTime, _isSprinting, _visualPosition.x, _visualPosition.y);
    }

    // Compute movement budget for this frame
    var target = _targetPath[_currentPathIndex];
    if (!target) {
      _isMoving = false;
      return false;
    }

    var speed = _getEffectiveSpeed(collisionCheck, target.x, target.y);
    var budget = speed * deltaTime; // tiles remaining to travel this frame

    // ── Consume budget across consecutive waypoints ──────────────────
    // Instead of stopping at each waypoint and losing the remainder,
    // carry the leftover into the next segment.  This eliminates the
    // per-tile deceleration/re-acceleration pulse ("lurching").
    var MAX_WAYPOINTS_PER_FRAME = 8; // safety cap
    var waypointsConsumed = 0;

    while (budget > 0 && _currentPathIndex < _targetPath.length && waypointsConsumed < MAX_WAYPOINTS_PER_FRAME) {
      target = _targetPath[_currentPathIndex];

      var dx = target.x - _visualPosition.x;
      var dy = target.y - _visualPosition.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MIN_PATH_DISTANCE) {
        // Already at this waypoint — snap and advance
        _visualPosition.x = target.x;
        _visualPosition.y = target.y;
        _logicalPosition.x = target.x;
        _logicalPosition.y = target.y;
        _currentPathIndex++;
        waypointsConsumed++;
        continue;
      }

      if (budget >= dist) {
        // Enough budget to REACH this waypoint — snap to it, carry remainder
        _visualPosition.x = target.x;
        _visualPosition.y = target.y;
        _logicalPosition.x = target.x;
        _logicalPosition.y = target.y;
        budget -= dist;
        _currentPathIndex++;
        waypointsConsumed++;
        // Continue loop — spend leftover budget on next segment
      } else {
        // Not enough budget to reach this waypoint — move partially
        var nx = dx / dist;
        var ny = dy / dist;
        _visualPosition.x += nx * budget;
        _visualPosition.y += ny * budget;
        budget = 0;
      }
    }

    // Check if path is complete
    if (_currentPathIndex >= _targetPath.length) {
      var last = _targetPath[_targetPath.length - 1];
      _isMoving = false;
      _visualPosition.x = last.x;
      _visualPosition.y = last.y;
      _logicalPosition.x = last.x;
      _logicalPosition.y = last.y;
    }

    return true;
  }

  /**
   * Cancel current movement
   */
  function stop() {
    _isMoving = false;
    _targetPath = [];
    _currentPathIndex = 0;

    // Snap to nearest grid position
    _logicalPosition.x = Math.round(_visualPosition.x);
    _logicalPosition.y = Math.round(_visualPosition.y);
    _visualPosition.x = _logicalPosition.x;
    _visualPosition.y = _logicalPosition.y;
  }

  /**
   * Get visual position (for rendering)
   */
  function getVisualPosition() {
    return { x: _visualPosition.x, y: _visualPosition.y };
  }

  /**
   * Get logical position (for game logic)
   */
  function getLogicalPosition() {
    return { x: _logicalPosition.x, y: _logicalPosition.y };
  }

  /**
   * Check if currently moving
   */
  function isMoving() {
    return _isMoving;
  }

  /**
   * Check if currently sprinting
   */
  function isSprinting() {
    return _isSprinting;
  }

  /**
   * Get current path (for visualization)
   */
  function getCurrentPath() {
    return _targetPath.slice(_currentPathIndex);
  }

  /**
   * Set positions directly (for teleports, floor transitions, etc.)
   */
  function setPosition(x, y) {
    _visualPosition.x = x;
    _visualPosition.y = y;
    _logicalPosition.x = x;
    _logicalPosition.y = y;
    _isMoving = false;
    _targetPath = [];
    _currentPathIndex = 0;
  }

  /**
   * Start moving to a target tile using built-in walkability check.
   * Convenience wrapper around setTarget for scripted walks and controller hooks.
   * Uses GoneRogue.isWalkable if available, otherwise allows all tiles.
   * @param {number} x - Target grid X
   * @param {number} y - Target grid Y
   * @param {boolean} [isSprinting] - Whether to sprint
   */
  function startMoveTo(x, y, isSprinting) {
    var collisionCheck = (typeof GoneRogue !== 'undefined' && GoneRogue.isWalkable)
      ? function(tx, ty) { return !GoneRogue.isWalkable(tx, ty); }
      : null;
    setTarget(x, y, collisionCheck, isSprinting || false);
  }

  // Public API
  return {
    init: init,
    findPath: findPath,
    setTarget: setTarget,
    startMoveTo: startMoveTo,
    update: update,
    stop: stop,
    getVisualPosition: getVisualPosition,
    getLogicalPosition: getLogicalPosition,
    isMoving: isMoving,
    isSprinting: isSprinting,
    getCurrentPath: getCurrentPath,
    setPosition: setPosition
  };
})();
