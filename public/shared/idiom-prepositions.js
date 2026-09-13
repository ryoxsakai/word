import { escapeHtml } from './markup.js';

// Exact phrase overrides use zero-based English-token positions. An empty array
// suppresses all highlights. Keep these separate from spelling and DB identity.
export const IDIOM_PREPOSITION_OVERRIDES = new Map([
  ['hand o in', [2]], ['hand in', [1]], ['give up', [1]], ['give in', [1]], ['take off', [1]], ['put off', [1]],
  ['come about', [1]], ['get by', [1]], ['bring about', [1]],
  ['look forward to', [1, 2]], ['be used to', [2]], ['used to', []],
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
    // Highlight adverbial particles that form a phrasal verb as well.
    const before = text.slice(0, token.index).trim().toLowerCase();
    // 'like' is a preposition after comparison/sense verbs, not in 'would like'.
    if (word === 'like') highlight = /(?:^|\s)(?:look(?:s|ed|ing)?|sound(?:s|ed|ing)?|feel(?:s|ing)?|felt|smell(?:s|ed|ing)?|smelt|taste(?:s|d)?|tasting|act(?:s|ed|ing)?|seem(?:s|ed|ing)?|be|is|are|was|were|been|being)\s*$/.test(before);
    const particle = /^(?:up|down|in|out|on|off|away|back|over|through|along|about|around|round|by|apart|aside|forward)$/;
    const phrasalVerb = /(?:^|\s)(?:be|blow|break|bring|call|carry|catch|check|come|cut|do|draw|drop|eat|fall|figure|fill|find|get|give|go|grow|hand|hang|hold|keep|leave|let|lie|live|look|make|move|pass|pay|pick|point|pull|push|put|read|ride|roll|run|send|set|settle|show|shut|sit|slow|speak|stand|stay|step|stick|stop|take|talk|tear|think|throw|try|turn|use|wake|walk|wear|work|write)(?:\s+(?:o|a|b|it|them|someone|something))?$/;
    if (particle.test(word) && phrasalVerb.test(before)) highlight = true;
    if (highlight) ranges.push([token.index, token.index + token[0].length]);
  }
  let cursor = 0, html = '';
  for (const [start, end] of ranges) {
    html += escapeHtml(text.slice(cursor, start)) + '<span class="idiom-preposition">' + escapeHtml(text.slice(start, end)) + '</span>';
    cursor = end;
  }
  return html + escapeHtml(text.slice(cursor));
}
