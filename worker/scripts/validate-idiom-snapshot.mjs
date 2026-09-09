import fs from "node:fs";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { buildIdiomEntries } from "../../public/shared/idioms.js";
const {words} = JSON.parse(fs.readFileSync(process.argv[2]));
const audit = JSON.parse(fs.readFileSync('/tmp/idiom-organization-audit.json'));
const db = new DatabaseSync(':memory:');
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE words(id TEXT PRIMARY KEY,spelling TEXT,related_words TEXT,updated_at TEXT);
CREATE TABLE lists(id TEXT PRIMARY KEY); CREATE TABLE chapters(id INTEGER PRIMARY KEY);
CREATE TABLE sections(id INTEGER PRIMARY KEY,chapter_id INTEGER);
CREATE TABLE list_items(list_id TEXT,word_id TEXT,section_id INTEGER);
CREATE TABLE examples(id INTEGER PRIMARY KEY,word_id TEXT,sentence TEXT,translation TEXT,answer TEXT,type TEXT,sort_order INTEGER);
INSERT INTO lists VALUES ('crossover-v3');`);
for (const w of words) {
  if(w.chapterId!=null) db.prepare('INSERT OR IGNORE INTO chapters VALUES (?)').run(w.chapterId);
  if(w.sectionId!=null) db.prepare('INSERT OR IGNORE INTO sections VALUES (?,?)').run(w.sectionId,w.chapterId);
  db.prepare('INSERT INTO words VALUES (?,?,?,NULL)').run(w.id,w.spelling,w.relatedWords);
  db.prepare("INSERT INTO list_items VALUES ('crossover-v3',?,?)").run(w.id,w.sectionId);
  for(const e of w.examples) db.prepare('INSERT INTO examples(word_id,sentence,translation,answer,type,sort_order) VALUES (?,?,?,?,?,?)')
    .run(w.id,e.sentence,e.translation,e.answer,e.type,e.sortOrder);
}
for(const n of ['0037_independent_idioms.sql','0038_seed_and_organize_idioms.sql']) db.exec(fs.readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8'));
let removed=0;
for(const w of words) {
  const c=audit.changes.find(c=>c.wordId===w.id);
  assert.equal(db.prepare('SELECT related_words FROM words WHERE id=?').get(w.id).related_words,c?c.relatedAfter:w.relatedWords,w.id+' related');
  const after=db.prepare('SELECT sentence,translation,type FROM examples WHERE word_id=? ORDER BY sort_order,id').all(w.id).map(r=>({...r}));
  const expected=w.examples.filter(e=>!c?.removedExamples.some(x=>x.sentence===e.sentence&&x.translation===e.translation&&x.type===e.type))
    .map(e=>({sentence:e.sentence,translation:e.translation,type:e.type}));
  assert.deepEqual(after,expected,w.id+' phrases');
  removed+=w.examples.length-after.length;
}
const actual=db.prepare(`SELECT i.phrase,s.meaning,r.word_id AS wordId FROM idioms i JOIN idiom_senses s ON s.idiom_id=i.id JOIN idiom_word_refs r ON r.sense_id=s.id`).all()
  .map(r=>JSON.stringify([r.phrase,r.meaning,r.wordId])).sort();
const expected=buildIdiomEntries(words).flatMap(e=>e.meanings.flatMap(s=>s.refs.map(r=>JSON.stringify([e.phrase,s.meaning,r.wordId])))).sort();
assert.deepEqual(actual,expected,'all phrase/meaning/reference tuples preserved');
assert.equal(removed,103);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
console.log(`Full snapshot: ${words.length} words verified, ${actual.length} phrase/meaning/reference tuples preserved, ${removed} phrases moved`);
