# Tooltip Space — Canonical Dimensions & NPC Dialogue System

> **Purpose:** Document the tooltip/history panel dimensions on desktop vs mobile and the Morrowind-style NPC dialogue system implementation.
> **Status:** Implemented — 2026-03-07
> **Previous:** Draft — 2026-03-03
> **Cross-References:** [NPC_CANON.md](./NPC_CANON.md) (dialogue system = Phase A of NPC roadmap), [BUILDING_INTERIOR_SYSTEM.md](./BUILDING_INTERIOR_SYSTEM.md)

---

## Current Implementation

### Desktop (>900px)

| Property | Value |
|----------|-------|
| Max Height | 70vh |
| Font Size | 11px |
| Line Height | 1.2 |
| Timestamp | `[HH:MM:SS]` with brackets |
| Timestamp Size | 10px |
| Row Padding | 1px 0 |
| Message Width | Remaining after timestamp |

### Tablet (601-768px)

| Property | Value |
|----------|-------|
| Max Height | 60vh |
| Font Size | 10px |
| Line Height | 1.2 |

### Mobile Portrait (<600px)

| Property | Value |
|----------|-------|
| Max Height | 45vh |
| Font Size | 9px |
| Line Height | 1.15 |
| Timestamp | `HH:MM` (no brackets) |
| Timestamp Size | 7px |
| Timestamp Width | 28-32px fixed |
| Timestamp Margin | 1px right |

---

## Available Space Calculation

### Desktop (Full Width)

```
┌──────────────────────────────────────────────────────────────┐
│ [14:32:05] Message text here...                              │
│ [14:31:22] Another message with more text...                  │
│ [14:30:45] Short                                            │
└──────────────────────────────────────────────────────────────┘
   └─70px─┘    └──────────────~500px+─────────────────────────┘
```

### Mobile Portrait (Narrow)

```
┌────────────────────────────┐
│14:32 Message text here... │
│14:31 Another message...    │
│14:30 Short                │
└────────────────────────────┘
 └32px┘ └──~200px───────────┘
```

---

## Tooltip Priority System

Messages have priority levels. Higher priority content blocks lower priority from overwriting it.

| Priority | Level | Source | Behavior |
|----------|-------|--------|----------|
| NORMAL | 1 | `show()`, `showAction()`, `showSequence()` | Auto-resets to default after timeout |
| PERSISTENT | 2 | `showPersistent()` | Stays until replaced by same or higher priority |
| DIALOGUE | 3 | `showDialogue()` | Blocks ALL lower-priority writes; requires explicit `clearDialogue()` |

When dialogue is active (priority 3), game tooltips (combat, pickup, movement) are still logged to history but do NOT overwrite the dialogue rendering. This solves the original problem of tooltips "defaulting away from relevant information."

The `DEFAULT_MESSAGE` ("Standing by for advisories.") reset is gated at all five code sites by priority checks.

---

## NPC Dialogue System — Morrowind Style

### Architecture

```
DialogueSystem (dialogue-system.js)
    │
    ├── Manages dialogue trees, active conversation state
    ├── Resolves dialogueTree or flat dialogues[] into normalized tree
    ├── Handles choice selection → node navigation → effects
    │
    └── Renders via TooltipSystem.showDialogue()
            │
            ├── Builds innerHTML with speaker, text, clickable choices
            ├── Attaches click delegation for .dialogue-choice spans
            └── Locks tooltip to PRIORITY_DIALOGUE
```

### Interaction Flow

1. Player walks adjacent to NPC (1 tile, including diagonal)
2. Player taps the NPC's tile
3. `TapMoveSystem.handleTapMove()` detects NPC at target, checks adjacency
4. Skips gate NPCs and shopkeepers (handled by existing systems)
5. Calls `DialogueSystem.startConversation(npc, ctx)`
6. DialogueSystem resolves the NPC's dialogue tree, navigates to root node
7. `TooltipSystem.showDialogue()` renders speaker + text + clickable `[choices]`
8. Player clicks a choice → `DialogueSystem.selectChoice(idx)` → next node or end
9. Walking away (Manhattan distance > 2) → `DialogueSystem.interrupt()`
10. Combat start → `DialogueSystem.interrupt()`

### Dialogue Tree Data Format

```javascript
{
  root: 'greeting',
  nodes: {
    greeting: {
      text: 'Hey stranger! What can I get you?',
      choices: [
        { label: 'Buy Drink -5¢', next: 'buy_drink', effect: { currency: -5 } },
        { label: 'Ask about rumor', next: 'rumor' },
        { label: 'Leave', next: null }  // null = end conversation
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
```

