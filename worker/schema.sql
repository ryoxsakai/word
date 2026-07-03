-- 単語帳アプリ D1 スキーマ

CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
  spelling TEXT NOT NULL,
  pronunciation TEXT,
  etymology TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_words_spelling ON words(spelling);

-- 品詞ごとの意味（1単語に複数）
CREATE TABLE IF NOT EXISTS senses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id TEXT NOT NULL REFERENCES words(id),
  pos TEXT,
  meaning TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_senses_word ON senses(word_id);

-- 派生語
CREATE TABLE IF NOT EXISTS derivatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id TEXT NOT NULL REFERENCES words(id),
  pos TEXT,
  word TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_derivatives_word ON derivatives(word_id);

-- 例文
CREATE TABLE IF NOT EXISTS examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id TEXT NOT NULL REFERENCES words(id),
  sentence TEXT NOT NULL,
  answer TEXT,
  translation TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_examples_word ON examples(word_id);

-- タグ（oxford5000 / awl / eiken:準1級 / custom:医学部頻出 など、name=value形式で自由に追加）
CREATE TABLE IF NOT EXISTS tags (
  word_id TEXT NOT NULL REFERENCES words(id),
  tag_key TEXT NOT NULL,
  tag_value TEXT,
  PRIMARY KEY (word_id, tag_key)
);

-- リスト（Target1900、自作英検2級リスト、など）
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- リストへの所属＋そのリスト内での通し番号
CREATE TABLE IF NOT EXISTS list_items (
  list_id TEXT NOT NULL REFERENCES lists(id),
  word_id TEXT NOT NULL REFERENCES words(id),
  no INTEGER NOT NULL,
  PRIMARY KEY (list_id, word_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_list_items_no ON list_items(list_id, no);
