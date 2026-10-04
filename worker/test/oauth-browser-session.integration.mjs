import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {handleOAuthRoute, verifyMcpAccess} from '../src/mcp-oauth.js';

const origin = 'https://vocab.lrnr.jp';
const sessionName = '__Host-vocab-oauth-session';
const formName = '__Host-vocab-oauth-browser';
const mf = new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',
  compatibilityDate:'2024-11-01',d1Databases:['DB']});
const originalNow = Date.now;
let timestamp = Math.floor(originalNow()/1000);
Date.now = () => timestamp*1000;
const jars = () => new Map();
function cookieHeader(jar) {return [...jar].map(([k,v])=>`${k}=${v}`).join('; ');}
function receive(response, jar) {
  for(const value of response.headers.getSetCookie()) {
    const [part] = value.split(';'), index=part.indexOf('=');
    const name=part.slice(0,index), token=part.slice(index+1);
    if(/Max-Age=0(?:;|$)/.test(value))jar.delete(name);else jar.set(name,token);
  }
}
const unescape = value => value.replaceAll('&quot;','"').replaceAll('&#39;',"'")
  .replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
function fields(html) {
  return new URLSearchParams([...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)]
    .map(match=>[match[1],unescape(match[2])]));
}
let env;
async function getForm(jar, params, {path='/oauth/authorize', environment=env}={}) {
  const response=await handleOAuthRoute(new Request(origin+path+(params?'?'+params:''),{headers:{Cookie:cookieHeader(jar)}}),environment);
  receive(response,jar);
  const html=await response.text();
  return {response,html,body:fields(html)};
}
async function post(jar, body, {path='/oauth/authorize', environment=env, headers={}, urlOrigin=origin}={}) {
  return handleOAuthRoute(new Request(urlOrigin+path,{method:'POST',headers:{
    'Content-Type':'application/x-www-form-urlencoded',Origin:origin,'Sec-Fetch-Site':'same-origin',Cookie:cookieHeader(jar),...headers},body}),environment);
}
async function login(jar, params, remember=true) {
  const form=await getForm(jar,params);
  form.body.set('api_key',env.VOCAB_MCP_API_KEY);
  if(remember)form.body.set('remember_login','1');
  const response=await post(jar,form.body);assert.equal(response.status,302);receive(response,jar);
  return response;
}
async function count(table) {return (await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first()).count;}
try {
  const DB=await mf.getD1Database('DB');
  for(const file of ['0015_mcp_oauth.sql','0059_oauth_browser_sessions.sql','0060_oauth_refresh_tokens.sql']) {
    const sql=readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').replace(/^\s*--.*$/gm,'');
    for(const statement of sql.split(';').map(v=>v.trim()).filter(Boolean)) await DB.prepare(statement).run();
  }
  env={DB,VOCAB_MCP_API_KEY:'fake-local-test-key',VOCAB_MCP_SESSION_SECRET:'fake-local-test-secret-with-32-plus-characters'};
  const redirect='https://chatgpt.com/connector/oauth/test';
  const registration=await handleOAuthRoute(new Request(origin+'/oauth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({redirect_uris:[redirect,'https://vocab.lrnr.jp/setting/']})}),env);
  const client=(await registration.json()).client_id;
  const verifier='test-verifier-12345678901234567890123456789012345678901234567890';
  const challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');
  const params=new URLSearchParams({response_type:'code',client_id:client,redirect_uri:redirect,
    code_challenge:challenge,code_challenge_method:'S256',scope:'vocab:read vocab:write',state:'test<&"state'});
  // Initial form is explicitly opt-in. No secret is emitted or persisted in HTML.
  const fresh=jars();let form=await getForm(fresh,params);
  assert.equal(form.response.status,200);assert.equal(form.response.headers.get('Cache-Control'),'no-store');
  assert.equal(form.response.headers.get('Referrer-Policy'),'same-origin');
  assert.match(form.response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  assert.match(form.html,/type="checkbox" value="1">/);assert.doesNotMatch(form.html,/value="1" checked/);
  assert.match(form.html,/type="password" required/);assert.doesNotMatch(form.html,/fake-local-test-key|localStorage|<script/);
  assert.match(form.html,/test&lt;&amp;&quot;state/);assert.equal(await count('mcp_oauth_codes'),0);
  assert.equal(await count('mcp_oauth_browser_sessions'),0);
  // Missing/wrong keys fail closed and issue fresh forms for a retry.
  form.body.set('remember_login','1');
  let response=await post(fresh,form.body);assert.equal(response.status,401);receive(response,fresh);
  form={body:fields(await response.text())};form.body.set('api_key','wrong');form.body.set('remember_login','1');
  response=await post(fresh,form.body);assert.equal(response.status,401);receive(response,fresh);
  const failedHtml=await response.text();assert.match(failedHtml,/value="1" checked/);
  assert.equal(await count('mcp_oauth_codes'),0);assert.equal(await count('mcp_oauth_browser_sessions'),0);
  form={body:fields(failedHtml)};form.body.set('api_key',env.VOCAB_MCP_API_KEY);
  response=await post(fresh,form.body);assert.equal(response.status,302);receive(response,fresh);
  assert.equal(fresh.has(sessionName),false);assert.equal(await count('mcp_oauth_browser_sessions'),0);
  // One-use forms reject back-button resubmit and simultaneous double-click.
  assert.equal((await post(fresh,form.body)).status,403);
  form=await getForm(fresh,params);form.body.set('api_key',env.VOCAB_MCP_API_KEY);
  const concurrent=await Promise.all([post(fresh,form.body),post(fresh,form.body)]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[302,403]);
  // Opt in yields an opaque 30-day host-only secure cookie; D1 stores digests only.
  const jar=jars();const firstLogin=await login(jar,params);
  const sessionCookie=firstLogin.headers.getSetCookie().find(c=>c.startsWith(sessionName+'='));
  assert.match(sessionCookie,/; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000$/);
  assert.doesNotMatch(sessionCookie,/Domain=|fake-local-test/);assert.match(jar.get(sessionName),/^[A-Za-z0-9_-]{43}$/);
  const record=await DB.prepare('SELECT * FROM mcp_oauth_browser_sessions').first();
  assert.notEqual(record.token_hash,jar.get(sessionName));assert.equal(record.expires_at-record.created_at,2592000);
  assert.doesNotMatch(JSON.stringify(record),/fake-local-test-key|fake-local-test-secret/);
  // Remembered GET does not grant. Same explicit consent + checked option preserves fixed expiry.
  const countBefore=await count('mcp_oauth_codes');timestamp+=60;
  form=await getForm(jar,params);assert.equal(form.response.status,200);
  assert.doesNotMatch(form.html,/type="password"/);assert.match(form.html,/value="1" checked/);
  assert.equal(await count('mcp_oauth_codes'),countBefore);
  form.body.set('remember_login','1');response=await post(jar,form.body);assert.equal(response.status,302);
  assert.equal(response.headers.getSetCookie().length,0);
  assert.equal((await DB.prepare('SELECT expires_at FROM mcp_oauth_browser_sessions').first()).expires_at,record.expires_at);
  // Remember cookie cannot directly call APIs, and OAuth code/PKCE/TTL still apply.
  await assert.rejects(()=>verifyMcpAccess(new Request(origin+'/mcp',{headers:{Cookie:cookieHeader(jar)}}),env));
  const result=new URL(response.headers.get('Location'));
  assert.equal(result.searchParams.get('state'),params.get('state'));
  const exchange=new URLSearchParams({grant_type:'authorization_code',code:result.searchParams.get('code'),client_id:client,redirect_uri:redirect,code_verifier:verifier});
  const tokenRequest=()=>handleOAuthRoute(new Request(origin+'/oauth/token',{method:'POST',body:exchange}),env);
  exchange.set('code_verifier','wrong'.repeat(12));assert.equal((await tokenRequest()).status,400);
  exchange.set('code_verifier',verifier);const tokenResponse=await tokenRequest();assert.equal(tokenResponse.status,200);
  const token=await tokenResponse.json();assert.equal(token.expires_in,43200);
  assert.equal((await tokenRequest()).status,400);
  await verifyMcpAccess(new Request(origin+'/mcp',{headers:{Authorization:'Bearer '+token.access_token}}),env);
  // No cookie, tampered/duplicated cookies, or a changed identity cannot reuse a bound form.
  form=await getForm(jar,params);form.body.set('remember_login','1');
  assert.equal((await post(jars(),form.body)).status,403);
  const changed=new Map(jar);changed.set(sessionName,'x'.repeat(43));
  assert.equal((await post(changed,form.body)).status,403);
  assert.match((await getForm(changed,params)).html,/type="password"/);
  assert.equal((await post(jar,form.body,{headers:{Cookie:cookieHeader(jar)+'; '+formName+'=x'}})).status,403);
  // Foreign/sibling/null/missing origin and fetch metadata never authorize.
  for(const badOrigin of ['https://evil.example','https://exam.lrnr.jp','null','']) {
    assert.equal((await post(jar,form.body,{headers:{Origin:badOrigin}})).status,403);
  }
  assert.equal((await post(jar,form.body,{headers:{'Sec-Fetch-Site':'same-site'}})).status,403);
  assert.equal((await post(jar,form.body,{headers:{'Content-Type':'text/plain'}})).status,403);
  // All OAuth request properties are bound. Unregistered redirect remains an error, never a redirect.
  for(const [field,value] of [['state','tampered'],['code_challenge','x'.repeat(43)],['scope','vocab:read'],['redirect_uri','https://vocab.lrnr.jp/setting/']]) {
    const altered=new URLSearchParams(form.body);altered.set(field,value);
    assert.equal((await post(jar,altered)).status,403,field);
  }
  const altered=new URLSearchParams(form.body);altered.set('redirect_uri','https://evil.example/');
  const invalid=await post(jar,altered);assert.equal(invalid.status,400);assert.equal(invalid.headers.get('Location'),null);
  // Neither GET query strings nor unchecked form fields can opt into persistence or supply a key.
  const queryJar=jars();const queryParams=new URLSearchParams(params);queryParams.set('api_key',env.VOCAB_MCP_API_KEY);queryParams.set('remember_login','1');
  const queryForm=await getForm(queryJar,queryParams);assert.doesNotMatch(queryForm.html,/value="1" checked|fake-local-test-key/);
  const queryResponse=await post(queryJar,queryForm.body,{path:'/oauth/authorize?'+queryParams});assert.equal(queryResponse.status,401);
  // Expired forms are rejected, parallel fresh forms work, and session expiry is absolute.
  form=await getForm(jar,params);form.body.set('remember_login','1');timestamp+=600;
  assert.equal((await post(jar,form.body)).status,403);
  const parallelA=await getForm(jar,params), parallelB=await getForm(jar,params);
  for(const f of [parallelA,parallelB]) {f.body.set('remember_login','1');assert.equal((await post(jar,f.body)).status,302);}
  timestamp=record.expires_at-1;assert.doesNotMatch((await getForm(jar,params)).html,/type="password"/);
  timestamp=record.expires_at;assert.match((await getForm(jar,params)).html,/type="password"/);
  const expiredForm=await getForm(jar,params);expiredForm.body.set('remember_login','1');assert.equal((await post(jar,expiredForm.body)).status,401);
  // Secret/API-key rotation invalidates remembered authentication without storing credentials.
  await login(jar,params);form=await getForm(jar,params);
  for(const field of ['VOCAB_MCP_API_KEY','VOCAB_MCP_SESSION_SECRET']) {
    const rotated={...env,[field]:'rotated-'+env[field]};
    assert.match((await getForm(jar,params,{environment:rotated})).html,/type="password"/);
  }
  // Uncheck revokes the current browser session while completing only this grant.
  const oldCookie=jar.get(sessionName);form=await getForm(jar,params);
  response=await post(jar,form.body);assert.equal(response.status,302);receive(response,jar);
  assert.equal(jar.has(sessionName),false);const replay=new Map(jar);replay.set(sessionName,oldCookie);
  assert.match((await getForm(replay,params)).html,/type="password"/);
  // GET logout is read-only for sessions. POST requires its own CSRF, revokes server-side,
  // and does not affect separately issued bearer tokens. Stale login forms cannot survive it.
  await login(jar,params);const oldJar=new Map(jar);const stale=await getForm(jar,params);stale.body.set('remember_login','1');
  const beforeLogout=await count('mcp_oauth_browser_sessions');const logout=await getForm(jar,null,{path:'/oauth/logout'});
  assert.equal(await count('mcp_oauth_browser_sessions'),beforeLogout);
  assert.equal((await post(jar,stale.body,{path:'/oauth/logout'})).status,403);
  assert.equal((await post(jar,logout.body,{path:'/oauth/logout',headers:{Origin:'https://evil.example'}})).status,403);
  response=await post(jar,logout.body,{path:'/oauth/logout'});assert.equal(response.status,200);receive(response,jar);
  assert.equal(jar.has(sessionName),false);assert.match(await response.text(),/発行済み/);
  assert.match((await getForm(oldJar,params)).html,/type="password"/);
  assert.equal((await post(jar,stale.body)).status,403);
  assert.equal((await post(oldJar,stale.body)).status,401);
  // Editor callback retains its independent seven-day bearer lifetime.
  const editorParams=new URLSearchParams(params);editorParams.set('redirect_uri','https://vocab.lrnr.jp/setting/');
  response=await login(jar,editorParams,false);
  exchange.set('code',new URL(response.headers.get('Location')).searchParams.get('code'));
  exchange.set('redirect_uri','https://vocab.lrnr.jp/setting/');
  assert.equal((await (await tokenRequest()).json()).expires_in,604800);
  // Fail closed if D1 is unavailable; no redirect/grant on partial persistence failure.
  const failing={...env,DB:{prepare(){throw new Error('simulated storage failure')}}};
  await assert.rejects(()=>getForm(jars(),params,{environment:failing}),/simulated storage failure/);
  const failedJar=jars();const failedForm=await getForm(failedJar,params);
  failedForm.body.set('api_key',env.VOCAB_MCP_API_KEY);failedForm.body.set('remember_login','1');
  const beforeFailure=await count('mcp_oauth_codes');
  const insertFailure={...env,DB:{prepare(sql){
    if(sql.startsWith('INSERT INTO mcp_oauth_browser_sessions'))throw new Error('simulated session insert failure');
    return DB.prepare(sql);
  }}};
  await assert.rejects(()=>post(failedJar,failedForm.body,{environment:insertFailure}),/simulated session insert failure/);
  assert.equal(await count('mcp_oauth_codes'),beforeFailure);
  assert.equal(failedJar.has(sessionName),false);
  console.log('OAuth browser sessions: opt-in/off, reuse, fixed expiry, revocation, rotation, one-use CSRF, origin/redirect binding, failures and unchanged OAuth passed');
} finally { Date.now=originalNow;await mf.dispose(); }
