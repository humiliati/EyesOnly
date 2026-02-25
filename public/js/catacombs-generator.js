/* ============================================================
   Catacombs Generator (v0)
   Procedural dungeon for the church catacombs side-quest.
   ============================================================ */
var CatacombsGenerator = (function() {
  'use strict';
  var TILES = { EMPTY: '.', WALL: '█', DOOR: '🚪' };

  var ENEMY_TEMPLATES = [
    { emoji: '💀', name: 'Skeleton Warrior', hp: 3, attack: 1, defense: 0, sightRange: 2, patrolType: 'stationary' },
    { emoji: '👻', name: 'Restless Ghost', hp: 2, attack: 2, defense: 0, sightRange: 3, patrolType: 'circular' },
    { emoji: '🦴', name: 'Bone Rattler', hp: 2, attack: 1, defense: 0, sightRange: 1, patrolType: 'stationary' }
  ];

  function _makeRng(seed) {
    var s = seed || (Date.now() ^ (Math.random() * 0xFFFFFFFF));
    return function() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generate(config) {
    config = config || {};
    var rng = _makeRng(config.seed);
    var GRID_W = 40, GRID_H = 20;

    var grid = [];
    for (var y = 0; y < GRID_H; y++) {
      grid[y] = [];
      for (var x = 0; x < GRID_W; x++) grid[y][x] = TILES.WALL;
    }

    var rooms = _generateRooms(rng, GRID_W, GRID_H, 4, 6);
    for (var ri = 0; ri < rooms.length; ri++) {
      var room = rooms[ri];
      for (var ry = room.y; ry < room.y + room.h; ry++) {
        for (var rx = room.x; rx < room.x + room.w; rx++) {
          if (ry >= 0 && ry < GRID_H && rx >= 0 && rx < GRID_W) grid[ry][rx] = TILES.EMPTY;
        }
      }
    }

    for (var ci = 1; ci < rooms.length; ci++) _connectRooms(grid, rooms[ci-1], rooms[ci], rng, GRID_W, GRID_H);
    if (rooms.length > 3 && rng() < 0.5) {
      var a = Math.floor(rng() * rooms.length), b = Math.floor(rng() * rooms.length);
      if (a !== b) _connectRooms(grid, rooms[a], rooms[b], rng, GRID_W, GRID_H);
    }

    var startRoom = rooms[0];
    rooms.sort(function(a, b) {
      return (Math.abs(a.cx - startRoom.cx) + Math.abs(a.cy - startRoom.cy)) -
             (Math.abs(b.cx - startRoom.cx) + Math.abs(b.cy - startRoom.cy));
    });
    var deepestRoom = rooms[rooms.length - 1];

    var spawns = { player: { x: startRoom.cx, y: startRoom.cy } };
    var exits = { back: { x: startRoom.cx, y: startRoom.y + startRoom.h - 1 } };
    if (grid[exits.back.y] && grid[exits.back.y][exits.back.x] !== TILES.EMPTY) {
      exits.back = { x: startRoom.cx, y: startRoom.cy + 1 };
    }

    var enemies = [];
    for (var ei = 1; ei < rooms.length; ei++) {
      var eRoom = rooms[ei];
      var numEn = (ei === rooms.length - 1) ? 2 : 1;
      for (var ne = 0; ne < numEn; ne++) {
        var tmpl = ENEMY_TEMPLATES[Math.floor(rng() * ENEMY_TEMPLATES.length)];
        var ex = eRoom.x + 1 + Math.floor(rng() * Math.max(1, eRoom.w - 2));
        var ey = eRoom.y + 1 + Math.floor(rng() * Math.max(1, eRoom.h - 2));
        if (ex === spawns.player.x && ey === spawns.player.y) continue;
        var pp = [];
        if (tmpl.patrolType === 'circular') {
          pp = [
            {x: eRoom.x+1, y: eRoom.y+1}, {x: eRoom.x+eRoom.w-2, y: eRoom.y+1},
            {x: eRoom.x+eRoom.w-2, y: eRoom.y+eRoom.h-2}, {x: eRoom.x+1, y: eRoom.y+eRoom.h-2}
          ];
        }
        enemies.push({
          x: ex, y: ey, hp: tmpl.hp, maxHp: tmpl.hp, attack: tmpl.attack, defense: tmpl.defense,
          emoji: tmpl.emoji, name: tmpl.name, sightRange: tmpl.sightRange, state: 'idle',
          patrolType: tmpl.patrolType, patrolPath: pp, patrolIndex: 0, drops: { currency: [5, 15], cards: 0.3 }
        });
      }
    }

    var currencies = [], breakables = [];
    var lootAmt = 20 + Math.floor(rng() * 11);
    var piles = 3 + Math.floor(rng() * 3);
    var perPile = Math.floor(lootAmt / piles);
    for (var li = 0; li < piles; li++) {
      currencies.push({
        x: deepestRoom.x + 1 + Math.floor(rng() * Math.max(1, deepestRoom.w - 2)),
        y: deepestRoom.y + 1 + Math.floor(rng() * Math.max(1, deepestRoom.h - 2)),
        amount: perPile
      });
    }
    breakables.push({ x: deepestRoom.cx, y: deepestRoom.cy, emoji: '🧰', name: 'Ancient Chest', hp: 2, drops: { currency: [15, 25], cards: 1.0 } });
    for (var bi = 1; bi < rooms.length - 1; bi++) {
      if (rng() < 0.6) {
        breakables.push({
          x: rooms[bi].x + 1 + Math.floor(rng() * Math.max(1, rooms[bi].w - 2)),
          y: rooms[bi].y + 1 + Math.floor(rng() * Math.max(1, rooms[bi].h - 2)),
          emoji: '🦴', name: 'Bone Pile', hp: 1, drops: { currency: [2, 6] }
        });
      }
    }

    return { grid: grid, enemies: enemies, spawns: spawns, exits: exits, currencies: currencies, breakables: breakables };
  }

  function _generateRooms(rng, gridW, gridH, minR, maxR) {
    var rooms = [], target = minR + Math.floor(rng() * (maxR - minR + 1)), att = 0;
    while (rooms.length < target && att < 200) {
      att++;
      var w = 4 + Math.floor(rng() * 5), h = 3 + Math.floor(rng() * 4);
      var x = 2 + Math.floor(rng() * (gridW - w - 4)), y = 2 + Math.floor(rng() * (gridH - h - 4));
      var ok = true;
      for (var ri = 0; ri < rooms.length; ri++) {
        var r = rooms[ri];
        if (x-1 < r.x+r.w && x+w+1 > r.x && y-1 < r.y+r.h && y+h+1 > r.y) { ok = false; break; }
      }
      if (ok) rooms.push({ x:x, y:y, w:w, h:h, cx: Math.floor(x+w/2), cy: Math.floor(y+h/2) });
    }
    return rooms;
  }

  function _connectRooms(grid, rA, rB, rng, gW, gH) {
    if (rng() < 0.5) { _carveH(grid, rA.cx, rB.cx, rA.cy, gW, gH); _carveV(grid, rB.cx, rA.cy, rB.cy, gW, gH); }
    else { _carveV(grid, rA.cx, rA.cy, rB.cy, gW, gH); _carveH(grid, rA.cx, rB.cx, rB.cy, gW, gH); }
  }
  function _carveH(g,x1,x2,y,gW,gH) { for (var x=Math.min(x1,x2); x<=Math.max(x1,x2); x++) { if (y>=0&&y<gH&&x>=0&&x<gW) g[y][x]=TILES.EMPTY; } }
  function _carveV(g,x,y1,y2,gW,gH) { for (var y=Math.min(y1,y2); y<=Math.max(y1,y2); y++) { if (y>=0&&y<gH&&x>=0&&x<gW) g[y][x]=TILES.EMPTY; } }

  if (typeof InteriorFloors !== 'undefined') InteriorFloors.registerGenerator('catacombs', generate);

  return { generate: generate, ENEMY_TEMPLATES: ENEMY_TEMPLATES };
})();
