// 閲覧型編集ページの共通部品（トースト・シート・その場の入力欄・ダブルタップ・ドラッグ）。
import { escapeHtml } from "../../shared/markup.js";

export const h = escapeHtml;

// ---- トースト（「元に戻す」付き） ----
let toastTimer = null;
export function toast(message, { undo = null, duration = 5000, tone = "" } = {}) {
  let el = document.getElementById("editToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "editToast";
    el.className = "edit-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.append(el);
  }
  el.replaceChildren();
  el.className = `edit-toast${tone ? ` is-${tone}` : ""}`;
  const text = document.createElement("span");
  text.textContent = message;
  el.append(text);
  if (undo) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "元に戻す";
    button.addEventListener("click", () => { el.hidden = true; undo(); });
    el.append(button);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, duration);
}

// ---- 編集モーダル ----
let openSheetEl = null;
// iPhoneのソフトキーボードが開くと、画面の見えている範囲だけが縮む。
function fitSheetToViewport() {
  const viewport = window.visualViewport;
  if (!openSheetEl || !viewport) return;
  const { style } = openSheetEl.overlay;
  style.top = `${viewport.offsetTop}px`;
  style.height = `${viewport.height}px`;
}
window.visualViewport?.addEventListener("resize", fitSheetToViewport);
window.visualViewport?.addEventListener("scroll", fitSheetToViewport);

// ダイアログ・メニュー・選択肢が開いているか（開いている間は、項目の内容を裏で差し替えない）。
export function isSheetOpen() { return !!openSheetEl; }
export function closeSheet() {
  if (!openSheetEl) return;
  const sheet = openSheetEl;
  openSheetEl = null;
  try {
    sheet.onClose?.();
  } finally {
    const current = document.activeElement;
    sheet.overlay.remove();
    if (!openSheetEl && (current === document.body || sheet.overlay.contains(current))) {
      sheet.restoreOpener()?.focus({ preventScroll: true });
    }
  }
}
export function sheet(title, build, { onClose, wide = false, accent = "default" } = {}) {
  closeSheet();
  const opener = document.activeElement;
  const openerArticleId = opener?.closest("article[id]")?.id;
  const openerAction = opener?.dataset.op;
  const restoreOpener = () => {
    if (opener?.isConnected) return opener;
    // A tile toggle can redraw the card and replace the button that opened it.
    if (!openerArticleId || !openerAction) return null;
    const matches = document.getElementById(openerArticleId)
      ?.querySelectorAll(`button[data-op="${CSS.escape(openerAction)}"]`);
    return matches?.length === 1 ? matches[0] : null;
  };
  const overlay = document.createElement("div");
  overlay.className = "edit-sheet-overlay";
  const panel = document.createElement("div");
  panel.className = `edit-sheet${wide ? " is-wide" : ""}`;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", title);
  panel.setAttribute("aria-modal", "true");
  panel.tabIndex = -1;
  const header = document.createElement("div");
  header.className = "edit-sheet-header";
  const heading = document.createElement("h2");
  const mark = document.createElement("span");
  mark.className = "edit-title-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "●";
  mark.dataset.accent = accent;
  // Note block text uses the badge foreground in both themes.
  if (["derivative", "irregular", "etymology", "synonym", "antonym", "related", "memo"].includes(accent)) {
    mark.classList.add("notes-block", `notes-${accent}`);
  }
  heading.append(mark, title);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "edit-sheet-close";
  close.setAttribute("aria-label", "閉じる");
  close.textContent = "✕";
  close.addEventListener("click", closeSheet);
  header.append(heading, close);
  const body = document.createElement("div");
  body.className = "edit-sheet-body";
  const actions = document.createElement("div");
  actions.className = "edit-sheet-actions";
  panel.append(header, body, actions);
  overlay.append(panel);
  overlay.addEventListener("click", event => { if (event.target === overlay) closeSheet(); });
  document.body.append(overlay);
  openSheetEl = { overlay, panel, restoreOpener, onClose };
  fitSheetToViewport();
  build(body, panel, actions);
  if (openSheetEl?.panel === panel && !panel.contains(document.activeElement)) {
    close.focus({ preventScroll: true });
  }
  return body;
}
document.addEventListener("keydown", event => {
  const panel = openSheetEl?.panel;
  if (!panel || event.defaultPrevented || event.isComposing) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeSheet();
    return;
  }
  if (event.key !== "Tab") return;

  const elements = panel.querySelectorAll("a[href], button, input, select, textarea, [tabindex]");
  const stops = Array.from(elements).filter(el => el.tabIndex >= 0 && !el.matches(":disabled") &&
    el.getClientRects().length && getComputedStyle(el).visibility === "visible");
  const first = stops[0], last = stops.at(-1), active = document.activeElement;
  if (!first || !stops.includes(active) || active === (event.shiftKey ? first : last)) {
    event.preventDefault();
    (event.shiftKey ? last ?? panel : first ?? panel).focus({ preventScroll: true });
  }
});

