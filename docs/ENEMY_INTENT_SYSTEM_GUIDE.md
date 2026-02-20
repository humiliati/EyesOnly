# Enemy Intent Display System - Implementation Guide

## Overview

The Enemy Intent Display System implements a Metal Gear Solid-inspired tactical communication channel that allows players to observe, plan, and respond to enemy threats through visual cues. The system translates enemy AI decision-making into expressive face glyphs and weapon icons, creating a bridge between observation and counterplay.

**Status**: ✅ **COMPLETE** - Core system implemented and integrated

**Implementation Date**: 2026-02-18

---

## Design Philosophy

### Core Principles

1. **Observation Rewards Players**
   - Enemy expressions and weapons reveal attack patterns
   - Players who watch can anticipate and counter threats
   - Information advantage through tactical awareness

2. **Tension Through Anticipation**
   - Knowing an enemy is "charging" creates different pressure than unknown threats
   - Face expressions telegraph emotional state and threat level
   - Weapon icons indicate specific attack types

3. **Player Expression**
   - Player's card choices shape their combat avatar's emotional state
   - Feedback loop between deck-building and moment-to-moment gameplay
   - Visual representation of player tactical decisions

---

## Architecture

### Module Structure

```
enemy-intent-system.js (standalone IIFE module)
├── FACE_EXPRESSIONS (13 glyphs)
├── WEAPON_INTENTS (13 weapon types)
├── PLAYER_EMOTIONS (6 emotional states)
├── Core Functions
│   ├── createIntentState()
│   ├── determineExpression()
│   ├── determineWeapon()
│   ├── determineIntentType()
│   ├── onCombatEvent()
│   └── determinePlayerEmotion()
└── Display Functions
    ├── formatIntentDisplay()
    └── getIntentDescription()
```

### Integration Points

1. **gone-rogue.js** - STR combat system integration
2. **index.html** - Script loading order
3. **Future**: str-combat-window.js - Enhanced UI display

---

## Face Expression Catalog

### Expression Glyphs

| Glyph | Name | Emotional State | Threat Level | Typical Context |
|-------|------|-----------------|--------------|-----------------|
| `^_^` | Happy/Calm | Enemy at ease, no immediate threat | Low | Patrolling, unaware |
| `>__<` | Angry/Focused | Enemy noticed something | Medium | Preparing attack |
| `O_O` | Surprised | Enemy caught off-guard | Low | Ambushed, unexpected |
| `X_X` | Dazed/Stunned | Enemy disoriented | None | Weapon jammed |
| `>:(` | Enraged | Enemy lost patience | High | Low HP, desperate |
| `·_·` | Bored/Waiting | Enemy uninterested | Low | Passive stance |
| `¬_¬` | Annoyed | Enemy irritated by player | Medium | Defensive reaction |
| `$_$` | Greedy | Enemy sees opportunity | Medium | Exploitative |
| `@_@` | Confused | Enemy uncertain | Low | Low HP, uncertain |
| `-_-` | Sleeping | Enemy unconscious | None | Very low awareness |
| `o_o` | Alert | Enemy on high alert | High | Defensive, wary |
| `^w^` | Pleased | Enemy enjoying combat | Medium | Confident attack |
| `•_•` | Determined | Enemy focused on objective | Medium | Tactical stance |

### Expression Determination Logic

```javascript
Priority order:
1. Weapon jammed → X_X (Dazed)
2. Awareness ≤ 5 → -_- (Sleeping)
3. HP < 25% → @_@ (Confused)
4. Card type + HP combination:
   - Attack card:
     • HP > 75% → ^w^ (Pleased)
     • HP > 50% → >__< (Angry/Focused)
     • HP ≤ 50% → >:( (Enraged)
   - Defense card:
     • HP < 50% → o_o (Alert)
     • HP ≥ 50% → •_• (Determined)
   - Interrupt card → o_o (Alert)
5. Default by awareness:
   - ≥ 80 → >__< (Angry/Focused)
   - ≥ 50 → •_• (Determined)
   - ≥ 20 → ·_· (Bored)
   - < 20 → ^_^ (Happy/Calm)
```

