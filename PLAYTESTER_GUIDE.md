# Gone Rogue - Playtester Guide

## Welcome, Playtester!

This guide contains everything you need to know to playtest **Gone Rogue**, the ASCII stealth roguelike minigame embedded in the EYES ONLY command terminal.

---

## Quick Start

### Getting Started
1. **Access the terminal**: Launch the game and open the command terminal
2. **Start Gone Rogue**: Type `rogue` and press Enter
3. **Choose difficulty**: Select from 3 difficulty tiers (affects enemy count, floor count, and rewards)

### Basic Controls

#### Desktop/Keyboard
- **Movement**: `N/S/E/W` (or `WASD`)
- **Shoot**: `SHOOT <direction>` (e.g., `shoot n`)
- **Kick**: `KICK <direction>` to break adjacent objects
- **Pick up items**: `TAKE` or `PICKUP`
- **Extract**: `EXTRACT` (when standing on exit 🚪)
- **Status**: `STATUS` or `STATS`
- **Inventory**: `INVENTORY` or `INV`
- **Help**: `HELP` for full command list

#### Mobile/Touch
- **Tap-to-move**: Tap any walkable tile to move there
- **Swipe cards**: Swipe left/right on cards during combat
- **Tap items**: Tap to pick up
- **Card selection**: Access via 🃏 CARDS button (outside combat only)

---

## Core Gameplay

### Objective
Navigate through 30 procedurally generated floors, collect loot, defeat enemies, and reach the final extraction point.

### Floor Types

| Floors | Type | Description | Enemies |
|--------|------|-------------|---------|
| 1-2 | Tutorial | Learn the basics | None |
| 3-4 | **Ghost** | ⚠️ Currently empty - surveillance system planned | **Known Issue** |
| 5-9 | Standard | Normal difficulty | 3-5 enemies |
| 10 | Bonfire | Safe zone, vendor available | None |
| 11-15 | Standard | Increasing difficulty | 4-6 enemies |
| 16 | Bonfire | Safe zone, vendor | None |
| 17-21 | Hard | Tougher enemies | 5-7 enemies |
| 22 | Bonfire | Safe zone, vendor | None |
| 23-29 | Very Hard | Elite enemies possible | 6-8 enemies |
| 30 | **Boss** | Final boss encounter | 1 Boss |

**⚠️ Known Issue**: Ghost floors (3-4) currently have no enemies due to incomplete implementation. This is tracked in our issue tracker.

### The Grid
- **40x20 ASCII grid** displaying your tactical view
- **Tiles**:
  - `@` = You (player)
  - `👁` = Enemy
  - `📦` = Breakable object (may contain loot!)
  - `🚪` = Exit/Extraction point
  - `🛒` = Shop (bonfire floors only)
  - `💎` = Item/Card drop
  - `¢` = Crypto currency
  - `.` = Floor (walkable)
  - `#` = Wall (blocks movement)
  - `~` = Shadow (stealth bonus)
  - `☁` = Smoke (concealment)

---

## Combat System

### Enemy Awareness
Enemies have a **Metal Gear-inspired awareness system**:
- **Unaware** (green): Haven't detected you
- **Suspicious** (yellow): Heard noise or saw movement
- **Alert** (red): Actively hunting you

**Stealth Tips**:
- Stay in shadows (`~`) for stealth bonus
- Avoid running near enemies (increases noise)
- Break line of sight to lose alert enemies
- Use smoke (`☁`) for concealment

### STR Combat
When you collide with an enemy, **STR (Simultaneous Turn Resolution) combat** begins:

1. **Combat Window Opens**: Shows your HP, enemy HP, and combat state
2. **Advantage States**:
   - **Ambush**: Attack from behind/shadows (+damage, +accuracy)
   - **Neutral**: Standard fair fight
   - **Disadvantaged**: Enemy spotted you first
   - **Flanked**: Surrounded by multiple enemies (-defense)

3. **Card Selection**: Choose cards from your deck to attack or defend
4. **Simultaneous Resolution**: Both you and enemy act at the same time
5. **Victory or Defeat**: Continue exploring or face death penalty

**Combat Commands**:
- Select cards by number or name
- `FLEE` to attempt escape (risky!)

---

## Loot & Progression

### Currency System
- **Cryptos (¢)**: Collect from breakables and defeated enemies
- **Uses**: Purchase items at bonfire vendors, upgrade gear

### Card System
Cards are your primary combat tools:

**Card Types**:
- **Attack Cards**: Deal damage (e.g., Slash, Stab, Shoot)
- **Stance Cards**: Defensive postures (e.g., Guard, Dodge, Parry)
- **Utility Cards**: Buffs/debuffs (e.g., Aim, Sprint, Heal)
- **Tactical Cards**: Special maneuvers (e.g., Flank, Ambush)

**Card Quality Tiers** (9 levels):
1. Damaged (gray) - Poor quality
2. Worn (white) - Basic
3. Standard (green) - Common
4. Quality (blue) - Uncommon
5. Superior (purple) - Rare
6. Exceptional (orange) - Epic
7. Legendary (gold) - Very rare
8. Mythic (red) - Extremely rare
9. Transcendent (rainbow) - Ultimate

**Drop Rates**:
- **30% from breakables** (📦)
- **50% from enemies** (👁)
- Higher quality = rarer drops

### Inventory Management
- **Persistent Slots (9-12)**: Safe across death
- **Loose Carry (8 slots)**: **Lost on death!**
- **Active Item**: Currently equipped card/item

**Tip**: Store valuable cards in persistent slots before risky encounters!

---

## Special Systems

### Pet Follower System (NEW!)

Pets are companions that follow you through the dungeon:

**Pet Tiers**:
1. **Rumba/Pikachu (🐭)**: Cosmetic pet with small passive buffs
   - +2% scrap proc chance
   - +1 stealth grace
   - +5% breakable drop chance

2. **Humanoid Breaker (🧍)**: Automatically breaks nearby breakables
   - 20-75% break chance (quality-dependent)
   - 1-2 tile radius

3. **Mega Tanya (🔫)**: Provides combat bonuses
   - +5-10% accuracy
   - +0.2-0.4 crit multiplier (when enemy stunned)
   - 5% chance for auto-strike (3-6 damage)

**Note**: Only 1 mega pet allowed at a time (jealousy system).

**Death Timer**: Pets have limited lifespan (5-15 minutes based on quality).

**Testing Pet System**:
1. Start Gone Rogue
2. Open browser console (F12)
3. Type: `GoneRogue.spawnTestPets()`
4. Move around to see pets following!

### Environmental Synergy System

**Key + Gate Mechanic** (per GONE_ROGUE_SYNERGY_GUIDE.md):

**Key Types**:
- 🔑 **Rusty Key** (Common): Opens wooden gates, old doors
- 🗝️ **Bronze Key** (Uncommon): Opens bronze gates, museum doors
- 💳 **Keycard** (Rare): Opens security doors (reusable!)
- 🔐 **Master Key** (Very Rare): Opens everything

**How It Works**:
1. Break objects to find keys
2. Collect keys to your inventory
3. Use keys on matching gates to unlock shortcuts
4. Keycards are reusable, other keys are consumed

**⚠️ Implementation Note**: Environmental synergy API is initialized but key drops and gate placement are not fully integrated yet. This may be added in future updates.

### Boss Encounters

**Boss Floors**: 10, 16, 22, 30

Each boss has:
- **10 unique boss types** with different mechanics
- **Mythic conditions**: Special requirements (e.g., must use specific card type)
- **Legendary loot**: Guaranteed high-quality drops on victory
- **First-cause mechanics**: Pre-combat card selection affects fight initialization

**Example Bosses**:
- **Cyber Sentinel**: Hacks your cards, forcing you to adapt
- **Shadow Stalker**: Teleports and ambushes
- **Tank Commander**: High HP, area damage
- *(More bosses to discover!)*

### Vents & Floor Skipping

**Vent System** (per QUICKSTART_VENTS.md):
- Find vents (rare) on certain floors
- **Success**: Skip 2 floors forward (bonus XP)
- **Failure**: Fall back 3 floors (penalty enemies spawn)
- **Bypass chance**: 75% base, reduced by floor depth and prior vent uses

**Risk vs Reward**: Vents let you skip floors but have consequences on failure!

---

## Playtesting Focus Areas

### What to Test

1. **Core Gameplay Loop**
   - [ ] Floor generation variety
   - [ ] Enemy AI responsiveness
   - [ ] Combat balance (too easy/hard?)
   - [ ] Loot drop rates (too generous/stingy?)

2. **Mobile Experience**
   - [ ] Touch controls responsiveness
   - [ ] Card swipe gesture accuracy
   - [ ] UI element sizes on different devices
   - [ ] Frame rate on low-end devices

3. **Progression Systems**
   - [ ] Currency accumulation rate
   - [ ] Card deck building viability
   - [ ] Persistent vs loose inventory balance
   - [ ] Death penalty fairness

4. **Special Features**
   - [ ] Pet system functionality
   - [ ] Boss encounters (floors 10, 16, 22, 30)
   - [ ] Bonfire vendors and shop system
   - [ ] Vent system risk/reward

