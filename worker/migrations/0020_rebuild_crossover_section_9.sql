-- crossover Section 9: A for Bを取る重要動詞
-- 旧Section 9のof/from群はSection 13へ保持し、for群20語を4ラベルで再構成する。

CREATE TABLE _migration_0020_entries (
  display_order INTEGER NOT NULL,
  spelling TEXT NOT NULL,
  label_order INTEGER NOT NULL,
  label_name TEXT NOT NULL,
  notes TEXT,
  synonyms TEXT,
  antonyms TEXT,
  irregular_forms TEXT,
  polysemous_caution INTEGER NOT NULL DEFAULT 0,
  conjugation_caution INTEGER NOT NULL DEFAULT 0,
  usage_caution INTEGER NOT NULL DEFAULT 0
);

INSERT INTO _migration_0020_entries
  (display_order, spelling, label_order, label_name, notes, synonyms, antonyms,
   irregular_forms, polysemous_caution, conjugation_caution, usage_caution)
VALUES
  (1, 'mistake', 1, '誤認・許し',
   'mistake A for Bでは、Aが実物、Bが誤って思い込んだもの。',
   'confuse', NULL, 'mistake–mistook–mistaken', 1, 1, 1),
  (2, 'forgive', 1, '誤認・許し',
   '人を直接目的語にし、理由をforで示す。',
   'excuse' || char(59) || ' pardon', NULL, 'forgive–forgave–forgiven', 1, 1, 1),
  (3, 'excuse', 1, '誤認・許し',
   'forgiveより軽い過失を大目に見る場面で用いることが多い。',
   'forgive' || char(59) || ' pardon', NULL, NULL, 1, 0, 1),
  (4, 'pardon', 1, '誤認・許し',
   '改まった語。Pardon me.やI beg your pardon.も重要。',
   'forgive' || char(59) || ' excuse', NULL, NULL, 1, 0, 1),
  (5, 'blame', 2, '非難・評価・賞罰・感謝',
   'blame A for Bとblame B on AではAとBの位置が逆になる。',
   'criticize', 'praise', NULL, 1, 0, 1),
  (6, 'criticize', 2, '非難・評価・賞罰・感謝',
   'criticize A for Bで、批判される相手と理由を分けて表す。criticalは別項目で扱う。',
   'blame', 'praise', NULL, 1, 0, 1),
  (7, 'scold', 2, '非難・評価・賞罰・感謝',
   '人を目的語にし、叱る理由をforで示す。',
   'rebuke', NULL, NULL, 1, 0, 1),
  (8, 'praise', 2, '非難・評価・賞罰・感謝',
   '人や行為を褒める理由をforで示す。',
   'admire', 'blame' || char(59) || ' criticize', NULL, 1, 0, 1),
  (9, 'admire', 2, '非難・評価・賞罰・感謝',
   '能力・行為などへの称賛の理由をforで示す。',
   'respect' || char(59) || ' praise', NULL, NULL, 1, 0, 1),
  (10, 'punish', 2, '非難・評価・賞罰・感謝',
   '人を目的語にし、罰する理由をforで示す。',
   NULL, 'reward', NULL, 1, 0, 1),
  (11, 'fine', 2, '非難・評価・賞罰・感謝',
   '動詞では「罰金を科す」。形容詞の「良好な」「細かい」も読解で重要。',
   NULL, NULL, NULL, 1, 0, 1),
  (12, 'reward', 2, '非難・評価・賞罰・感謝',
   'reward A for Bは理由、reward A with Bは与える褒美を示す。',
   NULL, 'punish', NULL, 1, 0, 1),
  (13, 'thank', 2, '非難・評価・賞罰・感謝',
   'thankは人を直接目的語にする。appreciateは事柄を目的語にする。',
   'appreciate', NULL, NULL, 1, 0, 1),
  (14, 'exchange', 3, '交換・代用',
   'exchange A for BではAを手放してBを得る。',
   'trade' || char(59) || ' swap', NULL, NULL, 1, 0, 1),
  (15, 'trade', 3, '交換・代用',
   '交換のほか、名詞の「貿易・取引」も基本義。',
   'exchange' || char(59) || ' swap', NULL, NULL, 1, 0, 1),
  (16, 'swap', 3, '交換・代用',
   'exchangeより口語的。swap A for Bとswap A with Bの両方を取る。',
   'exchange' || char(59) || ' trade', NULL, NULL, 1, 0, 1),
  (17, 'substitute', 3, '交換・代用',
   'substitute A for BではAが新しい代用品。第10節のreplace B with Aと語順を対照する。',
   'replace', NULL, NULL, 1, 0, 1),
  (18, 'compensate', 4, '補償・資格・捜索',
   'compensate A for Bは人への補償、compensate for Oは不足などの埋め合わせ。',
   'make up for O', NULL, NULL, 1, 0, 1),
  (19, 'qualify', 4, '補償・資格・捜索',
   'qualify A for BはAに資格を与え、qualify for Bは自分が資格を得る。',
   'entitle', 'disqualify', NULL, 1, 0, 1),
  (20, 'search', 4, '補償・資格・捜索',
   'search A for BではAが捜す場所、Bが捜し物。search for Bとの違いに注意。',
   'look for O' || char(59) || ' seek', NULL, NULL, 1, 0, 1);

