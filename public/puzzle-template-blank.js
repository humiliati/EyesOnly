// ============================================================
// EYES ONLY — Blank Puzzle Template
// ============================================================
//
// HOW TO USE THIS TEMPLATE:
//
// 1. Copy this entire file
// 2. Paste it into Grok (X), ChatGPT, Claude, or any LLM
// 3. Tell the LLM: "Make me a new variant of this puzzle about [THEME]"
//    Examples:
//    - "Make this about coffee shop secret codes for a café treasure hunt"
//    - "Turn this into a math cipher where the answer is a phone number"
//    - "Make a riddle chain about landmarks in downtown Sandpoint"
// 4. The LLM will return modified code
// 5. Paste the modified code into the Puzzle Designer portal
//    at: https://flapsandseals.com/puzzle-designer
// 6. Click SAVE → PUBLISH → download the QR code
// 7. Print the QR code on a sticker, coffee mug, poster, etc.
// 8. Players scan it → puzzle opens → they solve it → next clue
//
// RULES THE LLM MUST FOLLOW:
// - Must call PuzzlePopup.register(PUZZLE_KEY, { title, render, onSolve })
// - render(container) builds the puzzle UI inside the given DOM element
// - Call PuzzlePopup.solved() when the player wins
// - Use CSS classes starting with "puzzle-ddc-" for CRT terminal styling
// - Use localStorage with "eyesonly_" prefix for saving progress
// - Keep it mobile-friendly (320px minimum width)
// - No external dependencies — vanilla JS only
// - Theme: Cold War espionage / spy thriller
//
// AVAILABLE CSS CLASSES FOR STYLING:
//   .puzzle-ddc-briefing   — Top section container
//   .puzzle-ddc-label      — Uppercase label text
//   .puzzle-ddc-flavor     — Flavor/description text
//   .puzzle-ddc-cipher     — Bordered message display box
//   .puzzle-ddc-cipher-text — Monospace text inside cipher box
//   .puzzle-ddc-answer     — Answer input section
//   .puzzle-ddc-input      — Text input field
//   .puzzle-ddc-submit     — Submit button
//   .puzzle-ddc-success    — Green success message
//   .puzzle-ddc-error      — Red error message
//   .puzzle-ddc-feedback   — Feedback message container
//
// ============================================================

// --- CONFIGURATION (MODIFY THESE) ---

var PUZZLE_KEY = "custom-" + "YOUR-SLUG-HERE";  // CHANGE: unique ID for this puzzle

var PUZZLE_CONFIG = {
  title: "YOUR PUZZLE TITLE",          // Shown in the popup header bar
  briefing: "MISSION BRIEFING TEXT",    // Spy-themed flavor text at the top
  question: "What is the answer?",      // The challenge presented to the player
  answer: "ANSWER",                     // Correct answer (ALWAYS UPPERCASE)
  alternates: ["ALT1", "ALT2"],         // Other accepted answers (UPPERCASE)
  hint: "Think about...",               // Optional hint (shown on button click)
  successMsg: "ACCESS GRANTED",         // Victory message
  coins: 15,                            // Reward coins on solve
};

// --- PUZZLE STATE ---

var SOLVED_KEY = "eyesonly_" + PUZZLE_KEY + "_solved";

function isSolved() {
  try { return localStorage.getItem(SOLVED_KEY) === "true"; }
  catch (_) { return false; }
}

// --- RENDER FUNCTION ---
// This is the main function that builds the puzzle UI.
// `container` is a DOM element — build your HTML inside it.

