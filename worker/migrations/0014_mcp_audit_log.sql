-- ChatGPT/MCPから行われた編集操作の監査ログ。
-- 認証情報やアクセストークンは保存せず、操作主体・対象・概要だけを記録する。
CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_created_at
  ON mcp_audit_log(created_at DESC);
