import {
  addDerivativeCrossReferenceAliases,
  collectDerivativeCrossReferences,
  collectPhraseCrossReferences,
  createAutoCrossRefRenderer,
  renderDerivativeWordMarkup,
  renderMarkup,
  renderWordListMarkup,
  escapeHtml,
} from "../shared/markup.js";
import { VIEWER_API_BASE } from "../shared/config.js";
import { buildAlphabeticalIndexEntries } from "../shared/word-index.js";
import { formatPronunciationWithAccents } from "../shared/pronunciation.js";
import { cefrLevelClass, effectiveCefrLevel } from "../shared/learning-tags.js";
import { groupDerivativeSenses } from "../shared/derivatives.js";
import { attachPullToRefresh } from "../shared/pull-to-refresh.js";
import { playPronunciation } from "../shared/speech.js";
import {
  registerVocabWebMCP,
  registeredWebMCPTools,
  unregisterVocabWebMCP,
  webMCPSupported,
} from "./webmcp.js";
import { navigationSectionKeys, sectionNumberRanges, wordIdFromHash } from "./navigation.js";

const API = `${VIEWER_API_BASE}/api`;
const LAST_LIST_KEY = "vocab-viewer-last-list";
const THEME_KEY = "vocab-viewer-theme";
const FONT_SIZE_KEY = "vocab-viewer-font-size";
const CROSSOVER_LIST_ID = "crossover-v3";
const PAGE_PARAMS = new URLSearchParams(window.location.search);
const PRINT_BOOK_MODE = PAGE_PARAMS.get("print") === "book";
const PRINT_UI_MODE = PAGE_PARAMS.get("mode") === "print" || PRINT_BOOK_MODE;
const PRINT_PART = PAGE_PARAMS.get("part") || "front";
const PRINT_CHAPTER_KEY = PAGE_PARAMS.get("chapter");
const PAGED_JS_URL = "https://cdn.jsdelivr.net/npm/pagedjs@0.4.3/dist/paged.polyfill.min.js";
const PRINT_PAGE_SIZES = new Set(["a4", "b5", "a5"]);
const PRINT_PAGE_SIZE_LABELS = { a4: "A4", b5: "B5", a5: "A5" };
// 文字サイズ5段階（level -> --font-scale の倍率）。3が標準(等倍)。
const FONT_SCALES = { 1: 0.8, 2: 0.9, 3: 1, 4: 1.15, 5: 1.32 };

const BLANK_RE = /(＿{2,}|_{3,})/;

// リストを切り替えて戻った場合も再利用できる、ページ内の軽量キャッシュ。
// 永続的な鮮度確認はAPIのETagに任せ、プル更新時は明示的に破棄する。
const viewerIndexCache = new Map();
const sectionResponseCache = new Map();
let listLoadGeneration = 0;
let searchGeneration = 0;
let navigationGeneration = 0;
let lazyLoadGeneration = 0;
let navigationAnchorGroups = [];

const state = {
  lists: [],
  currentListId: null,
  indexWords: [],
  chapters: [],
  groups: [],
  sections: [],
  wordMetaById: new Map(),
  headwordIndex: new Map(),
  loadedSectionKeys: new Set(),
  sectionPromises: new Map(),
  wordIndex: new Map(), // spelling(lower) -> {id, no}
  renderNotesMarkup: null,
  search: "",
  searchMatches: null,
  indexRendered: false,
  activeView: "list", // "list" | "index" | front matter page
};

