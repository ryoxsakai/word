import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as markup from '../../public/shared/markup.js';
import { createIdiomReferenceResolver } from '../../public/shared/idiom-references.js';
import { renderWordEntry } from '../../public/viewer/word-entry.js';

const words = [
  { id:'talk', spelling:'talk', branch:0, seqNo:'123-2', displayNo:'123-2', phrases:['talk about', 'talk to', 'talk about'], examples:[{type:'phrase',sentence:'talk about'},{type:'phrase',sentence:'talk to'}] },
  { id:'say', spelling:'say', branch:0, seqNo:5, displayNo:5, phrases:['shared phrase'] },
  { id:'tell', spelling:'tell', branch:0, seqNo:6, displayNo:6, phrases:['shared phrase'] },
  { id:'root', spelling:'root', branch:0, seqNo:7, displayNo:7, phrases:['root phrase'], derivatives:[{word:'rooted'}] },
];
const extract = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
for (const mode of ['viewer', 'setting']) {
  const source = await readFile(new URL(`../../public/${mode}/app.js`, import.meta.url), 'utf8');
  const state = { words, indexWords:words, referenceWords:words };
  const preview = { innerHTML:'', querySelectorAll:()=>[] };
  const input = { value:'talk about' };
  const context = vm.createContext({ ...markup, state, isMasterView:()=>false, el:{fieldSynonyms:input}, encodeURIComponent });
  vm.runInContext(extract(source,'function resolveRef(', mode === 'viewer' ? 'function resolveHeadwordRef(' : 'function updatePreview('), context);
  vm.runInContext(extract(source,mode === 'viewer' ? 'function buildIndex(' : 'function rebuildAutoCrossRefRenderer(', mode === 'viewer' ? '// ---- レンダリング ----' : 'async function ensureEditorReferences('), context);
  const build = mode === 'viewer' ? context.buildIndex : context.rebuildAutoCrossRefRenderer;
  build();
  const resolve = context.resolveRef;
  assert.equal(resolve('TALK ABOUT').id,'talk',mode);
  assert.equal(resolve('talk about more').found,false,'no partial match');
  assert.equal(resolve('shared phrase').found,false,'ambiguous parents');
  assert.equal(resolve('rooted').id,'root','existing derivative alias');
  assert.equal(resolve('idiom:talk about').found,false,'explicit namespace');
  const html = markup.renderWordListMarkup('talk about (話す), say, ==talk about==, ::talk about::', {resolve});
  assert.match(html, /href="#word-talk"[^>]*><strong>talk about<\/strong><span class="ref-no"> \(no\.123-2\)/);
  assert.equal((html.match(/href="#word-talk"/g)||[]).length,1,'protected markers do not link');
  assert.match(html, /<mark>talk about<\/mark>/);
  assert.ok(html.indexOf('word-say') < html.indexOf('word-talk'),'numeric sorting');
  assert.doesNotMatch(html,/話す/,'existing linked gloss policy');
  if (mode === 'setting') {
    vm.runInContext(extract(source,'function updatePreview(', 'function rebuildAutoCrossRefRenderer('),context);
    context.updatePreview(input,preview);
    assert.match(preview.innerHTML,/word-talk/,'actual editor preview');
  }
  const card = renderWordEntry({id:'discuss',spelling:'discuss',seqNo:8,senses:[],synonyms:'talk about',antonyms:'talk to',relatedWords:'root phrase'}, {resolveRef:resolve,resolveHeadwordRef:resolve,renderNotesMarkup:state.renderNotesMarkup,origin:'https://vocab.lrnr.jp'});
  assert.equal((card.match(/href="#word-talk"/g)||[]).length,2,'word renderer used in viewing and printing');
  assert.doesNotMatch(state.renderNotesMarkup('talk about', {currentHeadword:'talk'}),/<a /,'memo self reference stays bold');
  assert.match(markup.renderWordListMarkup('talk about',{resolve}),/word-talk/,'word list self reference retains existing behavior');
  state.idiomResolver = createIdiomReferenceResolver([{sections:[{items:[{key:'idiom-talk',phrase:'talk about',no:9}]}]}], name => {
    const hit = (state.wordIndex || state.listWordIndex).get(name.toLowerCase());
    return hit ? {found:true,...hit} : {found:false};
  });
  assert.equal(resolve('talk about').type,'idiom','registered idiom wins over phrase parent');
  const direct = {id:'direct',spelling:'talk about',branch:0,seqNo:10,displayNo:10};
  words.push(direct); build();
  assert.equal(resolve('talk about').id,'direct','independent headword wins');
  words.pop(); build();
  state.idiomResolver = null;
  state.indexWords = []; state.words = []; state.referenceWords = []; build();
  assert.equal(resolve('talk about').found,false,'switching lists clears phrase aliases');
}
console.log('Phrase references: real viewer/editor builders, preview, rendering, precedence, ambiguity, markup and reset passed');
// Other editors construct their own resolvers; exercise those actual functions too.
const table = await readFile(new URL('../../public/setting/table-mode.js',import.meta.url),'utf8');
const tableContext = vm.createContext({...markup,createIdiomReferenceResolver,groupIdiomEntries:()=>[],referenceIndex:[]});
vm.runInContext(extract(table,'function prepareReferences(', 'const pageSize ='),tableContext);
tableContext.prepareReferences(words,undefined,words);
assert.equal(tableContext.resolveReference('talk about').id,'talk','table preview');
assert.match(markup.renderWordListMarkup('talk about',{resolve:tableContext.resolveReference}),/no\.123-2/);
const idioms = await readFile(new URL('../../public/setting/idioms.js',import.meta.url),'utf8');
const idiomContext = vm.createContext({...markup,createIdiomReferenceResolver,groupIdiomEntries:()=>[],words,data:{entries:[],chapters:[]}});
vm.runInContext(extract(idioms,'function refreshReferences(', 'function hydrateSection('),idiomContext);
idiomContext.refreshReferences();
assert.equal(idiomContext.resolve('talk about').id,'talk','idiom preview');
const resolve = target=>({found:true,id:target,no:target==='talk'?2:1});
const mixed = markup.renderWordListMarkup('##talk## ::強調:: (補助語義), say',{resolve});
assert.ok(mixed.indexOf('word-say')<mixed.indexOf('word-talk'));
assert.doesNotMatch(mixed,/補助語義/);
assert.match(mixed,/<mark>強調<\/mark>/);
console.log('Table/idiom previews and mixed explicit-reference markup passed');
