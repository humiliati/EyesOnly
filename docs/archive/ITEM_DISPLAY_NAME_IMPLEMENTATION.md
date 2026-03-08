# Item Display Name and Abbreviation System - Implementation Summary

## Problem Statement

Ensure that backend identifiers (XXXXX_XXX format like `RUSTY_KEY`) are never displayed to players. All item names should use proper display names that can be abbreviated using the vowel-drop convention for space-constrained UIs (mobile landscape, black market handfancomponent, etc.).

## Solution Overview

### 1. Unified Abbreviation System (`name-utils.js`)

Created a centralized utility module that implements the vowel-drop abbreviation convention documented in README.txt (lines 174-200).

**Key Features:**
- `abbreviate(name, maxLength)` - Core abbreviation function
- `getDisplayName(itemOrId, options)` - Converts itemId to display name
- `formatForMobile(itemOrId)` - 6-char max for mobile landscape
- `formatForShop(itemOrId)` - 8-char max for shop display

**Abbreviation Rules:**
1. Keep first letter of EACH WORD (even if vowel)
2. Remove all vowels from remaining characters
3. Apply maxLength if specified

**Examples:**
- "Rusty Key" → "RstyKy"
- "Sold Out" → "SldOt"
- "Energy Drink" → "EnrgyDrnk" (or "EnrgyD" with 6-char limit)
- "Attack" → "Attck"

### 2. Backend Identifier Convention

**Backend identifiers** (used in code):
- Format: `XXXXX_XXX` (all caps, underscores)
- Examples: `RUSTY_KEY`, `BRONZE_KEY`, `WOODEN_GATE`
- Used as `itemId` property in objects
- NEVER displayed to players

**Display names** (shown to players):
- Format: Title Case with spaces
- Examples: "Rusty Key", "Bronze Key", "Wooden Gate"
- Used as `name` property in objects
- Automatically generated from itemId if name not available

### 3. Fixed Components

#### environmental-drag-drop.js
- Added `_getItemDisplayName(itemId)` function
- Converts `RUSTY_KEY` → "Rusty Key"
- Uses NameUtils when available, fallback to local conversion
- Fixed lines 315, 356 where itemId was previously displayed

#### hand-fan-component.js
- Detects mobile viewport (`window.innerWidth <= 480px`)
- Uses `NameUtils.formatForMobile()` for 6-char abbreviated names
- Added fallback `_abbreviateCardName()` function
- Updates card name display in real-time

#### shop-system.js
- Added `_getAbbreviatedName()` wrapper function
- Uses `NameUtils.formatForShop()` for 8-char max names
- Maintains backward compatibility with local implementation
- Applied to black market shop item display

### 4. Load Order

Updated `public/index.html` to load name-utils.js before dependent modules:

```html
<script src="js/environmental-synergy.js"></script>
<script src="js/utils/name-utils.js"></script>
<script src="js/environmental-drag-drop.js"></script>
<script src="js/shop-system.js"></script>
```

## Test Coverage

### test-environmental-synergy.js

**10 test groups:**
1. Module loading verification
2. Key item definitions (RUSTY_KEY, BRONZE_KEY, etc.)
3. Gate definitions (WOODEN_GATE, etc.)
4. Name abbreviation (vowel-drop convention)
5. ItemId to display name conversion
6. Mobile formatting (6-char max)
7. Shop formatting (8-char max)
8. Key-gate compatibility checks
9. Gate registration system
10. Verify no underscore identifiers shown to players

### test-floor-passability.js

**9 test groups:**
1. GoneRogue headless API availability
2. Game initialization
3. Floor 1 (tutorial) passability
4. Tutorial gate presence and properties
5. Tutorial key presence (RUSTY_KEY → "Rusty Key")
6. Player movement validation
7. Multiple floor generation
8. Environmental synergy integration
9. Name display verification (no underscores)

## Integration Points

