import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { buildIdiomEntries, groupIdiomEntries, resolveIdiomReferences, IDIOM_CHAPTERS } from "../../public/shared/idioms.js";
import { escapeHtml } from "../../public/shared/markup.js";

// Exercise the real loader/filter/renderer without fetching or rendering a browser page.
const source = await readFile(new URL("../../public/viewer/app.js", import.meta.url), "utf8");
const code = source.slice(source.indexOf("async function ensureIdioms()"), source.indexOf("function setActiveView(view)"));
const attrs = new Map();
const panel = { innerHTML: "", setAttribute: (k,v) => attrs.set(k,v), removeAttribute: k => attrs.delete(k), addEventListener() {} };
const state = { currentListId: "crossover-v3", indexWords: [{id: "submit", seqNo: "1315"}], idiomEntries: null, idiomGroups: [], idiomPromise: null, activeView: "list", search: "" };
let resolveFetch;
let fetches = 0;
const context = vm.createContext({ state, el: {idiomList: panel}, listLoadGeneration: 1,
  api: () => { fetches++; return new Promise(resolve => { resolveFetch = resolve; }); },
  buildIdiomEntries, groupIdiomEntries, resolveIdiomReferences, escapeHtml, matchesEikenLevel: () => true, hierarchyIcon: () => "",
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
assert.match(panel.innerHTML, />1315<\/a>/);
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
