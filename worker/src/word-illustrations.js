import { ILLUSTRATION_LIST_ID, PROMPT_VERSION, REFERENCE_PATHS, defaultBrief, buildIllustrationPrompt } from './illustration-prompt.js';
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE, verifyMcpAccess, oauthErrorResponse } from './mcp-oauth.js';
import { decodeIllustrationPng, MAX_IMAGE_BASE64 } from './illustration-upload.js';

const ADMIN = '/mcp-editor/api/illustrations';
const PUBLIC = '/mcp-viewer/api/illustrations';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
export const illustrationUrl = (wordId, jobId) => `${PUBLIC}/${encodeURIComponent(wordId)}/${encodeURIComponent(jobId)}.png`;

export function illustrationConfiguration(env) {
  const missing = [];
  if (!env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!env.ILLUSTRATION_BUCKET) missing.push('ILLUSTRATION_BUCKET');
  if (!env.ASSETS) missing.push('ASSETS');
  const enabled = String(env.ILLUSTRATIONS_ENABLED ?? 'true') !== 'false';
  return { ready: !missing.length && enabled, enabled, missing, importReady: !!env.ILLUSTRATION_BUCKET, promptVersion: PROMPT_VERSION,
    model: env.ILLUSTRATION_MODEL || 'gpt-image-2', quality: env.ILLUSTRATION_QUALITY || 'medium' };
}

export async function illustrationWord(env, wordId) {
  const word = await env.DB.prepare(`SELECT w.id, w.spelling FROM words w JOIN list_items li ON li.word_id = w.id
    WHERE w.id = ? AND li.list_id = ?`).bind(wordId, ILLUSTRATION_LIST_ID).first();
  if (!word) fail('crossoverの収録語が見つかりません', 404);
  const [senses, examples] = await env.DB.batch([
    env.DB.prepare('SELECT pos, meaning, is_primary AS isPrimary FROM senses WHERE word_id = ? ORDER BY sort_order, id').bind(wordId),
    env.DB.prepare('SELECT sentence, translation FROM examples WHERE word_id = ? ORDER BY sort_order, id LIMIT 3').bind(wordId),
  ]);
  return { ...word, senses: senses.results, examples: examples.results };
}

async function getBrief(env, word) {
  return await env.DB.prepare('SELECT pos, meaning, scene, avoid FROM illustration_briefs WHERE word_id = ?').bind(word.id).first()
    || defaultBrief(word);
}

function validateBrief(word, input) {
  if (!input || typeof input !== 'object') fail('生成指示を指定してください');
  const brief = {};
  for (const [key, max] of [['pos', 40], ['meaning', 1000], ['scene', 2500], ['avoid', 1000]]) {
    if (typeof input[key] !== 'string' || input[key].length > max) fail(`${key}の入力が不正か長すぎます`);
    brief[key] = input[key].trim();
  }
  if (!word.senses.some(s => (s.pos || '') === brief.pos && s.meaning === brief.meaning)) {
    fail('登録語義が変更されています。語義を選び直してください');
  }
  return brief;
}

export async function saveIllustrationBrief(env, wordId, input) {
  const word = await illustrationWord(env, wordId);
  const brief = validateBrief(word, input);
  await env.DB.prepare(`INSERT INTO illustration_briefs(word_id, pos, meaning, scene, avoid) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(word_id) DO UPDATE SET pos=excluded.pos, meaning=excluded.meaning, scene=excluded.scene,
    avoid=excluded.avoid, updated_at=datetime('now')`).bind(wordId, brief.pos, brief.meaning, brief.scene, brief.avoid).run();
  return brief;
}

