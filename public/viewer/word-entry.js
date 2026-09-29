import {renderMarkup,escapeHtml,renderWordListMarkup,renderDerivativeWordMarkup} from '../shared/markup.js';
import {renderStressedSpelling} from '../shared/spelling-stress.js';
import {formatPronunciationWithAccents} from '../shared/pronunciation.js';
import {effectiveCefrLevel,cefrLevelClass} from '../shared/learning-tags.js';
import {groupDerivativeSenses} from '../shared/derivatives.js';
import {renderWordIllustration} from '../shared/illustrations.js';
const BLANK_RE = /(＿{2,}|_{3,})/;
const CIRCLED_SENSE_NUMBERS = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
function formatSenseNumber(number) {
  return CIRCLED_SENSE_NUMBERS[number - 1] || `(${number})`;
}

function wordHaystack(w) {
  const parts = [
    w.spelling,
    w.pronunciation,
    ...(w.senses || []).map((s) => s.meaning),
    ...(w.derivatives || []).map((d) => `${d.word || ""} ${d.meaning || ""}`),
    ...(w.examples || []).map((e) => `${e.sentence || ""} ${e.translation || ""}`),
    w.irregularForms,
    w.etymology,
    w.synonyms,
    w.antonyms,
    w.relatedWords,
    w.notes,
  ];
  for (const [k, v] of Object.entries(w.tags || {})) parts.push(k, v);
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function renderWordEntry(w, context) {
 const {resolveRef,resolveHeadwordRef,renderNotesMarkup,origin}=context;
function renderRef(spelling) {
  const hit = resolveRef(spelling);
  if (!hit.found) return escapeHtml(spelling);
  return `<a href="#word-${escapeHtml(encodeURIComponent(hit.id))}" class="ref" data-word-id="${escapeHtml(hit.id)}">${escapeHtml(spelling)}</a>`;
}


function renderExampleHtml(ex) {
  let html = renderMarkup(ex.sentence || "", { resolve: resolveRef });
  if (ex.answer && BLANK_RE.test(html)) {
    html = html.replace(
      BLANK_RE,
      () =>
        `<button type="button" class="blank-toggle" data-action="toggle-blank" data-answer="${escapeHtml(ex.answer)}" data-state="answer">${escapeHtml(ex.answer)}</button>`
    );
  }
  return html;
}


  const isBranch = w.branch > 0;
  const haystack = wordHaystack(w);

  const familyLine =
    isBranch && w.derivedFromSpelling
      ? `<div class="family-block">▸ ${renderRef(w.derivedFromSpelling)} の派生語</div>`
      : "";

  // 見出しの意味(is_primary)が1つもない単語では、最初の意味を仮の見出しとして扱い
  // 一覧が全て同じ薄さになってしまわないようにする。
  const hasPrimarySense = (w.senses || []).some((s) => s.isPrimary);
  const sensesWithFlags = (w.senses || []).map((s, i) => ({
    ...s,
    _isPrimary: s.isPrimary || (!hasPrimarySense && i === 0),
  }));

  // 同じ品詞の意味は1行にまとめ、①②…の丸数字で並べる(初出の品詞順を維持)。
  const posGroups = [];
  const posGroupIndex = new Map();
  for (const s of sensesWithFlags) {
    const key = s.pos || "";
    if (!posGroupIndex.has(key)) {
      posGroupIndex.set(key, posGroups.length);
      posGroups.push({ pos: s.pos, items: [] });
    }
    posGroups[posGroupIndex.get(key)].items.push(s);
  }

  const sensesHtml = posGroups
    .map((group) => {
      // 見出しの意味は常に①として先頭に来るよう並べ替える
      const items = [...group.items].sort((a, b) => (a._isPrimary ? 0 : 1) - (b._isPrimary ? 0 : 1));
      const isPrimaryGroup = items.some((s) => s._isPrimary);
      const pron = items.find((s) => s.pronunciation)?.pronunciation;
      const meaningsHtml =
        items.length > 1
          ? `<span class="sense-items">${items
              .map(
                (s, index) =>
                  `<span class="sense-item${s._isPrimary ? " sense-item-primary" : ""}"><span class="sense-number">${formatSenseNumber(index + 1)}</span><span class="sense-meaning">${renderMarkup(s.meaning, { resolve: resolveRef })}</span></span>`
              )
              .join("")}</span>`
          : `<span class="sense-meaning">${renderMarkup(items[0].meaning, { resolve: resolveRef })}</span>`;
      return `
    <div class="sense-line${isPrimaryGroup ? " sense-primary" : ""}">
      ${group.pos ? `<span class="pos-badge">${escapeHtml(group.pos)}</span>` : ""}
      ${pron ? `<span class="pron sense-pron">${escapeHtml(formatPronunciationWithAccents(pron))}</span>` : ""}
      ${meaningsHtml}
    </div>`;
    })
    .join("");

  const firstPhraseIndex = (w.examples || []).findIndex(ex => ex.type === "phrase");
  const examplesHtml = (w.examples || []).length
    ? `<div class="example-list">${(w.examples || [])
        .map(
          (ex, index) => `
        <div class="example-line">
          <span class="bullet${ex.type === "phrase" ? ` hollow${index === firstPhraseIndex ? " phrase-first" : ""}` : ""}">${ex.type === "phrase" ? "□" : "◆"}</span>
          <span class="example-phrase">${renderExampleHtml(ex)}</span>
          ${ex.translation ? `<span class="example-translation">${renderMarkup(ex.translation, { resolve: resolveRef })}</span>` : ""}
        </div>`
        )
        .join("")}</div>`
    : "";

  const derivativeGroups = groupDerivativeSenses(w.derivatives || []);
  const derivativesHtml = derivativeGroups.length
    ? `<div class="notes-block notes-derivative"><span class="notes-label derivative-badge"><span class="notes-label-text">派生語</span></span><span class="notes-content derivative-items">${derivativeGroups
        .map((group) => {
          const senses = group.senses
            .map(
              (sense) => `<span class="derivative-sense">${sense.pos ? `<span class="pos-badge derivative-pos">${escapeHtml(sense.pos)}</span>` : ""}${sense.meaning ? `<span class="derivative-meaning">${renderMarkup(sense.meaning, { resolve: resolveRef })}</span>` : ""}</span>`
            )
            .join("");
          return `<span class="derivative-item"><span class="derivative-word">${renderDerivativeWordMarkup(group.word, { resolve: resolveHeadwordRef })}</span>${senses}</span>`;
        })
        .join("")}</span></div>`
    : "";

  const irregularFormsHtml = w.irregularForms
    ? `<div class="notes-block notes-irregular"><span class="notes-label irregular-badge"><span class="notes-label-text">不規則</span></span><span class="notes-content">${renderMarkup(w.irregularForms, { resolve: resolveRef })}</span></div>`
    : "";
  const etymologyHtml = w.etymology
    ? `<div class="notes-block notes-etymology"><span class="notes-label etymology-badge"><span class="notes-label-text">語源</span></span><span class="notes-content">${renderMarkup(w.etymology, { resolve: resolveRef })}</span></div>`
    : "";
  const synonymsHtml = w.synonyms
    ? `<div class="notes-block notes-synonym"><span class="notes-label synonym-badge"><span class="notes-label-text">類義語</span></span><span class="notes-content">${renderWordListMarkup(w.synonyms, { resolve: resolveRef })}</span></div>`
    : "";
  const antonymsHtml = w.antonyms
    ? `<div class="notes-block notes-antonym"><span class="notes-label antonym-badge"><span class="notes-label-text">対義語</span></span><span class="notes-content">${renderWordListMarkup(w.antonyms, { resolve: resolveRef })}</span></div>`
    : "";
  const relatedWordsHtml = w.relatedWords
    ? `<div class="notes-block notes-related"><span class="notes-label related-badge"><span class="notes-label-text">関連語</span></span><span class="notes-content">${renderWordListMarkup(w.relatedWords, { resolve: resolveRef })}</span></div>`
    : "";
  const notesHtml = w.notes
    ? `<div class="notes-block notes-memo"><span class="notes-label memo-badge"><span class="notes-label-text">メモ</span></span><span class="notes-content">${renderNotesMarkup(w.notes, { currentHeadword: w.spelling, currentPhrases: (w.examples || []).filter(ex => ex.type === "phrase").map(ex => ex.sentence) })}</span></div>`
    : "";

  const cautionHtml = [
    w.ergative
      ? '<span class="caution-badge caution-ergative" title="自動詞の主語と他動詞の目的語が対応する能格動詞"><i class="fa-solid fa-right-left" aria-hidden="true"></i>能格</span>'
      : "",
    w.spellingCaution
      ? '<span class="caution-badge caution-spelling" title="スペルに注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>スペル</span>'
      : "",
    w.pronunciationCaution
      ? '<span class="caution-badge caution-pronunciation" title="発音に注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>発音</span>'
      : "",
    w.accentCaution
      ? '<span class="caution-badge caution-accent" title="アクセント位置に注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>アクセント</span>'
      : "",
    w.polysemousCaution
      ? '<span class="caution-badge caution-polysemous" title="複数の意味に注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>多義</span>'
      : "",
    w.conjugationCaution
      ? '<span class="caution-badge caution-conjugation" title="活用に注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>活用</span>'
      : "",
    w.usageCaution
      ? '<span class="caution-badge caution-usage" title="語法に注意"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>語法</span>'
      : "",
  ].join("");

  const cefrLevel = effectiveCefrLevel(w.tags);
  const cefrBadge = cefrLevel
    ? `<span class="learning-badge badge-cefr ${cefrLevelClass(cefrLevel)}" title="CEFR ${escapeHtml(cefrLevel)}">${escapeHtml(cefrLevel)}</span>`
    : "";
  const hasAwlTag = Object.prototype.hasOwnProperty.call(w.tags || {}, "awl");
  const awlSublist = String(w.tags?.awl || "").trim();
  const awlBadge = hasAwlTag
    ? `<span class="learning-badge badge-awl" title="Academic Word List${awlSublist ? ` Sublist ${escapeHtml(awlSublist)}` : ""}">AWL${awlSublist ? ` ${escapeHtml(awlSublist)}` : ""}</span>`
    : "";
  const generatedAudioUrl = w.generatedAudio?.url || "";
  const illustrationHtml = renderWordIllustration(w, origin);

  return `
  <article class="entry${isBranch ? " branch-entry" : ""}" id="word-${escapeHtml(w.id)}" data-word-id="${escapeHtml(w.id)}" data-no="${escapeHtml(w.seqNo)}" data-haystack="${escapeHtml(haystack)}" data-cefr="${escapeHtml(cefrLevel)}">
    <div class="entry-no" data-action="copy-link" data-word-id="${escapeHtml(w.id)}" title="リンクをコピー">${escapeHtml(w.seqNo)}</div>
    <div class="entry-body">
      <div class="entry-head">
        <span class="headword">${renderStressedSpelling(w.spelling, w.pronunciation, escapeHtml)}</span>
        ${w.pronunciation ? `<span class="pron">${escapeHtml(formatPronunciationWithAccents(w.pronunciation))}<button type="button" class="speak-btn" data-action="speak" data-text="${escapeHtml(w.spelling)}" data-audio-url="${escapeHtml(generatedAudioUrl)}" title="${generatedAudioUrl ? "登録済み音声で発音を聞く" : "端末の英語音声で発音を聞く"}"><i class="fa-solid fa-volume-high" aria-hidden="true"></i></button></span>` : ""}
        ${cefrBadge}
        ${awlBadge}
        ${cautionHtml}
      </div>
      ${familyLine}
      <div class="entry-content${illustrationHtml ? " has-illustration" : ""}">
      <div class="entry-card">
        ${illustrationHtml}
        ${sensesHtml}
        ${examplesHtml}
        <div class="entry-notes">
        ${derivativesHtml}
        ${irregularFormsHtml}
        ${synonymsHtml}
        ${antonymsHtml}
        ${relatedWordsHtml}
        ${etymologyHtml}
        ${notesHtml}
        </div>
      </div>
      </div>
    </div>
  </article>`;
}

