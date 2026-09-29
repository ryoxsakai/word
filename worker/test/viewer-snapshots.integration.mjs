import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const bundle = await build({stdin:{contents:`
import app from './src/coverage-entry.js';
import { renderWordChapter } from '../public/viewer/static-chapter.js';
import { buildHomePage, buildChapter, chapterKey } from './src/viewer-snapshot-chapters.js';
import { serveViewerSnapshot } from './src/viewer-snapshots.js';
import { ViewerSnapshotPublisher as Publisher } from './src/viewer-snapshots.js';
export class ViewerSnapshotPublisher extends Publisher {
 constructor(ctx,env){super(ctx,{...env,VIEWER_SNAPSHOTS:new Proxy(env.VIEWER_SNAPSHOTS,{get(target,key){
  if(key==='put')return async(...args)=>{if((await env.CHECK_FAULT.fetch('https://fault')).status===503)throw new Error('injected storage failure');return target.put(...args);};
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }})});}
}
export default { async fetch(request,env,ctx) {
 const url=new URL(request.url);
 if(url.pathname==='/__chunk_test') {
  const current=await(await env.VIEWER_SNAPSHOTS.get('current.json')).json();
  const key=(kind,section='')=>JSON.stringify(['snapshot-test',kind,section]);
  const index=await(await env.VIEWER_SNAPSHOTS.get(current.files[key('viewer-index')].key)).json();
  index.sections[1].chapterKey=index.chapters[0].key;
  index.sections.push({...index.sections[1],key:'99903',id:99903,name:'third'});
  await env.VIEWER_SNAPSHOTS.put('chunk-index.json',JSON.stringify(index));
  current.files[key('viewer-index')]={key:'chunk-index.json'};
  const job={list:'snapshot-test',kind:'viewer',chapter:String(index.chapters[0].key)};
  const first=await buildChapter(env,current,job);
  const second=await buildChapter(env,current,job);
  const shards={};for(const section of ['99901','99902'])shards[section]=await(await env.VIEWER_SNAPSHOTS.get(current.files[key('word-section',section)].key)).json();
  const idioms=await(await env.VIEWER_SNAPSHOTS.get(current.files[key('idiom-index')].key)).json();
  const expected=renderWordChapter(index,idioms,job.chapter,shards).html;
  return Response.json({resumed:first.pending===true,identical:second.html===expected});
 }
 if(url.pathname==='/__home_test') {
   const stage=await(await env.VIEWER_SNAPSHOTS.get('current.json')).json();
   const indexKey=list=>JSON.stringify([list,'viewer-index','']);
   stage.files[indexKey('crossover-v3')]=stage.files[indexKey('snapshot-test')];
   stage.chapters[chapterKey('crossover-v3','viewer','99901')]=stage.chapters[chapterKey('snapshot-test','viewer','99901')];
   return new Response(await buildHomePage(env,stage));
 }
 if(url.pathname==='/__editor_no_db') return app.fetch(new Request('https://test/mcp-editor/api'+url.searchParams.get('path'),{headers:request.headers}),{...env,DB:{prepare(){throw new Error('D1 must not be read by editor');}}},ctx);
 if(url.pathname==='/__no_db') return serveViewerSnapshot(new Request('https://test'+url.searchParams.get('path'),{headers:request.headers}),{...env,DB:{prepare(){throw new Error('D1 must not be read by viewer');}}});
 return app.fetch(request,env,ctx);
}};`,resolveDir:new URL('../',import.meta.url).pathname},bundle:true,format:'esm',platform:'browser',write:false});
let failWrites=false;
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2024-11-01',d1Databases:['DB'],r2Buckets:['VIEWER_SNAPSHOTS','AUDIO_BUCKET','ILLUSTRATION_BUCKET'],durableObjects:{VIEWER_PUBLISHER:{className:'ViewerSnapshotPublisher',useSQLite:true}},serviceBindings:{CHECK_FAULT:()=>new Response(null,{status:failWrites?503:200}),ASSETS:()=>new Response(readFileSync(new URL('../../public/index.html',import.meta.url),'utf8'))},bindings:{VOCAB_MCP_SESSION_SECRET:'editor-test-secret',VIEWER_STATIC_ENABLED:'true',VIEWER_PUBLISH_TOKEN:'test-publish-token',AUDIO_AUTO_ENABLED:'false'}});
const api=(path,options={})=>mf.dispatchFetch('https://test'+path,options);
const admin=(method='GET')=>api('/mcp-viewer-publish',{method,headers:{Authorization:'Bearer test-publish-token'}});
const staticGet=(path,headers={})=>api('/__no_db?path='+encodeURIComponent('/mcp-viewer/api'+path),{headers});
const tokenParts = [
 { alg: 'HS256', typ: 'at+jwt' },
 { iss: 'https://test', aud: 'vocab-mcp', client_id: 'editor-test', scope: 'vocab:read vocab:write', exp: Math.floor(Date.now()/1000)+3600 },
].map(value => Buffer.from(JSON.stringify(value)).toString('base64url'));
const editorToken = tokenParts.join('.')+'.'+createHmac('sha256','editor-test-secret').update(tokenParts.join('.')).digest('base64url');
const editorGet = (path, headers = {}) => api('/__editor_no_db?path='+encodeURIComponent(path), { headers: { Authorization: 'Bearer '+editorToken, ...headers } });
const scope=(list,kind,section='')=>JSON.stringify([list,kind,section]);
async function waitPublished(previous,allowFailure=false) {
 for(let n=0;n<160;n++) {
  const status=await(await admin()).json();
  if(status.state==='ready'&&status.revision!==previous)return status;
  if(status.state==='failed'&&!allowFailure)throw new Error(JSON.stringify(status));
  await new Promise(r=>setTimeout(r,100));
 }
 throw new Error('Publication timed out');
}
function migrationSql(sql){const triggers=[];return sql.replace(/^\s*--.*$/gm,'').replace(/CREATE\s+TRIGGER[\s\S]*?END\s*;/gi,t=>{triggers.push(t.replace(/;\s*$/,'').replace(/\s+/g,' '));return `__TRIGGER_${triggers.length-1}__;`;}).split(';').map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).map(s=>s.replace(/__TRIGGER_(\d+)__/g,(_,i)=>triggers[i])+';').join('\n');}
try {
 const db=await mf.getD1Database('DB'), bucket=await mf.getR2Bucket('VIEWER_SNAPSHOTS');
 for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())await db.exec(migrationSql(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8')));
 await db.exec("INSERT INTO lists(id,name) VALUES('snapshot-test','Test'); INSERT INTO chapters(id,list_id,subtitle,sort_order) VALUES(99901,'snapshot-test','first',1),(99902,'snapshot-test','second',2); INSERT INTO sections(id,list_id,name,sort_order,chapter_id) VALUES(99901,'snapshot-test','one',1,99901),(99902,'snapshot-test','two',2,99902); INSERT INTO words(id,spelling,notes) VALUES('snap-a','alpha','original note'),('snap-b','beta','second note'); INSERT INTO list_items(list_id,word_id,no,section_id) VALUES('snapshot-test','snap-a',1,99901),('snapshot-test','snap-b',2,99902); INSERT INTO senses(word_id,pos,meaning) VALUES('snap-a','名','甲'); INSERT INTO idiom_sections(list_id,section_key,subtitle,chapter_key,chapter_subtitle,chapter_order,sort_order) VALUES('snapshot-test','one','One','c','C',1,1); INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) VALUES('snap-i','snapshot-test','alpha beta','one',1); INSERT INTO idiom_senses(id,idiom_id,meaning) VALUES('snap-s','snap-i','meaning'); INSERT INTO idiom_word_refs(sense_id,word_id) VALUES('snap-s','snap-a');");
 await db.exec("INSERT INTO chapters(id,list_id,subtitle,sort_order) VALUES(99903,'snapshot-test','Empty chapter',3); INSERT INTO sections(id,list_id,name,sort_order,chapter_id) VALUES(99903,'snapshot-test','Empty section',3,99903); INSERT INTO section_labels(id,list_id,section_id,name,sort_order) VALUES(99901,'snapshot-test',99901,'Unused label',1); INSERT INTO examples(word_id,sentence,type,sort_order) VALUES('snap-a','alpha phrase','phrase',1); INSERT INTO derivatives(word_id,word,sort_order) VALUES('snap-a','alphabet',1);");
 await db.prepare("DELETE FROM viewer_snapshot_dirty WHERE list_id NOT IN ('snapshot-test','')").run();
 assert.equal((await editorGet('/lists')).status,503);
 assert.equal((await api('/mcp-editor/api/lists')).status,401);
 assert.equal((await staticGet('/lists')).status,503,'uninitialized snapshot never falls back to D1');
 assert.equal((await api('/mcp-viewer-publish',{method:'POST'})).status,401);
 await admin('POST'); let status=await waitPublished();
 let manifest=await(await bucket.get('current.json')).json();
 const sectionA=scope('snapshot-test','word-section','99901'), sectionB=scope('snapshot-test','word-section','99902');
 const originalA=manifest.files[sectionA].key, originalB=manifest.files[sectionB].key;
 // The complete notebook startup path is authenticated and does not touch D1.
 for (const tail of ['editor/index','editor/references','sections','chapters','labels','editor/sections/99901','editor/sections/99902','editor/sections/99903','editor/sections/none']) {
   const response = await editorGet('/lists/snapshot-test/'+tail);
   assert.equal(response.status,200,tail+': '+await response.clone().text());
   assert.equal(response.headers.get('x-editor-source'),'r2');
   assert.match(response.headers.get('cache-control'),/private/);
   const expected = await (await api('/api/lists/snapshot-test/'+tail)).json();
   assert.deepEqual(await response.json(), expected, 'snapshot preserves editor data: '+tail);
 }
 const brokenKey = manifest.files[sectionB].key;
 const backupBody = await(await bucket.get(brokenKey)).text();
 await bucket.delete(brokenKey);
 assert.equal((await editorGet('/lists/snapshot-test/editor/sections/99902')).status,503,'missing R2 object cannot fall back to D1');
 await bucket.put(brokenKey,backupBody);
 // Upgrade an existing deployment without rebuilding every word section.
 const oldIndexKey = manifest.files[scope('snapshot-test','viewer-index')].key;
 const oldIndex = await(await bucket.get(oldIndexKey)).json();
 delete oldIndex.editorStructure;
 await bucket.put('legacy-editor-index.json',JSON.stringify(oldIndex));
 manifest.files[scope('snapshot-test','viewer-index')]={key:'legacy-editor-index.json'};
 await bucket.put('current.json',JSON.stringify(manifest));
 await db.prepare("INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision) VALUES('snapshot-test','viewer-index','','editor-upgrade')").run();
 assert.equal((await editorGet('/lists/snapshot-test/editor/index')).status,503,'old snapshot wakes the queued structure upgrade');
 status=await waitPublished(status.revision);
 manifest=await(await bucket.get('current.json')).json();
 assert.equal(manifest.files[sectionA].key,originalA,'structure upgrade reuses existing section JSON');
 const editorIndex = await editorGet('/lists/snapshot-test/editor/index');
 assert.equal((await editorGet('/lists/snapshot-test/editor/index',{'if-none-match':editorIndex.headers.get('etag')})).status,304);
 assert.deepEqual(await(await editorGet('/lists')).json(),await(await api('/api/lists')).json());
 const editorIdioms = await(await editorGet('/lists/snapshot-test/editor/idioms')).json();
 assert.equal(editorIdioms.entries[0].meanings[0].refs[0].wordId,'snap-a');
 assert.equal((await editorGet('/lists/snapshot-test/editor/sections/99999')).status,404);

 const chapterB=manifest.chapters[scope('snapshot-test','viewer-chapter','99902')].key;
 const searchB=manifest.chapters[scope('snapshot-test','viewer-chapter','99902')].search.key;
 const html=await staticGet('/lists/snapshot-test/viewer/chapters/99901');
 assert.equal(html.headers.get('x-viewer-source'),'r2-html');
 assert.match(await html.text(),/word-snap-a/);
 assert.deepEqual(await(await api('/__chunk_test')).json(),{resumed:true,identical:true},'resumed HTML generation matches a complete chapter without duplicate headings');
 const home=await(await api('/__home_test')).text();
 assert.match(home,/<main[^>]+id="wordList"[^>]*>[\s\S]*word-snap-a/,'first chapter is complete before JavaScript');
 assert.match(home,/id="static-viewer-bootstrap"/);
 assert.match(home,/src="\/mcp-viewer-assets\/viewer\/app.js/);
 assert.doesNotMatch(home,/<link rel="preload" as="fetch"/);
 const idiomHtml=await staticGet('/lists/snapshot-test/idioms/chapters/c');
 assert.match(await idiomHtml.text(),/alpha/);
 const index=await staticGet('/lists/snapshot-test/viewer/index?initial=1');
 assert.equal(index.headers.get('x-viewer-source'),'r2');
 assert.equal((await index.json()).initialSection.words[0].spelling,'alpha');
 const first=await staticGet('/lists/snapshot-test/viewer/sections/99901');
 assert.equal((await first.clone().json()).words[0].senses[0].meaning,'甲');
 assert.equal((await staticGet('/lists/snapshot-test/viewer/sections/99901',{'if-none-match':first.headers.get('etag')})).status,304);
 assert.equal((await(await staticGet('/lists/snapshot-test/viewer/search?q=original')).json()).matches[0].wordId,'snap-a');
 assert.equal((await(await staticGet('/lists/snapshot-test/idioms/index?initial=1')).json()).initialSection.entries[0].phrase,'alpha beta');
 assert.equal((await(await staticGet('/lists/snapshot-test/words/full')).json()).words.length,2);
 assert.equal((await staticGet('/lists/snapshot-test/viewer/sections/99999')).status,404);
 // A real REST write wakes publishing. Unaffected sections retain exact object keys.
 const saved=await api('/api/words/snap-a',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({spelling:'alpha',notes:'changed note',senses:[{pos:'名',meaning:'甲',is_primary:1,sort_order:0}]})});
 assert.equal(saved.status,200,await saved.clone().text());
 assert.equal((await editorGet('/lists/snapshot-test/editor/index?editorFresh=1')).status,503,'read-after-write waits for publication without D1');
 status=await waitPublished(status.revision);
 manifest=await(await bucket.get('current.json')).json();
 assert.equal((await editorGet('/lists/snapshot-test/editor/index?editorFresh=1')).status,200);
 assert.notEqual(manifest.files[sectionA].key,originalA);
 assert.equal(manifest.files[sectionB].key,originalB);
 assert.equal(manifest.chapters[scope('snapshot-test','viewer-chapter','99902')].key,chapterB,'unchanged chapter HTML is reused');
 assert.equal(manifest.chapters[scope('snapshot-test','viewer-chapter','99902')].search.key,searchB,'unchanged chapter search data is reused');
 assert.equal((await(await staticGet('/lists/snapshot-test/viewer/search?q=changed')).json()).matches[0].wordId,'snap-a');
 assert.deepEqual((await(await staticGet('/lists/snapshot-test/viewer/search?q=original')).json()).matches,[]);
 // Failed publication preserves the previous complete revision, then retries.
 failWrites=true;
 await db.prepare("UPDATE words SET notes='retry note' WHERE id='snap-a'").run();
 const oldJob=await db.prepare("SELECT * FROM viewer_snapshot_dirty WHERE list_id='snapshot-test' AND kind='word-section' AND section_key='99901'").first();
 await db.prepare("UPDATE words SET notes='latest retry note' WHERE id='snap-a'").run();
 await db.prepare('DELETE FROM viewer_snapshot_dirty WHERE list_id=? AND kind=? AND section_key=? AND revision=?').bind(oldJob.list_id,oldJob.kind,oldJob.section_key,oldJob.revision).run();
 assert.ok(await db.prepare("SELECT 1 FROM viewer_snapshot_dirty WHERE list_id='snapshot-test' AND kind='word-section' AND section_key='99901'").first(),'acknowledging an older revision cannot lose a newer edit');
 await admin('POST');
 for(let n=0;n<80;n++){if((await(await admin()).json()).state==='failed')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal((await(await admin()).json()).state,'failed');
 assert.equal((await(await bucket.get('current.json')).json()).revision,status.revision);
 assert.equal((await(await staticGet('/lists/snapshot-test/viewer/sections/99901')).json()).words[0].notes,'changed note');
 failWrites=false;status=await waitPublished(status.revision,true);
 assert.equal((await(await staticGet('/lists/snapshot-test/viewer/sections/99901')).json()).words[0].notes,'latest retry note');
 // Direct SQL records both sides of a move; explicit wake publishes those records.
 await db.prepare("UPDATE list_items SET section_id=99902 WHERE list_id='snapshot-test' AND word_id='snap-a'").run();
 const jobs=(await db.prepare("SELECT * FROM viewer_snapshot_dirty WHERE list_id='snapshot-test'").all()).results;
 assert.ok(jobs.some(j=>j.kind==='word-section'&&j.section_key==='99901'));
 assert.ok(jobs.some(j=>j.kind==='word-section'&&j.section_key==='99902'));
 await admin('POST');status=await waitPublished(status.revision);
 assert.equal((await(await staticGet('/lists/snapshot-test/viewer/sections/99901')).json()).words.length,0);
 assert.equal((await(await staticGet('/lists/snapshot-test/viewer/sections/99902')).json()).words.length,2);
 // Deletion cannot leave an accessible old snapshot.
 await db.exec("DELETE FROM list_items WHERE list_id='snapshot-test'; DELETE FROM idiom_sections WHERE list_id='snapshot-test'; DELETE FROM section_labels WHERE list_id='snapshot-test'; DELETE FROM sections WHERE list_id='snapshot-test'; DELETE FROM chapters WHERE list_id='snapshot-test'; DELETE FROM lists WHERE id='snapshot-test';");
 await admin('POST'); await waitPublished(status.revision);
 assert.equal((await editorGet('/lists/snapshot-test/editor/index')).status,404);
 assert.equal((await staticGet('/lists/snapshot-test/viewer/index')).status,404);
 assert.equal((await staticGet('/lists/snapshot-test/viewer/sections/99902')).status,404);
 console.log('Snapshot tests passed: no D1 reads on serving, scoped rebuild, ETag, search, moves, deletions, authenticated publishing');
} finally {await mf.dispose();}
