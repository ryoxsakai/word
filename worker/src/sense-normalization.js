/**
 * 語義欄の辞書風全角括弧を、表示・検索しやすい半角括弧へ統一する。
 * 語義以外の欄には適用しない。
 */
export function normalizeSenseMeaning(value) {
  if (value === null || value === undefined) return value;
  return String(value).replace(/[〔【]/gu, "(").replace(/[〕】]/gu, ")");
}
