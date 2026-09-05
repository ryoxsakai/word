-- Generation is opt-in. No jobs are inserted by this migration.
CREATE TABLE IF NOT EXISTS illustration_briefs (
  word_id TEXT PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  pos TEXT NOT NULL,
  meaning TEXT NOT NULL,
  scene TEXT NOT NULL DEFAULT '',
  avoid TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS illustration_jobs (
  id TEXT PRIMARY KEY,
  word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','ready','failed','cancelled')),
  spelling TEXT NOT NULL,
  pos TEXT NOT NULL,
  meaning TEXT NOT NULL,
  scene TEXT NOT NULL,
  avoid TEXT NOT NULL,
  prompt TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  reference_paths TEXT NOT NULL,
  model TEXT NOT NULL,
  quality TEXT NOT NULL,
  object_key TEXT,
  usage_json TEXT,
  provider_request_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS illustration_one_active_per_word
  ON illustration_jobs(word_id) WHERE status IN ('queued','processing');
CREATE INDEX IF NOT EXISTS illustration_queue ON illustration_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS illustration_history ON illustration_jobs(word_id, created_at);

CREATE TABLE IF NOT EXISTS word_illustrations (
  word_id TEXT PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES illustration_jobs(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
