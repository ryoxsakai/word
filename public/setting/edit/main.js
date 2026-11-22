// 閲覧型編集ページの起動・メニュー・目次・タブ。
import { readingPosition } from "../../shared/reading-position.js";
import { createWordEditor, requestWordStructure } from "./words.js";
import { setupIllustrationLoading } from "../../shared/illustrations.js";
import { createIdiomEditor } from "./idioms.js";
import { api, onPublication, resumePublicationWatch } from "./api.js";
import { h, toast, sortable, sheet, closeSheet } from "./ui.js";
import { buildAlphabeticalIndexEntries, getAlphabeticalIndexKey } from "../../shared/word-index.js";
import { VIEWER_API_BASE } from "../../shared/config.js";

const LIST_ID_FALLBACK = "crossover-v3";
const THEME_KEY = "vocab-viewer-theme";
const FONT_SIZE_KEY = "vocab-viewer-font-size";
const FONT_SCALES = { 1: 0.8, 2: 0.9, 3: 1, 4: 1.15, 5: 1.32 };

const el = {
  settingsToggle: document.getElementById("settingsToggle"),
  settingsMenu: document.getElementById("settingsMenu"),
  menuToggle: document.getElementById("menuToggle"),
  contentsMenu: document.getElementById("contentsMenu"),
  contentsNav: document.getElementById("contentsNav"),
  wordList: document.getElementById("wordList"),
  idiomList: document.getElementById("idiomList"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  fontSizeSteps: document.getElementById("fontSizeSteps"),
  jumpForm: document.getElementById("jumpForm"),
  jumpInput: document.getElementById("jumpInput"),
  publishStatus: document.getElementById("publishStatus"),
  indexList: document.getElementById("indexList"),
  sectionNav: document.getElementById("sectionNav"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  tabs: [...document.querySelectorAll(".view-tab")],
};

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

// ---- テーマ・文字サイズ（閲覧ページと同じ保存先） ----
function effectiveTheme() {
  return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function applyTheme(theme) {
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  el.themeToggleBtn.textContent = effectiveTheme() === "dark" ? "ライト" : "ダーク";
}
el.themeToggleBtn.addEventListener("click", () => {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  storage.set(THEME_KEY, next);
  applyTheme(next);
});
applyTheme(storage.get(THEME_KEY));
function applyFontSize(level) {
  const lvl = FONT_SCALES[level] ? Number(level) : 3;
  document.documentElement.style.setProperty("--font-scale", String(FONT_SCALES[lvl]));
  el.fontSizeSteps.querySelectorAll(".fontsize-btn").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.fontLevel) === lvl)));
}
el.fontSizeSteps.addEventListener("click", event => {
  const button = event.target.closest(".fontsize-btn");
  if (!button) return;
  storage.set(FONT_SIZE_KEY, button.dataset.fontLevel);
  applyFontSize(Number(button.dataset.fontLevel));
});
applyFontSize(Number(storage.get(FONT_SIZE_KEY)) || 3);

// ---- メニュー ----
function setMenu(menu, toggle, open, labels) {
  menu.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? labels[1] : labels[0]);
}
el.settingsToggle.addEventListener("click", () => {
  const open = !el.settingsMenu.classList.contains("is-open");
  setMenu(el.contentsMenu, el.menuToggle, false, ["目次を開く", "目次を閉じる"]);
  setMenu(el.settingsMenu, el.settingsToggle, open, ["設定を開く", "設定を閉じる"]);
});
el.menuToggle.addEventListener("click", () => {
  const open = !el.contentsMenu.classList.contains("is-open");
  setMenu(el.settingsMenu, el.settingsToggle, false, ["設定を開く", "設定を閉じる"]);
  setMenu(el.contentsMenu, el.menuToggle, open, ["目次を開く", "目次を閉じる"]);
  if (open) renderContents();
});
const closeMenus = () => {
  setMenu(el.settingsMenu, el.settingsToggle, false, ["設定を開く", "設定を閉じる"]);
  setMenu(el.contentsMenu, el.menuToggle, false, ["目次を開く", "目次を閉じる"]);
};

