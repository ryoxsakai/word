import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.location = { hostname: 'localhost' };
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
const snapshots = new Map();
const writes = [];
globalThis.indexedDB = {
  open() {
    const request = {
      result: {
        close() {},
        transaction(_name, mode) {
          const tx = { objectStore() {
            return {
              get: key => ({ result: snapshots.get(key) }),
              put: (value, key) => {
                writes.push(() => { snapshots.set(key, value); tx.oncomplete(); });
                return {};
              },
            };
          } };
          if (mode === 'readonly') queueMicrotask(() => tx.oncomplete());
          return tx;
        },
      },
    };
    queueMicrotask(() => request.onsuccess());
    return request;
  },
};

const { api, onPublication, PENDING_KEY } = await import('../../public/setting/edit/api.js');
const { loadSectionData, recentSaved, rememberSaved } = await import('../../public/setting/edit/section-cache.js');
const load = id => loadSectionData({
  kind: 'word',
  publicPath: `/lists/demo/viewer/sections/${id}`,
  editorPath: `/lists/demo/editor/sections/${id}?full=1`,
});

test('cold first section can render before a pending IndexedDB write completes', async () => {
  const data = { words: [{ id: 'public' }] };
  globalThis.fetch = async () => Response.json(data);
  const atNextTurn = new Promise(resolve => setImmediate(() => resolve('still blocked')));
  const result = await Promise.race([load(1), atNextTurn]);
  try {
    assert.deepEqual(result, data);
    assert.equal(writes.length, 1);
    assert.equal(snapshots.size, 0);
  } finally { writes.splice(0).forEach(complete => complete()); }
  assert.deepEqual(snapshots.get('/api/lists/demo/viewer/sections/1')?.data, data);
});

test('editor-only fallback is rendered but not put in the shared viewer cache', async () => {
  const data = { words: [{ id: 'editor-only' }] };
  const routes = [];
  globalThis.fetch = async url => {
    routes.push(url);
    if (url.includes('/viewer/')) return Response.json({}, { status: 503 });
    return Response.json(data);
  };
  const completeWithoutWrite = await Promise.race([load(2), new Promise(resolve => setImmediate(() => resolve('still blocked')))]);
  try {
    assert.deepEqual(completeWithoutWrite, data);
    assert.deepEqual(routes, ['/api/lists/demo/viewer/sections/2', '/api/lists/demo/editor/sections/2?full=1']);
    assert.equal(writes.length, 0);
    assert.equal(snapshots.has('/api/lists/demo/viewer/sections/2'), false);
  } finally { writes.splice(0).forEach(complete => complete()); }
});

