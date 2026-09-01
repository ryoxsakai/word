import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from "./mcp-oauth.js";

const MASTER_LIST_ID = "__master__";
const LEGACY_PRESET_LIST_PREFIXES = ["awl-sublist-", "oxford5000-"];
const SECTION_LABELS = ["Section", "Unit", "Part"];
const CHAPTER_LABELS = ["Chapter", "Module", "Volume"];
const MAX_BATCH_WORDS = 30;

const READ_SECURITY = [{ type: "oauth2", scopes: [MCP_READ_SCOPE] }];
const WRITE_SECURITY = [{ type: "oauth2", scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] }];

const stringOrNull = { anyOf: [{ type: "string" }, { type: "null" }] };
const senseSchema = {
  type: "object",
  properties: {
    pos: { type: "string", description: "品詞。例: 名、動、形、副" },
    meaning: { type: "string", minLength: 1, maxLength: 1000 },
    pronunciation: { type: "string" },
    is_primary: { type: "boolean", default: false },
  },
  required: ["meaning"],
  additionalProperties: false,
};
const exampleSchema = {
  type: "object",
  properties: {
    sentence: { type: "string", minLength: 1, maxLength: 2000 },
    answer: { type: "string" },
    translation: { type: "string" },
    type: { type: "string", enum: ["example", "phrase"], default: "example" },
  },
  required: ["sentence"],
  additionalProperties: false,
};
const derivativeSchema = {
  type: "object",
  properties: {
    word: { type: "string", minLength: 1, maxLength: 200 },
    pos: { type: "string" },
    meaning: { type: "string" },
  },
  required: ["word"],
  additionalProperties: false,
};
const wordFields = {
  spelling: { type: "string", minLength: 1, maxLength: 200 },
  pronunciation: { type: "string", maxLength: 500 },
  audio_url: { type: "string", maxLength: 2000 },
  etymology: { type: "string", maxLength: 5000 },
  notes: { type: "string", maxLength: 5000 },
  synonyms: { type: "string", maxLength: 2000 },
  antonyms: { type: "string", maxLength: 2000 },
  irregular_forms: { type: "string", maxLength: 1000 },
  derived_from_word_id: { type: "string", description: "派生元となる既存の単語ID" },
  ergative: { type: "boolean", description: "能格動詞（同じ参与者が自動詞の主語・他動詞の目的語になる語）" },
  pronunciation_caution: { type: "boolean" },
  accent_caution: { type: "boolean" },
  polysemous_caution: { type: "boolean" },
  spelling_caution: { type: "boolean" },
  conjugation_caution: { type: "boolean" },
  usage_caution: { type: "boolean" },
  senses: { type: "array", maxItems: 20, items: senseSchema },
  examples: { type: "array", maxItems: 20, items: exampleSchema },
  derivatives: { type: "array", maxItems: 20, items: derivativeSchema },
  tags: {
    type: "object",
    description: "タグ名をキー、値を文字列として指定。更新時はnullでタグを削除",
    additionalProperties: stringOrNull,
  },
};

function writeTool(tool, destructive = false) {
  return {
    ...tool,
    securitySchemes: WRITE_SECURITY,
    annotations: { readOnlyHint: false, destructiveHint: destructive, openWorldHint: false },
  };
}

export const PROTECTED_READ_TOOLS = [
  {
    name: "list_recent_changes",
    title: "編集履歴",
    description:
      "ChatGPT経由で行われた最近の編集履歴を取得します。変更結果の確認や、意図しない編集がないかを監査するときに使用します。",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
      additionalProperties: false,
    },
    securitySchemes: READ_SECURITY,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
];

