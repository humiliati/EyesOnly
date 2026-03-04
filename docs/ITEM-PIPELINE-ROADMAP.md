# EYES ONLY — Item Pipeline: Full Lifecycle Audit & Designer Portal Roadmap
### v1.6 — March 2026 (Phases 1–5 complete + playtesting integration)

---

## 1. Executive Summary

This document traces every item in the game from its **definition** through **spawn → pickup → normalization → storage → rendering → use/consumption/disposal**, and identifies the architectural seams where a designer-friendly item editor portal can plug in without touching engine code.

**Current state:** Item definitions are scattered across 4+ sources with 3 different ID schemes. A unified `items.json` registry exists but many engine subsystems bypass it. Normalization happens at storage time, but inconsistently. Rendering has 6+ independent lookup paths, each with its own fallback logic.

**Target state:** One canonical `items.json` that every system reads from, a web-based editor that writes to it, and a validation layer that catches orphans at build time.

---

## 2. Item Definition Sources (Current)

### 2A. `items.json` — The Registry (Source of Truth)

**Path:** `public/data/gone-rogue/items.json`
**Schema:** `{ id, name, emoji, type, subtype, rarity, stackable, maxStack, equipSlot, effects[], synergyTags[], description, consumeOnUse?, tier?, _designNote? }`
**ID format:** `ITM-XXX` (three-digit zero-padded)
**Validated by:** `GoneRogueDataRegistry` at load time (`/^ITM-\d{3}$/`)

**Current inventory (55 items):**

| Range | Type | Count | Examples |
|-------|------|-------|---------|
| ITM-000 | Migration fallback | 1 | `[Unknown Legacy Item]` — the ❓ stub |
| ITM-001 | Consumable (vice) | 1 | Cigarette |
| ITM-002–004 | Equipment (starter) | 3 | Radio, Surveillance Cam, Journal |
| ITM-005–009 | Equipment (combat) | 5 | 3D Printer, Pickpocket Gloves, Scout Scope, EMP, Wire Tap |
| ITM-010–016 | Keys (gate, tier 2) | 7 | Rusty Key, Keycard, Master Key, Thumb Drive, Access Card, Mall Tag, Industrial Pass |
| ITM-017–018 | Keys (gate, tier 1) | 2 | Rusty Lockpick, Bronze Key |
| ITM-019 | Key (decoy, LAGM) | 1 | Decoy Key — fake key injected by moderation layer |
| ITM-020–023 | Deployable (boxes) | 4 | Cardboard → Legendary Refrigerator Box |
| ITM-030–031 | Keys (quest, tier 3) | 2 | Blacksmith's Hammer, Rune Fragment |
| ITM-040–044 | Equipment (cascade) | 5 | Archive Indexer, Suppressor Oil, Dead Drop Cache, Tripwire Array, Signal Jammer |
| ITM-050–051 | Equipment (magnet) | 2 | Magnet, Magnet+ |
| ITM-060–061 | Equipment (flight save) | 2 | Cargo Webbing, Tactical Harness |
| ITM-070 | Equipment (epic) | 1 | Thermal Goggles |
| ITM-080–093 | Equipment (passive) | 14 | Surge Protector → Redneck Obliterator |
| ITM-100 | Consumable (LAGM) | 1 | Fool's Reward — deceptive reward injected by moderation pace controls |
| ITM-101–102 | Equipment (player manipulation) | 2 | They Live Glasses (foresight F+2), Winston Smith's Diary (entropy) |
| ITM-998–999 | Equipment (transform) | 2 | Amazon Box, Refrigerator Box Suit (wearable) |

### 2B. `environmental-synergy.js` — Key Item Definitions (Parallel Source)

**Path:** `public/js/environmental-synergy.js`
**Object:** `SYNERGY_DEFINITIONS.KEY_ITEMS`
**ID format:** Internal `itemId` (e.g. `KEY_002`, `KEY_030`) + cross-ref `registryId` (e.g. `ITM-011`)

This is the **authoritative source for key item behavior** — tier, gate compatibility, consumeOnUse, npcTarget. The `registryId` bridges to items.json but the fields are duplicated (emoji, name, description all appear in both).

| Internal Key | itemId | registryId | Tier | consumeOnUse |
|-------------|--------|-----------|------|-------------|
| RUSTY_KEY | KEY_002 | ITM-017 | 1 | true |
| BRONZE_KEY | KEY_004 | ITM-018 | 1 | true |
| KEYCARD | KEY_003 | ITM-011 | 2 | false |
| MASTER_KEY | KEY_004 | ITM-012 | 2 | false |
| THUMB_DRIVE | KEY_005 | ITM-013 | 2 | false |
| ACCESS_CARD | KEY_006 | ITM-014 | 2 | false |
| MALL_KEY | KEY_007 | ITM-015 | 2 | false |
| INDUSTRIAL_PASS | KEY_008 | ITM-016 | 2 | false |
| BLACKSMITH_HAMMER | KEY_030 | ITM-030 | 3 | true |
| RUNE_FRAGMENT | KEY_031 | ITM-031 | 3 | true |