export async function enqueueIllustration(env, wordId, requestId) {
  if (!UUID.test(requestId || '')) fail('requestIdにはUUIDを指定してください');
  const word = await illustrationWord(env, wordId);
  // A lost HTTP response can be retried with the same ID without another paid generation.
  const existing = await env.DB.prepare('SELECT id, word_id AS wordId, status, source FROM illustration_jobs WHERE id = ?').bind(requestId).first();
  if (existing) {
    if (existing.wordId !== wordId || existing.source !== 'api') fail('requestIdが別の依頼で使用されています', 409);
    return existing;
  }
  const config = illustrationConfiguration(env);
  if (!config.ready) fail('画像生成の設定が未完了、または一時停止中です', 503);
  if (!['low', 'medium', 'high', 'auto'].includes(config.quality)) fail('画像品質の設定が不正です', 503);
  const brief = validateBrief(word, await getBrief(env, word));
  const prompt = buildIllustrationPrompt(word, brief);
  if (prompt.length > 30000) fail('生成指示が長すぎます');
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO illustration_jobs
    (id, word_id, spelling, pos, meaning, scene, avoid, prompt, prompt_version, reference_paths, model, quality)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(requestId, wordId, word.spelling, brief.pos, brief.meaning,
      brief.scene, brief.avoid, prompt, PROMPT_VERSION, JSON.stringify(REFERENCE_PATHS), config.model, config.quality).run();
  if (!result.meta.changes) {
    const active = await env.DB.prepare("SELECT id, status FROM illustration_jobs WHERE word_id = ? AND status IN ('queued','processing')").bind(wordId).first();
    if (active) return { ...active, wordId, alreadyQueued: true };
    fail('生成依頼を保存できませんでした', 409);
  }
  return { id: requestId, wordId, status: 'queued' };
}

export async function generateIllustration(env, job) {
  const form = new FormData();
  form.set('model', job.model);
  form.set('prompt', job.prompt);
  form.set('size', '1024x1024');
  form.set('quality', job.quality);
  form.set('output_format', 'png');
  form.set('n', '1');
  for (const path of JSON.parse(job.reference_paths)) {
    // Only our immutable bundled references are read; never fetch a user-supplied URL.
    if (!/^\/shared\/illustration-references\/[a-zA-Z0-9-]+\.png$/.test(path)) fail('参考画像のパスが不正です', 500);
    const response = await env.ASSETS.fetch(new Request(`https://vocab.lrnr.jp${path}`));
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) fail('画風の参考画像を読み込めません', 503);
    const blob = await response.blob();
    if (blob.size > 5 * 1024 * 1024) fail('参考画像が大きすぎます', 500);
    form.append('image[]', blob, path.split('/').pop());
  }
  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form,
    signal: AbortSignal.timeout(240000),
  });
  const requestId = response.headers.get('x-request-id') || null;
  if (!response.ok) {
    // Do not expose provider response bodies that could include sensitive configuration.
    fail(`画像生成APIエラー (${response.status})${requestId ? ` / ${requestId}` : ''}`, 502);
  }
  const data = await response.json();
  const base64 = data.data?.[0]?.b64_json;
  if (typeof base64 !== 'string' || base64.length > 24 * 1024 * 1024) fail('画像生成APIの画像データが不正です', 502);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  if (![137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)) fail('PNG画像を取得できませんでした', 502);
  return { bytes, usage: data.usage || null, requestId };
}

