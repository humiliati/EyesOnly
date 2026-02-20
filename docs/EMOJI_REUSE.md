# Emoji Reuse (Designer Notes)

This document records **intentional emoji reuse** across systems.

If you reuse an emoji for multiple domains (items, cards, world tiles, breakables, NPCs), add it here with a rationale.

## 📦 Cardboard Box System (intentional cross-domain symbol)

**Emoji:** 📦

**Used by:**
- Items:
  - `ITM-998` Amazon Box
  - `ITM-999` Refrigerator Box
- Cards:
  - `ACT-999` Cardboard Box
- World/environment:
  - Box props / box breakables / camo-relevant box tiles (where implemented)

**Rationale:**
- MGS-style *portable camouflage* that exists both as an object in the world and as a tool in inventory.
- Consistent visual language supports the narrative function: “become the environment.”

**Constraints:**
- Do **not** use 📦 for generic containers/resources unless it is part of the box-camo mechanic.
- If a biome needs a different box type, reuse 📦 but differentiate via **sprite** (e.g. `box_amazon`, `box_refrigerator`) and document it here.

## Missing / Placeholder

- Placeholder/migration-fallback items should use ❓ and explicit bracketed names.
- Canonical unknown legacy item id: `ITM-000` (see `public/data/gone-rogue/items.json`).
