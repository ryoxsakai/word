import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readIdioms, saveIdiom} from '../src/idioms.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/idiom-fields.json',import.meta.url)));
const migration=name=>fs.readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8');
const sql=migration('0049_refine_idiom_content.sql');
function seed(populated=true) {
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON;CREATE TABLE lists(id TEXT PRIMARY KEY);CREATE TABLE words(id TEXT PRIMARY KEY);');
 db.exec(migration('0037_independent_idioms.sql'));
 db.exec(migration('0044_idiom_group_hierarchy.sql'));
 db.exec(migration('0048_idiom_editor_fields.sql'));
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
function d1(db) {return {prepare(sql){let args=[];return {bind(...v){args=v;return this;},async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};},async batch(stmts){db.exec('BEGIN');try{for(const s of stmts)await s.run();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}};}
const db=seed();db.exec("CREATE TABLE list_items(list_id TEXT,word_id TEXT);INSERT INTO list_items SELECT 'crossover-v3',id FROM words;");
const originalWords=db.prepare('SELECT * FROM words ORDER BY id').all();
db.exec(sql);
const actual=await readIdioms(d1(db),'crossover-v3');
assert.deepEqual(actual.entries,fixture.after.entries);
assert.deepEqual(actual.chapters,fixture.after.chapters);
assert.equal(actual.entries.filter(e=>e.hidden).length,50);
assert.equal(actual.entries.filter(e=>!e.hidden).length,1743);
for(const entry of actual.entries)assert(![entry.phrase,entry.notes,...entry.meanings.map(s=>s.meaning)].join(' ').includes('V-ed'));
const get=p=>actual.entries.find(e=>e.phrase===p);
assert(get('have O V / Ving / Vpp').notes.includes('have O Vpp'));
assert.equal(get('have O V / Ving / Vpp').meanings.length,4);
assert(get('take / catch / hold O by the arm').aliases.some(a=>a.phrase==='hold O by the arm'));
assert(!get('will do').hidden);assert(!get('reply to O').hidden);assert(get('be C').hidden);
assert(get('make oneself Vpp').notes.includes('make oneself understood'));
assert.equal(get('make oneself Vpp').meanings.length,1);
for(const e of fixture.before.entries) {
 const target=actual.entries.find(x=>x.key===e.key)||actual.entries.find(x=>x.key===fixture.merges.find(m=>m.from===e.key)?.to);
 assert(target);
 for(const r of e.meanings.flatMap(s=>s.refs))assert(target.meanings.some(s=>s.refs.some(n=>n.wordId===r.wordId&&n.source===r.source)),'all semantic refs remain within their idiom');
}
assert.deepEqual(db.prepare('SELECT * FROM words ORDER BY id').all(),originalWords);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
const api=d1(db),e=get('look into O');
const payload={id:e.key,phrase:e.phrase,sectionKey:e.sectionKey,synonyms:'investigate',antonyms:'##idiom:look up to O##',notes:'**確認**：##word:investigate##',hidden:true,meanings:e.meanings.map(s=>({id:s.id,meaning:s.meaning,wordIds:s.refs.map(r=>r.wordId)}))};
const order=db.prepare('SELECT sort_order FROM idioms WHERE id=?').get(e.key).sort_order;
await saveIdiom(api,'crossover-v3',payload);
let saved=(await readIdioms(api,'crossover-v3')).entries.find(x=>x.key===e.key);
assert.equal(saved.notes,payload.notes);assert.equal(saved.antonyms,payload.antonyms);assert.equal(saved.hidden,true);assert.deepEqual(saved.meanings,e.meanings);
assert.equal(db.prepare('SELECT sort_order FROM idioms WHERE id=?').get(e.key).sort_order,order);
await saveIdiom(api,'crossover-v3',{...payload,notes:'',hidden:false});
saved=(await readIdioms(api,'crossover-v3')).entries.find(x=>x.key===e.key);assert(!saved.notes);assert(!saved.hidden);
const {notes,antonyms,synonyms,hidden,...legacy}=payload;
await saveIdiom(api,'crossover-v3',legacy);
saved=(await readIdioms(api,'crossover-v3')).entries.find(x=>x.key===e.key);assert.equal(saved.synonyms,'investigate');assert.equal(saved.antonyms,payload.antonyms);
await assert.rejects(saveIdiom(api,'crossover-v3',{...payload,notes:5}),/Invalid notes/);
await assert.rejects(saveIdiom(api,'crossover-v3',{...payload,hidden:'yes'}),/Invalid hidden/);
await assert.rejects(saveIdiom(api,'crossover-v3',{...payload,meanings:[{id:actual.entries[0].meanings[0].id,meaning:'bad',wordIds:[]}]}),/does not belong/);
const invalid=payload.meanings.map(s=>({...s,wordIds:['not-a-word']}));
await assert.rejects(saveIdiom(api,'crossover-v3',{...payload,meanings:invalid}),/not in this notebook/);
assert.deepEqual((await readIdioms(api,'crossover-v3')).entries.find(x=>x.key===e.key),saved,'invalid edits are atomic');
// New senses can be inserted before retained IDs, without an index-based collision.
await saveIdiom(api,'crossover-v3',{...legacy,meanings:[{meaning:'追加の意味',wordIds:[]},...legacy.meanings]});
assert.equal((await readIdioms(api,'crossover-v3')).entries.find(x=>x.key===e.key).meanings[0].meaning,'追加の意味');
db.close();
const empty=seed(false);empty.exec(sql);assert.equal(empty.prepare('SELECT count(*) n FROM idioms').get().n,0);empty.close();
for(const kind of ['meaning','notes','added']) {
 const changed=seed();
 if(kind==='meaning')changed.prepare('UPDATE idiom_senses SET meaning=? WHERE id=?').run('later',fixture.before.entries[0].meanings[0].id);
 if(kind==='notes')changed.prepare('UPDATE idioms SET notes=? WHERE id=?').run('later',fixture.before.entries[0].key);
 if(kind==='added')changed.prepare('INSERT INTO idiom_senses VALUES(?,?,?,?)').run('later',fixture.before.entries[0].key,'later',99);
 changed.exec('BEGIN');assert.throws(()=>changed.exec(sql),/CHECK constraint/);changed.exec('ROLLBACK');changed.close();
}
console.log('Idiom fields, visibility, consolidation, notes, Vpp, API edits, reference preservation and migration guards passed');
