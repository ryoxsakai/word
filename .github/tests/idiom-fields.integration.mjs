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

// Object placeholders, separable word order, omission and spacing resolve to
// one canonical heading without changing the stored input or explicit labels.
const objectItems = [
  {key:'carry', phrase:'carry O out', no:'42'},
  {key:'look', phrase:'look after O', no:'43'},
  {key:'hidden', phrase:'hide O away', no:'44', hidden:true},
  {key:'two-slots', phrase:'compare A with B', no:'45'},
];
const objectResolve = createIdiomReferenceResolver([{sections:[{items:objectItems}]}]);
const objectMemo = createAutoCrossRefRenderer(objectResolve.phrases, {resolve:objectResolve, idiomReferences:objectResolve.phrases});
for (const input of ['carry out', 'carry A out', 'carry out A', 'carry out O', 'carry O out', 'CARRY   out\tA']) {
  assert.equal(objectResolve(input).id, 'carry', input);
  for (const html of [renderWordListMarkup(input,{resolve:objectResolve}), objectMemo(`${input}も参照。`)]) {
    assert.match(html, /data-idiom-id="carry"/);
    assert.match(html, /<strong>carry O out<\/strong>/);
    assert.match(html, /熟 42/);
  }
}
assert.match(renderMarkup('##carry out A##',{resolve:objectResolve}), />carry O out</);
assert.match(renderMarkup('##carry out A|実行する##',{resolve:objectResolve}), />実行する</);
assert.equal(objectResolve('look after A').id, 'look');
assert.equal(objectResolve('look A after').found, false, 'do not move an object before a preposition');
assert.equal(objectResolve('hide away').found, false);
assert.equal(objectResolve('compare with').found, false, 'do not collapse multiple distinct slots');
assert.doesNotMatch(objectMemo('scarry out / carry outsider'), /data-idiom-id="carry"/);
assert.doesNotMatch(objectMemo('https://example.test/carry-out'), /data-idiom-id="carry"/);
const ambiguousObjects = createIdiomReferenceResolver([{sections:[{items:[
  {key:'see-inside', phrase:'see O through', no:'1'},
  {key:'see-after', phrase:'see through O', no:'2'},
]}]}]);
assert.equal(ambiguousObjects('see through').found, false);
assert.equal(ambiguousObjects('see through A').found, false);
assert.equal(ambiguousObjects('see through O').id, 'see-after', 'registered exact headwords win');
const explicitObjects = createIdiomReferenceResolver([{sections:[{items:[...objectItems,{key:'exact',phrase:'carry out',no:'46'}]}]}]);
assert.equal(explicitObjects('carry out').id, 'exact');
console.log('Idiom object variants: canonical labels, ordering, whitespace, explicit labels and ambiguity passed');
