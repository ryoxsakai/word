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
