# Gone Rogue - Player Tutorial

## Introduction

Welcome to **Gone Rogue**, a stealth-action ASCII roguelike embedded within the EYES ONLY command terminal. Survive procedurally generated facilities, evade enemy patrols, collect tactical cards, and extract with your life.

---

## Getting Started

### Accessing Gone Rogue

From the command terminal, type:
```
ROGUE
```

You'll be transported into a fragmented memory subsystem where tactical survival is your only option.

### Game Objective

**Survive and Extract**: Reach the exit (▼) on each floor while avoiding or defeating enemies. Successfully extract to keep your inventory and unlock persistent upgrades.

---

## Core Mechanics

### Movement & Controls

**Text Commands:**
- `n` / `north` / `w` - Move North
- `s` / `south` / `x` - Move South
- `e` / `east` / `d` - Move East
- `a` / `west` - Move West

**Mobile Touch Controls:**
- Tap any cell to move there (pathfinding)
- Double-tap a cell to **run** (faster, but noisier - increases enemy awareness)

**Keyboard Shortcuts:**
- `help` - Display commands
- `status` - View player stats
- `inventory` / `inv` - View cards
- `extract` - Attempt extraction (must be on exit tile)
- `exit` / `quit` - Leave Gone Rogue

### Stealth System

**Awareness States:**
- **UNAWARE** (Green): Enemy hasn't detected you
- **SUSPICIOUS** (Orange): Enemy heard noise or saw movement
- **ALERTED** (Red): Enemy actively searching for you
- **ENGAGED** (Magenta): Full combat awareness

**Stealth Bonuses:**
- **Shadows (⬛)**: -30% enemy detection range
- **Grass (🟩)**: -20% enemy detection range
- **Smoke (🌫️)**: -40% enemy detection range
- **Cover (▓)**: Blocks line of sight entirely

**Detection Tips:**
- Enemies have 60° sight cones in their facing direction
- Running increases detection radius by +15
- Awareness decays -5 per second when you're out of sight
- Flanking enemies from behind grants combat advantages

---

## Combat System

### STR (Simultaneous Turn Resolution)

When you collide with an enemy, you enter **STR combat** - a tactical turn-based mode where initiative and positioning matter.

**Advantage States:**
- **Ambush**: You surprised the enemy (unaware state) → +20% hit, +30% damage
- **Neutral**: Both combatants are ready → Standard combat
- **Disadvantaged**: Enemy detected you first → -10% hit
- **Flanked**: Enemy attacked you from behind → -20% hit, +20% damage taken

**Combat Commands:**
- Type card names or numbers to play cards (e.g., `1`, `single shot`, `prone`)
- `flee` - Attempt to escape combat (repositions you backward)

### Card System

Cards are your primary combat tools. You start with 5 **Starter Deck** cards:

1. **Single Shot** 🎯 - Basic ranged attack (3 dmg, 2 energy)
2. **Burst Shot** 💥 - Multi-hit attack (5 dmg, 3 energy)
3. **Prone** 🛡️ - Defensive stance (+3 defense, +2 stealth)
4. **Dodge** 💨 - Evasion stance (+3 evasion, 2 energy)
5. **Katchup** 🩹 - Heal 3 HP

**Card Types:**
- **Attack Cards**: Deal damage to enemies
- **Stance Cards**: Defensive/evasive positioning
- **Utility Cards**: Healing, stress relief, buffs
- **Tactical Cards**: Movement and escape options

**Card Quality Tiers:**
1. Cracked (Gray) - 0.7x stats
2. Worn (Light Gray) - 0.85x stats
3. Standard (White) - 1.0x stats
4. Fine (Light Blue) - 1.15x stats
5. Superior (Yellow) - 1.3x stats
6. Elite (Orange) - 1.5x stats
7. Masterwork (Gold) - 1.7x stats
8. Near Perfect (Light Green) - 1.9x stats
9. **Perfect (Violet)** - 2.0x stats + guaranteed affixes

**Affixes (Rare Modifiers):**
- **Suppressed**: -50% noise on attacks
- **Armor Piercing**: +20% damage
- **Ghillie Threaded**: +2 stealth on stance
- **Unfiltered**: Attack boost but drains HP

---

## Progression & Economy

### Currency: Cryptos (¢)

Cryptos are persistent currency that survive death.

**How to Earn Cryptos:**
- **Breakables**: 70% chance to drop 1-3¢ when destroyed
- **Enemies**: 2-6¢ guaranteed on defeat
- **Walk over yellow ¢ symbols** to collect

