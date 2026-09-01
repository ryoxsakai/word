import { stripMarkup } from "./markup.js";

export async function fetchCompleteWordIndex(fetchPage, pageSize = 300) {
  const index = new Map();
  let offset = 0;
  while (true) {
    const result = await fetchPage(offset, pageSize);
    for (const word of result.words) {
      index.set(word.spelling.toLowerCase(), { id: word.id, no: null });
    }
    if (!result.hasMore || result.words.length === 0) break;
    offset += result.words.length;
  }
  return index;
}

function splitReferenceTerms(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,;；、]/)
    .map((part) => stripMarkup(part))
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 見出し語と、派生語・類義語・対義語・関連語から見出し語へ戻る参照をまとめた索引を作る。
 * 同じ参照語が複数の見出し語に属する場合は、対応関係を失わないよう見出し語ごとに表示する。
 * 独立した見出し語がある場合は、その見出し語だけを表示する。
 */
export function buildAlphabeticalIndexEntries(words) {
  const sourceWords = words || [];
  const entries = [];
  const headwordKeys = new Set();

  for (const word of sourceWords) {
    const spelling = String(word?.spelling || "").trim();
    if (!spelling) continue;
    headwordKeys.add(spelling.toLowerCase());
    entries.push({
      spelling,
      loc: word.seqNo,
      targetId: word.id,
      isRef: false,
    });
  }

  const seenReferences = new Set();
  const addReference = (rawSpelling, targetWord) => {
    const spelling = stripMarkup(rawSpelling).trim();
    const targetSpelling = String(targetWord?.spelling || "").trim();
    if (!spelling || !targetSpelling || !targetWord?.id) return;

    const key = spelling.toLowerCase();
    if (headwordKeys.has(key)) return;

    const referenceKey = `${key}\u0000${targetWord.id}`;
    if (seenReferences.has(referenceKey)) return;
    seenReferences.add(referenceKey);

    const targetLocation = targetWord.seqNo != null ? ` ${targetWord.seqNo}` : "";
    entries.push({
      spelling,
      loc: `→ ${targetSpelling}${targetLocation}`,
      targetId: targetWord.id,
      isRef: true,
    });
  };

  for (const word of sourceWords) {
    for (const derivative of word?.derivatives || []) {
      addReference(typeof derivative === "string" ? derivative : derivative?.word, word);
    }
    for (const field of ["synonyms", "antonyms", "relatedWords"]) {
      for (const term of splitReferenceTerms(word?.[field])) addReference(term, word);
    }
  }

  entries.sort((a, b) => {
    const spellingOrder = a.spelling.localeCompare(b.spelling, "en", { sensitivity: "base" });
    if (spellingOrder !== 0) return spellingOrder;
    return String(a.loc || "").localeCompare(String(b.loc || ""), "en", {
      numeric: true,
      sensitivity: "base",
    });
  });
  return entries;
}
