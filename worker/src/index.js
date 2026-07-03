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
      `SELECT w.id AS id, w.spelling AS spelling, li.no AS no
       FROM list_items li JOIN words w ON w.id = li.word_id
       WHERE li.list_id = ?`
    )
    .bind(listId)
    .all();
  for (const r of results) map.set(r.spelling.toLowerCase(), { id: r.id, no: r.no });
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
      `SELECT w.id AS id, w.spelling AS spelling, w.pronunciation AS pronunciation, li.no AS no
       FROM list_items li JOIN words w ON w.id = li.word_id
       WHERE li.list_id = ?
       ORDER BY li.no`
    )
    .bind(listId)
    .all();
  return json(results);
}

// ---- words ----

async function loadWordDetail(db, id) {
  const word = await db
    .prepare("SELECT id, spelling, pronunciation, etymology, notes, created_at, updated_at FROM words WHERE id = ?")
    .bind(id)
    .first();
  if (!word) return null;

  const [senses, derivatives, examples, tags, memberships] = await Promise.all([
    db.prepare("SELECT id, pos, meaning, sort_order FROM senses WHERE word_id = ? ORDER BY sort_order, id").bind(id).all(),
    db.prepare("SELECT id, pos, word, sort_order FROM derivatives WHERE word_id = ? ORDER BY sort_order, id").bind(id).all(),
    db.prepare("SELECT id, sentence, answer, translation, sort_order FROM examples WHERE word_id = ? ORDER BY sort_order, id").bind(id).all(),
    db.prepare("SELECT tag_key, tag_value FROM tags WHERE word_id = ?").bind(id).all(),
    db
      .prepare(
        `SELECT li.list_id AS listId, l.name AS listName, li.no AS no
         FROM list_items li JOIN lists l ON l.id = li.list_id
         WHERE li.word_id = ? ORDER BY l.sort_order, l.name`
      )
      .bind(id)
      .all(),
  ]);

  const tagMap = {};
  for (const t of tags.results) tagMap[t.tag_key] = t.tag_value;

  return {
    ...word,
    senses: senses.results,
    derivatives: derivatives.results,
    examples: examples.results,
    tags: tagMap,
    lists: memberships.results,
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

async function createWord(db, body) {
  if (!body.spelling) return badRequest("spelling is required");
  const id = await uniqueWordId(db, body.spelling);
  await db
    .prepare(
      "INSERT INTO words (id, spelling, pronunciation, etymology, notes) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, body.spelling, body.pronunciation || null, body.etymology || null, body.notes || null)
    .run();
  await saveWordChildren(db, id, body);

  if (body.listId && body.no != null) {
    await db
      .prepare("INSERT INTO list_items (list_id, word_id, no) VALUES (?, ?, ?)")
      .bind(body.listId, id, body.no)
      .run();
  }
  return json(await loadWordDetail(db, id), { status: 201 });
}

async function updateWord(db, id, body) {
  const existing = await db.prepare("SELECT id FROM words WHERE id = ?").bind(id).first();
  if (!existing) return notFound("word not found");
  await db
    .prepare(
      "UPDATE words SET spelling = ?, pronunciation = ?, etymology = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(body.spelling, body.pronunciation || null, body.etymology || null, body.notes || null, id)
    .run();
  await saveWordChildren(db, id, body);
  return json(await loadWordDetail(db, id));
}

async function deleteWord(db, id) {
  const existing = await db.prepare("SELECT id FROM words WHERE id = ?").bind(id).first();
  if (!existing) return notFound("word not found");
  await db.batch([
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
  if (body.no == null) return badRequest("no is required");

  await db
    .prepare(
      `INSERT INTO list_items (list_id, word_id, no) VALUES (?, ?, ?)
       ON CONFLICT(list_id, word_id) DO UPDATE SET no = excluded.no`
    )
    .bind(listId, wordId, body.no)
    .run();
  return json({ ok: true });
}

async function removeListItem(db, listId, wordId) {
  await db.prepare("DELETE FROM list_items WHERE list_id = ? AND word_id = ?").bind(listId, wordId).run();
  return json({ ok: true });
}

// ---- markup render (##記法 のサーバー側解決。設定ページのプレビュー確認用) ----

async function renderText(db, body) {
  const index = await loadListWordIndex(db, body.listId);
  const html = renderMarkup(body.text || "", { resolve: makeResolver(index) });
  return json({ html });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (!pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    const db = env.DB;
    const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent); // ["api", ...]
    const method = request.method;

    try {
      // /api/lists
      if (parts.length === 2 && parts[1] === "lists") {
        if (method === "GET") return await listLists(db);
        if (method === "POST") return await createList(db, await request.json());
      }

      // /api/lists/:listId/words
      if (parts.length === 4 && parts[1] === "lists" && parts[3] === "words" && method === "GET") {
        return await listWordsInList(db, parts[2]);
      }

      // /api/lists/:listId/items/:wordId
      if (parts.length === 5 && parts[1] === "lists" && parts[3] === "items") {
        const [, , listId, , wordId] = parts;
        if (method === "PUT") return await upsertListItem(db, listId, wordId, await request.json());
        if (method === "DELETE") return await removeListItem(db, listId, wordId);
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
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, { status: 500 });
    }
  },
};
