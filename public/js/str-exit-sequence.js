/* ============================================================
   STRExitSequence — Non-Victory Combat Exit Animations
   Covers: medbed_soft_defeat, npc_gate_soft_defeat, fled
   ============================================================
   Usage:
     STRExitSequence.play(reason, ctx, onComplete)
       reason   — 'medbed_soft_defeat' | 'npc_gate_soft_defeat' | 'fled'
       ctx      — { playerHp, playerMaxHp, enemyEmoji, enemyName, gateNpcName, round }
       onComplete — callback fired after animation finishes
   ============================================================ */

var STRExitSequence = (function() {
  'use strict';

  var _overlay = null;
  var _running = false;
  var _aborted = false;

  // ── Helpers ──────────────────────────────────────────────────

  function _el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function _wait(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }

  function _fadeOutPhase(phase) {
    return new Promise(function(resolve) {
      phase.classList.add('se-fade-out');
      setTimeout(function() {
        if (phase.parentNode) phase.parentNode.removeChild(phase);
        resolve();
      }, 320);
    });
  }

  function _createOverlay() {
    _overlay = _el('div', 'str-exit-overlay');
    document.body.appendChild(_overlay);
    return _overlay;
  }

  function _cleanup(onComplete) {
    _running = false;
    if (_overlay && _overlay.parentNode) {
      _overlay.classList.add('se-final-fade');
      setTimeout(function() {
        if (_overlay && _overlay.parentNode) {
          _overlay.parentNode.removeChild(_overlay);
        }
        _overlay = null;
        if (typeof onComplete === 'function') onComplete();
      }, 420);
    } else {
      _overlay = null;
      if (typeof onComplete === 'function') onComplete();
    }
  }

  // ── MEDBED: flatline → stabilize ─────────────────────────────

  function _playMedbed(ctx, onComplete) {
    _createOverlay();

    // Allow click-to-skip after phase 1
    var skipReady = false;
    var skipFn = function() {
      if (skipReady && !_aborted) {
        _aborted = true;
        _cleanup(onComplete);
      }
    };
    _overlay.addEventListener('click', skipFn);

    // Phase 1: Flatline
    var phase1 = _el('div', 'se-phase');
    var flatCont = _el('div', 'se-flatline-container');

    var flatText = _el('div', 'se-flatline-text', '— FLATLINE —');
    flatCont.appendChild(flatText);

    var flatLine = _el('div', 'se-flatline-line');
    var flatPulse = _el('div', 'se-flatline-pulse');
    flatLine.appendChild(flatPulse);
    flatCont.appendChild(flatLine);

    phase1.appendChild(flatCont);
    _overlay.appendChild(phase1);

    _wait(1800).then(function() {
      if (_aborted) return;
      skipReady = true;
      return _fadeOutPhase(phase1);
    }).then(function() {
      if (_aborted) return;

      // Phase 2: Stabilize
      var phase2 = _el('div', 'se-phase');
      var stabCont = _el('div', 'se-stabilize-container');

      var heartLine = _el('div', 'se-heartbeat-line');
      stabCont.appendChild(heartLine);

      var emoji = _el('div', 'se-stabilize-emoji', '🛏️');
      stabCont.appendChild(emoji);

      var stabText = _el('div', 'se-stabilize-text', 'STABILIZED');
      stabCont.appendChild(stabText);

      // Show HP restored
      var hpRestored = Math.ceil((ctx.playerMaxHp || 10) * 0.5);
      var hpLine = _el('div', 'se-hp-restored', '❤️ HP restored to ' + hpRestored + '/' + (ctx.playerMaxHp || 10));
      stabCont.appendChild(hpLine);

      phase2.appendChild(stabCont);
      _overlay.appendChild(phase2);

      return _wait(2000);
    }).then(function() {
      if (_aborted) return;
      _cleanup(onComplete);
    });
  }

  // ── GATE DEFEAT: coach shrug → try again ─────────────────────

  function _playGateDefeat(ctx, onComplete) {
    _createOverlay();

    var skipReady = false;
    var skipFn = function() {
      if (skipReady && !_aborted) {
        _aborted = true;
        _cleanup(onComplete);
      }
    };
    _overlay.addEventListener('click', skipFn);

    // Phase 1: Coach reaction
    var phase1 = _el('div', 'se-phase');
    var gateCont = _el('div', 'se-gate-container');

    var gateEmoji = _el('div', 'se-gate-emoji se-gate-shrug', ctx.enemyEmoji || '🥊');
    gateCont.appendChild(gateEmoji);

    var gateText = _el('div', 'se-gate-text', 'TRAINING MATCH');
    gateCont.appendChild(gateText);

    var gateName = ctx.gateNpcName || ctx.enemyName || 'Coach';
    var subtext = _el('div', 'se-gate-subtext', gateName + ' shrugs it off');
    gateCont.appendChild(subtext);

    phase1.appendChild(gateCont);
    _overlay.appendChild(phase1);

    _wait(1200).then(function() {
      if (_aborted) return;
      skipReady = true;
      return _fadeOutPhase(phase1);
    }).then(function() {
      if (_aborted) return;

      // Phase 2: Encouragement
      var phase2 = _el('div', 'se-phase');
      var encCont = _el('div', 'se-gate-container');

      var encEmoji = _el('div', 'se-gate-emoji', '💪');
      encCont.appendChild(encEmoji);

      // Pick an encouraging line
      var lines = [
        'Try again when ready',
        'Not bad — keep at it',
        'You\'ll get there',
        'Practice makes perfect'
      ];
      var line = lines[Math.floor(Math.random() * lines.length)];
      var encText = _el('div', 'se-gate-text', line);
      encText.style.color = '#66bb6a';
      encText.style.textShadow = '0 0 12px rgba(100, 187, 106, 0.5)';
      encCont.appendChild(encText);

      // Round count
      if (ctx.round && ctx.round > 0) {
        var roundText = _el('div', 'se-gate-subtext', 'Lasted ' + ctx.round + ' round' + (ctx.round !== 1 ? 's' : ''));
        roundText.style.animation = 'se-gate-subtext-in 0.4s ease-out 0.3s forwards';
        encCont.appendChild(roundText);
      }

      phase2.appendChild(encCont);
      _overlay.appendChild(phase2);

      return _wait(1800);
    }).then(function() {
      if (_aborted) return;
      _cleanup(onComplete);
    });
  }

  // ── FLED: hasty escape ───────────────────────────────────────

  function _playFled(ctx, onComplete) {
    _createOverlay();

    // Single phase — quick and snappy
    var phase1 = _el('div', 'se-phase');
    var fledCont = _el('div', 'se-fled-container');

    var fledEmoji = _el('div', 'se-fled-emoji', '🏃💨');
    fledCont.appendChild(fledEmoji);

    var fledText = _el('div', 'se-fled-text', 'ESCAPED!');
    fledCont.appendChild(fledText);

    var dust = _el('div', 'se-fled-dust', '💨');
    fledCont.appendChild(dust);

    phase1.appendChild(fledCont);
    _overlay.appendChild(phase1);

    // Allow click-to-skip immediately for fled (it's quick anyway)
    var skipFn = function() {
      if (!_aborted) {
        _aborted = true;
        _cleanup(onComplete);
      }
    };
    _overlay.addEventListener('click', skipFn);

    _wait(1400).then(function() {
      if (_aborted) return;
      _cleanup(onComplete);
    });
  }

  // ── Public API ───────────────────────────────────────────────

  function play(reason, ctx, onComplete) {
    if (_running) {
      // Already running — abort the previous one
      abort();
    }
    _running = true;
    _aborted = false;

    ctx = ctx || {};

    switch (reason) {
      case 'medbed_soft_defeat':
        _playMedbed(ctx, onComplete);
        break;
      case 'npc_gate_soft_defeat':
        _playGateDefeat(ctx, onComplete);
        break;
      case 'fled':
        _playFled(ctx, onComplete);
        break;
      default:
        // Unknown reason — skip animation, just call back
        if (typeof onComplete === 'function') onComplete();
        _running = false;
        break;
    }
  }

  function abort() {
    _aborted = true;
    _running = false;
    if (_overlay && _overlay.parentNode) {
      _overlay.parentNode.removeChild(_overlay);
    }
    _overlay = null;
  }

  function isRunning() {
    return _running;
  }

  return {
    play: play,
    abort: abort,
    isRunning: isRunning
  };
})();
