-- 例文（◆）を廃止し、既存の例文をすべてフレーズ（□）に変換する。
-- 訳（translation）と穴埋めの答え（answer）はそのまま残る。
--
-- 注意：このファイルは worker/migrations/ に移した時点で、次のデプロイで本番DBに適用される（元に戻せない）。
-- 実行の承認を得てから `git mv worker/pending-migrations/0061_examples_to_phrases.sql worker/migrations/` する。
-- examplesの更新は閲覧ページの公開ジャーナル（0057）に記録される。適用後は /mcp-viewer-publish をPOSTして公開を起こす。
UPDATE examples SET type = 'phrase' WHERE type IS NULL OR type <> 'phrase';
