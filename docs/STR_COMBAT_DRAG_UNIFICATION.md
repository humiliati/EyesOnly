# STR Combat Drag Unification Roadmap

**EYES ONLY — Gone Rogue Engine**
**March 2026 · v1.1**

Cross-refs: CARD_HAND_HARMONIZATION_ROADMAP, ENEMY_NCH_INTERACTION_ROADMAP, HAND_FAN_AND_CARD_DEPLOYMENT, DRAG_DROP_UX_SUMMARY, STR-HUD-DESIGNER-ROADMAP, STR_COMBAT_UI_README, BOSS_ENCOUNTER_IDEAS, BOSS_DESIGN

---

## The Problem: Three Drag Systems, One Card

A player click+drags a card in STR combat and three independent systems compete for control:

| System | Trigger | Purpose | Minimize Logic | Ghost/Visual |
|---|---|---|---|---|
| **Pointer-hold targeting** | `pointerdown` → 180ms hold → `pointermove` | Play on enemy, deploy ground effect | Velocity ≥800px/s OR distance ≥15% of STR window | Crosshair cursor, AoE preview, enemy glow |
| **HTML5 drag (disposal)** | `dragstart` on `draggable="true"` wrapper | Drag to debrief feed (incinerate) or shop (sell) | 400ms dwell outside STR window | Browser ghost clone, dotted placeholder |
| **CardTransferManager** | HTML5 drag via NCH drop zones | Move between hand/backup/vault in NCH mode | N/A (NCH only) | `ctm-drop-highlight` zone glow |

When a player drags during STR combat, pointer-hold targeting AND HTML5 drag both activate from the same `pointerdown`. The velocity collapse fires instantly, minimizing the STR window. The `setMode('contextual','bottom')` call triggers a full DOM rebuild that destroys the drag placeholder, ghost clone, and hidden card wrapper. The player sees the hand fan rendered as a horizontal strip at the bottom — the "BLVCK bar" (Figure 1).

### Current Band-Aids (v=20260307b)

- `dragstart` cancels any active pointer-hold targeting (prevents velocity collapse)
- `setMode()` defers re-render when `_liftDrag.active` (prevents DOM destruction mid-drag)
- Ghost clone gets `cssText` override (prevents fan transforms making ghost look like a bar)

These patches stop the crash but don't fix the architecture. Two parallel systems still race.

---

## What Slay the Spire Does (Reference Model)

Slay the Spire's card interaction is clean because it uses ONE unified input model:

1. **Click a card** → card lifts up, follows cursor/finger, other cards spread apart
2. **Drag over enemy** → enemy highlights (targetable), release = play card on that enemy
3. **Drag over empty space / self** → AOE or self-targeting indicator appears
4. **Drag back to hand** → card returns to hand position, no effect
5. **Right-click** → inspect card (full art, text)
6. **No timer-based minimize** — the combat window IS the screen, there's no map underneath

Key differences from our game:
- We have a **map layer underneath** the STR combat window → need minimize/maximize flow
- We have **ground effects** → cards deploy to specific tiles, not just "on enemy"
- We have **card disposal** → drag to debrief feed to destroy -> drag to "left column" action button backup deck to put back in the top 5 redacted cards of the backup deck face
- We have **future enemy hand interactions** → drag cards INTO enemy's hand (plant mechanic) -> show hidden enemy cards by toggling equipped item and clicking on the enemy cards -> steal or destroy cards to leave empty slot for planting or destroy the slot entirely  
- We have **NCH deck management** → drag between hand/backup/vault outside combat
- We have **10 boss encounter types** → each can reskin or replace the STR window entirely
- We have **minigame bosses** → some encounters suspend STR combat for a self-contained game loop
- We have **accessibility constraints** → sip/puff adaptive controller support required at T1 difficulty

So we need StS's clean drag UX PLUS our multi-layer minimize/deploy/dispose flow PLUS encounter-aware theming.

---

## The Encounter Problem: One STR Window Serves Ten Boss Types

The current STR window is a single-skin singleton. `STRCombatWindow.show(state)` renders the same layout regardless of whether you're fighting a standard patrol, an elite, or the Mainframe Core boss. BOSS_DESIGN.md and BOSS_ENCOUNTER_IDEAS.md describe encounters that need fundamentally different interfaces:

### Three Encounter Categories

| Category | STR Window Role | Drag Behavior | Examples |
|---|---|---|---|
| **Standard STR** | Normal STR window with timer, HP bars, intent display | Full drag flow (enemy target, ground deploy, dispose) | Patrols, elites, Bunker Commandant, Depot Crossing |
| **Modified STR** | STR window with boss-specific overlay panels (node grid, spawn tracker, evasion meter) | Standard drag PLUS boss-specific drop zones | Mainframe Core (node zones), Sentry Nest (spawn pod zones), Sniper (Camera card zone), Orbital Carrier (drone shield zone) |
| **Minigame Suspend** | STR combat suspended entirely — MinigameContainer takes over rendering | No card drag — minigame has its own input | SkiFree, Snake, Asteroids (minigame version), Tower Attack (full arcade) |

### The Seam: `STREncounterProfile`

Every encounter type declares an **encounter profile** that the STR system reads at combat entry. This is the designer-facing abstraction that the STR-HUD-DESIGNER-ROADMAP's config extraction (Phase D1) feeds into.