// ---- 反映状況 ----
onPublication(status => {
  if (status.state === "publishing") {
    el.publishStatus.hidden = false;
    el.publishStatus.className = "edit-publish-status is-publishing";
    el.publishStatus.textContent = "閲覧ページへ反映中…";
  } else if (status.state === "idle") {
    el.publishStatus.hidden = true;
  } else if (status.state === "published") {
    el.publishStatus.hidden = true;
    toast("閲覧ページに反映しました");
  } else if (status.state === "failed") {
    el.publishStatus.hidden = false;
    el.publishStatus.className = "edit-publish-status is-failed";
    el.publishStatus.textContent = "反映を確認できません";
    toast(`閲覧ページへの反映を確認できません：${status.message}`, { tone: "error", duration: 8000 });
  }
});

// ---- 単語・熟語 ----
let activeView = "list";
let words, idioms;
let listId = LIST_ID_FALLBACK;

function setView(view) {
  activeView = view;
  for (const panel of [el.wordList, el.idiomList, el.indexList]) {
    const active = panel.dataset.viewPanel === view;
    panel.classList.toggle("is-active", active);
    panel.setAttribute("aria-hidden", String(!active));
  }
  for (const tab of el.tabs) {
    tab.setAttribute("aria-selected", String(tab.dataset.view === view));
    tab.tabIndex = tab.dataset.view === view ? 0 : -1;
  }
  ensureIdioms();
  if (view === "index") renderIndex();
  renderContents();
  renderBottomNav();
}
function ensureIdioms() {
  if (idioms || !words) return idioms;
  idioms = createIdiomEditor({ root: el.idiomList, listId, onStructureChange: () => { renderContents(); renderBottomNav(); } });
  idioms.attachContentsSorting(el.contentsNav);
  idiomsReady = idioms.load().then(() => true, error => {
    el.idiomList.innerHTML = `<p class="index-empty">熟語を読み込めませんでした：${h(error.message)}</p>`;
    return false;
  });
  return idioms;
}
let idiomsReady = null;
el.tabs.forEach(tab => tab.addEventListener("click", () => setView(tab.dataset.view)));

el.jumpForm.addEventListener("submit", event => {
  event.preventDefault();
  const number = el.jumpInput.value.trim();
  if (!number) return;
  closeMenus();
  if (activeView !== "list") setView("list");
  words.jumpTo(number);
});

