-- MCPで再編したSection 1・4・5・20の見出し語順を確定する。
-- 派生語の枝がある場合も、見出し語と同じ番号へまとめて移動する。

CREATE TABLE crossover_reorder_0022 (
  word_id TEXT PRIMARY KEY,
  new_no INTEGER NOT NULL
);

INSERT INTO crossover_reorder_0022 (word_id, new_no) VALUES
  ('do', 1),
  ('sell', 2),
  ('pay', 3),
  ('last', 4),
  ('matter', 5),
  ('exist', 6),
  ('remain', 7),
  ('become', 8),
  ('grow', 9),
  ('turn', 10),
  ('go', 11),
  ('come', 12),
  ('fall', 13),
  ('stay', 14),
  ('look', 15),
  ('seem', 16),
  ('taste', 17),
  ('sound', 18),
  ('prove', 19),
  ('appear', 20),
  ('call', 61),
  ('name', 62),
  ('elect', 63),
  ('appoint', 64),
  ('render', 65),
  ('hold', 66),
  ('paint', 67),
  ('set', 68),
  ('drive', 69),
  ('consider', 70),
  ('deem', 71),
  ('judge', 72),
  ('think', 73),
  ('believe', 74),
  ('suppose', 75),
  ('assume', 76),
  ('perceive', 77),
  ('presume', 78),
  ('declare', 79),
  ('pronounce', 80),
  ('allow', 81),
  ('permit', 82),
  ('enable', 83),
  ('cause', 84),
  ('lead', 85),
  ('encourage', 86),
  ('urge', 87),
  ('advise', 88),
  ('remind', 89),
  ('warn', 90),
  ('force', 91),
  ('oblige', 92),
  ('compel', 93),
  ('order', 94),
  ('beg', 95),
  ('request', 96),
  ('require', 97),
  ('instruct', 98),
  ('want', 99),
  ('expect', 100),
  ('make', 381),
  ('have', 382),
  ('let', 383),
  ('get', 384),
  ('help', 385),
  ('see', 386),
  ('hear', 387),
  ('watch', 388),
  ('notice', 389),
  ('observe', 390),
  ('witness', 391),
  ('feel', 392),
  ('smell', 393),
  ('catch', 394),
  ('find', 395),
  ('discover', 396),
  ('spot', 397),
  ('detect', 398),
  ('keep', 399),
  ('leave', 400);

CREATE TABLE crossover_reorder_items_0022 (
  word_id TEXT PRIMARY KEY,
  new_no INTEGER NOT NULL
);

INSERT INTO crossover_reorder_items_0022 (word_id, new_no)
SELECT child.word_id, mapping.new_no
FROM crossover_reorder_0022 AS mapping
JOIN list_items AS head
  ON head.list_id = 'crossover-v3'
 AND head.word_id = mapping.word_id
 AND head.branch = 0
JOIN list_items AS child
  ON child.list_id = head.list_id
 AND child.no = head.no;

UPDATE list_items
SET no = -(
  SELECT new_no
  FROM crossover_reorder_items_0022
  WHERE word_id = list_items.word_id
)
WHERE list_id = 'crossover-v3'
  AND word_id IN (SELECT word_id FROM crossover_reorder_items_0022);

UPDATE list_items
SET no = (
  SELECT new_no
  FROM crossover_reorder_items_0022
  WHERE word_id = list_items.word_id
)
WHERE list_id = 'crossover-v3'
  AND word_id IN (SELECT word_id FROM crossover_reorder_items_0022);

DROP TABLE crossover_reorder_items_0022;
DROP TABLE crossover_reorder_0022;
