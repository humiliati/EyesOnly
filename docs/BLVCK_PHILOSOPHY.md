# BLVCK Philosophy

### The Empty Slot, the Struggle Card, and the Universal Negative Space

---

## What BLVCK Is

BLVCK (`ACT-000`) is the game's representation of *nothing useful*. It is both a player mechanic and an enemy mechanic, and in both cases it means the same thing: **this slot has no real card in it**.

For the player, BLVCK appears when you're stranded — when every card in your hand is too expensive to play. The system injects BLVCK into slot 0 as a desperation option: free, 1 damage, the bare minimum to keep combat moving. It auto-removes the moment you regain the ability to play something real. You can't discard it, move it, or drag it anywhere. It's not a card you own — it's the game acknowledging you have nothing.

For enemies, BLVCK is the empty slot. Every enemy spawns with at least one BLVCK slot in their `cardDeck`. It represents a gap in their hand — a vulnerability the player can exploit by planting explosives or poisons into it. When an enemy has all their real cards stolen and only BLVCK remains, they play it in desperation with the `(ಥ_ಥ)` face. Enemies can also *gain* BLVCK slots: stealing a card from an enemy leaves a BLVCK behind. Destroying a card does the same. The more you take from an enemy, the more BLVCK fills their hand.

BLVCK is the negative space of the card system. It exists to be filled, replaced, or endured.

---

## Visual Identity

BLVCK should look like absence. Not like a card. Not like a placeholder. Like a hole in the hand where a card should be.

### Current Problems (pre-restyle)

The current BLVCK card uses `■` (U+25A0, black square) as its emoji. This is wrong for several reasons. It renders as a green square on many platforms (Samsung, older Android) which breaks the visual language entirely. It doesn't read as "empty" or "missing" — it reads as a UI element. In the CH combat capsule, when BLVCK is in the hand alongside real cards, the `■` looks like a broken render rather than an intentional void.

### Target Identity

BLVCK should use `🃏` (U+1F0CF, joker playing card) as its emoji — the same glyph used throughout the NCH capsule system — but rendered with the `.nch-joker-greyed` treatment: grayscale, 50% brightness, 55% opacity. This creates a visual through-line: the greyed joker in the NCH capsule IS BLVCK, the greyed joker in the CH combat capsule IS BLVCK, the greyed joker in an enemy's hand IS BLVCK. One glyph, one treatment, one meaning.

### Card Rendering (Hand Fan, NCH Expanded)

When BLVCK appears as a full card in the hand fan or the NCH expanded hand zone:

- **Background:** Near-black, highly transparent — `rgba(8, 8, 8, 0.92)` with minimal border
- **Border:** Barely visible — `rgba(60, 60, 60, 0.35)`, no glow, no underglow
- **Emoji area:** Greyed 🃏 at reduced size, centered, with the grayscale+dim filter
- **Card name:** "BLVCK" in a stylized serif font stack — `'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif` — uppercase, tracked wide, muted color `rgba(100, 100, 100, 0.7)`. The serif face gives it a classical, carved-in-stone quality that sets it apart from every other card's Courier New monospace
- **Cost badge:** Hidden or set to "0" in matching muted style — BLVCK is free, the cost display is noise
- **No quality glow:** BLVCK has no rarity border treatment. It's common, but even the common frame glow should be suppressed
- **No passive rows:** No effect emoji rows. BLVCK's 1-damage effect is too minor to display
- **Not selectable in multi-select:** During STR combat card selection, BLVCK should only be selectable when it's the ONLY card (stranded state). If real cards exist alongside BLVCK, it should render as non-interactive until stranded

### Capsule Rendering (NCH Minimized, CH Combat, Enemy Capsule)

In every capsule context, BLVCK renders identically:

- Glyph: `🃏`
- Class: `.nch-joker-greyed` (grayscale 100%, brightness 50%, opacity 55%)
- No `.nch-joker-active` ever — BLVCK never "reveals" to a different emoji because its emoji IS the joker

This is the critical unification. The greyed joker has one meaning everywhere: this slot is empty / this card is BLVCK / there's nothing real here.

---