// ---- 目次（並べ替え） ----
function renderContents() {
  if (!el.contentsMenu.classList.contains("is-open")) return;
  if (activeView === "idioms") { el.contentsNav.innerHTML = idioms?.contentsHtml?.() || ""; return; }
  if (activeView === "index") {
    el.contentsNav.innerHTML = [...el.indexList.querySelectorAll(".index-group")].map(group => `<button type="button" class="contents-section" data-index-target="${h(group.id)}"><span class="contents-item-text"><span class="contents-item-name">${h(group.querySelector(".index-letter")?.textContent || "")}</span></span></button>`).join("") || '<p class="contents-empty">索引はありません。</p>';
    return;
  }
  if (!words) return;
  const S = words.state;
  const sections = words.orderedSections();
  const parts = [];
  const noneCount = S.order.filter(item => item.sectionId == null).length;
  if (noneCount) parts.push(`<div class="contents-group"><button type="button" class="contents-section" data-nav-section="none"><span class="contents-item-text"><span class="contents-item-name">Sectionなし</span></span><span class="contents-item-count">(${noneCount})</span></button></div>`);
  for (const chapter of S.chapters) {
    const chapterSections = sections.filter(s => s.chapterId === chapter.id);
    parts.push(`<div class="contents-group" data-chapter-group="${chapter.id}">
      <div class="contents-chapter edit-toc-item" data-chapter-id="${chapter.id}" data-drag-label="${h(words.chapterName(chapter.id))}">
        <span class="edit-toc-handle" aria-label="並べ替え">⠿</span>
        <button type="button" class="edit-toc-link" data-nav-chapter="${chapter.id}"><span class="contents-item-text"><span class="contents-item-name">${h(words.chapterName(chapter.id))}</span>${chapter.subtitle ? `<span class="contents-item-subtitle">${h(chapter.subtitle)}</span>` : ""}</span></button>
      </div>
      ${chapterSections.map(section => `<div class="contents-section is-nested edit-toc-item" data-section-id="${section.id}" data-drag-label="${h(words.sectionName(section.id))}">
        <span class="edit-toc-handle" aria-label="並べ替え">⠿</span>
        <button type="button" class="edit-toc-link" data-nav-section="${section.id}"><span class="contents-item-text"><span class="contents-item-name">${h(words.sectionName(section.id))}</span>${section.subtitle ? `<span class="contents-item-subtitle">${h(section.subtitle)}</span>` : ""}</span><span class="contents-item-count">(${words.sectionCount(section.id)})</span></button>
      </div>`).join("")}
    </div>`);
  }
  const loose = sections.filter(s => s.chapterId == null || !S.chapters.some(c => c.id === s.chapterId));
  if (loose.length) parts.unshift(`<div class="contents-group">${loose.map(section => `<div class="contents-section edit-toc-item" data-section-id="${section.id}" data-drag-label="${h(words.sectionName(section.id))}"><span class="edit-toc-handle" aria-label="並べ替え">⠿</span><button type="button" class="edit-toc-link" data-nav-section="${section.id}"><span class="contents-item-text"><span class="contents-item-name">${h(words.sectionName(section.id))}</span>${section.subtitle ? `<span class="contents-item-subtitle">${h(section.subtitle)}</span>` : ""}</span><span class="contents-item-count">(${words.sectionCount(section.id)})</span></button></div>`).join("")}</div>`);
  el.contentsNav.innerHTML = parts.join("") || '<p class="contents-empty">チャプター・セクションはありません。</p>';
}

el.contentsNav.addEventListener("click", event => {
  const section = event.target.closest("[data-nav-section]");
  const chapter = event.target.closest("[data-nav-chapter]");
  const idiomSection = event.target.closest("[data-nav-idiom-section]");
  const letter = event.target.closest("[data-index-target]");
  if (!section && !chapter && !idiomSection && !letter) return;
  closeMenus();
  if (letter) return document.getElementById(letter.dataset.indexTarget)?.scrollIntoView({ block: "start" });
  if (idiomSection) return idioms?.navigateToSection(idiomSection.dataset.navIdiomSection);
  if (section) words.navigateToSection(section.dataset.navSection);
  else words.navigateToChapter(Number(chapter.dataset.navChapter));
});

