import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readIdioms} from '../src/idioms.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/grammar-full-audit.json',import.meta.url)));
const migration=name=>fs.readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8');
const sql=migration('0047_complete_grammar_audit.sql');
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
const refs=db.prepare('SELECT * FROM idiom_word_refs ORDER BY sense_id,word_id').all();
db.exec(sql);
const actual=await readIdioms(d1(db),'crossover-v3');
assert.deepEqual(actual.entries,fixture.after.entries);
assert.deepEqual(actual.chapters,fixture.after.chapters);
assert.equal(actual.entries.length,1819);
assert.equal(fixture.newKeys.length,262);
assert.equal(fixture.merges.length,8);
assert.equal(fixture.mapping.length,301);
assert.equal(new Set(fixture.mapping.map(c=>c.phrase)).size,301);
const allSenses=new Map(actual.entries.flatMap(e=>e.meanings.map(s=>[s.id,s])));
const edited=new Map(fixture.edits.map(e=>[e.id,e]));
for(const e of fixture.before.entries)for(const s of e.meanings) {
 const found=allSenses.get(s.id);
 assert(found,`lost sense ${s.id}`);
 assert.deepEqual(found,{...s,meaning:edited.get(s.id)?.after??s.meaning});
}
assert.deepEqual(db.prepare('SELECT * FROM idiom_word_refs ORDER BY sense_id,word_id').all(),refs,'all semantic references survive');
assert.deepEqual(db.prepare('SELECT * FROM words ORDER BY id').all(),words,'word book is untouched');
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
assert.equal(actual.chapters.length,9);
assert.equal(new Set(actual.chapters.flatMap(c=>c.sections.map(s=>s.groupKey))).size,22);
assert.deepEqual(actual.chapters[0],fixture.before.chapters[0],'Group 1/2 layout is retained');
const entry=phrase=>actual.entries.find(e=>e.phrase===phrase);
for(const c of fixture.mapping)assert(actual.entries.some(e=>e.key===c.entryKey),'each audited form resolves to a canonical entry');
for(const m of fixture.merges) {
 assert(!actual.entries.some(e=>e.key===m.from));
 const merged=actual.entries.find(e=>e.key===m.to);
 const previous=fixture.before.entries.find(e=>e.key===m.from);
 for(const s of previous.meanings)assert(merged.meanings.some(n=>n.id===s.id),'merges retain every sense');
}
for(const phrase of ['see through O','see O through','get across O','get O across','come by','come by O'])assert(entry(phrase),`distinct construction ${phrase}`);
assert(entry('carry O out').meanings.some(s=>s.refs.some(r=>r.wordId==='implement')));
assert(entry('carry O out').meanings.some(s=>s.refs.some(r=>r.wordId==='transport')));
assert(entry('pretend to V').meanings.some(s=>s.meaning==='Vするふりをする'));
assert(entry('mention Ving').meanings.some(s=>s.meaning==='Vすることに言及する'));
assert(entry('No way.').meanings.some(s=>s.meaning.includes('驚きや不信')));
assert(entry('up to O').meanings.some(s=>s.meaning.includes('O次第')));
assert.equal(entry('be accustomed to O / Ving').sectionKey,'grammar-8-2');
assert.equal(entry('be made of O').sectionKey,'grammar-6-1');
assert.equal(entry('in order / so as to V').sectionKey,'ga-infinitive-purpose');
assert.equal(entry('with O 形容詞').sectionKey,'ga-with');
assert.equal(entry('be indifferent to / toward(s) O').sectionKey,'grammar-21-1');
assert.equal(entry('take advantage of O').sectionKey,'g12-lending');
assert(!entry('without O'),'no isolated preposition added');
for(const e of actual.entries.filter(e=>fixture.newKeys.includes(e.key)))assert(/\s|＋/.test(e.phrase),'no standalone words added');
const backups=db.prepare("SELECT object_key,snapshot FROM idiom_revision_backup WHERE revision='0047'").all();
assert.equal(backups.length,1+fixture.before.entries.length+fixture.before.entries.reduce((n,e)=>n+e.meanings.length,0));
for(const e of fixture.edits)assert.equal(JSON.parse(backups.find(b=>b.object_key==='sense-'+e.id).snapshot).meaning,e.before);
db.close();
const empty=seed(false);empty.exec(sql);assert.equal(empty.prepare('SELECT count(*) n FROM idioms').get().n,0);empty.close();
// A non-target notebook and its matching section names are unaffected.
const other=seed(false);other.exec("INSERT INTO lists VALUES('other');INSERT INTO idiom_sections VALUES('other','grammar-4-1','Custom','custom','Custom',1,1,NULL,NULL,NULL);INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) VALUES('other-id','other','test phrase','grammar-4-1',1);INSERT INTO idiom_senses VALUES('other-sense','other-id','custom meaning',0);");other.exec(sql);
assert.equal(other.prepare("SELECT meaning FROM idiom_senses WHERE id='other-sense'").get().meaning,'custom meaning');other.close();
// Unrelated concurrent meaning/ref edits survive; changed target text stops atomically.
const changed=seed();const id=fixture.before.entries[0].meanings[0].id;
assert(!edited.has(id));changed.prepare('UPDATE idiom_senses SET meaning=? WHERE id=?').run('後から修正した意味',id);changed.exec(sql);
assert.equal(changed.prepare('SELECT meaning FROM idiom_senses WHERE id=?').get(id).meaning,'後から修正した意味');changed.close();
for(const kind of ['meaning','phrase','section','missing','replacement']) {
 const d=seed();
 if(kind==='meaning')d.prepare('UPDATE idiom_senses SET meaning=? WHERE id=?').run('後から修正した意味',fixture.edits[0].id);
 if(kind==='phrase')d.prepare('UPDATE idioms SET phrase=? WHERE id=?').run('later edit',fixture.before.entries[0].key);
 if(kind==='section')d.prepare('UPDATE idioms SET section_key=? WHERE id=?').run(fixture.before.chapters[1].sections[0].key,fixture.before.entries[0].key);
 if(kind==='missing'||kind==='replacement')d.prepare('DELETE FROM idioms WHERE id=?').run(fixture.before.entries[0].key);
 if(kind==='replacement')d.exec("INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) VALUES('replacement','crossover-v3','replacement phrase','grammar-4-1',1)");
 const count=d.prepare('SELECT count(*) n FROM idioms').get().n;
 d.exec('BEGIN');assert.throws(()=>d.exec(sql),/CHECK constraint/);d.exec('ROLLBACK');
 assert.equal(d.prepare('SELECT count(*) n FROM idioms').get().n,count);
 assert(!d.prepare("SELECT 1 FROM sqlite_master WHERE name='ga_guard'").get());d.close();
}
console.log('Whole-book audit: 301 dispositions; 262 additions; safe corrections/merges; refs, scope, guards and rollback passed');