function render(container) {
  // Already solved? Show completion screen
  if (isSolved()) {
    container.innerHTML =
      '<div class="puzzle-ddc-briefing">' +
        '<span class="puzzle-ddc-label">MISSION COMPLETE</span>' +
        '<p class="puzzle-ddc-flavor">' + PUZZLE_CONFIG.successMsg + '</p>' +
      '</div>' +
      '<div style="text-align:center;margin:16px 0;">' +
        '<span class="puzzle-ddc-success">&#10003; SOLVED</span>' +
      '</div>';
    return;
  }

  // Build the puzzle UI
  container.innerHTML =
    '<div class="puzzle-ddc-briefing">' +
      '<span class="puzzle-ddc-label">' + PUZZLE_CONFIG.briefing + '</span>' +
    '</div>' +

    '<div class="puzzle-ddc-cipher" style="margin:12px 0;">' +
      '<span class="puzzle-ddc-cipher-label">CHALLENGE:</span>' +
      '<div class="puzzle-ddc-cipher-text" style="font-size:0.95em;line-height:1.5;">' +
        PUZZLE_CONFIG.question +
      '</div>' +
    '</div>' +

    // Optional hint button
    '<div style="text-align:center;margin:8px 0;">' +
      '<button type="button" id="puzzle-hint-btn" class="puzzle-ddc-submit" ' +
        'style="width:auto;padding:4px 14px;font-size:0.75em;opacity:0.7;">' +
        'REQUEST HINT' +
      '</button>' +
      '<div id="puzzle-hint" style="display:none;margin-top:6px;font-size:0.8em;color:#1a6b4a;font-style:italic;">' +
        PUZZLE_CONFIG.hint +
      '</div>' +
    '</div>' +

    // Answer input
    '<div class="puzzle-ddc-answer">' +
      '<label class="puzzle-ddc-answer-label" for="puzzle-input">YOUR ANSWER:</label>' +
      '<input type="text" id="puzzle-input" class="puzzle-ddc-input" ' +
        'placeholder="Enter your answer" autocomplete="off" spellcheck="false">' +
      '<button type="button" id="puzzle-submit" class="puzzle-ddc-submit">SUBMIT</button>' +
    '</div>' +
    '<div class="puzzle-ddc-feedback" id="puzzle-feedback"></div>';

  // Wire up event handlers
  var input = container.querySelector("#puzzle-input");
  var submitBtn = container.querySelector("#puzzle-submit");
  var feedback = container.querySelector("#puzzle-feedback");
  var hintBtn = container.querySelector("#puzzle-hint-btn");
  var hintEl = container.querySelector("#puzzle-hint");

  // Hint toggle
  hintBtn.addEventListener("click", function () {
    hintEl.style.display = "block";
    hintBtn.textContent = "HINT ACTIVE";
    hintBtn.style.opacity = "0.5";
  });

  // Answer check
  function checkAnswer() {
    var answer = input.value.trim().toUpperCase();
    if (!answer) {
      feedback.innerHTML = '<span class="puzzle-ddc-error">Enter your answer, operative.</span>';
      return;
    }

    var correct = (answer === PUZZLE_CONFIG.answer) ||
      (PUZZLE_CONFIG.alternates && PUZZLE_CONFIG.alternates.indexOf(answer) !== -1);

    if (correct) {
      // Mark solved
      try { localStorage.setItem(SOLVED_KEY, "true"); } catch (_) {}

      // Notify popup system
      PuzzlePopup.solved();

      // Show success
      feedback.innerHTML = '<span class="puzzle-ddc-success">&#10003; ' + PUZZLE_CONFIG.successMsg + '</span>';
      input.disabled = true;
      submitBtn.disabled = true;
      submitBtn.innerHTML = "&#10003; SOLVED";

      // Register with cross-page puzzle state if available
      if (typeof PuzzleState !== "undefined" && PuzzleState.onClueFound) {
        PuzzleState.onClueFound(PUZZLE_KEY + "-solved", "qr-puzzle");
      }
    } else {
      feedback.innerHTML = '<span class="puzzle-ddc-error">INCORRECT — Try again.</span>';
    }
  }

  submitBtn.addEventListener("click", checkAnswer);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); checkAnswer(); }
    e.stopPropagation();
  });
  input.addEventListener("keyup", function (e) { e.stopPropagation(); });

  // Auto-focus the input
  setTimeout(function () { input.focus(); }, 100);
}

// --- REGISTER WITH PUZZLE SYSTEM ---

PuzzlePopup.register(PUZZLE_KEY, {
  title: PUZZLE_CONFIG.title,
  render: render,
  onSolve: function () {
    // Award coins to player account
    try {
      var acct = JSON.parse(localStorage.getItem("eyesonly_account") || "{}");
      acct.puzzleCoins = (acct.puzzleCoins || 0) + PUZZLE_CONFIG.coins;
      localStorage.setItem("eyesonly_account", JSON.stringify(acct));
    } catch (_) {}
  }
});