const el = {
  listSelect: document.getElementById("listSelect"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  settingsToggle: document.getElementById("settingsToggle"),
  settingsMenu: document.getElementById("settingsMenu"),
  menuToggle: document.getElementById("menuToggle"),
  contentsMenu: document.getElementById("contentsMenu"),
  contentsNav: document.getElementById("contentsNav"),
  bookNav: document.getElementById("bookNav"),
  bookTocNav: document.getElementById("bookTocNav"),
  bookDescription: document.getElementById("bookDescription"),
  bookTitleNodes: document.querySelectorAll("[data-book-title]"),
  viewPanels: document.querySelectorAll("[data-view-panel]"),
  printBookBtn: document.getElementById("printBookBtn"),
  printPartSelect: document.getElementById("printPartSelect"),
  printPageSize: document.getElementById("printPageSize"),
  printFontSize: document.getElementById("printFontSize"),
  printLineHeight: document.getElementById("printLineHeight"),
  printExampleColumns: document.getElementById("printExampleColumns"),
  printTocColumns: document.getElementById("printTocColumns"),
  printStatus: document.getElementById("printStatus"),
  printProgressOverlay: document.getElementById("printProgressOverlay"),
  printProgressLabel: document.getElementById("printProgressLabel"),
  printProgressPercent: document.getElementById("printProgressPercent"),
  printProgressBar: document.getElementById("printProgressBar"),
  searchInput: document.getElementById("searchInput"),
  sectionNav: document.getElementById("sectionNav"),
  jumpForm: document.getElementById("jumpForm"),
  jumpInput: document.getElementById("jumpInput"),
  wordList: document.getElementById("wordList"),
  indexList: document.getElementById("indexList"),
  viewTabList: document.getElementById("viewTabList"),
  viewTabIndex: document.getElementById("viewTabIndex"),
  emptyMsg: document.getElementById("emptyMsg"),
  loadingMsg: document.getElementById("loadingMsg"),
  loadingProgress: document.getElementById("loadingProgress"),
  backToTopBtn: document.getElementById("backToTopBtn"),
  toast: document.getElementById("toast"),
  fontSizeSteps: document.getElementById("fontSizeSteps"),
  ptrIndicator: document.getElementById("ptrIndicator"),
};

const LOADING_DELAY_MS = 250;

function boundedPrintSetting(rawValue, fallback, min, max) {
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function boundedIntegerPrintSetting(rawValue, fallback, min, max) {
  const value = Number(rawValue);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function normalizedPrintPageSize(rawValue) {
  return PRINT_PAGE_SIZES.has(rawValue) ? rawValue : "a4";
}

function applyPrintSettings() {
  const pageSize = normalizedPrintPageSize(el.printPageSize.value);
  const fontSize = boundedPrintSetting(el.printFontSize.value, 10, 8, 14);
  const lineHeight = boundedPrintSetting(el.printLineHeight.value, 1.5, 1.2, 2);
  const exampleColumns = boundedIntegerPrintSetting(el.printExampleColumns.value, 2, 1, 3);
  const tocColumns = boundedIntegerPrintSetting(el.printTocColumns.value, 1, 1, 2);
  document.documentElement.dataset.printPageSize = pageSize;
  document.body.dataset.printPageSize = pageSize;
  document.documentElement.style.setProperty("--print-font-size", `${fontSize}pt`);
  document.documentElement.style.setProperty("--print-line-height", String(lineHeight));
  document.documentElement.style.setProperty("--print-example-columns", String(exampleColumns));
  document.documentElement.style.setProperty("--print-toc-columns", String(tocColumns));
}

document.body.classList.toggle("is-print-mode", PRINT_UI_MODE);
el.printPageSize.value = normalizedPrintPageSize(PAGE_PARAMS.get("pageSize"));
el.printFontSize.value = String(boundedPrintSetting(PAGE_PARAMS.get("fontSize"), 10, 8, 14));
el.printLineHeight.value = String(boundedPrintSetting(PAGE_PARAMS.get("lineHeight"), 1.5, 1.2, 2));
el.printExampleColumns.value = String(boundedIntegerPrintSetting(PAGE_PARAMS.get("exampleColumns"), 2, 1, 3));
el.printTocColumns.value = String(boundedIntegerPrintSetting(PAGE_PARAMS.get("tocColumns"), 1, 1, 2));
el.printPageSize.addEventListener("change", applyPrintSettings);
el.printFontSize.addEventListener("change", applyPrintSettings);
el.printLineHeight.addEventListener("change", applyPrintSettings);
el.printExampleColumns.addEventListener("change", applyPrintSettings);
el.printTocColumns.addEventListener("change", applyPrintSettings);
applyPrintSettings();

let printProgressHideTimer;

function setPrintProgress(percent, label) {
  if (printProgressHideTimer) {
    clearTimeout(printProgressHideTimer);
    printProgressHideTimer = undefined;
  }
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  el.printProgressOverlay.hidden = false;
  el.printProgressLabel.textContent = label;
  el.printProgressPercent.textContent = `${value}%`;
  el.printProgressBar.value = value;
  el.printProgressBar.textContent = `${value}%`;
  if (el.printStatus?.isConnected) {
    el.printStatus.hidden = false;
    el.printStatus.textContent = `${label}（${value}%）`;
  }
}

function hidePrintProgress() {
  if (printProgressHideTimer) {
    clearTimeout(printProgressHideTimer);
    printProgressHideTimer = undefined;
  }
  el.printProgressOverlay.hidden = true;
}
let networkActivityDepth = 0;
let progressDelayTimer;
let progressFinishTimer;
let pageLoadingDepth = 0;
let pageLoadingTimer;

function renderLoadingSkeleton() {
  const skeletonList = el.loadingMsg.querySelector(".skeleton-list");
  if (!skeletonList || skeletonList.childElementCount) return;
  const entry = `
    <div class="skeleton-entry">
      <span class="skeleton-no skeleton-line"></span>
      <div class="skeleton-body">
        <span class="skeleton-headword skeleton-line"></span>
        <span class="skeleton-meaning skeleton-line"></span>
        <span class="skeleton-example skeleton-line"></span>
      </div>
    </div>`;
  skeletonList.innerHTML = entry.repeat(4);
}

function revealProgress() {
  if (networkActivityDepth === 0) return;
  el.loadingProgress.classList.remove("is-completing");
  el.loadingProgress.hidden = false;
}

function beginNetworkActivity() {
  networkActivityDepth += 1;
  if (networkActivityDepth > 1) return;
  clearTimeout(progressDelayTimer);
  clearTimeout(progressFinishTimer);
  if (!el.loadingProgress.hidden) {
    revealProgress();
    return;
  }
  progressDelayTimer = setTimeout(revealProgress, LOADING_DELAY_MS);
}

function endNetworkActivity() {
  networkActivityDepth = Math.max(0, networkActivityDepth - 1);
  if (networkActivityDepth > 0) return;
  clearTimeout(progressDelayTimer);
  if (el.loadingProgress.hidden) return;
  el.loadingProgress.classList.add("is-completing");
  progressFinishTimer = setTimeout(() => {
    if (networkActivityDepth > 0) return;
    el.loadingProgress.hidden = true;
    el.loadingProgress.classList.remove("is-completing");
  }, 180);
}

function revealPageLoading() {
  if (pageLoadingDepth === 0) return;
  el.loadingMsg.hidden = false;
  document.body.classList.add("is-loading");
}

function beginPageLoading() {
  pageLoadingDepth += 1;
  el.wordList.setAttribute("aria-busy", "true");
  if (pageLoadingDepth > 1) return;
  clearTimeout(pageLoadingTimer);
  pageLoadingTimer = setTimeout(revealPageLoading, LOADING_DELAY_MS);
}

function endPageLoading() {
  pageLoadingDepth = Math.max(0, pageLoadingDepth - 1);
  if (pageLoadingDepth > 0) return;
  clearTimeout(pageLoadingTimer);
  document.body.classList.remove("is-loading");
  el.loadingMsg.hidden = true;
  el.wordList.setAttribute("aria-busy", "false");
}

renderLoadingSkeleton();

async function api(path, { forceRefresh = false } = {}) {
  beginNetworkActivity();
  try {
    const res = await fetch(`${API}${path}`, { cache: forceRefresh ? "reload" : "default" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    endNetworkActivity();
  }
}

function resolveRef(headword) {
  const hit = state.wordIndex.get(headword.toLowerCase());
  if (!hit) return { found: false };
  return { found: true, id: hit.id, no: hit.no };
}

function resolveHeadwordRef(headword) {
  const hit = state.headwordIndex.get(headword.toLowerCase());
  if (!hit) return { found: false };
  return { found: true, id: hit.id, no: hit.no };
}

function renderRef(spelling) {
  const hit = resolveRef(spelling);
  if (!hit.found) return escapeHtml(spelling);
  return `<a href="#word-${escapeHtml(encodeURIComponent(hit.id))}" class="ref" data-word-id="${escapeHtml(hit.id)}">${escapeHtml(spelling)}</a>`;
}

// ---- リスト読み込み ----

async function loadLists() {
  const allLists = await api("/lists");
  // 「単語マスター（全語）」は単語帳を組み立てるための管理用リストなので、閲覧ページの対象からは除外する。
  state.lists = allLists.filter((l) => l.isNotebook !== false && l.id === CROSSOVER_LIST_ID);
  el.listSelect.innerHTML = "";
  for (const l of state.lists) {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.name;
    el.listSelect.appendChild(opt);
  }
  if (state.lists.length === 0) {
    el.loadingMsg.hidden = true;
    el.emptyMsg.hidden = false;
    return;
  }
  const initial = CROSSOVER_LIST_ID;
  el.listSelect.value = initial;
  await selectList(initial);
}

function clearListCaches(listId) {
  viewerIndexCache.delete(listId);
  const prefix = `${listId}:`;
  for (const key of sectionResponseCache.keys()) {
    if (key.startsWith(prefix)) sectionResponseCache.delete(key);
  }
}

async function selectList(listId, { forceRefresh = false } = {}) {
  beginPageLoading();
  const generation = ++listLoadGeneration;
  searchGeneration += 1;
  navigationGeneration += 1;
  lazyLoadGeneration += 1;
  clearNavigationAnchors();
  state.currentListId = listId;
  localStorage.setItem(LAST_LIST_KEY, listId);
  el.emptyMsg.hidden = true;
  if (sectionObserver) sectionObserver.disconnect();
  if (indexObserver) indexObserver.disconnect();
  if (lazySectionObserver) lazySectionObserver.disconnect();
  if (forceRefresh) clearListCaches(listId);
  try {
    let data = viewerIndexCache.get(listId);
    if (!data) {
      data = await api(`/lists/${encodeURIComponent(listId)}/viewer/index`, { forceRefresh });
      viewerIndexCache.set(listId, data);
    }
    if (generation !== listLoadGeneration) return;
    state.indexWords = data.words || [];
    state.chapters = data.chapters || [];
    state.groups = data.groups || [];
    state.sections = data.sections || [];
    state.loadedSectionKeys = new Set();
    state.sectionPromises = new Map();
    state.searchMatches = null;
    state.indexRendered = false;
    el.indexList.innerHTML = "";
    assignSequentialNumbers();
    buildIndex();
    renderBookMatter();
    renderSectionShells();
    renderContentsNav();
    if (PRINT_BOOK_MODE && PRINT_PART === "index") renderAlphabeticalIndex();
    renderActiveBottomNav();
    setupSectionObserver();
    setupIndexObserver();
    setupLazySectionObserver();
    el.emptyMsg.hidden = state.indexWords.length > 0;
    const firstSection = state.sections[0];
    if (firstSection) await loadSection(firstSection.key);
    if (generation !== listLoadGeneration) return;
    await applyHashScroll();
    if (el.searchInput.value.trim()) void runSearch();
  } catch (err) {
    if (generation !== listLoadGeneration) return;
    el.wordList.innerHTML = `<p class="empty-msg">読み込みに失敗しました: ${escapeHtml(err.message)}</p>`;
  } finally {
    endPageLoading();
  }
}

// 閲覧ページの番号は、保存された no ではなく「上から表示される順番」で毎回振り直す。
// これにより、単語帳での並び替えやマスターからの追加後も、常に 1,2,3,... と隙間なく連番になる。
// 派生語の枝番(例: 5-1, 5-2)は直前の見出し語の番号にぶら下げる。
// state.indexWords はサーバー側で「セクション順 → no → branch」に整列済みなので、この順で数えればよい。
function assignSequentialNumbers() {
  let top = 0;
  let branch = 0;
  for (const w of state.indexWords) {
    if (w.seqNo) {
      const [savedTop, savedBranch] = String(w.seqNo).split("-").map(Number);
      top = savedTop;
      branch = savedBranch || 0;
      continue;
    }
    if (w.branch > 0 && top > 0) {
      branch += 1;
      w.seqNo = `${top}-${branch}`;
    } else {
      top += 1;
      branch = 0;
      w.seqNo = String(top);
    }
  }
}

function buildIndex() {
  const headwordIndex = new Map();
  state.wordMetaById = new Map(state.indexWords.map((word) => [word.id, word]));

  // 同じスペルが複数の形で現れる場合も、独立した見出し語を優先する。
  for (const w of state.indexWords) {
    if (w.branch !== 0) continue;
    headwordIndex.set(w.spelling.toLowerCase(), { id: w.id, no: w.seqNo });
  }
  for (const w of state.indexWords) {
    const key = w.spelling.toLowerCase();
    if (headwordIndex.has(key)) continue;
    headwordIndex.set(key, { id: w.id, no: w.seqNo });
  }
  state.headwordIndex = headwordIndex;
  const derivativeReferences = collectDerivativeCrossReferences(state.indexWords);
  state.wordIndex = addDerivativeCrossReferenceAliases(headwordIndex, derivativeReferences);
  state.renderNotesMarkup = createAutoCrossRefRenderer(headwordIndex.keys(), {
    resolve: resolveRef,
    derivativeReferences,
    phraseReferences: collectPhraseCrossReferences(state.indexWords),
  });
}

// ---- レンダリング ----

function renderExampleHtml(ex) {
  let html = renderMarkup(ex.sentence || "", { resolve: resolveRef });
  if (ex.answer && BLANK_RE.test(html)) {
    html = html.replace(
      BLANK_RE,
      () =>
        `<button type="button" class="blank-toggle" data-action="toggle-blank" data-answer="${escapeHtml(ex.answer)}" data-state="answer">${escapeHtml(ex.answer)}</button>`
    );
  }
  return html;
}

function wordHaystack(w) {
  const parts = [
    w.spelling,
    w.pronunciation,
    ...(w.senses || []).map((s) => s.meaning),
    ...(w.derivatives || []).map((d) => `${d.word || ""} ${d.meaning || ""}`),
    ...(w.examples || []).map((e) => `${e.sentence || ""} ${e.translation || ""}`),
    w.irregularForms,
    w.etymology,
    w.synonyms,
    w.antonyms,
    w.relatedWords,
    w.notes,
  ];
  for (const [k, v] of Object.entries(w.tags || {})) parts.push(k, v);
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function renderEntry(w) {
  const isBranch = w.branch > 0;
  const haystack = wordHaystack(w);

  const familyLine =
    isBranch && w.derivedFromSpelling
      ? `<div class="family-block">▸ ${renderRef(w.derivedFromSpelling)} の派生語</div>`
      : "";

  // 見出しの意味(is_primary)が1つもない単語では、最初の意味を仮の見出しとして扱い
  // 一覧が全て同じ薄さになってしまわないようにする。
  const hasPrimarySense = (w.senses || []).some((s) => s.isPrimary);
  const sensesWithFlags = (w.senses || []).map((s, i) => ({
    ...s,
    _isPrimary: s.isPrimary || (!hasPrimarySense && i === 0),
  }));

  // 同じ品詞の意味は1行にまとめ、①②…の丸数字で並べる(初出の品詞順を維持)。
  const posGroups = [];
  const posGroupIndex = new Map();
  for (const s of sensesWithFlags) {
    const key = s.pos || "";
    if (!posGroupIndex.has(key)) {
      posGroupIndex.set(key, posGroups.length);
      posGroups.push({ pos: s.pos, items: [] });
    }
    posGroups[posGroupIndex.get(key)].items.push(s);
  }

  const sensesHtml = posGroups
    .map((group) => {
      // 見出しの意味は常に①として先頭に来るよう並べ替える
      const items = [...group.items].sort((a, b) => (a._isPrimary ? 0 : 1) - (b._isPrimary ? 0 : 1));
      const isPrimaryGroup = items.some((s) => s._isPrimary);
      const pron = items.find((s) => s.pronunciation)?.pronunciation;
      const meaningsHtml =
        items.length > 1
          ? `<span class="sense-items">${items
              .map(
                (s, index) =>
                  `<span class="sense-item${s._isPrimary ? " sense-item-primary" : ""}"><span class="sense-number">${index + 1}</span><span class="sense-meaning">${renderMarkup(s.meaning, { resolve: resolveRef })}</span></span>`
              )
              .join("")}</span>`
          : `<span class="sense-meaning">${renderMarkup(items[0].meaning, { resolve: resolveRef })}</span>`;
      return `
    <div class="sense-line${isPrimaryGroup ? " sense-primary" : ""}">
      ${group.pos ? `<span class="pos-badge">${escapeHtml(group.pos)}</span>` : ""}
      ${pron ? `<span class="pron sense-pron">${escapeHtml(formatPronunciationWithAccents(pron))}</span>` : ""}
      ${meaningsHtml}
    </div>`;
    })
    .join("");

  const examplesHtml = (w.examples || []).length
    ? `<div class="example-list">${(w.examples || [])
        .map(
          (ex) => `
        <div class="example-line">
          <span class="bullet${ex.type === "phrase" ? " hollow" : ""}">${ex.type === "phrase" ? "◇" : "◆"}</span>
          <span class="example-phrase">${renderExampleHtml(ex)}</span>
          ${ex.translation ? `<span class="example-translation">${renderMarkup(ex.translation, { resolve: resolveRef })}</span>` : ""}
        </div>`
        )
        .join("")}</div>`
    : "";

  const derivativeGroups = groupDerivativeSenses(w.derivatives || []);
  const derivativesHtml = derivativeGroups.length
    ? `<div class="notes-block notes-derivative"><span class="notes-label derivative-badge">派生語</span><span class="notes-content derivative-items">${derivativeGroups
        .map((group) => {
          const senses = group.senses
            .map(
              (sense) => `<span class="derivative-sense">${sense.pos ? `<span class="pos-badge derivative-pos">${escapeHtml(sense.pos)}</span>` : ""}${sense.meaning ? `<span class="derivative-meaning">${renderMarkup(sense.meaning, { resolve: resolveRef })}</span>` : ""}</span>`
            )
            .join("");
          return `<span class="derivative-item"><span class="derivative-word">${renderDerivativeWordMarkup(group.word, { resolve: resolveHeadwordRef })}</span>${senses}</span>`;
        })
        .join("")}</span></div>`
    : "";

  const irregularFormsHtml = w.irregularForms
    ? `<div class="notes-block notes-irregular"><span class="notes-label irregular-badge">不規則</span><span class="notes-content">${renderMarkup(w.irregularForms, { resolve: resolveRef })}</span></div>`
    : "";
  const etymologyHtml = w.etymology
    ? `<div class="notes-block notes-etymology"><span class="notes-label etymology-badge">語源</span><span class="notes-content">${renderMarkup(w.etymology, { resolve: resolveRef })}</span></div>`
    : "";
  const synonymsHtml = w.synonyms
    ? `<div class="notes-block notes-synonym"><span class="notes-label synonym-badge">類義語</span><span class="notes-content">${renderWordListMarkup(w.synonyms, { resolve: resolveRef })}</span></div>`
    : "";
  const antonymsHtml = w.antonyms
    ? `<div class="notes-block notes-antonym"><span class="notes-label antonym-badge">対義語</span><span class="notes-content">${renderWordListMarkup(w.antonyms, { resolve: resolveRef })}</span></div>`
    : "";
  const relatedWordsHtml = w.relatedWords
    ? `<div class="notes-block notes-related"><span class="notes-label related-badge">関連語</span><span class="notes-content">${renderWordListMarkup(w.relatedWords, { resolve: resolveRef })}</span></div>`
    : "";
  const notesHtml = w.notes
    ? `<div class="notes-block notes-memo"><span class="notes-label memo-badge">メモ</span><span class="notes-content">${state.renderNotesMarkup(w.notes, { currentHeadword: w.spelling })}</span></div>`
    : "";

  const cautionHtml = [
    w.ergative
      ? '<span class="caution-badge caution-ergative" title="自動詞の主語と他動詞の目的語が対応する能格動詞"><i class="fa-solid fa-right-left" aria-hidden="true"></i>能格</span>'
      : "",
    w.spellingCaution
      ? '<span class="caution-badge caution-spelling" title="スペルに注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>スペル</span>'
      : "",
    w.pronunciationCaution
      ? '<span class="caution-badge caution-pronunciation" title="発音に注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>発音</span>'
      : "",
    w.accentCaution
      ? '<span class="caution-badge caution-accent" title="アクセント位置に注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>アクセント</span>'
      : "",
    w.polysemousCaution
      ? '<span class="caution-badge caution-polysemous" title="複数の意味に注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>多義</span>'
      : "",
    w.conjugationCaution
      ? '<span class="caution-badge caution-conjugation" title="活用に注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>活用</span>'
      : "",
    w.usageCaution
      ? '<span class="caution-badge caution-usage" title="語法に注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>語法</span>'
      : "",
  ].join("");

  const cefrLevel = effectiveCefrLevel(w.tags);
  const cefrBadge = cefrLevel
    ? `<span class="learning-badge badge-cefr ${cefrLevelClass(cefrLevel)}" title="CEFR ${escapeHtml(cefrLevel)}">${escapeHtml(cefrLevel)}</span>`
    : "";
  const hasAwlTag = Object.prototype.hasOwnProperty.call(w.tags || {}, "awl");
  const awlSublist = String(w.tags?.awl || "").trim();
  const awlBadge = hasAwlTag
    ? `<span class="learning-badge badge-awl" title="Academic Word List${awlSublist ? ` Sublist ${escapeHtml(awlSublist)}` : ""}">AWL${awlSublist ? ` ${escapeHtml(awlSublist)}` : ""}</span>`
    : "";
  const generatedAudioUrl = w.generatedAudio?.url || "";

  return `
  <article class="entry${isBranch ? " branch-entry" : ""}" id="word-${escapeHtml(w.id)}" data-word-id="${escapeHtml(w.id)}" data-no="${escapeHtml(w.seqNo)}" data-haystack="${escapeHtml(haystack)}">
    <div class="entry-no" data-action="copy-link" data-word-id="${escapeHtml(w.id)}" title="リンクをコピー">${escapeHtml(w.seqNo)}</div>
    <div class="entry-body">
      <div class="entry-head">
        <span class="headword">${escapeHtml(w.spelling)}</span>
        ${w.pronunciation ? `<span class="pron">${escapeHtml(formatPronunciationWithAccents(w.pronunciation))}<button type="button" class="speak-btn" data-action="speak" data-text="${escapeHtml(w.spelling)}" data-audio-url="${escapeHtml(generatedAudioUrl)}" title="${generatedAudioUrl ? "登録済み音声で発音を聞く" : "端末の英語音声で発音を聞く"}"><i class="fa-solid fa-volume-high" aria-hidden="true"></i></button></span>` : ""}
        ${cefrBadge}
        ${awlBadge}
        ${cautionHtml}
      </div>
      ${familyLine}
      <div class="entry-card">
        ${sensesHtml}
        ${examplesHtml}
        ${derivativesHtml}
        ${irregularFormsHtml}
        ${synonymsHtml}
        ${antonymsHtml}
        ${relatedWordsHtml}
        ${etymologyHtml}
        ${notesHtml}
      </div>
    </div>
  </article>`;
}

function hasAnySection() {
  return state.sections.some((section) => section.id != null);
}

function hasAnyChapter() {
  return state.chapters.some((chapter) => chapter.id != null);
}

function hasAnyGroup() {
  return state.groups.some((group) => group.id != null);
}

function renderSectionShells() {
  const withSections = hasAnySection();
  const withChapters = hasAnyChapter();
  const withGroups = hasAnyGroup();
  const chapterByKey = new Map(state.chapters.map((chapter) => [String(chapter.key), chapter]));
  const groupByKey = new Map(state.groups.map((group) => [String(group.key), group]));
  let lastChapterKey;
  let lastGroupKey;
  const parts = [];
  for (const [sectionIndex, section] of state.sections.entries()) {
    const chapterKey = String(section.chapterKey);
    const chapter = chapterByKey.get(chapterKey);
    const chapterChanged = withChapters && chapterKey !== lastChapterKey;
    let chapterMarkup = "";
    if (chapterChanged) {
      lastChapterKey = chapterKey;
      lastGroupKey = undefined;
      const titleLine = `<span class="chapter-title">${escapeHtml(chapter?.name || "その他")}</span>${
        chapter?.subtitle ? `<span class="chapter-subtitle">${escapeHtml(chapter.subtitle)}</span>` : ""
      }<span class="chapter-count">(${chapter?.count || 0})</span>`;
      const descLine = chapter?.description ? `<div class="chapter-description">${escapeHtml(chapter.description)}</div>` : "";
      chapterMarkup = `<div class="chapter-divider" id="chapter-${escapeHtml(chapterKey)}" data-chapter-key="${escapeHtml(chapterKey)}"><div class="chapter-title-row">${titleLine}</div>${descLine}</div>`;
    }
    const groupKey = section.groupId != null ? String(section.groupKey) : null;
    const group = groupKey ? groupByKey.get(groupKey) : null;
    const groupChanged = withGroups && !!group && groupKey !== lastGroupKey;
    let groupMarkup = "";
    if (groupChanged) {
      const titleLine = `<span class="group-title">${escapeHtml(group.name)}</span>${
        group.subtitle ? `<span class="group-subtitle">${escapeHtml(group.subtitle)}</span>` : ""
      }<span class="group-count">(${group.count})</span>`;
      const descLine = group.description ? `<div class="group-description">${escapeHtml(group.description)}</div>` : "";
      groupMarkup = `<div class="group-divider" id="group-${escapeHtml(groupKey)}" data-group-key="${escapeHtml(groupKey)}"><div class="group-title-row">${titleLine}</div>${descLine}</div>`;
    }
    lastGroupKey = groupKey;
    const key = String(section.key);
    const titleLine = `<span class="section-title">${escapeHtml(section.name || "その他")}</span>${
      section.subtitle ? `<span class="section-subtitle">${escapeHtml(section.subtitle)}</span>` : ""
    }<span class="section-count">(${section.count})</span>`;
    const descLine = section.description ? `<div class="section-description">${escapeHtml(section.description)}</div>` : "";
    const divider = withSections
      ? `<div class="section-divider" id="section-${escapeHtml(key)}" data-section-key="${escapeHtml(key)}"><div class="section-title-row">${titleLine}</div>${descLine}</div>`
      : "";
    const sectionTone = withSections ? ` section-tone-${(sectionIndex % 6) + 1}` : "";
    const chapterClass = chapterMarkup ? " has-chapter-divider" : "";
    const groupClass = groupMarkup ? " has-group-divider" : "";
    const chapterFrameId = chapterMarkup ? ` id="chapter-frame-${escapeHtml(chapterKey)}"` : "";
    const labelledBy = withSections ? ` aria-labelledby="section-${escapeHtml(key)}"` : "";
    const placeholderHeight = Math.min(900, Math.max(160, section.count * 44));
    parts.push(
      `<section class="section-group${sectionTone}${chapterClass}${groupClass}"${chapterFrameId} data-section-key="${escapeHtml(key)}" data-chapter-key="${escapeHtml(chapterKey)}" data-group-key="${escapeHtml(groupKey || "none")}"${labelledBy}>${chapterMarkup}${groupMarkup}${divider}<div class="section-entries" data-section-entries="${escapeHtml(key)}" aria-busy="true" style="--section-placeholder-height:${placeholderHeight}px"><div class="section-loading"><span class="section-loading-label">${escapeHtml(section.name || "単語")}を読み込み中...</span><div class="section-loading-skeleton" aria-hidden="true"><span class="section-loading-no skeleton-line"></span><div class="section-loading-lines"><span class="section-loading-headword skeleton-line"></span><span class="section-loading-meaning skeleton-line"></span><span class="section-loading-example skeleton-line"></span></div></div></div></div></section>`
    );
  }
  parts.push('<p class="empty-msg search-empty" hidden>検索結果がありません。</p>');
  el.wordList.innerHTML = parts.join("");
  applyFilters();
}

function sectionCacheKey(listId, sectionKey) {
  return `${listId}:${sectionKey}`;
}

function renderSectionEntriesHtml(words, sectionKey) {
  const withLabels = state.indexWords.some((word) => word.labelId != null);
  const countByLabelKey = new Map();
  for (const word of words) {
    const labelKey = word.labelId != null ? String(word.labelId) : `none-${sectionKey}`;
    countByLabelKey.set(labelKey, (countByLabelKey.get(labelKey) || 0) + 1);
  }
  let lastLabelKey;
  const parts = [];
  for (const word of words) {
    const labelKey = word.labelId != null ? String(word.labelId) : `none-${sectionKey}`;
    if (withLabels && word.labelId != null && labelKey !== lastLabelKey) {
      parts.push(`<div class="label-divider" data-label-key="${escapeHtml(labelKey)}"><i class="fa-solid fa-tag" aria-hidden="true"></i><span class="label-title">${escapeHtml(word.labelName || "")}</span><span class="label-count">(${countByLabelKey.get(labelKey)})</span></div>`);
    }
    lastLabelKey = labelKey;
    parts.push(renderEntry(word));
  }
  return parts.join("");
}

function renderLoadedSection(sectionKey, data) {
  const entriesEl = el.wordList.querySelector(`[data-section-entries="${CSS.escape(String(sectionKey))}"]`);
  if (!entriesEl) return;
  const words = (data.words || []).map((word) => {
    const meta = state.wordMetaById.get(word.id);
    const hydrated = { ...word, seqNo: meta?.seqNo || word.displayNo || "" };
    return hydrated;
  });
  entriesEl.innerHTML = renderSectionEntriesHtml(words, sectionKey);
  entriesEl.removeAttribute("style");
  entriesEl.setAttribute("aria-busy", "false");
  entriesEl.closest(".section-group")?.classList.add("is-loaded");
  state.loadedSectionKeys.add(String(sectionKey));
  lazySectionObserver?.unobserve(entriesEl);
  applyFilters();
}

function renderSectionLoadError(sectionKey, message) {
  const entriesEl = el.wordList.querySelector(`[data-section-entries="${CSS.escape(String(sectionKey))}"]`);
  if (!entriesEl) return;
  entriesEl.innerHTML = `<div class="section-load-error">読み込みに失敗しました: ${escapeHtml(message)} <button type="button" data-action="retry-section" data-section-key="${escapeHtml(String(sectionKey))}">再試行</button></div>`;
  entriesEl.setAttribute("aria-busy", "false");
}

async function loadSection(sectionKey, { forceRefresh = false } = {}) {
  const key = String(sectionKey);
  if (!forceRefresh && state.loadedSectionKeys.has(key)) return;
  if (!forceRefresh && state.sectionPromises.has(key)) return state.sectionPromises.get(key);

  const listId = state.currentListId;
  const generation = listLoadGeneration;
  const cacheKey = sectionCacheKey(listId, key);
  const promise = (async () => {
    try {
      let data = forceRefresh ? null : sectionResponseCache.get(cacheKey);
      if (!data) {
        data = await api(
          `/lists/${encodeURIComponent(listId)}/viewer/sections/${encodeURIComponent(key)}`,
          { forceRefresh }
        );
        sectionResponseCache.set(cacheKey, data);
      }
      if (generation !== listLoadGeneration || listId !== state.currentListId) return;
      renderLoadedSection(key, data);
    } catch (err) {
      if (generation === listLoadGeneration && listId === state.currentListId) renderSectionLoadError(key, err.message);
      throw err;
    }
  })();
  state.sectionPromises.set(key, promise);
  try {
    await promise;
  } finally {
    if (state.sectionPromises.get(key) === promise) state.sectionPromises.delete(key);
  }
}

async function loadSectionsWithLimit(sectionKeys, concurrency = 3, shouldContinue = () => true) {
  const keys = [...new Set(sectionKeys.map(String))];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, keys.length) }, async () => {
    while (cursor < keys.length && shouldContinue()) {
      const key = keys[cursor];
      cursor += 1;
      await loadSection(key);
    }
  });
  await Promise.all(workers);
}

async function loadAllSectionsForPrint(sectionKeys, concurrency = 4, shouldContinue = () => true) {
  const keys = [...new Set(sectionKeys.map(String))];
  const failures = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, keys.length) }, async () => {
    while (cursor < keys.length && shouldContinue()) {
      const key = keys[cursor];
      cursor += 1;
      try {
        await loadSection(key);
      } catch (error) {
        failures.push({ key, error });
      }
    }
  });
  await Promise.all(workers);
  return failures;
}

