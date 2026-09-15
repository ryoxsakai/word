const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// Storage is optional: private browsing, blocked upgrades and quota errors must
// never prevent the viewer from falling back to the network.
export function createChapterStore(indexedDB = globalThis.indexedDB) {
  async function transaction(mode, action) {
    return new Promise(resolve => {
      let db;
      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        db?.close();
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), 200);
      try {
        const request = indexedDB.open("vocab-chapter-cache", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("snapshots");
        request.onerror = request.onblocked = () => finish(null);
        request.onsuccess = () => {
          db = request.result;
          if (done) { db.close(); return; }
          db.onversionchange = () => db.close();
          try {
            const tx = db.transaction("snapshots", mode);
            const result = action(tx.objectStore("snapshots"));
            tx.oncomplete = () => finish(result.result ?? null);
            tx.onerror = tx.onabort = () => finish(null);
          } catch { finish(null); }
        };
      } catch { finish(null); }
    });
  }
  return {
    get: key => transaction("readonly", store => store.get(key)),
    put: (key, value) => transaction("readwrite", store => store.put(value, key)),
  };
}

export function chapterSectionKeys(data, kind) {
  if (kind === "idioms") {
    const visible = new Set((data.entries || []).filter(entry => !entry.hidden).map(entry => String(entry.sectionKey)));
    return (data.chapters || []).map(chapter => chapter.sections.filter(section => visible.has(String(section.key))))
      .find(sections => sections.length)?.map(section => String(section.key)) || [];
  }
  const first = data.sections?.[0];
  return first ? data.sections.filter(section => String(section.chapterKey) === String(first.chapterKey)).map(section => String(section.key)) : [];
}

function validSnapshot(snapshot, kind, now) {
  const data = snapshot?.data;
  if (snapshot?.version !== 1 || !Number.isFinite(snapshot.savedAt) || now - snapshot.savedAt > MAX_AGE || now < snapshot.savedAt) return false;
  if (!data || !Array.isArray(data.chapters) || !Array.isArray(data.cachedSections)) return false;
  if (kind === "viewer" && (!data.list || !Array.isArray(data.words) || !Array.isArray(data.sections))) return false;
  if (kind === "idioms" && (!data.managed || !Array.isArray(data.entries) || data.chapters.some(c => !Array.isArray(c.sections)))) return false;
  const keys = new Set(chapterSectionKeys(data, kind));
  return data.cachedSections.every(section => section && keys.has(String(kind === "viewer" ? section.key : section.sectionKey)) && Array.isArray(kind === "viewer" ? section.words : section.entries));
}

export function createChapterCache({ store = createChapterStore(), now = Date.now, schedule = task => setTimeout(task, 250) } = {}) {
  const pending = new Map();
  const revisions = new Map();
  function refresh(key, path, kind, fetcher) {
    if (pending.has(key)) return pending.get(key);
    const revision = (revisions.get(key) || 0) + 1;
    revisions.set(key, revision);
    const request = fetcher(path, { forceRefresh: true, silent: true });
    pending.set(key, request);
    request.then(data => {
      schedule(async () => {
        try {
          if (kind === "idioms" && !data.managed) return;
          const keys = chapterSectionKeys(data, kind);
          const initial = data.initialSection;
          const initialKey = initial && String(kind === "viewer" ? initial.key : initial.sectionKey);
          const sections = new Map(initial && keys.includes(initialKey) ? [[initialKey, initial]] : []);
          // One atomic snapshot: never combine a new index with old section bodies.
          const save = async () => {
            if (revisions.get(key) !== revision) return;
            await store.put(key, { version: 1, savedAt: now(), data: { ...data, cachedSections: [...sections.values()] } });
          };
          await save();
          let cursor = 0;
          const missing = keys.filter(sectionKey => !sections.has(sectionKey));
          await Promise.all(Array.from({ length: Math.min(2, missing.length) }, async () => {
            while (cursor < missing.length && revisions.get(key) === revision) {
              const sectionKey = missing[cursor++];
              try {
                const section = await fetcher(`${path.split(`/${kind}/index`)[0]}/${kind}/sections/${encodeURIComponent(sectionKey)}`, { forceRefresh: true, silent: true });
                sections.set(sectionKey, section);
              } catch { /* Keep successful sections; the normal loader can retry missing ones. */ }
            }
          }));
          await save();
        } catch { /* Caching must not affect normal reading. */ }
      });
    }, () => {}).finally(() => { if (pending.get(key) === request) pending.delete(key); });
    return request;
  }
  return {
    async load(key, path, kind, fetcher, { forceRefresh = false } = {}) {
      if (!forceRefresh) {
        let saved;
        try { saved = await store.get(key); } catch { /* Network fallback. */ }
        if (validSnapshot(saved, kind, now())) {
          void refresh(key, path, kind, fetcher).catch(() => {});
          return saved.data;
        }
      }
      return refresh(key, path, kind, fetcher);
    },
  };
}
