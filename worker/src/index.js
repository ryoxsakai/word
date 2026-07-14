import { renderMarkup } from "../../public/shared/markup.js";
import awlData from "./data/awl.json";
import oxford5000Data from "./data/oxford5000.json";
import target1900Data from "./data/target1900.json";
import target1400Data from "./data/target1400.json";

/** 仮想の親リスト（全単語マスター）の ID */
const MASTER_LIST_ID = "__master__";

const LEGACY_PRESET_LIST_PREFIXES = ["awl-sublist-", "oxford5000-"];

/** 単語帳ごとに選べるセクションの呼び方 */
const SECTION_LABELS = ["Section", "Unit", "Part"];
/** 単語帳ごとに選べるチャプター(セクションの上位概念)の呼び方 */
const CHAPTER_LABELS = ["Chapter", "Module", "Volume"];

function isNotebookListId(id) {
  return id && id !== MASTER_LIST_ID && !LEGACY_PRESET_LIST_PREFIXES.some((p) => id.startsWith(p));
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });
}

function notFound(message = "not found") {
  return json({ error: message }, { status: 404 });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

// スペル(英単語)専用。ASCII前提でシンプルなスラッグを作る。
function slugify(spelling) {
  return (
    String(spelling)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `word-${Date.now().toString(36)}`
  );
}

// 日本語名（リスト名など）にも対応したスラッグ生成。Unicodeの文字・数字は残す。
function slugifyUnicode(name) {
  return (
    String(name)
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || `list-${Date.now().toString(36)}`
  );
}

async function uniqueWordId(db, spelling) {
  const base = slugify(spelling);
  let id = base;
  let n = 2;
  while (true) {
    const row = await db.prepare("SELECT 1 FROM words WHERE id = ?").bind(id).first();
    if (!row) return id;
    id = `${base}-${n}`;
    n += 1;
  }
}

async function resolveWordIdBySpelling(db, spelling) {
  if (!spelling) return null;
  const row = await db.prepare("SELECT id FROM words WHERE spelling = ? COLLATE NOCASE").bind(spelling).first();
  return row ? row.id : null;
}

// "42" または "42-1" 形式の文字列を {no, branch} にパースする。branch省略時は0（枝番なし）。
function parseBranchNo(raw) {
  if (raw == null || raw === "") return null;
  const m = String(raw).trim().match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  return { no: parseInt(m[1], 10), branch: m[2] ? parseInt(m[2], 10) : 0 };
}

function formatNo(no, branch) {
  if (no == null) return null;
  return branch ? `${no}-${branch}` : String(no);
}

async function nextTopLevelNo(db, listId) {
  const row = await db.prepare("SELECT COALESCE(MAX(no), 0) AS maxNo FROM list_items WHERE list_id = ?").bind(listId).first();
  return (row?.maxNo || 0) + 1;
}

async function parentNoInList(db, listId, derivedFromId) {
  if (!derivedFromId) return null;
  const row = await db.prepare("SELECT no FROM list_items WHERE list_id = ? AND word_id = ?").bind(listId, derivedFromId).first();
  return row ? row.no : null;
}

async function nextBranchForNo(db, listId, no) {
  const row = await db.prepare("SELECT COALESCE(MAX(branch), 0) AS maxBranch FROM list_items WHERE list_id = ? AND no = ?").bind(listId, no).first();
  return (row?.maxBranch || 0) + 1;
}

// 新規に単語をリストへ追加する際の no/branch を決める。
// 派生元(derived_from_id)がすでに同じリストに入っていれば、その no を共有した枝番号を振る。
// そうでなければ通常どおり末尾に新しい no を振る。
async function computeNoForNewMembership(db, listId, wordId) {
  const word = await db.prepare("SELECT derived_from_id FROM words WHERE id = ?").bind(wordId).first();
  if (word?.derived_from_id) {
    const parentNo = await parentNoInList(db, listId, word.derived_from_id);
    if (parentNo != null) {
      const branch = await nextBranchForNo(db, listId, parentNo);
      return { no: parentNo, branch };
    }
  }
  const no = await nextTopLevelNo(db, listId);
  return { no, branch: 0 };
}

/** リスト内の見出し語 -> {id, no} の対応表を作り、renderMarkup の resolve として使う */
function makeResolver(listWordsBySpelling) {
  return (headword) => {
    const hit = listWordsBySpelling.get(headword.toLowerCase());
    if (!hit) return { found: false };
    return { found: true, id: hit.id, no: hit.no };
  };
}

async function loadListWordIndex(db, listId) {
  const map = new Map();
  if (!listId) return map;
  const { results } = await db
    .prepare(
      `SELECT w.id AS id, w.spelling AS spelling, li.no AS no, li.branch AS branch
       FROM list_items li JOIN words w ON w.id = li.word_id
       WHERE li.list_id = ?`
    )
    .bind(listId)
    .all();
  for (const r of results) map.set(r.spelling.toLowerCase(), { id: r.id, no: formatNo(r.no, r.branch) });
  return map;
}

// ---- lists ----

async function listLists(db) {
  const { results } = await db
    .prepare("SELECT id, name, description, sort_order, section_label AS sectionLabel, chapter_label AS chapterLabel FROM lists ORDER BY sort_order, name")
    .all();
  const notebooks = results
    .filter((l) => isNotebookListId(l.id))
    .map((l) => ({ ...l, isMaster: false, isNotebook: true }));
  return json([
    {
      id: MASTER_LIST_ID,
      name: "単語マスター（全語）",
      description: "登録済みの全単語。ここからチェックして単語帳へ追加します",
      sort_order: -1,
      isMaster: true,
      isNotebook: false,
    },
    ...notebooks,
  ]);
}

async function createList(db, body) {
  if (!body.name) return badRequest("name is required");
  const id = body.id || slugifyUnicode(body.name);
  if (!isNotebookListId(id)) return badRequest(`list id "${id}" is reserved`);
  const exists = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(id).first();
  if (exists) return badRequest(`list id "${id}" already exists`);
  const row = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM lists WHERE id NOT LIKE 'awl-sublist-%' AND id NOT LIKE 'oxford5000-%' AND id != ?").bind(MASTER_LIST_ID).first();
  const sortOrder = body.sortOrder ?? (row?.m || 0) + 1;
  await db
    .prepare("INSERT INTO lists (id, name, description, sort_order) VALUES (?, ?, ?, ?)")
    .bind(id, body.name, body.description || null, sortOrder)
    .run();
  return json({ id }, { status: 201 });
}

async function updateList(db, listId, body) {
  if (!isNotebookListId(listId)) return badRequest("this list cannot be edited");
  const list = await db.prepare("SELECT id FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  if (!body.name) return badRequest("name is required");

  const setClauses = ["name = ?", "description = ?"];
  const binds = [body.name, body.description || null];
  if (body.sectionLabel !== undefined) {
    if (!SECTION_LABELS.includes(body.sectionLabel)) return badRequest(`invalid sectionLabel "${body.sectionLabel}"`);
    setClauses.push("section_label = ?");
    binds.push(body.sectionLabel);
  }
  if (body.chapterLabel !== undefined) {
    if (!CHAPTER_LABELS.includes(body.chapterLabel)) return badRequest(`invalid chapterLabel "${body.chapterLabel}"`);
    setClauses.push("chapter_label = ?");
    binds.push(body.chapterLabel);
  }
  await db
    .prepare(`UPDATE lists SET ${setClauses.join(", ")} WHERE id = ?`)
    .bind(...binds, listId)
    .run();
  return json({ ok: true });
}

async function deleteList(db, listId) {
  if (!isNotebookListId(listId)) return badRequest("this list cannot be deleted");
  const list = await db.prepare("SELECT id FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  await db.prepare("DELETE FROM list_items WHERE list_id = ?").bind(listId).run();
  await db.prepare("DELETE FROM sections WHERE list_id = ?").bind(listId).run();
  await db.prepare("DELETE FROM chapters WHERE list_id = ?").bind(listId).run();
  await db.prepare("DELETE FROM lists WHERE id = ?").bind(listId).run();
  return json({ ok: true });
}

// 単語帳(リスト)自体の並び順(sort_order)を入れ替える。プリセット系リスト・マスターは対象外。
async function reorderLists(db, body) {
  const listIds = body.listIds;
  if (!Array.isArray(listIds) || listIds.length === 0) return badRequest("listIds is required");
  if (!listIds.every(isNotebookListId)) return badRequest("listIds contains a non-editable list");

  const stmts = listIds.map((id, index) =>
    db.prepare("UPDATE lists SET sort_order = ? WHERE id = ?").bind(index + 1, id)
  );
  await runBatched(db, stmts);
  return json({ ok: true });
}

const WORD_TAG_SELECT = `
  ta.tag_value AS awlSublist,
  to5.tag_value AS oxfordLevel,
  te.tag_value AS eiken,
  t19.tag_value AS target1900No,
  t14.tag_value AS target1400No
`;

// 単語一覧に表示する「見出しの意味」(senses.is_primary=1の1件)。モバイルではpos+meaningをスペルの右に列表示する。
const PRIMARY_MEANING_SELECT = `
  (SELECT se.meaning FROM senses se WHERE se.word_id = w.id AND se.is_primary = 1 ORDER BY se.sort_order, se.id LIMIT 1) AS primaryMeaning,
  (SELECT se.pos FROM senses se WHERE se.word_id = w.id AND se.is_primary = 1 ORDER BY se.sort_order, se.id LIMIT 1) AS primaryPos
`;

const WORD_TAG_JOINS = `
  LEFT JOIN tags ta ON ta.word_id = w.id AND ta.tag_key = 'awl'
  LEFT JOIN tags to5 ON to5.word_id = w.id AND to5.tag_key = 'oxford5000'
  LEFT JOIN tags te ON te.word_id = w.id AND te.tag_key = 'eiken'
  LEFT JOIN tags t19 ON t19.word_id = w.id AND t19.tag_key = 'target1900'
  LEFT JOIN tags t14 ON t14.word_id = w.id AND t14.tag_key = 'target1400'
`;

async function listWordsInList(db, listId) {
  if (listId === MASTER_LIST_ID) {
    return listMasterWords(db, "");
  }
  const list = await db.prepare("SELECT id FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const { results } = await db
    .prepare(
      `SELECT w.id AS id, w.spelling AS spelling, w.pronunciation AS pronunciation,
              li.no AS no, li.branch AS branch, li.section_id AS sectionId, s.name AS sectionName,
              s.subtitle AS sectionSubtitle, s.sort_order AS sectionSortOrder,
              s.chapter_id AS chapterId, c.sort_order AS chapterSortOrder,
              w.derived_from_id AS derivedFromId,
              w.pronunciation_caution AS pronunciationCaution, w.accent_caution AS accentCaution,
              w.polysemous_caution AS polysemousCaution, w.spelling_caution AS spellingCaution,
              w.conjugation_caution AS conjugationCaution,
              ${WORD_TAG_SELECT},
              ${PRIMARY_MEANING_SELECT}
       FROM list_items li JOIN words w ON w.id = li.word_id
       LEFT JOIN sections s ON s.id = li.section_id
       LEFT JOIN chapters c ON c.id = s.chapter_id
       ${WORD_TAG_JOINS}
       WHERE li.list_id = ?
       ORDER BY COALESCE(c.sort_order, -1), COALESCE(s.sort_order, -1), li.no, li.branch`
    )
    .bind(listId)
    .all();
  const rows = results.map((r) => ({
    ...r,
    displayNo: formatNo(r.no, r.branch),
    pronunciationCaution: !!r.pronunciationCaution,
    accentCaution: !!r.accentCaution,
    polysemousCaution: !!r.polysemousCaution,
    spellingCaution: !!r.spellingCaution,
    conjugationCaution: !!r.conjugationCaution,
  }));
  return json(rows);
}

async function listMasterWords(db, searchUrl) {
  const params = searchUrl ? new URL(searchUrl, "http://local").searchParams : new URLSearchParams();
  const awl = params.get("awl");
  const oxford = params.get("oxford");
  const target1900 = params.get("target1900");
  const target1400 = params.get("target1400");
  const q = params.get("q")?.trim();
  const limit = Math.min(Math.max(parseInt(params.get("limit"), 10) || 100, 1), 300);
  const offset = Math.max(parseInt(params.get("offset"), 10) || 0, 0);

  let sql = `
    SELECT w.id AS id, w.spelling AS spelling, w.pronunciation AS pronunciation,
           NULL AS no, 0 AS branch, NULL AS sectionId, NULL AS sectionName,
           w.derived_from_id AS derivedFromId,
           w.pronunciation_caution AS pronunciationCaution, w.accent_caution AS accentCaution,
              w.polysemous_caution AS polysemousCaution, w.spelling_caution AS spellingCaution,
           w.conjugation_caution AS conjugationCaution,
           ${WORD_TAG_SELECT},
           ${PRIMARY_MEANING_SELECT}
    FROM words w
    ${WORD_TAG_JOINS}
    WHERE 1=1`;
  const binds = [];
  if (awl) {
    sql += " AND ta.tag_value = ?";
    binds.push(awl);
  }
  if (oxford) {
    sql += " AND to5.tag_value = ?";
    binds.push(oxford);
  }
  if (target1900) {
    sql += " AND t19.tag_value IS NOT NULL";
  }
  if (target1400) {
    sql += " AND t14.tag_value IS NOT NULL";
  }
  if (q) {
    sql += " AND w.spelling LIKE ? ESCAPE '\\'";
    binds.push(`%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  }
  sql += " ORDER BY w.spelling COLLATE NOCASE LIMIT ? OFFSET ?";
  // hasMoreを判定するため実際のlimitより1件多く取得する
  binds.push(limit + 1, offset);

  const { results } = await db.prepare(sql).bind(...binds).all();
  const hasMore = results.length > limit;
  const words = results.slice(0, limit).map((r) => ({
    ...r,
    displayNo: null,
    pronunciationCaution: !!r.pronunciationCaution,
    accentCaution: !!r.accentCaution,
    polysemousCaution: !!r.polysemousCaution,
    spellingCaution: !!r.spellingCaution,
    conjugationCaution: !!r.conjugationCaution,
  }));
  return json({ words, hasMore, offset, limit });
}

function groupByWordId(rows) {
  const map = new Map();
  for (const { wordId, ...rest } of rows) {
    if (!map.has(wordId)) map.set(wordId, []);
    map.get(wordId).push(rest);
  }
  return map;
}

// 閲覧ページ用: リスト内の全単語を、意味・派生語・例文・タグまで含めて1回のリクエストで返す。
// (単語詳細を1件ずつ取得すると N+1 になってしまうため、子テーブルは word_id IN (...) でまとめて取得する)
async function listWordsInListFull(db, listId) {
  const list = await db
    .prepare("SELECT id, name, description, section_label AS sectionLabel, chapter_label AS chapterLabel FROM lists WHERE id = ?")
    .bind(listId)
    .first();
  if (!list) return notFound("list not found");

  const { results: items } = await db
    .prepare(
      `SELECT w.id AS id, w.spelling AS spelling, w.pronunciation AS pronunciation, w.audio_url AS audioUrl,
              w.etymology AS etymology, w.notes AS notes, w.synonyms AS synonyms, w.antonyms AS antonyms,
              w.irregular_forms AS irregularForms,
              w.pronunciation_caution AS pronunciationCaution, w.accent_caution AS accentCaution,
              w.polysemous_caution AS polysemousCaution, w.spelling_caution AS spellingCaution,
              w.conjugation_caution AS conjugationCaution,
              w.derived_from_id AS derivedFromId,
              li.no AS no, li.branch AS branch, li.section_id AS sectionId,
              s.subtitle AS sectionSubtitle, s.description AS sectionDescription, s.sort_order AS sectionSortOrder,
              s.chapter_id AS chapterId, c.subtitle AS chapterSubtitle, c.description AS chapterDescription, c.sort_order AS chapterSortOrder
       FROM list_items li JOIN words w ON w.id = li.word_id
       LEFT JOIN sections s ON s.id = li.section_id
       LEFT JOIN chapters c ON c.id = s.chapter_id
       WHERE li.list_id = ?
       ORDER BY COALESCE(c.sort_order, -1), COALESCE(s.sort_order, -1), li.no, li.branch`
    )
    .bind(listId)
    .all();

  if (items.length === 0) return json({ list, words: [] });

  // セクション名・チャプター名は保存された文字列ではなく、単語帳の呼び方(Section/Unit/Part、
  // Chapter/Module/Volume)+並び順から常に自動計算する。(並べ替えても番号がずれないようにするため)
  const { results: orderedSections } = await db
    .prepare("SELECT id FROM sections WHERE list_id = ? ORDER BY sort_order, id")
    .bind(listId)
    .all();
  const sectionPositionById = new Map(orderedSections.map((s, i) => [s.id, i + 1]));
  const sectionLabel = list.sectionLabel || "Section";
  const sectionNameById = (sectionId) =>
    sectionId != null && sectionPositionById.has(sectionId) ? `${sectionLabel} ${sectionPositionById.get(sectionId)}` : null;

  const { results: orderedChapters } = await db
    .prepare("SELECT id FROM chapters WHERE list_id = ? ORDER BY sort_order, id")
    .bind(listId)
    .all();
  const chapterPositionById = new Map(orderedChapters.map((c, i) => [c.id, i + 1]));
  const chapterLabel = list.chapterLabel || "Chapter";
  const chapterNameById = (chapterId) =>
    chapterId != null && chapterPositionById.has(chapterId) ? `${chapterLabel} ${chapterPositionById.get(chapterId)}` : null;

  const ids = items.map((r) => r.id);
  const [sensesRows, derivativesRows, examplesRows, tagsRows] = await Promise.all([
    selectInChunks(
      db,
      (ph) => `SELECT word_id AS wordId, pos, meaning, pronunciation, is_primary AS isPrimary, sort_order AS sortOrder FROM senses WHERE word_id IN (${ph}) ORDER BY word_id, sort_order, id`,
      ids
    ),
    selectInChunks(
      db,
      (ph) => `SELECT word_id AS wordId, pos, word, meaning, sort_order AS sortOrder FROM derivatives WHERE word_id IN (${ph}) ORDER BY word_id, sort_order, id`,
      ids
    ),
    selectInChunks(
      db,
      (ph) => `SELECT word_id AS wordId, sentence, answer, translation, type, sort_order AS sortOrder FROM examples WHERE word_id IN (${ph}) ORDER BY word_id, sort_order, id`,
      ids
    ),
    selectInChunks(db, (ph) => `SELECT word_id AS wordId, tag_key AS tagKey, tag_value AS tagValue FROM tags WHERE word_id IN (${ph})`, ids),
  ]);

  const sensesByWord = groupByWordId(sensesRows);
  const derivativesByWord = groupByWordId(derivativesRows);
  const examplesByWord = groupByWordId(examplesRows);
  const tagsByWord = new Map();
  for (const t of tagsRows) {
    if (!tagsByWord.has(t.wordId)) tagsByWord.set(t.wordId, {});
    tagsByWord.get(t.wordId)[t.tagKey] = t.tagValue;
  }

  const spellingById = new Map(items.map((i) => [i.id, i.spelling]));
  const missingDerivedFromIds = [...new Set(items.map((i) => i.derivedFromId).filter((id) => id && !spellingById.has(id)))];
  if (missingDerivedFromIds.length) {
    const rows = await selectInChunks(db, (ph) => `SELECT id, spelling FROM words WHERE id IN (${ph})`, missingDerivedFromIds);
    for (const r of rows) spellingById.set(r.id, r.spelling);
  }

  const words = items.map((r) => ({
    id: r.id,
    spelling: r.spelling,
    pronunciation: r.pronunciation,
    audioUrl: r.audioUrl,
    etymology: r.etymology,
    notes: r.notes,
    synonyms: r.synonyms,
    antonyms: r.antonyms,
    irregularForms: r.irregularForms,
    pronunciationCaution: !!r.pronunciationCaution,
    accentCaution: !!r.accentCaution,
    polysemousCaution: !!r.polysemousCaution,
    spellingCaution: !!r.spellingCaution,
    conjugationCaution: !!r.conjugationCaution,
    no: r.no,
    branch: r.branch,
    displayNo: formatNo(r.no, r.branch),
    sectionId: r.sectionId,
    sectionName: sectionNameById(r.sectionId),
    sectionSubtitle: r.sectionSubtitle,
    sectionDescription: r.sectionDescription,
    sectionSortOrder: r.sectionSortOrder,
    chapterId: r.chapterId,
    chapterName: chapterNameById(r.chapterId),
    chapterSubtitle: r.chapterSubtitle,
    chapterDescription: r.chapterDescription,
    chapterSortOrder: r.chapterSortOrder,
    derivedFromId: r.derivedFromId,
    derivedFromSpelling: r.derivedFromId ? spellingById.get(r.derivedFromId) || null : null,
    senses: sensesByWord.get(r.id) || [],
    derivatives: derivativesByWord.get(r.id) || [],
    examples: examplesByWord.get(r.id) || [],
    tags: tagsByWord.get(r.id) || {},
  }));

  return json({ list, words });
}

// ---- chapters ----
// チャプターはセクションの上位概念で、複数のセクションをまとめる帯。
// セクションと同様、名前は持たずsort_orderの並び順から番号を自動計算し、
// 呼び方(Chapter/Module/Volume)は単語帳(lists.chapter_label)の設定に従う。

async function listChapters(db, listId) {
  if (listId === MASTER_LIST_ID) return json([]);
  const list = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const { results } = await db
    .prepare("SELECT id, subtitle, description, sort_order AS sortOrder FROM chapters WHERE list_id = ? ORDER BY sort_order, id")
    .bind(listId)
    .all();
  return json(results);
}

async function createChapter(db, listId, body) {
  const list = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const row = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM chapters WHERE list_id = ?").bind(listId).first();
  const sortOrder = (row?.m || 0) + 1;
  const result = await db
    .prepare("INSERT INTO chapters (list_id, subtitle, description, sort_order) VALUES (?, ?, ?, ?)")
    .bind(listId, body.subtitle || null, body.description || null, sortOrder)
    .run();
  return json({ id: result.meta.last_row_id, subtitle: body.subtitle || null, description: body.description || null, sortOrder }, { status: 201 });
}

async function updateChapter(db, listId, chapterId, body) {
  const chapter = await db.prepare("SELECT id FROM chapters WHERE id = ? AND list_id = ?").bind(chapterId, listId).first();
  if (!chapter) return notFound("chapter not found");
  await db
    .prepare("UPDATE chapters SET subtitle = ?, description = ? WHERE id = ? AND list_id = ?")
    .bind(body.subtitle || null, body.description || null, chapterId, listId)
    .run();
  return json({ id: Number(chapterId), subtitle: body.subtitle || null, description: body.description || null });
}

async function deleteChapter(db, listId, chapterId) {
  await db.prepare("UPDATE sections SET chapter_id = NULL WHERE list_id = ? AND chapter_id = ?").bind(listId, chapterId).run();
  await db.prepare("DELETE FROM chapters WHERE id = ? AND list_id = ?").bind(chapterId, listId).run();
  return json({ ok: true });
}

// チャプター自体の並び順(sort_order)を入れ替える。セクション・単語のnoが表示順とずれないよう、
// 更新後のチャプター順で単語一覧を読み直してnoを振り直す(reorderSectionsと同じ考え方)。
async function reorderChapters(db, listId, body) {
  const list = await db.prepare("SELECT id FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const chapterIds = body.chapterIds;
  if (!Array.isArray(chapterIds) || chapterIds.length === 0) return badRequest("chapterIds is required");

  const stmts = chapterIds.map((id, index) =>
    db.prepare("UPDATE chapters SET sort_order = ? WHERE id = ? AND list_id = ?").bind(index + 1, id, listId)
  );
  await runBatched(db, stmts);

  await renumberListItemsToMatchDisplayOrder(db, listId);

  return json({ ok: true });
}

// ---- sections ----

async function listSections(db, listId) {
  if (listId === MASTER_LIST_ID) return json([]);
  const list = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const { results } = await db
    .prepare(
      "SELECT id, name, subtitle, description, sort_order AS sortOrder, chapter_id AS chapterId FROM sections WHERE list_id = ? ORDER BY sort_order, id"
    )
    .bind(listId)
    .all();
  return json(results);
}

// セクション名(name列)はもう使わない。番号はsort_orderの並び順から自動計算し、
// 呼び方(Section/Unit/Part)は単語帳(lists.section_label)の設定に従う。
async function createSection(db, listId, body) {
  const list = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const row = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM sections WHERE list_id = ?").bind(listId).first();
  const sortOrder = (row?.m || 0) + 1;
  const result = await db
    .prepare("INSERT INTO sections (list_id, name, subtitle, description, sort_order, chapter_id) VALUES (?, '', ?, ?, ?, ?)")
    .bind(listId, body.subtitle || null, body.description || null, sortOrder, body.chapterId || null)
    .run();
  return json(
    { id: result.meta.last_row_id, subtitle: body.subtitle || null, description: body.description || null, sortOrder, chapterId: body.chapterId || null },
    { status: 201 }
  );
}

async function updateSection(db, listId, sectionId, body) {
  const section = await db.prepare("SELECT id FROM sections WHERE id = ? AND list_id = ?").bind(sectionId, listId).first();
  if (!section) return notFound("section not found");
  await db
    .prepare("UPDATE sections SET subtitle = ?, description = ? WHERE id = ? AND list_id = ?")
    .bind(body.subtitle || null, body.description || null, sectionId, listId)
    .run();
  return json({ id: Number(sectionId), subtitle: body.subtitle || null, description: body.description || null });
}

async function deleteSection(db, listId, sectionId) {
  await db.prepare("UPDATE list_items SET section_id = NULL WHERE list_id = ? AND section_id = ?").bind(listId, sectionId).run();
  await db.prepare("DELETE FROM sections WHERE id = ? AND list_id = ?").bind(sectionId, listId).run();
  return json({ ok: true });
}

// セクション自体の並び順(sort_order)とチャプター所属(chapter_id)をまとめて入れ替える。
// list_itemsのnoには直接触れず、更新後の表示順に合わせて別途振り直す
// (単語一覧の並び順はchapters.sort_order→sections.sort_orderを最優先で見るため)。
async function reorderSections(db, listId, body) {
  const list = await db.prepare("SELECT id FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const sections = body.sections;
  if (!Array.isArray(sections) || sections.length === 0) return badRequest("sections is required");

  const stmts = sections.map((s, index) =>
    db
      .prepare("UPDATE sections SET sort_order = ?, chapter_id = ? WHERE id = ? AND list_id = ?")
      .bind(index + 1, s.chapterId ?? null, s.id, listId)
  );
  await runBatched(db, stmts);

  await renumberListItemsToMatchDisplayOrder(db, listId);

  return json({ ok: true });
}

// チャプター・セクションの並び順だけを変えてもlist_items.noは古い順のまま残ってしまい、
// 画面の表示順(チャプター順→セクション順→no)とnoの値が食い違ってしまう。
// そのため、更新後の順で単語一覧を読み直し、その表示順でnoを振り直す。
async function renumberListItemsToMatchDisplayOrder(db, listId) {
  const { results: headRows } = await db
    .prepare(
      `SELECT li.word_id AS wordId, li.section_id AS sectionId
       FROM list_items li
       LEFT JOIN sections s ON s.id = li.section_id
       LEFT JOIN chapters c ON c.id = s.chapter_id
       WHERE li.list_id = ? AND li.branch = 0
       ORDER BY COALESCE(c.sort_order, -1), COALESCE(s.sort_order, -1), li.no`
    )
    .bind(listId)
    .all();
  await renumberListItemsByHeadOrder(db, listId, headRows);
}

// 単語帳内の並び順を丸ごと入れ替え、noを表示順の連番に振り直す。
// items には「branch=0(派生語ファミリーの見出しとなる語)のword_idを新しい表示順に並べた配列」を渡す。
// 派生語の枝番(42-1, 42-2等)は見出し語と同じnoを共有しているため、見出し語を動かすと
// 枝番の兄弟たちも自動的に一緒に(同じ新しいno・同じ新しいsectionIdへ)移動する。
// UNIQUE制約(list_id, no, branch)に一時的にでも抵触しないよう、一旦負の仮番号へ退避してから
// 本来のno(1,2,3,...)を振り直す2段階更新を行う。
async function renumberListItemsByHeadOrder(db, listId, items) {
  const headIds = items.map((it) => it.wordId);
  if (headIds.length === 0) return 0;

  // items(単語数の多いリストだと数百件になりうる)をIN(...)のプレースホルダに
  // 展開するとD1のバインド変数上限を超えて "too many SQL variables" になるため、
  // 代わりにこのリストの全list_itemsを1回のクエリでまとめて読み、絞り込みはJS側で行う。
  const { results: allRows } = await db
    .prepare("SELECT word_id AS wordId, no, branch FROM list_items WHERE list_id = ?")
    .bind(listId)
    .all();

  const noByHeadId = new Map();
  const familyByNo = new Map();
  for (const r of allRows) {
    if (!familyByNo.has(r.no)) familyByNo.set(r.no, []);
    familyByNo.get(r.no).push(r.wordId);
    if (r.branch === 0) noByHeadId.set(r.wordId, r.no);
  }

  const phase1 = [];
  const phase2 = [];
  let position = 0;
  for (const it of items) {
    const currentNo = noByHeadId.get(it.wordId);
    if (currentNo == null) continue; // このリストに属さない/branch=0でないwordIdは無視
    position += 1;
    const newNo = position;
    const tempNo = -position;
    const family = familyByNo.get(currentNo) || [it.wordId];
    for (const memberWordId of family) {
      phase1.push(
        db.prepare("UPDATE list_items SET no = ? WHERE list_id = ? AND word_id = ?").bind(tempNo, listId, memberWordId)
      );
      phase2.push(
        db
          .prepare("UPDATE list_items SET no = ?, section_id = ? WHERE list_id = ? AND word_id = ?")
          .bind(newNo, it.sectionId ?? null, listId, memberWordId)
      );
    }
  }
  await runBatched(db, phase1);
  await runBatched(db, phase2);

  return position;
}

async function reorderListItems(db, listId, body) {
  const list = await db.prepare("SELECT id FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) return badRequest("items is required");

  const count = await renumberListItemsByHeadOrder(db, listId, items);
  return json({ ok: true, count });
}

// ---- words ----

async function loadWordDetail(db, id) {
  const word = await db
    .prepare(
      `SELECT id, spelling, pronunciation, audio_url AS audioUrl, etymology, notes, synonyms, antonyms, irregular_forms AS irregularForms,
              pronunciation_caution AS pronunciationCaution, accent_caution AS accentCaution,
              polysemous_caution AS polysemousCaution, spelling_caution AS spellingCaution,
              conjugation_caution AS conjugationCaution,
              derived_from_id AS derivedFromId, created_at, updated_at
       FROM words WHERE id = ?`
    )
    .bind(id)
    .first();
  if (!word) return null;

  const [senses, derivatives, examples, tags, memberships, children, parent] = await Promise.all([
    db.prepare("SELECT id, pos, meaning, pronunciation, is_primary, sort_order FROM senses WHERE word_id = ? ORDER BY sort_order, id").bind(id).all(),
    db.prepare("SELECT id, pos, word, meaning, sort_order FROM derivatives WHERE word_id = ? ORDER BY sort_order, id").bind(id).all(),
    db.prepare("SELECT id, sentence, answer, translation, type, sort_order FROM examples WHERE word_id = ? ORDER BY sort_order, id").bind(id).all(),
    db.prepare("SELECT tag_key, tag_value FROM tags WHERE word_id = ?").bind(id).all(),
    db
      .prepare(
        `SELECT li.list_id AS listId, l.name AS listName, li.no AS no, li.branch AS branch, li.section_id AS sectionId
         FROM list_items li JOIN lists l ON l.id = li.list_id
         WHERE li.word_id = ? ORDER BY l.sort_order, l.name`
      )
      .bind(id)
      .all(),
    db.prepare("SELECT id, spelling FROM words WHERE derived_from_id = ? ORDER BY spelling").bind(id).all(),
    word.derivedFromId
      ? db.prepare("SELECT id, spelling FROM words WHERE id = ?").bind(word.derivedFromId).first()
      : Promise.resolve(null),
  ]);

  const tagMap = {};
  for (const t of tags.results) tagMap[t.tag_key] = t.tag_value;

  return {
    ...word,
    pronunciationCaution: !!word.pronunciationCaution,
    accentCaution: !!word.accentCaution,
    polysemousCaution: !!word.polysemousCaution,
    spellingCaution: !!word.spellingCaution,
    conjugationCaution: !!word.conjugationCaution,
    senses: senses.results.map((s) => ({ ...s, is_primary: !!s.is_primary })),
    derivatives: derivatives.results,
    examples: examples.results,
    tags: tagMap,
    lists: memberships.results.map((m) => ({ ...m, displayNo: formatNo(m.no, m.branch) })),
    derivedFrom: parent,
    derivedWords: children.results,
  };
}

async function getWord(db, id) {
  const detail = await loadWordDetail(db, id);
  if (!detail) return notFound("word not found");
  return json(detail);
}

// DELETE + INSERT群をまとめてstatement配列として組み立てる(実行はしない)。
// saveWordChildren側で他テーブル分とまとめて1回のdb.batch()で送るため、往復回数を減らせる。
function buildReplaceChildRowsStatements(db, table, columns, wordId, rows) {
  const stmts = [db.prepare(`DELETE FROM ${table} WHERE word_id = ?`).bind(wordId)];
  const placeholders = columns.map(() => "?").join(", ");
  let i = 0;
  for (const row of rows || []) {
    const values = columns.map((c) => (c === "sort_order" ? i : row[c] ?? null));
    stmts.push(
      db.prepare(`INSERT INTO ${table} (word_id, ${columns.join(", ")}) VALUES (?, ${placeholders})`).bind(wordId, ...values)
    );
    i += 1;
  }
  return stmts;
}

async function replaceChildRows(db, table, columns, wordId, rows) {
  await runBatched(db, buildReplaceChildRowsStatements(db, table, columns, wordId, rows));
}

// 単語編集フォームが管理するtag_keyのみを対象にする。
// target1900/target1400など一括インポートでのみ設定されるタグは対象外にし、
// 保存のたびに消えてしまわないようにする。
function buildReplaceTagsStatements(db, wordId, tags) {
  const stmts = [
    db
      .prepare("DELETE FROM tags WHERE word_id = ? AND (tag_key IN ('oxford5000', 'awl', 'eiken') OR tag_key LIKE 'custom:%')")
      .bind(wordId),
  ];
  for (const [key, value] of Object.entries(tags || {})) {
    if (value === false || value === null || value === undefined) continue;
    stmts.push(db.prepare("INSERT INTO tags (word_id, tag_key, tag_value) VALUES (?, ?, ?)").bind(wordId, key, value === true ? null : String(value)));
  }
  return stmts;
}

async function replaceTags(db, wordId, tags) {
  await runBatched(db, buildReplaceTagsStatements(db, wordId, tags));
}

// senses/derivatives/examples/tagsの置き換えを1回のdb.batch()にまとめて送る。
// (以前は各行ごとにawaitしており、単語1件の保存でD1への往復が10回以上発生し遅かった)
async function saveWordChildren(db, id, body) {
  const stmts = [
    ...buildReplaceChildRowsStatements(db, "senses", ["pos", "meaning", "pronunciation", "is_primary", "sort_order"], id, body.senses),
    ...buildReplaceChildRowsStatements(db, "derivatives", ["pos", "word", "meaning", "sort_order"], id, body.derivatives),
    ...buildReplaceChildRowsStatements(db, "examples", ["sentence", "answer", "translation", "type", "sort_order"], id, body.examples),
    ...buildReplaceTagsStatements(db, id, body.tags),
  ];
  await runBatched(db, stmts);
}

async function resolveDerivedFrom(db, body) {
  if (body.derivedFrom === undefined) return { ok: true, id: undefined };
  if (!body.derivedFrom) return { ok: true, id: null };
  const id = await resolveWordIdBySpelling(db, body.derivedFrom);
  if (!id) return { ok: false };
  return { ok: true, id };
}

async function createWord(db, body) {
  if (!body.spelling) return badRequest("spelling is required");
  const derivedFromResolved = await resolveDerivedFrom(db, body);
  if (!derivedFromResolved.ok) return badRequest(`derivedFrom word "${body.derivedFrom}" not found`);
  const derivedFromId = derivedFromResolved.id || null;

  const id = await uniqueWordId(db, body.spelling);
  await db
    .prepare(
      `INSERT INTO words (id, spelling, pronunciation, audio_url, etymology, notes, synonyms, antonyms, irregular_forms,
                           pronunciation_caution, accent_caution, polysemous_caution, spelling_caution, conjugation_caution, derived_from_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      body.spelling,
      body.pronunciation || null,
      body.audioUrl || null,
      body.etymology || null,
      body.notes || null,
      body.synonyms || null,
      body.antonyms || null,
      body.irregularForms || null,
      body.pronunciationCaution ? 1 : 0,
      body.accentCaution ? 1 : 0,
      body.polysemousCaution ? 1 : 0,
      body.spellingCaution ? 1 : 0,
      body.conjugationCaution ? 1 : 0,
      derivedFromId
    )
    .run();
  await saveWordChildren(db, id, body);

  if (body.listId && isNotebookListId(body.listId)) {
    const parsed = parseBranchNo(body.no);
    const { no, branch } = parsed || (await computeNoForNewMembership(db, body.listId, id));
    await db
      .prepare("INSERT INTO list_items (list_id, word_id, no, branch, section_id) VALUES (?, ?, ?, ?, ?)")
      .bind(body.listId, id, no, branch, body.sectionId || null)
      .run();
  }
  return json(await loadWordDetail(db, id), { status: 201 });
}

async function updateWord(db, id, body) {
  const existing = await db.prepare("SELECT id FROM words WHERE id = ?").bind(id).first();
  if (!existing) return notFound("word not found");
  const derivedFromResolved = await resolveDerivedFrom(db, body);
  if (!derivedFromResolved.ok) return badRequest(`derivedFrom word "${body.derivedFrom}" not found`);

  const commonBinds = [
    body.spelling,
    body.pronunciation || null,
    body.audioUrl || null,
    body.etymology || null,
    body.notes || null,
    body.synonyms || null,
    body.antonyms || null,
    body.irregularForms || null,
    body.pronunciationCaution ? 1 : 0,
    body.accentCaution ? 1 : 0,
    body.polysemousCaution ? 1 : 0,
    body.spellingCaution ? 1 : 0,
    body.conjugationCaution ? 1 : 0,
  ];
  if (derivedFromResolved.id !== undefined) {
    if (derivedFromResolved.id === id) return badRequest("a word cannot be derived from itself");
    await db
      .prepare(
        `UPDATE words SET spelling = ?, pronunciation = ?, audio_url = ?, etymology = ?, notes = ?, synonyms = ?, antonyms = ?, irregular_forms = ?,
                           pronunciation_caution = ?, accent_caution = ?, polysemous_caution = ?, spelling_caution = ?, conjugation_caution = ?, derived_from_id = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(...commonBinds, derivedFromResolved.id, id)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE words SET spelling = ?, pronunciation = ?, audio_url = ?, etymology = ?, notes = ?, synonyms = ?, antonyms = ?, irregular_forms = ?,
                           pronunciation_caution = ?, accent_caution = ?, polysemous_caution = ?, spelling_caution = ?, conjugation_caution = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(...commonBinds, id)
      .run();
  }
  await saveWordChildren(db, id, body);
  return json(await loadWordDetail(db, id));
}

async function deleteWord(db, id) {
  const existing = await db.prepare("SELECT id FROM words WHERE id = ?").bind(id).first();
  if (!existing) return notFound("word not found");
  await db.batch([
    db.prepare("UPDATE words SET derived_from_id = NULL WHERE derived_from_id = ?").bind(id),
    db.prepare("DELETE FROM senses WHERE word_id = ?").bind(id),
    db.prepare("DELETE FROM derivatives WHERE word_id = ?").bind(id),
    db.prepare("DELETE FROM examples WHERE word_id = ?").bind(id),
    db.prepare("DELETE FROM tags WHERE word_id = ?").bind(id),
    db.prepare("DELETE FROM list_items WHERE word_id = ?").bind(id),
    db.prepare("DELETE FROM words WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}

// ---- list membership ----

async function upsertListItem(db, listId, wordId, body) {
  const list = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const word = await db.prepare("SELECT 1 FROM words WHERE id = ?").bind(wordId).first();
  if (!word) return notFound("word not found");

  const parsed = parseBranchNo(body.no);
  if (!parsed) return badRequest('no is required (e.g. "42" or "42-1")');

  await db
    .prepare(
      `INSERT INTO list_items (list_id, word_id, no, branch, section_id) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(list_id, word_id) DO UPDATE SET no = excluded.no, branch = excluded.branch, section_id = excluded.section_id`
    )
    .bind(listId, wordId, parsed.no, parsed.branch, body.sectionId || null)
    .run();
  return json({ ok: true });
}

async function removeListItem(db, listId, wordId) {
  await db.prepare("DELETE FROM list_items WHERE list_id = ? AND word_id = ?").bind(listId, wordId).run();
  return json({ ok: true });
}

// 親リストからチェックした単語を単語帳へ一括追加する。
async function addWordsToList(db, listId, body) {
  if (!isNotebookListId(listId)) return badRequest("cannot add words to this list");
  const list = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const wordIds = body.wordIds;
  if (!Array.isArray(wordIds) || wordIds.length === 0) return badRequest("wordIds array is required");

  const sectionId = body.sectionId || null;
  const uniqueIds = [...new Set(wordIds.map(String))];

  const { results: existingRows } = await db
    .prepare("SELECT word_id AS wordId FROM list_items WHERE list_id = ?")
    .bind(listId)
    .all();
  const existingSet = new Set(existingRows.map((r) => r.wordId));

  const row = await db.prepare("SELECT COALESCE(MAX(no), 0) AS maxNo FROM list_items WHERE list_id = ?").bind(listId).first();
  let nextNo = (row?.maxNo || 0) + 1;

  const inserts = [];
  let added = 0;
  let skipped = 0;
  for (const wordId of uniqueIds) {
    if (existingSet.has(wordId)) {
      skipped += 1;
      continue;
    }
    inserts.push(
      db.prepare("INSERT INTO list_items (list_id, word_id, no, branch, section_id) VALUES (?, ?, ?, 0, ?)").bind(listId, wordId, nextNo, sectionId)
    );
    nextNo += 1;
    added += 1;
  }
  await runBatched(db, inserts);
  return json({ added, skipped });
}

// ---- 単語帳(リスト)の作成方法: 範囲コピー / タグ一括抽出 ----

async function copyRange(db, targetListId, body) {
  const { sourceListId, fromNo, toNo, sectionId } = body;
  if (!sourceListId || fromNo == null || toNo == null) {
    return badRequest("sourceListId, fromNo, toNo are required");
  }
  const targetList = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(targetListId).first();
  if (!targetList) return notFound("target list not found");
  const sourceList = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(sourceListId).first();
  if (!sourceList) return notFound("source list not found");

  const { results: sourceItems } = await db
    .prepare("SELECT word_id AS wordId FROM list_items WHERE list_id = ? AND no BETWEEN ? AND ? ORDER BY no, branch")
    .bind(sourceListId, fromNo, toNo)
    .all();

  let added = 0;
  let skipped = 0;
  for (const item of sourceItems) {
    const exists = await db.prepare("SELECT 1 FROM list_items WHERE list_id = ? AND word_id = ?").bind(targetListId, item.wordId).first();
    if (exists) {
      skipped += 1;
      continue;
    }
    const { no, branch } = await computeNoForNewMembership(db, targetListId, item.wordId);
    await db
      .prepare("INSERT INTO list_items (list_id, word_id, no, branch, section_id) VALUES (?, ?, ?, ?, ?)")
      .bind(targetListId, item.wordId, no, branch, sectionId || null)
      .run();
    added += 1;
  }
  return json({ added, skipped });
}

async function importByTag(db, targetListId, body) {
  const { tagKey, tagValue, sectionId } = body;
  if (!tagKey) return badRequest("tagKey is required");
  const targetList = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(targetListId).first();
  if (!targetList) return notFound("target list not found");

  const stmt = tagValue
    ? db.prepare("SELECT word_id AS wordId FROM tags WHERE tag_key = ? AND tag_value = ?").bind(tagKey, tagValue)
    : db.prepare("SELECT word_id AS wordId FROM tags WHERE tag_key = ?").bind(tagKey);
  const { results: tagRows } = await stmt.all();

  let added = 0;
  let skipped = 0;
  for (const row of tagRows) {
    const exists = await db.prepare("SELECT 1 FROM list_items WHERE list_id = ? AND word_id = ?").bind(targetListId, row.wordId).first();
    if (exists) {
      skipped += 1;
      continue;
    }
    const { no, branch } = await computeNoForNewMembership(db, targetListId, row.wordId);
    await db
      .prepare("INSERT INTO list_items (list_id, word_id, no, branch, section_id) VALUES (?, ?, ?, ?, ?)")
      .bind(targetListId, row.wordId, no, branch, sectionId || null)
      .run();
    added += 1;
  }
  return json({ added, skipped });
}

async function listDistinctTags(db) {
  const { results } = await db.prepare("SELECT DISTINCT tag_key AS tagKey, tag_value AS tagValue FROM tags ORDER BY tag_key, tag_value").all();
  return json(results);
}

// ---- 一括取り込み共通ヘルパー ----
// Cloudflare Workersは1回のリクエストで発行できるサブリクエスト(D1呼び出し含む)数に上限があるため、
// 単語ごとに逐次クエリを投げるのではなく、まとめ読み・db.batch()によるまとめ書きで件数を大幅に減らす。

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ids配列をチャンクに分けてIN(...)クエリを発行し、結果をまとめて1つの配列で返す。
// D1はバインド変数の数に上限があり、リストの単語数が多いと1回のIN(...)に収まらず
// "too many SQL variables" エラーになるため、90件ずつに分割して発行する。
// buildSql(placeholders)は "?, ?, ..." のプレースホルダ文字列を受け取りSQL文字列を返す関数。
async function selectInChunks(db, buildSql, ids, size = 90) {
  const out = [];
  for (const part of chunkArray(ids, size)) {
    if (part.length === 0) continue;
    const placeholders = part.map(() => "?").join(", ");
    const { results } = await db.prepare(buildSql(placeholders)).bind(...part).all();
    out.push(...results);
  }
  return out;
}

// spellingの配列から、既存のwords行を { 小文字spelling -> id } のMapとしてまとめて引く。
async function fetchExistingWordIdsBySpelling(db, spellings) {
  const map = new Map();
  for (const part of chunkArray(spellings, 90)) {
    const placeholders = part.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT id, spelling FROM words WHERE spelling COLLATE NOCASE IN (${placeholders})`)
      .bind(...part)
      .all();
    for (const row of results) map.set(row.spelling.toLowerCase(), row.id);
  }
  return map;
}

// word_idの配列のうち、指定tag_keyのタグが既についているものをまとめて引く。
async function fetchTaggedWordIds(db, tagKey, wordIds) {
  const set = new Set();
  for (const part of chunkArray(wordIds, 90)) {
    const placeholders = part.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT word_id FROM tags WHERE tag_key = ? AND word_id IN (${placeholders})`)
      .bind(tagKey, ...part)
      .all();
    for (const row of results) set.add(row.word_id);
  }
  return set;
}

// 準備済みstatementの配列をdb.batch()でチャンクごとにまとめて実行する。
async function runBatched(db, statements, size = 400) {
  for (const part of chunkArray(statements, size)) {
    if (part.length > 0) await db.batch(part);
  }
}

// ---- AWL(Academic Word List)一括取り込み ----
// 公式PDFから抽出した見出し語(worker/src/data/awl.json)をマスター単語として登録し、
// tag_key="awl", tag_value=<sublist番号> を付与する。既存の単語は内容を上書きせず、
// タグが未設定の場合のみ追加する。取り込み後は既存の「タグから一括追加」機能で
// 任意のリストへ awl:1〜awl:10 を取り込める。
async function importAwl(db) {
  const families = [];
  for (const [sublist, famList] of Object.entries(awlData)) {
    for (const fam of famList) families.push({ sublist, head: fam.head, variants: fam.variants || [] });
  }
  // 同じ見出し語が複数sublistに現れる場合、最初に登場したsublistのタグを優先する。
  const bySpelling = new Map();
  for (const fam of families) {
    const key = fam.head.toLowerCase();
    if (!bySpelling.has(key)) bySpelling.set(key, fam);
  }
  const heads = [...bySpelling.values()];

  const idBySpelling = await fetchExistingWordIdsBySpelling(db, heads.map((f) => f.head));

  const wordInserts = [];
  const derivativeInserts = [];
  let created = 0;
  for (const fam of heads) {
    const key = fam.head.toLowerCase();
    if (idBySpelling.has(key)) continue;
    const id = slugify(fam.head);
    idBySpelling.set(key, id);
    wordInserts.push(db.prepare("INSERT OR IGNORE INTO words (id, spelling) VALUES (?, ?)").bind(id, fam.head));
    fam.variants.forEach((variant, i) => {
      derivativeInserts.push(
        db.prepare("INSERT INTO derivatives (word_id, word, sort_order) VALUES (?, ?, ?)").bind(id, variant, i)
      );
    });
    created += 1;
  }
  await runBatched(db, wordInserts);
  await runBatched(db, derivativeInserts);

  const allWordIds = heads.map((f) => idBySpelling.get(f.head.toLowerCase()));
  const alreadyTaggedSet = await fetchTaggedWordIds(db, "awl", allWordIds);

  const tagInserts = [];
  let tagged = 0;
  let alreadyTagged = 0;
  for (const fam of heads) {
    const wordId = idBySpelling.get(fam.head.toLowerCase());
    if (alreadyTaggedSet.has(wordId)) {
      alreadyTagged += 1;
      continue;
    }
    tagInserts.push(db.prepare("INSERT INTO tags (word_id, tag_key, tag_value) VALUES (?, 'awl', ?)").bind(wordId, fam.sublist));
    tagged += 1;
  }
  await runBatched(db, tagInserts);

  return { created, tagged, alreadyTagged };
}

// ---- Oxford 5000 一括取り込み ----
// 公式PDFから抽出した見出し語(worker/src/data/oxford5000.json)をマスター単語として登録し、
// tag_key="oxford5000", tag_value=<CEFRレベル> を付与する。1語に複数レベルの記載がある場合は
// 最も易しいレベルを採用する。既存の単語は内容を上書きせず、タグが未設定の場合のみ追加する。
async function importOxford5000(db) {
  const entries = Object.entries(oxford5000Data);
  const idBySpelling = await fetchExistingWordIdsBySpelling(db, entries.map(([spelling]) => spelling));

  const wordInserts = [];
  let created = 0;
  for (const [spelling] of entries) {
    const key = spelling.toLowerCase();
    if (idBySpelling.has(key)) continue;
    const id = slugify(spelling);
    idBySpelling.set(key, id);
    wordInserts.push(db.prepare("INSERT OR IGNORE INTO words (id, spelling) VALUES (?, ?)").bind(id, spelling));
    created += 1;
  }
  await runBatched(db, wordInserts);

  const allWordIds = entries.map(([spelling]) => idBySpelling.get(spelling.toLowerCase()));
  const alreadyTaggedSet = await fetchTaggedWordIds(db, "oxford5000", allWordIds);

  const tagInserts = [];
  let tagged = 0;
  let alreadyTagged = 0;
  for (const [spelling, level] of entries) {
    const wordId = idBySpelling.get(spelling.toLowerCase());
    if (alreadyTaggedSet.has(wordId)) {
      alreadyTagged += 1;
      continue;
    }
    tagInserts.push(db.prepare("INSERT INTO tags (word_id, tag_key, tag_value) VALUES (?, 'oxford5000', ?)").bind(wordId, level));
    tagged += 1;
  }
  await runBatched(db, tagInserts);

  return { created, tagged, alreadyTagged };
}

// word_idの配列のうち、指定テーブルに行が既にあるものをまとめて引く(senses/examplesの既存有無チェック用)。
async function fetchWordIdsWithRows(db, table, wordIds) {
  const set = new Set();
  for (const part of chunkArray(wordIds, 90)) {
    const placeholders = part.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT DISTINCT word_id FROM ${table} WHERE word_id IN (${placeholders})`)
      .bind(...part)
      .all();
    for (const row of results) set.add(row.word_id);
  }
  return set;
}

// ---- Target1900 / Target1400 一括取り込み ----
// xlsxから抽出した見出し語・意味・例文(worker/src/data/target1900.json, target1400.json)を
// マスター単語として登録し、tag_key="target1900"/"target1400"(tag_value=通し番号)を付与する。
// AWL/Oxford5000と同様、単語帳への振り分けはUIでチェック選択して行うため、専用リストは作らない。
// 既存の単語・意味・例文・タグは上書きせず、未設定の場合のみ追加する。
async function importTargetList(db, { tagKey, entries }) {
  const idBySpelling = await fetchExistingWordIdsBySpelling(db, entries.map((e) => e.word));

  const wordInserts = [];
  let created = 0;
  for (const entry of entries) {
    const key = entry.word.toLowerCase();
    if (idBySpelling.has(key)) continue;
    const id = slugify(entry.word);
    idBySpelling.set(key, id);
    wordInserts.push(db.prepare("INSERT OR IGNORE INTO words (id, spelling) VALUES (?, ?)").bind(id, entry.word));
    created += 1;
  }
  await runBatched(db, wordInserts);

  const allWordIds = entries.map((e) => idBySpelling.get(e.word.toLowerCase()));

  const withSenses = await fetchWordIdsWithRows(db, "senses", allWordIds);
  const senseInserts = [];
  let sensesAdded = 0;
  for (const entry of entries) {
    const wordId = idBySpelling.get(entry.word.toLowerCase());
    if (withSenses.has(wordId) || !entry.meaning) continue;
    senseInserts.push(
      db.prepare("INSERT INTO senses (word_id, pos, meaning, sort_order) VALUES (?, NULL, ?, 0)").bind(wordId, entry.meaning)
    );
    withSenses.add(wordId);
    sensesAdded += 1;
  }
  await runBatched(db, senseInserts);

  const withExamples = await fetchWordIdsWithRows(db, "examples", allWordIds);
  const exampleInserts = [];
  let examplesAdded = 0;
  for (const entry of entries) {
    if (!entry.exampleBlank) continue;
    const wordId = idBySpelling.get(entry.word.toLowerCase());
    if (withExamples.has(wordId)) continue;
    exampleInserts.push(
      db
        .prepare("INSERT INTO examples (word_id, sentence, answer, translation, sort_order) VALUES (?, ?, ?, ?, 0)")
        .bind(wordId, entry.exampleBlank, entry.answer || null, entry.translation || null)
    );
    withExamples.add(wordId);
    examplesAdded += 1;
  }
  await runBatched(db, exampleInserts);

  const alreadyTaggedSet = await fetchTaggedWordIds(db, tagKey, allWordIds);
  const tagInserts = [];
  let tagged = 0;
  let alreadyTagged = 0;
  for (const entry of entries) {
    const wordId = idBySpelling.get(entry.word.toLowerCase());
    if (alreadyTaggedSet.has(wordId)) {
      alreadyTagged += 1;
      continue;
    }
    tagInserts.push(
      db.prepare("INSERT INTO tags (word_id, tag_key, tag_value) VALUES (?, ?, ?)").bind(wordId, tagKey, String(entry.no))
    );
    tagged += 1;
  }
  await runBatched(db, tagInserts);

  return { created, sensesAdded, examplesAdded, tagged, alreadyTagged };
}

async function importTarget1900(db) {
  return importTargetList(db, { tagKey: "target1900", entries: target1900Data });
}

async function importTarget1400(db) {
  return importTargetList(db, { tagKey: "target1400", entries: target1400Data });
}

// ---- マスター単語（AWL / Oxford 5000 / Target1900 / Target1400）のシード ----
// 親リスト（全語マスター）に各ソースの見出し語とタグを登録する。
// 単語帳への振り分けはUIでチェック選択して行う。

async function seedPresetLists(db) {
  const awl = await importAwl(db);
  const oxford = await importOxford5000(db);
  const target1900 = await importTarget1900(db);
  const target1400 = await importTarget1400(db);
  return { master: { awl, oxford, target1900, target1400 } };
}

// ---- 品詞タグの正規化 ----
// 品詞は英語表記(dictionaryapi.devの返り値。noun/verb/adjective等)や中略表記(n./v./adj.)、
// 日本語の正式名称(名詞/動詞等)などバラバラな形で登録されうるため、
// 設定ページのプルダウン(名/動/形/副/代/冠/前/接/間/助/熟/連)に合わせた1字漢字へ正規化する。
// 対応表にない値は不確かな分類を残さないため空欄にする。
const POS_KANJI_MAP = {
  noun: "名",
  n: "名",
  "n.": "名",
  名詞: "名",
  名: "名",
  verb: "動",
  v: "動",
  "v.": "動",
  "phrasal verb": "動",
  動詞: "動",
  動: "動",
  "transitive verb": "他",
  vt: "他",
  "vt.": "他",
  他動詞: "他",
  他: "他",
  "intransitive verb": "自",
  vi: "自",
  "vi.": "自",
  自動詞: "自",
  自: "自",
  adjective: "形",
  adj: "形",
  "adj.": "形",
  形容詞: "形",
  形: "形",
  adverb: "副",
  adv: "副",
  "adv.": "副",
  副詞: "副",
  副: "副",
  pronoun: "代",
  pron: "代",
  "pron.": "代",
  代名詞: "代",
  代: "代",
  article: "冠",
  determiner: "冠",
  det: "冠",
  "det.": "冠",
  art: "冠",
  "art.": "冠",
  "indefinite article": "冠",
  "definite article": "冠",
  冠詞: "冠",
  限定詞: "冠",
  冠: "冠",
  preposition: "前",
  prep: "前",
  "prep.": "前",
  前置詞: "前",
  前: "前",
  conjunction: "接",
  conj: "接",
  "conj.": "接",
  接続詞: "接",
  接: "接",
  interjection: "間",
  interj: "間",
  "interj.": "間",
  exclamation: "間",
  exclam: "間",
  "exclam.": "間",
  間投詞: "間",
  感嘆詞: "間",
  間: "間",
  "auxiliary verb": "助",
  "modal verb": "助",
  modal: "助",
  aux: "助",
  "aux.": "助",
  助動詞: "助",
  助: "助",
  idiom: "熟",
  "idiom.": "熟",
  idm: "熟",
  "idm.": "熟",
  熟語: "熟",
  熟: "熟",
  collocation: "連",
  連語: "連",
  連: "連",
};

function normalizePos(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  return POS_KANJI_MAP[trimmed] || POS_KANJI_MAP[trimmed.toLowerCase()] || "";
}

// 既存のsenses/derivativesのposを一括で正規化する。冪等(既に正規化済みなら変更なし)。
async function normalizePosTags(db) {
  const [senses, derivatives] = await Promise.all([
    db.prepare("SELECT id, pos FROM senses WHERE pos IS NOT NULL AND pos != ''").all(),
    db.prepare("SELECT id, pos FROM derivatives WHERE pos IS NOT NULL AND pos != ''").all(),
  ]);

  const updates = [];
  let sensesUpdated = 0;
  let sensesUnmapped = 0;
  for (const row of senses.results) {
    const normalized = normalizePos(row.pos);
    if (normalized === row.pos) continue;
    if (!normalized) sensesUnmapped += 1;
    updates.push(db.prepare("UPDATE senses SET pos = ? WHERE id = ?").bind(normalized || null, row.id));
    sensesUpdated += 1;
  }
  let derivativesUpdated = 0;
  let derivativesUnmapped = 0;
  for (const row of derivatives.results) {
    const normalized = normalizePos(row.pos);
    if (normalized === row.pos) continue;
    if (!normalized) derivativesUnmapped += 1;
    updates.push(db.prepare("UPDATE derivatives SET pos = ? WHERE id = ?").bind(normalized || null, row.id));
    derivativesUpdated += 1;
  }
  await runBatched(db, updates);

  return {
    sensesTotal: senses.results.length,
    sensesUpdated,
    sensesUnmapped,
    derivativesTotal: derivatives.results.length,
    derivativesUpdated,
    derivativesUnmapped,
  };
}

// キュレーション済みの意味を単語(spelling指定)ごとに一括反映する。
// 既存の意味はすべて置き換える(バッチレビュー→承認を経た内容を書き込む一回限りの用途)。
// body: [{ spelling, senses: [{ pos, meaning, isPrimary }] }, ...]
async function applyCuratedSenses(db, body) {
  const items = Array.isArray(body) ? body : body?.words;
  if (!Array.isArray(items)) return badRequest("expected an array of {spelling, senses}");

  let updated = 0;
  let notFound = 0;
  const notFoundSpellings = [];
  for (const item of items) {
    if (!item?.spelling || !Array.isArray(item.senses)) continue;
    const word = await db.prepare("SELECT id FROM words WHERE spelling = ? COLLATE NOCASE").bind(item.spelling).first();
    if (!word) {
      notFound += 1;
      notFoundSpellings.push(item.spelling);
      continue;
    }
    const rows = item.senses.map((s) => ({
      pos: s.pos || null,
      meaning: s.meaning,
      pronunciation: null,
      is_primary: s.isPrimary ? 1 : 0,
    }));
    await replaceChildRows(db, "senses", ["pos", "meaning", "pronunciation", "is_primary", "sort_order"], word.id, rows);
    updated += 1;
  }
  return json({ total: items.length, updated, notFound, notFoundSpellings });
}

// 例文/フレーズのデータ品質調査(一時的な診断用エンドポイント)。
// 和訳の欠落・文頭が小文字・末尾に終端句読点(.!?)がない、を洗い出す。
function hasNoTerminalPunct(sentence) {
  const s = String(sentence).trim();
  return !/[.!?…][")\]”’']?$/.test(s);
}

async function examplesReport(db) {
  const { results } = await db
    .prepare(
      `SELECT e.id AS id, w.spelling AS spelling, e.type AS type, e.sentence AS sentence, e.translation AS translation
       FROM examples e JOIN words w ON w.id = e.word_id`
    )
    .all();

  let missingTranslation = 0;
  let lowercaseStart = 0;
  let missingTerminalPunct = 0;
  let typeExample = 0;
  let typePhrase = 0;
  const problems = [];

  for (const r of results) {
    if (r.type === "phrase") typePhrase += 1;
    else typeExample += 1;

    const issues = [];
    if (!r.translation || !String(r.translation).trim()) issues.push("missingTranslation");
    if (/^[a-z]/.test(r.sentence || "")) issues.push("lowercaseStart");
    if (hasNoTerminalPunct(r.sentence || "")) issues.push("missingTerminalPunct");

    if (issues.includes("missingTranslation")) missingTranslation += 1;
    if (issues.includes("lowercaseStart")) lowercaseStart += 1;
    if (issues.includes("missingTerminalPunct")) missingTerminalPunct += 1;

    if (issues.length) {
      problems.push({ id: r.id, spelling: r.spelling, type: r.type, sentence: r.sentence, translation: r.translation, issues });
    }
  }

  return json({
    total: results.length,
    typeExample,
    typePhrase,
    missingTranslation,
    lowercaseStart,
    missingTerminalPunct,
    problemCount: problems.length,
    problems,
  });
}

// 例文の文頭大文字化・末尾句読点をまとめて機械的に修正する(和訳には触れない)。
// body: [{ id, sentence }, ...] examples.id と修正後の全文を渡す。
async function fixExamplesFormatting(db, body) {
  const items = Array.isArray(body) ? body : body?.items;
  if (!Array.isArray(items)) return badRequest("expected an array of {id, sentence}");

  let updated = 0;
  let notFound = 0;
  for (const item of items) {
    if (item?.id == null || typeof item.sentence !== "string") continue;
    const result = await db
      .prepare("UPDATE examples SET sentence = ? WHERE id = ?")
      .bind(item.sentence, item.id)
      .run();
    if (result.meta.changes > 0) updated += 1;
    else notFound += 1;
  }
  return json({ total: items.length, updated, notFound });
}

// 例文のid指定で和訳をまとめて反映する(既存の和訳は上書き)。
// body: [{ id, translation }, ...]
async function fixExamplesTranslation(db, body) {
  const items = Array.isArray(body) ? body : body?.items;
  if (!Array.isArray(items)) return badRequest("expected an array of {id, translation}");

  let updated = 0;
  let notFound = 0;
  for (const item of items) {
    if (item?.id == null || typeof item.translation !== "string") continue;
    const result = await db
      .prepare("UPDATE examples SET translation = ? WHERE id = ?")
      .bind(item.translation, item.id)
      .run();
    if (result.meta.changes > 0) updated += 1;
    else notFound += 1;
  }
  return json({ total: items.length, updated, notFound });
}

// ---- markup render (##記法 のサーバー側解決。設定ページのプレビュー確認用) ----

async function renderText(db, body) {
  const index = await loadListWordIndex(db, body.listId);
  const html = renderMarkup(body.text || "", { resolve: makeResolver(index) });
  return json({ html });
}

// ---- 辞書情報の自動取得（無料辞書API https://dictionaryapi.dev/ 経由）----
// 品詞ごとに発音が変わる単語（record等）は1つの発音しか取れないため、
// 参考値として埋めるだけにとどめ、必要なら手動で調整してもらう想定。
// 日本語訳は取れないため、意味欄には英語定義を「（辞書・英）…」として下書きする。
function isBlankText(value) {
  return value == null || String(value).trim() === "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function lookupWordInfo(spelling) {
  if (!spelling) return null;
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(spelling)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;

    let pronunciation = null;
    let audio = null;
    const synonyms = new Set();
    const antonyms = new Set();
    const examples = [];
    const senses = [];

    for (const entry of data) {
      if (!pronunciation && entry.phonetic) pronunciation = entry.phonetic;
      for (const p of entry.phonetics || []) {
        if (!pronunciation && p.text) pronunciation = p.text;
        if (!audio && p.audio) audio = p.audio;
      }
      for (const meaning of entry.meanings || []) {
        const pos = normalizePos(meaning.partOfSpeech) || null;
        for (const syn of meaning.synonyms || []) synonyms.add(syn);
        for (const ant of meaning.antonyms || []) antonyms.add(ant);
        for (const def of meaning.definitions || []) {
          for (const syn of def.synonyms || []) synonyms.add(syn);
          for (const ant of def.antonyms || []) antonyms.add(ant);
          if (def.definition && senses.length < 5) {
            senses.push({
              pos,
              meaning: `（辞書・英）${def.definition}`,
            });
          }
          if (def.example && examples.length < 3) examples.push(def.example);
        }
      }
    }

    return {
      pronunciation,
      audio,
      senses,
      synonyms: [...synonyms].slice(0, 8),
      antonyms: [...antonyms].slice(0, 8),
      examples,
    };
  } catch (err) {
    return { error: String(err && err.message ? err.message : err) };
  }
}

function joinWords(words) {
  return words && words.length ? words.join(", ") : null;
}

function wordNeedsEnrichment(detail) {
  if (isBlankText(detail.pronunciation)) return true;
  if (isBlankText(detail.audioUrl)) return true;
  if (!detail.senses?.length) return true;
  if (!detail.examples?.length) return true;
  if (isBlankText(detail.synonyms) && isBlankText(detail.antonyms)) return true;
  return false;
}

// 登録済み単語の空欄のみ辞書情報で補完する（既存データは上書きしない）。
async function enrichSingleWord(db, id) {
  const detail = await loadWordDetail(db, id);
  if (!detail) return { id, status: "missing" };

  if (!wordNeedsEnrichment(detail)) {
    return { id, spelling: detail.spelling, status: "skipped" };
  }

  const info = await lookupWordInfo(detail.spelling);
  if (!info || info.error) {
    return { id, spelling: detail.spelling, status: "notFound", error: info?.error || null };
  }

  const fields = [];
  const updates = [];
  const binds = [];

  if (isBlankText(detail.pronunciation) && info.pronunciation) {
    updates.push("pronunciation = ?");
    binds.push(info.pronunciation);
    fields.push("pronunciation");
  }
  if (isBlankText(detail.audioUrl) && info.audio) {
    updates.push("audio_url = ?");
    binds.push(info.audio);
    fields.push("audioUrl");
  }
  if (isBlankText(detail.synonyms) && info.synonyms?.length) {
    updates.push("synonyms = ?");
    binds.push(joinWords(info.synonyms));
    fields.push("synonyms");
  }
  if (isBlankText(detail.antonyms) && info.antonyms?.length) {
    updates.push("antonyms = ?");
    binds.push(joinWords(info.antonyms));
    fields.push("antonyms");
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    await db
      .prepare(`UPDATE words SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...binds, id)
      .run();
  }

  if (!detail.senses?.length && info.senses?.length > 0) {
    let i = 0;
    for (const sense of info.senses) {
      await db
        .prepare("INSERT INTO senses (word_id, pos, meaning, pronunciation, sort_order) VALUES (?, ?, ?, ?, ?)")
        .bind(id, sense.pos, sense.meaning, null, i)
        .run();
      i += 1;
    }
    fields.push("senses");
  }

  if (!detail.examples?.length && info.examples?.length > 0) {
    let i = 0;
    for (const sentence of info.examples) {
      await db
        .prepare("INSERT INTO examples (word_id, sentence, answer, translation, sort_order) VALUES (?, ?, ?, ?, ?)")
        .bind(id, sentence, null, null, i)
        .run();
      i += 1;
    }
    fields.push("examples");
  }

  if (fields.length === 0) {
    return { id, spelling: detail.spelling, status: "notFound" };
  }

  return { id, spelling: detail.spelling, status: "enriched", fields };
}

async function enrichWordsBatch(db, body = {}) {
  const batchSize = Math.min(Math.max(parseInt(body.batchSize, 10) || 25, 1), 50);
  const delayMs = Math.min(Math.max(parseInt(body.delayMs, 10) || 120, 0), 1000);
  const cursor = body.cursor ? String(body.cursor) : "";

  const { results } = await db
    .prepare("SELECT id FROM words WHERE id > ? ORDER BY id LIMIT ?")
    .bind(cursor, batchSize)
    .all();

  let processed = 0;
  let enriched = 0;
  let skipped = 0;
  let notFound = 0;
  const items = [];

  for (const row of results) {
    if (processed > 0 && delayMs > 0) await sleep(delayMs);
    const result = await enrichSingleWord(db, row.id);
    processed += 1;
    items.push(result);
    if (result.status === "enriched") enriched += 1;
    else if (result.status === "skipped") skipped += 1;
    else if (result.status === "notFound") notFound += 1;
  }

  const nextCursor = results.length > 0 ? results[results.length - 1].id : cursor;
  const done = results.length < batchSize;

  return {
    processed,
    enriched,
    skipped,
    notFound,
    nextCursor: done ? null : nextCursor,
    done,
    items,
  };
}

async function handleLookup(request) {
  const spelling = new URL(request.url).searchParams.get("spelling");
  if (!spelling) return badRequest("spelling query param is required");
  const info = await lookupWordInfo(spelling);
  if (info && info.error) {
    return json({
      pronunciation: null,
      audio: null,
      senses: [],
      synonyms: [],
      antonyms: [],
      examples: [],
      error: info.error,
    });
  }
  return json(
    info || { pronunciation: null, audio: null, senses: [], synonyms: [], antonyms: [], examples: [] }
  );
}

// フロントエンド(GitHub Pages)とAPI(Cloudflare Workers)が別オリジンになる構成のためのCORS制御。
// env.ALLOWED_ORIGINS はカンマ区切りの許可オリジン一覧（wrangler.toml の [vars] で設定）。
// 未設定時はローカル開発用に localhost / 127.0.0.1 のみ許可する。
function resolveAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (isLocalhost || configured.includes(origin)) return origin;
  return null;
}

function corsHeaders(allowedOrigin) {
  if (!allowedOrigin) return {};
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function withCors(response, allowedOrigin) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(allowedOrigin))) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

async function handleApi(request, env, parts, method) {
  const db = env.DB;

  // /api/master/words?awl=&oxford=&q=
  if (parts.length === 3 && parts[1] === "master" && parts[2] === "words" && method === "GET") {
    return await listMasterWords(db, request.url);
  }

  // /api/lists
  if (parts.length === 2 && parts[1] === "lists") {
    if (method === "GET") return await listLists(db);
    if (method === "POST") return await createList(db, await request.json());
  }

  // /api/lists/reorder （単語帳自体の並び順を更新）
  if (parts.length === 3 && parts[1] === "lists" && parts[2] === "reorder" && method === "POST") {
    return await reorderLists(db, await request.json());
  }

  // /api/lists/:listId （単語帳の名称変更・削除）
  if (parts.length === 3 && parts[1] === "lists") {
    if (method === "PUT") return await updateList(db, parts[2], await request.json());
    if (method === "DELETE") return await deleteList(db, parts[2]);
  }

  // /api/lists/:listId/words
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "words" && method === "GET") {
    return await listWordsInList(db, parts[2]);
  }

  // /api/lists/:listId/words/full （閲覧ページ用: 意味・例文・タグまで含めた一括取得）
  if (parts.length === 5 && parts[1] === "lists" && parts[3] === "words" && parts[4] === "full" && method === "GET") {
    return await listWordsInListFull(db, parts[2]);
  }

  // /api/lists/:listId/chapters
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "chapters") {
    if (method === "GET") return await listChapters(db, parts[2]);
    if (method === "POST") return await createChapter(db, parts[2], await request.json());
  }

  // /api/lists/:listId/chapters/:chapterId
  if (parts.length === 5 && parts[1] === "lists" && parts[3] === "chapters" && parts[4] !== "reorder") {
    if (method === "DELETE") return await deleteChapter(db, parts[2], parts[4]);
    if (method === "PUT") return await updateChapter(db, parts[2], parts[4], await request.json());
  }

  // /api/lists/:listId/chapters/reorder
  if (parts.length === 5 && parts[1] === "lists" && parts[3] === "chapters" && parts[4] === "reorder" && method === "POST") {
    return await reorderChapters(db, parts[2], await request.json());
  }

  // /api/lists/:listId/sections
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "sections") {
    if (method === "GET") return await listSections(db, parts[2]);
    if (method === "POST") return await createSection(db, parts[2], await request.json());
  }

  // /api/lists/:listId/sections/:sectionId
  if (parts.length === 5 && parts[1] === "lists" && parts[3] === "sections" && parts[4] !== "reorder") {
    if (method === "DELETE") return await deleteSection(db, parts[2], parts[4]);
    if (method === "PUT") return await updateSection(db, parts[2], parts[4], await request.json());
  }

  // /api/lists/:listId/sections/reorder
  if (parts.length === 5 && parts[1] === "lists" && parts[3] === "sections" && parts[4] === "reorder" && method === "POST") {
    return await reorderSections(db, parts[2], await request.json());
  }

  // /api/lists/:listId/reorder （単語帳内の並び順・セクション所属をまとめて更新）
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "reorder" && method === "POST") {
    return await reorderListItems(db, parts[2], await request.json());
  }

  // /api/lists/:listId/copy-range
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "copy-range" && method === "POST") {
    return await copyRange(db, parts[2], await request.json());
  }

  // /api/lists/:listId/import-by-tag
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "import-by-tag" && method === "POST") {
    return await importByTag(db, parts[2], await request.json());
  }

  // /api/lists/:listId/add-words
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "add-words" && method === "POST") {
    return await addWordsToList(db, parts[2], await request.json());
  }

  // /api/lists/:listId/items/:wordId
  if (parts.length === 5 && parts[1] === "lists" && parts[3] === "items") {
    const [, , listId, , wordId] = parts;
    if (method === "PUT") return await upsertListItem(db, listId, wordId, await request.json());
    if (method === "DELETE") return await removeListItem(db, listId, wordId);
  }

  // /api/tags
  if (parts.length === 2 && parts[1] === "tags" && method === "GET") {
    return await listDistinctTags(db);
  }

  // /api/seed-preset-lists
  if (parts.length === 2 && parts[1] === "seed-preset-lists" && method === "POST") {
    return json(await seedPresetLists(db));
  }

  // /api/normalize-pos
  if (parts.length === 2 && parts[1] === "normalize-pos" && method === "POST") {
    return json(await normalizePosTags(db));
  }

  // /api/apply-curated-senses
  if (parts.length === 2 && parts[1] === "apply-curated-senses" && method === "POST") {
    return await applyCuratedSenses(db, await request.json());
  }

  // /api/examples-report (一時的な診断用エンドポイント)
  if (parts.length === 2 && parts[1] === "examples-report" && method === "GET") {
    return await examplesReport(db);
  }

  // /api/fix-examples-formatting (一時的な一括修正用エンドポイント)
  if (parts.length === 2 && parts[1] === "fix-examples-formatting" && method === "POST") {
    return await fixExamplesFormatting(db, await request.json());
  }

  // /api/fix-examples-translation (例文の和訳を一括反映するエンドポイント)
  if (parts.length === 2 && parts[1] === "fix-examples-translation" && method === "POST") {
    return await fixExamplesTranslation(db, await request.json());
  }

  // /api/words
  if (parts.length === 2 && parts[1] === "words" && method === "POST") {
    return await createWord(db, await request.json());
  }

  // /api/words/:id
  if (parts.length === 3 && parts[1] === "words") {
    const id = parts[2];
    if (method === "GET") return await getWord(db, id);
    if (method === "PUT") return await updateWord(db, id, await request.json());
    if (method === "DELETE") return await deleteWord(db, id);
  }

  // /api/render
  if (parts.length === 2 && parts[1] === "render" && method === "POST") {
    return await renderText(db, await request.json());
  }

  // /api/lookup?spelling=...
  if (parts.length === 2 && parts[1] === "lookup" && method === "GET") {
    return await handleLookup(request);
  }

  // /api/enrich-words — 登録済み単語の空欄を辞書APIで一括補完（バッチ）
  if (parts.length === 2 && parts[1] === "enrich-words" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    return json(await enrichWordsBatch(db, body));
  }

  return notFound("no such route");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (!pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    const allowedOrigin = resolveAllowedOrigin(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
    }

    const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent); // ["api", ...]

    try {
      const response = await handleApi(request, env, parts, request.method);
      return withCors(response, allowedOrigin);
    } catch (err) {
      return withCors(
        json({ error: String(err && err.message ? err.message : err) }, { status: 500 }),
        allowedOrigin
      );
    }
  },
};
