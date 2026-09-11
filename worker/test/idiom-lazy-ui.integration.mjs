import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const editorHtml=readFileSync(new URL('../../public/setting/idioms.html',import.meta.url),'utf8');
const editorJs=readFileSync(new URL('../../public/setting/idioms.js',import.meta.url),'utf8');
const viewerJs=readFileSync(new URL('../../public/viewer/app.js',import.meta.url),'utf8');

assert.match(editorHtml,/class="word-table idiom-table"/,'idiom editor shares the word table design');
assert.match(editorHtml,/class="col-move">並び替え/);
assert.match(editorHtml,/id="loadingProgress" class="loading-progress"/,'idiom editor uses the shared loading animation');
assert.match(editorHtml,/class="modal-overlay" id="editModalOverlay"/,'idiom editor uses the same modal overlay as the word editor');
assert.match(editorHtml,/class="edit-pane idiom-edit-pane"/,'idiom editor uses the same edit panel as the word editor');
assert.doesNotMatch(editorHtml,/<dialog\b/,'idiom editor no longer uses a browser-native dialog');
assert.match(editorJs,/idioms\/index/,'editor loads the lightweight idiom index');
assert.match(editorJs,/idioms\/sections\//,'editor loads individual idiom sections');
assert.match(editorJs,/IntersectionObserver/,'editor lazily observes section rows');
assert.match(editorJs,/draggable="true"/,'editor exposes drag and drop rows');
assert.match(editorJs,/entry-up/,'editor keeps button-based reordering available');
assert.match(editorJs,/touchstart/,'touch devices use long-press reordering');
assert.match(editorJs,/beginIdiomEditorLoading/,'idiom editor starts progress feedback for network work');
assert.match(editorJs,/endIdiomEditorLoading/,'idiom editor always finishes progress feedback');
assert.match(editorJs,/event\.target===el\.editModalOverlay/,'clicking the backdrop closes the idiom editor');
assert.match(editorJs,/section\.visibleCount>0/,'normal mode excludes sections containing only hidden idioms');
assert.match(editorJs,/section\.totalCount>0/,'hidden-item mode can inspect archived sections without showing truly empty sections');
assert.match(editorJs,/number==null\?'非表示'/,'archived sections never reuse a visible Section number');
assert.match(viewerJs,/idioms\/index/,'viewer loads the lightweight idiom index');
assert.match(viewerJs,/loadIdiomSection/);
assert.match(viewerJs,/setupIdiomLazyObserver/);
assert.match(viewerJs,/loadAllIdiomSections/,'search and print can hydrate every section');

console.log('Idiom editor parity, reordering and section lazy loading passed');
