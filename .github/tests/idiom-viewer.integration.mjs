import {createIdiomReferenceResolver} from "../../public/shared/idiom-references.js";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { buildIdiomEntries, groupIdiomEntries, resolveIdiomReferences, IDIOM_CHAPTERS } from "../../public/shared/idioms.js";
import { escapeHtml } from "../../public/shared/markup.js";
import { renderIdiomEntry } from "../../public/viewer/idiom-entry.js";

// Exercise the real loader/filter/renderer without fetching or rendering a browser page.
const source = await readFile(new URL("../../public/viewer/app.js", import.meta.url), "utf8");
const code = source.slice(source.indexOf("async function ensureIdioms()"), source.indexOf("function setActiveView(view)"));
const attrs = new Map();
const panel = { innerHTML: "", setAttribute: (k,v) => attrs.set(k,v), removeAttribute: k => attrs.delete(k), addEventListener() {} };
const state = { wordIndex:new Map(), currentListId: "crossover-v3", indexWords: [{id: "submit", spelling: "submit", seqNo: "1315"}], idiomEntries: null, idiomGroups: [], idiomPromise: null, activeView: "list", search: "" };
let resolveFetch;
let fetches = 0;
const context = vm.createContext({ PRINT_UI_MODE: false, prefetchSections: async () => {}, state, el: {idiomList: panel}, listLoadGeneration: 1,
  afterBodyPaint: async () => {
    assert.match(panel.innerHTML, /class="entry idiom-entry"/, "idiom body is rendered before yielding for navigation");
    assert.equal(attrs.has("aria-busy"), false, "body is readable before navigation");
  },
  api: () => { fetches++; return new Promise(resolve => { resolveFetch = resolve; }); },
  createIdiomReferenceResolver, buildIndex() {}, resolveRef: () => ({found:false}), buildIdiomEntries, groupIdiomEntries, resolveIdiomReferences, renderIdiomEntry, VIEWER_API_BASE: "https://vocab.lrnr.jp/mcp-viewer", escapeHtml, matchesEikenLevel: () => true, hierarchyIcon: () => "",
});
vm.runInContext(code, context);
const first = context.ensureIdioms();
const second = context.ensureIdioms();
assert.equal(fetches, 1, "rapid tab clicks share one request");
assert.equal(attrs.get("aria-busy"), "true");
assert.match(panel.innerHTML, /role="status"/);
assert.match(panel.innerHTML, /aria-hidden="true"/);
assert.equal((panel.innerHTML.match(/skeleton-line/g) || []).length, 8, "loading uses the shared word shimmer for four idiom rows");
const entries = buildIdiomEntries([{id: "submit", spelling: "submit", relatedWords: "hand O in (Oを提出する)"}]);
resolveFetch({managed: true, chapters: IDIOM_CHAPTERS, entries});
await Promise.all([first, second]);
assert.match(panel.innerHTML, /Chapter 1/);
assert.match(panel.innerHTML, /Section 1/);
assert.match(panel.innerHTML.replace(/<[^>]*>/g, ''), /hand O in/);
assert.doesNotMatch(panel.innerHTML, /href="#word-submit"/);
assert.doesNotMatch(panel.innerHTML, /idiom-ref-icon|class="idiom-refs"/);
assert.match(panel.innerHTML, /class="entry idiom-entry"/);
assert.match(panel.innerHTML, /data-idiom-no="1"/);
assert.match(panel.innerHTML, /class="entry-body"/);
assert.match(panel.innerHTML, /class="headword idiom-phrase"/);
assert.doesNotMatch(panel.innerHTML, /<figure/, "no empty image box before images are registered");
assert.equal(attrs.has("aria-busy"), false);
assert.doesNotMatch(panel.innerHTML, /skeleton-line/);
state.search = "提出";
context.renderIdioms();
assert.match(panel.innerHTML.replace(/<[^>]*>/g, ''), /hand O in/);
state.search = "no match";
context.renderIdioms();
assert.match(panel.innerHTML, /該当する熟語はありません/);

state.idiomEntries = null;
state.idiomPromise = null;
const stale = context.ensureIdioms();
context.listLoadGeneration = 2;
state.currentListId = "other";
resolveFetch({managed: true, chapters: IDIOM_CHAPTERS, entries});
await stale;
assert.equal(state.idiomEntries, null, "stale requests cannot overwrite a refreshed list");

