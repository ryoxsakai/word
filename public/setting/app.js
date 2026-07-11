import { renderMarkup } from "../shared/markup.js";
import { API_BASE } from "../shared/config.js";
import { formatPronunciationWithAccents } from "../shared/pronunciation.js";
import { attachPullToRefresh } from "../shared/pull-to-refresh.js";

const API = `${API_BASE}/api`;
const NEW_SECTION_VALUE = "__new__";
const MASTER_LIST_ID = "__master__";
const LAST_LIST_KEY = "vocab-setting-last-list";
const LAST_ADD_NOTEBOOK_KEY = "vocab-setting-last-add-notebook";
const LAST_ADD_NOTEBOOK_SECTION_KEY = "vocab-setting-last-add-notebook-section";
const THEME_KEY = "vocab-setting-theme";
const SEARCH_VISIBLE_KEY = "vocab-setting-search-visible";

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
  notebookSearchQuery: "",
  masterOffset: 0,
  masterHasMore: false,
  masterLoading: false,
};

const MASTER_PAGE_SIZE = 150;
let tableSearchTimer = null;
let dragState = null; // { type: "word" | "section", id } | { type: "repeat-row", kind, row }

const el = {
  layout: document.getElementById("layout"),
  toast: document.getElementById("toast"),
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
  sectionFieldSubtitle: document.getElementById("sectionFieldSubtitle"),
  sectionFieldDescription: document.getElementById("sectionFieldDescription"),
  listSelect: document.getElementById("listSelect"),
  listManageBtn: document.getElementById("listManageBtn"),
  listManageModalOverlay: document.getElementById("listManageModalOverlay"),
  listManageCloseBtn: document.getElementById("listManageCloseBtn"),
  listManageList: document.getElementById("listManageList"),
  listManageNewName: document.getElementById("listManageNewName"),
  listManageCreateBtn: document.getElementById("listManageCreateBtn"),
  listSettingsBtn: document.getElementById("listSettingsBtn"),
  listSettingsModalOverlay: document.getElementById("listSettingsModalOverlay"),
  listSettingsCloseBtn: document.getElementById("listSettingsCloseBtn"),
  listSettingsSectionLabel: document.getElementById("listSettingsSectionLabel"),
  listSettingsSaveBtn: document.getElementById("listSettingsSaveBtn"),
  newWordBtn: document.getElementById("newWordBtn"),
  newSectionBtn: document.getElementById("newSectionBtn"),
  moveToSectionBtn: document.getElementById("moveToSectionBtn"),
  moveToSectionModalOverlay: document.getElementById("moveToSectionModalOverlay"),
  moveToSectionCloseBtn: document.getElementById("moveToSectionCloseBtn"),
  moveToSectionCount: document.getElementById("moveToSectionCount"),
  moveToSectionSelect: document.getElementById("moveToSectionSelect"),
  moveToSectionConfirmBtn: document.getElementById("moveToSectionConfirmBtn"),
  toggleSearchBtn: document.getElementById("toggleSearchBtn"),
  tableSearchRow: document.getElementById("tableSearchRow"),
  tableSearchInput: document.getElementById("tableSearchInput"),
  masterToolbar: document.getElementById("masterToolbar"),
  filterAwl: document.getElementById("filterAwl"),
  filterOxford: document.getElementById("filterOxford"),
  filterTarget1900: document.getElementById("filterTarget1900"),
  filterTarget1400: document.getElementById("filterTarget1400"),
  selectionCount: document.getElementById("selectionCount"),
  selectAllMasterBtn: document.getElementById("selectAllMasterBtn"),
  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
  addToNotebookBtn: document.getElementById("addToNotebookBtn"),
  addToNotebookSettingsBtn: document.getElementById("addToNotebookSettingsBtn"),
  addNotebookModalOverlay: document.getElementById("addNotebookModalOverlay"),
  addNotebookConfirmBtn: document.getElementById("addNotebookConfirmBtn"),
  addNotebookCloseBtn: document.getElementById("addNotebookCloseBtn"),
  addNotebookSelect: document.getElementById("addNotebookSelect"),
  addNotebookSection: document.getElementById("addNotebookSection"),
  wordTableHead: document.getElementById("wordTableHead"),
  wordTableBody: document.getElementById("wordTableBody"),
  wordTableEmpty: document.getElementById("wordTableEmpty"),
  tableScroll: document.getElementById("tableScroll"),
  ptrIndicator: document.getElementById("ptrIndicator"),
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
  spellingCautionBtn: document.getElementById("spellingCautionBtn"),
  pronunciationCautionBtn: document.getElementById("pronunciationCautionBtn"),
  accentCautionBtn: document.getElementById("accentCautionBtn"),
  polysemousCautionBtn: document.getElementById("polysemousCautionBtn"),
  conjugationCautionBtn: document.getElementById("conjugationCautionBtn"),
  draftFromDictionaryBtn: document.getElementById("draftFromDictionaryBtn"),
  fieldDerivedFrom: document.getElementById("fieldDerivedFrom"),
  fieldSection: document.getElementById("fieldSection"),
  sensesList: document.getElementById("sensesList"),
  derivativesList: document.getElementById("derivativesList"),
  examplesList: document.getElementById("examplesList"),
  fieldIrregularForms: document.getElementById("fieldIrregularForms"),
  irregularFormsPreview: document.getElementById("irregularFormsPreview"),
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
  tagTarget1900Display: document.getElementById("tagTarget1900Display"),
  tagTarget1400Display: document.getElementById("tagTarget1400Display"),
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

function getCurrentList() {
  return state.lists.find((l) => l.id === state.currentListId) || null;
}

function getSectionLabel() {
  return getCurrentList()?.sectionLabel || "Section";
}

// セクション名は保存せず、単語帳の呼び方(Section/Unit/Part)+並び順から常に計算する。
// (並べ替えても番号がずれないようにするため)
function sectionDisplayName(sectionId) {
  const index = state.sections.findIndex((s) => s.id === sectionId);
  if (index === -1) return "";
  return `${getSectionLabel()} ${index + 1}`;
}

function setEditorOpen(open) {
  el.editModalOverlay.hidden = !open;
  if (open) {
    el.editPane.scrollTop = 0;
  }
}

let toastTimer;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 2200);
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
  if (type === "spelling") {
    return w.spellingCaution
      ? '<span class="caution-icon caution-spelling" title="スペル注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></span>'
      : "";
  }
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
  if (type === "poly") {
    return w.polysemousCaution
      ? '<span class="caution-icon caution-polysemous" title="多義語"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></span>'
      : "";
  }
  if (type === "conjugation") {
    return w.conjugationCaution
      ? '<span class="caution-icon caution-conjugation" title="活用注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></span>'
      : "";
  }
  return "";
}