**✅ Resolved (Phase 1):** Tier 1 keys now have registryId (ITM-017, ITM-018) and items.json entries. env-synergy `init()` merges display fields from registry.

### 2C. `item-spawner.js` — Interactive Item Definitions (World Objects)

**Path:** `public/js/item-spawner.js`
**Object:** `ITEM_DEFINITIONS`
**ID format:** Biome prefix + number (e.g. `OFF_002`, `MLL_003`, `IND_001`)

These are **world-placed interactive objects** (terminals, breakables, food, decor) — NOT inventory items. They use a completely separate schema:

```
{ itemId, itemName, category, baseEmoji, defaultExpression,
  interactionType, breakable, biomes[], spawnWeight,
  spawnConditions, lootTable?, lightingAffected }
```

Categories: `Readable`, `Transform`, `Breakable`, `Ambient`, `Vendor`, `Light`

**No overlap with ITM-XXX items.** These don't enter the inventory — they produce loot when broken or interacted with.

### 2D. `tutorial-floors.js` — Hardcoded Spawn Points

**Path:** `public/js/tutorial-floors.js`
Floor layouts reference environmental-synergy key names (e.g. `BLACKSMITH_HAMMER` at x:37, y:2 on floor 0.1.1). These are spawn coordinates, not definitions.

### 2E. `loot-table-manager.js` — Drop Table References

References items by key type string or tier, not by ITM-ID directly. Generates cards, currency, ammo, and key drops by rolling weighted tables.

---

## 3. Item Lifecycle Pipeline

### Stage 1: DEFINITION (build time)

```
items.json ──────────────────────────────► GoneRogueDataRegistry._byId.items
                                            ↓ getItem(id) → { emoji, name, ... }
                                            ↓ _createMissingEntry(id) → { emoji:'❓', _missing:true }

environmental-synergy.js ──────────────► SYNERGY_DEFINITIONS.KEY_ITEMS
  KEY_ITEMS.BLACKSMITH_HAMMER              (itemId, registryId, tier, npcTarget, consumeOnUse)
  KEY_ITEMS.KEYCARD
  ...

item-spawner.js ───────────────────────► ITEM_DEFINITIONS (world objects only)
  OFF_002: Computer Terminal                (NOT inventory items)
  MLL_002: Teddy Bear
  ...
```

### Stage 2: SPAWN (runtime)

```
Source                          Entry Point                        Output
───────────────────────────────────────────────────────────────────────────────
Floor generation                ItemSpawner.spawnItemsForFloor()   World objects on grid
Enemy kill                      LootTableManager.rollEnemyLoot()   { currency, cards, items }
Breakable smash                 LootTableManager.rollBreakableLoot() { currency, ammo, items }
Key spawn (env-synergy)         EnvironmentalSynergy lookup        Key object with tier/registryId
Tutorial floor layout           tutorial-floors.js coordinates     Pre-placed keys/items
Debug/dev mode                  command-router.js `dev on`         Test player state
World scatter                   WorldItems.addItem() / addCurrency() Ground pickups
```

### Stage 3: PICKUP → NORMALIZATION → STORAGE

```
                    ┌──────────────────────────┐
Player walks onto   │     pickup-system.js      │
item tile ────────► │  pickupItem(item, ctx)    │
                    │                           │
                    │  if (item.type === 'key') │
                    │    _buildKeyPayload()     │──► { type:'key', keyType, emoji, name,
                    │    (resolves registryId,  │      tier, registryId, consumeOnUse,
                    │     heuristic name match, │      npcTarget, effects, ... }
                    │     env-synergy fallback)  │
                    │                           │
                    │  if (tier >= 2)           │
                    │    GAMESTATE.addToPersistent(payload)
                    │                           │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │     gamestate.js           │
                    │  addToPersistent(item)     │
                    │                           │
                    │  ref = _normalizeItemRef() │──► { id: 'ITM-030', qty: 1,
                    │    ├─ has item.id ITM-*?  │      meta: { legacyName, emoji,
                    │    │  → keep as-is        │              type, tier, keyType,
                    │    ├─ has registryId?      │              subtype, npcTarget,
                    │    │  → map to id          │              consumeOnUse } }
                    │    ├─ has name string?     │
                    │    │  → _legacyItemNameToId │
                    │    └─ fallback: ITM-000    │
                    │                           │
                    │  _state.inventoryPersistent│
                    │    .push(ref || item)      │
                    │  _saveState()             │
                    └───────────────────────────┘
```

**Other inventory addition paths:**

| Caller | File | What It Adds |
|--------|------|-------------|
| `InventoryManagement.stashCard()` | inventory-management.js | Loose → persistent (bonfire only) |
| `zone-manager.js` (5 call sites) | zone-manager.js | Cards during zone transitions |
| `GAMESTATE.addToLoose()` | gamestate.js | Tier 1 keys, temporary items |
| `GAMESTATE.addCard()` | gamestate.js | Card loot (ACT-* IDs) |

### Stage 4: STORAGE (persistent state)

