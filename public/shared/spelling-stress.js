// Verified against the stored Voca readings. Key by both spelling and IPA so a
// future pronunciation change cannot silently inherit an incorrect highlight.
// These cover non one-to-one vowel alignment, optional sounds and rhotic vowels.
const VERIFIED_STRESS = new Map([

  ["mechanism|/ˈmek.ə.nɪ.zəm/", [1,2]],

  ["idea|/ɑeˈdiə̯/", [2,3]],

  ["literacy|/ˈlɪt.ɹə.si/", [1,2]],

  ["laboratory|/ləˈbɒr.ə.tri/", [3,4]],

  ["statement|/ˈsteɪtm(ə)nt/", [2,3]],

  ["sculpture|/ˈskʌlptj(ʊ)ə/", [2,3]],
  ["contemporary|/kənˈtem.pə.rer.i/", [4,5]],

  ["eventually|/ɪ.ˈvɛn.tjʊ.li/", [2,3]],

  ["ancient|/ˈeɪn.ʃənt/", [0,1]],

  ["tear|/ter/", [1,3]],
  ["share|/ʃɛə/", [2,3]],

  ["temporary|/ˈtɛmpəɹi/", [1,2]],

  ["vary|/ˈvɛəɹi/", [1,2]],
  ["disguise|/dɪsˈɡaɪz/", [5,6]],

  ["guarantee|/ˌɡer.ənˈtiː/", [7,9]],
  ["repair|/rɪˈper/", [3,5]],

  ["various|/ˈvɛə.ɹi.əs/", [1,2]],

  ["widespread|/ˈwaɪd.spred/", [1,2]],

  ["actual|/ˈak(t)ʃj(ʊ)əl/", [0,1]],

  ["concrete|/kɵnˈkɹiːt/", [5,6]],

  ["ordinary|/ˈɔːdənɹi/", [0,1]],
  ["efficient|/əˈfɪʃənt/", [3,4]],
  ["negative|/ˈnɛ(e)ɡəˌɾɪv/", [1,2]],

  ["worthwhile|/ˌwɜːrθˈwaɪl/", [7,8]],

  ["forecast|/ˈfɔːrkæst/", [1,2]],

  ["cruel|/kɹuː(ə)l/", [2,3]],
  ["fierce|/fɪəs/", [1,3]],

  ["awkward|/ˈɑkwɚd/", [0,2]],
  ['pure|/ˈpjɔː/', [1, 2]],

  ['rare|/rer/', [1, 2]],

  ['extraordinary|/ɪksˈtɹɔː(ɹ)dɪnəɹi/', [5, 6]],

]);

// Conservative display-only alignment. Ambiguous spellings keep their normal color.
const SOUNDS = {
  a: ['æ', 'eɪ', 'ɑ', 'ɒ', 'ɔ', 'ə', 'ɛ', 'a', 'ɪ'], e: ['e', 'ɛ', 'i', 'ɪ', 'ə', 'ɜ'],
  i: ['ʌɪ', 'ɪ', 'aɪ', 'i', 'ə', 'ɜ'], o: ['ɑ', 'ɐ', 'ɒ', 'ɔ', 'oʊ', 'əʊ', 'ʌ', 'u', 'ə'],
  u: ['ʌ', 'ʊ', 'u', 'ə', 'ɜ'], y: ['ɪ', 'i', 'aɪ', 'ə'],
  ai: ['eɪ', 'ɛ'], ay: ['eɪ'], au: ['ɔ', 'ɑ'], aw: ['ɔ', 'ɑ'],
  ea: ['i', 'ɛ', 'eɪ'], ee: ['i'], ei: ['eɪ', 'i', 'aɪ'], ey: ['eɪ', 'i'],
  ie: ['i', 'aɪ'], oa: ['oʊ', 'əʊ'], oe: ['oʊ', 'əʊ'],
  oi: ['ɔɪ'], oy: ['ɔɪ'], oo: ['u', 'ʊ'], ou: ['ə', 'ɔ', 'aʊ', 'ʌ', 'u', 'oʊ', 'əʊ'],
  ow: ['aʊ', 'oʊ', 'əʊ'], iew: ['u'], eau: ['u'], ue: ['u'], ui: ['u', 'ɪ'],
};

