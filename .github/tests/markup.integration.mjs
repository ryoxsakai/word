import assert from "node:assert/strict";

import {
  addDerivativeCrossReferenceAliases,
  collectDerivativeCrossReferences,
  collectPhraseCrossReferences,
  createAutoCrossRefRenderer,
  renderWordListMarkup,
  stripMarkup,
} from "../../public/shared/markup.js";

const entries = new Map([
  ["0", { id: "zero", no: 1 }],
  ["in", { id: "in", no: 10 }],
  ["like", { id: "like", no: 15 }],
  ["seem", { id: "seem", no: 16 }],
  ["record", { id: "record", no: 20 }],
  ["take off", { id: "take-off", no: 30 }],
  ["have", { id: "have", no: 122 }],
  ["bearing", { id: "bearing", no: 776 }],
]);
const resolve = (headword) => {
  const hit = entries.get(headword.toLowerCase());
  return hit ? { found: true, ...hit } : { found: false };
};
const render = createAutoCrossRefRenderer(entries.keys(), { resolve });

const phraseReferences = collectPhraseCrossReferences([
  {
    spelling: "bearing",
    examples: [
      { type: "phrase", sentence: "have a bearing on O" },
      { type: "example", sentence: "It has a bearing on the result." },
    ],
  },
  { spelling: "record", phrases: ["keep a record of O"] },
  { spelling: "seem", phrases: ["seem C", "seem to V"] },
  { spelling: "alpha", phrases: ["shared phrase"] },
  { spelling: "beta", phrases: ["shared phrase"] },
]);
assert.deepEqual(phraseReferences, [
  { phrase: "have a bearing on O", target: "bearing" },
  { phrase: "keep a record of O", target: "record" },
  { phrase: "seem C", target: "seem" },
  { phrase: "seem to V", target: "seem" },
]);

const renderWithPhrases = createAutoCrossRefRenderer(entries.keys(), { resolve, phraseReferences });
const phraseLink = renderWithPhrases("have a bearing on Oは『Oに関係がある』。", {
  currentHeadword: "record",
});
assert.match(
  phraseLink,
  /^<a [^>]*data-headword="bearing"[^>]*><strong>have a bearing on O<\/strong><span class="ref-no"> \(no\.776\)<\/span><\/a>は/
);
assert.doesNotMatch(phraseLink, /data-headword="have"|have \(no\.122\)/);

const selfPhrase = renderWithPhrases("seem C／seem to Vは第2文型。", {
  currentHeadword: "seem",
});
assert.equal(
  selfPhrase,
  '<strong class="memo-current-headword">seem</strong> <strong>C</strong>／<strong class="memo-current-headword">seem</strong> <strong>to</strong> <strong>V</strong>は第2文型。'
);
assert.doesNotMatch(selfPhrase, /data-headword="seem"/);

