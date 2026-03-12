# Unified Designer Guide

This guide explains the workflow for using the Unified Designer to create game worlds, from assets to final deployment.

## 1. The Unified Designer Hub

The `unified-designer.html` file is the central hub for all design activities. It provides a top-level navigation bar to switch between the main design tools:

*   **Asset Designer:** For creating and managing scene assets.
*   **Map Designer:** For creating 2D tile-based maps.
*   **Interior Designer:** For creating building interiors with floor hierarchy (N, N.N, N.N.N).
*   **World Designer:** For creating a flowchart-like graph of the game world.
*   **Item Designer:** For creating and configuring game items (equipment, consumables, keys).
*   **Loot Designer:** For building loot tables assigned to breakables and enemies.
*   **Media Designer:** For previewing, assigning, and uploading audio/video assets (formerly Sound Designer).

## 2. The Asset Pipeline

The Unified Designer implements a clear pipeline for creating and using assets:

### 2.1. Create Assets in the Asset Designer

1.  Open the Unified Designer and select the "Asset Designer" tab.
2.  Create your scene assets, defining their properties (emojis, density, etc.).
3.  When you are finished, click the "Export to Registry" button. This will register the asset in the global asset registry, making it available to the other designers.

### 2.2. Use Assets in the Map Designer

1.  Switch to the "Map Designer" tab.
2.  In the tool palette on the left, you will see a new "Assets" section. This section will be populated with the assets you created in the Asset Designer.
3.  Click on an asset to select it as your current tool.
4.  Click on the map canvas to place the asset on the map.

### 2.3. Save Floors in the Map Designer

1.  Once you have finished designing your map, give it a unique name in the "Floor Info" section.
2.  Click the "Save" button. This will save the floor data to local storage and also register it with the `UnifiedDataManager`.

### 2.4. Build Interiors in the Interior Designer

1.  Switch to the "Interior Designer" tab.
2.  Use the floor tabs (N, N.N, N.N.N) to select which floor level to design.
3.  Select a building template (church, tavern, junkyard, etc.) from the sidebar.
4.  Configure interior properties (zoom bias, prop density, pattern density, lighting).
5.  View the floor hierarchy visualization to see how floors connect.
6.  Click "Export to World" to save as JSON for use in World Designer.

### 2.5. Build Worlds in the World Designer

1.  Switch to the "World Designer" tab.
2.  Create a "Step" node. This node represents a floor in your game world.
3.  In the property inspector for the "Step" node, you will see a new "Map" dropdown.
4.  This dropdown will be populated with the floors you saved in the Map Designer.
5.  Select the desired map from the dropdown to assign it to the "Step" node.

### 2.6. Preview & Assign Media in the Media Designer

1.  Switch to the "Media Designer" tab (formerly Sound Designer).
2.  The left panel shows the **Media Library**. The first category is **Uploaded Videos** — video files fetched dynamically from R2. Below that are all audio assets from `audio-manifest.json`, grouped by category (UI, Movement, Combat, Magic, Environment, Collectible, Creature, Music, and more).
3.  Click any asset (audio or video) to select it. The portal **automatically switches to the Preview tab and begins playback**. Audio shows a waveform visualization; videos show an inline `<video>` player.
4.  Switch to the **Assign** tab to link sounds to designer contexts:
    *   **Asset Designer context:** Assign sounds to asset events (On Break, On Interact, On Spawn, Ambient Loop).
    *   **Map Designer context:** Assign background music, ambient SFX, floor enter/exit sounds.
    *   **Interior Designer context:** Assign room ambient, door open/close, floor creak sounds.
5.  Use the **Target Selection** section to pick a specific asset, floor, or interior from the registries.
6.  The right **Inspector** panel shows the selected asset's properties and all its current assignments.
7.  Click "Save Assignments" to persist to localStorage. Click "Export JSON" to download a `sound-assignments.json` file for use by the game engine.

### 2.7. Upload Audio/Video Files

