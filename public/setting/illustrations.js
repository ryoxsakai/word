import { EDITOR_API_BASE, VIEWER_API_BASE } from '../shared/config.js';
import { editorFetch } from './auth.js';

const API = `${EDITOR_API_BASE || '/mcp-editor'}/api/illustrations`;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const imageUrl = path => new URL(path, VIEWER_API_BASE || location.origin).href;
const stateLabel = { queued:'生成待ち', processing:'生成中', ready:'生成済み', failed:'生成失敗', cancelled:'取り消し済み' };
let index, detail, currentWordId, busy = false, loading = 0, detailLoading = 0;
let pendingBatch = null;
let uploadData = null, uploadVersion = 0, pendingImport = null, approvedCurrentId = null;
const selected = new Set();

async function api(path = '', options = {}) {
  const response = await editorFetch(API + path, { ...options,
    headers: { 'content-type':'application/json', ...options.headers }, cache:'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || body.error || '処理に失敗しました');
  return body;
}

function selectionChanged() {
  $('generateSelected').textContent = `選択した${selected.size}語をAPI生成（別料金）`;
  $('generateSelected').disabled = busy || !index?.config.ready || !selected.size;
}

async function loadIndex(quiet = false) {
  const sequence = ++loading;
  const sectionId = $('section').value;
  try {
    const result = await api(sectionId ? `?sectionId=${encodeURIComponent(sectionId)}` : '');
    if (sequence !== loading) return;
    index = result;
    if (!$('section').options.length) {
      $('section').innerHTML = index.sections.map((s,i) => `<option value="${s.id}">Section ${i+1} ${esc(s.subtitle)}</option>`).join('') + '<option value="none">未所属</option>';
      $('section').value = String(index.sectionId ?? 'none');
    }
    $('configuration').hidden = index.config.importReady;
    $('configuration').textContent = '画像の保存先が未設定です。設定後に画像を登録できます。';
    const availableIds = new Set(index.words.filter(w => !['queued','processing'].includes(w.status)).map(w => w.id));
    for (const id of selected) if (!availableIds.has(id)) selected.delete(id);
    $('words').innerHTML = index.words.map(w => `<article class="word-card">
      <label><input type="checkbox" data-word="${esc(w.id)}" ${selected.has(w.id)?'checked':''} ${['queued','processing'].includes(w.status)?'disabled':''}>
      ${esc(w.spelling)} <small>${w.no}${w.branch?'-'+w.branch:''}</small></label>
      ${w.url ? `<img src="${esc(imageUrl(w.url))}" alt="${esc(w.meaning || w.spelling)}のイラスト" width="200" height="200" loading="lazy">` : '<div class="placeholder">イラスト未作成</div>'}
      <p class="state">${esc(stateLabel[w.status] || '未作成')}${w.url && w.status !== 'ready'?'・現在の画像を表示中':''}</p>
      ${w.error?`<p class="error">${esc(w.error)}</p>`:''}
      <button type="button" data-open="${esc(w.id)}">画像の登録・指示・履歴</button></article>`).join('') || '<p>このSectionには単語がありません。</p>';
    selectionChanged();
    if (!quiet) $('status').textContent = `${index.words.length}語 · 生成待ち ${index.counts.find(c=>c.status==='queued')?.count || 0}件 · 処理中 ${index.counts.find(c=>c.status==='processing')?.count || 0}件`;
  } catch(e) { $('status').textContent = e.message; }
}

function renderHistory() {
  const active = detail.history.some(j=>['queued','processing'].includes(j.status));
  $('generateWord').disabled = busy || active || !index?.config.ready;
  $('copyPrompt').disabled = busy;
  $('importWord').disabled = busy || active || !index?.config.importReady || !uploadData || !$('uploadApproved').checked || !$('uploadPrompt').value.trim();
  for (const id of ['uploadFile','uploadApproved','uploadPrompt','sense','scene','avoid']) $(id).disabled = busy;
  $('history').innerHTML = detail.history.map(j => `<section class="history-item">
    ${j.url ? `<img src="${esc(imageUrl(j.url))}" alt="${esc(j.meaning)}" width="130" height="130">` : '<div></div>'}
    <div><p><strong>${j.id===detail.currentId?'表示中':esc(stateLabel[j.status])}</strong> · ${esc(j.meaning)}</p>
    <p>${j.source==='approved-upload'?'承認済み画像の取り込み':'API生成'} · ${esc(j.createdAt)} UTC</p>${j.error?`<p class="error">${esc(j.error)}</p>`:''}
    ${j.url && j.id!==detail.currentId?`<button type="button" data-restore="${j.id}" ${active || busy?'disabled':''}>この画像に戻す</button>`:''}
    ${j.status==='queued'?`<button type="button" data-cancel="${j.id}" ${busy?'disabled':''}>依頼を取り消す</button>`:''}</div>
    <details><summary>生成時の指示</summary><pre>${esc(j.prompt)}</pre><p>${esc(j.promptVersion)} · ${esc(j.model)} · ${esc(j.quality)} · PNG</p></details>
    </section>`).join('') || '<p class="hint">まだ生成履歴がありません。</p>';
}

async function openDetail(wordId) {
  const sequence = ++detailLoading;
  try {
    const result = await api(`/words/${encodeURIComponent(wordId)}`);
    if (sequence !== detailLoading) return;
    detail = result;
    currentWordId = wordId;
    ++uploadVersion; uploadData=null; pendingImport=null;
    $('uploadFile').value=''; $('uploadPrompt').value=''; $('uploadApproved').checked=false;
    $('uploadPreview').hidden=true; $('uploadPreview').removeAttribute('src');
    $('detailTitle').textContent = detail.word.spelling;
    $('sense').innerHTML = detail.word.senses.map((s,i) => `<option value="${i}">${esc(s.pos)} ${esc(s.meaning)}</option>`).join('');
    const selectedSense = detail.word.senses.findIndex(s=>(s.pos || '')===detail.brief.pos && s.meaning===detail.brief.meaning);
    $('sense').value = String(selectedSense >= 0 ? selectedSense : 0);
    $('scene').value = detail.brief.scene;
    $('avoid').value = detail.brief.avoid;
    $('detailStatus').textContent = selectedSense < 0 ? '登録語義が変わっています。描く語義と場面を確認してください。' : '';
    renderHistory();
    $('detail').showModal();
  } catch(e) { $('status').textContent=e.message; }
}

async function saveBrief() {
  const sense = detail.word.senses[Number($('sense').value)];
  if (!sense) throw new Error('描く語義を選択してください');
  await api(`/words/${encodeURIComponent(currentWordId)}/brief`, { method:'PUT', body:JSON.stringify({
    pos:sense.pos || '', meaning:sense.meaning, scene:$('scene').value, avoid:$('avoid').value,
  }) });
}

$('copyPrompt').onclick=()=>withBusy(async()=>{
  $('uploadApproved').checked=false; pendingImport=null;
  await saveBrief();
  detail=await api(`/words/${encodeURIComponent(currentWordId)}`);
  const text=`${detail.suggestedPrompt}\n\n生成した画像をまずチャットに表示してください。私がこの画像にOKするまではcrossoverに登録しないでください。`;
  $('uploadPrompt').value=text;
  try { await navigator.clipboard.writeText(text); $('detailStatus').textContent='プロンプトをコピーしました。チャットに貼り付け、見本画像も添付して生成してください。'; }
  catch { $('detailStatus').textContent='下のプロンプト欄からコピーしてチャットに貼り付けてください。'; }
},'detailStatus');
$('uploadFile').onchange=async()=>{
  const version=++uploadVersion, file=$('uploadFile').files[0];
  uploadData=null; pendingImport=null; $('uploadApproved').checked=false;
  $('uploadPreview').hidden=true; $('uploadPreview').removeAttribute('src'); renderHistory();
  if(!file)return;
  if(file.size>8*1024*1024) { $('detailStatus').textContent='PNG画像を8MB以下で選んでください。'; return; }
  try {
    const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('画像を読み込めません'));r.readAsDataURL(file);});
    const image=new Image(); image.src=url; await image.decode();
    if(version!==uploadVersion)return;
    if(image.naturalWidth<32 || image.naturalHeight<32 || image.naturalWidth>4096 || image.naturalHeight>4096)throw new Error('画像の縦横は32〜4096pxにしてください');
    uploadData=url.slice(url.indexOf(',')+1);
    $('uploadPreview').src=url; $('uploadPreview').hidden=false;
    $('detailStatus').textContent='画像と対象語義を確認し、OKのチェックを入れてください。';
    renderHistory();
  } catch(e) { if(version===uploadVersion)$('detailStatus').textContent=e.message || 'PNGを読み込めません'; }
};
$('uploadApproved').onchange=()=>{
  if($('uploadApproved').checked && pendingImport && detail.currentId!==pendingImport.expectedCurrentId
    && detail.currentId!==pendingImport.requestId) pendingImport=null;
  approvedCurrentId=detail.currentId; renderHistory();
};
for(const id of ['uploadPrompt','sense','scene','avoid']) $(id).addEventListener('input',()=>{
  $('uploadApproved').checked=false; pendingImport=null; renderHistory();
});
$('importWord').onclick=()=>withBusy(async()=>{
  if(!uploadData || !$('uploadApproved').checked)throw new Error('登録する画像のOKを確認してください');
  const sense=detail.word.senses[Number($('sense').value)];
  if(!sense)throw new Error('描く語義を選択してください');
  if(!pendingImport)pendingImport={requestId:crypto.randomUUID(),approved:true,expectedCurrentId:approvedCurrentId,
    pos:sense.pos || '',meaning:sense.meaning,scene:$('scene').value,avoid:$('avoid').value,prompt:$('uploadPrompt').value,imageBase64:uploadData};
  const result=await api(`/words/${encodeURIComponent(currentWordId)}/import`,{method:'POST',body:JSON.stringify(pendingImport)});
  pendingImport=null; $('uploadApproved').checked=false;
  detail=await api(`/words/${encodeURIComponent(currentWordId)}`);
  $('detailStatus').textContent=result.current?'承認した画像を登録しました。単語帳を再読み込みすると表示されます。':'この画像は登録済みです。現在の表示画像は履歴で確認してください。';
  await loadIndex(true);
},'detailStatus');

