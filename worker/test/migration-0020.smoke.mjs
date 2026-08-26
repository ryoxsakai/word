import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");

function applySql(sql) {
  const statements = sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  for (const statement of statements) {
    try {
      db.exec(statement + ";");
    } catch (error) {
      console.error(statement);
      throw error;
    }
  }
}

const migrationDir = new URL("../migrations/", import.meta.url);
for (const filename of readdirSync(migrationDir).filter((name) => /^00(?:0[1-9]|1[0-8])_.*\.sql$/.test(name)).sort()) {
  applySql(readFileSync(new URL(filename, migrationDir), "utf8"));
}

db.exec("INSERT INTO lists (id, name) VALUES ('crossover-v3', 'crossover')");
db.exec("INSERT INTO chapters (id, list_id, subtitle, sort_order) VALUES (12, 'crossover-v3', '文法学習の重要語彙', 1)");
db.exec("INSERT INTO sections (id, list_id, name, sort_order, subtitle, chapter_id) VALUES (93, 'crossover-v3', 'Section 9', 9, '文型 9：A for B・A of B・A from B', 12)");
db.exec("INSERT INTO sections (id, list_id, name, sort_order, subtitle, chapter_id) VALUES (96, 'crossover-v3', 'Section 12', 12, '文型 12', 12)");

const current = [
  'mistake', 'forgive', 'excuse', 'blame', 'praise', 'punish', 'reward', 'thank',
  'inform', 'notify', 'convince', 'assure', 'accuse', 'rob', 'deprive', 'cure',
  'rid', 'relieve', 'distinguish', 'separate'
];
const incoming = [
  'criticize', 'scold', 'admire', 'fine', 'exchange', 'trade', 'substitute',
  'compensate', 'qualify', 'search'
];
for (const spelling of [...current, ...incoming, 'dummy']) {
  db.prepare("INSERT INTO words (id, spelling) VALUES (?, ?)").run(spelling, spelling);
}
for (let i = 0; i < 5; i += 1) {
  db.prepare("INSERT INTO section_labels (id, list_id, section_id, name, sort_order) VALUES (?, 'crossover-v3', 93, ?, ?)")
    .run(43 + i, 'old-' + i, i + 1);
}
for (let i = 0; i < current.length; i += 1) {
  db.prepare("INSERT INTO list_items (list_id, word_id, no, branch, section_id, label_id) VALUES ('crossover-v3', ?, ?, 0, 93, ?)")
    .run(current[i], 161 + i, i < 3 ? 43 : i < 8 ? 44 : i < 13 ? 45 : i < 18 ? 46 : 47);
}
db.exec("INSERT INTO list_items (list_id, word_id, no, branch, section_id) VALUES ('crossover-v3', 'dummy', 240, 0, 96)");

applySql(readFileSync(new URL("../migrations/0020_rebuild_crossover_section_9.sql", import.meta.url), "utf8"));

const section9 = db.prepare(`
  SELECT w.spelling, li.no, sl.name AS label
  FROM list_items li JOIN words w ON w.id = li.word_id
  LEFT JOIN section_labels sl ON sl.id = li.label_id
  WHERE li.list_id = 'crossover-v3' AND li.section_id = 93
  ORDER BY li.no
`).all();
assert.equal(section9.length, 20);
assert.deepEqual(section9.map((row) => row.no), Array.from({ length: 20 }, (_, i) => 161 + i));
assert.deepEqual(section9.map((row) => row.spelling), [
  'mistake', 'forgive', 'excuse', 'pardon', 'blame', 'criticize', 'scold', 'praise',
  'admire', 'punish', 'fine', 'reward', 'thank', 'exchange', 'trade', 'swap',
  'substitute', 'compensate', 'qualify', 'search'
]);
assert.ok(section9.every((row) => row.label));

const section13 = db.prepare(`
  SELECT w.spelling, li.no
  FROM list_items li JOIN words w ON w.id = li.word_id
  JOIN sections s ON s.id = li.section_id
  WHERE li.list_id = 'crossover-v3' AND s.sort_order = 13
  ORDER BY li.no
`).all();
assert.equal(section13.length, 12);
assert.deepEqual(section13.map((row) => row.no), Array.from({ length: 12 }, (_, i) => 241 + i));
assert.deepEqual(section13.map((row) => row.spelling), current.slice(8));

assert.equal(db.prepare("SELECT notes FROM words WHERE spelling = 'fine'").get().notes.includes('辞書取得'), false);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM examples WHERE word_id = 'criticize'").get().n, 2);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM derivatives WHERE word_id = 'qualify'").get().n, 3);
console.log("migration 0020 smoke test passed");
