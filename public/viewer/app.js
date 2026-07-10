import { renderMarkup, escapeHtml } from "../shared/markup.js";
import { API_BASE } from "../shared/config.js";
import { formatPronunciationWithAccents } from "../shared/pronunciation.js";

const API = `${API_BASE}/api`;
const LAST_LIST_KEY = "vocab-viewer-last-list";
const THEME_KEY = "vocab-viewer-theme";
const FONT_SIZE_KEY = "vocab-viewer-font-size";
// 文字サイズ5段階（level -> --font-scale の倍率）。3が標準(等倍)。
const FONT_SCALES = { 1: 0.8, 2: 0.9, 3: 1, 4: 1.15, 5: 1.32 };
const learnedKey = (listId) => `vocab-learned:${listId}`;

const BLANK_RE = /(＿{2,}|_{3,})/;

const state = {
  lists: [],
  currentListId: null,
  words: [],
  wordIndex: new Map(), // spelling(lower) -> {id, no}
  learned: new Set(),
  search: "",
  unlearnedOnly: false,
};

const el = {
  listSelect: document.getElementById("listSelect"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  menuToggle: document.getElementById("menuToggle"),
  topbarMenu: document.getElementById("topbarMenu"),
  searchInput: document.getElementById("searchInput"),
  unlearnedOnlyBtn: document.getElementById("unlearnedOnlyBtn"),
  progressFill: document.getElementById("progressFill"),
  progressLabel: document.getElementById("progressLabel"),
  sectionNav: document.getElementById("sectionNav"),
  jumpForm: document.getElementById("jumpForm"),
  jumpInput: document.getElementById("jumpInput"),
  wordList: document.getElementById("wordList"),
  emptyMsg: document.getElementById("emptyMsg"),
  loadingMsg: document.getElementById("loadingMsg"),
  backToTopBtn: document.getElementById("backToTopBtn"),
  toast: document.getElementById("toast"),
  fontSizeSteps: document.getElementById("fontSizeSteps"),
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

function loadLearned(listId) {
  try {
    const raw = localStorage.getItem(learnedKey(listId));
    state.learned = new Set(raw ? JSON.parse(raw) : []);
  } catch {
    state.learned = new Set();
  }
}

function saveLearned() {
  localStorage.setItem(learnedKey(state.currentListId), JSON.stringify([...state.learned]));
}

async function selectList(listId) {
  state.currentListId = listId;
  localStorage.setItem(LAST_LIST_KEY, listId);
  loadLearned(listId);
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
    setupSectionObserver();
    updateProgress();
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
  const isLearned = state.learned.has(w.id);
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
      ${pron ? `<span class="pron sense-pron">[${escapeHtml(formatPronunciationWithAccents(pron))}]</span>` : ""}
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
    ? `<div class="derivative-list">${w.derivatives
        .map(
          (d) => `
        <div class="derivative-line">
          <span class="bullet hollow">◇</span>
          <span class="derivative-head">
            <span class="derivative-word">${renderMarkup(d.word, { resolve: resolveRef })}</span>
            ${d.pos ? `<span class="pos-badge">${escapeHtml(d.pos)}</span>` : ""}
          </span>
          ${d.meaning ? `<span class="derivative-meaning">${renderMarkup(d.meaning, { resolve: resolveRef })}</span>` : ""}
        </div>`
        )
        .join("")}</div>`
    : "";

  const etymologyHtml = w.etymology
    ? `<div class="etymology-block"><span class="etymology-label">(コア)</span>${renderMarkup(w.etymology, { resolve: resolveRef })}</div>`
    : "";
  const synonymsHtml = w.synonyms
    ? `<div class="notes-block"><span class="notes-label">類義語</span>${renderMarkup(w.synonyms, { resolve: resolveRef })}</div>`
    : "";
  const antonymsHtml = w.antonyms
    ? `<div class="notes-block"><span class="notes-label">対義語</span>${renderMarkup(w.antonyms, { resolve: resolveRef })}</div>`
    : "";
  const notesHtml = w.notes
    ? `<div class="notes-block"><span class="notes-label">メモ</span>${renderMarkup(w.notes, { resolve: resolveRef })}</div>`
    : "";

  const cautionHtml = [
    w.pronunciationCaution ? '<span class="caution-badge caution-pronunciation" title="発音に注意">発音</span>' : "",
    w.accentCaution ? '<span class="caution-badge caution-accent" title="アクセント位置に注意">アクセント</span>' : "",
  ].join("");

  return `
  <article class="entry${isBranch ? " branch-entry" : ""}${isLearned ? " is-learned" : ""}" id="word-${escapeHtml(w.id)}" data-word-id="${escapeHtml(w.id)}" data-no="${escapeHtml(w.seqNo)}" data-haystack="${escapeHtml(haystack)}">
    <div class="entry-no" data-action="copy-link" data-word-id="${escapeHtml(w.id)}" title="リンクをコピー">${escapeHtml(w.seqNo)}</div>
    <div class="entry-body">
      <div class="entry-head">
        <span class="headword">${escapeHtml(w.spelling)}</span>
        <button type="button" class="speak-btn" data-action="speak" data-text="${escapeHtml(w.spelling)}" data-audio-url="${escapeHtml(w.audioUrl || "")}" title="発音を聞く"><i class="fa-solid fa-volume-high" aria-hidden="true"></i></button>
        ${w.pronunciation ? `<span class="pron">[${escapeHtml(formatPronunciationWithAccents(w.pronunciation))}]</span>` : ""}
        ${cautionHtml}
      </div>
      ${familyLine}
      <div class="entry-card">
        ${sensesHtml}
        ${examplesHtml}
        ${derivativesHtml}
        ${etymologyHtml}
        ${synonymsHtml}
        ${antonymsHtml}
        ${notesHtml}
      </div>
      <label class="learned-toggle">
        <input type="checkbox" data-action="toggle-learned" data-word-id="${escapeHtml(w.id)}" ${isLearned ? "checked" : ""} />
        習得済みにする
      </label>
    </div>
  </article>`;
}

function hasAnySection() {
  return state.words.some((w) => w.sectionId != null);
}

function renderWords() {
  const withSections = hasAnySection();
  let lastKey;
  const parts = [];
  for (const w of state.words) {
    const key = w.sectionId != null ? String(w.sectionId) : "none";
    if (withSections && key !== lastKey) {
      lastKey = key;
      const titleLine = `<span class="section-title">${escapeHtml(w.sectionName || "その他")}</span>${
        w.sectionSubtitle ? `<span class="section-subtitle">${escapeHtml(w.sectionSubtitle)}</span>` : ""
      }`;
      const descLine = w.sectionDescription ? `<div class="section-description">${escapeHtml(w.sectionDescription)}</div>` : "";
      parts.push(
        `<div class="section-divider" id="section-${escapeHtml(key)}" data-section-key="${escapeHtml(key)}"><div class="section-title-row">${titleLine}</div>${descLine}</div>`
      );
    }
    parts.push(renderEntry(w));
  }
  el.wordList.innerHTML = parts.join("");
  applyFilters();
}

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
    const matchesSearch = !q || haystack.includes(q);
    const matchesLearned = !state.unlearnedOnly || !state.learned.has(entry.dataset.wordId);
    entry.hidden = !(matchesSearch && matchesLearned);
  });

  let currentDivider = null;
  let dividerHasVisible = false;
  for (const child of el.wordList.children) {
    if (child.classList.contains("section-divider")) {
      if (currentDivider) currentDivider.hidden = !dividerHasVisible;
      currentDivider = child;
      dividerHasVisible = false;
    } else if (child.classList.contains("entry") && !child.hidden) {
      dividerHasVisible = true;
    }
  }
  if (currentDivider) currentDivider.hidden = !dividerHasVisible;
}

