import { renderMarkup } from "../shared/markup.js";
import { API_BASE } from "../shared/config.js";
import { formatPronunciationWithAccents } from "../shared/pronunciation.js";

const API = `${API_BASE}/api`;
const NEW_SECTION_VALUE = "__new__";
const MASTER_LIST_ID = "__master__";
const LAST_LIST_KEY = "vocab-setting-last-list";
const THEME_KEY = "vocab-setting-theme";

const state = {
  lists: [],
  currentListId: null,
  listWordIndex: new Map(),
  words: [],
  sections: [],
  currentSectionId: null,
  currentWord: null,
  isNew: false,
  currentAudioUrl: null,
  selectedWordIds: new Set(),
  masterFilter: { q: "", awl: "", oxford: "", target1900: "", target1400: "" },
  masterOffset: 0,
  masterHasMore: false,
  masterLoading: false,
};

const MASTER_PAGE_SIZE = 150;
let masterSearchTimer = null;
let dragState = null; // { type: "word" | "section", id }

const el = {
  layout: document.getElementById("layout"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  menuToggle: document.getElementById("menuToggle"),
  topbarMenu: document.getElementById("topbarMenu"),
  editModalOverlay: document.getElementById("editModalOverlay"),
  sectionModalOverlay: document.getElementById("sectionModalOverlay"),
  sectionEditPane: document.getElementById("sectionEditPane"),
  sectionEditTitle: document.getElementById("sectionEditTitle"),
  sectionSaveBtn: document.getElementById("sectionSaveBtn"),
  sectionDeleteBtn: document.getElementById("sectionDeleteBtn"),
  sectionCloseBtn: document.getElementById("sectionCloseBtn"),
  sectionForm: document.getElementById("sectionForm"),
  sectionFieldName: document.getElementById("sectionFieldName"),
  sectionFieldSubtitle: document.getElementById("sectionFieldSubtitle"),
  sectionFieldDescription: document.getElementById("sectionFieldDescription"),
  listSelect: document.getElementById("listSelect"),
  newListBtn: document.getElementById("newListBtn"),
  listTitle: document.getElementById("listTitle"),
  newWordBtn: document.getElementById("newWordBtn"),
  newSectionBtn: document.getElementById("newSectionBtn"),
  masterToolbar: document.getElementById("masterToolbar"),
  masterSearch: document.getElementById("masterSearch"),
  filterAwl: document.getElementById("filterAwl"),
  filterOxford: document.getElementById("filterOxford"),
  filterTarget1900: document.getElementById("filterTarget1900"),
  filterTarget1400: document.getElementById("filterTarget1400"),
  selectionCount: document.getElementById("selectionCount"),
  selectAllMasterBtn: document.getElementById("selectAllMasterBtn"),
  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
  addToNotebookBtn: document.getElementById("addToNotebookBtn"),
  addNotebookModalOverlay: document.getElementById("addNotebookModalOverlay"),
  addNotebookConfirmBtn: document.getElementById("addNotebookConfirmBtn"),
  addNotebookCloseBtn: document.getElementById("addNotebookCloseBtn"),
  addNotebookCount: document.getElementById("addNotebookCount"),
  addNotebookSelect: document.getElementById("addNotebookSelect"),
  addNotebookSection: document.getElementById("addNotebookSection"),
  wordTableHead: document.getElementById("wordTableHead"),
  wordTableBody: document.getElementById("wordTableBody"),
  wordTableEmpty: document.getElementById("wordTableEmpty"),
  tableScroll: document.getElementById("tableScroll"),
  masterLoadingMore: document.getElementById("masterLoadingMore"),
  editPane: document.getElementById("editPane"),
  editTitle: document.getElementById("editTitle"),
  saveBtn: document.getElementById("saveBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  closeBtn: document.getElementById("closeBtn"),
  notebookFields: document.getElementById("notebookFields"),
  fieldNo: document.getElementById("fieldNo"),
  fieldSpelling: document.getElementById("fieldSpelling"),
  fieldPronunciation: document.getElementById("fieldPronunciation"),
  lookupPronunciationBtn: document.getElementById("lookupPronunciationBtn"),
  playAudioBtn: document.getElementById("playAudioBtn"),
  pronunciationCautionBtn: document.getElementById("pronunciationCautionBtn"),
  accentCautionBtn: document.getElementById("accentCautionBtn"),
  draftFromDictionaryBtn: document.getElementById("draftFromDictionaryBtn"),
  fieldDerivedFrom: document.getElementById("fieldDerivedFrom"),
  fieldSection: document.getElementById("fieldSection"),
  sensesList: document.getElementById("sensesList"),
  derivativesList: document.getElementById("derivativesList"),
  examplesList: document.getElementById("examplesList"),
  fieldEtymology: document.getElementById("fieldEtymology"),
  etymologyPreview: document.getElementById("etymologyPreview"),
  fieldSynonyms: document.getElementById("fieldSynonyms"),
  synonymsPreview: document.getElementById("synonymsPreview"),
  fieldAntonyms: document.getElementById("fieldAntonyms"),
  antonymsPreview: document.getElementById("antonymsPreview"),
  fieldNotes: document.getElementById("fieldNotes"),
  notesPreview: document.getElementById("notesPreview"),
  tagOxford5000: document.getElementById("tagOxford5000"),
  tagAwl: document.getElementById("tagAwl"),
  tagEiken: document.getElementById("tagEiken"),
  tagCustom: document.getElementById("tagCustom"),
};

const templates = {
  senses: document.getElementById("senseRowTpl"),
  derivatives: document.getElementById("derivativeRowTpl"),
  examples: document.getElementById("exampleRowTpl"),
};

function isMasterView() {
  return state.currentListId === MASTER_LIST_ID;
}

function isNotebookView() {
  return state.currentListId && !isMasterView();
}

function notebookLists() {
  return state.lists.filter((l) => l.isNotebook);
}

function setEditorOpen(open) {
  el.editModalOverlay.hidden = !open;
  if (open) {
    el.editPane.scrollTop = 0;
  }
}

function closeTopbarMenu() {
  el.topbarMenu.classList.remove("is-open");
  el.menuToggle.setAttribute("aria-expanded", "false");
  el.menuToggle.setAttribute("aria-label", "メニューを開く");
}

function toggleTopbarMenu() {
  const open = !el.topbarMenu.classList.contains("is-open");
  el.topbarMenu.classList.toggle("is-open", open);
  el.menuToggle.setAttribute("aria-expanded", String(open));
  el.menuToggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
}

async function api(path, opts) {
  const res = await fetch(`${API}${path}`, {
    headers: { "content-type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function resolveRef(headword) {
  const hit = state.listWordIndex.get(headword.toLowerCase());
  if (!hit) return { found: false };
  return { found: true, id: hit.id, no: hit.no };
}

function updatePreview(textarea, previewEl) {
  previewEl.innerHTML = renderMarkup(textarea.value, { resolve: resolveRef }) || '<span style="color:#999">（プレビュー）</span>';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatLevelBadgeCell(w, type) {
  switch (type) {
    case "awl":
      return w.awlSublist ? `<span class="level-badge badge-awl">${escapeHtml(String(w.awlSublist))}</span>` : "";
    case "oxford":
      return w.oxfordLevel ? `<span class="level-badge badge-oxford">${escapeHtml(w.oxfordLevel)}</span>` : "";
    case "eiken":
      return w.eiken ? `<span class="level-badge badge-eiken">${escapeHtml(w.eiken)}</span>` : "";
    case "target1900":
      return w.target1900No ? `<span class="level-badge badge-target1900">${escapeHtml(String(w.target1900No))}</span>` : "";
    case "target1400":
      return w.target1400No ? `<span class="level-badge badge-target1400">${escapeHtml(String(w.target1400No))}</span>` : "";
    default:
      return "";
  }
}

function formatCautionBadgeCell(w, type) {
  if (type === "pron") {
    return w.pronunciationCaution
      ? '<span class="caution-icon caution-pronunciation" title="発音注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></span>'
      : "";
  }
  if (type === "accent") {
    return w.accentCaution
      ? '<span class="caution-icon caution-accent" title="アクセント注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></span>'
      : "";
  }
  return "";
}

function updateSelectionUi() {
  const n = state.selectedWordIds.size;
  el.selectionCount.textContent = `${n}語選択`;
  el.addToNotebookBtn.disabled = n === 0;
}

function updateListModeUi() {
  const master = isMasterView();
  const notebook = isNotebookView();
  el.masterToolbar.hidden = !master;
  el.newSectionBtn.hidden = !notebook;
  el.newSectionBtn.disabled = !notebook;
  document.body.classList.toggle("view-master", master);
  document.body.classList.toggle("view-notebook", notebook);
  updateEditorListFields();
}

function updateEditorListFields() {
  const showNotebookFields = isNotebookView() && !el.editModalOverlay.hidden;
  el.notebookFields.hidden = !showNotebookFields;
  if (isMasterView()) {
    el.deleteBtn.textContent = "マスターから削除";
  } else if (isNotebookView()) {
    el.deleteBtn.textContent = "単語帳から除外";
  }
}

// ---- 辞書からの自動取得 ----

async function fetchWordInfo(spelling) {
  if (!spelling) return null;
  try {
    const info = await api(`/lookup?spelling=${encodeURIComponent(spelling)}`);
    if (info && info.error) console.error("辞書取得エラー:", info.error);
    return info;
  } catch (err) {
    console.error("辞書取得に失敗しました:", err);
    return null;
  }
}

function updatePlayAudioButton() {
  el.playAudioBtn.disabled = !state.currentAudioUrl;
}

function playCurrentAudio() {
  if (!state.currentAudioUrl) return;
  new Audio(state.currentAudioUrl).play().catch((err) => console.error("音声再生に失敗しました:", err));
}

async function autoFillPronunciationOnBlur() {
  const spelling = el.fieldSpelling.value.trim();
  if (!spelling || el.fieldPronunciation.value.trim()) return;
  const info = await fetchWordInfo(spelling);
  if (info?.pronunciation) el.fieldPronunciation.value = info.pronunciation;
  if (info?.audio) {
    state.currentAudioUrl = info.audio;
    updatePlayAudioButton();
  }
}

async function lookupPronunciationManually() {
  const spelling = el.fieldSpelling.value.trim();
  if (!spelling) {
    alert("先にスペルを入力してください");
    return;
  }
  el.lookupPronunciationBtn.disabled = true;
  try {
    const info = await fetchWordInfo(spelling);
    if (info?.pronunciation) el.fieldPronunciation.value = info.pronunciation;
    if (info?.audio) {
      state.currentAudioUrl = info.audio;
      updatePlayAudioButton();
    }
    if (!info || (!info.pronunciation && !info.audio)) {
      const reason = info?.error ? `（エラー: ${info.error}）` : "";
      alert(`「${spelling}」の発音記号が辞書から見つかりませんでした${reason}。`);
    }
  } finally {
    el.lookupPronunciationBtn.disabled = false;
  }
}

async function draftFromDictionary() {
  const spelling = el.fieldSpelling.value.trim();
  if (!spelling) {
    alert("先にスペルを入力してください");
    return;
  }
  el.draftFromDictionaryBtn.disabled = true;
  try {
    const info = await fetchWordInfo(spelling);
    if (!info || info.error) {
      alert(`「${spelling}」の情報が辞書から見つかりませんでした。`);
      return;
    }
    let filledAnything = false;
    if (info.pronunciation && !el.fieldPronunciation.value.trim()) {
      el.fieldPronunciation.value = info.pronunciation;
      filledAnything = true;
    }
    if (info.audio) {
      state.currentAudioUrl = info.audio;
      updatePlayAudioButton();
      filledAnything = true;
    }
    const hasExample = collectRows("examples").length > 0;
    if (!hasExample && info.examples?.length > 0) {
      const rows = [...el.examplesList.querySelectorAll(".repeat-row")];
      if (rows.length === 1 && !rows[0].querySelector(".sentence").value.trim()) rows[0].remove();
      addRow("examples", { sentence: info.examples[0] });
      filledAnything = true;
    }
    if (info.synonyms?.length > 0 && !el.fieldSynonyms.value.trim()) {
      el.fieldSynonyms.value = info.synonyms.join(", ");
      updatePreview(el.fieldSynonyms, el.synonymsPreview);
      filledAnything = true;
    }
    if (info.antonyms?.length > 0 && !el.fieldAntonyms.value.trim()) {
      el.fieldAntonyms.value = info.antonyms.join(", ");
      updatePreview(el.fieldAntonyms, el.antonymsPreview);
      filledAnything = true;
    }
    if (filledAnything) alert("辞書から下書きを取得しました。");
    else alert(`「${spelling}」は追加できる情報がありませんでした。`);
  } finally {
    el.draftFromDictionaryBtn.disabled = false;
  }
}

// ---- リスト読み込み ----

async function loadLists() {
  state.lists = await api("/lists");
  el.listSelect.innerHTML = "";

  const masterLists = state.lists.filter((l) => l.isMaster);
  const notebooks = state.lists.filter((l) => l.isNotebook);

  if (masterLists.length > 0) {
    const og = document.createElement("optgroup");
    og.label = "親リスト";
    for (const list of masterLists) {
      const opt = document.createElement("option");
      opt.value = list.id;
      opt.textContent = list.name;
      og.appendChild(opt);
    }
    el.listSelect.appendChild(og);
  }

  if (notebooks.length > 0) {
    const og = document.createElement("optgroup");
    og.label = "単語帳";
    for (const list of notebooks) {
      const opt = document.createElement("option");
      opt.value = list.id;
      opt.textContent = list.name;
      og.appendChild(opt);
    }
    el.listSelect.appendChild(og);
  }

  if (state.lists.length > 0) {
    const saved = localStorage.getItem(LAST_LIST_KEY);
    const initial = state.lists.some((l) => l.id === saved) ? saved : state.lists[0].id;
    state.currentListId = initial;
    el.listSelect.value = state.currentListId;
    await selectList(state.currentListId);
  } else {
    state.currentListId = null;
    el.listTitle.textContent = "リストがありません";
    el.newWordBtn.disabled = true;
  }
}

async function selectList(listId) {
  state.currentListId = listId;
  localStorage.setItem(LAST_LIST_KEY, listId);
  state.selectedWordIds.clear();
  updateSelectionUi();
  const list = state.lists.find((l) => l.id === listId);
  el.listTitle.textContent = list ? list.name : "";
  el.newWordBtn.disabled = !listId;
  updateListModeUi();
  closeEditor();
  await Promise.all([loadWordsForList(listId), loadSectionsForList(listId)]);
}

function buildMasterQuery(offset) {
  const qs = new URLSearchParams();
  if (state.masterFilter.q) qs.set("q", state.masterFilter.q);
  if (state.masterFilter.awl) qs.set("awl", state.masterFilter.awl);
  if (state.masterFilter.oxford) qs.set("oxford", state.masterFilter.oxford);
  if (state.masterFilter.target1900) qs.set("target1900", "1");
  if (state.masterFilter.target1400) qs.set("target1400", "1");
  qs.set("limit", String(MASTER_PAGE_SIZE));
  qs.set("offset", String(offset));
  return qs.toString();
}

async function loadWordsForList(listId) {
  if (isMasterView()) {
    const result = await api(`/master/words?${buildMasterQuery(0)}`);
    state.words = result.words;
    state.masterOffset = result.words.length;
    state.masterHasMore = result.hasMore;
    state.listWordIndex = new Map(state.words.map((w) => [w.spelling.toLowerCase(), { id: w.id, no: null }]));
  } else {
    state.words = await api(`/lists/${encodeURIComponent(listId)}/words`);
    state.masterHasMore = false;
    state.listWordIndex = new Map(state.words.map((w) => [w.spelling.toLowerCase(), { id: w.id, no: w.displayNo }]));
  }
  renderWordTableHead();
  renderWordTable();
}

async function loadMoreMasterWords() {
  if (!isMasterView() || !state.masterHasMore || state.masterLoading) return;
  state.masterLoading = true;
  el.masterLoadingMore.hidden = false;
  try {
    const result = await api(`/master/words?${buildMasterQuery(state.masterOffset)}`);
    for (const w of result.words) state.listWordIndex.set(w.spelling.toLowerCase(), { id: w.id, no: null });
    state.words = state.words.concat(result.words);
    state.masterOffset += result.words.length;
    state.masterHasMore = result.hasMore;
    renderWordTableHead();
    renderWordTable();
  } catch (err) {
    console.error("追加読み込みに失敗しました:", err);
  } finally {
    state.masterLoading = false;
    el.masterLoadingMore.hidden = true;
  }
}

function handleWordTableScroll() {
  if (!isMasterView() || !state.masterHasMore || state.masterLoading) return;
  const el2 = el.tableScroll;
  if (el2.scrollTop + el2.clientHeight >= el2.scrollHeight - 400) {
    loadMoreMasterWords();
  }
}

async function loadSectionsForList(listId) {
  if (isMasterView()) {
    state.sections = [];
    return;
  }
  state.sections = await api(`/lists/${encodeURIComponent(listId)}/sections`);
  renderSectionOptions();
}

function renderSectionOptions() {
  const current = el.fieldSection.value;
  el.fieldSection.innerHTML = '<option value="">なし</option>';
  for (const s of state.sections) {
    const opt = document.createElement("option");
    opt.value = String(s.id);
    opt.textContent = s.name;
    el.fieldSection.appendChild(opt);
  }
  const newOpt = document.createElement("option");
  newOpt.value = NEW_SECTION_VALUE;
  newOpt.textContent = "＋ 新規セクション...";
  el.fieldSection.appendChild(newOpt);
  if ([...el.fieldSection.options].some((o) => o.value === current)) el.fieldSection.value = current;
}

async function handleSectionSelectChange() {
  if (el.fieldSection.value !== NEW_SECTION_VALUE) return;
  const name = prompt("新規セクション名を入力してください（例: Section 1）");
  if (!name) {
    el.fieldSection.value = "";
    return;
  }
  try {
    const section = await api(`/lists/${encodeURIComponent(state.currentListId)}/sections`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    await loadSectionsForList(state.currentListId);
    el.fieldSection.value = String(section.id);
  } catch (err) {
    alert(`セクション作成に失敗しました: ${err.message}`);
    el.fieldSection.value = "";
  }
}

async function createSectionForCurrentList() {
  if (!isNotebookView()) return;
  const name = prompt("新規セクション名を入力してください（例: Week 1）");
  if (!name) return;
  try {
    await api(`/lists/${encodeURIComponent(state.currentListId)}/sections`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    await loadSectionsForList(state.currentListId);
    await loadWordsForList(state.currentListId);
  } catch (err) {
    alert(`セクション作成に失敗しました: ${err.message}`);
  }
}

const LEVEL_COLUMNS_HEAD =
  '<th class="col-awl">AWL</th><th class="col-oxford">Oxford</th><th class="col-eiken">英検</th><th class="col-target1900">1900</th><th class="col-target1400">1400</th>';
const PRON_COLUMNS_HEAD =
  '<th class="col-pron">発音</th><th class="col-caution-pron">発音注意</th><th class="col-caution-accent">アクセント注意</th>';

function renderWordTableHead() {
  if (isMasterView()) {
    el.wordTableHead.innerHTML =
      `<tr><th class="col-check"><input type="checkbox" id="checkAllMaster" aria-label="表示中の単語を全選択" /></th><th>スペル</th><th class="col-meaning">意味</th>${LEVEL_COLUMNS_HEAD}${PRON_COLUMNS_HEAD}</tr>`;
    const checkAll = document.getElementById("checkAllMaster");
    checkAll.checked = state.words.length > 0 && state.words.every((w) => state.selectedWordIds.has(w.id));
    checkAll.indeterminate =
      state.selectedWordIds.size > 0 && !state.words.every((w) => state.selectedWordIds.has(w.id));
    checkAll.addEventListener("change", () => {
      if (checkAll.checked) state.words.forEach((w) => state.selectedWordIds.add(w.id));
      else state.words.forEach((w) => state.selectedWordIds.delete(w.id));
      updateSelectionUi();
      renderWordTable();
    });
  } else {
    el.wordTableHead.innerHTML =
      `<tr><th class="col-no">no.</th><th>スペル</th><th class="col-meaning">意味</th>${LEVEL_COLUMNS_HEAD}${PRON_COLUMNS_HEAD}<th class="col-move">並び替え</th></tr>`;
  }
}

// state.wordsは既にサーバー側で(セクションの並び順, no, branch)順に並んでいる。
// branch=0(派生語ファミリーの見出し)のみを取り出し、現在の並び順+所属セクションを返す。
function getHeadWordOrder() {
  return state.words.filter((w) => !w.branch).map((w) => ({ wordId: w.id, sectionId: w.sectionId ?? null }));
}

async function submitReorder(order) {
  try {
    await api(`/lists/${encodeURIComponent(state.currentListId)}/reorder`, {
      method: "POST",
      body: JSON.stringify({ items: order.map((it) => ({ wordId: it.wordId, sectionId: it.sectionId })) }),
    });
    await loadWordsForList(state.currentListId);
  } catch (err) {
    alert(`並び替えに失敗しました: ${err.message}`);
  }
}

// direction: -1(上へ) / +1(下へ)。同じセクション内なら隣と単純に入れ替え、
// セクションの端で隣が別セクションの場合は、位置はそのままに所属セクションだけ切り替える
// (=セクション境界をまたいで前後のセクションへ移動する)。
async function moveWordBy(wordId, direction) {
  const order = getHeadWordOrder();
  const idx = order.findIndex((it) => it.wordId === wordId);
  if (idx === -1) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= order.length) return;
  const current = order[idx];
  const neighbor = order[targetIdx];
  if (current.sectionId === neighbor.sectionId) {
    order[idx] = neighbor;
    order[targetIdx] = current;
  } else {
    current.sectionId = neighbor.sectionId;
  }
  await submitReorder(order);
}

// targetWordIdの直前にwordIdを挿入する(targetの所属セクションに移る)。
async function moveWordBeforeTarget(wordId, targetWordId) {
  if (wordId === targetWordId) return;
  const order = getHeadWordOrder();
  const fromIdx = order.findIndex((it) => it.wordId === wordId);
  const toIdx = order.findIndex((it) => it.wordId === targetWordId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [moved] = order.splice(fromIdx, 1);
  const insertAt = order.findIndex((it) => it.wordId === targetWordId);
  moved.sectionId = order[insertAt].sectionId;
  order.splice(insertAt, 0, moved);
  await submitReorder(order);
}

// wordIdを指定セクションの先頭へ移動する(sectionIdはnull=セクションなしも可)。
async function moveWordToSectionStart(wordId, sectionId) {
  const order = getHeadWordOrder();
  const fromIdx = order.findIndex((it) => it.wordId === wordId);
  if (fromIdx === -1) return;
  const [moved] = order.splice(fromIdx, 1);
  moved.sectionId = sectionId;
  const insertAt = order.findIndex((it) => it.sectionId === sectionId);
  order.splice(insertAt === -1 ? order.length : insertAt, 0, moved);
  await submitReorder(order);
}

async function moveSectionBy(sectionId, direction) {
  const idx = state.sections.findIndex((s) => s.id === sectionId);
  if (idx === -1) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= state.sections.length) return;
  const newSections = [...state.sections];
  [newSections[idx], newSections[targetIdx]] = [newSections[targetIdx], newSections[idx]];
  await submitSectionOrder(newSections);
}

async function moveSectionBeforeTarget(sectionId, targetSectionId) {
  if (sectionId === targetSectionId) return;
  const order = [...state.sections];
  const fromIdx = order.findIndex((s) => s.id === sectionId);
  const toIdx = order.findIndex((s) => s.id === targetSectionId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [moved] = order.splice(fromIdx, 1);
  const insertAt = order.findIndex((s) => s.id === targetSectionId);
  order.splice(insertAt, 0, moved);
  await submitSectionOrder(order);
}

async function submitSectionOrder(orderedSections) {
  try {
    await api(`/lists/${encodeURIComponent(state.currentListId)}/sections/reorder`, {
      method: "POST",
      body: JSON.stringify({ sectionIds: orderedSections.map((s) => s.id) }),
    });
    await loadSectionsForList(state.currentListId);
    await loadWordsForList(state.currentListId);
  } catch (err) {
    alert(`セクションの並び替えに失敗しました: ${err.message}`);
  }
}

function attachWordDragHandlers(tr, wordId) {
  tr.addEventListener("dragstart", (e) => {
    dragState = { type: "word", id: wordId };
    e.dataTransfer.effectAllowed = "move";
    tr.classList.add("dragging");
  });
  tr.addEventListener("dragend", () => {
    tr.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach((el2) => el2.classList.remove("drag-over"));
  });
  tr.addEventListener("dragover", (e) => {
    if (dragState?.type !== "word") return;
    e.preventDefault();
    tr.classList.add("drag-over");
  });
  tr.addEventListener("dragleave", () => tr.classList.remove("drag-over"));
  tr.addEventListener("drop", (e) => {
    e.preventDefault();
    tr.classList.remove("drag-over");
    if (dragState?.type !== "word") return;
    const draggedId = dragState.id;
    dragState = null;
    if (draggedId !== wordId) moveWordBeforeTarget(draggedId, wordId);
  });
}

function attachSectionDragHandlers(sectionTr, sectionId) {
  sectionTr.addEventListener("dragstart", (e) => {
    dragState = { type: "section", id: sectionId };
    e.dataTransfer.effectAllowed = "move";
    sectionTr.classList.add("dragging");
  });
  sectionTr.addEventListener("dragend", () => {
    sectionTr.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach((el2) => el2.classList.remove("drag-over"));
  });
  sectionTr.addEventListener("dragover", (e) => {
    e.preventDefault();
    sectionTr.classList.add("drag-over");
  });
  sectionTr.addEventListener("dragleave", () => sectionTr.classList.remove("drag-over"));
  sectionTr.addEventListener("drop", (e) => {
    e.preventDefault();
    sectionTr.classList.remove("drag-over");
    if (dragState?.type === "section") {
      const draggedId = dragState.id;
      dragState = null;
      if (draggedId !== sectionId) moveSectionBeforeTarget(draggedId, sectionId);
    } else if (dragState?.type === "word") {
      const draggedId = dragState.id;
      dragState = null;
      moveWordToSectionStart(draggedId, sectionId);
    }
  });
}

function renderWordTable() {
  el.wordTableBody.innerHTML = "";
  el.wordTableEmpty.hidden = state.words.length > 0;
  el.wordTableEmpty.textContent = isMasterView()
    ? "条件に一致する単語がありません。"
    : "この単語帳にはまだ単語がありません。親リストからチェックして追加してください。";

  let lastSectionId = undefined;
  const colspan = isMasterView() ? 11 : 12;

  for (const w of state.words) {
    if (!isMasterView() && w.sectionId !== lastSectionId) {
      lastSectionId = w.sectionId;
      const sectionTr = document.createElement("tr");
      sectionTr.className = "section-header-row";
      const sectionIndex = w.sectionId != null ? state.sections.findIndex((s) => s.id === w.sectionId) : -1;
      const isFirst = sectionIndex <= 0;
      const isLast = sectionIndex === -1 || sectionIndex === state.sections.length - 1;
      const moveButtons =
        w.sectionId != null
          ? `<span class="section-move-btns">
              <button type="button" class="move-btn" data-action="section-up" ${isFirst ? "disabled" : ""} aria-label="セクションを上へ"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
              <button type="button" class="move-btn" data-action="section-down" ${isLast ? "disabled" : ""} aria-label="セクションを下へ"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
            </span>`
          : "";
      sectionTr.innerHTML = `<td colspan="${colspan}"><span class="section-band-inner"><span class="section-band-name">${escapeHtml(w.sectionName || "（セクションなし）")}</span>${moveButtons}</span></td>`;
      if (w.sectionId != null) {
        sectionTr.draggable = true;
        sectionTr.classList.add("section-band-clickable");
        sectionTr.title = "クリックしてサブタイトル・説明を編集";
        sectionTr.addEventListener("click", () => openSectionEditor(w.sectionId));
        sectionTr.querySelector('[data-action="section-up"]').addEventListener("click", (e) => {
          e.stopPropagation();
          moveSectionBy(w.sectionId, -1);
        });
        sectionTr.querySelector('[data-action="section-down"]').addEventListener("click", (e) => {
          e.stopPropagation();
          moveSectionBy(w.sectionId, 1);
        });
        attachSectionDragHandlers(sectionTr, w.sectionId);
      }
      el.wordTableBody.appendChild(sectionTr);
    }

    const tr = document.createElement("tr");
    tr.dataset.wordId = w.id;
    if (w.branch) tr.classList.add("branch-row");
    if (state.currentWord?.id === w.id) tr.classList.add("selected");
    if (state.selectedWordIds.has(w.id)) tr.classList.add("checked-row");

    const meaningCell = `<td class="col-meaning">${escapeHtml(w.primaryMeaning || "")}</td>`;
    const levelCells =
      `<td class="col-awl">${formatLevelBadgeCell(w, "awl")}</td>` +
      `<td class="col-oxford">${formatLevelBadgeCell(w, "oxford")}</td>` +
      `<td class="col-eiken">${formatLevelBadgeCell(w, "eiken")}</td>` +
      `<td class="col-target1900">${formatLevelBadgeCell(w, "target1900")}</td>` +
      `<td class="col-target1400">${formatLevelBadgeCell(w, "target1400")}</td>`;
    const pronCells =
      `<td class="col-pron">${escapeHtml(formatPronunciationWithAccents(w.pronunciation || ""))}</td>` +
      `<td class="col-caution-pron">${formatCautionBadgeCell(w, "pron")}</td>` +
      `<td class="col-caution-accent">${formatCautionBadgeCell(w, "accent")}</td>`;

    if (isMasterView()) {
      const checked = state.selectedWordIds.has(w.id);
      tr.innerHTML = `<td class="col-check"><input type="checkbox" class="word-check" ${checked ? "checked" : ""} aria-label="${escapeHtml(w.spelling)}を選択" /></td><td class="col-spelling">${escapeHtml(w.spelling)}</td>${meaningCell}${levelCells}${pronCells}`;
      const cb = tr.querySelector(".word-check");
      cb.addEventListener("click", (e) => e.stopPropagation());
      cb.addEventListener("change", () => {
        if (cb.checked) state.selectedWordIds.add(w.id);
        else state.selectedWordIds.delete(w.id);
        updateSelectionUi();
        tr.classList.toggle("checked-row", cb.checked);
      });
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".col-check")) return;
        openWordEditor(w.id);
      });
    } else {
      const moveCell = w.branch
        ? `<td class="col-move"></td>`
        : `<td class="col-move"><button type="button" class="move-btn" data-action="word-up" aria-label="上へ"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button><button type="button" class="move-btn" data-action="word-down" aria-label="下へ"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button></td>`;
      tr.innerHTML = `<td class="col-no">${escapeHtml(w.displayNo)}</td><td class="col-spelling">${escapeHtml(w.spelling)}</td>${meaningCell}${levelCells}${pronCells}${moveCell}`;
      tr.addEventListener("click", () => openWordEditor(w.id));
      if (!w.branch) {
        tr.draggable = true;
        tr.querySelector('[data-action="word-up"]').addEventListener("click", (e) => {
          e.stopPropagation();
          moveWordBy(w.id, -1);
        });
        tr.querySelector('[data-action="word-down"]').addEventListener("click", (e) => {
          e.stopPropagation();
          moveWordBy(w.id, 1);
        });
        attachWordDragHandlers(tr, w.id);
      }
    }
    el.wordTableBody.appendChild(tr);
  }
}

function selectAllMasterWords() {
  state.words.forEach((w) => state.selectedWordIds.add(w.id));
  updateSelectionUi();
  renderWordTableHead();
  renderWordTable();
}

function clearWordSelection() {
  state.selectedWordIds.clear();
  updateSelectionUi();
  renderWordTableHead();
  renderWordTable();
}

async function applyMasterFilters() {
  state.masterFilter.q = el.masterSearch.value.trim();
  state.masterFilter.awl = el.filterAwl.value;
  state.masterFilter.oxford = el.filterOxford.value;
  state.masterFilter.target1900 = el.filterTarget1900.checked;
  state.masterFilter.target1400 = el.filterTarget1400.checked;
  await loadWordsForList(state.currentListId);
}

function setAddNotebookModalOpen(open) {
  el.addNotebookModalOverlay.hidden = !open;
}

function closeAddNotebookModal() {
  setAddNotebookModalOpen(false);
}

// 選択中の単語帳に対応するセクション一覧をプルダウンへ読み込む。
async function loadAddNotebookSections(listId) {
  el.addNotebookSection.innerHTML = '<option value="">（セクションなし）</option>';
  if (!listId) return;
  try {
    const sections = await api(`/lists/${encodeURIComponent(listId)}/sections`);
    for (const s of sections) {
      const opt = document.createElement("option");
      opt.value = String(s.id);
      opt.textContent = s.name;
      el.addNotebookSection.appendChild(opt);
    }
  } catch {
    /* sections optional */
  }
}

// マスターで選択した単語を単語帳へ追加する。追加先の単語帳・セクションはモーダルのプルダウンで選ぶ。
async function addSelectedToNotebook() {
  const ids = [...state.selectedWordIds];
  if (ids.length === 0) return;

  const notebooks = notebookLists();
  if (notebooks.length === 0) {
    alert("先に「＋ 新規」から単語帳を作成してください。");
    return;
  }

  el.addNotebookCount.textContent = `${ids.length}語を追加します`;
  el.addNotebookSelect.innerHTML = "";
  for (const l of notebooks) {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.name;
    el.addNotebookSelect.appendChild(opt);
  }
  await loadAddNotebookSections(el.addNotebookSelect.value);
  setAddNotebookModalOpen(true);
}

async function confirmAddToNotebook() {
  const ids = [...state.selectedWordIds];
  if (ids.length === 0) {
    closeAddNotebookModal();
    return;
  }
  const targetId = el.addNotebookSelect.value;
  const target = notebookLists().find((l) => l.id === targetId);
  if (!target) {
    alert("追加先の単語帳を選択してください。");
    return;
  }
  const sectionValue = el.addNotebookSection.value;
  const sectionId = sectionValue ? Number(sectionValue) : null;

  try {
    const result = await api(`/lists/${encodeURIComponent(targetId)}/add-words`, {
      method: "POST",
      body: JSON.stringify({ wordIds: ids, sectionId }),
    });
    closeAddNotebookModal();
    alert(`「${target.name}」へ追加: ${result.added}件 / スキップ: ${result.skipped}件`);
    state.selectedWordIds.clear();
    updateSelectionUi();
    renderWordTable();
  } catch (err) {
    alert(`単語帳への追加に失敗しました: ${err.message}`);
  }
}

// ---- 編集フォーム ----

function clearRepeatList(container) {
  container.innerHTML = "";
}

function addRow(kind, data = {}) {
  const container = document.getElementById(`${kind}List`);
  const tpl = templates[kind];
  const node = tpl.content.firstElementChild.cloneNode(true);
  if (kind === "senses") {
    node.querySelector(".pos").value = data.pos || "";
    node.querySelector(".meaning").value = data.meaning || "";
    node.querySelector(".pronunciation").value = data.pronunciation || "";
    node.querySelector(".is-primary").checked = !!data.is_primary;
  } else if (kind === "derivatives") {
    node.querySelector(".pos").value = data.pos || "";
    node.querySelector(".word").value = data.word || "";
    node.querySelector(".meaning").value = data.meaning || "";
  } else if (kind === "examples") {
    node.querySelector(".type").value = data.type || "example";
    node.querySelector(".sentence").value = data.sentence || "";
    node.querySelector(".translation").value = data.translation || "";
    node.querySelector(".answer").value = data.answer || "";
  }
  node.querySelector(".remove-row-btn").addEventListener("click", () => node.remove());
  container.appendChild(node);
}

function collectRows(kind) {
  const container = document.getElementById(`${kind}List`);
  const rows = [...container.querySelectorAll(".repeat-row")];
  if (kind === "senses") {
    return rows
      .map((r) => ({
        pos: r.querySelector(".pos").value.trim(),
        meaning: r.querySelector(".meaning").value.trim(),
        pronunciation: r.querySelector(".pronunciation").value.trim() || null,
        is_primary: r.querySelector(".is-primary").checked ? 1 : 0,
      }))
      .filter((r) => r.meaning);
  }
  if (kind === "derivatives") {
    return rows
      .map((r) => ({
        pos: r.querySelector(".pos").value.trim(),
        word: r.querySelector(".word").value.trim(),
        meaning: r.querySelector(".meaning").value.trim() || null,
      }))
      .filter((r) => r.word);
  }
  if (kind === "examples") {
    return rows
      .map((r) => ({
        type: r.querySelector(".type").value === "phrase" ? "phrase" : "example",
        sentence: r.querySelector(".sentence").value.trim(),
        translation: r.querySelector(".translation").value.trim(),
        // 「解答」欄はUIから廃止。既存データは非表示のhidden inputでラウンドトリップだけ保持する。
        answer: r.querySelector(".answer").value.trim(),
      }))
      .filter((r) => r.sentence);
  }
  return [];
}

function setCautionButton(btn, active) {
  btn.setAttribute("aria-pressed", String(!!active));
  btn.classList.toggle("is-active", !!active);
}

function isCautionButtonActive(btn) {
  return btn.getAttribute("aria-pressed") === "true";
}

function openNewWordForm() {
  state.currentWord = null;
  state.isNew = true;
  el.editTitle.textContent = "単語を追加（マスター）";
  el.deleteBtn.hidden = true;
  if (isNotebookView()) el.fieldNo.value = nextSuggestedNo();
  el.fieldSpelling.value = "";
  el.fieldPronunciation.value = "";
  state.currentAudioUrl = null;
  updatePlayAudioButton();
  setCautionButton(el.pronunciationCautionBtn, false);
  setCautionButton(el.accentCautionBtn, false);
  el.fieldDerivedFrom.value = "";
  el.fieldSection.value = "";
  clearRepeatList(el.sensesList);
  clearRepeatList(el.derivativesList);
  clearRepeatList(el.examplesList);
  addRow("senses");
  addRow("derivatives");
  addRow("examples");
  el.fieldEtymology.value = "";
  el.fieldSynonyms.value = "";
  el.fieldAntonyms.value = "";
  el.fieldNotes.value = "";
  el.tagOxford5000.checked = false;
  el.tagAwl.checked = false;
  el.tagEiken.value = "";
  el.tagCustom.value = "";
  updatePreview(el.fieldEtymology, el.etymologyPreview);
  updatePreview(el.fieldSynonyms, el.synonymsPreview);
  updatePreview(el.fieldAntonyms, el.antonymsPreview);
  updatePreview(el.fieldNotes, el.notesPreview);
  setEditorOpen(true);
  updateEditorListFields();
  renderWordTable();
}

function nextSuggestedNo() {
  const max = state.words.reduce((m, w) => Math.max(m, w.no || 0), 0);
  return max + 1;
}

async function openWordEditor(wordId) {
  const detail = await api(`/words/${encodeURIComponent(wordId)}`);
  state.currentWord = detail;
  state.isNew = false;
  el.editTitle.textContent = `単語を編集: ${detail.spelling}`;
  el.deleteBtn.hidden = false;

  const membership = isNotebookView() ? detail.lists.find((l) => l.listId === state.currentListId) : null;
  el.fieldNo.value = membership ? membership.displayNo : "";
  el.fieldSpelling.value = detail.spelling;
  el.fieldPronunciation.value = detail.pronunciation || "";
  state.currentAudioUrl = detail.audioUrl || null;
  updatePlayAudioButton();
  setCautionButton(el.pronunciationCautionBtn, detail.pronunciationCaution);
  setCautionButton(el.accentCautionBtn, detail.accentCaution);
  el.fieldDerivedFrom.value = detail.derivedFrom ? detail.derivedFrom.spelling : "";
  el.fieldSection.value = membership?.sectionId != null ? String(membership.sectionId) : "";

  clearRepeatList(el.sensesList);
  (detail.senses.length ? detail.senses : [{}]).forEach((s) => addRow("senses", s));
  clearRepeatList(el.derivativesList);
  (detail.derivatives.length ? detail.derivatives : [{}]).forEach((d) => addRow("derivatives", d));
  clearRepeatList(el.examplesList);
  (detail.examples.length ? detail.examples : [{}]).forEach((ex) => addRow("examples", ex));

  el.fieldEtymology.value = detail.etymology || "";
  el.fieldSynonyms.value = detail.synonyms || "";
  el.fieldAntonyms.value = detail.antonyms || "";
  el.fieldNotes.value = detail.notes || "";
  el.tagOxford5000.checked = "oxford5000" in detail.tags;
  el.tagAwl.checked = "awl" in detail.tags;
  el.tagEiken.value = detail.tags.eiken || "";
  el.tagCustom.value = Object.entries(detail.tags)
    .filter(([k]) => k.startsWith("custom:"))
    .map(([k]) => k.slice("custom:".length))
    .join(", ");

  updatePreview(el.fieldEtymology, el.etymologyPreview);
  updatePreview(el.fieldSynonyms, el.synonymsPreview);
  updatePreview(el.fieldAntonyms, el.antonymsPreview);
  updatePreview(el.fieldNotes, el.notesPreview);
  setEditorOpen(true);
  updateEditorListFields();
  renderWordTable();
}

function closeEditor() {
  state.currentWord = null;
  setEditorOpen(false);
  updateEditorListFields();
  renderWordTable();
}

function collectTags() {
  const tags = {};
  if (el.tagOxford5000.checked) tags.oxford5000 = true;
  if (el.tagAwl.checked) tags.awl = true;
  if (el.tagEiken.value) tags.eiken = el.tagEiken.value;
  for (const raw of el.tagCustom.value.split(",")) {
    const v = raw.trim();
    if (v) tags[`custom:${v}`] = true;
  }
  return tags;
}

async function saveWord() {
  if (!el.fieldSpelling.value.trim()) {
    alert("スペルを入力してください");
    return;
  }
  const sectionId = el.fieldSection.value && el.fieldSection.value !== NEW_SECTION_VALUE ? Number(el.fieldSection.value) : null;
  const body = {
    spelling: el.fieldSpelling.value.trim(),
    pronunciation: el.fieldPronunciation.value.trim() || null,
    audioUrl: state.currentAudioUrl || null,
    pronunciationCaution: isCautionButtonActive(el.pronunciationCautionBtn),
    accentCaution: isCautionButtonActive(el.accentCautionBtn),
    derivedFrom: el.fieldDerivedFrom.value.trim() || "",
    senses: collectRows("senses"),
    derivatives: collectRows("derivatives"),
    examples: collectRows("examples"),
    etymology: el.fieldEtymology.value.trim() || null,
    synonyms: el.fieldSynonyms.value.trim() || null,
    antonyms: el.fieldAntonyms.value.trim() || null,
    notes: el.fieldNotes.value.trim() || null,
    tags: collectTags(),
  };

  try {
    let word;
    if (state.isNew) {
      if (isNotebookView()) {
        body.listId = state.currentListId;
        body.no = el.fieldNo.value.trim() || null;
        body.sectionId = sectionId;
      }
      word = await api("/words", { method: "POST", body: JSON.stringify(body) });
    } else {
      word = await api(`/words/${encodeURIComponent(state.currentWord.id)}`, { method: "PUT", body: JSON.stringify(body) });
      if (isNotebookView() && el.fieldNo.value.trim()) {
        await api(`/lists/${encodeURIComponent(state.currentListId)}/items/${encodeURIComponent(word.id)}`, {
          method: "PUT",
          body: JSON.stringify({ no: el.fieldNo.value.trim(), sectionId }),
        });
      }
    }
    await loadWordsForList(state.currentListId);
    await openWordEditor(word.id);
  } catch (err) {
    alert(`保存に失敗しました: ${err.message}`);
  }
}

async function deleteCurrentWord() {
  if (!state.currentWord) return;
  if (isMasterView()) {
    if (!confirm(`「${state.currentWord.spelling}」をマスターから完全に削除しますか？（全単語帳からも消えます）`)) return;
    try {
      await api(`/words/${encodeURIComponent(state.currentWord.id)}`, { method: "DELETE" });
      closeEditor();
      await loadWordsForList(state.currentListId);
    } catch (err) {
      alert(`削除に失敗しました: ${err.message}`);
    }
    return;
  }
  if (!confirm(`「${state.currentWord.spelling}」をこの単語帳から除外しますか？（マスターの単語データは残ります）`)) return;
  try {
    await api(`/lists/${encodeURIComponent(state.currentListId)}/items/${encodeURIComponent(state.currentWord.id)}`, {
      method: "DELETE",
    });
    closeEditor();
    await loadWordsForList(state.currentListId);
  } catch (err) {
    alert(`除外に失敗しました: ${err.message}`);
  }
}

// ---- セクション編集(サブタイトル・説明) ----

function setSectionEditorOpen(open) {
  el.sectionModalOverlay.hidden = !open;
  if (open) el.sectionEditPane.scrollTop = 0;
}

function openSectionEditor(sectionId) {
  const section = state.sections.find((s) => s.id === sectionId);
  if (!section) return;
  state.currentSectionId = sectionId;
  el.sectionEditTitle.textContent = `セクションを編集: ${section.name}`;
  el.sectionFieldName.value = section.name || "";
  el.sectionFieldSubtitle.value = section.subtitle || "";
  el.sectionFieldDescription.value = section.description || "";
  setSectionEditorOpen(true);
}

function closeSectionEditor() {
  setSectionEditorOpen(false);
  state.currentSectionId = null;
}

async function saveSectionEdit() {
  if (!state.currentSectionId) return;
  const name = el.sectionFieldName.value.trim();
  if (!name) {
    alert("セクション名を入力してください。");
    return;
  }
  try {
    await api(`/lists/${encodeURIComponent(state.currentListId)}/sections/${encodeURIComponent(state.currentSectionId)}`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        subtitle: el.sectionFieldSubtitle.value.trim() || null,
        description: el.sectionFieldDescription.value.trim() || null,
      }),
    });
    closeSectionEditor();
    await Promise.all([loadWordsForList(state.currentListId), loadSectionsForList(state.currentListId)]);
  } catch (err) {
    alert(`保存に失敗しました: ${err.message}`);
  }
}

async function deleteSectionFromEditor() {
  if (!state.currentSectionId) return;
  const section = state.sections.find((s) => s.id === state.currentSectionId);
  if (!confirm(`セクション「${section?.name || ""}」を削除しますか？（所属する単語はセクションなしになります）`)) return;
  try {
    await api(`/lists/${encodeURIComponent(state.currentListId)}/sections/${encodeURIComponent(state.currentSectionId)}`, {
      method: "DELETE",
    });
    closeSectionEditor();
    await Promise.all([loadWordsForList(state.currentListId), loadSectionsForList(state.currentListId)]);
  } catch (err) {
    alert(`削除に失敗しました: ${err.message}`);
  }
}

async function createNewList() {
  const name = prompt("新規単語帳名を入力してください（例: 英検2級オリジナル）");
  if (!name) return;
  try {
    const { id } = await api("/lists", { method: "POST", body: JSON.stringify({ name }) });
    await loadLists();
    el.listSelect.value = id;
    await selectList(id);
  } catch (err) {
    alert(`単語帳作成に失敗しました: ${err.message}`);
  }
}

// ---- イベント登録 ----

el.menuToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleTopbarMenu();
});
document.addEventListener("click", (e) => {
  if (!el.topbarMenu.classList.contains("is-open")) return;
  if (el.topbarMenu.contains(e.target) || el.menuToggle.contains(e.target)) return;
  closeTopbarMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!el.addNotebookModalOverlay.hidden) { closeAddNotebookModal(); return; }
  if (!el.editModalOverlay.hidden) { closeEditor(); return; }
  if (!el.sectionModalOverlay.hidden) { closeSectionEditor(); return; }
  if (el.topbarMenu.classList.contains("is-open")) closeTopbarMenu();
});
el.editModalOverlay.addEventListener("click", (e) => {
  if (e.target === el.editModalOverlay) closeEditor();
});
el.sectionModalOverlay.addEventListener("click", (e) => {
  if (e.target === el.sectionModalOverlay) closeSectionEditor();
});
el.sectionSaveBtn.addEventListener("click", saveSectionEdit);
el.sectionDeleteBtn.addEventListener("click", deleteSectionFromEditor);
el.sectionCloseBtn.addEventListener("click", closeSectionEditor);
el.addNotebookModalOverlay.addEventListener("click", (e) => {
  if (e.target === el.addNotebookModalOverlay) closeAddNotebookModal();
});
el.addNotebookConfirmBtn.addEventListener("click", confirmAddToNotebook);
el.addNotebookCloseBtn.addEventListener("click", closeAddNotebookModal);
el.addNotebookSelect.addEventListener("change", () => loadAddNotebookSections(el.addNotebookSelect.value));
el.pronunciationCautionBtn.addEventListener("click", () =>
  setCautionButton(el.pronunciationCautionBtn, !isCautionButtonActive(el.pronunciationCautionBtn))
);
el.accentCautionBtn.addEventListener("click", () =>
  setCautionButton(el.accentCautionBtn, !isCautionButtonActive(el.accentCautionBtn))
);

