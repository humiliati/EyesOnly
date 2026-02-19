# Shop System Visual Design

## Standard Shop Layout

```
┌─────────────────────────────────────────────────────┐
│  🏪 MERCHANT              💰 1250¢                  │▼│
├─────────────────────────────────────────────────────┤
│                                                     │
│  ◀  [120¢] [85¢] [45¢] [200¢] [180¢] [95¢]  ▶    │
│      💎     🔫    🛡️    💣     🧨     ⚡           │
│      Dmnd   Gn    Shld  Bmb    Xplsv  Bllt        │
│                                                     │
│ ─────────────────────────────────────────────────  │
│                                                     │
│  SELL CARDS                                        │
│  [12¢]  [8¢]   [35¢]  [28¢]  [10¢]                │
│   🔧    💨     🎯     🗡️    🛡️                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Black Market Layout

```
┌─────────────────────────────────────────────────────┐
│  ⚠️ BLACK MARKET         💰 1250¢                  │▼│
├─────────────────────────────────────────────────────┤
│                                                     │
│  ◀  [340¢] [280¢] [480¢] [620¢] [900¢] [1200¢] ▶ │
│      💰     💰     🎴     💰     💎      🔮        │
│      Gmbl   Gmbl   Crd    Gmbl   Rare    Epic     │
│                                                     │
│ ─────────────────────────────────────────────────  │
│                                                     │
│  ⚠️ NO SELLING. SPEND OR GAMBLE ONLY.             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Rarity Color System

- **Common** (Gray): #9E9E9E - Basic items, low power
- **Uncommon** (Green): #4CAF50 - Solid utility
- **Rare** (Blue): #2196F3 - Powerful effects
- **Impossible** (Purple): #9C27B0 - Game-changing

## Card Thumbnail Design

```
     [95¢]           Price label (muted text)
┌─────────────┐
│             │
│     🔫      │     Emoji icon
│   ( ● )     │     Rarity frame (colored border)
│             │
│     Gn      │     Abbreviated name (vowel-dropped)
│             │
└─────────────┘
```

## Gambling Card Gradient System

**Standard Gamble** (Green-Gold):
```
┌─────────────┐
│    [120¢]   │
│             │
│     💰      │
│   ╱     ╲   │     Green→Gold gradient
│  ╱       ╲  │     70% common, 22% uncommon
│ ╱         ╲ │     7% rare, 1% impossible
│             │
│    Gmbl     │
└─────────────┘
```

**Binary Gamble** (White-Black):
```
┌─────────────┐
│   [2000¢]   │
│             │
│     💰      │
│   ▓▓▓▓▓▓▓   │     Black↔White pattern
│   ░░░░░░░   │     50% god tier
│   ▓▓▓▓▓▓▓   │     50% catastrophic
│             │
│    Bnry     │
└─────────────┘
```

**Cursed Gamble** (Red-Black):
```
┌─────────────┐
│    [850¢]   │
│             │
│     💰      │
│   ████████  │     Red→Black gradient
│   ▓▓▓▓▓▓▓▓  │     High risk, high reward
│   ░░░░░░░░  │     May include cursed items
│             │
│    Crsd     │
└─────────────┘
```

**Empty Gamble** (Dark Gray):
```
┌─────────────┐
│    [200¢]   │
│             │
│     💰      │
│   ▒▒▒▒▒▒▒   │     Gray gradient
│   ░░░░░░░   │     75% nothing
│   ▓▓▓▓▓▓▓   │     25% common
│             │
│    Empt     │
└─────────────┘
```

## Interaction States

**Normal Card:**
```
┌─────────────┐
│   [95¢]     │
│     🔫      │  Border: rgba(255,255,255,0.2)
│   ( ● )     │  Hover: translateY(-4px)
│     Gn      │        + gold border glow
└─────────────┘
```

**Disabled Card (Insufficient Funds):**
```
┌─────────────┐
│   [995¢]    │ ← Red price
│     🔫      │  Opacity: 0.5
│   ( ● )     │  Filter: grayscale(0.6)
│     Gn      │  Cursor: not-allowed
│ INSUFFICIENT│
│    FUNDS    │ ← Error message
└─────────────┘
```

**Disabled Card (No Space):**
```
┌─────────────┐
│   [95¢]     │
│     🔫      │  Opacity: 0.5
│   ( ● )     │  Filter: grayscale(0.6)
│     Gn      │  Cursor: not-allowed
│  NO SPACE   │ ← Error message
└─────────────┘
```

## Mobile Portrait Layout

```
┌─────────────────────────┐
│  HEADER (Fixed 48px)    │
├─────────────────────────┤
│                         │
│    WORLD (Dimmed)       │
│                         │
├─────────────────────────┤
│ 🏪 MERCHANT    💰 1250¢ │▼
├─────────────────────────┤
│ SHOP ITEMS (28vh)       │
│ ◀ 🔫 💎 🛡️ 💣 ▶       │
├─────────────────────────┤
│ SPACING (6vh)           │
├─────────────────────────┤
│ SELL CARDS (28vh)       │
│ 🔧 💨 🎯 🗡️ 🛡️        │
├─────────────────────────┤
│ TOOLTIP (40px)          │
└─────────────────────────┘
```

