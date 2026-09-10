import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { readIdioms, readIdiomIndex, readIdiomSection, reorderIdioms, reorderIdiomSections, saveIdiom } from "../src/idioms.js";

const db = new DatabaseSync(":memory:");
db.exec(`PRAGMA foreign_keys = ON;
CREATE TABLE words (id TEXT PRIMARY KEY, spelling TEXT, related_words TEXT, updated_at TEXT);
CREATE TABLE lists (id TEXT PRIMARY KEY);
CREATE TABLE chapters (id INTEGER PRIMARY KEY);
CREATE TABLE sections (id INTEGER PRIMARY KEY, chapter_id INTEGER);
CREATE TABLE list_items (list_id TEXT, word_id TEXT, section_id INTEGER);
CREATE TABLE examples (id INTEGER PRIMARY KEY, word_id TEXT, sentence TEXT, translation TEXT, answer TEXT, type TEXT, sort_order INTEGER);
INSERT INTO lists VALUES ('crossover-v3'), ('other');
INSERT INTO chapters VALUES (12);
INSERT INTO sections VALUES (1, 12);`);
const schema = readFileSync(new URL("../migrations/0037_independent_idioms.sql", import.meta.url), "utf8");
const seed = readFileSync(new URL("../migrations/0038_seed_and_organize_idioms.sql", import.meta.url), "utf8");
const editorFields = readFileSync(new URL("../migrations/0048_idiom_editor_fields.sql", import.meta.url), "utf8");
const wordIds = new Set([...seed.matchAll(/AND EXISTS \(SELECT 1 FROM words WHERE id = '([^']+)'\)/g)].map(m => m[1]));
for (const id of wordIds) {
  db.prepare("INSERT INTO words VALUES (?, ?, 'concurrent edit', NULL)").run(id, id);
  db.prepare("INSERT INTO list_items VALUES ('crossover-v3', ?, 1)").run(id);
}
db.exec(`INSERT INTO examples VALUES
  (1, 'get', 'get O to V', 'OにVしてもらう', NULL, 'phrase', 0),
  (2, 'get', 'get over O', 'Oを乗り越える', NULL, 'phrase', 1),
  (3, 'get', 'get over O', '後から修正した意味', NULL, 'phrase', 2),
  (4, 'get', 'get over O', 'Oを乗り越える', NULL, 'example', 3);`);
db.exec(schema);
db.exec(editorFields);
db.exec(seed);
assert.equal(db.prepare("SELECT count(*) AS n FROM idioms").get().n, 638);
assert.equal(db.prepare("SELECT count(*) AS n FROM idiom_senses").get().n, 664);
assert.deepEqual(db.prepare("SELECT id FROM examples ORDER BY id").all().map(r=>r.id), [1,3,4], "only the verified phrase moves; core grammar, concurrent edits and sentences stay");
assert.equal(db.prepare("SELECT related_words FROM words WHERE id = 'get'").get().related_words, "concurrent edit");
const backup = JSON.parse(db.prepare("SELECT snapshot FROM idiom_migration_backup WHERE word_id = 'get'").get().snapshot);
assert.equal(backup.examples.length, 4, "recoverable snapshot precedes cleanup");
const counts = () => ["idioms", "idiom_senses", "idiom_word_refs", "idiom_migration_backup"].map(t=>db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n);
const before = counts(); db.exec(seed); assert.deepEqual(counts(), before, "migration is idempotent");
assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

// Exercise production repository functions against SQLite with the D1 interface.
const d1 = { prepare(sql) { let args=[]; return { bind(...v) {args=v;return this;},
  async all() {return {results:db.prepare(sql).all(...args)};},
  async first() {return db.prepare(sql).get(...args) || null;},
  async run() {return db.prepare(sql).run(...args);} }; },
  async batch(stmts) {db.exec("BEGIN");try {for(const s of stmts) await s.run();db.exec("COMMIT");} catch(e){db.exec("ROLLBACK");throw e;}} };
const collection = await readIdioms(d1, "crossover-v3");
assert.equal(collection.managed, true);
assert.equal(collection.chapters.length, 6);
assert.equal(collection.entries.length, 638);
assert.equal((await readIdioms(d1, "other")).managed, false);
const moved = collection.entries.find(e=>e.phrase === "get over O");
assert(moved.meanings.some(s=>s.meaning === "Oを乗り越える" && s.refs.some(r=>r.wordId === "get")));
const idiomIndex = await readIdiomIndex(d1, "crossover-v3");
assert.equal(idiomIndex.entries.length, collection.entries.length);
assert.equal(idiomIndex.entries[0].meanings.length, 0, "lightweight index does not include senses");
const getSection = await readIdiomSection(d1, "crossover-v3", "get");
assert(getSection.entries.some(entry => entry.phrase === "get over O"));
assert.equal(await readIdiomSection(d1, "crossover-v3", "missing"), null);
const reorderedEntries = [...idiomIndex.entries].reverse().map(entry => ({id:entry.key,sectionKey:entry.sectionKey}));
await reorderIdioms(d1, "crossover-v3", {entries:reorderedEntries});
assert.equal((await readIdiomIndex(d1, "crossover-v3")).entries[0].key, reorderedEntries[0].id);
const sectionKeys = idiomIndex.chapters.flatMap(chapter => chapter.sections.map(section => section.key));
const getChapter = idiomIndex.chapters.find(chapter => chapter.sections.some(section => section.key === "get"));
const reversedGetKeys = getChapter.sections.map(section => section.key).reverse();
const reorderedSections = [...sectionKeys].reverse();
await reorderIdiomSections(d1, "crossover-v3", {sectionKeys:reorderedSections});
assert.equal((await readIdiomIndex(d1, "crossover-v3")).chapters.find(chapter => chapter.key === getChapter.key).sections[0].key, reversedGetKeys[0]);
await assert.rejects(reorderIdioms(d1,"crossover-v3",{entries:reorderedEntries.slice(1)}),/every idiom/);
const payload = {phrase:"test phrase", sectionKey:"get", meanings:[{meaning:"テスト", wordIds:["get", "take"]}]};
const {id} = await saveIdiom(d1, "crossover-v3", payload);
await saveIdiom(d1, "crossover-v3", {...payload, id, meanings:[{meaning:"変更",wordIds:["give"]}]});
assert.equal(db.prepare("SELECT count(*) AS n FROM idiom_word_refs r JOIN idiom_senses s ON s.id = r.sense_id WHERE s.idiom_id = ?").get(id).n, 1);
await assert.rejects(saveIdiom(d1, "crossover-v3", {...payload, id, meanings:[{meaning:"bad",wordIds:["missing"]}]}), /not in this notebook/);
assert.equal((await readIdioms(d1, "crossover-v3")).entries.find(e=>e.key === id).meanings[0].meaning, "変更", "validation failure does not alter stored meanings");
await assert.rejects(saveIdiom(d1, "other", {...payload,id}), /Unknown idiom section/);
db.close();
console.log("Independent idiom migration, preservation, references and editing passed");
