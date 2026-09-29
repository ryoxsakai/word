import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../public/viewer/static-client.js',import.meta.url),'utf8').replaceAll('export ','');
const bootstrap=hash=>({index:{list:{id:'book'}},firstChapter:'1',chapters:{one:{kind:'viewer',chapter:'1',sections:['a'],hash},two:{kind:'viewer',chapter:'2',sections:['b'],hash}}});
let current=bootstrap('old'),calls=[],held,release;
const cached=new Map();
const sandbox={document:{getElementById:id=>id==='static-viewer-bootstrap'?{textContent:JSON.stringify(current)}:{innerHTML:'FIRST READY'}},location:{origin:'https://vocab.lrnr.jp',hostname:'vocab.lrnr.jp'},localStorage:{getItem:()=>null},Request,Response,URL,Map,JSON,
 caches:{open:async()=>({match:async key=>cached.get(key.url)?.clone(),put:async(key,response)=>cached.set(key.url,response)}),delete:async()=>cached.clear()},
 fetch:async url=>{calls.push(url);if(url.endsWith('bootstrap'))return Response.json(current);if(held){const wait=held;held=null;await wait;}return new Response('CHAPTER READY',{headers:{'x-chapter-hash':current.chapters.two.hash}});}};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const run=code=>vm.runInContext(code,sandbox);
assert.equal(await run("staticChapterHtml('book','viewer','a')"),'FIRST READY');assert.equal(calls.length,0,'embedded first chapter requires no request');
assert.equal(await run("staticChapterHtml('book','viewer','b')"),'CHAPTER READY');
assert.equal(cached.size,1);
await run("staticBootstrap('book',{force:true})");calls=[];
assert.equal(await run("staticChapterHtml('book','viewer','b')"),'CHAPTER READY');assert.equal(calls.length,0,'unchanged chapter comes from device cache');
current=bootstrap('new');await run("staticBootstrap('book',{force:true})");calls=[];
await run("staticChapterHtml('book','viewer','b')");assert.equal(calls.length,1,'updated chapter bypasses old hash cache');
await run('clearStaticChapterCache()');held=new Promise(r=>release=r);
const old=run("staticChapterHtml('book','viewer','b')");
await new Promise(r=>setTimeout(r,0));
current=bootstrap('newer');await run("staticBootstrap('book',{force:true})");release();await old;calls=[];
await run("staticChapterHtml('book','viewer','b')");assert.equal(calls.length,1,'in-flight old response cannot repopulate refreshed memory');
console.log('Static chapters: embedded content, device cache, revision changes and refresh races passed');

// Reducing the regex dictionary must preserve visible cross-reference markup.
const {chapterContext}=await import('../../public/viewer/static-chapter.js');
const index={words:[{id:'a',spelling:'alpha',branch:0,seqNo:'1',phrases:['alpha beta']},{id:'b',spelling:'beta',branch:0,seqNo:'2',derivatives:[{word:'betas'}]},...Array.from({length:300},(_,n)=>({id:`unused-${n}`,spelling:`unused${n}`,branch:0,seqNo:String(n+3)}))]};
for(const note of ['betaも参照。','alpha beta is related to betas.','##beta## and ##beta|別表記##','**beta** and /beta/','unrelated text']) {
 const full=chapterContext(index,null),scoped=chapterContext(index,null,{spelling:'alpha',notes:note});
 assert.equal(scoped.renderNotesMarkup(note,{currentHeadword:'alpha'}),full.renderNotesMarkup(note,{currentHeadword:'alpha'}));
}
console.log('Scoped cross-reference dictionary preserves complete-renderer output');

const idiomIndex={entries:[{key:'carry',phrase:'carry O out',sectionKey:'carry-section',meanings:[{meaning:'実行する',refs:[]}]}],chapters:[{key:'verbs',sections:[{key:'carry-section'}]}]};
const spacedNote='carry   out Aも参照。';
const scopedObject=chapterContext(index,idiomIndex,{notes:spacedNote});
assert.match(scopedObject.renderNotesMarkup(spacedNote),/<strong>carry O out<\/strong>/);
assert.match(scopedObject.renderNotesMarkup(spacedNote),/data-idiom-id="carry"/);

// An idiom rename must rebuild chapters that mention its inferred spellings.
const {idiomReferenceNames}=await import('../../public/shared/idiom-forms.js');
const publicationSource=readFileSync(new URL('../../worker/src/viewer-snapshot-chapters.js',import.meta.url),'utf8').split('export async function buildChapter')[0].replace(/^import .*;$/gm,'').replaceAll('export ','');
const scopeKey=({list_id,kind,section_key=''})=>JSON.stringify([list_id,kind,section_key]);
const publication=vm.createContext({idiomReferenceNames,scopeKey});
vm.runInContext(publicationSource+'\nthis.markChapters=markChapters;this.chapterKey=chapterKey;',publication);
const {markChapters,chapterKey}=publication;
const oldIdioms={...idiomIndex,entries:idiomIndex.entries.map(e=>({...e,sectionKey:'carry-section'}))};
const newIdioms={...oldIdioms,entries:oldIdioms.entries.map(e=>({...e,phrase:'carry O off'}))};
const chapterId=chapterKey('book','viewer','1');
const stage={chapters:{[chapterId]:{list:'book',kind:'viewer',chapter:'1',sections:['a'],dependencies:['idiom:carry out a'],search:{key:'search'}}}};
const objects=new Map([['old',oldIdioms],['search',[{text:'carry   out A'.toLowerCase()}]]]);
await markChapters({VIEWER_SNAPSHOTS:{get:async key=>({json:async()=>objects.get(key)})}},stage,{list_id:'book',kind:'idiom-index'},{key:'old'},{data:newIdioms});
assert.ok(stage.pendingChapters[chapterId], 'inferred references must be rebuilt after a heading changes');
console.log('Static chapters: inferred idiom links and targeted reference invalidation passed');
