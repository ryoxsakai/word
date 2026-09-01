import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE lists (id TEXT PRIMARY KEY);
  CREATE TABLE chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    subtitle TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    chapter_id INTEGER
  );
  CREATE TABLE words (id TEXT PRIMARY KEY, spelling TEXT NOT NULL);
  CREATE TABLE senses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id TEXT NOT NULL,
    pos TEXT,
    meaning TEXT NOT NULL,
    pronunciation TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE tags (
    word_id TEXT NOT NULL,
    tag_key TEXT NOT NULL,
    tag_value TEXT,
    PRIMARY KEY (word_id, tag_key)
  );
  CREATE TABLE list_items (
    list_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    no INTEGER NOT NULL,
    branch INTEGER NOT NULL DEFAULT 0,
    section_id INTEGER,
    label_id INTEGER,
    PRIMARY KEY (list_id, word_id)
  );
  CREATE UNIQUE INDEX idx_list_items_no_branch ON list_items(list_id, no, branch);

  INSERT INTO lists (id) VALUES ('crossover-v3');
  INSERT INTO words (id, spelling) VALUES ('existing', 'existing');
  INSERT INTO list_items (list_id, word_id, no, branch) VALUES ('crossover-v3', 'existing', 3000, 0);
`);

const migration = readFileSync(new URL("../migrations/0032_seed_uncovered_headwords.sql", import.meta.url), "utf8");
db.exec(migration);

assert.equal(db.prepare("SELECT COUNT(*) AS count FROM words").get().count, 642);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM senses").get().count, 641);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tags").get().count, 641);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM list_items WHERE list_id = 'crossover-v3'").get().count, 642);
assert.equal(db.prepare("SELECT MAX(no) AS maxNo FROM list_items WHERE list_id = 'crossover-v3'").get().maxNo, 3641);

assert.deepEqual(
  db.prepare("SELECT tag_key AS tagKey, COUNT(*) AS count FROM tags GROUP BY tag_key ORDER BY tag_key").all().map((row) => ({ ...row })),
  [
    { tagKey: "passtan_p1", count: 247 },
    { tagKey: "systan", count: 149 },
    { tagKey: "target1900", count: 83 },
    { tagKey: "teppeki", count: 162 },
  ]
);
assert.deepEqual(
  db.prepare(
    `SELECT s.subtitle, COUNT(li.word_id) AS wordCount
     FROM sections s LEFT JOIN list_items li ON li.section_id = s.id
     GROUP BY s.id ORDER BY s.sort_order`
  ).all().map((row) => ({ ...row })),
  [
    { subtitle: "Target 1900補完", wordCount: 83 },
    { subtitle: "鉄壁補完", wordCount: 162 },
    { subtitle: "シス単補完", wordCount: 149 },
    { subtitle: "パス単準1級補完", wordCount: 247 },
  ]
);
assert.deepEqual(
  db.prepare(
    `SELECT w.spelling, t.tag_key AS tagKey, t.tag_value AS tagValue
     FROM words w JOIN tags t ON t.word_id = w.id
     WHERE w.spelling IN ('inner', 'interior', 'local', 'net', 'trunk')
     ORDER BY w.spelling`
  ).all().map((row) => ({ ...row })),
  [
    { spelling: "inner", tagKey: "systan", tagValue: "834" },
    { spelling: "interior", tagKey: "target1900", tagValue: "1284" },
    { spelling: "local", tagKey: "teppeki", tagValue: "337" },
    { spelling: "net", tagKey: "teppeki", tagValue: "1338" },
    { spelling: "trunk", tagKey: "passtan_p1", tagValue: "832" },
  ]
);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM words WHERE spelling IN ('clinical', 'nutrient', 'unit')").get().count, 0);

// 再実行しても語・セクション・所属を重複させない。
db.exec(migration);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM words").get().count, 642);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sections").get().count, 4);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM list_items WHERE list_id = 'crossover-v3'").get().count, 642);

console.log("migration 0032 smoke test passed");
