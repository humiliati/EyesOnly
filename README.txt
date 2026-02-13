EYES ONLY - Classified Recruitment Terminal
============================================

An ARG-style landing page for the EYES ONLY espionage ARPG.
Built on langterm architecture (github.com/statico/langterm).
Frontend-only. No build step. No framework.


QUICK START
-----------
Serve with any static HTTP server (required for JSON fetch):

  python -m http.server 8080
  # then open http://localhost:8080

Or use Node:

  npx serve .


PROJECT STRUCTURE
-----------------
  index.html           - Entry point
  css/crt.css          - CRT terminal styling (scanlines, phosphor, barrel distortion)
  js/terminal.js       - Terminal rendering engine (adapted from langterm)
  js/parser.js         - Command parser with hidden command support
  js/state-machine.js  - ARG state machine (clearance flow)
  js/missions.js       - Mission registry & geocaching hooks
  js/main.js           - Orchestrator (boot sequence, command routing)
  data/missions.json   - Mission node configuration


INTERACTION FLOW
----------------
1. Screen shows "EYES ONLY _" with blinking cursor
2. Any keypress triggers boot sequence
3. User enters a clearance command: CLEARANCE, ACCESS, AUTH, or EYES ONLY
4. System prompts for DESIGNATION (answer: CIVILIAN)
5. System asks PROCEED? [Y/N]
6. If Y, system asks for temporal key (answer: 1977)
7. ACCESS GRANTED - terminal reveals classified mission briefings
8. Post-access commands: STATUS, MISSIONS, DOSSIER, MAP, HELP, etc.
9. Mission unlock codes can be entered to reveal lore fragments


HIDDEN COMMANDS
---------------
  FALCON    - Reference to Christopher Boyce
  SNOWMAN   - Reference to Andrew Daulton Lee
  SUBMERGED - Navy acoustic research / Project Abyssal
  AMBER     - Switch to amber phosphor mode
  GREEN     - Switch back to green phosphor mode
  RESET     - Purge all session data (requires "CONFIRM PURGE")


ADDING NEW MISSION NODES
-------------------------
Edit data/missions.json and add a new entry under "missions":

  "your_node_id": {
    "id":          "your_node_id",
    "codename":    "YOUR CODENAME",
    "unlockCode":  "the-code-at-the-location",
    "location":    "Human readable location",
    "coordinates": { "lat": 48.0, "lng": -116.0 },
    "faction":     "FACTION_NAME",
    "lore":        ["Line 1", "Line 2", "..."],
    "reward":      "Description of ARPG reward",
    "briefing":    "Short mission briefing text",
    "status":      "ACTIVE"
  }

Fields:
  id          - Unique identifier (lowercase, underscores)
  codename    - Display name in terminal (UPPERCASE)
  unlockCode  - Code phrase entered by players at physical locations
  location    - Human-readable hint (shown in MISSIONS list)
  coordinates - Lat/lng for geolocation proximity (future feature)
  faction     - Faction name for reputation tracking
  lore        - Array of text lines revealed on unlock
  reward      - ARPG reward description
  briefing    - Short mission briefing (shown in rotating briefings)
  status      - "ACTIVE", "DORMANT", or "COMPROMISED"


CURRENT MISSION NODES (3 fictional Sandpoint businesses)
--------------------------------------------------------
  FALCON NEST    - Downtown First Avenue   (code: boyce77)
  SNOWMAN NODE   - City Beach / Memorial   (code: lee84)
  SUBMERGED SITE - Marina / Lakefront      (code: navydeep43)


PERSISTENCE
-----------
All state is stored in localStorage:
  eyesonly_state    - State machine (clearance progress)
  eyesonly_missions - Unlocked missions, faction reputation
  eyesonly_history  - Command history


ARCHITECTURE NOTES
------------------
Adapted from langterm (MIT license):
- IIFE module pattern (no ES modules, no bundler)
- Global keydown handler for input (no visible input element)
- Command history via localStorage (langterm used sessionStorage)
- Script load order in HTML handles dependencies

Differences from langterm:
- No WebGL/shader pipeline (CSS-only CRT effects)
- No backend API (frontend-only state machine)
- State persistence via localStorage instead of sessionStorage
- Multi-state ARG flow instead of single Inform7 session
- Mission registry for expandable geocaching content