## Desktop Layout

```
┌───────────────────────────────────────────────────┐
│  HEADER (Fixed 48px)                              │
├─────────────────┬─────────────────────────────────┤
│                 │                                 │
│                 │     WORLD (Dimmed 30%)          │
│   LEFT COLUMN   │                                 │
│   (Unchanged)   │  ┌─────────────────────────┐   │
│                 │  │ 🏪 MERCHANT    💰 1250¢│▼ │
│                 │  ├─────────────────────────┤   │
│                 │  │ SHOP ITEMS (50%)        │   │
│                 │  │ ◀ 🔫 💎 🛡️ 💣 🧨 ⚡ ▶ │   │
│                 │  │                         │   │
│                 │  │ ────────────────────────│   │
│                 │  │                         │   │
│                 │  │ SELL CARDS (30%)        │   │
│                 │  │ 🔧 💨 🎯 🗡️ 🛡️        │   │
│                 │  └─────────────────────────┘   │
│                 │                                 │
│                 │  RIGHT COLUMN                   │
└─────────────────┴─────────────────────────────────┘
```

## Animation Examples

**Shop Open Animation:**
```
Frame 1:    Shop container at bottom of screen
            opacity: 0, transform: translateY(100%)

Frame 2-5:  Sliding up with ease-out
            opacity: 0.3 → 1.0
            transform: translateY(100% → 0)

Frame 6:    Fully visible
            opacity: 1, transform: translateY(0)
```

**Gamble Card Pulse:**
```
Frame 1:    box-shadow: 0 0 8px rgba(255, 215, 0, 0.3)
Frame 2:    box-shadow: 0 0 12px rgba(255, 215, 0, 0.45)
Frame 3:    box-shadow: 0 0 16px rgba(255, 215, 0, 0.6)  ← Peak
Frame 4:    box-shadow: 0 0 12px rgba(255, 215, 0, 0.45)
Frame 5:    box-shadow: 0 0 8px rgba(255, 215, 0, 0.3)  ← Loop
```

**Purchase Success:**
```
1. Card scale(0.95) + opacity(0.5)
2. Currency display flashes yellow
3. MOK interjection: "Purchased [Card Name]!"
4. Card removed from shop
5. Shop re-renders
```

**Gambling Animation:**
```
1. Click gambling card
2. Shop closes momentarily (shuffle effect)
3. Card flash/spin effect
4. Shop reopens with new gradient
5. MOK interjection: "You rolled: [Card Name]!"
```

## Responsive Breakpoints

```css
/* Mobile Portrait */
@media (max-width: 480px) and (orientation: portrait) {
  .shop-root { width: 95%; max-height: 85vh; }
  .shop-card { width: 58px; height: 80px; }
}

/* Mobile/Tablet */
@media (max-width: 767px) {
  .shop-root { width: 90%; max-height: 80vh; }
  .shop-card { width: 64px; height: 88px; }
}

/* Desktop */
@media (min-width: 768px) {
  .shop-root { width: 60%; max-width: 600px; }
  .shop-card { width: 72px; height: 96px; }
}
```

## Z-Index Layering

```
HEADER:         1000  ←─ Always on top
TOOLTIP:        1000  ←─ Same level as header
SHOP_ROOT:       950  ←─ Shop modal
SHOP_DIM:        900  ←─ Dim overlay
WORLD:           100  ←─ Game world
```

## Color Palette

```css
/* Shop Background */
Standard:       rgba(20, 25, 30, 0.95)
Black Market:   rgba(15, 10, 20, 0.97)

/* Rarity Colors */
Common:         #9E9E9E  (Gray)
Uncommon:       #4CAF50  (Green)
Rare:           #2196F3  (Blue)
Impossible:     #9C27B0  (Purple)

/* Status Colors */
Currency:       #FFD700  (Gold)
Affordable:     #90EE90  (Light Green)
Too Expensive:  #FF4444  (Red)
No Space:       #FF6464  (Light Red)

/* Black Market */
Border:         rgba(138, 43, 226, 0.4)  (Purple)
Glow:           rgba(138, 43, 226, 0.3)  (Purple)
Background:     rgba(138, 43, 226, 0.1)  (Purple)
```

## Accessibility Features

- **Semantic HTML**: Proper button and div usage
- **ARIA Labels**: `aria-label` on interactive elements
- **Keyboard Navigation**: Tab through cards, Enter to select
- **Color Contrast**: All text meets WCAG AA standards
- **Screen Readers**: Descriptive labels and state announcements
- **Focus Indicators**: Visible focus rings on interactive elements

## Performance Optimizations

- **CSS Transforms**: Hardware-accelerated animations
- **Event Delegation**: Single listener per container
- **Lazy Rendering**: Only visible cards rendered
- **DOM Cleanup**: Elements destroyed on close
- **Throttled Events**: Prevent excessive re-renders
