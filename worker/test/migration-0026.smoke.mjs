import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE words (
    id TEXT PRIMARY KEY,
    spelling TEXT NOT NULL,
    pronunciation TEXT
  );
  CREATE TABLE list_items (
    list_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    PRIMARY KEY (list_id, word_id)
  );
  CREATE TABLE word_audio (
    word_id TEXT NOT NULL,
    variant_key TEXT NOT NULL DEFAULT 'primary',
    is_stale INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (word_id, variant_key)
  );
  INSERT INTO words VALUES ('inside', 'inside', '/ɪnˈsaɪd/');
  INSERT INTO words VALUES ('outside', 'outside', '/ˌaʊtˈsaɪd/');
  INSERT INTO words VALUES ('silent', 'silent', NULL);
  INSERT INTO list_items VALUES ('crossover-v3', 'inside');
  INSERT INTO list_items VALUES ('another-list', 'outside');
`);

db.exec(readFileSync(new URL("../migrations/0025_automatic_word_audio.sql", import.meta.url), "utf8"));
db.exec(readFileSync(new URL("../migrations/0026_crossover_audio_scope.sql", import.meta.url), "utf8"));

const queuedIds = () => db
  .prepare("SELECT word_id AS wordId FROM word_audio_jobs ORDER BY word_id")
  .all()
  .map((row) => row.wordId);

assert.deepEqual(queuedIds(), ["inside"]);

db.exec("INSERT INTO words VALUES ('later', 'later', '/ˈleɪtər/')");
assert.deepEqual(queuedIds(), ["inside"]);
db.exec("INSERT INTO list_items VALUES ('crossover-v3', 'later')");
assert.deepEqual(queuedIds(), ["inside", "later"]);

db.exec("UPDATE words SET pronunciation = '/ˈaʊt.saɪd/' WHERE id = 'outside'");
assert.deepEqual(queuedIds(), ["inside", "later"]);
db.exec("UPDATE words SET pronunciation = '/ˈɪn.saɪd/' WHERE id = 'inside'");
assert.deepEqual(queuedIds(), ["inside", "later"]);

db.exec("DELETE FROM list_items WHERE list_id = 'crossover-v3' AND word_id = 'later'");
assert.deepEqual(queuedIds(), ["inside"]);

console.log("migration 0026 smoke test passed");
