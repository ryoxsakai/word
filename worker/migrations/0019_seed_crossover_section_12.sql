-- crossover Section 12: intoを伴う変化・分割・統合の動詞
-- 既存の単語マスターを文法・読解中心に整え、20見出し語を5ラベルに分けて収録する。

CREATE TABLE _migration_0019_entries (
  display_order INTEGER NOT NULL,
  spelling TEXT NOT NULL,
  label_order INTEGER NOT NULL,
  label_name TEXT NOT NULL,
  notes TEXT,
  synonyms TEXT,
  irregular_forms TEXT,
  polysemous_caution INTEGER NOT NULL DEFAULT 0,
  conjugation_caution INTEGER NOT NULL DEFAULT 0,
  usage_caution INTEGER NOT NULL DEFAULT 0
);

INSERT INTO _migration_0019_entries
  (display_order, spelling, label_order, label_name, notes, synonyms, irregular_forms,
   polysemous_caution, conjugation_caution, usage_caution)
VALUES
  (1, 'change', 1, '変化・変換',
   'intoは変化後、forは交換相手。第1節のturn、第10節のreplaceも参照。',
   'transform; convert', NULL, 1, 0, 1),
  (2, 'transform', 1, '変化・変換',
   '形・性質を大きく変える語。',
   'change; convert', NULL, 0, 0, 0),
  (3, 'convert', 1, '変化・変換',
   '用途・形式・信念などを別のものに転換する。',
   'change; transform', NULL, 0, 0, 0),
  (4, 'translate', 1, '変化・変換',
   '言語だけでなく、研究成果を実践・利益などへ「つなげる」にも用いる。',
   NULL, NULL, 1, 0, 0),
  (5, 'form', 2, '形成・発達',
   'form A into Bは材料・人などをBの形や集団にまとめる。',
   'shape', NULL, 1, 0, 0),
  (6, 'shape', 2, '形成・発達',
   '人の行動・考えを「形作る」という比喩にも重要。',
   'form', NULL, 1, 0, 0),
  (7, 'develop', 2, '形成・発達',
   'develop a disease（病気を発症する）は医学英文で重要。',
   'grow; evolve', NULL, 1, 0, 1),
  (8, 'evolve', 2, '形成・発達',
   'evolve from A into Bで進化の起点と結果を表す。',
   'develop', NULL, 0, 0, 0),
  (9, 'process', 3, '加工・分割',
   '食品・試料の加工と、情報・データの処理の両方に重要。',
   NULL, NULL, 1, 0, 0),
  (10, 'divide', 3, '加工・分割',
   'intoは分割後の区分、byは割る数を示す。',
   'split; separate', NULL, 1, 0, 1),
  (11, 'split', 3, '加工・分割',
   'divideより「割れる・分裂する」感触が強い。',
   'divide; separate', 'split – split – split', 1, 1, 0),
  (12, 'break', 3, '加工・分割',
   'break A into piecesのほか、break down A into B（AをBに分解する）も重要。',
   NULL, 'break – broke – broken', 1, 1, 0),
  (13, 'cut', 3, '加工・分割',
   'cut A into piecesは切断後の形を示す。',
   NULL, 'cut – cut – cut', 1, 1, 0),
  (14, 'group', 4, '分類・整理',
   'group A into Bは共通点に基づいて分類する。第8節のclassifyも参照。',
   'classify; sort', NULL, 1, 0, 0),
  (15, 'sort', 4, '分類・整理',
   'sort A into Bは種類別に分ける。sort out OはOを整理・解決する。',
   'classify; group', NULL, 1, 0, 0),
  (16, 'organize', 4, '分類・整理',
   'organize A into groupsは秩序立てて群に分ける。',
   'arrange', NULL, 1, 0, 0),
  (17, 'insert', 5, '挿入・統合',
   'insert A into BはAをBの内部へ挿入する。',
   'put', NULL, 0, 0, 0),
  (18, 'inject', 5, '挿入・統合',
   'inject A into B＝AをBに注入する。inject B with Aも同内容。',
   'insert', NULL, 1, 0, 1),
  (19, 'incorporate', 5, '挿入・統合',
   '一部として取り込む語。be incorporated into Bも重要。',
   'integrate; include', NULL, 0, 0, 0),
  (20, 'integrate', 5, '挿入・統合',
   '複数部分を機能する全体へ統合する語。integrate with Bも用いる。',
   'incorporate; combine', NULL, 1, 0, 0);

-- Section 12をChapter 1の末尾に作成する。
INSERT INTO sections (list_id, name, sort_order, subtitle, description, chapter_id)
SELECT
  'crossover-v3',
  'Section 12',
  next_sort,
  '文型 12：intoを伴う変化・分割・統合の動詞',
  'change A into Bのように、intoで変化後・分類先・挿入先を示す動詞を学ぶ。科学・医学英文で重要な発達・加工・統合表現も扱う。',
  (SELECT id FROM chapters WHERE list_id = 'crossover-v3' ORDER BY sort_order, id LIMIT 1)
