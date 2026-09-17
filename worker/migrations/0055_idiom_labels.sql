-- Labels belong to an idiom Section. JSON array order is the label display order.
ALTER TABLE idiom_sections ADD COLUMN labels TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(labels) AND json_type(labels) = 'array');
ALTER TABLE idioms ADD COLUMN label_key TEXT;
CREATE TRIGGER idiom_label_insert BEFORE INSERT ON idioms WHEN NEW.label_key IS NOT NULL
BEGIN
 SELECT RAISE(ABORT,'Unknown idiom label in section') WHERE NOT EXISTS (SELECT 1 FROM idiom_sections s, json_each(s.labels) l WHERE s.list_id=NEW.list_id AND s.section_key=NEW.section_key AND json_extract(l.value,'$.key')=NEW.label_key);
END;
CREATE TRIGGER idiom_label_update BEFORE UPDATE OF label_key, section_key, list_id ON idioms WHEN NEW.label_key IS NOT NULL
BEGIN
 SELECT RAISE(ABORT,'Unknown idiom label in section') WHERE NOT EXISTS (SELECT 1 FROM idiom_sections s, json_each(s.labels) l WHERE s.list_id=NEW.list_id AND s.section_key=NEW.section_key AND json_extract(l.value,'$.key')=NEW.label_key);
END;
CREATE TRIGGER idiom_labels_update BEFORE UPDATE OF labels ON idiom_sections
BEGIN
 SELECT RAISE(ABORT,'Cannot remove an assigned idiom label') WHERE EXISTS (SELECT 1 FROM idioms i WHERE i.list_id=NEW.list_id AND i.section_key=NEW.section_key AND i.label_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM json_each(NEW.labels) l WHERE json_extract(l.value,'$.key')=i.label_key));
END;
