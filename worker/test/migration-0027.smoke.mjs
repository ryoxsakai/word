import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE words (
    id TEXT PRIMARY KEY,
    spelling TEXT NOT NULL,
    pronunciation TEXT,
    pronunciation_caution INTEGER NOT NULL DEFAULT 0,
    audio_url TEXT
  );
  CREATE TABLE list_items (
    list_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    PRIMARY KEY (list_id, word_id)
  );
  CREATE TABLE word_audio (
    word_id TEXT NOT NULL,
    variant_key TEXT NOT NULL DEFAULT 'primary',
    provider TEXT NOT NULL,
    is_stale INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (word_id, variant_key)
  );
  CREATE TABLE word_audio_jobs (
    word_id TEXT NOT NULL,
    variant_key TEXT NOT NULL DEFAULT 'primary',
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (word_id, variant_key)
  );
  INSERT INTO words VALUES ('do', 'do', '/dʉː/', 0, '/audio/do');
  INSERT INTO words VALUES ('come', 'come', '/kʌm/', 0, '/audio/come');
  INSERT INTO words VALUES ('permit', 'permit', '/pəˈmɪt/', 1, '/audio/permit');
  INSERT INTO words VALUES ('outside', 'outside', '/ˌaʊtˈsaɪd/', 0, '/audio/outside');
  INSERT INTO list_items VALUES ('crossover-v3', 'do');
  INSERT INTO list_items VALUES ('crossover-v3', 'come');
  INSERT INTO list_items VALUES ('crossover-v3', 'permit');
  INSERT INTO list_items VALUES ('another-list', 'outside');
  INSERT INTO word_audio VALUES ('do', 'primary', 'elevenlabs', 0);
  INSERT INTO word_audio VALUES ('come', 'primary', 'elevenlabs', 0);
  INSERT INTO word_audio VALUES ('permit', 'primary', 'elevenlabs', 0);
  INSERT INTO word_audio VALUES ('outside', 'primary', 'elevenlabs', 0);
  INSERT INTO word_audio_jobs (word_id, status, attempts, last_error) VALUES ('outside', 'retry', 2, 'old');
`);

db.exec(readFileSync(new URL("../migrations/0027_pronunciation_generation_mode.sql", import.meta.url), "utf8"));

assert.equal(db.prepare("SELECT pronunciation FROM words WHERE id = 'do'").get().pronunciation, "/duː/");
assert.equal(db.prepare("SELECT audio_url AS audioUrl FROM words WHERE id = 'do'").get().audioUrl, null);
assert.equal(db.prepare("SELECT is_stale AS isStale FROM word_audio WHERE word_id = 'do'").get().isStale, 1);
assert.equal(db.prepare("SELECT is_stale AS isStale FROM word_audio WHERE word_id = 'outside'").get().isStale, 0);
assert.equal(db.prepare("SELECT audio_url AS audioUrl FROM words WHERE id = 'outside'").get().audioUrl, "/audio/outside");
assert.deepEqual(
  db.prepare("SELECT word_id AS wordId, status, attempts FROM word_audio_jobs ORDER BY word_id").all()
    .map((row) => ({ ...row })),
  [
    { wordId: "come", status: "pending", attempts: 0 },
    { wordId: "do", status: "pending", attempts: 0 },
    { wordId: "permit", status: "pending", attempts: 0 },
  ]
);

console.log("migration 0027 smoke test passed");
