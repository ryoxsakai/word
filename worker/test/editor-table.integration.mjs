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
async function run(idiom){
 const html=readFileSync(new URL('../../public/setting/'+(idiom?'idioms.html':'index.html'),import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'http://localhost/setting/'+(idiom?'idioms.html':'index.html'),runScripts:'outside-only'});
 const w=dom.window;Object.assign(w,{structuredClone,Response,Headers,Request,TextEncoder,confirm:()=>true});
 w.localStorage.setItem('vocab-setting-edit-mode','table');w.localStorage.setItem('vocab-setting-last-list','book');
 const calls=[];let storedWord=detail(),storedIdiom=clone(entry),fail=false;
 w.fetch=async(input,opts={})=>{
  const path=new URL(String(input),'http://localhost').pathname;calls.push({path,method:opts.method||'GET',body:opts.body&&JSON.parse(opts.body)});let data;
  if(opts.method){
   if(fail)return new Response(JSON.stringify({error:'injected failure'}),{status:503});
   const body=JSON.parse(opts.body);
   if(path==='/api/words/alpha'){storedWord={...storedWord,...body};data=storedWord;}
   else if(path==='/api/lists/book/idioms'){storedIdiom={...body,key:body.id||'idiom-new',meanings:body.meanings.map((s,i)=>({...s,id:s.id||`new-${i}`,refs:s.wordIds.map(wordId=>({wordId}))}))};data={id:storedIdiom.key};}
   else throw new Error(`Unexpected write ${path}`);
  }else if(path==='/api/lists')data=[{id:'book',name:'Book',isNotebook:true}];
  else if(path==='/api/lists/book/editor/index')data={words:[word]};
  else if(path==='/api/lists/book/sections')data=[{id:1,subtitle:'First'}];
  else if(path==='/api/lists/book/labels')data=[{id:2,sectionId:1,name:'Label'}];
  else if(path==='/api/lists/book/chapters')data=[];
  else if(path==='/api/lists/book/editor/sections/1')data={words:[word]};
  else if(path==='/api/words/alpha')data=storedWord;
  else if(path==='/api/lists/book/editor/idioms')data={chapters:[{key:'c1',sections:[{key:'s1',subtitle:'First',labels:[]}]}],entries:[entry]};
  else if(path==='/api/lists/book/editor/idiom-sections/s1'||path==='/api/lists/book/idioms/sections/s1')data={entries:[storedIdiom]};
  else throw new Error(`Unexpected read ${path}`);
  return new Response(JSON.stringify(data),{headers:{'content-type':'application/json','x-editor-source':'r2'}});
 };
 w.eval(bundle);
 const d=w.document, get=label=>d.querySelector(`.sheet-table [aria-label="${label}"]`);
 await waitFor(()=>get(idiom?'熟語':'単語'),'table not loaded');
 assert.equal(d.querySelector('.word-table-pane').hidden,true);assert.equal(d.getElementById('editModalOverlay').hidden,true);
 assert.equal(calls.some(c=>c.path==='/api/words/alpha'),false,'display must not fetch individual D1 records');
 const edit=(el,value)=>{el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const meanings=d.querySelectorAll('.sheet-table [aria-label="意味"]');assert.equal(meanings.length,idiom?2:3);
 edit(meanings[1],'edited meaning');edit(get('メモ'),'edited note');assert.equal(calls.filter(c=>c.method!=='GET').length,0);
 if(!idiom){const phrases=d.querySelectorAll('.sheet-table [aria-label="英文"]');assert.equal(phrases.length,2);edit(phrases[1],'Second edited sentence');storedWord.etymology='concurrent unrelated update';}
 const saveAll=[...d.querySelectorAll('button')].find(b=>b.textContent==='変更を保存');saveAll.click();
 await waitFor(()=>d.getElementById('tableToast')?.textContent==='保存しました','success toast missing');
 const writes=calls.filter(c=>c.method!=='GET');assert.equal(writes.length,1);const saved=writes[0].body;
 if(idiom){assert.equal(saved.meanings[1].meaning,'edited meaning');assert.equal(saved.meanings[1].id,'s-b');assert.deepEqual(saved.meanings[0].wordIds,['alpha']);assert.equal(saved.hidden,true);}
 else{assert.equal(saved.senses[1].meaning,'edited meaning');assert.equal(saved.examples[0].answer,'retained answer');assert.equal(saved.examples[1].sentence,'Second edited sentence');assert.equal(saved.etymology,'concurrent unrelated update');assert.equal(saved.audioUrl,'legacy.mp3');}
 d.getElementById('tableToast').textContent='';fail=true;edit(get('メモ'),'unsaved after failure');saveAll.click();
 await waitFor(()=>d.querySelector('.sheet-error')?.textContent.includes('injected failure'),'save failure missing');
 assert.equal(get('メモ').value,'unsaved after failure');assert.equal(calls.filter(c=>c.method!=='GET').length,2);assert.equal(d.getElementById('tableToast').textContent,'');
 await tick();assert.equal(calls.filter(c=>c.method!=='GET').length,2);
 const meanCell=get('意味').closest('td');[...meanCell.querySelectorAll('button')].find(b=>b.textContent==='＋追加').click();assert.equal(meanCell.querySelectorAll('[aria-label="意味"]').length,3);assert.equal(d.getElementById('editModalOverlay').hidden,true);
 dom.window.close();
}
await run(false);await run(true);
console.log('Table editor passed: JSON reads, repeated fields, scoped saves, conflict merge, retained hidden data, failures and toast');
