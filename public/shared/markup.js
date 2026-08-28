import { formatPronunciationWithAccents } from "./pronunciation.js";

// 単語帳編集用の独自記法パーサー。
// 設定ページ（プレビュー）とWorker（保存前検証・印刷/閲覧時のレンダリング）の両方から
// 同じ実装を読み込んで使う。
//
// 記法:
//   ##headword##            他の見出し語への相互参照。今のリストでの no. を自動解決する。
//   ##headword|表示文言##   参照先は headword だが、表示する文言を変えたい場合。
//   ==text==                キーワード強調（ハイライト）。
//   *text*                  語根・接辞などの強調（イタリック）。
//   //text//                IPA発音記号用フォント（メモ欄）。

const CROSSREF_RE = /##([^#|]+?)(?:\|([^#]+?))?##/g;
const HIGHLIGHT_RE = /==(.+?)==/g;
const ITALIC_RE = /\*(.+?)\*/g;
const PRONUNCIATION_RE = /(^|[^:])\/\/([^/\n]+?)\/\//g;
const PROTECTED_TOKEN_RE = /(?:\uE000\d+\uE001|\uE200\d+\uE201|\uE300\d+\uE301)/g;

const GRAMMAR_TERMS = [
  "to be V-ed",
  "to be Vpp",
  "to have V-ed",
  "having V-ed",
  "being V-ed",
  "have V-ed",
  "be Ving",
  "be V-ed",
  "to V",
  "S V",
  "Ving",
  "V-ed",
  "Vpp",
  "Ved",
  "that",
  "whether",
  "should",
  "if",
  "A",
  "B",
  "C",
  "O",
  "S",
  "V",
  "動詞の原形",
  "動詞原形",
  "原形不定詞",
  "独立分詞構文",
  "分詞構文",
  "比較構文",
  "関係代名詞",
  "関係副詞",
  "関係詞節",
  "疑問代名詞",
  "疑問副詞",
  "疑問詞節",
  "疑問詞",
  "不可算名詞",
  "可算名詞",
  "集合名詞",
  "抽象名詞",
  "普通名詞",
  "固有名詞",
  "状態動詞",
  "知覚動詞",
  "使役動詞",
  "再帰動詞",
  "自動詞",
  "他動詞",
  "現在分詞",
  "過去分詞",
  "動名詞",
  "不定詞",
  "代名詞",
  "形容詞",
  "助動詞",
  "前置詞",
  "接続詞",
  "間投詞",
  "副詞",
  "名詞",
  "動詞",
  "冠詞",
  "動詞句",
  "名詞句",
  "形容詞句",
  "副詞句",
  "前置詞句",
  "分詞句",
  "不定詞句",
  "動名詞句",
  "語句",
  "that節",
  "whether節",
  "if節",
  "what節",
  "名詞節",
  "形容詞節",
  "副詞節",
  "主節",
  "従属節",
  "条件節",
  "譲歩節",
  "目的節",
  "結果節",
  "理由節",
  "時の節",
  "主語",
  "目的語",
  "補語",
  "修飾語",
  "先行詞",
  "受動態",
  "能動態",
  "仮定法現在",
  "仮定法過去完了",
  "仮定法過去",
  "仮定法",
  "直説法",
  "命令法",
  "命令文",
  "現在形",
  "過去形",
  "未来形",
  "完了形",
  "進行形",
  "単数形",
  "複数形",
  "単数",
  "複数",
  "比較級",
  "最上級",
  "原級",
  "叙述用法",
  "限定用法",
  "名詞用法",
  "副詞用法",
  "不可算用法",
  "前置修飾",
  "後置修飾",
  "文型",
  "時制",
  "語順",
  "倒置",
  "省略",
  "一致",
  "語法",
  "構文",
  "原形",
];

const GRAMMAR_TERM_RE = new RegExp(
  `(^|[^\\p{Script=Latin}\\p{N}_])((?:第[1-5]文型|${GRAMMAR_TERMS
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|")}))(?=$|[^\\p{Script=Latin}\\p{N}_])`,
  "gu"
);
const BARE_GRAMMAR_TERM_RES = [
  /(^|[^\p{Script=Latin}\p{N}_語])(句)(?=$|[\s、。，．・：:；;!?！？）」』】はがをにでとのもなかま])/gu,
  /(^|[^\p{Script=Latin}\p{N}_第])(節)(?=$|[\s、。，．・：:；;!?！？）」』】はがをにでとのもなかま])/gu,
];

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * @param {string} raw 元のテキスト（記法込み）
 * @param {object} [opts]
 * @param {(headword: string) => ({found: boolean, id?: string, no?: number|null})} [opts.resolve]
 *   見出し語を解決するコールバック。見つかれば found:true と id・no（今のリスト文脈での番号。
 *   所属していなければ null）を返す。省略時は常に未解決として扱う。
 * @returns {string} 安全なHTML文字列
 */