export const WRITE_TOOLS = [
  writeTool({
    name: "create_notebook",
    title: "単語帳を作成",
    description:
      "新しい単語帳を作成します。必要ならチャプターとセクションも一度に作成できます。同名の単語帳がある場合は重複作成せず既存IDを返します。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 120 },
        id: { type: "string", maxLength: 100, description: "省略時は名称から安全なIDを自動生成" },
        description: { type: "string", maxLength: 1000 },
        section_label: { type: "string", enum: SECTION_LABELS, default: "Section" },
        chapter_label: { type: "string", enum: CHAPTER_LABELS, default: "Chapter" },
        chapters: {
          type: "array",
          maxItems: 25,
          items: {
            type: "object",
            properties: {
              subtitle: { type: "string", maxLength: 300 },
              description: { type: "string", maxLength: 1000 },
              sections: {
                type: "array",
                maxItems: 25,
                items: {
                  type: "object",
                  properties: {
                    subtitle: { type: "string", maxLength: 300 },
                    description: { type: "string", maxLength: 1000 },
                  },
                  additionalProperties: false,
                },
              },
            },
            additionalProperties: false,
          },
        },
        ungrouped_sections: {
          type: "array",
          maxItems: 50,
          items: {
            type: "object",
            properties: {
              subtitle: { type: "string", maxLength: 300 },
              description: { type: "string", maxLength: 1000 },
            },
            additionalProperties: false,
          },
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "update_notebook",
    title: "単語帳情報を更新",
    description: "単語帳の名称・説明・チャプター表記・セクション表記を部分更新します。省略した項目は変更しません。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        name: { type: "string", minLength: 1, maxLength: 120 },
        description: stringOrNull,
        section_label: { type: "string", enum: SECTION_LABELS },
        chapter_label: { type: "string", enum: CHAPTER_LABELS },
      },
      required: ["list_id"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "reorder_notebooks",
    title: "単語帳を並べ替え",
    description: "単語帳一覧を指定順に並べ替えます。事故防止のため、現在の全単語帳IDを漏れなく1回ずつ指定します。",
    inputSchema: {
      type: "object",
      properties: { list_ids: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string" } } },
      required: ["list_ids"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "create_chapter",
    title: "チャプターを作成",
    description: "指定した単語帳の末尾にチャプターを作成します。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        subtitle: { type: "string", maxLength: 300 },
        description: { type: "string", maxLength: 1000 },
      },
      required: ["list_id"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "update_chapter",
    title: "チャプターを更新",
    description: "チャプターのサブタイトルと説明を部分更新します。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        chapter_id: { type: "integer", minimum: 1 },
        subtitle: stringOrNull,
        description: stringOrNull,
      },
      required: ["list_id", "chapter_id"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "reorder_chapters",
    title: "チャプターを並べ替え",
    description: "指定した単語帳のチャプターを並べ替えます。現在の全チャプターIDを漏れなく指定します。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        chapter_ids: { type: "array", minItems: 1, uniqueItems: true, items: { type: "integer", minimum: 1 } },
      },
      required: ["list_id", "chapter_ids"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "create_group",
    title: "グループを作成",
    description: "ChapterとSectionの間にGroupを作成します。同じChapter内に同名のGroupがある場合は重複作成しません。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        chapter_id: { type: "integer", minimum: 1 },
        subtitle: { type: "string", minLength: 1, maxLength: 300 },
        description: { type: "string", maxLength: 1000 },
      },
      required: ["list_id", "chapter_id", "subtitle"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "update_group",
    title: "グループを更新",
    description: "Groupのサブタイトルと説明を部分更新します。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        group_id: { type: "integer", minimum: 1 },
        subtitle: { type: "string", minLength: 1, maxLength: 300 },
        description: stringOrNull,
      },
      required: ["list_id", "group_id"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "delete_group",
    title: "グループを削除",
    description: "Groupを削除し、所属SectionをGroup未所属へ戻します。Section自体は削除しません。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        group_id: { type: "integer", minimum: 1 },
      },
      required: ["list_id", "group_id"],
      additionalProperties: false,
    },
  }, true),
  writeTool({
    name: "create_section",
    title: "セクションを作成",
    description: "指定した単語帳の末尾にセクションを作成します。チャプターへの所属も指定できます。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        chapter_id: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
        group_id: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
        subtitle: { type: "string", maxLength: 300 },
        description: { type: "string", maxLength: 1000 },
      },
      required: ["list_id"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "update_section",
    title: "セクションを更新",
    description: "セクションのサブタイトル・説明・所属チャプターを部分更新します。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        section_id: { type: "integer", minimum: 1 },
        chapter_id: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
        group_id: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
        subtitle: stringOrNull,
        description: stringOrNull,
      },
      required: ["list_id", "section_id"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "reorder_sections",
    title: "セクションを整理",
    description:
      "単語帳内の全セクションを並べ替え、所属チャプターもまとめて変更します。全セクションを表示順に漏れなく指定します。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        sections: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              section_id: { type: "integer", minimum: 1 },
              chapter_id: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
            },
            required: ["section_id"],
            additionalProperties: false,
          },
        },
      },
      required: ["list_id", "sections"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "create_label",
    title: "ラベルを作成",
    description: "指定セクション内に、単語を小分類するラベルを作成します。同じセクション内の同名ラベルは再利用します。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        section_id: { type: "integer", minimum: 1 },
        name: { type: "string", minLength: 1, maxLength: 120 },
      },
      required: ["list_id", "section_id", "name"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "update_label",
    title: "ラベルを更新",
    description: "ラベル名または所属セクションを更新します。所属語も新しいセクションへ一緒に移動します。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        label_id: { type: "integer", minimum: 1 },
        section_id: { type: "integer", minimum: 1 },
        name: { type: "string", minLength: 1, maxLength: 120 },
      },
      required: ["list_id", "label_id"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "create_words",
    title: "単語を一括登録",
    description:
      "最大30語を意味・例文・派生語・タグ付きで一括登録します。既存スペルは上書きせず重複として返し、必要なら指定単語帳への所属だけを追加します。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string", description: "登録と同時に収録する単語帳ID" },
        section_id: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
        on_duplicate: { type: "string", enum: ["skip", "add_to_notebook"], default: "skip" },
        words: {
          type: "array",
          minItems: 1,
          maxItems: MAX_BATCH_WORDS,
          items: { type: "object", properties: wordFields, required: ["spelling"], additionalProperties: false },
        },
      },
      required: ["words"],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "update_word",
    title: "単語情報を更新",
    description:
      "単語IDまたは完全一致スペルで1語を特定し、指定項目だけを更新します。senses・examples・derivativesを指定した場合、その配列だけを置き換えます。",
    inputSchema: {
      type: "object",
      properties: {
        word_id: { type: "string" },
        lookup_spelling: { type: "string", description: "単語IDが不明なときの完全一致スペル" },
        ...wordFields,
      },
      anyOf: [{ required: ["word_id"] }, { required: ["lookup_spelling"] }],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "add_words_to_notebook",
    title: "既存単語を単語帳へ追加",
    description: "単語IDまたは完全一致スペルで既存語を指定し、単語帳の末尾へ一括追加します。既に収録済みの語はスキップします。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        section_id: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
        word_ids: { type: "array", maxItems: 100, uniqueItems: true, items: { type: "string" } },
        spellings: { type: "array", maxItems: 100, uniqueItems: true, items: { type: "string" } },
      },
      required: ["list_id"],
      anyOf: [{ required: ["word_ids"] }, { required: ["spellings"] }],
      additionalProperties: false,
    },
  }),
  writeTool({
    name: "move_words",
    title: "単語をセクションへ移動",
    description: "指定した単語帳内の語を派生語ファミリーごと別セクションへまとめて移動します。section_idをnullにするとセクション未所属へ移動します。",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        word_ids: { type: "array", minItems: 1, maxItems: 100, uniqueItems: true, items: { type: "string" } },
        section_id: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
        label_id: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }], description: "指定時はsection_idに属するラベルへ移動" },
      },
      required: ["list_id", "word_ids", "section_id"],
      additionalProperties: false,
    },
  }),
  writeTool(
    {
      name: "remove_words_from_notebook",
      title: "単語帳から単語を取り外す",
      description:
        "確認済みの語を指定単語帳から取り外します。単語マスターの語彙データ自体は削除しないため再追加できます。実行前に対象を提示し、ユーザーが明示確認した場合だけconfirm_notebook_nameへ単語帳名を完全一致で指定します。",
      inputSchema: {
        type: "object",
        properties: {
          list_id: { type: "string" },
          word_ids: { type: "array", minItems: 1, maxItems: 100, uniqueItems: true, items: { type: "string" } },
          confirm_notebook_name: { type: "string", description: "ユーザーが確認した単語帳名を完全一致で指定" },
        },
        required: ["list_id", "word_ids", "confirm_notebook_name"],
        additionalProperties: false,
      },
    },
    true
  ),
];

const PROTECTED_READ_NAMES = new Set(PROTECTED_READ_TOOLS.map((tool) => tool.name));
const WRITE_NAMES = new Set(WRITE_TOOLS.map((tool) => tool.name));

export function isProtectedTool(name) {
  return PROTECTED_READ_NAMES.has(name) || WRITE_NAMES.has(name);
}

function isNotebookListId(id) {
  return id && id !== MASTER_LIST_ID && !LEGACY_PRESET_LIST_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function requiredText(value, name, maxLength = 200) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(name + " is required");
  if (text.length > maxLength) throw new Error(name + " must be at most " + maxLength + " characters");
  return text;
}

function optionalText(value, name, maxLength) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const text = String(value).trim();
  if (text.length > maxLength) throw new Error(name + " must be at most " + maxLength + " characters");
  return text || null;
}

function positiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(name + " must be a positive integer");
  return number;
}

function slugifyUnicode(value) {
  return (
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "notebook"
  );
}

function slugifyWord(value) {
  return (
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "word"
  );
}

async function uniqueId(db, table, baseValue) {
  const base = baseValue.slice(0, 90);
  let candidate = base;
  let suffix = 2;
  while (await db.prepare("SELECT 1 FROM " + table + " WHERE id = ?").bind(candidate).first()) {
    candidate = base.slice(0, 85) + "-" + suffix;
    suffix += 1;
  }
  return candidate;
}

async function requireNotebook(db, listId) {
  const id = requiredText(listId, "list_id", 100);
  if (!isNotebookListId(id)) throw new Error("This notebook cannot be edited");
  const row = await db
    .prepare(
      "SELECT id, name, description, sort_order AS sortOrder, section_label AS sectionLabel, chapter_label AS chapterLabel FROM lists WHERE id = ?"
    )
    .bind(id)
    .first();
  if (!row) throw new Error("Notebook not found: " + id);
  return row;
}

async function requireChapter(db, listId, chapterId) {
  const id = positiveInteger(chapterId, "chapter_id");
  const row = await db
    .prepare("SELECT id, subtitle, description, sort_order AS sortOrder FROM chapters WHERE id = ? AND list_id = ?")
    .bind(id, listId)
    .first();
  if (!row) throw new Error("Chapter not found: " + id);
  return row;
}

async function requireSection(db, listId, sectionId) {
  const id = positiveInteger(sectionId, "section_id");
  const row = await db
    .prepare(
      "SELECT id, subtitle, description, sort_order AS sortOrder, chapter_id AS chapterId, group_id AS groupId FROM sections WHERE id = ? AND list_id = ?"
    )
    .bind(id, listId)
    .first();
  if (!row) throw new Error("Section not found: " + id);
  return row;
}