---

## Weapon Intent Catalog

### Weapon Mappings

| Emoji | Name | Attack Pattern | Damage Type | Card Mapping |
|-------|------|----------------|-------------|--------------|
| 🔫 | Pistol | Standard single-target | Physical | Default attacks |
| 🔫 | SMG | Multi-hit rapid fire | Physical | Burst shots |
| 💣 | Grenade | Area-of-effect | Explosive | Grenade cards |
| 🏹 | Bow | Ranged precision | Physical + status | Bow cards |
| 🪓 | Axe | High single damage | Physical + bleed | Axe/melee |
| 🧪 | Chemical | Status application | Poison/burn | Chemical cards |
| ⚡ | Tazer | Stun chance | Stun + physical | Stun/jam cards |
| 🔪 | Knife | Quick melee | Physical | Knife cards |
| ⛓️ | Grapple | Delayed or set | Varied/stun | Grapple cards |
| 🔦 | Flashlight | Blind chance | Utility | Utility cards |
| 🎯 | Target | Aimed shot | Physical | Shot cards |
| 🔥 | Fire | Burn damage | Fire | Fire/burn cards |
| 🛡️ | Shield | Defensive stance | Defense | Block/shield cards |

### Weapon Determination Logic

```javascript
Card emoji/name matching:
1. Check card.emoji first
   - 🎯 or "shot" → Target
   - 💥 or "burst" → SMG
   - 💣 or "grenade" → Grenade
   - 🔥 or "fire" → Fire
   - 🛡️ or "block" → Shield
   - 🔧 or "jam" → Tazer
   - ⚡ or "stun" → Tazer

2. Fallback to category:
   - ATTACK category → Pistol (default)
   - Other categories → null
```

---

## Intent State Structure

```javascript
{
  expression: {
    glyph: string,          // Visual character (e.g., ">__<")
    name: string,           // Human-readable name
    emotionalState: string, // Description of state
    threatLevel: string     // "low", "medium", "high", "none"
  },
  weapon: {
    emoji: string,          // Weapon icon (e.g., "🎯")
    name: string,           // Weapon name
    attackPattern: string,  // Pattern description
    damageType: string      // Damage classification
  },
  intentType: string,       // "ATTACK", "DEFEND", "INTERRUPT", "REPOSITION", "SETUP", "IDLE"
  damageEstimate: number,   // Expected damage from card
  isCharging: boolean,      // (Reserved for future charging mechanics)
  chargeMultiplier: number, // (Reserved for future charge attacks)
  lastUpdateTime: timestamp // When state was last updated
}
```

---

## Combat Event Transitions

### Event Types and Resulting Expressions

| Event | Expression | Glyph | Logic |
|-------|------------|-------|-------|
| `player_attacked` | Angry/Focused | `>__<` | Player played attack card |
| `player_defended` | Annoyed | `¬_¬` | Player played defense card |
| `took_damage` (HP > 25%) | Surprised | `O_O` | Enemy took damage |
| `took_damage` (HP ≤ 25%) | Enraged | `>:(` | Enemy low HP after damage |
| `weapon_jammed` | Dazed/Stunned | `X_X` | Enemy weapon jammed |
| `card_killed` | Enraged | `>:(` | Player destroyed enemy card |
| `low_health` | Confused | `@_@` | Enemy HP below 25% |
| `ambushed` | Surprised | `O_O` | Player ambushed enemy |
| `preparing_special` | Determined | `•_•` | Enemy charging special |

### Transition Triggers in Code

```javascript
// Initialized on combat entry
enemy.intentState = EnemyIntentSystem.createIntentState(enemy, enemyNextCard);

// Updated after ambush detection
if (_strCombatAdvantage === 'ambush') {
  enemy.intentState.expression = EnemyIntentSystem.onCombatEvent(enemy, 'ambushed');
}

// Updated when enemy takes damage
if (target === _strCombatEnemy) {
  _strCombatEnemy.intentState.expression = EnemyIntentSystem.onCombatEvent(_strCombatEnemy, 'took_damage');
}

// Updated after each combat round
var nextEnemyCard = _getEnemyAICard();
_strCombatEnemy.intentState = EnemyIntentSystem.createIntentState(_strCombatEnemy, nextEnemyCard);
```

