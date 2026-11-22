// 閲覧型編集ページの起動・メニュー・目次・タブ。
import { createWordEditor } from "./words.js";
import { createIdiomEditor } from "./idioms.js";
import { api, onPublication, resumePublicationWatch } from "./api.js";
import { h, toast, sortable } from "./ui.js";

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
  for (const panel of [el.wordList, el.idiomList]) {
    const active = panel.dataset.viewPanel === view;
    panel.classList.toggle("is-active", active);
    panel.setAttribute("aria-hidden", String(!active));
  }
  for (const tab of el.tabs) {
    tab.setAttribute("aria-selected", String(tab.dataset.view === view));
    tab.tabIndex = tab.dataset.view === view ? 0 : -1;
  }
  if (view === "idioms" && !idioms) {
    idioms = createIdiomEditor({ root: el.idiomList, listId, onStructureChange: renderContents });
    idioms.attachContentsSorting(el.contentsNav);
    idioms.load().catch(error => { el.idiomList.innerHTML = `<p class="index-empty">熟語を読み込めませんでした：${h(error.message)}</p>`; });
  }
  renderContents();
}
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
  if (!section && !chapter && !idiomSection) return;
  closeMenus();
  if (idiomSection) return idioms?.scrollToSection(idiomSection.dataset.navIdiomSection);
  if (section) words.scrollToSection(section.dataset.navSection);
  else words.scrollToChapter(Number(chapter.dataset.navChapter));
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
  resumePublicationWatch();
  try {
    const lists = await api("/lists");
    const crossover = lists.find(l => l.id === LIST_ID_FALLBACK) || lists.find(l => l.name?.trim().toLowerCase() === "crossover");
    if (!crossover) throw new Error("crossoverの単語帳が見つかりません");
    listId = crossover.id;
    words = createWordEditor({ root: el.wordList, listId, onStructureChange: renderContents });
    await words.load();
  } catch (error) {
    el.wordList.innerHTML = `<p class="index-empty">読み込めませんでした：${h(error.message)} <button type="button" id="reloadPage">再読み込み</button></p>`;
    document.getElementById("reloadPage")?.addEventListener("click", () => location.reload());
  }
}
start();
