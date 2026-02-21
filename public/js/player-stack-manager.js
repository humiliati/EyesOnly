/* ============================================================
   EYES ONLY - Player Stack Manager
   Z-axis stacking system for collectible items above player head
   ============================================================ */

const PlayerStackManager = (function() {
  'use strict';

  /**
   * PlayerStackManager class - Base class for stackable items
   * @param {Object} player - Player object reference
   */
  function PlayerStackManager(player) {
    this.player = player;
    this.stack = []; // Array of { item, collectedAt, offset, emoji, layer, etc. }
    this.maxStackHeight = 12;
    this.wobbleIntensity = 2;
    this.currentTime = 0;
  }

  /**
   * Add item to stack
   * @param {Object} item - Item to add
   */
  PlayerStackManager.prototype.addToStack = function(item) {
    if (this.stack.length >= this.maxStackHeight) {
      // Convert oldest to particles when overflow
      this.overflowToParticles();
    }

    var stackItem = {
      item: item,
      emoji: item.emoji || '🥞',
      collectedAt: Date.now(),
      // Deterministic offset based on position in stack
      offsetX: Math.sin(this.stack.length * 0.7) * this.wobbleIntensity,
      offsetY: 0,
      layer: this.stack.length,
      bobPhase: Math.random() * Math.PI * 2,
      bobSpeed: 2 + Math.random() * 2,
      currentScale: 0 // For animation
    };

    this.stack.push(stackItem);

    // Trigger pickup animation
    this.playPickupAnimation(stackItem);

    return stackItem;
  };

  /**
   * Remove item from stack
   * @param {Object} item - Item to remove
   * @returns {Object|null} Removed item
   */
  PlayerStackManager.prototype.removeFromStack = function(item) {
    var index = this.stack.findIndex(function(s) {
      return s.item.id === item.id;
    });

    if (index > -1) {
      var removed = this.stack.splice(index, 1)[0];
      this.playRemoveAnimation(removed);
      return removed;
    }

    return null;
  };

  /**
   * Play pickup animation for stack item
   * @param {Object} stackItem - Stack item
   */
  PlayerStackManager.prototype.playPickupAnimation = function(stackItem) {
    var startScale = 0;
    var targetScale = 1;
    var duration = 200;
    var startTime = Date.now();

    var animate = function() {
      var elapsed = Date.now() - startTime;
      var progress = Math.min(elapsed / duration, 1);

      // Ease out back
      var eased = 1 + 2.7 * Math.pow(progress - 1, 3) +
                 1.7 * Math.pow(progress - 1, 2);

      stackItem.currentScale = startScale + (targetScale - startScale) * eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        stackItem.currentScale = targetScale;
      }
    };

    animate();
  };

  /**
   * Play remove animation
   * @param {Object} stackItem - Stack item
   */
  PlayerStackManager.prototype.playRemoveAnimation = function(stackItem) {
    // Simple shrink animation
    console.log('[PlayerStack] Removed item:', stackItem.emoji);
  };

  /**
   * Handle stack overflow - convert to particles
   */
  PlayerStackManager.prototype.overflowToParticles = function() {
    if (this.stack.length > 0) {
      var oldest = this.stack.shift();
      console.log('[PlayerStack] Overflow item to particles:', oldest.emoji);
      // TODO: Create particle effect
    }
  };

  /**
   * Update stack (called each frame)
   * @param {number} currentTime - Current time in ms
   */
  PlayerStackManager.prototype.update = function(currentTime) {
    this.currentTime = currentTime;

    // Update bobbing animation for each stack item
    this.stack.forEach(function(item, index) {
      item.offsetY = Math.sin(
        (currentTime / 1000) * item.bobSpeed + item.bobPhase
      ) * 1.5;
    });
  };

  /**
   * Render stack above player
   * @param {Object} ctx - Canvas context
   * @param {Object} playerPosition - Player position {x, y}
   * @param {Object} cameraOffset - Camera offset {x, y}
   */
  PlayerStackManager.prototype.render = function(ctx, playerPosition, cameraOffset) {
    if (this.stack.length === 0) return;

    var screenX = playerPosition.x - (cameraOffset ? cameraOffset.x : 0);
    var screenY = playerPosition.y - (cameraOffset ? cameraOffset.y : 0);
    var stackBaseY = screenY - 48; // Above player head

    // Render stack from bottom to top (reverse order for proper layering)
    for (var i = this.stack.length - 1; i >= 0; i--) {
      var item = this.stack[i];
      var scale = item.currentScale || 1;
      var size = 24 * scale;

      var x = screenX + item.offsetX;
      var y = stackBaseY - (item.layer * 8) + item.offsetY;

      ctx.save();
      ctx.font = size + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(item.emoji, x, y);

      // Subtle glow on most recent item
      if (i === this.stack.length - 1) {
        ctx.shadowColor = 'rgba(255,200,100,0.5)';
        ctx.shadowBlur = 8;
        ctx.fillText(item.emoji, x, y);
      }

      ctx.restore();
    }
  };

  /**
   * Get stack count
   * @returns {number} Number of items in stack
   */
  PlayerStackManager.prototype.getStackCount = function() {
    return this.stack.length;
  };

  /**
   * Check if player has specific item
   * @param {string} itemId - Item ID
   * @returns {boolean} Has item
   */
  PlayerStackManager.prototype.hasItem = function(itemId) {
    return this.stack.some(function(s) {
      return s.item.id === itemId;
    });
  };

  /**
   * Clear all items from stack
   */
  PlayerStackManager.prototype.clearStack = function() {
    this.stack = [];
  };

  /**
   * Get all items in stack
   * @returns {Array} Stack items
   */
  PlayerStackManager.prototype.getStack = function() {
    return this.stack.slice();
  };

  return PlayerStackManager;
})();

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayerStackManager;
}