let lazySectionObserver;

function setupLazySectionObserver() {
  if (lazySectionObserver) lazySectionObserver.disconnect();
  const generation = ++lazyLoadGeneration;
  const listId = state.currentListId;
  const shouldContinue = () => generation === lazyLoadGeneration && listId === state.currentListId;
  const entries = el.wordList.querySelectorAll(".section-entries");
  if (!entries.length) return;
  if (!("IntersectionObserver" in window)) {
    loadSectionsWithLimit(state.sections.map((section) => section.key), 3, shouldContinue).catch(() => {});
    return;
  }
  lazySectionObserver = new IntersectionObserver(
    (observed) => {
      const sectionKeys = [];
      for (const item of observed) {
        if (!item.isIntersecting) continue;
        lazySectionObserver.unobserve(item.target);
        sectionKeys.push(item.target.dataset.sectionEntries);
      }
      loadSectionsWithLimit(sectionKeys, 3, shouldContinue).catch(() => {});
    },
    { rootMargin: "1000px 0px" }
  );
  entries.forEach((entry) => lazySectionObserver.observe(entry));
}

// ---- 索引（abc順） ----

// state.indexWordsには見出し語(branch=0)と派生語エントリー(branch>0)しか並ばないため、
// 独立見出し語に加え、派生語・類義語・対義語から収録元の見出し語へ戻る参照も索引に含める。
// 参照語自身が独立見出し語として収録済みの場合は、独立見出し語を優先する。
function buildAlphabeticalIndex() {
  return buildAlphabeticalIndexEntries(state.indexWords);
}

