import assert from "node:assert/strict";

import { createAutoCrossRefRenderer } from "../../public/shared/markup.js";

const entries = new Map([
  ["0", { id: "zero", no: 1 }],
  ["record", { id: "record", no: 20 }],
  ["take off", { id: "take-off", no: 30 }],
]);
const resolve = (headword) => {
  const hit = entries.get(headword.toLowerCase());
  return hit ? { found: true, ...hit } : { found: false };
};
const render = createAutoCrossRefRenderer(entries.keys(), { resolve });

const longestMatch = render("take offの用法とtakeを確認する。", { currentHeadword: "take" });
assert.match(longestMatch, /data-headword="take off"/);
assert.match(longestMatch, /<strong>take<\/strong>を確認する/);
assert.doesNotMatch(longestMatch, /<strong>take<\/strong> off/);

const urls = "see https://a.example and https://b.example";
assert.equal(render(urls), urls);

const pronunciation = render("//təˈdeɪ//", { currentHeadword: "record" });
assert.match(pronunciation, /^<span class="pronunciation-inline">.*<\/span>$/);
assert.doesNotMatch(pronunciation, /data-headword="0"|[\uE000-\uF8FF]/u);

const protectedHeadword = render("record //record//", { currentHeadword: "record" });
assert.match(protectedHeadword, /^<strong>record<\/strong> <span class="pronunciation-inline">/);
assert.doesNotMatch(protectedHeadword, /data-headword="record"/);

console.log("Markup integration tests passed");
