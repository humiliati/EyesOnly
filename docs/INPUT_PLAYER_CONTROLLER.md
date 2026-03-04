# INPUT_PLAYER_CONTROLLER.md — Player Input Pipeline Reference

> **Status:** Living document. Describes the current input → action pipeline as implemented.
> **Purpose:** Provide architectural context for THIEF_MECHANICS.md (plant/detonate explosives, pickpocket, NCH capsule interaction nodes) and future accessibility controller support (QuadStick FPS, Xbox Adaptive Controller).
> Last verified against codebase: 2026-03-04.

---

## 1. Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER EVENTS                               │
│  touchstart/move/end  ·  pointerdown/move/up  ·  click  ·  keydown │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   INPUT HANDLERS (gone-rogue-mobile.js)              │
│  _handleGridTouchStart/End  ·  _handleGridPointerDown/Move/Up       │
│  _handleGridClick  ·  _setupKeyboardHandlers                        │
│                                                                     │
│  Responsibilities:                                                  │
│    · Coordinate conversion (screen px → grid tile)                  │
│    · Fishing drag detection (threshold: 20px)                       │
│    · Double-tap sprint detection (window: 300ms)                    │
│    · Click suppression after fishing (prevents ghost taps)          │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              _processGridInput(x, y, runMode)                       │
│              (gone-rogue-mobile.js ~line 1706)                      │
│                                                                     │
│  Priority-ordered action dispatch:                                  │
│    1. Self-tap (reset UI chrome)                                    │
│    2. Interactive item (auto-pickup or interact)                    │
│    3. Adjacent NPC tap → GoneRogue.process('interact')              │
│    4. Adjacent enemy tap → GoneRogue.process('steal')               │
│    5. Distant enemy/breakable → fireProjectileAtTarget(x,y)         │
│    6. Default → GoneRogue.handleTapMove(x, y, runMode)              │
│       └→ TapMoveSystem checks for adjacent breakable → KICK         │
│       └→ Otherwise → pathfind + smooth movement                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ACTION EXECUTORS                                │
│                                                                     │
│  TapMoveSystem.handleTapMove()     → kick / move / fish             │
│  ProjectileSystem.fireProjectile() → ranged shot                    │
│  LockedGateSystem.handleInteract() → gates / NPC quest turn-in      │
│  BreakableSystem.kickBreakable()   → push + damage                  │
│  EnvironmentalDragDrop             → active item deploy              │
│  GoneRogue.process('interact')     → context-sensitive interact      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Event Registration

All grid input listeners are registered in `gone-rogue-mobile.js` during `init()` (~lines 449-475) on the `#rogue-grid-mobile` canvas container.

| Event | Handler | Platform |
|---|---|---|
| `touchstart` | `_handleGridTouchStart` | Mobile |
| `touchmove` | `_handleGridTouchMove` | Mobile |
| `touchend` | `_handleGridTouchEnd` | Mobile |
| `click` | `_handleGridClick` | Both |
| `pointerdown` | `_handleGridPointerDown` | Desktop |
| `pointermove` | `_handleGridPointerMove` | Desktop |
| `pointerup` / `pointercancel` | `_handleGridPointerUp` | Desktop |
| `keydown` | `_setupKeyboardHandlers` | Desktop |

Keyboard bindings (~lines 310-375):

| Key | Action |
|---|---|
| W / ArrowUp | `GoneRogue.process('n')` — move north |
| A / ArrowLeft | `GoneRogue.process('a')` — move west |
| S / ArrowDown | `GoneRogue.process('s')` — move south |
| D / ArrowRight | `GoneRogue.process('d')` — move east |
| 1-5 | Card selection → `GoneRogue.handleCardSwipe(index, 'up')` |
| E | Interact |
| Space | Context action |

---

## 3. Input Classification: Tap vs Drag

The system distinguishes between a **tap** (instant action) and a **drag** (fishing sprint path).

### Desktop flow (pointer events)

