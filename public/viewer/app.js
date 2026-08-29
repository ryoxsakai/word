import {
  collectPhraseCrossReferences,
  createAutoCrossRefRenderer,
  renderMarkup,
  renderWordListMarkup,
  escapeHtml,
  stripMarkup,
} from "../shared/markup.js";
import { VIEWER_API_BASE } from "../shared/config.js";
import { formatPronunciationWithAccents } from "../shared/pronunciation.js";
import { cefrLevelClass, effectiveCefrLevel } from "../shared/learning-tags.js";
import { attachPullToRefresh } from "../shared/pull-to-refresh.js";
import { speakEnglish } from "../shared/speech.js";
import {
  registerVocabWebMCP,
  registeredWebMCPTools,
  unregisterVocabWebMCP,
  webMCPSupported,
} from "./webmcp.js";

const API = `${VIEWER_API_BASE}/api`;
const LAST_LIST_KEY = "vocab-viewer-last-list";
const THEME_KEY = "vocab-viewer-theme";
const FONT_SIZE_KEY = "vocab-viewer-font-size";
// 文字サイズ5段階（level -> --font-scale の倍率）。3が標準(等倍)。
const FONT_SCALES = { 1: 0.8, 2: 0.9, 3: 1, 4: 1.15, 5: 1.32 };

const BLANK_RE = /(＿{2,}|_{3,})/;

const state = {
  lists: [],
  currentListId: null,
  words: [],
  wordIndex: new Map(), // spelling(lower) -> {id, no}
  renderNotesMarkup: null,
  search: "",
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
  backToTopBtn: document.getElementById("backToTopBtn"),
  toast: document.getElementById("toast"),
  fontSizeSteps: document.getElementById("fontSizeSteps"),
  ptrIndicator: document.getElementById("ptrIndicator"),
};