```javascript
var STR_ENCOUNTER_PROFILES = {
  _default: {
    // ── Timing (Seam 1 from Designer Roadmap) ──
    resolution: { slideAwayMs: 300, lungeMs: 500, lungeStaggerMs: 100, impactPauseMs: 500, slideBackMs: 300 },

    // ── Lunge (Seam 2) ──
    lunge: { lungePx: 38, lungeScale: 1.25, lungeEasing: 'ease-in-out', hitFlashMs: 250, hitShakePx: 4 },

    // ── Timer (Seam 5) ──
    timerMs: 2000,

    // ── Countdown (Seam 6) ──
    countdown: { beatMs: 1000, fightFlashMs: 500, fadeMs: 400, messages: ['3','2','1','FIGHT!'] },

    // ── Drag behavior ──
    drag: {
      minimizable: true,         // can STR window minimize during drag?
      dwellThresholdMs: 600,     // ms outside window before minimize
      groundEffectsEnabled: true, // can cards deploy to map tiles?
      disposalEnabled: true,      // can cards drag to debrief feed?
      bossDropZones: []           // extra zone IDs registered for this encounter
    },

    // ── Window chrome ──
    windowClass: '',              // extra CSS class on .str-combat-window
    overlayPanel: null,           // DOM builder fn for boss-specific overlay (nodes, spawn count, etc.)
    minimizedIndicatorClass: '',  // extra CSS class on minimized indicator

    // ── Intent (Seams 3+4 from Designer Roadmap) ──
    expressionPool: null,         // null = use default FACE_EXPRESSIONS; array = restrict to these keys
    weaponPool: null,             // null = use default WEAPON_INTENTS; array = restrict to these keys

    // ── Minigame bridge ──
    minigame: null                // null = normal STR; string = MinigameContainer type to launch instead
  },

  standard:  { /* inherits _default */ },
  elite:     { timerMs: 2500, resolution: { lungeMs: 600, impactPauseMs: 650 } },
  quick:     { timerMs: 1500, resolution: { slideAwayMs: 200, lungeMs: 350, lungeStaggerMs: 50, impactPauseMs: 300, slideBackMs: 200 } },
  puzzle:    { timerMs: 2800, resolution: { lungeMs: 450, impactPauseMs: 600 } },

  // ── Boss encounter profiles ──
  boss:      {
    timerMs: 3000,
    resolution: { slideAwayMs: 400, lungeMs: 750, lungeStaggerMs: 200, impactPauseMs: 800, slideBackMs: 400 },
    lunge: { lungePx: 55, lungeScale: 1.4, hitShakePx: 6 },
    windowClass: 'str-boss-window'
  },

  DEPOT_CROSSING: {
    _extends: 'boss',
    countdown: { messages: ['TRAIN', 'DEPOT', 'CROSS!'] },
    drag: { bossDropZones: ['train-lane-lure'] },  // Lure card → train track drop zone
    windowClass: 'str-boss-window str-depot'
  },

  SENTRY_NEST: {
    _extends: 'boss',
    drag: { bossDropZones: ['spawn-pod-0', 'spawn-pod-1', 'spawn-pod-2'] },
    overlayPanel: '_renderSpawnPodTracker',
    windowClass: 'str-boss-window str-sentry'
  },

  BUNKER_COMMANDANT: {
    _extends: 'boss',
    drag: { bossDropZones: ['bunker-0','bunker-1','bunker-2','bunker-3','bunker-4','bunker-5','bunker-6','bunker-7','bunker-8'] },
    overlayPanel: '_renderBunkerGrid',
    windowClass: 'str-boss-window str-bunker'
  },

  MAINFRAME_CORE: {
    _extends: 'boss',
    timerMs: 2800,
    drag: { bossDropZones: ['node-0','node-1','node-2','node-3','node-4','node-5','node-6','node-7'] },
    overlayPanel: '_renderNodeGrid',
    windowClass: 'str-boss-window str-mainframe',
    expressionPool: ['scanning', 'calculating', 'error', 'processing']
  },

  ORBITAL_CARRIER: {
    _extends: 'boss',
    drag: { bossDropZones: ['drone-shield'] },
    overlayPanel: '_renderDroneFormation',
    windowClass: 'str-boss-window str-orbital'
  },

  SNIPER: {
    _extends: 'boss',
    timerMs: 3500,  // patience is the mechanic
    drag: { minimizable: false },  // locked window — can't browse map while sniper hunts you
    overlayPanel: '_renderEvasionMeter',
    windowClass: 'str-boss-window str-sniper',
    expressionPool: ['hidden', 'sighted', 'aiming', 'revealed']
  },

  ASTEROIDS: {
    _extends: 'boss',
    drag: { groundEffectsEnabled: false },  // movement locked — no map tile deployment
    overlayPanel: '_renderWaveCounter',
    windowClass: 'str-boss-window str-asteroids'
    // NOTE: BOSS_DESIGN.md also describes a full minigame version.
    // If the designer wants the arcade version, set: minigame: 'asteroids'
  },

  TOWER_OFFENSE: {
    _extends: 'boss',
    overlayPanel: '_renderVolleyTracker',
    windowClass: 'str-boss-window str-tower'
  },

  // ── Minigame encounters (STR suspended) ──
  SKIFREE: {
    minigame: 'skifree'
    // No STR timing/drag/window config — MinigameContainer owns everything
  },

  SNAKE: {
    minigame: 'snake'
  }
};
```