**How to Use Cryptos:**
- Purchase cards from vendors at bonfires (coming soon)
- Unlock persistent inventory slots
- Heal and restock supplies

### Inventory System

**Loose Carry (8 slots):**
- Temporary inventory
- **Lost on death**
- Holds cards found during a run
- Automatically picks up cards from breakables/enemies

**Persistent Inventory (9-12 slots):**
- **Safe across death**
- Starts at 9 slots, expands to 12 with successful extractions
- Archive your best cards here before risky floors

**Inventory Commands:**
- `inventory` / `inv` - View current cards
- At bonfires: Sort, discard, or transfer between loose and persistent

---

## Environmental Hazards & Objects

### Breakables

**Crates (📦), Barrels (🧱):**
- HP: 2-3
- Break with: `kick north` or `shoot east`
- **Drops**: 70% currency, 30% cards

### Hazards

**Fire/Acid (🟥):**
- Deals 1 HP damage per turn
- Avoid or use for tactical positioning

**Water (🟦):**
- Movement penalty: -1 energy cost

### Projectiles

**Shooting System:**
- `shoot` / `fire` + direction (e.g., `shoot north`)
- Projectiles travel in straight lines
- Destroys breakables
- Triggers STR combat if it hits an enemy

---

## Enemy AI & Patrol Patterns

Enemies follow predictable patrol routes:

1. **Stationary**: Rotate in place
2. **Patrol**: A → B → C → B (reverse on endpoint)
3. **Circular**: A → B → C → D → A (loop)
4. **Ellipse**: Smooth elliptical path

**Enemy Behavior:**
- Sight Range: 5-7 tiles (scales with floor difficulty)
- Orientation Indicators: Small arrows show facing direction
- Sound Detection: Running triggers +15 awareness within 5 tiles

**Defeating Enemies:**
- STR Combat: Collide to trigger turn-based combat
- Ranged Takedown: Shoot from distance (triggers combat if hit)
- Avoidance: Use stealth zones and timing to bypass patrols

---

## Floor Progression & Difficulty

### Floor Structure

Floors are procedurally generated with:
- **4-8 rooms** (size scales with difficulty)
- **L-shaped corridors** (2-tile wide for maneuvering)
- **Cover zones** (6-10% of floor)
- **Shadow zones** (15% of floor)
- **Environmental hazards** (fire on late floors)

### Difficulty Scaling

**Floors 1-3 (Early):**
- 4-6 enemies, 5-tile sight, 40% stationary
- Grass and shadow zones common

**Floors 4-7 (Mid):**
- 7-10 enemies, 5-tile sight, mixed patrols
- Hazard tiles introduced

**Floors 8+ (Late):**
- 12-18 enemies, 7-tile sight, 60% active patrols
- Dense enemy coverage, limited safe paths

### Extraction

To extract:
1. Reach the exit tile (▼)
2. Type `extract`
3. **Success**: Keep all inventory, +1 persistent slot (if < 12)
4. **Death**: Lose loose inventory, keep persistent inventory and cryptos

---

## Advanced Tactics

### Flanking

Attack enemies from behind (opposite their facing direction) for:
- **Ambush advantage** in STR combat
- +20% hit chance
- +30% damage

### Stealth Paths

Each floor guarantees a stealth path from spawn to exit. Look for:
- Shadow zones connecting rooms
- Cover clusters for line-of-sight breaks
- Enemy patrol gaps (timing-based)

### Energy Management

Cards cost **energy**. Player starts with:
- **5 max energy**
- Energy regenerates slowly per turn
- Rations (🍖) restore +1 energy

### Detection Management

Reduce detection by:
- Moving through shadows/grass
- Waiting in cover (detection decays -5/sec)
- Avoiding line of sight during enemy patrols

---

## Bonfire System (Coming Soon)

**Bonfires** appear every 3-5 floors (except final 5 levels).

**At a Bonfire:**
- **Vendor Shop**: Buy cards with cryptos
- **Heal**: Restore 30-50% HP
- **View Stats**: Check run statistics
- **Manage Cards**: Discard unwanted cards, sort inventory
- **Save Progress**: Prompted to login if not authenticated

**Final Floor:**
- Guaranteed bonfire before the last level
- No vendors in final 5 levels (use your resources wisely)

---

## Tips for New Players

1. **Start Stealthy**: Learn enemy patterns before engaging
2. **Collect Everything**: Break crates early for currency and cards
3. **Save Best Cards**: Transfer elite/masterwork cards to persistent inventory
4. **Use Terrain**: Shadows and cover are your best friends
5. **Flee When Overwhelmed**: Better to retreat and heal than die
6. **Manage Energy**: Don't spam high-cost cards in early combat rounds
7. **Flank When Possible**: Ambush advantage can turn a fight instantly
8. **Watch Sight Cones**: Mobile UI shows red highlights for enemy vision