## Role in Each System

### Player Hand (Exploration + Combat)

BLVCK is a safety net. The `CardStateAuthority.checkBlvckState()` lifecycle runs on every hand change, resource change, and poll tick (350ms). When the player is stranded, BLVCK injects at slot 0. When they recover, it ejects.

Rules:
- Cannot be dragged, discarded, moved to backup, or sold
- Cannot be drawn from backup (guard in `drawFromBackup`)
- Cannot be pushed to backup (guard in `pushOldestHandToBackup`)
- Occupies slot 0, ejecting the last non-BLVCK card to backup if hand is full
- Shows tooltip `"■ STRUGGLE — no playable cards"` on injection

### Enemy Hand (Exploration + Combat)

BLVCK is a structural slot. Every enemy spawns with at least one BLVCK entry in `cardDeck` via `enemy-deck-hydrator.js`. Additional BLVCK slots appear when the player steals or destroys cards.

Slot states:
- `{ id: 'ACT-000', isBlvckSlot: true, stolen: false, planted: null }` — empty, plantable
- `{ id: 'ACT-000', isBlvckSlot: true, stolen: false, planted: { cardId: '...', turn: N } }` — has a planted card

Policy flags (from THEFT_MECHANICS.md §10):
- `stealable: false` — can't steal nothing
- `plantable: true` — the whole point
- `destroyable: false` — can't destroy nothing
- `triggerable: false` — no synergy potential

When the enemy's hand is ALL BLVCK (every real card stolen), the enemy plays BLVCK as a 0–2 damage desperation attack with `(ಥ_ಥ)` face expression and the PARANOIA mutation stack maxes out.

### NCH Capsule (Exploration, Minimized)

In the default NCH capsule view, BLVCK cards in the player's hand render as greyed jokers. If the hand is ALL BLVCK (stranded + only BLVCK), the capsule collapses to a single greyed joker. This communicates "your hand is empty/useless" at a glance.

### CH Combat Capsule (STR Combat, Minimized)

