-- ElevenLabsなどで生成した音声を、見出し語・発音単位で管理する。
-- variant_keyは当面primaryを使い、同綴異音語の別発音を後から追加できる構造にする。
CREATE TABLE IF NOT EXISTS word_audio (
  word_id TEXT NOT NULL REFERENCES words(id),
  variant_key TEXT NOT NULL DEFAULT 'primary',
  pos TEXT,
  ipa TEXT NOT NULL,
  source_spelling TEXT NOT NULL,
  provider TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'audio/mpeg',
  generated_at TEXT NOT NULL,
  is_stale INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (word_id, variant_key)
);

CREATE INDEX IF NOT EXISTS idx_word_audio_word ON word_audio(word_id);

-- 綴りまたはIPAを直した場合、以前の音声を公開しない。行は再生成時のR2掃除に使うため残す。
CREATE TRIGGER IF NOT EXISTS stale_primary_audio_after_word_pronunciation_update
AFTER UPDATE OF spelling, pronunciation ON words
WHEN OLD.spelling IS NOT NEW.spelling OR OLD.pronunciation IS NOT NEW.pronunciation
BEGIN
  UPDATE word_audio SET is_stale = 1 WHERE word_id = NEW.id AND variant_key = 'primary';
  UPDATE words SET audio_url = NULL WHERE id = NEW.id;
END;
