-- 発音の音声ファイルURL（辞書APIから取得。閲覧ページでの再生用に永続化する）
ALTER TABLE words ADD COLUMN audio_url TEXT;
