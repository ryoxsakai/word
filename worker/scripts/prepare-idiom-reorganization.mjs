import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {idiomKey} from '../../public/shared/idioms.js';
import {parseWordListItems} from '../../public/shared/markup.js';
import {policy,chapters,destination} from './idiom-reorganization-policy.mjs';

const {words} = JSON.parse(fs.readFileSync(process.argv[2]));
const collection = JSON.parse(fs.readFileSync(process.argv[3]));
const before = new Map(words.map(w=>[w.id,w]));
const after = new Map(words.map(w=>[w.id,structuredClone(w)]));
const validSections = new Set(chapters.flatMap(c=>c.sections.map(s=>s.key)));
const entries = new Map();
const retired = [];
const touched = new Set();
const operations = [];
const editorial = [];
const returned = [];
const key = idiomKey;
const idFor = phrase => `crossover-idiom-${createHash('sha256').update(key(phrase)).digest('hex').slice(0,24)}`;
const normalize = x=>String(x||'').replace(/～/g,'〜').replace(/\s+/g,' ').trim();

for(const original of collection.entries) {
  const sectionKey=destination(original);
  if(sectionKey==null) {retired.push(original);continue;}
  assert(validSections.has(sectionKey),`Unclassified: ${original.phrase} (${sectionKey})`);
  entries.set(key(original.phrase),{...structuredClone(original),sectionKey});
}
function add(phrase,meaning,wordId,sectionKey) {
  assert(validSections.has(sectionKey),sectionKey);
  let e=entries.get(key(phrase));
  if(!e) {e={key:idFor(phrase),phrase,sectionKey,meanings:[]};entries.set(key(phrase),e);}
  e.sectionKey=sectionKey;
  let s=e.meanings.find(s=>normalize(s.meaning)===normalize(meaning));
  if(!s) {s={id:`${e.key}:r39-${createHash('sha256').update(meaning).digest('hex').slice(0,12)}`,meaning,refs:[]};e.meanings.push(s);}
  if(!s.refs.some(r=>r.wordId===wordId))s.refs.push({wordId,source:'phrase'});
  return e.key;
}
function ensureWord(wordId,phrase,meaning,reason) {
  const w=after.get(wordId);assert(w,`Missing destination word ${wordId}`);touched.add(wordId);
  const existing=w.examples.some(e=>e.type==='phrase'&&normalize(e.sentence)===normalize(phrase)&&normalize(e.translation)===normalize(meaning)) ||
    parseWordListItems(w.relatedWords).some(i=>normalize(i.target)===normalize(phrase)&&normalize(i.gloss)===normalize(meaning));
  // A merged phrase is an explicit, reviewed preservation destination too.
  const merged=editorial.some(o=>o.wordId===wordId&&o.kind==='merge'&&o.old.some(e=>normalize(e.sentence)===normalize(phrase)&&normalize(e.translation)===normalize(meaning)));
  if(!existing&&!merged)w.relatedWords=[w.relatedWords,`${phrase} (${meaning})`].filter(Boolean).join('\n');
  returned.push({wordId,phrase,meaning,reason,alreadyPresent:existing||merged});
}
for(const [wordId,p] of Object.entries(policy)) {
  const w=after.get(wordId);assert(w,wordId);const phrases=w.examples.filter(e=>e.type==='phrase');
  assert(phrases.length>5,`Snapshot changed: ${wordId}`);
  const consumed=new Set();const consume=index=>{index=Number(index);assert(phrases[index]&&!consumed.has(index),`${wordId}:${index}`);assert(!phrases[index].answer);consumed.add(index);return phrases[index];};
  const mergedAt=new Map();
  for(const [index,section] of Object.entries(p.move||{})) {
    const ex=consume(index);const idiomId=add(ex.sentence,ex.translation,wordId,section);
    editorial.push({wordId,kind:'idiom',old:[ex],idiomId,section});
  }
  for(const [index,target] of Object.entries(p.word||{})) {
    const ex=consume(index);ensureWord(target,ex.sentence,ex.translation,'単語語法へ移動');
    editorial.push({wordId,kind:'word',old:[ex],target});
  }
  for(const [index,rows] of Object.entries(p.split||{})) {
    const ex=consume(index);const ids=rows.map(([phrase,meaning])=>add(phrase,meaning,wordId,'do'));
    editorial.push({wordId,kind:'split',old:[ex],idiomIds:ids});
  }
  for(const m of p.merge||[]) {
    const old=m.indices.map(consume);const replacement={...old[0],sentence:m.phrase,translation:m.meaning};
    mergedAt.set(m.indices[0],replacement);editorial.push({wordId,kind:'merge',old,replacement});
  }
  w.examples=w.examples.flatMap(e=>{const index=phrases.indexOf(e);return mergedAt.has(index)?[mergedAt.get(index)]:consumed.has(index)?[]:[e];});
  if(consumed.size)touched.add(wordId);
  const count=w.examples.filter(e=>e.type==='phrase').length;
  assert(count<=5 || (p.exception&&count<=7),`${wordId}: ${count} phrases without an approved exception`);
}
for(const e of retired)for(const s of e.meanings)for(const r of s.refs)ensureWord(r.wordId,e.phrase,s.meaning,'熟語Sectionを廃止し単語側へ');

