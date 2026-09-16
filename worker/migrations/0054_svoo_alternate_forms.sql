-- Add reviewed prepositional alternants without changing headings, senses or numbering.

-- do A good / do good to A
INSERT OR IGNORE INTO idiom_migration_backup (migration_key, word_id, snapshot)
SELECT '0054_svoo_alternate_forms', id, json_object('phrase',phrase,'alternate_forms',json(alternate_forms),'updated_at',updated_at)
FROM idioms WHERE id='grammar-idiom-6478579e37aff45f013e' AND list_id='crossover-v3' AND phrase='do A good';
UPDATE idioms SET alternate_forms=json_insert(alternate_forms,'$[#]','do good to A'),updated_at=datetime('now')
WHERE id='grammar-idiom-6478579e37aff45f013e' AND list_id='crossover-v3' AND phrase='do A good'
AND NOT EXISTS (SELECT 1 FROM json_each(alternate_forms) WHERE lower(trim(value))=lower('do good to A'));

-- do A harm / do harm to A
INSERT OR IGNORE INTO idiom_migration_backup (migration_key, word_id, snapshot)
SELECT '0054_svoo_alternate_forms', id, json_object('phrase',phrase,'alternate_forms',json(alternate_forms),'updated_at',updated_at)
FROM idioms WHERE id='grammar-idiom-78423c5c75bd52f83b63' AND list_id='crossover-v3' AND phrase='do A harm';
UPDATE idioms SET alternate_forms=json_insert(alternate_forms,'$[#]','do harm to A'),updated_at=datetime('now')
WHERE id='grammar-idiom-78423c5c75bd52f83b63' AND list_id='crossover-v3' AND phrase='do A harm'
AND NOT EXISTS (SELECT 1 FROM json_each(alternate_forms) WHERE lower(trim(value))=lower('do harm to A'));

-- do A damage / do damage to A
INSERT OR IGNORE INTO idiom_migration_backup (migration_key, word_id, snapshot)
SELECT '0054_svoo_alternate_forms', id, json_object('phrase',phrase,'alternate_forms',json(alternate_forms),'updated_at',updated_at)
FROM idioms WHERE id='grammar-idiom-333cc36144b0fbf04522' AND list_id='crossover-v3' AND phrase='do A damage';
UPDATE idioms SET alternate_forms=json_insert(alternate_forms,'$[#]','do damage to A'),updated_at=datetime('now')
WHERE id='grammar-idiom-333cc36144b0fbf04522' AND list_id='crossover-v3' AND phrase='do A damage'
AND NOT EXISTS (SELECT 1 FROM json_each(alternate_forms) WHERE lower(trim(value))=lower('do damage to A'));

-- do A justice / do justice to A
INSERT OR IGNORE INTO idiom_migration_backup (migration_key, word_id, snapshot)
SELECT '0054_svoo_alternate_forms', id, json_object('phrase',phrase,'alternate_forms',json(alternate_forms),'updated_at',updated_at)
FROM idioms WHERE id='e556799f-4495-4e23-a2b8-1c666d825fec' AND list_id='crossover-v3' AND phrase='do A justice';
UPDATE idioms SET alternate_forms=json_insert(alternate_forms,'$[#]','do justice to A'),updated_at=datetime('now')
WHERE id='e556799f-4495-4e23-a2b8-1c666d825fec' AND list_id='crossover-v3' AND phrase='do A justice'
AND NOT EXISTS (SELECT 1 FROM json_each(alternate_forms) WHERE lower(trim(value))=lower('do justice to A'));

-- do A a favor / do a favor for A
INSERT OR IGNORE INTO idiom_migration_backup (migration_key, word_id, snapshot)
SELECT '0054_svoo_alternate_forms', id, json_object('phrase',phrase,'alternate_forms',json(alternate_forms),'updated_at',updated_at)
FROM idioms WHERE id='grammar-idiom-61f24e9a062efbe037cc' AND list_id='crossover-v3' AND phrase='do A a favor';
UPDATE idioms SET alternate_forms=json_insert(alternate_forms,'$[#]','do a favor for A'),updated_at=datetime('now')
WHERE id='grammar-idiom-61f24e9a062efbe037cc' AND list_id='crossover-v3' AND phrase='do A a favor'
AND NOT EXISTS (SELECT 1 FROM json_each(alternate_forms) WHERE lower(trim(value))=lower('do a favor for A'));

-- ask A a favor / ask a favor of A
INSERT OR IGNORE INTO idiom_migration_backup (migration_key, word_id, snapshot)
SELECT '0054_svoo_alternate_forms', id, json_object('phrase',phrase,'alternate_forms',json(alternate_forms),'updated_at',updated_at)
FROM idioms WHERE id='grammar-idiom-16f45f03f02d7e69268a' AND list_id='crossover-v3' AND phrase='ask A a favor';
UPDATE idioms SET alternate_forms=json_insert(alternate_forms,'$[#]','ask a favor of A'),updated_at=datetime('now')
WHERE id='grammar-idiom-16f45f03f02d7e69268a' AND list_id='crossover-v3' AND phrase='ask A a favor'
AND NOT EXISTS (SELECT 1 FROM json_each(alternate_forms) WHERE lower(trim(value))=lower('ask a favor of A'));
