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

// Safariではviewportの指定だけではピンチできるため、編集画面で拡大・縮小のジェスチャーを止める。
for (const type of ["gesturestart", "gesturechange"]) {
  addEventListener(type, event => event.preventDefault(), { passive: false });
}

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
  // 保存（DB）と閲覧ページへの反映は別。保存はできているので、反映待ちは注意表示にとどめる（DESIGN.md）。
  el.publishStatus.title = "保存は完了しています。閲覧ページへの反映を待っています。";
  if (status.state === "publishing") {
    el.publishStatus.hidden = false;
    el.publishStatus.className = "edit-publish-status is-publishing";
    el.publishStatus.textContent = "閲覧ページに反映中";
  } else if (status.state === "idle") {
    el.publishStatus.hidden = true;
  } else if (status.state === "published") {
    el.publishStatus.hidden = true;
    toast("閲覧ページに反映しました");
  } else if (status.state === "failed") {
    el.publishStatus.hidden = false;
    el.publishStatus.className = "edit-publish-status is-slow";
    el.publishStatus.textContent = "閲覧ページへの反映に時間がかかっています";
    el.publishStatus.title = `保存は完了しています。閲覧ページへの反映を確認できていません（${status.message}）。しばらくすると反映されます。`;
  }
});

// ---- 反映の状況（閲覧ページを作る処理の状態を見て、やり直せるようにする） ----
const timeText = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
};
function publicationSummary(status) {
  const rows = [];
  if (status.enabled === false) return [["状態", "この環境では閲覧ページの自動作成を使っていません"]];
  // 前回の公開が終わっていても、未反映の変更か予定された処理があれば、まだ反映していない。
  const waiting = status.state === "ready" && (status.pendingEdits > 0 || !!status.scheduledAt);
  if (waiting) rows.push(["状態", "反映待ち"], ["前回反映した時刻", timeText(status.generatedAt)]);
  else if (status.state === "ready") rows.push(["状態", "反映済み"], ["最後に反映した時刻", timeText(status.generatedAt)]);
  else if (status.state === "building") rows.push(["状態", status.remainingChapters ? `作成中（残り${status.remainingChapters}Chapter）` : "作成中"], ["最後に進んだ時刻", timeText(status.updatedAt)]);
  else if (status.state === "failed") rows.push(["状態", `うまく作れていません（${status.failures || 1}回目）`], ["理由", status.error || "不明"]);
  else if (status.state === "busy") rows.push(["状態", "作成中（いま処理していて、詳しい状態を返せません）"]);
  else rows.push(["状態", "まだ一度も作成していません"]);
  if (status.publishedAt && status.state !== "ready") rows.push(["閲覧ページを最後に更新した時刻", timeText(status.publishedAt)]);
  if (status.pendingEdits != null) rows.push(["まだ反映していない変更", `${status.pendingEdits}件`]);
  if (status.scheduledAt && (waiting || status.state !== "ready")) rows.push(["次に試す時刻", timeText(status.scheduledAt)]);
  return rows.filter(([, value]) => value);
}
function openPublicationSheet() {
  closeMenus();
  sheet("閲覧ページへの反映", body => {
    const list = document.createElement("dl");
    list.className = "edit-publication-info";
    list.setAttribute("role", "status");
    list.innerHTML = '<div><dt>状態</dt><dd>確認しています…</dd></div>';
    const note = document.createElement("p");
    note.className = "edit-hint";
    note.textContent = "保存した内容は、この処理で閲覧ページに反映されます。止まっているときは「反映をやり直す」を押してください。";
    const footer = document.createElement("div");
    footer.className = "edit-sheet-actions";
    const close = document.createElement("button");
    close.type = "button"; close.className = "edit-btn"; close.textContent = "閉じる";
    close.addEventListener("click", closeSheet);
    const retry = document.createElement("button");
    retry.type = "button"; retry.className = "edit-btn is-primary"; retry.textContent = "反映をやり直す";
    footer.append(close, retry);
    body.append(list, note, footer);
    const show = status => {
      list.innerHTML = publicationSummary(status).map(([label, value]) => `<div><dt>${h(label)}</dt><dd>${h(value)}</dd></div>`).join("");
    };
    const load = async (method = "GET") => {
      retry.disabled = true;
      try { show(await api("/viewer-publication", method === "GET" ? {} : { method })); }
      catch (error) { list.innerHTML = `<div><dt>状態</dt><dd>${h(`確認できませんでした：${error.message}`)}</dd></div>`; }
      finally { retry.disabled = false; }
    };
    retry.addEventListener("click", async () => {
      await load("POST");
      toast("閲覧ページへの反映をやり直しています");
      resumePublicationWatch();
    });
    load();
  });
}
document.getElementById("publicationInfoBtn")?.addEventListener("click", openPublicationSheet);
el.publishStatus.addEventListener("click", openPublicationSheet);

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
  if (view === "idioms") ensureIdioms();
  if (view === "index") renderIndex();
  renderContents();
  renderBottomNav();
}
let idiomsReady = null;
function ensureIdioms() {
  if (!words?.state.list) return Promise.resolve(false);
  if (!idioms) {
    idioms = createIdiomEditor({ root: el.idiomList, listId, onStructureChange: () => { renderContents(); renderBottomNav(); } });
    idioms.attachContentsSorting(el.contentsNav);
  }
  // The editor owns listeners and draft state; only retry its failed read.
  idiomsReady ||= idioms.load().then(() => true, error => {
    idiomsReady = null;
    el.idiomList.innerHTML = `<p class="index-empty">熟語を読み込めませんでした：${h(error.message)} <button type="button" data-retry-idioms>再試行</button></p>`;
    return false;
  });
  return idiomsReady;
}
el.idiomList.addEventListener("click", event => {
  if (event.target.closest("[data-retry-idioms]")) ensureIdioms();
});
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
let indexRender = 0;
function loadIndexSource() {
  // Keep successful reads (including a genuinely empty index), not failures.
  indexSource ||= fetch(`${VIEWER_API_BASE}/api/lists/${encodeURIComponent(listId)}/viewer/index`, { cache: "no-cache" }).then(async response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const source = await response.json();
    if (!Array.isArray(source?.words)) throw new Error("索引データが不正です");
    return source;
  }).catch(() => {
    indexSource = null;
    return null;
  });
  return indexSource;
}
async function renderIndex() {
  if (!words?.state.list) return;
  const render = ++indexRender;
  if (!el.indexList.childElementCount) el.indexList.innerHTML = '<p class="index-empty">索引を読み込み中...</p>';
  try {
    const [source, idiomsLoaded] = await Promise.all([loadIndexSource(), ensureIdioms()]);
    if (render !== indexRender || activeView !== "index") return;
    const byId = new Map((source?.words || []).map(w => [w.id, w]));
    const indexWords = words.state.order.map(item => ({ ...(byId.get(item.id) || {}), id: item.id, spelling: item.spelling, branch: item.branch, seqNo: words.seqOf(item.id) }));
    const entries = buildAlphabeticalIndexEntries(indexWords, idiomsLoaded ? idioms.visibleEntries() : []);
    const groups = [];
    for (const entry of entries) {
      const letter = (getAlphabeticalIndexKey(entry.spelling)[0] || "").toUpperCase();
      if (groups.at(-1)?.letter !== letter) groups.push({ letter, items: [] });
      groups.at(-1).items.push(entry);
    }
    const warning = source && idiomsLoaded ? "" : '<p class="index-empty" role="status">索引の一部を読み込めませんでした。 <button type="button" data-retry-index>再試行</button></p>';
    const content = groups.length ? groups.map((group, index) => `<div class="index-group" id="index-group-${index}" data-index-key="${index}"><h2 class="index-letter">${h(group.letter)}</h2><div class="index-columns">${group.items.map(e => `<div class="index-entry index-kind-${e.kind}${e.isRef ? " is-ref" : ""}" data-index-jump="${h(e.targetId)}" data-kind="${e.kind}"><span class="index-word">${h(e.spelling)}</span><span class="index-loc"${e.isRef ? ` title="${h(e.loc)}"` : ""}>${h(e.loc)}</span></div>`).join("")}</div></div>`).join("") : warning ? "" : '<p class="index-empty">単語がまだ登録されていません。</p>';
    el.indexList.innerHTML = warning + content;
    renderBottomNav(); renderContents();
  } catch (error) {
    if (render !== indexRender || activeView !== "index") return;
    el.indexList.innerHTML = `<p class="index-empty">索引を読み込めませんでした：${h(error.message)}</p>`;
  }
}
el.indexList.addEventListener("click", event => {
  if (event.target.closest("[data-retry-index]")) { renderIndex(); return; }
  const item = event.target.closest("[data-index-jump]");
  if (!item) return;
  if (item.dataset.kind === "idiom") { setView("idioms"); idiomsReady?.then(loaded => { if (loaded && activeView === "idioms") idioms.navigateToEntry(item.dataset.indexJump); }); }
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

  ensureIdioms().then(loaded => {
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
    if (activeView === "idioms") ensureIdioms();
    if (activeView === "index") renderIndex();
  } catch (error) {
    el.wordList.innerHTML = `<p class="index-empty">読み込めませんでした：${h(error.message)} <button type="button" id="reloadPage">再読み込み</button></p>`;
    document.getElementById("reloadPage")?.addEventListener("click", () => location.reload());
  }
}
start();