function updateSelectionUi() {
  const n = state.selectedWordIds.size;
  el.selectionCount.textContent = `${n}語選択`;
  el.addToNotebookBtn.disabled = n === 0;
  el.moveToSectionBtn.disabled = n === 0;
}

function updateListModeUi() {
  const master = isMasterView();
  const notebook = isNotebookView();
  el.masterToolbar.hidden = !master;
  el.addToNotebookBtn.hidden = !master;
  el.addToNotebookSettingsBtn.hidden = !master;
  el.newSectionBtn.hidden = !notebook;
  el.newSectionBtn.disabled = !notebook;
  el.moveToSectionBtn.hidden = !notebook;
  el.listSettingsBtn.hidden = !notebook;
  document.body.classList.toggle("view-master", master);
  document.body.classList.toggle("view-notebook", notebook);
  updateEditorListFields();
}

function updateEditorListFields() {
  const showNotebookFields = isNotebookView() && !el.editModalOverlay.hidden;
  el.notebookFields.hidden = !showNotebookFields;
  // マスターでは完全削除(ゴミ箱)、単語帳ではリストからの除外(−)とアイコンを分けて示す
  if (isMasterView()) {
    el.deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
    el.deleteBtn.title = "マスターから削除";
    el.deleteBtn.setAttribute("aria-label", "マスターから削除");
  } else if (isNotebookView()) {
    el.deleteBtn.innerHTML = '<i class="fa-solid fa-circle-minus" aria-hidden="true"></i>';
    el.deleteBtn.title = "単語帳から除外";
    el.deleteBtn.setAttribute("aria-label", "単語帳から除外");
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
    el.newWordBtn.disabled = true;
  }
}

async function selectList(listId) {
  state.currentListId = listId;
  localStorage.setItem(LAST_LIST_KEY, listId);
  state.selectedWordIds.clear();
  updateSelectionUi();
  el.newWordBtn.disabled = !listId;
  updateListModeUi();
  closeEditor();
  state.masterFilter.q = "";
  state.notebookSearchQuery = "";
  el.tableSearchInput.value = "";
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
  // loadWordsForListと並行して呼ばれることが多いため、こちらが後に解決した場合でも
  // 単語一覧を再描画して最新のセクション帯を反映する(先に解決した側の描画が古いsectionsで
  // 上書きされたままにならないようにするため)。
  renderWordTable();
}

// プルリフレッシュ用: 選択中/検索状態は保ったまま、単語とセクションをサーバーから読み直す。
async function refreshCurrentList() {
  if (!state.currentListId) return;
  await Promise.all([loadWordsForList(state.currentListId), loadSectionsForList(state.currentListId)]);
}

function renderSectionOptions() {
  const current = el.fieldSection.value;
  el.fieldSection.innerHTML = '<option value="">なし</option>';
  state.sections.forEach((s, index) => {
    const opt = document.createElement("option");
    opt.value = String(s.id);
    const name = `${getSectionLabel()} ${index + 1}`;
    opt.textContent = s.subtitle ? `${name} - ${s.subtitle}` : name;
    el.fieldSection.appendChild(opt);
  });
  const newOpt = document.createElement("option");
  newOpt.value = NEW_SECTION_VALUE;
  newOpt.textContent = "＋ 新規セクション...";
  el.fieldSection.appendChild(newOpt);
  if ([...el.fieldSection.options].some((o) => o.value === current)) el.fieldSection.value = current;
}

