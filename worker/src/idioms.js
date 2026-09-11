import { idiomIllustrationUrl } from './idiom-illustrations.js';
// Idioms are independent of word fields. Reference numbers/tags are resolved by
// the viewer against its current notebook index, never stored in this table.
async function readIdiomSections(db, listId) {
  const { results: sections } = await db.prepare(`SELECT *, section_key AS key, subtitle,
    chapter_key AS chapterKey, chapter_subtitle AS chapterSubtitle,
    chapter_order AS chapterOrder, sort_order AS sortOrder
    FROM idiom_sections WHERE list_id = ? ORDER BY chapter_order, sort_order`).bind(listId).all();
  const chapters = [];
  for (const section of sections) {
    let chapter = chapters.find(c => c.key === section.chapterKey);
    if (!chapter) {
      chapter = { key: section.chapterKey, subtitle: section.chapterSubtitle, sections: [] };
      chapters.push(chapter);
    }
    chapter.sections.push({ key: section.key, subtitle: section.subtitle,
      ...(section.display_number != null ? { number: section.display_number } : {}),
      ...(section.group_key ? { groupKey: section.group_key, groupSubtitle: section.group_subtitle, groupOrder: section.group_order } : {}),
    });
  }
  return { sections, chapters };
}

async function readIdiomEntries(db, listId, sectionKey = null, illustrations = false) {
  const sectionFilter = sectionKey == null ? "" : " AND i.section_key = ?";
  const statement = db.prepare(`SELECT i.*, i.section_key AS sectionKey,
    s.id AS senseId, s.meaning, r.word_id AS wordId, r.source${illustrations ? ", j.id AS illustrationId, j.meaning AS illustrationMeaning" : ""}
    FROM idioms i JOIN idiom_senses s ON s.idiom_id = i.id
    LEFT JOIN idiom_word_refs r ON r.sense_id = s.id
    ${illustrations ? "LEFT JOIN idiom_illustrations a ON a.idiom_id=i.id LEFT JOIN idiom_illustration_jobs j ON j.id=a.job_id AND j.status='ready'" : ""}
    WHERE i.list_id = ?${sectionFilter} ORDER BY i.sort_order, i.id, s.sort_order, s.id, r.word_id`);
  const { results: rows } = sectionKey == null
    ? await statement.bind(listId).all()
    : await statement.bind(listId, sectionKey).all();
  const entries = new Map();
  for (const row of rows) {
    if (!entries.has(row.id)) {
      const entry = { key: row.id, phrase: row.phrase, sectionKey: row.sectionKey, meanings: [] };
      for (const field of ["synonyms", "antonyms", "notes"]) if (row[field]) entry[field] = row[field];
      if (row.hidden) entry.hidden = true;
      if (row.aliases && row.aliases !== "[]") entry.aliases = JSON.parse(row.aliases);
      if (row.illustrationId) entry.illustration={url:idiomIllustrationUrl(row.id,row.illustrationId),jobId:row.illustrationId,meaning:row.illustrationMeaning};
      entries.set(row.id, entry);
    }
    const entry = entries.get(row.id);
    let sense = entry.meanings.find(s => s.id === row.senseId);
    if (!sense) { sense = { id: row.senseId, meaning: row.meaning, refs: [] }; entry.meanings.push(sense); }
    if (row.wordId) sense.refs.push({ wordId: row.wordId, source: row.source });
  }
  return [...entries.values()];
}

async function runIdiomBatches(db, statements, size = 400) {
  for (let index = 0; index < statements.length; index += size) {
    await db.batch(statements.slice(index, index + size));
  }
}

export async function readIdioms(db, listId, { illustrations = false } = {}) {
  const { sections, chapters } = await readIdiomSections(db, listId);
  return { managed: sections.length > 0, chapters, entries: await readIdiomEntries(db, listId, null, illustrations) };
}

