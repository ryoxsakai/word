import { escapeHtml } from "../shared/markup.js";
import { renderWordIllustration } from "../shared/illustrations.js";

// Share the word card's structure, typography and future illustration placement.
// No placeholder is shown until an illustration is supplied.
export function renderIdiomEntry(item, origin) {
  const illustration = renderWordIllustration({ spelling: item.phrase, illustration: item.illustration }, origin);
  return `<article class="entry idiom-entry" id="idiom-${escapeHtml(encodeURIComponent(item.key))}" data-idiom-no="${escapeHtml(item.no)}">
    <div class="entry-no idiom-no" aria-label="熟語番号${escapeHtml(item.no)}">${escapeHtml(item.no)}</div>
    <div class="entry-body">
      <div class="entry-head"><h3 class="headword idiom-phrase">${escapeHtml(item.phrase)}</h3></div>
      <div class="entry-content${illustration ? " has-illustration" : ""}"><div class="entry-card">
        ${illustration}
        ${item.meanings.map(sense => `<div class="idiom-sense">
          <div class="sense-line sense-primary"><span class="sense-meaning">${escapeHtml(sense.meaning)}</span></div>
          ${sense.refs.length ? `<div class="idiom-refs"><span class="idiom-ref-label">単語</span> ${sense.refs.map(ref => `<a class="idiom-ref" href="#word-${escapeHtml(encodeURIComponent(ref.wordId))}" data-word-id="${escapeHtml(ref.wordId)}" aria-label="${escapeHtml(ref.spelling)}、単語番号${escapeHtml(ref.no)}">${escapeHtml(ref.no)}</a>`).join(" ")}</div>` : ""}
        </div>`).join("")}
      </div></div>
    </div>
  </article>`;
}
