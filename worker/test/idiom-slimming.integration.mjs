import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { readIdioms } from "../src/idioms.js";

const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/idiom-slimming.json", import.meta.url)));
const migration = name => fs.readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
const sql = migration("0050_slim_idiom_collection.sql");

function storedAliases(aliases) {
  return JSON.stringify(aliases).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/},/g, '}, ');
}

function seed(populated = true) {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE lists(id TEXT PRIMARY KEY);CREATE TABLE words(id TEXT PRIMARY KEY);");
  db.exec(migration("0037_independent_idioms.sql"));
  db.exec(migration("0044_idiom_group_hierarchy.sql"));
  db.exec(migration("0048_idiom_editor_fields.sql"));
  if (!populated) return db;
  db.exec("INSERT INTO lists VALUES ('crossover-v3');");
  for (const id of new Set(fixture.before.entries.flatMap(e => e.meanings.flatMap(s => s.refs.map(r => r.wordId))))) {
    db.prepare("INSERT INTO words VALUES (?)").run(id);
  }
  for (const [ci, chapter] of fixture.before.chapters.entries()) {
    for (const [si, section] of chapter.sections.entries()) {
      db.prepare("INSERT INTO idiom_sections VALUES ('crossover-v3',?,?,?,?,?,?,?,?,?)")
        .run(section.key, section.subtitle, chapter.key, chapter.subtitle, ci, si,
          section.groupKey, section.groupSubtitle, section.groupOrder);
    }
  }
  for (const [order, entry] of fixture.before.entries.entries()) {
    db.prepare("INSERT INTO idioms(id,list_id,phrase,section_key,sort_order,synonyms,antonyms,notes,hidden,aliases) VALUES (?,'crossover-v3',?,?,?,?,?,?,?,?)")
      .run(entry.key, entry.phrase, entry.sectionKey, order, entry.synonyms || "", entry.antonyms || "",
        entry.notes || "", entry.hidden ? 1 : 0, storedAliases(entry.aliases || []));
    for (const [senseOrder, sense] of entry.meanings.entries()) {
      db.prepare("INSERT INTO idiom_senses VALUES (?,?,?,?)").run(sense.id, entry.key, sense.meaning, senseOrder);
      for (const ref of sense.refs) db.prepare("INSERT INTO idiom_word_refs VALUES (?,?,?)").run(sense.id, ref.wordId, ref.source);
    }
  }
  return db;
}

function d1(db) {
  return { prepare(query) { let args=[]; return { bind(...values) { args=values; return this; },
    async all() { return { results: db.prepare(query).all(...args) }; } }; } };
}

const db = seed();
const originalWords = db.prepare("SELECT * FROM words ORDER BY id").all();
const originalRefs = db.prepare("SELECT word_id,source FROM idiom_word_refs ORDER BY word_id,source").all();
db.exec(sql);
const actual = await readIdioms(d1(db), "crossover-v3");
assert.deepEqual(actual.entries, fixture.after.entries);
assert.deepEqual(actual.chapters, fixture.after.chapters);
assert.equal(actual.entries.length, 1740);
assert.equal(actual.entries.filter(entry => !entry.hidden).length, 1383);
assert.equal(actual.entries.filter(entry => entry.hidden).length, 357);
assert.equal(fixture.merges.length, 53);
assert.equal(new Set(actual.chapters.flatMap(c => c.sections.filter(s => s.number != null).map(s => s.number))).size, 69);
assert.deepEqual(actual.chapters.flatMap(c => c.sections).filter(s => s.number != null).map(s => s.number),
  Array.from({length:69}, (_, index) => index + 1));
assert.deepEqual(db.prepare("SELECT * FROM words ORDER BY id").all(), originalWords);
assert.deepEqual(db.prepare("SELECT word_id,source FROM idiom_word_refs ORDER BY word_id,source").all(), originalRefs,
  "every semantic word reference survives consolidation");
assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

const entry = phrase => actual.entries.find(item => item.phrase === phrase);
for (const phrase of ["There is / are ＋不特定の名詞", "have O V / Ving / Vpp", "allow O to V",
  "should have Vpp", "decide to V", "with O C〈Ving / Vpp / 形容詞・副詞・前置詞句〉",
  "a large population", "It is A that S V"]) assert.equal(entry(phrase).hidden, true, phrase);
for (const phrase of ["will do", "turn out (to be) C", "come up with O", "provide A with B",
  "but for O", "needless to say", "for fear of O / Ving", "take / catch / hold O by the arm"])
  assert(!entry(phrase).hidden, phrase);
assert.equal(entry("will do").sectionKey, "g12-fixed-svc");
assert.equal(entry("be composed of O").sectionKey, "g12-suitability");
assert.equal(entry("protect A from B").sectionKey, "g12-from-distinction");
assert.equal(entry("take / catch / hold O by the arm").sectionKey, "grammar-15-2");
const greeting = entry("Long time no see. / It’s been a long time.");
assert(greeting.aliases.some(alias => alias.phrase === "I haven’t seen you for a long time."));
assert(entry("You’re welcome. / Don’t mention it. / Never mind. / Don’t worry.").meanings.length >= 2,
  "distinct conversational meanings stay numbered within the consolidated item");
for (const merge of fixture.merges) {
  assert(!actual.entries.some(item => item.key === merge.from));
  assert(actual.entries.find(item => item.key === merge.to).aliases.some(alias => alias.key === merge.from));
}
assert.equal(db.prepare("SELECT count(*) n FROM idiom_revision_backup WHERE revision='0050'").get().n,
  fixture.before.entries.length + fixture.before.entries.reduce((sum,e) => sum + e.meanings.length,0) + 2);
db.close();

const empty = seed(false);
empty.exec(sql);
assert.equal(empty.prepare("SELECT count(*) n FROM idioms").get().n, 0);
assert.equal(empty.prepare("PRAGMA table_info(idiom_sections)").all().some(column => column.name === "display_number"), true);
empty.close();

for (const type of ["phrase", "notes", "meaning", "addition", "replacement"]) {
  const changed = seed();
  const first = fixture.before.entries[0];
  if (type === "phrase") changed.prepare("UPDATE idioms SET phrase='later edit' WHERE id=?").run(first.key);
  if (type === "notes") changed.prepare("UPDATE idioms SET notes='later edit' WHERE id=?").run(first.key);
  if (type === "meaning") changed.prepare("UPDATE idiom_senses SET meaning='later edit' WHERE id=?").run(first.meanings[0].id);
  if (type === "addition") changed.prepare("INSERT INTO idiom_senses VALUES ('later-sense',?,'later edit',99)").run(first.key);
  if (type === "replacement") {
    changed.prepare("DELETE FROM idioms WHERE id=?").run(first.key);
    changed.prepare("INSERT INTO idioms(id,list_id,phrase,section_key) VALUES ('replacement','crossover-v3','replacement','g12-fixed-svc')").run();
    changed.prepare("INSERT INTO idiom_senses VALUES ('replacement-sense','replacement','replacement',0)").run();
  }
  changed.exec("BEGIN");
  assert.throws(() => changed.exec(sql), /CHECK constraint/);
  changed.exec("ROLLBACK");
  assert(!changed.prepare("SELECT 1 FROM pragma_table_info('idiom_sections') WHERE name='display_number'").get(),
    "failed migration rolls back its schema change");
  changed.close();
}

console.log("Idiom slimming: 230 grammar formulas plus word-page content hidden, 53 conversation alternatives merged, 69 stable Sections and rollback guards passed");
