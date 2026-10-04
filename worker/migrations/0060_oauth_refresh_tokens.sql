CREATE TABLE mcp_oauth_refresh_families (
  family_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  issuer TEXT NOT NULL,
  credential_version TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  current_hash TEXT NOT NULL,
  generation INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER
);
CREATE TABLE mcp_oauth_refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES mcp_oauth_refresh_families(family_id) ON DELETE CASCADE,
  generation INTEGER NOT NULL,
  used_at INTEGER,
  UNIQUE (family_id, generation)
);
CREATE INDEX idx_mcp_refresh_expiry ON mcp_oauth_refresh_families(expires_at);
