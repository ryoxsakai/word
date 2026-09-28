import { listLists, listWordsInListFull, getViewerIndex } from './index.js';
import { readIdiomIndex, readIdiomSection } from './idioms.js';
import { illustrationUrl } from './word-illustrations.js';
import { idiomIllustrationUrl } from './idiom-illustrations.js';

export const scopeKey = ({ list_id, kind, section_key = '' }) => JSON.stringify([list_id, kind, section_key]);
export const wordSection = (list, section) => scopeKey({ list_id: list, kind: 'word-section', section_key: String(section) });
export const idiomSection = (list, section) => scopeKey({ list_id: list, kind: 'idiom-section', section_key: String(section) });
export const indexKey = (list, kind) => scopeKey({ list_id: list, kind });

export function searchWords(words) {
  return words.map(w => ({ wordId: w.id, sectionKey: String(w.sectionId ?? 'none'),
    text: [w.spelling,w.pronunciation,w.irregularForms,w.etymology,w.synonyms,w.antonyms,w.relatedWords,w.notes,
      ...w.senses.map(s=>s.meaning),...w.derivatives.flatMap(d=>[d.word,d.meaning]),
      ...w.examples.flatMap(e=>[e.sentence,e.translation]),...Object.entries(w.tags).flat()].filter(Boolean).join('\n').replace(/[A-Z]/g,c=>c.toLowerCase()) }));
}
export async function buildSnapshotScope(env, scope) {
  const { list_id: list, kind, section_key: section } = scope;
  const db = env.DB;
  if (kind === 'catalog') return { data: await (await listLists(db)).json(), media: {} };
  if (!await db.prepare('SELECT id FROM lists WHERE id=?').bind(list).first()) return null;
  let response, data, media = {};
  if (kind === 'viewer-index') response = await getViewerIndex(db, list, new Request('https://snapshot.local/'));
  else if (kind === 'idiom-index') data = await readIdiomIndex(db, list);
  else if (kind === 'word-section') {
    response = await listWordsInListFull(db, list, { sectionKey: section });
    if (response.status === 404) return null;
    data = await response.json(); response = null;

    const filter = section === 'none' ? 'li.section_id IS NULL' : 'li.section_id=?';
    const bind = section === 'none' ? [list] : [list, Number(section)];
    const audio = await db.prepare(`SELECT a.word_id,a.variant_key,a.object_key,a.content_type FROM word_audio a JOIN list_items li ON li.word_id=a.word_id WHERE li.list_id=? AND ${filter} AND a.is_stale=0`).bind(...bind).all();
    for (const a of audio.results) media[`/mcp-viewer/api/audio/${encodeURIComponent(a.word_id)}/${encodeURIComponent(a.variant_key)}`] = { bucket: 'AUDIO_BUCKET', key: a.object_key, type: a.content_type };
    if (list === 'crossover-v3') {
      const images = await db.prepare(`SELECT a.word_id,a.job_id,j.object_key FROM word_illustrations a JOIN illustration_jobs j ON j.id=a.job_id JOIN list_items li ON li.word_id=a.word_id WHERE li.list_id=? AND ${filter} AND j.status='ready'`).bind(...bind).all();
      for (const i of images.results) media[illustrationUrl(i.word_id,i.job_id)] = { bucket: 'ILLUSTRATION_BUCKET', key: i.object_key, type: 'image/png' };
    }
  } else if (kind === 'idiom-section') {
    data = await readIdiomSection(db, list, section, { illustrations: true });
    if (!data) return null;
    const images = await db.prepare(`SELECT a.idiom_id,a.job_id,j.object_key FROM idiom_illustrations a JOIN idiom_illustration_jobs j ON j.id=a.job_id JOIN idioms i ON i.id=a.idiom_id WHERE i.list_id=? AND i.section_key=? AND i.hidden=0 AND j.status='ready'`).bind(list,section).all();
    for (const i of images.results) media[idiomIllustrationUrl(i.idiom_id,i.job_id)] = { bucket: 'ILLUSTRATION_BUCKET', key: i.object_key, type: 'image/png' };
  } else throw new Error(`Unknown snapshot scope: ${kind}`);
  if (response) {
    if (!response.ok) throw new Error(`Snapshot build failed: ${response.status}`);
    data = await response.json();
  }
  return { data, media };
}
