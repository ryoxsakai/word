import assert from "node:assert/strict";

import { fetchCompleteWordIndex } from "../../public/shared/word-index.js";

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

console.log("Word index integration tests passed");