async function api(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function resolveRef(headword) {
  const hit = state.wordIndex.get(headword.toLowerCase());
  if (!hit) return { found: false };
  return { found: true, id: hit.id, no: hit.no };
}

function renderRef(spelling) {
  const hit = resolveRef(spelling);
  if (!hit.found) return escapeHtml(spelling);
  return `<a href="#word-${escapeHtml(hit.id)}" class="ref" data-word-id="${escapeHtml(hit.id)}">${escapeHtml(spelling)}</a>`;
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

async function selectList(listId) {
  state.currentListId = listId;
  localStorage.setItem(LAST_LIST_KEY, listId);
  el.loadingMsg.hidden = false;
  el.emptyMsg.hidden = true;
  el.wordList.innerHTML = "";
  try {
    const data = await api(`/lists/${encodeURIComponent(listId)}/words/full`);
    state.words = data.words;
    assignSequentialNumbers();
    buildIndex();
    renderSectionNav();
    renderWords();
    renderContentsNav();
    renderAlphabeticalIndex();
    setupSectionObserver();
    el.emptyMsg.hidden = state.words.length > 0;
    applyHashScroll();
  } catch (err) {
    el.wordList.innerHTML = `<p class="empty-msg">読み込みに失敗しました: ${escapeHtml(err.message)}</p>`;
  } finally {
    el.loadingMsg.hidden = true;
  }
}

// 閲覧ページの番号は、保存された no ではなく「上から表示される順番」で毎回振り直す。
// これにより、単語帳での並び替えやマスターからの追加後も、常に 1,2,3,... と隙間なく連番になる。
// 派生語の枝番(例: 5-1, 5-2)は直前の見出し語の番号にぶら下げる。
// state.words はサーバー側で「セクション順 → no → branch」に整列済みなので、この順で数えればよい。
function assignSequentialNumbers() {
  let top = 0;
  let branch = 0;
  for (const w of state.words) {
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
  state.wordIndex = new Map();
  for (const w of state.words) {
    state.wordIndex.set(w.spelling.toLowerCase(), { id: w.id, no: w.seqNo });
  }
  state.renderNotesMarkup = createAutoCrossRefRenderer(state.wordIndex.keys(), {
    resolve: resolveRef,
    phraseReferences: collectPhraseCrossReferences(state.words),
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
      ${meaningsHtml}
      ${pron ? `<span class="pron sense-pron">${escapeHtml(formatPronunciationWithAccents(pron))}</span>` : ""}
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

  const derivativesHtml = (w.derivatives || []).length
    ? `<div class="notes-block notes-derivative"><span class="notes-label derivative-badge">派生語</span><span class="notes-content derivative-items">${w.derivatives
        .map(
          (d) => `<span class="derivative-item">${d.pos ? `<span class="pos-badge derivative-pos">${escapeHtml(d.pos)}</span> ` : ""}<span class="derivative-word">${renderMarkup(d.word, { resolve: resolveRef })}</span>${d.meaning ? ` <span class="derivative-meaning">${renderMarkup(d.meaning, { resolve: resolveRef })}</span>` : ""}</span>`
        )
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

  return `
  <article class="entry${isBranch ? " branch-entry" : ""}" id="word-${escapeHtml(w.id)}" data-word-id="${escapeHtml(w.id)}" data-no="${escapeHtml(w.seqNo)}" data-haystack="${escapeHtml(haystack)}">
    <div class="entry-no" data-action="copy-link" data-word-id="${escapeHtml(w.id)}" title="リンクをコピー">${escapeHtml(w.seqNo)}</div>
    <div class="entry-body">
      <div class="entry-head">
        <span class="headword">${escapeHtml(w.spelling)}</span>
        ${w.pronunciation ? `<span class="pron">${escapeHtml(formatPronunciationWithAccents(w.pronunciation))}<button type="button" class="speak-btn" data-action="speak" data-text="${escapeHtml(w.spelling)}" title="端末の英語音声で発音を聞く"><i class="fa-solid fa-volume-high" aria-hidden="true"></i></button></span>` : ""}
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
        ${etymologyHtml}
        ${synonymsHtml}
        ${antonymsHtml}
        ${notesHtml}
      </div>
    </div>
  </article>`;
}

function hasAnySection() {
  return state.words.some((w) => w.sectionId != null);
}

function hasAnyChapter() {
  return state.words.some((w) => w.chapterId != null);
}

function hasAnyLabel() {
  return state.words.some((w) => w.labelId != null);
}

function renderWords() {
  const withSections = hasAnySection();
  const withChapters = hasAnyChapter();
  const withLabels = hasAnyLabel();
  const countByKey = new Map();
  const countByChapterKey = new Map();
  const countByLabelKey = new Map();
  const toneBySectionKey = new Map();
  for (const w of state.words) {
    const key = w.sectionId != null ? String(w.sectionId) : "none";
    countByKey.set(key, (countByKey.get(key) || 0) + 1);
    if (withSections && !toneBySectionKey.has(key)) {
      toneBySectionKey.set(key, (toneBySectionKey.size % 6) + 1);
    }
    const chapterKey = w.chapterId != null ? String(w.chapterId) : "none";
    countByChapterKey.set(chapterKey, (countByChapterKey.get(chapterKey) || 0) + 1);
    const labelKey = w.labelId != null ? String(w.labelId) : `none-${key}`;
    countByLabelKey.set(labelKey, (countByLabelKey.get(labelKey) || 0) + 1);
  }
  let lastKey;
  let lastChapterKey;
  let lastLabelKey;
  let sectionOpen = false;
  const parts = [];
  for (const w of state.words) {
    const chapterKey = w.chapterId != null ? String(w.chapterId) : "none";
    const key = w.sectionId != null ? String(w.sectionId) : "none";
    const chapterChanged = withChapters && chapterKey !== lastChapterKey;
    const sectionChanged = withSections && (key !== lastKey || chapterChanged);

    if (sectionChanged && sectionOpen) {
      parts.push("</section>");
      sectionOpen = false;
    }

    let chapterMarkup = "";
    if (chapterChanged) {
      lastChapterKey = chapterKey;
      const titleLine = `<span class="chapter-title">${escapeHtml(w.chapterName || "その他")}</span>${
        w.chapterSubtitle ? `<span class="chapter-subtitle">${escapeHtml(w.chapterSubtitle)}</span>` : ""
      }<span class="chapter-count">(${countByChapterKey.get(chapterKey)})</span>`;
      const descLine = w.chapterDescription ? `<div class="chapter-description">${escapeHtml(w.chapterDescription)}</div>` : "";
      chapterMarkup = `<div class="chapter-divider" id="chapter-${escapeHtml(chapterKey)}" data-chapter-key="${escapeHtml(chapterKey)}"><div class="chapter-title-row">${titleLine}</div>${descLine}</div>`;
    }
    if (sectionChanged) {
      lastKey = key;
      lastLabelKey = undefined;
      const sectionTone = `section-tone-${toneBySectionKey.get(key)}`;
      const chapterClass = chapterMarkup ? " has-chapter-divider" : "";
      const chapterFrameId = chapterMarkup ? ` id="chapter-frame-${escapeHtml(chapterKey)}"` : "";
      const titleLine = `<span class="section-title">${escapeHtml(w.sectionName || "その他")}</span>${
        w.sectionSubtitle ? `<span class="section-subtitle">${escapeHtml(w.sectionSubtitle)}</span>` : ""
      }<span class="section-count">(${countByKey.get(key)})</span>`;
      const descLine = w.sectionDescription ? `<div class="section-description">${escapeHtml(w.sectionDescription)}</div>` : "";
      parts.push(
        `<section class="section-group ${sectionTone}${chapterClass}"${chapterFrameId} data-section-key="${escapeHtml(key)}" data-chapter-key="${escapeHtml(chapterKey)}" aria-labelledby="section-${escapeHtml(key)}">`,
        chapterMarkup,
        `<div class="section-divider" id="section-${escapeHtml(key)}" data-section-key="${escapeHtml(key)}"><div class="section-title-row">${titleLine}</div>${descLine}</div>`
      );
      sectionOpen = true;
    } else if (chapterMarkup) {
      parts.push(chapterMarkup);
    }
    const labelKey = w.labelId != null ? String(w.labelId) : `none-${key}`;
    if (withLabels && w.labelId != null && labelKey !== lastLabelKey) {
      lastLabelKey = labelKey;
      parts.push(`<div class="label-divider" data-label-key="${escapeHtml(labelKey)}"><i class="fa-solid fa-tag" aria-hidden="true"></i><span class="label-title">${escapeHtml(w.labelName || "")}</span><span class="label-count">(${countByLabelKey.get(labelKey)})</span></div>`);
    } else if (w.labelId == null) {
      lastLabelKey = labelKey;
    }
    parts.push(renderEntry(w));
  }
  if (sectionOpen) parts.push("</section>");
  el.wordList.innerHTML = parts.join("");
  applyFilters();
}

// ---- 索引（abc順） ----

// state.wordsには見出し語(branch=0)と派生語エントリー(branch>0)しか並ばないため、
// 各エントリーの derivatives（例文欄と違い、独立したエントリーを持たない参考の派生語）も
// 拾い上げて索引に含める。ただし派生語自身が別途エントリーを持つ場合は二重掲載しない。
function buildAlphabeticalIndex() {
  const entries = [];
  for (const w of state.words) {
    entries.push({ spelling: w.spelling, loc: w.seqNo, targetId: w.id, isRef: false });
  }
  const derivSeen = new Set();
  for (const w of state.words) {
    for (const d of w.derivatives || []) {
      const plain = stripMarkup(d.word || "");
      if (!plain) continue;
      const key = plain.toLowerCase();
      if (state.wordIndex.has(key)) continue; // 本来のエントリーとして別途載るので、参照表記は不要
      if (derivSeen.has(key)) continue;
      derivSeen.add(key);
      entries.push({ spelling: plain, loc: `→ ${w.spelling} ${w.seqNo}`, targetId: w.id, isRef: true });
    }
  }
  entries.sort((a, b) => a.spelling.localeCompare(b.spelling, "en", { sensitivity: "base" }));
  return entries;
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

el.indexList.addEventListener("click", (e) => {
  const item = e.target.closest('[data-action="index-jump"]');
  if (!item) return;
  navigateToWord(item.dataset.wordId);
});

// ---- セクションナビ ----

let sectionObserver;

function renderSectionNav() {
  const seen = new Map();
  for (const w of state.words) {
    if (w.sectionId == null) continue;
    if (!seen.has(w.sectionId)) seen.set(w.sectionId, w.sectionName || "");
  }
  if (seen.size === 0) {
    el.sectionNav.hidden = true;
    el.sectionNav.innerHTML = "";
    document.body.classList.remove("has-section-nav");
    return;
  }
  el.sectionNav.hidden = false;
  document.body.classList.add("has-section-nav");
  el.sectionNav.innerHTML = [...seen.entries()]
    .map(([key, name]) => `<button type="button" data-section-key="${escapeHtml(String(key))}">${escapeHtml(name)}</button>`)
    .join("");
}

function renderContentsNav() {
  const withChapters = hasAnyChapter();
  const withSections = hasAnySection();
  if (!withChapters && !withSections) {
    el.contentsNav.innerHTML = '<p class="contents-empty">チャプター・セクションはありません。</p>';
    return;
  }

  const chapters = [];
  const chapterByKey = new Map();

  for (const w of state.words) {
    const chapterKey = w.chapterId != null ? String(w.chapterId) : "none";
    let chapter = chapterByKey.get(chapterKey);
    if (!chapter) {
      chapter = {
        key: chapterKey,
        name: w.chapterName || "その他",
        subtitle: w.chapterSubtitle || "",
        count: 0,
        sections: [],
        sectionByKey: new Map(),
      };
      chapterByKey.set(chapterKey, chapter);
      chapters.push(chapter);
    }
    chapter.count += 1;

    if (!withSections) continue;
    const sectionKey = w.sectionId != null ? String(w.sectionId) : "none";
    let section = chapter.sectionByKey.get(sectionKey);
    if (!section) {
      section = {
        key: sectionKey,
        name: w.sectionName || "その他",
        subtitle: w.sectionSubtitle || "",
        count: 0,
      };
      chapter.sectionByKey.set(sectionKey, section);
      chapter.sections.push(section);
    }
    section.count += 1;
  }

  if (chapters.length === 0) {
    el.contentsNav.innerHTML = '<p class="contents-empty">チャプター・セクションはありません。</p>';
    return;
  }

  el.contentsNav.innerHTML = chapters
    .map((chapter) => {
      const chapterTarget = withSections ? `chapter-frame-${chapter.key}` : `chapter-${chapter.key}`;
      const chapterButton = withChapters
        ? `<button type="button" class="contents-chapter" data-nav-target="${escapeHtml(chapterTarget)}">
            <span class="contents-item-text"><span class="contents-item-name">${escapeHtml(chapter.name)}</span>${
              chapter.subtitle ? `<span class="contents-item-subtitle">${escapeHtml(chapter.subtitle)}</span>` : ""
            }</span>
            <span class="contents-item-count">(${chapter.count})</span>
          </button>`
        : "";
      const sections = chapter.sections
        .map(
          (section) => `<button type="button" class="contents-section${withChapters ? " is-nested" : ""}" data-nav-target="section-${escapeHtml(section.key)}">
            <span class="contents-item-text"><span class="contents-item-name">${escapeHtml(section.name)}</span>${
              section.subtitle ? `<span class="contents-item-subtitle">${escapeHtml(section.subtitle)}</span>` : ""
            }</span>
            <span class="contents-item-count">(${section.count})</span>
          </button>`
        )
        .join("");
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

el.sectionNav.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-section-key]");
  if (!btn) return;
  const target = document.getElementById(`section-${btn.dataset.sectionKey}`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---- 検索・進捗フィルタ ----

function applyFilters() {
  const q = state.search.trim().toLowerCase();
  const entries = el.wordList.querySelectorAll(".entry");
  entries.forEach((entry) => {
    const haystack = entry.dataset.haystack || "";
    entry.hidden = !(!q || haystack.includes(q));
  });

  const sectionGroups = [...el.wordList.querySelectorAll(".section-group")];
  if (sectionGroups.length > 0) {
    const groupHasVisibleEntry = new Map();
    for (const group of sectionGroups) {
      const groupChildren = [...group.children];
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
    for (const group of sectionGroups) {
      const chapterDivider = group.querySelector(":scope > .chapter-divider");
      if (chapterDivider) chapterDivider.hidden = !visibleChapterKeys.has(group.dataset.chapterKey);
      group.hidden = !groupHasVisibleEntry.get(group) && (!chapterDivider || chapterDivider.hidden);
    }

    const topLevelChildren = [...el.wordList.children];
    for (let i = 0; i < topLevelChildren.length; i += 1) {
      const chapterDivider = topLevelChildren[i];
      if (!chapterDivider.classList.contains("chapter-divider")) continue;
      let chapterHasVisibleSection = false;
      for (let j = i + 1; j < topLevelChildren.length; j += 1) {
        const next = topLevelChildren[j];
        if (next.classList.contains("chapter-divider")) break;
        if (next.classList.contains("section-group") && !next.hidden) {
          chapterHasVisibleSection = true;
          break;
        }
      }
      chapterDivider.hidden = !chapterHasVisibleSection;
    }
    return;
  }

  const children = [...el.wordList.children];
  for (let i = 0; i < children.length; i += 1) {
    const divider = children[i];
    if (!divider.matches(".chapter-divider, .section-divider, .label-divider")) continue;
    const level = divider.classList.contains("chapter-divider") ? 3 : divider.classList.contains("section-divider") ? 2 : 1;
    let hasVisible = false;
    for (let j = i + 1; j < children.length; j += 1) {
      const next = children[j];
      const nextLevel = next.classList.contains("chapter-divider") ? 3 : next.classList.contains("section-divider") ? 2 : next.classList.contains("label-divider") ? 1 : 0;
      if (nextLevel >= level) break;
      if (next.classList.contains("entry") && !next.hidden) {
        hasVisible = true;
        break;
      }
    }
    divider.hidden = !hasVisible;
  }
}

// ---- 発音 / リンクコピー / 空所トグル ----

function speak(text, btn) {
  speakEnglish(text, {
    button: btn,
    onUnsupported: () => showToast("この端末は音声読み上げに対応していません"),
  });
}

async function copyLink(id) {
  const url = `${location.origin}${location.pathname}#word-${id}`;
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

function revealAndScroll(target) {
  if (!target) return;
  if (target.hidden) {
    state.search = "";
    el.searchInput.value = "";
    applyFilters();
  }
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  flash(target);
}

function navigateToWord(id) {
  const target = document.getElementById(`word-${id}`);
  if (!target) return;
  if (state.activeView !== "list") setActiveView("list");
  history.pushState(null, "", `#word-${id}`);
  revealAndScroll(target);
}

async function openWordFromWebMCP(listId, wordId) {
  if (state.currentListId !== listId || !state.words.some((word) => String(word.id) === String(wordId))) {
    const notebookExists = state.lists.some((list) => list.id === listId);
    if (!notebookExists) throw new Error("指定された単語帳が見つかりません。");
    el.listSelect.value = listId;
    await selectList(listId);
  }
  navigateToWord(wordId);
}

function applyHashScroll() {
  if (!location.hash.startsWith("#word-")) return;
  let target;
  try {
    target = document.querySelector(location.hash);
  } catch {
    return;
  }
  if (target) setTimeout(() => revealAndScroll(target), 60);
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
    navigateToWord(refLink.dataset.wordId);
    return;
  }
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === "speak") speak(actionEl.dataset.text, actionEl);
  else if (action === "copy-link") copyLink(actionEl.dataset.wordId);
  else if (action === "toggle-blank") toggleBlank(actionEl);
});

let searchTimer;
el.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = el.searchInput.value;
    applyFilters();
  }, 120);
});

