# Loot Table System Documentation

## Overview

The Loot Table System provides centralized configuration and management of all loot drops in Gone Rogue, including enemy drops, breakable item drops, card distributions, and economy settings. This system replaces hardcoded drop rates scattered across multiple JavaScript files with a unified JSON-based configuration that can be edited through a designer-friendly web portal.

## Architecture

### Components

1. **loot-tables.json** - Centralized data file containing all loot configurations
2. **LootTableManager** - JavaScript module for loading and rolling loot
3. **Loot Table Editor** - Web-based designer portal for editing configurations
4. **Test Suite** - Comprehensive tests for validation and distribution analysis

### Data Flow

```
loot-tables.json → LootTableManager.loadLootTables()
                 ↓
         Game Systems Request Loot
                 ↓
    LootTableManager.rollEnemyLoot()
    LootTableManager.rollBreakableLoot()
                 ↓
         Generated Loot Objects
                 ↓
         Spawned in Game World
```

## JSON Schema

### Root Structure

```json
{
  "version": "1.0.0",
  "enemy_loot": { ... },
  "breakable_loot": { ... },
  "item_loot_tables": { ... },
  "card_drop_modifiers": { ... },
  "special_drops": { ... },
  "decay_times": { ... },
  "economy_settings": { ... }
}
```

### Enemy Loot Configuration

Each enemy tier (standard, elite, boss, scout) has:

```json
"standard": {
  "currency": {
    "enabled": true,
    "chance": 1.0,
    "min": 2,
    "max": 8
  },
  "card": {
    "enabled": true,
    "chance": 0.5,
    "quality_weights": {
      "CRACKED": 18,
      "WORN": 22,
      "STANDARD": 25,
      "FINE": 15,
      "SUPERIOR": 10,
      "ELITE": 6,
      "MASTERWORK": 3,
      "NEAR_PERFECT": 0.9,
      "PERFECT": 0.1
    }
  },
  "charm": {
    "enabled": true,
    "chance": 0.3,
    "type": "common"
  },
  "xp": 10
}
```

**Fields:**
- `currency.chance` - Probability of currency drop (0-1)
- `currency.min/max` - Currency amount range
- `card.chance` - Probability of card drop (0-1)
- `card.quality_weights` - Weighted random quality distribution
- `charm.chance` - Probability of charm drop (0-1)
- `xp` - Experience points awarded

### Breakable Loot Configuration

```json
"breakable_loot": {
  "default": {
    "currency": { "chance": 0.7, "min": 1, "max": 5 },
    "ammo": { "chance": 0.6, "min": 1, "max": 2 },
    "item": { "chance": 0.3 }
  },
  "biomes": {
    "COZY_FOREST": {
      "types": {
        "wooden_gate": {
          "hp": 3,
          "drops": ["wood", "coins"],
          "currency_bonus": 0.2,
          "item_chance": 0.4
        }
      }
    }
  }
}
```

**Fields:**
- `default` - Base drop rates for all breakables
- `biomes[].types[]` - Biome-specific breakable definitions
- `currency_bonus` - Additional chance modifier for currency drops
- `item_chance` - Override default item drop chance
- `loot_table` - Reference to specific item loot table

### Item Loot Tables

```json
"item_loot_tables": {
  "toy_loot": [
    {
      "emoji": "🎎",
      "name": "Toy Figure",
      "weight": 50,
      "quantity": 1
    },
    {
      "emoji": "🧸",
      "name": "Rare Toy",
      "weight": 15,
      "quantity": 1
    }
  ]
}
```

**Weighted Random Selection:**
- Higher weight = more likely to drop
- Total weight = sum of all weights
- Roll = random(0, totalWeight)
- Select item where cumulative weight >= roll

### Card Drop Modifiers

```json
"card_drop_modifiers": {
  "combat_source": {
    "player": 1.0,
    "environmental": 0.3
  },
  "floor_scaling": {
    "early_floors": {
      "range": [1, 5],
      "basic_card_weight": 1.5,
      "advanced_card_weight": 0.5
    }
  },
  "biome_weights": {
    "GREY_CAVE": {
      "Silent Shot": 2.0,
      "Prone": 1.5
    }
  }
}
```

**Modifiers:**
- `combat_source` - Multiplier based on kill source (player vs environment)
- `floor_scaling` - Progressive difficulty scaling
- `biome_weights` - Card type preferences per biome

### Economy Settings

