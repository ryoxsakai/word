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

// ---- 下から出るシート ----
let openSheetEl = null;
export function closeSheet() {
  if (!openSheetEl) return;
  const sheet = openSheetEl;
  openSheetEl = null;
  sheet.onClose?.();
  sheet.overlay.remove();
}
export function sheet(title, build, { onClose, wide = false } = {}) {
  closeSheet();
  const overlay = document.createElement("div");
  overlay.className = "edit-sheet-overlay";
  const panel = document.createElement("div");
  panel.className = `edit-sheet${wide ? " is-wide" : ""}`;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", title);
  const header = document.createElement("div");
  header.className = "edit-sheet-header";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "edit-sheet-close";
  close.setAttribute("aria-label", "閉じる");
  close.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
  close.addEventListener("click", closeSheet);
  header.append(heading, close);
  const body = document.createElement("div");
  body.className = "edit-sheet-body";
  panel.append(header, body);
  overlay.append(panel);
  overlay.addEventListener("click", event => { if (event.target === overlay) closeSheet(); });
  document.body.append(overlay);
  openSheetEl = { overlay, onClose };
  build(body, panel);
  return body;
}
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && openSheetEl && !document.querySelector(".edit-inline-input")) closeSheet();
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
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `edit-tile${item.active ? " is-active" : ""}${item.className ? ` ${item.className}` : ""}`;
    button.setAttribute("aria-pressed", String(!!item.active));
    button.innerHTML = item.html || h(item.label);
    if (item.title) button.title = item.title;
    if (item.disabled) button.disabled = true;
    button.addEventListener("click", () => item.onSelect(button));
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

// ---- その場の入力欄 ----
// 対象の要素を同じ位置・同じ文字サイズのテキスト欄に置き換え、確定・取消を呼び出し元へ返す。
let activeInline = null;
export function isInlineEditing() { return !!activeInline; }
// 入力中の欄がelの中にあるか（保存完了などで描き直すと、入力途中の文字が消えるため）。
export function hasActiveInlineIn(el) { return !!activeInline && !!el?.contains(activeInline.wrapper); }
export function finishInlineEditing() { activeInline?.commit(); }

export function inlineEditor(target, value, { multiline = false, placeholder = "", onCommit, onCancel, onTab } = {}) {
  activeInline?.commit();
  const rect = target.getBoundingClientRect();
  const style = getComputedStyle(target);
  const wrapper = document.createElement("span");
  wrapper.className = `edit-inline${multiline ? " is-multiline" : ""}`;
  const input = document.createElement("textarea");
  input.className = "edit-inline-input";
  input.value = value;
  input.rows = 1;
  input.placeholder = placeholder;
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "off");
  for (const key of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight", "color"]) input.style[key] = style[key];
  const parentWidth = target.parentElement?.getBoundingClientRect().width || rect.width;
  input.style.minWidth = `${Math.min(parentWidth, Math.max(rect.width + 24, 96))}px`;
  const actions = document.createElement("span");
  actions.className = "edit-inline-actions";
  actions.innerHTML = '<button type="button" class="edit-inline-ok" aria-label="確定"><i class="fa-solid fa-check" aria-hidden="true"></i></button><button type="button" class="edit-inline-cancel" aria-label="取消"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>';
  wrapper.append(input, actions);
  target.replaceWith(wrapper);
  const fit = () => {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  };
  let done = false;
  const finish = (commit, next) => {
    if (done) return;
    done = true;
    activeInline = null;
    if (commit) onCommit(input.value, next);
    else onCancel?.();
  };
  activeInline = { commit: () => finish(true), wrapper };
  input.addEventListener("input", fit);
  input.addEventListener("keydown", event => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") { event.preventDefault(); finish(false); }
    else if (event.key === "Tab" && onTab) { event.preventDefault(); finish(true, event.shiftKey ? -1 : 1); }
    else if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) { event.preventDefault(); finish(true); }
  });
  input.addEventListener("blur", () => setTimeout(() => {
    if (!done && document.activeElement !== input) finish(true);
  }, 0));
  // ボタンを押してもフォーカスを奪わないようにし、blurより先に処理する。
  actions.addEventListener("pointerdown", event => event.preventDefault());
  actions.querySelector(".edit-inline-ok").addEventListener("click", () => finish(true));
  actions.querySelector(".edit-inline-cancel").addEventListener("click", () => finish(false));
  // フォーカスはすぐに移す（次のフレームまで待つと、入力し始めた文字の位置がずれる）。
  input.focus({ preventScroll: true });
  input.setSelectionRange(input.value.length, input.value.length);
  fit();
  requestAnimationFrame(() => {
    fit();
    const box = wrapper.getBoundingClientRect();
    const viewport = window.visualViewport;
    const bottom = viewport ? viewport.height + viewport.offsetTop : innerHeight;
    if (box.bottom > bottom - 16 || box.top < 64) wrapper.scrollIntoView({ block: "center", behavior: "smooth" });
  });
  return input;
}

// ---- ダブルタップ・ダブルクリック ----
// 1回目のタップで再描画されても判定できるよう、要素ではなく位置と時間で判定する。
export function onDoubleActivate(root, handler) {
  let last = null;
  root.addEventListener("pointerup", event => {
    if (event.button > 0) return;
    const now = performance.now();
    const limit = event.pointerType === "mouse" ? 450 : 320;
    if (last && now - last.time < limit && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 30) {
      last = null;
      const target = document.elementFromPoint(event.clientX, event.clientY) || event.target;
      if (!root.contains(target)) return;
      handler(event, target);
      if (event.pointerType !== "mouse") event.preventDefault();
      return;
    }
    last = { time: now, x: event.clientX, y: event.clientY };
  });
}

// ---- ドラッグで並べ替え ----
// handleSelector: つかむ部分。itemSelector: 並べ替える要素。touchは長押しで開始する。
export function sortable(root, { handleSelector, itemSelector, canDrag = () => true, canDrop = () => true, onDrop, idOf }) {
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
  }, { passive: false });
  window.addEventListener("pointerup", () => { clearPending(); if (drag) finish(true); });
  window.addEventListener("pointercancel", () => { clearPending(); if (drag) finish(false); });
  root.addEventListener("touchmove", event => { if (drag) event.preventDefault(); }, { passive: false });
  root.addEventListener("contextmenu", event => { if (drag || pending) event.preventDefault(); });

  function begin(item, event) {
    const rect = item.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "edit-drag-ghost";
    ghost.textContent = item.dataset.dragLabel || item.textContent.trim().slice(0, 40);
    document.body.append(ghost);
    const line = document.createElement("div");
    line.className = "edit-drop-line";
    document.body.append(line);
    drag = { item, ghost, line, target: null, before: true, offsetY: event.clientY - rect.top, lastY: event.clientY, scrollTimer: null };
    item.classList.add("is-dragging");
    document.body.classList.add("is-edit-dragging");
    navigator.vibrate?.(15);
    move(event.clientX, event.clientY);
  }

  function move(x, y) {
    drag.lastY = y;
    drag.ghost.style.transform = `translate(${x + 12}px, ${y - 18}px)`;
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
    autoScroll();
  }

  function autoScroll() {
    clearInterval(drag.scrollTimer);
    const edge = 70;
    const speed = drag.lastY < edge ? -(edge - drag.lastY) / 3 : drag.lastY > innerHeight - edge ? (drag.lastY - (innerHeight - edge)) / 3 : 0;
    if (!speed) return;
    drag.scrollTimer = setInterval(() => {
      if (!drag) return;
      window.scrollBy(0, speed);
    }, 16);
  }

  function finish(commit) {
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