---

## Player Emotion System

### Player Emotional States

| Glyph | Name | Description | Trigger Conditions |
|-------|------|-------------|--------------------|
| `>:)` | Aggressive | Attacking aggressively | Multiple attack cards |
| `:\|` | Defensive | In defensive stance | Defense cards, no attacks |
| `•_•` | Tactical | Planning tactically | Interrupt cards |
| `^_^` | Confident | Player confident | Single attack card |
| `>_<` | Desperate | Low on HP | Player HP < 30% |
| `-_-` | Focused | Player focused | Default/no cards |

### Emotion Determination Logic

```javascript
Priority order:
1. Player HP < 30% → >_< (Desperate)
2. Multiple attack cards → >:) (Aggressive)
3. Defense cards only → :| (Defensive)
4. Contains interrupt → •_• (Tactical)
5. Contains attack → ^_^ (Confident)
6. Default → -_- (Focused)
```

**Note**: Player emotion system is implemented but not yet integrated into UI. Ready for future enhancement.

---

## UI Display Integration

### Combat UI Header Display

**Location**: `gone-rogue.js`, line 5201

```
───────────────────────────────────────
PLAYER HP: 10/10 ❤️   |   ENEMY HP: 5/5 💀  >__< 🎯
Advantage: NEUTRAL 🤝
───────────────────────────────────────
```

**Format**: `[Expression Glyph] [Weapon Emoji]`

**Implementation**:
```javascript
var intentDisplay = '';
if (typeof EnemyIntentSystem !== 'undefined' && _strCombatEnemy.intentState) {
  intentDisplay = '  ' + EnemyIntentSystem.formatIntentDisplay(_strCombatEnemy.intentState);
}
lines.push('PLAYER HP: ' + _player.hp + '/' + _player.maxHp + ' ❤️   |   ENEMY HP: ' + _strCombatEnemy.hp + '/5 💀' + intentDisplay);
```

### Combat Action Log Display

**Location**: `gone-rogue.js`, line 4539

```
⚔️  ATTACK — ENEMY [>__<]: 🎯 Single Shot
├─ HIT! (Roll: 75 vs 60)
├─ Damage: 5
└─ Final: 5 damage → Target HP: 5/10
```

**Format**: `[Priority] — ENEMY [Expression]: [Weapon] [Card Name]`

**Implementation**:
```javascript
var expressionGlyph = '';
if (action.actor === 'enemy' && typeof EnemyIntentSystem !== 'undefined' && _strCombatEnemy.intentState) {
  expressionGlyph = ' [' + _strCombatEnemy.intentState.expression.glyph + ']';
}
lines.push(priorityLabel + ' — ' + actorName + expressionGlyph + ': ' + card.emoji + ' ' + card.name);
```

---

## API Reference

### Core Functions

#### `createIntentState(enemy, card)`
Creates a complete intent state object for an enemy.

**Parameters**:
- `enemy` (Object) - Enemy object with hp, maxHp, awareness, weaponJammed
- `card` (Object) - Card the enemy will play (optional)

**Returns**: Intent state object

**Example**:
```javascript
var enemy = { hp: 3, maxHp: 5, awareness: 60, weaponJammed: false };
var card = { category: 'ATTACK', emoji: '🎯', name: 'Single Shot', stats: { damage: 3 } };
var intentState = EnemyIntentSystem.createIntentState(enemy, card);
// intentState.expression.glyph → ">__<"
// intentState.weapon.emoji → "🎯"
// intentState.intentType → "ATTACK"
```

#### `determineExpression(enemy, card)`
Determines appropriate face expression based on enemy state and card type.

**Parameters**:
- `enemy` (Object) - Enemy object
- `card` (Object) - Card to play (optional)

**Returns**: Expression object from FACE_EXPRESSIONS

