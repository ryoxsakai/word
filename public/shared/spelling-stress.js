// Verified against the stored Voca readings. Key by both spelling and IPA so a
// future pronunciation change cannot silently inherit an incorrect highlight.
// These cover non one-to-one vowel alignment, optional sounds and rhotic vowels.
const VERIFIED_STRESS = new Map([
  ["contemporary|/kənˈtem.pə.rer.i/", [4,5]],
  ["version|/ˈvɜːʃən/", [1,2]],
  ["current|/ˈkɝː.ənt/", [1,2]],
  ["session|/ˈsɛʃən/", [1,2]],
  ["occasion|/əˈkeɪʒən/", [3,4]],
  ["frequent|/ˈfriː.kwənt/", [2,3]],
  ["initial|/ɪˈnɪʃəl/", [2,3]],
  ["immediate|/ɪˈmiːdɪət/", [3,4]],
  ["eventually|/ɪ.ˈvɛn.tjʊ.li/", [2,3]],
  ["annual|/ˈæn.ju.əl/", [0,1]],
  ["ancient|/ˈeɪn.ʃənt/", [0,1]],
  ["previous|/ˈpɹiːvɪəs/", [2,3]],
  ["tear|/ter/", [1,3]],
  ["share|/ʃɛə/", [2,3]],
  ["deliver|/dɪˈlɪvə(ɹ)/", [3,4]],
  ["route|/ɹʉːt/", [1,3]],
  ["destination|/dɛstɪˈneɪʃən/", [6,7]],
  ["temporary|/ˈtɛmpəɹi/", [1,2]],
  ["stable|/ˈsteɪ.bəɫ/", [2,3]],
  ["alter|/ˈɑl.tɚ/", [0,1]],
  ["vary|/ˈvɛəɹi/", [1,2]],
  ["disguise|/dɪsˈɡaɪz/", [5,6]],
  ["ruin|/ˈɹuː.ɪn/", [1,2]],
  ["bite|/bʌɪt/", [1,2]],
  ["draw|/dɹɔː/", [2,4]],
  ["guarantee|/ˌɡer.ənˈtiː/", [7,9]],
  ["repair|/rɪˈper/", [3,5]],
  ["acquire|/əˈkwaɪə/", [4,5]],
  ["innovation|/ˌɪnəˈveɪʃən/", [5,6]],
  ["accomplish|/əˈkɐm.plɪʃ/", [3,4]],
  ["create|/kriˈeɪt/", [3,4]],
  ["advance|/ədˈvaːns/", [3,4]],
  ["accurate|/ˈæk.jə.ɹɪt/", [0,1]],
  ["various|/ˈvɛə.ɹi.əs/", [1,2]],
  ["universal|/ˌjuːnɪˈvɜːsl̩/", [4,5]],
  ["widespread|/ˈwaɪd.spred/", [1,2]],
  ["quantity|/ˈkwɑndədi/", [2,3]],
  ["numerous|/ˈnjuːməɹəs/", [1,2]],
  ["gradual|/ˈɡrædʒuəl/", [2,3]],
  ["actual|/ˈak(t)ʃj(ʊ)əl/", [0,1]],
  ["unknown|/ʌnˈnəʊn/", [4,6]],
  ["visible|/ˈvɪzəb(ə)l/", [1,2]],
  ["potential|/pəˈtɛnʃəl/", [3,4]],
  ["concrete|/kɵnˈkɹiːt/", [5,6]],
  ["rational|/ˈɹæʃ(ə)nəl/", [1,2]],
  ["conventional|/kənˈven.ʃən.əl/", [4,5]],
  ["ordinary|/ˈɔːdənɹi/", [0,1]],
  ["efficient|/əˈfɪʃənt/", [3,4]],
  ["negative|/ˈnɛ(e)ɡəˌɾɪv/", [1,2]],
  ["quality|/ˈkwɒlɪti/", [2,3]],
  ["worthwhile|/ˌwɜːrθˈwaɪl/", [7,8]],
  ["trivial|/ˈtrɪviəl/", [2,3]],
  ["vague|/veɪɡ/", [1,2]],
  ["forecast|/ˈfɔːrkæst/", [1,2]],
  ["option|/ˈɒpʃən/", [0,1]],
  ["novel|/ˈnɒvl̩/", [1,2]],
  ["modest|/ˈmɑdəst/", [1,2]],
  ["sincere|/sɪnˈsɪə(ɹ)/", [4,5]],
  ["cruel|/kɹuː(ə)l/", [2,3]],
  ["fierce|/fɪəs/", [1,3]],
  ["loyal|/ˈlɔɪəl/", [1,3]],
  ["spontaneous|/spɒnˈteɪniəs/", [5,6]],
  ["awkward|/ˈɑkwɚd/", [0,2]],
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
