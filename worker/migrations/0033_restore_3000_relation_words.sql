-- Crossoverの見出し語数を3,000語へ戻し、補完641語を既存見出し語の意味関係欄へ格納する。
-- 同義・反義が厳密に成立する語だけを専用欄へ置き、上下位・分野・用法上の近接語は関連語へ置く。

CREATE TABLE _migration_0033_members (
  word_id TEXT PRIMARY KEY
);

INSERT INTO _migration_0033_members (word_id)
SELECT li.word_id
FROM list_items li
JOIN sections s ON s.id = li.section_id AND s.list_id = li.list_id
JOIN chapters c ON c.id = s.chapter_id AND c.list_id = s.list_id
WHERE li.list_id = 'crossover-v3'
  AND c.subtitle = '主要単語帳の補完語彙';

-- 既存値を保持し、同じ語が既に登録済みなら重複追加しない。
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'abridged'
      ELSE related_words || ', ' || 'abridged'
    END
WHERE spelling = 'cut' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('abridged', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'acceptable'
      ELSE synonyms || ', ' || 'acceptable'
    END
WHERE spelling = 'decent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('acceptable', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'accidentally'
      ELSE related_words || ', ' || 'accidentally'
    END
WHERE spelling = 'deliberate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('accidentally', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'accounting'
      ELSE synonyms || ', ' || 'accounting'
    END
WHERE spelling = 'account' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('accounting', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'activist'
      ELSE related_words || ', ' || 'activist'
    END
WHERE spelling = 'active' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('activist', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ad'
      ELSE related_words || ', ' || 'ad'
    END
WHERE spelling = 'promotion' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ad', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'adjective'
      ELSE related_words || ', ' || 'adjective'
    END
WHERE spelling = 'linguistic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('adjective', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'admirable'
      ELSE synonyms || ', ' || 'admirable'
    END
WHERE spelling = 'good' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('admirable', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'affiliate'
      ELSE synonyms || ', ' || 'affiliate'
    END
WHERE spelling = 'associate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('affiliate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'afflict'
      ELSE related_words || ', ' || 'afflict'
    END
WHERE spelling = 'damage' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('afflict', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'age'
      ELSE related_words || ', ' || 'age'
    END
WHERE spelling = 'era' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('age', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'aged'
      ELSE synonyms || ', ' || 'aged'
    END
WHERE spelling = 'senior' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('aged', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'aging'
      ELSE related_words || ', ' || 'aging'
    END
WHERE spelling = 'process' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('aging', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'agony'
      ELSE synonyms || ', ' || 'agony'
    END
WHERE spelling = 'torture' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('agony', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'alcohol'
      ELSE related_words || ', ' || 'alcohol'
    END
WHERE spelling = 'liquid' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('alcohol', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'alcoholic'
      ELSE related_words || ', ' || 'alcoholic'
    END
WHERE spelling = 'beverage' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('alcoholic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'algorithm'
      ELSE related_words || ', ' || 'algorithm'
    END
WHERE spelling = 'rule' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('algorithm', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'align'
      ELSE synonyms || ', ' || 'align'
    END
WHERE spelling = 'adjust' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('align', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'alongside'
      ELSE related_words || ', ' || 'alongside'
    END
WHERE spelling = 'adjacent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('alongside', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'amateur'
      ELSE related_words || ', ' || 'amateur'
    END
WHERE spelling = 'athlete' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('amateur', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ambivalent'
      ELSE related_words || ', ' || 'ambivalent'
    END
WHERE spelling = 'unsure' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ambivalent', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'anarchy'
      ELSE related_words || ', ' || 'anarchy'
    END
WHERE spelling = 'disorder' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('anarchy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'anger'
      ELSE related_words || ', ' || 'anger'
    END
WHERE spelling = 'emotion' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('anger', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'animate'
      ELSE synonyms || ', ' || 'animate'
    END
WHERE spelling = 'inspire' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('animate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'antioxidant'
      ELSE related_words || ', ' || 'antioxidant'
    END
WHERE spelling = 'substance' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('antioxidant', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'apart'
      ELSE synonyms || ', ' || 'apart'
    END
WHERE spelling = 'aside' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('apart', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'app'
      ELSE related_words || ', ' || 'app'
    END
WHERE spelling = 'digital' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('app', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'appall'
      ELSE synonyms || ', ' || 'appall'
    END
WHERE spelling = 'shock' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('appall', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'apprentice'
      ELSE related_words || ', ' || 'apprentice'
    END
WHERE spelling = 'pupil' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('apprentice', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'aquatic'
      ELSE related_words || ', ' || 'aquatic'
    END
WHERE spelling = 'plant' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('aquatic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'army'
      ELSE related_words || ', ' || 'army'
    END
WHERE spelling = 'military' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('army', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'array'
      ELSE synonyms || ', ' || 'array'
    END
WHERE spelling = 'range' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('array', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'artistic'
      ELSE synonyms || ', ' || 'artistic'
    END
WHERE spelling = 'aesthetic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('artistic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'ascribe'
      ELSE synonyms || ', ' || 'ascribe'
    END
WHERE spelling = 'attribute' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ascribe', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ash'
      ELSE related_words || ', ' || 'ash'
    END
WHERE spelling = 'debris' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ash', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'assassination'
      ELSE related_words || ', ' || 'assassination'
    END
WHERE spelling = 'murder' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('assassination', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'assimilate'
      ELSE synonyms || ', ' || 'assimilate'
    END
WHERE spelling = 'absorb' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('assimilate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'astound'
      ELSE synonyms || ', ' || 'astound'
    END
WHERE spelling = 'astonish' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('astound', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'astrology'
      ELSE related_words || ', ' || 'astrology'
    END
WHERE spelling = 'astronomy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('astrology', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'attentive'
      ELSE synonyms || ', ' || 'attentive'
    END
WHERE spelling = 'thoughtful' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('attentive', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'audible'
      ELSE related_words || ', ' || 'audible'
    END
WHERE spelling = 'hear' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('audible', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'auditorium'
      ELSE related_words || ', ' || 'auditorium'
    END
WHERE spelling = 'room' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('auditorium', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'automobile'
      ELSE related_words || ', ' || 'automobile'
    END
WHERE spelling = 'vehicle' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('automobile', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'autopsy'
      ELSE related_words || ', ' || 'autopsy'
    END
WHERE spelling = 'examine' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('autopsy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'average'
      ELSE synonyms || ', ' || 'average'
    END
WHERE spelling = 'norm' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('average', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'await'
      ELSE synonyms || ', ' || 'await'
    END
WHERE spelling = 'wait' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('await', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'awaiting'
      ELSE related_words || ', ' || 'awaiting'
    END
WHERE spelling = 'wait' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('awaiting', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'awe'
      ELSE synonyms || ', ' || 'awe'
    END
WHERE spelling = 'fear' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('awe', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'bachelor'
      ELSE related_words || ', ' || 'bachelor'
    END
WHERE spelling = 'spouse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('bachelor', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'bait'
      ELSE related_words || ', ' || 'bait'
    END
WHERE spelling = 'feed' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('bait', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'ballot'
      ELSE synonyms || ', ' || 'ballot'
    END
WHERE spelling = 'vote' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ballot', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'barn'
      ELSE related_words || ', ' || 'barn'
    END
WHERE spelling = 'stable' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('barn', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'barrel'
      ELSE related_words || ', ' || 'barrel'
    END
WHERE spelling = 'vessel' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('barrel', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'basement'
      ELSE related_words || ', ' || 'basement'
    END
WHERE spelling = 'room' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('basement', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'basin'
      ELSE related_words || ', ' || 'basin'
    END
WHERE spelling = 'vessel' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('basin', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'beard'
      ELSE related_words || ', ' || 'beard'
    END
WHERE spelling = 'face' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('beard', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'bilingual'
      ELSE related_words || ', ' || 'bilingual'
    END
WHERE spelling = 'linguistic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('bilingual', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'billion'
      ELSE related_words || ', ' || 'billion'
    END
WHERE spelling = 'quantity' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('billion', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'birthrate'
      ELSE synonyms || ', ' || 'birthrate'
    END
WHERE spelling = 'fertility' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('birthrate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'blade'
      ELSE related_words || ', ' || 'blade'
    END
WHERE spelling = 'sword' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('blade', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'blast'
      ELSE related_words || ', ' || 'blast'
    END
WHERE spelling = 'explode' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('blast', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'blister'
      ELSE related_words || ', ' || 'blister'
    END
WHERE spelling = 'flesh' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('blister', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'blockade'
      ELSE synonyms || ', ' || 'blockade'
    END
WHERE spelling = 'hinder' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('blockade', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'blow'
      ELSE related_words || ', ' || 'blow'
    END
WHERE spelling = 'wind' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('blow', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'bob'
      ELSE related_words || ', ' || 'bob'
    END
WHERE spelling = 'move' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('bob', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'bomb'
      ELSE related_words || ', ' || 'bomb'
    END
WHERE spelling = 'explode' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('bomb', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'borrow'
      ELSE related_words || ', ' || 'borrow'
    END
WHERE spelling = 'lend' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('borrow', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'boss'
      ELSE synonyms || ', ' || 'boss'
    END
WHERE spelling = 'chief' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('boss', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'botanical'
      ELSE related_words || ', ' || 'botanical'
    END
WHERE spelling = 'plant' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('botanical', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'botanist'
      ELSE related_words || ', ' || 'botanist'
    END
WHERE spelling = 'plant' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('botanist', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'botany'
      ELSE related_words || ', ' || 'botany'
    END
WHERE spelling = 'plant' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('botany', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'boundless'
      ELSE related_words || ', ' || 'boundless'
    END
WHERE spelling = 'infinite' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('boundless', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'brand'
      ELSE synonyms || ', ' || 'brand'
    END
WHERE spelling = 'make' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('brand', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'breakup'
      ELSE related_words || ', ' || 'breakup'
    END
WHERE spelling = 'change' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('breakup', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'brick'
      ELSE related_words || ', ' || 'brick'
    END
WHERE spelling = 'material' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('brick', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'brochure'
      ELSE related_words || ', ' || 'brochure'
    END
WHERE spelling = 'book' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('brochure', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'bruise'
      ELSE synonyms || ', ' || 'bruise'
    END
WHERE spelling = 'injure' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('bruise', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'bulb'
      ELSE related_words || ', ' || 'bulb'
    END
WHERE spelling = 'structure' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('bulb', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'bunch'
      ELSE synonyms || ', ' || 'bunch'
    END
WHERE spelling = 'cluster' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('bunch', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'bundle'
      ELSE synonyms || ', ' || 'bundle'
    END
WHERE spelling = 'pile' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('bundle', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'bureaucrat'
      ELSE related_words || ', ' || 'bureaucrat'
    END
WHERE spelling = 'official' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('bureaucrat', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'buzz'
      ELSE related_words || ', ' || 'buzz'
    END
WHERE spelling = 'sound' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('buzz', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'cabinet'
      ELSE related_words || ', ' || 'cabinet'
    END
WHERE spelling = 'administration' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cabinet', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'cafeteria'
      ELSE related_words || ', ' || 'cafeteria'
    END
WHERE spelling = 'cuisine' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cafeteria', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'cage'
      ELSE related_words || ', ' || 'cage'
    END
WHERE spelling = 'confine' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cage', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'camel'
      ELSE related_words || ', ' || 'camel'
    END
WHERE spelling = 'mammal' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('camel', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'canyon'
      ELSE related_words || ', ' || 'canyon'
    END
WHERE spelling = 'terrain' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('canyon', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'castle'
      ELSE related_words || ', ' || 'castle'
    END
WHERE spelling = 'architecture' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('castle', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'Catholic'
      ELSE related_words || ', ' || 'Catholic'
    END
WHERE spelling = 'religion' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('Catholic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'celestial'
      ELSE related_words || ', ' || 'celestial'
    END
WHERE spelling = 'astronomy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('celestial', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'censorship'
      ELSE related_words || ', ' || 'censorship'
    END
WHERE spelling = 'suppress' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('censorship', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'CEO'
      ELSE related_words || ', ' || 'CEO'
    END
WHERE spelling = 'chief' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('CEO', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'chamber'
      ELSE related_words || ', ' || 'chamber'
    END
WHERE spelling = 'room' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('chamber', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'chapter'
      ELSE related_words || ', ' || 'chapter'
    END
WHERE spelling = 'section' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('chapter', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'chat'
      ELSE related_words || ', ' || 'chat'
    END
WHERE spelling = 'talk' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('chat', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'chatter'
      ELSE related_words || ', ' || 'chatter'
    END
WHERE spelling = 'talk' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('chatter', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'checkup'
      ELSE synonyms || ', ' || 'checkup'
    END
WHERE spelling = 'medical' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('checkup', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'cheek'
      ELSE synonyms || ', ' || 'cheek'
    END
WHERE spelling = 'face' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cheek', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'cheer'
      ELSE related_words || ', ' || 'cheer'
    END
WHERE spelling = 'encourage' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cheer', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'cheery'
      ELSE synonyms || ', ' || 'cheery'
    END
WHERE spelling = 'happy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cheery', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'chip'
      ELSE related_words || ', ' || 'chip'
    END
WHERE spelling = 'component' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('chip', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'circuit'
      ELSE related_words || ', ' || 'circuit'
    END
WHERE spelling = 'route' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('circuit', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'circumstances'
      ELSE related_words || ', ' || 'circumstances'
    END
WHERE spelling = 'situation' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('circumstances', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'citizen'
      ELSE related_words || ', ' || 'citizen'
    END
WHERE spelling = 'subject' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('citizen', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'citizenship'
      ELSE related_words || ', ' || 'citizenship'
    END
WHERE spelling = 'right' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('citizenship', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'classic'
      ELSE related_words || ', ' || 'classic'
    END
WHERE spelling = 'superior' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('classic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'classical'
      ELSE related_words || ', ' || 'classical'
    END
WHERE spelling = 'standard' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('classical', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'clause'
      ELSE synonyms || ', ' || 'clause'
    END
WHERE spelling = 'article' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('clause', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'clergy'
      ELSE related_words || ', ' || 'clergy'
    END
WHERE spelling = 'profession' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('clergy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'click'
      ELSE synonyms || ', ' || 'click'
    END
WHERE spelling = 'snap' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('click', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'cliff'
      ELSE related_words || ', ' || 'cliff'
    END
WHERE spelling = 'formation' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cliff', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'clinic'
      ELSE related_words || ', ' || 'clinic'
    END
WHERE spelling = 'medical' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('clinic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'closure'
      ELSE synonyms || ', ' || 'closure'
    END
WHERE spelling = 'stop' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('closure', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'clothes'
      ELSE related_words || ', ' || 'clothes'
    END
WHERE spelling = 'wear' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('clothes', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'clutch'
      ELSE synonyms || ', ' || 'clutch'
    END
WHERE spelling = 'grasp' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('clutch', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'coalition'
      ELSE related_words || ', ' || 'coalition'
    END
WHERE spelling = 'union' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('coalition', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'coastal'
      ELSE related_words || ', ' || 'coastal'
    END
WHERE spelling = 'mainland' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('coastal', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'coffin'
      ELSE related_words || ', ' || 'coffin'
    END
WHERE spelling = 'bury' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('coffin', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'collaborate'
      ELSE synonyms || ', ' || 'collaborate'
    END
WHERE spelling = 'cooperate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('collaborate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'comet'
      ELSE related_words || ', ' || 'comet'
    END
WHERE spelling = 'nucleus' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('comet', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'commendable'
      ELSE related_words || ', ' || 'commendable'
    END
WHERE spelling = 'worthy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('commendable', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'communism'
      ELSE related_words || ', ' || 'communism'
    END
WHERE spelling = 'ideology' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('communism', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'communist'
      ELSE related_words || ', ' || 'communist'
    END
WHERE spelling = 'advocate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('communist', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'complimentary'
      ELSE synonyms || ', ' || 'complimentary'
    END
WHERE spelling = 'free' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('complimentary', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'compress'
      ELSE synonyms || ', ' || 'compress'
    END
WHERE spelling = 'contract' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('compress', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'condo'
      ELSE related_words || ', ' || 'condo'
    END
WHERE spelling = 'architecture' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('condo', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'confer'
      ELSE synonyms || ', ' || 'confer'
    END
WHERE spelling = 'consult' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('confer', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'connotation'
      ELSE related_words || ', ' || 'connotation'
    END
WHERE spelling = 'implication' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('connotation', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'conquest'
      ELSE related_words || ', ' || 'conquest'
    END
WHERE spelling = 'capture' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('conquest', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'consecutive'
      ELSE synonyms || ', ' || 'consecutive'
    END
WHERE spelling = 'successive' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('consecutive', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'conspire'
      ELSE related_words || ', ' || 'conspire'
    END
WHERE spelling = 'interact' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('conspire', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'constraint'
      ELSE related_words || ', ' || 'constraint'
    END
WHERE spelling = 'limit' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('constraint', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'continuously'
      ELSE related_words || ', ' || 'continuously'
    END
WHERE spelling = 'continue' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('continuously', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'converge'
      ELSE synonyms || ', ' || 'converge'
    END
WHERE spelling = 'meet' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('converge', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'converse'
      ELSE synonyms || ', ' || 'converse'
    END
WHERE spelling = 'discourse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('converse', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'coral'
      ELSE related_words || ', ' || 'coral'
    END
WHERE spelling = 'marine' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('coral', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'cordial'
      ELSE related_words || ', ' || 'cordial'
    END
WHERE spelling = 'sincere' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cordial', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'corpse'
      ELSE related_words || ', ' || 'corpse'
    END
WHERE spelling = 'flesh' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('corpse', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'cosmetic'
      ELSE related_words || ', ' || 'cosmetic'
    END
WHERE spelling = 'makeup' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cosmetic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'cove'
      ELSE related_words || ', ' || 'cove'
    END
WHERE spelling = 'formation' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cove', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'creep'
      ELSE synonyms || ', ' || 'creep'
    END
WHERE spelling = 'crawl' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('creep', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'cross'
      ELSE related_words || ', ' || 'cross'
    END
WHERE spelling = 'pass' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('cross', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'crust'
      ELSE related_words || ', ' || 'crust'
    END
WHERE spelling = 'layer' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('crust', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'custody'
      ELSE synonyms || ', ' || 'custody'
    END
WHERE spelling = 'hold' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('custody', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'damp'
      ELSE synonyms || ', ' || 'damp'
    END
WHERE spelling = 'humid' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('damp', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'deduct'
      ELSE related_words || ', ' || 'deduct'
    END
WHERE spelling = 'reduce' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('deduct', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'deflate'
      ELSE related_words || ', ' || 'deflate'
    END
WHERE spelling = 'collapse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('deflate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'dehydration'
      ELSE related_words || ', ' || 'dehydration'
    END
WHERE spelling = 'thirst' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('dehydration', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'dejected'
      ELSE related_words || ', ' || 'dejected'
    END
WHERE spelling = 'gloomy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('dejected', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'delegation'
      ELSE synonyms || ', ' || 'delegation'
    END
WHERE spelling = 'mission' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('delegation', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'delinquent'
      ELSE related_words || ', ' || 'delinquent'
    END
WHERE spelling = 'crime' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('delinquent', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'density'
      ELSE related_words || ', ' || 'density'
    END
WHERE spelling = 'dense' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('density', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'dependency'
      ELSE related_words || ', ' || 'dependency'
    END
WHERE spelling = 'dependent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('dependency', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'deplore'
      ELSE synonyms || ', ' || 'deplore'
    END
WHERE spelling = 'lament' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('deplore', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'deter'
      ELSE synonyms || ', ' || 'deter'
    END
WHERE spelling = 'discourage' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('deter', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'developer'
      ELSE related_words || ', ' || 'developer'
    END
WHERE spelling = 'develop' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('developer', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'devoid'
      ELSE synonyms || ', ' || 'devoid'
    END
WHERE spelling = 'free' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('devoid', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'diffuse'
      ELSE synonyms || ', ' || 'diffuse'
    END
WHERE spelling = 'spread' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('diffuse', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'digestive'
      ELSE related_words || ', ' || 'digestive'
    END
WHERE spelling = 'nutrition' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('digestive', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'diplomacy'
      ELSE related_words || ', ' || 'diplomacy'
    END
WHERE spelling = 'wisdom' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('diplomacy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'diplomat'
      ELSE related_words || ', ' || 'diplomat'
    END
WHERE spelling = 'official' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('diplomat', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'diplomatic'
      ELSE related_words || ', ' || 'diplomatic'
    END
WHERE spelling = 'embassy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('diplomatic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'dirt'
      ELSE synonyms || ', ' || 'dirt'
    END
WHERE spelling = 'soil' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('dirt', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'disadvantaged'
      ELSE related_words || ', ' || 'disadvantaged'
    END
WHERE spelling = 'economic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('disadvantaged', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'disagree'
      ELSE synonyms || ', ' || 'disagree'
    END
WHERE spelling = 'differ' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('disagree', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'discomfort'
      ELSE antonyms || ', ' || 'discomfort'
    END
WHERE spelling = 'comfort' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('discomfort', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'disconnect'
      ELSE antonyms || ', ' || 'disconnect'
    END
WHERE spelling = 'connect' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('disconnect', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'discontent'
      ELSE antonyms || ', ' || 'discontent'
    END
WHERE spelling = 'content' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('discontent', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'discreet'
      ELSE related_words || ', ' || 'discreet'
    END
WHERE spelling = 'advisable' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('discreet', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'dismay'
      ELSE synonyms || ', ' || 'dismay'
    END
WHERE spelling = 'alarm' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('dismay', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'disprove'
      ELSE antonyms || ', ' || 'disprove'
    END
WHERE spelling = 'prove' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('disprove', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'downfall'
      ELSE synonyms || ', ' || 'downfall'
    END
WHERE spelling = 'ruin' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('downfall', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'drastically'
      ELSE related_words || ', ' || 'drastically'
    END
WHERE spelling = 'drastic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('drastically', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'drawback'
      ELSE related_words || ', ' || 'drawback'
    END
WHERE spelling = 'catch' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('drawback', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'dreary'
      ELSE related_words || ', ' || 'dreary'
    END
WHERE spelling = 'gloomy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('dreary', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'drone'
      ELSE related_words || ', ' || 'drone'
    END
WHERE spelling = 'vehicle' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('drone', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'dual'
      ELSE related_words || ', ' || 'dual'
    END
WHERE spelling = 'multiple' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('dual', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'duplicate'
      ELSE synonyms || ', ' || 'duplicate'
    END
WHERE spelling = 'replicate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('duplicate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'dust'
      ELSE related_words || ', ' || 'dust'
    END
WHERE spelling = 'debris' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('dust', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'earthquake'
      ELSE related_words || ', ' || 'earthquake'
    END
WHERE spelling = 'shock' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('earthquake', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'eclipse'
      ELSE related_words || ', ' || 'eclipse'
    END
WHERE spelling = 'astronomy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('eclipse', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'eject'
      ELSE synonyms || ', ' || 'eject'
    END
WHERE spelling = 'exclude' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('eject', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'elsewhere'
      ELSE related_words || ', ' || 'elsewhere'
    END
WHERE spelling = 'place' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('elsewhere', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'embed'
      ELSE synonyms || ', ' || 'embed'
    END
WHERE spelling = 'plant' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('embed', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'emigrate'
      ELSE related_words || ', ' || 'emigrate'
    END
WHERE spelling = 'migrate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('emigrate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'enchant'
      ELSE related_words || ', ' || 'enchant'
    END
WHERE spelling = 'attract' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('enchant', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'encouraging'
      ELSE related_words || ', ' || 'encouraging'
    END
WHERE spelling = 'hopeful' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('encouraging', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'endangered'
      ELSE related_words || ', ' || 'endangered'
    END
WHERE spelling = 'vulnerable' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('endangered', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'endorse'
      ELSE synonyms || ', ' || 'endorse'
    END
WHERE spelling = 'support' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('endorse', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'endow'
      ELSE synonyms || ', ' || 'endow'
    END
WHERE spelling = 'gift' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('endow', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'endowed'
      ELSE related_words || ', ' || 'endowed'
    END
WHERE spelling = 'provided' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('endowed', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'enlightened'
      ELSE related_words || ', ' || 'enlightened'
    END
WHERE spelling = 'knowledge' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('enlightened', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'enlightenment'
      ELSE related_words || ', ' || 'enlightenment'
    END
WHERE spelling = 'knowledge' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('enlightenment', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'enlist'
      ELSE synonyms || ', ' || 'enlist'
    END
WHERE spelling = 'engage' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('enlist', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'entrust'
      ELSE synonyms || ', ' || 'entrust'
    END
WHERE spelling = 'commit' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('entrust', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'envelope'
      ELSE related_words || ', ' || 'envelope'
    END
WHERE spelling = 'cover' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('envelope', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'epoch'
      ELSE synonyms || ', ' || 'epoch'
    END
WHERE spelling = 'era' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('epoch', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'equation'
      ELSE related_words || ', ' || 'equation'
    END
WHERE spelling = 'mathematics' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('equation', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'evacuate'
      ELSE related_words || ', ' || 'evacuate'
    END
WHERE spelling = 'safe' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('evacuate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'evacuated'
      ELSE related_words || ', ' || 'evacuated'
    END
WHERE spelling = 'safe' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('evacuated', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'excerpt'
      ELSE synonyms || ', ' || 'excerpt'
    END
WHERE spelling = 'extract' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('excerpt', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'exhale'
      ELSE related_words || ', ' || 'exhale'
    END
WHERE spelling = 'breathe' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('exhale', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'expectancy'
      ELSE related_words || ', ' || 'expectancy'
    END
WHERE spelling = 'prospect' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('expectancy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'expensive'
      ELSE related_words || ', ' || 'expensive'
    END
WHERE spelling = 'valuable' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('expensive', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'exquisite'
      ELSE related_words || ', ' || 'exquisite'
    END
WHERE spelling = 'magnificent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('exquisite', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'extrovert'
      ELSE related_words || ', ' || 'extrovert'
    END
WHERE spelling = 'psychology' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('extrovert', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'eyebrow'
      ELSE related_words || ', ' || 'eyebrow'
    END
WHERE spelling = 'face' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('eyebrow', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'eyelash'
      ELSE related_words || ', ' || 'eyelash'
    END
WHERE spelling = 'eyelid' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('eyelash', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'fairy'
      ELSE related_words || ', ' || 'fairy'
    END
WHERE spelling = 'belief' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('fairy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'farewell'
      ELSE synonyms || ', ' || 'farewell'
    END
WHERE spelling = 'leave' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('farewell', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'favorite'
      ELSE related_words || ', ' || 'favorite'
    END
WHERE spelling = 'prefer' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('favorite', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'female'
      ELSE antonyms || ', ' || 'female'
    END
WHERE spelling = 'male' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('female', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'feudal'
      ELSE related_words || ', ' || 'feudal'
    END
WHERE spelling = 'medieval' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('feudal', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'fingerprint'
      ELSE related_words || ', ' || 'fingerprint'
    END
WHERE spelling = 'mark' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('fingerprint', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'finite'
      ELSE antonyms || ', ' || 'finite'
    END
WHERE spelling = 'infinite' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('finite', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'fist'
      ELSE related_words || ', ' || 'fist'
    END
WHERE spelling = 'arm' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('fist', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'flap'
      ELSE related_words || ', ' || 'flap'
    END
WHERE spelling = 'move' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('flap', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'flip'
      ELSE related_words || ', ' || 'flip'
    END
WHERE spelling = 'reverse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('flip', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'floating'
      ELSE related_words || ', ' || 'floating'
    END
WHERE spelling = 'mobile' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('floating', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'flush'
      ELSE related_words || ', ' || 'flush'
    END
WHERE spelling = 'liquid' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('flush', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'foe'
      ELSE related_words || ', ' || 'foe'
    END
WHERE spelling = 'opponent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('foe', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'forehead'
      ELSE related_words || ', ' || 'forehead'
    END
WHERE spelling = 'feature' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('forehead', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'foresee'
      ELSE synonyms || ', ' || 'foresee'
    END
WHERE spelling = 'anticipate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('foresee', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'fountain'
      ELSE synonyms || ', ' || 'fountain'
    END
WHERE spelling = 'spring' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('fountain', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'fragrance'
      ELSE synonyms || ', ' || 'fragrance'
    END
WHERE spelling = 'scent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('fragrance', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'frantic'
      ELSE synonyms || ', ' || 'frantic'
    END
WHERE spelling = 'mad' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('frantic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'fraud'
      ELSE synonyms || ', ' || 'fraud'
    END
WHERE spelling = 'fake' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('fraud', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'fusion'
      ELSE related_words || ', ' || 'fusion'
    END
WHERE spelling = 'union' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('fusion', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'gadget'
      ELSE synonyms || ', ' || 'gadget'
    END
WHERE spelling = 'appliance' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('gadget', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'gallery'
      ELSE related_words || ', ' || 'gallery'
    END
WHERE spelling = 'art' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('gallery', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'genre'
      ELSE related_words || ', ' || 'genre'
    END
WHERE spelling = 'art' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('genre', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'glide'
      ELSE related_words || ', ' || 'glide'
    END
WHERE spelling = 'go' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('glide', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'globalization'
      ELSE related_words || ', ' || 'globalization'
    END
WHERE spelling = 'universal' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('globalization', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'glossary'
      ELSE related_words || ', ' || 'glossary'
    END
WHERE spelling = 'vocabulary' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('glossary', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'gossip'
      ELSE related_words || ', ' || 'gossip'
    END
WHERE spelling = 'talk' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('gossip', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'governor'
      ELSE related_words || ', ' || 'governor'
    END
WHERE spelling = 'control' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('governor', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'grade'
      ELSE synonyms || ', ' || 'grade'
    END
WHERE spelling = 'class' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('grade', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'grammar'
      ELSE related_words || ', ' || 'grammar'
    END
WHERE spelling = 'linguistic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('grammar', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'grassland'
      ELSE related_words || ', ' || 'grassland'
    END
WHERE spelling = 'terrain' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('grassland', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'graze'
      ELSE related_words || ', ' || 'graze'
    END
WHERE spelling = 'feed' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('graze', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'grid'
      ELSE related_words || ', ' || 'grid'
    END
WHERE spelling = 'facility' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('grid', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'guess'
      ELSE related_words || ', ' || 'guess'
    END
WHERE spelling = 'hypothesis' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('guess', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'hamper'
      ELSE synonyms || ', ' || 'hamper'
    END
WHERE spelling = 'hinder' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('hamper', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'handout'
      ELSE related_words || ', ' || 'handout'
    END
WHERE spelling = 'document' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('handout', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'harass'
      ELSE synonyms || ', ' || 'harass'
    END
WHERE spelling = 'provoke' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('harass', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'harassment'
      ELSE related_words || ', ' || 'harassment'
    END
WHERE spelling = 'tease' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('harassment', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'haste'
      ELSE synonyms || ', ' || 'haste'
    END
WHERE spelling = 'rush' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('haste', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'hay'
      ELSE related_words || ', ' || 'hay'
    END
WHERE spelling = 'feed' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('hay', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'heating'
      ELSE related_words || ', ' || 'heating'
    END
WHERE spelling = 'melt' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('heating', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'heaven'
      ELSE related_words || ', ' || 'heaven'
    END
WHERE spelling = 'region' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('heaven', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'hectic'
      ELSE related_words || ', ' || 'hectic'
    END
WHERE spelling = 'rush' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('hectic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'heighten'
      ELSE synonyms || ', ' || 'heighten'
    END
WHERE spelling = 'rise' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('heighten', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'history'
      ELSE synonyms || ', ' || 'history'
    END
WHERE spelling = 'account' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('history', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'hive'
      ELSE related_words || ', ' || 'hive'
    END
WHERE spelling = 'store' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('hive', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'holistic'
      ELSE related_words || ', ' || 'holistic'
    END
WHERE spelling = 'overall' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('holistic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'horizon'
      ELSE synonyms || ', ' || 'horizon'
    END
WHERE spelling = 'view' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('horizon', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'horrible'
      ELSE related_words || ', ' || 'horrible'
    END
WHERE spelling = 'horror' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('horrible', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'hostage'
      ELSE related_words || ', ' || 'hostage'
    END
WHERE spelling = 'capture' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('hostage', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'hover'
      ELSE synonyms || ', ' || 'hover'
    END
WHERE spelling = 'linger' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('hover', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'hunger'
      ELSE related_words || ', ' || 'hunger'
    END
WHERE spelling = 'thirst' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('hunger', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'hurt'
      ELSE synonyms || ', ' || 'hurt'
    END
WHERE spelling = 'harm' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('hurt', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'hypocrisy'
      ELSE related_words || ', ' || 'hypocrisy'
    END
WHERE spelling = 'pretend' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('hypocrisy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ignition'
      ELSE related_words || ', ' || 'ignition'
    END
WHERE spelling = 'start' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ignition', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'immeasurable'
      ELSE related_words || ', ' || 'immeasurable'
    END
WHERE spelling = 'infinite' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('immeasurable', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'immerse'
      ELSE synonyms || ', ' || 'immerse'
    END
WHERE spelling = 'plunge' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('immerse', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'immersed'
      ELSE related_words || ', ' || 'immersed'
    END
WHERE spelling = 'absorb' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('immersed', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'impart'
      ELSE synonyms || ', ' || 'impart'
    END
WHERE spelling = 'give' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('impart', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'impassable'
      ELSE related_words || ', ' || 'impassable'
    END
WHERE spelling = 'prevent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('impassable', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'improper'
      ELSE antonyms || ', ' || 'improper'
    END
WHERE spelling = 'proper' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('improper', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'incidence'
      ELSE related_words || ', ' || 'incidence'
    END
WHERE spelling = 'incident' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('incidence', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'indeed'
      ELSE synonyms || ', ' || 'indeed'
    END
WHERE spelling = 'so' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('indeed', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'indefinite'
      ELSE related_words || ', ' || 'indefinite'
    END
WHERE spelling = 'uncertain' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('indefinite', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'inferred'
      ELSE synonyms || ', ' || 'inferred'
    END
WHERE spelling = 'infer' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('inferred', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'influx'
      ELSE related_words || ', ' || 'influx'
    END
WHERE spelling = 'flow' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('influx', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'ingenuous'
      ELSE synonyms || ', ' || 'ingenuous'
    END
WHERE spelling = 'innocent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ingenuous', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'inhale'
      ELSE related_words || ', ' || 'inhale'
    END
WHERE spelling = 'breathe' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('inhale', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'inmate'
      ELSE synonyms || ', ' || 'inmate'
    END
WHERE spelling = 'convict' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('inmate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'inner'
      ELSE synonyms || ', ' || 'inner'
    END
WHERE spelling = 'internal' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('inner', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'insect'
      ELSE related_words || ', ' || 'insect'
    END
WHERE spelling = 'bug' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('insect', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'instantly'
      ELSE related_words || ', ' || 'instantly'
    END
WHERE spelling = 'immediate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('instantly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'institute'
      ELSE related_words || ', ' || 'institute'
    END
WHERE spelling = 'institution' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('institute', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'integrity'
      ELSE related_words || ', ' || 'integrity'
    END
WHERE spelling = 'sincere' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('integrity', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'intentionally'
      ELSE related_words || ', ' || 'intentionally'
    END
WHERE spelling = 'intention' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('intentionally', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'interior'
      ELSE synonyms || ', ' || 'interior'
    END
WHERE spelling = 'internal' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('interior', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'internet'
      ELSE related_words || ', ' || 'internet'
    END
WHERE spelling = 'web' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('internet', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'internship'
      ELSE related_words || ', ' || 'internship'
    END
WHERE spelling = 'employment' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('internship', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'interpersonal'
      ELSE related_words || ', ' || 'interpersonal'
    END
WHERE spelling = 'social' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('interpersonal', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'interview'
      ELSE related_words || ', ' || 'interview'
    END
WHERE spelling = 'employment' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('interview', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'irresistible'
      ELSE related_words || ', ' || 'irresistible'
    END
WHERE spelling = 'attract' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('irresistible', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'jam'
      ELSE related_words || ', ' || 'jam'
    END
WHERE spelling = 'preserve' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('jam', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'janitor'
      ELSE related_words || ', ' || 'janitor'
    END
WHERE spelling = 'institution' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('janitor', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'jar'
      ELSE related_words || ', ' || 'jar'
    END
WHERE spelling = 'vessel' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('jar', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'jewelry'
      ELSE related_words || ', ' || 'jewelry'
    END
WHERE spelling = 'pin' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('jewelry', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'journal'
      ELSE related_words || ', ' || 'journal'
    END
WHERE spelling = 'press' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('journal', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'journalism'
      ELSE related_words || ', ' || 'journalism'
    END
WHERE spelling = 'profession' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('journalism', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'justly'
      ELSE synonyms || ', ' || 'justly'
    END
WHERE spelling = 'right' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('justly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'kid'
      ELSE synonyms || ', ' || 'kid'
    END
WHERE spelling = 'minor' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('kid', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'kidnap'
      ELSE related_words || ', ' || 'kidnap'
    END
WHERE spelling = 'seize' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('kidnap', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'kin'
      ELSE synonyms || ', ' || 'kin'
    END
WHERE spelling = 'tribe' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('kin', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'kindergarten'
      ELSE related_words || ', ' || 'kindergarten'
    END
WHERE spelling = 'pupil' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('kindergarten', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'kingdom'
      ELSE synonyms || ', ' || 'kingdom'
    END
WHERE spelling = 'realm' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('kingdom', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'knot'
      ELSE related_words || ', ' || 'knot'
    END
WHERE spelling = 'thread' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('knot', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'knowledgeable'
      ELSE related_words || ', ' || 'knowledgeable'
    END
WHERE spelling = 'know' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('knowledgeable', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ladder'
      ELSE related_words || ', ' || 'ladder'
    END
WHERE spelling = 'step' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ladder', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'landfill'
      ELSE related_words || ', ' || 'landfill'
    END
WHERE spelling = 'garbage' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('landfill', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'landmine'
      ELSE related_words || ', ' || 'landmine'
    END
WHERE spelling = 'military' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('landmine', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'lane'
      ELSE related_words || ', ' || 'lane'
    END
WHERE spelling = 'path' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('lane', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'lap'
      ELSE related_words || ', ' || 'lap'
    END
WHERE spelling = 'knee' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('lap', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'lapse'
      ELSE synonyms || ', ' || 'lapse'
    END
WHERE spelling = 'relapse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('lapse', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'lawn'
      ELSE related_words || ', ' || 'lawn'
    END
WHERE spelling = 'ground' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('lawn', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'lazy'
      ELSE related_words || ', ' || 'lazy'
    END
WHERE spelling = 'idle' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('lazy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'leather'
      ELSE related_words || ', ' || 'leather'
    END
WHERE spelling = 'material' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('leather', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'leftover'
      ELSE related_words || ', ' || 'leftover'
    END
WHERE spelling = 'remain' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('leftover', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'liberty'
      ELSE synonyms || ', ' || 'liberty'
    END
WHERE spelling = 'autonomy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('liberty', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'librarian'
      ELSE related_words || ', ' || 'librarian'
    END
WHERE spelling = 'book' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('librarian', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'literature'
      ELSE related_words || ', ' || 'literature'
    END
WHERE spelling = 'book' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('literature', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'livelihood'
      ELSE related_words || ', ' || 'livelihood'
    END
WHERE spelling = 'income' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('livelihood', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'lively'
      ELSE synonyms || ', ' || 'lively'
    END
WHERE spelling = 'alert' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('lively', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'local'
      ELSE related_words || ', ' || 'local'
    END
WHERE spelling = 'community' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('local', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'lodge'
      ELSE related_words || ', ' || 'lodge'
    END
WHERE spelling = 'stay' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('lodge', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'long-term'
      ELSE related_words || ', ' || 'long-term'
    END
WHERE spelling = 'long' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('long-term', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'longitude'
      ELSE related_words || ', ' || 'longitude'
    END
WHERE spelling = 'latitude' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('longitude', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'lord'
      ELSE related_words || ', ' || 'lord'
    END
WHERE spelling = 'noble' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('lord', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'lot'
      ELSE synonyms || ', ' || 'lot'
    END
WHERE spelling = 'mass' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('lot', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'loudly'
      ELSE related_words || ', ' || 'loudly'
    END
WHERE spelling = 'sound' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('loudly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'luggage'
      ELSE related_words || ', ' || 'luggage'
    END
WHERE spelling = 'case' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('luggage', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'lure'
      ELSE synonyms || ', ' || 'lure'
    END
WHERE spelling = 'tempt' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('lure', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'machinery'
      ELSE related_words || ', ' || 'machinery'
    END
WHERE spelling = 'mechanical' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('machinery', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'magnify'
      ELSE synonyms || ', ' || 'magnify'
    END
WHERE spelling = 'exaggerate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('magnify', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'malicious'
      ELSE related_words || ', ' || 'malicious'
    END
WHERE spelling = 'evil' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('malicious', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'marked'
      ELSE related_words || ', ' || 'marked'
    END
WHERE spelling = 'conspicuous' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('marked', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'marvelous'
      ELSE synonyms || ', ' || 'marvelous'
    END
WHERE spelling = 'terrific' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('marvelous', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'master'
      ELSE related_words || ', ' || 'master'
    END
WHERE spelling = 'skill' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('master', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'mate'
      ELSE related_words || ', ' || 'mate'
    END
WHERE spelling = 'companion' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('mate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'maxim'
      ELSE related_words || ', ' || 'maxim'
    END
WHERE spelling = 'phrase' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('maxim', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'maze'
      ELSE related_words || ', ' || 'maze'
    END
WHERE spelling = 'complex' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('maze', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'meadow'
      ELSE related_words || ', ' || 'meadow'
    END
WHERE spelling = 'terrain' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('meadow', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'Mediterranean'
      ELSE related_words || ', ' || 'Mediterranean'
    END
WHERE spelling = 'marine' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('Mediterranean', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'melancholy'
      ELSE related_words || ', ' || 'melancholy'
    END
WHERE spelling = 'gloomy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('melancholy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'mellow'
      ELSE related_words || ', ' || 'mellow'
    END
WHERE spelling = 'gentle' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('mellow', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'merry'
      ELSE related_words || ', ' || 'merry'
    END
WHERE spelling = 'happy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('merry', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'midst'
      ELSE related_words || ', ' || 'midst'
    END
WHERE spelling = 'region' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('midst', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'mighty'
      ELSE related_words || ', ' || 'mighty'
    END
WHERE spelling = 'force' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('mighty', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'mill'
      ELSE related_words || ', ' || 'mill'
    END
WHERE spelling = 'grind' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('mill', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'millionaire'
      ELSE related_words || ', ' || 'millionaire'
    END
WHERE spelling = 'wealth' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('millionaire', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'mimic'
      ELSE related_words || ', ' || 'mimic'
    END
WHERE spelling = 'imitate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('mimic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'mistakenly'
      ELSE related_words || ', ' || 'mistakenly'
    END
WHERE spelling = 'mistake' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('mistakenly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'modernization'
      ELSE related_words || ', ' || 'modernization'
    END
WHERE spelling = 'change' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('modernization', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'motor'
      ELSE related_words || ', ' || 'motor'
    END
WHERE spelling = 'mechanical' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('motor', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'mud'
      ELSE related_words || ', ' || 'mud'
    END
WHERE spelling = 'soil' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('mud', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'multitude'
      ELSE synonyms || ', ' || 'multitude'
    END
WHERE spelling = 'mass' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('multitude', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'mummy'
      ELSE related_words || ', ' || 'mummy'
    END
WHERE spelling = 'ancient' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('mummy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'nap'
      ELSE related_words || ', ' || 'nap'
    END
WHERE spelling = 'rest' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nap', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'nasty'
      ELSE synonyms || ', ' || 'nasty'
    END
WHERE spelling = 'awful' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nasty', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'nation'
      ELSE synonyms || ', ' || 'nation'
    END
WHERE spelling = 'state' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nation', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'nationalism'
      ELSE related_words || ', ' || 'nationalism'
    END
WHERE spelling = 'philosophy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nationalism', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'naughty'
      ELSE related_words || ', ' || 'naughty'
    END
WHERE spelling = 'discipline' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('naughty', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'needle'
      ELSE related_words || ', ' || 'needle'
    END
WHERE spelling = 'implement' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('needle', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'nest'
      ELSE related_words || ', ' || 'nest'
    END
WHERE spelling = 'retreat' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nest', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'net'
      ELSE antonyms || ', ' || 'net'
    END
WHERE spelling = 'gross' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('net', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'nonsense'
      ELSE related_words || ', ' || 'nonsense'
    END
WHERE spelling = 'content' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nonsense', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'nor'
      ELSE related_words || ', ' || 'nor'
    END
WHERE spelling = 'neither' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nor', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'nosy'
      ELSE related_words || ', ' || 'nosy'
    END
WHERE spelling = 'curious' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nosy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'nowhere'
      ELSE related_words || ', ' || 'nowhere'
    END
WHERE spelling = 'place' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nowhere', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'numb'
      ELSE synonyms || ', ' || 'numb'
    END
WHERE spelling = 'asleep' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('numb', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'nursery'
      ELSE related_words || ', ' || 'nursery'
    END
WHERE spelling = 'infant' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nursery', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'nursing'
      ELSE related_words || ', ' || 'nursing'
    END
WHERE spelling = 'aid' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nursing', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'nutritious'
      ELSE related_words || ', ' || 'nutritious'
    END
WHERE spelling = 'nutrition' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('nutritious', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'oath'
      ELSE synonyms || ', ' || 'oath'
    END
WHERE spelling = 'vow' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('oath', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'obsessed'
      ELSE related_words || ', ' || 'obsessed'
    END
WHERE spelling = 'concerned' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('obsessed', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'obsession'
      ELSE related_words || ', ' || 'obsession'
    END
WHERE spelling = 'concern' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('obsession', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'obstinate'
      ELSE synonyms || ', ' || 'obstinate'
    END
WHERE spelling = 'stubborn' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('obstinate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'offending'
      ELSE related_words || ', ' || 'offending'
    END
WHERE spelling = 'offend' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('offending', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'on-the-job'
      ELSE related_words || ', ' || 'on-the-job'
    END
WHERE spelling = 'employment' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('on-the-job', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'onset'
      ELSE related_words || ', ' || 'onset'
    END
WHERE spelling = 'start' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('onset', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'orient'
      ELSE synonyms || ', ' || 'orient'
    END
WHERE spelling = 'point' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('orient', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'oriented'
      ELSE related_words || ', ' || 'oriented'
    END
WHERE spelling = 'bound' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('oriented', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'ornament'
      ELSE synonyms || ', ' || 'ornament'
    END
WHERE spelling = 'grace' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ornament', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ought'
      ELSE related_words || ', ' || 'ought'
    END
WHERE spelling = 'duty' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ought', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'outburst'
      ELSE synonyms || ', ' || 'outburst'
    END
WHERE spelling = 'burst' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('outburst', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'outcast'
      ELSE related_words || ', ' || 'outcast'
    END
WHERE spelling = 'exclude' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('outcast', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'outnumber'
      ELSE related_words || ', ' || 'outnumber'
    END
WHERE spelling = 'exceed' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('outnumber', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'outraged'
      ELSE related_words || ', ' || 'outraged'
    END
WHERE spelling = 'furious' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('outraged', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'outrageous'
      ELSE related_words || ', ' || 'outrageous'
    END
WHERE spelling = 'shock' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('outrageous', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'outsider'
      ELSE related_words || ', ' || 'outsider'
    END
WHERE spelling = 'unknown' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('outsider', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'outsource'
      ELSE related_words || ', ' || 'outsource'
    END
WHERE spelling = 'source' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('outsource', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'outweigh'
      ELSE related_words || ', ' || 'outweigh'
    END
WHERE spelling = 'dominate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('outweigh', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'overdo'
      ELSE synonyms || ', ' || 'overdo'
    END
WHERE spelling = 'exaggerate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('overdo', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'overdue'
      ELSE related_words || ', ' || 'overdue'
    END
WHERE spelling = 'due' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('overdue', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'overhaul'
      ELSE synonyms || ', ' || 'overhaul'
    END
WHERE spelling = 'service' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('overhaul', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'overhear'
      ELSE synonyms || ', ' || 'overhear'
    END
WHERE spelling = 'catch' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('overhear', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'overly'
      ELSE synonyms || ', ' || 'overly'
    END
WHERE spelling = 'too' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('overly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'overnight'
      ELSE related_words || ', ' || 'overnight'
    END
WHERE spelling = 'long' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('overnight', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'overrate'
      ELSE related_words || ', ' || 'overrate'
    END
WHERE spelling = 'mistake' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('overrate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'overthrow'
      ELSE synonyms || ', ' || 'overthrow'
    END
WHERE spelling = 'upset' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('overthrow', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'owing'
      ELSE related_words || ', ' || 'owing'
    END
WHERE spelling = 'cause' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('owing', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'palace'
      ELSE related_words || ', ' || 'palace'
    END
WHERE spelling = 'architecture' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('palace', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'panic'
      ELSE synonyms || ', ' || 'panic'
    END
WHERE spelling = 'scare' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('panic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'paperwork'
      ELSE related_words || ', ' || 'paperwork'
    END
WHERE spelling = 'work' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('paperwork', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'paralysis'
      ELSE related_words || ', ' || 'paralysis'
    END
WHERE spelling = 'physical' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('paralysis', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'paralyze'
      ELSE related_words || ', ' || 'paralyze'
    END
WHERE spelling = 'prevent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('paralyze', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'paralyzed'
      ELSE related_words || ', ' || 'paralyzed'
    END
WHERE spelling = 'ill' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('paralyzed', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'patriotic'
      ELSE synonyms || ', ' || 'patriotic'
    END
WHERE spelling = 'loyal' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('patriotic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'patriotism'
      ELSE related_words || ', ' || 'patriotism'
    END
WHERE spelling = 'loyal' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('patriotism', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'pave'
      ELSE related_words || ', ' || 'pave'
    END
WHERE spelling = 'surface' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('pave', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'pavement'
      ELSE related_words || ', ' || 'pavement'
    END
WHERE spelling = 'surface' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('pavement', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'persecution'
      ELSE related_words || ', ' || 'persecution'
    END
WHERE spelling = 'abuse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('persecution', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'persevere'
      ELSE synonyms || ', ' || 'persevere'
    END
WHERE spelling = 'persist' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('persevere', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'perspire'
      ELSE related_words || ', ' || 'perspire'
    END
WHERE spelling = 'excrete' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('perspire', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'pervasive'
      ELSE related_words || ', ' || 'pervasive'
    END
WHERE spelling = 'spread' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('pervasive', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'petition'
      ELSE synonyms || ', ' || 'petition'
    END
WHERE spelling = 'request' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('petition', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'petty'
      ELSE synonyms || ', ' || 'petty'
    END
WHERE spelling = 'trivial' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('petty', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'physiological'
      ELSE related_words || ', ' || 'physiological'
    END
WHERE spelling = 'physical' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('physiological', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'pilgrim'
      ELSE related_words || ', ' || 'pilgrim'
    END
WHERE spelling = 'worship' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('pilgrim', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'pit'
      ELSE related_words || ', ' || 'pit'
    END
WHERE spelling = 'hollow' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('pit', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'placebo'
      ELSE related_words || ', ' || 'placebo'
    END
WHERE spelling = 'medicine' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('placebo', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'placement'
      ELSE synonyms || ', ' || 'placement'
    END
WHERE spelling = 'arrangement' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('placement', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'planet'
      ELSE related_words || ', ' || 'planet'
    END
WHERE spelling = 'astronomy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('planet', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'plead'
      ELSE related_words || ', ' || 'plead'
    END
WHERE spelling = 'apologize' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('plead', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'pleasant'
      ELSE antonyms || ', ' || 'pleasant'
    END
WHERE spelling = 'unpleasant' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('pleasant', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'plentiful'
      ELSE synonyms || ', ' || 'plentiful'
    END
WHERE spelling = 'rich' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('plentiful', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'plenty'
      ELSE synonyms || ', ' || 'plenty'
    END
WHERE spelling = 'mass' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('plenty', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'plight'
      ELSE related_words || ', ' || 'plight'
    END
WHERE spelling = 'difficulty' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('plight', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'plug'
      ELSE related_words || ', ' || 'plug'
    END
WHERE spelling = 'connect' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('plug', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'plural'
      ELSE related_words || ', ' || 'plural'
    END
WHERE spelling = 'form' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('plural', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'poetry'
      ELSE synonyms || ', ' || 'poetry'
    END
WHERE spelling = 'verse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('poetry', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'poison'
      ELSE related_words || ', ' || 'poison'
    END
WHERE spelling = 'substance' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('poison', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'poke'
      ELSE synonyms || ', ' || 'poke'
    END
WHERE spelling = 'thrust' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('poke', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'pollen'
      ELSE related_words || ', ' || 'pollen'
    END
WHERE spelling = 'allergen' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('pollen', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'ponder'
      ELSE synonyms || ', ' || 'ponder'
    END
WHERE spelling = 'reflect' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ponder', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'post'
      ELSE related_words || ', ' || 'post'
    END
WHERE spelling = 'publish' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('post', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'posterior'
      ELSE related_words || ', ' || 'posterior'
    END
WHERE spelling = 'anatomy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('posterior', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'potent'
      ELSE related_words || ', ' || 'potent'
    END
WHERE spelling = 'force' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('potent', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'pottery'
      ELSE related_words || ', ' || 'pottery'
    END
WHERE spelling = 'trade' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('pottery', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'prairie'
      ELSE related_words || ', ' || 'prairie'
    END
WHERE spelling = 'plain' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('prairie', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'precaution'
      ELSE synonyms || ', ' || 'precaution'
    END
WHERE spelling = 'guard' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('precaution', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'prefecture'
      ELSE related_words || ', ' || 'prefecture'
    END
WHERE spelling = 'region' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('prefecture', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'premature'
      ELSE related_words || ', ' || 'premature'
    END
WHERE spelling = 'prior' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('premature', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'preoccupied'
      ELSE related_words || ', ' || 'preoccupied'
    END
WHERE spelling = 'concern' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('preoccupied', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'preoccupy'
      ELSE related_words || ', ' || 'preoccupy'
    END
WHERE spelling = 'concern' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('preoccupy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'presidential'
      ELSE related_words || ', ' || 'presidential'
    END
WHERE spelling = 'administration' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('presidential', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'problematic'
      ELSE synonyms || ', ' || 'problematic'
    END
WHERE spelling = 'tough' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('problematic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'procession'
      ELSE related_words || ', ' || 'procession'
    END
WHERE spelling = 'ceremony' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('procession', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'professor'
      ELSE related_words || ', ' || 'professor'
    END
WHERE spelling = 'academic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('professor', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'profitable'
      ELSE related_words || ', ' || 'profitable'
    END
WHERE spelling = 'economic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('profitable', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'propel'
      ELSE synonyms || ', ' || 'propel'
    END
WHERE spelling = 'motivate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('propel', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'proponent'
      ELSE synonyms || ', ' || 'proponent'
    END
WHERE spelling = 'advocate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('proponent', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'Protestant'
      ELSE related_words || ', ' || 'Protestant'
    END
WHERE spelling = 'religion' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('Protestant', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'proximity'
      ELSE related_words || ', ' || 'proximity'
    END
WHERE spelling = 'neighborhood' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('proximity', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'prudent'
      ELSE related_words || ', ' || 'prudent'
    END
WHERE spelling = 'wise' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('prudent', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'pump'
      ELSE related_words || ', ' || 'pump'
    END
WHERE spelling = 'liquid' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('pump', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'purse'
      ELSE related_words || ', ' || 'purse'
    END
WHERE spelling = 'cash' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('purse', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'rag'
      ELSE related_words || ', ' || 'rag'
    END
WHERE spelling = 'fabric' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('rag', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'rally'
      ELSE related_words || ', ' || 'rally'
    END
WHERE spelling = 'assemble' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('rally', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ranch'
      ELSE related_words || ', ' || 'ranch'
    END
WHERE spelling = 'cattle' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ranch', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ransom'
      ELSE related_words || ', ' || 'ransom'
    END
WHERE spelling = 'payment' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ransom', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ration'
      ELSE related_words || ', ' || 'ration'
    END
WHERE spelling = 'share' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ration', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'rattle'
      ELSE related_words || ', ' || 'rattle'
    END
WHERE spelling = 'shake' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('rattle', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'rebound'
      ELSE related_words || ', ' || 'rebound'
    END
WHERE spelling = 'bounce' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('rebound', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'reckon'
      ELSE synonyms || ', ' || 'reckon'
    END
WHERE spelling = 'suppose' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('reckon', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'reconstruct'
      ELSE synonyms || ', ' || 'reconstruct'
    END
WHERE spelling = 'construct' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('reconstruct', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'rectangular'
      ELSE related_words || ', ' || 'rectangular'
    END
WHERE spelling = 'shape' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('rectangular', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'redeem'
      ELSE synonyms || ', ' || 'redeem'
    END
WHERE spelling = 'deliver' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('redeem', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'redundant'
      ELSE synonyms || ', ' || 'redundant'
    END
WHERE spelling = 'extra' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('redundant', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'reef'
      ELSE related_words || ', ' || 'reef'
    END
WHERE spelling = 'marine' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('reef', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'regain'
      ELSE synonyms || ', ' || 'regain'
    END
WHERE spelling = 'retrieve' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('regain', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'rehearsal'
      ELSE related_words || ', ' || 'rehearsal'
    END
WHERE spelling = 'drill' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('rehearsal', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'reintroduce'
      ELSE related_words || ', ' || 'reintroduce'
    END
WHERE spelling = 'present' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('reintroduce', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'relay'
      ELSE related_words || ', ' || 'relay'
    END
WHERE spelling = 'shift' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('relay', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'relentless'
      ELSE synonyms || ', ' || 'relentless'
    END
WHERE spelling = 'stern' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('relentless', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'relocate'
      ELSE related_words || ', ' || 'relocate'
    END
WHERE spelling = 'move' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('relocate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'remodel'
      ELSE related_words || ', ' || 'remodel'
    END
WHERE spelling = 'alter' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('remodel', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'Renaissance'
      ELSE related_words || ', ' || 'Renaissance'
    END
WHERE spelling = 'era' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('Renaissance', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'renovate'
      ELSE synonyms || ', ' || 'renovate'
    END
WHERE spelling = 'repair' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('renovate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'repay'
      ELSE synonyms || ', ' || 'repay'
    END
WHERE spelling = 'refund' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('repay', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'reportedly'
      ELSE related_words || ', ' || 'reportedly'
    END
WHERE spelling = 'allege' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('reportedly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'reptile'
      ELSE related_words || ', ' || 'reptile'
    END
WHERE spelling = 'mammal' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('reptile', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'reschedule'
      ELSE related_words || ', ' || 'reschedule'
    END
WHERE spelling = 'postpone' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('reschedule', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'retrospect'
      ELSE synonyms || ', ' || 'retrospect'
    END
WHERE spelling = 'review' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('retrospect', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'revolt'
      ELSE synonyms || ', ' || 'revolt'
    END
WHERE spelling = 'disgust' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('revolt', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'rhyme'
      ELSE synonyms || ', ' || 'rhyme'
    END
WHERE spelling = 'verse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('rhyme', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'rightly'
      ELSE synonyms || ', ' || 'rightly'
    END
WHERE spelling = 'fairly' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('rightly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'rivalry'
      ELSE related_words || ', ' || 'rivalry'
    END
WHERE spelling = 'contest' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('rivalry', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'roll'
      ELSE related_words || ', ' || 'roll'
    END
WHERE spelling = 'rotate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('roll', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'root'
      ELSE synonyms || ', ' || 'root'
    END
WHERE spelling = 'source' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('root', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'royal'
      ELSE related_words || ', ' || 'royal'
    END
WHERE spelling = 'noble' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('royal', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'rubber'
      ELSE related_words || ', ' || 'rubber'
    END
WHERE spelling = 'material' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('rubber', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ruthless'
      ELSE related_words || ', ' || 'ruthless'
    END
WHERE spelling = 'fierce' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ruthless', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'résumé'
      ELSE synonyms || ', ' || 'résumé'
    END
WHERE spelling = 'resume' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('résumé', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'saving'
      ELSE synonyms || ', ' || 'saving'
    END
WHERE spelling = 'economy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('saving', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'scandal'
      ELSE related_words || ', ' || 'scandal'
    END
WHERE spelling = 'comment' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('scandal', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'scenario'
      ELSE related_words || ', ' || 'scenario'
    END
WHERE spelling = 'book' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('scenario', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'scene'
      ELSE related_words || ', ' || 'scene'
    END
WHERE spelling = 'view' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('scene', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'scenic'
      ELSE related_words || ', ' || 'scenic'
    END
WHERE spelling = 'landscape' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('scenic', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'score'
      ELSE synonyms || ', ' || 'score'
    END
WHERE spelling = 'mark' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('score', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'screaming'
      ELSE synonyms || ', ' || 'screaming'
    END
WHERE spelling = 'shriek' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('screaming', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'seal'
      ELSE related_words || ', ' || 'seal'
    END
WHERE spelling = 'surface' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('seal', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'seat'
      ELSE synonyms || ', ' || 'seat'
    END
WHERE spelling = 'place' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('seat', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'second'
      ELSE related_words || ', ' || 'second'
    END
WHERE spelling = 'order' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('second', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'secondhand'
      ELSE related_words || ', ' || 'secondhand'
    END
WHERE spelling = 'used' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('secondhand', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'self'
      ELSE related_words || ', ' || 'self'
    END
WHERE spelling = 'individual' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('self', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'self-esteem'
      ELSE related_words || ', ' || 'self-esteem'
    END
WHERE spelling = 'pride' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('self-esteem', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'selfish'
      ELSE related_words || ', ' || 'selfish'
    END
WHERE spelling = 'vain' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('selfish', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'senate'
      ELSE related_words || ', ' || 'senate'
    END
WHERE spelling = 'congress' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('senate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'senator'
      ELSE related_words || ', ' || 'senator'
    END
WHERE spelling = 'representative' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('senator', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sequel'
      ELSE related_words || ', ' || 'sequel'
    END
WHERE spelling = 'outcome' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sequel', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'serene'
      ELSE synonyms || ', ' || 'serene'
    END
WHERE spelling = 'calm' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('serene', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'serial'
      ELSE synonyms || ', ' || 'serial'
    END
WHERE spelling = 'series' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('serial', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'servant'
      ELSE related_words || ', ' || 'servant'
    END
WHERE spelling = 'domestic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('servant', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'setback'
      ELSE synonyms || ', ' || 'setback'
    END
WHERE spelling = 'reverse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('setback', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'shatter'
      ELSE related_words || ', ' || 'shatter'
    END
WHERE spelling = 'break' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('shatter', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'shelf'
      ELSE related_words || ', ' || 'shelf'
    END
WHERE spelling = 'support' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('shelf', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'shiver'
      ELSE synonyms || ', ' || 'shiver'
    END
WHERE spelling = 'tremble' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('shiver', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'shortcoming'
      ELSE synonyms || ', ' || 'shortcoming'
    END
WHERE spelling = 'defect' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('shortcoming', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'shun'
      ELSE synonyms || ', ' || 'shun'
    END
WHERE spelling = 'avoid' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('shun', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'shy'
      ELSE synonyms || ', ' || 'shy'
    END
WHERE spelling = 'unsure' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('shy', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'simmer'
      ELSE related_words || ', ' || 'simmer'
    END
WHERE spelling = 'temperature' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('simmer', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'simplify'
      ELSE antonyms || ', ' || 'simplify'
    END
WHERE spelling = 'complicate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('simplify', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'simulate'
      ELSE synonyms || ', ' || 'simulate'
    END
WHERE spelling = 'imitate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('simulate', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sinister'
      ELSE related_words || ', ' || 'sinister'
    END
WHERE spelling = 'evil' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sinister', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sinking'
      ELSE related_words || ', ' || 'sinking'
    END
WHERE spelling = 'decrease' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sinking', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sip'
      ELSE related_words || ', ' || 'sip'
    END
WHERE spelling = 'swallow' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sip', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'skip'
      ELSE synonyms || ', ' || 'skip'
    END
WHERE spelling = 'cut' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('skip', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'slang'
      ELSE related_words || ', ' || 'slang'
    END
WHERE spelling = 'linguistic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('slang', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'slender'
      ELSE synonyms || ', ' || 'slender'
    END
WHERE spelling = 'slight' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('slender', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'slope'
      ELSE synonyms || ', ' || 'slope'
    END
WHERE spelling = 'pitch' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('slope', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'smoothly'
      ELSE related_words || ', ' || 'smoothly'
    END
WHERE spelling = 'easy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('smoothly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sneak'
      ELSE related_words || ', ' || 'sneak'
    END
WHERE spelling = 'secret' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sneak', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sneer'
      ELSE related_words || ', ' || 'sneer'
    END
WHERE spelling = 'express' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sneer', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sniff'
      ELSE related_words || ', ' || 'sniff'
    END
WHERE spelling = 'smell' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sniff', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'snore'
      ELSE related_words || ', ' || 'snore'
    END
WHERE spelling = 'breathe' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('snore', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sob'
      ELSE related_words || ', ' || 'sob'
    END
WHERE spelling = 'tear' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sob', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'sober'
      ELSE synonyms || ', ' || 'sober'
    END
WHERE spelling = 'serious' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sober', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'socialism'
      ELSE related_words || ', ' || 'socialism'
    END
WHERE spelling = 'ideology' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('socialism', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'solar'
      ELSE related_words || ', ' || 'solar'
    END
WHERE spelling = 'astronomy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('solar', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'soldier'
      ELSE related_words || ', ' || 'soldier'
    END
WHERE spelling = 'troop' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('soldier', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sophomore'
      ELSE related_words || ', ' || 'sophomore'
    END
WHERE spelling = 'intermediate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sophomore', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'sow'
      ELSE synonyms || ', ' || 'sow'
    END
WHERE spelling = 'seed' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sow', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'spacious'
      ELSE related_words || ', ' || 'spacious'
    END
WHERE spelling = 'convenient' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('spacious', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'spark'
      ELSE related_words || ', ' || 'spark'
    END
WHERE spelling = 'electricity' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('spark', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'spatial'
      ELSE related_words || ', ' || 'spatial'
    END
WHERE spelling = 'room' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('spatial', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'spin'
      ELSE synonyms || ', ' || 'spin'
    END
WHERE spelling = 'twist' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('spin', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'spinal'
      ELSE related_words || ', ' || 'spinal'
    END
WHERE spelling = 'physical' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('spinal', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'splendid'
      ELSE synonyms || ', ' || 'splendid'
    END
WHERE spelling = 'magnificent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('splendid', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'sprain'
      ELSE synonyms || ', ' || 'sprain'
    END
WHERE spelling = 'twist' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sprain', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sprawl'
      ELSE related_words || ', ' || 'sprawl'
    END
WHERE spelling = 'spread' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sprawl', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'spray'
      ELSE related_words || ', ' || 'spray'
    END
WHERE spelling = 'scatter' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('spray', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'stale'
      ELSE related_words || ', ' || 'stale'
    END
WHERE spelling = 'decay' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('stale', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'stalk'
      ELSE related_words || ', ' || 'stalk'
    END
WHERE spelling = 'follow' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('stalk', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'stall'
      ELSE synonyms || ', ' || 'stall'
    END
WHERE spelling = 'stand' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('stall', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'standby'
      ELSE related_words || ', ' || 'standby'
    END
WHERE spelling = 'reserve' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('standby', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'statesman'
      ELSE related_words || ', ' || 'statesman'
    END
WHERE spelling = 'administration' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('statesman', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'statue'
      ELSE related_words || ', ' || 'statue'
    END
WHERE spelling = 'sculpture' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('statue', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sticky'
      ELSE related_words || ', ' || 'sticky'
    END
WHERE spelling = 'attach' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sticky', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'storm'
      ELSE synonyms || ', ' || 'storm'
    END
WHERE spelling = 'rage' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('storm', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'strangle'
      ELSE synonyms || ', ' || 'strangle'
    END
WHERE spelling = 'choke' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('strangle', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'strength'
      ELSE related_words || ', ' || 'strength'
    END
WHERE spelling = 'force' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('strength', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'stride'
      ELSE synonyms || ', ' || 'stride'
    END
WHERE spelling = 'pace' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('stride', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'string'
      ELSE related_words || ', ' || 'string'
    END
WHERE spelling = 'thread' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('string', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'subdue'
      ELSE related_words || ', ' || 'subdue'
    END
WHERE spelling = 'control' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('subdue', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'subtract'
      ELSE antonyms || ', ' || 'subtract'
    END
WHERE spelling = 'add' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('subtract', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'successor'
      ELSE synonyms || ', ' || 'successor'
    END
WHERE spelling = 'heir' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('successor', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'superb'
      ELSE synonyms || ', ' || 'superb'
    END
WHERE spelling = 'brilliant' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('superb', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'supervise'
      ELSE synonyms || ', ' || 'supervise'
    END
WHERE spelling = 'manage' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('supervise', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'supplementary'
      ELSE related_words || ', ' || 'supplementary'
    END
WHERE spelling = 'supplement' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('supplementary', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'surf'
      ELSE synonyms || ', ' || 'surf'
    END
WHERE spelling = 'browse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('surf', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'surveillance'
      ELSE related_words || ', ' || 'surveillance'
    END
WHERE spelling = 'watch' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('surveillance', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'sway'
      ELSE synonyms || ', ' || 'sway'
    END
WHERE spelling = 'shake' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sway', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sweat'
      ELSE related_words || ', ' || 'sweat'
    END
WHERE spelling = 'excrete' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sweat', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'sweatshop'
      ELSE related_words || ', ' || 'sweatshop'
    END
WHERE spelling = 'plant' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('sweatshop', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'swing'
      ELSE related_words || ', ' || 'swing'
    END
WHERE spelling = 'shake' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('swing', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'synthesize'
      ELSE related_words || ', ' || 'synthesize'
    END
WHERE spelling = 'combine' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('synthesize', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'tailor'
      ELSE related_words || ', ' || 'tailor'
    END
WHERE spelling = 'adjust' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('tailor', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'technically'
      ELSE related_words || ', ' || 'technically'
    END
WHERE spelling = 'exact' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('technically', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'telescope'
      ELSE synonyms || ', ' || 'telescope'
    END
WHERE spelling = 'scope' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('telescope', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'termite'
      ELSE related_words || ', ' || 'termite'
    END
WHERE spelling = 'bug' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('termite', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'testament'
      ELSE related_words || ', ' || 'testament'
    END
WHERE spelling = 'evidence' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('testament', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'thaw'
      ELSE synonyms || ', ' || 'thaw'
    END
WHERE spelling = 'melt' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('thaw', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'thigh'
      ELSE related_words || ', ' || 'thigh'
    END
WHERE spelling = 'flesh' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('thigh', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'toddler'
      ELSE related_words || ', ' || 'toddler'
    END
WHERE spelling = 'minor' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('toddler', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'toe'
      ELSE related_words || ', ' || 'toe'
    END
WHERE spelling = 'flesh' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('toe', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'torment'
      ELSE synonyms || ', ' || 'torment'
    END
WHERE spelling = 'torture' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('torment', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'tourism'
      ELSE related_words || ', ' || 'tourism'
    END
WHERE spelling = 'itinerary' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('tourism', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'transact'
      ELSE related_words || ', ' || 'transact'
    END
WHERE spelling = 'interact' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('transact', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'transcend'
      ELSE synonyms || ', ' || 'transcend'
    END
WHERE spelling = 'exceed' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('transcend', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'trespass'
      ELSE synonyms || ', ' || 'trespass'
    END
WHERE spelling = 'intrude' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('trespass', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'trifle'
      ELSE related_words || ', ' || 'trifle'
    END
WHERE spelling = 'trivial' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('trifle', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'trim'
      ELSE related_words || ', ' || 'trim'
    END
WHERE spelling = 'tidy' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('trim', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'triple'
      ELSE related_words || ', ' || 'triple'
    END
WHERE spelling = 'multiple' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('triple', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'trunk'
      ELSE synonyms || ', ' || 'trunk'
    END
WHERE spelling = 'torso' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('trunk', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'tumble'
      ELSE synonyms || ', ' || 'tumble'
    END
WHERE spelling = 'fall' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('tumble', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'tune'
      ELSE synonyms || ', ' || 'tune'
    END
WHERE spelling = 'strain' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('tune', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'tutor'
      ELSE related_words || ', ' || 'tutor'
    END
WHERE spelling = 'teach' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('tutor', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'tweet'
      ELSE related_words || ', ' || 'tweet'
    END
WHERE spelling = 'digital' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('tweet', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'twin'
      ELSE synonyms || ', ' || 'twin'
    END
WHERE spelling = 'counterpart' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('twin', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ubiquitous'
      ELSE related_words || ', ' || 'ubiquitous'
    END
WHERE spelling = 'present' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ubiquitous', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'ugly'
      ELSE antonyms || ', ' || 'ugly'
    END
WHERE spelling = 'beauty' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ugly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'ultraviolet'
      ELSE related_words || ', ' || 'ultraviolet'
    END
WHERE spelling = 'ray' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('ultraviolet', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'unanimous'
      ELSE related_words || ', ' || 'unanimous'
    END
WHERE spelling = 'agreement' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('unanimous', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'unauthorized'
      ELSE related_words || ', ' || 'unauthorized'
    END
WHERE spelling = 'authority' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('unauthorized', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'underground'
      ELSE related_words || ', ' || 'underground'
    END
WHERE spelling = 'ground' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('underground', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'undone'
      ELSE related_words || ', ' || 'undone'
    END
WHERE spelling = 'reverse' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('undone', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'uneven'
      ELSE synonyms || ', ' || 'uneven'
    END
WHERE spelling = 'odd' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('uneven', ' ', '')) || ','
      ) = 0;
UPDATE words
SET antonyms = CASE
      WHEN TRIM(COALESCE(antonyms, '')) = '' THEN 'unfairly'
      ELSE antonyms || ', ' || 'unfairly'
    END
WHERE spelling = 'fairly' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(antonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('unfairly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'unify'
      ELSE synonyms || ', ' || 'unify'
    END
WHERE spelling = 'unite' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('unify', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'unique'
      ELSE synonyms || ', ' || 'unique'
    END
WHERE spelling = 'alone' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('unique', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'uniquely'
      ELSE related_words || ', ' || 'uniquely'
    END
WHERE spelling = 'personality' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('uniquely', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'unprecedented'
      ELSE related_words || ', ' || 'unprecedented'
    END
WHERE spelling = 'novel' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('unprecedented', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'unrest'
      ELSE related_words || ', ' || 'unrest'
    END
WHERE spelling = 'disorder' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('unrest', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'upbringing'
      ELSE synonyms || ', ' || 'upbringing'
    END
WHERE spelling = 'nurture' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('upbringing', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'upcoming'
      ELSE related_words || ', ' || 'upcoming'
    END
WHERE spelling = 'approach' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('upcoming', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'uproar'
      ELSE related_words || ', ' || 'uproar'
    END
WHERE spelling = 'disorder' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('uproar', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'vegetation'
      ELSE related_words || ', ' || 'vegetation'
    END
WHERE spelling = 'plant' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('vegetation', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'velocity'
      ELSE related_words || ', ' || 'velocity'
    END
WHERE spelling = 'rate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('velocity', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'vending'
      ELSE related_words || ', ' || 'vending'
    END
WHERE spelling = 'sale' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('vending', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'verb'
      ELSE related_words || ', ' || 'verb'
    END
WHERE spelling = 'imperative' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('verb', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'verge'
      ELSE related_words || ', ' || 'verge'
    END
WHERE spelling = 'boundary' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('verge', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'versus'
      ELSE related_words || ', ' || 'versus'
    END
WHERE spelling = 'opponent' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('versus', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'victorious'
      ELSE related_words || ', ' || 'victorious'
    END
WHERE spelling = 'successful' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('victorious', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'vitamin'
      ELSE related_words || ', ' || 'vitamin'
    END
WHERE spelling = 'nutrition' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('vitamin', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'vocation'
      ELSE synonyms || ', ' || 'vocation'
    END
WHERE spelling = 'career' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('vocation', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'vocational'
      ELSE related_words || ', ' || 'vocational'
    END
WHERE spelling = 'profession' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('vocational', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'volcano'
      ELSE related_words || ', ' || 'volcano'
    END
WHERE spelling = 'mount' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('volcano', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'vulgar'
      ELSE synonyms || ', ' || 'vulgar'
    END
WHERE spelling = 'rude' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('vulgar', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'waterfall'
      ELSE related_words || ', ' || 'waterfall'
    END
WHERE spelling = 'flow' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('waterfall', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'waver'
      ELSE synonyms || ', ' || 'waver'
    END
WHERE spelling = 'hesitate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('waver', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'weep'
      ELSE related_words || ', ' || 'weep'
    END
WHERE spelling = 'tear' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('weep', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'whatsoever'
      ELSE synonyms || ', ' || 'whatsoever'
    END
WHERE spelling = 'any' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('whatsoever', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'whistle'
      ELSE related_words || ', ' || 'whistle'
    END
WHERE spelling = 'wind' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('whistle', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'wholly'
      ELSE synonyms || ', ' || 'wholly'
    END
WHERE spelling = 'complete' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('wholly', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'will'
      ELSE related_words || ', ' || 'will'
    END
WHERE spelling = 'anticipate' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('will', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'win'
      ELSE related_words || ', ' || 'win'
    END
WHERE spelling = 'succeed' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('win', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'wireless'
      ELSE related_words || ', ' || 'wireless'
    END
WHERE spelling = 'digital' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('wireless', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'within'
      ELSE related_words || ', ' || 'within'
    END
WHERE spelling = 'internal' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('within', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'workout'
      ELSE synonyms || ', ' || 'workout'
    END
WHERE spelling = 'exercise' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('workout', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'worm'
      ELSE related_words || ', ' || 'worm'
    END
WHERE spelling = 'bug' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('worm', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'wrecked'
      ELSE related_words || ', ' || 'wrecked'
    END
WHERE spelling = 'wreck' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('wrecked', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'wrinkle'
      ELSE synonyms || ', ' || 'wrinkle'
    END
WHERE spelling = 'line' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('wrinkle', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'yard'
      ELSE related_words || ', ' || 'yard'
    END
WHERE spelling = 'ground' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('yard', ' ', '')) || ','
      ) = 0;
UPDATE words
SET synonyms = CASE
      WHEN TRIM(COALESCE(synonyms, '')) = '' THEN 'youngster'
      ELSE synonyms || ', ' || 'youngster'
    END
WHERE spelling = 'minor' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(synonyms, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('youngster', ' ', '')) || ','
      ) = 0;
UPDATE words
SET related_words = CASE
      WHEN TRIM(COALESCE(related_words, '')) = '' THEN 'zealous'
      ELSE related_words || ', ' || 'zealous'
    END
WHERE spelling = 'enthusiastic' COLLATE NOCASE
  AND INSTR(
        ',' || LOWER(REPLACE(COALESCE(related_words, ''), ' ', '')) || ',',
        ',' || LOWER(REPLACE('zealous', ' ', '')) || ','
      ) = 0;

-- 補完章から所属だけを外す。既存マスター語は保持し、0032で新規作成した語だけを削除する。
DELETE FROM list_items
WHERE list_id = 'crossover-v3'
  AND word_id IN (SELECT word_id FROM _migration_0033_members);

DELETE FROM word_audio_jobs
WHERE word_id IN (SELECT word_id FROM _migration_0033_members WHERE word_id LIKE 'supplement-%');
DELETE FROM word_audio
WHERE word_id IN (SELECT word_id FROM _migration_0033_members WHERE word_id LIKE 'supplement-%');
DELETE FROM examples
WHERE word_id IN (SELECT word_id FROM _migration_0033_members WHERE word_id LIKE 'supplement-%');
DELETE FROM derivatives
WHERE word_id IN (SELECT word_id FROM _migration_0033_members WHERE word_id LIKE 'supplement-%');
DELETE FROM senses
WHERE word_id IN (SELECT word_id FROM _migration_0033_members WHERE word_id LIKE 'supplement-%');
DELETE FROM tags
WHERE word_id IN (SELECT word_id FROM _migration_0033_members WHERE word_id LIKE 'supplement-%');
UPDATE words
SET derived_from_id = NULL
WHERE derived_from_id IN (
  SELECT word_id FROM _migration_0033_members WHERE word_id LIKE 'supplement-%'
);
DELETE FROM words
WHERE id IN (SELECT word_id FROM _migration_0033_members WHERE word_id LIKE 'supplement-%');

DELETE FROM section_labels
WHERE list_id = 'crossover-v3'
  AND section_id IN (
    SELECT s.id FROM sections s
    JOIN chapters c ON c.id = s.chapter_id AND c.list_id = s.list_id
    WHERE s.list_id = 'crossover-v3' AND c.subtitle = '主要単語帳の補完語彙'
  );
DELETE FROM sections
WHERE list_id = 'crossover-v3'
  AND chapter_id IN (
    SELECT id FROM chapters
    WHERE list_id = 'crossover-v3' AND subtitle = '主要単語帳の補完語彙'
  );
DELETE FROM section_groups
WHERE list_id = 'crossover-v3'
  AND chapter_id IN (
    SELECT id FROM chapters
    WHERE list_id = 'crossover-v3' AND subtitle = '主要単語帳の補完語彙'
  );
DELETE FROM chapters
WHERE list_id = 'crossover-v3' AND subtitle = '主要単語帳の補完語彙';

DROP TABLE _migration_0033_members;

