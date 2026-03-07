/* ============================================================
   Floor Generator — Extracted from gone-rogue.js
   Grid creation, room generation, biome visuals, entity spawning
   ============================================================ */

var FloorGenerator = (function () {
  'use strict';

  // ── RNG helper ──
  function _rng(ctx) {
    if (ctx && ctx.rng) return ctx.rng();
    if (typeof SeededRNG !== 'undefined' && SeededRNG.random) return SeededRNG.random();
    return Math.random();
  }

  // ── Biome Visual Functions ──

  function pickWeightedChar(tiles, ctx) {
    var total = 0;
    for (var i = 0; i < tiles.length; i++) total += tiles[i].weight;
    var rand = _rng(ctx) * total;
    var cumulative = 0;
    for (var j = 0; j < tiles.length; j++) {
      cumulative += tiles[j].weight;
      if (rand < cumulative) return tiles[j].char;
    }
    return tiles[tiles.length - 1].char;
  }

  function pickWeightedCharWithRNG(tiles, rng) {
    if (!tiles || tiles.length === 0) return '?';
    if (tiles.length === 1) return tiles[0].char;
    var totalWeight = 0;
    for (var i = 0; i < tiles.length; i++) totalWeight += tiles[i].weight || 1;
    var rand = rng.next() * totalWeight;
    var cumulative = 0;
    for (var j = 0; j < tiles.length; j++) {
      cumulative += tiles[j].weight;
      if (rand < cumulative) return tiles[j].char;
    }
    return tiles[tiles.length - 1].char;
  }

  function getNeighborTiles(x, y, ctx) {
    var neighbors = [];
    var directions = [{dx:0,dy:-1},{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0}];
    directions.forEach(function(dir) {
      var nx = x + dir.dx, ny = y + dir.dy;
      if (nx >= 0 && nx < ctx.GRID_WIDTH && ny >= 0 && ny < ctx.GRID_HEIGHT) {
        neighbors.push(ctx.grid[ny][nx]);
      }
    });
    return neighbors;
  }

  function buildBiomeVisualGrid(biome, ctx) {
    if (!biome || (!biome.wallTiles && !biome.floorTiles)) return null;
    var visualGrid = [];
    for (var y = 0; y < ctx.GRID_HEIGHT; y++) {
      var row = [];
      for (var x = 0; x < ctx.GRID_WIDTH; x++) {
        var tile = ctx.grid[y][x];
        if (tile === ctx.TILES.WALL && biome.wallTiles) {
          row.push(pickWeightedChar(biome.wallTiles, ctx));
        } else if ((tile === ctx.TILES.EMPTY || tile === ctx.TILES.GRASS) && biome.floorTiles) {
          row.push(pickWeightedChar(biome.floorTiles, ctx));
        } else {
          row.push(tile);
        }
      }
      visualGrid.push(row);
    }
    // Overlay village buildings
    if (ctx.forestBuildings) {
      ctx.forestBuildings.forEach(function(b) {
        if (b.y >= 0 && b.y < ctx.GRID_HEIGHT && b.x >= 0 && b.x < ctx.GRID_WIDTH) {
          visualGrid[b.y][b.x] = b.emoji;
        }
      });
    }
    return visualGrid;
  }

  function generateTileRenderObjects(x, y, biome, ctx) {
    var tile = ctx.grid[y][x];
    var renderObjects = [];
    if (tile !== ctx.TILES.WALL || !biome || !biome.wallTiles) return renderObjects;

    var tileIndex = y * ctx.GRID_WIDTH + x;
    var tileSeed = ctx.currentSeed + tileIndex;
    var tileRNG = new SeededRandom.SeededRNG(tileSeed);
    var primaryChar = ctx.biomeVisualGrid ? ctx.biomeVisualGrid[y][x] : ctx.TILES.WALL;

    renderObjects.push({ emoji: primaryChar, offsetX: 0, offsetY: 0, scale: 1.0, layer: 'trunk' });

    var density = biome.wallDensity || 2;
    for (var i = 0; i < density; i++) {
      var scatterEmoji = pickWeightedCharWithRNG(biome.wallTiles, tileRNG);
      var offsetX = -10 + (tileRNG.next() * 20);
      var offsetY = -10 + (tileRNG.next() * 20);
      var scale = 0.7 + (tileRNG.next() * 0.4);
      renderObjects.push({ emoji: scatterEmoji, offsetX: offsetX, offsetY: offsetY, scale: scale, layer: 'scatter' });
    }

    var directions = [{dx:0,dy:-1,name:'north'},{dx:1,dy:0,name:'east'},{dx:0,dy:1,name:'south'},{dx:-1,dy:0,name:'west'}];
    directions.forEach(function(dir) {
      var nx = x + dir.dx, ny = y + dir.dy;
      if (nx >= 0 && nx < ctx.GRID_WIDTH && ny >= 0 && ny < ctx.GRID_HEIGHT) {
        var neighborTile = ctx.grid[ny][nx];
        if (neighborTile === ctx.TILES.EMPTY || neighborTile === ctx.TILES.GRASS) {
          renderObjects.push({ emoji: '🍃', offsetX: dir.dx * 8, offsetY: dir.dy * 8, scale: 0.5, layer: 'edge' });
        }
      }
    });
    return renderObjects;
  }

  function buildTileRenderObjects(biome, ctx) {
    if (!biome || !biome.wallTiles) return null;
    var tileRenderObjects = [];
    for (var y = 0; y < ctx.GRID_HEIGHT; y++) {
      var row = [];
      for (var x = 0; x < ctx.GRID_WIDTH; x++) {
        row.push(generateTileRenderObjects(x, y, biome, ctx));
      }
      tileRenderObjects.push(row);
    }
    return tileRenderObjects;
  }

  // ── Color Utilities ──

  function hexToRgb(hex) {
    var r = parseInt(hex.substr(1, 2), 16);
    var g = parseInt(hex.substr(3, 2), 16);
    var b = parseInt(hex.substr(5, 2), 16);
    return { r: r, g: g, b: b };
  }

  function rgbToHex(r, g, b) {
    var rr = Math.max(0, Math.min(255, Math.round(r)));
    var gg = Math.max(0, Math.min(255, Math.round(g)));
    var bb = Math.max(0, Math.min(255, Math.round(b)));
    return '#' + (rr < 16 ? '0' : '') + rr.toString(16) + (gg < 16 ? '0' : '') + gg.toString(16) + (bb < 16 ? '0' : '') + bb.toString(16);
  }

  function lerpColor(color1, color2, t) {
    var c1 = hexToRgb(color1);
    var c2 = hexToRgb(color2);
    return rgbToHex(c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t);
  }

  function buildBiomeBackgroundColors(biome, isNight, ctx) {
    if (!biome || !biome.backgroundGradient) return null;
    var gradientConfig = isNight ? biome.backgroundGradient.night : biome.backgroundGradient.day;
    if (!gradientConfig) return null;
    var colors = [];
    var maxDist = ctx.GRID_WIDTH + ctx.GRID_HEIGHT - 2;
    for (var y = 0; y < ctx.GRID_HEIGHT; y++) {
      var row = [];
      for (var x = 0; x < ctx.GRID_WIDTH; x++) {
        var t = maxDist > 0 ? (x + y) / maxDist : 0;
        t = Math.max(0, Math.min(1, t));
        row.push(lerpColor(gradientConfig.start, gradientConfig.end, t));
      }
      colors.push(row);
    }
    return colors;
  }

  // ── Forest API functions ──

  function createBordersForest(map, biome, ctx) {
    var width = map[0].length;
    var height = map.length;
    var wallTiles = biome.wallTiles || [{ char: biome.wallChar || ctx.TILES.WALL, weight: 100 }];
    for (var x = 0; x < width; x++) {
      map[0][x] = pickWeightedChar(wallTiles, ctx);
      map[height - 1][x] = pickWeightedChar(wallTiles, ctx);
    }
    for (var y = 0; y < height; y++) {
      map[y][0] = pickWeightedChar(wallTiles, ctx);
      map[y][width - 1] = pickWeightedChar(wallTiles, ctx);
    }
    return map;
  }

  function generateForestOpenSpace(map, biome, ctx) {
    var width = map[0].length;
    var height = map.length;
    var floorTiles = biome.floorTiles || [{ char: biome.floorChar || ctx.TILES.EMPTY, weight: 100 }];
    var openSpaceRatio = 0.8;
    for (var y = 1; y < height - 1; y++) {
      for (var x = 1; x < width - 1; x++) {
        if (_rng(ctx) < openSpaceRatio) map[y][x] = pickWeightedChar(floorTiles, ctx);
      }
    }
    return map;
  }

  function placeVillageClusterOnMap(map, biome, ctx) {
    if (!biome.spawnFeatures || !biome.spawnFeatures.villageCluster) return map;
    var width = map[0].length;
    var height = map.length;
    var villageX = Math.floor(width * 0.2) + Math.floor(_rng(ctx) * 5);
    var villageY = Math.floor(height * 0.6) + Math.floor(_rng(ctx) * 5);
    var buildings = biome.spawnFeatures.buildings;
    var positions = [[villageX, villageY], [villageX + 3, villageY], [villageX, villageY + 3], [villageX + 3, villageY + 3]];
    positions.forEach(function(pos, i) {
      if (i < buildings.length && pos[1] < height - 1 && pos[0] < width - 1) map[pos[1]][pos[0]] = buildings[i];
    });
    var decorations = biome.spawnFeatures.decorations;
    for (var d = 0; d < 5; d++) {
      var dx = villageX + Math.floor(_rng(ctx) * 7);
      var dy = villageY + Math.floor(_rng(ctx) * 7);
      if (dx < width - 1 && dy < height - 1) map[dy][dx] = decorations[Math.floor(_rng(ctx) * decorations.length)];
    }
    return map;
  }

  function placeVillageCluster(biome, ctx) {
    if (!biome.spawnFeatures || !biome.spawnFeatures.villageCluster) return;
    var villageX = Math.floor(ctx.GRID_WIDTH * 0.2) + Math.floor(_rng(ctx) * 5);
    var villageY = Math.floor(ctx.GRID_HEIGHT * 0.6) + Math.floor(_rng(ctx) * 5);
    var buildings = biome.spawnFeatures.buildings;
    var positions = [[villageX, villageY], [villageX + 3, villageY], [villageX, villageY + 3], [villageX + 3, villageY + 3]];
    positions.forEach(function(pos, i) {
      if (i < buildings.length) {
        var bx = pos[0], by = pos[1];
        if (bx >= 1 && bx < ctx.GRID_WIDTH - 1 && by >= 1 && by < ctx.GRID_HEIGHT - 1) {
          ctx.grid[by][bx] = ctx.TILES.WALL;
          ctx.forestBuildings.push({ x: bx, y: by, emoji: buildings[i] });
        }
      }
    });
    var decorations = biome.spawnFeatures.decorations;
    for (var d = 0; d < 5; d++) {
      var dx = villageX + Math.floor(_rng(ctx) * 7);
      var dy = villageY + Math.floor(_rng(ctx) * 7);
      if (dx >= 1 && dx < ctx.GRID_WIDTH - 1 && dy >= 1 && dy < ctx.GRID_HEIGHT - 1 && ctx.grid[dy][dx] === ctx.TILES.EMPTY) {
        ctx.forestBuildings.push({ x: dx, y: dy, emoji: decorations[Math.floor(_rng(ctx) * decorations.length)] });
      }
    }
  }

  // ── Core Grid Generation ──

  function createEmptyGrid(ctx) {
    var grid = [];
    for (var y = 0; y < ctx.GRID_HEIGHT; y++) {
      var row = [];
      for (var x = 0; x < ctx.GRID_WIDTH; x++) row.push(ctx.TILES.WALL);
      grid.push(row);
    }
    return grid;
  }

  function generateRooms(floorType, ctx) {
    var difficulty = ctx.floor;
    if (floorType === ctx.FLOOR_TYPES.BONFIRE) {
      return [{ x: Math.floor(ctx.GRID_WIDTH / 4), y: Math.floor(ctx.GRID_HEIGHT / 4), w: Math.floor(ctx.GRID_WIDTH / 2), h: Math.floor(ctx.GRID_HEIGHT / 2), centerX: Math.floor(ctx.GRID_WIDTH / 2), centerY: Math.floor(ctx.GRID_HEIGHT / 2) }];
    }
    if (floorType === ctx.FLOOR_TYPES.BOSS) {
      return [{ x: 5, y: 3, w: 30, h: 14, centerX: 20, centerY: 10, isBossArena: true }];
    }
    var biome = ctx.getBiome(ctx.floor);
    if (biome.name === 'Cozy Forest') {
      var halfW = Math.floor((ctx.GRID_WIDTH - 4) / 2);
      var forestRooms = [
        { x: 2, y: 2, w: halfW, h: ctx.GRID_HEIGHT - 4, centerX: Math.floor(ctx.GRID_WIDTH * 0.25), centerY: Math.floor(ctx.GRID_HEIGHT / 2) },
        { x: 2 + halfW, y: 2, w: ctx.GRID_WIDTH - 4 - halfW, h: ctx.GRID_HEIGHT - 4, centerX: Math.floor(ctx.GRID_WIDTH * 0.75), centerY: Math.floor(ctx.GRID_HEIGHT / 2) }
      ];
      for (var fy = 2; fy < ctx.GRID_HEIGHT - 2; fy++) {
        for (var fx = 2; fx < ctx.GRID_WIDTH - 2; fx++) ctx.grid[fy][fx] = ctx.TILES.EMPTY;
      }
      return forestRooms;
    }
    var numRooms = Math.min(4 + Math.floor(difficulty / 2), 8);
    var rooms = [];
    var maxAttempts = 50;
    for (var i = 0; i < numRooms; i++) {
      var attempts = 0;
      var room = null;
      while (attempts < maxAttempts && !room) {
        attempts++;
        var minSize = 4;
        var maxWidth = difficulty > 5 ? 12 : 10;
        var maxHeight = difficulty > 5 ? 10 : 8;
        var w = Math.floor(_rng(ctx) * (maxWidth - minSize + 1)) + minSize;
        var h = Math.floor(_rng(ctx) * (maxHeight - minSize + 1)) + minSize;
        w = Math.min(w, ctx.GRID_WIDTH - 4);
        h = Math.min(h, ctx.GRID_HEIGHT - 4);
        var x = Math.floor(_rng(ctx) * (ctx.GRID_WIDTH - w - 4)) + 2;
        var y = Math.floor(_rng(ctx) * (ctx.GRID_HEIGHT - h - 4)) + 2;
        if (x + w >= ctx.GRID_WIDTH - 2 || y + h >= ctx.GRID_HEIGHT - 2) continue;
        var spacing = 2;
        var overlaps = false;
        for (var j = 0; j < rooms.length; j++) {
          var r = rooms[j];
          if (!(x + w + spacing < r.x || x > r.x + r.w + spacing || y + h + spacing < r.y || y > r.y + r.h + spacing)) { overlaps = true; break; }
        }
        if (!overlaps) room = { x: x, y: y, w: w, h: h, centerX: Math.floor(x + w / 2), centerY: Math.floor(y + h / 2) };
      }
      if (room) {
        rooms.push(room);
        for (var ry = room.y; ry < room.y + room.h; ry++) {
          for (var rx = room.x; rx < room.x + room.w; rx++) {
            if (rx >= 0 && rx < ctx.GRID_WIDTH && ry >= 0 && ry < ctx.GRID_HEIGHT) ctx.grid[ry][rx] = ctx.TILES.EMPTY;
          }
        }
      }
    }
    return rooms;
  }

  function connectRooms(rooms, ctx) {
    for (var i = 0; i < rooms.length - 1; i++) {
      carveCorridor(rooms[i].centerX, rooms[i].centerY, rooms[i + 1].centerX, rooms[i + 1].centerY, ctx);
    }
  }

  function carveCorridor(x1, y1, x2, y2, ctx) {
    var x = x1, y = y1;
    while (x !== x2) {
      if (x >= 0 && x < ctx.GRID_WIDTH && y >= 0 && y < ctx.GRID_HEIGHT) {
        ctx.grid[y][x] = ctx.TILES.EMPTY;
        if (y + 1 < ctx.GRID_HEIGHT) ctx.grid[y + 1][x] = ctx.TILES.EMPTY;
      }
      x += (x < x2) ? 1 : -1;
    }
    while (y !== y2) {
      if (x >= 0 && x < ctx.GRID_WIDTH && y >= 0 && y < ctx.GRID_HEIGHT) {
        ctx.grid[y][x] = ctx.TILES.EMPTY;
        if (x + 1 < ctx.GRID_WIDTH) ctx.grid[y][x + 1] = ctx.TILES.EMPTY;
      }
      y += (y < y2) ? 1 : -1;
    }
  }

  function addBranchConnections(rooms, ctx) {
    var extraConnections = Math.min(2 + Math.floor(ctx.floor / 3), 4);
    for (var i = 0; i < extraConnections && rooms.length > 2; i++) {
      var idx1 = Math.floor(_rng(ctx) * rooms.length);
      var idx2 = Math.floor(_rng(ctx) * rooms.length);
      if (idx1 !== idx2 && Math.abs(idx1 - idx2) > 1) {
        carveCorridor(rooms[idx1].centerX, rooms[idx1].centerY, rooms[idx2].centerX, rooms[idx2].centerY, ctx);
      }
    }
  }

  function placeCover(ctx) {
    var coverChance = 0.06 + _rng(ctx) * 0.04;
    for (var y = 1; y < ctx.GRID_HEIGHT - 1; y++) {
      for (var x = 1; x < ctx.GRID_WIDTH - 1; x++) {
        if (ctx.grid[y][x] === ctx.TILES.EMPTY && _rng(ctx) < coverChance) ctx.grid[y][x] = ctx.TILES.COVER;
      }
    }
  }

  function placeShadowZones(ctx) {
    var shadowChance = 0.15;
    for (var y = 1; y < ctx.GRID_HEIGHT - 1; y++) {
      for (var x = 1; x < ctx.GRID_WIDTH - 1; x++) {
        if (ctx.grid[y][x] === ctx.TILES.EMPTY && _rng(ctx) < shadowChance) {
          ctx.tileMetadata[x + ',' + y] = { type: 'shadow', stealthBonus: 30 };
          ctx.grid[y][x] = ctx.TILES.SHADOW;
        }
      }
    }
  }

  function placeEnvironmentalTiles(ctx) {
    var difficulty = ctx.floor;
    var biome = ctx.getBiome(ctx.floor);
    if (typeof GroundEffects !== 'undefined') {
      var effectCount = 5 + Math.floor(difficulty / 3);
      var biomeEffects = [];
      if (biome.name === 'Shopping Mall') biomeEffects = ['GLASS', 'SODA_SPILL', 'WATER'];
      else if (biome.name === 'Industrial Plant') biomeEffects = ['OIL', 'FIRE', 'INDUSTRIAL_WASTE', 'STEAM'];
      else if (biome.name === 'Commercial Office') biomeEffects = ['WATER', 'GLASS'];
      else if (biome.name === 'Grey Cave') biomeEffects = ['WATER'];
      for (var i = 0; i < effectCount && biomeEffects.length > 0; i++) {
        var x = Math.floor(_rng(ctx) * (ctx.GRID_WIDTH - 2)) + 1;
        var y = Math.floor(_rng(ctx) * (ctx.GRID_HEIGHT - 2)) + 1;
        if (ctx.grid[y][x] === ctx.TILES.EMPTY) {
          var effectType = biomeEffects[Math.floor(_rng(ctx) * biomeEffects.length)];
          GroundEffects.setGroundEffect(x, y, effectType);
          ctx.tileMetadata[x + ',' + y] = { type: 'ground_effect', groundType: effectType };
        }
      }
    }
    if (difficulty >= 5) {
      var hazardCount = Math.floor(difficulty / 2);
      for (var i = 0; i < hazardCount; i++) {
        var x = Math.floor(_rng(ctx) * (ctx.GRID_WIDTH - 2)) + 1;
        var y = Math.floor(_rng(ctx) * (ctx.GRID_HEIGHT - 2)) + 1;
        if (ctx.grid[y][x] === ctx.TILES.EMPTY) {
          ctx.grid[y][x] = ctx.TILES.HAZARD;
          ctx.tileMetadata[x + ',' + y] = { type: 'hazard', damage: 1 };
          if (typeof GroundEffects !== 'undefined') GroundEffects.setGroundEffect(x, y, 'FIRE');
        }
      }
    }
    if (difficulty < 5) {
      var grassCount = 8 + Math.floor(_rng(ctx) * 5);
      for (var i = 0; i < grassCount; i++) {
        var x = Math.floor(_rng(ctx) * (ctx.GRID_WIDTH - 2)) + 1;
        var y = Math.floor(_rng(ctx) * (ctx.GRID_HEIGHT - 2)) + 1;
        if (ctx.grid[y][x] === ctx.TILES.EMPTY) {
          ctx.grid[y][x] = ctx.TILES.GRASS;
          ctx.tileMetadata[x + ',' + y] = { type: 'grass', stealthBonus: 20 };
        }
      }
    }
  }

  function ensurePlayerOnEmptyTile(ctx) {
    try {
      if (!ctx.player || !ctx.grid || !ctx.grid.length) return;
      ctx.player.x = Math.max(1, Math.min(ctx.GRID_WIDTH - 2, ctx.player.x | 0));
      ctx.player.y = Math.max(1, Math.min(ctx.GRID_HEIGHT - 2, ctx.player.y | 0));
      if (!ctx.grid[ctx.player.y] || !ctx.grid[ctx.player.y][ctx.player.x]) return;
      if (ctx.grid[ctx.player.y][ctx.player.x] === ctx.TILES.EMPTY) return;
      var found = false;
      for (var r = 1; r <= 12 && !found; r++) {
        for (var dy = -r; dy <= r && !found; dy++) {
          for (var dx = -r; dx <= r && !found; dx++) {
            var tx = ctx.player.x + dx, ty = ctx.player.y + dy;
            if (tx > 0 && tx < ctx.GRID_WIDTH - 1 && ty > 0 && ty < ctx.GRID_HEIGHT - 1 && ctx.grid[ty] && ctx.grid[ty][tx] === ctx.TILES.EMPTY) {
              ctx.player.x = tx; ctx.player.y = ty; found = true;
            }
          }
        }
      }
      if (!found) { ctx.player.x = Math.floor(ctx.GRID_WIDTH / 2); ctx.player.y = Math.floor(ctx.GRID_HEIGHT / 2); }
    } catch (e0) {}
  }

  function placePlayerAndExit(rooms, ctx) {
    if (rooms.length === 0) return { playerX: 5, playerY: 10, exitX: ctx.GRID_WIDTH - 3, exitY: ctx.GRID_HEIGHT - 3, backX: 5, backY: 10 };
    var firstRoom = rooms[0];
    var playerX = firstRoom.centerX, playerY = firstRoom.centerY;
    var maxSpawnAttempts = 10;
    for (var attempt = 0; attempt < maxSpawnAttempts; attempt++) {
      if (ctx.grid[playerY] && ctx.grid[playerY][playerX] === ctx.TILES.EMPTY) break;
      var offsets = [{dx:0,dy:0},{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:1},{dx:-1,dy:-1},{dx:1,dy:-1},{dx:-1,dy:1}];
      for (var i = 0; i < offsets.length; i++) {
        var testX = firstRoom.centerX + offsets[i].dx, testY = firstRoom.centerY + offsets[i].dy;
        if (testX > 0 && testX < ctx.GRID_WIDTH - 1 && testY > 0 && testY < ctx.GRID_HEIGHT - 1 && ctx.grid[testY][testX] === ctx.TILES.EMPTY) { playerX = testX; playerY = testY; break; }
      }
    }
    playerX = Math.max(1, Math.min(ctx.GRID_WIDTH - 2, playerX));
    playerY = Math.max(1, Math.min(ctx.GRID_HEIGHT - 2, playerY));
    var lastRoom = rooms[rooms.length - 1];
    var exitX = lastRoom.centerX, exitY = lastRoom.centerY;
    var distance = Math.abs(exitX - playerX) + Math.abs(exitY - playerY);
    var minDistance = Math.floor((ctx.GRID_WIDTH + ctx.GRID_HEIGHT) * 0.6);
    if (distance < minDistance && rooms.length > 1) {
      for (var i = rooms.length - 1; i >= 0; i--) {
        var dist = Math.abs(rooms[i].centerX - playerX) + Math.abs(rooms[i].centerY - playerY);
        if (dist >= minDistance) { exitX = rooms[i].centerX; exitY = rooms[i].centerY; break; }
      }
    }
    if (ctx.grid[exitY] && ctx.grid[exitY][exitX] !== ctx.TILES.EMPTY) {
      for (var radius = 1; radius < 5; radius++) {
        for (var dy = -radius; dy <= radius; dy++) {
          for (var dx = -radius; dx <= radius; dx++) {
            var testX = exitX + dx, testY = exitY + dy;
            if (testX > 0 && testX < ctx.GRID_WIDTH - 1 && testY > 0 && testY < ctx.GRID_HEIGHT - 1 && ctx.grid[testY][testX] === ctx.TILES.EMPTY) { exitX = testX; exitY = testY; radius = 999; break; }
          }
          if (radius > 100) break;
        }
      }
    }
    // Place forward door (advance exit)
    ctx.grid[exitY][exitX] = ctx.TILES.EXIT;
    if (ctx.tileMetadata) ctx.tileMetadata[exitX + ',' + exitY] = { type: 'door', doorKind: 'forward' };

    // Place back door (retreat exit) near the player start position.
    // Find an empty tile adjacent to the player's initial position, away from the forward exit.
    var backX = playerX, backY = playerY;
    var bestBackDist = 0;
    var backFound = false;
    for (var br = 1; br <= 6 && !backFound; br++) {
      for (var bdy = -br; bdy <= br; bdy++) {
        for (var bdx = -br; bdx <= br; bdx++) {
          if (Math.abs(bdx) !== br && Math.abs(bdy) !== br) continue;
          var bx = playerX + bdx, by = playerY + bdy;
          if (bx <= 0 || bx >= ctx.GRID_WIDTH - 1 || by <= 0 || by >= ctx.GRID_HEIGHT - 1) continue;
          if (!ctx.grid[by] || ctx.grid[by][bx] !== ctx.TILES.EMPTY) continue;
          // Must not overlap forward exit
          if (bx === exitX && by === exitY) continue;
          var dFromExit = Math.abs(bx - exitX) + Math.abs(by - exitY);
          if (dFromExit > bestBackDist) {
            backX = bx; backY = by;
            bestBackDist = dFromExit;
            backFound = true;
          }
        }
      }
    }
    // Stamp back door tile
    ctx.grid[backY][backX] = ctx.TILES.DOOR;
    if (ctx.tileMetadata) ctx.tileMetadata[backX + ',' + backY] = { type: 'door', doorKind: 'back' };

    return { playerX: playerX, playerY: playerY, exitX: exitX, exitY: exitY, backX: backX, backY: backY };
  }

  // ── Entity Spawning ──

  function choosePatrolType(difficulty, room, ctx) {
    var rand = _rng(ctx);
    if (difficulty <= 3) {
      if (rand < 0.4) return ctx.PATH_TYPES.STATIONARY;
      if (rand < 0.7) return ctx.PATH_TYPES.PATROL;
      return ctx.PATH_TYPES.CIRCULAR;
    } else {
      if (rand < 0.2) return ctx.PATH_TYPES.STATIONARY;
      if (rand < 0.6) return ctx.PATH_TYPES.PATROL;
      return ctx.PATH_TYPES.CIRCULAR;
    }
  }

  function createEnemy(x, y, patrolType, room, ctx) {
    var tierMultiplier = ctx.getDifficultyMultiplier();
    var isPenaltyFloor = ctx.penaltyFloors.indexOf(ctx.floor) !== -1;
    var penaltyMultiplier = isPenaltyFloor ? 1.2 : 1.0;
    var enemy = {
      x: x, y: y,
      hp: Math.floor(5 * tierMultiplier * penaltyMultiplier),
      maxHp: Math.floor(5 * tierMultiplier * penaltyMultiplier),
      str: Math.floor((3 + Math.floor(ctx.floor * 0.2)) * tierMultiplier * penaltyMultiplier),
      dex: Math.floor((3 + Math.floor(ctx.floor * 0.2)) * tierMultiplier * penaltyMultiplier),
      awareness: 0,
      orientation: ['north', 'south', 'east', 'west'][Math.floor(_rng(ctx) * 4)],
      sightRange: (ctx.floor > 5 ? 7 : 5) + (ctx.difficultyTier - 1) + (isPenaltyFloor ? 1 : 0),
      pathTimer: 0,
      isTreasureGoblin: false,
      goblinSpawnTime: null,
      isPenalty: isPenaltyFloor
    };
    if (ctx.floor > 5 && _rng(ctx) < 0.02) {
      enemy.isTreasureGoblin = true;
      enemy.goblinSpawnTime = Date.now();
      enemy.hp = 3;
      enemy.sightRange = 10;
      enemy.awareness = 5;
    }
    if (patrolType === ctx.PATH_TYPES.STATIONARY) {
      enemy.path = { type: ctx.PATH_TYPES.STATIONARY };
    } else if (patrolType === ctx.PATH_TYPES.PATROL) {
      var points = [
        { x: room.x + 1, y: room.y + 1 },
        { x: room.x + room.w - 2, y: room.y + 1 },
        { x: room.x + room.w - 2, y: room.y + room.h - 2 },
        { x: room.x + 1, y: room.y + room.h - 2 }
      ];
      enemy.path = { type: ctx.PATH_TYPES.PATROL, points: points };
      enemy.pathIndex = 0;
      enemy.pathDirection = 1;
    } else if (patrolType === ctx.PATH_TYPES.CIRCULAR) {
      var cx = room.centerX, cy = room.centerY;
      var radius = Math.min(room.w, room.h) / 3;
      var points = [
        { x: Math.floor(cx + radius), y: cy },
        { x: cx, y: Math.floor(cy + radius) },
        { x: Math.floor(cx - radius), y: cy },
        { x: cx, y: Math.floor(cy - radius) }
      ];
      enemy.path = { type: ctx.PATH_TYPES.CIRCULAR, points: points };
      enemy.pathIndex = 0;
    }
    return enemy;
  }

  function placeEnemies(rooms, floorType, ctx) {
    if (floorType === ctx.FLOOR_TYPES.TUTORIAL || floorType === ctx.FLOOR_TYPES.BONFIRE) return;
    if (floorType === ctx.FLOOR_TYPES.BOSS && ctx.activeBoss) {
      var bossPos = ctx.activeBoss.bossPosition || { x: 20, y: 10 };
      var bossEnemy = createEnemy(bossPos.x, bossPos.y, 'STATIONARY', rooms[0], ctx);
      bossEnemy.hp = ctx.activeBoss.hp;
      bossEnemy.maxHp = ctx.activeBoss.maxHp;
      bossEnemy.isBoss = true;
      bossEnemy.bossType = ctx.activeBoss.type;
      bossEnemy.str = 8 + Math.floor(ctx.floor * 0.5);
      bossEnemy.dex = 8 + Math.floor(ctx.floor * 0.5);
      bossEnemy.awareness = 100;
      ctx.activeBoss.bossEntity = bossEnemy;
      ctx.enemies.push(bossEnemy);
      ctx.onEnemySpawned();
      return;
    }
    if (floorType === ctx.FLOOR_TYPES.GHOST) return;
    var enemyCount;
    if (floorType === ctx.FLOOR_TYPES.EXPLORATION) {
      enemyCount = 1 + Math.floor(_rng(ctx) * 2);
    } else {
      var difficulty = ctx.floor;
      var tierMultiplier = ctx.getDifficultyMultiplier();
      if (difficulty <= 3) enemyCount = Math.floor((4 + Math.floor(_rng(ctx) * 3)) * tierMultiplier);
      else if (difficulty <= 7) enemyCount = Math.floor((7 + Math.floor(_rng(ctx) * 4)) * tierMultiplier);
      else if (difficulty <= 15) enemyCount = Math.floor((10 + Math.floor(_rng(ctx) * 6)) * tierMultiplier);
      else enemyCount = Math.floor((12 + Math.floor(_rng(ctx) * 7)) * tierMultiplier);
    }
    enemyCount = Math.min(enemyCount, rooms.length * 3);
    // Elite enemy check
    if (typeof EliteEnemies !== 'undefined' && EliteEnemies.shouldSpawnElite(ctx.floor)) {
      var eliteType = EliteEnemies.getRandomEliteForFloor(ctx.floor);
      if (eliteType && rooms.length > 0) {
        var eliteRoomIdx = Math.floor(_rng(ctx) * rooms.length);
        var eliteRoom = rooms[eliteRoomIdx];
        var eliteX = eliteRoom.x + 1 + Math.floor(_rng(ctx) * Math.max(1, eliteRoom.w - 2));
        var eliteY = eliteRoom.y + 1 + Math.floor(_rng(ctx) * Math.max(1, eliteRoom.h - 2));
        if (Math.abs(eliteX - ctx.player.x) + Math.abs(eliteY - ctx.player.y) >= 8) {
          var elite = EliteEnemies.createElite(eliteType, eliteX, eliteY, ctx.floor);
          if (elite) {
            elite.path = { type: ctx.PATH_TYPES.PATROL, waypoints: [] };
            elite.pathIndex = 0;
            elite.str = 6 + Math.floor(ctx.floor * 0.3);
            elite.dex = 6 + Math.floor(ctx.floor * 0.3);
            ctx.enemies.push(elite);
            ctx.onEnemySpawned();
          }
        }
      }
    }
    for (var i = 0; i < enemyCount && rooms.length > 0; i++) {
      var roomIdx = Math.floor(_rng(ctx) * rooms.length);
      var room = rooms[roomIdx];
      var x = room.x + 1 + Math.floor(_rng(ctx) * Math.max(1, room.w - 2));
      var y = room.y + 1 + Math.floor(_rng(ctx) * Math.max(1, room.h - 2));
      var tooClose = false;
      if (Math.abs(x - ctx.player.x) + Math.abs(y - ctx.player.y) < 5) tooClose = true;
      for (var j = 0; j < ctx.enemies.length; j++) {
        if (Math.abs(x - ctx.enemies[j].x) + Math.abs(y - ctx.enemies[j].y) < 3) { tooClose = true; break; }
      }
      if (tooClose) { i--; continue; }
      var patrolType = choosePatrolType(ctx.floor, room, ctx);
      var enemy = createEnemy(x, y, patrolType, room, ctx);
      try {
        if (typeof EnemyDeckHydrator !== 'undefined' && EnemyDeckHydrator.hydrate) EnemyDeckHydrator.hydrate(enemy, ctx.floor);
      } catch (e0) {}
      ctx.enemies.push(enemy);
      ctx.onEnemySpawned();
    }
  }

  function placeItems(floorType, ctx) {
    var itemCount = 5;
    if (floorType === ctx.FLOOR_TYPES.TUTORIAL) itemCount = 8;
    if (floorType === ctx.FLOOR_TYPES.EXPLORATION) itemCount = 12;
    if (floorType === ctx.FLOOR_TYPES.BONFIRE) itemCount = 3;
    // Floor 0 is the tavern road — very few organic items, player is just learning
    if (ctx.floor === 0) itemCount = 2;
    var biome = ctx.getBiome(ctx.floor);
    var shouldSpawnTrenchCoat = false;
    if (biome.name === 'Grey Cave') {
      var hasTrenchCoat = false;
      if (typeof GAMESTATE !== 'undefined') {
        var looseInv = GAMESTATE.getLooseInventory();
        var persistentInv = GAMESTATE.getPersistentInventory();
        var activeItem = GAMESTATE.getActiveItem();
        hasTrenchCoat = looseInv.some(function(item) { return item.id && item.id.indexOf('trench_coat') !== -1; })
          || persistentInv.some(function(item) { return item.id && item.id.indexOf('trench_coat') !== -1; })
          || (activeItem && activeItem.id && activeItem.id.indexOf('trench_coat') !== -1);
      }
      if (!hasTrenchCoat) shouldSpawnTrenchCoat = true;
    }
    var attempts = 0, maxAttempts = 50;
    var droppedCardsThisFloor = [];
    for (var i = 0; i < itemCount && attempts < maxAttempts; i++) {
      attempts++;
      var ix = Math.floor(_rng(ctx) * (ctx.GRID_WIDTH - 2)) + 1;
      var iy = Math.floor(_rng(ctx) * (ctx.GRID_HEIGHT - 2)) + 1;
      var occupied = ctx.grid[iy][ix] !== ctx.TILES.EMPTY || ctx.breakables.some(function(b) { return b.x === ix && b.y === iy && b.hp > 0; }) || ctx.enemies.some(function(e) { return e.x === ix && e.y === iy; }) || (ix === ctx.player.x && iy === ctx.player.y);
      if (occupied) { i--; continue; }
      if (typeof CardSystem !== 'undefined') {
        var card;
        var baseType;
        var duplicateAttempts = 0;
        if (shouldSpawnTrenchCoat && i === 0) {
          card = CardSystem.rollTrenchCoat();
          shouldSpawnTrenchCoat = false;
          baseType = 'TRENCH_COAT';
        } else {
          var pityCategory = ctx.checkPityTimer();
          if (pityCategory && i === 0) {
            var pityType = ctx.getPityCard(pityCategory);
            if (pityType) { card = CardSystem.rollCard(pityType); baseType = pityType; }
          }
          while (!card && duplicateAttempts < 5) {
            baseType = CardSystem.getRandomBaseCardByBiome ? CardSystem.getRandomBaseCardByBiome(biome.name, ctx.floor) : CardSystem.getRandomBaseCard();
            if (droppedCardsThisFloor.indexOf(baseType) === -1) { card = CardSystem.rollCard(baseType); break; }
            duplicateAttempts++;
          }
          if (!card) {
            baseType = CardSystem.getRandomBaseCardByBiome ? CardSystem.getRandomBaseCardByBiome(biome.name, ctx.floor) : CardSystem.getRandomBaseCard();
            card = CardSystem.rollCard(baseType);
          }
        }
        droppedCardsThisFloor.push(baseType);
        // CHH: card is now a CardRef { id: 'CI-...', qty: 1 } — trackCardDrop accepts both formats
        ctx.trackCardDrop(card);
        var floorCard = { x: ix, y: iy, type: 'card', card: card, spawnTime: Date.now(), decayTime: 30000 };
        if (typeof WorldItems !== 'undefined') { WorldItems.addItem(floorCard); } else { ctx.items.push(floorCard); }
      }
    }
  }

  function spawnShops(rooms, floorType, ctx) {
    if (typeof ShopSystem === 'undefined') return;
    var shopSpawn = ShopSystem.shouldSpawnShop(ctx.floor, floorType);
    if (!shopSpawn) return;
    var eligibleRooms = rooms.filter(function(room) { return room.w >= 5 && room.h >= 5; });
    if (eligibleRooms.length === 0) eligibleRooms = rooms;
    var shopRoom = eligibleRooms[Math.floor(_rng(ctx) * eligibleRooms.length)];
    var shopX = Math.floor(shopRoom.x + shopRoom.w / 2);
    var shopY = Math.floor(shopRoom.y + shopRoom.h / 2);
    var shopTileType = shopSpawn.type === ShopSystem.SHOP_TYPES.BLACK_MARKET ? ctx.TILES.BLACK_MARKET : ctx.TILES.SHOP;
    if (ctx.grid[shopY][shopX] === ctx.TILES.EMPTY) {
      ctx.grid[shopY][shopX] = shopTileType;
      ctx.shops.push({ x: shopX, y: shopY, type: shopSpawn.type, floor: ctx.floor, opened: false });
    }
  }

  function spawnVents(rooms, floorType, ctx) {
    ctx.vents.length = 0;
    if (floorType === ctx.FLOOR_TYPES.TUTORIAL || floorType === ctx.FLOOR_TYPES.BONFIRE || floorType === ctx.FLOOR_TYPES.BOSS || floorType === ctx.FLOOR_TYPES.FINAL) return;
    if (_rng(ctx) > 0.15) return;
    var eligibleRooms = rooms.filter(function(room) { return room.w >= 4 && room.h >= 4 && room.w <= 8 && room.h <= 8; });
    if (eligibleRooms.length === 0) eligibleRooms = rooms;
    var ventRoom = eligibleRooms[Math.floor(_rng(ctx) * eligibleRooms.length)];
    var ventX = ventRoom.x + 1 + Math.floor(_rng(ctx) * (ventRoom.w - 2));
    var ventY = ventRoom.y + 1 + Math.floor(_rng(ctx) * (ventRoom.h - 2));
    if (ctx.grid[ventY][ventX] === ctx.TILES.EMPTY) {
      var quality = _rng(ctx) < 0.85 ? 'standard' : 'rusty';
      ctx.grid[ventY][ventX] = ctx.TILES.VENT;
      ctx.vents.push({ x: ventX, y: ventY, quality: quality, discovered: false, used: false });
    }
  }

  // ── Biome Bleed ──

  function applyBiomeBleed(rooms, ctx) {
    var currentBiome = ctx.getBiome(ctx.floor);
    if (ctx.visitedBiomes.indexOf(currentBiome.name) === -1) ctx.visitedBiomes.push(currentBiome.name);
    if (ctx.previousBiome && ctx.previousBiome.name !== currentBiome.name) applyBleedTiles(ctx.previousBiome, 'entrance', 5, 10, ctx);
    if (ctx.floor < 30) {
      if (!ctx.nextBiomePreview) ctx.nextBiomePreview = ctx.getBiome(ctx.floor + 1);
      if (ctx.nextBiomePreview.name !== currentBiome.name) applyBleedTiles(ctx.nextBiomePreview, 'exit', 5, 10, ctx);
    }
    return currentBiome;  // caller sets _previousBiome
  }

  function applyBleedTiles(biome, location, minCount, maxCount, ctx) {
    var count = minCount + Math.floor(_rng(ctx) * (maxCount - minCount + 1));
    var bleedChar = getBleedChar(biome, ctx);
    if (!bleedChar) return;
    for (var i = 0; i < count; i++) {
      var x, y;
      if (location === 'entrance') {
        x = 1 + Math.floor(_rng(ctx) * 8);
        y = 1 + Math.floor(_rng(ctx) * (ctx.GRID_HEIGHT - 2));
      } else {
        x = ctx.GRID_WIDTH - 9 + Math.floor(_rng(ctx) * 8);
        y = 1 + Math.floor(_rng(ctx) * (ctx.GRID_HEIGHT - 2));
      }
      if (ctx.grid[y] && ctx.grid[y][x] === ctx.TILES.EMPTY) ctx.grid[y][x] = bleedChar;
    }
  }

  function getBleedChar(biome, ctx) {
    switch (biome.name) {
      case 'Cozy Forest': return ctx.TILES.GRASS;
      case 'Shopping Mall': return ctx.TILES.DEBRIS;
      case 'Industrial Complex': return ctx.TILES.HAZARD;
      case 'Grey Cave': return ctx.TILES.SHADOW;
      case 'Aerospace Museum': return ctx.TILES.DEBRIS;
      default: return null;
    }
  }

  function validateStealthPath(startX, startY, endX, endY, ctx) {
    var queue = [{ x: startX, y: startY, steps: 0 }];
    var visited = {};
    visited[startX + ',' + startY] = true;
    while (queue.length > 0 && queue[0].steps < 100) {
      var current = queue.shift();
      if (current.x === endX && current.y === endY) return true;
      var neighbors = [{ x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y }, { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 }];
      for (var i = 0; i < neighbors.length; i++) {
        var n = neighbors[i];
        var key = n.x + ',' + n.y;
        if (n.x >= 0 && n.x < ctx.GRID_WIDTH && n.y >= 0 && n.y < ctx.GRID_HEIGHT && !visited[key] && ctx.grid[n.y][n.x] !== ctx.TILES.WALL) {
          visited[key] = true;
          queue.push({ x: n.x, y: n.y, steps: current.steps + 1 });
        }
      }
    }
    return false;
  }

  function spawnBreakables(ctx) {
    var biome = ctx.getBiome(ctx.floor);
    ctx.breakables.length = 0;
    // Delegate to monolith's _spawnBreakables for now (too many biome-specific props)
    // This is a placeholder — full extraction would require prop table data
    return;
  }

  // ── Public API ──

  return {
    // Biome visuals
    pickWeightedChar: pickWeightedChar,
    pickWeightedCharWithRNG: pickWeightedCharWithRNG,
    getNeighborTiles: getNeighborTiles,
    buildBiomeVisualGrid: buildBiomeVisualGrid,
    generateTileRenderObjects: generateTileRenderObjects,
    buildTileRenderObjects: buildTileRenderObjects,
    // Color utilities
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    lerpColor: lerpColor,
    buildBiomeBackgroundColors: buildBiomeBackgroundColors,
    // Forest API
    createBordersForest: createBordersForest,
    generateForestOpenSpace: generateForestOpenSpace,
    placeVillageClusterOnMap: placeVillageClusterOnMap,
    placeVillageCluster: placeVillageCluster,
    // Core grid generation
    createEmptyGrid: createEmptyGrid,
    generateRooms: generateRooms,
    connectRooms: connectRooms,
    carveCorridor: carveCorridor,
    addBranchConnections: addBranchConnections,
    // Tile placement
    placeCover: placeCover,
    placeShadowZones: placeShadowZones,
    placeEnvironmentalTiles: placeEnvironmentalTiles,
    ensurePlayerOnEmptyTile: ensurePlayerOnEmptyTile,
    placePlayerAndExit: placePlayerAndExit,
    // Entity spawning
    choosePatrolType: choosePatrolType,
    createEnemy: createEnemy,
    placeEnemies: placeEnemies,
    placeItems: placeItems,
    spawnShops: spawnShops,
    spawnVents: spawnVents,
    // Biome bleed
    applyBiomeBleed: applyBiomeBleed,
    applyBleedTiles: applyBleedTiles,
    getBleedChar: getBleedChar,
    // Validation
    validateStealthPath: validateStealthPath
  };
})();
