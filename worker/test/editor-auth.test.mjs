import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../../public/setting/auth.js',import.meta.url),'utf8')
  .replace(/import .*?;\n/, 'const EDITOR_API_BASE = "https://vocab.lrnr.jp/mcp-editor";\n')
  .replace('export async function editorFetch','async function editorFetch');
const key='vocab-setting-oauth-token';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
function page(localStorage,sessionStorage=storage(),fetch=async()=>new Response('{}')) {
  const context=vm.createContext({localStorage,sessionStorage,fetch,Headers,URL,URLSearchParams,
    TextEncoder,crypto:webcrypto,btoa,Date,
    location:{origin:'https://word.lrnr.jp',pathname:'/setting/idioms.html',search:'',assign(){}},history:{replaceState(){}}});
  vm.runInContext(source,context);return context;
}
const valid={accessToken:'test-valid-token',expiresAt:Date.now()+3600000};
const local=storage(),session=storage();session.setItem(key,JSON.stringify(valid));
assert.equal(vm.runInContext('storedAccessToken()',page(local,session)),valid.accessToken);
assert.equal(session.getItem(key),null);
assert.deepEqual(JSON.parse(local.getItem(key)),valid);
let requests=0;
await page(local,storage(),async(input,init)=>{requests++;assert.equal(init.headers.get('Authorization'),'Bearer '+valid.accessToken);return new Response('{}');}).editorFetch('/api/lists');
assert.equal(requests,1,'a reopened page reuses the saved login without authorization');
for(const record of [{...valid,expiresAt:Date.now()-1},{...valid,expiresAt:'invalid'}, {accessToken:valid.accessToken}]) {
  const expired=storage();expired.setItem(key,JSON.stringify(record));
  assert.equal(vm.runInContext('storedAccessToken()',page(expired)),null);
  assert.equal(expired.getItem(key),null);
}
const cleared=page(local);vm.runInContext('clearAccessToken()',cleared);assert.equal(local.getItem(key),null);
// Parallel page startup requests must exchange an OAuth callback only once.
const callbackSession=storage();callbackSession.setItem('vocab-setting-oauth-pkce',JSON.stringify({verifier:'verifier',state:'state',clientId:'client'}));
let exchanges=0;
const callback=page(local,callbackSession,async(input,init)=>{
  if(input.endsWith('/oauth/token')){exchanges++;await new Promise(r=>setTimeout(r,5));return new Response(JSON.stringify({access_token:'new-token',expires_in:43200}));}
  assert.equal(init.headers.get('Authorization'),'Bearer new-token');return new Response('{}');
});
callback.location.search='?code=code&state=state';
await Promise.all([callback.editorFetch('/api/lists'),callback.editorFetch('/api/words')]);
assert.equal(exchanges,1);assert.equal(JSON.parse(local.getItem(key)).accessToken,'new-token');
assert.equal(callbackSession.getItem('vocab-setting-oauth-pkce'),null);
// A rejected token clears both storage locations and starts authorization.
let redirectResolve;const redirected=new Promise(resolve=>{redirectResolve=resolve;});
const rejectedSession=storage();rejectedSession.setItem(key,JSON.stringify(valid));
const rejected=page(local,rejectedSession,async input=>input.endsWith('/oauth/register')?new Response(JSON.stringify({client_id:'client'})):new Response('{}',{status:401}));
rejected.location.assign=url=>redirectResolve(url);
void rejected.editorFetch('/api/lists');
assert.match(await redirected,/\/oauth\/authorize\?/);
assert.equal(local.getItem(key),null);assert.equal(rejectedSession.getItem(key),null);
console.log('Editor auth: persistent login, migration, expiry, shared callback and rejection passed');
