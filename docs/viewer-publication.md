# Incremental viewer publication

The editing database remains D1. Public viewing reads separately stored R2 snapshots. Data shards are scoped by notebook and Section; completed HTML is scoped by Chapter. The home page embeds Crossover Chapter 1. Subsequent chapters use completed HTML and a content-hash keyed device cache. Search uses separate chapter indexes; print consumes the Section JSON snapshots. Updating one chapter does not rewrite a whole-book search corpus.

## Updates

Migration 0057 adds a transactional dirty journal and triggers. REST/MCP/import writes wake one Durable Object publisher. It rebuilds affected Section shards, affected Chapter HTML, dependent cross-reference chapters, and lightweight indexes. Unchanged object hashes are reused. Moves invalidate both old and new Sections. There is no scheduled cron and no idle polling.

The publisher saves resumable progress, acknowledges only the exact journal revision it processed, and switches `current.json` after all pending changes and chapter builds are complete. A failed generation leaves the previous publication visible and retries up to six times. A later edit or explicit wake retries stalled work.

Direct SQL writes are journaled but cannot wake a Worker. After direct SQL maintenance, POST `/mcp-viewer-publish` using a `vocab:write` OAuth bearer or the `VIEWER_PUBLISH_TOKEN` secret. GET on that endpoint reports building/ready/failed status. Do not store tokens in this repository.

## Deployment and recovery

1. Apply migration 0057 and provision `vocab-viewer-snapshots`.
2. Deploy the Worker with `VIEWER_STATIC_ENABLED=false`, the R2 binding and SQLite Durable Object binding.
3. Wake the publisher once; wait for ready. This initial build reads existing D1 content once per shard.
4. Enable `VIEWER_STATIC_ENABLED=true` only after initial publication. Add the dashboard route `vocab.lrnr.jp/*` to `vocab-app`, keeping existing MCP/OAuth routes. Root paths use R2 HTML; other Pages paths pass through to their existing origin. `run_worker_first` is required for the generated root page.
5. Verify root HTML, Chapter endpoints, search, media, print and navigation. Viewer code has no D1 fallback on snapshot failure.

To roll back serving, set `VIEWER_STATIC_ENABLED=false`; the root passes through to Pages and API reads use the prior handler. Keep bindings and journal so edits are not lost. On template/renderer-only releases, explicitly enqueue the affected chapter/section scopes and wake publishing; deploying code alone does not regenerate existing content. Content-addressed objects currently remain in R2 for recovery; serving exposes only the current manifest.

Tests: `npm --prefix worker run test:snapshots` and `node .github/tests/static-chapters.integration.mjs`.