// Lightweight hierarchy and entry metadata. Meanings and references are fetched
// only when a section is opened or approaches the viewport.
export async function readIdiomIndex(db, listId) {
  const { sections, chapters } = await readIdiomSections(db, listId);
  const { results } = await db.prepare(`SELECT id AS key, phrase, section_key AS sectionKey,
    sort_order AS sortOrder, hidden, aliases
    FROM idioms WHERE list_id = ? ORDER BY sort_order, id`).bind(listId).all();
  const entries = results.map(row => ({
    key: row.key,
    phrase: row.phrase,
    sectionKey: row.sectionKey,
    sortOrder: row.sortOrder,
    meanings: [],
    ...(row.hidden ? { hidden: true } : {}),
    ...(row.aliases && row.aliases !== "[]" ? { aliases: JSON.parse(row.aliases) } : {}),
  }));
  return { managed: sections.length > 0, chapters, entries };
}

export async function readIdiomSection(db, listId, sectionKey, { illustrations = false } = {}) {
  const section = await db.prepare("SELECT 1 FROM idiom_sections WHERE list_id = ? AND section_key = ?")
    .bind(listId, sectionKey).first();
  if (!section) return null;
  return { sectionKey, entries: await readIdiomEntries(db, listId, sectionKey, illustrations) };
}

export async function reorderIdioms(db, listId, body) {
  const items = body?.entries;
  if (!Array.isArray(items)) throw new Error("entries is required");
  const [{ results: current }, { results: sections }] = await Promise.all([
    db.prepare("SELECT id FROM idioms WHERE list_id = ?").bind(listId).all(),
    db.prepare("SELECT section_key AS sectionKey FROM idiom_sections WHERE list_id = ?").bind(listId).all(),
  ]);
  const currentIds = new Set(current.map(row => row.id));
  const sectionKeys = new Set(sections.map(row => row.sectionKey));
  if (items.length !== currentIds.size || new Set(items.map(item => item?.id)).size !== currentIds.size) {
    throw new Error("entries must contain every idiom exactly once");
  }
  for (const item of items) {
    if (!currentIds.has(item?.id)) throw new Error("Unknown idiom");
    if (!sectionKeys.has(item?.sectionKey)) throw new Error("Unknown idiom section");
  }
  await runIdiomBatches(db, items.map((item, index) => db.prepare(
    "UPDATE idioms SET sort_order = ?, section_key = ?, updated_at = datetime('now') WHERE id = ? AND list_id = ?"
  ).bind(index + 1, item.sectionKey, item.id, listId)));
  return { updated: items.length };
}

export async function reorderIdiomSections(db, listId, body) {
  const sectionKeys = body?.sectionKeys;
  if (!Array.isArray(sectionKeys)) throw new Error("sectionKeys is required");
  const { results } = await db.prepare("SELECT section_key AS sectionKey FROM idiom_sections WHERE list_id = ?")
    .bind(listId).all();
  const current = new Set(results.map(row => row.sectionKey));
  if (sectionKeys.length !== current.size || new Set(sectionKeys).size !== current.size || sectionKeys.some(key => !current.has(key))) {
    throw new Error("sectionKeys must contain every section exactly once");
  }
  await runIdiomBatches(db, sectionKeys.map((key, index) => db.prepare(
    "UPDATE idiom_sections SET sort_order = ? WHERE list_id = ? AND section_key = ?"
  ).bind(index + 1, listId, key)));
  return { updated: sectionKeys.length };
}

