import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readIdioms} from '../src/idioms.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/grammar-groups-1-2.json',import.meta.url)));
const migration=name=>fs.readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8');
const sql=migration('0046_expand_grammar_groups_1_2.sql');
function seed(populated=true) {
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON;CREATE TABLE lists(id TEXT PRIMARY KEY);CREATE TABLE words(id TEXT PRIMARY KEY);');
 db.exec(migration('0037_independent_idioms.sql'));
 db.exec(migration('0044_idiom_group_hierarchy.sql'));
 if(populated) {
  db.exec("INSERT INTO lists VALUES ('crossover-v3');");
  for(const id of new Set(fixture.before.entries.flatMap(e=>e.meanings.flatMap(s=>s.refs.map(r=>r.wordId)))))db.prepare('INSERT INTO words VALUES (?)').run(id);
  for(const [ci,c] of fixture.before.chapters.entries())for(const [si,s]of c.sections.entries())db.prepare("INSERT INTO idiom_sections VALUES ('crossover-v3',?,?,?,?,?,?,?,?,?)").run(s.key,s.subtitle,c.key,c.subtitle,ci,si,s.groupKey,s.groupSubtitle,s.groupOrder);
  for(const [i,e]of fixture.before.entries.entries()) {
   db.prepare("INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) VALUES (?,'crossover-v3',?,?,?)").run(e.key,e.phrase,e.sectionKey,i);
   for(const [n,s]of e.meanings.entries()) {
    db.prepare('INSERT INTO idiom_senses VALUES (?,?,?,?)').run(s.id,e.key,s.meaning,n);
    for(const r of s.refs)db.prepare('INSERT INTO idiom_word_refs VALUES (?,?,?)').run(s.id,r.wordId,r.source);
   }
  }
 }
 return db;
}
function d1(db) {return {prepare(sql){let args=[];return {bind(...v){args=v;return this;},async all(){return {results:db.prepare(sql).all(...args)};}};}};}
const db=seed();
const words=db.prepare('SELECT * FROM words ORDER BY id').all();
db.exec(sql);
const actual=await readIdioms(d1(db),'crossover-v3');
assert.deepEqual(actual.entries,fixture.after.entries);
assert.deepEqual(actual.chapters,fixture.after.chapters);
for(const e of fixture.before.entries)for(const s of e.meanings) {
 const found=actual.entries.flatMap(e=>e.meanings).find(n=>n.id===s.id);
 assert.deepEqual(found,s,'existing sense meanings and semantic references survive moves/merges');
}
assert.deepEqual(db.prepare('SELECT * FROM words ORDER BY id').all(),words);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
assert.equal(actual.chapters[0].sections.filter(s=>s.groupOrder===1).length,16);
assert.equal(actual.chapters[0].sections.filter(s=>s.groupOrder===2).length,21);
for(const key of ['svoc-basic','svoc-infinitive','prevention','causative','perception'])assert(actual.chapters[0].sections.some(s=>s.key===`g12-${key}`));
for(const r of fixture.mapping)assert(actual.entries.some(e=>e.key===r.entryKey),'every reviewed source form resolves to one canonical entry');
for(const [phrase,key] of [['advise O to V','g12-svoc-infinitive'],['have O Ving','g12-causative'],['watch O V-ed','g12-perception'],['notify A of B','g12-of-notification'],['assign A to B','g12-to-object']])assert(actual.entries.some(e=>e.phrase===phrase&&e.sectionKey===key));
assert(!actual.entries.some(e=>e.phrase==='seem O C'));
assert.equal(actual.entries.filter(e=>e.phrase.startsWith('object to ')).length,1);
assert.equal(actual.entries.filter(e=>e.phrase==='go with'||e.phrase==='go with O').length,1);
assert.equal(actual.entries.filter(e=>/^keep [AO] from/.test(e.phrase)).length,1);
db.close();
const empty=seed(false);empty.exec(sql);assert.equal(empty.prepare('SELECT count(*) n FROM idioms').get().n,0);empty.close();
const changed=seed();const id=fixture.before.entries[0].meanings[0].id;
changed.prepare('UPDATE idiom_senses SET meaning=? WHERE id=?').run('後から修正した意味',id);changed.exec(sql);
assert.equal(changed.prepare('SELECT meaning FROM idiom_senses WHERE id=?').get(id).meaning,'後から修正した意味');changed.close();
const missing=seed();missing.prepare('DELETE FROM idioms WHERE id=?').run(fixture.before.entries[0].key);assert.throws(()=>missing.exec(sql),/CHECK constraint/);missing.close();
console.log('Groups 1–2 expansion: source coverage, five verb-pattern sections, safe deduplication, all existing senses/references, empty DB and concurrent edits passed');