const otherWordsRemainBoldOnly = renderWithPhrases("seemはappearと似る。", {
  currentHeadword: "seem",
});
assert.match(otherWordsRemainBoldOnly, /^<strong class="memo-current-headword">seem<\/strong>は<strong>appear<\/strong>と似る。$/);
assert.doesNotMatch(otherWordsRemainBoldOnly, /memo-current-headword">appear/);

const derivativeReferences = collectDerivativeCrossReferences([
  { spelling: "succeed", derivatives: [{ word: "success" }, { word: "successful" }] },
  { spelling: "alpha", derivatives: ["shared derivative"] },
  { spelling: "beta", derivatives: [{ word: "shared derivative" }] },
]);
assert.deepEqual(derivativeReferences, [
  { derivative: "success", target: "succeed" },
  { derivative: "successful", target: "succeed" },
]);

const derivativeHeadwords = new Map(entries);
derivativeHeadwords.set("succeed", { id: "succeed", no: 40 });
const derivativeIndex = addDerivativeCrossReferenceAliases(derivativeHeadwords, derivativeReferences);
const resolveDerivative = (headword) => {
  const hit = derivativeIndex.get(headword.toLowerCase());
  return hit ? { found: true, ...hit } : { found: false };
};
const renderWithDerivatives = createAutoCrossRefRenderer(derivativeHeadwords.keys(), {
  resolve: resolveDerivative,
  derivativeReferences,
});
const derivativeLink = renderWithDerivatives("successは結果を表す。", { currentHeadword: "record" });
assert.match(
  derivativeLink,
  /^<a [^>]*href="#word-succeed"[^>]*data-headword="succeed"[^>]*><strong>success<\/strong><span class="ref-no"> \(no\.40\)<\/span><\/a>は/
);
assert.equal(
  renderWordListMarkup("success", { resolve: resolveDerivative }),
  '<a href="#word-succeed" class="ref" data-headword="success" data-word-id="succeed">success<span class="ref-no"> (no.40)</span></a>'
);
assert.doesNotMatch(
  renderWithDerivatives("successは派生名詞。", { currentHeadword: "succeed" }),
  /data-word-id="succeed"/
);

const independentSuccessIndex = new Map(derivativeHeadwords);
independentSuccessIndex.set("success", { id: "success", no: 41 });
const resolvedIndependentSuccess = addDerivativeCrossReferenceAliases(independentSuccessIndex, derivativeReferences);
assert.equal(resolvedIndependentSuccess.get("success").id, "success");

const longestMatch = render("take offの用法とtakeを確認する。", { currentHeadword: "take" });
assert.match(longestMatch, /<a [^>]*data-headword="take off"[^>]*><strong>/);
assert.match(longestMatch, /<strong class="memo-current-headword">take<\/strong>を確認する/);
assert.doesNotMatch(longestMatch, /memo-current-headword">take<\/strong> off|>off<\/strong>/);

const referenceNumbers = render("(no. 221)と（No．221-1）は参照番号。");
assert.equal(
  referenceNumbers,
  '<span class="ref-no">(no. 221)</span>と<span class="ref-no">（No．221-1）</span>は参照番号。'
);
assert.doesNotMatch(referenceNumbers, /<strong[^>]*>no|<strong[^>]*>No/);

const url = "https://a.example/to/in-spite-of/";
assert.equal(render(url), url);

const pronunciation = render("動 //ɹɪfjúz//、名 //ɹɛ́fjus//。");
assert.match(
  pronunciation,
  /^動 <span class="pronunciation-inline">\/ɹɪfjúz\/<\/span>、名 <span class="pronunciation-inline">\/ɹɛ́fjus\/<\/span>。$/
);
assert.doesNotMatch(pronunciation, /\/\/|<strong>/);

const protectedHeadword = render("record //record//", { currentHeadword: "record" });
assert.match(protectedHeadword, /^<strong class="memo-current-headword">record<\/strong> <span class="pronunciation-inline">\/record\/<\/span>$/);
assert.doesNotMatch(protectedHeadword, /data-headword="record"|[\uE000-\uF8FF]/u);

const requestedExamples = render(
  "at/byは出来事・結果。keep O C。OをCのままにする。動詞の原形、名詞節。"
);
assert.equal(
  requestedExamples,
  '<strong>at</strong>/<strong>by</strong>は出来事・結果。<strong>keep</strong> <strong>O</strong> <strong>C</strong>。OをCのままにする。動詞の原形、名詞節。'
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
  'Aに利益をもたらす。Bから奪う。<strong>give</strong> <strong>A</strong> <strong>B</strong>。<strong>A</strong>/<strong>B</strong>。'
);

const allEnglishWords = render("a different shoulder if should");
assert.equal(
  allEnglishWords,
  '<strong>a</strong> <strong>different</strong> <strong>shoulder</strong> <strong>if</strong> <strong>should</strong>'
);

const manualBold = render("これは**重要語**。**very important**。**O**を使う。**A**に。");
assert.equal(
  manualBold,
  'これは<strong>重要語</strong>。<strong>very important</strong>。<strong>O</strong>を使う。<strong>A</strong>に。'
);
assert.equal(stripMarkup("**重要**と*語根*"), "重要と語根");

const linkedWords = render("like と ##record##");
assert.match(linkedWords, /<a [^>]*data-headword="like"[^>]*><strong>/);
assert.match(linkedWords, /<a [^>]*data-headword="record"[^>]*><strong>/);

const japaneseLinkLabel = render("##record|記録##");
assert.match(japaneseLinkLabel, /^<a [^>]*data-headword="record"[^>]*>記録<span class="ref-no"> \(no\.20\)<\/span><\/a>$/);
assert.doesNotMatch(japaneseLinkLabel, /<strong>/);

const phrasalVerbLink = render("take off");
assert.match(phrasalVerbLink, /^<a [^>]*data-headword="take off"[^>]*><strong>/);
assert.doesNotMatch(phrasalVerbLink, />off<\/strong>/);

const protectedMarkup = render("//that Ving// と ##like##");
assert.match(protectedMarkup, /^<span class="pronunciation-inline">\/.*\/<\/span>/);
assert.doesNotMatch(protectedMarkup, /pronunciation-inline[^<]*<strong>|<strong>that<\/strong>|<strong>Ving<\/strong>/);
assert.match(protectedMarkup, /<a [^>]*data-headword="like"[^>]*><strong>/);
assert.doesNotMatch(protectedMarkup, /[\uE000-\uF8FF]/u);

console.log("Markup integration tests passed");
