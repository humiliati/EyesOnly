# Breakable Durability & Progressive Audio System

> **Date:** 2026-03-10
> **Status:** Spec complete — implementation pending
> **Cross-references:**
> - [AUDIO_WIRING_ROADMAP.md §11](./AUDIO_WIRING_ROADMAP.md) — Phase 11
> - `breakable-system.js` — Runtime kick/damage logic
> - `breakable-spawner.js` — Biome-based HP assignment
> - `audio-manifest.json` — Sound asset registry

---

## 1. Breakable Resource Economy

### 1.1 Design Goal

Most breakables take **3–5 unarmed kicks** to destroy. Weapons meaningfully speed destruction. A single projectile (power 3) breaks everything in at most 2 shots.

### 1.2 Tuning Constants

```
kick_damage       = 1.1
projectile_power  = 3        (already set in projectile-system.js)
breakable_hp_min  = 3.0
breakable_hp_max  = 5.5
```

### 1.3 Expected Hit Counts

| HP    | Unarmed Kicks | Projectile Shots |
|-------|---------------|------------------|
| 3.0   | 3             | 1                |
| 4.2   | 4             | 2                |
| 5.5   | 5             | 2                |

### 1.4 Durability Tiers

Three named tiers provide enough variety without overcomplexity. Spawners assign tier by prop type, or use a random HP within the band for generic breakables.

| Tier           | HP   | Examples                                 |
|----------------|------|------------------------------------------|
| `light`        | 3.0  | Bush, flower patch, picnic basket, glass  |
| `medium`       | 4.2  | Wooden crate, hollow log, cardboard box   |
| `sturdy`       | 5.5  | Vending machine panel, barrel, apple tree |

### 1.5 Why This Works

The HP band is narrow enough that players build reliable expectations. Kicks cost time (3–5 turns), so weapons always feel like an upgrade. Projectile power 3 one-shots light breakables and two-shots everything else — the right tradeoff for ammo economy.

### 1.6 Current State vs Target

| Value            | Current           | Target          |
|------------------|-------------------|-----------------|
| Kick damage      | 0.2               | 1.1             |
| Crate HP         | 2                 | 3.0–5.5 (tier)  |
| Bush HP          | 1                 | 3.0 (light)     |
| Apple Tree HP    | 3                 | 5.5 (sturdy)    |
| Fallback crate   | 2                 | 4.2 (medium)    |

---

## 2. Progressive Damage Audio

### 2.1 Design Principle

Instead of unique sounds per breakable type, the system maps a **damage ratio** to audio stages. Three descending attack sounds (`attack-5` → `attack-4` → `attack-3`) create an escalating impact feel as the object weakens. The player hears the object getting closer to breaking.

### 2.2 Damage Ratio

```
damage_ratio = current_hp / max_hp
```

### 2.3 Stage Table

| Ratio Range | Sound      | Feel              |
|-------------|------------|--------------------|
| 0.80–1.00   | `attack-5` | Light tap, intact  |
| 0.55–0.80   | `attack-4` | Solid hit, cracking |
| 0.30–0.55   | `attack-3` | Heavy strike, weak |
| 0.10–0.30   | `attack-3` | Sustained damage   |
| 0.00        | `attack-3` + break event | Final blow   |

### 2.4 Stage Resolution

```javascript
function getStageSound(currentHp, maxHp) {
    var ratio = currentHp / maxHp;
    if (ratio > 0.80) return 'attack-5';
    if (ratio > 0.55) return 'attack-4';
    return 'attack-3';
}
```

### 2.5 Pitch Humanization

Every kick applies a small random pitch variation to prevent repetitive-sounding sequences.

```
playbackRate = random(0.94, 1.06)
```

This makes the same 3 attack sounds feel like 20 different impacts.

---

## 3. Kick Sequence Example

A typical 5-kick destruction of a medium crate (4.2 HP):

| Kick | HP Before | HP After | Ratio | Sound      |
|------|-----------|----------|-------|------------|
| 1    | 4.2       | 3.1      | 0.74  | `attack-5` |
| 2    | 3.1       | 2.0      | 0.48  | `attack-4` |
| 3    | 2.0       | 0.9      | 0.21  | `attack-3` |
| 4    | 0.9       | 0.0      | 0.00  | `attack-3` + break event |

A 3-kick destruction of a light bush (3.0 HP):

| Kick | HP Before | HP After | Ratio | Sound      |
|------|-----------|----------|-------|------------|
| 1    | 3.0       | 1.9      | 0.63  | `attack-5` |
| 2    | 1.9       | 0.8      | 0.27  | `attack-4` |
| 3    | 0.8       | 0.0      | 0.00  | `attack-3` + break event |

---

## 4. Break Event Layering

### 4.1 Final Blow Sound Stack

When a breakable reaches 0 HP, the final strike layers multiple sounds with micro-delays to create a physical, satisfying collapse.

```
0ms    attack-3          (final impact)
20ms   material_break    (structural failure)
40ms   whoosh-2          (air displacement / scatter)
```