When the STR combat window minimizes (drag, lunge animation, dwell), the CH capsule renders the player's combat hand as intelligent nodes. BLVCK nodes:
- Always render as `🃏` with `.nch-joker-greyed`
- Never gain `.nch-joker-active` (no emoji transition — BLVCK IS the joker)
- Never gain `.nch-joker-resolving` (BLVCK can only be played alone when stranded; if it's resolving, the entire capsule is already in resolution state)

### Enemy Capsule (Exploration, Map Overhead)

On the world map, enemy NCH capsules (ENI Phase 1) render each enemy card as a joker node above the enemy tile. BLVCK slots render as greyed jokers — visually identical to BLVCK in the player's capsule. This teaches the player the visual vocabulary before they even interact: *greyed joker = empty slot = plantable target*.

### Interchange UI (Steal/Plant Surface)

During the side-by-side interchange (ENI Phase 2), BLVCK slots in the enemy's row render as:
- `.nch-joker-greyed` base (empty slot)
- `.nch-joker-plantable` overlay when the player has a plantable card equipped (orange pulsing border)
- After planting: the planted card's emoji replaces the joker, with `.nch-joker-planted` orange inner glow

The player's own BLVCK (if present in their hand during interchange) renders as non-draggable with the standard greyed treatment.

---

## BLVCK as Enemy Hand Erosion

This is where BLVCK becomes a strategic mechanic, not just a fallback.

Every enemy starts with a mix of real cards and at least one BLVCK slot. The ratio varies by enemy type:

| Enemy Archetype | Cards | BLVCK Slots | Total Deck | Notes |
|-----------------|-------|-------------|------------|-------|
| Grunt | 2 | 1 | 3 | Easy to fully strip |
| Guard | 3 | 1 | 4 | Standard |
| Elite | 4-5 | 1 | 5-6 | Expensive to erode |
| Boss | 5-8 | 0-1 | 5-9 | Some bosses have no BLVCK (fully armored) |

The player erodes an enemy's hand through four actions, each of which converts a real card slot into a BLVCK slot (or interacts with existing BLVCK):

1. **Steal** — removes the card, slot becomes BLVCK (`stolen: true, isBlvckSlot: true`)
2. **Destroy** — removes the card entirely, slot becomes BLVCK
3. **Plant** — fills an existing BLVCK slot with a player card (explosive, poison)
4. **Reveal** — doesn't create BLVCK, but makes real cards visible for targeted steal

The erosion creates escalating consequences:
- 1 BLVCK: Enemy loses one action option. Minor impact.
- 2+ BLVCK: Enemy hand visibly degraded. PARANOIA mutation stacks. Enemy face shifts to Alert `(°_°)`.
- All real cards gone: Enemy is fully stripped. Plays BLVCK desperately. Face shows `(ಥ_ಥ)`. Maximum vulnerability — any planted cards are guaranteed to trigger.

### BLVCK Slot Creation from Theft

When a card is stolen from an enemy, the slot doesn't disappear — it becomes BLVCK:

```
Before steal:  [EATK-005] [EATK-012] [EATK-003] [ACT-000/BLVCK]
After steal:   [ACT-000]  [EATK-012] [EATK-003] [ACT-000/BLVCK]
                ^^^^^^^^ was EATK-005, now empty BLVCK

Enemy capsule: [🃏grey] [🃏] [🃏] [🃏grey]
                 stolen  card  card  original BLVCK
```

This is critical for the visual language: the player can SEE the damage they've done to an enemy's hand. More greyed jokers = more eroded = weaker enemy. The greyed joker IS the scar.

### BLVCK Slot as Plant Target

Every BLVCK slot (whether original or created by theft) is plantable. The player doesn't need to steal first to plant — the original BLVCK slot is always available. But stealing CREATES more plant targets. This makes steal→plant a natural two-step combo:

```
Step 1 (steal): [EATK-005] [EATK-012] [ACT-000/BLVCK]
                      ↓ steal
                 [ACT-000]  [EATK-012] [ACT-000/BLVCK]

Step 2 (plant): [ACT-000]  [EATK-012] [ACT-000/BLVCK]
                      ↓ plant C4          ↓ plant FRAG
                 [C4_CHARGE] [EATK-012] [FRAG_GRENADE]

Enemy capsule: [💣orange] [🃏] [💣orange]
                 planted   card  planted
```

---

## The Emoji Question

### Why 🃏 and not ■

The `■` (black square, U+25A0) was the original BLVCK emoji. It served its purpose early but fails in the current system:

1. **Platform inconsistency:** Renders as a green square on Samsung/Android, breaking the black void aesthetic
2. **No capsule integration:** The NCH capsule system uses 🃏 as its universal card glyph. Having BLVCK use `■` means it doesn't participate in the capsule's visual vocabulary
3. **No intelligent node transition:** In the CH combat capsule, selected cards transition from 🃏 to `card.emoji`. BLVCK with `■` can't participate in this system — its "reveal" would transition from 🃏 to ■, which looks like a bug rather than a design choice
4. **Confusion in enemy hands:** When enemy hands show BLVCK slots, `■` next to 🃏 jokers looks like two different systems rather than one card type being a greyed variant of the other

### The 🃏 Solution

By changing BLVCK's emoji to `🃏` in `cards.json`, the entire card system unifies around one glyph:

- Normal card in capsule: `🃏` (face-down, unknown)
- BLVCK in capsule: `🃏` + `.nch-joker-greyed` (face-down, empty)
- Selected card in CH capsule: `card.emoji` (face-up, chosen)
- BLVCK "selected" in CH capsule: `🃏` + `.nch-joker-greyed` (still face-down — nothing to reveal)

The greyed filter IS the BLVCK identity. The joker IS the card system's universal face-down representation. BLVCK is a permanently face-down card because there's nothing on the other side.

---

## Font Identity

BLVCK's card name renders in a serif font stack rather than the standard `'Courier New', monospace` used by every other card in the game. This is a deliberate break from the terminal/hacker aesthetic:

```css
font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
text-transform: uppercase;
letter-spacing: 3px;
```

The serif face gives BLVCK a carved, classical, almost-funereal quality. It reads like a headstone or a Roman inscription — permanent, ancient, inevitable. Every other card in the game shouts its identity in monospace; BLVCK whispers in stone.

This font choice also serves ENI: when enemy BLVCK slots appear in the interchange UI, the serif "BLVCK" text on the card face immediately distinguishes empty slots from real cards, even before the greyed joker treatment registers. Two signals (font + filter) are better than one.

---

## Implementation Specifics

### cards.json Change

```json
{
  "id": "ACT-000",
  "name": "BLVCK",
  "emoji": "🃏",
  "targetType": "enemy",
  "cost": 0,
  "costs": null,
  "rarity": "common",
  "effects": [{ "type": "damage", "value": 1 }],
  "preCombat": false,
  "synergyTags": ["fallback"]
}
```

Only change: `"emoji": "■"` → `"emoji": "🃏"`.

The fallback definition in `str-combat-integration.js` (`_getFallbackCardDef`) must also update its hardcoded `emoji: '■'` → `emoji: '🃏'`.

### CSS: BLVCK Card Face

New class `.hand-card-blvck` (or inline styles as currently used in NCH expanded view) targeting the full card render:

```css
.hand-card-blvck {
  background: rgba(8, 8, 8, 0.92);
  border-color: rgba(60, 60, 60, 0.35);
  box-shadow: none;
}

.hand-card-blvck .hand-card-emoji {
  filter: grayscale(1) brightness(0.5);
  opacity: 0.55;
  font-size: 28px;
}

.hand-card-blvck .hand-card-name {
  font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: rgba(100, 100, 100, 0.7);
  font-size: 10px;
}

.hand-card-blvck .hand-card-cost {
  display: none;
}
```

### CH Capsule: No Change Needed

The current `_renderCombatCapsule()` already handles BLVCK correctly. When `isBlvck` is true, it renders `🃏` with `.nch-joker-greyed` and never applies `.nch-joker-active`. Once the emoji changes in `cards.json`, the combat capsule's `card.emoji` fallback will also be `🃏`, which is visually identical to the non-selected state — exactly right.

### Tooltip Update

The BLVCK injection tooltip currently reads `'■ STRUGGLE — no playable cards'`. This should update to `'🃏 STRUGGLE — no playable cards'` or simply `'STRUGGLE — no playable cards'` (the emoji in a tooltip is platform-dependent and may not render well).

### Hardcoded ■ References

Grep for `'■'` and `\u25A0` across JS files to catch remaining hardcoded black square references in tooltip messages, logging, and display fallbacks.

---

## Cross-References

- [THEFT_MECHANICS.md](./THEFT_MECHANICS.md) — §10 BLVCK as universal empty slot node, §9 plant mechanic, §4 long-press capsule
- [NCH_CAPSULE_OVERLAY_ARCHITECTURE.md](./NCH_CAPSULE_OVERLAY_ARCHITECTURE.md) — Capsule mode system, intelligent node contract, `.nch-joker-greyed` definition
- [ENEMY_NCH_INTERACTION_ROADMAP.md](./ENEMY_NCH_INTERACTION_ROADMAP.md) — Enemy capsule renderer, interchange UI, BLVCK slot visuals
- [ENEMY_CARDS.md](./ENEMY_CARDS.md) — Phase 3 visuals, Phase 4 interactions, BLVCK slot interactability
- [CARD_HAND_HARMONIZATION_ROADMAP.md](./CARD_HAND_HARMONIZATION_ROADMAP.md) — CHH Step 6 policy flags, GC enemy deck scan

---

## Summary

BLVCK is one idea expressed across every card surface in the game: **the absence of a real card**. Its visual identity (greyed 🃏, near-black transparency, serif inscription) should be instantly recognizable whether it appears in the player's hand, the player's capsule, an enemy's capsule, or the interchange UI. It is the only card that never reveals, never transforms, and never changes glyph — because there's nothing behind it.

Every system that renders cards should ask the same question: *is this BLVCK?* If yes, render the greyed joker. That's the entire visual contract.

---

*Document Version: 1.0*
*Created: 2026-03-07*
*Status: Philosophy reference — BLVCK card restyle pending implementation*
