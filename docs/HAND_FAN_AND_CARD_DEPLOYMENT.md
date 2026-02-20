# Hand Fan Component + Combat Card Deployment (Designer Notes)

## Current Behavior (as implemented)

### Hand Fan
- Implemented in: `public/js/hand-fan-component.js`
- Styles: `public/css/hand-fan-component.css`
- Integration glue: `public/js/str-combat-integration.js`

**Selection model**
- Tap/click a card to select/deselect.
- Selected cards are committed when:
  - player explicitly plays them (`HandFanComponent.playSelectedCards()`), or
  - STR timer expires (integration commits selected cards), or
  - future: explicit commit UI.

**Multi-card play**
- HandFan sends selected card *indices* into `GoneRogue.handleMultiCardCombat(indices)`.

**Drag model**
- Dragging a card is currently used for:
  - recycling/incineration via `CardDisposalSystem`
  - selling when shop is open via `CommerceDragDropSystem`

### STR Combat Window intent animator
- Intent faces/weapons are displayed by `EnemyIntentSystem` and rendered by `STRCombatWindow`.
- The intent glyph animation is lightweight:
  - only starts an interval if the current intent expression has `frames`.

## Layout / Positioning

### Mobile portrait abbreviation
Default is **unabbreviated** card names.

When the combat UI is minimized/collapsed on **mobile portrait**, HandFan abbreviates card names aggressively (max 4 chars) using `NameUtils.getDisplayName(..., {maxLength})`.
This auto-updates on orientation changes (window resize).

Backup Action Container uses the same rule for slot names.

### Combat hand fan placement
Hand fan supports three positions:
- `combat / centered` (legacy)
- `combat / peripheral` (default for STR window)
- `contextual / bottom` (when STR window minimized)

**Peripheral position goal:** reduce occlusion of STR combat window.
- CSS class: `.hand-fan-combat-peripheral`
- Default positioning: `top: 30vh; left: 50%; transform: translate(-50%,-50%)`

## Defeatable vs Friendly NPC Gates (Tutorial Floors)

Tutorial floors can include NPCs with optional gate projection.

- `gate.type: 'friendly'`
  - On victory: gate zones clear; NPC remains; passage opens.
- `gate.type: 'defeatable'`
  - On victory: NPC despawns; NPC tile clears; gate zones clear.

## Gaps / Next planned work

1) **Click-to-target vs click-to-select**
   - Current system uses click-to-select.
   - Implemented targeting mode (Option 1): **press-and-hold** enters enemy-targeting mode.
     - Hold lifts the card + crosshair cursor
     - Dragging outside the STR combat window (15% threshold or fast exit) will **auto-minimize** the combat window to expose the map
     - Release over enemy plays that single card
     - Release elsewhere cancels
     - On release/cancel, the STR window is restored if it was minimized by the drag
   - Tap still toggles selection for multi-card commits.

2) **Backup action container (expendable slots)**
   - Implemented in: `public/js/backup-action-container.js` + `public/css/backup-action-container.css`
   - Integration: `public/js/str-combat-integration.js`
   - v1 behavior:
     - shows 3 vertical slots on the left during STR combat
     - fills 1 slot per round with a rolled consumable card
     - click moves backup card into hand (loose inventory)
   - TODO: play-direct-from-backup (skip hand), item reserve sources, and action-point/economy rules

3) **Ground effect deployment / contextual targeting**
   - Implemented (v1) for DOM grid: release a held-targeting card over a `.rogue-cell` to deploy a `GroundEffects` tile.
   - Mapping is designer-configurable via `GroundEffectCardMappings`.
   - Designer portal: `public/tests/ground-effects-designer.html`
   - Notes:
     - Canvas renderer support not implemented yet (needs coordinate mapping)
     - Targeting preview (AoE overlay) not implemented yet

3) **Synergy chaining rules**
   - Multi-card selection exists, but synergy resolution is still in GoneRogue.
   - If we want “controlled chaos”, we should define:
     - max cards per commit
     - ordering (selected order vs sorted)
     - feedback (tooltip + intent face changes)
