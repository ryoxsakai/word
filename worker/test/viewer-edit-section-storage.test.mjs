import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.location = { hostname: 'localhost' };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
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

const { loadSectionData } = await import('../../public/setting/edit/section-cache.js');
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
