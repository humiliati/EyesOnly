# Left Column Button Specification - Gone Rogue Mode

## Current Implementation Status

### ✅ Reserve Slots System EXISTS (reserve-slots.js)

The repository DOES have a reserve slots system that dynamically renders action card buttons during Gone Rogue mode!

**File:** `public/js/reserve-slots.js`

**Key Features:**
- Creates `#reserve-slots-container` in the control buttons area
- Hides default buttons when Gone Rogue is active
- Shows up to 4 visible card slots at a time
- Includes cycle button when cards > 4
- Uses vowel-drop abbreviation for card names (e.g., "QUICK STRIKE" → "QCKSTRK")
- Color-codes cards by quality tier

### Current Gone Rogue Button Structure (reserve-slots.js render())

When Gone Rogue mode is active, the reserve slots system renders:

```
┌─────────────────────────────────────┐
│ [◀ back]                            │  ← Always shown
├─────────────────────────────────────┤
│ [↑↓]                                │  ← Cycle button (only if >4 cards)
├─────────────────────────────────────┤
│ [🃏 CARD1]                          │  ← Card slot 1 (if card present)
├─────────────────────────────────────┤
│ [🃏 CARD2]                          │  ← Card slot 2 (if card present)
├─────────────────────────────────────┤
│ [🃏 CARD3]                          │  ← Card slot 3 (if card present)
├─────────────────────────────────────┤
│ [🃏 CARD4]                          │  ← Card slot 4 (if card present)
└─────────────────────────────────────┘
```

## Problem Statement Requirements vs Current Implementation

### Required Structure (From Problem Statement)
```
1. [◀ BACK]       ← Exits Gone Rogue to previous terminal phase
2. [📦 INVENTORY] ← Opens inventory overlay, minimized easily
3. [CARD 1]       ← Action button container 1
4. [CARD 2]       ← Action button container 2
5. [CARD 3]       ← Action button container 3 (if equipped)
6. [CARD 4]       ← Action button container 4 (if equipped)
7. [◀▶ SORT]     ← Double arrow sort button
```

### Current Implementation (reserve-slots.js)
```
1. [back]         ← ✅ Exits Gone Rogue (calls _handleBackClick)
2. [↑↓]           ← ❓ Cycle button (only if >4 cards)
3. [🃏 CARD]      ← ✅ Action card slots (up to 4)
4. [🃏 CARD]
5. [🃏 CARD]
6. [🃏 CARD]
```

### Gap Analysis

**Missing:**
1. ❌ **Inventory button not included in Gone Rogue layout**
2. ❌ **Sort button not implemented** (cycle button exists instead)

**Differences:**
- Current: Cycle button (↑↓) for rotating through >4 cards
- Required: Sort button (◀▶) for reordering cards

**Present:**
- ✅ Back button with exit functionality
- ✅ Dynamic action card slots (up to 4 visible)
- ✅ Card abbreviation system (vowel-drop)
- ✅ Quality color coding
- ✅ Long-press tooltips
- ✅ Click handlers for card selection

## Required Changes

To match the problem statement requirements:

1. **Add Inventory Button**
   - Insert between back button and first card slot
   - Always visible (even when no cards)
   - Opens inventory overlay on click

2. **Consider Sort vs Cycle**
   - Current: Cycle button rotates view (for >4 cards)
   - Required: Sort button reorders cards
   - May need both functionalities

3. **Empty Slot Placeholders**
   - Show greyed-out slots when cards < 4
   - Visual indication of available capacity
   - Match problem statement: "empty action button containers show appropriate placeholders"

## Verification Status

✅ **Back button** - Correctly exits Gone Rogue to terminal
✅ **Action card buttons** - Implemented with full functionality
✅ **Card cycling** - Works for >4 cards
✅ **Vowel-drop abbreviation** - Matches EyesOnly conventions
❌ **Inventory button** - NOT included in Gone Rogue layout
❌ **Sort button** - Not implemented (cycle exists instead)
❓ **Empty slot placeholders** - Need to verify rendering behavior
