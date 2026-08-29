-- 通常語はElevenLabs標準発音、発音注意語だけIPA辞書を使う方式へ切り替える。
-- 音声と表示IPAの方言を、現在の米国英語音声に合わせる。
UPDATE words SET pronunciation = '/duː/' WHERE id = 'do' AND pronunciation = '/dʉː/';
UPDATE words SET pronunciation = '/ɡoʊ/' WHERE id = 'go' AND pronunciation = '/ɡəʉ/';
UPDATE words SET pronunciation = '/ruːd/' WHERE id = 'rude' AND pronunciation = '/ɹʉːd/';
UPDATE words SET pronunciation = '/duː/' WHERE id = 'due' AND pronunciation = '/dʒʉː/';
UPDATE words SET pronunciation = '/pɑːrt/' WHERE id = 'part' AND pronunciation = '/pɐːt/';
UPDATE words SET pronunciation = '/praɪˈɔːrəti/' WHERE id = 'priority' AND pronunciation = '/pɹaɪˈɒɹɨti/';

-- 旧方式の生成済み音声を公開対象から外す。R2オブジェクトは再生成時に安全に置換する。
UPDATE word_audio
SET is_stale = 1
WHERE variant_key = 'primary'
  AND EXISTS (
    SELECT 1 FROM list_items li
    WHERE li.list_id = 'crossover-v3' AND li.word_id = word_audio.word_id
  );

UPDATE words
SET audio_url = NULL
WHERE EXISTS (
  SELECT 1 FROM list_items li
  WHERE li.list_id = 'crossover-v3' AND li.word_id = words.id
);

DELETE FROM word_audio_jobs
WHERE NOT EXISTS (
  SELECT 1 FROM list_items li
  WHERE li.list_id = 'crossover-v3' AND li.word_id = word_audio_jobs.word_id
);

INSERT INTO word_audio_jobs
  (word_id, variant_key, status, attempts, last_error, next_attempt_at, updated_at)
SELECT w.id, 'primary', 'pending', 0, NULL, unixepoch(), datetime('now')
FROM words w
JOIN list_items li
  ON li.word_id = w.id
 AND li.list_id = 'crossover-v3'
WHERE TRIM(COALESCE(w.pronunciation, '')) <> ''
ON CONFLICT(word_id, variant_key) DO UPDATE SET
  status = 'pending',
  attempts = 0,
  last_error = NULL,
  next_attempt_at = unixepoch(),
  updated_at = datetime('now');
