/**
 * CurrencySpawning — Extracted from gone-rogue.js (Phase 6)
 * Currency spawn, post-combat scatter, and magnet auto-collect.
 * Owns magnet throttle state; currency array passed via ctx by reference.
 */
var CurrencySpawning = (function() {
  'use strict';

  // ── Owned state (magnet throttle) ──
  var _magnetLastCollectTime = 0;

  // ── Core: spawn a currency pickup ──

  /**
   * Spawn currency (cryptos) at a location.
   * ctx.currencies is the monolith's _currencies array (by reference).
   */
  function spawnCurrency(x, y, amount, ctx) {
    ctx.currencies.push({
      x: x,
      y: y,
      amount: amount,
      glyph: '\u00A2',
      emoji: '\uD83D\uDCB0',
      spawnTime: Date.now(),
      decayTime: 20000
    });
  }

  // ── Post-combat scatter ──

  /**
   * Scatter post-combat currency/ammo nodes around a defeated enemy.
   * ctx: { grid, rng, currencies }
   * victoryCtx: { lootCurrency, lootAmmo, isBoss }
   */
  function scatterPostCombatNodes(enemy, victoryCtx, ctx) {
    if (!enemy) return;
    var cx = enemy.x || 0;
    var cy = enemy.y || 0;

    // Build currency/ammo nodes to scatter
    var nodeCount = 1;
    var totalValue = (victoryCtx.lootCurrency || 0) + (victoryCtx.lootAmmo || 0) * 2;
    if (totalValue > 30) nodeCount = 2;
    if (totalValue > 80 || victoryCtx.isBoss) nodeCount = 3;

    var pendingNodes = [];

    for (var n = 0; n < nodeCount; n++) {
      if (victoryCtx.lootCurrency > 0) {
        var share = Math.ceil(victoryCtx.lootCurrency / nodeCount);
        pendingNodes.push({
          x: cx, y: cy,
          amount: Math.min(share, victoryCtx.lootCurrency),
          glyph: '\u00A2',
          emoji: '\uD83D\uDCB0',
          spawnTime: Date.now(),
          decayTime: 45000,
          _scattered: true
        });
      }
      if (victoryCtx.lootAmmo > 0 && n === 0) {
        pendingNodes.push({
          x: cx, y: cy,
          amount: victoryCtx.lootAmmo,
          glyph: '\u2041',
          emoji: '\u2041',
          spawnTime: Date.now(),
          decayTime: 45000,
          _scattered: true,
          _isAmmo: true
        });
      }
    }

    if (pendingNodes.length === 0) return;

    // Delegate to LootSpillSystem for scatter if available
    if (typeof LootSpillSystem !== 'undefined') {
      LootSpillSystem.scatterItems(cx, cy, pendingNodes, ctx);
    } else {
      // Legacy fallback: manual scatter
      var dirs = [
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
      ];
      for (var s = dirs.length - 1; s > 0; s--) {
        var j = Math.floor(ctx.rng() * (s + 1));
        var tmp = dirs[s]; dirs[s] = dirs[j]; dirs[j] = tmp;
      }
      for (var i = 0; i < pendingNodes.length; i++) {
        var dir = dirs[i % dirs.length];
        var nx = cx + dir.dx;
        var ny = cy + dir.dy;
        if (ny < 0 || ny >= ctx.grid.length || nx < 0 || nx >= ctx.grid[0].length) { nx = cx; ny = cy; }
        if (ctx.grid[ny] && ctx.grid[ny][nx] === ctx.TILES.WALL) { nx = cx; ny = cy; }
        pendingNodes[i].x = nx;
        pendingNodes[i].y = ny;
      }
    }

    // Place all nodes
    for (var p = 0; p < pendingNodes.length; p++) {
      if (typeof WorldItems !== 'undefined') {
        WorldItems.addCurrency(pendingNodes[p]);
      } else {
        ctx.currencies.push(pendingNodes[p]);
      }
    }
  }

  // ── Magnet auto-collect ──

  /**
   * If player has a Magnet equipped, pull nearby currency/ammo.
   * ctx: { player, currencies, strCombatActive, currencyCollected }
   * Returns updated currencyCollected total (caller assigns back).
   */
  function magnetAutoCollect(now, ctx) {
    if (!ctx.player || ctx.strCombatActive) return ctx.currencyCollected;

    var magnet = null;
    try {
      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getEquippedMagnet) {
        magnet = PassiveItemsSystem.getEquippedMagnet();
      }
    } catch (e) { return ctx.currencyCollected; }
    if (!magnet) return ctx.currencyCollected;

    var interval = magnet.collection_interval_ms || 400;
    if (now - _magnetLastCollectTime < interval) return ctx.currencyCollected;

    var range = magnet.collection_range || 3;
    var px = ctx.player.x;
    var py = ctx.player.y;

    var inRange = [];
    for (var ci = 0; ci < ctx.currencies.length; ci++) {
      var c = ctx.currencies[ci];
      if (!c || c.collected) continue;
      var dx = Math.abs(c.x - px);
      var dy = Math.abs(c.y - py);
      var dist = Math.max(dx, dy);
      if (dist > 0 && dist <= range) {
        inRange.push({ idx: ci, dist: dist, currency: c });
      }
    }

    if (inRange.length === 0) return ctx.currencyCollected;

    inRange.sort(function(a, b) { return a.dist - b.dist; });

    var target = inRange[0];
    var c = target.currency;
    _magnetLastCollectTime = now;

    if (c._isAmmo) {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.addAmmo) {
        GAMESTATE.addAmmo(c.amount);
      }
    } else {
      if (typeof GAMESTATE !== 'undefined') {
        GAMESTATE.addCryptos(c.amount);
      }
      ctx.currencyCollected += c.amount;
    }

    if (typeof OverheadAnimator !== 'undefined') {
      if (c._isAmmo) {
        OverheadAnimator.showGenericExpression(c.x, c.y, '\u2041', 600);
      } else {
        OverheadAnimator.showCurrencyPickup(c.x, c.y, c.amount);
      }
    }

    ctx.player.collectingCurrency = true;
    ctx.player.currencyCollectTime = now;

    // NOTE: No PancakeStack call — single pickup = single OverheadAnimator animation only.
    // PancakeStack activates only when multiple animations need simultaneous display.

    ctx.currencies.splice(target.idx, 1);

    return ctx.currencyCollected;
  }

  // ── Public API ──
  return {
    spawnCurrency: spawnCurrency,
    scatterPostCombatNodes: scatterPostCombatNodes,
    magnetAutoCollect: magnetAutoCollect,
    reset: function() { _magnetLastCollectTime = 0; }
  };
})();
