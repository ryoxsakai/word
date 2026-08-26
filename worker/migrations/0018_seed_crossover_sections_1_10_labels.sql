-- crossover Sections 1–10: approved section-local labels.
-- The mapping is keyed by section and headword spelling. All list items sharing
-- the headword's no (external derivative branches) receive the same label.

CREATE TABLE _migration_0018_label_map (
  section_id INTEGER NOT NULL,
  label_order INTEGER NOT NULL,
  label_name TEXT NOT NULL,
  spelling TEXT NOT NULL
);

INSERT INTO _migration_0018_label_map (section_id, label_order, label_name, spelling) VALUES
  (85, 1, '第1文型の重要用法', 'do'),
  (85, 1, '第1文型の重要用法', 'sell'),
  (85, 1, '第1文型の重要用法', 'pay'),
  (85, 1, '第1文型の重要用法', 'last'),
  (85, 1, '第1文型の重要用法', 'matter'),
  (85, 2, '状態の継続・変化', 'remain'),
  (85, 2, '状態の継続・変化', 'become'),
  (85, 2, '状態の継続・変化', 'get'),
  (85, 2, '状態の継続・変化', 'grow'),
  (85, 2, '状態の継続・変化', 'turn'),
  (85, 2, '状態の継続・変化', 'go'),
  (85, 2, '状態の継続・変化', 'come'),
  (85, 2, '状態の継続・変化', 'fall'),
  (85, 3, '感覚・様態・判明', 'feel'),
  (85, 3, '感覚・様態・判明', 'look'),
  (85, 3, '感覚・様態・判明', 'seem'),
  (85, 3, '感覚・様態・判明', 'taste'),
  (85, 3, '感覚・様態・判明', 'smell'),
  (85, 3, '感覚・様態・判明', 'sound'),
  (85, 3, '感覚・様態・判明', 'prove'),

  (86, 1, '自動詞・他動詞の対照', 'lie'),
  (86, 1, '自動詞・他動詞の対照', 'lay'),
  (86, 1, '自動詞・他動詞の対照', 'rise'),
  (86, 1, '自動詞・他動詞の対照', 'raise'),
  (86, 2, '前置詞を付けない他動詞', 'answer'),
  (86, 2, '前置詞を付けない他動詞', 'discuss'),
  (86, 2, '前置詞を付けない他動詞', 'enter'),
  (86, 2, '前置詞を付けない他動詞', 'marry'),
  (86, 2, '前置詞を付けない他動詞', 'reach'),
  (86, 2, '前置詞を付けない他動詞', 'resemble'),
  (86, 2, '前置詞を付けない他動詞', 'visit'),
  (86, 2, '前置詞を付けない他動詞', 'mention'),
  (86, 2, '前置詞を付けない他動詞', 'approach'),
  (86, 2, '前置詞を付けない他動詞', 'oppose'),
  (86, 2, '前置詞を付けない他動詞', 'obey'),
  (86, 2, '前置詞を付けない他動詞', 'attend'),
  (86, 3, '前置詞を伴う自動詞', 'agree'),
  (86, 3, '前置詞を伴う自動詞', 'apologize'),
  (86, 3, '前置詞を伴う自動詞', 'complain'),
  (86, 3, '前置詞を伴う自動詞', 'graduate'),

  (87, 1, '授与・伝達（to型）', 'give'),
  (87, 1, '授与・伝達（to型）', 'bring'),
  (87, 1, '授与・伝達（to型）', 'send'),
  (87, 1, '授与・伝達（to型）', 'lend'),
  (87, 1, '授与・伝達（to型）', 'show'),
  (87, 1, '授与・伝達（to型）', 'tell'),
  (87, 1, '授与・伝達（to型）', 'teach'),
  (87, 1, '授与・伝達（to型）', 'offer'),
  (87, 1, '授与・伝達（to型）', 'promise'),
  (87, 2, '利益・準備（for型）', 'buy'),
  (87, 2, '利益・準備（for型）', 'prepare'),
  (87, 2, '利益・準備（for型）', 'choose'),
  (87, 3, '要求・負担・節約', 'ask'),
  (87, 3, '要求・負担・節約', 'take'),
  (87, 3, '要求・負担・節約', 'cost'),
  (87, 3, '要求・負担・節約', 'save'),
  (87, 3, '要求・負担・節約', 'spare'),
  (87, 4, '書き換えに注意する動詞', 'owe'),
  (87, 4, '書き換えに注意する動詞', 'deny'),
  (87, 4, '書き換えに注意する動詞', 'envy'),

  (88, 1, '命名・選出', 'call'),
  (88, 1, '命名・選出', 'name'),
  (88, 1, '命名・選出', 'elect'),
  (88, 1, '命名・選出', 'appoint'),
  (88, 2, '状態維持・変化', 'keep'),
  (88, 2, '状態維持・変化', 'leave'),
  (88, 2, '状態維持・変化', 'make'),
  (88, 2, '状態維持・変化', 'render'),
  (88, 3, '発見・結果', 'find'),
  (88, 3, '発見・結果', 'paint'),
  (88, 3, '発見・結果', 'set'),
  (88, 3, '発見・結果', 'drive'),
  (88, 4, '判断・認定', 'think'),
  (88, 4, '判断・認定', 'consider'),
  (88, 4, '判断・認定', 'believe'),
  (88, 4, '判断・認定', 'deem'),
  (88, 4, '判断・認定', 'suppose'),
  (88, 4, '判断・認定', 'assume'),
  (88, 5, '宣言・判定', 'declare'),
  (88, 5, '宣言・判定', 'pronounce'),

  (89, 1, '許可・可能', 'allow'),
  (89, 1, '許可・可能', 'permit'),
  (89, 1, '許可・可能', 'enable'),
  (89, 2, '原因・結果', 'cause'),
  (89, 2, '原因・結果', 'lead'),
  (89, 3, '勧め・助言・警告', 'encourage'),
  (89, 3, '勧め・助言・警告', 'urge'),
  (89, 3, '勧め・助言・警告', 'advise'),
  (89, 3, '勧め・助言・警告', 'remind'),
  (89, 3, '勧め・助言・警告', 'warn'),
  (89, 4, '強制・命令・要求', 'force'),
  (89, 4, '強制・命令・要求', 'oblige'),
  (89, 4, '強制・命令・要求', 'compel'),
  (89, 4, '強制・命令・要求', 'order'),
  (89, 4, '強制・命令・要求', 'beg'),
  (89, 4, '強制・命令・要求', 'request'),
  (89, 4, '強制・命令・要求', 'require'),
  (89, 5, '希望・期待・援助', 'want'),
  (89, 5, '希望・期待・援助', 'expect'),
  (89, 5, '希望・期待・援助', 'help'),

  (90, 1, '説得・思いとどまらせる', 'persuade'),
  (90, 1, '説得・思いとどまらせる', 'dissuade'),
  (90, 2, '妨害・保護（from Ving）', 'prevent'),
  (90, 2, '妨害・保護（from Ving）', 'prohibit'),
  (90, 2, '妨害・保護（from Ving）', 'protect'),
  (90, 2, '妨害・保護（from Ving）', 'rescue'),
  (90, 3, '禁止・阻止（from Ving）', 'ban'),
  (90, 3, '禁止・阻止（from Ving）', 'bar'),
  (90, 3, '禁止・阻止（from Ving）', 'forbid'),
  (90, 3, '禁止・阻止（from Ving）', 'stop'),
  (90, 3, '禁止・阻止（from Ving）', 'hinder'),
  (90, 3, '禁止・阻止（from Ving）', 'discourage'),
  (90, 4, '誘導・圧力・欺き（into Ving）', 'talk'),
  (90, 4, '誘導・圧力・欺き（into Ving）', 'pressure'),
  (90, 4, '誘導・圧力・欺き（into Ving）', 'push'),
  (90, 4, '誘導・圧力・欺き（into Ving）', 'trick'),
  (90, 4, '誘導・圧力・欺き（into Ving）', 'cheat'),
  (90, 4, '誘導・圧力・欺き（into Ving）', 'deceive'),
  (90, 4, '誘導・圧力・欺き（into Ving）', 'fool'),
  (90, 4, '誘導・圧力・欺き（into Ving）', 'tempt'),

  (91, 1, '使役', 'have'),
  (91, 1, '使役', 'let'),
  (91, 2, '知覚', 'see'),
  (91, 2, '知覚', 'hear'),
  (91, 2, '知覚', 'watch'),
  (91, 2, '知覚', 'notice'),
  (91, 2, '知覚', 'observe'),
  (91, 2, '知覚', 'perceive'),
  (91, 2, '知覚', 'witness'),
  (91, 3, '発見・目撃', 'catch'),
  (91, 3, '発見・目撃', 'discover'),
  (91, 3, '発見・目撃', 'spot'),
  (91, 4, '想像・記憶', 'imagine'),
  (91, 4, '想像・記憶', 'picture'),
  (91, 4, '想像・記憶', 'remember'),
  (91, 4, '想像・記憶', 'recall'),
  (91, 5, 'Vingの意味上の主語', 'mind'),
  (91, 5, 'Vingの意味上の主語', 'appreciate'),
  (91, 5, 'Vingの意味上の主語', 'dislike'),
  (91, 5, 'Vingの意味上の主語', 'resent'),

  (92, 1, '認識・評価', 'regard'),
  (92, 1, '認識・評価', 'view'),
  (92, 1, '認識・評価', 'recognize'),
  (92, 1, '認識・評価', 'identify'),
  (92, 2, '説明・定義', 'describe'),
  (92, 2, '説明・定義', 'define'),
  (92, 3, '取り扱い・命名・呼称', 'treat'),
  (92, 3, '取り扱い・命名・呼称', 'label'),
  (92, 3, '取り扱い・命名・呼称', 'refer'),
  (92, 4, '受容・認定・分類', 'accept'),
  (92, 4, '受容・認定・分類', 'know'),
  (92, 4, '受容・認定・分類', 'classify'),
  (92, 4, '受容・認定・分類', 'characterize'),
  (92, 5, '描写・表現・解釈', 'portray'),
  (92, 5, '描写・表現・解釈', 'depict'),
  (92, 5, '描写・表現・解釈', 'represent'),
  (92, 5, '描写・表現・解釈', 'interpret'),
  (92, 5, '描写・表現・解釈', 'present'),
  (92, 6, '承認・指定', 'acknowledge'),
  (92, 6, '承認・指定', 'designate'),

  (93, 1, '誤認・許し（for）', 'mistake'),
  (93, 1, '誤認・許し（for）', 'forgive'),
  (93, 1, '誤認・許し（for）', 'excuse'),
  (93, 2, '評価・賞罰・感謝（for）', 'blame'),
  (93, 2, '評価・賞罰・感謝（for）', 'praise'),
  (93, 2, '評価・賞罰・感謝（for）', 'punish'),
  (93, 2, '評価・賞罰・感謝（for）', 'reward'),
  (93, 2, '評価・賞罰・感謝（for）', 'thank'),
  (93, 3, '通知・確信・非難（of）', 'inform'),
  (93, 3, '通知・確信・非難（of）', 'notify'),
  (93, 3, '通知・確信・非難（of）', 'convince'),
  (93, 3, '通知・確信・非難（of）', 'assure'),
  (93, 3, '通知・確信・非難（of）', 'accuse'),
  (93, 4, '除去・治療（of）', 'rob'),
  (93, 4, '除去・治療（of）', 'deprive'),
  (93, 4, '除去・治療（of）', 'cure'),
  (93, 4, '除去・治療（of）', 'rid'),
  (93, 4, '除去・治療（of）', 'relieve'),
  (93, 5, '区別・分離（from）', 'distinguish'),
  (93, 5, '区別・分離（from）', 'separate'),

  (94, 1, '供給・装備', 'provide'),
  (94, 1, '供給・装備', 'supply'),
  (94, 1, '供給・装備', 'furnish'),
  (94, 1, '供給・装備', 'equip'),
  (94, 2, '充填・被覆・包囲', 'fill'),
  (94, 2, '充填・被覆・包囲', 'cover'),
  (94, 2, '充填・被覆・包囲', 'surround'),
  (94, 2, '充填・被覆・包囲', 'load'),
  (94, 3, '感染・汚染・診断', 'infect'),
  (94, 3, '感染・汚染・診断', 'contaminate'),
  (94, 3, '感染・汚染・診断', 'diagnose'),
  (94, 4, '責任・功績の帰属', 'charge'),
  (94, 4, '責任・功績の帰属', 'credit'),
  (94, 5, '関連・接続・結合', 'associate'),
  (94, 5, '関連・接続・結合', 'connect'),
  (94, 5, '関連・接続・結合', 'link'),
  (94, 5, '関連・接続・結合', 'combine'),
  (94, 6, '比較・混同・置換', 'compare'),
  (94, 6, '比較・混同・置換', 'confuse'),
  (94, 6, '比較・混同・置換', 'replace');

