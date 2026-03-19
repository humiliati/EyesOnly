# Session Summary — March 18, 2026

## Systems Built

### QR Puzzle Pipeline
- **3 puzzle widgets**: cipher wheel, jigsaw slider, riddle chain — auto-open via `#hash` routing
- **Hash router** (`qr-router.js`): deferred registration with 12s retry polling
- **QR sticker sheets**: printable HTML with embedded QR PNGs
- **Pure-JS QR encoder** (`qr-encode.ts`): zero-dependency, runs in Cloudflare Workers, outputs valid PNG

### Puzzle Designer Portal
- **Designer page** (`/puzzle-designer`): 3-column editor with live preview, QR generation, LLM-ready blank template
- **Auth gate** (`auth-gate.js`): unified token check across mmode/ops/api sessions — login form only shown on cold visit
- **Server API**: CRUD + category management + archive/restore/clone/reorder + MISSION EXPIRED fallback
- **D1 tables**: `qr_puzzles` (0014), `qr_categories` (0015)
- **Public endpoints**: `/api/puzzles/live` (no auth) split from `/api/ops/puzzles` (auth required)

### Hybrid Paper + CRT Layout
- **games.html**: wooden header, paper desk with manila folder, sticky note nav (desktop), porthole torso buttons (mobile), CRT monitor inset, tape-on-paper footer
- **contact.html**: same hybrid treatment — desk + folder + post-its + CRT monitor
- **games-hybrid.css**: shared CSS for both pages — desktop grid, mobile flex column, viewport-locked scroll
- **SVG star explosion**: 4-pointed stars burst outside button bounds on tap (porthole effect)
- **Starfield blowthrough**: post-it notes dissolve to reveal star canvas on hover (desktop)

### Terminal Boot Overhaul
- **New boot sequence**: newcomers see site orientation (booking, partners, contact, gone rogue), returning users get compact restore
- **Navigation commands**: `/booking`, `/partners`, `/contact`, `/games`, `/arcade`, `/designer` all navigate to those pages
- **HELP text reorganized**: sections (NAVIGATION, GAME MODES, INTELLIGENCE, ACCOUNT, SYSTEM)
- **LoginShell disabled**: fake ARG filesystem (user/password, admin/admin) commented out — `login` command now uses canonical `UIControls.showLoginOverlay()`
- **CRT overlay reduced**: vignette halved, phosphor glow dialed back
- **Control rail starfield**: 6 buttons get starfield canvas porthole on hover

## Known Issues Resolved
1. ~~D1 migration required~~ — Applied (0014 + 0015)
2. ~~Auth token plumbing~~ — AuthGate unified system deployed
3. ~~CDN cache lag~~ — Deferred registration + window.load polling handles all timing
4. ~~QR code server-side generation~~ — Pure-JS encoder in Workers
5. ~~Puzzle code sandboxing~~ — Documented as future concern, not blocking

## Remaining from Roadmap
- Phase 1.5: Lazy-load scalability (document only, implement when >200 puzzles)
- Phase 2: Desktop card tile grid (games items as hover cards instead of list)
- Phase 3: QR arrival "MISSION ACTIVATED" splash
- Phase 4: Desktop toys (decoder hero, arcade attract mode, chain visualizer)
- Phase 5: Grafcet door-contract integration
- Kernel: highscore attribution + rate limiting (§4-5 of TODO)
- Sound check: card-01 / ui-01 wiring verification across all pages

## Files Changed (this session)

### New Files
| File | Purpose |
|------|---------|
| `migrations/0014_qr_puzzles.sql` | Puzzle designer D1 table |
| `migrations/0015_qr_categories.sql` | Category D1 table + ALTER puzzles |
| `src/worker/routes/puzzle-designer.ts` | CRUD + publish + categories + MISSION EXPIRED |
| `src/worker/utils/qr-encode.ts` | Pure-JS QR code PNG generator |
| `public/puzzle-designer.html` | Designer portal with auth gate |
| `public/js/auth-gate.js` | Unified cross-page auth module |
| `public/js/puzzles/qr-cipher-wheel.js` | Cipher wheel puzzle |
| `public/js/puzzles/qr-jigsaw.js` | Sliding tile puzzle |
| `public/js/puzzles/qr-riddle.js` | 3-stage riddle chain |
| `public/js/puzzles/qr-custom.js` | Runtime loader for designer puzzles |
| `public/js/qr-router.js` | Hash-based QR → puzzle auto-opener |
| `public/js/games-nav.js` | Sticky note nav + torso controller |
| `public/js/auth-gate.js` | Shared auth gate module |
| `public/css/games-hybrid.css` | Paper + CRT hybrid layout |
| `public/css/terminal-polish.css` | CRT overlay reduction + button starfield |
| `public/puzzle-template-blank.js` | LLM-ready puzzle template |
| `public/qr-stickers.html` | Printable QR sticker sheets |
| `docs/qr-puzzle-pipeline.md` | Pipeline technical docs |
| `docs/GAMES-DESIGNER-ROADMAP.md` | Phase roadmap |
| `docs/HYBRID-LAYOUT-SPEC.md` | Paper + CRT design spec |
| `docs/HOME-V2-SPEC.md` | Home terminal hybrid spec (parked) |

### Modified Files
| File | Change |
|------|--------|
| `src/worker/index.ts` | Mounted puzzle routes (auth + public split) |
| `public/index.html` | terminal-polish.css, starfield button injection, LoginShell disabled |
| `public/games.html` | Full hybrid rewrite (was games-v2.html) |
| `public/contact.html` | Full hybrid rewrite (was contact-v2.html) |
| `public/js/main.js` | New boot sequence, nav commands, LoginShell disable |
| `public/js/state-machine.js` | Navigation routes, reorganized HELP text |

### Legacy Fallbacks
| File | Original |
|------|----------|
| `public/games-legacy.html` | Original games.html |
| `public/contact-legacy.html` | Original contact.html |