el.listSelect.addEventListener("change", (e) => selectList(e.target.value));

el.jumpForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const raw = el.jumpInput.value.trim();
  if (!raw) return;
  let target = null;
  try {
    target =
      el.wordList.querySelector(`.entry[data-no="${CSS.escape(raw)}"]`) ||
      el.wordList.querySelector(`.entry[data-no^="${CSS.escape(raw)}-"]`);
  } catch {
    target = null;
  }
  if (!target) {
    showToast(`no.${raw} は見つかりませんでした`);
    return;
  }
  history.pushState(null, "", `#word-${target.dataset.wordId}`);
  revealAndScroll(target);
  closeSettingsMenu();
});

el.settingsToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSettingsMenu();
});
el.menuToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleContentsMenu();
});
el.contentsNav.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-nav-target]");
  if (!btn) return;
  const target = document.getElementById(btn.dataset.navTarget);
  if (!target) return;
  if (state.activeView !== "list") setActiveView("list");
  closeContentsMenu();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
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
  await selectList(state.currentListId);
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

loadLists()
  .then(() => registerVocabWebMCP({ api, openWord: openWordFromWebMCP }))
  .catch((err) => {
    console.error(err);
    el.loadingMsg.hidden = true;
    el.emptyMsg.hidden = false;
    el.emptyMsg.textContent = `読み込みエラー: ${err.message}`;
  });
