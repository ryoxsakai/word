import { decodeIllustrationPng } from './illustration-upload.js';
const LIST_ID = 'crossover-v3';
const PUBLIC = '/mcp-viewer/api/idiom-illustrations';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const idiomIllustrationUrl = (idiomId, jobId) => `${PUBLIC}/${encodeURIComponent(idiomId)}/${encodeURIComponent(jobId)}.png`;

export async function illustrationIdiom(env, idiomId) {
  const idiom = await env.DB.prepare('SELECT id, phrase FROM idioms WHERE id=? AND list_id=? AND hidden=0').bind(idiomId, LIST_ID).first();
  if (!idiom) fail('crossoverの掲載中の熟語が見つかりません', 404);
  const {results:senses} = await env.DB.prepare('SELECT id, meaning FROM idiom_senses WHERE idiom_id=? ORDER BY sort_order,id').bind(idiomId).all();
  return {...idiom, senses};
}
function validateBrief(idiom, input) {
  const brief = {pos:''};
  for (const [key,max] of [['meaning',2000],['scene',2500],['avoid',1000]]) {
    if (typeof input[key] !== 'string' || input[key].length > max) fail(`${key}の入力が不正か長すぎます`);
    brief[key] = input[key].trim();
  }
  if (!idiom.senses.some(s=>s.meaning===brief.meaning)) fail('登録語義が変更されています。語義を選び直してください');
  return brief;
}

export async function importIdiomIllustration(env, idiomId, input) {
  if (input?.approved !== true) fail('この画像へのユーザーのOKを確認してから登録してください');
  if (!UUID.test(input.requestId || '')) fail('requestIdにはUUIDを指定してください');
  if (input.expectedCurrentId !== null && !UUID.test(input.expectedCurrentId || '')) fail('確認時の表示中画像IDを指定してください');
  if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 30000) fail('実際に使用したプロンプトを指定してください（30000文字以内）');
  if (!env.ILLUSTRATION_BUCKET) fail('画像保存先が未設定です', 503);
  const word = await illustrationIdiom(env, idiomId);
  const brief = validateBrief(word, input);
  const { bytes, width, height } = decodeIllustrationPng(input.imageBase64);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  const existing = await env.DB.prepare('SELECT * FROM idiom_illustration_jobs WHERE id=?').bind(input.requestId).first();
  if (existing) {
    if (existing.idiom_id !== idiomId || existing.source !== 'approved-upload' || existing.input_sha256 !== hash
      || existing.prompt !== input.prompt || Object.keys(brief).some(k => existing[k] !== brief[k])) fail('requestIdが異なる内容の依頼で使用されています', 409);
    // A retry must never move the pointer back after a later replacement or restoration.
    if (existing.status !== 'ready') fail('登録処理中、または失敗した依頼です。履歴を確認してください', 409);
    const current = await env.DB.prepare('SELECT job_id FROM idiom_illustrations WHERE idiom_id=?').bind(idiomId).first();
    return { id: existing.id, idiomId, status: 'ready', url: idiomIllustrationUrl(idiomId, existing.id), current: current?.job_id === existing.id, alreadyImported: true };
  }
  // Release abandoned upload reservations even when the paid API is disabled.
  await env.DB.prepare(`UPDATE idiom_illustration_jobs SET status='failed', finished_at=datetime('now'), error='画像の登録が中断されました。'
    WHERE source='approved-upload' AND status='processing' AND started_at < datetime('now','-16 minutes')`).run();
  const reserved = await env.DB.prepare(`INSERT OR IGNORE INTO idiom_illustration_jobs
    (id,idiom_id,status,phrase,pos,meaning,scene,avoid,prompt,prompt_version,reference_paths,model,quality,source,input_sha256,approved_at,started_at)
    SELECT ?,?,'processing',?,?,?,?,?,?,'approved-upload-v1','[]','external','original','approved-upload',?,datetime('now'),datetime('now')
    WHERE (SELECT job_id FROM idiom_illustrations WHERE idiom_id=?) IS ?`).bind(input.requestId, idiomId,
      word.phrase, brief.pos, brief.meaning, brief.scene, brief.avoid, input.prompt, hash, idiomId, input.expectedCurrentId).run();
  if (!reserved.meta.changes) fail('表示中の画像が変わったか、別の処理が進行中です。履歴を確認してから登録してください', 409);
  const objectKey = `idiom-illustrations/${encodeURIComponent(idiomId)}/${input.requestId}.png`;
  try {
    await env.ILLUSTRATION_BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: 'image/png' } });
    await env.DB.batch([
      env.DB.prepare(`UPDATE idiom_illustration_jobs SET status='ready',object_key=?,finished_at=datetime('now') WHERE id=? AND status='processing'`).bind(objectKey, input.requestId),
      env.DB.prepare(`INSERT INTO idiom_illustrations(idiom_id,job_id) SELECT idiom_id,id FROM idiom_illustration_jobs WHERE id=? AND status='ready'
        ON CONFLICT(idiom_id) DO UPDATE SET job_id=excluded.job_id,updated_at=datetime('now')`).bind(input.requestId),
    ]);
  } catch {
    await env.DB.prepare(`UPDATE idiom_illustration_jobs SET status='failed',error='画像の保存に失敗しました。',finished_at=datetime('now') WHERE id=? AND status='processing'`).bind(input.requestId).run();
    fail('画像を保存できませんでした。現在の画像は履歴で確認できます', 503);
  }
  const final = await env.DB.prepare('SELECT status FROM idiom_illustration_jobs WHERE id=?').bind(input.requestId).first();
  if (final?.status !== 'ready') fail('画像登録の予約が失効しました。履歴を確認してください',409);
  return { id: input.requestId, idiomId, status: 'ready', source: 'approved-upload', url: idiomIllustrationUrl(idiomId, input.requestId), current: true, width, height };
}