### How Profiles Flow Through the System

```
enterStrCombat(enemy, advantage, card)
  │
  ├─ resolve encounter profile:
  │    1. look up enemy.bossType in STR_ENCOUNTER_PROFILES (e.g. 'MAINFRAME_CORE')
  │    2. if not found, fall back to enemyType (e.g. 'boss', 'elite', 'standard')
  │    3. merge with _default (deep merge, _extends chain)
  │    → produces _activeProfile
  │
  ├─ if _activeProfile.minigame != null:
  │    suspend STR → launch MinigameContainer(_activeProfile.minigame)
  │    → on minigame end, resume STR or exit combat
  │    → DRAG UNIFICATION NOT INVOLVED (minigame owns input)
  │
  ├─ apply _activeProfile to systems:
  │    ├─ STRCombatWindow.applyProfile(_activeProfile)
  │    │    → sets timer, windowClass, overlayPanel, countdown
  │    │
  │    ├─ CardDragController.applyProfile(_activeProfile.drag)
  │    │    → updates dwellThresholdMs, registers bossDropZones,
  │    │      enables/disables groundEffects and disposal
  │    │
  │    ├─ EnemyIntentSystem.applyProfile(_activeProfile)
  │    │    → restricts expression/weapon pools per encounter
  │    │
  │    └─ HandFanComponent — no profile needed
  │         (fan behavior is context from CardDragController + STRCombatWindow)
  │
  └─ _playResolutionSequence reads timing from _activeProfile.resolution
```

### Boss-Specific Drop Zones (Dynamic Registration)

The current Phase 1 drop zone registry is static — zones registered at init. Boss encounters need dynamic zone registration that lives only for the duration of the fight.

```javascript
// In boss-encounters.js, after STR window renders overlay panel:
_activeBoss.registerCombatZones = function(profile) {
  var zoneIds = profile.drag.bossDropZones || [];
  var registered = [];

  zoneIds.forEach(function(zoneId) {
    var el = document.querySelector('[data-boss-zone="' + zoneId + '"]');
    if (!el) return;

    CardDragController.registerDropZone(el, {
      id: zoneId,
      accepts: function(drag) { return _activeBoss.acceptsCard(zoneId, drag.card); },
      onDragOver: function(drag) { _activeBoss.previewZone(zoneId, drag); },
      onDragLeave: function() { _activeBoss.clearZonePreview(zoneId); },
      onDrop: function(drag) { return _activeBoss.executeZoneDrop(zoneId, drag); },
      contexts: ['combat']
    });
    registered.push(zoneId);
  });

  return registered;
};

// On combat exit:
_activeBoss.unregisterCombatZones = function(registered) {
  registered.forEach(function(zoneId) {
    CardDragController.unregisterDropZone(zoneId);
  });
};
```

This means `CardDragController` Phase 1 must support `unregisterDropZone(id)` in addition to `registerDropZone()`.

---

## The MinigameContainer Bridge

BOSS_DESIGN.md describes a `MinigameContainer` framework that completely replaces the STR combat loop. When a minigame encounter triggers:

1. `enterStrCombat` detects `_activeProfile.minigame != null`
2. STR combat state machine pauses at a `'minigame'` phase (new phase value)
3. `MinigameContainer.launch(_activeProfile.minigame, _activeBoss, gameState)` takes over
4. MinigameContainer owns its own game loop, input, rendering
5. `CardDragController` is not active — no card drag during minigames
6. On minigame end: `MinigameContainer` calls back with `{ result, damageDealt, mythicMet }`
7. STR combat resumes at `'resolving'` phase (damage applied) or exits if boss is dead

The drag unification doesn't need to know minigame internals — it just needs the handoff seam:

```javascript
// In CardDragController:
applyProfile: function(dragProfile) {
  if (!dragProfile) {
    // Minigame encounter — disable all drag
    _enabled = false;
    return;
  }
  _enabled = true;
  _dwellThresholdMs = dragProfile.dwellThresholdMs || 600;
  _minimizable = dragProfile.minimizable !== false;
  _groundEffectsEnabled = dragProfile.groundEffectsEnabled !== false;
  _disposalEnabled = dragProfile.disposalEnabled !== false;
}
```

---

## Accessibility: Drag Is Not the Only Path

BOSS_DESIGN.md has a critical constraint:

> Any implementation that cannot be done neatly while in portrait, mobile single input priority needs to be totally reworked. These encounters must work for quadriplegics using adaptive controllers (sip in, blow out).

This means every action achievable by drag MUST also be achievable by tap-select + confirm:

1. **Tap card** → select it (existing)
2. **Tap enemy** → play selected card on enemy (existing targeting flow)
3. **Tap map tile** → deploy selected card as ground effect (needs: tap-to-target mode when STR minimized)
4. **Tap debrief feed** → dispose selected card (needs: tap-to-dispose confirmation)
5. **Tap boss zone** (node, bunker, spawn pod) → play selected card on that zone

`CardDragController` must expose a parallel **tap-target API**:

```javascript
CardDragController.beginTapTarget(card, sourceZone)   // highlight valid zones
CardDragController.commitTapTarget(zoneId)              // execute on tapped zone
CardDragController.cancelTapTarget()                    // escape / tap elsewhere
```