1.  In the Media Designer, switch to the **Upload** tab.
2.  Drag and drop audio or video files onto the dropzone (or click to browse). Supported formats: `.wav`, `.mp3`, `.ogg`, `.webm`, `.m4a`, `.mp4`, `.opus`. Max 50 MB per file.
3.  Select the destination folder from the dropdown: **SFX** (`audio/sfx/`), **Music** (`audio/music/`), or **Video** (`video/`).
4.  Click "Upload All" to push files to the R2 bucket (`eyesonly-assets`).
5.  Uploaded files are served at `/audio/sfx/<filename>`, `/audio/music/<filename>`, or `/video/<filename>` via the Cloudflare Worker.
6.  After uploading new sounds, click "Refresh" to reload the manifest and see them in the library. Uploaded videos appear automatically in the **Uploaded Videos** category at the top of the library.

> **Note:** Audio and video assets are stored in Cloudflare R2 (not git) to avoid repository bloat. The `audio-manifest.json` file in `public/audio/` is the committed source of truth for sound names and paths. Video files are discovered dynamically from R2. The batch upload script `scripts/upload-audio-to-r2.sh` can also be used from the command line.

## 3. Exporting for Deployment

Once you have created your assets, maps, interiors, and world graph, you can export the entire world for deployment.

1.  In the Unified Designer hub, click the "Export All" button.
2.  This will generate a single `world.json` file that contains all the data for your game world, including the assets, maps, interiors, and the world graph itself. This file can then be loaded by the game engine.

---

## 4. Runtime Pipeline Gaps (Blocking — ENI Phase 0+)

> **Date identified:** 2026-03-06
> **Severity:** MEDIUM — Blocks any designer workflow that requires equipment/consumable items to drop from breakables on the map.
> **Affects:** Item drops from breakables, tutorial guaranteed loot, per-breakable loot table configuration for non-key items.

### 4.1. Gap: No Equipment/Consumable Item Drop From Breakables

**What works today:**

| Drop Type | Breakable → WorldItems | Map Render | Player Pickup → Inventory | Debrief Report |
|---|---|---|---|---|
| Ammo (resource) | breakable-system.js `_spawnLootTableLoot()` | gone-rogue-mobile.js (⁍ magenta) | pickup-system.js → `GAMESTATE.addAmmo()` | `reportResourceChange('Ammo',...)` |
| Currency (resource) | breakable-system.js → CurrencySpawning | gone-rogue-mobile.js (¢ yellow) | auto-collect via Magnet or walk-over | `reportResourceChange('Currency',...)` |
| Battery/Gems (resource) | breakable-system.js `_spawnLootTableLoot()` | gone-rogue-mobile.js (◈ green) | pickup-system.js → `GAMESTATE.rechargeBattery()` | `reportResourceChange('Battery',...)` |
| Cards | breakable-system.js (30% fallback) | gone-rogue-mobile.js (🂠 purple) | pickup-system.js → `GAMESTATE.addPrintedCards()` | `reportResourceChange('Cards',...)` |
| Keys (type:'key') | breakable-system.js `_spawnKeyDrops()` | gone-rogue-mobile.js (🔑/🗝 gold) | pickup-system.js → routes by tier (T1=counter, T2=persistent+equip, T3=quest) | `reportResourceChange('key_ammo',...)` |

**What does NOT work:**

