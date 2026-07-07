import { renderMarkup } from "../../public/shared/markup.js";

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
    .prepare("SELECT id, name, description, sort_order FROM lists ORDER BY sort_order, name")
    .all();
  return json(results);
}

async function createList(db, body) {
  if (!body.name) return badRequest("name is required");
  const id = body.id || slugifyUnicode(body.name);
  const exists = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(id).first();
  if (exists) return badRequest(`list id "${id}" already exists`);
  await db
    .prepare("INSERT INTO lists (id, name, description, sort_order) VALUES (?, ?, ?, ?)")
    .bind(id, body.name, body.description || null, body.sortOrder || 0)
    .run();
  return json({ id }, { status: 201 });
}

async function listWordsInList(db, listId) {
  const list = await db.prepare("SELECT id FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const { results } = await db
    .prepare(
      `SELECT w.id AS id, w.spelling AS spelling, w.pronunciation AS pronunciation,
              li.no AS no, li.branch AS branch, li.section_id AS sectionId, s.name AS sectionName,
              w.derived_from_id AS derivedFromId
       FROM list_items li JOIN words w ON w.id = li.word_id
       LEFT JOIN sections s ON s.id = li.section_id
       WHERE li.list_id = ?
       ORDER BY li.no, li.branch`
    )
    .bind(listId)
    .all();
  const rows = results.map((r) => ({ ...r, displayNo: formatNo(r.no, r.branch) }));
  return json(rows);
}

// ---- sections ----

async function listSections(db, listId) {
  const list = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  const { results } = await db
    .prepare("SELECT id, name, sort_order AS sortOrder FROM sections WHERE list_id = ? ORDER BY sort_order, id")
    .bind(listId)
    .all();
  return json(results);
}

async function createSection(db, listId, body) {
  const list = await db.prepare("SELECT 1 FROM lists WHERE id = ?").bind(listId).first();
  if (!list) return notFound("list not found");
  if (!body.name) return badRequest("name is required");
  const row = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM sections WHERE list_id = ?").bind(listId).first();
  const sortOrder = (row?.m || 0) + 1;
  const result = await db
    .prepare("INSERT INTO sections (list_id, name, sort_order) VALUES (?, ?, ?)")
    .bind(listId, body.name, sortOrder)
    .run();
  return json({ id: result.meta.last_row_id, name: body.name, sortOrder }, { status: 201 });
}

async function deleteSection(db, listId, sectionId) {
  await db.prepare("UPDATE list_items SET section_id = NULL WHERE list_id = ? AND section_id = ?").bind(listId, sectionId).run();
  await db.prepare("DELETE FROM sections WHERE id = ? AND list_id = ?").bind(sectionId, listId).run();
  return json({ ok: true });
}

// ---- words ----

async function loadWordDetail(db, id) {
  const word = await db
    .prepare("SELECT id, spelling, pronunciation, etymology, notes, derived_from_id AS derivedFromId, created_at, updated_at FROM words WHERE id = ?")
    .bind(id)
    .first();
  if (!word) return null;

  const [senses, derivatives, examples, tags, memberships, children, parent] = await Promise.all([
    db.prepare("SELECT id, pos, meaning, sort_order FROM senses WHERE word_id = ? ORDER BY sort_order, id").bind(id).all(),
    db.prepare("SELECT id, pos, word, sort_order FROM derivatives WHERE word_id = ? ORDER BY sort_order, id").bind(id).all(),
    db.prepare("SELECT id, sentence, answer, translation, sort_order FROM examples WHERE word_id = ? ORDER BY sort_order, id").bind(id).all(),
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
    senses: senses.results,
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

async function replaceChildRows(db, table, columns, wordId, rows) {
  await db.prepare(`DELETE FROM ${table} WHERE word_id = ?`).bind(wordId).run();
  let i = 0;
  for (const row of rows || []) {
    const values = columns.map((c) => (c === "sort_order" ? i : row[c] ?? null));
    const placeholders = columns.map(() => "?").join(", ");
    await db
      .prepare(`INSERT INTO ${table} (word_id, ${columns.join(", ")}) VALUES (?, ${placeholders})`)
      .bind(wordId, ...values)
      .run();
    i += 1;
  }
}

async function replaceTags(db, wordId, tags) {
  await db.prepare("DELETE FROM tags WHERE word_id = ?").bind(wordId).run();
  for (const [key, value] of Object.entries(tags || {})) {
    if (value === false || value === null || value === undefined) continue;
    await db
      .prepare("INSERT INTO tags (word_id, tag_key, tag_value) VALUES (?, ?, ?)")
      .bind(wordId, key, value === true ? null : String(value))
      .run();
  }
}

async function saveWordChildren(db, id, body) {
  await replaceChildRows(db, "senses", ["pos", "meaning", "sort_order"], id, body.senses);
  await replaceChildRows(db, "derivatives", ["pos", "word", "sort_order"], id, body.derivatives);
  await replaceChildRows(db, "examples", ["sentence", "answer", "translation", "sort_order"], id, body.examples);
  await replaceTags(db, id, body.tags);
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
      "INSERT INTO words (id, spelling, pronunciation, etymology, notes, derived_from_id) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(id, body.spelling, body.pronunciation || null, body.etymology || null, body.notes || null, derivedFromId)
    .run();
  await saveWordChildren(db, id, body);

  if (body.listId) {
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

  if (derivedFromResolved.id !== undefined) {
    if (derivedFromResolved.id === id) return badRequest("a word cannot be derived from itself");
    await db
      .prepare(
        "UPDATE words SET spelling = ?, pronunciation = ?, etymology = ?, notes = ?, derived_from_id = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(body.spelling, body.pronunciation || null, body.etymology || null, body.notes || null, derivedFromResolved.id, id)
      .run();
  } else {
    await db
      .prepare(
        "UPDATE words SET spelling = ?, pronunciation = ?, etymology = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(body.spelling, body.pronunciation || null, body.etymology || null, body.notes || null, id)
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

// ---- markup render (##記法 のサーバー側解決。設定ページのプレビュー確認用) ----

async function renderText(db, body) {
  const index = await loadListWordIndex(db, body.listId);
  const html = renderMarkup(body.text || "", { resolve: makeResolver(index) });
  return json({ html });
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

  // /api/lists
  if (parts.length === 2 && parts[1] === "lists") {
    if (method === "GET") return await listLists(db);
    if (method === "POST") return await createList(db, await request.json());
  }

  // /api/lists/:listId/words
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "words" && method === "GET") {
    return await listWordsInList(db, parts[2]);
  }

  // /api/lists/:listId/sections
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "sections") {
    if (method === "GET") return await listSections(db, parts[2]);
    if (method === "POST") return await createSection(db, parts[2], await request.json());
  }

  // /api/lists/:listId/sections/:sectionId
  if (parts.length === 5 && parts[1] === "lists" && parts[3] === "sections" && method === "DELETE") {
    return await deleteSection(db, parts[2], parts[4]);
  }

  // /api/lists/:listId/copy-range
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "copy-range" && method === "POST") {
    return await copyRange(db, parts[2], await request.json());
  }

  // /api/lists/:listId/import-by-tag
  if (parts.length === 4 && parts[1] === "lists" && parts[3] === "import-by-tag" && method === "POST") {
    return await importByTag(db, parts[2], await request.json());
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
