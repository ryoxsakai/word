// Authenticated notebook reads project the already-published viewer JSON.
// This module must never query D1, even on a missing or damaged snapshot.
import { indexKey, wordSection, idiomSection } from './viewer-snapshot-build.js';

export const editorSnapshotsEnabled = env => env.VIEWER_STATIC_ENABLED === 'true' &&
  !!env.VIEWER_SNAPSHOTS && !!env.VIEWER_PUBLISHER;
const publisher = env => env.VIEWER_PUBLISHER.get(env.VIEWER_PUBLISHER.idFromName('viewer'));
const formatNo = word => word.no == null ? null : word.branch ? `${word.no}-${word.branch}` : String(word.no);
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});
const pending = () => json({ code: 'editor_snapshot_pending', error: '保存済みの変更を一覧に反映しています。少し待ってから再読み込みしてください。' }, 503, { 'retry-after': '1' });

async function read(env, manifest, key) {
  const entry = manifest.files[key];
  if (!entry) return null;
  const object = await env.VIEWER_SNAPSHOTS.get(entry.key);
  if (!object) throw new Error('Published editor snapshot object missing');
  return object.json();
}

function editorRow(word, index) {
  const section = index.editorStructure.sections.find(s => s.id === word.sectionId);
  const primary = word.senses.find(s => s.isPrimary) || {};
  return {
    id: word.id, spelling: word.spelling, pronunciation: word.pronunciation,
    no: word.no, branch: word.branch, displayNo: formatNo(word),
    sectionId: word.sectionId, sectionName: section?.name ?? null,
    sectionSubtitle: word.sectionSubtitle, sectionSortOrder: word.sectionSortOrder,
    chapterId: word.chapterId, chapterSortOrder: word.chapterSortOrder, groupId: section?.groupId ?? null,
    labelId: word.labelId, labelName: word.labelName, labelSortOrder: word.labelSortOrder,
    derivedFromId: word.derivedFromId,
    ...Object.fromEntries(['pronunciationCaution', 'accentCaution', 'polysemousCaution', 'spellingCaution',
      'ergative', 'conjugationCaution', 'usageCaution'].map(key => [key, !!word[key]])),
    awlSublist: word.tags.awl ?? null, oxfordLevel: word.tags.oxford5000 ?? null,
    provisionalCefr: word.tags.cefr_provisional ?? null, eiken: word.tags.eiken ?? null,
    target1900No: word.tags.target1900 ?? null, target1400No: word.tags.target1400 ?? null,
    primaryMeaning: primary.meaning ?? null, primaryPos: primary.pos ?? null,
    phrases: word.examples.filter(e => e.type === 'phrase').map(e => e.sentence),
  };
}

// Called only after verifyMcpAccess in the editor API router.
export async function serveEditorSnapshot(request, env) {
  if (request.method !== 'GET' || !editorSnapshotsEnabled(env)) return null;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/mcp-editor\/api/, '').replace(/\/$/, '');
  const match = path.match(/^\/lists\/([^/]+)\/(editor\/(?:index|references|idioms|idiom-sections\/[^/]+|sections\/[^/]+)|sections|chapters|labels)$/);
  if (path !== '/lists' && !match) return null;
  const list = match && decodeURIComponent(match[1]);
  if (list === '__master__') return null;
  try {
    if (url.searchParams.get('editorFresh') === '1') {
      const status = await publisher(env).fetch('https://publisher/editor-status');
      if (!status.ok || (await status.json()).pending) return pending();
    }
    const current = await env.VIEWER_SNAPSHOTS.get('current.json');
    if (!current) {
      await publisher(env).fetch('https://publisher/wake', { method: 'POST' });
      return pending();
    }
    const manifest = await current.json();
    let data;
    if (path === '/lists') data = await read(env, manifest, indexKey('', 'catalog'));
    else {
      const index = await read(env, manifest, indexKey(list, 'viewer-index'));
      if (!index) return json({ error: 'list not found' }, 404);
      if (!index.editorStructure) {
        // The publisher deduplicates the one-time index upgrade, including when
        // an older deployment already consumed the migration's journal entry.
        const upgrade = await publisher(env).fetch(`https://publisher/editor-upgrade?list=${encodeURIComponent(list)}`, { method: 'POST' });
        if (!upgrade.ok) throw new Error('Editor index upgrade unavailable');
        return pending();
      }
      const tail = match[2];
      if (tail === 'editor/index') {
        data = { words: index.words.map(({ id, spelling, no, branch, sectionId, labelId }) =>
          ({ id, spelling, no, branch, sectionId, labelId, displayNo: formatNo({ no, branch }) })) };
      } else if (tail === 'editor/references') {
        data = { words: [...index.words].sort((a, b) => a.no - b.no || a.branch - b.branch)
          .map(({ id, spelling, phrases, derivatives }) => ({ id, spelling, phrases, derivatives }))
          .filter(w => w.phrases.length || w.derivatives.length) };
      } else if (tail === 'editor/idioms') {
        // Link resolution needs phrases, aliases and numbering, not every meaning.
        data = await read(env, manifest, indexKey(list, 'idiom-index'));
        if (!data) throw new Error('Published idiom index missing');
      } else if (tail.startsWith('editor/idiom-sections/')) {
        const section = decodeURIComponent(tail.slice('editor/idiom-sections/'.length));
        data = await read(env, manifest, idiomSection(list, section));
        if (!data) return json({ error: 'section not found' }, 404);
      } else if (tail.startsWith('editor/sections/')) {
        const section = decodeURIComponent(tail.slice('editor/sections/'.length));
        if (section !== 'none' && !index.editorStructure.sections.some(s => String(s.id) === section)) {
          return json({ error: 'section not found' }, 404);
        }
        const shard = await read(env, manifest, wordSection(list, section));
        if (!shard && index.words.some(w => w.sectionKey === section)) throw new Error('Published word section missing');
        data = url.searchParams.get('full') === '1'
          ? { words: shard?.words || [] }
          : (shard?.words || []).map(w => editorRow(w, index));
      } else data = index.editorStructure[tail];
    }
    if (data == null) throw new Error('Published editor data missing');
    const body = JSON.stringify(data);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    const etag = `"${[...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')}"`;
    return new Response(request.headers.get('if-none-match') === etag ? null : body, {
      status: request.headers.get('if-none-match') === etag ? 304 : 200,
      headers: { 'content-type': 'application/json; charset=utf-8',
        'cache-control': 'private, max-age=0, must-revalidate', vary: 'Authorization', etag,
        'x-editor-source': 'r2', 'x-editor-snapshots': 'r2', 'x-editor-revision': manifest.revision },
    });
  } catch (error) {
    console.error('Editor snapshot read failed', error);
    return json({ error: '一覧データを読み込めませんでした。少し待ってから再読み込みしてください。' }, 503);
  }
}