The designer roadmap's keyboard shortcut Phase 5.5 maps to this same API — number keys select card, arrow keys cycle zones, Enter commits.

For adaptive controllers (sip/puff → mapped to binary inputs), the flow is: sip = cycle to next card, puff = select/confirm. The tap-target API handles this because cycling and confirming are discrete events, not continuous pointer movement.

---

## Target Architecture: Unified Pointer Drag

Replace the three-system mess with **one pointer-based drag controller** that uses the same input fork for all contexts.

### The Single Input Model

```
pointerdown on card
  │
  ├─ tap (<200ms, <10px movement) → toggle card selection (existing)
  │
  └─ drag (>200ms OR >10px movement) → enter DRAG MODE
       │
       ├─ visual: card lifts out, placeholder holds slot, card follows cursor
       │
       ├─ while inside STR window:
       │    ├─ over enemy → enemy glow, release = play card on enemy
       │    ├─ over enemy hand slot → slot glow, release = plant card (future)
       │    ├─ over boss zone (node, bunker, pod) → zone glow, release = boss interaction
       │    ├─ over own hand → card returns to slot (cancel drag)
       │    └─ over backup draw zone → card moves to backup (future)
       │
       ├─ exits STR window (pointer leaves bounds + dwell ≥ profile.dwellThresholdMs):
       │    ├─ if profile.minimizable: STR window minimizes with animation
       │    │    ├─ card ghost still follows cursor over map
       │    │    ├─ if profile.groundEffectsEnabled: over grid cell → AoE preview, release = deploy
       │    │    ├─ if profile.disposalEnabled: over debrief feed → disposal glow, release = incinerate
       │    │    └─ release over nothing → card returns, STR maximizes
       │    └─ if !profile.minimizable: pointer is clamped to window bounds (Sniper boss)
       │
       └─ dragend / pointerup:
            ├─ successful deploy → profile.resolution.slideBackMs delay showing effect → STR maximizes
            ├─ successful incinerate → placeholder collapses → STR maximizes
            ├─ successful boss zone interaction → boss callback handles animation → STR stays
            ├─ invalid drop → card animates back to slot → STR maximizes (if minimized)
            └─ drag cancelled → card returns to slot, state restored
```

### Why Pointer Events Instead of HTML5 Drag

HTML5 Drag & Drop is fundamentally broken for this use case:

- **No control over ghost** — browser renders its own translucent clone, can't update it live
- **0,0 coordinate bug** — `drag` events report (0,0) for off-screen, breaking hit detection
- **Cross-frame issues** — ghost can't follow cursor into different DOM layers (map under STR)
- **Touch inconsistency** — HTML5 drag barely works on mobile, requires polyfills
- **Can't cancel mid-drag** — `dragend` fires asynchronously, state cleanup is unreliable

Pointer events give us:
- Full cursor tracking with `pointermove` (reliable coordinates)
- A real DOM element following the cursor (not a browser ghost)
- `setPointerCapture` for guaranteed `pointerup` delivery
- Touch + mouse + pen support natively
- Ability to hit-test drop zones in real time with `document.elementFromPoint`

---

## Phase Plan

### Phase 0: Prep — Isolate and Stabilize (Current Session)

**Status: DONE (v=20260307c)**

- [x] `dragstart` cancels pointer-hold targeting (prevents velocity race)
- [x] `setMode()` defers during active `_liftDrag` (prevents DOM destruction)
- [x] Ghost clone `cssText` override (prevents fan transform inheritance)
- [x] Resolution guard: force-maximize STR + cancel drag before `_playResolutionSequence`
- [x] `HandFanComponent.cancelActiveDrag()` public method

No new files. Patches live in `hand-fan-component.js` until Phase 1 replaces them.

### Phase 1: CardDragController — Single Pointer Drag System

**Status: DONE (v20260307d)** — `card-drag-controller.js` created, script tag added, resolution guard wired.

**New file:** `public/js/card-drag-controller.js`

IIFE singleton `CardDragController`. Owns ALL card drag state globally.

**1.1 — Core drag lifecycle**

```
CardDragController = {
  _state: null,  // { cardId, cardIndex, sourceZone, ghostEl, placeholderEl,
                 //   startX, startY, pointerId, strMinimized, phase }
  _profile: null, // active STREncounterProfile.drag section
  _enabled: true, // false during minigame encounters

  beginDrag(cardEl, cardIndex, card, sourceZone, pointerEvent)
  updateDrag(pointerEvent)      // called on pointermove
  endDrag(pointerEvent)         // called on pointerup
  cancelDrag()                  // escape key or pointercancel

  isDragging()                  // → bool
  getState()                    // → current drag state

  // Encounter profile
  applyProfile(dragProfile)     // called on combat entry
  clearProfile()                // called on combat exit

  // Tap-target API (accessibility / adaptive controller path)
  beginTapTarget(card, sourceZone)
  commitTapTarget(zoneId)
  cancelTapTarget()
}
```

**1.2 — Ghost element (real DOM, not browser clone)**

