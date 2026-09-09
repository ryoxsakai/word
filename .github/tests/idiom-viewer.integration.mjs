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
const state = { currentListId: "crossover-v3", indexWords: [{id: "submit", spelling: "submit", seqNo: "1315"}], idiomEntries: null, idiomGroups: [], idiomPromise: null, activeView: "list", search: "" };
let resolveFetch;
let fetches = 0;
const context = vm.createContext({ state, el: {idiomList: panel}, listLoadGeneration: 1,
  api: () => { fetches++; return new Promise(resolve => { resolveFetch = resolve; }); },
  buildIdiomEntries, groupIdiomEntries, resolveIdiomReferences, renderIdiomEntry, VIEWER_API_BASE: "https://vocab.lrnr.jp/mcp-viewer", escapeHtml, matchesEikenLevel: () => true, hierarchyIcon: () => "",
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
assert.match(panel.innerHTML, /hand O in/);
assert.match(panel.innerHTML, /href="#word-submit"/);
assert.match(panel.innerHTML, />submit \(no\.  1315\)<\/a>/);
assert.match(panel.innerHTML, /class="entry idiom-entry"/);
assert.match(panel.innerHTML, /data-idiom-no="1"/);
assert.match(panel.innerHTML, /class="entry-body"/);
assert.match(panel.innerHTML, /class="headword idiom-phrase"/);
assert.doesNotMatch(panel.innerHTML, /<figure/, "no empty image box before images are registered");
assert.equal(attrs.has("aria-busy"), false);
assert.doesNotMatch(panel.innerHTML, /skeleton-line/);
state.search = "提出";
context.renderIdioms();
assert.match(panel.innerHTML, /hand O in/);
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
assert.match(panel.innerHTML, /hand O in/);
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
const illustrated=renderIdiomEntry({...ordered[0].sections[0].items[0], illustration:{url:'/mcp-viewer/api/illustrations/example/abc123.png',meaning:'調べる'}},'https://vocab.lrnr.jp');
assert.match(illustrated,/class="entry-illustration"/);
assert.match(illustrated,/loading="lazy"/);
assert.doesNotMatch(renderIdiomEntry({key:'unsafe',no:'3',phrase:'<script>',meanings:[]},'https://vocab.lrnr.jp'), /<script>/);
console.log('Idiom word-card layout, stable numbering, navigation and future illustration tests passed');
const linked=renderIdiomEntry({key:'let-down',no:'1',phrase:'let O down',meanings:[{meaning:'Oを失望させる',refs:[
  {wordId:'disappoint',spelling:'disappoint',no:'1034',source:'synonym'},
  {wordId:'let',spelling:'let',no:'923',source:'phrase'},
]}]},'https://vocab.lrnr.jp');
assert.match(linked,/class="idiom-ref-icon" aria-hidden="true"/);
assert.match(linked,/href="#word-let"[^>]*>let \(no\.  923\)<\/a>/);
assert.match(linked,/href="#word-disappoint"[^>]*>disappoint \(no\.  1034\)<\/a>/);
assert(linked.indexOf('href="#word-let"')<linked.indexOf('href="#word-disappoint"'));
