# Unified Inventory Metadata Contract (v1)

This document defines the **unified inventory metadata schema** stored in `user_inventory.metadata`.

Goals:
- Minimal but extensible
- Safe across modes (ARG vs Gone Rogue)
- Supports live ops and long-horizon seasonal economies
- Trade-ready (future P2P)

## Core rules

1) **Storage is unified**: all items live in `user_inventory`.
2) **Utility is contextual**: execution contexts (ARG, Rogue) decide behavior; metadata is selectors/permissions, not hardcoded logic.
3) **Per-instance identity**: when metadata contains `id`, it MUST be an **opaque UUID** generated server-side if missing.
4) **No stacking in UI**: clients render inventory as **instances**.
   - Storage may use `quantity>1` only for fungible items that do not require per-instance identity.

## Schema

```json
{
  "id": "string", 
  "version": 1,

  "type": "card | relic | cosmetic | currency | key | artifact",
  "subtype": "optional string",

  "rarity": {
    "tier": "common | uncommon | rare | epic | legendary | mythic",
    "weight": 0.0,
    "ladder_locked": false
  },

  "season": {
    "id": "S01",
    "name": "Dead Signal",
    "limited": true,
    "reprintable": false
  },

  "progression": {
    "collectible": true,
    "ladder_track": "tier_1 | tier_2 | tier_3 | null",
    "first_completion_drop": false,
    "bind_on_acquire": false
  },

  "economy": {
    "tradeable": false,
    "auctionable": false,
    "forge_anchor": false,
    "consumable": true
  },

  "tags": [
    "rogue_usable",
    "irl_relic",
    "cosmetic",
    "printable",
    "junk",
    "synergy_trigger",
    "focus_cost",
    "burn_pile"
  ],

  "runtime": {
    "stackable": false,
    "max_stack": 1,
    "expires_on_run_end": false,
    "true_joker_eligible": false
  },

  "visual": {
    "emoji": "🃏",
    "animation_profile": "joker_glitch",
    "card_frame": "legendary_red"
  }
}
```

### Notes
- `id` is **per-artifact**, globally unique, opaque UUID.
- `item_id` (in `user_inventory`) remains the canonical definition key used by registries.
- `tags` are selectors; they do not carry logic by themselves.

## Example: Forge Sigil (economy anchor)

```json
{
  "id": "cbbd6e28-0f30-4c3c-a41a-0f4f90f8c2a9",
  "version": 1,
  "type": "relic",
  "subtype": "forge_token",
  "rarity": { "tier": "legendary", "weight": 0, "ladder_locked": true },
  "season": { "id": "S01", "name": "Dead Signal", "limited": false, "reprintable": false },
  "progression": { "collectible": true, "ladder_track": "tier_1", "first_completion_drop": true, "bind_on_acquire": false },
  "economy": { "tradeable": true, "auctionable": true, "forge_anchor": true, "consumable": true },
  "tags": ["forge", "joker_upgrade", "economy_anchor"],
  "runtime": { "stackable": true, "max_stack": 99, "expires_on_run_end": false, "true_joker_eligible": false },
  "visual": { "emoji": "🜂", "animation_profile": "forge_glow", "card_frame": "anchor_gold" }
}
```
