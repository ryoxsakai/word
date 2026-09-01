-- 類義語・対義語には収まりにくい、意味・分野・用法上の関連語を独立して管理する。
ALTER TABLE words ADD COLUMN related_words TEXT;

-- 既存の類義語欄に入っていた上下位関係・分野近接語を、より正確な「関連語」へ移す。
-- 値がレビュー時点から変わっている場合は上書きせず、同時編集を保護する。
UPDATE words SET synonyms = 'health-related', related_words = 'clinical'
WHERE id = 'medical' AND synonyms = 'clinical, health-related';
UPDATE words SET synonyms = NULL, related_words = 'unit, compartment'
WHERE id = 'cell' AND synonyms = 'unit, compartment';
UPDATE words SET synonyms = 'computerized', related_words = 'electronic'
WHERE id = 'digital' AND synonyms = 'computerized, electronic';
UPDATE words SET synonyms = 'hostile, forceful', related_words = 'intensive'
WHERE id = 'aggressive' AND synonyms = 'hostile, forceful, intensive';
UPDATE words SET synonyms = 'bovines', related_words = 'livestock'
WHERE id = 'cattle' AND synonyms = 'livestock, bovines';
UPDATE words SET synonyms = 'polypeptide', related_words = 'nutrient'
WHERE id = 'protein' AND synonyms = 'polypeptide, nutrient';
UPDATE words SET synonyms = 'present', related_words = 'organizer'
WHERE id = 'host' AND synonyms = 'organizer, present';
UPDATE words SET synonyms = 'old', related_words = 'prehistoric'
WHERE id = 'ancient' AND synonyms = 'old, prehistoric';
UPDATE words SET synonyms = 'casualty', related_words = 'sufferer'
WHERE id = 'victim' AND synonyms = 'casualty, sufferer';
UPDATE words SET synonyms = 'being, organization', related_words = 'unit'
WHERE id = 'entity' AND synonyms = 'being, unit, organization';
