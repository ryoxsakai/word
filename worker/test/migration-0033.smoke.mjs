import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migration0032 = readFileSync(new URL("../migrations/0032_seed_uncovered_headwords.sql", import.meta.url), "utf8");
const migration0033 = readFileSync(new URL("../migrations/0033_restore_3000_relation_words.sql", import.meta.url), "utf8");

const relationPattern = /UPDATE words\nSET (synonyms|antonyms|related_words) = CASE\n[\s\S]*?THEN '((?:''|[^'])+)'[\s\S]*?WHERE spelling = '((?:''|[^'])+)' COLLATE NOCASE/g;
const relations = [...migration0033.matchAll(relationPattern)].map((match) => ({
  field: match[1],
  term: match[2].replaceAll("''", "'"),
  anchor: match[3].replaceAll("''", "'"),
}));

assert.equal(relations.length, 641);
assert.deepEqual(
  Object.fromEntries(
    [...new Set(relations.map(({ field }) => field))]
      .sort()
      .map((field) => [field, relations.filter((relation) => relation.field === field).length])
  ),
  { antonyms: 13, related_words: 438, synonyms: 190 }
);

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
  CREATE TABLE section_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id TEXT NOT NULL,
    chapter_id INTEGER NOT NULL,
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
    chapter_id INTEGER,
    group_id INTEGER
  );
  CREATE TABLE section_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id TEXT NOT NULL,
    section_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE words (
    id TEXT PRIMARY KEY,
    spelling TEXT NOT NULL,
    synonyms TEXT,
    antonyms TEXT,
    related_words TEXT,
    derived_from_id TEXT
  );
  CREATE TABLE senses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id TEXT NOT NULL,
    pos TEXT,
    meaning TEXT NOT NULL,
    pronunciation TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE derivatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id TEXT NOT NULL,
    word TEXT NOT NULL
  );
  CREATE TABLE examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id TEXT NOT NULL,
    sentence TEXT NOT NULL
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
  CREATE TABLE word_audio (
    word_id TEXT NOT NULL,
    variant_key TEXT NOT NULL DEFAULT 'primary',
    PRIMARY KEY (word_id, variant_key)
  );
  CREATE TABLE word_audio_jobs (
    word_id TEXT NOT NULL,
    variant_key TEXT NOT NULL DEFAULT 'primary',
    PRIMARY KEY (word_id, variant_key)
  );
  INSERT INTO lists (id) VALUES ('crossover-v3');
`);

const insertWord = db.prepare("INSERT INTO words (id, spelling) VALUES (?, ?)");
const insertItem = db.prepare("INSERT INTO list_items (list_id, word_id, no, branch) VALUES ('crossover-v3', ?, ?, 0)");
const anchors = [...new Set(relations.map(({ anchor }) => anchor))];
let no = 0;
for (const [index, anchor] of anchors.entries()) {
  const id = `base-${index + 1}`;
  insertWord.run(id, anchor);
  insertItem.run(id, ++no);
}
while (no < 3000) {
  const id = `filler-${no + 1}`;
  insertWord.run(id, `filler-${no + 1}`);
  insertItem.run(id, ++no);
}

// 0032が既存マスター語を再利用した場合も、0033では単語自体を消さない。
const retainedMasterWords = ["inner", "interior", "local", "net", "trunk"];
for (const spelling of retainedMasterWords) {
  insertWord.run(`master-${spelling}`, spelling);
}

db.exec(migration0032);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM list_items WHERE list_id = 'crossover-v3'").get().count, 3641);
assert.equal(db.prepare("SELECT MAX(no) AS maxNo FROM list_items WHERE list_id = 'crossover-v3'").get().maxNo, 3641);

db.exec(migration0033);

assert.equal(db.prepare("SELECT COUNT(*) AS count FROM list_items WHERE list_id = 'crossover-v3'").get().count, 3000);
assert.equal(db.prepare("SELECT MAX(no) AS maxNo FROM list_items WHERE list_id = 'crossover-v3'").get().maxNo, 3000);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM chapters WHERE subtitle = '主要単語帳の補完語彙'").get().count, 0);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sections WHERE subtitle LIKE '%補完'").get().count, 0);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM words WHERE id LIKE 'supplement-%'").get().count, 0);
assert.equal(
  db.prepare(`SELECT COUNT(*) AS count FROM words WHERE id IN (${retainedMasterWords.map(() => "?").join(", ")})`).get(
    ...retainedMasterWords.map((spelling) => `master-${spelling}`)
  ).count,
  retainedMasterWords.length
);
assert.equal(
  db.prepare(`SELECT COUNT(*) AS count FROM list_items WHERE word_id IN (${retainedMasterWords.map(() => "?").join(", ")})`).get(
    ...retainedMasterWords.map((spelling) => `master-${spelling}`)
  ).count,
  0
);

for (const { field, term, anchor } of relations) {
  const value = db.prepare(`SELECT ${field} AS value FROM words WHERE spelling = ? COLLATE NOCASE`).get(anchor)?.value ?? "";
  assert.ok(
    value.split(",").map((part) => part.trim().toLocaleLowerCase()).includes(term.toLocaleLowerCase()),
    `${term} is not indexed under ${anchor}.${field}`
  );
}

const beforeSecondRun = db.prepare("SELECT synonyms, antonyms, related_words FROM words ORDER BY id").all();
db.exec(migration0033);
assert.deepEqual(db.prepare("SELECT synonyms, antonyms, related_words FROM words ORDER BY id").all(), beforeSecondRun);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM list_items WHERE list_id = 'crossover-v3'").get().count, 3000);

console.log("migration 0033 smoke test passed");
