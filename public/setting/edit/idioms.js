// 閲覧型編集ページ：熟語の表示と編集（閲覧ページの熟語タブと同じ見た目）。
import { renderIdiomEntry } from "../../viewer/idiom-entry.js";
import { VIEWER_API_BASE } from "../../shared/config.js";
import { orderIdiomLabels } from "../../shared/idioms.js";
import { createIdiomReferenceResolver } from "../../shared/idiom-references.js";
import { groupIdiomEntries } from "../../shared/idioms.js";
import { createAutoCrossRefRenderer } from "../../shared/markup.js";
import { changedKeys, clone, same, mergeDraft, idiomDraft, idiomPayload } from "../table-data.js";
import { api } from "./api.js";
import { loadSectionData, rememberSaved, recentSaved } from "./section-cache.js";
import { h, toast, sheet, closeSheet, tiles, menuList, inlineEditor, finishInlineEditing, hasActiveInlineIn, isInlineEditing, onDoubleActivate, sortable } from "./ui.js";
import { hierarchyIcon } from "./icons.js";
import { createNavigator } from "./navigation.js";

const FIELDS = [["synonyms", "同義語", "synonym"], ["antonyms", "対義語", "antonym"], ["notes", "メモ", "memo"]];

export function createIdiomEditor({ root, listId, onStructureChange }) {
  const S = {
    chapters: [], order: [], rows: new Map(), loaded: new Set(), loading: new Map(),
    selectedKey: null, selectedSection: null, numbers: new Map(), observer: null, tempId: 0,
    resolve: () => ({ found: false }), renderNotes: null, wordNames: new Map(),
  };
  const base = `/lists/${encodeURIComponent(listId)}`;
  const sections = () => S.chapters.flatMap(chapter => chapter.sections.map(section => ({ ...section, chapterKey: chapter.key })));
  const sectionOf = key => sections().find(s => s.key === key);
  const sectionIndex = key => sections().findIndex(s => s.key === key);
  const labelRank = (sectionKey, labelKey) => {
    const labels = sectionOf(sectionKey)?.labels || [];
    const index = labels.findIndex(l => l.key === labelKey);
    return index < 0 ? labels.length : index;
  };
  function normalize() {
    const ranked = S.order.map((item, index) => ({ item, rank: [sectionIndex(item.sectionKey), labelRank(item.sectionKey, item.labelKey), index] }));
    ranked.sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2]);
    S.order = ranked.map(r => r.item);
    // 閲覧ページと同じく、非表示の熟語には番号を付けない。
    S.numbers = new Map();
    let n = 0;
    for (const item of S.order) if (!item.hidden) S.numbers.set(item.key, String(++n));
  }
  const sectionNumbers = () => {
    const visible = new Set(S.order.filter(i => !i.hidden).map(i => i.sectionKey));
    let n = 0;
    return new Map(sections().map(s => [s.key, visible.has(s.key) ? ++n : null]));
  };

  async function load() {
    root.innerHTML = '<div class="loading-msg"><span class="loading-label">熟語を読み込み中...</span></div>';
    const [data, wordIndex] = await Promise.all([api(`${base}/editor/idioms`), api(`${base}/editor/index`).catch(() => ({ words: [] }))]);
    S.chapters = data.chapters || [];
    S.order = (data.entries || []).map(e => ({ key: e.key, phrase: e.phrase, sectionKey: e.sectionKey, labelKey: e.labelKey ?? null, hidden: !!e.hidden, alternateForms: e.alternateForms || [] }));
    S.wordNames = new Map((wordIndex.words || []).map(w => [w.id, w.spelling]));
    const wordMap = new Map((wordIndex.words || []).map(w => [w.spelling.toLowerCase(), { found: true, id: w.id, no: w.displayNo }]));
    S.resolve = createIdiomReferenceResolver(groupIdiomEntries(data.entries || [], data.chapters), name => wordMap.get(name.toLowerCase()) || { found: false });
    const names = [...wordMap.keys(), ...(S.resolve.phrases || [])];
    S.renderNotes = createAutoCrossRefRenderer(names, { resolve: S.resolve, idiomReferences: S.resolve.phrases || [] });
    normalize();
    renderShells();
    onStructureChange?.();
  }

  async function loadSection(key) {
    if (S.loaded.has(key)) return;
    if (S.loading.has(key)) return S.loading.get(key);
    const promise = (async () => {
      let data;
      try {
        data = await loadSectionData({
          kind: "idiom",
          publicPath: `${base}/idioms/sections/${encodeURIComponent(key)}`,
          editorPath: `${base}/editor/idiom-sections/${encodeURIComponent(key)}`,
          onFresh: fresh => applyFresh(key, fresh.entries || []),
        });
      } catch (error) { if (error.status !== 404 && !/HTTP 404/.test(error.message)) throw error; data = { entries: [] }; }
      const byKey = new Map((data.entries || []).map(e => [e.key, recentSaved("idiom", e.key) || e]));
      const members = S.order.filter(i => i.sectionKey === key && !S.rows.has(i.key));
      if (members.some(i => !byKey.has(i.key))) {
        const latest = await api(`${base}/idioms/sections/${encodeURIComponent(key)}`);
        for (const entry of latest.entries || []) if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
      }
      for (const item of members) if (byKey.has(item.key)) S.rows.set(item.key, makeRow(byKey.get(item.key)));
      S.loaded.add(key);
      renderSection(key);
    })();
    S.loading.set(key, promise);
    try { await promise; }
    catch (error) {
      const entries = root.querySelector(`[data-idiom-section-entries="${CSS.escape(key)}"]`);
      if (entries) entries.innerHTML = `<div class="section-load-error">読み込みに失敗しました: ${h(error.message)} <button type="button" data-op="retry-section" data-key="${h(key)}">再試行</button></div>`;
    } finally { S.loading.delete(key); }
  }
  function applyFresh(key, entries) {
    for (const entry of entries) {
      const row = S.rows.get(entry.key);
      if (!row || row.saving || row.isNew || row.error || !same(row.base, row.draft) || recentSaved("idiom", entry.key) || hasActiveInlineIn(entryEl(entry.key))) continue;
      const draft = idiomDraft(entry);
      if (same(draft, row.base)) continue;
      row.raw = entry; row.base = draft; row.draft = clone(draft);
      rerender(entry.key);
    }
  }
  function makeRow(raw, isNew = false) {
    const draft = idiomDraft(raw);
    return { key: raw.key, raw, base: clone(draft), draft, isNew, showFields: new Set(), saving: false, queued: false, error: "" };
  }
  function viewOf(row) {
    const d = row.draft;
    return {
      ...row.raw, key: row.key, phrase: d.phrase, hidden: d.hidden,
      alternateForms: d.alternateForms.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
      synonyms: d.synonyms || "", antonyms: d.antonyms || "", notes: d.notes || "",
      meanings: d.meanings.map((m, index) => ({ ...m, no: index + 1, refs: m.wordIds.map(wordId => ({ wordId })) })),
      senseCount: d.meanings.length, no: S.numbers.get(row.key) || "—",
    };
  }

  // ---- 描画 ----
  function renderShells() {
    S.observer?.disconnect();
    const numbers = sectionNumbers();
    const parts = [];
    S.chapters.forEach((chapter, chapterIndex) => {
      chapter.sections.forEach((section, index) => {
        const heading = index === 0 ? `<div class="chapter-divider" role="heading" aria-level="2">${hierarchyIcon("chapter")}<div class="chapter-title-row"><span class="chapter-title">Chapter ${chapterIndex + 1}</span><span class="chapter-subtitle">${h(chapter.subtitle || "")}</span></div></div>` : "";
        const startsGroup = section.groupKey && section.groupKey !== chapter.sections[index - 1]?.groupKey;
        const groupHeading = startsGroup ? `<div class="group-divider" role="heading" aria-level="3">${hierarchyIcon("group")}<div class="group-title-row"><span class="group-title">${h(section.groupSubtitle ? "Group" : "")}</span><span class="group-subtitle">${h(section.groupSubtitle || "")}</span></div></div>` : "";
        const selected = S.selectedSection === section.key;
        const number = numbers.get(section.key);
        const count = S.order.filter(i => i.sectionKey === section.key).length;
        parts.push(`<section class="section-group chapter-tone-${(chapterIndex % 6) + 1}${index === 0 ? " has-chapter-divider" : ""}${startsGroup ? " has-group-divider" : ""}" data-idiom-section-group="${h(section.key)}">${heading}${groupHeading}
          <div class="section-divider${selected ? " is-edit-selected" : ""}" id="idiom-section-${h(section.key)}" data-header="idiom-section" data-key="${h(section.key)}" role="heading" aria-level="4">${hierarchyIcon("section")}<div class="section-title-row"><span class="section-title">${number ? `Section ${number}` : "Section（表示なし）"}</span><span class="section-subtitle" data-edit-header="subtitle">${h(section.subtitle || "")}</span></div>${selected ? `<div class="edit-header-tools"><button type="button" data-op="section-move" data-key="${h(section.key)}" data-dir="-1" aria-label="上へ"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button><button type="button" data-op="section-move" data-key="${h(section.key)}" data-dir="1" aria-label="下へ"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button><button type="button" data-op="add-first" data-key="${h(section.key)}"><i class="fa-solid fa-plus" aria-hidden="true"></i>熟語を追加</button></div>` : ""}</div>
          <div class="idiom-entries" data-idiom-section-entries="${h(section.key)}" aria-busy="true" style="min-height:${Math.min(900, Math.max(80, count * 40))}px"><div class="idiom-loading-row"><span class="skeleton-headword skeleton-line"></span><span class="skeleton-meaning skeleton-line"></span></div></div>
        </section>`);
      });
    });
    root.innerHTML = parts.join("") || '<p class="index-empty">熟語はありません。</p>';
    for (const key of S.loaded) renderSection(key);
    observeSections();
  }
  function observeSections() {
    S.observer?.disconnect();
    if (S.navPaused) return;
    const targets = root.querySelectorAll('[data-idiom-section-entries][aria-busy="true"]');
    if (!("IntersectionObserver" in window)) { targets.forEach(t => loadSection(t.dataset.idiomSectionEntries)); return; }
    S.observer = new IntersectionObserver(items => {
      for (const item of items) if (item.isIntersecting) { S.observer.unobserve(item.target); loadSection(item.target.dataset.idiomSectionEntries); }
    }, { rootMargin: "1000px 0px" });
    targets.forEach(t => S.observer.observe(t));
  }
  function entryHtml(row) {
    const selected = S.selectedKey === row.key;
    let html = renderIdiomEntry(viewOf(row), VIEWER_API_BASE || location.origin, {
      resolve: S.resolve, renderNotes: S.renderNotes, edit: { selected, showFields: selected ? row.showFields : new Set() },
    });
    const classes = [row.saving ? "is-saving" : "", row.error ? "has-edit-error" : "", row.isNew ? "is-new-entry" : ""].filter(Boolean).join(" ");
    if (classes) html = html.replace('class="entry idiom-entry', `class="entry idiom-entry ${classes}`);
    if (row.saving || row.saveDone) html = html.replace(/<\/article>\s*$/, `${progressHtml(row)}</article>`);
    return html;
  }
  // 単語と同じ保存の進み具合（DESIGN.md）。
  function progressHtml(row) {
    if (row.saveDone) return `<div class="edit-progress is-done" role="status"><span class="edit-progress-label">✓ 保存しました</span><progress max="1" value="1" aria-label="保存しました"></progress></div>`;
    const { steps, index } = row.saveProgress;
    return `<div class="edit-progress" role="status"><span class="edit-progress-label">${h(steps[index])}…</span><span class="edit-progress-count">${index + 1}/${steps.length}</span><progress max="${steps.length}" value="${index + 0.5}" aria-label="${h(steps[index])}"></progress></div>`;
  }
  function renderSection(key) {
    const container = root.querySelector(`[data-idiom-section-entries="${CSS.escape(key)}"]`);
    if (!container || !S.loaded.has(key)) return;
    const section = sectionOf(key);
    let previous = null;
    const parts = [];
    for (const item of S.order.filter(i => i.sectionKey === key)) {
      const label = (section.labels || []).find(l => l.key === item.labelKey);
      if (label && label.key !== previous) parts.push(`<div class="label-divider" role="heading" aria-level="5">${hierarchyIcon("label")}<span class="label-title">${h(label.name)}</span></div>`);
      previous = label?.key || null;
      const row = S.rows.get(item.key);
      if (row) parts.push(entryHtml(row));
    }
    if (!parts.length) parts.push(`<button type="button" class="edit-add-bar" data-op="add-first" data-key="${h(key)}"><i class="fa-solid fa-plus" aria-hidden="true"></i> 熟語を追加</button>`);
    container.innerHTML = parts.join("");
    container.removeAttribute("style");
    container.setAttribute("aria-busy", "false");
    decorate();
  }
  const entryEl = key => root.querySelector(`.idiom-entry[data-idiom-key="${CSS.escape(key)}"]`);
  function rerender(key) {
    const el = entryEl(key), row = S.rows.get(key);
    if (!el || !row) return;
    if (hasActiveInlineIn(el)) { el.classList.toggle("is-saving", row.saving); return; }
    const template = document.createElement("template");
    template.innerHTML = entryHtml(row).trim();
    el.replaceWith(template.content.firstElementChild);
    if (S.selectedKey === key) decorate();
  }
  function refreshNumbers() {
    for (const article of root.querySelectorAll(".idiom-entry[data-idiom-key]")) {
      const no = article.querySelector(".entry-no");
      if (no) no.textContent = S.numbers.get(article.dataset.idiomKey) || "—";
    }
  }
  function decorate() {
    const key = S.selectedKey;
    const article = key && entryEl(key);
    const row = key && S.rows.get(key);
    if (!article || !row || article.dataset.decorated) return;
    article.dataset.decorated = "1";
    const minus = (op, label, attrs) => `<button type="button" class="edit-minus" data-op="${op}" ${attrs} aria-label="${h(label)}">−</button>`;
    article.querySelector(".entry-no")?.classList.add("edit-drag-handle");
    article.querySelector(".entry-head")?.insertAdjacentHTML("beforeend", `<span class="edit-head-tools"><button type="button" class="edit-chip" data-op="fields"><i class="fa-solid fa-table-list" aria-hidden="true"></i>欄</button><button type="button" class="edit-chip" data-op="menu" aria-label="その他の操作"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i>その他</button></span>`);
    for (const sense of article.querySelectorAll(".idiom-sense[data-meaning-index]")) {
      const index = Number(sense.dataset.meaningIndex);
      const refs = row.draft.meanings[index]?.wordIds || [];
      if (refs.length) sense.querySelector(".sense-line")?.insertAdjacentHTML("beforeend", `<span class="edit-ref-note" title="単語参照">→ ${h(refs.map(id => S.wordNames.get(id) || "登録済みの参照").join("、"))}</span>`);
      if (row.draft.meanings.length > 1) sense.querySelector(".sense-line")?.insertAdjacentHTML("beforeend", minus("remove-meaning", "この意味を削除", `data-index="${index}"`));
    }
    const card = article.querySelector(".entry-card");
    card?.querySelector(".entry-notes")?.insertAdjacentHTML("beforebegin", `<div class="edit-row-actions"><button type="button" class="edit-add-inline" data-op="add-meaning"><i class="fa-solid fa-plus" aria-hidden="true"></i>意味</button></div>`);
    for (const block of article.querySelectorAll(".notes-block[data-field]")) block.insertAdjacentHTML("beforeend", minus("remove-field", "この欄を削除", `data-field="${block.dataset.field}"`));
    const dirty = row.isNew || !same(row.base, row.draft);
    article.querySelector(".entry-body").inert = row.saving;
    article.querySelector(".entry-body")?.insertAdjacentHTML("beforeend", `<div class="edit-word-actions">${dirty && !row.saving ? '<span class="edit-unsaved">未保存の変更があります</span>' : ""}<button type="button" class="edit-btn" data-op="reset-idiom"${dirty ? "" : " disabled"}>変更を取り消す</button><button type="button" class="edit-btn is-primary" data-op="save-idiom"${dirty ? "" : " disabled"}>保存</button></div>`);
    if (row.error) article.querySelector(".entry-body")?.insertAdjacentHTML("beforeend", `<div class="edit-error" role="alert"><p>${h(row.error)}</p><div class="edit-error-actions">${row.conflict
      ? '<button type="button" class="edit-btn" data-op="reload-idiom">最新を読み込む</button><button type="button" class="edit-btn is-primary" data-op="overwrite-idiom">上書きして保存</button>'
      : '<button type="button" class="edit-btn is-primary" data-op="retry-save">もう一度保存</button>'}</div></div>`);
    root.querySelectorAll(".edit-insert-word").forEach(el => el.remove());
    if (!row.isNew) article.insertAdjacentHTML("afterend", `<button type="button" class="edit-add-bar edit-insert-word" data-op="insert" data-after="${h(key)}"><i class="fa-solid fa-plus" aria-hidden="true"></i> ここに熟語を追加</button>`);
  }
  function select(key) {
    if (S.selectedKey === key) return;
    finishInlineEditing();
    const previous = S.selectedKey;
    S.selectedKey = key;
    root.querySelectorAll(".edit-insert-word").forEach(el => el.remove());
    if (S.selectedSection) { S.selectedSection = null; const y = scrollY; renderShells(); scrollTo(0, y); return; }
    if (previous) rerender(previous);
    if (key) rerender(key);
  }

  // ---- 編集・保存 ----
  let undoEntry = null;
  function offer(message) {
    const entry = undoEntry;
    toast(message, entry ? { undo: () => { if (undoEntry === entry) { undoEntry = null; entry(); } } } : {});
  }
  // 内容の変更は下書きに入り、「保存」で書き込む（単語と同じ。DESIGN.md）。並べ替え・移動はすぐ保存する。
  function mutate(row, change) {
    const before = clone(row.draft);
    change(row.draft);
    rerender(row.key);
    return !same(before, row.draft);
  }
  async function latestEntry(row) {
    const data = await api(`${base}/idioms/sections/${encodeURIComponent(row.base.sectionKey)}`);
    return (data.entries || []).find(e => e.key === row.key);
  }
  // 選択・タップした時点でDBの最新を読み、未編集なら起点を差し替える（単語と同じ）。
  function freshen(row) {
    if (!row || row.isNew || row.fresh || row.freshening) return;
    row.freshening = latestEntry(row).then(latest => {
      if (!latest || row.saving || isInlineEditing() || !same(row.base, row.draft)) return;
      const next = idiomDraft(latest);
      row.fresh = true;
      if (same(next, row.base)) return;
      row.raw = latest; row.base = next; row.draft = clone(next);
      rerender(row.key);
    }).catch(() => {}).finally(() => { row.freshening = null; });
  }
  function resetIdiom(row) {
    if (row.isNew) return discard(row);
    row.draft = clone(row.base);
    row.showFields.clear();
    row.error = ""; row.conflict = false;
    rerender(row.key);
  }
  function showStep(row, steps, index) {
    row.saving = true; row.saveDone = false;
    row.saveProgress = { steps, index };
    rerender(row.key);
  }
  async function queueSave(row, message = "保存しました", { force = false } = {}) {
    if (row.isNew && !row.draft.meanings.some(m => m.meaning.trim())) return toast("意味を入力してください", { tone: "error" });
    if (!row.draft.phrase.trim()) return toast("熟語を入力してください", { tone: "error" });
    if (row.saving) return;
    row.error = ""; row.conflict = false;
    const steps = row.isNew ? ["熟語を登録しています", "並び順を保存しています"] : ["最新の内容を確認しています", "保存しています"];
    showStep(row, steps, 0);
    try {
      {
        const sent = clone(row.draft);
        let latest = {};
        if (!row.isNew) {
          latest = await latestEntry(row);
          if (!latest) throw Object.assign(new Error("この熟語は別の画面で移動されています。再読み込みしてください。"), { removed: true });
        }
        const cleaned = { ...sent, meanings: sent.meanings.filter(m => m.meaning.trim()) };
        let merged;
        if (row.isNew) merged = cleaned;
        else if (force) {
          merged = idiomDraft(latest);
          for (const key of changedKeys(row.base, cleaned)) merged[key] = clone(cleaned[key]);
        } else {
          try { merged = mergeDraft(row.base, cleaned, idiomDraft(latest)); }
          catch (error) { throw Object.assign(error, { conflict: true, message: "この熟語は、ほかの画面で同じ項目が変更されています。" }); }
        }
        if (!row.isNew) showStep(row, steps, 1);
        const payload = idiomPayload(merged, row.isNew ? {} : latest);
        const result = await api(`${base}/idioms`, { method: "PUT", body: payload });
        const raw = { ...row.raw, ...payload, key: result.id, meanings: payload.meanings.map(s => ({ ...s, refs: s.wordIds.map(wordId => ({ wordId })) })) };
        delete raw.id;
        if (row.isNew) {
          const temp = row.key;
          S.rows.delete(temp);
          row.key = result.id; row.isNew = false;
          S.rows.set(row.key, row);
          const item = S.order.find(i => i.key === temp);
          item.key = row.key;
          if (S.selectedKey === temp) S.selectedKey = row.key;
          showStep(row, steps, 1);
          await saveOrder();
          renderSection(row.draft.sectionKey);
        }
        row.raw = raw;
        row.base = idiomDraft(raw);
        rememberSaved("idiom", row.key, raw);
        if (same(row.draft, sent)) row.draft = clone(row.base);
        const item = S.order.find(i => i.key === row.key);
        if (item) { item.phrase = row.base.phrase; item.hidden = row.base.hidden; }
        row.fresh = true;
      }
      row.saving = false; row.saveDone = true;
      normalize();
      rerender(row.key);
      refreshNumbers();
      clearTimeout(row.saveDoneTimer);
      row.saveDoneTimer = setTimeout(() => { row.saveDone = false; rerender(row.key); }, 1600);
      undoEntry = null;
      offer(message);
    } catch (error) {
      row.saving = false;
      row.error = error.conflict ? error.message : `保存できませんでした：${error.message}`;
      row.conflict = !!error.conflict;
      rerender(row.key);
      toast(row.error, { tone: "error", duration: 7000 });
    }
  }
  async function saveOrder() {
    const entries = S.order.filter(i => !String(i.key).startsWith("__new_")).map(i => ({ id: i.key, sectionKey: i.sectionKey }));
    await api(`${base}/idioms/reorder`, { method: "POST", body: { entries } });
  }
  function getPath(draft, path) { return path.split(".").reduce((v, k) => v?.[k], draft) ?? ""; }
  function setPath(draft, path, value) {
    const keys = path.split("."); const last = keys.pop();
    keys.reduce((o, k) => o[k], draft)[last] = value;
  }
  function editField(row, el) {
    const path = el.dataset.edit;
    const multiline = path === "notes" || path === "alternateForms";
    inlineEditor(el, String(getPath(row.draft, path)), {
      multiline,
      placeholder: path === "alternateForms" ? "別形（1行に1つ）" : el.classList.contains("edit-empty") ? el.textContent : "",
      onCommit: value => {
        const next = multiline ? value.replace(/\s+$/, "") : value.trim();
        const pending = row.pendingItem === path;
        const undoBase = row.pendingBase;
        row.pendingItem = null; row.pendingBase = null;
        if (pending && !next) { if (undoBase) row.draft = undoBase; if (row.isNew) return discard(row); return rerender(row.key); }
        if (path === "phrase" && !next) { if (row.isNew) return discard(row); toast("熟語は空にできません", { tone: "error" }); return rerender(row.key); }
        if (row.isNew && path === "phrase") {
          row.draft.phrase = next;
          rerender(row.key);
          return openEditor(row.key, "meanings.0.meaning");
        }
        mutate(row, d => setPath(d, path, next), { undoBase });
      },
      onCancel: () => {
        if (row.pendingItem === path && row.pendingBase) row.draft = row.pendingBase;
        row.pendingItem = null; row.pendingBase = null;
        if (row.isNew) return discard(row);
        rerender(row.key);
      },
    });
  }
  function openEditor(key, path) {
    requestAnimationFrame(() => {
      const el = entryEl(key)?.querySelector(`[data-edit="${CSS.escape(path)}"]`);
      if (el) editField(S.rows.get(key), el);
    });
  }
  function addMeaning(row) {
    row.pendingBase = clone(row.draft);
    row.draft.meanings.push({ meaning: "", wordIds: [] });
    row.pendingItem = `meanings.${row.draft.meanings.length - 1}.meaning`;
    rerender(row.key);
    openEditor(row.key, row.pendingItem);
  }
  async function insert(afterKey, sectionKey) {
    finishInlineEditing();
    await loadSection(afterKey ? S.order.find(i => i.key === afterKey)?.sectionKey : sectionKey);
    let position, labelKey = null;
    if (afterKey) {
      const target = S.order.find(i => i.key === afterKey);
      position = S.order.indexOf(target) + 1;
      sectionKey = target.sectionKey; labelKey = target.labelKey;
    } else {
      const members = S.order.filter(i => i.sectionKey === sectionKey);
      position = members.length ? S.order.indexOf(members.at(-1)) + 1 : S.order.findIndex(i => sectionIndex(i.sectionKey) > sectionIndex(sectionKey));
      if (position < 0) position = S.order.length;
    }
    const key = `__new_${++S.tempId}`;
    S.order.splice(position, 0, { key, phrase: "", sectionKey, labelKey, hidden: false });
    const row = makeRow({ key, phrase: "", sectionKey, labelKey, meanings: [{ meaning: "", refs: [] }] }, true);
    S.rows.set(key, row);
    S.selectedKey = key;
    normalize();
    renderSection(sectionKey);
    refreshNumbers();
    openEditor(key, "phrase");
  }
  function discard(row) {
    S.order = S.order.filter(i => i.key !== row.key);
    S.rows.delete(row.key);
    if (S.selectedKey === row.key) S.selectedKey = null;
    normalize();
    renderSection(row.draft.sectionKey);
    refreshNumbers();
  }
  async function applyOrder(next, message, labelChanges = []) {
    const previous = S.order.map(i => ({ ...i }));
    const keys = new Set([...previous, ...next].map(i => i.sectionKey));
    S.order = next;
    normalize();
    const draw = () => { for (const key of keys) renderSection(key); refreshNumbers(); };
    draw();
    try {
      for (const { row, labelKey, sectionKey } of labelChanges) {
        // 移動は内容の下書きとは別に、すぐ保存する。
        if (!same(row.base, row.draft)) throw new Error("未保存の変更がある熟語は、保存してから移動してください");
        row.draft.labelKey = labelKey ?? "";
        row.draft.sectionKey = sectionKey;
        await queueSave(row, message);
        if (row.error) throw new Error(row.error);
      }
      await saveOrder();
      for (const row of S.rows.values()) {
        const item = S.order.find(i => i.key === row.key);
        if (item && row.base.sectionKey !== item.sectionKey) { row.base.sectionKey = item.sectionKey; row.draft.sectionKey = item.sectionKey; row.raw.sectionKey = item.sectionKey; }
      }
      if (!labelChanges.length) toast(message);
    } catch (error) {
      S.order = previous; normalize(); draw();
      toast(`並び順を保存できませんでした：${error.message}`, { tone: "error", duration: 7000 });
    }
  }
  function moveNear(key, targetKey, before) {
    const moving = S.order.find(i => i.key === key);
    const target = S.order.find(i => i.key === targetKey);
    if (!moving || !target || moving === target) return;
    const rest = S.order.filter(i => i !== moving).map(i => ({ ...i }));
    const index = rest.findIndex(i => i.key === targetKey) + (before ? 0 : 1);
    const moved = { ...moving, sectionKey: target.sectionKey, labelKey: target.labelKey };
    rest.splice(index, 0, moved);
    const row = S.rows.get(key);
    const changes = row && (moving.labelKey !== target.labelKey || moving.sectionKey !== target.sectionKey) ? [{ row, labelKey: target.labelKey, sectionKey: target.sectionKey }] : [];
    applyOrder(rest, `「${moving.phrase}」を移動しました`, changes);
  }
  function openMoveSheet(row) {
    sheet(`「${row.draft.phrase}」を移動`, body => {
      const select = document.createElement("select");
      select.innerHTML = sections().map((s, i) => `<option value="${h(s.key)}">${h(`${i + 1}. ${s.subtitle || s.key}`)}</option>`).join("");
      select.value = row.draft.sectionKey;
      const label = document.createElement("label"); label.textContent = "移動先のSection"; label.append(select);
      const form = document.createElement("div"); form.className = "edit-form"; form.append(label);
      const ok = document.createElement("button"); ok.type = "button"; ok.className = "primary"; ok.textContent = "移動する";
      ok.addEventListener("click", () => {
        closeSheet();
        const key = select.value;
        if (key === row.draft.sectionKey) return;
        const rest = S.order.filter(i => i.key !== row.key).map(i => ({ ...i }));
        const members = rest.filter(i => i.sectionKey === key);
        const index = members.length ? rest.indexOf(members.at(-1)) + 1 : rest.findIndex(i => sectionIndex(i.sectionKey) > sectionIndex(key));
        rest.splice(index < 0 ? rest.length : index, 0, { ...S.order.find(i => i.key === row.key), sectionKey: key, labelKey: null });
        S.loaded.delete(key);
        applyOrder(rest, "移動しました", [{ row, labelKey: null, sectionKey: key }]).then(() => loadSection(key));
      });
      const actions = document.createElement("div"); actions.className = "edit-sheet-actions"; actions.append(ok);
      body.append(form, actions);
    });
  }
  function openFieldSheet(row) {
    sheet("欄", body => tiles(body, "付けると空の欄が追加されます。外すとその欄の内容を削除します。", FIELDS.map(([field, label, type]) => {
      const active = !!row.draft[field] || row.showFields.has(field);
      return {
        html: `<span class="notes-label ${type}-badge"><span class="notes-label-text">${h(label)}</span></span>`, active,
        onSelect: () => {
          closeSheet();
          if (active) { row.showFields.delete(field); mutate(row, d => { d[field] = ""; }); }
          else { row.showFields.add(field); rerender(row.key); openEditor(row.key, field); }
        },
      };
    }), { columns: 3 }));
  }
  function openMenu(row) {
    sheet(row.draft.phrase || "熟語", body => menuList(body, [
      { label: row.draft.hidden ? "閲覧ページに表示する" : "閲覧ページで非表示にする（削除の代わり）", icon: row.draft.hidden ? "fa-eye" : "fa-eye-slash", onSelect: () => mutate(row, d => { d.hidden = !d.hidden; }) },
      { label: "移動", icon: "fa-arrow-right-arrow-left", onSelect: () => openMoveSheet(row) },
    ]));
  }
  async function renameSection(el, key) {
    const section = sectionOf(key);
    const current = section.subtitle || "";
    inlineEditor(el, current, {
      placeholder: "Section名",
      onCommit: async value => {
        const next = value.trim();
        if (!next || next === current) return redraw();
        setSubtitle(key, next); redraw();
        try {
          await api(`${base}/idioms/sections/${encodeURIComponent(key)}`, { method: "PUT", body: { subtitle: next } });
          undoEntry = async () => { setSubtitle(key, current); redraw(); await api(`${base}/idioms/sections/${encodeURIComponent(key)}`, { method: "PUT", body: { subtitle: current } }); toast("元に戻しました"); };
          offer("Section名を保存しました");
          onStructureChange?.();
        } catch (error) { setSubtitle(key, current); redraw(); toast(`保存できませんでした：${error.message}`, { tone: "error" }); }
      },
      onCancel: redraw,
    });
  }
  function setSubtitle(key, value) { for (const c of S.chapters) for (const s of c.sections) if (s.key === key) s.subtitle = value; }
  function redraw() { const y = scrollY; renderShells(); scrollTo(0, y); }
  async function moveSection(key, dir) {
    const chapter = S.chapters.find(c => c.sections.some(s => s.key === key));
    const index = chapter.sections.findIndex(s => s.key === key), to = index + dir;
    if (to < 0 || to >= chapter.sections.length) return toast("熟語のSectionは同じChapterの中で並べ替えます");
    return saveSectionOrder(chapter.key, (() => { const list = [...chapter.sections]; [list[index], list[to]] = [list[to], list[index]]; return list; })());
  }
  async function saveSectionOrder(chapterKey, list) {
    const chapter = S.chapters.find(c => c.key === chapterKey);
    const previous = chapter.sections;
    chapter.sections = list;
    normalize(); redraw(); onStructureChange?.();
    try {
      await api(`${base}/idioms/sections/reorder`, { method: "POST", body: { sectionKeys: sections().map(s => s.key) } });
      await saveOrder();
      toast("Sectionの順番を保存しました");
    } catch (error) {
      chapter.sections = previous; normalize(); redraw(); onStructureChange?.();
      toast(`保存できませんでした：${error.message}`, { tone: "error" });
    }
  }

  const navigateTo = createNavigator();

  // ---- イベント ----
  root.addEventListener("click", event => {
    if (!event.target.isConnected || event.target.closest(".edit-inline")) return;
    const link = event.target.closest("a");
    if (link) event.preventDefault();
    const article = event.target.closest(".idiom-entry[data-idiom-key]");
    const row = article && S.rows.get(article.dataset.idiomKey);
    // タップした時点でDBの最新を読み始める（単語と同じ）。
    if (row) freshen(row);
    const op = event.target.closest("[data-op]");
    if (op) {
      switch (op.dataset.op) {
        case "add-meaning": return addMeaning(row);
        case "remove-meaning": return mutate(row, d => { d.meanings.splice(Number(op.dataset.index), 1); });
        case "remove-field": row.showFields.delete(op.dataset.field); return mutate(row, d => { d[op.dataset.field] = ""; });
        case "fields": return openFieldSheet(row);
        case "menu": return openMenu(row);
        case "insert": return insert(op.dataset.after);
        case "add-first": return insert(null, op.dataset.key);
        case "retry-save": case "save-idiom": finishInlineEditing(); return queueSave(row);
        case "reset-idiom": return resetIdiom(row);
        case "overwrite-idiom":
          if (!confirm("ほかの画面での変更のうち、あなたが変えた項目だけを、あなたの内容で上書きします。よろしいですか？")) return;
          return queueSave(row, "保存しました", { force: true });
        case "reload-idiom":
          if (!confirm("この熟語の未保存の変更を取り消して、最新の内容を読み込みますか？")) return;
          return latestEntry(row).then(latest => { if (!latest) return; row.raw = latest; row.base = idiomDraft(latest); row.draft = clone(row.base); row.error = ""; row.conflict = false; row.fresh = true; rerender(row.key); });
        case "retry-section": return loadSection(op.dataset.key);
        case "section-move": return moveSection(op.dataset.key, Number(op.dataset.dir));
      }
      return;
    }
    if (row) {
      if (S.selectedKey !== row.key) return select(row.key);
      if (event.target.closest("[data-edit-field-badge]")) return openFieldSheet(row);
      return;
    }
    const header = event.target.closest('[data-header="idiom-section"]');
    if (header) {
      if (S.selectedSection === header.dataset.key) return;
      finishInlineEditing();
      S.selectedKey = null;
      S.selectedSection = header.dataset.key;
      return redraw();
    }
    if (!event.target.closest(".edit-add-bar")) {
      if (S.selectedKey) select(null);
      else if (S.selectedSection) { S.selectedSection = null; redraw(); }
    }
  });
  onDoubleActivate(root, (event, target) => {
    if (target.closest(".edit-inline, [data-op]")) return;
    const article = target.closest(".idiom-entry[data-idiom-key]");
    if (article) {
      const row = S.rows.get(article.dataset.idiomKey);
      const field = target.closest("[data-edit]");
      if (!row || !field) return;
      if (S.selectedKey !== row.key) {
        select(row.key);
        const fresh = entryEl(row.key)?.querySelector(`[data-edit="${CSS.escape(field.dataset.edit)}"]`);
        if (fresh) editField(row, fresh);
        return;
      }
      return editField(row, field);
    }
    const header = target.closest('[data-header="idiom-section"]');
    if (header && target.closest("[data-edit-header]")) {
      const key = header.dataset.key;
      if (S.selectedSection !== key) { S.selectedSection = key; S.selectedKey = null; redraw(); }
      const fresh = root.querySelector(`#idiom-section-${CSS.escape(key)} [data-edit-header]`);
      if (fresh) renameSection(fresh, key);
    }
  });
  sortable(root, {
    handleSelector: ".idiom-entry.is-edit-selected > .entry-no",
    itemSelector: ".idiom-entry[data-idiom-key]",
    idOf: el => el.dataset.idiomKey,
    canDrag: el => !S.rows.get(el.dataset.idiomKey)?.isNew,
    canDrop: (item, target) => !S.rows.get(target.dataset.idiomKey)?.isNew,
    onDrop: (key, targetKey, before) => moveNear(key, targetKey, before),
  });
  window.addEventListener("beforeunload", event => {
    if ([...S.rows.values()].some(r => r.saving || r.error || r.isNew || !same(r.base, r.draft)) || isInlineEditing()) { event.preventDefault(); event.returnValue = ""; }
  });

  return {
    load,
    state: S,
    contentsHtml() {
      const numbers = sectionNumbers();
      return S.chapters.map((chapter, ci) => `<div class="contents-group" data-idiom-chapter="${h(chapter.key)}"><div class="contents-chapter"><span class="contents-item-text"><span class="contents-item-name">Chapter ${ci + 1}</span><span class="contents-item-subtitle">${h(chapter.subtitle || "")}</span></span></div>${chapter.sections.map(section => `<div class="contents-section is-nested edit-toc-item" data-idiom-section-key="${h(section.key)}" data-drag-label="${h(section.subtitle || section.key)}"><span class="edit-toc-handle" aria-label="並べ替え">⠿</span><button type="button" class="edit-toc-link" data-nav-idiom-section="${h(section.key)}"><span class="contents-item-text"><span class="contents-item-name">${numbers.get(section.key) ? `Section ${numbers.get(section.key)}` : "Section"}</span><span class="contents-item-subtitle">${h(section.subtitle || "")}</span></span></button></div>`).join("")}</div>`).join("");
    },
    attachContentsSorting(nav) {
      sortable(nav, {
        handleSelector: "[data-idiom-section-key] > .edit-toc-handle",
        itemSelector: "[data-idiom-section-key]",
        idOf: el => el.dataset.idiomSectionKey,
        canDrop: (item, target) => item.closest("[data-idiom-chapter]") === target.closest("[data-idiom-chapter]"),
        onDrop: (key, targetKey, before) => {
          const chapter = S.chapters.find(c => c.sections.some(s => s.key === key));
          const moving = chapter.sections.find(s => s.key === key);
          const rest = chapter.sections.filter(s => s !== moving);
          rest.splice(rest.findIndex(s => s.key === targetKey) + (before ? 0 : 1), 0, moving);
          saveSectionOrder(chapter.key, rest);
        },
      });
    },
    navSections() {
      const numbers = sectionNumbers();
      return sections().map(section => ({ key: section.key, name: numbers.get(section.key) ? `Section ${numbers.get(section.key)}` : "Section", subtitle: section.subtitle || "", count: S.order.filter(i => i.sectionKey === section.key).length }));
    },
    // 閲覧ページと同じ手順で移動する。
    navigateToSection(key, { targetId, block = "start", select: selectKey } = {}) {
      return navigateTo({
        sections: this.navSections(),
        targetKey: key,
        load: loadSection,
        groupOf: k => root.querySelector(`.section-group[data-idiom-section-group="${CSS.escape(k)}"]`),
        target: () => document.getElementById(targetId || `idiom-section-${key}`),
        pause: () => { S.navPaused = true; S.observer?.disconnect(); },
        resume: () => { S.navPaused = false; observeSections(); },
        block,
        onArrive: () => { if (selectKey) select(selectKey); },
      }).catch(error => toast(`移動先を読み込めませんでした：${error.message}`, { tone: "error" }));
    },
    navigateToEntry(key) {
      const item = S.order.find(i => i.key === key);
      if (!item) return toast("この熟語は見つかりません");
      return this.navigateToSection(item.sectionKey, { targetId: `idiom-${encodeURIComponent(key)}`, block: "center", select: key });
    },
    visibleEntries() {
      return S.order.filter(i => !i.hidden).map(i => ({ key: i.key, phrase: i.phrase, hidden: false, no: S.numbers.get(i.key), alternateForms: S.rows.get(i.key)?.raw.alternateForms || i.alternateForms || [] }));
    },
  };
}
