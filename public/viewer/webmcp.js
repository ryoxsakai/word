/*
 * WebMCP tools for the public vocabulary viewer.
 *
 * This is progressive enhancement: browsers without document.modelContext
 * continue to use the existing viewer without any behavioural change.
 */

let activeController = null;
let registeredNames = [];

function modelContext() {
  return typeof document !== "undefined" ? document.modelContext || null : null;
}

function requiredText(value, name, maxLength) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${name}を指定してください。`);
  if (text.length > maxLength) throw new Error(`${name}は${maxLength}文字以内で指定してください。`);
  return text;
}

function optionalText(value, name, maxLength) {
  if (value === undefined || value === null || value === "") return "";
  const text = String(value).trim();
  if (text.length > maxLength) throw new Error(`${name}は${maxLength}文字以内で指定してください。`);
  return text;
}

function optionalPositiveInteger(value, name) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${name}は1以上の整数で指定してください。`);
  return number;
}

function boundedLimit(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 100) {
    throw new Error("limitは1〜100の整数で指定してください。");
  }
  return number;
}

function readOnlyTool(definition) {
  return {
    ...definition,
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: true,
    },
  };
}

function isHeadword(word) {
  return Number(word.branch || 0) === 0;
}

function countWord(group, word) {
  group.item_count += 1;
  if (isHeadword(word)) group.headword_count += 1;
}

function buildNotebookStructure(payload) {
  const chapters = [];
  const chapterMap = new Map();
  const words = Array.isArray(payload.words) ? payload.words : [];

  for (const word of words) {
    const chapterKey = word.chapterId == null ? "none" : String(word.chapterId);
    let chapter = chapterMap.get(chapterKey);
    if (!chapter) {
      chapter = {
        id: word.chapterId ?? null,
        name: word.chapterName || "未所属",
        subtitle: word.chapterSubtitle || "",
        description: word.chapterDescription || "",
        headword_count: 0,
        item_count: 0,
        sections: [],
        _sections: new Map(),
      };
      chapterMap.set(chapterKey, chapter);
      chapters.push(chapter);
    }
    countWord(chapter, word);

    const sectionKey = word.sectionId == null ? `none-${chapterKey}` : String(word.sectionId);
    let section = chapter._sections.get(sectionKey);
    if (!section) {
      section = {
        id: word.sectionId ?? null,
        name: word.sectionName || "未所属",
        subtitle: word.sectionSubtitle || "",
        description: word.sectionDescription || "",
        headword_count: 0,
        item_count: 0,
        labels: [],
        _labels: new Map(),
      };
      chapter._sections.set(sectionKey, section);
      chapter.sections.push(section);
    }
    countWord(section, word);

    if (word.labelId != null) {
      const labelKey = String(word.labelId);
      let label = section._labels.get(labelKey);
      if (!label) {
        label = {
          id: word.labelId,
          name: word.labelName || "",
          headword_count: 0,
          item_count: 0,
        };
        section._labels.set(labelKey, label);
        section.labels.push(label);
      }
      countWord(label, word);
    }
  }

  for (const chapter of chapters) {
    delete chapter._sections;
    for (const section of chapter.sections) delete section._labels;
  }

  return {
    notebook: payload.list || null,
    headword_count: words.filter(isHeadword).length,
    item_count: words.length,
    chapters,
  };
}

function wordHaystack(word) {
  const parts = [
    word.spelling,
    word.pronunciation,
    word.sectionName,
    word.sectionSubtitle,
    word.labelName,
    ...(word.senses || []).map((sense) => `${sense.pos || ""} ${sense.meaning || ""}`),
    ...(word.derivatives || []).map((derivative) => `${derivative.word || ""} ${derivative.meaning || ""}`),
    ...(word.examples || []).map((example) => `${example.sentence || ""} ${example.translation || ""}`),
    word.irregularForms,
    word.etymology,
    word.synonyms,
    word.antonyms,
    word.notes,
  ];
  for (const [key, value] of Object.entries(word.tags || {})) parts.push(key, value);
  return parts.filter(Boolean).join(" ").toLocaleLowerCase("ja");
}

function summarizeWord(word) {
  return {
    word_id: word.id,
    spelling: word.spelling,
    no: word.displayNo || word.no || null,
    branch: Number(word.branch || 0),
    meanings: (word.senses || []).map((sense) => ({ pos: sense.pos || "", meaning: sense.meaning || "" })),
    chapter_id: word.chapterId ?? null,
    chapter: word.chapterSubtitle || word.chapterName || "",
    section_id: word.sectionId ?? null,
    section: word.sectionSubtitle || word.sectionName || "",
    label_id: word.labelId ?? null,
    label: word.labelName || "",
  };
}

async function loadNotebook(api, listId) {
  return api(`/lists/${encodeURIComponent(listId)}/words/full`);
}

