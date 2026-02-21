/* ============================================================
   EYES ONLY - Pancake Stack
   Pancake-specific stacking behavior with compact rendering
   ============================================================ */

const PancakeStack = (function() {
  'use strict';

  /**
   * PancakeStack extends PlayerStackManager
   * @param {Object} player - Player object reference
   */
  function PancakeStack(player) {
    // Call parent constructor
    PlayerStackManager.call(this, player);

    this.pancakeEmoji = '🥞';
    this.stackColor = '#d4a373'; // Pancake brown
    this.pancakeHeight = 6; // Compact stacking
  }

  // Inherit from PlayerStackManager
  PancakeStack.prototype = Object.create(PlayerStackManager.prototype);
  PancakeStack.prototype.constructor = PancakeStack;

  /**
   * Add pancake to stack
   * @param {Object} pancakeItem - Pancake item
   */
  PancakeStack.prototype.addPancake = function(pancakeItem) {
    // Pancakes always use pancake emoji regardless of source
    var stackItem = {
      item: pancakeItem,
      emoji: this.pancakeEmoji,
      collectedAt: Date.now(),
      // Pancakes stack more tightly with slight rotation variance
      offsetX: Math.sin(this.stack.length * 1.2) * 1.5,
      offsetY: 0,
      layer: this.stack.length,
      bobPhase: Math.random() * Math.PI * 2,
      bobSpeed: 1.5 + Math.random(), // Slower, heavier bob
      currentScale: 0, // For animation
      rotation: Math.sin(this.stack.length * 0.5) * 0.1 // Slight rotation
    };

    this.stack.push(stackItem);

    // Trigger pickup animation
    this.playPickupAnimation(stackItem);

    // Play sound
    this.playPancakeStackSound();

    return stackItem;
  };

  /**
   * Play pancake stack sound
   */
  PancakeStack.prototype.playPancakeStackSound = function() {
    // TODO: Integrate with AudioManager when available
    console.log('[PancakeStack] Stack sound played');
  };

  /**
   * Render pancake stack with compact, realistic stacking
   * @param {Object} ctx - Canvas context
   * @param {Object} playerPosition - Player position {x, y}
   * @param {Object} cameraOffset - Camera offset {x, y}
   */
  PancakeStack.prototype.renderPancakeStack = function(ctx, playerPosition, cameraOffset) {
    if (this.stack.length === 0) return;

    var screenX = playerPosition.x - (cameraOffset ? cameraOffset.x : 0);
    var screenY = playerPosition.y - (cameraOffset ? cameraOffset.y : 0);

    // Pancakes stack very compactly
    var baseY = screenY - 52;

    for (var i = this.stack.length - 1; i >= 0; i--) {
      var item = this.stack[i];
      var scale = item.currentScale || 1;
      var size = 28 * scale;

      // Slight rotation for realism
      var rotation = item.rotation || 0;

      // Slight spiral pattern
      var x = screenX + (i % 3) * 2;
      var y = baseY - (i * this.pancakeHeight) + item.offsetY;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      // Draw pancake shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(2, 2, size/2, size/4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw pancake
      ctx.font = size + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.pancakeEmoji, 0, 0);

      // Syrup highlight on topmost pancake
      if (i === this.stack.length - 1) {
        ctx.shadowColor = 'rgba(255,180,80,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillText(this.pancakeEmoji, 0, 0);
      }

      ctx.restore();
    }
  };

  /**
   * Override render to use pancake-specific rendering
   */
  PancakeStack.prototype.render = function(ctx, playerPosition, cameraOffset) {
    this.renderPancakeStack(ctx, playerPosition, cameraOffset);
  };

  return PancakeStack;
})();

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PancakeStack;
}
