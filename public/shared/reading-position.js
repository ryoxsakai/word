function readingTop() {
  const toolbar = document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0;
  const tabs = document.querySelector(".subbar")?.getBoundingClientRect().bottom || 0;
  return Math.max(toolbar, tabs, 0);
}

export function alignReadingWord(id) {
  const entry = document.getElementById(`word-${id}`);
  if (!entry) return;
  const header = readingTop();
  window.scrollBy({ top: entry.getBoundingClientRect().top - header, behavior: "instant" });
}

// Each surface remembers the first word visible below the toolbar.
export function readingPosition(page, listId, root, active) {
  const key = `crossover-reading:${page}:${listId}`;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
  function record() {
    if (!active()) return;
    const rect = root.getBoundingClientRect();
    const header = readingTop();
    const x = Math.floor((Math.max(0, rect.left) + Math.min(innerWidth, rect.right)) / 2);
    const end = Math.min(innerHeight, rect.bottom);
    for (let y = Math.max(0, Math.ceil(header), Math.ceil(rect.top)) + 2; y < end; y += 24) {
      const entry = document.elementFromPoint(x, y)?.closest("article.entry[data-word-id]");
      if (!entry || !root.contains(entry)) continue;
      const id = entry.dataset.wordId;
      if (id.startsWith("__new_")) continue;
      const section = entry.closest("[data-section-entries]")?.dataset.sectionEntries;
      if (section == null) continue;
      const number = entry.dataset.no || entry.querySelector(".entry-no")?.textContent.trim();
      if (saved?.id !== id || saved.section !== section || saved.number !== number || saved.hash !== location.hash) {
        saved = { id, number, section, hash: location.hash };
        try { localStorage.setItem(key, JSON.stringify(saved)); } catch {}
      }
      return;
    }
  }
  return {
    saved,
    start() {
      let timer;
      window.addEventListener("scroll", () => {
        clearTimeout(timer);
        timer = setTimeout(record, 180);
      }, { passive: true });
      window.addEventListener("pagehide", record);
      document.addEventListener("visibilitychange", () => { if (document.hidden) record(); });
    },
  };
}
