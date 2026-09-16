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
export function renderIdiomEntry(item, origin, {resolve, renderNotes} = {}) {
  const details = [
    ["synonyms", "synonym", "同義語"], ["antonyms", "antonym", "対義語"], ["notes", "memo", "メモ"],
  ].filter(([field]) => item[field]).map(([field, type, label]) => {
    const html = field === "notes"
      ? (renderNotes ? renderNotes(item[field], {currentHeadword:item.phrase, currentPhrases:idiomAlternateForms(item), autoReferences:false}) : renderMarkup(item[field], {resolve})).replace(/\n/g,"<br>")
      : renderWordListMarkup(item[field], {resolve});
    return `<div class="notes-block notes-${type}"><span class="notes-label ${type}-badge"><span class="notes-label-text">${label}</span></span><span class="notes-content">${html}</span></div>`;
  }).join("");
  const illustration = renderWordIllustration({ spelling: item.phrase, illustration: item.illustration }, origin);
  return `<article class="entry idiom-entry" id="idiom-${escapeHtml(encodeURIComponent(item.key))}" data-idiom-no="${escapeHtml(item.no)}">
    <div class="entry-no idiom-no" aria-label="熟語番号${escapeHtml(item.no)}">${escapeHtml(item.no)}</div>
    <div class="entry-body">
      ${illustration}
      <div class="entry-head"><h3 class="headword idiom-phrase">${renderIdiomHeading(item.phrase)}${idiomAlternateForms(item).map(form => `<span class="idiom-alternate-form"> / ${escapeHtml(form)}</span>`).join("")}</h3></div>
      <div class="entry-content${illustration ? " has-illustration" : ""}"><div class="entry-card">
        ${item.meanings.map((sense, index) => `<div class="idiom-sense">
          <div class="sense-line${(sense.no || index + 1) === 1 ? " sense-primary" : ""}"><span class="sense-item${(sense.no || index + 1) === 1 ? " sense-item-primary" : ""}">${(item.senseCount || item.meanings.length) > 1 || sense.no > 1 ? `<span class="sense-number">${(sense.no || index + 1) <= 20 ? String.fromCodePoint(0x245f + (sense.no || index + 1)) : `(${sense.no || index + 1})`}</span>` : ""}<span class="sense-meaning">${renderMarkup(sense.meaning, {resolve})}</span></span></div>
        </div>`).join("")}
        <div class="entry-notes">${details}</div>
      </div></div>
    </div>
  </article>`;
}
