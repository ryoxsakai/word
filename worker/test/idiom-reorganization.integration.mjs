import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readIdioms} from '../src/idioms.js';
import {resolveIdiomReferences,groupIdiomEntries} from '../../public/shared/idioms.js';
import {parseWordListItems} from '../../public/shared/markup.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/idiom-reorganization.json',import.meta.url)));
const sql=fs.readFileSync(new URL('../migrations/0039_reorganize_idiom_chapters.sql',import.meta.url),'utf8');
const fullSnapshot=process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2])).words : null;
function seed() {
  const db=new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE lists(id TEXT PRIMARY KEY);
    CREATE TABLE words(id TEXT PRIMARY KEY,spelling TEXT,related_words TEXT,notes TEXT DEFAULT 'untouched',updated_at TEXT);
    CREATE TABLE list_items(list_id TEXT,word_id TEXT);
    CREATE TABLE examples(id INTEGER PRIMARY KEY,word_id TEXT,sentence TEXT,translation TEXT,answer TEXT,type TEXT,sort_order INTEGER);
    INSERT INTO lists VALUES ('crossover-v3');`);
  db.exec(fs.readFileSync(new URL('../migrations/0037_independent_idioms.sql',import.meta.url),'utf8'));
  const words=new Map((fullSnapshot||fixture.words.map(c=>c.before)).map(w=>[w.id,w]));
  for(const e of fixture.beforeEntries)for(const s of e.meanings)for(const r of s.refs)if(!words.has(r.wordId))words.set(r.wordId,{id:r.wordId,spelling:r.wordId,relatedWords:null,examples:[]});
  for(const w of words.values()) {
    db.prepare('INSERT INTO words(id,spelling,related_words) VALUES (?,?,?)').run(w.id,w.spelling,w.relatedWords);
    db.prepare("INSERT INTO list_items VALUES ('crossover-v3',?)").run(w.id);
    for(const e of w.examples)db.prepare('INSERT INTO examples(word_id,sentence,translation,answer,type,sort_order) VALUES (?,?,?,?,?,?)')
      .run(w.id,e.sentence,e.translation,e.answer,e.type,e.sortOrder);
  }
  for(const [ci,c]of fixture.beforeChapters.entries())for(const [si,s]of c.sections.entries())db.prepare("INSERT INTO idiom_sections VALUES ('crossover-v3',?,?,?,?,?,?)").run(s.key,s.subtitle,c.key,c.subtitle,ci+1,si+1);
  for(const [i,e]of fixture.beforeEntries.entries()) {
    db.prepare("INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) VALUES (?,'crossover-v3',?,?,?)").run(e.key,e.phrase,e.sectionKey,i);
    for(const [si,s]of e.meanings.entries()) {
      db.prepare('INSERT INTO idiom_senses VALUES (?,?,?,?)').run(s.id,e.key,s.meaning,si);
      for(const r of s.refs)db.prepare('INSERT INTO idiom_word_refs VALUES (?,?,?)').run(s.id,r.wordId,r.source);
    }
  }
  return {db,words};
}
function d1(db) {
  return {prepare(sql) {
    let args=[];
    return {bind(...v){args=v;return this;},async all(){return {results:db.prepare(sql).all(...args)};}};
  }};
}
const normalized=es=>es.flatMap(e=>e.meanings.flatMap(s=>s.refs.map(r=>JSON.stringify([e.key,e.phrase,e.sectionKey,s.meaning,r.wordId])))).sort();
const {db,words}=seed();db.exec(sql);
const actual=await readIdioms(d1(db),'crossover-v3');
assert.deepEqual(actual.chapters,fixture.chapters);
assert.deepEqual(normalized(actual.entries),normalized(fixture.afterEntries),'every planned sense/reference and classification is preserved');
const norm=x=>String(x||'').replace(/～/g,'〜').replace(/\s+/g,' ').trim();
for(const old of fixture.beforeEntries) {
  const canonical=fixture.operations.find(o=>o.before.key===old.key);
  const current=actual.entries.find(e=>canonical?e.phrase===canonical.afterPhrase:e.key===old.key);
  if(current) {
    for(const s of old.meanings)for(const r of s.refs)assert(current.meanings.some(m=>m.meaning===s.meaning&&m.refs.some(ref=>ref.wordId===r.wordId)),old.phrase+' original meaning/reference');
  } else {
    assert(fixture.retiredIds.includes(old.key),'only reviewed entries may leave the idiom tab');
    for(const s of old.meanings)for(const r of s.refs) {
      const phrase=db.prepare("SELECT 1 FROM examples WHERE word_id=? AND type='phrase' AND sentence=? AND translation=?").get(r.wordId,old.phrase,s.meaning);
      const related=parseWordListItems(db.prepare('SELECT related_words FROM words WHERE id=?').get(r.wordId).related_words)
        .some(i=>norm(i.target)===norm(old.phrase)&&norm(i.gloss)===norm(s.meaning));
      const merged=fixture.editorial.some(op=>op.kind==='merge'&&op.wordId===r.wordId&&op.old.some(e=>norm(e.sentence)===norm(old.phrase)&&norm(e.translation)===norm(s.meaning)));
      assert(phrase||related||merged,old.phrase+' must remain available under its word');
    }
  }
}
assert.equal(actual.entries.length,732);
assert.equal(groupIdiomEntries(resolveIdiomReferences(actual.entries,[...words.values()].map((w,i)=>({...w,seqNo:String(i+1)}))),actual.chapters).flatMap(c=>c.sections).length,50);
for(const [id,w]of words) {
  const expected=fixture.words.find(c=>c.before.id===id)?.after||w;
  assert.equal(db.prepare('SELECT related_words FROM words WHERE id=?').get(id).related_words,expected.relatedWords,id+' related');
  const es=db.prepare('SELECT sentence,translation,answer,type,sort_order AS sortOrder FROM examples WHERE word_id=? ORDER BY sort_order,id').all(id).map(r=>({...r}));
  assert.deepEqual(es,expected.examples,id+' examples');
}
assert.equal(db.prepare("SELECT count(*) AS n FROM words WHERE notes != 'untouched'").get().n,0);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
for(const e of fixture.beforeEntries)assert(db.prepare("SELECT 1 FROM idiom_revision_backup WHERE revision='0039' AND object_key=?").get(e.key),'original idiom backup');
assert(!actual.entries.some(e=>e.sectionKey==='other-verbs'||e.sectionKey==='be-preposition'));
assert.equal(db.prepare("SELECT count(*) AS n FROM examples WHERE word_id='do' AND type='phrase'").get().n,3);
assert.equal(db.prepare("SELECT count(*) AS n FROM examples WHERE word_id='get' AND type='phrase'").get().n,5);
const baseline=normalized(actual.entries);db.exec(sql);
assert.deepEqual(normalized((await readIdioms(d1(db),'crossover-v3')).entries),baseline,'rerunning does not resurrect retired entries');
assert.equal(db.prepare("SELECT count(*) AS n FROM examples WHERE word_id='do' AND type='phrase'").get().n,3);
db.close();

// Concurrent changes are retained, including idiom senses about to be retired.
const race=seed().db;
race.prepare("UPDATE examples SET translation='後から変更' WHERE word_id='do' AND sentence='do without O'").run();
const retiring=fixture.beforeEntries.find(e=>e.phrase==='if any');
race.prepare("UPDATE idiom_senses SET meaning='後から変更した意味' WHERE id=?").run(retiring.meanings[0].id);
race.exec(sql);
assert.equal(race.prepare("SELECT count(*) AS n FROM examples WHERE word_id='do' AND type='phrase'").get().n,12);
assert.equal(race.prepare('SELECT meaning FROM idiom_senses WHERE id=?').get(retiring.meanings[0].id).meaning,'後から変更した意味');
assert(race.prepare('SELECT 1 FROM idioms WHERE id=?').get(retiring.key));
race.close();
console.log(`Idiom reorganization passed: 3 chapters, 50 sections, 732 entries; ${words.size} words checked, backups and concurrent edits protected`);