function updateProgress() {
  const total = state.words.length;
  const learnedCount = state.words.filter((w) => state.learned.has(w.id)).length;
  el.progressFill.style.width = total ? `${Math.round((learnedCount / total) * 100)}%` : "0%";
  el.progressLabel.textContent = `${learnedCount} / ${total} 習得`;
}

function toggleLearned(id) {
  if (state.learned.has(id)) state.learned.delete(id);
  else state.learned.add(id);
  saveLearned();
  updateProgress();
}

// ---- 発音 / リンクコピー / 空所トグル ----

function speakWithTts(text, btn) {
  if (!("speechSynthesis" in window)) {
    showToast("この端末は音声読み上げに対応していません");
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  if (btn) {
    btn.classList.add("speaking");
    const clear = () => btn.classList.remove("speaking");
    utter.onend = clear;
    utter.onerror = clear;
  }
  window.speechSynthesis.speak(utter);
}

// 辞書APIから取得した実音声(audioUrl)があればそれを再生し、なければブラウザのTTSにフォールバックする。
function speak(text, btn, audioUrl) {
  if (audioUrl) {
    if (btn) btn.classList.add("speaking");
    const audio = new Audio(audioUrl);
    const clear = () => btn && btn.classList.remove("speaking");
    audio.addEventListener("ended", clear);
    audio.addEventListener("error", () => {
      clear();
      speakWithTts(text, btn);
    });
    audio.play().catch(() => {
      clear();
      speakWithTts(text, btn);
    });
    return;
  }
  speakWithTts(text, btn);
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
    state.unlearnedOnly = false;
    el.unlearnedOnlyBtn.setAttribute("aria-pressed", "false");
    applyFilters();
  }
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  flash(target);
}

function navigateToWord(id) {
  const target = document.getElementById(`word-${id}`);
  if (!target) return;
  history.pushState(null, "", `#word-${id}`);
  revealAndScroll(target);
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

// ---- ハンバーガーメニュー(検索・ジャンプ) ----

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
  if (action === "speak") speak(actionEl.dataset.text, actionEl, actionEl.dataset.audioUrl || null);
  else if (action === "copy-link") copyLink(actionEl.dataset.wordId);
  else if (action === "toggle-blank") toggleBlank(actionEl);
});

el.wordList.addEventListener("change", (e) => {
  const cb = e.target.closest('[data-action="toggle-learned"]');
  if (!cb) return;
  toggleLearned(cb.dataset.wordId);
  const entry = cb.closest(".entry");
  if (entry) entry.classList.toggle("is-learned", state.learned.has(cb.dataset.wordId));
  updateProgress();
  applyFilters();
});

let searchTimer;
el.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = el.searchInput.value;
    applyFilters();
  }, 120);
});

el.unlearnedOnlyBtn.addEventListener("click", () => {
  state.unlearnedOnly = !state.unlearnedOnly;
  el.unlearnedOnlyBtn.setAttribute("aria-pressed", String(state.unlearnedOnly));
  applyFilters();
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
  closeTopbarMenu();
});

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
  if (e.key === "Escape" && el.topbarMenu.classList.contains("is-open")) closeTopbarMenu();
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

// ---- 起動 ----

loadLists().catch((err) => {
  console.error(err);
  el.loadingMsg.hidden = true;
  el.emptyMsg.hidden = false;
  el.emptyMsg.textContent = `読み込みエラー: ${err.message}`;
});
