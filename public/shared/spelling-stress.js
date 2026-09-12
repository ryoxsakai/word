// Conservative display-only alignment. Ambiguous spellings keep their normal color.
const SOUNDS = {
  a: ['æ', 'eɪ', 'ɑ', 'ɒ', 'ɔ', 'ə', 'ɛ', 'a', 'ɪ'], e: ['e', 'ɛ', 'i', 'ɪ', 'ə', 'ɜ'],
  i: ['ʌɪ', 'ɪ', 'aɪ', 'i', 'ə', 'ɜ'], o: ['ɑ', 'ɐ', 'ɒ', 'ɔ', 'oʊ', 'əʊ', 'ʌ', 'u', 'ə'],
  u: ['ʌ', 'ʊ', 'u', 'ə', 'ɜ'], y: ['ɪ', 'i', 'aɪ', 'ə'],
  ai: ['eɪ', 'ɛ', 'aɪ'], ay: ['eɪ'], au: ['ɔ', 'ɑ', 'ɒ'], aw: ['ɔ', 'ɑ'],
  ea: ['i', 'ɛ', 'eɪ', 'e'], ee: ['i'], ei: ['eɪ', 'i', 'aɪ', 'e'], ey: ['eɪ', 'i'],
  ie: ['i', 'aɪ'], oa: ['oʊ', 'əʊ'], oe: ['oʊ', 'əʊ'],
  oi: ['ɔɪ'], oy: ['ɔɪ'], oo: ['u', 'ʊ'], ou: ['ə', 'ɔ', 'aʊ', 'ʌ', 'u', 'oʊ', 'əʊ'],
  ew: ['u', 'əʊ', 'oʊ'], ueue: ['u'], ow: ['aʊ', 'oʊ', 'əʊ'], iew: ['u'], eau: ['u'], ue: ['u'], ui: ['u', 'ɪ'],
};

