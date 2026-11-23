// 閲覧型編集ページ（public/setting/index.html）を実際のブラウザで動かし、
// 選択・ダブルタップでの編集・単語ごとの保存・バッジ・＋／−・追加・移動・Section編集・熟語を検証する。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const LIST = 'crossover-v3';

function fixture() {
  const word = (id, spelling, extra = {}) => ({
    id, spelling, pronunciation: '', audioUrl: null, etymology: null, notes: null, synonyms: null, antonyms: null, relatedWords: null, irregularForms: null,
    pronunciationCaution: false, accentCaution: false, polysemousCaution: false, spellingCaution: false, ergative: false, conjugationCaution: false, usageCaution: false,
    senses: [{ pos: '動', meaning: `${spelling}の意味`, pronunciation: null, is_primary: true }], derivatives: [], examples: [], tags: {}, derivedFrom: null, ...extra,
  });
  const words = new Map([
    ['w1', word('w1', 'take', { pronunciation: 'teɪk', examples: [{ type: 'example', sentence: 'take a bus', translation: 'バスに乗る', answer: 'take' }] })],
    ['w2', word('w2', 'make', { synonyms: 'create' })],
    ['w3', word('w3', 'give')],
    ['w4', word('w4', 'study', { illustration: { url: '/mcp-viewer/api/illustrations/w4/0a1b2c3d-0000-4000-8000-000000000001.png', meaning: '勉強' } })],
  ]);
  const members = new Map([
    ['w1', { no: 1, branch: 0, sectionId: 10, labelId: null }],
    ['w2', { no: 2, branch: 0, sectionId: 10, labelId: null }],
    ['w3', { no: 3, branch: 0, sectionId: 10, labelId: null }],
    ['w4', { no: 4, branch: 0, sectionId: 20, labelId: null }],
  ]);
  const idioms = [
    { key: 'i1', phrase: 'look up', sectionKey: 'look', meanings: [{ id: 's1', meaning: '調べる', refs: [] }] },
    { key: 'i2', phrase: 'look after', sectionKey: 'look', meanings: [{ id: 's2', meaning: '世話をする', refs: [] }], notes: 'care for' },
    { key: 'i3', phrase: 'see off', sectionKey: 'see', meanings: [{ id: 's3', meaning: '見送る', refs: [] }] },
  ];
  return {
    words, members, idioms, writes: [],
    chapters: [{ id: 1, subtitle: '基本', description: null, sortOrder: 1 }, { id: 2, subtitle: '発展', description: null, sortOrder: 2 }],
    sections: [{ id: 10, name: '', subtitle: '動詞', description: null, sortOrder: 1, chapterId: 1, groupId: null }, { id: 20, name: '', subtitle: '学習', description: null, sortOrder: 2, chapterId: 2, groupId: null }],
    labels: [], nextId: 100,
    idiomChapters: [{ key: 'verbs', subtitle: '基本動詞の熟語', sections: [{ key: 'look', subtitle: 'look' }, { key: 'see', subtitle: 'see' }] }],
  };
}

function detail(db, id) {
  const w = db.words.get(id), m = db.members.get(id);
  return structuredClone({ ...w, lists: m ? [{ listId: LIST, listName: 'crossover', no: m.no, branch: m.branch, sectionId: m.sectionId, labelId: m.labelId, displayNo: String(m.no) }] : [] });
}
function viewerWord(db, id) {
  const w = detail(db, id), m = db.members.get(id);
  return { ...w, no: m.no, branch: m.branch, sectionId: m.sectionId, labelId: m.labelId, senses: w.senses.map(s => ({ ...s, isPrimary: !!s.is_primary })) };
}
function ordered(db) {
  const section = id => db.sections.find(s => s.id === id);
  const chapterSort = id => db.chapters.find(c => c.id === id)?.sortOrder ?? -1;
  return [...db.members].sort(([, a], [, b]) => {
    const sa = section(a.sectionId), sb = section(b.sectionId);
    return (chapterSort(sa?.chapterId) - chapterSort(sb?.chapterId)) || ((sa?.sortOrder ?? -1) - (sb?.sortOrder ?? -1)) || a.no - b.no || a.branch - b.branch;
  });
}