- On `beginDrag`: clone card element, append to `document.body` with `position: fixed`, `pointer-events: none`, `z-index: 10000`
- On `updateDrag`: set ghost `left`/`top` to pointer coordinates (offset by grab point)
- On `endDrag`: animate ghost to target or back to placeholder, then remove
- Ghost inherits card appearance but strips fan transforms (rotate, translateY)
- Ghost at 90% scale with subtle drop shadow for "lifted" feel
- Boss encounters can apply `_profile.ghostClass` for themed ghost chrome (e.g. `str-mainframe-ghost` with green grid overlay)

**1.3 — Placeholder in hand fan**

- On `beginDrag`: insert dotted placeholder at card's position (reuse existing `.hand-card-drag-placeholder` CSS)
- Placeholder inherits fan transform + marginLeft + zIndex for exact slot match
- Original card wrapper hidden (`visibility: hidden` not positional — avoids layout shift)
- On successful deploy/incinerate: placeholder collapses (`.placeholder-collapsing`)
- On cancel: placeholder removed, original card wrapper restored

**1.4 — Drop zone registry**

Merge `CardTransferManager._dropZones` pattern into `CardDragController`:

```
CardDragController.registerDropZone(element, {
  id: 'enemy-avatar',         // unique zone name
  accepts: fn(dragState),     // → bool
  onDragOver: fn(dragState),  // visual feedback (glow, AoE preview)
  onDragLeave: fn(),          // remove feedback
  onDrop: fn(dragState),      // execute action (play, deploy, dispose, plant)
  contexts: ['combat']        // only active in these modes
});

CardDragController.unregisterDropZone(id);  // for boss zone cleanup on combat exit
```

Built-in zones registered at init:

| Zone ID | Element | Context | Action |
|---|---|---|---|
| `enemy-avatar` | `.str-combatant.str-enemy` | combat | Play card on enemy |
| `enemy-hand-slot` | `.enemy-hand-slot` | combat | Plant card (future) |
| `map-grid` | `#rogue-grid` | combat (minimized) | Deploy ground effect |
| `debrief-feed` | `#debrief-screen` | combat (minimized), exploration | Incinerate/discard |
| `hand-fan` | `#hand-fan-container` | combat, exploration | Return to hand (cancel) |
| `nch-hand` | `[data-dropzone="hand"]` | nch-open | Move to hand |
| `nch-backup` | `[data-dropzone="backup"]` | nch-open | Move to backup |
| `nch-vault` | `[data-dropzone="vault"]` | nch-open | Move to vault |
| `shop-sell` | `.shop-sell-zone` | shop-open | Sell card |

Boss-specific zones (`node-0..7`, `bunker-0..8`, `spawn-pod-0..2`, `train-lane-lure`, `drone-shield`) are registered dynamically via `_activeBoss.registerCombatZones()` and unregistered on combat exit.

**1.5 — STR window minimize/maximize integration**

- `CardDragController` owns the minimize decision, not the drag handler
- Minimize triggers when pointer exits STR window bounds and dwells ≥ `_profile.dwellThresholdMs` (default 600ms)
- Minimize is reversible: if pointer re-enters STR bounds before releasing, STR maximizes immediately
- If `_profile.minimizable === false` (e.g. Sniper boss), drag is clamped to window bounds
- On minimize: `STRCombatWindow.minimize()` called, but `HandFanComponent.setMode` is **blocked** (controller handles fan visibility)
- Fan stays in combat position with placeholder visible — does NOT reposition to bottom
- Ghost continues following cursor over map layer

**1.6 — Profile-aware behavior**

When `applyProfile(dragProfile)` is called on combat entry:
- Store `_profile` for the duration of the encounter
- If `dragProfile === null` (minigame encounter), set `_enabled = false`
- Read `minimizable`, `dwellThresholdMs`, `groundEffectsEnabled`, `disposalEnabled`
- Read `bossDropZones` array → these will be registered after STR window renders the overlay panel

When `clearProfile()` is called on combat exit:
- Unregister all boss-specific drop zones
- Reset to default behavior
- Set `_enabled = true`

### Phase 2: Wire Into HandFanComponent — **DONE** (v20260307e)

**2.1 — Remove old drag systems from `_attachCardHandlers`**

Delete from `hand-fan-component.js`:
- The `dragstart` handler (lines 1140-1234) → replaced by CardDragController.beginDrag
- The `drag` handler (lines 1238-1268) → replaced by CardDragController.updateDrag
- The `dragend` handler (lines 1270-1350) → replaced by CardDragController.endDrag
- The `_html5DragCollapse` state object → replaced by CardDragController._state.strMinimized
- The `_liftDrag` state object → replaced by CardDragController._state

**2.2 — Merge pointer-hold targeting into CardDragController**

The `_beginHoldTargeting` function (lines 744-955) contains the actual card deployment logic:
- Enemy hit detection (`_isEnemyUnderPointer`)
- Ground effect deployment (AoE preview, GroundEffects.setGroundEffect)
- STR window collapse (`_maybeCollapseCombatUi`)
- Card consumption on successful deploy

Move all of this INTO `CardDragController` as zone callbacks:
- `_isEnemyUnderPointer` → `enemy-avatar` zone's `accepts` check
- Ground effect deployment → `map-grid` zone's `onDrop` callback
- AoE preview → `map-grid` zone's `onDragOver` callback
- Velocity collapse → removed (replaced by dwell-based minimize in Phase 1.5)

**2.3 — New `pointerdown` handler in HandFanComponent**

Replace the current dual `pointerdown` (hold timer + swipe detector) with:

