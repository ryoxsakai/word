import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {handleOAuthRoute,verifyMcpAccess} from '../src/mcp-oauth.js';
const origin='https://synthetic-vocab.example';
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2024-11-01',d1Databases:['DB']});
const originalNow=Date.now; let now=2000000000; Date.now=()=>now*1000;
try {
 const DB=await mf.getD1Database('DB');
 for(const file of ['0015_mcp_oauth.sql','0060_oauth_refresh_tokens.sql']) {
   for(const sql of readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').split(';').filter(s=>s.trim())) await DB.prepare(sql).run();
 }
 const env={DB,VOCAB_MCP_API_KEY:'synthetic-api',VOCAB_MCP_SESSION_SECRET:'synthetic-session-secret'};
 const post=async(body,path='/oauth/token',environment=env)=>handleOAuthRoute(new Request(origin+path,{method:'POST',body:new URLSearchParams(body)}),environment);
 const client='synthetic-client',redirect='https://chatgpt.com/synthetic';
 await DB.prepare('INSERT INTO mcp_oauth_clients (client_id,redirect_uris) VALUES (?,?)').bind(client,JSON.stringify([redirect])).run();
 const verifier='v'.repeat(43),challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');
 async function authorize(scope='vocab:read vocab:write',uri=redirect) {
   const code=crypto.randomUUID();
   await DB.prepare('INSERT INTO mcp_oauth_codes (code,client_id,redirect_uri,code_challenge,scope,expires_at) VALUES (?,?,?,?,?,?)').bind(code,client,uri,challenge,scope,now+300).run();
   const args={grant_type:'authorization_code',code,client_id:client,redirect_uri:uri,code_verifier:verifier};
   const response=await post(args);assert.equal(response.status,200);assert.equal((await post(args)).status,400);
   return response.json();
 }
 const refresh=t=>post({grant_type:'refresh_token',client_id:client,refresh_token:t});
 const verify=(t,environment=env)=>verifyMcpAccess(new Request(origin+'/mcp',{headers:{Authorization:'Bearer '+t}}),environment);
 const first=await authorize();assert.equal(first.expires_in,43200);assert.equal(first.refresh_token_expires_in,2592000);
 const originalFamily=await DB.prepare('SELECT * FROM mcp_oauth_refresh_families').first();
 assert.doesNotMatch(JSON.stringify(await DB.prepare('SELECT * FROM mcp_oauth_refresh_tokens').all()),new RegExp(first.refresh_token));
 assert.doesNotMatch(JSON.stringify(originalFamily),/synthetic-api|synthetic-session-secret/);
 assert.equal((await post({grant_type:'refresh_token',client_id:'wrong',refresh_token:first.refresh_token})).status,400);
 assert.equal((await post({grant_type:'refresh_token',client_id:client,refresh_token:first.refresh_token,scope:'admin'})).status,400);
 assert.equal((await post({grant_type:'refresh_token',client_id:client,refresh_token:first.refresh_token,resource:'https://wrong.example/mcp'})).status,400);
 assert.equal((await refresh('x'.repeat(43))).status,400);
 const concurrent=await Promise.all([refresh(first.refresh_token),refresh(first.refresh_token)]);
 assert.deepEqual(concurrent.map(r=>r.status),[200,200]);
 const [second,duplicate]=await Promise.all(concurrent.map(r=>r.json()));
 assert.equal(second.refresh_token,duplicate.refresh_token);assert.notEqual(second.refresh_token,first.refresh_token);
 now+=4;assert.equal((await refresh(first.refresh_token)).status,200);
 now+=2;assert.equal((await refresh(first.refresh_token)).status,400);
 await assert.rejects(verify(second.access_token),/revoked/);assert.equal((await refresh(second.refresh_token)).status,400);
 const delayed=await authorize();
 const delayedDB={prepare:DB.prepare.bind(DB),batch:async statements=>{const results=await DB.batch(statements);now+=6;return results;}};
 const delayedResponse=await post({grant_type:'refresh_token',client_id:client,refresh_token:delayed.refresh_token},'/oauth/token',{...env,DB:delayedDB});
 assert.equal(delayedResponse.status,200,'slow CAS winner must not revoke itself');
 const delayedGrant=await delayedResponse.json();await verify(delayedGrant.access_token);
 const delayedFamily=await DB.prepare('SELECT revoked_at FROM mcp_oauth_refresh_families WHERE family_id = ?').bind(JSON.parse(Buffer.from(delayedGrant.access_token.split('.')[1],'base64url')).refresh_family).first();assert.equal(delayedFamily.revoked_at,null);
 const advanced=await authorize();
 const advanced2=await (await refresh(advanced.refresh_token)).json();
 const advanced3=await (await refresh(advanced2.refresh_token)).json();
 assert.equal((await refresh(advanced.refresh_token)).status,400,'already advanced family must reject previous-generation retry even within grace');
 await assert.rejects(verify(advanced3.access_token),/revoked/);
 const duplicateArgs=new URLSearchParams({grant_type:'refresh_token',client_id:client,refresh_token:advanced.refresh_token});duplicateArgs.append('client_id',client);
 assert.equal((await post(duplicateArgs)).status,400);
 const another=await authorize('vocab:read');
 assert.equal((await post({grant_type:'refresh_token',client_id:client,refresh_token:another.refresh_token,scope:'vocab:read vocab:write'})).status,400);
 await verify(another.access_token);
 await assert.rejects(verify(another.access_token,{...env,VOCAB_MCP_SESSION_SECRET:'changed'}),/signature/);
 const wrongOrigin=await handleOAuthRoute(new Request('https://wrong.example/oauth/token',{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',client_id:client,refresh_token:another.refresh_token})}),env);assert.equal(wrongOrigin.status,400);

 now+=43201;await assert.rejects(verify(another.access_token),/expired/);
 const updated=await (await refresh(another.refresh_token)).json();assert.equal(updated.refresh_token_expires_in,2592000-43201);
 await assert.rejects(verify(updated.access_token,{...env,VOCAB_MCP_API_KEY:'changed'}),/revoked/);
 assert.equal((await post({grant_type:'refresh_token',client_id:client,refresh_token:updated.refresh_token},'/oauth/token',{...env,VOCAB_MCP_API_KEY:'changed'})).status,400);
 await post({token:updated.refresh_token,client_id:'wrong'},'/oauth/revoke');await verify(updated.access_token);
 await post({token:updated.refresh_token,client_id:client},'/oauth/revoke');await assert.rejects(verify(updated.access_token),/revoked/);
 const capped=await authorize();now+=2592000-10;
 const nearExpiry=await (await refresh(capped.refresh_token)).json();assert.equal(nearExpiry.expires_in,10);
 now+=10;assert.equal((await refresh(nearExpiry.refresh_token)).status,400);await assert.rejects(verify(nearExpiry.access_token),/expired/);
 const editor=await authorize('vocab:read vocab:write','https://vocab.lrnr.jp/setting/');assert.equal(editor.expires_in,604800);assert.equal(editor.refresh_token,undefined);
 const metadata=await (await handleOAuthRoute(new Request(origin+'/.well-known/oauth-authorization-server'),env)).json();assert.ok(metadata.grant_types_supported.includes('refresh_token'));assert.equal(metadata.revocation_endpoint,origin+'/oauth/revoke');
 console.log('OAuth refresh: code one-use, digest-only persistence, client/scope/resource binding, concurrent rotation, fixed retry, replay revocation, short access expiry, credential rotation, explicit revoke, fixed 30-day cap and unchanged editor passed');
} finally {Date.now=originalNow;await mf.dispose();}