function renderIndexEntryHtml(e) {
  const locTitle = e.isRef ? ` title="${escapeHtml(e.loc)}"` : "";
  return `
    <div class="index-entry${e.isRef ? " is-ref" : ""}" data-action="index-jump" data-word-id="${escapeHtml(e.targetId)}">
      <span class="index-word">${escapeHtml(e.spelling)}</span>
      <span class="index-loc"${locTitle}>${escapeHtml(e.loc)}</span>
    </div>`;
}

// 印刷時にa/bなど文字ごとに独立した段組みで区切れるよう、先頭文字でグループ化する
// (1つの巨大なcolumnsに流し込むと、同じ列内でa→bのように文字が混ざってしまうため)。
function groupIndexEntriesByLetter(entries) {
  const groups = [];
  let current = null;
  for (const e of entries) {
    const letter = (e.spelling[0] || "").toUpperCase();
    if (!current || current.letter !== letter) {
      current = { letter, items: [] };
      groups.push(current);
    }
    current.items.push(e);
  }
  return groups;
}

function renderAlphabeticalIndex() {
  const entries = buildAlphabeticalIndex();
  if (entries.length === 0) {
    el.indexList.innerHTML = '<p class="index-empty">単語がまだ登録されていません。</p>';
    state.indexRendered = true;
    return;
  }
  const groups = groupIndexEntriesByLetter(entries);
  el.indexList.innerHTML =
    '<h1 class="print-part-title">索引</h1>' +
    groups
      .map(
        (g, index) => `
    <div class="index-group" id="index-group-${index}" data-index-key="${index}">
      <h2 class="index-letter">${escapeHtml(g.letter)}</h2>
      <div class="index-columns">${g.items.map(renderIndexEntryHtml).join("")}</div>
    </div>`
      )
      .join("");
  state.indexRendered = true;
}

