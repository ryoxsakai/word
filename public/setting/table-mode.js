import { EDITOR_API_BASE } from '../shared/config.js';
import { editorFetch } from './auth.js';
import { orderIdiomLabels } from '../shared/idioms.js';
import { clone, same, changedKeys, mergeDraft, wordDraft, idiomDraft, wordPayload, idiomPayload, membershipPayload, cautions } from './table-data.js';

const MODE_KEY = 'vocab-setting-edit-mode';
const PENDING_KEY = 'vocab-editor-pending-publication';
const idiom = location.pathname.endsWith('idioms.html');
const toggle = document.getElementById('editModeToggle');
const tableMode = localStorage.getItem(MODE_KEY) === 'table';
let rows = [], sections = [], labels = [], index = [], books = [], page = 0, loading = false, saving = false;
let listId = '', sectionKey = '', query = '', sequence = 0;
let wordNames = new Map();
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
async function api(path, options = {}) {
  const read = !options.method || options.method === 'GET';
  const pending = localStorage.getItem(PENDING_KEY);
  if (read && pending) path += `${path.includes('?') ? '&' : '?'}editorFresh=1`;
  for (let attempt = 0; ; attempt++) {
    const response = await editorFetch(`${EDITOR_API_BASE}/api${path}`, { ...options, headers: {'content-type':'application/json'}, cache:'no-store' });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      if (read && data?.code === 'editor_snapshot_pending' && attempt < 60) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    if (!read) localStorage.setItem(PENDING_KEY, crypto.randomUUID());
    else if (pending && response.headers.get('x-editor-source') === 'r2' && localStorage.getItem(PENDING_KEY) === pending) localStorage.removeItem(PENDING_KEY);
    return data;
  }
}
function toast(message) {
  let el = document.getElementById('tableToast');
  if (!el) { el = node('div', {id:'tableToast',class:'toast',role:'status','aria-live':'polite'}); document.body.append(el); }
  el.textContent = message; el.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 2800);
}
toggle.textContent = tableMode ? '通常編集に切替' : '表形式に切替';
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

