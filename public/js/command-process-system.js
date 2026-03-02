/**
 * CommandProcessSystem — text command dispatcher for keyboard/terminal input.
 * Extracted Phase 19 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var CommandProcessSystem = (function() {
  'use strict';

  /**
   * Process a raw text command from the player.
   * @param {string} raw - The raw input string
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Terminal response { lines, prompt, stayActive }
   */
  function process(raw, ctx) {
    if (!ctx.active) return { lines: ['ROGUE MODE INACTIVE', ''], stayActive: false };

    var cmd = (raw || '').trim().toLowerCase();

    if (!cmd) {
      return { lines: [''], prompt: ctx.getPrompt(), stayActive: true };
    }

    // AGENT commands - check for agent control
    if (cmd.indexOf('agent') === 0) {
      return ctx.handleAgentCommand(cmd);
    }

    // FLEE command during STR combat
    if (cmd === 'flee' && ctx.strCombatActive) {
      // Tooltip: Fleeing combat
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.showAction('flee');
      }
      return ctx.exitStrCombat('fled');
    }

    if (cmd === 'exit' || cmd === 'quit') {
      return ctx.exitRogue(false);
    }

    if (cmd === 'help') {
      return { lines: ctx.helpLines(), prompt: ctx.getPrompt(), stayActive: true };
    }

    if (cmd === 'status' || cmd === 'stats') {
      return { lines: ctx.statusLines(), prompt: ctx.getPrompt(), stayActive: true };
    }

    if (cmd === 'inventory' || cmd === 'inv') {
      return { lines: ctx.inventoryLines(), prompt: ctx.getPrompt(), stayActive: true };
    }

    if (cmd.indexOf('shoot') === 0 || cmd.indexOf('fire') === 0) {
      return ctx.fireProjectile(cmd);
    }

    if (cmd.indexOf('kick') === 0 || cmd.indexOf('boot') === 0) {
      return ctx.kickBreakable(cmd);
    }

    // Movement commands
    if (cmd === 'n' || cmd === 'north' || cmd === 'w') {
      return ctx.movePlayer(0, -1);
    }
    if (cmd === 's' || cmd === 'south' || cmd === 'x') {
      return ctx.movePlayer(0, 1);
    }
    if (cmd === 'e' || cmd === 'east' || cmd === 'd') {
      return ctx.movePlayer(1, 0);
    }
    if (cmd === 'west' || cmd === 'a') {
      return ctx.movePlayer(-1, 0);
    }

    // Action commands
    if (cmd === 'take' || cmd === 'pickup' || cmd === 'get') {
      return ctx.pickupItem();
    }

    if (cmd === 'extract') {
      return ctx.attemptExtract();
    }

    // Interactive item commands
    if (cmd === 'interact' || cmd === 'examine' || cmd === 'read') {
      return ctx.handleInteraction();
    }

    // Theft command (pre-combat)
    if (cmd === 'steal' || cmd === 'pickpocket') {
      return ctx.attemptPickpocket();
    }

    // Bonfire vendor commands
    if (cmd === 'vendor' || cmd === 'shop' || cmd === 'merchant') {
      return ctx.showVendor();
    }

    if (cmd.indexOf('buy') === 0) {
      return ctx.buyFromVendor(cmd);
    }

    if (cmd === 'heal') {
      return ctx.healAtBonfire();
    }

    if (cmd.indexOf('gamble') === 0) {
      return ctx.gambleCard();
    }

    // Inventory transfer commands (bonfire only)
    if (cmd.indexOf('stash') === 0) {
      return ctx.stashCard(cmd);
    }

    if (cmd.indexOf('retrieve') === 0 || cmd.indexOf('withdraw') === 0) {
      return ctx.retrieveCard(cmd);
    }

    // Equip item to active slot
    if (cmd.indexOf('equip') === 0) {
      return ctx.equipItem(cmd);
    }

    // Unequip active item
    if (cmd === 'unequip') {
      return ctx.unequipItem();
    }

    return {
      lines: ['UNKNOWN COMMAND: ' + cmd, 'TYPE HELP FOR COMMANDS', ''],
      prompt: ctx.getPrompt(),
      stayActive: true
    };
  }

  return {
    process: process
  };
})();
