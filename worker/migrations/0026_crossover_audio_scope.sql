-- ElevenLabsの自動生成を現行のcrossover収録語だけに限定する。
-- 生成済み音声は他リストの語でも保持し、未処理ジョブだけを整理する。
DROP TRIGGER IF EXISTS enqueue_primary_audio_after_word_insert;
DROP TRIGGER IF EXISTS refresh_primary_audio_job_after_word_update;

DELETE FROM word_audio_jobs
WHERE NOT EXISTS (
  SELECT 1 FROM list_items li
  WHERE li.list_id = 'crossover-v3'
    AND li.word_id = word_audio_jobs.word_id
);

INSERT OR IGNORE INTO word_audio_jobs (word_id, variant_key)
SELECT w.id, 'primary'
FROM words w
JOIN list_items li
  ON li.word_id = w.id
 AND li.list_id = 'crossover-v3'
LEFT JOIN word_audio a
  ON a.word_id = w.id
 AND a.variant_key = 'primary'
 AND a.is_stale = 0
WHERE TRIM(COALESCE(w.pronunciation, '')) <> ''
  AND a.word_id IS NULL;

CREATE TRIGGER enqueue_primary_audio_after_word_insert
AFTER INSERT ON words
WHEN TRIM(COALESCE(NEW.pronunciation, '')) <> ''
 AND EXISTS (
   SELECT 1 FROM list_items li
   WHERE li.list_id = 'crossover-v3' AND li.word_id = NEW.id
 )
BEGIN
  INSERT OR IGNORE INTO word_audio_jobs (word_id, variant_key)
  VALUES (NEW.id, 'primary');
END;

-- 綴りまたはIPAが変わった場合は、crossover収録語だけ生成し直す。
CREATE TRIGGER refresh_primary_audio_job_after_word_update
AFTER UPDATE OF spelling, pronunciation ON words
WHEN OLD.spelling IS NOT NEW.spelling OR OLD.pronunciation IS NOT NEW.pronunciation
BEGIN
  DELETE FROM word_audio_jobs
  WHERE word_id = NEW.id AND variant_key = 'primary';

  INSERT INTO word_audio_jobs (word_id, variant_key)
  SELECT NEW.id, 'primary'
  WHERE TRIM(COALESCE(NEW.pronunciation, '')) <> ''
    AND EXISTS (
      SELECT 1 FROM list_items li
      WHERE li.list_id = 'crossover-v3' AND li.word_id = NEW.id
    );
END;

-- 既存の見出し語をcrossoverへ追加した時点でも生成対象にする。
CREATE TRIGGER enqueue_primary_audio_after_crossover_insert
AFTER INSERT ON list_items
WHEN NEW.list_id = 'crossover-v3'
BEGIN
  INSERT OR IGNORE INTO word_audio_jobs (word_id, variant_key)
  SELECT w.id, 'primary'
  FROM words w
  WHERE w.id = NEW.word_id
    AND TRIM(COALESCE(w.pronunciation, '')) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM word_audio a
      WHERE a.word_id = w.id
        AND a.variant_key = 'primary'
        AND a.is_stale = 0
    );
END;

-- crossoverから外した語は、未生成ジョブだけを取り除く。
CREATE TRIGGER dequeue_primary_audio_after_crossover_delete
AFTER DELETE ON list_items
WHEN OLD.list_id = 'crossover-v3'
BEGIN
  DELETE FROM word_audio_jobs
  WHERE word_id = OLD.word_id AND variant_key = 'primary';
END;