// タイル（バッジの付け外し・選択）
export function tiles(container, title, items, { columns = 4 } = {}) {
  if (title) {
    const heading = document.createElement("h3");
    heading.className = "edit-tiles-title";
    heading.textContent = title;
    container.append(heading);
  }
  const grid = document.createElement("div");
  grid.className = "edit-tiles";
  grid.style.setProperty("--tile-columns", String(columns));
  for (const [index, item] of items.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `edit-tile${item.active ? " is-active" : ""}${item.className ? ` ${item.className}` : ""}`;
    button.setAttribute("aria-pressed", String(!!item.active));
    button.innerHTML = item.html || h(item.label);
    if (item.title) button.title = item.title;
    if (item.disabled) button.disabled = true;
    button.addEventListener("click", () => {
      // Some pickers rebuild all tiles after a selection. Keep keyboard focus
      // on the equivalent tile instead of dropping it onto the page.
      const focused = document.activeElement === button;
      const currentSheet = openSheetEl;
      const gridIndex = Array.from(container.querySelectorAll(".edit-tiles")).indexOf(grid);
      item.onSelect(button);
      if (focused && !button.isConnected && currentSheet && currentSheet === openSheetEl &&
          document.activeElement === document.body) {
        container.querySelectorAll(".edit-tiles")[gridIndex]?.children[index]?.focus({ preventScroll: true });
      }
    });
    grid.append(button);
  }
  container.append(grid);
  return grid;
}

export function menuList(container, items) {
  const list = document.createElement("div");
  list.className = "edit-menu-list";
  for (const item of items) {
    if (!item) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `edit-menu-item${item.danger ? " is-danger" : ""}`;
    button.innerHTML = `${item.icon ? `<i class="fa-solid ${item.icon}" aria-hidden="true"></i>` : ""}<span>${h(item.label)}</span>`;
    if (item.disabled) button.disabled = true;
    button.addEventListener("click", () => { closeSheet(); item.onSelect(); });
    list.append(button);
  }
  container.append(list);
}

// テキスト編集モーダル。対象の行を記録し、編集中の再描画を防ぐ。
let activeInline = null;
export function isInlineEditing() { return !!activeInline; }
// 入力中の欄がelの中にあるか（保存完了などで描き直すと、入力途中の文字が消えるため）。
export function hasActiveInlineIn(el) { return !!activeInline && !!el?.contains(activeInline.wrapper); }
export function finishInlineEditing() { activeInline?.commit(); }