**Example**:
```javascript
var enemy = { hp: 1, maxHp: 5, awareness: 50, weaponJammed: false };
var expression = EnemyIntentSystem.determineExpression(enemy, null);
// expression.glyph → "@_@" (Confused due to low HP)
```

#### `determineWeapon(card)`
Maps a card to its corresponding weapon intent.

**Parameters**:
- `card` (Object) - Card with emoji, name, category

**Returns**: Weapon object from WEAPON_INTENTS or null

**Example**:
```javascript
var card = { emoji: '💣', name: 'Grenade', category: 'ATTACK' };
var weapon = EnemyIntentSystem.determineWeapon(card);
// weapon.emoji → "💣"
// weapon.name → "Grenade"
```

#### `determineIntentType(card)`
Determines intent category from card.

**Parameters**:
- `card` (Object) - Card with category

**Returns**: String - "ATTACK", "DEFEND", "INTERRUPT", "REPOSITION", "SETUP", or "IDLE"

#### `onCombatEvent(enemy, eventType, context)`
Determines new expression based on combat event.

**Parameters**:
- `enemy` (Object) - Enemy object
- `eventType` (String) - Event type (see Combat Event Transitions)
- `context` (Object) - Additional event data (optional)

**Returns**: Expression object

**Example**:
```javascript
var enemy = { hp: 2, maxHp: 5, awareness: 50, weaponJammed: false };
var expression = EnemyIntentSystem.onCombatEvent(enemy, 'took_damage');
// expression.glyph → ">:(" (Enraged due to low HP after damage)
```

#### `determinePlayerEmotion(cards, player)`
Determines player emotional state from selected cards.

**Parameters**:
- `cards` (Array) - Array of card objects
- `player` (Object) - Player object with hp, maxHp

**Returns**: Player emotion object

**Example**:
```javascript
var cards = [{ category: 'ATTACK' }, { category: 'ATTACK' }];
var player = { hp: 10, maxHp: 10 };
var emotion = EnemyIntentSystem.determinePlayerEmotion(cards, player);
// emotion.glyph → ">:)" (Aggressive)
```

### Display Functions

#### `formatIntentDisplay(intentState)`
Formats intent state for compact UI display.

**Parameters**:
- `intentState` (Object) - Intent state object

**Returns**: String - Formatted display (e.g., ">__< 🎯")

**Example**:
```javascript
var display = EnemyIntentSystem.formatIntentDisplay(intentState);
// Returns: ">__< 🎯"
```

#### `getIntentDescription(intentState)`
Generates full detailed description of intent state.

**Parameters**:
- `intentState` (Object) - Intent state object

**Returns**: String - Multi-line description

**Example**:
```javascript
var description = EnemyIntentSystem.getIntentDescription(intentState);
// Returns:
// "Emotion: Angry/Focused
//  State: Enemy noticed something
//  Threat: MEDIUM
//
//  Weapon: Target
//  Pattern: Aimed shot
//  Est. Damage: ~5"
```

---

## Testing

### Test Suite

**Location**: `/public/tests/test-enemy-intent-system.html`

**Test Coverage**: 15 test groups, 60+ individual assertions

1. Module Availability
2. Face Expression Catalog
3. Weapon Intent Catalog
4. Intent State Creation
5. Expression Determination - Weapon Jammed
6. Expression Determination - Low Awareness
7. Expression Determination - Low HP
8. Expression Determination - Attack Card
9. Expression Determination - Defense Card
10. Weapon Determination
11. Intent Type Determination
12. Combat Event Transitions
13. Player Emotion System
14. Display Formatting
15. Expression Threat Levels

**Running Tests**:
```
Open: http://localhost:3000/tests/test-enemy-intent-system.html
Expected: 100% pass rate (60/60 tests)
```

---

## Future Enhancements

### Planned Features

1. **STR Combat Window Integration**
   - Visual face/weapon display in combat popup
   - Animated expression transitions
   - Intent preview before round resolution

2. **Charging Attack System**
   - `isCharging` flag utilization
   - `chargeMultiplier` damage scaling
   - Charging animation states

