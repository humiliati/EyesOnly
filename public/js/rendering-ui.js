/**
 * RenderingUI — Extracted from gone-rogue.js (Phase 7)
 * Grid rendering, HUD/status display, alert level, UI bridge helpers.
 * Stateless module — all state passed via ctx.
 */
var RenderingUI = (function() {
  'use strict';

  // ── Grid Rendering ──

  /**
   * Compose the ASCII/emoji grid for display.
   * ctx: { grid, biomeVisualGrid, breakables, tileMetadata, enemies, items,
   *        projectiles, player, floor, turn, alertLevel, strCombatActive,
   *        bossFloorActive, bossDefeated, activeBoss, activeSecretFloor,
   *        penaltyFloors, TILES, GRID_WIDTH, GRID_HEIGHT, getBiome }
   */
  function renderGrid(ctx) {
    var lines = [''];
    var TILES = ctx.TILES;

    // Copy grid for rendering (use biome visual grid if available)
    var source = ctx.biomeVisualGrid || ctx.grid;
    var display = source.map(function(row) { return row.slice(); });

    // Place breakables
    ctx.breakables.forEach(function(breakable) {
      if (breakable.hp > 0) {
        display[breakable.y][breakable.x] = breakable.glyph || TILES.BREAKABLE;
      } else if (breakable.destroyedGlyph) {
        display[breakable.y][breakable.x] = breakable.destroyedGlyph;
      }
    });

    // Place metadata-driven overlays (doors/chests/NPCs)
    for (var mk in ctx.tileMetadata) {
      if (ctx.tileMetadata.hasOwnProperty(mk)) {
        var md = ctx.tileMetadata[mk];
        if (!md) continue;

        if (md.type === 'locked_gate' || md.type === 'locked_chest' || md.type === 'npc') {
          var parts = mk.split(',');
          var mx = parseInt(parts[0]);
          var my = parseInt(parts[1]);
          if (display[my] && typeof display[my][mx] !== 'undefined') {
            if (md.type === 'locked_gate') {
              display[my][mx] = md.emoji || '\uD83D\uDEAA';
            } else if (md.type === 'locked_chest') {
              display[my][mx] = md.emoji || '\uD83E\uDDF0';
            } else if (md.type === 'npc') {
              display[my][mx] = md.emoji || '\uD83E\uDDD1';
            }
          }
        }
      }
    }

    // Place enemies
    ctx.enemies.forEach(function(enemy) {
      if (enemy.hp > 0) {
        display[enemy.y][enemy.x] = TILES.ENEMY;
      }
    });

    // Place pets
    if (typeof PetFollower !== 'undefined') {
      var activePets = PetFollower.getActivePets();
      activePets.forEach(function(pet) {
        if (pet.alive) {
          var petX = Math.round(pet.x);
          var petY = Math.round(pet.y);
          if (petY >= 0 && petY < ctx.GRID_HEIGHT && petX >= 0 && petX < ctx.GRID_WIDTH) {
            display[petY][petX] = pet.emoji || '\uD83D\uDC3E';
          }
        }
      });
    }

    // Place items
    ctx.items.forEach(function(item) {
      display[item.y][item.x] = item.emoji || TILES.ITEM;
    });

    // Place projectiles
    ctx.projectiles.forEach(function(projectile) {
      display[projectile.y][projectile.x] = projectile.glyph || TILES.PROJECTILE;
    });

    // Place player (check for avatar override)
    var playerAvatar = TILES.PLAYER;
    if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getPlayerAvatarOverride) {
      var override = PassiveItemsSystem.getPlayerAvatarOverride();
      if (override) playerAvatar = override;
    }
    display[ctx.player.y][ctx.player.x] = playerAvatar;

    // Render grid lines
    for (var y = 0; y < ctx.GRID_HEIGHT; y++) {
      lines.push(display[y].join(''));
    }

    // Floor label
    lines.push('');
    var biome = ctx.getBiome(ctx.floor);
    var floorLabel;

    if (ctx.activeSecretFloor) {
      if (typeof SecretFloors !== 'undefined') {
        if (ctx.activeSecretFloor === SecretFloors.SECRET_FLOOR_TYPES.UBER_MEGA) {
          floorLabel = 'SECRET: \u26A0\uFE0F UBER MEGA \u26A0\uFE0F';
        } else if (ctx.activeSecretFloor === SecretFloors.SECRET_FLOOR_TYPES.GOBLIN_VAULT) {
          floorLabel = 'SECRET: \uD83D\uDCB0 Goblin Vault \uD83D\uDCB0';
        } else if (ctx.activeSecretFloor === SecretFloors.SECRET_FLOOR_TYPES.GRAY_CAVE_HIDDEN) {
          floorLabel = 'SECRET: \uD83C\uDF2B\uFE0F Gray Cave \uD83C\uDF2B\uFE0F';
        } else {
          floorLabel = 'SECRET FLOOR';
        }
      } else {
        floorLabel = 'SECRET FLOOR';
      }
    } else {
      floorLabel = 'Floor: ' + ctx.floor + ' | ' + biome.name;
    }

    if (ctx.bossFloorActive && !ctx.bossDefeated) {
      floorLabel += ' \uD83D\uDC79 BOSS FLOOR';
    } else if (ctx.bossFloorActive && ctx.bossDefeated) {
      floorLabel += ' \u2705 BOSS DEFEATED';
    }

    if (ctx.penaltyFloors.indexOf(ctx.floor) !== -1) {
      floorLabel += ' \uD83D\uDD3B PENALTY';
    }

    lines.push('HP: ' + ctx.player.hp + '/' + ctx.player.maxHp + ' | ' + floorLabel + ' | Turn: ' + ctx.turn);
    if (ctx.bossFloorActive && ctx.activeBoss && !ctx.bossDefeated) {
      lines.push('\u26A0\uFE0F  Boss: ' + ctx.activeBoss.type + ' | Phase: ' + ctx.activeBoss.phase);
    }
    lines.push('');

    return lines;
  }

  // ── HUD / Status ──

  function helpLines() {
    return [
      '',
      'GONE ROGUE COMMANDS:',
      '  N/S/E/W (or WASD)  - Move',
      '  SHOOT <dir>        - Fire projectile (ascii/emoji)',
      '  KICK <dir>         - Boot adjacent breakable',
      '  TAKE/PICKUP        - Pick up item',
      '  EXTRACT            - Extract from exit point',
      '  STATUS             - Show player stats',
      '  INVENTORY          - Show inventory',
      '  STEAL              - Pickpocket adjacent enemy (requires Pickpocket Gloves equipped)',
      '',
      'BONFIRE COMMANDS (Floors 10, 16, 22):',
      '  VENDOR/SHOP        - View vendor inventory',
      '  BUY <number>       - Purchase item from vendor',
      '  HEAL               - Restore HP for \u00A230',
      '  GAMBLE             - Roll random card for \u00A2100',
      '  STASH <number>     - Move loose item to persistent storage',
      '  RETRIEVE <number>  - Move persistent item to loose carry',
      '  EQUIP <number>     - Equip persistent item to active slot',
      '  UNEQUIP            - Unequip active item',
      '',
      '  HELP               - This help',
      '  EXIT               - Return to Street Chronicles',
      '',
      'LEGEND:',
      '  \uD83E\uDD77 = You        \uD83E\uDE96 = Enemy      \uD83D\uDC8E = Item',
      '  \uD83D\uDEAA = Exit       \u2588 = Wall       \u2593 = Cover',
      '  \u2591 = Shadow     , = Grass      \u2248 = Smoke',
      '  \u2592 = Hazard     \uD83D\uDCE6 = Breakable',
      '',
      'TERRAIN EFFECTS:',
      '  Shadow/Grass/Smoke = Stealth bonus',
      '  Hazard = Damage on contact',
      '  Cover = Blocks enemy vision',
      ''
    ];
  }

  function statusLines(ctx) {
    return [
      '',
      'PLAYER STATUS:',
      '  HP: ' + ctx.player.hp + '/' + ctx.player.maxHp,
      '  Energy: ' + ctx.player.energy + '/' + ctx.player.maxEnergy,
      '  Stealth: ' + ctx.player.stealth,
      '  Detection: ' + ctx.player.detection,
      '  Floor: ' + ctx.floor,
      '  Turn: ' + ctx.turn,
      ''
    ];
  }

  function inventoryLines() {
    var lines = ['', 'INVENTORY:'];

    if (typeof GAMESTATE !== 'undefined') {
      var persistent = GAMESTATE.getPersistentInventory();
      var loose = GAMESTATE.getLooseInventory();
      var activeItem = GAMESTATE.getActiveItem();

      lines.push('');
      lines.push('ACTIVE SLOT:');
      if (activeItem) {
        lines.push('  \u26A1 ' + activeItem.emoji + ' ' + activeItem.name + ' [EQUIPPED]');
      } else {
        lines.push('  [EMPTY - Use EQUIP command]');
      }

      lines.push('');
      lines.push('PERSISTENT (' + persistent.length + '/' + GAMESTATE.getState().persistentSlots + '):');
      if (persistent.length) {
        persistent.forEach(function(item, i) {
          var label = item.qualityName || item.rarity || item.subtype || '';
          lines.push('  ' + (i+1) + '. ' + (item.emoji || '\uD83D\uDCE6') + ' ' + (item.name || 'Item') + (label ? ' [' + label + ']' : ''));
        });
      } else {
        lines.push('  [EMPTY]');
      }

      lines.push('');
      lines.push('LOOSE CARRY (' + loose.length + '/' + GAMESTATE.getState().looseSlots + '):');
      if (loose.length) {
        loose.forEach(function(item, i) {
          var label = item.qualityName || item.rarity || '';
          lines.push('  ' + (i+1) + '. ' + (item.emoji || '\uD83D\uDCE6') + ' ' + (item.name || 'Item') + (label ? ' [' + label + ']' : ''));
        });
      } else {
        lines.push('  [EMPTY]');
      }
    }

    lines.push('');
    return lines;
  }

  // ── Alert Level ──

  function updateAlertLevel(ctx) {
    if (ctx.player.detection >= 8) return 'danger';
    if (ctx.player.detection >= 4) return 'caution';
    return 'safe';
  }

  // ── UI Tooltip Helpers ──

  function combatPhaseTooltip(phase, details, ms) {
    if (typeof TooltipSystem === 'undefined') return;

    var label = ('' + phase).toUpperCase();
    var msg = '';

    if (label === 'INITIATIVE') {
      msg = '\u26A1 INITIATIVE \u2014 ' + (details || 'engaging');
    } else if (label === 'CARDPLAY') {
      msg = '\uD83C\uDCCF CARD PLAY \u2014 ' + (details || 'choose your action');
    } else if (label === 'RESOLUTION') {
      msg = '\uD83D\uDCA5 RESOLUTION \u2014 ' + (details || 'calculating damage');
    } else if (label === 'VICTORY') {
      msg = '\uD83C\uDFC1 VICTORY \u2014 ' + (details || 'encounter cleared');
    } else if (label === 'DEFEAT') {
      msg = '\u2620\uFE0F DEFEAT \u2014 ' + (details || 'recovering');
    } else {
      msg = label + (details ? (': ' + details) : '');
    }

    TooltipSystem.showPersistent(msg, ms || 1600);
  }

  function npcShowEmoji(npc, emoji, ms) {
    if (!npc) return;
    if (typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.showGenericExpression(npc.x, npc.y, emoji, ms || 800);
    }
  }

  function npcSay(npc, text) {
    if (!npc || !text) return;
    if (typeof TooltipSystem !== 'undefined') {
      TooltipSystem.showPersistent(text, 2400);
    }
  }

  // ── Reserve Slots / Seed Display / Player Light ──

  function updateReserveSlots() {
    if (typeof ReserveSlots === 'undefined' || typeof GAMESTATE === 'undefined') return;

    var loose = GAMESTATE.getLooseInventory();
    var cards = loose.map(function(item) {
      return {
        id: item.id,
        name: item.name || 'Card',
        icon: item.emoji || item.icon || '\uD83C\uDCCF',
        emoji: item.emoji || item.icon || '\uD83C\uDCCF',
        description: item.description || '',
        cost: item.cost || null,
        damage: item.damage || null,
        range: item.range || null
      };
    });

    ReserveSlots.setReserveCards(cards);
  }

  function updateSeedDisplay(seedPhrase, difficultyTier) {
    var awolButton = document.getElementById('awol-button');
    if (!awolButton) return;

    if (seedPhrase) {
      var difficulty = ['STANDARD', 'ADVANCED', 'EXTREME'][difficultyTier - 1];
      awolButton.setAttribute('title', 'AWOL status \u2014 Click to configure difficulty\nSeed: ' + seedPhrase);
    }
  }

  // ── Public API ──
  return {
    renderGrid: renderGrid,
    helpLines: helpLines,
    statusLines: statusLines,
    inventoryLines: inventoryLines,
    updateAlertLevel: updateAlertLevel,
    combatPhaseTooltip: combatPhaseTooltip,
    npcShowEmoji: npcShowEmoji,
    npcSay: npcSay,
    updateReserveSlots: updateReserveSlots,
    updateSeedDisplay: updateSeedDisplay
  };
})();
