-- ============================================================
--   EYES ONLY — User Account System Migration v2
--   Username-based accounts with optional email recovery
--   WebAuthn (Passkey) support for passwordless auth
--   All timestamps are Unix epoch milliseconds.
-- ============================================================

-- User accounts table (for persistent player identities)
CREATE TABLE IF NOT EXISTS user_accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email           TEXT UNIQUE COLLATE NOCASE,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  callsign        TEXT NOT NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_login      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  -- Game state
  cryptos         INTEGER NOT NULL DEFAULT 0,

  -- Preferences
  preferences     TEXT NOT NULL DEFAULT '{"theme":"green","sfx_enabled":true,"cloud_sync_enabled":true}'
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_username ON user_accounts(username);
CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email);

-- WebAuthn credentials table (for passkey authentication)
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  credential_id     TEXT NOT NULL UNIQUE,  -- base64url encoded credential ID
  public_key        TEXT NOT NULL,          -- base64url encoded public key
  counter           INTEGER NOT NULL DEFAULT 0,
  transports        TEXT,                    -- JSON array of transports (e.g., ["usb","nfc","ble","internal"])
  device_name       TEXT,                    -- User-friendly device name
  created_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_used_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_cred_id ON webauthn_credentials(credential_id);

-- User auth sessions (for persistent login after WebAuthn)
CREATE TABLE IF NOT EXISTS user_sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token   TEXT NOT NULL UNIQUE,
  user_id         INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  expires_at      INTEGER NOT NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_activity   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

-- User inventory (persistent and loose items)
CREATE TABLE IF NOT EXISTS user_inventory (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  item_id         TEXT NOT NULL,
  item_type       TEXT NOT NULL,  -- "persistent" or "loose"
  quantity        INTEGER NOT NULL DEFAULT 1,
  metadata        TEXT NOT NULL DEFAULT '{}',  -- JSON for item-specific data
  acquired_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_type ON user_inventory(user_id, item_type);

-- User highscores (for leaderboards)
CREATE TABLE IF NOT EXISTS user_highscores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  game_id         TEXT NOT NULL,  -- "gone_rogue", "street_chronicles", "eyesonly_live"
  mode            TEXT NOT NULL,  -- "human" or "agent"
  score           INTEGER NOT NULL,
  metadata        TEXT NOT NULL DEFAULT '{}',  -- JSON for game-specific stats
  achieved_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_user_highscores_user ON user_highscores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_highscores_game ON user_highscores(game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_user_highscores_leaderboard ON user_highscores(game_id, mode, score DESC);

-- Email verification tokens (for optional email verification)
CREATE TABLE IF NOT EXISTS email_tokens (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  purpose         TEXT NOT NULL CHECK (purpose IN ('verify_email', 'recover_account')),
  expires_at      INTEGER NOT NULL,
  used_at         INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_hash ON email_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);