// Normalize two equivalent be patterns while preserving every meaning/reference.
for(const [oldPhrase,newPhrase] of [['be concerned about','be concerned about O'],['be opposed to O','be opposed to O / Ving'],['be opposed to O/Ving','be opposed to O / Ving']]) {
  const e=entries.get(key(oldPhrase));if(!e)continue;
  for(const s of e.meanings)for(const r of s.refs)add(newPhrase,s.meaning,r.wordId,e.sectionKey);
  entries.delete(key(oldPhrase));operations.push({kind:'canonicalize',before:e,afterPhrase:newPhrase});
}
const finalEntries=[...entries.values()].sort((a,b)=>a.phrase.localeCompare(b.phrase,'en',{sensitivity:'base'}));
const changes=[...new Set([...touched,...Object.keys(policy)])].map(id=>({before:before.get(id),after:after.get(id)}));
const slim=w=>({id:w.id,spelling:w.spelling,chapterId:w.chapterId,sectionId:w.sectionId,relatedWords:w.relatedWords,examples:w.examples});
const fixture={beforeChapters:collection.chapters,chapters,beforeEntries:collection.entries,afterEntries:finalEntries,
  words:changes.map(c=>({before:slim(c.before),after:slim(c.after)})),editorial,returned,operations,
  retiredIds:retired.map(e=>e.key),exceptions:Object.entries(policy).filter(([,p])=>p.exception).map(([wordId,p])=>({wordId,reason:p.exception,count:after.get(wordId).examples.filter(e=>e.type==='phrase').length}))};

