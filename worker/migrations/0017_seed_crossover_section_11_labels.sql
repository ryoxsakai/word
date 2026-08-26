-- crossover Section 11: A to Bを取る重要動詞
-- ラベルを作成し、見出し語と同じnoを共有する派生語枝もまとめて所属させる。

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 95, '追加・適用', 1
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 95 AND list_id = 'crossover-v3')
  AND NOT EXISTS (SELECT 1 FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '追加・適用');

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 95, '適応・関係・選好', 2
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 95 AND list_id = 'crossover-v3')
  AND NOT EXISTS (SELECT 1 FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '適応・関係・選好');

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 95, '原因・帰属', 3
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 95 AND list_id = 'crossover-v3')
  AND NOT EXISTS (SELECT 1 FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '原因・帰属');

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 95, '専念・委任', 4
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 95 AND list_id = 'crossover-v3')
  AND NOT EXISTS (SELECT 1 FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '専念・委任');

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 95, '接触・影響', 5
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 95 AND list_id = 'crossover-v3')
  AND NOT EXISTS (SELECT 1 FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '接触・影響');

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 95, '割り当て・移動・提出', 6
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 95 AND list_id = 'crossover-v3')
  AND NOT EXISTS (SELECT 1 FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '割り当て・移動・提出');

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 95, '制限', 7
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 95 AND list_id = 'crossover-v3')
  AND NOT EXISTS (SELECT 1 FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '制限');

UPDATE list_items
SET label_id = (SELECT id FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '追加・適用')
WHERE list_id = 'crossover-v3' AND section_id = 95 AND no IN (
  SELECT li.no FROM list_items li JOIN words w ON w.id = li.word_id
  WHERE li.list_id = 'crossover-v3' AND li.section_id = 95 AND w.spelling IN ('add', 'attach', 'apply')
);

UPDATE list_items
SET label_id = (SELECT id FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '適応・関係・選好')
WHERE list_id = 'crossover-v3' AND section_id = 95 AND no IN (
  SELECT li.no FROM list_items li JOIN words w ON w.id = li.word_id
  WHERE li.list_id = 'crossover-v3' AND li.section_id = 95 AND w.spelling IN ('adapt', 'adjust', 'relate', 'introduce', 'prefer')
);

UPDATE list_items
SET label_id = (SELECT id FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '原因・帰属')
WHERE list_id = 'crossover-v3' AND section_id = 95 AND no IN (
  SELECT li.no FROM list_items li JOIN words w ON w.id = li.word_id
  WHERE li.list_id = 'crossover-v3' AND li.section_id = 95 AND w.spelling IN ('attribute')
);

UPDATE list_items
SET label_id = (SELECT id FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '専念・委任')
WHERE list_id = 'crossover-v3' AND section_id = 95 AND no IN (
  SELECT li.no FROM list_items li JOIN words w ON w.id = li.word_id
  WHERE li.list_id = 'crossover-v3' AND li.section_id = 95 AND w.spelling IN ('devote', 'dedicate', 'commit')
);

UPDATE list_items
SET label_id = (SELECT id FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '接触・影響')
WHERE list_id = 'crossover-v3' AND section_id = 95 AND no IN (
  SELECT li.no FROM list_items li JOIN words w ON w.id = li.word_id
  WHERE li.list_id = 'crossover-v3' AND li.section_id = 95 AND w.spelling IN ('expose', 'subject')
);

UPDATE list_items
SET label_id = (SELECT id FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '割り当て・移動・提出')
WHERE list_id = 'crossover-v3' AND section_id = 95 AND no IN (
  SELECT li.no FROM list_items li JOIN words w ON w.id = li.word_id
  WHERE li.list_id = 'crossover-v3' AND li.section_id = 95 AND w.spelling IN ('assign', 'allocate', 'transfer', 'submit')
);

UPDATE list_items
SET label_id = (SELECT id FROM section_labels WHERE list_id = 'crossover-v3' AND section_id = 95 AND name = '制限')
WHERE list_id = 'crossover-v3' AND section_id = 95 AND no IN (
  SELECT li.no FROM list_items li JOIN words w ON w.id = li.word_id
  WHERE li.list_id = 'crossover-v3' AND li.section_id = 95 AND w.spelling IN ('restrict', 'limit')
);
