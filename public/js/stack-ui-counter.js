/* ============================================================
   EYES ONLY - Stack UI Counter
   HUD component for displaying player collection stack
   ============================================================ */

const StackUICounter = (function() {
  'use strict';

  /**
   * Render stack counter in HUD
   * @param {Object} stackManager - PlayerStackManager instance
   * @param {HTMLElement} container - Container element
   */
  function renderStackCounter(stackManager, container) {
    if (!stackManager || !container) return;

    var count = stackManager.getStackCount();

    container.innerHTML = `
      <div class="stack-counter ${count > 0 ? 'has-items' : ''}">
        <span class="stack-emoji">🥞</span>
        <span class="stack-count">${count}</span>
        ${count > 0 ? `
          <div class="stack-preview">
            ${renderStackPreview(stackManager, 5)}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render preview of stack items
   * @param {Object} stackManager - PlayerStackManager instance
   * @param {number} maxVisible - Maximum items to show
   * @returns {string} HTML string
   */
  function renderStackPreview(stackManager, maxVisible) {
    maxVisible = maxVisible || 5;
    var stack = stackManager.getStack();
    var visible = stack.slice(-maxVisible);

    return visible.map(function(item, i) {
      var isNewest = i === visible.length - 1;
      return `<div class="preview-item ${isNewest ? 'newest' : ''}">${item.emoji}</div>`;
    }).join('');
  }

  /**
   * Initialize stack counter in DOM
   * @param {Object} stackManager - PlayerStackManager instance
   * @param {string} selector - CSS selector for container
   */
  function initialize(stackManager, selector) {
    var container = document.querySelector(selector);
    if (!container) {
      console.error('[StackUICounter] Container not found:', selector);
      return null;
    }

    // Add CSS if not already present
    if (!document.getElementById('stack-counter-styles')) {
      addStyles();
    }

    // Initial render
    renderStackCounter(stackManager, container);

    // Return update function
    return function() {
      renderStackCounter(stackManager, container);
    };
  }

  /**
   * Add CSS styles for stack counter
   */
  function addStyles() {
    var style = document.createElement('style');
    style.id = 'stack-counter-styles';
    style.textContent = `
      .stack-counter {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: rgba(0,0,0,0.5);
        border-radius: 16px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }

      .stack-counter:hover {
        background: rgba(0,0,0,0.7);
        transform: scale(1.05);
      }

      .stack-emoji {
        font-size: 16px;
      }

      .stack-count {
        font-weight: bold;
        color: #d4a373;
        min-width: 20px;
        text-align: center;
      }

      .stack-preview {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column-reverse;
        gap: 2px;
        padding: 8px;
        background: rgba(0,0,0,0.8);
        border-radius: 8px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        margin-bottom: 8px;
      }

      .stack-counter:hover .stack-preview {
        opacity: 1;
      }

      .preview-item {
        font-size: 20px;
        opacity: 0.6;
        transition: all 0.2s;
      }

      .preview-item.newest {
        opacity: 1;
        transform: scale(1.2);
      }

      .stack-counter.has-items {
        animation: pulse-glow 2s ease-in-out infinite;
      }

      @keyframes pulse-glow {
        0%, 100% {
          box-shadow: 0 0 5px rgba(212, 163, 115, 0.5);
        }
        50% {
          box-shadow: 0 0 15px rgba(212, 163, 115, 0.8);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Public API
  return {
    renderStackCounter: renderStackCounter,
    renderStackPreview: renderStackPreview,
    initialize: initialize,
    addStyles: addStyles
  };
})();

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StackUICounter;
}