-- 単語マスターにない2語を作る。
INSERT INTO words
  (id, spelling, pronunciation, etymology, notes, synonyms, antonyms, irregular_forms,
   pronunciation_caution, accent_caution, polysemous_caution, spelling_caution,
   conjugation_caution, usage_caution)
SELECT
  e.spelling, e.spelling, NULL, NULL, e.notes, e.synonyms, e.antonyms, e.irregular_forms,
  0, 0, e.polysemous_caution, 0, e.conjugation_caution, e.usage_caution
FROM _migration_0020_entries e
WHERE e.spelling IN ('pardon', 'swap')
  AND NOT EXISTS (SELECT 1 FROM words w WHERE w.spelling = e.spelling COLLATE NOCASE);

-- Section 13を受け皿として作り、旧Section 9のof/from群を失わずに移す。
INSERT INTO sections (list_id, name, sort_order, subtitle, description, chapter_id)
SELECT
  'crossover-v3',
  'Section 13',
  13,
  '文型 13：A of B・A from Bを取る重要動詞',
  '人と情報・判断・所有・除去の関係をofで、起源・分離・区別をfromで表す重要動詞を整理する。',
  (SELECT id FROM chapters WHERE list_id = 'crossover-v3' ORDER BY sort_order, id LIMIT 1)
WHERE EXISTS (SELECT 1 FROM lists WHERE id = 'crossover-v3')
  AND NOT EXISTS (
    SELECT 1 FROM sections
    WHERE list_id = 'crossover-v3'
      AND subtitle = '文型 13：A of B・A from Bを取る重要動詞'
  );

-- 旧ラベル参照を外し、of/from群とその枝を一時番号へ退避する。
UPDATE list_items
SET label_id = NULL
WHERE list_id = 'crossover-v3' AND section_id = 93;

CREATE TABLE _migration_0020_moved (
  display_order INTEGER NOT NULL,
  spelling TEXT NOT NULL
);

INSERT INTO _migration_0020_moved (display_order, spelling) VALUES
  (1, 'inform'),
  (2, 'notify'),
  (3, 'convince'),
  (4, 'assure'),
  (5, 'accuse'),
  (6, 'rob'),
  (7, 'deprive'),
  (8, 'cure'),
  (9, 'rid'),
  (10, 'relieve'),
  (11, 'distinguish'),
  (12, 'separate');

UPDATE list_items
SET no = no + 10000,
    section_id = (
      SELECT id FROM sections
      WHERE list_id = 'crossover-v3'
        AND subtitle = '文型 13：A of B・A from Bを取る重要動詞'
      LIMIT 1
    ),
    label_id = NULL
WHERE list_id = 'crossover-v3'
  AND no IN (
    SELECT li.no
    FROM list_items li
    JOIN words w ON w.id = li.word_id
    JOIN _migration_0020_moved m ON m.spelling = w.spelling COLLATE NOCASE
    WHERE li.list_id = 'crossover-v3' AND li.section_id = 93
  );

UPDATE list_items AS target
SET no = 240 + (
      SELECT m.display_order
      FROM _migration_0020_moved m
      JOIN words w ON w.spelling = m.spelling COLLATE NOCASE
      JOIN list_items parent
        ON parent.list_id = 'crossover-v3'
       AND parent.word_id = w.id
      WHERE parent.no = target.no AND parent.branch = 0
    )
WHERE target.list_id = 'crossover-v3'
  AND target.no >= 10000
  AND target.section_id = (
    SELECT id FROM sections
    WHERE list_id = 'crossover-v3'
      AND subtitle = '文型 13：A of B・A from Bを取る重要動詞'
    LIMIT 1
  );

