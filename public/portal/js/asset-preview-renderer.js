/* ============================================================
   EYES ONLY - Asset Preview Renderer
   Renders asset previews with proper layering and effects
   ============================================================ */

const AssetPreviewRenderer = (function() {
  'use strict';

  /**
   * Render asset preview on canvas
   * @param {Object} asset - Asset definition
   * @param {HTMLCanvasElement} canvas - Target canvas
   * @param {Object} options - Rendering options
   */
  function render(asset, canvas, options) {
    options = options || {};

    var ctx = canvas.getContext('2d');
    var tileSize = options.tileSize || 48;
    var centerX = canvas.width / 2;
    var centerY = canvas.height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render background tile if specified
    if (options.backgroundTile) {
      renderTileBackground(ctx, options.backgroundTile, centerX, centerY, tileSize);
    }

    // Sort emoji by layer then Y offset for depth
    var sortedEmojis = asset.emojiSet.slice().sort(function(a, b) {
      var layerOrder = { base: 0, surface: 1, floating: 2, shadow: -1 };
      return (layerOrder[a.layer] || 0) - (layerOrder[b.layer] || 0) ||
             (a.offsetY + (a.scale * 24)) - (b.offsetY + (b.scale * 24));
    });

    // Render each emoji
    sortedEmojis.forEach(function(emojiObj) {
      var x = centerX + emojiObj.offsetX;
      var y = centerY + emojiObj.offsetY;
      var size = tileSize * emojiObj.scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((emojiObj.rotation || 0) * Math.PI / 180);

      // Draw shadow if configured
      if (asset.renderConfig && asset.renderConfig.shadows) {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      // Draw emoji
      ctx.font = size + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emojiObj.emoji, 0, 0);

      ctx.restore();
    });

    // Render grid overlay if enabled
    if (options.showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(centerX - tileSize/2, centerY - tileSize/2, tileSize, tileSize);
    }
  }

  function renderTileBackground(ctx, tileType, x, y, size) {
    ctx.fillStyle = '#2d2d44';
    ctx.fillRect(x - size/2, y - size/2, size, size);
  }

  return {
    render: render
  };
})();
