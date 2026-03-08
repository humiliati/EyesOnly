# NPC Canon — Actionable Rules & Implementation Steps

> **Status:** Implementation Roadmap
> **Last Updated:** 2026-03-07
> **Cross-References:** [BUILDING_INTERIOR_SYSTEM.md](./BUILDING_INTERIOR_SYSTEM.md), [TOOLTIP_SPACE_CANON.md](./TOOLTIP_SPACE_CANON.md), [INTERIOR_SYSTEM_IDEAS.md](./INTERIOR_SYSTEM_IDEAS.md)
> **Template NPC:** Blacksmith (NPC-BLACKSMITH) in tavern interior (floor 0.1)

---

## Part 1: Hard Invariants (Must Be True For Every NPC)

These are validation rules. The proc gen engine MUST NOT produce an NPC that violates any of these.

### Rule 1: No NPC Is Silent

Every NPC must have a `dialogueTree` with at minimum a `greeting` node (text + choices) and a `farewell` choice (next: null).

**Validation:** `if (!npc.dialogueTree || !npc.dialogueTree.nodes || !npc.dialogueTree.root) REJECT`

**Implementation:** `DialogueSystem._resolveTree(npc)` already auto-wraps flat `dialogues[]` into a linear tree, but proc gen should always produce a proper tree.

### Rule 2: Dialogue Belongs To A Place

NPC dialogue is only valid inside an interior floor (FloorN.N or deeper). World floors (FloorN) have gate NPCs and shopkeepers only — these use the existing gate/shop systems, not dialogue trees.

**Validation:** `if (npc.dialogueTree && !InteriorFloors.isInteriorFloor(floorId)) REJECT_DIALOGUE_TREE`

**Exception:** Gate NPCs on world floors use `npc-gate-system.js` combat trigger, not DialogueSystem.

### Rule 3: Every NPC Has A Body

NPCs cannot render as a face-only emoji. Allowed avatar forms:

| Form | Example | When |
|------|---------|------|
| Bust emoji | 🧑, 👩, 👨‍🌾 | Default for all humanoids |
| Full body emoji | 🧙, 👷, 👮 | Profession-specific |
| Emoji stack | 🧑 + 😠 + 🔨 | Rich NPCs with face + tool layers |

**Avatar Stack Composition (3 layers):**

| Layer | Purpose | Examples |
|-------|---------|---------|
| Base Body | Humanoid archetype | 🧑 👩 👨‍🌾 🧙 👩‍🍳 👷 👮 |
| Face | Emotion / personality | 🙂 😠 😴 😰 🤨 😐 |
| Tool/Trait | Role identifier | 🔨 📚 🧺 🗝 🧹 🍳 ⚒️ |

**Implementation:** Extend `rendering-ui.js` NPC rendering to support `npc.avatarStack: { body, face, tool }`. The scene portal emoji stacker is the reference for multi-layer rendering.

**Validation:** `if (!npc.emoji && !npc.avatarStack) REJECT`

### Rule 4: Every NPC Is Interactive

Every NPC must provide at least ONE of:

| Interaction | System | Status |
|-------------|--------|--------|
| Dialogue tree | `dialogue-system.js` | ✅ Implemented |
| Shop | `shop-system.js` | ✅ Implemented |
| Quest | `npc.questItem` + `npc.npcTarget` | ✅ Blacksmith template |
| STR encounter | `npc-gate-system.js` | ✅ Gate NPCs |
| Minigame | Future | ⬜ Not yet |
| Rumor | DialogueSystem node | ✅ Via dialogue tree |

**Validation:** `if (!npc.dialogueTree && !npc.shopkeeper && !npc.gate && !npc.questItem) REJECT`

### Rule 5: Every NPC Exists In Time

NPCs must have a `schedule` defining what they do (even if `{ type: 'static' }`) and a `pathing` archetype (even if `{ type: 'static', nodes: [] }`).

### Rule 6: No NPC Is Filler

