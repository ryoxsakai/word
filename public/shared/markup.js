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
  let html = escapeHtml(raw);

  html = html.replace(CROSSREF_RE, (_match, headwordRaw, displayRaw) => {
    const headword = headwordRaw.trim();
    const label = (displayRaw ? displayRaw.trim() : headword);
    const result = resolve ? resolve(headword) : null;

    if (!result || !result.found) {
      return `<span class="ref ref-missing" data-headword="${escapeHtml(headword)}" title="未登録の見出し語です">${escapeHtml(label)}</span>`;
    }
    const noSuffix = result.no != null ? ` (no.${result.no})` : "";
    return `<a href="#word-${escapeHtml(result.id)}" class="ref" data-headword="${escapeHtml(headword)}" data-word-id="${escapeHtml(result.id)}">${escapeHtml(label)}${escapeHtml(noSuffix)}</a>`;
  });

  html = html.replace(HIGHLIGHT_RE, (_m, inner) => `<mark>${inner}</mark>`);
  html = html.replace(ITALIC_RE, (_m, inner) => `<em>${inner}</em>`);

  return html;
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
