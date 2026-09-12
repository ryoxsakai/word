import assert from 'node:assert/strict';
import fs from 'node:fs';
import {groupIdiomEntries,resolveIdiomReferences} from '../../public/shared/idioms.js';
import {createIdiomReferenceResolver} from '../../public/shared/idiom-references.js';
import {renderMarkup,renderWordListMarkup,createAutoCrossRefRenderer} from '../../public/shared/markup.js';
import {renderIdiomEntry} from '../../public/viewer/idiom-entry.js';
const f=JSON.parse(fs.readFileSync(new URL('../../worker/test/fixtures/idiom-fields.json',import.meta.url))).after;
const words=[{id:'investigate',spelling:'investigate',seqNo:'100'},{id:'respect',spelling:'respect',seqNo:'101'},{id:'admire',spelling:'admire',seqNo:'102'}];
const groups=groupIdiomEntries(resolveIdiomReferences(f.entries,words),f.chapters);
const items=groups.flatMap(c=>c.sections.flatMap(s=>s.items));
assert.equal(items.length,1743);
assert.equal(new Set(items.map(e=>e.no)).size,1743);
assert.equal(items.at(-1).no,'1743');
assert(!items.some(e=>e.phrase==='be C'));
assert(!groups.some(c=>c.sections.some(s=>s.key==='g12-svc-state'||s.key==='g12-svo')));
const wordRef=name=>{const w=words.find(w=>w.spelling===name);return w?{found:true,id:w.id,no:w.seqNo}:{found:false};};
const resolve=createIdiomReferenceResolver(groups,wordRef);
const have=items.find(e=>e.phrase==='have O V / Ving / Vpp');
assert.equal(resolve('have O V-ed').id,have.key);
assert.equal(resolve('idiom:have O Vpp').id,have.key);
assert.equal(resolve.id(have.aliases.find(a=>a.key).key).id,have.key);
assert(!resolve('be C').found);
assert.equal(resolve('word:respect').id,'respect');
const memo=createAutoCrossRefRenderer([...words.map(w=>w.spelling),...resolve.phrases],{resolve});
const text=renderWordListMarkup('##idiom:look up to O##, respect, ##word:admire|Admire##',{resolve});
assert.match(text,/data-idiom-id=/);assert.match(text,/data-word-id="respect"/);assert.match(text,/>Admire<\/strong>/);
assert(!text.includes('>idiom:'));
assert.match(memo('##idiom:look up to O## と investigate'),/data-idiom-id=/);
assert.match(memo('##idiom:look up to O## と investigate'),/data-word-id="investigate"/);
const html=renderIdiomEntry(have,'',{resolve,renderNotes:memo});
assert.match(html,/①/);assert.match(html,/②/);assert.equal((html.match(/class="sense-line sense-primary"/g)||[]).length,1);
assert.match(html,/notes-memo/);assert(!html.includes('V-ed'));
const onlySecond=renderIdiomEntry({...have,meanings:[have.meanings[1]]},'',{resolve});assert.match(onlySecond,/②/);assert(!onlySecond.includes('sense-primary'));
const attack=renderMarkup('##idiom:look up to O|<img src=x onerror=alert(1)>## **<script>**',{resolve});
assert(!attack.includes('<img'));assert(!attack.includes('<script>'));assert.match(attack,/&lt;img/);
// Explicit kind disambiguates identical word/idiom names; ambiguous idiom aliases do not auto-link.
const conflict=createIdiomReferenceResolver([{sections:[{items:[{key:'i1',phrase:'respect',no:'1'},{key:'i2',phrase:'other',no:'2',aliases:[{phrase:'respect'}]}]}]}],wordRef);
assert.equal(conflict('respect').type,undefined);assert(!conflict('idiom:respect').found);
const fixedNumbers=groupIdiomEntries([
  {key:'fixed',phrase:'fixed',sectionKey:'later',meanings:[{meaning:'固定'}]},
], [{key:'chapter',subtitle:'chapter',sections:[
  {key:'empty-earlier',subtitle:'非表示',number:3},
  {key:'later',subtitle:'残す',number:8},
]}]);
assert.equal(fixedNumbers[0].sections[0].name,'Section 1');
assert.equal(fixedNumbers[0].sections[0].number,1);
assert.equal(fixedNumbers[0].sections[0].key,'later');
console.log('Idiom rich fields: shared markup, word/idiom targets, aliases, hidden sections, stable sense numbers and HTML safety passed');
