/* ============================================================
   EYES ONLY - Shared Item Renderer (v1.0)
   Data resolver for items + cards. Consumed by all renderers:
   RogueSidebar, NonCombatHUD, BackupActionContainer,
   GoneRogueMobile (inventory, equip, cards).

   NOT a DOM builder — each renderer creates its own elements.
   This module eliminates the duplicated lookup/fallback logic
   that was copy-pasted across 6 render paths.

   Parallels SharedCardRenderer for cards.
   ============================================================ */

var SharedItemRenderer = (function() {
  'use strict';

  // ── Rarity color palette ──

  var RARITY_COLORS = {
    'common':    '#c8c8c8',
    'uncommon':  '#4fc3f7',
    'rare':      '#ffeb3b',
    'epic':      '#ff9800',
    'legendary': '#ffd700'
  };

  // ── Core resolver ──

  /**
   * Resolve item/card data from an inventory ref.
   * Handles the full lookup → _missing check → meta override → fallback chain
   * that every renderer was duplicating inline.
   *
   * @param {Object} ref - Inventory ref { id, qty, meta? } or null
   * @param {Object} [opts] - Options
   * @param {number} [opts.maxNameLength] - Truncate displayName to this length (0 = full)
   * @returns {Object} Resolved data:
   *   { id, emoji, name, displayName, isItem, isCard, equipSlot, rarity,
   *     type, effects, isMissing, def }
   */
  function resolve(ref, opts) {
    opts = opts || {};
    var maxLen = opts.maxNameLength || 0;

    // Null / empty ref
    if (!ref || !ref.id) {
      return _empty();
    }

    var id = ref.id;
    var isItem = (id.indexOf('ITM-') === 0);
    var isCiInstance = (id.indexOf('CI-') === 0);
    var isCard = (id.indexOf('ACT-') === 0 || id.indexOf('EATK-') === 0 || isCiInstance);
    var def = null;

    // CHH Step 2: CI-* instances resolve via hydrateCard (CardStateAuthority)
    if (isCiInstance && typeof CardStateAuthority !== 'undefined' && CardStateAuthority.hydrateCard) {
      def = CardStateAuthority.hydrateCard(ref);
    }

    // Primary lookup: try item registry first, then card
    if (!def && typeof GoneRogueDataRegistry !== 'undefined') {
      if (isItem && GoneRogueDataRegistry.getItem) {
        def = GoneRogueDataRegistry.getItem(id);
      } else if (GoneRogueDataRegistry.getCard) {
        def = GoneRogueDataRegistry.getCard(id);
      }
      // If first lookup missed, try the other
      if ((!def || def._missing) && !isItem && GoneRogueDataRegistry.getItem) {
        var altDef = GoneRogueDataRegistry.getItem(id);
        if (altDef && !altDef._missing) { def = altDef; isItem = true; isCard = false; }
      }
    }

    // _missing stub → treat as null
    if (def && def._missing) def = null;

    // Extract fields with fallbacks
    var emoji = (def && def.emoji) ? def.emoji : (isItem ? '📦' : '🃏');
    var name  = (def && def.name)  ? def.name  : id;

    // Meta overrides (migrated legacy items carry name/emoji in ref.meta)
    if (ref.meta) {
      if (ref.meta.legacyName && (!def || def._missing)) name = ref.meta.legacyName;
      if (ref.meta.emoji && (!def || def._missing))      emoji = ref.meta.emoji;
    }

    var displayName = maxLen ? abbreviateName(name, maxLen) : name;

    return {
      id:          id,
      emoji:       emoji,
      name:        name,
      displayName: displayName,
      isItem:      isItem,
      isCard:      isCard || (!isItem),
      equipSlot:   (def && def.equipSlot) || 'none',
      rarity:      (def && def.rarity) || 'common',
      type:        (def && def.type) || null,
      effects:     (def && Array.isArray(def.effects)) ? def.effects : [],
      isMissing:   !def,
      def:         def   // full definition for callers that need deep fields
    };
  }

  function _empty() {
    return {
      id: null, emoji: '📦', name: '[Empty]', displayName: '—',
      isItem: true, isCard: false, equipSlot: 'none', rarity: 'common',
      type: null, effects: [], isMissing: true, def: null
    };
  }

  // ── Name abbreviation (vowel-drop) ──

  /**
   * Abbreviate a name by dropping interior vowels.
   * "Blacksmith's Hammer" → "Blcksmth's Hmmr" (then truncated to maxLength)
   * @param {string} name
   * @param {number} [maxLength] - Hard cut after abbreviation (0 = no cut)
   * @returns {string}
   */
  function abbreviateName(name, maxLength) {
    if (!name) return '';
    if (maxLength && name.length <= maxLength) return name;

    // Drop interior vowels per word
    var words = name.split(/\s+/);
    var abbreviated = [];
    for (var w = 0; w < words.length; w++) {
      var word = words[w];
      if (word.length <= 2) { abbreviated.push(word); continue; }
      var out = word.charAt(0);
      for (var c = 1; c < word.length; c++) {
        var ch = word.charAt(c).toLowerCase();
        if (ch !== 'a' && ch !== 'e' && ch !== 'i' && ch !== 'o' && ch !== 'u') {
          out += word.charAt(c);
        }
      }
      abbreviated.push(out);
    }
    var result = abbreviated.join(' ');
    return (maxLength && result.length > maxLength) ? result.substring(0, maxLength) : result;
  }

  // ── Rarity color ──

  /**
   * @param {string} rarity - common/uncommon/rare/epic/legendary
   * @returns {string} CSS color
   */
  function getRarityColor(rarity) {
    if (!rarity) return RARITY_COLORS.common;
    return RARITY_COLORS[rarity.toLowerCase()] || RARITY_COLORS.common;
  }

  // ── Tooltip builder ──

  /**
   * Build HTML string for item tooltip popup.
   * @param {Object} def - Full item definition (from resolve().def or registry)
   * @returns {string} innerHTML
   */
  function buildTooltipHtml(def) {
    if (!def) return '';
    var h = '<div class="sir-tooltip">';
    h += '<div class="sir-tooltip-name" style="color:' + getRarityColor(def.rarity) + ';">';
    h += (def.emoji || '') + ' ' + (def.name || 'Unknown');
    h += '</div>';
    if (def.description) {
      h += '<div class="sir-tooltip-desc">' + def.description + '</div>';
    }
    var tags = [];
    if (def.rarity) tags.push(def.rarity);
    if (def.type) tags.push(def.type);
    if (def.equipSlot && def.equipSlot !== 'none') tags.push('slot: ' + def.equipSlot);
    if (def.tier) tags.push('tier ' + def.tier);
    if (tags.length) {
      h += '<div class="sir-tooltip-tags">' + tags.join(' · ') + '</div>';
    }
    h += '</div>';
    return h;
  }

  // ── Public API ──

  return {
    resolve:        resolve,
    abbreviateName: abbreviateName,
    getRarityColor: getRarityColor,
    buildTooltipHtml: buildTooltipHtml,
    RARITY_COLORS:  RARITY_COLORS
  };
})();
