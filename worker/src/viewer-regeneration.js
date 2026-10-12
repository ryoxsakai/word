import { verifyMcpAccess, oauthErrorResponse, MCP_READ_SCOPE, MCP_WRITE_SCOPE } from './mcp-oauth.js';
const path = '/mcp-editor/api/viewer-regeneration';
const running = job => job && job.state !== 'completed';
const result = (data, status = 200) => Response.json(data, {status, headers:{'cache-control':'no-store'}});
export async function handleViewerRegeneration(request, env) {
  const url = new URL(request.url);
  if (url.pathname.replace(/\/$/,'') !== path) return null;
  const origin = request.headers.get('origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim());
  const cors = {vary:'Origin','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Authorization, Content-Type'};
  if (origin && (origin === url.origin || allowed.includes(origin))) cors['access-control-allow-origin']=origin;
  const finish = response => { const headers=new Headers(response.headers);headers.delete('access-control-allow-origin');headers.set('cache-control','no-store');for(const [key,value] of Object.entries(cors))headers.set(key,value);return new Response(response.body,{status:response.status,headers}); };
  if (request.method === 'OPTIONS') return finish(new Response(null,{status:204}));
  const scopes=[MCP_READ_SCOPE,MCP_WRITE_SCOPE];
  try {await verifyMcpAccess(request,env,scopes);} catch(error){return finish(oauthErrorResponse(request,error,scopes));}
  if (!['GET','POST'].includes(request.method)) return finish(result({error:'Method not allowed'},405));
  if (!env.VIEWER_PUBLISHER || !env.VIEWER_SNAPSHOTS) return finish(result({error:'閲覧ページの公開処理を利用できません'},503));
  try {
    const stub=env.VIEWER_PUBLISHER.get(env.VIEWER_PUBLISHER.idFromName('viewer'));
    if (request.method === 'GET') return finish(await stub.fetch('https://publisher/regeneration-status'));
    const body=await request.json();
    if (!body || typeof body.listId !== 'string' || !body.listId || body.listId.length>200 ||
        typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) return finish(result({error:'単語帳と実行IDを指定してください'},400));
    return finish(await stub.fetch('https://publisher/regenerate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
  } catch(error){return finish(result({error:error instanceof SyntaxError?'入力形式が不正です':'再生成操作を受け付けられませんでした'},error instanceof SyntaxError?400:503));}
}
// A constant-size SQL batch queues section metadata; vocabulary rows are never updated.
export async function queueRegeneration(ctx, env, job) {
  const sql=`INSERT INTO viewer_snapshot_dirty(list_id,kind,section_key,revision)
    SELECT ?,kind,section_key,? FROM (
      SELECT 'viewer-index' AS kind,'' AS section_key
      UNION SELECT 'idiom-index',''
      UNION SELECT 'word-section','none'
      UNION SELECT 'word-section',CAST(id AS TEXT) FROM sections WHERE list_id=?
      UNION SELECT 'idiom-section',section_key FROM idiom_sections WHERE list_id=?
    ) WHERE true ON CONFLICT(list_id,kind,section_key) DO UPDATE SET revision=excluded.revision`;
  await env.DB.prepare(sql).bind(job.listId,job.id,job.listId,job.listId).run();
  job.state='running';job.phase='sections';job.processed=0;
  await ctx.storage.put('regeneration',job);
}
export async function requestRegeneration(ctx, env, body) {
  let job=await ctx.storage.get('regeneration');
  if (running(job)) {
    if (job.listId !== body.listId) return result({error:'別の単語帳を再生成しています',job},409);
    // Resume the same durable job, including after a lost HTTP response or failure.
    if (job.state === 'failed') {
      job.state=job.phase==='enqueue'?'queued':'running';delete job.error;
      await ctx.storage.put('regeneration',job);await ctx.storage.delete('failures');
    }
  } else if (job?.requestId !== body.requestId) {
    const list=await env.DB.prepare('SELECT id,name FROM lists WHERE id=?').bind(body.listId).first();
    if (!list || list.id==='__master__' || /^(?:awl-sublist-|oxford5000-)/.test(list.id)) return result({error:'単語帳が見つかりません'},404);
    job={id:crypto.randomUUID(),requestId:body.requestId,listId:list.id,listName:list.name,state:'queued',phase:'enqueue',processed:0,startedAt:new Date().toISOString()};
    // Persist before queueing, so an interrupted enqueue can be recovered by alarm.
    await ctx.storage.put('regeneration',job);
  }
  if (running(job)) {
    await ctx.storage.setAlarm(Date.now()+1000);
    if (job.phase==='enqueue') {
      try {await queueRegeneration(ctx,env,job);} catch(error){job.state='failed';job.error='再生成の登録に失敗しました';await ctx.storage.put('regeneration',job);}
    }
  }
  return result({job},job.state==='failed'?503:202);
}
export async function updateRegeneration(ctx, changes) {
  const job=await ctx.storage.get('regeneration');
  if (running(job)) await ctx.storage.put('regeneration',{...job,...changes});
}
