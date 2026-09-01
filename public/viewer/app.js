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
import { navigationSectionKeys, wordIdFromHash } from "./navigation.js";

const API = `${VIEWER_API_BASE}/api`;
const LAST_LIST_KEY = "vocab-viewer-last-list";
const THEME_KEY = "vocab-viewer-theme";
const FONT_SIZE_KEY = "vocab-viewer-font-size";
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
  activeView: "list", // "list" | "index"
};

const el = {
  listSelect: document.getElementById("listSelect"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  settingsToggle: document.getElementById("settingsToggle"),
  settingsMenu: document.getElementById("settingsMenu"),
  menuToggle: document.getElementById("menuToggle"),
  contentsMenu: document.getElementById("contentsMenu"),
  contentsNav: document.getElementById("contentsNav"),
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
  state.lists = allLists.filter((l) => l.isNotebook !== false);
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
  const saved = localStorage.getItem(LAST_LIST_KEY);
  const initial = state.lists.some((l) => l.id === saved) ? saved : state.lists[0].id;
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
    assignSequentialNumbers();
    buildIndex();
    renderSectionNav();
    renderSectionShells();
    renderContentsNav();
    renderAlphabeticalIndex();
    setupSectionObserver();
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
                (s) =>
                  `<span class="sense-item${s._isPrimary ? " sense-item-primary" : ""}"><span class="sense-meaning">${renderMarkup(s.meaning, { resolve: resolveRef })}</span></span>`
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
    ? `<span class="learning-badge badge-awl" title="Academic Word List${awlSublist ? ` Sublist ${escapeHtml(awlSublist)}` : ""}">AWL</span>`
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
    return;
  }
  const groups = groupIndexEntriesByLetter(entries);
  el.indexList.innerHTML = groups
    .map(
      (g) => `
    <div class="index-group">
      <h2 class="index-letter">${escapeHtml(g.letter)}</h2>
      <div class="index-columns">${g.items.map(renderIndexEntryHtml).join("")}</div>
    </div>`
    )
    .join("");
}

function setActiveView(view) {
  state.activeView = view;
  const isIndex = view === "index";
  el.wordList.hidden = isIndex;
  el.indexList.hidden = !isIndex;
  el.sectionNav.hidden = isIndex || !hasAnySection();
  el.viewTabList.setAttribute("aria-selected", String(!isIndex));
  el.viewTabIndex.setAttribute("aria-selected", String(isIndex));
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

// ---- セクションナビ ----

let sectionObserver;

function renderSectionNav() {
  const sections = state.sections.filter((section) => section.id != null);
  if (sections.length === 0) {
    el.sectionNav.hidden = true;
    el.sectionNav.innerHTML = "";
    document.body.classList.remove("has-section-nav");
    return;
  }
  el.sectionNav.hidden = false;
  document.body.classList.add("has-section-nav");
  el.sectionNav.innerHTML = sections
    .map((section) => `<button type="button" data-section-key="${escapeHtml(String(section.key))}">${escapeHtml(section.name)}</button>`)
    .join("");
}

function renderContentsNav() {
  const withChapters = hasAnyChapter();
  const withSections = hasAnySection();
  if (!withChapters && !withSections) {
    el.contentsNav.innerHTML = '<p class="contents-empty">チャプター・セクションはありません。</p>';
    return;
  }

  el.contentsNav.innerHTML = state.chapters
    .map((chapter) => {
      const chapterTarget = withSections ? `chapter-frame-${chapter.key}` : `chapter-${chapter.key}`;
      const chapterSections = state.sections.filter(
        (section) => withSections && String(section.chapterKey) === String(chapter.key)
      );
      const firstSectionKey = chapterSections[0]?.key;
      const chapterSectionData =
        firstSectionKey != null ? ` data-nav-section-key="${escapeHtml(String(firstSectionKey))}"` : "";
      const chapterButton = withChapters
        ? `<button type="button" class="contents-chapter" data-nav-target="${escapeHtml(chapterTarget)}"${chapterSectionData}>
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
        const groupKey = section.groupId != null ? String(section.groupKey) : null;
        const group = groupKey ? groupByKey.get(groupKey) : null;
        if (group && groupKey !== previousGroupKey) {
          sectionParts.push(
            `<button type="button" class="contents-subgroup" data-nav-target="group-${escapeHtml(group.key)}" data-nav-section-key="${escapeHtml(String(section.key))}">
              <span class="contents-item-text"><span class="contents-item-name">${escapeHtml(group.name)}</span>${
                group.subtitle ? `<span class="contents-item-subtitle">${escapeHtml(group.subtitle)}</span>` : ""
              }</span>
              <span class="contents-item-count">(${group.count})</span>
            </button>`
          );
        }
        previousGroupKey = groupKey;
        sectionParts.push(
          `<button type="button" class="contents-section${withChapters ? " is-nested" : ""}${group ? " is-grouped" : ""}" data-nav-target="section-${escapeHtml(section.key)}" data-nav-section-key="${escapeHtml(String(section.key))}">
            <span class="contents-item-text"><span class="contents-item-name">${escapeHtml(section.name)}</span>${
              section.subtitle ? `<span class="contents-item-subtitle">${escapeHtml(section.subtitle)}</span>` : ""
            }</span>
            <span class="contents-item-count">(${section.count})</span>
          </button>`
        );
      }
      const sections = sectionParts.join("");
      return `<div class="contents-group">${chapterButton}${sections}</div>`;
    })
    .join("");
}

function setupSectionObserver() {
  if (sectionObserver) sectionObserver.disconnect();
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

el.sectionNav.addEventListener("click", async (e) => {
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
  el.menuToggle.setAttribute("aria-label", "チャプター・セクション一覧を開く");
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
  el.menuToggle.setAttribute("aria-label", open ? "チャプター・セクション一覧を閉じる" : "チャプター・セクション一覧を開く");
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
el.contentsNav.addEventListener("click", async (e) => {
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
  .then(() => registerVocabWebMCP({ api, openWord: openWordFromWebMCP }))
  .catch((err) => {
    console.error(err);
    el.loadingMsg.hidden = true;
    el.emptyMsg.hidden = false;
    el.emptyMsg.textContent = `読み込みエラー: ${err.message}`;
  })
  .finally(endPageLoading);
