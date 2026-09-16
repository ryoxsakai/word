import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {readIdioms, readIdiomIndex, readIdiomSection, saveIdiom} from '../src/idioms.js';
import {callIdiomRead, callIdiomWrite} from '../src/idiom-mcp.js';
import {buildAlphabeticalIndexEntries} from '../../public/shared/word-index.js';
import {createIdiomReferenceResolver} from '../../public/shared/idiom-references.js';
import {renderIdiomEntry} from '../../public/viewer/idiom-entry.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/idiom-alternate-forms.json',import.meta.url),'utf8'));
const migration=name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8');
function seed(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("PRAGMA foreign_keys=ON;CREATE TABLE lists(id TEXT PRIMARY KEY);CREATE TABLE words(id TEXT PRIMARY KEY);CREATE TABLE list_items(list_id TEXT,word_id TEXT);INSERT INTO lists VALUES ('crossover-v3');INSERT INTO words VALUES ('provide');INSERT INTO list_items VALUES ('crossover-v3','provide');");
 for(const file of ['0037_independent_idioms.sql','0044_idiom_group_hierarchy.sql','0048_idiom_editor_fields.sql','0051_idiom_mcp_revision.sql','0014_mcp_audit_log.sql'])sql.exec(migration(file));
 sql.exec("ALTER TABLE idiom_sections ADD COLUMN display_number INTEGER;INSERT INTO idiom_sections(list_id,section_key,subtitle,chapter_key,chapter_subtitle,chapter_order,sort_order) VALUES ('crossover-v3','s','Section','ch','Chapter',0,0)");
 for(const [i,e] of fixture.entries()){
  sql.prepare("INSERT INTO idioms(id,list_id,phrase,section_key,sort_order,aliases,notes) VALUES (?,'crossover-v3',?,'s',?,?,'notes')").run(e.id,e.phrase,i,JSON.stringify(e.aliases));
  sql.prepare("INSERT INTO idiom_senses VALUES (?,?,?,0)").run(e.id+':sense',e.id,'meaning');
  sql.prepare("INSERT INTO idiom_word_refs VALUES (?,'provide','phrase')").run(e.id+':sense');
 }
 return sql;
}
function d1(sql){return {prepare(query){let v=[];return {bind(...args){v=args;return this},async first(){return sql.prepare(query).get(...v)||null},async all(){return {results:sql.prepare(query).all(...v)}},async run(){return sql.prepare(query).run(...v)}}},async batch(stmts){sql.exec('BEGIN');try{for(const s of stmts)await s.run();sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}}};}
const sql=seed();const senses=sql.prepare('SELECT * FROM idiom_senses').all(),refs=sql.prepare('SELECT * FROM idiom_word_refs').all();
sql.exec(migration('0053_idiom_alternate_forms.sql'));
assert.equal(sql.prepare('SELECT count(*) n FROM idioms').get().n,fixture.length);
assert.equal(sql.prepare("SELECT count(*) n FROM idiom_migration_backup WHERE migration_key='0053_idiom_alternate_forms'").get().n,fixture.length);
assert.deepEqual(sql.prepare('SELECT * FROM idiom_senses').all(),senses);assert.deepEqual(sql.prepare('SELECT * FROM idiom_word_refs').all(),refs);
for(const e of fixture){const row=sql.prepare('SELECT * FROM idioms WHERE id=?').get(e.id);assert.equal(row.phrase,e.main);assert.deepEqual(JSON.parse(row.alternate_forms),e.alternateForms);assert.equal(row.notes,'notes');assert(JSON.parse(row.aliases).some(a=>a===e.phrase||a?.phrase===e.phrase));}
const db=d1(sql),result=await readIdioms(db,'crossover-v3');const index=await readIdiomIndex(db,'crossover-v3');const section=await readIdiomSection(db,'crossover-v3','s');
for(const e of fixture){for(const entries of [result.entries,index.entries,section.entries])assert.deepEqual(entries.find(x=>x.key===e.id).alternateForms,e.alternateForms);}
const numbered=result.entries.map((e,i)=>({...e,no:String(i+1)}));
const resolver=createIdiomReferenceResolver([{sections:[{items:numbered}]}]);const alphabet=buildAlphabeticalIndexEntries([],numbered);
for(const e of fixture){for(const form of [e.main,...e.alternateForms]){assert(alphabet.some(row=>row.spelling===form&&row.targetId===e.id));assert.equal(resolver('idiom:'+form).id,e.id);}}
const provide=numbered.find(e=>e.phrase==='provide A with B');
assert.match(renderIdiomEntry(provide,''),/<span class="idiom-alternate-form"> \/ provide B for A<\/span>/);
assert.doesNotMatch(renderIdiomEntry({...provide,alternateForms:['<script>x</script>']},''),/<script>/);
const get=phrase=>callIdiomRead('get_idiom',{list_id:'crossover-v3',phrase},db);
assert.equal((await get('provide B for A')).idiom.id,provide.key);
const lookup=await get('provide A with B');
await callIdiomWrite('update_idiom',{list_id:'crossover-v3',expected_revision:lookup.revision,idiom_id:provide.key,alternate_forms:['provide B for A','provide B to A']},db,{actor:'test'});
assert.equal((await get('provide B to A')).idiom.id,provide.key);
const payload={id:provide.key,phrase:provide.phrase,sectionKey:'s',meanings:provide.meanings.map(s=>({id:s.id,meaning:s.meaning,wordIds:['provide']}))};
await saveIdiom(db,'crossover-v3',payload);
assert.deepEqual((await get(provide.phrase)).idiom.alternate_forms,['provide B for A','provide B to A'],'older clients preserve forms');
await saveIdiom(db,'crossover-v3',{...payload,alternateForms:['provide B for A']});
assert.deepEqual((await get(provide.phrase)).idiom.alternate_forms,['provide B for A']);
await assert.rejects(saveIdiom(db,'crossover-v3',{...payload,alternateForms:['  ']}),/Invalid/);
await assert.rejects(saveIdiom(db,'crossover-v3',{...payload,alternateForms:['provide B for A','provide B for A']}),/Duplicate/);
const stale=seed();stale.prepare('UPDATE idioms SET phrase=? WHERE id=?').run('edited since audit',fixture[0].id);stale.exec(migration('0053_idiom_alternate_forms.sql'));assert.equal(stale.prepare('SELECT phrase FROM idioms WHERE id=?').get(fixture[0].id).phrase,'edited since audit');
console.log(`Alternate forms: ${fixture.length} migrations, ${fixture.reduce((n,e)=>n+e.alternateForms.length,0)} forms, preservation, index, links, render, MCP and editor saves passed`);

