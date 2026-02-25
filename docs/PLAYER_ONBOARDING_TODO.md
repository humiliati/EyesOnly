# Player Onboarding — Implementation TODO

> Extracted from `PLAYER_ONBOARDING.md` design doc. Tracks actual implementation status
> against the design specification.

**Last Updated**: 2026-02-25
**Status**: Planning → Implementation

---

## Phase 1: Terminal Entry & Command Router

| Task | Status | File(s) | Notes |
|------|--------|---------|-------|
| Create `TerminalCommandRouter` class | ❌ Not started | `public/js/terminal/command-router.js` | Handles `rogue`, `stats`, `inventory`, `highscore`, `quit`, `reset`, `dev` |
| Add command history (up/down arrow) | ❌ Not started | same | Existing terminal has basic input, needs history stack |
| Add Tab autocomplete | ❌ Not started | same | Stretch goal |
| Wire `loadPlayerState()` / `savePlayerState()` | ❌ Not started | same | Uses `localStorage` key `GONE_ROGUE_PLAYER` |
| Add dev-mode bypass (random avatar + callsign) | ❌ Not started | same | `generateDevPlayerState()` for testing |
| Terminal CSS styling | ❌ Not started | `public/css/terminal.css` | `.terminal-container`, `.blinking-cursor` |

---

## Phase 2: Onboarding Splash Screen

| Task | Status | File(s) | Notes |
|------|--------|---------|-------|
| Create `OnboardingSplash` component | ❌ Not started | `public/js/ui/onboarding-splash.js` | "YOU'VE GONE ROGUE" title + progress bar |
| Animate in (opacity + scale) | ❌ Not started | same | 500ms ease-out |
| Animate out (progress fill + fade up) | ❌ Not started | same | 300ms + 400ms |
| Splash CSS | ❌ Not started | `public/css/onboarding.css` | `.onboarding-overlay`, `.title-accent` (red ROGUE) |

---

## Phase 3: Character Selection Screen

| Task | Status | File(s) | Notes |
|------|--------|---------|-------|
| Create `CharacterSelectionScreen` component | ❌ Not started | `public/js/ui/character-selection.js` | Card-based avatar grid |
| Implement 6 avatar definitions | ❌ Not started | same | AVA-001 through AVA-006, progressive unlock |
| Card flip animation on selection | ❌ Not started | same | `.card-front` ↔ `.card-back` |
| Callsign input (text field + validation) | ❌ Not started | same | 2-12 chars, uppercase, `ENTER` to confirm |
| Lock/unlock gating based on `completedTiers` | ❌ Not started | same | Locked cards show 🃏 with lock reason |
| Character selection CSS | ❌ Not started | `public/css/character-selection.css` | `.avatar-grid`, `.avatar-card`, `.locked-overlay` |

### Avatar Roster

| ID | Name | Emoji | Stats (HP/Luck/Stamina) | Unlock |
|----|------|-------|------------------------|--------|
| AVA-001 | Operative | 🕵️ | 10/1/5 | Default |
| AVA-002 | Medic | 👨‍⚕️ | 12/0/4 | Default |
| AVA-003 | Scout | 🧭 | 8/2/6 | Complete Tier 1 |
| AVA-004 | Heavy | 💪 | 15/0/3 | Complete Tier 2 |
| AVA-005 | Ghost | 👻 | 9/3/5 | Complete Tier 3 |
| AVA-006 | Tech | 🤖 | 10/1/6 | Complete Tier 4 |

---

## Phase 4: Pre-Start Cutscene & Level Entry

| Task | Status | File(s) | Notes |
|------|--------|---------|-------|
| Create `PreStartCutscene` class | ❌ Not started | `public/js/game/cutscenes/pre-start-cutscene.js` | 4-phase cinematic sequence |
| Phase 1: Fade to black + selected emoji pulse | ❌ Not started | same | 800ms fade, emoji scale anim |
| Phase 2: Position player in T1 forest biome | ❌ Not started | same | Load biome, set avatar emoji + stats |
| Phase 3: Fade in with radial light from player | ❌ Not started | same | 1500ms light expansion anim |
| Phase 4: Auto-path waypoints with toast messages | ❌ Not started | same | 4 waypoints with control hints |
| Cutscene CSS | ❌ Not started | `public/css/cutscene.css` | `.cutscene-overlay`, `.light-emitter`, `@keyframes lightExpand` |