export async function failIdiomIllustrationRequest(env, idiomId, requestId) {
  if (!UUID.test(requestId || '')) fail('requestIdにはUUIDを指定してください');
  await illustrationIdiom(env, idiomId);
  const job = await env.DB.prepare('SELECT id,idiom_id AS idiomId,status,source,started_at AS startedAt FROM idiom_illustration_jobs WHERE id=?')
    .bind(requestId).first();
  if (!job) fail('画像登録の依頼が見つかりません', 404);
  if (job.idiomId !== idiomId) fail('requestIdが指定した熟語の依頼ではありません', 409);
  if (job.source !== 'approved-upload') fail('承認済み画像の登録依頼だけを失敗扱いに変更できます', 409);
  if (job.status === 'failed') return { id: requestId, idiomId, status: 'failed', alreadyFailed: true };
  if (job.status !== 'processing') fail('処理中の画像登録依頼だけを失敗扱いに変更できます', 409);
  const result = await env.DB.prepare(`UPDATE idiom_illustration_jobs
    SET status='failed',finished_at=datetime('now'),error='管理操作により失敗扱いに変更されました。'
    WHERE id=? AND idiom_id=? AND source='approved-upload' AND status='processing'
      AND started_at < datetime('now','-16 minutes')`).bind(requestId, idiomId).run();
  if (!result.meta.changes) fail('開始から16分以内の画像登録依頼は失敗扱いに変更できません', 409);
  return { id: requestId, idiomId, status: 'failed' };
}

export async function restoreIdiomIllustration(env, idiomId, jobId) {
  await illustrationIdiom(env, idiomId);
  const job = await env.DB.prepare("SELECT * FROM idiom_illustration_jobs WHERE id=? AND idiom_id=? AND status='ready'").bind(jobId, idiomId).first();
  if (!job || !await env.ILLUSTRATION_BUCKET?.head(job.object_key)) fail('過去の画像が見つかりません', 404);
  const result = await env.DB.prepare(`INSERT INTO idiom_illustrations(idiom_id,job_id) SELECT ?, ?
    WHERE NOT EXISTS(SELECT 1 FROM idiom_illustration_jobs WHERE idiom_id=? AND status IN ('queued','processing'))
    ON CONFLICT(idiom_id) DO UPDATE SET job_id=excluded.job_id, updated_at=datetime('now')`).bind(idiomId, jobId, idiomId).run();
  if (!result.meta.changes) fail('生成が完了するか、待機中の依頼を取り消してから戻してください', 409);
  return { url: idiomIllustrationUrl(idiomId, jobId) };
}


export async function idiomHistory(env, idiomId) {
  const idiom = await illustrationIdiom(env, idiomId);
  const {results:history} = await env.DB.prepare(`SELECT id,status,meaning,scene,avoid,prompt,source,input_sha256 AS imageSha256,
    approved_at AS approvedAt,error,created_at AS createdAt,finished_at AS finishedAt FROM idiom_illustration_jobs WHERE idiom_id=? ORDER BY rowid DESC LIMIT 30`).bind(idiomId).all();
  const current = await env.DB.prepare('SELECT job_id AS id FROM idiom_illustrations WHERE idiom_id=?').bind(idiomId).first();
  return {idiom,currentId:current?.id||null,importReady:!!env.ILLUSTRATION_BUCKET,
    history:history.map(j=>({...j,url:j.status==='ready'?idiomIllustrationUrl(idiomId,j.id):null}))};
}
export async function handleIdiomIllustrationRoute(request,env) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith(PUBLIC+'/')) return null;
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
  const match = path.slice(PUBLIC.length+1).match(/^([^/]+)\/([a-f0-9-]+)\.png$/i);
  if (!match || !UUID.test(match[2])) return new Response(null,{status:404});
  let idiomId;
  try { idiomId=decodeURIComponent(match[1]); } catch { return new Response(null,{status:400}); }
  const job = await env.DB.prepare(`SELECT j.object_key FROM idiom_illustration_jobs j JOIN idioms i ON i.id=j.idiom_id
    WHERE j.id=? AND j.idiom_id=? AND j.status='ready' AND i.list_id=? AND i.hidden=0`).bind(match[2],idiomId,LIST_ID).first();
  const object = job && await env.ILLUSTRATION_BUCKET?.get(job.object_key);
  if (!object) return new Response(null,{status:404});
  const headers={'content-type':'image/png','cache-control':'public, max-age=0, must-revalidate',etag:object.httpEtag,
    'x-content-type-options':'nosniff','access-control-allow-origin':'*'};
  if(request.headers.get('if-none-match')===object.httpEtag) return new Response(null,{status:304,headers});
  return new Response(request.method==='HEAD'?null:object.body,{headers});
}