FROM (
  SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort
  FROM sections
  WHERE list_id = 'crossover-v3'
)
WHERE EXISTS (SELECT 1 FROM lists WHERE id = 'crossover-v3')
  AND NOT EXISTS (
    SELECT 1 FROM sections
    WHERE list_id = 'crossover-v3'
      AND subtitle = '文型 12：intoを伴う変化・分割・統合の動詞'
  );

-- 見出し語の基本情報を、下書きメモを残さず今回の学習目的に合わせて更新する。
UPDATE words AS target
SET notes = (SELECT e.notes FROM _migration_0019_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    synonyms = (SELECT e.synonyms FROM _migration_0019_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    irregular_forms = (SELECT e.irregular_forms FROM _migration_0019_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    polysemous_caution = (SELECT e.polysemous_caution FROM _migration_0019_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    conjugation_caution = (SELECT e.conjugation_caution FROM _migration_0019_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    usage_caution = (SELECT e.usage_caution FROM _migration_0019_entries e WHERE e.spelling = target.spelling COLLATE NOCASE),
    updated_at = datetime('now')
WHERE EXISTS (
  SELECT 1 FROM _migration_0019_entries e WHERE e.spelling = target.spelling COLLATE NOCASE
);

-- 意味を文型中心に並べ替える。基礎的な主要義も残す。
DELETE FROM senses
WHERE word_id IN (
  SELECT w.id FROM words w JOIN _migration_0019_entries e ON e.spelling = w.spelling COLLATE NOCASE
);

CREATE TABLE _migration_0019_senses (
  spelling TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  pos TEXT,
  meaning TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0
);

INSERT INTO _migration_0019_senses (spelling, sort_order, pos, meaning, is_primary) VALUES
  ('change', 0, '他', 'AをBに変える', 1),
  ('change', 1, '自', 'Bに変わる', 0),
  ('change', 2, '他', 'AをBと交換する', 0),
  ('transform', 0, '他', 'AをBに変形させる', 1),
  ('transform', 1, '自', 'Bに変わる', 0),
  ('convert', 0, '他', 'AをBに転換する', 1),
  ('convert', 1, '自', 'Bに転換する', 0),
  ('translate', 0, '他', 'AをBに翻訳する', 1),
  ('translate', 1, '他', 'AをBに変換する', 0),
  ('form', 0, '他', 'AをBに形作る', 1),
  ('form', 1, '自', '形成される', 0),
  ('form', 2, '名', '形・形態', 0),
  ('form', 3, '名', '用紙', 0),
  ('shape', 0, '他', 'AをBに形作る', 1),
  ('shape', 1, '名', '形・状態', 0),
  ('develop', 0, '自', 'Bに発達する', 1),
  ('develop', 1, '他', 'Oを発達させる・開発する', 0),
  ('develop', 2, '他', 'Oを発症する', 0),
  ('evolve', 0, '自', 'Bへ進化する', 1),
  ('evolve', 1, '他', 'Oを発展させる', 0),
  ('process', 0, '他', 'Aを加工してBにする', 1),
  ('process', 1, '他', 'Oを処理する', 0),
  ('process', 2, '名', '過程', 0),
  ('divide', 0, '他', 'AをBに分ける', 1),
  ('divide', 1, '自', '分かれる', 0),
  ('divide', 2, '他', 'Oを割る', 0),
  ('split', 0, '他', 'AをBに分ける', 1),
  ('split', 1, '自', '分裂する', 0),
  ('split', 2, '他', 'Oを分担する', 0),
  ('break', 0, '他', 'AをBに砕く', 1),
  ('break', 1, '他', 'Oを壊す', 0),
  ('break', 2, '自', '壊れる', 0),
  ('cut', 0, '他', 'AをBに切り分ける', 1),
  ('cut', 1, '他', 'Oを切る', 0),
  ('cut', 2, '他', 'Oを削減する', 0),
  ('group', 0, '他', 'AをBに分類する', 1),
  ('group', 1, '名', '集団', 0),
  ('sort', 0, '他', 'AをBに分類する', 1),
  ('sort', 1, '他', 'Oを整理する', 0),
  ('sort', 2, '名', '種類', 0),
  ('organize', 0, '他', 'AをBに整理する', 1),
  ('organize', 1, '他', 'Oを組織する', 0),
  ('organize', 2, '他', 'Oを準備する', 0),
  ('insert', 0, '他', 'AをBに挿入する', 1),
  ('inject', 0, '他', 'AをBに注入する', 1),
  ('inject', 1, '他', 'AにBを注射する', 0),
  ('incorporate', 0, '他', 'AをBに組み入れる', 1),
  ('integrate', 0, '他', 'AをBに統合する', 1),
  ('integrate', 1, '自', 'Bに溶け込む', 0);

INSERT INTO senses (word_id, pos, meaning, pronunciation, is_primary, sort_order)
SELECT w.id, s.pos, s.meaning, NULL, s.is_primary, s.sort_order
FROM _migration_0019_senses s
JOIN words w ON w.spelling = s.spelling COLLATE NOCASE;

-- 内部派生語は、入試読解で優先度の高いものだけに絞る。
DELETE FROM derivatives
WHERE word_id IN (
  SELECT w.id FROM words w JOIN _migration_0019_entries e ON e.spelling = w.spelling COLLATE NOCASE
);

CREATE TABLE _migration_0019_derivatives (
  spelling TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  pos TEXT,
  word TEXT NOT NULL,
  meaning TEXT
);

INSERT INTO _migration_0019_derivatives (spelling, sort_order, pos, word, meaning) VALUES
  ('change', 0, '形', 'unchanged', '変わらない'),
  ('transform', 0, '名', 'transformation', '変形・変換'),
  ('convert', 0, '名', 'conversion', '転換'),
  ('translate', 0, '名', 'translation', '翻訳・変換'),
  ('translate', 1, '名', 'translator', '翻訳者'),
  ('form', 0, '名', 'formation', '形成'),
  ('shape', 0, '他', 'reshape', 'を作り変える'),
  ('develop', 0, '名', 'development', '発達・開発'),
  ('develop', 1, '形', 'developed', '発達した'),
  ('develop', 2, '形', 'developing', '発達中の'),
  ('evolve', 0, '名', 'evolution', '進化'),
  ('evolve', 1, '形', 'evolutionary', '進化の'),
  ('process', 0, '名', 'processing', '処理・加工'),
  ('divide', 0, '名', 'division', '分割・部門'),
  ('break', 0, '名', 'breakdown', '故障・内訳'),
  ('group', 0, '名', 'grouping', '分類・集団'),
  ('organize', 0, '名', 'organization', '組織・整理'),
  ('organize', 1, '形', 'organizational', '組織の'),
  ('insert', 0, '名', 'insertion', '挿入'),
  ('inject', 0, '名', 'injection', '注射・注入'),
  ('incorporate', 0, '名', 'incorporation', '組み入れ'),
  ('integrate', 0, '名', 'integration', '統合'),
  ('integrate', 1, '形', 'integrated', '統合された');

INSERT INTO derivatives (word_id, pos, word, meaning, sort_order)
SELECT w.id, d.pos, d.word, d.meaning, d.sort_order
FROM _migration_0019_derivatives d
JOIN words w ON w.spelling = d.spelling COLLATE NOCASE;

-- 例文欄には、文型と読解で覚えたい表現を短く登録する。
DELETE FROM examples
WHERE word_id IN (
  SELECT w.id FROM words w JOIN _migration_0019_entries e ON e.spelling = w.spelling COLLATE NOCASE
);

CREATE TABLE _migration_0019_examples (
  spelling TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  sentence TEXT NOT NULL,
  translation TEXT NOT NULL
);

INSERT INTO _migration_0019_examples (spelling, sort_order, sentence, translation) VALUES
  ('change', 0, 'change A into B', 'AをBに変える'),
  ('change', 1, 'change into B', 'Bに変わる'),
  ('change', 2, 'change A for B', 'AをBと交換する'),
  ('transform', 0, 'transform A into B', 'AをBに変形させる'),
  ('transform', 1, 'be transformed into B', 'Bへと変形する'),
  ('convert', 0, 'convert A into B', 'AをBに転換する'),
  ('convert', 1, 'convert A from X to Y', 'AをXからYへ変換する'),
  ('translate', 0, 'translate A into B', 'AをBに翻訳する・変換する'),
  ('translate', 1, 'translate findings into practice', '研究結果を実践につなげる'),
  ('form', 0, 'form A into B', 'AをBに形作る'),
  ('form', 1, 'form into B', 'Bを形成する'),
  ('shape', 0, 'shape A into B', 'AをBに形作る'),
  ('shape', 1, 'in shape', '体調・調子がよくて'),
  ('shape', 2, 'out of shape', '体調・調子が悪くて'),
  ('develop', 0, 'develop into B', 'Bへ発達する'),
  ('develop', 1, 'develop a disease', '病気を発症する'),
  ('develop', 2, 'develop resistance to O', 'Oへの耐性を獲得する'),
  ('evolve', 0, 'evolve into B', 'Bへ進化する'),
  ('evolve', 1, 'evolve from A', 'Aから進化する'),
  ('process', 0, 'process A into B', 'Aを加工してBにする'),
  ('process', 1, 'process data', 'データを処理する'),
  ('process', 2, 'the process of Ving', 'Vする過程'),
  ('divide', 0, 'divide A into B', 'AをBに分ける'),
  ('divide', 1, 'be divided into B', 'Bに分けられる'),
  ('divide', 2, 'divide A by B', 'AをBで割る'),
  ('split', 0, 'split A into B', 'AをBに分ける'),
  ('split', 1, 'split the bill', '割り勘にする'),
  ('break', 0, 'break A into pieces', 'Aを粉々に砕く'),
  ('break', 1, 'break down A into B', 'AをBに分解する'),
  ('break', 2, 'break out', '発生する'),
  ('cut', 0, 'cut A into pieces', 'Aを細かく切る'),
  ('cut', 1, 'cut down on O', 'Oを減らす'),
  ('group', 0, 'group A into B', 'AをBに分類する'),
  ('group', 1, 'age group', '年齢層'),
  ('sort', 0, 'sort A into B', 'AをBに分類する'),
  ('sort', 1, 'sort out O', 'Oを整理する・解決する'),
  ('organize', 0, 'organize A into groups', 'Aを複数の集団に整理する'),
  ('insert', 0, 'insert A into B', 'AをBに挿入する'),
  ('inject', 0, 'inject A into B', 'AをBに注入する'),
  ('inject', 1, 'inject B with A', 'BにAを注射・注入する'),
  ('incorporate', 0, 'incorporate A into B', 'AをBに組み入れる'),
  ('incorporate', 1, 'be incorporated into B', 'Bに組み込まれる'),
  ('integrate', 0, 'integrate A into B', 'AをBに統合する'),
  ('integrate', 1, 'integrate with B', 'Bと一体化する');

INSERT INTO examples (word_id, sentence, answer, translation, type, sort_order)
SELECT w.id, x.sentence, NULL, x.translation, 'phrase', x.sort_order
FROM _migration_0019_examples x
JOIN words w ON w.spelling = x.spelling COLLATE NOCASE;

-- 既存の収録元タグを保ちながら、第2講を出典に加える。
INSERT INTO tags (word_id, tag_key, tag_value)
SELECT w.id, 'source_grammar', '文法チェックポイント集・第2講'
FROM words w
JOIN _migration_0019_entries e ON e.spelling = w.spelling COLLATE NOCASE
WHERE 1
ON CONFLICT(word_id, tag_key) DO UPDATE SET tag_value =
  CASE
    WHEN tags.tag_value IS NULL OR tags.tag_value = '' THEN excluded.tag_value
    WHEN instr(tags.tag_value, excluded.tag_value) > 0 THEN tags.tag_value
    ELSE tags.tag_value || '；' || excluded.tag_value
  END;

-- セクション内ラベルを作成する。
INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', s.id, e.label_name, e.label_order
FROM sections s
JOIN _migration_0019_entries e
WHERE s.list_id = 'crossover-v3'
  AND s.subtitle = '文型 12：intoを伴う変化・分割・統合の動詞'
  AND NOT EXISTS (
    SELECT 1 FROM section_labels sl
    WHERE sl.list_id = 'crossover-v3'
      AND sl.section_id = s.id
      AND sl.name = e.label_name
  )
GROUP BY s.id, e.label_order, e.label_name;

-- Section 11の続きの番号で20語を追加し、同時にラベルを割り当てる。
CREATE TABLE _migration_0019_base_no (base_no INTEGER NOT NULL);
INSERT INTO _migration_0019_base_no
SELECT COALESCE(MAX(no), 0) FROM list_items WHERE list_id = 'crossover-v3';

INSERT INTO list_items (list_id, word_id, no, branch, section_id, label_id)
SELECT
  'crossover-v3',
  w.id,
  b.base_no + e.display_order,
  0,
  s.id,
  sl.id
FROM _migration_0019_entries e
JOIN words w ON w.spelling = e.spelling COLLATE NOCASE
JOIN sections s
  ON s.list_id = 'crossover-v3'
 AND s.subtitle = '文型 12：intoを伴う変化・分割・統合の動詞'
JOIN section_labels sl
  ON sl.list_id = 'crossover-v3'
 AND sl.section_id = s.id
 AND sl.name = e.label_name
CROSS JOIN _migration_0019_base_no b
WHERE 1
ON CONFLICT(list_id, word_id) DO UPDATE SET
  no = excluded.no,
  branch = excluded.branch,
  section_id = excluded.section_id,
  label_id = excluded.label_id;

DROP TABLE _migration_0019_base_no;
DROP TABLE _migration_0019_examples;
DROP TABLE _migration_0019_derivatives;
DROP TABLE _migration_0019_senses;
DROP TABLE _migration_0019_entries;
