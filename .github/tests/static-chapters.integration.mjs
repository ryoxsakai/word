import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../public/viewer/static-client.js',import.meta.url),'utf8').replaceAll('export ','');
const bootstrap=hash=>({index:{list:{id:'book'}},firstChapter:'1',chapters:{one:{kind:'viewer',chapter:'1',sections:['a'],hash},two:{kind:'viewer',chapter:'2',sections:['b'],hash}}});
let current=bootstrap('old'),calls=[],held,release;
const cached=new Map();
const sandbox={document:{getElementById:id=>id==='static-viewer-bootstrap'?{textContent:JSON.stringify(current)}:{innerHTML:'FIRST READY'}},location:{origin:'https://vocab.lrnr.jp',hostname:'vocab.lrnr.jp'},localStorage:{getItem:()=>null},Request,Response,URL,Map,JSON,
 caches:{open:async()=>({match:async key=>cached.get(key.url)?.clone(),put:async(key,response)=>cached.set(key.url,response)}),delete:async()=>cached.clear()},
 fetch:async url=>{calls.push(url);if(url.endsWith('bootstrap'))return Response.json(current);if(held){const wait=held;held=null;await wait;}return new Response('CHAPTER READY',{headers:{'x-chapter-hash':current.chapters.two.hash}});}};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const run=code=>vm.runInContext(code,sandbox);
assert.equal(await run("staticChapterHtml('book','viewer','a')"),'FIRST READY');assert.equal(calls.length,0,'embedded first chapter requires no request');
assert.equal(await run("staticChapterHtml('book','viewer','b')"),'CHAPTER READY');
assert.equal(cached.size,1);
await run("staticBootstrap('book',{force:true})");calls=[];
assert.equal(await run("staticChapterHtml('book','viewer','b')"),'CHAPTER READY');assert.equal(calls.length,0,'unchanged chapter comes from device cache');
current=bootstrap('new');await run("staticBootstrap('book',{force:true})");calls=[];
await run("staticChapterHtml('book','viewer','b')");assert.equal(calls.length,1,'updated chapter bypasses old hash cache');
await run('clearStaticChapterCache()');held=new Promise(r=>release=r);
const old=run("staticChapterHtml('book','viewer','b')");
await new Promise(r=>setTimeout(r,0));
current=bootstrap('newer');await run("staticBootstrap('book',{force:true})");release();await old;calls=[];
await run("staticChapterHtml('book','viewer','b')");assert.equal(calls.length,1,'in-flight old response cannot repopulate refreshed memory');
console.log('Static chapters: embedded content, device cache, revision changes and refresh races passed');
