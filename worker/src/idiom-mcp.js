import { readIdioms } from './idioms.js';
import { groupIdiomEntries } from '../../public/shared/idioms.js';
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from './mcp-oauth.js';

const str = { type: 'string', minLength: 1, maxLength: 200 };
const text = { type: 'string', maxLength: 20000 };
const ids = { type: 'array', items: str, minItems: 1, maxItems: 2000, uniqueItems: true };
const meaning = { type: 'object', additionalProperties: false, properties: {
  id: str, meaning: { type: 'string', minLength: 1, maxLength: 2000 },
  word_ids: { type: 'array', items: str, maxItems: 30, uniqueItems: true },
}, required: ['meaning'] };
const fields = { phrase: { type: 'string', minLength: 1, maxLength: 500 }, section_key: str,
  synonyms: text, antonyms: text, notes: text, hidden: { type: 'boolean' },
  aliases: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 500 }, maxItems: 100, uniqueItems: true },
  meanings: { type: 'array', items: meaning, minItems: 1, maxItems: 30 } };
function tool(name, description, properties = {}, required = [], write = false) {
  return { name, description, inputSchema: { type: 'object', additionalProperties: false,
    properties: { list_id: str, ...(write ? { expected_revision: { type: 'integer', minimum: 0, description: '直前の熟語取得で返されたrevision。競合時は読み直す。' } } : {}), ...properties },
    required: ['list_id', ...(write ? ['expected_revision'] : []), ...required] },
    annotations: { readOnlyHint: !write, destructiveHint: write, openWorldHint: false },
    ...(write ? { securitySchemes: [{ type: 'oauth2', scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] }] } : {}) };
}
const filters = { chapter_key: str, group_key: str, section_key: str, query: { type: 'string', maxLength: 500 },
  include_hidden: { type: 'boolean', default: false }, limit: { type: 'integer', minimum: 1, maximum: 100 }, offset: { type: 'integer', minimum: 0 } };
export const IDIOM_READ_TOOLS = [
  tool('get_idiom_structure', '熟語・定型構文専用のChapter・Group・SectionをDBキー、表示番号、件数、revision付きで取得。単語用の数値IDとは別。'),
  tool('list_idioms', '熟語・定型構文を表示順に取得。Group/Sectionや英語・和訳で絞り込み。nextOffsetで続き取得。非表示項目はinclude_hiddenで取得。', filters),
  tool('search_idioms', '熟語・定型構文の表現・別表記・語義・類義語・対義語・メモを検索。', filters, ['query']),
  tool('get_idiom', '熟語の全語義、語義ごとの単語参照、メモ、別表記、掲載先、revisionを取得。IDまたは完全一致表現を指定。', { idiom_id: str, phrase: fields.phrase }),
];
const sectionSchema = { type: 'object', additionalProperties: false, properties: {
  section_key: str, subtitle: fields.phrase, chapter_key: str, chapter_subtitle: fields.phrase,
  chapter_order: { type: 'integer', minimum: 0 }, sort_order: { type: 'integer', minimum: 0 },
  group_key: { anyOf: [str, { type: 'null' }] }, group_subtitle: { anyOf: [fields.phrase, { type: 'null' }] },
  group_order: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] },
  display_number: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
}, required: ['section_key', 'subtitle', 'chapter_key', 'chapter_subtitle', 'chapter_order', 'sort_order'] };
export const IDIOM_WRITE_TOOLS = [
  tool('create_idioms', '最大30件の熟語を一括追加。同一表現・別表記は重複として拒否。全件検証後に一括保存。', { idioms: { type: 'array', minItems: 1, maxItems: 30, items: { type: 'object', properties: fields, required: ['phrase', 'section_key', 'meanings'], additionalProperties: false } } }, ['idioms'], true),
  tool('update_idiom', '指定フィールドだけ部分更新。meanings指定時は全語義配列を置換するため既存IDを保持。word_ids省略時は既存参照を保持。hiddenで掲載を外せる。', { idiom_id: str, ...fields }, ['idiom_id'], true),
  tool('move_idioms', '確認済みの熟語DB IDを別の熟語Section末尾へ移動。語義・参照先は保持。', { idiom_ids: ids, section_key: str }, ['idiom_ids', 'section_key'], true),
  tool('reorder_idioms', '指定Sectionの全熟語ID（非表示も含む）を漏れなく指定して並べ替え。', { idiom_ids: ids, section_key: str }, ['idiom_ids', 'section_key'], true),
  tool('update_idiom_structure', '熟語Chapter・Group・Sectionの追加・名称変更・所属変更・並べ替え。既存全Sectionを含む完成形を指定。空Sectionだけ省略で削除可能。DBキーを保持し、表示番号をキーに使わない。', { sections: { type: 'array', minItems: 1, maxItems: 500, items: sectionSchema } }, ['sections'], true),
  tool('merge_idioms', '確認済みの重複熟語をtarget_idに統合。異なる語義・参照・メモ・別表記を保持し、元IDをaliasesに保存。統合前の全データを監査履歴へ保存。', { target_id: str, source_ids: { ...ids, maxItems: 30 } }, ['target_id', 'source_ids'], true),
];