export function renderMarkup(raw, opts = {}) {
  if (!raw) return "";
  const { resolve } = opts;
  const renderedRefs = [];
  const protectedText = String(raw).replace(CROSSREF_RE, (_match, headwordRaw, displayRaw) => {
    const headword = headwordRaw.trim();
    const label = (displayRaw ? displayRaw.trim() : headword);
    const result = resolve ? resolve(headword) : null;

    let refHtml;
    if (!result || !result.found) {
      refHtml = `<span class="ref ref-missing" data-headword="${escapeHtml(headword)}" title="未登録の見出し語です">${escapeHtml(label)}</span>`;
    } else {
      const noSuffix = result.no != null ? ` (no.${result.no})` : "";
      refHtml = `<a href="#word-${escapeHtml(result.id)}" class="ref" data-headword="${escapeHtml(headword)}" data-word-id="${escapeHtml(result.id)}">${escapeHtml(label)}${escapeHtml(noSuffix)}</a>`;
    }
    const token = `\uE100${renderedRefs.length}\uE101`;
    renderedRefs.push(refHtml);
    return token;
  });

  let html = escapeHtml(protectedText);
  html = html.replace(HIGHLIGHT_RE, (_m, inner) => `<mark>${inner}</mark>`);
  html = html.replace(ITALIC_RE, (_m, inner) => `<em>${inner}</em>`);
  html = html.replace(/\uE100(\d+)\uE101/g, (_match, index) => renderedRefs[Number(index)] || "");

  return html;
}

/**
 * 類義語・対義語欄のカンマ/セミコロン区切り項目を表示する。
 * 明示的な ##参照## はそのまま扱い、素の項目が見出し語と完全一致する場合も
 * ##で囲んだ場合と同じリンク・番号表示にする。
 * @param {string} raw
 * @param {object} [opts] renderMarkup と同じオプション
 * @returns {string}
 */
export function renderWordListMarkup(raw, opts = {}) {
  if (!raw) return "";
  const { resolve } = opts;
  return String(raw)
    .split(/[,;；]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const explicitRef = new RegExp(CROSSREF_RE.source).exec(part);
      const headword = explicitRef ? explicitRef[1].trim() : part;
      const result = resolve ? resolve(headword) : null;
      const displayNo = result?.found && result.no != null ? String(result.no) : "";
      const sortKey = /^\d+(?:-\d+)*$/.test(displayNo) ? displayNo.split("-").map(Number) : null;
      const html = part.includes("##")
        ? renderMarkup(part, opts)
        : result?.found
          ? renderMarkup(`##${part}##`, opts)
          : renderMarkup(part, opts);
      return { html, index, sortKey };
    })
    .sort((a, b) => {
      if (!a.sortKey && !b.sortKey) return a.index - b.index;
      if (!a.sortKey) return 1;
      if (!b.sortKey) return -1;
      const length = Math.max(a.sortKey.length, b.sortKey.length);
      for (let i = 0; i < length; i += 1) {
        if (a.sortKey[i] == null) return -1;
        if (b.sortKey[i] == null) return 1;
        if (a.sortKey[i] !== b.sortKey[i]) return a.sortKey[i] - b.sortKey[i];
      }
      return a.index - b.index;
    })
    .map((item) => item.html)
    .join(", ");
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceOutsideProtectedTokens(text, re, replacer) {
  let output = "";
  let lastIndex = 0;
  for (const match of String(text).matchAll(PROTECTED_TOKEN_RE)) {
    output += String(text).slice(lastIndex, match.index).replace(re, replacer);
    output += match[0];
    lastIndex = match.index + match[0].length;
  }
  return output + String(text).slice(lastIndex).replace(re, replacer);
}

/**
 * 本文中に現れる登録済み見出し語を、明示的な ##参照## と同じ表示にする
 * レンダラーを作る。長い見出し語を優先し、英数字の途中では一致させない。
 * 見出し語一覧から正規表現を作る処理は初回だけなので、入力ごとのプレビューにも使える。
 * @param {Iterable<string>} headwords
 * @param {object} [opts] renderMarkup と同じオプション
 * @returns {(raw: string, context?: {currentHeadword?: string}) => string}
 */