// ---- 下部のSectionナビ（閲覧ページと同じ） ----
function renderBottomNav() {
  let items = [], label = "";
  if (activeView === "list" && words) { items = words.navSections().map(s => ({ key: s.key, name: s.name, title: s.subtitle, target: `section-${s.key}` })); label = "セクション"; }
  else if (activeView === "idioms" && idioms) { items = idioms.navSections().map(s => ({ key: s.key, name: s.name, title: s.subtitle, target: `idiom-section-${s.key}` })); label = "熟語のセクション"; }
  else if (activeView === "index") {
    items = [...el.indexList.querySelectorAll(".index-group")].map(group => ({ key: group.id, name: group.querySelector(".index-letter")?.textContent || "", target: group.id }));
    label = "索引の頭文字";
  }
  if (!items.length) {
    el.sectionNav.hidden = true;
    el.sectionNav.innerHTML = "";
    document.body.classList.remove("has-section-nav");
    return;
  }
  el.sectionNav.hidden = false;
  el.sectionNav.setAttribute("aria-label", label);
  el.sectionNav.innerHTML = items.map(item => `<button type="button" data-nav-key="${h(item.key)}" data-nav-target="${h(item.target)}"${item.title ? ` title="${h(item.title)}"` : ""}>${h(item.name)}</button>`).join("");
  document.body.classList.add("has-section-nav");
  updateActiveNav();
}
// 画面の中ほど（上から45%）より上にある最後の見出しのボタンを強調する。見出しが描き直されても追従する。
let activeNavFrame = 0;
function updateActiveNav() {
  activeNavFrame = 0;
  if (el.sectionNav.hidden) return;
  const buttons = [...el.sectionNav.querySelectorAll("button[data-nav-target]")];
  const line = innerHeight * 0.45;
  let current = buttons[0];
  for (const button of buttons) {
    const target = document.getElementById(button.dataset.navTarget);
    if (!target || !target.offsetParent) continue;
    if (target.getBoundingClientRect().top <= line) current = button; else break;
  }
  for (const button of buttons) {
    const active = button === current;
    if (button.classList.contains("active") === active) continue;
    button.classList.toggle("active", active);
    if (active) el.sectionNav.scrollTo({ left: button.offsetLeft - el.sectionNav.clientWidth / 2 + button.offsetWidth / 2 });
  }
}
addEventListener("scroll", () => { if (!activeNavFrame) activeNavFrame = requestAnimationFrame(updateActiveNav); }, { passive: true });
el.sectionNav.addEventListener("click", async event => {
  const button = event.target.closest("button[data-nav-key]");
  if (!button) return;
  button.setAttribute("aria-busy", "true");
  try {
    if (activeView === "list") await words.navigateToSection(button.dataset.navKey);
    else if (activeView === "idioms") await idioms.navigateToSection(button.dataset.navKey);
    else document.getElementById(button.dataset.navTarget)?.scrollIntoView({ block: "start" });
  } finally { button.removeAttribute("aria-busy"); }
});

// ---- 索引（閲覧ページと同じ並び。タップでその単語・熟語へ移動して選択する） ----
let indexSource = null;
async function renderIndex() {
  if (!words) return;
  if (!el.indexList.childElementCount) el.indexList.innerHTML = '<p class="index-empty">索引を読み込み中...</p>';
  try {
    // 類義語・派生語などの参照は、閲覧ページの公開索引（端末にキャッシュ済みのことが多い）から作る。
    indexSource ||= fetch(`${VIEWER_API_BASE}/api/lists/${encodeURIComponent(listId)}/viewer/index`, { cache: "no-cache" }).then(r => r.ok ? r.json() : { words: [] }).catch(() => ({ words: [] }));
    const source = await indexSource;
    if (idiomsReady) await idiomsReady;
    const byId = new Map((source.words || []).map(w => [w.id, w]));
    const indexWords = words.state.order.map(item => ({ ...(byId.get(item.id) || {}), id: item.id, spelling: item.spelling, branch: item.branch, seqNo: words.seqOf(item.id) }));
    const entries = buildAlphabeticalIndexEntries(indexWords, idioms?.visibleEntries?.() || []);
    const groups = [];
    for (const entry of entries) {
      const letter = (getAlphabeticalIndexKey(entry.spelling)[0] || "").toUpperCase();
      if (groups.at(-1)?.letter !== letter) groups.push({ letter, items: [] });
      groups.at(-1).items.push(entry);
    }
    el.indexList.innerHTML = groups.length ? groups.map((group, index) => `<div class="index-group" id="index-group-${index}" data-index-key="${index}"><h2 class="index-letter">${h(group.letter)}</h2><div class="index-columns">${group.items.map(e => `<div class="index-entry index-kind-${e.kind}${e.isRef ? " is-ref" : ""}" data-index-jump="${h(e.targetId)}" data-kind="${e.kind}"><span class="index-word">${h(e.spelling)}</span><span class="index-loc"${e.isRef ? ` title="${h(e.loc)}"` : ""}>${h(e.loc)}</span></div>`).join("")}</div></div>`).join("") : '<p class="index-empty">単語がまだ登録されていません。</p>';
    if (activeView === "index") { renderBottomNav(); renderContents(); }
  } catch (error) {
    el.indexList.innerHTML = `<p class="index-empty">索引を読み込めませんでした：${h(error.message)}</p>`;
  }
}
el.indexList.addEventListener("click", event => {
  const item = event.target.closest("[data-index-jump]");
  if (!item) return;
  if (item.dataset.kind === "idiom") { setView("idioms"); idiomsReady?.then(() => idioms.navigateToEntry(item.dataset.indexJump)); }
  else { setView("list"); words.navigateToWord(item.dataset.indexJump); }
});

