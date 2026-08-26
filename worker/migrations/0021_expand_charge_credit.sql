-- charge の重要な名詞語義と credit の受動表現を補う。
-- 既存の語義・例文は保持し、同じ内容がある場合は追加しない。

INSERT INTO senses (word_id, pos, meaning, pronunciation, is_primary, sort_order)
SELECT 'charge', '名', '責任', NULL, 0,
       COALESCE((SELECT MAX(sort_order) + 1 FROM senses WHERE word_id = 'charge'), 0)
WHERE EXISTS (SELECT 1 FROM words WHERE id = 'charge')
  AND NOT EXISTS (
    SELECT 1 FROM senses WHERE word_id = 'charge' AND pos = '名' AND meaning = '責任'
  );

INSERT INTO senses (word_id, pos, meaning, pronunciation, is_primary, sort_order)
SELECT 'charge', '名', '料金', NULL, 0,
       COALESCE((SELECT MAX(sort_order) + 1 FROM senses WHERE word_id = 'charge'), 0)
WHERE EXISTS (SELECT 1 FROM words WHERE id = 'charge')
  AND NOT EXISTS (
    SELECT 1 FROM senses WHERE word_id = 'charge' AND pos = '名' AND meaning = '料金'
  );

INSERT INTO senses (word_id, pos, meaning, pronunciation, is_primary, sort_order)
SELECT 'charge', '名', '告発', NULL, 0,
       COALESCE((SELECT MAX(sort_order) + 1 FROM senses WHERE word_id = 'charge'), 0)
WHERE EXISTS (SELECT 1 FROM words WHERE id = 'charge')
  AND NOT EXISTS (
    SELECT 1 FROM senses WHERE word_id = 'charge' AND pos = '名' AND meaning = '告発'
  );

INSERT INTO senses (word_id, pos, meaning, pronunciation, is_primary, sort_order)
SELECT 'charge', '名', '電荷', NULL, 0,
       COALESCE((SELECT MAX(sort_order) + 1 FROM senses WHERE word_id = 'charge'), 0)
WHERE EXISTS (SELECT 1 FROM words WHERE id = 'charge')
  AND NOT EXISTS (
    SELECT 1 FROM senses WHERE word_id = 'charge' AND pos = '名' AND meaning = '電荷'
  );

INSERT INTO examples (word_id, sentence, answer, translation, type, sort_order)
SELECT 'credit', 'be credited with A', NULL, 'Aをもたらしたと評価される', 'phrase',
       COALESCE((SELECT MAX(sort_order) + 1 FROM examples WHERE word_id = 'credit'), 0)
WHERE EXISTS (SELECT 1 FROM words WHERE id = 'credit')
  AND NOT EXISTS (
    SELECT 1 FROM examples WHERE word_id = 'credit' AND sentence = 'be credited with A'
  );

UPDATE words
SET updated_at = datetime('now')
WHERE id IN ('charge', 'credit');
