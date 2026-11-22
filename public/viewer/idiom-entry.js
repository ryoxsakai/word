import { idiomAlternateForms } from '../shared/idiom-forms.js';
import { renderIdiomPrepositions } from '../shared/idiom-prepositions.js';
import { escapeHtml, renderMarkup, renderWordListMarkup } from "../shared/markup.js";
import { renderWordIllustration } from "../shared/illustrations.js";

// Wrap balanced parentheses after preposition markup so the context outside them is retained.
function renderIdiomHeading(phrase) {
  let html = renderIdiomPrepositions(phrase);
  const stack = [], ranges = [];
  for (const match of html.matchAll(/[()（）]/g)) {
    const char = match[0];
    if (char === '(' || char === '（') stack.push({char, start: match.index});
    else {
      const open = stack.at(-1);
      if (!open || (open.char === '(' ? ')' : '）') !== char) continue;
      stack.pop();
      if (!stack.length) ranges.push([open.start, match.index + 1]);
    }
  }
  for (const [start, end] of ranges.reverse()) {
    html = html.slice(0, start) + '<span class="idiom-parenthetical">' +
      html.slice(start, end) + '</span>' + html.slice(end);
  }
  return html;
}

// Share the word card's structure, typography and registered illustration placement.
// No placeholder is shown until an illustration is supplied.
// edit（編集ページのみ）: 各欄にdata-edit属性を付け、選択中は空欄の入力位置も表示する。
export function renderIdiomEntry(item, origin, {resolve, renderNotes, edit = null} = {}) {
  const selected = !!edit?.selected;
  const showFields = edit?.showFields || new Set();
  const ed = path => edit ? ` data-edit="${escapeHtml(path)}"` : "";
  const details = [
    ["synonyms", "synonym", "同義語"], ["antonyms", "antonym", "対義語"], ["notes", "memo", "メモ"],
  ].filter(([field]) => item[field] || (edit && showFields.has(field))).map(([field, type, label]) => {
    const html = !item[field] ? "" : field === "notes"
      ? (renderNotes ? renderNotes(item[field], {currentHeadword:item.phrase, currentPhrases:idiomAlternateForms(item), autoReferences:false}) : renderMarkup(item[field], {resolve})).replace(/\n/g,"<br>")
      : renderWordListMarkup(item[field], {resolve});
    const content = item[field] ? `<span class="notes-content"${ed(field)}>${html}</span>` : `<span class="notes-content edit-empty" data-edit="${field}">${label}を入力</span>`;
    return `<div class="notes-block notes-${type}"${edit ? ` data-field="${field}"` : ""}><span class="notes-label ${type}-badge"${edit ? ` data-edit-field-badge="${field}"` : ""}><span class="notes-label-text">${label}</span></span>${content}</div>`;
  }).join("");
  const illustration = renderWordIllustration({ spelling: item.phrase, illustration: item.illustration }, origin);
  const forms = idiomAlternateForms(item);
  const formsHtml = edit
    ? (forms.length || selected ? `<span class="idiom-alternate-forms" data-edit="alternateForms">${forms.length ? forms.map(form => `<span class="idiom-alternate-form"> / ${escapeHtml(form)}</span>`).join("") : '<span class="idiom-alternate-form edit-empty"> / 別形</span>'}</span>` : "")
    : forms.map(form => `<span class="idiom-alternate-form"> / ${escapeHtml(form)}</span>`).join("");
  const phraseHtml = edit
    ? (String(item.phrase || "").trim() ? `<span class="idiom-phrase-text" data-edit="phrase">${renderIdiomHeading(item.phrase)}</span>` : '<span class="edit-empty" data-edit="phrase">熟語を入力</span>')
    : renderIdiomHeading(item.phrase);
  const meaningHtml = (sense, index) => edit && !String(sense.meaning || "").trim()
    ? `<span class="sense-meaning edit-empty" data-edit="meanings.${index}.meaning">意味を入力</span>`
    : `<span class="sense-meaning"${ed(`meanings.${index}.meaning`)}>${renderMarkup(sense.meaning, {resolve})}</span>`;
  return `<article class="entry idiom-entry${selected ? " is-edit-selected" : ""}${edit && item.hidden ? " is-hidden-idiom" : ""}" id="idiom-${escapeHtml(encodeURIComponent(item.key))}" data-idiom-no="${escapeHtml(item.no)}"${edit ? ` data-idiom-key="${escapeHtml(item.key)}"` : ""}>
    <div class="entry-no idiom-no" aria-label="熟語番号${escapeHtml(item.no)}">${escapeHtml(item.no)}</div>
    <div class="entry-body">
      ${illustration}
      <div class="entry-head"><h3 class="headword idiom-phrase">${phraseHtml}${formsHtml}</h3></div>
      <div class="entry-content${illustration ? " has-illustration" : ""}"><div class="entry-card">
        ${item.meanings.map((sense, index) => `<div class="idiom-sense"${edit ? ` data-meaning-index="${index}"` : ""}>
          <div class="sense-line${(sense.no || index + 1) === 1 ? " sense-primary" : ""}"><span class="sense-item${(sense.no || index + 1) === 1 ? " sense-item-primary" : ""}">${(item.senseCount || item.meanings.length) > 1 || sense.no > 1 ? `<span class="sense-number">${(sense.no || index + 1) <= 20 ? String.fromCodePoint(0x245f + (sense.no || index + 1)) : `(${sense.no || index + 1})`}</span>` : ""}${meaningHtml(sense, index)}</span></div>
        </div>`).join("")}
        <div class="entry-notes">${details}</div>
      </div></div>
    </div>
  </article>`;
}
