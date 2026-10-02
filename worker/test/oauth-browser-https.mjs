// Real Chromium, synthetic HTTPS origins, disposable D1 and dummy credentials only.
// Every network request is fulfilled or aborted; no real account or service is used.
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {chromium} from 'playwright';
import {handleOAuthRoute} from '../src/mcp-oauth.js';

const ROOT='https://vocab-login.test';
const CALLBACK='https://client.test/callback';
const SESSION='__Host-vocab-oauth-session';
const artifactDir=process.env.OAUTH_QA_ARTIFACTS || '/tmp/vocab-oauth-browser-qa';
mkdirSync(artifactDir,{recursive:true});
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',
  compatibilityDate:'2024-11-01',d1Databases:['DB']});
let browser, context;
try {
  const DB=await mf.getD1Database('DB');
  for(const file of ['0015_mcp_oauth.sql','0059_oauth_browser_sessions.sql']) {
    const sql=readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').replace(/^\s*--.*$/gm,'');
    for(const statement of sql.split(';').map(value=>value.trim()).filter(Boolean))await DB.prepare(statement).run();
  }
  await DB.prepare('INSERT INTO mcp_oauth_clients (client_id,redirect_uris) VALUES (?,?)')
    .bind('synthetic-browser-client',JSON.stringify([CALLBACK])).run();
  const env={DB,VOCAB_MCP_API_KEY:'dummy-browser-key-not-a-real-credential',
    VOCAB_MCP_SESSION_SECRET:'dummy-browser-signing-secret-with-no-live-access'};
  const params=new URLSearchParams({response_type:'code',client_id:'synthetic-browser-client',
    redirect_uri:CALLBACK,code_challenge:'x'.repeat(43),code_challenge_method:'S256',
    scope:'vocab:read vocab:write',state:'synthetic-browser-state'});
  const authUrl=ROOT+'/oauth/authorize?'+params;
  browser=await chromium.launch({headless:true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  context=await browser.newContext({viewport:{width:390,height:844}});
  let callbackCount=0;
  const formPosts=[], interceptionErrors=[];
  // Route interception omits redirected hops. CDP Fetch intercepts every hop,
  // retaining actual Chromium HTTPS, cookie, Origin, CSP and redirect behavior.
  const newPage=async()=>{
    const page=await context.newPage();
    const session=await context.newCDPSession(page);
    session.on('Fetch.requestPaused',async({requestId,request:incoming})=>{
      try {
        const url=new URL(incoming.url), headers=new Headers(incoming.headers);
        let response;
        if(url.pathname==='/favicon.ico' && [ROOT,'https://client.test'].includes(url.origin)) {
          response=new Response(null,{status:204});
        } else if(url.origin==='https://client.test' && url.pathname==='/callback') {
          assert.ok(url.searchParams.get('code'));
          assert.equal(headers.get('Referer'),null,'no cross-origin Referer on OAuth redirect');
          assert.equal(headers.get('Cookie'),null,'host-only cookies must not reach the OAuth client');
          callbackCount++;
          response=new Response('<h1>Synthetic OAuth callback received</h1>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
        } else if(url.origin===ROOT) {
          if(incoming.method==='POST')formPosts.push({origin:headers.get('Origin'),fetchSite:headers.get('Sec-Fetch-Site'),path:url.pathname});
          const request=new Request(incoming.url,{method:incoming.method,headers,
            ...(!['GET','HEAD'].includes(incoming.method)?{body:incoming.postData || ''}: {})});
          response=await handleOAuthRoute(request,env);
        } else {
          await session.send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});return;
        }
        assert.ok(response,'Synthetic requests must be handled without live network access');
        const responseHeaders=[...response.headers].filter(([name])=>name.toLowerCase()!=='set-cookie')
          .map(([name,value])=>({name,value}));
        for(const value of response.headers.getSetCookie())responseHeaders.push({name:'Set-Cookie',value});
        await session.send('Fetch.fulfillRequest',{requestId,responseCode:response.status,responseHeaders,
          body:Buffer.from(await response.text()).toString('base64')});
      } catch(error) {
        interceptionErrors.push(error);console.error('Synthetic interception failed:',error);
        await session.send('Fetch.failRequest',{requestId,errorReason:'Failed'});
      }
    });
    await session.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    return page;
  };
  const page=await newPage();
  const checkbox=()=>page.getByRole('checkbox',{name:'このブラウザーでログイン状態を保持する（30日間）'});
  const keyInput=()=>page.getByLabel('Vocab MCP APIキー');
  const authorizeButton=()=>page.getByRole('button',{name:'接続を許可',exact:true});
  const submit=async()=>{await Promise.all([page.waitForURL(CALLBACK+'?**'),authorizeButton().click()]);};
  const sessionCookie=async()=>(await context.cookies(ROOT)).find(cookie=>cookie.name===SESSION);
  const assertNoStorage=async()=>{
    assert.deepEqual(await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),cookies:document.cookie})),
      {local:[],session:[],cookies:''});
  };

  await page.goto(authUrl);
  assert.equal(await checkbox().isChecked(),false,'initial opt-in must be unchecked');
  assert.equal(await keyInput().isVisible(),true);
  await assertNoStorage();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile form must not overflow');
  await page.screenshot({path:join(artifactDir,'initial.png'),fullPage:true});
  await checkbox().check();await keyInput().fill('incorrect-dummy-key');await authorizeButton().click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').textContent(),/正しくありません/);
  assert.equal(await checkbox().isChecked(),true);
  assert.equal(await keyInput().inputValue(),'');assert.equal(await sessionCookie(),undefined);
  await keyInput().fill(env.VOCAB_MCP_API_KEY);await submit();
  assert.equal(callbackCount,1);
  const remembered=await sessionCookie();
  assert.ok(remembered);assert.equal(remembered.secure,true);assert.equal(remembered.httpOnly,true);
  assert.equal(remembered.sameSite,'Lax');assert.equal(remembered.path,'/');assert.equal(remembered.domain,'vocab-login.test');
  assert.ok(remembered.expires-Date.now()/1000>2591900 && remembered.expires-Date.now()/1000<=2592001);
  assert.equal(remembered.value.includes('dummy'),false);

  // Reopening the authentication screen reuses the browser proof, but never auto-consents.
  await page.goto(authUrl);
  assert.equal(await keyInput().count(),0);assert.equal(callbackCount,1);
  assert.equal(await checkbox().isChecked(),true);await assertNoStorage();
  await page.screenshot({path:join(artifactDir,'remembered.png'),fullPage:true});
  await submit();assert.equal(callbackCount,2);
  assert.equal((await sessionCookie()).expires,remembered.expires,'reuse does not extend the fixed deadline');
  await page.goto(authUrl);await checkbox().uncheck();await submit();
  assert.equal(await sessionCookie(),undefined,'unchecking revokes and expires the cookie');
  await page.goto(authUrl);assert.equal(await keyInput().isVisible(),true);
  assert.equal(await checkbox().isChecked(),false);
  await keyInput().fill(env.VOCAB_MCP_API_KEY);await submit();
  assert.equal(await sessionCookie(),undefined,'unchecked fresh login never persists browser proof');

  // A checked login works across a new tab. Expiry and key rotation require reauthentication.
  await page.goto(authUrl);await checkbox().check();await keyInput().fill(env.VOCAB_MCP_API_KEY);await submit();
  const reopened=await newPage();await reopened.goto(authUrl);
  assert.equal(await reopened.getByLabel('Vocab MCP APIキー').count(),0);await reopened.close();
  await DB.prepare('UPDATE mcp_oauth_browser_sessions SET expires_at = ?').bind(Math.floor(Date.now()/1000)-1).run();
  await page.goto(authUrl);assert.equal(await keyInput().isVisible(),true);
  await checkbox().check();await keyInput().fill(env.VOCAB_MCP_API_KEY);await submit();
  env.VOCAB_MCP_API_KEY='rotated-dummy-browser-key';
  await page.goto(authUrl);assert.equal(await keyInput().isVisible(),true);
  await checkbox().check();await keyInput().fill(env.VOCAB_MCP_API_KEY);await submit();

  // Logout is a visible confirmation POST, not a GET mutation; stale tabs cannot grant afterward.
  const stale=await newPage();await stale.goto(authUrl);
  await page.goto(ROOT+'/oauth/logout');assert.ok(await sessionCookie());
  await page.screenshot({path:join(artifactDir,'forget-confirmation.png'),fullPage:true});
  await page.getByRole('button',{name:'ログイン保持を解除する',exact:true}).click();
  await page.getByRole('heading',{name:'このブラウザーのログイン保持を解除しました'}).waitFor();
  assert.equal(await sessionCookie(),undefined);
  await stale.getByRole('button',{name:'接続を許可',exact:true}).click();
  assert.match(await stale.locator('body').innerText(),/invalid_request/);await stale.close();
  await page.goto(authUrl);assert.equal(await keyInput().isVisible(),true);
  await assertNoStorage();
  assert.ok(formPosts.length>=8);
  assert.ok(formPosts.every(post=>post.origin===ROOT && post.fetchSite==='same-origin'),
    'real browser submissions carry the exact Origin under Referrer-Policy:same-origin');
  assert.deepEqual(interceptionErrors,[]);
  console.log('Synthetic HTTPS Chromium QA passed: checkbox off/on, failed retry, redirect CSP, Secure/HttpOnly cookie, explicit repeat consent, fixed expiry, new tab, key rotation, uncheck, logout and stale-form rejection');
  console.log('Screenshots: '+artifactDir);
} finally {
  await context?.close();await browser?.close();await mf.dispose();
}