```javascript
cardEl.addEventListener('pointerdown', function(e) {
  if (e.button !== 0) return;
  if (_mode !== 'combat') return;
  if (cardEl.dataset.unaffordable === 'true') return;

  var startX = e.clientX, startY = e.clientY;
  var pointerId = e.pointerId;
  var dragStarted = false;

  function onMove(ev) {
    if (ev.pointerId !== pointerId) return;
    var dx = ev.clientX - startX;
    var dy = ev.clientY - startY;
    if (!dragStarted && Math.sqrt(dx*dx + dy*dy) > 10) {
      dragStarted = true;
      CardDragController.beginDrag(cardEl, index, card, 'hand-fan', e);
    }
    if (dragStarted) {
      CardDragController.updateDrag(ev);
    }
  }

  function onUp(ev) {
    if (ev.pointerId !== pointerId) return;
    cleanup();
    if (dragStarted) {
      CardDragController.endDrag(ev);
    } else {
      // Tap — toggle selection (or beginTapTarget for boss zones)
      _toggleCardSelection(index);
    }
  }

  function cleanup() {
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
  }

  function onCancel(ev) {
    cleanup();
    if (dragStarted) CardDragController.cancelDrag();
  }

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
});
```

**2.4 — Remove `draggable="true"` from card wrappers**

No more HTML5 drag. Card wrappers are plain `div`s. All drag is pointer-based.

### Phase 3: Retire Legacy Systems — **DONE** (v20260307f)

**3.1 — CardDisposalSystem becomes a drop zone callback**

`CardDisposalSystem.handleDragStart/End/Drop` → absorbed into the `debrief-feed` drop zone's `onDrop`. The disposal validation logic (lifecycle checks, BLVCK guard, animation) stays but is called from `CardDragController` instead of from HTML5 drag events.

**3.2 — CommerceDragDropSystem becomes a drop zone callback**

Shop sell logic → `shop-sell` zone's `onDrop`. `DropZoneDetector` glow system → `CardDragController.registerDropZone.onDragOver`.

**3.3 — CardTransferManager merges into CardDragController**

The NCH drop zones (`nch-hand`, `nch-backup`, `nch-vault`) register via `CardDragController.registerDropZone`. The HTML5 drag listeners in `CardTransferManager` are deleted. The `CardStateAuthority` write-through logic stays in the zone callbacks.

**3.4 — Delete dead code**

- `_html5DragCollapse` object in hand-fan-component.js
- `_liftDrag` object in hand-fan-component.js
- `_beginHoldTargeting` function in hand-fan-component.js
- `_maybeCollapseCombatUi` function (nested in `_beginHoldTargeting`)
- HTML5 drag handlers (`dragstart`, `drag`, `dragend`) in `_attachCardHandlers`
- `CardTransferManager.js` → entirely replaced (or kept as thin wrapper calling CardDragController)

### Phase 4: Enemy Hand Interactions (Future — ENI Roadmap)

**4.1 — Enemy hand drop zones**

When enemy hand display is rendered in STR combat, register each enemy card slot as a drop zone:

```
CardDragController.registerDropZone(enemySlotEl, {
  id: 'enemy-hand-slot-' + i,
  accepts: fn(drag) { return drag.sourceZone === 'hand-fan' && isPlantableCard(drag.card); },
  onDragOver: fn() { /* glow slot, show "PLANT" label */ },
  onDrop: fn(drag) { /* execute plant mechanic via CardStateAuthority */ },
  contexts: ['combat']
});
```

**4.2 — Enemy card theft (drag FROM enemy hand)**

The reverse flow: player drags a card OUT of the enemy hand into their own hand. Same controller, different `sourceZone`:

```
CardDragController.beginDrag(enemyCardEl, enemyIndex, enemyCard, 'enemy-hand', pointerEvent);
```

The `hand-fan` and `nch-backup` zones accept cards from `enemy-hand` source.

### Phase 5: Polish and Edge Cases

**5.1 — Resolution guard** ✅ DONE (v20260307c)

At the start of `_playResolutionSequence` in `str-combat-integration.js`:
- ✅ `HandFanComponent.cancelActiveDrag()` — new public method cleans up targeting, liftDrag, html5DragCollapse, ghost/placeholder DOM
- ✅ If `STRCombatWindow.isMinimized()`, force `STRCombatWindow.maximize()` + `setMode('combat','centered')`
- ✅ `HandFanComponent.restore()` — ensure fan is visible before slideAway
- When `CardDragController` exists (Phase 1), add `CardDragController.cancelDrag()` call here too
- Resolution reads timing from `_activeProfile.resolution` instead of magic numbers

**5.2 — Timer expiry during drag**

If the STR timer expires while a card is being dragged:
- Cancel the drag (card returns to hand)
- Run normal timer expiry flow (`handleStrTimerExpired`)
- Visual: ghost snaps back to placeholder, then hand fan does its resolution slide-away

**5.3 — Swipe gestures**

The existing swipe detector (pointerdown → pointerup with vertical distance > 30px) stays as a separate gesture recognizer. It does NOT conflict with drag because drag requires >10px movement in any direction before activating, and swipe requires >30px vertical on quick release. The two are distinguished by hold duration and movement pattern.

**5.4 — Touch scroll disambiguation**

On mobile, vertical drag on a card could be confused with page scroll. Use `touch-action: none` on card elements during combat mode to prevent scroll interference. Already partially handled by pointer capture.

