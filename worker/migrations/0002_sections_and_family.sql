-- 単語帳内の章・グループ分け（印刷レイアウト用の見出し。通し番号には影響しない）
CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id TEXT NOT NULL REFERENCES lists(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sections_list ON sections(list_id);

ALTER TABLE list_items ADD COLUMN section_id INTEGER REFERENCES sections(id);

-- 派生語ファミリー（able → ability → inability のような派生元リンク）
ALTER TABLE words ADD COLUMN derived_from_id TEXT REFERENCES words(id);

CREATE INDEX IF NOT EXISTS idx_words_derived_from ON words(derived_from_id);

-- 通し番号の枝番号。0=枝番なし（例: 42）、1以上=同じnoを共有する派生語ファミリー内での枝番（例: 42-1, 42-2）
ALTER TABLE list_items ADD COLUMN branch INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS idx_list_items_no;
CREATE UNIQUE INDEX IF NOT EXISTS idx_list_items_no_branch ON list_items(list_id, no, branch);
