import { escapeHtml } from './markup.js';

// Exact phrase overrides use zero-based English-token positions. An empty array
// suppresses all highlights. Keep these separate from spelling and DB identity.
export const IDIOM_PREPOSITION_OVERRIDES = new Map([
  ['hand o in', []], ['hand in', []], ['give up', []], ['give in', []], ['take off', []], ['put off', []],
  ['come about', []], ['get by', []], ['bring about', []],
  ['look forward to', [2]], ['be used to', [2]], ['used to', []],
]);
const PREPOSITIONS = new Set('of in on at by for from with without into onto upon within beyond among between against despite during through throughout toward towards underneath beneath beside besides'.split(' '));
const DUAL_USE = new Set('as about above across after along around before behind below down inside near off opposite outside over past round since under until up'.split(' '));
const PREPOSITIONAL_TO = /\b(?:according|owing|due|thanks|prior|subsequent|contrary|subject|opposed|accustomed|addicted|allergic|committed|devoted|dedicated|related|similar|equal|superior|inferior|junior|senior|next|close|refer|refers|referred|referring|belong|belongs|belonged|belonging|listen|listens|listened|listening|object|objects|objected|objecting|resort|resorts|resorted|resorting|contribute|contributes|contributed|contributing|lead|leads|led|leading|amount|amounts|amounted|amounting|look forward|be used|get used)\s+$/i;
const NOMINAL = /^(?:[A-Z]|O|A|B|N|Ving|V-ing|doing|being|having|someone|somebody|something|one|oneself|you|me|him|her|us|them|it|this|that|the|a|an|my|your|his|its|our|their)$/;

export function renderIdiomPrepositions(phrase, override) {
  const text = String(phrase ?? '');
  const tokens = [...text.matchAll(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g)];
  const exact = IDIOM_PREPOSITION_OVERRIDES.get(text.trim().replace(/\s+/g, ' ').toLowerCase());
  const selected = override ?? exact;
  const ranges = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i], word = token[0].toLowerCase();
    const next = tokens[i + 1];
    if (selected !== undefined) {
      if (selected.includes(i)) ranges.push([token.index, token.index + token[0].length]);
      continue;
    }
    if (word === 'out' && next?.[0].toLowerCase() === 'of' && /^\s+$/.test(text.slice(token.index + token[0].length, next.index))) {
      ranges.push([token.index, next.index + next[0].length]); i++; continue;
    }
    let highlight = PREPOSITIONS.has(word);
    // Ambiguous particles require an overt object; leave uncertain cases plain.
    if (DUAL_USE.has(word)) highlight = !!next && (NOMINAL.test(next[0]) || /ing$/i.test(next[0]));
    if (word === 'as' && next && /^(?:if|though|soon|long|far|well|much|many)$/i.test(next[0])) highlight = false;
    if (word === 'to') highlight = PREPOSITIONAL_TO.test(text.slice(0, token.index)) || !!next && (NOMINAL.test(next[0]) || /ing$/i.test(next[0]));
    if (word === 'to' && next && /^(?:V|do|be|have)$/i.test(next[0])) highlight = false;
    // Separable phrasal verbs: the particle remains an adverb on either side of O.
    const before = text.slice(0, token.index).trim().toLowerCase();
    if (word === 'in' && /^(?:hand|give|turn|let|bring|take|fill|check|break|come)(?:\s+o)?$/.test(before)) highlight = false;
    if (word === 'on' && /^(?:put|try|carry|go|keep|hold|turn|switch)(?:\s+o)?$/.test(before)) highlight = false;
    if (highlight) ranges.push([token.index, token.index + token[0].length]);
  }
  let cursor = 0, html = '';
  for (const [start, end] of ranges) {
    html += escapeHtml(text.slice(cursor, start)) + '<span class="idiom-preposition">' + escapeHtml(text.slice(start, end)) + '</span>';
    cursor = end;
  }
  return html + escapeHtml(text.slice(cursor));
}
