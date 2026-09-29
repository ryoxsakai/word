import { EDITOR_API_BASE } from '../shared/config.js';
import { editorFetch } from './auth.js';
import { orderIdiomLabels, groupIdiomEntries } from '../shared/idioms.js';
import { clone, same, changedKeys, mergeDraft, wordDraft, idiomDraft, wordPayload, idiomPayload, membershipPayload, cautions } from './table-data.js';

import { createIdiomReferenceResolver } from '../shared/idiom-references.js';
import { createAutoCrossRefRenderer, renderWordListMarkup } from '../shared/markup.js';

const MODE_KEY = 'vocab-setting-edit-mode';
const PENDING_KEY = 'vocab-editor-pending-publication';
const idiom = location.pathname.endsWith('idioms.html');
const toggle = document.getElementById('editModeToggle');
// Keep the saved mode value compatible with the former table editor.
const tableMode = localStorage.getItem(MODE_KEY) === 'table';
let rows = [], sections = [], labels = [], index = [], books = [], page = 0, loading = false, saving = false;
let listId = '', sectionKey = '', query = '', sequence = 0;
let wordNames = new Map();
let resolveReference = () => ({found:false}), renderReferenceNotes;
let referenceGeneration = 0;
const referencePreviews = new Set();
function prepareReferences(words, idioms = {entries:[],chapters:[]}) {
  const wordIndex = new Map(words.map(w => [w.spelling.toLowerCase(), {found:true,id:w.id,no:w.displayNo ?? w.seqNo ?? w.no}]));
  resolveReference = createIdiomReferenceResolver(groupIdiomEntries(idioms.entries,idioms.chapters), name => wordIndex.get(name.toLowerCase()) || {found:false});
  const names = [...wordIndex.keys(),...resolveReference.phrases];
  renderReferenceNotes = (text, context) => {
    const haystack = String(text || '').toLowerCase().replace(/\s+/g,' ');
    const relevant = name => haystack.includes(name.toLowerCase());
    return createAutoCrossRefRenderer(names.filter(relevant), {resolve:resolveReference,idiomReferences:resolveReference.phrases.filter(relevant)})(text, context);
  };
}
const pageSize = 20;
const draftOf = raw => idiom ? idiomDraft(raw) : wordDraft(raw, listId);
const dirty = row => row.isNew || (row.draft && !same(row.base, row.draft));
const hasChanges = () => rows.some(dirty);
function node(tag, attrs = {}, text) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') el.className = value;
    else el.setAttribute(key, value);
  }
  if (text != null) el.textContent = text;
  return el;
}
function button(text, action, attrs = {}) {
  const el = node('button', { type: 'button', ...attrs }, text);
  el.addEventListener('click', action);
  return el;
}
async function api(path, options = {}, { confirm = false } = {}) {
  const read = !options.method || options.method === 'GET';
  const pending = localStorage.getItem(PENDING_KEY);
  if (read && (pending || confirm)) path += `${path.includes('?') ? '&' : '?'}editorFresh=1`;
  for (let attempt = 0; ; attempt++) {
    const controller = read ? new AbortController() : null;
    let timer;
    const request = (async () => {
      const response = await editorFetch(`${EDITOR_API_BASE}/api${path}`, { ...options, ...(controller ? {signal:controller.signal} : {}), headers: {'content-type':'application/json'}, cache:'no-store' });
      return {response, data:response.status === 204 ? null : await response.json()};
    })();
    const {response,data} = await (read ? Promise.race([request, new Promise((_, reject) => {
      timer = setTimeout(() => { reject(new Error('通信に時間がかかっています。再読み込みしてください。')); controller.abort(); }, 15000);
    })]) : request).finally(() => clearTimeout(timer));
    if (!response.ok) {
      if (read && !confirm && data?.code === 'editor_snapshot_pending' && attempt < 60) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw Object.assign(new Error(data?.error || `HTTP ${response.status}`), {code:data?.code});
    }
    if (!read) localStorage.setItem(PENDING_KEY, crypto.randomUUID());
    else if (!confirm && pending && response.headers.get('x-editor-source') === 'r2' && localStorage.getItem(PENDING_KEY) === pending) localStorage.removeItem(PENDING_KEY);
    return data;
  }
}
function toast(message) {
  let el = document.getElementById('tableToast');
  if (!el) { el = node('div', {id:'tableToast',class:'toast',role:'status','aria-live':'polite'}); document.body.append(el); }
  el.textContent = message; el.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 2800);
}
toggle.textContent = tableMode ? '通常編集に切替' : 'カード編集に切替';
toggle.setAttribute('aria-pressed', String(tableMode));
toggle.addEventListener('click', () => {
  if (saving) return;
  if (hasChanges() && !confirm('未保存の変更があります。変更を破棄して編集方式を切り替えますか？')) return;
  if (!tableMode && !document.getElementById('editModalOverlay').hidden && !confirm('開いている編集内容は引き継がれません。編集方式を切り替えますか？')) return;
  rows = []; // The user has confirmed discarding drafts; avoid a second unload prompt.
  localStorage.setItem(MODE_KEY, tableMode ? 'normal' : 'table');
  location.reload();
});
window.addEventListener('beforeunload', event => {
  if (hasChanges() || saving) { event.preventDefault(); event.returnValue = ''; }
});

