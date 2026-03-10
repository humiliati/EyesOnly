/* ============================================================
   EYES ONLY - Sprint Trail System
   Visual ◦◦◦ trail effects behind sprinting player with color coding
   ============================================================ */

const SprintTrailSystem = (function() {
  'use strict';

  // Trail configuration
    var MAX_TRAIL_LAYERS = 4; // Maximum parentheses layers: ., .., ..., ....
  var TRAIL_DECAY_BASE = 0.4; // Base decay rate per second (seconds to full decay)
  var TRAIL_SPAWN_INTERVAL = 0.15; // Spawn new trail every N seconds
  var TRAIL_FADE_DURATION = 0.65; // How long each trail particle lasts

  // Trail particles array: {x, y, layer, color, spawnTime, lifespan}
  var _trails = [];
  var _lastSpawnTime = 0;
  var _currentLayer = 1; // Start with single (

  /**
   * Initialize trail system
   */
  function init() {
    _trails = [];
    _lastSpawnTime = 0;
    _currentLayer = 1;
    console.log('[SprintTrailSystem] Initialized');
  }

  /**
   * Update trail system (call each frame)
   * @param {number} deltaTime - Time elapsed in seconds
   * @param {boolean} isSprinting - Whether player is currently sprinting
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   */
  function update(deltaTime, isSprinting, playerX, playerY) {
    var now = performance.now() / 1000; // Convert to seconds

    // Decay trail intensity when not sprinting
    if (!isSprinting) {
      _currentLayer = Math.max(0, _currentLayer - (TRAIL_DECAY_BASE * deltaTime));
    } else {
      // Build up trail layers while sprinting (up to max)
      _currentLayer = Math.min(MAX_TRAIL_LAYERS, _currentLayer + (deltaTime * 2));
    }

    // Spawn new trail particles if sprinting and interval passed
    if (isSprinting && (now - _lastSpawnTime) >= TRAIL_SPAWN_INTERVAL) {
      _spawnTrail(playerX, playerY);
      _lastSpawnTime = now;
    }

    // Remove expired trail particles
    _trails = _trails.filter(function(trail) {
      var age = now - trail.spawnTime;
      return age < trail.lifespan;
    });
  }

  /**
   * Spawn a new trail particle behind player
   * @param {number} x - Player X position
   * @param {number} y - Player Y position
   * @private
   */
  function _spawnTrail(x, y) {
    // Determine color based on equipped items/modifiers
    var color = _getTrailColor();

    // Create trail particle for each active layer
    var layerCount = Math.floor(_currentLayer);
    for (var i = 0; i < layerCount; i++) {
      _trails.push({
        x: x,
        y: y,
        layer: i + 1,
        color: color,
        spawnTime: performance.now() / 1000,
        lifespan: TRAIL_FADE_DURATION
      });
    }
  }

  /**
   * Get trail color based on equipped items/modifiers
   * @returns {string} CSS color
   * @private
   */
  function _getTrailColor() {
    // Check for equipped items that modify trail color
    if (typeof PassiveItemsSystem !== 'undefined') {
      var equipped = (PassiveItemsSystem.getEquippedItems ? PassiveItemsSystem.getEquippedItems() : []);
      for (var i = 0; i < equipped.length; i++) {
        if (equipped[i].trailColor) {
          return equipped[i].trailColor;
        }
      }
    }

    // Default sprint trail color — fatigue resource color (earthy brown)
    return '#A0522D';
  }

  /**
   * Get trail text for a given layer
   * @param {number} layer - Layer number (1-4)
   * @returns {string} Trail text
   * @private
   */
  function _getTrailText(layer) {
    var text = '';
    for (var i = 0; i < layer; i++) {
        text += ',';
    }
    return text;
  }

  /**
   * Render trails to DOM (called by mobile grid renderer)
   * @param {HTMLElement} container - Grid container element
   * @param {number} cellWidth - Cell width in pixels
   * @param {number} cellHeight - Cell height in pixels
   */
  function renderToDOM(container, cellWidth, cellHeight) {
    if (!container) return;

    var now = performance.now() / 1000;

    // Remove old trail elements
    var oldTrails = container.querySelectorAll('.sprint-trail');
    for (var i = 0; i < oldTrails.length; i++) {
      oldTrails[i].parentNode.removeChild(oldTrails[i]);
    }

    // Render current trails
    for (var j = 0; j < _trails.length; j++) {
      var trail = _trails[j];
      var age = now - trail.spawnTime;
      var opacity = Math.max(0, 0.35 * (1 - (age / trail.lifespan))); // cap at 35% — subtle

      var trailDiv = document.createElement('div');
      trailDiv.className = 'sprint-trail';
      trailDiv.textContent = _getTrailText(trail.layer);
      trailDiv.style.position = 'absolute';
      trailDiv.style.left = (trail.x * cellWidth + cellWidth * 0.5) + 'px';
      trailDiv.style.top = (trail.y * cellHeight + cellHeight * 0.5) + 'px';
      trailDiv.style.transform = 'translate(-50%, -50%)';
      trailDiv.style.color = trail.color;
      trailDiv.style.opacity = opacity;
      trailDiv.style.fontSize = (12 + (trail.layer * 2)) + 'px';
      trailDiv.style.fontWeight = 'bold';
      trailDiv.style.pointerEvents = 'none';
      trailDiv.style.textShadow = '0 0 3px ' + trail.color;
      trailDiv.style.transition = 'opacity 0.1s ease-out';

      container.appendChild(trailDiv);
    }
  }

  /**
   * Render trails to canvas (called by canvas renderer)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} cellWidth - Cell width in pixels
   * @param {number} cellHeight - Cell height in pixels
   */
  function renderToCanvas(ctx, cellWidth, cellHeight) {
    if (!ctx) return;

    var now = performance.now() / 1000;

    for (var i = 0; i < _trails.length; i++) {
      var trail = _trails[i];
      var age = now - trail.spawnTime;
      var opacity = Math.max(0, 0.35 * (1 - (age / trail.lifespan))); // cap at 35% — subtle

      var x = trail.x * cellWidth + cellWidth * 0.5;
      var y = trail.y * cellHeight + cellHeight * 0.5;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = trail.color;
      ctx.font = 'bold ' + (12 + (trail.layer * 2)) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = trail.color;
      ctx.shadowBlur = 3;
      ctx.fillText(_getTrailText(trail.layer), x, y);
      ctx.restore();
    }
  }

  /**
   * Get current trail layer (for debugging)
   * @returns {number} Current layer (0-4)
   */
  function getCurrentLayer() {
    return Math.floor(_currentLayer);
  }

  /**
   * Clear all trails
   */
  function clear() {
    _trails = [];
    _currentLayer = 1;
  }

  // Public API
  return {
    init: init,
    update: update,
    renderToDOM: renderToDOM,
    renderToCanvas: renderToCanvas,
    getCurrentLayer: getCurrentLayer,
    clear: clear,
    /** Expose raw trail array for renderers that handle coordinates themselves */
    _getTrails: function() { return _trails; }
  };
})();
