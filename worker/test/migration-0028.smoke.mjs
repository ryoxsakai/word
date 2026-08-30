import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE words (
    id TEXT PRIMARY KEY,
    spelling TEXT NOT NULL
  );
  CREATE TABLE list_items (
    list_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    PRIMARY KEY (list_id, word_id)
  );
  INSERT INTO words VALUES ('increase', 'increase');
  INSERT INTO words VALUES ('close', 'close');
  INSERT INTO words VALUES ('sell', 'sell');
  INSERT INTO words VALUES ('melt', 'melt');
  INSERT INTO list_items VALUES ('crossover-v3', 'increase');
  INSERT INTO list_items VALUES ('crossover-v3', 'close');
  INSERT INTO list_items VALUES ('crossover-v3', 'sell');
  INSERT INTO list_items VALUES ('another-list', 'melt');
`);

db.exec(readFileSync(new URL("../migrations/0028_ergative_badge.sql", import.meta.url), "utf8"));

assert.equal(db.prepare("SELECT ergative FROM words WHERE id = 'increase'").get().ergative, 1);
assert.equal(db.prepare("SELECT ergative FROM words WHERE id = 'close'").get().ergative, 1);
assert.equal(db.prepare("SELECT ergative FROM words WHERE id = 'sell'").get().ergative, 0);
assert.equal(db.prepare("SELECT ergative FROM words WHERE id = 'melt'").get().ergative, 0);

console.log("migration 0028 smoke test passed");
