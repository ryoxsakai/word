import assert from "node:assert/strict";
import { createChapterCache, createChapterStore, chapterSectionKeys } from "../../public/viewer/chapter-cache.js";

const path = "/lists/book/viewer/index?initial=1";
const index = {
  list: { id: "book" }, chapters: [{ key: "db-12" }], words: [],
  sections: [{ key: "85", chapterKey: "db-12" }, { key: "86", chapterKey: "db-12" }, { key: "90", chapterKey: "db-20" }],
  initialSection: { key: "85", words: [{ id: "first" }] },
};
const values = new Map();
const store = { get: async key => structuredClone(values.get(key)), put: async (key, value) => values.set(key, structuredClone(value)), clear: async () => values.clear() };
const tasks = [];
const cache = createChapterCache({ store, now: () => 1000, schedule: task => tasks.push(task) });
const calls = [];
const fetcher = async (url, options) => {
  calls.push([url, options]);
  if (url === path) return structuredClone(index);
  assert.equal(url, "/lists/book/viewer/sections/86", "only missing Chapter 1 sections are prefetched");
  return { key: "86", words: [{ id: "second" }] };
};
const cold = await cache.load("origin:words", path, "viewer", fetcher);
assert.equal(cold.list.id, "book");
assert.equal(calls.length, 1, "cold startup does not wait for the rest of Chapter 1");
await tasks.shift()();
assert.deepEqual(values.get("origin:words").data.cachedSections.map(s => s.key), ["85"]);
assert.equal(calls.length, 1, "saving must not issue chapter-wide prefetches");
assert.ok(calls.every(([, options]) => !options.forceRefresh && options.silent));

// A slow/offline refresh cannot block or erase a previously saved chapter.
let rejectRefresh;
const warm = await cache.load("origin:words", path, "viewer", () => new Promise((_, reject) => { rejectRefresh = reject; }));
assert.equal(warm.cachedSections[0].words[0].id, "first");
rejectRefresh(new Error("offline"));
await new Promise(resolve => setImmediate(resolve));
assert.equal(values.get("origin:words").data.cachedSections.length, 1);

// A new index atomically replaces old section bodies and removed sections.
const fresh = { ...index, sections: [index.sections[0]], initialSection: { key: "85", words: [{ id: "edited" }] } };
await cache.load("origin:words", path, "viewer", async () => fresh, { forceRefresh: true });
await tasks.shift()();
assert.deepEqual(values.get("origin:words").data.cachedSections, [fresh.initialSection]);

// Old versions, expired/corrupt records and unavailable storage fall back to network.
for (const record of [null, { version: 9 }, { ...values.get("origin:words"), savedAt: -8 * 86400000 },
  { ...values.get("origin:words"), data: { ...fresh, cachedSections: [{ key: "wrong", words: [] }] } }]) {
  let network = 0;
  const fallback = createChapterCache({ store: { get: async () => record }, schedule: () => {}, now: () => 1000 });
  await fallback.load("test", path, "viewer", async () => { network++; return index; });
  assert.equal(network, 1);
}
const unavailable = createChapterStore(null);
assert.equal(await unavailable.get("anything"), null);
assert.equal(await unavailable.put("anything", {}), null);

const idioms = { managed: true, chapters: [
  { key: "empty", sections: [{ key: "hidden" }] },
  { key: "c1", sections: [{ key: "s1" }, { key: "s2" }] },
  { key: "c2", sections: [{ key: "s3" }] },
], entries: [{ sectionKey: "hidden", hidden: true }, ...["s1", "s2", "s3"].map(sectionKey => ({ sectionKey }))],
initialSection: { sectionKey: "s1", entries: [{ phrase: "first" }] } };
assert.deepEqual(chapterSectionKeys(idioms, "idioms"), ["s1", "s2"]);
await cache.load("origin:idioms", "/lists/book/idioms/index?initial=1", "idioms", async url => {
  if (url.includes("/index?")) return idioms;
  assert.equal(url, "/lists/book/idioms/sections/s2");
  return { sectionKey: "s2", entries: [{ phrase: "second" }] };
});
await tasks.shift()();
assert.equal(values.get("origin:idioms").data.cachedSections.length, 1);
assert.equal(values.get("origin:words").data.cachedSections[0].words[0].id, "edited", "word and idiom snapshots are isolated");
console.log("Chapter cache: cold/warm/offline, refresh, expiry, invalid data, storage fallback and idiom isolation passed");

// Clearing while a network refresh is pending must not repopulate storage.
let finishFetch;
const delayed = cache.load("pending", path, "viewer", () => new Promise(resolve => { finishFetch = resolve; }));
await new Promise(resolve => setImmediate(resolve));
await cache.clear();
finishFetch(index);
await delayed;
while (tasks.length) await tasks.shift()();
assert.equal(values.size, 0);

// Notify only when server content changes, without replacing the visible snapshot.
let updates = 0;
values.set("notice", {version: 1, savedAt: 1000, data: {...index, cachedSections: [index.initialSection]}});
const notifying = createChapterCache({store, now: () => 1000, schedule: () => {}, onUpdate: () => updates++});
await notifying.load("notice", path, "viewer", async () => structuredClone(index));
await new Promise(resolve => setImmediate(resolve));
assert.equal(updates, 0);
const visible = await notifying.load("notice", path, "viewer", async () => fresh);
await new Promise(resolve => setImmediate(resolve));
assert.equal(updates, 1);
assert.equal(visible.initialSection.words[0].id, "first");
console.log("No speculative requests, clear-during-refresh and update notification passed");
