import assert from "node:assert/strict";
import { buildIdiomEntries, groupIdiomEntries, classifyIdiom, isCatalogIdiom } from "../../public/shared/idioms.js";
import { parseWordListItems } from "../../public/shared/markup.js";

const words = [
  { id: "endure", spelling: "endure", relatedWords: "put up with O (Oを我慢する)\non the verge of O / Ving (Oの寸前で)", examples: [{type: "sentence", sentence: "I put up with noise", translation: "文の例"}] },
  { id: "see", spelling: "see", examples: [
    { type: "phrase", sentence: "see through O", translation: "Oを見抜く" },
    { type: "phrase", sentence: "see O through", translation: "Oを最後までやり遂げる" },
    { type: "phrase", sentence: "see O", translation: "Oを見る" },
    { type: "phrase", sentence: "read an interesting book", translation: "普通の例句" },
  ], relatedWords: "see through O (Oを透かして見る)" },
  { id: "third", spelling: "third", relatedWords: "see through O (Oを見抜く)" },
  { id: "outside", spelling: "outside", relatedWords: "hand out O (Oを配る)" },
];
const metadata = [
  {id: "endure", seqNo: "40-1"}, {id: "see", seqNo: "12"}, {id: "third", seqNo: "18"},
];
const entries = buildIdiomEntries(words, metadata);
assert.equal(entries.length, 4);
assert.equal(entries.find(e => e.phrase === "put up with O").sectionKey, "put");
assert.equal(entries.find(e => e.phrase === "put up with O").meanings[0].refs[0].no, "40-1");
const through = entries.find(e => e.phrase === "see through O");
assert.equal(through.meanings.length, 2, "different senses must not be discarded");
assert.deepEqual(through.meanings[0].refs.map(ref => ref.wordId), ["see", "third"]);
assert.ok(entries.some(e => e.phrase === "see O through"), "object placement is meaningful");
assert.equal(classifyIdiom("be familiar with O"), "be-adjective");
assert.equal(classifyIdiom("in other words"), "prep-in");
assert.equal(classifyIdiom("a handful of O"), "quantity");
assert.equal(classifyIdiom("as soon as S V"), "conjunction");
assert.equal(classifyIdiom("to say the least"), "say");
assert.ok(isCatalogIdiom("hand O out"));
assert.ok(isCatalogIdiom("take turns Ving / to V"));
assert.ok(!isCatalogIdiom("put on wight"));
assert.ok(!isCatalogIdiom("a totally unrelated phrase"));
const groups = groupIdiomEntries(entries);
assert.deepEqual(groups.flatMap(c => c.sections.map(s => s.name)), ["Section 1", "Section 2", "Section 3"]);
assert.equal(parseWordListItems("hand out O (Oを配る)\nhand in O (Oを提出する)").length, 2);
assert.equal(parseWordListItems("hand out O (Oを配る、分配する)").length, 1);
console.log("Idiom selection, categorization, senses and references passed");
