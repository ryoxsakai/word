// 単語帳編集用の独自記法パーサー。
// 設定ページ（プレビュー）とWorker（保存前検証・印刷/閲覧時のレンダリング）の両方から
// 同じ実装を読み込んで使う。
//
// 記法:
//   ##headword##            他の見出し語への相互参照。今のリストでの no. を自動解決する。
//   ##headword|表示文言##   参照先は headword だが、表示する文言を変えたい場合。
//   ==text==                キーワード強調（ハイライト）。
//   *text*                  語根・接辞などの強調（イタリック）。

const CROSSREF_RE = /##([^#|]+?)(?:\|([^#]+?))?##/g;
const HIGHLIGHT_RE = /==(.+?)==/g;
const ITALIC_RE = /\*(.+?)\*/g;

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

/**
 * 本文中に現れる登録済み見出し語を、明示的な ##参照## と同じ表示にする
 * レンダラーを作る。長い見出し語を優先し、英数字の途中では一致させない。
 * 見出し語一覧から正規表現を作る処理は初回だけなので、入力ごとのプレビューにも使える。
 * @param {Iterable<string>} headwords
 * @param {object} [opts] renderMarkup と同じオプション
 * @returns {(raw: string) => string}
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
  if (alternatives.length === 0) return (raw) => renderMarkup(raw, opts);

  // 日本語の助詞が直後に続く「importも参照」のような文でも一致させつつ、
  // enacted 内の act のようなラテン文字列の途中には一致させない。
  const plainHeadwordRe = new RegExp(
    `(^|[^\\p{Script=Latin}\\p{N}_])(${alternatives.join("|")})(?=$|[^\\p{Script=Latin}\\p{N}_])`,
    "giu"
  );

  return (raw) => {
    if (!raw) return "";

    // 明示済みの参照は一時退避し、その中を二重に自動参照しない。
    const explicitRefs = [];
    const protectedText = String(raw).replace(CROSSREF_RE, (match) => {
      const token = `\uE000${explicitRefs.length}\uE001`;
      explicitRefs.push(match);
      return token;
    });

    const withAutoRefs = protectedText.replace(plainHeadwordRe, (_match, prefix, matched) => {
      const canonical = canonicalByLower.get(matched.toLowerCase());
      if (!canonical) return `${prefix}${matched}`;
      const marker = canonical === matched ? `##${canonical}##` : `##${canonical}|${matched}##`;
      return `${prefix}${marker}`;
    });

    const restored = withAutoRefs.replace(/\uE000(\d+)\uE001/g, (_match, index) => explicitRefs[Number(index)] || "");
    return renderMarkup(restored, opts);
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
