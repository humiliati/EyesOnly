-- 0011_publish_config.sql
-- Adds published_config snapshot for the M→Ops canonize/publish pipeline.
-- M edits the working `config`; Ops reads from `published_config`.
-- When published_config IS NULL, Ops falls back to `config` (backwards compat).

ALTER TABLE scenarios ADD COLUMN published_config TEXT DEFAULT NULL;
ALTER TABLE scenarios ADD COLUMN published_at INTEGER DEFAULT NULL;
