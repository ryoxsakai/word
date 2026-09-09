-- Add the synonym only to the disappointment sense, preserving all existing refs.
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, li.word_id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id = s.idiom_id
JOIN list_items li ON li.list_id = i.list_id AND li.word_id = 'disappoint'
WHERE i.list_id = 'crossover-v3'
  AND i.id = 'crossover-idiom-7528c72e52b5b45f9f756667'
  AND s.meaning = 'Oを失望させる';
