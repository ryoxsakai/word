import { indexKey, wordSection, idiomSection, scopeKey, searchWords } from './viewer-snapshot-build.js';
import { renderWordChapter, renderIdiomChapter } from '../../public/viewer/static-chapter.js';
export const chapterKey=(list,kind,chapter)=>scopeKey({list_id:list,kind:`${kind}-chapter`,section_key:String(chapter)});
const read=async(env,entry)=>entry?(await env.VIEWER_SNAPSHOTS.get(entry.key))?.json():null;
function chapterFor(index,kind,section) {
 if(kind==='viewer')return index?.sections.find(s=>String(s.key)===String(section))?.chapterKey;
 return index?.chapters.find(c=>c.sections.some(s=>String(s.key)===String(section)))?.key;
}
export async function markChapters(env,stage,job,old,result) {
 stage.chapters ||= {}; stage.pendingChapters ||= {};
 const {list_id:list,kind,section_key:section}=job;
 const mark=(type,key)=>{if(key!=null)stage.pendingChapters[chapterKey(list,type,key)]={list,kind:type,chapter:String(key)};};
 if(kind==='word-section'||kind==='idiom-section') {
  const type=kind==='word-section'?'viewer':'idioms';
  const index=await read(env,stage.files[indexKey(list,type==='viewer'?'viewer-index':'idiom-index')]);
  mark(type,chapterFor(index,type,section));
  // Existing HTML also identifies the old chapter when a section moves/deletes.
  for(const descriptor of Object.values(stage.chapters))if(descriptor.list===list&&descriptor.kind===type&&descriptor.sections.includes(section))mark(type,descriptor.chapter);
  return;
 }
 if(!['viewer-index','idiom-index'].includes(kind))return;
 const type=kind==='viewer-index'?'viewer':'idioms';
 const before=await read(env,old), after=result?.data;
 if(!after){for(const [key,c]of Object.entries(stage.chapters))if(c.list===list)delete stage.chapters[key];return;}
 const previousItems=new Map((before?.[type==='viewer'?'words':'entries']||[]).map(w=>[w.id||w.key,w]));
 const nextItems=new Map((after[type==='viewer'?'words':'entries']||[]).map(w=>[w.id||w.key,w]));
 const changedTerms=new Set();
 for(const id of new Set([...previousItems.keys(),...nextItems.keys()])) {
  const a=previousItems.get(id),b=nextItems.get(id);
  if(JSON.stringify(a)===JSON.stringify(b))continue;
  for(const [item,index]of [[a,before],[b,after]])if(item){mark(type,chapterFor(index,type,item.sectionKey));for(const t of [item.spelling,item.phrase,...(item.aliases||[])])if(typeof t==='string'&&t)changedTerms.add(t.toLowerCase());}
 }
 const oldChapters=new Map((before?.chapters||[]).map(c=>[String(c.key),c]));
 for(const c of after.chapters)if(JSON.stringify(oldChapters.get(String(c.key)))!==JSON.stringify(c))mark(type,c.key);
 if(type==='viewer') {
  const oldSections=new Map((before?.sections||[]).map(s=>[s.key,s]));
  for(const s of after.sections)if(JSON.stringify(oldSections.get(s.key))!==JSON.stringify(s))mark(type,s.chapterKey);
  if(JSON.stringify(before?.groups)!==JSON.stringify(after.groups))for(const g of after.groups)mark(type,g.chapterKey);
 }
 for(const c of Object.values(stage.chapters))if(c.list===list&&c.dependencies.some(t=>changedTerms.has(t)))mark(c.kind,c.chapter);
 // Newly added headwords/phrases may become automatic links in existing notes.
 if(changedTerms.size)for(const chapter of Object.values(stage.chapters)) {
  if(chapter.list!==list||chapter.kind!=='viewer'||!chapter.search)continue;
  const words=await read(env,chapter.search);
  if(words?.some(w=>[...changedTerms].some(term=>w.text.includes(term))))mark('viewer',chapter.chapter);
 }

}
export async function buildChapter(env,stage,job) {
 const index=await read(env,stage.files[indexKey(job.list,'viewer-index')]);
 const idioms=await read(env,stage.files[indexKey(job.list,'idiom-index')]);
 if(!index)return null;
 const sections=job.kind==='viewer'?index.sections.filter(s=>String(s.chapterKey)===job.chapter).map(s=>s.key):idioms?.chapters.find(c=>String(c.key)===job.chapter)?.sections.map(s=>s.key)||[];
 if(!sections.length)return null;
 const progress=job.progress ||= {next:0,parts:[],dependencies:[]};
 // Bound CPU per alarm, including expensive note/cross-reference rendering.
 const selected=sections.slice(progress.next,progress.next+2);
 const loaded=await Promise.all(selected.map(key=>read(env,stage.files[job.kind==='viewer'?wordSection(job.list,key):idiomSection(job.list,key)])));
 const shards=Object.fromEntries(selected.map((key,i)=>[key,loaded[i]||{words:[],entries:[]} ]));
 const rendered=job.kind==='viewer'?renderWordChapter(index,idioms,job.chapter,shards,new Set(selected)):renderIdiomChapter(index,idioms,job.chapter,shards,new Set(selected));
 const partKey=`fragments/${crypto.randomUUID()}.html`;
 await env.VIEWER_SNAPSHOTS.put(partKey,rendered.html,{httpMetadata:{contentType:'text/html; charset=utf-8'}});
 progress.parts.push(partKey);progress.next+=selected.length;
 progress.dependencies=[...new Set([...progress.dependencies,...rendered.dependencies])];
 if(progress.next<sections.length)return {pending:true};
 const html=(await Promise.all(progress.parts.map(async key=>(await env.VIEWER_SNAPSHOTS.get(key)).text()))).join('');
 let search=null;
 if(job.kind==='viewer') {
  const bodies=await Promise.all(sections.map(key=>read(env,stage.files[wordSection(job.list,key)])));
  search=searchWords(bodies.flatMap(s=>s?.words||[]));
 }
 return {html,dependencies:progress.dependencies,list:job.list,kind:job.kind,chapter:job.chapter,sections,search};

}
export async function buildHomePage(env,stage) {
 const list='crossover-v3',index=await read(env,stage.files[indexKey(list,'viewer-index')]);
 if(!index)return null;
 const idioms=await read(env,stage.files[indexKey(list,'idiom-index')]);
 const first=stage.chapters[chapterKey(list,'viewer',index.chapters[0]?.key)];
 if(!first)return null;
 const object=await env.VIEWER_SNAPSHOTS.get(first.key),html=await object.text();
 const chapters=Object.fromEntries(Object.entries(stage.chapters).filter(([,c])=>c.list===list).map(([key,c])=>[key,{hash:c.hash,kind:c.kind,chapter:c.chapter,sections:c.sections}]));
 const bootstrap={index,idioms,chapters,firstChapter:index.chapters[0].key};
 const template=await env.ASSETS.fetch(new Request('https://assets/'));
 if(!template.ok)throw new Error('Viewer HTML template unavailable');
 return (await template.text()).replace(/<link rel="preload" as="fetch"[^>]+>/,'')
  .replace(/(src|href)="\.\/(viewer|shared)\/([^"]+)"/g,'$1="/mcp-viewer-assets/$2/$3"')
  .replace(/(<main[^>]+id="wordList"[^>]*>)[\s\S]*?(<\/main>)/,(all,start,end)=>start+html+end)
  .replace('</head>',`<script id="static-viewer-bootstrap" type="application/json">${JSON.stringify(bootstrap).replace(/</g,'\\u003c')}</script></head>`);
}