async function requireGroup(db, listId, groupId, chapterId = undefined) {
  const id = positiveInteger(groupId, "group_id");
  const row = await db
    .prepare(
      "SELECT id, subtitle, description, sort_order AS sortOrder, chapter_id AS chapterId FROM section_groups WHERE id = ? AND list_id = ?"
    )
    .bind(id, listId)
    .first();
  if (!row) throw new Error("Group not found: " + id);
  if (chapterId !== undefined && Number(row.chapterId) !== Number(chapterId)) {
    throw new Error("Group does not belong to chapter: " + id);
  }
  return row;
}

async function validateOptionalSection(db, listId, sectionId) {
  if (sectionId === undefined || sectionId === null || sectionId === "") return null;
  return (await requireSection(db, listId, sectionId)).id;
}

async function requireLabel(db, listId, sectionId, labelId) {
  const id = positiveInteger(labelId, "label_id");
  const row = await db.prepare("SELECT id, section_id AS sectionId, name, sort_order AS sortOrder FROM section_labels WHERE id = ? AND list_id = ? AND section_id = ?").bind(id, listId, sectionId).first();
  if (!row) throw new Error("Label not found in section: " + id);
  return row;
}

async function audit(db, auth, action, targetType, targetId, details) {
  const serialized = JSON.stringify(details ?? {});
  await db
    .prepare(
      "INSERT INTO mcp_audit_log (actor, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(auth.actor, action, targetType, targetId === undefined || targetId === null ? null : String(targetId), serialized.slice(0, 10000))
    .run();
}

async function createNotebook(db, args, auth) {
  const name = requiredText(args.name, "name", 120);
  const existingByName = await db
    .prepare("SELECT id, name FROM lists WHERE name = ? COLLATE NOCASE")
    .bind(name)
    .first();
  if (existingByName && isNotebookListId(existingByName.id)) {
    return { created: false, reason: "same_name_exists", notebook: existingByName };
  }

  const requestedId = args.id ? requiredText(args.id, "id", 100) : null;
  const baseId = requestedId || slugifyUnicode(name);
  if (!isNotebookListId(baseId)) throw new Error("The requested notebook id is reserved");
  const id = requestedId ? baseId : await uniqueId(db, "lists", baseId);
  if (requestedId && (await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(id).first())) {
    throw new Error("Notebook id already exists: " + id);
  }

  const description = optionalText(args.description, "description", 1000) ?? null;
  const sectionLabel = args.section_label || "Section";
  const chapterLabel = args.chapter_label || "Chapter";
  if (!SECTION_LABELS.includes(sectionLabel)) throw new Error("Invalid section_label");
  if (!CHAPTER_LABELS.includes(chapterLabel)) throw new Error("Invalid chapter_label");
  const chapters = Array.isArray(args.chapters) ? args.chapters : [];
  const ungroupedSections = Array.isArray(args.ungrouped_sections) ? args.ungrouped_sections : [];
  const totalSections = ungroupedSections.length + chapters.reduce((sum, chapter) => sum + (chapter.sections?.length || 0), 0);
  if (chapters.length > 25 || totalSections > 100) throw new Error("Notebook structure is too large");

  const sortRow = await db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), 0) AS maxSort FROM lists WHERE id != ? AND id NOT LIKE 'awl-sublist-%' AND id NOT LIKE 'oxford5000-%'"
    )
    .bind(MASTER_LIST_ID)
    .first();
  await db
    .prepare(
      "INSERT INTO lists (id, name, description, sort_order, section_label, chapter_label) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(id, name, description, Number(sortRow?.maxSort || 0) + 1, sectionLabel, chapterLabel)
    .run();

  const createdChapters = [];
  const createdSections = [];
  try {
    let sectionSort = 1;
    for (let index = 0; index < ungroupedSections.length; index += 1) {
      const item = ungroupedSections[index] || {};
      const result = await db
        .prepare(
          "INSERT INTO sections (list_id, name, subtitle, description, sort_order, chapter_id) VALUES (?, '', ?, ?, ?, NULL)"
        )
        .bind(
          id,
          optionalText(item.subtitle, "ungrouped_sections.subtitle", 300) ?? null,
          optionalText(item.description, "ungrouped_sections.description", 1000) ?? null,
          sectionSort
        )
        .run();
      createdSections.push({ id: Number(result.meta.last_row_id), chapterId: null, sortOrder: sectionSort });
      sectionSort += 1;
    }
    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
      const chapter = chapters[chapterIndex] || {};
      const result = await db
        .prepare("INSERT INTO chapters (list_id, subtitle, description, sort_order) VALUES (?, ?, ?, ?)")
        .bind(
          id,
          optionalText(chapter.subtitle, "chapters.subtitle", 300) ?? null,
          optionalText(chapter.description, "chapters.description", 1000) ?? null,
          chapterIndex + 1
        )
        .run();
      const chapterId = Number(result.meta.last_row_id);
      createdChapters.push({ id: chapterId, sortOrder: chapterIndex + 1 });
      for (const section of chapter.sections || []) {
        const sectionResult = await db
          .prepare(
            "INSERT INTO sections (list_id, name, subtitle, description, sort_order, chapter_id) VALUES (?, '', ?, ?, ?, ?)"
          )
          .bind(
            id,
            optionalText(section.subtitle, "sections.subtitle", 300) ?? null,
            optionalText(section.description, "sections.description", 1000) ?? null,
            sectionSort,
            chapterId
          )
          .run();
        createdSections.push({ id: Number(sectionResult.meta.last_row_id), chapterId, sortOrder: sectionSort });
        sectionSort += 1;
      }
    }
  } catch (error) {
    await db.prepare("DELETE FROM sections WHERE list_id = ?").bind(id).run();
    await db.prepare("DELETE FROM chapters WHERE list_id = ?").bind(id).run();
    await db.prepare("DELETE FROM lists WHERE id = ?").bind(id).run();
    throw error;
  }

  await audit(db, auth, "create_notebook", "notebook", id, {
    name,
    chapterCount: createdChapters.length,
    sectionCount: createdSections.length,
  });
  return {
    created: true,
    notebook: { id, name, description, sectionLabel, chapterLabel },
    chapters: createdChapters,
    sections: createdSections,
  };
}

async function updateNotebook(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const sets = [];
  const values = [];
  if (args.name !== undefined) {
    const name = requiredText(args.name, "name", 120);
    const duplicate = await db
      .prepare("SELECT id FROM lists WHERE name = ? COLLATE NOCASE AND id != ?")
      .bind(name, notebook.id)
      .first();
    if (duplicate) throw new Error("Another notebook already has that name");
    sets.push("name = ?");
    values.push(name);
  }
  if (args.description !== undefined) {
    sets.push("description = ?");
    values.push(optionalText(args.description, "description", 1000));
  }
  if (args.section_label !== undefined) {
    if (!SECTION_LABELS.includes(args.section_label)) throw new Error("Invalid section_label");
    sets.push("section_label = ?");
    values.push(args.section_label);
  }
  if (args.chapter_label !== undefined) {
    if (!CHAPTER_LABELS.includes(args.chapter_label)) throw new Error("Invalid chapter_label");
    sets.push("chapter_label = ?");
    values.push(args.chapter_label);
  }
  if (sets.length === 0) throw new Error("At least one field to update is required");
  await db.prepare("UPDATE lists SET " + sets.join(", ") + " WHERE id = ?").bind(...values, notebook.id).run();
  await audit(db, auth, "update_notebook", "notebook", notebook.id, { fields: Object.keys(args).filter((key) => key !== "list_id") });
  return { updated: true, notebook: await requireNotebook(db, notebook.id) };
}

