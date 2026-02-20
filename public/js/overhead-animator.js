/* ============================================================
   EYES ONLY - Overhead Animator System
   Displays animated icons, emojis, and effects above entities
   ============================================================ */

const OverheadAnimator = (function() {
  'use strict';

  // Active animations tracked by entity position
  var _activeAnimations = {}; // key: "x,y", value: { type, emoji, startTime, duration, data }
  var _animationQueue = []; // Queue for currency pickup animations

  /**
   * Expression vocabulary for game interactions
   */
  var EXPRESSIONS = {
    // Alert/Awareness States
    ALERT: { emoji: '!', color: '#ff0000', desc: 'Alerted/Spotted' },
    QUESTION: { emoji: '?', color: '#ffff00', desc: 'Suspicious/Investigating' },
    SLEEPING: { emoji: '💤', color: '#88ccff', desc: 'Unaware/Sleeping' },
    WATCHING: { emoji: '👁️', color: '#ffffff', desc: 'Watching/Observing' },
    SEARCH: { emoji: '🔍', color: '#ffaa00', desc: 'Searching for player' },

    // Interaction States
    THINKING: { emoji: '💭', color: '#aaaaff', desc: 'Thinking/Pondering' },
    TALKING: { emoji: '💬', color: '#ffffff', desc: 'Speaking/Communicating' },
    READING: { emoji: '📖', color: '#ffddaa', desc: 'Reading text' },
    INSPECTING: { emoji: '🔍', color: '#ffff88', desc: 'Inspecting object' },
    LISTENING: { emoji: '👂', color: '#aaddff', desc: 'Listening carefully' },

    // Combat Expressions (text-based for ASCII feel)
    CONFIDENT: { emoji: '^_^', color: '#00ff00', desc: 'Confident/Happy' },
    CRYING: { emoji: 'T_T', color: '#4488ff', desc: 'Hurt/Crying' },
    ANGRY: { emoji: '>__<', color: '#ff4444', desc: 'Angry/Frustrated' },
    DETERMINED: { emoji: '`_´', color: '#ffaa00', desc: 'Determined/Serious' },
    SURPRISED: { emoji: 'o_o', color: '#ffff00', desc: 'Surprised/Shocked' },
    DEAD: { emoji: 'x_x', color: '#666666', desc: 'Defeated/Dead' },
    SMIRK: { emoji: '¬_¬', color: '#ff88ff', desc: 'Smirking/Confident' },

    // Status Effects
    BURNING: { emoji: '🔥', color: '#ff6600', desc: 'On fire' },
    FROZEN: { emoji: '❄️', color: '#88ddff', desc: 'Frozen/Slowed' },
    SHOCKED: { emoji: '⚡', color: '#ffff00', desc: 'Electrocuted' },
    POISONED: { emoji: '☠️', color: '#00ff00', desc: 'Poisoned' },
    BLEEDING: { emoji: '💉', color: '#ff0000', desc: 'Bleeding' },
    STUNNED: { emoji: '💫', color: '#ffaa88', desc: 'Stunned/Dizzy' },
    HEALING: { emoji: '💚', color: '#00ff88', desc: 'Healing/Regenerating' },
    BUFFED: { emoji: '✨', color: '#ffdd00', desc: 'Buffed/Enhanced' },

    // Emotional States
    HAPPY: { emoji: '😊', color: '#ffff00', desc: 'Happy/Pleased' },
    SAD: { emoji: '😢', color: '#4488ff', desc: 'Sad/Disappointed' },
    SCARED: { emoji: '😰', color: '#ffaa88', desc: 'Scared/Frightened' },
    EXCITED: { emoji: '🤩', color: '#ffaa00', desc: 'Excited/Impressed' },
    CONFUSED: { emoji: '😕', color: '#aaaaaa', desc: 'Confused/Uncertain' },

    // Currency/Loot
    COIN: { emoji: '¢', color: '#ffff00', desc: 'Currency collected' },
    COIN_SMALL: { emoji: '•', color: '#ffff00', desc: 'Small currency' },
    COIN_LARGE: { emoji: '◉', color: '#ffff00', desc: 'Large currency' },
    LOOT: { emoji: '💎', color: '#00ffff', desc: 'Item/Loot collected' },

    // Special Indicators
    LEVEL_UP: { emoji: '⬆️', color: '#00ff00', desc: 'Level up!' },
    ACHIEVEMENT: { emoji: '🏆', color: '#ffdd00', desc: 'Achievement unlocked' },
    CRITICAL: { emoji: '‼️', color: '#ff0000', desc: 'Critical hit' },
    MISS: { emoji: '❌', color: '#888888', desc: 'Attack missed' },
    BLOCK: { emoji: '🛡️', color: '#88aaff', desc: 'Attack blocked' },
    DODGE: { emoji: '💨', color: '#aaaaaa', desc: 'Dodged attack' }
  };

  /**
   * Animation types and their behaviors
   */
  var ANIMATION_TYPES = {
    CURRENCY_PICKUP: {
      duration: [200, 1200], // Min/max duration based on quantity
      path: 'bounce', // Movement pattern
      fadeOut: true
    },
    EXPRESSION: {
      duration: 2000, // 2 seconds default
      path: 'float', // Gentle floating
      fadeOut: true
    },
    STATUS_PERSISTENT: {
      duration: null, // Infinite until cleared
      path: 'bob', // Gentle bobbing
      fadeOut: false
    },
    SPEECH: {
      duration: 3000, // 3 seconds
      path: 'static', // No movement
      fadeOut: true
    }
  };

  /**
   * Initialize the animator system
   */
  function init() {
    _activeAnimations = {};
    _animationQueue = [];
    console.log('[OverheadAnimator] Initialized');
  }

  /**
   * Show currency pickup animation
   * @param {number} x - Entity X position
   * @param {number} y - Entity Y position
   * @param {number} amount - Amount of currency picked up
   */
  function showCurrencyPickup(x, y, amount) {
    // Calculate duration based on quantity (more coins = longer animation)
    var baseDuration = 200;
    var durationPerCoin = 100;
    var duration = Math.min(baseDuration + (amount * durationPerCoin), 1200);

    // Determine coin symbol based on amount
    var coinEmoji = amount >= 50 ? EXPRESSIONS.COIN_LARGE.emoji :
                    amount >= 10 ? EXPRESSIONS.COIN.emoji :
                    EXPRESSIONS.COIN_SMALL.emoji;

    var animation = {
      type: 'CURRENCY_PICKUP',
      emoji: coinEmoji,
      text: amount > 1 ? '+' + amount + '¢' : '+¢',
      color: EXPRESSIONS.COIN.color,
      startTime: Date.now(),
      duration: duration,
      data: { amount: amount }
    };

    // Queue animation if there's already one at this position
    var key = x + ',' + y;
    if (_activeAnimations[key]) {
      _animationQueue.push({ x: x, y: y, animation: animation });
    } else {
      _activeAnimations[key] = animation;
    }

    console.log('[OverheadAnimator] Currency pickup:', amount, 'at', x, y, 'duration:', duration + 'ms');
  }

  /**
   * Show expression above entity
   * @param {number} x - Entity X position
   * @param {number} y - Entity Y position
   * @param {string} expressionKey - Key from EXPRESSIONS object
   * @param {number} duration - Optional custom duration in ms
   * @param {string} customEmoji - Optional custom emoji to override expression emoji
   */
  function showExpression(x, y, expressionKey, duration, customEmoji) {
    var expression = EXPRESSIONS[expressionKey];
    if (!expression) {
      console.warn('[OverheadAnimator] Unknown expression:', expressionKey);
      return;
    }

    var animation = {
      type: 'EXPRESSION',
      emoji: customEmoji || expression.emoji,
      color: expression.color,
      startTime: Date.now(),
      duration: duration || ANIMATION_TYPES.EXPRESSION.duration,
      data: { desc: expression.desc }
    };

    var key = x + ',' + y;
    _activeAnimations[key] = animation;

    console.log('[OverheadAnimator] Expression:', expressionKey, 'at', x, y);
  }

  /**
   * Show persistent status effect icon
   * @param {number} x - Entity X position
   * @param {number} y - Entity Y position
   * @param {string} statusKey - Key from EXPRESSIONS object
   */
  function showStatus(x, y, statusKey) {
    var status = EXPRESSIONS[statusKey];
    if (!status) {
      console.warn('[OverheadAnimator] Unknown status:', statusKey);
      return;
    }

    var animation = {
      type: 'STATUS_PERSISTENT',
      emoji: status.emoji,
      color: status.color,
      startTime: Date.now(),
      duration: null, // Infinite
      data: { desc: status.desc }
    };

    var key = x + ',' + y;
    _activeAnimations[key] = animation;

    console.log('[OverheadAnimator] Status:', statusKey, 'at', x, y);
  }

  /**
   * Show speech/thought bubble text
   * @param {number} x - Entity X position
   * @param {number} y - Entity Y position
   * @param {string} text - Text to display
   * @param {string} bubbleType - 'TALKING' or 'THINKING'
   * @param {number} duration - Optional custom duration in ms
   */
  function showSpeech(x, y, text, bubbleType, duration) {
    var expression = EXPRESSIONS[bubbleType] || EXPRESSIONS.TALKING;

    var animation = {
      type: 'SPEECH',
      emoji: expression.emoji,
      text: text,
      color: expression.color,
      startTime: Date.now(),
      duration: duration || ANIMATION_TYPES.SPEECH.duration,
      data: { bubbleType: bubbleType }
    };

    var key = x + ',' + y;
    _activeAnimations[key] = animation;

    console.log('[OverheadAnimator] Speech:', bubbleType, 'at', x, y, '-', text);
  }

  /**
   * Clear animation at position
   * @param {number} x - Entity X position
   * @param {number} y - Entity Y position
   */
  function clearAnimation(x, y) {
    var key = x + ',' + y;
    delete _activeAnimations[key];
  }

  /**
   * Clear all animations
   */
  function clearAll() {
    _activeAnimations = {};
    _animationQueue = [];
  }

  /**
   * Update animations (remove expired, process queue)
   * @param {number} currentTime - Current timestamp in ms
   */
  function update(currentTime) {
    var expiredKeys = [];

    // Check for expired animations
    for (var key in _activeAnimations) {
      var anim = _activeAnimations[key];
      if (anim.duration !== null) {
        var elapsed = currentTime - anim.startTime;
        if (elapsed >= anim.duration) {
          expiredKeys.push(key);
        }
      }
    }

    // Remove expired animations
    expiredKeys.forEach(function(key) {
      delete _activeAnimations[key];
    });

    // Process animation queue (show next queued animation at cleared positions)
    if (_animationQueue.length > 0) {
      var remainingQueue = [];
      _animationQueue.forEach(function(queuedItem) {
        var key = queuedItem.x + ',' + queuedItem.y;
        if (!_activeAnimations[key]) {
          _activeAnimations[key] = queuedItem.animation;
        } else {
          remainingQueue.push(queuedItem);
        }
      });
      _animationQueue = remainingQueue;
    }
  }

  /**
   * Get animation data at position (for rendering)
   * @param {number} x - Entity X position
   * @param {number} y - Entity Y position
   * @returns {object} Animation data or null
   */
  function getAnimationAt(x, y) {
    var key = x + ',' + y;
    return _activeAnimations[key] || null;
  }

  /**
   * Get all active animations (for rendering)
   * @returns {object} Map of all active animations
   */
  function getAllAnimations() {
    return _activeAnimations;
  }

  /**
   * Calculate animation position offset for different animation types
   * @param {object} animation - Animation object
   * @param {number} currentTime - Current timestamp
   * @returns {object} {x: offsetX, y: offsetY, opacity: value}
   */
  function calculateAnimationTransform(animation, currentTime) {
    var elapsed = currentTime - animation.startTime;
    var progress = animation.duration ? Math.min(elapsed / animation.duration, 1.0) : 0;

    var transform = { x: 0, y: 0, opacity: 1.0, scale: 1.0 };

    switch (animation.type) {
      case 'CURRENCY_PICKUP':
        // Bounce up and fade out
        var bounceHeight = 20; // pixels
        var bounceProgress = Math.sin(progress * Math.PI); // 0 -> 1 -> 0
        transform.y = -bounceHeight * bounceProgress;
        transform.opacity = 1.0 - progress; // Fade out as it rises
        transform.scale = 1.0 + (0.2 * bounceProgress); // Slight scale
        break;

      case 'EXPRESSION':
        // Gentle float up and fade
        var floatHeight = 10;
        transform.y = -floatHeight * progress;
        transform.opacity = 1.0 - (progress * 0.7); // Fade out gradually
        break;

      case 'STATUS_PERSISTENT':
        // Gentle bob up and down
        var bobHeight = 3;
        var bobSpeed = 2; // Cycles per second
        var bobProgress = Math.sin((elapsed / 1000) * bobSpeed * Math.PI * 2);
        transform.y = -15 + (bobHeight * bobProgress); // Stay above entity
        break;

      case 'SPEECH':
        // Static position above entity
        transform.y = -20;
        // Fade in first 10%, fade out last 20%
        if (progress < 0.1) {
          transform.opacity = progress / 0.1;
        } else if (progress > 0.8) {
          transform.opacity = 1.0 - ((progress - 0.8) / 0.2);
        }
        break;
    }

    return transform;
  }

  // Public API
  return {
    init: init,
    showCurrencyPickup: showCurrencyPickup,
    showExpression: showExpression,
    showStatus: showStatus,
    showSpeech: showSpeech,
    clearAnimation: clearAnimation,
    clearAll: clearAll,
    update: update,
    getAnimationAt: getAnimationAt,
    getAllAnimations: getAllAnimations,
    calculateAnimationTransform: calculateAnimationTransform,
    EXPRESSIONS: EXPRESSIONS,
    ANIMATION_TYPES: ANIMATION_TYPES
  };
})();