// General alignment, also exported for direct regression testing.
// Explore vowel spellings; only return a span when every successful alignment agrees.
export function inferStressedSpellingRange(spelling, pronunciation) {
  if (!/^[a-z]{1,64}$/i.test(spelling || '') || typeof pronunciation !== 'string' || pronunciation.length > 200) return null;
  const word = spelling.toLowerCase();
  let ipa = pronunciation.trim().normalize('NFD');
  const optionalSchwaOnly = ipa.includes('(ə)') && !ipa.includes('ˈ') && !ipa.includes('ˌ');
  // Keep syllabic consonants as a nucleus before removing combining marks.
  ipa = ipa.replace(/ʃn(?=[/\]]?$)/g, 'ʃən').replace(/([lnm])\u0329/g, 'ə$1')
    .replace(/[\u0300-\u036fːˑ]/g, '')
    .replace(/^[/\[]|[/\]]$/g, '')
    .replace(/ɚ/g, 'ə').replace(/ɝ/g, 'ɜ').replace(/ɵ/g, 'ə').replace(/ɨ/g, 'ɪ').replace(/ʉ/g, 'u').replace(/ɫ/g, 'l');
  // Parentheses containing optional consonants do not change vowel alignment.
  // Optional vowels are expanded both ways; competing stress spans remain ambiguous.
  if (!/^[a-zɑɒɔæəɛɜɪʊʌɐɹɾɡŋʃʒθðʔˈˌ.()]+$/u.test(ipa)) return null;
  const optional = [...ipa.matchAll(/\(([əɪʊɹrjptnl])\)/g)];
  if (optional.length > 3 || ipa.replace(/\(([əɪʊɹrjptnl])\)/g, '').match(/[()]/)) return null;
  let variants = [ipa];
  for (const match of optional) variants = variants.flatMap(v => [v.replace(match[0], match[1]), v.replace(match[0], '')]);
  const spans = new Set();
  for (const variant of new Set(variants)) {
    const nuclei = [...variant.matchAll(/aɪ|ʌɪ|aʊ|eɪ|oʊ|əʊ|ɔɪ|[aeiouɑɒɔæəɛɜɪʊʌɐ]/gu)];
    const primary = [...variant.matchAll(/ˈ/g)];
    if (!nuclei.length || primary.length > 1) return null;
    const mandatoryNuclei = [...ipa.replace(/\(ə\)/g, '').replace(/[()]/g, '').matchAll(/aɪ|ʌɪ|aʊ|eɪ|oʊ|əʊ|ɔɪ|[aeiouɑɒɔæəɛɜɪʊʌɐ]/gu)];
    const stressed = primary.length ? nuclei.findIndex(n => n.index > primary[0].index) : ((optionalSchwaOnly && mandatoryNuclei.length === 1) || nuclei.length === 1 || (nuclei.length === 2 && /^(ɪə|ɛə|eə|ʊə)$/.test(nuclei.map(n => n[0]).join('')) && !/[.ˌ]/.test(variant))) ? 0 : -1;
    if (stressed < 0) return null;
    const visited = new Set();
    function align(pos, sound, span) {
      const key = `${pos}:${sound}:${span}`;
      if (visited.has(key)) return;
      visited.add(key);
      if (sound < nuclei.length && nuclei[sound][0] === 'ə' && sound !== stressed && word.slice(pos) === 'm' && word.endsWith('ism')) {
        // Final -ism may realize an unwritten schwa before m.
        align(pos, sound + 1, span);
      }
      if (pos === word.length) {
        if (sound === nuclei.length && span) spans.add(span);
        return;
      }
      if (!/[aeiouy]/.test(word[pos])) {
        // A written w without /w/ belongs to aw/ow, not a silent consonant.
        if (word[pos] === 'w' && /[ao]/.test(word[pos - 1] || '')) {
          const written = (word.slice(pos).match(/^[^aeiouy]*/)[0].match(/w/g) || []).length;
          const previous = nuclei[sound - 1];
          const gap = variant.slice(previous ? previous.index + previous[0].length : 0, nuclei[sound]?.index ?? variant.length);
          if (written > (gap.match(/w/g) || []).length) return;
        }
        align(pos + 1, sound, span); return;
      }
      // Silent terminal e, including -gue/-que, is an alternative, never assumed.
      // Reduced -ually retains the stressed stem vowel; extra- may coalesce a+o.
      if (span && word.slice(pos) === 'ally' && word[pos - 1] === 'u') align(pos + 1, sound, span);
      if (pos === 4 && word.startsWith('extrao') && nuclei[sound]?.[0] === 'ɔ') align(pos + 1, sound, span);
      // Weak vowels in -ary/-ory/-ery/-eracy may be absent in the registered reading.
      // Only after the stressed vowel has already been aligned.
      if (span && /^[aeo]r(?:y|ies|ily|acy)$/.test(word.slice(pos))) align(pos + 1, sound, span);
      if (optionalSchwaOnly && word[pos] === 'e' && word[pos - 1] === 'u' && word.slice(pos + 1) === 'l') align(pos + 1, sound, span);
      if (word[pos] === 'e' && pos === word.length - 1 && !/[aeiouy]/.test(word[pos - 1] || '')) align(pos + 1, sound, span);
      if (word[pos] === 'u' && word[pos - 1] === 'g' && /[aei]/.test(word[pos + 1] || '') && /[gɡ]/.test(variant)) align(pos + 1, sound, span);
      if (word[pos] === 'u' && (word[pos - 1] === 'q' || (word[pos - 1] === 'g' && /[gɡ]w/.test(variant))) && /[aeio]/.test(word[pos + 1] || '')) align(pos + 1, sound, span);
      if (word.slice(pos) === 'yer' && pos > 1 && word.slice(pos - 2, pos) === 'aw' && nuclei[sound - 1]?.[0] === 'ɔɪ') align(pos + 1, sound, span);
      if (word.slice(pos) === 'ue' && /[gq]/.test(word[pos - 1] || '')) align(word.length, sound, span);
      // Internal silent e at a long-vowel morpheme boundary (e.g. wide-spread).
      if (word[pos] === 'e' && sound > 0 && /^(aɪ|eɪ|i|ɔ|ɜ|oʊ|əʊ)$/.test(nuclei[sound - 1][0]) && /[bcdfgklmnprstvwz]/.test(word[pos + 1] || '') && /[bcdfgklmnprstvwz]/.test(word[pos - 1] || '')) align(pos + 1, sound, span);
      if (sound >= nuclei.length) return;
      // Splitting a vowel digraph cannot span an intervening pronounced consonant.
      if (sound > 0 && SOUNDS[word.slice(pos - 1, pos + 1)] && !(word[pos - 1] === 'u' && /[gq]/.test(word[pos - 2] || ''))) {
        const previous = nuclei[sound - 1];
        const gap = variant.slice(previous.index + previous[0].length, nuclei[sound].index);
        if (/[^.ˈˌjw]/.test(gap)) return;
      }
      for (let length = 1; length <= 4 && pos + length <= word.length; length++) {
        const letters = word.slice(pos, pos + length);
        if (length === 1 && /^(ie|ea)r/.test(word.slice(pos)) && ['ɪə','ɛə','eə'].includes(nuclei[sound][0] + (nuclei[sound + 1]?.[0] || ''))) continue;
        if (letters.startsWith('u') && word[pos - 1] === 'g' && /[gɡ]w/.test(variant)) continue;
        let sounds = SOUNDS[letters];
        if (letters === 'e' && pos === 0) sounds = [...sounds, 'eɪ'];
        if (letters === 'aw' && word.slice(pos + length) === 'yer') sounds = [...sounds, 'ɔɪ'];
        if (letters === 'ue' && optionalSchwaOnly && word[pos + length] === 'l') continue;
        const beforeR = word[pos + length] === 'r';
        if (beforeR && ['a', 'ea', 'ai'].includes(letters)) sounds = [...(sounds || []), 'e'];
        if (beforeR && letters === 'ea') sounds = [...sounds, 'ɜ'];
        if (beforeR && letters === 'o') sounds = [...sounds, 'ɜ'];
        if (beforeR && letters === 'u') sounds = [...sounds, 'ɔ'];
        // A centering diphthong before r maps to one vowel spelling (care, near, pure).
        const center = nuclei[sound][0] + (nuclei[sound + 1]?.[0] || '');
        const centers = {a:['ɛə','eə'], e:['ɪə'], i:['ɪə'], u:['ʊə'], o:['oə'], ea:['ɪə','ɛə','eə'], ai:['ɛə','eə'], ie:['ɪə']};
        if (beforeR && centers[letters]?.includes(center) && sound + 1 !== stressed) {
          align(pos + length, sound + 2, sound === stressed ? `${pos},${pos + length}` : span);
        }
        // -tion/-sion/-cian: i is part of the consonant spelling.
        if (letters === 'ie' && /[ct]/.test(word[pos - 1] || '') && variant.includes('ʃ')) sounds = ['ə', 'i'];
        if ((letters === 'io' || letters === 'ia') && /[tscg]/.test(word[pos - 1] || '')) sounds = ['ə'];
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
  return inferStressedSpellingRange(spelling, pronunciation);
}

export function renderStressedSpelling(spelling, pronunciation, escapeHtml) {
  const range = stressedSpellingRange(spelling, pronunciation);
  if (!range) return escapeHtml(spelling);
  const [start, end] = range;
  return escapeHtml(spelling.slice(0, start)) + '<span class="spelling-stress">' +
    escapeHtml(spelling.slice(start, end)) + '</span>' + escapeHtml(spelling.slice(end));
}
