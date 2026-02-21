/* ============================================================
   EYES ONLY - Density Tester
   Tests asset density and placement across multiple tiles
   ============================================================ */

const DensityTester = (function() {
  'use strict';

  /**
   * Render density test
   * @param {Object} asset - Asset definition
   * @param {HTMLCanvasElement} canvas - Target canvas
   * @param {Object} options - Test options
   */
  function render(asset, canvas, options) {
    options = options || {};

    var ctx = canvas.getContext('2d');
    var tileSize = 32;
    var cols = Math.floor(canvas.width / tileSize);
    var rows = Math.floor(canvas.height / tileSize);
    var baseSeed = options.seed || Date.now();

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render grid of tiles with asset placement
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var tileX = x * tileSize;
        var tileY = y * tileSize;
        var tileSeed = baseSeed + x + (y * cols);

        // Determine if asset placed here
        var shouldPlace = determineAssetPlacement(asset, x, y, tileSeed, options);

        if (shouldPlace) {
          // Render floor tile
          ctx.fillStyle = '#2d2d44';
          ctx.fillRect(tileX, tileY, tileSize, tileSize);

          // Render asset
          renderAssetAtTile(asset, ctx, tileX, tileY, tileSize, tileSeed);
        } else {
          // Empty floor
          ctx.fillStyle = '#1e1e2e';
          ctx.fillRect(tileX, tileY, tileSize, tileSize);
        }

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.strokeRect(tileX, tileY, tileSize, tileSize);
      }
    }

    // Overlay density info
    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.fillText('Seed: ' + baseSeed, 10, 20);
    ctx.fillText('Density: ' + ((options.density || 0.3) * 100).toFixed(0) + '%', 10, 35);
    ctx.fillText('Scatter: ' + ((options.scatter || 0.4) * 100).toFixed(0) + '%', 10, 50);
  }

  function determineAssetPlacement(asset, x, y, seed, options) {
    // Simple random placement based on density
    var random = seededRandom(seed);
    var density = options.density || asset.densityConfig.baseDensity;
    return random < density;
  }

  function renderAssetAtTile(asset, ctx, x, y, tileSize, seed) {
    var centerX = x + tileSize / 2;
    var centerY = y + tileSize / 2;

    asset.emojiSet.forEach(function(emoji) {
      var size = tileSize * emoji.scale * 0.7; // Smaller for density view
      ctx.font = size + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji.emoji, centerX + emoji.offsetX * 0.3, centerY + emoji.offsetY * 0.3);
    });
  }

  function seededRandom(seed) {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  return {
    render: render
  };
})();
