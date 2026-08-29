import assert from "node:assert/strict";

import { createAutoCrossRefRenderer, stripMarkup } from "../../public/shared/markup.js";

const entries = new Map([
  ["0", { id: "zero", no: 1 }],
  ["in", { id: "in", no: 10 }],
  ["like", { id: "like", no: 15 }],
  ["record", { id: "record", no: 20 }],
  ["take off", { id: "take-off", no: 30 }],
]);
const resolve = (headword) => {
  const hit = entries.get(headword.toLowerCase());
  return hit ? { found: true, ...hit } : { found: false };
};
const render = createAutoCrossRefRenderer(entries.keys(), { resolve });

const longestMatch = render("take offの用法とtakeを確認する。", { currentHeadword: "take" });
assert.match(longestMatch, /<strong><a [^>]*data-headword="take off"/);
assert.match(longestMatch, /<strong>take<\/strong>を確認する/);
assert.doesNotMatch(longestMatch, /<strong>take<\/strong> off|<strong>off<\/strong>/);

const url = "https://a.example/to/in-spite-of/";
assert.equal(render(url), url);

const pronunciation = render("動 //ɹɪfjúz//、名 //ɹɛ́fjus//。");
assert.match(
  pronunciation,
  /^動 <span class="pronunciation-inline">\/ɹɪfjúz\/<\/span>、名 <span class="pronunciation-inline">\/ɹɛ́fjus\/<\/span>。$/
);
assert.doesNotMatch(pronunciation, /\/\/|<strong>/);

const protectedHeadword = render("record //record//", { currentHeadword: "record" });
assert.match(protectedHeadword, /^<strong>record<\/strong> <span class="pronunciation-inline">\/record\/<\/span>$/);
assert.doesNotMatch(protectedHeadword, /data-headword="record"|[\uE000-\uF8FF]/u);

const requestedExamples = render(
  "at/byは出来事・結果。keep O C。OをCのままにする。動詞の原形、名詞節。"
);
assert.equal(
  requestedExamples,
  "<strong>at</strong>/<strong>by</strong>は出来事・結果。<strong>keep</strong> <strong>O</strong> <strong>C</strong>。OをCのままにする。動詞の原形、名詞節。"
);

const placeholderContext = render("turn O Cは第5文型。S Vとする。O/Vingを取る。Cには形容詞を置く。");
assert.match(placeholderContext, /^<strong>turn<\/strong> <strong>O<\/strong> <strong>C<\/strong>は/);
assert.match(placeholderContext, /<strong>S<\/strong> <strong>V<\/strong>とする/);
assert.match(placeholderContext, /<strong>O<\/strong>\/<strong>Ving<\/strong>を取る/);
assert.match(placeholderContext, /。Cには形容詞を置く。$/);
assert.doesNotMatch(placeholderContext, /<strong>第5文型|<strong>形容詞|<strong>C<\/strong>には/);

const objectPlaceholders = render("Aに利益をもたらす。Bから奪う。give A B。A/B。");
assert.equal(
  objectPlaceholders,
  "Aに利益をもたらす。Bから奪う。<strong>give</strong> <strong>A</strong> <strong>B</strong>。<strong>A</strong>/<strong>B</strong>。"
);

const allEnglishWords = render("a different shoulder if should");
assert.equal(
  allEnglishWords,
  "<strong>a</strong> <strong>different</strong> <strong>shoulder</strong> <strong>if</strong> <strong>should</strong>"
);

const manualBold = render("これは**重要語**。**very important**。**O**を使う。**A**に。");
assert.equal(
  manualBold,
  "これは<strong>重要語</strong>。<strong>very important</strong>。<strong>O</strong>を使う。<strong>A</strong>に。"
);
assert.equal(stripMarkup("**重要**と*語根*"), "重要と語根");

const linkedWords = render("like と ##record##");
assert.match(linkedWords, /<strong><a [^>]*data-headword="like"/);
assert.match(linkedWords, /<strong><a [^>]*data-headword="record"/);

const japaneseLinkLabel = render("##record|記録##");
assert.match(japaneseLinkLabel, /^<a [^>]*data-headword="record"[^>]*>記録 \(no\.20\)<\/a>$/);
assert.doesNotMatch(japaneseLinkLabel, /<strong>/);

const phrasalVerbLink = render("take off");
assert.match(phrasalVerbLink, /^<strong><a [^>]*data-headword="take off"/);
assert.doesNotMatch(phrasalVerbLink, /<strong>off<\/strong>/);

const protectedMarkup = render("//that Ving// と ##like##");
assert.match(protectedMarkup, /^<span class="pronunciation-inline">\/.*\/<\/span>/);
assert.doesNotMatch(protectedMarkup, /pronunciation-inline[^<]*<strong>|<strong>that<\/strong>|<strong>Ving<\/strong>/);
assert.match(protectedMarkup, /<strong><a [^>]*data-headword="like"/);
assert.doesNotMatch(protectedMarkup, /[\uE000-\uF8FF]/u);

console.log("Markup integration tests passed");
