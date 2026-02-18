# Enemy Intent System - Visual Examples

This document provides visual examples of how the intent system appears in actual combat.

## Example 1: Combat Entry

```
⚔️  STR COMBAT INITIATED 🤝
└─ Advantage: NEUTRAL

═══ ROUND 1 RESOLUTION ═══

⚔️  ATTACK — PLAYER: 🎯 Single Shot
├─ HIT! (Roll: 75 vs 60)
├─ Damage: 5
└─ Final: 5 damage → Target HP: 3/5

⚔️  ATTACK — ENEMY [^_^]: 🔫 Single Shot
├─ HIT! (Roll: 68 vs 55)
├─ Damage: 3
└─ Final: 3 damage → Target HP: 7/10

═══════════════════════════

───────────────────────────────────────
PLAYER HP: 7/10 ❤️   |   ENEMY HP: 3/5 💀  O_O 🔫
Advantage: NEUTRAL 🤝
───────────────────────────────────────
```

**What happened**:
- Enemy started calm (^_^)
- After taking damage, enemy became surprised (O_O)
- Intent display shows: `O_O 🔫` (Surprised, holding pistol)

---

## Example 2: Low HP Desperation

```
═══ ROUND 3 RESOLUTION ═══

⚔️  ATTACK — PLAYER: 💥 Burst Shot
├─ HIT! 💥 CRIT! (Roll: 92 vs 60)
├─ Damage: 7
└─ Final: 7 damage → Target HP: 1/5

⚔️  ATTACK — ENEMY [>:(]: 💥 Burst Shot
├─ HIT! (Roll: 71 vs 55)
├─ Damage: 4
└─ Final: 4 damage → Target HP: 3/10

═══════════════════════════

───────────────────────────────────────
PLAYER HP: 3/10 ❤️   |   ENEMY HP: 1/5 💀  >:( 💥
Advantage: NEUTRAL 🤝
───────────────────────────────────────
```

