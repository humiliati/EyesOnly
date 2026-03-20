/**
 * arcade-hud.js — Score / Lives / Level / Currency HUD Overlay
 *
 * Renders a persistent heads-up display on top of the game canvas.
 * Adapts layout for boss mode (adds boss HP bar) vs arcade mode.
 *
 * Drawn by ArcadeEngine._render() after onDraw(), so it's always on top.
 *
 * HUD layout (arcade mode):
 *   ┌─────────────────────────────────────┐
 *   │ ♥♥♥  LVL 3   SCORE 1450    🪙 +12  │
 *   └─────────────────────────────────────┘
 *
 * HUD layout (boss mode):
 *   ┌─────────────────────────────────────┐
 *   │ ♥♥♥  BOSS ████████░░░  SCORE 1450  │
 *   └─────────────────────────────────────┘
 *
 * Depends on: arcade-engine.js (reads engine.state, .score, .lives, etc.)
 */
var ArcadeHUD = (function () {
  'use strict';

  var HUD_HEIGHT = 28;          // px height of the HUD bar
  var HUD_PADDING = 8;          // px horizontal padding
  var HEART_FULL = '♥';
  var HEART_EMPTY = '♡';
  var COIN_EMOJI = '🪙';

  // ── Currency popup animation ──
  var POPUP_DURATION = 1500;    // ms for +¢ popup to float up and fade

  /**
   * @constructor
   * @param {ArcadeEngine} engine — the parent engine instance
   */
  function ArcadeHUD(engine) {
    this.engine = engine;
    this._popups = [];           // { text, x, y, startTime, color }
    this._bossHP = 0;
    this._bossMaxHP = 0;
  }

  /**
   * Set boss HP for the boss health bar display.
   * Called by subclass when in boss mode.
   */
  ArcadeHUD.prototype.setBossHP = function (hp, maxHP) {
    this._bossHP = hp;
    this._bossMaxHP = maxHP;
  };

  /**
   * Spawn a floating score popup (e.g. "+100", "+25 NEAR MISS").
   *
   * @param {string} text
   * @param {number} x — canvas-relative x
   * @param {number} y — canvas-relative y
   * @param {string} [color]
   */
  ArcadeHUD.prototype.popup = function (text, x, y, color) {
    this._popups.push({
      text: text,
      x: x,
      y: y,
      startTime: performance.now(),
      color: color || this.engine.colors.amber
    });
  };

  /**
   * Main draw call — invoked by ArcadeEngine._render().
   */
  ArcadeHUD.prototype.draw = function (ctx, w, h) {
    var e = this.engine;
    if (e.state === ArcadeEngine.STATE.MENU) return;

    ctx.save();

    // ── HUD bar background ──
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // ── Bottom border glow ──
    ctx.strokeStyle = e.colors.phosphorDim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(w, HUD_HEIGHT);
    ctx.stroke();

    var fontBase = 12;
    ctx.font = fontBase + 'px ' + e.colors.font;
    ctx.textBaseline = 'middle';
    var cy = HUD_HEIGHT / 2;

    // ── Lives (left) ──
    var livesStr = '';
    for (var i = 0; i < e.maxLives; i++) {
      livesStr += i < e.lives ? HEART_FULL : HEART_EMPTY;
    }
    ctx.fillStyle = e.lives > 1 ? e.colors.phosphor : e.colors.red;
    ctx.textAlign = 'left';
    ctx.fillText(livesStr, HUD_PADDING, cy);

    // ── Level or Boss HP (center) ──
    if (e.bossMode && this._bossMaxHP > 0) {
      this._drawBossBar(ctx, w, cy);
    } else {
      ctx.fillStyle = e.colors.phosphorDim;
      ctx.textAlign = 'center';
      ctx.fillText('LVL ' + e.level, w / 2, cy);
    }

    // ── Score (right) ──
    var scoreText = 'SCORE ' + e.score;
    ctx.fillStyle = e.colors.phosphor;
    ctx.textAlign = 'right';
    ctx.fillText(scoreText, w - HUD_PADDING, cy);

    ctx.restore();

    // ── Floating popups ──
    this._drawPopups(ctx);
  };

  /**
   * Boss HP bar (drawn in center of HUD).
   */
  ArcadeHUD.prototype._drawBossBar = function (ctx, w, cy) {
    var e = this.engine;
    var barW = w * 0.3;
    var barH = 10;
    var barX = (w - barW) / 2;
    var barY = cy - barH / 2;

    // Label
    ctx.fillStyle = e.colors.red;
    ctx.textAlign = 'right';
    ctx.fillText('BOSS', barX - 6, cy);

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW, barH);

    // Fill
    var ratio = Math.max(0, Math.min(1, this._bossHP / this._bossMaxHP));
    var fillColor = ratio > 0.5 ? e.colors.red :
                    ratio > 0.2 ? e.colors.amber : '#ff0040';
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, barW * ratio, barH);

    // Border
    ctx.strokeStyle = e.colors.phosphorDim;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  };

  /**
   * Draw and age floating score popups.
   */
  ArcadeHUD.prototype._drawPopups = function (ctx) {
    var now = performance.now();
    var alive = [];

    for (var i = 0; i < this._popups.length; i++) {
      var p = this._popups[i];
      var elapsed = now - p.startTime;
      if (elapsed > POPUP_DURATION) continue;

      var t = elapsed / POPUP_DURATION;
      var alpha = 1 - t;
      var yOffset = -40 * t;  // float upward

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '14px ' + this.engine.colors.font;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillText(p.text, p.x, p.y + yOffset);
      ctx.restore();

      alive.push(p);
    }

    this._popups = alive;
  };

  /**
   * Get the HUD height (so games know where playfield starts).
   */
  ArcadeHUD.HEIGHT = HUD_HEIGHT;

  return ArcadeHUD;
})();
