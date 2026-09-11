import { escapeHtml, renderMarkup, renderWordListMarkup } from "../shared/markup.js";
import { renderWordIllustration } from "../shared/illustrations.js";

// Share the word card's structure, typography and registered illustration placement.
// No placeholder is shown until an illustration is supplied.
export function renderIdiomEntry(item, origin, {resolve, renderNotes} = {}) {
  const details = [
    ["synonyms", "synonym", "同義語"], ["antonyms", "antonym", "対義語"], ["notes", "memo", "メモ"],
  ].filter(([field]) => item[field]).map(([field, type, label]) => {
    const html = field === "notes"
      ? (renderNotes ? renderNotes(item[field], {currentHeadword:item.phrase}) : renderMarkup(item[field], {resolve})).replace(/\n/g,"<br>")
      : renderWordListMarkup(item[field], {resolve});
    return `<div class="notes-block notes-${type}"><span class="notes-label ${type}-badge"><span class="notes-label-text">${label}</span></span><span class="notes-content">${html}</span></div>`;
  }).join("");
  const illustration = renderWordIllustration({ spelling: item.phrase, illustration: item.illustration }, origin);
  return `<article class="entry idiom-entry" id="idiom-${escapeHtml(encodeURIComponent(item.key))}" data-idiom-no="${escapeHtml(item.no)}">
    <div class="entry-no idiom-no" aria-label="熟語番号${escapeHtml(item.no)}">${escapeHtml(item.no)}</div>
    <div class="entry-body">
      ${illustration}
      <div class="entry-head"><h3 class="headword idiom-phrase">${escapeHtml(item.phrase)}</h3></div>
      <div class="entry-content${illustration ? " has-illustration" : ""}"><div class="entry-card">
        ${item.meanings.map(sense => ({ ...sense, refs: sense.refs.filter(ref => ref.source !== "synonym") })).map((sense, index) => `<div class="idiom-sense">
          <div class="sense-line${(sense.no || index + 1) === 1 ? " sense-primary" : ""}"><span class="sense-item${(sense.no || index + 1) === 1 ? " sense-item-primary" : ""}">${(item.senseCount || item.meanings.length) > 1 || sense.no > 1 ? `<span class="sense-number">${(sense.no || index + 1) <= 20 ? String.fromCodePoint(0x245f + (sense.no || index + 1)) : `(${sense.no || index + 1})`}</span>` : ""}<span class="sense-meaning">${renderMarkup(sense.meaning, {resolve})}</span></span></div>
          ${sense.refs.length ? `<div class="idiom-refs" aria-label="参照単語"><svg class="idiom-ref-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/></svg> ${sense.refs.map(ref => `<a class="idiom-ref" href="#word-${escapeHtml(encodeURIComponent(ref.wordId))}" data-word-id="${escapeHtml(ref.wordId)}" aria-label="${escapeHtml(ref.spelling)}、単語番号${escapeHtml(ref.no)}">${escapeHtml(ref.spelling)} (no.  ${escapeHtml(ref.no)})</a>`).join(' <span aria-hidden="true">·</span> ')}</div>` : ""}
        </div>`).join("")}
        <div class="entry-notes">${details}</div>
      </div></div>
    </div>
  </article>`;
}
