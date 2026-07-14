-- セクションの上位概念「チャプター」を追加する。
-- チャプターは複数のセクションをまとめる帯で、sections.chapter_idで所属を持つ(未所属も可)。
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id TEXT NOT NULL REFERENCES lists(id),
  subtitle TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chapters_list ON chapters(list_id);

ALTER TABLE sections ADD COLUMN chapter_id INTEGER REFERENCES chapters(id);

CREATE INDEX IF NOT EXISTS idx_sections_chapter ON sections(chapter_id);

-- チャプターの呼び方(Chapter / Module / Volume)を単語帳ごとに設定できるようにする。
ALTER TABLE lists ADD COLUMN chapter_label TEXT NOT NULL DEFAULT 'Chapter';
