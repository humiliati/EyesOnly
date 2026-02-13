# Street Block Designer Kit

This folder is a **no-code-ish content kit** for building Street Chronicles blocks without touching JavaScript.

## What this is
Street Chronicles renders location descriptions from JSON data files. A "block" is one playable location/intersection with:
- story text
- N/E/S/W connections
- business participation details
- optional IRL activation hooks (actors, timed events, QR clues)

## Workflow for non-technical designers
1. Copy `block-template.json` and rename it to your block name (example: `cedar-and-1st.json`).
2. Fill in all fields marked `TODO`.
3. Complete `business-participation-form.md` with each partner business.
4. Send both files back to the game admin/content team.
5. Admin merges content into `data/streets.json`, `data/businesses.json`, and `data/events.json`.

## Minimum required fields
- `block_id`
- `display_name`
- `description`
- `connections` (north/east/south/west)
- at least one of: `businesses`, `items`, or `event`

## Design notes for business owners
- Keep copy immersive and in-character.
- Mention real place details, but keep game actions fictional.
- If using actors IRL, include safety plan and approved hours.

## Submission checklist
- [ ] Narrative copy approved
- [ ] Business owner opted in
- [ ] IRL activation reviewed (if any)
- [ ] Event contact and emergency contact supplied
