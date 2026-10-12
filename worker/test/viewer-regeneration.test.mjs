import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {requestRegeneration,queueRegeneration} from '../src/viewer-regeneration.js';
const values=new Map();let alarm=null;
const ctx={storage:{get:async key=>values.get(key),put:async(key,value)=>values.set(key,structuredClone(value)),delete:async key=>values.delete(key),setAlarm:async value=>{alarm=value;}}};
let inserts=0,breakQueue=true;
const env={DB:{prepare(sql){return {bind(){return this;},first:async()=>({id:'book',name:'Book'}),run:async()=>{inserts++;if(breakQueue)throw new Error('interrupted enqueue');}};}}};
const body={listId:'book',requestId:crypto.randomUUID()};
assert.equal((await requestRegeneration(ctx,env,body)).status,503);
const first=values.get('regeneration');assert.equal(first.phase,'enqueue');assert.ok(alarm);
breakQueue=false;
await requestRegeneration(ctx,env,body);
assert.equal(values.get('regeneration').id,first.id);assert.equal(values.get('regeneration').state,'running');
assert.equal(inserts,2,'failed enqueue resumes same job');
await requestRegeneration(ctx,env,{...body,requestId:crypto.randomUUID()});assert.equal(inserts,2,'active duplicates never queue again');
assert.equal((await requestRegeneration(ctx,env,{listId:'other',requestId:crypto.randomUUID()})).status,409);
values.set('regeneration',{...values.get('regeneration'),state:'completed'});
await requestRegeneration(ctx,env,body);assert.equal(inserts,2,'completed response replay is idempotent');
// Real SQLite executes the same bounded metadata INSERT SELECT for 2,000 Sections.
const bundle=await build({stdin:{contents:`import {queueRegeneration} from './src/viewer-regeneration.js';import {ViewerSnapshotPublisher} from './src/viewer-snapshots.js';export default {async fetch(req,env){if(new URL(req.url).pathname==='/recovery'){let alarm=null;const ctx={storage:{get:async()=>({state:'queued',phase:'enqueue'}),getAlarm:async()=>alarm,setAlarm:async value=>alarm=value}};const publisher=new ViewerSnapshotPublisher(ctx,{});return publisher.fetch(new Request('https://publisher/regeneration-status'));}let writes=0;await queueRegeneration({storage:{put:async()=>{writes++;}}},env,{id:'job',listId:'large'});return Response.json({writes});}}`,resolveDir:new URL('../',import.meta.url).pathname},bundle:true,format:'esm',platform:'browser',write:false});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2024-11-01',d1Databases:['DB']});
try{
 const recovered=await(await mf.dispatchFetch('https://test/recovery')).json();assert.ok(recovered.scheduledAt>Date.now(),'status read wakes an interrupted start with no alarm');
 const db=await mf.getD1Database('DB');
 await db.exec("CREATE TABLE sections(id INTEGER PRIMARY KEY,list_id TEXT); CREATE TABLE idiom_sections(list_id TEXT,section_key TEXT); CREATE TABLE viewer_snapshot_dirty(list_id TEXT,kind TEXT,section_key TEXT,revision TEXT,PRIMARY KEY(list_id,kind,section_key)); CREATE TABLE words(id TEXT,spelling TEXT); INSERT INTO words VALUES('sentinel','unchanged'); WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<2000) INSERT INTO sections SELECT x,'large' FROM n; INSERT INTO idiom_sections VALUES('large','idiom');");
 assert.equal((await mf.dispatchFetch('https://test')).status,200);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM viewer_snapshot_dirty').first()).n,2004);
 await mf.dispatchFetch('https://test');
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM viewer_snapshot_dirty').first()).n,2004,'queue upsert is bounded and duplicate free');
 assert.equal((await db.prepare('SELECT spelling FROM words').first()).spelling,'unchanged');
 console.log('Regeneration: interrupted enqueue, retries, duplicate starts, constant-size SQL and 2000-section scope queue passed');
}finally{await mf.dispose();}