The 20–40ms delays prevent the sounds from masking each other and trick the brain into hearing a multi-phase destruction event — crack, break, scatter — rather than a single pop.

### 4.2 Why Micro-Delays Work

Human hearing interprets staggered impacts as distinct physical events. Even 20ms of separation is enough for the auditory system to perceive "the thing broke, then pieces fell." Simultaneous playback sounds synthetic; staggered playback sounds real.

---

## 5. Debris Echo

### 5.1 Concept

After the break event, spawn 2–4 tiny delayed sounds that imply fragments hitting the environment. Games like Dead Cells and Spelunky use this technique to make destruction feel rich with minimal assets.

### 5.2 Debris Timing

```
80–180ms after break    debris_sound_1    (first fragment lands)
120–220ms after break   debris_sound_2    (second fragment)
160–280ms after break   debris_sound_3    (optional third)
```

Each debris sound plays at randomized delay within its window, with volume 0.3–0.5 (quiet relative to the break impact).

### 5.3 Debris Sound Characteristics

Each debris clip should be very short (< 200ms), quiet, and dry (no reverb). The brain fills in the rest.

### 5.4 Debris Pitch Drift

```
playbackRate = random(0.92, 1.08)
```

Prevents any two debris sounds from sounding identical, even when the library is small.

### 5.5 Optional: Dust Puff

A soft ambient puff at ~110ms after break gives the illusion of particles even if none are rendered visually.

```
110ms   dust_soft    volume 0.2
```

---

## 6. Material System

### 6.1 Material Types

Breakables carry a `material` property that determines which break sound and debris sounds play on destruction. Only one additional sound per material type.

| Material   | Break Sound       | Debris Pool             | Example Props                     |
|------------|-------------------|-------------------------|-----------------------------------|
| `wood`     | `wood-crack`      | `debris-wood-{1,2}`    | Crate, barrel, log, fence         |
| `glass`    | `glass-shatter`   | `debris-glass-{1,2}`   | Window, display case, monitor     |
| `metal`    | `metal-snap`      | `debris-metal-{1,2}`   | Vending machine, locker, vent     |
| `organic`  | `leaf-rustle`     | `debris-organic-{1,2}` | Bush, tree, flower patch          |
| `plastic`  | `plastic-crack`   | `debris-plastic-{1,2}` | Container, modern furniture       |

### 6.2 Default Material

If no material is specified, fall back to `wood`. This covers legacy breakable definitions that predate the material system.

### 6.3 Material Override on Biome Props

The biome prop definition in `breakable-spawner.js` gains a `material` field:

```javascript
{ emoji: '📦', name: 'Wooden Crate', breakable: true, hp: 4.2, material: 'wood' }
{ emoji: '🌿', name: 'Bush',         breakable: true, hp: 3.0, material: 'organic' }
```

---

## 7. Complete Break Sequence by Material

### Wood Crate (medium, 4.2 HP, 4 kicks)

```
Kick 1:  attack-5  (pitch 0.94–1.06)
Kick 2:  attack-4  (pitch 0.94–1.06)
Kick 3:  attack-3  (pitch 0.94–1.06)
Kick 4:  attack-3                          ← final blow
         +20ms  wood-crack
         +40ms  whoosh-2
         +90ms  debris-wood-1  (vol 0.35, pitch 0.92–1.08)
         +130ms debris-wood-2  (vol 0.40, pitch 0.92–1.08)
         +170ms debris-wood-1  (vol 0.30, pitch 0.92–1.08)
```

### Glass Display Case (light, 3.0 HP, 3 kicks)

```
Kick 1:  attack-5  (pitch 0.94–1.06)
Kick 2:  attack-4  (pitch 0.94–1.06)
Kick 3:  attack-3                          ← final blow
         +20ms  glass-shatter
         +40ms  whoosh-2
         +80ms  debris-glass-1  (vol 0.40, pitch 0.92–1.08)
         +120ms debris-glass-2  (vol 0.35, pitch 0.92–1.08)
```

### Metal Vent (sturdy, 5.5 HP, 5 kicks)

```
Kick 1:  attack-5  (pitch 0.94–1.06)
Kick 2:  attack-4  (pitch 0.94–1.06)
Kick 3:  attack-3  (pitch 0.94–1.06)
Kick 4:  attack-3  (pitch 0.94–1.06)
Kick 5:  attack-3                          ← final blow
         +20ms  metal-snap
         +40ms  whoosh-2
         +90ms  debris-metal-1  (vol 0.40, pitch 0.92–1.08)
         +150ms debris-metal-2  (vol 0.35, pitch 0.92–1.08)
```

---

## 8. Projectile Break Behavior

When a projectile destroys a breakable, the sequence compresses because there's no escalation — the object goes from intact to destroyed in 1–2 hits.

### Single-Shot Kill (projectile power 3 vs 3.0 HP)

```
0ms    impact-{1..4} random     (projectile collision — existing)
+20ms  material_break
+40ms  whoosh-2
+80ms  debris (2–3 sounds, same rules as kick)
```

### Two-Shot Kill (projectile power 3 vs 4.2+ HP)

