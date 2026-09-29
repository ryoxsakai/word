// Display forms are separate from historical aliases and merged entry IDs.
export function idiomAlternateForms(entry) {
  const seen = new Set([String(entry?.phrase || '').trim().toLowerCase()]);
  return (entry?.alternateForms || []).filter(form => {
    if (typeof form !== 'string' || !form.trim()) return false;
    const key = form.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(form => form.trim());
}

export function validateIdiomAlternateForms(forms, phrase) {
  if (!Array.isArray(forms) || forms.length > 30 || forms.some(form =>
    typeof form !== 'string' || !form.trim() || form.length > 500)) {
    throw new Error('Invalid alternate forms');
  }
  const result = idiomAlternateForms({phrase, alternateForms: forms});
  if (result.length !== forms.length) throw new Error('Duplicate alternate forms');
  return result;
}

export function idiomAliasNames(aliases = []) {
  return aliases.flatMap(alias => typeof alias === 'string' ? [alias] : [alias?.phrase, alias?.key].filter(Boolean));
}

// Infer only a single object slot. Multiple slots (A ... B), subjects and
// complements retain their distinct roles. An internal slot before a particle
// is evidence that the phrasal verb permits a trailing object as well.
const OBJECT_PARTICLES = new Set('about along apart around aside away back down forward in off on out over through together up'.split(' '));
export function idiomObjectVariants(phrase) {
  const tokens = String(phrase || '').trim().split(/\s+/);
  const slots = tokens.map((token, index) => /^[OABCSV]$/.test(token) ? index : -1).filter(index => index >= 0);
  if (slots.length !== 1 || !/^[OA]$/.test(tokens[slots[0]])) return [];
  const slot = slots[0], variants = new Set();
  for (const object of ['O', 'A']) variants.add(tokens.map((token, i) => i === slot ? object : token).join(' '));
  if (tokens.length >= 3) variants.add(tokens.filter((_, i) => i !== slot).join(' '));
  if (tokens.length === 3 && slot === 1 && OBJECT_PARTICLES.has(tokens[2].toLowerCase())) {
    for (const object of ['O', 'A']) variants.add(`${tokens[0]} ${tokens[2]} ${object}`);
  }
  return [...variants];
}

export function idiomReferenceNames(entry) {
  const names = [entry.phrase, ...idiomAlternateForms(entry), ...idiomAliasNames(entry.aliases)];
  return [...new Set([...names, ...names.flatMap(idiomObjectVariants)].filter(Boolean))];
}
