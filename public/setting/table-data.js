// Table edits keep a normalized draft and merge only changed fields into a fresh record.
export const clone = value => structuredClone(value);
const text = value => value == null ? '' : String(value);
export const same = (a, b) => JSON.stringify(a, (key, value) => key === 'id' ? undefined : value) === JSON.stringify(b, (key, value) => key === 'id' ? undefined : value);
export const cautions = ['ergative','spellingCaution','pronunciationCaution','accentCaution','polysemousCaution','conjugationCaution','usageCaution'];
export const wordTextFields = ['spelling','pronunciation','irregularForms','synonyms','antonyms','relatedWords','etymology','notes'];
export function wordDraft(word, listId) {
  const member = word.lists?.find(item => item.listId === listId) || word;
  const tags = word.tags || {};
  return {
    ...Object.fromEntries(wordTextFields.map(key => [key, text(word[key])])),
    ...Object.fromEntries(cautions.map(key => [key, !!word[key]])),
    no: text(member.displayNo ?? member.no), sectionId: text(member.sectionId), labelId: text(member.labelId),
    derivedFrom: word.derivedFrom?.spelling || word.derivedFromSpelling || '',
    senses: (word.senses || []).map(s => ({pos:text(s.pos),meaning:text(s.meaning),pronunciation:text(s.pronunciation),is_primary:!!(s.is_primary ?? s.isPrimary)})),
    examples: (word.examples || []).map(e => ({type:e.type || 'example',sentence:text(e.sentence),translation:text(e.translation),answer:text(e.answer)})),
    derivatives: (word.derivatives || []).map(d => ({pos:text(d.pos),word:text(d.word),meaning:text(d.meaning)})),
    oxford5000:text(tags.oxford5000), cefr_provisional:text(tags.cefr_provisional), awl:text(tags.awl), eiken:text(tags.eiken),
    custom: Object.keys(tags).filter(k => k.startsWith('custom:')).map(k => k.slice(7)).sort().join(', '),
  };
}
export function idiomDraft(entry) {
  return {phrase:text(entry.phrase),alternateForms:(entry.alternateForms || []).join('\n'),sectionKey:text(entry.sectionKey),labelKey:text(entry.labelKey),hidden:!!entry.hidden,
    synonyms:text(entry.synonyms),antonyms:text(entry.antonyms),notes:text(entry.notes),
    meanings:(entry.meanings || []).map(s => ({...s.id ? {id:s.id} : {},meaning:text(s.meaning),wordIds:[...(s.wordIds || (s.refs || []).map(r => r.wordId))].sort()}))};
}
export function changedKeys(before, draft) { return Object.keys(draft).filter(key => !same(before[key], draft[key])); }
export function mergeDraft(before, draft, latest) {
  const merged = clone(latest);
  for (const key of changedKeys(before, draft)) {
    if (!same(before[key], latest[key]) && !same(draft[key], latest[key])) throw new Error('別の編集で内容が変更されています。入力を控え、このSectionを再読み込みして確認してください。');
    merged[key] = clone(draft[key]);
  }
  return merged;
}
export function wordPayload(draft, latest = {}) {
  if (!draft.spelling.trim()) throw new Error('単語を入力してください。');
  if (draft.senses.some(s => !s.meaning.trim())) throw new Error('意味が空欄です。入力するか、その意味の行を削除してください。');
  if (draft.examples.some(e => !e.sentence.trim())) throw new Error('例文・フレーズを入力してください。');
  if (draft.derivatives.some(d => !d.word.trim())) throw new Error('派生語を入力してください。');
  const tags = Object.fromEntries(['oxford5000','cefr_provisional','awl','eiken'].filter(k=>draft[k]).map(k=>[k,draft[k]]));
  for (const raw of draft.custom.split(',')) if (raw.trim()) tags[`custom:${raw.trim()}`] = true;
  return {...Object.fromEntries(wordTextFields.map(k=>[k,draft[k].trim() || null])),
    ...Object.fromEntries(cautions.map(k=>[k,draft[k]])), audioUrl:latest.audioUrl || null,
    derivedFrom:draft.derivedFrom.trim(), senses:draft.senses.map(s=>({...s,is_primary:s.is_primary ? 1 : 0,pronunciation:s.pronunciation || null})),
    examples:clone(draft.examples), derivatives:clone(draft.derivatives),tags};
}
export function idiomPayload(draft, latest = {}) {
  if (!draft.phrase.trim()) throw new Error('熟語を入力してください。');
  if (!draft.sectionKey) throw new Error('Sectionを選択してください。');
  if (!draft.meanings.length || draft.meanings.some(s=>!s.meaning.trim())) throw new Error('意味を1つ以上入力してください。');
  const used = new Set();
  return {...draft,...(latest.key ? {id:latest.key} : {}),labelKey:draft.labelKey || null,
    alternateForms:draft.alternateForms.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),
    // Match surviving meanings to their stored identities, including after reordering.
    meanings:draft.meanings.map(s=>{
      const old=(latest.meanings || []).find(x=>!used.has(x.id) && x.id===s.id) || (latest.meanings || []).find(x=>!used.has(x.id) && x.meaning===s.meaning);
      if(old?.id)used.add(old.id);
      return {meaning:s.meaning,wordIds:s.wordIds,...(old?.id ? {id:old.id} : {})};
    })};
}
export function membershipPayload(draft) {
  if (!/^\d+(?:-\d+)?$/.test(draft.no)) throw new Error('番号は「42」または「42-1」の形式で入力してください。');
  return {no:draft.no,sectionId:draft.sectionId ? Number(draft.sectionId) : null,labelId:draft.labelId ? Number(draft.labelId) : null};
}