```
GAMESTATE._state = {
  inventoryPersistent: [          ← 9-12 slots, survives death
    { id: 'ITM-030', qty: 1, meta: { legacyName: "Blacksmith's Hammer", ... } },
    { id: 'ITM-003', qty: 1, meta: { ... } },
    ...
  ],
  persistentCards: [              ← Card stash (ACT-* IDs), survives death
    { id: 'ACT-001', qty: 2 },
    ...
  ],
  inventoryLoose: [ ... ],        ← 8 slots, lost on death (legacy, being phased out)
  activeItemSlot: { id, qty, meta },  ← Currently equipped item
  ...
}
```

**Critical:** `addToPersistent` normalizes. `addToLoose` does NOT normalize. Legacy loose items may have raw payloads.

### Stage 5: RENDERING (6 independent paths)

Every renderer merges `inventoryPersistent` + `persistentCards` into a unified view, then looks up definitions from the registry. Each has its own fallback chain:

| Renderer | File | Data Source | Lookup | Missing Fallback |
|----------|------|-------------|--------|-----------------|
| Rogue Sidebar (items view) | rogue-sidebar.js:418-433 | `getPersistentInventory()` + `getVault()` | `getItem(id)` / `getCard(id)` | `_missing` → '📦' |
| NCH Vault Grid | non-combat-hud.js:962-1037 | `_getVaultCards()` (merged) | `getItem(id)` / `_getCardDef(id)` | '🃏' default |
| NCH Equipped Display | non-combat-hud.js:512-522 | `getActiveItem()` | `getItem(id)` | '📦' + raw id |
| BAC Left Column | backup-action-container.js:140-357 | `_getItemCards()` (merged) | `_getCardDef()` chain | '🃏' default |
| Mobile Inventory | gone-rogue-mobile.js:2880-2930 | `getPersistentInventory()` + `getPersistentCards()` | `getItem(id)` | `_missing` → meta fallback → '📦' |
| Mobile Equip Display | gone-rogue-mobile.js:3370-3385 | `getPersistentInventory()` | `getItem(id)` | `_missing` → meta fallback |
| Active Item Drag Ghost | gone-rogue-mobile.js:124-128, 214-218 | `getActiveItem()` | `getItem(id)` | '📦' default |

### Stage 6: USE / CONSUMPTION / DISPOSAL

```
USE PATHWAYS                               CONSUMPTION METHOD
───────────────────────────────────────────────────────────────────────
Active item click (inventory closed)       ActiveItemSystem.triggerActiveItem()
  ├─ Adjacent locked gate?                   → consumeActiveItemIfMatches(key)
  │                                            removes from inventoryPersistent + clears slot
  ├─ Ground interaction?                     → resolveGroundInteraction()
  │   (lighter/water/tazer/medkit)             item stays equipped
  ├─ 3D Printer?                             → toggleActiveItemToggled()
  │                                            toggles armed state, consumed on print
  └─ Box deployable?                         → GoneRogue.placeBox()
                                               BoxDeployment places on grid, consumed on exit

Drag item to grid tile                     ActiveItemSystem.useActiveItemAt(x, y)
  └─ Lock at target?                         → consumeActiveItemIfMatches(key)

Drag item to debrief (incinerator)         NCH: _drag.kind handling
  ├─ kind:'persistent_item'                  → GAMESTATE.removePersistentInventoryItem(index)
  ├─ kind:'vault' (card)                     → CSA.disposeFromVault(id) / removePersistentCard()
  ├─ kind:'hand'                             → CSA.consumeFromHand(index) / hand.splice()
  └─ kind:'backup'                           → CSA.removeBackupCard(index) / backup.splice()

Quest NPC turn-in                          InventoryManagement.consumeQuestItem(keyType, npc)
  └─ Searches persistent by type+npc          → removePersistentInventoryItem(index)

Key consumption from inventory             InventoryManagement.consumeKeyFromInventory(key)
  ├─ Searches loose first (tier 1)           → removeFromLoose(index)
  └─ Then persistent (tier 2)               → removeFromPersistent(index)

Environmental drag-drop unlock             EnvironmentalSynergy.attemptUnlock()
  └─ result.consumeKey === true              → _removeKeyFromInventory(itemId)

GAMESTATE.consumeActiveItem()              Server-side consume + local inventory dec
  └─ Decrements qty, splices at 0           → clearActiveItem() + _saveState()
```

---

## 4. Known Gaps & Debt

### 4A. ~~Tier 1 Keys Are Ghosts~~ ✅ FIXED (Phase 1)
ITM-017 (Rusty Lockpick) and ITM-018 (Bronze Key) now exist in items.json with registryId cross-refs. env-synergy `init()` merges display fields from registry.

### 4B. Three ID Schemes
- `ITM-XXX` — items.json registry (canonical)
- `KEY_0XX` — environmental-synergy internal (itemId)
- `OFF_XXX` / `MLL_XXX` / `IND_XXX` — item-spawner world objects

World objects don't need to merge — they're a separate concept. But KEY_0XX should be fully cross-referenced to ITM-XXX.

### 4C. ~~Dual-Source Duplication~~ ✅ FIXED (Phase 1)
env-synergy `init()` now overwrites name/emoji/description/tier/consumeOnUse/stackable/maxStack from registry for all keys with `registryId`. items.json is the single source of truth for display fields.