### Environmental Synergy System
- Gate registration: `EnvironmentalSynergy.registerGate()`
- Gate clearing: `EnvironmentalSynergy.clearGates()` on floor change
- Key-gate compatibility: `EnvironmentalSynergy.canUnlock()`
- Tutorial gate spawning: `_placeTutorialGate()` in gone-rogue.js

### Tutorial Flow
1. Floor 1 generates with tutorial gate (WOODEN_GATE)
2. RUSTY_KEY spawns near player (2 tiles away)
3. Gate registered with EnvironmentalSynergy
4. Player picks up key (sees "Rusty Key", not "RUSTY_KEY")
5. Player drags key to gate using environmental-drag-drop
6. Gate unlocks, path to exit opens

## Verification Checklist

- [x] RUSTY_KEY used as backend identifier (itemId)
- [x] "Rusty Key" displayed to players (name)
- [x] No XXXXX_XXX format shown in any UI
- [x] Mobile landscape uses 6-char abbreviated names
- [x] Black market shop uses 8-char abbreviated names
- [x] Vowel-drop convention matches README.txt
- [x] Environmental synergy gate/key system functional
- [x] All floors passable (floor 1 tutorial tested)
- [x] Comprehensive test suite created
- [x] Tests leverage existing public/tests infrastructure

## Files Modified

**Core Implementation (5 files):**
1. `public/js/utils/name-utils.js` - NEW
2. `public/js/environmental-drag-drop.js` - Modified
3. `public/js/hand-fan-component.js` - Modified
4. `public/js/shop-system.js` - Modified
5. `public/index.html` - Modified

**Test Suite (4 files):**
6. `public/tests/test-environmental-synergy.js` - NEW
7. `public/tests/test-environmental-synergy.html` - NEW
8. `public/tests/test-floor-passability.js` - NEW
9. `public/tests/test-floor-passability.html` - NEW

## Usage Examples

### Converting ItemId to Display Name
```javascript
// Backend identifier to display name
NameUtils.getDisplayName('RUSTY_KEY')  // → "Rusty Key"

// With abbreviation for mobile
NameUtils.getDisplayName('RUSTY_KEY', { maxLength: 6 })  // → "RstyKy"

// Convenience methods
NameUtils.formatForMobile('RUSTY_KEY')  // → "RstyKy" (6-char)
NameUtils.formatForShop('RUSTY_KEY')    // → "RstyKy" (8-char, no truncation)
```

### Abbreviating Display Names
```javascript
// Basic abbreviation
NameUtils.abbreviate('Rusty Key')  // → "RstyKy"

// With length limit
NameUtils.abbreviate('Energy Drink', 6)  // → "EnrgyD"

// From object
NameUtils.formatForMobile({ name: 'Sold Out' })  // → "SldOt"
```

### In Components
```javascript
// Hand fan component (mobile)
if (window.innerWidth <= 480) {
  cardName = NameUtils.formatForMobile(card);
}

// Shop system
html += '<div class="card-abbr-name">' + _getAbbreviatedName(item.name) + '</div>';

// Environmental drag-drop
var itemName = context.itemData ? context.itemData.name : _getItemDisplayName(context.itemId);
```

## Performance Considerations

- Name conversion is fast (simple string operations)
- No caching needed (operations are O(n) where n = name length)
- Fallback functions included in each component for robustness
- Load order ensures NameUtils available before dependent modules

## Future Enhancements

1. Add caching for frequently converted itemIds
2. Extend to other item types (weapons, armor, consumables)
3. Add localization support (different languages)
4. Create unit test suite for edge cases
5. Add visual regression tests for UI components

## Related Documentation

- `README.txt` lines 174-200: Vowel-Drop Abbreviation Convention
- `GONE_ROGUE_SYNERGY_GUIDE.md`: Environmental synergy system
- `INTERACTIVE_ITEMS_TODO.md`: Integration checklist
- `public/tests/AGENT-UI-INTEGRATION-GUIDE.md`: Test infrastructure
