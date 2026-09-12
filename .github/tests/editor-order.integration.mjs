import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const wordSource = await readFile(new URL("../../public/setting/app.js", import.meta.url), "utf8");
const idiomSource = await readFile(new URL("../../public/setting/idioms.js", import.meta.url), "utf8");
const slice = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const scroll = { scrollTop: 420, scrollLeft: 25 };
const detail = id => ({ id, spelling: id, meanings: [{ meaning: id + " detail" }] });
const state = {
  currentListId: "book", words: [], sectionWords: new Map([
    ["1", [{ ...detail("a"), sectionId: 1 }, { ...detail("a-child"), sectionId: 1 }]],
    ["2", [{ ...detail("b"), sectionId: 2 }]],
  ]), sectionPromises: new Map(), sectionDataGeneration: 0,
};
const freshWords = [
  { id: "b", spelling: "b", sectionId: 1, no: 1, displayNo: "1" },
  { id: "a", spelling: "a", sectionId: 2, no: 2, displayNo: "2" },
  { id: "a-child", spelling: "a-child", sectionId: 2, no: 2, branch: 1, displayNo: "2-1" },
];
const requests = [], alerts = [];
const context = vm.createContext({
  state, listLoadGeneration: 1, el: { tableScroll: scroll },
  editorIndexCache: new Map(), editorSectionCache: new Map(),
  editorSectionKey: value => value == null ? "none" : String(value),
  editorSectionCacheKey: (list, key) => list + ":" + key,
  api: async (path, options = {}) => {
    requests.push([path, options]);
    if (options.method === "POST") return {};
    if (path.endsWith("/editor/index")) return { words: freshWords };
    return [];
  },
  rebuildAutoCrossRefRenderer() {}, renderSectionOptions() {}, renderLabelOptions() {},
  renderWordTableHead() {}, renderWordTable() { scroll.scrollTop = 0; scroll.scrollLeft = 0; },
  loadExpandedNotebookSections: async () => {},
  alert: message => alerts.push(message),
});
vm.runInContext(slice(wordSource, "let editorOrderSaving", "// direction:"), context);
await context.submitReorder([{ wordId: "b", sectionId: 1 }, { wordId: "a", sectionId: 2 }]);
assert.equal(requests.length, 2, "word reorder fetches only the lightweight index");
assert.equal(state.sectionWords.get("1")[0].id, "b");
assert.deepEqual(Array.from(state.sectionWords.get("2"), word => word.id), ["a", "a-child"]);
assert.equal(state.sectionWords.get("2")[1].displayNo, "2-1");
assert.equal(state.sectionWords.get("2")[0].meanings[0].meaning, "a detail");
assert.deepEqual(scroll, { scrollTop: 420, scrollLeft: 25 });
await context.saveEditorOrder("sections/reorder", { sections: [] }, { hierarchy: true });
assert.equal(requests.slice(2).length, 5, "hierarchy reorder fetches metadata, never full entries");
let finish;
context.api = () => new Promise(resolve => { finish = resolve; });
const stale = context.refreshEditorOrder("book", 1);
state.currentListId = "other";
finish({ words: [] });
await stale;
assert.equal(state.words.length, 3, "stale order refresh cannot replace another notebook");
assert.equal(alerts.length, 0);

const entry = (key, sectionKey) => ({ key, sectionKey, phrase: key, meanings: [{ meaning: key + " meaning", refs: [] }] });
const a = entry("a", "s1"), b = entry("b", "s1"), hidden = { ...entry("h", "s1"), hidden: true }, z = entry("z", "s2");
const idiomRequests = [], idiomAlerts = [];
const idiomContext = vm.createContext({
  data: { chapters: [{ key: "chapter", sections: [{ key: "s1" }, { key: "s2" }] }], entries: [a, hidden, b, z] },
  sectionEntries: new Map([["s1", [a, hidden, b]], ["s2", [z]]]),
  sectionPromises: new Map(), listId: "book", generation: 1, lazyObserver: { disconnect() {} },
  el: { status: {}, section: { value: "" }, showHidden: { checked: false }, tableScroll: { scrollTop: 700, scrollLeft: 0 } },
  structuredClone, refreshReferences() {}, refreshSectionOptions() {}, setupLazyLoading() {},
  renderTable() { idiomContext.el.tableScroll.scrollTop = 0; },
  api: async (path, options) => { idiomRequests.push([path, JSON.parse(options.body)]); },
  alert: message => idiomAlerts.push(message),
});
vm.runInContext(slice(idiomSource, "function flatSections()", "function sectionLabels()") +
  slice(idiomSource, "function entryNumbers()", "function refreshReferences()") +
  "function filteredEntriesForSection(key) { return sectionEntries.get(key).filter(entry => !entry.hidden); }\n" +
  slice(idiomSource, "function moveInArray(", "function attachDragHandlers()"), idiomContext);
await idiomContext.moveEntry("a", 1);
assert.equal(idiomRequests.length, 1, "idiom reorder performs no reload");
assert.deepEqual(Array.from(idiomContext.sectionEntries.get("s1"), row => row.key), ["h", "b", "a"]);
assert.equal(idiomContext.el.tableScroll.scrollTop, 700);
await idiomContext.moveEntryToSection("a", "s2");
assert.deepEqual(Array.from(idiomContext.sectionEntries.get("s2"), row => row.key), ["a", "z"]);
assert.equal(idiomContext.sectionEntries.get("s2")[0].meanings[0].meaning, "a meaning");
assert.equal(idiomContext.entryNumbers().get("a"), "2");
await idiomContext.moveSection("s2", -1);
assert.equal(idiomContext.data.chapters[0].sections[0].key, "s2");
assert.equal(idiomContext.entryNumbers().get("a"), "1");
const beforeFailure = JSON.stringify(idiomContext.data);
idiomContext.api = async () => { throw new Error("offline"); };
await idiomContext.moveEntry("a", 1);
assert.equal(JSON.stringify(idiomContext.data), beforeFailure, "failed save restores order and membership");
assert.equal(idiomAlerts.length, 1);
let finishSave;
idiomContext.api = () => new Promise(resolve => { finishSave = resolve; });
const pending = idiomContext.moveEntry("a", 1);
await Promise.resolve(); await Promise.resolve();
await idiomContext.moveEntry("a", 1);
finishSave({});
await pending;
assert.deepEqual(Array.from(idiomContext.sectionEntries.get("s2"), row => row.key), ["z", "a"], "double clicks cannot overlap saves");
const another = idiomContext.moveEntry("a", -1);
await Promise.resolve(); await Promise.resolve();
idiomContext.listId = "other"; idiomContext.generation += 1;
idiomContext.data = { chapters: [], entries: [] };
finishSave({});
await another;
assert.equal(idiomContext.data.entries.length, 0, "stale save cannot replace another notebook");
console.log("Editor reorder cache, numbers, moves, rollback, concurrency and scroll tests passed");