### 4D. ~~`_legacyItemNameToId` Is a Maintenance Hazard~~ ✅ FIXED (Phase 1)
`_legacyItemNameToId()` now queries `GoneRogueDataRegistry.getItemIdByName()` first (auto-generated from items.json). Hardcoded fallback reduced to 5 safety entries.

**Fix:** Generate this map from items.json at build time, or eliminate legacy name paths entirely.

### 4E. ~~Six Independent Renderers~~ ✅ FIXED (Phase 1)
All 6 renderers now call `SharedItemRenderer.resolve()` for data lookup/fallback. DOM creation stays per-renderer but the lookup/fallback logic is unified.

---

## 5. Designer Portal Architecture (Roadmap)

### 5A. Portal Scope

A web UI that lets designers:
1. **Browse** all items with filtering (type, rarity, tier, tags)
2. **Edit** existing item fields (name, emoji, description, effects, tags)
3. **Create** new items with auto-assigned ITM-IDs
4. **Preview** how items render in-game (emoji, tooltip, inventory slot)
5. **Validate** items against schema (required fields, ID format, effect types)
6. **Export** to `items.json` with git-friendly diffs (sorted, formatted)

### 5B. Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Designer Portal │────►│  items.json      │────►│  GoneRogueData   │
│  (web UI)        │     │  (single source) │     │  Registry        │
│                  │     │                  │     │  (runtime)       │
│  Create/Edit/    │     │  Validated +     │     │  getItem(id)     │
│  Delete items    │     │  auto-formatted  │     │  getCard(id)     │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  env-synergy.js  │
                    │  (reads from     │
                    │   registry, not  │
                    │   hardcoded)     │
                    └──────────────────┘
