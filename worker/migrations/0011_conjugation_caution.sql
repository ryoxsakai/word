-- 活用（不規則変化・語形変化）に注意が必要な単語の「注意」フラグ
ALTER TABLE words ADD COLUMN conjugation_caution INTEGER NOT NULL DEFAULT 0;
