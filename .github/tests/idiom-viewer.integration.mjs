import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { buildIdiomEntries, groupIdiomEntries } from "../../public/shared/idioms.js";
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
  buildIdiomEntries, groupIdiomEntries, escapeHtml, matchesEikenLevel: () => true, hierarchyIcon: () => "",
});
vm.runInContext(code, context);
const first = context.ensureIdioms();
const second = context.ensureIdioms();
assert.equal(fetches, 1, "rapid tab clicks share one request");
resolveFetch({words: [{id: "submit", spelling: "submit", relatedWords: "hand O in (Oを提出する)"}]});
await Promise.all([first, second]);
assert.match(panel.innerHTML, /Chapter 1/);
assert.match(panel.innerHTML, /Section 1/);
assert.match(panel.innerHTML, /hand O in/);
assert.match(panel.innerHTML, /href="#word-submit"/);
assert.match(panel.innerHTML, />1315<\/a>/);
assert.equal(attrs.has("aria-busy"), false);
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
resolveFetch({words: [{id: "submit", spelling: "submit", relatedWords: "hand O in (古いデータ)"}]});
await stale;
assert.equal(state.idiomEntries, null, "stale requests cannot overwrite a refreshed list");

state.currentListId = "crossover-v3";
context.api = async () => { throw new Error("offline"); };
await assert.rejects(context.ensureIdioms(), /offline/);
assert.match(panel.innerHTML, /retry-idioms/);
assert.equal(state.idiomPromise, null, "failed requests remain retryable");
console.log("Idiom viewer loading, filtering, rendering, retry and stale-response tests passed");