```
pointerdown
  → record _desktopPointerStart {x, y}
  → setPointerCapture()

pointermove (while down)
  → calculate distance from start
  → IF distance > FISHING_THRESHOLD (20px):
      _desktopFishingActive = true
      compute A* path via GoneRogueMovement.findPath()
      display path overlay via _showFishingPath()

pointerup
  → IF _desktopFishingActive && path.length > 0:
      _suppressNextClick = true          ← prevents ghost tap
      GoneRogue.handleFishingMove(path, runMode)
  → ELSE:
      fall through → click event fires → _handleGridClick
```

### Mobile flow (touch events)

```
touchstart
  → record _fishingStart {x, y, gridX, gridY, time}
  → check double-tap (same cell within 300ms) → _runMode = sprint

touchmove
  → IF distance > _touchMoveThreshold (10px):
      _fishingActive = true
      build/extend _fishingPath
      show path overlay

touchend
  → IF _fishingActive:
      GoneRogue.handleFishingMove(path, runMode)
  → ELSE:
      _processGridInput(x, y, runMode)
```

### Key constants

| Constant | Value | Location |
|---|---|---|
| `FISHING_THRESHOLD` | 20 px | line 68 |
| `_touchMoveThreshold` | 10 px | line 48 |
| `DOUBLE_TAP_THRESHOLD_MS` | 300 ms | line 13 |
| `TAP_TO_MOVE_MAX_RADIUS` | 12 tiles | line 15 |
| `FISHING_UPDATE_INTERVAL` | 50 ms | ~line 70 |
| `FISHING_SPRINT_DRAG_SPEED` | 1.2 px/ms | ~line 72 |
| `_suppressNextClick` | boolean flag | line 76 |

---

## 4. Action: Kick

Kicks are the highest-priority action in `TapMoveSystem.handleTapMove()`. They fire **before** the `scriptedWalk` and `playerMoveLocked` guards, meaning kicks always work regardless of movement restrictions.

### Detection (tap-move-system.js ~line 59)

```
IF breakable exists at (targetX, targetY)
AND breakable.hp > 0
AND adjacent (Chebyshev distance ≤ 1, not self-tile):
  → KICK
```

Adjacent = `Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)`.
This includes diagonals.

### Execution (breakable-system.js ~line 600)

```
kickBreakable(breakable, ndx, ndy, ctx):
  1. Apply kick damage (0.2 HP)
  2. IF breakable destroyed → return { destroyed: true }
  3. IF not kickable → return (damage only, no push)
  4. Roll push chance:
     · base 40% (up to 90% with legendary boots)
     · fail → wobble animation, no movement
  5. Calculate push distance:
     · iterate tiles in kick direction
     · stop at walls, bounds, other breakables
     · max 1 tile (up to 1.5 with buffs)
  6. Execute push:
     · clear old grid position
     · update breakable.x, breakable.y
     · set new grid position
     · overhead animation + noise
```

### Kick parameters

| Parameter | Value | Notes |
|---|---|---|
| `kickDamage` | 0.2 | Per kick |
| `pushChance` | 0.40 | Base, buffable to 0.90 |
| `maxPushDist` | 1 tile | Buffable to 1.5 |
| Push direction | normalized (dx,dy) | Same as player→breakable vector |

### Future: Kick → Plant Explosive

The kick mechanic is the natural entry point for THIEF_MECHANICS planting. When kicking an enemy (or an enemy-adjacent breakable), the kick could:

1. Open the enemy's card hand into a **"NCH capsule minimized"** view
2. Render interactive nodes on each card (tap to plant C4, swap, steal)
3. Reuse the existing kick direction + adjacency check
4. The planted device becomes a breakable with a detonator in the player's active item slot

See §8 for the proposed input mapping.

---

## 5. Action: Fishing (Sprint Path)

Fishing is a drag-to-path system that lets the player chart a multi-tile route before committing.

### Flow

```
1. Player drags on grid (>20px desktop, >10px mobile)
2. A* pathfinding runs on each pointermove/touchmove
3. Path rendered as overlay dots on canvas
4. On release → TapMoveSystem.handleFishingMove(path, isSprinting, ctx):
   a. Validate all waypoints are walkable
   b. Trim path at first wall
   c. Set GoneRogueMovement target to final waypoint
   d. Movement system interpolates along path at tick rate
```

### Sprint activation