**5.5 — Keyboard + adaptive controller targeting (accessibility)**

Every drag action has a tap-target equivalent:
- Number keys 1-5 select cards, Enter commits, Escape cancels
- Arrow keys cycle through valid drop zones (enemy, boss zones, map tiles)
- For adaptive controllers: sip = cycle zone, puff = confirm
- `CardDragController.beginTapTarget()` highlights all valid zones with numbered labels
- `CardDragController.commitTapTarget(zoneId)` executes the drop callback
- Boss-specific zones appear in the cycle order when registered

**5.6 — Per-boss window skinning**

The `windowClass` field in `STREncounterProfile` adds CSS classes to the STR window container. Each boss type can define a complete visual theme:

```css
/* Standard boss — darker chrome, red accents */
.str-boss-window { border-color: #ff3333; background: rgba(20,0,0,0.95); }

/* Mainframe Core — green terminal aesthetic */
.str-boss-window.str-mainframe { border-color: #00ff41; background: rgba(0,10,0,0.95); font-family: 'Courier New'; }
.str-boss-window.str-mainframe .str-intent-display { color: #00ff41; }

/* Sniper — blue scope overlay, crosshair cursor */
.str-boss-window.str-sniper { border-color: #4fc3f7; cursor: crosshair; }

/* Depot Crossing — yellow caution stripes */
.str-boss-window.str-depot { border-image: repeating-linear-gradient(45deg, #000, #000 10px, #ffeb3b 10px, #ffeb3b 20px) 10; }
```

The designer tool (STR-HUD-DESIGNER-ROADMAP Phase D4) previews these themes by applying the CSS class to the mock STR window.

**5.7 — Overlay panel system**

Each boss profile can specify an `overlayPanel` function name. `STRCombatWindow.applyProfile()` calls this function to inject boss-specific UI into the window:

```javascript
// In str-combat-window.js:
function applyProfile(profile) {
  _activeProfile = profile;
  _windowContainer.className = 'str-combat-window ' + (profile.windowClass || '');

  // Inject boss overlay panel
  if (profile.overlayPanel && typeof _overlayBuilders[profile.overlayPanel] === 'function') {
    var overlay = _overlayBuilders[profile.overlayPanel](_combatState);
    _overlayContainer.innerHTML = '';
    _overlayContainer.appendChild(overlay);
    _overlayContainer.style.display = 'block';
  } else {
    _overlayContainer.style.display = 'none';
  }
}
```

Overlay builders registered by `boss-encounters.js` at init:
- `_renderNodeGrid` — 8-node ring for Mainframe Core (RED/BLUE state visualization)
- `_renderBunkerGrid` — 3x3 bunker grid for Bunker Commandant (HP per bunker)
- `_renderSpawnPodTracker` — 3 pod HP bars for Sentry Nest
- `_renderDroneFormation` — drone count + shield status for Orbital Carrier
- `_renderEvasionMeter` — photograph count + evasion % for Sniper
- `_renderWaveCounter` — asteroid wave + streak counter for Asteroids
- `_renderVolleyTracker` — volley phase + suppression timer for Tower Offense

---

## Alignment with Designer Roadmap (STR-HUD-DESIGNER-ROADMAP)

The six seams identified in the designer roadmap map directly to `STREncounterProfile` fields:

| Designer Seam | Profile Field | Designer Setter | Config Extraction Phase |
|---|---|---|---|
| Seam 1 — Resolution Timing | `profile.resolution.*` | `setResolutionTiming(enemyType, overrides)` | D1 |
| Seam 2 — Lunge Parameters | `profile.lunge.*` | `setLungeParams(who, overrides)` | D1 |
| Seam 3 — Intent Expressions | `profile.expressionPool` | `registerExpression(key, def)` | D1 |
| Seam 4 — Weapon Intents | `profile.weaponPool` | `registerWeaponIntent(key, def)` | D1 |
| Seam 5 — Timer Durations | `profile.timerMs` | `setTimerDuration(enemyType, ms)` | D1 |
| Seam 6 — Countdown Overlay | `profile.countdown.*` | `setCountdownParams(overrides)` | D1 |

**New seams added by this document:**

| Seam | Profile Field | Purpose |
|---|---|---|
| Seam 7 — Drag Behavior | `profile.drag.*` | Per-encounter minimize/deploy/dispose toggles |
| Seam 8 — Window Chrome | `profile.windowClass` | Per-encounter CSS theming |
| Seam 9 — Overlay Panel | `profile.overlayPanel` | Boss-specific UI injection |
| Seam 10 — Boss Drop Zones | `profile.drag.bossDropZones` | Dynamic zone registration |
| Seam 11 — Minigame Bridge | `profile.minigame` | STR suspension for arcade encounters |
| Seam 12 — Adaptive Input | tap-target API | Accessibility path parallel to drag |

The designer tool (Phase D4) creates named encounter profiles. Each profile is a partial `STREncounterProfile` that deep-merges with `_default`. Profiles export to `str-combat-profiles.json` and load at runtime via `str-combat-integration.js init()`.

---

## Alignment with Boss Encounters (BOSS_ENCOUNTER_IDEAS + BOSS_DESIGN)

### Boss → Profile Mapping