### Backward Compatibility

NPCs with only flat `dialogues: ['line1', 'line2']` arrays are auto-wrapped into a linear Continue→Continue→Farewell tree. No existing NPC data needs to change.

### Choice Effects

| Effect Key | Type | Description |
|-----------|------|-------------|
| `currency` | number | Add/subtract crypto (negative = cost) |
| `setFlag` | string | Set `player.flags[key] = true` |
| `openShop` | boolean | Opens ShopSystem |
| `giveItem` | object | Adds item to player inventory |
| `heal` | number | Restore HP (capped at maxHp) |
| `callback` | function | Custom `fn(ctx, npc)` callback |

### Visited Node Tracking

Previously explored dialogue branches render with dimmer styling (`.dialogue-choice-visited` — dotted underline, muted green). This gives the player Morrowind-style visual feedback about which topics they've already explored.

---

## Dialogue Rendering in MOK Interjection Field

### Desktop Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 👵 Elder Careful ahead, child. [The catacombs] [Sounds] [Bye]│
└──────────────────────────────────────────────────────────────┘
  └speaker┘ └───dialogue text──┘ └──clickable choices──────────┘
```

### Mobile Portrait Layout

Choices break to a separate line with larger tap targets (min-height: 24px):

```
┌────────────────────────────┐
│👵 Elder Careful ahead...  │
│[Catacombs] [Sounds] [Bye] │
└────────────────────────────┘
```

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.dialogue-speaker` | Yellow bold NPC name/emoji |
| `.dialogue-text` | Light grey speech text |
| `.dialogue-choices` | Container for choice spans |
| `.dialogue-choice` | Green underlined clickable choice `[text]` |
| `.dialogue-choice-visited` | Dimmer green dotted underline for explored topics |
| `.dialogue-choice:hover` | Brighter green with subtle background |

---

## Tutorial NPCs with Dialogue Trees

| NPC | Floor | Topics |
|-----|-------|--------|
| Elder (👵) | Floor 1 | How to pass barricade, what's beyond |
| Father Aldric (👴) | Church Interior (1.2) | Catacombs, strange sounds, blessing (heals 2 HP) |
| Tavern Keeper (🧔) | Tavern Interior (0.1) | Cellar warnings, village news |
| Blacksmith (⚒️) | Tavern Interior (0.1) | Lost hammer quest, reward description, cellar danger |

---

## Files Involved

| File | Purpose |
|------|---------|
| `public/js/dialogue-system.js` | **NEW** — DialogueSystem IIFE: tree resolution, conversation state, choice handling, effects |
| `public/js/tooltip-system.js` | Extended: `showDialogue()`, `clearDialogue()`, `setPriority()`, priority gating on all methods |
| `public/css/tooltip-system.css` | Extended: dialogue speaker/text/choice styling, mobile tap targets, visited state |
| `public/js/tap-move-system.js` | Extended: NPC adjacency tap → `DialogueSystem.startConversation()` |
| `public/js/move-player-system.js` | Extended: dialogue interrupt on walk-away (distance > 2) |
| `public/js/tutorial-floors.js` | Extended: dialogueTree data on Elder, Father Aldric, Tavern Keeper, Blacksmith |
| `public/index.html` | Added `<script>` for dialogue-system.js |
| `docs/UI-CANON.md` | Related: §15 Font Canon, §16 Color Canon |

---

## Open Questions (Resolved)

1. **Mobile dialogue format** → Inline in footer with larger tap targets (24px min-height), choices break to separate line. No overlay needed at this scale.
2. **Speaker identification** → Emoji + name rendered as `.dialogue-speaker` in yellow bold, inline before dialogue text.
3. **Choice links** → Inline `[text]` spans with click handlers. Desktop: all on one line. Mobile: wrapped to separate line.
4. **Touch targets** → 24px min-height on mobile portrait, 6px horizontal padding.

## Future Work

1. **Quest-aware dialogue branches** — DialogueSystem checks `player.flags` to show/hide choices based on quest state (e.g. show "Return hammer" choice only if player has BLACKSMITH_HAMMER)
2. **Shopkeeper dialogue integration** — Replace simple "Welcome to my shop!" tooltip with a dialogue tree that includes [Browse Wares] choice
3. **Proc gen NPC dialogue** — Generate contextual dialogue trees for non-tutorial NPCs based on floor biome, nearby items, player stats
4. **Dialogue history in panel** — Render full conversation transcript in the history panel (not just plain text summaries)
5. **Portrait/avatar column** — Add small emoji avatar in history entries for NPC speech (distinct from game action tooltips)