function setActiveView(view) {
  if (view === "index" && !state.indexRendered) renderAlphabeticalIndex();
  state.activeView = view;
  for (const panel of el.viewPanels) {
    const active = panel.dataset.viewPanel === view;
    panel.classList.toggle("is-active", active);
    panel.setAttribute("aria-hidden", String(!active));
  }
  el.viewTabList.setAttribute("aria-selected", String(view === "list"));
  el.viewTabIndex.setAttribute("aria-selected", String(view === "index"));
  el.bookNav.querySelectorAll("[data-book-view]").forEach((button) => {
    if (button.dataset.bookView === view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  renderActiveBottomNav();
  setupSectionObserver();
  setupIndexObserver();
}

el.viewTabList.addEventListener("click", () => setActiveView("list"));
el.viewTabIndex.addEventListener("click", () => setActiveView("index"));

el.indexList.addEventListener("click", async (e) => {
  const item = e.target.closest('[data-action="index-jump"]');
  if (!item) return;
  item.setAttribute("aria-busy", "true");
  try {
    await navigateToWord(item.dataset.wordId);
  } catch (err) {
    showToast(`リンク先の読み込みに失敗しました: ${err.message}`);
  } finally {
    item.removeAttribute("aria-busy");
  }
});

// ---- 下部ナビ（一覧ではSection、索引では頭文字） ----

let sectionObserver;
let indexObserver;

function setBottomNavContent(html, ariaLabel) {
  if (!html) {
    el.sectionNav.hidden = true;
    el.sectionNav.innerHTML = "";
    el.sectionNav.removeAttribute("aria-label");
    document.body.classList.remove("has-section-nav");
    return;
  }
  el.sectionNav.hidden = false;
  el.sectionNav.setAttribute("aria-label", ariaLabel);
  el.sectionNav.innerHTML = html;
  document.body.classList.add("has-section-nav");
}

function renderSectionNav() {
  const sections = state.sections.filter((section) => section.id != null);
  const html = sections
    .map((section) => `<button type="button" data-section-key="${escapeHtml(String(section.key))}">${escapeHtml(section.name)}</button>`)
    .join("");
  setBottomNavContent(html, "セクション");
}

function renderIndexNav() {
  const groups = [...el.indexList.querySelectorAll(".index-group")];
  const html = groups
    .map((group) => {
      const letter = group.querySelector(".index-letter")?.textContent || "";
      return `<button type="button" data-index-target="${escapeHtml(group.id)}" data-index-key="${escapeHtml(group.dataset.indexKey || "")}">${escapeHtml(letter)}</button>`;
    })
    .join("");
  setBottomNavContent(html, "索引の頭文字");
}

function renderActiveBottomNav() {
  if (state.activeView === "index") renderIndexNav();
  else if (state.activeView === "list") renderSectionNav();
  else setBottomNavContent("", "");
}

function renderBookMatter() {
  const currentList = state.lists.find((list) => list.id === state.currentListId);
  const title = currentList?.name || "単語帳";
  el.bookTitleNodes.forEach((node) => {
    node.textContent = title;
  });
  renderPrintPartOptions();
}

function renderPrintPartOptions() {
  const selected = el.printPartSelect.value || "front";
  const chapterOptions = state.chapters
    .map((chapter, index) => `<option value="chapter:${escapeHtml(String(chapter.key))}">Chapter ${index + 1}　${escapeHtml(chapter.name)}</option>`)
    .join("");
  el.printPartSelect.innerHTML =
    '<option value="front">前付け</option>' +
    '<option value="toc">目次（ページ番号なし）</option>' +
    chapterOptions +
    '<option value="index">索引</option>' +
    '<option value="all">全体（軽量・目次ページ番号なし）</option>' +
    '<option value="all-paged">全体（版組・目次ページ番号あり）</option>';
  if ([...el.printPartSelect.options].some((option) => option.value === selected)) {
    el.printPartSelect.value = selected;
  }
}

function renderContentsNav() {
  const withChapters = hasAnyChapter();
  const withSections = hasAnySection();
  if (!withChapters && !withSections) {
    const emptyHtml = '<p class="contents-empty">チャプター・セクションはありません。</p>';
    el.contentsNav.innerHTML = emptyHtml;
    el.bookTocNav.innerHTML = emptyHtml;
    return;
  }

  const numberRanges = sectionNumberRanges(state.indexWords);
  const renderItems = (forPrintToc = false) => state.chapters
    .map((chapter) => {
      const chapterTarget = withSections ? `chapter-frame-${chapter.key}` : `chapter-${chapter.key}`;
      const chapterSections = state.sections.filter(
        (section) => withSections && String(section.chapterKey) === String(chapter.key)
      );
      const firstSectionKey = chapterSections[0]?.key;
      const chapterSectionData =
        firstSectionKey != null ? ` data-nav-section-key="${escapeHtml(String(firstSectionKey))}"` : "";
      const chapterButton = withChapters
        ? forPrintToc
          ? `<a class="contents-chapter book-toc-link" href="#${escapeHtml(chapterTarget)}">
            <span class="contents-item-text"><span class="contents-item-name">${escapeHtml(chapter.name)}</span>${
              chapter.subtitle ? `<span class="contents-item-subtitle">${escapeHtml(chapter.subtitle)}</span>` : ""
            }</span><span class="book-toc-page-no" aria-label="掲載ページ"></span></a>`
          : `<button type="button" class="contents-chapter" data-nav-target="${escapeHtml(chapterTarget)}"${chapterSectionData}>
            <span class="contents-item-text"><span class="contents-item-name">${escapeHtml(chapter.name)}</span>${
              chapter.subtitle ? `<span class="contents-item-subtitle">${escapeHtml(chapter.subtitle)}</span>` : ""
            }</span>
            <span class="contents-item-count">(${chapter.count})</span>
          </button>`
        : "";
      const groupByKey = new Map(
        state.groups
          .filter((group) => String(group.chapterKey) === String(chapter.key))
          .map((group) => [String(group.key), group])
      );
      let previousGroupKey = null;
      const sectionParts = [];
      for (const section of chapterSections) {
        const numberRange = numberRanges.get(String(section.key));
        const numberRangeText = numberRange ? `${numberRange.first}-${numberRange.last}` : String(section.count);
        const groupKey = section.groupId != null ? String(section.groupKey) : null;
        const group = groupKey ? groupByKey.get(groupKey) : null;
        if (group && groupKey !== previousGroupKey) {
          sectionParts.push(
            forPrintToc
              ? `<a class="contents-subgroup book-toc-link" href="#group-${escapeHtml(group.key)}"><span class="contents-item-text"><span class="contents-item-name">${escapeHtml(group.name)}</span>${
                  group.subtitle ? `<span class="contents-item-subtitle">${escapeHtml(group.subtitle)}</span>` : ""
                }</span><span class="book-toc-page-no" aria-label="掲載ページ"></span></a>`
              : `<button type="button" class="contents-subgroup" data-nav-target="group-${escapeHtml(group.key)}" data-nav-section-key="${escapeHtml(String(section.key))}">
              <span class="contents-item-text"><span class="contents-item-name">${escapeHtml(group.name)}</span>${
                group.subtitle ? `<span class="contents-item-subtitle">${escapeHtml(group.subtitle)}</span>` : ""
              }</span>
              <span class="contents-item-count">(${group.count})</span>
            </button>`
          );
        }
        previousGroupKey = groupKey;
        sectionParts.push(
          forPrintToc
            ? `<a class="contents-section book-toc-link${withChapters ? " is-nested" : ""}${group ? " is-grouped" : ""}" href="#section-${escapeHtml(section.key)}"><span class="contents-item-text"><span class="contents-item-name">${escapeHtml(section.name)}</span>${
                section.subtitle ? `<span class="contents-item-subtitle">${escapeHtml(section.subtitle)}</span>` : ""
              }</span><span class="book-toc-page-no" aria-label="掲載ページ"></span></a>`
            : `<button type="button" class="contents-section${withChapters ? " is-nested" : ""}${group ? " is-grouped" : ""}" data-nav-target="section-${escapeHtml(section.key)}" data-nav-section-key="${escapeHtml(String(section.key))}">
            <span class="contents-item-text"><span class="contents-item-name">${escapeHtml(section.name)}</span>${
              section.subtitle ? `<span class="contents-item-subtitle">${escapeHtml(section.subtitle)}</span>` : ""
            }</span>
            <span class="contents-item-count" title="登録ナンバー">(${escapeHtml(numberRangeText)})</span>
          </button>`
        );
      }
      const sections = sectionParts.join("");
      return `<div class="contents-group">${chapterButton}${sections}</div>`;
    })
    .join("");
  el.contentsNav.innerHTML = renderItems(false);
  el.bookTocNav.innerHTML = renderItems(true);
}

function setupSectionObserver() {
  if (sectionObserver) sectionObserver.disconnect();
  if (state.activeView !== "list") return;
  const dividers = el.wordList.querySelectorAll(".section-divider");
  if (!dividers.length) return;
  sectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const key = entry.target.dataset.sectionKey;
        el.sectionNav.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.sectionKey === key));
      }
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  dividers.forEach((d) => sectionObserver.observe(d));
}