```json
"economy_settings": {
  "shop_spawn_chance": 0.18,
  "guaranteed_shop_floor": 6,
  "shop_floors": [10, 16, 22],
  "price_markup": 1.4,
  "starting_currency": 0
}
```

## LootTableManager API

### Loading

```javascript
// Load loot tables (async)
await LootTableManager.loadLootTables();

// Get loaded tables
const tables = LootTableManager.getLootTables();
```

### Rolling Loot

#### Enemy Loot

```javascript
const loot = LootTableManager.rollEnemyLoot('standard', {
  source: 'player',      // 'player' or 'environmental'
  mythicKill: false,     // Boss only
  floorNum: 5           // Current floor
});

// Returns: { currency, cards, items, xp }
```

#### Breakable Loot

```javascript
const loot = LootTableManager.rollBreakableLoot('wooden_gate', 'COZY_FOREST');

// Returns: { currency, ammo, items }
```

#### Item Table Loot

```javascript
const item = LootTableManager.rollFromItemTable('toy_loot');

// Returns: { emoji, name, quantity }
```

### Modifiers

```javascript
// Get card drop modifier
const modifier = LootTableManager.getCardDropModifier('Silent Shot', 'GREY_CAVE', 5);

// Get decay time for item type
const decayTime = LootTableManager.getDecayTime('currency'); // Returns 20

// Get economy settings
const economy = LootTableManager.getEconomySettings();
```

### Management

```javascript
// Validate loot tables
const validation = LootTableManager.validateLootTables(tables);
// Returns: { valid: boolean, errors: [] }

// Export to JSON string
const json = LootTableManager.exportLootTables();

// Import from JSON string
const result = LootTableManager.importLootTables(jsonString);
// Returns: { success: boolean, error: string }

// Update tables
LootTableManager.updateLootTables(newTables);
```

## Designer Portal

### Accessing the Editor

Navigate to: `http://localhost:8787/loot-table-editor.html`

### Features

#### Overview Tab
- System statistics (enemy tiers, breakable types, item tables, biomes)
- Economy settings editor
- Quick access to key metrics

#### Enemy Loot Tab
- Configure drop rates for each enemy tier
- Adjust currency ranges
- Modify card drop chances and quality distributions
- Set XP rewards

#### Breakables Tab
- Configure default breakable drops
- Edit biome-specific breakable types
- Adjust HP values and drop rates

#### Item Tables Tab
- Create and edit weighted item tables
- Configure item properties (emoji, name, quantity, weight)
- Preview drop distributions

#### Card Modifiers Tab
- Configure biome-specific card weights
- Adjust floor scaling for progressive difficulty
- Set combat source modifiers

#### Raw JSON Tab
- Direct JSON editing for advanced users
- Real-time validation
- Syntax highlighting (planned)

### Workflow

1. **Load** - Click "Load Tables" to fetch current configuration
2. **Edit** - Modify values in form fields or raw JSON
3. **Validate** - Click "Validate" to check for errors
4. **Save** - Click "Save Changes" to persist to localStorage
5. **Export** - Download JSON file for version control
6. **Import** - Load JSON file from disk

### Safety Features

- Validation before save
- Export/import for backup
- Reset to defaults option
- Real-time error messages
- Confirmation on destructive actions

## Drop Rate Reference

### Enemy Tiers

| Enemy Type | Currency | Card Drop | Card Quality | Charm | XP |
|------------|----------|-----------|--------------|-------|-----|
| Standard   | 2-8¢ (100%) | 50% | Weighted random | 30% | 10 |
| Elite      | 10-25¢ (100%) | 75% | Better weights | 30% | 30 |
| Boss       | 50-100¢ (100%) | 100% (ELITE) | Guaranteed ELITE | - | 100 |
| Scout      | 2-8¢ (100%) | 50% | Lower weights | 30% | 5 |

### Boss Special Drops

| Drop Type | Chance | Quality | Condition |
|-----------|--------|---------|-----------|
| Synergy Card | 50% | SUPERIOR | Standard kill |
| Whisper Item | 3-5% | Unique | Standard kill |
| Mythic Item | 100% | Mythic | Mythic condition |
| Mythic Synergy | 100% | MASTERWORK | Mythic condition |

### Breakable Drops

| Drop Type | Chance | Amount |
|-----------|--------|--------|
| Currency  | 70%    | 1-5¢   |
| Ammo      | 60%    | 1-2    |
| Item      | 30%    | Varies |

### Quality Distribution

Weighted random for standard enemies:

