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
          ${sense.refs.length ? `<div class="idiom-refs" aria-label="参照単語"><svg class="idiom-ref-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/></svg> ${[...sense.refs].sort((a, b) => Number(a.source === "synonym") - Number(b.source === "synonym")).map(ref => `<a class="idiom-ref" href="#word-${escapeHtml(encodeURIComponent(ref.wordId))}" data-word-id="${escapeHtml(ref.wordId)}" aria-label="${escapeHtml(ref.spelling)}、単語番号${escapeHtml(ref.no)}">${escapeHtml(ref.spelling)} (no.  ${escapeHtml(ref.no)})</a>`).join(' <span aria-hidden="true">·</span> ')}</div>` : ""}
        </div>`).join("")}
      </div></div>
    </div>
  </article>`;
}
