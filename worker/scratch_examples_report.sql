SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN translation IS NULL OR TRIM(translation) = '' THEN 1 ELSE 0 END) AS missing_translation,
  SUM(CASE WHEN sentence GLOB '[a-z]*' THEN 1 ELSE 0 END) AS lowercase_start,
  SUM(CASE WHEN
        sentence NOT GLOB '*.' AND sentence NOT GLOB '*?' AND sentence NOT GLOB '*!'
        AND sentence NOT GLOB '*."' AND sentence NOT GLOB '*?"' AND sentence NOT GLOB '*!"'
        AND sentence NOT GLOB '*.'||char(8221) AND sentence NOT GLOB '*?'||char(8221) AND sentence NOT GLOB '*!'||char(8221)
        AND sentence NOT GLOB '*.'||char(8217) AND sentence NOT GLOB '*?'||char(8217) AND sentence NOT GLOB '*!'||char(8217)
      THEN 1 ELSE 0 END) AS missing_terminal_punct,
  SUM(CASE WHEN type = 'example' THEN 1 ELSE 0 END) AS type_example,
  SUM(CASE WHEN type = 'phrase' THEN 1 ELSE 0 END) AS type_phrase
FROM examples;

SELECT w.spelling, e.type, e.sentence, e.translation
FROM examples e JOIN words w ON w.id = e.word_id
WHERE (e.translation IS NULL OR TRIM(e.translation) = '')
   OR e.sentence GLOB '[a-z]*'
   OR (
        e.sentence NOT GLOB '*.' AND e.sentence NOT GLOB '*?' AND e.sentence NOT GLOB '*!'
        AND e.sentence NOT GLOB '*."' AND e.sentence NOT GLOB '*?"' AND e.sentence NOT GLOB '*!"'
        AND e.sentence NOT GLOB '*.'||char(8221) AND e.sentence NOT GLOB '*?'||char(8221) AND e.sentence NOT GLOB '*!'||char(8221)
        AND e.sentence NOT GLOB '*.'||char(8217) AND e.sentence NOT GLOB '*?'||char(8217) AND e.sentence NOT GLOB '*!'||char(8217)
      )
ORDER BY w.spelling
LIMIT 500;
