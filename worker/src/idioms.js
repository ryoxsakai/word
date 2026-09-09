// Idioms are independent of word fields. Reference numbers/tags are resolved by
// the viewer against its current notebook index, never stored in this table.
export async function readIdioms(db, listId) {
  const { results: sections } = await db.prepare(`SELECT section_key AS key, subtitle,
    chapter_key AS chapterKey, chapter_subtitle AS chapterSubtitle,
    chapter_order AS chapterOrder, sort_order AS sortOrder
    FROM idiom_sections WHERE list_id = ? ORDER BY chapter_order, sort_order`).bind(listId).all();
  const { results: rows } = await db.prepare(`SELECT i.id, i.phrase, i.section_key AS sectionKey,
    s.id AS senseId, s.meaning, r.word_id AS wordId, r.source
    FROM idioms i JOIN idiom_senses s ON s.idiom_id = i.id
    LEFT JOIN idiom_word_refs r ON r.sense_id = s.id
    WHERE i.list_id = ? ORDER BY i.sort_order, i.id, s.sort_order, s.id, r.word_id`).bind(listId).all();
  const entries = new Map();
  for (const row of rows) {
    if (!entries.has(row.id)) entries.set(row.id, { key: row.id, phrase: row.phrase, sectionKey: row.sectionKey, meanings: [] });
    const entry = entries.get(row.id);
    let sense = entry.meanings.find(s => s.id === row.senseId);
    if (!sense) { sense = { id: row.senseId, meaning: row.meaning, refs: [] }; entry.meanings.push(sense); }
    if (row.wordId) sense.refs.push({ wordId: row.wordId, source: row.source });
  }
  const chapters = [];
  for (const section of sections) {
    let chapter = chapters.find(c => c.key === section.chapterKey);
    if (!chapter) {
      chapter = { key: section.chapterKey, subtitle: section.chapterSubtitle, sections: [] };
      chapters.push(chapter);
    }
    chapter.sections.push({ key: section.key, subtitle: section.subtitle });
  }
  return { managed: sections.length > 0, chapters, entries: [...entries.values()] };
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
  const existing = await db.prepare("SELECT list_id FROM idioms WHERE id = ?").bind(id).first();
  if (existing && existing.list_id !== listId) throw new Error("Idiom belongs to another notebook");
  const statements = [db.prepare(`INSERT INTO idioms (id, list_id, phrase, section_key, sort_order)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET phrase = excluded.phrase,
    section_key = excluded.section_key, sort_order = excluded.sort_order, updated_at = datetime('now')`)
    .bind(id, listId, body.phrase.trim(), body.sectionKey, Number.isInteger(body.sortOrder) ? body.sortOrder : 10000),
    db.prepare("DELETE FROM idiom_senses WHERE idiom_id = ?").bind(id)];
  for (const [index, sense] of body.meanings.entries()) {
    if (typeof sense.meaning !== "string" || !sense.meaning.trim() || sense.meaning.length > 2000 ||
        !Array.isArray(sense.wordIds) || sense.wordIds.length > 30) throw new Error("Invalid meaning or wordIds");
    const senseId = `${id}:${index}`;
    statements.push(db.prepare("INSERT INTO idiom_senses (id, idiom_id, meaning, sort_order) VALUES (?, ?, ?, ?)")
      .bind(senseId, id, sense.meaning.trim(), index));
    for (const wordId of new Set(sense.wordIds)) {
      if (typeof wordId !== "string") throw new Error("Invalid word ID");
      const word = await db.prepare("SELECT word_id FROM list_items WHERE list_id = ? AND word_id = ?").bind(listId, wordId).first();
      if (!word) throw new Error("Reference word is not in this notebook");
      statements.push(db.prepare("INSERT INTO idiom_word_refs (sense_id, word_id, source) VALUES (?, ?, 'idiom')").bind(senseId, wordId));
    }
  }
  await db.batch(statements);
  return { id };
}