el.listSelect.addEventListener("change", (e) => {
  selectList(e.target.value);
  closeTopbarMenu();
});
el.newListBtn.addEventListener("click", createNewList);
el.newWordBtn.addEventListener("click", openNewWordForm);
el.newSectionBtn.addEventListener("click", createSectionForCurrentList);
el.selectAllMasterBtn.addEventListener("click", selectAllMasterWords);
el.clearSelectionBtn.addEventListener("click", clearWordSelection);
el.addToNotebookBtn.addEventListener("click", addSelectedToNotebook);
el.masterSearch.addEventListener("input", () => {
  clearTimeout(masterSearchTimer);
  masterSearchTimer = setTimeout(() => applyMasterFilters(), 300);
});
el.filterAwl.addEventListener("change", () => applyMasterFilters());
el.filterOxford.addEventListener("change", () => applyMasterFilters());
el.filterTarget1900.addEventListener("change", () => applyMasterFilters());
el.filterTarget1400.addEventListener("change", () => applyMasterFilters());
el.tableScroll.addEventListener("scroll", handleWordTableScroll);
el.saveBtn.addEventListener("click", saveWord);
el.deleteBtn.addEventListener("click", deleteCurrentWord);
el.closeBtn.addEventListener("click", closeEditor);
el.fieldSection.addEventListener("change", handleSectionSelectChange);
el.fieldSpelling.addEventListener("blur", autoFillPronunciationOnBlur);
el.fieldSpelling.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  autoFillPronunciationOnBlur();
});
el.lookupPronunciationBtn.addEventListener("click", lookupPronunciationManually);
el.playAudioBtn.addEventListener("click", playCurrentAudio);
el.draftFromDictionaryBtn.addEventListener("click", draftFromDictionary);
el.fieldEtymology.addEventListener("input", () => updatePreview(el.fieldEtymology, el.etymologyPreview));
el.fieldSynonyms.addEventListener("input", () => updatePreview(el.fieldSynonyms, el.synonymsPreview));
el.fieldAntonyms.addEventListener("input", () => updatePreview(el.fieldAntonyms, el.antonymsPreview));
el.fieldNotes.addEventListener("input", () => updatePreview(el.fieldNotes, el.notesPreview));

document.querySelectorAll(".add-row-btn").forEach((btn) => {
  btn.addEventListener("click", () => addRow(btn.dataset.add));
});

loadLists().catch((err) => {
  console.error(err);
  el.listTitle.textContent = `読み込みエラー: ${err.message}`;
});

// ---- テーマ切り替え ----

function currentEffectiveTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  el.themeToggleBtn.textContent = currentEffectiveTheme() === "dark" ? "ライト" : "ダーク";
}

el.themeToggleBtn.addEventListener("click", () => {
  const next = currentEffectiveTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

applyTheme(localStorage.getItem(THEME_KEY));
