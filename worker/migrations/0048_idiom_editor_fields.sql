-- Share word-book rich-text fields while keeping idioms in the existing D1 database.
ALTER TABLE idioms ADD COLUMN synonyms TEXT NOT NULL DEFAULT '';
ALTER TABLE idioms ADD COLUMN antonyms TEXT NOT NULL DEFAULT '';
ALTER TABLE idioms ADD COLUMN notes TEXT NOT NULL DEFAULT '';
ALTER TABLE idioms ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1));
ALTER TABLE idioms ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]';
