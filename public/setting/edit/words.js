import { alignReadingWord } from "../../shared/reading-position.js";
import { afterBodyPaint } from "../../viewer/startup.js";
// 閲覧型編集ページ：単語帳（crossover）の表示と編集。
// 閲覧ページと同じ描画処理で表示し、選択した単語にだけ編集用の部品を重ねる。
import { renderWordEntry } from "../../viewer/word-entry.js";
import { VIEWER_API_BASE } from "../../shared/config.js";
import { createIdiomReferenceResolver } from "../../shared/idiom-references.js";
import { groupIdiomEntries } from "../../shared/idioms.js";
import { playPronunciation } from "../../shared/speech.js";
import {
  addDerivativeCrossReferenceAliases, collectDerivativeCrossReferences, collectPhraseCrossReferences,
  createAutoCrossRefRenderer, createPhraseCrossReferenceResolver,
} from "../../shared/markup.js";
import { changedKeys, clone, same, mergeDraft, wordDraft, wordPayload, cautions } from "../table-data.js";
import { api, lookupNewWordPronunciation, saveExistingWord, verifySavedWordOrder } from "./api.js";
import { loadSectionData, rememberSaved, recentSaved } from "./section-cache.js";
import { h, toast, sheet, closeSheet, tiles, menuList, inlineEditor, isInlineEditing, isSheetOpen, hasActiveInlineIn, finishInlineEditing, onDoubleActivate, sortable } from "./ui.js";
import { editWordCollection } from "./collection-editor.js";
import { hierarchyIcon } from "./icons.js";
import { createNavigator } from "./navigation.js";

export const POS_OPTIONS = ["名", "自", "他", "動", "形", "副", "代", "冠", "前", "接", "間", "助", "熟", "連"];
const CAUTIONS = [
  ["ergative", "能格", "caution-ergative"], ["spellingCaution", "スペル", "caution-spelling"],
  ["pronunciationCaution", "発音", "caution-pronunciation"], ["accentCaution", "アクセント", "caution-accent"],
  ["polysemousCaution", "多義", "caution-polysemous"], ["conjugationCaution", "活用", "caution-conjugation"],
  ["usageCaution", "語法", "caution-usage"],
];
const NOTE_FIELDS = [
  ["derivatives", "派生語", "derivative"], ["irregularForms", "不規則", "irregular"], ["synonyms", "類義語", "synonym"],
  ["antonyms", "対義語", "antonym"], ["relatedWords", "関連語", "related"], ["etymology", "語源", "etymology"],
  ["notes", "メモ", "memo"],
];
const SAVE_FIELD_LABELS = Object.fromEntries([
  ...NOTE_FIELDS, ...CAUTIONS, ["spelling", "見出し語"], ["pronunciation", "発音記号"],
  ["examples", "フレーズ"], ["senses", "意味・品詞"], ["derivedFrom", "派生元"],
  ["oxford5000", "Oxford"], ["cefr_provisional", "CEFR"], ["awl", "AWL"], ["eiken", "英検"], ["custom", "カスタムタグ"],
]);
const MULTILINE = new Set(["notes", "etymology", "irregularForms"]);
const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];
const EIKEN = ["5級", "4級", "3級", "準2級", "2級", "準1級", "1級"];
const NONE = "none";

export function requestWordStructure(listId) {
  const base = `/lists/${encodeURIComponent(listId)}`;
  const requests = {
    index: api(`${base}/editor/index`), sections: api(`${base}/sections`), chapters: api(`${base}/chapters`),
    labels: api(`${base}/labels`), groups: api(`${base}/groups`).catch(() => []),
  };
  // During startup the notebook catalog can still be loading.
  Promise.allSettled(Object.values(requests));
  return requests;
}

