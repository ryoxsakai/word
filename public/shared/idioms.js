import { parseWordListItems, stripMarkup } from "./markup.js";
import { IDIOM_CATALOG } from "./idiom-catalog.js";

// 表示先は親見出しではなく表現そのものから決める。put up with が endure に
// 収録されていても、put のSectionに載る。
const VERBS = "look see watch get let call take come stand break turn hand put pick go pull bring pass give make talk tell speak say catch keep set carry cut run work lay hang throw fall".split(" ");
const PREPOSITIONS = "in on out at for by from with without to of under over into off up down after before between beyond through around across against within".split(" ");
export const IDIOM_CHAPTERS = [
  { key: "verbs", subtitle: "基本動詞の熟語", sections: [...VERBS, "other-verbs"].map(key => ({ key, subtitle: key === "other-verbs" ? "その他の動詞" : key })) },
  { key: "be", subtitle: "beを使う表現", sections: [
    { key: "be-adjective", subtitle: "be＋形容詞・分詞" },
    { key: "be-preposition", subtitle: "be＋前置詞" },
    { key: "be-other", subtitle: "その他のbe表現" },
  ] },
  { key: "prepositions", subtitle: "前置詞を使う熟語", sections: PREPOSITIONS.map(key => ({ key: `prep-${key}`, subtitle: key })) },
  { key: "quantity", subtitle: "数量・程度の表現", sections: [
    { key: "quantity", subtitle: "数量・範囲" }, { key: "degree", subtitle: "程度・頻度" },
  ] },
  { key: "constructions", subtitle: "構文・つなぎの表現", sections: [
    { key: "comparison", subtitle: "比較" }, { key: "conjunction", subtitle: "条件・時・譲歩・理由" },
    { key: "construction", subtitle: "その他の構文" },
  ] },
  { key: "other", subtitle: "その他の定型表現", sections: [
    { key: "conversation", subtitle: "応答・呼びかけ" }, { key: "adverbial", subtitle: "副詞的な表現" },
    { key: "other", subtitle: "その他の語の組合せ" },
  ] },
];

function clean(value) {
  return stripMarkup(String(value || "")).replace(/～/g, "〜").replace(/\s+/g, " ").trim();
}

export function idiomKey(phrase) {
  // 目的語の位置は区別する（see through O と see O through は別用法）。
  return clean(phrase).replace(/[’‘]/g, "'").toLowerCase();
}

