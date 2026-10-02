-- Opaque, opt-in browser authentication. No API keys or bearer tokens are stored.
CREATE TABLE IF NOT EXISTS mcp_oauth_browser_sessions (
  token_hash TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  credential_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_browser_sessions_expiry
  ON mcp_oauth_browser_sessions(expires_at);

-- One-use, ten-minute forms bound to the browser and exact authorization request.
CREATE TABLE IF NOT EXISTS mcp_oauth_browser_forms (
  token_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  context_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_browser_forms_expiry
  ON mcp_oauth_browser_forms(expires_at);