| Drop Type | Breakable → WorldItems | Map Render | Player Pickup → Inventory | Debrief Report |
|---|---|---|---|---|
| Equipment (ITM-###, type:'equipment') | NO SPAWN PATH | NO RENDER TYPE | Dead-end: line 316 returns `{success:true}` but stores NOTHING | NO REPORT |
| Consumable (ITM-###, type:'consumable') | NO SPAWN PATH | NO RENDER TYPE | Same dead-end as equipment | NO REPORT |

**Root cause — 3 missing pieces:**

1. **breakable-system.js** has no `_spawnItemDrops()` equivalent for items.json entries. `_spawnKeyDrops()` is hardwired to EnvironmentalSynergy key definitions. `_spawnLootTableLoot()` processes `.ammo`, `.currency`, `.gems`, `.cards`, `.charms` from the LootTableManager roll but has **no `.items` handler** for ITM-### equipment/consumable objects.

2. **pickup-system.js** `_addToInventory()` (line 277) routes cards, keys (T2→persistent, T1→counter), but the `else` fallthrough at line 316 is a no-op: `result = { success: true, message: 'Item picked up' }`. It claims success but **calls no GAMESTATE method to store the item**. There is no `GAMESTATE.addEquipment()` or `GAMESTATE.addConsumable()` method.

3. **GAMESTATE inventory model** only has: `_state.cardsInHand` (CardRefs), `_state.persistentInventory` (T2 keys via `addToPersistent`), `_state.looseItems` (via `addToLoose`). Equipment and consumable items from items.json have **no canonical storage location** in GAMESTATE. The `addToPersistent()` method technically accepts any object but is only ever called for key payloads.

**Designer impact:**

A designer CANNOT currently:
- Place a breakable that drops a specific ITM-### item (e.g., "this crate drops Skeleton Keyring")
- Configure per-breakable item loot tables in the Map Designer
- Make tutorial breakables guarantee specific equipment/consumable drops
- Drop the Flipper Zero (ITM-103) from a floor 0 breakable

### 4.2. Gap: Tutorial Floor Breakables Use Fallback Loot

Tutorial floors (tutorial-floors.js) define breakables with `drops: { currency: [min, max], cards: chance }` but these go through `_spawnFallbackLoot()` — a hardcoded 60% ammo / 30% card path. They do NOT use LootTableManager. This means:

- No per-breakable loot table override on tutorial floors
- No way to make a tutorial breakable drop a specific item
- The `breakable.drops.item` field IS checked by `_spawnKeyDrops()` for keys specifically, but not for equipment/consumable items

### 4.3. Implementation Path (Estimated Scope)

> **Full roadmap:** See `ITEM_DROP_PIPELINE_ROADMAP.md` for phased implementation with code samples, dependency order, and test steps.

To close this gap, the following changes are needed:

**File 1: gamestate.js** — Add equipment/consumable item storage
- Add `_state.equipment` array (or extend `_state.persistentInventory` to accept all item types)
- Add `addEquipmentItem(itemDef)` public method
- Add `addConsumableItem(itemDef)` public method (or unify as `addItem(itemDef)`)
- Expose in public API

**File 2: pickup-system.js** — Route equipment/consumable pickup to GAMESTATE
- Replace dead-end at line 316 with: lookup item in items.json by `item.itemId`, call `GAMESTATE.addItem(resolvedItem)`
- Add overhead animation (item emoji, 800ms, item-type color)
- Add debrief feed report

**File 3: breakable-system.js** — Add item spawn path
- Add `_spawnItemDrops(breakable, ctx)` function
- Check `breakable.drops.itemId` (ITM-### string) for designer-defined guaranteed drops
- Load item definition from items.json data registry
- Create world item: `{ x, y, type: 'item', itemId: 'ITM-###', emoji, name, spawnTime, decayTime }`
- Push to `WorldItems.addItem()`
- Call from `_spawnBreakableLoot()` after existing loot paths

**File 4: tutorial-floors.js** — Add `drops.itemId` to specific breakables
- Example: `{ x: 14, y: 5, emoji: '📦', name: 'Supply Crate', hp: 1, drops: { itemId: 'ITM-103' } }`

**File 5: gone-rogue-mobile.js** — Add render case for `_wt: 'item'` world items
- Render item emoji at tile position (same pattern as key rendering)

**File 6: loot-table-manager.js** — Add item roll support (optional, for random drops)
- Add `items: [{ id: 'ITM-###', chance: 0.05 }]` to breakable_loot config schema
- Roll items alongside existing ammo/currency/gem rolls

**Estimated effort:** ~200-300 lines across 4-6 files. Not humungous, but needs to be done correctly to avoid inventory corruption. The key pipeline (`_spawnKeyDrops` → `WorldItems` → `pickup-system` → `addToPersistent`) is the template to follow.

### 4.4. Workaround (Temporary)

Until the full pipeline is built, equipment/consumable items can be granted via:
- `GAMESTATE.addToPersistent(itemDef)` called directly from a script hook (not from breakable drops)
- Tutorial floor `tutorialPickups` array with a custom type handler
- Auto-grant on floor start via a floor init callback

These workarounds bypass the breakable→map→pickup visual flow entirely.