| Trigger | Platform |
|---|---|
| Double-tap same cell within 300ms | Mobile |
| Double-click same cell within 300ms | Desktop |
| Drag speed > 1.2 px/ms | Both (fishing auto-sprint) |

Sprint requires `GAMESTATE.canSprint()` to return true (fatigue check).

---

## 6. Action: Projectiles

Projectiles fire when tapping a **distant** enemy or breakable (distance > 1 tile).

### Fire (projectile-system.js ~line 177)

```
fireProjectileAtTarget(targetX, targetY, ctx):
  1. Calculate direction: dx = target.x - player.x, dy = target.y - player.y
  2. Normalize velocity: vx = dx/dist, vy = dy/dist
  3. Create projectile:
     { x, y, fx, fy, dx, dy, vx, vy,
       speed: 1.0, bounces: 3, range: 15, power: 3,
       owner: 'player' }
  4. Muzzle flash at player position (300ms)
  5. Push to _projectiles array
```

### Tick (projectile-system.js ~line 215)

Runs inside `GameTickSystem.updateGameState()` on each frame:

```
FOR each projectile:
  1. Advance position by velocity * speed
  2. Collision checks (in order):
     · Out of bounds → destroy + miss effect
     · Wall → bounce (if bounces > 0) or destroy
     · Breakable → damage breakable + destroy
     · Enemy → enter STR combat + destroy
     · Player (if enemy-owned) → enter STR combat
     · Range expired → destroy + miss effect
```

---

## 7. Action: Interact

`GoneRogue.process('interact')` routes through `CommandProcessSystem` → `LockedGateSystem.handleInteraction()`.

### Interaction priority (locked-gate-system.js)

```
1. Adjacent NPC with questItem → _handleNpcQuestTurnIn()
2. Adjacent locked gate → attemptUnlockLockedGate()
3. Adjacent interactive item → item-specific handler
4. Adjacent door → floor transition
```

### NPC quest turn-in flow

```
1. _findAdjacentNpc() — scan 4 cardinal directions
2. NPC has questItem property (e.g., 'BLACKSMITH_HAMMER')
3. consumeQuestItem() searches:
   a. Active (equipped) item slot
   b. Persistent inventory
   c. Loose inventory
4. Match by keyType, meta.keyType, registryId, id, or name heuristic
5. On match → consume item, overhead animation, reward
```

---

## 8. Proposed: Thief Mechanics Input Mapping

### Plant Explosive (Kick → NCH Capsule Nodes)

The kick pipeline already handles adjacency detection and directional input. For planting:

```
KICK on enemy (adjacent):
  → Instead of push damage, open enemy card hand
  → Render as "NCH capsule minimized" with interactive nodes
  → Each node = one of enemy's cards (face-down or revealed)
  → Player taps a node to:
      · Plant C4 (consume from inventory)
      · Pickpocket (steal card to hand)
      · Swap (exchange card with one from player hand)
  → Capsule closes after action or timeout
  → Planted C4 becomes a timed/remote detonatable on that card
```

### Input actions needed

| Action | Touch/Mouse | Keyboard | Xbox Controller | Notes |
|---|---|---|---|---|
| Move N | Tap tile north | W / ↑ | Left Stick ↑ | Cardinal movement |
| Move E | Tap tile east | D / → | Left Stick → | |
| Move S | Tap tile south | S / ↓ | Left Stick ↓ | |
| Move W | Tap tile west | A / ← | Left Stick ← | |
| Sprint path | Drag on grid | (hold Shift+WASD) | Left Stick + LT held | Fishing system |
| Kick / Plant | Tap adjacent breakable/enemy | E (toward facing) | A button | Adjacency required |
| Shoot | Tap distant enemy | (auto via tap) | RT (right trigger) | Range > 1 |
| Interact | Tap adjacent NPC/gate/item | E | A button | Context-sensitive |
| Steal / Pickpocket | Tap adjacent enemy | F | X button | Opens NCH capsule |
| Use active item | Tap header slot | Q | Y button | Toggle / activate |
| Deploy item | Drag from header to grid | (auto via interact) | Y + direction | Environmental synergy |
| Detonate planted | Tap detonator in active slot | R | RB | Remote trigger |
| Card select 1-5 | Tap card in fan | 1-5 | D-pad ↑↓←→ + A | Card hand navigation |
| Card play (swipe up) | Swipe card upward | Enter (selected card) | A (on selected) | Deploy card |
| Open inventory | Tap left column | Tab / I | Back/Select | Toggle sidebar |
| Cancel / back | Tap self / Escape | Escape | B button | Close menus, cancel drag |