function createTools({ api, openWord }) {
  if (typeof api !== "function") throw new Error("WebMCPのAPI関数が設定されていません。");
  if (typeof openWord !== "function") throw new Error("WebMCPの画面表示関数が設定されていません。");

  return [
    readOnlyTool({
      name: "vocab_list_notebooks",
      title: "単語帳一覧",
      description: "公開されている単語帳のID・名称・説明を表示順で取得します。データは変更しません。",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: async () => {
        const lists = await api("/lists");
        const notebooks = (lists || []).filter((list) => list.isNotebook !== false);
        return {
          notebooks: notebooks.map((list) => ({
            list_id: list.id,
            name: list.name,
            description: list.description || "",
            chapter_label: list.chapterLabel || "Chapter",
            section_label: list.sectionLabel || "Section",
          })),
          count: notebooks.length,
        };
      },
    }),

    readOnlyTool({
      name: "vocab_get_notebook_structure",
      title: "単語帳の構成",
      description: "指定した単語帳のチャプター・セクション・ラベル構成と、各分類の見出し語数を取得します。",
      inputSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", minLength: 1, maxLength: 120, description: "単語帳一覧で取得したID。" },
        },
        required: ["list_id"],
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const listId = requiredText(args.list_id, "list_id", 120);
        return buildNotebookStructure(await loadNotebook(api, listId));
      },
    }),

    readOnlyTool({
      name: "vocab_search_words",
      title: "単語を検索",
      description: "指定した単語帳を、スペル・意味・派生語・例文・メモ・タグで検索します。チャプター、セクション、ラベルでも絞り込めます。",
      inputSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", minLength: 1, maxLength: 120, description: "検索する単語帳ID。" },
          query: { type: "string", maxLength: 200, description: "スペルまたは日本語を含む検索語。省略時は分類条件だけで絞り込みます。" },
          chapter_id: { type: "integer", minimum: 1, description: "チャプターID。" },
          section_id: { type: "integer", minimum: 1, description: "セクションID。" },
          label_id: { type: "integer", minimum: 1, description: "セクション内ラベルID。" },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 30, description: "最大取得件数。" },
        },
        required: ["list_id"],
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const listId = requiredText(args.list_id, "list_id", 120);
        const query = optionalText(args.query, "query", 200).toLocaleLowerCase("ja");
        const chapterId = optionalPositiveInteger(args.chapter_id, "chapter_id");
        const sectionId = optionalPositiveInteger(args.section_id, "section_id");
        const labelId = optionalPositiveInteger(args.label_id, "label_id");
        const limit = boundedLimit(args.limit, 30);
        const payload = await loadNotebook(api, listId);
        const matches = (payload.words || []).filter((word) => {
          if (chapterId !== null && Number(word.chapterId) !== chapterId) return false;
          if (sectionId !== null && Number(word.sectionId) !== sectionId) return false;
          if (labelId !== null && Number(word.labelId) !== labelId) return false;
          return !query || wordHaystack(word).includes(query);
        });
        return {
          list_id: listId,
          results: matches.slice(0, limit).map(summarizeWord),
          match_count: matches.length,
          returned_count: Math.min(matches.length, limit),
        };
      },
    }),

    readOnlyTool({
      name: "vocab_get_word",
      title: "単語の詳細",
      description: "単語帳IDと単語IDを指定し、意味・例文・熟語・派生語・語法・ラベルを含む登録内容を取得します。",
      inputSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", minLength: 1, maxLength: 120, description: "単語帳ID。" },
          word_id: { type: "string", minLength: 1, maxLength: 200, description: "単語検索で取得した単語ID。" },
        },
        required: ["list_id", "word_id"],
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const listId = requiredText(args.list_id, "list_id", 120);
        const wordId = requiredText(args.word_id, "word_id", 200);
        const payload = await loadNotebook(api, listId);
        const word = (payload.words || []).find((item) => String(item.id) === wordId);
        if (!word) throw new Error("指定された単語が単語帳内に見つかりません。");
        return { notebook: payload.list || null, word };
      },
    }),

    readOnlyTool({
      name: "vocab_open_word",
      title: "単語を画面に表示",
      description: "指定した単語帳を選択し、指定した単語を現在の閲覧ページ上に表示します。データは変更しません。",
      inputSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", minLength: 1, maxLength: 120, description: "単語帳ID。" },
          word_id: { type: "string", minLength: 1, maxLength: 200, description: "単語検索で取得した単語ID。" },
        },
        required: ["list_id", "word_id"],
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const listId = requiredText(args.list_id, "list_id", 120);
        const wordId = requiredText(args.word_id, "word_id", 200);
        const payload = await loadNotebook(api, listId);
        const word = (payload.words || []).find((item) => String(item.id) === wordId);
        if (!word) throw new Error("指定された単語が単語帳内に見つかりません。");
        await openWord(listId, wordId);
        return {
          opened: true,
          list_id: listId,
          word_id: wordId,
          spelling: word.spelling,
          no: word.displayNo || word.no || null,
        };
      },
    }),
  ];
}

export function webMCPSupported(context = modelContext()) {
  return Boolean(context && typeof context.registerTool === "function");
}

export async function registerVocabWebMCP(dependencies, context = modelContext()) {
  if (!webMCPSupported(context)) return false;
  if (activeController) return true;

  const tools = createTools(dependencies);
  const controller = new AbortController();
  activeController = controller;
  registeredNames = [];
  try {
    for (const tool of tools) {
      await context.registerTool(tool, { signal: controller.signal });
      registeredNames.push(tool.name);
    }
    return true;
  } catch (error) {
    controller.abort();
    activeController = null;
    registeredNames = [];
    console.warn("WebMCPツールを登録できませんでした。", error);
    return false;
  }
}

export function unregisterVocabWebMCP() {
  if (activeController) activeController.abort();
  activeController = null;
  registeredNames = [];
}

export function registeredWebMCPTools() {
  return registeredNames.slice();
}
