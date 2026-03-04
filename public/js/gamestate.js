/* ============================================================
   EYES ONLY - Global Game State Controller
   Manages transitions between Street Chronicles and Gone Rogue
   ============================================================ */

const GAMESTATE = (function () {
  'use strict';

  var STORAGE_KEY = 'eyesonly_gamestate';

  var MODES = {
    STREET: 'street',
    ROGUE: 'rogue'
  };

  var _state = {
    mode: MODES.STREET,
    submode: null,
    inventoryPersistent: [],      // 9-12 slots (safe across death) - ItemRef[]
    persistentCards: [],           // Persistent card stash (safe across death) - CardRef[]
    inventoryLoose: [],            // 8 slots (lost on death) - LEGACY, being phased out for card system
    actionButtonCards: [],         // 4 slots - cards available to draw from (reserve/deck)
    cardHand: [],                  // Cards in play hand (drawn for immediate use)
    persistentSlots: 9,            // Start at 9, expand to 12
    maxPersistentSlots: 12,
    looseSlots: 8,                 // LEGACY - for non-card items
    actionButtonSlots: 4,          // Fixed at 4 for Gone Rogue mode (reserve)
    maxHandSize: 5,                // Maximum cards in play hand
    maxBackupSlots: 25,            // Maximum backup deck size (configurable, default 25)
    cardDrawPerTurn: 1,            // Base card draw per STR combat turn (can be modified by items)
    cryptos: 0,                    // Currency (¢) - persistent across death
    rogueRun: null,
    activeItemSlot: null,          // Active item slot (for lighting items, etc.)

    // Resource tracking (for STR combat and card system)
    playerFatigue: 0,              // 0-100 scale (0 = no fatigue, 100 = exhausted)
    maxFatigue: 100,
    fatigueRecovery: 5,            // Per turn baseline recovery
    fatigueThreshold: 70,          // Above this, cards cost more/become less effective
    _playerFatigueDecimal: 0.0,    // Hidden decimal fatigue (for smooth sprint drain)
    _sprintBlockedUntil: 0,        // Timestamp when sprint block expires (food pickup delay)

    playerAmmo: 7,                 // Pooled ammunition resource (reduced for balanced economy)
    maxAmmo: 50,                   // Maximum ammo capacity

    // Additional resources (planned for full card system integration)
    playerEnergy: 5,               // 0-5 scale (powers special abilities)
    maxEnergy: 5,
    playerFocus: 10,               // 0-10 scale (improves accuracy)
    maxFocus: 10,
    playerBattery: 5,              // 0-5 scale (powers equipment)
    maxBattery: 5,
    playerStability: 10,           // 0-10 scale (prevents panic)
    maxStability: 10,

    // Consumables inventory (separate from card inventory)
    consumables: [],               // Array of consumable items with counts: {type, count}
    consumableSlots: 3,            // How many different types can be carried
    maxConsumableSlots: 5,         // Can be upgraded

    // Card hand and backup deck (lost on death per spec)
    cardsInHand: [],               // Cards in play hand (drawn for immediate use)
    backupCards: [],               // Backup deck (configurable size, default empty)
    burnPile: [],                  // Cards consumed/destroyed this combat (reset between combats)

    // CHH Step 1: Dynamic card instance store (CI-* keyed map)
    // Persisted in save state. Rolled/procedural cards get a first-class CI-* ID
    // and are stored here so hydrateCard() can resolve them from any container.
    cardInstances: {},             // { "CI-<ts>-<rand>": { instanceId, baseId, name, ... } }

    // Structured key counters — single source of truth for UI hooks
    // Tier 1 (ammo): lost on death.  Tier 2/3: persist across death.
    keys: {
      ammo:  {},   // Tier 1: { KEY_002: n, KEY_004: n, ... }
      gate:  {},   // Tier 2: { KEYCARD: n, MALL_KEY: n, ... }
      quest: {}    // Tier 3: { BLACKSMITH_HAMMER: n, RUNE_FRAGMENT: n, ... }
    }
  };

  function init() {
    _loadState();
    _migrateInventoryToRefs();
    _migrateCardHandToRefs();   // CHH Step 3: one-time migration
    _ensureDefaultPersistentInventory();

    // Ensure cardInstances map exists (CHH Step 1)
    if (!_state.cardInstances || typeof _state.cardInstances !== 'object') {
      _state.cardInstances = {};
    }

    // Initialize UI currency display
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(_state.cryptos || 0);
    }
  }

  // ── CHH Step 3: One-time cardHand → cardsInHand migration ──
  /**
   * Migrates legacy _state.cardHand (array of full card objects) to
   * _state.cardsInHand (array of CardRefs) with CI-* instances in cardInstances.
   *
   * For each card in cardHand:
   *   - If it has a registry-resolvable ID (ACT-*, EATK-*) → create a ref to that ID
   *   - Otherwise → register as CI-* instance → create a ref to the CI-* ID
   *
   * After migration, cardHand is cleared. This function is idempotent:
   * it no-ops if cardHand is empty or doesn't exist.
   */
  function _migrateCardHandToRefs() {
    if (!Array.isArray(_state.cardHand) || _state.cardHand.length === 0) return;
    if (!_state.cardInstances) _state.cardInstances = {};
    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];

    var migrated = 0;

    for (var i = 0; i < _state.cardHand.length; i++) {
      var card = _state.cardHand[i];
      if (!card) continue;

      var refId = null;

      // Check if this card has a registry-resolvable ID
      if (card.id && (card.id.indexOf('ACT-') === 0 || card.id.indexOf('EATK-') === 0 || card.id.indexOf('ITM-') === 0)) {
        refId = card.id;
      } else if (card.id && card.id.indexOf('CI-') === 0) {
        // Already a CI-* ID — ensure the instance is registered
        if (!_state.cardInstances[card.id]) {
          _state.cardInstances[card.id] = card;
          card.instanceId = card.id;
        }
        refId = card.id;
      } else {
        // Legacy anonymous card (card_<ts>_<rand>, charm_<ts>_<rand>, etc.)
        // Register as a new CI-* instance
        var ts = Date.now() + i; // offset to avoid collisions
        var rand = Math.random().toString(36).substr(2, 5);
        var ciId = 'CI-' + ts + '-' + rand;

        var instance = {
          instanceId: ciId,
          baseId: card.base || null,
          name: card.name || 'Unknown Card',
          emoji: card.emoji || '🃏',
          type: card.type || 'unknown',
          category: card.category || card.type || 'unknown',
          quality: card.quality || 'STANDARD',
          qualityName: card.qualityName || 'Standard',
          qualityColor: card.qualityColor || '#ffffff',
          stats: card.stats || {},
          affixes: card.affixes || [],
          tags: card.tags || [],
          createdAt: card.createdAt || Date.now(),
          seed: card.seed || 0,
          provenance: { source: 'cardHand_migration', migratedFrom: card.id || 'anonymous' }
        };

        _state.cardInstances[ciId] = instance;
        refId = ciId;
      }

      if (refId) {
        // Always insert as individual slot — no stacking, even during migration.
        _state.cardsInHand.push({ id: refId, qty: 1, meta: { t: Date.now() } });
        migrated++;
      }
    }

    // Clear legacy cardHand
    _state.cardHand = [];

    if (migrated > 0) {
      console.debug('[GAMESTATE] CHH migration: moved ' + migrated + ' cards from cardHand to cardsInHand + cardInstances');
      _saveState();
    }
  }

  /**
   * Ensure player has default persistent inventory items on first run
   */
  function _ensureDefaultPersistentInventory() {
    // New-player bootstrap: start with EMPTY persistent inventory.
    // Items view should be primed for discovery (empty slots), not pre-filled placeholders.
    if (!Array.isArray(_state.inventoryPersistent)) _state.inventoryPersistent = [];

    // Seed a minimal starter hand ONCE for new players.
    // Cards go into cardsInHand (equipped hand) so player is ready for
    // their first STR-combat encounter without needing to manage inventory.
    // The vault (persistentCards) stays empty — primed for item discovery.
    if (!Array.isArray(_state.persistentCards)) _state.persistentCards = [];
    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];

    if (!_state._starterCardsSeededV2) {
      // Only seed if both hand and vault are empty (true new player)
      var hasCards = (_state.cardsInHand.length > 0) || (_state.persistentCards.length > 0);
      if (!hasCards) {
        _state.cardsInHand = [
          { id: 'ACT-002', qty: 1, meta: { t: Date.now() } }, // Basic Shot (ammo spender)
          { id: 'ACT-999', qty: 1, meta: { t: Date.now() } }, // Cardboard Box (disposable/utility)
          { id: 'ACT-001', qty: 1, meta: { t: Date.now() } }  // Field Dressing (resource manager)
        ];
        _state._starterCardsSeededV2 = true;
        // Also mark old migration flags so we don't grant extra Basic Shot stacks.
        _state._starterCardsSeeded = true;
        _state._grantAct002Done = true;
        _saveState();

        // Fire event so UI layers pick up the new hand immediately
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'starter_seed' } }));
          }
        } catch (e0) {}
      }
    }

    // Migration V3: move starter cards from vault → hand for players who got
    // them seeded into persistentCards by the old V2 logic.
    // Only runs once, only if hand is empty and vault has the standard-issue cards.
    if (_state._starterCardsSeededV2 && !_state._starterCardsMovedToHandV3 &&
        _state.cardsInHand.length === 0 && Array.isArray(_state.persistentCards)) {
      var starterIds = ['ACT-002', 'ACT-999', 'ACT-001'];
      var allInVault = starterIds.every(function(sid) {
        return _state.persistentCards.some(function(r) { return r && r.id === sid; });
      });
      if (allInVault) {
        // Move starters from vault to hand
        for (var si = 0; si < starterIds.length; si++) {
          for (var vi = 0; vi < _state.persistentCards.length; vi++) {
            if (_state.persistentCards[vi] && _state.persistentCards[vi].id === starterIds[si]) {
              var moved = _state.persistentCards.splice(vi, 1)[0];
              _state.cardsInHand.push({ id: moved.id, qty: 1, meta: { t: Date.now() } });
              break;
            }
          }
        }
        _state._starterCardsMovedToHandV3 = true;
        _saveState();
      }
    }

    // Migration grant (legacy): ensure ACT-002 exists for older saves (once)
    // Do NOT run for V2 starter pack.
    if (!_state._starterCardsSeededV2 && !_state._grantAct002Done) {
      if (!Array.isArray(_state.persistentCards)) _state.persistentCards = [];
      var has002 = _state.persistentCards.some(function(r) { return r && r.id === 'ACT-002'; });
      if (!has002) {
        // Insert as 5 individual slots — no stacking
        for (var s002 = 0; s002 < 5; s002++) {
          _state.persistentCards.push({ id: 'ACT-002', qty: 1, meta: null });
        }
        _saveState();
      }
      _state._grantAct002Done = true;
      _saveState();
    }
  }

  function getMode() {
    return _state.mode;
  }

  function getState() {
    return Object.assign({}, _state);
  }

  /**
   * Enter Gone Rogue mode from Street Chronicles
   * @param {Object} context - {reason, seed, difficulty, carryInventory}
   */
  function enterRogueMode(context) {
    context = context || {};

    _state.mode = MODES.ROGUE;
    _state.rogueRun = {
      reason: context.reason || 'story_event',
      seed: context.seed || Date.now(),
      difficulty: context.difficulty || 1,
      startTime: Date.now(),
      turnsElapsed: 0,
      floor: 1,
      combatsCompleted: 0,        // Track combats for cooldown system
      enemiesKilled: 0,
      cardsFound: 0
    };

    // Transfer street inventory to loose carry if specified
    if (context.carryInventory && typeof StreetChronicles !== 'undefined') {
      var streetInv = StreetChronicles.getInventory() || [];
      // Convert card name strings to actual card objects
      var convertedInv = [];
      for (var i = 0; i < streetInv.length && i < _state.looseSlots; i++) {
        var itemStr = streetInv[i];
        var convertedItem = _convertStreetItemToCard(itemStr);
        if (convertedItem) {
          convertedInv.push(convertedItem);
        }
      }
      _state.inventoryLoose = convertedInv;
    }

    _saveState();

    return {
      lines: [
        '',
        '--- CONNECTION UNSTABLE ---',
        '--- ROUTING TO INTERNAL PROCESS ---',
        '',
        'SIGNAL DEGRADATION DETECTED',
        'MEMORY FRAGMENTATION IN PROGRESS',
        'ENTERING GONE ROGUE SUBSYSTEM',
        '',
        'OBJECTIVE: SURVIVE AND EXTRACT',
        'PERSISTENT INVENTORY: ' + _state.persistentSlots + ' SLOTS SAFE',
        'LOOSE CARRY: ' + _state.looseSlots + ' SLOTS (LOST ON DEATH)',
        ''
      ]
    };
  }

  /**
   * Exit Gone Rogue mode back to Street Chronicles
   * @param {Object} result - {success, extractedItem, xp, unlockedSlot}
   */
  function exitRogueMode(result) {
    result = result || {};

    var previousMode = _state.mode;
    _state.mode = MODES.STREET;

    var lines = [''];

    if (result.success) {
      lines.push('=== EXTRACTION SUCCESSFUL ===');
      lines.push('');
      lines.push('You wake at the terminal.');
      lines.push('Memory reconstruction complete.');

      if (result.unlockedSlot && _state.persistentSlots < _state.maxPersistentSlots) {
        _state.persistentSlots++;
        lines.push('');
        lines.push('ARCHIVE EXPANSION AUTHORIZED');
        lines.push('Persistent capacity increased to ' + _state.persistentSlots + ' slots.');
      }

      if (result.extractedItem) {
        lines.push('');
        lines.push('Recovered: ' + result.extractedItem);
      }
    } else {
      lines.push('=== SIGNAL LOST ===');
      lines.push('');
      lines.push('You wake at the terminal.');
      lines.push('Memory fragmentation detected.');
      lines.push('Recovered: ' + _state.persistentSlots + ' archived tactics.');
      lines.push('');
      lines.push('Loose inventory lost.');

      // 50% currency penalty on death
      var currencyBefore = _state.cryptos || 0;
      var currencyLost = Math.floor(currencyBefore * 0.5);
      if (currencyLost > 0) {
        _state.cryptos = currencyBefore - currencyLost;
        lines.push('Currency penalty: -¢' + currencyLost + ' (50%)');
        lines.push('Remaining: ¢' + _state.cryptos);
      }

      // Clear hand, backup cards, equipped active item (lost on death per spec)
      _state.cardHand = [];
      _state.backupCards = [];
      _state.activeItemSlot = null;

      // Clear loose inventory on death (includes tier-1 ammo keys)
      _state.inventoryLoose = [];

      // Store currency lost for death screen display
      result.currencyLost = currencyLost;
    }

    lines.push('');
    lines.push('Returning to Street Chronicles...');
    lines.push('');

    // Clear rogue run data
    _state.rogueRun = null;
    _saveState();

    return {
      lines: lines,
      mode: MODES.STREET
    };
  }

  /**
   * Add item to persistent inventory (if space available)
   */
  function addToPersistent(item) {
    if (_state.inventoryPersistent.length >= _state.persistentSlots) {
      return {
        success: false,
        message: 'PERSISTENT INVENTORY FULL (' + _state.inventoryPersistent.length + '/' + _state.persistentSlots + ')'
      };
    }

    // Normalize to { id, qty, meta } ref format so inventory renderers can
    // resolve via GoneRogueDataRegistry.getItem(ref.id).
    var ref = _normalizeItemRef(item);
    var finalRef = ref || item;
    // Always qty: 1 — no stacking
    if (finalRef && typeof finalRef.qty === 'number' && finalRef.qty !== 1) finalRef.qty = 1;
    _state.inventoryPersistent.push(finalRef);
    _saveState();

    return {
      success: true,
      message: 'Item added to persistent inventory: ' + (item.name || (ref && ref.id) || 'Item')
    };
  }

  /**
   * Add item to loose carry (if space available)
   */
  function addToLoose(item) {
    if (_state.inventoryLoose.length >= _state.looseSlots) {
      return {
        success: false,
        message: 'LOOSE CARRY FULL (' + _state.inventoryLoose.length + '/' + _state.looseSlots + ')'
      };
    }

    _state.inventoryLoose.push(item);
    _saveState();

    return {
      success: true,
      message: 'Item added to loose carry: ' + item.name
    };
  }

  /**
   * Remove item from persistent inventory
   */
  function removeFromPersistent(index) {
    if (index < 0 || index >= _state.inventoryPersistent.length) {
      return { success: false };
    }

    var removed = _state.inventoryPersistent.splice(index, 1)[0];
    _saveState();

    return {
      success: true,
      item: removed
    };
  }

  /**
   * Remove item from loose carry
   */
  function removeFromLoose(index) {
    if (index < 0 || index >= _state.inventoryLoose.length) {
      return { success: false };
    }

    var removed = _state.inventoryLoose.splice(index, 1)[0];
    _saveState();

    return {
      success: true,
      item: removed
    };
  }

  /**
   * Clear loose inventory (on death)
   */
  function clearLooseInventory() {
    _state.inventoryLoose = [];
    // Tier 1 ammo keys live in loose inventory — zero them on death
    _ensureKeysObj();
    _state.keys.ammo = {};
    _saveState();
  }

  /**
   * Get persistent inventory
   */
  function getPersistentInventory() {
    return _state.inventoryPersistent.slice(); // Return copy of refs
  }

  /**
   * Remove item from persistent inventory by index
   * @param {number} index - Index of item to remove
   */
  function removePersistentInventoryItem(index) {
    if (index >= 0 && index < _state.inventoryPersistent.length) {
      _state.inventoryPersistent.splice(index, 1);
      _saveState();
      console.log('[GAMESTATE] Removed persistent inventory item at index', index);
    } else {
      console.warn('[GAMESTATE] Invalid inventory index:', index);
    }
  }

  /**
   * Get persistent card stash (CardRef[])
   */
  function getPersistentCards() {
    return (_state.persistentCards || []).slice();
  }

  function _normalizeCardRef(refOrId) {
    if (!refOrId) return null;
    if (typeof refOrId === 'string') return { id: refOrId, qty: 1, meta: null };
    if (refOrId.id) {
      return {
        id: refOrId.id,
        qty: (typeof refOrId.qty === 'number' ? refOrId.qty : 1),
        meta: refOrId.meta || null
      };
    }
    return null;
  }

  function addPersistentCard(cardRefOrId, qty) {
    qty = (typeof qty === 'number' ? qty : 1);
    qty = Math.max(1, qty);

    var ref = _normalizeCardRef(cardRefOrId);
    if (!ref) return { success: false };

    // Guard: only ACT- ids belong in persistentCards. If an item id is passed,
    // route it into persistent inventory instead of creating ITM entries in the card stash.
    if (ref.id && ref.id.indexOf('ITM-') === 0) {
      if (!Array.isArray(_state.inventoryPersistent)) _state.inventoryPersistent = [];
      // Always insert as individual slots — no stacking
      for (var itmN = 0; itmN < qty; itmN++) {
        _state.inventoryPersistent.push({ id: ref.id, qty: 1, meta: ref.meta || null });
      }
      _saveState();
      return { success: true, routed: 'inventoryPersistent' };
    }

    if (ref.id && ref.id.indexOf('ACT-') !== 0 && ref.id.indexOf('CI-') !== 0 && ref.id.indexOf('EATK-') !== 0) {
      // Unknown type, reject (keeps stash clean)
      return { success: false, reason: 'invalid_card_id' };
    }

    if (!_state.persistentCards) _state.persistentCards = [];

    // Always insert as individual slots — no stacking, even for same card type.
    for (var n = 0; n < qty; n++) {
      _state.persistentCards.push({ id: ref.id, qty: 1, meta: ref.meta || null });
    }

    _saveState();
    return { success: true };
  }

  function removePersistentCard(cardId, qty) {
    qty = (typeof qty === 'number' ? qty : 1);
    qty = Math.max(1, qty);

    if (!_state.persistentCards) _state.persistentCards = [];

    for (var i = 0; i < _state.persistentCards.length; i++) {
      var ref = _state.persistentCards[i];
      if (!ref || ref.id !== cardId) continue;

      ref.qty = (ref.qty || 0) - qty;
      if (ref.qty <= 0) {
        _state.persistentCards.splice(i, 1);
      }
      _saveState();
      return { success: true };
    }

    return { success: false };
  }

  // ============================================================
  // CANONICAL HAND SYSTEM (CH/NCH)
  // ============================================================

  function getCardsInHand() {
    return Array.isArray(_state.cardsInHand) ? _state.cardsInHand.slice() : [];
  }

  function getBackupCards() {
    var b = Array.isArray(_state.backupCards) ? _state.backupCards.slice() : [];
    return b.slice(0, _state.maxBackupSlots || 25);
  }

  // Add printed cards into CH/NCH hand first, then overflow into backup.
  // Backup is treated as an ordered "newest at top" list with configurable max size.
  // Overflow discards the oldest cards.
  function addPrintedCards(cardId, qty, opts) {
    opts = opts || {};
    qty = (typeof qty === 'number' ? qty : 1);
    qty = Math.max(1, Math.floor(qty));
    if (!cardId) return { success: false };

    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];
    if (!Array.isArray(_state.backupCards)) _state.backupCards = [];

    var maxHand = (typeof _state.maxHandSize === 'number' && isFinite(_state.maxHandSize)) ? _state.maxHandSize : 5;
    maxHand = Math.max(1, maxHand);

    var MAX_TOTAL_PRINTED_CARDS = 25;
    var res = { success: true, toHand: 0, toBackup: 0, discarded: 0 };

    function _touchMeta(ref) {
      if (!ref) return;
      if (!ref.meta) ref.meta = {};
      ref.meta.t = Date.now();
    }

    function _totalQty() {
      var t = 0;
      for (var hi = 0; hi < _state.cardsInHand.length; hi++) {
        if (_state.cardsInHand[hi]) t += (_state.cardsInHand[hi].qty || 1);
      }
      for (var bi = 0; bi < _state.backupCards.length; bi++) {
        var bs = _state.backupCards[bi];
        if (bs && bs.id) t += (bs.qty || 1);
      }
      return t;
    }

    function _dropOldest() {
      // Drop one from the oldest backup card (last in array).
      if (_state.backupCards.length > 0) {
        var lastIdx = _state.backupCards.length - 1;
        var b = _state.backupCards[lastIdx];
        if (b && b.id) {
          b.qty = (b.qty || 1) - 1;
          if (b.qty <= 0) _state.backupCards.splice(lastIdx, 1);
          res.discarded += 1;
          return;
        }
      }
      // Fallback: drop one from the last hand entry (oldest by insertion order).
      if (_state.cardsInHand.length > 0) {
        var last = _state.cardsInHand[_state.cardsInHand.length - 1];
        if (last) {
          last.qty = (last.qty || 1) - 1;
          if (last.qty <= 0) _state.cardsInHand.splice(_state.cardsInHand.length - 1, 1);
          res.discarded += 1;
        }
      }
    }

    function _promoteOrInsertBackup(ref) {
      // Always insert as individual slot at top — no stacking anywhere.
      _state.backupCards.unshift({ id: ref.id, qty: 1, meta: ref.meta || { t: Date.now() } });

      // Enforce max size — discard oldest if over cap
      var maxB = _state.maxBackupSlots || 25;
      while (_state.backupCards.length > maxB) {
        var dropped = _state.backupCards.pop();
        if (dropped && dropped.id) res.discarded += 1;
      }
    }

    function _addOne() {
      // prefer hand if there is space
      if ((_state.cardsInHand.length < maxHand) && opts.preferHand !== false) {
        // Always insert as individual slot — no stacking anywhere.
        var ref = { id: cardId, qty: 1, meta: { t: Date.now() } };
        _state.cardsInHand.unshift(ref);
        res.toHand += 1;
        return;
      }

      // overflow to backup — individual slot, no stacking
      var bref = { id: cardId, qty: 1, meta: { t: Date.now() } };
      _promoteOrInsertBackup(bref);
      res.toBackup += 1;
    }

    for (var n = 0; n < qty; n++) _addOne();

    // Enforce total card cap in a single cleanup pass after all cards are added.
    while (_totalQty() > MAX_TOTAL_PRINTED_CARDS) {
      _dropOldest();
    }

    _saveState();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'printed', cardId: cardId, qty: qty, toHand: res.toHand, toBackup: res.toBackup, discarded: res.discarded } }));
      }
    } catch (e2) {}

    return res;
  }

  function addCardToHand(cardId, qty) {
    qty = (typeof qty === 'number' ? qty : 1);
    qty = Math.max(1, qty);

    // Consume from stash
    var removed = removePersistentCard(cardId, qty);
    if (!removed || !removed.success) return { success: false, reason: 'not_in_stash' };

    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];

    // Always insert as individual slots — no stacking on incoming cards.
    for (var q = 0; q < qty; q++) {
      _state.cardsInHand.push({ id: cardId, qty: 1, meta: { t: Date.now() } });
    }

    // Enforce hand overflow at GAMESTATE level
    enforceHandOverflow();

    _saveState();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'add', cardId: cardId, qty: qty } }));
      }
    } catch (e2) {}

    return { success: true };
  }

  /**
   * Insert a card at position 0 of the hand (top / front).
   * Does NOT consume from stash — caller is responsible for removing from source.
   * Does NOT enforce hand overflow — caller handles cascade if needed.
   * @param {string} cardId
   * @param {number} qty
   * @returns {{ success: boolean }}
   */
  function insertCardToHandTop(cardId, qty) {
    qty = (typeof qty === 'number' ? qty : 1);
    qty = Math.max(1, qty);

    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];

    // Always insert as individual slots at front — no stacking on incoming cards.
    for (var q = 0; q < qty; q++) {
      _state.cardsInHand.unshift({ id: cardId, qty: 1, meta: { t: Date.now() } });
    }

    _saveState();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'insert_top', cardId: cardId, qty: qty } }));
      }
    } catch (e2) {}

    return { success: true };
  }

  function consumeCardFromHand(cardId, qty) {
    qty = (typeof qty === 'number' ? qty : 1);
    qty = Math.max(1, qty);

    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];

    for (var i = 0; i < _state.cardsInHand.length; i++) {
      var ref = _state.cardsInHand[i];
      if (!ref || ref.id !== cardId) continue;

      var take = Math.min(qty, ref.qty || 1);
      ref.qty = (ref.qty || 1) - take;
      if (ref.qty <= 0) _state.cardsInHand.splice(i, 1);

      // Track in burn pile (consumed cards this combat)
      if (!Array.isArray(_state.burnPile)) _state.burnPile = [];
      for (var bp = 0; bp < take; bp++) {
        _state.burnPile.push({ id: cardId, timestamp: Date.now() });
      }

      _saveState();
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'consume', cardId: cardId, qty: take } }));
          window.dispatchEvent(new CustomEvent('rogue-burn-pile-changed', { detail: { cardId: cardId, burnPileSize: _state.burnPile.length } }));
        }
      } catch (e2) {}

      return { success: true, qty: take };
    }

    return { success: false, reason: 'not_in_hand' };
  }

  function returnCardFromHandToStash(cardId, qty) {
    qty = (typeof qty === 'number' ? qty : 1);
    qty = Math.max(1, qty);

    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];

    for (var i = 0; i < _state.cardsInHand.length; i++) {
      var ref = _state.cardsInHand[i];
      if (!ref || ref.id !== cardId) continue;

      var take = Math.min(qty, ref.qty || 1);
      ref.qty = (ref.qty || 1) - take;
      if (ref.qty <= 0) _state.cardsInHand.splice(i, 1);

      addPersistentCard(cardId, take);
      _saveState();
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'return', cardId: cardId, qty: take } }));
        }
      } catch (e2) {}

      return { success: true, qty: take };
    }

    return { success: false, reason: 'not_in_hand' };
  }

  function moveHandIndexToBackup(handIndex) {
    var idx = Number(handIndex);
    if (!isFinite(idx) || idx < 0) return { success: false };

    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];
    if (!Array.isArray(_state.backupCards)) _state.backupCards = [];

    if (idx >= _state.cardsInHand.length) return { success: false };

    var ref = _state.cardsInHand[idx];
    if (!ref || !ref.id) return { success: false };

    // Insert at top of backup deck (newest) — always qty: 1
    _state.backupCards.unshift({ id: ref.id, qty: 1, meta: ref.meta || null });
    // Enforce max size — incinerate oldest
    var maxB = _state.maxBackupSlots || 25;
    while (_state.backupCards.length > maxB) {
      var incinerated = _state.backupCards.pop();
      try { window.dispatchEvent(new CustomEvent('rogue-card-incinerated', { detail: { card: incinerated, source: 'backup_overflow' } })); } catch (ei) {}
    }

    _state.cardsInHand.splice(idx, 1);

    _saveState();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'to_backup', cardId: ref.id } }));
      }
    } catch (e2) {}

    return { success: true };
  }

  /**
   * Remove a card from hand by index (clean splice — does NOT add to burn pile).
   * Used for vault transfers where the card is preserved, not consumed.
   * @param {number} handIndex
   * @returns {{ success: boolean, card?: object }}
   */
  function removeCardFromHandByIndex(handIndex) {
    var idx = Number(handIndex);
    if (!isFinite(idx) || idx < 0) return { success: false };
    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];
    if (idx >= _state.cardsInHand.length) return { success: false };

    var ref = _state.cardsInHand[idx];
    if (!ref || !ref.id) return { success: false };

    _state.cardsInHand.splice(idx, 1);
    _saveState();

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rogue-hand-changed', {
          detail: { source: 'vault_transfer', cardId: ref.id }
        }));
      }
    } catch (e2) {}

    return { success: true, card: ref };
  }

  /**
   * Remove a card from backup deck by index (splice removal).
   * Does NOT move it anywhere — caller is responsible for destination.
   * @param {number} backupIndex
   * @returns {{ success: boolean, card?: object }}
   */
  function removeBackupCard(backupIndex) {
    var idx = Number(backupIndex);
    if (!isFinite(idx) || idx < 0) return { success: false };

    if (!Array.isArray(_state.backupCards)) _state.backupCards = [];
    if (idx >= _state.backupCards.length) return { success: false };

    var ref = _state.backupCards[idx];
    if (!ref) return { success: false };

    _state.backupCards.splice(idx, 1);
    _saveState();

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'backup_remove', cardId: ref.id, idx: idx } }));
      }
    } catch (e2) {}

    return { success: true, card: ref };
  }

  function moveBackupIndexToHand(backupIndex) {
    var idx = Number(backupIndex);
    if (!isFinite(idx) || idx < 0) return { success: false };

    if (!Array.isArray(_state.backupCards)) _state.backupCards = [];
    if (idx >= _state.backupCards.length) return { success: false };

    var ref = _state.backupCards[idx];
    if (!ref || !ref.id) return { success: false, reason: 'empty' };

    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];
    _state.cardsInHand.push({ id: ref.id, qty: 1, meta: ref.meta || null });
    _state.backupCards.splice(idx, 1);  // Remove by splice, not null

    // Enforce hand overflow at GAMESTATE level
    enforceHandOverflow();

    _saveState();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'from_backup', cardId: ref.id, idx: idx } }));
      }
    } catch (e2) {}

    return { success: true };
  }

  function moveStashCardToBackup(cardId) {
    if (!cardId) return { success: false };

    if (!Array.isArray(_state.backupCards)) _state.backupCards = [];

    // No duplicate guard — same-type cards are allowed as individual slots.

    // Check if backup is full
    var maxB = _state.maxBackupSlots || 25;
    if (_state.backupCards.length >= maxB) {
      return { success: false, reason: 'backup_full' };
    }

    // Consume 1 from stash
    var removed = removePersistentCard(cardId, 1);
    if (!removed || !removed.success) return { success: false, reason: 'not_in_stash' };

    // Insert at top of backup deck
    _state.backupCards.unshift({ id: cardId, qty: 1, meta: null });

    _saveState();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'stash_to_backup', cardId: cardId } }));
      }
    } catch (e2) {}

    return { success: true };
  }

  // ─── PER-TURN DRAW (was per-combat) ─────────────────────

  function resetTurnBackupDrawFlag() {
    _state.hasDrawnBackupThisTurn = false;
    _state.hasDrawnBackupThisCombat = false; // backward compat
    _saveState();
  }
  // Backward-compatible alias
  function resetCombatBackupDrawFlag() { return resetTurnBackupDrawFlag(); }

  function canDrawBackupThisTurn() {
    return !_state.hasDrawnBackupThisTurn && !_state.hasDrawnBackupThisCombat;
  }
  // Backward-compatible alias
  function canDrawBackupThisCombat() { return canDrawBackupThisTurn(); }

  function drawOneFromBackupPerTurn() {
    if (_state.hasDrawnBackupThisTurn || _state.hasDrawnBackupThisCombat) {
      return { success: false, reason: 'already_drawn_this_turn' };
    }

    if (!Array.isArray(_state.backupCards)) _state.backupCards = [];
    if (_state.backupCards.length === 0) return { success: false, reason: 'backup_empty' };

    var ref = _state.backupCards.splice(0, 1)[0];  // Draw from top (newest)

    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];
    _state.cardsInHand.push({ id: ref.id, qty: 1, meta: ref.meta || null });

    _state.hasDrawnBackupThisTurn = true;
    _state.hasDrawnBackupThisCombat = true; // backward compat
    _saveState();

    // Enforce hand overflow at GAMESTATE level
    enforceHandOverflow();

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'draw_backup', cardId: ref.id } }));
      }
    } catch (e2) {}

    return { success: true, cardId: ref.id };
  }
  // Backward-compatible alias
  function drawOneFromBackupOncePerCombat() { return drawOneFromBackupPerTurn(); }

  /**
   * Mark that the player has used their per-turn backup draw.
   * Used by left-column draw (reserve-slots) which calls moveBackupIndexToHand
   * directly instead of drawOneFromBackupPerTurn.
   */
  function markBackupDrawUsedThisTurn() {
    _state.hasDrawnBackupThisTurn = true;
    _state.hasDrawnBackupThisCombat = true;
    _saveState();
  }

  // ============================================================
  // CHH STEP 1: CARD INSTANCE MANAGEMENT (CI-* IDs)
  // ============================================================

  /**
   * Mint a CI-* instance ID for a dynamically rolled card and persist it.
   * The instance is stored in _state.cardInstances and survives save/load.
   * @param {Object} instance - Full card object (name, emoji, stats, affixes, etc.)
   *   Optional fields: baseId, provenance
   * @returns {string} The minted CI-* ID
   */
  function registerCardInstance(instance) {
    if (!instance) return null;
    if (!_state.cardInstances) _state.cardInstances = {};

    var ts = Date.now();
    var rand = Math.random().toString(36).substr(2, 5);
    var id = 'CI-' + ts + '-' + rand;

    instance.instanceId = id;
    instance.createdAt = instance.createdAt || ts;
    _state.cardInstances[id] = instance;

    _saveState();
    return id;
  }

  /**
   * Retrieve a CI-* card instance by ID.
   * O(1) lookup from the cardInstances map.
   * @param {string} id - CI-* instance ID
   * @returns {Object|null} The full card instance or null
   */
  function getCardInstance(id) {
    if (!id || !_state.cardInstances) return null;
    return _state.cardInstances[id] || null;
  }

  /**
   * Garbage-collect unreferenced CI-* instances.
   * Scans ALL player containers AND enemy decks for CI-* refs,
   * then deletes any cardInstances entries with zero references.
   * Called on floor transition and save.
   */
  function gcCardInstances() {
    if (!_state.cardInstances) return;

    var referenced = {};

    // Scan player containers for CI-* refs
    var containers = [
      _state.cardsInHand,
      _state.backupCards,
      _state.persistentCards,
      _state.burnPile
    ];
    for (var c = 0; c < containers.length; c++) {
      var arr = containers[c];
      if (!Array.isArray(arr)) continue;
      for (var i = 0; i < arr.length; i++) {
        var ref = arr[i];
        if (ref && ref.id && ref.id.indexOf('CI-') === 0) {
          referenced[ref.id] = true;
        }
      }
    }

    // Scan enemy decks for planted CI-* refs
    // enemies live on the current floor context — accessed via GoneRogue if available
    var enemies = [];
    try {
      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.getEnemies === 'function') {
        enemies = GoneRogue.getEnemies() || [];
      }
    } catch (e) {}

    for (var ei = 0; ei < enemies.length; ei++) {
      var enemy = enemies[ei];
      if (!enemy || !Array.isArray(enemy.cardDeck)) continue;
      for (var si = 0; si < enemy.cardDeck.length; si++) {
        var slot = enemy.cardDeck[si];
        // Direct CI-* card in enemy deck
        if (slot && slot.id && slot.id.indexOf('CI-') === 0) {
          referenced[slot.id] = true;
        }
        // Planted CI-* card
        if (slot && slot.planted && slot.planted.cardId &&
            slot.planted.cardId.indexOf('CI-') === 0) {
          referenced[slot.planted.cardId] = true;
        }
      }
    }

    // Delete unreferenced instances
    var keys = Object.keys(_state.cardInstances);
    var removed = 0;
    for (var k = 0; k < keys.length; k++) {
      if (!referenced[keys[k]]) {
        delete _state.cardInstances[keys[k]];
        removed++;
      }
    }

    if (removed > 0) {
      console.debug('[GAMESTATE] gcCardInstances: removed ' + removed + ' orphaned CI-* instances');
      _saveState();
    }
  }

  /**
   * Plant a card from the player's hand into an enemy's card deck slot.
   * Writes a planted ref into the first available BLVCK/empty slot.
   * The CI-* instance (if any) stays in cardInstances — the GC scans enemy decks.
   * @param {Object} enemy - Enemy object with cardDeck array
   * @param {Object} cardRef - { id: 'ACT-*' or 'CI-*', qty: 1 }
   * @returns {{ success: boolean, slotIndex?: number, reason?: string }}
   */
  function plantCardOnEnemy(enemy, cardRef) {
    if (!enemy || !Array.isArray(enemy.cardDeck) || !cardRef || !cardRef.id) {
      return { success: false, reason: 'invalid_args' };
    }

    // Find first plantable slot (BLVCK empty slot or empty planted)
    var targetIdx = -1;
    for (var i = 0; i < enemy.cardDeck.length; i++) {
      var slot = enemy.cardDeck[i];
      if (slot && slot.isBlvckSlot && !slot.planted && !slot.stolen) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx < 0) {
      return { success: false, reason: 'no_plantable_slot' };
    }

    // Write the plant
    var currentTurn = 0;
    try {
      if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.getCurrentTurn === 'function') {
        currentTurn = GoneRogue.getCurrentTurn() || 0;
      }
    } catch (e) {}

    enemy.cardDeck[targetIdx].planted = {
      cardId: cardRef.id,
      plantedBy: 'player',
      turn: currentTurn
    };

    // Update provenance on the CI-* instance if applicable
    if (cardRef.id.indexOf('CI-') === 0 && _state.cardInstances[cardRef.id]) {
      var inst = _state.cardInstances[cardRef.id];
      if (!inst.provenance) inst.provenance = {};
      inst.provenance.plantedInto = 'enemy_deck';
      inst.provenance.enemyName = enemy.name || 'unknown';
      inst.provenance.plantTurn = currentTurn;
    }

    _saveState();
    return { success: true, slotIndex: targetIdx };
  }

  // ─── HAND OVERFLOW ENFORCEMENT ──────────────────────────

  /**
   * Enforce hand size limit. Called internally after any card enters hand.
   * Pushes oldest cards to backup, incinerating backup overflow.
   */
  function enforceHandOverflow() {
    var maxHand = _state.maxHandSize || 5;
    while (Array.isArray(_state.cardsInHand) && _state.cardsInHand.length > maxHand) {
      pushOldestHandCardToBackup();
    }
  }

  // ─── ACQUIRE CARD DURING COMBAT (deterministic serial) ──

  /**
   * Add a new card to hand during STR combat (loot drop, item dupe).
   * Deterministic sequence:
   *   1. New card enters hand (push to front)
   *   2. If hand > max: oldest hand → backup front
   *   3. If backup > 25: oldest backup incinerates
   */
  function acquireNewCardDuringCombat(cardId, qty) {
    qty = (typeof qty === 'number' ? qty : 1);
    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];

    for (var q = 0; q < qty; q++) {
      // Insert at front (newest position)
      _state.cardsInHand.unshift({ id: cardId, qty: 1, meta: null });
      // Enforce hand overflow (pushes oldest to backup, which may incinerate)
      enforceHandOverflow();
    }

    _saveState();
    try {
      window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'combat_acquire', cardId: cardId, qty: qty } }));
    } catch (e2) {}

    return { success: true };
  }

  // ─── BURN PILE ──────────────────────────────────────────

  /**
   * Get copy of burn pile (cards consumed this combat).
   * @returns {Array} Array of { id, timestamp }
   */
  function getBurnPile() {
    return Array.isArray(_state.burnPile) ? _state.burnPile.slice() : [];
  }

  /**
   * Get number of cards in burn pile.
   * @returns {number}
   */
  function getBurnPileCount() {
    return Array.isArray(_state.burnPile) ? _state.burnPile.length : 0;
  }

  /**
   * Clear burn pile. Called between combats.
   */
  function clearBurnPile() {
    _state.burnPile = [];
    _saveState();
  }

  /**
   * Get loose inventory
   */
  function getLooseInventory() {
    return _state.inventoryLoose.slice(); // Return copy
  }

  /**
   * Add card to action button slots (Gone Rogue mode)
   * @param {Object} card - Card object to add
   */
  function addToActionButtons(card) {
    // Get capacity from CardZoneManager if available, otherwise use default
    var maxSlots = _state.actionButtonSlots;
    if (typeof CardZoneManager !== 'undefined' && typeof CardZoneManager.getActionButtonCapacity === 'function') {
      maxSlots = CardZoneManager.getActionButtonCapacity();
    }

    if (_state.actionButtonCards.length >= maxSlots) {
      return {
        success: false,
        message: 'ACTION BUTTON SLOTS FULL (' + _state.actionButtonCards.length + '/' + maxSlots + ')'
      };
    }

    // Normalize qty to 1 — no stacking in any container
    if (card && typeof card.qty === 'number' && card.qty !== 1) card.qty = 1;
    _state.actionButtonCards.push(card);
    _saveState();

    // Update ReserveSlots UI if available
    if (typeof ReserveSlots !== 'undefined' && typeof ReserveSlots.setActionButtonCards === 'function') {
      ReserveSlots.setActionButtonCards(_state.actionButtonCards);
    }

    return {
      success: true,
      location: 'action_buttons',
      message: 'Card added to action buttons: ' + card.name
    };
  }

  /**
   * @deprecated CHH Step 3 — Use addPrintedCards(cardId, qty) or acquireNewCardDuringCombat(cardId, qty) instead.
   * Legacy: Add card to hand (play area) via full object.
   * Now routes through the canonical ref pipeline if the card has an id.
   * @param {Object} card - Card object or CardRef to add
   */
  function addToHand(card) {
    console.warn('[GAMESTATE] DEPRECATED: addToHand(card) called. Use addPrintedCards(cardId, qty) instead.');

    // CHH compat: if card is a CardRef or has a CI-*/ACT-* id, route through canonical path
    if (card && card.id && (card.id.indexOf('CI-') === 0 || card.id.indexOf('ACT-') === 0 || card.id.indexOf('EATK-') === 0)) {
      return addPrintedCards(card.id, card.qty || 1);
    }

    // Legacy fallback: register as CI-* then route through canonical path
    if (card && card.name) {
      var ciId = registerCardInstance({
        baseId: card.base || null,
        name: card.name,
        emoji: card.emoji || '🃏',
        type: card.type || 'unknown',
        category: card.category || card.type || 'unknown',
        quality: card.quality || 'STANDARD',
        qualityName: card.qualityName || 'Standard',
        qualityColor: card.qualityColor || '#ffffff',
        stats: card.stats || {},
        affixes: card.affixes || [],
        tags: card.tags || [],
        provenance: { source: 'legacy_addToHand' }
      });
      if (ciId) return addPrintedCards(ciId, 1);
    }

    return { success: false, message: 'Cannot add card — no valid id or name' };
  }

  /**
   * @deprecated CHH Step 3 — Use addPrintedCards(cardId, qty) or acquireNewCardDuringCombat(cardId, qty) instead.
   * Legacy: Add card following proper loot flow priority.
   * Now delegates to addToHand which routes through canonical pipeline.
   * @param {Object} card - Card object or CardRef to add
   */
  function addCard(card) {
    console.warn('[GAMESTATE] DEPRECATED: addCard(card) called. Use addPrintedCards(cardId, qty) instead.');
    return addToHand(card);
  }

  /**
   * Draw card from action buttons to hand (STR combat turn)
   * @param {number} count - Number of cards to draw (default: cardDrawPerTurn)
   */
  function drawCardsToHand(count) {
    count = count || _state.cardDrawPerTurn || 1;
    var drawn = [];
    var maxHand = _state.maxHandSize || 5;
    if (!Array.isArray(_state.cardsInHand)) _state.cardsInHand = [];

    for (var i = 0; i < count; i++) {
      // Check if hand is full (canonical array)
      if (_state.cardsInHand.length >= maxHand) {
        break;
      }

      // Check if action buttons have cards
      if (_state.actionButtonCards.length === 0) {
        break;
      }

      // Draw first card from action buttons
      var card = _state.actionButtonCards.shift();

      // Convert to CardRef for canonical cardsInHand pipeline
      var ref;
      if (card && card.id && (card.id.indexOf('CI-') === 0 || card.id.indexOf('ACT-') === 0 || card.id.indexOf('EATK-') === 0)) {
        // Already a canonical ref or has canonical id — always qty: 1
        ref = { id: card.id, qty: 1, meta: card.meta || null };
      } else if (card && card.name) {
        // Legacy full object — register as CI-* instance
        var ciId = registerCardInstance({
          baseId: card.base || card.baseId || null,
          name: card.name,
          emoji: card.emoji || '🃏',
          type: card.type || 'unknown',
          category: card.category || card.type || 'unknown',
          quality: card.quality || 'STANDARD',
          qualityName: card.qualityName || 'Standard',
          qualityColor: card.qualityColor || '#ffffff',
          stats: card.stats || {},
          affixes: card.affixes || [],
          tags: card.tags || [],
          provenance: { source: 'drawCardsToHand' }
        });
        ref = { id: ciId, qty: 1, meta: null };
      } else {
        // Last resort fallback — normalize qty (shouldn't happen)
        ref = card;
        if (ref && typeof ref.qty === 'number') ref.qty = 1;
      }

      _state.cardsInHand.push(ref);
      drawn.push(ref);
    }

    _saveState();

    return {
      success: drawn.length > 0,
      drawn: drawn,
      count: drawn.length,
      message: drawn.length + ' card(s) drawn to hand'
    };
  }

  /**
   * Get card hand
   */
  function getCardHand() {
    return _state.cardHand.slice(); // Return copy
  }

  /**
   * Get action button cards
   */
  function getActionButtonCards() {
    return _state.actionButtonCards.slice(); // Return copy
  }

  /**
   * Set card draw per turn rate (modified by items)
   */
  function setCardDrawRate(rate) {
    _state.cardDrawPerTurn = Math.max(1, rate);
    _saveState();
  }

  /**
   * Get current card draw rate
   */
  function getCardDrawRate() {
    return _state.cardDrawPerTurn || 1;
  }

  /**
   * Remove card from action button slots by index
   * @param {number} index - Index of card to remove
   */
  function removeFromActionButtons(index) {
    if (index < 0 || index >= _state.actionButtonCards.length) {
      return { success: false };
    }

    var removed = _state.actionButtonCards.splice(index, 1)[0];
    _saveState();

    // Update ReserveSlots UI if available
    if (typeof ReserveSlots !== 'undefined' && typeof ReserveSlots.setActionButtonCards === 'function') {
      ReserveSlots.setActionButtonCards(_state.actionButtonCards);
    }

    return {
      success: true,
      item: removed
    };
  }

  /**
   * Get action button cards
   */
  function getActionButtonCards() {
    return _state.actionButtonCards.slice(); // Return copy
  }

  /**
   * Set action button cards (replaces entire array)
   * @param {Array} cards - Array of card objects
   */
  function setActionButtonCards(cards) {
    _state.actionButtonCards = cards.slice(0, _state.actionButtonSlots);
    _saveState();

    // Update ReserveSlots UI if available
    if (typeof ReserveSlots !== 'undefined' && typeof ReserveSlots.setActionButtonCards === 'function') {
      ReserveSlots.setActionButtonCards(_state.actionButtonCards);
    }
  }

  /**
   * Clear action button cards
   */
  function clearActionButtonCards() {
    _state.actionButtonCards = [];
    _saveState();

    // Update ReserveSlots UI if available
    if (typeof ReserveSlots !== 'undefined' && typeof ReserveSlots.setActionButtonCards === 'function') {
      ReserveSlots.setActionButtonCards(_state.actionButtonCards);
    }
  }

  /**
   * Set active item slot (for equipment that needs to be "equipped")
   */
  function setActiveItem(itemRef) {
    _state.activeItemSlot = _normalizeItemRef(itemRef);

    // Minimal effect interpreter integration (active item effects)
    try {
      if (typeof GoneRogueEffectInterpreter !== 'undefined') {
        GoneRogueEffectInterpreter.clearAll();

        if (_state.activeItemSlot && typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItem) {
          var item = GoneRogueDataRegistry.getItem(_state.activeItemSlot.id);
          if (item && Array.isArray(item.effects)) {
            GoneRogueEffectInterpreter.applyEffects(item.effects, { equipping: true, itemId: _state.activeItemSlot.id });
          }
        } else {
          // Unequip
          GoneRogueEffectInterpreter.applyEffects([], { equipping: false });
        }
      }
    } catch (e) {}

    _saveState();

    try {
      window.dispatchEvent(new CustomEvent('rogue-active-item-changed', { detail: { activeItem: _state.activeItemSlot } }));
    } catch (e2) {}
  }

  /**
   * Get active item slot
   */
  function getActiveItem() {
    return _state.activeItemSlot;
  }

  function toggleActiveItemToggled() {
    if (!_state.activeItemSlot) return { success: false, reason: 'no_active_item' };
    if (!_state.activeItemSlot.meta) _state.activeItemSlot.meta = {};
    _state.activeItemSlot.meta.toggled = !_state.activeItemSlot.meta.toggled;
    _saveState();
    try {
      window.dispatchEvent(new CustomEvent('rogue-active-item-changed', { detail: { activeItem: _state.activeItemSlot } }));
    } catch (e2) {}
    return { success: true, toggled: !!_state.activeItemSlot.meta.toggled };
  }

  function _normalizeItemRef(item) {
    if (!item) return null;

    // Already a ref — { id: 'ITM-030', qty: 1, meta: {...} }
    if (item.id && typeof item.id === 'string' && item.id.indexOf('ITM-') === 0) {
      return {
        id: item.id,
        qty: (typeof item.qty === 'number' ? item.qty : 1),
        meta: item.meta || null
      };
    }

    // Key / item payload from PickupSystem — has registryId from data registry resolve
    if (item.registryId && typeof item.registryId === 'string') {
      return {
        id: item.registryId,
        qty: 1,
        meta: {
          legacyName: item.name || null,
          emoji: item.emoji || null,
          type: item.type || null,
          description: item.description || null,
          tier: item.tier || null,
          keyType: item.keyType || null,
          subtype: item.subtype || null,
          npcTarget: item.npcTarget || null,
          consumeOnUse: item.consumeOnUse || false
        }
      };
    }

    // Legacy object shape — try name-to-id map
    var legacy = item;
    var mappedId = _legacyItemNameToId(legacy.name);
    if (!mappedId) mappedId = 'ITM-000';

    return {
      id: mappedId,
      qty: 1,
      meta: {
        legacyName: legacy.name || null,
        emoji: legacy.emoji || null,
        type: legacy.type || null,
        description: legacy.description || null,
        tier: legacy.tier || null,
        keyType: legacy.keyType || null
      }
    };
  }

  function _legacyItemNameToId(name) {
    if (!name) return null;
    // Primary: auto-generated name→ID map from registry (built at items.json load time)
    if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getItemIdByName) {
      var regId = GoneRogueDataRegistry.getItemIdByName(name);
      if (regId) return regId;
    }
    // Fallback: hardcoded entries for pre-registry / edge cases
    var fallback = {
      'Radio Transceiver': 'ITM-002',
      'Surveillance Cam': 'ITM-003',
      'Personal Journal': 'ITM-004',
      "Blacksmith's Hammer": 'ITM-030',
      'Rune Fragment': 'ITM-031'
    };
    return fallback[name] || null;
  }

  function _migrateInventoryToRefs() {
    // persistent inventory
    if (!Array.isArray(_state.inventoryPersistent)) _state.inventoryPersistent = [];

    var migrated = [];
    for (var i = 0; i < _state.inventoryPersistent.length; i++) {
      var it = _state.inventoryPersistent[i];
      var ref = _normalizeItemRef(it);
      if (ref) migrated.push(ref);
    }
    _state.inventoryPersistent = migrated;

    // persistent cards
    if (!Array.isArray(_state.persistentCards)) _state.persistentCards = [];

    // Legacy card arrays -> persistentCards
    if (_state.cards && !Array.isArray(_state.cards)) {
      // If someone stored a single card, wrap it
      _state.cards = [_state.cards];
    }

    if (Array.isArray(_state.cards) && _state.cards.length && (!_state.persistentCards || _state.persistentCards.length === 0)) {
      _state.persistentCards = _state.cards.map(_migrateLegacyCardEntry).filter(Boolean);
      try { delete _state.cards; } catch (e) { _state.cards = null; }
    }

    // Normalize any existing persistentCards entries
    if (Array.isArray(_state.persistentCards)) {
      _state.persistentCards = _state.persistentCards.map(_migrateLegacyCardEntry).filter(Boolean);

      // If anything that looks like an item snuck into the card stash, move it out.
      var keep = [];
      for (var pc = 0; pc < _state.persistentCards.length; pc++) {
        var cref = _state.persistentCards[pc];
        if (!cref || !cref.id) continue;
        if (cref.id.indexOf('ITM-') === 0) {
          _state.inventoryPersistent.push({ id: cref.id, qty: 1, meta: cref.meta || null });
        } else {
          keep.push(cref);
        }
      }
      _state.persistentCards = keep;

      // Unstack: expand any vault entries with qty > 1 into individual slots.
      // Legacy saves may have stacked cards from the old addPersistentCard logic.
      var unstacked = [];
      for (var us = 0; us < _state.persistentCards.length; us++) {
        var uc = _state.persistentCards[us];
        if (!uc || !uc.id) continue;
        var uq = (typeof uc.qty === 'number' && uc.qty > 1) ? uc.qty : 1;
        for (var un = 0; un < uq; un++) {
          unstacked.push({ id: uc.id, qty: 1, meta: uc.meta || null });
        }
      }
      _state.persistentCards = unstacked;
    }

    // active slot
    if (_state.activeItemSlot) {
      _state.activeItemSlot = _normalizeItemRef(_state.activeItemSlot);
    }

    _saveState();
  }

  function _migrateLegacyCardEntry(entry) {
    if (!entry) return null;

    // Already in CardRef format
    if (entry.id && typeof entry.id === 'string' && entry.id.indexOf('ACT-') === 0) {
      return {
        id: entry.id,
        qty: (typeof entry.qty === 'number' ? entry.qty : 1),
        meta: entry.meta || null
      };
    }

    // String format
    if (typeof entry === 'string') {
      return {
        id: _inferCardIdFromName(entry) || 'ACT-000',
        qty: 1,
        meta: { legacyName: entry, source: 'string_array' }
      };
    }

    // Object format with name/emoji/etc
    if (entry && entry.name) {
      return {
        id: _inferCardIdFromName(entry.name) || 'ACT-000',
        qty: (typeof entry.qty === 'number' ? entry.qty : 1),
        meta: {
          legacyName: entry.name,
          emoji: entry.emoji || null,
          type: entry.type || null,
          description: entry.description || null,
          source: 'object_array'
        }
      };
    }

    // Unknown
    return {
      id: 'ACT-000',
      qty: 1,
      meta: { rawEntry: entry, source: 'unknown_format' }
    };
  }

  function _inferCardIdFromName(name) {
    try {
      if (!name) return null;
      if (typeof GoneRogueDataRegistry === 'undefined' || !GoneRogueDataRegistry.listCards) return null;

      var needle = String(name).toLowerCase().trim();
      var all = GoneRogueDataRegistry.listCards() || [];
      for (var i = 0; i < all.length; i++) {
        var c = all[i];
        if (!c || !c.name) continue;
        if (String(c.name).toLowerCase().trim() === needle) {
          return c.id;
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Clear active item slot
   */
  function clearActiveItem() {
    _state.activeItemSlot = null;
    _saveState();

    try {
      window.dispatchEvent(new CustomEvent('rogue-active-item-changed', { detail: { activeItem: null } }));
    } catch (e2) {}
  }

  // Consume active item and remove one instance from inventories (persistent/loose).
  // If logged in, also attempt to consume from account inventory on the server.
  function consumeActiveItem() {
    var active = _state.activeItemSlot;
    if (!active || !active.id) {
      clearActiveItem();
      return { success: false, reason: 'no_active_item' };
    }

    var id = active.id;

    // Best-effort server consume (oldest-first selector). We do NOT block local gameplay.
    try {
      if (typeof UserAccount !== 'undefined' && UserAccount.isLoggedIn && UserAccount.isLoggedIn()) {
        var token = UserAccount.getSessionToken && UserAccount.getSessionToken();
        if (token) {
          fetch('/api/user/inventory/consume', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-Token': token,
            },
            body: JSON.stringify({ item_id: id, count: 1 }),
          }).then(function(res) {
            if (!res || !res.ok) {
              // silent; local-only fallback covers us. merge-local-data can reconcile later.
              return;
            }
          }).catch(function() {});
        }
      }
    } catch (eFetch) {}

    function _dec(list) {
      if (!Array.isArray(list)) return false;
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (!r || r.id !== id) continue;
        r.qty = (r.qty || 1) - 1;
        if (r.qty <= 0) list.splice(i, 1);
        return true;
      }
      return false;
    }

    var removed = false;
    try { removed = _dec(_state.inventoryPersistent) || removed; } catch (e0) {}
    try { removed = _dec(_state.inventoryLoose) || removed; } catch (e1) {}

    clearActiveItem();
    _saveState();

    return { success: true, removedFromInventory: removed };
  }

  function _saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.error('Failed to save gamestate:', e);
    }
  }

  /**
   * CHH: Full save with GC pass. Call on floor transitions and explicit saves.
   * Runs gcCardInstances() before persisting to avoid unbounded instance growth.
   */
  function saveWithGC() {
    gcCardInstances();
    _saveState();
  }

  function _loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed) {
        _state = Object.assign(_state, parsed);
      }
      // Migrate old saves that lack key counters
      _ensureKeysObj();
    } catch (e) {
      console.error('Failed to load gamestate:', e);
    }
  }

  /**
   * Convert street inventory item string to card object
   * @param {String} itemStr - Item string from Street Chronicles
   * @returns {Object|null} Card object or null if not a card
   */
  function _convertStreetItemToCard(itemStr) {
    if (!itemStr) return null;

    // Map street item names to CardSystem card types
    var cardMapping = {
      'SINGLE_SHOT card': 'SINGLE_SHOT',
      'PRONE card': 'PRONE',
      'KATCHUP card': 'KATCHUP',
      'DODGE card': 'DODGE',
      'BURST_SHOT card': 'BURST_SHOT'
    };

    // Check if item is a card
    for (var key in cardMapping) {
      if (itemStr.indexOf(key) !== -1) {
        if (typeof CardSystem !== 'undefined' && typeof CardSystem.rollCard === 'function') {
          return CardSystem.rollCard(cardMapping[key]);
        }
      }
    }

    // Not a card - return as-is (for non-card items like festival flyer)
    return { name: itemStr, type: 'misc' };
  }

  function reset() {
    _state = {
      mode: MODES.STREET,
      submode: null,
      inventoryPersistent: [],
      persistentCards: [],
      _starterCardsSeeded: false,
      _starterBoxesSeeded: false,
      _grantAct002Done: false,
      inventoryLoose: [],
      actionButtonCards: [],
      persistentSlots: 9,
      maxPersistentSlots: 12,
      looseSlots: 8,
      actionButtonSlots: 4,
      cryptos: 0,
      rogueRun: null,
      activeItemSlot: null,

      // Canonical hand + backup (CH/NCH)
      cardsInHand: [],
      backupCards: [],
      cardInstances: {},
      hasDrawnBackupThisCombat: false,
      playerFatigue: 0,
      maxFatigue: 100,
      fatigueRecovery: 5,
      fatigueThreshold: 70,
      playerAmmo: 7,  // Match initial state
      maxAmmo: 50,
      playerEnergy: 5,
      maxEnergy: 5,
      playerFocus: 10,
      maxFocus: 10,
      playerBattery: 5,
      maxBattery: 5,
      playerStability: 10,
      maxStability: 10,
      consumables: [],
      consumableSlots: 3,
      maxConsumableSlots: 5,
      keys: { ammo: {}, gate: {}, quest: {} }
    };
    _saveState();
  }

  /**
   * Helper to check if StreetChronicles is available and active
   * @returns {boolean}
   */
  function _isStreetChroniclesActive() {
    return typeof StreetChronicles !== 'undefined' && 
           typeof StreetChronicles.isActive === 'function' && 
           StreetChronicles.isActive();
  }

  /**
   * Central transition helper for entering Gone Rogue mode.
   * Handles Street Chronicles deactivation, inventory transfer, and mode switching.
   * @param {Object} context - {reason, seed, difficulty, carryInventory}
   * @returns {Object} Action object for main.js with lines, prompt, and stayActive
   */
  function requestRogue(context) {
    context = context || {};
    console.debug('[GAMESTATE.requestRogue] Initiating Gone Rogue transition', context);

    // Step 1: If StreetChronicles is active and carryInventory requested, collect inventory
    if (_isStreetChroniclesActive()) {
      console.debug('[GAMESTATE.requestRogue] StreetChronicles is active');
      
      if (context.carryInventory && typeof StreetChronicles.getInventory === 'function') {
        var streetInv = StreetChronicles.getInventory();
        console.debug('[GAMESTATE.requestRogue] Carrying street inventory:', streetInv.length, 'items');
        context._streetInventory = streetInv;
        context.carryInventory = true;
      }

      // Step 2: Signal StreetChronicles to deactivate/yield control
      if (typeof StreetChronicles.deactivate === 'function') {
        console.debug('[GAMESTATE.requestRogue] Calling StreetChronicles.deactivate()');
        StreetChronicles.deactivate();
      } else {
        console.debug('[GAMESTATE.requestRogue] StreetChronicles.deactivate() not available');
      }
    }

    // Step 3: Update persisted state via enterRogueMode
    var intro = enterRogueMode(context);
    console.debug('[GAMESTATE.requestRogue] enterRogueMode completed');

    // Step 4: Start GoneRogue module and return its action object
    if (typeof GoneRogue !== 'undefined' && typeof GoneRogue.start === 'function') {
      console.debug('[GAMESTATE.requestRogue] Starting GoneRogue module');
      return GoneRogue.start(context);
    }

    // Fallback if GoneRogue module is missing
    console.warn('[GAMESTATE.requestRogue] GoneRogue module not available, returning fallback');
    return {
      lines: intro.lines || ['GONE ROGUE MODE UNAVAILABLE'],
      prompt: 'ROGUE> ',
      stayActive: false
    };
  }

  /**
   * Add cryptos (currency) to player's wallet
   * @param {number} amount - Amount of cryptos to add
   */
  function addCryptos(amount) {
    _state.cryptos = (_state.cryptos || 0) + amount;
    _saveState();

    // Update UI display if available
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(_state.cryptos);
    }

    return {
      success: true,
      total: _state.cryptos,
      message: 'Collected ¢' + amount + ' (Total: ¢' + _state.cryptos + ')'
    };
  }

  /**
   * Remove cryptos (for purchases)
   * @param {number} amount - Amount of cryptos to spend
   */
  function spendCryptos(amount) {
    if ((_state.cryptos || 0) < amount) {
      return {
        success: false,
        message: 'Insufficient cryptos (Have: ¢' + (_state.cryptos || 0) + ', Need: ¢' + amount + ')'
      };
    }
    _state.cryptos -= amount;
    _saveState();

    // Update UI display if available
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
      UIControls.updateCurrency(_state.cryptos);
    }

    return {
      success: true,
      remaining: _state.cryptos,
      message: 'Spent ¢' + amount + ' (Remaining: ¢' + _state.cryptos + ')'
    };
  }

  /**
   * Get current crypto balance
   */
  function getCryptos() {
    return _state.cryptos || 0;
  }

  // ========== FATIGUE MANAGEMENT ==========

  /**
   * Get current fatigue level
   */
  function getFatigue() {
    return _state.playerFatigue || 0;
  }

  /**
   * Add fatigue (from actions like combat, movement)
   * @param {number} amount - Amount of fatigue to add
   */
  function addFatigue(amount) {
    _state.playerFatigue = Math.min(_state.maxFatigue, (_state.playerFatigue || 0) + amount);
    _saveState();
    return _state.playerFatigue;
  }

  /**
   * Reduce fatigue (from rest, items, etc.)
   * @param {number} amount - Amount of fatigue to remove
   */
  function reduceFatigue(amount) {
    _state.playerFatigue = Math.max(0, (_state.playerFatigue || 0) - amount);
    _saveState();
    return _state.playerFatigue;
  }

  /**
   * Reset fatigue (after combat or rest)
   */
  function resetFatigue() {
    _state.playerFatigue = 0;
    _state._playerFatigueDecimal = 0.0;
    _saveState();
  }

  /**
   * Drain sprint fatigue (continuous, fractional)
   * Called each frame during sprint movement
   * @param {number} deltaTime - Time elapsed in seconds
   * @returns {boolean} True if fatigue increased (rolled over to next integer)
   */
  function drainSprintFatigue(deltaTime) {
    // Sprint fatigue drain rate: ~70% of a 50-tile map before 1 full fatigue point
    // Assuming 50 tiles traversed in ~6.25 seconds at sprint speed (8 * 1.5 = 12 tiles/sec)
    // We want to drain 1.0 fatigue over 6.25 * 0.7 = ~4.4 seconds
    // Rate = 1.0 / 4.4 = ~0.227 fatigue per second
    var SPRINT_FATIGUE_RATE = 0.227;

    // Apply modifiers from equipment (Moon Boots, etc.)
    var fatigueModifier = 1.0;
    if (typeof PassiveItemsSystem !== 'undefined') {
      var equipped = (PassiveItemsSystem.getEquippedItems ? PassiveItemsSystem.getEquippedItems() : []);
      for (var i = 0; i < equipped.length; i++) {
        if (equipped[i].sprintFatigueModifier) {
          fatigueModifier *= equipped[i].sprintFatigueModifier;
        }
      }
    }

    // Add fractional fatigue
    _state._playerFatigueDecimal += SPRINT_FATIGUE_RATE * fatigueModifier * deltaTime;

    // Check if we've accumulated a full integer point
    var rolled = false;
    if (_state._playerFatigueDecimal >= 1.0) {
      var integerPart = Math.floor(_state._playerFatigueDecimal);
      _state.playerFatigue = Math.min(_state.maxFatigue, _state.playerFatigue + integerPart);
      _state._playerFatigueDecimal -= integerPart;
      rolled = true;
      _saveState();
    }

    return rolled;
  }

  /**
   * Block sprint temporarily (after food pickup when exhausted)
   * Creates a delay before fatigue recovery can start during sprint
   * This prevents immediate fatigue refill and causes delayed food buff effect
   * @param {number} duration - Duration in milliseconds (default: 900ms)
   */
  function blockSprintTemporarily(duration) {
    duration = duration || 900; // Default: 0.9 seconds
    _state._sprintBlockedUntil = performance.now() + duration;
  }

  /**
   * Check if player can sprint (not exhausted and sprint not blocked)
   * @returns {boolean} True if player can sprint
   */
  function canSprint() {
    // Block sprint if temporary block is active (e.g., after food pickup)
    if (_state._sprintBlockedUntil > performance.now()) {
      return false;
    }

    // Block sprint if exhausted
    if (_state.playerFatigue >= _state.maxFatigue) {
      return false;
    }

    return true;
  }

  // ========== AMMO MANAGEMENT ==========

  /**
   * Get current ammo count
   */
  function getAmmo() {
    return _state.playerAmmo || 0;
  }

  /**
   * Use ammo (for shooting cards)
   * @param {number} amount - Amount of ammo to use
   */
  function useAmmo(amount) {
    if ((_state.playerAmmo || 0) < amount) {
      return {
        success: false,
        message: 'Insufficient ammo (Have: ' + (_state.playerAmmo || 0) + ', Need: ' + amount + ')'
      };
    }
    _state.playerAmmo -= amount;
    _saveState();
    return {
      success: true,
      remaining: _state.playerAmmo
    };
  }

  /**
   * Add ammo (from pickups, purchases)
   * @param {number} amount - Amount of ammo to add
   */
  function addAmmo(amount) {
    _state.playerAmmo = Math.min(_state.maxAmmo, (_state.playerAmmo || 0) + amount);
    _saveState();
    return _state.playerAmmo;
  }

  // ========== CONSUMABLES MANAGEMENT ==========

  /**
   * Get all consumables
   */
  function getConsumables() {
    return _state.consumables || [];
  }

  /**
   * Add a consumable item
   * @param {string} type - Type of consumable (e.g., 'ENERGY_DRINK')
   * @param {number} count - How many to add (default 1)
   */
  function addConsumable(type, count) {
    count = count || 1;
    var consumables = _state.consumables || [];

    // Check if we already have this consumable type
    var existing = consumables.find(function(c) { return c.type === type; });
    if (existing) {
      existing.count += count;
    } else {
      // Check if we have room for a new type
      if (consumables.length >= (_state.consumableSlots || 3)) {
        return {
          success: false,
          message: 'Consumable slots full (' + consumables.length + '/' + (_state.consumableSlots || 3) + ')'
        };
      }
      consumables.push({ type: type, count: count });
    }

    _state.consumables = consumables;
    _saveState();
    return {
      success: true,
      consumables: consumables
    };
  }

  /**
   * Use a consumable item
   * @param {string} type - Type of consumable to use
   */
  function useConsumable(type) {
    var consumables = _state.consumables || [];
    var consumable = consumables.find(function(c) { return c.type === type; });

    if (!consumable || consumable.count <= 0) {
      return {
        success: false,
        message: 'No ' + type + ' available'
      };
    }

    consumable.count--;
    if (consumable.count === 0) {
      // Remove from array if count reaches 0
      _state.consumables = consumables.filter(function(c) { return c.type !== type; });
    }

    _saveState();
    return {
      success: true,
      remaining: consumable.count
    };
  }

  /**
   * Get count of a specific consumable
   * @param {string} type - Type of consumable
   */
  function getConsumableCount(type) {
    var consumables = _state.consumables || [];
    var consumable = consumables.find(function(c) { return c.type === type; });
    return consumable ? consumable.count : 0;
  }

  // ========== ENERGY MANAGEMENT ==========

  /**
   * Get current energy level
   */
  function getEnergy() {
    return _state.playerEnergy !== undefined ? _state.playerEnergy : _state.maxEnergy;
  }

  /**
   * Use energy (for special abilities)
   * @param {number} amount - Amount of energy to use
   */
  function useEnergy(amount) {
    var current = getEnergy();
    if (current < amount) {
      return {
        success: false,
        message: 'Insufficient energy (Have: ' + current + ', Need: ' + amount + ')'
      };
    }
    _state.playerEnergy = current - amount;
    _saveState();
    return {
      success: true,
      remaining: _state.playerEnergy
    };
  }

  /**
   * Restore energy
   * @param {number} amount - Amount of energy to restore
   */
  function restoreEnergy(amount) {
    var current = getEnergy();
    _state.playerEnergy = Math.min(_state.maxEnergy, current + amount);
    _saveState();
    return _state.playerEnergy;
  }
  
  /**
   * Add energy (alias for restoreEnergy for consistency)
   * @param {number} amount - Amount of energy to add
   */
  function addEnergy(amount) {
    return restoreEnergy(amount);
  }

  // ========== FOCUS MANAGEMENT ==========

  /**
   * Get current focus level
   */
  function getFocus() {
    return _state.playerFocus !== undefined ? _state.playerFocus : _state.maxFocus;
  }

  /**
   * Lose focus (from distractions, panic)
   * @param {number} amount - Amount of focus to lose
   */
  function loseFocus(amount) {
    var current = getFocus();
    _state.playerFocus = Math.max(0, current - amount);
    _saveState();
    return _state.playerFocus;
  }

  /**
   * Restore focus
   * @param {number} amount - Amount of focus to restore
   */
  function restoreFocus(amount) {
    var current = getFocus();
    _state.playerFocus = Math.min(_state.maxFocus, current + amount);
    _saveState();
    return _state.playerFocus;
  }
  
  /**
   * Add focus (alias for restoreFocus for consistency)
   * @param {number} amount - Amount of focus to add
   */
  function addFocus(amount) {
    return restoreFocus(amount);
  }

  // ========== BATTERY MANAGEMENT ==========

  /**
   * Get current battery level
   */
  function getBattery() {
    return _state.playerBattery !== undefined ? _state.playerBattery : _state.maxBattery;
  }

  /**
   * Use battery (for equipment)
   * @param {number} amount - Amount of battery to use
   */
  function useBattery(amount) {
    var current = getBattery();
    if (current < amount) {
      return {
        success: false,
        message: 'Insufficient battery (Have: ' + current + ', Need: ' + amount + ')'
      };
    }
    _state.playerBattery = current - amount;
    _saveState();
    return {
      success: true,
      remaining: _state.playerBattery
    };
  }

  /**
   * Recharge battery
   * @param {number} amount - Amount of battery to recharge
   */
  function rechargeBattery(amount) {
    var current = getBattery();
    _state.playerBattery = Math.min(_state.maxBattery, current + amount);
    _saveState();
    return _state.playerBattery;
  }

  // ========== STABILITY MANAGEMENT ==========

  /**
   * Get current stability level
   */
  function getStability() {
    return _state.playerStability !== undefined ? _state.playerStability : _state.maxStability;
  }

  /**
   * Lose stability (from fear, panic)
   * @param {number} amount - Amount of stability to lose
   */
  function loseStability(amount) {
    var current = getStability();
    _state.playerStability = Math.max(0, current - amount);
    _saveState();
    return _state.playerStability;
  }

  /**
   * Restore stability
   * @param {number} amount - Amount of stability to restore
   */
  function restoreStability(amount) {
    var current = getStability();
    _state.playerStability = Math.min(_state.maxStability, current + amount);
    _saveState();
    return _state.playerStability;
  }

  // ========== USER DATA MANAGEMENT ==========

  /**
   * Load user data from server (called after login)
   * @param {Object} userData - User data from server
   */
  function loadUserData(userData) {
    if (!userData) return;

    // Update crypto balance from server
    if (userData.cryptos !== undefined) {
      _state.cryptos = userData.cryptos;
      if (typeof UIControls !== 'undefined' && UIControls.updateCurrency) {
        UIControls.updateCurrency(_state.cryptos);
      }
    }

    _saveState();
  }

  // ========== COOLDOWN TRACKING ==========

  /**
   * Increment combat counter (call after each combat completion)
   */
  function incrementCombatCounter() {
    if (_state.rogueRun) {
      _state.rogueRun.combatsCompleted = (_state.rogueRun.combatsCompleted || 0) + 1;
      _saveState();
      return _state.rogueRun.combatsCompleted;
    }
    return 0;
  }

  /**
   * Increment floor counter (call after ascending to next floor)
   */
  function incrementFloorCounter() {
    if (_state.rogueRun) {
      _state.rogueRun.floor = (_state.rogueRun.floor || 1) + 1;
      _saveState();
      return _state.rogueRun.floor;
    }
    return 1;
  }

  /**
   * Get current combat count
   */
  function getCombatCount() {
    return _state.rogueRun ? (_state.rogueRun.combatsCompleted || 0) : 0;
  }

  /**
   * Get current floor count
   */
  function getFloorCount() {
    return _state.rogueRun ? (_state.rogueRun.floor || 1) : 1;
  }

  /**
   * Get current action button capacity (base + equipment bonuses)
   */
  function getActionButtonCapacity() {
    if (typeof CardZoneManager !== 'undefined' && typeof CardZoneManager.getActionButtonCapacity === 'function') {
      return CardZoneManager.getActionButtonCapacity();
    }
    return _state.actionButtonSlots || 4;
  }

  // ── Key Counter Management ──────────────────────────────────────
  // Structured counters for external UI hooks.
  // Buckets: ammo (tier 1), gate (tier 2), quest (tier 3).

  /** Ensure _state.keys exists (migration from old saves) */
  function _ensureKeysObj() {
    if (!_state.keys) _state.keys = { ammo: {}, gate: {}, quest: {} };
    if (!_state.keys.ammo)  _state.keys.ammo  = {};
    if (!_state.keys.gate)  _state.keys.gate  = {};
    if (!_state.keys.quest) _state.keys.quest = {};
  }

  /** Map tier number → bucket name */
  function _keyBucket(tier) {
    if (tier >= 3) return 'quest';
    if (tier >= 2) return 'gate';
    return 'ammo';
  }

  /**
   * Increment a key counter.
   * @param {String} keyType - e.g. 'KEY_002', 'KEYCARD', 'BLACKSMITH_HAMMER'
   * @param {Number} tier    - 1, 2, or 3
   * @param {Number} [delta] - amount to add (default 1)
   */
  function addKeyCount(keyType, tier, delta) {
    _ensureKeysObj();
    delta = (typeof delta === 'number') ? delta : 1;
    var bucket = _state.keys[_keyBucket(tier)];
    bucket[keyType] = (bucket[keyType] || 0) + delta;
    _saveState();
  }

  /**
   * Decrement a key counter (floors at 0).
   * @param {String} keyType
   * @param {Number} tier
   * @param {Number} [delta] - amount to subtract (default 1)
   * @returns {Boolean} true if there was stock to consume
   */
  function removeKeyCount(keyType, tier, delta) {
    _ensureKeysObj();
    delta = (typeof delta === 'number') ? delta : 1;
    var bucket = _state.keys[_keyBucket(tier)];
    var cur = bucket[keyType] || 0;
    if (cur <= 0) return false;
    bucket[keyType] = Math.max(0, cur - delta);
    if (bucket[keyType] === 0) delete bucket[keyType]; // keep object tidy
    _saveState();
    return true;
  }

  /**
   * Get the full keys object (read-only copy).
   * Shape: { ammo: {KEY_002:n,...}, gate: {KEYCARD:n,...}, quest: {BLACKSMITH_HAMMER:n,...} }
   */
  function getKeyCounts() {
    _ensureKeysObj();
    return JSON.parse(JSON.stringify(_state.keys));
  }

  /**
   * Get count for a single key type.
   * @param {String} keyType
   * @param {Number} tier
   * @returns {Number}
   */
  function getKeyCount(keyType, tier) {
    _ensureKeysObj();
    var bucket = _state.keys[_keyBucket(tier)];
    return bucket[keyType] || 0;
  }

  /**
   * Get total count of all Tier-1 (ammo) keys held.
   * Used to supply old/new values for DebriefFeedController.reportResourceChange.
   * @returns {Number}
   */
  function getTotalKeyAmmo() {
    _ensureKeysObj();
    var bucket = _state.keys.ammo || {};
    var total = 0;
    for (var k in bucket) { if (bucket.hasOwnProperty(k)) total += (bucket[k] || 0); }
    return total;
  }

  /**
   * Rebuild key counters from current inventory arrays.
   * Safety net — call after load or suspected desync.
   */
  function rebuildKeyCounts() {
    _ensureKeysObj();
    _state.keys = { ammo: {}, gate: {}, quest: {} };

    // Scan loose inventory → tier 1
    var loose = _state.inventoryLoose || [];
    for (var i = 0; i < loose.length; i++) {
      var li = loose[i];
      if (li && li.type === 'key') {
        var kt1 = li.keyType || li.itemId || 'UNKNOWN';
        var t1 = li.tier || 1;
        var b1 = _keyBucket(t1);
        _state.keys[b1][kt1] = (_state.keys[b1][kt1] || 0) + 1;
      }
    }

    // Scan persistent inventory → tier 2 / tier 3
    var persistent = _state.inventoryPersistent || [];
    for (var j = 0; j < persistent.length; j++) {
      var pi = persistent[j];
      if (pi && pi.type === 'key') {
        var kt2 = pi.keyType || pi.registryId || pi.itemId || 'UNKNOWN';
        var t2 = pi.tier || (pi.subtype === 'quest' ? 3 : 2);
        var b2 = _keyBucket(t2);
        _state.keys[b2][kt2] = (_state.keys[b2][kt2] || 0) + 1;
      }
    }

    _saveState();
    return _state.keys;
  }

  function getMaxBackupSlots() {
    return _state.maxBackupSlots || 25;
  }

  function setMaxBackupSlots(n) {
    _state.maxBackupSlots = Math.max(1, Number(n) || 25);
    _saveState();
  }

  /**
   * Fisher-Yates shuffle the backup deck in place.
   */
  function shuffleBackupDeck() {
    if (!Array.isArray(_state.backupCards) || _state.backupCards.length < 2) return { success: false, reason: 'too_few' };
    for (var i = _state.backupCards.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = _state.backupCards[i];
      _state.backupCards[i] = _state.backupCards[j];
      _state.backupCards[j] = tmp;
    }
    _saveState();
    window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'shuffle' } }));
    return { success: true };
  }

  /**
   * Sort the backup deck by a given criteria.
   * @param {'quality'|'name'|'cost'} criteria
   */
  function sortBackupDeck(criteria) {
    if (!Array.isArray(_state.backupCards) || _state.backupCards.length < 2) return { success: false, reason: 'too_few' };

    var _getDefSafe = function(id) {
      try {
        if (typeof GoneRogueDataRegistry !== 'undefined' && GoneRogueDataRegistry.getCard) {
          return GoneRogueDataRegistry.getCard(id) || {};
        }
      } catch (e) {}
      return {};
    };

    var qualityOrder = { cracked: 0, damaged: 1, worn: 2, standard: 3, refined: 4, superior: 5, elite: 6, masterwork: 7, perfect: 8 };

    _state.backupCards.sort(function(a, b) {
      var da = _getDefSafe(a.id);
      var db = _getDefSafe(b.id);
      if (criteria === 'quality') {
        var qa = qualityOrder[String(da.quality || da.qualityName || 'standard').toLowerCase()] || 3;
        var qb = qualityOrder[String(db.quality || db.qualityName || 'standard').toLowerCase()] || 3;
        return qb - qa; // highest quality first
      } else if (criteria === 'cost') {
        var costA = 0, costB = 0;
        if (Array.isArray(da.costs)) da.costs.forEach(function(c) { costA += Number(c.amount || 0); });
        if (Array.isArray(db.costs)) db.costs.forEach(function(c) { costB += Number(c.amount || 0); });
        return costA - costB; // cheapest first
      }
      // Default: name
      var na = String(da.name || a.id || '').toLowerCase();
      var nb = String(db.name || b.id || '').toLowerCase();
      return na < nb ? -1 : na > nb ? 1 : 0;
    });

    _saveState();
    window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'sort', criteria: criteria } }));
    return { success: true };
  }

  function pushOldestHandCardToBackup() {
    if (!Array.isArray(_state.cardsInHand) || _state.cardsInHand.length === 0) {
      return { success: false, reason: 'hand_empty' };
    }
    var old = _state.cardsInHand.pop();
    if (!Array.isArray(_state.backupCards)) _state.backupCards = [];
    _state.backupCards.unshift({ id: old.id, qty: 1, meta: old.meta || null });
    var maxB = _state.maxBackupSlots || 25;
    while (_state.backupCards.length > maxB) {
      var incinerated = _state.backupCards.pop();
      try { window.dispatchEvent(new CustomEvent('rogue-card-incinerated', { detail: { card: incinerated, source: 'backup_overflow' } })); } catch (ei) {}
    }
    _saveState();
    window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'push_oldest', cardId: old.id } }));
    return { success: true, returnedCard: old };
  }

  function insertCardAtBackupTop(ref) {
    if (!ref || !ref.id) return { success: false };
    if (!Array.isArray(_state.backupCards)) _state.backupCards = [];
    _state.backupCards.unshift({ id: ref.id, qty: 1, meta: ref.meta || null });
    var maxB = _state.maxBackupSlots || 25;
    var discarded = 0;
    while (_state.backupCards.length > maxB) {
      _state.backupCards.pop();
      discarded++;
    }
    _saveState();
    window.dispatchEvent(new CustomEvent('rogue-hand-changed', { detail: { source: 'insert_top', cardId: ref.id } }));
    return { success: true, discarded: discarded };
  }

  return {
    MODES: MODES,
    init: init,
    getMode: getMode,
    getState: getState,
    enterRogueMode: enterRogueMode,
    exitRogueMode: exitRogueMode,
    addToPersistent: addToPersistent,
    addToLoose: addToLoose,
    removeFromPersistent: removeFromPersistent,
    removeFromLoose: removeFromLoose,
    clearLooseInventory: clearLooseInventory,
    getPersistentInventory: getPersistentInventory,
    removePersistentInventoryItem: removePersistentInventoryItem,
    getPersistentCards: getPersistentCards,
    addPersistentCard: addPersistentCard,
    removePersistentCard: removePersistentCard,

    // CHH Step 1: Card instance management (CI-* IDs)
    registerCardInstance: registerCardInstance,
    getCardInstance: getCardInstance,
    gcCardInstances: gcCardInstances,
    plantCardOnEnemy: plantCardOnEnemy,
    saveWithGC: saveWithGC,

    // Canonical hand (CH/NCH)
    getCardsInHand: getCardsInHand,
    getBackupCards: getBackupCards,
    addCardToHand: addCardToHand,
    insertCardToHandTop: insertCardToHandTop,
    consumeCardFromHand: consumeCardFromHand,
    removeCardFromHandByIndex: removeCardFromHandByIndex,
    returnCardFromHandToStash: returnCardFromHandToStash,
    moveHandIndexToBackup: moveHandIndexToBackup,
    removeBackupCard: removeBackupCard,
    moveBackupIndexToHand: moveBackupIndexToHand,
    moveStashCardToBackup: moveStashCardToBackup,
    resetCombatBackupDrawFlag: resetCombatBackupDrawFlag,
    resetTurnBackupDrawFlag: resetTurnBackupDrawFlag,
    canDrawBackupThisCombat: canDrawBackupThisCombat,
    canDrawBackupThisTurn: canDrawBackupThisTurn,
    drawOneFromBackupOncePerCombat: drawOneFromBackupOncePerCombat,
    drawOneFromBackupPerTurn: drawOneFromBackupPerTurn,
    markBackupDrawUsedThisTurn: markBackupDrawUsedThisTurn,
    enforceHandOverflow: enforceHandOverflow,
    acquireNewCardDuringCombat: acquireNewCardDuringCombat,
    getBurnPile: getBurnPile,
    getBurnPileCount: getBurnPileCount,
    clearBurnPile: clearBurnPile,
    getMaxBackupSlots: getMaxBackupSlots,
    setMaxBackupSlots: setMaxBackupSlots,
    shuffleBackupDeck: shuffleBackupDeck,
    sortBackupDeck: sortBackupDeck,
    pushOldestHandCardToBackup: pushOldestHandCardToBackup,
    insertCardAtBackupTop: insertCardAtBackupTop,
    addPrintedCards: addPrintedCards,
    getLooseInventory: getLooseInventory,
    // Card system - NEW LOOT FLOW
    addCard: addCard,              // Main entry point for card loot
    addToHand: addToHand,          // Add to play hand
    getCardHand: getCardHand,
    drawCardsToHand: drawCardsToHand,  // Draw from action buttons to hand
    setCardDrawRate: setCardDrawRate,
    getCardDrawRate: getCardDrawRate,
    // Action button cards management (Gone Rogue mode)
    addToActionButtons: addToActionButtons,
    removeFromActionButtons: removeFromActionButtons,
    getActionButtonCards: getActionButtonCards,
    setActionButtonCards: setActionButtonCards,
    clearActionButtonCards: clearActionButtonCards,
    getActionButtonCapacity: getActionButtonCapacity,
    setActiveItem: setActiveItem,
    getActiveItem: getActiveItem,
    toggleActiveItemToggled: toggleActiveItemToggled,
    clearActiveItem: clearActiveItem,
    consumeActiveItem: consumeActiveItem,
    addCryptos: addCryptos,
    spendCryptos: spendCryptos,
    getCryptos: getCryptos,
    reset: reset,
    requestRogue: requestRogue,
    // Fatigue management
    getFatigue: getFatigue,
    addFatigue: addFatigue,
    reduceFatigue: reduceFatigue,
    resetFatigue: resetFatigue,
    drainSprintFatigue: drainSprintFatigue,
    blockSprintTemporarily: blockSprintTemporarily,
    canSprint: canSprint,
    // Ammo management
    getAmmo: getAmmo,
    useAmmo: useAmmo,
    addAmmo: addAmmo,
    // Consumables management
    getConsumables: getConsumables,
    addConsumable: addConsumable,
    useConsumable: useConsumable,
    getConsumableCount: getConsumableCount,
    // Energy management
    getEnergy: getEnergy,
    useEnergy: useEnergy,
    restoreEnergy: restoreEnergy,
    addEnergy: addEnergy,
    // Focus management
    getFocus: getFocus,
    loseFocus: loseFocus,
    restoreFocus: restoreFocus,
    addFocus: addFocus,
    // Battery management
    getBattery: getBattery,
    useBattery: useBattery,
    rechargeBattery: rechargeBattery,
    // Stability management
    getStability: getStability,
    loseStability: loseStability,
    restoreStability: restoreStability,
    // User data management
    loadUserData: loadUserData,
    // Cooldown tracking
    incrementCombatCounter: incrementCombatCounter,
    incrementFloorCounter: incrementFloorCounter,
    getCombatCount: getCombatCount,
    getFloorCount: getFloorCount,
    // Key counter management (structured counts for UI hooks)
    addKeyCount: addKeyCount,
    removeKeyCount: removeKeyCount,
    getKeyCounts: getKeyCounts,
    getKeyCount: getKeyCount,
    getTotalKeyAmmo: getTotalKeyAmmo,
    rebuildKeyCounts: rebuildKeyCounts
  };
})();
