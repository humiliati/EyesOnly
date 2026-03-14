/**
 * dead-drop-cipher.js — Dead Drop Cipher Puzzle
 *
 * A self-contained Caesar cipher puzzle. The player is shown an
 * intercepted encoded message and a shift-key table. They must
 * decode the message and enter the cleartext passphrase to solve.
 *
 * On solve → grants Cypher Note #1 (ITM-202) to AccountInventory
 * and populates the next empty decryption inventory slot.
 *
 * Registers with PuzzlePopup under key 'dead-drop-cipher'.
 */
(function () {
  'use strict';

  if (typeof PuzzlePopup === 'undefined') return;

  // ---- Puzzle data ----
  var SHIFT = 3;  // Caesar shift amount
  var CLEARTEXT = 'SILVER FALCON';
  var SOLVED_KEY = 'eyesonly_puzzle_dead_drop_solved';

  // Encode the cleartext with the Caesar shift
  function caesarEncode(text, shift) {
    return text.split('').map(function (ch) {
      if (ch >= 'A' && ch <= 'Z') {
        return String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65);
      }
      return ch;
    }).join('');
  }

  var CIPHERTEXT = caesarEncode(CLEARTEXT, SHIFT);

  // ---- Reward item config ----
  var REWARD_ITEM_ID = 'ITM-202';
  var REWARD_ITEM = {
    id: REWARD_ITEM_ID,
    qty: 1,
    meta: {
      name: 'Cypher Note #1',
      emoji: '\uD83D\uDCC4', // 📄
      type: 'equipment',
      subtype: 'investigation',
      rarity: 'uncommon',
      platformItem: true,
      noteIndex: 1,
      description: 'A recovered dead-drop cipher key. Shift-3 Caesar table for field decryption.'
    }
  };

  function isSolved() {
    try { return localStorage.getItem(SOLVED_KEY) === 'true'; }
    catch (_) { return false; }
  }

  function markSolved() {
    try { localStorage.setItem(SOLVED_KEY, 'true'); }
    catch (_) {}
  }

  // Build the key table HTML (A→D, B→E, etc.)
  function buildKeyTableHTML() {
    var plain = '';
    var cipher = '';
    for (var i = 0; i < 26; i++) {
      var p = String.fromCharCode(65 + i);
      var c = String.fromCharCode(65 + ((i + SHIFT) % 26));
      plain += p + ' ';
      cipher += c + ' ';
    }
    return '<div class="puzzle-keytable">' +
      '<div class="puzzle-keytable-label">PLAIN:</div>' +
      '<div class="puzzle-keytable-row">' + plain.trim() + '</div>' +
      '<div class="puzzle-keytable-label">CIPHER:</div>' +
      '<div class="puzzle-keytable-row">' + cipher.trim() + '</div>' +
      '</div>';
  }

  function render(container) {
    var alreadySolved = isSolved();

    container.innerHTML =
      '<div class="puzzle-ddc">' +
        '<div class="puzzle-ddc-briefing">' +
          '<span class="puzzle-ddc-label">INTERCEPTED TRANSMISSION</span>' +
          '<p class="puzzle-ddc-flavor">An encoded dead-drop message was recovered from a Sandpoint waypoint. ' +
          'Use the shift-key table below to decode the passphrase.</p>' +
        '</div>' +
        '<div class="puzzle-ddc-cipher">' +
          '<span class="puzzle-ddc-cipher-label">ENCODED MESSAGE:</span>' +
          '<div class="puzzle-ddc-cipher-text">' + CIPHERTEXT + '</div>' +
        '</div>' +
        buildKeyTableHTML() +
        '<div class="puzzle-ddc-answer">' +
          '<label class="puzzle-ddc-answer-label" for="ddc-input">DECODED PASSPHRASE:</label>' +
          '<input type="text" id="ddc-input" class="puzzle-ddc-input" ' +
            'placeholder="Enter decoded text" autocomplete="off" spellcheck="false"' +
            (alreadySolved ? ' disabled' : '') + '>' +
          '<button type="button" id="ddc-submit" class="puzzle-ddc-submit"' +
            (alreadySolved ? ' disabled' : '') + '>' +
            (alreadySolved ? '&#10003; SOLVED' : 'SUBMIT') +
          '</button>' +
        '</div>' +
        '<div class="puzzle-ddc-feedback" id="ddc-feedback">' +
          (alreadySolved ? '<span class="puzzle-ddc-success">&#10003; DECODED — Cypher Note #1 acquired.</span>' : '') +
        '</div>' +
      '</div>';

    if (alreadySolved) return;

    var input = container.querySelector('#ddc-input');
    var submitBtn = container.querySelector('#ddc-submit');
    var feedback = container.querySelector('#ddc-feedback');

    function checkAnswer() {
      var answer = input.value.trim().toUpperCase();
      if (!answer) {
        feedback.innerHTML = '<span class="puzzle-ddc-error">Enter the decoded passphrase.</span>';
        return;
      }
      if (answer === CLEARTEXT) {
        // Correct! — grant reward first, then mark solved
        PuzzlePopup.solved();
        markSolved();
        feedback.innerHTML = '<span class="puzzle-ddc-success">&#10003; DECODED — Cypher Note #1 acquired!</span>';
        input.disabled = true;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '&#10003; SOLVED';

        if (window.AudioSystem && AudioSystem.playSFX) {
          AudioSystem.playSFX('ui-04');
        }
      } else {
        feedback.innerHTML = '<span class="puzzle-ddc-error">INCORRECT — Decryption failed. Try again.</span>';
        if (window.AudioSystem && AudioSystem.playSFX) {
          AudioSystem.playSFX('ui-01');
        }
      }
    }

    submitBtn.addEventListener('click', checkAnswer);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkAnswer();
      }
      // Stop Escape from also closing popup when typing
      e.stopPropagation();
    });
    // Allow Escape to close when not focused on input
    input.addEventListener('keyup', function (e) { e.stopPropagation(); });
  }

  // ---- Grant item to inventory + refresh grid ----
  function grantReward() {
    if (typeof AccountInventory === 'undefined') return;
    if (AccountInventory.hasItem(REWARD_ITEM_ID)) return; // already have it

    AccountInventory.addItem(REWARD_ITEM);

    // Refresh the decryption inventory grid on the page
    var grid = document.getElementById('decryption-inventory');
    if (!grid) return;

    var items = AccountInventory.getItems();
    var slots = grid.querySelectorAll('.games-inv-slot');
    var SLOT_COUNT = slots.length;

    // Find the first empty slot or the slot for this item
    items.forEach(function (item, idx) {
      if (idx >= SLOT_COUNT) return;
      var slot = slots[idx];
      var emoji = (item.meta && item.meta.emoji) || '\uD83D\uDCE6';
      var label = (item.meta && item.meta.name) || item.id;
      var itemKey = item.id === 'ITM-200' ? 'magnifying-glass' : item.id.toLowerCase();

      slot.setAttribute('data-item', itemKey);
      slot.setAttribute('data-item-id', item.id);

      var inner = slot.querySelector('.games-inv-slot-inner');
      if (inner) {
        inner.className = 'games-inv-slot-inner games-inv-occupied';
        inner.innerHTML =
          '<span class="games-inv-item-icon">' + emoji + '</span>' +
          '<span class="games-inv-slot-label">' + label.substring(0, 10).toUpperCase() + '</span>';
      }
    });
  }

  // ---- Register with PuzzlePopup ----
  PuzzlePopup.register('dead-drop-cipher', {
    title: 'DEAD DROP CIPHER',
    render: render,
    onSolve: grantReward
  });

})();
