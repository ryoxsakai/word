import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const bundle=(await build({entryPoints:[new URL('../../public/setting/viewer-regeneration.js',import.meta.url).pathname],bundle:true,format:'iife',globalName:'regenerationModule',write:false})).outputFiles[0].text;
const dom=new JSDOM(readFileSync(new URL('../../public/setting/index.html',import.meta.url),'utf8'),{url:'https://vocab.lrnr.jp/setting/',runScripts:'outside-only'});
const w=dom.window;w.eval(bundle);const d=w.document;
let job=null,posts=0,release;const requestIds=[];
const fetcher=async(url,init)=>{
 if(url.endsWith('/lists'))return Response.json([{id:'crossover-v3',name:'Crossover',isNotebook:true}]);
 if(init.method==='POST'){posts++;requestIds.push(JSON.parse(init.body).requestId);await new Promise(resolve=>release=resolve);job={id:'job',requestId:JSON.parse(init.body).requestId,listId:'crossover-v3',listName:'Crossover',state:'running',phase:'sections',processed:1};}
 return Response.json({job});
};
// Bind test-owned elements instead of invoking the auto auth flow on the original DOM.
const panel=d.getElementById('viewerRegeneratePanel');const open=d.getElementById('viewerRegenerateOpen');
const clone=d.cloneNode(true);const setup=w.regenerationModule.setupViewerRegeneration(clone,fetcher,w.sessionStorage);
const get=id=>clone.getElementById(id);const tick=()=>new Promise(r=>setTimeout(r,5));
try{
 get('viewerRegenerateOpen').click();await tick();await tick();
 assert.equal(get('viewerRegeneratePanel').hidden,false);
 assert.equal(get('viewerRegenerateList').value,'crossover-v3');
 get('viewerRegenerateStart').click();get('viewerRegenerateStart').click();await tick();assert.equal(posts,1);
 release();await tick();assert.equal(get('viewerRegenerateStart').disabled,true);
 assert.match(get('viewerRegenerateStatus').textContent,/画面を閉じても/);
 get('viewerRegenerateClose').click();assert.equal(get('viewerRegeneratePanel').hidden,true);
 get('viewerRegenerateOpen').click();await tick();await tick();assert.match(get('viewerRegenerateStatus').textContent,/読み込み中/);
 job={...job,state:'failed',error:'公開失敗'};await setup.poll();assert.equal(get('viewerRegenerateStart').textContent,'再試行');assert.equal(get('viewerRegenerateStart').disabled,false);
 get('viewerRegenerateStart').click();await tick();release();await tick();assert.equal(posts,2);assert.equal(requestIds[0],requestIds[1],'retry resumes the same request');
 job={...job,state:'completed'};await setup.poll();assert.match(get('viewerRegenerateStatus').textContent,/完了/);assert.equal(get('viewerRegenerateLink').hidden,false);
 assert.equal(get('viewerRegenerateLink').getAttribute('href'),'../index.html?list=crossover-v3');
 get('viewerRegenerateClose').click();
 const reopened=d.cloneNode(true);let firstList=true,releaseOld;
 w.regenerationModule.setupViewerRegeneration(reopened,async(url)=>{
  if(url.endsWith('/lists')) {
   if(firstList){firstList=false;await new Promise(resolve=>releaseOld=resolve);return Response.json([{id:'old',name:'Old',isNotebook:true}]);}
   return Response.json([{id:'new',name:'New',isNotebook:true}]);
  }
  return Response.json({job:null});
 },w.sessionStorage);
 reopened.getElementById('viewerRegenerateOpen').click();await tick();
 reopened.getElementById('viewerRegenerateClose').click();reopened.getElementById('viewerRegenerateOpen').click();await tick();await tick();
 releaseOld();await tick();assert.equal(reopened.getElementById('viewerRegenerateList').value,'new','stale open response cannot overwrite the reopened panel');
 reopened.getElementById('viewerRegenerateClose').click();
 console.log('Regeneration UI: target selection, double click, close/reopen progress, failure/retry and completion link passed');
}finally{dom.window.close();}
