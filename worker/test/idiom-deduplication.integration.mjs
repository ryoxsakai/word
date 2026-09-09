import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readIdioms} from '../src/idioms.js';
const groups=JSON.parse(fs.readFileSync(new URL('./fixtures/idiom-deduplication.json',import.meta.url)));
const sql=fs.readFileSync(new URL('../migrations/0043_deduplicate_idioms.sql',import.meta.url),'utf8');
function seed() {
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE lists(id TEXT PRIMARY KEY);CREATE TABLE words(id TEXT PRIMARY KEY);INSERT INTO lists VALUES ('crossover-v3');`);
 db.exec(fs.readFileSync(new URL('../migrations/0037_independent_idioms.sql',import.meta.url),'utf8'));
 const entries=groups.flatMap(g=>g.before);
 for(const id of new Set(entries.flatMap(e=>e.meanings.flatMap(s=>s.refs.map(r=>r.wordId)))))db.prepare('INSERT INTO words VALUES (?)').run(id);
 for(const key of new Set(entries.map(e=>e.sectionKey)))db.prepare("INSERT INTO idiom_sections VALUES ('crossover-v3',?,?,'chapter','Chapter',1,1)").run(key,key);
 for(const [i,e]of entries.entries()) {
  db.prepare("INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) VALUES (?,'crossover-v3',?,?,?)").run(e.key,e.phrase,e.sectionKey,i);
  for(const [n,s]of e.meanings.entries()) {
   db.prepare('INSERT INTO idiom_senses VALUES (?,?,?,?)').run(s.id,e.key,s.meaning,n);
   for(const r of s.refs)db.prepare('INSERT INTO idiom_word_refs VALUES (?,?,?)').run(s.id,r.wordId,r.source);
  }
 }
 return db;
}
function d1(db) {return {prepare(sql){let args=[];return {bind(...v){args=v;return this;},async all(){return {results:db.prepare(sql).all(...args)};}};}};}
const db=seed();db.exec(sql);db.exec(sql);
const entries=(await readIdioms(d1(db),'crossover-v3')).entries;
assert.equal(entries.length,26);
for(const g of groups) {
 const actual=entries.find(e=>e.key===g.after.key);
 assert.deepEqual(actual,g.after);
 assert.deepEqual([...new Set(actual.meanings.flatMap(s=>s.refs.map(r=>r.wordId)))].sort(),[...new Set(g.before.flatMap(e=>e.meanings.flatMap(s=>s.refs.map(r=>r.wordId))))].sort(),'all semantic word references retained');
}
assert.equal(db.prepare("SELECT count(*) n FROM idiom_revision_backup WHERE revision='0043'").get().n,52);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
const pride=entries.find(e=>e.phrase==='take pride in O / Ving');
assert.equal(pride.meanings.length,1);assert.deepEqual(pride.meanings[0].refs.map(r=>r.wordId),['proud']);
const letDown=entries.find(e=>e.phrase==='let O down / let down O');
assert.equal(letDown.meanings.length,2);
assert.deepEqual(letDown.meanings.map(s=>s.refs.map(r=>r.wordId)),[['disappoint'],[]]);
db.close();
const changed=seed();
const g=groups[0];
changed.prepare("UPDATE idiom_senses SET meaning='後から変更' WHERE id=?").run(g.before[1].meanings[0].id);
changed.exec(sql);
for(const e of g.before)assert(changed.prepare('SELECT 1 FROM idioms WHERE id=?').get(e.key));
assert.equal(changed.prepare("SELECT 1 FROM idiom_revision_backup WHERE revision='0043' AND object_key=?").get(g.before[0].key),undefined);
changed.close();
console.log('Idiom deduplication passed: 26 reviewed merges, all references preserved, distinct senses retained, backups and concurrent edits protected');
