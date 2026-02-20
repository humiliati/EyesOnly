/* ============================================================
   EYES ONLY - Gone Rogue Movement System
   Smooth continuous movement with grid-based simulation
   ============================================================ */

const GoneRogueMovement = (function () {
  'use strict';

  // Configuration
  var MOVEMENT_SPEED = 8.0; // tiles per second (base speed)
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

    // Heuristic: Manhattan distance
    function heuristic(x1, y1, x2, y2) {
      return Math.abs(x2 - x1) + Math.abs(y2 - y1);
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

    // Get neighbors (4-directional)
    function getNeighbors(node) {
      var neighbors = [];
      var dirs = [
        { dx: 0, dy: -1 }, // north
        { dx: 1, dy: 0 },  // east
        { dx: 0, dy: 1 },  // south
        { dx: -1, dy: 0 }  // west
      ];

      for (var i = 0; i < dirs.length; i++) {
        var nx = node.x + dirs[i].dx;
        var ny = node.y + dirs[i].dy;

        // Check if walkable
        if (!collisionCheck || !collisionCheck(nx, ny)) {
          neighbors.push({ x: nx, y: ny });
        }
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

        var g = current.g + 1; // cost to reach this neighbor
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

    // No path found - return direct line to goal (will hit wall but at least moves)
    return [{ x: goalX, y: goalY }];
  }

  /**
   * Set new movement target
   * Calculates path and starts smooth movement
   * @param {boolean} isSprinting - Whether player is sprinting (optional)
   */
  function setTarget(targetX, targetY, collisionCheck, isSprinting) {
    // Calculate path from current logical position
    var path = findPath(_logicalPosition.x, _logicalPosition.y, targetX, targetY, collisionCheck);

    // Remove first element (current position)
    if (path.length > 0 && path[0].x === _logicalPosition.x && path[0].y === _logicalPosition.y) {
      path.shift();
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
   * Update movement interpolation
   * Call this every frame (requestAnimationFrame)
   * Returns true if position changed
   */
  function update(collisionCheck) {
    if (!_isMoving || _targetPath.length === 0) {
      // Snap visual to logical if not moving
      _visualPosition.x = _logicalPosition.x;
      _visualPosition.y = _logicalPosition.y;
      return false;
    }

    var now = performance.now();
    var deltaTime = (now - _lastUpdateTime) / 1000; // convert to seconds
    _lastUpdateTime = now;

    // Drain sprint fatigue if sprinting
    if (_isSprinting && typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.drainSprintFatigue === 'function') {
      GAMESTATE.drainSprintFatigue(deltaTime);
    }

    // Update sprint trail system
    if (typeof SprintTrailSystem !== 'undefined') {
      SprintTrailSystem.update(deltaTime, _isSprinting, _visualPosition.x, _visualPosition.y);
    }

    // Get current target waypoint
    if (_currentPathIndex >= _targetPath.length) {
      // Reached end of path
      _isMoving = false;
      _logicalPosition.x = _targetPath[_targetPath.length - 1].x;
      _logicalPosition.y = _targetPath[_targetPath.length - 1].y;
      _visualPosition.x = _logicalPosition.x;
      _visualPosition.y = _logicalPosition.y;
      return true;
    }

    var target = _targetPath[_currentPathIndex];

    // Calculate direction and distance to target
    var dx = target.x - _visualPosition.x;
    var dy = target.y - _visualPosition.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    // Check if we've reached this waypoint
    if (distance < MIN_PATH_DISTANCE) {
      // Move to next waypoint
      _currentPathIndex++;

      // Update logical position to this waypoint
      _logicalPosition.x = target.x;
      _logicalPosition.y = target.y;

      // Check if path is complete
      if (_currentPathIndex >= _targetPath.length) {
        _isMoving = false;
        _visualPosition.x = _logicalPosition.x;
        _visualPosition.y = _logicalPosition.y;
        return true;
      }

      return true;
    }

    // Lerp towards target with sprint multiplier and equipment modifiers
    var currentSpeed = MOVEMENT_SPEED;

    if (_isSprinting) {
      var sprintMultiplier = SPRINT_MULTIPLIER;

      // Apply equipment sprint speed modifiers (Stiletto Slippers, etc.)
      if (typeof PassiveItemsSystem !== 'undefined') {
        var equipped = PassiveItemsSystem.getEquippedItems();
        for (var i = 0; i < equipped.length; i++) {
          if (equipped[i].sprint_speed_multiplier) {
            sprintMultiplier *= equipped[i].sprint_speed_multiplier;
          }
        }
      }

      currentSpeed *= sprintMultiplier;
    }

    var moveDistance = currentSpeed * deltaTime;
    if (moveDistance > distance) {
      moveDistance = distance;
    }

    _visualPosition.x += (dx / distance) * moveDistance;
    _visualPosition.y += (dy / distance) * moveDistance;

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

  // Public API
  return {
    init: init,
    findPath: findPath,
    setTarget: setTarget,
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