---

## 9. Xbox Controller Axis Reference

Standard Xbox controller layout for reference when implementing gamepad support:

```
        ┌──────────────────────────────────────────┐
        │            Xbox Controller                │
        │                                           │
        │   [LB]                         [RB]       │
        │   [LT]                         [RT]       │
        │                                           │
        │      ┌───┐    [Back][Start]   [Y]         │
        │      │LS │                  [X] [B]       │
        │      └───┘     [Guide]      [A]           │
        │            ┌─┬─┐       ┌───┐              │
        │            │↑│ │       │RS │              │
        │          ┌─┼─┼─┤       └───┘              │
        │          │←│ │→│                          │
        │          └─┼─┼─┘                          │
        │            │↓│                            │
        │            └─┘                            │
        │          D-pad                            │
        └──────────────────────────────────────────┘
```

### Axis mapping

| Physical Input | API Axis/Button | Keyboard Equiv | Game Action |
|---|---|---|---|
| Left Stick X- | `axes[0]` < -0.5 | A | Move West |
| Left Stick X+ | `axes[0]` > 0.5 | D | Move East |
| Left Stick Y- | `axes[1]` < -0.5 | W | Move North |
| Left Stick Y+ | `axes[1]` > 0.5 | S | Move South |
| Right Stick X | `axes[2]` | Mouse X | Aim / camera |
| Right Stick Y | `axes[3]` | Mouse Y | Aim / camera |
| A button | `buttons[0]` | E / Enter | Interact / Confirm |
| B button | `buttons[1]` | Escape | Cancel / Back |
| X button | `buttons[2]` | F | Steal / Pickpocket |
| Y button | `buttons[3]` | Q | Use active item |
| LB | `buttons[4]` | Tab | Cycle card left |
| RB | `buttons[5]` | R | Cycle card right / Detonate |
| LT | `buttons[6]` | Shift | Sprint modifier |
| RT | `buttons[7]` | (mouse click) | Shoot / Fire projectile |
| Back | `buttons[8]` | I | Inventory toggle |
| Start | `buttons[9]` | Escape | Pause / Menu |
| LS click | `buttons[10]` | — | (reserved) |
| RS click | `buttons[11]` | — | (reserved) |
| D-pad ↑ | `buttons[12]` | 1 | Card slot 1 |
| D-pad ↓ | `buttons[13]` | 2 | Card slot 2 |
| D-pad ← | `buttons[14]` | 3 | Card slot 3 |
| D-pad → | `buttons[15]` | 4 | Card slot 4 |

### Dead zone recommendation

```javascript
var DEAD_ZONE = 0.25;  // Ignore stick drift below 25%
var SPRINT_ZONE = 0.85; // Full tilt = sprint (fishing equivalent)

function readStick(axes, axisIndex) {
  var raw = axes[axisIndex] || 0;
  if (Math.abs(raw) < DEAD_ZONE) return 0;
  // Normalize remaining range to 0..1
  var sign = raw > 0 ? 1 : -1;
  return sign * (Math.abs(raw) - DEAD_ZONE) / (1 - DEAD_ZONE);
}
```

---

## 10. QuadStick FPS Accessibility Controller