// Called only through the existing authenticated editor API for writes.
export async function saveIdiom(db, listId, body) {
  if (typeof body.phrase !== "string" || !body.phrase.trim() || body.phrase.length > 500 ||
      !Array.isArray(body.meanings) || !body.meanings.length || body.meanings.length > 30) {
    throw new Error("phrase and 1–30 meanings are required");
  }
  const section = await db.prepare("SELECT section_key FROM idiom_sections WHERE list_id = ? AND section_key = ?")
    .bind(listId, body.sectionKey || "").first();
  if (!section) throw new Error("Unknown idiom section");
  const id = body.id || crypto.randomUUID();
  if (typeof id !== "string" || id.length > 200) throw new Error("Invalid idiom ID");
  const existing = await db.prepare("SELECT * FROM idioms WHERE id = ?").bind(id).first();
  if (existing && existing.list_id !== listId) throw new Error("Idiom belongs to another notebook");
  const statements = [db.prepare(`INSERT INTO idioms (id, list_id, phrase, section_key, sort_order)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET phrase = excluded.phrase,
    section_key = excluded.section_key, sort_order = excluded.sort_order, updated_at = datetime('now')`)
    .bind(id, listId, body.phrase.trim(), body.sectionKey, Number.isInteger(body.sortOrder) ? body.sortOrder : (existing?.sort_order ?? 10000)),
    db.prepare("DELETE FROM idiom_senses WHERE idiom_id = ?").bind(id)];
  for (const field of ["synonyms", "antonyms", "notes"]) {
    if (body[field] === undefined) continue; // Older clients retain newly added fields.
    if (typeof body[field] !== "string" || body[field].length > 20000) throw new Error(`Invalid ${field}`);
    statements.push(db.prepare(`UPDATE idioms SET ${field} = ? WHERE id = ?`).bind(body[field], id));
  }
  if (body.hidden !== undefined) {
    if (typeof body.hidden !== "boolean") throw new Error("Invalid hidden");
    statements.push(db.prepare("UPDATE idioms SET hidden = ? WHERE id = ?").bind(body.hidden ? 1 : 0, id));
  }
  // Existing sense IDs carry semantic references. Keep their identities when editing.
  const oldSenses = existing ? (await db.prepare("SELECT id FROM idiom_senses WHERE idiom_id = ?").bind(id).all()).results : [];
  const oldIds = new Set(oldSenses.map(s => s.id));
  const usedIds = new Set();
  for (const [index, sense] of body.meanings.entries()) {
    if (typeof sense.meaning !== "string" || !sense.meaning.trim() || sense.meaning.length > 2000 ||
        !Array.isArray(sense.wordIds) || sense.wordIds.length > 30) throw new Error("Invalid meaning or wordIds");
    const senseId = sense.id || `idiom-sense-${crypto.randomUUID()}`;
    if (typeof senseId !== "string" || senseId.length > 200 || usedIds.has(senseId)) throw new Error("Invalid sense ID");
    if (sense.id && !oldIds.has(sense.id)) throw new Error("Sense does not belong to this idiom");
    const owner = await db.prepare("SELECT idiom_id FROM idiom_senses WHERE id = ?").bind(senseId).first();
    if (owner && owner.idiom_id !== id) throw new Error("Sense does not belong to this idiom");
    usedIds.add(senseId);
    statements.push(db.prepare("INSERT INTO idiom_senses (id, idiom_id, meaning, sort_order) VALUES (?, ?, ?, ?)")
      .bind(senseId, id, sense.meaning.trim(), index));
    for (const wordId of new Set(sense.wordIds)) {
      if (typeof wordId !== "string") throw new Error("Invalid word ID");
      const word = await db.prepare("SELECT word_id FROM list_items WHERE list_id = ? AND word_id = ?").bind(listId, wordId).first();
      if (!word) throw new Error("Reference word is not in this notebook");
      const oldRef = existing ? await db.prepare("SELECT source FROM idiom_word_refs WHERE sense_id = ? AND word_id = ?").bind(senseId, wordId).first() : null;
      statements.push(db.prepare("INSERT INTO idiom_word_refs (sense_id, word_id, source) VALUES (?, ?, ?)").bind(senseId, wordId, oldRef?.source || "idiom"));
    }
  }
  await db.batch(statements);
  return { id };
}
