CREATE TABLE section_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id TEXT NOT NULL,
  section_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (list_id) REFERENCES lists(id),
  FOREIGN KEY (section_id) REFERENCES sections(id)
);

CREATE INDEX idx_section_labels_list_section_sort
  ON section_labels(list_id, section_id, sort_order, id);

ALTER TABLE list_items ADD COLUMN label_id INTEGER REFERENCES section_labels(id);

CREATE INDEX idx_list_items_label_id ON list_items(label_id);
