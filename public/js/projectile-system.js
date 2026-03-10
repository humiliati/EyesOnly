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

  // ── Sprite animation preload ──
  var _spriteMoving = [];    // Image objects for moving frames (1-7)
  var _spriteExplosion = []; // Image objects for explosion frames (1-5)
  var _spritesLoaded = false;

  (function _preloadSprites() {
    var basePath = 'assets/fireBallStylOo/individual files/';
    var i;
    for (i = 1; i <= 7; i++) {
      var img = new Image();
      img.src = basePath + 'fireBallMoving/fireballMoving' + i + '.png';
      _spriteMoving.push(img);
    }
    for (i = 1; i <= 5; i++) {
      var eImg = new Image();
      eImg.src = basePath + 'fireBallExplosion/fireballExplosion' + i + '.png';
      _spriteExplosion.push(eImg);
    }
    // Mark loaded after last image
    _spriteExplosion[4].onload = function() { _spritesLoaded = true; };
    // Fallback: mark loaded after 2s regardless
    setTimeout(function() { _spritesLoaded = true; }, 2000);
  })();

  // ── Constants ──
  var _MAX_ACTIVE_PROJECTILES = 8;  // Jezzball feel: cap simultaneous live projectiles
  var _MAX_RICOCHETS_BEFORE_DECAY = 5; // After this many total ricochets, shrink-to-zero
  var _MAX_RANGE_AFTER_RICOCHET = 30; // Total distance before forced cleanup

  // ── Fire-rate throttle ──
  // Base cooldown: attack-1 sound plays at ~half the fire rate.
  // attack-1 is ~200-300ms; fire cooldown = 2× that ≈ 500ms base.
  // Items can increase (faster weapons) or decrease (slower weapons) this.
  var _BASE_FIRE_COOLDOWN_MS = 500;
  var _lastFireTime = 0;

  /**
   * Check if player can fire (cooldown elapsed).
   * @param {Object} [ctx] - context for item modifier lookup
   * @returns {boolean}
   */
  function _canFire(ctx) {
    var now = Date.now();
    var cooldown = _BASE_FIRE_COOLDOWN_MS;

    // Item modifier: active item can adjust fire rate
    // fireRateModifier < 1 = faster, > 1 = slower
    try {
      if (typeof GAMESTATE !== 'undefined' && GAMESTATE.getActiveItem) {
        var item = GAMESTATE.getActiveItem();
        if (item && item.fireRateModifier) {
          cooldown *= item.fireRateModifier;
        }
      }
    } catch (e) {}

    // Passive item modifiers
    try {
      if (typeof PassiveItemsSystem !== 'undefined' && PassiveItemsSystem.getEquippedItems) {
        var passives = PassiveItemsSystem.getEquippedItems() || [];
        for (var i = 0; i < passives.length; i++) {
          if (passives[i] && passives[i].fireRateModifier) {
            cooldown *= passives[i].fireRateModifier;
          }
        }
      }
    } catch (e2) {}

    return (now - _lastFireTime) >= cooldown;
  }

  /**
   * Check ammo, spend 1, flash debrief. Returns true if ammo was available.
   * If no ammo, plays empty clip sound and flashes debrief negative.
   */
  function _trySpendAmmo() {
    if (typeof GAMESTATE === 'undefined') return true; // no gamestate = free fire

    var ammo = GAMESTATE.getAmmo ? GAMESTATE.getAmmo() : 1;
    if (ammo <= 0) {
      // Empty clip — play clang8 and flash debrief
      _lastFireTime = Date.now(); // still apply cooldown to prevent spam clicks
      try {
        if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
          AudioSystem.play('clang8', { volume: 0.5 });
        }
      } catch (e) {}
      try {
        if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
          DebriefFeedController.reportResourceChange('Ammo', 0, 0, 'Empty');
        }
      } catch (e2) {}
      return false;
    }

    // Spend 1 ammo
    var ammoBefore = ammo;
    if (GAMESTATE.useAmmo) GAMESTATE.useAmmo(1);
    var ammoAfter = GAMESTATE.getAmmo ? GAMESTATE.getAmmo() : (ammoBefore - 1);

    // Flash debrief feed for ammo spend
    try {
      if (typeof DebriefFeedController !== 'undefined' && DebriefFeedController.reportResourceChange) {
        DebriefFeedController.reportResourceChange('Ammo', ammoBefore, ammoAfter, 'Fire');
      }
    } catch (e3) {}

    return true;
  }

  /**
   * Play attack sound and mark fire timestamp
   */
  function _onFire() {
    _lastFireTime = Date.now();
    try {
      if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
        AudioSystem.play('attack-1', { volume: 0.6 });
      }
    } catch (e) {}
  }

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

  // ── Core: advance one projectile per step ──
  // Projectiles store prevFx/prevFy for lerp rendering between ticks.
  // After ricochet, owner flips to 'ricochet' enabling friendly fire.

  function _advanceProjectile(projectile, ctx) {
    if (!projectile) return { alive: false };

    // Exploding projectiles stay alive for animation (300ms = 5 frames × 60ms)
    if (projectile.state === 'exploding') {
      if (!projectile.explodeStart) projectile.explodeStart = Date.now();
      // No movement, just animate until explosion finishes
      projectile.prevFx = projectile.fx;
      projectile.prevFy = projectile.fy;
      projectile.lerpT = 1;
      return { alive: (Date.now() - projectile.explodeStart) < 300 };
    }

    if (projectile.fx === undefined) projectile.fx = projectile.x;
    if (projectile.fy === undefined) projectile.fy = projectile.y;

    if (projectile.vx === undefined) {
      var len = Math.sqrt(projectile.dx * projectile.dx + projectile.dy * projectile.dy) || 1;
      projectile.vx = projectile.dx / len;
      projectile.vy = projectile.dy / len;
      projectile.speed = 2.5;  // was 1.0 — much faster than player sprint
      projectile.bounces = projectile.bounces || 0;
    }

    // Track previous position for lerp rendering
    projectile.prevFx = projectile.fx;
    projectile.prevFy = projectile.fy;
    projectile.lerpT = 0; // reset lerp progress (rendering increments this)

    // Initialize animation state
    if (projectile.animFrame === undefined) {
      projectile.animFrame = 0;
      projectile.animTime = Date.now();
      projectile.totalRicochets = 0;
      projectile.totalDistance = 0;
      projectile.state = 'flying'; // 'flying', 'ricochet', 'exploding', 'shrinking'
      projectile.shrinkScale = 1.0;
    }

    var spd = projectile.speed || 2.5;
    var nextFx = projectile.fx + projectile.vx * spd;
    var nextFy = projectile.fy + projectile.vy * spd;
    var nextX = Math.round(nextFx);
    var nextY = Math.round(nextFy);

    // Out of bounds
    if (!ctx.isInsideBounds(nextX, nextY)) {
      projectile.state = 'exploding';
      projectile.explodeStart = Date.now();
      projectile.animTime = Date.now();
      _addImpactEffect(Math.round(projectile.fx), Math.round(projectile.fy), 'miss', ctx);
      return { alive: true };
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
        projectile.totalRicochets = (projectile.totalRicochets || 0) + 1;
        // After first ricochet, projectile becomes dangerous to everyone (friendly fire)
        if (projectile.totalRicochets >= 1) {
          projectile.owner = 'ricochet';
        }
        // Power decays: damage / ricochets
        projectile.power = Math.max(1, Math.floor((projectile.basePower || projectile.power || 3) / Math.max(1, projectile.totalRicochets)));
        // Play ricochet animation: first explosion frame, then back to rolling
        projectile.state = 'ricochet';
        projectile.ricochetTime = Date.now();
        _addImpactEffect(nextX, nextY, 'wall', ctx);

        // Check jezzball cleanup: too many ricochets or too far traveled
        if (projectile.totalRicochets >= _MAX_RICOCHETS_BEFORE_DECAY) {
          projectile.state = 'shrinking';
        }
        return { alive: true };
      } else {
        projectile.state = 'exploding';
        projectile.explodeStart = Date.now();
        projectile.animTime = Date.now();
        _addImpactEffect(nextX, nextY, 'wall', ctx);
        return { alive: true };
      }
    }

    // Breakable collision
    var breakable = ctx.getBreakableAt(nextX, nextY);
    if (breakable && breakable.hp > 0) {
      ctx.damageBreakable(breakable, projectile.power || 1);
      projectile.state = 'exploding';
      projectile.explodeStart = Date.now();
      projectile.animTime = Date.now();
      _addImpactEffect(nextX, nextY, 'breakable', ctx);
      return { alive: true };
    }

    // Enemy collision
    var enemy = ctx.enemies.find(function(e) { return e.x === nextX && e.y === nextY && e.hp > 0; });
    if (enemy) {
      if (projectile.owner === 'player') {
        projectile.state = 'exploding';
        projectile.explodeStart = Date.now();
        projectile.animTime = Date.now();
        _addImpactEffect(nextX, nextY, 'enemy', ctx);
        return { alive: true, action: ctx.enterStrCombat(enemy, 'player_attack', projectile.card) };
      }
      // Ricochet or enemy projectile: direct damage
      enemy.hp = Math.max(0, enemy.hp - (projectile.power || 1));
      projectile.state = 'exploding';
      projectile.explodeStart = Date.now();
      projectile.animTime = Date.now();
      _addImpactEffect(nextX, nextY, 'enemy', ctx);
      return { alive: true };
    }

    // Player collision — ricochet bullets cause friendly fire!
    var hitsPlayer = (ctx.player.x === nextX && ctx.player.y === nextY);
    if (hitsPlayer) {
      if (projectile.owner === 'ricochet') {
        // Friendly fire: knockback damage of 1 + bullet damage / ricochets
        var ricochetDmg = Math.max(1, Math.floor((projectile.basePower || 3) / Math.max(1, projectile.totalRicochets || 1)));
        var knockbackDmg = 1;
        var totalDmg = knockbackDmg + ricochetDmg;
        try {
          if (typeof GAMESTATE !== 'undefined' && GAMESTATE.takeDamage) {
            GAMESTATE.takeDamage(totalDmg, 'ricochet');
          }
        } catch (e) {}
        projectile.state = 'exploding';
        projectile.explodeStart = Date.now();
        projectile.animTime = Date.now();
        _addImpactEffect(nextX, nextY, 'enemy', ctx);
        return { alive: true };
      } else if (projectile.owner !== 'player') {
        var sourceEnemy = projectile.sourceEnemy || ctx.enemies.find(function(e) { return e.hp > 0; });
        if (sourceEnemy) {
          projectile.state = 'exploding';
          projectile.explodeStart = Date.now();
          projectile.animTime = Date.now();
          return { alive: true, action: ctx.enterStrCombat(sourceEnemy, 'enemy_attack') };
        }
      }
      // Player's own projectile passes through player
      // (prevents spawn-behind-player sticking bug)
    }

    // Advance position
    projectile.fx = nextFx;
    projectile.fy = nextFy;
    projectile.x = nextX;
    projectile.y = nextY;
    projectile.totalDistance = (projectile.totalDistance || 0) + spd;
    projectile.range = (projectile.range || 1) - spd;

    // Ricochet animation: return to flying after brief flash
    if (projectile.state === 'ricochet' && Date.now() - (projectile.ricochetTime || 0) > 120) {
      projectile.state = 'flying';
    }

    // Shrinking state: rapidly shrink scale, die at zero
    if (projectile.state === 'shrinking') {
      projectile.shrinkScale = (projectile.shrinkScale || 1.0) * 0.75;
      if (projectile.shrinkScale < 0.05) {
        _addImpactEffect(nextX, nextY, 'poof', ctx);
        return { alive: false };
      }
    }

    // Range exhaustion or distance cap
    if (projectile.range <= 0 || projectile.totalDistance >= _MAX_RANGE_AFTER_RICOCHET) {
      if (projectile.totalRicochets > 0) {
        // Bounced projectile shrinks out instead of exploding
        projectile.state = 'shrinking';
        return { alive: true };
      }
      projectile.state = 'exploding';
      projectile.explodeStart = Date.now();
      projectile.animTime = Date.now();
      _addImpactEffect(nextX, nextY, 'miss', ctx);
      return { alive: true };
    }

    return { alive: true };
  }

  // ── Public API ──

  /**
   * Create & fire a projectile from a parsed direction command.
   * Returns { glyph, direction } — caller handles renderGrid/getPrompt.
   */
  function fireProjectile(cmd, ctx) {
    // Fire-rate throttle
    if (!_canFire(ctx)) return null;

    // Ammo check — spend 1 or play empty clip
    if (!_trySpendAmmo()) return null;

    var origin = _getFiringOrigin(ctx);
    var dir = ctx.parseDirection(cmd);
    var len = Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy) || 1;
    var vx = dir.dx / len;
    var vy = dir.dy / len;

    // Jezzball cap: don't spawn if too many active projectiles
    if (_projectiles.length >= _MAX_ACTIVE_PROJECTILES) return null;

    var projectile = {
      x: origin.x, y: origin.y,
      fx: origin.x, fy: origin.y,
      prevFx: origin.x, prevFy: origin.y, lerpT: 1,
      dx: dir.dx, dy: dir.dy, vx: vx, vy: vy,
      speed: 2.5, bounces: 3,
      glyph: _getProjectileGlyph(dir.direction),
      emoji: '\uD83D\uDCA5', range: 15, power: 3, basePower: 3, owner: 'player',
      // Animation state
      state: 'flying', animFrame: 0, animTime: Date.now(),
      totalRicochets: 0, totalDistance: 0, shrinkScale: 1.0
    };

    _muzzleFlash = { x: origin.x, y: origin.y, time: Date.now() };
    setTimeout(function() { _muzzleFlash = null; }, 300);

    // Snap weapon arrow to fire direction
    if (typeof PlayerWeaponArrow !== 'undefined') {
      PlayerWeaponArrow.setFireDirection(dir.direction);
    }

    _projectiles.push(projectile);
    _onFire(); // play attack-1 SFX + mark cooldown
    return { glyph: projectile.glyph, direction: dir.direction };
  }

  /**
   * Fire a projectile toward a clicked target coordinate.
   * Returns { glyph, direction } or null — caller handles renderGrid/getPrompt.
   */
  function fireProjectileAtTarget(targetX, targetY, ctx) {
    if (!ctx.active || !ctx.player) return null;

    // Fire-rate throttle
    if (!_canFire(ctx)) return null;

    // Ammo check — spend 1 or play empty clip
    if (!_trySpendAmmo()) return null;

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

    // Jezzball cap: don't spawn if too many active projectiles
    if (_projectiles.length >= _MAX_ACTIVE_PROJECTILES) return null;

    var projectile = {
      x: origin.x, y: origin.y,
      fx: origin.x, fy: origin.y,
      prevFx: origin.x, prevFy: origin.y, lerpT: 1,
      dx: dx, dy: dy, vx: vx, vy: vy,
      speed: 2.5, bounces: 3,
      glyph: _getProjectileGlyph(dirName),
      emoji: '\uD83D\uDCA5', range: 15, power: 3, basePower: 3, owner: 'player',
      // Animation state
      state: 'flying', animFrame: 0, animTime: Date.now(),
      totalRicochets: 0, totalDistance: 0, shrinkScale: 1.0
    };

    _muzzleFlash = { x: origin.x, y: origin.y, time: Date.now() };
    setTimeout(function() { _muzzleFlash = null; }, 300);

    // Snap weapon arrow toward target (uses dx/dy for precise angle)
    if (typeof PlayerWeaponArrow !== 'undefined') {
      PlayerWeaponArrow.setFireDirection({ dx: dx, dy: dy });
    }

    _projectiles.push(projectile);
    _onFire(); // play attack-1 SFX + mark cooldown
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

  /**
   * Update lerp progress on all live projectiles.
   * Called every animation frame (not just tick) for smooth interpolation.
   * @param {number} msSinceTick - ms elapsed since last projectile tick
   * @param {number} tickInterval - the projectile advance interval in ms
   */
  function updateLerp(msSinceTick, tickInterval) {
    var t = tickInterval > 0 ? Math.min(1, msSinceTick / tickInterval) : 1;
    for (var i = 0; i < _projectiles.length; i++) {
      _projectiles[i].lerpT = t;
    }
  }

  /**
   * Get the sprite animation frame for a projectile.
   * Cycles moving frames during 'flying', shows explosion[0] during 'ricochet',
   * plays full explosion sequence during 'exploding'.
   * Returns { img: Image|null, frameIndex: number }
   */
  function getSpriteFrame(projectile) {
    if (!_spritesLoaded) return { img: null, frameIndex: 0 };

    var now = Date.now();
    var elapsed = now - (projectile.animTime || now);

    if (projectile.state === 'ricochet') {
      // First explosion frame = ricochet flash
      return { img: _spriteExplosion[0] || null, frameIndex: 0 };
    }
    if (projectile.state === 'exploding') {
      // Play explosion sequence: 5 frames at ~60ms each = 300ms
      var eFrame = Math.min(4, Math.floor(elapsed / 60));
      return { img: _spriteExplosion[eFrame] || null, frameIndex: eFrame };
    }
    // Flying or shrinking: cycle moving frames (7 frames at ~80ms each)
    var mFrame = Math.floor(elapsed / 80) % 7;
    projectile.animFrame = mFrame;
    return { img: _spriteMoving[mFrame] || null, frameIndex: mFrame };
  }

  return {
    fireProjectile: fireProjectile,
    fireProjectileAtTarget: fireProjectileAtTarget,
    updateProjectiles: updateProjectiles,
    stepProjectiles: stepProjectiles,
    updateLerp: updateLerp,
    getSpriteFrame: getSpriteFrame,
    getProjectiles: function() { return _projectiles; },
    getMuzzleFlash: function() { return _muzzleFlash; },
    setProjectiles: function(arr) { _projectiles = arr || []; },
    addProjectile: function(p) { _projectiles.push(p); },
    reset: function() { _projectiles = []; _muzzleFlash = null; _lastFireTime = 0; },
    canFire: function() { return _canFire(); },
    getFireCooldownMs: function() { return _BASE_FIRE_COOLDOWN_MS; },
    getSpritesLoaded: function() { return _spritesLoaded; },
    getSpriteMoving: function() { return _spriteMoving; },
    getSpriteExplosion: function() { return _spriteExplosion; }
  };
})();
