# Quick Start: Vents, Floor Shuffling, and Biome Bleed

## What Was Added

Three new systems for Gone Rogue:

1. **🕳️ Vents** - Skip floors (risky) or backtrack with penalties
2. **🎲 Floor Shuffling** - Random biome selection for variety
3. **🌊 Biome Bleed** - Tiles from adjacent biomes at edges

## How to Test

### Automated Tests
```bash
npm run dev
# Open: http://localhost:8787/tests/test-vents-biome-shuffle.html
```

### Manual - Vents
1. Start Gone Rogue (`ROGUE` command)
2. Find 'V' tile (15% spawn rate on floors 5+)
3. Use `INTERACT` twice (discover, then attempt)
4. Outcomes:
   - ✅ Success: Skip to floor N+2
   - ❌ Failure: Backtrack 3 floors, see 🔻 PENALTY

### Manual - Floor Shuffling
1. Start multiple runs
2. Check biome in status line
3. Verify variety after floor 4

### Manual - Biome Bleed
1. Play through floors
2. Look for different tiles at map edges
3. Left side: previous biome, Right side: next biome

## Key Numbers

**Vent Success:**
- Base: 75%
- Per use: -5%
- Per floor: -1%
- Per tier (T2/T3): -5%
- Rusty: -5%
- Minimum: 25%

**Penalty Floors:**
- Enemies: +20% stats, +1 sight
- Count: 3 floors
- Marker: 🔻

**Biome Weights (Floors 10-15):**
- Industrial: 40%
- Mall: 25%
- Cave: 15%
- Forest: 10%
- Aerospace: 10%

## Files

- Core: `public/js/gone-rogue.js`
- Tests: `public/tests/test-vents-biome-shuffle.*`
- Docs: `VENTS_BIOME_IMPLEMENTATION.md`

## Status

✅ All tests passing
✅ Security scan clean
✅ Code review approved
✅ Ready for merge
