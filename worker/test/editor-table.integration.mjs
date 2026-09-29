import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {wordDraft,wordPayload,idiomDraft,idiomPayload,mergeDraft,clone} from '../../public/setting/table-data.js';
const word={id:'alpha',spelling:'alpha',notes:'original',audioUrl:'legacy.mp3',senses:[{pos:'名',meaning:'first',isPrimary:true},{pos:'他',meaning:'second',pronunciation:'/a/'}],examples:[{type:'phrase',sentence:'alpha phrase',translation:'訳1',answer:'retained answer'},{type:'example',sentence:'An alpha.',translation:'訳2'}],derivatives:[{word:'alphabet',pos:'名',meaning:'letters'}],tags:{target1900:'123',awl:'2','custom:medical':null},sectionId:1,labelId:2,displayNo:'1',derivedFromSpelling:'parent'};
const detail=()=>({...clone(word),senses:word.senses.map(s=>({...s,is_primary:!!s.isPrimary})),derivedFrom:{spelling:'parent'},lists:[{listId:'book',sectionId:1,labelId:2,displayNo:'1'}]});
const before=wordDraft(word,'book'),draft=clone(before);draft.examples.reverse();draft.notes='changed';
const payload=wordPayload(draft,detail());assert.equal(payload.examples[1].answer,'retained answer');assert.equal(payload.audioUrl,'legacy.mp3');assert.equal('target1900'in payload.tags,false);assert.equal(payload.tags['custom:medical'],true);
const latest=clone(before);latest.etymology='other editor';assert.equal(mergeDraft(before,draft,latest).etymology,'other editor');latest.notes='conflicting change';assert.throws(()=>mergeDraft(before,draft,latest),/別の編集/);
const entry={key:'idiom-a',phrase:'take care',sectionKey:'s1',alternateForms:['take care of'],meanings:[{id:'s-a',meaning:'first',refs:[{wordId:'alpha'}]},{id:'s-b',meaning:'second',refs:[]}],notes:'idiom note',hidden:true};
const iDraft=idiomDraft(entry);iDraft.meanings.reverse();iDraft.meanings[0].meaning='edited';const iPayload=idiomPayload(iDraft,entry);assert.equal(iPayload.meanings[0].id,'s-b');assert.equal(iPayload.meanings[1].wordIds[0],'alpha');
const bundle=(await build({entryPoints:[new URL('../../public/setting/table-mode.js',import.meta.url).pathname],bundle:true,format:'iife',write:false})).outputFiles[0].text;
const tick=()=>new Promise(r=>setTimeout(r,5));
async function waitFor(fn,message){for(let i=0;i<200;i++){if(fn())return;await tick();}throw new Error(message);}
async function run(idiom, referenceFailure=false, catalogTimeout=false){
 const html=readFileSync(new URL('../../public/setting/'+(idiom?'idioms.html':'index.html'),import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'http://localhost/setting/'+(idiom?'idioms.html':'index.html'),runScripts:'outside-only'});
 const w=dom.window;Object.assign(w,{structuredClone,Response,Headers,Request,TextEncoder,confirm:()=>true});
 w.localStorage.setItem('vocab-setting-edit-mode','table');w.localStorage.setItem('vocab-setting-last-list','wrong-book');
 const extraWords=Array.from({length:20},(_,i)=>({...clone(word),id:`extra-${i}`,spelling:`extra ${i}`}));
 const extraIdioms=Array.from({length:20},(_,i)=>({...clone(entry),key:`extra-${i}`,phrase:`extra ${i}`}));
 let releaseCatalog,releaseReferences;
 const catalogReady=new Promise(resolve=>{releaseCatalog=resolve;});
 const referencesReady=new Promise(resolve=>{releaseReferences=resolve;});
 const calls=[];let storedWord=detail(),storedIdiom=clone(entry),publishedWord=detail(),publishedIdiom=clone(entry),fail=false,failConfirmation=false,confirmationReads=0;
 // Speed up only publication polling, leaving UI debounce/toast timing intact.
 const nativeTimeout=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===1000?10:catalogTimeout&&ms===15000?30:ms,...args);
 w.fetch=async(input,opts={})=>{
  const url=new URL(String(input),'http://localhost'),path=url.pathname;calls.push({path,method:opts.method||'GET',body:opts.body&&JSON.parse(opts.body)});let data;
  if(url.searchParams.get('editorFresh')==='1'&&/\/editor\/(?:sections|idiom-sections)\//.test(path)){
   confirmationReads++;
   if(failConfirmation)return new Response(JSON.stringify({error:'confirmation unavailable'}),{status:503});
   if(confirmationReads===1)return new Response(JSON.stringify({code:'editor_snapshot_pending',error:'publication pending'}),{status:503});
  }
  if(path==='/api/lists'){await catalogReady;if(catalogTimeout&&calls.filter(c=>c.path===path).length===1)await new Promise(()=>{});}
  if(!idiom&&path==='/api/lists/book/editor/idioms'){await referencesReady;if(referenceFailure)return new Response(JSON.stringify({error:'reference unavailable'}),{status:503});}
  if(opts.method){
   if(fail)return new Response(JSON.stringify({error:'injected failure'}),{status:503});
   const body=JSON.parse(opts.body);
   if(path==='/api/words/alpha'){storedWord={...storedWord,...body};data=storedWord;}
   else if(path==='/api/lists/book/idioms'){storedIdiom={...body,key:body.id||'idiom-new',meanings:body.meanings.map((s,i)=>({...s,id:s.id||`new-${i}`,refs:s.wordIds.map(wordId=>({wordId}))}))};data={id:storedIdiom.key};}
   else throw new Error(`Unexpected write ${path}`);
  }else if(path==='/api/lists')data=[{id:'wrong-book',name:'Other',isNotebook:true},{id:'book',name:'crossover',isNotebook:true}];
  else if(path==='/api/lists/book/editor/index')data={words:[word,...extraWords]};
  else if(path==='/api/lists/book/sections')data=[{id:1,subtitle:'First'}];
  else if(path==='/api/lists/book/labels')data=[{id:2,sectionId:1,name:'Label'}];
  else if(path==='/api/lists/book/chapters')data=[];
  else if(path==='/api/lists/book/editor/sections/1')data={words:[publishedWord,...extraWords]};
  else if(path==='/api/words/alpha')data=storedWord;
  else if(path==='/api/lists/book/editor/idioms')data={chapters:[{key:'c1',sections:[{key:'s1',subtitle:'First',labels:[]}]}],entries:[entry,...extraIdioms,{key:'carry',phrase:'carry O out',sectionKey:'s1',meanings:[{meaning:'実行する',refs:[]}]}]};
  else if(path==='/api/lists/book/editor/idiom-sections/s1')data={entries:[publishedIdiom,...extraIdioms]};
  else if(path==='/api/lists/book/idioms/sections/s1')data={entries:[storedIdiom,...extraIdioms]};
  else throw new Error(`Unexpected read ${path}`);
  return new Response(JSON.stringify(data),{headers:{'content-type':'application/json','x-editor-source':'r2'}});
 };
 w.eval(bundle);
 const d=w.document;
 assert.match(d.querySelector('.sheet-status').textContent,/読み込んでいます/);
 assert.equal(d.querySelector('[aria-label="カードで編集するSection"]').disabled,true);
 releaseCatalog();if(idiom)releaseReferences();
 if(catalogTimeout){
  await waitFor(()=>d.querySelector('.sheet-status').textContent.includes('通信に時間'),'stalled request must show an error');
  const retry=[...d.querySelectorAll('button')].find(b=>b.textContent==='再読み込み');
  assert.equal(retry.disabled,false);retry.click();
 }
 const get=label=>d.querySelector(`.sheet-card [aria-label="${label}"]`);
 await waitFor(()=>get(idiom?'熟語':'単語'),'cards must load before optional idiom references');
 releaseReferences();
 if(!idiom)await waitFor(()=>referenceFailure?d.getElementById('tableToast')?.textContent.includes('参照'):calls.some(c=>c.path==='/api/lists/book/editor/idioms'),'reference request missing');
 await tick();
 assert.equal(d.querySelector('[aria-label="カードで編集する単語帳"]'),null);assert.ok(d.querySelector('.topbar-row--primary > select'));
 assert.equal(d.querySelector('.word-table-pane').hidden,true);assert.equal(d.getElementById('editModalOverlay').hidden,true);
 for(const label of ['Section','Label','派生元','No.'])assert.equal(get(label),null);
 assert.equal(calls.some(c=>c.path==='/api/words/alpha'),false,'display must not fetch individual D1 records');
 const edit=(el,value)=>{el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const meanings=d.querySelector('.sheet-card').querySelectorAll('[aria-label="意味"]');assert.equal(meanings.length,idiom?2:3);
 if(!idiom){
  for(const label of ['類義語','対義語','関連語','メモ']) {
    const input=get(label); edit(input,'carry out A');
    const preview=d.querySelector(`.sheet-card [aria-label="${label}の表示"]`);
    if(referenceFailure){assert.equal(preview.querySelector('a[data-idiom-id]'),null);continue;}
    assert.match(preview.textContent,/carry O out/);
    assert.match(preview.textContent,/熟 /);
    assert.equal(preview.querySelector('a').hash,'#idiom-carry');
    assert.equal(preview.querySelector('a').pathname,'/index.html');
    assert.equal(input.value,'carry out A','display normalization must preserve the editable source');
  }
  assert.equal(calls.filter(c=>c.path==='/api/lists/book/editor/idioms').length,1,'read the JSON reference index only once per notebook');
}
edit(meanings[1],'edited meaning');edit(get('メモ'),'edited note');assert.equal(calls.filter(c=>c.method!=='GET').length,0);
 if(!idiom){const phrases=d.querySelector('.sheet-card').querySelectorAll('[aria-label="英文"]');assert.equal(phrases.length,2);edit(phrases[1],'Second edited sentence');edit(get('類義語'),'serve; perform; carry A out');storedWord.etymology='concurrent unrelated update';}
 if(!idiom){
  assert.equal(get('種類'),null);assert.equal(get('品詞ごとの発音'),null);assert.equal(get('Oxford 5000'),null);
  const badge=get('能格');assert.equal(badge.tagName,'BUTTON');badge.click();assert.equal(badge.getAttribute('aria-pressed'),'true');
  const primary=get('見出しの意味');assert.equal(primary.closest('.sheet-repeat-actions').children[2].textContent,'↓');
  const examples=get('英文').closest('fieldset');[...examples.querySelectorAll('button')].find(b=>b.textContent==='＋追加').click();
  const sentences=examples.querySelectorAll('[aria-label="英文"]');edit(sentences[2],'New phrase');
  edit(examples.querySelectorAll('[aria-label="日本語訳"]')[2],'新しいフレーズ');
 }
 const rail=d.querySelector('.sheet-card-rail'), firstBody=d.querySelector('.sheet-card-body');
 firstBody.scrollTop=321;rail.scrollLeft=234;
 assert.equal(d.querySelectorAll('.sheet-card').length,20);
 const next=[...d.querySelectorAll('button')].find(b=>b.textContent==='次のカード →');
 const previous=[...d.querySelectorAll('button')].find(b=>b.textContent==='← 前のカード');
 const reads=calls.length;next.click();await waitFor(()=>d.querySelectorAll('.sheet-card').length===1,'next batch missing');
 assert.equal(calls.length,reads,'card navigation must not reload JSON');
 previous.click();await waitFor(()=>d.querySelectorAll('.sheet-card').length===20,'previous batch missing');
 assert.equal(get('メモ').value,'edited note','draft lost across batches');
 assert.equal(d.querySelector('.sheet-card-body').scrollTop,321,'vertical scroll lost across batches');
 rail.scrollLeft=234;
 const saveAll=[...d.querySelectorAll('button')].find(b=>b.textContent==='変更を保存');saveAll.click();
 await waitFor(()=>calls.some(c=>c.method!=='GET'),'write not made');
 await tick();
 assert.notEqual(d.getElementById('tableToast')?.textContent,'保存しました','a write response alone must not produce a success toast');
 await waitFor(()=>confirmationReads>1,'publication not checked after pending response');
 assert.ok(w.localStorage.getItem('vocab-editor-pending-publication'),'stale JSON must not clear the pending marker');
 publishedWord=clone(storedWord);publishedIdiom=clone(storedIdiom);
 await waitFor(()=>d.getElementById('tableToast')?.textContent==='保存しました','success toast missing');
 assert.equal(rail.scrollLeft,234,'horizontal position lost on save');
 assert.equal(d.querySelector('.sheet-card-body').scrollTop,321,'vertical position lost on save');
 assert.equal(d.querySelector('.sheet-card-badge').textContent,'保存済み');
 assert.equal(w.localStorage.getItem('vocab-editor-pending-publication'),null);
 if(!idiom)assert.equal(get('類義語').value,'serve; perform; carry A out');
 const reopened=new JSDOM(html,{url:w.location.href,runScripts:'outside-only'});
 Object.assign(reopened.window,{structuredClone,Response,Headers,Request,TextEncoder,confirm:()=>true,fetch:w.fetch});
 reopened.window.localStorage.setItem('vocab-setting-edit-mode','table');
 reopened.window.eval(bundle);
 await waitFor(()=>reopened.window.document.querySelector('.sheet-card [aria-label="メモ"]')?.value==='edited note','a newly opened page lost the saved edit');
 if(!idiom)assert.equal(reopened.window.document.querySelector('.sheet-card [aria-label="類義語"]').value,'serve; perform; carry A out');
 reopened.window.close();
 const writes=calls.filter(c=>c.method!=='GET');assert.equal(writes.length,1);const saved=writes[0].body;
 if(idiom){assert.equal(saved.meanings[1].meaning,'edited meaning');assert.equal(saved.meanings[1].id,'s-b');assert.deepEqual(saved.meanings[0].wordIds,['alpha']);assert.equal(saved.hidden,true);}
 else{assert.equal(saved.derivedFrom,'parent');assert.equal(saved.ergative,true);assert.equal(saved.tags.awl,'2');assert.equal(saved.tags['custom:medical'],true);assert.equal(saved.senses[1].pronunciation,'/a/');assert.equal(saved.examples[1].type,'example');assert.equal(saved.examples[2].type,'phrase');assert.equal(saved.senses[1].meaning,'edited meaning');assert.equal(saved.examples[0].answer,'retained answer');assert.equal(saved.examples[1].sentence,'Second edited sentence');assert.equal(saved.etymology,'concurrent unrelated update');assert.equal(saved.audioUrl,'legacy.mp3');}
 d.getElementById('tableToast').textContent='';fail=true;edit(get('メモ'),'unsaved after failure');saveAll.click();
 await waitFor(()=>d.querySelector('.sheet-error')?.textContent.includes('injected failure'),'save failure missing');
 assert.equal(get('メモ').value,'unsaved after failure');assert.equal(calls.filter(c=>c.method!=='GET').length,2);assert.equal(d.getElementById('tableToast').textContent,'');
 await tick();assert.equal(calls.filter(c=>c.method!=='GET').length,2);
 // Reload from the JSON used by a new page, not the in-memory saved row.
 [...d.querySelectorAll('button')].find(b=>b.textContent==='再読み込み').click();
 await waitFor(()=>get('メモ')?.value==='edited note','reload lost the saved edit');
 if(!idiom)assert.equal(get('類義語').value,'serve; perform; carry A out');
 fail=false;failConfirmation=true;edit(get('メモ'),'saved but awaiting publication');saveAll.click();
 await waitFor(()=>d.querySelector('.sheet-error')?.textContent.includes('保存済みですが'),'publication failure must be distinguished from a failed write');
 assert.equal(get('メモ').value,'saved but awaiting publication');
 assert.notEqual(d.getElementById('tableToast').textContent,'保存しました');
 assert.ok(w.localStorage.getItem('vocab-editor-pending-publication'));
 assert.equal(calls.filter(c=>c.method!=='GET').length,3);
 await tick();assert.equal(calls.filter(c=>c.method!=='GET').length,3,'a confirmation failure must not replay the write');
 const meanCell=get('意味').closest('fieldset');[...meanCell.querySelectorAll('button')].find(b=>b.textContent==='＋追加').click();assert.equal(meanCell.querySelectorAll('[aria-label="意味"]').length,3);assert.equal(d.getElementById('editModalOverlay').hidden,true);
 dom.window.close();
}
async function pendingStartup(idiom) {
 const html=readFileSync(new URL('../../public/setting/'+(idiom?'idioms.html':'index.html'),import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'http://localhost/setting/'+(idiom?'idioms.html':'index.html'),runScripts:'outside-only'});
 const w=dom.window;Object.assign(w,{structuredClone,Response,Headers,Request,TextEncoder,confirm:()=>true});
 const marker='previous-save';
 w.localStorage.setItem('vocab-setting-edit-mode','table');
 w.localStorage.setItem('vocab-editor-pending-publication',marker);
 let pending=true;
 const calls=[];
 w.fetch=async(input,opts={})=>{
  assert.ok(!opts.method||opts.method==='GET','startup must never write');
  const url=new URL(String(input),'http://localhost'),path=url.pathname,fresh=url.searchParams.has('editorFresh');
  calls.push({path,fresh});
  if(pending&&fresh)return new Response(JSON.stringify({code:'editor_snapshot_pending',error:'publication pending'}),{status:503});
  const fixtures={
   '/api/lists':[{id:'book',name:'crossover',isNotebook:true}],
   '/api/lists/book/editor/index':{words:[word]},
   '/api/lists/book/sections':[{id:1,subtitle:'First'}],
   '/api/lists/book/labels':[{id:2,sectionId:1,name:'Label'}],
   '/api/lists/book/chapters':[],
   '/api/lists/book/editor/sections/1':{words:[detail()]},
   '/api/lists/book/editor/idioms':{chapters:[{key:'c1',sections:[{key:'s1',subtitle:'First',labels:[]}]}],entries:[entry]},
   '/api/lists/book/editor/idiom-sections/s1':{entries:[entry]}
  };
  assert.ok(path in fixtures,`unexpected endpoint ${path}`);
  return new Response(JSON.stringify(fixtures[path]),{headers:{'x-editor-source':'r2'}});
 };
 try {
  w.eval(bundle);
  const d=w.document;
  await waitFor(()=>d.querySelector('.sheet-card'),'pending publication must not block startup cards');
  assert.equal(w.localStorage.getItem('vocab-editor-pending-publication'),marker,'published fallback must retain the unconfirmed save marker');
  const notice=d.querySelector('.sheet-publication-notice');
  assert.ok(notice&&!notice.hidden,'unconfirmed publication must remain visible after cards render');
  assert.match(notice.textContent,/公開済み/);
  assert.deepEqual(calls.filter(c=>c.path==='/api/lists').map(c=>c.fresh),[true,false],'fall back immediately, without repeated strict polling');
  assert.ok(calls.every(c=>c.path!=='/api/words/alpha'),'startup must use JSON endpoints only');
  pending=false;
  [...d.querySelectorAll('button')].find(b=>b.textContent==='再読み込み').click();
  await waitFor(()=>d.querySelector('.sheet-card')&&w.localStorage.getItem('vocab-editor-pending-publication')===null,'a successful fresh reload must clear the pending marker');
  assert.equal(notice.hidden,true,'hide the publication notice after confirmation');
 } finally {dom.window.close();}
}
await pendingStartup(false);await pendingStartup(true);
await run(false);await run(true);await run(false,true);await run(false,false,true);
console.log('Card editor passed: draft/scroll preservation, JSON reads, repeated fields, scoped saves, conflict merge, retained hidden data, failures and toast');
