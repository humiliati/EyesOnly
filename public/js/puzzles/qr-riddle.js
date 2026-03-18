/**
 * qr-riddle.js — QR-Activated Field Intelligence Riddle
 *
 * A text-based riddle/trivia challenge for live field exercises.
 * Players scan a QR code → land on /games.html#riddle → this puzzle
 * auto-opens via PuzzlePopup.
 *
 * Presents a series of field intelligence riddles. The player must
 * answer correctly to advance. All answers are case-insensitive.
 *
 * Registers with PuzzlePopup under key 'qr-riddle'.
 */
(function () {
  'use strict';

  function _register() {

  var SOLVED_KEY = 'eyesonly_qr_riddle_solved';
  var PROGRESS_KEY = 'eyesonly_qr_riddle_progress';

  var RIDDLES = [
    {
      briefing: 'INTERCEPT #1 — CALLSIGN RECOVERY',
      text: 'I fly without wings. I cry without eyes. Whenever I go, darkness follows me. What am I?',
      hint: 'Think about weather phenomena...',
      answer: 'CLOUD',
      alternates: ['A CLOUD', 'CLOUDS']
    },
    {
      briefing: 'INTERCEPT #2 — DEAD DROP LOCATION',
      text: 'I have cities but no houses. I have mountains but no trees. I have water but no fish. I have roads but no cars. What am I?',
      hint: 'An operative\'s most trusted tool for navigation...',
      answer: 'MAP',
      alternates: ['A MAP', 'MAPS']
    },
    {
      briefing: 'INTERCEPT #3 — ASSET IDENTIFICATION',
      text: 'The more you take, the more you leave behind. What am I?',
      hint: 'Every field agent leaves these at every location...',
      answer: 'FOOTSTEPS',
      alternates: ['FOOTSTEP', 'STEPS', 'FOOT STEPS']
    }
  ];

  function isSolved() {
    try { return localStorage.getItem(SOLVED_KEY) === 'true'; }
    catch (_) { return false; }
  }

  function markSolved() {
    try { localStorage.setItem(SOLVED_KEY, 'true'); }
    catch (_) {}
  }

  function getProgress() {
    try { return parseInt(localStorage.getItem(PROGRESS_KEY) || '0', 10); }
    catch (_) { return 0; }
  }

  function saveProgress(idx) {
    try { localStorage.setItem(PROGRESS_KEY, String(idx)); }
    catch (_) {}
  }

  function render(container) {
    var alreadySolved = isSolved();
    var currentIdx = alreadySolved ? RIDDLES.length : getProgress();
    var hintVisible = false;

    function renderRiddle() {
      if (currentIdx >= RIDDLES.length || alreadySolved) {
        container.innerHTML =
          '<div class="puzzle-qr-riddle">' +
            '<div class="puzzle-ddc-briefing">' +
              '<span class="puzzle-ddc-label">FIELD INTELLIGENCE — COMPLETE</span>' +
              '<p class="puzzle-ddc-flavor">All intercepts decoded. Your field intelligence rating has been updated.</p>' +
            '</div>' +
            '<div style="text-align:center;margin:16px 0;">' +
              '<div style="font-size:2em;margin-bottom:8px;">&#9733; &#9733; &#9733;</div>' +
              '<span class="puzzle-ddc-success">&#10003; ALL INTERCEPTS DECODED — ' + RIDDLES.length + '/' + RIDDLES.length + ' CLEARED</span>' +
            '</div>' +
          '</div>';
        return;
      }

      var riddle = RIDDLES[currentIdx];
      hintVisible = false;

      container.innerHTML =
        '<div class="puzzle-qr-riddle">' +
          '<div class="puzzle-ddc-briefing">' +
            '<span class="puzzle-ddc-label">' + riddle.briefing + '</span>' +
            '<p class="puzzle-ddc-flavor" style="font-size:0.85em;color:var(--phosphor-dim,#1a6b4a);">' +
              'PROGRESS: ' + currentIdx + '/' + RIDDLES.length + ' intercepts decoded' +
            '</p>' +
          '</div>' +

          '<div class="puzzle-ddc-cipher" style="margin:12px 0;">' +
            '<span class="puzzle-ddc-cipher-label">INTELLIGENCE RIDDLE:</span>' +
            '<div class="puzzle-ddc-cipher-text" style="font-size:0.95em;line-height:1.5;white-space:normal;word-wrap:break-word;">' +
              riddle.text +
            '</div>' +
          '</div>' +

          '<div style="text-align:center;margin:8px 0;">' +
            '<button type="button" id="qr-riddle-hint-btn" class="puzzle-ddc-submit" ' +
              'style="width:auto;padding:4px 14px;font-size:0.75em;opacity:0.7;">' +
              'REQUEST HINT' +
            '</button>' +
            '<div id="qr-riddle-hint" style="display:none;margin-top:6px;font-size:0.8em;color:var(--phosphor-dim,#1a6b4a);font-style:italic;">' +
              riddle.hint +
            '</div>' +
          '</div>' +

          '<div class="puzzle-ddc-answer">' +
            '<label class="puzzle-ddc-answer-label" for="qr-riddle-input">YOUR ANSWER:</label>' +
            '<input type="text" id="qr-riddle-input" class="puzzle-ddc-input" ' +
              'placeholder="Enter your answer" autocomplete="off" spellcheck="false">' +
            '<button type="button" id="qr-riddle-submit" class="puzzle-ddc-submit">SUBMIT</button>' +
          '</div>' +
          '<div class="puzzle-ddc-feedback" id="qr-riddle-feedback"></div>' +
        '</div>';

      var input = container.querySelector('#qr-riddle-input');
      var submitBtn = container.querySelector('#qr-riddle-submit');
      var feedback = container.querySelector('#qr-riddle-feedback');
      var hintBtn = container.querySelector('#qr-riddle-hint-btn');
      var hintEl = container.querySelector('#qr-riddle-hint');

      hintBtn.addEventListener('click', function () {
        if (!hintVisible) {
          hintEl.style.display = 'block';
          hintVisible = true;
          hintBtn.textContent = 'HINT ACTIVE';
          hintBtn.style.opacity = '0.5';
        }
      });

      function checkAnswer() {
        var answer = input.value.trim().toUpperCase();
        if (!answer) {
          feedback.innerHTML = '<span class="puzzle-ddc-error">Enter your answer, operative.</span>';
          return;
        }

        var correct = (answer === riddle.answer) ||
                      (riddle.alternates && riddle.alternates.indexOf(answer) !== -1);

        if (correct) {
          currentIdx++;
          saveProgress(currentIdx);

          if (window.AudioSystem && AudioSystem.playSFX) AudioSystem.playSFX('ui-04');

          if (currentIdx >= RIDDLES.length) {
            // All solved!
            PuzzlePopup.solved();
            markSolved();

            if (window.PuzzleState && PuzzleState.onClueFound) {
              PuzzleState.onClueFound('qr-riddle-solved', 'qr-puzzle');
            }
          }

          // Re-render for next riddle or completion screen
          setTimeout(renderRiddle, 300);
        } else {
          feedback.innerHTML = '<span class="puzzle-ddc-error">INCORRECT — Intel not verified. Try again.</span>';
          if (window.AudioSystem && AudioSystem.playSFX) AudioSystem.playSFX('ui-01');
        }
      }

      submitBtn.addEventListener('click', checkAnswer);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); checkAnswer(); }
        e.stopPropagation();
      });
      input.addEventListener('keyup', function (e) { e.stopPropagation(); });

      // Auto-focus
      setTimeout(function () { input.focus(); }, 100);
    }

    renderRiddle();
  }

  PuzzlePopup.register('qr-riddle', {
    title: 'FIELD INTELLIGENCE — RIDDLE INTERCEPTS',
    render: render,
    onSolve: function () {
      try {
        var acct = JSON.parse(localStorage.getItem('eyesonly_account') || '{}');
        acct.puzzleCoins = (acct.puzzleCoins || 0) + 25;
        localStorage.setItem('eyesonly_account', JSON.stringify(acct));
      } catch (_) {}
    }
  });
  } // end _register

  if (typeof PuzzlePopup !== 'undefined') {
    _register();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof PuzzlePopup !== 'undefined') _register();
    });
    var _attempts = 0;
    var _poll = setInterval(function () {
      _attempts++;
      if (typeof PuzzlePopup !== 'undefined') { clearInterval(_poll); _register(); }
      else if (_attempts > 50) { clearInterval(_poll); }
    }, 100);
  }

})();