// ---- 検索（見出し語は即時表示し、本文・熟語の結果を同じシートに追加） ----
el.searchForm.addEventListener("submit", event => {
  event.preventDefault();
  const label = el.searchInput.value.trim();
  const query = label.toLowerCase();
  if (!query) return;
  if (!words?.state.list) { toast("単語を読み込んでから検索してください"); return; }
  closeMenus();

  const controller = new AbortController();
  const order = words.state.order;
  const allWordHits = order.filter(item => item.spelling.toLowerCase().includes(query));
  const localIds = new Set(allWordHits.map(item => item.id));
  const byId = new Map(order.map(item => [item.id, item]));
  const list = document.createElement("div");
  list.className = "edit-menu-list";
  const fullText = document.createComment("本文検索結果");
  const idiomList = document.createComment("熟語検索結果");
  list.append(fullText, idiomList);

  const add = (label, sub, onSelect, before) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "edit-menu-item";
    button.innerHTML = `<span>${h(label)}</span><small class="edit-hint">${h(sub)}</small>`;
    button.addEventListener("click", () => { closeSheet(); onSelect(); });
    list.insertBefore(button, before);
  };
  const addWord = (hit, note, before) => add(hit.spelling, `No. ${words.seqOf(hit.id)}${note}`, () => { setView("list"); words.navigateToWord(hit.id); }, before);
  for (const hit of allWordHits.slice(0, 50)) addWord(hit, "", fullText);

  const status = document.createElement("p");
  status.className = "edit-hint";
  status.setAttribute("role", "status");
  status.textContent = "本文と熟語を検索中…";
  sheet(`「${label}」の検索結果`, body => body.append(list, status), { onClose: () => controller.abort() });
  const { signal } = controller;
  let pending = 2;
  const failed = [];
  const finish = (source, ok) => {
    if (signal.aborted) return;
    if (!ok) failed.push(source);
    if (--pending) return;
    status.textContent = failed.length ? `${failed.join("・")}を検索できませんでした。` : list.childElementCount ? "" : "見つかりませんでした。";
    status.hidden = !status.textContent;
  };

  const url = `${VIEWER_API_BASE}/api/lists/${encodeURIComponent(listId)}/viewer/search?q=${encodeURIComponent(query)}`;
  fetch(url, { signal }).then(async response => {
    if (!response.ok) throw new Error("Full-text search failed");
    const { matches } = await response.json();
    if (signal.aborted) return;
    const ids = new Set((matches || []).map(hit => hit.wordId).filter(id => byId.has(id) && !localIds.has(id)));
    for (const id of [...ids].slice(0, 50)) addWord(byId.get(id), "（本文に一致）", fullText);
    finish("本文", true);
  }).catch(() => finish("本文", false));

  ensureIdioms();
  idiomsReady.then(loaded => {
    if (signal.aborted) return;
    if (loaded) {
      const hits = idioms.state.order.filter(item => [item.phrase, ...(item.alternateForms || [])].some(text => String(text).toLowerCase().includes(query)));
      for (const hit of hits.slice(0, 50)) {
        add(hit.phrase, hit.hidden ? "熟語（非表示）" : "熟語", () => { setView("idioms"); idioms.navigateToEntry(hit.key); }, idiomList);
      }
    }
    finish("熟語", loaded);
  }).catch(() => finish("熟語", false));
});

