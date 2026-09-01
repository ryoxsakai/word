-- ChapterとSectionの間に、目次用のGroup階層を追加する。
-- Groupは閲覧本文の帯には使わず、目次内でSectionをまとめるためだけに使用する。

CREATE TABLE IF NOT EXISTS section_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id TEXT NOT NULL REFERENCES lists(id),
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  subtitle TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_section_groups_list ON section_groups(list_id);
CREATE INDEX IF NOT EXISTS idx_section_groups_chapter ON section_groups(chapter_id);

ALTER TABLE sections ADD COLUMN group_id INTEGER REFERENCES section_groups(id);

CREATE INDEX IF NOT EXISTS idx_sections_group ON sections(group_id);

-- crossover Chapter 1のGroupを作成する。
INSERT INTO section_groups (list_id, chapter_id, subtitle, description, sort_order)
SELECT 'crossover-v3', c.id, '尺度・評価', '重要度、数量、性質、判断、特性を表す語彙', 1
FROM chapters c
WHERE c.list_id = 'crossover-v3' AND c.sort_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM section_groups g
    WHERE g.list_id = c.list_id AND g.chapter_id = c.id AND g.subtitle = '尺度・評価'
  );

INSERT INTO section_groups (list_id, chapter_id, subtitle, description, sort_order)
SELECT 'crossover-v3', c.id, '状態・動作', '時間・空間、変化、動作、行為、生産、達成を表す語彙', 2
FROM chapters c
WHERE c.list_id = 'crossover-v3' AND c.sort_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM section_groups g
    WHERE g.list_id = c.list_id AND g.chapter_id = c.id AND g.subtitle = '状態・動作'
  );

INSERT INTO section_groups (list_id, chapter_id, subtitle, description, sort_order)
SELECT 'crossover-v3', c.id, '思考・表現', '論理、思考、学習、研究、情報、伝達、表現に関する語彙', 3
FROM chapters c
WHERE c.list_id = 'crossover-v3' AND c.sort_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM section_groups g
    WHERE g.list_id = c.list_id AND g.chapter_id = c.id AND g.subtitle = '思考・表現'
  );

INSERT INTO section_groups (list_id, chapter_id, subtitle, description, sort_order)
SELECT 'crossover-v3', c.id, '科学・生命', '科学、物質、生物、環境、身体、医療に関する語彙', 4
FROM chapters c
WHERE c.list_id = 'crossover-v3' AND c.sort_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM section_groups g
    WHERE g.list_id = c.list_id AND g.chapter_id = c.id AND g.subtitle = '科学・生命'
  );

INSERT INTO section_groups (list_id, chapter_id, subtitle, description, sort_order)
SELECT 'crossover-v3', c.id, '生活・社会', '日常生活から人物、社会、政治、経済へ範囲を広げる語彙', 5
FROM chapters c
WHERE c.list_id = 'crossover-v3' AND c.sort_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM section_groups g
    WHERE g.list_id = c.list_id AND g.chapter_id = c.id AND g.subtitle = '生活・社会'
  );

INSERT INTO section_groups (list_id, chapter_id, subtitle, description, sort_order)
SELECT 'crossover-v3', c.id, '多義・語法', '多義語、類似したスペル、読解上重要な副詞を整理する語彙', 6
FROM chapters c
WHERE c.list_id = 'crossover-v3' AND c.sort_order = 1
  AND NOT EXISTS (
    SELECT 1 FROM section_groups g
    WHERE g.list_id = c.list_id AND g.chapter_id = c.id AND g.subtitle = '多義・語法'
  );

-- 既存のSection 1〜40を、学習の流れに合わせた順序とGroupへ対応づける。
-- D1のマイグレーションでは一時テーブルを使わず、通常テーブルを最後に削除する。
CREATE TABLE crossover_chapter1_groups_0030 (
  section_subtitle TEXT PRIMARY KEY,
  new_sort_order INTEGER NOT NULL,
  group_subtitle TEXT NOT NULL
);