export function inlineEditor(target, value, { multiline = false, placeholder = "", onCommit, onCancel } = {}) {
  let accepted = false;
  const field = target.dataset.edit?.split(".").at(-1);
  const labels = { spelling: "見出し語", phrase: "熟語", pronunciation: "発音記号", notes: "メモ", meaning: "意味", word: "派生語", derivativeWord: "派生語", alternateForms: "別形", etymology: "語源", synonyms: "類義語", antonyms: "対義語", irregularForms: "不規則変化", relatedWords: "関連語" };
  const accents = { notes: "memo", synonyms: "synonym", antonyms: "antonym", relatedWords: "related", irregularForms: "irregular", etymology: "etymology", phrase: "examples", meaning: "senses" };
  const title = labels[field] || placeholder || "テキスト編集";
  sheet(title, (body, _panel, actions) => {
    body.innerHTML = '<textarea class="edit-text-input edit-inline-input" rows="4"></textarea>';
    actions.innerHTML = '<button type="button" class="edit-btn" data-cancel>キャンセル</button><button type="button" class="edit-btn is-primary primary">決定</button>';
    const input = body.querySelector("textarea");
    input.setAttribute("aria-label", title);
    input.value = value;
    input.placeholder = placeholder;
    const commit = () => {
      accepted = true;
      closeSheet();
      onCommit(input.value);
    };
    activeInline = { wrapper: target, commit };
    input.addEventListener("keydown", event => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter" && (!multiline || event.ctrlKey || event.metaKey)) {
        event.preventDefault(); commit();
      }
    });
    actions.querySelector(".primary").onclick = commit;
    actions.querySelector("[data-cancel]").onclick = closeSheet;
    input.focus();
    input.setSelectionRange(value.length, value.length);
  }, { accent: accents[field], onClose: () => { activeInline = null; if (!accepted) onCancel?.(); } });
}

