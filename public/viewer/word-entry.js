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

// context.edit（編集ページのみ）: 各欄にdata-edit属性を付け、選択中の単語では空欄の入力位置も表示する。
// 閲覧ページではeditを渡さないため、出力は従来と同じ。
export function renderWordEntry(w, context) {
 const {resolveRef,resolveHeadwordRef,renderNotesMarkup,origin}=context;
 const edit = context.edit || null;
 const selected = !!edit?.selected;
 const showFields = edit?.showFields || new Set();
 const ed = (path) => edit ? ` data-edit="${escapeHtml(path)}"` : "";
 const empty = (path, label, cls = "") => `<span class="edit-empty${cls ? ` ${cls}` : ""}" data-edit="${escapeHtml(path)}">${escapeHtml(label)}</span>`;
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
    _index: i,
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
      const meaningHtml = (s) => edit && !String(s.meaning || "").trim()
        ? empty(`senses.${s._index}.meaning`, "意味を入力", "sense-meaning")
        : `<span class="sense-meaning"${ed(`senses.${s._index}.meaning`)}>${renderMarkup(s.meaning, { resolve: resolveRef })}</span>`;
      const meaningsHtml =
        items.length > 1
          ? `<span class="sense-items">${items
              .map(
                (s, index) =>
                  `<span class="sense-item${s._isPrimary ? " sense-item-primary" : ""}"${edit ? ` data-sense-index="${s._index}"` : ""}><span class="sense-number">${formatSenseNumber(index + 1)}</span>${meaningHtml(s)}</span>`
              )
              .join("")}</span>`
          : edit ? `<span class="sense-item" data-sense-index="${items[0]._index}">${meaningHtml(items[0])}</span>` : meaningHtml(items[0]);
      const posAttr = edit ? ` data-edit-pos="${escapeHtml(group.pos || "")}"` : "";
      return `
    <div class="sense-line${isPrimaryGroup ? " sense-primary" : ""}"${posAttr}>
      ${group.pos ? `<span class="pos-badge"${posAttr}>${escapeHtml(group.pos)}</span>` : edit && selected ? `<span class="pos-badge edit-empty-badge"${posAttr}>品詞</span>` : ""}
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
        <div class="example-line"${edit ? ` data-example-index="${index}"` : ""}>
          <span class="bullet${ex.type === "phrase" ? ` hollow${index === firstPhraseIndex ? " phrase-first" : ""}` : ""}">${ex.type === "phrase" ? "□" : "◆"}</span>
          ${edit && !String(ex.sentence || "").trim() ? empty(`examples.${index}.sentence`, "フレーズを入力", "example-phrase") : `<span class="example-phrase"${ed(`examples.${index}.sentence`)}>${renderExampleHtml(ex)}</span>`}
          ${ex.translation ? `<span class="example-translation"${ed(`examples.${index}.translation`)}>${renderMarkup(ex.translation, { resolve: resolveRef })}</span>` : selected ? empty(`examples.${index}.translation`, "訳を入力", "example-translation") : ""}
        </div>`
        )
        .join("")}</div>`
    : "";

  const derivativeGroups = groupDerivativeSenses(w.derivatives || []);
  if (edit) {
    // 編集用に元の行番号を付ける（groupDerivativeSensesは初出順にまとめる）。
    const key = (word, index) => String(word || "").trim().normalize("NFKC").toLocaleLowerCase("en") || `__empty_derivative_${index}`;
    const groupByKey = new Map();
    (w.derivatives || []).forEach((d, index) => {
      const k = key(d?.word, index);
      if (!groupByKey.has(k)) groupByKey.set(k, []);
      groupByKey.get(k).push(index);
    });
    const indexLists = [...groupByKey.values()];
    derivativeGroups.forEach((group, g) => group.senses.forEach((sense, n) => { sense.index = indexLists[g][n]; }));
  }
  const derivativesHtml = derivativeGroups.length || showFields.has("derivatives")
    ? `<div class="notes-block notes-derivative"${edit ? ' data-field="derivatives"' : ""}><span class="notes-label derivative-badge"${edit ? ' data-edit-field-badge="derivatives"' : ""}><span class="notes-label-text">派生語</span></span><span class="notes-content derivative-items">${derivativeGroups
        .map((group) => {
          const senses = group.senses
            .map(
              (sense) => `<span class="derivative-sense"${edit ? ` data-derivative-index="${sense.index}"` : ""}>${sense.pos ? `<span class="pos-badge derivative-pos"${edit ? ` data-edit-derivative-pos="${sense.index}"` : ""}>${escapeHtml(sense.pos)}</span>` : selected ? `<span class="pos-badge derivative-pos edit-empty-badge" data-edit-derivative-pos="${sense.index}">品詞</span>` : ""}${sense.meaning ? `<span class="derivative-meaning"${ed(`derivatives.${sense.index}.meaning`)}>${renderMarkup(sense.meaning, { resolve: resolveRef })}</span>` : selected ? empty(`derivatives.${sense.index}.meaning`, "意味を入力", "derivative-meaning") : ""}</span>`
            )
            .join("");
          const wordHtml = edit && !String(group.word || "").trim()
            ? empty(`derivatives.${group.senses[0].index}.word`, "派生語を入力", "derivative-word")
            : `<span class="derivative-word"${edit ? ` data-edit="derivativeWord" data-derivative-indexes="${group.senses.map((s) => s.index).join(",")}"` : ""}>${renderDerivativeWordMarkup(group.word, { resolve: resolveHeadwordRef })}</span>`;
          return `<span class="derivative-item">${wordHtml}${senses}</span>`;
        })
        .join("")}</span></div>`
    : "";

  function noteBlock(field, type, label, render) {
    const value = w[field];
    if (!value && !(edit && showFields.has(field))) return "";
    const content = value
      ? `<span class="notes-content"${ed(field)}>${render()}</span>`
      : `<span class="notes-content edit-empty" data-edit="${field}">${escapeHtml(label)}を入力</span>`;
    return `<div class="notes-block notes-${type}"${edit ? ` data-field="${field}"` : ""}><span class="notes-label ${type}-badge"${edit ? ` data-edit-field-badge="${field}"` : ""}><span class="notes-label-text">${label}</span></span>${content}</div>`;
  }
  const irregularFormsHtml = noteBlock("irregularForms", "irregular", "不規則", () => renderMarkup(w.irregularForms, { resolve: resolveRef }));
  const etymologyHtml = noteBlock("etymology", "etymology", "語源", () => renderMarkup(w.etymology, { resolve: resolveRef }));
  const synonymsHtml = noteBlock("synonyms", "synonym", "類義語", () => renderWordListMarkup(w.synonyms, { resolve: resolveRef }));
  const antonymsHtml = noteBlock("antonyms", "antonym", "対義語", () => renderWordListMarkup(w.antonyms, { resolve: resolveRef }));
  const relatedWordsHtml = noteBlock("relatedWords", "related", "関連語", () => renderWordListMarkup(w.relatedWords, { resolve: resolveRef }));
  const notesHtml = noteBlock("notes", "memo", "メモ", () => renderNotesMarkup(w.notes, { currentHeadword: w.spelling, currentPhrases: (w.examples || []).filter(ex => ex.type === "phrase").map(ex => ex.sentence) }));

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
  <article class="entry${isBranch ? " branch-entry" : ""}${selected ? " is-edit-selected" : ""}" id="word-${escapeHtml(w.id)}" data-word-id="${escapeHtml(w.id)}" data-no="${escapeHtml(w.seqNo)}" data-haystack="${escapeHtml(haystack)}" data-cefr="${escapeHtml(cefrLevel)}">
    <div class="entry-no" data-action="copy-link" data-word-id="${escapeHtml(w.id)}" title="リンクをコピー">${escapeHtml(w.seqNo)}</div>
    <div class="entry-body">
      <div class="entry-head">
        ${edit && !String(w.spelling || "").trim() ? empty("spelling", "見出し語を入力", "headword") : `<span class="headword"${ed("spelling")}>${renderStressedSpelling(w.spelling, w.pronunciation, escapeHtml)}</span>`}
        ${w.pronunciation ? `<span class="pron"${ed("pronunciation")}>${escapeHtml(formatPronunciationWithAccents(w.pronunciation))}<button type="button" class="speak-btn" data-action="speak" data-text="${escapeHtml(w.spelling)}" data-audio-url="${escapeHtml(generatedAudioUrl)}" title="${generatedAudioUrl ? "登録済み音声で発音を聞く" : "端末の英語音声で発音を聞く"}"><i class="fa-solid fa-volume-high" aria-hidden="true"></i></button></span>` : selected ? empty("pronunciation", "発音記号", "pron") : ""}
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