| Quality | Weight | Probability |
|---------|--------|-------------|
| CRACKED | 18 | ~18% |
| WORN | 22 | ~22% |
| STANDARD | 25 | ~25% |
| FINE | 15 | ~15% |
| SUPERIOR | 10 | ~10% |
| ELITE | 6 | ~6% |
| MASTERWORK | 3 | ~3% |
| NEAR_PERFECT | 0.9 | ~0.9% |
| PERFECT | 0.1 | ~0.1% |

## Integration Guide

### Replacing Hardcoded Drops

**Before (hardcoded in death-handler.js):**
```javascript
var currencyAmount = Math.floor(Math.random() * 7) + 2;
```

**After (using LootTableManager):**
```javascript
const loot = LootTableManager.rollEnemyLoot('standard', { source: 'player' });
var currencyAmount = loot.currency;
```

### Boss Encounter Integration

**Before (hardcoded in boss-encounters.js):**
```javascript
generateLoot() {
  var loot = [];
  loot.push({ type: 'card', quality: 'ELITE', guaranteed: true });
  // ...
}
```

**After (using LootTableManager):**
```javascript
generateLoot() {
  return LootTableManager.rollEnemyLoot('boss', {
    source: 'player',
    mythicKill: this.mythicConditionMet
  });
}
```

### Breakable Integration

**Before (hardcoded in gone-rogue.js):**
```javascript
if (Math.random() < 0.7) {
  currencyAmount = Math.floor(Math.random() * 5) + 1;
}
```

**After (using LootTableManager):**
```javascript
const loot = LootTableManager.rollBreakableLoot(breakable.type, currentBiome);
currencyAmount = loot.currency;
ammoAmount = loot.ammo;
```

## Integration Status

### Phase 3: System Integration (✅ COMPLETED)

All game systems have been successfully integrated with LootTableManager:

#### Death Handler (`death-handler.js`) ✅
- **Function:** `handleEnemyDeath()`
- **Status:** Integrated with fallback support
- **Features:**
  - Uses `LootTableManager.rollEnemyLoot()` for all enemy tiers
  - Converts rolled loot to legacy format for compatibility
  - Supports mythic kill context
  - Falls back to hardcoded values if LootTableManager unavailable
- **Lines:** 135-218

#### Boss Encounters (`boss-encounters.js`) ✅
- **Function:** `BossEncounter.generateLoot()`
- **Status:** Integrated with fallback support
- **Features:**
  - Uses `LootTableManager.rollEnemyLoot('boss', context)`
  - Properly handles mythic synergy card drops
  - Maintains whisper and rumor drop mechanics
  - Converts to legacy loot array format
- **Lines:** 135-288

#### Breakables (`gone-rogue.js`) ✅
- **Function:** `_damageBreakable()`
- **Status:** Integrated with fallback support
- **Features:**
  - Uses `LootTableManager.rollBreakableLoot(type, biome)`
  - Respects decay times from loot tables
  - Spawns currency, ammo, cards, charms, and items
  - Falls back to hardcoded values if LootTableManager unavailable
- **Lines:** 5049-5198

### Backward Compatibility

All integrations maintain backward compatibility:
- **Graceful Degradation:** Systems check for LootTableManager availability before use
- **Fallback Logic:** Original hardcoded values used if LootTableManager not loaded
- **No Breaking Changes:** Existing game code continues to work without modification
- **Testing:** Existing test suites pass without modification

### Loading Order

For proper integration, ensure scripts load in this order:
```html
<!-- 1. Core systems -->
<script src="js/card-system.js"></script>

<!-- 2. Loot system -->
<script src="js/loot-table-manager.js"></script>

<!-- 3. Game systems that use loot -->
<script src="js/death-handler.js"></script>
<script src="js/boss-encounters.js"></script>
<script src="js/gone-rogue.js"></script>
```

### Verification

To verify LootTableManager is being used:
1. Open browser console
2. Check for LootTableManager load messages
3. Look for loot rolls logging (if debug enabled)
4. Run test suite to verify integration

## Testing

### Running Tests

Open in browser: `/tests/test-loot-table-manager.js`

### Test Coverage

1. **Module Loading** - Verify LootTableManager loads correctly
2. **Table Loading** - Async loading from JSON file
3. **Enemy Loot Structure** - Validate all enemy tiers
4. **Enemy Loot Rolling** - Test loot generation
5. **Currency Distribution** - Statistical analysis over 100 rolls
6. **Card Drop Rates** - Validate ~50% drop rate over 1000 rolls
7. **Breakable Loot** - Test breakable generation
8. **Item Tables** - Weighted random selection
9. **Card Modifiers** - Biome and floor scaling
10. **Decay Times** - Validate timing values
11. **Economy Settings** - Retrieve settings
12. **Validation** - Table structure validation
13. **Export/Import** - JSON serialization
14. **Distribution Analysis** - 10,000 roll statistical validation

