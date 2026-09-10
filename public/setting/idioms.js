import {EDITOR_API_BASE} from '../shared/config.js';
import {editorFetch} from './auth.js';
import {escapeHtml, renderWordListMarkup, createAutoCrossRefRenderer} from '../shared/markup.js';
import {groupIdiomEntries} from '../shared/idioms.js';
import {createIdiomReferenceResolver} from '../shared/idiom-references.js';
const THEME_KEY = 'vocab-setting-theme';
const el = Object.fromEntries(['notebook','section','query','showHidden','status','entries','newIdiom','editDialog','idiomForm','dialogTitle','closeDialog','senses','addSense','saveStatus','save','themeToggleBtn','themeColor'].map(id=>[id,document.getElementById(id)]));
let data={chapters:[],entries:[]}, words=[], current=null, listId='', generation=0, resolve=()=>({found:false}), renderNotes=()=>'';
const field=name=>el.idiomForm.elements.namedItem(name);
function storedTheme(){try{return localStorage.getItem(THEME_KEY);}catch{return null;}}
function currentEffectiveTheme(){const explicit=document.documentElement.dataset.theme;if(explicit)return explicit;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
function applyTheme(theme){
  if(theme==='dark'||theme==='light')document.documentElement.dataset.theme=theme;else delete document.documentElement.dataset.theme;
  const effective=currentEffectiveTheme();
  el.themeToggleBtn.textContent=effective==='dark'?'ライト':'ダーク';
  el.themeToggleBtn.setAttribute('aria-pressed',String(effective==='dark'));
  el.themeColor.content=effective==='dark'?'#12141a':'#f8f9fc';
}
el.themeToggleBtn.addEventListener('click',()=>{const next=currentEffectiveTheme()==='dark'?'light':'dark';try{localStorage.setItem(THEME_KEY,next);}catch{}applyTheme(next);});
const colorScheme=matchMedia('(prefers-color-scheme: dark)');
colorScheme.addEventListener?.('change',()=>{if(!storedTheme())applyTheme(null);});
applyTheme(storedTheme());
async function api(path, options={}) {
  const r=await editorFetch(`${EDITOR_API_BASE}/api${path}`,{...options,headers:{'content-type':'application/json'},cache:'no-store'});
  const body=await r.json(); if(!r.ok)throw new Error(body.error||`HTTP ${r.status}`);return body;
}
function sections() {
  let no=0;
  return data.chapters.flatMap((c,ci)=>c.sections.map(s=>{
    const visible=data.entries.some(e=>e.sectionKey===s.key&&!e.hidden);
    if (visible && s.number == null) no += 1;
    const number = s.number ?? no;
    if (visible) no = Math.max(no, Number(number) || 0);
    return {...s,label:`Chapter ${ci+1} / ${visible?`Section ${number}`:'非表示'} ${s.subtitle}`};
  }));
}
function refreshReferences() {
  let no=0, branch=0;
  const index=new Map();
  for(const w of words) {
    const number=w.branch?`${no}-${++branch}`:String(++no); if(!w.branch)branch=0;
    if(!index.has(w.spelling.toLowerCase())) index.set(w.spelling.toLowerCase(),{found:true,id:w.id,no:number});
  }
  resolve=createIdiomReferenceResolver(groupIdiomEntries(data.entries,data.chapters),name=>index.get(name.toLowerCase())||{found:false});
  renderNotes=createAutoCrossRefRenderer([...index.keys(),...resolve.phrases],{resolve});
}
function renderList() {
  const q=el.query.value.trim().toLowerCase();
  const visible=data.entries.filter(e=>(el.showHidden.checked||!e.hidden)&&(!el.section.value||e.sectionKey===el.section.value)&&(!q||[e.phrase,e.notes,e.synonyms,e.antonyms,...e.meanings.map(s=>s.meaning)].join(' ').toLowerCase().includes(q)));
  const numbered=new Map(groupIdiomEntries(data.entries,data.chapters).flatMap(c=>c.sections.flatMap(s=>s.items.map(e=>[e.key,e.no]))));
  el.entries.innerHTML=visible.map(e=>`<button type="button" data-id="${escapeHtml(e.key)}" class="${e.hidden?'is-hidden':''}"><strong>${e.hidden?'非表示':numbered.get(e.key)}　${escapeHtml(e.phrase)}</strong><span>${e.meanings.map((s,i)=>`${e.meanings.length>1?String.fromCodePoint(0x2460+i):''}${escapeHtml(s.meaning)}`).join('　')}</span></button>`).join('');
  el.status.textContent=`${visible.length}項目`;
}
async function load() {
  const token=++generation;listId=el.notebook.value;el.entries.innerHTML='';el.status.textContent='読み込み中…';el.newIdiom.disabled=true;
  try {
    const [idioms,index]=await Promise.all([api(`/lists/${encodeURIComponent(listId)}/idioms`),api(`/lists/${encodeURIComponent(listId)}/viewer/index`)]);
    if(token!==generation)return; data=idioms;words=index.words||[];refreshReferences();
    el.section.innerHTML='<option value="">すべてのSection</option>'+sections().map(s=>`<option value="${escapeHtml(s.key)}">${escapeHtml(s.label)}</option>`).join('');
    el.newIdiom.disabled=!data.chapters.length;renderList();
  } catch(e) {if(token===generation)el.status.textContent=`読み込みに失敗しました：${e.message}`;}
}
function senseRow(s={meaning:'',refs:[]}) {
  const row=document.createElement('div');row.className='idiom-sense-editor';row._sense=s;
  row.innerHTML='<span class="sense-order"></span><textarea required rows="2" maxlength="2000" aria-label="意味"></textarea><button type="button" data-action="up" aria-label="意味を上へ">↑</button><button type="button" data-action="down" aria-label="意味を下へ">↓</button><button type="button" data-action="remove">削除</button><span class="sense-links"></span>';
  row.querySelector('textarea').value=s.meaning;
  row.querySelector('.sense-links').textContent=(s.refs||[]).length?'単語参照：'+s.refs.map(r=>words.find(w=>w.id===r.wordId)?.spelling||r.wordId).join('、'):'';
  el.senses.append(row);numberSenses();
}
function numberSenses(){[...el.senses.children].forEach((row,i)=>{row.querySelector('.sense-order').textContent=String.fromCodePoint(0x2460+i);});}
function preview() {
  for(const name of ['synonyms','antonyms','notes'])document.getElementById(name+'Preview').innerHTML=name==='notes'?renderNotes(field(name).value,{currentHeadword:field('phrase').value}):renderWordListMarkup(field(name).value,{resolve});
  for(const link of el.idiomForm.querySelectorAll('.preview a.ref')){link.href=`../index.html?list=${encodeURIComponent(listId)}${link.getAttribute('href')}`;link.target='_blank';link.rel='noopener';}
}
function open(e) {
  current=e?structuredClone(e):null;el.idiomForm.reset();el.saveStatus.textContent='';
  field('sectionKey').innerHTML=sections().map(s=>`<option value="${escapeHtml(s.key)}">${escapeHtml(s.label)}</option>`).join('');
  field('sectionKey').value=e?.sectionKey||el.section.value||sections()[0]?.key||'';
  for(const name of ['phrase','synonyms','antonyms','notes'])field(name).value=e?.[name]||'';
  field('hidden').checked=!!e?.hidden;el.senses.innerHTML='';(e?.meanings||[{meaning:'',refs:[]}]).forEach(senseRow);
  el.dialogTitle.textContent=e?'熟語を編集':'熟語を追加';preview();el.editDialog.showModal();field('phrase').focus();
}
el.notebook.addEventListener('change',load);
for(const control of ['section','query','showHidden'])el[control].addEventListener('input',renderList);
el.newIdiom.addEventListener('click',()=>open(null));
el.entries.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)open(data.entries.find(x=>x.key===b.dataset.id));});
el.closeDialog.addEventListener('click',()=>el.editDialog.close());
el.addSense.addEventListener('click',()=>{if(el.senses.children.length<30)senseRow();});
el.senses.addEventListener('click',e=>{const action=e.target.dataset.action,row=e.target.closest('.idiom-sense-editor');if(!row)return;if(action==='remove'&&el.senses.children.length>1)row.remove();if(action==='up'&&row.previousElementSibling)el.senses.insertBefore(row,row.previousElementSibling);if(action==='down'&&row.nextElementSibling)el.senses.insertBefore(row.nextElementSibling,row);numberSenses();});
el.idiomForm.addEventListener('input',preview);
el.idiomForm.addEventListener('submit',async e=>{
  e.preventDefault();el.save.disabled=true;el.closeDialog.disabled=true;el.saveStatus.textContent='保存中…';
  const payload={...(current?{id:current.key}:{}),phrase:field('phrase').value,sectionKey:field('sectionKey').value,hidden:field('hidden').checked,
    synonyms:field('synonyms').value,antonyms:field('antonyms').value,notes:field('notes').value,
    meanings:[...el.senses.children].map(row=>({...(row._sense.id?{id:row._sense.id}:{}),meaning:row.querySelector('textarea').value,wordIds:(row._sense.refs||[]).map(r=>r.wordId)}))};
  try{await api(`/lists/${encodeURIComponent(listId)}/idioms`,{method:'PUT',body:JSON.stringify(payload)});el.editDialog.close();await load();}
  catch(err){el.saveStatus.textContent=`保存に失敗しました：${err.message}`;}
  finally{el.save.disabled=false;el.closeDialog.disabled=false;}
});
(async()=>{try{const lists=await api('/lists');el.notebook.innerHTML=lists.map(l=>`<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join('');const preferred=new URLSearchParams(location.search).get('list')||'crossover-v3';if(lists.some(l=>l.id===preferred))el.notebook.value=preferred;await load();}catch(e){el.status.textContent=`読み込みに失敗しました：${e.message}`;}})();
