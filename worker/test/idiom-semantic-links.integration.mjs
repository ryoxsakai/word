import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readIdioms} from '../src/idioms.js';
import {renderIdiomEntry} from '../../public/viewer/idiom-entry.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/idiom-semantic-links.json',import.meta.url)));
const sql=fs.readFileSync(new URL('../migrations/0042_semantic_idiom_links.sql',import.meta.url),'utf8');
function seed() {
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE lists(id TEXT PRIMARY KEY);CREATE TABLE words(id TEXT PRIMARY KEY);INSERT INTO lists VALUES ('crossover-v3');`);
 db.exec(fs.readFileSync(new URL('../migrations/0037_independent_idioms.sql',import.meta.url),'utf8'));
 const wordIds=new Set(fixture.entries.flatMap(e=>e.meanings.flatMap(s=>s.refs.map(r=>r.wordId))));
 for(const id of wordIds)db.prepare('INSERT INTO words VALUES (?)').run(id);
 for(const key of new Set(fixture.entries.map(e=>e.sectionKey)))db.prepare("INSERT INTO idiom_sections VALUES ('crossover-v3',?,?,'chapter','Chapter',1,1)").run(key,key);
 for(const [index,e]of fixture.entries.entries()) {
  db.prepare("INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) VALUES (?,'crossover-v3',?,?,?)").run(e.key,e.phrase,e.sectionKey,index);
  for(const [si,s]of e.meanings.entries()) {
   db.prepare('INSERT INTO idiom_senses VALUES (?,?,?,?)').run(s.id,e.key,s.meaning,si);
   for(const r of s.refs)db.prepare('INSERT INTO idiom_word_refs VALUES (?,?,?)').run(s.id,r.wordId,r.source);
  }
 }
 return db;
}
function d1(db) {return {prepare(sql) {let args=[];return {bind(...v){args=v;return this;},async all(){return {results:db.prepare(sql).all(...args)};}};}};}
const db=seed();
const before=(await readIdioms(d1(db),'crossover-v3'));
const removed=new Set(fixture.removed.map(r=>JSON.stringify(r)));
const expected=before.entries.map(e=>({...e,meanings:e.meanings.map(s=>({...s,refs:s.refs.filter(r=>!removed.has(JSON.stringify([s.id,r.wordId])))}))}));
db.exec(sql);
db.exec(sql);
const after=await readIdioms(d1(db),'crossover-v3');
assert.deepEqual(after.entries,expected,'only the reviewed references are removed; all entries and meanings remain');
assert.deepEqual(after.chapters,before.chapters);
assert.equal(db.prepare("SELECT count(*) n FROM idiom_revision_backup WHERE revision='0042'").get().n,646);
assert.equal(db.prepare('SELECT count(*) n FROM idiom_word_refs').get().n,202);
const entry=phrase=>after.entries.find(e=>e.phrase===phrase);
const refs=phrase=>entry(phrase).meanings.map(s=>s.refs.map(r=>r.wordId));
assert.deepEqual(refs('look into O'),[['investigate'],[]]);
assert.deepEqual(refs('look up to O'),[['admire','respect']]);
assert.deepEqual(refs('let O down / let down O'),[['disappoint']]);
assert.deepEqual(refs('look forward to O / Ving'),[[]]);
assert.deepEqual(refs('hand O in'),[['submit']]);
assert.deepEqual(refs('make up for O'),[['compensate']]);
assert.deepEqual(refs('stand by'),[['support']]);
assert.deepEqual(refs('bring forward'),[[]]);
const html=renderIdiomEntry({...entry('look forward to O / Ving'),no:'1'},'https://vocab.lrnr.jp');
assert.match(html,/楽しみに待つ/);
assert.doesNotMatch(html,/idiom-refs|idiom-ref-icon/);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
db.close();

const changed=seed();
const target=fixture.entries.find(e=>e.phrase==='look into O').meanings[0];
changed.prepare("UPDATE idiom_senses SET meaning='後から編集した語義' WHERE id=?").run(target.id);
const added=fixture.entries.find(e=>e.phrase==='look forward to O / Ving').meanings[0];
changed.prepare("INSERT INTO idiom_word_refs VALUES (?,'admire','new-editor-reference')").run(added.id);
changed.exec(sql);
assert(changed.prepare("SELECT 1 FROM idiom_word_refs WHERE sense_id=? AND word_id='look'").get(target.id));
assert(changed.prepare("SELECT 1 FROM idiom_word_refs WHERE sense_id=? AND word_id='admire'").get(added.id));
assert.equal(changed.prepare("SELECT 1 FROM idiom_revision_backup WHERE revision='0042' AND object_key=?").get(target.id+'/look'),undefined);
changed.close();
console.log('Semantic idiom links passed: 646 backed-up removals, 202 retained refs, all 732 entries preserved, empty links hidden, concurrent edits retained');
