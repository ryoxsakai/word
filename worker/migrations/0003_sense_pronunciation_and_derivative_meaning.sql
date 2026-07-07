-- 品詞ごとに発音が変わる単語（例: record）のための、意味(sense)単位の発音記号の上書き。
-- NULLの場合は単語レベルの pronunciation をそのまま使う。
ALTER TABLE senses ADD COLUMN pronunciation TEXT;

-- 派生語（自由記述）にも意味を登録できるようにする。
ALTER TABLE derivatives ADD COLUMN meaning TEXT;
