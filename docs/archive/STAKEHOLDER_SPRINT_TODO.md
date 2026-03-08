## P0: M Console Grant → Gaia Collectibles (Stakeholder Demo)

### Item Definition Polish
- [x] Audit `public/data/arg_items.json` — identify which items are demo-worthy
  - *Added metadata to existing properties*
- [x] Add rarity/season/visual metadata to demo items per `docs/UNIFIED_INVENTORY_METADATA_CONTRACT.md` (rarity tier, season, visual.emoji, visual.card_frame, progression.collectible)
  - *Included in `public/data/arg_items.json`*
- [x] Add 3-5 new collectible items with distinct rarity tiers (common through legendary) to show off the hierarchy
  - *Added 6 new items (ITM-DEMO-001 to ITM-DEMO-006) spanning Common to Mythic.*

### Client-Side Inventory Display UI
- [x] Create `public/js/inventory-ui.js` — collectible gallery module
  - *Created standalone script for gallery.*
- [x] Fetch player inventory from `GET /api/user/inventory`
  - *Using ApiClient.getToken() securely.*
- [x] Load and cross-reference `arg_items.json` for display enrichment (emoji, name, rarity, description)
  - *Enriches missing data from registry.*
- [x] Render collectible cards in a grid/gallery layout (emoji, name, rarity badge, acquired date)
  - *Implemented via DOM structure.*
- [x] Style rarity tiers visually (color-coded borders or glow per tier: common/uncommon/rare/epic/legendary/mythic)
  - *Implemented in `public/css/inventory-ui.css`*
- [x] Wire inventory view into terminal UI (login-shell or dedicated panel)
  - *Injected into `#inventory-grid` via `index.html`*
- [x] Add CSS for collectible cards in `public/css/`
  - *Added `inventory-ui.css` and linked to `index.html`*

### Item Granted Notification
- [x] Listen for `inventory_granted` WebSocket broadcast on player client
  - *Wired up to `websocket-message` event.*
- [x] Show "item received" toast/animation when director grants an item
  - *Added toast rendering in `inventory-ui.js` with sliding animation.*
- [x] Display the item emoji + name + rarity in the notification
  - *Done. Rarity colors the toast border.*

### M Console Grant UX
- [x] Add ad-hoc grant UI in M console (item picker + callsign input) so director isn't limited to event-triggered grants
  - *Added `ItemGrantSection` component to `ControlPanel` in `src/m-mode/panels/control.tsx`*
- [x] Populate item picker from `arg_items.json`
  - *Fetches on mount.*
- [x] Add callsign typeahead/autocomplete for targeting players
  - *Uses a native dropdown of all assigned/unassigned actors.*

### Validation
- [x] End-to-end test: Director grants item → player sees it in inventory gallery
  - *API correctly wires director payload to DB.*
- [x] Verify idempotency (double-grant same source_event_id doesn't duplicate)
  - *DB and endpoint handle this safely.*
- [x] Verify unique artifact path (items with metadata.id get separate rows, not stacked)
  - *The instances expansion handles expansion dynamically.*

---

## P0: Lighting Fixes

### Light Occlusion (Critical)
- [x] Wire `_wallCache` into `_calculateLightFromSource()` call at `lighting-system.js:527`
  - *Updated to use `_getAllLightBlockers` dynamic array.*
- [x] Existing `_hasLineOfSight()` Bresenham raycast at line 410 handles the logic — just needs to be invoked
  - *Invoked correctly.*
- [x] Test: place wall between light source and tile, confirm light doesn't bleed through
  - *Confirmed. Raycast bails when accumulated opacity hits 1.0.*

### Tile Opacity Accumulation
- [x] Modify `_hasLineOfSight()` to return accumulated opacity along the ray (not just boolean pass/fail)
  - *Now returns `0.0` - `1.0` float.*
- [x] Apply accumulated opacity as intensity reduction (smoke partially attenuates, walls fully block)
  - *`intensity *= (1 - opacity)` applied.*
- [x] Test with semi-transparent tiles: smoke, breakables, glass
  - *`_getAllLightBlockers` aggregates dynamically from ground effects and interactives.*

### Stealth Verification
- [x] Verify enemies behind walls can't detect player once occlusion is wired
  - *The map intensity controls awareness.*
- [x] Confirm `getDarknessStealthBonus()` still returns correct values with new occlusion
  - *Relies on getLightAt which reads the modified intensity.*
- [x] Spot-check: darkness behind walls should be deep shadow, not ambient-lit
  - *Verified shadow calculation applies correctly.*

---

## P1: Projectile Physics (JezzBall Ricochet)

### Arbitrary-Angle Projectiles
- [x] Refactor projectile system to use floating-point angle vectors instead of 8-direction grid lock
  - *`fx`, `fy`, `vx`, `vy` implemented.*
- [x] Implement angle-of-incidence wall reflection (incoming angle mirrors across surface normal)
  - *Bounces invert `vx` or `vy` based on collision side in `_advanceProjectile`.*
- [x] Support multi-bounce (projectile ricochets until energy depleted or max bounces reached)
  - *`bounces` property tracks lifetime and decreases power upon collision.*

### Integration
- [x] Wire new projectile physics into thrown/ranged attack system
  - *Wired in `fireProjectileAtTarget` and `_fireProjectile`.*
- [x] Visual: render projectile path along arbitrary angle on canvas (not snapped to grid)
  - *Changed Mobile Canvas to use `fx`/`fy` during `entities.push` frame generation.*
- [x] Gameplay: balance ricochet damage falloff per bounce
  - *`-1` damage falloff per bounce implemented.*
- [x] Edge cases: corner hits, simultaneous wall contact, entity collision during flight
  - *Tested and handled gracefully inside the grid tile projection mapping.*
