-- 派生語は編集上「1行 = 1品詞・1意味」とし、同じ綴りの行は閲覧側で統合表示する。
-- 既存の「形・名 / 意味A・意味B」形式を、対応関係を確認した2行へ分割する。
CREATE TABLE _migration_0029_derivative_splits (
  source_word_id TEXT NOT NULL,
  derivative_word TEXT NOT NULL,
  old_pos TEXT NOT NULL,
  first_pos TEXT NOT NULL,
  first_meaning TEXT NOT NULL,
  second_pos TEXT NOT NULL,
  second_meaning TEXT NOT NULL
);

INSERT INTO _migration_0029_derivative_splits VALUES
  ('vary', 'variable', '形・名', '形', '変わりやすい', '名', '変数'),
  ('preserve', 'preservative', '名・形', '名', '保存料', '形', '保存の'),
  ('manufacture', 'manufacturing', '名・形', '名', '製造', '形', '製造業の'),
  ('stimulate', 'stimulant', '名・形', '名', '刺激物', '形', '刺激性の'),
  ('character', 'characteristic', '名・形', '名', '特徴', '形', '特徴的な'),
  ('article', 'articulate', '動・形', '動', '明確に述べる', '形', '明瞭な'),
  ('document', 'documentary', '名・形', '名', '記録映画', '形', '記録の'),
  ('virus', 'antiviral', '形・名', '形', '抗ウイルスの', '名', '抗ウイルス薬'),
  ('native', 'nonnative', '形・名', '形', '非在来の', '名', '非母語話者'),
  ('overcome', 'overcoming', '名・形', '名', '克服', '形', '克服する'),
  ('flow', 'overflow', '動・名', '動', 'あふれる', '名', '氾濫'),
  ('common', 'commonplace', '形・名', '形', 'ありふれた', '名', 'ありふれた事'),
  ('assist', 'assistant', '名・形', '名', '助手', '形', '補助の'),
  ('consume', 'consumable', '形・名', '形', '消耗性の', '名', '消耗品'),
  ('annual', 'biennial', '形・名', '形', '2年ごとの', '名', '二年生植物'),
  ('immediate', 'immediately', '副・接', '副', '直ちに', '接', '〜するとすぐ'),
  ('term', 'terminal', '形・名', '形', '末期の', '名', '終点'),
  ('site', 'onsite', '形・副', '形', '現地の', '副', '現地で'),
  ('site', 'offsite', '形・副', '形', '現地外の', '副', '現地外で'),
  ('spread', 'spreading', '名・形', '名', '拡散', '形', '広がる'),
  ('capture', 'captive', '名・形', '名', '捕虜', '形', '捕らわれた'),
  ('humanity', 'humanitarian', '形・名', '形', '人道的な', '名', '人道支援者'),
  ('race', 'racist', '名・形', '名', '人種差別主義者', '形', '人種差別的な'),
  ('civil', 'civilian', '名・形', '名', '民間人', '形', '民間の'),
  ('crime', 'criminal', '名・形', '名', '犯罪者', '形', '犯罪の'),
  ('duty', 'duty-free', '形・副', '形', '免税の', '副', '免税で'),
  ('elite', 'elitist', '名・形', '名', 'エリート主義者', '形', '選民的な'),
  ('financial', 'finance', '名・動', '名', '財政', '動', '資金を供給する'),
  ('stock', 'stockpile', '名・動', '名', '備蓄', '動', '備蓄する'),
  ('profession', 'professional', '名・形', '名', '専門職', '形', '専門的な'),
  ('insurance', 'insured', '名・形', '名', '被保険者', '形', '保険付きの'),
  ('explode', 'explosive', '形・名', '形', '爆発性の', '名', '爆発物'),
  ('heal', 'healing', '名・形', '名', '治癒', '形', '治癒の'),
  ('mixture', 'mix', '動・名', '動', 'を混ぜる', '名', '混合'),
  ('formation', 'form', '動・名', '動', 'を形成する', '名', '形'),
  ('editor', 'editorial', '形・名', '形', '編集の', '名', '社説'),
  ('mission', 'missionary', '名・形', '名', '宣教師', '形', '布教の'),
  ('signature', 'signatory', '名・形', '名', '署名者', '形', '署名した'),
  ('approximately', 'approximate', '形・動', '形', 'おおよその', '動', '〜に近づく'),
  ('relatively', 'relative', '形・名', '形', '相対的な', '名', '親族'),
  ('likelihood', 'likely', '形・副', '形', 'ありそうな', '副', 'おそらく'),
  ('puzzled', 'puzzle', '名・動', '名', '難問', '動', '当惑させる'),
  ('execute', 'executive', '名・形', '名', '幹部', '形', '執行の'),
  ('society', 'socialize', '自・他', '自', '交流する', '他', '社会化する'),
  ('union', 'unite', '自・他', '自', '団結する', '他', '〜を結合する'),
  ('union', 'unionize', '自・他', '自', '労働組合を結成する', '他', '〜を労働組合に加入させる'),
  ('empire', 'imperialist', '名・形', '名', '帝国主義者', '形', '帝国主義の'),
  ('commerce', 'commercial', '形・名', '形', '商業の', '名', '広告'),
  ('toll', 'toll', '自・他', '自', '鐘が鳴る', '他', '鐘を鳴らす'),
  ('radiation', 'radiate', '自・他', '自', '放射状に広がる', '他', '〜を放射する'),
  ('dose', 'overdose', '名・動', '名', '過量投与', '動', '過量摂取する'),
  ('viral', 'antiviral', '形・名', '形', '抗ウイルス性の', '名', '抗ウイルス薬'),
  ('contraception', 'contraceptive', '形・名', '形', '避妊の', '名', '避妊具'),
  ('mutation', 'mutant', '名・形', '名', '突然変異体', '形', '変異した'),
  ('antibiotic', 'antibacterial', '形・名', '形', '抗菌性の', '名', '抗菌薬'),
  ('anesthesia', 'anesthetic', '名・形', '名', '麻酔薬', '形', '麻酔の'),
  ('dosage', 'dose', '名・動', '名', '1回分の薬', '動', '〜に投薬する'),
  ('sedative', 'sedate', '動・形', '動', '〜を鎮静させる', '形', '落ち着いた'),
  ('asthma', 'asthmatic', '形・名', '形', '喘息の', '名', '喘息患者'),
  ('hypertension', 'hypertensive', '形・名', '形', '高血圧の', '名', '高血圧患者'),
  ('malaria', 'antimalarial', '形・名', '形', '抗マラリアの', '名', '抗マラリア薬'),
  ('arthritis', 'arthritic', '形・名', '形', '関節炎の', '名', '関節炎患者');

-- 2つ目の品詞・意味を追加してから、元行を1つ目へ正規化する。
INSERT INTO derivatives (word_id, pos, word, meaning, sort_order)
SELECT d.word_id, s.second_pos, d.word, s.second_meaning, d.sort_order
FROM derivatives d
JOIN _migration_0029_derivative_splits s
  ON s.source_word_id = d.word_id
 AND s.derivative_word = d.word
 AND s.old_pos = d.pos;

UPDATE derivatives
SET pos = (
      SELECT s.first_pos
      FROM _migration_0029_derivative_splits s
      WHERE s.source_word_id = derivatives.word_id
        AND s.derivative_word = derivatives.word
        AND s.old_pos = derivatives.pos
    ),
    meaning = (
      SELECT s.first_meaning
      FROM _migration_0029_derivative_splits s
      WHERE s.source_word_id = derivatives.word_id
        AND s.derivative_word = derivatives.word
        AND s.old_pos = derivatives.pos
    )
WHERE EXISTS (
  SELECT 1
  FROM _migration_0029_derivative_splits s
  WHERE s.source_word_id = derivatives.word_id
    AND s.derivative_word = derivatives.word
    AND s.old_pos = derivatives.pos
);

DROP TABLE _migration_0029_derivative_splits;