// General alignment, exported separately so tests cannot be satisfied by overrides.
// Explore vowel spellings; only return a span when every successful alignment agrees.
export function inferStressedSpellingRange(spelling, pronunciation) {
  if (!/^[a-z]{1,64}$/i.test(spelling || '') || typeof pronunciation !== 'string' || pronunciation.length > 200) return null;
  const word = spelling.toLowerCase();
  let ipa = pronunciation.trim().normalize('NFD');
  // Keep syllabic consonants as a nucleus before removing combining marks.
  ipa = ipa.replace(/([lnm])\u0329/g, 'ə$1')
    .replace(/[\u0300-\u036fːˑ]/g, '')
    .replace(/^[/\[]|[/\]]$/g, '')
    .replace(/ɚ/g, 'ə').replace(/ɝ/g, 'ɜ').replace(/ɨ/g, 'ɪ').replace(/ʉ/g, 'u').replace(/ɫ/g, 'l');
  // Parentheses containing optional consonants do not change vowel alignment.
  // Optional schwa is expanded both ways; competing stress spans remain ambiguous.
  if (!/^[a-zɑɒɔæəɛɜɪʊʌɐɹɾɡŋʃʒθðʔˈˌ.()]+$/u.test(ipa)) return null;
  const optional = [...ipa.matchAll(/\(([əɹrjtnl])\)/g)];
  if (optional.length > 3 || ipa.replace(/\(([əɹrjtnl])\)/g, '').match(/[()]/)) return null;
  let variants = [ipa];
  for (const match of optional) variants = variants.flatMap(v => [v.replace(match[0], match[1]), v.replace(match[0], '')]);
  const spans = new Set();
  for (const variant of new Set(variants)) {
    const nuclei = [...variant.matchAll(/aɪ|ʌɪ|aʊ|eɪ|oʊ|əʊ|ɔɪ|[aeiouɑɒɔæəɛɜɪʊʌɐ]/gu)];
    const primary = [...variant.matchAll(/ˈ/g)];
    if (!nuclei.length || primary.length > 1) return null;
    const stressed = primary.length ? nuclei.findIndex(n => n.index > primary[0].index) : nuclei.length === 1 ? 0 : -1;
    if (stressed < 0) return null;
    const visited = new Set();
    function align(pos, sound, span) {
      const key = `${pos}:${sound}:${span}`;
      if (visited.has(key)) return;
      visited.add(key);
      if (pos === word.length) {
        if (sound === nuclei.length && span) spans.add(span);
        return;
      }
      if (!/[aeiouy]/.test(word[pos])) {
        // A written w without /w/ belongs to aw/ow, not a silent consonant.
        if (word[pos] === 'w' && /[ao]/.test(word[pos - 1] || '') && !variant.includes('w')) return;
        align(pos + 1, sound, span); return;
      }
      // Silent terminal e, including -gue/-que, is an alternative, never assumed.
      if (word[pos] === 'e' && pos === word.length - 1 && !/[aeiouy]/.test(word[pos - 1] || '')) align(pos + 1, sound, span);
      if (word[pos] === 'u' && (word[pos - 1] === 'q' || (word[pos - 1] === 'g' && /[gɡ]w/.test(variant))) && /[aeio]/.test(word[pos + 1] || '')) align(pos + 1, sound, span);
      if (word.slice(pos) === 'ue' && /[gq]/.test(word[pos - 1] || '')) align(word.length, sound, span);
      if (sound >= nuclei.length) return;
      for (let length = 1; length <= 3 && pos + length <= word.length; length++) {
        const letters = word.slice(pos, pos + length);
        if (letters.startsWith('u') && word[pos - 1] === 'g' && /[gɡ]w/.test(variant)) continue;
        let sounds = SOUNDS[letters];
        // -tion/-sion/-cian: i is part of the consonant spelling.
        if ((letters === 'io' || letters === 'ia') && /[tsc]/.test(word[pos - 1] || '')) sounds = ['ə'];
        if (!sounds?.includes(nuclei[sound][0])) continue;
        align(pos + length, sound + 1, sound === stressed ? `${pos},${pos + length}` : span);
      }
    }
    align(0, 0, null);
  }
  return spans.size === 1 ? [...spans][0].split(',').map(Number) : null;
}

export function stressedSpellingRange(spelling, pronunciation) {
  if (!/^[a-z]+$/i.test(spelling || '') || !pronunciation) return null;
  const verified = VERIFIED_STRESS.get(`${spelling.toLowerCase()}|${pronunciation.trim()}`);
  return verified ? [...verified] : inferStressedSpellingRange(spelling, pronunciation);
}

export function renderStressedSpelling(spelling, pronunciation, escapeHtml) {
  const range = stressedSpellingRange(spelling, pronunciation);
  if (!range) return escapeHtml(spelling);
  const [start, end] = range;
  return escapeHtml(spelling.slice(0, start)) + '<span class="spelling-stress">' +
    escapeHtml(spelling.slice(start, end)) + '</span>' + escapeHtml(spelling.slice(end));
}
