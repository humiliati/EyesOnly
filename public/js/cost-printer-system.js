/**
 * CostPrinterSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless)
 * Handles: cost affordability checks against GAMESTATE resources,
 *          and 3D printer active-item duplication trigger.
 *
 * Loaded before gone-rogue.js via <script> tag.
 */
var CostPrinterSystem = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // canAffordCosts — check ammo/battery/energy/focus against GAMESTATE
  // ------------------------------------------------------------------
  function canAffordCosts(costs) {
    if (!costs || !costs.length) return { canAfford: true, missing: [] };
    if (typeof GAMESTATE === 'undefined') return { canAfford: false, missing: costs.slice() };

    var missing = [];
    for (var i = 0; i < costs.length; i++) {
      var c = costs[i];
      if (!c || !c.kind) continue;
      var need = Number(c.amount || 0);
      if (!isFinite(need) || need <= 0) continue;

      var have = 0;
      if (c.kind === 'ammo' && typeof GAMESTATE.getAmmo === 'function') have = GAMESTATE.getAmmo();
      else if (c.kind === 'battery' && typeof GAMESTATE.getBattery === 'function') have = GAMESTATE.getBattery();
      else if (c.kind === 'energy' && typeof GAMESTATE.getEnergy === 'function') have = GAMESTATE.getEnergy();
      else if (c.kind === 'focus' && typeof GAMESTATE.getFocus === 'function') have = GAMESTATE.getFocus();

      if (have < need) missing.push({ kind: c.kind, amount: need, have: have });
    }

    return { canAfford: missing.length === 0, missing: missing };
  }

  // ------------------------------------------------------------------
  // maybeTrigger3dPrinter — duplicate card via armed 3D printer item
  // ------------------------------------------------------------------
  function maybeTrigger3dPrinter(triggerCardId, triggerCard) {
    try {
      if (typeof GAMESTATE === 'undefined' || !GAMESTATE.getActiveItem) return;
      var active = GAMESTATE.getActiveItem();
      if (!active || !active.id) return;
      if (typeof GoneRogueDataRegistry === 'undefined' || !GoneRogueDataRegistry.getItem) return;

      var item = GoneRogueDataRegistry.getItem(active.id);
      if (!item || item._missing) return;

      // Identify the 3D printer via its effect tag
      var isPrinter = false;
      if (Array.isArray(item.effects)) {
        for (var i = 0; i < item.effects.length; i++) {
          if (item.effects[i] && item.effects[i].type === 'printer_3d') { isPrinter = true; break; }
        }
      }
      if (!isPrinter) return;

      // Must be armed/toggled first
      var armed = !!(active.meta && active.meta.toggled);
      if (!armed) return;

      // Trigger only on ammo/battery spending cards
      var costs = triggerCard && Array.isArray(triggerCard.costs) ? triggerCard.costs : [];
      var spends = false;
      for (var j = 0; j < costs.length; j++) {
        var c = costs[j];
        if (!c || !c.kind) continue;
        if (c.kind === 'ammo' || c.kind === 'battery') { spends = true; break; }
      }
      if (!spends) return;

      // Determine printer quality (rarity)
      var qMap = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
      var qp = qMap[String(item.rarity || 'common').toLowerCase()];
      if (!isFinite(qp)) qp = 0;

      // Choose output quality (biased down)
      var roll = Math.random();
      var qo = 0;
      if (roll < 0.70) qo = 0;
      else if (roll < 0.88) qo = 1;
      else if (roll < 0.96) qo = 2;
      else if (roll < 0.99) qo = 3;
      else qo = 4;
      if (qo > qp) qo = qp;

      // Duplicate the trigger card
      var pick = triggerCard;
      if (!pick || !pick.id) return;

      // Treat output quality as the picked card's rarity
      var qMap2 = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
      qo = qMap2[String(pick.rarity || 'common').toLowerCase()];
      if (!isFinite(qo)) qo = 0;
      if (qo > qp) qo = qp;

      // Determine print count based on quality distance
      var d = qp - qo;
      function rint(a, b) {
        a = Math.floor(a); b = Math.floor(b);
        return a + Math.floor(Math.random() * (b - a + 1));
      }
      var n = 2;
      if (d >= 3) n = rint(12, 21);
      else if (d === 2) n = rint(8, 16);
      else if (d === 1) n = rint(4, 10);
      else n = rint(1, 3);

      // Add printed cards to hand
      if (typeof GAMESTATE.addPrintedCards === 'function') {
        GAMESTATE.addPrintedCards(pick.id, n, { preferHand: true });
      }

      // Consume the printer
      if (typeof GAMESTATE.consumeActiveItem === 'function') {
        GAMESTATE.consumeActiveItem();
      } else if (typeof GAMESTATE.clearActiveItem === 'function') {
        GAMESTATE.clearActiveItem();
      }

      if (typeof TooltipSystem !== 'undefined' && TooltipSystem.showPersistent) {
        TooltipSystem.showPersistent('🕋 DUPED x' + n + ' ' + (pick.emoji || '🃏') + ' ' + (pick.name || pick.id), 1600);
      }
    } catch (e0) {}
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    canAffordCosts: canAffordCosts,
    maybeTrigger3dPrinter: maybeTrigger3dPrinter
  };
})();