Every NPC must contribute at least one of: information, mechanic, risk, reward, atmosphere. Proc gen verifies each NPC has at least one `contributionTag` from `['info', 'mechanic', 'risk', 'reward', 'atmosphere']`.

---

## Part 2: NPC Structural Schema

Every NPC object conforms to this schema:

```javascript
{
  // ── Identity ──
  id: 'NPC-BLACKSMITH',
  name: 'Blacksmith',
  emoji: '⚒️',                    // Primary render emoji (legacy compat)
  avatarStack: {                  // Rich avatar (optional, overrides emoji)
    body: '👨‍🏭', face: '😐', tool: '🔨'
  },

  // ── Location ──
  x: 24, y: 5,
  direction: 'south',

  // ── Dialogue ──
  dialogues: ['line1', 'line2'], // Legacy flat array (auto-wrapped)
  dialogueTree: {                // Morrowind-style branching (preferred)
    root: 'greeting',
    nodes: { /* ... */ }
  },

  // ── Interaction ──
  shopkeeper: false,
  gate: null,
  questItem: 'BLACKSMITH_HAMMER',
  npcTarget: 'BLACKSMITH',

  // ── Behavior ──
  schedule: {
    type: 'interior_loop',       // static | interior_loop | patrol | wander | node_travel
    nodes: ['forge', 'anvil'],
    timing: { moveEvery: 8 }
  },
  pathing: {
    type: 'interior_loop',
    waypoints: [{ x: 24, y: 5 }, { x: 26, y: 5 }]
  },

  // ── Vulnerability ──
  vulnerability: {
    theft: false, plant: false, card: false, gossip: true
  },

  // ── Destructibility ──
  destructibility: 'provokable', // friendly | provokable | enemy | destructible
  stats: { hp: 18, str: 8, dex: 4 },

  // ── Proc Gen Metadata ──
  archetype: 'smith',
  contributionTags: ['mechanic', 'reward'],
  reward: { type: 'card_upgrade' }
}
```

---

## Part 3: Pathing Archetypes

| Archetype | Movement Pattern | Used For |
|-----------|-----------------|----------|
| `static` | Never moves | Shopkeepers, desk clerks, bartenders |
| `interior_loop` | Cycles between 2-3 furniture nodes | Granny (stove↔bed), smith (forge↔anvil) |
| `patrol` | Loops a small circuit | Guards, thieves, police |
| `wander` | Random walk within building bounds | Drunks, guests, kids |
| `node_travel` | Moves between floors | Messengers, servants (future) |

**Implementation file:** `public/js/npc-pathing-system.js` (NEW). Tick-based: call `NpcPathingSystem.tick(npc, ctx)` from the main game loop's turn increment.

---

## Part 4: Behavior Archetypes (Proc Gen Templates)

| Archetype | Path | Interaction | Vulnerability | Dialogue Style |
|-----------|------|-------------|---------------|----------------|
| `granny` | stove ↔ bed | dialogue + rumor | theft | Complaints, food offers, gossip |
| `smith` | forge ↔ anvil | quest + shop | none | Tools, repair, trade |
| `guard` | patrol loop | STR encounter + bribe | none | Warnings, threats, patrol talk |
| `drunk` | wander | gossip + card game | theft | Slurred rumors, gambling |
| `clerk` | desk ↔ shelf | quest + documents | plant | Formal, papers, requests |
| `bartender` | static (bar) | shop + rumor | none | Greetings, drinks, local news |
| `priest` | static (altar) | dialogue + blessing | none | Spiritual, lore, healing |
| `merchant` | static (counter) | shop | theft | Prices, wares, bargaining |
| `child` | wander | atmosphere + rumor | none | Playful, curious, hints |

---

## Part 5: Dialogue Tree Minimum Structure

Every auto-generated dialogue tree MUST contain these node types:

```
greet → [ROLE TOPIC] → role_line → back to greet
      → [WORLD TOPIC] → world_line → back to greet
      → [INTERACTION] → interaction_prompt → effect or back
      → Farewell → end
```