function sameIdSet(expected, received) {
  if (expected.length !== received.length) return false;
  const expectedSet = new Set(expected.map(String));
  return received.every((id) => expectedSet.has(String(id))) && new Set(received.map(String)).size === received.length;
}

async function reorderNotebooks(db, args, auth) {
  const ids = Array.isArray(args.list_ids) ? args.list_ids.map(String) : [];
  if (ids.length === 0) throw new Error("list_ids is required");
  const rows = await db
    .prepare(
      "SELECT id FROM lists WHERE id != ? AND id NOT LIKE 'awl-sublist-%' AND id NOT LIKE 'oxford5000-%' ORDER BY sort_order, name"
    )
    .bind(MASTER_LIST_ID)
    .all();
  const current = rows.results.map((row) => row.id);
  if (!sameIdSet(current, ids)) throw new Error("list_ids must contain every current notebook id exactly once");
  await db.batch(ids.map((id, index) => db.prepare("UPDATE lists SET sort_order = ? WHERE id = ?").bind(index + 1, id)));
  await audit(db, auth, "reorder_notebooks", "notebook_collection", null, { listIds: ids });
  return { updated: true, listIds: ids };
}

async function createChapter(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const subtitle = optionalText(args.subtitle, "subtitle", 300) ?? null;
  const description = optionalText(args.description, "description", 1000) ?? null;
  const exact = await db
    .prepare(
      "SELECT id, subtitle, description, sort_order AS sortOrder FROM chapters WHERE list_id = ? AND COALESCE(subtitle, '') = COALESCE(?, '') AND COALESCE(description, '') = COALESCE(?, '') LIMIT 1"
    )
    .bind(notebook.id, subtitle, description)
    .first();
  if (exact) return { created: false, reason: "same_chapter_exists", chapter: exact };
  const row = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS maxSort FROM chapters WHERE list_id = ?").bind(notebook.id).first();
  const sortOrder = Number(row?.maxSort || 0) + 1;
  const result = await db
    .prepare("INSERT INTO chapters (list_id, subtitle, description, sort_order) VALUES (?, ?, ?, ?)")
    .bind(notebook.id, subtitle, description, sortOrder)
    .run();
  const id = Number(result.meta.last_row_id);
  await audit(db, auth, "create_chapter", "chapter", id, { listId: notebook.id, subtitle });
  return { created: true, chapter: { id, subtitle, description, sortOrder } };
}

async function updateChapter(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const chapter = await requireChapter(db, notebook.id, args.chapter_id);
  const sets = [];
  const values = [];
  if (args.subtitle !== undefined) {
    sets.push("subtitle = ?");
    values.push(optionalText(args.subtitle, "subtitle", 300));
  }
  if (args.description !== undefined) {
    sets.push("description = ?");
    values.push(optionalText(args.description, "description", 1000));
  }
  if (!sets.length) throw new Error("At least one field to update is required");
  await db.prepare("UPDATE chapters SET " + sets.join(", ") + " WHERE id = ? AND list_id = ?").bind(...values, chapter.id, notebook.id).run();
  await audit(db, auth, "update_chapter", "chapter", chapter.id, { listId: notebook.id, fields: Object.keys(args).filter((key) => !["list_id", "chapter_id"].includes(key)) });
  return { updated: true, chapter: await requireChapter(db, notebook.id, chapter.id) };
}

async function renumberListItemsToDisplayOrder(db, listId) {
  const rows = await db
    .prepare(
      "SELECT li.word_id AS wordId, li.no, li.branch, li.section_id AS sectionId, li.label_id AS labelId " +
        "FROM list_items li LEFT JOIN sections s ON s.id = li.section_id LEFT JOIN chapters c ON c.id = s.chapter_id " +
        "LEFT JOIN section_labels sl ON sl.id = li.label_id " +
        "WHERE li.list_id = ? ORDER BY COALESCE(c.sort_order, -1), COALESCE(s.sort_order, -1), COALESCE(sl.sort_order, -1), li.no, li.branch"
    )
    .bind(listId)
    .all();
  if (!rows.results.length) return 0;
  const familyPosition = new Map();
  let nextNo = 0;
  for (const row of rows.results) {
    if (!familyPosition.has(row.no)) {
      nextNo += 1;
      familyPosition.set(row.no, { no: nextNo, sectionId: row.sectionId ?? null, labelId: row.labelId ?? null });
    }
  }
  const phaseOne = [];
  const phaseTwo = [];
  for (let index = 0; index < rows.results.length; index += 1) {
    const row = rows.results[index];
    const target = familyPosition.get(row.no);
    phaseOne.push(db.prepare("UPDATE list_items SET no = ? WHERE list_id = ? AND word_id = ?").bind(-(index + 1), listId, row.wordId));
    phaseTwo.push(
      db
        .prepare("UPDATE list_items SET no = ?, section_id = ?, label_id = ? WHERE list_id = ? AND word_id = ?")
        .bind(target.no, target.sectionId, target.labelId, listId, row.wordId)
    );
  }
  await db.batch(phaseOne);
  await db.batch(phaseTwo);
  return nextNo;
}

async function reorderChapters(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const ids = Array.isArray(args.chapter_ids) ? args.chapter_ids.map((id) => positiveInteger(id, "chapter_id")) : [];
  const rows = await db.prepare("SELECT id FROM chapters WHERE list_id = ? ORDER BY sort_order, id").bind(notebook.id).all();
  const current = rows.results.map((row) => Number(row.id));
  if (!sameIdSet(current, ids)) throw new Error("chapter_ids must contain every current chapter id exactly once");
  await db.batch(ids.map((id, index) => db.prepare("UPDATE chapters SET sort_order = ? WHERE id = ? AND list_id = ?").bind(index + 1, id, notebook.id)));
  const sectionRows = await db
    .prepare(
      "SELECT s.id FROM sections s LEFT JOIN chapters c ON c.id = s.chapter_id WHERE s.list_id = ? ORDER BY COALESCE(c.sort_order, -1), s.sort_order, s.id"
    )
    .bind(notebook.id)
    .all();
  if (sectionRows.results.length) {
    await db.batch(sectionRows.results.map((row, index) => db.prepare("UPDATE sections SET sort_order = ? WHERE id = ?").bind(index + 1, row.id)));
  }
  await renumberListItemsToDisplayOrder(db, notebook.id);
  await audit(db, auth, "reorder_chapters", "notebook", notebook.id, { chapterIds: ids });
  return { updated: true, chapterIds: ids };
}

async function createGroup(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const chapter = await requireChapter(db, notebook.id, args.chapter_id);
  const subtitle = requiredText(args.subtitle, "subtitle", 300);
  const description = optionalText(args.description, "description", 1000) ?? null;
  const existing = await db
    .prepare(
      "SELECT id, subtitle, description, sort_order AS sortOrder, chapter_id AS chapterId FROM section_groups WHERE list_id = ? AND chapter_id = ? AND subtitle = ? COLLATE NOCASE LIMIT 1"
    )
    .bind(notebook.id, chapter.id, subtitle)
    .first();
  if (existing) return { created: false, reason: "same_group_exists", group: existing };
  const row = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS maxSort FROM section_groups WHERE list_id = ?").bind(notebook.id).first();
  const sortOrder = Number(row?.maxSort || 0) + 1;
  const result = await db
    .prepare("INSERT INTO section_groups (list_id, chapter_id, subtitle, description, sort_order) VALUES (?, ?, ?, ?, ?)")
    .bind(notebook.id, chapter.id, subtitle, description, sortOrder)
    .run();
  const id = Number(result.meta.last_row_id);
  await audit(db, auth, "create_group", "group", id, { listId: notebook.id, chapterId: chapter.id, subtitle });
  return { created: true, group: { id, subtitle, description, sortOrder, chapterId: Number(chapter.id) } };
}

