-- Transactional change journal: publishing is event driven, never polled by cron.
-- Keep journal lookups and section rebuilds proportional to the changed scope.
CREATE INDEX IF NOT EXISTS idx_snapshot_list_items_word ON list_items(word_id, list_id, section_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_list_items_section ON list_items(list_id, section_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_idioms_section ON idioms(list_id, section_key);
CREATE TABLE IF NOT EXISTS viewer_snapshot_dirty (
 list_id TEXT NOT NULL, kind TEXT NOT NULL, section_key TEXT NOT NULL DEFAULT '',
 revision TEXT NOT NULL, PRIMARY KEY(list_id, kind, section_key)
);

CREATE TRIGGER viewer_snapshot_words_insert AFTER INSERT ON words BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_words_update AFTER UPDATE ON words BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_words_delete BEFORE DELETE ON words BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_senses_insert AFTER INSERT ON senses BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_senses_update AFTER UPDATE ON senses BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_senses_delete BEFORE DELETE ON senses BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_derivatives_insert AFTER INSERT ON derivatives BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_derivatives_update AFTER UPDATE ON derivatives BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_derivatives_delete BEFORE DELETE ON derivatives BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_examples_insert AFTER INSERT ON examples BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_examples_update AFTER UPDATE ON examples BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_examples_delete BEFORE DELETE ON examples BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_tags_insert AFTER INSERT ON tags BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_tags_update AFTER UPDATE ON tags BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_tags_delete BEFORE DELETE ON tags BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'viewer-index', '', lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_word_audio_insert AFTER INSERT ON word_audio BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_word_audio_update AFTER UPDATE ON word_audio BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_word_audio_delete BEFORE DELETE ON word_audio BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_word_illustrations_insert AFTER INSERT ON word_illustrations BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_word_illustrations_update AFTER UPDATE ON word_illustrations BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_word_illustrations_delete BEFORE DELETE ON word_illustrations BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_illustration_jobs_insert AFTER INSERT ON illustration_jobs BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_illustration_jobs_update AFTER UPDATE ON illustration_jobs BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_illustration_jobs_delete BEFORE DELETE ON illustration_jobs BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_list_items_insert AFTER INSERT ON list_items BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'word-section', COALESCE(CAST(NEW.section_id AS TEXT),'none'), lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_list_items_update AFTER UPDATE ON list_items BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'word-section', COALESCE(CAST(OLD.section_id AS TEXT),'none'), lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'word-section', COALESCE(CAST(NEW.section_id AS TEXT),'none'), lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_list_items_delete BEFORE DELETE ON list_items BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'word-section', COALESCE(CAST(OLD.section_id AS TEXT),'none'), lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_chapters_insert AFTER INSERT ON chapters BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=NEW.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_chapters_update AFTER UPDATE ON chapters BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=OLD.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=NEW.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_chapters_delete BEFORE DELETE ON chapters BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=OLD.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_section_groups_insert AFTER INSERT ON section_groups BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=NEW.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_section_groups_update AFTER UPDATE ON section_groups BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=OLD.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=NEW.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_section_groups_delete BEFORE DELETE ON section_groups BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=OLD.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_sections_insert AFTER INSERT ON sections BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=NEW.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_sections_update AFTER UPDATE ON sections BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=OLD.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=NEW.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_sections_delete BEFORE DELETE ON sections BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=OLD.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_section_labels_insert AFTER INSERT ON section_labels BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'word-section', CAST(NEW.section_id AS TEXT), lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_section_labels_update AFTER UPDATE ON section_labels BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'word-section', CAST(OLD.section_id AS TEXT), lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'word-section', CAST(NEW.section_id AS TEXT), lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_section_labels_delete BEFORE DELETE ON section_labels BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'word-section', CAST(OLD.section_id AS TEXT), lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_lists_insert AFTER INSERT ON lists BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT '', 'catalog', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=NEW.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_lists_update AFTER UPDATE ON lists BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT '', 'catalog', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=OLD.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT '', 'catalog', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=NEW.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_lists_delete BEFORE DELETE ON lists BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT '', 'catalog', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.id, 'viewer-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items li WHERE li.list_id=OLD.id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_sections_insert AFTER INSERT ON idiom_sections BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'idiom-section', NEW.section_key, lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_sections_update AFTER UPDATE ON idiom_sections BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'idiom-section', OLD.section_key, lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'idiom-section', NEW.section_key, lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_sections_delete BEFORE DELETE ON idiom_sections BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'idiom-section', OLD.section_key, lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idioms_insert AFTER INSERT ON idioms BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'idiom-section', NEW.section_key, lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM idiom_senses s JOIN idiom_word_refs wr ON wr.sense_id=s.id JOIN list_items li ON li.word_id=wr.word_id WHERE s.idiom_id=NEW.id AND li.list_id=NEW.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idioms_update AFTER UPDATE ON idioms BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'idiom-section', OLD.section_key, lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM idiom_senses s JOIN idiom_word_refs wr ON wr.sense_id=s.id JOIN list_items li ON li.word_id=wr.word_id WHERE s.idiom_id=OLD.id AND li.list_id=OLD.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT NEW.list_id, 'idiom-section', NEW.section_key, lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM idiom_senses s JOIN idiom_word_refs wr ON wr.sense_id=s.id JOIN list_items li ON li.word_id=wr.word_id WHERE s.idiom_id=NEW.id AND li.list_id=NEW.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idioms_delete BEFORE DELETE ON idioms BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'idiom-index', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT OLD.list_id, 'idiom-section', OLD.section_key, lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id,'word-section',COALESCE(CAST(li.section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM idiom_senses s JOIN idiom_word_refs wr ON wr.sense_id=s.id JOIN list_items li ON li.word_id=wr.word_id WHERE s.idiom_id=OLD.id AND li.list_id=OLD.list_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_senses_insert AFTER INSERT ON idiom_senses BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=NEW.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-index', '', lower(hex(randomblob(16))) FROM idioms i WHERE i.id=NEW.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_senses_update AFTER UPDATE ON idiom_senses BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=OLD.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-index', '', lower(hex(randomblob(16))) FROM idioms i WHERE i.id=OLD.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=NEW.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-index', '', lower(hex(randomblob(16))) FROM idioms i WHERE i.id=NEW.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_senses_delete BEFORE DELETE ON idiom_senses BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=OLD.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-index', '', lower(hex(randomblob(16))) FROM idioms i WHERE i.id=OLD.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_word_refs_insert AFTER INSERT ON idiom_word_refs BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=(SELECT idiom_id FROM idiom_senses WHERE id=NEW.sense_id) ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-index', '', lower(hex(randomblob(16))) FROM idioms i WHERE i.id=(SELECT idiom_id FROM idiom_senses WHERE id=NEW.sense_id) ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_word_refs_update AFTER UPDATE ON idiom_word_refs BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=(SELECT idiom_id FROM idiom_senses WHERE id=OLD.sense_id) ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-index', '', lower(hex(randomblob(16))) FROM idioms i WHERE i.id=(SELECT idiom_id FROM idiom_senses WHERE id=OLD.sense_id) ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=(SELECT idiom_id FROM idiom_senses WHERE id=NEW.sense_id) ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-index', '', lower(hex(randomblob(16))) FROM idioms i WHERE i.id=(SELECT idiom_id FROM idiom_senses WHERE id=NEW.sense_id) ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=NEW.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_word_refs_delete BEFORE DELETE ON idiom_word_refs BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=(SELECT idiom_id FROM idiom_senses WHERE id=OLD.sense_id) ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-index', '', lower(hex(randomblob(16))) FROM idioms i WHERE i.id=(SELECT idiom_id FROM idiom_senses WHERE id=OLD.sense_id) ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT li.list_id, 'word-section', COALESCE(CAST(li.section_id AS TEXT),'none'), lower(hex(randomblob(16))) FROM list_items li WHERE li.word_id=OLD.word_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_illustrations_insert AFTER INSERT ON idiom_illustrations BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=NEW.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_illustrations_update AFTER UPDATE ON idiom_illustrations BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=OLD.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=NEW.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_illustrations_delete BEFORE DELETE ON idiom_illustrations BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=OLD.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_illustration_jobs_insert AFTER INSERT ON idiom_illustration_jobs BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=NEW.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_illustration_jobs_update AFTER UPDATE ON idiom_illustration_jobs BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=OLD.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=NEW.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

CREATE TRIGGER viewer_snapshot_idiom_illustration_jobs_delete BEFORE DELETE ON idiom_illustration_jobs BEGIN
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT i.list_id, 'idiom-section', i.section_key, lower(hex(randomblob(16))) FROM idioms i WHERE i.id=OLD.idiom_id ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
END;

INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT '', 'catalog', '', lower(hex(randomblob(16))) WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT id,'viewer-index','',lower(hex(randomblob(16))) FROM lists WHERE id!='__master__' AND id NOT LIKE 'awl-sublist-%' AND id NOT LIKE 'oxford5000-%' ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT id,'idiom-index','',lower(hex(randomblob(16))) FROM lists WHERE id!='__master__' AND id NOT LIKE 'awl-sublist-%' AND id NOT LIKE 'oxford5000-%' ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT list_id,'word-section',COALESCE(CAST(section_id AS TEXT),'none'),lower(hex(randomblob(16))) FROM list_items WHERE list_id!='__master__' AND list_id NOT LIKE 'awl-sublist-%' AND list_id NOT LIKE 'oxford5000-%' ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) SELECT list_id,'idiom-section',section_key,lower(hex(randomblob(16))) FROM idiom_sections WHERE 1 ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
