-- Uploaded images are published only after an explicit approval request.
ALTER TABLE illustration_jobs ADD COLUMN source TEXT NOT NULL DEFAULT 'api';
ALTER TABLE illustration_jobs ADD COLUMN input_sha256 TEXT;
ALTER TABLE illustration_jobs ADD COLUMN approved_at TEXT;