// ---- ダブルタップ・ダブルクリック ----
// 1回目のタップで再描画されても判定できるよう、要素ではなく位置と時間で判定する。
export function onDoubleActivate(root, handler) {
  let last = null, consumedTouch = false;
  root.addEventListener("pointerdown", () => { consumedTouch = false; }, true);
  // A touch double-tap can replace the label with a focused input before the
  // compatibility mouse events arrive. Keep those events from blurring it.
  root.addEventListener("touchend", event => { if (consumedTouch) event.preventDefault(); }, { passive: false });
  for (const type of ["mousedown", "click"]) {
    root.addEventListener(type, event => {
      if (!consumedTouch || event.detail === 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (type === "click") consumedTouch = false;
    }, true);
  }
  root.addEventListener("pointerup", event => {
    if (event.button > 0) return;
    const now = performance.now();
    const limit = event.pointerType === "mouse" ? 450 : 320;
    const entry = event.target.closest(".entry[data-word-id]");
    const wordId = entry?.dataset.wordId;
    if (last && last.wordId === wordId && now - last.time < limit && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 30) {
      last = null;
      const target = document.elementFromPoint(event.clientX, event.clientY) || event.target;
      if (!root.contains(target)) return;
      if (event.pointerType === "touch" && target.closest("[data-edit], [data-edit-header]") && !target.closest("button, a, .edit-inline")) {
        consumedTouch = true;
      }
      handler(event, target);
      if (event.pointerType !== "mouse") event.preventDefault();
      return;
    }
    last = { time: now, x: event.clientX, y: event.clientY, wordId };
  });
}

// ---- ドラッグで並べ替え ----
// handleSelector: つかむ部分。itemSelector: 並べ替える要素。touchは長押しで開始する。
export function sortable(root, { handleSelector, itemSelector, canDrag = () => true, canDrop = () => true, onDrop, idOf, signal, scrollElement = window }) {
  const LONG_PRESS = 380;
  let pending = null, drag = null;
  const clearPending = () => { if (pending) { clearTimeout(pending.timer); pending = null; } };

  root.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const handle = event.target.closest(handleSelector);
    if (!handle || !root.contains(handle)) return;
    const item = handle.closest(itemSelector);
    if (!item || !canDrag(item)) return;
    const start = () => begin(item, event);
    if (event.pointerType === "mouse") {
      pending = { x: event.clientX, y: event.clientY, item, mouse: true, start };
    } else {
      pending = { x: event.clientX, y: event.clientY, item, timer: setTimeout(() => { pending = null; start(); }, LONG_PRESS) };
    }
  });

  window.addEventListener("pointermove", event => {
    if (pending) {
      const moved = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);
      if (pending.mouse && moved > 6) { const start = pending.start; pending = null; start(); }
      else if (!pending.mouse && moved > 10) clearPending();
    }
    if (!drag) return;
    event.preventDefault();
    move(event.clientX, event.clientY);
  }, { passive: false, signal });
  window.addEventListener("pointerup", () => { clearPending(); if (drag) finish(true); }, { signal });
  window.addEventListener("pointercancel", () => { clearPending(); if (drag) finish(false); }, { signal });
  signal?.addEventListener("abort", () => { clearPending(); if (drag) finish(false); }, { once: true });
  root.addEventListener("touchmove", event => { if (drag) event.preventDefault(); }, { passive: false });
  root.addEventListener("contextmenu", event => { if (drag || pending) event.preventDefault(); });

  function begin(item, event) {
    const ghost = document.createElement("div");
    ghost.className = "edit-drag-ghost";
    ghost.textContent = item.dataset.dragLabel || item.textContent.trim().slice(0, 40);
    document.body.append(ghost);
    const line = document.createElement("div");
    line.className = "edit-drop-line";
    document.body.append(line);
    drag = { item, ghost, line, target: null, before: true, lastX: event.clientX, lastY: event.clientY, scrollTimer: null };
    item.classList.add("is-dragging");
    document.body.classList.add("is-edit-dragging");
    navigator.vibrate?.(15);
    move(event.clientX, event.clientY);
  }

  function move(x, y) {
    drag.lastX = x;
    drag.lastY = y;
    drag.ghost.style.transform = `translate(${x + 12}px, ${y - 18}px)`;
    updateDropTarget();
    autoScroll();
  }

  function updateDropTarget() {
    const { lastX: x, lastY: y } = drag;
    drag.ghost.style.display = "none";
    const under = document.elementFromPoint(x, y);
    drag.ghost.style.display = "";
    const target = under?.closest(itemSelector);
    if (target && target !== drag.item && root.contains(target) && canDrop(drag.item, target)) {
      const rect = target.getBoundingClientRect();
      drag.target = target;
      drag.before = y < rect.top + rect.height / 2;
      drag.line.style.display = "block";
      drag.line.style.left = `${rect.left}px`;
      drag.line.style.width = `${rect.width}px`;
      drag.line.style.top = `${(drag.before ? rect.top : rect.bottom) - 2}px`;
    } else {
      drag.target = null;
      drag.line.style.display = "none";
    }
  }

  function autoScroll() {
    clearInterval(drag.scrollTimer);
    const edge = 70;
    const bounds = scrollElement === window ? { top: 0, bottom: innerHeight } : scrollElement.getBoundingClientRect();
    const speed = drag.lastY < bounds.top + edge ? (drag.lastY - bounds.top - edge) / 3 : Math.max(0, drag.lastY - bounds.bottom + edge) / 3;
    if (!speed) return;
    drag.scrollTimer = setInterval(() => {
      if (!drag) return;
      const scrollPosition = () => scrollElement === window ? window.scrollY : scrollElement.scrollTop;
      const previousTop = scrollPosition();
      scrollElement.scrollBy({ top: speed, behavior: "instant" });
      // While the pointer stays in the edge, rows move under it without pointermove.
      if (scrollPosition() !== previousTop) updateDropTarget();
    }, 16);
  }

  function finish(commit) {
    if (commit) updateDropTarget();
    const { item, ghost, line, target, before, scrollTimer } = drag;
    clearInterval(scrollTimer);
    ghost.remove();
    line.remove();
    item.classList.remove("is-dragging");
    document.body.classList.remove("is-edit-dragging");
    drag = null;
    if (commit && target) onDrop(idOf(item), idOf(target), before, { item, target });
  }
}


