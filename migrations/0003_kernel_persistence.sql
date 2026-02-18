-- Kernel persistence for external agent (Decision API)

CREATE TABLE IF NOT EXISTS kernel_agents (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  agent_name TEXT,
  agent_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_connected_at INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, agent_url)
);

CREATE INDEX IF NOT EXISTS idx_kernel_agents_user_id ON kernel_agents(user_id);

CREATE TABLE IF NOT EXISTS kernel_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  kernel_agent_id TEXT,
  status TEXT NOT NULL,
  last_error TEXT,
  connected_at INTEGER,
  disconnected_at INTEGER,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kernel_sessions_user_id ON kernel_sessions(user_id);
