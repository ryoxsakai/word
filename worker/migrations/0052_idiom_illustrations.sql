-- Independent approved idiom uploads; no paid generation jobs are created.
CREATE TABLE IF NOT EXISTS idiom_illustration_jobs (
  id TEXT PRIMARY KEY,
  idiom_id TEXT NOT NULL REFERENCES idioms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','ready','failed','cancelled')),
  phrase TEXT NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS idiom_illustration_one_active
  ON idiom_illustration_jobs(idiom_id) WHERE status IN ('queued','processing');
CREATE INDEX IF NOT EXISTS idiom_illustration_queue ON idiom_illustration_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idiom_illustration_history ON idiom_illustration_jobs(idiom_id, created_at);

CREATE TABLE IF NOT EXISTS idiom_illustrations (
  idiom_id TEXT PRIMARY KEY REFERENCES idioms(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES idiom_illustration_jobs(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Uploaded images are published only after an explicit approval request.
ALTER TABLE idiom_illustration_jobs ADD COLUMN source TEXT NOT NULL DEFAULT 'api';
ALTER TABLE idiom_illustration_jobs ADD COLUMN input_sha256 TEXT;
ALTER TABLE idiom_illustration_jobs ADD COLUMN approved_at TEXT;
