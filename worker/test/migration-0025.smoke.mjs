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
  CREATE TABLE word_audio (
    word_id TEXT NOT NULL,
    variant_key TEXT NOT NULL DEFAULT 'primary',
    is_stale INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (word_id, variant_key)
  );
  INSERT INTO words VALUES ('permit', 'permit', '/pəˈmɪt/');
  INSERT INTO words VALUES ('refuse', 'refuse', '/rɪˈfjuːz/');
  INSERT INTO word_audio VALUES ('refuse', 'primary', 0);
`);

const migration = readFileSync(
  new URL("../migrations/0025_automatic_word_audio.sql", import.meta.url),
  "utf8"
);
db.exec(migration);

assert.deepEqual(
  db.prepare("SELECT word_id AS wordId FROM word_audio_jobs ORDER BY word_id").all().map((row) => row.wordId),
  ["permit"]
);

db.exec("INSERT INTO words VALUES ('record', 'record', '/rɪˈkɔːrd/')");
assert.equal(
  db.prepare("SELECT COUNT(*) AS count FROM word_audio_jobs WHERE word_id = 'record'").get().count,
  1
);

db.exec("UPDATE words SET pronunciation = NULL WHERE id = 'record'");
assert.equal(
  db.prepare("SELECT COUNT(*) AS count FROM word_audio_jobs WHERE word_id = 'record'").get().count,
  0
);

db.exec("UPDATE words SET pronunciation = '/ˈrekərd/' WHERE id = 'record'");
assert.equal(
  db.prepare("SELECT attempts, status FROM word_audio_jobs WHERE word_id = 'record'").get().status,
  "pending"
);

console.log("migration 0025 smoke test passed");
