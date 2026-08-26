import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../../public/viewer/webmcp.js", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const webmcp = await import(moduleUrl);

const registrations = [];
const context = {
  async registerTool(tool, options) {
    registrations.push({ tool, options });
  },
};

const payload = {
  list: { id: "crossover-v3", name: "crossover", chapterLabel: "Chapter", sectionLabel: "Section" },
  words: [
    {
      id: "do",
      spelling: "do",
      no: 1,
      displayNo: "1",
      branch: 0,
      chapterId: 12,
      chapterName: "Chapter 1",
      chapterSubtitle: "文法学習の重要語彙",
      sectionId: 85,
      sectionName: "Section 1",
      sectionSubtitle: "文型 1：第1・2文型の重要動詞",
      labelId: 8,
      labelName: "第1文型の重要用法",
      senses: [{ pos: "自", meaning: "間に合う" }],
      examples: [{ sentence: "will do", translation: "間に合う" }],
      derivatives: [],
      tags: {},
    },
    {
      id: "doing",
      spelling: "doing",
      no: 1,
      displayNo: "1-1",
      branch: 1,
      chapterId: 12,
      chapterName: "Chapter 1",
      chapterSubtitle: "文法学習の重要語彙",
      sectionId: 85,
      sectionName: "Section 1",
      sectionSubtitle: "文型 1：第1・2文型の重要動詞",
      labelId: 8,
      labelName: "第1文型の重要用法",
      senses: [{ pos: "名", meaning: "行為" }],
      derivatives: [],
      examples: [],
      tags: {},
    },
    {
      id: "sound",
      spelling: "sound",
      no: 20,
      displayNo: "20",
      branch: 0,
      chapterId: 12,
      chapterName: "Chapter 1",
      chapterSubtitle: "文法学習の重要語彙",
      sectionId: 85,
      sectionName: "Section 1",
      sectionSubtitle: "文型 1：第1・2文型の重要動詞",
      labelId: 10,
      labelName: "感覚・様態・判明",
      senses: [{ pos: "自", meaning: "Cに聞こえる" }],
      derivatives: [],
      examples: [{ sentence: "sound like O", translation: "Oのように聞こえる" }],
      tags: {},
    },
  ],
};

const api = async (path) => {
  if (path === "/lists") {
    return [
      { id: "__master__", name: "単語マスター", isNotebook: false },
      { id: "crossover-v3", name: "crossover", description: "医学部受験向け", isNotebook: true },
    ];
  }
  if (path === "/lists/crossover-v3/words/full") return payload;
  throw new Error(`unexpected path: ${path}`);
};

let opened = null;
const registered = await webmcp.registerVocabWebMCP({
  api,
  openWord: async (listId, wordId) => {
    opened = { listId, wordId };
  },
}, context);

assert.equal(registered, true);
assert.deepEqual(
  registrations.map(({ tool }) => tool.name),
  [
    "vocab_list_notebooks",
    "vocab_get_notebook_structure",
    "vocab_search_words",
    "vocab_get_word",
    "vocab_open_word",
  ]
);
for (const { tool, options } of registrations) {
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.annotations.untrustedContentHint, true);
  assert.ok(options.signal instanceof AbortSignal);
}

const tool = (name) => registrations.find((entry) => entry.tool.name === name).tool;
const notebooks = await tool("vocab_list_notebooks").execute({});
assert.equal(notebooks.count, 1);
assert.equal(notebooks.notebooks[0].list_id, "crossover-v3");

const structure = await tool("vocab_get_notebook_structure").execute({ list_id: "crossover-v3" });
assert.equal(structure.headword_count, 2);
assert.equal(structure.item_count, 3);
assert.equal(structure.chapters[0].sections[0].labels.length, 2);
assert.equal(structure.chapters[0].sections[0].labels[0].headword_count, 1);
assert.equal(structure.chapters[0].sections[0].labels[0].item_count, 2);

const search = await tool("vocab_search_words").execute({
  list_id: "crossover-v3",
  query: "聞こえる",
  label_id: 10,
});
assert.equal(search.match_count, 1);
assert.equal(search.results[0].word_id, "sound");
assert.equal(search.results[0].label, "感覚・様態・判明");

const detail = await tool("vocab_get_word").execute({ list_id: "crossover-v3", word_id: "do" });
assert.equal(detail.word.senses[0].meaning, "間に合う");

const openedResult = await tool("vocab_open_word").execute({ list_id: "crossover-v3", word_id: "sound" });
assert.equal(openedResult.opened, true);
assert.deepEqual(opened, { listId: "crossover-v3", wordId: "sound" });

await assert.rejects(
  tool("vocab_search_words").execute({ list_id: "crossover-v3", limit: 101 }),
  /limitは1〜100/
);
await assert.rejects(
  tool("vocab_get_word").execute({ list_id: "crossover-v3", word_id: "missing" }),
  /見つかりません/
);

assert.deepEqual(webmcp.registeredWebMCPTools(), registrations.map(({ tool: item }) => item.name));
webmcp.unregisterVocabWebMCP();
assert.deepEqual(webmcp.registeredWebMCPTools(), []);
assert.equal(registrations[0].options.signal.aborted, true);

console.log("WebMCP integration tests passed");