INSERT INTO crossover_chapter1_groups_0030 (section_subtitle, new_sort_order, group_subtitle) VALUES
  ('重要・程度', 1, '尺度・評価'),
  ('数量・範囲', 2, '尺度・評価'),
  ('性質・評価', 3, '尺度・評価'),
  ('判断・適否', 4, '尺度・評価'),
  ('特性・様態', 5, '尺度・評価'),
  ('時間・順序', 6, '状態・動作'),
  ('場所・移動', 7, '状態・動作'),
  ('変化・状態', 8, '状態・動作'),
  ('動作・操作', 9, '状態・動作'),
  ('行為・選択', 10, '状態・動作'),
  ('発生・生産', 11, '状態・動作'),
  ('取得・達成', 12, '状態・動作'),
  ('因果・論理', 13, '思考・表現'),
  ('思考・認識', 14, '思考・表現'),
  ('学習・技能', 15, '思考・表現'),
  ('研究・分析', 16, '思考・表現'),
  ('情報・構成', 17, '思考・表現'),
  ('言語・伝達', 18, '思考・表現'),
  ('物語・表現', 19, '思考・表現'),
  ('科学・技術', 20, '科学・生命'),
  ('物質・形状', 21, '科学・生命'),
  ('生物・生態', 22, '科学・生命'),
  ('環境・地理', 23, '科学・生命'),
  ('身体・自然', 24, '科学・生命'),
  ('医療・心理', 25, '科学・生命'),
  ('日常・身辺', 26, '生活・社会'),
  ('人物・交流', 27, '生活・社会'),
  ('社会・文化', 28, '生活・社会'),
  ('地域・慣習', 29, '生活・社会'),
  ('政治・法律', 30, '生活・社会'),
  ('連携・対抗', 31, '生活・社会'),
  ('対立・危機', 32, '生活・社会'),
  ('経済・産業', 33, '生活・社会'),
  ('所有・取引', 34, '生活・社会'),
  ('重要多義語1：作用・機能', 35, '多義・語法'),
  ('重要多義語2：特質・様相', 36, '多義・語法'),
  ('重要多義語3：実体・概念', 37, '多義・語法'),
  ('スペルの似た単語の識別1：一字・母音の違い', 38, '多義・語法'),
  ('スペルの似た単語の識別2：語尾・同音語', 39, '多義・語法'),
  ('読解の鍵となる副詞', 40, '多義・語法');

UPDATE sections
SET
  sort_order = (
    SELECT mapping.new_sort_order
    FROM crossover_chapter1_groups_0030 mapping
    WHERE mapping.section_subtitle = sections.subtitle
  ),
  group_id = (
    SELECT groups.id
    FROM crossover_chapter1_groups_0030 mapping
    JOIN section_groups groups
      ON groups.list_id = sections.list_id
     AND groups.chapter_id = sections.chapter_id
     AND groups.subtitle = mapping.group_subtitle
    WHERE mapping.section_subtitle = sections.subtitle
  )
WHERE sections.list_id = 'crossover-v3'
  AND sections.chapter_id = (
    SELECT id FROM chapters
    WHERE list_id = 'crossover-v3' AND sort_order = 1
    ORDER BY id LIMIT 1
  )
  AND sections.subtitle IN (SELECT section_subtitle FROM crossover_chapter1_groups_0030);

-- Sectionの新しい表示順に合わせて、見出し語とその派生語ファミリーのnoを振り直す。
CREATE TABLE crossover_headword_order_0030 (
  old_no INTEGER PRIMARY KEY,
  new_no INTEGER NOT NULL
);

INSERT INTO crossover_headword_order_0030 (old_no, new_no)
SELECT
  li.no,
  ROW_NUMBER() OVER (
    ORDER BY COALESCE(c.sort_order, -1), COALESCE(s.sort_order, -1),
             COALESCE(sl.sort_order, -1), li.no
  )
FROM list_items li
LEFT JOIN sections s ON s.id = li.section_id
LEFT JOIN chapters c ON c.id = s.chapter_id
LEFT JOIN section_labels sl ON sl.id = li.label_id
WHERE li.list_id = 'crossover-v3' AND li.branch = 0;

UPDATE list_items
SET no = -(
  SELECT mapping.new_no
  FROM crossover_headword_order_0030 mapping
  WHERE mapping.old_no = list_items.no
)
WHERE list_id = 'crossover-v3'
  AND no IN (SELECT old_no FROM crossover_headword_order_0030);

UPDATE list_items
SET no = -no
WHERE list_id = 'crossover-v3'
  AND no < 0;

DROP TABLE crossover_headword_order_0030;
DROP TABLE crossover_chapter1_groups_0030;
