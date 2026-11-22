import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const main = readFileSync(new URL("../../public/setting/edit/main.js", import.meta.url), "utf8");
const flush = () => new Promise(resolve => setImmediate(resolve));
const ok = words => ({ ok: true, json: async () => ({ words }) });
const target = selector => ({ closest: requested => requested === selector ? { dataset: {} } : null });

function harness({ loadIdioms, readIndex, order = [{ id: "a", spelling: "apple", branch: 0 }] }) {
  const nodes = new Map(), calls = { load: 0, create: 0, attach: 0, fetch: 0 };
  function element() {
    const listeners = new Map();
    return {
      dataset: {}, style: { setProperty() {} }, classList: { toggle() {}, contains() { return false; }, add() {}, remove() {} },
      setAttribute() {}, addEventListener: (name, listener) => (listeners.has(name) || listeners.set(name, []), listeners.get(name).push(listener)),
      fire: (name, event) => listeners.get(name)?.forEach(listener => listener(event)),
      querySelectorAll: () => [], innerHTML: "", get childElementCount() { return this.innerHTML ? 1 : 0; },
    };
  }
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: get, querySelectorAll: () => [], documentElement: element(), body: element() },
    matchMedia: () => ({ matches: false }), addEventListener() {},
    onPublication() {}, sortable() {},
    VIEWER_API_BASE: "https://viewer.invalid", h: String,
    fetch(url) { assert.match(url, /\/viewer\/index$/); return readIndex(++calls.fetch); },
    createIdiomEditor() {
      calls.create++;
      return {
        attachContentsSorting() { calls.attach++; }, load() { return loadIdioms(++calls.load); },
        navSections: () => [], visibleEntries: () => [{ key: "i", phrase: "pick up" }],
      };
    },
    buildAlphabeticalIndexEntries: (words, idioms) => [
      ...words.map(w => ({ spelling: w.spelling, kind: "word", loc: w.seqNo })),
      ...words.flatMap(w => (w.references || []).map(spelling => ({ spelling, kind: "word", loc: w.seqNo, isRef: true }))),
      ...idioms.map(i => ({ spelling: i.phrase, kind: "idiom" })),
    ],
    getAlphabeticalIndexKey: String,
  });
  vm.runInContext(main.replace(/^import .*;$/gm, "").replace(/^start\(\);$/m, ""), context);
  context.order = order;
  vm.runInContext('words = { state: { list: {}, order }, seqOf: () => 1, navSections: () => [] }', context);
  return { calls, get, view: name => vm.runInContext(`setView(${JSON.stringify(name)})`, context) };
}

test("a rejected idiom load retries on next tab action without rebinding editor or duplicating pending reads", async () => {
  let finish;
  const app = harness({ loadIdioms: n => n === 1 ? Promise.reject(new Error("offline")) : new Promise(r => { finish = r; }), readIndex: () => Promise.resolve(ok([])) });
  app.view("idioms");
  await flush();
  assert.match(app.get("idiomList").innerHTML, /data-retry-idioms/);
  app.view("list");
  assert.equal(app.calls.load, 1);
  app.view("idioms");
  app.view("idioms");
  assert.deepEqual(app.calls, { load: 2, create: 1, attach: 1, fetch: 0 });
  finish();
  await flush();
  app.view("idioms");
  assert.equal(app.calls.load, 2);
});

test("index preserves available headwords and a pooled retry restores public references", async () => {
  let finish;
  const app = harness({
    loadIdioms: () => Promise.resolve(),
    readIndex: n => n === 1 ? Promise.resolve({ ok: false, status: 503 }) : new Promise(r => { finish = r; }),
  });
  app.view("index");
  await flush();
  const panel = app.get("indexList");
  assert.match(panel.innerHTML, /apple/);
  assert.match(panel.innerHTML, /data-retry-index/);
  panel.fire("click", { target: target("[data-retry-index]") });
  app.view("index");
  assert.equal(app.calls.fetch, 2);
  assert.equal(app.calls.load, 1);
  finish(ok([{ id: "a", references: ["orchard"] }]));
  await flush();
  assert.match(panel.innerHTML, /orchard/);
  assert.doesNotMatch(panel.innerHTML, /data-retry-index/);
});

test("index caches a genuinely successful empty response", async () => {
  const app = harness({ loadIdioms: () => Promise.resolve(), readIndex: () => Promise.resolve(ok([])), order: [] });
  app.view("index");
  await flush();
  app.view("list");
  app.view("index");
  await flush();
  assert.equal(app.calls.fetch, 1);
  assert.equal(app.calls.load, 1);
  assert.doesNotMatch(app.get("indexList").innerHTML, /data-retry-index/);
});

test("malformed index is not cached, and a superseded render leaves a hidden tab untouched", async () => {
  let finish;
  const app = harness({ loadIdioms: () => Promise.resolve(), readIndex: n => n === 1
    ? Promise.resolve({ ok: true, json: async () => ({}) }) : new Promise(r => { finish = r; }) });
  app.view("index");
  await flush();
  const panel = app.get("indexList");
  assert.match(panel.innerHTML, /data-retry-index/);
  app.view("index");
  app.view("list");
  const old = panel.innerHTML;
  finish(ok([{ id: "a", references: ["orchard"] }]));
  await flush();
  assert.equal(panel.innerHTML, old);
  app.view("index");
  await flush();
  assert.match(panel.innerHTML, /orchard/);
  assert.equal(app.calls.fetch, 2);
});

test("index retry relaunches only failed idiom load when public source already succeeded", async () => {
  const app = harness({ loadIdioms: n => n === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(), readIndex: () => Promise.resolve(ok([])) });
  app.view("index");
  await flush();
  const panel = app.get("indexList");
  assert.match(panel.innerHTML, /data-retry-index/);
  assert.doesNotMatch(panel.innerHTML, /pick up/);
  panel.fire("click", { target: target("[data-retry-index]") });
  await flush();
  assert.match(panel.innerHTML, /pick up/);
  assert.doesNotMatch(panel.innerHTML, /data-retry-index/);
  assert.deepEqual(app.calls, { load: 2, create: 1, attach: 1, fetch: 1 });
});