export async function importIllustration(env, wordId, input) {
  if (input?.approved !== true) fail('この画像へのユーザーのOKを確認してから登録してください');
  if (!UUID.test(input.requestId || '')) fail('requestIdにはUUIDを指定してください');
  if (input.expectedCurrentId !== null && !UUID.test(input.expectedCurrentId || '')) fail('確認時の表示中画像IDを指定してください');
  if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 30000) fail('実際に使用したプロンプトを指定してください（30000文字以内）');
  if (!env.ILLUSTRATION_BUCKET) fail('画像保存先が未設定です', 503);
  const word = await illustrationWord(env, wordId);
  const brief = validateBrief(word, input);
  const { bytes, width, height } = decodeIllustrationPng(input.imageBase64);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  const existing = await env.DB.prepare('SELECT * FROM illustration_jobs WHERE id=?').bind(input.requestId).first();
  if (existing) {
    if (existing.word_id !== wordId || existing.source !== 'approved-upload' || existing.input_sha256 !== hash
      || existing.prompt !== input.prompt || Object.keys(brief).some(k => existing[k] !== brief[k])) fail('requestIdが異なる内容の依頼で使用されています', 409);
    // A retry must never move the pointer back after a later replacement or restoration.
    if (existing.status !== 'ready') fail('登録処理中、または失敗した依頼です。履歴を確認してください', 409);
    const current = await env.DB.prepare('SELECT job_id FROM word_illustrations WHERE word_id=?').bind(wordId).first();
    return { id: existing.id, wordId, status: 'ready', url: illustrationUrl(wordId, existing.id), current: current?.job_id === existing.id, alreadyImported: true };
  }
  // Release abandoned upload reservations even when the paid API is disabled.
  await env.DB.prepare(`UPDATE illustration_jobs SET status='failed', finished_at=datetime('now'), error='画像の登録が中断されました。'
    WHERE source='approved-upload' AND status='processing' AND started_at < datetime('now','-16 minutes')`).run();
  const reserved = await env.DB.prepare(`INSERT OR IGNORE INTO illustration_jobs
    (id,word_id,status,spelling,pos,meaning,scene,avoid,prompt,prompt_version,reference_paths,model,quality,source,input_sha256,approved_at,started_at)
    SELECT ?,?,'processing',?,?,?,?,?,?,'approved-upload-v1','[]','external','original','approved-upload',?,datetime('now'),datetime('now')
    WHERE (SELECT job_id FROM word_illustrations WHERE word_id=?) IS ?`).bind(input.requestId, wordId,
      word.spelling, brief.pos, brief.meaning, brief.scene, brief.avoid, input.prompt, hash, wordId, input.expectedCurrentId).run();
  if (!reserved.meta.changes) fail('表示中の画像が変わったか、別の処理が進行中です。履歴を確認してから登録してください', 409);
  const objectKey = `illustrations/${encodeURIComponent(wordId)}/${input.requestId}.png`;
  try {
    await env.ILLUSTRATION_BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: 'image/png' } });
    await env.DB.batch([
      env.DB.prepare(`UPDATE illustration_jobs SET status='ready',object_key=?,finished_at=datetime('now') WHERE id=? AND status='processing'`).bind(objectKey, input.requestId),
      env.DB.prepare(`INSERT INTO word_illustrations(word_id,job_id) SELECT word_id,id FROM illustration_jobs WHERE id=? AND status='ready'
        ON CONFLICT(word_id) DO UPDATE SET job_id=excluded.job_id,updated_at=datetime('now')`).bind(input.requestId),
    ]);
  } catch {
    await env.DB.prepare(`UPDATE illustration_jobs SET status='failed',error='画像の保存に失敗しました。',finished_at=datetime('now') WHERE id=? AND status='processing'`).bind(input.requestId).run();
    fail('画像を保存できませんでした。現在の画像は履歴で確認できます', 503);
  }
  return { id: input.requestId, wordId, status: 'ready', source: 'approved-upload', url: illustrationUrl(wordId, input.requestId), current: true, width, height };
}

export async function processIllustrationQueue(env, { generate = generateIllustration } = {}) {
  if (!illustrationConfiguration(env).ready) return { state: 'not-configured' };
  // Never automatically repeat a paid call after a crash/timeout: the provider may have completed it.
  await env.DB.prepare(`UPDATE illustration_jobs SET status='failed', finished_at=datetime('now'),
    error='処理が中断されました。自動再試行はしていません。履歴を確認してください。'
    WHERE status='processing' AND started_at < datetime('now', '-16 minutes')`).run();
  const job = await env.DB.prepare(`UPDATE illustration_jobs SET status='processing', started_at=datetime('now')
    WHERE id = (SELECT id FROM illustration_jobs WHERE status='queued' ORDER BY created_at, rowid LIMIT 1)
    AND NOT EXISTS(SELECT 1 FROM illustration_jobs WHERE status='processing') RETURNING *`).first();
  if (!job) return { state: 'idle' };
  try {
    await illustrationWord(env, job.word_id); // The word may have been removed from crossover while waiting.
    const { bytes, usage, requestId } = await generate(env, job);
    const objectKey = `illustrations/${encodeURIComponent(job.word_id)}/${job.id}.png`;
    await env.ILLUSTRATION_BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: 'image/png' } });
    // Upload first; publishing the new pointer and the completed history is one D1 transaction.
    await env.DB.batch([
      env.DB.prepare(`UPDATE illustration_jobs SET status='ready', object_key=?, usage_json=?, provider_request_id=?, finished_at=datetime('now')
        WHERE id=? AND status='processing'`).bind(objectKey, JSON.stringify(usage), requestId, job.id),
      env.DB.prepare(`INSERT INTO word_illustrations(word_id,job_id)
        SELECT word_id,id FROM illustration_jobs WHERE id=? AND status='ready'
        ON CONFLICT(word_id) DO UPDATE SET job_id=excluded.job_id, updated_at=datetime('now')`).bind(job.id),
    ]);
    return { state: 'ready', id: job.id };
  } catch (error) {
    const message = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? '生成APIが時間内に応答しませんでした。自動再試行はしていません。'
      : String(error?.message || '画像生成に失敗しました').slice(0, 500);
    await env.DB.prepare("UPDATE illustration_jobs SET status='failed', error=?, finished_at=datetime('now') WHERE id=? AND status='processing'")
      .bind(message, job.id).run();
    return { state: 'failed', id: job.id };
  }
}

