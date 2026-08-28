import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { cefrLevelClass, effectiveCefrLevel, normalizeCefrLevel } from "../../public/shared/learning-tags.js";

assert.equal(normalizeCefrLevel(" c2 "), "C2");
assert.equal(normalizeCefrLevel("D1"), "");
assert.equal(effectiveCefrLevel({ oxford5000: "B2", cefr_provisional: "C1" }), "B2");
assert.equal(effectiveCefrLevel({ cefr_provisional: "C1" }), "C1");
assert.equal(cefrLevelClass("A1"), "cefr-a1");

const migration = readFileSync(new URL("../migrations/0023_seed_provisional_cefr.sql", import.meta.url), "utf8");
const assignments = [...migration.matchAll(/\('([^']+)', '(A1|A2|B1|B2|C1|C2)'\)/g)].map((match) => ({
  wordId: match[1],
  level: match[2],
}));

assert.equal(assignments.length, 134);
assert.equal(new Set(assignments.map(({ wordId }) => wordId)).size, 134);
assert.deepEqual(
  Object.fromEntries(["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => [
    level,
    assignments.filter((assignment) => assignment.level === level).length,
  ])),
  { A1: 0, A2: 1, B1: 22, B2: 60, C1: 44, C2: 7 }
);

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE words (id TEXT PRIMARY KEY, spelling TEXT NOT NULL);
  CREATE TABLE list_items (list_id TEXT NOT NULL, word_id TEXT NOT NULL);
  CREATE TABLE tags (
    word_id TEXT NOT NULL,
    tag_key TEXT NOT NULL,
    tag_value TEXT,
    PRIMARY KEY (word_id, tag_key)
  );
`);
for (const { wordId } of assignments) {
  db.prepare("INSERT INTO words (id, spelling) VALUES (?, ?)").run(wordId, wordId);
  db.prepare("INSERT INTO list_items (list_id, word_id) VALUES ('crossover-v3', ?)").run(wordId);
}

// 公式CEFRがある語と既に手修正した暫定値は、移行で上書きしない。
db.exec("INSERT INTO tags VALUES ('envy', 'oxford5000', 'B2')");
db.exec("INSERT INTO tags VALUES ('awake', 'cefr_provisional', 'B1')");
db.exec(migration);

assert.equal(db.prepare("SELECT tag_value FROM tags WHERE word_id = 'envy' AND tag_key = 'cefr_provisional'").get(), undefined);
assert.equal(db.prepare("SELECT tag_value AS level FROM tags WHERE word_id = 'awake' AND tag_key = 'cefr_provisional'").get().level, "B1");
assert.equal(db.prepare("SELECT tag_value AS level FROM tags WHERE word_id = 'stipulate' AND tag_key = 'cefr_provisional'").get().level, "C2");
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tags WHERE tag_key = 'cefr_provisional'").get().count, 133);

console.log("migration 0023 smoke test passed");
