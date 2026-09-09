import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readIdioms} from '../src/idioms.js';
import {resolveIdiomReferences} from '../../public/shared/idioms.js';
import {renderIdiomEntry} from '../../public/viewer/idiom-entry.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/idiom-reference-audit.json',import.meta.url)));
const sql=fs.readFileSync(new URL('../migrations/0041_audit_idiom_references.sql',import.meta.url),'utf8');
function seed() {
  const db=new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE lists(id TEXT PRIMARY KEY);
    CREATE TABLE words(id TEXT PRIMARY KEY,spelling TEXT);
    CREATE TABLE list_items(list_id TEXT,word_id TEXT);
    INSERT INTO lists VALUES ('crossover-v3');`);
  db.exec(fs.readFileSync(new URL('../migrations/0037_independent_idioms.sql',import.meta.url),'utf8'));
  const words=new Map(fixture.additions.map(r=>[r.wordId,r.spelling]));
  for(const e of fixture.entries)for(const s of e.meanings)for(const r of s.refs)if(!words.has(r.wordId))words.set(r.wordId,r.wordId);
  for(const [id,spelling]of words) {
    db.prepare('INSERT INTO words VALUES (?,?)').run(id,spelling);
    db.prepare("INSERT INTO list_items VALUES ('crossover-v3',?)").run(id);
  }
  for(const key of new Set(fixture.entries.map(e=>e.sectionKey)))db.prepare("INSERT INTO idiom_sections VALUES ('crossover-v3',?,?,'verbs','動詞を中心とする熟語',1,1)").run(key,key);
  for(const [index,e]of fixture.entries.entries()) {
    db.prepare("INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) VALUES (?,'crossover-v3',?,?,?)").run(e.key,e.phrase,e.sectionKey,index);
    for(const [si,s]of e.meanings.entries()) {
      db.prepare('INSERT INTO idiom_senses VALUES (?,?,?,?)').run(s.id,e.key,s.meaning,si);
      for(const r of s.refs)db.prepare('INSERT INTO idiom_word_refs VALUES (?,?,?)').run(s.id,r.wordId,r.source);
    }
  }
  return db;
}
function d1(db) {
  return {prepare(sql) {
    let args=[];
    return {bind(...v){args=v;return this;},async all(){return {results:db.prepare(sql).all(...args)};}};
  }};
}
const db=seed();
const originalRefs=db.prepare('SELECT * FROM idiom_word_refs ORDER BY sense_id,word_id').all();
const originalSenses=db.prepare('SELECT * FROM idiom_senses ORDER BY id').all();
const originalWords=db.prepare('SELECT * FROM words ORDER BY id').all();
db.exec(sql);
db.exec(sql);
assert.equal(db.prepare('SELECT count(*) n FROM idiom_word_refs').get().n,originalRefs.length+fixture.additions.length);
for(const r of originalRefs)assert.deepEqual(db.prepare('SELECT * FROM idiom_word_refs WHERE sense_id=? AND word_id=?').get(r.sense_id,r.word_id),r);
for(const r of fixture.additions)assert.equal(db.prepare('SELECT source FROM idiom_word_refs WHERE sense_id=? AND word_id=?').get(r.senseId,r.wordId)?.source,'synonym');
assert.deepEqual(db.prepare('SELECT * FROM idiom_senses ORDER BY id').all(),originalSenses);
assert.deepEqual(db.prepare('SELECT * FROM words ORDER BY id').all(),originalWords);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
const entries=(await readIdioms(d1(db),'crossover-v3')).entries;
for(const phrase of ['look into O','look over O','go into O','go through O']) {
  const before=fixture.entries.find(e=>e.phrase===phrase);
  const after=entries.find(e=>e.phrase===phrase);
  const unchanged=before.meanings.filter(s=>!fixture.additions.some(r=>r.senseId===s.id));
  assert(unchanged.length>0);
  for(const sense of unchanged)assert.deepEqual(after.meanings.find(s=>s.id===sense.id),sense,'unrelated literal senses stay unchanged');
}
const lookInto=entries.find(e=>e.phrase==='look into O');
const resolved=resolveIdiomReferences([lookInto],[{id:'look',spelling:'look',seqNo:'10'},{id:'investigate',spelling:'investigate',seqNo:'20'}])[0];
const html=renderIdiomEntry({...resolved,no:'1'},'https://vocab.lrnr.jp');
assert.match(html,/href="#word-look"/);
assert.match(html,/href="#word-investigate"[^>]*>investigate \(no\.  20\)<\/a>/);
assert.equal(resolved.meanings[1].refs.length,1);
db.close();

// If the target sense or notebook membership changes, skip that reviewed link.
const changed=seed();
const target=fixture.additions.find(r=>r.phrase==='look into O');
changed.prepare("UPDATE idiom_senses SET meaning='後から編集された語義' WHERE id=?").run(target.senseId);
changed.exec("DELETE FROM list_items WHERE word_id='respect'");
changed.exec(sql);
assert.equal(changed.prepare('SELECT 1 FROM idiom_word_refs WHERE sense_id=? AND word_id=?').get(target.senseId,target.wordId),undefined);
assert.equal(changed.prepare("SELECT 1 FROM idiom_word_refs WHERE word_id='respect'").get(),undefined);
changed.close();
console.log(`Idiom reference audit passed: ${fixture.additions.length} additions; existing links, literal senses, concurrent edits and membership verified`);
