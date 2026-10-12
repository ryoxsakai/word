import { EDITOR_API_BASE } from '../shared/config.js';
import { editorFetch } from './auth.js';
export function setupViewerRegeneration(root=document, fetcher=editorFetch, storage=sessionStorage) {
  const el=Object.fromEntries(['viewerRegenerateOpen','viewerRegeneratePanel','viewerRegenerateList','viewerRegenerateStart','viewerRegenerateClose','viewerRegenerateStatus','viewerRegenerateLink'].map(id=>[id,root.getElementById(id)]));
  if(!el.viewerRegenerateOpen)return;
  const endpoint=`${EDITOR_API_BASE}/api/viewer-regeneration`;
  let job=null,timer=null,busy=false,open=false,requestId=null,generation=0;
  const render=()=>{
    const active=job&&['queued','running'].includes(job.state);
    el.viewerRegenerateList.disabled=busy||active||job?.state==='failed';
    el.viewerRegenerateStart.disabled=busy||active||!el.viewerRegenerateList.value;
    el.viewerRegenerateStart.textContent=job?.state==='failed'?'再試行':active?'再生成中…':'閲覧ページを再生成';
    el.viewerRegenerateLink.hidden=job?.state!=='completed';
    if(job?.state==='completed') {
      el.viewerRegenerateStatus.textContent=`${job.listName}：再生成が完了しました。閲覧画面の歯車から「最新版を読み込む」を押してください。`;
      el.viewerRegenerateLink.href=`../index.html?list=${encodeURIComponent(job.listId)}`;
    } else if(job?.state==='failed') el.viewerRegenerateStatus.textContent=`${job.listName}：${job.error} 自動再試行を待つか「再試行」で再開できます。`;
    else if(active) el.viewerRegenerateStatus.textContent=`${job.listName}：${job.phase==='enqueue'?'再生成を登録中':job.phase==='chapters'?`閲覧ページを作成中（残り${job.remainingChapters??'…'}章）`:`単語・熟語を読み込み中（${job.processed||0}件処理済み）`}。画面を閉じても処理は続きます。`;
  };
  const api=async(url,init)=>{
    const response=await fetcher(url,{cache:'no-store',...init});
    const body=await response.json();
    if(!response.ok)throw Object.assign(new Error(body.error||'再生成の状態を確認できませんでした'),{job:body.job});
    return body;
  };
  const schedule=()=>{clearTimeout(timer);if(open&&job&&job.state!=='completed')timer=setTimeout(()=>void poll(),5000);};
  const poll=async()=>{
    const token=generation;
    try {
      const data=await api(endpoint);
      if(!open||token!==generation)return;
      job=data.job;
      if(job)el.viewerRegenerateList.value=job.listId;
      render();schedule();
    }catch(error){if(open&&token===generation){el.viewerRegenerateStatus.textContent='状態を確認できません。処理はサーバーで継続します。画面を開き直すと確認できます。';clearTimeout(timer);timer=setTimeout(()=>void poll(),10000);}}
  };
  el.viewerRegenerateOpen.addEventListener('click',async()=>{
    open=true;const token=++generation;el.viewerRegeneratePanel.hidden=false;busy=true;render();
    el.viewerRegenerateStatus.textContent='再生成の状態を確認しています…';
    try {
      const lists=await api(`${EDITOR_API_BASE}/api/lists`);
      if(!open||token!==generation)return;
      el.viewerRegenerateList.replaceChildren();
      for(const list of lists.filter(list=>list.isNotebook)){
        const option=root.createElement('option');option.value=list.id;option.textContent=list.name;el.viewerRegenerateList.append(option);
      }
      if(lists.some(list=>list.id==='crossover-v3'))el.viewerRegenerateList.value='crossover-v3';
      await poll();
      if(!job)el.viewerRegenerateStatus.textContent='対象の単語帳を選んで実行してください。単語・熟語の閲覧ページ全体を再生成します。';
    }catch(error){if(open&&token===generation)el.viewerRegenerateStatus.textContent=error.message;}
    finally{if(token===generation){busy=false;render();}}
  });
  el.viewerRegenerateList.addEventListener('change',()=>{generation++;clearTimeout(timer);job=null;requestId=null;el.viewerRegenerateStatus.textContent='選択した単語帳の単語・熟語の閲覧ページ全体を再生成します。';render();});
  el.viewerRegenerateStart.addEventListener('click',async()=>{
    if(busy||job&&['queued','running'].includes(job.state))return;
    busy=true;render();
    const key=`vocab-viewer-regeneration:${el.viewerRegenerateList.value}`;
    requestId=job?.state==='failed'?job.requestId:requestId||storage.getItem(key)||crypto.randomUUID();
    storage.setItem(key,requestId);
    try {
      const data=await api(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listId:el.viewerRegenerateList.value,requestId})});
      job=data.job;storage.removeItem(key);requestId=null;render();schedule();
    }catch(error){
      if(error.job){job=error.job;el.viewerRegenerateList.value=job.listId;render();schedule();}
      else {el.viewerRegenerateStatus.textContent=`${error.message}。同じ実行を再試行できます。`;void poll();}
    }finally{busy=false;render();}
  });
  el.viewerRegenerateClose.addEventListener('click',()=>{open=false;generation++;clearTimeout(timer);el.viewerRegeneratePanel.hidden=true;el.viewerRegenerateOpen.focus();});
  return {poll};
}
setupViewerRegeneration();
