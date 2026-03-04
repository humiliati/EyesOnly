# Tooltip Space — Canonical Dimensions & Future NPC Dialogue

> **Purpose:** Document the tooltip/history panel dimensions on desktop vs mobile to enable future NPC dialogue system with in-field hyperlinks.
> **Status:** Draft — 2026-03-03

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

- Timestamp: ~70px with brackets + spacing
- Message: ~500px+ available

### Mobile Portrait (Narrow)

```
┌────────────────────────────┐
│14:32 Message text here... │
│14:31 Another message...    │
│14:30 Short                │
└────────────────────────────┘
 └32px┘ └──~200px───────────┘
```

- Timestamp: ~32px max (fixed width)
- Message: ~200px available

---

## Future: NPC Dialogue System

### Goal
Use the tooltip/history panel for extended NPC conversations with:
- Hyperlinks in-field to progress dialogue
- Branching conversation trees
- Character portrait/emoji integration

### Space Requirements

| Feature | Desktop Space | Mobile Space | Notes |
|---------|---------------|--------------|-------|
| Speaker name | ~80px | ~40px | NPC name or emoji |
| Dialogue text | ~400px | ~160px | Main content |
| Choice links | ~80px/line | ~40px/line | `[Continue]`, `[Ask about X]` |

### Proposed Hyperlink Format

```
[Barkeep] > Hey stranger! What can I get you?
           > [Buy Drink -5¢]  [Ask about rumor]  [Leave]

┌────────────────────────────────────────────────────────────┐
│14:32 [Barkeep] > Hey stranger! What can I get you?       │
│      > [Buy Drink -5¢] [Ask about rumor] [Leave]         │
└────────────────────────────────────────────────────────────┘
```

### CSS Requirements for Hyperlinks

```css
/* In-field dialogue choices */
.mok-history-message a,
.mok-history-message .dialogue-choice {
  color: #1cff9b;
  text-decoration: underline;
  cursor: pointer;
  padding: 0 2px;
}

.mok-history-message a:hover,
.mok-history-message .dialogue-choice:hover {
  color: #66ff66;
  background: rgba(28, 255, 155, 0.15);
}

/* Mobile: larger tap targets despite narrow space */
@media (max-width: 600px) and (orientation: portrait) {
  .mok-history-message a,
  .mok-history-message .dialogue-choice {
    display: inline-block;
    padding: 2px 4px;
    margin: 1px 0;
    min-height: 20px; /* touch target */
  }
}
```

---

## Mobile Constraints Summary

### The Challenge
- **Desktop**: 500px+ for dialogue, can show 2-3 choice links per line
- **Mobile Portrait**: ~200px for dialogue, max 1 choice link per line, very tight

### Current Timestamp Width
- Desktop: ~70px (includes `[` + `]` + time + margins)
- Mobile: ~32px fixed (time only, no brackets)

### Recommendation for NPC Dialogue
1. **Desktop-first**: Design dialogue for desktop, then adapt
2. **Mobile**: Single-choice-per-line format, or collapse to menu overlay
3. **Hybrid**: On mobile, show "Tap to continue" → opens full dialogue overlay

---

## Files Involved

| File | Purpose |
|------|---------|
| `public/js/tooltip-system.js` | Timestamp format, history rendering |
| `public/css/tooltip-system.css` | All dimension, media queries |
| `docs/UI-CANON.md` | Related: §15 Font Canon, §16 Color Canon |

---

## Open Questions

1. **Mobile dialogue format**: Should NPC dialogue use the compact history panel, or a dedicated overlay?
2. **Speaker identification**: Should we add an emoji/avatar column (like `[Barkeep]`) in front of messages?
3. **Choice links**: Should choices be inline `[text]` or separate clickable rows?
4. **Touch targets**: Mobile portrait is very constrained — minimum 20px height per choice?
