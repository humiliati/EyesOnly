# EyesOnly TODO

This is a short, living TODO list (current architecture).

## P0
- [ ] **Standardize unified inventory metadata schema** (season/rarity/ladder/tags) and document it.
- [ ] Wire more **spend/consume paths** to server consume beyond active item (e.g., shop purchases, card disposal/spend semantics if needed).
- [ ] Expand **merge-local-data** coverage beyond `eyesonly_gamestate` (identify canonical localStorage keys + conflict rules).

## P1
- [ ] Add username availability endpoint/UI polish (optional).
- [ ] Add M UI convenience: typeahead callsign/user lookup when granting roles and inventory.

## P2 (future/optional)
- [ ] Password-based auth (if re-adopted) and account recovery flows.
- [ ] Agent API key binding / kernel persistence integration.
