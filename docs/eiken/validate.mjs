import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const book = JSON.parse(await readFile(new URL('public/eiken/data.json',root),'utf8'));
assert.equal(book.id,'eiken-medical-100');
assert.equal(book.entries.length,100);
assert.deepEqual(book.chapters.map(c=>c.target),['5級','4級','3級','準2級']);
assert.equal(new Set(book.entries.map(w=>w.id)).size,100);
assert.equal(new Set(book.entries.map(w=>w.spelling)).size,100);
for (const chapter of book.chapters) assert.equal(book.entries.filter(w=>w.chapter===chapter.id).length,25);
for (const [index,w] of book.entries.entries()) {
  assert.equal(w.number,index+1);
  assert.equal(w.id,`eiken-med-${String(index+1).padStart(3,'0')}`);
  for(const key of ['spelling','pronunciation','pos','meaning','example','translation','notes'])assert.ok(w[key]?.trim(),`${w.id} ${key}`);
  for(const key of ['synonyms','antonyms','derivatives','etymology','audioUrl'])assert.ok(!(key in w),`${w.id} unwanted ${key}`);
  assert.match(w.illustration.path,/^\.\/assets\/images\/[a-z0-9-]+\.png$/);
  const img=new URL('public/eiken/'+w.illustration.path.replace(/^\.\//,''),root);
  assert.ok((await stat(img)).size>1000,`${w.id} image`);
  assert.ok(w.stressRanges.length);
  let lastEnd=0;
  for(const [start,end]of w.stressRanges){assert.ok(start>=lastEnd && end>start && end<=w.spelling.length,`${w.id} stress`);lastEnd=end;}
}
const manifest=JSON.parse(await readFile(new URL('docs/eiken/asset-manifest.json',root),'utf8'));
assert.equal(manifest.length,100);
for(const item of manifest){
  const bytes=await readFile(new URL(item.file,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,`${item.entryId} asset changed`);
}
const app=await readFile(new URL('public/eiken/app.js',root),'utf8');
assert.equal((app.match(/\bfetch\(/g)||[]).length,1);
assert.ok(app.includes("fetch('./data.json')"));
assert.ok(!/mcp-viewer|mcp-editor|\/api\/|crossover-v3|vocab-viewer-/.test(app));
console.log('PASS: 100 unique entries; 25 per chapter; 100 local images and hashes; isolated static master; notes only; no audio/API writes.');
