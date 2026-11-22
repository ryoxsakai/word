-- 例文（◆）を廃止し、既存の例文をすべてフレーズ（□）に変換する。
-- 訳（translation）と穴埋めの答え（answer）はそのまま残る。
--
-- 2026-11-22 実行の承認済み。デプロイ時に本番DBへ適用される（元に戻せない）。
-- examplesの更新は閲覧ページの公開ジャーナル（0057）に記録される。適用後は /mcp-viewer-publish をPOSTして公開を起こす。
UPDATE examples SET type = 'phrase' WHERE type IS NULL OR type <> 'phrase';
