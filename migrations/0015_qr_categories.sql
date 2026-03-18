-- QR Puzzle Categories — organizes puzzles into sections on /games
-- Each category maps to a collapsible row on the live page.

CREATE TABLE IF NOT EXISTS qr_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  label       TEXT    NOT NULL,            -- Display name: "QR FIELD OPS", "RECON", etc.
  emoji       TEXT    NOT NULL DEFAULT '📁',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'live',  -- live | archived
  created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Seed the default category that existing QR puzzles live in
INSERT INTO qr_categories (slug, label, emoji, sort_order)
VALUES ('qr-field-ops', 'QR FIELD OPS', '📡', 0);

-- Add category_slug to qr_puzzles (nullable; null = uncategorized)
ALTER TABLE qr_puzzles ADD COLUMN category_slug TEXT DEFAULT 'qr-field-ops' REFERENCES qr_categories(slug);

-- Index for category lookups
CREATE INDEX IF NOT EXISTS idx_qr_puzzles_category ON qr_puzzles(category_slug, status);