for (const [id, kind, stalledAt] of [[3, 'word', 'headers'], [4, 'idiom', 'body']]) {
  test(`a cold ${kind} section falls back after the public ${stalledAt} stall`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const publicPath = `/lists/demo/viewer/${kind}/${id}`;
    const editorPath = `/lists/demo/editor/${kind}/${id}?full=1`;
    const data = { [kind === 'word' ? 'words' : 'entries']: [{ id: 'editor-only' }] };
    const requests = [];
    let publicSignal;
    let reading = false;
    globalThis.fetch = async (url, { signal } = {}) => {
      requests.push(url);
      if (url === `/api${editorPath}`) return Response.json(data);
      assert.equal(url, `/api${publicPath}`);
      publicSignal = signal;
      const waitForAbort = () => {
        reading = true;
        return new Promise((_, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      };
      return stalledAt === 'headers' ? waitForAbort() : { ok: true, json: waitForAbort };
    };
    const pending = loadSectionData({ kind, publicPath, editorPath });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(reading, true);
    assert.deepEqual(requests, [`/api${publicPath}`]);

    t.mock.timers.tick(4999);
    assert.notEqual(publicSignal?.aborted, true);
    assert.equal(requests.length, 1);
    t.mock.timers.tick(1);

    const result = await Promise.race([pending, new Promise(resolve => setImmediate(() => resolve('still blocked')))]);
    assert.deepEqual(result, data);
    assert.equal(publicSignal.aborted, true);
    assert.deepEqual(requests, [`/api${publicPath}`, `/api${editorPath}`]);
    assert.equal(writes.length, 0);
    assert.equal(snapshots.has(`/api${publicPath}`), false);
  });
}

test('a warm section returns immediately and keeps the public snapshot when its refresh falls back', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const publicPath = '/lists/demo/viewer/sections/5';
  const editorPath = '/lists/demo/editor/sections/5?full=1';
  const cached = { words: [{ id: 'cached-public' }] };
  const snapshot = { version: 1, savedAt: Date.now(), data: cached };
  snapshots.set(`/api${publicPath}`, snapshot);
  const editorData = { words: [{ id: 'editor-only' }] };
  const refreshed = [];
  let publicSignal;
  let fallbackReads = 0;
  globalThis.fetch = async (url, { signal } = {}) => {
    if (url === `/api${editorPath}`) {
      fallbackReads++;
      return Response.json(editorData);
    }
    assert.equal(url, `/api${publicPath}`);
    publicSignal = signal;
    return new Promise((_, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  };

  try {
    const pending = loadSectionData({ kind: 'word', publicPath, editorPath, onFresh: data => refreshed.push(data) });
    const result = await Promise.race([pending, new Promise(resolve => setImmediate(() => resolve('still blocked')))]);
    assert.deepEqual(result, cached);
    assert.equal(fallbackReads, 0);
    assert.deepEqual(refreshed, []);

    t.mock.timers.tick(5000);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fallbackReads, 1);
    assert.equal(publicSignal.aborted, true);
    assert.deepEqual(refreshed, [editorData]);
    assert.equal(writes.length, 0);
    assert.deepEqual(snapshots.get(`/api${publicPath}`), snapshot);
  } finally { snapshots.delete(`/api${publicPath}`); }
});


for (const supersededBy of ['same-tab save', 'other-tab save', 'other tab confirmed publication']) {
  test(`an old publication check cannot complete a newer generation: ${supersededBy}`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let now = 10000;
    t.mock.method(Date, 'now', () => now);
    storage.clear();
    const statuses = [];
    const polls = [];
    const nextTurn = () => new Promise(resolve => setImmediate(resolve));
    const unsubscribe = onPublication(status => statuses.push(status.state));
    const response = { id: 'edited-word' };
    let saves = 0;
    globalThis.fetch = async (url, options) => {
      if (options.method === 'PUT') {
        saves++;
        return Response.json(response, { headers: { 'x-editor-snapshots': 'r2' } });
      }
      assert.equal(url, '/api/lists?editorFresh=1');
      assert.equal(options.method, 'GET');
      return new Promise((resolve, reject) => polls.push({ resolve, reject }));
    };
    try {
      await api('/words/earlier', { method: 'PUT', body: response });
      const earlier = storage.get(PENDING_KEY);
      assert.ok(earlier);
      t.mock.timers.tick(8000);
      await nextTurn();
      assert.equal(polls.length, 1);
      if (supersededBy === 'same-tab save') {
        await api('/words/later', { method: 'PUT', body: response });
        t.mock.timers.tick(8000); // A second watch must not start a concurrent read.
        await nextTurn();
      } else if (supersededBy === 'other-tab save') {
        now += 11 * 60 * 1000; // Old response expired, but the new generation still has its full budget.
        storage.set(PENDING_KEY, 'new-marker-from-another-tab');
      } else {
        storage.delete(PENDING_KEY);
      }
      const latestMarker = storage.get(PENDING_KEY);
      assert.notEqual(latestMarker, earlier);
      rememberSaved('word', 'edited-word', response);
      if (supersededBy === 'other-tab save') polls[0].reject(new Error('old network failure'));
      else polls[0].resolve(Response.json([]));
      await nextTurn();
      assert.deepEqual(statuses, latestMarker ? ['publishing'] : ['publishing', 'idle']);
      assert.deepEqual(recentSaved('word', 'edited-word'), response);
      assert.equal(polls.length, 1);
      assert.equal(storage.get(PENDING_KEY), latestMarker);

      t.mock.timers.tick(15000);
      await nextTurn();
      if (!latestMarker) {
        assert.equal(polls.length, 1);
        return;
      }
      assert.equal(polls.length, 2);
      if (supersededBy === 'other-tab save') {
        // The newer marker did not inherit the old wait budget.
        polls[1].resolve(Response.json({ code: 'editor_snapshot_pending' }, { status: 409 }));
        await nextTurn();
        assert.deepEqual(statuses, ['publishing']);
        t.mock.timers.tick(15000);
        await nextTurn();
        assert.equal(polls.length, 3);
      }
      polls.at(-1).resolve(Response.json([]));
      await nextTurn();
      assert.deepEqual(statuses, ['publishing', 'published']);
      assert.equal(recentSaved('word', 'edited-word'), null);
      assert.equal(storage.has(PENDING_KEY), false);
      assert.equal(saves, supersededBy === 'same-tab save' ? 2 : 1);
    } finally {
      unsubscribe();
      storage.clear();
    }
  });
}
