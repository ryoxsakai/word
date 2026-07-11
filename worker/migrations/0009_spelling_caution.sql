-- スペルを間違えやすい単語の「注意」フラグ
ALTER TABLE words ADD COLUMN spelling_caution INTEGER NOT NULL DEFAULT 0;