async function updateGroup(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const group = await requireGroup(db, notebook.id, args.group_id);
  const sets = [];
  const values = [];
  if (args.subtitle !== undefined) {
    sets.push("subtitle = ?");
    values.push(requiredText(args.subtitle, "subtitle", 300));
  }
  if (args.description !== undefined) {
    sets.push("description = ?");
    values.push(optionalText(args.description, "description", 1000));
  }
  if (!sets.length) throw new Error("At least one field to update is required");
  await db.prepare("UPDATE section_groups SET " + sets.join(", ") + " WHERE id = ? AND list_id = ?").bind(...values, group.id, notebook.id).run();
  await audit(db, auth, "update_group", "group", group.id, { listId: notebook.id, fields: Object.keys(args).filter((key) => !["list_id", "group_id"].includes(key)) });
  return { updated: true, group: await requireGroup(db, notebook.id, group.id) };
}

async function deleteGroup(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const group = await requireGroup(db, notebook.id, args.group_id);
  const countRow = await db.prepare("SELECT COUNT(*) AS count FROM sections WHERE list_id = ? AND group_id = ?").bind(notebook.id, group.id).first();
  await db.batch([
    db.prepare("UPDATE sections SET group_id = NULL WHERE list_id = ? AND group_id = ?").bind(notebook.id, group.id),
    db.prepare("DELETE FROM section_groups WHERE id = ? AND list_id = ?").bind(group.id, notebook.id),
  ]);
  await audit(db, auth, "delete_group", "group", group.id, { listId: notebook.id, unassignedSectionCount: Number(countRow?.count || 0) });
  return { deleted: true, groupId: Number(group.id), unassignedSectionCount: Number(countRow?.count || 0) };
}

async function createSection(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const chapterId = args.chapter_id === undefined || args.chapter_id === null ? null : (await requireChapter(db, notebook.id, args.chapter_id)).id;
  const groupId = args.group_id === undefined || args.group_id === null ? null : (await requireGroup(db, notebook.id, args.group_id, chapterId)).id;
  const subtitle = optionalText(args.subtitle, "subtitle", 300) ?? null;
  const description = optionalText(args.description, "description", 1000) ?? null;
  const exact = await db
    .prepare(
      "SELECT id, subtitle, description, sort_order AS sortOrder, chapter_id AS chapterId, group_id AS groupId FROM sections WHERE list_id = ? AND chapter_id IS ? AND group_id IS ? AND COALESCE(subtitle, '') = COALESCE(?, '') AND COALESCE(description, '') = COALESCE(?, '') LIMIT 1"
    )
    .bind(notebook.id, chapterId, groupId, subtitle, description)
    .first();
  if (exact) return { created: false, reason: "same_section_exists", section: exact };
  const row = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS maxSort FROM sections WHERE list_id = ?").bind(notebook.id).first();
  const sortOrder = Number(row?.maxSort || 0) + 1;
  const result = await db
    .prepare("INSERT INTO sections (list_id, name, subtitle, description, sort_order, chapter_id, group_id) VALUES (?, '', ?, ?, ?, ?, ?)")
    .bind(notebook.id, subtitle, description, sortOrder, chapterId, groupId)
    .run();
  const id = Number(result.meta.last_row_id);
  await audit(db, auth, "create_section", "section", id, { listId: notebook.id, chapterId, groupId, subtitle });
  return { created: true, section: { id, subtitle, description, sortOrder, chapterId, groupId } };
}

async function updateSection(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const section = await requireSection(db, notebook.id, args.section_id);
  const sets = [];
  const values = [];
  if (args.subtitle !== undefined) {
    sets.push("subtitle = ?");
    values.push(optionalText(args.subtitle, "subtitle", 300));
  }
  if (args.description !== undefined) {
    sets.push("description = ?");
    values.push(optionalText(args.description, "description", 1000));
  }
  if (args.chapter_id !== undefined) {
    const chapterId = args.chapter_id === null ? null : (await requireChapter(db, notebook.id, args.chapter_id)).id;
    sets.push("chapter_id = ?");
    values.push(chapterId);
  }
  if (args.group_id !== undefined) {
    const targetChapterId = args.chapter_id === undefined
      ? section.chapterId
      : args.chapter_id === null
        ? null
        : positiveInteger(args.chapter_id, "chapter_id");
    const groupId = args.group_id === null ? null : (await requireGroup(db, notebook.id, args.group_id, targetChapterId)).id;
    sets.push("group_id = ?");
    values.push(groupId);
  }
  if (!sets.length) throw new Error("At least one field to update is required");
  await db.prepare("UPDATE sections SET " + sets.join(", ") + " WHERE id = ? AND list_id = ?").bind(...values, section.id, notebook.id).run();
  await renumberListItemsToDisplayOrder(db, notebook.id);
  await audit(db, auth, "update_section", "section", section.id, { listId: notebook.id, fields: Object.keys(args).filter((key) => !["list_id", "section_id"].includes(key)) });
  return { updated: true, section: await requireSection(db, notebook.id, section.id) };
}

async function reorderSections(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const sections = Array.isArray(args.sections) ? args.sections : [];
  if (!sections.length) throw new Error("sections is required");
  const currentRows = await db.prepare("SELECT id FROM sections WHERE list_id = ? ORDER BY sort_order, id").bind(notebook.id).all();
  const current = currentRows.results.map((row) => Number(row.id));
  const received = sections.map((item) => positiveInteger(item.section_id, "section_id"));
  if (!sameIdSet(current, received)) throw new Error("sections must contain every current section id exactly once");
  const chapterRows = await db.prepare("SELECT id FROM chapters WHERE list_id = ?").bind(notebook.id).all();
  const chapterIds = new Set(chapterRows.results.map((row) => Number(row.id)));
  for (const item of sections) {
    if (item.chapter_id !== undefined && item.chapter_id !== null && !chapterIds.has(Number(item.chapter_id))) {
      throw new Error("Chapter does not belong to notebook: " + item.chapter_id);
    }
  }
  await db.batch(
    sections.map((item, index) =>
      db
        .prepare("UPDATE sections SET sort_order = ?, chapter_id = ? WHERE id = ? AND list_id = ?")
        .bind(index + 1, item.chapter_id ?? null, item.section_id, notebook.id)
    )
  );
  await renumberListItemsToDisplayOrder(db, notebook.id);
  await audit(db, auth, "reorder_sections", "notebook", notebook.id, {
    sections: sections.map((item) => ({ sectionId: item.section_id, chapterId: item.chapter_id ?? null })),
  });
  return { updated: true, sectionCount: sections.length };
}

