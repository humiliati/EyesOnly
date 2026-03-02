/**
 * VendorSystem — Extracted from gone-rogue.js (Phase 8)
 * Bonfire vendor, shop, healing, and gambling.
 * Owns vendor state (_vendor, _vendorInventory).
 */
var VendorSystem = (function() {
  'use strict';

  // ── Owned state ──
  var _vendor = null;
  var _vendorInventory = [];

  // ── Helpers ──

  /**
   * Initialize vendor with random type and 5-card inventory.
   * ctx: { rng, VENDOR_TYPES }
   */
  function initializeVendor(ctx) {
    var vendorTypes = Object.keys(ctx.VENDOR_TYPES);
    var randomType = vendorTypes[Math.floor(ctx.rng() * vendorTypes.length)];
    _vendor = ctx.VENDOR_TYPES[randomType];

    _vendorInventory = [];
    for (var i = 0; i < 5; i++) {
      if (typeof CardSystem !== 'undefined') {
        var baseType = CardSystem.getRandomBaseCard();
        var card = CardSystem.rollCard(baseType);
        var basePrice = 50 + Math.floor((card.quality / 100) * 150);
        var price = Math.floor(basePrice * _vendor.priceMultiplier);
        _vendorInventory.push({ card: card, price: price });
      }
    }
  }

  /**
   * Show vendor shop UI.
   * ctx: { floor, rng, VENDOR_TYPES, getFloorType, FLOOR_TYPES, renderGrid, getPrompt }
   */
  function showVendor(ctx) {
    var floorType = ctx.getFloorType(ctx.floor);
    if (floorType !== ctx.FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO VENDOR HERE', 'Vendors only appear at bonfire floors (10, 16, 22)', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    if (!_vendor) initializeVendor(ctx);

    var lines = [
      '',
      '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550',
      '  \uD83D\uDD25 BONFIRE VENDOR \uD83D\uDD25',
      '  ' + _vendor.emoji + ' ' + _vendor.name,
      '  ' + _vendor.description,
      '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550',
      ''
    ];

    if (typeof GAMESTATE !== 'undefined') {
      var cryptos = GAMESTATE.getState().cryptos || 0;
      lines.push('  YOUR CRYPTOS: \u00A2' + cryptos);
      lines.push('');
    }

    lines.push('VENDOR INVENTORY:');
    _vendorInventory.forEach(function(item, i) {
      lines.push('  ' + (i+1) + '. ' + item.card.emoji + ' ' + item.card.name + ' [' + item.card.qualityName + '] - \u00A2' + item.price);
    });

    lines.push('');
    lines.push('COMMANDS:');
    lines.push('  BUY <number>  - Purchase item');
    lines.push('  HEAL          - Restore 30-50% HP for \u00A230');
    lines.push('  GAMBLE        - Random card roll for \u00A2100');
    lines.push('');

    return { lines: lines, prompt: ctx.getPrompt(), stayActive: true };
  }

  /**
   * Buy item from vendor.
   * ctx: { floor, rng, VENDOR_TYPES, getFloorType, FLOOR_TYPES, getPrompt, saveState }
   */
  function buyFromVendor(cmd, ctx) {
    var floorType = ctx.getFloorType(ctx.floor);
    if (floorType !== ctx.FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO VENDOR HERE', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    if (!_vendor) initializeVendor(ctx);

    var parts = cmd.split(' ');
    var itemNum = parseInt(parts[1]);

    if (isNaN(itemNum) || itemNum < 1 || itemNum > _vendorInventory.length) {
      return {
        lines: ['INVALID ITEM NUMBER', 'Use: BUY <1-' + _vendorInventory.length + '>', ''],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var item = _vendorInventory[itemNum - 1];

    if (typeof GAMESTATE !== 'undefined') {
      var state = GAMESTATE.getState();
      var cryptos = state.cryptos || 0;

      if (cryptos < item.price) {
        return {
          lines: ['INSUFFICIENT FUNDS', 'Need \u00A2' + item.price + ', have \u00A2' + cryptos, ''],
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }

      var result = GAMESTATE.addToLoose(item.card);
      if (!result.success) {
        return {
          lines: [result.message, 'DROP SOMETHING FIRST', ''],
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }

      state.cryptos -= item.price;
      _vendorInventory.splice(itemNum - 1, 1);
      ctx.saveState();

      return {
        lines: ['PURCHASED: ' + item.card.emoji + ' ' + item.card.name, 'Remaining cryptos: \u00A2' + state.cryptos, ''],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    return { lines: ['PURCHASE FAILED', ''], prompt: ctx.getPrompt(), stayActive: true };
  }

  /**
   * Heal at bonfire for 30 cryptos.
   * ctx: { floor, player, rng, getFloorType, FLOOR_TYPES, getPrompt, saveState }
   */
  function healAtBonfire(ctx) {
    var floorType = ctx.getFloorType(ctx.floor);
    if (floorType !== ctx.FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO BONFIRE HERE', 'Healing only available at bonfire floors', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var HEAL_COST = 30;

    if (typeof GAMESTATE !== 'undefined') {
      var state = GAMESTATE.getState();
      var cryptos = state.cryptos || 0;

      if (cryptos < HEAL_COST) {
        return {
          lines: ['INSUFFICIENT FUNDS', 'Healing costs \u00A2' + HEAL_COST + ', have \u00A2' + cryptos, ''],
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }

      var healPercent = 0.3 + ctx.rng() * 0.2;
      var healAmount = Math.floor(ctx.player.maxHp * healPercent);
      var oldHp = ctx.player.hp;
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + healAmount);
      var actualHeal = ctx.player.hp - oldHp;

      state.cryptos -= HEAL_COST;
      ctx.saveState();

      return {
        lines: [
          'HEALED: +' + actualHeal + ' HP',
          'HP: ' + ctx.player.hp + '/' + ctx.player.maxHp,
          'Remaining cryptos: \u00A2' + state.cryptos,
          ''
        ],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    return { lines: ['HEAL FAILED', ''], prompt: ctx.getPrompt(), stayActive: true };
  }

  /**
   * Gamble for a random card at bonfire for 100 cryptos.
   * ctx: { floor, rng, getFloorType, FLOOR_TYPES, getPrompt, saveState, renderGrid }
   */
  function gambleCard(ctx) {
    var floorType = ctx.getFloorType(ctx.floor);
    if (floorType !== ctx.FLOOR_TYPES.BONFIRE) {
      return {
        lines: ['NO VENDOR HERE', 'Gambling only available at bonfire floors', ''].concat(ctx.renderGrid()),
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    var GAMBLE_COST = 100;

    if (typeof GAMESTATE !== 'undefined' && typeof CardSystem !== 'undefined') {
      var state = GAMESTATE.getState();
      var cryptos = state.cryptos || 0;

      if (cryptos < GAMBLE_COST) {
        return {
          lines: ['INSUFFICIENT FUNDS', 'Gambling costs \u00A2' + GAMBLE_COST + ', have \u00A2' + cryptos, ''],
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }

      var rand = ctx.rng() * 100;
      var targetQuality;
      if (rand < 0.2) targetQuality = 97 + ctx.rng() * 3;
      else if (rand < 2) targetQuality = 90 + ctx.rng() * 7;
      else if (rand < 10) targetQuality = 75 + ctx.rng() * 15;
      else if (rand < 30) targetQuality = 55 + ctx.rng() * 20;
      else targetQuality = 30 + ctx.rng() * 25;

      var baseType = CardSystem.getRandomBaseCard();
      var card = CardSystem.rollCard(baseType);

      var result = GAMESTATE.addToLoose(card);
      if (!result.success) {
        return {
          lines: [result.message, 'DROP SOMETHING FIRST', ''],
          prompt: ctx.getPrompt(),
          stayActive: true
        };
      }

      state.cryptos -= GAMBLE_COST;
      ctx.saveState();

      var qualityDesc = card.quality >= 97 ? '\u2728 PERFECT \u2728' :
                       card.quality >= 90 ? '\uD83C\uDF1F NEAR-PERFECT' :
                       card.quality >= 75 ? '\u2B50 STRONG' :
                       card.quality >= 55 ? '\u2022 USABLE' : '\u2022 JUNK';

      return {
        lines: [
          '\uD83C\uDFB2 GAMBLE RESULT:',
          qualityDesc,
          card.emoji + ' ' + card.name + ' [' + card.qualityName + '] (' + Math.floor(card.quality) + '%)',
          'Remaining cryptos: \u00A2' + state.cryptos,
          ''
        ],
        prompt: ctx.getPrompt(),
        stayActive: true
      };
    }

    return { lines: ['GAMBLE FAILED', ''], prompt: ctx.getPrompt(), stayActive: true };
  }

  // ── Public API ──
  return {
    initializeVendor: initializeVendor,
    showVendor: showVendor,
    buyFromVendor: buyFromVendor,
    healAtBonfire: healAtBonfire,
    gambleCard: gambleCard,
    getVendor: function() { return _vendor; },
    getVendorInventory: function() { return _vendorInventory; },
    reset: function() { _vendor = null; _vendorInventory = []; }
  };
})();
