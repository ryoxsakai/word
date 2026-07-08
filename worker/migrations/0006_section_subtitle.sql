-- セクション帯にサブタイトルと説明を持たせられるようにする。
-- 閲覧ページのセクション見出しの横にサブタイトル、その下に目立たない説明を表示する。
ALTER TABLE sections ADD COLUMN subtitle TEXT;
ALTER TABLE sections ADD COLUMN description TEXT;