The greeting must reference the NPC's role. The world line must reference location or lore. The interaction prompt must lead to a mechanic (quest, shop, minigame, stat check).

---

## Part 6: Proc Gen Pipeline (NPC Stamping)

**Step 1:** Select building type (from `buildings.json` or grammar)
**Step 2:** Spawn archetype pool based on building + furniture nodes:

| Building | Required | Optional |
|----------|----------|----------|
| house | granny OR resident | child, guest |
| shop | merchant | clerk |
| tavern | bartender | drunk, guard, merchant |
| office | clerk | guard |
| forge | smith | — |
| church | priest | — |

**Step 3:** Ensure ≥1 NPC per building provides: quest OR shop OR rumor
**Step 4:** Build avatar stack (body → face → tool) with seeded randomness
**Step 5:** Generate schedule + path from furniture node positions
**Step 6:** Generate dialogue tree from archetype template + building context + world state
**Step 7:** Validate all 6 hard invariants. Reject and regenerate any invalid NPC.

---

## Part 7: Density Rules

| Building Size | NPC Count |
|--------------|-----------|
| Small room (< 6x6) | 1 |
| House (6x6 - 10x10) | 1-2 |
| Shop (8x8 - 12x12) | 1-3 |
| Tavern (12x12+) | 3-6 |
| Office (10x10+) | 2-5 |

---

## Part 8: Implementation Steps (Ordered)

### Phase A: NPC Dialogue System ✅ COMPLETE
- [x] `dialogue-system.js` — Morrowind-style dialogue with clickable choices
- [x] `tooltip-system.js` — Priority system preventing tooltip overwrite during dialogue
- [x] `tutorial-floors.js` — dialogueTree on Elder, Father Aldric, Tavern Keeper, Blacksmith
- [x] `tap-move-system.js` — Tap adjacent NPC to start conversation
- [x] `move-player-system.js` — Walk-away interrupts dialogue

### Phase B: NPC Pathing System
- [ ] Create `npc-pathing-system.js` — Tick-based movement between waypoints
- [ ] Add `schedule` and `pathing` fields to NPC schema
- [ ] Wire `NpcPathingSystem.tick()` into game loop
- [ ] Implement `interior_loop`, `patrol`, `wander`
- [ ] Define furniture node positions in authored layouts

### Phase C: Avatar Stack Rendering
- [ ] Extend `rendering-ui.js` with `npc.avatarStack` support
- [ ] Port scene portal emoji stacker for multi-layer NPC rendering
- [ ] Update `gone-rogue-canvas.js` NPC draw to use stack when available

### Phase D: Proc Gen NPC Stamping
- [ ] Create `npc-generator.js` — Archetype selection, dialogue gen, validation
- [ ] Wire into `interior-grammar.js` structure generation
- [ ] Add archetype templates with seeded variation
- [ ] Implement 6-invariant validation pass

### Phase E: Vulnerability Systems
- [ ] Theft mechanic (pickpocket adjacent NPC)
- [ ] Plant mechanic (plant item on NPC)
- [ ] Card game mechanic (NPC card duel)
- [ ] Gossip/rumor network (proc gen breadcrumb chains)

---

## Part 9: Files Reference

| File | Status | Purpose |
|------|--------|---------|
| `dialogue-system.js` | ✅ | Morrowind dialogue engine |
| `tooltip-system.js` | ✅ | Priority system + showDialogue() |
| `npc-gate-system.js` | ✅ | Gate combat NPCs |
| `npc-pathing-system.js` | ⬜ NEW | NPC movement between furniture nodes |
| `npc-generator.js` | ⬜ NEW | Proc gen NPC stamping |
| `tutorial-floors.js` | ✅ | 4 NPCs with dialogueTree |
| `rendering-ui.js` | ⬜ MODIFY | Avatar stack rendering |

---

**Document Version:** 1.0
**Status:** Actionable roadmap — Phase A complete, Phase B next
