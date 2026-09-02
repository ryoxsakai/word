import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync(new URL("../migrations/0034_normalize_sense_brackets.sql", import.meta.url), "utf8");
const db = new DatabaseSync(":memory:");

db.exec(`
  CREATE TABLE senses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meaning TEXT NOT NULL
  );
  INSERT INTO senses (meaning) VALUES
    ('〔the ～〕(～の)大半'),
    ('【英】勘定書'),
    ('〔the ～〕【米】辺境地'),
    ('すでに(半角)');
`);

db.exec(migration);

assert.deepEqual(
  db.prepare("SELECT meaning FROM senses ORDER BY id").all().map((row) => row.meaning),
  ["(the ～)(～の)大半", "(英)勘定書", "(the ～)(米)辺境地", "すでに(半角)"]
);

const once = db.prepare("SELECT meaning FROM senses ORDER BY id").all();
db.exec(migration);
assert.deepEqual(db.prepare("SELECT meaning FROM senses ORDER BY id").all(), once);

console.log("migration 0034 smoke test passed");
