-- 語義欄だけを対象に、辞書風の全角括弧を半角括弧へ統一する。
-- 新規・更新データはアプリ側でも同じ正規化を行う。

UPDATE senses
SET meaning = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(meaning, '〔', '('),
      '〕', ')'
    ),
    '【', '('
  ),
  '】', ')'
)
WHERE INSTR(meaning, '〔') > 0
   OR INSTR(meaning, '〕') > 0
   OR INSTR(meaning, '【') > 0
   OR INSTR(meaning, '】') > 0;