async function queueWords(wordIds) {
  // Keep these IDs if the connection fails; retrying must not enqueue a second paid job.
  const key = [...wordIds].sort().join('\n');
  if (!pendingBatch || pendingBatch.key!==key) pendingBatch={key,items:wordIds.map(wordId=>({wordId,requestId:crypto.randomUUID()}))};
  const result = await api('/jobs', { method:'POST', body:JSON.stringify({items:pendingBatch.items}) });
  pendingBatch=null;
  const failed = result.results.filter(r=>r.error);
  $('status').textContent = `${result.results.length-failed.length}語を受け付けました。${failed.map(r=>`${r.wordId}: ${r.error}`).join(' / ')}`;
  for (const row of result.results) if (!row.error) selected.delete(row.wordId);
  return failed;
}

async function withBusy(action, target='status') {
  if (busy) return;
  busy=true;
  selectionChanged();
  if (detail) renderHistory();
  try { await action(); } catch(e) { $(target).textContent=e.message; }
  finally { busy=false; selectionChanged(); if (detail) renderHistory(); }
}

$('words').addEventListener('change', e=>{
  const id=e.target.dataset.word;
  if (!id) return;
  if (e.target.checked && selected.size>=20) { e.target.checked=false; $('status').textContent='1回に選択できるのは20語までです。'; return; }
  e.target.checked ? selected.add(id) : selected.delete(id); selectionChanged();
});
$('words').addEventListener('click', e=>{ const button=e.target.closest('[data-open]'); if(button && !busy) openDetail(button.dataset.open); });
$('selectMissing').onclick=()=>{ selected.clear(); for(const w of (index?.words || []).filter(w=>!w.url && !['queued','processing'].includes(w.status)).slice(0,20)) selected.add(w.id); loadIndex(); };
$('section').onchange=()=>{ selected.clear(); loadIndex(); };
$('refresh').onclick=()=>loadIndex();
$('closeDetail').onclick=()=>{ if(!busy) { ++detailLoading; $('detail').close(); currentWordId=null; } };
$('detail').addEventListener('cancel',e=>{ if(busy)e.preventDefault(); else { ++detailLoading; currentWordId=null; } });
$('generateSelected').onclick=()=>withBusy(async()=>{ await queueWords([...selected]); await loadIndex(true); });
$('briefForm').onsubmit=e=>{e.preventDefault(); withBusy(async()=>{await saveBrief(); $('detailStatus').textContent='生成指示を保存しました。';},'detailStatus');};
$('generateWord').onclick=()=>withBusy(async()=>{
  await saveBrief();
  const failed=await queueWords([currentWordId]);
  $('detailStatus').textContent=failed.length?failed[0].error:'生成を受け付けました。完成したら単語帳へ自動で反映します。';
  detail=await api(`/words/${encodeURIComponent(currentWordId)}`);
  await loadIndex(true);
},'detailStatus');
$('history').onclick=e=>{
  const restore=e.target.closest('[data-restore]'), cancel=e.target.closest('[data-cancel]');
  if(!restore && !cancel)return;
  withBusy(async()=>{
    if(restore) await api(`/words/${encodeURIComponent(currentWordId)}/restore`,{method:'POST',body:JSON.stringify({jobId:restore.dataset.restore})});
    if(cancel) await api(`/jobs/${cancel.dataset.cancel}/cancel`,{method:'POST',body:'{}'});
    detail=await api(`/words/${encodeURIComponent(currentWordId)}`);
    $('detailStatus').textContent=restore?'表示する画像を戻しました。':'依頼を取り消しました。';
    await loadIndex();
  },'detailStatus');
};

await loadIndex();
setInterval(async()=>{
  if(document.hidden || busy)return;
  await loadIndex(true);
  if($('detail').open && currentWordId) {
    const wordId=currentWordId;
    try { const next=await api(`/words/${encodeURIComponent(wordId)}`);
      // Keep the form's original sense ordering; the server rejects stale meanings on save/import.
      if(currentWordId===wordId && !busy) { detail={...next,word:detail.word,brief:detail.brief}; renderHistory(); }
    } catch { /* A manual refresh reports errors. */ }
  }
},15000);