**What happened**:
- Enemy dropped to critical HP (1/5)
- Expression changed to enraged (>:()
- Enemy switched to burst shot (💥) for higher damage
- Intent display shows: `>:( 💥` (Enraged, preparing burst)

---

## Example 3: Ambush Scenario

```
⚔️  STR COMBAT INITIATED 🎯
└─ Advantage: AMBUSH

🎯 PLAYER AMBUSH! Free opening attack!

═══ ROUND 1 RESOLUTION ═══

⚔️  ATTACK — PLAYER: 🎯 Silent Shot
├─ HIT! (Roll: 85 vs 40) [Ambush bonus!]
├─ Damage: 6 + 2 ambush
└─ Final: 8 damage → Target HP: 2/5

═══════════════════════════

───────────────────────────────────────
PLAYER HP: 10/10 ❤️   |   ENEMY HP: 2/5 💀  O_O 🔫
Advantage: AMBUSH 🎯
───────────────────────────────────────
```

**What happened**:
- Enemy was ambushed from stealth
- Expression shows surprise (O_O) from ambush event
- Low HP but not quite enraged yet
- Intent display shows: `O_O 🔫` (Surprised, holding pistol)

---

## Example 4: Weapon Jammed

```
═══ ROUND 2 RESOLUTION ═══

🚨 INTERRUPT — PLAYER: 🔧 Jam Weapon
└─ Enemy weapon jammed!

⚔️  ATTACK — ENEMY [X_X]: 🎯 Single Shot
└─ Attack failed! Weapon is jammed

═══════════════════════════

───────────────────────────────────────
PLAYER HP: 8/10 ❤️   |   ENEMY HP: 4/5 💀  X_X 🎯
Advantage: NEUTRAL 🤝
───────────────────────────────────────
```

**What happened**:
- Player used Jam Weapon interrupt card
- Enemy became dazed/stunned (X_X)
- Enemy attempted attack but weapon jammed
- Intent display shows: `X_X 🎯` (Dazed, weapon jammed)

---

## Example 5: Defensive Stance

```
═══ ROUND 2 RESOLUTION ═══

🛡️  DEFENSE — ENEMY [•_•]: 🛡️ Block
└─ Gained +3 defense

⚔️  ATTACK — PLAYER: 🎯 Single Shot
├─ HIT! (Roll: 72 vs 60)
├─ Damage: 5 - 3 defense
└─ Final: 2 damage → Target HP: 3/5

═══════════════════════════

───────────────────────────────────────
PLAYER HP: 10/10 ❤️   |   ENEMY HP: 3/5 💀  •_• 🛡️
Advantage: NEUTRAL 🤝
───────────────────────────────────────
```

**What happened**:
- Enemy played defensive card
- Expression shows determined (•_•)
- Weapon icon shows shield (🛡️)
- Intent display shows: `•_• 🛡️` (Determined, blocking)

---

## Example 6: Grenade Attack

```
═══ ROUND 2 RESOLUTION ═══

⚔️  ATTACK — ENEMY [>__<]: 💣 Grenade
├─ HIT! (Roll: 80 vs 60)
├─ Damage: 7
└─ Final: 7 damage → Target HP: 3/10

═══════════════════════════

───────────────────────────────────────
PLAYER HP: 3/10 ❤️   |   ENEMY HP: 4/5 💀  >__< 💣
Advantage: NEUTRAL 🤝
───────────────────────────────────────
```

**What happened**:
- Enemy at mid-high HP using attack card
- Expression shows angry/focused (>__<)
- Weapon shows grenade (💣)
- Intent display shows: `>__< 💣` (Focused, throwing grenade)

---

## Intent Display Location Guide

### 1. Combat UI Header (Always Visible)
```
───────────────────────────────────────
PLAYER HP: X/10 ❤️   |   ENEMY HP: Y/5 💀  [GLYPH] [WEAPON]
Advantage: NEUTRAL 🤝
───────────────────────────────────────
```

### 2. Action Log Entries (Each Action)
```
⚔️  ATTACK — ENEMY [GLYPH]: [WEAPON] [Card Name]
├─ [Action details]
└─ [Results]
```

---

## Expression Progression Example

Watch how enemy expression changes throughout a fight:

**Round 1** (Full HP, calm):
```
ENEMY HP: 5/5 💀  ^_^ 🔫
```

**Round 2** (Took damage, surprised):
```
ENEMY HP: 3/5 💀  O_O 🔫
```

**Round 3** (Mid HP, focused):
```
ENEMY HP: 3/5 💀  >__< 💥
```

**Round 4** (Low HP, enraged):
```
ENEMY HP: 1/5 💀  >:( 💥
```

**Round 5** (Weapon jammed, dazed):
```
ENEMY HP: 1/5 💀  X_X 💥
```

---

## Threat Level Visual Guide

### Low Threat
```
^_^ 🔫  (Happy/Calm)
O_O 🔫  (Surprised)
@_@ 🔫  (Confused)
·_· 🔫  (Bored)
```

### Medium Threat
```
>__< 🎯  (Angry/Focused)
¬_¬ 🔫  (Annoyed)
$_$ 🔫  (Greedy)
•_• 🎯  (Determined)
^w^ 🎯  (Pleased)
```

### High Threat
```
>:( 💣  (Enraged)
o_o 💥  (Alert)
```

### No Threat
```
X_X 🎯  (Dazed/Stunned)
-_- ·   (Sleeping)
```

---

## Weapon Type Examples

### Ranged Weapons
- `🔫` - Pistol/SMG (Standard shots)
- `🎯` - Target (Aimed shots)
- `🏹` - Bow (Precision ranged)

### Explosive Weapons
- `💣` - Grenade (Area damage)
- `🔥` - Fire (Burn damage)

### Melee Weapons
- `🔪` - Knife (Quick melee)
- `🪓` - Axe (Heavy melee)

### Special Weapons
- `⚡` - Tazer (Stun)
- `🧪` - Chemical (Status)
- `⛓️` - Grapple (Control)

### Defensive
- `🛡️` - Shield (Block/defense)
- `🔦` - Flashlight (Utility)

---

## Player Response Strategy

Based on intent display, players can:

### Against `>:( 💥` (Enraged + Burst)
- ✅ Use interrupt cards (Jam Weapon, Overwatch)
- ✅ Play defense cards (Block, Dodge)
- ❌ Avoid low-priority setup cards

### Against `•_• 🛡️` (Determined + Shield)
- ✅ Use armor-piercing cards
- ✅ Set up combos for next round
- ❌ Avoid direct attacks (will be blocked)

### Against `X_X 🎯` (Dazed + Jammed)
- ✅ Aggressive attacks (enemy defenseless)
- ✅ High-priority strikes
- ❌ Don't waste defensive cards

### Against `O_O 🔫` (Surprised + Pistol)
- ✅ Follow-up attacks while vulnerable
- ✅ Capitalize on confusion
- ⚠️ Watch for defensive reaction next round

---

## Future Enhancements Preview

### Charging Attacks (Planned)
```
Round 1: ENEMY HP: 5/5 💀  •_• ⚡ [CHARGING...]
Round 2: ENEMY HP: 5/5 💀  •_• ⚡ [CHARGED! x2]
```

### Boss Special Intents (Planned)
```
BOSS HP: 100/100 👑  $⌐$ 💀 [ULTIMATE READY]
```

### Player Emotion Display (Implemented, UI Pending)
```
PLAYER HP: 8/10 ❤️  [>:)] |   ENEMY HP: 2/5 💀  >:( 💥
   (Aggressive)               (Enraged)
```

---

*Last updated: 2026-02-18*
