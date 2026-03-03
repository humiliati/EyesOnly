# EYES ONLY — Item Pipeline: Full Lifecycle Audit & Designer Portal Roadmap
### v1.1 — March 2026 (Phase 1 complete)

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

**Current inventory (50 items):**

| Range | Type | Count | Examples |
|-------|------|-------|---------|
| ITM-000 | Migration fallback | 1 | `[Unknown Legacy Item]` — the ❓ stub |
| ITM-001 | Consumable (vice) | 1 | Cigarette |
| ITM-002–004 | Equipment (starter) | 3 | Radio, Surveillance Cam, Journal |
| ITM-005–009 | Equipment (combat) | 5 | 3D Printer, Pickpocket Gloves, Scout Scope, EMP, Wire Tap |
| ITM-010–016 | Keys (gate, tier 2) | 7 | Rusty Key, Keycard, Master Key, Thumb Drive, Access Card, Mall Tag, Industrial Pass |
| ITM-020–023 | Deployable (boxes) | 4 | Cardboard → Legendary Refrigerator Box |
| ITM-030–031 | Keys (quest, tier 3) | 2 | Blacksmith's Hammer, Rune Fragment |
| ITM-040–044 | Equipment (cascade) | 5 | Archive Indexer, Suppressor Oil, Dead Drop Cache, Tripwire Array, Signal Jammer |
| ITM-050–051 | Equipment (magnet) | 2 | Magnet, Magnet+ |
| ITM-060–061 | Equipment (flight save) | 2 | Cargo Webbing, Tactical Harness |
| ITM-070 | Equipment (epic) | 1 | Thermal Goggles |
| ITM-080–093 | Equipment (passive) | 14 | Surge Protector → Redneck Obliterator |
| ITM-998–999 | Equipment (transform) | 2 | Amazon Box, Refrigerator Box (wearable) |

### 2B. `environmental-synergy.js` — Key Item Definitions (Parallel Source)

**Path:** `public/js/environmental-synergy.js`
**Object:** `SYNERGY_DEFINITIONS.KEY_ITEMS`
**ID format:** Internal `itemId` (e.g. `KEY_002`, `KEY_030`) + cross-ref `registryId` (e.g. `ITM-011`)

This is the **authoritative source for key item behavior** — tier, gate compatibility, consumeOnUse, npcTarget. The `registryId` bridges to items.json but the fields are duplicated (emoji, name, description all appear in both).

| Internal Key | itemId | registryId | Tier | consumeOnUse |
|-------------|--------|-----------|------|-------------|
| RUSTY_KEY | KEY_002 | — | 1 | true |
| BRONZE_KEY | KEY_004 | — | 1 | true |
| KEYCARD | KEY_003 | ITM-011 | 2 | false |
| MASTER_KEY | KEY_004 | ITM-012 | 2 | false |
| THUMB_DRIVE | KEY_005 | ITM-013 | 2 | false |
| ACCESS_CARD | KEY_006 | ITM-014 | 2 | false |
| MALL_KEY | KEY_007 | ITM-015 | 2 | false |
| INDUSTRIAL_PASS | KEY_008 | ITM-016 | 2 | false |
| BLACKSMITH_HAMMER | KEY_030 | ITM-030 | 3 | true |
| RUNE_FRAGMENT | KEY_031 | ITM-031 | 3 | true |

**Problem:** Tier 1 keys (RUSTY_KEY, BRONZE_KEY) have **no registryId** and no items.json entry. They exist only in environmental-synergy.js. The pickup system builds a raw payload for them that never hits the registry.

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

### 4A. Tier 1 Keys Are Ghosts
RUSTY_KEY and BRONZE_KEY exist only in `environmental-synergy.js` with no `registryId` and no `items.json` entry. They're consumed as ammo (not stored in inventory), so the registry never sees them, but they can't be looked up or displayed in any item browser.

**Fix:** Add ITM-017 (Rusty Key) and ITM-018 (Bronze Key) to items.json. Add `registryId` to their env-synergy definitions.

### 4B. Three ID Schemes
- `ITM-XXX` — items.json registry (canonical)
- `KEY_0XX` — environmental-synergy internal (itemId)
- `OFF_XXX` / `MLL_XXX` / `IND_XXX` — item-spawner world objects

World objects don't need to merge — they're a separate concept. But KEY_0XX should be fully cross-referenced to ITM-XXX.

### 4C. Dual-Source Duplication
Key items have emoji, name, description, tier, and consumeOnUse defined in BOTH `items.json` AND `environmental-synergy.js`. If a designer edits one, the other goes stale.

**Fix:** Environmental-synergy should reference `registryId` only and pull all display/behavior fields from the registry at init.

### 4D. `_legacyItemNameToId` Is a Maintenance Hazard
Every new item with a legacy name path needs a manual entry in this map (currently 11 entries). It's a runtime name→ID lookup in gamestate.js.

**Fix:** Generate this map from items.json at build time, or eliminate legacy name paths entirely.

### 4E. Six Independent Renderers
Each has its own `_missing` check and fallback emoji. A new item property (e.g. `rarity` coloring) would need to be added to all six.

**Fix:** Create `SharedItemRenderer.createItemElement(ref)` that all six renderers call, similar to `SharedCardRenderer.createCardElement()`.

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

### 5E. Implementation Phases

**Phase 1: Unify (code cleanup, no new UI) — ✅ COMPLETE**
- ✅ Added ITM-017 (Rusty Key), ITM-018 (Bronze Key) to items.json; added registryId to env-synergy Tier 1 defs
- ✅ env-synergy `init()` now merges display fields from registry for all keys with registryId
- ✅ `GoneRogueDataRegistry.getItemIdByName()` auto-generates name→ID map at load time
- ✅ `gamestate._legacyItemNameToId()` queries registry first, hardcoded fallback reduced to 5 entries
- ✅ Created `SharedItemRenderer` (resolve, abbreviateName, getRarityColor, buildTooltipHtml)
- ✅ All 6 renderers migrated to `SharedItemRenderer.resolve()` (rogue-sidebar, NCH, BAC, mobile×3)

**Phase 2: Validate (build-time tooling)**
- JSON schema validator for items.json (required fields, ID format, effect type enum)
- Orphan detector: items referenced in env-synergy/tutorial-floors but missing from items.json
- Duplicate detector: same name or emoji in different ID ranges
- Effect type linter: unknown effect types, missing required params

**Phase 3: Editor (web UI)**
- React SPA reading items.json directly
- CRUD operations with auto-ID assignment (next available ITM-XXX)
- Effect builder with type dropdown + dynamic param fields
- Live preview: inventory slot mockup, tooltip mockup, NCH vault mockup
- Export button: writes sorted items.json with stable formatting

**Phase 4: Playtesting Integration**
- Hot-reload: portal publishes → game reloads registry without restart
- Item grant console: portal sends item to running game session via WebSocket
- Loot table editor: visual weight/probability editor for LootTableManager tables
- Drop preview: simulate N loot rolls and show distribution histogram

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
| `js/world-items.js` | Ground items/currency management | Floor pickup tracking |
| `js/tutorial-floors.js` | Hardcoded spawn coordinates | References env-synergy keys |
| `js/terminal/command-router.js` | Dev mode commands | `dev on` generates test state |

---

*End of document. This roadmap should be updated as phases are completed.*