```
Shot 1:  hit-{1..4} random      (damage hit — existing)
Shot 2:  impact-{1..4} random   (destruction — existing)
         +20ms  material_break
         +40ms  whoosh-2
         +80ms  debris echo
```

The existing `hit-{1..4}` / `impact-{1..4}` sounds remain for projectile hits. Progressive `attack-{3,4,5}` staging applies only to kicks.

---

## 9. Sound Asset Budget

### 9.1 Existing Assets (No New Recording Needed)

| Asset             | Manifest Key           | Current Use         |
|-------------------|------------------------|---------------------|
| `attack-5`        | `attack-5`             | Combat              |
| `attack-4`        | `attack-4`             | Combat              |
| `attack-3`        | `attack-3`             | Combat              |
| `whoosh-2`        | `whoosh-2`             | Fan collapse, doors |
| `hit-{1..4}`      | `hit-1` .. `hit-4`     | Breakable hit       |
| `impact-{1..4}`   | `impact-1` .. `impact-4` | Breakable destroy |
| `low-attack-{1..3}` | `low-attack-1` .. `low-attack-3` | Current kick SFX (replaced by progressive staging) |

### 9.2 New Assets Required

| Asset               | Count | Priority | Description                              |
|----------------------|-------|----------|------------------------------------------|
| Material break sounds | 5    | HIGH     | wood-crack, glass-shatter, metal-snap, leaf-rustle, plastic-crack |
| Debris sounds        | 10   | MEDIUM   | 2 per material ({material}-debris-{1,2}) |
| Dust puff (optional) | 1    | LOW      | Soft ambient whoosh, < 200ms             |

**Total new recordings: 15–16 sounds.**
**Total sounds used by the system: ~25** (existing + new).
**Perceived variations: hundreds** (pitch drift + random delay + debris scatter).

---

## 10. Implementation Plan

### Step 1: Durability Rebalance

| File | Change |
|------|--------|
| `breakable-system.js` line 784 | `kickDamage = 0.2` → `kickDamage = 1.1` |
| `breakable-spawner.js` line 34 | Fallback HP `2` → `4.2` |
| `tutorial-floors.js` | Update all hardcoded breakable HP to tier values |
| Biome prop definitions | Add `material` field, update HP to 3.0/4.2/5.5 tiers |

### Step 2: Progressive Kick Audio

| File | Change |
|------|--------|
| `breakable-system.js` | Replace `playRandom('low-attack', 3)` in `kickBreakable()` with `getStageSound(hp, maxHp)` + pitch humanization |
| `breakable-system.js` | Add `_getStageSound(ratio)` helper returning `attack-5` / `attack-4` / `attack-3` |

### Step 3: Break Event Layering

| File | Change |
|------|--------|
| `breakable-system.js` | Replace `playRandom('impact', 4)` in `damageBreakable()` destroy branch with layered break sequence |
| `breakable-system.js` | Add `_playBreakSequence(breakable)` helper: attack-3 + material_break + whoosh-2 with micro-delays |

### Step 4: Debris Echo

| File | Change |
|------|--------|
| `breakable-system.js` | Add `_playDebrisEcho(material)` helper: 2–4 delayed debris sounds with pitch drift |
| `breakable-system.js` | Call `_playDebrisEcho()` from `_playBreakSequence()` after break layer |

### Step 5: Material Registration

| File | Change |
|------|--------|
| `audio-manifest.json` | Add entries for material break + debris sounds once assets are recorded |
| Media Designer portal | Add 💥 BREAKABLE SOUNDS category with all break + debris entries |

### Step 6: Verify & Tune

Play-test all three durability tiers across multiple biomes. Verify kick count feels right. Tune debris delay windows and volumes. Confirm projectile two-shot behavior on sturdy breakables.

### Estimated Effort

~80 lines in `breakable-system.js` + HP rebalance across spawner/tutorial files + 15–16 new audio assets.

---

## 11. Designer Portal Integration (Future)

The Media Designer portal will gain a "Breakable Preview" panel:

1. Select durability tier (light / medium / sturdy)
2. Select material (wood / glass / metal / organic / plastic)
3. Simulate kick sequence with progressive audio
4. Preview the full break event with debris echo
5. A/B test alternative material sounds

---

## 12. Engine Pseudocode Summary

```
on_kick(breakable):
    breakable.hp -= kick_damage
    ratio = breakable.hp / breakable.maxHp

    if breakable.hp <= 0:
        play(attack-3)
        delay(20ms): play(material_break_sound)
        delay(40ms): play(whoosh-2)
        play_debris_echo(breakable.material, base_delay=80ms)
    else:
        play(getStageSound(ratio), pitch=random(0.94, 1.06))

getStageSound(ratio):
    if ratio > 0.80: return attack-5
    if ratio > 0.55: return attack-4
    return attack-3

play_debris_echo(material, base_delay):
    count = random(2, 4)
    for i in 0..count:
        delay = base_delay + random(0, 100) + (i * 40)
        vol   = random(0.30, 0.50)
        pitch = random(0.92, 1.08)
        play(debris_{material}_{random(1,2)}, delay, vol, pitch)
```
