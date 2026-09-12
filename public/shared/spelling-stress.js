// Verified against the stored Voca readings. Key by both spelling and IPA so a
// future pronunciation change cannot silently inherit an incorrect highlight.
// These cover non one-to-one vowel alignment, optional sounds and rhotic vowels.
const VERIFIED_STRESS = new Map([
  ['pure|/ˈpjɔː/', [1, 2]],
  ['subtle|/ˈsʌt(ə)l/', [1, 2]],
  ['rare|/rer/', [1, 2]],
  ['minor|/ˈmaɪnɚ/', [1, 2]],
  ['obvious|/ˈɒ.vɪəs/', [0, 1]],
  ['extraordinary|/ɪksˈtɹɔː(ɹ)dɪnəɹi/', [5, 6]],
  ['enormous|/ɪˈnɔː(ɹ)məs/', [2, 3]],
]);

// Conservative display-only alignment. Ambiguous spellings keep their normal color.
const SOUNDS = {
  a: ['æ', 'eɪ', 'ɑ', 'ɒ', 'ɔ', 'ə', 'ɛ'], e: ['e', 'ɛ', 'i', 'ɪ', 'ə', 'ɜ'],
  i: ['ɪ', 'aɪ', 'i', 'ə', 'ɜ'], o: ['ɒ', 'ɔ', 'oʊ', 'əʊ', 'ʌ', 'u', 'ə'],
  u: ['ʌ', 'ʊ', 'u', 'ə', 'ɜ'], y: ['ɪ', 'i', 'aɪ', 'ə'],
  ai: ['eɪ', 'ɛ'], ay: ['eɪ'], au: ['ɔ', 'ɑ'], aw: ['ɔ'],
  ea: ['i', 'ɛ', 'eɪ'], ee: ['i'], ei: ['eɪ', 'i', 'aɪ'], ey: ['eɪ', 'i'],
  ie: ['i', 'aɪ'], oa: ['oʊ', 'əʊ'], oe: ['oʊ', 'əʊ'],
  oi: ['ɔɪ'], oy: ['ɔɪ'], oo: ['u', 'ʊ'], ou: ['aʊ', 'ʌ', 'u', 'oʊ', 'əʊ'],
  ow: ['aʊ', 'oʊ', 'əʊ'], ue: ['u'], ui: ['u', 'ɪ'],
};

export function stressedSpellingRange(spelling, pronunciation) {
  if (!/^[a-z]+$/i.test(spelling || '') || !pronunciation) return null;
  const verified = VERIFIED_STRESS.get(`${spelling.toLowerCase()}|${pronunciation.trim()}`);
  if (verified) return [...verified];
  const ipa = pronunciation.normalize('NFD').replace(/[\u0300-\u036fːˑ/\[\]]/g, '');
  // Multiple variants and unfamiliar notation are intentionally not guessed.
  if (!/^[a-zɑɒɔæəɚɛɜɪʊʌɐɹɾɡŋʃʒθðʔˈˌ.]+$/u.test(ipa)) return null;
  const nuclei = [...ipa.matchAll(/aɪ|aʊ|eɪ|oʊ|əʊ|ɔɪ|[aeiouɑɒɔæəɚɛɜɪʊʌɐ]/gu)];
  const primary = [...ipa.matchAll(/ˈ/g)];
  if (!nuclei.length || primary.length > 1) return null;
  const stressed = primary.length ? nuclei.findIndex(n => n.index > primary[0].index) : nuclei.length === 1 ? 0 : -1;
  if (stressed < 0) return null;
  const word = spelling.toLowerCase();
  const groups = [...word.matchAll(/[aeiouy]+/g)];
  // A final isolated e is silent only when removing it reconciles the vowel counts.
  if (groups.length === nuclei.length + 1 && groups.at(-1)[0] === 'e' && groups.at(-1).index === word.length - 1) groups.pop();
  if (groups.length !== nuclei.length) return null;
  if (!groups.every((g, i) => SOUNDS[g[0]]?.includes(nuclei[i][0]))) return null;
  const group = groups[stressed];
  return [group.index, group.index + group[0].length];
}

export function renderStressedSpelling(spelling, pronunciation, escapeHtml) {
  const range = stressedSpellingRange(spelling, pronunciation);
  if (!range) return escapeHtml(spelling);
  const [start, end] = range;
  return escapeHtml(spelling.slice(0, start)) + '<span class="spelling-stress">' +
    escapeHtml(spelling.slice(start, end)) + '</span>' + escapeHtml(spelling.slice(end));
}
