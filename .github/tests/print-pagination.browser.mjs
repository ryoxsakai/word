// npm install --no-save --package-lock=false playwright@1.63.0 pagedjs@0.4.3
// npx playwright install chromium
// node .github/tests/print-pagination.browser.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const pagedPath = process.env.PAGED_JS_PATH || resolve(dirname(require.resolve('pagedjs')), '../dist/paged.polyfill.js');
const app = await readFile(new URL('../../public/viewer/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../public/viewer/style.css', import.meta.url), 'utf8');
const extract = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const functions = [
  extract('function registerPagedProgressHandler(', 'function preparePrintHierarchy('),
  extract('function preparePrintIllustrationWrapping(', 'function prepareLightweightPrintDom('),
].join('\n');
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="lightblue"/></svg>');
const entries = [6, 33, 254, 300];
const normalize = text => text.replace(/\s+/g, '');
try {
  for (const mode of ['standard', 'compact', 'section']) {
    for (const columns of [1, 2, 3]) {
      const page = await browser.newPage();
      const fixture = entries.map((no, i) => `<section class="section-group" data-section-key="${i}" style="break-before:page">
        <div class="group-divider">Group ${i + 1}</div><div class="section-divider">Section ${i + 1}</div>
        <div class="section-entries"><div style="height:${[630, 690, 735, 770][i]}px">Previous entry</div>
        <article class="entry" data-word-id="word-${no}" data-no="${no}"><div class="entry-no">${no}</div><div class="entry-body">
        <div class="entry-head"><span class="headword">word-${no}</span></div><div class="entry-content"><div class="entry-card">
        <figure class="entry-illustration"><img src="${image}" width="100" height="100"></figure>
        <div class="sense-line">Meaning ${no}</div><div class="example-list">${Array.from({length:6}, (_, k) => `<div class="example-line"><span class="bullet">◇</span><span class="example-phrase">Phrase ${no}-${k}</span><span class="example-translation">Translation ${no}-${k}</span></div>`).join('')}</div>
        <div class="entry-notes"><div class="notes-block">First note ${no}</div><div class="notes-block">Last note ${no}</div></div>
        </div></div></div></article></div></section>`).join('');
      // Pin placeholder geometry to exercise page-boundary behavior independently of heading design.
      const boundaryHeadingCss = "\n.group-divider {\n  display: grid;\n  grid-template-columns: var(--hierarchy-copy-column) minmax(0, 1fr);\n  align-items: center;\n  gap: 0;\n  min-height: 4.75rem;\n  margin: 0 0 0.8rem;\n  padding: 0.85rem 1rem 0.85rem 0;\n  color: var(--text);\n  background: linear-gradient(100deg, color-mix(in srgb, var(--chapter-color) 10%, var(--surface)), var(--surface) 72%);\n  border: 1px solid color-mix(in srgb, var(--chapter-color) 36%, var(--border));\n  border-left: 1px solid color-mix(in srgb, var(--chapter-color) 36%, var(--border));\n  border-radius: 11px;\n  box-shadow: 0 2px 8px color-mix(in srgb, var(--chapter-color-deep) 5%, transparent);\n  scroll-margin-top: 6.2rem;\n}\n\n.section-divider {\n  display: grid;\n  grid-template-columns: var(--hierarchy-copy-column) minmax(0, 1fr);\n  align-items: center;\n  gap: 0;\n  min-height: 2.75rem;\n  margin: 0 0 0.45rem;\n  padding: 0.34rem 0.9rem 0.34rem 0;\n  background: linear-gradient(100deg, color-mix(in srgb, var(--chapter-color) 12%, var(--surface)), color-mix(in srgb, var(--chapter-color) 5%, var(--surface)));\n  border: 1px solid color-mix(in srgb, var(--chapter-color) 30%, var(--border));\n  border-radius: 9px;\n  scroll-margin-top: 6.2rem;\n}\n.section-divider::after { content: none; }";
      await page.setContent(`<html><head><style>${css}\n${boundaryHeadingCss}\n@page {size:182mm 257mm;margin:12mm 12mm 14mm} .entry-illustration {float:right;width:90px;margin:0 0 8px 12px} .entry-illustration img {width:90px;height:90px}</style></head><body class="is-printing-book" data-print-engine="paged" data-print-pagination="${mode}" data-print-page-size="b5"><main class="word-list">${fixture}</main></body></html>`);
      await page.evaluate(({columns, entries}) => {
        window.PagedConfig = {auto:false};
        document.documentElement.style.setProperty('--print-example-columns', columns);
        window.el = {printExampleColumns:{value:String(columns)},printPageSize:{value:'b5'}};
        window.state = {chapters:[],groups:[],sections:entries.map((_, i)=>({key:String(i),name:`Section ${i+1}`}))};
        window.boundedIntegerPrintSetting = (v, fallback, min, max) => Math.max(min, Math.min(max, Number(v)||fallback));
        window.normalizedPrintPageSize = () => 'b5';
        window.PRINT_PAGE_SIZE_LABELS = {b5:'B5'};
        window.setPrintProgress = () => {};
        window.removeLeadingEmptyChapterPrintPages = () => 0;
      }, {columns, entries});
      await page.addScriptTag({path:pagedPath});
      await page.addScriptTag({content:functions});
      const expected = await page.evaluate(() => {
        preparePrintEntryFlow();
        preparePrintIllustrationWrapping();
        return [...document.querySelectorAll('.entry')].map(e=>({id:e.dataset.wordId,text:e.textContent}));
      });
      await page.evaluate(async () => {
        await Promise.all([...document.images].map(i=>i.decode()));
        registerPagedProgressHandler(state.sections.map(s=>s.key));
        await PagedPolyfill.preview();
      });
      const result = await page.evaluate(() => [...document.querySelectorAll('.pagedjs_page')].map((p, i)=>({
        page:i,
        header:!!p.querySelector('.print-running-header'),
        hasSection:!!p.querySelector('.section-group'),
        entries:[...p.querySelectorAll('.entry')].map(e=>({
          id:e.dataset.wordId,text:e.textContent,deferred:!!e.querySelector('[data-print-deferred-illustration]'),
          numbers:[...e.querySelectorAll('.entry-no')].map(n=>({text:n.textContent,top:n.getBoundingClientRect().top})),
          word:e.querySelector('.headword')?.textContent,
          headTop:e.querySelector('.entry-head')?.getBoundingClientRect().top,
          images:[...e.querySelectorAll('.entry-illustration img')].filter(img=>img.getBoundingClientRect().width>0).length,
          rows:[...e.querySelectorAll('.print-example-row')].map(row=>[...row.querySelectorAll('.example-line')].map(line=>({phrase:line.querySelector('.example-phrase')?.textContent,translation:line.querySelector('.example-translation')?.textContent}))),
        })),
      })));
      for (const item of expected) {
        const fragments = result.flatMap(p=>p.entries.filter(e=>e.id===item.id));
        assert.equal(normalize(fragments.map(e=>e.text).join('')), normalize(item.text), `${mode}/${columns}: preserve ${item.id} text`);
        assert.equal(fragments.reduce((n,e)=>n+e.images,0),1, `${mode}/${columns}: exactly one visible image for ${item.id}`);
        const numbered = fragments.filter(e=>e.numbers.length);
        assert.equal(numbered.length,1, `${mode}/${columns}: one numbered fragment for ${item.id}`);
        assert.equal(numbered[0].numbers[0].text,item.id.slice(5));
        assert.equal(numbered[0].word,item.id, 'number stays with the headword');
        if(mode!=='section') assert(Math.abs(numbered[0].numbers[0].top-numbered[0].headTop)<1, 'number aligns with the heading');
        if(mode!=='section') {
          for(const row of fragments.flatMap(e=>e.rows)) {
            assert.equal(row.length,columns, 'do not split a phrase row across pages');
            for(const line of row) assert.equal(line.translation, line.phrase?.replace('Phrase','Translation'), 'keep each translation with its phrase');
          }
        }
      }
      for(const p of result) if(p.hasSection) assert(p.header,'include header on the first body page too');
      if(mode!=='section') assert(result.some(p=>p.entries.some(e=>e.deferred)), 'exercise deferred image placement');
      console.log(`Print pagination ${mode}, ${columns} columns: passed (${result.length} pages)`);
      await page.close();
    }
  }
} finally { await browser.close(); }
