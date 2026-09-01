import assert from "node:assert/strict";

import {
  buildAlphabeticalIndexEntries,
  fetchCompleteWordIndex,
} from "../../public/shared/word-index.js";

const words = [
  { id: "appear", spelling: "appear" },
  { id: "record", spelling: "record" },
  { id: "use", spelling: "use" },
];
const calls = [];
const index = await fetchCompleteWordIndex(async (offset, limit) => {
  calls.push({ offset, limit });
  const page = words.slice(offset, offset + 2);
  return { words: page, hasMore: offset + page.length < words.length };
});

assert.deepEqual(calls, [
  { offset: 0, limit: 300 },
  { offset: 2, limit: 300 },
]);
assert.deepEqual([...index.keys()], ["appear", "record", "use"]);
assert.deepEqual(index.get("record"), { id: "record", no: null });

const alphabeticalEntries = buildAlphabeticalIndexEntries([
  {
    id: "begin",
    spelling: "begin",
    seqNo: "1",
    derivatives: [{ word: "beginning" }],
    synonyms: "start, ##commence##, commence",
    antonyms: "end; stop",
    relatedWords: "origin、launch",
  },
  {
    id: "finish",
    spelling: "finish",
    seqNo: "2",
    synonyms: "end, conclude",
    antonyms: "start",
  },
  {
    id: "start",
    spelling: "start",
    seqNo: "3",
  },
]);

assert.deepEqual(alphabeticalEntries, [
  { spelling: "begin", loc: "1", targetId: "begin", isRef: false },
  { spelling: "beginning", loc: "→ begin 1", targetId: "begin", isRef: true },
  { spelling: "commence", loc: "→ begin 1", targetId: "begin", isRef: true },
  { spelling: "conclude", loc: "→ finish 2", targetId: "finish", isRef: true },
  { spelling: "end", loc: "→ begin 1", targetId: "begin", isRef: true },
  { spelling: "end", loc: "→ finish 2", targetId: "finish", isRef: true },
  { spelling: "finish", loc: "2", targetId: "finish", isRef: false },
  { spelling: "launch", loc: "→ begin 1", targetId: "begin", isRef: true },
  { spelling: "origin", loc: "→ begin 1", targetId: "begin", isRef: true },
  { spelling: "start", loc: "3", targetId: "start", isRef: false },
  { spelling: "stop", loc: "→ begin 1", targetId: "begin", isRef: true },
]);

console.log("Word index integration tests passed");
