/* ============================================================
   EYES ONLY - Stack System Integration Example
   Example showing how to integrate stack system into game
   ============================================================ */

/**
 * INTEGRATION GUIDE: Z-Axis Stacking System
 *
 * NOTE: PancakeStack/PlayerStackManager remain the primary, reliable
 * overhead feedback for collectibles. OverheadAnimator text popups are
 * only guaranteed for currency collection and door/gate lock indicators;
 * do not rely on transient overhead text for other pickups.
 *
 * This file demonstrates how to integrate the player stack system
 * into the main Gone Rogue game loop.
 */

// ============================================================
// STEP 1: Initialize Stack Manager in Game Setup
// ============================================================

// In gone-rogue.js, add to initialization section:
var _playerStack = null; // Global stack manager

function _initializeGame() {
  // ... existing initialization code ...

  // Initialize player stack (choose appropriate type)
  if (typeof PancakeStack !== 'undefined') {
    _playerStack = new PancakeStack(_player);
  } else if (typeof PlayerStackManager !== 'undefined') {
    _playerStack = new PlayerStackManager(_player);
  }

  console.log('[GoneRogue] Player stack initialized');
}

// ============================================================
// STEP 2: Add Collectible Items to Game
// ============================================================

// Add pancake items to floor generation:
function _spawnCollectibles() {
  // Spawn pancakes on floor
  for (var i = 0; i < 3; i++) {
    var pos = _findEmptyFloorTile();
    if (pos) {
      _items.push({
        id: 'pancake_' + Date.now() + '_' + i,
        type: 'pancake',
        x: pos.x,
        y: pos.y,
        emoji: '🥞',
        collectible: true
      });
    }
  }
}

// ============================================================
// STEP 3: Handle Collection on Player Movement
// ============================================================

// In player movement function:
function _movePlayer(dx, dy) {
  var newX = _player.x + dx;
  var newY = _player.y + dy;

  // ... existing movement validation ...

  // Check for collectible items at new position
  _checkCollectibles(newX, newY);

  _player.x = newX;
  _player.y = newY;
}

function _checkCollectibles(x, y) {
  // Find items at this position
  for (var i = _items.length - 1; i >= 0; i--) {
    var item = _items[i];

    if (item.x === x && item.y === y && item.collectible) {
      // Collect the item
      _collectItem(item);
      _items.splice(i, 1);
    }
  }
}

function _collectItem(item) {
  if (!_playerStack) return;

  // Add to stack based on type
  if (item.type === 'pancake') {
    _playerStack.addPancake(item);
  } else {
    _playerStack.addToStack(item);
  }

  console.log('[GoneRogue] Collected:', item.emoji);
}

// ============================================================
// STEP 4: Update Stack in Game Loop
// ============================================================

// In main game loop update function:
function _updateGameState() {
  var currentTime = Date.now();

  // ... existing game state updates ...

  // Update player stack animations
  if (_playerStack) {
    _playerStack.update(currentTime);
  }
}

// ============================================================
// STEP 5: Render Stack in Canvas System
// ============================================================

// If using canvas renderer (gone-rogue-canvas.js):
CanvasRenderer.prototype.renderGrid = function(renderData) {
  // ... existing rendering code ...

  this._renderTiles(renderData.grid);
  this._renderLighting(renderData.grid);
  this._renderEntities(renderData.entities);
  this._renderPets(renderData.pets);
  this._renderPlayer(renderData.player);

  // NEW: Render player stack
  this._renderPlayerStack(renderData.player, renderData.playerStack);

  this._renderEffects(renderData.effects);
};

CanvasRenderer.prototype._renderPlayerStack = function(player, stackManager) {
  if (!player || !stackManager) return;

  var screenX = player.x * this.cellSize + this.cellSize / 2;
  var screenY = player.y * this.cellSize + this.cellSize / 2;

  stackManager.render(this.ctx, { x: screenX, y: screenY }, { x: 0, y: 0 });
};

// ============================================================
// STEP 6: Initialize UI Counter in HUD
// ============================================================

// In game initialization, after DOM is ready:
function _initializeHUD() {
  // ... existing HUD setup ...

  // Create stack counter container
  var stackContainer = document.createElement('div');
  stackContainer.id = 'player-stack-counter';
  stackContainer.style.position = 'absolute';
  stackContainer.style.top = '10px';
  stackContainer.style.right = '10px';
  stackContainer.style.zIndex = '1000';

  document.body.appendChild(stackContainer);

  // Initialize stack counter
  if (typeof StackUICounter !== 'undefined' && _playerStack) {
    window._stackUIUpdate = StackUICounter.initialize(_playerStack, '#player-stack-counter');
  }
}

// Update stack counter whenever stack changes:
function _collectItem(item) {
  if (!_playerStack) return;

  if (item.type === 'pancake') {
    _playerStack.addPancake(item);
  } else {
    _playerStack.addToStack(item);
  }

  // Update UI
  if (window._stackUIUpdate) {
    window._stackUIUpdate();
  }
}

// ============================================================
// STEP 7: Save/Load Stack with Game State
// ============================================================

function _saveGameState() {
  var state = {
    // ... existing save data ...
    playerStack: _playerStack ? _playerStack.getStack().map(function(s) {
      return {
        item: s.item,
        emoji: s.emoji,
        layer: s.layer
      };
    }) : []
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function _loadGameState() {
  var state = JSON.parse(localStorage.getItem(STORAGE_KEY));

  if (state && state.playerStack) {
    // Restore stack
    _playerStack.clearStack();
    state.playerStack.forEach(function(stackItem) {
      if (stackItem.emoji === '🥞') {
        _playerStack.addPancake(stackItem.item);
      } else {
        _playerStack.addToStack(stackItem.item);
      }
    });

    // Update UI
    if (window._stackUIUpdate) {
      window._stackUIUpdate();
    }
  }
}

// ============================================================
// STEP 8: Handle Stack on Death/Floor Change
// ============================================================

function _handlePlayerDeath() {
  // ... existing death handling ...

  // Optionally clear stack on death
  if (_playerStack) {
    _playerStack.clearStack();
    if (window._stackUIUpdate) {
      window._stackUIUpdate();
    }
  }
}

function _generateFloor(floorNum) {
  // ... existing floor generation ...

  // Stack persists across floors, or clear if desired
  // _playerStack.clearStack(); // Uncomment to clear on floor change
}

// ============================================================
// USAGE EXAMPLE: Complete Integration
// ============================================================

/*
HTML SCRIPT LOADING ORDER:

<script src="js/player-stack-manager.js"></script>
<script src="js/pancake-stack.js"></script>
<script src="js/stack-ui-counter.js"></script>
<script src="js/gone-rogue.js"></script>

Then in gone-rogue.js initialization:
1. Create _playerStack = new PancakeStack(_player)
2. Call _initializeHUD() to setup UI counter
3. Add _spawnCollectibles() to floor generation
4. Update _movePlayer() to check collectibles
5. Add stack update to game loop
6. Add stack render to canvas renderer

Result:
- Pancakes appear on floor
- Player walks over them to collect
- Stack grows above player's head with animation
- UI counter shows stack count in corner
- Stack persists across saves/loads
*/