| Boss Type | Category | Profile Key | Special Drag Behavior | Special Window Chrome |
|---|---|---|---|---|
| Depot Crossing | Standard STR | `DEPOT_CROSSING` | Lure → train lane drop zone | Caution stripe border |
| Sentry Nest | Modified STR | `SENTRY_NEST` | Grenade → spawn pod drop zones | Pod HP overlay |
| Bunker Commandant | Modified STR | `BUNKER_COMMANDANT` | Grenade → bunker grid drop zones | 3x3 bunker grid overlay |
| Mainframe Core | Modified STR | `MAINFRAME_CORE` | Logic Hack/Jammer → node drop zones | Green terminal theme |
| Orbital Carrier | Modified STR | `ORBITAL_CARRIER` | High Ground → drone shield zone | Drone formation overlay |
| Sniper | Modified STR | `SNIPER` | Window not minimizable; Camera card special zone | Scope/crosshair theme |
| Asteroids | Modified STR or Minigame | `ASTEROIDS` | No ground effects (movement locked) | Wave counter overlay |
| Tower Offense | Modified STR | `TOWER_OFFENSE` | Standard drag | Volley phase overlay |
| SkiFree | Minigame Suspend | `SKIFREE` | No drag (minigame owns input) | N/A — MinigameContainer |
| Snake | Minigame Suspend | `SNAKE` | No drag (minigame owns input) | N/A — MinigameContainer |
| Treasure Goblin King | Standard STR | `boss` (default) | Standard drag | Default boss chrome |
| Uber Mega | Standard STR | `boss` (default) | Standard drag | Default boss chrome |

### BOSS_DESIGN.md Accessibility Constraint

The constraint that encounters must work for adaptive controllers drives the tap-target API (Seam 12). This is NOT optional — it's the primary input path for T1 difficulty on adaptive controllers. Drag is the enhanced path for T2/T3 difficulty and standard controllers.

Boss-specific "perfect kill" action cards (like the train grapple TODO from BOSS_DESIGN.md) solve locomotion challenges at T2/T3 without requiring continuous drag input.

---

## File Impact Summary

| File | Action | Phase |
|---|---|---|
| `card-drag-controller.js` | **NEW** — unified drag singleton with profile system + tap-target API | 1 |
| `hand-fan-component.js` | Remove 3 drag systems, add pointer-based drag initiation | 2 |
| `card-disposal-system.js` | Convert to drop zone callback | 3 |
| `commerce-drag-drop-system.js` | Convert to drop zone callback | 3 |
| `card-transfer-manager.js` | Merge into CardDragController or thin wrapper | 3 |
| `drop-zone-detector.js` | Retire (replaced by CardDragController zone registry) | 3 |
| `str-combat-integration.js` | Profile resolution on combat entry, resolution guard reads profile timing | 1, 5 |
| `str-combat-window.js` | `applyProfile()` for window chrome + overlay panels + timer | 1 |
| `boss-encounters.js` | `registerCombatZones()` / `unregisterCombatZones()` + overlay builders | 1 |
| `enemy-intent-system.js` | `applyProfile()` for expression/weapon pool restriction | 1 |
| `non-combat-hud.js` | Register NCH zones via CardDragController instead of HTML5 | 3 |
| `str-combat-window.css` | Boss theme classes (`.str-boss-window.str-mainframe` etc.) | 5 |
| `index.html` | Add `card-drag-controller.js` script tag | 1 |

---

## Migration Strategy

Phases 1-2 can ship together as one PR. The new `CardDragController` is wired in, the old `dragstart`/`drag`/`dragend` handlers are deleted, and pointer-hold targeting is absorbed. This is the "big bang" — but scoped to `hand-fan-component.js` + 1 new file.

Phase 3 ships separately: each legacy system (CardDisposalSystem, CommerceDragDropSystem, CardTransferManager) is converted one at a time. Each conversion is independently testable.

Phases 4-5 ship with their parent roadmaps (ENI, CHH respectively).

The encounter profile system (Seams 7-12) can be implemented incrementally:
1. First: `_default` profile only (standard STR behavior, no boss awareness)
2. Second: `windowClass` + CSS themes for existing boss types
3. Third: `overlayPanel` injection for bosses that need custom UI
4. Fourth: dynamic boss drop zones
5. Fifth: `minigame` bridge for arcade encounters
6. Sixth: tap-target API for accessibility

---

## Anti-Patterns to Avoid

- **Never have two systems listening to the same `pointerdown`** on the same element for overlapping purposes. One controller, one state machine.
- **Never rebuild DOM during an active drag.** If mode changes are needed, defer them.
- **Never use HTML5 drag for gameplay interactions.** It was designed for file managers, not card games. Pointer events are the standard for game-like drag interactions.
- **Never use velocity-based collapse.** Dwell-based (time outside bounds) is predictable and reversible. Velocity checks fire on fast flicks and surprise the player.
- **Never minimize STR during resolution.** Force-maximize before running slide animations.
- **Never hardcode encounter-specific behavior in CardDragController.** Boss logic lives in drop zone callbacks registered by `boss-encounters.js`, not in the drag controller itself.
- **Never make drag the only input path.** Every drag action must have a tap-select + confirm equivalent for adaptive controllers and keyboard users.
- **Never register boss drop zones without cleanup.** Every `registerDropZone` in combat entry must have a matching `unregisterDropZone` in combat exit.
