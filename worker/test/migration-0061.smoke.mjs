import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync(new URL("../migrations/0061_examples_to_phrases.sql", import.meta.url), "utf8");
const db = new DatabaseSync(":memory:");

db.exec(`
  CREATE TABLE examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id TEXT NOT NULL,
    sentence TEXT NOT NULL,
    answer TEXT,
    translation TEXT,
    type TEXT
  );
  INSERT INTO examples (word_id, sentence, answer, translation, type) VALUES
    ('take', 'take a ＿＿', 'bus', 'バスに乗る', 'example'),
    ('take', 'take a break', NULL, '休憩する', 'phrase'),
    ('make', 'make sense', NULL, NULL, NULL);
`);

db.exec(migration);

// 種類だけをフレーズに変え、文・訳・穴埋めの答えは残す。
assert.deepEqual(
  db.prepare("SELECT sentence, answer, translation, type FROM examples ORDER BY id").all().map((row) => ({ ...row })),
  [
    { sentence: "take a ＿＿", answer: "bus", translation: "バスに乗る", type: "phrase" },
    { sentence: "take a break", answer: null, translation: "休憩する", type: "phrase" },
    { sentence: "make sense", answer: null, translation: null, type: "phrase" },
  ]
);

const once = db.prepare("SELECT * FROM examples ORDER BY id").all();
db.exec(migration);
assert.deepEqual(db.prepare("SELECT * FROM examples ORDER BY id").all(), once);

console.log("migration 0061 smoke test passed");
