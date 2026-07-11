-- セクションの呼び方（Section / Unit / Part）を単語帳ごとに設定できるようにする。
-- セクション自体の番号はsections.sort_orderから自動計算するため、name列は使わなくなる
-- (既存データ・NOT NULL制約はそのまま残すが、以後は空文字を入れるだけで表示には使わない)。
ALTER TABLE lists ADD COLUMN section_label TEXT NOT NULL DEFAULT 'Section';
