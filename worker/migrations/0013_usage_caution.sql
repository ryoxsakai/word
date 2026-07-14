-- 語法（用法）に注意が必要な単語の「注意」フラグ
ALTER TABLE words ADD COLUMN usage_caution INTEGER NOT NULL DEFAULT 0;