The [QuadStick FPS](https://www.quadstick.com/) is a mouth-operated controller for gamers with limited mobility. It translates sip/puff pressure and lip position into gamepad inputs.

### How it connects

| Platform | Connection |
|---|---|
| PC / Mac | Direct USB (Xbox 360 emulation mode) |
| Xbox One/Series | Via adapter: [Brook Wingman XB](https://www.brookaccessory.com/) |
| PS4 | Direct USB |
| PS5 | Via adapter |
| Switch | Direct USB |

In Xbox 360 emulation mode, QuadStick presents itself as a standard Xbox 360 controller. The Gamepad API (`navigator.getGamepads()`) sees it with the same `axes[]` and `buttons[]` layout as above.

### QuadStick input channels

| Channel | Physical Action | Typical Xbox Mapping |
|---|---|---|
| Joystick X/Y | Lip position (lateral/forward-back) | Left Stick (movement) |
| Sip tube 1 | Light sip | A button (interact) |
| Sip tube 1 | Hard sip | LT (sprint modifier) |
| Puff tube 1 | Light puff | B button (cancel) |
| Puff tube 1 | Hard puff | RT (shoot) |
| Sip tube 2 | Light sip | X button (steal) |
| Puff tube 2 | Light puff | Y button (use item) |
| Lip sensor | Lateral position | Right Stick X (aim) |

### Design considerations for QuadStick users

1. **Minimize simultaneous inputs.** QuadStick users can't easily press two buttons at once. Avoid requiring LT+A combos. Instead, use context-sensitive A button (interact OR sprint based on movement state).

2. **Generous timing windows.** Double-tap for sprint is difficult with sip inputs. Provide an alternative: hold-to-sprint via LT equivalent, or auto-sprint when stick is fully tilted past `SPRINT_ZONE`.

3. **No rapid alternation.** Switching between sip and puff quickly is fatiguing. Design planting mechanics as: sip once (open capsule) → joystick to select node → sip again (confirm). Not sip-puff-sip sequences.

4. **Large interaction targets.** The NCH capsule minimized nodes must be large enough to select with imprecise joystick control. Minimum recommended: 2x2 grid cells per node, or circular selection with generous dead zones.

5. **Profiles.** QuadStick uses downloadable game profiles (Google Sheets format). We should publish an official profile for optimal mapping. The QuadStick FPS stores up to 10 custom profiles on its internal flash drive.

---

## 11. Game Tick Integration

All movement, projectiles, and ground effects tick inside `GameTickSystem.updateGameState()` (game-tick-system.js ~line 15), called every animation frame (~16ms at 60fps).

### Tick sequence

```
1. Update smooth movement (GoneRogueMovement)
   · Interpolate player position along path
   · Sync logical + visual coordinates
   · Check tile interactions at new position
   · Handle scripted walk phase transitions

2. Update pets (PetFollower)
   · Follow player position history buffer

3. Update enemies
   · Elite enemy AI
   · Pathfinding + awareness decay
   · Sight cone checks

4. Update projectiles (throttled by _projectileTickAccum)
   · Advance positions
   · Collision detection (walls, breakables, enemies)

5. Update boss hazards (if active)
   · Real-time projectile spawning

6. Decay items + currencies (expiry timers)

7. Magnet auto-collect (nearby currency)

8. Update ground effects
   · Fire DOT with rate-limiting (damageCooldownMs: 600ms)
   · Fire→Smoke decay transitions
   · Overhead fire emoji animation via OverheadAnimator

9. Update lighting (every 5 ticks)
   · Recalculate light map from wall cache

10. Re-render mobile UI
    · GoneRogueMobile.updateMobileGrid()
```

---

## 12. File Reference

| File | Responsibility |
|---|---|
| `gone-rogue-mobile.js` | Event listeners, coordinate conversion, fishing detection, `_processGridInput` dispatcher |
| `tap-move-system.js` | Kick detection, movement routing, fishing path execution |
| `breakable-system.js` | `kickBreakable()` push + damage, explosion chain, fire spawning |
| `projectile-system.js` | Fire, advance, collide projectiles |
| `game-tick-system.js` | Main update loop, movement interpolation, ground DOT |
| `gone-rogue.js` | `process()` command router, `handleTapMove()` wrapper, context builders |
| `environmental-drag-drop.js` | Active item drag-to-deploy on grid |
| `locked-gate-system.js` | Gate unlock, NPC quest turn-in, interact routing |
| `ui-controls.js` | Header active-item-slot click/toggle handler |
| `rogue-sidebar.js` | Left column item rendering, drag-to-equip/incinerator/grid |
| `inventory-management.js` | Quest item consumption, active slot search, key matching |
| `game-loop.js` | requestAnimationFrame loop, delta timing |
| `gone-rogue-movement.js` | A* pathfinding, smooth position interpolation |
