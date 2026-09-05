import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import { Miniflare } from 'miniflare';
import { enqueueIllustration, processIllustrationQueue, saveIllustrationBrief, restoreIllustration,
  handleIllustrationRoute, wordHistory, illustrationConfiguration, generateIllustration } from '../src/word-illustrations.js';
import { handleIllustrationMcp } from '../src/illustration-mcp.js';

function sqlStatements(sql) {
  const triggers=[];
  return sql.replace(/^\s*--.*$/gm,'').replace(/CREATE\s+TRIGGER[\s\S]*?END\s*;/gi,t=>{
    triggers.push(t.replace(/;\s*$/,'').replace(/\s+/g,' '));return `__TRIGGER_${triggers.length-1}__;`;
  }).split(';').map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean)
    .map(s=>s.replace(/__TRIGGER_(\d+)__/g,(_,i)=>triggers[+i])+';').join('\n');
}
const mf=new Miniflare({ modules:true, script:'export default {fetch(){return new Response("ok")}}',
  compatibilityDate:'2024-11-01',d1Databases:['DB'],r2Buckets:['ILLUSTRATION_BUCKET'] });
const originalFetch=globalThis.fetch;
const origin='https://vocab.lrnr.jp';
const png=readFileSync(new URL('../../public/shared/illustration-references/v1-key.png',import.meta.url));
const secret='test-only-session-secret';
function token(scope='vocab:read vocab:write') {
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'at+jwt'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({iss:origin,aud:'vocab-mcp',client_id:'test',scope,exp:Math.floor(Date.now()/1000)+600})).toString('base64url');
  return `${header}.${payload}.${createHmac('sha256',secret).update(`${header}.${payload}`).digest('base64url')}`;
}
try {
  const DB=await mf.getD1Database('DB');
  const ILLUSTRATION_BUCKET=await mf.getR2Bucket('ILLUSTRATION_BUCKET');
  for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) {
    await DB.exec(sqlStatements(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8')));
  }
  await DB.prepare("INSERT OR IGNORE INTO lists(id,name) VALUES('crossover-v3','crossover')").run();
  for(const [id,no] of [['key',1],['significant',2],['outside',3]]) {
    await DB.prepare('INSERT OR IGNORE INTO words(id,spelling) VALUES(?,?)').bind(id,id).run();
    if(id!=='outside') await DB.prepare("INSERT OR IGNORE INTO list_items(list_id,word_id,no,branch) VALUES('crossover-v3',?,?,0)").bind(id,no).run();
    await DB.prepare('INSERT INTO senses(word_id,pos,meaning,is_primary) VALUES(?,?,?,1)').bind(id,'形','重要な・主要な').run();
  }
  await DB.prepare("INSERT INTO senses(word_id,pos,meaning,is_primary) VALUES('significant','形','かなりの・著しい',0)").run();
  const env={DB,ILLUSTRATION_BUCKET,OPENAI_API_KEY:'test-key',VOCAB_MCP_SESSION_SECRET:secret,MCP_ALLOW_ANONYMOUS_WRITES:'true',
    ASSETS:{fetch:async()=>new Response(png,{headers:{'content-type':'image/png'}})}};
  let calls=0;
  globalThis.fetch=async(url,init)=>{
    calls++;
    assert.equal(url,'https://api.openai.com/v1/images/edits');
    assert.equal(init.headers.Authorization,'Bearer test-key');
    assert.ok(init.body instanceof FormData);
    assert.equal(init.body.get('model'),'gpt-image-2');
    assert.equal(init.body.get('quality'),'medium');
    assert.equal(init.body.get('size'),'1024x1024');
    assert.equal(init.body.getAll('image[]').length,2);
    assert.match(init.body.get('prompt'),/重要な・主要な/);
    return Response.json({data:[{b64_json:png.toString('base64')}],usage:{total_tokens:100}}, {headers:{'x-request-id':'req_test'}});
  };
  const admin=(path='',method='GET',body,auth=token())=>handleIllustrationRoute(new Request(origin+'/mcp-editor/api/illustrations'+path,{
    method,headers:{...(auth?{Authorization:'Bearer '+auth}:{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
  assert.equal((await admin('','GET',null,null)).status,401);
  assert.equal((await admin('/jobs','POST',{items:[]},token('vocab:read'))).status,403);
  assert.equal((await admin('/jobs','POST',{items:[]},null)).status,401);
  assert.equal((await admin('/jobs','POST',{items:[]})).status,400);
  assert.equal(illustrationConfiguration({...env,OPENAI_API_KEY:''}).ready,false);
  await assert.rejects(()=>enqueueIllustration({...env,OPENAI_API_KEY:''},'key',randomUUID()),e=>e.status===503);
  await assert.rejects(()=>enqueueIllustration(env,'outside',randomUUID()),e=>e.status===404);
  await assert.rejects(()=>saveIllustrationBrief(env,'key',{pos:'名',meaning:'wrong',scene:'',avoid:''}),/登録語義/);
  await assert.rejects(()=>saveIllustrationBrief(env,'key',{pos:'形',meaning:'重要な・主要な',scene:'x'.repeat(2501),avoid:''}),/長すぎ/);
  assert.equal((await wordHistory(env,'significant')).brief.meaning,'かなりの・著しい');

  const firstId=randomUUID();
  const initial=await enqueueIllustration(env,'key',firstId);
  assert.equal(initial.status,'queued');
  const duplicate=await enqueueIllustration(env,'key',randomUUID());
  assert.equal(duplicate.id,firstId);
  assert.equal((await enqueueIllustration(env,'key',firstId)).id,firstId);
  let release,entered;
  const start=new Promise(r=>entered=r),block=new Promise(r=>release=r);
  const processing=processIllustrationQueue(env,{generate:async(e,j)=>{entered();await block;return generateIllustration(e,j);}});
  await start;
  assert.equal((await processIllustrationQueue(env)).state,'idle','overlapping cron must not start another API call');
  assert.equal((await admin(`/jobs/${firstId}/cancel`,'POST',{})).status,409,'cannot cancel an in-flight paid call');
  release();
  assert.equal((await processing).state,'ready');
  assert.equal(calls,1);
  assert.equal((await wordHistory(env,'key')).currentId,firstId,'successful generation is automatically published');
  assert.equal((await enqueueIllustration(env,'key',firstId)).status,'ready','retry after completion is still idempotent');
  assert.equal(calls,1);
  const history=await wordHistory(env,'key');
  const imageRequest=new Request(origin+history.history[0].url);
  const image=await handleIllustrationRoute(imageRequest,env);
  assert.equal(image.status,200);
  assert.equal(image.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
  const cached=await handleIllustrationRoute(new Request(imageRequest,{headers:{'if-none-match':image.headers.get('etag')}}),env);
  assert.equal(cached.status,304);
  const head=await handleIllustrationRoute(new Request(imageRequest,{method:'HEAD'}),env);
  assert.equal((await head.arrayBuffer()).byteLength,0);
  assert.equal((await handleIllustrationRoute(new Request(imageRequest,{method:'POST'}),env)).status,405);

  const secondId=randomUUID();
  await enqueueIllustration(env,'key',secondId);
  assert.equal((await wordHistory(env,'key')).currentId,firstId,'previous image remains while queued');
  await assert.rejects(()=>restoreIllustration(env,'key',firstId),e=>e.status===409);
  assert.equal((await processIllustrationQueue(env,{generate:async()=>{throw new Error('provider failed')}})).state,'failed');
  assert.equal((await wordHistory(env,'key')).currentId,firstId,'failure never removes the displayed image');
  assert.equal((await processIllustrationQueue(env)).state,'idle','failed paid calls are not automatically retried');
  const thirdId=randomUUID();
  await enqueueIllustration(env,'key',thirdId);
  assert.equal((await processIllustrationQueue(env)).state,'ready');
  assert.equal((await wordHistory(env,'key')).currentId,thirdId);
  await restoreIllustration(env,'key',firstId);
  assert.equal((await wordHistory(env,'key')).currentId,firstId);
  assert.ok((await wordHistory(env,'key')).history.find(j=>j.id===thirdId).url,'previous versions retained');
  await assert.rejects(()=>restoreIllustration(env,'significant',firstId),e=>e.status===404);

  const stuckId=randomUUID();
  await enqueueIllustration(env,'key',stuckId);
  await DB.prepare("UPDATE illustration_jobs SET status='processing',started_at=datetime('now','-17 minutes') WHERE id=?").bind(stuckId).run();
  const before=calls;
  await processIllustrationQueue(env);
  assert.equal(calls,before);
  assert.equal((await DB.prepare('SELECT status FROM illustration_jobs WHERE id=?').bind(stuckId).first()).status,'failed');
  const cancelled=randomUUID();
  await enqueueIllustration(env,'key',cancelled);
  assert.equal((await admin(`/jobs/${cancelled}/cancel`,'POST',{})).status,200);
  assert.equal((await processIllustrationQueue(env)).state,'idle');
  const index=await (await admin('?sectionId=none')).json();
  assert.ok(index.words.find(w=>w.id==='key').url);

  const rpcRequest=(method,name,auth)=>new Request(origin+'/mcp',{method:'POST',headers:{'content-type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:{name,arguments:{word_id:'key'}}})});
  const toolsResponse=await handleIllustrationMcp(rpcRequest('tools/list'),env,async()=>Response.json({jsonrpc:'2.0',id:1,result:{tools:[]}}));
  const tools=(await toolsResponse.json()).result.tools;
  assert.equal(tools.find(t=>t.name==='generate_word_illustration').securitySchemes[0].type,'oauth2');
  assert.equal((await handleIllustrationMcp(rpcRequest('tools/call','generate_word_illustration'),env)).status,401);
  assert.equal((await handleIllustrationMcp(rpcRequest('tools/call','generate_word_illustration',token('vocab:read')),env)).status,403);
  const get=await handleIllustrationMcp(rpcRequest('tools/call','get_word_illustration',token()),env);
  assert.equal((await get.json()).result.structuredContent.currentId,firstId);
  console.log('Illustrations: OAuth, prompts, provider form, R2, idempotency, overlapping cron, automatic publication, failed/stuck jobs, cancel, restore, MCP passed');
} finally { globalThis.fetch=originalFetch; await mf.dispose(); }
