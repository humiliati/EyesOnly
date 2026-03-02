/* ============================================================
   Box Deployment System — Extracted from gone-rogue.js
   Deployable hiding boxes: placement, entry/exit, enemy interaction
   ============================================================ */
var BoxDeployment = (function() {
  'use strict';

  // ── Internal state ──
  var _placedBoxes = [];
  var _playerInBox = null;

  // ── Evasion / notice / walk-over chances by quality ──
  var EVASION_CHANCE = {
    common: 0.85,
    uncommon: 0.90,
    rare: 0.95,
    legendary: 1.00
  };
  var WALK_OVER_CHANCE = {
    common: 0.70,
    uncommon: 0.50,
    rare: 0.30,
    legendary: 0.00
  };
  var NOTICE_CHANCE = {
    common: 0.50,
    uncommon: 0.35,
    rare: 0.15,
    legendary: 0.00
  };

  function getBoxAt(x, y) {
    return _placedBoxes.find(function(b) { return b.x === x && b.y === y; }) || null;
  }

  function isValidBoxPlacement(x, y, ctx) {
    if (x < 0 || x >= ctx.GRID_WIDTH || y < 0 || y >= ctx.GRID_HEIGHT) return false;
    if (!ctx.grid[y] || ctx.grid[y][x] === ctx.TILES.WALL) return false;
    if (getBoxAt(x, y)) return false;
    var hasEnemy = ctx.enemies.some(function(e) { return e.x === x && e.y === y && e.hp > 0; });
    if (hasEnemy) return false;
    return true;
  }

  function placeBoxAt(x, y, quality, itemId) {
    var box = {
      id: 'box_' + Date.now() + '_' + x + '_' + y,
      x: x,
      y: y,
      quality: quality || 'common',
      state: 'empty',
      discoveryCount: 0,
      isIdentified: false,
      sourceItemId: itemId,
      placedAtMs: Date.now()
    };
    _placedBoxes.push(box);
    return box;
  }

  function destroyBox(box, ctx) {
    _placedBoxes = _placedBoxes.filter(function(b) { return b.id !== box.id; });
    // Visual feedback
    try {
      if (ctx && ctx.impactEffects) {
        var effect = { x: box.x, y: box.y, type: 'poof', time: Date.now(), char: '\uD83D\uDCA8' };
        ctx.impactEffects.push(effect);
        setTimeout(function() {
          var index = ctx.impactEffects.indexOf(effect);
          if (index > -1) ctx.impactEffects.splice(index, 1);
        }, 320);
      }
    } catch (e0) {}
    if (typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.showExpression(box.x, box.y, 'SURPRISED', 800, '\uD83D\uDCE6\uD83D\uDCA5');
    }
  }

  function playerEnterBox(box, ctx) {
    _playerInBox = box;
    box.state = 'occupied';
    // Sneak-in bonus
    box._sneakBonusActive = false;
    try {
      if (box.placedAtMs && (Date.now() - box.placedAtMs) <= 2000) {
        box._sneakBonusActive = true;
      }
    } catch (e0) {}
    // Transform avatar
    if (typeof GoneRogueEffectInterpreter !== 'undefined') {
      GoneRogueEffectInterpreter.executeEffect({ type: 'avatar_transform', char: '\uD83D\uDCE6' }, { equipping: true });
    }
    if (ctx && ctx.invalidateStealthCache) ctx.invalidateStealthCache();
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showGeneric('\uD83D\uDCE6 Inside box \u2014 stay still', 1600);
    }
  }

  function playerExitBox(reason, ctx) {
    var box = _playerInBox;
    if (!box) return;
    _playerInBox = null;
    box.state = 'empty';
    // Restore avatar
    if (typeof GoneRogueEffectInterpreter !== 'undefined') {
      GoneRogueEffectInterpreter.executeEffect({ type: 'avatar_transform' }, { equipping: false });
    }
    if (ctx && ctx.invalidateStealthCache) ctx.invalidateStealthCache();
    // Legendary boxes survive combat forced exit; all others consumed
    if (reason !== 'legendary_combat') {
      destroyBox(box, ctx);
    }
  }

  function checkEnemyBoxInteraction(enemy, ctx) {
    var box = getBoxAt(enemy.x, enemy.y);
    if (!box) return;

    if (box.state === 'occupied') {
      var evasionChance = EVASION_CHANCE[box.quality] || 0.85;
      if (Math.random() < evasionChance) {
        if (typeof OverheadAnimator !== 'undefined') {
          OverheadAnimator.showExpression(enemy.x, enemy.y, 'QUESTION');
        }
      } else {
        playerExitBox('combat', ctx);
        if (ctx && ctx.enterCombat) {
          ctx.enterCombat(enemy, 'box_discover', null);
        }
      }
    } else if (box.state === 'empty') {
      if (box.quality === 'legendary') return;
      var noticeChance = NOTICE_CHANCE[box.quality] || 0.50;
      if (box._sneakBonusActive) noticeChance = noticeChance * 0.55;
      if (Math.random() < noticeChance) {
        if (typeof OverheadAnimator !== 'undefined') {
          OverheadAnimator.showExpression(enemy.x, enemy.y, 'QUESTION');
        }
        box.discoveryCount = (box.discoveryCount || 0) + 1;
      }
      var walkOverChance = WALK_OVER_CHANCE[box.quality] || 0.70;
      if (Math.random() < walkOverChance) {
        destroyBox(box, ctx);
      }
    }
  }

  // ── State accessors ──
  function getPlayerInBox() { return _playerInBox; }
  function getPlacedBoxes() { return _placedBoxes.slice(); }
  function getEvasionChance() { return EVASION_CHANCE; }

  function reset() {
    _placedBoxes = [];
    _playerInBox = null;
  }

  return {
    getBoxAt: getBoxAt,
    isValidBoxPlacement: isValidBoxPlacement,
    placeBoxAt: placeBoxAt,
    destroyBox: destroyBox,
    playerEnterBox: playerEnterBox,
    playerExitBox: playerExitBox,
    checkEnemyBoxInteraction: checkEnemyBoxInteraction,
    getPlayerInBox: getPlayerInBox,
    getPlacedBoxes: getPlacedBoxes,
    getEvasionChance: getEvasionChance,
    reset: reset
  };
})();
