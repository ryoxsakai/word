import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE words (
    id TEXT PRIMARY KEY,
    spelling TEXT NOT NULL,
    synonyms TEXT,
    antonyms TEXT
  );
  INSERT INTO words (id, spelling, synonyms) VALUES
    ('medical', 'medical', 'clinical, health-related'),
    ('cell', 'cell', 'unit, compartment'),
    ('entity', 'entity', 'being, unit, organization');
`);
db.exec(readFileSync(new URL("../migrations/0031_related_words.sql", import.meta.url), "utf8"));

const columns = db.prepare("PRAGMA table_info(words)").all();
const relatedWords = columns.find((column) => column.name === "related_words");
assert.ok(relatedWords);
assert.equal(relatedWords.type, "TEXT");

db.prepare("INSERT INTO words (id, spelling, related_words) VALUES (?, ?, ?)")
  .run("nutrition", "nutrition", "nutrient, protein");
assert.equal(
  db.prepare("SELECT related_words AS relatedWords FROM words WHERE id = ?").get("nutrition").relatedWords,
  "nutrient, protein"
);
assert.deepEqual(
  db.prepare("SELECT id, synonyms, related_words AS relatedWords FROM words WHERE id IN ('medical', 'cell', 'entity') ORDER BY id").all().map((row) => ({ ...row })),
  [
    { id: "cell", synonyms: null, relatedWords: "unit, compartment" },
    { id: "entity", synonyms: "being, organization", relatedWords: "unit" },
    { id: "medical", synonyms: "health-related", relatedWords: "clinical" },
  ]
);

console.log("migration 0031 smoke test passed");