---

## Phase 5: Victory Flow

| Task | Status | File(s) | Notes |
|------|--------|---------|-------|
| Create `VictoryFlowController` class | ❌ Not started | `public/js/game/victory-flow.js` | 4-phase victory sequence |
| Spawn witness NPCs (MOK + operatives) | ❌ Not started | same | Emoji NPCs at completion area |
| Confetti overlay effect | ❌ Not started | same | 5s duration, multi-color |
| High score calculation | ❌ Not started | same | `base + time + resource + enemy + efficiency` |
| Save score + unlock next tier | ❌ Not started | same | `localStorage` persistence |
| High score popup window | ❌ Not started | `public/js/ui/high-score-popup.js` | Shows breakdown of score |
| Return to terminal with summary | ❌ Not started | same | Display completed tiers, prompt next mission |

---

## Phase 6: Death Handling & "YOU DIED" Screen

| Task | Status | File(s) | Notes |
|------|--------|---------|-------|
| Create `DeathHandler` class | ⚠️ Partial | `public/js/game/death-handler.js` | Existing `DeathHandler` module handles some of this |
| Preserve inventory on death | ⚠️ Partial | same | GAMESTATE already handles persistent vs loose inventory |
| Death animation (shake + red fade) | ❌ Not started | same | Camera shake 500ms, fade to `#330000` |
| "YOU DIED" overlay with stats | ❌ Not started | same | Floors cleared, enemies defeated, cards played, run time |
| Cleanup game state + return to terminal | ❌ Not started | same | Clear hand/backup/equipped, keep persistent inventory |

### Death Preservation Rules

| Slot | On Death |
|------|----------|
| Hand (loose inventory) | ❌ LOST |
| Backup cards | ❌ LOST |
| Equipped active item | ❌ LOST |
| Persistent inventory | ✅ KEPT |
| Currency | ✅ KEPT (50% penalty) |
| Unlocked avatars | ✅ KEPT |
| High scores | ✅ KEPT |
| Ammo keys (Tier 1) | ❌ LOST |
| Gate keys (Tier 2) | ✅ KEPT |
| Quest keys (Tier 3) | ✅ KEPT |

---

## Integration Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `GAMESTATE` persistence layer | ✅ Done | localStorage, inventory management, key counters |
| `WindowManager` for screen transitions | ❌ Not started | Manages splash, selection, game, score windows |
| `PassiveItemsSystem` avatar override | ✅ Done | `getPlayerAvatarOverride()` already supports emoji |
| Tutorial floors (Floor 1-3) | ✅ Done | Hourglass layout, key+gate, food items |
| Lighting system | ✅ Done | Biome gradients, canvas overlay |
| Loot table system | ✅ Done | Key drops, quest keys, breakable drops |

---

## Implementation Priority

1. **P0 — Core flow**: Terminal router → Onboarding splash → Character selection → Game entry
2. **P1 — Death handling**: YOU DIED screen → inventory preservation → terminal return
3. **P2 — Victory flow**: Witness NPCs → confetti → high score → terminal return
4. **P3 — Polish**: Pre-start cutscene, auto-path tutorial, difficulty selector

---

## Quick Start for Implementer

1. The existing game already launches via `GoneRogue.start()` — the onboarding wraps this with a state check
2. `GAMESTATE` already has `_loadState()` / `_saveState()` — player state should merge into this
3. `PassiveItemsSystem.getPlayerAvatarOverride()` is the hook for selected avatar emoji
4. Death handling partially exists in `DeathHandler` module — extend, don't replace
5. The terminal UI exists as the main page — command router augments the existing input handler
