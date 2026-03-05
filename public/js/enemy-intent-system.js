/* ============================================================
   EYES ONLY - Enemy Intent Display System
   Metal Gear Solid-inspired tactical communication
   ============================================================ */

var EnemyIntentSystem = (function() {
  'use strict';

  // ============================================================
  // FACE EXPRESSION GLYPHS
  // ============================================================

  var FACE_EXPRESSIONS = {
    HAPPY_CALM: {
      glyph: '^_^',
      frames: ['^_^', '^___^'],
      name: 'Happy/Calm',
      emotionalState: 'Enemy at ease, no immediate threat',
      threatLevel: 'low'
    },
    ANGRY_FOCUSED: {
      glyph: '>__<',
      frames: ['>__<', '>_<'],
      name: 'Angry/Focused',
      emotionalState: 'Enemy noticed something',
      threatLevel: 'medium'
    },
    SURPRISED: {
      glyph: 'O_O',
      frames: ['O_O', 'o_o'],
      name: 'Surprised',
      emotionalState: 'Enemy caught off-guard',
      threatLevel: 'low'
    },
    DAZED_STUNNED: {
      glyph: 'X_X',
      frames: ['X_X', 'x_x'],
      name: 'Dazed/Stunned',
      emotionalState: 'Enemy disoriented',
      threatLevel: 'none'
    },
    ENRAGED: {
      glyph: '>:(',
      frames: ['>:(', '>:<'],
      name: 'Enraged',
      emotionalState: 'Enemy lost patience',
      threatLevel: 'high'
    },
    BORED_WAITING: {
      glyph: '·_·',
      frames: ['·_·', '·__·'],
      name: 'Bored/Waiting',
      emotionalState: 'Enemy uninterested',
      threatLevel: 'low'
    },
    ANNOYED: {
      glyph: '¬_¬',
      frames: ['¬_¬', '¬__¬'],
      name: 'Annoyed',
      emotionalState: 'Enemy irritated by player',
      threatLevel: 'medium'
    },
    GREEDY: {
      glyph: '$_$',
      frames: ['$_$', '$__$'],
      name: 'Greedy/Opportunistic',
      emotionalState: 'Enemy sees opportunity',
      threatLevel: 'medium'
    },
    CONFUSED: {
      glyph: '@_@',
      frames: ['@_@', '@__@'],
      name: 'Confused',
      emotionalState: 'Enemy uncertain',
      threatLevel: 'low'
    },
    SLEEPING: {
      glyph: '-_-',
      frames: ['-_-', '-__-'],
      name: 'Sleeping',
      emotionalState: 'Enemy unconscious',
      threatLevel: 'none'
    },
    ALERT: {
      glyph: 'o_o',
      frames: ['o_o', 'O_O'],
      name: 'Alert',
      emotionalState: 'Enemy on high alert',
      threatLevel: 'high'
    },
    PLEASED: {
      glyph: '^w^',
      frames: ['^w^', '^_ ^'],
      name: 'Pleased',
      emotionalState: 'Enemy enjoying combat',
      threatLevel: 'medium'
    },
    DETERMINED: {
      glyph: '•_•',
      frames: ['•_•', '•__•'],
      name: 'Determined',
      emotionalState: 'Enemy focused on objective',
      threatLevel: 'medium'
    }
  };

  // ============================================================
  // WEAPON INTENT MAPPING
  // ============================================================

  var WEAPON_INTENTS = {
    PISTOL: {
      emoji: '🔫',
      name: 'Pistol',
      attackPattern: 'Standard single-target',
      damageType: 'Physical'
    },
    SMG: {
      emoji: '🔫',
      name: 'SMG',
      attackPattern: 'Multi-hit rapid fire',
      damageType: 'Physical'
    },
    GRENADE: {
      emoji: '💣',
      name: 'Grenade',
      attackPattern: 'Area-of-effect',
      damageType: 'Explosive'
    },
    BOW: {
      emoji: '🏹',
      name: 'Bow',
      attackPattern: 'Ranged precision',
      damageType: 'Physical + status'
    },
    AXE: {
      emoji: '🪓',
      name: 'Axe',
      attackPattern: 'High single damage',
      damageType: 'Physical + bleed'
    },
    CHEMICAL: {
      emoji: '🧪',
      name: 'Chemical',
      attackPattern: 'Status application',
      damageType: 'Poison/burn'
    },
    TAZER: {
      emoji: '⚡',
      name: 'Tazer',
      attackPattern: 'Stun chance',
      damageType: 'Stun + physical'
    },
    KNIFE: {
      emoji: '🔪',
      name: 'Knife',
      attackPattern: 'Quick melee',
      damageType: 'Physical'
    },
    GRAPPLE: {
      emoji: '⛓️',
      name: 'Grapple',
      attackPattern: 'Delayed or set',
      damageType: 'Varied or stun + physical'
    },
    FLASHLIGHT: {
      emoji: '🔦',
      name: 'Flashlight',
      attackPattern: 'Blind chance',
      damageType: 'Utility'
    },
    TARGET: {
      emoji: '🎯',
      name: 'Target',
      attackPattern: 'Aimed shot',
      damageType: 'Physical'
    },
    FIRE: {
      emoji: '🔥',
      name: 'Fire',
      attackPattern: 'Burn damage',
      damageType: 'Fire'
    },
    SHIELD: {
      emoji: '🛡️',
      name: 'Shield',
      attackPattern: 'Defensive stance',
      damageType: 'Defense'
    }
  };

  // ============================================================
  // INTENT STATE STRUCTURE
  // ============================================================

  /**
   * Create enemy intent state
   * @param {Object} enemy - Enemy object
   * @param {Object} card - Card enemy will play (optional)
   * @returns {Object} Intent state
   */
  function createIntentState(enemy, card) {
    var expression = determineExpression(enemy, card);
    var weapon = determineWeapon(card);
    var intentType = determineIntentType(card);

    // Stable-ish animation seed per enemy
    var seed = 0;
    if (enemy && (typeof enemy.x === 'number') && (typeof enemy.y === 'number')) {
      seed = (enemy.x * 73856093) ^ (enemy.y * 19349663);
    } else {
      seed = Math.floor(Math.random() * 1000000);
    }

    return {
      expression: expression,
      weapon: weapon,
      intentType: intentType,
      damageEstimate: card ? (card.stats.damage || 0) : 0,
      isCharging: false,
      chargeMultiplier: 1.0,
      lastUpdateTime: Date.now(),
      animSeed: seed >>> 0
    };
  }

  // ============================================================
  // EXPRESSION DETERMINATION
  // ============================================================

  /**
   * Determine enemy face expression based on state
   * @param {Object} enemy - Enemy object
   * @param {Object} card - Card enemy will play (optional)
   * @returns {Object} Face expression object
   */
  function determineExpression(enemy, card) {
    // Enemy is stunned or jammed
    if (enemy.weaponJammed) {
      return FACE_EXPRESSIONS.DAZED_STUNNED;
    }

    // Enemy is sleeping/unconscious
    if (enemy.awareness <= 5) {
      return FACE_EXPRESSIONS.SLEEPING;
    }

    // Calculate HP percentage
    var hpPercent = (enemy.hp / (enemy.maxHp || 5)) * 100;

    // Low HP - worried/confused
    if (hpPercent < 25) {
      return FACE_EXPRESSIONS.CONFUSED;
    }

    // Check card type for expression
    if (card) {
      var category = card.category;

      // Aggressive attack cards
      if (category === 'ATTACK' || category === 'CATEGORY_ATTACK') {
        if (hpPercent > 75) {
          return FACE_EXPRESSIONS.PLEASED; // Confident
        } else if (hpPercent > 50) {
          return FACE_EXPRESSIONS.ANGRY_FOCUSED; // Determined
        } else {
          return FACE_EXPRESSIONS.ENRAGED; // Desperate
        }
      }

      // Defensive cards
      if (category === 'DEFENSE' || category === 'CATEGORY_DEFENSE') {
        if (hpPercent < 50) {
          return FACE_EXPRESSIONS.ALERT; // Wary
        } else {
          return FACE_EXPRESSIONS.DETERMINED; // Tactical
        }
      }

      // Interrupt cards (jam, overwatch)
      if (category === 'INTERRUPT' || category === 'CATEGORY_INTERRUPT') {
        return FACE_EXPRESSIONS.ALERT;
      }
    }

    // Default based on awareness level
    if (enemy.awareness >= 80) {
      return FACE_EXPRESSIONS.ANGRY_FOCUSED;
    } else if (enemy.awareness >= 50) {
      return FACE_EXPRESSIONS.DETERMINED;
    } else if (enemy.awareness >= 20) {
      return FACE_EXPRESSIONS.BORED_WAITING;
    } else {
      return FACE_EXPRESSIONS.HAPPY_CALM;
    }
  }

  /**
   * Determine weapon icon from card
   * @param {Object} card - Card object
   * @returns {Object} Weapon intent object or null
   */
  function determineWeapon(card) {
    if (!card) {
      return null;
    }

    var emoji = card.emoji || '';
    var name = (card.name || '').toLowerCase();

    // Map card emoji to weapon intent
    if (emoji === '🎯' || name.includes('shot') || name.includes('shoot')) {
      return WEAPON_INTENTS.TARGET;
    } else if (emoji === '💥' || name.includes('burst')) {
      return WEAPON_INTENTS.SMG;
    } else if (emoji === '💣' || name.includes('grenade') || name.includes('explosive')) {
      return WEAPON_INTENTS.GRENADE;
    } else if (emoji === '🔥' || name.includes('fire') || name.includes('burn')) {
      return WEAPON_INTENTS.FIRE;
    } else if (emoji === '🛡️' || name.includes('block') || name.includes('shield')) {
      return WEAPON_INTENTS.SHIELD;
    } else if (emoji === '🔧' || name.includes('jam')) {
      return WEAPON_INTENTS.TAZER;
    } else if (emoji === '⚡' || name.includes('stun')) {
      return WEAPON_INTENTS.TAZER;
    } else if (name.includes('knife') || name.includes('stab')) {
      return WEAPON_INTENTS.KNIFE;
    }

    // Default to pistol for attack cards
    if (card.category === 'ATTACK' || card.category === 'CATEGORY_ATTACK') {
      return WEAPON_INTENTS.PISTOL;
    }

    return null;
  }

  /**
   * Determine intent type from card category
   * @param {Object} card - Card object
   * @returns {String} Intent type
   */
  function determineIntentType(card) {
    if (!card) {
      return 'IDLE';
    }

    var category = card.category;

    if (category === 'ATTACK' || category === 'CATEGORY_ATTACK') {
      return 'ATTACK';
    } else if (category === 'DEFENSE' || category === 'CATEGORY_DEFENSE') {
      return 'DEFEND';
    } else if (category === 'INTERRUPT' || category === 'CATEGORY_INTERRUPT') {
      return 'INTERRUPT';
    } else if (category === 'MOVEMENT' || category === 'CATEGORY_MOVEMENT') {
      return 'REPOSITION';
    } else {
      return 'SETUP';
    }
  }

  // ============================================================
  // EXPRESSION TRANSITION LOGIC
  // ============================================================

  /**
   * Determine expression change on combat event
   * @param {Object} enemy - Enemy object
   * @param {String} eventType - Event that triggered transition
   * @param {Object} context - Event context data
   * @returns {Object} New expression object
   */
  function onCombatEvent(enemy, eventType, context) {
    context = context || {};

    switch (eventType) {
      case 'player_attacked':
        // Player played attack card
        return FACE_EXPRESSIONS.ANGRY_FOCUSED;

      case 'player_defended':
        // Player played defense card
        return FACE_EXPRESSIONS.ANNOYED;

      case 'took_damage':
        // Enemy took damage
        var hpPercent = (enemy.hp / (enemy.maxHp || 5)) * 100;
        if (hpPercent < 25) {
          return FACE_EXPRESSIONS.ENRAGED;
        } else {
          return FACE_EXPRESSIONS.SURPRISED;
        }

      case 'weapon_jammed':
        // Enemy weapon jammed
        return FACE_EXPRESSIONS.DAZED_STUNNED;

      case 'card_killed':
        // Player destroyed enemy's card
        return FACE_EXPRESSIONS.ENRAGED;

      case 'low_health':
        // Enemy HP below 25%
        return FACE_EXPRESSIONS.CONFUSED;

      case 'ambushed':
        // Player ambushed enemy
        return FACE_EXPRESSIONS.SURPRISED;

      case 'preparing_special':
        // Enemy charging special attack
        return FACE_EXPRESSIONS.DETERMINED;

      default:
        // Return current or default
        return determineExpression(enemy, null);
    }
  }

  // ============================================================
  // PLAYER AVATAR EMOTION SYSTEM
  // ============================================================

  var PLAYER_EMOTIONS = {
    AGGRESSIVE: { glyph: '>:)', description: 'Player attacking aggressively' },
    DEFENSIVE: { glyph: ':|', description: 'Player in defensive stance' },
    TACTICAL: { glyph: '•_•', description: 'Player planning tactically' },
    CONFIDENT: { glyph: '^_^', description: 'Player confident' },
    DESPERATE: { glyph: '>_<', description: 'Player low on HP' },
    FOCUSED: { glyph: '-_-', description: 'Player focused' }
  };

  /**
   * Determine player emotion from selected cards
   * @param {Array} cards - Cards player selected this round
   * @param {Object} player - Player state
   * @returns {Object} Player emotion object
   */
  function determinePlayerEmotion(cards, player) {
    if (!cards || cards.length === 0) {
      return PLAYER_EMOTIONS.FOCUSED;
    }

    var hpPercent = (player.hp / (player.maxHp || 10)) * 100;

    // Low HP - desperate
    if (hpPercent < 30) {
      return PLAYER_EMOTIONS.DESPERATE;
    }

    // Check card composition
    var hasAttack = cards.some(function(c) {
      return c.category === 'ATTACK' || c.category === 'CATEGORY_ATTACK';
    });
    var hasDefense = cards.some(function(c) {
      return c.category === 'DEFENSE' || c.category === 'CATEGORY_DEFENSE';
    });
    var hasInterrupt = cards.some(function(c) {
      return c.category === 'INTERRUPT' || c.category === 'CATEGORY_INTERRUPT';
    });

    // Multiple attacks - aggressive
    if (hasAttack && cards.length > 1) {
      return PLAYER_EMOTIONS.AGGRESSIVE;
    }

    // Defense focus - defensive
    if (hasDefense && !hasAttack) {
      return PLAYER_EMOTIONS.DEFENSIVE;
    }

    // Interrupt - tactical
    if (hasInterrupt) {
      return PLAYER_EMOTIONS.TACTICAL;
    }

    // Single attack - confident
    if (hasAttack) {
      return PLAYER_EMOTIONS.CONFIDENT;
    }

    return PLAYER_EMOTIONS.FOCUSED;
  }

  // ============================================================
  // DISPLAY FORMATTING
  // ============================================================

  /**
   * Format intent display for combat UI
   * @param {Object} intentState - Intent state object
   * @returns {String} Formatted display string
   */
  function _getAnimatedExpressionGlyph(intentState, nowMs) {
    if (!intentState || !intentState.expression) return '';

    var expr = intentState.expression;
    var frames = expr.frames;
    if (!frames || !frames.length) return expr.glyph;

    // Global pulse with slight per-enemy phase offset
    var seed = (intentState.animSeed || 0) % 997;
    var phaseMs = (seed * 17) % 400;
    var t = Math.floor(((nowMs || Date.now()) + phaseMs) / 350);
    var idx = ((t % frames.length) + frames.length) % frames.length;
    return frames[idx] || expr.glyph;
  }

  function formatIntentDisplay(intentState) {
    var parts = [];

    // Add face expression (animated)
    if (intentState.expression) {
      parts.push(_getAnimatedExpressionGlyph(intentState));
    }

    // Add weapon icon
    if (intentState.weapon) {
      parts.push(intentState.weapon.emoji);
    }

    return parts.join(' ');
  }

  /**
   * Get full intent description
   * @param {Object} intentState - Intent state object
   * @returns {String} Full description
   */
  function getIntentDescription(intentState) {
    var lines = [];

    if (intentState.expression) {
      lines.push('Emotion: ' + intentState.expression.name);
      lines.push('State: ' + intentState.expression.emotionalState);
      lines.push('Threat: ' + intentState.expression.threatLevel.toUpperCase());
    }

    if (intentState.weapon) {
      lines.push('');
      lines.push('Weapon: ' + intentState.weapon.name);
      lines.push('Pattern: ' + intentState.weapon.attackPattern);
      if (intentState.damageEstimate > 0) {
        lines.push('Est. Damage: ~' + intentState.damageEstimate);
      }
    }

    return lines.join('\n');
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    // Constants
    FACE_EXPRESSIONS: FACE_EXPRESSIONS,
    WEAPON_INTENTS: WEAPON_INTENTS,
    PLAYER_EMOTIONS: PLAYER_EMOTIONS,

    // Core functions
    createIntentState: createIntentState,
    determineExpression: determineExpression,
    determineWeapon: determineWeapon,
    determineIntentType: determineIntentType,
    onCombatEvent: onCombatEvent,
    determinePlayerEmotion: determinePlayerEmotion,

    // Display functions
    formatIntentDisplay: formatIntentDisplay,
    getIntentDescription: getIntentDescription,
    getAnimatedExpressionGlyph: _getAnimatedExpressionGlyph
  };
})();