const q=x=>x==null?'NULL':String(x).split(/([\n\r;])/).map(s=>s==='\n'?'char(10)':s==='\r'?'char(13)':s===';'?'char(59)':`'${s.replaceAll("'","''")}'`).join(' || ');
const existsList="EXISTS (SELECT 1 FROM lists WHERE id = 'crossover-v3')";
const sql=[`-- Three-chapter editorial reorganization. Generated from a reviewed snapshot.
CREATE TABLE IF NOT EXISTS idiom_revision_backup (revision TEXT NOT NULL, object_key TEXT NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY(revision,object_key));
INSERT OR IGNORE INTO idiom_revision_backup SELECT '0039','sections',json_group_array(json_object('list_id',list_id,'section_key',section_key,'subtitle',subtitle,'chapter_key',chapter_key,'chapter_subtitle',chapter_subtitle,'chapter_order',chapter_order,'sort_order',sort_order)) FROM idiom_sections WHERE list_id='crossover-v3';
INSERT OR IGNORE INTO idiom_revision_backup SELECT '0039',i.id,json_object('id',i.id,'phrase',i.phrase,'section_key',i.section_key,'sort_order',i.sort_order,'meanings',json((SELECT json_group_array(json_object('id',s.id,'meaning',s.meaning,'sort_order',s.sort_order,'refs',json((SELECT json_group_array(json_object('word_id',r.word_id,'source',r.source)) FROM idiom_word_refs r WHERE r.sense_id=s.id)))) FROM idiom_senses s WHERE s.idiom_id=i.id))) FROM idioms i WHERE i.list_id='crossover-v3';
CREATE TABLE IF NOT EXISTS idiom_reorganization_ready (word_id TEXT PRIMARY KEY);
DELETE FROM idiom_reorganization_ready;`];
const phraseMatch=(e)=>`sentence=${q(e.sentence)} AND translation IS ${q(e.translation)} AND answer IS ${q(e.answer)} AND type='phrase' AND sort_order=${Number(e.sortOrder)}`;
for(const {before:b} of changes) {
  const ps=b.examples.filter(e=>e.type==='phrase');
  const conditions=[`related_words IS ${q(b.relatedWords)}`,`(SELECT count(*) FROM examples WHERE word_id=words.id AND type='phrase')=${ps.length}`,
    ...ps.map(e=>`EXISTS (SELECT 1 FROM examples WHERE word_id=words.id AND ${phraseMatch(e)})`)];
  sql.push(`INSERT OR IGNORE INTO idiom_reorganization_ready SELECT id FROM words WHERE id=${q(b.id)} AND ${existsList} AND EXISTS (SELECT 1 FROM list_items WHERE list_id='crossover-v3' AND word_id=words.id) AND ${conditions.join(' AND ')};`);
  sql.push(`INSERT OR IGNORE INTO idiom_migration_backup (migration_key,word_id,snapshot) SELECT '0039',id,json_object('relatedWords',related_words,'examples',json((SELECT json_group_array(json_object('id',id,'sentence',sentence,'translation',translation,'answer',answer,'type',type,'sortOrder',sort_order)) FROM examples WHERE word_id=words.id))) FROM words WHERE id=${q(b.id)} AND EXISTS (SELECT 1 FROM idiom_reorganization_ready WHERE word_id=words.id);`);
}
for(const [ci,c] of chapters.entries())for(const [si,s]of c.sections.entries()) sql.push(`INSERT INTO idiom_sections (list_id,section_key,subtitle,chapter_key,chapter_subtitle,chapter_order,sort_order) SELECT 'crossover-v3',${q(s.key)},${q(s.subtitle)},${q(c.key)},${q(c.subtitle)},${ci+1},${si+1} WHERE ${existsList} ON CONFLICT(list_id,section_key) DO UPDATE SET subtitle=excluded.subtitle,chapter_key=excluded.chapter_key,chapter_subtitle=excluded.chapter_subtitle,chapter_order=excluded.chapter_order,sort_order=excluded.sort_order;`);
for(const [index,e]of finalEntries.entries()) {
  sql.push(`INSERT INTO idioms (id,list_id,phrase,section_key,sort_order) SELECT ${q(e.key)},'crossover-v3',${q(e.phrase)},${q(e.sectionKey)},${index} WHERE ${existsList} ON CONFLICT(id) DO UPDATE SET section_key=excluded.section_key,sort_order=excluded.sort_order,updated_at=datetime('now') WHERE idioms.list_id='crossover-v3' AND idioms.phrase=excluded.phrase;`);
  for(const [si,s]of e.meanings.entries()) {
    sql.push(`INSERT OR IGNORE INTO idiom_senses (id,idiom_id,meaning,sort_order) SELECT ${q(s.id)},${q(e.key)},${q(s.meaning)},${si} WHERE EXISTS (SELECT 1 FROM idioms WHERE id=${q(e.key)});`);
    for(const r of s.refs)sql.push(`INSERT OR IGNORE INTO idiom_word_refs (sense_id,word_id,source) SELECT ${q(s.id)},${q(r.wordId)},${q(r.source||'phrase')} WHERE EXISTS (SELECT 1 FROM idiom_senses WHERE id=${q(s.id)}) AND EXISTS (SELECT 1 FROM words WHERE id=${q(r.wordId)});`);
  }
}
const ready=id=>`EXISTS (SELECT 1 FROM idiom_reorganization_ready WHERE word_id=${q(id)})`;
const entryUnchanged=e=>[
  `(SELECT count(*) FROM idiom_senses WHERE idiom_id=${q(e.key)})=${e.meanings.length}`,
  ...e.meanings.flatMap(s=>[
    `EXISTS (SELECT 1 FROM idiom_senses WHERE id=${q(s.id)} AND idiom_id=${q(e.key)} AND meaning=${q(s.meaning)})`,
    `(SELECT count(*) FROM idiom_word_refs WHERE sense_id=${q(s.id)})=${s.refs.length}`,
    ...s.refs.map(r=>`EXISTS (SELECT 1 FROM idiom_word_refs WHERE sense_id=${q(s.id)} AND word_id=${q(r.wordId)})`),
  ]),
].join(' AND ');
for(const {before:b,after:a}of changes)if(b.relatedWords!==a.relatedWords)sql.push(`UPDATE words SET related_words=${q(a.relatedWords)},updated_at=datetime('now') WHERE id=${q(b.id)} AND ${ready(b.id)};`);
for(const op of editorial) {
  let guard=ready(op.wordId);
  if(op.kind==='word')guard+=` AND ${ready(op.target)}`;
  if(op.kind==='idiom'||op.kind==='split') {
    const ids=op.idiomIds||[op.idiomId];
    guard+=` AND ${ids.map(id=>`EXISTS (SELECT 1 FROM idioms i JOIN idiom_senses s ON s.idiom_id=i.id JOIN idiom_word_refs r ON r.sense_id=s.id WHERE i.id=${q(id)} AND r.word_id=${q(op.wordId)})`).join(' AND ')}`;
  }
  for(const [i,ex]of op.old.entries()) {
    if(op.kind==='merge'&&i===0)sql.push(`UPDATE examples SET sentence=${q(op.replacement.sentence)},translation=${q(op.replacement.translation)} WHERE word_id=${q(op.wordId)} AND ${phraseMatch(ex)} AND ${guard};`);
    else sql.push(`DELETE FROM examples WHERE word_id=${q(op.wordId)} AND ${phraseMatch(ex)} AND ${guard};`);
  }
  sql.push(`UPDATE words SET updated_at=datetime('now') WHERE id=${q(op.wordId)} AND ${guard};`);
}
for(const e of retired) {
  const refs=[...new Set(e.meanings.flatMap(s=>s.refs.map(r=>r.wordId)))];
  sql.push(`DELETE FROM idioms WHERE id=${q(e.key)} AND phrase=${q(e.phrase)} AND ${entryUnchanged(e)} AND ${refs.map(ready).join(' AND ')};`);
}
for(const op of operations) {
  const target=entries.get(key(op.afterPhrase));
  const checks=op.before.meanings.flatMap(s=>s.refs.map(r=>`EXISTS (SELECT 1 FROM idiom_senses s JOIN idiom_word_refs r ON r.sense_id=s.id WHERE s.idiom_id=${q(target.key)} AND s.meaning=${q(s.meaning)} AND r.word_id=${q(r.wordId)})`));
  sql.push(`DELETE FROM idioms WHERE id=${q(op.before.key)} AND phrase=${q(op.before.phrase)} AND ${entryUnchanged(op.before)} AND ${checks.join(' AND ')};`);
}
sql.push(`DELETE FROM idiom_sections WHERE list_id='crossover-v3' AND section_key NOT IN (${[...validSections].map(q).join(',')}) AND NOT EXISTS (SELECT 1 FROM idioms WHERE idioms.list_id=idiom_sections.list_id AND idioms.section_key=idiom_sections.section_key);
DROP TABLE idiom_reorganization_ready;`);
fs.writeFileSync(new URL('../migrations/0039_reorganize_idiom_chapters.sql',import.meta.url),sql.join('\n')+'\n');
fs.writeFileSync(new URL('../test/fixtures/idiom-reorganization.json',import.meta.url),JSON.stringify(fixture));
const report=['# 熟語3章への再編（0039）','','| Chapter | Section | 表現数 |','|---|---|---:|'];
let sectionNo=0;
for(const [ci,c]of chapters.entries())for(const s of c.sections){const count=finalEntries.filter(e=>e.sectionKey===s.key).length;if(count)report.push(`| ${ci+1} ${c.subtitle} | ${++sectionNo} ${s.subtitle} | ${count} |`);}
report.push('','## 単語側の整理','','| 単語 | 整理前 | 整理後 | 熟語・他の単語へ移動／統合 |','|---|---:|---:|---|');
for(const [id,p]of Object.entries(policy)){const old=before.get(id).examples.filter(e=>e.type==='phrase').length;const current=after.get(id).examples.filter(e=>e.type==='phrase').length;report.push(`| ${id} | ${old} | ${current} | ${p.exception||editorial.filter(o=>o.wordId===id).flatMap(o=>o.old.map(e=>e.sentence)).join('、')} |`);}
report.push('','## 単語側に戻した熟語','','| 表現 | 掲載先 |','|---|---|');
for(const e of retired)report.push(`| ${e.phrase} | ${[...new Set(e.meanings.flatMap(s=>s.refs.map(r=>r.wordId)))].join('、')} |`);
report.push('','## 語義確認','','do withの混在した語義はcould do with、be / have done with、what to do withに分離した。',
'- [Oxford: do with](https://www.oxfordlearnersdictionaries.com/definition/english/do-with)',
'- [Cambridge: could do with](https://dictionary.cambridge.org/dictionary/english/could-do-with)',
'- [Collins: have or be done with](https://www.collinsdictionary.com/dictionary/english-thesaurus/have-or-be-done-with-something-or-someone)',
'','移行直前の単語欄はidiom_migration_backup、熟語・分類はidiom_revision_backupへ保存する。同時編集がある語は処理を見送り、対応する熟語の廃止も見送る。');
fs.writeFileSync(new URL('../IDIOM_REORGANIZATION.md',import.meta.url),report.join('\n')+'\n');
console.log(JSON.stringify({entries:finalEntries.length,chapters:chapters.length,sections:sectionNo,wordChanges:changes.filter(c=>JSON.stringify(c.before)!==JSON.stringify(c.after)).length,
  beforePhrases:changes.reduce((n,c)=>n+c.before.examples.filter(e=>e.type==='phrase').length,0),afterPhrases:changes.reduce((n,c)=>n+c.after.examples.filter(e=>e.type==='phrase').length,0),retired:retired.length,exceptions:fixture.exceptions}));