async function createLabel(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const section = await requireSection(db, notebook.id, args.section_id);
  const name = requiredText(args.name, "name", 120);
  const existing = await db.prepare("SELECT id, section_id AS sectionId, name, sort_order AS sortOrder FROM section_labels WHERE list_id = ? AND section_id = ? AND name = ? COLLATE NOCASE").bind(notebook.id, section.id, name).first();
  if (existing) return { created: false, reason: "same_label_exists", label: existing };
  const row = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS maxSort FROM section_labels WHERE list_id = ? AND section_id = ?").bind(notebook.id, section.id).first();
  const sortOrder = Number(row?.maxSort || 0) + 1;
  const result = await db.prepare("INSERT INTO section_labels (list_id, section_id, name, sort_order) VALUES (?, ?, ?, ?)").bind(notebook.id, section.id, name, sortOrder).run();
  const label = { id: Number(result.meta.last_row_id), sectionId: section.id, name, sortOrder };
  await audit(db, auth, "create_label", "label", label.id, { listId: notebook.id, sectionId: section.id, name });
  return { created: true, label };
}

async function updateLabel(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const id = positiveInteger(args.label_id, "label_id");
  const current = await db.prepare("SELECT id, section_id AS sectionId, name FROM section_labels WHERE id = ? AND list_id = ?").bind(id, notebook.id).first();
  if (!current) throw new Error("Label not found: " + id);
  const sectionId = args.section_id === undefined ? Number(current.sectionId) : (await requireSection(db, notebook.id, args.section_id)).id;
  const name = args.name === undefined ? current.name : requiredText(args.name, "name", 120);
  if (args.section_id === undefined && args.name === undefined) throw new Error("At least one field to update is required");
  const duplicate = await db.prepare("SELECT id FROM section_labels WHERE list_id = ? AND section_id = ? AND name = ? COLLATE NOCASE AND id != ?").bind(notebook.id, sectionId, name, id).first();
  if (duplicate) throw new Error("A label with the same name already exists in the section");
  await db.batch([
    db.prepare("UPDATE section_labels SET section_id = ?, name = ? WHERE id = ? AND list_id = ?").bind(sectionId, name, id, notebook.id),
    db.prepare("UPDATE list_items SET section_id = ? WHERE list_id = ? AND label_id = ?").bind(sectionId, notebook.id, id),
  ]);
  await renumberListItemsToDisplayOrder(db, notebook.id);
  await audit(db, auth, "update_label", "label", id, { listId: notebook.id, sectionId, name });
  return { updated: true, label: { id, sectionId, name } };
}

function validateWordInput(item, index, requireSpelling) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("words[" + index + "] must be an object");
  if (requireSpelling) requiredText(item.spelling, "words[" + index + "].spelling", 200);
  for (const [field, limit] of [
    ["pronunciation", 500],
    ["audio_url", 2000],
    ["etymology", 5000],
    ["notes", 5000],
    ["synonyms", 2000],
    ["antonyms", 2000],
    ["irregular_forms", 1000],
  ]) {
    if (item[field] !== undefined) optionalText(item[field], "words[" + index + "]." + field, limit);
  }
  for (const [field, max] of [
    ["senses", 20],
    ["examples", 20],
    ["derivatives", 20],
  ]) {
    if (item[field] !== undefined && (!Array.isArray(item[field]) || item[field].length > max)) {
      throw new Error("words[" + index + "]." + field + " must be an array with at most " + max + " items");
    }
  }
  for (const [senseIndex, sense] of (item.senses || []).entries()) {
    requiredText(sense?.meaning, "words[" + index + "].senses[" + senseIndex + "].meaning", 1000);
    if (sense?.pos !== undefined) optionalText(sense.pos, "words[" + index + "].senses[" + senseIndex + "].pos", 100);
    if (sense?.pronunciation !== undefined) {
      optionalText(sense.pronunciation, "words[" + index + "].senses[" + senseIndex + "].pronunciation", 500);
    }
  }
  for (const [exampleIndex, example] of (item.examples || []).entries()) {
    requiredText(example?.sentence, "words[" + index + "].examples[" + exampleIndex + "].sentence", 2000);
    if (example?.answer !== undefined) optionalText(example.answer, "words[" + index + "].examples[" + exampleIndex + "].answer", 2000);
    if (example?.translation !== undefined) {
      optionalText(example.translation, "words[" + index + "].examples[" + exampleIndex + "].translation", 3000);
    }
    if (example?.type !== undefined && !["example", "phrase"].includes(example.type)) {
      throw new Error("words[" + index + "].examples[" + exampleIndex + "].type is invalid");
    }
  }
  for (const [derivativeIndex, derivative] of (item.derivatives || []).entries()) {
    requiredText(derivative?.word, "words[" + index + "].derivatives[" + derivativeIndex + "].word", 200);
    if (derivative?.pos !== undefined) {
      optionalText(derivative.pos, "words[" + index + "].derivatives[" + derivativeIndex + "].pos", 100);
    }
    if (derivative?.meaning !== undefined) {
      optionalText(derivative.meaning, "words[" + index + "].derivatives[" + derivativeIndex + "].meaning", 1000);
    }
  }
  if (item.tags !== undefined && (!item.tags || typeof item.tags !== "object" || Array.isArray(item.tags))) {
    throw new Error("words[" + index + "].tags must be an object");
  }
  if (Object.keys(item.tags || {}).length > 30) throw new Error("A word can have at most 30 tags");
  for (const [key, value] of Object.entries(item.tags || {})) {
    requiredText(key, "words[" + index + "].tag key", 100);
    if (value !== null && value !== false && value !== true && value !== undefined) {
      optionalText(value, "words[" + index + "].tag value", 1000);
    }
  }
}

const WORD_COLUMN_MAP = {
  spelling: "spelling",
  pronunciation: "pronunciation",
  audio_url: "audio_url",
  etymology: "etymology",
  notes: "notes",
  synonyms: "synonyms",
  antonyms: "antonyms",
  irregular_forms: "irregular_forms",
  ergative: "ergative",
  pronunciation_caution: "pronunciation_caution",
  accent_caution: "accent_caution",
  polysemous_caution: "polysemous_caution",
  spelling_caution: "spelling_caution",
  conjugation_caution: "conjugation_caution",
  usage_caution: "usage_caution",
  derived_from_word_id: "derived_from_id",
};

function dbWordValue(field, value) {
  if (field === "ergative" || field.endsWith("_caution")) return value ? 1 : 0;
  if (value === undefined || value === "") return null;
  return value;
}

function childStatements(db, wordId, item, replace = false) {
  const statements = [];
  const children = [
    ["senses", ["pos", "meaning", "pronunciation", "is_primary", "sort_order"]],
    ["derivatives", ["pos", "word", "meaning", "sort_order"]],
    ["examples", ["sentence", "answer", "translation", "type", "sort_order"]],
  ];
  for (const [table, columns] of children) {
    if (item[table] === undefined && replace) continue;
    const rows = item[table] || [];
    if (replace) statements.push(db.prepare("DELETE FROM " + table + " WHERE word_id = ?").bind(wordId));
    rows.forEach((row, index) => {
      const values = columns.map((column) => {
        if (column === "sort_order") return index;
        if (column === "is_primary") return row.is_primary || (index === 0 && !rows.some((candidate) => candidate.is_primary)) ? 1 : 0;
        if (column === "type") return row.type || "example";
        return row[column] ?? null;
      });
      statements.push(
        db
          .prepare(
            "INSERT INTO " + table + " (word_id, " + columns.join(", ") + ") VALUES (?, " + columns.map(() => "?").join(", ") + ")"
          )
          .bind(wordId, ...values)
      );
    });
  }
  if (item.tags !== undefined || !replace) {
    for (const [key, value] of Object.entries(item.tags || {})) {
      const tagKey = requiredText(key, "tag key", 100);
      if (replace && value === null) {
        statements.push(db.prepare("DELETE FROM tags WHERE word_id = ? AND tag_key = ?").bind(wordId, tagKey));
      } else if (value !== null && value !== false && value !== undefined) {
        statements.push(
          db
            .prepare(
              "INSERT INTO tags (word_id, tag_key, tag_value) VALUES (?, ?, ?) ON CONFLICT(word_id, tag_key) DO UPDATE SET tag_value = excluded.tag_value"
            )
            .bind(wordId, tagKey, value === true ? null : String(value))
        );
      }
    }
  }
  return statements;
}