let pane, controls, menuControls, sectionSelect, search, status, body, saveButton, prevButton, nextButton, pageLabel;
function updateStatus(message) {
  sectionSelect.disabled=loading||saving;
  menuControls?.querySelectorAll('input,button').forEach(el=>{el.disabled=loading||saving;});
  status.classList.toggle('has-message',!!message);
  status.textContent = message || `${rows.length}件 · 未保存 ${rows.filter(dirty).length}件`;
  saveButton.disabled = loading || saving || !hasChanges();
}
function guardNavigation() { return !saving && (!hasChanges() || confirm('未保存の変更を破棄して移動しますか？')); }
function options(select, items, selected) {
  select.replaceChildren(...items.map(([value, name]) => node('option', {value}, name)));
  select.value = selected ?? items[0]?.[0] ?? '';
}
function fitText(input) {
  if(!input.isConnected || !input.clientWidth)return;
  input.style.height='auto';
  input.style.height=`${input.scrollHeight+2}px`;
}
function fitTextFields(root=body) { root?.querySelectorAll('textarea').forEach(fitText); }
function textField(container, row, key, title, {type='text', choices, multiline=false, onChange} = {}) {
  const label = node('label', {}, title);
  const input = node(choices ? 'select' : multiline ? 'textarea' : 'input', {'aria-label':title});
  if (choices) options(input, choices, String(row.draft[key] ?? ''));
  else if (type === 'checkbox') { input.type = 'checkbox'; input.checked = !!row.draft[key]; label.className = 'sheet-check'; }
  else { if (!multiline) input.type = type; input.value = row.draft[key] ?? ''; if (multiline) input.rows = 1; }
  input.addEventListener(choices || type === 'checkbox' ? 'change' : 'input', () => {
    row.draft[key] = type === 'checkbox' ? input.checked : input.value;
    if(multiline)fitText(input);
    if (onChange) onChange();
    mark(row);
  });
  label.append(input); container.append(label);
  if (['synonyms','antonyms','relatedWords','notes'].includes(key)) {
    const preview = node('div', {class:'preview sheet-reference-preview','aria-label':`${title}の表示`});
    const update = () => {
      const html = key === 'notes'
        ? renderReferenceNotes(input.value, {currentHeadword:row.draft.spelling || row.draft.phrase,autoReferences:!idiom})
        : renderWordListMarkup(input.value, {resolve:resolveReference});
      preview.innerHTML = html;
      preview.hidden = !input.value.trim();
      for (const link of preview.querySelectorAll('a.ref')) {
        link.href = `../index.html?list=${encodeURIComponent(listId)}${link.getAttribute('href')}`;
        link.target = '_blank'; link.rel = 'noopener';
      }
    };
    input.addEventListener('input', update); referencePreviews.add(update); update(); container.append(preview);
  }
  return input;
}
function mark(row) {
  row.element?.querySelectorAll('[data-fields]').forEach(cell => {
    cell.classList.toggle('is-dirty', row.isNew || cell.dataset.fields.split(',').some(k => !same(row.base[k], row.draft[k])));
  });
  if(row.titleElement)row.titleElement.textContent=row.draft.spelling||row.draft.phrase||'新規';
  if(row.badgeElement)row.badgeElement.textContent=dirty(row)?'未保存':'保存済み';
  if(row.saveElement)row.saveElement.disabled=!dirty(row);
  updateStatus();
}
const pos = [['','—'], ...['名','自','他','動','形','副','代','冠','前','接','間','助','熟','連'].map(s=>[s,s])];
function repeat(container, row, key, fields, empty, max = Infinity) {
  const list = node('div');
  function render() {
    list.replaceChildren();
    row.draft[key].forEach((item, i) => {
      const box = node('div', {class:`sheet-repeat sheet-repeat--${key}`});
      const fieldsBox=node('div',{class:'sheet-repeat-fields'});box.append(fieldsBox);
      const actions=node('div',{class:'sheet-repeat-actions'});actions.append(node('span',{},String(i+1)));
      let primaryField;
      for (const [field, title, config = {}] of fields) {
        const proxy = {draft:item};
        const fieldConfig = {...config, onChange:() => {
          if (field === 'is_primary' && item.is_primary) { row.draft[key].forEach((s,n)=>{if(n!==i)s.is_primary=false;}); render();fitTextFields(list); }
          mark(row);
        }};
        // Retain uncommon existing part-of-speech values instead of silently blanking them.
        if (fieldConfig.choices && item[field] && !fieldConfig.choices.some(([v])=>v===item[field])) fieldConfig.choices = [...fieldConfig.choices,[item[field],item[field]]];
        const input=textField(field==='is_primary'?actions:fieldsBox, proxy, field, title, fieldConfig);
        if(field==='is_primary'){primaryField=input.parentElement;input.parentElement.firstChild.textContent='見出し';}
      }
      if (key === 'meanings' && item.wordIds.length) box.append(node('p', {class:'sheet-readonly'}, '単語参照：' + item.wordIds.map(id => wordNames.get(id) || '登録済みの参照').join('、')));
      const move = offset => { const to=i+offset; if(to<0||to>=row.draft[key].length)return; [row.draft[key][i],row.draft[key][to]]=[row.draft[key][to],row.draft[key][i]];render();fitTextFields(list);mark(row); };
      const up=button('↑',()=>move(-1),{'aria-label':`${i+1}番目を上へ`}); up.disabled=i===0;
      const down=button('↓',()=>move(1),{'aria-label':`${i+1}番目を下へ`});down.disabled=i===row.draft[key].length-1;
      actions.append(up,down);if(primaryField)actions.append(primaryField);actions.append(button('削除',()=>{row.draft[key].splice(i,1);render();fitTextFields(list);mark(row);}));box.append(actions);list.append(box);
    });
  }
  render();container.append(list,button('＋追加',()=>{if(row.draft[key].length>=max)return;row.draft[key].push(clone(empty));render();fitTextFields(list);mark(row);}));
}
function columns() {
  const fieldCol = (name,key,config={}) => ({name,fields:[key],draw:(td,row)=>textField(td,row,key,name,config)});
  if(idiom)return [fieldCol('熟語','phrase'),fieldCol('別形（1行に1つ）','alternateForms',{multiline:true}),
    {name:'意味・単語参照',wide:true,fields:['meanings'],draw:(td,row)=>repeat(td,row,'meanings',[['meaning','意味',{multiline:true}]],{meaning:'',wordIds:[]},30)},
    ...['synonyms','antonyms','notes'].map((k,i)=>fieldCol(['同義語','対義語','メモ'][i],k,{multiline:true})),fieldCol('閲覧から非表示','hidden',{type:'checkbox'})];
  const wordColumns = [fieldCol('単語','spelling'),fieldCol('発音記号','pronunciation'),
    {name:'品詞・意味',wide:true,fields:['senses'],draw:(td,row)=>repeat(td,row,'senses',[['pos','品詞',{choices:pos}],['meaning','意味',{multiline:true}],['is_primary','見出しの意味',{type:'checkbox'}]],{pos:'',meaning:'',pronunciation:'',is_primary:row.draft.senses.length===0})},
    {name:'例文・フレーズ',wide:true,fields:['examples'],draw:(td,row)=>repeat(td,row,'examples',[['sentence','英文',{multiline:true}],['translation','日本語訳',{multiline:true}]],{type:'phrase',sentence:'',translation:'',answer:''})},
    {name:'派生語',wide:true,fields:['derivatives'],draw:(td,row)=>repeat(td,row,'derivatives',[['word','派生語'],['pos','品詞',{choices:pos}],['meaning','意味',{multiline:true}]],{word:'',pos:'',meaning:''})},
    ...['irregularForms','synonyms','antonyms','relatedWords','etymology','notes'].map((k,i)=>fieldCol(['不規則活用','類義語','対義語','関連語','語源','メモ'][i],k,{multiline:true})),
    {name:'注意事項',fields:cautions,draw(td,row){
      td.classList.add('sheet-cautions');
      const names=['能格','スペル注意','発音注意','アクセント注意','多義語','活用注意','語法注意'];
      const short=['能','ス','発','ア','多','活','法'];
      const variants=['ergative','spelling','','','polysemous','conjugation','usage'];
      cautions.forEach((key,i)=>{
        const badge=button(short[i],()=>{row.draft[key]=!row.draft[key];badge.classList.toggle('is-active',row.draft[key]);badge.setAttribute('aria-pressed',String(row.draft[key]));mark(row);},{class:`caution-toggle-btn ${variants[i]?'caution-toggle-btn--'+variants[i]:''}${row.draft[key]?' is-active':''}`,'aria-label':names[i],title:names[i],'aria-pressed':String(!!row.draft[key])});
        td.append(badge);
      });
    }},
  ];
  const first = ['単語','発音記号','注意事項','品詞・意味','例文・フレーズ','派生語'];
  return wordColumns.sort((a,b)=>(first.includes(a.name)?first.indexOf(a.name):100)-(first.includes(b.name)?first.indexOf(b.name):100));
}
function record(raw, isNew=false) {const draft=draftOf(raw);return {id:raw.id||raw.key||crypto.randomUUID(),raw,base:clone(draft),draft,isNew,error:''};}
let filteredCount = 0;
function rememberScroll() {
  for(const row of rows)if(row.bodyElement?.isConnected)row.scrollTop=row.bodyElement.scrollTop;
}
function updateNavigation() {
  const max=body.scrollWidth-body.clientWidth;
  prevButton.disabled=loading||saving||(page===0&&body.scrollLeft<=2);
  nextButton.disabled=loading||saving||((page+1)*pageSize>=filteredCount&&body.scrollLeft>=max-2);
}
function moveCard(direction) {
  if(loading||saving)return;
  const max=body.scrollWidth-body.clientWidth;
  if((direction<0&&body.scrollLeft<=2)||(direction>0&&body.scrollLeft>=max-2)) {
    if((direction<0&&page===0)||(direction>0&&(page+1)*pageSize>=filteredCount))return;
    page+=direction;void render({resetPosition:true,end:direction<0});return;
  }
  const width=body.querySelector('.sheet-card')?.getBoundingClientRect().width||440;
  body.scrollBy({left:direction*(width+16),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
async function render({resetPosition=false,end=false}={}) {
  referencePreviews.clear();
  rememberScroll();
  const scrollLeft=resetPosition?0:body.scrollLeft;
  const token=++sequence;
  const filtered=rows.filter(r=>!query||[r.draft?.spelling||r.raw.spelling,r.draft?.phrase||r.raw.phrase].some(v=>String(v||'').toLowerCase().includes(query)));
  page=Math.max(0,Math.min(page,Math.ceil(filtered.length/pageSize)-1));
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize);
  loading=true;controls.disabled=true;body.replaceChildren();updateStatus('読み込み中…');
  try {
    // The master has no stored notebook JSON. Read only this page's details, three at a time.
    for(let i=0;i<visible.length;i+=3)await Promise.all(visible.slice(i,i+3).map(async row=>{
      if(row.raw.senses || idiom || row.isNew)return;
      const full=await api(`/words/${encodeURIComponent(row.id)}`);Object.assign(row,record(full));
    }));
    if(token!==sequence)return;
    const cols=columns();filteredCount=filtered.length;
    for(const row of visible){
      const card=node('article',{class:'edit-pane sheet-card'});row.element=card;
      const header=node('header',{class:'pane-header sheet-card-header'});
      const heading=node('div',{class:'sheet-card-heading'});
      if(row.isNew||(idiom&&row.draft.hidden))heading.append(node('span',{class:'sheet-card-number'},row.isNew?'新規':'非表示'));
      row.titleElement=node('h2',{},row.draft.spelling||row.draft.phrase||'新規');
      row.badgeElement=node('span',{class:'sheet-card-badge'});heading.append(row.titleElement,row.badgeElement);
      row.saveElement=button('保存',()=>saveRows([row]),{class:'primary'});
      header.append(heading,row.saveElement,button('戻す',()=>{if(!confirm('このカードの変更を破棄しますか？'))return;if(row.isNew)rows=rows.filter(r=>r!==row);else row.draft=clone(row.base);row.error='';void render();}));
      const form=node('form',{class:'word-form sheet-card-body','aria-label':`${row.draft.spelling||row.draft.phrase||'新規'}の編集`});row.bodyElement=form;
      form.addEventListener('submit',event=>event.preventDefault());
      row.errorElement=node('p',{class:'sheet-error',role:'status'},row.error);form.append(row.errorElement);
      const basics=node('div',{class:'sheet-card-basics'});form.append(basics);
      const basicNames=idiom?['熟語']:['単語','発音記号','注意事項'];
      for(const col of cols){
        const basic=basicNames.includes(col.name);
        const field=node(basic?'div':'fieldset',{'data-fields':col.fields.join(','),class:basic&&['熟語','注意事項'].includes(col.name)?'sheet-basic-wide':''});
        if(!basic)field.append(node('legend',{},col.name));
        col.draw(field,row);(basic?basics:form).append(field);
      }
      card.append(header,form);body.append(card);fitTextFields(form);form.scrollTop=row.scrollTop||0;mark(row);
    }
    if(!visible.length)body.append(node('p',{class:'sheet-empty'},'該当する項目はありません。'));
    pageLabel.textContent=`${filtered.length?page*pageSize+1:0}–${Math.min((page+1)*pageSize,filtered.length)} / ${filtered.length}件`;
    body.scrollLeft=end?body.scrollWidth:scrollLeft;
  } catch(error){if(token===sequence)updateStatus(`読み込みに失敗しました：${error.message}`);return;}
  finally{if(token===sequence){loading=false;controls.disabled=false;sectionSelect.disabled=false;}}
  updateStatus();updateNavigation();
}
async function loadRows() {
  rows=[];page=0;query='';search.value='';loading=true;controls.disabled=true;body.replaceChildren();updateStatus('保存済みの一覧を読み込んでいます…');
  try {
    if(listId==='__master__')rows=index.map(raw=>record(raw));
    else if(idiom){const data=await api(`/lists/${encodeURIComponent(listId)}/editor/idiom-sections/${encodeURIComponent(sectionKey)}`);rows=data.entries.map(raw=>record(raw));}
    else {const data=await api(`/lists/${encodeURIComponent(listId)}/editor/sections/${encodeURIComponent(sectionKey)}?full=1`);rows=data.words.map(raw=>record(raw));}
    await render({resetPosition:true});
  }catch(error){updateStatus(`読み込みに失敗しました：${error.message}`);}finally{loading=false;controls.disabled=false;sectionSelect.disabled=false;saveButton.disabled=!hasChanges();menuControls.querySelectorAll('input,button').forEach(el=>{if(el!==saveButton)el.disabled=false;});}
}
async function loadBook() {
  const referenceToken = ++referenceGeneration;
  loading=true;controls.disabled=true;rows=[];body.replaceChildren();updateStatus('単語帳を読み込んでいます…');
  localStorage.setItem('vocab-setting-last-list',listId);
  try {
    const path=`/lists/${encodeURIComponent(listId)}`;
    if(listId==='__master__'){index=(await api('/master/index')).words;sections=[{key:'none',name:'親リスト'}];labels=[];prepareReferences(index);}
    else if(idiom){const [data,wordIndex]=await Promise.all([api(`${path}/editor/idioms`),api(`${path}/editor/index`)]);wordNames=new Map(wordIndex.words.map(w=>[w.id,w.spelling]));prepareReferences(wordIndex.words,data);index=data.entries;sections=data.chapters.flatMap((c,ci)=>c.sections.map((s,si)=>({...s,name:`Chapter ${ci+1} / Section ${si+1} ${s.subtitle||''}`})));index=sections.flatMap(s=>orderIdiomLabels(index.filter(e=>e.sectionKey===s.key),s.labels));labels=[];}
    else {const [data,ss,ll,chapters]=await Promise.all([api(`${path}/editor/index`),api(`${path}/sections`),api(`${path}/labels`),api(`${path}/chapters`)]);index=data.words;prepareReferences(index);labels=ll;sections=[{key:'none',name:'Sectionなし'},...ss.map((s,i)=>({...s,key:String(s.id),name:`${s.chapterId?'Chapter '+(chapters.findIndex(c=>c.id===s.chapterId)+1)+' / ':''}Section ${i+1} ${s.subtitle||''}`}))];}
    sectionKey=sections.find(s=>index.some(w=>String(w.sectionKey??w.sectionId??'none')===s.key))?.key || sections[0]?.key || '';
    options(sectionSelect,sections.map(s=>[s.key,s.name]),sectionKey);
    if(sectionKey)await loadRows();else updateStatus('編集できるSectionがありません。通常編集でSectionを作成してください。');
    if (!idiom && listId !== '__master__') {
      // References are optional; never block cards or recreate unsaved drafts.
      void api(`${path}/editor/idioms`).then(data => {
        if (referenceToken !== referenceGeneration) return;
        prepareReferences(index,data);
        for (const update of referencePreviews) update();
      }).catch(() => {
        if (referenceToken === referenceGeneration) toast('熟語の参照を読み込めませんでした。カードの編集は続けられます。');
      });
    }
  }catch(error){updateStatus(`読み込みに失敗しました：${error.message}`);}finally{loading=false;controls.disabled=false;sectionSelect.disabled=false;saveButton.disabled=!hasChanges();menuControls.querySelectorAll('input,button').forEach(el=>{if(el!==saveButton)el.disabled=false;});}
}
async function saveRecord(row) {
  const path=`/lists/${encodeURIComponent(listId)}`;
  if(idiom){
    const latest=row.isNew?{}:(await api(`${path}/idioms/sections/${encodeURIComponent(row.base.sectionKey)}`)).entries.find(e=>e.key===row.id);
    if(!latest)throw new Error('この熟語は別の画面で移動または削除されています。再読み込みしてください。');
    const merged=row.isNew?row.draft:mergeDraft(row.base,row.draft,idiomDraft(latest));
    const payload=idiomPayload(merged,latest);
    const result=await api(`${path}/idioms`,{method:'PUT',body:JSON.stringify(payload)});
    return {...payload,key:result.id,meanings:payload.meanings.map(s=>({...s,refs:s.wordIds.map(wordId=>({wordId}))}))};
  }
  if(row.isNew){const payload=wordPayload(row.draft);if(listId!=='__master__')Object.assign(payload,{listId,...(row.draft.no?membershipPayload(row.draft):{sectionId:Number(row.draft.sectionId)||null,labelId:Number(row.draft.labelId)||null})});return api('/words',{method:'POST',body:JSON.stringify(payload)});}
  const latest=await api(`/words/${encodeURIComponent(row.id)}`);
  if(listId!=='__master__'&&!latest.lists.some(l=>l.listId===listId))throw new Error('この単語は単語帳から除外されています。再読み込みしてください。');
  const latestDraft=wordDraft(latest,listId), merged=mergeDraft(row.base,row.draft,latestDraft);
  const changes=changedKeys(latestDraft,merged), membershipFields=['no','sectionId','labelId'];
  const member=listId!=='__master__'&&changes.some(k=>membershipFields.includes(k))?membershipPayload(merged):null;
  let saved=latest;
  if(changes.some(k=>!membershipFields.includes(k)))saved=await api(`/words/${encodeURIComponent(row.id)}`,{method:'PUT',body:JSON.stringify(wordPayload(merged,latest))});
  if(member){
    try{await api(`${path}/items/${encodeURIComponent(row.id)}`,{method:'PUT',body:JSON.stringify(member)});}
    catch(error){error.saved=saved;throw error;}
    // Reflect the confirmed membership without a whole-list reload.
    saved.lists=saved.lists.map(l=>l.listId===listId?{...l,...member,displayNo:member.no}:l);
  }
  return saved;
}
async function confirmPublication(savedRows) {
  const pending = localStorage.getItem(PENDING_KEY);
  const groups = new Map();
  for (const item of savedRows) {
    const section = idiom ? item.row.base.sectionKey : item.row.base.sectionId || 'none';
    const path = `/lists/${encodeURIComponent(listId)}/editor/${idiom ? 'idiom-sections' : 'sections'}/${encodeURIComponent(section)}${idiom ? '' : '?full=1'}`;
    if (!groups.has(path)) groups.set(path, []);
    groups.get(path).push(item);
  }
  // Read each affected JSON section once per attempt, including bulk saves.
  // Retry only reads; successful writes must never be replayed.
  for (let attempt = 0; attempt <= 60; attempt++) {
    let confirmed = true;
    for (const [path, items] of groups) {
      try {
        const data = await api(path, {}, {confirm:true});
        const published = new Map((idiom ? data.entries : data.words).map(raw => [raw.id || raw.key, raw]));
        for (const {row, keys} of items) {
          const raw = published.get(row.id), draft = raw && draftOf(raw);
          if (!draft || keys.some(key => !same(row.base[key], draft[key]))) confirmed = false;
        }
      } catch (error) {
        if (error.code !== 'editor_snapshot_pending') throw error;
        confirmed = false;
        break;
      }
    }
    if (confirmed) {
      if (pending && localStorage.getItem(PENDING_KEY) === pending) localStorage.removeItem(PENDING_KEY);
      return;
    }
    if (attempt < 60) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('一覧への反映に時間がかかっています。時間をおいて再読み込みしてください。');
}
async function saveRows(targets) {
  if(saving||loading)return;
  targets=targets.filter(dirty);if(!targets.length)return;
  saving=true;controls.disabled=true;toggle.disabled=true;const oldToast=document.getElementById('tableToast');if(oldToast)oldToast.hidden=true;updateStatus('保存中…');let successes=0,failed=0,unconfirmed=0;const savedRows=[];
  for(const row of targets){
    try{const keys=row.isNew?Object.keys(row.draft):changedKeys(row.base,row.draft);const saved=await saveRecord(row);const next=record(saved);Object.assign(row,next);savedRows.push({row,keys});if(!index.some(x=>(x.id||x.key)===row.id))index.push(saved);else index=index.map(x=>(x.id||x.key)===row.id?saved:x);if(idiom)index=sections.flatMap(s=>orderIdiomLabels(index.filter(e=>e.sectionKey===s.key),s.labels));successes++;}
    catch(error){if(error.saved){row.raw=error.saved;row.base=draftOf(error.saved);}row.error=`保存できませんでした：${error.message}`;failed++;}
  }
  if(savedRows.length){
    updateStatus('保存内容を確認しています…');
    try{await confirmPublication(savedRows);}
    catch(error){unconfirmed=savedRows.length;for(const {row} of savedRows)row.error=`保存済みですが、一覧への反映を確認できませんでした：${error.message}`;}
  }
  saving=false;toggle.disabled=false;controls.disabled=false;sectionSelect.disabled=false;await render();
  if(!failed&&!unconfirmed)toast('保存しました');
  else if(unconfirmed)updateStatus(`${unconfirmed}件は保存済みですが、一覧への反映確認ができませんでした。${failed?failed+'件は保存に失敗しました。':''}内容はカードに残しています。`);
  else updateStatus(`${successes}件保存しました。${failed}件は保存できませんでした。入力内容を残しています。`);
}
function addRow() {
  if(loading||saving)return;
  const raw=idiom?{sectionKey,phrase:'',meanings:[{meaning:'',refs:[]}]}:{sectionId:sectionKey==='none'?null:Number(sectionKey),spelling:'',senses:[{pos:'',meaning:'',isPrimary:true}],examples:[],derivatives:[],tags:{}};
  rows.unshift(record(raw,true));page=0;query='';search.value='';void render({resetPosition:true});
}
async function loadCatalog() {
  loading=true;options(sectionSelect,[['','読み込み中…']]);updateStatus('単語帳を読み込んでいます…');
  try {
    books=(await api('/lists')).filter(b=>b.isNotebook);
    const crossover=books.find(b=>b.id==='crossover-v3')||books.find(b=>b.name?.trim().toLowerCase()==='crossover');
    if(crossover){listId=crossover.id;await loadBook();}
    else {loading=false;updateStatus('crossoverの単語帳が見つかりません。');}
  } catch(error) {
    loading=false;options(sectionSelect,[['','読み込みできませんでした']]);updateStatus(`読み込みに失敗しました：${error.message}`);
  }
}
async function start() {
  document.body.classList.add('card-edit-mode');
  document.querySelector('.word-table-pane').hidden=true;
  const header=document.querySelector('.topbar-row--primary');
  const menu=node('div',{id:'cardHeaderMenu',class:'sheet-header-menu'});
  const menuToggle=button('メニュー',()=>{const open=menuToggle.getAttribute('aria-expanded')!=='true';menuToggle.setAttribute('aria-expanded',String(open));menu.classList.toggle('is-open',open);},{class:'sheet-mobile-menu-toggle','aria-expanded':'false','aria-controls':'cardHeaderMenu'});
  for(const item of [...header.querySelectorAll('.viewer-link,#themeToggleBtn,#editModeToggle')])menu.append(item);
  header.append(menuToggle,menu);
  const closeMenu=()=>{menu.classList.remove('is-open');menuToggle.setAttribute('aria-expanded','false');};
  document.addEventListener('click',event=>{if(!header.contains(event.target))closeMenu();});
  header.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMenu();menuToggle.focus();}});
  pane=node('section',{class:'sheet-pane','aria-label':idiom?'熟語のカード編集':'単語のカード編集'});
  controls=node('fieldset',{style:'border:0;padding:0;margin:0;min-width:0;display:contents'});
  sectionSelect=node('select',{'aria-label':'カードで編集するSection'});search=node('input',{type:'search',placeholder:idiom?'このSectionの熟語を検索':'このSectionの単語を検索','aria-label':'カードを検索'});
  saveButton=button('変更を保存',()=>saveRows(rows),{class:'primary'});saveButton.disabled=true;
  status=node('span',{class:'sheet-status',role:'status','aria-live':'polite'});
  const extras=node('div',{id:'cardEditorTools',class:'sheet-extra-tools'});menuControls=extras;
  extras.append(search,button(idiom?'＋熟語':'＋単語',addRow),saveButton,button('再読み込み',()=>{if(guardNavigation())void (listId?loadBook():loadCatalog());}));
  header.insertBefore(sectionSelect,menuToggle);
  menu.append(extras);
  pane.append(status);
  const nav=node('div',{class:'sheet-toolbar sheet-navigation'});prevButton=button('← 前のカード',()=>moveCard(-1));nextButton=button('次のカード →',()=>moveCard(1));pageLabel=node('span');nav.append(prevButton,pageLabel,nextButton);menu.append(nav);
  body=node('div',{class:'sheet-card-rail','aria-label':idiom?'熟語カード一覧':'単語カード一覧'});
  body.addEventListener('scroll',updateNavigation,{passive:true});window.addEventListener('resize',()=>{fitTextFields();updateNavigation();});
  document.fonts?.ready.then(()=>fitTextFields());
  controls.append(body);pane.append(controls);document.querySelector('main').append(pane);
  sectionSelect.addEventListener('change',()=>{if(loading||saving){sectionSelect.value=sectionKey;return;}if(guardNavigation()){sectionKey=sectionSelect.value;void loadRows();}else sectionSelect.value=sectionKey;});
  let timer;search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{query=search.value.trim().toLowerCase();page=0;void render({resetPosition:true});},200);});
  await loadCatalog();
}
if(tableMode)void start().catch(error=>{loading=false;if(status){options(sectionSelect,[['','読み込みできませんでした']]);updateStatus(`読み込みに失敗しました：${error.message}`);}else console.error(error);});
