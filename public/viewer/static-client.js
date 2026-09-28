const prefix=(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?'/mcp-viewer':'https://vocab.lrnr.jp/mcp-viewer')+'/api/lists/';
let boot,epoch=0;
try {boot=JSON.parse(document.getElementById('static-viewer-bootstrap')?.textContent||'null');} catch {}
const embedded=document.getElementById('wordList')?.innerHTML||'';
const memory=new Map(),pending=new Map();
if(boot?.firstChapter!=null)memory.set(`viewer:${boot.firstChapter}`,embedded);
export const hasEmbeddedChapter=()=>boot?.firstChapter!=null;
export async function staticBootstrap(list,{force=false}={}) {
 if(boot&&!force&&boot.index?.list?.id===list)return boot;
 const version=++epoch;pending.clear();
 const response=await fetch(`${prefix}${encodeURIComponent(list)}/viewer/bootstrap`,{cache:force?'reload':'default'});
 if(!response.ok)return null;
 const next=await response.json();if(version!==epoch)return null;
 boot=next;memory.clear();return boot;
}
export function staticChapterDescriptor(kind,section) {
 return Object.values(boot?.chapters||{}).find(c=>c.kind===kind&&c.sections.map(String).includes(String(section)));
}
export async function staticChapterHtml(list,kind,section,{force=false}={}) {
 const chapter=staticChapterDescriptor(kind,section);
 if(!chapter)return null;
 const key=`${kind}:${chapter.chapter}`,version=epoch;
 if(!force&&memory.has(key))return memory.get(key);
 if(pending.has(key))return pending.get(key);
 const task=(async()=>{
  let cache;
  const url=`${prefix}${encodeURIComponent(list)}/${kind}/chapters/${encodeURIComponent(chapter.chapter)}`;
  const cacheKey=new Request(new URL(`${url}?v=${chapter.hash}`,location.origin));
  try {if(localStorage.getItem('vocab-viewer-cache-enabled')!=='0')cache=await caches.open('vocab-static-chapters-v1');}catch{}
  if(!force&&cache){const saved=await cache.match(cacheKey);if(saved){const html=await saved.text();if(version===epoch)memory.set(key,html);return html;}}
  const response=await fetch(url,{cache:force?'reload':'default'});
  if(!response.ok)throw new Error(`Chapter ${response.status}`);
  const html=await response.text();if(version===epoch)memory.set(key,html);
  if(version===epoch&&cache&&response.headers.get('x-chapter-hash')===chapter.hash)await cache.put(cacheKey,new Response(html,{headers:{'content-type':'text/html'}})).catch(()=>{});
  return html;
 })();pending.set(key,task);try{return await task;}finally{if(pending.get(key)===task)pending.delete(key);}
}
export function applyStaticWordChapter(root,html,onLoaded) {
 const template=document.createElement('template');template.innerHTML=html;
 for(const entry of template.content.querySelectorAll('[data-section-entries]')) {
  const key=entry.dataset.sectionEntries,target=root.querySelector(`[data-section-entries="${CSS.escape(key)}"]`);
  if(target){target.replaceWith(entry);entry.closest('.section-group')?.classList.add('is-loaded');onLoaded(key);}
 }
}
export async function clearStaticChapterCache(){epoch++;pending.clear();memory.clear();try{await caches.delete('vocab-static-chapters-v1');}catch{}}
