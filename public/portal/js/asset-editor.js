/* ============================================================
   EYES ONLY - Asset Editor
   Canvas-based emoji composition editor for scene assets
   ============================================================ */

const AssetEditor = (function() {
  'use strict';

  /**
   * AssetEditor class - Main editor controller
   * @param {HTMLCanvasElement} canvas - Preview canvas
   */
  function AssetEditor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.currentAsset = null;
    this.selectedEmoji = null;
    this.dragState = null;
    this.zoom = 1.0;
    this.showGrid = true;
    this.tileSize = 48;

    this.setupInteractions();
    this.loadDefaultAsset();
  }

  /**
   * Load default asset for editing
   */
  AssetEditor.prototype.loadDefaultAsset = function() {
    this.currentAsset = AssetClusterRegistry.get('DESK_CLUSTER_OFFICE');
    if (!this.currentAsset) {
      this.currentAsset = AssetClusterRegistry.createTemplate();
    }
    this.updateUI();
    this.render();
  };

  /**
   * Setup mouse and keyboard interactions
   */
  AssetEditor.prototype.setupInteractions = function() {
    var self = this;

    // Click to select emoji
    this.canvas.addEventListener('click', function(e) {
      var rect = self.canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;

      var clicked = self.findEmojiAt(x, y);
      self.selectEmoji(clicked);
    });

    // Drag to reposition
    this.canvas.addEventListener('mousedown', function(e) {
      if (self.selectedEmoji) {
        var rect = self.canvas.getBoundingClientRect();
        self.dragState = {
          startX: e.clientX - rect.left,
          startY: e.clientY - rect.top,
          emojiStartX: self.selectedEmoji.offsetX,
          emojiStartY: self.selectedEmoji.offsetY
        };
      }
    });

    this.canvas.addEventListener('mousemove', function(e) {
      if (self.dragState && self.selectedEmoji) {
        var rect = self.canvas.getBoundingClientRect();
        var currentX = e.clientX - rect.left;
        var currentY = e.clientY - rect.top;
        var dx = currentX - self.dragState.startX;
        var dy = currentY - self.dragState.startY;

        self.selectedEmoji.offsetX = self.dragState.emojiStartX + dx;
        self.selectedEmoji.offsetY = self.dragState.emojiStartY + dy;
        self.render();
      }
    });

    this.canvas.addEventListener('mouseup', function() {
      self.dragState = null;
    });

    // Scroll to scale
    this.canvas.addEventListener('wheel', function(e) {
      if (self.selectedEmoji) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? -0.05 : 0.05;
        self.selectedEmoji.scale = Math.max(0.1, Math.min(2.0,
          self.selectedEmoji.scale + delta
        ));
        self.updateEmojiProperties();
        self.render();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      self.handleKeydown(e);
    });
  };

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e - Keyboard event
   */
  AssetEditor.prototype.handleKeydown = function(e) {
    // Layer switching (1-9)
    if (e.key >= '1' && e.key <= '9') {
      var layerIndex = parseInt(e.key) - 1;
      if (this.currentAsset && layerIndex < this.currentAsset.emojiSet.length) {
        this.selectedEmoji = this.currentAsset.emojiSet[layerIndex];
        this.updateEmojiProperties();
        this.render();
      }
    }

    // Delete selected
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedEmoji) {
      e.preventDefault();
      this.deleteSelectedEmoji();
    }

    // Duplicate (Ctrl/Cmd + D)
    if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.duplicateSelectedEmoji();
    }
  };

  /**
   * Find emoji at canvas coordinates
   * @param {number} x - Canvas X
   * @param {number} y - Canvas Y
   * @returns {Object|null} Emoji object or null
   */
  AssetEditor.prototype.findEmojiAt = function(x, y) {
    if (!this.currentAsset || !this.currentAsset.emojiSet) return null;

    var centerX = this.canvas.width / 2;
    var centerY = this.canvas.height / 2;

    // Check in reverse order (top to bottom)
    for (var i = this.currentAsset.emojiSet.length - 1; i >= 0; i--) {
      var emoji = this.currentAsset.emojiSet[i];
      var emojiX = centerX + emoji.offsetX;
      var emojiY = centerY + emoji.offsetY;
      var size = this.tileSize * emoji.scale;

      // Simple bounding box check
      if (x >= emojiX - size/2 && x <= emojiX + size/2 &&
          y >= emojiY - size/2 && y <= emojiY + size/2) {
        return emoji;
      }
    }

    return null;
  };

  /**
   * Select an emoji for editing
   * @param {Object|null} emoji - Emoji object
   */
  AssetEditor.prototype.selectEmoji = function(emoji) {
    this.selectedEmoji = emoji;
    this.updateEmojiProperties();
    this.render();
  };

  /**
   * Add emoji to current asset
   * @param {string} emoji - Emoji character
   * @param {Object} options - Options
   * @returns {Object} New emoji object
   */
  AssetEditor.prototype.addEmoji = function(emoji, options) {
    if (!this.currentAsset) {
      this.currentAsset = AssetClusterRegistry.createTemplate();
    }

    options = options || {};

    var newEmoji = {
      emoji: emoji,
      offsetX: options.offsetX || 0,
      offsetY: options.offsetY || 0,
      scale: options.scale || 1.0,
      layer: options.layer || 'base',
      rotation: options.rotation || 0
    };

    this.currentAsset.emojiSet.push(newEmoji);
    this.selectEmoji(newEmoji);
    this.render();

    return newEmoji;
  };

  /**
   * Delete selected emoji
   */
  AssetEditor.prototype.deleteSelectedEmoji = function() {
    if (!this.selectedEmoji || !this.currentAsset) return;

    var index = this.currentAsset.emojiSet.indexOf(this.selectedEmoji);
    if (index > -1) {
      this.currentAsset.emojiSet.splice(index, 1);
      this.selectedEmoji = null;
      this.updateEmojiProperties();
      this.render();
    }
  };

  /**
   * Duplicate selected emoji
   */
  AssetEditor.prototype.duplicateSelectedEmoji = function() {
    if (!this.selectedEmoji) return;

    var duplicate = Object.assign({}, this.selectedEmoji);
    duplicate.offsetX += 10;
    duplicate.offsetY += 10;

    this.currentAsset.emojiSet.push(duplicate);
    this.selectEmoji(duplicate);
    this.render();
  };

  /**
   * Render the canvas preview
   */
  AssetEditor.prototype.render = function() {
    if (!this.canvas || !this.ctx) return;

    var ctx = this.ctx;
    var centerX = this.canvas.width / 2;
    var centerY = this.canvas.height / 2;

    // Clear
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid
    if (this.showGrid) {
      this.renderGrid(ctx, centerX, centerY);
    }

    // Tile background
    this.renderTileBackground(ctx, centerX, centerY);

    // Render asset emojis
    if (this.currentAsset && this.currentAsset.emojiSet) {
      this.renderAsset(ctx, centerX, centerY);
    }

    // Selection indicator
    if (this.selectedEmoji) {
      this.renderSelection(ctx, centerX, centerY);
    }
  };

  /**
   * Render grid overlay
   */
  AssetEditor.prototype.renderGrid = function(ctx, centerX, centerY) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;

    // Grid lines every 10px
    for (var x = 0; x < this.canvas.width; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }

    for (var y = 0; y < this.canvas.height; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }

    // Center cross
    ctx.strokeStyle = 'rgba(255,100,100,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 20, centerY);
    ctx.lineTo(centerX + 20, centerY);
    ctx.moveTo(centerX, centerY - 20);
    ctx.lineTo(centerX, centerY + 20);
    ctx.stroke();
  };

  /**
   * Render tile background
   */
  AssetEditor.prototype.renderTileBackground = function(ctx, centerX, centerY) {
    ctx.fillStyle = '#2d2d44';
    ctx.fillRect(
      centerX - this.tileSize/2,
      centerY - this.tileSize/2,
      this.tileSize,
      this.tileSize
    );

    ctx.strokeStyle = 'rgba(100,200,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      centerX - this.tileSize/2,
      centerY - this.tileSize/2,
      this.tileSize,
      this.tileSize
    );
  };

  /**
   * Render asset emojis
   */
  AssetEditor.prototype.renderAsset = function(ctx, centerX, centerY) {
    var emojis = this.currentAsset.emojiSet;

    // Sort by layer for proper depth
    var sorted = emojis.slice().sort(function(a, b) {
      var layerOrder = { shadow: -1, base: 0, surface: 1, floating: 2 };
      return (layerOrder[a.layer] || 0) - (layerOrder[b.layer] || 0);
    });

    sorted.forEach(function(emoji) {
      var x = centerX + emoji.offsetX;
      var y = centerY + emoji.offsetY;
      var size = this.tileSize * emoji.scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((emoji.rotation || 0) * Math.PI / 180);

      // Shadow
      if (this.currentAsset.renderConfig && this.currentAsset.renderConfig.shadows) {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      // Emoji
      ctx.font = size + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji.emoji, 0, 0);

      ctx.restore();
    }, this);
  };

  /**
   * Render selection indicator
   */
  AssetEditor.prototype.renderSelection = function(ctx, centerX, centerY) {
    if (!this.selectedEmoji) return;

    var x = centerX + this.selectedEmoji.offsetX;
    var y = centerY + this.selectedEmoji.offsetY;
    var size = this.tileSize * this.selectedEmoji.scale;

    ctx.strokeStyle = '#66ff66';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - size/2 - 4, y - size/2 - 4, size + 8, size + 8);
    ctx.setLineDash([]);
  };

  /**
   * Update UI with current asset properties
   */
  AssetEditor.prototype.updateUI = function() {
    if (!this.currentAsset) return;

    // Update properties panel
    var assetId = document.getElementById('asset-id');
    var assetName = document.getElementById('asset-name');
    var assetCategory = document.getElementById('asset-category');
    var validTiles = document.getElementById('valid-tiles');
    var densitySlider = document.getElementById('density-slider');
    var scatterSlider = document.getElementById('scatter-slider');
    var animPlace = document.getElementById('anim-place');
    var shadowsToggle = document.getElementById('shadows-toggle');

    if (assetId) assetId.value = this.currentAsset.id;
    if (assetName) assetName.value = this.currentAsset.name;
    if (assetCategory) assetCategory.value = this.currentAsset.category;
    if (validTiles) validTiles.value = this.currentAsset.validTiles.join(', ');
    if (densitySlider) {
      densitySlider.value = (this.currentAsset.densityConfig.baseDensity * 100).toFixed(0);
      document.getElementById('density-value').textContent = densitySlider.value + '%';
    }
    if (scatterSlider) {
      scatterSlider.value = (this.currentAsset.densityConfig.scatterChance * 100).toFixed(0);
      document.getElementById('scatter-value').textContent = scatterSlider.value + '%';
    }
    if (animPlace) animPlace.value = this.currentAsset.animations.onPlace;
    if (shadowsToggle) shadowsToggle.checked = this.currentAsset.renderConfig.shadows;
  };

  /**
   * Update emoji properties display
   */
  AssetEditor.prototype.updateEmojiProperties = function() {
    var propsDiv = document.getElementById('emoji-properties');
    if (!propsDiv) return;

    if (!this.selectedEmoji) {
      propsDiv.innerHTML = '<p class="hint">Click an emoji on canvas to edit</p>';
      return;
    }

    propsDiv.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong>Emoji:</strong> ${this.selectedEmoji.emoji}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Layer:</strong> ${this.selectedEmoji.layer}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Offset X:</strong> ${this.selectedEmoji.offsetX.toFixed(1)}px
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Offset Y:</strong> ${this.selectedEmoji.offsetY.toFixed(1)}px
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Scale:</strong> ${this.selectedEmoji.scale.toFixed(2)}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Rotation:</strong> ${this.selectedEmoji.rotation || 0}°
      </div>
    `;
  };

  /**
   * Export asset to registry
   */
  AssetEditor.prototype.exportToRegistry = function() {
    if (!this.currentAsset) return;

    // Update asset from UI
    this.currentAsset.id = document.getElementById('asset-id').value;
    this.currentAsset.name = document.getElementById('asset-name').value;
    this.currentAsset.category = document.getElementById('asset-category').value;
    this.currentAsset.validTiles = document.getElementById('valid-tiles').value
      .split(',').map(function(t) { return t.trim(); });

    var densityValue = parseInt(document.getElementById('density-slider').value);
    this.currentAsset.densityConfig.baseDensity = densityValue / 100;

    var scatterValue = parseInt(document.getElementById('scatter-slider').value);
    this.currentAsset.densityConfig.scatterChance = scatterValue / 100;

    this.currentAsset.animations.onPlace = document.getElementById('anim-place').value;
    this.currentAsset.renderConfig.shadows = document.getElementById('shadows-toggle').checked;

    // Save to registry
    AssetClusterRegistry.save(this.currentAsset);

    // Download JSON
    var exportData = JSON.stringify(this.currentAsset, null, 2);
    var blob = new Blob([exportData], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = this.currentAsset.id + '.json';
    a.click();

    alert('Asset exported to registry and downloaded!');
  };

  return AssetEditor;
})();
