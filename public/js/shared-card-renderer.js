/* ============================================================
   EYES ONLY - Shared Card Renderer
   Extracted from HandFanComponent for reuse in NCH and STR Combat.
   ============================================================ */

var SharedCardRenderer = (function() {
  'use strict';

  var QUALITY_COLORS = {
    'cracked': '#666',
    'worn': '#999',
    'standard': '#fff',
    'fine': '#4fc3f7',
    'superior': '#ffeb3b',
    'elite': '#ff9800',
    'masterwork': '#ffd700',
    'near_perfect': '#8bc34a',
    'perfect': '#9c27b0'
  };

  var LIFECYCLE_MAP = {
    'disposable': 'consumable',
    'LIFE_001': 'consumable',
    'exhaust': 'exhaust',
    'LIFE_002': 'exhaust',
    'power': 'power',
    'LIFE_003': 'power',
    'gated': 'gated',
    'LIFE_004': 'gated',
    'persistent': 'core',
    'LIFE_005': 'core',
    'core': 'core'
  };

  /**
   * Get lifecycle CSS class for a card.
   * @param {Object} card
   * @returns {string} One of: consumable, exhaust, power, gated, core
   */
  function getCardLifecycle(card) {
    var lifecycle = (card && (card.lifecycleType || card.lifecycle || card.consumable)) || 'core';
    return LIFECYCLE_MAP[lifecycle] || 'core';
  }

  /**
   * Get quality border color.
   * @param {string} quality
   * @returns {string} CSS color
   */
  function getQualityBorderColor(quality) {
    if (!quality) return '#fff';
    var key = quality.toLowerCase().replace(/ /g, '_');
    return QUALITY_COLORS[key] || '#fff';
  }

  /**
   * Abbreviate card name (vowel-drop). Fallback if NameUtils unavailable.
   * @param {string} name
   * @param {number} [maxLength]
   * @returns {string}
   */
  function abbreviateCardName(name, maxLength) {
    if (!name) return '';
    var words = name.split(/\s+/);
    var result = '';
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (word.length === 0) continue;
      result += word.charAt(0);
      for (var j = 1; j < word.length; j++) {
        var ch = word.charAt(j);
        var lower = ch.toLowerCase();
        if (lower !== 'a' && lower !== 'e' && lower !== 'i' && lower !== 'o' && lower !== 'u') {
          result += ch;
        }
      }
    }
    return maxLength ? result.substring(0, maxLength) : result;
  }

  /**
   * Validate if player can afford a card.
   * @param {Object} card
   * @returns {{canAfford: boolean, missingResources: Array}}
   */
  function validateCardAffordability(card) {
    if (typeof ResourceManager === 'undefined') {
      return { canAfford: true, missingResources: [] };
    }
    return ResourceManager.canAffordCard(card);
  }

  /**
   * Format resource shortage for display.
   * @param {Array} missingResources
   * @returns {string}
   */
  function formatResourceShortage(missingResources) {
    if (!missingResources || missingResources.length === 0) return '';
    var parts = missingResources.map(function(r) {
      var resourceName = r.resource.charAt(0).toUpperCase() + r.resource.slice(1);
      return resourceName + ' (' + r.current + '/' + r.needed + ')';
    });
    return 'Insufficient ' + parts.join(', ');
  }

  /**
   * Build a single card DOM element.
   *
   * context values:
   *   'combat'     — STR combat hand (120×168px, full fan)
   *   'nch-hand'   — NCH equipped hand (120×168px, horizontal row)
   *   'nch-backup' — NCH backup deck scroll (100×140px, flat)
   *   'nch-vault'  — NCH inventory vault (small, portrait preview)
   *
   * @param {Object} card - Card data object (from GoneRogueDataRegistry or ref)
   * @param {number} index - Position index
   * @param {string} [context='combat'] - Rendering context
   * @returns {HTMLElement} .hand-card-wrapper element
   */
  function createCardElement(card, index, context) {
    context = context || 'combat';
    card = card || {};

    var wrapper = document.createElement('div');
    wrapper.className = 'hand-card-wrapper';
    if (context !== 'combat') {
      wrapper.classList.add('hand-card-wrapper-' + context);
    }
    wrapper.dataset.cardIndex = index;

    var cardEl = document.createElement('div');
    cardEl.className = 'hand-card';

    // BLVCK identity class — universal "nothing" card gets unique styling
    var isBlvck = card.id === 'ACT-000' || card.name === 'BLVCK';
    if (isBlvck) {
      cardEl.classList.add('hand-card-blvck');
    }

    // Unaffordable cards get BLVCK-frame treatment (keep emoji/title, copy frame styling)
    // Only applies during STR combat to non-BLVCK cards the player can't afford
    if (!isBlvck && card.costs && Array.isArray(card.costs) && card.costs.length > 0) {
      var _canAfford = true;
      if (typeof CardStateAuthority !== 'undefined' && typeof CardStateAuthority.canAffordCard === 'function') {
        _canAfford = CardStateAuthority.canAffordCard(card);
      } else if (typeof CostPrinterSystem !== 'undefined' && typeof CostPrinterSystem.canAffordCosts === 'function') {
        var _aff = CostPrinterSystem.canAffordCosts(card.costs);
        _canAfford = _aff.canAfford;
      }
      if (!_canAfford) {
        cardEl.classList.add('hand-card-unaffordable');
      }
    }

    // Lifecycle transparency
    var lifecycle = getCardLifecycle(card);
    cardEl.classList.add('hand-card-' + lifecycle);

    // Quality border
    if (card.quality || card.qualityName) {
      var quality = (card.quality || card.qualityName).toLowerCase().replace(/ /g, '_');
      cardEl.dataset.quality = quality;
    }

    // Resource spend color (for background tint via CSS)
    var costResource = card.costResource || card.resource || card.spendResource || '';
    if (costResource) {
      cardEl.dataset.resource = costResource.toLowerCase();
    }

    // Card type for emoji header glow (offensive/defensive/environmental)
    var cardType = card.type || card.cardType || '';
    if (cardType) {
      cardEl.dataset.cardType = cardType.toLowerCase();
    }

    // Resource validation (optional — skip for vault/backup preview)
    if (context === 'combat' || context === 'nch-hand') {
      var affordability = validateCardAffordability(card);
      if (!affordability.canAfford) {
        cardEl.classList.add('card-insufficient-resources');
        cardEl.dataset.unaffordable = 'true';
        if (affordability.missingResources && affordability.missingResources.length > 0) {
          var shortageText = formatResourceShortage(affordability.missingResources);
          cardEl.dataset.resourceShortage = shortageText;
          cardEl.title = shortageText;
        }
      }
    }

    // Card content HTML
    var html = '';

    // Cost badge
    if (card.cost !== undefined && card.cost !== null) {
      html += '<div class="hand-card-cost">' + card.cost + '</div>';
    }

    // Artwork / emoji
    html += '<div class="hand-card-artwork">';
    html += '<div class="hand-card-emoji">' + (card.emoji || '🃏') + '</div>';
    html += '</div>';

    // Card name
    var cardName = card.name || 'Unknown Card';
    var maxLen = 0;
    // Abbreviate in compact contexts
    if (context === 'nch-backup' || context === 'nch-vault') {
      maxLen = 8;
    }
    try {
      var isPortrait = (window && window.innerHeight && window.innerWidth) ? (window.innerHeight > window.innerWidth) : false;
      if (isPortrait && (context === 'nch-backup')) {
        maxLen = 4;
      }
    } catch (e) {}

    if (typeof NameUtils !== 'undefined' && NameUtils.getDisplayName) {
      cardName = NameUtils.getDisplayName(card, { maxLength: maxLen });
    } else if (maxLen > 0) {
      cardName = abbreviateCardName(cardName, maxLen);
    }

    // Passive effect emoji rows (between artwork and name)
    var aggressiveEmojis = [];
    var selfEmojis = [];
    if (card.passiveEffects && card.passiveEffects.length > 0) {
      for (var pe = 0; pe < card.passiveEffects.length; pe++) {
        var eff = card.passiveEffects[pe];
        if (eff.target === 'enemy' || eff.target === 'aggressive') {
          aggressiveEmojis.push(eff.emoji || '⚔️');
        } else if (eff.target === 'self' || eff.target === 'self-inflicted') {
          selfEmojis.push(eff.emoji || '💔');
        }
      }
    }
    // Also check tags for common passive indicators
    if (card.tags) {
      var tagArr = card.tags;
      for (var ti = 0; ti < tagArr.length; ti++) {
        var tag = tagArr[ti];
        if (tag === 'burn' || tag === 'poison' || tag === 'bleed') aggressiveEmojis.push({burn:'🔥',poison:'☠️',bleed:'💥'}[tag]);
        if (tag === 'recoil' || tag === 'fatigue_cost') selfEmojis.push({recoil:'❤️‍🔥',fatigue_cost:'📉'}[tag]);
      }
    }

    if (aggressiveEmojis.length > 0 || selfEmojis.length > 0) {
      html += '<div class="hand-card-passives">';
      if (aggressiveEmojis.length > 0) {
        html += '<div class="hand-card-passive-row passive-aggressive">';
        for (var ae = 0; ae < aggressiveEmojis.length && ae < 4; ae++) {
          html += '<span class="hand-card-passive-emoji">' + aggressiveEmojis[ae] + '</span>';
        }
        html += '</div>';
      }
      if (selfEmojis.length > 0) {
        html += '<div class="hand-card-passive-row passive-self">';
        for (var se = 0; se < selfEmojis.length && se < 4; se++) {
          html += '<span class="hand-card-passive-emoji">' + selfEmojis[se] + '</span>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    html += '<div class="hand-card-name">' + cardName + '</div>';

    // Effect icons (legacy)
    if (card.effects && card.effects.length > 0) {
      html += '<div class="hand-card-effects">';
      var effects = card.effects.slice(0, 3);
      for (var i = 0; i < effects.length; i++) {
        html += '<span class="hand-card-effect-icon">' + (effects[i].icon || '•') + '</span>';
      }
      html += '</div>';
    }

    cardEl.innerHTML = html;
    wrapper.appendChild(cardEl);
    return wrapper;
  }

  /**
   * Apply fan transform to a card wrapper.
   *
   * opts:
   *   maxRotation  — default 8 (degrees)
   *   maxVertical  — default 15 (px)
   *   overlapPct   — default 30 (percent)
   *   baseWidth    — default 120 (px)
   *   flat         — if true, no rotation/vertical offset (for backup scroll)
   *
   * @param {HTMLElement} wrapper
   * @param {number} index
   * @param {number} total
   * @param {Object} [opts]
   */
  function applyFanTransform(wrapper, index, total, opts) {
    opts = opts || {};
    var flat = !!opts.flat;
    var maxRotation = opts.maxRotation !== undefined ? opts.maxRotation : 8;
    var maxVertical = opts.maxVertical !== undefined ? opts.maxVertical : 15;
    var overlapPct = opts.overlapPct !== undefined ? opts.overlapPct : 30;
    var baseWidth = opts.baseWidth !== undefined ? opts.baseWidth : 120;

    if (flat || total <= 1) {
      // Flat layout: no rotation, no arc, just overlap
      var flatOverlap = baseWidth * (overlapPct / 100);
      wrapper.style.setProperty('--fan-ty', '0px');
      wrapper.style.setProperty('--fan-rot', '0deg');
      wrapper.style.transform = 'translateY(0) rotate(0deg)';
      wrapper.style.marginLeft = (index === 0 ? 0 : -flatOverlap) + 'px';
      wrapper.style.zIndex = String(index);
      return;
    }

    var centerIndex = (total - 1) / 2;
    var offset = index - centerIndex;

    var rotation = centerIndex > 0 ? offset * (maxRotation / centerIndex) : 0;
    var verticalOffset = centerIndex > 0 ? Math.abs(offset) * (maxVertical / centerIndex) : 0;
    var overlapWidth = baseWidth * (overlapPct / 100);
    var zIndex = 100 - Math.abs(offset * 10);

    wrapper.style.setProperty('--fan-ty', String(verticalOffset) + 'px');
    wrapper.style.setProperty('--fan-rot', String(rotation) + 'deg');
    wrapper.style.transform = 'translateY(' + verticalOffset + 'px) rotate(' + rotation + 'deg)';
    wrapper.style.marginLeft = (index === 0 ? 0 : -overlapWidth) + 'px';
    wrapper.style.zIndex = String(zIndex);
  }

  /**
   * Build a tooltip HTML string for a card.
   * @param {Object} card
   * @returns {string} innerHTML for tooltip
   */
  function buildTooltipHtml(card) {
    if (!card) return '';
    var html = '<div class="tooltip-title">' + (card.name || 'Unknown Card') + '</div>';
    if (card.description) {
      html += '<div class="tooltip-description">' + card.description + '</div>';
    }
    html += '<div class="tooltip-stats">';
    if (card.cost !== undefined) {
      html += '<div class="tooltip-stat">Cost: <span>' + card.cost + '</span></div>';
    }
    if (card.damage !== undefined) {
      html += '<div class="tooltip-stat">Damage: <span>' + card.damage + '</span></div>';
    }
    if (card.qualityName) {
      html += '<div class="tooltip-stat">Quality: <span>' + card.qualityName + '</span></div>';
    }
    html += '</div>';
    return html;
  }

  return {
    createCardElement: createCardElement,
    getCardLifecycle: getCardLifecycle,
    getQualityBorderColor: getQualityBorderColor,
    abbreviateCardName: abbreviateCardName,
    validateCardAffordability: validateCardAffordability,
    formatResourceShortage: formatResourceShortage,
    applyFanTransform: applyFanTransform,
    buildTooltipHtml: buildTooltipHtml,
    QUALITY_COLORS: QUALITY_COLORS,
    LIFECYCLE_MAP: LIFECYCLE_MAP
  };
})();
