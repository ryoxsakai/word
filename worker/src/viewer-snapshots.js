import { markChapters, buildChapter, buildHomePage, chapterKey } from './viewer-snapshot-chapters.js';
import { buildSnapshotScope, scopeKey, indexKey, wordSection, idiomSection } from './viewer-snapshot-build.js';
import { verifyMcpAccess, MCP_WRITE_SCOPE } from './mcp-oauth.js';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...headers } });
const enabled = env => !!env.VIEWER_SNAPSHOTS && !!env.VIEWER_PUBLISHER;
const publisher = env => env.VIEWER_PUBLISHER.get(env.VIEWER_PUBLISHER.idFromName('viewer'));
async function digest(text) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function putJson(bucket, data) {
  const body = JSON.stringify(data), hash = await digest(body), key = `objects/${hash}.json`;
  await bucket.put(key, body, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return { key, hash };
}

// Durable Objects serialize publication; the D1 journal is committed together
// with each data edit. No alarm is scheduled while there is no pending work.
export class ViewerSnapshotPublisher {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/status') return json(await this.ctx.storage.get('status') || { state: 'uninitialized' });
    return this.ctx.blockConcurrencyWhile(async () => {
      const leases = await this.ctx.storage.get('leases') || {};
      const id = request.headers.get('x-edit-id');
      if (path === '/begin') leases[id] = Date.now() + 120000;
      else if (path === '/end') delete leases[id];
      await this.ctx.storage.put('leases', leases);
      if (!await this.ctx.storage.getAlarm()) await this.ctx.storage.setAlarm(Date.now() + 2000);
      return json({ queued: true });
    });
  }
  async alarm() {
    try {
      const leases = await this.ctx.storage.get('leases') || {};
      if (Object.values(leases).some(expiry => expiry > Date.now())) {
        await this.ctx.storage.setAlarm(Date.now() + 2000); return;
      }
      const bucket = this.env.VIEWER_SNAPSHOTS;
      let stage = await this.ctx.storage.get('stage');
      if (!stage) {
        const current = await bucket.get('current.json');
        stage = current ? await current.json() : { files: {}, search: {} };
      }
      const { results: jobs } = await this.env.DB.prepare('SELECT * FROM viewer_snapshot_dirty ORDER BY list_id,kind,section_key LIMIT 8').all();
      if(!jobs.length && !await this.ctx.storage.get('stage')) return;
      const builtScopes = await Promise.all(jobs.map(job => buildSnapshotScope(this.env, job)));
      for (const [jobIndex, job] of jobs.entries()) {
        const id = scopeKey(job), old = stage.files[id];
        const result = builtScopes[jobIndex];
        await markChapters(this.env, stage, job, old, result);
        if (result) {
          const hash = await digest(JSON.stringify(result.data));
          const object = old?.hash === hash ? { key: old.key, hash } : await putJson(bucket, result.data);
          stage.files[id] = { ...object, media: result.media };
        } else delete stage.files[id];
        // Save progress before acknowledging the journal record. A crash can
        // rebuild the same shard, but can never lose a pending publication.
        await this.ctx.storage.put('stage', stage);
        await this.env.DB.prepare('DELETE FROM viewer_snapshot_dirty WHERE list_id=? AND kind=? AND section_key=? AND revision=?')
          .bind(job.list_id,job.kind,job.section_key,job.revision).run();
      }
      const more = await this.env.DB.prepare('SELECT 1 FROM viewer_snapshot_dirty LIMIT 1').first();
      if (more) {
        await this.ctx.storage.put('status', { state:'building', files:Object.keys(stage.files).length, updatedAt:new Date().toISOString() });
        await this.ctx.storage.setAlarm(Date.now() + 1000); return;
      }
      for(const [key,c]of Object.entries(stage.chapters||{}))if(c.kind==='viewer'&&!c.search){stage.pendingChapters ||= {};stage.pendingChapters[key]={list:c.list,kind:c.kind,chapter:c.chapter};}
      const chapterJobs = Object.entries(stage.pendingChapters || {}).slice(0, 2);
      for (const [key, job] of chapterJobs) {
        const built = await buildChapter(this.env, stage, job);
        if(built?.pending){await this.ctx.storage.put('stage',stage);break;}
        if (built) {
          const hash = await digest(built.html), objectKey = `objects/${hash}.html`;
          if(stage.chapters[key]?.hash !== hash) await bucket.put(objectKey, built.html, {httpMetadata:{contentType:'text/html; charset=utf-8'}});
          const {html,search,...metadata}=built;
          stage.chapters[key]={...metadata,hash,key:objectKey,...(search?{search:await putJson(bucket,search)}:{})};
        } else delete stage.chapters[key];
        delete stage.pendingChapters[key];
        await this.ctx.storage.put('stage',stage);
      }
      if(Object.keys(stage.pendingChapters || {}).length) {
        await this.ctx.storage.put('status',{state:'building',files:Object.keys(stage.files).length,remainingChapters:Object.keys(stage.pendingChapters).length,updatedAt:new Date().toISOString()});
        await this.ctx.storage.setAlarm(Date.now()+1000);return;
      }
      // Regenerating the page shell reuses the already-built first chapter.
      const home = this.env.ASSETS && await buildHomePage(this.env,stage);
      if(!home)delete stage.home;
      if(home) {const hash=await digest(home),key=`objects/home-${hash}.html`;await bucket.put(key,home,{httpMetadata:{contentType:'text/html; charset=utf-8'}});stage.home={key,hash};}
      await this.ctx.blockConcurrencyWhile(async () => {
        const active = await this.ctx.storage.get('leases') || {};
        if (Object.values(active).some(expiry=>expiry>Date.now())) { await this.ctx.storage.setAlarm(Date.now()+2000); return; }
        if (!jobs.length && !await this.ctx.storage.get('stage')) return;
        if(await this.env.DB.prepare('SELECT 1 FROM viewer_snapshot_dirty LIMIT 1').first()){await this.ctx.storage.setAlarm(Date.now()+1000);return;}
        // A deleted notebook must not retain accessible bodies or media.
        for (const id of Object.keys(stage.files)) {
          const [list,kind] = JSON.parse(id);
          if (kind !== 'catalog' && !stage.files[indexKey(list,'viewer-index')]) delete stage.files[id];
        }
        delete stage.search; // Retire the initial legacy aggregate; search is chapter-scoped.
        stage.revision = crypto.randomUUID(); stage.generatedAt = new Date().toISOString();
        await bucket.put(`manifests/${stage.revision}.json`, JSON.stringify(stage));
        await bucket.put('current.json', JSON.stringify(stage), { httpMetadata:{contentType:'application/json'} });
        await this.ctx.storage.delete('stage');
        await this.ctx.storage.put('status', {state:'ready',revision:stage.revision,generatedAt:stage.generatedAt,files:Object.keys(stage.files).length});
        await this.ctx.storage.delete('failures');
      });
    } catch (error) {
      const failures = (await this.ctx.storage.get('failures') || 0) + 1;
      await this.ctx.storage.put('failures', failures);
      await this.ctx.storage.put('status', {state:'failed',error:String(error.message || error).slice(0,500),failures});
      console.error('Viewer snapshot publication failed', error);
      if (failures < 6) await this.ctx.storage.setAlarm(Date.now()+Math.min(60000,2000*2**failures));
    }
  }
}

