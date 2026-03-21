/**
 * PlatformPhysics — Genre Helper Module
 *
 * Gravity, jump arcs, ground/wall collision, and one-way platforms.
 * Operates on any entity that has { x, y, vx, vy, w, h }.
 *
 * Usage:
 *   var physics = new PlatformPhysics({
 *     gravity: 0.48,
 *     maxFallSpeed: 12,
 *     jumpForce: -9.0,
 *     doubleJumpForce: -7.0,
 *     friction: 0.08,     // horizontal drag factor per frame
 *     nudgeSpeed: 0.8     // left/right held-key nudge
 *   });
 *
 *   // In onUpdate:
 *   physics.applyGravity(entity);
 *   physics.applyFriction(entity, 0);  // drag toward 0
 *   physics.nudge(entity, direction);   // -1, 0, or +1
 *
 *   var landed = physics.collidePlatforms(entity, platforms, cameraX);
 *   entity.grounded = landed;
 *
 *   physics.clampToScreen(entity, 20, screenW * 0.7);
 *
 *   // Jump:
 *   physics.jump(entity);       // standard jump
 *   physics.doubleJump(entity); // air jump
 *
 * Depends on: nothing (standalone)
 */
var PlatformPhysics = (function () {
  'use strict';

  var DEFAULT_OPTS = {
    gravity: 0.48,
    maxFallSpeed: 12,
    jumpForce: -9.0,
    doubleJumpForce: -7.0,
    friction: 0.08,
    nudgeSpeed: 0.8
  };

  function PlatformPhysics(opts) {
    opts = opts || {};
    this.gravity = opts.gravity != null ? opts.gravity : DEFAULT_OPTS.gravity;
    this.maxFallSpeed = opts.maxFallSpeed != null ? opts.maxFallSpeed : DEFAULT_OPTS.maxFallSpeed;
    this.jumpForce = opts.jumpForce != null ? opts.jumpForce : DEFAULT_OPTS.jumpForce;
    this.doubleJumpForce = opts.doubleJumpForce != null ? opts.doubleJumpForce : DEFAULT_OPTS.doubleJumpForce;
    this.friction = opts.friction != null ? opts.friction : DEFAULT_OPTS.friction;
    this.nudgeSpeed = opts.nudgeSpeed != null ? opts.nudgeSpeed : DEFAULT_OPTS.nudgeSpeed;
  }

  /**
   * Apply gravity to an entity. Clamps to maxFallSpeed.
   * @param {Object} entity — { vy }
   */
  PlatformPhysics.prototype.applyGravity = function (entity) {
    entity.vy += this.gravity;
    if (entity.vy > this.maxFallSpeed) {
      entity.vy = this.maxFallSpeed;
    }
  };

  /**
   * Apply horizontal friction (lerp toward target speed).
   * @param {Object} entity — { vx }
   * @param {number} targetVx — velocity to decay toward (usually 0)
   */
  PlatformPhysics.prototype.applyFriction = function (entity, targetVx) {
    entity.vx += (targetVx - entity.vx) * this.friction;
  };

  /**
   * Nudge entity left or right.
   * @param {Object} entity — { vx }
   * @param {number} dir — -1 (left), 0, or +1 (right)
   */
  PlatformPhysics.prototype.nudge = function (entity, dir) {
    if (dir !== 0) {
      entity.vx += dir * this.nudgeSpeed;
    }
  };

  /**
   * Move entity by its velocity.
   * @param {Object} entity — { x, y, vx, vy }
   */
  PlatformPhysics.prototype.integrate = function (entity) {
    entity.x += entity.vx;
    entity.y += entity.vy;
  };

  /**
   * Standard jump (from ground).
   * @param {Object} entity — { vy, grounded }
   * @returns {boolean} true if jump occurred
   */
  PlatformPhysics.prototype.jump = function (entity) {
    if (entity.grounded) {
      entity.vy = this.jumpForce;
      entity.grounded = false;
      return true;
    }
    return false;
  };

  /**
   * Double jump (in air, one-time use).
   * @param {Object} entity — { vy, canDoubleJump }
   * @returns {boolean} true if double jump occurred
   */
  PlatformPhysics.prototype.doubleJump = function (entity) {
    if (entity.canDoubleJump) {
      entity.vy = this.doubleJumpForce;
      entity.canDoubleJump = false;
      return true;
    }
    return false;
  };

  /**
   * Attempt a jump — tries ground jump first, then double jump.
   * @param {Object} entity — { vy, grounded, canDoubleJump }
   * @returns {boolean} true if any jump occurred
   */
  PlatformPhysics.prototype.tryJump = function (entity) {
    if (this.jump(entity)) {
      entity.canDoubleJump = true; // enable double jump after ground jump
      return true;
    }
    return this.doubleJump(entity);
  };

  /**
   * Collide entity against an array of platforms.
   * Platforms are one-way (land on top only). Each platform: { x, y, w, h }.
   * Entity position is in screen-space; cameraX converts platform world-X to screen.
   *
   * @param {Object} entity — { x, y, w, h, vy, grounded, canDoubleJump }
   * @param {Array} platforms — [{ x, y, w, h }] in world-space
   * @param {number} cameraX — camera world offset
   * @param {number} [tolerance] — landing snap tolerance (default 4)
   * @returns {boolean} true if entity is on a platform
   */
  PlatformPhysics.prototype.collidePlatforms = function (entity, platforms, cameraX, tolerance) {
    tolerance = tolerance || 4;
    var landed = false;
    var ex = entity.x;
    var ey = entity.y + entity.h; // bottom edge
    var ew = entity.w;

    for (var i = 0; i < platforms.length; i++) {
      var plat = platforms[i];
      var psx = plat.x - cameraX; // screen-space X

      // Horizontal overlap check
      if (ex + ew > psx && ex < psx + plat.w) {
        // Landing: moving downward, feet at or below platform top, were above last frame
        if (entity.vy >= 0 && ey >= plat.y && ey - entity.vy <= plat.y + tolerance) {
          entity.y = plat.y - entity.h;
          entity.vy = 0;
          entity.grounded = true;
          entity.canDoubleJump = true;
          landed = true;
        }
      }
    }

    if (!landed) {
      entity.grounded = false;
    }

    return landed;
  };

  /**
   * Clamp entity horizontally to screen bounds.
   * @param {Object} entity — { x, vx }
   * @param {number} minX — left bound
   * @param {number} maxX — right bound
   */
  PlatformPhysics.prototype.clampToScreen = function (entity, minX, maxX) {
    if (entity.x < minX) {
      entity.x = minX;
      entity.vx = 0;
    }
    if (entity.x > maxX) {
      entity.x = maxX;
      entity.vx *= 0.9; // soft clamp on right
    }
  };

  /**
   * Check if entity fell off screen.
   * @param {Object} entity — { y }
   * @param {number} screenH — screen height
   * @param {number} [margin] — below-screen margin (default 50)
   * @returns {boolean}
   */
  PlatformPhysics.prototype.isFallenOff = function (entity, screenH, margin) {
    return entity.y > screenH + (margin || 50);
  };

  /**
   * AABB overlap test (static utility).
   */
  PlatformPhysics.collideAABB = function (a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  };

  return PlatformPhysics;
})();
