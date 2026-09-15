import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../public/viewer/app.js", import.meta.url), "utf8");
const loader = source.slice(source.indexOf("async function selectList("), source.indexOf("function assignSequentialNumbers()"));

for (const stale of [false, true]) {
  const events = [];
  let resumePaint;
  const context = vm.createContext({
    state: { activeView: "list" },
    el: { emptyMsg: {}, idiomList: {}, indexList: {}, wordList: {}, searchInput: { value: "" } },
    localStorage: { setItem() {} }, LAST_LIST_KEY: "list",
    listLoadGeneration: 0, searchGeneration: 0, navigationGeneration: 0, lazyLoadGeneration: 0,
    sectionObserver: null, indexObserver: null, lazySectionObserver: null, idiomLazyObserver: null,
    viewerIndexCache: new Map([["book", { words: [{ id: "first" }], sections: [{ key: "first" }], initialSection: { key: "first" } }]]),
    sectionResponseCache: new Map(), sectionCacheKey: (list, key) => `${list}:${key}`,
    beginPageLoading() { events.push("loading"); },
    endPageLoading() { events.push("readable"); },
    renderLoadedSection() { events.push("body"); },
    loadSection: async () => { events.push("first-section"); },
    afterBodyPaint: () => new Promise(resolve => { events.push("paint"); resumePaint = resolve; }),
    renderContentsNav() { events.push("contents"); },
    renderActiveBottomNav() { events.push("bottom-nav"); },
    setupLazySectionObserver() { events.push("lazy-load"); },
    ensureIdioms: async () => {}, applyHashScroll: async () => {},
    PRINT_BOOK_MODE: false, PRINT_PART: "front", escapeHtml: value => value,
  });
  for (const name of ["clearNavigationAnchors", "assignSequentialNumbers", "buildIndex", "renderBookMatter", "renderSectionShells", "setupSectionObserver", "setupIndexObserver"]) context[name] = () => {};
  vm.runInContext(loader, context);
  const loading = context.selectList("book");
  // Advance the await on the cached first section, but leave painting pending.
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ["loading", "body", "first-section", "readable", "paint"]);
  if (stale) context.listLoadGeneration++;
  resumePaint();
  await loading;
  assert.equal(events.filter(event => event === "readable").length, 1, "page loading is released exactly once");
  if (stale) {
    assert.ok(!events.includes("contents"), "an obsolete load must not replace navigation after painting");
  } else {
    assert.ok(events.indexOf("contents") > events.indexOf("paint"));
    assert.ok(events.indexOf("lazy-load") > events.indexOf("contents"));
  }
}
console.log("Body-first startup, deferred navigation and stale-load guards passed");