// Observe every D1 mutation entry point (REST, MCP, bulk imports and uploads).
// D1 triggers determine affected shards; this wrapper only wakes the publisher.
export function trackViewerEdits(env) {
  if (!enabled(env)) return { env, finish: async()=>{} };
  const id = crypto.randomUUID(); let began;
  const notify = async path => {
    const response = await publisher(env).fetch(`https://publisher${path}`, {method:'POST',headers:{'x-edit-id':id}});
    if (!response.ok) throw new Error('Viewer publisher unavailable');
  };
  const begin = () => began ||= notify('/begin');
  const relevant = sql => /\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+["`\[]?(?:words|senses|derivatives|examples|tags|lists|list_items|chapters|sections|section_groups|section_labels|word_audio|word_illustrations|illustration_jobs|idioms|idiom_sections|idiom_senses|idiom_word_refs|idiom_illustrations|idiom_illustration_jobs)\b/i.test(sql);
  const raw = new WeakMap();
  const wrap = (statement, sql) => {
    const proxy = new Proxy(statement, {get(target, key) {
      if (key === 'bind') return (...args)=>wrap(target.bind(...args),sql);
      if (['run','all','first','raw'].includes(key)) return async (...args)=>{ if(relevant(sql)) await begin(); return target[key](...args); };
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    }});
    raw.set(proxy,{statement,sql}); return proxy;
  };
  const db = new Proxy(env.DB, {get(target,key) {
    if (key === 'prepare') return sql=>wrap(target.prepare(sql),sql);
    if (key === 'batch') return async statements=>{
      if(statements.some(s=>relevant(raw.get(s)?.sql || ''))) await begin();
      return target.batch(statements.map(s=>raw.get(s)?.statement || s));
    };
    if (key === 'exec') return async sql=>{ if(relevant(sql)) await begin(); return target.exec(sql); };
    const value=target[key];return typeof value==='function'?value.bind(target):value;
  }});
  return {env:{...env,DB:db},finish:async()=>{if(began){await began;await notify('/end');}}};
}

export async function handleSnapshotAdmin(request,env) {
  if (!/^\/mcp-viewer-publish\/?$/.test(new URL(request.url).pathname)) return null;
  if (!enabled(env)) return json({error:'Snapshots unavailable'},503);
  const token=request.headers.get('Authorization')?.slice(7);
  if (!env.VIEWER_PUBLISH_TOKEN || token !== env.VIEWER_PUBLISH_TOKEN) {
    try { await verifyMcpAccess(request,env,[MCP_WRITE_SCOPE]); } catch { return json({error:'Unauthorized'},401); }
  }
  if (!['GET','POST'].includes(request.method)) return json({error:'Method not allowed'},405);
  return publisher(env).fetch(`https://publisher/${request.method==='GET'?'status':'wake'}`,{method:request.method});
}

async function manifestFor(request,env) {
  const object=await env.VIEWER_SNAPSHOTS.get('current.json');
  return object?object.json():null;
}
async function readFile(env,manifest,id) {
  const entry=manifest.files[id];
  if(!entry)return null;
  const object=await env.VIEWER_SNAPSHOTS.get(entry.key);
  if(!object)throw new Error('Published snapshot object missing');
  return object.json();
}
export async function serveViewerSnapshot(request,env) {
  const url=new URL(request.url), path=url.pathname.replace(/\/$/,'');
  if (!enabled(env) || env.VIEWER_STATIC_ENABLED !== 'true') return null;
  if(path.startsWith('/mcp-viewer-assets/')) {
    const assetUrl=new URL(request.url);assetUrl.pathname=path.slice('/mcp-viewer-assets'.length);
    const asset=await env.ASSETS.fetch(new Request(assetUrl,request));
    const headers=new Headers(asset.headers);headers.set('cache-control','no-cache');
    return new Response(asset.body,{status:asset.status,headers});
  }
  const homePath=path===''||path==='/index.html';
  if(!homePath&&!path.startsWith('/mcp-viewer/api/'))return null;
  if(!['GET','HEAD','OPTIONS'].includes(request.method))return json({error:'Read only'},405);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'*'}});
  try {
    const manifest=await manifestFor(request,env);
    if(!manifest)return json({error:'閲覧データを準備しています。少し待って再読み込みしてください。'},503,{'retry-after':'5'});
    if(homePath) {
      const object=manifest.home&&await env.VIEWER_SNAPSHOTS.get(manifest.home.key);
      return object?new Response(request.method==='HEAD'?null:object.body,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-viewer-source':'r2-html'}}):json({error:'HTML is being prepared'},503);
    }
    let data;
    if (/\/api\/(audio|illustrations|idiom-illustrations)\//.test(path)) {
      const normalized = /\/api\/audio\/[^/]+$/.test(path)?`${path}/primary`:path;
      const resource=Object.values(manifest.files).map(f=>f.media?.[normalized]).find(Boolean);
      if(!resource)return json({error:'Media not found'},404);
      const object=await env[resource.bucket].get(resource.key);
      if(!object)return json({error:'Media not found'},404);
      const headers={'content-type':resource.type,'cache-control':'public,max-age=0,must-revalidate','etag':object.httpEtag,'access-control-allow-origin':'*','x-viewer-source':'r2'};
      return new Response(request.method==='HEAD'||request.headers.get('if-none-match')===object.httpEtag?null:object.body,{status:request.headers.get('if-none-match')===object.httpEtag?304:200,headers});
    }
    if(path==='/mcp-viewer/api/lists')data=await readFile(env,manifest,indexKey('','catalog'));
    else {
      const match=path.match(/^\/mcp-viewer\/api\/lists\/([^/]+)\/(.+)$/);
      if(!match)return json({error:'No such viewer route'},404);
      const list=decodeURIComponent(match[1]), tail=match[2];
      const chapterMatch=tail.match(/^(viewer|idioms)\/chapters\/([^/]+)$/);
      if(chapterMatch) {
        const c=manifest.chapters?.[chapterKey(list,chapterMatch[1],decodeURIComponent(chapterMatch[2]))];
        const object=c&&await env.VIEWER_SNAPSHOTS.get(c.key);
        if(!object)return json({error:'Chapter not found'},404);
        return new Response(request.method==='HEAD'?null:object.body,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=0,must-revalidate','x-viewer-source':'r2-html','x-chapter-hash':c.hash,'access-control-allow-origin':'*','access-control-expose-headers':'x-chapter-hash'}});
      }
      if(tail==='viewer/bootstrap') {
        const index=await readFile(env,manifest,indexKey(list,'viewer-index'));
        if(index)data={index,idioms:await readFile(env,manifest,indexKey(list,'idiom-index')),chapters:Object.fromEntries(Object.entries(manifest.chapters||{}).filter(([,c])=>c.list===list).map(([key,c])=>[key,{hash:c.hash,kind:c.kind,chapter:c.chapter,sections:c.sections}]))};
      } else if(tail==='viewer/index'||tail==='idioms/index') {
        const kind=tail==='viewer/index'?'viewer-index':'idiom-index';
        data=await readFile(env,manifest,indexKey(list,kind));
        if(data && url.searchParams.get('initial')==='1') {
          if(kind==='viewer-index'&&data.sections[0]) {
            const section=data.sections[0].key;
            data.initialSection={key:section,...await readFile(env,manifest,wordSection(list,section))};
          } else if(kind==='idiom-index') {
            const visible=new Set(data.entries.filter(e=>!e.hidden).map(e=>e.sectionKey));
            const first=data.chapters.flatMap(c=>c.sections).find(s=>visible.has(s.key));
            if(first)data.initialSection=await readFile(env,manifest,idiomSection(list,first.key));
          }
        }
      } else if(tail.startsWith('viewer/sections/'))data=await readFile(env,manifest,wordSection(list,decodeURIComponent(tail.slice(16))));
      else if(tail.startsWith('idioms/sections/'))data=await readFile(env,manifest,idiomSection(list,decodeURIComponent(tail.slice(16))));
      else if(tail==='viewer/search') {
        const q=(url.searchParams.get('q')||'').trim().replace(/[A-Z]/g,c=>c.toLowerCase());
        const chapters=q?Object.values(manifest.chapters||{}).filter(c=>c.list===list&&c.kind==='viewer'&&c.search):[];
        const corpus=await Promise.all(chapters.map(async c=>(await env.VIEWER_SNAPSHOTS.get(c.search.key)).json()));
        data={matches:corpus.flat().filter(w=>w.text.includes(q)).map(({wordId,sectionKey})=>({wordId,sectionKey}))};
      } else if(tail==='words/full'||tail==='idioms') {
        const words=tail==='words/full', index=await readFile(env,manifest,indexKey(list,words?'viewer-index':'idiom-index'));
        if(index) {
          const keys=words?index.sections.map(s=>s.key):index.chapters.flatMap(c=>c.sections.map(s=>s.key));
          const entries=[];
          for(const key of keys){const shard=await readFile(env,manifest,words?wordSection(list,key):idiomSection(list,key));entries.push(...(shard?.[words?'words':'entries']||[]));}
          data=words?{list:index.list,words:entries}:{managed:index.managed,chapters:index.chapters,entries};
        }
      }
    }
    if(data==null)return json({error:'Not found'},404);
    const body=JSON.stringify(data), etag=`"${await digest(body)}"`;
    const headers={'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','cache-control':'public,max-age=0,must-revalidate',etag,'x-viewer-source':'r2','x-viewer-revision':manifest.revision};
    return new Response(request.method==='HEAD'||request.headers.get('if-none-match')===etag?null:body,{status:request.headers.get('if-none-match')===etag?304:200,headers});
  } catch(error) { console.error('Static viewer read failed',error);return json({error:'閲覧データを読み込めませんでした'},503); }
}
