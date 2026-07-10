-- 多義語（意味を複数持ち紛らわしい単語）の「注意」フラグ
ALTER TABLE words ADD COLUMN polysemous_caution INTEGER NOT NULL DEFAULT 0;