async function nextListNo(db, listId) {
  const row = await db.prepare("SELECT COALESCE(MAX(no), 0) AS maxNo FROM list_items WHERE list_id = ?").bind(listId).first();
  return Number(row?.maxNo || 0) + 1;
}

async function addMembershipIfMissing(db, listId, wordId, sectionId, topLevelNo) {
  const existing = await db
    .prepare("SELECT 1 FROM list_items WHERE list_id = ? AND word_id = ?")
    .bind(listId, wordId)
    .first();
  if (existing) return { added: false, usedTopLevelNo: false };

  const word = await db.prepare("SELECT derived_from_id AS derivedFromId FROM words WHERE id = ?").bind(wordId).first();
  if (word?.derivedFromId) {
    const parent = await db
      .prepare("SELECT no FROM list_items WHERE list_id = ? AND word_id = ?")
      .bind(listId, word.derivedFromId)
      .first();
    if (parent) {
      const branchRow = await db
        .prepare("SELECT COALESCE(MAX(branch), 0) AS maxBranch FROM list_items WHERE list_id = ? AND no = ?")
        .bind(listId, parent.no)
        .first();
      await db
        .prepare("INSERT INTO list_items (list_id, word_id, no, branch, section_id) VALUES (?, ?, ?, ?, ?)")
        .bind(listId, wordId, parent.no, Number(branchRow?.maxBranch || 0) + 1, sectionId)
        .run();
      return { added: true, usedTopLevelNo: false };
    }
  }
  await db
    .prepare("INSERT INTO list_items (list_id, word_id, no, branch, section_id) VALUES (?, ?, ?, 0, ?)")
    .bind(listId, wordId, topLevelNo, sectionId)
    .run();
  return { added: true, usedTopLevelNo: true };
}

async function createWords(db, args, auth) {
  const words = Array.isArray(args.words) ? args.words : [];
  if (!words.length || words.length > MAX_BATCH_WORDS) throw new Error("words must contain between 1 and " + MAX_BATCH_WORDS + " items");
  words.forEach((word, index) => validateWordInput(word, index, true));
  const listId = args.list_id ? (await requireNotebook(db, args.list_id)).id : null;
  const sectionId = listId ? await validateOptionalSection(db, listId, args.section_id) : null;
  if (!listId && args.section_id !== undefined && args.section_id !== null) throw new Error("section_id requires list_id");
  const onDuplicate = args.on_duplicate || "skip";
  if (!["skip", "add_to_notebook"].includes(onDuplicate)) throw new Error("Invalid on_duplicate value");

  for (const derivedFromId of new Set(words.map((item) => item.derived_from_word_id).filter(Boolean).map(String))) {
    const parent = await db.prepare("SELECT id FROM words WHERE id = ?").bind(derivedFromId).first();
    if (!parent) throw new Error("Derived-from word not found: " + derivedFromId);
  }

  let nextNo = listId ? await nextListNo(db, listId) : null;
  const created = [];
  const duplicates = [];
  const addedExisting = [];
  const inputSpellings = new Set();
  for (const item of words) {
    const spelling = requiredText(item.spelling, "spelling", 200);
    const key = spelling.toLowerCase();
    if (inputSpellings.has(key)) {
      duplicates.push({ spelling, reason: "duplicate_in_request" });
      continue;
    }
    inputSpellings.add(key);
    const existing = await db.prepare("SELECT id, spelling FROM words WHERE spelling = ? COLLATE NOCASE").bind(spelling).first();
    if (existing) {
      duplicates.push({ id: existing.id, spelling: existing.spelling, reason: "already_exists" });
      if (listId && onDuplicate === "add_to_notebook") {
        const membership = await addMembershipIfMissing(db, listId, existing.id, sectionId, nextNo);
        if (membership.added) {
          addedExisting.push({ id: existing.id, spelling: existing.spelling });
          if (membership.usedTopLevelNo) nextNo += 1;
        }
      }
      continue;
    }
    const id = await uniqueId(db, "words", slugifyWord(spelling));
    const columns = Object.entries(WORD_COLUMN_MAP).filter(([field]) => field === "spelling" || item[field] !== undefined);
    await db
      .prepare(
        "INSERT INTO words (id, " +
          columns.map(([, column]) => column).join(", ") +
          ") VALUES (?, " +
          columns.map(() => "?").join(", ") +
          ")"
      )
      .bind(id, ...columns.map(([field]) => dbWordValue(field, field === "spelling" ? spelling : item[field])))
      .run();
    const statements = childStatements(db, id, item, false);
    if (statements.length) await db.batch(statements);
    if (listId) {
      const membership = await addMembershipIfMissing(db, listId, id, sectionId, nextNo);
      if (membership.usedTopLevelNo) nextNo += 1;
    }
    created.push({ id, spelling });
  }
  await audit(db, auth, "create_words", listId ? "notebook" : "word_collection", listId, {
    created: created.map((word) => word.id),
    duplicateCount: duplicates.length,
    addedExisting: addedExisting.map((word) => word.id),
    sectionId,
  });
  return {
    createdCount: created.length,
    duplicateCount: duplicates.length,
    addedExistingCount: addedExisting.length,
    created,
    duplicates,
    addedExisting,
    notebook: listId ? { listId, sectionId } : null,
  };
}

async function resolveWord(db, args) {
  if (args.word_id) {
    const row = await db.prepare("SELECT id, spelling FROM words WHERE id = ?").bind(String(args.word_id)).first();
    if (!row) throw new Error("Word not found: " + args.word_id);
    return row;
  }
  const spelling = requiredText(args.lookup_spelling, "lookup_spelling", 200);
  const row = await db.prepare("SELECT id, spelling FROM words WHERE spelling = ? COLLATE NOCASE").bind(spelling).first();
  if (!row) throw new Error("Word not found: " + spelling);
  return row;
}

async function updateWord(db, args, auth) {
  validateWordInput(args, 0, false);
  const word = await resolveWord(db, args);
  const sets = [];
  const values = [];
  for (const [field, column] of Object.entries(WORD_COLUMN_MAP)) {
    if (field === "spelling" && args.spelling !== undefined) {
      const spelling = requiredText(args.spelling, "spelling", 200);
      const duplicate = await db
        .prepare("SELECT id FROM words WHERE spelling = ? COLLATE NOCASE AND id != ?")
        .bind(spelling, word.id)
        .first();
      if (duplicate) throw new Error("Another word already has that spelling");
      sets.push(column + " = ?");
      values.push(spelling);
    } else if (field !== "spelling" && args[field] !== undefined) {
      if (field === "derived_from_word_id" && args[field]) {
        if (String(args[field]) === word.id) throw new Error("A word cannot be derived from itself");
        const parent = await db.prepare("SELECT id FROM words WHERE id = ?").bind(args[field]).first();
        if (!parent) throw new Error("Derived-from word not found: " + args[field]);
      }
      sets.push(column + " = ?");
      values.push(dbWordValue(field, args[field]));
    }
  }
  const childFields = ["senses", "examples", "derivatives", "tags"].filter((field) => args[field] !== undefined);
  if (!sets.length && !childFields.length) throw new Error("At least one field to update is required");
  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    await db.prepare("UPDATE words SET " + sets.join(", ") + " WHERE id = ?").bind(...values, word.id).run();
  }
  const statements = childStatements(db, word.id, args, true);
  if (statements.length) await db.batch(statements);
  await audit(db, auth, "update_word", "word", word.id, {
    spelling: word.spelling,
    fields: [
      ...Object.keys(WORD_COLUMN_MAP).filter((field) => args[field] !== undefined),
      ...childFields,
    ],
  });
  const updated = await db.prepare("SELECT id, spelling, updated_at AS updatedAt FROM words WHERE id = ?").bind(word.id).first();
  return { updated: true, word: updated };
}