export function createAutoCrossRefRenderer(headwords, opts = {}) {
  const canonicalByLower = new Map();
  for (const rawHeadword of headwords || []) {
    const headword = String(rawHeadword).trim();
    if (!headword || headword.includes("#") || headword.includes("|")) continue;
    const key = headword.toLowerCase();
    if (!canonicalByLower.has(key)) canonicalByLower.set(key, headword);
  }

  const alternatives = [...canonicalByLower.values()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  // 日本語の助詞が直後に続く「importも参照」のような文でも一致させつつ、
  // enacted 内の act のようなラテン文字列の途中には一致させない。
  const boundaryPattern = (headwordPattern) =>
    `(^|[^\\p{Script=Latin}\\p{N}_])(${headwordPattern})(?=$|[^\\p{Script=Latin}\\p{N}_])`;
  const plainHeadwordRe = alternatives.length
    ? new RegExp(boundaryPattern(alternatives.join("|")), "giu")
    : null;

  return (raw, context = {}) => {
    if (!raw) return "";
    const currentHeadword = String(context.currentHeadword || "").trim();
    const currentHeadwordLower = currentHeadword.toLowerCase();
    const boldLabels = [];
    const boldToken = (label) => {
      const token = `\uE200${boldLabels.length}\uE201`;
      boldLabels.push(label);
      return token;
    };

    // 発音記号は先に退避し、見出し語の自動リンクや他の記法の対象にしない。
    const pronunciations = [];
    const pronunciationProtectedText = String(raw).replace(PRONUNCIATION_RE, (_match, prefix, pronunciationRaw) => {
      const token = `\uE300${pronunciations.length}\uE301`;
      pronunciations.push(formatPronunciationWithAccents(pronunciationRaw.trim()));
      return `${prefix}${token}`;
    });

    // 明示済みの参照は一時退避する。現在の見出し語自身ならリンクにせず太字にする。
    const explicitRefs = [];
    let protectedText = pronunciationProtectedText.replace(CROSSREF_RE, (match, headwordRaw, displayRaw) => {
      const headword = headwordRaw.trim();
      if (currentHeadwordLower && headword.toLowerCase() === currentHeadwordLower) {
        return boldToken(displayRaw ? displayRaw.trim() : headword);
      }
      const token = `\uE000${explicitRefs.length}\uE001`;
      explicitRefs.push(match);
      return token;
    });

    // 文法記号・文法用語は、見出し語の自動参照より先に太字として退避する。
    // 発音記号と明示的な相互参照はすでに保護されているため、その内部は変更しない。
    protectedText = replaceOutsideProtectedTokens(protectedText, GRAMMAR_TERM_RE, (_match, prefix, term) =>
      `${prefix}${boldToken(term)}`
    );
    for (const bareGrammarTermRe of BARE_GRAMMAR_TERM_RES) {
      protectedText = replaceOutsideProtectedTokens(protectedText, bareGrammarTermRe, (_match, prefix, term) =>
        `${prefix}${boldToken(term)}`
      );
    }

    // 新規作成中の見出し語も登録済み語と同じ最長一致の候補へ加える。
    // 先に単独で太字化すると、take off より draft の take が先に一致してしまうため。
    let autoHeadwordRe = plainHeadwordRe;
    if (currentHeadword && !canonicalByLower.has(currentHeadwordLower)) {
      const draftAlternatives = [...canonicalByLower.values(), currentHeadword]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp);
      autoHeadwordRe = new RegExp(boundaryPattern(draftAlternatives.join("|")), "giu");
    }

    const withAutoRefs = autoHeadwordRe
      ? replaceOutsideProtectedTokens(protectedText, autoHeadwordRe, (_match, prefix, matched) => {
          if (currentHeadwordLower && matched.toLowerCase() === currentHeadwordLower) {
            return `${prefix}${boldToken(matched)}`;
          }
          const canonical = canonicalByLower.get(matched.toLowerCase());
          if (!canonical) return `${prefix}${matched}`;
          const marker = canonical === matched ? `##${canonical}##` : `##${canonical}|${matched}##`;
          return `${prefix}${marker}`;
        })
      : protectedText;

    const restored = withAutoRefs.replace(/\uE000(\d+)\uE001/g, (_match, index) => explicitRefs[Number(index)] || "");
    let html = renderMarkup(restored, opts);
    html = html.replace(/\uE200(\d+)\uE201/g, (_match, index) => `<strong>${escapeHtml(boldLabels[Number(index)] || "")}</strong>`);
    return html.replace(
      /\uE300(\d+)\uE301/g,
      (_match, index) => `<span class="pronunciation-inline">${escapeHtml(pronunciations[Number(index)] || "")}</span>`
    );
  };
}

/**
 * 記法を取り除いたプレーンテキストを返す（索引の見出し語・並び替えキーなど、
 * HTMLではなく素の文字列が必要な場面で使う）。
 * @param {string} raw
 * @returns {string}
 */
export function stripMarkup(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(CROSSREF_RE, (_m, headwordRaw, displayRaw) => (displayRaw ? displayRaw.trim() : headwordRaw.trim()))
    .replace(HIGHLIGHT_RE, (_m, inner) => inner)
    .replace(ITALIC_RE, (_m, inner) => inner)
    .trim();
}

/**
 * テキスト内に登場する ##headword## 参照の見出し語一覧を抽出する（保存前検証用）。
 * @param {string} raw
 * @returns {string[]}
 */
export function extractCrossRefs(raw) {
  if (!raw) return [];
  const out = [];
  let m;
  const re = new RegExp(CROSSREF_RE.source, "g");
  while ((m = re.exec(raw)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}