let pane, controls, bookSelect, sectionSelect, search, status, body, head, saveButton, prevButton, nextButton, pageLabel;
function updateStatus(message) {
  status.textContent = message || `${rows.length}件 · 未保存 ${rows.filter(dirty).length}件`;
  saveButton.disabled = loading || saving || !hasChanges();
}
function guardNavigation() { return !saving && (!hasChanges() || confirm('未保存の変更を破棄して移動しますか？')); }
function options(select, items, selected) {
  select.replaceChildren(...items.map(([value, name]) => node('option', {value}, name)));
  select.value = selected ?? items[0]?.[0] ?? '';
}
function textField(container, row, key, title, {type='text', choices, multiline=false, onChange} = {}) {
  const label = node('label', {}, title);
  const input = node(choices ? 'select' : multiline ? 'textarea' : 'input', {'aria-label':title});
  if (choices) options(input, choices, String(row.draft[key] ?? ''));
  else if (type === 'checkbox') { input.type = 'checkbox'; input.checked = !!row.draft[key]; label.className = 'sheet-check'; }
  else { if (!multiline) input.type = type; input.value = row.draft[key] ?? ''; if (multiline) input.rows = 3; }
  input.addEventListener(choices || type === 'checkbox' ? 'change' : 'input', () => {
    row.draft[key] = type === 'checkbox' ? input.checked : input.value;
    if (onChange) onChange();
    mark(row);
  });
  label.append(input); container.append(label); return input;
}
function mark(row) {
  row.element?.querySelectorAll('td[data-fields]').forEach(cell => {
    cell.classList.toggle('is-dirty', row.isNew || cell.dataset.fields.split(',').some(k => !same(row.base[k], row.draft[k])));
  });
  updateStatus();
}
const pos = [['','—'], ...['名','自','他','動','形','副','代','冠','前','接','間','助','熟','連'].map(s=>[s,s])];
function repeat(container, row, key, fields, empty, max = Infinity) {
  const list = node('div');
  function render() {
    list.replaceChildren();
    row.draft[key].forEach((item, i) => {
      const box = node('div', {class:'sheet-repeat'});
      for (const [field, title, config = {}] of fields) {
        const proxy = {draft:item};
        const fieldConfig = {...config, onChange:() => {
          if (field === 'is_primary' && item.is_primary) { row.draft[key].forEach((s,n)=>{if(n!==i)s.is_primary=false;}); render(); }
          mark(row);
        }};
        // Retain uncommon existing part-of-speech values instead of silently blanking them.
        if (fieldConfig.choices && item[field] && !fieldConfig.choices.some(([v])=>v===item[field])) fieldConfig.choices = [...fieldConfig.choices,[item[field],item[field]]];
        textField(box, proxy, field, title, fieldConfig);
      }
      if (key === 'meanings' && item.wordIds.length) box.append(node('p', {class:'sheet-readonly'}, '単語参照：' + item.wordIds.map(id => wordNames.get(id) || '登録済みの参照').join('、')));
      const actions = node('div', {class:'sheet-repeat-actions'}); actions.append(node('span',{},String(i+1)));
      const move = offset => { const to=i+offset; if(to<0||to>=row.draft[key].length)return; [row.draft[key][i],row.draft[key][to]]=[row.draft[key][to],row.draft[key][i]];render();mark(row); };
      const up=button('↑',()=>move(-1),{'aria-label':`${i+1}番目を上へ`}); up.disabled=i===0;
      const down=button('↓',()=>move(1),{'aria-label':`${i+1}番目を下へ`});down.disabled=i===row.draft[key].length-1;
      actions.append(up,down,button('削除',()=>{row.draft[key].splice(i,1);render();mark(row);}));box.append(actions);list.append(box);
    });
  }
  render();container.append(list,button('＋追加',()=>{if(row.draft[key].length>=max)return;row.draft[key].push(clone(empty));render();mark(row);}));
}
function columns() {
  const sectionChoices = idiom ? sections.map(s=>[s.key,s.name]) : [['','Sectionなし'],...sections.filter(s=>s.key!=='none').map(s=>[s.key,s.name])];
  const fieldCol = (name,key,config={}) => ({name,fields:[key],draw:(td,row)=>textField(td,row,key,name,config)});
  const placement = {name:'Section・Label',fields:idiom?['sectionKey','labelKey']:['sectionId','labelId'],draw(td,row){
    const sectionField=idiom?'sectionKey':'sectionId', labelField=idiom?'labelKey':'labelId';
    const labelBox=node('div');
    const drawLabels=()=>{labelBox.replaceChildren();const choices=idiom?(sections.find(s=>s.key===row.draft[sectionField])?.labels||[]).map(l=>[l.key,l.name]):labels.filter(l=>String(l.sectionId)===row.draft.sectionId).map(l=>[String(l.id),l.name]);textField(labelBox,row,labelField,'Label',{choices:[['','なし'],...choices]});};
    textField(td,row,sectionField,'Section',{choices:sectionChoices,onChange:()=>{row.draft[labelField]='';drawLabels();}});td.append(labelBox);drawLabels();
  }};
  if(idiom)return [fieldCol('熟語','phrase'),placement,fieldCol('別形（1行に1つ）','alternateForms',{multiline:true}),
    {name:'意味・単語参照',wide:true,fields:['meanings'],draw:(td,row)=>repeat(td,row,'meanings',[['meaning','意味',{multiline:true}]],{meaning:'',wordIds:[]},30)},
    ...['synonyms','antonyms','notes'].map((k,i)=>fieldCol(['同義語','対義語','メモ'][i],k,{multiline:true})),fieldCol('閲覧から非表示','hidden',{type:'checkbox'})];
  const wordColumns = [fieldCol('単語','spelling'),fieldCol('発音記号','pronunciation'),...(listId==='__master__'?[]:[placement]),fieldCol('派生元','derivedFrom'),
    {name:'品詞・意味',wide:true,fields:['senses'],draw:(td,row)=>repeat(td,row,'senses',[['pos','品詞',{choices:pos}],['meaning','意味',{multiline:true}],['pronunciation','品詞ごとの発音'],['is_primary','見出しの意味',{type:'checkbox'}]],{pos:'',meaning:'',pronunciation:'',is_primary:row.draft.senses.length===0})},
    {name:'例文・フレーズ',wide:true,fields:['examples'],draw:(td,row)=>repeat(td,row,'examples',[['type','種類',{choices:[['example','例文'],['phrase','フレーズ']]}],['sentence','英文',{multiline:true}],['translation','日本語訳',{multiline:true}]],{type:'phrase',sentence:'',translation:'',answer:''})},
    {name:'派生語',wide:true,fields:['derivatives'],draw:(td,row)=>repeat(td,row,'derivatives',[['word','派生語'],['pos','品詞',{choices:pos}],['meaning','意味',{multiline:true}]],{word:'',pos:'',meaning:''})},
    ...['irregularForms','synonyms','antonyms','relatedWords','etymology','notes'].map((k,i)=>fieldCol(['不規則活用','類義語','対義語','関連語','語源','メモ'][i],k,{multiline:true})),
    {name:'レベル・タグ',fields:['oxford5000','cefr_provisional','awl','eiken','custom'],draw(td,row){
      textField(td,row,'oxford5000','Oxford 5000',{choices:[['','—'],...['A1','A2','B1','B2','C1'].map(s=>[s,s])]});
      textField(td,row,'cefr_provisional','暫定CEFR',{choices:[['','—'],...['A1','A2','B1','B2','C1','C2'].map(s=>[s,s])]});
      textField(td,row,'awl','AWL',{choices:[['','—'],...Array.from({length:10},(_,i)=>[String(i+1),String(i+1)])]});
      textField(td,row,'eiken','英検',{choices:[['','—'],...['5級','4級','3級','準2級','2級','準1級','1級'].map(s=>[s,s])]});
      textField(td,row,'custom','カスタムタグ（カンマ区切り）');
      for(const key of ['target1900','target1400'])if(row.raw.tags?.[key])td.append(node('p',{class:'sheet-readonly'},`${key}: ${row.raw.tags[key]}`));
    }},
    {name:'注意事項',fields:cautions,draw(td,row){cautions.forEach((key,i)=>textField(td,row,key,['能格','スペル注意','発音注意','アクセント注意','多義語','活用注意','語法注意'][i],{type:'checkbox'}));}},
  ];
  const first = ['単語','発音記号','品詞・意味','例文・フレーズ','派生語','Section・Label','派生元'];
  return wordColumns.sort((a,b)=>(first.includes(a.name)?first.indexOf(a.name):100)-(first.includes(b.name)?first.indexOf(b.name):100));
}
function record(raw, isNew=false) {const draft=draftOf(raw);return {id:raw.id||raw.key||crypto.randomUUID(),raw,base:clone(draft),draft,isNew,error:''};}
async function render() {
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
    const cols=columns();head.replaceChildren();const header=node('tr');header.append(node('th',{},'No. / 保存'));for(const col of cols)header.append(node('th',{class:col.wide?'sheet-wide':''},col.name));head.append(header);
    for(const row of visible){
      const tr=node('tr');row.element=tr;const number=node('td',{'data-fields':'no'});
      if(!idiom&&listId!=='__master__')textField(number,row,'no','No.');else number.append(node('strong',{},row.isNew?'新規':(idiom&&row.draft.hidden?'—':String(index.filter(x=>!idiom||!x.hidden).findIndex(x=>(x.id||x.key)===row.id)+1))));
      const actions=node('div',{class:'sheet-actions'});actions.append(button('保存',()=>saveRows([row])),button('戻す',()=>{if(!confirm('この行の変更を破棄しますか？'))return;if(row.isNew)rows=rows.filter(r=>r!==row);else row.draft=clone(row.base);void render();}));
      row.errorElement=node('p',{class:'sheet-error',role:'status'},row.error);number.append(actions,row.errorElement);tr.append(number);
      for(const col of cols){const td=node('td',{class:col.wide?'sheet-wide':'','data-fields':col.fields.join(',')});col.draw(td,row);tr.append(td);}
      body.append(tr);mark(row);if(row.error)row.errorElement.textContent=row.error;
    }
    if(!visible.length){const tr=node('tr'),td=node('td',{colspan:String(cols.length+1)},'該当する項目はありません。');tr.append(td);body.append(tr);}
    pageLabel.textContent=`${filtered.length? page+1:0} / ${Math.ceil(filtered.length/pageSize)}ページ（${filtered.length}件）`;
    prevButton.disabled=page===0;nextButton.disabled=(page+1)*pageSize>=filtered.length;
  } catch(error){if(token===sequence)updateStatus(`読み込みに失敗しました：${error.message}`);return;}
  finally{if(token===sequence){loading=false;controls.disabled=false;}}
  updateStatus();
}
async function loadRows() {
  rows=[];page=0;query='';search.value='';loading=true;controls.disabled=true;body.replaceChildren();updateStatus('保存済みの一覧を読み込んでいます…');
  try {
    if(listId==='__master__')rows=index.map(raw=>record(raw));
    else if(idiom){const data=await api(`/lists/${encodeURIComponent(listId)}/editor/idiom-sections/${encodeURIComponent(sectionKey)}`);rows=data.entries.map(raw=>record(raw));}
    else {const data=await api(`/lists/${encodeURIComponent(listId)}/editor/sections/${encodeURIComponent(sectionKey)}?full=1`);rows=data.words.map(raw=>record(raw));}
    await render();
  }catch(error){updateStatus(`読み込みに失敗しました：${error.message}`);}finally{loading=false;controls.disabled=false;saveButton.disabled=!hasChanges();}
}
async function loadBook() {
  listId=bookSelect.value;loading=true;controls.disabled=true;rows=[];body.replaceChildren();updateStatus('単語帳を読み込んでいます…');
  localStorage.setItem('vocab-setting-last-list',listId);
  try {
    const path=`/lists/${encodeURIComponent(listId)}`;
    if(listId==='__master__'){index=(await api('/master/index')).words;sections=[{key:'none',name:'親リスト'}];labels=[];}
    else if(idiom){const [data,wordIndex]=await Promise.all([api(`${path}/editor/idioms`),api(`${path}/editor/index`)]);wordNames=new Map(wordIndex.words.map(w=>[w.id,w.spelling]));index=data.entries;sections=data.chapters.flatMap((c,ci)=>c.sections.map((s,si)=>({...s,name:`Chapter ${ci+1} / Section ${si+1} ${s.subtitle||''}`})));index=sections.flatMap(s=>orderIdiomLabels(index.filter(e=>e.sectionKey===s.key),s.labels));labels=[];}
    else {const [data,ss,ll,chapters]=await Promise.all([api(`${path}/editor/index`),api(`${path}/sections`),api(`${path}/labels`),api(`${path}/chapters`)]);index=data.words;labels=ll;sections=[{key:'none',name:'Sectionなし'},...ss.map((s,i)=>({...s,key:String(s.id),name:`${s.chapterId?'Chapter '+(chapters.findIndex(c=>c.id===s.chapterId)+1)+' / ':''}Section ${i+1} ${s.subtitle||''}`}))];}
    sectionKey=sections.find(s=>index.some(w=>String(w.sectionKey??w.sectionId??'none')===s.key))?.key || sections[0]?.key || '';
    options(sectionSelect,sections.map(s=>[s.key,s.name]),sectionKey);
    if(sectionKey)await loadRows();else updateStatus('編集できるSectionがありません。通常編集でSectionを作成してください。');
  }catch(error){updateStatus(`読み込みに失敗しました：${error.message}`);}finally{loading=false;controls.disabled=false;saveButton.disabled=!hasChanges();}
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
async function saveRows(targets) {
  if(saving||loading)return;
  targets=targets.filter(dirty);if(!targets.length)return;
  saving=true;controls.disabled=true;toggle.disabled=true;const oldToast=document.getElementById('tableToast');if(oldToast)oldToast.hidden=true;updateStatus('保存中…');let successes=0,failed=0;
  for(const row of targets){
    try{const saved=await saveRecord(row);const next=record(saved);Object.assign(row,next);if(!index.some(x=>(x.id||x.key)===row.id))index.push(saved);else index=index.map(x=>(x.id||x.key)===row.id?saved:x);if(idiom)index=sections.flatMap(s=>orderIdiomLabels(index.filter(e=>e.sectionKey===s.key),s.labels));successes++;}
    catch(error){if(error.saved){row.raw=error.saved;row.base=draftOf(error.saved);}row.error=`保存できませんでした：${error.message}`;failed++;}
  }
  saving=false;toggle.disabled=false;controls.disabled=false;await render();
  if(!failed)toast('保存しました');else updateStatus(`${successes}件保存しました。${failed}件は保存できませんでした。入力内容を残しています。`);
}
function addRow() {
  if(loading||saving)return;
  const raw=idiom?{sectionKey,phrase:'',meanings:[{meaning:'',refs:[]}]}:{sectionId:sectionKey==='none'?null:Number(sectionKey),spelling:'',senses:[{pos:'',meaning:'',isPrimary:true}],examples:[],derivatives:[],tags:{}};
  rows.unshift(record(raw,true));page=0;query='';search.value='';void render();
}
async function start() {
  document.querySelector('.word-table-pane').hidden=true;
  pane=node('section',{class:'sheet-pane','aria-label':idiom?'熟語の表形式編集':'単語の表形式編集'});
  controls=node('fieldset',{style:'border:0;padding:0;margin:0;min-width:0;display:contents'});
  const toolbar=node('div',{class:'sheet-toolbar'});
  bookSelect=node('select',{'aria-label':'表で編集する単語帳'});sectionSelect=node('select',{'aria-label':'表で編集するSection'});search=node('input',{type:'search',placeholder:idiom?'このSectionの熟語を検索':'このSectionの単語を検索','aria-label':'表を検索'});
  saveButton=button('変更を保存',()=>saveRows(rows),{class:'primary'});saveButton.disabled=true;
  status=node('span',{class:'sheet-status',role:'status','aria-live':'polite'});
  toolbar.append(bookSelect,sectionSelect,search,button(idiom?'＋熟語':'＋単語',addRow),saveButton,button('再読み込み',()=>{if(guardNavigation())void loadBook();}),status);
  const nav=node('div',{class:'sheet-toolbar'});prevButton=button('前へ',()=>{page--;void render();});nextButton=button('次へ',()=>{page++;void render();});pageLabel=node('span');nav.append(prevButton,pageLabel,nextButton,node('span',{class:'sheet-readonly'},'横にスクロールして全項目を編集できます。黄色のセルは未保存です。'));
  const scroll=node('div',{class:'sheet-scroll'}),table=node('table',{class:'sheet-table'});head=node('thead');body=node('tbody');table.append(head,body);scroll.append(table);controls.append(toolbar,nav,scroll);pane.append(controls);document.querySelector('main').append(pane);
  bookSelect.addEventListener('change',()=>{if(guardNavigation())void loadBook();else bookSelect.value=listId;});
  sectionSelect.addEventListener('change',()=>{if(guardNavigation()){sectionKey=sectionSelect.value;void loadRows();}else sectionSelect.value=sectionKey;});
  let timer;search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{query=search.value.trim().toLowerCase();page=0;void render();},200);});
  books=(await api('/lists')).filter(b=>b.isNotebook||(!idiom&&b.isMaster));
  const preferred=new URLSearchParams(location.search).get('list')||localStorage.getItem('vocab-setting-last-list')||'crossover-v3';
  options(bookSelect,books.map(b=>[b.id,b.name]),books.find(b=>b.id===preferred)?.id||books.find(b=>b.isNotebook)?.id||books[0]?.id);
  if(books.length)await loadBook();else updateStatus('編集できる単語帳がありません。');
}
if(tableMode)void start().catch(error=>{if(status)updateStatus(`読み込みに失敗しました：${error.message}`);else console.error(error);});
