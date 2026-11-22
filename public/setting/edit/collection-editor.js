// The modal owns a working copy until the user applies it to the word draft.
import { h, sheet, closeSheet, sortable } from "./ui.js";

export function editWordCollection({ word, kind, values, positions, index = 0, field, onApply, onClose }) {
  const senses = kind === "senses";
  const derivative = kind === "derivatives";
  const settings = {
    senses: ["意味", [["meaning", "意味"], ["pronunciation", "発音記号"]]],
    derivatives: ["派生語", [["word", "派生語"], ["meaning", "意味"]]],
    examples: ["フレーズ", [["sentence", "フレーズ"], ["translation", "訳"]]],
  };
  const [name, keys] = settings[kind];
  const main = keys[0][0];
  const rows = structuredClone(values);
  const controller = new AbortController();
  sheet(`${word || "単語"}の${name}`, (body, panel) => {
    body.classList.add("collection-editor");
    body.innerHTML = '<div class="collection-list"></div><div class="collection-footer edit-sheet-actions"><button type="button" class="edit-btn is-quiet" data-add></button><button type="button" class="edit-btn" data-cancel>キャンセル</button><button type="button" class="edit-btn is-primary primary" data-apply>決定</button></div>';
    const list = body.querySelector(".collection-list");
    const add = body.querySelector("[data-add]");
    add.textContent = `＋ ${name}を追加`;
    const rowOf = el => rows[Number(el.closest("[data-row]").dataset.row)];
    function render(focusRow, focusField) {
      list.innerHTML = rows.map((row, i) => {
        const options = senses || derivative ? [...new Set(["", ...positions, row.pos])].map(pos => `<option value="${h(pos)}"${pos === row.pos ? " selected" : ""}>${h(pos || "未指定")}</option>`).join("") : "";
        return `<div class="collection-row" data-row="${i}" data-drag-label="${h(row[main] || name)}">
          <div class="collection-toolbar"><strong>${name} ${i + 1}</strong>
          <button type="button" data-grip aria-label="ドラッグして移動" title="ドラッグして移動"><i class="fa-solid fa-grip-vertical"></i></button>
          <button type="button" data-move="-1" aria-label="上へ移動" ${i ? "" : "disabled"}>↑</button>
          <button type="button" data-move="1" aria-label="下へ移動" ${i + 1 < rows.length ? "" : "disabled"}>↓</button>
          <button type="button" class="is-danger" data-delete aria-label="${name}${i + 1}を削除">削除</button></div>
          ${senses || derivative ? `<div class="collection-options"><label>品詞 <select data-field="pos">${options}</select></label>${senses ? `<label><input type="checkbox" data-field="is_primary" ${row.is_primary ? "checked" : ""}> 見出しの意味</label>` : ""}</div>` : ""}
          ${keys.map(([key,label]) => `<label class="collection-field">${label}<textarea rows="${key === main ? 2 : 1}" data-field="${key}">${h(row[key] || "")}</textarea></label>`).join("")}</div>`;
      }).join("");
      if (focusRow != null) list.querySelector(`[data-row="${focusRow}"] [data-field="${focusField || main}"]`)?.focus();
    }
    function move(from, to) {
      if (from === to || to < 0 || to >= rows.length) return;
      const moving = rows[from], target = rows[to];
      // The reading view groups senses by part of speech. Move whole groups across that boundary.
      if (senses && moving.pos !== target.pos) {
        const group = rows.filter(s => s.pos === moving.pos);
        const rest = rows.filter(s => s.pos !== moving.pos);
        const dest = from < to ? rest.findLastIndex(s => s.pos === target.pos) + 1 : rest.findIndex(s => s.pos === target.pos);
        rest.splice(dest, 0, ...group);
        rows.splice(0, rows.length, ...rest);
      } else {
        const primaryCount = senses && rows.filter(s => s.pos === moving.pos && s.is_primary).length;
        rows.splice(to, 0, rows.splice(from, 1)[0]);
        if (primaryCount) rows.filter(s => s.pos === moving.pos).forEach((s, i) => { s.is_primary = i < primaryCount; });
      }
      render();
      list.querySelector(`[data-row="${rows.indexOf(moving)}"] [data-grip]`)?.focus();
    }
    list.addEventListener("input", ({ target }) => {
      if (target.dataset.field) rowOf(target)[target.dataset.field] = target.type === "checkbox" ? target.checked : target.value;
    });
    list.addEventListener("click", ({ target }) => {
      const button = target.closest("button");
      if (!button) return;
      const i = Number(button.closest("[data-row]").dataset.row);
      if (button.hasAttribute("data-delete")) { rows.splice(i, 1); render(); (list.querySelector("[data-grip]") || add).focus(); }
      if (button.dataset.move) move(i, i + Number(button.dataset.move));
    });
    sortable(list, { handleSelector: "[data-grip]", itemSelector: "[data-row]", idOf: el => Number(el.dataset.row),
      signal: controller.signal, scrollElement: panel, onDrop: (from, dest, before) => move(from, dest + Number(!before) - Number(from < dest)) });
    function insert() {
      rows.push(senses ? { pos: rows.at(-1)?.pos || "", meaning: "", pronunciation: "", is_primary: !rows.length } :
        derivative ? { word: "", pos: "", meaning: "" } : { type: "phrase", sentence: "", translation: "", answer: "" });
      render(rows.length - 1);
    }
    add.onclick = insert;
    body.querySelector("[data-cancel]").onclick = closeSheet;
    body.querySelector("[data-apply]").onclick = () => {
      for (const [i, row] of rows.entries()) {
        if (row[main].trim()) continue;
        const input = list.querySelector(`[data-row="${i}"] [data-field="${main}"]`);
        input.focus(); input.setCustomValidity(`${name}を入力するか、この行を削除してください。`); input.reportValidity(); input.setCustomValidity("");
        return;
      }
      closeSheet();
      onApply(rows);
    };
    if (rows.length) render(index, field); else insert();
  }, { wide: true, accent: derivative ? "derivative" : kind, onClose: () => { controller.abort(); onClose(); } });
}
