/**
 * CostPrinterSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless)
 * Handles: cost affordability checks against GAMESTATE resources,
 *          and 3D printer duplication logic (drag-triggered).
 *
 * 3D Printer dupe flow:
 *   1. Player toggles printer from active item header → isPrinterArmed() returns true
 *   2. Renderers call getDisplaySuffix(cardDef) → "xN" suffix appended to card name display
 *   3. Player drags a card from backup to hand → CardStateAuthority calls executeDupe()
 *   4. executeDupe() inserts N individual cards into hand, pushes N cards out into backup
 *   5. Printer is consumed after one dupe operation
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
  // Printer helpers (stateless — reads GAMESTATE + registry each call)
  // ------------------------------------------------------------------

  /** @returns {object|null} The printer item definition, or null if no printer is armed. */
  function _getArmedPrinter() {
    try {
      if (typeof GAMESTATE === 'undefined' || !GAMESTATE.getActiveItem) return null;
      var active = GAMESTATE.getActiveItem();
      if (!active || !active.id || !active.meta || !active.meta.toggled) return null;
      if (typeof GoneRogueDataRegistry === 'undefined' || !GoneRogueDataRegistry.getItem) return null;

      var item = GoneRogueDataRegistry.getItem(active.id);
      if (!item || item._missing || !Array.isArray(item.effects)) return null;

      for (var i = 0; i < item.effects.length; i++) {
        if (item.effects[i] && item.effects[i].type === 'printer_3d') return item;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Check if a card is eligible for 3D printer duplication.
   * Eligible = card has ammo or battery costs.
   */
  function _isEligibleCard(cardDef) {
    if (!cardDef || !Array.isArray(cardDef.costs)) return false;
    for (var i = 0; i < cardDef.costs.length; i++) {
      var c = cardDef.costs[i];
      if (c && (c.kind === 'ammo' || c.kind === 'battery')) return true;
    }
    return false;
  }

  var _RARITY_MAP = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

  function _rarityRank(rarity) {
    var r = _RARITY_MAP[String(rarity || 'common').toLowerCase()];
    return isFinite(r) ? r : 0;
  }

  function _rint(a, b) {
    a = Math.floor(a); b = Math.floor(b);
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  // ------------------------------------------------------------------
  // isPrinterArmed — centralized check (use instead of inline checks)
  // ------------------------------------------------------------------
  function isPrinterArmed() {
    return _getArmedPrinter() !== null;
  }

  // ------------------------------------------------------------------
  // getPrinterMultiplier — compute dupe count for a given card
  //
  // Returns { count: N, display: "xN" or "x2.75" }
  //   count  — integer number of individual cards the dupe produces
  //   display — string to show as suffix on card name
  //
  // Logic: quality distance = printerRarityRank - cardRarityRank
  //   d >= 3 → 12-21 copies (low quality printer relative to card: hidden "xX")
  //   d === 2 → 8-16 copies
  //   d === 1 → 4-10 copies
  //   d === 0 → 1-3 copies (high quality match: shows fractional like "x2.75")
  //
  // The "display" value for high-quality (d === 0) printers uses a fractional
  // multiplier (e.g. "x2.75") to indicate the range. For lower quality (d >= 1),
  // the display shows "xX" (hidden quantity — player doesn't know exact count
  // until they drag).
  // ------------------------------------------------------------------
  function getPrinterMultiplier(cardDef) {
    var printer = _getArmedPrinter();
    if (!printer) return null;
    if (!_isEligibleCard(cardDef)) return null;

    var qp = _rarityRank(printer.rarity);
    var qc = _rarityRank(cardDef ? cardDef.rarity : 'common');
    var d = qp - qc;
    if (d < 0) d = 0;

    var count, display;

    if (d >= 3) {
      count = _rint(12, 21);
      display = 'xX';
    } else if (d === 2) {
      count = _rint(8, 16);
      display = 'xX';
    } else if (d === 1) {
      count = _rint(4, 10);
      display = 'xX';
    } else {
      // d === 0: high quality match — show fractional multiplier preview
      count = _rint(1, 3);
      // Show a stable fractional hint: 1→"x1", 2→"x2", 3→"x2.75"
      if (count === 3) display = 'x2.75';
      else display = 'x' + count;
    }

    return { count: count, display: display };
  }

  // ------------------------------------------------------------------
  // getDisplaySuffix — returns suffix string for card name renderers
  //
  // Called by NCH hand/backup renderers, rogue-sidebar, etc.
  // Returns "" if printer is not armed or card is not eligible.
  //
  // Note: This pre-rolls the multiplier for display. The actual dupe
  // count is re-rolled at drag time via executeDupe(). The display
  // is an approximation to convey the dupe tier to the player.
  // ------------------------------------------------------------------
  function getDisplaySuffix(cardDef) {
    var m = getPrinterMultiplier(cardDef);
    return m ? m.display : '';
  }

  // ------------------------------------------------------------------
  // executeDupe — called by CardStateAuthority when a card is dragged
  // from backup to hand while the printer is armed.
  //
  // @param {string} cardId — the card being dragged
  // @param {object} cardDef — hydrated card definition (needs .rarity, .costs)
  // @returns {object|null} { dupeCount, consumed } or null if not applicable
  //
  // The caller (CardStateAuthority.cascadeBackupToHandTop) has already
  // removed the original card from backup. This function:
  //   1. Re-rolls the dupe count (fresh roll, not the display preview)
  //   2. Inserts dupeCount individual { id, qty: 1 } cards into hand[0..N-1]
  //   3. For each insertion that exceeds maxHandSize, pushes oldest hand card
  //      to backup top (same cascade logic as normal)
  //   4. Consumes the printer item
  //   5. Fires tooltip notification
  //
  // In STR combat: the caller should NOT decrement _turnDrawsRemaining
  // for dupe cards — the original draw already counted. However the dupe
  // does count as "drawing more than allotted" which may trigger combat
  // penalties (fatigue, enemy awareness, etc.) — those are handled by
  // the combat engine listening to 'hand:changed' events.
  // ------------------------------------------------------------------
  function executeDupe(cardId, cardDef) {
    var printer = _getArmedPrinter();
    if (!printer) return null;
    if (!_isEligibleCard(cardDef)) return null;

    var qp = _rarityRank(printer.rarity);
    var qc = _rarityRank(cardDef ? cardDef.rarity : 'common');
    var d = qp - qc;
    if (d < 0) d = 0;

    // Fresh roll for actual dupe count
    var n;
    if (d >= 3) n = _rint(12, 21);
    else if (d === 2) n = _rint(8, 16);
    else if (d === 1) n = _rint(4, 10);
    else n = _rint(1, 3);

    // Insert N individual cards into hand with cascade overflow.
    // We use addPrintedCards which inserts individual { id, qty: 1 } entries
    // and overflows to backup when hand is full.
    if (typeof GAMESTATE !== 'undefined' && typeof GAMESTATE.addPrintedCards === 'function') {
      GAMESTATE.addPrintedCards(cardId, n, { preferHand: true });
    }

    // Consume the printer
    if (typeof GAMESTATE !== 'undefined') {
      if (typeof GAMESTATE.consumeActiveItem === 'function') {
        GAMESTATE.consumeActiveItem();
      } else if (typeof GAMESTATE.clearActiveItem === 'function') {
        GAMESTATE.clearActiveItem();
      }
    }

    // Toast
    var emoji = (cardDef && cardDef.emoji) ? cardDef.emoji : '🃏';
    var name = (cardDef && cardDef.name) ? cardDef.name : cardId;
    if (typeof TooltipSystem !== 'undefined' && TooltipSystem.showPersistent) {
      TooltipSystem.showPersistent('🕋 DUPED x' + n + ' ' + emoji + ' ' + name, 1600);
    }

    return { dupeCount: n, consumed: true };
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    canAffordCosts: canAffordCosts,
    isPrinterArmed: isPrinterArmed,
    getPrinterMultiplier: getPrinterMultiplier,
    getDisplaySuffix: getDisplaySuffix,
    executeDupe: executeDupe,

    // Legacy — kept as no-op for any remaining call sites in card-play-system.js.
    // The card-play trigger is replaced by drag-trigger via executeDupe().
    maybeTrigger3dPrinter: function () {}
  };
})();
