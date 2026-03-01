/* ============================================================
   STR Victory Sequence — 5-Phase Animated Combat Resolution
   ============================================================
   Phases:
     1. Enemy Death Animation (kaomoji eye cycling, desaturation, wipe)
     2. Player Reaction (condition-based kaomoji celebration)
     3. Arcade Debrief Reel (scrolling combat tally)
     4. Loot & Card Rewards (pop, glow, slide to NCH capsule)
     5. Gentle Window Close (vignette collapse, cleanup)
   ============================================================ */

var STRVictorySequence = (function () {
  'use strict';

  // ── Kaomoji Libraries ──────────────────────────────────────

  var ENEMY_DEATH_EYES = [
    'X_X', 'x_x', 'X_x', 'x_X', 'X__X', 'x__x', 'X__x', 'x__X', 'X___X'
  ];

  var PLAYER_REACTIONS = {
    standard: [
      '( \u02B6\u02C6\u1D17\u02C6\u02B5 )',           // ( ˶ˆᗜˆ˵ )
      '\u0669(\u02CA\u1D17\u02CB)\u0648 \u2661*',     // ٩(ˊᗜˋ)و ♡*
      '( \u02B6\u02C6\u1D17\u02C6\u02B5 )\u0648 \u2661' // ( ˶ˆᗜˆ˵ )و ♡
    ],
    pyrrhic: [
      '(\uFF89\u0CA5\u76CA\u0CA5)\uFF89',             // (ﾉಥ益ಥ)ﾉ
      '\u0669(\u0C20\u76CA\u0C20)\u06F6',              // ٩(ఠ益ఠ)۶
      '(\u51F8\u0CA0\u76CA\u0CA0)\u51F8'               // (凸ಠ益ಠ)凸
    ],
    blvck: [
      '\u10DA(\u0CA0_\u0CA0 \u10DA)',                  // ლ(ಠ_ಠ ლ)
      '\u10DA(\u00AF\u30ED\u00AF\u201D\u10DA)',        // ლ(¯ロ¯"ლ)
      '\u2510(\u2018\uFF5E\u2018;)\u250C'              // ┐('～`;)┌
    ],
    status_effect: [
      '(o_O) !',
      '[STATUS] !',    // Placeholder — replaced at runtime with actual effect
      '[STATUS] ! !'
    ]
  };

  // ── State ──────────────────────────────────────────────────

  var _overlay = null;
  var _isRunning = false;
  var _aborted = false;

  // Captured context from the victory call
  var _ctx = null; // { enemy, player, combatLog, loot, deathResult, round, advantage, ... }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Play the full 5-phase victory sequence.
   * @param {Object} ctx — victory context built by the caller
   *   ctx.enemyEmoji      — enemy's display emoji (e.g. '👾')
   *   ctx.enemyName       — enemy name string
   *   ctx.playerHp        — player HP at end of combat
   *   ctx.playerMaxHp     — player max HP
   *   ctx.combatLog       — array of log strings from _strCombatLog
   *   ctx.round           — final round number
   *   ctx.advantage       — 'ambush'|'neutral'|'disadvantaged'|'flanked'
   *   ctx.usedBlvck       — boolean, true if BLVCK was played during combat
   *   ctx.statusEffects   — array of status effect names applied during combat
   *   ctx.lootCards       — array of { emoji, name, quality } card drops
   *   ctx.lootCurrency    — number, total currency dropped
   *   ctx.lootAmmo        — number, ammo recovered
   *   ctx.lootCharms      — array of { emoji, name } charm drops
   *   ctx.stolenCards     — array of cards stolen from enemy
   *   ctx.overkill        — boolean, massive overkill
   *   ctx.isBoss          — boolean
   *   ctx.enemyX          — grid x of enemy
   *   ctx.enemyY          — grid y of enemy
   * @param {Function} onComplete — called when sequence finishes (cleanup)
   */
  function play(ctx, onComplete) {
    if (_isRunning) return;
    _isRunning = true;
    _aborted = false;
    _ctx = ctx || {};

    // Create full-screen overlay
    _overlay = document.createElement('div');
    _overlay.id = 'str-victory-overlay';
    _overlay.className = 'str-victory-overlay';
    document.body.appendChild(_overlay);

    // Allow click-to-skip after phase 2
    var skipReady = false;
    _overlay.addEventListener('click', function() {
      if (skipReady && !_aborted) {
        _aborted = true;
        _finishSequence(onComplete);
      }
    });

    // Run phases sequentially
    _phase1_enemyDeath(function() {
      if (_aborted) return;
      skipReady = true;
      _phase2_playerReaction(function() {
        if (_aborted) return;
        _phase3_arcadeReel(function() {
          if (_aborted) return;
          _phase4_lootRewards(function() {
            if (_aborted) return;
            _phase5_gentleClose(function() {
              _finishSequence(onComplete);
            });
          });
        });
      });
    });
  }

  /**
   * Abort and clean up immediately.
   */
  function abort() {
    _aborted = true;
    _finishSequence(null);
  }

  function isRunning() {
    return _isRunning;
  }

  // ── Phase 1: Enemy Death Animation ─────────────────────────

  function _phase1_enemyDeath(done) {
    var container = document.createElement('div');
    container.className = 'sv-phase sv-phase1';

    // Enemy portrait frame
    var enemyFrame = document.createElement('div');
    enemyFrame.className = 'sv-enemy-frame';

    var enemyEmoji = document.createElement('div');
    enemyEmoji.className = 'sv-enemy-emoji';
    enemyEmoji.textContent = _ctx.enemyEmoji || '👾';
    enemyFrame.appendChild(enemyEmoji);

    var enemyEyes = document.createElement('div');
    enemyEyes.className = 'sv-enemy-eyes';
    enemyEyes.textContent = 'X_X';
    enemyFrame.appendChild(enemyEyes);

    container.appendChild(enemyFrame);
    _overlay.appendChild(container);

    // Animate eye cycling
    var eyeIdx = 0;
    var eyeInterval = setInterval(function() {
      if (_aborted) { clearInterval(eyeInterval); return; }
      eyeIdx = (eyeIdx + 1) % ENEMY_DEATH_EYES.length;
      enemyEyes.textContent = ENEMY_DEATH_EYES[eyeIdx];
    }, 120);

    // Hit-shake
    enemyFrame.classList.add('sv-hit-shake');

    // After 1s: desaturate
    setTimeout(function() {
      if (_aborted) { clearInterval(eyeInterval); return; }
      enemyFrame.classList.add('sv-desaturate');
    }, 800);

    // After 1.6s: wipe/dissolve enemy frames
    setTimeout(function() {
      if (_aborted) { clearInterval(eyeInterval); return; }
      clearInterval(eyeInterval);
      enemyFrame.classList.add('sv-wipe-out');
    }, 1500);

    // After 2.2s: phase complete
    setTimeout(function() {
      if (_aborted) return;
      container.classList.add('sv-fade-out');
      setTimeout(function() {
        if (container.parentNode) container.parentNode.removeChild(container);
        done();
      }, 300);
    }, 2100);
  }

  // ── Phase 2: Player Reaction ───────────────────────────────

  function _phase2_playerReaction(done) {
    var container = document.createElement('div');
    container.className = 'sv-phase sv-phase2';

    // Determine victory condition
    var condition = _getVictoryCondition();
    var frames = PLAYER_REACTIONS[condition] || PLAYER_REACTIONS.standard;

    // If status effect, inject actual effect names
    if (condition === 'status_effect' && _ctx.statusEffects && _ctx.statusEffects.length > 0) {
      var effectName = _ctx.statusEffects[0];
      frames = frames.map(function(f) { return f.replace(/\[STATUS\]/g, effectName); });
    }

    var playerFrame = document.createElement('div');
    playerFrame.className = 'sv-player-frame';

    var playerFace = document.createElement('div');
    playerFace.className = 'sv-player-face';
    playerFace.textContent = frames[0];
    playerFrame.appendChild(playerFace);

    // Victory condition label
    var condLabel = document.createElement('div');
    condLabel.className = 'sv-condition-label';
    condLabel.textContent = _getConditionLabel(condition);
    playerFrame.appendChild(condLabel);

    container.appendChild(playerFrame);
    _overlay.appendChild(container);

    // Animate through kaomoji frames
    var frameIdx = 0;
    var stepDelay = 600;
    function nextFrame() {
      if (_aborted) return;
      frameIdx++;
      if (frameIdx < frames.length) {
        playerFace.classList.add('sv-face-bounce');
        playerFace.textContent = frames[frameIdx];
        setTimeout(function() {
          playerFace.classList.remove('sv-face-bounce');
        }, 200);
        setTimeout(nextFrame, stepDelay);
      } else {
        // Hold final face for a beat
        setTimeout(function() {
          if (_aborted) return;
          container.classList.add('sv-fade-out');
          setTimeout(function() {
            if (container.parentNode) container.parentNode.removeChild(container);
            done();
          }, 300);
        }, 500);
      }
    }
    setTimeout(nextFrame, stepDelay);
  }

  // ── Phase 3: Arcade Debrief Reel ───────────────────────────

  function _phase3_arcadeReel(done) {
    var container = document.createElement('div');
    container.className = 'sv-phase sv-phase3';

    // Build reel items from combat context
    var reelItems = _buildReelItems();

    // Scrolling reel container
    var reelBox = document.createElement('div');
    reelBox.className = 'sv-reel-box';

    var reelTrack = document.createElement('div');
    reelTrack.className = 'sv-reel-track';

    reelItems.forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'sv-reel-row';
      row.innerHTML = '<span class="sv-reel-icon">' + (item.icon || '•') + '</span>' +
                      '<span class="sv-reel-text">' + item.text + '</span>' +
                      (item.value ? '<span class="sv-reel-value">' + item.value + '</span>' : '');
      reelTrack.appendChild(row);
    });

    reelBox.appendChild(reelTrack);

    // Final tally banner
    var tally = document.createElement('div');
    tally.className = 'sv-reel-tally';
    tally.innerHTML = _buildTallyHTML();

    container.appendChild(reelBox);
    container.appendChild(tally);
    _overlay.appendChild(container);

    // Animate: scroll the track upward like a slot reel
    var totalRows = reelItems.length;
    var rowHeight = 32; // px per row
    var scrollDuration = Math.min(totalRows * 180, 2400); // cap at 2.4s
    reelTrack.style.transition = 'transform ' + (scrollDuration / 1000).toFixed(1) + 's cubic-bezier(0.22, 1, 0.36, 1)';

    // Small delay to ensure transition fires
    requestAnimationFrame(function() {
      var totalScroll = Math.max(0, (totalRows * rowHeight) - reelBox.clientHeight);
      reelTrack.style.transform = 'translateY(-' + totalScroll + 'px)';
    });

    // After scroll: show tally with ka-chunk
    setTimeout(function() {
      if (_aborted) return;
      tally.classList.add('sv-tally-appear');
    }, scrollDuration + 200);

    // Phase done after tally display
    setTimeout(function() {
      if (_aborted) return;
      container.classList.add('sv-fade-out');
      setTimeout(function() {
        if (container.parentNode) container.parentNode.removeChild(container);
        done();
      }, 300);
    }, scrollDuration + 1600);
  }

  // ── Phase 4: Loot & Card Rewards ───────────────────────────

  function _phase4_lootRewards(done) {
    var hasLoot = (_ctx.lootCards && _ctx.lootCards.length > 0) ||
                  (_ctx.lootCharms && _ctx.lootCharms.length > 0) ||
                  (_ctx.stolenCards && _ctx.stolenCards.length > 0) ||
                  (_ctx.lootCurrency > 0) ||
                  (_ctx.lootAmmo > 0);

    if (!hasLoot) {
      // No loot — skip phase
      return done();
    }

    var container = document.createElement('div');
    container.className = 'sv-phase sv-phase4';

    var lootLabel = document.createElement('div');
    lootLabel.className = 'sv-loot-label';
    lootLabel.textContent = _ctx.isBoss ? '🏆 BOSS LOOT' : '💎 SPOILS';
    container.appendChild(lootLabel);

    var lootGrid = document.createElement('div');
    lootGrid.className = 'sv-loot-grid';

    // Collect all reward items
    var rewards = [];

    if (_ctx.lootCurrency > 0) {
      rewards.push({ emoji: '💰', text: '+' + _ctx.lootCurrency + ' crypto', type: 'currency' });
    }
    if (_ctx.lootAmmo > 0) {
      rewards.push({ emoji: '⁍', text: '+' + _ctx.lootAmmo + ' ammo', type: 'ammo' });
    }
    (_ctx.lootCards || []).forEach(function(c) {
      rewards.push({ emoji: c.emoji || '🎴', text: c.name + (c.quality ? ' (' + c.quality + ')' : ''), type: 'card' });
    });
    (_ctx.lootCharms || []).forEach(function(c) {
      rewards.push({ emoji: c.emoji || '💎', text: c.name, type: 'charm' });
    });
    (_ctx.stolenCards || []).forEach(function(c) {
      rewards.push({ emoji: '🫳', text: c.name + ' (stolen)', type: 'stolen' });
    });

    // Create reward elements (initially hidden)
    var rewardEls = [];
    rewards.forEach(function(r, i) {
      var el = document.createElement('div');
      el.className = 'sv-loot-item sv-loot-hidden';
      el.innerHTML = '<span class="sv-loot-emoji">' + r.emoji + '</span>' +
                     '<span class="sv-loot-text">' + r.text + '</span>';
      el.dataset.type = r.type;
      lootGrid.appendChild(el);
      rewardEls.push(el);
    });

    container.appendChild(lootGrid);
    _overlay.appendChild(container);

    // Pop each item in sequence
    var popIdx = 0;
    var popInterval = setInterval(function() {
      if (_aborted || popIdx >= rewardEls.length) {
        clearInterval(popInterval);
        // After all items shown, slide cards to NCH capsule
        setTimeout(function() {
          if (_aborted) return;
          _animateSlideToNCH(rewardEls, function() {
            container.classList.add('sv-fade-out');
            setTimeout(function() {
              if (container.parentNode) container.parentNode.removeChild(container);
              done();
            }, 300);
          });
        }, 600);
        return;
      }
      rewardEls[popIdx].classList.remove('sv-loot-hidden');
      rewardEls[popIdx].classList.add('sv-loot-pop');
      popIdx++;
    }, 280);
  }

  // ── Phase 5: Gentle Window Close ───────────────────────────

  function _phase5_gentleClose(done) {
    // Vignette collapse + STR window shrink
    _overlay.classList.add('sv-vignette-collapse');

    // Fade out the overlay
    setTimeout(function() {
      _overlay.classList.add('sv-final-fade');
    }, 400);

    setTimeout(function() {
      done();
    }, 900);
  }

  // ── Helpers ────────────────────────────────────────────────

  function _getVictoryCondition() {
    if (_ctx.usedBlvck) return 'blvck';
    var hpPercent = (_ctx.playerMaxHp > 0) ? (_ctx.playerHp / _ctx.playerMaxHp) : 1;
    if (hpPercent <= 0.25) return 'pyrrhic';
    if (_ctx.statusEffects && _ctx.statusEffects.length > 0) return 'status_effect';
    return 'standard';
  }

  function _getConditionLabel(condition) {
    switch (condition) {
      case 'pyrrhic': return '🩸 PYRRHIC VICTORY';
      case 'blvck': return '■ BLVCK PLAY';
      case 'status_effect': return '⚡ STATUS KILL';
      default: return '✨ VICTORY';
    }
  }

  function _buildReelItems() {
    var items = [];
    var log = _ctx.combatLog || [];

    // Opening context
    items.push({ icon: '⚔️', text: 'COMBAT ENGAGED', value: 'Round 1' });

    if (_ctx.advantage && _ctx.advantage !== 'neutral') {
      var advEmoji = { ambush: '🎯', disadvantaged: '⚠️', flanked: '❌' };
      items.push({ icon: advEmoji[_ctx.advantage] || '⚔️', text: _ctx.advantage.toUpperCase(), value: '' });
    }

    // Extract key events from combat log
    for (var i = 0; i < log.length; i++) {
      var line = log[i];
      if (!line || line === '' || line.indexOf('═══') === 0 || line.indexOf('───') === 0) continue;

      // Highlight interesting lines
      if (line.indexOf('⚡ PLAYER') === 0 || line.indexOf('CRIT') >= 0) {
        items.push({ icon: '⚡', text: line.replace(/[├└─│]/g, '').trim(), value: '' });
      } else if (line.indexOf('🗡️') === 0 || line.indexOf('ENEMY') >= 0) {
        items.push({ icon: '🗡️', text: line.replace(/[├└─│]/g, '').trim(), value: '' });
      } else if (line.indexOf('💨') === 0) {
        items.push({ icon: '💨', text: line.trim(), value: '' });
      } else if (line.indexOf('💥') >= 0) {
        items.push({ icon: '💥', text: line.trim(), value: '' });
      } else if (line.indexOf('🐾') === 0) {
        items.push({ icon: '🐾', text: line.trim(), value: '' });
      } else if (line.indexOf('Damage:') >= 0) {
        items.push({ icon: '🔥', text: line.replace(/[├└─│]/g, '').trim(), value: '' });
      }
    }

    // Final blow
    items.push({ icon: '💀', text: (_ctx.enemyName || 'Enemy') + ' DEFEATED', value: 'Round ' + (_ctx.round || '?') });

    if (_ctx.overkill) {
      items.push({ icon: '💢', text: 'OVERKILL!', value: '' });
    }

    return items;
  }

  function _buildTallyHTML() {
    var parts = [];

    // HP delta
    var hpDelta = (_ctx.playerHp || 0) - (_ctx.playerMaxHp || 0);
    var hpSign = hpDelta >= 0 ? '+' : '';
    parts.push('<span class="sv-tally-item ' + (hpDelta < 0 ? 'sv-negative' : 'sv-positive') + '">' +
               '❤️ ' + hpSign + hpDelta + ' HP</span>');

    // Cards delta
    var cardCount = (_ctx.lootCards ? _ctx.lootCards.length : 0) +
                    (_ctx.stolenCards ? _ctx.stolenCards.length : 0);
    if (cardCount > 0) {
      parts.push('<span class="sv-tally-item sv-positive">🎴 +' + cardCount + ' cards</span>');
    }

    // Currency
    if (_ctx.lootCurrency > 0) {
      parts.push('<span class="sv-tally-item sv-positive">💰 +' + _ctx.lootCurrency + '</span>');
    }

    // Ammo recovered
    if (_ctx.lootAmmo > 0) {
      parts.push('<span class="sv-tally-item sv-positive">⁍ +' + _ctx.lootAmmo + '</span>');
    }

    // Rounds survived
    parts.push('<span class="sv-tally-item">🔄 ' + (_ctx.round || 1) + ' rounds</span>');

    return parts.join('<span class="sv-tally-divider">│</span>');
  }

  /**
   * Animate card/loot items sliding toward the NCH capsule position
   */
  function _animateSlideToNCH(els, done) {
    // Find NCH capsule position
    var capsule = document.getElementById('nch-capsule') ||
                  document.querySelector('.nch-capsule') ||
                  document.querySelector('[data-component="nch"]');

    var targetX = window.innerWidth - 60;  // default: bottom-right
    var targetY = window.innerHeight - 60;

    if (capsule) {
      var cr = capsule.getBoundingClientRect();
      targetX = cr.left + cr.width / 2;
      targetY = cr.top + cr.height / 2;
    }

    var cardEls = [];
    for (var i = 0; i < els.length; i++) {
      var type = els[i].dataset.type;
      if (type === 'card' || type === 'charm' || type === 'stolen') {
        cardEls.push(els[i]);
      }
    }

    if (cardEls.length === 0) return done();

    var completed = 0;
    cardEls.forEach(function(el, idx) {
      var r = el.getBoundingClientRect();
      var dx = targetX - (r.left + r.width / 2);
      var dy = targetY - (r.top + r.height / 2);

      setTimeout(function() {
        el.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease';
        el.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(0.3)';
        el.style.opacity = '0.4';
      }, idx * 100);

      setTimeout(function() {
        completed++;
        if (completed >= cardEls.length) done();
      }, (idx * 100) + 600);
    });
  }

  /**
   * Final cleanup
   */
  function _finishSequence(onComplete) {
    _isRunning = false;
    _ctx = null;

    // Remove overlay
    if (_overlay && _overlay.parentNode) {
      _overlay.parentNode.removeChild(_overlay);
    }
    _overlay = null;

    if (typeof onComplete === 'function') {
      try { onComplete(); } catch (e) {}
    }
  }

  // ── Init (auto) ────────────────────────────────────────────

  // No DOM init needed — overlay created on demand.

  return {
    play: play,
    abort: abort,
    isRunning: isRunning
  };

})();
