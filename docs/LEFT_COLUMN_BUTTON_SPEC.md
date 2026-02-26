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

When Gone Rogue mode is active, the reserve slots system renders up to **6 buttons max**:

**Cards View:**
```
┌─────────────────────────────────────┐
│ [← items]                           │  ← Swapper: switches to inventory view
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

**Inventory View:**
```
┌─────────────────────────────────────┐
│ [cards →]                           │  ← Swapper: switches back to cards view
├─────────────────────────────────────┤
│ [↑↓]                                │  ← Cycle button (only if >4 items)
├─────────────────────────────────────┤
│ [📦 ITEM1]                          │  ← Inventory slot 1
├─────────────────────────────────────┤
│ [📦 ITEM2]                          │  ← Inventory slot 2
├─────────────────────────────────────┤
│ [📦 ITEM3]                          │  ← Inventory slot 3
├─────────────────────────────────────┤
│ [📦 ITEM4]                          │  ← Inventory slot 4
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
Cards View:
1. [← items]     ← ✅ Swapper to inventory view
2. [↑↓]           ← ✅ Cycle button (only if >4 cards)
3. [🃏 CARD]      ← ✅ Action card slots (up to 4)
4. [🃏 CARD]
5. [🃏 CARD]
6. [🃏 CARD]

Inventory View:
1. [cards →]     ← ✅ Swapper back to cards view
2. [↑↓]           ← ✅ Cycle button (only if >4 items)
3-6. [📦 ITEM]   ← ✅ Inventory slots (up to 4)
```

### Gap Analysis

**Previously Missing (now fixed):**
1. ✅ **Inventory/swapper button** — replaced separate back+inventory buttons with a single `← items` / `cards →` toggle
2. ✅ **Max 6 buttons constraint** — enforced by removing the back button and using a single swapper

**Present:**
- ✅ Swapper button (`← items` / `cards →`) toggles between card and inventory views
- ✅ Dynamic action card slots (up to 4 visible)
- ✅ Card abbreviation system (vowel-drop)
- ✅ Quality color coding
- ✅ Long-press tooltips
- ✅ Click handlers for card selection
- ✅ Inventory item slots (up to 4 visible)

## Verification Status

✅ **Swapper button** - Toggles between cards and inventory views
✅ **Action card buttons** - Implemented with full functionality
✅ **Card cycling** - Works for >4 cards
✅ **Inventory cycling** - Works for >4 items
✅ **Vowel-drop abbreviation** - Matches EyesOnly conventions
✅ **Max 6 buttons** - Enforced by layout design
