-- One-time upgrade of existing notebook indexes. Reuse section JSON unchanged.
-- The editor wakes the publisher if the structure has not been published yet.
INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision)
SELECT id, 'viewer-index', '', lower(hex(randomblob(16))) FROM lists WHERE 1
ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision;
