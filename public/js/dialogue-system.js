/* ============================================================
   EYES ONLY - Dialogue System
   Morrowind-style branching NPC conversations rendered in
   the MOK interjection tooltip space.

   Data format — NPC.dialogueTree:
   {
     root: 'greeting',
     nodes: {
       greeting: {
         text: 'Hey stranger!',
         choices: [
           { label: 'Ask about rumor', next: 'rumor' },
           { label: 'Buy Drink -5¢', next: 'buy_drink', effect: { currency: -5 } },
           { label: 'Leave', next: null }
         ]
       },
       rumor: {
         text: 'Strange sounds from below...',
         choices: [
           { label: 'Tell me more', next: 'rumor_detail' },
           { label: 'Back', next: 'greeting' }
         ]
       }
     }
   }

   Flat backward compatibility — NPC.dialogues: ['line1', 'line2', ...]
   is auto-wrapped into a linear "Continue" tree.
   ============================================================ */

var DialogueSystem = (function() {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  var _activeNpc = null;          // NPC object currently in conversation
  var _activeTree = null;         // Resolved dialogue tree (native or auto-wrapped)
  var _currentNodeId = null;      // Current node key in _activeTree.nodes
  var _ctx = null;                // Game context reference
  var _onEndCallback = null;      // Optional callback when conversation ends
  var _visitedNodes = {};         // Track visited nodes for topic coloring
  var _conversationLog = [];      // Running log of this conversation

  // ── Priority constants (shared with TooltipSystem) ────────
  var PRIORITY = {
    NORMAL: 1,      // Timed game tooltips (combat, pickup, etc.)
    PERSISTENT: 2,  // showPersistent messages
    DIALOGUE: 3     // Active NPC dialogue — blocks lower priority
  };

  // ── Public API ─────────────────────────────────────────────

  /**
   * Start a conversation with an NPC.
   * @param {Object} npc - NPC object with dialogueTree or dialogues
   * @param {Object} ctx - Game context (player, currencies, etc.)
   * @param {Object} [opts] - { onEnd: Function, startNode: string }
   */
  function startConversation(npc, ctx, opts) {
    if (!npc) return false;
    opts = opts || {};

    // Already talking to this NPC? Re-enter at root
    if (_activeNpc && _activeNpc.id === npc.id) {
      _navigateTo(_activeTree.root);
      return true;
    }

    // End any existing conversation first
    if (_activeNpc) {
      endConversation(true); // silent end
    }

    _activeNpc = npc;
    _ctx = ctx;
    _onEndCallback = opts.onEnd || null;
    _visitedNodes = {};
    _conversationLog = [];

    // Resolve dialogue tree
    _activeTree = _resolveTree(npc);
    if (!_activeTree || !_activeTree.nodes || !_activeTree.root) {
      _activeNpc = null;
      return false;
    }

    // Lock tooltip to dialogue priority
    if (typeof TooltipSystem !== 'undefined' && TooltipSystem.setPriority) {
      TooltipSystem.setPriority(PRIORITY.DIALOGUE);
    }

    // Show NPC greeting emoji overhead
    if (typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.showGenericExpression(npc.x, npc.y, '💬', 1200, '#1cff9b');
    }

    // Navigate to start node
    var startNode = opts.startNode || _activeTree.root;
    _navigateTo(startNode);

    return true;
  }

  /**
   * End the current conversation.
   * @param {boolean} [silent] - If true, skip the "farewell" tooltip
   */
  function endConversation(silent) {
    if (!_activeNpc) return;

    var npc = _activeNpc;

    // Clean up state
    _activeNpc = null;
    _activeTree = null;
    _currentNodeId = null;
    _ctx = null;
    _visitedNodes = {};

    // Release tooltip — clearDialogue resets innerHTML, priority, and click handlers
    if (typeof TooltipSystem !== 'undefined') {
      if (TooltipSystem.clearDialogue) {
        TooltipSystem.clearDialogue();
      }
      if (!silent) {
        TooltipSystem.show(npc.emoji + ' ' + npc.name + ' nods.', 1800);
      }
    }

    // Fire end callback
    if (_onEndCallback) {
      var cb = _onEndCallback;
      _onEndCallback = null;
      cb(npc);
    }
  }

  /**
   * Handle a choice selection (called by TooltipSystem click handler).
   * @param {number} choiceIndex - Index into current node's choices array
   */
  function selectChoice(choiceIndex) {
    if (!_activeNpc || !_activeTree || !_currentNodeId) return;

    var node = _activeTree.nodes[_currentNodeId];
    if (!node || !node.choices || choiceIndex >= node.choices.length) return;

    var choice = node.choices[choiceIndex];

    // Apply effects
    if (choice.effect) {
      _applyEffect(choice.effect);
    }

    // Log the player's choice
    _conversationLog.push({ type: 'choice', text: choice.label });

    // Navigate to next node or end conversation
    if (choice.next === null || choice.next === undefined) {
      endConversation(false);
    } else if (_activeTree.nodes[choice.next]) {
      _navigateTo(choice.next);
    } else {
      // Invalid next node — end gracefully
      console.warn('DialogueSystem: node "' + choice.next + '" not found');
      endConversation(false);
    }
  }

  /**
   * Check if a conversation is currently active.
   */
  function isActive() {
    return _activeNpc !== null;
  }

  /**
   * Get the NPC currently in conversation.
   */
  function getActiveNpc() {
    return _activeNpc;
  }

  /**
   * Force-end conversation (e.g. player walked away, combat started).
   */
  function interrupt() {
    if (!_activeNpc) return;
    endConversation(true);
  }

  // ── Internal ───────────────────────────────────────────────

  /**
   * Resolve an NPC's dialogue data into a normalized tree.
   * Handles both dialogueTree and flat dialogues[] formats.
   */
  function _resolveTree(npc) {
    // Native tree format
    if (npc.dialogueTree && npc.dialogueTree.nodes && npc.dialogueTree.root) {
      return npc.dialogueTree;
    }

    // Auto-wrap flat dialogues[] into linear tree
    if (npc.dialogues && npc.dialogues.length > 0) {
      return _wrapFlatDialogues(npc);
    }

    // No dialogue data — generate a minimal fallback
    return {
      root: 'default',
      nodes: {
        'default': {
          text: npc.emoji + ' ' + (npc.name || 'NPC') + ' has nothing to say.',
          choices: [
            { label: 'Leave', next: null }
          ]
        }
      }
    };
  }

  /**
   * Convert flat dialogues[] into a linear Continue→Continue→Leave tree.
   * Each dialogue line becomes a node. Last node has [Leave].
   */
  function _wrapFlatDialogues(npc) {
    var nodes = {};
    var dialogues = npc.dialogues;

    for (var i = 0; i < dialogues.length; i++) {
      var nodeId = 'line_' + i;
      var isLast = (i === dialogues.length - 1);

      nodes[nodeId] = {
        text: dialogues[i],
        choices: isLast
          ? [{ label: 'Farewell', next: null }]
          : [
              { label: 'Continue', next: 'line_' + (i + 1) },
              { label: 'Farewell', next: null }
            ]
      };
    }

    return {
      root: 'line_0',
      nodes: nodes
    };
  }

  /**
   * Navigate to a node and render it in the tooltip.
   */
  function _navigateTo(nodeId) {
    if (!_activeTree || !_activeTree.nodes[nodeId]) return;

    _currentNodeId = nodeId;
    _visitedNodes[nodeId] = true;

    var node = _activeTree.nodes[nodeId];

    // Log NPC speech
    _conversationLog.push({
      type: 'speech',
      speaker: _activeNpc.name || 'NPC',
      emoji: _activeNpc.emoji || '',
      text: node.text
    });

    // Render in tooltip
    if (typeof TooltipSystem !== 'undefined' && TooltipSystem.showDialogue) {
      TooltipSystem.showDialogue(
        _activeNpc.emoji + ' ' + (_activeNpc.name || 'NPC'),
        node.text,
        node.choices || [],
        _visitedNodes
      );
    }

    // Show speech bubble overhead
    if (typeof OverheadAnimator !== 'undefined') {
      OverheadAnimator.showGenericExpression(
        _activeNpc.x, _activeNpc.y, '💬', 800, '#aaaaaa'
      );
    }
  }

  /**
   * Apply a choice effect to the game state.
   */
  function _applyEffect(effect) {
    if (!effect || !_ctx) return;

    // Currency change
    if (typeof effect.currency === 'number' && effect.currency !== 0) {
      if (typeof _ctx.addCurrency === 'function') {
        _ctx.addCurrency(effect.currency);
      }
      var label = effect.currency > 0
        ? '+' + effect.currency + '¢'
        : effect.currency + '¢';
      if (typeof TooltipSystem !== 'undefined') {
        // Brief flash before next dialogue node renders
        TooltipSystem.show('💰 ' + label, 800);
      }
    }

    // Quest flag
    if (effect.setFlag && _ctx.player) {
      if (!_ctx.player.flags) _ctx.player.flags = {};
      _ctx.player.flags[effect.setFlag] = true;
    }

    // Open shop
    if (effect.openShop && typeof ShopSystem !== 'undefined') {
      var shopType = effect.shopType || ShopSystem.SHOP_TYPES.STANDARD;
      ShopSystem.openShop(shopType, _ctx.getFloor ? _ctx.getFloor() : 0);
    }

    // Give item
    if (effect.giveItem && _ctx.player) {
      if (!_ctx.player.inventory) _ctx.player.inventory = [];
      _ctx.player.inventory.push(effect.giveItem);
      if (typeof TooltipSystem !== 'undefined') {
        TooltipSystem.show('📦 Received ' + (effect.giveItem.name || 'item'), 1200);
      }
    }

    // Heal
    if (typeof effect.heal === 'number' && _ctx.player) {
      _ctx.player.hp = Math.min(
        (_ctx.player.hp || 0) + effect.heal,
        _ctx.player.maxHp || 20
      );
    }

    // Custom callback
    if (typeof effect.callback === 'function') {
      effect.callback(_ctx, _activeNpc);
    }
  }

  // ── Priority constant export for TooltipSystem ─────────────
  // (So both modules share the same enum)

  return {
    startConversation: startConversation,
    endConversation: endConversation,
    selectChoice: selectChoice,
    isActive: isActive,
    getActiveNpc: getActiveNpc,
    interrupt: interrupt,
    PRIORITY: PRIORITY
  };
})();