INSERT INTO section_labels (list_id, section_id, name, sort_order)
SELECT 'crossover-v3', m.section_id, m.label_name, m.label_order
FROM _migration_0018_label_map m
WHERE EXISTS (
  SELECT 1 FROM sections s WHERE s.id = m.section_id AND s.list_id = 'crossover-v3'
)
AND NOT EXISTS (
  SELECT 1 FROM section_labels sl
  WHERE sl.list_id = 'crossover-v3' AND sl.section_id = m.section_id AND sl.name = m.label_name
)
GROUP BY m.section_id, m.label_order, m.label_name;

UPDATE list_items AS target
SET label_id = (
  SELECT sl.id
  FROM list_items head
  JOIN words w ON w.id = head.word_id
  JOIN _migration_0018_label_map m
    ON m.section_id = head.section_id AND m.spelling = w.spelling
  JOIN section_labels sl
    ON sl.list_id = head.list_id AND sl.section_id = m.section_id AND sl.name = m.label_name
  WHERE head.list_id = target.list_id
    AND head.section_id = target.section_id
    AND head.no = target.no
  LIMIT 1
)
WHERE target.list_id = 'crossover-v3'
  AND target.section_id BETWEEN 85 AND 94
  AND EXISTS (
    SELECT 1
    FROM list_items head
    JOIN words w ON w.id = head.word_id
    JOIN _migration_0018_label_map m
      ON m.section_id = head.section_id AND m.spelling = w.spelling
    WHERE head.list_id = target.list_id
      AND head.section_id = target.section_id
      AND head.no = target.no
  );

DROP TABLE _migration_0018_label_map;
