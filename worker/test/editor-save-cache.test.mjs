import { groupIdiomEntries } from '../../public/shared/idioms.js';
import { createIdiomReferenceResolver } from '../../public/shared/idiom-references.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = readFileSync(new URL('../../public/setting/app.js', import.meta.url), 'utf8');
const slice = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const a = { id: 'a', spelling: 'alpha', no: 1, branch: 0, displayNo: '1', sectionId: 1, labelId: 1 };
const b = { id: 'b', spelling: 'beta', no: 2, branch: 0, displayNo: '2', sectionId: 2, labelId: null };
const storage = new Map();
const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const state = { currentListId: 'book', words: [a, b], sections: [{ id: 1, sortOrder: 1 }, { id: 2, sortOrder: 2 }], chapters: [], labels: [{ id: 1, name: 'Label', sortOrder: 1 }],
  sectionWords: new Map([['1', [a]], ['2', [b]]]), sectionDataGeneration: 0, sectionPromises: new Map(), referencePromise: null };
const indexCache = new Map([['book', { words: [a, b] }], ['shared', { words: [a] }], ['unrelated', { words: [b] }]]);
const referenceCache = new Map([['book', { words: [{ id: 'a', spelling: 'alpha', phrases: ['old phrase'], derivatives: [{ word: 'old' }] }] }]]);
const sectionCache = new Map([['book:1', [a]], ['book:2', [b]], ['shared:1', [a]], ['unrelated:2', [b]]]);
const context = vm.createContext({ state, editorIndexCache: indexCache, editorSectionCache: sectionCache, editorReferenceCache: referenceCache,
  editorCacheGeneration: 0, EDITOR_PENDING_KEY: 'pending', API: '/api', localStorage, crypto: webcrypto,
  isNotebookView: () => true, editorSectionKey: id => id == null ? 'none' : String(id), editorSectionCacheKey: (list, key) => `${list}:${key}`,
  rebuildAutoCrossRefRenderer() {}, renderWordTableHead() {}, renderWordTable() {},
  setTimeout: fn => { fn(); },
});
vm.runInContext(slice('function clearEditorCaches(', '\nfunction resolveRef') + slice('function editorRowFromSavedWord(', '\nasync function saveWord()'), context);
const changed = { id: 'a', spelling: 'alphabet', senses: [{ is_primary: 1, meaning: 'new meaning', pos: '名' }], tags: { eiken: '2', target1900: '42' },
  examples: [{ type: 'phrase', sentence: 'new phrase' }], derivatives: [{ word: 'alphabetic' }],
  lists: [{ listId: 'book', no: 3, branch: 1, displayNo: '3-1', sectionId: 2, labelId: null }, { listId: 'shared' }] };
context.replaceSavedWordInEditor(changed);
assert.equal(indexCache.has('shared'), false, 'only other notebooks containing the changed word are invalidated');
assert.equal(indexCache.has('unrelated'), true);
assert.equal(sectionCache.get('unrelated:2')[0], b, 'unrelated section data is retained');
assert.equal(sectionCache.get('book:1').length, 0, 'old section removes the moved word');
assert.deepEqual(Array.from(sectionCache.get('book:2'), word => word.id), ['b', 'a']);
const row = sectionCache.get('book:2')[1];
assert.equal(row.labelId, null, 'clearing a label must not restore its old value');
assert.equal(row.primaryMeaning, 'new meaning');
assert.equal(row.target1900No, '42');
assert.deepEqual(Array.from(row.phrases), ['new phrase']);
assert.equal(referenceCache.get('book').words[0].derivatives[0].word, 'alphabetic');
assert.equal(indexCache.get('book').words.find(w => w.id === 'a').displayNo, '3-1');
changed.lists[0].sectionId = null;
context.replaceSavedWordInEditor(changed);
assert.equal(indexCache.get('book').words[0].sectionId, null, 'moving to no section is preserved');
assert.deepEqual(Array.from(sectionCache.get('book:2'), word => word.id), ['b']);

let calls = [];
context.editorFetch = async (url, options) => {
  calls.push([url, options]);
  return new Response('{}', { headers: { 'x-editor-snapshots': 'r2' } });
};
await context.api('/words/a', { method: 'PUT', preserveEditorCache: true, body: '{}' });
assert.equal(calls.length, 1, 'save is sent exactly once');
assert.equal(indexCache.has('unrelated'), true);
const pending = storage.get('pending');
assert.ok(pending, 'publication barrier survives reloads via localStorage');
let attempts = 0;
context.editorFetch = async url => {
  assert.match(url, /editorFresh=1/);
  attempts += 1;
  if (attempts === 1) return new Response(JSON.stringify({code:'editor_snapshot_pending'}), {status:503});
  return new Response('{}', {headers:{'x-editor-source':'r2'}});
};
await context.api('/lists/book/editor/index');
assert.equal(attempts, 2, 'only pending reads are retried');
assert.equal(storage.has('pending'), false);
storage.set('pending', pending);
context.editorFetch = async () => {
  storage.set('pending', 'newer-save');
  return new Response('{}', {headers:{'x-editor-source':'r2'}});
};
await context.api('/lists');
assert.equal(storage.get('pending'), 'newer-save', 'a read cannot clear a newer parallel save');
attempts = 0;
context.editorFetch = async () => { attempts += 1; return new Response(JSON.stringify({code:'editor_snapshot_pending',error:'failure'}),{status:503}); };
await assert.rejects(context.api('/words/a', {method:'PUT',body:'{}'}), /failure/);
assert.equal(attempts, 1, 'failed writes are never retried');
console.log('Editor save tests passed: scoped caches, moves, references, read-after-write barrier, no write retries');

const idiomChapters=[{key:'c',sections:[{key:'s'}]}];
const richIdioms=[
 {key:'one',sectionKey:'s',phrase:'look after',aliases:['care for'],alternateForms:['look after O'],meanings:[{meaning:'世話をする'}]},
 {key:'hidden',sectionKey:'s',phrase:'hidden phrase',hidden:true,meanings:[{meaning:'非表示'}]},
 {key:'two',sectionKey:'s',phrase:'look up',meanings:[{meaning:'調べる'}]},
];
const richResolver=createIdiomReferenceResolver(groupIdiomEntries(richIdioms,idiomChapters));
const lightResolver=createIdiomReferenceResolver(groupIdiomEntries(richIdioms.map(e=>({...e,meanings:[]})),idiomChapters));
for(const phrase of ['look after','care for','look after O','look up','hidden phrase']) {
 assert.deepEqual(lightResolver(phrase),richResolver(phrase),'lightweight index preserves references and numbering: '+phrase);
}