### Known Issues to Verify

1. **Ghost Floors Empty**: Floors 3-4 have no enemies (documented bug)
2. **Environmental Synergy Incomplete**: Key drops and gate placement not integrated
3. **Mobile Frame Rate**: May stutter on low-end devices with 4+ patrol enemies

### Feedback We Need

**Please report**:
- Crashes or freezes
- UI elements that are hard to see/use
- Balance issues (too easy, too hard, unfair deaths)
- Confusing mechanics or unclear instructions
- Performance problems (lag, stuttering)
- Any bugs or unexpected behavior

**Feedback Format**:
```
Floor #: [Which floor?]
Issue: [What happened?]
Expected: [What should happen?]
Device: [Desktop/Mobile, browser]
Screenshot: [If possible]
```

---

## Technical Details (For Reference)

### Performance Budget
- **Recommended**: 4 or fewer patrolling enemies per floor
- **Why**: Each patrol enemy runs sight-cone checks every 100ms
- **Optimization**: Light-map recalculation throttled to 500ms

### File Structure
- **Main engine**: `public/js/gone-rogue.js` (8,969 lines)
- **Mobile handler**: `public/js/gone-rogue-mobile.js` (2,305 lines)
- **Canvas renderer**: `public/js/gone-rogue-canvas.js` (438 lines)
- **Pet system**: `public/js/pet-follower.js` (313 lines)
- **Environmental synergy**: `public/js/environmental-synergy.js` (319 lines)

### Save System
- **Auto-save**: Game state saved on floor transitions
- **Death recovery**: Persistent inventory preserved
- **Browser storage**: Local storage used for save data

---

## FAQ

**Q: How do I get better cards?**
A: Break more objects (📦), defeat enemies (👁), and visit bonfire vendors. Higher floors have better loot!

**Q: What happens when I die?**
A: You lose all items in "loose carry" slots but keep persistent inventory. You restart from floor 1.

**Q: Can I restart without losing progress?**
A: Currency and some persistent items carry over, but floor progress resets on death.

**Q: Why are floors 3-4 empty?**
A: Ghost floors are incomplete - the camera/drone surveillance system is not yet implemented. This is a known issue.

**Q: How do I access the card selection menu?**
A: Click the 🃏 CARDS button in the footer (only available outside combat).

**Q: What's the best strategy for beginners?**
A: Stay in shadows, avoid running near enemies, break every object you find, and save good cards in persistent slots!

**Q: How do I spawn test pets?**
A: Open browser console (F12) and type: `GoneRogue.spawnTestPets()`

---

## Resources & Documentation

### For Playtesters
- This guide (you are here!)
- `QUICKSTART_VENTS.md` - Vent system details
- `docs/GONE_ROGUE_TUTORIAL.md` - Step-by-step tutorial

### For Developers
- `GONE_ROGUE_SYNERGY_GUIDE.md` - Environmental synergy implementation
- `docs/boss-encounters.md` - Boss system design
- `docs/pet-follower-integration.md` - Pet system integration
- `STR_COMBAT_UI_README.md` - Combat UI specifications
- `CARD_SYNERGY_SYSTEM.md` - Card synergy mechanics

---

## Contact & Feedback

**Report Issues**:
- Open GitHub issues for bugs
- Use in-game feedback system (if available)
- Contact development team via Discord/email

**Playtest Version**: 2.0.0
**Last Updated**: 2026-02-20

---

Thank you for playtesting Gone Rogue! Your feedback helps make this game better. Have fun storming the dungeon! 🎮🗡️

---

## Appendix: Command Reference

### Movement Commands
```
N, NORTH, W     - Move north
S, SOUTH, X     - Move south
E, EAST, D      - Move east
W, WEST, A      - Move west
NE, NW, SE, SW  - Diagonal movement
```

### Combat Commands
```
SHOOT <dir>     - Fire projectile
KICK <dir>      - Kick breakable
FLEE            - Attempt to escape combat
```

### Utility Commands
```
TAKE, PICKUP    - Pick up item
EXTRACT         - Extract at exit point
STATUS, STATS   - Show player stats
INVENTORY, INV  - Show inventory
HELP            - Show command list
EXIT, QUIT      - Exit Gone Rogue
```

### Bonfire Commands (Safe Zones)
```
VENDOR, SHOP    - Open vendor menu
REST            - Restore HP (if available)
SAVE            - Manual save game
```

---

*"Stay in the shadows, collect the loot, and make it to extraction. Good luck, agent!"* 🕵️
