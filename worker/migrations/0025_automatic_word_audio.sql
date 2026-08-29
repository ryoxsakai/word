-- 発音記号がある見出し語のElevenLabs音声を、定期処理で少量ずつ生成する。
-- 失敗語は再試行時刻を遅らせ、後続語の生成を妨げないようにする。
CREATE TABLE IF NOT EXISTS word_audio_jobs (
  word_id TEXT NOT NULL REFERENCES words(id),
  variant_key TEXT NOT NULL DEFAULT 'primary',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (word_id, variant_key)
);

CREATE INDEX IF NOT EXISTS idx_word_audio_jobs_due
ON word_audio_jobs(status, next_attempt_at, created_at);

-- 移行時点で音声がない、またはIPA変更後で古くなった語をすべて登録する。
INSERT OR IGNORE INTO word_audio_jobs (word_id, variant_key)
SELECT w.id, 'primary'
FROM words w
LEFT JOIN word_audio a
  ON a.word_id = w.id AND a.variant_key = 'primary' AND a.is_stale = 0
WHERE TRIM(COALESCE(w.pronunciation, '')) <> ''
  AND a.word_id IS NULL;

CREATE TRIGGER IF NOT EXISTS enqueue_primary_audio_after_word_insert
AFTER INSERT ON words
WHEN TRIM(COALESCE(NEW.pronunciation, '')) <> ''
BEGIN
  INSERT OR IGNORE INTO word_audio_jobs (word_id, variant_key)
  VALUES (NEW.id, 'primary');
END;

-- 綴りまたはIPAが変わった場合は、以前の失敗回数を捨てて生成し直す。
-- IPAが空になった場合は待ち行列から除外する。
CREATE TRIGGER IF NOT EXISTS refresh_primary_audio_job_after_word_update
AFTER UPDATE OF spelling, pronunciation ON words
WHEN OLD.spelling IS NOT NEW.spelling OR OLD.pronunciation IS NOT NEW.pronunciation
BEGIN
  DELETE FROM word_audio_jobs
  WHERE word_id = NEW.id AND variant_key = 'primary';

  INSERT INTO word_audio_jobs (word_id, variant_key)
  SELECT NEW.id, 'primary'
  WHERE TRIM(COALESCE(NEW.pronunciation, '')) <> '';
END;