async function handleApi(db, method, path, body) {
  const url = new URL(path, 'http://x');
  const parts = url.pathname.replace(/^\/api\//, '').split('/').map(decodeURIComponent);
  if (method !== 'GET') db.writes.push({ method, path: url.pathname, body });
  if (parts[0] === 'lists' && parts.length === 1) return [{ id: LIST, name: 'crossover', isNotebook: true, chapterLabel: 'Chapter', sectionLabel: 'Section' }];
  if (parts[0] === 'lookup') return { pronunciation: 'ˈnjuː' };
  if (parts[0] === 'words' && parts.length === 1 && method === 'POST') {
    const id = `w${++db.nextId}`;
    db.words.set(id, { ...body, id, derivedFrom: null, senses: body.senses.map(s => ({ ...s, is_primary: !!s.is_primary })) });
    const maxNo = Math.max(...[...db.members.values()].map(m => m.no));
    db.members.set(id, { no: maxNo + 1, branch: 0, sectionId: body.sectionId, labelId: body.labelId });
    return detail(db, id);
  }
  if (parts[0] === 'words' && parts.length === 2) {
    if (method === 'GET') {
      if (db.staleDetail?.id === parts[1]) {
        const old = db.staleDetail;
        delete db.staleDetail;
        return old;
      }
      return detail(db, parts[1]);
    }
    if (method === 'PUT') {
      if (db.putDelay) await new Promise(resolve => setTimeout(resolve, db.putDelay));
      if (db.loseNextWriteResponse) db.staleDetail = detail(db, parts[1]);
      db.words.set(parts[1], { ...db.words.get(parts[1]), ...body, examples: body.updatedCollections?.includes('examples') ? body.examples.map(e => ({ ...e, type: 'phrase' })) : db.words.get(parts[1]).examples, senses: body.senses.map(s => ({ ...s, is_primary: !!s.is_primary })) });
      return detail(db, parts[1]);
    }
  }
  if (parts[0] !== 'lists' || parts[1] !== LIST) throw Object.assign(new Error('not found'), { status: 404 });
  const tail = parts.slice(2).join('/');
  if (tail === 'editor/index') return { words: ordered(db).map(([id, m]) => ({ id, spelling: db.words.get(id).spelling, no: m.no, branch: m.branch, sectionId: m.sectionId, labelId: m.labelId, displayNo: String(m.no) })) };
  if (tail === 'editor/references') return { words: [] };
  if (tail === 'sections' && method === 'GET') return db.sections;
  if (tail === 'sections' && method === 'POST') {
    const section = { id: ++db.nextId, name: '', subtitle: null, description: null, sortOrder: db.sections.length + 1, chapterId: body.chapterId ?? null, groupId: body.groupId ?? null };
    db.sections.push(section);
    return section;
  }
  if (tail === 'sections/reorder') { body.sections.forEach((s, i) => Object.assign(db.sections.find(x => x.id === s.id), { sortOrder: i + 1, chapterId: s.chapterId })); return { ok: true }; }
  if (parts[2] === 'sections' && parts.length === 4 && method === 'PUT') { Object.assign(db.sections.find(s => s.id === Number(parts[3])), { subtitle: body.subtitle, description: body.description }); return body; }
  if (tail === 'chapters') return db.chapters;
  if (tail === 'labels' && method === 'GET') return db.labels;
  if (tail === 'labels' && method === 'POST') { const label = { id: ++db.nextId, sectionId: body.sectionId, name: body.name, sortOrder: 1 }; db.labels.push(label); return label; }
  if (tail === 'groups') return [];
  if (tail === 'reorder') {
    body.items.forEach((item, index) => Object.assign(db.members.get(item.wordId), { no: index + 1, sectionId: item.sectionId, labelId: item.labelId }));
    return { ok: true, count: body.items.length };
  }
  if (parts[2] === 'items' && method === 'DELETE') { db.members.delete(parts[3]); return null; }
  // 閲覧ページの公開API（公開が遅れている状態を再現できるよう、frozenがあればその内容を返す）。
  if (parts[2] === 'viewer' && parts[3] === 'sections') {
    db.publicReads = (db.publicReads || 0) + 1;
    if (db.publicDelay) await new Promise(resolve => setTimeout(resolve, db.publicDelay));
    if (db.frozenPublic?.[parts[4]]) return db.frozenPublic[parts[4]];
    return { words: ordered(db).filter(([, m]) => String(m.sectionId ?? 'none') === parts[4]).map(([id]) => viewerWord(db, id)) };
  }
  if (parts[2] === 'editor' && parts[3] === 'sections') return { words: ordered(db).filter(([, m]) => String(m.sectionId ?? 'none') === parts[4]).map(([id]) => viewerWord(db, id)) };
  if (tail === 'editor/idioms') return { managed: true, chapters: db.idiomChapters, entries: db.idioms.map(({ key, phrase, sectionKey, hidden }) => ({ key, phrase, sectionKey, meanings: [], ...(hidden ? { hidden } : {}) })) };
  if (parts[2] === 'editor' && parts[3] === 'idiom-sections') return { sectionKey: parts[4], entries: structuredClone(db.idioms.filter(i => i.sectionKey === parts[4])) };
  if (tail.startsWith('idioms/sections/') && method === 'GET' && db.idiomLatestDelay) await new Promise(resolve => setTimeout(resolve, db.idiomLatestDelay));
  if (tail.startsWith('idioms/sections/') && method === 'GET') return { sectionKey: parts[4], entries: structuredClone(db.idioms.filter(i => i.sectionKey === parts[4])) };
  if (tail === 'idioms' && method === 'PUT') {
    const key = body.id || `idiom-${++db.nextId}`;
    const existing = db.idioms.find(i => i.key === key);
    const next = { key, phrase: body.phrase, sectionKey: body.sectionKey, meanings: body.meanings.map((m, i) => ({ id: m.id || `sense-${key}-${i}`, meaning: m.meaning, refs: [] })), synonyms: body.synonyms, antonyms: body.antonyms, notes: body.notes, hidden: body.hidden, alternateForms: body.alternateForms };
    if (existing) Object.assign(existing, next); else db.idioms.push(next);
    return { id: key };
  }
  if (tail === 'idioms/reorder') { db.idioms.sort((a, b) => body.entries.findIndex(e => e.id === a.key) - body.entries.findIndex(e => e.id === b.key)); body.entries.forEach(e => { db.idioms.find(i => i.key === e.id).sectionKey = e.sectionKey; }); return { updated: body.entries.length }; }
  if (tail.startsWith('idioms/sections/') && method === 'PUT') { db.idiomChapters[0].sections.find(s => s.key === parts[4]).subtitle = body.subtitle; return { key: parts[4], subtitle: body.subtitle }; }
  throw Object.assign(new Error(`unhandled ${method} ${tail}`), { status: 500 });
}

function startServer(db) {
  const server = createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
        try {
          // 本番と同じく、公開が終わるまでは最新を求める読み出しを「公開待ち」で返す。
          // 公開処理が混んで、最新の確認が返ってこない状態を再現する。
          if (req.method === 'GET' && req.url.startsWith('/api/lookup?')) {
            const spelling = new URL(req.url, 'http://x').searchParams.get('spelling');
            (db.lookupRequests ??= []).push(spelling);
            if (spelling === db.hangLookup) return;
          }
          if (req.method === 'GET' && req.url.includes('editorFresh=1') && db.hangFresh) return;
          // 見出しだけ返し、本文が届かない状態を再現する。
          if (req.method === 'GET' && req.url.includes('editorFresh=1') && db.hangFreshBody) { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{'); return; }
          if (req.method === 'GET' && req.url.includes('editorFresh=1') && db.frozenPublic) {
            res.writeHead(503, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ code: 'editor_snapshot_pending', error: 'pending' }));
            return;
          }
          if (req.method === 'PUT' && db.rejectNextWordSave) {
            db.rejectNextWordSave = false;
            throw Object.assign(new Error('temporarily unavailable'), {status:503});
          }
          const data = await handleApi(db, req.method, req.url, body);
          if (req.method === 'PUT' && db.loseNextWriteResponse) {
            db.loseNextWriteResponse = false;
            return; // The write committed, but no response arrives.
          }
          // 本番の書き込み応答と同じく、閲覧ページへの公開待ちを知らせる。
          res.writeHead(data == null ? 204 : 200, { 'content-type': 'application/json', ...(req.method === 'GET' ? {} : { 'x-editor-snapshots': 'r2' }) });
          res.end(data == null ? '' : JSON.stringify(data));
        } catch (error) {
          res.writeHead(error.status || 500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }
      if (req.url.startsWith('/mcp-viewer/api/illustrations/')) {
        db.imageRequests = [...(db.imageRequests || []), req.url];
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(await readFile(join(PUBLIC, 'shared/icons/apple-touch-icon-viewer.png')));
        return;
      }
      const path = normalize(join(PUBLIC, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
      if (!path.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
      const file = path.endsWith('/') ? join(path, 'index.html') : path;
      const content = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const db = fixture();
const server = await startServer(db);
const origin = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const errors = [];
try {
  // Word hits are usable even when both search sources are still waiting.
  // Each source appends to this sheet without reopening it or replacing a focused result.
  const searchPage = await browser.newPage();
  let unblockIdioms;
  const idiomGate = new Promise(resolve => { unblockIdioms = resolve; });
  const searches = new Map();
  const hold = (map, key, route) => new Promise(resolve => map.set(key, async response => {
    try { await route.fulfill(response); } catch { /* closing the sheet cancels fetch */ }
    finally { resolve(); }
  }));
  const received = async (map, key) => {
    for (let i = 0; i < 100 && !map.has(key); i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(map.has(key), `request observed: ${key}`);
    return map.get(key);
  };
  await searchPage.route(`**/api/lists/${LIST}/editor/idioms`, async route => {
    await idiomGate; // Both the reference warmup and the idiom editor use this route.
    await route.fulfill({ json: await handleApi(db, 'GET', `/api/lists/${LIST}/editor/idioms`, null) });
  });
  await searchPage.route(`**/api/lists/${LIST}/viewer/search?*`, route => {
    const query = new URL(route.request().url()).searchParams.get('q');
    return hold(searches, query, route);
  });
  try {
    await searchPage.goto(`${origin}/setting/index.html`);
    await searchPage.locator('.entry[data-word-id="w1"]').waitFor();
    const submitSearch = async query => {
      await searchPage.locator('#settingsToggle').click();
      const input = searchPage.locator('#searchInput');
      await input.fill(query);
      await input.press('Enter');
    };
    const searchSheet = searchPage.getByRole('dialog');
    const result = label => searchSheet.locator('.edit-menu-item', { hasText: label });
    const release = async (query, ids, status = 200) => (await received(searches, query))({
      status, json: { matches: ids.map(wordId => ({ wordId })) },
    });

    await submitSearch('Take');
    await result('take').waitFor({ timeout: 2000 });
    assert.equal(await searchSheet.getAttribute('aria-label'), '「Take」の検索結果');
    const local = result('take');
    await local.focus();
    await release('take', ['w1', 'w4', 'w4']);
    await result('study').waitFor();
    assert.equal(await result('study').count(), 1, '重複する本文検索結果は1件だけ表示する');
    assert.equal(await local.count(), 1, '見出し語と本文に重複した結果は1件だけ表示する');
    assert.equal(await local.evaluate(el => el === document.activeElement), true);
    assert.match(await searchSheet.getByRole('status').textContent(), /検索中/);
    await searchPage.keyboard.press('Escape');

    await submitSearch('look');
    unblockIdioms();
    await result('look up').waitFor({ timeout: 2000 });
    await received(searches, 'look');
    await searchPage.keyboard.press('Escape');
    await submitSearch('create');
    await release('create', ['w2']);
    await result('make').waitFor({ timeout: 2000 });
    await release('look', ['w3']);
    assert.equal(await searchSheet.getAttribute('aria-label'), '「create」の検索結果');
    assert.equal(await result('give').count(), 0, '閉じた検索の応答で新しいシートを書き換えない');
    await result('make').click();
    await searchPage.waitForFunction(() => document.querySelector('.entry[data-word-id="w2"]')?.classList.contains('is-edit-selected'));
    assert.equal(await searchSheet.count(), 0);

    await submitSearch('nothing');
    await release('nothing', []);
    await searchSheet.getByText('見つかりませんでした。', { exact: true }).waitFor();
    await searchPage.keyboard.press('Escape');
    await submitSearch('network');
    await release('network', [], 503);
    await searchSheet.getByText('本文を検索できませんでした。', { exact: true }).waitFor();
  } finally {
    unblockIdioms();
    await searchPage.close();
  }

  // Holding the pointer still at the edge must move the marker and drop target as
  // content scrolls, both in the page and in a collection editor's scroll pane.
  for (const mode of ['window', 'pane']) {
    const scrollPage = await browser.newPage({ viewport: { width: 400, height: 280 } });
    try {
      const testUrl = `${origin}/__sortable-edge`;
      await scrollPage.route(testUrl, route => route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>
          body { margin: 0; }
          #list { ${mode === 'pane' ? 'margin: 10px; height: 260px; overflow: auto;' : ''} }
          [data-sort-item] { height: 60px; }
          [data-grip] { height: 100%; width: 64px; }
          .edit-drop-line, .edit-drag-ghost { position: fixed; pointer-events: none; }
        </style><div id="list"></div>`,
      }));
      await scrollPage.goto(testUrl);
      await scrollPage.evaluate(async mode => {
        const { sortable } = await import('/setting/edit/ui.js');
        const list = document.getElementById('list');
        list.innerHTML = Array.from({ length: 12 }, (_, i) =>
          `<div data-sort-item="${i}"><button type="button" data-grip>Row ${i}</button></div>`).join('');
        sortable(list, {
          handleSelector: '[data-grip]', itemSelector: '[data-sort-item]', idOf: row => row.dataset.sortItem,
          scrollElement: mode === 'pane' ? list : window,
          onDrop: (...args) => { window.sortDrop = args.slice(0, 3); },
        });
      }, mode);

      const x = 38, edgeY = 245;
      await scrollPage.mouse.move(x, 34);
      await scrollPage.mouse.down();
      await scrollPage.mouse.move(x, edgeY);
      await scrollPage.waitForFunction(mode => {
        const el = mode === 'pane' ? document.getElementById('list') : document.scrollingElement;
        return el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
      }, mode);
      const expected = await scrollPage.evaluate(({ x, edgeY }) => {
        const current = document.elementFromPoint(x, edgeY).closest('[data-sort-item]');
        const rect = current.getBoundingClientRect();
        const before = edgeY < rect.top + rect.height / 2;
        return { id: current.dataset.sortItem, before, line: (before ? rect.top : rect.bottom) - 2 };
      }, { x, edgeY });
      assert.equal(expected.id, '11', `${mode}: later rows have scrolled under the stationary pointer`);
      assert.equal(parseFloat(await scrollPage.locator('.edit-drop-line').evaluate(el => el.style.top)),
        expected.line, `${mode}: marker follows the currently hovered row`);
      await scrollPage.mouse.up();
      assert.deepEqual(await scrollPage.evaluate(() => window.sortDrop), ['0', expected.id, expected.before]);
      assert.equal(await scrollPage.locator('.edit-drop-line').count(), 0);
    } finally {
      await scrollPage.close();
    }
  }

  const page = await browser.newPage({ viewport: { width: 393, height: 900 }, hasTouch: false });
  page.on('pageerror', error => errors.push(error.message));
  await page.route(url => !url.href.startsWith(origin), route => route.abort());
  await page.goto(`${origin}/setting/index.html`);
  const entry = id => page.locator(`[data-section-entries] .entry[data-word-id="${id}"]`);
  const save = id => entry(id).locator('[data-op="save-word"]').click();
  const dbl = async locator => { await locator.click(); await locator.click(); };
  const waitWrites = async count => { for (let i = 0; i < 100 && db.writes.length < count; i++) await page.waitForTimeout(30); };

  await entry('w1').waitFor();
  // 閲覧ページと同じ見た目（番号・見出し・Section帯）で表示される。
  assert.equal(await entry('w1').locator('.entry-no').textContent(), '1');
  assert.equal(await page.locator('#section-10 .section-subtitle').textContent(), '動詞');
  assert.equal(await page.locator('.edit-plus').count(), 0, '選択前は編集部品を出さない');

  // 1回のタップは閲覧のまま、番号をダブルタップすると＋／−が出る。
  await entry('w1').locator('.headword').click();
  assert.equal(await entry('w1').locator('.edit-minus').count(), 0);
  await dbl(entry('w1').locator('.entry-no'));
  assert.ok(await entry('w1').evaluate(el => el.classList.contains('is-edit-selected')));
  // 見出し行の操作は、アイコンだけにせず短い文字を添える（DESIGN.md）。
  assert.equal((await entry('w1').getByRole('button', { name: 'バッジ', exact: true }).textContent()).trim(), 'バッジ');

  // ダブルタップで意味をその場で編集し、確定は下書きに留め、保存ボタンで書き込む。
  await dbl(entry('w1').locator('.sense-meaning').first());
  const input = page.locator('[role=dialog] [data-field=meaning]').first();
  const apply = () => page.locator('[data-apply]').click();
  assert.equal(await input.inputValue(), 'takeの意味');
  await input.fill('取る');
  await apply();
  assert.equal(db.writes.length, 0);
  await save('w1');
  await waitWrites(1);
  assert.equal(db.words.get('w1').senses[0].meaning, '取る');
  assert.match(await entry('w1').locator('.sense-meaning').first().textContent(), /取る/);
  // 例文（◆）はフレーズとして保存し直される（種類は変えない：保存では既存の種類を保持）。
  assert.equal(db.words.get('w1').examples[0].sentence, 'take a bus');

  // リセットは保存済みの語義を復元し、書き込みを行わない。
  await dbl(entry('w1').locator('.sense-meaning').first());
  await input.fill('取り消す下書き');
  await apply();
  await entry('w1').locator('[data-op="reset-word"]').click();
  assert.match(await entry('w1').locator('.sense-meaning').first().textContent(), /取る/);
  assert.equal(db.writes.length, 1);
  await dbl(entry('w1').locator('.sense-meaning').first());
  await input.fill('takeの意味');
  await apply();
  await save('w1');
  await waitWrites(2);
  assert.equal(db.words.get('w1').senses[0].meaning, 'takeの意味');

  // バッジのタイル：注意バッジを付ける。
  const badges = entry('w1').locator('[data-op="badges"]');
  await badges.focus();
  await page.keyboard.press('Enter');
  const badgeDialog = page.getByRole('dialog', { name: 'バッジ' });
  const closeBadgeDialog = badgeDialog.getByRole('button', { name: '閉じる' });
  assert.equal(await badgeDialog.getAttribute('aria-modal'), 'true');
  assert.ok(await closeBadgeDialog.evaluate(el => el === document.activeElement));
  await page.keyboard.press('Shift+Tab');
  assert.ok(await badgeDialog.locator('.edit-tile').last().evaluate(el => el === document.activeElement));
  await page.keyboard.press('Tab');
  assert.ok(await closeBadgeDialog.evaluate(el => el === document.activeElement));
  await page.keyboard.press('Escape');
  assert.equal(await badgeDialog.count(), 0);
  assert.ok(await badges.evaluate(el => el === document.activeElement));

  await page.keyboard.press('Enter');
  const spellingTile = badgeDialog.getByRole('button', { name: 'スペル', exact: true });
  await spellingTile.focus();
  await page.keyboard.press('Space');
  assert.equal(await spellingTile.getAttribute('aria-pressed'), 'true');
  assert.ok(await spellingTile.evaluate(el => el === document.activeElement));
  await page.keyboard.press('Escape');
  assert.equal(await badgeDialog.count(), 0);
  assert.ok(await badges.evaluate(el => el === document.activeElement));
  await save('w1');
  await waitWrites(3);
  assert.equal(db.words.get('w1').spellingCaution, true);
  assert.equal(await entry('w1').locator('.caution-spelling').count(), 1);

  // 品詞バッジをタップしてタイルから選ぶ。
  await entry('w1').locator('.pos-badge').first().click();
  await page.locator('select[data-field=pos]').first().selectOption('他');
  await apply();
  await save('w1');
  await waitWrites(4);
  assert.equal(db.words.get('w1').senses[0].pos, '他');

  // 非表示になった旧解答は、ほかのフレーズを編集しても失われない。
  await dbl(entry('w1').locator('.example-phrase').first());
  assert.equal(await page.locator('[role=dialog] [data-field=answer]').count(), 0);
  assert.equal(await page.locator('.edit-title-mark[data-accent=examples]').textContent(), '●');
  await page.locator('[data-add]').click();
  await page.locator('[data-field=sentence]').last().fill('take a break');
  await apply();
  await save('w1');
  await waitWrites(5);
  assert.deepEqual(db.words.get('w1').examples.map(e => [e.type, e.sentence]), [['phrase', 'take a bus'], ['phrase', 'take a break']]);
  assert.equal(db.words.get('w1').examples[0].answer, 'take');
  // −で削除する。
  await dbl(entry('w1').locator('.example-phrase').first());
  await page.locator('[data-delete]').last().click();
  await apply();
  await save('w1');
  await waitWrites(6);
  assert.equal(db.words.get('w1').examples.length, 1);

  // 空のまま確定した追加行は作らない（保存もしない）。
  await dbl(entry('w1').locator('.sense-meaning').first());
  await page.locator('[data-add]').click();
  await apply();
  assert.equal(await page.locator('[role=dialog]').count(), 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  assert.equal(db.writes.length, 6);
  assert.equal(await entry('w1').locator('.sense-item').count(), 1);

  // 欄のタイルでメモを追加する。
  await entry('w1').locator('[data-op="fields"]').click();
  await page.locator('.edit-tile', { hasText: 'メモ' }).click();
  const memo = page.getByRole('textbox', { name: 'メモ' });
  assert.deepEqual(await memo.evaluate(el => {
    const style = getComputedStyle(el);
    return [el === document.activeElement, style.fontSize, style.boxShadow, style.outlineStyle, style.outlineWidth];
  }), [true, '14px', 'none', 'solid', '1px']);
  await memo.fill('よく使う');
  await memo.press('Control+Enter');
  await save('w1');
  await waitWrites(7);
  assert.equal(db.words.get('w1').notes, 'よく使う');

  // 単語の下の＋で新しい単語を挿入する（位置は並べ替えとして保存）。
  await entry('w1').locator('.headword').click();
  await page.locator('[data-op="insert-word"]').click();
  await page.locator('.edit-inline-input').fill('new');
  await page.locator('.edit-inline-input').press('Enter');
  assert.equal(db.writes.length, 7);
  await page.locator('.is-new-entry [data-op="save-word"]').click();
  await waitWrites(9);
  const created = [...db.words.keys()].find(id => db.words.get(id).spelling === 'new');
  assert.ok(created);
  assert.equal(db.members.get(created).no, 2, '選択した単語の直後に入る');
  assert.equal(db.words.get(created).pronunciation, 'ˈnjuː', '発音記号を自動取得');
  await entry(created).locator('[data-op="fields"]').click();
  await page.getByRole('button', { name: '意味を編集' }).click();
  await page.locator('select[data-field=pos]').selectOption('形');
  await input.fill('新しい');
  await apply();
  await save(created);
  await waitWrites(10);
  assert.equal(db.words.get(created).senses[0].meaning, '新しい');
  assert.equal(await entry('w2').locator('.entry-no').textContent(), '3', '後ろの番号が繰り下がる');

  // メニューから別のSectionへ移動する。
  await dbl(entry('w3').locator('.entry-no'));
  await entry('w3').locator('[data-op="menu"]').click();
  await page.locator('.edit-menu-item', { hasText: '移動' }).click();
  await page.locator('.edit-sheet select').first().selectOption('20');
  await page.locator('.edit-sheet button', { hasText: '移動する' }).click();
  await waitWrites(11);
  assert.equal(db.members.get('w3').sectionId, 20);
  await page.locator('[data-section-entries="20"] .entry[data-word-id="w3"]').waitFor();

  // ドラッグ（マウス）で同じSection内の順番を変える。
  await dbl(entry('w2').locator('.entry-no'));
  await entry('w1').evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - 200));
  const handle = await entry('w2').locator('.entry-no').boundingBox();
  const target = await entry('w1').boundingBox();
  await page.mouse.move(handle.x + 5, handle.y + 5);
  await page.mouse.down();
  await page.mouse.move(handle.x + 5, target.y + 4, { steps: 8 });
  await page.mouse.up();
  await waitWrites(12);
  assert.equal(db.members.get('w2').no, 1);
  assert.equal(await entry('w2').locator('.entry-no').textContent(), '1');

  // Section帯のサブタイトルをダブルタップで編集する。
  await dbl(page.locator('#section-10 .section-subtitle'));
  await page.locator('.edit-inline-input').fill('基本動詞');
  await page.locator('.edit-inline-input').press('Enter');
  await waitWrites(13);
  assert.equal(db.sections.find(s => s.id === 10).subtitle, '基本動詞');

  // Sectionを追加する。
  await page.locator('#section-10 .section-title').click();
  await page.locator('[data-op="add-section-after"]').click();
  await waitWrites(15);
  assert.equal(db.sections.length, 3);
  assert.deepEqual(db.sections.sort((a, b) => a.sortOrder - b.sortOrder).map(s => s.id).slice(0, 2), [10, db.sections.find(s => ![10, 20].includes(s.id)).id]);

  // 目次でSectionをドラッグし、別のChapterの先頭へ移す。
  await page.locator('#menuToggle').click();
  const sectionHandle = await page.locator('[data-section-id="20"] > .edit-toc-handle').boundingBox();
  const firstSection = await page.locator('[data-section-id="10"]').boundingBox();
  await page.mouse.move(sectionHandle.x + 4, sectionHandle.y + 4);
  await page.mouse.down();
  await page.mouse.move(sectionHandle.x + 4, firstSection.y + 3, { steps: 10 });
  await page.mouse.up();
  await waitWrites(16);
  const sorted = [...db.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  assert.equal(sorted[0].id, 20);
  assert.equal(sorted[0].chapterId, 1);
  assert.equal(await page.locator('[data-section-entries="20"] .entry-no').first().textContent(), '1', 'Section順に番号を振り直す');
  await page.locator('#menuToggle').click();

  // 熟語タブ：熟語をダブルタップで編集し、意味を追加する。
  await page.locator('#viewTabIdioms').click();
  const idiom = key => page.locator(`.idiom-entry[data-idiom-key="${key}"]`);
  await idiom('i1').waitFor();
  await dbl(idiom('i1').locator('.sense-meaning'));
  await page.locator('.edit-inline-input').fill('辞書で調べる');
  await page.locator('.edit-inline-input').press('Enter');
  // 熟語も単語と同じく、確定は下書きに留め、「保存」で書き込む。
  assert.equal(db.writes.length, 16, '確定だけでは書き込まない');
  assert.equal(await idiom('i1').locator('.edit-unsaved').count(), 1, '未保存の変更を示す');
  await idiom('i1').locator('[data-op="save-idiom"]').click();
  await waitWrites(17);
  assert.equal(db.idioms.find(i => i.key === 'i1').meanings[0].meaning, '辞書で調べる');
  assert.equal(db.idioms.find(i => i.key === 'i1').meanings[0].id, 's1', '既存の意味のIDを保つ');
  await idiom('i1').locator('[data-op="add-meaning"]').click();
  await page.locator('.edit-inline-input').fill('見上げる');
  await page.locator('.edit-inline-input').press('Enter');
  await idiom('i1').locator('[data-op="save-idiom"]').click();
  await waitWrites(18);
  assert.equal(db.idioms.find(i => i.key === 'i1').meanings.length, 2);
  // 非表示（削除の代わり）。
  await idiom('i2').locator('.headword').click();
  await idiom('i2').locator('[data-op="menu"]').click();
  await page.locator('.edit-menu-item', { hasText: '非表示' }).click();
  await idiom('i2').locator('[data-op="save-idiom"]').click();
  await waitWrites(19);
  assert.equal(db.idioms.find(i => i.key === 'i2').hidden, true);
  assert.equal(await idiom('i3').locator('.entry-no').textContent(), '2', '非表示の熟語には番号を付けない');

  // 派生語の語と意味をまとめて保存する。
  await page.locator('#viewTabList').click();
  db.putDelay = 600;
  const w2 = entry('w2');
  await dbl(w2.locator('.entry-no'));
  await w2.locator('[data-op="fields"]').click();
  await page.getByRole('button', { name: '派生語を編集' }).click();
  const derivatives = page.getByRole('dialog', { name: 'makeの派生語' });
  const rows = derivatives.locator('.collection-row');
  const spelling = rows.first().locator('[data-field=word]');
  assert.equal(await spelling.getAttribute('rows'), '1');
  const height = () => spelling.evaluate(el => el.offsetHeight);
  const oneLine = await height();
  const longSpelling = 'multiword derivative '.repeat(15).trim();
  await spelling.fill(longSpelling);
  assert.ok(await height() > oneLine);
  assert.ok(await spelling.evaluate(el => el.scrollHeight <= el.clientHeight + 1));
  await spelling.fill('maker');
  assert.equal(await height(), oneLine);
  await rows.first().locator('[data-field=pos]').selectOption('名');
  await rows.first().locator('[data-field=meaning]').fill('作る人');
  await derivatives.locator('[data-add]').click();
  await rows.last().locator('[data-field=word]').fill(longSpelling);
  await rows.last().locator('[data-move="-1"]').click();
  assert.equal(await rows.first().locator('[data-field=word]').inputValue(), longSpelling);
  await derivatives.locator('[data-apply]').click();
  assert.equal(db.writes.length, 19);
  await dbl(w2.locator('.derivative-meaning').filter({ hasText: '作る人' }));
  assert.equal(await spelling.inputValue(), longSpelling);
  assert.ok(await height() > oneLine);
  const badgeColor = await w2.locator('.derivative-badge').evaluate(el => getComputedStyle(el).color);
  assert.equal(await derivatives.locator('.edit-title-mark').evaluate(el => getComputedStyle(el).color), badgeColor);
  await rows.first().locator('[data-delete]').click();
  await derivatives.locator('[data-apply]').click();
  await save('w2');
  // 進み具合は利用者の言葉と「n/全体」で示し、完了は満たしたバーで知らせる。
  const progress = w2.locator('.edit-progress', { hasText: '保存しています' });
  await progress.waitFor();
  assert.match(await progress.textContent(), /保存しています…\s*2\/2/);
  assert.equal(await progress.locator('progress').getAttribute('value'), '1.5');
  const done = w2.locator('.edit-progress.is-done');
  await done.waitFor();
  assert.match(await done.textContent(), /保存しました/);
  assert.equal(await done.locator('progress').getAttribute('value'), '1');
  await done.waitFor({ state: 'detached' });
  for (let i = 0; i < 100 && db.words.get('w2').derivatives?.[0]?.meaning !== '作る人'; i++) await page.waitForTimeout(30);
  assert.deepEqual(db.words.get('w2').derivatives.map(d => [d.word, d.meaning]), [['maker', '作る人']]);
  db.putDelay = 0;

  // 「Sectionなし」の枠がない状態で、そこへ単語を移しても表示される。
  assert.equal(await page.locator('[data-section-entries="none"]').count(), 0);
  await w2.locator('[data-op="menu"]').click();
  await page.locator('.edit-menu-item', { hasText: '移動' }).click();
  await page.locator('.edit-sheet select').first().selectOption('');
  await page.locator('.edit-sheet button', { hasText: '移動する' }).click();
  for (let i = 0; i < 100 && db.members.get('w2').sectionId !== null; i++) await page.waitForTimeout(30);
  assert.equal(db.members.get('w2').sectionId, null);
  await page.locator('[data-section-entries="none"] .entry[data-word-id="w2"]').waitFor({ timeout: 5000 });

  // イラストは閲覧ページと同じく、画面に近づくと読み込まれる。
  const illustration = page.locator('.entry[data-word-id="w4"] .entry-illustration img');
  await illustration.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => { const img = document.querySelector('.entry[data-word-id="w4"] .entry-illustration img'); return img?.complete && img.naturalWidth > 0; }, null, { timeout: 5000 });
  assert.equal(await page.locator('.entry[data-word-id="w4"] .entry-illustration.is-loading').count(), 0);

  // Sectionの表示データは閲覧ページと同じ端末キャッシュ（IndexedDB）に入る。
  const cachedKeys = await page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open('vocab-chapter-cache', 1);
    request.onsuccess = () => { const tx = request.result.transaction('snapshots'); const all = tx.objectStore('snapshots').getAllKeys(); all.onsuccess = () => resolve(all.result); };
    request.onerror = () => resolve([]);
  }));
  assert.ok(cachedKeys.includes('/api/lists/crossover-v3/viewer/sections/20'), JSON.stringify(cachedKeys));

  // 閲覧ページへの反映が遅れていても、保存した直後の内容を再読み込み後に表示する。
  const stale = viewerWord(db, 'w4');
  db.frozenPublic = { 20: { words: [{ ...stale, senses: [{ pos: '動', meaning: '古い内容', isPrimary: true }] }] } };
  await dbl(entry('w4').locator('.entry-no'));
  await dbl(entry('w4').locator('.sense-meaning').first());
  await input.fill('学ぶ');
  await apply();
  await save('w4');
  for (let i = 0; i < 100 && db.words.get('w4').senses[0].meaning !== '学ぶ'; i++) await page.waitForTimeout(30);
  await page.reload();
  await entry('w4').waitFor();
  await page.waitForTimeout(300);
  assert.match(await entry('w4').locator('.sense-meaning').first().textContent(), /学ぶ/);
  db.frozenPublic = null;

  // スマホ：タップで選択、ダブルタップで編集する。
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mobile = await phone.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.route(url => !url.href.startsWith(origin), route => route.abort());
  await mobile.goto(`${origin}/setting/index.html`);
  const mobileEntry = mobile.locator('.entry[data-word-id="w4"]');
  await mobileEntry.waitFor();
  const touch = await phone.newCDPSession(mobile);
  const { width, height: screenHeight } = mobile.viewportSize();
  const pinch = async () => {
    await touch.send('Input.synthesizePinchGesture', {
      x: width / 2, y: screenHeight / 2, scaleFactor: 1.6, gestureSourceType: 'touch',
    });
    assert.equal(await mobile.evaluate(() => visualViewport.scale), 1);
  };
  await pinch();
  const shot = async name => { if (process.env.SHOT_DIR) await mobile.screenshot({ path: `${process.env.SHOT_DIR}/${name}.png` }); };
  await shot('1-view');
  await mobileEntry.locator('.headword').tap();
  assert.equal(await mobileEntry.locator('.edit-minus').count(), 0);
  await mobileEntry.locator('.entry-no').tap();
  await mobileEntry.locator('.entry-no').tap();
  assert.ok(await mobileEntry.evaluate(el => el.classList.contains('is-edit-selected')));
  await mobileEntry.scrollIntoViewIfNeeded();
  await shot('2-selected');
  const meaning = mobileEntry.locator('.sense-meaning').first();
  await meaning.tap();
  await meaning.tap();
  const mobileInput = mobile.locator('[role=dialog] [data-field=meaning]').first();
  await mobileInput.waitFor();
  const gaps = await mobile.getByRole('dialog').evaluate(dialog => {
    const box = dialog.getBoundingClientRect();
    return [box.left, innerWidth - box.right, box.top, innerHeight - box.bottom];
  });
  assert.ok(gaps.every(gap => gap >= 15), `モーダルの四辺に余白がある: ${gaps}`);
  assert.ok(Math.abs(gaps[2] - gaps[3]) < 2, 'モーダルを画面の中央に配置する');
  assert.equal(await mobileInput.inputValue(), '学ぶ');
  await mobileInput.fill('勉強する');
  await shot('3-editing');
  assert.equal(await mobileInput.evaluate(el => getComputedStyle(el).fontSize), '14px');
  assert.equal(await mobile.evaluate(() => visualViewport.scale), 1);
  await pinch();
  assert.ok(await mobileInput.evaluate(el => ['gesturestart', 'gesturechange'].every(type =>
    !el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })))), '編集欄でもSafariのピンチ操作を抑制する');
  await mobile.locator('[data-apply]').tap();
  const before = db.writes.length;
  assert.equal(db.words.get('w4').senses[0].meaning, '学ぶ');
  await mobileEntry.locator('[data-op="save-word"]').tap();
  for (let i = 0; i < 100 && db.writes.length === before; i++) await mobile.waitForTimeout(30);
  assert.equal(db.words.get('w4').senses[0].meaning, '勉強する');
  await mobileEntry.locator('[data-op="badges"]').tap();
  await shot('4-badges');
  await mobile.locator('.edit-sheet-close').tap();
  await mobile.locator('#menuToggle').tap();
  await shot('5-contents');
  await phone.close();

  // 端末キャッシュで表示中に入力を始めたら、裏の更新で入力中の単語を置き換えない
  // （古い値のまま確定して、新しい内容を上書きしないため）。
  db.words.get('w1').senses[0].meaning = 'ほかの画面で更新した意味';
  db.publicDelay = 1500;
  await page.evaluate(() => localStorage.removeItem('vocab-edit-recent-saves'));
  await page.reload();
  await entry('w1').waitFor();
  assert.match(await entry('w1').locator('.sense-meaning').first().textContent(), /takeの意味/, 'キャッシュの内容を先に表示');
  await entry('w1').locator('.headword').click();
  await dbl(entry('w1').locator('.sense-meaning').first());
  await input.waitFor();
  await page.waitForTimeout(2000); // 裏の更新が完了する
  await apply();
  await page.waitForTimeout(500);
  assert.equal(db.words.get('w1').senses[0].meaning, 'ほかの画面で更新した意味', '新しい内容を上書きしない');
  db.publicDelay = 0;

  // 公開が遅れて表示がDBより古くても、選択時にDBの最新を起点にするので保存が止まらない。
  {
    const sectionOfW1 = String(db.members.get('w1').sectionId ?? 'none');
    db.frozenPublic = { [sectionOfW1]: { words: ordered(db).filter(([, m]) => String(m.sectionId ?? 'none') === sectionOfW1).map(([id]) => viewerWord(db, id)) } };
    db.words.get('w1').senses = [{ pos: '他', meaning: 'DBで更新した意味', pronunciation: null, is_primary: true }];
    await page.evaluate(() => { localStorage.removeItem('vocab-edit-recent-saves'); indexedDB.deleteDatabase('vocab-chapter-cache'); });
    await page.reload();
    await entry('w1').waitFor();
    assert.doesNotMatch(await entry('w1').textContent(), /DBで更新した意味/, '表示は公開済み（古い）内容');
    await dbl(entry('w1').locator('.entry-no'));
    await page.waitForFunction(() => document.querySelector('.entry[data-word-id="w1"]')?.textContent.includes('DBで更新した意味'));
    await dbl(entry('w1').locator('.sense-meaning').first());
    await page.locator('[role=dialog] [data-add]').click();
    await page.locator('[role=dialog] [data-field=meaning]').last().fill('追加した意味');
    await page.locator('[role=dialog] [data-apply]').click();
    const writesBefore = db.writes.length;
    await entry('w1').locator('[data-op="save-word"]').click();
    for (let i = 0; i < 100 && db.writes.length === writesBefore; i++) await page.waitForTimeout(30);
    await page.waitForFunction(() => !document.querySelector('.entry[data-word-id="w1"].is-saving'));
    assert.equal(await entry('w1').locator('.edit-error').count(), 0, '古い表示を起点にした誤った衝突で止まらない');
    assert.deepEqual(db.words.get('w1').senses.map(x => x.meaning), ['DBで更新した意味', '追加した意味'], 'DBの新しい意味を残す');

    // 本当にほかの画面で同じ項目が変わったときは、理由と「上書きして保存」を示す。
    await dbl(entry('w1').locator('.sense-meaning').first());
    await page.locator('[role=dialog] [data-field=meaning]').first().fill('わたしの意味');
    await page.locator('[role=dialog] [data-apply]').click();
    db.words.get('w1').senses = [{ pos: '他', meaning: 'ほかの画面の意味', pronunciation: null, is_primary: true }];
    await entry('w1').locator('[data-op="save-word"]').click();
    const conflict = entry('w1').locator('.edit-error');
    await conflict.waitFor();
    assert.match(await conflict.textContent(), /ほかの画面で同じ項目が変更されています/);
    assert.equal(db.words.get('w1').senses[0].meaning, 'ほかの画面の意味', '確認なしに上書きしない');
    page.once('dialog', dialog => dialog.accept());
    await conflict.locator('[data-op="overwrite-word"]').click();
    await page.waitForFunction(() => !document.querySelector('.entry[data-word-id="w1"] .edit-error') && !document.querySelector('.entry[data-word-id="w1"].is-saving'));
    assert.deepEqual(db.words.get('w1').senses.map(x => x.meaning), ['わたしの意味', '追加した意味']);
    db.frozenPublic = null;
  }

  // 閲覧ページと同じ上部タブ（索引）・下部のSectionナビ・検索。
  await page.goto(`${origin}/setting/index.html`);
  await entry('w1').waitFor();
  assert.ok(await page.locator('#sectionNav button').count() >= 2, '下部にSectionナビを表示');
  await page.locator('#sectionNav button[data-nav-key="10"]').click();
  await page.waitForFunction(() => { const r = document.getElementById('section-10')?.getBoundingClientRect(); return r && r.top >= 0 && r.top < innerHeight; });
  await page.locator('#viewTabIndex').click();
  await page.locator('.index-entry', { hasText: 'give' }).click();
  await page.waitForFunction(() => document.querySelector('.entry[data-word-id="w3"]')?.classList.contains('is-edit-selected'));
  assert.equal(await page.locator('#viewTabList').getAttribute('aria-selected'), 'true');
  await page.locator('#viewTabIdioms').click();
  await page.locator('#sectionNav button').first().waitFor();
  assert.equal(await page.locator('#sectionNav').getAttribute('aria-label'), '熟語のセクション');
  await page.locator('#settingsToggle').click();
  await page.locator('#searchInput').fill('stud');
  await page.locator('#searchInput').press('Enter');
  await page.locator('.edit-sheet .edit-menu-item', { hasText: 'study' }).click();
  await page.waitForFunction(() => document.querySelector('.entry[data-word-id="w4"]')?.classList.contains('is-edit-selected'));

  // 公開待ちで「最新」の確認が返ってこなくても、公開済みの内容で表示する（白い画面で止まらない）。
  db.hangFresh = true;
  await page.evaluate(() => localStorage.setItem('vocab-editor-pending-publication', 'pending-test'));
  const started = Date.now();
  await page.reload();
  await entry('w1').waitFor({ timeout: 15000 });
  assert.ok(Date.now() - started < 12000, `公開済みの内容ですぐ表示する（${Date.now() - started}ms）`);
  db.hangFresh = false;
  // 本文の読み込み中に打ち切った場合も、公開済みの内容で表示する。
  db.hangFreshBody = true;
  const startedBody = Date.now();
  await page.reload();
  await entry('w1').waitFor({ timeout: 15000 });
  assert.ok(Date.now() - startedBody < 12000, `本文が届かなくても公開済みの内容で表示する（${Date.now() - startedBody}ms）`);
  db.hangFreshBody = false;

  // 辞書の応答は任意。取得済みの発音を尊重し、停止した辞書を待たずに一度だけ登録する。
  const insertDraft = async spelling => {
    await dbl(entry('w1').locator('.entry-no'));
    await page.locator('[data-op="insert-word"]').click();
    await page.locator('.edit-inline-input').fill(spelling);
    await page.locator('.edit-inline-input').press('Enter');
    return page.locator('.is-new-entry');
  };
  db.lookupRequests = [];
  const known = await insertDraft('known-pronunciation');
  await known.locator('[data-op="menu"]').click();
  await page.locator('.edit-menu-item', { hasText: '発音記号を取得' }).click();
  await known.locator('.pron:not(.edit-empty)').waitFor();
  const saveKnown = db.writes.length;
  await known.locator('[data-op="save-word"]').click();
  const knownCard = page.locator('.entry:not(.is-new-entry)', { hasText: 'known-pronunciation' });
  await knownCard.waitFor();
  await knownCard.locator('.edit-progress:not(.is-done)').waitFor({ state: 'hidden' });
  assert.deepEqual(db.lookupRequests, ['known-pronunciation'], '保存時に辞書を取り直さない');
  assert.deepEqual(db.writes.slice(saveKnown).map(w => w.path), ['/api/words', `/api/lists/${LIST}/reorder`]);
  assert.equal(db.writes[saveKnown].body.pronunciation, 'ˈnjuː');

  db.hangLookup = 'slow-dictionary';
  const slow = await insertDraft(db.hangLookup);
  const saveSlow = db.writes.length;
  const startedSlow = Date.now();
  await slow.locator('[data-op="save-word"]').click();
  const slowCard = page.locator('.entry:not(.is-new-entry)', { hasText: db.hangLookup });
  await slowCard.waitFor({ timeout: 10000 });
  await slowCard.locator('.edit-progress:not(.is-done)').waitFor({ state: 'hidden' });
  assert.ok(Date.now() - startedSlow < 10000, '応答が来ない辞書は20秒待たない');
  assert.deepEqual(db.lookupRequests, ['known-pronunciation', 'slow-dictionary'], '辞書を再試行しない');
  assert.deepEqual(db.writes.slice(saveSlow).map(w => w.path), ['/api/words', `/api/lists/${LIST}/reorder`]);
  assert.equal(db.writes[saveSlow].body.pronunciation, null);

  // 熟語：入力済みの新しい熟語は、ほかの欄をキャンセルしても消さない。
  {
    await page.locator('#viewTabIdioms').click();
    const idiomEntry = key => page.locator(`.idiom-entry[data-idiom-key="${key}"]`);
    await idiomEntry('i1').waitFor();
    await idiomEntry('i1').locator('.headword').click();
    await page.locator('[data-op="insert"]').click();
    await page.locator('.edit-inline-input').fill('look into');
    await page.locator('.edit-inline-input').press('Enter');
    await page.locator('.edit-inline-input').fill('調査する');
    await page.locator('.edit-inline-input').press('Enter');
    const draft = page.locator('.idiom-entry.is-new-entry');
    await draft.locator('[data-op="fields"]').click();
    await page.locator('.edit-tile', { hasText: 'メモ' }).click();
    await page.locator('[role=dialog] [data-cancel]').click();
    assert.equal(await draft.count(), 1, 'キャンセルしても下書きの熟語を残す');
    assert.match(await draft.textContent(), /look into/);
    const before = db.idioms.length;
    await draft.locator('[data-op="save-idiom"]').click();
    for (let i = 0; i < 100 && db.idioms.length === before; i++) await page.waitForTimeout(30);
    assert.ok(db.idioms.some(i => i.phrase === 'look into'));

    // 裏で最新を読み終えても、開いているメニューの操作は表示どおりに働く。
    db.idioms.find(i => i.key === 'i3').hidden = true; // ほかの画面で非表示にした（表示はまだ古い）
    db.idiomLatestDelay = 800;
    await idiomEntry('i3').locator('.headword').click();
    await idiomEntry('i3').locator('[data-op="menu"]').click();
    const hideItem = page.locator('.edit-menu-item', { hasText: '非表示にする' });
    await hideItem.waitFor();
    await page.waitForTimeout(1200); // 最新の読み込みがメニューを開いている間に終わる
    await hideItem.click();
    db.idiomLatestDelay = 0;
    await idiomEntry('i3').locator('[data-op="save-idiom"]').click();
    await page.waitForFunction(() => !document.querySelector('.idiom-entry[data-idiom-key="i3"].is-saving'));
    assert.equal(db.idioms.find(i => i.key === 'i3').hidden, true, '「非表示にする」が表示に反する操作をしない');
    await page.locator('#viewTabList').click();
  }

  // 大きな単語帳：下部ナビで遠くのSectionへ移動しても、途中のSectionと画像は読み込まない。
  const big = fixture();
  big.sections = Array.from({ length: 40 }, (_, i) => ({ id: 1000 + i, name: '', subtitle: `S${i + 1}`, description: null, sortOrder: i + 1, chapterId: 1, groupId: null }));
  big.words = new Map(); big.members = new Map();
  for (let i = 0; i < 40 * 20; i++) {
    const id = `b${i}`;
    big.words.set(id, { id, spelling: `word${i}`, pronunciation: '', senses: [{ pos: '名', meaning: `意味${i}`, pronunciation: null, is_primary: true }], derivatives: [], examples: [], tags: {}, derivedFrom: null,
      illustration: i % 20 === 0 ? { url: `/mcp-viewer/api/illustrations/${id}/0a1b2c3d-0000-4000-8000-${String(i).padStart(12, '0')}.png`, meaning: 'x' } : undefined });
    big.members.set(id, { no: i + 1, branch: 0, sectionId: 1000 + Math.floor(i / 20), labelId: null });
  }
  const illustrated = big.words.get('b680');
  illustrated.senses.push({ pos: '名', meaning: '別の意味', is_primary: false });
  illustrated.examples = ['first phrase', 'second phrase'].map((sentence, i) => ({ type: 'example', sentence, translation: String(i), answer: '' }));
  const bigServer = await startServer(big);
  const bigOrigin = `http://localhost:${bigServer.address().port}`;
  const bigContext = await browser.newContext({ viewport: { width: 393, height: 900 } });
  const bigPage = await bigContext.newPage();
  bigPage.on('pageerror', error => errors.push(error.message));
  await bigPage.route(url => !url.href.startsWith(bigOrigin), route => route.abort());
  await bigPage.goto(`${bigOrigin}/setting/index.html`);
  await bigPage.locator('.entry[data-word-id="b0"]').waitFor();
  await bigPage.waitForTimeout(300);
  const readsBefore = big.publicReads;
  big.imageRequests = [];
  await bigPage.locator('#sectionNav button', { hasText: 'Section 35' }).click();
  await bigPage.locator('[data-section-entries="1034"] .entry[data-word-id="b680"]').waitFor();
  await bigPage.waitForTimeout(500);
  const top = await bigPage.locator('#section-1034').evaluate(el => el.getBoundingClientRect().top);
  assert.ok(top >= 0 && top < 200, `移動先のSectionが画面の上にある（${top}）`);
  assert.ok(big.publicReads - readsBefore <= 6, `途中のSectionを読み込まない（${big.publicReads - readsBefore}件）`);
  assert.ok(big.imageRequests.every(url => /\/b(6[0-9]{2}|7[0-9]{2})\//.test(url)), `移動先付近の画像だけを読む：${big.imageRequests.join(',')}`);
  assert.ok(await bigPage.locator('#sectionNav button.active', { hasText: 'Section 35' }).count() === 1, '下部ナビで現在のSectionを強調');
  const card = bigPage.locator('[data-section-entries="1034"] .entry[data-word-id="b680"]');
  await dbl(card.locator('.entry-no'));
  const picture = await card.locator('.entry-illustration').boundingBox();
  for (const control of await card.locator('.edit-illustrated-fields button').all()) {
    const box = await control.boundingBox();
    if (box) assert.ok(box.x + box.width <= picture.x + 1, '編集部品を画像の左に収める');
  }
  await dbl(card.locator('.sense-meaning').first());
  const senses = bigPage.locator('.collection-row');
  await senses.nth(1).locator('[data-move="-1"]').click();
  assert.equal(await senses.first().locator('[data-field=meaning]').inputValue(), '別の意味');
  await bigPage.locator('[data-apply]').click();
  await card.locator('[data-op="reset-word"]').click();
  assert.match(await card.locator('.sense-meaning').first().textContent(), /意味680/);

  await dbl(card.locator('.example-phrase').first());
  const phrases = bigPage.locator('.collection-row');
  const grip = await phrases.nth(1).locator('[data-grip]').boundingBox();
  const destination = await phrases.first().locator('[data-grip]').boundingBox();
  await bigPage.mouse.move(grip.x + 12, grip.y + 12);
  await bigPage.mouse.down();
  await bigPage.mouse.move(destination.x + 16, destination.y + 4, { steps: 8 });
  await bigPage.mouse.up();
  assert.equal(await phrases.first().locator('[data-field=sentence]').inputValue(), 'second phrase');
  await bigPage.locator('[data-apply]').click();
  assert.equal(big.writes.length, 0);
  big.rejectNextWordSave = true;
  await card.locator('[data-op="save-word"]').click();
  const saveError = card.locator('.edit-error');
  await saveError.waitFor();
  assert.match(await saveError.textContent(), /フレーズ.*HTTP 503/);
  assert.equal(big.writes.length, 0);
  assert.match(await card.locator('.example-phrase').first().textContent(), /second phrase/);
  big.loseNextWriteResponse = true;
  await card.locator('[data-op="save-word"]').click();
  await bigPage.waitForFunction(() => !document.querySelector('.entry.is-saving'));
  assert.deepEqual(big.words.get('b680').examples.map(ex => ex.translation), ['1', '0']);
  assert.deepEqual(big.writes.map(write => write.body.updatedCollections), [['examples']]);
  assert.equal(await card.locator('.edit-error').count(), 0);
  assert.match(await bigPage.locator('#editToast').textContent(), /「word680」を保存しました/);
  // Restore an actual scroll position on a fresh page, without a selected editor card.
  const resumeId = 'b690';
  await bigPage.evaluate(async id => {
    const { alignReadingWord } = await import('/shared/reading-position.js');
    alignReadingWord(id);
  }, resumeId);
  await bigPage.waitForFunction(id => JSON.parse(localStorage.getItem('crossover-reading:editor:crossover-v3'))?.id === id, resumeId);
  const reopened = await bigContext.newPage();
  await reopened.route(url => !url.href.startsWith(bigOrigin), route => route.abort());
  await bigPage.close();
  await reopened.goto(`${bigOrigin}/setting/index.html`);
  await reopened.waitForFunction(id => {
    const target = document.querySelector(`[data-section-entries] #word-${id}`);
    const top = Math.max(...[...document.querySelectorAll('.topbar,.subbar')].map(el => el.getBoundingClientRect().bottom));
    return target && Math.abs(target.getBoundingClientRect().top - top) < 3;
  }, resumeId);
  assert.equal(await reopened.locator('.entry.is-edit-selected').count(), 0);
  await bigContext.close();
  bigServer.close();

  assert.deepEqual(errors, []);
  console.log('Viewer-style editor: selection, inline edits, manual save, reset, badges, +/- rows, insertion, moves, drag, section edits and idioms passed');
} finally {
  await browser.close();
  server.close();
}


