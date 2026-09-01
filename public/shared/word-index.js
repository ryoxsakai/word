import { parseWordListItems, stripMarkup } from "./markup.js";

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

/**
 * 見出し語と、派生語・類義語・対義語・関連語から見出し語へ戻る参照をまとめた索引を作る。
 * 同じ参照語が複数の見出し語に属する場合は、派生語・類義語・対義語・関連語の順で
 * 参照先を1件に絞る。同じ種類では、単語帳で先に現れる見出し語を優先する。
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

  const referencePriority = {
    derivative: 0,
    synonyms: 1,
    antonyms: 2,
    relatedWords: 3,
  };
  const bestReferenceBySpelling = new Map();

  const addReferenceCandidate = (rawSpelling, targetWord, kind) => {
    const spelling = stripMarkup(rawSpelling).trim();
    const targetSpelling = String(targetWord?.spelling || "").trim();
    if (!spelling || !targetSpelling || !targetWord?.id) return;

    const key = spelling.toLowerCase();
    if (headwordKeys.has(key)) return;

    const candidate = {
      spelling,
      targetWord,
      priority: referencePriority[kind],
    };
    const existing = bestReferenceBySpelling.get(key);
    if (!existing || candidate.priority < existing.priority) {
      bestReferenceBySpelling.set(key, candidate);
    }
  };

  for (const word of sourceWords) {
    for (const derivative of word?.derivatives || []) {
      addReferenceCandidate(
        typeof derivative === "string" ? derivative : derivative?.word,
        word,
        "derivative"
      );
    }
    for (const field of ["synonyms", "antonyms", "relatedWords"]) {
      for (const item of parseWordListItems(word?.[field])) {
        addReferenceCandidate(item.target, word, field);
      }
    }
  }

  for (const { spelling, targetWord } of bestReferenceBySpelling.values()) {
    const targetSpelling = String(targetWord.spelling).trim();
    const targetLocation = targetWord.seqNo != null ? " " + targetWord.seqNo : "";
    entries.push({
      spelling,
      loc: "→ " + targetSpelling + targetLocation,
      targetId: targetWord.id,
      isRef: true,
    });
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