async function handleSectionSelectChange() {
  if (el.fieldSection.value !== NEW_SECTION_VALUE) return;
  try {
    const section = await api(`/lists/${encodeURIComponent(state.currentListId)}/sections`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await loadSectionsForList(state.currentListId);
    el.fieldSection.value = String(section.id);
  } catch (err) {
    alert(`セクション作成に失敗しました: ${err.message}`);
    el.fieldSection.value = "";
  }
}

// ---- セクションの管理モーダル（作成・改名・削除・並び替え） ----

// 「セクション」ボタンを押すと、名前入力なしで空のセクションを末尾に追加し即座に帯を表示する。
// サブタイトル・説明・並び順は帯をクリックして後から編集する。
async function createSectionInstant() {
  if (!isNotebookView()) return;
  try {
    await api(`/lists/${encodeURIComponent(state.currentListId)}/sections`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await Promise.all([loadSectionsForList(state.currentListId), loadWordsForList(state.currentListId)]);
    showToast("セクションを追加しました");
  } catch (err) {
    alert(`セクション作成に失敗しました: ${err.message}`);
  }
}

function openListSettingsModal() {
  if (!isNotebookView()) return;
  const list = getCurrentList();
  el.listSettingsSectionLabel.value = list?.sectionLabel || "Section";
  el.listSettingsModalOverlay.hidden = false;
}

function closeListSettingsModal() {
  el.listSettingsModalOverlay.hidden = true;
}

async function saveListSettings() {
  const list = getCurrentList();
  if (!list) return;
  try {
    await api(`/lists/${encodeURIComponent(list.id)}`, {
      method: "PUT",
      body: JSON.stringify({
        name: list.name,
        description: list.description,
        sectionLabel: el.listSettingsSectionLabel.value,
      }),
    });
    state.lists = await api("/lists");
    closeListSettingsModal();
    renderWordTable();
    showToast("単語帳の設定を保存しました");
  } catch (err) {
    alert(`保存に失敗しました: ${err.message}`);
  }
}

const LEVEL_COLUMNS_HEAD =
  '<th class="col-awl">AWL</th><th class="col-oxford">Oxford</th><th class="col-eiken">英検</th><th class="col-target1900">1900</th><th class="col-target1400">1400</th>';
const PRON_COLUMNS_HEAD =
  '<th class="col-pron">発音</th><th class="col-caution-spelling">スペル注意</th><th class="col-caution-pron">発音注意</th><th class="col-caution-accent">アクセント注意</th><th class="col-caution-poly">多義語</th><th class="col-caution-conjugation">活用注意</th>';

function renderWordTableHead() {
  if (isMasterView()) {
    el.wordTableHead.innerHTML =
      `<tr><th class="col-check"><input type="checkbox" id="checkAllWords" aria-label="表示中の単語を全選択" /></th><th>スペル</th><th class="col-meaning">意味</th>${LEVEL_COLUMNS_HEAD}${PRON_COLUMNS_HEAD}</tr>`;
  } else {
    el.wordTableHead.innerHTML =
      `<tr><th class="col-check"><input type="checkbox" id="checkAllWords" aria-label="表示中の単語を全選択" /></th><th class="col-no">no.</th><th>スペル</th><th class="col-meaning">意味</th>${LEVEL_COLUMNS_HEAD}${PRON_COLUMNS_HEAD}<th class="col-move">並び替え</th></tr>`;
  }
  const checkAll = document.getElementById("checkAllWords");
  checkAll.checked = state.words.length > 0 && state.words.every((w) => state.selectedWordIds.has(w.id));
  checkAll.indeterminate =
    state.selectedWordIds.size > 0 && !state.words.every((w) => state.selectedWordIds.has(w.id));
  checkAll.addEventListener("change", () => {
    if (checkAll.checked) state.words.forEach((w) => state.selectedWordIds.add(w.id));
    else state.words.forEach((w) => state.selectedWordIds.delete(w.id));
    updateSelectionUi();
    renderWordTable();
  });
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

// wordIdsを指定セクションの先頭へまとめて移動した並び順を組み立てる。
// 単純に配列中の1箇所へ挿入するだけだと、移動先セクションに既存メンバーが1件も
// いない場合にinsertAtが見つからず末尾へ追いやられ、表示上は先頭のセクションなのに
// noだけ最大値になる、という連番の食い違いが起きていた。
// そのため、既存セクションの表示順(state.sections、セクションなしは先頭)を基準に
// 全体を毎回組み直すことで、noが常に表示順と一致するようにする。
function buildOrderWithWordsMovedToSection(wordIds, sectionId) {
  const order = getHeadWordOrder();
  const idSet = new Set(wordIds);
  const moving = order.filter((it) => idSet.has(it.wordId));
  for (const it of moving) it.sectionId = sectionId;

  const sectionOrder = [null, ...state.sections.map((s) => s.id)];
  const groups = new Map(sectionOrder.map((id) => [id, []]));
  for (const it of order) {
    if (idSet.has(it.wordId)) continue;
    if (!groups.has(it.sectionId)) groups.set(it.sectionId, []);
    groups.get(it.sectionId).push(it);
  }
  groups.get(sectionId).unshift(...moving);

  return [...groups.values()].flat();
}

// wordIdを指定セクションの先頭へ移動する(sectionIdはnull=セクションなしも可)。
async function moveWordToSectionStart(wordId, sectionId) {
  await submitReorder(buildOrderWithWordsMovedToSection([wordId], sectionId));
}

// チェック済みの複数単語を、指定セクションの先頭へまとめて移動する。
async function moveWordsToSectionStart(wordIds, sectionId) {
  await submitReorder(buildOrderWithWordsMovedToSection(wordIds, sectionId));
}

function openMoveToSectionModal() {
  if (!isNotebookView()) return;
  const ids = [...state.selectedWordIds];
  if (ids.length === 0) return;
  el.moveToSectionCount.textContent = `${ids.length}語を移動します`;
  el.moveToSectionSelect.innerHTML = '<option value="">（セクションなし）</option>';
  const label = getSectionLabel();
  state.sections.forEach((s, index) => {
    const opt = document.createElement("option");
    opt.value = String(s.id);
    const name = `${label} ${index + 1}`;
    opt.textContent = s.subtitle ? `${name} - ${s.subtitle}` : name;
    el.moveToSectionSelect.appendChild(opt);
  });
  el.moveToSectionModalOverlay.hidden = false;
}

function closeMoveToSectionModal() {
  el.moveToSectionModalOverlay.hidden = true;
}

async function confirmMoveToSection() {
  const ids = [...state.selectedWordIds];
  if (ids.length === 0) {
    closeMoveToSectionModal();
    return;
  }
  const sectionValue = el.moveToSectionSelect.value;
  const sectionId = sectionValue ? Number(sectionValue) : null;
  await moveWordsToSectionStart(ids, sectionId);
  closeMoveToSectionModal();
  state.selectedWordIds.clear();
  updateSelectionUi();
  renderWordTable();
  showToast(`${ids.length}語を移動しました`);
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

// タッチ端末はHTML5 drag&dropが使えないため、長押し(LONG_PRESS_MS)でドラッグを開始する。
// 長押し確定前に指が動いた場合はスクロールとみなしてキャンセルする。
const TOUCH_LONG_PRESS_MS = 380;
const TOUCH_MOVE_TOLERANCE = 10;

function attachTouchLongPressDrag(sourceEl, { findTargetEl, onDrop }) {
  let timer = null;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let hoverEl = null;

  function clearHover() {
    if (hoverEl) hoverEl.classList.remove("drag-over");
    hoverEl = null;
  }

  function endDrag() {
    dragging = false;
    clearTimeout(timer);
    timer = null;
    sourceEl.classList.remove("dragging", "touch-drag-armed");
    clearHover();
  }

  sourceEl.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      clearTimeout(timer);
      // 長押しがドラッグとして確定する前から文字選択を止めておく。
      // (ブラウザの長押し=テキスト選択ジェスチャーとレースになり、選択メニューが同時に出てしまうため)
      sourceEl.classList.add("touch-drag-armed");
      timer = setTimeout(() => {
        dragging = true;
        sourceEl.classList.add("dragging");
        if (navigator.vibrate) navigator.vibrate(15);
      }, TOUCH_LONG_PRESS_MS);
    },
    { passive: true }
  );

  sourceEl.addEventListener(
    "touchmove",
    (e) => {
      if (!dragging) {
        const touch = e.touches[0];
        if (
          Math.abs(touch.clientX - startX) > TOUCH_MOVE_TOLERANCE ||
          Math.abs(touch.clientY - startY) > TOUCH_MOVE_TOLERANCE
        ) {
          clearTimeout(timer);
          sourceEl.classList.remove("touch-drag-armed");
        }
        return;
      }
      e.preventDefault();
      const touch = e.touches[0];
      const under = document.elementFromPoint(touch.clientX, touch.clientY);
      const target = under ? findTargetEl(under) : null;
      if (target !== hoverEl) {
        clearHover();
        hoverEl = target;
        if (hoverEl) hoverEl.classList.add("drag-over");
      }
    },
    { passive: false }
  );

  sourceEl.addEventListener("touchend", (e) => {
    if (!dragging) {
      clearTimeout(timer);
      sourceEl.classList.remove("touch-drag-armed");
      return;
    }
    e.preventDefault();
    if (hoverEl) onDrop(hoverEl);
    endDrag();
  });

  sourceEl.addEventListener("touchcancel", endDrag);
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

  attachTouchLongPressDrag(tr, {
    findTargetEl: (el2) => el2.closest('tr[data-word-id]:not(.branch-row), tr.section-band-clickable'),
    onDrop: (targetEl) => {
      if (targetEl.dataset.sectionId) {
        moveWordToSectionStart(wordId, Number(targetEl.dataset.sectionId));
      } else if (targetEl.dataset.wordId && targetEl.dataset.wordId !== wordId) {
        moveWordBeforeTarget(wordId, targetEl.dataset.wordId);
      }
    },
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

// 意味・例文・派生語の行を上下ボタン/ドラッグ&ドロップで並び替える。
// APIには保存時にDOM順のままcollectRows()で送るので、ここではDOM操作だけで完結する。
function moveRepeatRow(row, direction) {
  if (direction === -1) {
    const prev = row.previousElementSibling;
    if (prev) row.parentElement.insertBefore(row, prev);
  } else {
    const next = row.nextElementSibling;
    if (next) row.parentElement.insertBefore(next, row);
  }
}

function attachRepeatRowReorder(row, kind) {
  const handle = row.querySelector(".row-drag-handle");
  handle.addEventListener("dragstart", (e) => {
    dragState = { type: "repeat-row", kind, row };
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
  });
  handle.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    row.parentElement.querySelectorAll(".drag-over").forEach((r) => r.classList.remove("drag-over"));
  });
  row.addEventListener("dragover", (e) => {
    if (dragState?.type !== "repeat-row" || dragState.kind !== kind) return;
    e.preventDefault();
    row.classList.add("drag-over");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    row.classList.remove("drag-over");
    if (dragState?.type !== "repeat-row" || dragState.kind !== kind) return;
    const draggedRow = dragState.row;
    dragState = null;
    if (draggedRow !== row) row.parentElement.insertBefore(draggedRow, row);
  });
  row.querySelector('[data-action="row-up"]').addEventListener("click", () => moveRepeatRow(row, -1));
  row.querySelector('[data-action="row-down"]').addEventListener("click", () => moveRepeatRow(row, 1));
}

function buildSectionBandRow(sectionId, sectionSubtitle) {
  // ヘッダーの実際の列数に合わせる(固定値だと列を追加・削除するたびにここがずれて、
  // セクション帯の右端が単語行のcol-move列の右端と合わなくなってしまうため)。
  const colspan = el.wordTableHead.querySelectorAll("th").length || 12;
  const sectionTr = document.createElement("tr");
  sectionTr.className = "section-header-row";
  const sectionIndex = sectionId != null ? state.sections.findIndex((s) => s.id === sectionId) : -1;
  const sectionName = sectionId != null ? sectionDisplayName(sectionId) : null;
  const isFirst = sectionIndex <= 0;
  const isLast = sectionIndex === -1 || sectionIndex === state.sections.length - 1;
  const moveButtons =
    sectionId != null
      ? `<span class="section-move-btns">
          <button type="button" class="move-btn" data-action="section-up" ${isFirst ? "disabled" : ""} aria-label="セクションを上へ"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
          <button type="button" class="move-btn" data-action="section-down" ${isLast ? "disabled" : ""} aria-label="セクションを下へ"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
        </span>`
      : "";
  const nameHtml = `<span class="section-band-name">${escapeHtml(sectionName || "（セクションなし）")}</span>${sectionSubtitle ? `<span class="section-band-subtitle">${escapeHtml(sectionSubtitle)}</span>` : ""}`;
  sectionTr.innerHTML = `<td colspan="${colspan}"><span class="section-band-inner"><span class="section-band-text">${nameHtml}</span>${moveButtons}</span></td>`;
  if (sectionId != null) {
    sectionTr.draggable = true;
    sectionTr.dataset.sectionId = String(sectionId);
    sectionTr.classList.add("section-band-clickable");
    sectionTr.title = "クリックしてサブタイトル・説明を編集";
    sectionTr.addEventListener("click", () => openSectionEditor(sectionId));
    sectionTr.querySelector('[data-action="section-up"]').addEventListener("click", (e) => {
      e.stopPropagation();
      moveSectionBy(sectionId, -1);
    });
    sectionTr.querySelector('[data-action="section-down"]').addEventListener("click", (e) => {
      e.stopPropagation();
      moveSectionBy(sectionId, 1);
    });
    attachSectionDragHandlers(sectionTr, sectionId);
  }
  return sectionTr;
}

function buildWordRow(w) {
  const tr = document.createElement("tr");
  tr.dataset.wordId = w.id;
  if (w.branch) tr.classList.add("branch-row");
  if (state.currentWord?.id === w.id) tr.classList.add("selected");
  if (state.selectedWordIds.has(w.id)) tr.classList.add("checked-row");

  const meaningCell = `<td class="col-meaning">${w.primaryPos ? `<span class="meaning-pos">${escapeHtml(w.primaryPos)}</span>` : ""}${escapeHtml(w.primaryMeaning || "")}</td>`;
  const levelCells =
    `<td class="col-awl">${formatLevelBadgeCell(w, "awl")}</td>` +
    `<td class="col-oxford">${formatLevelBadgeCell(w, "oxford")}</td>` +
    `<td class="col-eiken">${formatLevelBadgeCell(w, "eiken")}</td>` +
    `<td class="col-target1900">${formatLevelBadgeCell(w, "target1900")}</td>` +
    `<td class="col-target1400">${formatLevelBadgeCell(w, "target1400")}</td>`;
  const pronCells =
    `<td class="col-pron">${escapeHtml(formatPronunciationWithAccents(w.pronunciation || ""))}</td>` +
    `<td class="col-caution-spelling">${formatCautionBadgeCell(w, "spelling")}</td>` +
    `<td class="col-caution-pron">${formatCautionBadgeCell(w, "pron")}</td>` +
    `<td class="col-caution-accent">${formatCautionBadgeCell(w, "accent")}</td>` +
    `<td class="col-caution-poly">${formatCautionBadgeCell(w, "poly")}</td>` +
    `<td class="col-caution-conjugation">${formatCautionBadgeCell(w, "conjugation")}</td>`;

  const checked = state.selectedWordIds.has(w.id);
  const checkCell = `<td class="col-check"><input type="checkbox" class="word-check" ${checked ? "checked" : ""} aria-label="${escapeHtml(w.spelling)}を選択" /></td>`;

  if (isMasterView()) {
    tr.innerHTML = `${checkCell}<td class="col-spelling">${escapeHtml(w.spelling)}</td>${meaningCell}${levelCells}${pronCells}`;
  } else {
    const moveCell = w.branch
      ? `<td class="col-move"></td>`
      : `<td class="col-move"><button type="button" class="move-btn" data-action="word-up" aria-label="上へ"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button><button type="button" class="move-btn" data-action="word-down" aria-label="下へ"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button></td>`;
    tr.innerHTML = `${checkCell}<td class="col-no">${escapeHtml(w.displayNo)}</td><td class="col-spelling">${escapeHtml(w.spelling)}</td>${meaningCell}${levelCells}${pronCells}${moveCell}`;
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
  return tr;
}

function renderWordTable() {
  el.wordTableBody.innerHTML = "";

  if (isMasterView()) {
    el.wordTableEmpty.hidden = state.words.length > 0;
    el.wordTableEmpty.textContent = "条件に一致する単語がありません。";
    for (const w of state.words) el.wordTableBody.appendChild(buildWordRow(w));
    return;
  }

  const query = state.notebookSearchQuery;
  const words = query ? state.words.filter((w) => w.spelling.toLowerCase().includes(query)) : state.words;

  el.wordTableEmpty.hidden = words.length > 0;
  el.wordTableEmpty.textContent =
    state.words.length === 0
      ? "この単語帳にはまだ単語がありません。親リストからチェックして追加してください。"
      : "検索条件に一致する単語がありません。";

  // セクションは単語が0件でも帯を表示する(新規作成直後に見えなくなるのを防ぐため)。
  // セクションなしの単語は先頭、以降はstate.sectionsの並び順どおりに帯を出す。
  const wordsBySection = new Map();
  for (const w of words) {
    const key = w.sectionId ?? null;
    if (!wordsBySection.has(key)) wordsBySection.set(key, []);
    wordsBySection.get(key).push(w);
  }

  const noSectionWords = wordsBySection.get(null) || [];
  if (noSectionWords.length > 0) {
    el.wordTableBody.appendChild(buildSectionBandRow(null, null));
    for (const w of noSectionWords) el.wordTableBody.appendChild(buildWordRow(w));
  }

  for (const section of state.sections) {
    el.wordTableBody.appendChild(buildSectionBandRow(section.id, section.subtitle));
    const wordsInSection = wordsBySection.get(section.id) || [];
    for (const w of wordsInSection) el.wordTableBody.appendChild(buildWordRow(w));
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

function setSearchRowVisible(visible) {
  el.tableSearchRow.hidden = !visible;
  el.toggleSearchBtn.setAttribute("aria-expanded", String(visible));
  el.toggleSearchBtn.classList.toggle("is-active", visible);
  localStorage.setItem(SEARCH_VISIBLE_KEY, visible ? "1" : "0");
  if (visible) {
    el.tableSearchInput.focus();
  } else if (el.tableSearchInput.value) {
    el.tableSearchInput.value = "";
    applyTableSearch();
  }
}

// 検索窓の入力を現在のビューに応じて振り分ける(マスターはサーバー側フィルタ、単語帳はクライアント側で絞り込む)。
async function applyTableSearch() {
  if (isMasterView()) {
    await applyMasterFilters();
  } else {
    state.notebookSearchQuery = el.tableSearchInput.value.trim().toLowerCase();
    renderWordTable();
  }
}

async function applyMasterFilters() {
  state.masterFilter.q = el.tableSearchInput.value.trim();
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

// 指定した単語帳に対応するセクション一覧をプルダウンへ読み込む。
// preferredSectionValueを渡すと、選択肢に存在する場合そのセクションを初期選択する(前回の記憶を復元する用途)。
async function loadAddNotebookSections(listId, preferredSectionValue) {
  el.addNotebookSection.innerHTML = '<option value="">（セクションなし）</option>';
  if (!listId) return;
  try {
    const sections = await api(`/lists/${encodeURIComponent(listId)}/sections`);
    const label = state.lists.find((l) => l.id === listId)?.sectionLabel || "Section";
    sections.forEach((s, index) => {
      const opt = document.createElement("option");
      opt.value = String(s.id);
      const name = `${label} ${index + 1}`;
      opt.textContent = s.subtitle ? `${name} - ${s.subtitle}` : name;
      el.addNotebookSection.appendChild(opt);
    });
  } catch {
    /* sections optional */
  }
  if (preferredSectionValue != null && [...el.addNotebookSection.options].some((o) => o.value === preferredSectionValue)) {
    el.addNotebookSection.value = preferredSectionValue;
  }
}

// 「単語帳」ボタンの追加先(単語帳・セクション)を設定するモーダルを開く。
// ここではまだ何も追加しない。「保存」で記憶した設定を、以後「単語帳」ボタンが直接使う。
async function openAddNotebookSettingsModal() {
  const notebooks = notebookLists();
  if (notebooks.length === 0) {
    alert("先に「編集」から単語帳を作成してください。");
    return;
  }

  el.addNotebookSelect.innerHTML = "";
  for (const l of notebooks) {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.name;
    el.addNotebookSelect.appendChild(opt);
  }
  const lastTarget = localStorage.getItem(LAST_ADD_NOTEBOOK_KEY);
  if (lastTarget && notebooks.some((l) => l.id === lastTarget)) el.addNotebookSelect.value = lastTarget;
  const lastSection = localStorage.getItem(LAST_ADD_NOTEBOOK_SECTION_KEY);
  await loadAddNotebookSections(el.addNotebookSelect.value, lastSection);
  setAddNotebookModalOpen(true);
}

function saveAddNotebookSettings() {
  const targetId = el.addNotebookSelect.value;
  const target = notebookLists().find((l) => l.id === targetId);
  if (!target) {
    alert("追加先の単語帳を選択してください。");
    return;
  }
  localStorage.setItem(LAST_ADD_NOTEBOOK_KEY, targetId);
  localStorage.setItem(LAST_ADD_NOTEBOOK_SECTION_KEY, el.addNotebookSection.value);
  closeAddNotebookModal();
  showToast(`追加先を「${target.name}」に設定しました`);
}

// マスターでチェックした単語を、⚙で設定済みの単語帳・セクションへ直接追加する。
// 追加先が未設定(または削除済み)の場合は設定モーダルを開く。
async function addSelectedToNotebook() {
  const ids = [...state.selectedWordIds];
  if (ids.length === 0) return;

  const targetId = localStorage.getItem(LAST_ADD_NOTEBOOK_KEY);
  const target = notebookLists().find((l) => l.id === targetId);
  if (!target) {
    await openAddNotebookSettingsModal();
    return;
  }
  const sectionValue = localStorage.getItem(LAST_ADD_NOTEBOOK_SECTION_KEY) || "";
  const sectionId = sectionValue ? Number(sectionValue) : null;

  try {
    const result = await api(`/lists/${encodeURIComponent(targetId)}/add-words`, {
      method: "POST",
      body: JSON.stringify({ wordIds: ids, sectionId }),
    });
    showToast(`「${target.name}」へ追加: ${result.added}件 / スキップ: ${result.skipped}件`);
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
    node.querySelector(".is-primary").checked = !!data.is_primary;
    // 品詞ごとの発音は毎回あるわけではないので、値があるときだけ入力欄を出し、
    // ないときはボタンを押した場合にのみ入力欄を追加する。
    const pronInput = node.querySelector(".pronunciation");
    const pronBtn = node.querySelector(".add-pron-btn");
    pronInput.value = data.pronunciation || "";
    pronInput.hidden = !data.pronunciation;
    pronBtn.hidden = !!data.pronunciation;
    pronBtn.addEventListener("click", () => {
      pronInput.hidden = false;
      pronBtn.hidden = true;
      pronInput.focus();
    });
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
  attachRepeatRowReorder(node, kind);
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

function updateTagReadonly(el2, label, value) {
  if (value) {
    el2.textContent = `${label}: No.${value}`;
    el2.hidden = false;
  } else {
    el2.textContent = "";
    el2.hidden = true;
  }
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
  setCautionButton(el.spellingCautionBtn, false);
  setCautionButton(el.pronunciationCautionBtn, false);
  setCautionButton(el.accentCautionBtn, false);
  setCautionButton(el.polysemousCautionBtn, false);
  setCautionButton(el.conjugationCautionBtn, false);
  el.fieldDerivedFrom.value = "";
  el.fieldSection.value = "";
  clearRepeatList(el.sensesList);
  clearRepeatList(el.derivativesList);
  clearRepeatList(el.examplesList);
  addRow("senses");
  addRow("derivatives");
  addRow("examples");
  el.fieldIrregularForms.value = "";
  el.fieldEtymology.value = "";
  el.fieldSynonyms.value = "";
  el.fieldAntonyms.value = "";
  el.fieldNotes.value = "";
  el.tagOxford5000.value = "";
  el.tagAwl.value = "";
  el.tagEiken.value = "";
  el.tagCustom.value = "";
  updateTagReadonly(el.tagTarget1900Display, "Target1900", null);
  updateTagReadonly(el.tagTarget1400Display, "Target1400", null);
  updatePreview(el.fieldIrregularForms, el.irregularFormsPreview);
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
  setCautionButton(el.spellingCautionBtn, detail.spellingCaution);
  setCautionButton(el.pronunciationCautionBtn, detail.pronunciationCaution);
  setCautionButton(el.accentCautionBtn, detail.accentCaution);
  setCautionButton(el.polysemousCautionBtn, detail.polysemousCaution);
  setCautionButton(el.conjugationCautionBtn, detail.conjugationCaution);
  el.fieldDerivedFrom.value = detail.derivedFrom ? detail.derivedFrom.spelling : "";
  el.fieldSection.value = membership?.sectionId != null ? String(membership.sectionId) : "";

  clearRepeatList(el.sensesList);
  (detail.senses.length ? detail.senses : [{}]).forEach((s) => addRow("senses", s));
  clearRepeatList(el.derivativesList);
  (detail.derivatives.length ? detail.derivatives : [{}]).forEach((d) => addRow("derivatives", d));
  clearRepeatList(el.examplesList);
  (detail.examples.length ? detail.examples : [{}]).forEach((ex) => addRow("examples", ex));

  el.fieldIrregularForms.value = detail.irregularForms || "";
  el.fieldEtymology.value = detail.etymology || "";
  el.fieldSynonyms.value = detail.synonyms || "";
  el.fieldAntonyms.value = detail.antonyms || "";
  el.fieldNotes.value = detail.notes || "";
  el.tagOxford5000.value = detail.tags.oxford5000 || "";
  el.tagAwl.value = detail.tags.awl || "";
  el.tagEiken.value = detail.tags.eiken || "";
  el.tagCustom.value = Object.entries(detail.tags)
    .filter(([k]) => k.startsWith("custom:"))
    .map(([k]) => k.slice("custom:".length))
    .join(", ");
  updateTagReadonly(el.tagTarget1900Display, "Target1900", detail.tags.target1900);
  updateTagReadonly(el.tagTarget1400Display, "Target1400", detail.tags.target1400);

  updatePreview(el.fieldIrregularForms, el.irregularFormsPreview);
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
  if (el.tagOxford5000.value) tags.oxford5000 = el.tagOxford5000.value;
  if (el.tagAwl.value) tags.awl = el.tagAwl.value;
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
    spellingCaution: isCautionButtonActive(el.spellingCautionBtn),
    pronunciationCaution: isCautionButtonActive(el.pronunciationCautionBtn),
    accentCaution: isCautionButtonActive(el.accentCautionBtn),
    polysemousCaution: isCautionButtonActive(el.polysemousCautionBtn),
    conjugationCaution: isCautionButtonActive(el.conjugationCautionBtn),
    derivedFrom: el.fieldDerivedFrom.value.trim() || "",
    senses: collectRows("senses"),
    derivatives: collectRows("derivatives"),
    examples: collectRows("examples"),
    irregularForms: el.fieldIrregularForms.value.trim() || null,
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
      const wordId = state.currentWord.id;
      // 単語本体とリスト内no/セクションの更新は別テーブルを触る独立した処理なので並行実行する。
      const listItemUpdate =
        isNotebookView() && el.fieldNo.value.trim()
          ? api(`/lists/${encodeURIComponent(state.currentListId)}/items/${encodeURIComponent(wordId)}`, {
              method: "PUT",
              body: JSON.stringify({ no: el.fieldNo.value.trim(), sectionId }),
            })
          : null;
      [word] = await Promise.all([
        api(`/words/${encodeURIComponent(wordId)}`, { method: "PUT", body: JSON.stringify(body) }),
        listItemUpdate,
      ]);
    }
    await loadWordsForList(state.currentListId);
    closeEditor();
    showToast("保存しました");
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
  el.sectionEditTitle.textContent = `セクションを編集: ${sectionDisplayName(sectionId)}`;
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
  try {
    await api(`/lists/${encodeURIComponent(state.currentListId)}/sections/${encodeURIComponent(state.currentSectionId)}`, {
      method: "PUT",
      body: JSON.stringify({
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
  const label = sectionDisplayName(state.currentSectionId);
  if (!confirm(`セクション「${label}」を削除しますか？（所属する単語はセクションなしになります）`)) return;
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

async function createNewList(name) {
  try {
    const { id } = await api("/lists", { method: "POST", body: JSON.stringify({ name }) });
    await loadLists();
    el.listSelect.value = id;
    await selectList(id);
    return id;
  } catch (err) {
    alert(`単語帳作成に失敗しました: ${err.message}`);
    return null;
  }
}

// ---- 単語帳の管理モーダル（作成・改名・削除・並び替え） ----

function editableLists() {
  return state.lists.filter((l) => l.isNotebook);
}

function renderListManageRows() {
  const lists = editableLists();
  el.listManageList.innerHTML = "";
  if (lists.length === 0) {
    el.listManageList.innerHTML = '<p class="empty-msg">まだ単語帳がありません。下から作成してください。</p>';
    return;
  }
  lists.forEach((l, index) => {
    const row = document.createElement("div");
    row.className = "list-manage-row";
    row.dataset.listId = l.id;
    const isFirst = index === 0;
    const isLast = index === lists.length - 1;
    row.innerHTML = `
      <span class="list-manage-move">
        <button type="button" class="move-btn" data-action="list-up" ${isFirst ? "disabled" : ""} aria-label="上へ"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
        <button type="button" class="move-btn" data-action="list-down" ${isLast ? "disabled" : ""} aria-label="下へ"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
      </span>
      <input type="text" class="list-manage-name" value="${escapeHtml(l.name)}" aria-label="単語帳名" />
      <button type="button" class="remove-row-btn" data-action="list-delete" aria-label="削除"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
    `;
    row.querySelector('[data-action="list-up"]').addEventListener("click", () => moveListBy(l.id, -1));
    row.querySelector('[data-action="list-down"]').addEventListener("click", () => moveListBy(l.id, 1));
    row.querySelector('[data-action="list-delete"]').addEventListener("click", () => deleteListFromManage(l.id, l.name));
    const nameInput = row.querySelector(".list-manage-name");
    nameInput.addEventListener("blur", () => renameListFromManage(l.id, l.name, nameInput));
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") nameInput.blur();
    });
    el.listManageList.appendChild(row);
  });
}

async function moveListBy(listId, direction) {
  const lists = editableLists();
  const idx = lists.findIndex((l) => l.id === listId);
  const targetIdx = idx + direction;
  if (idx === -1 || targetIdx < 0 || targetIdx >= lists.length) return;
  const order = lists.map((l) => l.id);
  [order[idx], order[targetIdx]] = [order[targetIdx], order[idx]];
  try {
    await api("/lists/reorder", { method: "POST", body: JSON.stringify({ listIds: order }) });
    await loadLists();
    renderListManageRows();
  } catch (err) {
    alert(`並び替えに失敗しました: ${err.message}`);
  }
}

async function renameListFromManage(listId, originalName, inputEl) {
  const name = inputEl.value.trim();
  if (!name || name === originalName) {
    inputEl.value = originalName;
    return;
  }
  try {
    await api(`/lists/${encodeURIComponent(listId)}`, { method: "PUT", body: JSON.stringify({ name }) });
    await loadLists();
    renderListManageRows();
  } catch (err) {
    alert(`名称変更に失敗しました: ${err.message}`);
    inputEl.value = originalName;
  }
}

async function deleteListFromManage(listId, name) {
  if (!confirm(`単語帳「${name}」を削除しますか？（登録済みの単語データは削除されません）`)) return;
  try {
    await api(`/lists/${encodeURIComponent(listId)}`, { method: "DELETE" });
    const wasCurrent = state.currentListId === listId;
    await loadLists();
    renderListManageRows();
    if (wasCurrent) {
      const fallback = state.lists[0]?.id ?? MASTER_LIST_ID;
      el.listSelect.value = fallback;
      await selectList(fallback);
    }
  } catch (err) {
    alert(`削除に失敗しました: ${err.message}`);
  }
}

async function createListFromManage() {
  const name = el.listManageNewName.value.trim();
  if (!name) return;
  const id = await createNewList(name);
  if (id) {
    el.listManageNewName.value = "";
    renderListManageRows();
  }
}

function openListManageModal() {
  renderListManageRows();
  el.listManageModalOverlay.hidden = false;
}

function closeListManageModal() {
  el.listManageModalOverlay.hidden = true;
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
  if (!el.listManageModalOverlay.hidden) { closeListManageModal(); return; }
  if (!el.listSettingsModalOverlay.hidden) { closeListSettingsModal(); return; }
  if (!el.moveToSectionModalOverlay.hidden) { closeMoveToSectionModal(); return; }
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
el.addNotebookConfirmBtn.addEventListener("click", saveAddNotebookSettings);
el.addNotebookCloseBtn.addEventListener("click", closeAddNotebookModal);
el.addNotebookSelect.addEventListener("change", () => loadAddNotebookSections(el.addNotebookSelect.value));
el.spellingCautionBtn.addEventListener("click", () =>
  setCautionButton(el.spellingCautionBtn, !isCautionButtonActive(el.spellingCautionBtn))
);
el.pronunciationCautionBtn.addEventListener("click", () =>
  setCautionButton(el.pronunciationCautionBtn, !isCautionButtonActive(el.pronunciationCautionBtn))
);
el.accentCautionBtn.addEventListener("click", () =>
  setCautionButton(el.accentCautionBtn, !isCautionButtonActive(el.accentCautionBtn))
);
el.polysemousCautionBtn.addEventListener("click", () =>
  setCautionButton(el.polysemousCautionBtn, !isCautionButtonActive(el.polysemousCautionBtn))
);
el.conjugationCautionBtn.addEventListener("click", () =>
  setCautionButton(el.conjugationCautionBtn, !isCautionButtonActive(el.conjugationCautionBtn))
);

el.listSelect.addEventListener("change", (e) => {
  selectList(e.target.value);
  closeTopbarMenu();
});
el.listManageBtn.addEventListener("click", openListManageModal);
el.listManageCloseBtn.addEventListener("click", closeListManageModal);
el.listManageModalOverlay.addEventListener("click", (e) => {
  if (e.target === el.listManageModalOverlay) closeListManageModal();
});
el.listManageCreateBtn.addEventListener("click", createListFromManage);
el.listManageNewName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createListFromManage();
});
el.listSettingsBtn.addEventListener("click", openListSettingsModal);
el.listSettingsCloseBtn.addEventListener("click", closeListSettingsModal);
el.listSettingsModalOverlay.addEventListener("click", (e) => {
  if (e.target === el.listSettingsModalOverlay) closeListSettingsModal();
});
el.listSettingsSaveBtn.addEventListener("click", saveListSettings);
el.newWordBtn.addEventListener("click", openNewWordForm);
el.newSectionBtn.addEventListener("click", createSectionInstant);
el.selectAllMasterBtn.addEventListener("click", selectAllMasterWords);
el.clearSelectionBtn.addEventListener("click", clearWordSelection);
el.addToNotebookBtn.addEventListener("click", addSelectedToNotebook);
el.addToNotebookSettingsBtn.addEventListener("click", openAddNotebookSettingsModal);
el.moveToSectionBtn.addEventListener("click", openMoveToSectionModal);
el.moveToSectionCloseBtn.addEventListener("click", closeMoveToSectionModal);
el.moveToSectionModalOverlay.addEventListener("click", (e) => {
  if (e.target === el.moveToSectionModalOverlay) closeMoveToSectionModal();
});
el.moveToSectionConfirmBtn.addEventListener("click", confirmMoveToSection);
el.toggleSearchBtn.addEventListener("click", () => setSearchRowVisible(el.tableSearchRow.hidden));
el.tableSearchInput.addEventListener("input", () => {
  clearTimeout(tableSearchTimer);
  tableSearchTimer = setTimeout(() => applyTableSearch(), 300);
});
el.filterAwl.addEventListener("change", () => applyMasterFilters());
el.filterOxford.addEventListener("change", () => applyMasterFilters());
el.filterTarget1900.addEventListener("change", () => applyMasterFilters());
el.filterTarget1400.addEventListener("change", () => applyMasterFilters());
el.tableScroll.addEventListener("scroll", handleWordTableScroll);
if (el.ptrIndicator) {
  attachPullToRefresh({
    hitArea: el.tableScroll,
    indicatorEl: el.ptrIndicator,
    getScrollTop: () => el.tableScroll.scrollTop,
    onRefresh: refreshCurrentList,
    // 単語行の長押しドラッグ中は競合するので、その間はプルリフレッシュを発火させない。
    isBlocked: (target) => !!target.closest(".touch-drag-armed, [draggable=\"true\"]"),
  });
}
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
el.fieldIrregularForms.addEventListener("input", () => updatePreview(el.fieldIrregularForms, el.irregularFormsPreview));
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

// 検索窓の表示状態をlocalStorageから復元する(inputへのフォーカスは初期表示時には行わない)。
if (localStorage.getItem(SEARCH_VISIBLE_KEY) === "1") {
  el.tableSearchRow.hidden = false;
  el.toggleSearchBtn.setAttribute("aria-expanded", "true");
  el.toggleSearchBtn.classList.add("is-active");
}
