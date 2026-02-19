/* ============================================================
   EYES ONLY - MOK Visual Engine
   Renders pentagram sprite with LED glow animation
   ============================================================ */

const MOKVisualEngine = (function() {
  'use strict';

  var _container = null;
  var _currentAnimation = null;
  var _currentFrame = 0;
  var _animationTimer = null;
  var _glowElement = null;
  var _pentagramElement = null;

  /**
   * Initialize the visual engine
   * @param {HTMLElement} container - Container element for MOK
   */
  function init(container) {
    _container = container;
    _renderMOK();
    playAnimation('idle_breathe');
  }

  /**
   * Render MOK pentagram structure
   */
  function _renderMOK() {
    if (!_container) return;

    // Clear existing content
    _container.innerHTML = '';
    _container.className = 'mok-visual-container';

    // Create pentagram structure
    // For now, using CSS-based pentagram (upside down)
    // TODO: Replace with sprite sheet system when cutting engine is ready
    
    var mokWrapper = document.createElement('div');
    mokWrapper.className = 'mok-pentagram-wrapper';

    // Pentagram outer structure (will be cut off by frame for "zoomed" effect)
    _pentagramElement = document.createElement('div');
    _pentagramElement.className = 'mok-pentagram';
    
    // Interior triangle (LED glow area)
    _glowElement = document.createElement('div');
    _glowElement.className = 'mok-triangle-glow';
    _glowElement.innerHTML = '&#9650;'; // Upward triangle (pentagram is inverted, so triangle points up)

    _pentagramElement.appendChild(_glowElement);
    mokWrapper.appendChild(_pentagramElement);
    _container.appendChild(mokWrapper);
  }

  /**
   * Play animation cycle
   * @param {string} cycleId - Animation cycle ID
   */
  function playAnimation(cycleId) {
    if (_animationTimer) {
      clearInterval(_animationTimer);
    }

    var cycle = MOKAnimationCycles.getCycle(cycleId);
    if (!cycle) {
      console.warn('[MOKVisualEngine] Unknown cycle:', cycleId);
      return;
    }

    _currentAnimation = cycle;
    _currentFrame = 0;

    // Set glow state
    var glowState = MOKAnimationCycles.getGlowState(cycle.expression);
    _setGlowState(glowState);

    // Start frame animation
    _animateFrames();
  }

  /**
   * Animate frames
   */
  function _animateFrames() {
    if (!_currentAnimation || !_glowElement) return;

    var cycle = _currentAnimation;
    var frameIndex = _currentFrame % cycle.frames.length;
    var frameTiming = cycle.timing[frameIndex];

    // Update visual based on frame
    // For now, just pulse the glow
    _updateFrameVisual(frameIndex);

    _currentFrame++;

    // Check if animation should continue
    if (!cycle.loop && _currentFrame >= cycle.frames.length) {
      // Animation complete, return to idle
      setTimeout(function() {
        playAnimation('idle_breathe');
      }, frameTiming);
      return;
    }

    // Schedule next frame
    _animationTimer = setTimeout(function() {
      _animateFrames();
    }, frameTiming);
  }

  /**
   * Update frame visual
   * @param {number} frameIndex - Current frame index
   */
  function _updateFrameVisual(frameIndex) {
    if (!_glowElement) return;

    // Calculate pulse phase (0-1)
    var frameCount = _currentAnimation.frames.length;
    var pulsePhase = frameIndex / frameCount;

    // Pulse scale (0.9 to 1.1)
    var scale = 0.9 + Math.sin(pulsePhase * Math.PI * 2) * 0.1;
    
    // Pulse opacity (0.6 to 1.0)
    var opacity = 0.6 + Math.sin(pulsePhase * Math.PI * 2) * 0.4;

    _glowElement.style.transform = 'scale(' + scale + ')';
    _glowElement.style.opacity = opacity;
  }

  /**
   * Set glow state (color and pulse speed)
   * @param {Object} glowState - Glow state configuration
   */
  function _setGlowState(glowState) {
    if (!_glowElement) return;

    // Set CSS variables for glow colors
    _glowElement.style.setProperty('--mok-primary-glow', glowState.primaryColor);
    _glowElement.style.setProperty('--mok-secondary-glow', glowState.secondaryColor);
    _glowElement.style.setProperty('--mok-pulse-speed', glowState.pulseSpeed + 'ms');

    // Apply glow class based on state
    _glowElement.className = 'mok-triangle-glow glow-' + _currentAnimation.expression;
  }

  /**
   * Stop all animations
   */
  function stop() {
    if (_animationTimer) {
      clearInterval(_animationTimer);
      _animationTimer = null;
    }
  }

  /**
   * Get current animation state
   */
  function getCurrentAnimation() {
    return _currentAnimation ? _currentAnimation.cycleId : null;
  }

  /**
   * Set custom glow colors (for API/kernel integration)
   * @param {string} primaryColor - Primary glow color (hex)
   * @param {string} secondaryColor - Secondary glow color (hex)
   * @param {number} pulseSpeed - Pulse speed in ms (optional)
   */
  function setCustomGlowColors(primaryColor, secondaryColor, pulseSpeed) {
    if (!_glowElement) return;

    if (primaryColor) {
      _glowElement.style.setProperty('--mok-primary-glow', primaryColor);
    }
    if (secondaryColor) {
      _glowElement.style.setProperty('--mok-secondary-glow', secondaryColor);
    }
    if (pulseSpeed) {
      _glowElement.style.setProperty('--mok-pulse-speed', pulseSpeed + 'ms');
    }
  }

  /**
   * Set expression directly (for API integration)
   * @param {string} expression - Expression name (idle, talking, warning, etc.)
   * @param {Object} options - Optional color and timing overrides
   */
  function setExpression(expression, options) {
    options = options || {};
    
    // Find cycle for expression
    var cycleId = expression + '_active';
    var cycle = MOKAnimationCycles.getCycle(cycleId);
    
    // Fallback to basic expression if specific cycle not found
    if (!cycle) {
      cycleId = expression === 'idle' ? 'idle_breathe' : (expression + '_active');
      cycle = MOKAnimationCycles.getCycle(cycleId);
    }
    
    if (!cycle) {
      console.warn('[MOKVisualEngine] Unknown expression:', expression);
      return;
    }

    // Apply custom colors if provided
    if (options.primaryColor || options.secondaryColor) {
      setCustomGlowColors(options.primaryColor, options.secondaryColor, options.pulseSpeed);
    }

    // Play animation
    playAnimation(cycleId);
  }

  /**
   * Get current glow colors (for inspection)
   */
  function getCurrentGlowColors() {
    if (!_glowElement) return null;
    
    return {
      primaryColor: _glowElement.style.getPropertyValue('--mok-primary-glow') || 
                    getComputedStyle(_glowElement).getPropertyValue('--mok-primary-glow'),
      secondaryColor: _glowElement.style.getPropertyValue('--mok-secondary-glow') ||
                      getComputedStyle(_glowElement).getPropertyValue('--mok-secondary-glow'),
      pulseSpeed: _glowElement.style.getPropertyValue('--mok-pulse-speed') ||
                  getComputedStyle(_glowElement).getPropertyValue('--mok-pulse-speed')
    };
  }

  // Public API
  return {
    init: init,
    playAnimation: playAnimation,
    stop: stop,
    getCurrentAnimation: getCurrentAnimation,
    setCustomGlowColors: setCustomGlowColors,
    setExpression: setExpression,
    getCurrentGlowColors: getCurrentGlowColors
  };
})();
