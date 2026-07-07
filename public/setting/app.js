import { renderMarkup } from "../shared/markup.js";
import { API_BASE } from "../shared/config.js";

const API = `${API_BASE}/api`;
const NEW_SECTION_VALUE = "__new__";
const MASTER_LIST_ID = "__master__";

const state = {
  lists: [],
  currentListId: null,
  listWordIndex: new Map(),
  words: [],
  sections: [],
  currentWord: null,
  isNew: false,
  currentAudioUrl: null,
  selectedWordIds: new Set(),
  masterFilter: { q: "", awl: "", oxford: "" },
};

const MOBILE_BREAKPOINT = 768;
let masterSearchTimer = null;

const el = {
  layout: document.getElementById("layout"),
  menuToggle: document.getElementById("menuToggle"),
  topbarMenu: document.getElementById("topbarMenu"),
  backBtn: document.getElementById("backBtn"),
  mobileSaveBtn: document.getElementById("mobileSaveBtn"),
  listSelect: document.getElementById("listSelect"),
  newListBtn: document.getElementById("newListBtn"),
  listTitle: document.getElementById("listTitle"),
  newWordBtn: document.getElementById("newWordBtn"),
  newSectionBtn: document.getElementById("newSectionBtn"),
  masterToolbar: document.getElementById("masterToolbar"),
  masterSearch: document.getElementById("masterSearch"),
  filterAwl: document.getElementById("filterAwl"),
  filterOxford: document.getElementById("filterOxford"),
  selectionCount: document.getElementById("selectionCount"),
  selectAllMasterBtn: document.getElementById("selectAllMasterBtn"),
  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
  addToNotebookBtn: document.getElementById("addToNotebookBtn"),
  wordTableHead: document.getElementById("wordTableHead"),
  wordTableBody: document.getElementById("wordTableBody"),
  wordTableEmpty: document.getElementById("wordTableEmpty"),
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
  draftFromDictionaryBtn: document.getElementById("draftFromDictionaryBtn"),
  fieldDerivedFrom: document.getElementById("fieldDerivedFrom"),
  fieldSection: document.getElementById("fieldSection"),
  sensesList: document.getElementById("sensesList"),
  derivativesList: document.getElementById("derivativesList"),
  examplesList: document.getElementById("examplesList"),
  fieldEtymology: document.getElementById("fieldEtymology"),
  etymologyPreview: document.getElementById("etymologyPreview"),
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

function isMobileLayout() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function setEditorOpen(open) {
  el.layout.classList.toggle("layout--editor", open);
  if (open && isMobileLayout()) {
    el.editPane.scrollTop = 0;
    window.scrollTo(0, 0);
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

function formatLevelBadges(w) {
  const badges = [];
  if (w.awlSublist) badges.push({ cls: "badge-awl", text: `AWL ${w.awlSublist}` });
  if (w.oxfordLevel) badges.push({ cls: "badge-oxford", text: w.oxfordLevel });
  if (w.eiken) badges.push({ cls: "badge-eiken", text: `英検${w.eiken}` });
  if (badges.length === 0) return '<span class="level-empty">―</span>';
  return badges.map((b) => `<span class="level-badge ${b.cls}">${escapeHtml(b.text)}</span>`).join("");
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
  const showNotebookFields = isNotebookView() && !el.editPane.hidden;
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
    const refWords = [...(info.synonyms || []), ...(info.antonyms || []).map((w) => `${w}(対義語)`)];
    if (refWords.length > 0 && !el.fieldNotes.value.includes("辞書取得の下書き")) {
      const line = `類義語・対義語（辞書取得の下書き）: ${refWords.join(", ")}`;
      el.fieldNotes.value = el.fieldNotes.value ? `${el.fieldNotes.value}\n${line}` : line;
      updatePreview(el.fieldNotes, el.notesPreview);
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
    state.currentListId = state.lists[0].id;
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
  state.selectedWordIds.clear();
  updateSelectionUi();
  const list = state.lists.find((l) => l.id === listId);
  el.listTitle.textContent = list ? list.name : "";
  el.newWordBtn.disabled = !listId;
  updateListModeUi();
  closeEditor();
  await Promise.all([loadWordsForList(listId), loadSectionsForList(listId)]);
}

async function loadWordsForList(listId) {
  if (isMasterView()) {
    const qs = new URLSearchParams();
    if (state.masterFilter.q) qs.set("q", state.masterFilter.q);
    if (state.masterFilter.awl) qs.set("awl", state.masterFilter.awl);
    if (state.masterFilter.oxford) qs.set("oxford", state.masterFilter.oxford);
    const query = qs.toString();
    state.words = await api(`/master/words${query ? `?${query}` : ""}`);
    state.listWordIndex = new Map(state.words.map((w) => [w.spelling.toLowerCase(), { id: w.id, no: null }]));
  } else {
    state.words = await api(`/lists/${encodeURIComponent(listId)}/words`);
    state.listWordIndex = new Map(state.words.map((w) => [w.spelling.toLowerCase(), { id: w.id, no: w.displayNo }]));
  }
  renderWordTableHead();
  renderWordTable();
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

function renderWordTableHead() {
  if (isMasterView()) {
    el.wordTableHead.innerHTML =
      '<tr><th class="col-check"><input type="checkbox" id="checkAllMaster" aria-label="表示中の単語を全選択" /></th><th>スペル</th><th class="col-levels">レベル</th><th class="col-pron">発音</th></tr>';
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
      '<tr><th class="col-no">no.</th><th>スペル</th><th class="col-levels">レベル</th><th class="col-pron">発音</th></tr>';
  }
}

function renderWordTable() {
  el.wordTableBody.innerHTML = "";
  el.wordTableEmpty.hidden = state.words.length > 0;
  el.wordTableEmpty.textContent = isMasterView()
    ? "条件に一致する単語がありません。"
    : "この単語帳にはまだ単語がありません。親リストからチェックして追加してください。";

  let lastSectionId = undefined;
  const colspan = isMasterView() ? 4 : 4;

  for (const w of state.words) {
    if (!isMasterView() && w.sectionId !== lastSectionId) {
      lastSectionId = w.sectionId;
      const sectionTr = document.createElement("tr");
      sectionTr.className = "section-header-row";
      sectionTr.innerHTML = `<td colspan="${colspan}">${escapeHtml(w.sectionName || "（セクションなし）")}</td>`;
      el.wordTableBody.appendChild(sectionTr);
    }

    const tr = document.createElement("tr");
    tr.dataset.wordId = w.id;
    if (w.branch) tr.classList.add("branch-row");
    if (state.currentWord?.id === w.id) tr.classList.add("selected");
    if (state.selectedWordIds.has(w.id)) tr.classList.add("checked-row");

    const levels = formatLevelBadges(w);

    if (isMasterView()) {
      const checked = state.selectedWordIds.has(w.id);
      tr.innerHTML = `<td class="col-check"><input type="checkbox" class="word-check" ${checked ? "checked" : ""} aria-label="${escapeHtml(w.spelling)}を選択" /></td><td class="col-spelling">${escapeHtml(w.spelling)}</td><td class="col-levels">${levels}</td><td class="col-pron">${escapeHtml(w.pronunciation || "")}</td>`;
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
      tr.innerHTML = `<td class="col-no">${escapeHtml(w.displayNo)}</td><td class="col-spelling">${escapeHtml(w.spelling)}</td><td class="col-levels">${levels}</td><td class="col-pron">${escapeHtml(w.pronunciation || "")}</td>`;
      tr.addEventListener("click", () => openWordEditor(w.id));
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
  await loadWordsForList(state.currentListId);
}

async function addSelectedToNotebook() {
  const ids = [...state.selectedWordIds];
  if (ids.length === 0) return;

  const notebooks = notebookLists();
  if (notebooks.length === 0) {
    alert("先に「＋ 新規」から単語帳を作成してください。");
    return;
  }

  const listing = notebooks.map((l) => `${l.id}（${l.name}）`).join("\n");
  const targetId = prompt(`追加先の単語帳IDを入力してください:\n${listing}`);
  if (!targetId) return;
  const target = notebooks.find((l) => l.id === targetId);
  if (!target) {
    alert("その単語帳が見つかりませんでした。");
    return;
  }

  let sectionId = null;
  try {
    const sections = await api(`/lists/${encodeURIComponent(targetId)}/sections`);
    if (sections.length > 0) {
      const sectionListing = ["（セクションなし）", ...sections.map((s) => `${s.id}: ${s.name}`)].join("\n");
      const sectionInput = prompt(`セクションIDを入力（省略可）:\n${sectionListing}`);
      if (sectionInput && sectionInput.trim()) sectionId = Number(sectionInput.trim());
    }
  } catch {
    /* sections optional */
  }

  try {
    const result = await api(`/lists/${encodeURIComponent(targetId)}/add-words`, {
      method: "POST",
      body: JSON.stringify({ wordIds: ids, sectionId }),
    });
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
  } else if (kind === "derivatives") {
    node.querySelector(".pos").value = data.pos || "";
    node.querySelector(".word").value = data.word || "";
    node.querySelector(".meaning").value = data.meaning || "";
  } else if (kind === "examples") {
    node.querySelector(".sentence").value = data.sentence || "";
    node.querySelector(".answer").value = data.answer || "";
    node.querySelector(".translation").value = data.translation || "";
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
        sentence: r.querySelector(".sentence").value.trim(),
        answer: r.querySelector(".answer").value.trim(),
        translation: r.querySelector(".translation").value.trim(),
      }))
      .filter((r) => r.sentence);
  }
  return [];
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
  el.fieldDerivedFrom.value = "";
  el.fieldSection.value = "";
  clearRepeatList(el.sensesList);
  clearRepeatList(el.derivativesList);
  clearRepeatList(el.examplesList);
  addRow("senses");
  addRow("derivatives");
  addRow("examples");
  el.fieldEtymology.value = "";
  el.fieldNotes.value = "";
  el.tagOxford5000.checked = false;
  el.tagAwl.checked = false;
  el.tagEiken.value = "";
  el.tagCustom.value = "";
  updatePreview(el.fieldEtymology, el.etymologyPreview);
  updatePreview(el.fieldNotes, el.notesPreview);
  el.editPane.hidden = false;
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
  el.fieldDerivedFrom.value = detail.derivedFrom ? detail.derivedFrom.spelling : "";
  el.fieldSection.value = membership?.sectionId != null ? String(membership.sectionId) : "";

  clearRepeatList(el.sensesList);
  (detail.senses.length ? detail.senses : [{}]).forEach((s) => addRow("senses", s));
  clearRepeatList(el.derivativesList);
  (detail.derivatives.length ? detail.derivatives : [{}]).forEach((d) => addRow("derivatives", d));
  clearRepeatList(el.examplesList);
  (detail.examples.length ? detail.examples : [{}]).forEach((ex) => addRow("examples", ex));

  el.fieldEtymology.value = detail.etymology || "";
  el.fieldNotes.value = detail.notes || "";
  el.tagOxford5000.checked = "oxford5000" in detail.tags;
  el.tagAwl.checked = "awl" in detail.tags;
  el.tagEiken.value = detail.tags.eiken || "";
  el.tagCustom.value = Object.entries(detail.tags)
    .filter(([k]) => k.startsWith("custom:"))
    .map(([k]) => k.slice("custom:".length))
    .join(", ");

  updatePreview(el.fieldEtymology, el.etymologyPreview);
  updatePreview(el.fieldNotes, el.notesPreview);
  el.editPane.hidden = false;
  setEditorOpen(true);
  updateEditorListFields();
  renderWordTable();
}

function closeEditor() {
  state.currentWord = null;
  el.editPane.hidden = true;
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
    derivedFrom: el.fieldDerivedFrom.value.trim() || "",
    senses: collectRows("senses"),
    derivatives: collectRows("derivatives"),
    examples: collectRows("examples"),
    etymology: el.fieldEtymology.value.trim() || null,
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

el.menuToggle.addEventListener("click", toggleTopbarMenu);
el.backBtn.addEventListener("click", closeEditor);
el.mobileSaveBtn.addEventListener("click", saveWord);
window.addEventListener("resize", () => {
  if (!isMobileLayout()) closeTopbarMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !el.editPane.hidden) closeEditor();
});

el.listSelect.addEventListener("change", (e) => selectList(e.target.value));
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
el.fieldNotes.addEventListener("input", () => updatePreview(el.fieldNotes, el.notesPreview));

document.querySelectorAll(".add-row-btn").forEach((btn) => {
  btn.addEventListener("click", () => addRow(btn.dataset.add));
});

loadLists().catch((err) => {
  console.error(err);
  el.listTitle.textContent = `読み込みエラー: ${err.message}`;
});