3. **Player Avatar Display**
   - Show player emotion in UI
   - Emotion-based card glow effects
   - Emotion history tracking

4. **Advanced Intent Patterns**
   - Multi-turn intent sequences
   - Boss-specific intent behaviors
   - Elite enemy special intents

5. **Tooltip System**
   - Hover over intent display for details
   - Threat level explanations
   - Attack pattern hints

6. **Accessibility**
   - Color coding for threat levels
   - Audio cues for intent changes
   - High contrast mode support

---

## Performance Notes

- All intent calculations are O(1)
- No performance impact on combat resolution
- Intent state stored on enemy object (no global state)
- Minimal memory footprint (~1KB per enemy)

---

## Known Limitations

1. **No Animation**: Transitions are instant (future enhancement)
2. **Text-Only**: No graphical facial animations (by design)
3. **Single Enemy**: Only tracks active combat enemy (not spectators)
4. **Player Emotion**: Not yet displayed in UI (implemented but unused)

---

## Troubleshooting

### Intent Not Displaying

**Symptom**: No expression/weapon shown in combat UI

**Checks**:
1. Verify `enemy-intent-system.js` loaded before `gone-rogue.js`
2. Check browser console for errors
3. Verify `EnemyIntentSystem` exists: `typeof EnemyIntentSystem !== 'undefined'`
4. Check enemy has `intentState` property after combat entry

### Wrong Expression

**Symptom**: Expression doesn't match expected behavior

**Debug**:
```javascript
console.log('Enemy state:', _strCombatEnemy);
console.log('Intent state:', _strCombatEnemy.intentState);
console.log('HP:', _strCombatEnemy.hp, '/', _strCombatEnemy.maxHp);
console.log('Awareness:', _strCombatEnemy.awareness);
console.log('Jammed:', _strCombatEnemy.weaponJammed);
```

### Intent Not Updating

**Symptom**: Expression stays same throughout combat

**Fix**: Ensure intent update code runs after each round (lines 4406-4410, 4502-4506)

---

## Code Checklist

- ✅ `public/js/enemy-intent-system.js` (597 lines) - NEW
- ✅ `public/js/gone-rogue.js` - MODIFIED
  - Intent initialization (line 4173-4177)
  - Ambush reaction (line 4187-4190)
  - Combat UI display (line 5195-5199, 5201)
  - Action log display (line 4533-4537, 4539)
  - Damage expression update (line 4708-4711)
  - Round-end intent update (line 4406-4410, 4502-4506)
- ✅ `public/index.html` - MODIFIED
  - Script loading (line 229)
- ✅ `public/tests/test-enemy-intent-system.html` (650 lines) - NEW

---

## Commit History

1. **Implement core enemy intent display system** (016f358)
   - Created enemy-intent-system.js module
   - Integrated with gone-rogue.js combat system
   - Added intent display to UI
   - Added expression transitions on events

---

## References

### Design Inspiration

- **Metal Gear Solid**: Enemy alert states, observation-based gameplay
- **Slay the Spire**: Enemy intent indicators, turn-based tactical feedback
- **Into the Breach**: Enemy action preview, perfect information gameplay

### Related Systems

- STR Combat System (`gone-rogue.js`)
- Card System (`card-system.js`)
- Combat Window (`str-combat-window.js`)
- Enemy AI (`_getEnemyAICard()` in `gone-rogue.js`)

---

## Conclusion

The Enemy Intent Display System successfully implements a Metal Gear Solid-inspired tactical feedback mechanism that:

✅ Provides clear visual communication of enemy intentions
✅ Rewards player observation with actionable information
✅ Creates tension through anticipation
✅ Maintains ASCII-emoji aesthetic consistency
✅ Integrates seamlessly with existing STR combat
✅ Supports future enhancements (charging, animations, tooltips)

The system is production-ready and fully functional. Future work can focus on enhanced visual presentation and player emotion UI integration.

---

*Document last updated: 2026-02-18*
*Implementation by: Claude Sonnet 4.5*