function catalogKey(phrase) {
  return clean(phrase).replace(/[’‘]/g, "'")
    .replace(/\ba person's\b/g, "one's")
    .replace(/\bto do\b/g, "to V").replace(/\bdoing\b/g, "Ving")
    .replace(/[〜～]\s*ing\b/g, "Ving")
    .replace(/\b(?:O|A|B|C|S|V|N|Ving|V-ed|V-ing)\b/g, " ")
    .replace(/節/g, " ").toLowerCase().match(/[a-z]+(?:['-][a-z]+)*/g)?.sort().join(" ") || "";
}

function catalogVariants(phrase) {
  const variants = new Set([phrase, phrase.replace(/\([^)]*\)/g, ""), phrase.replace(/[()]/g, "")]);
  for (const value of [...variants]) {
    const match = value.match(/\b([\w'-]+)\s*\/\s*([\w'-]+)\b/);
    if (match) for (const choice of [match[1], match[2]]) variants.add(value.replace(match[0], choice));
  }
  return [...variants].map(catalogKey).filter(Boolean);
}

const catalogKeys = new Set(IDIOM_CATALOG.flatMap(catalogVariants));

export function isCatalogIdiom(phrase) {
  return catalogVariants(phrase).some(key => catalogKeys.has(key));
}

export function classifyIdiom(phrase) {
  const text = idiomKey(phrase).replace(/^(?:\([^)]*\)\s*)+/, "");
  const first = text.match(/^[a-z]+/)?.[0] || "";
  if (/^(?:to say|not to say|needless to say|it goes without saying|it is not too much to say|that (?:is to say|said|being said)|having said|when all is said)/.test(text)) return "say";
  if (/^to tell the truth/.test(text)) return "tell";
  if (/^to make matters worse/.test(text)) return "make";
  if (/^(?:generally|strictly) speaking|^so to speak/.test(text)) return "speak";
  if (/^(?:blame|accuse|charge|cherry-pick)\b/.test(text)) return "other-verbs";
  if (/^not out of/.test(text)) return "prep-out";
  if (/^as (?:soon|long|far) as\b/.test(text)) return "conjunction";
  if (/^(?:a |an |the )?(?:couple|handful|number|lot|lots|great deal|plenty|amount|majority|minority)\b|^(?:some|any|no|many|much|few|little|all|both|each|every|either|neither)\b/.test(text)) return "quantity";
  if (/^(?:more or less|at (?:least|most|best|worst)|sooner or later|once in|every now|a bit|a little|to some extent)\b/.test(text)) return "degree";
  if (/^(?:as .+ as|(?:not |no )?(?:more|less|better|worse)|rather than|other than|the .+ the )/.test(text)) return "comparison";
  if (/^(?:as|if|unless|when|while|whether|although|though|even if|even though|now that|so that|in order that|provided|providing|given that|in case)\b/.test(text)) return "conjunction";
  if (first === "be") {
    if (PREPOSITIONS.includes(text.split(" ")[1])) return "be-preposition";
    return /^be (?:a |an |the |to )/.test(text) ? "be-other" : "be-adjective";
  }
  // 否定形・助動詞や複数動詞を含む併記も元の動詞のSectionに戻す。
  const base = text.replace(/^(?:cannot|can't|can|could|do not|don't|does not|did not|never)\s+/, "").match(/^[a-z]+/)?.[0];
  if (VERBS.includes(base)) return base;
  if (PREPOSITIONS.includes(first)) return `prep-${first}`;
  if (/^(?:i|i'll|i'm|you|you're|we|let's|what|how|long time|so i)\b/.test(text)) return "conversation";
  if (/\b(?:S V|to V|Ving|V-ed|O C)\b/.test(phrase) || /^(?:it|there|not only|the moment)\b/.test(text)) return "construction";
  if (/^(?:again|afterwards|all|almost|altogether|anyway|ever|never|once|so|still|then|thus|yet)\b/.test(text)) return "adverbial";
  return "other";
}

export function buildIdiomEntries(words, metadata = words) {
  const metaById = new Map((metadata || []).map(word => [String(word.id), word]));
  const entries = new Map();
  const add = (rawPhrase, rawMeaning, word, source) => {
    const phrase = clean(rawPhrase);
    const meaning = clean(rawMeaning);
    const meta = metaById.get(String(word.id));
    if (!meta || !isCatalogIdiom(phrase) || !meaning) return;
    const key = idiomKey(phrase);
    let entry = entries.get(key);
    if (!entry) {
      entry = { key, phrase, sectionKey: classifyIdiom(phrase), meanings: [] };
      entries.set(key, entry);
    }
    let sense = entry.meanings.find(item => item.meaning === meaning);
    if (!sense) {
      sense = { meaning, refs: [] };
      entry.meanings.push(sense);
    }
    if (!sense.refs.some(ref => ref.wordId === word.id)) sense.refs.push({
      wordId: word.id, spelling: word.spelling,
      no: String(meta.seqNo || meta.displayNo || ""), tags: meta.tags || word.tags || {}, source,
    });
  };
  for (const word of words || []) {
    for (const example of word.examples || []) {
      if (example.type === "phrase") add(example.sentence, example.translation, word, "phrase");
    }
    for (const field of ["relatedWords", "synonyms", "antonyms"]) {
      for (const item of parseWordListItems(word[field])) add(item.target, item.gloss, word, field);
    }
    // 複数語の見出し（as long as など）も対象。
    for (const sense of word.senses || []) add(word.spelling, sense.meaning, word, "headword");
  }
  return [...entries.values()].sort((a, b) => a.phrase.localeCompare(b.phrase, "en", { sensitivity: "base" }));
}

export function groupIdiomEntries(entries) {
  let sectionNumber = 0;
  return IDIOM_CHAPTERS.map((chapter, chapterIndex) => ({
    ...chapter, name: `Chapter ${chapterIndex + 1}`, tone: (chapterIndex % 6) + 1,
    sections: chapter.sections.map(section => ({
      ...section, items: entries.filter(entry => entry.sectionKey === section.key),
    })).filter(section => section.items.length).map(section => ({ ...section, name: `Section ${++sectionNumber}` })),
  })).filter(chapter => chapter.sections.length);
}
