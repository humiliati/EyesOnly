-- QR Puzzle Designer — stores designer-created puzzles
-- Each row = one puzzle that gets a QR code and goes live on /games

CREATE TABLE IF NOT EXISTS qr_puzzles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL DEFAULT 1,
  slug        TEXT    NOT NULL UNIQUE,          -- URL-safe key, e.g. 'cafe-cipher-01'
  title       TEXT    NOT NULL,                 -- Display title in the popup header
  description TEXT    NOT NULL DEFAULT '',       -- One-liner for the field kit list
  emoji       TEXT    NOT NULL DEFAULT '🔐',    -- Thumbnail emoji for list item
  tag         TEXT    NOT NULL DEFAULT 'PUZZLE', -- Tag label (CIPHER, VISUAL, RIDDLE, etc.)
  tag_class   TEXT    NOT NULL DEFAULT 'games-tag-narrative', -- CSS class for tag color

  -- The puzzle itself: self-contained JS that calls PuzzlePopup.register()
  -- This is the raw JS code the designer provides (or Grok generates)
  puzzle_js   TEXT    NOT NULL,

  -- Treasure hunt chain: where does this puzzle point?
  -- next_slug is the slug of the next puzzle in the chain (null = terminal)
  -- prev_slug is set automatically when a puzzle links to this one
  chain_order INTEGER DEFAULT 0,               -- Position in the hunt chain
  next_slug   TEXT    DEFAULT NULL,             -- Slug of next puzzle (null = end)
  prev_slug   TEXT    DEFAULT NULL,             -- Slug of previous puzzle (null = start)

  -- QR code metadata
  qr_url      TEXT    DEFAULT NULL,             -- Full URL: https://flapsandseals.com/games#slug
  qr_image    TEXT    DEFAULT NULL,             -- Base64 PNG of generated QR code

  -- Status
  status      TEXT    NOT NULL DEFAULT 'draft', -- draft | live | archived
  created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  FOREIGN KEY (scenario_id) REFERENCES scenarios(id)
);

-- Index for fast lookup by slug (used by the runtime loader)
CREATE INDEX IF NOT EXISTS idx_qr_puzzles_slug ON qr_puzzles(slug);
CREATE INDEX IF NOT EXISTS idx_qr_puzzles_scenario ON qr_puzzles(scenario_id, status);
