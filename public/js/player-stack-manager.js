/* ============================================================
   EYES ONLY - Player Stack Manager (Singleton)
   Z-axis stacking system for collectible items above player head.
   Called as PlayerStackManager.addPancake(emoji) from pickup code.
   ============================================================ */

const PlayerStackManager = (function() {
  'use strict';

  // ---- internal state ----
  var _stack = [];          // Array of { emoji, collectedAt, offsetX, offsetY, layer, bobPhase, bobSpeed, currentScale, rotation }
  var _maxStackHeight = 12;
  var _wobbleIntensity = 2;
  var _decayMs = 4000;      // Items fade and drop off the stack after this many ms

  // ---- helpers ----

  function _playPickupAnimation(stackItem) {
    var targetScale = 1;
    var duration = 200;
    var startTime = Date.now();

    var animate = function() {
      var elapsed = Date.now() - startTime;
      var progress = Math.min(elapsed / duration, 1);

      // Ease-out-back
      var eased = 1 + 2.7 * Math.pow(progress - 1, 3) +
                 1.7 * Math.pow(progress - 1, 2);

      stackItem.currentScale = targetScale * eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        stackItem.currentScale = targetScale;
      }
    };

    animate();
  }

  function _overflowOldest() {
    if (_stack.length > 0) {
      _stack.shift();
    }
  }

  // ---- public API ----

  /**
   * Add an emoji (or item object with .emoji) to the visual stack.
   * Accepts a string emoji or an object with an emoji property.
   */
  function addPancake(emojiOrItem) {
    if (_stack.length >= _maxStackHeight) {
      _overflowOldest();
    }

    var emoji = (typeof emojiOrItem === 'string') ? emojiOrItem : ((emojiOrItem && emojiOrItem.emoji) ? emojiOrItem.emoji : '🥞');

    var stackItem = {
      emoji: emoji,
      collectedAt: Date.now(),
      offsetX: Math.sin(_stack.length * 1.2) * _wobbleIntensity,
      offsetY: 0,
      layer: _stack.length,
      bobPhase: Math.random() * Math.PI * 2,
      bobSpeed: 1.5 + Math.random(),
      currentScale: 0,
      rotation: Math.sin(_stack.length * 0.5) * 0.1
    };

    _stack.push(stackItem);
    _playPickupAnimation(stackItem);

    return stackItem;
  }

  /**
   * Update bobbing & decay (call once per frame).
   * @param {number} now - Date.now() or performance.now()
   */
  function update(now) {
    if (!now) now = Date.now();

    // Decay old items
    var cutoff = now - _decayMs;
    while (_stack.length > 0 && _stack[0].collectedAt < cutoff) {
      _stack.shift();
    }

    // Re-index layers after decay
    for (var i = 0; i < _stack.length; i++) {
      _stack[i].layer = i;
      _stack[i].offsetY = Math.sin((now / 1000) * _stack[i].bobSpeed + _stack[i].bobPhase) * 1.5;
    }
  }

  /**
   * Render the stack as emoji above a given screen position.
   * Works in both canvas-native and effects-array pipelines.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} screenX  - center X of player in canvas px
   * @param {number} screenY  - center Y of player in canvas px
   * @param {number} cellSize - size of a grid cell in canvas px
   */
  function render(ctx, screenX, screenY, cellSize) {
    if (_stack.length === 0) return;

    var pancakeHeight = 6;
    var baseY = screenY - (cellSize * 2.4); // Above player head

    // Draw single ground shadow below the stack with fade-in/out tied to stack lifecycle
    // Using consistent ellipse shadow technique (matches player/entity shadows)
    var now = Date.now();
    var newestAge = now - _stack[_stack.length - 1].collectedAt;
    var fadeIn = Math.min(1, newestAge / 300); // fade in over 300ms on new pickup
    var oldestAge = now - _stack[0].collectedAt;
    var fadeOut = Math.max(0, 1 - Math.max(0, oldestAge - (_decayMs - 600)) / 600); // fade out in last 600ms
    var shadowOpacity = 0.35 * fadeIn * fadeOut; // Match player shadow base opacity
    if (shadowOpacity > 0.005) {
      ctx.save();
      ctx.globalAlpha = shadowOpacity;
      ctx.shadowBlur = 0; // Ensure no blur for flat ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      // Use consistent Y offset: screenY already includes (player.y + 0.5) * cellSize,
      // so adding 0.28 * cellSize gives (player.y + 0.78) * cellSize total
      ctx.ellipse(screenX, screenY + cellSize * 0.28, cellSize * 0.38, cellSize * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (var i = _stack.length - 1; i >= 0; i--) {
      var item = _stack[i];
      var scale = item.currentScale || 1;
      var size = Math.max(8, Math.floor(cellSize * 1.2 * scale));

      var x = screenX + (i % 3) * 2 + item.offsetX;
      var y = baseY - (i * pancakeHeight) + item.offsetY;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(item.rotation || 0);

      // Emoji
      ctx.font = size + 'px system-ui, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(item.emoji, 0, 0);

      // Glow on newest item
      if (i === _stack.length - 1) {
        ctx.shadowColor = 'rgba(255,180,80,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillText(item.emoji, 0, 0);
      }

      ctx.restore();
    }
  }

  /**
   * Return the full stack (for external inspection / serialization).
   */
  function getStack() { return _stack.slice(); }
  function getStackCount() { return _stack.length; }
  function clearStack() { _stack = []; }

  // ---- module ----
  return {
    addPancake: addPancake,
    addToStack: addPancake,  // alias for legacy callers
    update: update,
    render: render,
    getStack: getStack,
    getStackCount: getStackCount,
    clearStack: clearStack
  };
})();

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayerStackManager;
}