sortable(el.contentsNav, {
  handleSelector: '[data-section-id] > .edit-toc-handle',
  itemSelector: "[data-section-id], [data-chapter-id]",
  idOf: item => item.dataset.sectionId ? `s:${item.dataset.sectionId}` : `c:${item.dataset.chapterId}`,
  canDrag: () => activeView === "list",
  onDrop: (id, targetId, before) => {
    const sectionId = Number(id.slice(2));
    const order = words.orderedSections().map(s => ({ ...s }));
    const moving = order.find(s => s.id === sectionId);
    const rest = order.filter(s => s.id !== sectionId);
    if (targetId.startsWith("c:")) {
      // Chapter見出しへ落としたら、そのChapterの先頭へ入れる。
      const chapterId = Number(targetId.slice(2));
      const first = rest.find(s => s.chapterId === chapterId);
      moving.chapterId = chapterId;
      moving.groupId = first?.groupId ?? null;
      const index = first ? rest.indexOf(first) : rest.filter(s => (words.chapterById(s.chapterId)?.sortOrder ?? -1) <= (words.chapterById(chapterId)?.sortOrder ?? -1)).length;
      rest.splice(index, 0, moving);
    } else {
      const target = rest.find(s => s.id === Number(targetId.slice(2)));
      moving.chapterId = target.chapterId ?? null;
      moving.groupId = target.groupId ?? null;
      rest.splice(rest.indexOf(target) + (before ? 0 : 1), 0, moving);
    }
    words.saveSectionOrder(rest).then(renderContents);
    renderContents();
  },
});
sortable(el.contentsNav, {
  handleSelector: '[data-chapter-id] > .edit-toc-handle',
  itemSelector: "[data-chapter-id]",
  idOf: item => item.dataset.chapterId,
  canDrag: () => activeView === "list",
  onDrop: (id, targetId, before) => {
    const order = [...words.state.chapters];
    const moving = order.find(c => c.id === Number(id));
    const rest = order.filter(c => c !== moving);
    const target = rest.find(c => c.id === Number(targetId));
    rest.splice(rest.indexOf(target) + (before ? 0 : 1), 0, moving);
    words.saveChapterOrder(rest).then(renderContents);
    renderContents();
  },
});

async function start() {
  el.wordList.innerHTML = '<div class="loading-msg" role="status"><span class="loading-label">読み込み中...</span></div>';
  resumePublicationWatch();
  // 閲覧ページと同じく、画面に近づいたイラストから読み込む。
  setupIllustrationLoading(el.wordList);
  setupIllustrationLoading(el.idiomList);
  try {
    const catalog = api("/lists");
    const structure = requestWordStructure(LIST_ID_FALLBACK);
    const lists = await catalog;
    const crossover = lists.find(l => l.id === LIST_ID_FALLBACK) || lists.find(l => l.name?.trim().toLowerCase() === "crossover");
    if (!crossover) throw new Error("crossoverの単語帳が見つかりません");
    listId = crossover.id;
    words = createWordEditor({ root: el.wordList, listId, onStructureChange: () => { renderContents(); renderBottomNav(); } });
    const position = readingPosition("editor", listId, el.wordList, () => activeView === "list");
    await words.load(crossover, { position: position.saved, structure: listId === LIST_ID_FALLBACK ? structure : null });
    position.start();
  } catch (error) {
    el.wordList.innerHTML = `<p class="index-empty">読み込めませんでした：${h(error.message)} <button type="button" id="reloadPage">再読み込み</button></p>`;
    document.getElementById("reloadPage")?.addEventListener("click", () => location.reload());
  }
}
start();