async function resolveWordIds(db, args) {
  const ids = new Set((args.word_ids || []).map(String));
  const missingSpellings = [];
  for (const value of args.spellings || []) {
    const spelling = requiredText(value, "spelling", 200);
    const row = await db.prepare("SELECT id FROM words WHERE spelling = ? COLLATE NOCASE").bind(spelling).first();
    if (row) ids.add(String(row.id));
    else missingSpellings.push(spelling);
  }
  if (!ids.size && !missingSpellings.length) throw new Error("word_ids or spellings is required");
  const valid = [];
  const missingIds = [];
  for (const id of ids) {
    const row = await db.prepare("SELECT id, spelling FROM words WHERE id = ?").bind(id).first();
    if (row) valid.push(row);
    else missingIds.push(id);
  }
  return { valid, missingIds, missingSpellings };
}

async function addWordsToNotebook(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const sectionId = await validateOptionalSection(db, notebook.id, args.section_id);
  const resolved = await resolveWordIds(db, args);
  let nextNo = await nextListNo(db, notebook.id);
  const added = [];
  const skipped = [];
  for (const word of resolved.valid) {
    const membership = await addMembershipIfMissing(db, notebook.id, word.id, sectionId, nextNo);
    if (membership.added) {
      added.push(word);
      if (membership.usedTopLevelNo) nextNo += 1;
    } else {
      skipped.push(word);
    }
  }
  await audit(db, auth, "add_words_to_notebook", "notebook", notebook.id, {
    added: added.map((word) => word.id),
    skipped: skipped.map((word) => word.id),
    sectionId,
  });
  return {
    addedCount: added.length,
    skippedCount: skipped.length,
    added,
    skipped,
    notFound: { wordIds: resolved.missingIds, spellings: resolved.missingSpellings },
  };
}

async function moveWords(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  const sectionId = await validateOptionalSection(db, notebook.id, args.section_id);
  const labelId = args.label_id === undefined || args.label_id === null ? null : (await requireLabel(db, notebook.id, sectionId, args.label_id)).id;
  const ids = Array.isArray(args.word_ids) ? [...new Set(args.word_ids.map(String))] : [];
  if (!ids.length || ids.length > 100) throw new Error("word_ids must contain between 1 and 100 items");
  const moved = new Set();
  const missing = [];
  for (const id of ids) {
    const membership = await db
      .prepare("SELECT no FROM list_items WHERE list_id = ? AND word_id = ?")
      .bind(notebook.id, id)
      .first();
    if (!membership) {
      missing.push(id);
      continue;
    }
    const family = await db
      .prepare("SELECT word_id AS wordId FROM list_items WHERE list_id = ? AND no = ?")
      .bind(notebook.id, membership.no)
      .all();
    await db.prepare("UPDATE list_items SET section_id = ?, label_id = ? WHERE list_id = ? AND no = ?").bind(sectionId, labelId, notebook.id, membership.no).run();
    for (const row of family.results) moved.add(String(row.wordId));
  }
  await renumberListItemsToDisplayOrder(db, notebook.id);
  const movedWordIds = [...moved];
  await audit(db, auth, "move_words", "notebook", notebook.id, { wordIds: movedWordIds, sectionId, labelId, missing });
  return { movedCount: movedWordIds.length, movedWordIds, missingWordIds: missing, sectionId, labelId };
}

async function removeWordsFromNotebook(db, args, auth) {
  const notebook = await requireNotebook(db, args.list_id);
  if (String(args.confirm_notebook_name || "") !== notebook.name) {
    throw new Error("confirm_notebook_name must exactly match the notebook name: " + notebook.name);
  }
  const ids = Array.isArray(args.word_ids) ? [...new Set(args.word_ids.map(String))] : [];
  if (!ids.length || ids.length > 100) throw new Error("word_ids must contain between 1 and 100 items");
  const removed = [];
  const notPresent = [];
  for (const id of ids) {
    const membership = await db
      .prepare("SELECT 1 FROM list_items WHERE list_id = ? AND word_id = ?")
      .bind(notebook.id, id)
      .first();
    if (!membership) {
      notPresent.push(id);
      continue;
    }
    await db.prepare("DELETE FROM list_items WHERE list_id = ? AND word_id = ?").bind(notebook.id, id).run();
    removed.push(id);
  }
  await renumberListItemsToDisplayOrder(db, notebook.id);
  await audit(db, auth, "remove_words_from_notebook", "notebook", notebook.id, { wordIds: removed, notPresent });
  return {
    removedCount: removed.length,
    removedWordIds: removed,
    notPresentWordIds: notPresent,
    masterWordsDeleted: false,
    recoverable: true,
  };
}

async function listRecentChanges(db, args) {
  const limit = args.limit === undefined ? 20 : Number(args.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("limit must be between 1 and 100");
  const rows = await db
    .prepare(
      "SELECT id, actor, action, target_type AS targetType, target_id AS targetId, details, created_at AS createdAt FROM mcp_audit_log ORDER BY id DESC LIMIT ?"
    )
    .bind(limit)
    .all();
  return {
    changes: rows.results.map((row) => {
      let details = {};
      try {
        details = row.details ? JSON.parse(row.details) : {};
      } catch {
        details = {};
      }
      return { ...row, details };
    }),
  };
}

export async function callProtectedTool(name, args, env, auth) {
  if (name === "list_recent_changes") return listRecentChanges(env.DB, args);
  if (name === "create_notebook") return createNotebook(env.DB, args, auth);
  if (name === "update_notebook") return updateNotebook(env.DB, args, auth);
  if (name === "reorder_notebooks") return reorderNotebooks(env.DB, args, auth);
  if (name === "create_chapter") return createChapter(env.DB, args, auth);
  if (name === "update_chapter") return updateChapter(env.DB, args, auth);
  if (name === "reorder_chapters") return reorderChapters(env.DB, args, auth);
  if (name === "create_group") return createGroup(env.DB, args, auth);
  if (name === "update_group") return updateGroup(env.DB, args, auth);
  if (name === "delete_group") return deleteGroup(env.DB, args, auth);
  if (name === "create_section") return createSection(env.DB, args, auth);
  if (name === "update_section") return updateSection(env.DB, args, auth);
  if (name === "reorder_sections") return reorderSections(env.DB, args, auth);
  if (name === "create_label") return createLabel(env.DB, args, auth);
  if (name === "update_label") return updateLabel(env.DB, args, auth);
  if (name === "create_words") return createWords(env.DB, args, auth);
  if (name === "update_word") return updateWord(env.DB, args, auth);
  if (name === "add_words_to_notebook") return addWordsToNotebook(env.DB, args, auth);
  if (name === "move_words") return moveWords(env.DB, args, auth);
  if (name === "remove_words_from_notebook") return removeWordsFromNotebook(env.DB, args, auth);
  throw new Error("Unknown protected tool: " + name);
}
