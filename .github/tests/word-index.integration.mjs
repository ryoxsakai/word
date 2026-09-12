import assert from "node:assert/strict";

import {
  buildAlphabeticalIndexEntries,
  fetchCompleteWordIndex,
  getAlphabeticalIndexKey,
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
    synonyms: "start (始める), ##commence|commencement## (開始), commence",
    antonyms: "end; stop",
    relatedWords: "origin（起源）、launch (開始)",
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
  { spelling: "begin", loc: "1", targetId: "begin", isRef: false, kind: "word" },
  { spelling: "beginning", loc: "→ begin 1", targetId: "begin", isRef: true, kind: "derivative" },
  { spelling: "commence", loc: "→ begin 1", targetId: "begin", isRef: true, kind: "related" },
  { spelling: "conclude", loc: "→ finish 2", targetId: "finish", isRef: true, kind: "related" },
  { spelling: "end", loc: "→ finish 2", targetId: "finish", isRef: true, kind: "related" },
  { spelling: "finish", loc: "2", targetId: "finish", isRef: false, kind: "word" },
  { spelling: "launch", loc: "→ begin 1", targetId: "begin", isRef: true, kind: "related" },
  { spelling: "origin", loc: "→ begin 1", targetId: "begin", isRef: true, kind: "related" },
  { spelling: "start", loc: "3", targetId: "start", isRef: false, kind: "word" },
  { spelling: "stop", loc: "→ begin 1", targetId: "begin", isRef: true, kind: "related" },
]);


const priorityEntries = buildAlphabeticalIndexEntries([
  {
    id: "apparent",
    spelling: "apparent",
    seqNo: "9",
    synonyms: "evident (明白な), unmistakable (紛れもない)",
    relatedWords: "visible (目に見える), contextual (文脈上の)",
  },
  {
    id: "obvious",
    spelling: "obvious",
    seqNo: "10",
    synonyms: "evident (明らかな)",
    antonyms: "hidden (隠れた), visible (目に見える)",
  },
  {
    id: "evidence",
    spelling: "evidence",
    seqNo: "1786",
    derivatives: [{ word: "evident" }],
    antonyms: "unmistakable (紛れもない)",
    relatedWords: "hidden (隠れた)",
  },
]);

const referenceEntries = new Map(
  priorityEntries.filter((entry) => entry.isRef).map((entry) => [entry.spelling, entry])
);
assert.equal(priorityEntries.filter((entry) => entry.spelling === "evident").length, 1);
assert.deepEqual(referenceEntries.get("evident"), {
  spelling: "evident",
  loc: "→ evidence 1786",
  targetId: "evidence",
  isRef: true,
  kind: "derivative",
});
assert.deepEqual(referenceEntries.get("unmistakable"), {
  spelling: "unmistakable",
  loc: "→ apparent 9",
  targetId: "apparent",
  isRef: true,
  kind: "related",
});
assert.deepEqual(referenceEntries.get("hidden"), {
  spelling: "hidden",
  loc: "→ obvious 10",
  targetId: "obvious",
  isRef: true,
  kind: "related",
});
assert.deepEqual(referenceEntries.get("visible"), {
  spelling: "visible",
  loc: "→ obvious 10",
  targetId: "obvious",
  isRef: true,
  kind: "related",
});
assert.deepEqual(referenceEntries.get("contextual"), {
  spelling: "contextual",
  loc: "→ apparent 9",
  targetId: "apparent",
  isRef: true,
  kind: "related",
});

assert.equal(getAlphabeticalIndexKey("(at) first hand"), "first hand");
assert.equal(getAlphabeticalIndexKey("(just) around the corner"), "around the corner");
assert.equal(getAlphabeticalIndexKey("ordinary"), "ordinary");

const optionalPrefixEntries = buildAlphabeticalIndexEntries([
  { id: "around", spelling: "(just) around the corner", seqNo: "2" },
  { id: "first", spelling: "(at) first hand", seqNo: "3" },
  { id: "close", spelling: "close", seqNo: "1" },
]);
assert.deepEqual(
  optionalPrefixEntries.map((entry) => entry.spelling),
  ["(just) around the corner", "close", "(at) first hand"]
);

console.log("Word index integration tests passed");

const mixedEntries = buildAlphabeticalIndexEntries([
  { id: "act", spelling: "act", seqNo: "1", branch: 0 },
  { id: "active", spelling: "active", seqNo: "1-1", branch: 1 },
], [
  { key: "act-on", phrase: "act on", no: "2" },
  { key: "hidden", phrase: "hidden idiom", no: "3", hidden: true },
]);
assert.deepEqual(mixedEntries, [
  { spelling: "act", loc: "1", targetId: "act", isRef: false, kind: "word" },
  { spelling: "act on", loc: "熟 2", targetId: "act-on", isRef: false, kind: "idiom" },
  { spelling: "active", loc: "1-1", targetId: "active", isRef: false, kind: "derivative" },
]);