---

## Mobile-Specific Features

### Touch Controls

- **Tap-to-Move**: Single tap moves player to that cell
- **Double-Tap-to-Run**: Faster movement, higher noise
- **Card Swipe**: Swipe cards in 4 directions to use them
  - ↑ Up: Offensive action
  - → Right: Attack
  - ← Left: Defensive stance
  - ↓ Down: Discard card

### Visual Indicators

- **Player (@)**: Pulsing green glow
- **Enemies (E)**: Color-coded by awareness (green/orange/red/magenta)
- **Items (*)**: Yellow sparkle animation
- **Exit (▼)**: Glowing green beacon
- **Cryptos (¢)**: Yellow dot on floor

---

## Glossary

| Term | Definition |
|------|------------|
| **STR** | Simultaneous Turn Resolution - Turn-based combat mode |
| **Awareness** | Enemy detection level (0-150 scale) |
| **Cryptos (¢)** | Persistent currency |
| **Loose Carry** | Temporary inventory (lost on death) |
| **Persistent Inventory** | Safe inventory (kept on death) |
| **Affixes** | Rare card modifiers (e.g., Suppressed, Armor Piercing) |
| **Flanking** | Attacking from enemy's rear arc |
| **Stealth Path** | Guaranteed route from spawn to exit using cover |

---

## Frequently Asked Questions

**Q: What happens if I die?**
A: You lose all loose inventory but keep persistent inventory and cryptos. You respawn at the Street Chronicles terminal.

**Q: How do I save my progress?**
A: Progress is auto-saved to localStorage. Login at a bonfire to sync with the server.

**Q: Can I replay floors?**
A: No - each run is procedurally generated. Death resets the run.

**Q: What's the max inventory size?**
A: Persistent: 12 slots (expandable), Loose: 8 slots (fixed)

**Q: How do I get better cards?**
A: Defeat enemies, break crates, or buy from bonfire vendors.

**Q: Is there a final boss?**
A: Not yet - current goal is extraction. Boss encounters planned for future updates.

---

## Controls Reference Card

### Movement
```
    W/N (North)
A/West      E/D (East)
    S/X (South)
```

### Combat
```
[Card Number] - Play card
FLEE - Escape combat
```

### Actions
```
SHOOT/FIRE [direction] - Fire projectile
KICK/BOOT [direction] - Melee breakable
TAKE/PICKUP/GET - Collect item
EXTRACT - Leave floor (at exit)
```

### Info
```
STATUS/STATS - View player info
INVENTORY/INV - View cards
HELP - Command list
EXIT/QUIT - Leave Gone Rogue
```

---

## Advanced Combat Mechanics (Future)

### Timing System (Planned)

- **Block Window**: 0.6s to time perfect blocks (30% damage reduction)
- **Melee Window**: 0.5s for crit strikes (2x damage)
- **Chain Attacks**: Perfect timing grants 40% chain chance

### Status Ailments (Planned)

- **Poison** (🟢): Damage over time
- **Shock** (⚡): Movement jitter
- **Freeze** (❄️): Reduced speed
- **Fear** (😱): Accuracy penalty
- **Rage** (🔥): Damage boost, defense penalty

### Emoticon Combat (Planned)

Combatants will display emotion-based indicators:
- **^__^** (Confident) - Normal state
- **>_<** (Charging) - Preparing attack
- **T__T** (Hurt) - Taking damage
- **=_=** (Guarding) - Defensive stance
- **x__x** (Knocked Out) - Defeated

---

## Narrative Context

Gone Rogue is a **memory fragmentation subsystem** within the EYES ONLY terminal. As your character delves deeper into corrupted archive sectors, the ASCII visualization represents degraded signal processing.

- **Persistent Inventory** = Archived memory sectors
- **Loose Carry** = Temporary cache (lost on signal failure)
- **Cryptos** = Decryption tokens
- **Enemies** = Defense systems in degraded network
- **Extraction** = Successful memory reconstruction

The deeper you go, the more hostile the archive defense becomes.

---

## Credits & Support

**Gone Rogue** is part of the EYES ONLY project.

- Report bugs: [GitHub Issues](https://github.com/humiliati/EyesOnly/issues)
- Documentation: `/home/runner/work/EyesOnly/EyesOnly/docs/`
- Community: [Discord/Forum Link]

---

**Good luck, operative. Extract successfully.**
🎯 *EYES ONLY - CLASSIFIED*