state.currentListId = "crossover-v3";
context.api = async () => { throw new Error("offline"); };
await assert.rejects(context.ensureIdioms(), /offline/);
assert.match(panel.innerHTML, /retry-idioms/);
assert.doesNotMatch(panel.innerHTML, /skeleton-line/);
assert.equal(attrs.has("aria-busy"), false);
assert.equal(state.idiomPromise, null, "failed requests remain retryable");
// Unmigrated notebooks retain the existing extraction path.
const paths = [];
context.api = async path => { paths.push(path); return path.endsWith('/idioms') ? {managed: false} :
  {words: [{id: "submit", spelling: "submit", relatedWords: "hand O in (Oを提出する)"}]}; };
state.search = "";
await context.ensureIdioms();
assert.equal(paths.length, 2);
assert.match(panel.innerHTML.replace(/<[^>]*>/g, ''), /hand O in/);
// No fixed reference numbers: reordering changes the displayed number.
assert.equal(resolveIdiomReferences(entries, [{id: "submit", spelling: "submit", seqNo: "42"}])[0].meanings[0].refs[0].no, "42");
console.log("Idiom viewer loading, filtering, rendering, retry and stale-response tests passed");

const ordered=groupIdiomEntries([
  {key:'b',phrase:'take over',sectionKey:'take',meanings:[{meaning:'引き継ぐ',refs:[]}]},
  {key:'a',phrase:'look up',sectionKey:'look',meanings:[{meaning:'調べる',refs:[]}]},
]);
assert.deepEqual(ordered.flatMap(c=>c.sections.flatMap(s=>s.items.map(i=>[i.key,i.no]))),[['a','1'],['b','2']], 'numbers follow Chapter/Section order, not fetch order');
state.idiomGroups=ordered;
state.search='take';
state.eikenLevel='all';
context.renderIdioms();
assert.match(panel.innerHTML,/data-idiom-no="2"/, 'search preserves the complete-list number');
assert.match(panel.innerHTML,/引き継ぐ/, 'unlinked idioms and meanings remain searchable in the all-levels view');
assert.doesNotMatch(panel.innerHTML,/idiom-refs|idiom-ref-icon/, 'unlinked meanings have no reference icon or empty reference row');
let bottom='';
context.setBottomNavContent=html=>{bottom=html;};
context.el.contentsNav={innerHTML:''};
context.renderIdiomNavigation();
assert.match(bottom,/>Section 2<\/button>/);
assert.doesNotMatch(bottom,/>take<\/button>/);
const illustrated=renderIdiomEntry({...ordered[0].sections[0].items[0], illustration:{url:'/mcp-viewer/api/idiom-illustrations/grammar-idiom-example/11111111-1111-1111-1111-111111111111.png',meaning:'調べる'}},'https://vocab.lrnr.jp');
assert.match(illustrated,/class="entry-illustration"/);
assert.match(illustrated,/loading="lazy"/);
assert.doesNotMatch(renderIdiomEntry({key:'unsafe',no:'3',phrase:'<script>',meanings:[]},'https://vocab.lrnr.jp'), /<script>/);
console.log('Idiom word-card layout, stable numbering, navigation and future illustration tests passed');

const curriculum=JSON.parse(await readFile(new URL('../../worker/test/fixtures/grammar-curriculum.json',import.meta.url),'utf8')).after;
state.idiomGroups=groupIdiomEntries(curriculum.entries,curriculum.chapters);
state.search='';
context.renderIdioms();
context.renderIdiomNavigation();
assert.equal((panel.innerHTML.match(/class="group-divider"/g)||[]).length,22);
assert.match(panel.innerHTML,/Group 1/);
assert.match(panel.innerHTML,/決まった形を取る第2文型動詞/);
assert.equal((context.el.contentsNav.innerHTML.match(/class="contents-subgroup"/g)||[]).length,22);
state.search='go bad';
context.renderIdioms();
assert.match(panel.innerHTML,/Group 1/);
assert.match(panel.innerHTML,/Section 1/);
assert.match(panel.innerHTML,/go bad/);
console.log('Grammar Group headings, navigation and stable filtered hierarchy passed');
const linked=renderIdiomEntry({key:'let-down',no:'1',phrase:'let O down',meanings:[{meaning:'Oを失望させる',refs:[
  {wordId:'disappoint',spelling:'disappoint',no:'1034',source:'synonym'},
  {wordId:'let',spelling:'let',no:'923',source:'phrase'},
]}]},'https://vocab.lrnr.jp');
assert.doesNotMatch(linked,/idiom-ref-icon|class="idiom-refs"/);
assert.doesNotMatch(linked,/href="#word-let"/);
assert.doesNotMatch(linked,/href="#word-disappoint"/);

