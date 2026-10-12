import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderWordEntry} from '../../public/viewer/word-entry.js';
import {collectPhraseCrossReferences,createPhraseCrossReferenceResolver} from '../../public/shared/markup.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const words=[{id:'talk',spelling:'talk',seqNo:'123-2',phrases:['talk about','talk to']}];
const resolveRef=createPhraseCrossReferenceResolver(new Map([['talk',{id:'talk',no:'123-2'}]]),collectPhraseCrossReferences(words));
const html=renderWordEntry({id:'discuss',spelling:'discuss',seqNo:1,senses:[],synonyms:'talk about, ==talk about==, ::talk about::',antonyms:'talk to',relatedWords:'talk about'}, {resolveRef,resolveHeadwordRef:()=>({found:false}),renderNotesMarkup:text=>text,origin:'https://vocab.lrnr.jp'});
const css=await readFile(new URL('../../public/viewer/style.css',import.meta.url),'utf8');
const app=await readFile(new URL('../../public/viewer/app.js',import.meta.url),'utf8');
const flow=app.slice(app.indexOf('function preparePrintIllustrationWrapping('),app.indexOf('function prepareLightweightPrintDom('));
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try {
 for(const mode of ['screen','standard','compact','section']) {
  const page=await browser.newPage({viewport:{width:393,height:1000}});
  await page.setContent(`<style>${css}</style><body data-print-pagination="${mode}"><main class="word-list">${html}</main></body>`);
  if(mode!=='screen') {
   await page.emulateMedia({media:'print'});
   await page.evaluate('(() => {\n'+flow+'\nconst el={printExampleColumns:{value:2}};const boundedIntegerPrintSetting=()=>2;preparePrintIllustrationWrapping();preparePrintEntryFlow();\n})()');
  }
  const links=await page.locator('a.ref').evaluateAll(nodes=>nodes.map(n=>({href:n.getAttribute('href'),text:n.textContent,visible:n.getClientRects().length>0})));
  assert.equal(links.length,3,mode);
  assert.ok(links.every(n=>n.href==='#word-talk'&&n.text.endsWith('(no.123-2)')&&n.visible),mode);
  assert.equal(await page.locator('mark').textContent(),'talk about');
  await page.close();
 }
 console.log('Phrase link DOM: mobile viewing and standard/compact/section print preparation passed');
}finally{await browser.close();}