```

### 5C. Schema for Portal Item Editor

```json
{
  "$schema": "item-schema-v1",
  "id": "ITM-XXX",           // Auto-assigned, zero-padded 3-digit
  "name": "string",           // Display name (required)
  "emoji": "string",          // Single emoji character (required)
  "type": "enum",             // consumable | equipment | key | deployable | resource
  "subtype": "string|null",   // gate | quest | vice | null
  "rarity": "enum",           // common | uncommon | rare | epic | legendary
  "stackable": "boolean",
  "maxStack": "number",       // 1-99
  "equipSlot": "enum",        // none | active | passive
  "effects": [{               // Array of effect objects
    "type": "string",         // Effect type enum (unlock_gate, reveal, auto_collect, etc.)
    "...": "varies"           // Effect-specific params
  }],
  "synergyTags": ["string"],  // Tag array for combo system
  "description": "string",    // Player-facing text
  "consumeOnUse": "boolean",  // Destroyed when used?
  "tier": "number|null",      // 1=ammo, 2=gate, 3=quest (keys only)

  // Portal-only fields (stripped at export):
  "_designNote": "string",    // Internal design rationale
  "_portalCategory": "string", // UI grouping in editor
  "_lastEditedBy": "string",  // Audit trail
  "_lastEditedAt": "ISO8601"
}
```

### 5D. Effect Type Registry (for dropdown in editor)

| Effect Type | Params | Used By |
|------------|--------|---------|
| `hp` | `value` (int) | ITM-001 Cigarette |
| `focus` | `value` (int) | ITM-001 Cigarette |
| `unlock_gate` | `compatibleGates[]` | ITM-010 through ITM-016 |
| `quest_turn_in` | `npcTarget`, `rewardType` | ITM-030, ITM-031 |
| `printer_3d` | — | ITM-005 |
| `theft` | `mode` | ITM-006 |
| `reveal` | `mode` | ITM-007, ITM-070 |
| `destroy_card` | `mode` | ITM-008 |
| `auto_reveal` | `count`, `trigger` | ITM-009 |
| `auto_collect` | `target`, `range` | ITM-050, ITM-051 |
| `avatar_transform` | `char`, `sprite` | ITM-998, ITM-999 |
| `sightline_evasion_modifier` | `walk_bonus`, `sprint_penalty` | ITM-998, ITM-999 |
| `break_on_combat` | `condition` | ITM-998 |
| `sort_hand` | — | ITM-040 |
| `cascade_enabler` | `condition`, `effect`, `tags[]` | ITM-041 through ITM-044 |
| `flight_save` | `saveRate` | ITM-060, ITM-061 |
| `flight_save_disposables` | `saveRate` | ITM-061 |
| `tag_risk_reduction` | `tag`, `reduction` | ITM-080, ITM-082 |
| `battery_save` | `chance` | ITM-080 |
| `tag_risk_threshold_increase` | `tag`, `bonus` | ITM-081, ITM-083 |
| `exposure_resist` | `chance` | ITM-081 |
| `fatigue_save` | `chance` | ITM-082 |
| `alert_reduction` | `value`, `trigger` | ITM-083 |
| `on_consume_card` | `effect`, `chance?`, `refundType?`, `damage?`, `requireTag?` | ITM-084, ITM-085 |
| `consume_save` | `rarity_scaling`, `rates{}` | ITM-086 |
| `momentum_visibility` | `value` | ITM-087 |
| `reveal_momentum_threshold` | `threshold` | ITM-087 |
| `overload_damage_reduction` | `value` | ITM-088 |
| `escalation_slow` | `value` | ITM-088 |
| `destroy_reduces_rage` | `value` | ITM-089 |
| `destroy_momentum_bonus` | `value` | ITM-089 |
| `interaction_charge_bonus` | `value` | ITM-090 |
| `swipeActivate` | `categories[]?` | ITM-091, ITM-092, ITM-093 |
| `instantResolve` | — | ITM-093 |
| `darkness_accuracy_bonus` | `value` | ITM-070 |
| `stealth_in_darkness_bonus` | `value` | ITM-070 |
| `foresight_window` | `maxWindow`, `collapseMode` | ITM-101 They Live Glasses |
| `entropy_field` | `strength`, `corruptsForesight` | ITM-102 Winston Smith's Diary |

### 5E. Implementation Phases

**Phase 1: Unify (code cleanup, no new UI) — ✅ COMPLETE**
- ✅ Added ITM-017 (Rusty Key), ITM-018 (Bronze Key) to items.json; added registryId to env-synergy Tier 1 defs
- ✅ env-synergy `init()` now merges display fields from registry for all keys with registryId
- ✅ `GoneRogueDataRegistry.getItemIdByName()` auto-generates name→ID map at load time
- ✅ `gamestate._legacyItemNameToId()` queries registry first, hardcoded fallback reduced to 5 entries
- ✅ Created `SharedItemRenderer` (resolve, abbreviateName, getRarityColor, buildTooltipHtml)
- ✅ All 6 renderers migrated to `SharedItemRenderer.resolve()` (rogue-sidebar, NCH, BAC, mobile×3)

**Phase 2: Validate (build-time tooling) — ✅ COMPLETE**
- ✅ Created `tools/validate-items.js` — single-command validator with 6 checks:
  - Schema validation: required fields, ID format `/^ITM-\d{3}$/`, enum checks (type, rarity, equipSlot)
  - Effect type linter: 36 known effect types + per-type required-param checks
  - Duplicate detector: flags shared names (error) + shared emoji across ID ranges (warn)
  - Orphan detector: cross-refs env-synergy registryId, gamestate.js legacy map, gone-rogue.js box IDs
  - Sort order check: warns if items.json is unsorted, `--fix` auto-sorts by ID
  - ID gap detector: reports holes in ID ranges + next available ID
- ✅ Fixed duplicate names: ITM-017 "Rusty Key" → "Rusty Lockpick", ITM-999 "Refrigerator Box" → "Refrigerator Box Suit"
- ✅ Auto-sorted items.json by ID (ITM-000 first through ITM-999)
- Usage: `node tools/validate-items.js [--fix] [--quiet]`

**Phase 3: Editor (web UI) — ✅ COMPLETE**
- ✅ Created `public/item-editor.html` — single-file React SPA (React 18 + Babel via CDN, ~40KB)
- ✅ Loads `items.json` via fetch on startup, full CRUD with auto-ID assignment (next gap in ITM-XXX)
- ✅ Searchable sidebar with type + rarity filter chips, rarity-colored item rows
- ✅ Form editor: identity (id/emoji/name/desc), classification (type/subtype/rarity/slot/stackable/maxStack/tier/consumeOnUse), synergy tags (chip input), effects (dynamic builder), design notes
- ✅ Effect builder: dropdown of all 36 effect types, dynamic param fields per type (number/string/boolean/string[]/json)
- ✅ 4 live preview panels: Inventory Slot (emoji + abbreviated name + stack count), Tooltip (rarity-colored header + desc + tags + effects), NCH Vault Grid (3 occupied + 1 empty slot), Sidebar Row (emoji + rarity-colored name + dot)
- ✅ Export: sorted by ID, cleaned fields, downloads as items.json
- ✅ Import: load any items.json from disk
- ✅ Duplicate + Delete with confirmation
- ✅ Dirty state tracking in status bar, next available ID shown
- ✅ Integrated into Unified Designer portal: `portal/item-designer.html` loaded via iframe tab
- ✅ Added "Item Designer" nav button to `portal/unified-designer.html`
- ✅ `public/item-editor.html` now redirects to portal canonical location
- ✅ Added LAGM moderation items: ITM-019 (Decoy Key), ITM-100 (Fool's Reward)
- ✅ Updated validator: empty `compatibleGates` now a warning (for decoy keys), not an error
- Usage: open `portal/unified-designer.html` → click "Item Designer" tab

**Phase 4: Playtesting Integration** ✅
- ✅ Hot-reload: `GoneRogueDataRegistry.reload()` resets `_loaded`, re-fetches all JSON, re-indexes, emits `registry:reloaded` event
- ✅ BroadcastChannel `gone-rogue-portal` listener in registry: receives `registry-reload` and `grant-item` messages from portal
- ✅ `portal-bridge.js` — game-side listener for `gone-rogue-grant-item` CustomEvent, routes to `GAMESTATE.addToPersistent()`, auto-refreshes NCH/sidebar/mobile UI
- ✅ Item grant console in item-designer: "Push to Game" (triggers registry reload) + "Grant" button (sends selected item to player inventory via BroadcastChannel)
- ✅ Console log panel in item-designer sidebar shows grant results with timestamps
- ✅ Connection status indicator (green dot when game responds)
- ✅ Loot table editor: `portal/loot-designer.html` — visual weight/probability editor for all `item_loot_tables`, enemy loot chances with quality weight bars, breakable loot overview, card drop modifiers, economy settings
- ✅ Drop preview simulator: select any item_loot_table, configure roll count (10–100k), run simulation, view histogram with actual vs. expected distribution
- ✅ Loot Designer integrated as 6th tab in `portal/unified-designer.html`
- ✅ Export JSON for modified loot tables

---

## 6. File Index

| File | Role | Designer-Relevant |
|------|------|------------------|
| `data/gone-rogue/items.json` | Item definitions (source of truth) | **PRIMARY EDIT TARGET** |
| `js/gone-rogue-data-registry.js` | Runtime item/card lookup | Reads items.json |
| `js/environmental-synergy.js` | Key behavior (tiers, gates, quests) | Should read from registry |
| `js/pickup-system.js` | Pickup → `_buildKeyPayload` → addToPersistent | Ingests raw key data |
| `js/gamestate.js` | Normalization (`_normalizeItemRef`) + storage | Converts payloads to refs |
| `js/item-spawner.js` | World object spawning (NOT inventory items) | Separate schema |
| `js/loot-table-manager.js` | Enemy/breakable loot generation | References items by tier |
| `js/inventory-management.js` | Stash/retrieve/consume/quest-turn-in | All removal paths |
| `js/active-item-system.js` | Equipped item use (ground effects, unlock) | Triggers consumption |
| `js/locked-gate-system.js` | Gate unlock → key consumption dispatch | Routes to consume funcs |
| `js/box-deployment.js` | Deployable box placement/destruction | Consumes ITM-020–023 |
| `js/cost-printer-system.js` | 3D Printer toggle + consumption | Consumes ITM-005 |
| `js/non-combat-hud.js` | NCH vault rendering + drag disposal | Reads registry, handles disposal |
| `js/rogue-sidebar.js` | Left column item/card rendering | Reads registry |
| `js/backup-action-container.js` | BAC slot rendering (legacy) | Reads registry |
| `js/gone-rogue-mobile.js` | Mobile inventory + equip rendering | Reads registry |
| `js/card-disposal-system.js` | Card/item disposal (legacy drag system) | Calls removePersistentInventoryItem |
| `js/shared-item-renderer.js` | Unified item data resolver (Phase 1) | resolve(), getRarityColor(), buildTooltipHtml() |
| `tools/validate-items.js` | Build-time item validator (Phase 2) | `node tools/validate-items.js [--fix] [--quiet]` |
| `item-editor.html` | Redirect to portal (legacy URL) | Redirects to `portal/item-designer.html` |
| `portal/item-designer.html` | React item editor SPA (Phase 3) | CRUD + effect builder + 4 live previews |
| `portal/unified-designer.html` | Unified Designer hub | Iframe nav: Asset, Map, World, Item, **Loot** |
| `portal/loot-designer.html` | React loot table editor SPA (Phase 4) | Weight editor + drop preview simulator |
| `js/portal-bridge.js` | Portal ↔ Game bridge (Phase 4) | Grant items, refresh UI on registry reload |
| `js/world-items.js` | Ground items/currency management | Floor pickup tracking |
| `js/tutorial-floors.js` | Hardcoded spawn coordinates | References env-synergy keys |
| `js/terminal/command-router.js` | Dev mode commands | `dev on` generates test state |

---

*End of document. This roadmap should be updated as phases are completed.*

---

REOPENED 3/3/2026 by MALICE MIZER:


## Phase 5: SANITY CHECK — Collectibles Rendering Standardization

### Purpose

Phases 1–4 established the item definition registry, validation, editor, and playtesting integration. However, the **collectibles rendering pipeline** remains inconsistent across types. This pass standardizes how all collectibles render on the map and how they flow into player inventory.

---

### Current Problem

Each collectible type (ammo, currency, key ammo, cards, batteries, food, items) has evolved its own rendering and pickup pipeline:

| Collectible | Map Render | Enemy Drop | Breakable Drop | Inventory Flow |
|-------------|------------|------------|----------------|----------------|
| **Currency** | Symbol + ellipse shadow | Direct to inventory | Direct to inventory | Immediate |
| **Ammo** | ? | ? | ? | ? |
| **Key Ammo** | ? | ? | ? | ? |
| **Cards** | ? | ? | ? | ? |
| **Batteries** | ? | ? | ? | ? |
| **Items** | ? | ? | ? | ? |
| **Food** | ? | ? | ? | ? |

If each of these questions has a **totally different answer/mechanical pipeline**, we need to fix it.

---

### Standardization Requirements

#### 1. Resource Symbols (Ammo, Currency, Key Ammo, Batteries)

When spawned on the map or dropped by breakables, render using their **RESOURCE_COLOR symbol** (not emoji):

| Collectible | Symbol | RESOURCE_COLOR |
|-------------|--------|----------------|
| **Currency** | ¢ | #FFFF00 (yellow) |
| **Ammo** | ⁍ | #DA70D6 (magenta) |
| **Key Ammo** | 🗝 | #FF8A3D (bright orange) |
| **Batteries** | ◈ | #00FFA6 (cyan-green) |


**Rendering rules:**
- Use symbol character (not emoji)
- Apply ellipse hand-drawn shadow (see currency collectibles)
- Gentle bob animation within tile
- Bob amplitude scales the ellipse shadow proportionally
- Helps players distinguish collectibles from other emoji on map

#### 2. Emoji-Based Collectibles (Items, Key Items, Quest Keys, Food)

When spawned on map or dropped by enemies/breakables:

| Collectible | Scale | Shadow | Animation |
|-------------|-------|--------|-----------|
| **Items** | 0.6x | Ellipse hand shadow | Gentle bob |
| **Key Items** | 0.6x | Ellipse hand shadow | Gentle bob |
| **Quest Keys** | 0.6x | Ellipse hand shadow | Gentle bob |
| **Food** | 0.6x | Ellipse hand shadow | Gentle bob |

**Rendering rules:**
- Render at **0.6 scale** (60% of normal tile size)
- Apply ellipse hand-drawn shadow (from currency collectibles)
- Gentle vertical bob within tile
- Bob amplitude also scales the ellipse shadow (larger bob = larger shadow)
- Helps players distinguish collectibles from enemies, decor, terrain

#### 3. Cards

| Context | Render | Scale | Shadow |
|---------|--------|-------|--------|
| **On map** | 🂠 symbol | 1.1x | Ellipse hand shadow + gentle bob |
| **Dropped by enemy** | → Insert directly to player's hand | N/A | N/A |
| **Dropped by breakable** | Render as on map | 1.1x | Ellipse hand shadow + gentle bob |

---

### Pipeline Unification Questions

Each of these questions MUST have the SAME answer across all collectible types:

| Question | Current State | Target State |
|----------|--------------|--------------|
| **When items are spawned on the map, how do they render?** | Varies by type | Uniform: emoji at 0.6x + ellipse shadow + bob |
| **When items are dropped by enemies, how do they enter the player inventory?** | Varies: some direct, some fail | Uniform: attempt inventory insert, if full → drop on map |
| **When items are dropped by breakables, how do they render?** | Varies | Uniform: emoji at 0.6x + ellipse shadow + bob |
| **When items are delivered by quests/NPCs, how do they enter inventory if full?** | Varies | Uniform: attempt inventory insert, if full → notify + drop on map near NPC location |
| **When cards are dropped by enemies, how do they enter the player hand?** | Should be: direct insert | Must be: direct insert to hand, last card in hands goes to backup deck, last card in backup deck incinerates  we're playing both the debreif feed frame flash animaton for card pickup to hand followed by incineration animation if applicable for ejection of the player's last deck cards |
| **When cards are dropped by breakables, how do they render?** | ? | Render as 🂠 at 1.1x + ellipse shadow like collectibles with corresponding RESOURCE_COLOR |
| **When cards are delivered by quests/NPCs, how do they enter hand if full?** | ? | Attempt hand insert, if full → backup deck, if full → incinerate + notify |

---

### Implementation Checklist

#### Resource Symbols (Ammo, Currency, Key Ammo, Batteries)
- [x] Standardize map rendering to use symbol + ellipse shadow + bob
- [x] Standardize breakable drop to use same render path
- [x] Add RESOURCE_COLORS lookup for each type
- [x] Implement proportional ellipse shadow scaling with bob amplitude

#### Emoji Collectibles (Items, Key Items, Quest Keys, Food)
- [x] Standardize map rendering to 0.6x scale + ellipse shadow + bob
- [x] Standardize enemy drop → inventory flow
- [x] Standardize breakable drop rendering
- [x] Implement full-to-inventory fallback: drop on map with render

#### Cards
- [x] Standardize enemy drop → insert to hand (bypass map)
- [x] Standardize breakable drop → render on map
- [x] Implement hand-full fallback: backup deck, then incinerate

#### Ground Effect Items
- [ ] Water items (💧) render with water ground effect
- [ ] Future oil items render with oil ground effect
- [ ] Ground effects interact with player movement/combat

### Phase 5 Completion Notes (March 3, 2026)

**Files modified:**

| File | Changes |
|------|---------|
| `gone-rogue-mobile.js` (724-830) | Entity building: full collectible classification with scale, bobEnabled, collectibleType. Key tier detection (tier 1 → resource symbol #FF8A3D, tier 2 → emoji #FFD700, tier 3/quest → emoji #FF4444). Food at 0.6x with resourceColor. Cards at 1.1x. Generic items at 0.6x. Interactive items unchanged (no bob/scale). |
| `gone-rogue-canvas.js` `_setupTextRendering` | Store `_baseFontSize` and `_fontFamily` for per-entity scaling. |
| `gone-rogue-canvas.js` `_renderEntities` | Per-entity scale via font size change. Bob animation: ±2px sine wave, ~1.6s period, deterministic phase offset by tile position. Shadow scales proportionally with bob amplitude. |
| `gone-rogue-canvas.js` `_renderAllShadows` | Bob-aware shadow scaling in post-lighting multiply pass (mirrors _renderEntities bob calculation). |
| `death-exit-system.js` (141-155) | Enemy card drops → GAMESTATE.addCard() direct to hand. Ground-drop fallback if hand full. DebriefFeedController + OverheadAnimator animations on insert. |
| `str-combat-engine.js` (1177-1293) | Standard, boss, and mythic card drops → direct to hand with ground-drop fallback. Debrief feed animations. |

**Rendering classification summary:**

| Type | Symbol | Color | Scale | Bob | collectibleType |
|------|--------|-------|-------|-----|----------------|
| Currency | ¢ | #FFFF00 | 1.0x | ✓ | resource |
| Ammo | ⁍ | #DA70D6 | 1.0x | ✓ | resource |
| Key Ammo (tier 1) | 🗝 | #FF8A3D | 1.0x | ✓ | resource |
| Batteries | ◈ | #00FFA6 | 1.0x | ✓ | resource |
| Card on map | 🂠 | #800080 | 1.1x | ✓ | card |
| Key Item (tier 2) | emoji | #FFD700 | 0.6x | ✓ | emoji |
| Quest Key (tier 3) | emoji | #FF4444 | 0.6x | ✓ | emoji |
| Food | emoji | resourceColor | 0.6x | ✓ | emoji |
| Generic item | emoji | resourceColor/#00FFFF | 0.6x | ✓ | emoji |
| Interactive | emoji | #00FFFF | 1.0x | ✗ | null |

**Not addressed (deferred):**
- Ground effect items (water 💧, oil) — no ground items of these types exist yet
- ~~Full NCH backup-deck cascade for card overflow — requires harmonizing cardHand (object) and cardsInHand (ref) hand systems, out of scope for rendering pass~~ ✅ RESOLVED by CHH Step 3 (2026-03-04): drawCardsToHand() now uses canonical cardsInHand refs with full backup overflow + incinerate cascade

---

### Rendering Specification Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                    COLLECTIBLE RENDER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SYMBOL TYPES (Currency, Ammo, Key Ammo, Batteries)             │
│  ─────────────────────────────────────────────────────          │
│  • Render as symbol character (¢ ⁍ 🗝 ◈)                        │
│  • Use RESOURCE_COLOR for color                                 │
│  • Ellipse hand-drawn shadow                                     │
│  • Gentle vertical bob (amplitude: 1-3px)                        │
│  • Bob scales ellipse shadow proportionally                      │
│                                                                  │
│  EMOJI TYPES (Items, Key Items, Quest Keys, Food)               │
│  ─────────────────────────────────────────────────────          │
│  • Render at 0.6x scale                                         │
│  • Ellipse hand-drawn shadow                                    │
│  • Gentle vertical bob (amplitude: 1-3px)                        │
│  • Bob scales ellipse shadow proportionally                      │
│                                                                  │
│  CARD TYPES                                                     │
│  ─────────────────────────────────────────────────────          │
│  • On map: 🂠 at 1.1x + ellipse shadow + bob                    │
│  • Enemy drop: → directly to hand (no map render)               │
│  • Breakable drop: render on map                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Special considerations: enemy NCH card theif and plant mechanics haven't been sorted or tested, only implimented for reference at 3/2/2026. Ensure the following changes accomodate ENEMY_NCH_INTERACTION_ROADMAP.md


---

### File Changes Required

| File | Changes |
|------|---------|
| `world-items.js` | Standardize currency/item/cardinground rendering |
| `loot-table-manager.js` | Unify drop paths for all collectible types |
| `pickup-system.js` | Unify pickup → inventory flow |
| `overhead-animator.js` | Add bob animation + ellipse shadow rendering |
| `gone-rogue-mobile.js` | Update ground collectible rendering |
| `gone-rogue.js` | Update ground collectible rendering |
| `biomes.json` | Update breakable loot definitions |

---

### Success Criteria

1. **Single answer per question** — No more varying pipelines per collectible type
2. **Visual consistency** — All emoji collectibles at 0.6x with shadow + bob
3. **Symbol consistency** — All resource symbols use RESOURCE_COLOR + shadow + bob
4. **Predictable flow** — Enemy drops → inventory (or map if full), breakables → map render
5. **Testable** — Each pipeline path has clear entry/exit points

---

### Related Documentation

- `COLLECTIBLES_CANON.md` — Canonical categories and RESOURCE_COLORS
- `food-database.js` — Food items with resourceType, resourceColor
- `overhead-animator.js` — Overhead animation system
- `PancakeStack` — Multiple animation stacking (speech, rope, collectibles)


## Phase 5 or 6:


Update FOOD_AND_INTERACTIVE_ITEMS_GUIDE
Update INTERACTIVE_ITEMS_TODO
Update STACK_SYSTEM_INTEGRATION
Update OVERHEAD-ANIMATION-UNIFIED-ROADMAP