function setupIndexObserver() {
  if (indexObserver) indexObserver.disconnect();
  if (state.activeView !== "index") return;
  const groups = el.indexList.querySelectorAll(".index-group");
  if (!groups.length) return;
  indexObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const key = entry.target.dataset.indexKey;
        el.sectionNav.querySelectorAll("button").forEach((button) => {
          button.classList.toggle("active", button.dataset.indexKey === key);
        });
      }
    },
    { rootMargin: "-20% 0px -70% 0px" }
  );
  groups.forEach((group) => indexObserver.observe(group));
}

el.sectionNav.addEventListener("click", async (e) => {
  const indexBtn = e.target.closest("button[data-index-target]");
  if (indexBtn) {
    const target = document.getElementById(indexBtn.dataset.indexTarget);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const btn = e.target.closest("button[data-section-key]");
  if (!btn) return;
  btn.setAttribute("aria-busy", "true");
  try {
    await navigateToSection(btn.dataset.sectionKey, `section-${btn.dataset.sectionKey}`);
  } catch (err) {
    showToast(`リンク先の読み込みに失敗しました: ${err.message}`);
  } finally {
    btn.removeAttribute("aria-busy");
  }
});

// ---- 検索・進捗フィルタ ----

function applyFilters() {
  const q = state.search.trim().toLowerCase();
  const entries = el.wordList.querySelectorAll(".entry");
  entries.forEach((entry) => {
    const haystack = entry.dataset.haystack || "";
    const matches = state.searchMatches ? state.searchMatches.has(entry.dataset.wordId) : haystack.includes(q);
    entry.hidden = !!q && !matches;
  });

  const sectionGroups = [...el.wordList.querySelectorAll(".section-group")];
  if (!q) {
    for (const group of sectionGroups) group.hidden = false;
    el.wordList.querySelectorAll(".chapter-divider, .group-divider, .section-divider, .label-divider").forEach((divider) => {
      divider.hidden = false;
    });
    const searchEmpty = el.wordList.querySelector(".search-empty");
    if (searchEmpty) searchEmpty.hidden = true;
    return;
  }

  const groupHasVisibleEntry = new Map();
  for (const group of sectionGroups) {
    const entriesContainer = group.querySelector(":scope > .section-entries");
    const groupChildren = entriesContainer ? [...entriesContainer.children] : [];
    const hasVisibleEntry = groupChildren.some((child) => child.classList.contains("entry") && !child.hidden);
    groupHasVisibleEntry.set(group, hasVisibleEntry);
    const sectionDivider = group.querySelector(":scope > .section-divider");
    if (sectionDivider) sectionDivider.hidden = !hasVisibleEntry;

    for (let i = 0; i < groupChildren.length; i += 1) {
      const labelDivider = groupChildren[i];
      if (!labelDivider.classList.contains("label-divider")) continue;
      let labelHasVisibleEntry = false;
      for (let j = i + 1; j < groupChildren.length; j += 1) {
        const next = groupChildren[j];
        if (next.classList.contains("label-divider")) break;
        if (next.classList.contains("entry") && !next.hidden) {
          labelHasVisibleEntry = true;
          break;
        }
      }
      labelDivider.hidden = !labelHasVisibleEntry;
    }
  }

  const visibleChapterKeys = new Set(
    sectionGroups
      .filter((group) => groupHasVisibleEntry.get(group))
      .map((group) => group.dataset.chapterKey)
  );
  const visibleGroupKeys = new Set(
    sectionGroups
      .filter((group) => groupHasVisibleEntry.get(group) && group.dataset.groupKey !== "none")
      .map((group) => group.dataset.groupKey)
  );
  for (const group of sectionGroups) {
    const chapterDivider = group.querySelector(":scope > .chapter-divider");
    if (chapterDivider) chapterDivider.hidden = !visibleChapterKeys.has(group.dataset.chapterKey);
    const groupDivider = group.querySelector(":scope > .group-divider");
    if (groupDivider) groupDivider.hidden = !visibleGroupKeys.has(group.dataset.groupKey);
    group.hidden =
      !groupHasVisibleEntry.get(group) &&
      (!chapterDivider || chapterDivider.hidden) &&
      (!groupDivider || groupDivider.hidden);
  }
  const searchEmpty = el.wordList.querySelector(".search-empty");
  if (searchEmpty) searchEmpty.hidden = sectionGroups.some((group) => !group.hidden);
}

// ---- 発音 / リンクコピー / 空所トグル ----

function speak(text, audioUrl, btn) {
  playPronunciation(text, {
    audioUrl,
    button: btn,
    onUnsupported: () => showToast("この端末は音声読み上げに対応していません"),
  });
}

async function copyLink(id) {
  const url = `${location.origin}${location.pathname}#word-${encodeURIComponent(id)}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("リンクをコピーしました");
  } catch {
    showToast(url);
  }
}

function toggleBlank(btn) {
  const showingAnswer = btn.dataset.state === "answer";
  btn.dataset.state = showingAnswer ? "blank" : "answer";
  btn.textContent = showingAnswer ? "＿＿＿" : btn.dataset.answer;
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

function flash(target) {
  target.classList.remove("flash");
  void target.offsetWidth;
  target.classList.add("flash");
}

function clearSearchForNavigation() {
  if (!state.search && !state.searchMatches && !el.searchInput.value) return;
  searchGeneration += 1;
  state.search = "";
  state.searchMatches = null;
  el.searchInput.value = "";
  el.searchInput.removeAttribute("aria-busy");
  applyFilters();
}

function clearNavigationAnchors() {
  for (const group of navigationAnchorGroups) group.classList.remove("is-navigation-anchor");
  navigationAnchorGroups = [];
}

function setNavigationAnchors(sectionKeys) {
  clearNavigationAnchors();
  navigationAnchorGroups = sectionKeys
    .map((key) => el.wordList.querySelector(`.section-group[data-section-key="${CSS.escape(String(key))}"]`))
    .filter(Boolean);
  for (const group of navigationAnchorGroups) group.classList.add("is-navigation-anchor");
}

function waitForNavigationLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function prepareNavigationSection(sectionKey, generation) {
  const targetKey = String(sectionKey);
  const sectionKeys = navigationSectionKeys(state.sections, targetKey, window.innerHeight / 2);
  const sectionIndexByKey = new Map(state.sections.map((section, index) => [String(section.key), index]));
  const targetIndex = sectionIndexByKey.get(targetKey) ?? -1;
  lazyLoadGeneration += 1;
  lazySectionObserver?.disconnect();
  const pendingLoads = [...state.sectionPromises.entries()]
    .filter(([key]) => (sectionIndexByKey.get(String(key)) ?? Number.POSITIVE_INFINITY) <= targetIndex)
    .map(([, promise]) => promise);
  const targetPromise = loadSection(targetKey);
  const adjacentPromises = sectionKeys.filter((key) => key !== targetKey).map((key) => loadSection(key));
  const results = await Promise.allSettled([targetPromise, ...adjacentPromises, ...pendingLoads]);
  const failedLoad = results.find((result) => result.status === "rejected");
  if (failedLoad) {
    if (generation === navigationGeneration) {
      clearNavigationAnchors();
      setupLazySectionObserver();
    }
    throw failedLoad.reason;
  }
  if (generation !== navigationGeneration) return false;

  // 監視余白に入り得る直前側のセクションも実寸でレイアウトしておく。未読込プレースホルダーが移動後に
  // 展開され、目的位置を下へ押し流す現象を防ぐ。
  setNavigationAnchors(sectionKeys);
  await waitForNavigationLayout();
  return generation === navigationGeneration;
}

async function scrollToNavigationTarget(target, { block = "start", flashTarget = false, generation } = {}) {
  if (generation !== navigationGeneration) return false;
  if (!target) {
    clearNavigationAnchors();
    setupLazySectionObserver();
    return false;
  }
  await waitForNavigationLayout();
  if (generation !== navigationGeneration) return false;
  target.scrollIntoView({ behavior: "auto", block });

  // content-visibilityの再計算後にも同じ要素へ合わせ、推定高によるずれを残さない。
  await waitForNavigationLayout();
  if (generation !== navigationGeneration) return false;
  target.scrollIntoView({ behavior: "auto", block });

  // 実寸を記憶させた後は通常のcontent-visibilityへ戻し、その状態で最終位置を合わせる。
  clearNavigationAnchors();
  await waitForNavigationLayout();
  if (generation !== navigationGeneration) return false;
  target.scrollIntoView({ behavior: "auto", block });
  if (flashTarget) flash(target);
  setupLazySectionObserver();
  return true;
}

async function navigateToSection(sectionKey, targetId) {
  const generation = ++navigationGeneration;
  if (state.activeView !== "list") setActiveView("list");
  clearSearchForNavigation();
  if (sectionKey != null && !(await prepareNavigationSection(sectionKey, generation))) return false;
  if (sectionKey == null) await waitForNavigationLayout();
  const target = document.getElementById(targetId);
  return scrollToNavigationTarget(target, { block: "start", flashTarget: true, generation });
}

async function navigateToWord(id, { historyMode = "push" } = {}) {
  const normalizedId = String(id);
  const meta = state.wordMetaById.get(normalizedId);
  if (!meta) return false;
  const generation = ++navigationGeneration;
  if (state.activeView !== "list") setActiveView("list");
  clearSearchForNavigation();
  if (!(await prepareNavigationSection(meta.sectionKey, generation))) return false;
  const target = document.getElementById(`word-${normalizedId}`);
  if (!target) {
    clearNavigationAnchors();
    setupLazySectionObserver();
    return false;
  }
  if (historyMode === "push") history.pushState(null, "", `#word-${encodeURIComponent(normalizedId)}`);
  const scrolled = await scrollToNavigationTarget(target, { block: "center", flashTarget: true, generation });
  if (!scrolled) return false;
  return true;
}

async function openWordFromWebMCP(listId, wordId) {
  const normalizedWordId = String(wordId);
  if (state.currentListId !== listId) {
    const notebookExists = state.lists.some((list) => list.id === listId);
    if (!notebookExists) throw new Error("指定された単語帳が見つかりません。");
    el.listSelect.value = listId;
    await selectList(listId);
  }
  if (!state.wordMetaById.has(normalizedWordId)) throw new Error("指定された単語が見つかりません。");
  await navigateToWord(normalizedWordId);
}

async function applyHashScroll({ cancelOnMissing = false } = {}) {
  const id = wordIdFromHash(location.hash);
  if (!id || !state.wordMetaById.has(id)) {
    if (cancelOnMissing) {
      navigationGeneration += 1;
      clearNavigationAnchors();
      setupLazySectionObserver();
    }
    return;
  }
  try {
    await navigateToWord(id, { historyMode: "none" });
  } catch (err) {
    showToast(`リンク先の読み込みに失敗しました: ${err.message}`);
  }
}

// ---- 設定メニュー / チャプター・セクション一覧 ----

function closeSettingsMenu() {
  el.settingsMenu.classList.remove("is-open");
  el.settingsToggle.setAttribute("aria-expanded", "false");
  el.settingsToggle.setAttribute("aria-label", "設定を開く");
}

function closeContentsMenu() {
  el.contentsMenu.classList.remove("is-open");
  el.menuToggle.setAttribute("aria-expanded", "false");
  el.menuToggle.setAttribute("aria-label", "本書のメニューを開く");
}

function toggleSettingsMenu() {
  const open = !el.settingsMenu.classList.contains("is-open");
  closeContentsMenu();
  el.settingsMenu.classList.toggle("is-open", open);
  el.settingsToggle.setAttribute("aria-expanded", String(open));
  el.settingsToggle.setAttribute("aria-label", open ? "設定を閉じる" : "設定を開く");
}

function toggleContentsMenu() {
  const open = !el.contentsMenu.classList.contains("is-open");
  closeSettingsMenu();
  el.contentsMenu.classList.toggle("is-open", open);
  el.menuToggle.setAttribute("aria-expanded", String(open));
  el.menuToggle.setAttribute("aria-label", open ? "本書のメニューを閉じる" : "本書のメニューを開く");
}

// ---- イベント委譲 ----

el.wordList.addEventListener("click", (e) => {
  const refLink = e.target.closest("a.ref");
  if (refLink) {
    e.preventDefault();
    navigateToWord(refLink.dataset.wordId).catch((err) => {
      showToast(`リンク先の読み込みに失敗しました: ${err.message}`);
    });
    return;
  }
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === "speak") speak(actionEl.dataset.text, actionEl.dataset.audioUrl, actionEl);
  else if (action === "copy-link") copyLink(actionEl.dataset.wordId);
  else if (action === "toggle-blank") toggleBlank(actionEl);
  else if (action === "retry-section") loadSection(actionEl.dataset.sectionKey, { forceRefresh: true }).catch(() => {});
});

