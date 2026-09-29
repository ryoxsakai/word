# Notebook editor snapshots

The authenticated notebook editor reads its catalog, lightweight word index, section rows,
chapter/section/label metadata, and phrase/derivative/idiom references from the existing
R2 viewer publication. OAuth still runs before any editor snapshot is served. Missing
or broken snapshots return an error; they never fall back to a D1 query.

D1 remains the authority for opening an individual word's edit form, saving changes,
and the global word master. The separate idiom editing application is unchanged.

`viewer-index` snapshots now include `editorStructure` so empty chapters/sections and
unused labels remain editable. Migration 0058 queues a one-time index upgrade; an
editor request encountering an old index wakes the existing publisher. Section JSON
is reused. Future saves use the existing transactional journal and rebuild only affected
sections and indexes (plus dependent viewer HTML), without a periodic full rebuild.

The word editor patches the saved row in its current notebook's index, loaded sections,
and reference cache. It retains unrelated notebook caches and invalidates other
notebooks containing the changed word. A localStorage publication marker survives
reloads: subsequent snapshot reads wait for the publisher's durable state to be idle.
Read retries never replay a mutation. If publication remains unavailable, the save stays
committed and the read reports that the saved change is still being reflected.

Validation:

- `npm run test:snapshots` compares R2 editor responses with the original D1 responses,
  including empty sections and labels. Authenticated serving replaces D1 with a stub
  that throws on access; initialization, ETag 304, missing objects, moves and deletion
  are also covered. It checks the legacy snapshot upgrade and unchanged section reuse.
- `npm run test:editor-cache` covers lazy loading, saved row/cache/reference updates,
  moving a word to another or no section, removing a label, retaining unrelated caches,
  persisted read-after-write barriers and refusing to retry writes.
- `node .github/tests/editor-order.integration.mjs` and
  `node worker/test/editor-auth.test.mjs` cover order and authentication regressions.

Production verification should confirm `x-editor-source: r2` on notebook reads after
migration/publication and test normal opening, switching sections, and saving a word.
The header does not apply to the single-word edit form or global master endpoints.