// The six fixed-SVOO expressions also have complete prepositional alternants.
const svoo=JSON.parse(readFileSync(new URL('./fixtures/idiom-svoo-forms.json',import.meta.url),'utf8'));
const alternants=['do good to A','do harm to A','do damage to A','do justice to A','do a favor for A','ask a favor of A'];
for(const [i,e] of svoo.entries()){
 sql.prepare("INSERT INTO idioms(id,list_id,phrase,section_key,sort_order,notes,alternate_forms) VALUES (?,'crossover-v3',?,'s',?,?,?)").run(e.id,e.phrase,1000+i,e.notes,JSON.stringify(e.alternate_forms));
 for(const sense of e.meanings)sql.prepare('INSERT INTO idiom_senses VALUES (?,?,?,?)').run(sense.id,e.id,sense.meaning,sense.sort_order);
}
const priorSenses=sql.prepare('SELECT * FROM idiom_senses').all();
sql.exec(migration('0054_svoo_alternate_forms.sql'));
sql.exec(migration('0054_svoo_alternate_forms.sql')); // Reapplication must not duplicate forms.
assert.deepEqual(sql.prepare('SELECT * FROM idiom_senses').all(),priorSenses);
for(const [i,e] of svoo.entries()){
 const row=(await get(e.phrase)).idiom;
 assert.deepEqual(row.alternate_forms,[alternants[i]]);
 assert.equal(row.notes,e.notes);
 assert.equal((await get(alternants[i])).idiom.id,e.id);
}
console.log('Six SVOO alternants: complete lookup, preserved notes/senses and idempotent registration passed');
