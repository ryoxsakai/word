-- Independent idiom collection inside the existing database.
CREATE TABLE IF NOT EXISTS idiom_sections (
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  chapter_key TEXT NOT NULL,
  chapter_subtitle TEXT NOT NULL,
  chapter_order INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (list_id, section_key)
);
CREATE TABLE IF NOT EXISTS idioms (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  phrase TEXT NOT NULL,
  section_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (list_id, section_key) REFERENCES idiom_sections(list_id, section_key) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_idioms_list ON idioms(list_id, sort_order);
CREATE TABLE IF NOT EXISTS idiom_senses (
  id TEXT PRIMARY KEY,
  idiom_id TEXT NOT NULL REFERENCES idioms(id) ON DELETE CASCADE,
  meaning TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_idiom_senses_entry ON idiom_senses(idiom_id);
CREATE TABLE IF NOT EXISTS idiom_word_refs (
  sense_id TEXT NOT NULL REFERENCES idiom_senses(id) ON DELETE CASCADE,
  word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'idiom',
  PRIMARY KEY (sense_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_idiom_refs_word ON idiom_word_refs(word_id);
-- Retain the exact fields before editorial cleanup, independent of word deletion.
CREATE TABLE IF NOT EXISTS idiom_migration_backup (
  migration_key TEXT NOT NULL,
  word_id TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (migration_key, word_id)
);
