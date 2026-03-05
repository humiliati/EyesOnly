/**
 * ProjectileSystem — Extracted from gone-rogue.js (Phase 6)
 * Owns projectile state (_projectiles, _muzzleFlash) and all
 * projectile creation / advancement / collision logic.
 * Monolith syncs shadow variables via _syncProjectileState().
 */
var ProjectileSystem = (function() {
  'use strict';

  // ── Owned state ──
  var _projectiles = [];
  var _muzzleFlash = null;

  // ── Helpers ──

  /**
   * Get the player's current firing origin position.
   * When GoneRogueMovement is active and the player is mid-travel,
   * ctx.player.x/y (logical position) may lag behind the avatar by
   * several tiles. We use the visual position rounded to nearest tile
   * for accurate projectile spawn, falling back to logical position.
   */
  function _getFiringOrigin(ctx) {
    if (typeof GoneRogueMovement !== 'undefined' && GoneRogueMovement.getVisualPosition) {
      var vis = GoneRogueMovement.getVisualPosition();
      if (vis && isFinite(vis.x) && isFinite(vis.y)) {
        return { x: Math.round(vis.x), y: Math.round(vis.y) };
      }
    }
    return { x: ctx.player.x, y: ctx.player.y };
  }

  function _getProjectileGlyph(direction) {
    var glyphs = {
      'north': '\u2191',
      'south': '\u2193',
      'east': '\u2192',
      'west': '\u2190',
      'northeast': './',
      'northwest': '/',
      'southeast': '.\\',
      'southwest': '\\'
    };
    return glyphs[direction] || '\uD83D\uDCA5';
  }

  function _addImpactEffect(x, y, type, ctx) {
    var impactChar = '\uD83D\uDCA5';
    if (type === 'breakable') impactChar = '\uD83D\uDCAB';
    else if (type === 'enemy') impactChar = '\uD83D\uDCA5';
    else if (type === 'wall') impactChar = '\u2728';
    else if (type === 'miss') impactChar = '\uD83D\uDCA8';
    else if (type === 'poof') impactChar = '\uD83D\uDCA8';

    var effect = { x: x, y: y, type: type, char: impactChar, time: Date.now() };
    ctx.impactEffects.push(effect);

    setTimeout(function() {
      var index = ctx.impactEffects.indexOf(effect);
      if (index > -1) ctx.impactEffects.splice(index, 1);
    }, 400);
  }

  // ── Core: advance one projectile one tile ──

  function _advanceProjectile(projectile, ctx) {
    if (!projectile) return { alive: false };

    if (projectile.fx === undefined) projectile.fx = projectile.x;
    if (projectile.fy === undefined) projectile.fy = projectile.y;

    if (projectile.vx === undefined) {
      var len = Math.sqrt(projectile.dx * projectile.dx + projectile.dy * projectile.dy) || 1;
      projectile.vx = projectile.dx / len;
      projectile.vy = projectile.dy / len;
      projectile.speed = 1.0;
      projectile.bounces = projectile.bounces || 0;
    }

    var nextFx = projectile.fx + projectile.vx * (projectile.speed || 1.0);
    var nextFy = projectile.fy + projectile.vy * (projectile.speed || 1.0);
    var nextX = Math.round(nextFx);
    var nextY = Math.round(nextFy);

    // Out of bounds
    if (!ctx.isInsideBounds(nextX, nextY)) {
      _addImpactEffect(Math.round(projectile.fx), Math.round(projectile.fy), 'miss', ctx);
      return { alive: false };
    }

    // Wall collision / bounce
    var tile = ctx.grid[nextY][nextX];
    if (tile === ctx.TILES.WALL) {
      if ((projectile.bounces || 0) > 0) {
        var curX = Math.round(projectile.fx);
        var curY = Math.round(projectile.fy);
        if (curX !== nextX && ctx.grid[curY] && ctx.grid[curY][nextX] === ctx.TILES.WALL) {
          projectile.vx *= -1;
        } else if (curY !== nextY && ctx.grid[nextY] && ctx.grid[nextY][curX] === ctx.TILES.WALL) {
          projectile.vy *= -1;
        } else {
          projectile.vx *= -1;
          projectile.vy *= -1;
        }
        projectile.bounces--;
        projectile.power = Math.max(1, (projectile.power || 1) - 1);
        _addImpactEffect(nextX, nextY, 'wall', ctx);
        return { alive: true };
      } else {
        _addImpactEffect(nextX, nextY, 'wall', ctx);
        return { alive: false };
      }
    }

    // Breakable collision
    var breakable = ctx.getBreakableAt(nextX, nextY);
    if (breakable && breakable.hp > 0) {
      ctx.damageBreakable(breakable, projectile.power || 1);
      _addImpactEffect(nextX, nextY, 'breakable', ctx);
      return { alive: false };
    }

    // Enemy collision
    var enemy = ctx.enemies.find(function(e) { return e.x === nextX && e.y === nextY && e.hp > 0; });
    if (enemy) {
      if (projectile.owner === 'player') {
        _addImpactEffect(nextX, nextY, 'enemy', ctx);
        return { alive: false, action: ctx.enterStrCombat(enemy, 'player_attack', projectile.card) };
      }
      enemy.hp = Math.max(0, enemy.hp - (projectile.power || 1));
      _addImpactEffect(nextX, nextY, 'enemy', ctx);
      return { alive: false };
    }

    // Player collision
    var hitsPlayer = (ctx.player.x === nextX && ctx.player.y === nextY);
    if (hitsPlayer) {
      if (projectile.owner !== 'player') {
        var sourceEnemy = projectile.sourceEnemy || ctx.enemies.find(function(e) { return e.hp > 0; });
        if (sourceEnemy) {
          return { alive: false, action: ctx.enterStrCombat(sourceEnemy, 'enemy_attack') };
        }
      }
      return { alive: false };
    }

    // Advance position
    projectile.fx = nextFx;
    projectile.fy = nextFy;
    projectile.x = nextX;
    projectile.y = nextY;
    projectile.range = (projectile.range || 1) - (projectile.speed || 1);

    if (projectile.range <= 0) {
      _addImpactEffect(nextX, nextY, 'miss', ctx);
      return { alive: false };
    }

    return { alive: true };
  }

  // ── Public API ──

  /**
   * Create & fire a projectile from a parsed direction command.
   * Returns { glyph, direction } — caller handles renderGrid/getPrompt.
   */
  function fireProjectile(cmd, ctx) {
    var origin = _getFiringOrigin(ctx);
    var dir = ctx.parseDirection(cmd);
    var len = Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy) || 1;
    var vx = dir.dx / len;
    var vy = dir.dy / len;

    var projectile = {
      x: origin.x, y: origin.y,
      fx: origin.x, fy: origin.y,
      dx: dir.dx, dy: dir.dy, vx: vx, vy: vy,
      speed: 1.0, bounces: 3,
      glyph: _getProjectileGlyph(dir.direction),
      emoji: '\uD83D\uDCA5', range: 15, power: 3, owner: 'player'
    };

    _muzzleFlash = { x: origin.x, y: origin.y, time: Date.now() };
    setTimeout(function() { _muzzleFlash = null; }, 300);

    // Snap weapon arrow to fire direction
    if (typeof PlayerWeaponArrow !== 'undefined') {
      PlayerWeaponArrow.setFireDirection(dir.direction);
    }

    _projectiles.push(projectile);
    return { glyph: projectile.glyph, direction: dir.direction };
  }

  /**
   * Fire a projectile toward a clicked target coordinate.
   * Returns { glyph, direction } or null — caller handles renderGrid/getPrompt.
   */
  function fireProjectileAtTarget(targetX, targetY, ctx) {
    if (!ctx.active || !ctx.player) return null;

    var origin = _getFiringOrigin(ctx);
    var dx = targetX - origin.x;
    var dy = targetY - origin.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return null;

    var vx = dx / dist;
    var vy = dy / dist;

    var dirName = 'east';
    if (Math.abs(dx) > Math.abs(dy)) {
      dirName = dx > 0 ? 'east' : 'west';
    } else {
      dirName = dy > 0 ? 'south' : 'north';
    }

    var projectile = {
      x: origin.x, y: origin.y,
      fx: origin.x, fy: origin.y,
      dx: dx, dy: dy, vx: vx, vy: vy,
      speed: 1.0, bounces: 3,
      glyph: _getProjectileGlyph(dirName),
      emoji: '\uD83D\uDCA5', range: 15, power: 3, owner: 'player'
    };

    _muzzleFlash = { x: origin.x, y: origin.y, time: Date.now() };
    setTimeout(function() { _muzzleFlash = null; }, 300);

    // Snap weapon arrow toward target (uses dx/dy for precise angle)
    if (typeof PlayerWeaponArrow !== 'undefined') {
      PlayerWeaponArrow.setFireDirection({ dx: dx, dy: dy });
    }

    _projectiles.push(projectile);
    return { glyph: projectile.glyph, direction: dirName };
  }

  /**
   * Advance all projectiles by N steps. Returns combat action (or null).
   * Updates internal _projectiles array (dead projectiles are removed).
   */
  function updateProjectiles(deltaMs, steps, ctx) {
    var iterations = steps || 1;
    var action = null;

    for (var i = 0; i < iterations; i++) {
      var survivors = [];
      for (var j = 0; j < _projectiles.length; j++) {
        var result = _advanceProjectile(_projectiles[j], ctx);
        if (result && result.action && !action) action = result.action;
        if (result && result.alive) survivors.push(_projectiles[j]);
      }
      _projectiles = survivors;
    }

    return action;
  }

  /**
   * Step projectiles N ticks — public wrapper returning projectiles + breakables + action.
   */
  function stepProjectiles(steps, ctx) {
    var action = updateProjectiles(0, steps || 1, ctx);
    return { projectiles: _projectiles, breakables: ctx.breakables, action: action };
  }

  return {
    fireProjectile: fireProjectile,
    fireProjectileAtTarget: fireProjectileAtTarget,
    updateProjectiles: updateProjectiles,
    stepProjectiles: stepProjectiles,
    getProjectiles: function() { return _projectiles; },
    getMuzzleFlash: function() { return _muzzleFlash; },
    setProjectiles: function(arr) { _projectiles = arr || []; },
    addProjectile: function(p) { _projectiles.push(p); },
    reset: function() { _projectiles = []; _muzzleFlash = null; }
  };
})();