// Preposition coloring leaves phrase text and navigation identity intact.
{
  const { renderIdiomPrepositions: render } = await import('../../public/shared/idiom-prepositions.js');
  const marked = text => [...render(text).matchAll(/<span class="idiom-(?:preposition|adverb)">(.*?)<\/span>/g)].map(match => match[1]);
  for (const [phrase, expected] of [
    ['look like', ['like']], ['look like A', ['like']], ['looks like A', ['like']],
    ['feel like V-ing', ['like']], ['sound like A', ['like']], ['be like A', ['like']],
    ['would like', []], ['would like A', []], ['would like to V', []],
    ['would like to look like A', ['like']], ['like A', []],
    ['depend on', ['on']], ['be interested in', ['in']],
    ['out of order', ['out of']], ['Out of the blue', ['Out of']],
    ['look forward to', ['forward', 'to']], ['look forward to V-ing', ['forward', 'to']],
    ['look up to O', ['up', 'to']], ['in order to V', ['in']],
    ['want to do', []], ['used to V', []], ['give up', ['up']], ['take off', ['off']], ['hand O in', ['in']], ['put O off', ['off']], ['come back', ['back']], ['work hard', []],
    ['be used to doing', ['to']], ['as if', []], ['as a result of', ['as', 'of']],
  ]) assert.deepEqual(marked(phrase), expected, phrase);
  assert.equal(render('out of order', []), 'out of order');
  assert.match(render('give up', [1]), /idiom-preposition">up/);
  assert.equal(render('<script>out of</script>').replace(/<span class="idiom-preposition">|<\/span>/g, ''), '&lt;script&gt;out of&lt;/script&gt;');
  const card = renderIdiomEntry({key:'out-of-order', no:'1', phrase:'out of order', meanings:[]}, 'https://vocab.lrnr.jp');
  assert.match(card, /id="idiom-out-of-order"/);
  assert.match(card, /class="idiom-preposition">out of<\/span>/);
}

{
  const { renderIdiomPrepositions: render } = await import('../../public/shared/idiom-prepositions.js');
  const parts = text => [...render(text).matchAll(/<span class="idiom-(preposition|adverb)">(.*?)<\/span>/g)].map(m => [m[2],m[1]]);
  for (const [phrase, expected] of [
    ['look forward to', [['forward','adverb'],['to','preposition']]],
    ['look forward to V-ing', [['forward','adverb'],['to','preposition']]],
    ['look up to A', [['up','adverb'],['to','preposition']]],
    ['out of order', [['out of','preposition']]],
    ['give up', [['up','adverb']]], ['hand O in', [['in','adverb']]],
    ['put on O', [['on','adverb']]], ['go in A', [['in','preposition']]],
    ['look like A', [['like','preposition']]], ['would like to V', []],
  ]) assert.deepEqual(parts(phrase),expected,phrase);
  assert.match(render('custom word', {adverbs:[1]}), /idiom-adverb">word/);
}

const labeled = context.renderLabeledIdiomEntries({labels:[{key:'reason',name:'理由 <script>'},{key:'exchange',name:'交換'}],items:[{...entries[0],labelKey:'reason'},{...entries[0],labelKey:'reason'},{...entries[0],labelKey:'exchange'}]});
assert.equal((labeled.match(/class="label-divider"/g)||[]).length,2);
assert.match(labeled,/理由 &lt;script&gt;/);
assert.equal((context.renderLabeledIdiomEntries({labels:[{key:'reason',name:'理由'}],items:[]}).match(/label-divider/g)||[]).length,0);
console.log('Idiom Label headings: grouping, empty filters and HTML escaping passed');