let searchTimer;
el.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 250);
});

async function runSearch() {
  const query = el.searchInput.value.trim();
  const generation = ++searchGeneration;
  state.search = query;
  if (!query) {
    state.searchMatches = null;
    el.searchInput.removeAttribute("aria-busy");
    applyFilters();
    return;
  }

  const listId = state.currentListId;
  el.searchInput.setAttribute("aria-busy", "true");
  try {
    const data = await api(`/lists/${encodeURIComponent(listId)}/viewer/search?q=${encodeURIComponent(query)}`);
    if (generation !== searchGeneration || listId !== state.currentListId) return;
    await loadSectionsWithLimit(
      (data.matches || []).map((match) => match.sectionKey),
      3,
      () => generation === searchGeneration && listId === state.currentListId
    );
    if (generation !== searchGeneration || listId !== state.currentListId) return;
    state.searchMatches = new Set((data.matches || []).map((match) => match.wordId));
    applyFilters();
  } catch (err) {
    if (generation === searchGeneration) showToast(`検索に失敗しました: ${err.message}`);
  } finally {
    if (generation === searchGeneration) el.searchInput.removeAttribute("aria-busy");
  }
}

el.listSelect.addEventListener("change", (e) => selectList(e.target.value));

el.jumpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = el.jumpInput.value.trim();
  if (!raw) return;
  const targetWord =
    state.indexWords.find((word) => String(word.seqNo) === raw) ||
    state.indexWords.find((word) => String(word.seqNo).startsWith(`${raw}-`));
  if (!targetWord) {
    showToast(`no.${raw} は見つかりませんでした`);
    return;
  }
  closeSettingsMenu();
  try {
    await navigateToWord(targetWord.id);
  } catch (err) {
    showToast(`リンク先の読み込みに失敗しました: ${err.message}`);
  }
});

el.settingsToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSettingsMenu();
});
el.menuToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleContentsMenu();
});
async function handleContentsNavigation(e) {
  const btn = e.target.closest("button[data-nav-target]");
  if (!btn) return;
  btn.setAttribute("aria-busy", "true");
  try {
    const moved = await navigateToSection(btn.dataset.navSectionKey ?? null, btn.dataset.navTarget);
    if (moved) closeContentsMenu();
  } catch (err) {
    showToast(`リンク先の読み込みに失敗しました: ${err.message}`);
  } finally {
    btn.removeAttribute("aria-busy");
  }
}

el.contentsNav.addEventListener("click", handleContentsNavigation);
el.bookTocNav.addEventListener("click", handleContentsNavigation);

el.bookNav.addEventListener("click", (e) => {
  const button = e.target.closest("[data-book-view]");
  if (!button) return;
  setActiveView(button.dataset.bookView);
  closeContentsMenu();
  window.scrollTo({ top: 0, behavior: "auto" });
});
window.addEventListener("hashchange", () => {
  applyHashScroll({ cancelOnMissing: true }).catch(() => {});
});
document.addEventListener("click", (e) => {
  if (el.settingsMenu.contains(e.target) || el.settingsToggle.contains(e.target)) return;
  if (el.contentsMenu.contains(e.target) || el.menuToggle.contains(e.target)) return;
  closeSettingsMenu();
  closeContentsMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeSettingsMenu();
  closeContentsMenu();
});

window.addEventListener(
  "scroll",
  () => {
    el.backToTopBtn.hidden = window.scrollY < 400;
  },
  { passive: true }
);
el.backToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));


// ---- 本全体の印刷 ----

function waitForPrintLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

let bookPrintInProgress = false;

function openDedicatedPrintView() {
  const url = new URL(window.location.href);
  const selected = el.printPartSelect.value || "front";
  if (
    selected === "all-paged" &&
    !window.confirm("全体の版組には長い時間がかかり、端末のメモリを多く使用します。続けますか？")
  ) return;
  url.searchParams.set("list", state.currentListId);
  url.searchParams.set("mode", "print");
  url.searchParams.set("print", "book");
  url.searchParams.set("pageSize", el.printPageSize.value);
  url.searchParams.set("fontSize", el.printFontSize.value);
  url.searchParams.set("lineHeight", el.printLineHeight.value);
  url.searchParams.set("exampleColumns", el.printExampleColumns.value);
  url.searchParams.set("tocColumns", el.printTocColumns.value);
  if (selected.startsWith("chapter:")) {
    url.searchParams.set("part", "chapter");
    url.searchParams.set("chapter", selected.slice("chapter:".length));
  } else {
    url.searchParams.set("part", selected);
    url.searchParams.delete("chapter");
  }
  window.open(url, "_blank", "noopener");
}

function loadPagedJs() {
  if (window.PagedPolyfill?.preview) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.PagedConfig = { auto: false };
    const script = document.createElement("script");
    script.src = PAGED_JS_URL;
    script.onload = resolve;
    script.onerror = () => reject(new Error("ページ組版ライブラリを読み込めませんでした。"));
    document.head.appendChild(script);
  });
}

function registerPagedProgressHandler(sectionKeys) {
  if (!window.Paged?.Handler || !window.Paged?.registerHandlers) return false;
  const sectionIndexByKey = new Map(sectionKeys.map((key, index) => [String(key), index]));
  const totalSections = sectionKeys.length;
  const pageSizeLabel = PRINT_PAGE_SIZE_LABELS[normalizedPrintPageSize(el.printPageSize.value)];
  let renderedPages = 0;
  let highestSectionIndex = -1;
  let highestReportedPercent = 48;

  class PrintProgressHandler extends window.Paged.Handler {
    afterPageLayout(pageElement) {
      renderedPages += 1;
      const sectionNodes = pageElement?.querySelectorAll?.(".section-group[data-section-key]") || [];
      for (const sectionNode of sectionNodes) {
        const index = sectionIndexByKey.get(String(sectionNode.dataset.sectionKey));
        if (index != null) highestSectionIndex = Math.max(highestSectionIndex, index);
      }

      const calculatedPercent = totalSections && highestSectionIndex >= 0
        ? 50 + ((highestSectionIndex + 1) / totalSections) * 44
        : Math.min(90, 45 + renderedPages * 3);
      highestReportedPercent = Math.max(highestReportedPercent, calculatedPercent);
      setPrintProgress(highestReportedPercent, `ページを組版中（${pageSizeLabel}・${renderedPages}ページ）`);
    }

    afterRendered(flow) {
      const totalPages = Number(flow?.total) || renderedPages;
      setPrintProgress(96, `版組完了（${pageSizeLabel}・${totalPages}ページ）`);
    }
  }

  window.Paged.registerHandlers(PrintProgressHandler);
  return true;
}

