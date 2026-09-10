// Same ##target|label## syntax as words; optional word:/idiom: disambiguation.
const normalize = text => String(text || '').replace(/V-ed/gi, 'Vpp').replace(/’/g, "'").trim().replace(/\s+/g, ' ').toLowerCase();
export function createIdiomReferenceResolver(groups, resolveWord = () => ({found:false})) {
  const index = new Map();
  const ids = new Map();
  const add = (name, result) => {
    const key = normalize(name);
    if (!key) return;
    if (index.has(key) && index.get(key)?.id !== result.id) index.set(key, null);
    else if (!index.has(key)) index.set(key, result);
  };
  for (const chapter of groups || []) for (const section of chapter.sections) for (const e of section.items) {
    if (e.hidden) continue;
    const ref = {found:true, type:'idiom', id:e.key, no:e.no};
    ids.set(e.key, ref); add(e.phrase,ref);
    for (const alias of e.aliases || []) { add(alias.phrase,ref); if(alias.key) ids.set(alias.key,ref); }
  }
  const resolve = raw => {
    const text = String(raw).trim();
    if (/^word:/i.test(text)) return resolveWord(text.slice(5).trim());
    if (/^idiom:/i.test(text)) return index.get(normalize(text.slice(6))) || ids.get(text.slice(6).trim()) || {found:false};
    const word = resolveWord(text);
    return word?.found ? word : index.get(normalize(text)) || {found:false};
  };
  resolve.id = id => ids.get(id);
  resolve.phrases = [...index].filter(([,v])=>v).map(([key])=>key);
  return resolve;
}
