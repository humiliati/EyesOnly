/**
 * BiomeGateSystem – IIFE module (Delegate Pattern)
 *
 * Owns: nothing (stateless — runState/breakables/grid passed via ctx)
 * Handles: tutorial gate placement (floor 0), context-aware biome gate
 *          spawning with weighted probability, pity timers, cooldowns,
 *          and soft-lock prevention.
 *
 * Loaded before gone-rogue.js via <script> tag.
 */
var BiomeGateSystem = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // placeTutorialGate — wooden gate + key + pickups on tutorial floor
  // ------------------------------------------------------------------
  function placeTutorialGate(exitX, exitY, ctx) {
    var dx = exitX - ctx.player.x;
    var dy = exitY - ctx.player.y;
    var gateX = Math.floor(ctx.player.x + dx * 0.65);
    var gateY = Math.floor(ctx.player.y + dy * 0.65);

    var minDistFromPlayer = 5;
    var minDistFromExit = 5;
    var validPosition = false;
    var attempts = 0;

    while (!validPosition && attempts < 50) {
      if (ctx.grid[gateY] && ctx.grid[gateY][gateX] === ctx.TILES.EMPTY) {
        var distToPlayer = Math.abs(gateX - ctx.player.x) + Math.abs(gateY - ctx.player.y);
        var distToExit = Math.abs(gateX - exitX) + Math.abs(gateY - exitY);
        if (distToPlayer >= minDistFromPlayer && distToExit >= minDistFromExit) {
          validPosition = true;
        }
      }
      if (!validPosition) {
        gateX = Math.floor(ctx.player.x + dx * (0.5 + ctx.rng() * 0.3));
        gateY = Math.floor(ctx.player.y + dy * (0.5 + ctx.rng() * 0.3));
        gateX = Math.max(2, Math.min(GRID_WIDTH - 3, gateX));
        gateY = Math.max(2, Math.min(GRID_HEIGHT - 3, gateY));
      }
      attempts++;
    }

    var gateBreakable = {
      x: gateX, y: gateY, hp: 2, maxHp: 2,
      glyph: ctx.TILES.BREAKABLE, destroyedGlyph: ctx.TILES.DEBRIS,
      emoji: '🚧', name: 'Wooden Gate',
      tag: 'tutorial_gate', isTutorialGate: true, type: 'WOODEN_GATE'
    };
    ctx.breakables.push(gateBreakable);
    ctx.grid[gateY][gateX] = ctx.TILES.BREAKABLE;

    if (typeof EnvironmentalSynergy !== 'undefined') {
      EnvironmentalSynergy.registerGate({ x: gateX, y: gateY, type: 'WOODEN_GATE' });
    }

    // Spawn key near player
    var keyX = ctx.player.x + (ctx.rng() > 0.5 ? 2 : -2);
    var keyY = ctx.player.y + (ctx.rng() > 0.5 ? 1 : -1);
    if (keyX >= 1 && keyX < GRID_WIDTH - 1 && keyY >= 1 && keyY < GRID_HEIGHT - 1 &&
        ctx.grid[keyY] && ctx.grid[keyY][keyX] === ctx.TILES.EMPTY) {
      if (typeof InteractiveItems !== 'undefined') {
        InteractiveItems.addItem({
          x: keyX, y: keyY, itemId: 'RUSTY_KEY', type: 'key',
          emoji: '🔑', name: 'Rusty Key',
          description: 'An old, rusted key. Might open something...',
          tag: 'tutorial_key'
        });
      }
    }

    // Spawn pickups behind gate
    var pickupX = gateX + Math.sign(dx);
    var pickupY = gateY + Math.sign(dy);
    if (pickupX < 1 || pickupX >= GRID_WIDTH - 1) pickupX = gateX;
    if (pickupY < 1 || pickupY >= GRID_HEIGHT - 1) pickupY = gateY;

    ctx.spawnCurrency(pickupX, pickupY, 50);

    var ammoOffsetX = Math.sign(dx) !== 0 ? Math.sign(dx) : 1;
    var ammoX = pickupX + ammoOffsetX;
    var ammoY = pickupY;
    if (ammoX >= 1 && ammoX < GRID_WIDTH - 1 && ctx.grid[ammoY] && ctx.grid[ammoY][ammoX] === ctx.TILES.EMPTY) {
      var tutAmmo = { x: ammoX, y: ammoY, type: 'ammo', name: 'Ammo Box', emoji: '📦', amount: 10, tag: 'tutorial_ammo' };
      if (typeof WorldItems !== 'undefined') { WorldItems.addItem(tutAmmo); } else { ctx.items.push(tutAmmo); }
    }

    var cardOffsetY = Math.sign(dy) !== 0 ? Math.sign(dy) : 1;
    var cardX = pickupX;
    var cardY = pickupY + cardOffsetY;
    if (cardY >= 1 && cardY < GRID_HEIGHT - 1 && ctx.grid[cardY] && ctx.grid[cardY][cardX] === ctx.TILES.EMPTY) {
      var tutCard = { x: cardX, y: cardY, type: 'card', name: 'Card', emoji: '🃏', tag: 'tutorial_card', cardQuality: 50 };
      if (typeof WorldItems !== 'undefined') { WorldItems.addItem(tutCard); } else { ctx.items.push(tutCard); }
    }
  }

  // ------------------------------------------------------------------
  // placeBiomeGates — context-aware gate spawning with pity/softlock
  // ------------------------------------------------------------------
  function placeBiomeGates(rooms, exitX, exitY, biome, ctx) {
    if (typeof EnvironmentalSynergy === 'undefined') return;

    // Floor eligibility
    var eligible = ctx.floor > 1 && (ctx.runState.firstCombatVictory || ctx.runState.firstBonfire);
    if (!eligible || ctx.floor <= 4 || ctx.BOSS_FLOORS.indexOf(ctx.floor) !== -1) {
      ctx.runState.floorsSinceGate++;
      return;
    }

    // Update biome cooldowns
    for (var biomeName in ctx.runState.biomeEntryCooldowns) {
      if (ctx.runState.biomeEntryCooldowns[biomeName] > 0) {
        ctx.runState.biomeEntryCooldowns[biomeName]--;
      }
    }

    // Gate spawn chance
    var baseChance = 0;
    if (ctx.floor === 2) baseChance = 0.18;
    else if (ctx.floor === 3) baseChance = 0.28;
    else if (ctx.floor === 4) baseChance = 0.38;
    else baseChance = 0.45;

    // Pity timer
    var forceGate = ctx.runState.floorsSinceGate >= 3;

    // Soft-lock prevention
    var playerKeys = ctx.getPlayerKeys();
    var unmatchedKeys = ctx.countUnmatchedKeys(playerKeys);
    var forceSoftLockPrevention = unmatchedKeys >= 2 && ctx.runState.floorsSinceGate >= 3;

    if (!forceGate && !forceSoftLockPrevention && ctx.rng() > baseChance) {
      ctx.runState.floorsSinceGate++;
      return;
    }

    // Biome weights
    var biomeWeights = {
      'Commercial Office': 30, 'Shopping Mall': 25,
      'Industrial Complex': 25, 'Aerospace Museum': 20
    };

    for (var targetBiome in biomeWeights) {
      if (ctx.playerHasKeyForBiome(playerKeys, targetBiome)) biomeWeights[targetBiome] += 15;
      if (ctx.runState.biomeEntryCooldowns[targetBiome] > 0) biomeWeights[targetBiome] = Math.max(0, biomeWeights[targetBiome] - 25);
      if (ctx.runState.visitedGateBiomes.indexOf(targetBiome) === -1) biomeWeights[targetBiome] += 20;
    }

    if (forceSoftLockPrevention) {
      for (var key in playerKeys) {
        var matchingBiome = ctx.getBiomeForKey(playerKeys[key]);
        if (matchingBiome && biomeWeights[matchingBiome] !== undefined) biomeWeights[matchingBiome] += 50;
      }
    }

    var selectedBiome = ctx.weightedBiomeRoll(biomeWeights);
    if (!selectedBiome) { ctx.runState.floorsSinceGate++; return; }

    var availableGates = EnvironmentalSynergy.getGatesForBiome(selectedBiome.toUpperCase().replace(/ /g, '_'));
    if (availableGates.length === 0) availableGates = ['WOODEN_GATE', 'OLD_DOOR'];

    var gateType = availableGates[Math.floor(ctx.rng() * availableGates.length)];
    var gateDef = EnvironmentalSynergy.getGateDefinitions()[gateType];
    if (!gateDef) { ctx.runState.floorsSinceGate++; return; }

    // Find position
    var dx = exitX - ctx.player.x;
    var dy = exitY - ctx.player.y;
    var gateX = Math.floor(ctx.player.x + dx * (0.4 + ctx.rng() * 0.3));
    var gateY = Math.floor(ctx.player.y + dy * (0.4 + ctx.rng() * 0.3));

    var attempts = 0;
    var validPosition = false;
    while (!validPosition && attempts < 50) {
      if (ctx.grid[gateY] && ctx.grid[gateY][gateX] === ctx.TILES.EMPTY) {
        var distToPlayer = Math.abs(gateX - ctx.player.x) + Math.abs(gateY - ctx.player.y);
        var distToExit = Math.abs(gateX - exitX) + Math.abs(gateY - exitY);
        if (distToPlayer >= 8 && distToExit >= 8) validPosition = true;
      }
      if (!validPosition) {
        gateX = Math.floor(ctx.player.x + dx * (0.4 + ctx.rng() * 0.3));
        gateY = Math.floor(ctx.player.y + dy * (0.4 + ctx.rng() * 0.3));
        attempts++;
      }
    }

    if (!validPosition) { ctx.runState.floorsSinceGate++; return; }

    var gateBreakable = {
      x: gateX, y: gateY, hp: 3, maxHp: 3,
      glyph: ctx.TILES.BREAKABLE, destroyedGlyph: ctx.TILES.DEBRIS,
      emoji: gateDef.emoji, name: gateDef.name,
      tag: 'gate_' + gateType, isGate: true,
      gateType: gateType, targetBiome: selectedBiome
    };
    ctx.breakables.push(gateBreakable);
    ctx.grid[gateY][gateX] = ctx.TILES.BREAKABLE;

    EnvironmentalSynergy.registerGate({ x: gateX, y: gateY, type: gateType });

    // UTILITY LIGHT: invisible, non-interactive — highlights the gate location without covering the gate emoji.
    if (gateDef.glowColor && typeof LightingSystem !== 'undefined') {
      LightingSystem.addLightSource(gateX, gateY, 'TERMINAL', null, false, false, 'utility');
    }

    ctx.runState.floorsSinceGate = 0;
    ctx.runState.gatesSpawnedThisRun++;
    ctx.runState.lastBiomeEntered = selectedBiome;
    ctx.runState.biomeEntryCooldowns[selectedBiome] = 2;

    console.log('[BiomeGateSystem] Placed', gateDef.name, 'for', selectedBiome, 'at', gateX, gateY, 'on floor', ctx.floor, forceGate ? '(FORCED)' : '');
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  return {
    placeTutorialGate: placeTutorialGate,
    placeBiomeGates: placeBiomeGates
  };
})();