### Expected Results

- All tests should pass (100% success rate)
- Card drop rate should converge to ~50% over large samples
- Charm drop rate should converge to ~30% over large samples
- Currency distributions should fall within expected ranges

## Balance Guidelines

### Tuning Currency Drops

**Early Game (Floors 1-10):**
- Standard enemies: 2-8¢ (maintain scarcity)
- Breakables: 1-5¢ (supplement income)
- Shop prices: 10-50¢ per card

**Mid Game (Floors 11-20):**
- Elite enemies: 10-25¢ (reward challenge)
- Boss: 50-100¢ (major windfall)

**Late Game (Floors 21-30):**
- Increase shop prices with price_markup
- Consider higher currency ranges

### Tuning Card Quality

**Progression:**
- Floors 1-5: Mostly Cracked/Worn/Standard
- Floors 6-15: More Fine/Superior
- Floors 16+: Elite/Masterwork possible

**Boss Rewards:**
- Always Elite minimum
- Mythic kills grant Masterwork synergy cards

### Tuning Drop Rates

**Card Drops:**
- Standard: 50% (balanced)
- Elite: 75% (reward)
- Boss: 100% (guaranteed)

**Charm Drops:**
- 30% across all tiers
- Provides supplementary progression

## Troubleshooting

### Tables Not Loading

**Issue:** LootTableManager returns empty/default tables

**Solutions:**
1. Check `/data/loot-tables.json` exists and is valid JSON
2. Verify fetch() has correct path
3. Check browser console for errors
4. Ensure async/await is used correctly

### Drop Rates Feel Wrong

**Issue:** Drops seem too common/rare

**Solutions:**
1. Run distribution tests (10,000+ rolls)
2. Check chance values are 0-1 (not 0-100)
3. Verify weighted random is working correctly
4. Adjust chance values in loot-tables.json

### Portal Not Saving

**Issue:** Changes don't persist

**Solutions:**
1. Check localStorage is enabled
2. Verify JSON is valid before save
3. Run validation before save
4. Check browser console for errors

### Validation Errors

**Issue:** Tables fail validation

**Solutions:**
1. Check all required sections exist
2. Verify all enemy tiers are defined
3. Ensure numeric values are numbers, not strings
4. Check for trailing commas in JSON

## Future Enhancements

### Planned Features

1. **Live Preview** - See drop distributions in real-time
2. **A/B Testing** - Compare different loot configurations
3. **Analytics Dashboard** - Track actual drop rates in production
4. **Version Control** - Save multiple table versions
5. **Rollback** - Revert to previous configurations
6. **Templates** - Preset configurations for different play styles
7. **AI Balance Suggestions** - Machine learning recommendations
8. **Multiplayer Sync** - Share configurations across team

### Expansion Areas

1. **Seasonal Events** - Time-limited loot modifiers
2. **Difficulty Modes** - Different tables per difficulty
3. **Player Progression** - Unlock better drops with achievements
4. **Dynamic Difficulty** - Adjust drops based on player performance
5. **Loot Streaks** - Bonus drops for consecutive runs

## Best Practices

### Configuration Management

1. **Version Control** - Export JSON and commit to git
2. **Testing** - Always test changes with test suite
3. **Validation** - Run validation before deploying
4. **Documentation** - Comment complex configurations
5. **Backup** - Keep backups of working configurations

### Balancing

1. **Iterative** - Make small changes and test
2. **Data-Driven** - Use test results to guide decisions
3. **Player Feedback** - Monitor community reactions
4. **Economics** - Maintain scarcity and reward
5. **Progression** - Ensure steady power curve

### Designer Workflow

1. Load current tables
2. Make small, targeted changes
3. Validate changes
4. Export for backup
5. Test in-game
6. Iterate based on results
7. Document reasoning in commit messages

## Conclusion

The Loot Table System provides a robust, flexible foundation for managing all loot drops in Gone Rogue. By centralizing configuration in JSON and providing a designer-friendly portal, it enables rapid iteration on game balance without requiring code changes. The comprehensive test suite ensures drop rates remain consistent and predictable, while the validation system prevents configuration errors.

For questions or issues, refer to the test suite for examples of correct usage, or check the browser console for detailed error messages.
