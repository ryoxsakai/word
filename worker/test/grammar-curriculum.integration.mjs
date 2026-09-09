import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readIdioms} from '../src/idioms.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/grammar-curriculum.json',import.meta.url)));
const migration=name=>fs.readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8');
const sql=migration('0045_grammar_curriculum.sql');
function seed(populated=true) {
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON;CREATE TABLE lists(id TEXT PRIMARY KEY);CREATE TABLE words(id TEXT PRIMARY KEY);');
 db.exec(migration('0037_independent_idioms.sql'));
 if(populated) {
  db.exec("INSERT INTO lists VALUES ('crossover-v3');");
  for(const id of new Set(fixture.before.entries.flatMap(e=>e.meanings.flatMap(s=>s.refs.map(r=>r.wordId)))))db.prepare('INSERT INTO words VALUES (?)').run(id);
  for(const [ci,c] of fixture.before.chapters.entries())for(const [si,s]of c.sections.entries())db.prepare("INSERT INTO idiom_sections VALUES ('crossover-v3',?,?,?,?,?,?)").run(s.key,s.subtitle,c.key,c.subtitle,ci,si);
  for(const [i,e]of fixture.before.entries.entries()) {
   db.prepare("INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) VALUES (?,'crossover-v3',?,?,?)").run(e.key,e.phrase,e.sectionKey,i);
   for(const [n,s]of e.meanings.entries()) {
    db.prepare('INSERT INTO idiom_senses VALUES (?,?,?,?)').run(s.id,e.key,s.meaning,n);
    for(const r of s.refs)db.prepare('INSERT INTO idiom_word_refs VALUES (?,?,?)').run(s.id,r.wordId,r.source);
   }
  }
 }
 db.exec(migration('0044_idiom_group_hierarchy.sql'));
 return db;
}
function d1(db) {return {prepare(sql){let args=[];return {bind(...v){args=v;return this;},async all(){return {results:db.prepare(sql).all(...args)};}};}};}
const db=seed();
const words=db.prepare('SELECT * FROM words ORDER BY id').all();
db.exec(sql);
const actual=await readIdioms(d1(db),'crossover-v3');
assert.deepEqual(actual.entries,fixture.after.entries);
assert.equal(actual.chapters.length,9);
assert.equal(new Set(actual.chapters.flatMap(c=>c.sections.map(s=>s.groupKey))).size,22);
assert.equal(actual.chapters.flatMap(c=>c.sections).length,76);
assert.equal(actual.chapters[0].sections[0].subtitle,'決まった形を取る第2文型動詞');
assert.equal(actual.chapters[0].sections[0].groupSubtitle,'文型');
for(const phrase of ['go bad','go wrong (with O)','come true'])assert(actual.entries.some(e=>e.phrase===phrase&&e.sectionKey===actual.chapters[0].sections[0].key));
for(const e of fixture.before.entries)assert.deepEqual(actual.entries.find(a=>a.key===e.key).meanings,e.meanings);
assert.deepEqual(db.prepare('SELECT * FROM words ORDER BY id').all(),words);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
assert.equal(db.prepare("SELECT count(*) n FROM idiom_revision_backup WHERE revision='0045'").get().n,707);
db.close();
const empty=seed(false);empty.exec(sql);assert.equal(empty.prepare('SELECT count(*) n FROM idioms').get().n,0);empty.close();
const changed=seed();changed.prepare('UPDATE idiom_senses SET meaning=? WHERE id=?').run('後から修正した意味',fixture.before.entries[0].meanings[0].id);changed.exec(sql);
assert.equal(changed.prepare('SELECT meaning FROM idiom_senses WHERE id=?').get(fixture.before.entries[0].meanings[0].id).meaning,'後から修正した意味');changed.close();
const missing=seed();missing.prepare('DELETE FROM idioms WHERE id=?').run(fixture.before.entries[0].key);assert.throws(()=>missing.exec(sql),/CHECK constraint/);missing.close();
console.log('Grammar curriculum passed: hierarchy, all existing senses/references, source placement, backups, concurrent edits and empty notebooks');
