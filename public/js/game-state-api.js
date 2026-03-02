/**
 * GameStateAPI — headless state queries: getState, getGrid, resetToState, spawnTestPets.
 * Extracted Phase 22 from gone-rogue.js.
 * Stateless IIFE module — all mutable state via ctx references.
 */
var GameStateAPI = (function() {
  'use strict';

  /**
   * Get complete game state snapshot (for testing/agent simulation).
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Full state snapshot
   */
  function getState(ctx) {
    var player = ctx.player;
    return {
      active: ctx.active,
      floor: ctx.getFloor(),
      turn: ctx.getTurn(),
      player: {
        x: player.x,
        y: player.y,
        hp: player.hp,
        maxHp: player.maxHp,
        energy: player.energy,
        maxEnergy: player.maxEnergy,
        stealth: player.stealth,
        detection: player.detection,
        lastMoveDirection: player.lastMoveDirection,
        str: player.str,
        dex: player.dex,
        credits: player.credits,
        deck: player.deck ? player.deck.slice() : [],
        activeItem: player.activeItem
      },
      enemies: ctx.enemies.map(function(e) {
        return {
          x: e.x,
          y: e.y,
          hp: e.hp,
          maxHp: e.maxHp,
          type: e.type,
          tier: e.tier,
          emoji: e.emoji,
          awarenessState: e.awarenessState,
          orientation: e.orientation,
          alertLevel: e.alertLevel
        };
      }),
      grid: ctx.grid.map(function(row) { return row.slice(); }),
      gridWidth: ctx.GRID_WIDTH,
      gridHeight: ctx.GRID_HEIGHT,
      breakables: ctx.breakables.slice(),
      projectiles: ctx.projectiles.slice(),
      items: ctx.items.slice(),
      currencies: ctx.currencies.slice(),
      strCombatActive: ctx.strCombatActive,
      alertLevel: ctx.getAlertLevel(),
      bossFloorActive: ctx.getBossFloorActive()
    };
  }

  /**
   * Get grid data (for map parsing).
   * @param {Object} ctx - Context from monolith
   * @returns {Object} Grid snapshot with dimensions and tile constants
   */
  function getGrid(ctx) {
    return {
      grid: ctx.grid.map(function(row) { return row.slice(); }),
      width: ctx.GRID_WIDTH,
      height: ctx.GRID_HEIGHT,
      tiles: ctx.TILES
    };
  }

  /**
   * Reset game to specific state (for replay testing).
   * @param {Object} state - State snapshot from getState()
   * @param {Object} ctx - Context from monolith
   * @returns {boolean} Success flag
   */
  function resetToState(state, ctx) {
    if (!state) return false;

    try {
      ctx.setActive(state.active);
      ctx.setFloor(state.floor);
      ctx.setTurn(state.turn);

      // Restore player
      var player = ctx.player;
      player.x = state.player.x;
      player.y = state.player.y;
      player.hp = state.player.hp;
      player.maxHp = state.player.maxHp;
      player.energy = state.player.energy;
      player.maxEnergy = state.player.maxEnergy;
      player.stealth = state.player.stealth;
      player.detection = state.player.detection;
      player.lastMoveDirection = state.player.lastMoveDirection;
      player.str = state.player.str;
      player.dex = state.player.dex;
      player.credits = state.player.credits;
      player.deck = state.player.deck ? state.player.deck.slice() : [];
      player.activeItem = state.player.activeItem;

      // Restore grid
      ctx.setGrid(state.grid.map(function(row) { return row.slice(); }));

      // Restore enemies
      ctx.setEnemies(state.enemies.slice());

      // Restore other state
      ctx.setBreakables(state.breakables ? state.breakables.slice() : []);
      ctx.setProjectiles(state.projectiles ? state.projectiles.slice() : []);

      if (typeof WorldItems !== 'undefined') {
        WorldItems.setFloorItems(state.items ? state.items.slice() : []);
        ctx.syncItems();
        WorldItems.setCurrencies(state.currencies ? state.currencies.slice() : []);
        ctx.syncCurrencies();
      }

      ctx.setStrCombatActive(state.strCombatActive);
      ctx.setAlertLevel(state.alertLevel);
      ctx.setBossFloorActive(state.bossFloorActive);

      return true;
    } catch (error) {
      console.error('Failed to reset state:', error);
      return false;
    }
  }

  /**
   * Spawn test pets for debugging (one of each tier).
   * @param {Object} ctx - Context from monolith
   */
  function spawnTestPets(ctx) {
    if (typeof PetFollower === 'undefined') {
      console.warn('[GoneRogue] PetFollower module not available');
      return;
    }

    var player = ctx.player;

    // Create test pets
    var pikachuPet = PetFollower.createPet(
      PetFollower.PET_TIERS.RUMBA,
      'UNCOMMON',
      '\uD83D\uDC2D',
      'Pikachu',
      { scrapProc: 0.02, dropChance: 0.05 }
    );

    var humanoidPet = PetFollower.createPet(
      PetFollower.PET_TIERS.HUMANOID,
      'RARE',
      '\uD83E\uDDCD',
      'Breaker',
      null
    );

    var tanyaPet = PetFollower.createPet(
      PetFollower.PET_TIERS.MEGA,
      'MEGA',
      '\uD83D\uDD2B',
      'Tanya',
      null
    );

    // Initialize pets at player position
    pikachuPet.x = player.x;
    pikachuPet.y = player.y;
    humanoidPet.x = player.x;
    humanoidPet.y = player.y;
    tanyaPet.x = player.x;
    tanyaPet.y = player.y;

    // Add pets
    PetFollower.addPet(pikachuPet);
    PetFollower.addPet(humanoidPet);
    PetFollower.addPet(tanyaPet);

    console.log('[GoneRogue] Test pets spawned: Pikachu (Rumba), Breaker (Humanoid), Tanya (Mega)');
  }

  return {
    getState: getState,
    getGrid: getGrid,
    resetToState: resetToState,
    spawnTestPets: spawnTestPets
  };
})();