// Enforce the advertised schema server-side as MCP clients need not validate it.
function validate(value, schema, path = 'arguments') {
  if (schema.anyOf) { if (!schema.anyOf.some(s => { try { validate(value, s, path); return true; } catch { return false; } })) throw new Error(`Invalid ${path}`); return; }
  if (schema.type === 'null') { if (value !== null) throw new Error(`Invalid ${path}`); return; }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${path}`);
    for (const key of schema.required || []) if (value[key] === undefined) throw new Error(`${path}.${key} is required`);
    for (const [key, item] of Object.entries(value)) { if (!schema.properties[key]) throw new Error(`Unknown ${path}.${key}`); validate(item, schema.properties[key], `${path}.${key}`); }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems || 0) || value.length > (schema.maxItems ?? Infinity) || (schema.uniqueItems && new Set(value).size !== value.length)) throw new Error(`Invalid ${path}`);
    value.forEach((v, i) => validate(v, schema.items, `${path}[${i}]`));
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) throw new Error(`Invalid ${path}`);
  } else if (typeof value !== schema.type || (schema.type === 'string' && (value.trim().length < (schema.minLength || 0) || value.length > (schema.maxLength ?? Infinity)))) throw new Error(`Invalid ${path}`);
}
const rows = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
const revision = async db => (await db.prepare('SELECT revision FROM idiom_mcp_revision WHERE id = 1').first()).revision;
async function snapshot(db, listId) {
  if (!await db.prepare('SELECT id FROM lists WHERE id = ?').bind(listId).first()) throw new Error('Notebook not found');
  const rev = await revision(db);
  const sections = await rows(db, 'SELECT * FROM idiom_sections WHERE list_id = ? ORDER BY chapter_order, sort_order, section_key', listId);
  const entries = await rows(db, 'SELECT * FROM idioms WHERE list_id = ? ORDER BY sort_order, id', listId);
  const senses = await rows(db, 'SELECT s.* FROM idiom_senses s JOIN idioms i ON i.id = s.idiom_id WHERE i.list_id = ? ORDER BY s.sort_order, s.id', listId);
  const refs = await rows(db, 'SELECT r.* FROM idiom_word_refs r JOIN idiom_senses s ON s.id = r.sense_id JOIN idioms i ON i.id = s.idiom_id WHERE i.list_id = ? ORDER BY r.word_id', listId);
  const managed = await readIdioms(db, listId);
  if (rev !== await revision(db)) throw new Error('Collection changed during read; retry');
  const display = groupIdiomEntries(managed.entries, managed.chapters);
  const displayEntries = new Map(display.flatMap(c => c.sections.flatMap(s => s.items.map(e => [e.key, e.no]))));
  const displaySections = new Map(display.flatMap(c => c.sections.map(s => [s.key, { chapter: c.name, group: s.groupName || null, section: s.name }])));
  return { revision: rev, sections: sections.map(s => ({ ...s, display: displaySections.get(s.section_key) || null })),
    entries: entries.map(e => ({ ...e, aliases: JSON.parse(e.aliases), hidden: !!e.hidden, display_no: displayEntries.get(e.id) || null,
      meanings: senses.filter(s => s.idiom_id === e.id).map(s => ({ ...s, refs: refs.filter(r => r.sense_id === s.id) })) })) };
}
export async function callIdiomRead(name, args, db) {
  const def = IDIOM_READ_TOOLS.find(t => t.name === name); validate(args, def.inputSchema);
  const data = await snapshot(db, args.list_id);
  if (name === 'get_idiom_structure') {
    const sections = data.sections.map(s => ({ ...s, idiom_count: data.entries.filter(e => e.section_key === s.section_key).length,
      visible_count: data.entries.filter(e => e.section_key === s.section_key && !e.hidden).length }));
    const chapters = [...new Set(sections.map(s => s.chapter_key))].map(key => {
      const members = sections.filter(s => s.chapter_key === key);
      return { key, subtitle: members[0].chapter_subtitle, sort_order: members[0].chapter_order,
        display: members.find(s => s.display)?.display.chapter || null,
        groups: [...new Set(members.map(s => s.group_key).filter(Boolean))].map(groupKey => ({
          key: groupKey, subtitle: members.find(s => s.group_key === groupKey).group_subtitle,
          display: members.find(s => s.group_key === groupKey && s.display)?.display.group || null,
          section_keys: members.filter(s => s.group_key === groupKey).map(s => s.section_key),
        })), section_keys: members.map(s => s.section_key) };
    });
    return { listId: args.list_id, revision: data.revision, totalCount: data.entries.length,
      visibleCount: data.entries.filter(e => !e.hidden).length, chapters, sections };
  }
  if (name === 'get_idiom') {
    if (!!args.idiom_id === !!args.phrase) throw new Error('Specify exactly one of idiom_id or phrase');
    const found = data.entries.filter(e => args.idiom_id ? e.id === args.idiom_id : [e.phrase, ...e.aliases].some(p => norm(p) === norm(args.phrase)));
    if (found.length !== 1) throw new Error(found.length ? 'Ambiguous phrase; use idiom_id' : 'Idiom not found');
    return { listId: args.list_id, revision: data.revision, idiom: found[0], section: data.sections.find(s => s.section_key === found[0].section_key) };
  }
  const allowed = new Set(data.sections.filter(s => (!args.chapter_key || s.chapter_key === args.chapter_key) && (!args.group_key || s.group_key === args.group_key) && (!args.section_key || s.section_key === args.section_key)).map(s => s.section_key));
  const order = new Map(data.sections.map((s, i) => [s.section_key, i]));
  const found = data.entries.filter(e => allowed.has(e.section_key) && (args.include_hidden || !e.hidden) && (!args.query || norm([e.phrase, ...e.aliases, e.synonyms, e.antonyms, e.notes, ...e.meanings.map(s => s.meaning)].join(' ')).includes(norm(args.query))))
    .sort((a, b) => order.get(a.section_key) - order.get(b.section_key) || a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const offset = args.offset ?? 0, limit = args.limit ?? 50, entries = found.slice(offset, offset + limit);
  return { listId: args.list_id, revision: data.revision, entries, pagination: { totalCount: found.length, offset, limit, returnedCount: entries.length, hasMore: offset + limit < found.length, nextOffset: offset + limit < found.length ? offset + limit : null } };
}
const norm = s => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

export async function callIdiomWrite(name, args, db, auth) {
  const def = IDIOM_WRITE_TOOLS.find(t => t.name === name); validate(args, def.inputSchema);
  const data = await snapshot(db, args.list_id);
  if (data.revision !== args.expected_revision) throw new Error('Revision conflict; read the collection again');
  const statements = [], affected = new Set(), created = [];
  const add = (sql, ...values) => statements.push(db.prepare(sql).bind(...values));
  const entry = id => { const e = data.entries.find(e => e.id === id); if (!e) throw new Error('Idiom not found in this notebook: ' + id); affected.add(id); return e; };
  const section = key => { if (!data.sections.some(s => s.section_key === key)) throw new Error('Unknown idiom section'); };
  const refsFor = async (sense, old) => {
    const wordIds = sense.word_ids ?? old?.refs.map(r => r.word_id) ?? [];
    for (const id of wordIds) if (!await db.prepare('SELECT 1 FROM list_items WHERE list_id = ? AND word_id = ?').bind(args.list_id, id).first()) throw new Error('Reference word is not in this notebook: ' + id);
    return wordIds;
  };
  async function writeEntry(body, old = null) {
    const id = old?.id || crypto.randomUUID();
    const phrase = body.phrase?.trim() ?? old?.phrase;
    const key = body.section_key ?? old?.section_key; section(key);
    const aliases = body.aliases ?? old?.aliases ?? [];
    if ((!old || (body.phrase !== undefined && norm(phrase) !== norm(old.phrase))) && data.entries.some(e => e.id !== id && [e.phrase, ...e.aliases].some(p => norm(p) === norm(phrase)))) throw new Error('Duplicate phrase; use update_idiom or merge_idioms');
    if (body.aliases !== undefined && aliases.some(a => data.entries.some(e => e.id !== id && [e.phrase, ...e.aliases].some(p => norm(p) === norm(a))))) throw new Error('Alias conflicts with another idiom');
    if (!old) {
      if (created.some(e => [e.phrase, ...e.aliases].some(p => [phrase, ...aliases].some(a => norm(a) === norm(p))))) throw new Error('Duplicate phrase in batch');
      created.push({ id, phrase, aliases });
      add('INSERT INTO idioms (id, list_id, phrase, section_key, sort_order) VALUES (?, ?, ?, ?, ?)', id, args.list_id, phrase, key, Math.max(0, ...data.entries.map(e => e.sort_order)) + created.length);
    } else affected.add(id);
    const changes = { ...Object.fromEntries(['synonyms', 'antonyms', 'notes'].filter(k => body[k] !== undefined).map(k => [k, body[k]])), phrase, section_key: key };
    if (body.hidden !== undefined) changes.hidden = Number(body.hidden);
    if (body.aliases !== undefined) changes.aliases = JSON.stringify(aliases);
    add(`UPDATE idioms SET ${Object.keys(changes).map(k => k + ' = ?').join(', ')}, updated_at = datetime('now') WHERE id = ? AND list_id = ?`, ...Object.values(changes), id, args.list_id);
    if (body.meanings !== undefined) {
      const kept = new Set();
      for (const [index, sense] of body.meanings.entries()) {
        const previous = sense.id ? old?.meanings.find(s => s.id === sense.id) : null;
        if (sense.id && !previous) throw new Error('Sense does not belong to this idiom');
        const sid = previous?.id || crypto.randomUUID();
        if (kept.has(sid)) throw new Error('Duplicate sense ID'); kept.add(sid);
        const wordIds = await refsFor(sense, previous);
        add(`INSERT INTO idiom_senses (id, idiom_id, meaning, sort_order) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET meaning = excluded.meaning, sort_order = excluded.sort_order`, sid, id, sense.meaning.trim(), index);
        if (sense.word_ids !== undefined || !previous) {
          add('DELETE FROM idiom_word_refs WHERE sense_id = ?', sid);
          for (const wid of wordIds) add('INSERT INTO idiom_word_refs (sense_id, word_id, source) VALUES (?, ?, ?)', sid, wid, previous?.refs.find(r => r.word_id === wid)?.source || 'synonym');
        }
      }
      for (const s of old?.meanings || []) if (!kept.has(s.id)) add('DELETE FROM idiom_senses WHERE id = ? AND idiom_id = ?', s.id, id);
    }
    return id;
  }
  if (name === 'create_idioms') { for (const body of args.idioms) await writeEntry(body); }
  if (name === 'update_idiom') await writeEntry(args, entry(args.idiom_id));
  if (name === 'move_idioms' || name === 'reorder_idioms') {
    section(args.section_key);
    const selected = args.idiom_ids.map(entry);
    if (name === 'reorder_idioms') {
      const all = data.entries.filter(e => e.section_key === args.section_key);
      if (all.length !== selected.length || selected.some(e => e.section_key !== args.section_key)) throw new Error('Include every idiom in the section, including hidden entries');
    }
    const start = name === 'move_idioms' ? Math.max(0, ...data.entries.filter(e => e.section_key === args.section_key).map(e => e.sort_order)) + 1 : 0;
    selected.forEach((e, i) => add("UPDATE idioms SET section_key = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ? AND list_id = ?", args.section_key, start + i, e.id, args.list_id));
  }
  if (name === 'update_idiom_structure') {
    const keys = new Set(), chapters = new Map(), groups = new Map(), chapterOrders = new Map(), orders = new Set(), numbers = new Set();
    for (const s of args.sections) {
      if (keys.has(s.section_key)) throw new Error('Duplicate section key'); keys.add(s.section_key);
      const c = JSON.stringify([s.chapter_subtitle, s.chapter_order]);
      if (chapters.has(s.chapter_key) && chapters.get(s.chapter_key) !== c) throw new Error('Inconsistent Chapter metadata');
      chapters.set(s.chapter_key, c);
      if (chapterOrders.has(s.chapter_order) && chapterOrders.get(s.chapter_order) !== s.chapter_key) throw new Error('Duplicate Chapter order');
      chapterOrders.set(s.chapter_order, s.chapter_key);
      const order = JSON.stringify([s.chapter_key, s.sort_order]);
      if (orders.has(order)) throw new Error('Duplicate Section order within Chapter'); orders.add(order);
      if (s.display_number != null) { if (numbers.has(s.display_number)) throw new Error('Duplicate display number'); numbers.add(s.display_number); }
      if (s.group_key) {
        if (!s.group_subtitle || s.group_order == null) throw new Error('Group subtitle and order are required');
        const g = JSON.stringify([s.chapter_key, s.group_subtitle, s.group_order]);
        if (groups.has(s.group_key) && groups.get(s.group_key) !== g) throw new Error('Inconsistent Group metadata'); groups.set(s.group_key, g);
      } else if (s.group_subtitle != null || s.group_order != null) throw new Error('Group metadata requires group_key');
      const columns = ['subtitle', 'chapter_key', 'chapter_subtitle', 'chapter_order', 'sort_order', 'group_key', 'group_subtitle', 'group_order', 'display_number'];
      add(`INSERT INTO idiom_sections (list_id, section_key, ${columns.join(', ')}) VALUES (${Array(11).fill('?').join(', ')})
        ON CONFLICT(list_id, section_key) DO UPDATE SET ${columns.map(k => k + ' = excluded.' + k).join(', ')}`,
      args.list_id, s.section_key, ...columns.map(k => s[k] ?? null));
    }
    for (const s of data.sections) if (!keys.has(s.section_key)) {
      if (data.entries.some(e => e.section_key === s.section_key)) throw new Error('Cannot remove a populated Section; move its idioms first');
      add('DELETE FROM idiom_sections WHERE list_id = ? AND section_key = ?', args.list_id, s.section_key);
    }
  }
  if (name === 'merge_idioms') {
    const target = entry(args.target_id);
    if (args.source_ids.includes(target.id)) throw new Error('Target cannot be a source');
    const sources = args.source_ids.map(entry);
    const all = [target, ...sources];
    const aliases = [...new Set(all.flatMap(e => [...e.aliases, ...(e.id === target.id ? [] : [e.phrase, e.id])]))];
    if (aliases.length > 100) throw new Error('Too many aliases after merge');
    // Keep every sense identity, including equal text with different references.
    let order = Math.max(-1, ...target.meanings.map(s => s.sort_order)) + 1;
    for (const source of sources) for (const sense of source.meanings) add('UPDATE idiom_senses SET idiom_id = ?, sort_order = ? WHERE id = ?', target.id, order++, sense.id);
    const combined = ['synonyms', 'antonyms', 'notes'].map(k => [...new Set(all.map(e => e[k]).filter(Boolean))].join('\n'));
    if (combined.some(v => v.length > 20000)) throw new Error('Merged field is too long');
    add("UPDATE idioms SET synonyms = ?, antonyms = ?, notes = ?, aliases = ?, updated_at = datetime('now') WHERE id = ?", ...combined, JSON.stringify(aliases), target.id);
    for (const source of sources) add('DELETE FROM idioms WHERE id = ? AND list_id = ?', source.id, args.list_id);
  }
  const guard = crypto.randomUUID();
  // CHECK aborts the entire D1 batch if any editor changed the data after validation.
  const audit = { listId: args.list_id, expectedRevision: args.expected_revision, created,
    before: data.entries.filter(e => affected.has(e.id)), ...(name === 'update_idiom_structure' ? { sectionsBefore: data.sections, sectionsAfter: args.sections } : {}) };
  await db.batch([
    db.prepare('INSERT INTO idiom_mcp_guard (id, valid) SELECT ?, CASE WHEN revision = ? THEN 1 ELSE 0 END FROM idiom_mcp_revision WHERE id = 1').bind(guard, args.expected_revision),
    ...statements,
    db.prepare('INSERT INTO mcp_audit_log (actor, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)').bind(auth?.actor || 'mcp', name, 'idiom_collection', args.list_id, JSON.stringify(audit)),
    db.prepare('DELETE FROM idiom_mcp_guard WHERE id = ?').bind(guard),
  ]);
  return { ok: true, listId: args.list_id, created, affectedIds: [...affected], structureUpdated: name === 'update_idiom_structure', message: 'Saved atomically. Read again to obtain the current revision and display numbers.' };
}
