/* ============================================================
   EYES ONLY - Pancake Stack (Singleton)
   Thin wrapper around PlayerStackManager.
   Callers use PancakeStack.addPancake(emoji) — delegates to the
   shared PlayerStackManager singleton for state & rendering.
   ============================================================ */

const PancakeStack = (function() {
  'use strict';

  /**
   * Add a pancake emoji to the visual stack above the player.
   * @param {string|object} emojiOrItem - Emoji string or { emoji }
   */
  function addPancake(emojiOrItem) {
    if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.addPancake) {
      return PlayerStackManager.addPancake(emojiOrItem);
    }
    console.warn('[PancakeStack] PlayerStackManager not available');
  }

  function update(now) {
    if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.update) {
      PlayerStackManager.update(now);
    }
  }

  function render(ctx, screenX, screenY, cellSize) {
    if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.render) {
      PlayerStackManager.render(ctx, screenX, screenY, cellSize);
    }
  }

  function getStackCount() {
    return (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.getStackCount)
      ? PlayerStackManager.getStackCount() : 0;
  }

  function clearStack() {
    if (typeof PlayerStackManager !== 'undefined' && PlayerStackManager.clearStack) {
      PlayerStackManager.clearStack();
    }
  }

  return {
    addPancake: addPancake,
    update: update,
    render: render,
    getStackCount: getStackCount,
    clearStack: clearStack
  };
})();

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PancakeStack;
}
