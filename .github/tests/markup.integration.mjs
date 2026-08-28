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

const grammar = render(
  "to V、Ving、V-ed、to be V-ed、that、whether、if、should、動詞の原形、名詞節、句、節、第4文型、目的語。"
);
for (const term of [
  "to V",
  "Ving",
  "V-ed",
  "to be V-ed",
  "that",
  "whether",
  "if",
  "should",
  "動詞の原形",
  "名詞節",
  "句",
  "節",
  "第4文型",
  "目的語",
]) {
  assert.match(grammar, new RegExp(`<strong>${term}</strong>`));
}

const grammarBoundaries = render("a different shoulder if should");
assert.match(grammarBoundaries, /^a different shoulder <strong>if<\/strong> <strong>should<\/strong>$/);
assert.doesNotMatch(grammarBoundaries, /<strong>if<\/strong>ferent|<strong>should<\/strong>er/);
assert.doesNotMatch(grammarBoundaries, /<strong>a<\/strong>/);

const grammarFalsePositives = render("第10節、節約、語句");
assert.match(grammarFalsePositives, /^第10節、節約、<strong>語句<\/strong>$/);
assert.doesNotMatch(grammarFalsePositives, /第10<strong>節<\/strong>|<strong>節<\/strong>約|語<strong>句<\/strong>/);

const protectedGrammar = render("//that Ving// と ##record##");
assert.match(protectedGrammar, /^<span class="pronunciation-inline">/);
assert.doesNotMatch(protectedGrammar, /pronunciation-inline[^<]*<strong>|<strong>that<\/strong>|<strong>Ving<\/strong>/);
assert.match(protectedGrammar, /data-headword="record"/);

console.log("Markup integration tests passed");
