/**
 * NpcGateSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless — npcs/tileMetadata passed via ctx)
 * Handles: NPC lookup by ID, gate zone cleanup, NPC gate combat
 *          initiation (proxy enemy creation), and nearby door hints.
 *
 * Loaded before gone-rogue.js via <script> tag.
 */
var NpcGateSystem = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // getNpcById — linear scan of npcs array
  // ------------------------------------------------------------------
  function getNpcById(npcId, ctx) {
    for (var i = 0; i < ctx.npcs.length; i++) {
      if (ctx.npcs[i].id === npcId) return ctx.npcs[i];
    }
    return null;
  }

  // ------------------------------------------------------------------
  // clearNpcGateZones — remove warning/trigger tiles for an NPC
  // ------------------------------------------------------------------
  function clearNpcGateZones(npcId, ctx) {
    for (var k in ctx.tileMetadata) {
      if (!ctx.tileMetadata.hasOwnProperty(k)) continue;
      var md = ctx.tileMetadata[k];
      if (md && (md.type === 'npc_gate_warning' || md.type === 'npc_gate_trigger') && md.npcId === npcId) {
        delete ctx.tileMetadata[k];
      }
    }
  }

  // ------------------------------------------------------------------
  // startNpcGateCombat — create enemy proxy from NPC and enter combat
  // ------------------------------------------------------------------
  function startNpcGateCombat(npc, ctx) {
    if (!npc) return;

    // Combat initialize
    ctx.npcShowEmoji(npc, '🥊', 900);

    // Print dialogue (avoid spam — check turn gap)
    if (ctx.turn - (npc.state.lastTalkTurn || 0) > 6) {
      npc.state.lastTalkTurn = ctx.turn;
      if (npc.dialogues && npc.dialogues.length) {
        ctx.npcSay(npc, npc.dialogues[0]);
      } else {
        ctx.npcSay(npc, npc.emoji + ' ' + npc.name + ': Spar?');
      }
    }

    // Create a combat proxy using enemy-shaped stats
    var enemy = {
      x: npc.x,
      y: npc.y,
      emoji: npc.emoji,
      name: npc.name,
      hp: 18,
      maxHp: 18,
      str: 4,
      dex: 2,
      initiative: 0,
      awareness: 0,
      orientation: npc.direction || 'south',
      sightRange: 0,
      dead: false,
      isTreasureGoblin: false,
      _npcGateId: npc.id,
      _npcGateType: (npc.gate && npc.gate.type) ? npc.gate.type : 'friendly'
    };

    ctx.enterStrCombat(enemy, 'collision');
  }

  // ------------------------------------------------------------------
  // maybeHintNearbyDoors — show overhead emoji hints near doors
  // ------------------------------------------------------------------
  function maybeHintNearbyDoors(ctx) {
    try {
      if (typeof OverheadAnimator === 'undefined') return;
      var now = Date.now();
      if (now - ctx.lastDoorHintAtMs < 350) return;

      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) {
          var x = ctx.player.x + dx;
          var y = ctx.player.y + dy;
          if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) continue;

          var tile = ctx.grid[y] ? ctx.grid[y][x] : null;
          if (tile !== ctx.TILES.EXIT && tile !== ctx.TILES.DOOR) continue;

          var md = ctx.tileMetadata[x + ',' + y];
          var kind = null;
          if (md && md.type === 'door') {
            kind = md.doorKind;
          } else if (md && md.type === 'building_door') {
            kind = 'building';
          } else if (tile === ctx.TILES.EXIT) {
            kind = 'forward';
          }
          if (!kind) continue;

          var emoji = (kind === 'building') ? '↔️' :
                      (kind === 'back') ? '↩️' :
                      (kind === 'forward') ? '↪️' :
                      (kind === 'interior_exit') ? '↩️' : '↕️';
          OverheadAnimator.showGenericExpression(x, y, emoji, 650);
          ctx.lastDoorHintAtMs = now;
          return;
        }
      }
    } catch (e0) { /* visual only */ }
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    getNpcById: getNpcById,
    clearNpcGateZones: clearNpcGateZones,
    startNpcGateCombat: startNpcGateCombat,
    maybeHintNearbyDoors: maybeHintNearbyDoors
  };
})();
