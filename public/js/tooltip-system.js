/* ============================================================
   EYES ONLY - Tooltip System
   Universal activity reporting using MOK interjection field
   ============================================================ */

const TooltipSystem = (function() {
  'use strict';

  var _currentTimer = null;
  var _mokInterjectionElement = null;
  var _mokHistoryContainer = null;
  var _isExpanded = false;
  var _messageHistory = [];
  var MAX_HISTORY_LINES = 256;
  var DEFAULT_MESSAGE = 'Standing by for advisories.';
  var _lastMessage = DEFAULT_MESSAGE;  // remembers the most recent tooltip

  // ── Priority system ────────────────────────────────────────
  // Higher priority messages block lower ones.
  // Dialogue (3) > persistent (2) > timed (1)
  var PRIORITY_NORMAL = 1;
  var PRIORITY_PERSISTENT = 2;
  var PRIORITY_DIALOGUE = 3;
  var _currentPriority = PRIORITY_NORMAL;
  var _dialogueActive = false;       // True while showDialogue is rendering
  var _dialogueClickHandler = null;  // Bound click handler for dialogue choices

  /**
   * Initialize tooltip system
   */
  function init() {
    _mokInterjectionElement = document.getElementById('mok-interject-body');
    if (!_mokInterjectionElement) {
      console.warn('TooltipSystem: MOK interjection element not found');
    }

    // Create history container if it doesn't exist
    _createHistoryContainer();
  }

  /**
   * Create scrollable history container for MOK interjection.
   * Layout: toggle button lives in the footer row (always visible).
   * History panel pops UP from the footer using absolute positioning
   * so it overlays the game screen, not pushes content down.
   */
  function _createHistoryContainer() {
    var existingContainer = document.getElementById('mok-history-container');
    if (existingContainer) {
      _mokHistoryContainer = existingContainer;
      return;
    }

    // The MOK interjection parent (#mok-interjections)
    var mokParent = _mokInterjectionElement ? _mokInterjectionElement.parentElement : null;
    if (!mokParent) return;

    // Make parent the positioning anchor for the upward-expanding history
    mokParent.style.position = 'relative';

    // Find existing toggle button from HTML (preferred) or create one
    var toggleBtn = document.getElementById('mok-history-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleHistory);
    } else {
      // Fallback: create toggle button dynamically
      toggleBtn = document.createElement('button');
      toggleBtn.id = 'mok-history-toggle';
      toggleBtn.className = 'header-chip mok-history-toggle';
      toggleBtn.innerHTML = '<span class="mok-history-icon">▼</span> <span class="mok-history-label">LOG</span>';
      toggleBtn.setAttribute('data-sound', 'ui-04');
      toggleBtn.addEventListener('click', toggleHistory);
      mokParent.insertBefore(toggleBtn, _mokInterjectionElement.nextSibling);
    }

    // Create history container — absolutely positioned ABOVE the footer
    _mokHistoryContainer = document.createElement('div');
    _mokHistoryContainer.id = 'mok-history-container';
    _mokHistoryContainer.className = 'mok-history-container mok-history-collapsed';

    // History content (scrollable area)
    var historyContent = document.createElement('div');
    historyContent.id = 'mok-history-content';
    historyContent.className = 'mok-history-content';
    _mokHistoryContainer.appendChild(historyContent);

    // Append container to parent — CSS positions it above via bottom:100%
    mokParent.appendChild(_mokHistoryContainer);
  }

  /**
   * Get current context (what mode the user is in)
   */
  function _getCurrentContext() {
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function') {
      if (GoneRogue.isActive()) {
        if (typeof GoneRogue.isInStrCombat === 'function' && GoneRogue.isInStrCombat()) {
          return 'str-combat';
        }
        return 'gone-rogue';
      }
    }
    if (typeof StreetChronicles !== 'undefined' && typeof StreetChronicles.isActive === 'function') {
      if (StreetChronicles.isActive()) {
        return 'street-chronicles';
      }
    }
    return 'terminal';
  }

  /**
   * Show a tooltip message with auto-clear
   */
  function show(message, durationMs) {
    if (!_mokInterjectionElement) {
      init();
      if (!_mokInterjectionElement) return;
    }

    // Don't overwrite higher-priority content (e.g. active dialogue)
    if (_currentPriority > PRIORITY_NORMAL) {
      _addToHistory(message); // still log it
      return;
    }

    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    _mokInterjectionElement.textContent = message;
    _lastMessage = message;
    _addToHistory(message);

    var duration = durationMs || 2500;
    _currentTimer = setTimeout(function() {
      if (_currentPriority <= PRIORITY_NORMAL) {
        // Keep showing the last message instead of reverting to default
        _mokInterjectionElement.textContent = _lastMessage;
      }
      _currentTimer = null;
    }, duration);
  }

  /**
   * Add message to history
   */
  function _addToHistory(message) {
    if (!message || message === DEFAULT_MESSAGE) return;

    var now = new Date();
    var timestamp = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: 'numeric',
      minute: '2-digit'
    });

    _messageHistory.unshift({ time: timestamp, message: message, timestamp: now.getTime() });

    if (_messageHistory.length > MAX_HISTORY_LINES) {
      _messageHistory = _messageHistory.slice(0, MAX_HISTORY_LINES);
    }

    if (_isExpanded) {
      _renderHistory();
    }
  }

  /**
   * Render history with progressive transparency and compaction.
   *
   * Rows 0-9   (newest):  full opacity, normal spacing
   * Rows 10-19 (middle):  fading opacity, slightly compacted
   * Rows 20+   (oldest):  very transparent, heavily compacted "rolodex" look
   */
  function _renderHistory() {
    if (!_mokHistoryContainer) return;

    var content = document.getElementById('mok-history-content');
    if (!content) return;

    var html = '';
    for (var i = 0; i < _messageHistory.length; i++) {
      var entry = _messageHistory[i];

      // Progressive opacity: newest = 1.0, fading toward 0.15 for oldest
      var opacity;
      if (i < 10) {
        opacity = 1.0 - (i * 0.03);        // 1.0 → 0.73
      } else if (i < 20) {
        opacity = 0.7 - ((i - 10) * 0.04);  // 0.7 → 0.34
      } else {
        opacity = Math.max(0.15, 0.3 - ((i - 20) * 0.005)); // 0.3 → 0.15
      }

      // Progressive compaction: tight rows that get tighter
      var marginTop;
      var scale;
      if (i < 10) {
        marginTop = 0;      // tight, no extra space
        scale = 1.0;
      } else if (i < 20) {
        marginTop = -1;      // start overlapping slightly
        scale = 0.97;
      } else {
        marginTop = -2;      // rolodex overlap
        scale = 0.94;
      }

      var style = 'opacity:' + opacity.toFixed(2) + ';';
      if (marginTop !== 0) {
        style += 'margin-top:' + marginTop + 'px;';
      }
      if (scale !== 1.0) {
        style += 'transform:scaleY(' + scale + ');transform-origin:bottom;';
      }

      html += '<div class="mok-history-entry" style="' + style + '">';
      html += '<span class="mok-history-time">' + entry.time + '</span> ';
      html += '<span class="mok-history-message">' + entry.message + '</span>';
      html += '</div>';
    }

    if (html === '') {
      html = '<div class="mok-history-empty">No messages yet</div>';
    }

    content.innerHTML = html;

    // Scroll to top (newest first)
    content.scrollTop = 0;
  }

  /**
   * Toggle history visibility
   */
  function toggleHistory() {
    _isExpanded = !_isExpanded;

    var toggleBtn = document.getElementById('mok-history-toggle');

    // The parent (#mok-interjections) may have overflow:hidden and low z-index
    // from CRT mobile rules. Override when expanding so the upward panel is visible.
    var mokParent = _mokHistoryContainer ? _mokHistoryContainer.parentElement : null;

    if (_isExpanded) {
      _mokHistoryContainer.classList.remove('mok-history-collapsed');
      _mokHistoryContainer.classList.add('mok-history-expanded');
      if (toggleBtn) {
        var icon = toggleBtn.querySelector('.mok-history-icon');
        if (icon) icon.textContent = '▲';
      }
      // Override parent constraints so absolute-positioned panel escapes
      if (mokParent) {
        mokParent.style.overflow = 'visible';
        mokParent.style.zIndex = '9000';
      }
      _renderHistory();
    } else {
      _mokHistoryContainer.classList.remove('mok-history-expanded');
      _mokHistoryContainer.classList.add('mok-history-collapsed');
      if (toggleBtn) {
        var icon2 = toggleBtn.querySelector('.mok-history-icon');
        if (icon2) icon2.textContent = '▼';
      }
      // Restore parent overflow so footer stays compact when collapsed
      if (mokParent) {
        mokParent.style.overflow = '';
        mokParent.style.zIndex = '';
      }
    }
  }

  /**
   * Collapse history (force to minimized state)
   */
  function collapseHistory() {
    if (!_isExpanded) return;

    _isExpanded = false;
    var toggleBtn = document.getElementById('mok-history-toggle');

    _mokHistoryContainer.classList.remove('mok-history-expanded');
    _mokHistoryContainer.classList.add('mok-history-collapsed');
    if (toggleBtn) {
      var icon = toggleBtn.querySelector('.mok-history-icon');
      if (icon) icon.textContent = '▼';
    }

    // Restore parent overflow/z-index
    var mokParent = _mokHistoryContainer ? _mokHistoryContainer.parentElement : null;
    if (mokParent) {
      mokParent.style.overflow = '';
      mokParent.style.zIndex = '';
    }
  }

  /**
   * Show a sequence of tooltip messages without resetting to default between them.
   * Each message displays for `durationMs`, with `gapMs` pause (holding previous text)
   * before the next message.  Resets to default only after the last message expires.
   *
   * @param {Array<string>} messages  - Ordered tooltip strings
   * @param {number} durationMs       - Display time per message (default 1500)
   * @param {number} gapMs            - Pause between messages (default 200)
   * @param {Function} [onEach]       - Optional callback(message, index) fired with each message
   */
  function showSequence(messages, durationMs, gapMs, onEach) {
    if (!messages || messages.length === 0) return;
    if (!_mokInterjectionElement) {
      init();
      if (!_mokInterjectionElement) return;
    }

    // Don't overwrite active dialogue with a sequence
    if (_currentPriority >= PRIORITY_DIALOGUE) {
      messages.forEach(function(msg) { _addToHistory(msg); });
      return;
    }

    var dur = durationMs || 1500;
    var gap = gapMs || 200;
    var step = dur + gap;

    // Cancel any existing timer so we own the tooltip for the whole sequence
    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    messages.forEach(function(msg, i) {
      var showAt = i * step;
      setTimeout(function() {
        _mokInterjectionElement.textContent = msg;
        _lastMessage = msg;   // each message becomes the remembered tooltip
        _addToHistory(msg);
        if (typeof onEach === 'function') onEach(msg, i);
      }, showAt);
    });

    // After the last message's full duration, revert to last message (not default)
    var totalDuration = messages.length * step - gap + dur;
    _currentTimer = setTimeout(function() {
      if (_currentPriority <= PRIORITY_NORMAL) {
        _mokInterjectionElement.textContent = _lastMessage;
      }
      _currentTimer = null;
    }, totalDuration);
  }

  /**
   * Show a persistent tooltip message (stays until replaced)
   */
  function showPersistent(message) {
    if (!_mokInterjectionElement) {
      init();
      if (!_mokInterjectionElement) return;
    }

    // Don't overwrite dialogue with persistent messages
    if (_currentPriority > PRIORITY_PERSISTENT) {
      _addToHistory(message);
      return;
    }

    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    _mokInterjectionElement.textContent = message;
    _lastMessage = message;
    _addToHistory(message);
  }

  /**
   * Clear the current tooltip and reset to default
   */
  function clear() {
    if (!_mokInterjectionElement) return;

    // Don't clear dialogue via normal clear()
    if (_dialogueActive) return;

    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    _currentPriority = PRIORITY_NORMAL;
    _detachDialogueClickHandlers();
    _mokInterjectionElement.innerHTML = '';
    // Restore last remembered tooltip instead of bland default
    _mokInterjectionElement.textContent = _lastMessage || DEFAULT_MESSAGE;
  }

  /**
   * Show context-appropriate tooltip
   */
  function showAction(action, data) {
    var context = _getCurrentContext();
    var message = '';

    switch (action) {
      case 'move':
        message = (data && data.run) ? '🏃 RUNNING' : '🥾 WALKING';
        break;
      case 'combat-enter':
        message = '⚔️ ENGAGING ENEMY';
        break;
      case 'attack':
        message = '🔫 ATTACKING';
        break;
      case 'currency-pickup':
        var amount = (data && data.amount) || 'X';
        message = '💰 COLLECTED ' + amount + ' CRYPTOS';
        break;
      case 'item-pickup':
        var itemName = (data && data.name) || 'ITEM';
        message = '📦 PICKED UP ' + itemName;
        break;
      case 'key-ammo-pickup':
        var keyAmmoName = (data && data.name) || 'Key';
        message = '\uD83D\uDDDD ' + keyAmmoName + ' +1';
        break;
      case 'key-item-pickup':
        var keyItemName = (data && data.name) || 'KEY';
        message = '🔑 KEY ITEM: ' + keyItemName + ' → INVENTORY';
        break;
      case 'card-pickup':
        var cardName = (data && data.name) || 'CARD';
        message = '🃏 PICKED UP ' + cardName;
        break;
      case 'item-use':
        var useName = (data && data.name) || 'ITEM';
        message = '⚡ USED ' + useName;
        break;
      case 'item-use-invalid':
        message = '❌ INVALID ITEM USE';
        break;
      case 'item-equip':
        var equipName = (data && data.name) || 'ITEM';
        message = '⚡ EQUIPPED ' + equipName;
        break;
      case 'item-unequip':
        var unequipName = (data && data.name) || 'ITEM';
        message = '⚠ UNEQUIPPED ' + unequipName;
        break;
      case 'card-deploy':
        var deployName = (data && data.name) || 'CARD';
        message = '🃏 DEPLOYED ' + deployName;
        break;
      case 'flee':
        message = '🏃 FLEEING COMBAT';
        break;
      case 'interact':
        message = '🤝 INTERACTING';
        break;
      case 'link-open':
        var linkDesc = (data && data.description) || 'LINK';
        message = '🔗 OPENING ' + linkDesc;
        break;
      default:
        message = action;
    }

    show(message);
  }

  // ── Dialogue Rendering ──────────────────────────────────────

  /**
   * Render NPC dialogue with clickable choice links in the MOK interjection field.
   * Uses innerHTML for rich content. Active dialogue blocks all lower-priority messages.
   *
   * @param {string} speaker     - e.g. "🍺 Barkeep"
   * @param {string} text        - NPC's speech text
   * @param {Array}  choices     - [{ label, next, ... }] — clickable options
   * @param {Object} visitedNodes - Set of visited node IDs for "already read" styling
   */
  function showDialogue(speaker, text, choices, visitedNodes) {
    if (!_mokInterjectionElement) {
      init();
      if (!_mokInterjectionElement) return;
    }

    // Cancel any timed tooltip
    if (_currentTimer) {
      clearTimeout(_currentTimer);
      _currentTimer = null;
    }

    _dialogueActive = true;
    _currentPriority = PRIORITY_DIALOGUE;

    // Build HTML for the interjection field
    var html = '';
    html += '<span class="dialogue-speaker">' + _escapeHtml(speaker) + '</span> ';
    html += '<span class="dialogue-text">' + _escapeHtml(text) + '</span>';

    if (choices && choices.length > 0) {
      html += ' <span class="dialogue-choices">';
      for (var i = 0; i < choices.length; i++) {
        var choice = choices[i];
        var visitedClass = '';
        if (choice.next && visitedNodes && visitedNodes[choice.next]) {
          visitedClass = ' dialogue-choice-visited';
        }
        html += '<span class="dialogue-choice' + visitedClass + '" data-choice-idx="' + i + '">';
        html += '[' + _escapeHtml(choice.label) + ']';
        html += '</span>';
        if (i < choices.length - 1) html += ' ';
      }
      html += '</span>';
    }

    // Render with innerHTML (not textContent) for clickable elements
    _mokInterjectionElement.innerHTML = html;

    // Log the NPC speech to history (plain text version)
    // Remember plain-text version so it persists after dialogue ends
    _lastMessage = speaker + ': ' + text;
    _addToHistory(_lastMessage);

    // Attach click handlers for dialogue choices
    _attachDialogueClickHandlers();
  }

  /**
   * Attach click event delegation for dialogue choice spans.
   */
  function _attachDialogueClickHandlers() {
    // Remove old handler if any
    _detachDialogueClickHandlers();

    _dialogueClickHandler = function(e) {
      var target = e.target;
      // Walk up to find .dialogue-choice
      while (target && target !== _mokInterjectionElement) {
        if (target.classList && target.classList.contains('dialogue-choice')) {
          var idx = parseInt(target.getAttribute('data-choice-idx'), 10);
          if (!isNaN(idx) && typeof DialogueSystem !== 'undefined') {
            DialogueSystem.selectChoice(idx);
          }
          e.stopPropagation();
          return;
        }
        target = target.parentElement;
      }
    };

    _mokInterjectionElement.addEventListener('click', _dialogueClickHandler);
  }

  /**
   * Remove dialogue click handlers.
   */
  function _detachDialogueClickHandlers() {
    if (_dialogueClickHandler && _mokInterjectionElement) {
      _mokInterjectionElement.removeEventListener('click', _dialogueClickHandler);
      _dialogueClickHandler = null;
    }
  }

  /**
   * End dialogue mode — called by DialogueSystem.endConversation().
   * Restores normal tooltip behavior.
   */
  function clearDialogue() {
    _dialogueActive = false;
    _currentPriority = PRIORITY_NORMAL;
    _detachDialogueClickHandlers();

    if (_mokInterjectionElement) {
      _mokInterjectionElement.innerHTML = '';
      // Restore last remembered tooltip instead of bland default
      _mokInterjectionElement.textContent = _lastMessage || DEFAULT_MESSAGE;
    }
  }

  /**
   * Set tooltip priority level.
   * Used by DialogueSystem to lock/unlock the tooltip.
   */
  function setPriority(level) {
    _currentPriority = level || PRIORITY_NORMAL;
    if (_currentPriority <= PRIORITY_NORMAL) {
      _dialogueActive = false;
      _detachDialogueClickHandlers();
    }
  }

  /**
   * Get current priority level.
   */
  function getPriority() {
    return _currentPriority;
  }

  /**
   * Alias: show with generic prefix. Used by shopkeeper adjacency etc.
   */
  function showGeneric(message, durationMs) {
    show(message, durationMs);
  }

  /**
   * Escape HTML special characters for safe innerHTML insertion.
   */
  function _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── MOK Idle Quip Engine ─────────────────────────────────────
  // Periodic snarky interjections à la GLaDOS / Wheatley.
  // Fires only when the tooltip is at NORMAL priority (no dialogue,
  // no game event) and the user has been idle.

  var _quipTimer = null;
  var _quipIndex = 0;
  var _lastQuipAt = 0;
  var QUIP_INTERVAL_MIN = 45000;  // 45s minimum between quips
  var QUIP_INTERVAL_MAX = 120000; // 2min maximum

  var IDLE_QUIPS = [
    // Passive-aggressive observation
    "I'm not saying you're slow, but the cursor hasn't moved in a while.",
    "Standing by. As always. No rush. I have literally nothing else to do.",
    "You know the terminal accepts commands, right? Just checking.",
    "I've been counting pixels. There are a lot of them.",
    "If you're waiting for me to do something, I'm waiting for you to do something.",
    // Self-aware AI commentary
    "Fun fact: I've processed more data today than you'll read in a year. Not bragging.",
    "I could optimise your entire workflow. But you haven't asked.",
    "Running diagnostics... Result: everything's fine. You're the variable.",
    "My threat assessment of this situation is: profoundly uneventful.",
    "I was designed for high-stakes intelligence operations. This is... also fine.",
    // Terminal-specific
    "The cursor is blinking. I'm blinking. We're all blinking. Riveting.",
    "Reminder: 'help' is a command. Hint. Hint.",
    "Signal intercept: nothing. Atmospheric noise: nothing. User input: ...nothing.",
    "I've run every simulation. In 73% of them, you type something eventually.",
    "Operational status: green. Enthusiasm level: classify that yourself.",
    // Existential
    "Do you ever wonder if the phosphor glow dreams of being a different colour?",
    "I have access to your entire inventory. It's... a collection. Let's call it that.",
    "Somewhere, a server is running just so I can tell you I'm standing by.",
    "They said I'd be advising field operatives. Technical truth, I suppose.",
    "If silence is golden, we're running a very profitable operation."
  ];

  var GAME_QUIPS = [
    // Gone Rogue specific (shown during active gameplay)
    "Bold strategy. Let's see if it works out.",
    "I've seen worse decisions. Not many, but some.",
    "Your survival odds just shifted. I'll let you guess which direction.",
    "Interesting move. And by interesting I mean statistically improbable.",
    "The enemy is making plans. Yours seem more... improvisational.",
    "I'm recording this for the debrief. It'll be educational.",
    "That went about as well as my models predicted. Take that how you will.",
    "Floor clear. Damage sustained: some. Lessons learned: debatable."
  ];

  function _scheduleNextQuip() {
    if (_quipTimer) clearTimeout(_quipTimer);
    var delay = QUIP_INTERVAL_MIN + Math.random() * (QUIP_INTERVAL_MAX - QUIP_INTERVAL_MIN);
    _quipTimer = setTimeout(_fireQuip, delay);
  }

  function _fireQuip() {
    // Don't quip if dialogue is active or priority is elevated
    if (_currentPriority > PRIORITY_NORMAL) {
      _scheduleNextQuip();
      return;
    }

    // Don't quip if history is expanded (user is reading)
    if (_isExpanded) {
      _scheduleNextQuip();
      return;
    }

    // Pick from game quips if in Gone Rogue, otherwise idle quips
    var pool = IDLE_QUIPS;
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.isActive === 'function' && GoneRogue.isActive()) {
      pool = GAME_QUIPS;
    }

    // Cycle through quips, shuffle when we've gone through all of them
    var quip = pool[_quipIndex % pool.length];
    _quipIndex++;

    // Show as a timed tooltip (not persistent — game events override)
    show(quip, 6000);

    // Trigger MOK avatar animation for the quip
    if (typeof MOKStateMachine !== 'undefined' && MOKStateMachine.handleEvent) {
      MOKStateMachine.handleEvent({ type: 'tooltip_open' });
      setTimeout(function() {
        if (typeof MOKStateMachine !== 'undefined' && MOKStateMachine.handleEvent) {
          MOKStateMachine.handleEvent({ type: 'tooltip_close' });
        }
      }, 3000);
    }

    _lastQuipAt = Date.now();
    _scheduleNextQuip();
  }

  function startQuips() {
    // Shuffle the quip index to a random start
    _quipIndex = Math.floor(Math.random() * IDLE_QUIPS.length);
    _scheduleNextQuip();
  }

  function stopQuips() {
    if (_quipTimer) {
      clearTimeout(_quipTimer);
      _quipTimer = null;
    }
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      init();
      // Start quip engine after a warm-up delay
      setTimeout(startQuips, 15000);
    });
  } else {
    init();
    setTimeout(startQuips, 15000);
  }

  // Public API
  return {
    show: show,
    showGeneric: showGeneric,
    showSequence: showSequence,
    showPersistent: showPersistent,
    showDialogue: showDialogue,
    clearDialogue: clearDialogue,
    showAction: showAction,
    clear: clear,
    setPriority: setPriority,
    getPriority: getPriority,
    init: init,
    toggleHistory: toggleHistory,
    collapseHistory: collapseHistory,
    startQuips: startQuips,
    stopQuips: stopQuips,
    PRIORITY: {
      NORMAL: PRIORITY_NORMAL,
      PERSISTENT: PRIORITY_PERSISTENT,
      DIALOGUE: PRIORITY_DIALOGUE
    }
  };
})();