function printSectionKeys() {
  if (PRINT_PART === "all" || PRINT_PART === "all-paged") {
    return state.sections.map((section) => String(section.key));
  }
  if (PRINT_PART !== "chapter" || PRINT_CHAPTER_KEY == null) return [];
  return state.sections
    .filter((section) => String(section.chapterKey) === String(PRINT_CHAPTER_KEY))
    .map((section) => String(section.key));
}

function printPartLabel() {
  if (PRINT_PART === "all") return "全体";
  if (PRINT_PART === "all-paged") return "全体（版組）";
  if (PRINT_PART === "front") return "前付け";
  if (PRINT_PART === "toc") return "目次";
  if (PRINT_PART === "index") return "索引";
  const chapterIndex = state.chapters.findIndex((chapter) => String(chapter.key) === String(PRINT_CHAPTER_KEY));
  const chapter = state.chapters[chapterIndex];
  return chapter ? `Chapter ${chapterIndex + 1} ${chapter.name}` : "Chapter";
}

function prepareLightweightPrintDom() {
  document.body.dataset.printPart = PRINT_PART;
  if (["index", "all", "all-paged"].includes(PRINT_PART) && !state.indexRendered) renderAlphabeticalIndex();

  const keepIds = {
    front: new Set(["bookIntroduction", "bookStructure", "bookBadges", "bookAppGuide"]),
    toc: new Set(["bookToc"]),
    chapter: new Set(["wordList"]),
    index: new Set(["indexList"]),
    all: new Set(["bookIntroduction", "bookStructure", "bookBadges", "bookAppGuide", "bookToc", "wordList", "indexList"]),
    "all-paged": new Set(["bookIntroduction", "bookStructure", "bookBadges", "bookAppGuide", "bookToc", "wordList", "indexList"]),
  }[PRINT_PART] || new Set(["wordList"]);

  for (const panel of [...document.querySelectorAll("body > .view-panel")]) {
    if (!keepIds.has(panel.id)) panel.remove();
  }
  if (PRINT_PART === "chapter") {
    for (const group of [...el.wordList.querySelectorAll(".section-group")]) {
      if (String(group.dataset.chapterKey) !== String(PRINT_CHAPTER_KEY)) group.remove();
    }
  }
  document.querySelectorAll("[data-haystack]").forEach((node) => node.removeAttribute("data-haystack"));
  document.querySelectorAll(".speak-btn, .copy-link-btn, .blank-toggle").forEach((node) => {
    if (node.classList.contains("blank-toggle")) node.replaceWith(document.createTextNode(node.textContent || ""));
    else node.remove();
  });
  document.querySelectorAll(".topbar, .subbar, .section-nav, .back-to-top, .toast, .loading-progress, .loading-msg, .empty-msg, .ptr-indicator").forEach((node) => node.remove());
}

async function printWholeBook() {
  if (bookPrintInProgress || !state.currentListId) return;
  if (!PRINT_BOOK_MODE) {
    openDedicatedPrintView();
    return;
  }
  bookPrintInProgress = true;
  const listId = state.currentListId;
  const generation = listLoadGeneration;
  const sectionKeys = printSectionKeys();
  if (PRINT_PART === "chapter" && sectionKeys.length === 0) {
    showToast("対象Chapterが見つかりませんでした。");
    bookPrintInProgress = false;
    return;
  }
  setPrintProgress(1, "印刷準備を開始");
  const savedSearch = {
    query: state.search,
    matches: state.searchMatches,
    input: el.searchInput.value,
  };
  let printPrepared = false;
  let printFailed = false;
  el.printBookBtn.disabled = true;
  el.printBookBtn.setAttribute("aria-busy", "true");
  setPrintProgress(5, sectionKeys.length
    ? `印刷用データを読み込み中（0 / ${sectionKeys.length}）`
    : `${printPartLabel()}を準備中`);
  lazySectionObserver?.disconnect();

  try {
    const failures = await loadAllSectionsForPrint(sectionKeys, 4, () => {
      const active = generation === listLoadGeneration && listId === state.currentListId;
      if (active) {
        const loaded = sectionKeys.filter((key) => state.loadedSectionKeys.has(key)).length;
        const percent = 5 + (loaded / sectionKeys.length) * 35;
        setPrintProgress(percent, `印刷用データを読み込み中（${loaded} / ${sectionKeys.length}）`);
      }
      return active;
    });
    if (generation !== listLoadGeneration || listId !== state.currentListId) return;

    const unloaded = sectionKeys.filter((key) => !state.loadedSectionKeys.has(key));
    if (failures.length || unloaded.length) {
      throw new Error(`${unloaded.length || failures.length}セクションを読み込めませんでした。通信状態を確認して再度お試しください。`);
    }

    searchGeneration += 1;
    state.search = "";
    state.searchMatches = null;
    el.searchInput.value = "";
    applyFilters();
    printPrepared = true;
    setPrintProgress(40, "印刷用データの読み込み完了");

    document.body.classList.add("is-printing-book");
    document.body.dataset.printEngine = PRINT_PART === "all" ? "native" : "paged";
    prepareLightweightPrintDom();
    setPrintProgress(45, "印刷レイアウトを準備中");
    if (document.fonts?.ready) await document.fonts.ready;
    await waitForPrintLayout();
    if (PRINT_PART !== "all") {
      await loadPagedJs();
      registerPagedProgressHandler(sectionKeys);
      setPrintProgress(48, `ページを組版中（${PRINT_PAGE_SIZE_LABELS[normalizedPrintPageSize(el.printPageSize.value)]}）`);
      await window.PagedPolyfill.preview();
      await waitForPrintLayout();
      setPrintProgress(98, "印刷画面を準備中");
    } else {
      setPrintProgress(95, "印刷画面を準備中");
    }

    const currentList = state.lists.find((list) => list.id === state.currentListId);
    const originalTitle = document.title;
    document.title = `${currentList?.name || "Crossover"} - ${printPartLabel()}`;
    try {
      setPrintProgress(100, "印刷準備完了");
      await waitForPrintLayout();
      window.print();
    } finally {
      document.title = originalTitle;
    }
  } catch (err) {
    printFailed = true;
    setPrintProgress(0, `印刷準備に失敗しました：${err.message}`);
    showToast(`全体印刷を開始できませんでした: ${err.message}`);
  } finally {
    document.body.classList.remove("is-printing-book");
    if (printPrepared) {
      state.search = savedSearch.query;
      state.searchMatches = savedSearch.matches;
      el.searchInput.value = savedSearch.input;
      applyFilters();
    }
    el.printBookBtn.disabled = false;
    el.printBookBtn.removeAttribute("aria-busy");
    bookPrintInProgress = false;
    if (generation === listLoadGeneration && listId === state.currentListId) setupLazySectionObserver();
    if (el.printStatus?.isConnected && !el.printStatus.textContent.includes("読み込めませんでした")) {
      el.printStatus.hidden = true;
    }
    if (printFailed) {
      printProgressHideTimer = setTimeout(() => {
        printProgressHideTimer = undefined;
        hidePrintProgress();
      }, 8000);
    }
    else hidePrintProgress();
  }
}

el.printBookBtn.addEventListener("click", printWholeBook);

// ---- テーマ切り替え ----

function currentEffectiveTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  // ボタンのラベルはクリック後の切り替え先を示す
  el.themeToggleBtn.textContent = currentEffectiveTheme() === "dark" ? "ライト" : "ダーク";
}

el.themeToggleBtn.addEventListener("click", () => {
  const next = currentEffectiveTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

applyTheme(localStorage.getItem(THEME_KEY));

// ---- 文字サイズ（5段階） ----

function applyFontSize(level) {
  const lvl = FONT_SCALES[level] ? Number(level) : 3;
  document.documentElement.style.setProperty("--font-scale", String(FONT_SCALES[lvl]));
  if (el.fontSizeSteps) {
    el.fontSizeSteps.querySelectorAll(".fontsize-btn").forEach((b) => {
      b.setAttribute("aria-pressed", String(Number(b.dataset.fontLevel) === lvl));
    });
  }
}

if (el.fontSizeSteps) {
  el.fontSizeSteps.addEventListener("click", (e) => {
    const btn = e.target.closest(".fontsize-btn");
    if (!btn) return;
    const level = Number(btn.dataset.fontLevel);
    localStorage.setItem(FONT_SIZE_KEY, String(level));
    applyFontSize(level);
  });
}

applyFontSize(Number(localStorage.getItem(FONT_SIZE_KEY)) || 3);

// ---- プルリフレッシュ ----

async function refreshCurrentList() {
  if (!state.currentListId) return;
  await selectList(state.currentListId, { forceRefresh: true });
}

if (el.ptrIndicator) {
  attachPullToRefresh({
    hitArea: document.body,
    indicatorEl: el.ptrIndicator,
    getScrollTop: () => window.scrollY || document.documentElement.scrollTop || 0,
    onRefresh: refreshCurrentList,
    isBlocked: (target) => !!target.closest("#settingsMenu, #contentsMenu, #sectionNav"),
  });
}

// ---- 起動 ----

window.VocabWebMCP = {
  supported: webMCPSupported,
  register: () => registerVocabWebMCP({ api, openWord: openWordFromWebMCP }),
  unregister: unregisterVocabWebMCP,
  registeredTools: registeredWebMCPTools,
};

beginPageLoading();
loadLists()
  .then(async () => {
    registerVocabWebMCP({ api, openWord: openWordFromWebMCP });
    if (PRINT_BOOK_MODE) await printWholeBook();
  })
  .catch((err) => {
    console.error(err);
    el.loadingMsg.hidden = true;
    el.emptyMsg.hidden = false;
    el.emptyMsg.textContent = `読み込みエラー: ${err.message}`;
  })
  .finally(endPageLoading);