export async function restoreIllustration(env, wordId, jobId) {
  await illustrationWord(env, wordId);
  const job = await env.DB.prepare("SELECT * FROM illustration_jobs WHERE id=? AND word_id=? AND status='ready'").bind(jobId, wordId).first();
  if (!job || !await env.ILLUSTRATION_BUCKET?.head(job.object_key)) fail('過去の画像が見つかりません', 404);
  const result = await env.DB.prepare(`INSERT INTO word_illustrations(word_id,job_id) SELECT ?, ?
    WHERE NOT EXISTS(SELECT 1 FROM illustration_jobs WHERE word_id=? AND status IN ('queued','processing'))
    ON CONFLICT(word_id) DO UPDATE SET job_id=excluded.job_id, updated_at=datetime('now')`).bind(wordId, jobId, wordId).run();
  if (!result.meta.changes) fail('生成が完了するか、待機中の依頼を取り消してから戻してください', 409);
  return { url: illustrationUrl(wordId, jobId) };
}

export async function serveIllustration(request, env, wordId, jobId) {
  const job = await env.DB.prepare(`SELECT j.object_key FROM illustration_jobs j JOIN list_items li ON li.word_id=j.word_id
    WHERE j.id=? AND j.word_id=? AND j.status='ready' AND li.list_id=?`).bind(jobId, wordId, ILLUSTRATION_LIST_ID).first();
  if (!job || !env.ILLUSTRATION_BUCKET) return json({ error: '画像が見つかりません' }, 404);
  const object = await env.ILLUSTRATION_BUCKET.get(job.object_key);
  if (!object) return json({ error: '画像が見つかりません' }, 404);
  const headers = { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable',
    etag: object.httpEtag, 'x-content-type-options': 'nosniff', 'access-control-allow-origin': '*' };
  if (request.headers.get('if-none-match') === object.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}

async function managementIndex(env, url) {
  const sections = await env.DB.prepare('SELECT id, subtitle FROM sections WHERE list_id=? ORDER BY sort_order,id').bind(ILLUSTRATION_LIST_ID).all();
  const raw = url.searchParams.get('sectionId');
  const sectionId = raw === 'none' ? null : raw === null ? sections.results[0]?.id ?? null : Number(raw);
  if (sectionId !== null && !sections.results.some(s => s.id === sectionId)) fail('Sectionが見つかりません', 404);
  const words = await env.DB.prepare(`SELECT w.id,w.spelling,li.no,li.branch,b.meaning,b.scene,a.job_id AS currentJobId,
    j.id AS latestJobId,j.status,j.error FROM list_items li JOIN words w ON w.id=li.word_id
    LEFT JOIN illustration_briefs b ON b.word_id=w.id LEFT JOIN word_illustrations a ON a.word_id=w.id
    LEFT JOIN illustration_jobs j ON j.id=(SELECT id FROM illustration_jobs WHERE word_id=w.id ORDER BY rowid DESC LIMIT 1)
    WHERE li.list_id=? AND li.section_id IS ? ORDER BY li.no,li.branch,w.spelling`).bind(ILLUSTRATION_LIST_ID, sectionId).all();
  const counts = await env.DB.prepare('SELECT status,COUNT(*) AS count FROM illustration_jobs GROUP BY status').all();
  return { config: illustrationConfiguration(env), sections: sections.results, sectionId, counts: counts.results,
    words: words.results.map(w => ({ ...w, url: w.currentJobId ? illustrationUrl(w.id,w.currentJobId) : null })) };
}

export async function wordHistory(env, wordId) {
  const word = await illustrationWord(env, wordId);
  const brief = await getBrief(env, word);
  const history = await env.DB.prepare(`SELECT id,status,pos,meaning,scene,avoid,prompt,prompt_version AS promptVersion,
    model,quality,source,input_sha256 AS imageSha256,approved_at AS approvedAt,error,created_at AS createdAt,finished_at AS finishedAt FROM illustration_jobs WHERE word_id=? ORDER BY rowid DESC LIMIT 30`).bind(wordId).all();
  const current = await env.DB.prepare('SELECT job_id AS id FROM word_illustrations WHERE word_id=?').bind(wordId).first();
  return { word, brief, suggestedPrompt: buildIllustrationPrompt(word, brief), referencePaths: REFERENCE_PATHS, currentId: current?.id || null, history: history.results.map(j => ({ ...j,
    url: j.status === 'ready' ? illustrationUrl(wordId,j.id) : null })) };
}

async function readBody(request, maxLength = 20000) {
  if (Number(request.headers.get('content-length')) > maxLength) fail('送信内容が大きすぎます', 413);
  const text = await request.text();
  if (text.length > maxLength) fail('送信内容が大きすぎます', 413);
  try { return JSON.parse(text); } catch { fail('JSONが不正です'); }
}

export async function handleIllustrationRoute(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  if (path.startsWith(PUBLIC + '/')) {
    if (!['GET','HEAD'].includes(request.method)) return json({ error: 'viewer API is read-only' }, 405);
    const match = path.slice(PUBLIC.length + 1).match(/^([^/]+)\/([a-f0-9-]+)\.png$/i);
    if (!match || !UUID.test(match[2])) return json({ error: 'not found' }, 404);
    try { return await serveIllustration(request, env, decodeURIComponent(match[1]), match[2]); }
    catch { return json({ error: '画像を取得できませんでした' }, 500); }
  }
  if (path !== ADMIN && !path.startsWith(ADMIN + '/')) return null;
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim());
  const origin = request.headers.get('origin');
  const cors = { vary: 'Origin', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type' };
  if (origin && (allowed.includes(origin) || origin === url.origin)) cors['access-control-allow-origin'] = origin;
  const finish = response => { const headers = new Headers(response.headers); for (const [k,v] of Object.entries(cors)) headers.set(k,v);
    return new Response(response.body, { status: response.status, headers }); };
  if (request.method === 'OPTIONS') return finish(new Response(null, { status: 204 }));
  const scopes = request.method === 'GET' ? [MCP_READ_SCOPE] : [MCP_READ_SCOPE, MCP_WRITE_SCOPE];
  try { await verifyMcpAccess(request, env, scopes); }
  catch (e) { return finish(oauthErrorResponse(request,e,scopes)); }
  try {
    const parts = path.slice(ADMIN.length).split('/').filter(Boolean).map(decodeURIComponent);
    if (!parts.length && request.method === 'GET') return finish(json(await managementIndex(env,url)));
    if (parts[0] === 'jobs' && parts.length === 1 && request.method === 'POST') {
      const body = await readBody(request);
      if (!Array.isArray(body?.items) || !body.items.length || body.items.length > 20) fail('1回に1〜20語を指定してください');
      const results = [];
      for (const item of body.items) {
        try { results.push(await enqueueIllustration(env,item?.wordId,item?.requestId)); }
        catch (e) { results.push({ wordId: item?.wordId, error: e.message }); }
      }
      return finish(json({ results }, 202));
    }
    if (parts[0] === 'words' && parts[1]) {
      const wordId = parts[1];
      if (parts.length === 2 && request.method === 'GET') return finish(json(await wordHistory(env,wordId)));
      if (parts.length === 3 && parts[2] === 'import' && request.method === 'POST') return finish(json(await importIllustration(env,wordId,await readBody(request, MAX_IMAGE_BASE64 + 200000))));
      if (parts.length === 3 && parts[2] === 'brief' && request.method === 'PUT') return finish(json(await saveIllustrationBrief(env,wordId,await readBody(request))));
      if (parts.length === 3 && parts[2] === 'restore' && request.method === 'POST') return finish(json(await restoreIllustration(env,wordId,(await readBody(request)).jobId)));
    }
    if (parts[0] === 'jobs' && UUID.test(parts[1] || '') && parts[2] === 'cancel' && parts.length === 3 && request.method === 'POST') {
      const result = await env.DB.prepare("UPDATE illustration_jobs SET status='cancelled',finished_at=datetime('now') WHERE id=? AND status='queued'").bind(parts[1]).run();
      if (!result.meta.changes) fail('待機中の依頼のみ取り消せます', 409);
      return finish(json({ ok: true }));
    }
    return finish(json({ error: 'not found' }, 404));
  } catch (e) { return finish(json({ error: e.status ? e.message : '画像管理の処理に失敗しました' }, e.status || 500)); }
}
