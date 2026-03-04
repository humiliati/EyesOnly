# UI Canon — Gone Rogue HUD Component Map

> **Purpose:** Visual reference for every HUD component, its code name, file, and how it looks in each game mode.
> Verified against codebase: 2026-02-27.
> For implementation roadmap, see **[NCH-COMBAT-ROADMAP.md](NCH-COMBAT-ROADMAP.md)**.

---

## 1. Full Screen Layout — Non-Combat (Gone Rogue Exploration)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GAME VIEWPORT                                   │
│                                                                         │
│  ┌──────────────┐                                                       │
│  │ LEFT COLUMN  │     ┌─────────────────────────────────┐               │
│  │ (RogueSidebar│     │         WORLD MAP                │               │
│  │  6 slots)    │     │      40×20 ASCII Grid            │               │
│  │              │     │     (.rogue-cell tiles)           │               │
│  │ [Toggle ↕]   │     │                                  │               │
│  │ [Card 1    ] │     │    Player @  moves here          │               │
│  │ [Card 2    ] │     │    Enemies   patrol here         │               │
│  │ [Card 3    ] │     │    Items ░   loot here           │               │
│  │ [Card 4    ] │     │                                  │               │
│  │ [Card 5    ] │     └─────────────────────────────────┘               │
│  │ [Items/Cards]│                                                       │
│  └──────────────┘                                                       │
│                                                                         │
│  ┌──────────────┐                                           ┌─────────┐ │
│  │ DEBRIEF FEED │                                           │  NCH    │ │
│  │ (debrief-    │                                           │ CAPSULE │ │
│  │  screen)     │                                           │ 🃏🃏🃏  │ │
│  │              │                                           │(joker   │ │
│  │ MOK avatar   │                                           │ stack)  │ │
│  │ -or-         │                                           └─────────┘ │
│  │ Resources    │                                          bottom-right │
│  │ -or-         │                                                       │
│  │ API submenu  │                                                       │
│  └──────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### NCH Maximized (tap capsule to expand)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌──────────────┐  ┌─────────────────────────────────────────────────┐  │
│  │ LEFT COLUMN  │  │              NCH EXPANDED (#nch-expanded)       │  │
│  │ (RogueSidebar│  │                                                 │  │
│  │  6 slots)    │  │  ┌───────────────────────────────────────────┐  │  │
│  │              │  │  │  CARD VAULT  [data-dropzone="vault"]      │  │  │
│  │ [Toggle ↕]   │  │  │  (persistent inventory, 9-12 slots)      │  │  │
│  │ [Card 1    ] │  │  │  [🔫 Gun][🛡 Shield][💊 Heal][...]      │  │  │
│  │ [Card 2    ] │  │  └───────────────────────────────────────────┘  │  │
│  │ [Card 3    ] │  │                                                 │  │
│  │ [Card 4    ] │  │  ┌───────────────────────────────────────────┐  │  │
│  │ [Card 5    ] │  │  │  BACKUP SCROLL [data-dropzone="backup"]  │  │  │
│  │ [Items/Cards]│  │  │  (full deck, 25 card max, solitaire view)│  │  │
│  └──────────────┘  │  │  [01][02][03][04][05][06]...             │  │  │
│                     │  └───────────────────────────────────────────┘  │  │
│  ┌──────────────┐  │                                                 │  │
│  │ DEBRIEF FEED │  │  ┌───────────────────────────────────────────┐  │  │
│  │              │  │  │  HAND FAN  [data-dropzone="hand"]         │  │  │
│  │ ♻️ DROP TO   │  │  │  (player hand, 5 card max)               │  │  │
│  │   DISPOSE    │  │  │                                           │  │  │
│  │ (when card   │  │  │    ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐             │  │  │
│  │  dragged     │  │  │    │01│ │02│ │03│ │04│ │05│              │  │  │
│  │  over feed)  │  │  │    └──┘ └──┘ └──┘ └──┘ └──┘             │  │  │
│  │              │  │  │  (+ BLVCK ■ if stranded)                 │  │  │
│  └──────────────┘  │  └───────────────────────────────────────────┘  │  │
│                     └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Full Screen Layout — STR Combat

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GAME VIEWPORT                                   │
│                                                                         │
│  ┌──────────────┐     ┌─────────────────────────────────┐               │
│  │ LEFT COLUMN  │     │    STR COMBAT WINDOW             │               │
│  │ (RogueSidebar│     │    (str-combat-window.js)        │               │
│  │  STR mode)   │     │                                  │               │
│  │              │     │  ┌─────────┐    ┌─────────┐     │               │
│  │ [Toggle ↕]   │     │  │ PLAYER  │    │  ENEMY  │     │               │
│  │ [Draw Top 1] │     │  │ HP ████ │    │ HP ████ │     │               │
│  │ [Draw Top 2] │     │  │ @       │    │ 👾      │     │               │
│  │ [Draw Top 3] │     │  └─────────┘    └─────────┘     │               │
│  │ [Draw Top 4] │     │                                  │               │
│  │ [Draw Top 5] │     │  ┌──────────────────────────┐   │               │
│  │ [DRAW x1 🃏] │     │  │ ENEMY INTENT DISPLAY     │   │               │
│  └──────────────┘     │  │  ^_^ 🔫  (face + weapon) │   │               │
│                        │  └──────────────────────────┘   │               │
│                        │                                  │               │
│                        │  ┌──────────────────────────┐   │               │
│                        │  │ ENEMY HAND FAN (PLANNED) │   │               │
│                        │  │ 🃏🃏🃏  (hidden backs)    │   │               │
│                        │  │ (reveal/steal/destroy     │   │               │
│                        │  │  with equipped items)     │   │               │
│                        │  └──────────────────────────┘   │               │
│                        │                                  │               │
│                        │  ⏱ ROUND TIMER [2.0s default]   │               │
│                        └─────────────────────────────────┘               │
│                                                                         │
│  ┌──────────────┐                                           ┌─────────┐ │
│  │ DEBRIEF FEED │        PLAYER HAND FAN                    │(visible │ │
│  │              │     ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐             │ during  │ │
│  │ Resources /  │     │01│ │02│ │03│ │04│ │05│              │ plan    │ │
│  │ Self-target  │     └──┘ └──┘ └──┘ └──┘ └──┘             │ phase,  │ │
│  │ drop zone    │     (hand-fan-component.js)               │ hides   │ │
│  │ in combat    │     tap to select → commit on timer       │ during  │ │
│  └──────────────┘                                           │ resolve)│ │
│                                                             └─────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Registry

### Primary UI Components

| Component Name | Code Module | CSS File | DOM Root |
|---|---|---|---|
| **NCH Capsule** | `non-combat-hud.js` → `NonCombatHUD` | `non-combat-hud.css` | `.nch-capsule-wrapper` |
| **NCH Expanded** | `non-combat-hud.js` → `NonCombatHUD` | `non-combat-hud.css` | `#nch-expanded` |
| **Left Column (RogueSidebar)** | `rogue-sidebar.js` → `RogueSidebar` | `rogue-sidebar.css` | `[data-rogue-sidebar-active="1"]` |
| **Hand Fan (Combat)** | `hand-fan-component.js` → `HandFanComponent` | `hand-fan-component.css` | `#hand-fan-container` |
| **STR Combat Window** | `str-combat-window.js` → `STRCombatWindow` | `str-combat-window.css` | `#str-combat-window` |
| **Enemy Intent** | `enemy-intent-system.js` → `EnemyIntentSystem` | *(inline in str-combat-window.css)* | inside STR window |
| **Enemy Hand Display** | `enemy-hand-display.js` → `EnemyHandDisplay` | *(needs CSS)* | inside STR window |
| **Debrief Feed** | `debrief-feed-controller.js` → `DebriefFeedController` | `debrief-pipboy.css`, `debrief-scale.css` | `#debrief-window` > `#debrief-screen` |
| **Card Disposal** | `card-disposal-system.js` → `CardDisposalSystem` | `commerce-drag-drop.css` | (overlay on debrief) |

### State & Transfer Authority

| Module | Code Module | Purpose |
|---|---|---|
| **CardStateAuthority (CSA)** | `card-state-authority.js` | Single source of truth for hand, backup, vault. Events: `hand:changed`, `backup:changed`, `vault:changed`, `draw:reset`, `card:disposed` |
| **CardTransferManager (CTM)** | `card-transfer-manager.js` | Cross-container drag/drop routing (hand↔backup↔vault) |
| **GAMESTATE** | `gamestate.js` | Low-level state arrays. CSA wraps this. |

### Integration Glue

| Module | Code Module | Purpose |
|---|---|---|
| **STR Combat Integration** | `str-combat-integration.js` | 100ms poll wiring CSA round changes, hand fan updates, BLVCK display fallback |
| **Commerce Drag-Drop** | `commerce-drag-drop-system.js` | Shop purchase drag-drop (buying/selling context on debrief) |
| **Environmental Synergy** | `environmental-drag-drop.js` | Ground effect card deployment on map tiles |

---

## 4. Canonical Constants

```
┌─────────────────────────────────────────────────────────┐
│                    CAPACITIES                            │
├─────────────────────────────────────────────────────────┤
│  Hand Fan (player)      │  5 cards     maxHandSize: 5   │
│  Backup Scroll (deck)   │ 25 cards     maxBackupSlots:25│
│  Card Vault (persistent)│ 9→12 slots   persistentSlots  │
│  Left Column slots      │  6 buttons   rogue-sidebar.js │
│  NCH capsule jokers     │  8 max shown Math.min(count,8)│
│  Draw per turn (STR)    │  1 default   cardDrawPerTurn:1│
├─────────────────────────────────────────────────────────┤
│                    RESOURCES                             │
├─────────────────────────────────────────────────────────┤
│  Ammo     │  7 / 50 max   playerAmmo / maxAmmo          │
│  Energy   │  5 / 5 max    playerEnergy / maxEnergy       │
│  Focus    │ 10 / 10 max   playerFocus / maxFocus         │
│  Battery  │  5 / 5 max    playerBattery / maxBattery     │
├─────────────────────────────────────────────────────────┤
│                 SPECIAL CARDS                            │
├─────────────────────────────────────────────────────────┤
│  BLVCK    │ ACT-000  │ 0-cost 1-dmg fallback "struggle" │
│           │          │ Injected when stranded (no        │
│           │          │ playable cards). Cannot be dragged │
│           │          │ out of hand. Auto-removes when a  │
│           │          │ playable card enters hand.         │
├─────────────────────────────────────────────────────────┤
│              STR COMBAT TIMERS                           │
├─────────────────────────────────────────────────────────┤
│  Standard enemy  │ 2.0s                                  │
│  Elite enemy     │ 2.5s                                  │
│  Boss enemy      │ 3.0s                                  │
│  Quick enemy     │ 1.5s                                  │
│  Puzzle enemy    │ 2.8s                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 5. NCH Capsule — Minimized State (Bottom-Right)

```
Default (3 cards in hand):        Stranded (BLVCK only):
┌───────────┐                     ┌───────────┐
│  🃏        │                     │           │
│   🃏       │ ← pancake stack     │  🃏       │ ← single greyed
│    🃏      │   offset 6px each   │  (grey)   │   joker emoji
│           │   .nch-capsule-joker │           │   .nch-joker-greyed
└───────────┘                     └───────────┘

Full hand (5 cards):              Empty hand:
┌───────────┐                     ┌───────────┐
│🃏          │                     │           │
│ 🃏         │                     │  (empty)  │
│  🃏        │                     │           │
│   🃏       │                     └───────────┘
│    🃏      │
└───────────┘
```

---

## 6. Left Column (RogueSidebar) — Slot Layout

### Non-Combat Mode (Items View)

```
┌─────────────────────────┐
│ [← cards]  Toggle       │  Slot 0: Swapper button
├─────────────────────────┤
│ 📦 Vault Item 1         │  Slot 1: Top vault item
├─────────────────────────┤
│ 📦 Vault Item 2         │  Slot 2
├─────────────────────────┤
│ 📦 Vault Item 3         │  Slot 3
├─────────────────────────┤
│ 📦 Vault Item 4         │  Slot 4
├─────────────────────────┤
│ [cycle ↕]               │  Slot 5: Cycle (if >4 items)
└─────────────────────────┘
```

### Non-Combat Mode (Cards View)

```
┌─────────────────────────┐
│ [← items]  Toggle       │  Slot 0: Swapper button
├─────────────────────────┤
│ 🃏 Backup Card 1        │  Slot 1: backupCards[0]
├─────────────────────────┤
│ 🃏 Backup Card 2        │  Slot 2: backupCards[1]
├─────────────────────────┤
│ 🃏 Backup Card 3        │  Slot 3: backupCards[2]
├─────────────────────────┤
│ 🃏 Backup Card 4        │  Slot 4: backupCards[3]
├─────────────────────────┤
│ 🃏 Backup Card 5        │  Slot 5: backupCards[4]
└─────────────────────────┘
```

### STR Combat Mode

```
┌─────────────────────────┐
│ [STR]  Mode Label       │  Slot 0: Mode indicator
├─────────────────────────┤
│ 🃏 Top Deck Card 1      │  Slot 1: Drawable card
├─────────────────────────┤
│ 🃏 Top Deck Card 2      │  Slot 2: Drawable card
├─────────────────────────┤
│ 🃏 Top Deck Card 3      │  Slot 3: Drawable card
├─────────────────────────┤
│ 🃏 Top Deck Card 4      │  Slot 4: Drawable card
├─────────────────────────┤
│ [DRAW x1 🃏]            │  Slot 5: Draw button
│  ghost joker on hover   │  (per-turn, resets each round)
└─────────────────────────┘

Draw modifiers (equipped items):
  Default:          Draw any 1 of visible top cards
  True Joker:       Draw from anywhere in full 25-card deck
  Magnifying Glass: Exact pick from top + true joker via button
```

---

## 7. Debrief Feed — Context States

```
Normal (non-drag):              Disposal hover:
┌──────────────────────┐       ┌──────────────────────┐
│  debrief-screen      │       │  .context-disposing   │
│                      │       │                      │
│  [MOK Avatar]        │       │       ♻️              │
│   -or-               │       │                      │
│  [Resource Feed]     │       │  DROP TO DISPOSE     │
│   ammo: 7/50         │       │  (orange glow frame) │
│   energy: 5/5        │       │                      │
│   focus: 10/10       │       └──────────────────────┘
│   battery: 5/5       │
│   -or-               │       On drop (600ms):
│  [API Submenu]       │       ┌──────────────────────┐
│                      │       │  .incinerator-active  │
└──────────────────────┘       │                      │
                               │    🔥 BURN 🔥         │
STR Combat (self-target):      │  (orange→red flash)  │
┌──────────────────────┐       │                      │
│  .debrief-drop-      │       └──────────────────────┘
│   target-self        │       Card removed from source.
│  (blue tint)         │       Feed returns to previous
│  Healing/resource    │       display automatically.
│  cards target self   │
└──────────────────────┘
```

---

## 8. Hand Fan (Player) — Card Layout

### Non-Combat (inside NCH Expanded)

```
 ┌─────────────────────────────────────────────────┐
 │  [data-dropzone="hand"]                         │
 │                                                 │
 │   ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐      │
 │   │ 🔫 │  │ 🛡 │  │ 💊 │  │ ⚡ │  │ ■  │      │
 │   │SHOT│  │BLCK│  │HEAL│  │ZAPP│  │BLVK│      │
 │   │ A:2│  │ E:1│  │ F:3│  │ B:2│  │ 0  │      │
 │   └────┘  └────┘  └────┘  └────┘  └────┘      │
 │    [0]     [1]     [2]     [3]     [4]         │
 │                                                 │
 │  Drag cards to: vault, backup, map, debrief    │
 │  BLVCK (■) cannot be dragged anywhere           │
 └─────────────────────────────────────────────────┘
```

### STR Combat (HandFanComponent)

```
                    ┌────┐
               ┌────┤ 03 ├────┐
          ┌────┤ 02 │    │ 04 ├────┐
     ┌────┤ 01 │    └────┘    │ 05 ├
     │    │    └────┘    ┌────┘    │
     │    └────┘         │         │
     └────┘              └─────────┘

  Tap to select → golden border + lift
  Hold to target → crosshair mode
  Timer expires → selected cards auto-commit
  Resolve phase → fan minimizes to joker stack
```

---

## 9. Drag Transfer Map

```
                    ┌──────────────┐
                    │  CARD VAULT  │
                    │  (persistent)│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │  HAND    │  │ BACKUP   │  │   MAP    │
       │  FAN     │◄─┤ SCROLL   │  │ (deploy) │
       │ (5 max)  ├─►│ (25 max) │  │          │
       └────┬─────┘  └──────────┘  └──────────┘
            │              ▲              ▲
            │              │              │
            └──────────────┘              │
            │         (reorder)           │
            │                             │
            └─────────────────────────────┘
                   (deploy to tile)

  ┌──────────────┐
  │ DEBRIEF FEED │ ◄── any card (hand/backup/vault)
  │ (disposal)   │     = incinerate + remove
  └──────────────┘

  Transfer Authority: CardStateAuthority (CSA)
  Transfer Router:    CardTransferManager (CTM)
  Drag System:        Pointer events (pointerdown/move/up)
  Ghost Element:      60×84px card thumbnail follows cursor
```

---

## 10. Enemy Hand Fan (PLANNED — per ENEMY_CARDS.md)

```
  During STR Combat, backup scroll space is repurposed:

  ┌─────────────────────────────────────────────┐
  │  ENEMY HAND (EnemyHandDisplay)              │
  │                                             │
  │   🃏  🃏  🃏  🃏                              │
  │  (hidden backs, count = enemy.cardCount)    │
  │                                             │
  │  Interactions (via equipped player items):  │
  │   REVEAL  → flip face-up (show enemy card)  │
  │   STEAL   → move to player hand             │
  │   DESTROY → remove from enemy hand          │
  │                                             │
  │  Interactable jokers: normal brightness     │
  │  Non-interactable:    .nch-joker-greyed     │
  │                                             │
  │  Data source: enemy-cards.json (EATK-*)     │
  │  Deck mapping: enemy-decks.json             │
  └─────────────────────────────────────────────┘

  Implementation phases (from ENEMY_CARDS.md):
    Phase 0: Enemy attack card database (enemy-cards.json, enemy-decks.json)
    Phase 1: Wire EnemyHandDisplay to actual card data (not just counts)
    Phase 2: Item-based interactability (reveal/steal/destroy)
    Phase 3: Visual distinction (greyed vs interactable jokers)
```

---

## 11. CSS File Map

| CSS File | Covers |
|---|---|
| `non-combat-hud.css` | NCH capsule, expanded view, joker stack, drop zones, BLVCK greyed joker |
| `rogue-sidebar.css` | Left column layout, slot buttons, ghost joker cursor, STR draw mode |
| `hand-fan-component.css` | Combat hand fan, card selection, targeting, incinerator flash |
| `str-combat-window.css` | Combat popup, HP bars, timer, minimize/maximize, intent display |
| `debrief-pipboy.css` | Debrief feed base layout, MOK avatar, resource rows |
| `debrief-scale.css` | Debrief scaling and responsive breakpoints |
| `commerce-drag-drop.css` | Context overlays on debrief: buying (gold), selling (fire), disposing (recycle), gambling (purple), disabled |
| `environmental-synergy.css` | Ground effects, incinerator-active animation, synergy overlays |
| `backup-action-container.css` | ~~LEGACY~~ BAC styles (retired, RogueSidebar replaced) |
| `crt.css` | Master stylesheet: grid, debrief-drop-target, drag-preview-recycling, incinerator-flash |
| `passive-items.css` | Passive item UI indicators |
| `shop-system.css` | Shop overlay, sold-out slots |
| `tooltip-system.css` | Tooltip popover system |

---

## 12. Legacy Terminology Cross-Reference

| Legacy Term (in old docs) | Current Canon | Notes |
|---|---|---|
| BackupActionContainer (BAC) | **RogueSidebar** | BAC retired. `rogue-sidebar.js` is primary left column. |
| `reserve-slots.js` | **`rogue-sidebar.js`** | reserve-slots.js is legacy. |
| "8 card hand max" | **5 card hand max** | `maxHandSize: 5` in gamestate.js |
| "base 4 action button slots" | **6 slots** in RogueSidebar | Fixed 6 slots, not variable. |
| "Loose Inventory" | **Hand Fan** | Same concept, new visual treatment. |
| "Persistent Inventory" | **Card Vault** | 9-12 slots. |
| "Action Buttons" | **Left Column / RogueSidebar** | Mode-aware: items view, cards view, or STR draw. |
| `NonCombatStateStore` | **CardStateAuthority (CSA)** | CSA is the canonical state source. NCStateStore is read-through cache. |
| HTML5 drag events (dragover/drop) | **Pointer events** (pointerdown/move/up) | NCH uses pointer-based drag. CardDisposalSystem's HTML5 drag is disconnected. |

---

## 13. STR Hand Fan State Machine

The hand fan follows a strict phase lifecycle during STR combat.
Phase variable: `_strCombatPhase` in `gone-rogue.js`, exposed via `getStrCombatState().phase`.

```
                    ┌─────────┐
                    │  IDLE   │  (no combat)
                    └────┬────┘
                         │ _enterStrCombat()
                         ▼
                    ┌──────────┐
                    │COUNTDOWN │  3-2-1 overlay (STRCombatWindow)
                    │          │  Hand fan: HIDDEN
                    └────┬─────┘
                         │ countdown finishes → setStrCombatPhase('selecting')
                         ▼
              ┌─────────────────────┐
         ┌───►│     SELECTING       │  Hand fan: EXPANDED (visible, interactive)
         │    │                     │  NCH: accessible (capsule or expanded)
         │    │  Timer running      │  BLVCK injected if stranded
         │    └──────────┬──────────┘
         │               │ timer expires / instant-resolve item / playSelectedCards()
         │               ▼
         │    ┌─────────────────────┐
         │    │     RESOLVING       │  Hand fan: MINIMIZED (joker stack, no interaction)
         │    │                     │  NCH: LOCKED (dimmed, pointer-events:none)
         │    │  Cards + synergies  │  Combat animations play
         │    │  applied            │
         │    └──────────┬──────────┘
         │               │ round resolution complete
         │               ▼
         │    ┌─────────────────────┐
         │    │   POST_RESOLVE      │  Hand fan: RE-EXPANDING (600ms transition)
         │    │                     │  Oldest hand card → backup (push cycle)
         │    │                     │  BLVCK re-evaluated (stranded check)
         │    │                     │  Disposals + resource exchange applied
         │    └──────────┬──────────┘
         │               │ 600ms timeout → phase = 'selecting'
         └───────────────┘

         On combat exit → phase = 'idle', fan hidden
```

### Phase Values

| Phase | `_strCombatPhase` | HandFan State | NCH State | Integration Behavior |
|---|---|---|---|---|
| **IDLE** | `'idle'` | Hidden | Normal capsule/expanded | No combat poll |
| **COUNTDOWN** | `'countdown'` | Hidden (not shown) | Normal | `_showHandFan` returns early |
| **SELECTING** | `'selecting'` | Expanded, interactive | Accessible | Cards shown, timer running, BLVCK check |
| **RESOLVING** | `'resolving'` | Minimized (joker stack) | Locked | `minimize()` called, animations play |
| **POST_RESOLVE** | `'post_resolve'` | Re-expanding | Transitioning | `restore()` called, push oldest card, BLVCK re-check |

### Instant-Resolution Items (PVE)

Items with `instantResolve: true` trait (e.g. Redneck Obliterator) bypass the timer:
when a card is selected in the hand fan, `playSelectedCards()` fires immediately.
Hook: `_checkInstantResolveHook()` in `hand-fan-component.js`.
PVP instant-resolve is a future TODO.

### Key Files

| File | Role |
|---|---|
| `gone-rogue.js` | Sets `_strCombatPhase`, exposes via `getStrCombatState()` and `setStrCombatPhase()` |
| `str-combat-integration.js` | 100ms poll reads phase, drives HandFan show/minimize/restore, detects countdown→selecting |
| `hand-fan-component.js` | `show()` clears stale minimized state, `restore()` force-clears animation fill, `_checkInstantResolveHook()` |
| `str-combat-window.js` | 3-2-1 countdown overlay, timer, `_onTimerExpired` → `handleStrTimerExpired` |

---

## 14. Abbreviation Pipeline — Viewport-Aware Name Display

### Canonical Functions

| Function | Location | Behavior | Max Length |
|----------|----------|----------|------------|
| `NameUtils.abbreviate(name, maxLength)` | `public/js/utils/name-utils.js` | Vowel-drop: keep first letter of each word, remove vowels from rest | Optional (0 = no limit) |
| `NameUtils.formatForMobile(itemOrId)` | `name-utils.js` | Aggressive abbreviation for mobile | 6 chars |
| `NameUtils.formatForShop(itemOrId)` | `name-utils.js` | Moderate abbreviation for shops | 8 chars |
| `NameUtils.getDisplayName(itemOrId, options)` | `name-utils.js` | Unified: converts IDs to names, applies abbreviation | Via options.maxLength |

### Vowel-Drop Convention

```
"Sold Out"      → "SldOt"
"Out"           → "Ot"
"Energy Drink"  → "EnrgyDrnk"
"Rusty Key"     → "RstyKy"
"Attack"        → "Attck"
"inventory"     → "invntry"
```

### Viewport Tiers & Abbreviation Levels

| Tier | Viewport | Abbreviation Level | CSS Container Behavior |
|------|----------|-------------------|----------------------|
| **Desktop Full** | >900px wide | None (full name) | Full button width, text flows naturally |
| **Desktop Compact** | 600-900px | Standard (abbreviate) | Container clips with `overflow:hidden` |
| **Mobile Landscape** | <600px landscape | Standard (abbreviate) | 2-column grid, tighter spacing |
| **Mobile Portrait** | <600px portrait | Micro (first letters only, ~4 chars) | Horizontal band split, aggressive clip |

### Micro-Abbreviator (NEW)

For portrait mode where names must fit in constrained buttons:
```
"Energy Drink" → "ED"
"Rusty Key"    → "RK"
"Sold Out"     → "SO"
```

Implementation: Take only the first letter of each word, max 4 characters.

### Components Using Abbreviation

| Component | File | Abbreviation Used |
|-----------|------|-------------------|
| RogueSidebar (left column) | `rogue-sidebar.js` | `NameUtils.abbreviate(name, 0)` - vowel drop, CSS clips |
| Hand Fan (combat) | `hand-fan-component.js` | `formatForMobile()` in portrait |
| Shop Display | `shop-system.js` | `formatForShop()` |
| Shared Item Renderer | `shared-item-renderer.js` | `abbreviateName()` |
| Reserve Slots | `reserve-slots.js` | `_abbreviateCardName()` |

### Qty Badge Overlay

Quantity badges (e.g., "x2") use absolute positioning to avoid taking flex space:
```css
.rs-qty-overlay {
  position: absolute;
  right: 4px;
  top: 2px;
  font-size: 0.7em;
  opacity: 0.8;
}
/* Only show when qty > 1 */
```

---

## 15. Font Canon

### Font Stack Definitions

| CSS Variable | Font Family | Primary Use | Fallback |
|--------------|-------------|-------------|----------|
| `--font-legible` | `'Classic Console Neue', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas` | Tooltips, stats, quick-read information | `'Courier New', monospace` |
| `--font` | `'Courier New', 'Lucida Console', 'Consolas', monospace` | HUD, titles, narrative text | `monospace` |

### Font Usage Map

| Context | Font | Rationale |
|---------|------|-----------|
| Tooltips | `--font-legible` | Quick info scan, high legibility |
| Stats display | `--font-legible` | Numbers and quick reads |
| Debrief feed | `--font-legible` | Resource bars, scan-able data |
| HUD buttons | `--font` | Terminal aesthetic, titles |
| Narrative text | `--font` | Story elements, MOK dialog |
| Card names (hand) | `--font` | Consistent with terminal theme |
| Card names (shop) | `--font-legible` | Quick recognition |

---

## 16. Color Canon

### Primary CRT Palette (Phosphor Green)

| Variable | Hex | Use |
|----------|-----|-----|
| `--phosphor` | `#33ff33` | Primary text, active elements |
| `--phosphor-dim` | `#1a9c1a` | Secondary text, disabled states |
| `--phosphor-bright` | `#66ff66` | Highlights, hover states |
| `--phosphor-glow` | `rgba(51, 255, 51, 0.15)` | Glow effects, shadows |

### Amber Mode (Alternate Theme)

| Variable | Hex | Use |
|----------|-----|-----|
| `--amber` | `#ffb000` | Primary text in amber mode |
| `--amber-dim` | `#996a00` | Secondary in amber mode |
| `--amber-bright` | `#ffc640` | Highlights in amber mode |
| `--amber-glow` | `rgba(255, 176, 0, 0.15)` | Glow in amber mode |

### Background & Panel

| Variable | Hex | Use |
|----------|-----|-----|
| `--bg` | `#0a0a0a` | Page background |
| `--bg-screen` | `#050805` | CRT screen background |
| `--panel-bg` | `#061208` | Panel backgrounds |
| `--panel-border` | `rgba(51, 255, 51, 0.25)` | Panel borders |
| `--panel-border-soft` | `rgba(51, 255, 51, 0.12)` | Subtle borders |

### Resource Colors (per RESOURCE_COLOR_SYSTEM.md)

| Resource | Hex | Variable Reference |
|----------|-----|-------------------|
| HP | `#FF6B9D` | `RESOURCE_COLOR.HP` |
| Energy | `#00D4FF` | `RESOURCE_COLOR.Energy` |
| Focus | `#FFF9B0` | `RESOURCE_COLOR.Focus` |
| Battery | `#00FFA6` | `RESOURCE_COLOR.Battery` |
| Fatigue | `#A0522D` | `RESOURCE_COLOR.Fatigue` |
| Ammo | `#DA70D6` | `RESOURCE_COLOR.Ammo` |
| Currency | `#FFFF00` | `RESOURCE_COLOR.Currency` |

---

## 17. Button Feel — Transitions & Future Sound Hooks

### Transition Timings

| State | Duration | Easing | Property |
|-------|----------|--------|----------|
| Hover | 120ms | `ease` | `background`, `border-color`, `transform` |
| Active/Press | 80ms | `ease-out` | `transform` (slight press) |
| Focus | 100ms | `ease` | `box-shadow`, `outline` |

### Standard Button Style

```css
.rogue-sidebar-btn {
  background: rgba(8, 24, 12, 0.85);
  border: 1px solid var(--panel-border); /* rgba(51, 255, 51, 0.25) */
  border-radius: 6px;
  color: var(--phosphor);
  font-family: var(--font);
  padding: 6px 4px;
  transition: background 120ms ease, border-color 120ms ease, transform 80ms ease-out;
}

.rogue-sidebar-btn:hover {
  background: rgba(14, 42, 24, 0.95);
  border-color: var(--phosphor-bright);
  transform: translateY(-1px);
}

.rogue-sidebar-btn:active {
  transform: translateY(1px);
}
```

### Sound Hooks (Future)

Buttons should support optional sound via `data-sound` attribute:
```html
<button class="rogue-sidebar-btn" data-sound="button-hover">Inventory</button>
<button class="rogue-sidebar-btn" data-sound="button-click">Back</button>
```

Audio system (future implementation) will read `data-sound` on pointer interactions.

### Mobile Touch Feedback

```css
@media (pointer: coarse) {
  .rogue-sidebar-btn {
    min-height: 44px; /* iOS minimum tap target */
  }
}
```

---

## 18. Audit Checklist — Name Display

Components requiring viewport-aware abbreviation review:

- [ ] **Black Market Vendors** (`shop-system.js`) — Currently uses `formatForShop()`, verify portrait behavior
- [ ] **Enemy Card Interactions** (steal/plant UI) — Per ENEMY_NCH_INTERACTION_ROADMAP
- [ ] **Stealth Mechanics** — Indicator names for sneak/pickpocket states
- [ ] **Tooltip Item Names** (`shared-item-renderer.js`) — Should use `formatForMobile()` in portrait
- [ ] **NCH Capsule Jokers** — Card count display, verify abbreviation
- [ ] **Reserve Slots** (`reserve-slots.js`) — Backup card display names
- [ ] **Hand Fan Cards** — Combat card names should abbreviate in portrait
- [ ] **STR Combat Enemy Hand** — Per ENEMY_CARDS.md Phase 2

### Verification Commands

```bash
# Test abbreviation functions
node public/tests/test-name-utils.js

# Verify font loading
grep -r "Classic Console Neue" public/css/

# Check all button styles use consistent transitions
grep -A5 "transition:" public/css/rogue-sidebar.css
```
