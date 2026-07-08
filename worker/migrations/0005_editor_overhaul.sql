-- 発音・アクセントの「注意」フラグ（record のように読み間違えやすい単語に印を付ける）
ALTER TABLE words ADD COLUMN pronunciation_caution INTEGER NOT NULL DEFAULT 0;
ALTER TABLE words ADD COLUMN accent_caution INTEGER NOT NULL DEFAULT 0;

-- 関連語彙メモを「類義語」「対義語」「メモ」に分割する。
-- notesは「メモ」として引き続き使う。
ALTER TABLE words ADD COLUMN synonyms TEXT;
ALTER TABLE words ADD COLUMN antonyms TEXT;

-- 品詞ごとの意味(senses)のうち、単語一覧に見出し語の意味として表示する1件をマークする。
ALTER TABLE senses ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0;

-- 例文/フレーズの種別。閲覧ページで「例文」=◆、「フレーズ」=◇ として箇条書き表示する。
ALTER TABLE examples ADD COLUMN type TEXT NOT NULL DEFAULT 'example';