-- Section 9の見出しと説明を確定版へ変更する。
UPDATE sections
SET subtitle = '文型 9：A for Bを取る重要動詞',
    description = '誤認・許し、非難・評価・賞罰・感謝、交換・代用、補償・資格・捜索を表すA for B型の重要動詞を整理する。forの前後に置かれるAとBの役割を、類似表現との対照で学ぶ。'
WHERE id = 93 AND list_id = 'crossover-v3';

DELETE FROM section_labels
WHERE list_id = 'crossover-v3' AND section_id = 93;

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 93, '誤認・許し', 1
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 93 AND list_id = 'crossover-v3');

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 93, '非難・評価・賞罰・感謝', 2
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 93 AND list_id = 'crossover-v3');

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 93, '交換・代用', 3
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 93 AND list_id = 'crossover-v3');

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', 93, '補償・資格・捜索', 4
WHERE EXISTS (SELECT 1 FROM sections WHERE id = 93 AND list_id = 'crossover-v3');

-- 20語のマスターレコードを文法・読解用に整える。
UPDATE words AS target
SET notes = (SELECT e.notes FROM _migration_0020_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    synonyms = (SELECT e.synonyms FROM _migration_0020_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    antonyms = (SELECT e.antonyms FROM _migration_0020_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    irregular_forms = (SELECT e.irregular_forms FROM _migration_0020_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    polysemous_caution = (SELECT e.polysemous_caution FROM _migration_0020_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    conjugation_caution = (SELECT e.conjugation_caution FROM _migration_0020_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    usage_caution = (SELECT e.usage_caution FROM _migration_0020_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    updated_at = datetime('now')
WHERE EXISTS (
  SELECT 1 FROM _migration_0020_entries e WHERE e.spelling = target.spelling COLLATE NOCASE
);

-- 既存辞書取り込みで誤っていた発音記号を修正する。
UPDATE words SET pronunciation = '/faɪn/' WHERE spelling = 'fine' COLLATE NOCASE;
UPDATE words SET pronunciation = '/θæŋk/' WHERE spelling = 'thank' COLLATE NOCASE;

DELETE FROM senses
WHERE word_id IN (
  SELECT w.id FROM words w JOIN _migration_0020_entries e ON e.spelling = w.spelling COLLATE NOCASE
);

CREATE TABLE _migration_0020_senses (
  spelling TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  pos TEXT,
  meaning TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0
);

INSERT INTO _migration_0020_senses (spelling, sort_order, pos, meaning, is_primary) VALUES
  ('mistake', 0, '他', 'AをBと間違える', 1),
  ('mistake', 1, '名', '間違い', 0),
  ('forgive', 0, '他', 'AをBのことで許す', 1),
  ('forgive', 1, '他', 'Oを許す', 0),
  ('excuse', 0, '他', 'AをBのことで許す', 1),
  ('excuse', 1, '他', 'Oを大目に見る', 0),
  ('pardon', 0, '他', 'AをBのことで許す', 1),
  ('pardon', 1, '他', 'Oを許す', 0),
  ('pardon', 2, '名', '許し', 0),
  ('blame', 0, '他', 'AをBのことで責める', 1),
  ('blame', 1, '他', 'Oを非難する', 0),
  ('criticize', 0, '他', 'AをBのことで批判する', 1),
  ('criticize', 1, '他', 'Oを批判する', 0),
  ('scold', 0, '他', 'AをBのことで叱る', 1),
  ('scold', 1, '他', 'Oを叱る', 0),
  ('praise', 0, '他', 'AをBのことで褒める', 1),
  ('praise', 1, '他', 'Oを賞賛する', 0),
  ('admire', 0, '他', 'AをBのことで称賛する', 1),
  ('admire', 1, '他', 'Oに感心する', 0),
  ('punish', 0, '他', 'AをBのことで罰する', 1),
  ('punish', 1, '他', 'Oを罰する', 0),
  ('fine', 0, '他', 'AにBのことで罰金を科す', 1),
  ('fine', 1, '名', '罰金', 0),
  ('fine', 2, '形', '良好な', 0),
  ('fine', 3, '形', '細かい', 0),
  ('reward', 0, '他', 'AにBのことで報いる', 1),
  ('reward', 1, '名', '報酬', 0),
  ('thank', 0, '他', 'AにBのことで感謝する', 1),
  ('thank', 1, '他', 'Oに感謝する', 0),
  ('exchange', 0, '他', 'AをBと交換する', 1),
  ('exchange', 1, '名', '交換', 0),
  ('trade', 0, '他', 'AをBと交換する', 1),
  ('trade', 1, '自', '取引する', 0),
  ('trade', 2, '名', '貿易・取引', 0),
  ('swap', 0, '他', 'AをBと交換する', 1),
  ('swap', 1, '名', '交換', 0),
  ('substitute', 0, '他', 'AをBの代わりに使う', 1),
  ('substitute', 1, '自', 'Bの代理をする', 0),
  ('substitute', 2, '名', '代用品', 0),
  ('compensate', 0, '他', 'AにBのことで補償する', 1),
  ('compensate', 1, '自', 'Bを埋め合わせる', 0),
  ('qualify', 0, '他', 'AにBの資格を与える', 1),
  ('qualify', 1, '自', 'Bの資格を得る', 0),
  ('qualify', 2, '自', '条件を満たす', 0),
  ('search', 0, '他', 'Bを求めてAを捜索する', 1),
  ('search', 1, '自', 'Bを探す', 0),
  ('search', 2, '他', 'Oを捜索する', 0);

INSERT INTO senses (word_id, pos, meaning, pronunciation, is_primary, sort_order)
SELECT w.id, s.pos, s.meaning, NULL, s.is_primary, s.sort_order
FROM _migration_0020_senses s
JOIN words w ON w.spelling = s.spelling COLLATE NOCASE;

DELETE FROM derivatives
WHERE word_id IN (
  SELECT w.id FROM words w JOIN _migration_0020_entries e ON e.spelling = w.spelling COLLATE NOCASE
);

CREATE TABLE _migration_0020_derivatives (
  spelling TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  pos TEXT,
  word TEXT NOT NULL,
  meaning TEXT
);

INSERT INTO _migration_0020_derivatives (spelling, sort_order, pos, word, meaning) VALUES
  ('forgive', 0, '名', 'forgiveness', '許し'),
  ('forgive', 1, '形', 'forgiving', '寛容な'),
  ('criticize', 0, '名', 'criticism', '批判'),
  ('criticize', 1, '名', 'critic', '批評家'),
  ('admire', 0, '名', 'admiration', '賞賛'),
  ('punish', 0, '名', 'punishment', '罰'),
  ('thank', 0, '形', 'thankful', '感謝して'),
  ('substitute', 0, '名', 'substitution', '代用'),
  ('compensate', 0, '名', 'compensation', '補償'),
  ('qualify', 0, '名', 'qualification', '資格'),
  ('qualify', 1, '形', 'qualified', '資格のある'),
  ('qualify', 2, '他', 'disqualify', 'Oを失格させる');

INSERT INTO derivatives (word_id, pos, word, meaning, sort_order)
SELECT w.id, d.pos, d.word, d.meaning, d.sort_order
FROM _migration_0020_derivatives d
JOIN words w ON w.spelling = d.spelling COLLATE NOCASE;

DELETE FROM examples
WHERE word_id IN (
  SELECT w.id FROM words w JOIN _migration_0020_entries e ON e.spelling = w.spelling COLLATE NOCASE
);

CREATE TABLE _migration_0020_examples (
  spelling TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  sentence TEXT NOT NULL,
  translation TEXT NOT NULL
);

INSERT INTO _migration_0020_examples (spelling, sort_order, sentence, translation) VALUES
  ('mistake', 0, 'mistake A for B', 'AをBと間違える'),
  ('mistake', 1, 'be mistaken for B', 'Bと間違えられる'),
  ('mistake', 2, 'by mistake', '間違って'),
  ('forgive', 0, 'forgive A for B', 'AをBのことで許す'),
  ('forgive', 1, 'forgive A for doing', 'AがVしたことを許す'),
  ('excuse', 0, 'excuse A for B', 'AをBのことで許す'),
  ('excuse', 1, 'excuse A for doing', 'AがVしたことを許す'),
  ('excuse', 2, 'Excuse me for doing.', 'Vして申し訳ありません'),
  ('pardon', 0, 'pardon A for B', 'AをBのことで許す'),
  ('pardon', 1, 'Pardon me.', '失礼しました・もう一度お願いします'),
  ('pardon', 2, 'I beg your pardon.', '申し訳ありません・何とおっしゃいましたか'),
  ('blame', 0, 'blame A for B', 'AをBのことで責める'),
  ('blame', 1, 'blame B on A', 'BをAのせいにする'),
  ('blame', 2, 'be to blame for B', 'Bの責任がある'),
  ('criticize', 0, 'criticize A for B', 'AをBのことで批判する'),
  ('criticize', 1, 'criticize A for doing', 'AがVしたことを批判する'),
  ('scold', 0, 'scold A for B', 'AをBのことで叱る'),
  ('scold', 1, 'scold A for doing', 'AがVしたことを叱る'),
  ('praise', 0, 'praise A for B', 'AをBのことで褒める'),
  ('praise', 1, 'praise A for doing', 'AがVしたことを褒める'),
  ('admire', 0, 'admire A for B', 'AをBのことで称賛する'),
  ('admire', 1, 'admire A for doing', 'AがVしたことを称賛する'),
  ('punish', 0, 'punish A for B', 'AをBのことで罰する'),
  ('punish', 1, 'punish A for doing', 'AがVしたことを罰する'),
  ('fine', 0, 'fine A for B', 'AにBのことで罰金を科す'),
  ('fine', 1, 'fine A for doing', 'AにVしたことで罰金を科す'),
  ('fine', 2, 'fine particles', '微粒子'),
  ('reward', 0, 'reward A for B', 'AにBのことで報いる'),
  ('reward', 1, 'reward A for doing', 'AがVしたことに報いる'),
  ('reward', 2, 'reward A with B', 'AにBを褒美として与える'),
  ('thank', 0, 'thank A for B', 'AにBのことで感謝する'),
  ('thank', 1, 'thank A for doing', 'AがVしたことに感謝する'),
  ('exchange', 0, 'exchange A for B', 'AをBと交換する'),
  ('exchange', 1, 'exchange A with B', 'AとBを交換する'),
  ('exchange', 2, 'in exchange for O', 'Oと引き換えに'),
  ('trade', 0, 'trade A for B', 'AをBと交換する'),
  ('trade', 1, 'trade with A', 'Aと取引する'),
  ('trade', 2, 'trade in B', 'Bを商う'),
  ('swap', 0, 'swap A for B', 'AをBと交換する'),
  ('swap', 1, 'swap A with B', 'AとBを交換する'),
  ('substitute', 0, 'substitute A for B', 'AをBの代わりに使う'),
  ('substitute', 1, 'substitute for B', 'Bの代理をする'),
  ('compensate', 0, 'compensate A for B', 'AにBのことで補償する'),
  ('compensate', 1, 'compensate for O', 'Oを埋め合わせる'),
  ('qualify', 0, 'qualify A for B', 'AにBの資格を与える'),
  ('qualify', 1, 'qualify for B', 'Bの資格を得る'),
  ('qualify', 2, 'be qualified for B', 'Bの資格がある'),
  ('search', 0, 'search A for B', 'Bを求めてAを捜索する'),
  ('search', 1, 'search for B', 'Bを探す'),
  ('search', 2, 'in search of B', 'Bを求めて');

INSERT INTO examples (word_id, sentence, answer, translation, type, sort_order)
SELECT w.id, x.sentence, NULL, x.translation, 'phrase', x.sort_order
FROM _migration_0020_examples x
JOIN words w ON w.spelling = x.spelling COLLATE NOCASE;

INSERT INTO tags (word_id, tag_key, tag_value)
SELECT w.id, 'source_grammar', '文法チェックポイント集・第2講'
FROM words w
JOIN _migration_0020_entries e ON e.spelling = w.spelling COLLATE NOCASE
WHERE 1
ON CONFLICT(word_id, tag_key) DO UPDATE SET tag_value =
  CASE
    WHEN tags.tag_value IS NULL OR tags.tag_value = '' THEN excluded.tag_value
    WHEN instr(tags.tag_value, excluded.tag_value) > 0 THEN tags.tag_value
    ELSE tags.tag_value || '；' || excluded.tag_value
  END;

-- Section 9の所定位置へ20語を配置し、ラベルを割り当てる。
-- 既存8語も一時番号へ退避し、並べ替え時の通し番号衝突を避ける。
UPDATE list_items
SET no = no + 20000
WHERE list_id = 'crossover-v3' AND section_id = 93;

INSERT INTO list_items (list_id, word_id, no, branch, section_id, label_id)
SELECT
  'crossover-v3',
  w.id,
  160 + e.display_order,
  0,
  93,
  sl.id
FROM _migration_0020_entries e
JOIN words w ON w.spelling = e.spelling COLLATE NOCASE
JOIN section_labels sl
  ON sl.list_id = 'crossover-v3'
 AND sl.section_id = 93
 AND sl.name = e.label_name
WHERE 1
ON CONFLICT(list_id, word_id) DO UPDATE SET
  no = excluded.no,
  branch = excluded.branch,
  section_id = excluded.section_id,
  label_id = excluded.label_id;

DROP TABLE _migration_0020_examples;
DROP TABLE _migration_0020_derivatives;
DROP TABLE _migration_0020_senses;
DROP TABLE _migration_0020_moved;
DROP TABLE _migration_0020_entries;