export function createWordEditor({ root, listId, onStructureChange }) {
  const S = {
    list: null, chapters: [], sections: [], labels: [], groups: [],
    order: [], rows: new Map(), loaded: new Set(), loading: new Map(),
    selectedId: null, selectedHeader: null, multi: null,
    referenceWords: [], idioms: { entries: [], chapters: [] },
    resolveRef: () => ({ found: false }), resolveHeadwordRef: () => ({ found: false }), renderNotesMarkup: (text) => h(text || ""),
    seq: new Map(), observer: null, tempId: 0,
  };

  const ORDER_WRITE_TIMEOUT = 30000;
  const orderWriteRejected = error => [400, 401, 403, 404].includes(error.status);
  let orderSaving = false;
  let orderUnconfirmed = false;
  function canChangeOrder() {
    if (orderUnconfirmed) {
      toast("並び順の保存結果を確認できません。少し待ってからページを再読み込みしてください。", { tone: "error" });
      return false;
    }
    if (orderSaving) {
      toast("並び順に関わる変更を保存中です。完了してからもう一度お試しください。");
      return false;
    }
    return true;
  }
  async function withOrderChange(run) {
    if (!canChangeOrder()) return;
    orderSaving = true;
    try { return await run(); }
    finally { orderSaving = false; }
  }

  // ---- データ ----
  const draftOf = raw => {
    const draft = wordDraft(raw, listId);
    draft.no = ""; draft.sectionId = ""; draft.labelId = "";
    // 例文は廃止してすべてフレーズ。公開が遅れて種類が古いままでも差分にしない。
    for (const example of draft.examples) example.type = "phrase";
    return draft;
  };
  const sectionKey = id => id == null ? NONE : String(id);
  const chapterById = id => S.chapters.find(c => c.id === id);
  const sectionById = id => S.sections.find(s => s.id === id);
  const labelById = id => S.labels.find(l => l.id === id);
  const chapterSort = id => chapterById(id)?.sortOrder ?? -1;
  const sectionNumber = id => [...S.sections].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).findIndex(s => s.id === id) + 1;
  const sectionName = id => id == null ? "Sectionなし" : `${S.list?.sectionLabel || "Section"} ${sectionNumber(id)}`;
  const chapterName = id => `${S.list?.chapterLabel || "Chapter"} ${S.chapters.findIndex(c => c.id === id) + 1}`;
  const groupName = id => `Group ${S.groups.findIndex(g => g.id === id) + 1}`;
  const orderedSections = () => [...S.sections].sort((a, b) =>
    chapterSort(a.chapterId) - chapterSort(b.chapterId) || a.sortOrder - b.sortOrder || a.id - b.id);
  const sectionLabels = sectionId => S.labels.filter(l => l.sectionId === sectionId).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  function itemRank(item) {
    const section = sectionById(item.sectionId);
    return [section ? chapterSort(section.chapterId) : -1, section ? section.sortOrder : -1, labelById(item.labelId)?.sortOrder ?? -1];
  }
  // 閲覧ページと同じ「Chapter→Section→Label→番号」の順に揃える（同じ位置どうしは現在の順を保つ）。
  function normalizeOrder() {
    const ranked = S.order.map((item, index) => ({ item, rank: [...itemRank(item), index] }));
    ranked.sort((a, b) => { for (let i = 0; i < 4; i += 1) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i]; return 0; });
    S.order = ranked.map(entry => entry.item);
    computeSeq();
  }
  function computeSeq() {
    S.seq = new Map();
    let top = 0, branch = 0;
    for (const item of S.order) {
      if (item.branch > 0 && top > 0) { branch += 1; S.seq.set(item.id, `${top}-${branch}`); }
      else { top += 1; branch = 0; S.seq.set(item.id, String(top)); }
    }
  }
  function family(id) {
    const start = S.order.findIndex(item => item.id === id);
    if (start < 0) return [];
    let end = start + 1;
    while (end < S.order.length && S.order[end].branch > 0) end += 1;
    return S.order.slice(start, end);
  }
  const headOf = id => {
    let index = S.order.findIndex(item => item.id === id);
    while (index > 0 && S.order[index].branch > 0) index -= 1;
    return S.order[index];
  };

  function viewOf(row) {
    const d = row.draft, r = row.raw;
    const tags = Object.fromEntries(Object.entries(r.tags || {}).filter(([k]) => !k.startsWith("custom:") && !["cefr_provisional", "awl", "eiken"].includes(k)));
    for (const key of ["cefr_provisional", "awl", "eiken"]) if (d[key]) tags[key] = d[key];
    for (const raw of d.custom.split(",")) if (raw.trim()) tags[`custom:${raw.trim()}`] = true;
    const item = S.order.find(o => o.id === row.id);
    return {
      ...r,
      id: row.id,
      spelling: d.spelling,
      pronunciation: d.pronunciation || null,
      ...Object.fromEntries(["irregularForms", "synonyms", "antonyms", "relatedWords", "etymology", "notes"].map(k => [k, d[k] || null])),
      ...Object.fromEntries(cautions.map(k => [k, d[k]])),
      senses: d.senses.map(s => ({ ...s, isPrimary: !!s.is_primary })),
      examples: d.examples,
      derivatives: d.derivatives,
      tags,
      derivedFromSpelling: d.derivedFrom || null,
      branch: item?.branch ?? r.branch ?? 0,
      seqNo: S.seq.get(row.id) || "",
    };
  }

  // PUT/POSTの応答（D1の詳細）を閲覧データの形にする。
  function toViewer(detail, previous = {}) {
    const membership = S.order.find(item => item.id === detail.id) ?? detail.lists?.find(m => m.listId === listId);
    return {
      ...previous,
      ...detail,
      senses: (detail.senses || []).map(s => ({ pos: s.pos, meaning: s.meaning, pronunciation: s.pronunciation, isPrimary: !!(s.is_primary ?? s.isPrimary) })),
      derivedFromSpelling: detail.derivedFrom?.spelling ?? previous.derivedFromSpelling ?? null,
      branch: membership?.branch ?? previous.branch ?? 0,
      sectionId: membership ? membership.sectionId ?? null : previous.sectionId ?? null,
      labelId: membership ? membership.labelId ?? null : previous.labelId ?? null,
      illustration: detail.illustration ?? previous.illustration,
    };
  }
  function makeRow(raw, isNew = false) {
    const draft = draftOf(raw);
    return { id: raw.id, raw, base: clone(draft), draft, isNew, showFields: new Set(), saving: false, error: "" };
  }
  function cleanDraft(draft) {
    return {
      ...draft,
      senses: draft.senses.filter(s => s.meaning.trim()),
      examples: draft.examples.filter(e => e.sentence.trim()),
      derivatives: draft.derivatives.filter(d => d.word.trim()),
    };
  }

  // ---- 参照（リンク）の解決 ----
  function rebuildReferences() {
    const headwordIndex = new Map();
    for (const item of S.order) if (!item.branch) headwordIndex.set(item.spelling.toLowerCase(), { id: item.id, no: S.seq.get(item.id) });
    for (const item of S.order) if (!headwordIndex.has(item.spelling.toLowerCase())) headwordIndex.set(item.spelling.toLowerCase(), { id: item.id, no: S.seq.get(item.id) });
    const derivativeReferences = collectDerivativeCrossReferences(S.referenceWords);
    const wordIndex = addDerivativeCrossReferenceAliases(headwordIndex, derivativeReferences);
    const phraseReferences = collectPhraseCrossReferences(S.referenceWords);
    const phraseResolver = createPhraseCrossReferenceResolver(headwordIndex, phraseReferences);
    const idiomResolver = createIdiomReferenceResolver(groupIdiomEntries(S.idioms.entries || [], S.idioms.chapters), name => {
      const hit = wordIndex.get(name.toLowerCase());
      return hit ? { found: true, ...hit } : { found: false };
    });
    S.resolveRef = headword => {
      const hit = wordIndex.get(headword.toLowerCase());
      if (hit) return { found: true, id: hit.id, no: hit.no };
      const idiom = idiomResolver(headword);
      if (idiom?.found || /^(?:word|idiom):/i.test(headword)) return idiom || { found: false };
      return phraseResolver(headword) || { found: false };
    };
    S.resolveHeadwordRef = headword => {
      const hit = headwordIndex.get(headword.toLowerCase());
      return hit ? { found: true, id: hit.id, no: hit.no } : { found: false };
    };
    S.renderNotesMarkup = createAutoCrossRefRenderer([...headwordIndex.keys(), ...(idiomResolver.phrases || [])], {
      resolve: S.resolveRef, derivativeReferences, idiomReferences: idiomResolver.phrases || [], phraseReferences,
    });
  }

  // ---- 読み込み ----
  let firstKey, firstData;
  const pendingFresh = new Map();
  function readSection(key) {
    return loadSectionData({
      kind: "word",
      publicPath: `/lists/${encodeURIComponent(listId)}/viewer/sections/${encodeURIComponent(key)}`,
      editorPath: `/lists/${encodeURIComponent(listId)}/editor/sections/${encodeURIComponent(key)}?full=1`,
      onFresh: data => {
        if (S.loaded.has(key)) applyFreshWords(key, data.words || []);
        else pendingFresh.set(key, data);
      },
    });
  }
  async function load(list, { position, structure } = {}) {
    root.innerHTML = '<div class="loading-msg"><span class="loading-label">読み込み中...</span></div>';
    const base = `/lists/${encodeURIComponent(listId)}`;
    function preload(key, subtitle = "") {
      firstKey = key;
      firstData = readSection(key);
      firstData.then(data => {
        if (!root.querySelector(".loading-msg") || !data.words?.length) return;
        const context = { resolveRef: S.resolveRef, resolveHeadwordRef: S.resolveHeadwordRef, renderNotesMarkup: S.renderNotesMarkup, origin: VIEWER_API_BASE || location.origin };
        const target = position && data.words.find(word => word.id === position.id);
        if (position && !target) return;
        const entries = (target ? [target] : data.words).map(word => renderWordEntry(recentSaved("word", word.id) || word, context)).join("");
        const title = target ? `No. ${h(position.number)}` : `${h(list.sectionLabel || "Section")} 1`;
        root.innerHTML = `<div class="section-divider"><span class="section-title">${title}</span><span class="section-subtitle">${h(subtitle)}</span></div><div inert>${entries}</div>`;
      }).catch(() => {});
    }
    const requests = structure || requestWordStructure(listId);
    if (position && /^(?:none|[0-9]+)$/.test(position.section)) preload(position.section);
    const sectionsRequest = requests.sections.then(sections => {
      const first = [...sections].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)[0];
      if (!firstData && first) preload(sectionKey(first.id), first.subtitle);
      return sections;
    });
    const [index, sections, chapters, labels, groups] = await Promise.all([
      requests.index, sectionsRequest, requests.chapters, requests.labels, requests.groups,
    ]);
    S.list = list;
    S.sections = sections; S.chapters = chapters; S.labels = labels; S.groups = groups || [];
    S.order = (index.words || []).map(({ id, spelling, branch, sectionId, labelId }) => ({ id, spelling, branch: branch || 0, sectionId: sectionId ?? null, labelId: labelId ?? null }));
    normalizeOrder();
    rebuildReferences();
    const resumeId = position && (S.seq.has(position.id) ? position.id : S.order.find(item => S.seq.get(item.id) === position.number)?.id);
    S.navPaused = !!resumeId;
    renderShells();
    onStructureChange?.();
    if (resumeId) {
      const item = S.order.find(word => word.id === resumeId);
      if (await this.navigateToSection(sectionKey(item.sectionId), { targetId: `word-${resumeId}` })) alignReadingWord(resumeId);
    } else {
      const first = orderedSections()[0];
      if (first) await loadSection(sectionKey(first.id));
    }
    await afterBodyPaint();
    // 参照用データは表示を止めずに後から読む。
    Promise.allSettled([api(`${base}/editor/references`), api(`${base}/editor/idioms`)]).then(([references, idioms]) => {
      if (references.status === "fulfilled") S.referenceWords = references.value.words || [];
      if (idioms.status === "fulfilled") S.idioms = idioms.value;
      rebuildReferences();
      for (const key of S.loaded) {
        const entries = root.querySelector(`[data-section-entries="${CSS.escape(key)}"]`);
        if (!hasActiveInlineIn(entries)) renderSection(key);
      }
    });
  }

  async function loadSection(key) {
    if (S.loaded.has(key)) return;
    if (S.loading.has(key)) return S.loading.get(key);
    const promise = (async () => {
      // 閲覧ページと同じ公開APIと端末キャッシュを使う（キャッシュがあれば即表示し、裏で更新を確認）。
      const cached = await (key === firstKey && firstData ? firstData : readSection(key));
      const data = pendingFresh.get(key) || cached;
      // 保存した直後の単語は、閲覧ページに反映されるまで手元の保存結果を使う。
      const byId = new Map((data.words || []).map(word => [word.id, recentSaved("word", word.id) || word]));
      const members = S.order.filter(item => sectionKey(item.sectionId) === key);
      // 公開待ちの間に移ってきた単語など、スナップショットにない単語は個別に読む。
      const missing = members.filter(item => !S.rows.has(item.id) && !byId.has(item.id));
      for (let i = 0; i < missing.length; i += 3) {
        await Promise.all(missing.slice(i, i + 3).map(async item => {
          byId.set(item.id, toViewer(await api(`/words/${encodeURIComponent(item.id)}`), { branch: item.branch }));
        }));
      }
      const placements = new Map(S.order.map(item => [item.id, item]));
      for (const item of members) if (!S.rows.has(item.id) && byId.has(item.id)) {
        const raw = byId.get(item.id);
        // A section read may complete after a move or rollback.
        const current = placements.get(item.id);
        if (current) S.rows.set(item.id, makeRow({ ...raw, sectionId: current.sectionId, labelId: current.labelId }));
      }
      S.loaded.add(key);
      if (pendingFresh.has(key)) applyFreshWords(key, pendingFresh.get(key).words || []);
      pendingFresh.delete(key);
      renderSection(key);
    })();
    S.loading.set(key, promise);
    try { await promise; }
    catch (error) {
      const entries = root.querySelector(`[data-section-entries="${CSS.escape(key)}"]`);
      if (entries) entries.innerHTML = `<div class="section-load-error">読み込みに失敗しました: ${h(error.message)} <button type="button" data-op="retry-section" data-key="${h(key)}">再試行</button></div>`;
    } finally { S.loading.delete(key); if (key === firstKey) firstData = null; }
  }

  // 裏で読み直した最新の内容を、編集中でない単語にだけ反映する。
  function applyFreshWords(key, words) {
    const placements = new Map(S.order.map(item => [item.id, item]));
    for (const word of words) {
      const row = S.rows.get(word.id);
      // 入力中の欄がある単語は更新しない（入力欄の古い値で、新しい内容を上書きしてしまうため）。
      if (!row || row.editingCollection || row.saving || row.isNew || row.error || !same(row.base, row.draft) || recentSaved("word", word.id) || hasActiveInlineIn(entryEl(word.id))) continue;
      const draft = draftOf(word);
      if (same(draft, row.base) && JSON.stringify(word.illustration) === JSON.stringify(row.raw.illustration)) continue;
      // Snapshots may still reflect the previous section after a move.
      const item = placements.get(word.id);
      if (!item) continue;
      row.raw = { ...row.raw, ...word, sectionId: item.sectionId, labelId: item.labelId };
      row.base = draft; row.draft = clone(draft);
      if (S.loaded.has(key)) rerenderEntry(word.id);
    }
  }

  // ---- 描画 ----
  function renderShells() {
    S.observer?.disconnect();
    const tone = new Map(S.chapters.map((c, i) => [c.id, (i % 6) + 1]));
    const parts = [];
    const sections = orderedSections();
    const counts = sectionCounts();
    const hasNone = counts.has(NONE);
    const list = hasNone ? [{ id: null, chapterId: null }, ...sections] : sections;
    let lastChapter, lastGroup;
    const chaptersShown = new Set();
    const chapterBlock = (chapterId) => {
      if (!chapterById(chapterId)) return "";
      chaptersShown.add(chapterId);
      return chapterDividerHtml(chapterId);
    };
    // 空のChapterも編集できるように、所属Sectionがない章も順番どおりに出す。
    const emptyChapterBefore = (sortOrder) => S.chapters.filter(c => !chaptersShown.has(c.id) && c.sortOrder < sortOrder && !sections.some(s => s.chapterId === c.id));
    for (const [index, section] of list.entries()) {
      const chapterId = section.chapterId ?? null;
      if (chapterId !== lastChapter) {
        for (const chapter of emptyChapterBefore(chapterSort(chapterId))) parts.push(emptyChapter(chapter, tone));
      }
      const chapterChanged = chapterId !== lastChapter && chapterId != null;
      const chapterHtml = chapterChanged ? chapterBlock(chapterId) : "";
      if (chapterId !== lastChapter) lastGroup = undefined;
      lastChapter = chapterId;
      const group = section.groupId != null ? S.groups.find(g => g.id === section.groupId) : null;
      const groupHtml = group && group.id !== lastGroup
        ? `<div class="group-divider" id="group-${group.id}" role="heading" aria-level="3">${hierarchyIcon("group")}<div class="group-title-row"><span class="group-title">${h(groupName(group.id))}</span>${group.subtitle ? `<span class="group-subtitle">${h(group.subtitle)}</span>` : ""}</div></div>` : "";
      lastGroup = group?.id ?? lastGroup;
      const key = sectionKey(section.id);
      const selected = S.selectedHeader?.type === "section" && S.selectedHeader.id === section.id;
      const divider = sectionDividerHtml(section);
      const count = counts.get(key) || 0;
      parts.push(`<section class="section-group section-tone-${(index % 6) + 1} chapter-tone-${tone.get(chapterId) || 1}${chapterHtml ? " has-chapter-divider" : ""}${groupHtml ? " has-group-divider" : ""}" data-section-key="${h(key)}">${chapterHtml}${groupHtml}${divider}<div class="section-entries" data-section-entries="${h(key)}" aria-busy="true" style="--section-placeholder-height:${Math.min(900, Math.max(120, count * 44))}px"><div class="section-loading"><span class="section-loading-label">読み込み中...</span></div></div>${selected && section.id != null ? addSectionBar(section.id) : ""}</section>`);
    }
    for (const chapter of S.chapters) if (!chaptersShown.has(chapter.id) && !sections.some(s => s.chapterId === chapter.id)) parts.push(emptyChapter(chapter, tone));
    parts.push(`<div class="edit-add-chapter"><button type="button" class="edit-add-bar" data-op="add-chapter"><i class="fa-solid fa-plus" aria-hidden="true"></i> Chapterを追加</button></div>`);
    root.innerHTML = parts.join("");
    for (const key of S.loaded) renderSection(key);
    observeSections();

    function emptyChapter(chapter, toneMap) {
      return `<section class="section-group chapter-tone-${toneMap.get(chapter.id) || 1} has-chapter-divider edit-empty-chapter" data-chapter-only="${chapter.id}">${chapterBlock(chapter.id)}<button type="button" class="edit-add-bar" data-op="add-section-in-chapter" data-id="${chapter.id}"><i class="fa-solid fa-plus" aria-hidden="true"></i> このChapterにSectionを追加</button></section>`;
    }
  }
  function chapterDividerHtml(chapterId) {
    const chapter = chapterById(chapterId);
    const selected = S.selectedHeader?.type === "chapter" && S.selectedHeader.id === chapterId;
    return `<div class="chapter-divider${selected ? " is-edit-selected" : ""}" id="chapter-${chapter.id}" data-header="chapter" data-id="${chapter.id}" role="heading" aria-level="2">${hierarchyIcon("chapter")}<div class="chapter-title-row"><span class="chapter-title">${h(chapterName(chapter.id))}</span>${subtitle("chapter", chapter.subtitle, selected)}</div>${selected ? headerTools("chapter", chapter.id) : ""}</div>`;
  }
  function sectionDividerHtml(section) {
    const key = sectionKey(section.id);
    const selected = S.selectedHeader?.type === "section" && S.selectedHeader.id === section.id;
    return `<div class="section-divider${selected ? " is-edit-selected" : ""}" id="section-${h(key)}" data-header="section" data-id="${h(key)}" role="heading" aria-level="4">${hierarchyIcon("section")}<div class="section-title-row"><span class="section-title">${h(sectionName(section.id))}</span>${section.id == null ? "" : subtitle("section", section.subtitle, selected)}</div>${selected && section.id != null ? headerTools("section", section.id) : ""}</div>`;
  }
  const addSectionBar = id => `<button type="button" class="edit-add-bar" data-op="add-section-after" data-id="${id}"><i class="fa-solid fa-plus" aria-hidden="true"></i> この後にSectionを追加</button>`;
  const replaceHtml = (el, html) => { if (!el) return; const t = document.createElement("template"); t.innerHTML = html.trim(); el.replaceWith(t.content.firstElementChild); };
  // 見出し1つだけを描き直す（全体の再描画を避ける）。
  function refreshHeader(header) {
    if (!header) return;
    const { type, id } = header;
    if (type === "label") { const label = labelById(id); if (label) renderSection(sectionKey(label.sectionId)); return; }
    if (type === "chapter") { if (chapterById(id)) replaceHtml(root.querySelector(`#chapter-${id}`), chapterDividerHtml(id)); return; }
    const section = sectionById(id);
    if (!section) return;
    replaceHtml(root.querySelector(`#section-${id}`), sectionDividerHtml(section));
    const group = root.querySelector(`.section-group[data-section-key="${id}"]`);
    group?.querySelector(':scope > [data-op="add-section-after"]')?.remove();
    if (S.selectedHeader?.type === "section" && S.selectedHeader.id === id) group?.insertAdjacentHTML("beforeend", addSectionBar(id));
  }
  function subtitle(type, value, selected) {
    if (value) return `<span class="${type}-subtitle" data-edit-header="subtitle">${h(value)}</span>`;
    return selected ? `<span class="${type}-subtitle edit-empty" data-edit-header="subtitle">サブタイトルを入力</span>` : "";
  }
  function headerTools(type, id) {
    return `<div class="edit-header-tools" data-header-tools>
      <button type="button" data-op="header-description" data-type="${type}" data-id="${id}"><i class="fa-solid fa-align-left" aria-hidden="true"></i>説明</button>
      ${type === "section" ? `<button type="button" data-op="add-label" data-id="${id}"><i class="fa-solid fa-tag" aria-hidden="true"></i>Label追加</button>` : ""}
      <button type="button" data-op="header-move" data-type="${type}" data-id="${id}" data-dir="-1" aria-label="上へ"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
      <button type="button" data-op="header-move" data-type="${type}" data-id="${id}" data-dir="1" aria-label="下へ"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
      <button type="button" class="is-danger" data-op="header-delete" data-type="${type}" data-id="${id}"><i class="fa-solid fa-trash" aria-hidden="true"></i>削除</button>
    </div>`;
  }

  function observeSections() {
    S.observer?.disconnect();
    if (S.navPaused) return;
    const targets = root.querySelectorAll('[data-section-entries][aria-busy="true"]');
    if (!("IntersectionObserver" in window)) { targets.forEach(t => loadSection(t.dataset.sectionEntries)); return; }
    S.observer = new IntersectionObserver(items => {
      for (const item of items) if (item.isIntersecting) { S.observer.unobserve(item.target); loadSection(item.target.dataset.sectionEntries); }
    }, { rootMargin: "1200px 0px" });
    targets.forEach(t => S.observer.observe(t));
  }

  function entryHtml(row) {
    const selected = S.selectedId === row.id;
    let html = renderWordEntry(viewOf(row), {
      resolveRef: S.resolveRef, resolveHeadwordRef: S.resolveHeadwordRef, renderNotesMarkup: S.renderNotesMarkup,
      origin: VIEWER_API_BASE || location.origin, edit: { selected, showFields: selected ? row.showFields : new Set() },
    });
    const classes = [row.saving ? "is-saving" : "", row.error ? "has-edit-error" : "", S.multi?.has(row.id) ? "is-multi-selected" : "", row.isNew ? "is-new-entry" : ""].filter(Boolean).join(" ");
    if (classes) html = html.replace('class="entry', `class="entry ${classes}`);
    if (row.saving || row.saveDone) html = html.replace("</article>", `${saveProgressHtml(row)}</article>`);
    return html;
  }

  function renderSection(key) {
    const entries = root.querySelector(`[data-section-entries="${CSS.escape(key)}"]`);
    if (!entries || !S.loaded.has(key)) return;
    const sectionId = key === NONE ? null : Number(key);
    const members = S.order.filter(item => sectionKey(item.sectionId) === key);
    const parts = [];
    let lastLabel;
    const labels = sectionId == null ? [] : sectionLabels(sectionId);
    const shownLabels = new Set();
    for (const item of members) {
      if (item.labelId != null && item.labelId !== lastLabel) { parts.push(labelDivider(item.labelId)); shownLabels.add(item.labelId); }
      lastLabel = item.labelId;
      const row = S.rows.get(item.id);
      parts.push(row ? entryHtml(row) : `<div class="section-loading"><span class="section-loading-label">読み込み中...</span></div>`);
    }
    for (const label of labels) if (!shownLabels.has(label.id)) parts.push(labelDivider(label.id, true));
    if (!members.length) parts.push(`<button type="button" class="edit-add-bar" data-op="add-first-word" data-section="${h(key)}"><i class="fa-solid fa-plus" aria-hidden="true"></i> 単語を追加</button>`);
    entries.innerHTML = parts.join("");
    entries.removeAttribute("style");
    entries.setAttribute("aria-busy", "false");
    entries.closest(".section-group")?.classList.add("is-loaded");
    decorateSelected();
  }
  function labelDivider(labelId, empty = false) {
    const label = labelById(labelId);
    const selected = S.selectedHeader?.type === "label" && S.selectedHeader.id === labelId;
    return `<div class="label-divider${selected ? " is-edit-selected" : ""}${empty ? " is-empty-label" : ""}" data-header="label" data-id="${labelId}" role="heading" aria-level="5">${hierarchyIcon("label")}<span class="label-title" data-edit-header="name">${h(label?.name || "")}</span>${empty ? '<span class="edit-label-empty">（単語なし）</span>' : ""}${selected ? `<div class="edit-header-tools"><button type="button" data-op="add-word-in-label" data-id="${labelId}"><i class="fa-solid fa-plus" aria-hidden="true"></i>単語追加</button><button type="button" class="is-danger" data-op="header-delete" data-type="label" data-id="${labelId}"><i class="fa-solid fa-trash" aria-hidden="true"></i>削除</button></div>` : ""}</div>`;
  }

  const entryEl = id => root.querySelector(`.entry[data-word-id="${CSS.escape(id)}"]`);
  function rerenderEntry(id) {
    const el = entryEl(id), row = S.rows.get(id);
    if (!el || !row) return;
    // 入力中の欄があれば描き直さない（確定・取消のときに必ず描き直す）。
    if (hasActiveInlineIn(el)) { el.classList.toggle("is-saving", row.saving); return; }
    const template = document.createElement("template");
    template.innerHTML = entryHtml(row).trim();
    el.replaceWith(template.content.firstElementChild);
    if (S.selectedId === id) decorateSelected();
  }
  function refreshNumbers() {
    for (const el of root.querySelectorAll(".entry[data-word-id] > .entry-no")) {
      const id = el.parentElement.dataset.wordId;
      if (S.seq.has(id)) el.textContent = S.seq.get(id);
    }
  }

  // 選択中の単語に＋／−・メニュー・ドラッグの部品を重ねる。
  // The viewer groups meanings by part of speech and puts the primary meaning first.
  // 保存の進み具合：工程名と「n/全体」、完了時は満たしたバー（DESIGN.md）。
  function saveProgressHtml(row) {
    if (row.saveDone) return `<div class="edit-progress is-done" role="status"><span class="edit-progress-label">✓ 保存しました</span><progress max="1" value="1" aria-label="保存しました"></progress></div>`;
    const { steps, index } = row.saveProgress;
    const label = `${steps[index]}…`;
    return `<div class="edit-progress" role="status"><span class="edit-progress-label">${h(label)}</span><span class="edit-progress-count">${index + 1}/${steps.length}</span><progress max="${steps.length}" value="${index + 0.5}" aria-label="${h(label)}"></progress></div>`;
  }

  function senseGroups(senses) {
    const groups = new Map();
    for (const sense of senses) {
      if (!groups.has(sense.pos)) groups.set(sense.pos, []);
      groups.get(sense.pos).push(sense);
    }
    return [...groups.values()].map(group => group.sort((a, b) => Number(b.is_primary) - Number(a.is_primary)));
  }

  function openCollection(row, key, index = 0, field) {
    if (!beforeEdit(row)) return;
    const senses = key === "senses";
    const original = row.draft[key];
    const values = senses ? senseGroups(original).flat() : original;
    row.editingCollection = true;
    editWordCollection({
      word: row.draft.spelling, senses, values, positions: POS_OPTIONS, field,
      index: Math.max(0, values.indexOf(original[index])),
      onApply: next => { if (!same(next, values)) mutate(row, draft => { draft[key] = next; }); },
      onClose: () => { row.editingCollection = false; },
    });
  }

  function decorateSelected() {
    const id = S.selectedId;
    const article = id && entryEl(id);
    const row = id && S.rows.get(id);
    if (!article || !row || article.dataset.decorated) return;
    article.dataset.decorated = "1";
    article.querySelector(".entry-body").inert = row.saving;
    article.querySelector(".entry-no").inert = row.saving;
    const dirty = row.isNew || !same(row.base, row.draft);
    article.querySelector(".entry-body").insertAdjacentHTML("beforeend", `<div class="edit-word-actions">${dirty && !row.saving ? '<span class="edit-unsaved">未保存の変更があります</span>' : ""}<button type="button" class="edit-btn" data-op="reset-word"${dirty ? "" : " disabled"}>変更を取り消す</button><button type="button" class="edit-btn is-primary" data-op="save-word"${dirty ? "" : " disabled"}>保存</button></div>`);
    const btn = (op, label, attrs = "", cls = "edit-plus") => `<button type="button" class="${cls}" data-op="${op}" ${attrs} aria-label="${h(label)}">${cls === "edit-minus" ? "−" : "＋"}</button>`;
    const insert = (target, html, where = "beforeend") => target?.insertAdjacentHTML(where, html);
    const no = article.querySelector(".entry-no");
    no.classList.add("edit-drag-handle");
    no.title = "長押し（マウスはドラッグ）で並べ替え";
    const head = article.querySelector(".entry-head");
    // 見出し行の操作は、アイコンだけにせず短い文字を添える（DESIGN.md）。
    insert(head, `<span class="edit-head-tools"><button type="button" class="edit-chip" data-op="badges"><i class="fa-solid fa-tags" aria-hidden="true"></i>バッジ</button><button type="button" class="edit-chip" data-op="fields"><i class="fa-solid fa-table-list" aria-hidden="true"></i>欄</button><button type="button" class="edit-chip" data-op="menu" aria-label="その他の操作"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i>その他</button></span>`);
    const card = article.querySelector(".entry-card");
    for (const sense of article.querySelectorAll(".derivative-sense[data-derivative-index]")) insert(sense, btn("remove-derivative", "この派生語を削除", `data-index="${sense.dataset.derivativeIndex}"`, "edit-minus"));
    const derivatives = article.querySelector(".notes-derivative .notes-content");
    if (derivatives) insert(derivatives, `<button type="button" class="edit-add-inline" data-op="add-derivative"><i class="fa-solid fa-plus" aria-hidden="true"></i>派生語</button>`);
    for (const block of article.querySelectorAll(".notes-block[data-field]:not(.notes-derivative)")) insert(block, btn("remove-field", "この欄を削除", `data-field="${block.dataset.field}"`, "edit-minus"));
    const picture = card.querySelector(":scope > .entry-illustration");
    if (picture) {
      const column = document.createElement("div");
      column.className = "edit-illustrated-fields";
      for (const child of [...card.children]) if (child !== picture) column.append(child);
      card.append(column);
      card.classList.add("edit-illustrated-card");
    }
    if (row.error) insert(article.querySelector(".entry-body"), `<div class="edit-error" role="alert"><p>${h(row.error)}</p><div class="edit-error-actions">${row.conflict
      ? '<button type="button" class="edit-btn" data-op="reload-word">最新を読み込む</button><button type="button" class="edit-btn is-primary" data-op="overwrite-word">上書きして保存</button>'
      : '<button type="button" class="edit-btn is-primary" data-op="retry-save">もう一度保存</button>'}</div></div>`);
    root.querySelectorAll(".edit-insert-word").forEach(el => el.remove());
    if (!row.isNew) article.insertAdjacentHTML("afterend", `<button type="button" class="edit-add-bar edit-insert-word" data-op="insert-word" data-after="${h(id)}"><i class="fa-solid fa-plus" aria-hidden="true"></i> ここに単語を追加</button>`);
  }

  function clearSelectionChrome() {
    root.querySelectorAll(".edit-insert-word").forEach(el => el.remove());
  }
  function select(id) {
    if (S.selectedId === id) return;
    finishInlineEditing();
    const previous = S.selectedId;
    const previousHeader = S.selectedHeader;
    S.selectedId = id;
    S.selectedHeader = null;
    clearSelectionChrome();
    if (previous) rerenderEntry(previous);
    if (previousHeader) refreshHeader(previousHeader);
    if (id) { rerenderEntry(id); void freshen(S.rows.get(id)); }
  }
  function selectHeader(type, id) {
    finishInlineEditing();
    const previous = S.selectedId;
    S.selectedId = null;
    clearSelectionChrome();
    if (previous) rerenderEntry(previous);
    const previousHeader = S.selectedHeader;
    S.selectedHeader = type ? { type, id } : null;
    refreshHeader(previousHeader);
    refreshHeader(S.selectedHeader);
  }
  function rerenderHeaders() {
    const y = window.scrollY;
    renderShells();
    window.scrollTo(0, y);
  }

  // ---- 編集操作 ----
  let undoEntry = null;
  function rememberUndo(label, run, order = false) { undoEntry = { label, run, order }; }
  function offerUndo(message) {
    const entry = undoEntry;
    toast(message, entry ? { undo: () => {
      if (undoEntry !== entry || (entry.order && !canChangeOrder())) return;
      undoEntry = null;
      entry.run();
    } } : {});
  }

  function mutate(row, change) {
    const before = clone(row.draft);
    change(row.draft);
    rerenderEntry(row.id);
    return !same(before, row.draft);
  }

  function getPath(draft, path) {
    if (path === "derivativeWord") return "";
    return path.split(".").reduce((value, key) => value?.[key], draft) ?? "";
  }
  function setPath(draft, path, value, el) {
    if (path === "derivativeWord") {
      for (const index of el.dataset.derivativeIndexes.split(",").map(Number)) draft.derivatives[index].word = value;
      return;
    }
    const keys = path.split(".");
    const last = keys.pop();
    keys.reduce((obj, key) => obj[key], draft)[last] = value;
  }
  const isNewItemPath = (row, path) => {
    const [list, index, field] = path.split(".");
    if (!["senses", "examples", "derivatives"].includes(list)) return false;
    const item = row.draft[list][Number(index)];
    return item && (row.pendingItem === `${list}.${index}`) && ((list === "senses" && field === "meaning") || (list === "examples" && field === "sentence") || (list === "derivatives" && field === "word"));
  };

  function editField(row, el, options = {}) {
    if (!beforeEdit(row)) return;
    return editFieldNow(row, el, options);
  }
  function editFieldNow(row, el, { onDone } = {}) {
    const path = el.dataset.edit;
    const [key, index, field] = path.split(".");
    if (key === "senses" || key === "examples") return openCollection(row, key, Number(index), field);
    let value = path === "derivativeWord"
      ? row.draft.derivatives[Number(el.dataset.derivativeIndexes.split(",")[0])].word
      : getPath(row.draft, path);
    const fieldName = path.split(".").at(-1);
    const multiline = MULTILINE.has(fieldName) || fieldName === "translation" || fieldName === "sentence" || fieldName === "meaning";
    const multilineEnter = MULTILINE.has(fieldName);
    const placeholder = el.classList.contains("edit-empty") ? el.textContent : "";
    inlineEditor(el, String(value ?? ""), {
      multiline: multilineEnter,
      placeholder,
      onCommit: next => {
        const trimmed = multiline ? next.replace(/\s+$/, "") : next.trim();
        const newItem = isNewItemPath(row, path);
        row.pendingItem = null;
        if (newItem && !trimmed.trim()) {
          // 追加したばかりの行を空のまま確定したら、その行は作らない。
          const [list, index] = path.split(".");
          row.draft[list].splice(Number(index), 1);
          if (row.pendingUndoBase) { row.draft = row.pendingUndoBase; }
          row.pendingUndoBase = null;
          rerenderEntry(row.id);
          return;
        }
        if (path === "spelling" && !trimmed) { toast("見出し語は空にできません", { tone: "error" }); rerenderEntry(row.id); return; }
        row.pendingUndoBase = null;
        mutate(row, draft => setPath(draft, path, trimmed, el));
        if (newItem && path.startsWith("derivatives.") && path.endsWith(".word")) openEditor(row.id, path.replace(/\.word$/, ".meaning"));
        onDone?.();
      },
      onCancel: () => {
        if (isNewItemPath(row, path)) {
          row.draft = row.pendingUndoBase || row.draft;
          row.pendingUndoBase = null;
          row.pendingItem = null;
        }
        if (row.isNew && !row.draft.spelling && path === "spelling") return discardNewWord(row);
        rerenderEntry(row.id);
      },
    });
  }
  function openEditor(id, path) {
    requestAnimationFrame(() => {
      const el = entryEl(id)?.querySelector(`[data-edit="${CSS.escape(path)}"]`);
      const row = S.rows.get(id);
      if (el && row) editField(row, el);
    });
  }
  function addItem(row, list, item, at, editPath) {
    const before = clone(row.draft);
    const index = at ?? row.draft[list].length;
    row.draft[list].splice(index, 0, item);
    row.pendingItem = `${list}.${index}`;
    row.pendingUndoBase = before;
    rerenderEntry(row.id);
    openEditor(row.id, `${list}.${index}.${editPath}`);
  }

  // ---- 編集の起点をDBの最新にする ----
  // 表示は閲覧ページの公開データ（や端末キャッシュ）なので、公開が遅れているとDBより古い。
  // 古い内容を起点に編集すると、保存時に「別の編集で変更されています」と誤って止まる。
  // 選択したらDBの最新を読み、未編集なら起点を差し替える。編集を始める操作はこれを待つ。
  function freshen(row) {
    if (!row || row.isNew || row.fresh) return Promise.resolve();
    if (row.freshening) return row.freshening;
    row.freshening = api(`/words/${encodeURIComponent(row.id)}`).then(latest => {
      // 編集中（ダイアログを開いている・未保存の変更がある）なら起点は差し替えない。
      if (row.saving || row.editingCollection || isInlineEditing() || isSheetOpen() || !same(row.base, row.draft)) return;
      const next = draftOf(latest);
      row.fresh = true;
      if (same(next, row.base) && same(latest.illustration, row.raw.illustration)) return;
      row.raw = toViewer(latest, row.raw);
      row.base = next; row.draft = clone(next);
      rerenderEntry(row.id);
    }).catch(() => {}).finally(() => { row.freshening = null; });
    return row.freshening;
  }
  // 編集を始める操作。スマホでキーボードを開くため、ここでは待たずにすぐ開く
  // （最新の読み込みはタップした時点で始めている）。
  function beforeEdit(row) {
    void freshen(row);
    return S.rows.get(row.id) === row;
  }

  // ---- 保存 ----
  function resetWord(row) {
    if (row.isNew) return discardNewWord(row);
    row.draft = clone(row.base);
    row.pendingItem = row.pendingUndoBase = null;
    row.showFields.clear();
    row.error = "";
    row.conflict = false;
    rerenderEntry(row.id);
  }

  // 工程は利用者の言葉で示す（DESIGN.md「保存の進み具合」）。
  const updateSteps = ["最新の内容を確認しています", "保存しています"];
  const createSteps = ["発音記号を調べています", "単語を登録しています", "並び順を保存しています"];

  function showSaveStep(row, steps, index) {
    row.saving = true;
    row.saveDone = false;
    row.saveProgress = { steps, index };
    rerenderEntry(row.id);
  }
  // 完了は一度だけ満たしたバーで知らせ、少しして消す。
  function showSaveDone(row) {
    row.saving = false;
    row.saveDone = true;
    rerenderEntry(row.id);
    clearTimeout(row.saveDoneTimer);
    row.saveDoneTimer = setTimeout(() => { row.saveDone = false; rerenderEntry(row.id); }, 1600);
  }

  // force: 同じ欄が別の画面で変わっていても、自分の変更で上書きする（確認のうえで）。
  async function saveWord(row, { force = false } = {}) {
    if (row.saving) return;
    if (!row.draft.spelling.trim()) return toast("見出し語を入力してください", { tone: "error" });
    if (row.isNew) return commitNewWord(row);
    if (same(row.base, row.draft)) return rerenderEntry(row.id);
    row.error = ""; row.conflict = false;
    showSaveStep(row, updateSteps, 0);
    try {
      const sent = clone(row.draft);
      const latest = await api(`/words/${encodeURIComponent(row.id)}`, { fresh: true });
      if (!latest.lists?.some(l => l.listId === listId)) throw Object.assign(new Error("この単語は別の画面で単語帳から除外されています。再読み込みしてください。"), { conflict: true, removed: true });
      const latestDraft = draftOf(latest);
      let merged;
      if (force) {
        // 自分が変えた欄だけを、最新の内容の上に適用する。
        merged = clone(latestDraft);
        for (const key of changedKeys(row.base, sent)) merged[key] = clone(sent[key]);
      } else {
        try { merged = mergeDraft(row.base, sent, latestDraft); }
        catch (error) {
          error.conflict = true;
          error.message = "この単語は、ほかの画面で同じ項目が変更されています。";
          throw error;
        }
      }
      let saved = latest;
      const desired = cleanDraft(merged);
      const changed = changedKeys(latestDraft, desired);
      if (changed.length) {
        showSaveStep(row, updateSteps, 1);
        const path = `/words/${encodeURIComponent(row.id)}`;
        const body = wordPayload(desired, latest);
        body.updatedCollections = ["senses", "examples", "derivatives"].filter(key => changed.includes(key));
        if (changed.some(key => ["oxford5000", "cefr_provisional", "awl", "eiken", "custom"].includes(key))) body.updatedCollections.push("tags");
        const expected = draftOf({
          ...body, derivedFromSpelling: body.derivedFrom,
          tags: { ...body.tags, cefr_provisional: body.tags.cefr_provisional?.trim().toUpperCase() },
          senses: body.senses.map(s => ({ ...s, meaning: s.meaning.replace(/[〔【]/gu, "(").replace(/[〕】]/gu, ")") })),
          examples: body.examples.map(e => ({ ...e, type: "phrase" })),
        });
        saved = await saveExistingWord(path, row.id, body, detail => {
          const actual = draftOf(detail);
          return changed.filter(key => {
            // The database resolves parent spelling with SQLite's ASCII NOCASE collation.
            if (key === "derivedFrom") {
              const fold = value => value.replace(/[A-Z]/g, ch => ch.toLowerCase());
              return fold(actual[key]) !== fold(expected[key]);
            }
            return !same(actual[key], expected[key]);
          }).map(key => SAVE_FIELD_LABELS[key] || key);
        }, () => showSaveStep(row, [updateSteps[0], "保存結果を確認しています"], 1));
      }
      row.raw = toViewer(saved, row.raw);
      row.base = draftOf(saved);
      rememberSaved("word", row.id, row.raw);
      if (same(row.draft, sent)) row.draft = clone(row.base);
      const item = S.order.find(o => o.id === row.id);
      if (item && item.spelling !== row.base.spelling) { item.spelling = row.base.spelling; rebuildReferences(); }
      row.fresh = true;
      showSaveDone(row);
      toast(`「${row.base.spelling}」を保存しました`);
    } catch (error) {
      row.saving = false;
      row.error = error.unconfirmed ? error.message : error.conflict ? error.message : `保存できませんでした：${error.message}`;
      row.conflict = !!error.conflict && !error.removed;
      rerenderEntry(row.id);
      toast(row.error, { tone: "error", duration: 7000 });
    }
  }
  async function overwriteWord(row) {
    if (!confirm("ほかの画面での変更のうち、あなたが変えた項目だけを、あなたの内容で上書きします。よろしいですか？")) return;
    return saveWord(row, { force: true });
  }
  async function reloadWord(row) {
    if (!confirm("この単語の未保存の変更を取り消して、最新の内容を読み込みますか？")) return;
    const latest = await api(`/words/${encodeURIComponent(row.id)}`, { fresh: true });
    row.raw = toViewer(latest, row.raw);
    row.base = draftOf(latest); row.draft = clone(row.base); row.error = ""; row.conflict = false; row.fresh = true;
    rerenderEntry(row.id);
  }

  // ---- 単語の追加・削除 ----
  function insertNewWord(afterId, { sectionId, labelId } = {}) {
    if (!canChangeOrder()) return;
    finishInlineEditing();
    if (undoEntry?.order) undoEntry = null;
    let position, target;
    if (afterId) {
      const fam = family(afterId);
      target = fam[0];
      position = S.order.indexOf(fam.at(-1)) + 1;
      sectionId = target.sectionId; labelId = target.labelId;
    } else {
      const members = S.order.filter(item => item.sectionId === sectionId && (labelId === undefined || item.labelId === labelId));
      position = members.length ? S.order.indexOf(members.at(-1)) + 1 : S.order.findIndex(item => {
        const [c, s, l] = itemRank(item), [tc, ts, tl] = itemRank({ sectionId, labelId: labelId ?? null });
        return c > tc || (c === tc && (s > ts || (s === ts && l > tl)));
      });
      if (position < 0) position = S.order.length;
    }
    const id = `__new_${++S.tempId}`;
    const raw = { id, spelling: "", senses: [], examples: [], derivatives: [], tags: {}, branch: 0, sectionId: sectionId ?? null, labelId: labelId ?? null };
    S.order.splice(position, 0, { id, spelling: "", branch: 0, sectionId: sectionId ?? null, labelId: labelId ?? null });
    computeSeq();
    const row = makeRow(raw, true);
    S.rows.set(id, row);
    S.selectedId = id;
    clearSelectionChrome();
    renderSection(sectionKey(sectionId ?? null));
    refreshNumbers();
    openEditor(id, "spelling");
  }
  function discardNewWord(row) {
    if (row.saving || !canChangeOrder()) return;
    if (undoEntry?.order) undoEntry = null;
    S.order = S.order.filter(item => item.id !== row.id);
    S.rows.delete(row.id);
    if (S.selectedId === row.id) S.selectedId = null;
    computeSeq();
    const key = sectionKey(row.raw.sectionId);
    renderSection(key);
    refreshNumbers();
  }
  function commitNewWord(row) {
    return withOrderChange(() => createWordAndPlace(row));
  }
  async function createWordAndPlace(row) {
    const spelling = row.draft.spelling;
    if (undoEntry?.order) undoEntry = null;
    row.error = "";
    const needsPronunciation = !row.draft.pronunciation?.trim();
    const steps = needsPronunciation ? createSteps : createSteps.slice(1);
    const registrationStep = needsPronunciation ? 1 : 0;
    showSaveStep(row, steps, 0);
    try {
      if (needsPronunciation) {
        const pronunciation = await lookupNewWordPronunciation(spelling);
        if (pronunciation && !row.draft.pronunciation?.trim()) row.draft.pronunciation = pronunciation;
        showSaveStep(row, steps, registrationStep);
      }
      const item = S.order.find(o => o.id === row.id);
      const payload = { ...wordPayload(cleanDraft(row.draft)), listId, sectionId: item.sectionId, labelId: item.labelId };
      let saved;
      try {
        saved = await api("/words", { method: "POST", body: payload, writeTimeout: ORDER_WRITE_TIMEOUT });
        if (!saved?.id) throw new Error("登録応答を確認できません");
      } catch (error) {
        if (orderWriteRejected(error)) throw error;
        orderUnconfirmed = true;
        throw new Error("登録結果を確認できません。再登録せず、少し待ってから再読み込みして確認してください。");
      }
      const tempId = row.id;
      S.rows.delete(tempId);
      row.id = saved.id; row.isNew = false;
      row.raw = toViewer(saved, { branch: 0, sectionId: item.sectionId, labelId: item.labelId });
      row.base = draftOf(saved); row.draft = clone(row.base);
      S.rows.set(row.id, row);
      item.id = saved.id; item.spelling = saved.spelling;
      if (S.selectedId === tempId) S.selectedId = saved.id;
      computeSeq();
      rebuildReferences();
      showSaveStep(row, steps, registrationStep + 1);
      renderSection(sectionKey(item.sectionId));
      rememberSaved("word", row.id, row.raw);
      // 単語の作成後に並べ替えだけ失敗しても、単語を二重に作らない。
      try { await saveOrder(); }
      catch (error) {
        const message = orderUnconfirmed ? orderErrorMessage(error) : `${orderErrorMessage(error)} ページを再読み込みしてください。`;
        orderUnconfirmed = true;
        return toast(`単語を追加しました。${message}`, { tone: "error", duration: 7000 });
      }
      finally { row.saving = false; rerenderEntry(row.id); }
      rememberUndo("追加", () => removeWord(row, { confirmFirst: false }), true);
      offerUndo(`「${saved.spelling}」を追加しました`);
    } catch (error) {
      row.saving = false;
      row.error = `追加できませんでした：${error.message}`;
      rerenderEntry(row.id);
      toast(row.error, { tone: "error", duration: 7000 });
    }
  }
  function removeWord(row, options) {
    return withOrderChange(() => removeWordFromList(row, options));
  }
  async function removeWordFromList(row, { confirmFirst = true } = {}) {
    if (confirmFirst && !confirm(`「${row.draft.spelling}」を単語帳から削除しますか？（単語マスターのデータは残ります）`)) return;
    try {
      await api(`/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(row.id)}`, { method: "DELETE", writeTimeout: ORDER_WRITE_TIMEOUT });
      const key = sectionKey(S.order.find(item => item.id === row.id)?.sectionId ?? null);
      S.order = S.order.filter(item => item.id !== row.id);
      S.rows.delete(row.id);
      if (S.selectedId === row.id) S.selectedId = null;
      undoEntry = null;
      computeSeq();
      rebuildReferences();
      clearSelectionChrome();
      renderSection(key);
      refreshNumbers();
      toast(`「${row.draft.spelling}」を削除しました`);
    } catch (error) {
      if (!orderWriteRejected(error)) orderUnconfirmed = true;
      toast(orderUnconfirmed
        ? "削除結果を確認できません。少し待ってから再読み込みしてください。"
        : `削除できませんでした：${error.message}`, { tone: "error" });
    }
  }

  // ---- 並べ替え・移動 ----
  async function saveOrder() {
    const base = `/lists/${encodeURIComponent(listId)}`;
    const persisted = S.order.filter(item => !String(item.id).startsWith("__new_"));
    const items = persisted.filter(item => !item.branch).map(item => ({ wordId: item.id, sectionId: item.sectionId, labelId: item.labelId }));
    if (!items.length) return;
    try {
      const result = await api(`${base}/reorder`, { method: "POST", body: { items }, writeTimeout: ORDER_WRITE_TIMEOUT });
      if (!result?.ok || result.count !== items.length) throw new Error("保存応答を確認できません");
    } catch (error) {
      // These responses reject before the placement write starts. A timeout,
      // invalid receipt or 5xx is not proof that nothing was written.
      if (orderWriteRejected(error)) throw error;
      try {
        if (await verifySavedWordOrder(`${base}/words`, persisted)) return;
      } catch { /* An unreadable or lagging result is still unconfirmed. */ }
      orderUnconfirmed = true;
      throw error;
    }
  }
  function orderErrorMessage(error) {
    return orderUnconfirmed
      ? "並び順の保存結果を確認できません。少し待ってから、再読み込みして確認してください。"
      : `並び順を保存できませんでした：${error.message}`;
  }
  function syncRowPlacements() {
    for (const item of S.order) {
      const row = S.rows.get(item.id);
      if (row) { row.raw.sectionId = item.sectionId; row.raw.labelId = item.labelId; }
    }
  }
  function applyOrder(nextOrder, message, options) {
    return withOrderChange(() => updateWordOrder(nextOrder, message, options));
  }
  async function updateWordOrder(nextOrder, message, { undo = true } = {}) {
    const previous = S.order.map(item => ({ ...item }));
    const restorePlacements = () => {
      // An ordinary word edit can finish while this placement request is pending.
      const current = new Map(S.order.map(item => [item.id, item]));
      return previous.map(item => ({ ...item, spelling: current.get(item.id)?.spelling ?? item.spelling }));
    };
    const keys = new Set([...previous, ...nextOrder].map(item => sectionKey(item.sectionId)));
    S.order = nextOrder;
    normalizeOrder();
    syncRowPlacements();
    const rerender = () => {
      rebuildReferences();
      // 「Sectionなし」の枠がない状態でそこへ移したときは、枠ごと作り直す。
      const noneShown = !!root.querySelector(`[data-section-entries="${NONE}"]`);
      const noneNeeded = S.order.some(item => item.sectionId == null);
      if (noneShown !== noneNeeded) { const y = window.scrollY; renderShells(); window.scrollTo(0, y); }
      else for (const key of keys) renderSection(key);
      refreshNumbers();
      onStructureChange?.();
    };
    rerender();
    try {
      await saveOrder();
      if (undo) rememberUndo("移動", () => applyOrder(restorePlacements(), "元に戻しました", { undo: false }), true);
      if (undo) offerUndo(message); else toast(message);
    } catch (error) {
      if (!orderUnconfirmed) {
        S.order = restorePlacements();
        computeSeq();
        syncRowPlacements();
        rerender();
      } else if (undoEntry?.order) undoEntry = null;
      toast(orderErrorMessage(error), { tone: "error", duration: 7000 });
    }
  }
  function moveWordNear(id, targetId, before) {
    const moving = family(id);
    const target = headOf(targetId);
    if (!moving.length || !target || moving.includes(target)) return;
    const rest = S.order.filter(item => !moving.includes(item)).map(item => ({ ...item }));
    const targetFamily = (() => {
      const start = rest.findIndex(item => item.id === target.id);
      let end = start + 1;
      while (end < rest.length && rest[end].branch > 0) end += 1;
      return { start, end };
    })();
    const moved = moving.map(item => ({ ...item, sectionId: target.sectionId, labelId: target.labelId }));
    rest.splice(before ? targetFamily.start : targetFamily.end, 0, ...moved);
    return applyOrder(rest, `「${moving[0].spelling}」を移動しました`);
  }
  function moveWordsTo(ids, sectionId, labelId) {
    const moving = ids.flatMap(id => family(id));
    const unique = [...new Set(moving)];
    const rest = S.order.filter(item => !unique.includes(item)).map(item => ({ ...item }));
    const targetRank = itemRank({ sectionId, labelId });
    let index = rest.length;
    for (let i = rest.length - 1; i >= -1; i -= 1) {
      if (i < 0) { index = 0; break; }
      const rank = itemRank(rest[i]);
      if (rank[0] < targetRank[0] || (rank[0] === targetRank[0] && (rank[1] < targetRank[1] || (rank[1] === targetRank[1] && rank[2] <= targetRank[2])))) { index = i + 1; break; }
    }
    rest.splice(index, 0, ...unique.map(item => ({ ...item, sectionId, labelId })));
    return applyOrder(rest, `${ids.length}語を${sectionName(sectionId)}へ移動しました`);
  }

  function openMoveSheet(ids) {
    if (!canChangeOrder()) return;
    sheet(`${ids.length}語を移動`, body => {
      const form = document.createElement("div");
      form.className = "edit-form";
      const sectionSelect = document.createElement("select");
      sectionSelect.innerHTML = [`<option value="">Sectionなし</option>`, ...orderedSections().map(s => `<option value="${s.id}">${h(sectionName(s.id))}${s.subtitle ? ` ${h(s.subtitle)}` : ""}</option>`)].join("");
      const current = S.order.find(item => item.id === ids[0]);
      sectionSelect.value = current?.sectionId ?? "";
      const labelSelect = document.createElement("select");
      const fillLabels = () => {
        const sid = sectionSelect.value ? Number(sectionSelect.value) : null;
        labelSelect.innerHTML = [`<option value="">Labelなし</option>`, ...(sid == null ? [] : sectionLabels(sid)).map(l => `<option value="${l.id}">${h(l.name)}</option>`)].join("");
        labelSelect.disabled = sid == null;
      };
      fillLabels();
      sectionSelect.addEventListener("change", fillLabels);
      const label = (text, control) => { const el = document.createElement("label"); el.textContent = text; el.append(control); return el; };
      form.append(label("移動先のSection", sectionSelect), label("Label", labelSelect));
      const note = document.createElement("p");
      note.className = "edit-hint";
      note.textContent = "移動先の末尾に入ります。位置はあとからドラッグで調整できます。";
      const actions = document.createElement("div");
      actions.className = "edit-sheet-actions";
      const many = document.createElement("button");
      many.type = "button";
      many.textContent = "ほかの単語も選ぶ";
      many.addEventListener("click", () => { closeSheet(); startMulti(ids); });
      const ok = document.createElement("button");
      ok.type = "button"; ok.className = "primary"; ok.textContent = "移動する";
      ok.addEventListener("click", () => {
        if (!canChangeOrder()) return;
        closeSheet();
        endMulti();
        moveWordsTo(ids, sectionSelect.value ? Number(sectionSelect.value) : null, labelSelect.value ? Number(labelSelect.value) : null);
      });
      actions.append(many, ok);
      body.append(form, note, actions);
    });
  }
  function startMulti(ids = []) {
    S.multi = new Set(ids);
    select(null);
    document.body.classList.add("is-edit-multi");
    let bar = document.getElementById("editMultiBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "editMultiBar";
      bar.className = "edit-multi-bar";
      document.body.append(bar);
    }
    updateMultiBar();
    for (const key of S.loaded) renderSection(key);
  }
  function updateMultiBar() {
    const bar = document.getElementById("editMultiBar");
    if (!bar || !S.multi) return;
    bar.innerHTML = `<span>${S.multi.size}語を選択中</span><button type="button" data-multi="cancel">取消</button><button type="button" class="primary" data-multi="move"${S.multi.size ? "" : " disabled"}>移動先を選ぶ</button>`;
    bar.onclick = event => {
      const action = event.target.closest("[data-multi]")?.dataset.multi;
      if (action === "cancel") endMulti();
      if (action === "move") openMoveSheet([...S.multi].filter(id => !S.order.find(o => o.id === id)?.branch));
    };
  }
  function endMulti() {
    if (!S.multi) return;
    S.multi = null;
    document.body.classList.remove("is-edit-multi");
    document.getElementById("editMultiBar")?.remove();
    for (const key of S.loaded) renderSection(key);
  }

  // ---- シート（バッジ・欄・メニュー・詳細） ----
  function openBadgeSheet(row) {
    if (!beforeEdit(row)) return;
    sheet("バッジ", body => {
      const draw = () => {
        body.replaceChildren();
        tiles(body, "注意", CAUTIONS.map(([key, label, cls]) => ({
          html: `<span class="caution-badge ${cls}">${h(label)}</span>`, active: row.draft[key],
          onSelect: () => { mutate(row, d => { d[key] = !d[key]; }); draw(); },
        })), { columns: 4 });
        const oxford = row.raw.tags?.oxford5000;
        tiles(body, oxford ? `CEFR（Oxford 5000: ${oxford}。暫定値は表示されません）` : "CEFR（暫定）", [...CEFR, ""].map(level => ({
          html: level ? `<span class="learning-badge badge-cefr cefr-${level.toLowerCase()}">${level}</span>` : "なし",
          active: row.draft.cefr_provisional === level,
          onSelect: () => { mutate(row, d => { d.cefr_provisional = level; }); draw(); },
        })), { columns: 7 });
        tiles(body, "AWL", ["", ...Array.from({ length: 10 }, (_, i) => String(i + 1))].map(value => ({
          html: value ? `<span class="learning-badge badge-awl">AWL ${value}</span>` : "なし",
          active: row.draft.awl === value,
          onSelect: () => { mutate(row, d => { d.awl = value; }); draw(); },
        })), { columns: 6 });
      };
      draw();
    });
  }
  function openPosSheet(title, current, onPick) {
    sheet(title, body => {
      tiles(body, "", [...POS_OPTIONS, ...(current && !POS_OPTIONS.includes(current) ? [current] : []), ""].map(pos => ({
        html: pos ? `<span class="pos-badge">${h(pos)}</span>` : "なし",
        active: (current ?? null) === pos,
        onSelect: () => { closeSheet(); onPick(pos); },
      })), { columns: 5 });
    });
  }
  function openFieldSheet(row) {
    if (!beforeEdit(row)) return;
    sheet("欄", body => {
      const draw = () => {
        body.replaceChildren();
        menuList(body, [
          { label: "意味を編集", icon: "fa-list", onSelect: () => openCollection(row, "senses") },
          { label: "フレーズを編集", icon: "fa-quote-left", onSelect: () => openCollection(row, "examples") },
        ]);
        tiles(body, "付けると空の欄が追加されます。外すとその欄の内容を削除します。", NOTE_FIELDS.map(([field, label, type]) => {
          const active = field === "derivatives" ? row.draft.derivatives.length > 0 || row.showFields.has(field) : !!row.draft[field] || row.showFields.has(field);
          return {
            html: `<span class="notes-label ${type}-badge"><span class="notes-label-text">${h(label)}</span></span>`, active,
            onSelect: () => {
              if (active) { closeSheet(); removeField(row, field); }
              else {
                closeSheet();
                row.showFields.add(field);
                if (field === "derivatives") addItem(row, "derivatives", { word: "", pos: "", meaning: "" }, undefined, "word");
                else { rerenderEntry(row.id); openEditor(row.id, field); }
              }
            },
          };
        }), { columns: 4 });
      };
      draw();
    });
  }
  function removeField(row, field) {
    row.showFields.delete(field);
    mutate(row, d => { if (field === "derivatives") d.derivatives = []; else d[field] = ""; });
  }
  async function openDetail(row) {
    // スナップショットにない項目（英検・カスタムタグなど）を含む最新の内容で開く。
    if (!row.isNew && !row.saving && same(row.base, row.draft)) {
      try {
        const latest = await api(`/words/${encodeURIComponent(row.id)}`, { fresh: true });
        row.raw = toViewer(latest, row.raw);
        row.base = draftOf(latest); row.draft = clone(row.base);
        rerenderEntry(row.id);
      } catch (error) { return toast(`読み込めませんでした：${error.message}`, { tone: "error" }); }
    }
    openDetailSheet(row);
  }
  function openMenu(row) {
    sheet(row.draft.spelling || "単語", body => menuList(body, [
      { label: "詳細（表示されない項目）", icon: "fa-sliders", onSelect: () => openDetail(row) },
      { label: "移動", icon: "fa-arrow-right-arrow-left", disabled: row.isNew || row.raw.branch > 0, onSelect: () => openMoveSheet([row.id]) },
      { label: "辞書から下書き", icon: "fa-book", onSelect: () => draftFromDictionary(row) },
      { label: "発音記号を取得", icon: "fa-volume-high", onSelect: () => lookupPronunciation(row) },
      { label: "発音を聞く", icon: "fa-play", onSelect: () => playPronunciation(row.draft.spelling, { audioUrl: row.raw.generatedAudio?.url, onUnsupported: () => toast("この端末は音声読み上げに対応していません") }) },
      { label: "削除（単語帳から除外）", icon: "fa-trash", danger: true, onSelect: () => row.isNew ? discardNewWord(row) : removeWord(row) },
    ]));
  }
  async function lookupPronunciation(row) {
    const info = await api(`/lookup?spelling=${encodeURIComponent(row.draft.spelling)}`).catch(() => null);
    if (!info?.pronunciation) return toast(`「${row.draft.spelling}」の発音記号が見つかりませんでした`, { tone: "error" });
    mutate(row, d => { d.pronunciation = info.pronunciation; });
  }
  async function draftFromDictionary(row) {
    const info = await api(`/lookup?spelling=${encodeURIComponent(row.draft.spelling)}`).catch(() => null);
    if (!info || info.error) return toast(`「${row.draft.spelling}」の情報が辞書から見つかりませんでした`, { tone: "error" });
    const changed = mutate(row, d => {
      if (info.pronunciation && !d.pronunciation) d.pronunciation = info.pronunciation;
      if (!d.examples.length && info.examples?.length) d.examples.push({ type: "phrase", sentence: info.examples[0], translation: "", answer: "" });
      if (info.synonyms?.length && !d.synonyms) d.synonyms = info.synonyms.join(", ");
      if (info.antonyms?.length && !d.antonyms) d.antonyms = info.antonyms.join(", ");
    });
    if (!changed) toast("追加できる情報はありませんでした");
  }
  function openDetailSheet(row) {
    const before = clone(row.draft);
    const draft = clone(row.draft);
    sheet(`詳細：${row.draft.spelling}`, body => {
      const form = document.createElement("div");
      form.className = "edit-form";
      const field = (labelText, control) => { const label = document.createElement("label"); label.textContent = labelText; label.append(control); form.append(label); return control; };
      const select = (options, value) => { const el = document.createElement("select"); el.innerHTML = options.map(([v, t]) => `<option value="${h(v)}">${h(t)}</option>`).join(""); el.value = value; return el; };
      const input = (value, attrs = {}) => { const el = document.createElement("input"); el.value = value; Object.assign(el, attrs); return el; };
      const eiken = field("英検", select([["", "―"], ...EIKEN.map(v => [v, v])], draft.eiken));
      eiken.addEventListener("change", () => { draft.eiken = eiken.value; });
      const custom = field("カスタムタグ（カンマ区切り）", input(draft.custom));
      custom.addEventListener("input", () => { draft.custom = custom.value; });
      const derived = field("派生元の見出し語", input(draft.derivedFrom));
      derived.addEventListener("input", () => { draft.derivedFrom = derived.value; });
      const readonly = [["Oxford 5000", row.raw.tags?.oxford5000], ["Target1900", row.raw.tags?.target1900], ["Target1400", row.raw.tags?.target1400]].filter(([, v]) => v);
      if (readonly.length) { const p = document.createElement("p"); p.className = "edit-hint"; p.textContent = readonly.map(([k, v]) => `${k}: ${v}`).join(" ／ "); form.append(p); }
      if (draft.senses.length) {
        const heading = document.createElement("h3"); heading.textContent = "意味（見出しの意味・品詞別の発音）"; form.append(heading);
        draft.senses.forEach((sense, index) => {
          const rowEl = document.createElement("div"); rowEl.className = "edit-detail-row";
          const radio = input("", { type: "radio", name: "primarySense", checked: !!sense.is_primary, ariaLabel: "見出しの意味" });
          radio.addEventListener("change", () => draft.senses.forEach((s, i) => { s.is_primary = i === index; }));
          const text = document.createElement("span"); text.textContent = `${sense.pos ? `[${sense.pos}] ` : ""}${sense.meaning}`;
          const pron = input(sense.pronunciation, { placeholder: "品詞別の発音", ariaLabel: "品詞別の発音" });
          pron.addEventListener("input", () => { sense.pronunciation = pron.value; });
          rowEl.append(radio, text, pron); form.append(rowEl);
        });
      }
      if (draft.examples.length) {
        const heading = document.createElement("h3"); heading.textContent = "フレーズの穴埋めの答え"; form.append(heading);
        draft.examples.forEach(example => {
          const rowEl = document.createElement("div"); rowEl.className = "edit-detail-row";
          const text = document.createElement("span"); text.textContent = example.sentence;
          const answer = input(example.answer, { placeholder: "答え（＿＿がある場合）", ariaLabel: "穴埋めの答え" });
          answer.addEventListener("input", () => { example.answer = answer.value; });
          rowEl.append(text, answer); form.append(rowEl);
        });
      }
      const links = document.createElement("p");
      links.className = "edit-hint";
      links.innerHTML = '音声生成は<a href="./classic.html">旧編集画面</a>、イラストは<a href="./illustrations.html">イラスト管理</a>で行います。';
      form.append(links);
      body.append(form);
    }, {
      onClose: () => {
        if (same(before, draft)) return;
        mutate(row, d => Object.assign(d, draft));
      },
    });
  }

  // ---- Chapter・Section・Labelの編集 ----
  async function structureCall(path, options, message, { affectsOrder = false } = {}) {
    try {
      const result = await api(`/lists/${encodeURIComponent(listId)}${path}`, affectsOrder ? { ...options, writeTimeout: ORDER_WRITE_TIMEOUT } : options);
      if (message) toast(message);
      return result;
    } catch (error) {
      if (affectsOrder && !orderWriteRejected(error)) orderUnconfirmed = true;
      toast(orderUnconfirmed && affectsOrder ? orderErrorMessage(error) : `保存できませんでした：${error.message}`, { tone: "error", duration: 7000 });
      throw error;
    }
  }
  function editHeaderText(el, type, id, key) {
    const item = type === "chapter" ? chapterById(id) : type === "section" ? sectionById(id) : labelById(id);
    if (!item) return;
    const current = key === "name" ? item.name : item.subtitle || "";
    inlineEditor(el, current, {
      placeholder: key === "name" ? "Label名" : "サブタイトル",
      onCommit: async value => {
        const next = value.trim();
        const redraw = () => refreshHeader({ type, id });
        if (next === current || (key === "name" && !next)) return redraw();
        const previous = { ...item };
        if (key === "name") item.name = next; else item.subtitle = next;
        redraw();
        try {
          await putHeader(type, item);
          rememberUndo("見出し", async () => { Object.assign(item, previous); redraw(); await putHeader(type, item); toast("元に戻しました"); });
          offerUndo("見出しを保存しました");
        } catch { Object.assign(item, previous); redraw(); }
      },
      onCancel: () => refreshHeader({ type, id }),
    });
  }
  async function putHeader(type, item) {
    if (type === "label") return structureCall(`/labels/${item.id}`, { method: "PUT", body: { name: item.name } });
    const path = type === "chapter" ? `/chapters/${item.id}` : `/sections/${item.id}`;
    const result = await structureCall(path, { method: "PUT", body: { subtitle: item.subtitle || null, description: item.description || null } });
    onStructureChange?.();
    return result;
  }
  function openDescription(type, id) {
    const item = type === "chapter" ? chapterById(id) : sectionById(id);
    const before = item.description || "";
    let value = before;
    sheet(`${type === "chapter" ? chapterName(id) : sectionName(id)}の説明`, body => {
      const textarea = document.createElement("textarea");
      textarea.className = "edit-textarea";
      textarea.rows = 6;
      textarea.value = before;
      textarea.addEventListener("input", () => { value = textarea.value; });
      body.append(textarea);
      requestAnimationFrame(() => textarea.focus());
    }, {
      onClose: async () => {
        if (value.trim() === before) return;
        item.description = value.trim();
        try { await putHeader(type, item); toast("説明を保存しました"); } catch { item.description = before; }
      },
    });
  }
  async function moveHeader(type, id, dir) {
    if (type === "chapter") {
      const order = [...S.chapters];
      const index = order.findIndex(c => c.id === id), to = index + dir;
      if (to < 0 || to >= order.length) return;
      [order[index], order[to]] = [order[to], order[index]];
      return saveChapterOrder(order);
    }
    const order = orderedSections();
    const index = order.findIndex(s => s.id === id), to = index + dir;
    if (to < 0 || to >= order.length) return;
    const current = { ...order[index] }, neighbor = order[to];
    if ((current.chapterId ?? null) === (neighbor.chapterId ?? null)) {
      order[index] = order[to]; order[to] = current;
    } else {
      current.chapterId = neighbor.chapterId ?? null;
      current.groupId = dir < 0 ? neighbor.groupId ?? null : neighbor.groupId ?? null;
      order[index] = current;
    }
    return saveSectionOrder(order);
  }
  function saveSectionOrder(order) {
    return withOrderChange(() => updateSectionOrder(order));
  }
  async function updateSectionOrder(order) {
    if (undoEntry?.order) undoEntry = null;
    const previous = S.sections.map(s => ({ ...s }));
    S.sections = order.map((s, index) => ({ ...s, sortOrder: index + 1 }));
    normalizeOrder();
    rerenderHeaders();
    onStructureChange?.();
    try {
      await structureCall("/sections/reorder", { method: "POST", body: { sections: S.sections.map(s => ({ id: s.id, chapterId: s.chapterId ?? null, groupId: s.groupId ?? null })) } }, "Sectionの順番を保存しました", { affectsOrder: true });
    } catch {
      if (!orderUnconfirmed) { S.sections = previous; normalizeOrder(); rerenderHeaders(); onStructureChange?.(); }
    }
  }
  function saveChapterOrder(order) {
    return withOrderChange(() => updateChapterOrder(order));
  }
  async function updateChapterOrder(order) {
    if (undoEntry?.order) undoEntry = null;
    const previous = S.chapters.map(c => ({ ...c }));
    S.chapters = order.map((c, index) => ({ ...c, sortOrder: index + 1 }));
    normalizeOrder();
    rerenderHeaders();
    onStructureChange?.();
    try { await structureCall("/chapters/reorder", { method: "POST", body: { chapterIds: S.chapters.map(c => c.id) } }, "Chapterの順番を保存しました", { affectsOrder: true }); }
    catch { if (!orderUnconfirmed) { S.chapters = previous; normalizeOrder(); rerenderHeaders(); onStructureChange?.(); } }
  }
  function deleteHeader(type, id) {
    return withOrderChange(() => deleteWordHeader(type, id));
  }
  async function deleteWordHeader(type, id) {
    if (type === "label") {
      const label = labelById(id);
      const count = S.order.filter(item => item.labelId === id).length;
      if (!confirm(`Label「${label.name}」を削除しますか？${count ? `（${count}語はLabelなしになります）` : ""}`)) return;
      await structureCall(`/labels/${id}`, { method: "DELETE" }, "Labelを削除しました", { affectsOrder: true });
      S.labels = S.labels.filter(l => l.id !== id);
      for (const item of S.order) if (item.labelId === id) item.labelId = null;
    } else if (type === "section") {
      const count = S.order.filter(item => item.sectionId === id).length;
      if (!confirm(`${sectionName(id)}を削除しますか？${count ? `（${count}語は「Sectionなし」になります）` : ""}`)) return;
      await structureCall(`/sections/${id}`, { method: "DELETE" }, "Sectionを削除しました", { affectsOrder: true });
      S.sections = S.sections.filter(s => s.id !== id);
      S.labels = S.labels.filter(l => l.sectionId !== id);
      for (const item of S.order) if (item.sectionId === id) { item.sectionId = null; item.labelId = null; }
      S.loaded.delete(NONE);
    } else {
      if (!confirm(`${chapterName(id)}を削除しますか？（中のSectionはChapterなしになります）`)) return;
      await structureCall(`/chapters/${id}`, { method: "DELETE" }, "Chapterを削除しました", { affectsOrder: true });
      S.chapters = S.chapters.filter(c => c.id !== id);
      for (const section of S.sections) if (section.chapterId === id) { section.chapterId = null; section.groupId = null; }
    }
    S.selectedHeader = null;
    if (undoEntry?.order) undoEntry = null;
    normalizeOrder();
    syncRowPlacements();
    rerenderHeaders();
    onStructureChange?.();
  }
  function addSection(afterId, chapterId) {
    return withOrderChange(() => createSection(afterId, chapterId));
  }
  async function createSection(afterId, chapterId) {
    const after = afterId != null ? sectionById(afterId) : null;
    const body = { chapterId: after ? after.chapterId ?? null : chapterId ?? null, groupId: after ? after.groupId ?? null : null };
    const created = await structureCall("/sections", { method: "POST", body }, undefined, { affectsOrder: true });
    S.sections.push({ ...created, name: "", subtitle: created.subtitle || "", chapterId: body.chapterId, groupId: body.groupId });
    const order = orderedSections().filter(s => s.id !== created.id);
    const index = after ? order.findIndex(s => s.id === after.id) + 1 : order.filter(s => chapterSort(s.chapterId) <= chapterSort(chapterId)).length;
    order.splice(index, 0, sectionById(created.id));
    S.selectedHeader = { type: "section", id: created.id };
    await updateSectionOrder(order);
    requestAnimationFrame(() => root.querySelector(`#section-${created.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }
  async function addChapter() {
    const created = await structureCall("/chapters", { method: "POST", body: {} }, "Chapterを追加しました");
    S.chapters.push({ ...created });
    S.selectedHeader = { type: "chapter", id: created.id };
    rerenderHeaders();
    onStructureChange?.();
    requestAnimationFrame(() => root.querySelector(`#chapter-${created.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }
  async function addLabel(sectionId) {
    const name = prompt("Label名");
    if (!name?.trim()) return;
    const created = await structureCall("/labels", { method: "POST", body: { name: name.trim(), sectionId } }, "Labelを追加しました");
    S.labels.push({ id: created.id, sectionId, name: name.trim(), sortOrder: created.sortOrder ?? (Math.max(0, ...sectionLabels(sectionId).map(l => l.sortOrder)) + 1) });
    renderSection(sectionKey(sectionId));
  }

  // ---- 移動 ----
  const navigateTo = createNavigator();
  function sectionCounts() {
    const counts = new Map();
    for (const item of S.order) {
      const key = sectionKey(item.sectionId);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }
  function navSections() {
    const counts = sectionCounts();
    const list = orderedSections().map(section => ({ key: String(section.id), name: sectionName(section.id), subtitle: section.subtitle || "", count: counts.get(String(section.id)) || 0 }));
    return S.order.some(item => item.sectionId == null) ? [{ key: NONE, name: "Sectionなし", subtitle: "", count: 0 }, ...list] : list;
  }

  // ---- イベント ----
  root.addEventListener("click", event => {
    // ダブルタップで入力欄に置き換えた要素のclickは無視する（すぐ確定しないように）。
    if (!event.target.isConnected || event.target.closest(".edit-inline")) return;
    const link = event.target.closest("a.ref, a");
    if (link && root.contains(link)) event.preventDefault();
    const opEl = event.target.closest("[data-op]");
    const article = event.target.closest(".entry[data-word-id]");
    const row = article && S.rows.get(article.dataset.wordId);
    // タップした時点で最新の読み込みを始める（ダブルタップの2回目までに終わることが多い）。
    if (row) void freshen(row);
    if (opEl) return handleOp(opEl, row);
    const speak = event.target.closest('[data-action="speak"]');
    if (speak) return playPronunciation(speak.dataset.text, { audioUrl: speak.dataset.audioUrl, button: speak });
    if (S.multi && row) {
      if (row.raw.branch > 0) return toast("派生語の行は親の単語と一緒に移動します");
      if (S.multi.has(row.id)) S.multi.delete(row.id); else S.multi.add(row.id);
      rerenderEntry(row.id); updateMultiBar();
      return;
    }
    if (row) {
      if (S.selectedId !== row.id) return;
      if (row.saving) return;
      const pos = event.target.closest("[data-edit-pos]");
      const derivativePos = event.target.closest("[data-edit-derivative-pos]");
      if (derivativePos) {
        const index = Number(derivativePos.dataset.editDerivativePos);
        return openPosSheet("派生語の品詞", row.draft.derivatives[index]?.pos || "", value => mutate(row, d => { d.derivatives[index].pos = value; }));
      }
      if (pos && (event.target.closest(".pos-badge"))) {
        return openCollection(row, "senses", row.draft.senses.findIndex(s => s.pos === pos.dataset.editPos), "pos");
      }
      if (event.target.closest(".caution-badge, .learning-badge")) return openBadgeSheet(row);
      if (event.target.closest("[data-edit-field-badge]")) return openFieldSheet(row);
      return;
    }
    const header = event.target.closest("[data-header]");
    if (header) {
      const type = header.dataset.header;
      const id = type === "section" && header.dataset.id === NONE ? null : Number(header.dataset.id);
      if (id == null) return;
      if (S.selectedHeader?.type === type && S.selectedHeader.id === id) return;
      return selectHeader(type, id);
    }
    if (!event.target.closest(".edit-add-bar")) {
      if (S.selectedId) select(null);
      else if (S.selectedHeader) selectHeader(null);
    }
  });

  onDoubleActivate(root, (event, target) => {
    if (target.closest(".edit-inline, [data-op], .edit-header-tools")) return;
    const article = target.closest(".entry[data-word-id]");
    if (article) {
      const row = S.rows.get(article.dataset.wordId);
      if (!row || row.saving || S.multi || target.closest("button, input, textarea")) return;
      const line = target.closest("[data-example-index], [data-sense-index], .sense-line[data-edit-pos]");
      if (line) {
        const phrase = line.hasAttribute("data-example-index");
        const index = phrase ? Number(line.dataset.exampleIndex) : line.hasAttribute("data-sense-index") ?
          Number(line.dataset.senseIndex) : row.draft.senses.findIndex(s => s.pos === line.dataset.editPos);
        if (S.selectedId !== row.id) select(row.id);
        return openCollection(row, phrase ? "examples" : "senses", index, target.closest("[data-edit]")?.dataset.edit.split(".").at(-1));
      }
      if (target.closest("a")) return;
      const field = target.closest("[data-edit]");
      if (!field || !article.contains(field)) return select(row.id);
      const path = field.dataset.edit;
      const indexes = field.dataset.derivativeIndexes;
      if (S.selectedId !== row.id) {
        select(row.id);
        const selector = indexes ? `[data-edit="derivativeWord"][data-derivative-indexes="${indexes}"]` : `[data-edit="${CSS.escape(path)}"]`;
        const next = entryEl(row.id)?.querySelector(selector);
        if (next) editField(row, next);
        return;
      }
      editField(row, field);
      return;
    }
    const header = target.closest("[data-header]");
    const editable = target.closest("[data-edit-header]");
    if (header && editable) {
      const type = header.dataset.header;
      if (header.dataset.id === NONE) return;
      const id = Number(header.dataset.id);
      const key = editable.dataset.editHeader;
      if (!(S.selectedHeader?.type === type && S.selectedHeader.id === id)) {
        selectHeader(type, id);
        const fresh = root.querySelector(`[data-header="${type}"][data-id="${id}"] [data-edit-header="${key}"]`);
        if (fresh) editHeaderText(fresh, type, id, key);
        return;
      }
      editHeaderText(editable, type, id, key);
    }
  });

  // Keep the button under the pointer until its click commits the active input.
  root.addEventListener("pointerdown", event => {
    if (event.target.closest('[data-op="save-word"], [data-op="reset-word"]')) event.preventDefault();
  });

  const DRAFT_OPS = new Set(["add-derivative", "remove-derivative", "remove-field"]);
  function handleOp(el, row) {
    const op = el.dataset.op;
    if (row && DRAFT_OPS.has(op) && !beforeEdit(row)) return;
    const id = el.dataset.id != null ? Number(el.dataset.id) : null;
    switch (op) {
      case "add-derivative": return addItem(row, "derivatives", { word: "", pos: "", meaning: "" }, undefined, "word");
      case "remove-derivative": return mutate(row, d => { d.derivatives.splice(Number(el.dataset.index), 1); });
      case "remove-field": return removeField(row, el.dataset.field);
      case "badges": return openBadgeSheet(row);
      case "fields": return openFieldSheet(row);
      case "menu": return openMenu(row);
      case "insert-word": return insertNewWord(el.dataset.after);
      case "add-first-word": return insertNewWord(null, { sectionId: el.dataset.section === NONE ? null : Number(el.dataset.section), labelId: null });
      case "add-word-in-label": { const label = labelById(id); return insertNewWord(null, { sectionId: label.sectionId, labelId: id }); }
      case "reset-word":
      case "save-word":
      case "retry-save":
        finishInlineEditing();
        if (row.saving) return;
        return op === "reset-word" ? resetWord(row) : saveWord(row);
      case "reload-word": return reloadWord(row);
      case "overwrite-word": return overwriteWord(row);
      case "retry-section": return loadSection(el.dataset.key);
      case "header-description": return openDescription(el.dataset.type, id);
      case "header-move": return moveHeader(el.dataset.type, id, Number(el.dataset.dir));
      case "header-delete": return deleteHeader(el.dataset.type, id).catch(() => {});
      case "add-label": return addLabel(id).catch(() => {});
      case "add-section-after": return addSection(id).catch(() => {});
      case "add-section-in-chapter": return addSection(null, id).catch(() => {});
      case "add-chapter": return addChapter().catch(() => {});
    }
  }

  sortable(root, {
    handleSelector: ".entry.is-edit-selected > .entry-no",
    itemSelector: ".entry[data-word-id]",
    idOf: el => el.dataset.wordId,
    canDrag: el => !S.rows.get(el.dataset.wordId)?.isNew &&
      !(S.order.find(o => o.id === el.dataset.wordId)?.branch > 0) && canChangeOrder(),
    canDrop: (item, target) => !(S.order.find(o => o.id === target.dataset.wordId)?.branch > 0) && !S.rows.get(target.dataset.wordId)?.isNew,
    onDrop: (id, targetId, before) => moveWordNear(id, targetId, before),
  });

  window.addEventListener("beforeunload", event => {
    const busy = orderSaving || [...S.rows.values()].some(row => row.saving || row.error || row.isNew || !same(row.base, row.draft)) || isInlineEditing();
    if (busy) { event.preventDefault(); event.returnValue = ""; }
  });

  return {
    load,
    state: S,
    sectionName, chapterName, groupName, orderedSections, chapterById,
    saveSectionOrder, saveChapterOrder,
    // 閲覧ページと同じ手順で移動する（移動先と直前だけを読み込み、位置を確定してから合わせる）。
    navigateToSection(key, { targetId, block = "start", select: selectId } = {}) {
      const sectionKeyValue = String(key);
      return navigateTo({
        sections: navSections(),
        targetKey: sectionKeyValue,
        load: loadSection,
        groupOf: k => root.querySelector(`.section-group[data-section-key="${CSS.escape(k)}"]`),
        target: () => document.getElementById(targetId || `section-${sectionKeyValue}`),
        pause: () => { S.navPaused = true; S.observer?.disconnect(); },
        resume: () => { S.navPaused = false; observeSections(); },
        block,
        onArrive: () => { if (selectId) select(selectId); },
      }).catch(error => toast(`移動先を読み込めませんでした：${error.message}`, { tone: "error" }));
    },
    navigateToChapter(id) {
      const first = orderedSections().find(s => s.chapterId === id);
      if (first) return this.navigateToSection(String(first.id), { targetId: `chapter-${id}` });
      root.querySelector(`#chapter-${id}`)?.scrollIntoView({ block: "start" });
    },
    navigateToWord(id) {
      const item = S.order.find(o => o.id === id);
      if (!item) return toast("この単語は見つかりません");
      return this.navigateToSection(sectionKey(item.sectionId), { targetId: `word-${id}`, block: "center", select: id });
    },
    jumpTo(number) {
      const id = [...S.seq].find(([, seq]) => seq === String(number))?.[0];
      if (!id) return toast(`No. ${number} は見つかりません`);
      return this.navigateToWord(id);
    },
    navSections,
    seqOf: id => S.seq.get(id),
    sectionCount: id => S.order.filter(item => item.sectionId === id).length,
  };
}
