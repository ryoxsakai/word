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
  { spelling: "begin", loc: "1", targetId: "begin", isRef: false },
  { spelling: "beginning", loc: "→ begin 1", targetId: "begin", isRef: true },
  { spelling: "commence", loc: "→ begin 1", targetId: "begin", isRef: true },
  { spelling: "conclude", loc: "→ finish 2", targetId: "finish", isRef: true },
  { spelling: "end", loc: "→ finish 2", targetId: "finish", isRef: true },
  { spelling: "finish", loc: "2", targetId: "finish", isRef: false },
  { spelling: "launch", loc: "→ begin 1", targetId: "begin", isRef: true },
  { spelling: "origin", loc: "→ begin 1", targetId: "begin", isRef: true },
  { spelling: "start", loc: "3", targetId: "start", isRef: false },
  { spelling: "stop", loc: "→ begin 1", targetId: "begin", isRef: true },
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
});
assert.deepEqual(referenceEntries.get("unmistakable"), {
  spelling: "unmistakable",
  loc: "→ apparent 9",
  targetId: "apparent",
  isRef: true,
});
assert.deepEqual(referenceEntries.get("hidden"), {
  spelling: "hidden",
  loc: "→ obvious 10",
  targetId: "obvious",
  isRef: true,
});
assert.deepEqual(referenceEntries.get("visible"), {
  spelling: "visible",
  loc: "→ obvious 10",
  targetId: "obvious",
  isRef: true,
});
assert.deepEqual(referenceEntries.get("contextual"), {
  spelling: "contextual",
  loc: "→ apparent 9",
  targetId: "apparent",
  isRef: true,
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
