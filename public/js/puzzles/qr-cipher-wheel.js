/**
 * qr-cipher-wheel.js — QR-Activated Cipher Wheel Puzzle
 *
 * A rotating cipher wheel puzzle designed for live field exercises.
 * Players scan a QR code → land on /games.html#cipher → this puzzle
 * auto-opens via the PuzzlePopup system.
 *
 * The player must align two cipher rings to decode a message,
 * then enter the decoded passphrase.
 *
 * Registers with PuzzlePopup under key 'qr-cipher'.
 */
(function () {
  'use strict';

  function _register() {

  // ---- Puzzle data ----
  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var SHIFT = 7;  // Cipher shift amount
  var CLEARTEXT = 'GHOST PROTOCOL';
  var SOLVED_KEY = 'eyesonly_qr_cipher_solved';

  function caesarEncode(text, shift) {
    return text.split('').map(function (ch) {
      if (ch >= 'A' && ch <= 'Z') {
        return String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65);
      }
      return ch;
    }).join('');
  }

  var CIPHERTEXT = caesarEncode(CLEARTEXT, SHIFT);

  function isSolved() {
    try { return localStorage.getItem(SOLVED_KEY) === 'true'; }
    catch (_) { return false; }
  }

  function markSolved() {
    try { localStorage.setItem(SOLVED_KEY, 'true'); }
    catch (_) {}
  }

  function render(container) {
    var alreadySolved = isSolved();
    var currentShift = 0;

    container.innerHTML =
      '<div class="puzzle-qr-cipher">' +
        '<div class="puzzle-ddc-briefing">' +
          '<span class="puzzle-ddc-label">FIELD CIPHER — QR INTERCEPT</span>' +
          '<p class="puzzle-ddc-flavor">You\'ve intercepted a cipher-locked transmission at this waypoint. ' +
          'Rotate the cipher wheel to find the correct shift, decode the message, and enter the passphrase.</p>' +
        '</div>' +

        '<div class="puzzle-ddc-cipher">' +
          '<span class="puzzle-ddc-cipher-label">ENCODED MESSAGE:</span>' +
          '<div class="puzzle-ddc-cipher-text" id="qr-cipher-encoded">' + CIPHERTEXT + '</div>' +
        '</div>' +

        '<div class="puzzle-cipher-wheel-wrap">' +
          '<div class="puzzle-cipher-wheel-label">CIPHER WHEEL — SHIFT: <span id="qr-shift-display">0</span></div>' +
          '<div class="puzzle-cipher-rings">' +
            '<div class="puzzle-cipher-ring puzzle-cipher-ring-outer" id="qr-ring-outer"></div>' +
            '<div class="puzzle-cipher-ring puzzle-cipher-ring-inner" id="qr-ring-inner"></div>' +
          '</div>' +
          '<div class="puzzle-cipher-controls">' +
            '<button type="button" class="puzzle-ddc-submit" id="qr-shift-left" style="width:auto;padding:6px 14px;">&larr; SHIFT</button>' +
            '<button type="button" class="puzzle-ddc-submit" id="qr-shift-right" style="width:auto;padding:6px 14px;">SHIFT &rarr;</button>' +
          '</div>' +
          '<div class="puzzle-cipher-preview">' +
            '<span class="puzzle-ddc-cipher-label">DECODED PREVIEW:</span>' +
            '<div class="puzzle-ddc-cipher-text" id="qr-cipher-preview" style="color:var(--phosphor,#1cff9b);font-size:1.1em;">' + CIPHERTEXT + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="puzzle-ddc-answer">' +
          '<label class="puzzle-ddc-answer-label" for="qr-cipher-input">ENTER PASSPHRASE:</label>' +
          '<input type="text" id="qr-cipher-input" class="puzzle-ddc-input" ' +
            'placeholder="Enter decoded text" autocomplete="off" spellcheck="false"' +
            (alreadySolved ? ' disabled' : '') + '>' +
          '<button type="button" id="qr-cipher-submit" class="puzzle-ddc-submit"' +
            (alreadySolved ? ' disabled' : '') + '>' +
            (alreadySolved ? '&#10003; SOLVED' : 'SUBMIT') +
          '</button>' +
        '</div>' +
        '<div class="puzzle-ddc-feedback" id="qr-cipher-feedback">' +
          (alreadySolved ? '<span class="puzzle-ddc-success">&#10003; CIPHER CRACKED — Field clearance granted.</span>' : '') +
        '</div>' +
      '</div>';

    // Build the alphabet rings
    var outerRing = container.querySelector('#qr-ring-outer');
    var innerRing = container.querySelector('#qr-ring-inner');
    var shiftDisplay = container.querySelector('#qr-shift-display');
    var preview = container.querySelector('#qr-cipher-preview');

    function buildRings() {
      var outerHTML = '';
      var innerHTML = '';
      for (var i = 0; i < 26; i++) {
        var outerChar = ALPHABET[i];
        var innerIdx = (i + currentShift + 26) % 26;
        var innerChar = ALPHABET[innerIdx];
        var isHighlight = (currentShift === SHIFT) ? ' style="color:var(--phosphor,#1cff9b);font-weight:bold;"' : '';
        outerHTML += '<span class="puzzle-cipher-letter"' + isHighlight + '>' + outerChar + '</span>';
        innerHTML += '<span class="puzzle-cipher-letter"' + isHighlight + '>' + innerChar + '</span>';
      }
      outerRing.innerHTML = outerHTML;
      innerRing.innerHTML = innerHTML;
      shiftDisplay.textContent = currentShift;

      // Update preview
      var decoded = caesarEncode(CIPHERTEXT, 26 - currentShift);
      preview.textContent = decoded;
    }

    buildRings();

    if (alreadySolved) return;

    var leftBtn = container.querySelector('#qr-shift-left');
    var rightBtn = container.querySelector('#qr-shift-right');
    var input = container.querySelector('#qr-cipher-input');
    var submitBtn = container.querySelector('#qr-cipher-submit');
    var feedback = container.querySelector('#qr-cipher-feedback');

    leftBtn.addEventListener('click', function () {
      currentShift = (currentShift - 1 + 26) % 26;
      buildRings();
      if (window.AudioSystem && AudioSystem.playSFX) AudioSystem.playSFX('ui-01');
    });

    rightBtn.addEventListener('click', function () {
      currentShift = (currentShift + 1) % 26;
      buildRings();
      if (window.AudioSystem && AudioSystem.playSFX) AudioSystem.playSFX('ui-01');
    });

    function checkAnswer() {
      var answer = input.value.trim().toUpperCase();
      if (!answer) {
        feedback.innerHTML = '<span class="puzzle-ddc-error">Enter the decoded passphrase.</span>';
        return;
      }
      if (answer === CLEARTEXT) {
        PuzzlePopup.solved();
        markSolved();
        feedback.innerHTML = '<span class="puzzle-ddc-success">&#10003; CIPHER CRACKED — Field clearance granted!</span>';
        input.disabled = true;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '&#10003; SOLVED';

        // Register as clue for PuzzleState integration
        if (window.PuzzleState && PuzzleState.onClueFound) {
          PuzzleState.onClueFound('qr-cipher-solved', 'qr-puzzle');
        }

        if (window.AudioSystem && AudioSystem.playSFX) AudioSystem.playSFX('ui-04');
      } else {
        feedback.innerHTML = '<span class="puzzle-ddc-error">INCORRECT — Decryption failed. Adjust the cipher wheel.</span>';
        if (window.AudioSystem && AudioSystem.playSFX) AudioSystem.playSFX('ui-01');
      }
    }

    submitBtn.addEventListener('click', checkAnswer);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); checkAnswer(); }
      e.stopPropagation();
    });
    input.addEventListener('keyup', function (e) { e.stopPropagation(); });
  }

  // ---- Register with PuzzlePopup ----
  PuzzlePopup.register('qr-cipher', {
    title: 'FIELD CIPHER — QR INTERCEPT',
    render: render,
    onSolve: function () {
      // Award coins if PuzzleState available
      try {
        var acct = JSON.parse(localStorage.getItem('eyesonly_account') || '{}');
        acct.puzzleCoins = (acct.puzzleCoins || 0) + 15;
        localStorage.setItem('eyesonly_account', JSON.stringify(acct));
      } catch (_) {}
    }
  });
  } // end _register

  // Deferred registration: wait for PuzzlePopup if not yet loaded
  if (typeof PuzzlePopup !== 'undefined') {
    _register();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof PuzzlePopup !== 'undefined') _register();
    });
    // Fallback: poll briefly in case DOMContentLoaded already fired
    var _attempts = 0;
    var _poll = setInterval(function () {
      _attempts++;
      if (typeof PuzzlePopup !== 'undefined') {
        clearInterval(_poll);
        _register();
      } else if (_attempts > 50) {
        clearInterval(_poll);
      }
    }, 100);
  }

})();
